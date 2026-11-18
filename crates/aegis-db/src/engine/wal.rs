use crc32fast::Hasher;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

/// Largest payload a single WAL record may carry. Anything bigger is treated as
/// a corrupt length prefix (a torn or garbage header), never allocated.
pub const MAX_RECORD_BYTES: usize = 16 * 1024 * 1024;

/// op (1) + timestamp (8) + three u32 length prefixes (12).
const MIN_PAYLOAD_BYTES: usize = 1 + 8 + 4 + 4 + 4;

/// Record header: u32 payload length + u32 CRC32 of the payload.
const HEADER_BYTES: usize = 8;

#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WalOp {
    Put = 1,
    Delete = 2,
    Checkpoint = 3,
}

impl TryFrom<u8> for WalOp {
    type Error = io::Error;
    fn try_from(v: u8) -> Result<Self, Self::Error> {
        match v {
            1 => Ok(WalOp::Put),
            2 => Ok(WalOp::Delete),
            3 => Ok(WalOp::Checkpoint),
            _ => Err(io::Error::new(io::ErrorKind::InvalidData, "invalid wal op")),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WalEntry {
    pub op: WalOp,
    pub timestamp: i64,
    pub collection: String,
    pub key: String,
    pub value: Vec<u8>,
}

/// Serializes one entry into a complete on-disk record (header + payload).
pub fn encode_record(entry: &WalEntry) -> io::Result<Vec<u8>> {
    let col_bytes = entry.collection.as_bytes();
    let key_bytes = entry.key.as_bytes();
    let mut payload = Vec::with_capacity(
        MIN_PAYLOAD_BYTES + col_bytes.len() + key_bytes.len() + entry.value.len(),
    );
    payload.push(entry.op as u8);
    payload.extend_from_slice(&entry.timestamp.to_le_bytes());
    payload.extend_from_slice(&(col_bytes.len() as u32).to_le_bytes());
    payload.extend_from_slice(col_bytes);
    payload.extend_from_slice(&(key_bytes.len() as u32).to_le_bytes());
    payload.extend_from_slice(key_bytes);
    payload.extend_from_slice(&(entry.value.len() as u32).to_le_bytes());
    payload.extend_from_slice(&entry.value);

    if payload.len() > MAX_RECORD_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "wal record exceeds MAX_RECORD_BYTES",
        ));
    }

    let mut hasher = Hasher::new();
    hasher.update(&payload);
    let checksum = hasher.finalize();

    let mut record = Vec::with_capacity(HEADER_BYTES + payload.len());
    record.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    record.extend_from_slice(&checksum.to_le_bytes());
    record.extend_from_slice(&payload);
    Ok(record)
}

/// fsyncs a directory so a rename or a newly created file inside it survives a crash.
pub fn sync_dir(dir: &Path) -> io::Result<()> {
    match File::open(dir) {
        Ok(d) => d.sync_all(),
        // Some platforms cannot open directories; the rename is still atomic there.
        Err(e) if e.kind() == io::ErrorKind::PermissionDenied => Ok(()),
        Err(e) => Err(e),
    }
}

pub struct WalWriter {
    file: File,
    path: PathBuf,
    entries_count: usize,
}

impl WalWriter {
    pub fn open<P: AsRef<Path>>(path: P) -> io::Result<Self> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let file = OpenOptions::new().create(true).append(true).open(&path)?;
        Ok(Self {
            file,
            path,
            entries_count: 0,
        })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Appends one record in a single write and fsyncs it before returning, so
    /// an acknowledged write survives power loss.
    pub fn append(&mut self, entry: &WalEntry) -> io::Result<()> {
        let record = encode_record(entry)?;
        self.file.write_all(&record)?;
        self.file.sync_data()?;
        self.entries_count += 1;
        Ok(())
    }

    pub fn entries_count(&self) -> usize {
        self.entries_count
    }

    /// Truncates the live WAL in place (only safe when nothing in it is needed).
    pub fn reset(&mut self) -> io::Result<()> {
        self.file.sync_all()?;
        self.file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&self.path)?;
        self.file.sync_all()?;
        self.file = OpenOptions::new().append(true).open(&self.path)?;
        self.entries_count = 0;
        Ok(())
    }

    /// Moves everything written so far into `old_path` and starts an empty WAL.
    /// When `old_path` already holds records from a compaction whose snapshot
    /// never landed, the current records are appended after them instead of
    /// overwriting them.
    pub fn rotate(&mut self, old_path: &Path) -> io::Result<()> {
        self.file.sync_all()?;
        if old_path.exists() {
            let current = fs::read(&self.path)?;
            let mut old = OpenOptions::new().append(true).open(old_path)?;
            old.write_all(&current)?;
            old.sync_all()?;
            self.file = OpenOptions::new()
                .create(true)
                .write(true)
                .truncate(true)
                .open(&self.path)?;
            self.file.sync_all()?;
        } else {
            fs::rename(&self.path, old_path)?;
            File::create(&self.path)?.sync_all()?;
        }
        if let Some(parent) = self.path.parent() {
            sync_dir(parent)?;
        }
        self.file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)?;
        self.entries_count = 0;
        Ok(())
    }
}

/// Result of scanning a WAL file.
#[derive(Debug)]
pub struct ReplayOutcome {
    pub entries: Vec<WalEntry>,
    /// Byte offset just past the last intact record.
    pub valid_len: u64,
    /// Size of the file as found on disk.
    pub file_len: u64,
}

fn read_u32(buf: &[u8], at: usize) -> Option<u32> {
    buf.get(at..at + 4)
        .map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
}

fn decode_payload(payload: &[u8]) -> Option<WalEntry> {
    let op = WalOp::try_from(*payload.first()?).ok()?;
    let ts_bytes: [u8; 8] = payload.get(1..9)?.try_into().ok()?;
    let timestamp = i64::from_le_bytes(ts_bytes);
    let mut at = 9;
    let take = |at: &mut usize| -> Option<Vec<u8>> {
        let len = read_u32(payload, *at)? as usize;
        *at += 4;
        let bytes = payload.get(*at..at.checked_add(len)?)?.to_vec();
        *at += len;
        Some(bytes)
    };
    let collection = String::from_utf8(take(&mut at)?).ok()?;
    let key = String::from_utf8(take(&mut at)?).ok()?;
    let value = take(&mut at)?;
    if at != payload.len() {
        return None;
    }
    Some(WalEntry {
        op,
        timestamp,
        collection,
        key,
        value,
    })
}

pub struct WalReader;

impl WalReader {
    /// Scans a WAL and stops at the first record that is torn (short header or
    /// payload), has an impossible length, fails its checksum, or does not
    /// decode (unknown op, bad UTF-8, trailing bytes). Never errors on content.
    pub fn read<P: AsRef<Path>>(path: P) -> io::Result<ReplayOutcome> {
        let path = path.as_ref();
        if !path.exists() {
            return Ok(ReplayOutcome {
                entries: Vec::new(),
                valid_len: 0,
                file_len: 0,
            });
        }
        let buf = fs::read(path)?;
        let mut entries = Vec::new();
        let mut offset = 0usize;

        while buf.len() - offset >= HEADER_BYTES {
            let length = read_u32(&buf, offset).unwrap_or(0) as usize;
            let expected = read_u32(&buf, offset + 4).unwrap_or(0);
            if !(MIN_PAYLOAD_BYTES..=MAX_RECORD_BYTES).contains(&length) {
                break;
            }
            let start = offset + HEADER_BYTES;
            let Some(payload) = buf.get(start..start + length) else {
                break;
            };
            let mut hasher = Hasher::new();
            hasher.update(payload);
            if hasher.finalize() != expected {
                break;
            }
            let Some(entry) = decode_payload(payload) else {
                break;
            };
            entries.push(entry);
            offset = start + length;
        }

        Ok(ReplayOutcome {
            entries,
            valid_len: offset as u64,
            file_len: buf.len() as u64,
        })
    }

    /// Like `read`, then truncates the file at the last intact record so new
    /// appends never land behind garbage.
    pub fn replay<P: AsRef<Path>>(path: P) -> io::Result<Vec<WalEntry>> {
        let path = path.as_ref();
        let outcome = Self::read(path)?;
        if outcome.valid_len < outcome.file_len {
            tracing::warn!(
                "WAL {} has {} unreadable trailing byte(s) after {} good record(s); truncating at offset {}",
                path.display(),
                outcome.file_len - outcome.valid_len,
                outcome.entries.len(),
                outcome.valid_len
            );
            let f = OpenOptions::new().write(true).open(path)?;
            f.set_len(outcome.valid_len)?;
            f.sync_all()?;
        }
        Ok(outcome.entries)
    }
}
