use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Arc;

use aegis_db::engine::db::{LOCK_FILE, WAL_FILE};
use aegis_db::engine::wal::{encode_record, WalEntry, WalOp, WalReader};
use aegis_db::{api, AegisDatabase, Config};
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
};
use serde_json::{json, Value};
use tower::ServiceExt;

fn tmp(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "aegis_hard_{}_{}_{}",
        name,
        std::process::id(),
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
    ));
    let _ = fs::remove_dir_all(&dir);
    dir
}

fn put_entry(key: &str, v: i64) -> WalEntry {
    WalEntry {
        op: WalOp::Put,
        timestamp: 1,
        collection: "economy".into(),
        key: key.into(),
        value: serde_json::to_vec(&json!({ "wallet": v })).unwrap(),
    }
}

fn write_good_records(dir: &PathBuf, n: usize) -> u64 {
    fs::create_dir_all(dir).unwrap();
    let mut f = OpenOptions::new().create(true).append(true).open(dir.join(WAL_FILE)).unwrap();
    for i in 0..n {
        f.write_all(&encode_record(&put_entry(&format!("k{}", i), i as i64)).unwrap()).unwrap();
    }
    f.sync_all().unwrap();
    fs::metadata(dir.join(WAL_FILE)).unwrap().len()
}

fn assert_recovers_and_truncates(dir: &PathBuf, good_len: u64, n: usize) {
    {
        let db = AegisDatabase::open(dir).expect("open must survive a damaged WAL tail");
        assert_eq!(db.collection("economy").len(), n);
        // The tail was cut back to the last intact record.
        assert_eq!(fs::metadata(dir.join(WAL_FILE)).unwrap().len(), good_len);
        db.put("economy", "after".into(), json!({ "wallet": 7 })).unwrap();
    }
    let db = AegisDatabase::open(dir).unwrap();
    assert_eq!(db.collection("economy").len(), n + 1);
    assert_eq!(db.get("economy", "after").unwrap()["wallet"], 7);
}

#[test]
fn torn_tail_short_payload_is_truncated() {
    let dir = tmp("torn");
    let good = write_good_records(&dir, 3);
    let partial = encode_record(&put_entry("torn", 99)).unwrap();
    let mut f = OpenOptions::new().append(true).open(dir.join(WAL_FILE)).unwrap();
    f.write_all(&partial[..partial.len() - 5]).unwrap();
    drop(f);
    assert_recovers_and_truncates(&dir, good, 3);
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn torn_header_is_truncated() {
    let dir = tmp("torn_header");
    let good = write_good_records(&dir, 2);
    let mut f = OpenOptions::new().append(true).open(dir.join(WAL_FILE)).unwrap();
    f.write_all(&[0x10, 0x00, 0x00]).unwrap();
    drop(f);
    assert_recovers_and_truncates(&dir, good, 2);
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn oversized_length_prefix_stops_replay() {
    let dir = tmp("oversized");
    let good = write_good_records(&dir, 2);
    let mut f = OpenOptions::new().append(true).open(dir.join(WAL_FILE)).unwrap();
    f.write_all(&u32::MAX.to_le_bytes()).unwrap();
    f.write_all(&[0u8; 32]).unwrap();
    drop(f);
    assert_recovers_and_truncates(&dir, good, 2);
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn bad_op_with_valid_checksum_stops_replay() {
    let dir = tmp("bad_op");
    let good = write_good_records(&dir, 2);
    let mut rec = encode_record(&put_entry("bad", 1)).unwrap();
    rec[8] = 0x7f; // op byte
    let mut h = crc32fast::Hasher::new();
    h.update(&rec[8..]);
    rec[4..8].copy_from_slice(&h.finalize().to_le_bytes());
    let mut f = OpenOptions::new().append(true).open(dir.join(WAL_FILE)).unwrap();
    f.write_all(&rec).unwrap();
    f.write_all(&encode_record(&put_entry("after_bad", 1)).unwrap()).unwrap();
    drop(f);
    let outcome = WalReader::read(dir.join(WAL_FILE)).unwrap();
    assert_eq!(outcome.entries.len(), 2);
    assert_eq!(outcome.valid_len, good);
    assert_recovers_and_truncates(&dir, good, 2);
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn compaction_racing_writes_loses_nothing() {
    let dir = tmp("compact_race");
    {
        let db = AegisDatabase::open(&dir).unwrap();
        let mut handles = Vec::new();
        for t in 0..4 {
            let db = db.clone();
            handles.push(std::thread::spawn(move || {
                for i in 0..150 {
                    db.put("bench", format!("t{}:{}", t, i), json!({ "i": i })).unwrap();
                }
            }));
        }
        let compactor = {
            let db = db.clone();
            std::thread::spawn(move || {
                for _ in 0..20 {
                    db.compact().unwrap();
                }
            })
        };
        for h in handles {
            h.join().unwrap();
        }
        compactor.join().unwrap();
        assert_eq!(db.collection("bench").len(), 600);
    }
    let db = AegisDatabase::open(&dir).unwrap();
    assert_eq!(db.collection("bench").len(), 600, "every acknowledged write survives restart");
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn data_dir_lock_blocks_second_open() {
    let dir = tmp("lock");
    let db = AegisDatabase::open(&dir).unwrap();
    assert!(dir.join(LOCK_FILE).exists());
    let second = AegisDatabase::open(&dir);
    assert!(second.is_err(), "a second open of a locked data dir must fail");
    drop(db);
    assert!(AegisDatabase::open(&dir).is_ok(), "lock is released on drop");
    let _ = fs::remove_dir_all(&dir);
}

async fn call(router: &axum::Router, method: &str, uri: &str, body: Option<Value>, secret: Option<&str>) -> (StatusCode, Value) {
    let mut b = Request::builder().uri(uri).method(method).header("content-type", "application/json");
    if let Some(s) = secret {
        b = b.header("x-aegis-secret", s);
    }
    let req = b.body(body.map(|v| Body::from(v.to_string())).unwrap_or_else(Body::empty)).unwrap();
    let res = router.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let bytes = to_bytes(res.into_body(), 1 << 20).await.unwrap();
    (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}

fn router_with_secret(dir: &PathBuf, secret: &str) -> axum::Router {
    let db = AegisDatabase::open(dir).unwrap();
    let mut config = Config::default();
    config.secret = secret.into();
    api::create_router(db, Arc::new(config))
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn concurrent_case_creation_gets_unique_ids() {
    let dir = tmp("cases_race");
    let router = router_with_secret(&dir, "s3cret");
    let mut tasks = Vec::new();
    for i in 0..40 {
        let r = router.clone();
        tasks.push(tokio::spawn(async move {
            let body = json!({ "target_id": "1", "mod_id": "2", "action": "warn", "reason": format!("r{}", i) });
            call(&r, "POST", "/api/guilds/77/cases", Some(body), Some("s3cret")).await
        }));
    }
    let mut ids = Vec::new();
    for t in tasks {
        let (status, body) = t.await.unwrap();
        assert_eq!(status, StatusCode::CREATED);
        ids.push(body["case_id"].as_u64().unwrap());
    }
    ids.sort();
    assert_eq!(ids, (1..=40).collect::<Vec<u64>>());
    let _ = fs::remove_dir_all(&dir);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn concurrent_transactions_do_not_lose_updates() {
    let dir = tmp("eco_race");
    let router = router_with_secret(&dir, "s3cret");
    let mut tasks = Vec::new();
    for _ in 0..50 {
        let r = router.clone();
        tasks.push(tokio::spawn(async move {
            call(&r, "POST", "/api/guilds/77/economy/9/transact", Some(json!({ "kind": "add_wallet", "amount": 10 })), Some("s3cret")).await
        }));
    }
    for t in tasks {
        assert_eq!(t.await.unwrap().0, StatusCode::OK);
    }
    let (_, acct) = call(&router, "GET", "/api/guilds/77/economy/9", None, Some("s3cret")).await;
    assert_eq!(acct["wallet"], 500);
    let _ = fs::remove_dir_all(&dir);
}

#[tokio::test]
async fn case_ref_is_idempotent_and_patchable() {
    let dir = tmp("case_ref");
    let router = router_with_secret(&dir, "s3cret");
    let body = json!({ "case_ref": "65f0c0ffee0000000000abcd", "target_id": "1", "mod_id": "2", "action": "ban", "reason": "x" });
    let (s1, c1) = call(&router, "POST", "/api/guilds/5/cases", Some(body.clone()), Some("s3cret")).await;
    assert_eq!(s1, StatusCode::CREATED);
    let (s2, c2) = call(&router, "POST", "/api/guilds/5/cases", Some(body), Some("s3cret")).await;
    assert_eq!(s2, StatusCode::OK, "retry with the same ref returns the existing case");
    assert_eq!(c1["case_id"], c2["case_id"]);

    let (sp, patched) = call(&router, "PATCH", "/api/guilds/5/cases/65f0c0ffee0000000000abcd", Some(json!({ "revoked": true, "revoked_by": "3" })), Some("s3cret")).await;
    assert_eq!(sp, StatusCode::OK);
    assert_eq!(patched["revoked"], true);
    let (sg, by_num) = call(&router, "GET", "/api/guilds/5/cases/1", None, Some("s3cret")).await;
    assert_eq!(sg, StatusCode::OK);
    assert_eq!(by_num["revoked"], true);
    let _ = fs::remove_dir_all(&dir);
}

#[tokio::test]
async fn metrics_is_redacted_without_secret() {
    let dir = tmp("metrics");
    let router = router_with_secret(&dir, "s3cret");
    let (s, public) = call(&router, "GET", "/metrics", None, None).await;
    assert_eq!(s, StatusCode::OK);
    assert_eq!(public, json!({ "healthy": true }));
    let (_, wrong) = call(&router, "GET", "/metrics", None, Some("nope")).await;
    assert_eq!(wrong, json!({ "healthy": true }));
    let (_, full) = call(&router, "GET", "/metrics", None, Some("s3cret")).await;
    assert!(full.get("total_documents").is_some());
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn startup_requires_secret_outside_dev() {
    let config = Config::default();
    assert!(config.validate(false).is_err());
    assert!(config.validate(true).is_ok());
    let mut with_secret = Config::default();
    with_secret.secret = "x".into();
    assert!(with_secret.validate(false).is_ok());
}

#[test]
fn constant_time_compare() {
    use aegis_db::api::middleware::secret_matches;
    assert!(secret_matches(b"abc", b"abc"));
    assert!(!secret_matches(b"abd", b"abc"));
    assert!(!secret_matches(b"ab", b"abc"));
    assert!(!secret_matches(b"abcd", b"abc"));
    assert!(!secret_matches(b"", b""));
}
