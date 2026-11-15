use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde_json::json;
use std::sync::Arc;
use std::time::Instant;

use crate::engine::AegisDatabase;

pub struct AppState {
    pub db: Arc<AegisDatabase>,
    pub start_time: Instant,
    pub version: &'static str,
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

pub async fn compact_handler(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.db.compact() {
        Ok(_) => (
            StatusCode::OK,
            Json(json!({
                "status": "success",
                "message": "Snapshot written and WAL compacted successfully"
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
