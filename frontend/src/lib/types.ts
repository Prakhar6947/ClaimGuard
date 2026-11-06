export type Role = "DESK_EXEC" | "DESK_HEAD" | "DOCTOR";

export type ClaimStatus =
  | "DRAFT"
  | "PREAUTH_SENT"
  | "QUERY"
  | "ENHANCEMENT"
  | "APPROVED"
  | "FINAL_BILL"
  | "SETTLED";

export interface ChecklistItem {
  id: string;
  slot_key: string;
  slot_label: string;
  stage_required: string;
  is_mandatory: boolean;
  status: "MISSING" | "UPLOADED_UNVERIFIED" | "VERIFIED" | "WAIVED_BY_HEAD";
  document_id: string | null;
  verified_by: string | null;
  waiver_reason: string | null;
  sort_order: number;
}

export interface ClaimDocument {
  id: string;
  file_name: string;
  ai_predicted_slot_key: string | null;
  assigned_slot_key: string | null;
  ai_confidence: number;
  is_handwritten: boolean;
  needs_manual_sorting: boolean;
  uploaded_at: string;
}

export interface ExtractedField {
  id: string;
  field_key: string;
  field_label: string;
  ai_suggested_value: string;
  confirmed_value: string | null;
  source_snippet: string;
  source_page: number;
  confidence: number;
  status: "PENDING" | "CONFIRMED" | "EDITED";
  confirmed_by: string | null;
}

export interface TPAQuery {
  id: string;
  claim_id: string;
  tpa_reference_no: string;
  sender_email: string;
  raw_subject: string;
  raw_email_body: string;
  ai_summary: string;
  ai_action_items: string[];
  missing_slot_key: string | null;
  received_at: string;
  reply_due_at: string;
  draft_reply: string | null;
  doctor_magic_token: string | null;
  doctor_note_signed: boolean;
  doctor_justification_text: string | null;
  status: "OPEN" | "READY_TO_SEND" | "RESOLVED";
}

export interface TimelineEvent {
  id: string;
  stage: string;
  title: string;
  detail: string;
  actor_name: string;
  actor_role: string;
  created_at: string;
}

export interface ClaimGaps {
  missing_mandatory_documents: string[];
  unconfirmed_ai_fields: string[];
  quarantined_documents: string[];
  total_mandatory: number;
  verified_mandatory: number;
  is_ready_for_submission: boolean;
}

export interface Claim {
  id: string;
  patient_name: string;
  uhid: string;
  patient_age: number;
  patient_gender: string;
  policy_number_masked: string;
  policy_number_full: string;
  insurer: {
    id: string;
    name: string;
    kind: string;
    preauth_sla_mins: number;
    discharge_sla_mins: number;
    format_notes: string;
  };
  procedure: {
    id: string;
    code: string;
    name: string;
    department: string;
  };
  treating_doctor_name: string;
  ward_bed: string;
  estimated_amount_inr: number;
  approved_amount_inr: number;
  deduction_risk_inr: number;
  status: ClaimStatus;
  sla_remaining_seconds: number;
  hospital_delay_mins: number;
  tpa_delay_mins: number;
  assigned_exec_name: string;
  gaps: ClaimGaps;
  checklist_items: ChecklistItem[];
  documents: ClaimDocument[];
  extracted_fields: ExtractedField[];
  queries: TPAQuery[];
  timeline_events: TimelineEvent[];
}

export interface DashboardKPIs {
  active_claims_count: number;
  claims_with_missing_docs: number;
  open_tpa_queries: number;
  deduction_risk_protected_inr: number;
  avg_hospital_prep_mins: number;
  annual_leakage_target_lakhs: number;
}

export interface AuditLogItem {
  id: string;
  claim_id: string | null;
  actor_name: string;
  actor_role: string;
  action: string;
  details: string;
  created_at: string;
}

export interface CreateClaimPayload {
  patient_name: string;
  patient_age: number;
  patient_gender: string;
  uhid: string;
  ward_bed: string;
  policy_number_full: string;
  insurer_id: string;
  procedure_id: string;
  treating_doctor_name: string;
  estimated_amount_inr: number;
  assigned_exec_name?: string;
}

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  department?: string;
}
