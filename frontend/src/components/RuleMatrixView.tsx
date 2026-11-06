"use client";

import React, { useEffect, useState } from "react";
import { Plus, ShieldCheck, Lock } from "lucide-react";
import { Role } from "@/lib/types";
import { fetchRulesMatrix, createChecklistRule } from "@/lib/api";

interface Props {
  currentRole: Role;
  onRuleAdded: () => void;
}

export function RuleMatrixView({ currentRole, onRuleAdded }: Props) {
  const [data, setData] = useState<{
    insurers: { id: string; name: string; kind: string }[];
    procedures: { id: string; name: string; department: string }[];
    rules: any[];
  } | null>(null);

  const [insurerId, setInsurerId] = useState<string>("");
  const [procedureId, setProcedureId] = useState<string>("");
  const [slotKey, setSlotKey] = useState("");
  const [slotLabel, setSlotLabel] = useState("");
  const [stageRequired, setStageRequired] = useState("PRE_AUTH");
  const [isMandatory, setIsMandatory] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  async function loadRules() {
    const res = await fetchRulesMatrix();
    setData(res);
  }

  useEffect(() => {
    loadRules();
  }, []);

  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    try {
      await createChecklistRule({
        insurer_id: insurerId || null,
        procedure_id: procedureId || null,
        slot_key: slotKey,
        slot_label: slotLabel,
        stage_required: stageRequired,
        is_mandatory: isMandatory,
        actor_role: currentRole,
      });
      setSlotKey("");
      setSlotLabel("");
      await loadRules();
      onRuleAdded();
      setStatusMsg({
        type: "success",
        text: "Checklist rule added and automatically synced across active claims.",
      });
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err.message });
    }
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-xs text-zinc-500 font-mono">
        Loading Insurer × Procedure Rule Engine Matrix...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left 8 Columns: Active 3-Tier Inheritance Rules Table */}
      <div className="lg:col-span-8 bg-white rounded-md border border-zinc-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              Insurer × Procedure Checklist Rule Engine
            </h2>
            <p className="text-xs text-zinc-500">
              3-Tier Inheritance: Universal Base Rules → Insurer-Specific Rules → Insurer ×
              Procedure Rules
            </p>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200">
            {data.rules.length} Active Rules
          </span>
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <th className="py-2.5 px-3">Scope (Insurer × Procedure)</th>
              <th className="py-2.5 px-3">Slot Key &amp; Label</th>
              <th className="py-2.5 px-3">Stage</th>
              <th className="py-2.5 px-3">Enforcement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 text-xs">
            {data.rules.map((r) => {
              const insName =
                data.insurers.find((i) => i.id === r.insurer_id)?.name || "All Insurers";
              const procName =
                data.procedures.find((p) => p.id === r.procedure_id)?.name ||
                "All Procedures";
              return (
                <tr key={r.id}>
                  <td className="py-2.5 px-3">
                    <span className="font-medium text-zinc-900">{insName}</span>
                    <span className="text-zinc-400 mx-1">×</span>
                    <span className="text-teal-800 font-medium">{procName}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-medium text-zinc-900">{r.slot_label}</div>
                    <div className="text-[11px] font-mono text-zinc-400">{r.slot_key}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px]">{r.stage_required}</td>
                  <td className="py-2.5 px-3">
                    {r.is_mandatory ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-900 text-white">
                        MANDATORY GATE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-100 text-zinc-600">
                        Optional
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Right 4 Columns: Add New Checklist Rule Form (RBAC Protected for DESK_HEAD) */}
      <div className="lg:col-span-4 bg-white rounded-md border border-zinc-200 p-4 space-y-4 h-fit">
        <div className="flex items-center justify-between border-b border-zinc-200 pb-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            Configure New Checklist Rule
          </h3>
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-100">
            Role: {currentRole}
          </span>
        </div>

        {currentRole !== "DESK_HEAD" && (
          <div className="p-3 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
            <Lock className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
            <div>
              <strong>RBAC Notice:</strong> You are currently viewing as{" "}
              <code>{currentRole}</code>. Switch to <strong>Desk Head (Admin)</strong> in the
              top bar or Reviewer Toolkit to add or modify master insurer rules.
            </div>
          </div>
        )}

        {statusMsg && (
          <div
            className={`p-2.5 rounded text-xs font-medium border ${
              statusMsg.type === "error"
                ? "bg-red-50 text-red-800 border-red-200"
                : "bg-emerald-50 text-emerald-900 border-emerald-200"
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        <form onSubmit={handleAddRule} className="space-y-3 text-xs">
          <div>
            <label className="block font-medium text-zinc-700 mb-1">
              Insurer / TPA Scope
            </label>
            <select
              value={insurerId}
              onChange={(e) => setInsurerId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded border border-zinc-300 bg-white"
            >
              <option value="">All Insurers (Universal Rule)</option>
              {data.insurers.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-zinc-700 mb-1">
              Procedure Scope
            </label>
            <select
              value={procedureId}
              onChange={(e) => setProcedureId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded border border-zinc-300 bg-white"
            >
              <option value="">All Procedures</option>
              {data.procedures.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.department})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-zinc-700 mb-1">
              Document Slot Key (Code)
            </label>
            <input
              type="text"
              required
              placeholder="e.g., ABG_ARTERIAL_REPORT"
              value={slotKey}
              onChange={(e) => setSlotKey(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded border border-zinc-300 font-mono"
            />
          </div>

          <div>
            <label className="block font-medium text-zinc-700 mb-1">
              Human-Readable Document Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Arterial Blood Gas (ABG) Report"
              value={slotLabel}
              onChange={(e) => setSlotLabel(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded border border-zinc-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-medium text-zinc-700 mb-1">Stage</label>
              <select
                value={stageRequired}
                onChange={(e) => setStageRequired(e.target.value)}
                className="w-full px-2 py-1.5 rounded border border-zinc-300 bg-white font-mono"
              >
                <option value="PRE_AUTH">PRE_AUTH</option>
                <option value="ENHANCEMENT">ENHANCEMENT</option>
                <option value="DISCHARGE">DISCHARGE</option>
              </select>
            </div>
            <div className="flex items-end pb-1.5">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMandatory}
                  onChange={(e) => setIsMandatory(e.target.checked)}
                />
                <span className="font-medium text-zinc-800">Mandatory Gate</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 px-3 rounded font-semibold bg-zinc-900 hover:bg-zinc-800 text-white inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Save Rule &amp; Sync Claims
          </button>
        </form>
      </div>
    </div>
  );
}
