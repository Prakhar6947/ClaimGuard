"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, AlertCircle, Sparkles, Building2, User, Stethoscope } from "lucide-react";
import { fetchRulesMatrix, createClaim } from "@/lib/api";
import { Claim, Role } from "@/lib/types";

interface Props {
  currentRole: Role;
  currentActorName: string;
  onClose: () => void;
  onClaimCreated: (createdClaim: Claim) => void;
}

export function NewClaimModal({
  currentRole,
  currentActorName,
  onClose,
  onClaimCreated,
}: Props) {
  const [insurers, setInsurers] = useState<{ id: string; name: string }[]>([]);
  const [procedures, setProcedures] = useState<{ id: string; name: string; department: string }[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);

  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState<number>(48);
  const [patientGender, setPatientGender] = useState("M");
  const [uhid, setUhid] = useState("");
  const [wardBed, setWardBed] = useState("Surg-3B / Bed 18");
  const [policyNumber, setPolicyNumber] = useState("");
  const [insurerId, setInsurerId] = useState("");
  const [procedureId, setProcedureId] = useState("");
  const [doctorName, setDoctorName] = useState("Dr. Demo One");
  const [estimatedAmount, setEstimatedAmount] = useState<number>(82000);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoadingLookups(true);
        const res = await fetchRulesMatrix();
        setInsurers(res.insurers || []);
        setProcedures(res.procedures || []);
        if (res.insurers?.length > 0) setInsurerId(res.insurers[0].id);
        if (res.procedures?.length > 0) setProcedureId(res.procedures[0].id);
      } catch (err: any) {
        setError("Failed to load insurers and procedures list");
      } finally {
        setLoadingLookups(false);
      }
    }
    loadData();
  }, []);

  function handleAutoFillSample() {
    setPatientName("Demo Patient E");
    setPatientAge(54);
    setPatientGender("M");
    setUhid(`DEMO-UHID-${Math.floor(1000 + Math.random() * 9000)}`);
    setWardBed("Surg-2A / Bed 07");
    setPolicyNumber(`DEMO-POLICY-${Math.floor(10000000 + Math.random() * 90000000)}`);
    setDoctorName("Dr. Demo One");
    setEstimatedAmount(79500);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!insurerId || !procedureId) {
      setError("Please select both an Insurer and a Procedure.");
      return;
    }
    setSaving(true);
    try {
      const created = await createClaim({
        patient_name: patientName.trim(),
        patient_age: Number(patientAge),
        patient_gender: patientGender,
        uhid: uhid.trim() || `DEMO-UHID-${Math.floor(1000 + Math.random() * 9000)}`,
        ward_bed: wardBed.trim(),
        policy_number_full: policyNumber.trim(),
        insurer_id: insurerId,
        procedure_id: procedureId,
        treating_doctor_name: doctorName.trim(),
        estimated_amount_inr: Number(estimatedAmount),
        assigned_exec_name: currentActorName,
      });
      onClaimCreated(created);
    } catch (err: any) {
      setError(err.message || "Failed to register new cashless admission.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-3 md:p-6">
      <div className="bg-white border border-zinc-300 rounded-md w-full max-w-2xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-zinc-900 text-white flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-teal-700 flex items-center justify-center font-bold text-xs">
              +
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">
                New Cashless Admission Registration
              </h2>
              <p className="text-[11px] text-zinc-400">
                Rule Engine automatically populates 3-tier checklist upon creation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Quick Demo Pre-fill Pill */}
          <div className="p-2.5 rounded bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-900">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              Testing New Admission Flow? Pre-fill verified patient data:
            </span>
            <button
              type="button"
              onClick={handleAutoFillSample}
              className="px-2.5 py-1 rounded bg-amber-200 hover:bg-amber-300 text-amber-950 font-semibold"
            >
              1-Click Auto-Fill Sample
            </button>
          </div>

          {error && (
            <div className="p-3 rounded bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Patient Identity */}
          <div className="space-y-3">
            <div className="font-semibold text-zinc-800 uppercase tracking-wider text-[11px] border-b border-zinc-200 pb-1">
              1. Patient Demographics &amp; Admission
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-medium text-zinc-700 mb-1">
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Demo Patient E"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded focus:border-teal-700 bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  Age &amp; Gender *
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="number"
                    required
                    min={1}
                    max={120}
                    value={patientAge}
                    onChange={(e) => setPatientAge(Number(e.target.value))}
                    className="w-16 px-2 py-1.5 border border-zinc-300 rounded font-mono bg-white"
                  />
                  <select
                    value={patientGender}
                    onChange={(e) => setPatientGender(e.target.value)}
                    className="flex-1 px-2 py-1.5 border border-zinc-300 rounded bg-white font-mono"
                  >
                    <option value="M">M</option>
                    <option value="F">F</option>
                    <option value="O">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  Hospital UHID Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., DEMO-UHID-9214"
                  value={uhid}
                  onChange={(e) => setUhid(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded font-mono bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  Ward &amp; Bed Location *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Surg-3B / Bed 18"
                  value={wardBed}
                  onChange={(e) => setWardBed(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Insurer & Clinical Plan */}
          <div className="space-y-3 pt-2">
            <div className="font-semibold text-zinc-800 uppercase tracking-wider text-[11px] border-b border-zinc-200 pb-1">
              2. Cashless Policy &amp; Clinical Procedure
            </div>

            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                Full Insurance Policy Number * (Auto-masked for DPDP compliance)
              </label>
              <input
                type="text"
                required
                placeholder="e.g., DEMO-POLICY-TEST"
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-zinc-300 rounded font-mono bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  Insurer / TPA Scope *
                </label>
                <select
                  value={insurerId}
                  onChange={(e) => setInsurerId(e.target.value)}
                  disabled={loadingLookups}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded bg-white"
                >
                  {insurers.map((ins) => (
                    <option key={ins.id} value={ins.id}>
                      {ins.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  Proposed Procedure *
                </label>
                <select
                  value={procedureId}
                  onChange={(e) => setProcedureId(e.target.value)}
                  disabled={loadingLookups}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded bg-white"
                >
                  {procedures.map((proc) => (
                    <option key={proc.id} value={proc.id}>
                      {proc.name} ({proc.department})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  Treating Doctor Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Dr. Demo One"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded bg-white"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  Estimated Tariff Bill (INR) *
                </label>
                <input
                  type="number"
                  required
                  min={1000}
                  step={500}
                  value={estimatedAmount}
                  onChange={(e) => setEstimatedAmount(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-zinc-300 rounded font-mono bg-white"
                />
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-zinc-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded text-zinc-700 hover:bg-zinc-100 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded font-semibold bg-zinc-900 hover:bg-zinc-800 text-white flex items-center gap-1.5 transition disabled:bg-zinc-400"
            >
              <Plus className="w-3.5 h-3.5" />
              {saving ? "Creating & Materializing Checklist..." : "Create Admission & Open Workspace"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
