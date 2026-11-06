# ClaimGuard

**A cashless health-insurance claims workspace for hospital teams.**

[![ClaimGuard CI](https://github.com/Prakhar6947/ClaimGuard/actions/workflows/ci.yml/badge.svg)](https://github.com/Prakhar6947/ClaimGuard/actions)

ClaimGuard is a demonstration application for coordinating pre-authorisation and discharge claims between hospital desks, treating doctors, insurers, and third-party administrators (TPAs). It combines a claims queue, configurable document checklists, human-reviewed document extraction, query handling, and audit events in one workspace.

> **Prototype notice:** ClaimGuard is provided for evaluation and local development. It is not a certified medical, insurance, privacy, or regulatory-compliance system. Do not use it with real patient information or production credentials.

## What it demonstrates

- Role-based workflows for desk executives, desk heads, and treating doctors.
- Insurer- and procedure-aware document checklists, with universal, insurer, and insurer/procedure rules.
- A submission gate that prevents incomplete claims from advancing.
- Document classification and field extraction with a human confirmation step; low-confidence documents can be routed for manual review.
- TPA query replies, doctor sign-off, and claim timeline/audit events.
- Policy-number masking and an explicit audit event when the full value is revealed.
- A consolidated PDF packet for a claim.
- A responsive doctor-facing workflow and reviewer demo controls.

## Architecture

```text
Next.js 15 / React UI
        │ REST / JSON
        ▼
FastAPI application ─── SQLAlchemy
        │                    │
        ├── Rule engine       └── SQLite (local) or PostgreSQL (Docker)
        ├── Document/AI services
        ├── Authentication and role checks
        └── PDF packet generation
```

The AI integration uses Google Gemini when an API key is configured; the application also contains a deterministic fallback for local demonstrations. AI output is a suggestion and must be reviewed by a person.

## Tech stack

| Area | Technologies |
|---|---|
| Frontend | Next.js 15, React 18, TypeScript, Tailwind CSS |
| Backend | Python 3.11+, FastAPI, Pydantic, SQLAlchemy |
| Database | SQLite for local development; PostgreSQL 16 in Docker Compose |
| Documents | ReportLab and PDF processing |
| Optional AI | Google Gemini |

## Run locally

### Prerequisites

- Python 3.11 or newer
- Node.js 20 or newer and npm

### 1. Start the API

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

The backend reads configuration from environment variables. To load the example file into your current shell:

```bash
set -a
source .env
set +a
```

For local use, the example config uses SQLite and does not require an AI key. Seed the local database with synthetic demo records, then start the API:

```bash
python -m app.seed
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API is available at <http://localhost:8000>. Interactive API documentation is at <http://localhost:8000/docs>.

### 2. Start the web app

In another terminal:

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>.

### Demo accounts

The seed command creates these local-only demo accounts. The shared demo password is `ClaimGuard@2026`.

| Role | Email |
|---|---|
| Desk Executive | `demo.exec@example.invalid` |
| Desk Head | `demo.head@example.invalid` |
| Treating Doctor | `demo.doctor@example.invalid` |

These are demonstration credentials, not suitable for deployment. Change them and configure a strong, unique signing secret before exposing any instance.

## Run with Docker Compose

Docker Compose starts PostgreSQL, the API, and the web app:

```bash
docker compose up --build
```

Then open the frontend at <http://localhost:3000> and the API docs at <http://localhost:8000/docs>. Stop the stack with `Ctrl+C`; run `docker compose down` to stop and remove its containers.

The Compose file contains development-only database and signing-secret values. Replace them before using a non-local environment. For detailed deployment notes, see [deployment.md](./deployment.md).

## Configuration

| Variable | Component | Purpose |
|---|---|---|
| `DATABASE_URL` | Backend | SQLAlchemy URL; defaults to local SQLite |
| `JWT_SECRET_KEY` | Backend | Secret used to sign access tokens; set a unique random value |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Backend | Token lifetime |
| `AI_CONFIDENCE_THRESHOLD` | Backend | Confidence below which documents are sent for manual review |
| `GEMINI_API_KEY` | Backend | Optional key for Gemini-powered document processing |
| `GEMINI_MODEL_NAME` | Backend | Gemini model name |
| `CORS_ALLOWED_ORIGINS` | Backend | Comma-separated allowed browser origins |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend | Base URL for the FastAPI service |
| `NEXT_PUBLIC_ENABLE_DEMO_TOOLKIT` | Frontend | Enables reviewer demo controls |

See [`backend/.env.example`](./backend/.env.example) and [`frontend/.env.example`](./frontend/.env.example) for example values. The backend example intentionally contains no credentials.

## Tests and checks

Run the backend test suite:

```bash
cd backend
source .venv/bin/activate
pytest tests -v
```

Build the frontend:

```bash
cd frontend
npm ci
npm run build
```

## Repository layout

```text
backend/
  app/                 FastAPI routes, models, schemas, and services
  storage/             Local document storage (not tracked)
  tests/               Backend tests
frontend/
  src/app/             Next.js app entry points
  src/components/      Claims, review, analytics, and role-based views
  src/lib/             API client and shared types
docker-compose.yml     Local PostgreSQL + API + frontend stack
TDD.md                 Technical design
deployment.md           Deployment and operations notes
```

## Further reading

- [Technical design document](./TDD.md)
- [Deployment and operations guide](./deployment.md)

## Privacy and security

The repository is a software prototype, not a production-ready handling system for health or insurance data. Use only synthetic records and documents. Keep `.env` files, database files, uploaded/generated PDFs, and credentials out of version control. The included `.gitignore` excludes local state and generated artifacts by default.
