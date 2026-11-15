use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseRecord {
    pub case_id: u64,
    /// The bot's own id for this case (the MongoDB `_id`), so later edits and
    /// revokes from the bot can find it. Absent for cases created directly.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub case_ref: Option<String>,
    pub guild_id: String,
    pub target_id: String,
    pub target_tag: Option<String>,
    pub mod_id: String,
    pub mod_tag: Option<String>,
    pub action: String,
    pub reason: String,
    pub created_at: i64,
    #[serde(default)]
    pub duration_ms: Option<u64>,
    #[serde(default)]
    pub revoked: bool,
    #[serde(default)]
    pub revoked_by: Option<String>,
    #[serde(default)]
    pub revoked_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarningRecord {
    pub warn_id: String,
    pub guild_id: String,
    pub user_id: String,
    pub mod_id: String,
    pub reason: String,
    #[serde(default = "default_severity")]
    pub severity: String,
    pub created_at: i64,
    #[serde(default = "default_true")]
    pub active: bool,
}

fn default_severity() -> String {
    "standard".to_string()
}

fn default_true() -> bool {
    true
}
