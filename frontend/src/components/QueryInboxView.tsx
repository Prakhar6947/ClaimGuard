"use client";

import React, { useState } from "react";
import {
  Mail,
  Send,
  Smartphone,
  AlertCircle,
  FileWarning,
  FolderOpen,
  CheckCircle2,
  Sparkles,
  Clock,
} from "lucide-react";
import { Claim, Role } from "@/lib/types";
import { sendQueryReply } from "@/lib/api";
import { SlaTimerBadge } from "./SlaTimerBadge";

interface Props {
  claims: Claim[];
  currentRole: Role;
  currentActorName: string;
  onSelectClaim: (claim: Claim) => void;
  onClaimUpdated: (updated: Claim) => void;
  onOpenDoctorMobile: (claimId: string, queryId: string) => void;
}

export function QueryInboxView({
  claims,
  currentRole,
  currentActorName,
  onSelectClaim,
  onClaimUpdated,
  onOpenDoctorMobile,
}: Props) {
  const allQueries = claims.flatMap((c) =>
    c.queries.map((q) => ({ query: q, claim: c }))
  );

  const [selectedQueryId, setSelectedQueryId] = useState<string>(
    allQueries[0]?.query.id || ""
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    msg: string;
  } | null>(null);

  const activePair =
    allQueries.find((item) => item.query.id === selectedQueryId) ||
    allQueries[0];

  async function handleDispatchReply(queryId: string, defaultDraft: string) {
    setFeedback(null);
    setBusy(true);
    try {
      const textToSend = drafts[queryId] ?? defaultDraft;
      const updated = await sendQueryReply(
        queryId,
        textToSend,
        currentActorName,
        currentRole
      );
      onClaimUpdated(updated);
      setFeedback({
        type: "success",
        msg: "TPA Query Response & Verified Packet dispatched. Claim status updated.",
      });
    } catch (err: any) {
      setFeedback({ type: "error", msg: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (!activePair) {
    return (
      <div className="bg-white rounded-lg border border-zinc-200 p-12 text-center text-xs text-zinc-500">
        No TPA queries in inbox. Use the Reviewer Demo Toolkit to simulate a live TPA email webhook.
      </div>
    );
  }

  const { query, claim } = activePair;
  const currentDraft = drafts[query.id] ?? query.draft_reply ?? "";

  return (
    <div className="bg-white rounded-lg border border-zinc-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03)] h-[calc(100vh-148px)] min-h-[560px] flex overflow-hidden animate-fade-up">
      {/* LEFT PANE: Scrollable Query Queue */}
      <div className="w-full md:w-80 lg:w-96 border-r border-zinc-200 flex flex-col bg-[#FBFBFA]">
        <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-800">
              TPA Query Queue ({allQueries.length})
            </h2>
            <p className="text-[11px] text-zinc-500">
              Sorted by IRDAI reply countdown
            </p>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
            {allQueries.filter((x) => x.query.status !== "RESOLVED").length} Open
          </span>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-zinc-200/70">
          {allQueries.map(({ query: qItem, claim: cItem }) => {
            const isSelected = qItem.id === query.id;
            return (
              <button
                key={qItem.id}
                onClick={() => {
                  setSelectedQueryId(qItem.id);
                  setFeedback(null);
                }}
                className={`w-full text-left p-3.5 transition relative flex flex-col gap-1.5 ${
                  isSelected
                    ? "bg-white shadow-[inset_3px_0_0_#0D6E66]"
                    : "hover:bg-zinc-100/70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-zinc-900">
                      {cItem.id}
                    </span>
                    <span className="text-xs font-medium text-zinc-700 truncate">
                      · {cItem.patient_name}
                    </span>
                  </div>
                  <SlaTimerBadge
                    initialSeconds={cItem.sla_remaining_seconds}
                    compact
                  />
                </div>

                <div className="text-[11px] font-medium text-zinc-800 truncate">
                  {cItem.insurer.name} — {cItem.procedure.name}
                </div>

                <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                  {qItem.ai_summary}
                </p>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-mono text-zinc-400">
                    Ref: {qItem.tpa_reference_no}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                      qItem.status === "RESOLVED"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-amber-50 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {qItem.status}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT PANE: Scrollable Query Inspector & Reply Composer */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Top Query Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3 bg-white shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-zinc-900 text-white">
                {claim.id}
              </span>
              <h3 className="text-sm font-semibold text-zinc-900">
                {claim.patient_name} ({claim.patient_age}Y/{claim.patient_gender})
              </h3>
              <span className="text-xs text-zinc-400 font-mono">
                · {query.tpa_reference_no}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              From: <span className="font-mono text-zinc-700">{query.sender_email}</span> ·{" "}
              Subject: <span className="text-zinc-700">{query.raw_subject}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectClaim(claim)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#F7F7F5] hover:bg-zinc-200/70 text-zinc-900 border border-zinc-300 transition"
            >
              <FolderOpen className="w-3.5 h-3.5 text-teal-700" />
              Open Claim Checklist ({claim.gaps.missing_mandatory_documents.length} Gaps)
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`px-5 py-2.5 text-xs font-medium border-b shrink-0 ${
              feedback.type === "error"
                ? "bg-red-50 text-red-800 border-red-200"
                : "bg-emerald-50 text-emerald-900 border-emerald-200"
            }`}
          >
            {feedback.msg}
          </div>
        )}

        {/* Independently Scrollable Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
          {/* 1. AI Summary & Action Items Card */}
          <div className="p-4 rounded-lg bg-amber-50/60 border border-amber-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-950 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                AI Query Summary &amp; Mapped Checklist Gaps
              </span>
              <span className="text-[11px] font-mono text-amber-800">
                Missing Slot: {query.missing_slot_key || "None"}
              </span>
            </div>
            <p className="text-xs text-zinc-800 leading-relaxed">{query.ai_summary}</p>
            <div className="space-y-1.5 pt-1">
              {query.ai_action_items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-xs font-medium text-zinc-900 bg-white/80 px-2.5 py-1.5 rounded border border-amber-200/70"
                >
                  <FileWarning className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Treating Doctor Mobile Magic-Link Bar */}
          <div className="p-3.5 rounded-lg bg-[#F7F7F5] border border-zinc-200/90 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-semibold text-zinc-900 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-teal-700" />
                Treating Consultant Note ({claim.treating_doctor_name})
              </div>
              {query.doctor_note_signed ? (
                <p className="text-emerald-800 text-xs">
                  ✓ Signed on phone: &ldquo;{query.doctor_justification_text}&rdquo;
                </p>
              ) : (
                <p className="text-zinc-500">
                  Awaiting 1-tap doctor sign-off via mobile magic link (replaces WhatsApp chasing)
                </p>
              )}
            </div>
            <button
              onClick={() => onOpenDoctorMobile(claim.id, query.id)}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-white border border-zinc-300 hover:border-zinc-500 text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition"
            >
              {query.doctor_note_signed ? "Preview Signed Mobile Note" : "Launch Doctor Mobile Link →"}
            </button>
          </div>

          {/* 3. Human-Reviewed Reply Composer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-800">
                Draft Response to TPA Adjudication Desk (Human Review Required)
              </label>
              <span className="text-[11px] font-mono text-zinc-400">
                Auto-send disabled per hospital policy
              </span>
            </div>
            <textarea
              rows={6}
              value={currentDraft}
              onChange={(e) => setDrafts({ ...drafts, [query.id]: e.target.value })}
              className="w-full p-3 text-xs font-mono leading-relaxed bg-[#FBFBFA] border border-zinc-300 rounded-md focus:bg-white focus:outline-none focus:border-teal-700 custom-scrollbar"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {!claim.gaps.is_ready_for_submission ? (
                <span className="text-[11px] text-red-700 flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  Gatekeeper Active: Clear missing checklist item (
                  {claim.gaps.missing_mandatory_documents.join(", ") ||
                    "Unconfirmed AI fields"}
                  ) before sending.
                </span>
              ) : (
                <span className="text-[11px] text-emerald-700 flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  All mandatory checklist items verified. Ready to dispatch.
                </span>
              )}

              <button
                onClick={() =>
                  handleDispatchReply(query.id, query.draft_reply || "")
                }
                disabled={busy || query.status === "RESOLVED"}
                className="px-4 py-2 rounded-md text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-300 text-white inline-flex items-center gap-1.5 transition shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                {query.status === "RESOLVED"
                  ? "Query Resolved & Sent"
                  : "Approve & Send Verified Packet"}
              </button>
            </div>
          </div>

          {/* 4. Verbatim Original TPA Email Thread (Always visible below summary) */}
          <div className="border border-zinc-200 rounded-lg overflow-hidden">
            <div className="px-3.5 py-2 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span className="flex items-center gap-1.5 font-semibold text-zinc-700">
                <Mail className="w-3.5 h-3.5" />
                ORIGINAL VERBATIM TPA EMAIL MESSAGE
              </span>
              <span>Received: {new Date(query.received_at).toLocaleTimeString()}</span>
            </div>
            <pre className="p-3.5 text-xs font-mono text-zinc-700 bg-white whitespace-pre-wrap leading-relaxed custom-scrollbar max-h-60 overflow-y-auto">
              {query.raw_email_body}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
