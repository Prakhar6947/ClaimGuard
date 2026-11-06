"use client";

import React from "react";
import { LogOut } from "lucide-react";
import { Role } from "@/lib/types";
import { ReviewerToolkit } from "./ReviewerToolkit";

interface Props {
  currentRole: Role;
  currentActorName: string;
  onRoleChange: (role: Role, name: string) => void;
  onSignOut?: () => void;
  onSimulateQuery?: (claimId: string) => void;
  children: React.ReactNode;
}

export function AppShell({
  currentRole,
  currentActorName,
  onRoleChange,
  onSignOut,
  onSimulateQuery,
  children,
}: Props) {
  return (
    <div className="min-h-screen bg-[#F6F6F3] text-zinc-900 flex flex-col font-sans">
      {/* Top Clinical Header Bar */}
      <header className="bg-zinc-900 text-white border-b border-zinc-800 px-4 lg:px-6 py-3 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-teal-600 flex items-center justify-center font-bold text-white tracking-wider">
              CG
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-white uppercase">
                  ClaimGuard
                </h1>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-teal-400 border border-zinc-700">
                  NASHIK HOSPITAL TPA DESK
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Company A Multispeciality · Cashless Claims &amp; IRDAI SLA Command Center
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-medium text-zinc-200">
                {currentActorName}
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                Role: {currentRole} · DPDP 2023 Compliant
              </span>
            </div>

            <div className="flex items-center bg-zinc-800 rounded p-0.5 border border-zinc-700 text-xs font-medium">
              <button
                onClick={() => onRoleChange("DESK_EXEC", "Demo Executive")}
                className={`px-2.5 py-1 rounded transition ${
                  currentRole === "DESK_EXEC"
                    ? "bg-teal-700 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Desk Exec
              </button>
              <button
                onClick={() => onRoleChange("DESK_HEAD", "Demo Desk Head")}
                className={`px-2.5 py-1 rounded transition ${
                  currentRole === "DESK_HEAD"
                    ? "bg-teal-700 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Desk Head
              </button>
              <button
                onClick={() => onRoleChange("DOCTOR", "Dr. Demo One")}
                className={`px-2.5 py-1 rounded transition ${
                  currentRole === "DOCTOR"
                    ? "bg-teal-700 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Doctor
              </button>
            </div>

            {onSignOut && (
              <button
                onClick={onSignOut}
                className="p-1.5 rounded bg-zinc-800 hover:bg-red-900/60 text-zinc-400 hover:text-red-300 border border-zinc-700 transition"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">{children}</main>

      {/* Floating Reviewer Demo Toolkit */}
      {onSimulateQuery && (
        <ReviewerToolkit
          currentRole={currentRole}
          onSelectRole={onRoleChange}
          onSimulateQuery={onSimulateQuery}
        />
      )}
    </div>
  );
}
