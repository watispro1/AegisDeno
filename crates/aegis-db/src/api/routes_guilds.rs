use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::{json, Value};
use std::sync::Arc;

use super::routes_health::AppState;

pub async fn get_guild_config(
    State(state): State<Arc<AppState>>,
    Path(guild_id): Path<String>,
) -> impl IntoResponse {
    let key = format!("guild:{}", guild_id);
    if let Some(doc) = state.db.get("guild_configs", &key) {
        (StatusCode::OK, Json(doc)).into_response()
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Not Found", "guild_id": guild_id })),
        )
            .into_response()
    }
}

pub async fn put_guild_config(
    State(state): State<Arc<AppState>>,
    Path(guild_id): Path<String>,
    Json(mut payload): Json<Value>,
) -> impl IntoResponse {
    let key = format!("guild:{}", guild_id);
    if let Some(obj) = payload.as_object_mut() {
        obj.insert("guild_id".to_string(), json!(guild_id));
        obj.insert("updated_at".to_string(), json!(chrono::Utc::now().timestamp_millis()));
    }

    match state.db.put("guild_configs", key, payload.clone()) {
        Ok(_) => (StatusCode::OK, Json(payload)).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

pub async fn delete_guild_config(
    State(state): State<Arc<AppState>>,
    Path(guild_id): Path<String>,
) -> impl IntoResponse {
    let key = format!("guild:{}", guild_id);
    match state.db.delete("guild_configs", &key) {
        Ok(deleted) => (
            StatusCode::OK,
            Json(json!({ "deleted": deleted, "guild_id": guild_id })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}
