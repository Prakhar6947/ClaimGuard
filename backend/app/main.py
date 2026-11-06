import os
import uuid
from typing import Optional
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import (
    User, Insurer, Procedure, ChecklistRule, Claim, ClaimChecklistItem,
    ClaimDocument, ClaimExtractedField, TPAQuery, ClaimTimelineEvent, AuditLog
)
from app.schemas import (
    LoginRequest, VerifyFieldRequest, ReassignDocSlotRequest,
    WaiveChecklistSlotRequest, TransitionStatusRequest,
    QueryReplyRequest, DoctorSignOffRequest, CreateChecklistRuleRequest,
    CreateClaimRequest, AuditUnmaskRequest
)
from app.auth import verify_password, create_access_token, require_desk_head
from app.services.rule_engine import (
    calculate_claim_gaps, validate_submission_gatekeeper, sync_claim_checklist
)
from app.services.ai_service import (
    classify_and_extract_document, parse_incoming_tpa_query_email
)
from app.services.pdf_packet import build_merged_tpa_packet_pdf
from app.seed import seed_database

app = FastAPI(
    title="ClaimGuard — Cashless Claims & TPA Workspace API",
    version="1.0.0",
    description="Backend API for Nashik Multispeciality Hospital Cashless Claims & TPA Tracking Workspace",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    seed_database()

def serialize_claim(claim: Claim) -> dict:
    gaps = calculate_claim_gaps(claim)
    now = datetime.now(timezone.utc)
    deadline = claim.sla_deadline_at
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    remaining_seconds = int((deadline - now).total_seconds())

    return {
        "id": claim.id,
        "patient_name": claim.patient_name,
        "uhid": claim.uhid,
        "patient_age": claim.patient_age,
        "patient_gender": claim.patient_gender,
        "policy_number_masked": claim.policy_number_masked,
        "policy_number_full": claim.policy_number_full,
        "insurer": {
            "id": claim.insurer.id,
            "name": claim.insurer.name,
            "kind": claim.insurer.kind,
            "preauth_sla_mins": claim.insurer.preauth_sla_mins,
            "discharge_sla_mins": claim.insurer.discharge_sla_mins,
            "format_notes": claim.insurer.format_notes,
        },
        "procedure": {
            "id": claim.procedure.id,
            "code": claim.procedure.code,
            "name": claim.procedure.name,
            "department": claim.procedure.department,
        },
        "treating_doctor_name": claim.treating_doctor_name,
        "ward_bed": claim.ward_bed,
        "estimated_amount_inr": claim.estimated_amount_inr,
        "approved_amount_inr": claim.approved_amount_inr,
        "deduction_risk_inr": claim.deduction_risk_inr,
        "status": claim.status,
        "sla_remaining_seconds": remaining_seconds,
        "hospital_delay_mins": claim.hospital_delay_mins,
        "tpa_delay_mins": claim.tpa_delay_mins,
        "assigned_exec_name": claim.assigned_exec_name,
        "gaps": gaps,
        "checklist_items": [
            {
                "id": i.id,
                "slot_key": i.slot_key,
                "slot_label": i.slot_label,
                "stage_required": i.stage_required,
                "is_mandatory": i.is_mandatory,
                "status": i.status,
                "document_id": i.document_id,
                "verified_by": i.verified_by,
                "waiver_reason": i.waiver_reason,
                "sort_order": i.sort_order,
            }
            for i in sorted(claim.checklist_items, key=lambda x: x.sort_order)
        ],
        "documents": [
            {
                "id": d.id,
                "file_name": d.file_name,
                "ai_predicted_slot_key": d.ai_predicted_slot_key,
                "assigned_slot_key": d.assigned_slot_key,
                "ai_confidence": d.ai_confidence,
                "is_handwritten": d.is_handwritten,
                "needs_manual_sorting": d.needs_manual_sorting,
                "uploaded_at": d.uploaded_at.isoformat(),
            }
            for d in claim.documents
        ],
        "extracted_fields": [
            {
                "id": f.id,
                "field_key": f.field_key,
                "field_label": f.field_label,
                "ai_suggested_value": f.ai_suggested_value,
                "confirmed_value": f.confirmed_value,
                "source_snippet": f.source_snippet,
                "source_page": f.source_page,
                "confidence": f.confidence,
                "status": f.status,
                "confirmed_by": f.confirmed_by,
            }
            for f in claim.extracted_fields
        ],
        "queries": [
            {
                "id": q.id,
                "claim_id": q.claim_id,
                "tpa_reference_no": q.tpa_reference_no,
                "sender_email": q.sender_email,
                "raw_subject": q.raw_subject,
                "raw_email_body": q.raw_email_body,
                "ai_summary": q.ai_summary,
                "ai_action_items": q.ai_action_items,
                "missing_slot_key": q.missing_slot_key,
                "received_at": q.received_at.isoformat(),
                "reply_due_at": q.reply_due_at.isoformat(),
                "draft_reply": q.draft_reply,
                "doctor_magic_token": q.doctor_magic_token,
                "doctor_note_signed": q.doctor_note_signed,
                "doctor_justification_text": q.doctor_justification_text,
                "status": q.status,
            }
            for q in claim.queries
        ],
        "timeline_events": [
            {
                "id": e.id,
                "stage": e.stage,
                "title": e.title,
                "detail": e.detail,
                "actor_name": e.actor_name,
                "actor_role": e.actor_role,
                "created_at": e.created_at.isoformat(),
            }
            for e in sorted(claim.timeline_events, key=lambda x: x.created_at, reverse=True)
        ],
    }

@app.get("/api/v1/health")
def health_check():
    return {"status": "ok", "service": "ClaimGuard Nashik API", "region": "ap-south-1"}

AUTH_EMAIL_ALIASES = {
    "exec@companya-hospital.in": "demo.exec@example.invalid",
    "head@companya-hospital.in": "demo.head@example.invalid",
    "doctor@companya-hospital.in": "demo.doctor@example.invalid",
    "demo.exec@example.invalid": "exec@companya-hospital.in",
    "demo.head@example.invalid": "head@companya-hospital.in",
    "demo.doctor@example.invalid": "doctor@companya-hospital.in",
}

@app.post("/api/v1/auth/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    clean_email = (payload.email or "").strip().lower()
    clean_password = (payload.password or "").strip()

    # 1. Direct case-insensitive match
    user = db.query(User).filter(func.lower(User.email) == clean_email).first()

    # 2. Alias lookup if user not found directly
    if not user and clean_email in AUTH_EMAIL_ALIASES:
        alias_target = AUTH_EMAIL_ALIASES[clean_email]
        user = db.query(User).filter(func.lower(User.email) == alias_target).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Verify password against raw and trimmed input
    if not (verify_password(payload.password, user.password_hash) or verify_password(clean_password, user.password_hash)):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": user.email, "role": user.role, "name": user.full_name})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "department": user.department,
        },
    }

@app.get("/api/v1/claims")
def list_claims(status: str | None = None, search: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Claim)
    if status and status != "ALL":
        q = q.filter(Claim.status == status)
    claims = q.all()
    serialized = [serialize_claim(c) for c in claims]
    if search:
        s = search.lower()
        serialized = [
            c for c in serialized
            if s in c["id"].lower()
            or s in c["patient_name"].lower()
            or s in c["insurer"]["name"].lower()
            or s in c["procedure"]["name"].lower()
        ]

    # Compute hospital operational KPIs tied directly to client brief numbers
    open_queries = sum(1 for c in serialized for q in c["queries"] if q["status"] != "RESOLVED")
    total_deduction_risk = sum(c["deduction_risk_inr"] for c in serialized)
    avg_hospital_prep = (
        round(sum(c["hospital_delay_mins"] for c in serialized) / len(serialized))
        if serialized else 0
    )

    return {
        "kpis": {
            "active_claims_count": len(serialized),
            "claims_with_missing_docs": sum(1 for c in serialized if len(c["gaps"]["missing_mandatory_documents"]) > 0),
            "open_tpa_queries": open_queries,
            "deduction_risk_protected_inr": total_deduction_risk,
            "avg_hospital_prep_mins": avg_hospital_prep,
            "annual_leakage_target_lakhs": 63.57,
        },
        "claims": serialized,
    }

@app.get("/api/v1/claims/{claim_id}")
def get_claim_detail(claim_id: str, db: Session = Depends(get_db)):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return serialize_claim(claim)

@app.post("/api/v1/claims")
def create_new_claim(payload: CreateClaimRequest, db: Session = Depends(get_db)):
    """Creates a new cashless admission and automatically materializes its 3-tier Insurer x Procedure checklist."""
    insurer = db.query(Insurer).filter(Insurer.id == payload.insurer_id).first()
    procedure = db.query(Procedure).filter(Procedure.id == payload.procedure_id).first()
    if not insurer or not procedure:
        raise HTTPException(status_code=400, detail="Invalid insurer or procedure ID")

    now = datetime.now(timezone.utc)
    claim_num = 3390 + db.query(Claim).count()
    new_id = f"CLM-{claim_num}"
    clean_pol = payload.policy_number_full.strip()
    masked_pol = f"XXXX-XXXX-{clean_pol[-4:]}"
    actor_name = payload.actor_name if hasattr(payload, 'actor_name') and payload.actor_name else (payload.assigned_exec_name or "Priya Deshpande")
    actor_role = getattr(payload, 'actor_role', 'DESK_EXEC')

    new_claim = Claim(
        id=new_id,
        patient_name=payload.patient_name.strip(),
        uhid=payload.uhid.strip(),
        patient_age=payload.patient_age,
        patient_gender=payload.patient_gender,
        policy_number_full=clean_pol,
        policy_number_masked=masked_pol,
        insurer_id=insurer.id,
        procedure_id=procedure.id,
        treating_doctor_name=payload.treating_doctor_name.strip(),
        ward_bed=payload.ward_bed.strip(),
        admission_at=now,
        estimated_amount_inr=payload.estimated_amount_inr,
        approved_amount_inr=0.0,
        deduction_risk_inr=round(payload.estimated_amount_inr * 0.12, 2),
        status="DRAFT",
        stage_entered_at=now,
        sla_deadline_at=now + timedelta(minutes=insurer.preauth_sla_mins or 60),
        hospital_delay_mins=5,
        tpa_delay_mins=0,
        assigned_exec_name=actor_name,
    )
    db.add(new_claim)
    db.commit()
    db.refresh(new_claim)

    # Run the 3-tier Rule Engine to materialize required checklist slots for (Insurer, Procedure)
    sync_claim_checklist(db, new_claim)

    db.add(
        ClaimTimelineEvent(
            id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            claim_id=new_claim.id,
            stage="DRAFT",
            title="New Cashless Admission Initialized",
            detail=f"Rule Engine materialized checklist for {insurer.name} × {procedure.name}.",
            actor_name=actor_name,
            actor_role=actor_role,
        )
    )
    db.add(
        AuditLog(
            id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
            claim_id=new_claim.id,
            actor_name=actor_name,
            actor_role=actor_role,
            action="NEW_ADMISSION_CREATED",
            details=f"Created {new_claim.id} for {new_claim.patient_name} ({insurer.name} / {procedure.name}).",
        )
    )
    db.commit()
    db.refresh(new_claim)
    return serialize_claim(new_claim)


@app.post("/api/v1/claims/{claim_id}/audit-unmask")
def audit_policy_unmask(
    claim_id: str,
    actor_name: str = "Priya Deshpande",
    actor_role: str = "DESK_EXEC",
    payload: Optional[AuditUnmaskRequest] = None,
    db: Session = Depends(get_db),
):
    """Logs an immutable DPDP Act 2023 audit entry when a user reveals a masked policy number."""
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    eff_actor = payload.actor_name if payload and payload.actor_name else actor_name
    eff_role = payload.actor_role if payload and payload.actor_role else actor_role

    db.add(
        AuditLog(
            id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
            claim_id=claim_id,
            actor_name=eff_actor,
            actor_role=eff_role,
            action="DPDP_PII_POLICY_UNMASKED",
            details=f"Unmasked encrypted policy number ({claim.policy_number_masked}) for verification.",
        )
    )
    db.commit()
    return {
        "status": "logged",
        "claim_id": claim.id,
        "policy_number_full": claim.policy_number_full,
    }

@app.get("/api/v1/claims/{claim_id}/documents/{doc_id}/file")
def get_document_file(claim_id: str, doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(ClaimDocument).filter(ClaimDocument.id == doc_id, ClaimDocument.claim_id == claim_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="File content not found on server")
    return FileResponse(doc.file_path, media_type=doc.mime_type or "application/pdf", filename=doc.file_name)

@app.post("/api/v1/claims/{claim_id}/documents/upload")
async def upload_and_sort_document(
    claim_id: str,
    file: UploadFile = File(...),
    actor_name: str = Form("Demo Executive"),
    actor_role: str = Form("DESK_EXEC"),
    db: Session = Depends(get_db),
):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    content = await file.read()
    safe_name = file.filename or "uploaded_scan.pdf"
    file_path = os.path.join(settings.STORAGE_DIR, f"{claim_id}_{safe_name}")
    with open(file_path, "wb") as f_out:
        f_out.write(content)

    available_slots = [
        {"slot_key": item.slot_key, "slot_label": item.slot_label}
        for item in claim.checklist_items
    ]
    ai_result = classify_and_extract_document(safe_name, content, claim_id, available_slots)

    predicted_slot = ai_result["predicted_slot_key"]
    needs_manual = ai_result["needs_manual_sorting"]
    assigned_slot = None if needs_manual else predicted_slot

    doc_id = f"DOC-{uuid.uuid4().hex[:8].upper()}"
    doc_record = ClaimDocument(
        id=doc_id,
        claim_id=claim.id,
        file_name=safe_name,
        file_path=file_path,
        mime_type=file.content_type or "application/pdf",
        ai_predicted_slot_key=predicted_slot,
        assigned_slot_key=assigned_slot,
        ai_confidence=ai_result["confidence"],
        is_handwritten=ai_result["is_handwritten"],
        needs_manual_sorting=needs_manual,
    )
    db.add(doc_record)

    # If AI confidence >= 0.75, link document to the predicted checklist slot
    if not needs_manual and assigned_slot:
        target_item = (
            db.query(ClaimChecklistItem)
            .filter(ClaimChecklistItem.claim_id == claim.id, ClaimChecklistItem.slot_key == assigned_slot)
            .first()
        )
        if target_item:
            target_item.document_id = doc_id
            target_item.status = "VERIFIED"
            target_item.verified_by = f"AI ({int(ai_result['confidence']*100)}%) + {actor_name}"
            if claim.deduction_risk_inr > 0:
                claim.deduction_risk_inr = 0.0

    # Upsert AI pre-filled fields by field_key so repeated uploads never create duplicate rows
    for ef in ai_result.get("extracted_fields", []):
        existing_field = (
            db.query(ClaimExtractedField)
            .filter(
                ClaimExtractedField.claim_id == claim.id,
                ClaimExtractedField.field_key == ef["field_key"],
            )
            .first()
        )
        if existing_field:
            existing_field.document_id = doc_id
            existing_field.ai_suggested_value = ef["ai_suggested_value"]
            existing_field.source_snippet = ef["source_snippet"]
            existing_field.confidence = ef.get("confidence", 0.9)
        else:
            db.add(
                ClaimExtractedField(
                    id=f"FLD-{uuid.uuid4().hex[:8].upper()}",
                    claim_id=claim.id,
                    document_id=doc_id,
                    field_key=ef["field_key"],
                    field_label=ef["field_label"],
                    ai_suggested_value=ef["ai_suggested_value"],
                    confirmed_value=None,
                    source_snippet=ef["source_snippet"],
                    source_page=ef.get("source_page", 1),
                    confidence=ef.get("confidence", 0.9),
                    status="PENDING",
                )
            )

    db.add(
        ClaimTimelineEvent(
            id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            claim_id=claim.id,
            stage=claim.status,
            title=f"Document Uploaded: {safe_name}",
            detail=(
                f"AI quarantined file for manual sorting (confidence {int(ai_result['confidence']*100)}% < 75%)."
                if needs_manual
                else f"AI sorted into slot '{predicted_slot}' ({int(ai_result['confidence']*100)}% confidence) & extracted {len(ai_result.get('extracted_fields', []))} fields."
            ),
            actor_name=actor_name,
            actor_role=actor_role,
        )
    )
    db.add(
        AuditLog(
            id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
            claim_id=claim.id,
            actor_name=actor_name,
            actor_role=actor_role,
            action="DOCUMENT_UPLOADED_AND_ANALYZED",
            details=f"File '{safe_name}' analyzed (predicted={predicted_slot}, confidence={ai_result['confidence']}, manual_quarantine={needs_manual})",
        )
    )
    db.commit()
    db.refresh(claim)
    return serialize_claim(claim)

@app.post("/api/v1/claims/{claim_id}/documents/{doc_id}/reassign")
def reassign_document_slot(
    claim_id: str,
    doc_id: str,
    payload: ReassignDocSlotRequest,
    db: Session = Depends(get_db),
):
    """When AI is wrong or unsure: allows human drag-and-drop / dropdown reassignment to the right slot."""
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    doc = db.query(ClaimDocument).filter(ClaimDocument.id == doc_id, ClaimDocument.claim_id == claim_id).first()
    if not claim or not doc:
        raise HTTPException(status_code=404, detail="Claim or document not found")

    old_slot = doc.assigned_slot_key
    if old_slot:
        old_item = (
            db.query(ClaimChecklistItem)
            .filter(ClaimChecklistItem.claim_id == claim_id, ClaimChecklistItem.slot_key == old_slot)
            .first()
        )
        if old_item and old_item.document_id == doc.id:
            old_item.document_id = None
            old_item.status = "MISSING"

    new_item = (
        db.query(ClaimChecklistItem)
        .filter(ClaimChecklistItem.claim_id == claim_id, ClaimChecklistItem.slot_key == payload.target_slot_key)
        .first()
    )
    if not new_item:
        raise HTTPException(status_code=400, detail="Target checklist slot does not exist on this claim")

    doc.assigned_slot_key = payload.target_slot_key
    doc.needs_manual_sorting = False
    new_item.document_id = doc.id
    new_item.status = "VERIFIED"
    new_item.verified_by = payload.actor_name

    db.add(
        AuditLog(
            id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
            claim_id=claim_id,
            actor_name=payload.actor_name,
            actor_role=payload.actor_role,
            action="AI_SLOT_CORRECTED_BY_HUMAN",
            details=f"Moved '{doc.file_name}' from '{old_slot or 'QUARANTINE_TRAY'}' to '{payload.target_slot_key}'.",
        )
    )
    db.commit()
    db.refresh(claim)
    return serialize_claim(claim)

@app.post("/api/v1/claims/{claim_id}/fields/{field_id}/confirm")
def confirm_or_edit_extracted_field(
    claim_id: str,
    field_id: str,
    payload: VerifyFieldRequest,
    db: Session = Depends(get_db),
):
    """Human-in-the-loop confirmation or editing of AI pre-filled pre-auth fields."""
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    field = (
        db.query(ClaimExtractedField)
        .filter(ClaimExtractedField.id == field_id, ClaimExtractedField.claim_id == claim_id)
        .first()
    )
    if not claim or not field:
        raise HTTPException(status_code=404, detail="Field not found")

    if payload.confirmed_value and payload.confirmed_value.strip() != field.ai_suggested_value.strip():
        field.confirmed_value = payload.confirmed_value.strip()
        field.status = "EDITED"
    else:
        field.confirmed_value = field.ai_suggested_value
        field.status = "CONFIRMED"

    field.confirmed_by = payload.actor_name

    db.add(
        AuditLog(
            id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
            claim_id=claim_id,
            actor_name=payload.actor_name,
            actor_role=payload.actor_role,
            action=f"AI_FIELD_{field.status}",
            details=f"Field '{field.field_label}' set to '{field.confirmed_value}' (Source: {field.source_snippet[:50]}...)",
        )
    )
    db.commit()
    db.refresh(claim)
    return serialize_claim(claim)

@app.post("/api/v1/claims/{claim_id}/checklist/{item_id}/waive")
def waive_checklist_slot(
    claim_id: str,
    item_id: str,
    payload: WaiveChecklistSlotRequest,
    db: Session = Depends(get_db),
):
    """Restricted to DESK_HEAD: waives a mandatory checklist slot with an audited justification."""
    require_desk_head(payload.actor_role)
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    item = (
        db.query(ClaimChecklistItem)
        .filter(ClaimChecklistItem.id == item_id, ClaimChecklistItem.claim_id == claim_id)
        .first()
    )
    if not claim or not item:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    item.status = "WAIVED_BY_HEAD"
    item.waiver_reason = payload.waiver_reason
    item.verified_by = payload.actor_name

    db.add(
        AuditLog(
            id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
            claim_id=claim_id,
            actor_name=payload.actor_name,
            actor_role=payload.actor_role,
            action="MANDATORY_SLOT_WAIVED_BY_HEAD",
            details=f"Slot '{item.slot_label}' waived. Reason: {payload.waiver_reason}",
        )
    )
    db.commit()
    db.refresh(claim)
    return serialize_claim(claim)

@app.post("/api/v1/claims/{claim_id}/transition")
def transition_claim_status(
    claim_id: str,
    payload: TransitionStatusRequest,
    db: Session = Depends(get_db),
):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    validate_submission_gatekeeper(claim, payload.target_status)

    old_status = claim.status
    claim.status = payload.target_status
    claim.stage_entered_at = datetime.now(timezone.utc)
    if payload.target_status in ("PREAUTH_SENT", "APPROVED", "SETTLED"):
        claim.deduction_risk_inr = 0.0

    db.add(
        ClaimTimelineEvent(
            id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            claim_id=claim.id,
            stage=payload.target_status,
            title=f"Stage Transition: {old_status} → {payload.target_status}",
            detail=f"All mandatory checklist slots and pre-auth fields verified prior to transition.",
            actor_name=payload.actor_name,
            actor_role=payload.actor_role,
        )
    )
    db.add(
        AuditLog(
            id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
            claim_id=claim.id,
            actor_name=payload.actor_name,
            actor_role=payload.actor_role,
            action="CLAIM_STAGE_TRANSITION",
            details=f"Transitioned {claim.id} from {old_status} to {payload.target_status}",
        )
    )
    db.commit()
    db.refresh(claim)
    return serialize_claim(claim)

@app.post("/api/v1/queries/{query_id}/reply")
def send_query_reply(
    query_id: str,
    payload: QueryReplyRequest,
    db: Session = Depends(get_db),
):
    query = db.query(TPAQuery).filter(TPAQuery.id == query_id).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    claim = db.query(Claim).filter(Claim.id == query.claim_id).first()
    gaps = calculate_claim_gaps(claim)
    if not gaps["is_ready_for_submission"]:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Cannot dispatch TPA Query response while mandatory documents or AI fields remain unverified.",
                "missing_mandatory_documents": gaps["missing_mandatory_documents"],
                "unconfirmed_ai_fields": gaps["unconfirmed_ai_fields"],
            },
        )

    query.draft_reply = payload.reply_text
    query.status = "RESOLVED"
    claim.status = "PREAUTH_SENT" if claim.status == "QUERY" else "APPROVED"
    claim.deduction_risk_inr = 0.0

    db.add(
        ClaimTimelineEvent(
            id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            claim_id=claim.id,
            stage=claim.status,
            title=f"TPA Query {query.tpa_reference_no} Resolved & Packet Sent",
            detail="Human-reviewed reply and verified checklist packet transmitted to TPA.",
            actor_name=payload.actor_name,
            actor_role=payload.actor_role,
        )
    )
    db.commit()
    db.refresh(claim)
    return serialize_claim(claim)

@app.post("/api/v1/webhooks/simulate-tpa-query/{claim_id}")
def simulate_incoming_tpa_query(claim_id: str, db: Session = Depends(get_db)):
    """Reviewer Demo Toolkit Endpoint: Simulates a live TPA query email arriving via webhook."""
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    now = datetime.now(timezone.utc)
    subject = f"URGENT TPA CLARIFICATION: {claim.id} ({claim.patient_name}) - {claim.procedure.name}"
    body = (
        f"Dear Hospital Cashless Desk,\n\n"
        f"Regarding Claim {claim.id} under {claim.insurer.name}, our medical adjudication team requires:\n"
        f"1. Verified diagnostic imaging / ultrasound / serial platelet chart supporting emergency admission.\n"
        f"2. Treating consultant's counter-signed clinical note.\n\n"
        f"Please respond within 2 hours to avoid cashless denial.\n\n"
        f"Regards,\nAdjudication Desk — {claim.insurer.name}"
    )
    parsed = parse_incoming_tpa_query_email(subject, body, claim.id)

    new_q = TPAQuery(
        id=f"QRY-{uuid.uuid4().hex[:4].upper()}",
        claim_id=claim.id,
        tpa_reference_no=f"TPA/LIVE/{uuid.uuid4().hex[:5].upper()}",
        sender_email=f"adjudication@{claim.insurer.code.lower()}.in",
        raw_subject=subject,
        raw_email_body=body,
        ai_summary=parsed["ai_summary"],
        ai_action_items=parsed["ai_action_items"],
        missing_slot_key=parsed["missing_slot_key"],
        received_at=now,
        reply_due_at=now + timedelta(minutes=90),
        draft_reply=parsed["draft_reply"],
        doctor_magic_token=f"DOC-TOKEN-{claim.id[-4:]}",
        doctor_note_signed=False,
        status="OPEN",
    )
    claim.status = "QUERY"
    claim.sla_deadline_at = now + timedelta(minutes=90)
    db.add(new_q)
    db.add(
        ClaimTimelineEvent(
            id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            claim_id=claim.id,
            stage="QUERY",
            title="Live TPA Query Email Ingested & Summarized by AI",
            detail=parsed["ai_summary"],
            actor_name="TPA Email Webhook",
            actor_role="SYSTEM",
        )
    )
    db.commit()
    db.refresh(claim)
    return serialize_claim(claim)

@app.post("/api/v1/doctor/magic-link/{query_id}/sign")
def doctor_mobile_sign_off(
    query_id: str,
    payload: DoctorSignOffRequest,
    db: Session = Depends(get_db),
):
    """Screen 7: Treating doctor approves clinical justification from a mobile magic link."""
    query = db.query(TPAQuery).filter(TPAQuery.id == query_id).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    claim = db.query(Claim).filter(Claim.id == query.claim_id).first()
    query.doctor_note_signed = True
    query.doctor_justification_text = payload.clinical_justification

    db.add(
        ClaimTimelineEvent(
            id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            claim_id=claim.id,
            stage=claim.status,
            title=f"Mobile Doctor Sign-Off Completed ({payload.doctor_name})",
            detail=f"Clinical Note: '{payload.clinical_justification[:90]}...'",
            actor_name=payload.doctor_name,
            actor_role="DOCTOR",
        )
    )
    db.add(
        AuditLog(
            id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
            claim_id=claim.id,
            actor_name=payload.doctor_name,
            actor_role="DOCTOR",
            action="DOCTOR_MOBILE_NOTE_SIGNED",
            details=f"Signed clinical justification for query {query.tpa_reference_no}.",
        )
    )
    db.commit()
    db.refresh(claim)
    return serialize_claim(claim)

@app.get("/api/v1/rules")
def list_checklist_rules(db: Session = Depends(get_db)):
    insurers = db.query(Insurer).all()
    procedures = db.query(Procedure).all()
    rules = db.query(ChecklistRule).order_by(ChecklistRule.sort_order.asc()).all()
    return {
        "insurers": [{"id": i.id, "name": i.name, "kind": i.kind} for i in insurers],
        "procedures": [{"id": p.id, "name": p.name, "department": p.department} for p in procedures],
        "rules": [
            {
                "id": r.id,
                "insurer_id": r.insurer_id,
                "procedure_id": r.procedure_id,
                "slot_key": r.slot_key,
                "slot_label": r.slot_label,
                "stage_required": r.stage_required,
                "is_mandatory": r.is_mandatory,
                "sort_order": r.sort_order,
            }
            for r in rules
        ],
    }

@app.post("/api/v1/rules")
def create_checklist_rule(payload: CreateChecklistRuleRequest, db: Session = Depends(get_db)):
    require_desk_head(payload.actor_role)
    new_rule = ChecklistRule(
        id=f"RULE-{uuid.uuid4().hex[:6].upper()}",
        insurer_id=payload.insurer_id or None,
        procedure_id=payload.procedure_id or None,
        slot_key=payload.slot_key.upper().replace(" ", "_"),
        slot_label=payload.slot_label,
        stage_required=payload.stage_required,
        is_mandatory=payload.is_mandatory,
        sort_order=10,
    )
    db.add(new_rule)
    db.commit()

    # Re-sync active claims so new admin rule immediately reflects across matching claims!
    for claim in db.query(Claim).all():
        sync_claim_checklist(db, claim)

    return {"status": "created", "rule_id": new_rule.id}

@app.get("/api/v1/claims/{claim_id}/packet.pdf")
def export_merged_tpa_packet(
    claim_id: str,
    inline: bool = False,
    db: Session = Depends(get_db),
):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    pdf_bytes = build_merged_tpa_packet_pdf(claim)
    db.add(
        AuditLog(
            id=f"AUD-{uuid.uuid4().hex[:8].upper()}",
            claim_id=claim.id,
            actor_name="Demo Executive",
            actor_role="DESK_EXEC",
            action="MERGED_TPA_PACKET_EXPORTED",
            details=f"Generated consolidated TPA PDF packet for {claim.insurer.name}.",
        )
    )
    db.commit()
    disposition = "inline" if inline else "attachment"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{claim.id}_TPA_Submission_Packet.pdf"'
        },
    )

@app.get("/api/v1/sample-docs/{file_name}")
def download_sample_medical_scan(file_name: str):
    file_path = os.path.join(settings.STORAGE_DIR, file_name)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Sample scan not found")
    return FileResponse(file_path, media_type="application/pdf", filename=file_name)

@app.get("/api/v1/audit-logs")
def get_audit_logs(db: Session = Depends(get_db)):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(50).all()
    return [
        {
            "id": l.id,
            "claim_id": l.claim_id,
            "actor_name": l.actor_name,
            "actor_role": l.actor_role,
            "action": l.action,
            "details": l.details,
            "created_at": l.created_at.isoformat(),
        }
        for l in logs
    ]
