"use client";

import { useEffect, useState } from "react";

type ProofSignal = {
  label: string;
  value: string;
};

type ProofMetric = {
  value: string;
  label: string;
};

type ProofMode = "benefits" | "metrics";

const STORAGE_KEY = "dryapi-home-proof-mode";

const modeLabels: Record<ProofMode, string> = {
  benefits: "Benefits",
  metrics: "Stats",
};

export function ProofModeSwitcher({
  highlightMetrics,
  highlightSignals,
  metricMetrics,
  metricSignals,
}: {
  highlightMetrics: ProofMetric[];
  highlightSignals: ProofSignal[];
  metricMetrics: ProofMetric[];
  metricSignals: ProofSignal[];
}) {
  const [mode, setMode] = useState<ProofMode>("benefits");

  useEffect(() => {
    const storedMode = window.localStorage.getItem(STORAGE_KEY);
    if (storedMode === "benefits" || storedMode === "metrics") {
      setMode(storedMode);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const signals = mode === "metrics" ? metricSignals : highlightSignals;
  const metrics = mode === "metrics" ? metricMetrics : highlightMetrics;

  return (
    <div className="mt-8 rounded-[24px] border border-white/15 bg-white/6 p-4 backdrop-blur-xl md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
            Proof mode
          </p>
          <p className="mt-1 text-sm text-white/65">
            Flip between operational stats and product benefits.
          </p>
        </div>

        <div
          aria-label="Proof mode"
          className="inline-flex items-center rounded-full border border-white/15 bg-black/15 p-1 shadow-inner"
          role="group"
        >
          {(Object.keys(modeLabels) as ProofMode[]).map((option) => {
            const selected = mode === option;

            return (
              <button
                aria-pressed={selected}
                className={`rounded-full px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition ${selected ? "bg-white text-slate-950 shadow-sm" : "text-white/65 hover:bg-white/10 hover:text-white"}`}
                key={option}
                onClick={() => setMode(option)}
                type="button"
              >
                {modeLabels[option]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {signals.map((signal) => (
          <div
            className="rounded-full border border-white/15 bg-white/7 px-4 py-1.5 text-[11px] text-white/85 backdrop-blur-md transition-colors hover:bg-white/12"
            key={signal.label}
          >
            <span className="font-medium opacity-60">{signal.label}:</span>{" "}
            <span className="font-semibold">{signal.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-1.5 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div
            className="rounded-xl border border-white/10 bg-black/20 p-4 transition-colors hover:bg-black/30"
            key={metric.label}
          >
            <p className="font-display text-2xl font-bold tracking-tight text-white">
              {metric.value}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
              {metric.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}