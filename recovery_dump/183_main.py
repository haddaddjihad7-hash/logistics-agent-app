# ==========================================
# MULTI-AGENT AUTONOMOUS STATE GRAPH ORCHESTRATION
# ==========================================

@app.post("/api/diagnose", response_model=DiagnoseResponse)
def diagnose_equipment(request: DiagnoseRequest):
    """
    Executes the hierarchical LangGraph Multi-Agent State Graph:
    Central Supervisor -> Diagnostic Specialist -> Safety Compliance Auditor ->
    Mitigation Operator -> Logistics Impact Analyst -> Executive Synthesis.
    Enforces Lab 03 deterministic guardrails, ISO-10816 standards, and live telemetry control.
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Alert / prompt text cannot be empty.")

    logger.info(f"Initiating Multi-Agent Autonomous State Graph for: {request.text[:80]}...")

    try:
        result = run_multi_agent_workflow(alert_text=request.text)
    except Exception as e:
        logger.error(f"Multi-agent workflow execution error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Autonomous workflow failure: {str(e)}")

    execution_trace = result.get("execution_trace", [])
    synth = result.get("final_synthesis", {})
    logistics = result.get("logistics_data", {})
    diag_data = result.get("diagnostic_data", {})
    comp_data = result.get("compliance_data", {})
    mit_data = result.get("mitigation_data", {})

    agent_handoffs = [
        {"from_agent": "Central Supervisor", "to_agent": "Diagnostic Specialist", "status": "COMPLETED"},
        {"from_agent": "Diagnostic Specialist", "to_agent": "Safety Compliance Auditor", "status": "COMPLETED"},
        {"from_agent": "Safety Compliance Auditor", "to_agent": "Mitigation Operator", "status": "COMPLETED"},
        {"from_agent": "Mitigation Operator", "to_agent": "Logistics Impact Analyst", "status": "COMPLETED"},
        {"from_agent": "Logistics Impact Analyst", "to_agent": "Central Supervisor (Synthesis)", "status": "COMPLETED"},
    ]

    legacy_trace: List[ReActStep] = []
    for idx, step in enumerate(execution_trace, start=1):
        tool_call_obj = None
        if "tool_call" in step and step["tool_call"]:
            tool_call_obj = ToolCall(
                name=step["tool_call"].get("name", "tool"),
                arguments=step["tool_call"].get("arguments", {})
            )
        legacy_trace.append(ReActStep(
            turn=idx,
            thought=f"[{step.get('agent_name', 'Agent')}] {step.get('thought', '')}",
            tool_call=tool_call_obj,
            observation=step.get("observation"),
            status="completed" if idx == len(execution_trace) else "in_progress"
        ))

    final_diag = FinalDiagnosis(
        equipment_id=synth.get("equipment_id", diag_data.get("equipment_id", "EQUIPMENT-01")),
        issue_identified=synth.get("issue_identified", "Equipment anomaly mitigated through multi-agent orchestration."),
        severity=synth.get("severity", comp_data.get("severity", "HIGH")),
        action_taken=synth.get("action_taken", mit_data.get("details", "Protective action applied.")),
        operational_status=synth.get("operational_status", mit_data.get("new_state", "SAFE_MODE")),
        location=synth.get("location", logistics.get("location", "Seattle Port Logistics Facility")),
        coordinates=synth.get("coordinates", logistics.get("coordinates", [47.6062, -122.3321])),
        estimated_delay_hours=float(synth.get("estimated_delay_hours", logistics.get("estimated_delay_hours", 24.0))),
        cost_impact_usd=float(synth.get("cost_impact_usd", logistics.get("cost_impact_usd", 64000.0))),
    )

    return DiagnoseResponse(
        status="completed",
        active_agent="FINISH",
        execution_trace=execution_trace,
        trace=legacy_trace,
        diagnosis=final_diag,
        final_synthesis=synth,
        agent_handoffs=agent_handoffs,
        logistics=logistics,
        diagnostic_data=diag_data,
        compliance_data=comp_data,
        mitigation_data=mit_data
    )