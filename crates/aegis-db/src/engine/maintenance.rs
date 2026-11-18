//! Maintenance half of [`AegisDatabase`]: compaction, the WAL-size trigger,
//! backup export and stats. Reads and writes live in `db.rs`.
//!
//! Lock order everywhere: `compact_lock` -> scope stripe -> `wal` ->
//! `collections`; `last_compaction` is a leaf taken on its own.

use serde_json::Value;
use std::sync::atomic::Ordering;

use super::compactor::{CompactTrigger, CompactionRecord};
use super::db::{AegisDatabase, DbOptions};
use super::snapshot::{SnapshotData, SnapshotFormat};
use super::wal::sync_dir;

impl AegisDatabase {
    /// Options this database was opened with.
    pub fn options(&self) -> DbOptions {
        self.options
    }

    /// Format new snapshots (and default exports) are written in.
    pub fn snapshot_format(&self) -> SnapshotFormat {
        self.snapshot.format()
    }

    /// Current size of the live WAL in bytes.
    pub fn wal_bytes(&self) -> u64 {
        self.wal.lock().bytes()
    }

    /// True when the size trigger is enabled and the live WAL has reached it.
    pub fn wal_over_threshold(&self) -> bool {
        let limit = self.options.compact_wal_bytes;
        limit > 0 && self.wal_bytes() >= limit
    }

    /// True while a size-triggered compaction has been requested but has not
    /// started yet.
    pub fn size_compaction_pending(&self) -> bool {
        self.size_compaction_pending.load(Ordering::Acquire)
    }

    /// Resolves when a write has pushed the WAL past `compact_wal_bytes`. A
    /// request made while nobody is waiting is kept until the next call.
    pub async fn size_compaction_requested(&self) {
        self.size_notify.notified().await
    }

    /// Called after every append with the WAL size it left behind (and with no
    /// lock held): requests one size-triggered compaction per crossing.
    pub(super) fn note_wal_size(&self, wal_bytes: u64) {
        let limit = self.options.compact_wal_bytes;
        if limit == 0 || wal_bytes < limit {
            return;
        }
        if !self.size_compaction_pending.swap(true, Ordering::AcqRel) {
            tracing::debug!(
                "WAL reached {} bytes (limit {}), requesting compaction",
                wal_bytes,
                limit
            );
            self.size_notify.notify_one();
        }
    }

    /// Checkpoints the in-memory state. Under the WAL lock it copies every
    /// collection and rotates the WAL aside, so no write can land between the
    /// copy and the rotation. The snapshot is then written durably, and only
    /// after that is the rotated WAL removed.
    ///
    /// Whole compactions are serialized by `compact_lock`: a second caller
    /// waits for the first to finish, then checkpoints the newer state itself.
    pub fn compact(&self) -> std::io::Result<()> {
        self.compact_with(CompactTrigger::Manual)
    }

    /// [`compact`](Self::compact), recording what asked for it.
    pub fn compact_with(&self, trigger: CompactTrigger) -> std::io::Result<()> {
        let _compact_guard = self.compact_lock.lock();
        // Whatever pushed the WAL over the limit is about to be checkpointed.
        self.size_compaction_pending.store(false, Ordering::Release);
        tracing::info!(
            "Starting database compaction & checkpoint (trigger={})...",
            trigger
        );
        let started = std::time::Instant::now();

        let snapshot_data = {
            let mut wal_lock = self.wal.lock();
            let data = self.capture_locked();
            wal_lock.rotate(&self.rotated_wal_path)?;
            data
        };
        let snapshot_bytes = self.snapshot.save(&snapshot_data)?;

        match std::fs::remove_file(&self.rotated_wal_path) {
            Ok(()) => sync_dir(&self.data_dir)?,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e),
        }

        let record = CompactionRecord::finished(trigger, started.elapsed(), snapshot_bytes);
        tracing::info!(
            "Compaction completed successfully (trigger={}, {} ms, snapshot {} bytes).",
            trigger,
            record.duration_ms,
            snapshot_bytes
        );
        *self.last_compaction.lock() = Some(record);
        Ok(())
    }

    /// Copies every collection into a [`SnapshotData`]. The caller must hold
    /// the WAL lock so no write is half-applied while the copy is taken.
    fn capture_locked(&self) -> SnapshotData {
        let lock = self.collections.read();
        let collections = lock
            .iter()
            .map(|(name, col)| (name.clone(), col.all().into_iter().collect()))
            .collect();
        SnapshotData {
            version: 1,
            timestamp: chrono::Utc::now().timestamp_millis(),
            collections,
        }
    }

    /// A consistent point-in-time copy of the whole database, taken under the
    /// WAL lock (so every acknowledged write up to that point is included)
    /// without touching the files on disk.
    pub fn export_snapshot(&self) -> SnapshotData {
        let _wal_lock = self.wal.lock();
        self.capture_locked()
    }

    /// [`export_snapshot`](Self::export_snapshot) encoded in `format`, ready
    /// to download; returns the snapshot timestamp alongside the bytes.
    pub fn export_snapshot_bytes(&self, format: SnapshotFormat) -> std::io::Result<(i64, Vec<u8>)> {
        let data = self.export_snapshot();
        let bytes = super::snapshot::encode(&data, format)?;
        Ok((data.timestamp, bytes))
    }

    /// The most recent successful compaction since this process started.
    pub fn last_compaction(&self) -> Option<CompactionRecord> {
        self.last_compaction.lock().clone()
    }

    pub fn stats(&self) -> Value {
        // Read the WAL counters first and release the lock: holding
        // `collections` while waiting on `wal` would invert the lock order.
        let (wal_entries, wal_bytes) = {
            let wal = self.wal.lock();
            (wal.entries_count(), wal.bytes())
        };
        let last_compaction = self.last_compaction();
        let compaction_pending = self.size_compaction_pending();

        let lock = self.collections.read();
        let mut col_stats = serde_json::Map::new();
        let mut total_docs = 0;

        for (col_name, col) in lock.iter() {
            let count = col.len();
            total_docs += count;
            col_stats.insert(
                col_name.clone(),
                serde_json::json!({ "document_count": count }),
            );
        }

        serde_json::json!({
            "collections_count": lock.len(),
            "total_documents": total_docs,
            "wal_pending_entries": wal_entries,
            "wal_bytes": wal_bytes,
            "snapshot_bytes": self.snapshot.size_bytes(),
            "snapshot_format": self.snapshot.format().as_str(),
            "compact_wal_bytes": self.options.compact_wal_bytes,
            "size_compaction_pending": compaction_pending,
            "last_compaction": last_compaction,
            "data_directory": self.data_dir.to_string_lossy(),
            "collections": col_stats
        })
    }
}
