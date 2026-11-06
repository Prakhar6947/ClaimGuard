"use client";

import React, { useState } from "react";
import { X, PlusCircle, ShieldCheck } from "lucide-react";
import { Claim, Role } from "@/lib/types";
import { createNewClaim } from "@/lib/api";

interface Props {
  currentRole: Role;
  currentActorName: string;
  onClose: () => void;
  onCreated: (newClaim: Claim) => void;
}

export function NewAdmissionModal({
  currentRole,
  currentActorName,
  onClose,
  onCreated,
}: Props) {
  const [patientName, setPatientName] = useState("Arjun Deshmukh");
  const [patientAge, setPatientAge] = useState(48);
  const [patientGender, setPatientGender] = useState("M");
  const [uhid, setUhid] = useState("NSK-2026-9412");
  const [wardBed, setWardBed] = useState("Surg-2A / Bed 06");
  const [policyNumber, setPolicyNumber] = useState("COMPB-POL-8839204910");
  const [insurerId, setInsurerId] = useState("INS-COMP-B");
  const [procedureId, setProcedureId] = useState("PROC-GALL");
  const [doctorName, setDoctorName] = useState("Dr. Sameer Joshi");
  const [estimatedAmount, setEstimatedAmount] = useState(82000);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await createNewClaim({
        patient_name: patientName,
        patient_age: Number(patientAge),
        patient_gender: patientGender,
        uhid,
        ward_bed: wardBed,
        policy_number_full: policyNumber,
        insurer_id: insurerId,
        procedure_id: procedureId,
        treating_doctor_name: doctorName,
        estimated_amount_inr: Number(estimatedAmount),
        actor_name: currentActorName,
        actor_role: currentRole,
      });
      onCreated(created);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-[2px] flex items-center justify-center p-4 animate-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-lg rounded-lg border border-zinc-300 shadow-2xl overflow-hidden animate-scale-in"
      >
        <div className="px-5 py-3.5 bg-zinc-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-semibold">
              New Cashless Inpatient Admission
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          {error && (
            <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-medium text-zinc-700 mb-1">
                Patient Full Name
              </label>
              <input
                type="text"
                required
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-zinc-300"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Age</label>
                <input
                  type="number"
                  required
                  value={patientAge}
                  onChange={(e) => setPatientAge(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded border border-zinc-300 font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Sex</label>
                <select
                  value={patientGender}
                  onChange={(e) => setPatientGender(e.target.value)}
                  className="w-full px-2 py-1.5 rounded border border-zinc-300 bg-white font-mono"
                >
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                Hospital UHID
              </label>
              <input
                type="text"
                required
                value={uhid}
                onChange={(e) => setUhid(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-zinc-300 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                Ward &amp; Bed Number
              </label>
              <input
                type="text"
                required
                value={wardBed}
                onChange={(e) => setWardBed(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-zinc-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                Insurer / TPA
              </label>
              <select
                value={insurerId}
                onChange={(e) => setInsurerId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-zinc-300 bg-white font-medium"
              >
                <option value="INS-COMP-B">Company B (TPA)</option>
                <option value="INS-COMP-C">Company C (insurer)</option>
                <option value="INS-COMP-D">Company D (TPA)</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                Clinical Procedure
              </label>
              <select
                value={procedureId}
                onChange={(e) => setProcedureId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-zinc-300 bg-white font-medium"
              >
                <option value="PROC-GALL">Gall bladder removal</option>
                <option value="PROC-TKR">Total knee replacement</option>
                <option value="PROC-DENGUE">Dengue with low platelets</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                Policy Number (Encrypted)
              </label>
              <input
                type="text"
                required
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-zinc-300 font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                Treating Consultant
              </label>
              <input
                type="text"
                required
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded border border-zinc-300"
              />
            </div>
            <div>
              <label className="block font-medium text-zinc-700 mb-1">
                Est. Package Tariff (₹)
              </label>
              <input
                type="number"
                required
                value={estimatedAmount}
                onChange={(e) => setEstimatedAmount(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded border border-zinc-300 font-mono"
              />
            </div>
          </div>

          <div className="p-2.5 rounded bg-[#F7F7F5] border border-zinc-200 flex items-center gap-2 text-[11px] text-zinc-600">
            <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
            <span>
              The <strong>3-Tier Checklist Rule Engine</strong> will automatically attach
              universal, insurer, and procedure-specific mandatory document slots.
            </span>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs text-zinc-600 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 rounded text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm"
            >
              {submitting ? "Initializing..." : "Create Claim & Generate Checklist"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
