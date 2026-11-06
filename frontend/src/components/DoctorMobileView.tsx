"use client";

import React, { useState } from "react";
import { Smartphone, CheckCircle2, ArrowLeft, FileSignature } from "lucide-react";
import { Claim } from "@/lib/types";
import { signDoctorNote } from "@/lib/api";

interface Props {
  claim: Claim;
  queryId?: string;
  onBackToDesk: () => void;
  onClaimUpdated: (updated: Claim) => void;
}

export function DoctorMobileView({
  claim,
  queryId,
  onBackToDesk,
  onClaimUpdated,
}: Props) {
  const activeQuery =
    claim.queries.find((q) => q.id === queryId) || claim.queries[0];

  const [justification, setJustification] = useState(
    activeQuery?.doctor_justification_text ||
      `Patient ${claim.patient_name} (${claim.patient_age}Y/${claim.patient_gender}) admitted under emergency protocol for ${claim.procedure.name}. Inpatient monitoring and parenteral therapy are medically necessary per standard clinical guidelines.`
  );
  const [signed, setSigned] = useState(activeQuery?.doctor_note_signed || false);
  const [saving, setSaving] = useState(false);

  async function handleSign(e: React.FormEvent) {
    e.preventDefault();
    if (!activeQuery) return;
    setSaving(true);
    try {
      const updated = await signDoctorNote(
        activeQuery.id,
        justification,
        claim.treating_doctor_name
      );
      onClaimUpdated(updated);
      setSigned(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="py-4 flex flex-col items-center">
      <div className="mb-3 flex items-center justify-between w-full max-w-[390px]">
        <button
          onClick={onBackToDesk}
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-700 hover:text-zinc-900"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Desktop Workspace
        </button>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-200 text-zinc-800">
          360px Mobile Magic-Link Preview
        </span>
      </div>

      {/* Simulated Mobile Handset Frame for Ward Round Ergonomics */}
      <div className="w-full max-w-[390px] bg-white border-[3px] border-zinc-900 rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-zinc-900 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-teal-400" />
            <div>
              <div className="text-xs font-semibold">
                Company A Hospital — Doctor Quick-Sign
              </div>
              <div className="text-[10px] text-zinc-400 font-mono">
                Magic Token: {activeQuery?.doctor_magic_token || "DOC-LINK-VERIFIED"}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4 text-xs">
          <div className="p-3 rounded bg-[#F6F6F3] border border-zinc-200 space-y-1">
            <div className="flex items-center justify-between font-mono text-[11px] text-zinc-500">
              <span>CLAIM: {claim.id}</span>
              <span>WARD: {claim.ward_bed}</span>
            </div>
            <div className="text-sm font-bold text-zinc-900">
              {claim.patient_name} ({claim.patient_age}Y/{claim.patient_gender})
            </div>
            <div className="text-zinc-600">
              Procedure: <strong>{claim.procedure.name}</strong> · {claim.insurer.name}
            </div>
          </div>

          {activeQuery ? (
            <>
              <div className="p-3 rounded bg-amber-50 border border-amber-200 space-y-1">
                <div className="text-[11px] font-semibold uppercase text-amber-900">
                  TPA Medical Query Summary:
                </div>
                <p className="text-zinc-800 leading-relaxed">{activeQuery.ai_summary}</p>
              </div>

              <form onSubmit={handleSign} className="space-y-3">
                <div>
                  <label className="block font-semibold text-zinc-800 mb-1">
                    Clinical Justification Note ({claim.treating_doctor_name}):
                  </label>
                  <textarea
                    rows={5}
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    className="w-full p-2.5 border border-zinc-300 rounded text-xs leading-relaxed"
                  />
                </div>

                {signed ? (
                  <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Signed &amp; attached to Claim {claim.id} TPA response packet!
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-2.5 px-4 rounded-md font-semibold bg-teal-700 hover:bg-teal-600 text-white flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <FileSignature className="w-4 h-4" />
                  {signed
                    ? "Update Signed Clinical Note"
                    : "Tap to Digitally Sign & Send to Desk"}
                </button>
              </form>
            </>
          ) : (
            <div className="p-4 text-center text-zinc-500">
              No active TPA query on this claim.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
