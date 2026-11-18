use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use aegis_db::engine::compactor;
use aegis_db::engine::db::{SNAPSHOT_FILE, WAL_FILE};
use aegis_db::engine::CompactTrigger;
use aegis_db::{api, AegisDatabase, Config, DbOptions};
use axum::{
    body::{to_bytes, Body},
    http::{Request, StatusCode},
    Router,
};
use serde_json::{json, Value};
use tower::ServiceExt;

const SECRET: &str = "stats-secret";

fn tmp(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "aegis_stats_{}_{}_{}",
        name,
        std::process::id(),
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
    ));
    let _ = fs::remove_dir_all(&dir);
    dir
}

fn router(db: Arc<AegisDatabase>) -> Router {
    let config = Config {
        secret: SECRET.into(),
        ..Default::default()
    };
    api::create_router(db, Arc::new(config))
}

async fn call(router: &Router, method: &str, uri: &str) -> (StatusCode, Value) {
    let req = Request::builder()
        .uri(uri)
        .method(method)
        .header("x-aegis-secret", SECRET)
        .body(Body::empty())
        .unwrap();
    let res = router.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let bytes = to_bytes(res.into_body(), usize::MAX).await.unwrap();
    (status, serde_json::from_slice(&bytes).unwrap())
}

fn file_len(dir: &std::path::Path, name: &str) -> u64 {
    fs::metadata(dir.join(name)).map(|m| m.len()).unwrap_or(0)
}

#[tokio::test]
async fn stats_report_sizes_and_the_last_manual_compaction() {
    let dir = tmp("manual");
    let db = AegisDatabase::open(&dir).unwrap();
    let app = router(db.clone());

    let (status, stats) = call(&app, "GET", "/api/db/stats").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(stats["wal_bytes"], 0);
    assert_eq!(stats["snapshot_bytes"], 0);
    assert_eq!(stats["snapshot_format"], "zstd");
    assert_eq!(stats["compact_wal_bytes"], 64 * 1024 * 1024);
    assert!(stats["last_compaction"].is_null(), "no compaction yet");

    for i in 0..20 {
        db.put("m", format!("k{i}"), json!({ "i": i })).unwrap();
    }
    let (_, stats) = call(&app, "GET", "/api/db/stats").await;
    assert_eq!(stats["wal_bytes"], file_len(&dir, WAL_FILE));
    assert!(stats["wal_bytes"].as_u64().unwrap() > 0);
    assert_eq!(stats["wal_pending_entries"], 20);

    let before = chrono::Utc::now().timestamp_millis();
    let (status, body) = call(&app, "POST", "/api/db/compact").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["compaction"]["trigger"], "manual");

    let (_, stats) = call(&app, "GET", "/api/db/stats").await;
    assert_eq!(stats["wal_bytes"], 0);
    let snap = file_len(&dir, SNAPSHOT_FILE);
    assert!(snap > 0);
    assert_eq!(stats["snapshot_bytes"], snap);
    let last = &stats["last_compaction"];
    assert_eq!(last["trigger"], "manual");
    assert_eq!(last["snapshot_bytes"], snap);
    assert!(last["duration_ms"].is_u64());
    let ts = last["timestamp_ms"].as_i64().unwrap();
    assert!(ts >= before && ts <= chrono::Utc::now().timestamp_millis());
    let parsed =
        chrono::DateTime::parse_from_rfc3339(last["finished_at"].as_str().unwrap()).unwrap();
    assert_eq!(parsed.timestamp_millis(), ts);

    // Authorized /metrics carries the same fields.
    let (_, metrics) = call(&app, "GET", "/metrics").await;
    assert_eq!(metrics["last_compaction"]["trigger"], "manual");
    assert_eq!(metrics["snapshot_bytes"], snap);
    drop(app);
    drop(db);
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn last_compaction_records_the_trigger() {
    let dir = tmp("trigger");
    let db = AegisDatabase::open(&dir).unwrap();
    assert!(db.last_compaction().is_none());
    db.compact_with(CompactTrigger::Timer).unwrap();
    assert_eq!(db.last_compaction().unwrap().trigger, CompactTrigger::Timer);
    db.compact().unwrap();
    assert_eq!(
        db.last_compaction().unwrap().trigger,
        CompactTrigger::Manual
    );
    assert_eq!(db.stats()["last_compaction"]["trigger"], "manual");
    drop(db);
    let _ = fs::remove_dir_all(&dir);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn size_triggered_compaction_is_reported_as_wal_size() {
    let dir = tmp("wal_size");
    let opts = DbOptions {
        compact_wal_bytes: 2048,
        ..DbOptions::default()
    };
    let db = AegisDatabase::open_with_options(&dir, opts).unwrap();
    let task = compactor::spawn(db.clone(), None).unwrap();
    let mut i = 0;
    while file_len(&dir, WAL_FILE) < 2048 {
        db.put("s", format!("k{i}"), json!({ "pad": "p".repeat(128) }))
            .unwrap();
        i += 1;
    }
    let deadline = tokio::time::Instant::now() + Duration::from_secs(10);
    while db.last_compaction().is_none() {
        assert!(tokio::time::Instant::now() < deadline, "never compacted");
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    task.abort();
    let _ = task.await;
    let stats = db.stats();
    assert_eq!(stats["last_compaction"]["trigger"], "wal_size");
    assert_eq!(stats["compact_wal_bytes"], 2048);
    drop(db);
    let _ = fs::remove_dir_all(&dir);
}
