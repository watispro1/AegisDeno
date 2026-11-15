use std::fs;
use std::sync::Arc;
use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use tower::ServiceExt; // for oneshot
use aegis_db::{api, Config, AegisDatabase};

#[tokio::test]
async fn test_api_health_and_stats() {
    let tmp_dir = std::env::temp_dir().join(format!("aegis_api_test_{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)));
    let _ = fs::remove_dir_all(&tmp_dir);

    let db = AegisDatabase::open(&tmp_dir).expect("failed to open db");
    let config = Arc::new(Config::default());
    let router = api::create_router(db, config);

    let req = Request::builder()
        .uri("/health")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let res = router.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let req_metrics = Request::builder()
        .uri("/metrics")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let res_metrics = router.oneshot(req_metrics).await.unwrap();
    assert_eq!(res_metrics.status(), StatusCode::OK);

    let _ = fs::remove_dir_all(&tmp_dir);
}

#[tokio::test]
async fn test_api_guild_config_and_cases() {
    let tmp_dir = std::env::temp_dir().join(format!("aegis_api_cases_{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)));
    let _ = fs::remove_dir_all(&tmp_dir);

    let db = AegisDatabase::open(&tmp_dir).expect("failed to open db");
    let config = Arc::new(Config::default());
    let router = api::create_router(db, config);

    // 1. Put guild config
    let put_req = Request::builder()
        .uri("/api/guilds/999/config")
        .method("PUT")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&serde_json::json!({
            "prefix": "?",
            "mod_log_channel_id": "112233"
        })).unwrap()))
        .unwrap();

    let put_res = router.clone().oneshot(put_req).await.unwrap();
    assert_eq!(put_res.status(), StatusCode::OK);

    // 2. Get guild config
    let get_req = Request::builder()
        .uri("/api/guilds/999/config")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let get_res = router.clone().oneshot(get_req).await.unwrap();
    assert_eq!(get_res.status(), StatusCode::OK);

    // 3. Create case
    let case_req = Request::builder()
        .uri("/api/guilds/999/cases")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&serde_json::json!({
            "target_id": "user_456",
            "mod_id": "mod_123",
            "action": "warn",
            "reason": "Test warning"
        })).unwrap()))
        .unwrap();

    let case_res = router.clone().oneshot(case_req).await.unwrap();
    assert_eq!(case_res.status(), StatusCode::CREATED);

    // 4. List cases
    let list_req = Request::builder()
        .uri("/api/guilds/999/cases")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let list_res = router.clone().oneshot(list_req).await.unwrap();
    assert_eq!(list_res.status(), StatusCode::OK);

    let _ = fs::remove_dir_all(&tmp_dir);
}

#[tokio::test]
async fn test_api_economy_and_leaderboard() {
    let tmp_dir = std::env::temp_dir().join(format!("aegis_api_eco_{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)));
    let _ = fs::remove_dir_all(&tmp_dir);

    let db = AegisDatabase::open(&tmp_dir).expect("failed to open db");
    let config = Arc::new(Config::default());
    let router = api::create_router(db, config);

    // Deposit funds
    let add_req = Request::builder()
        .uri("/api/guilds/555/economy/player1/transact")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&serde_json::json!({
            "kind": "add_wallet",
            "amount": 1500,
            "description": "Daily reward"
        })).unwrap()))
        .unwrap();

    let add_res = router.clone().oneshot(add_req).await.unwrap();
    assert_eq!(add_res.status(), StatusCode::OK);

    // Leaderboard
    let lb_req = Request::builder()
        .uri("/api/guilds/555/economy/leaderboard")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let lb_res = router.clone().oneshot(lb_req).await.unwrap();
    assert_eq!(lb_res.status(), StatusCode::OK);

    let _ = fs::remove_dir_all(&tmp_dir);
}

#[tokio::test]
async fn test_api_auth_protection() {
    let tmp_dir = std::env::temp_dir().join(format!("aegis_api_auth_{}", chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)));
    let _ = fs::remove_dir_all(&tmp_dir);

    let db = AegisDatabase::open(&tmp_dir).expect("failed to open db");
    let mut config = Config::default();
    config.secret = "super-secret-key".into();
    let router = api::create_router(db, Arc::new(config));

    // Request without auth fails with 401
    let unauth_req = Request::builder()
        .uri("/api/db/stats")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let unauth_res = router.clone().oneshot(unauth_req).await.unwrap();
    assert_eq!(unauth_res.status(), StatusCode::UNAUTHORIZED);

    // Request with valid secret succeeds
    let auth_req = Request::builder()
        .uri("/api/db/stats")
        .method("GET")
        .header("x-aegis-secret", "super-secret-key")
        .body(Body::empty())
        .unwrap();

    let auth_res = router.oneshot(auth_req).await.unwrap();
    assert_eq!(auth_res.status(), StatusCode::OK);

    let _ = fs::remove_dir_all(&tmp_dir);
}
