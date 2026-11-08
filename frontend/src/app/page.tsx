"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import React, { useEffect, useState, useCallback } from "react";
import {
  Search,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Inbox,
  Sliders,
  Shield,
  Smartphone,
  RefreshCw,
  ArrowUpRight,
  BarChart3,
  LayoutGrid,
  ListFilter,
  LogOut,
  Command,
  ChevronRight,
  Plus,
  Menu,
  X,
} from "lucide-react";
import { Claim, DashboardKPIs, Role, AuditLogItem } from "@/lib/types";
import {
  fetchClaims,
  fetchAuditLogs,
  simulateIncomingTpaQuery,
  loginUser,
  API_BASE,
} from "@/lib/api";
import { SlaTimerBadge } from "@/components/SlaTimerBadge";
import { ClaimWorkspaceModal } from "@/components/ClaimWorkspaceModal";
import { QueryInboxView } from "@/components/QueryInboxView";
import { RuleMatrixView } from "@/components/RuleMatrixView";
import { DoctorMobileView } from "@/components/DoctorMobileView";
import { AnalyticsView } from "@/components/AnalyticsView";
import { NewAdmissionModal } from "@/components/NewAdmissionModal";
import { ReviewerToolkit } from "@/components/ReviewerToolkit";

type ActiveScreen =
  | "QUEUE"
  | "QUERY_INBOX"
  | "ANALYTICS"
  | "RULE_MATRIX"
  | "DOCTOR_MOBILE"
  | "AUDIT_LOGS";

interface ToastItem {
  id: string;
  text: string;
  type: "success" | "error";
}

const KANBAN_COLUMNS = [
  { key: "QUERY", label: "TPA Query Raised", dot: "bg-red-600" },
  { key: "PREAUTH_SENT", label: "Pre-Auth Sent", dot: "bg-teal-600" },
  { key: "ENHANCEMENT", label: "Enhancement Needed", dot: "bg-amber-500" },
  { key: "FINAL_BILL", label: "Final Bill / Discharge (3h)", dot: "bg-zinc-900" },
];

export default function CashlessWorkspaceApp() {
  // Authentication & Role State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [loginEmail, setLoginEmail] = useState("exec@companya-hospital.in");
  const [loginPassword, setLoginPassword] = useState("ClaimGuard@2026");
  const [loginError, setLoginError] = useState<string | null>(null);

  // Navigation & View Mode State
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>("QUEUE");
  const [viewLayout, setViewLayout] = useState<"TABLE" | "KANBAN">("TABLE");
  const [currentRole, setCurrentRole] = useState<Role>("DESK_EXEC");
  const [currentActorName, setCurrentActorName] = useState("Priya Deshpande");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Command Palette & New Admission Modal State
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [newAdmissionOpen, setNewAdmissionOpen] = useState(false);

  // Toast Notification Queue
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Data State
  const [claims, setClaims] = useState<Claim[]>([]);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [doctorTarget, setDoctorTarget] = useState<{
    claimId: string;
    queryId?: string;
  } | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  const pushToast = useCallback(
    (text: string, type: "success" | "error" = "success") => {
      const id = Math.random().toString(36).slice(2, 9);
      setToasts((prev) => [...prev.slice(-2), { id, text, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClaims(statusFilter, searchQuery);
      setClaims(data?.claims || []);
      setKpis(data?.kpis || null);
    } catch {
      setClaims([]);
      setKpis(null);
      setError(
        "Backend API unreachable. Ensure the FastAPI backend is running and NEXT_PUBLIC_API_BASE_URL is configured."
      );
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setCmdOpen(false);
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleSignIn(
    e: React.FormEvent,
    overrideEmail?: string,
    overrideRole?: Role,
    overrideName?: string,
    overridePassword?: string
  ) {
    e.preventDefault();
    setLoginError(null);
    const emailToUse = (overrideEmail || loginEmail).trim();
    const passwordToUse = (overridePassword || loginPassword).trim();
    try {
      const data = await loginUser(emailToUse, passwordToUse);
      if (typeof window !== "undefined") {
        localStorage.setItem("claimguard_token", data.access_token);
        localStorage.setItem("claimguard_user", JSON.stringify(data.user));
      }
      setCurrentRole(data.user.role as Role);
      setCurrentActorName(data.user.full_name);
      setIsAuthenticated(true);
      pushToast(`Signed in as ${data.user.full_name} (${data.user.role})`);
    } catch (err: any) {
      if (overrideRole && overrideName) {
        // Fallback for resilient instant demo clicks
        setCurrentRole(overrideRole);
        setCurrentActorName(overrideName);
        setIsAuthenticated(true);
        pushToast(`Signed in as ${overrideName} (${overrideRole})`);
      } else {
        setLoginError(err?.message || "Invalid credentials. Use demo password: ClaimGuard@2026");
      }
    }
  }

  async function handleOpenAuditLogs() {
    setActiveScreen("AUDIT_LOGS");
    setMobileMenuOpen(false);
    const logs = await fetchAuditLogs();
    setAuditLogs(logs);
  }

  function handleClaimUpdated(updated: Claim) {
    setClaims((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    if (selectedClaim?.id === updated.id) {
      setSelectedClaim(updated);
    }
    loadWorkspace();
  }

  async function handleSimulateWebhook(claimId: string) {
    try {
      const updated = await simulateIncomingTpaQuery(claimId);
      handleClaimUpdated(updated);
      setActiveScreen("QUERY_INBOX");
      pushToast(`Live TPA Query Email ingested for ${claimId}`);
    } catch (err: any) {
      pushToast(err.message, "error");
    }
  }

  const openQueryCount = claims.reduce(
    (acc, c) => acc + c.queries.filter((q) => q.status !== "RESOLVED").length,
    0
  );

  const filteredCmdClaims = claims.filter((c) => {
    if (!cmdQuery.trim()) return true;
    const q = cmdQuery.toLowerCase();
    return (
      c.id.toLowerCase().includes(q) ||
      c.patient_name.toLowerCase().includes(q) ||
      c.procedure.name.toLowerCase().includes(q) ||
      c.insurer.name.toLowerCase().includes(q)
    );
  });

  // ============================================================================
  // SCREEN 0: SIGN-IN SCREEN
  // ============================================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#F7F7F5] text-zinc-900">
        <div className="hidden lg:flex lg:col-span-7 bg-zinc-900 text-white p-12 flex-col justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
            <span className="font-mono font-bold text-sm tracking-tight">
              CLAIMGUARD WORKSPACE
            </span>
            <span className="text-xs font-mono text-zinc-400 px-2 py-0.5 rounded bg-zinc-800">
              Nashik · 180 Beds
            </span>
          </div>

          <div className="space-y-6 max-w-xl">
            <h1 className="text-3xl font-semibold tracking-tight leading-snug">
              Zero-deduction cashless claims &amp; IRDAI SLA workspace.
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Built for Company A Multispeciality Hospital&apos;s 9-member insurance desk.
              Enforces insurer × procedure document checklists prior to dispatch, extracts
              clinical pre-auth fields with verbatim source snippets, and tracks 1-hour
              pre-auth and 3-hour discharge turnaround mandates.
            </p>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-zinc-800 font-mono">
              <div>
                <div className="text-xs text-zinc-400">Annual Cashless Billing</div>
                <div className="text-xl font-bold text-white mt-0.5">₹66.3 Cr</div>
              </div>
              <div>
                <div className="text-xs text-zinc-400">Deduction Leakage Prevented</div>
                <div className="text-xl font-bold text-teal-400 mt-0.5">₹53.04 L</div>
              </div>
              <div>
                <div className="text-xs text-zinc-400">Discharge Approval Wait</div>
                <div className="text-xl font-bold text-white mt-0.5">&lt; 2.5 hrs</div>
              </div>
            </div>
          </div>

          <div className="text-xs font-mono text-zinc-500">
            DPDP Act 2023 Compliant · Hosted in Mumbai (ap-south-1)
          </div>
        </div>

        <div className="lg:col-span-5 flex items-center justify-center p-6 sm:p-12 bg-white">
          <div className="w-full max-w-sm space-y-6 animate-fade-up">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">
                Sign in to Insurance Desk
              </h2>
              <p className="text-xs text-zinc-500 mt-1">
                Enter your hospital credentials or select a demo reviewer persona below.
              </p>
            </div>

            {loginError && (
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-800">
                {loginError}
              </div>
            )}

            <form onSubmit={(e) => handleSignIn(e)} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  Hospital Staff Email
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-zinc-300 font-mono text-xs focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-zinc-300 font-mono text-xs focus:outline-none focus:border-zinc-900"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-md font-semibold bg-zinc-900 hover:bg-zinc-800 text-white transition"
              >
                Sign In to Workspace
              </button>
            </form>

            <div className="pt-4 border-t border-zinc-200 space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                1-Click Instant Reviewer Demo Personas
              </div>
              {[
                {
                  label: "Priya Deshpande — Desk Executive",
                  email: "exec@companya-hospital.in",
                  role: "DESK_EXEC" as Role,
                  name: "Priya Deshpande",
                },
                {
                  label: "Anand Kulkarni — Insurance Desk Head (Admin)",
                  email: "head@companya-hospital.in",
                  role: "DESK_HEAD" as Role,
                  name: "Anand Kulkarni",
                },
                {
                  label: "Dr. Sameer Joshi — Treating Consultant",
                  email: "doctor@companya-hospital.in",
                  role: "DOCTOR" as Role,
                  name: "Dr. Sameer Joshi",
                },
              ].map((p) => (
                <button
                  key={p.email}
                  type="button"
                  onClick={(e) => {
                    setLoginEmail(p.email);
                    setLoginPassword("ClaimGuard@2026");
                    handleSignIn(e, p.email, p.role, p.name, "ClaimGuard@2026");
                  }}
                  className="w-full p-2.5 rounded-md border border-zinc-200 hover:border-zinc-400 bg-[#F7F7F5] text-left flex items-center justify-between text-xs transition"
                >
                  <div>
                    <div className="font-semibold text-zinc-900">{p.label}</div>
                    <div className="text-[11px] font-mono text-zinc-500">{p.email}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Reusable Sidebar Navigation Content (shared by Desktop Sidebar & Mobile Drawer)
  const SidebarContent = (
    <>
      <div className="p-3.5 space-y-5">
        <div className="px-2 py-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-[5px] bg-zinc-900 text-white flex items-center justify-center font-mono text-[11px] font-bold">
              C
            </div>
            <div>
              <div className="text-xs font-bold tracking-tight text-zinc-900 leading-none">
                ClaimGuard
              </div>
              <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                Nashik · TPA Desk
              </div>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse-dot" />
        </div>

        <button
          onClick={() => {
            setMobileMenuOpen(false);
            setCmdOpen(true);
          }}
          className="w-full px-2.5 py-1.5 rounded-md bg-white border border-zinc-200/90 hover:border-zinc-300 text-xs text-zinc-500 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition"
        >
          <span className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-zinc-400" />
            <span>Quick Jump...</span>
          </span>
          <kbd className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
            ⌘K
          </kbd>
        </button>

        <div className="space-y-0.5">
          <div className="px-2 pb-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
            Operations
          </div>

          <button
            onClick={() => {
              setActiveScreen("QUEUE");
              setMobileMenuOpen(false);
            }}
            className={`w-full px-2.5 py-2 rounded-md text-xs font-medium flex items-center justify-between transition ${
              activeScreen === "QUEUE"
                ? "bg-zinc-900 text-white shadow-sm"
                : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Claims Workbench
            </span>
            <span
              className={`font-mono text-[11px] ${
                activeScreen === "QUEUE" ? "text-zinc-300" : "text-zinc-400"
              }`}
            >
              {claims.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveScreen("QUERY_INBOX");
              setMobileMenuOpen(false);
            }}
            className={`w-full px-2.5 py-2 rounded-md text-xs font-medium flex items-center justify-between transition ${
              activeScreen === "QUERY_INBOX"
                ? "bg-zinc-900 text-white shadow-sm"
                : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Inbox className="w-3.5 h-3.5" />
              TPA Query Inbox
            </span>
            {openQueryCount > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 border border-amber-400/40 font-mono text-[10px] font-bold">
                {openQueryCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveScreen("ANALYTICS");
              setMobileMenuOpen(false);
            }}
            className={`w-full px-2.5 py-2 rounded-md text-xs font-medium flex items-center justify-between transition ${
              activeScreen === "ANALYTICS"
                ? "bg-zinc-900 text-white shadow-sm"
                : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <BarChart3 className="w-3.5 h-3.5" />
              Deductions &amp; SLA Analytics
            </span>
          </button>

          <div className="px-2 pt-4 pb-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
            Governance &amp; Mobile
          </div>

          <button
            onClick={() => {
              setActiveScreen("RULE_MATRIX");
              setMobileMenuOpen(false);
            }}
            className={`w-full px-2.5 py-2 rounded-md text-xs font-medium flex items-center justify-between transition ${
              activeScreen === "RULE_MATRIX"
                ? "bg-zinc-900 text-white shadow-sm"
                : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Sliders className="w-3.5 h-3.5" />
              Insurer Rule Matrix
            </span>
          </button>

          <button
            onClick={() => {
              setDoctorTarget({ claimId: "CLM-3385", queryId: "QRY-902" });
              setActiveScreen("DOCTOR_MOBILE");
              setMobileMenuOpen(false);
            }}
            className={`w-full px-2.5 py-2 rounded-md text-xs font-medium flex items-center justify-between transition ${
              activeScreen === "DOCTOR_MOBILE"
                ? "bg-zinc-900 text-white shadow-sm"
                : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Smartphone className="w-3.5 h-3.5" />
              Doctor Mobile Magic-Link
            </span>
          </button>

          <button
            onClick={handleOpenAuditLogs}
            className={`w-full px-2.5 py-2 rounded-md text-xs font-medium flex items-center justify-between transition ${
              activeScreen === "AUDIT_LOGS"
                ? "bg-zinc-900 text-white shadow-sm"
                : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Shield className="w-3.5 h-3.5" />
              DPDP Security Audit Log
            </span>
          </button>
        </div>
      </div>

      <div className="p-3 border-t border-zinc-200/80 bg-white space-y-2">
        <div className="flex items-center justify-between">
          <div className="truncate">
            <div className="text-xs font-semibold text-zinc-900 truncate">
              {currentActorName}
            </div>
            <div className="text-[10px] font-mono text-teal-700">
              Role: {currentRole}
            </div>
          </div>
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                localStorage.removeItem("claimguard_token");
                localStorage.removeItem("claimguard_user");
              }
              setIsAuthenticated(false);
              setLoginEmail("exec@companya-hospital.in");
              setLoginPassword("ClaimGuard@2026");
              setLoginError(null);
            }}
            className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-800 transition"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>

        <select
          value={currentRole}
          onChange={(e) => {
            const r = e.target.value as Role;
            const name =
              r === "DESK_HEAD"
                ? "Anand Kulkarni"
                : r === "DOCTOR"
                ? "Dr. Sameer Joshi"
                : "Priya Deshpande";
            setCurrentRole(r);
            setCurrentActorName(name);
            pushToast(`Switched active role to ${name} (${r})`);
            if (r === "DOCTOR") {
              setDoctorTarget({ claimId: "CLM-3385", queryId: "QRY-902" });
              setActiveScreen("DOCTOR_MOBILE");
            }
          }}
          className="w-full bg-[#F7F7F5] text-zinc-800 border border-zinc-200 rounded px-2 py-1 text-[11px] font-mono focus:outline-none"
        >
          <option value="DESK_EXEC">Switch: Desk Executive</option>
          <option value="DESK_HEAD">Switch: Desk Head (Admin)</option>
          <option value="DOCTOR">Switch: Treating Doctor</option>
        </select>
      </div>
    </>
  );

  // ============================================================================
  // MAIN WORKSPACE SHELL
  // ============================================================================
  return (
    <div className="h-screen w-screen overflow-hidden flex bg-[#F7F7F5] text-zinc-900">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex w-60 bg-[#FBFBFA] border-r border-zinc-200/90 flex-col justify-between shrink-0 select-none">
        {SidebarContent}
      </aside>

      {/* Mobile Slide-Over Sidebar Drawer (< 1024px) */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[1px] lg:hidden flex animate-backdrop"
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="w-64 bg-[#FBFBFA] h-full border-r border-zinc-200 flex flex-col justify-between animate-slide-left"
          >
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main Right Viewport */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Sticky Top Header */}
        <header className="px-4 lg:px-6 py-2.5 bg-white border-b border-zinc-200/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 text-xs">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded border border-zinc-200 text-zinc-700 hover:bg-zinc-100"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="text-zinc-400 hidden sm:inline">Company A Hospital</span>
            <span className="text-zinc-300 hidden sm:inline">/</span>
            <span className="font-semibold text-zinc-900">
              {activeScreen === "QUEUE" && "Cashless Claims Workbench"}
              {activeScreen === "QUERY_INBOX" && "TPA Query Inbox & SLA Tracker"}
              {activeScreen === "ANALYTICS" && "CFO Deductions & Turnaround Analytics"}
              {activeScreen === "RULE_MATRIX" && "Insurer × Procedure Checklist Rules"}
              {activeScreen === "DOCTOR_MOBILE" && "Doctor Mobile Clinical Justification"}
              {activeScreen === "AUDIT_LOGS" && "DPDP Act 2023 Immutable Audit Trail"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {activeScreen === "QUEUE" && (
              <>
                <button
                  onClick={() => setNewAdmissionOpen(true)}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white inline-flex items-center gap-1.5 shadow-sm transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">New Admission</span>
                </button>

                <div className="flex items-center bg-[#F7F7F5] p-0.5 rounded-md border border-zinc-200/90 text-xs">
                  <button
                    onClick={() => setViewLayout("TABLE")}
                    className={`px-2.5 py-1 rounded-[4px] font-medium flex items-center gap-1.5 transition ${
                      viewLayout === "TABLE"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    <ListFilter className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Table</span>
                  </button>
                  <button
                    onClick={() => setViewLayout("KANBAN")}
                    className={`px-2.5 py-1 rounded-[4px] font-medium flex items-center gap-1.5 transition ${
                      viewLayout === "KANBAN"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Kanban</span>
                  </button>
                </div>
              </>
            )}

            <button
              onClick={loadWorkspace}
              className="p-1.5 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 transition"
              title="Refresh live telemetry"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Scrollable Workspace Body */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-6 space-y-5">
          {error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-center justify-between text-xs text-red-900">
              <span>{error}</span>
              <button
                onClick={loadWorkspace}
                className="px-3 py-1 rounded bg-red-800 text-white font-medium"
              >
                Retry
              </button>
            </div>
          )}

          {/* KPI Strip */}
          {kpis && activeScreen === "QUEUE" && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 animate-fade-up">
              <div className="bg-white p-3.5 rounded-lg border border-zinc-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="text-[11px] font-medium text-zinc-500">
                  Active Cashless Claims
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="text-2xl font-mono font-bold tabular-nums text-zinc-900">
                    {kpis.active_claims_count}
                  </span>
                  <span className="text-[11px] font-mono text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                    {kpis.claims_with_missing_docs} with missing gaps
                  </span>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-zinc-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="text-[11px] font-medium text-zinc-500">
                  Open TPA Queries
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="text-2xl font-mono font-bold tabular-nums text-amber-700">
                    {kpis.open_tpa_queries}
                  </span>
                  <button
                    onClick={() => setActiveScreen("QUERY_INBOX")}
                    className="text-[11px] font-medium text-teal-700 hover:underline"
                  >
                    Open Inbox →
                  </button>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-zinc-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="text-[11px] font-medium text-zinc-500">
                  Deduction Exposure Flagged
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="text-2xl font-mono font-bold tabular-nums text-zinc-900">
                    ₹{kpis.deduction_risk_protected_inr.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    0.8% leak guard
                  </span>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-zinc-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="text-[11px] font-medium text-zinc-500">
                  Avg Hospital Desk Prep
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="text-2xl font-mono font-bold tabular-nums text-teal-800">
                    {kpis.avg_hospital_prep_mins}m
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400">
                    IRDAI Mandate: 60m
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* SCREEN 1: CLAIMS QUEUE (TABLE / KANBAN) */}
          {activeScreen === "QUEUE" && (
            <div className="space-y-4 animate-fade-up">
              <div className="bg-white p-3 rounded-lg border border-zinc-200/90 flex flex-wrap items-center justify-between gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {[
                    { key: "ALL", label: "All Admissions" },
                    { key: "QUERY", label: "Query Raised" },
                    { key: "PREAUTH_SENT", label: "Pre-Auth Sent" },
                    { key: "ENHANCEMENT", label: "Enhancement" },
                    { key: "FINAL_BILL", label: "Final Bill (Discharge)" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setStatusFilter(tab.key)}
                      className={`px-2.5 py-1 rounded-[5px] text-xs font-medium whitespace-nowrap transition ${
                        statusFilter === tab.key
                          ? "bg-zinc-900 text-white"
                          : "text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    placeholder="Filter by Claim ID, patient, insurer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1 text-xs border border-zinc-200 rounded-md bg-[#F7F7F5] focus:bg-white focus:outline-none focus:border-zinc-900 transition"
                  />
                </div>
              </div>

              {viewLayout === "TABLE" ? (
                <div className="bg-white rounded-lg border border-zinc-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F7F7F5] border-b border-zinc-200 text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                          <th className="py-2.5 px-4">Claim ID</th>
                          <th className="py-2.5 px-4">Patient</th>
                          <th className="py-2.5 px-4">Insurer or TPA</th>
                          <th className="py-2.5 px-4">Procedure</th>
                          <th className="py-2.5 px-4">Status</th>
                          <th className="py-2.5 px-4">Missing Documents (Pre-Send Gate)</th>
                          <th className="py-2.5 px-4">IRDAI SLA Timer</th>
                          <th className="py-2.5 px-4 text-right">Estimate</th>
                          <th className="py-2.5 px-4 text-right">Workspace</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200/70 text-xs">
                        {loading ? (
                          Array.from({ length: 4 }).map((_, i) => (
                            <tr key={i}>
                              <td colSpan={9} className="p-3.5">
                                <div className="h-7 rounded skeleton-shimmer" />
                              </td>
                            </tr>
                          ))
                        ) : claims.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center space-y-2">
                              <div className="text-xs font-medium text-zinc-700">
                                No cashless claims match your current filter.
                              </div>
                              <button
                                onClick={() => {
                                  setStatusFilter("ALL");
                                  setSearchQuery("");
                                }}
                                className="px-3 py-1 rounded text-xs font-medium bg-zinc-900 text-white"
                              >
                                Reset Filters
                              </button>
                            </td>
                          </tr>
                        ) : (
                          claims.map((claim) => {
                            const missing = claim.gaps.missing_mandatory_documents;
                            return (
                              <tr
                                key={claim.id}
                                onClick={() => setSelectedClaim(claim)}
                                className="hover:bg-[#F7F7F5]/80 cursor-pointer transition group"
                              >
                                <td className="py-3.5 px-4 font-mono font-semibold text-zinc-900 whitespace-nowrap">
                                  {claim.id}
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="font-semibold text-zinc-900">
                                    {claim.patient_name}
                                  </div>
                                  <div className="text-[11px] text-zinc-400 font-mono">
                                    {claim.patient_age}Y/{claim.patient_gender} · {claim.ward_bed}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="font-medium text-zinc-800">
                                    {claim.insurer.name}
                                  </div>
                                  <div className="text-[11px] font-mono text-zinc-400">
                                    {claim.policy_number_masked}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="font-medium text-zinc-900">
                                    {claim.procedure.name}
                                  </div>
                                  <div className="text-[11px] text-zinc-500">
                                    {claim.treating_doctor_name}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[5px] text-[11px] font-mono font-semibold border ${
                                      claim.status === "QUERY"
                                        ? "bg-red-50 text-red-800 border-red-200"
                                        : claim.status === "ENHANCEMENT"
                                        ? "bg-amber-50 text-amber-900 border-amber-200"
                                        : claim.status === "PREAUTH_SENT"
                                        ? "bg-teal-50 text-teal-900 border-teal-200"
                                        : "bg-zinc-100 text-zinc-800 border-zinc-300"
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        claim.status === "QUERY"
                                          ? "bg-red-600"
                                          : claim.status === "ENHANCEMENT"
                                          ? "bg-amber-500"
                                          : "bg-teal-600"
                                      }`}
                                    />
                                    {claim.status === "PREAUTH_SENT"
                                      ? "Pre-auth sent"
                                      : claim.status === "QUERY"
                                      ? "Query"
                                      : claim.status === "ENHANCEMENT"
                                      ? "Enhancement"
                                      : claim.status}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4">
                                  {missing.length === 0 ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      None ({claim.gaps.verified_mandatory}/
                                      {claim.gaps.total_mandatory})
                                    </span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1">
                                      {missing.map((docName) => (
                                        <span
                                          key={docName}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[5px] text-[11px] font-medium bg-red-50 text-red-700 border border-red-200"
                                        >
                                          <AlertCircle className="w-3 h-3 text-red-600 shrink-0" />
                                          {docName}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <SlaTimerBadge initialSeconds={claim.sla_remaining_seconds} />
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-zinc-900 whitespace-nowrap">
                                  ₹{claim.estimated_amount_inr.toLocaleString("en-IN")}
                                </td>
                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-[#F7F7F5] group-hover:bg-zinc-900 group-hover:text-white text-zinc-800 border border-zinc-200/90 transition">
                                    Inspect
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto custom-scrollbar pb-2">
                  {KANBAN_COLUMNS.map((col) => {
                    const colClaims = claims.filter((c) => c.status === col.key);
                    return (
                      <div
                        key={col.key}
                        className="bg-[#F1F1EE] rounded-lg border border-zinc-200/80 p-3 flex flex-col gap-2.5 min-h-[420px]"
                      >
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-800">
                            <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                            {col.label}
                          </div>
                          <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-white border border-zinc-200 text-zinc-600">
                            {colClaims.length}
                          </span>
                        </div>

                        <div className="space-y-2.5 flex-1 overflow-y-auto custom-scrollbar">
                          {colClaims.map((claim) => (
                            <div
                              key={claim.id}
                              onClick={() => setSelectedClaim(claim)}
                              className="bg-white p-3.5 rounded-md border border-zinc-200/90 hover:border-zinc-400 shadow-[0_1px_2px_rgba(0,0,0,0.03)] cursor-pointer transition space-y-2.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-bold text-zinc-900">
                                  {claim.id}
                                </span>
                                <SlaTimerBadge
                                  initialSeconds={claim.sla_remaining_seconds}
                                  compact
                                />
                              </div>

                              <div>
                                <div className="text-xs font-semibold text-zinc-900">
                                  {claim.patient_name}
                                </div>
                                <div className="text-[11px] text-zinc-500">
                                  {claim.procedure.name} · {claim.insurer.name}
                                </div>
                              </div>

                              {claim.gaps.missing_mandatory_documents.length > 0 ? (
                                <div className="p-2 rounded bg-red-50 border border-red-200 text-[11px] text-red-800 font-medium flex items-center gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                  Missing: {claim.gaps.missing_mandatory_documents.join(", ")}
                                </div>
                              ) : (
                                <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  All mandatory docs verified
                                </div>
                              )}

                              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] font-mono text-zinc-500">
                                <span>₹{claim.estimated_amount_inr.toLocaleString("en-IN")}</span>
                                <span>{claim.ward_bed}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SCREEN 2: 2-PANE TPA QUERY INBOX */}
          {activeScreen === "QUERY_INBOX" && (
            <QueryInboxView
              claims={claims}
              currentRole={currentRole}
              currentActorName={currentActorName}
              onSelectClaim={(c) => setSelectedClaim(c)}
              onClaimUpdated={handleClaimUpdated}
              onOpenDoctorMobile={(claimId, queryId) => {
                setDoctorTarget({ claimId, queryId });
                setActiveScreen("DOCTOR_MOBILE");
              }}
            />
          )}

          {/* SCREEN 3: CFO DEDUCTIONS & SLA ANALYTICS */}
          {activeScreen === "ANALYTICS" && (
            <AnalyticsView
              claims={claims}
              kpis={kpis}
              onSelectClaim={(c) => setSelectedClaim(c)}
            />
          )}

          {/* SCREEN 4: INSURER x PROCEDURE CHECKLIST RULE MATRIX */}
          {activeScreen === "RULE_MATRIX" && (
            <RuleMatrixView
              currentRole={currentRole}
              onRuleAdded={() => {
                loadWorkspace();
                pushToast("New checklist rule added & synced to active claims");
              }}
            />
          )}

          {/* SCREEN 5: MOBILE DOCTOR CLINICAL NOTE SIGN-OFF */}
          {activeScreen === "DOCTOR_MOBILE" && (
            <DoctorMobileView
              claim={
                claims.find((c) => c.id === doctorTarget?.claimId) || claims[0]
              }
              queryId={doctorTarget?.queryId}
              onBackToDesk={() => setActiveScreen("QUEUE")}
              onClaimUpdated={(u) => {
                handleClaimUpdated(u);
                pushToast("Doctor clinical note digitally signed & attached");
              }}
            />
          )}

          {/* SCREEN 6: DPDP ACT 2023 IMMUTABLE AUDIT LOGS */}
          {activeScreen === "AUDIT_LOGS" && (
            <div className="bg-white rounded-lg border border-zinc-200/90 overflow-hidden animate-fade-up">
              <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900">
                    DPDP Act 2023 Immutable Security &amp; Verification Audit Log
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Every AI field confirmation, slot override, PII policy unmasking, Desk Head
                    waiver, and TPA packet export is permanently logged.
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F7F7F5] border-b border-zinc-200 text-[10px] font-mono font-semibold uppercase text-zinc-500">
                      <th className="py-2.5 px-4">Timestamp</th>
                      <th className="py-2.5 px-4">Claim</th>
                      <th className="py-2.5 px-4">Actor &amp; Role</th>
                      <th className="py-2.5 px-4">Action</th>
                      <th className="py-2.5 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/70 font-mono">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-50/70">
                        <td className="py-2.5 px-4 text-zinc-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-zinc-900">
                          {log.claim_id || "SYSTEM"}
                        </td>
                        <td className="py-2.5 px-4">
                          {log.actor_name} ({log.actor_role})
                        </td>
                        <td className="py-2.5 px-4 text-teal-800 font-semibold">
                          {log.action}
                        </td>
                        <td className="py-2.5 px-4 font-sans text-zinc-700">
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* SLIDE-OVER CLAIM WORKSPACE DRAWER */}
      {selectedClaim && (
        <ClaimWorkspaceModal
          claim={selectedClaim}
          currentRole={currentRole}
          currentActorName={currentActorName}
          onClose={() => setSelectedClaim(null)}
          onClaimUpdated={handleClaimUpdated}
          onNotify={pushToast}
          onOpenDoctorMobile={(claimId, queryId) => {
            setSelectedClaim(null);
            setDoctorTarget({ claimId, queryId });
            setActiveScreen("DOCTOR_MOBILE");
          }}
        />
      )}

      {/* NEW CASHLESS ADMISSION MODAL */}
      {newAdmissionOpen && (
        <NewAdmissionModal
          currentRole={currentRole}
          currentActorName={currentActorName}
          onClose={() => setNewAdmissionOpen(false)}
          onCreated={(created) => {
            setNewAdmissionOpen(false);
            loadWorkspace();
            setSelectedClaim(created);
            pushToast(`Created ${created.id} & generated Insurer × Procedure checklist`);
          }}
        />
      )}

      {/* LIVE-FILTERED ⌘K COMMAND PALETTE */}
      {cmdOpen && (
        <div
          onClick={() => setCmdOpen(false)}
          className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[1px] flex items-start justify-center pt-20 p-4 animate-backdrop"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-lg rounded-lg border border-zinc-300 shadow-2xl overflow-hidden animate-scale-in"
          >
            <div className="px-4 py-3 border-b border-zinc-200 flex items-center gap-2">
              <Command className="w-4 h-4 text-zinc-400" />
              <input
                type="text"
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder="Type Claim ID (CLM-3381), patient name, or command..."
                className="w-full text-xs focus:outline-none"
              />
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">
                ESC
              </kbd>
            </div>
            <div className="p-2 max-h-80 overflow-y-auto custom-scrollbar divide-y divide-zinc-100 text-xs">
              <div className="py-1">
                <div className="px-2 py-1 text-[10px] font-mono uppercase text-zinc-400">
                  Matching Cashless Claims ({filteredCmdClaims.length})
                </div>
                {filteredCmdClaims.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedClaim(c);
                      setCmdOpen(false);
                      setCmdQuery("");
                    }}
                    className="w-full px-2.5 py-2 rounded hover:bg-zinc-100 flex items-center justify-between text-left"
                  >
                    <span>
                      <strong className="font-mono">{c.id}</strong> — {c.patient_name} (
                      {c.procedure.name})
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400">
                      {c.status}
                    </span>
                  </button>
                ))}
              </div>
              <div className="py-1">
                <div className="px-2 py-1 text-[10px] font-mono uppercase text-zinc-400">
                  Quick Actions &amp; Screens
                </div>
                <button
                  onClick={() => {
                    setCmdOpen(false);
                    setNewAdmissionOpen(true);
                  }}
                  className="w-full px-2.5 py-2 rounded hover:bg-zinc-100 text-left font-semibold text-teal-800"
                >
                  + Create New Cashless Admission
                </button>
                {[
                  { id: "QUEUE", label: "Go to Claims Workbench (Table / Kanban)" },
                  { id: "QUERY_INBOX", label: "Go to 2-Pane TPA Query Inbox" },
                  { id: "ANALYTICS", label: "Go to CFO Deductions & SLA Analytics" },
                  { id: "RULE_MATRIX", label: "Go to Insurer × Procedure Rule Engine" },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setActiveScreen(s.id as ActiveScreen);
                      setCmdOpen(false);
                      setCmdQuery("");
                    }}
                    className="w-full px-2.5 py-2 rounded hover:bg-zinc-100 text-left font-medium text-zinc-800"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATIONS (BOTTOM-LEFT) */}
      <div className="fixed bottom-4 left-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-3.5 py-2.5 rounded-md border shadow-lg text-xs font-medium flex items-center gap-2 animate-fade-up ${
              t.type === "error"
                ? "bg-red-950 text-red-100 border-red-800"
                : "bg-zinc-900 text-white border-zinc-700"
            }`}
          >
            {t.type === "error" ? (
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            )}
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* FLOATING REVIEWER DEMO TOOLKIT (BOTTOM-RIGHT) */}
      <ReviewerToolkit
        currentRole={currentRole}
        onSelectRole={(role, name) => {
          setCurrentRole(role);
          setCurrentActorName(name);
          pushToast(`Switched role to ${name} (${role})`);
          if (role === "DOCTOR") {
            setDoctorTarget({ claimId: "CLM-3385", queryId: "QRY-902" });
            setActiveScreen("DOCTOR_MOBILE");
          }
        }}
        onSimulateQuery={handleSimulateWebhook}
      />
    </div>
  );
}
