use clap::Parser;
use std::path::PathBuf;

#[derive(Parser, Debug, Clone)]
#[command(name = "aegis-db", version = "0.1.0", about = "High-performance custom database and backend for Aegis")]
pub struct Config {
    #[arg(long, env = "AEGIS_DB_HOST", default_value = "127.0.0.1")]
    pub host: String,

    #[arg(long, env = "AEGIS_DB_PORT", default_value_t = 4000)]
    pub port: u16,

    #[arg(long, env = "AEGIS_DB_PATH", default_value = "./data/aegis-db")]
    pub data_dir: PathBuf,

    #[arg(long, env = "AEGIS_DB_SECRET", default_value = "")]
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
