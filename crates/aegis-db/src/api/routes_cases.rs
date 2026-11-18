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
    cases.sort_by_key(|c| std::cmp::Reverse(c.case_id));

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
    /// The caller's id for the case (the bot sends the MongoDB `_id`).
    pub case_ref: Option<String>,
    pub target_id: String,
    pub target_tag: Option<String>,
    pub mod_id: String,
    pub mod_tag: Option<String>,
    pub action: String,
    pub reason: String,
    pub duration_ms: Option<u64>,
}

fn case_records(state: &AppState, guild_id: &str) -> Vec<(String, CaseRecord)> {
    state
        .db
        .collection("cases")
        .prefix_scan(&format!("case:{}:", guild_id))
        .into_iter()
        .filter_map(|(k, val)| {
            serde_json::from_value::<CaseRecord>(val)
                .ok()
                .map(|c| (k, c))
        })
        .collect()
}

/// Resolves a case path segment: a numeric AegisDB case id, or the bot's own
/// case reference (MongoDB `_id`) recorded at creation.
fn resolve_case(state: &AppState, guild_id: &str, case_id: &str) -> Option<(String, CaseRecord)> {
    if let Ok(n) = case_id.parse::<u64>() {
        let key = format!("case:{}:{}", guild_id, n);
        let val = state.db.get("cases", &key)?;
        return serde_json::from_value::<CaseRecord>(val)
            .ok()
            .map(|c| (key, c));
    }
    case_records(state, guild_id)
        .into_iter()
        .find(|(_, c)| c.case_ref.as_deref() == Some(case_id))
}

pub async fn create_case(
    State(state): State<Arc<AppState>>,
    Path(guild_id): Path<String>,
    Json(payload): Json<CreateCasePayload>,
) -> impl IntoResponse {
    // Allocating the next id is read-modify-write: serialize it per guild.
    let _guard = state.db.scope_lock(&format!("cases:{}", guild_id));
    let existing = case_records(&state, &guild_id);

    // Idempotent on the caller's reference, so a retried dual-write never
    // creates the same case twice.
    if let Some(r) = payload.case_ref.as_deref() {
        if let Some((_, found)) = existing
            .iter()
            .find(|(_, c)| c.case_ref.as_deref() == Some(r))
        {
            return (StatusCode::OK, Json(json!(found))).into_response();
        }
    }

    let max_id = existing.iter().map(|(_, c)| c.case_id).max().unwrap_or(0);
    let next_id = max_id + 1;
    let key = format!("case:{}:{}", guild_id, next_id);

    let record = CaseRecord {
        case_id: next_id,
        case_ref: payload.case_ref,
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
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    };

    if let Err(e) = state.db.put("cases", key, val) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response();
    }

    (StatusCode::CREATED, Json(json!(record))).into_response()
}

pub async fn get_case(
    State(state): State<Arc<AppState>>,
    Path((guild_id, case_id)): Path<(String, String)>,
) -> impl IntoResponse {
    if let Some((_, record)) = resolve_case(&state, &guild_id, &case_id) {
        (StatusCode::OK, Json(json!(record))).into_response()
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "Case not found" })),
        )
            .into_response()
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
    Path((guild_id, case_id)): Path<(String, String)>,
    Json(payload): Json<PatchCasePayload>,
) -> impl IntoResponse {
    let _guard = state.db.scope_lock(&format!("cases:{}", guild_id));
    let (key, mut record) = match resolve_case(&state, &guild_id, &case_id) {
        Some(found) => found,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "Case not found" })),
            )
                .into_response()
        }
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
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    };

    if let Err(e) = state.db.put("cases", key, updated_val) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response();
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
    /// Caller's stable id for the warning; makes a retried create overwrite
    /// the same record instead of adding a duplicate.
    pub warn_ref: Option<String>,
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
    let warn_id = match payload.warn_ref.as_deref() {
        Some(r)
            if !r.is_empty()
                && r.len() <= 64
                && r.bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-') =>
        {
            r.to_string()
        }
        Some(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "warn_ref is invalid" })),
            )
                .into_response()
        }
        None => format!("w_{}", chrono::Utc::now().timestamp_micros()),
    };
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
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    };

    if let Err(e) = state.db.put("warnings", key, val) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response();
    }

    (StatusCode::CREATED, Json(json!(record))).into_response()
}

pub async fn clear_warnings(
    State(state): State<Arc<AppState>>,
    Path((guild_id, user_id)): Path<(String, String)>,
) -> impl IntoResponse {
    let _guard = state
        .db
        .scope_lock(&format!("warn:{}:{}", guild_id, user_id));
    let col = state.db.collection("warnings");
    let prefix = format!("warn:{}:{}:", guild_id, user_id);
    let keys: Vec<String> = col
        .prefix_scan(&prefix)
        .into_iter()
        .map(|(k, _)| k)
        .collect();

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
