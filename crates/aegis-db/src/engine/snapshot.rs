use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::{self, BufReader, BufWriter, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

use super::wal::sync_dir;

/// First four bytes of every zstd frame (RFC 8878), little-endian 0xFD2FB528.
pub const ZSTD_MAGIC: [u8; 4] = [0x28, 0xB5, 0x2F, 0xFD];

/// zstd level used for snapshots: fast, and already several times smaller
/// than plain JSON for this kind of data.
pub const ZSTD_LEVEL: i32 = 3;

#[derive(Debug, Serialize, Deserialize)]
pub struct SnapshotData {
    pub version: u32,
    pub timestamp: i64,
    pub collections: BTreeMap<String, BTreeMap<String, Value>>,
}

/// On-disk encoding of a snapshot. Both are read back regardless of which one
/// is configured for writing; the format is detected from the magic bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SnapshotFormat {
    Json,
    Zstd,
}

impl SnapshotFormat {
    pub fn from_compress(compress: bool) -> Self {
        if compress {
            Self::Zstd
        } else {
            Self::Json
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Json => "json",
            Self::Zstd => "zstd",
        }
    }

    /// MIME type used when the snapshot is served over HTTP.
    pub fn content_type(self) -> &'static str {
        match self {
            Self::Json => "application/json",
            Self::Zstd => "application/zstd",
        }
    }

    /// File extension used for downloads.
    pub fn extension(self) -> &'static str {
        match self {
            Self::Json => "json",
            Self::Zstd => "json.zst",
        }
    }
}

/// Serializes `data` into `writer` in the given format.
pub fn encode_to<W: Write>(
    data: &SnapshotData,
    writer: W,
    format: SnapshotFormat,
) -> io::Result<W> {
    match format {
        SnapshotFormat::Json => {
            let mut writer = writer;
            serde_json::to_writer(&mut writer, data).map_err(io::Error::other)?;
            Ok(writer)
        }
        SnapshotFormat::Zstd => {
            let mut enc = zstd::stream::Encoder::new(writer, ZSTD_LEVEL)?;
            serde_json::to_writer(&mut enc, data).map_err(io::Error::other)?;
            enc.finish()
        }
    }
}

/// Serializes `data` into a byte buffer in the given format.
pub fn encode(data: &SnapshotData, format: SnapshotFormat) -> io::Result<Vec<u8>> {
    encode_to(data, Vec::new(), format)
}

/// Decodes a snapshot from bytes, detecting zstd by its magic bytes and
/// treating anything else as legacy plain JSON.
pub fn decode(bytes: &[u8]) -> io::Result<SnapshotData> {
    let invalid = |e: serde_json::Error| io::Error::new(io::ErrorKind::InvalidData, e);
    if bytes.starts_with(&ZSTD_MAGIC) {
        let dec = zstd::stream::Decoder::new(bytes)?;
        serde_json::from_reader(dec).map_err(invalid)
    } else {
        serde_json::from_slice(bytes).map_err(invalid)
    }
}

pub struct SnapshotManager {
    path: PathBuf,
    format: SnapshotFormat,
}

impl SnapshotManager {
    /// Snapshot manager writing plain JSON (the legacy format).
    pub fn new<P: AsRef<Path>>(base_dir: P) -> Self {
        Self::with_format(base_dir, SnapshotFormat::Json)
    }

    pub fn with_format<P: AsRef<Path>>(base_dir: P, format: SnapshotFormat) -> Self {
        Self {
            path: base_dir.as_ref().join(super::db::SNAPSHOT_FILE),
            format,
        }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn format(&self) -> SnapshotFormat {
        self.format
    }

    pub fn snapshot_exists(&self) -> bool {
        self.path.exists()
    }

    /// Size of the snapshot on disk, or 0 when there is none yet.
    pub fn size_bytes(&self) -> u64 {
        fs::metadata(&self.path).map(|m| m.len()).unwrap_or(0)
    }

    /// Loads the snapshot, whichever format it was written in.
    pub fn load(&self) -> io::Result<Option<SnapshotData>> {
        let mut file = match File::open(&self.path) {
            Ok(f) => f,
            Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(e) => return Err(e),
        };
        let mut magic = [0u8; 4];
        let mut read = 0;
        while read < magic.len() {
            match file.read(&mut magic[read..])? {
                0 => break,
                n => read += n,
            }
        }
        file.seek(SeekFrom::Start(0))?;
        let reader = BufReader::new(file);
        let invalid = |e: serde_json::Error| io::Error::new(io::ErrorKind::InvalidData, e);
        let data: SnapshotData = if read == 4 && magic == ZSTD_MAGIC {
            let dec = zstd::stream::Decoder::new(reader)?;
            serde_json::from_reader(dec).map_err(invalid)?
        } else {
            serde_json::from_reader(reader).map_err(invalid)?
        };
        Ok(Some(data))
    }

    /// Writes the snapshot to a temp file, fsyncs it, renames it over the old
    /// snapshot, then fsyncs the directory so the rename itself is durable.
    /// Returns the size of the new snapshot in bytes.
    pub fn save(&self, data: &SnapshotData) -> io::Result<u64> {
        let parent = self
            .path
            .parent()
            .map(Path::to_path_buf)
            .unwrap_or_else(|| PathBuf::from("."));
        fs::create_dir_all(&parent)?;

        let tmp_path = self.path.with_extension("tmp");
        let size = {
            let file = File::create(&tmp_path)?;
            let mut writer = encode_to(data, BufWriter::new(file), self.format)?;
            writer.flush()?;
            let file = writer.into_inner().map_err(|e| e.into_error())?;
            file.sync_all()?;
            file.metadata()?.len()
        };

        fs::rename(&tmp_path, &self.path)?;
        sync_dir(&parent)?;
        Ok(size)
    }
}
