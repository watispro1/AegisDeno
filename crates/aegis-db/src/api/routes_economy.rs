use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use super::routes_health::AppState;
use crate::models::{EconomyRecord, TransactionRecord};

pub async fn get_economy_account(
    State(state): State<Arc<AppState>>,
    Path((guild_id, user_id)): Path<(String, String)>,
) -> impl IntoResponse {
    let key = format!("eco:{}:{}", guild_id, user_id);
    if let Some(val) = state.db.get("economy", &key) {
        (StatusCode::OK, Json(val)).into_response()
    } else {
        let default_rec = EconomyRecord {
            guild_id,
            user_id,
            ..Default::default()
        };
        (StatusCode::OK, Json(json!(default_rec))).into_response()
    }
}

#[derive(Debug, Deserialize)]
pub struct TransactPayload {
    pub kind: String, // "deposit", "withdraw", "add_wallet", "set_wallet", "add_bank", "work", "crime", "rob", "gamble"
    pub amount: i64,
    pub description: Option<String>,
}

pub async fn transact_economy(
    State(state): State<Arc<AppState>>,
    Path((guild_id, user_id)): Path<(String, String)>,
    Json(payload): Json<TransactPayload>,
) -> impl IntoResponse {
    let key = format!("eco:{}:{}", guild_id, user_id);
    // Read-modify-write on the balance: serialize per account so two concurrent
    // transactions can never both read the same starting balance.
    let _guard = state.db.scope_lock(&key);
    let mut record: EconomyRecord = state
        .db
        .get("economy", &key)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_else(|| EconomyRecord {
            guild_id: guild_id.clone(),
            user_id: user_id.clone(),
            ..Default::default()
        });

    let now = chrono::Utc::now().timestamp_millis();

    match payload.kind.as_str() {
        "deposit" => {
            if payload.amount <= 0 {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "Amount must be positive" })),
                )
                    .into_response();
            }
            if record.wallet < payload.amount {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "Insufficient wallet funds" })),
                )
                    .into_response();
            }
            let space = (record.bank_capacity - record.bank).max(0);
            if payload.amount > space {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "Exceeds bank capacity" })),
                )
                    .into_response();
            }
            record.wallet -= payload.amount;
            record.bank += payload.amount;
        }
        "withdraw" => {
            if payload.amount <= 0 {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "Amount must be positive" })),
                )
                    .into_response();
            }
            if record.bank < payload.amount {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "Insufficient bank funds" })),
                )
                    .into_response();
            }
            record.bank -= payload.amount;
            record.wallet += payload.amount;
        }
        "add_wallet" => {
            record.wallet = (record.wallet + payload.amount).max(0);
        }
        "add_bank" => {
            record.bank = (record.bank + payload.amount).max(0);
        }
        "set_wallet" => {
            record.wallet = payload.amount.max(0);
        }
        "set_bank" => {
            record.bank = payload.amount.max(0);
        }
        _other => {
            record.wallet = (record.wallet + payload.amount).max(0);
        }
    }

    let tx = TransactionRecord {
        tx_id: format!("tx_{}", chrono::Utc::now().timestamp_micros()),
        kind: payload.kind,
        amount: payload.amount,
        description: payload.description.unwrap_or_default(),
        timestamp: now,
    };

    record.transactions.push(tx);
    if record.transactions.len() > 50 {
        record
            .transactions
            .drain(0..(record.transactions.len() - 50));
    }

    let val = match serde_json::to_value(&record) {
        Ok(v) => v,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    };

    if let Err(e) = state.db.put("economy", key, val) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response();
    }

    (StatusCode::OK, Json(json!(record))).into_response()
}

#[derive(Debug, Deserialize)]
pub struct LeaderboardQuery {
    pub limit: Option<usize>,
}

pub async fn get_leaderboard(
    State(state): State<Arc<AppState>>,
    Path(guild_id): Path<String>,
    Query(query): Query<LeaderboardQuery>,
) -> impl IntoResponse {
    let col = state.db.collection("economy");
    let prefix = format!("eco:{}:", guild_id);
    let all = col.prefix_scan(&prefix);

    let mut records: Vec<EconomyRecord> = all
        .into_iter()
        .filter_map(|(_, val)| serde_json::from_value::<EconomyRecord>(val).ok())
        .collect();

    records.sort_by(|a, b| {
        let net_b = b.wallet + b.bank;
        let net_a = a.wallet + a.bank;
        net_b.cmp(&net_a)
    });

    let limit = query.limit.unwrap_or(10).clamp(1, 100);
    let top: Vec<Value> = records
        .into_iter()
        .take(limit)
        .enumerate()
        .map(|(rank, r)| {
            json!({
                "rank": rank + 1,
                "user_id": r.user_id,
                "wallet": r.wallet,
                "bank": r.bank,
                "net_worth": r.wallet + r.bank,
            })
        })
        .collect();

    Json(json!({
        "guild_id": guild_id,
        "count": top.len(),
        "leaderboard": top
    }))
}
