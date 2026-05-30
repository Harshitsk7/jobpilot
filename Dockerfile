# ── Stage 1: Install dependencies ──
FROM node:20-slim AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

RUN npm ci --workspaces --include-workspace-root

# ── Stage 2: Build frontend ──
FROM deps AS frontend-build

COPY frontend/ frontend/
RUN npm run build -w frontend

# ── Stage 3: Build backend ──
FROM deps AS backend-build

COPY backend/ backend/
RUN cd backend && npx prisma generate && cd .. && npm run build -w backend

# ── Stage 4: Production image ──
FROM node:20-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright browsers (Chromium only)
RUN npx playwright@1.50.1 install --with-deps chromium && rm -rf /tmp/*

WORKDIR /app

# Copy package files and install prod deps only
COPY package.json ./
COPY backend/package.json backend/
RUN npm ci --workspace=backend --omit=dev && npm cache clean --force

# Copy Prisma schema and generate client
COPY backend/prisma backend/prisma
RUN cd backend && npx prisma generate

# Copy built artifacts
COPY --from=backend-build /app/backend/dist backend/dist
COPY --from=frontend-build /app/frontend/dist frontend/dist

# Create data directories
RUN mkdir -p backend/data/resumes backend/data/uploads backend/data/sessions

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

WORKDIR /app/backend

CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]
