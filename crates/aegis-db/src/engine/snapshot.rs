use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::{self, BufReader, BufWriter, Write};
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::wal::sync_dir;

#[derive(Debug, Serialize, Deserialize)]
pub struct SnapshotData {
    pub version: u32,
    pub timestamp: i64,
    pub collections: BTreeMap<String, BTreeMap<String, Value>>,
}

pub struct SnapshotManager {
    path: PathBuf,
}

impl SnapshotManager {
    pub fn new<P: AsRef<Path>>(base_dir: P) -> Self {
        Self {
            path: base_dir.as_ref().join("snapshot.json"),
        }
    }

    pub fn snapshot_exists(&self) -> bool {
        self.path.exists()
    }

    pub fn load(&self) -> io::Result<Option<SnapshotData>> {
        if !self.path.exists() {
            return Ok(None);
        }
        let file = File::open(&self.path)?;
        let reader = BufReader::new(file);
        let data: SnapshotData = serde_json::from_reader(reader)
            .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
        Ok(Some(data))
    }

    /// Writes the snapshot to a temp file, fsyncs it, renames it over the old
    /// snapshot, then fsyncs the directory so the rename itself is durable.
    pub fn save(&self, data: &SnapshotData) -> io::Result<()> {
        let parent = self.path.parent().map(Path::to_path_buf).unwrap_or_else(|| PathBuf::from("."));
        fs::create_dir_all(&parent)?;

        let tmp_path = self.path.with_extension("tmp");
        {
            let file = File::create(&tmp_path)?;
            let mut writer = BufWriter::new(file);
            serde_json::to_writer(&mut writer, data).map_err(io::Error::other)?;
            writer.flush()?;
            let file = writer.into_inner().map_err(|e| e.into_error())?;
            file.sync_all()?;
        }

        fs::rename(&tmp_path, &self.path)?;
        sync_dir(&parent)?;
        Ok(())
    }
}
