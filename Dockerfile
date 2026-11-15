# ── Production dependencies only ────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# ── Compile TypeScript (needs devDependencies) ──────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Runtime: compiled JS + production node_modules, as a non-root user ──────
# Files stay owned by root and are only readable by the `node` user, so a
# compromised process cannot rewrite the app or its dependencies.
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# AegisDB keeps its WAL and snapshots on the Fly volume mounted at /data
# (see [mounts] in fly.toml), so they survive deploys and restarts.
ENV AEGIS_DB_PATH=/data/aegis-db
RUN apk add --no-cache su-exec \
 && mkdir -p /data/aegis-db \
 && chown -R node:node /data

COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
# The website renders /changelog and /dashboard/changelog from these files at runtime.
COPY CHANGELOG.md DASHBOARD_CHANGELOG.md ./
COPY docker/entrypoint.sh /usr/local/bin/aegis-entrypoint
RUN chmod 755 /usr/local/bin/aegis-entrypoint

# The entrypoint starts as root only to chown the mounted volume (Fly mounts
# it root-owned), then execs the bot as `node` via su-exec.
ENTRYPOINT ["/usr/local/bin/aegis-entrypoint"]

# Web server port
EXPOSE 3000

CMD ["node", "dist/main.js"]
