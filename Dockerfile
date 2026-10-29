FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
# The website renders /changelog and /dashboard/changelog from these files at runtime.
COPY CHANGELOG.md DASHBOARD_CHANGELOG.md ./

# Web server port
EXPOSE 3000

CMD ["node", "dist/main.js"]
