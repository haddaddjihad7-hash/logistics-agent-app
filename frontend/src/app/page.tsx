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

interface FinalDiagnosis {
  equipment_id: string;
  issue_identified: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string;
  action_taken: string;
  operational_status: "NORMAL" | "WARNING" | "OFFLINE" | string;
}

interface DiagnoseResponse {
  status: string;
  trace: ReActStep[];
  diagnosis: FinalDiagnosis;
}

const TEST_SCENARIOS = [
  {
    label: "🚨 HYD-PUMP-02: Pressure Spike & Vibration",
    text: "CRITICAL ALERT: Hydraulic pump unit HYD-PUMP-02 exhibiting high vibration (7.4 mm/s) and oil pressure spike. Check telemetry, verify SOP, and stabilize.",
  },
  {
    label: "⚡ Turbine-GEN-04: Bearing Thermal Overload",
    text: "URGENT: Turbine generator Turbine-GEN-04 is triggering thermal alerts with bearing temperature exceeding 100°C. Query procedures and isolate or throttle.",
  },
  {
    label: "⚙️ Conveyor-MTR-12: Motor Overload & Drag",
    text: "WARNING: Assembly line drive motor Conveyor-MTR-12 reporting irregular RPM and thermal warnings. Inspect live metrics and apply control action.",
  },
];

export default function Home() {
  const [text, setText] = useState(TEST_SCENARIOS[0].text);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnoseResponse | null>(null);
  const [error, setError] = useState("");
  const [terminalExpanded, setTerminalExpanded] = useState(true);

  const handleDiagnose = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError("");

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
        throw new Error(errorData.detail || "Failed to execute diagnostic loop.");
      }

      const data: DiagnoseResponse = await response.json();
      setResult(data);
    } catch (err: any) {
      if (err?.message?.includes("Failed to fetch") || err?.name === "TypeError") {
        setError(
          "Could not connect to the AI backend server at http://127.0.0.1:8000. Please ensure the FastAPI server is running."
        );
      } else {
        setError(err.message || "An unexpected error occurred during diagnosis.");
      }
    } finally {
      setLoading(false);
    }
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

  const formatObservation = (obs: any) => {
    if (obs === null || obs === undefined) return "None";
    if (typeof obs === "string") return obs;
    return JSON.stringify(obs, null, 2);
  };

  return (
    <main className="app-container">
      {/* Dashboard Top Header */}
      <header className="header">
        <h1 className="title-gradient">Autonomous Industrial Diagnostic AI Agent</h1>
        <p>
          Closed-Loop ReAct Orchestrator • ChromaDB Episodic Memory • Deterministic Operator Guardrails
        </p>
      </header>

      {/* Main 2-Column Grid Layout */}
      <div className="grid-layout">
        {/* Left Column: Industrial Alert Input & Scenarios */}
        <div className="flex flex-col gap-6">
          <div className="glass-card">
            <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "12px" }}>
              Industrial Alert & Equipment Disruption
            </h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "16px" }}>
              Inject a machine failure or anomaly alert. The agent will formulate thoughts, fetch live sensor telemetry, consult vector manuals, and trigger control interventions.
            </p>

            {/* Quick Test Scenarios */}
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "8px", fontWeight: 500 }}>
                QUICK TEST SCENARIOS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {TEST_SCENARIOS.map((sc, i) => (
                  <button
                    key={i}
                    onClick={() => setText(sc.text)}
                    style={{
                      textAlign: "left",
                      padding: "8px 12px",
                      background: text === sc.text ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.04)",
                      border: text === sc.text ? "1px solid rgba(99, 102, 241, 0.5)" : "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "8px",
                      color: text === sc.text ? "#ffffff" : "#cbd5e1",
                      fontSize: "0.82rem",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea Input */}
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "#cbd5e1", marginBottom: "6px" }}>
                Alert Description / Telemetry Trigger:
              </label>
              <textarea
                className="input-textarea"
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter equipment alert, e.g., PUMP-402 bearing failure with high vibration..."
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  color: "#f8fafc",
                  fontFamily: "inherit",
                  fontSize: "0.9rem",
                  resize: "vertical",
                  outline: "none",
                }}
              />
            </div>

            {/* Action Button */}
            <button
              className="btn-primary"
              onClick={handleDiagnose}
              disabled={loading || !text.trim()}
              style={{
                width: "100%",
                padding: "12px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                fontSize: "0.95rem",
                fontWeight: "600",
                cursor: loading || !text.trim() ? "not-allowed" : "pointer",
                opacity: loading || !text.trim() ? 0.6 : 1,
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
                  <span>ReAct Agent Reasoning & Executing Tools...</span>
                </>
              ) : (
                <>
                  <span>⚡ Execute Autonomous ReAct Loop</span>
                </>
              )}
            </button>

            {/* Tools Availability Badges */}
            <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Connected ReAct Executable Tools
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                <span className="tag" style={{ color: "#38bdf8", borderColor: "rgba(56,189,248,0.3)" }}>
                  ⚙️ get_sensor_data()
                </span>
                <span className="tag" style={{ color: "#c084fc", borderColor: "rgba(192,132,252,0.3)" }}>
                  📚 query_technical_docs()
                </span>
                <span className="tag" style={{ color: "#fb7185", borderColor: "rgba(251,113,133,0.3)" }}>
                  🛡️ execute_control_action()
                </span>
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

        {/* Right Column: ReAct Trace Terminal & Final Diagnostic Card */}
        <div className="flex flex-col gap-6">
          {/* If no result yet and not loading */}
          {!result && !loading && (
            <div className="glass-card" style={{ textAlign: "center", padding: "50px 20px" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🤖</div>
              <h3 style={{ fontSize: "1.2rem", color: "#f8fafc", marginBottom: "8px" }}>
                ReAct Orchestrator Idle
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", maxWidth: "380px", margin: "0 auto" }}>
                Launch a diagnostic query to watch the autonomous agent step through its reasoning cycle, query ChromaDB memory, poll telemetry, and execute corrective commands.
              </p>
            </div>
          )}

          {/* Loading Animation Card */}
          {loading && (
            <div className="glass-card" style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ display: "inline-block", position: "relative", marginBottom: "16px" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    border: "3px solid rgba(99, 102, 241, 0.2)",
                    borderTopColor: "#6366f1",
                    animation: "spin 1s linear infinite",
                  }}
                />
              </div>
              <h3 style={{ fontSize: "1.1rem", color: "#e2e8f0", marginBottom: "6px" }}>
                Autonomous ReAct Execution in Progress
              </h3>
              <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                Generating thoughts • Querying live sensors • Searching vector manuals • Dispatching actions
              </p>
            </div>
          )}

          {/* If Result Received */}
          {result && (
            <div className="flex flex-col gap-6">
              {/* 1. Final Diagnostic Card */}
              <div className="glass-card ai-reasoning-card" style={{ borderLeft: "4px solid #10b981" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "1.2rem" }}>✅</span>
                    <span style={{ fontWeight: "700", color: "#f8fafc", fontSize: "1.1rem" }}>
                      Industrial Diagnostic Synthesis
                    </span>
                  </div>
                  <span className={`badge ${getSeverityBadgeClass(result.diagnosis.severity)}`}>
                    <span className="status-dot"></span>
                    {result.diagnosis.severity} SEVERITY
                  </span>
                </div>

                {/* Primary Metrics 4-Box Grid */}
                <div className="result-grid" style={{ marginBottom: "16px" }}>
                  <div className="data-box">
                    <div className="data-label">Equipment Unit</div>
                    <div className="data-value" style={{ color: "#38bdf8", fontFamily: "JetBrains Mono, monospace" }}>
                      {result.diagnosis.equipment_id}
                    </div>
                  </div>

                  <div className="data-box">
                    <div className="data-label">Operational Status</div>
                    <div style={{ marginTop: "4px" }}>
                      <span className={`badge ${getStatusBadgeClass(result.diagnosis.operational_status)}`}>
                        <span className="status-dot"></span>
                        {result.diagnosis.operational_status}
                      </span>
                    </div>
                  </div>

                  <div className="data-box">
                    <div className="data-label">ReAct Cycles</div>
                    <div className="data-value">{result.trace.length} Turns</div>
                  </div>

                  <div className="data-box">
                    <div className="data-label">Status</div>
                    <div className="data-value" style={{ color: "#34d399" }}>Resolved</div>
                  </div>
                </div>

                {/* Identified Root Cause */}
                <div className="data-box" style={{ marginBottom: "14px" }}>
                  <div className="data-label">Diagnosed Anomaly / Root Cause</div>
                  <div style={{ color: "#f1f5f9", fontSize: "0.95rem", lineHeight: "1.5", marginTop: "4px" }}>
                    {result.diagnosis.issue_identified}
                  </div>
                </div>

                {/* Confirmed Control Action */}
                <div className="action-taken-box">
                  <div style={{ fontSize: "0.8rem", color: "#10b981", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                    🛡️ Confirmed Control Action Taken
                  </div>
                  <div style={{ color: "#ffffff", fontSize: "0.92rem", lineHeight: "1.4" }}>
                    {result.diagnosis.action_taken}
                  </div>
                </div>
              </div>

              {/* 2. ReAct Trace Terminal */}
              <div className="react-terminal">
                <div className="terminal-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div className="terminal-window-dots">
                      <div className="window-dot dot-red"></div>
                      <div className="window-dot dot-yellow"></div>
                      <div className="window-dot dot-green"></div>
                    </div>
                    <span className="terminal-title">
                      <span>⚡</span> ReAct Reasoning & Action Terminal ({result.trace.length} Steps)
                    </span>
                  </div>
                  <button
                    className="terminal-toggle-btn"
                    onClick={() => setTerminalExpanded(!terminalExpanded)}
                  >
                    {terminalExpanded ? "▲ Collapse Trace" : "▼ Expand Trace"}
                  </button>
                </div>

                {terminalExpanded && (
                  <div className="terminal-body">
                    {result.trace.map((step, idx) => (
                      <div key={idx} className="react-step-card">
                        <div className="react-step-header">
                          <span className="turn-pill">Turn {step.turn}</span>
                          <span style={{ color: "#64748b", fontSize: "0.75rem" }}>
                            {step.status === "completed" ? "Final Resolution" : "Action Loop"}
                          </span>
                        </div>

                        {/* Thought */}
                        <div className="thought-box">
                          <span style={{ color: "#38bdf8", fontWeight: "600", marginRight: "6px" }}>
                            🧠 Thought:
                          </span>
                          {step.thought}
                        </div>

                        {/* Tool Call (if present) */}
                        {step.tool_call && (
                          <div style={{ marginTop: "8px", marginBottom: "8px" }}>
                            <div
                              className={`action-pill ${
                                step.tool_call.name === "execute_control_action"
                                  ? "execute"
                                  : step.tool_call.name === "query_technical_docs"
                                  ? "docs"
                                  : ""
                              }`}
                            >
                              <span>⚙️ Action:</span>
                              <strong>{step.tool_call.name}</strong>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginLeft: "4px" }}>
                              {Object.entries(step.tool_call.arguments).map(([key, val], aIdx) => (
                                <span key={aIdx} className="tag" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>
                                  {key}: {typeof val === "object" ? JSON.stringify(val) : String(val)}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Observation (if present) */}
                        {step.observation && (
                          <div style={{ marginTop: "8px" }}>
                            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "4px" }}>
                              👁️ Observation:
                            </div>
                            <pre className="observation-box">
                              {formatObservation(step.observation)}
                            </pre>
                          </div>
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
    </main>
  );
}
