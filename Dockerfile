# ── Stage 1: Install dependencies ──
FROM node:20-slim AS deps

RUN corepack enable
WORKDIR /app

COPY package.json package-lock.json* ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

RUN npm install --workspaces --include-workspace-root

# ── Stage 2: Build frontend ──
FROM deps AS frontend-build

COPY frontend/ frontend/
RUN npm run build -w frontend

# ── Stage 3: Build backend ──
FROM deps AS backend-build

COPY backend/ backend/
RUN cd backend && npx prisma generate
RUN npm run build -w backend

# ── Stage 4: Production image ──
FROM node:20-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright system deps + browsers (Chromium only)
RUN npx playwright@1.50.1 install --with-deps chromium

WORKDIR /app

COPY package.json ./
COPY backend/package.json backend/

# Install production dependencies only
RUN npm install --workspace=backend --omit=dev

# Copy Prisma schema and generate client
COPY backend/prisma backend/prisma
RUN cd backend && npx prisma generate

# Copy built backend
COPY --from=backend-build /app/backend/dist backend/dist

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist frontend/dist

# Copy .env.example as reference
COPY backend/.env.example backend/.env.example

# Create data directories
RUN mkdir -p backend/data/resumes backend/data/uploads backend/data/sessions

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Run Prisma migrations then start the server
CMD cd backend && npx prisma db push --skip-generate && node dist/index.js
