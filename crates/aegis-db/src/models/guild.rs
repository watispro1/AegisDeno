use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GuildConfigRecord {
    pub guild_id: String,
    #[serde(default)]
    pub prefix: Option<String>,
    #[serde(default)]
    pub mod_log_channel_id: Option<String>,
    #[serde(default)]
    pub mute_role_id: Option<String>,
    #[serde(default)]
    pub automod: Option<Value>,
    #[serde(default)]
    pub logging: Option<Value>,
    #[serde(default)]
    pub welcome: Option<Value>,
    #[serde(default)]
    pub verification: Option<Value>,
    #[serde(default)]
    pub tickets: Option<Value>,
    #[serde(default)]
    pub extra: Option<Value>,
    #[serde(default)]
    pub updated_at: Option<i64>,
}
