use std::fs;
use aegis_db::engine::AegisDatabase;

#[test]
fn test_database_basic_crud() {
    let tmp_dir = std::env::temp_dir().join(format!("aegis_test_basic_{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)));
    let _ = fs::remove_dir_all(&tmp_dir);

    {
        let db = AegisDatabase::open(&tmp_dir).expect("failed to open db");
        db.put("test_col", "k1".into(), serde_json::json!({ "name": "alice" })).expect("put failed");
        db.put("test_col", "k2".into(), serde_json::json!({ "name": "bob" })).expect("put failed");

        let val1 = db.get("test_col", "k1").expect("not found");
        assert_eq!(val1["name"], "alice");

        let val2 = db.get("test_col", "k2").expect("not found");
        assert_eq!(val2["name"], "bob");

        let col = db.collection("test_col");
        assert_eq!(col.len(), 2);

        let deleted = db.delete("test_col", "k1").expect("delete failed");
        assert!(deleted);
        assert!(db.get("test_col", "k1").is_none());
        assert_eq!(col.len(), 1);
    }

    let _ = fs::remove_dir_all(&tmp_dir);
}

#[test]
fn test_wal_durability_and_replay() {
    let tmp_dir = std::env::temp_dir().join(format!("aegis_test_wal_{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)));
    let _ = fs::remove_dir_all(&tmp_dir);

    // 1. Write items and close without compacting
    {
        let db = AegisDatabase::open(&tmp_dir).expect("failed to open db");
        db.put("guild_configs", "guild:123".into(), serde_json::json!({ "prefix": "!" })).unwrap();
        db.put("cases", "case:123:1".into(), serde_json::json!({ "case_id": 1, "action": "ban" })).unwrap();
        db.put("cases", "case:123:2".into(), serde_json::json!({ "case_id": 2, "action": "warn" })).unwrap();
    }

    // 2. Re-open database from disk and ensure WAL replay restored state
    {
        let db = AegisDatabase::open(&tmp_dir).expect("failed to re-open db");
        let cfg = db.get("guild_configs", "guild:123").expect("cfg missing");
        assert_eq!(cfg["prefix"], "!");

        let case1 = db.get("cases", "case:123:1").expect("case 1 missing");
        assert_eq!(case1["action"], "ban");

        let case2 = db.get("cases", "case:123:2").expect("case 2 missing");
        assert_eq!(case2["action"], "warn");
    }

    let _ = fs::remove_dir_all(&tmp_dir);
}

#[test]
fn test_snapshot_compaction() {
    let tmp_dir = std::env::temp_dir().join(format!("aegis_test_compact_{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)));
    let _ = fs::remove_dir_all(&tmp_dir);

    {
        let db = AegisDatabase::open(&tmp_dir).expect("failed to open db");
        for i in 1..=50 {
            db.put("economy", format!("eco:user_{}", i), serde_json::json!({ "wallet": i * 100 })).unwrap();
        }

        // Run compaction
        db.compact().expect("compact failed");
        assert!(tmp_dir.join("snapshot.json").exists());
    }

    // Reopen and verify all 50 records exist from snapshot
    {
        let db = AegisDatabase::open(&tmp_dir).expect("failed to reopen db");
        let col = db.collection("economy");
        assert_eq!(col.len(), 50);

        let user25 = db.get("economy", "eco:user_25").expect("user 25 not found");
        assert_eq!(user25["wallet"], 2500);
    }

    let _ = fs::remove_dir_all(&tmp_dir);
}

#[test]
fn test_concurrent_access() {
    let tmp_dir = std::env::temp_dir().join(format!("aegis_test_concurrent_{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)));
    let _ = fs::remove_dir_all(&tmp_dir);

    let db = AegisDatabase::open(&tmp_dir).expect("failed to open db");
    let mut handles = Vec::new();

    for thread_idx in 0..8 {
        let db_clone = db.clone();
        handles.push(std::thread::spawn(move || {
            for i in 0..100 {
                let key = format!("worker_{}:{}", thread_idx, i);
                db_clone.put("bench", key, serde_json::json!({ "count": i })).unwrap();
            }
        }));
    }

    for h in handles {
        h.join().unwrap();
    }

    let col = db.collection("bench");
    assert_eq!(col.len(), 800);

    let _ = fs::remove_dir_all(&tmp_dir);
}
