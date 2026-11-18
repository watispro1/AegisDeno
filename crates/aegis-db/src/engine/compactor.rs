//! Background compaction: a periodic timer (`AEGIS_DB_AUTO_COMPACT_SECS`) and
//! a WAL-size trigger (`AEGIS_DB_COMPACT_WAL_BYTES`) feed one task, which runs
//! each compaction on the blocking pool. `AegisDatabase::compact_with` holds
//! `compact_lock`, so these never overlap with each other or with
//! `POST /api/db/compact`.

use std::fmt;
use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tokio::task::JoinHandle;
use tokio::time::{interval, Interval, MissedTickBehavior};

use super::db::AegisDatabase;

/// What started a compaction. Reported in the stats endpoint.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CompactTrigger {
    /// The periodic timer.
    Timer,
    /// The live WAL reached `compact_wal_bytes`.
    WalSize,
    /// An explicit call, e.g. `POST /api/db/compact`.
    Manual,
}

impl CompactTrigger {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Timer => "timer",
            Self::WalSize => "wal_size",
            Self::Manual => "manual",
        }
    }
}

impl fmt::Display for CompactTrigger {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Ticks `timer` if there is one; otherwise never resolves.
async fn tick(timer: &mut Option<Interval>) {
    match timer {
        Some(t) => {
            t.tick().await;
        }
        None => std::future::pending::<()>().await,
    }
}

/// Runs one compaction on the blocking pool and logs the outcome.
pub async fn run_compaction(db: &Arc<AegisDatabase>, trigger: CompactTrigger) {
    let db = db.clone();
    match tokio::task::spawn_blocking(move || db.compact_with(trigger)).await {
        Ok(Ok(())) => {}
        Ok(Err(e)) => tracing::error!("Background compaction ({}) failed: {}", trigger, e),
        Err(e) => tracing::error!("Background compaction ({}) panicked: {}", trigger, e),
    }
}

/// Spawns the background compactor. `every` is the timer period (`None` turns
/// the timer off); the size trigger is active whenever the database was opened
/// with a non-zero `compact_wal_bytes`. Returns `None` when both are off.
pub fn spawn(db: Arc<AegisDatabase>, every: Option<Duration>) -> Option<JoinHandle<()>> {
    let size_enabled = db.options().compact_wal_bytes > 0;
    if every.is_none() && !size_enabled {
        return None;
    }
    Some(tokio::spawn(async move {
        let mut timer = every.map(|period| {
            let mut t = interval(period);
            t.set_missed_tick_behavior(MissedTickBehavior::Delay);
            t
        });
        loop {
            let trigger = tokio::select! {
                _ = tick(&mut timer) => CompactTrigger::Timer,
                _ = db.size_compaction_requested(), if size_enabled => CompactTrigger::WalSize,
            };
            // A timer or manual compaction may already have folded the WAL
            // that crossed the limit; don't checkpoint again for nothing.
            if trigger == CompactTrigger::WalSize && !db.wal_over_threshold() {
                continue;
            }
            run_compaction(&db, trigger).await;
        }
    }))
}
