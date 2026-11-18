use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use aegis_db::AegisDatabase;
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
