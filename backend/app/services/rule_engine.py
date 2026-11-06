import uuid
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import ChecklistRule, Claim, ClaimChecklistItem, ClaimExtractedField

STAGE_ORDER = {
    "DRAFT": 0,
    "PRE_AUTH": 1,
    "PREAUTH_SENT": 1,
    "QUERY": 1,
    "APPROVED": 2,
    "ENHANCEMENT": 2,
    "FINAL_BILL": 3,
    "DISCHARGE": 3,
    "SETTLED": 4,
}

def evaluate_rules_for_claim(db: Session, insurer_id: str, procedure_id: str) -> list[ChecklistRule]:
    """
    Computes the 3-tier inherited checklist rules for an (Insurer, Procedure) pair:
    1. Universal Hospital Rules (insurer_id IS NULL, procedure_id IS NULL)
    2. Insurer-Specific Rules (insurer_id == X, procedure_id IS NULL)
    3. Procedure-Specific Rules (insurer_id == X, procedure_id == Y) or (insurer_id IS NULL, procedure_id == Y)
    Deduplicates by slot_key, allowing more specific rules to override universal rules.
    """
    all_matching = (
        db.query(ChecklistRule)
        .filter(
            (ChecklistRule.insurer_id.is_(None) & ChecklistRule.procedure_id.is_(None))
            | (ChecklistRule.insurer_id == insurer_id) & ChecklistRule.procedure_id.is_(None)
            | (ChecklistRule.insurer_id.is_(None) & (ChecklistRule.procedure_id == procedure_id))
            | ((ChecklistRule.insurer_id == insurer_id) & (ChecklistRule.procedure_id == procedure_id))
        )
        .order_by(ChecklistRule.sort_order.asc())
        .all()
    )

    merged_by_key: dict[str, ChecklistRule] = {}
    for rule in all_matching:
        specificity = (1 if rule.insurer_id else 0) + (2 if rule.procedure_id else 0)
        existing = merged_by_key.get(rule.slot_key)
        if not existing:
            merged_by_key[rule.slot_key] = rule
        else:
            existing_spec = (1 if existing.insurer_id else 0) + (2 if existing.procedure_id else 0)
            if specificity >= existing_spec:
                merged_by_key[rule.slot_key] = rule

    return sorted(merged_by_key.values(), key=lambda r: r.sort_order)

def sync_claim_checklist(db: Session, claim: Claim):
    """Materializes or updates checklist slots for a claim without losing existing verified documents."""
    rules = evaluate_rules_for_claim(db, claim.insurer_id, claim.procedure_id)
    existing_by_key = {item.slot_key: item for item in claim.checklist_items}

    for rule in rules:
        if rule.slot_key not in existing_by_key:
            db.add(
                ClaimChecklistItem(
                    id=f"CHK-{uuid.uuid4().hex[:8].upper()}",
                    claim_id=claim.id,
                    slot_key=rule.slot_key,
                    slot_label=rule.slot_label,
                    stage_required=rule.stage_required,
                    is_mandatory=rule.is_mandatory,
                    status="MISSING",
                    sort_order=rule.sort_order,
                )
            )
        else:
            item = existing_by_key[rule.slot_key]
            item.slot_label = rule.slot_label
            item.is_mandatory = rule.is_mandatory
            item.stage_required = rule.stage_required
    db.commit()

def calculate_claim_gaps(claim: Claim) -> dict:
    """Returns exact missing documents and unconfirmed AI fields blocking submission."""
    missing_mandatory = [
        item.slot_label
        for item in sorted(claim.checklist_items, key=lambda x: x.sort_order)
        if item.is_mandatory and item.status in ("MISSING", "UPLOADED_UNVERIFIED")
    ]
    unconfirmed_fields = [
        f.field_label
        for f in claim.extracted_fields
        if f.status == "PENDING"
    ]
    quarantined_docs = [
        d.file_name
        for d in claim.documents
        if d.needs_manual_sorting
    ]
    total_mandatory = sum(1 for i in claim.checklist_items if i.is_mandatory)
    verified_mandatory = sum(
        1 for i in claim.checklist_items if i.is_mandatory and i.status in ("VERIFIED", "WAIVED_BY_HEAD")
    )
    return {
        "missing_mandatory_documents": missing_mandatory,
        "unconfirmed_ai_fields": unconfirmed_fields,
        "quarantined_documents": quarantined_docs,
        "total_mandatory": total_mandatory,
        "verified_mandatory": verified_mandatory,
        "is_ready_for_submission": len(missing_mandatory) == 0 and len(unconfirmed_fields) == 0,
    }

def validate_submission_gatekeeper(claim: Claim, target_status: str):
    """
    Blocks state transitions (e.g. to PREAUTH_SENT, APPROVED, FINAL_BILL, SETTLED)
    if mandatory checklist documents are missing or AI fields are unverified.
    """
    gated_targets = {"PREAUTH_SENT", "APPROVED", "FINAL_BILL", "SETTLED"}
    if target_status not in gated_targets:
        return

    gaps = calculate_claim_gaps(claim)
    if not gaps["is_ready_for_submission"]:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Submission Gatekeeper Blocked Transition: Mandatory items are incomplete.",
                "missing_mandatory_documents": gaps["missing_mandatory_documents"],
                "unconfirmed_ai_fields": gaps["unconfirmed_ai_fields"],
            },
        )
