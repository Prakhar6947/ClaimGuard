# ClaimGuard TPA — Deployment & Operations Guide
**GitHub Repository:** [https://github.com/Prakhar6947/ClaimGuard](https://github.com/Prakhar6947/ClaimGuard)  
**CI/CD Pipeline:** [![ClaimGuard CI](https://github.com/Prakhar6947/ClaimGuard/actions/workflows/ci.yml/badge.svg)](https://github.com/Prakhar6947/ClaimGuard/actions)  

## Overview
**ClaimGuard** is a prototype Cashless Claims & TPA Workspace for demonstrating hospital-to-insurer claim workflows. It includes configurable SLA timers, an Insurer × Procedure 3-tier checklist gatekeeper, and human review of optional multimodal AI document processing. It is not a certified compliance or production system.

---

## 1. Quickstart (Zero-Config Local Execution)

### Prerequisites
- Python 3.11+ / Python 3.13+
- Node.js 18+ / 20+
- (Optional) Docker & Docker Compose

### Backend (FastAPI + SQLite Fallback)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run automated tests (10 passing tests)
pytest tests/test_core.py -v

# Seed database with sample claims (CLM-3381, CLM-3382, CLM-3385) & sample medical PDFs
python -m app.seed

# Start backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Backend API will be live at `http://localhost:8000`. Interactive Swagger UI documentation is available at `http://localhost:8000/docs`.

### Frontend (Next.js 15 + Tailwind CSS)
```bash
cd frontend
npm install
npm run build
npm start
```
Open `http://localhost:3000` in your browser.

---

## 2. Default Sign-In Credentials

ClaimGuard includes a clinical Sign-In interface with both manual JWT credential authentication and **1-Click Instant Demo Login pills** for fast reviewer evaluation:

| Role | Hospital Staff Email (Canonical) | Demo Alias | Password | Permissions & Workflow Scope |
|---|---|---|---|---|
| **Desk Executive** | `exec@companya-hospital.in` | `demo.exec@example.invalid` | `ClaimGuard@2026` | Claims queue triage, document uploads, AI field confirmations, query replies, merged PDF compilation. |
| **Desk Head (Admin)** | `head@companya-hospital.in` | `demo.head@example.invalid` | `ClaimGuard@2026` | All executive capabilities + checklist waiver approvals, 3-tier rule matrix configuration, audit trail inspection. |
| **Treating Doctor** | `doctor@companya-hospital.in` | `demo.doctor@example.invalid` | `ClaimGuard@2026` | 360px mobile ward round interface, clinical justification sign-offs for TPA queries. |

---

## 3. Core API Endpoints

### Authentication & RBAC
- `POST /api/v1/auth/login`: Authenticate staff credentials, return JWT bearer token and user role.

### Claims Management & Gatekeeper
- `GET /api/v1/claims`: List all active claims with IRDAI SLA timers, gap counts, and status filters.
- `POST /api/v1/claims`: Register new cashless admission; automatically masks policy number and triggers 3-tier checklist rule engine to materialize mandatory slots.
- `GET /api/v1/claims/{claim_id}`: Fetch full claim details, checklist items, AI fields, and documents.
- `POST /api/v1/claims/{claim_id}/transition`: Gatekeeper-enforced state transitions (`DRAFT` -> `PREAUTH_READY` -> `PREAUTH_SENT` -> `ENHANCEMENT_REQUESTED` -> `APPROVED` -> `DISCHARGE_SENT` -> `SETTLED`). Rejects transition if mandatory checklist slots or unconfirmed AI fields remain.
- `POST /api/v1/claims/{claim_id}/audit-unmask`: Logs immutable DPDP audit record (`DPDP_PII_POLICY_UNMASKED`) when staff reveals masked policy numbers.

### Document & AI Vision Pipeline
- `POST /api/v1/claims/{claim_id}/documents/upload`: Upload medical scan; auto-classified by Gemini 2.5 Flash / deterministic fallback. Scans with confidence < 75% are routed to the Quarantine Tray.
- `GET /api/v1/claims/{claim_id}/documents/{doc_id}/file`: Stream raw uploaded document for split-screen PDF preview.
- `GET /api/v1/sample-docs/{file_name}`: Serve sample medical scans (e.g. USG, ICP, lab reports).
- `POST /api/v1/claims/{claim_id}/documents/{doc_id}/reassign`: Human-in-the-loop manual slot assignment from quarantine tray.
- `POST /api/v1/claims/{claim_id}/fields/{field_id}/confirm`: Confirm or edit AI pre-filled data with human verification.

### Checklist Rule Engine & Desk Head Waivers
- `GET /api/v1/rules`: Retrieve active 3-tier checklist rules matrix by insurer and procedure.
- `POST /api/v1/rules`: Create or edit insurer x procedure checklist rules (Desk Head role only).
- `POST /api/v1/claims/{claim_id}/checklist/{item_id}/waive`: Desk Head-authorized waiver of mandatory checklist slot with mandatory clinical reason.

### TPA Queries & Mobile Doctor Magic Link
- `GET /api/v1/claims/{claim_id}/queries`: List queries with SLA countdown timer.
- `POST /api/v1/claims/{claim_id}/queries`: Simulate inbound webhook query from TPA.
- `POST /api/v1/claims/{claim_id}/queries/{query_id}/reply`: Send response to TPA query.
- `POST /api/v1/claims/{claim_id}/doctor-signoff`: Mobile one-click clinical justification sign-off by treating doctor.

### Merged PDF Packet & Audit
- `GET /api/v1/claims/{claim_id}/packet.pdf`: Generate single merged ReportLab PDF packet with title page, summary, checklist status, and attached documents.
- `GET /api/v1/audit-logs`: Audit log inspection for DPDP compliance.

---

## 4. Docker Deployment

To spin up the complete stack with PostgreSQL, FastAPI backend, and Next.js frontend:

```bash
docker compose up --build
```

### Services Started:
- **Database**: PostgreSQL 16 Alpine (`localhost:5432`)
- **Backend**: FastAPI with Python 3.11 (`localhost:8000`)
- **Frontend**: Next.js 15 (`localhost:3000`)

---

## 5. Environment Variables

### Backend (`backend/.env`)
| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | SQLite / PostgreSQL connection string | `sqlite:///./claimguard.db` |
| `JWT_SECRET_KEY` | Secret key for JWT HS256 tokens | `dev-hospital-nashik-secret-key-2026` |
| `AI_CONFIDENCE_THRESHOLD` | Threshold below which scans are quarantined | `0.75` |
| `GEMINI_API_KEY` | Optional Google Gemini 2.5 Flash API key | `""` (Deterministic fallback active) |
| `GEMINI_MODEL_NAME` | Model identifier | `gemini-2.5-flash` |
| `CORS_ALLOWED_ORIGINS` | Allowed origins | `http://localhost:3000,http://127.0.0.1:3000` |

### Frontend (`frontend/.env.local`)
| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | URL of backend API | `http://localhost:8000` |
| `NEXT_PUBLIC_ENABLE_DEMO_TOOLKIT` | Enable floating reviewer drawer | `true` |

---

## 6. Automated Verification Suite
To execute the automated regression test suite:
```bash
cd backend
.venv/bin/pytest tests/test_core.py -v
```
All 10 tests run in under 4 seconds, verifying the rule engine, login security, submission gatekeeper, AI quarantine tray, RBAC waivers, TPA queries, PDF packet generation, and DPDP unmask logging.

---

## 7. Cloud Deployment (Render & Vercel)

### Backend Deployment (Render.com)
1. In Render Dashboard, click **New +** ➔ **Web Service** ➔ Select GitHub repo `Prakhar6947/ClaimGuard`.
2. Configure settings:
   - **Root Directory:** `backend`
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt && python -m app.seed`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Environment Variables:
   - `JWT_SECRET_KEY`: `<generate-random-secret>`
   - `GEMINI_API_KEY`: *(Optional, deterministic fallback works out of the box)*
   - `CORS_ALLOWED_ORIGINS`: `*`
4. Deploy and copy your live service URL (e.g., `https://claimguard-api.onrender.com`).

### Frontend Deployment (Vercel)
1. In Vercel Dashboard, click **Add New Project** ➔ Import `Prakhar6947/ClaimGuard`.
2. Configure settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** `Next.js`
3. Environment Variables:
   - `NEXT_PUBLIC_API_BASE_URL`: `https://claimguard-api.onrender.com` (your live backend URL)
4. Click **Deploy**. The Next.js frontend builds in ~60 seconds.
