use std::fs;
use std::path::{Path, PathBuf};

use aegis_db::engine::db::SNAPSHOT_FILE;
use aegis_db::engine::snapshot::{
    decode, encode, SnapshotData, SnapshotFormat, SnapshotManager, ZSTD_MAGIC,
};
use aegis_db::{AegisDatabase, Config, DbOptions};
use clap::Parser;
use serde_json::json;

fn tmp(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "aegis_snapfmt_{}_{}_{}",
        name,
        std::process::id(),
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
    ));
    let _ = fs::remove_dir_all(&dir);
    dir
}

fn opts(zstd: bool) -> DbOptions {
    DbOptions {
        snapshot_zstd: zstd,
    }
}

fn snapshot_head(dir: &Path) -> Vec<u8> {
    let bytes = fs::read(dir.join(SNAPSHOT_FILE)).unwrap();
    bytes[..4.min(bytes.len())].to_vec()
}

/// Writes a few documents with the given format and compacts them into a snapshot.
fn seed(dir: &Path, zstd: bool) {
    let db = AegisDatabase::open_with_options(dir, opts(zstd)).unwrap();
    for i in 0..50 {
        db.put(
            "docs",
            format!("k{i}"),
            json!({ "i": i, "pad": "x".repeat(64) }),
        )
        .unwrap();
    }
    db.compact().unwrap();
}

fn assert_seeded(db: &AegisDatabase) {
    assert_eq!(db.collection("docs").len(), 50);
    assert_eq!(db.get("docs", "k7").unwrap()["i"], 7);
}

#[test]
fn zstd_is_the_default() {
    assert!(DbOptions::default().snapshot_zstd);
    assert!(Config::default().snapshot_zstd);
    let parsed = Config::try_parse_from(["aegis-db"]).unwrap();
    assert!(parsed.snapshot_zstd);
    let off = Config::try_parse_from(["aegis-db", "--snapshot-zstd", "false"]).unwrap();
    assert!(!off.snapshot_zstd);
    let off = Config::try_parse_from(["aegis-db", "--snapshot-zstd", "0"]).unwrap();
    assert!(!off.db_options().snapshot_zstd);
}

#[test]
fn zstd_snapshot_round_trips() {
    let dir = tmp("zstd");
    seed(&dir, true);
    assert_eq!(
        snapshot_head(&dir),
        ZSTD_MAGIC,
        "snapshot starts with zstd magic"
    );
    assert!(!dir.join("snapshot.tmp").exists(), "temp file renamed away");
    let db = AegisDatabase::open_with_options(&dir, opts(true)).unwrap();
    assert_seeded(&db);
    drop(db);
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn json_snapshot_round_trips_when_disabled() {
    let dir = tmp("json");
    seed(&dir, false);
    assert_eq!(snapshot_head(&dir)[0], b'{', "plain JSON snapshot");
    let db = AegisDatabase::open_with_options(&dir, opts(false)).unwrap();
    assert_seeded(&db);
    drop(db);
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn legacy_json_snapshot_loads_and_is_upgraded_to_zstd() {
    let dir = tmp("legacy");
    seed(&dir, false);
    {
        let db = AegisDatabase::open_with_options(&dir, opts(true)).unwrap();
        assert_seeded(&db);
        db.compact().unwrap();
    }
    assert_eq!(snapshot_head(&dir), ZSTD_MAGIC, "rewritten as zstd");
    let db = AegisDatabase::open_with_options(&dir, opts(true)).unwrap();
    assert_seeded(&db);
    drop(db);
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn zstd_snapshot_still_loads_after_disabling_compression() {
    let dir = tmp("downgrade");
    seed(&dir, true);
    let db = AegisDatabase::open_with_options(&dir, opts(false)).unwrap();
    assert_seeded(&db);
    drop(db);
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn zstd_is_smaller_and_codec_detects_format() {
    let dir = tmp("codec");
    seed(&dir, true);
    let data: SnapshotData = SnapshotManager::new(&dir).load().unwrap().unwrap();
    let plain = encode(&data, SnapshotFormat::Json).unwrap();
    let packed = encode(&data, SnapshotFormat::Zstd).unwrap();
    assert!(
        packed.len() < plain.len(),
        "{} < {}",
        packed.len(),
        plain.len()
    );
    for bytes in [&plain, &packed] {
        let back = decode(bytes).unwrap();
        assert_eq!(back.collections, data.collections);
    }
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn corrupt_zstd_snapshot_is_an_error_not_silent_data_loss() {
    let dir = tmp("corrupt");
    fs::create_dir_all(&dir).unwrap();
    let mut junk = ZSTD_MAGIC.to_vec();
    junk.extend_from_slice(b"definitely not a zstd frame");
    fs::write(dir.join(SNAPSHOT_FILE), junk).unwrap();
    assert!(AegisDatabase::open(&dir).is_err());
    let _ = fs::remove_dir_all(&dir);
}
