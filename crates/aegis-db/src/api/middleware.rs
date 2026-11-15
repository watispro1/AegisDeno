use axum::{
    extract::{Request, State},
    http::{header::AUTHORIZATION, HeaderMap, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use std::sync::Arc;
use crate::config::Config;

/// Compares two secrets in time that depends only on the expected length.
pub fn secret_matches(provided: &[u8], expected: &[u8]) -> bool {
    if expected.is_empty() {
        return false;
    }
    let mut diff: u8 = if provided.len() == expected.len() { 0 } else { 1 };
    for (i, e) in expected.iter().enumerate() {
        let p = provided.get(i).copied().unwrap_or(0);
        diff |= p ^ e;
    }
    diff == 0
}

/// True when the request carries the admin secret (`x-aegis-secret` or
/// `Authorization: Bearer`). With no secret configured (development only; the
/// binary refuses to start that way elsewhere) every request is allowed.
pub fn is_authorized(headers: &HeaderMap, secret: &str) -> bool {
    if secret.is_empty() {
        return true;
    }
    let expected = secret.as_bytes();
    if let Some(val) = headers.get("x-aegis-secret") {
        if secret_matches(val.as_bytes(), expected) {
            return true;
        }
    }
    if let Some(val) = headers.get(AUTHORIZATION) {
        if let Some(token) = val.as_bytes().strip_prefix(b"Bearer ") {
            if secret_matches(token, expected) {
                return true;
            }
        }
    }
    false
}

pub async fn auth_middleware(
    State(config): State<Arc<Config>>,
    req: Request,
    next: Next,
) -> Response {
    if is_authorized(req.headers(), &config.secret) {
        return next.run(req).await;
    }

    (
        StatusCode::UNAUTHORIZED,
        Json(serde_json::json!({
            "error": "Unauthorized",
            "message": "Missing or invalid Aegis API secret"
        })),
    )
        .into_response()
}
