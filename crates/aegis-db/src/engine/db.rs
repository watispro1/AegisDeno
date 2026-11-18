use parking_lot::{Mutex, MutexGuard, RwLock};
use serde_json::Value;
use std::collections::hash_map::DefaultHasher;
use std::collections::BTreeMap;
use std::fs::{File, OpenOptions, TryLockError};
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use super::collection::Collection;
use super::snapshot::{SnapshotData, SnapshotFormat, SnapshotManager};
use super::wal::{sync_dir, WalEntry, WalOp, WalReader, WalWriter};

/// File names used by the Rust service inside its data directory. The embedded
/// TypeScript engine uses different (`ts-*`) names, so pointing both at one
/// directory can never interleave their formats; the lock file stops two
/// processes of the same engine from sharing it.
pub const WAL_FILE: &str = "wal.log";
pub const WAL_ROTATED_FILE: &str = "wal.log.old";
pub const SNAPSHOT_FILE: &str = "snapshot.json";
pub const LOCK_FILE: &str = "aegis-db.lock";

const LOCK_STRIPES: usize = 64;

/// Engine tuning knobs. `Default` matches the service defaults.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DbOptions {
    /// Write snapshots zstd-compressed (`AEGIS_DB_SNAPSHOT_ZSTD`). Snapshots in
    /// either format are always readable.
    pub snapshot_zstd: bool,
}

impl Default for DbOptions {
    fn default() -> Self {
        Self {
            snapshot_zstd: true,
        }
    }
}

pub struct AegisDatabase {
    data_dir: PathBuf,
    rotated_wal_path: PathBuf,
    collections: RwLock<BTreeMap<String, Arc<Collection>>>,
    /// Serializes whole compactions (timer, size trigger and
    /// `POST /api/db/compact`), so an older snapshot can never be renamed over
    /// a newer one after the rotated WAL it depended on was deleted.
    ///
    /// Lock order: `compact_lock` -> a scope stripe (if any) -> `wal` ->
    /// `collections`. Never take `compact_lock` while holding any of the others.
    compact_lock: Mutex<()>,
    wal: Mutex<WalWriter>,
    snapshot: SnapshotManager,
    scope_locks: Vec<Mutex<()>>,
    /// Held for the life of the database; the OS releases it if the process dies.
    _dir_lock: File,
}

fn apply(collections_map: &mut BTreeMap<String, Arc<Collection>>, entries: Vec<WalEntry>) {
    for entry in entries {
        let col = collections_map
            .entry(entry.collection.clone())
            .or_insert_with(|| Arc::new(Collection::new(entry.collection)));
        match entry.op {
            WalOp::Put => {
                if let Ok(val) = serde_json::from_slice::<Value>(&entry.value) {
                    col.put(entry.key, val);
                }
            }
            WalOp::Delete => {
                col.delete(&entry.key);
            }
            WalOp::Checkpoint => {}
        }
    }
}

fn lock_data_dir(dir: &Path) -> std::io::Result<File> {
    let lock = OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(dir.join(LOCK_FILE))?;
    match lock.try_lock() {
        Ok(()) => Ok(lock),
        Err(TryLockError::WouldBlock) => Err(std::io::Error::new(
            std::io::ErrorKind::WouldBlock,
            format!(
                "data directory {} is already in use by another AegisDB process",
                dir.display()
            ),
        )),
        Err(TryLockError::Error(e)) => Err(e),
    }
}

impl AegisDatabase {
    /// Opens the database with the default [`DbOptions`].
    pub fn open<P: AsRef<Path>>(data_dir: P) -> std::io::Result<Arc<Self>> {
        Self::open_with_options(data_dir, DbOptions::default())
    }

    pub fn open_with_options<P: AsRef<Path>>(
        data_dir: P,
        options: DbOptions,
    ) -> std::io::Result<Arc<Self>> {
        let dir = data_dir.as_ref().to_path_buf();
        std::fs::create_dir_all(&dir)?;
        let dir_lock = lock_data_dir(&dir)?;

        let wal_path = dir.join(WAL_FILE);
        let rotated_wal_path = dir.join(WAL_ROTATED_FILE);
        let snapshot = SnapshotManager::with_format(
            &dir,
            SnapshotFormat::from_compress(options.snapshot_zstd),
        );

        let mut collections_map: BTreeMap<String, Arc<Collection>> = BTreeMap::new();

        // 1. Load snapshot if available
        if let Some(snap) = snapshot.load()? {
            tracing::info!(
                "Loaded snapshot timestamp={} collections={}",
                snap.timestamp,
                snap.collections.len()
            );
            for (col_name, docs) in snap.collections {
                let col = Arc::new(Collection::new(&col_name));
                for (k, v) in docs {
                    col.put(k, v);
                }
                collections_map.insert(col_name, col);
            }
        }

        // 2. Replay a WAL left over from a compaction that never finished, then
        //    the live WAL. Replaying the rotated log over a snapshot that already
        //    contains it is harmless: each key ends at its last logged value.
        let rotated = WalReader::replay(&rotated_wal_path)?;
        let live = WalReader::replay(&wal_path)?;
        if !rotated.is_empty() || !live.is_empty() {
            tracing::info!(
                "Replaying {} rotated + {} live WAL entries...",
                rotated.len(),
                live.len()
            );
        }
        apply(&mut collections_map, rotated);
        apply(&mut collections_map, live);

        let wal_writer = WalWriter::open(&wal_path)?;

        let db = Arc::new(Self {
            data_dir: dir,
            rotated_wal_path,
            collections: RwLock::new(collections_map),
            compact_lock: Mutex::new(()),
            wal: Mutex::new(wal_writer),
            snapshot,
            scope_locks: (0..LOCK_STRIPES).map(|_| Mutex::new(())).collect(),
            _dir_lock: dir_lock,
        });

        // Ensure default collections exist
        let default_cols = [
            "guild_configs",
            "cases",
            "warnings",
            "economy",
            "starboard",
            "tickets",
            "reminders",
        ];
        for name in default_cols {
            db.collection(name);
        }

        Ok(db)
    }

    pub fn collection(&self, name: &str) -> Arc<Collection> {
        {
            let lock = self.collections.read();
            if let Some(col) = lock.get(name) {
                return col.clone();
            }
        }
        let mut lock = self.collections.write();
        lock.entry(name.to_string())
            .or_insert_with(|| Arc::new(Collection::new(name)))
            .clone()
    }

    /// Serializes read-modify-write sequences for one scope (for example
    /// `cases:<guild>` or `eco:<guild>:<user>`). Hold the guard across the read
    /// and the write; it must not be held across an `.await`.
    pub fn scope_lock(&self, scope: &str) -> MutexGuard<'_, ()> {
        let mut h = DefaultHasher::new();
        scope.hash(&mut h);
        self.scope_locks[(h.finish() as usize) % LOCK_STRIPES].lock()
    }

    pub fn put(&self, collection_name: &str, key: String, value: Value) -> std::io::Result<()> {
        let serialized = serde_json::to_vec(&value)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;

        let entry = WalEntry {
            op: WalOp::Put,
            timestamp: chrono::Utc::now().timestamp_millis(),
            collection: collection_name.to_string(),
            key: key.clone(),
            value: serialized,
        };

        // Log and apply under the WAL lock, so a compaction (which also takes
        // it) always sees either both or neither.
        let mut wal_lock = self.wal.lock();
        wal_lock.append(&entry)?;
        self.collection(collection_name).put(key, value);
        Ok(())
    }

    pub fn get(&self, collection_name: &str, key: &str) -> Option<Value> {
        let col = self.collection(collection_name);
        col.get(key)
    }

    pub fn delete(&self, collection_name: &str, key: &str) -> std::io::Result<bool> {
        let entry = WalEntry {
            op: WalOp::Delete,
            timestamp: chrono::Utc::now().timestamp_millis(),
            collection: collection_name.to_string(),
            key: key.to_string(),
            value: Vec::new(),
        };

        let mut wal_lock = self.wal.lock();
        wal_lock.append(&entry)?;
        Ok(self.collection(collection_name).delete(key).is_some())
    }

    /// Checkpoints the in-memory state. Under the WAL lock it copies every
    /// collection and rotates the WAL aside, so no write can land between the
    /// copy and the rotation. The snapshot is then written durably, and only
    /// after that is the rotated WAL removed.
    ///
    /// Whole compactions are serialized by `compact_lock`: a second caller
    /// waits for the first to finish, then checkpoints the newer state itself.
    pub fn compact(&self) -> std::io::Result<()> {
        let _compact_guard = self.compact_lock.lock();
        tracing::info!("Starting database compaction & checkpoint...");

        let mut snap_cols = BTreeMap::new();
        {
            let mut wal_lock = self.wal.lock();
            {
                let lock = self.collections.read();
                for (col_name, col) in lock.iter() {
                    snap_cols.insert(
                        col_name.clone(),
                        col.all().into_iter().collect::<BTreeMap<_, _>>(),
                    );
                }
            }
            wal_lock.rotate(&self.rotated_wal_path)?;
        }

        let snapshot_data = SnapshotData {
            version: 1,
            timestamp: chrono::Utc::now().timestamp_millis(),
            collections: snap_cols,
        };
        self.snapshot.save(&snapshot_data)?;

        match std::fs::remove_file(&self.rotated_wal_path) {
            Ok(()) => sync_dir(&self.data_dir)?,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e),
        }

        tracing::info!("Compaction completed successfully.");
        Ok(())
    }

    pub fn stats(&self) -> Value {
        // Read the WAL counter first and release it: holding `collections` while
        // waiting on `wal` would invert the lock order used by `put`.
        let wal_entries = self.wal.lock().entries_count();

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
            "data_directory": self.data_dir.to_string_lossy(),
            "collections": col_stats
        })
    }
}
