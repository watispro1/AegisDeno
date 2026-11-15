use axum::{
    extract::{Request, State},
    http::{header::AUTHORIZATION, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use std::sync::Arc;
use crate::config::Config;

pub async fn auth_middleware(
    State(config): State<Arc<Config>>,
    req: Request,
    next: Next,
) -> Response {
    // If no secret configured, allow access (e.g. localhost development)
    if config.secret.is_empty() {
        return next.run(req).await;
    }

    // Check X-Aegis-Secret header
    if let Some(val) = req.headers().get("x-aegis-secret") {
        if let Ok(str_val) = val.to_str() {
            if str_val == config.secret {
                return next.run(req).await;
            }
        }
    }

    // Check Authorization: Bearer <secret>
    if let Some(val) = req.headers().get(AUTHORIZATION) {
        if let Ok(str_val) = val.to_str() {
            if let Some(token) = str_val.strip_prefix("Bearer ") {
                if token == config.secret {
                    return next.run(req).await;
                }
            }
        }
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
