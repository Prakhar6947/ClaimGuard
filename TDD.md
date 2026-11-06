# ClaimGuard TPA — Technical Design Document (TDD)
**Hospital:** Company A Multispeciality Hospital, Nashik  
**Domain:** Cashless Hospital Insurance Desk & TPA Operations  
**Regulatory Frameworks:** IRDAI Master Circular (2024), DPDP Act (2023)  
**GitHub Repository:** [https://github.com/Prakhar6947/ClaimGuard](https://github.com/Prakhar6947/ClaimGuard)  
**CI/CD Status:** [![ClaimGuard CI](https://github.com/Prakhar6947/ClaimGuard/actions/workflows/ci.yml/badge.svg)](https://github.com/Prakhar6947/ClaimGuard/actions)  

---

## 1. Problem Statement & Hospital Context
Company A Multispeciality Hospital in Nashik suffers significant cashless insurance revenue leakage (~₹63.57 Lakhs annually) driven by:
1. **Pre-authorisation denials & deductions** caused by missing insurer-specific diagnostic evidence (e.g. Ultrasound report missing for gall bladder removal).
2. **IRDAI SLA breaches**: IRDAI mandates a strict 1-hour turnaround for cashless pre-authorisation and a 3-hour turnaround for final discharge bill approval. Inefficient communication cycles cause patient discharge delays and financial penalties.
3. **Manual document sorting overhead & transcription errors**: Desk executives manually read handwritten case papers and laboratory reports, introducing transcription errors and misfiled documents.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js 15 Frontend                      │
│  - Clinical Sign-In View + 1-Click Instant Demo Login       │
│  - Claims Queue Command Center & + New Cashless Admission   │
│  - Split-Screen AI Verification Studio with Real PDF View   │
│  - TPA Query Inbox with SLA Countdown Timers                │
│  - Desk Head 3-Tier Rule Matrix Configuration Editor        │
│  - Mobile Doctor Magic-Link Screen (360px Optimized)        │
│  - Floating Reviewer Demo Toolkit                           │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST / JSON (FastAPI)
┌──────────────────────────────▼──────────────────────────────┐
│                    FastAPI Backend Core                     │
│  - JWT Authentication & Role-Based Access Control (RBAC)    │
│  - 3-Tier Inherited Rule Engine (Universal x Insurer x Proc)│
│  - Submission Gatekeeper (Blocks dispatch if gaps exist)    │
│  - Multimodal Vision AI Pipeline (Gemini 2.5 Flash/Fallback)│
│  - ReportLab PDF Compiler (Single merged TPA packets)       │
│  - DPDP Compliance & Tamper-Evident Audit Logging           │
└──────────────────────────────┬──────────────────────────────┘
                               │ SQLAlchemy 2.0
┌──────────────────────────────▼──────────────────────────────┐
│                    PostgreSQL / SQLite                      │
│  - Users, Insurers, Procedures, ChecklistRules              │
│  - Claims, ChecklistItems, Documents, ExtractedFields       │
│  - TPAQueries, TimelineEvents, AuditLogs                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model & 3-Tier Checklist Inheritance
The checklist engine uses a 3-tier specificity resolution algorithm:
$$\text{Specificity} = (\text{insurer\_id} \neq \text{NULL} ? 1 : 0) + (\text{procedure\_id} \neq \text{NULL} ? 2 : 0)$$

- **Tier 1 (Universal Rules)**: Apply to all admissions (Photo ID, Cashless E-Card).
- **Tier 2 (Insurer-Specific Rules)**: Apply to all admissions for a specific insurer (e.g. Company B requires Indoor Case Paper).
- **Tier 3 (Insurer × Procedure Rules)**: Apply to specific procedure under specific insurer (e.g. Company B + Gall Bladder Lap Chole requires Abdominal Ultrasound Report; Company B + Total Knee Replacement requires Standing Knee X-Ray).

When a new admission is registered via `POST /api/v1/claims`, `sync_claim_checklist` automatically materializes these checklist items onto the claim.

---

## 4. Human-In-The-Loop AI Guardrails & DPDP Compliance
1. **Confidence Threshold ($0.75$)**: Any scan with classification confidence $< 0.75$ is quarantined into the Manual Review Tray.
2. **Pending Field Lock**: AI extracted values remain `PENDING` until a human Desk Executive clicks `Confirm` or edits the value. The Submission Gatekeeper prevents transmission while unconfirmed fields exist.
3. **Desk Head Waiver**: Mandatory slots can only be waived by users with the `DESK_HEAD` role, requiring a mandatory written justification recorded in the immutable audit log.
4. **DPDP PII Protection**: Policy numbers are masked by default (`XXXX-XXXX-last4`). Clicking "Reveal" triggers `POST /api/v1/claims/{id}/audit-unmask` and records an immutable audit log entry.
5. **ReportLab Consolidated PDF Packet**: Compiles all verified documents, checklist status, and patient demographics into a single merged packet matching insurer requirements.
