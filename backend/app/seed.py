import os
from datetime import datetime, timedelta, timezone
from reportlab.pdfgen import canvas
from app.database import SessionLocal, engine, Base
from app.models import (
    User, Insurer, Procedure, ChecklistRule, Claim, ClaimChecklistItem,
    ClaimDocument, ClaimExtractedField, TPAQuery, ClaimTimelineEvent, AuditLog
)
from app.auth import hash_password
from app.config import settings

def generate_sample_pdf(file_path: str, title: str, lines: list[str]):
    """Generates a realistic medical scan PDF in storage/ so reviewers can download and test uploads."""
    c = canvas.Canvas(file_path)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, 780, "COMPANY A MULTISPECIALITY HOSPITAL — NASHIK DIAGNOSTICS")
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, 755, title)
    c.line(50, 745, 540, 745)
    c.setFont("Helvetica", 10)
    y = 720
    for line in lines:
        c.drawString(50, y, line)
        y -= 20
    c.save()

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Always ensure staff accounts for both hospital and demo domains exist
        staff_users = [
            ("USR-EXEC-01", "Priya Deshpande", "exec@companya-hospital.in", "DESK_EXEC", "Cashless Insurance Desk"),
            ("USR-HEAD-01", "Anand Kulkarni", "head@companya-hospital.in", "DESK_HEAD", "Insurance & TPA Administration"),
            ("USR-DOC-01", "Dr. Sameer Joshi", "doctor@companya-hospital.in", "DOCTOR", "General & Laparoscopic Surgery"),
            ("USR-EXEC-DEMO", "Demo Executive", "demo.exec@example.invalid", "DESK_EXEC", "Cashless Insurance Desk"),
            ("USR-HEAD-DEMO", "Demo Desk Head", "demo.head@example.invalid", "DESK_HEAD", "Insurance & TPA Administration"),
            ("USR-DOC-DEMO", "Dr. Demo One", "demo.doctor@example.invalid", "DOCTOR", "General & Laparoscopic Surgery"),
        ]
        for uid, name, email, role, dept in staff_users:
            u = db.query(User).filter(User.email == email).first()
            if not u:
                u = db.query(User).filter(User.id == uid).first()
            if not u:
                db.add(User(
                    id=uid,
                    full_name=name,
                    email=email,
                    password_hash=hash_password("ClaimGuard@2026"),
                    role=role,
                    department=dept,
                ))
            else:
                u.full_name = name
                u.email = email
                u.password_hash = hash_password("ClaimGuard@2026")
                u.role = role
                u.department = dept
        db.commit()

        if db.query(Claim).count() > 0:
            return

        now = datetime.now(timezone.utc)

        # 0. Create 4 downloadable sample medical scans for the Reviewer Demo Toolkit
        sample_files = {
            "CLM3381_Abdominal_Ultrasound_USG_Report.pdf": (
                "DEPARTMENT OF RADIOLOGY — ABDOMINAL ULTRASOUND (USG) REPORT",
                [
                    "Patient: Demo Patient A | Age/Sex: 52/M | UHID: DEMO-UHID-3381 | Claim: CLM-3381",
                    "Clinical Indication: Acute right upper quadrant pain, rule out biliary calculi.",
                    "Findings:",
                    "1. Gallbladder is distended; multiple mobile calculi noted, largest measuring 14.2 mm in neck region.",
                    "2. Gallbladder wall thickness is increased at 4.8 mm with minimal pericholecystic fluid.",
                    "3. Sonographic Murphy's sign is positive.",
                    "4. Common Bile Duct (CBD) measures 4.1 mm (normal caliber). Liver shows normal echotexture.",
                    "Impression: Acute Calculous Cholecystitis. Advised Laparoscopic Cholecystectomy.",
                    "Signed: Dr. Demo Radiologist, MD (Radiodiagnosis)",
                ],
            ),
            "CLM3385_Dengue_Serial_Platelet_Lab_Report.pdf": (
                "DEPARTMENT OF PATHOLOGY — SERIAL HEMATOLOGY & PLATELET CHART",
                [
                    "Patient: Demo Patient C | Age/Sex: 29/M | UHID: DEMO-UHID-3385 | Claim: CLM-3385",
                    "Dengue NS1 Antigen: REACTIVE (Positive) | Ward: High Dependency Unit (HDU-04)",
                    "Hematology Table (Automated EDTA + Peripheral Smear Cross-Checked):",
                    "- Platelet Count (Automated EDTA): 24,000 /cumm [Ref Range: 1,50,000 - 4,10,000] (CRITICAL)",
                    "- Previous Platelet Count (12h ago): 42,000 /cumm (Rapid downward trend)",
                    "- Hematocrit (PCV): 47.8% — Serial rise noted with NS1 Reactive status.",
                    "- Total Leukocyte Count (WBC): 3,100 /cumm",
                    "Pathologist Note: Critical thrombocytopenia; requires inpatient monitoring & IV hydration.",
                ],
            ),
            "Handwritten_Doctor_Admission_ICP_Scan.pdf": (
                "INDOOR CASE PAPER (ICP) — HANDWRITTEN SURGICAL ADMISSION NOTE",
                [
                    "Patient: Demo Patient A | Ward: Surgical 3B | Treating Surgeon: Dr. Demo Surgeon",
                    "c/o acute RHC pain + vomiting x 2d. O/E: Tenderness RUQ (+), Murphy sign (+). Plan: Lap Chole.",
                    "Vitals: Temp 101.4 F | Pulse 104/min | BP 136/86 mmHg",
                    "Provisional Diagnosis: Acute Calculous Cholecystitis requiring urgent laparoscopic intervention.",
                ],
            ),
            "Blurry_Low_Confidence_Ward_Scan.pdf": (
                "UNLABELED WARD SCAN (LOW CONTRAST TEST DOCUMENT)",
                [
                    "Est. package cost ~88,500/- subject to OT consumables...",
                    "[Simulated low-contrast handwritten memo to demonstrate AI < 0.75 quarantine fallback]",
                ],
            ),
        }
        for fname, (title, lines) in sample_files.items():
            generate_sample_pdf(os.path.join(settings.STORAGE_DIR, fname), title, lines)

        # 2. Seed Insurers & TPAs (matching sample data: Company B, Company C, Company D)
        insurers = [
            Insurer(
                id="INS-COMP-B",
                code="COMPANY_B_TPA",
                name="Company B (TPA)",
                kind="TPA",
                preauth_sla_mins=60,
                discharge_sla_mins=180,
                format_notes="Requires single merged PDF < 20MB with USG & ICP in sequence.",
            ),
            Insurer(
                id="INS-COMP-C",
                code="COMPANY_C_INS",
                name="Company C (insurer)",
                kind="INSURER",
                preauth_sla_mins=60,
                discharge_sla_mins=180,
                format_notes="Direct insurer cashless desk; mandatory pre-op X-Ray & implant invoice for ortho.",
            ),
            Insurer(
                id="INS-COMP-D",
                code="COMPANY_D_TPA",
                name="Company D (TPA)",
                kind="TPA",
                preauth_sla_mins=60,
                discharge_sla_mins=180,
                format_notes="Strict enhancement scrutiny on medical admissions; serial lab charts mandatory.",
            ),
        ]
        db.add_all(insurers)

        # 3. Seed Procedures (matching sample data)
        procedures = [
            Procedure(
                id="PROC-GALL",
                code="SURG-LAP-CHOLE",
                name="Gall bladder removal",
                department="General Surgery",
                avg_tariff_inr=78000.0,
            ),
            Procedure(
                id="PROC-TKR",
                code="ORTHO-TKR-01",
                name="Total knee replacement",
                department="Orthopaedics",
                avg_tariff_inr=165000.0,
            ),
            Procedure(
                id="PROC-DENGUE",
                code="MED-DENGUE-HDU",
                name="Dengue with low platelets",
                department="Internal Medicine",
                avg_tariff_inr=54000.0,
            ),
        ]
        db.add_all(procedures)

        # 4. Seed 3-Tier Checklist Rules
        rules = [
            # Universal Rules (apply to all insurers & procedures)
            ChecklistRule(
                id="RULE-UNIV-1",
                insurer_id=None,
                procedure_id=None,
                slot_key="PHOTO_ID_KYC",
                slot_label="Govt Photo ID (PAN / Voter ID)",
                stage_required="PRE_AUTH",
                is_mandatory=True,
                sort_order=1,
            ),
            ChecklistRule(
                id="RULE-UNIV-2",
                insurer_id=None,
                procedure_id=None,
                slot_key="POLICY_ECARD",
                slot_label="Active Cashless Policy E-Card",
                stage_required="PRE_AUTH",
                is_mandatory=True,
                sort_order=2,
            ),
            ChecklistRule(
                id="RULE-UNIV-3",
                insurer_id=None,
                procedure_id=None,
                slot_key="SIGNED_PREAUTH_FORM",
                slot_label="Signed Pre-Authorisation Form",
                stage_required="PRE_AUTH",
                is_mandatory=True,
                sort_order=3,
            ),
            # Insurer-Specific Rule (Company B requires Indoor Case Paper)
            ChecklistRule(
                id="RULE-COMPB-ICP",
                insurer_id="INS-COMP-B",
                procedure_id=None,
                slot_key="ICP_ADMISSION_NOTE",
                slot_label="Doctor Indoor Case Paper (ICP) Note",
                stage_required="PRE_AUTH",
                is_mandatory=True,
                sort_order=4,
            ),
            # Insurer x Procedure Specific Rules
            ChecklistRule(
                id="RULE-GALL-USG",
                insurer_id="INS-COMP-B",
                procedure_id="PROC-GALL",
                slot_key="USG_ABDOMEN",
                slot_label="Ultrasound report",
                stage_required="PRE_AUTH",
                is_mandatory=True,
                sort_order=5,
            ),
            ChecklistRule(
                id="RULE-GALL-LFT",
                insurer_id="INS-COMP-B",
                procedure_id="PROC-GALL",
                slot_key="LFT_BLOOD_REPORT",
                slot_label="Liver Function Test (LFT) Report",
                stage_required="DISCHARGE",
                is_mandatory=False,
                sort_order=6,
            ),
            ChecklistRule(
                id="RULE-TKR-XRAY",
                insurer_id="INS-COMP-C",
                procedure_id="PROC-TKR",
                slot_key="PREOP_KNEE_XRAY",
                slot_label="Pre-Op Weight Bearing Knee X-Ray",
                stage_required="PRE_AUTH",
                is_mandatory=True,
                sort_order=4,
            ),
            ChecklistRule(
                id="RULE-TKR-IMPLANT",
                insurer_id="INS-COMP-C",
                procedure_id="PROC-TKR",
                slot_key="IMPLANT_STICKER_INVOICE",
                slot_label="Implant Barcode Sticker & Invoice",
                stage_required="DISCHARGE",
                is_mandatory=False,
                sort_order=5,
            ),
            ChecklistRule(
                id="RULE-DENGUE-NS1",
                insurer_id="INS-COMP-D",
                procedure_id="PROC-DENGUE",
                slot_key="DENGUE_NS1_SEROLOGY",
                slot_label="Dengue NS1 / IgM Positive Report",
                stage_required="PRE_AUTH",
                is_mandatory=True,
                sort_order=4,
            ),
            ChecklistRule(
                id="RULE-DENGUE-PLATELET",
                insurer_id="INS-COMP-D",
                procedure_id="PROC-DENGUE",
                slot_key="SERIAL_PLATELET_LAB",
                slot_label="Latest platelet count",
                stage_required="ENHANCEMENT",
                is_mandatory=True,
                sort_order=5,
            ),
        ]
        db.add_all(rules)

        # 5. Seed Exact Sample Claims from Brief #4 + Realistic Operational Claims
        # --- CLAIM 1: CLM-3381 | Demo Patient A | Company B (TPA) | Gall bladder removal | Query | Missing: Ultrasound report ---
        clm_3381 = Claim(
            id="CLM-3381",
            patient_name="Demo Patient A",
            uhid="DEMO-UHID-3381",
            patient_age=52,
            patient_gender="M",
            policy_number_full="DEMO-POLICY-3381",
            policy_number_masked="XXXX-XXXX-3381",
            insurer_id="INS-COMP-B",
            procedure_id="PROC-GALL",
            treating_doctor_name="Dr. Demo One",
            ward_bed="Surg-3B / Bed 14",
            admission_at=now - timedelta(hours=6),
            estimated_amount_inr=78500.0,
            approved_amount_inr=0.0,
            deduction_risk_inr=14500.0,
            status="QUERY",
            stage_entered_at=now - timedelta(minutes=38),
            sla_deadline_at=now + timedelta(minutes=82),
            hospital_delay_mins=34,
            tpa_delay_mins=52,
            assigned_exec_name="Demo Executive",
        )

        # --- CLAIM 2: CLM-3382 | Demo Patient B | Company C (insurer) | Total knee replacement | Pre-auth sent | Missing: None ---
        clm_3382 = Claim(
            id="CLM-3382",
            patient_name="Demo Patient B",
            uhid="DEMO-UHID-3382",
            patient_age=64,
            patient_gender="F",
            policy_number_full="DEMO-POLICY-3382",
            policy_number_masked="XXXX-XXXX-3382",
            insurer_id="INS-COMP-C",
            procedure_id="PROC-TKR",
            treating_doctor_name="Dr. Demo Two",
            ward_bed="Ortho-2A / Bed 04",
            admission_at=now - timedelta(hours=4),
            estimated_amount_inr=168000.0,
            approved_amount_inr=0.0,
            deduction_risk_inr=0.0,
            status="PREAUTH_SENT",
            stage_entered_at=now - timedelta(minutes=22),
            sla_deadline_at=now + timedelta(minutes=38),  # IRDAI 60-min pre-auth clock
            hospital_delay_mins=26,
            tpa_delay_mins=22,
            assigned_exec_name="Demo Executive",
        )

        # --- CLAIM 3: CLM-3385 | Demo Patient C | Company D (TPA) | Dengue with low platelets | Enhancement | Missing: Latest platelet count ---
        clm_3385 = Claim(
            id="CLM-3385",
            patient_name="Demo Patient C",
            uhid="DEMO-UHID-3385",
            patient_age=29,
            patient_gender="M",
            policy_number_full="DEMO-POLICY-3385",
            policy_number_masked="XXXX-XXXX-3385",
            insurer_id="INS-COMP-D",
            procedure_id="PROC-DENGUE",
            treating_doctor_name="Dr. Demo Three",
            ward_bed="HDU-01 / Bed 02",
            admission_at=now - timedelta(days=2),
            estimated_amount_inr=62000.0,
            approved_amount_inr=35000.0,
            deduction_risk_inr=18000.0,
            status="ENHANCEMENT",
            stage_entered_at=now - timedelta(minutes=47),
            sla_deadline_at=now + timedelta(minutes=43),
            hospital_delay_mins=41,
            tpa_delay_mins=68,
            assigned_exec_name="Demo Executive",
        )

        # --- CLAIM 4: CLM-3388 | Demo Patient D | Discharge Stage (Showing 3h IRDAI Discharge Clock) ---
        clm_3388 = Claim(
            id="CLM-3388",
            patient_name="Demo Patient D",
            uhid="DEMO-UHID-3388",
            patient_age=45,
            patient_gender="F",
            policy_number_full="DEMO-POLICY-3388",
            policy_number_masked="XXXX-XXXX-3388",
            insurer_id="INS-COMP-B",
            procedure_id="PROC-GALL",
            treating_doctor_name="Dr. Demo One",
            ward_bed="Surg-3A / Bed 09",
            admission_at=now - timedelta(days=3),
            estimated_amount_inr=84000.0,
            approved_amount_inr=81500.0,
            deduction_risk_inr=0.0,
            status="FINAL_BILL",
            stage_entered_at=now - timedelta(minutes=55),
            sla_deadline_at=now + timedelta(minutes=125),  # IRDAI 3-hour discharge clock
            hospital_delay_mins=29,
            tpa_delay_mins=55,
            assigned_exec_name="Demo Executive",
        )

        db.add_all([clm_3381, clm_3382, clm_3385, clm_3388])
        db.commit()

        # 6. Materialize Checklist Items for Seeded Claims
        # CLM-3381 (Missing: Ultrasound report)
        db.add_all([
            ClaimChecklistItem(id="CHK-3381-1", claim_id="CLM-3381", slot_key="PHOTO_ID_KYC", slot_label="Govt Photo ID (PAN / Voter ID)", stage_required="PRE_AUTH", is_mandatory=True, status="VERIFIED", verified_by="Demo Executive", sort_order=1),
            ClaimChecklistItem(id="CHK-3381-2", claim_id="CLM-3381", slot_key="POLICY_ECARD", slot_label="Active Cashless Policy E-Card", stage_required="PRE_AUTH", is_mandatory=True, status="VERIFIED", verified_by="Demo Executive", sort_order=2),
            ClaimChecklistItem(id="CHK-3381-3", claim_id="CLM-3381", slot_key="SIGNED_PREAUTH_FORM", slot_label="Signed Pre-Authorisation Form", stage_required="PRE_AUTH", is_mandatory=True, status="VERIFIED", verified_by="Demo Executive", sort_order=3),
            ClaimChecklistItem(id="CHK-3381-4", claim_id="CLM-3381", slot_key="ICP_ADMISSION_NOTE", slot_label="Doctor Indoor Case Paper (ICP) Note", stage_required="PRE_AUTH", is_mandatory=True, status="VERIFIED", verified_by="Demo Executive", sort_order=4),
            ClaimChecklistItem(id="CHK-3381-5", claim_id="CLM-3381", slot_key="USG_ABDOMEN", slot_label="Ultrasound report", stage_required="PRE_AUTH", is_mandatory=True, status="MISSING", sort_order=5),
            ClaimChecklistItem(id="CHK-3381-6", claim_id="CLM-3381", slot_key="LFT_BLOOD_REPORT", slot_label="Liver Function Test (LFT) Report", stage_required="DISCHARGE", is_mandatory=False, status="VERIFIED", verified_by="Demo Executive", sort_order=6),
        ])

        # CLM-3382 (Missing: None — all verified!)
        db.add_all([
            ClaimChecklistItem(id="CHK-3382-1", claim_id="CLM-3382", slot_key="PHOTO_ID_KYC", slot_label="Govt Photo ID (PAN / Voter ID)", stage_required="PRE_AUTH", is_mandatory=True, status="VERIFIED", verified_by="Demo Executive", sort_order=1),
            ClaimChecklistItem(id="CHK-3382-2", claim_id="CLM-3382", slot_key="POLICY_ECARD", slot_label="Active Cashless Policy E-Card", stage_required="PRE_AUTH", is_mandatory=True, status="VERIFIED", verified_by="Demo Executive", sort_order=2),
            ClaimChecklistItem(id="CHK-3382-3", claim_id="CLM-3382", slot_key="SIGNED_PREAUTH_FORM", slot_label="Signed Pre-Authorisation Form", stage_required="PRE_AUTH", is_mandatory=True, status="VERIFIED", verified_by="Demo Executive", sort_order=3),
            ClaimChecklistItem(id="CHK-3382-4", claim_id="CLM-3382", slot_key="PREOP_KNEE_XRAY", slot_label="Pre-Op Weight Bearing Knee X-Ray", stage_required="PRE_AUTH", is_mandatory=True, status="VERIFIED", verified_by="Demo Executive", sort_order=4),
            ClaimChecklistItem(id="CHK-3382-5", claim_id="CLM-3382", slot_key="IMPLANT_STICKER_INVOICE", slot_label="Implant Barcode Sticker & Invoice", stage_required="DISCHARGE", is_mandatory=False, status="VERIFIED", verified_by="Demo Executive", sort_order=5),
        ])

        # CLM-3385 (Missing: Latest platelet count)
        db.add_all([
            ClaimChecklistItem(id="CHK-3385-1", claim_id="CLM-3385", slot_key="PHOTO_ID_KYC", slot_label="Govt Photo ID (PAN / Voter ID)", stage_required="PRE_AUTH", is_mandatory=True, status="VERIFIED", verified_by="Demo Executive", sort_order=1),
            ClaimChecklistItem(id="CHK-3385-2", claim_id="CLM-3385", slot_key="POLICY_ECARD", slot_label="Active Cashless Policy E-Card", stage_required="PRE_AUTH", is_mandatory=True, status="VERIFIED", verified_by="Demo Executive", sort_order=2),
            ClaimChecklistItem(id="CHK-3385-3", claim_id="CLM-3385", slot_key="SIGNED_PREAUTH_FORM", slot_label="Signed Pre-Authorisation Form", stage_required="PRE_AUTH", is_mandatory=True, status="VERIFIED", verified_by="Demo Executive", sort_order=3),
            ClaimChecklistItem(id="CHK-3385-4", claim_id="CLM-3385", slot_key="DENGUE_NS1_SEROLOGY", slot_label="Dengue NS1 / IgM Positive Report", stage_required="PRE_AUTH", is_mandatory=True, status="VERIFIED", verified_by="Demo Executive", sort_order=4),
            ClaimChecklistItem(id="CHK-3385-5", claim_id="CLM-3385", slot_key="SERIAL_PLATELET_LAB", slot_label="Latest platelet count", stage_required="ENHANCEMENT", is_mandatory=True, status="MISSING", sort_order=5),
        ])

        # CLM-3388 (All verified, waiting for Final Bill settlement)
        db.add_all([
            ClaimChecklistItem(id="CHK-3388-1", claim_id="CLM-3388", slot_key="PHOTO_ID_KYC", slot_label="Govt Photo ID (PAN / Voter ID)", stage_required="PRE_AUTH", is_mandatory=True, status="VERIFIED", verified_by="Demo Executive", sort_order=1),
            ClaimChecklistItem(id="CHK-3388-2", claim_id="CLM-3388", slot_key="POLICY_ECARD", slot_label="Active Cashless Policy E-Card", stage_required="PRE_AUTH", is_mandatory=True, status="VERIFIED", verified_by="Demo Executive", sort_order=2),
            ClaimChecklistItem(id="CHK-3388-3", claim_id="CLM-3388", slot_key="SIGNED_PREAUTH_FORM", slot_label="Signed Pre-Authorisation Form", stage_required="PRE_AUTH", is_mandatory=True, status="VERIFIED", verified_by="Demo Executive", sort_order=3),
            ClaimChecklistItem(id="CHK-3388-4", claim_id="CLM-3388", slot_key="ICP_ADMISSION_NOTE", slot_label="Doctor Indoor Case Paper (ICP) Note", stage_required="PRE_AUTH", is_mandatory=True, status="VERIFIED", verified_by="Demo Executive", sort_order=4),
            ClaimChecklistItem(id="CHK-3388-5", claim_id="CLM-3388", slot_key="USG_ABDOMEN", slot_label="Ultrasound report", stage_required="PRE_AUTH", is_mandatory=True, status="VERIFIED", verified_by="Demo Executive", sort_order=5),
        ])

        # 7. Seed Extracted Pre-Auth Fields with Verbatim Source Snippets (Some PENDING so reviewer can click Confirm!)
        db.add_all([
            ClaimExtractedField(
                id="FLD-3381-1",
                claim_id="CLM-3381",
                field_key="provisional_diagnosis",
                field_label="Provisional Diagnosis (ICD-10)",
                ai_suggested_value="K80.00 — Acute Calculous Cholecystitis without obstruction",
                confirmed_value="K80.00 — Acute Calculous Cholecystitis without obstruction",
                source_snippet="Page 1, ICP Note: 'Provisional Dx: Acute Calculous Cholecystitis (ICD K80.0) advised Lap Chole.'",
                source_page=1,
                confidence=0.95,
                status="CONFIRMED",
                confirmed_by="Demo Executive",
            ),
            ClaimExtractedField(
                id="FLD-3381-2",
                claim_id="CLM-3381",
                field_key="clinical_vitals",
                field_label="Admission Vitals & Murphy Sign",
                ai_suggested_value="Temp 101.4°F, Pulse 104/min, BP 136/86 mmHg, Murphy's Sign Positive (+)",
                confirmed_value=None,
                source_snippet="Page 1, Handwritten Ward Note: 'c/o acute RHC pain + vomiting x 2d. O/E: Tenderness RUQ (+), Murphy sign (+).'",
                source_page=1,
                confidence=0.84,
                status="PENDING",
            ),
            ClaimExtractedField(
                id="FLD-3382-1",
                claim_id="CLM-3382",
                field_key="osteoarthritis_grade",
                field_label="Kellgren-Lawrence OA Grade",
                ai_suggested_value="Grade IV Tricompartmental Osteoarthritis Right Knee with 14° Varus Deformity",
                confirmed_value="Grade IV Tricompartmental Osteoarthritis Right Knee with 14° Varus Deformity",
                source_snippet="Page 1, Ortho X-Ray Report: 'Severe joint space obliteration with subchondral sclerosis (KL Grade IV).'",
                source_page=1,
                confidence=0.98,
                status="CONFIRMED",
                confirmed_by="Demo Executive",
            ),
            ClaimExtractedField(
                id="FLD-3385-1",
                claim_id="CLM-3385",
                field_key="dengue_serology",
                field_label="Dengue NS1 Antigen Status",
                ai_suggested_value="NS1 Antigen Reactive (Index 4.82) — Warning Signs Present",
                confirmed_value="NS1 Antigen Reactive (Index 4.82) — Warning Signs Present",
                source_snippet="Page 1, Serology Report: 'Dengue NS1 Ag ELISA: REACTIVE (Test Index 4.82; Cutoff 1.1).'",
                source_page=1,
                confidence=0.96,
                status="CONFIRMED",
                confirmed_by="Demo Executive",
            ),
        ])

        # 8. Seed TPA Queries (with Original Emails below AI Summaries)
        db.add_all([
            TPAQuery(
                id="QRY-901",
                claim_id="CLM-3381",
                tpa_reference_no="DEMO-QRY-3381",
                sender_email="cashless.queries@companyb-tpa.co.in",
                raw_subject="QUERY ON PRE-AUTH CLM-3381 (Demo Patient A - Policy #XXXX3381) - Laparoscopic Cholecystectomy",
                raw_email_body=(
                    "Dear Hospital Insurance Desk,\n\n"
                    "We have reviewed the initial pre-authorisation request for Patient Demo Patient A (Proposed Procedure: Gall bladder removal / Lap Chole, Est: Rs. 78,500).\n\n"
                    "The claim is currently placed under QUERY for the following mandatory requirements:\n"
                    "1. Kindly provide the complete Abdominal Ultrasound (USG) Report indicating calculus size, number of calculi, and gallbladder wall thickness.\n"
                    "2. Provide treating surgeon's indoor case paper note specifying duration of acute symptoms.\n\n"
                    "Note: As per policy terms, cashless pre-authorisation cannot be adjudicated until the USG report is uploaded.\n\n"
                    "Regards,\nTPA Reviewer\nMedical Adjudication Cell, Company B (TPA)"
                ),
                ai_summary="Company B (TPA) has held Pre-Auth adjudication pending: (1) Abdominal Ultrasound (USG) Report showing stone size & wall thickness, and (2) Verification of acute symptom duration in the ICP note.",
                ai_action_items=[
                    "Upload Abdominal Ultrasound (USG) Report to clear mandatory slot 'USG_ABDOMEN'",
                    "Confirm extracted handwritten ICP clinical vitals field",
                    "Review & send drafted reply packet",
                ],
                missing_slot_key="USG_ABDOMEN",
                received_at=now - timedelta(minutes=38),
                reply_due_at=now + timedelta(minutes=82),
                draft_reply=(
                    "Dear Medical Adjudication Cell (Company B TPA),\n\n"
                    "In reference to Query DEMO-QRY-3381 for Claim CLM-3381 (Patient: Demo Patient A), please find attached:\n"
                    "1. Verified Abdominal Ultrasound (USG) Report confirming multiple mobile calculi (largest 14.2 mm in GB neck) with 4.8 mm wall thickening.\n"
                    "2. Confirmed Indoor Case Paper (ICP) admission note documenting 48 hours of acute RUQ pain and positive Murphy's sign.\n\n"
                    "All mandatory checklist slots are now verified. Kindly release the cashless pre-authorisation approval.\n\n"
                    "Regards,\nDemo Executive | Insurance Desk, Demo Hospital"
                ),
                doctor_magic_token="DOC-TOKEN-3381",
                doctor_note_signed=True,
                doctor_justification_text="Patient presented with acute calculous cholecystitis (14.2mm impacted neck calculus, wall 4.8mm, febrile 101.4F). Urgent laparoscopic cholecystectomy indicated to prevent empyema/perforation.",
                status="OPEN",
            ),
            TPAQuery(
                id="QRY-902",
                claim_id="CLM-3385",
                tpa_reference_no="DEMO-ENH-3385",
                sender_email="enhancements@companyd-tpa.in",
                raw_subject="ENHANCEMENT QUERY: CLM-3385 (Demo Patient C) - Dengue Fever with Thrombocytopenia",
                raw_email_body=(
                    "Dear TPA Desk,\n\n"
                    "With respect to the interim enhancement request of Rs. 27,000 (Total Rs. 62,000) for Patient Demo Patient C:\n"
                    "1. Please submit the latest Serial Platelet Count and Hematocrit (PCV) lab report from today morning.\n"
                    "2. Provide treating physician's justification note for continued HDU stay.\n\n"
                    "Regards,\nClaims Review Desk — Company D (TPA)"
                ),
                ai_summary="Company D (TPA) requires today's latest Serial Platelet Count & PCV lab report plus a signed clinical justification from Dr. Demo Three for continued HDU stay before approving the ₹27,000 enhancement.",
                ai_action_items=[
                    "Upload latest Serial Platelet Count report into slot 'SERIAL_PLATELET_LAB'",
                    "Obtain 1-tap mobile clinical justification sign-off from Dr. Demo Three",
                ],
                missing_slot_key="SERIAL_PLATELET_LAB",
                received_at=now - timedelta(minutes=47),
                reply_due_at=now + timedelta(minutes=43),
                draft_reply=(
                    "Dear Claims Review Desk (Company D TPA),\n\n"
                    "Regarding Enhancement Request DEMO-ENH-3385 for Claim CLM-3385 (Demo Patient C), we have attached today's hematology report confirming a critical platelet drop to 24,000 /cumm with 47.8% PCV, alongside Dr. Demo Three's signed HDU justification note.\n\n"
                    "Regards,\nDemo Executive | Insurance Desk, Demo Hospital"
                ),
                doctor_magic_token="DOC-TOKEN-3385",
                doctor_note_signed=False,
                doctor_justification_text=None,
                status="OPEN",
            ),
        ])

        # 9. Seed Timeline Events
        db.add_all([
            ClaimTimelineEvent(id="EVT-1", claim_id="CLM-3381", stage="DRAFT", title="Admission & Claim File Created", detail="Checklist initialized via Rule Engine for Company B (TPA) x Gall bladder removal (5 mandatory pre-auth slots).", actor_name="Demo Executive", actor_role="DESK_EXEC", created_at=now - timedelta(hours=5, minutes=40)),
            ClaimTimelineEvent(id="EVT-2", claim_id="CLM-3381", stage="PREAUTH_SENT", title="Initial Pre-Auth Sent (With Head Override)", detail="Sent prior to radiology upload; flagged ₹14,500 deduction risk.", actor_name="Demo Executive", actor_role="DESK_EXEC", created_at=now - timedelta(hours=4)),
            ClaimTimelineEvent(id="EVT-3", claim_id="CLM-3381", stage="QUERY", title="TPA Query Received (DEMO-QRY-3381)", detail="AI parsed query email: Missing 'Ultrasound report'. SLA countdown started.", actor_name="System AI Webhook", actor_role="SYSTEM", created_at=now - timedelta(minutes=38)),
            ClaimTimelineEvent(id="EVT-4", claim_id="CLM-3382", stage="PREAUTH_SENT", title="Complete Pre-Auth Packet Dispatched", detail="All 4 mandatory slots verified for Company C x Total knee replacement. Zero gaps.", actor_name="Demo Executive", actor_role="DESK_EXEC", created_at=now - timedelta(minutes=22)),
        ])

        # 10. Seed Audit Logs
        db.add(
            AuditLog(
                id="AUD-001",
                claim_id="CLM-3381",
                actor_name="Demo Executive",
                actor_role="DESK_EXEC",
                action="AI_FIELD_CONFIRMED",
                details="Confirmed AI-extracted field 'Provisional Diagnosis (ICD-10)' from ICP Note Page 1.",
                created_at=now - timedelta(hours=5),
            )
        )

        db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
