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

/// Outcome of a finished compaction, reported under `last_compaction` in
/// `GET /api/db/stats` (and authorized `/metrics`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CompactionRecord {
    /// When it finished, Unix milliseconds.
    pub timestamp_ms: i64,
    /// When it finished, RFC 3339 (UTC).
    pub finished_at: String,
    /// Wall-clock time spent, lock wait excluded.
    pub duration_ms: u64,
    pub trigger: CompactTrigger,
    /// Size of the snapshot it wrote.
    pub snapshot_bytes: u64,
}

impl CompactionRecord {
    pub fn finished(trigger: CompactTrigger, took: Duration, snapshot_bytes: u64) -> Self {
        let now = chrono::Utc::now();
        Self {
            timestamp_ms: now.timestamp_millis(),
            finished_at: now.to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
            duration_ms: u64::try_from(took.as_millis()).unwrap_or(u64::MAX),
            trigger,
            snapshot_bytes,
        }
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
