use std::fs::{File, OpenOptions};
use std::io::{self, BufReader, BufWriter, Read, Write};
use std::path::{Path, PathBuf};
use crc32fast::Hasher;

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

pub struct WalWriter {
    writer: BufWriter<File>,
    path: PathBuf,
    entries_count: usize,
}

impl WalWriter {
    pub fn open<P: AsRef<Path>>(path: P) -> io::Result<Self> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)?;

        Ok(Self {
            writer: BufWriter::new(file),
            path,
            entries_count: 0,
        })
    }

    pub fn append(&mut self, entry: &WalEntry) -> io::Result<()> {
        let mut payload = Vec::new();
        payload.push(entry.op as u8);
        payload.extend_from_slice(&entry.timestamp.to_le_bytes());

        let col_bytes = entry.collection.as_bytes();
        payload.extend_from_slice(&(col_bytes.len() as u32).to_le_bytes());
        payload.extend_from_slice(col_bytes);

        let key_bytes = entry.key.as_bytes();
        payload.extend_from_slice(&(key_bytes.len() as u32).to_le_bytes());
        payload.extend_from_slice(key_bytes);

        payload.extend_from_slice(&(entry.value.len() as u32).to_le_bytes());
        payload.extend_from_slice(&entry.value);

        let mut hasher = Hasher::new();
        hasher.update(&payload);
        let checksum = hasher.finalize();

        let length = payload.len() as u32;

        self.writer.write_all(&length.to_le_bytes())?;
        self.writer.write_all(&checksum.to_le_bytes())?;
        self.writer.write_all(&payload)?;
        self.writer.flush()?;

        self.entries_count += 1;
        Ok(())
    }

    pub fn entries_count(&self) -> usize {
        self.entries_count
    }

    pub fn reset(&mut self) -> io::Result<()> {
        self.writer.flush()?;
        let file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&self.path)?;
        self.writer = BufWriter::new(file);
        self.entries_count = 0;
        Ok(())
    }
}

pub struct WalReader;

impl WalReader {
    pub fn replay<P: AsRef<Path>>(path: P) -> io::Result<Vec<WalEntry>> {
        let path = path.as_ref();
        if !path.exists() {
            return Ok(Vec::new());
        }

        let file = File::open(path)?;
        let mut reader = BufReader::new(file);
        let mut entries = Vec::new();

        loop {
            let mut len_buf = [0u8; 4];
            match reader.read_exact(&mut len_buf) {
                Ok(_) => {},
                Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => break,
                Err(e) => return Err(e),
            }
            let length = u32::from_le_bytes(len_buf) as usize;

            let mut checksum_buf = [0u8; 4];
            reader.read_exact(&mut checksum_buf)?;
            let expected_checksum = u32::from_le_bytes(checksum_buf);

            let mut payload = vec![0u8; length];
            reader.read_exact(&mut payload)?;

            let mut hasher = Hasher::new();
            hasher.update(&payload);
            let calculated_checksum = hasher.finalize();

            if calculated_checksum != expected_checksum {
                // Detected corruption in trailing WAL (e.g. from an ungraceful OS crash midway write)
                // We truncate replay safely at the last valid record.
                tracing::warn!("WAL corruption detected at entry, stopping replay safely");
                break;
            }

            let mut cursor = io::Cursor::new(payload);

            let mut op_buf = [0u8; 1];
            cursor.read_exact(&mut op_buf)?;
            let op = WalOp::try_from(op_buf[0])?;

            let mut ts_buf = [0u8; 8];
            cursor.read_exact(&mut ts_buf)?;
            let timestamp = i64::from_le_bytes(ts_buf);

            let mut col_len_buf = [0u8; 4];
            cursor.read_exact(&mut col_len_buf)?;
            let col_len = u32::from_le_bytes(col_len_buf) as usize;
            let mut col_buf = vec![0u8; col_len];
            cursor.read_exact(&mut col_buf)?;
            let collection = String::from_utf8(col_buf)
                .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

            let mut key_len_buf = [0u8; 4];
            cursor.read_exact(&mut key_len_buf)?;
            let key_len = u32::from_le_bytes(key_len_buf) as usize;
            let mut key_buf = vec![0u8; key_len];
            cursor.read_exact(&mut key_buf)?;
            let key = String::from_utf8(key_buf)
                .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

            let mut val_len_buf = [0u8; 4];
            cursor.read_exact(&mut val_len_buf)?;
            let val_len = u32::from_le_bytes(val_len_buf) as usize;
            let mut value = vec![0u8; val_len];
            cursor.read_exact(&mut value)?;

            entries.push(WalEntry {
                op,
                timestamp,
                collection,
                key,
                value,
            });
        }

        Ok(entries)
    }
}
