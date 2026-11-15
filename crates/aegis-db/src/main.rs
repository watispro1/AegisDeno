use clap::Parser;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use aegis_db::{api, config::is_dev_environment, Config, AegisDatabase};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,aegis_db=debug,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Arc::new(Config::parse());
    config.validate(is_dev_environment())?;

    // Bind the port before touching the data directory: if another instance
    // already owns the port, exit without opening (and replaying) its files.
    let addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;

    tracing::info!(
        "Initializing AegisDB at path '{}'...",
        config.data_dir.display()
    );

    let db = AegisDatabase::open(&config.data_dir)?;

    // Spawn background auto-compactor task
    if config.auto_compact_secs > 0 {
        let db_clone = db.clone();
        let compact_interval = Duration::from_secs(config.auto_compact_secs);
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(compact_interval);
            loop {
                interval.tick().await;
                if let Err(e) = db_clone.compact() {
                    tracing::error!("Background compaction failed: {}", e);
                }
            }
        });
    }

    let router = api::create_router(db, config.clone());
    tracing::info!("AegisDB backend listening on http://{}", addr);

    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("AegisDB shut down gracefully.");
    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("failed to install CTRL+C signal handler");
    tracing::info!("Shutdown signal received, draining connections...");
}
