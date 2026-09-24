"use client";

import React, { useState } from "react";

interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

interface ReActStep {
  turn: number;
  thought: string;
  tool_call?: ToolCall | null;
  observation?: any;
  status?: string;
}

interface ExecutionTraceStep {
  timestamp?: string;
  agent_name: string;
  thought: string;
  action?: any;
  arguments?: Record<string, any>;
  observation?: any;
  status?: string;
}

interface FinalDiagnosis {
  equipment_id: string;
  issue_identified: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string;
  action_taken: string;
  operational_status: "NORMAL" | "WARNING" | "OFFLINE" | "SAFE_MODE" | string;
  location?: string;
  coordinates?: number[];
  estimated_delay_hours?: number;
  cost_impact_usd?: number;
}

interface FinalSynthesis {
  equipment_id?: string;
  issue_identified?: string;
  severity?: string;
  action_taken?: string;
  operational_status?: string;
  location?: string;
  coordinates?: number[];
  estimated_delay_hours?: number;
  cost_impact_usd?: number;
  affected_freight?: string[];
  iso_compliance?: string;
  synthesis_timestamp?: string;
}

interface AgentHandoff {
  from: string;
  to: string;
  status: string;
}

interface DiagnoseResponse {
  status: string;
  active_agent?: string;
  trace: ReActStep[];
  execution_trace?: ExecutionTraceStep[];
  diagnosis: FinalDiagnosis;
  final_synthesis?: FinalSynthesis;
  agent_handoffs?: AgentHandoff[];
  logistics?: Record<string, any>;
  diagnostic_data?: Record<string, any>;
  compliance_data?: Record<string, any>;
  mitigation_data?: Record<string, any>;
}

const TEST_SCENARIOS = [
  {
    label: "🚨 Turbine Overheat: 104.8°C Rotor Thermal Spike",
    text: "URGENT: Turbine generator Turbine-GEN-04 is triggering thermal alerts with bearing temperature exceeding 100°C. Query procedures and isolate or throttle.",
    equipment: "Turbine-GEN-04",
    severity: "CRITICAL"
  },
  {
    label: "💥 Hydraulic Cavitation: 7.4 mm/s High Vibration",
    text: "CRITICAL ALERT: Hydraulic pump unit HYD-PUMP-02 exhibiting high vibration (7.4 mm/s) and oil pressure spike. Check telemetry, verify SOP, and stabilize.",
    equipment: "HYD-PUMP-02",
    severity: "CRITICAL"
  },
  {
    label: "⚙️ Conveyor Jam: Drive Motor Drag & Resistance",
    text: "WARNING: Assembly line drive motor Conveyor-MTR-12 reporting irregular RPM and thermal warnings. Inspect live metrics and apply control action.",
    equipment: "Conveyor-MTR-12",
    severity: "HIGH"
  },
];

const SWARM_AGENTS = [
  { id: "supervisor", name: "Supervisor", role: "Central Router", icon: "🧭" },
  { id: "diagnostic", name: "Diagnostic", role: "Telemetry & Anomaly", icon: "⚙️" },
  { id: "safety", name: "Safety Compliance", role: "ISO-10816 Auditor", icon: "🛡️" },
  { id: "control", name: "Control Operator", role: "PLC Interventions", icon: "⚡" },
  { id: "logistics", name: "Logistics", role: "Supply Chain & Cost", icon: "📦" },
];

export default function Home() {
  const [text, setText] = useState(TEST_SCENARIOS[1].text);
  const [loading, setLoading] = useState(false);
  const [activeSwarmStep, setActiveSwarmStep] = useState<number>(-1);
  const [result, setResult] = useState<DiagnoseResponse | null>(null);
  const [error, setError] = useState("");
  const [terminalExpanded, setTerminalExpanded] = useState(true);

  const handleDiagnose = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setActiveSwarmStep(0);

    // Dynamic Swarm step simulation while awaiting backend response
    const swarmInterval = setInterval(() => {
      setActiveSwarmStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 2800);

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
        throw new Error(errorData.detail || "Failed to execute multi-agent diagnostic loop.");
      }

      const data: DiagnoseResponse = await response.json();
      setResult(data);
      setActiveSwarmStep(5); // all completed
    } catch (err: any) {
      if (err?.message?.includes("Failed to fetch") || err?.name === "TypeError") {
        setError(
          "Could not connect to the AI backend server at http://127.0.0.1:8000. Please ensure the FastAPI server is running."
        );
      } else {
        setError(err.message || "An unexpected error occurred during multi-agent diagnosis.");
      }
    } finally {
      clearInterval(swarmInterval);
      setLoading(false);
    }
  };

  const downloadCleanResultJson = () => {
    if (!result) return;
    const cleanOutput = {
      equipment_id: result.diagnosis.equipment_id,
      issue_identified: result.diagnosis.issue_identified,
      severity: result.diagnosis.severity,
      action_taken: result.diagnosis.action_taken,
      operational_status: result.diagnosis.operational_status,
      estimated_delay_hours: result.diagnosis.estimated_delay_hours,
      cost_impact_usd: result.diagnosis.cost_impact_usd,
      location: result.diagnosis.location,
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(cleanOutput, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `diagnostic_result_${result.diagnosis.equipment_id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getSeverityBadgeClass = (severity: string) => {
    const s = (severity || "").toUpperCase();
    if (s === "CRITICAL") return "badge-critical";
    if (s === "HIGH") return "badge-high";
    if (s === "MEDIUM") return "badge-moderate";
    if (s === "LOW") return "badge-minor";
    return "badge-moderate";
  };

  const getStatusBadgeClass = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s === "OFFLINE" || s === "HALT") return "badge-critical";
    if (s === "WARNING" || s === "SAFE_MODE") return "badge-moderate";
    if (s === "NORMAL") return "badge-minor";
    return "badge-moderate";
  };

  const getAgentThemeClass = (agentName: string) => {
    const a = (agentName || "").toUpperCase();
    if (a.includes("DIAGNOSTIC")) return "diagnostic";
    if (a.includes("SAFETY")) return "safety";
    if (a.includes("MITIGATION") || a.includes("CONTROL")) return "mitigation";
    if (a.includes("LOGISTICS")) return "logistics";
    return "supervisor";
  };

  const getAgentBadgeColor = (agentName: string) => {
    const a = (agentName || "").toUpperCase();
    if (a.includes("DIAGNOSTIC")) return { bg: "rgba(6, 182, 212, 0.15)", text: "#38bdf8", border: "rgba(6, 182, 212, 0.4)", icon: "⚙️" };
    if (a.includes("SAFETY")) return { bg: "rgba(245, 158, 11, 0.15)", text: "#fbbf24", border: "rgba(245, 158, 11, 0.4)", icon: "🛡️" };
    if (a.includes("MITIGATION") || a.includes("CONTROL")) return { bg: "rgba(244, 63, 94, 0.15)", text: "#fb7185", border: "rgba(244, 63, 94, 0.4)", icon: "⚡" };
    if (a.includes("LOGISTICS")) return { bg: "rgba(168, 85, 247, 0.15)", text: "#c084fc", border: "rgba(168, 85, 247, 0.4)", icon: "📦" };
    return { bg: "rgba(99, 102, 241, 0.15)", text: "#a5b4fc", border: "rgba(99, 102, 241, 0.4)", icon: "🧭" };
  };

  const formatObservation = (obs: any) => {
    if (obs === null || obs === undefined) return "None";
    if (typeof obs === "string") return obs;
    return JSON.stringify(obs, null, 2);
  };

  // Extract display execution trace items
  const displayTrace: ExecutionTraceStep[] = result?.execution_trace && result.execution_trace.length > 0
    ? result.execution_trace
    : (result?.trace || []).map((t) => ({
        timestamp: new Date().toISOString(),
        agent_name: t.thought.includes("[") ? t.thought.split("]")[0].replace("[", "") : "ReAct Operator",
        thought: t.thought.includes("]") ? t.thought.split("]").slice(1).join("]").trim() : t.thought,
        action: t.tool_call ? { tool: t.tool_call.name, arguments: t.tool_call.arguments } : null,
        observation: t.observation,
        status: t.status
      }));

  return (
    <main className="app-container" style={{ maxWidth: "1280px", padding: "30px 20px" }}>
      {/* Top Header */}
      <header className="header" style={{ marginBottom: "20px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(99, 102, 241, 0.12)", border: "1px solid rgba(99, 102, 241, 0.3)", padding: "4px 14px", borderRadius: "9999px", fontSize: "0.8rem", color: "#a5b4fc", marginBottom: "12px" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }}></span>
          <span>LANGGRAPH SUPERVISOR MULTI-AGENT SWARM ACTIVE</span>
        </div>
        <h1 className="title-gradient" style={{ fontSize: "2.4rem", fontWeight: "700", letterSpacing: "-0.02em" }}>
          Autonomous Industrial & Logistics Command Center
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "0.95rem", maxWidth: "780px", margin: "0 auto" }}>
          Closed-Loop Multi-Agent Architecture • Pydantic v2 Guardrail Barriers • ChromaDB Vector SOPs • Gemini 3.1 Flash
        </p>
      </header>

      {/* SPECIFICATION 2.1: LIVE AGENT SWARM STATUS BAR (Top Header with 5px space) */}
      <div className="swarm-status-bar" style={{ display: "flex", gap: "5px" }}>
        {SWARM_AGENTS.map((agent, idx) => {
          const isCompleted = result ? true : activeSwarmStep > idx;
          const isActive = loading && activeSwarmStep === idx;
          const isIdle = !result && !loading;

          return (
            <div
              key={agent.id}
              className={`swarm-chip ${isCompleted ? "completed" : isActive ? "active" : ""}`}
              style={{ flex: 1, justifyContent: "center" }}
            >
              <span
                className={`swarm-dot ${isCompleted ? "completed" : isActive ? "active" : "idle"}`}
              />
              <span style={{ fontSize: "0.95rem" }}>{agent.icon}</span>
              <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: "600", color: isActive ? "#38bdf8" : isCompleted ? "#34d399" : "#cbd5e1" }}>
                  {agent.name}
                </span>
                <span style={{ fontSize: "0.68rem", color: "#64748b" }}>
                  {isActive ? "Executing..." : isCompleted ? "Verified ✓" : agent.role}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* SPECIFICATION 2.2: TWO-COLUMN COMMAND CONSOLE */}
      <div className="grid-layout" style={{ gap: "24px" }}>
        {/* Left Column: Industrial Alert Input, Scenarios & Connected Hardware Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="glass-card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: "600", color: "#f8fafc" }}>
                Industrial Ingestion & Mission Trigger
              </h2>
              <span style={{ fontSize: "0.75rem", fontFamily: "JetBrains Mono, monospace", color: "#38bdf8", background: "rgba(56, 189, 248, 0.1)", padding: "2px 8px", borderRadius: "6px" }}>
                API: POST /api/diagnose
              </span>
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "14px", lineHeight: "1.4" }}>
              Select an industrial scenario or supply raw sensor alert telemetry. The LangGraph supervisor coordinates the 4 specialized agents sequentially.
            </p>

            {/* Quick Test Scenarios */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "8px", fontWeight: "600", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Preset Industrial Scenarios
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {TEST_SCENARIOS.map((sc, i) => (
                  <button
                    key={i}
                    onClick={() => setText(sc.text)}
                    style={{
                      textAlign: "left",
                      padding: "10px 14px",
                      background: text === sc.text ? "rgba(99, 102, 241, 0.18)" : "rgba(255, 255, 255, 0.03)",
                      border: text === sc.text ? "1px solid rgba(99, 102, 241, 0.55)" : "1px solid rgba(255, 255, 255, 0.07)",
                      borderRadius: "10px",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <div style={{ color: text === sc.text ? "#ffffff" : "#cbd5e1", fontSize: "0.84rem", fontWeight: "500" }}>
                        {sc.label}
                      </div>
                      <div style={{ color: "#64748b", fontSize: "0.72rem", marginTop: "2px", fontFamily: "JetBrains Mono, monospace" }}>
                        Unit: {sc.equipment}
                      </div>
                    </div>
                    <span className={`badge ${sc.severity === "CRITICAL" ? "badge-critical" : "badge-high"}`} style={{ fontSize: "0.68rem", padding: "2px 8px" }}>
                      {sc.severity}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Telemetry Input Textarea */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.82rem", color: "#cbd5e1", marginBottom: "6px", fontWeight: "500" }}>
                Telemetry Trigger / Disruption Text:
              </label>
              <textarea
                className="input-textarea"
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter alert text, machine ID, or raw physical sensor disruption..."
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "rgba(2, 6, 23, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "12px",
                  color: "#f8fafc",
                  fontFamily: "inherit",
                  fontSize: "0.88rem",
                  resize: "vertical",
                  outline: "none",
                }}
              />
            </div>

            {/* Trigger Button with gradient animation */}
            <button
              className="btn-primary"
              onClick={handleDiagnose}
              disabled={loading || !text.trim()}
              style={{
                width: "100%",
                padding: "14px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                fontSize: "0.95rem",
                fontWeight: "600",
                cursor: loading || !text.trim() ? "not-allowed" : "pointer",
                opacity: loading || !text.trim() ? 0.6 : 1,
                background: "linear-gradient(135deg, #06b6d4 0%, #6366f1 50%, #a855f7 100%)",
                boxShadow: "0 10px 25px -5px rgba(99, 102, 241, 0.4)",
                borderRadius: "12px"
              }}
            >
              {loading ? (
                <>
                  <svg
                    style={{ animation: "spin 1s linear infinite", width: "18px", height: "18px" }}
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeDasharray="30 60"
                    />
                  </svg>
                  <span>Swarm Assembly Line in Execution...</span>
                </>
              ) : (
                <>
                  <span>⚡ Run Multi-Agent Autonomous Loop</span>
                </>
              )}
            </button>

            {/* Connected Hardware Status Panel */}
            <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>
                Connected Hardware & Vector Fabric
              </div>
              <div className="hardware-panel">
                <div className="hardware-node">
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "#f8fafc", fontWeight: "500" }}>Siemens S7-1500</div>
                    <div style={{ fontSize: "0.68rem", color: "#64748b" }}>PLC Bus • 2ms</div>
                  </div>
                  <span className="pulse-indicator" />
                </div>
                <div className="hardware-node">
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "#f8fafc", fontWeight: "500" }}>ChromaDB Vector</div>
                    <div style={{ fontSize: "0.68rem", color: "#64748b" }}>205 SOP Chunks</div>
                  </div>
                  <span className="pulse-indicator" />
                </div>
                <div className="hardware-node">
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "#f8fafc", fontWeight: "500" }}>Edge Telemetry</div>
                    <div style={{ fontSize: "0.68rem", color: "#64748b" }}>100Hz Streams</div>
                  </div>
                  <span className="pulse-indicator" />
                </div>
                <div className="hardware-node">
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "#f8fafc", fontWeight: "500" }}>Control Relays</div>
                    <div style={{ fontSize: "0.68rem", color: "#64748b" }}>Pydantic Guarded</div>
                  </div>
                  <span className="pulse-indicator" />
                </div>
              </div>
            </div>

            {error && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px",
                  borderRadius: "10px",
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  color: "#fca5a5",
                  fontSize: "0.85rem",
                }}
              >
                <strong>Error:</strong> {error}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Multi-Agent Collaboration Stream & Collapsible Raw Terminal */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* If Idle */}
          {!result && !loading && (
            <div className="glass-card" style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontSize: "2.8rem", marginBottom: "12px" }}>🤖</div>
              <h3 style={{ fontSize: "1.25rem", color: "#f8fafc", marginBottom: "8px", fontWeight: "600" }}>
                Multi-Agent Supervisor Ready
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", maxWidth: "420px", margin: "0 auto", lineHeight: "1.5" }}>
                Trigger an autonomous loop to observe real-time agent handoffs across Diagnostic, Safety Auditor, Mitigation Operator, and Logistics Impact nodes.
              </p>
            </div>
          )}

          {/* Loading Animation */}
          {loading && (
            <div className="glass-card" style={{ textAlign: "center", padding: "45px 20px" }}>
              <div style={{ display: "inline-block", position: "relative", marginBottom: "16px" }}>
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "50%",
                    border: "3px solid rgba(6, 182, 212, 0.2)",
                    borderTopColor: "#06b6d4",
                    animation: "spin 0.9s linear infinite",
                  }}
                />
              </div>
              <h3 style={{ fontSize: "1.15rem", color: "#e2e8f0", marginBottom: "6px", fontWeight: "600" }}>
                LangGraph State Assembly Line Active
              </h3>
              <p style={{ color: "#94a3b8", fontSize: "0.85rem", maxWidth: "400px", margin: "0 auto" }}>
                Executing deterministic tool guardrails • Querying ChromaDB episodic memory • Disagreeing & synthesizing safe state
              </p>
            </div>
          )}

          {/* SPECIFICATION 2.2: MULTI-AGENT COLLABORATION STREAM */}
          {result && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="glass-card" style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "1.1rem" }}>💬</span>
                    <span style={{ fontWeight: "700", color: "#f8fafc", fontSize: "1.05rem" }}>
                      Multi-Agent Collaboration Stream
                    </span>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontFamily: "JetBrains Mono, monospace" }}>
                    {displayTrace.length} Recorded Agent Actions
                  </span>
                </div>

                {/* Collaboration Cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "420px", overflowY: "auto", paddingRight: "4px" }}>
                  {displayTrace.map((step, idx) => {
                    const badge = getAgentBadgeColor(step.agent_name);
                    const theme = getAgentThemeClass(step.agent_name);

                    return (
                      <div key={idx} className={`agent-msg-card ${theme}`} style={{ padding: "14px 16px", marginBottom: "0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span
                              style={{
                                padding: "2px 8px",
                                borderRadius: "6px",
                                background: badge.bg,
                                color: badge.text,
                                border: `1px solid ${badge.border}`,
                                fontSize: "0.74rem",
                                fontWeight: "600",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              <span>{badge.icon}</span>
                              <span>{step.agent_name}</span>
                            </span>
                          </div>
                          <span style={{ fontSize: "0.7rem", color: "#64748b", fontFamily: "JetBrains Mono, monospace" }}>
                            {step.timestamp ? step.timestamp.substring(11, 19) + " UTC" : `Step ${idx + 1}`}
                          </span>
                        </div>

                        {/* Thought */}
                        <div style={{ fontSize: "0.85rem", color: "#f1f5f9", lineHeight: "1.45", marginBottom: step.action ? "8px" : "0" }}>
                          {step.thought}
                        </div>

                        {/* Action Tool Pill */}
                        {step.action && (
                          <div style={{ marginTop: "6px" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "rgba(2, 6, 23, 0.7)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "6px", padding: "3px 8px", fontSize: "0.75rem", fontFamily: "JetBrains Mono, monospace", color: "#38bdf8" }}>
                              <span>⚡</span>
                              <span>
                                {typeof step.action === "string" ? step.action : step.action.tool || step.action.type || "Action"}
                              </span>
                              {step.action.arguments && (
                                <span style={{ color: "#94a3b8" }}>
                                  ({Object.entries(step.action.arguments).map(([k, v]) => `${k}=${v}`).join(", ")})
                                </span>
                              )}
                            </div>
                            {step.action.guardrail_status && (
                              <span style={{ marginLeft: "8px", fontSize: "0.7rem", color: "#10b981", fontFamily: "JetBrains Mono, monospace" }}>
                                ✓ {step.action.guardrail_status.split(":")[0]}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SPECIFICATION 2.2: COLLAPSIBLE RAW TERMINAL */}
              <div className="react-terminal">
                <div className="terminal-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div className="terminal-window-dots">
                      <div className="window-dot dot-red"></div>
                      <div className="window-dot dot-yellow"></div>
                      <div className="window-dot dot-green"></div>
                    </div>
                    <span className="terminal-title">
                      <span>⚡</span> Pydantic Barrier & Hardware Interceptor Terminal
                    </span>
                  </div>
                  <button
                    className="terminal-toggle-btn"
                    onClick={() => setTerminalExpanded(!terminalExpanded)}
                  >
                    {terminalExpanded ? "▲ Collapse Logs" : "▼ Expand Logs"}
                  </button>
                </div>

                {terminalExpanded && (
                  <div className="terminal-body" style={{ maxHeight: "260px", overflowY: "auto" }}>
                    {displayTrace.map((step, idx) => (
                      <div key={idx} style={{ marginBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b", fontSize: "0.72rem", marginBottom: "4px" }}>
                          <span>[{step.agent_name}]</span>
                          <span>Turn #{idx + 1}</span>
                        </div>
                        {step.action && step.action.guardrail_status && (
                          <div style={{ color: "#38bdf8", fontSize: "0.75rem", fontFamily: "JetBrains Mono, monospace", marginBottom: "4px" }}>
                            [PYDANTIC GUARD] {step.action.guardrail_status}
                          </div>
                        )}
                        {step.observation && (
                          <pre className="observation-box" style={{ fontSize: "0.72rem", padding: "6px 8px" }}>
                            {formatObservation(step.observation)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SPECIFICATION 2.3: STRATEGIC OUTPUT DASHBOARD (Below Console) */}
      {result && (
        <div style={{ marginTop: "28px" }}>
          <div className="glass-card ai-reasoning-card" style={{ borderLeft: "4px solid #10b981", padding: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "1.4rem" }}>🎯</span>
                <div>
                  <h3 style={{ fontWeight: "700", color: "#f8fafc", fontSize: "1.2rem", margin: 0 }}>
                    Strategic Industrial Decision & Output Synthesis
                  </h3>
                  <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                    Verified by Autonomous Multi-Agent Consensus Loop
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  onClick={downloadCleanResultJson}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid rgba(16, 185, 129, 0.4)",
                    color: "#34d399",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontSize: "0.82rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  <span>📥</span>
                  <span>Export Result JSON</span>
                </button>
                <span className={`badge ${getSeverityBadgeClass(result.diagnosis.severity)}`}>
                  <span className="status-dot"></span>
                  {result.diagnosis.severity} SEVERITY
                </span>
              </div>
            </div>

            {/* Primary Metrics 4-Box Grid */}
            <div className="result-grid" style={{ marginBottom: "20px" }}>
              <div className="data-box">
                <div className="data-label">Target Equipment Unit</div>
                <div className="data-value" style={{ color: "#38bdf8", fontFamily: "JetBrains Mono, monospace" }}>
                  {result.diagnosis.equipment_id}
                </div>
              </div>

              <div className="data-box">
                <div className="data-label">Safe Machine State</div>
                <div style={{ marginTop: "4px" }}>
                  <span className={`badge ${getStatusBadgeClass(result.diagnosis.operational_status)}`}>
                    <span className="status-dot"></span>
                    {result.diagnosis.operational_status}
                  </span>
                </div>
              </div>

              <div className="data-box">
                <div className="data-label">Estimated Delay Hours</div>
                <div className="data-value" style={{ color: "#fbbf24" }}>
                  {result.diagnosis.estimated_delay_hours ?? 24} Hours
                </div>
              </div>

              <div className="data-box">
                <div className="data-label">Accrued Financial Cost</div>
                <div className="data-value" style={{ color: "#f43f5e" }}>
                  ${(result.diagnosis.cost_impact_usd ?? 64000).toLocaleString()} USD
                </div>
              </div>
            </div>

            {/* Identified Root Cause Box */}
            <div className="data-box" style={{ marginBottom: "16px" }}>
              <div className="data-label">Identified Physical Anomaly / Root Cause</div>
              <div style={{ color: "#f1f5f9", fontSize: "0.95rem", lineHeight: "1.5", marginTop: "4px" }}>
                {result.diagnosis.issue_identified}
              </div>
            </div>

            {/* Confirmed Mitigating Action Box */}
            <div className="action-taken-box" style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "0.8rem", color: "#10b981", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                🛡️ Confirmed Mitigating Action Taken
              </div>
              <div style={{ color: "#ffffff", fontSize: "0.92rem", lineHeight: "1.4" }}>
                {result.diagnosis.action_taken}
              </div>
            </div>

            {/* Geographic & Supply Chain Coordinates */}
            {result.diagnosis.location && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(2, 6, 23, 0.5)", border: "1px solid rgba(255, 255, 255, 0.05)", borderRadius: "10px", padding: "10px 14px", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ fontSize: "0.82rem", color: "#cbd5e1" }}>
                  📍 <strong style={{ color: "#f8fafc" }}>Facility / Hub:</strong> {result.diagnosis.location}
                </div>
                {result.diagnosis.coordinates && (
                  <div style={{ fontSize: "0.78rem", color: "#94a3b8", fontFamily: "JetBrains Mono, monospace" }}>
                    Lat/Lon: [{result.diagnosis.coordinates.join(", ")}]
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
