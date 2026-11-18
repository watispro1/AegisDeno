# AegisDB — Custom Rust Database & Backend Service

High-performance, durable document and key-value database engine and REST API service built in Rust for Aegis.

## Features

- **Write-Ahead Log (WAL)**: Append-only log with CRC32 checksums on every record, guaranteeing durability, ACID semantics, and crash recovery.
- **Concurrent In-Memory Indexing**: Fast sub-millisecond document lookups, prefix scans, and range queries protected by fine-grained `parking_lot` locks.
- **Atomic Compaction & Snapshots**: Checkpointing writes an atomic snapshot (temp file + fsync + rename + directory fsync) and truncates the WAL. It runs on a timer, when the WAL passes a size limit, or on demand (`POST /api/db/compact`); a `compact_lock` serializes all three so an older snapshot can never replace a newer one.
- **zstd Snapshots**: Snapshots are zstd-compressed by default. Plain-JSON snapshots from older versions are detected by their missing zstd magic bytes (`28 B5 2F FD`) and still load; the next compaction rewrites them as zstd.
- **Backups**: `GET /api/db/snapshot/export` downloads a consistent point-in-time copy of the whole database.
- **REST API via Axum & Tokio**:
  - `GET /health` & `GET /metrics` for health probes and telemetry.
  - `GET /api/db/stats`, `POST /api/db/compact`, `GET /api/db/snapshot/export`: admin and backup routes.
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

# Run tests, lints and formatting check (what CI runs)
cargo test --manifest-path crates/aegis-db/Cargo.toml
cargo clippy --manifest-path crates/aegis-db/Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path crates/aegis-db/Cargo.toml --check

# Start backend server
cargo run --manifest-path crates/aegis-db/Cargo.toml
```

### Environment Variables
| Variable | Default | Description |
|---|---|---|
| `AEGIS_DB_HOST` | `127.0.0.1` | Host interface to bind |
| `AEGIS_DB_PORT` | `4000` | Port for REST API server |
| `AEGIS_DB_PATH` | `./data/aegis-db` | Directory for WAL and snapshots (locked by `aegis-db.lock` while running) |
| `AEGIS_BACKEND_SECRET` | `""` | Admin secret (same variable the bot uses). Required unless `BOT_ENV`/`NODE_ENV` is `development` or `test`; the server refuses to start without it otherwise |
| `AEGIS_DB_AUTO_COMPACT_SECS` | `300` | Periodic compaction interval in seconds; `0` turns the timer off |
| `AEGIS_DB_COMPACT_WAL_BYTES` | `67108864` (64 MiB) | Compact as soon as the live WAL reaches this many bytes; `0` disables the size trigger |
| `AEGIS_DB_SNAPSHOT_ZSTD` | `true` | Write snapshots zstd-compressed (`true`/`false`, `1`/`0`, `yes`/`no`, `on`/`off`). Snapshots in either format always load |

Each variable also has a CLI flag (`--auto-compact-secs`, `--compact-wal-bytes`, `--snapshot-zstd <bool>`).

### Compaction

Compaction copies every collection and rotates the WAL aside under the WAL lock, writes the snapshot
atomically, and only then deletes the rotated WAL. Three things can start it, and `compact_lock`
makes them take turns:

- the timer (`AEGIS_DB_AUTO_COMPACT_SECS`),
- the WAL reaching `AEGIS_DB_COMPACT_WAL_BYTES`,
- `POST /api/db/compact`.

Lock order is `compact_lock` → scope stripe → WAL → collections.

### Backups

```bash
# zstd by default (the configured snapshot format); add ?format=json for plain JSON
curl -fsS -H "x-aegis-secret: $AEGIS_BACKEND_SECRET" \
  -o "aegis-db-$(date +%F).json.zst" \
  http://127.0.0.1:4000/api/db/snapshot/export
```

The export is taken from memory under the WAL lock, so it includes writes that are not compacted yet,
and it never touches the files on disk. The response carries `Content-Disposition`, and an
`x-aegis-snapshot-timestamp` header (Unix ms). There is no import route: to restore, stop the
service and put the file in place as `snapshot.json` in an empty data directory (either format
loads).

### Stats

`GET /api/db/stats` (and `/metrics` with the secret) report, besides document counts:

| Field | Meaning |
|---|---|
| `wal_bytes` | Size of the live WAL |
| `wal_pending_entries` | Records appended since the last compaction (this process) |
| `snapshot_bytes` | Size of the snapshot on disk (`0` when none) |
| `snapshot_format` | `zstd` or `json`, the format new snapshots are written in |
| `compact_wal_bytes` | Configured size trigger (`0` = off) |
| `size_compaction_pending` | The size trigger fired and its compaction has not started yet |
| `last_compaction` | `null` until the first compaction, then `{ timestamp_ms, finished_at, duration_ms, trigger, snapshot_bytes }`; `trigger` is `timer`, `wal_size` or `manual` |

`/health` is public. `/metrics` returns `{ "healthy": true }` without the secret and full stats with it.
Everything under `/api` needs the secret in `x-aegis-secret` or `Authorization: Bearer`. No CORS headers are sent.

The embedded TypeScript engine (`src/database/aegisDb`) uses its own file names (`ts-wal.jsonl`,
`ts-snapshot.json`, `ts-aegis-db.lock`), so the two engines never share files even in one directory.

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
