"use client";

import React, { useState } from "react";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Upload,
  FileText,
  Download,
  Eye,
  EyeOff,
  ArrowRight,
  Check,
  Edit3,
  Smartphone,
  Sparkles,
  Layers,
  History,
} from "lucide-react";
import { Claim, Role } from "@/lib/types";
import {
  API_BASE,
  uploadDocumentToClaim,
  injectSampleScanToClaim,
  reassignDocumentSlot,
  confirmExtractedField,
  waiveChecklistSlot,
  transitionClaimStatus,
  getFullPolicyNumber,
  auditPolicyUnmask,
} from "@/lib/api";
import { SlaTimerBadge } from "./SlaTimerBadge";

interface Props {
  claim: Claim;
  currentRole: Role;
  currentActorName: string;
  onClose: () => void;
  onClaimUpdated: (updated: Claim) => void;
  onOpenDoctorMobile: (claimId: string, queryId: string) => void;
  onNotify?: (msg: string, type?: "success" | "error") => void;
}

const STAGES = [
  { key: "DRAFT", label: "Pre-Auth Draft" },
  { key: "PREAUTH_SENT", label: "Pre-Auth Sent" },
  { key: "QUERY", label: "TPA Query" },
  { key: "APPROVED", label: "Approved" },
  { key: "ENHANCEMENT", label: "Enhancement" },
  { key: "FINAL_BILL", label: "Final Bill (3h)" },
  { key: "SETTLED", label: "Settled" },
];

export function ClaimWorkspaceModal({
  claim,
  currentRole,
  currentActorName,
  onClose,
  onClaimUpdated,
  onOpenDoctorMobile,
  onNotify,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    "CHECKLIST" | "AI_STUDIO" | "PACKET_PREVIEW" | "TIMELINE"
  >("CHECKLIST");
  const [revealPolicy, setRevealPolicy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editedValue, setEditedValue] = useState("");
  const [waivingSlotId, setWaivingSlotId] = useState<string | null>(null);
  const [waiverReason, setWaiverReason] = useState("");
  const [viewerMode, setViewerMode] = useState<"SNIPPETS" | "PDF_FRAME">("SNIPPETS");
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);
  const [dragOverSlotKey, setDragOverSlotKey] = useState<string | null>(null);

  function notify(text: string, type: "error" | "success" = "success") {
    setBanner({ type, text });
    if (onNotify) onNotify(text, type);
  }

  async function handleTogglePolicyMask() {
    const nextState = !revealPolicy;
    setRevealPolicy(nextState);
    if (nextState) {
      await auditPolicyUnmask(claim.id, currentActorName, currentRole);
      if (onNotify) {
        onNotify(`DPDP Audit Logged: Policy unmasked by ${currentActorName}`, "success");
      }
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setBanner(null);
    try {
      const updated = await uploadDocumentToClaim(
        claim.id,
        file,
        currentActorName,
        currentRole
      );
      onClaimUpdated(updated);
      notify(`Analyzed '${file.name}'. AI sorted slot & extracted clinical fields.`);
    } catch (err: any) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickSampleUpload(sampleFileName: string) {
    setBusy(true);
    setBanner(null);
    try {
      const updated = await injectSampleScanToClaim(
        claim.id,
        sampleFileName,
        currentActorName,
        currentRole
      );
      onClaimUpdated(updated);
      notify(`Processed '${sampleFileName}' through Multimodal AI Vision pipeline.`);
    } catch (err: any) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleReassignSlot(docId: string, targetSlotKey: string) {
    if (!targetSlotKey) return;
    setBusy(true);
    setBanner(null);
    try {
      const updated = await reassignDocumentSlot(
        claim.id,
        docId,
        targetSlotKey,
        currentActorName,
        currentRole
      );
      onClaimUpdated(updated);
      notify(`Reassigned document to '${targetSlotKey}' & logged human override.`);
    } catch (err: any) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmField(fieldId: string, customVal: string | null) {
    setBusy(true);
    setBanner(null);
    try {
      const updated = await confirmExtractedField(
        claim.id,
        fieldId,
        customVal,
        currentActorName,
        currentRole
      );
      onClaimUpdated(updated);
      setEditingFieldId(null);
      notify("Field confirmed by human reviewer and locked into TPA packet.");
    } catch (err: any) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleWaiveSlot(itemId: string) {
    setBusy(true);
    setBanner(null);
    try {
      const updated = await waiveChecklistSlot(
        claim.id,
        itemId,
        waiverReason,
        currentActorName,
        currentRole
      );
      onClaimUpdated(updated);
      setWaivingSlotId(null);
      setWaiverReason("");
      notify("Mandatory slot waived by Desk Head with DPDP audit entry.");
    } catch (err: any) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleStageTransition(targetStatus: string) {
    setBusy(true);
    setBanner(null);
    try {
      const updated = await transitionClaimStatus(
        claim.id,
        targetStatus,
        currentActorName,
        currentRole
      );
      onClaimUpdated(updated);
      notify(`Claim ${claim.id} transitioned to ${targetStatus}.`);
    } catch (err: any) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  const quarantinedDocs = claim.documents.filter((d) => d.needs_manual_sorting);
  const completionPct =
    claim.gaps.total_mandatory > 0
      ? Math.round((claim.gaps.verified_mandatory / claim.gaps.total_mandatory) * 100)
      : 100;

  const samplePdfUrl =
    claim.id === "CLM-3385"
      ? `${API_BASE}/api/v1/sample-docs/CLM3385_Dengue_Serial_Platelet_Lab_Report.pdf`
      : `${API_BASE}/api/v1/sample-docs/CLM3381_Abdominal_Ultrasound_USG_Report.pdf`;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-zinc-950/35 backdrop-blur-[2px] flex justify-end animate-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-6xl h-full flex flex-col shadow-[-16px_0_40px_rgba(0,0,0,0.12)] border-l border-zinc-200 animate-slide-over overflow-hidden"
      >
        {/* Top Drawer Header */}
        <div className="px-6 py-4 bg-white border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-zinc-900 text-white">
              {claim.id}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-zinc-900 tracking-tight">
                  {claim.patient_name}
                </h2>
                <span className="text-xs font-mono text-zinc-500">
                  {claim.patient_age}Y/{claim.patient_gender} · {claim.uhid} · {claim.ward_bed}
                </span>
              </div>
              <div className="text-xs text-zinc-500 flex flex-wrap items-center gap-2 mt-0.5">
                <strong className="text-zinc-800">{claim.insurer.name}</strong>
                <span>·</span>
                <span>
                  Procedure: <strong className="text-zinc-800">{claim.procedure.name}</strong>
                </span>
                <span>·</span>
                <span>Doctor: {claim.treating_doctor_name}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <SlaTimerBadge initialSeconds={claim.sla_remaining_seconds} stageLabel="SLA" />
            <a
              href={`${API_BASE}/api/v1/claims/${claim.id}/packet.pdf`}
              download={`${claim.id}_TPA_Submission_Packet.pdf`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-teal-700 hover:bg-teal-600 text-white transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Export Merged PDF
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition"
              title="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stage Stepper + DPDP Policy Mask */}
        <div className="px-6 py-2.5 bg-[#F7F7F5] border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {STAGES.map((st, idx) => {
              const isCurrent = claim.status === st.key;
              return (
                <React.Fragment key={st.key}>
                  <button
                    onClick={() => handleStageTransition(st.key)}
                    disabled={busy}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium whitespace-nowrap transition border ${
                      isCurrent
                        ? "bg-zinc-900 text-white border-zinc-900 shadow-sm"
                        : "bg-white text-zinc-600 border-zinc-200/90 hover:border-zinc-400"
                    }`}
                  >
                    {st.label}
                  </button>
                  {idx < STAGES.length - 1 && (
                    <ArrowRight className="w-3 h-3 text-zinc-300 shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded border border-zinc-200/90">
              <span className="text-zinc-400 text-[11px]">Policy (DPDP):</span>
              <span className="font-mono text-xs font-medium text-zinc-800">
                {revealPolicy ? getFullPolicyNumber(claim) : claim.policy_number_masked}
              </span>
              <button
                onClick={handleTogglePolicyMask}
                className="text-teal-700 hover:underline inline-flex items-center gap-0.5 text-[11px]"
              >
                {revealPolicy ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {revealPolicy ? "Mask" : "Reveal"}
              </button>
            </div>
          </div>
        </div>

        {/* Feedback Banner */}
        {banner && (
          <div
            className={`px-6 py-2 text-xs font-medium flex items-center justify-between border-b shrink-0 animate-fade-up ${
              banner.type === "error"
                ? "bg-red-50 text-red-800 border-red-200"
                : "bg-teal-50 text-teal-900 border-teal-200"
            }`}
          >
            <span>{banner.text}</span>
            <button onClick={() => setBanner(null)} className="text-xs underline ml-4">
              Dismiss
            </button>
          </div>
        )}

        {/* Sub-Navigation Tabs + Quick Injectors */}
        <div className="px-6 bg-white border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab("CHECKLIST")}
              className={`py-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === "CHECKLIST"
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Checklist &amp; Gatekeeper
              <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-800">
                {claim.gaps.verified_mandatory}/{claim.gaps.total_mandatory}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("AI_STUDIO")}
              className={`py-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === "AI_STUDIO"
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-700" />
              AI Verification Studio
              {claim.gaps.unconfirmed_ai_fields.length > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-mono text-[10px]">
                  {claim.gaps.unconfirmed_ai_fields.length} Pending
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("PACKET_PREVIEW")}
              className={`py-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === "PACKET_PREVIEW"
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-teal-700" />
              Merged TPA Packet Preview
            </button>

            <button
              onClick={() => setActiveTab("TIMELINE")}
              className={`py-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
                activeTab === "TIMELINE"
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Timeline ({claim.timeline_events.length})
            </button>
          </div>

          <div className="py-1.5 flex items-center gap-1.5 flex-wrap">
            {claim.id === "CLM-3381" && (
              <button
                onClick={() =>
                  handleQuickSampleUpload("CLM3381_Abdominal_Ultrasound_USG_Report.pdf")
                }
                disabled={busy}
                className="px-2.5 py-1 rounded text-[11px] font-medium bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 transition"
              >
                + Inject Ultrasound Report PDF
              </button>
            )}
            {claim.id === "CLM-3385" && (
              <button
                onClick={() =>
                  handleQuickSampleUpload("CLM3385_Dengue_Serial_Platelet_Lab_Report.pdf")
                }
                disabled={busy}
                className="px-2.5 py-1 rounded text-[11px] font-medium bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 transition"
              >
                + Inject Platelet Count PDF
              </button>
            )}
            <button
              onClick={() =>
                handleQuickSampleUpload("Blurry_Low_Confidence_Ward_Scan.pdf")
              }
              disabled={busy}
              className="px-2.5 py-1 rounded text-[11px] font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-300 transition"
            >
              + Test Blurry Scan (&lt;75% Fallback)
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-[#FBFBFA]">
          {activeTab === "CHECKLIST" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-up">
              <div className="lg:col-span-8 space-y-4">
                {quarantinedDocs.length > 0 && (
                  <div className="p-4 rounded-lg bg-amber-50/90 border border-amber-300 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-950 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-amber-700" />
                        Low-Confidence AI Quarantine Tray (Manual Slot Selection Required)
                      </span>
                      <span className="text-[11px] font-mono text-amber-800">
                        Confidence &lt; 75% Guardrail
                      </span>
                    </div>
                    {quarantinedDocs.map((qdoc) => (
                      <div
                        key={qdoc.id}
                        draggable
                        onDragStart={(e) => {
                          setDraggedDocId(qdoc.id);
                          e.dataTransfer.setData("text/plain", qdoc.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDraggedDocId(null);
                          setDragOverSlotKey(null);
                        }}
                        className={`p-3 bg-white rounded-md border flex flex-wrap items-center justify-between gap-2 text-xs transition cursor-grab active:cursor-grabbing select-none ${
                          draggedDocId === qdoc.id
                            ? "opacity-60 border-teal-500 shadow-md ring-2 ring-teal-500/20"
                            : "border-amber-200 hover:border-amber-400"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400 font-mono text-[11px] select-none" title="Drag this card to any slot row below">⠿</span>
                          <span className="font-medium text-zinc-900">{qdoc.file_name}</span>
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                            AI {Math.round(qdoc.ai_confidence * 100)}% guess:{" "}
                            {qdoc.ai_predicted_slot_key}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">(Drag to slot row)</span>
                        </div>
                        <select
                          onChange={(e) => handleReassignSlot(qdoc.id, e.target.value)}
                          defaultValue=""
                          className="px-2.5 py-1 rounded border border-zinc-300 text-xs bg-white font-medium"
                        >
                          <option value="" disabled>
                            Move to checklist slot...
                          </option>
                          {claim.checklist_items.map((slot) => (
                            <option key={slot.slot_key} value={slot.slot_key}>
                              {slot.slot_label} ({slot.slot_key})
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-white border border-zinc-200/90 rounded-lg overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F7F7F5] border-b border-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        <th className="py-2.5 px-4">Required Document Slot</th>
                        <th className="py-2.5 px-3">Stage</th>
                        <th className="py-2.5 px-3">Rule</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-4 text-right">Slot Reassign / Waiver</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200/70 text-xs">
                      {claim.checklist_items.map((item) => {
                        const isMissing = item.status === "MISSING";
                        const attachedDoc = claim.documents.find(
                          (d) => d.id === item.document_id
                        );
                        return (
                          <tr
                            key={item.id}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "move";
                              if (dragOverSlotKey !== item.slot_key) {
                                setDragOverSlotKey(item.slot_key);
                              }
                            }}
                            onDragLeave={(e) => {
                              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                              setDragOverSlotKey(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const docId = draggedDocId || e.dataTransfer.getData("text/plain");
                              setDragOverSlotKey(null);
                              setDraggedDocId(null);
                              if (docId) {
                                handleReassignSlot(docId, item.slot_key);
                              }
                            }}
                            className={`transition-all duration-150 ${
                              dragOverSlotKey === item.slot_key
                                ? "bg-teal-50/90 ring-2 ring-teal-600 ring-inset shadow-sm"
                                : isMissing && item.is_mandatory
                                ? "bg-red-50/30"
                                : "bg-white hover:bg-zinc-50/60"
                            }`}
                          >
                            <td className="py-3 px-4">
                              <div className="font-medium text-zinc-900">
                                {item.slot_label}
                              </div>
                              <div className="text-[11px] font-mono text-zinc-400">
                                {item.slot_key}
                                {attachedDoc && (
                                  <span
                                    draggable
                                    onDragStart={(e) => {
                                      setDraggedDocId(attachedDoc.id);
                                      e.dataTransfer.setData("text/plain", attachedDoc.id);
                                      e.dataTransfer.effectAllowed = "move";
                                    }}
                                    onDragEnd={() => {
                                      setDraggedDocId(null);
                                      setDragOverSlotKey(null);
                                    }}
                                    className="ml-2 inline-flex items-center gap-1 text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/80 cursor-grab active:cursor-grabbing hover:bg-teal-100/70 transition"
                                    title="Drag to reassign to another slot"
                                  >
                                    <span className="text-teal-400 text-[10px]">⠿</span>
                                    {attachedDoc.file_name} (
                                    {Math.round(attachedDoc.ai_confidence * 100)}% AI)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-zinc-600">
                              {item.stage_required}
                            </td>
                            <td className="py-3 px-3">
                              {item.is_mandatory ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-zinc-100 text-zinc-800 border border-zinc-300">
                                  MANDATORY
                                </span>
                              ) : (
                                <span className="text-[11px] text-zinc-400">Optional</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {item.status === "VERIFIED" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Verified
                                </span>
                              )}
                              {item.status === "WAIVED_BY_HEAD" && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-300"
                                  title={item.waiver_reason || ""}
                                >
                                  Waived by Head
                                </span>
                              )}
                              {item.status === "MISSING" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
                                  <AlertCircle className="w-3 h-3 text-red-600" />
                                  Missing
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {attachedDoc ? (
                                <select
                                  onChange={(e) =>
                                    handleReassignSlot(attachedDoc.id, e.target.value)
                                  }
                                  value={item.slot_key}
                                  className="px-2 py-1 rounded border border-zinc-200 text-[11px] bg-zinc-50 text-zinc-700"
                                >
                                  {claim.checklist_items.map((s) => (
                                    <option key={s.slot_key} value={s.slot_key}>
                                      Slot: {s.slot_label}
                                    </option>
                                  ))}
                                </select>
                              ) : isMissing && item.is_mandatory ? (
                                waivingSlotId === item.id ? (
                                  <div className="inline-flex items-center gap-1">
                                    <input
                                      type="text"
                                      placeholder="Audit reason..."
                                      value={waiverReason}
                                      onChange={(e) => setWaiverReason(e.target.value)}
                                      className="px-2 py-1 text-xs border border-zinc-300 rounded w-36 bg-white"
                                    />
                                    <button
                                      onClick={() => handleWaiveSlot(item.id)}
                                      className="px-2 py-1 bg-zinc-900 text-white rounded text-[11px]"
                                    >
                                      Save
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setWaivingSlotId(item.id)}
                                    className="text-[11px] text-zinc-500 hover:text-zinc-900 underline"
                                  >
                                    Waive (Desk Head)
                                  </button>
                                )
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right 4 Columns: Dropzone + Animated Gatekeeper Readiness Card */}
              <div className="lg:col-span-4 space-y-4">
                <label className="block p-5 border border-dashed border-zinc-300 hover:border-teal-700 rounded-lg bg-white cursor-pointer transition text-center shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <Upload className="w-5 h-5 text-teal-700 mx-auto mb-2" />
                  <div className="text-xs font-semibold text-zinc-900">
                    Drop Medical Scans or Click to Upload
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    AI sorts into checklist slots &amp; extracts fields with source quotes
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <div className="p-4 rounded-lg border border-zinc-200/90 bg-white space-y-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                      Submission Gatekeeper
                    </span>
                    {claim.gaps.is_ready_for_submission ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        READY ({completionPct}%)
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-red-50 text-red-700 border border-red-200">
                        BLOCKED ({completionPct}%)
                      </span>
                    )}
                  </div>

                  {/* Smooth Animated Readiness Progress Bar */}
                  <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        claim.gaps.is_ready_for_submission
                          ? "bg-emerald-600"
                          : "bg-amber-500"
                      }`}
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>

                  {claim.gaps.missing_mandatory_documents.length > 0 && (
                    <div className="p-3 rounded-md bg-red-50/70 border border-red-200 text-xs text-red-900 space-y-1">
                      <div className="font-semibold">Missing Mandatory Documents:</div>
                      <ul className="list-disc list-inside text-[11px]">
                        {claim.gaps.missing_mandatory_documents.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {claim.gaps.unconfirmed_ai_fields.length > 0 && (
                    <div className="p-3 rounded-md bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-1">
                      <div className="font-semibold">
                        Unconfirmed AI Fields ({claim.gaps.unconfirmed_ai_fields.length}):
                      </div>
                      <button
                        onClick={() => setActiveTab("AI_STUDIO")}
                        className="text-[11px] font-semibold text-teal-800 underline"
                      >
                        Open AI Verification Studio to confirm →
                      </button>
                    </div>
                  )}

                  <div className="pt-1 flex flex-col gap-2">
                    <button
                      onClick={() => handleStageTransition("PREAUTH_SENT")}
                      disabled={busy}
                      className="w-full py-2 px-3 rounded-md text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white transition"
                    >
                      Verify &amp; Dispatch Pre-Auth Packet
                    </button>
                    <button
                      onClick={() => setActiveTab("PACKET_PREVIEW")}
                      className="w-full py-1.5 px-3 rounded-md text-xs font-medium bg-[#F7F7F5] border border-zinc-300 hover:bg-zinc-200/70 text-zinc-800 transition"
                    >
                      Preview Merged TPA Dossier PDF
                    </button>
                    {claim.queries.length > 0 && (
                      <button
                        onClick={() =>
                          onOpenDoctorMobile(claim.id, claim.queries[0].id)
                        }
                        className="w-full py-1.5 px-3 rounded-md text-xs font-medium bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-800 inline-flex items-center justify-center gap-1.5 transition"
                      >
                        <Smartphone className="w-3.5 h-3.5 text-teal-700" />
                        Open Doctor Mobile Sign-Off Link
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Split-Screen AI Verification Studio */}
          {activeTab === "AI_STUDIO" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-up">
              <div className="lg:col-span-5 bg-white border border-zinc-200/90 rounded-lg overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
                <div className="px-4 py-2.5 bg-zinc-900 text-white flex items-center justify-between">
                  <span className="text-xs font-mono text-teal-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    SOURCE DOCUMENT INSPECTOR
                  </span>
                  <div className="flex items-center gap-1 bg-zinc-800 p-0.5 rounded text-[11px]">
                    <button
                      onClick={() => setViewerMode("SNIPPETS")}
                      className={`px-2 py-0.5 rounded transition ${
                        viewerMode === "SNIPPETS"
                          ? "bg-zinc-950 text-white"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      OCR Quotes
                    </button>
                    <button
                      onClick={() => setViewerMode("PDF_FRAME")}
                      className={`px-2 py-0.5 rounded transition ${
                        viewerMode === "PDF_FRAME"
                          ? "bg-zinc-950 text-white"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      Live PDF Scan
                    </button>
                  </div>
                </div>

                {viewerMode === "PDF_FRAME" ? (
                  <iframe
                    src={samplePdfUrl}
                    title="Medical Scan Preview"
                    className="w-full h-[420px] border-0 bg-zinc-100"
                  />
                ) : (
                  <div className="p-4 bg-[#FAF9F5] font-mono text-xs space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar">
                    <div className="border-b border-zinc-300 pb-2">
                      <div className="font-bold text-zinc-900">
                        COMPANY A MULTISPECIALITY HOSPITAL — NASHIK
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        Patient: {claim.patient_name} | UHID: {claim.uhid} | Claim:{" "}
                        {claim.id}
                      </div>
                    </div>
                    {claim.extracted_fields.map((fld) => (
                      <div
                        key={fld.id}
                        className={`p-3 rounded-md border text-[11px] leading-relaxed ${
                          fld.status === "PENDING"
                            ? "bg-amber-100/70 border-amber-400 text-zinc-900"
                            : "bg-emerald-50/70 border-emerald-300 text-zinc-800"
                        }`}
                      >
                        <div className="font-semibold text-[10px] uppercase text-zinc-500 mb-1">
                          [{fld.field_label} · Page {fld.source_page}]
                        </div>
                        {fld.source_snippet}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-7 space-y-3 max-h-[460px] overflow-y-auto custom-scrollbar pr-1">
                {claim.extracted_fields.map((fld) => {
                  const isPending = fld.status === "PENDING";
                  const isEditing = editingFieldId === fld.id;
                  const displayValue = fld.confirmed_value || fld.ai_suggested_value;

                  return (
                    <div
                      key={fld.id}
                      className={`p-4 rounded-lg border transition shadow-[0_1px_2px_rgba(0,0,0,0.02)] ${
                        isPending
                          ? "bg-amber-50/50 border-amber-300"
                          : "bg-white border-zinc-200/90"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-semibold text-zinc-900">
                          {fld.field_label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-zinc-500">
                            Confidence: {Math.round(fld.confidence * 100)}%
                          </span>
                          {isPending ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                              NEEDS CLICK TO CONFIRM
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {fld.status} BY {fld.confirmed_by}
                            </span>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-2 my-2">
                          <input
                            type="text"
                            value={editedValue}
                            onChange={(e) => setEditedValue(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-xs border border-zinc-300 rounded-md font-mono bg-white"
                          />
                          <button
                            onClick={() => handleConfirmField(fld.id, editedValue)}
                            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-teal-700 text-white"
                          >
                            Save &amp; Confirm
                          </button>
                          <button
                            onClick={() => setEditingFieldId(null)}
                            className="px-2 py-1.5 text-xs text-zinc-500"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs font-mono font-medium text-zinc-900 bg-[#F7F7F5] p-2.5 rounded border border-zinc-200/80">
                          {displayValue}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-zinc-200/70">
                        <div className="text-[11px] text-zinc-600 font-mono">
                          <strong className="text-zinc-800">Snippet:</strong>{" "}
                          {fld.source_snippet}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => {
                              setEditingFieldId(fld.id);
                              setEditedValue(displayValue);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-white border border-zinc-300 hover:bg-zinc-50 text-zinc-700"
                          >
                            <Edit3 className="w-3 h-3" />
                            Edit
                          </button>
                          {isPending && (
                            <button
                              onClick={() => handleConfirmField(fld.id, null)}
                              disabled={busy}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold bg-teal-700 hover:bg-teal-600 text-white shadow-sm"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Confirm Field
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Live Merged TPA Packet PDF Preview Studio */}
          {activeTab === "PACKET_PREVIEW" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-up">
              <div className="lg:col-span-4 bg-white rounded-lg border border-zinc-200/90 p-4 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="border-b border-zinc-100 pb-3">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                    NABH · ROHINI ID: 8900142109
                  </span>
                  <h3 className="text-sm font-semibold text-zinc-900 mt-1.5">
                    {claim.insurer.name} — Submission Dossier
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {claim.insurer.format_notes}
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="font-semibold text-zinc-700 uppercase text-[11px] tracking-wider">
                    Compiled Packet Structure:
                  </div>
                  <div className="p-3 rounded bg-[#F7F7F5] border border-zinc-200/80 space-y-1.5 font-mono text-[11px]">
                    <div>01. Hospital &amp; IRDAI SLA Cover Sheet</div>
                    <div>
                      02. Checklist Matrix ({claim.gaps.verified_mandatory}/
                      {claim.gaps.total_mandatory} Mandatory Verified)
                    </div>
                    <div>
                      03. Confirmed Clinical Fields ({claim.extracted_fields.length} items)
                    </div>
                    <div>04. Treating Consultant Sign-Off &amp; DPDP Hash</div>
                  </div>
                </div>

                <a
                  href={`${API_BASE}/api/v1/claims/${claim.id}/packet.pdf`}
                  download={`${claim.id}_TPA_Submission_Packet.pdf`}
                  className="w-full py-2.5 px-4 rounded-md text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white flex items-center justify-center gap-2 transition shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Download Official Merged PDF
                </a>
              </div>

              <div className="lg:col-span-8 bg-zinc-900 rounded-lg border border-zinc-300 overflow-hidden shadow-lg">
                <div className="px-4 py-2.5 bg-zinc-950 text-zinc-200 flex items-center justify-between text-xs font-mono">
                  <span>LIVE COMPILED PDF — {claim.id}_TPA_Submission_Packet.pdf</span>
                  <a
                    href={`${API_BASE}/api/v1/claims/${claim.id}/packet.pdf?inline=true`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-400 hover:underline"
                  >
                    Open Fullscreen PDF ↗
                  </a>
                </div>
                <iframe
                  key={`${claim.id}-${claim.status}-${claim.gaps.verified_mandatory}-${claim.extracted_fields.length}`}
                  src={`${API_BASE}/api/v1/claims/${claim.id}/packet.pdf?inline=true`}
                  title="Compiled TPA Packet PDF"
                  className="w-full h-[480px] border-0 bg-zinc-200"
                />
              </div>
            </div>
          )}

          {/* TAB 4: Stage & Audit Timeline */}
          {activeTab === "TIMELINE" && (
            <div className="space-y-3 max-w-3xl animate-fade-up">
              {claim.timeline_events.map((ev) => (
                <div
                  key={ev.id}
                  className="p-4 rounded-lg border border-zinc-200/90 bg-white flex items-start justify-between gap-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-zinc-900 text-white">
                        {ev.stage}
                      </span>
                      <span className="text-xs font-semibold text-zinc-900">
                        {ev.title}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600">{ev.detail}</p>
                  </div>
                  <div className="text-right font-mono text-[11px] text-zinc-400 shrink-0">
                    <div className="text-zinc-700">
                      {ev.actor_name} ({ev.actor_role})
                    </div>
                    <div>{new Date(ev.created_at).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
