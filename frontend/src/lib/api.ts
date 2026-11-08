import { Claim, DashboardKPIs, AuditLogItem, Role, CreateClaimPayload, AuthUser } from "./types";

export function getApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!envUrl || typeof envUrl !== "string" || !envUrl.trim()) {
    if (typeof window !== "undefined" && window.location.protocol === "https:") {
      return "";
    }
    return "http://localhost:8000";
  }
  return envUrl.trim().replace(/\/+$/, "");
}

export const API_BASE = getApiBase();

export async function fetchClaims(
  status?: string,
  search?: string
): Promise<{ kpis: DashboardKPIs; claims: Claim[] }> {
  const params = new URLSearchParams();
  if (status && status !== "ALL") params.set("status", status);
  if (search) params.set("search", search);

  const base = getApiBase();
  const res = await fetch(`${base}/api/v1/claims?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch claims (HTTP ${res.status})`);
  return res.json();
}

export async function fetchClaimById(claimId: string): Promise<Claim> {
  const res = await fetch(`${API_BASE}/api/v1/claims/${claimId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load claim detail");
  return res.json();
}

export async function uploadDocumentToClaim(
  claimId: string,
  file: File,
  actorName: string,
  actorRole: Role
): Promise<Claim> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("actor_name", actorName);
  formData.append("actor_role", actorRole);

  const res = await fetch(
    `${API_BASE}/api/v1/claims/${claimId}/documents/upload`,
    {
      method: "POST",
      body: formData,
    }
  );
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

export async function injectSampleScanToClaim(
  claimId: string,
  sampleFileName: string,
  actorName: string,
  actorRole: Role
): Promise<Claim> {
  const sampleRes = await fetch(
    `${API_BASE}/api/v1/sample-docs/${sampleFileName}`
  );
  if (!sampleRes.ok) throw new Error("Could not fetch sample medical PDF");
  const blob = await sampleRes.blob();
  const file = new File([blob], sampleFileName, { type: "application/pdf" });
  return uploadDocumentToClaim(claimId, file, actorName, actorRole);
}

export async function reassignDocumentSlot(
  claimId: string,
  docId: string,
  targetSlotKey: string,
  actorName: string,
  actorRole: Role
): Promise<Claim> {
  const res = await fetch(
    `${API_BASE}/api/v1/claims/${claimId}/documents/${docId}/reassign`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_slot_key: targetSlotKey,
        actor_name: actorName,
        actor_role: actorRole,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Slot reassignment failed");
  }
  return res.json();
}

export async function confirmExtractedField(
  claimId: string,
  fieldId: string,
  confirmedValue: string | null,
  actorName: string,
  actorRole: Role
): Promise<Claim> {
  const res = await fetch(
    `${API_BASE}/api/v1/claims/${claimId}/fields/${fieldId}/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmed_value: confirmedValue,
        actor_name: actorName,
        actor_role: actorRole,
      }),
    }
  );
  if (!res.ok) throw new Error("Field confirmation failed");
  return res.json();
}

export async function waiveChecklistSlot(
  claimId: string,
  itemId: string,
  waiverReason: string,
  actorName: string,
  actorRole: Role
): Promise<Claim> {
  const res = await fetch(
    `${API_BASE}/api/v1/claims/${claimId}/checklist/${itemId}/waive`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        waiver_reason: waiverReason,
        actor_name: actorName,
        actor_role: actorRole,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(
      typeof err.detail === "string"
        ? err.detail
        : "Only DESK_HEAD can waive mandatory slots"
    );
  }
  return res.json();
}

export async function transitionClaimStatus(
  claimId: string,
  targetStatus: string,
  actorName: string,
  actorRole: Role
): Promise<Claim> {
  const res = await fetch(`${API_BASE}/api/v1/claims/${claimId}/transition`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      target_status: targetStatus,
      actor_name: actorName,
      actor_role: actorRole,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    const msg =
      err.detail?.message ||
      (typeof err.detail === "string" ? err.detail : "Transition blocked");
    const missing = err.detail?.missing_mandatory_documents?.join(", ");
    const unconfirmed = err.detail?.unconfirmed_ai_fields?.join(", ");
    throw new Error(
      `${msg}${missing ? ` | Missing Docs: ${missing}` : ""}${
        unconfirmed ? ` | Unconfirmed AI Fields: ${unconfirmed}` : ""
      }`
    );
  }
  return res.json();
}

export async function sendQueryReply(
  queryId: string,
  replyText: string,
  actorName: string,
  actorRole: Role
): Promise<Claim> {
  const res = await fetch(`${API_BASE}/api/v1/queries/${queryId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reply_text: replyText,
      actor_name: actorName,
      actor_role: actorRole,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    const missing = err.detail?.missing_mandatory_documents?.join(", ");
    throw new Error(
      `${err.detail?.message || "Cannot send reply"}${
        missing ? ` (Missing: ${missing})` : ""
      }`
    );
  }
  return res.json();
}

export async function simulateIncomingTpaQuery(claimId: string): Promise<Claim> {
  const res = await fetch(
    `${API_BASE}/api/v1/webhooks/simulate-tpa-query/${claimId}`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error("Failed to simulate TPA query");
  return res.json();
}

export async function signDoctorNote(
  queryId: string,
  justification: string,
  doctorName: string
): Promise<Claim> {
  const res = await fetch(
    `${API_BASE}/api/v1/doctor/magic-link/${queryId}/sign`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clinical_justification: justification,
        doctor_name: doctorName,
      }),
    }
  );
  if (!res.ok) throw new Error("Failed to sign clinical justification");
  return res.json();
}

export async function fetchRulesMatrix() {
  const res = await fetch(`${API_BASE}/api/v1/rules`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load rules");
  return res.json();
}

export async function createChecklistRule(payload: {
  insurer_id: string | null;
  procedure_id: string | null;
  slot_key: string;
  slot_label: string;
  stage_required: string;
  is_mandatory: boolean;
  actor_role: Role;
}) {
  const res = await fetch(`${API_BASE}/api/v1/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to create rule");
  }
  return res.json();
}

export async function fetchAuditLogs(): Promise<AuditLogItem[]> {
  const res = await fetch(`${API_BASE}/api/v1/audit-logs`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export function getFullPolicyNumber(claim: Claim): string {
  return claim.policy_number_full || claim.policy_number_masked;
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ access_token: string; token_type: string; user: AuthUser }> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Authentication failed. Invalid email or password.");
  }
  return res.json();
}

export async function createClaim(payload: CreateClaimPayload): Promise<Claim> {
  const res = await fetch(`${API_BASE}/api/v1/claims`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create new claim");
  }
  return res.json();
}

export async function auditUnmaskPolicyNumber(
  claimId: string,
  actorName: string,
  actorRole: Role
): Promise<{ status: string; claim_id: string; policy_number_full: string }> {
  const res = await fetch(`${API_BASE}/api/v1/claims/${claimId}/audit-unmask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      actor_name: actorName,
      actor_role: actorRole,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to audit PII unmask event");
  }
  return res.json();
}

export function getDocumentFileUrl(claimId: string, docId: string): string {
  return `${API_BASE}/api/v1/claims/${claimId}/documents/${docId}/file`;
}

export async function createNewClaim(payload: {
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
  actor_name: string;
  actor_role: Role;
}): Promise<Claim> {
  const res = await fetch(`${API_BASE}/api/v1/claims`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Failed to create cashless admission");
  }
  return res.json();
}

export async function auditPolicyUnmask(
  claimId: string,
  actorName: string,
  actorRole: Role
): Promise<void> {
  await fetch(
    `${API_BASE}/api/v1/claims/${claimId}/audit-unmask?actor_name=${encodeURIComponent(
      actorName
    )}&actor_role=${encodeURIComponent(actorRole)}`,
    { method: "POST" }
  );
}
