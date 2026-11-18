use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

use aegis_db::api::routes_snapshot::SNAPSHOT_TIMESTAMP_HEADER;
use aegis_db::engine::db::SNAPSHOT_FILE;
use aegis_db::engine::snapshot::{decode, ZSTD_MAGIC};
use aegis_db::{api, AegisDatabase, Config, DbOptions};
use axum::{
    body::{to_bytes, Body},
    http::{header, Request, StatusCode},
    response::Response,
    Router,
};
use serde_json::json;
use tower::ServiceExt;

const SECRET: &str = "export-secret";
const EXPORT: &str = "/api/db/snapshot/export";

fn tmp(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "aegis_export_{}_{}_{}",
        name,
        std::process::id(),
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
    ));
    let _ = fs::remove_dir_all(&dir);
    dir
}

fn setup(name: &str, zstd: bool) -> (PathBuf, Arc<AegisDatabase>, Router) {
    let dir = tmp(name);
    let opts = DbOptions {
        snapshot_zstd: zstd,
        ..DbOptions::default()
    };
    let db = AegisDatabase::open_with_options(&dir, opts).unwrap();
    let config = Config {
        secret: SECRET.into(),
        ..Default::default()
    };
    let router = api::create_router(db.clone(), Arc::new(config));
    (dir, db, router)
}

async fn get(router: &Router, uri: &str, auth: Option<(&str, &str)>) -> Response {
    let mut req = Request::builder().uri(uri).method("GET");
    if let Some((name, value)) = auth {
        req = req.header(name, value);
    }
    router
        .clone()
        .oneshot(req.body(Body::empty()).unwrap())
        .await
        .unwrap()
}

async fn body(res: Response) -> Vec<u8> {
    to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap()
        .to_vec()
}

#[tokio::test]
async fn export_requires_the_admin_secret() {
    let (dir, _db, router) = setup("auth", true);
    let res = get(&router, EXPORT, None).await;
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
    let res = get(&router, EXPORT, Some(("x-aegis-secret", "wrong"))).await;
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
    let res = get(&router, EXPORT, Some(("authorization", "Bearer nope"))).await;
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
    let res = get(&router, EXPORT, Some(("x-aegis-secret", SECRET))).await;
    assert_eq!(res.status(), StatusCode::OK);
    let bearer = format!("Bearer {SECRET}");
    let res = get(&router, EXPORT, Some(("authorization", &bearer))).await;
    assert_eq!(res.status(), StatusCode::OK);
    let _ = fs::remove_dir_all(&dir);
}

#[tokio::test]
async fn export_defaults_to_zstd_and_contains_uncompacted_writes() {
    let (dir, db, router) = setup("zstd", true);
    db.put("guild_configs", "g1".into(), json!({ "prefix": "!" }))
        .unwrap();
    db.compact().unwrap();
    // Written after the last compaction: only in the WAL and in memory.
    db.put("cases", "g1:1".into(), json!({ "reason": "spam" }))
        .unwrap();
    let wal_before = db.wal_bytes();
    let snapshot_before = fs::read(dir.join(SNAPSHOT_FILE)).unwrap();

    let res = get(&router, EXPORT, Some(("x-aegis-secret", SECRET))).await;
    assert_eq!(res.status(), StatusCode::OK);
    let headers = res.headers().clone();
    assert_eq!(headers[header::CONTENT_TYPE], "application/zstd");
    let disposition = headers[header::CONTENT_DISPOSITION].to_str().unwrap();
    assert!(disposition.starts_with("attachment; filename=\"aegis-db-snapshot-"));
    assert!(disposition.ends_with(".json.zst\""));
    let ts: i64 = headers[SNAPSHOT_TIMESTAMP_HEADER]
        .to_str()
        .unwrap()
        .parse()
        .unwrap();

    let bytes = body(res).await;
    assert!(bytes.starts_with(&ZSTD_MAGIC));
    let snap = decode(&bytes).unwrap();
    assert_eq!(snap.timestamp, ts);
    assert_eq!(
        snap.collections["guild_configs"]["g1"],
        json!({ "prefix": "!" })
    );
    assert_eq!(
        snap.collections["cases"]["g1:1"],
        json!({ "reason": "spam" })
    );

    // Exporting is read-only: no compaction, snapshot file untouched.
    assert_eq!(db.wal_bytes(), wal_before);
    assert_eq!(fs::read(dir.join(SNAPSHOT_FILE)).unwrap(), snapshot_before);
    drop(db);
    let _ = fs::remove_dir_all(&dir);
}

#[tokio::test]
async fn export_format_can_be_chosen() {
    let (dir, db, router) = setup("format", true);
    db.put("economy", "g:u".into(), json!({ "balance": 5 }))
        .unwrap();
    let auth = Some(("x-aegis-secret", SECRET));

    let res = get(&router, &format!("{EXPORT}?format=json"), auth).await;
    assert_eq!(res.status(), StatusCode::OK);
    assert_eq!(res.headers()[header::CONTENT_TYPE], "application/json");
    let bytes = body(res).await;
    assert_eq!(bytes[0], b'{');
    let value: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(value["collections"]["economy"]["g:u"]["balance"], 5);

    let res = get(&router, &format!("{EXPORT}?format=zstd"), auth).await;
    assert_eq!(res.status(), StatusCode::OK);
    assert!(body(res).await.starts_with(&ZSTD_MAGIC));

    let res = get(&router, &format!("{EXPORT}?format=xml"), auth).await;
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    drop(db);
    let _ = fs::remove_dir_all(&dir);
}

#[tokio::test]
async fn export_follows_configured_json_format() {
    let (dir, db, router) = setup("json_default", false);
    let res = get(&router, EXPORT, Some(("x-aegis-secret", SECRET))).await;
    assert_eq!(res.status(), StatusCode::OK);
    assert_eq!(res.headers()[header::CONTENT_TYPE], "application/json");
    let snap = decode(&body(res).await).unwrap();
    assert!(snap.collections.contains_key("guild_configs"));
    drop(db);
    let _ = fs::remove_dir_all(&dir);
}

#[tokio::test]
async fn there_is_no_import_route() {
    let (dir, db, router) = setup("no_import", true);
    for (method, uri) in [
        ("POST", EXPORT),
        ("PUT", EXPORT),
        ("POST", "/api/db/snapshot/import"),
    ] {
        let req = Request::builder()
            .uri(uri)
            .method(method)
            .header("x-aegis-secret", SECRET)
            .body(Body::from("{}"))
            .unwrap();
        let res = router.clone().oneshot(req).await.unwrap();
        assert!(
            matches!(
                res.status(),
                StatusCode::NOT_FOUND | StatusCode::METHOD_NOT_ALLOWED
            ),
            "{method} {uri} -> {}",
            res.status()
        );
    }
    drop(db);
    let _ = fs::remove_dir_all(&dir);
}
