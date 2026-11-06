"use client";

import React, { useEffect, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";

interface Props {
  initialSeconds: number;
  stageLabel?: string;
  compact?: boolean;
}

export function SlaTimerBadge({ initialSeconds, stageLabel, compact = false }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isBreached = secondsLeft <= 0;
  const isUrgent = secondsLeft > 0 && secondsLeft < 2700; // < 45 mins
  const absSec = Math.abs(secondsLeft);
  const hrs = Math.floor(absSec / 3600);
  const mins = Math.floor((absSec % 3600) / 60);
  const secs = absSec % 60;

  const formatted = `${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

  if (isBreached) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[5px] text-[11px] font-mono tabular-nums bg-red-50/90 text-red-700 border border-red-200/90 font-medium shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
        <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse-dot" />
        {!compact && <span>SLA Breached</span>} +{formatted}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[5px] text-[11px] font-mono tabular-nums border transition-colors ${
        isUrgent
          ? "bg-amber-50/90 text-amber-800 border-amber-200/90 font-medium"
          : "bg-[#F4F4F1] text-zinc-700 border-zinc-200/80"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isUrgent ? "bg-amber-500 animate-pulse-dot" : "bg-teal-600"
        }`}
      />
      {stageLabel && !compact ? (
        <span className="text-zinc-500 font-sans text-[10px] uppercase tracking-wider">
          {stageLabel}
        </span>
      ) : null}
      <span>{formatted}</span>
    </span>
  );
}
