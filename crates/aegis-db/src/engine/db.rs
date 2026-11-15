use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use parking_lot::{Mutex, RwLock};
use serde_json::Value;

use super::collection::Collection;
use super::snapshot::{SnapshotData, SnapshotManager};
use super::wal::{WalEntry, WalOp, WalReader, WalWriter};

pub struct AegisDatabase {
    data_dir: PathBuf,
    collections: RwLock<BTreeMap<String, Arc<Collection>>>,
    wal: Mutex<WalWriter>,
    snapshot: SnapshotManager,
}

impl AegisDatabase {
    pub fn open<P: AsRef<Path>>(data_dir: P) -> std::io::Result<Arc<Self>> {
        let dir = data_dir.as_ref().to_path_buf();
        std::fs::create_dir_all(&dir)?;

        let wal_path = dir.join("wal.log");
        let snapshot = SnapshotManager::new(&dir);

        let mut collections_map: BTreeMap<String, Arc<Collection>> = BTreeMap::new();

        // 1. Load snapshot if available
        if let Some(snap) = snapshot.load()? {
            tracing::info!("Loaded snapshot timestamp={} collections={}", snap.timestamp, snap.collections.len());
            for (col_name, docs) in snap.collections {
                let col = Arc::new(Collection::new(&col_name));
                for (k, v) in docs {
                    col.put(k, v);
                }
                collections_map.insert(col_name, col);
            }
        }

        // 2. Replay WAL entries
        let wal_entries = WalReader::replay(&wal_path)?;
        let wal_count = wal_entries.len();
        if wal_count > 0 {
            tracing::info!("Replaying {} entries from WAL...", wal_count);
            for entry in wal_entries {
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

        let wal_writer = WalWriter::open(&wal_path)?;

        let db = Arc::new(Self {
            data_dir: dir,
            collections: RwLock::new(collections_map),
            wal: Mutex::new(wal_writer),
            snapshot,
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

        // Write to WAL first (durability)
        {
            let mut wal_lock = self.wal.lock();
            wal_lock.append(&entry)?;
        }

        // Apply to in-memory collection
        let col = self.collection(collection_name);
        col.put(key, value);

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

        {
            let mut wal_lock = self.wal.lock();
            wal_lock.append(&entry)?;
        }

        let col = self.collection(collection_name);
        Ok(col.delete(key).is_some())
    }

    pub fn compact(&self) -> std::io::Result<()> {
        tracing::info!("Starting database compaction & checkpoint...");

        let mut snap_cols = BTreeMap::new();
        {
            let lock = self.collections.read();
            for (col_name, col) in lock.iter() {
                let mut docs = BTreeMap::new();
                for (k, v) in col.all() {
                    docs.insert(k, v);
                }
                snap_cols.insert(col_name.clone(), docs);
            }
        }

        let snapshot_data = SnapshotData {
            version: 1,
            timestamp: chrono::Utc::now().timestamp_millis(),
            collections: snap_cols,
        };

        self.snapshot.save(&snapshot_data)?;

        // Reset WAL after successful snapshot persistence
        {
            let mut wal_lock = self.wal.lock();
            wal_lock.reset()?;
        }

        tracing::info!("Compaction completed successfully.");
        Ok(())
    }

    pub fn stats(&self) -> Value {
        let lock = self.collections.read();
        let mut col_stats = serde_json::Map::new();
        let mut total_docs = 0;

        for (col_name, col) in lock.iter() {
            let count = col.len();
            total_docs += count;
            col_stats.insert(col_name.clone(), serde_json::json!({ "document_count": count }));
        }

        let wal_entries = self.wal.lock().entries_count();

        serde_json::json!({
            "collections_count": lock.len(),
            "total_documents": total_docs,
            "wal_pending_entries": wal_entries,
            "data_directory": self.data_dir.to_string_lossy(),
            "collections": col_stats
        })
    }
}
