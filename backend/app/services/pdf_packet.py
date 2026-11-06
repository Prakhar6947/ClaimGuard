import io
import hashlib
from xml.sax.saxutils import escape
from datetime import datetime, timezone
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from app.models import Claim


def _clean_text(val: str | None) -> str:
    """Escapes XML entities for ReportLab Paragraph and adds zero-width break hints after underscores/slashes."""
    if not val:
        return "-"
    escaped = escape(str(val).strip())
    # Allow long enum keys like SIGNED_PREAUTH_FORM to wrap cleanly across lines if needed
    return escaped.replace("_", "_&#8203;").replace("/", "/&#8203;")


def build_merged_tpa_packet_pdf(claim: Claim) -> bytes:
    """
    Generates an institutional-grade, zero-overlap IRDAI Cashless TPA Submission Dossier PDF.
    Every table cell uses a ReportLab Paragraph flowable so long clinical text wraps cleanly.
    """
    buffer = io.BytesIO()
    # A4 width = 595.27 pt. With left/right margins of 32 pt, usable width = 531 pt.
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=32,
        leftMargin=32,
        topMargin=30,
        bottomMargin=30,
        title=f"{claim.id} Cashless TPA Submission Packet",
    )

    styles = getSampleStyleSheet()

    # Typography Styles
    hdr_hospital = ParagraphStyle(
        "HdrHospital",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=colors.white,
    )
    hdr_sub = ParagraphStyle(
        "HdrSub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#D4D4D8"),
    )
    hdr_right = ParagraphStyle(
        "HdrRight",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=12,
        alignment=2,  # Right align
        textColor=colors.HexColor("#5EEAD4"),
    )
    section_title = ParagraphStyle(
        "SectionTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#0F766E"),
        spaceBefore=12,
        spaceAfter=5,
    )
    th_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=10,
        textColor=colors.white,
    )
    cell_label = ParagraphStyle(
        "CellLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#3F3F46"),
    )
    cell_val = ParagraphStyle(
        "CellVal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11.5,
        textColor=colors.HexColor("#18181B"),
    )
    cell_mono = ParagraphStyle(
        "CellMono",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=7.5,
        leading=10.5,
        textColor=colors.HexColor("#27272A"),
    )
    cell_quote = ParagraphStyle(
        "CellQuote",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=7.5,
        leading=10.5,
        textColor=colors.HexColor("#52525B"),
    )
    footer_note = ParagraphStyle(
        "FooterNote",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10.5,
        textColor=colors.HexColor("#52525B"),
    )

    def status_pill(status_text: str, extra_note: str | None = None) -> Paragraph:
        st = (status_text or "").upper()
        if st in ("VERIFIED", "CONFIRMED", "APPROVED", "SETTLED"):
            color_hex = "#047857"  # Emerald
        elif st in ("MISSING", "BLOCKED", "QUERY"):
            color_hex = "#B91C1C"  # Red
        elif st in ("WAIVED_BY_HEAD", "EDITED"):
            color_hex = "#1D4ED8"  # Blue
        else:
            color_hex = "#B45309"  # Amber

        label = f"<b><font color='{color_hex}'>{_clean_text(st)}</font></b>"
        if extra_note:
            label += f"<br/><font size='7' color='#52525B'>{_clean_text(extra_note)}</font>"
        return Paragraph(label, cell_val)

    elements = []
    now_dt = datetime.now(timezone.utc)
    now_str = now_dt.strftime("%d %b %Y, %H:%M UTC")
    packet_hash = hashlib.sha256(f"{claim.id}-{now_str}".encode()).hexdigest()[:12].upper()

    # =========================================================================
    # TOP INSTITUTIONAL BANNER
    # =========================================================================
    banner_data = [
        [
            Paragraph(
                "COMPANY A MULTISPECIALITY HOSPITAL — NASHIK<br/>"
                "<font size='8' color='#A1A1AA'>NABH Accredited Tertiary Care Centre · ROHINI ID: 8900142109 · Cashless TPA Desk</font>",
                hdr_hospital,
            ),
            Paragraph(
                f"CONSOLIDATED TPA DOSSIER<br/>"
                f"<font color='#FFFFFF'>Claim ID: {escape(claim.id)}</font><br/>"
                f"<font size='7.5' color='#D4D4D8'>Generated: {now_str}</font>",
                hdr_right,
            ),
        ]
    ]
    banner_table = Table(banner_data, colWidths=[355, 176])
    banner_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#18181B")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    elements.append(banner_table)
    elements.append(Spacer(1, 6))

    # =========================================================================
    # SECTION 1: PATIENT, INSURER & IRDAI SLA SUMMARY (Total width = 531 pt)
    # =========================================================================
    elements.append(Paragraph("1. PATIENT ADMISSION, INSURER & IRDAI SLA TELEMETRY", section_title))

    insurer_name = claim.insurer.name if claim.insurer else "N/A"
    proc_name = claim.procedure.name if claim.procedure else "N/A"
    proc_dept = claim.procedure.department if claim.procedure else "General"

    meta_rows = [
        [
            Paragraph("Claim Reference", cell_label),
            Paragraph(f"<b>{_clean_text(claim.id)}</b>", cell_mono),
            Paragraph("Insurer / TPA", cell_label),
            Paragraph(f"<b>{_clean_text(insurer_name)}</b>", cell_val),
        ],
        [
            Paragraph("Patient Name", cell_label),
            Paragraph(f"<b>{_clean_text(claim.patient_name)}</b> ({claim.patient_age}Y / {_clean_text(claim.patient_gender)})", cell_val),
            Paragraph("UHID & Ward Bed", cell_label),
            Paragraph(f"{_clean_text(claim.uhid)} · {_clean_text(claim.ward_bed)}", cell_mono),
        ],
        [
            Paragraph("Policy No (DPDP Masked)", cell_label),
            Paragraph(_clean_text(claim.policy_number_masked), cell_mono),
            Paragraph("Treating Consultant", cell_label),
            Paragraph(_clean_text(claim.treating_doctor_name), cell_val),
        ],
        [
            Paragraph("Clinical Procedure", cell_label),
            Paragraph(f"<b>{_clean_text(proc_name)}</b> ({_clean_text(proc_dept)})", cell_val),
            Paragraph("Workflow Stage", cell_label),
            status_pill(claim.status),
        ],
        [
            Paragraph("Estimated Package Bill", cell_label),
            Paragraph(f"<b>INR {claim.estimated_amount_inr:,.2f}</b>", cell_mono),
            Paragraph("IRDAI Delay Split", cell_label),
            Paragraph(
                f"Hospital Prep: <b>{claim.hospital_delay_mins} mins</b> | TPA Wait: <b>{claim.tpa_delay_mins} mins</b>",
                cell_val,
            ),
        ],
    ]

    meta_table = Table(meta_rows, colWidths=[110, 155, 110, 156])
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F4F4F5")),
                ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F4F4F5")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D4D4D8")),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    elements.append(meta_table)

    # =========================================================================
    # SECTION 2: DOCUMENT CHECKLIST VERIFICATION (Total width = 531 pt)
    # =========================================================================
    elements.append(
        Paragraph("2. INSURER × PROCEDURE MANDATORY CHECKLIST VERIFICATION", section_title)
    )

    chk_rows = [
        [
            Paragraph("SLOT CODE", th_style),
            Paragraph("REQUIRED MEDICAL / KYC DOCUMENT", th_style),
            Paragraph("STAGE", th_style),
            Paragraph("RULE", th_style),
            Paragraph("VERIFICATION STATUS", th_style),
        ]
    ]

    for item in sorted(claim.checklist_items, key=lambda x: x.sort_order):
        extra = None
        if item.waiver_reason:
            extra = f"Reason: {item.waiver_reason}"
        elif item.verified_by:
            extra = f"By: {item.verified_by}"

        chk_rows.append(
            [
                Paragraph(_clean_text(item.slot_key), cell_mono),
                Paragraph(f"<b>{_clean_text(item.slot_label)}</b>", cell_val),
                Paragraph(_clean_text(item.stage_required), cell_mono),
                Paragraph("MANDATORY" if item.is_mandatory else "Optional", cell_val),
                status_pill(item.status, extra),
            ]
        )

    # Col widths sum to 531 pt: 105 + 176 + 65 + 60 + 125 = 531
    chk_table = Table(chk_rows, colWidths=[105, 176, 65, 60, 125], repeatRows=1)
    chk_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#18181B")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAFAFA")]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E4E4E7")),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    elements.append(chk_table)

    # =========================================================================
    # SECTION 3: PRE-AUTH CLINICAL FIELDS & SOURCE CITATIONS (Deduplicated!)
    # =========================================================================
    elements.append(
        Paragraph("3. VERIFIED PRE-AUTHORISATION CLINICAL FIELDS & SOURCE SNIPPETS", section_title)
    )

    field_rows = [
        [
            Paragraph("CLINICAL FIELD", th_style),
            Paragraph("CONFIRMED / EXTRACTED VALUE", th_style),
            Paragraph("STATUS", th_style),
            Paragraph("VERBATIM DOCUMENT SOURCE CITATION", th_style),
        ]
    ]

    # Deduplicate by field_key (keeping latest confirmed/uploaded entry) so repeated test clicks never clutter the PDF
    deduped_fields = {}
    for f in claim.extracted_fields:
        deduped_fields[f.field_key] = f

    if not deduped_fields:
        field_rows.append(
            [
                Paragraph("-", cell_val),
                Paragraph("No clinical fields extracted yet", cell_val),
                Paragraph("-", cell_val),
                Paragraph("-", cell_val),
            ]
        )
    else:
        for f in deduped_fields.values():
            val = f.confirmed_value if f.confirmed_value else f.ai_suggested_value
            by_note = f"By: {f.confirmed_by}" if f.confirmed_by else f"AI Conf: {int(f.confidence * 100)}%"
            field_rows.append(
                [
                    Paragraph(f"<b>{_clean_text(f.field_label)}</b>", cell_val),
                    Paragraph(_clean_text(val), cell_val),
                    status_pill(f.status, by_note),
                    Paragraph(_clean_text(f.source_snippet), cell_quote),
                ]
            )

    # Col widths sum to 531 pt: 115 + 156 + 75 + 185 = 531
    f_table = Table(field_rows, colWidths=[115, 156, 75, 185], repeatRows=1)
    f_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F766E")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E4E4E7")),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    elements.append(f_table)

    # =========================================================================
    # SECTION 4: TREATING DOCTOR JUSTIFICATION & TPA QUERY RESOLUTION
    # =========================================================================
    if claim.queries:
        q = claim.queries[0]
        elements.append(
            Paragraph("4. TPA QUERY ADJUDICATION & TREATING CONSULTANT SIGN-OFF", section_title)
        )
        doc_sign_status = (
            f"SIGNED VIA MOBILE MAGIC LINK ({_clean_text(claim.treating_doctor_name)})"
            if q.doctor_note_signed
            else "PENDING DOCTOR SIGN-OFF"
        )
        doc_note = (
            q.doctor_justification_text
            or "Awaiting treating consultant clinical justification note."
        )
        q_rows = [
            [
                Paragraph("TPA Query Ref", cell_label),
                Paragraph(_clean_text(q.tpa_reference_no), cell_mono),
                Paragraph("Query Status", cell_label),
                status_pill(q.status),
            ],
            [
                Paragraph("AI Query Summary", cell_label),
                Paragraph(_clean_text(q.ai_summary), cell_val),
                Paragraph("Doctor Sign-Off", cell_label),
                Paragraph(f"<b>{doc_sign_status}</b><br/>{_clean_text(doc_note)}", cell_val),
            ],
        ]
        q_table = Table(q_rows, colWidths=[95, 170, 90, 176])
        q_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F4F4F5")),
                    ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F4F4F5")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D4D4D8")),
                    ("PADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        elements.append(q_table)

    # =========================================================================
    # FOOTER SIGNATORY & DPDP ACT 2023 AUDIT STAMP
    # =========================================================================
    elements.append(Spacer(1, 14))
    sig_rows = [
        [
            Paragraph(
                f"<b>Authorized Cashless Desk Signatory</b><br/>"
                f"Prepared by: {_clean_text(claim.assigned_exec_name)} (Insurance Desk)<br/>"
                f"DPDP Audit Hash: <font name='Courier'>{packet_hash}</font>",
                footer_note,
            ),
            Paragraph(
                f"<b>Treating Consultant Counter-Sign</b><br/>"
                f"{_clean_text(claim.treating_doctor_name)}<br/>"
                f"Company A Multispeciality Hospital, Nashik",
                footer_note,
            ),
        ]
    ]
    sig_table = Table(sig_rows, colWidths=[265, 266])
    sig_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("PADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    elements.append(KeepTogether([sig_table]))

    doc.build(elements)
    cover_bytes = buffer.getvalue()
    try:
        import os
        from pypdf import PdfReader, PdfWriter

        writer = PdfWriter()
        cover_reader = PdfReader(io.BytesIO(cover_bytes), strict=False)
        for page in cover_reader.pages:
            writer.add_page(page)

        # Append each uploaded/verified document PDF in checklist order
        seen_paths = set()
        for item in sorted(claim.checklist_items, key=lambda x: x.sort_order if x.sort_order is not None else 999):
            if item.document and item.document.file_path:
                fpath = item.document.file_path
                if os.path.exists(fpath) and fpath.lower().endswith(".pdf") and fpath not in seen_paths:
                    seen_paths.add(fpath)
                    try:
                        attachment_reader = PdfReader(fpath, strict=False)
                        for page in attachment_reader.pages:
                            writer.add_page(page)
                    except Exception:
                        pass

        # Also append any assigned documents on the claim that weren't in checklist_items directly
        for doc_item in claim.documents:
            if doc_item.assigned_slot_key and doc_item.file_path:
                fpath = doc_item.file_path
                if os.path.exists(fpath) and fpath.lower().endswith(".pdf") and fpath not in seen_paths:
                    seen_paths.add(fpath)
                    try:
                        attachment_reader = PdfReader(fpath, strict=False)
                        for page in attachment_reader.pages:
                            writer.add_page(page)
                    except Exception:
                        pass

        merged_out = io.BytesIO()
        writer.write(merged_out)
        return merged_out.getvalue()
    except Exception:
        return cover_bytes
