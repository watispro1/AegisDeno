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
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --chown=node:node package.json ./
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
# The website renders /changelog and /dashboard/changelog from these files at runtime.
COPY --chown=node:node CHANGELOG.md DASHBOARD_CHANGELOG.md ./

USER node

# Web server port
EXPOSE 3000

CMD ["node", "dist/main.js"]
