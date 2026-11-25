# ClaimGuard — Deployment and Reviewer Guide

- **GitHub repository:** https://github.com/Prakhar6947/ClaimGuard

---

## 1. Demo login details

On the sign-in screen you can click a demo persona card, or type the credentials below.
All data is synthetic.

| Role | Email | Password | What to test |
| :--- | :--- | :--- | :--- |
| Insurance Desk Executive (`DESK_EXEC`) | `demo.exec@example.invalid` or `exec@companya-hospital.in` | `ClaimGuard@2026` | Browse claims, create an admission, upload documents, drag documents into slots, confirm or edit AI fields, reply to TPA queries, export the merged PDF packet |
| Insurance Desk Head (`DESK_HEAD`) | `demo.head@example.invalid` or `head@companya-hospital.in` | `ClaimGuard@2026` | Edit checklist rules, waive a slot with a reason, view analytics and the audit log |
| Treating Doctor (`DOCTOR`) | `demo.doctor@example.invalid` or `doctor@companya-hospital.in` | `ClaimGuard@2026` | Open the mobile sign-off screen for queries on CLM-3381 and CLM-3385 |

### Reviewer Demo Toolkit

Open the floating **Reviewer Demo Toolkit** (bottom right) or press `Ctrl+K` / `Cmd+K` to:

1. Switch role without logging out.
2. Download or inject the sample PDFs:
   - `CLM3381_Abdominal_Ultrasound_USG_Report.pdf` — high confidence, fills the missing ultrasound slot on CLM-3381
   - `CLM3385_Dengue_Serial_Platelet_Lab_Report.pdf` — high confidence, fills the platelet slot on CLM-3385
   - `Handwritten_Doctor_Admission_ICP_Scan.pdf` — handwritten note extraction
   - `Blurry_Low_Confidence_Ward_Scan.pdf` — low confidence (54%, below the 75% threshold), lands in the manual tray so you can drag it to a slot
3. Simulate an inbound TPA query email on CLM-3382 and watch the AI summarise it and flag the slot.

### Suggested 5-minute walkthrough

1. Sign in as Executive and create a synthetic admission using **New Admission**.
2. Open CLM-3381, try to move it to *Preauth Sent* and see the 422 gap list.
3. Inject the ultrasound PDF, confirm the extracted fields, and submit again.
4. Upload the blurry scan, see it quarantined, drag it to a slot.
5. Compile the PDF packet.
6. Sign in as Head, waive a slot (reason required), and check the audit log.
7. Fire the TPA query webhook, then open the doctor mobile view.

---

## 2. Run locally

### Prerequisites

- Python 3.11+
- Node.js 20+ and npm 10+
- Docker and Docker Compose (optional, only for the PostgreSQL option)

### Option A — SQLite, no database setup

```bash
git clone https://github.com/Prakhar6947/ClaimGuard.git
cd ClaimGuard
```

**Terminal 1 — backend**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env

# Export values from .env for this terminal (optional for SQLite defaults;
# required when using a custom DATABASE_URL, JWT_SECRET_KEY, or Gemini key).
set -a
source .env
set +a

python -m app.seed               # creates sample claims, rules, users and PDFs
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — frontend**

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. API docs are at http://localhost:8000/docs.

### Option B — Docker Compose (PostgreSQL 16 + API + web)

```bash
docker compose up --build
```

- App: http://localhost:3000
- API docs: http://localhost:8000/docs

### Run the tests

```bash
cd backend && source .venv/bin/activate && pytest -v
cd ../frontend && npm run build
```

The pytest suite has 10 tests covering the rule engine, the 422 gatekeeper, AI quarantine, RBAC 403, the PDF merge and the DPDP audit record. The same checks run in GitHub Actions on every push.

### AI mode

- With `GEMINI_API_KEY` set, the backend calls the Gemini model.
- Without it, a deterministic analyzer runs, so every demo case works offline.

---

## 3. How it is deployed

The project is **not deployed**; it is submitted as a public GitHub repository that runs locally.

The architecture is deployable as-is. A suggested layout (untested, so treated as a next step):

- Frontend (Next.js): any Node host or Vercel, root directory `frontend`.
- Backend (FastAPI): a container or web service, root directory `backend`, start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, health check at `/api/v1/health`.
- Database: managed PostgreSQL in an Indian region, set through `DATABASE_URL`.
- CI: `.github/workflows/ci.yml` seeds the database, runs pytest and builds the frontend.

---

## 4. Environment variables (names only)

### Backend (`backend/.env`)

| Name | Required | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | Yes | SQLite path for local use or a PostgreSQL URI |
| `JWT_SECRET_KEY` | Yes | Secret used to sign session tokens |
| `JWT_ALGORITHM` | Yes | Token signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Yes | Session lifetime |
| `AI_CONFIDENCE_THRESHOLD` | Yes | Minimum confidence to auto-slot a document |
| `GEMINI_API_KEY` | Optional | Enables live AI; offline analyzer is used if unset |
| `GEMINI_MODEL_NAME` | Yes | Model identifier |
| `CORS_ALLOWED_ORIGINS` | Yes | Allowed frontend origins |

### Frontend (`frontend/.env.local`)

| Name | Required | Purpose |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Base URL of the backend |
| `NEXT_PUBLIC_ENABLE_DEMO_TOOLKIT` | Optional | Shows the Reviewer Demo Toolkit |

The demo passwords and Docker Compose credentials are for local synthetic accounts only. Do not expose them or the development JWT signing key in a deployed environment; supply strong, unique secrets through the deployment platform instead.