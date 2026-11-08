"use client";

import React, { useState } from "react";
import { Wrench, ChevronUp, ChevronDown, Zap, Download, UserCheck } from "lucide-react";
import { Role } from "@/lib/types";
import { API_BASE } from "@/lib/api";

interface Props {
  currentRole: Role;
  onSelectRole: (role: Role, name: string) => void;
  onSimulateQuery: (claimId: string) => void;
}

const SAMPLE_SCANS = [
  {
    file: "CLM3381_Abdominal_Ultrasound_USG_Report.pdf",
    label: "1. CLM-3381 Ultrasound Report PDF (Clears Missing Gap)",
  },
  {
    file: "CLM3385_Dengue_Serial_Platelet_Lab_Report.pdf",
    label: "2. CLM-3385 Serial Platelet Count PDF (Clears Enhancement Gap)",
  },
  {
    file: "Handwritten_Doctor_Admission_ICP_Scan.pdf",
    label: "3. Handwritten Surgical ICP Note PDF (Tests Vision OCR)",
  },
  {
    file: "Blurry_Low_Confidence_Ward_Scan.pdf",
    label: "4. Blurry Scan PDF (Triggers <75% AI Quarantine Tray)",
  },
];

export function ReviewerToolkit({
  currentRole,
  onSelectRole,
  onSimulateQuery,
}: Props) {
  const [open, setOpen] = useState(false);
  const isEnabled = process.env.NEXT_PUBLIC_ENABLE_DEMO_TOOLKIT !== "false";

  if (!isEnabled) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {open ? (
        <div className="w-80 sm:w-96 bg-zinc-900 text-zinc-100 rounded-md border border-zinc-700 shadow-2xl overflow-hidden text-xs">
          <div
            onClick={() => setOpen(false)}
            className="px-3.5 py-2.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between cursor-pointer"
          >
            <span className="font-mono font-semibold text-teal-400 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5" />
              REVIEWER DEMO TOOLKIT
            </span>
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          </div>

          <div className="p-3.5 space-y-3.5">
            {/* 1. Instant Role Switcher */}
            <div>
              <div className="text-[11px] font-mono uppercase text-zinc-400 mb-1.5 flex items-center gap-1">
                <UserCheck className="w-3 h-3" /> 1-Click RBAC Role Switcher
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => onSelectRole("DESK_EXEC", "Demo Executive")}
                  className={`py-1.5 px-2 rounded text-[11px] font-medium border ${
                    currentRole === "DESK_EXEC"
                      ? "bg-teal-700 border-teal-500 text-white"
                      : "bg-zinc-800 border-zinc-700 text-zinc-300"
                  }`}
                >
                  Desk Exec
                </button>
                <button
                  onClick={() => onSelectRole("DESK_HEAD", "Demo Desk Head")}
                  className={`py-1.5 px-2 rounded text-[11px] font-medium border ${
                    currentRole === "DESK_HEAD"
                      ? "bg-teal-700 border-teal-500 text-white"
                      : "bg-zinc-800 border-zinc-700 text-zinc-300"
                  }`}
                >
                  Desk Head
                </button>
                <button
                  onClick={() => onSelectRole("DOCTOR", "Dr. Demo One")}
                  className={`py-1.5 px-2 rounded text-[11px] font-medium border ${
                    currentRole === "DOCTOR"
                      ? "bg-teal-700 border-teal-500 text-white"
                      : "bg-zinc-800 border-zinc-700 text-zinc-300"
                  }`}
                >
                  Doctor View
                </button>
              </div>
            </div>

            {/* 2. Downloadable Sample Medical PDFs */}
            <div>
              <div className="text-[11px] font-mono uppercase text-zinc-400 mb-1.5 flex items-center gap-1">
                <Download className="w-3 h-3" /> Sample Medical Scans (Download to Test Upload)
              </div>
              <div className="space-y-1">
                {SAMPLE_SCANS.map((s) => (
                  <a
                    key={s.file}
                    href={`${API_BASE}/api/v1/sample-docs/${s.file}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 truncate border border-zinc-700"
                  >
                    ⬇ {s.label}
                  </a>
                ))}
              </div>
            </div>

            {/* 3. Simulate Live TPA Query Webhook */}
            <div>
              <div className="text-[11px] font-mono uppercase text-zinc-400 mb-1.5 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" /> Simulate Live TPA Query Email Webhook
              </div>
              <button
                onClick={() => onSimulateQuery("CLM-3382")}
                className="w-full py-1.5 px-2.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium text-center"
              >
                Fire TPA Query Email on CLM-3382 (Demo Patient B)
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="px-3.5 py-2 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-700 shadow-lg flex items-center gap-2 text-xs font-mono font-medium"
        >
          <Wrench className="w-3.5 h-3.5 text-teal-400" />
          Reviewer Demo Toolkit
          <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
        </button>
      )}
    </div>
  );
}
