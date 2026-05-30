# JobPilot AI

Personal AI-powered job application assistant that scrapes LinkedIn & Naukri, scores matches against your resume, tailors applications with AI, and automates the apply flow.

> **Disclaimer:** For personal use only. You are responsible for complying with LinkedIn and Naukri Terms of Service. All data stays on your machine.

![Stack](https://img.shields.io/badge/React_18-blue) ![Stack](https://img.shields.io/badge/Express-black) ![Stack](https://img.shields.io/badge/TypeScript-3178C6) ![Stack](https://img.shields.io/badge/Prisma_+_SQLite-2D3748) ![Stack](https://img.shields.io/badge/Playwright-45ba63) ![Stack](https://img.shields.io/badge/Tailwind_CSS-06B6D4)

## Features

- **Job Scraping** — Fetches jobs from LinkedIn and Naukri with keyword expansion and deduplication
- **AI Match Scoring** — Scores each job against your resume (0-100) with rationale
- **Resume Tailoring** — AI rewrites your resume targeting each specific job
- **ATS Scanner** — Scores your resume through an ATS simulation with section-by-section breakdown, keyword analysis, and actionable suggestions
- **LaTeX Editor** — CodeMirror-based LaTeX resume editor with AI enhancement, ATS scoring, and export to DOCX/PDF/.tex
- **Auto Apply** — Automates LinkedIn Easy Apply (multi-step modal navigation) and tracks application status
- **Cover Letters** — AI generates tailored cover letters per job
- **Interview Prep** — AI generates likely interview questions based on job descriptions
- **Skill Gap Analysis** — Identifies missing skills across your saved jobs
- **Dashboard** — Stats, activity feed, notifications, CSV export
- **Multi-Provider AI** — Anthropic, OpenAI, Gemini, GitHub Copilot — switch at runtime from Settings
- **AI Toggle** — All features work without AI (scraping, tracking, manual apply); enable AI when needed
- **Command Palette** — Quick search across jobs (Ctrl+K)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Recharts, CodeMirror 6 |
| Backend | Express, TypeScript, Prisma ORM |
| Database | SQLite (zero config, file-based) |
| Automation | Playwright (uses system Edge/Chrome) |
| AI | Anthropic Claude, OpenAI GPT, Google Gemini, GitHub Copilot |
| Security | AES-256-GCM credential encryption |

---

## Quick Start (Local)

### Prerequisites

- **Node.js** 18+ (20 recommended)
- **npm** 9+
- **Microsoft Edge** or **Google Chrome** (for Playwright scraping)
- An AI provider API key (optional — app works without AI)

### 1. Clone the repository

```bash
git clone https://github.com/Harshitsk7/jobpilot.git
cd jobpilot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
# Required: 32+ character random string for encrypting credentials
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_SECRET=your_generated_secret_here

# Pick one AI provider (or configure later in Settings UI)
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Or use another provider:
# LLM_PROVIDER=openai
# OPENAI_API_KEY=sk-...

# LLM_PROVIDER=gemini
# GEMINI_API_KEY=...
```

### 4. Initialize the database

```bash
npm run db:push
```

### 5. Start development servers

```bash
npm run dev
```

This starts:
- **Frontend:** http://localhost:5173 (with API proxy to backend)
- **Backend API:** http://localhost:3001

### 6. First-time setup in the UI

1. **Settings** → Fill in your profile (name, skills, preferences)
2. **Settings** → Connect LinkedIn/Naukri credentials (browser login recommended)
3. **Settings** → Configure AI provider and test connection
4. **Resume** → Upload your base resume (PDF/DOCX)
5. **Job Search** → Set filters → **Fetch Jobs**

---

## Production Build

```bash
npm run build
cd backend
npx prisma db push
node dist/index.js
```

The backend serves the frontend at `http://localhost:3001`.

---

## Docker

### Option A: Docker Compose (recommended)

```bash
# 1. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys and encryption secret

# 2. Build and start
docker compose up -d

# 3. Open http://localhost:3001
```

To stop:
```bash
docker compose down
```

### Option B: Docker CLI

```bash
# Build
docker build -t jobpilot .

# Run
docker run -d \
  --name jobpilot \
  -p 3001:3001 \
  -v jobpilot-data:/app/backend/data \
  -v jobpilot-db:/app/backend/prisma \
  --env-file backend/.env \
  jobpilot
```

### Option C: Pull from Docker Hub

```bash
docker pull harshees/jobpilot:latest

# Create .env with your config (see backend/.env.example for reference)
docker run -d \
  --name jobpilot \
  -p 3001:3001 \
  -v jobpilot-data:/app/backend/data \
  -v jobpilot-db:/app/backend/prisma \
  --env-file .env \
  harshees/jobpilot:latest
```

### Push to Docker Hub

```bash
docker build -t harshees/jobpilot:latest .
docker push harshees/jobpilot:latest
```

### Docker notes

- The Docker image includes Chromium for Playwright automation
- Browser login (interactive) won't work in Docker — use username/password credentials instead
- Data is persisted via Docker volumes (`jobpilot-data` and `jobpilot-db`)
- The database is automatically initialized on first run

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | `file:./dev.db` | SQLite database path |
| `PORT` | No | `3001` | API server port |
| `ENCRYPTION_SECRET` | **Yes** | — | 32+ char string for encrypting credentials |
| `LLM_PROVIDER` | No | `anthropic` | AI provider: `anthropic` \| `openai` \| `gemini` \| `copilot` |
| `ANTHROPIC_API_KEY` | If using Anthropic | — | Anthropic API key |
| `OPENAI_API_KEY` | If using OpenAI | — | OpenAI API key |
| `GEMINI_API_KEY` | If using Gemini | — | Google Gemini API key |
| `GITHUB_COPILOT_TOKEN` | If using Copilot | — | GitHub Copilot OAuth token |
| `GITHUB_COPILOT_APP_ID` | If using Copilot | — | GitHub Copilot App ID |
| `DATA_DIR` | No | `./data` | Directory for uploads and resumes |
| `PLAYWRIGHT_HEADLESS` | No | `true` | Set `false` to see the browser |

> You can also configure AI provider at runtime from **Settings** — API keys entered there are stored encrypted in the database.

---

## Project Structure

```
jobpilot/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Database schema
│   ├── src/
│   │   ├── index.ts               # Express server entry
│   │   ├── lib/
│   │   │   ├── config.ts          # Environment config
│   │   │   └── prisma.ts          # Prisma client
│   │   ├── routes/
│   │   │   ├── ai.ts              # AI status & provider switching
│   │   │   ├── apply.ts           # Job application automation
│   │   │   ├── ats.ts             # ATS scoring, enhancement, LaTeX
│   │   │   ├── credentials.ts     # Platform login management
│   │   │   ├── dashboard.ts       # Stats, activity, export
│   │   │   ├── jobs.ts            # Job listing and fetching
│   │   │   ├── profile.ts         # User profile
│   │   │   └── resume.ts          # Resume management
│   │   └── services/
│   │       ├── ai/                # LLM providers (Anthropic, OpenAI, Gemini, Copilot)
│   │       ├── apply/             # Playwright apply automation
│   │       ├── jobs/              # Job processing + keyword expansion
│   │       ├── resume/            # Resume parsing, diffing, LaTeX export
│   │       └── scraper/           # LinkedIn + Naukri scrapers
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/client.ts          # API client
│   │   ├── components/            # Shared components
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx      # Analytics dashboard
│   │   │   ├── JobSearch.tsx      # Job search + filters
│   │   │   ├── ResumePage.tsx     # Resume management
│   │   │   ├── ATSScore.tsx       # ATS resume scanner
│   │   │   ├── LaTeXEditor.tsx    # LaTeX resume editor
│   │   │   ├── Applications.tsx   # Application tracking
│   │   │   └── Settings.tsx       # Profile, credentials, AI config
│   │   └── types.ts
│   └── vite.config.ts
├── Dockerfile
├── docker-compose.yml
└── package.json                   # npm workspaces root
```

## API Overview

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check and AI status |
| `POST /api/jobs/fetch` | Scrape jobs from platforms |
| `GET /api/jobs` | List jobs (sort, filter, paginate) |
| `POST /api/resume/job/:id/tailor` | AI-tailor resume for a job |
| `POST /api/ats/score` | ATS score a resume |
| `POST /api/ats/enhance` | AI-enhance a resume |
| `POST /api/ats/latex/enhance` | AI-enhance a LaTeX resume |
| `POST /api/apply/job/:id` | Apply to one job |
| `POST /api/apply/batch` | Batch apply with progress tracking |
| `GET /api/dashboard/stats` | Analytics and stats |
| `POST /api/credentials` | Store encrypted credentials |
| `GET /api/ai/providers` | List available AI providers |
| `PUT /api/ai/provider` | Switch AI provider at runtime |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| AI features disabled | Configure a provider in Settings, or set API key in `.env` |
| Cannot save credentials | `ENCRYPTION_SECRET` must be 32+ characters |
| Login/CAPTCHA errors | Set `PLAYWRIGHT_HEADLESS=false`, complete login manually |
| Jobs not fetching | Check credentials are connected; LinkedIn/Naukri may require re-login |
| Score showing "—" | AI processing is in progress or AI mode is disabled |
| Docker: browser login fails | Use username/password credentials instead of browser login |

## License

MIT — personal automation tool, use responsibly.
