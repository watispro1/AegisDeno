use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde_json::json;
use std::sync::Arc;
use std::time::Instant;

use crate::engine::{AegisDatabase, CompactTrigger};

pub struct AppState {
    pub db: Arc<AegisDatabase>,
    pub start_time: Instant,
    pub version: &'static str,
    /// Admin secret, used by the public `/metrics` route to decide how much to show.
    pub secret: String,
}

pub async fn health_handler(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let uptime = state.start_time.elapsed().as_secs();
    Json(json!({
        "status": "ok",
        "service": "aegis-db",
        "version": state.version,
        "uptime_seconds": uptime
    }))
}

pub async fn stats_handler(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let stats = state.db.stats();
    Json(stats)
}

pub async fn metrics_handler(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if super::middleware::is_authorized(&headers, &state.secret) {
        Json(state.db.stats())
    } else {
        Json(json!({ "healthy": true }))
    }
}

pub async fn compact_handler(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    // compact() may wait on compact_lock behind a background compaction and
    // then does blocking file I/O: run it on the blocking pool.
    let db = state.db.clone();
    let result = tokio::task::spawn_blocking(move || db.compact_with(CompactTrigger::Manual))
        .await
        .unwrap_or_else(|e| Err(std::io::Error::other(e)));
    match result {
        Ok(()) => (
            StatusCode::OK,
            Json(json!({
                "status": "success",
                "message": "Snapshot written and WAL compacted successfully",
                "compaction": state.db.last_compaction()
            })),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({
                "status": "error",
                "message": e.to_string()
            })),
        ),
    }
}
