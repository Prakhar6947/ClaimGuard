import os
from fastapi.testclient import TestClient
from app.main import app
from app.seed import seed_database
from app.database import Base, engine

# Ensure fresh seeded test database
Base.metadata.drop_all(bind=engine)
seed_database()
client = TestClient(app)

def test_seeded_claims_and_gap_engine():
    """1. Verifies CLM-3381, CLM-3382, CLM-3385 match the brief's exact specifications."""
    res = client.get("/api/v1/claims")
    assert res.status_code == 200
    data = res.json()
    claims_by_id = {c["id"]: c for c in data["claims"]}

    # CLM-3381: Demo Patient A | Company B (TPA) | Gall bladder removal | Query | Missing Ultrasound report
    assert "CLM-3381" in claims_by_id
    clm_3381 = claims_by_id["CLM-3381"]
    assert clm_3381["patient_name"] == "Demo Patient A"
    assert clm_3381["status"] == "QUERY"
    assert "Ultrasound report" in clm_3381["gaps"]["missing_mandatory_documents"]
    assert clm_3381["gaps"]["is_ready_for_submission"] is False
    assert clm_3381["deduction_risk_inr"] == 14500.0

    # CLM-3382: Demo Patient B | Company C (insurer) | Total knee replacement | Pre-auth sent | Missing: None
    assert "CLM-3382" in claims_by_id
    clm_3382 = claims_by_id["CLM-3382"]
    assert clm_3382["patient_name"] == "Demo Patient B"
    assert clm_3382["status"] == "PREAUTH_SENT"
    assert clm_3382["gaps"]["missing_mandatory_documents"] == []
    assert clm_3382["gaps"]["is_ready_for_submission"] is True

    # CLM-3385: Demo Patient C | Company D (TPA) | Dengue | Enhancement | Missing: Latest platelet count
    assert "CLM-3385" in claims_by_id
    clm_3385 = claims_by_id["CLM-3385"]
    assert clm_3385["patient_name"] == "Demo Patient C"
    assert clm_3385["status"] == "ENHANCEMENT"
    assert "Latest platelet count" in clm_3385["gaps"]["missing_mandatory_documents"]

def test_auth_login_valid_and_invalid_credentials():
    """2. Verifies /api/v1/auth/login authenticates valid staff passwords and rejects bad credentials."""
    # Valid login for Desk Exec
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "demo.exec@example.invalid", "password": "ClaimGuard@2026"},
    )
    assert res.status_code == 200
    body = res.json()
    assert "access_token" in body
    assert body["user"]["role"] == "DESK_EXEC"
    assert body["user"]["full_name"] == "Demo Executive"

    # Valid login for Desk Head
    res_head = client.post(
        "/api/v1/auth/login",
        json={"email": "demo.head@example.invalid", "password": "ClaimGuard@2026"},
    )
    assert res_head.status_code == 200
    assert res_head.json()["user"]["role"] == "DESK_HEAD"

    # Invalid password -> 401
    res_bad = client.post(
        "/api/v1/auth/login",
        json={"email": "demo.exec@example.invalid", "password": "WrongPassword123"},
    )
    assert res_bad.status_code == 401

    # Non-existent user -> 401
    res_none = client.post(
        "/api/v1/auth/login",
        json={"email": "unknown@hospital.in", "password": "ClaimGuard@2026"},
    )
    assert res_none.status_code == 401

def test_create_new_claim_materializes_checklist_rules():
    """3. Tests POST /api/v1/claims creates a new admission and automatically materializes 3-tier rules."""
    new_claim_payload = {
        "patient_name": "Demo Patient E",
        "patient_age": 54,
        "patient_gender": "M",
        "uhid": "NSK-2026-9420",
        "ward_bed": "Surg-2A / Bed 07",
        "policy_number_full": "DEMO-POLICY-TEST",
        "insurer_id": "INS-COMP-B",
        "procedure_id": "PROC-GALL",
        "treating_doctor_name": "Dr. Demo One",
        "estimated_amount_inr": 79500.0,
        "assigned_exec_name": "Demo Executive",
    }
    res = client.post("/api/v1/claims", json=new_claim_payload)
    assert res.status_code == 200
    claim = res.json()

    assert claim["patient_name"] == "Demo Patient E"
    assert claim["policy_number_masked"] == "XXXX-XXXX-TEST"
    assert claim["policy_number_full"] == "DEMO-POLICY-TEST"
    assert claim["status"] == "DRAFT"

    # Verify 3-tier rule engine materialized checklist items:
    # Universal: PHOTO_ID_KYC, POLICY_ECARD, SIGNED_PREAUTH_FORM
    # Insurer B: ICP_ADMISSION_NOTE
    # Insurer B x Gall Bladder: USG_ABDOMEN, LFT_BLOOD_REPORT
    slots = {item["slot_key"]: item for item in claim["checklist_items"]}
    assert "PHOTO_ID_KYC" in slots
    assert "POLICY_ECARD" in slots
    assert "ICP_ADMISSION_NOTE" in slots
    assert "USG_ABDOMEN" in slots
    assert slots["USG_ABDOMEN"]["is_mandatory"] is True

def test_submission_gatekeeper_blocks_incomplete_claim():
    """4. Verifies gatekeeper blocks transition to PREAUTH_SENT while mandatory documents remain missing."""
    res = client.post(
        "/api/v1/claims/CLM-3381/transition",
        json={"target_status": "PREAUTH_SENT", "actor_name": "Demo Executive", "actor_role": "DESK_EXEC"},
    )
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert "Ultrasound report" in detail["missing_mandatory_documents"]

def test_upload_ultrasound_and_confirm_field_unlocks_gatekeeper():
    """5. Uploads ultrasound scan to CLM-3381, confirms unverified AI field, and verifies gatekeeper unlocks."""
    # Step A: Upload Ultrasound PDF
    files = {"file": ("CLM3381_Abdominal_Ultrasound_USG_Report.pdf", b"%PDF-1.4 Ultrasound Calculus Report", "application/pdf")}
    res_upload = client.post("/api/v1/claims/CLM-3381/documents/upload", files=files)
    assert res_upload.status_code == 200
    claim_after_upload = res_upload.json()

    # Ultrasound report is now uploaded and verified by AI
    usg_item = [i for i in claim_after_upload["checklist_items"] if i["slot_key"] == "USG_ABDOMEN"][0]
    assert usg_item["status"] == "VERIFIED"

    # Step B: Confirm the PENDING AI extracted field FLD-3381-2
    pending_fields = [f for f in claim_after_upload["extracted_fields"] if f["status"] == "PENDING"]
    for pf in pending_fields:
        res_confirm = client.post(
            f"/api/v1/claims/CLM-3381/fields/{pf['id']}/confirm",
            json={"confirmed_value": pf["ai_suggested_value"], "actor_name": "Demo Executive", "actor_role": "DESK_EXEC"},
        )
        assert res_confirm.status_code == 200

    # Step C: Verify gatekeeper is unlocked
    res_claim = client.get("/api/v1/claims/CLM-3381")
    updated_claim = res_claim.json()
    assert updated_claim["gaps"]["missing_mandatory_documents"] == []
    assert updated_claim["gaps"]["unconfirmed_ai_fields"] == []
    assert updated_claim["gaps"]["is_ready_for_submission"] is True

    # Step D: Gatekeeper transition succeeds
    res_trans = client.post(
        "/api/v1/claims/CLM-3381/transition",
        json={"target_status": "PREAUTH_SENT", "actor_name": "Demo Executive", "actor_role": "DESK_EXEC"},
    )
    assert res_trans.status_code == 200
    assert res_trans.json()["status"] == "PREAUTH_SENT"

def test_low_confidence_ai_upload_routes_to_manual_quarantine_tray():
    """6. Verifies ambiguous scans (< 0.75 confidence) are quarantined and can be manually reassigned."""
    files = {"file": ("blurry_low_contrast_scan.pdf", b"%PDF-1.4 blurry scan content", "application/pdf")}
    res = client.post("/api/v1/claims/CLM-3381/documents/upload", files=files)
    assert res.status_code == 200
    claim_data = res.json()

    doc = [d for d in claim_data["documents"] if d["file_name"] == "blurry_low_contrast_scan.pdf"][0]
    assert doc["needs_manual_sorting"] is True
    assert doc["assigned_slot_key"] is None
    assert doc["ai_confidence"] < 0.75

    # Human reassignment to slot
    res_reassign = client.post(
        f"/api/v1/claims/CLM-3381/documents/{doc['id']}/reassign",
        json={"target_slot_key": "PHOTO_ID_KYC", "actor_name": "Demo Executive", "actor_role": "DESK_EXEC"},
    )
    assert res_reassign.status_code == 200
    reassigned_doc = [d for d in res_reassign.json()["documents"] if d["id"] == doc["id"]][0]
    assert reassigned_doc["needs_manual_sorting"] is False
    assert reassigned_doc["assigned_slot_key"] == "PHOTO_ID_KYC"

def test_rbac_blocks_desk_exec_and_allows_desk_head_waiver():
    """7. Verifies DPDP RBAC: DESK_EXEC cannot waive mandatory slots (403), while DESK_HEAD can (200)."""
    # DESK_EXEC attempt -> 403 Forbidden
    res_exec = client.post(
        "/api/v1/claims/CLM-3381/checklist/CHK-3381-1/waive",
        json={"waiver_reason": "Executive attempting waiver", "actor_name": "Demo Executive", "actor_role": "DESK_EXEC"},
    )
    assert res_exec.status_code == 403

    # DESK_HEAD waiver -> 200 OK
    res_head = client.post(
        "/api/v1/claims/CLM-3381/checklist/CHK-3381-1/waive",
        json={"waiver_reason": "Identity verification completed through the approved workflow", "actor_name": "Demo Desk Head", "actor_role": "DESK_HEAD"},
    )
    assert res_head.status_code == 200
    waived_item = [i for i in res_head.json()["checklist_items"] if i["id"] == "CHK-3381-1"][0]
    assert waived_item["status"] == "WAIVED_BY_HEAD"
    assert waived_item["waiver_reason"] == "Identity verification completed through the approved workflow"

def test_tpa_query_webhook_and_doctor_mobile_signoff():
    """8. Tests inbound TPA query simulation, mobile doctor justification sign-off, and query resolution."""
    # Simulate TPA query arriving via webhook on CLM-3382
    res_sim = client.post("/api/v1/webhooks/simulate-tpa-query/CLM-3382")
    assert res_sim.status_code == 200
    claim_queried = res_sim.json()
    assert claim_queried["status"] == "QUERY"
    assert len(claim_queried["queries"]) > 0
    query = claim_queried["queries"][0]

    # Treating doctor signs note via mobile magic-link endpoint
    res_doc = client.post(
        f"/api/v1/doctor/magic-link/{query['id']}/sign",
        json={
            "clinical_justification": "Patient requires inpatient total knee replacement due to severe tricompartmental osteoarthritis.",
            "doctor_name": "Dr. Demo Two",
        },
    )
    assert res_doc.status_code == 200
    signed_query = [q for q in res_doc.json()["queries"] if q["id"] == query["id"]][0]
    assert signed_query["doctor_note_signed"] is True

    # Dispatch human-reviewed reply to TPA
    res_reply = client.post(
        f"/api/v1/queries/{query['id']}/reply",
        json={"reply_text": "Clarification submitted with surgeon justification.", "actor_name": "Demo Executive", "actor_role": "DESK_EXEC"},
    )
    assert res_reply.status_code == 200
    resolved_query = [q for q in res_reply.json()["queries"] if q["id"] == query["id"]][0]
    assert resolved_query["status"] == "RESOLVED"

def test_merged_pdf_packet_generation():
    """9. Tests ReportLab consolidated TPA Submission Packet PDF generation."""
    res = client.get("/api/v1/claims/CLM-3382/packet.pdf")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF-")
    assert len(res.content) > 1000

def test_document_file_endpoint_and_pii_unmask_audit():
    """10. Tests GET document file preview endpoint and POST audit-unmask DPDP tracking."""
    # Test PII unmask audit logging
    res_unmask = client.post(
        "/api/v1/claims/CLM-3381/audit-unmask",
        json={"actor_name": "Demo Executive", "actor_role": "DESK_EXEC"},
    )
    assert res_unmask.status_code == 200
    assert res_unmask.json()["policy_number_full"] == "DEMO-POLICY-3381"

    # Verify audit trail logs the DPDP unmask event
    res_logs = client.get("/api/v1/audit-logs")
    assert res_logs.status_code == 200
    logs = res_logs.json()
    unmask_logs = [l for l in logs if l["action"] == "DPDP_PII_POLICY_UNMASKED" and l["claim_id"] == "CLM-3381"]
    assert len(unmask_logs) > 0

    # Test downloading sample medical scan
    res_sample = client.get("/api/v1/sample-docs/CLM3381_Abdominal_Ultrasound_USG_Report.pdf")
    assert res_sample.status_code == 200
    assert res_sample.headers["content-type"] == "application/pdf"

    # Test document file retrieval endpoint for uploaded documents
    claim = client.get("/api/v1/claims/CLM-3381").json()
    assert len(claim["documents"]) > 0
    doc_id = claim["documents"][0]["id"]
    res_file = client.get(f"/api/v1/claims/CLM-3381/documents/{doc_id}/file")
    assert res_file.status_code == 200
    assert len(res_file.content) > 0
