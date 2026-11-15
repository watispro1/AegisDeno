use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::{self, BufReader, BufWriter};
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use serde_json::Value;

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

    pub fn save(&self, data: &SnapshotData) -> io::Result<()> {
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent)?;
        }

        let tmp_path = self.path.with_extension("tmp");
        {
            let file = File::create(&tmp_path)?;
            let writer = BufWriter::new(file);
            serde_json::to_writer_pretty(writer, data)
                .map_err(|e| io::Error::new(io::ErrorKind::Other, e))?;
        }

        fs::rename(tmp_path, &self.path)?;
        Ok(())
    }
}
