//! `GET /api/db/snapshot/export`: download a consistent copy of the whole
//! database for backups. Mounted under the authenticated `/api` router.
//! There is deliberately no import route.

use axum::{
    extract::{Query, State},
    http::{header, HeaderName, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use super::routes_health::AppState;
use crate::engine::snapshot::SnapshotFormat;

/// Header carrying the export's point-in-time timestamp (Unix ms).
pub const SNAPSHOT_TIMESTAMP_HEADER: &str = "x-aegis-snapshot-timestamp";

#[derive(Debug, Default, Deserialize)]
pub struct ExportQuery {
    /// `json` or `zstd`; defaults to the configured snapshot format.
    pub format: Option<String>,
}

fn error(status: StatusCode, message: String) -> Response {
    (
        status,
        Json(json!({ "status": "error", "message": message })),
    )
        .into_response()
}

pub async fn export_snapshot_handler(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ExportQuery>,
) -> Response {
    let format = match query.format.as_deref().map(str::to_ascii_lowercase) {
        None => state.db.snapshot_format(),
        Some(f) if f == "json" => SnapshotFormat::Json,
        Some(f) if f == "zstd" || f == "zst" => SnapshotFormat::Zstd,
        Some(other) => {
            return error(
                StatusCode::BAD_REQUEST,
                format!("unknown format '{other}', expected 'json' or 'zstd'"),
            )
        }
    };

    // Copying and compressing a large database is CPU work: keep it off the
    // async workers.
    let db = state.db.clone();
    let result = tokio::task::spawn_blocking(move || db.export_snapshot_bytes(format)).await;
    let (timestamp, bytes) = match result {
        Ok(Ok(out)) => out,
        Ok(Err(e)) => return error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        Err(e) => return error(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
    };

    let disposition = format!(
        "attachment; filename=\"aegis-db-snapshot-{}.{}\"",
        timestamp,
        format.extension()
    );
    let mut res = (StatusCode::OK, bytes).into_response();
    let headers = res.headers_mut();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static(format.content_type()),
    );
    if let Ok(v) = HeaderValue::from_str(&disposition) {
        headers.insert(header::CONTENT_DISPOSITION, v);
    }
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(
        HeaderName::from_static(SNAPSHOT_TIMESTAMP_HEADER),
        HeaderValue::from(timestamp),
    );
    res
}
