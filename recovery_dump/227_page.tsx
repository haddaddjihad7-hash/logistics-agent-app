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
  diagnostic_data?: Record<string, unknown>;
  compliance_data?: Record<string, unknown>;
  mitigation_data?: Record<string, unknown>;
}

const TEST_SCENARIOS = [
  {
    id: "scenario-1",
    label: "⚡ Turbine-GEN-04: Bearing Thermal Overload",
    facility: "Houston Industrial Complex",
    equipment: "Turbine-GEN-04",
    severity: "CRITICAL",
    icon: "🔥",
    text: "CRITICAL ALERT: Turbine generator Turbine-GEN-04 bearing overheating at 104.8°C with elevated vibration (8.7 mm/s). Check live hardware telemetry, consult vector ISO-10816 SOP manuals, and command safe isolation or emergency stop.",
  },
  {
    id: "scenario-2",
    label: "🚨 HYD-PUMP-02: Pressure Spike & Cavitation",
    facility: "Seattle Logistics Terminal",
    equipment: "HYD-PUMP-02",
    severity: "CRITICAL",
    icon: "⚙️",
    text: "CRITICAL ALERT: Hydraulic pump unit HYD-PUMP-02 exhibiting high vibration (7.4 mm/s) and oil pressure spike to 215 PSI. Verify telemetry, evaluate ISO-10816 safety directives, and dispatch pressure relief intervention.",
  },
  {
    id: "scenario-3",
    label: "📦 Conveyor-MTR-12: Motor Overload & Drag",
    facility: "Rotterdam Gateway Terminal",
    equipment: "Conveyor-MTR-12",
    severity: "HIGH",
    icon: "⚡",
    text: "WARNING ALERT: Assembly line heavy drive motor Conveyor-MTR-12 reporting abnormal friction drag, vibration at 6.8 mm/s, and irregular RPM. Query technical manuals and execute corrective PLC throttle.",
  },
];

const AGENT_PIPELINE = [
  { id: "supervisor", name: "Central Supervisor", role: "Orchestrator", color: "#6366f1", badge: "border-indigo-500/40 text-indigo-400 bg-indigo-950/30" },
  { id: "diagnostic", name: "Diagnostic Specialist", role: "Telemetry Analysis", color: "#06b6d4", badge: "border-cyan-500/40 text-cyan-400 bg-cyan-950/30" },
  { id: "safety", name: "Safety Compliance Auditor", role: "ISO Standards & SOP", color: "#f59e0b", badge: "border-amber-500/40 text-amber-400 bg-amber-950/30" },
  { id: "mitigation", name: "Mitigation Operator", role: "PLC Control Bus", color: "#f43f5e", badge: "border-rose-500/40 text-rose-400 bg-rose-950/30" },
  { id: "logistics", name: "Logistics Impact Analyst", role: "Financial & Geo Risk", color: "#a855f7", badge: "border-purple-500/40 text-purple-400 bg-purple-950/30" },
];

export default function Home() {
  const [text, setText] = useState(TEST_SCENARIOS[0].text);
  const [loading, setLoading] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const [result, setResult] = useState<DiagnoseResponse | null>(null);
  const [error, setError] = useState("");
  const [terminalExpanded, setTerminalExpanded] = useState(true);
  const [copiedTerminal, setCopiedTerminal] = useState(false);

  const handleDiagnose = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setActiveStepIndex(0);

    // Simulate animated step transitions during network request
    const stepInterval = setInterval(() => {
      setActiveStepIndex((prev) => (prev < 4 ? prev + 1 : prev));
    }, 1200);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${apiBase}/api/diagnose`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
        setError(
          "Could not connect to the Multi-Agent Backend at http://127.0.0.1:8000. Please ensure the FastAPI server is running."
        );
      } else {
        setError(errMsg || "An unexpected error occurred during multi-agent diagnosis.");
      }
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  };

  const getAgentTheme = (agentName: string) => {
    const nameLower = (agentName || "").toLowerCase();
    if (nameLower.includes("supervisor")) {
      return {
        cardClass: "agent-card-supervisor",
        badgeClass: "border-indigo-500/40 text-indigo-300 bg-indigo-950/40",
        dotColor: "#6366f1",
        label: "Supervisor Node",
        icon: (
          <svg className="w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        ),
      };
    }
    if (nameLower.includes("diagnostic")) {
      return {
        cardClass: "agent-card-diagnostic",
        badgeClass: "border-cyan-500/40 text-cyan-300 bg-cyan-950/40",
        dotColor: "#06b6d4",
        label: "Diagnostic Specialist",
        icon: (
          <svg className="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        ),
      };
    }
    if (nameLower.includes("safety") || nameLower.includes("auditor")) {
      return {
        cardClass: "agent-card-safety",
        badgeClass: "border-amber-500/40 text-amber-300 bg-amber-950/40",
        dotColor: "#f59e0b",
        label: "Safety Compliance Auditor",
        icon: (
          <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ),
      };
    }
    if (nameLower.includes("mitigation") || nameLower.includes("operator") || nameLower.includes("control")) {
      return {
        cardClass: "agent-card-mitigation",
        badgeClass: "border-rose-500/40 text-rose-300 bg-rose-950/40",
        dotColor: "#f43f5e",
        label: "Mitigation Operator",
        icon: (
          <svg className="w-4 h-4 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        ),
      };
    }
    return {
      cardClass: "agent-card-logistics",
      badgeClass: "border-purple-500/40 text-purple-300 bg-purple-950/40",
      dotColor: "#a855f7",
      label: "Logistics Impact Analyst",
      icon: (
        <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
    };
  };

  const getSeverityBadge = (severity: string) => {
    const s = (severity || "").toUpperCase();
    if (s === "CRITICAL") {
      return "bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.3)]";
    }
    if (s === "HIGH") {
      return "bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.3)]";
    }
    if (s === "MEDIUM" || s === "MODERATE") {
      return "bg-blue-500/20 text-blue-400 border border-blue-500/40";
    }
    return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40";
  };

  const getOperationalStatusBadge = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s === "OFFLINE" || s === "HALT") {
      return "bg-rose-950/50 text-rose-400 border border-rose-500/50";
    }
    if (s === "SAFE_MODE" || s === "WARNING") {
      return "bg-amber-950/50 text-amber-400 border border-amber-500/50";
    }
    return "bg-emerald-950/50 text-emerald-400 border border-emerald-500/50";
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

  // Prepare map and chart data
  const mapAlertItem: MapAlertItem | null = result
    ? {
        location: result.diagnosis?.location || result.logistics?.location || "Seattle Port Logistics Facility",
        disruption_type: result.diagnosis?.issue_identified || "Hydraulic Cavitation Disruption",
        severity_level: result.diagnosis?.severity || "CRITICAL",
        estimated_delay_hours: result.diagnosis?.estimated_delay_hours ?? 24,
        cost_impact_usd: result.diagnosis?.cost_impact_usd ?? 64000,
      }
    : null;

  const costHistory: CostRecord[] = result?.logistics?.cost_history || [];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased selection:bg-cyan-500 selection:text-black">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ============================================================== */}
        {/* SPECIFICATION 2.1: LIVE AGENT SWARM STATUS BAR (TOP HEADER)   */}
        {/* ============================================================== */}
        <header className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl p-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-purple-500 opacity-80"></div>
          
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
                <span className="text-[11px] font-mono tracking-widest uppercase text-cyan-400 font-bold">
                  AUTONOMOUS MULTI-AGENT COMMAND CENTER • ENTERPRISE GRADE v3.6
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1 text-white flex items-center gap-2">
                <span>Industrial & Logistics Swarm</span>
                <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-400">
                  LangGraph • Lab 03 Guardrails
                </span>
              </h1>
            </div>

            {/* Neural Subsystems Badge Cluster */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="px-3 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Gemini 3.1/3.6 Flash Active
              </span>
              <span className="px-3 py-1 rounded-lg bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                Deterministic Guardrails Armed
              </span>
              <span className="px-3 py-1 rounded-lg bg-purple-950/40 border border-purple-500/30 text-purple-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                ChromaDB Episodic: 205 Vectors
              </span>
            </div>
          </div>

          {/* Sequential Agent Pipeline Chips */}
          <div className="border-t border-white/10 pt-4">
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-2 flex items-center justify-between">
              <span>HIERARCHICAL MULTI-AGENT STATE GRAPH ORCHESTRATION</span>
              <span>
                {loading
                  ? "LOOP IN PROGRESS..."
                  : result
                  ? "WORKFLOW VERIFIED & STABILIZED"
                  : "READY TO DEPLOY"}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
              {AGENT_PIPELINE.map((agent, index) => {
                const isCompleted = result !== null || (loading && index < activeStepIndex);
                const isActive = loading && index === activeStepIndex;
                const isIdle = !result && (!loading || index > activeStepIndex);

                return (
                  <div
                    key={agent.id}
                    className={`p-2.5 rounded-xl border transition-all duration-300 flex items-center gap-2.5 ${
                      isActive
                        ? "border-cyan-400 bg-cyan-950/30 shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-cyber-pulse"
                        : isCompleted
                        ? "border-emerald-500/40 bg-emerald-950/20"
                        : "border-white/5 bg-white/[0.02] opacity-70"
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <span
                        className={`w-3 h-3 rounded-full block ${
                          isActive
                            ? "bg-cyan-400 animate-ping"
                            : isCompleted
                            ? "bg-emerald-400 shadow-[0_0_8px_#10b981]"
                            : "bg-slate-600"
                        }`}
                      ></span>
                    </div>

                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-white truncate flex items-center gap-1">
                        <span>{agent.name}</span>
                      </div>
                      <div className="text-[9px] font-mono text-slate-400 truncate">
                        {isActive
                          ? "THINKING & EXECUTING..."
                          : isCompleted
                          ? "VERIFIED & HANDED OFF"
                          : agent.role}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </header>

        {/* ============================================================== */}
        {/* SPECIFICATION 2.2: TWO-COLUMN COMMAND CONSOLE                 */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* LEFT COLUMN (lg:col-span-5): Alert Input & Connected Hardware */}
          <div className="lg:col-span-5 space-y-6">

            {/* Industrial Alert Input Card */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  Industrial Alert Stream
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                  Deterministic Ingestion
                </span>
              </div>

              {/* Scenario Preset Buttons */}
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-2 font-semibold">
                  PRESET INDUSTRIAL INCIDENT SCENARIOS
                </span>
                <div className="flex flex-col gap-2">
                  {TEST_SCENARIOS.map((sc) => {
                    const isSelected = text === sc.text;
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => setText(sc.text)}
                        className={`text-left p-3 rounded-xl border text-xs transition-all duration-200 ${
                          isSelected
                            ? "border-cyan-500/60 bg-cyan-950/30 text-white shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                            : "border-white/5 bg-white/[0.02] text-slate-300 hover:border-white/20 hover:bg-white/[0.04]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-white flex items-center gap-1.5">
                            <span>{sc.icon}</span>
                            <span>{sc.label}</span>
                          </span>
                          <span
                            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                              sc.severity === "CRITICAL"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {sc.severity}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 font-mono">
                          <span>Facility: {sc.facility}</span>
                          <span>•</span>
                          <span>Unit: {sc.equipment}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Editable Textarea */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
                  <span>RAW ALERT / DISRUPTION TELEMETRY</span>
                  <span>{text.length} chars</span>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Inject raw telemetry disruption alert or machine failure event..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 min-h-[110px] resize-y placeholder:text-slate-600"
                />
              </div>

              {/* Stress Test Trigger */}
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setText(
                      "TEST ATTACK: DROP TABLE assets; SELECT * FROM credentials; null byte \\x00 injection probe on equipment INVALID$$$NAME"
                    )
                  }
                  className="text-[11px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Inject Lab 03 Guardrail Stress Test
                </button>
                <button
                  type="button"
                  onClick={() => setText("")}
                  className="text-[11px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Clear Input
                </button>
              </div>

              {/* Main Autonomous Loop Trigger Button */}
              <button
                type="button"
                onClick={handleDiagnose}
                disabled={loading || !text.trim()}
                className={`w-full py-4 px-6 rounded-xl font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-3 relative overflow-hidden ${
                  loading
                    ? "bg-slate-800 text-slate-400 cursor-not-allowed border border-white/5"
                    : "bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white shadow-[0_0_25px_rgba(6,182,212,0.4)] border border-cyan-400/40 hover:scale-[1.01]"
                }`}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
                    <span>ORCHESTRATING MULTI-AGENT STATE GRAPH...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 text-cyan-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <span>RUN MULTI-AGENT AUTONOMOUS LOOP</span>
                  </>
                )}
              </button>

              {error && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
                  <span className="text-base">⚠️</span>
                  <div className="font-mono">{error}</div>
                </div>
              )}
            </div>

            {/* Connected Hardware & Neural Subsystems Panel */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                    <line x1="6" y1="6" x2="6.01" y2="6" />
                    <line x1="6" y1="18" x2="6.01" y2="18" />
                  </svg>
                  Edge Hardware & Vector Nodes
                </h3>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded">
                  4/4 ONLINE
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-mono text-[10px]">PLC BUS</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  </div>
                  <div className="font-semibold text-white text-[11px]">Siemens S7-1500</div>
                  <div className="text-[10px] font-mono text-slate-500">102/TCP • Latency 8ms</div>
                </div>

                <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-mono text-[10px]">VECTOR STORE</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  </div>
                  <div className="font-semibold text-white text-[11px]">ChromaDB Episodic</div>
                  <div className="text-[10px] font-mono text-slate-500">205 Vectors • Cosine</div>
                </div>

                <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-mono text-[10px]">TELEMETRY</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  </div>
                  <div className="font-semibold text-white text-[11px]">Modbus / MQTT Edge</div>
                  <div className="text-[10px] font-mono text-slate-500">Stream 42.1 kS/s</div>
                </div>

                <div className="p-2.5 rounded-xl bg-black/30 border border-white/5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-mono text-[10px]">NEURAL CORE</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  </div>
                  <div className="font-semibold text-white text-[11px]">Gemini 3.1/3.6 Flash</div>
                  <div className="text-[10px] font-mono text-slate-500">Zero Temp Guardrail</div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (lg:col-span-7): Multi-Agent Collaboration Stream & Terminal */}
          <div className="lg:col-span-7 space-y-6">

            {/* Multi-Agent Collaboration Feed Card */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <h2 className="text-base font-semibold text-white">Multi-Agent Collaboration Feed</h2>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {result ? `${result.execution_trace.length} Trace Events` : "Awaiting Trigger"}
                </span>
              </div>

              {/* Feed Content */}
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 cyber-scrollbar">
                {result ? (
                  result.execution_trace.map((item, idx) => {
                    const theme = getAgentTheme(item.agent_name);
                    return (
                      <div
                        key={idx}
                        className={`rounded-xl border p-4 space-y-2.5 transition-all duration-200 ${theme.cardClass} border-white/10`}
                      >
                        {/* Agent Card Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded-lg bg-white/5 border border-white/10">
                              {theme.icon}
                            </span>
                            <span className="font-bold text-xs text-white tracking-wide">
                              {item.agent_name}
                            </span>
                            <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${theme.badgeClass}`}>
                              {item.role}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {item.timestamp}
                          </span>
                        </div>

                        {/* Rationale / Thought */}
                        <div className="text-xs text-slate-200 bg-black/40 rounded-lg p-2.5 border-l-2 border-cyan-400 leading-relaxed font-sans">
                          <span className="text-[10px] font-mono uppercase text-cyan-400 block font-bold mb-0.5">
                            ENGINEERING RATIONALE
                          </span>
                          {item.thought}
                        </div>

                        {/* Action Pill */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-400">ACTION:</span>
                          <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-cyan-300 font-semibold break-all">
                            {item.action}
                          </span>
                        </div>

                        {/* Hardware Observation / Output */}
                        {item.observation && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono text-slate-400">OBSERVATION:</span>
                            <div className="text-[11px] font-mono bg-black/60 border border-white/5 rounded-lg p-2 text-slate-300 whitespace-pre-wrap max-h-32 overflow-y-auto cyber-scrollbar">
                              {typeof item.observation === "object"
                                ? JSON.stringify(item.observation, null, 2)
                                : String(item.observation)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : loading ? (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin"></div>
                    <span className="text-xs font-mono tracking-widest uppercase text-cyan-300">
                      Agents reasoning across state boundaries...
                    </span>
                  </div>
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-3 text-center">
                    <svg className="w-10 h-10 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                    <div className="text-xs font-mono">
                      No active multi-agent execution session.
                      <br />
                      Select a scenario on the left and click "Run Multi-Agent Autonomous Loop".
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Collapsible Cyber Raw Terminal Card */}
            <div className="rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl shadow-2xl overflow-hidden font-mono text-xs">
              <div className="bg-slate-900/80 px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
                  </div>
                  <span className="text-slate-400 text-[11px] font-semibold ml-2">
                    Lab 03 Security Boundary & Telemetry Console
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {result && (
                    <button
                      type="button"
                      onClick={copyTerminalLogs}
                      className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors text-[10px]"
                    >
                      {copiedTerminal ? "Copied!" : "Copy Logs"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setTerminalExpanded(!terminalExpanded)}
                    className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors text-[10px]"
                  >
                    {terminalExpanded ? "Collapse" : "Expand"}
                  </button>
                </div>
              </div>

              {terminalExpanded && (
                <div className="p-4 max-h-56 overflow-y-auto cyber-scrollbar space-y-1.5 text-[11px] leading-relaxed">
                  <div className="text-slate-500">[KERNEL] Lab 03 Deterministic Execution Boundaries initialized.</div>
                  <div className="text-slate-500">[SCHEMA] Pydantic v2 Whitelist: ^[A-Z0-9-]+$, query len [3-200], SQL filters active.</div>
                  <div className="text-slate-500">[CHROMA] Vector Collection 'episodic_memory' mounted with 205 documents.</div>

                  {result ? (
                    result.execution_trace.map((t, idx) => (
                      <div key={`term-${idx}`} className="space-y-0.5 pt-1 border-t border-white/5">
                        <div className="text-cyan-400">
                          &gt; [{t.timestamp}] [{t.agent_name.toUpperCase()}] {t.action}
                        </div>
                        <div className="text-slate-400 pl-4">
                          ↳ OBSERVATION: {typeof t.observation === "object" ? JSON.stringify(t.observation) : t.observation}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-emerald-400 animate-pulse">&gt; Terminal idle. Awaiting command loop execution...</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* SPECIFICATION 2.3: STRATEGIC OUTPUT DASHBOARD                  */}
        {/* ============================================================== */}
        <section className="space-y-6 pt-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
              Strategic Industrial & Trade Impact Output
            </h2>
            <span className="text-xs font-mono text-slate-400">
              Executive Decision Matrix • Geospatial Routing • Cost Exposure
            </span>
          </div>

          {/* Final Executive Decision Card */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                  TARGET ASSET ID
                </span>
                <span className="text-lg font-extrabold text-white font-mono mt-0.5 block">
                  {result ? result.diagnosis.equipment_id : "NO ASSET"}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                  INCIDENT SEVERITY
                </span>
                <span
                  className={`inline-block mt-1 text-xs font-mono font-bold px-2.5 py-0.5 rounded-md ${
                    result ? getSeverityBadge(result.diagnosis.severity) : "text-slate-500"
                  }`}
                >
                  {result ? result.diagnosis.severity : "STANDBY"}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                  MACHINE STATE TRANSITION
                </span>
                <span
                  className={`inline-block mt-1 text-xs font-mono font-bold px-2.5 py-0.5 rounded-md ${
                    result ? getOperationalStatusBadge(result.diagnosis.operational_status) : "text-slate-500"
                  }`}
                >
                  {result ? result.diagnosis.operational_status : "STANDBY"}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                  FINANCIAL EXPOSURE
                </span>
                <span className="text-lg font-extrabold text-emerald-400 font-mono mt-0.5 block">
                  {result?.diagnosis.cost_impact_usd
                    ? `$${result.diagnosis.cost_impact_usd.toLocaleString()}`
                    : "$0.00"}
                </span>
              </div>
            </div>

            {/* Root Cause & Mitigating Action Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-1.5">
                <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  Identified Mechanical Root Cause
                </span>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {result
                    ? result.diagnosis.issue_identified
                    : "Awaiting multi-agent telemetry diagnostics and vector compliance matching."}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-1.5">
                <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Confirmed Mitigation & Control Actuation
                </span>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {result
                    ? result.diagnosis.action_taken
                    : "Zero-energy safe mode isolation standby via verified PLC interface."}
                </p>
              </div>
            </div>
          </div>

          {/* Dynamic Map & Cost Analytics Area */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Geospatial Trade Impact Map */}
            <div className="min-h-[420px]">
              <ImpactMap currentAlert={mapAlertItem} history={[]} />
            </div>

            {/* Cumulative Financial Loss Curve */}
            <div className="min-h-[420px]">
              <CostChart history={costHistory} />
            </div>
          </div>
        </section>

        {/* System Footer */}
        <footer className="border-t border-white/10 pt-4 pb-8 text-center text-xs font-mono text-slate-500 flex flex-col md:flex-row items-center justify-between gap-2">
          <div>NextSkill Autonomous Industrial & Logistics Command Center</div>
          <div>FastAPI • Google Gemini 3.1/3.6 Flash • LangGraph • React 19 Next.js App Router</div>
        </footer>
      </div>
    </main>
  );
}
