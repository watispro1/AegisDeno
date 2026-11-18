use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use std::time::Duration;

use aegis_db::engine::compactor;
use aegis_db::engine::db::{SNAPSHOT_FILE, WAL_FILE};
use aegis_db::engine::DEFAULT_COMPACT_WAL_BYTES;
use aegis_db::{AegisDatabase, Config, DbOptions};
use clap::Parser;
use serde_json::json;

fn tmp(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "aegis_compact_{}_{}_{}",
        name,
        std::process::id(),
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
    ));
    let _ = fs::remove_dir_all(&dir);
    dir
}

/// Regression test for the timer-vs-`POST /api/db/compact` race: two
/// compactions running at once could let the older snapshot overwrite the
/// newer one after the rotated WAL had already been deleted, losing every
/// write in between. Several compactors now run concurrently with writers and
/// every acknowledged write must survive a restart.
#[test]
fn concurrent_compactions_lose_no_data() {
    const WRITERS: usize = 4;
    const PER_WRITER: usize = 200;
    const COMPACTORS: usize = 3;

    let dir = tmp("concurrent");
    {
        let db = AegisDatabase::open(&dir).unwrap();
        let done = Arc::new(AtomicBool::new(false));

        let compactors: Vec<_> = (0..COMPACTORS)
            .map(|_| {
                let db = db.clone();
                let done = done.clone();
                std::thread::spawn(move || {
                    let mut runs = 0usize;
                    while !done.load(Ordering::Relaxed) {
                        db.compact().expect("concurrent compaction must not fail");
                        runs += 1;
                    }
                    runs
                })
            })
            .collect();

        let writers: Vec<_> = (0..WRITERS)
            .map(|t| {
                let db = db.clone();
                std::thread::spawn(move || {
                    for i in 0..PER_WRITER {
                        db.put("race", format!("w{t}:{i}"), json!({ "i": i }))
                            .unwrap();
                    }
                })
            })
            .collect();

        for w in writers {
            w.join().unwrap();
        }
        done.store(true, Ordering::Relaxed);
        let runs: usize = compactors.into_iter().map(|c| c.join().unwrap()).sum();
        assert!(runs >= COMPACTORS, "every compactor ran at least once");
        assert_eq!(db.collection("race").len(), WRITERS * PER_WRITER);
    }

    // Restart: only the snapshot and the WAL on disk count now.
    let db = AegisDatabase::open(&dir).unwrap();
    let col = db.collection("race");
    assert_eq!(
        col.len(),
        WRITERS * PER_WRITER,
        "every acknowledged write survives concurrent compactions and a restart"
    );
    for t in 0..WRITERS {
        for i in 0..PER_WRITER {
            assert_eq!(
                db.get("race", &format!("w{t}:{i}")),
                Some(json!({ "i": i }))
            );
        }
    }
    drop(db);
    let _ = fs::remove_dir_all(&dir);
}

/// Back-to-back compactions with no writes in between leave a loadable
/// snapshot and no stale rotated WAL behind.
#[test]
fn repeated_compaction_is_idempotent() {
    let dir = tmp("idempotent");
    {
        let db = AegisDatabase::open(&dir).unwrap();
        db.put("c", "k".into(), json!(1)).unwrap();
        for _ in 0..5 {
            db.compact().unwrap();
        }
    }
    assert!(!dir.join(aegis_db::engine::db::WAL_ROTATED_FILE).exists());
    let db = AegisDatabase::open(&dir).unwrap();
    assert_eq!(db.get("c", "k"), Some(json!(1)));
    drop(db);
    let _ = fs::remove_dir_all(&dir);
}

fn size_opts(limit: u64) -> DbOptions {
    DbOptions {
        compact_wal_bytes: limit,
        ..DbOptions::default()
    }
}

fn wal_len(dir: &std::path::Path) -> u64 {
    fs::metadata(dir.join(WAL_FILE))
        .map(|m| m.len())
        .unwrap_or(0)
}

#[test]
fn wal_size_threshold_defaults_and_parsing() {
    assert_eq!(DEFAULT_COMPACT_WAL_BYTES, 64 * 1024 * 1024);
    assert_eq!(DbOptions::default().compact_wal_bytes, 64 * 1024 * 1024);
    let parsed = Config::try_parse_from(["aegis-db"]).unwrap();
    assert_eq!(parsed.db_options().compact_wal_bytes, 64 * 1024 * 1024);
    let off = Config::try_parse_from(["aegis-db", "--compact-wal-bytes", "0"]).unwrap();
    assert_eq!(off.db_options().compact_wal_bytes, 0);
}

#[test]
fn wal_bytes_tracks_the_file_and_flags_a_pending_compaction() {
    let dir = tmp("wal_bytes");
    let db = AegisDatabase::open_with_options(&dir, size_opts(2048)).unwrap();
    assert_eq!(db.wal_bytes(), 0);
    let mut i = 0;
    while !db.size_compaction_pending() {
        db.put("w", format!("k{i}"), json!({ "pad": "y".repeat(100) }))
            .unwrap();
        assert_eq!(db.wal_bytes(), wal_len(&dir), "counter matches the file");
        i += 1;
        assert!(i < 100, "threshold never tripped");
    }
    assert!(db.wal_over_threshold());
    db.compact().unwrap();
    assert!(
        !db.size_compaction_pending(),
        "compaction clears the request"
    );
    assert_eq!(db.wal_bytes(), 0);
    drop(db);

    // A reopened WAL starts counting from the bytes already on disk.
    {
        let db = AegisDatabase::open(&dir).unwrap();
        db.put("w", "after".into(), json!(1)).unwrap();
        let on_disk = wal_len(&dir);
        drop(db);
        let db = AegisDatabase::open(&dir).unwrap();
        assert_eq!(db.wal_bytes(), on_disk);
    }
    let _ = fs::remove_dir_all(&dir);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn crossing_the_wal_size_limit_triggers_compaction() {
    let dir = tmp("size_trigger");
    let limit = 4096;
    let mut written = 0;
    {
        let db = AegisDatabase::open_with_options(&dir, size_opts(limit)).unwrap();
        // Timer off: only the size trigger can compact.
        let task = compactor::spawn(db.clone(), None).expect("size trigger enabled");
        while wal_len(&dir) < limit {
            db.put(
                "s",
                format!("k{written}"),
                json!({ "pad": "z".repeat(200) }),
            )
            .unwrap();
            written += 1;
        }
        let deadline = tokio::time::Instant::now() + Duration::from_secs(10);
        while !dir.join(SNAPSHOT_FILE).exists() || db.wal_bytes() >= limit {
            assert!(
                tokio::time::Instant::now() < deadline,
                "no size-triggered compaction"
            );
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
        task.abort();
        let _ = task.await;
        assert_eq!(db.collection("s").len(), written);
    }
    let db = AegisDatabase::open(&dir).unwrap();
    assert_eq!(
        db.collection("s").len(),
        written,
        "snapshot + WAL recover every write"
    );
    drop(db);
    let _ = fs::remove_dir_all(&dir);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn zero_disables_the_wal_size_trigger() {
    let dir = tmp("size_off");
    let db = AegisDatabase::open_with_options(&dir, size_opts(0)).unwrap();
    assert!(
        compactor::spawn(db.clone(), None).is_none(),
        "no timer and no size trigger: nothing to run"
    );
    for i in 0..100 {
        db.put("s", format!("k{i}"), json!({ "pad": "z".repeat(200) }))
            .unwrap();
    }
    assert!(db.wal_bytes() > 16 * 1024);
    assert!(!db.wal_over_threshold());
    assert!(!db.size_compaction_pending());
    tokio::time::sleep(Duration::from_millis(100)).await;
    assert!(!dir.join(SNAPSHOT_FILE).exists(), "nothing compacted");
    drop(db);
    let _ = fs::remove_dir_all(&dir);
}
