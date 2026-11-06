"use client";

import React, { useState } from "react";
import { Shield, KeyRound, ArrowRight, UserCheck, Stethoscope, AlertCircle, Loader2 } from "lucide-react";
import { loginUser } from "@/lib/api";
import { AuthUser } from "@/lib/types";

interface Props {
  onLoginSuccess: (user: AuthUser, token: string) => void;
}

const DEMO_USERS = [
  {
    roleLabel: "Login as Desk Executive",
    name: "Demo Executive",
    email: "demo.exec@example.invalid",
    role: "DESK_EXEC",
    dept: "Cashless Insurance Desk",
    icon: UserCheck,
    note: "Day-to-day claims processing, scan upload, OCR verification",
  },
  {
    roleLabel: "Login as Desk Head (Admin)",
    name: "Demo Desk Head",
    email: "demo.head@example.invalid",
    role: "DESK_HEAD",
    dept: "Insurance & TPA Administration",
    icon: Shield,
    note: "Rule matrix editor, mandatory checklist slot waivers, audit sign-off",
  },
  {
    roleLabel: "Login as Treating Doctor",
    name: "Dr. Demo One",
    email: "demo.doctor@example.invalid",
    role: "DOCTOR",
    dept: "General & Laparoscopic Surgery",
    icon: Stethoscope,
    note: "Ward round mobile clinical justifications, 1-tap digital sign-off",
  },
];

export function SignInView({ onLoginSuccess }: Props) {
  const [email, setEmail] = useState("demo.exec@example.invalid");
  const [password, setPassword] = useState("ClaimGuard@2026");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(userEmail = email, userPassword = password) {
    setLoading(true);
    setError(null);
    try {
      const res = await loginUser(userEmail, userPassword);
      if (typeof window !== "undefined") {
        localStorage.setItem("claimguard_token", res.access_token);
        localStorage.setItem("claimguard_user", JSON.stringify(res.user));
      }
      onLoginSuccess(res.user, res.access_token);
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please verify your email and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F6F3] text-zinc-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Hospital Brand Badge */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-zinc-900 text-teal-400 font-mono font-bold text-lg mb-2 shadow-sm border border-zinc-700">
            CG
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 uppercase">
            ClaimGuard Nashik
          </h1>
          <p className="text-xs font-mono text-zinc-500">
            Company A Multispeciality Hospital · Cashless TPA Desk
          </p>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono bg-zinc-200/80 text-zinc-700 border border-zinc-300">
            <Shield className="w-3 h-3 text-teal-700" />
            IRDAI 2024 &amp; DPDP Act 2023 Compliant Workspace
          </div>
        </div>

        {/* 1-Click Instant Demo Login Pills for Fast Reviewer Testing */}
        <div className="bg-white p-4 rounded-md border border-zinc-200 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              1-Click Demo Logins (No Typing Required)
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-teal-50 text-teal-800 border border-teal-200">
              Instant JWT Auth
            </span>
          </div>

          <div className="space-y-2">
            {DEMO_USERS.map((demo) => {
              const Icon = demo.icon;
              return (
                <button
                  key={demo.email}
                  type="button"
                  onClick={() => {
                    setEmail(demo.email);
                    setPassword("ClaimGuard@2026");
                    handleLogin(demo.email, "ClaimGuard@2026");
                  }}
                  disabled={loading}
                  className="w-full p-2.5 rounded border border-zinc-200 hover:border-teal-700 hover:bg-teal-50/40 text-left transition flex items-center justify-between group bg-zinc-50/60"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded bg-zinc-200 group-hover:bg-teal-700 group-hover:text-white flex items-center justify-center text-zinc-700 transition">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-zinc-900 group-hover:text-teal-900">
                        {demo.roleLabel}
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono">
                        {demo.name} · {demo.dept}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-teal-700 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Standard Manual Login Form */}
        <div className="bg-white p-5 rounded-md border border-zinc-200 shadow-sm space-y-4">
          <div className="border-b border-zinc-200 pb-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-teal-700" />
              Staff Credential Sign-In
            </h2>
          </div>

          {error && (
            <div className="p-3 rounded bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-3.5 text-xs"
          >
            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                Hospital Staff Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@companya-hospital.in"
                className="w-full px-3 py-2 border border-zinc-300 rounded font-mono focus:outline-none focus:border-teal-700 bg-white"
              />
            </div>

            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3 py-2 border border-zinc-300 rounded font-mono focus:outline-none focus:border-teal-700 bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded font-semibold bg-zinc-900 hover:bg-zinc-800 text-white flex items-center justify-center gap-2 transition disabled:bg-zinc-400"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                  Authenticating...
                </>
              ) : (
                <>
                  <span>Sign In to ClaimGuard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center text-[11px] text-zinc-400 font-mono">
            Password: <code>ClaimGuard@2026</code>
          </div>
        </div>
      </div>
    </div>
  );
}
