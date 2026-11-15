# AegisDB — Custom Rust Database & Backend Service

High-performance, durable document and key-value database engine and REST API service built in Rust for Aegis.

## Features

- **Write-Ahead Log (WAL)**: Append-only log with CRC32 checksums on every record, guaranteeing durability, ACID semantics, and crash recovery.
- **Concurrent In-Memory Indexing**: Fast sub-millisecond document lookups, prefix scans, and range queries protected by fine-grained `parking_lot` locks.
- **Atomic Compaction & Snapshots**: Automated and manual checkpointing (`POST /api/db/compact`) writes atomic JSON snapshots and flushes the WAL.
- **REST API via Axum & Tokio**:
  - `GET /health` & `GET /metrics` for health probes and telemetry.
  - `/api/guilds/:guild_id/config`: Guild configuration persistence.
  - `/api/guilds/:guild_id/cases`: Moderation cases with auto-increment ID generation and filtering.
  - `/api/guilds/:guild_id/warnings`: Member warning logs and severity tracking.
  - `/api/guilds/:guild_id/economy`: Atomic transactions (wallet, bank, deposit, withdraw, net worth) and leaderboards.
- **Security & Middleware**:
  - Optional API key authentication via `x-aegis-secret` or `Authorization: Bearer <secret>`.
  - CORS support for dashboard integration.
  - Graceful shutdown handling on SIGINT/CTRL+C.

## Quick Start

### Build and Run
```bash
# Build binary
cargo build --release --manifest-path crates/aegis-db/Cargo.toml

# Run tests
cargo test --manifest-path crates/aegis-db/Cargo.toml

# Start backend server
cargo run --manifest-path crates/aegis-db/Cargo.toml
```

### Environment Variables
| Variable | Default | Description |
|---|---|---|
| `AEGIS_DB_HOST` | `127.0.0.1` | Host interface to bind |
| `AEGIS_DB_PORT` | `4000` | Port for REST API server |
| `AEGIS_DB_PATH` | `./data/aegis-db` | Directory for WAL and snapshots |
| `AEGIS_DB_SECRET` | `""` | Optional auth secret key |
| `AEGIS_DB_AUTO_COMPACT_SECS` | `300` | Periodic snapshot compaction interval (seconds) |

## TypeScript Client

A TypeScript client SDK is provided in `src/database/rustClient.ts`:

```typescript
import { getRustClient } from "./database/rustClient";

const client = getRustClient();
const health = await client.health();
console.log(`Connected to AegisDB: ${health.service} v${health.version}`);

// Save guild config
await client.saveGuildConfig("123456789", { prefix: "!" });
```
