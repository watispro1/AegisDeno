pub mod middleware;
pub mod routes_cases;
pub mod routes_economy;
pub mod routes_guilds;
pub mod routes_health;

use axum::{
    middleware::from_fn_with_state,
    routing::{delete, get, patch, post, put},
    Router,
};
use std::sync::Arc;
use std::time::Instant;

use crate::config::Config;
use crate::engine::AegisDatabase;
use routes_health::AppState;

pub fn create_router(db: Arc<AegisDatabase>, config: Arc<Config>) -> Router {
    let app_state = Arc::new(AppState {
        db,
        start_time: Instant::now(),
        version: env!("CARGO_PKG_VERSION"),
        secret: config.secret.clone(),
    });

    // No CORS layer: this is a server-to-server API, so browsers on other
    // origins get the default same-origin refusal.

    // Protected API routes
    let api_routes = Router::new()
        // Guild config
        .route(
            "/guilds/{guild_id}/config",
            get(routes_guilds::get_guild_config),
        )
        .route(
            "/guilds/{guild_id}/config",
            put(routes_guilds::put_guild_config),
        )
        .route(
            "/guilds/{guild_id}/config",
            delete(routes_guilds::delete_guild_config),
        )
        // Moderation cases
        .route("/guilds/{guild_id}/cases", get(routes_cases::list_cases))
        .route("/guilds/{guild_id}/cases", post(routes_cases::create_case))
        .route(
            "/guilds/{guild_id}/cases/{case_id}",
            get(routes_cases::get_case),
        )
        .route(
            "/guilds/{guild_id}/cases/{case_id}",
            patch(routes_cases::patch_case),
        )
        // Warnings
        .route(
            "/guilds/{guild_id}/warnings/{user_id}",
            get(routes_cases::list_warnings),
        )
        .route(
            "/guilds/{guild_id}/warnings",
            post(routes_cases::create_warning),
        )
        .route(
            "/guilds/{guild_id}/warnings/{user_id}",
            delete(routes_cases::clear_warnings),
        )
        // Economy
        .route(
            "/guilds/{guild_id}/economy/{user_id}",
            get(routes_economy::get_economy_account),
        )
        .route(
            "/guilds/{guild_id}/economy/{user_id}/transact",
            post(routes_economy::transact_economy),
        )
        .route(
            "/guilds/{guild_id}/economy/leaderboard",
            get(routes_economy::get_leaderboard),
        )
        // DB admin
        .route("/db/stats", get(routes_health::stats_handler))
        .route("/db/compact", post(routes_health::compact_handler))
        .layer(from_fn_with_state(
            config.clone(),
            middleware::auth_middleware,
        ));

    Router::new()
        // Public health routes
        .route("/health", get(routes_health::health_handler))
        // Full metrics with the admin secret, only `{ "healthy": true }` without it.
        .route("/metrics", get(routes_health::metrics_handler))
        .nest("/api", api_routes)
        .with_state(app_state)
}
