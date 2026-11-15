use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use super::routes_health::AppState;
use crate::models::{CaseRecord, WarningRecord};

#[derive(Debug, Deserialize)]
pub struct CaseListQuery {
    pub user_id: Option<String>,
    pub action: Option<String>,
    pub limit: Option<usize>,
    pub skip: Option<usize>,
}

pub async fn list_cases(
    State(state): State<Arc<AppState>>,
    Path(guild_id): Path<String>,
    Query(query): Query<CaseListQuery>,
) -> impl IntoResponse {
    let col = state.db.collection("cases");
    let prefix = format!("case:{}:", guild_id);
    let all = col.prefix_scan(&prefix);

    let mut cases: Vec<CaseRecord> = all
        .into_iter()
        .filter_map(|(_, val)| serde_json::from_value::<CaseRecord>(val).ok())
        .filter(|c| {
            if let Some(ref uid) = query.user_id {
                if &c.target_id != uid {
                    return false;
                }
            }
            if let Some(ref act) = query.action {
                if !c.action.eq_ignore_ascii_case(act) {
                    return false;
                }
            }
            true
        })
        .collect();

    // Sort descending by case_id
    cases.sort_by(|a, b| b.case_id.cmp(&a.case_id));

    let total = cases.len();
    let skip = query.skip.unwrap_or(0);
    let limit = query.limit.unwrap_or(50).clamp(1, 200);

    let paginated: Vec<CaseRecord> = cases.into_iter().skip(skip).take(limit).collect();

    Json(json!({
        "guild_id": guild_id,
        "total": total,
        "skip": skip,
        "limit": limit,
        "cases": paginated
    }))
}

#[derive(Debug, Deserialize)]
pub struct CreateCasePayload {
    pub target_id: String,
    pub target_tag: Option<String>,
    pub mod_id: String,
    pub mod_tag: Option<String>,
    pub action: String,
    pub reason: String,
    pub duration_ms: Option<u64>,
}

pub async fn create_case(
    State(state): State<Arc<AppState>>,
    Path(guild_id): Path<String>,
    Json(payload): Json<CreateCasePayload>,
) -> impl IntoResponse {
    let col = state.db.collection("cases");
    let prefix = format!("case:{}:", guild_id);
    let existing = col.prefix_scan(&prefix);

    let max_id = existing
        .iter()
        .filter_map(|(_, val)| serde_json::from_value::<CaseRecord>(val.clone()).ok())
        .map(|c| c.case_id)
        .max()
        .unwrap_or(0);

    let next_id = max_id + 1;
    let key = format!("case:{}:{}", guild_id, next_id);

    let record = CaseRecord {
        case_id: next_id,
        guild_id: guild_id.clone(),
        target_id: payload.target_id,
        target_tag: payload.target_tag,
        mod_id: payload.mod_id,
        mod_tag: payload.mod_tag,
        action: payload.action,
        reason: payload.reason,
        created_at: chrono::Utc::now().timestamp_millis(),
        duration_ms: payload.duration_ms,
        revoked: false,
        revoked_by: None,
        revoked_reason: None,
    };

    let val = match serde_json::to_value(&record) {
        Ok(v) => v,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    };

    if let Err(e) = state.db.put("cases", key, val) {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response();
    }

    (StatusCode::CREATED, Json(json!(record))).into_response()
}

pub async fn get_case(
    State(state): State<Arc<AppState>>,
    Path((guild_id, case_id)): Path<(String, u64)>,
) -> impl IntoResponse {
    let key = format!("case:{}:{}", guild_id, case_id);
    if let Some(val) = state.db.get("cases", &key) {
        (StatusCode::OK, Json(val)).into_response()
    } else {
        (StatusCode::NOT_FOUND, Json(json!({ "error": "Case not found" }))).into_response()
    }
}

#[derive(Debug, Deserialize)]
pub struct PatchCasePayload {
    pub reason: Option<String>,
    pub revoked: Option<bool>,
    pub revoked_by: Option<String>,
    pub revoked_reason: Option<String>,
}

pub async fn patch_case(
    State(state): State<Arc<AppState>>,
    Path((guild_id, case_id)): Path<(String, u64)>,
    Json(payload): Json<PatchCasePayload>,
) -> impl IntoResponse {
    let key = format!("case:{}:{}", guild_id, case_id);
    let existing_val = match state.db.get("cases", &key) {
        Some(v) => v,
        None => return (StatusCode::NOT_FOUND, Json(json!({ "error": "Case not found" }))).into_response(),
    };

    let mut record: CaseRecord = match serde_json::from_value(existing_val) {
        Ok(r) => r,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    };

    if let Some(r) = payload.reason {
        record.reason = r;
    }
    if let Some(rev) = payload.revoked {
        record.revoked = rev;
        record.revoked_by = payload.revoked_by;
        record.revoked_reason = payload.revoked_reason;
    }

    let updated_val = match serde_json::to_value(&record) {
        Ok(v) => v,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    };

    if let Err(e) = state.db.put("cases", key, updated_val) {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response();
    }

    (StatusCode::OK, Json(json!(record))).into_response()
}

// Warnings handlers
pub async fn list_warnings(
    State(state): State<Arc<AppState>>,
    Path((guild_id, user_id)): Path<(String, String)>,
) -> impl IntoResponse {
    let col = state.db.collection("warnings");
    let prefix = format!("warn:{}:{}:", guild_id, user_id);
    let all = col.prefix_scan(&prefix);

    let warnings: Vec<WarningRecord> = all
        .into_iter()
        .filter_map(|(_, val)| serde_json::from_value::<WarningRecord>(val).ok())
        .collect();

    Json(json!({
        "guild_id": guild_id,
        "user_id": user_id,
        "count": warnings.len(),
        "warnings": warnings
    }))
}

#[derive(Debug, Deserialize)]
pub struct CreateWarningPayload {
    pub user_id: String,
    pub mod_id: String,
    pub reason: String,
    pub severity: Option<String>,
}

pub async fn create_warning(
    State(state): State<Arc<AppState>>,
    Path(guild_id): Path<String>,
    Json(payload): Json<CreateWarningPayload>,
) -> impl IntoResponse {
    let warn_id = format!("w_{}", chrono::Utc::now().timestamp_micros());
    let key = format!("warn:{}:{}:{}", guild_id, payload.user_id, warn_id);

    let record = WarningRecord {
        warn_id,
        guild_id,
        user_id: payload.user_id,
        mod_id: payload.mod_id,
        reason: payload.reason,
        severity: payload.severity.unwrap_or_else(|| "standard".to_string()),
        created_at: chrono::Utc::now().timestamp_millis(),
        active: true,
    };

    let val = match serde_json::to_value(&record) {
        Ok(v) => v,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response(),
    };

    if let Err(e) = state.db.put("warnings", key, val) {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "error": e.to_string() }))).into_response();
    }

    (StatusCode::CREATED, Json(json!(record))).into_response()
}

pub async fn clear_warnings(
    State(state): State<Arc<AppState>>,
    Path((guild_id, user_id)): Path<(String, String)>,
) -> impl IntoResponse {
    let col = state.db.collection("warnings");
    let prefix = format!("warn:{}:{}:", guild_id, user_id);
    let keys: Vec<String> = col.prefix_scan(&prefix).into_iter().map(|(k, _)| k).collect();

    let count = keys.len();
    for k in keys {
        let _ = state.db.delete("warnings", &k);
    }

    Json(json!({
        "cleared": count,
        "guild_id": guild_id,
        "user_id": user_id
    }))
}
