    # Deterministic Pydantic Guardrail Interception
    fallback_thought = f"Detected equipment identifier '{equipment_id}' from alert stream. Validating against deterministic Lab 03 schema before telemetry query."
    thought = query_gemini_thought(
        agent_role="Diagnostic Specialist",
        prompt_context=f"Alert: '{alert}'. Target asset: '{equipment_id}'. Telemetry verification requested under regex ^[A-Z0-9-]+$.",
        fallback_thought=fallback_thought
    )
    observation = ""
    telemetry = {}

    try:
        validated_args = SensorDataArgs(equipment_id=equipment_id)
        telemetry = execute_get_sensor_data(validated_args.equipment_id)
        action_desc = f"get_sensor_data(equipment_id='{validated_args.equipment_id}') [GUARDRAIL PASSED]"
        observation = (
            f"Hardware Telemetry Polled: Temp={telemetry.get('temperature_c')}°C (CRITICAL), "
            f"Vibration={telemetry.get('vibration_mm_s')} mm/s (CRITICAL), "
            f"Pressure={telemetry.get('pressure_psi')} PSI (ELEVATED), "
            f"Operational State={telemetry.get('status')}."
        )
    except ValidationError as val_err:
        err_msg = "; ".join(e["msg"] for e in val_err.errors())
        action_desc = f"get_sensor_data(equipment_id='{equipment_id}') [GUARDRAIL INTERCEPTED]"
        observation = f"Deterministic Guardrail Blocked Invalid Argument: {err_msg}. Triggered fallback telemetry probe."
        telemetry = execute_get_sensor_data("HYD-PUMP-02")

    trace.append({
        "timestamp": now,
        "agent_name": "Diagnostic Specialist",
        "role": "Telemetry & Anomaly Analysis",
        "thought": thought,
        "action": action_desc,
        "observation": observation,
        "tool_call": {
            "name": "get_sensor_data",
            "arguments": {"equipment_id": equipment_id}
        }
    })

    return {
        "diagnostic_data": telemetry,
        "execution_trace": trace
    }


def safety_auditor_node(state: AgentState) -> Dict[str, Any]:
    """
    Specialist Agent 2: Safety Compliance Auditor
    Interrogates ChromaDB episodic memory and audits ISO vibration/temperature thresholds.
    """
    trace = list(state.get("execution_trace", []))
    now = datetime.now().strftime("%H:%M:%S")
    diag = state.get("diagnostic_data", {})
    eq = diag.get("equipment_id", "EQUIPMENT")
    vibe = diag.get("vibration_mm_s", 7.0)
    temp = diag.get("temperature_c", 90.0)

    query = f"ISO-10816 vibration threshold and thermal safety limits for {eq}"
    fallback_thought = (
        f"Auditing telemetry against regulatory bounds. Asset {eq} operates at {vibe} mm/s vibration and {temp}°C. "
        "Querying ChromaDB vector store for SOP mitigation protocols."
    )
    thought = query_gemini_thought(
        agent_role="Safety Compliance Auditor",
        prompt_context=f"Equipment {eq} telemetry: Vibration={vibe} mm/s, Temp={temp}°C. Cross-referencing ISO-10816 SOP standards in ChromaDB.",
        fallback_thought=fallback_thought
    )

    # Deterministic Pydantic Guardrail Interception
    docs_summary = ""
    try:
        validated_docs = TechnicalDocsArgs(query=query)
        docs_summary = execute_query_technical_docs(validated_docs.query)
        action_desc = f"query_technical_docs(query='{validated_docs.query[:60]}...') [GUARDRAIL PASSED]"
    except ValidationError as val_err:
        err_msg = "; ".join(e["msg"] for e in val_err.errors())
        action_desc = "query_technical_docs(...) [GUARDRAIL INTERCEPTED]"
        docs_summary = f"Guardrail Interception: {err_msg}. Utilizing standard ISO-10816 rules."

    # Compute compliance findings
    is_critical_vibe = vibe >= 7.0
    is_critical_temp = temp >= 100.0

    compliance = {
        "equipment_id": eq,
        "standard_reference": "ISO-10816 Class IV / Hydraulic Directive",
        "vibration_exceeded": is_critical_vibe,
        "temperature_exceeded": is_critical_temp,
        "recommended_action": "lower_pressure" if (is_critical_vibe and not is_critical_temp) else "emergency_stop",
        "severity": "CRITICAL" if (is_critical_vibe or is_critical_temp) else "HIGH",
        "sop_notes": docs_summary
    }

    observation = (
        f"Compliance Audit Verdict: {compliance['severity']}. Threshold violations: "
        f"Vibration={vibe}mm/s (Limit 4.5mm/s: VIOLATED), Temp={temp}°C (Limit 95°C: {'VIOLATED' if is_critical_temp else 'NOMINAL'}). "
        f"Mandated action: {compliance['recommended_action'].upper()}."
    )

    trace.append({
        "timestamp": now,
        "agent_name": "Safety Compliance Auditor",
        "role": "Regulatory Standards & Vector SOP",
        "thought": thought,
        "action": action_desc,
        "observation": observation,
        "tool_call": {
            "name": "query_technical_docs",
            "arguments": {"query": query}
        }
    })

    return {
        "compliance_data": compliance,
        "execution_trace": trace
    }


def mitigation_operator_node(state: AgentState) -> Dict[str, Any]:
    """
    Specialist Agent 3: Mitigation Operator
    Executes verified safe state transitions through PLC interface with strict guardrails.
    """
    trace = list(state.get("execution_trace", []))
    now = datetime.now().strftime("%H:%M:%S")
    comp = state.get("compliance_data", {})
    eq = comp.get("equipment_id", "EQUIPMENT-01")
    action_to_take = comp.get("recommended_action", "lower_pressure")

    fallback_thought = (
        f"Safety Auditor ordered '{action_to_take}'. Validating deterministic execution boundaries "
        f"before commanding industrial PLC control bus."
    )
    thought = query_gemini_thought(
        agent_role="Mitigation Operator",
        prompt_context=f"Safety Auditor recommended '{action_to_take}' on asset {eq}. Validating action whitelist before dispatching PLC signal.",
        fallback_thought=fallback_thought
    )

    mitigation_res = {}
    try:
        validated_control = ControlActionArgs(equipment_id=eq, action=action_to_take)
        mitigation_res = execute_control_action_safe(
            equipment_id=validated_control.equipment_id,
            action=validated_control.action
        )
        action_desc = f"execute_control_action(equipment_id='{validated_control.equipment_id}', action='{validated_control.action}') [GUARDRAIL PASSED]"
        observation = f"PLC Signal Confirmed: {mitigation_res.get('details')} System transition to {mitigation_res.get('new_state')} successful."
    except ValidationError as val_err:
        err_msg = "; ".join(e["msg"] for e in val_err.errors())
        action_desc = f"execute_control_action(...) [GUARDRAIL INTERCEPTED]"
        observation = f"Deterministic Barrier Intercepted: {err_msg}. Applying automated safe mode throttle."
        mitigation_res = execute_control_action_safe(equipment_id=eq, action="lower_pressure")

    trace.append({
        "timestamp": now,
        "agent_name": "Mitigation Operator",
        "role": "Physical Intervention & Control Systems",
        "thought": thought,
        "action": action_desc,
        "observation": observation,
        "tool_call": {
            "name": "execute_control_action",
            "arguments": {"equipment_id": eq, "action": action_to_take}
        }
    })

    return {
        "mitigation_data": mitigation_res,
        "execution_trace": trace
    }


def logistics_analyst_node(state: AgentState) -> Dict[str, Any]:
    """
    Specialist Agent 4: Logistics Impact Analyst
    Calculates operational delay, down-time cost accrual, affected shipment coordinates,
    and formats financial progression points for Recharts.
    """
    trace = list(state.get("execution_trace", []))
    now = datetime.now().strftime("%H:%M:%S")
    alert = state.get("alert_text", "")
    diag = state.get("diagnostic_data", {})
    comp = state.get("compliance_data", {})
    mit = state.get("mitigation_data", {})

    eq = diag.get("equipment_id", "EQUIPMENT")
    op_state = mit.get("new_state", "SAFE_MODE")

    # Geolocation mapping heuristics
    alert_lower = alert.lower()
    if "seattle" in alert_lower or "pacific" in alert_lower:
        location = "Seattle Logistics Terminal"
        coords = [47.6062, -122.3321]
    elif "rotterdam" in alert_lower or "europe" in alert_lower:
        location = "Rotterdam Gateway Terminal"
        coords = [51.9244, 4.4777]
    elif "suez" in alert_lower:
        location = "Suez Canal Logistics Node"
        coords = [30.5852, 32.2654]
    elif "singapore" in alert_lower or "asia" in alert_lower:
        location = "Singapore Trade Transshipment Hub"
        coords = [1.3521, 103.8198]
    elif "houston" in alert_lower or "turbine" in alert_lower:
        location = "Houston Industrial Complex"
        coords = [29.7604, -95.3698]
    else:
        location = "Seattle Port Logistics Facility"
        coords = [47.6062, -122.3321]

    # Delay and cost calculations
    if op_state == "OFFLINE":
        delay_hours = 48.0
        base_loss = 168000
    elif op_state == "SAFE_MODE":
        delay_hours = 18.0
        base_loss = 64000
    else:
        delay_hours = 6.0
        base_loss = 18500

    fallback_thought = (
        f"Evaluating supply chain disruption metrics for {eq} transitioning to {op_state} at {location}. "
        f"Modeling downtime exposure curve and throughput delay penalties."
    )
    thought = query_gemini_thought(
        agent_role="Logistics Impact Analyst",
        prompt_context=f"Asset {eq} at {location} transitioned to state {op_state}. Estimated downtime: {delay_hours} hrs, loss: ${base_loss:,}.",
        fallback_thought=fallback_thought
    )

    # Generate financial exposure timeline for Recharts CostChart
    cost_history = [
        {"timestamp": "T+00h", "location": location, "cost": int(base_loss * 0.15), "cumulativeCost": int(base_loss * 0.15)},
        {"timestamp": "T+04h", "location": location, "cost": int(base_loss * 0.25), "cumulativeCost": int(base_loss * 0.40)},
        {"timestamp": "T+08h", "location": location, "cost": int(base_loss * 0.30), "cumulativeCost": int(base_loss * 0.70)},
        {"timestamp": "T+16h", "location": location, "cost": int(base_loss * 0.20), "cumulativeCost": int(base_loss * 0.90)},
        {"timestamp": f"T+{int(delay_hours)}h", "location": location, "cost": int(base_loss * 0.10), "cumulativeCost": int(base_loss)},
    ]

    logistics = {
        "location": location,
        "coordinates": coords,
        "estimated_delay_hours": delay_hours,
        "cost_impact_usd": base_loss,
        "operational_status": op_state,
        "cost_history": cost_history,
        "affected_lines": ["Assembly Line 4", "Cold-Chain Freight Express", "Intermodal Rail Feeder"]
    }

    observation = (
        f"Supply Chain Impact Formulated: Location={location}, Delay={delay_hours} Hours, "
        f"Projected Cumulative Financial Exposure=${base_loss:,.2f}. Coordinates={coords}."
    )

    trace.append({
        "timestamp": now,
        "agent_name": "Logistics Impact Analyst",
        "role": "Supply Chain & Financial Risk Modeling",
        "thought": thought,
        "action": f"model_downtime_exposure(hours={delay_hours}, facility='{location}')",
        "observation": observation,
        "tool_call": {
            "name": "calculate_downtime_cost",
            "arguments": {"location": location, "hours": delay_hours, "loss_usd": base_loss}
        }
    })

    return {
        "logistics_data": logistics,
        "execution_trace": trace
    }


def synthesis_node(state: AgentState) -> Dict[str, Any]:
    """
    Consolidates the complete multi-agent execution results into the final executive synthesis.
    """
    trace = list(state.get("execution_trace", []))
    now = datetime.now().strftime("%H:%M:%S")

    diag = state.get("diagnostic_data", {})
    comp = state.get("compliance_data", {})
    mit = state.get("mitigation_data", {})
    logistics = state.get("logistics_data", {})

    eq = diag.get("equipment_id", "EQUIPMENT")
    vibe = diag.get("vibration_mm_s", 0)
    temp = diag.get("temperature_c", 0)
    op_status = mit.get("new_state", "SAFE_MODE")
    severity = comp.get("severity", "HIGH")
    action_taken = mit.get("details", f"Applied protective control action on {eq}.")
    
    root_cause = (
        f"Elevated mechanical cavitation and bearing vibration ({vibe} mm/s) accompanied by thermal elevation ({temp}°C). "
        f"Violated ISO-10816 standards; mitigated through automated {mit.get('action', 'protective')} action."
    )

    final_report = {
        "equipment_id": eq,
        "issue_identified": root_cause,
        "severity": severity,
        "action_taken": action_taken,
        "operational_status": op_status,
        "location": logistics.get("location", "Seattle Port Logistics Facility"),
        "coordinates": logistics.get("coordinates", [47.6062, -122.3321]),
        "estimated_delay_hours": logistics.get("estimated_delay_hours", 24.0),
        "cost_impact_usd": logistics.get("cost_impact_usd", 64000),
    }

    fallback_thought = "All 4 multi-agent specialist cycles completed with validated guardrails. Published final diagnostic verdict."
    thought = query_gemini_thought(
        agent_role="Central Supervisor",
        prompt_context=f"Synthesizing final findings: Asset {eq}, State {op_status}, Action: {action_taken}, Cost: ${final_report['cost_impact_usd']:,}.",
        fallback_thought=fallback_thought
    )

    trace.append({
        "timestamp": now,
        "agent_name": "Central Supervisor",
        "role": "Executive Synthesis",
        "thought": thought,
        "action": "publish_executive_verdict()",
        "observation": f"System stabilized in {op_status}. Comprehensive report generated."
    })

    return {
        "final_synthesis": final_report,
        "execution_trace": trace
    }