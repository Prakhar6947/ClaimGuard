from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from app.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # DESK_EXEC, DESK_HEAD, DOCTOR
    department = Column(String, nullable=True)

class Insurer(Base):
    __tablename__ = "insurers"
    id = Column(String, primary_key=True)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)  # e.g., Company B (TPA)
    kind = Column(String, nullable=False)  # TPA or INSURER
    preauth_sla_mins = Column(Integer, default=60)     # IRDAI 1-hour mandate
    discharge_sla_mins = Column(Integer, default=180)  # IRDAI 3-hour mandate
    format_notes = Column(String, nullable=True)

class Procedure(Base):
    __tablename__ = "procedures"
    id = Column(String, primary_key=True)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)  # e.g., Gall bladder removal
    department = Column(String, nullable=False)
    avg_tariff_inr = Column(Float, nullable=False)

class ChecklistRule(Base):
    """
    3-Tier Inheritance:
    - insurer_id=None, procedure_id=None -> Universal hospital rule (e.g., Photo ID, Policy Card)
    - insurer_id=X, procedure_id=None    -> Insurer-specific rule (e.g., Company B ICP Sheet)
    - insurer_id=X, procedure_id=Y       -> Insurer x Procedure rule (e.g., Company B + Gall Bladder -> Ultrasound Report)
    """
    __tablename__ = "checklist_rules"
    id = Column(String, primary_key=True)
    insurer_id = Column(String, ForeignKey("insurers.id"), nullable=True)
    procedure_id = Column(String, ForeignKey("procedures.id"), nullable=True)
    slot_key = Column(String, nullable=False)
    slot_label = Column(String, nullable=False)
    stage_required = Column(String, nullable=False, default="PRE_AUTH")  # PRE_AUTH, ENHANCEMENT, DISCHARGE
    is_mandatory = Column(Boolean, default=True)
    sort_order = Column(Integer, default=10)

class Claim(Base):
    __tablename__ = "claims"
    id = Column(String, primary_key=True)  # e.g., CLM-3381
    patient_name = Column(String, nullable=False)
    uhid = Column(String, nullable=False)
    patient_age = Column(Integer, nullable=False)
    patient_gender = Column(String, nullable=False)
    policy_number_full = Column(String, nullable=False)
    policy_number_masked = Column(String, nullable=False)
    insurer_id = Column(String, ForeignKey("insurers.id"), nullable=False)
    procedure_id = Column(String, ForeignKey("procedures.id"), nullable=False)
    treating_doctor_name = Column(String, nullable=False)
    ward_bed = Column(String, nullable=False)
    admission_at = Column(DateTime, default=utcnow)
    estimated_amount_inr = Column(Float, nullable=False)
    approved_amount_inr = Column(Float, default=0.0)
    deduction_risk_inr = Column(Float, default=0.0)
    status = Column(String, nullable=False)
    # Status values: DRAFT, PREAUTH_SENT, QUERY, ENHANCEMENT, APPROVED, FINAL_BILL, SETTLED
    stage_entered_at = Column(DateTime, default=utcnow)
    sla_deadline_at = Column(DateTime, nullable=False)
    hospital_delay_mins = Column(Integer, default=0)  # Internal hospital prep time
    tpa_delay_mins = Column(Integer, default=0)       # External insurer turnaround time
    assigned_exec_name = Column(String, default="Demo Executive")

    insurer = relationship("Insurer")
    procedure = relationship("Procedure")
    checklist_items = relationship("ClaimChecklistItem", back_populates="claim", cascade="all, delete-orphan")
    documents = relationship("ClaimDocument", back_populates="claim", cascade="all, delete-orphan")
    extracted_fields = relationship("ClaimExtractedField", back_populates="claim", cascade="all, delete-orphan")
    queries = relationship("TPAQuery", back_populates="claim", cascade="all, delete-orphan")
    timeline_events = relationship("ClaimTimelineEvent", back_populates="claim", cascade="all, delete-orphan")

class ClaimChecklistItem(Base):
    __tablename__ = "claim_checklist_items"
    id = Column(String, primary_key=True)
    claim_id = Column(String, ForeignKey("claims.id"), nullable=False)
    slot_key = Column(String, nullable=False)
    slot_label = Column(String, nullable=False)
    stage_required = Column(String, nullable=False)  # PRE_AUTH, ENHANCEMENT, DISCHARGE
    is_mandatory = Column(Boolean, default=True)
    status = Column(String, nullable=False, default="MISSING")
    # Status: MISSING, UPLOADED_UNVERIFIED, VERIFIED, WAIVED_BY_HEAD
    document_id = Column(String, ForeignKey("claim_documents.id"), nullable=True)
    verified_by = Column(String, nullable=True)
    waiver_reason = Column(String, nullable=True)
    sort_order = Column(Integer, default=10)

    claim = relationship("Claim", back_populates="checklist_items")
    document = relationship("ClaimDocument")

class ClaimDocument(Base):
    __tablename__ = "claim_documents"
    id = Column(String, primary_key=True)
    claim_id = Column(String, ForeignKey("claims.id"), nullable=False)
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    mime_type = Column(String, default="application/pdf")
    ai_predicted_slot_key = Column(String, nullable=True)
    assigned_slot_key = Column(String, nullable=True)  # None if quarantined in Manual Review Tray
    ai_confidence = Column(Float, default=0.0)
    is_handwritten = Column(Boolean, default=False)
    needs_manual_sorting = Column(Boolean, default=False)
    uploaded_at = Column(DateTime, default=utcnow)

    claim = relationship("Claim", back_populates="documents")

class ClaimExtractedField(Base):
    __tablename__ = "claim_extracted_fields"
    id = Column(String, primary_key=True)
    claim_id = Column(String, ForeignKey("claims.id"), nullable=False)
    document_id = Column(String, ForeignKey("claim_documents.id"), nullable=True)
    field_key = Column(String, nullable=False)
    field_label = Column(String, nullable=False)
    ai_suggested_value = Column(String, nullable=False)
    confirmed_value = Column(String, nullable=True)
    source_snippet = Column(String, nullable=False)
    source_page = Column(Integer, default=1)
    confidence = Column(Float, default=0.9)
    status = Column(String, default="PENDING")  # PENDING, CONFIRMED, EDITED
    confirmed_by = Column(String, nullable=True)

    claim = relationship("Claim", back_populates="extracted_fields")

class TPAQuery(Base):
    __tablename__ = "tpa_queries"
    id = Column(String, primary_key=True)
    claim_id = Column(String, ForeignKey("claims.id"), nullable=False)
    tpa_reference_no = Column(String, nullable=False)
    sender_email = Column(String, nullable=False)
    raw_subject = Column(String, nullable=False)
    raw_email_body = Column(Text, nullable=False)
    ai_summary = Column(Text, nullable=False)
    ai_action_items = Column(JSON, default=list)
    missing_slot_key = Column(String, nullable=True)
    received_at = Column(DateTime, default=utcnow)
    reply_due_at = Column(DateTime, nullable=False)
    draft_reply = Column(Text, nullable=True)
    doctor_magic_token = Column(String, nullable=True)
    doctor_note_signed = Column(Boolean, default=False)
    doctor_justification_text = Column(Text, nullable=True)
    status = Column(String, default="OPEN")  # OPEN, READY_TO_SEND, RESOLVED

    claim = relationship("Claim", back_populates="queries")

class ClaimTimelineEvent(Base):
    __tablename__ = "claim_timeline_events"
    id = Column(String, primary_key=True)
    claim_id = Column(String, ForeignKey("claims.id"), nullable=False)
    stage = Column(String, nullable=False)
    title = Column(String, nullable=False)
    detail = Column(String, nullable=False)
    actor_name = Column(String, nullable=False)
    actor_role = Column(String, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    claim = relationship("Claim", back_populates="timeline_events")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String, primary_key=True)
    claim_id = Column(String, nullable=True)
    actor_name = Column(String, nullable=False)
    actor_role = Column(String, nullable=False)
    action = Column(String, nullable=False)
    details = Column(String, nullable=False)
    created_at = Column(DateTime, default=utcnow)
