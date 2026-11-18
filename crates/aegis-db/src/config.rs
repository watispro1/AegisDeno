use clap::Parser;
use std::path::PathBuf;

#[derive(Parser, Debug, Clone)]
#[command(
    name = "aegis-db",
    version = "0.1.0",
    about = "High-performance custom database and backend for Aegis"
)]
pub struct Config {
    #[arg(long, env = "AEGIS_DB_HOST", default_value = "127.0.0.1")]
    pub host: String,

    #[arg(long, env = "AEGIS_DB_PORT", default_value_t = 4000)]
    pub port: u16,

    #[arg(long, env = "AEGIS_DB_PATH", default_value = "./data/aegis-db")]
    pub data_dir: PathBuf,

    /// Shared admin secret. The same variable name is read by the bot and the
    /// embedded TypeScript engine. Required unless running in development.
    #[arg(
        long,
        env = "AEGIS_BACKEND_SECRET",
        default_value = "",
        hide_env_values = true
    )]
    pub secret: String,

    #[arg(long, env = "AEGIS_DB_AUTO_COMPACT_SECS", default_value_t = 300)]
    pub auto_compact_secs: u64,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".into(),
            port: 4000,
            data_dir: PathBuf::from("./data/aegis-db"),
            secret: String::new(),
            auto_compact_secs: 300,
        }
    }
}

/// True only when the environment explicitly says development or test
/// (`BOT_ENV`, falling back to `NODE_ENV`). Everything else counts as production.
pub fn is_dev_environment() -> bool {
    let env = std::env::var("BOT_ENV")
        .ok()
        .filter(|v| !v.is_empty())
        .or_else(|| std::env::var("NODE_ENV").ok())
        .unwrap_or_default();
    matches!(env.as_str(), "development" | "test")
}

impl Config {
    /// Startup check: refuse to serve without a secret outside development.
    pub fn validate(&self, dev: bool) -> Result<(), String> {
        if self.secret.is_empty() && !dev {
            return Err("AEGIS_BACKEND_SECRET must be set outside development (BOT_ENV/NODE_ENV=development)".into());
        }
        Ok(())
    }
}
