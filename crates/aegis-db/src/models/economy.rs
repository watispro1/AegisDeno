use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionRecord {
    pub tx_id: String,
    pub kind: String, // "deposit", "withdraw", "pay", "rob", "work", "crime", "gamble", "interest"
    pub amount: i64,
    pub description: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct InventoryItem {
    pub item_id: String,
    pub name: String,
    pub quantity: u32,
    pub purchased_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EconomyRecord {
    pub guild_id: String,
    pub user_id: String,
    #[serde(default)]
    pub wallet: i64,
    #[serde(default)]
    pub bank: i64,
    #[serde(default = "default_bank_cap")]
    pub bank_capacity: i64,
    #[serde(default)]
    pub daily_streak: u32,
    #[serde(default)]
    pub last_daily: Option<i64>,
    #[serde(default)]
    pub last_weekly: Option<i64>,
    #[serde(default)]
    pub last_work: Option<i64>,
    #[serde(default)]
    pub last_crime: Option<i64>,
    #[serde(default)]
    pub last_rob: Option<i64>,
    #[serde(default)]
    pub inventory: Vec<InventoryItem>,
    #[serde(default)]
    pub transactions: Vec<TransactionRecord>,
}

fn default_bank_cap() -> i64 {
    10_000
}

impl Default for EconomyRecord {
    fn default() -> Self {
        Self {
            guild_id: String::new(),
            user_id: String::new(),
            wallet: 0,
            bank: 0,
            bank_capacity: 10_000,
            daily_streak: 0,
            last_daily: None,
            last_weekly: None,
            last_work: None,
            last_crime: None,
            last_rob: None,
            inventory: Vec::new(),
            transactions: Vec::new(),
        }
    }
}
