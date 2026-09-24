"use client";

import React, { useState } from "react";
import CostChart, { type CostRecord } from "@/components/CostChart";
import ImpactMap from "@/components/ImpactMap";
import type { MapAlertItem } from "@/components/ImpactMapInner";

interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

interface ExecutionTraceItem {
  timestamp: string;
  agent_name: string;
  role: string;
  thought: string;
  action: string;
  observation: unknown;
  tool_call?: ToolCall;
}

interface AgentHandoff {
  from_agent: string;
  to_agent: string;
  status: string;
}

interface FinalDiagnosis {
  equipment_id: string;
  issue_identified: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string;
  action_taken: string;
  operational_status: "NORMAL" | "WARNING" | "OFFLINE" | "SAFE_MODE" | string;
  location?: string;
  coordinates?: [number, number];
  estimated_delay_hours?: number;
  cost_impact_usd?: number;
}

interface DiagnoseResponse {
  status: string;
  active_agent: string;
  execution_trace: ExecutionTraceItem[];
  trace: Array<{
    turn: number;
    thought: string;
    tool_call?: ToolCall | null;
    observation?: unknown;
    status?: string;
  }>;
  diagnosis: FinalDiagnosis;
  final_synthesis: Record<string, unknown>;
  agent_handoffs: AgentHandoff[];
  logistics: {
    location?: string;
    coordinates?: [number, number];
    estimated_delay_hours?: number;
    cost_impact_usd?: number;
    operational_status?: string;
    cost_history?: CostRecord[];
    affected_lines?: string[];
  };
}

const TEST_SCENARIOS = [
  {
    id: "scenario-1",
    label: "Turbine-GEN-04: Thermal Overload",
    facility: "Houston Industrial Complex",
    severity: "CRITICAL",
    icon: "🔥",
    text: "CRITICAL ALERT: Turbine generator Turbine-GEN-04 bearing overheating at 104.8°C with elevated vibration (8.7 mm/s). Check live hardware telemetry, consult vector ISO-10816 SOP manuals, and command safe isolation or emergency stop.",
  },
  {
    id: "scenario-2",
    label: "HYD-PUMP-02: Pressure Spike",
    facility: "Seattle Logistics Terminal",
    severity: "CRITICAL",
    icon: "⚙️",
    text: "CRITICAL ALERT: Hydraulic pump unit HYD-PUMP-02 exhibiting high vibration (7.4 mm/s) and oil pressure spike to 215 PSI. Verify telemetry, evaluate ISO-10816 safety directives, and dispatch pressure relief intervention.",
  },
  {
    id: "scenario-3",
    label: "Conveyor-MTR-12: Motor Overload",
    facility: "Rotterdam Gateway Terminal",
    severity: "HIGH",
    icon: "⚡",
    text: "WARNING ALERT: Assembly line heavy drive motor Conveyor-MTR-12 reporting abnormal friction drag, vibration at 6.8 mm/s, and irregular RPM. Query technical manuals and execute corrective PLC throttle.",
  },
];

const AGENT_PIPELINE = [
  { id: "supervisor", name: "Central Supervisor" },
  { id: "diagnostic", name: "Diagnostic Specialist" },
  { id: "safety", name: "Safety Compliance" },
  { id: "mitigation", name: "Mitigation Operator" },
  { id: "logistics", name: "Logistics Analyst" },
];

export default function Home() {
  const [text, setText] = useState(TEST_SCENARIOS[0].text);
  const [loading, setLoading] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const [result, setResult] = useState<DiagnoseResponse | null>(null);
  const [error, setError] = useState("");
  const [copiedTerminal, setCopiedTerminal] = useState(false);

  const handleDiagnose = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setActiveStepIndex(0);

    const stepInterval = setInterval(() => {
      setActiveStepIndex((prev) => (prev < 4 ? prev + 1 : prev));
    }, 1200);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${apiBase}/api/diagnose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to execute multi-agent state graph.");
      }

      const data: DiagnoseResponse = await response.json();
      setResult(data);
      setActiveStepIndex(4);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("Failed to fetch") || (err instanceof TypeError)) {
        setError("Could not connect to the Backend. Please ensure the server is running.");
      } else {
        setError(errMsg || "An unexpected error occurred during diagnosis.");
      }
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  };

  const copyTerminalLogs = () => {
    if (!result) return;
    const logs = result.execution_trace
      .map(
        (t) =>
          `[${t.timestamp}] [${t.agent_name.toUpperCase()}] [${t.role}]\n` +
          `THOUGHT: ${t.thought}\n` +
          `ACTION: ${t.action}\n` +
          `OBSERVATION: ${typeof t.observation === "object" ? JSON.stringify(t.observation) : t.observation}\n`
      )
      .join("\n---\n\n");
    navigator.clipboard.writeText(logs);
    setCopiedTerminal(true);
    setTimeout(() => setCopiedTerminal(false), 2000);
  };

  const getAgentTheme = (agentName: string) => {
    const nameLower = (agentName || "").toLowerCase();
    if (nameLower.includes("supervisor")) return { color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" };
    if (nameLower.includes("diagnostic")) return { color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" };
    if (nameLower.includes("safety") || nameLower.includes("auditor")) return { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" };
    if (nameLower.includes("mitigation") || nameLower.includes("operator")) return { color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" };
    return { color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" };
  };

  const getSeverityBadge = (severity: string) => {
    const s = (severity || "").toUpperCase();
    if (s === "CRITICAL") return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
    if (s === "HIGH") return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
    if (s === "MEDIUM" || s === "MODERATE") return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
  };

  const mapAlertItem: MapAlertItem | null = result
    ? {
        location: result.diagnosis?.location || result.logistics?.location || "Seattle Port",
        disruption_type: result.diagnosis?.issue_identified || "Disruption",
        severity_level: result.diagnosis?.severity || "CRITICAL",
        estimated_delay_hours: result.diagnosis?.estimated_delay_hours ?? 24,
        cost_impact_usd: result.diagnosis?.cost_impact_usd ?? 64000,
        coordinates: (result.diagnosis?.coordinates as [number, number] | undefined) || (result.logistics?.coordinates as [number, number] | undefined),
      }
    : null;

  const costHistory: CostRecord[] = result?.logistics?.cost_history || [];

  return (
    <main className="min-h-screen bg-[#0B0F17] text-slate-100 font-sans antialiased">
      {/* 1. LAYOUT & CENTERING */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-10 space-y-10">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800/60">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Industrial Command Center
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Multi-Agent Autonomous Diagnostics & Logistics
            </p>
          </div>
          
          <div className="flex items-center flex-wrap gap-2">
            {AGENT_PIPELINE.map((agent, index) => {
              const isCompleted = result !== null || (loading && index < activeStepIndex);
              const isActive = loading && index === activeStepIndex;
              return (
                <div
                  key={agent.id}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all flex items-center gap-1.5 ${
                    isActive
                      ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
                      : isCompleted
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-slate-900/50 border-slate-800 text-slate-500"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-indigo-400 animate-pulse' : isCompleted ? 'bg-emerald-400' : 'bg-slate-600'}`}></span>
                  {agent.name}
                </div>
              );
            })}
          </div>
        </header>

        {/* 2-Column Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column (lg:col-span-5): Alert Input */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-6 sm:p-8 space-y-6">
              <div>
                <h2 className="text-base font-semibold text-white mb-4">Input Telemetry / Alert</h2>
                <div className="flex flex-col gap-3">
                  {TEST_SCENARIOS.map((sc) => (
                    <button
                      key={sc.id}
                      onClick={() => setText(sc.text)}
                      className={`text-left p-4 rounded-xl border text-sm transition-colors ${
                        text === sc.text
                          ? "border-indigo-500/40 bg-indigo-500/10 text-white"
                          : "border-slate-800 bg-white/[0.02] text-slate-300 hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-medium flex items-center gap-2">
                          {sc.icon} {sc.label}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${getSeverityBadge(sc.severity)}`}>
                          {sc.severity}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-2">{sc.facility}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste raw telemetry alert..."
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[140px] resize-y"
                />
              </div>

              <button
                onClick={handleDiagnose}
                disabled={loading || !text.trim()}
                className={`w-full py-4 px-6 rounded-xl font-semibold text-base transition-all flex justify-center items-center gap-2 ${
                  loading
                    ? "bg-slate-800 border border-slate-700 text-slate-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/50 text-white shadow-lg shadow-indigo-900/20"
                }`}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-slate-400 border-t-white animate-spin" />
                    Analyzing Workflow...
                  </>
                ) : (
                  "Analyze & Execute Diagnosis"
                )}
              </button>

              {error && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Right Column (lg:col-span-7): Collaboration Stream & Logs */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-6 sm:p-8 flex flex-col h-full min-h-[600px]">
              <h2 className="text-base font-semibold text-white mb-6 border-b border-slate-800/60 pb-4">
                Multi-Agent Collaboration Stream
              </h2>

              <div className="flex-1 overflow-y-auto space-y-6 pb-6 pr-2">
                {!result && !loading ? (
                  <div className="flex h-full items-center justify-center text-slate-500 text-sm h-64">
                    Waiting for telemetry input to begin diagnosis...
                  </div>
                ) : (
                  <>
                    {result?.execution_trace.map((trace, idx) => {
                      const theme = getAgentTheme(trace.agent_name);
                      return (
                        <div key={idx} className="flex gap-4 items-start">
                          <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center border ${theme.bg} ${theme.border} ${theme.color} font-bold text-sm uppercase`}>
                            {trace.agent_name.substring(0, 1)}
                          </div>
                          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl rounded-tl-none p-4 max-w-[90%] space-y-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-semibold ${theme.color}`}>
                                {trace.agent_name.replace(/_/g, " ")}
                              </span>
                              <span className="text-xs text-slate-500">{trace.timestamp}</span>
                            </div>
                            {trace.thought && (
                              <p className="text-sm text-slate-200 leading-relaxed">
                                {trace.thought}
                              </p>
                            )}
                            {trace.action && (
                              <div className="mt-2 inline-block px-3 py-1.5 rounded-lg bg-black/40 border border-white/5 text-xs text-slate-400 font-mono">
                                Action: {trace.action}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {loading && (
                      <div className="flex gap-4 items-start animate-pulse">
                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                           <div className="w-4 h-4 rounded-full border-2 border-slate-500 border-t-slate-300 animate-spin" />
                        </div>
                        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl rounded-tl-none p-4 w-64 h-24"></div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Accordion for Technical Logs */}
              {result && (
                <details className="group rounded-xl border border-slate-800 bg-black/40 overflow-hidden mt-4">
                  <summary className="p-4 cursor-pointer text-sm font-medium text-slate-400 hover:text-slate-200 flex justify-between items-center transition-colors">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="4 17 10 11 4 5"></polyline>
                        <line x1="12" y1="19" x2="20" y2="19"></line>
                      </svg>
                      View Low-Level Execution Logs
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); copyTerminalLogs(); }}
                      className="px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 text-xs transition-colors"
                    >
                      {copiedTerminal ? "Copied!" : "Copy"}
                    </button>
                  </summary>
                  <div className="p-4 border-t border-slate-800 bg-black/60 text-xs font-mono text-slate-500 max-h-64 overflow-y-auto leading-relaxed">
                     <div className="text-slate-400 mb-2">[SYSTEM] Lab 03 Deterministic Execution Boundaries initialized.</div>
                     {result.execution_trace.map((t, idx) => (
                       <div key={`log-${idx}`} className="mb-2 border-l border-slate-800 pl-3 ml-1 py-1">
                         <span className="text-indigo-400">[{t.timestamp}]</span> [{t.agent_name.toUpperCase()}] {t.action}<br/>
                         <span className="opacity-70">OBS: {typeof t.observation === 'object' ? JSON.stringify(t.observation) : String(t.observation)}</span>
                       </div>
                     ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Results Section */}
        {result && (
          <section className="space-y-8 pt-8 border-t border-slate-800/60">
            <h2 className="text-xl font-bold text-white tracking-tight">Executive Summary</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 rounded-xl border border-white/5 bg-slate-900/60">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Target Asset</div>
                <div className="text-lg font-semibold text-white">{result.diagnosis.equipment_id}</div>
              </div>
              <div className="p-6 rounded-xl border border-white/5 bg-slate-900/60">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Status</div>
                <div className={`inline-flex px-3 py-1.5 rounded-full text-xs font-bold ${getSeverityBadge(result.diagnosis.severity)}`}>
                  {result.diagnosis.severity}
                </div>
              </div>
              <div className="p-6 rounded-xl border border-white/5 bg-slate-900/60">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Root Cause</div>
                <div className="text-sm text-slate-300">{result.diagnosis.issue_identified}</div>
              </div>
              <div className="p-6 rounded-xl border border-white/5 bg-slate-900/60">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Mitigation Action</div>
                <div className="text-sm text-emerald-400 font-medium">{result.diagnosis.action_taken}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
              <div className="min-h-[400px] rounded-2xl border border-white/5 bg-slate-900/60 p-6 sm:p-8 flex flex-col">
                <h3 className="text-base font-semibold text-white mb-6">Geospatial Logistics Impact</h3>
                <div className="flex-1 rounded-xl overflow-hidden border border-slate-800 relative z-0">
                  <ImpactMap currentAlert={mapAlertItem} history={[]} />
                </div>
              </div>
              <div className="min-h-[400px] rounded-2xl border border-white/5 bg-slate-900/60 p-6 sm:p-8 flex flex-col">
                <h3 className="text-base font-semibold text-white mb-6">Financial Exposure & Loss</h3>
                <div className="flex-1 rounded-xl overflow-hidden border border-slate-800 relative z-0 p-4 bg-slate-950/40">
                  <CostChart history={costHistory} />
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}