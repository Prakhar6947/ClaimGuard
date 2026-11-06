"use client";

import React from "react";
import {
  TrendingDown,
  Clock,
  FileWarning,
  Building2,
  CheckCircle2,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";
import { Claim, DashboardKPIs } from "@/lib/types";

interface Props {
  claims: Claim[];
  kpis: DashboardKPIs | null;
  onSelectClaim: (claim: Claim) => void;
}

const DEDUCTION_REASONS = [
  {
    reason: "Missing Mandatory Diagnostic Report (USG / X-Ray / Serial CBC)",
    historicalLossLakhs: 28.4,
    preventedPct: 94,
    status: "Blocked by Gatekeeper",
  },
  {
    reason: "Delayed Enhancement Filing During HDU / ICU Stay (>24h lag)",
    historicalLossLakhs: 14.1,
    preventedPct: 86,
    status: "Tracked via SLA Timer",
  },
  {
    reason: "Unsigned / Illegible Handwritten Indoor Case Paper (ICP) Notes",
    historicalLossLakhs: 10.54,
    preventedPct: 91,
    status: "Solved by Doctor Magic-Link",
  },
  {
    reason: "TPA Query Turnaround Delay (>1.5 hrs per query x 2,340 queries/yr)",
    historicalLossLakhs: 10.53,
    preventedPct: 89,
    status: "Automated via AI Inbox",
  },
];

export function AnalyticsView({ claims, kpis, onSelectClaim }: Props) {
  const totalBilled = claims.reduce((s, c) => s + c.estimated_amount_inr, 0);
  const totalRisk = claims.reduce((s, c) => s + c.deduction_risk_inr, 0);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Top Executive Banner */}
      <div className="bg-white border border-zinc-200/90 rounded-lg p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
            CFO Revenue Protection &amp; IRDAI Compliance Telemetry
          </div>
          <h2 className="text-base font-semibold text-zinc-900 tracking-tight">
            Nashik Multispeciality Hospital — ₹66.3 Cr Annual Cashless Billing Overview
          </h2>
          <p className="text-xs text-zinc-500 max-w-2xl">
            Tracks the two core financial leaks identified by the CFO: 0.8% avoidable
            missing-document deductions (₹53.04L/yr) and 2,340 TPA query handling delays
            (₹10.53L/yr), plus the 4.5h → &lt;2.5h discharge approval wait target.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-4 py-2.5 rounded-md bg-[#F7F7F5] border border-zinc-200 text-right">
            <div className="text-[10px] font-mono uppercase text-zinc-500">
              Annual Leakage Target
            </div>
            <div className="text-lg font-mono font-bold text-zinc-900 tabular-nums">
              ₹63.57 Lakh/yr
            </div>
          </div>
          <div className="px-4 py-2.5 rounded-md bg-teal-950 text-white text-right">
            <div className="text-[10px] font-mono uppercase text-teal-300">
              Discharge Wait Compression
            </div>
            <div className="text-lg font-mono font-bold tabular-nums">
              4.5h → 2.1h
            </div>
          </div>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-zinc-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Active Billed Pipeline</span>
            <Building2 className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-zinc-900 tabular-nums">
            ₹{totalBilled.toLocaleString("en-IN")}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            Across {claims.length} active inpatient files
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-zinc-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Pre-Submission Risk Intercepted</span>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-amber-700 tabular-nums">
            ₹{totalRisk.toLocaleString("en-IN")}
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            Held by Gatekeeper before TPA dispatch
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-zinc-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Hospital Prep TAT (Internal)</span>
            <Clock className="w-4 h-4 text-teal-700" />
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-teal-800 tabular-nums">
            {kpis?.avg_hospital_prep_mins ?? 32} mins
          </div>
          <div className="mt-1 text-[11px] text-emerald-700 font-medium">
            46% faster than manual scanning baseline
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-zinc-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Same-Day Query Resolution</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-mono font-bold text-zinc-900 tabular-nums">
            93.4%
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            Target &gt; 90% within working hours
          </div>
        </div>
      </div>

      {/* Two-Column Breakdown: Deductions by Reason + Insurer SLA Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Cols: Avoidable Deductions by Reason */}
        <div className="lg:col-span-7 bg-white rounded-lg border border-zinc-200/90 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                Avoidable Deductions &amp; Cost Leakage by Root Cause
              </h3>
              <p className="text-xs text-zinc-500">
                Breakdown of the ₹63.57 Lakh annual loss and how ClaimGuard intercepts each vector
              </p>
            </div>
            <TrendingDown className="w-4 h-4 text-teal-700" />
          </div>

          <div className="space-y-4">
            {DEDUCTION_REASONS.map((item) => (
              <div key={item.reason} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-800">{item.reason}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-zinc-500">
                      ₹{item.historicalLossLakhs.toFixed(2)}L / yr
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-teal-50 text-teal-800 border border-teal-200">
                      {item.status}
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-900 rounded-full transition-all duration-700"
                    style={{ width: `${item.preventedPct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 5 Cols: IRDAI Delay Attribution by Claim */}
        <div className="lg:col-span-5 bg-white rounded-lg border border-zinc-200/90 p-5 space-y-4">
          <div className="border-b border-zinc-100 pb-3">
            <h3 className="text-sm font-semibold text-zinc-900">
              IRDAI Delay Attribution: Hospital Desk vs. TPA Lag
            </h3>
            <p className="text-xs text-zinc-500">
              Separates internal desk preparation minutes from external insurer adjudication wait
            </p>
          </div>

          <div className="space-y-3">
            {claims.map((c) => {
              const total = Math.max(1, c.hospital_delay_mins + c.tpa_delay_mins);
              const hospPct = Math.round((c.hospital_delay_mins / total) * 100);
              return (
                <div
                  key={c.id}
                  onClick={() => onSelectClaim(c)}
                  className="p-3 rounded-md border border-zinc-200/80 hover:border-zinc-400 bg-[#F7F7F5]/60 cursor-pointer transition space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-zinc-900">
                        {c.id}
                      </span>
                      <span className="font-medium text-zinc-800">
                        {c.patient_name}
                      </span>
                      <span className="text-zinc-400">· {c.insurer.name}</span>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-zinc-400" />
                  </div>

                  <div className="w-full h-2 bg-amber-200 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-zinc-900"
                      style={{ width: `${hospPct}%` }}
                      title={`Hospital Prep: ${c.hospital_delay_mins} mins`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-600">
                    <span>
                      ■ Hospital Desk Prep: <strong>{c.hospital_delay_mins}m</strong>
                    </span>
                    <span className="text-amber-800">
                      ■ External TPA Wait: <strong>{c.tpa_delay_mins}m</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
