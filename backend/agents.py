import os
import re
import json
import logging
from datetime import datetime, timezone
from typing import TypedDict, Annotated, List, Dict, Any, Optional, Literal
from pathlib import Path
from dotenv import load_dotenv

# Ensure environment variables (.env) and offline flags are set immediately
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"
from pydantic import BaseModel, Field, field_validator, ValidationError
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from google import genai
from google.genai import types

# Optional ChromaDB integration with graceful fallback
try:
    from backend.episodic_memory import (
        get_episodic_vector_store,
        retrieve_episodic_context
    )
except ImportError:
    try:
        from episodic_memory import (
            get_episodic_vector_store,
            retrieve_episodic_context
        )
    except ImportError:
        def get_episodic_vector_store(*args, **kwargs):
            return None
        def retrieve_episodic_context(*args, **kwargs):
            return []

logger = logging.getLogger(__name__)

# Candidate models for Gemini API (fastest and most reliable first)
DEFAULT_MODELS = [
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-3-flash-preview",
    "gemini-3.6-flash"
]
custom_model = os.environ.get("GEMINI_MODEL")
if custom_model:
    CANDIDATE_MODELS = [custom_model] + [m for m in DEFAULT_MODELS if m != custom_model]
else:
    CANDIDATE_MODELS = DEFAULT_MODELS

def get_gemini_client() -> Optional[genai.Client]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY is not set. Agents will utilize deterministic heuristic reasoning.")
        return None
    try:
        return genai.Client(api_key=api_key)
    except Exception as e:
        logger.warning(f"Failed to initialize Gemini Client: {e}")
        return None

def invoke_gemini_brief(prompt: str, system_instruction: str) -> Optional[str]:
    """Invokes Gemini with quick timeout and candidate model fallbacks."""
    client = get_gemini_client()
    if not client:
        return None

    for model_name in CANDIDATE_MODELS:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.1,
                    max_output_tokens=400
                )
            )
            if response and response.text:
                return response.text.strip()
        except Exception as e:
            logger.debug(f"Gemini call with {model_name} failed: {e}")
            continue
    return None

# ==============================================================================
# SPECIFICATION 1.2: DETERMINISTIC TOOL GUARDRAILS (Lab 03 Standard)
# ==============================================================================

class SensorDataArgs(BaseModel):
    """
    Deterministic input schema for get_sensor_data tool.
    Strict alphanumeric regex whitelisting with hyphens only; rejects spaces and injection.
    """
    equipment_id: str = Field(..., description="Alphanumeric equipment identifier with hyphens only")

    @field_validator("equipment_id")
    @classmethod
    def validate_equipment_id(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError("equipment_id must be a string.")
        v_clean = v.strip().upper()
        if not v_clean or len(v_clean) > 32:
            raise ValueError(f"equipment_id length must be between 1 and 32 characters (got {len(v_clean)}).")
        if not re.match(r'^[A-Z0-9-]+$', v_clean):
            raise ValueError(
                f"Security Guardrail: equipment_id '{v}' contains invalid characters. "
                "Must match regex r'^[A-Z0-9-]+$' (max length 32) with no spaces or injection characters."
            )
        return v_clean


class TechnicalDocsArgs(BaseModel):
    """
    Deterministic input schema for query_technical_docs tool.
    Enforces string length, strips whitespace, and blocks null bytes & SQL injections.
    """
    query: str = Field(..., min_length=3, max_length=200, description="Technical manual search query string")

    @field_validator("query")
    @classmethod
    def validate_query(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError("query must be a string.")
        if "\x00" in v or "\\0" in v or "%00" in v:
            raise ValueError("Security Guardrail: Null bytes detected in query parameter.")
        
        cleaned = re.sub(r'\s+', ' ', v).strip()
        if len(cleaned) < 3:
            raise ValueError(f"query must be at least 3 characters long (got {len(cleaned)}).")
        if len(cleaned) > 200:
            raise ValueError(f"query must not exceed 200 characters (got {len(cleaned)}).")
        
        # Block raw SQL keywords / injection patterns
        upper_query = cleaned.upper()
        sql_keywords = [
            "DROP ", "DELETE ", "TRUNCATE ", "UNION SELECT", "INSERT INTO",
            "UPDATE ", "--", ";", "/*", "*/", "EXEC ", "EXECUTE "
        ]
        for kw in sql_keywords:
            if kw in upper_query:
                raise ValueError(f"Security Guardrail: Potential SQL injection keyword '{kw.strip()}' blocked.")
        return cleaned


class ControlActionArgs(BaseModel):
    """
    Deterministic input schema for execute_control_action tool.
    Enforces regex whitelisting, plus strict Literal enum actions.
    """
    equipment_id: str = Field(..., description="Alphanumeric equipment identifier with hyphens only")
    action: Literal["emergency_stop", "lower_pressure", "reboot"] = Field(
        ...,
        description="Whitelisted deterministic control action"
    )

    @field_validator("equipment_id")
    @classmethod
    def validate_equipment_id(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError("equipment_id must be a string.")
        v_clean = v.strip().upper()
        if not v_clean or len(v_clean) > 32:
            raise ValueError(f"equipment_id length must be between 1 and 32 characters (got {len(v_clean)}).")
        if not re.match(r'^[A-Z0-9-]+$', v_clean):
            raise ValueError(
                f"Security Guardrail: equipment_id '{v}' contains invalid characters. "
                "Must match regex r'^[A-Z0-9-]+$' (max length 32) with no spaces or injection characters."
            )
        return v_clean

# ==============================================================================
# INDUSTRIAL EXECUTABLE TOOLS & INTERCEPTORS
# ==============================================================================

_cached_store = None

def get_store():
    global _cached_store
    if _cached_store is None:
        try:
            _cached_store = get_episodic_vector_store()
        except Exception as e:
            logger.warning(f"ChromaDB initialization failed: {e}")
            _cached_store = None
    return _cached_store

def raw_get_sensor_data(equipment_id: str) -> dict:
    """Queries live operational metrics (temperature, vibration, pressure) for a specific machine."""
    eq_clean = equipment_id.strip().upper()
    logger.info(f"[Tool: get_sensor_data] Querying live hardware telemetry for equipment: '{eq_clean}'")
    
    if "TURBINE" in eq_clean or "GEN" in eq_clean:
        return {
            "equipment_id": eq_clean,
            "machine_type": "Gas Turbine Generator",
            "temperature_c": 104.8,
            "vibration_mm_s": 8.7,
            "pressure_psi": 188.5,
            "rpm": 5200,
            "oil_viscosity_cst": 28.4,
            "status": "CRITICAL_OVERHEAT"
        }
    elif "PUMP" in eq_clean or "HYD" in eq_clean:
        return {
            "equipment_id": eq_clean,
            "machine_type": "High-Pressure Hydraulic Pump",
            "temperature_c": 98.4,
            "vibration_mm_s": 7.4,
            "pressure_psi": 215.0,
            "rpm": 2950,
            "status": "PRESSURE_SPIKE_CAVITATION"
        }
    elif "CONVEYOR" in eq_clean or "MOTOR" in eq_clean or "MTR" in eq_clean:
        return {
            "equipment_id": eq_clean,
            "machine_type": "Assembly Line Drive Motor",
            "temperature_c": 87.5,
            "vibration_mm_s": 6.8,
            "pressure_psi": 92.0,
            "rpm": 1820,
            "status": "MECHANICAL_DRAG"
        }
    else:
        return {
            "equipment_id": eq_clean,
            "machine_type": "Generic Industrial Unit",
            "temperature_c": 95.2,
            "vibration_mm_s": 7.1,
            "pressure_psi": 145.0,
            "rpm": 2400,
            "status": "ABNORMAL_METRICS"
        }

def raw_query_technical_docs(query: str) -> dict:
    """Searches ChromaDB vector index for maintenance manuals and technical diagnostic procedures."""
    logger.info(f"[Tool: query_technical_docs] Querying technical knowledge base with: '{query}'")
    chunks = []
    try:
        store = get_store()
        if store is not None:
            records = retrieve_episodic_context(query=query, vector_store=store, k=3)
            for r in records:
                doc_id = r.get("id", "SOP-Doc")
                similarity = r.get("similarity", 0.0)
                content = r.get("content", "").strip()
                chunks.append({
                    "doc_id": doc_id,
                    "similarity": similarity,
                    "snippet": content[:240] + ("..." if len(content) > 240 else "")
                })
    except Exception as e:
        logger.warning(f"Error querying ChromaDB in query_technical_docs: {e}")

    # Standard ISO-10816 fallback procedure
    standard_procedure = (
        "Standard ISO-10816-3 specifies that vibration velocity exceeding 7.1 mm/s on rigid industrial "
        "machinery falls in Zone D (Unacceptable / Danger of immediate mechanical breakdown). "
        "Mitigation Directive: Immediately issue 'lower_pressure' to relieve hydraulic/pneumatic strain, "
        "or execute 'emergency_stop' if bearing temperature exceeds 100°C to avert catastrophic seizure."
    )

    return {
        "query": query,
        "matched_chunks": chunks,
        "standard_reference": "ISO-10816-3 Class II & IV Industrial Vibration Severity Standard",
        "guideline": standard_procedure,
        "critical_thresholds": {
            "max_vibration_zone_c_d": 7.1,
            "max_safe_bearing_temp_c": 100.0,
            "nominal_operating_psi": 110.0
        }
    }

def raw_execute_control_action(equipment_id: str, action: Literal["emergency_stop", "lower_pressure", "reboot"]) -> dict:
    """Sends a validated command to the physical control system ('reboot', 'lower_pressure', 'emergency_stop')."""
    logger.info(f"[Tool: execute_control_action] Executing command '{action}' on equipment: '{equipment_id}'")
    
    if action == "emergency_stop":
        new_state = "OFFLINE"
        msg = f"EMERGENCY STOP dispatched. Equipment '{equipment_id}' decoupled from live power bus and placed in safe offline isolation."
    elif action == "lower_pressure":
        new_state = "SAFE_MODE"
        msg = f"Hydraulic bypass opened on '{equipment_id}'. System pressure throttled down to nominal 82 PSI."
    elif action == "reboot":
        new_state = "NORMAL"
        msg = f"PLC controller reboot sequence finished on '{equipment_id}'. Telemetry recalibrated."
    else:
        new_state = "SAFE_MODE"
        msg = f"Action '{action}' executed on '{equipment_id}'."

    return {
        "success": True,
        "action": action,
        "equipment_id": equipment_id,
        "new_state": new_state,
        "message": msg,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# ==============================================================================
# TOOL EXECUTION INTERCEPTORS (Pydantic whitelisting + error ping-pong)
# ==============================================================================

def safe_get_sensor_data(raw_args: dict) -> dict:
    """Wraps sensor data tool in SensorDataArgs Pydantic validation."""
    try:
        validated = SensorDataArgs(**raw_args)
        data = raw_get_sensor_data(validated.equipment_id)
        data["_guardrail_status"] = "PASSED: SensorDataArgs(equipment_id validated)"
        return data
    except ValidationError as ve:
        err_msg = "; ".join([f"{e['loc'][0]}: {e['msg']}" for e in ve.errors()])
        logger.warning(f"SensorDataArgs Guardrail Interception: {err_msg}")
        return {
            "error": True,
            "_guardrail_status": f"BLOCKED: SensorDataArgs validation failed - {err_msg}",
            "observation": f"Guardrail Error: Invalid equipment_id in arguments {raw_args}. Detail: {err_msg}"
        }
    except Exception as e:
        return {"error": True, "_guardrail_status": f"FAILED: {str(e)}", "observation": str(e)}

def safe_query_technical_docs(raw_args: dict) -> dict:
    """Wraps technical docs query in TechnicalDocsArgs Pydantic validation."""
    try:
        validated = TechnicalDocsArgs(**raw_args)
        data = raw_query_technical_docs(validated.query)
        data["_guardrail_status"] = "PASSED: TechnicalDocsArgs(query whitelisted & SQL sanitized)"
        return data
    except ValidationError as ve:
        err_msg = "; ".join([f"{e['loc'][0]}: {e['msg']}" for e in ve.errors()])
        logger.warning(f"TechnicalDocsArgs Guardrail Interception: {err_msg}")
        return {
            "error": True,
            "_guardrail_status": f"BLOCKED: TechnicalDocsArgs validation failed - {err_msg}",
            "observation": f"Guardrail Error: Technical documentation query rejected. Detail: {err_msg}"
        }
    except Exception as e:
        return {"error": True, "_guardrail_status": f"FAILED: {str(e)}", "observation": str(e)}

def safe_execute_control_action(raw_args: dict) -> dict:
    """Wraps control action in ControlActionArgs Pydantic validation."""
    try:
        validated = ControlActionArgs(**raw_args)
        data = raw_execute_control_action(validated.equipment_id, validated.action)
        data["_guardrail_status"] = f"PASSED: ControlActionArgs(action='{validated.action}' verified safe)"
        return data
    except ValidationError as ve:
        err_msg = "; ".join([f"{e['loc'][0]}: {e['msg']}" for e in ve.errors()])
        logger.warning(f"ControlActionArgs Guardrail Interception: {err_msg}")
        return {
            "error": True,
            "_guardrail_status": f"BLOCKED: ControlActionArgs validation failed - {err_msg}",
            "observation": f"Guardrail Error: Control action rejected by safety policy. Detail: {err_msg}"
        }
    except Exception as e:
        return {"error": True, "_guardrail_status": f"FAILED: {str(e)}", "observation": str(e)}

# ==============================================================================
# SPECIFICATION 1.1: LANGGRAPH STATE SCHEMA (`AgentState`)
# ==============================================================================

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    alert_text: str
    active_agent: str
    diagnostic_data: dict
    compliance_data: dict
    mitigation_data: dict
    logistics_data: dict
    execution_trace: list[dict] # records: timestamp, agent_name, thought, action, observation
    final_synthesis: dict

# ==============================================================================
# SPECIFICATION 1.3: FOUR SPECIALIZED AGENTS + ONE CENTRAL SUPERVISOR
# ==============================================================================

def extract_target_equipment(text: str) -> str:
    """Deterministic equipment identification regex parser."""
    match = re.search(r'\b([A-Z0-9]+(?:-[A-Z0-9]+)+)\b', text, re.IGNORECASE)
    if match:
        return match.group(1).upper()
    if "TURBINE" in text.upper():
        return "TURBINE-GEN-04"
    if "PUMP" in text.upper() or "HYDRAULIC" in text.upper():
        return "HYD-PUMP-02"
    if "CONVEYOR" in text.upper() or "MOTOR" in text.upper():
        return "CONVEYOR-MTR-12"
    return "HYD-PUMP-02"

# ------------------------------------------------------------------------------
# 1. SUPERVISOR NODE
# ------------------------------------------------------------------------------
def supervisor_node(state: AgentState) -> dict:
    """
    Evaluates state and coordinates the assembly line:
    Diagnostic -> Safety Compliance -> Control Operator -> Logistics Impact -> FINISH.
    """
    diag = state.get("diagnostic_data", {})
    comp = state.get("compliance_data", {})
    mitig = state.get("mitigation_data", {})
    logist = state.get("logistics_data", {})

    now_iso = datetime.now(timezone.utc).isoformat()
    trace = list(state.get("execution_trace", []))

    if not diag:
        next_agent = "DIAGNOSTIC SPECIALIST"
        thought = "Incoming industrial alert received. Routing alert to Diagnostic Specialist to query live PLC telemetry."
    elif not comp:
        next_agent = "SAFETY AUDITOR"
        thought = f"Telemetry acquired for {diag.get('equipment_id', 'target unit')}. Routing to Safety Auditor for ISO-10816 standards check."
    elif not mitig:
        next_agent = "MITIGATION OPERATOR"
        thought = f"Safety compliance evaluated ({comp.get('compliance_status', 'NON-COMPLIANT')}). Routing to Mitigation Operator for verified deterministic control dispatch."
    elif not logist:
        next_agent = "LOGISTICS IMPACT"
        thought = f"Mitigation executed ({mitig.get('action', 'action complete')}). Routing to Logistics Impact node to compute down-time, financial exposure, and supply-chain coordinates."
    else:
        next_agent = "FINISH"
        thought = "All specialized agent nodes completed verified execution. Finalizing multi-agent synthesis."

    trace.append({
        "timestamp": now_iso,
        "agent_name": "CENTRAL SUPERVISOR",
        "thought": thought,
        "action": {
            "type": "SUPERVISOR_ROUTE",
            "target": next_agent
        },
        "observation": f"Assembly line dispatch confirmed -> {next_agent}"
    })

    return {
        "active_agent": next_agent,
        "execution_trace": trace
    }

# ------------------------------------------------------------------------------
# 2. DIAGNOSTIC SPECIALIST NODE
# ------------------------------------------------------------------------------
def diagnostic_node(state: AgentState) -> dict:
    """
    DIAGNOSTIC SPECIALIST NODE:
    Extracts target equipment, executes 'get_sensor_data', computes baseline anomaly metrics.
    """
    alert = state.get("alert_text", "")
    now_iso = datetime.now(timezone.utc).isoformat()
    trace = list(state.get("execution_trace", []))

    equipment_id = extract_target_equipment(alert)
    raw_tool_args = {"equipment_id": equipment_id}

    # Intercept with Pydantic guardrail
    sensor_result = safe_get_sensor_data(raw_tool_args)

    # Optional Gemini insight for rich diagnostics
    llm_thought = invoke_gemini_brief(
        prompt=f"Alert: {alert}\nTelemetry Data: {json.dumps(sensor_result)}",
        system_instruction=(
            "You are an Industrial Diagnostic Specialist. Analyze the provided sensor telemetry. "
            "In 2 brief sentences, state your diagnostic reasoning and the primary physical anomaly."
        )
    )

    temp = sensor_result.get("temperature_c", 25.0)
    vib = sensor_result.get("vibration_mm_s", 1.0)
    psi = sensor_result.get("pressure_psi", 90.0)

    # Compute anomaly metrics
    temp_delta = round(temp - 65.0, 1)  # baseline 65 C
    vib_delta = round(vib - 2.8, 1)     # baseline 2.8 mm/s
    psi_delta = round(psi - 100.0, 1)   # baseline 100 PSI

    primary_anomaly = sensor_result.get("status", "ABNORMAL_METRICS")
    if "CAVITATION" in primary_anomaly or psi > 190:
        diagnosed_issue = f"Severe pressure surge ({psi} PSI) with hydraulic cavitation and elevated vibration ({vib} mm/s)"
    elif "OVERHEAT" in primary_anomaly or temp > 100:
        diagnosed_issue = f"Critical thermal runaway: bearing core reached {temp}°C (Delta: +{temp_delta}°C) with excessive rotor vibration ({vib} mm/s)"
    elif "DRAG" in primary_anomaly:
        diagnosed_issue = f"Mechanical drag detected on drive train: vibration {vib} mm/s exceeding Class II baseline with irregular resistance"
    else:
        diagnosed_issue = f"Telemetry anomaly: temperature {temp}°C, vibration {vib} mm/s, pressure {psi} PSI"

    thought = llm_thought or (
        f"Inspected operational telemetry for {equipment_id}. Temperature is {temp}°C (+{temp_delta}°C above baseline), "
        f"vibration is {vib} mm/s, and pressure is {psi} PSI. Identified anomaly: {diagnosed_issue}."
    )

    diagnostic_payload = {
        "equipment_id": equipment_id,
        "machine_type": sensor_result.get("machine_type", "Industrial Unit"),
        "telemetry": sensor_result,
        "anomaly_metrics": {
            "temp_delta_c": temp_delta,
            "vib_delta_mm_s": vib_delta,
            "psi_delta": psi_delta,
            "primary_anomaly": primary_anomaly
        },
        "diagnosed_issue": diagnosed_issue
    }

    trace.append({
        "timestamp": now_iso,
        "agent_name": "DIAGNOSTIC SPECIALIST",
        "thought": thought,
        "action": {
            "tool": "get_sensor_data",
            "arguments": raw_tool_args,
            "guardrail_status": sensor_result.get("_guardrail_status", "PASSED")
        },
        "observation": sensor_result
    })

    return {
        "diagnostic_data": diagnostic_payload,
        "execution_trace": trace,
        "active_agent": "SAFETY AUDITOR"
    }

# ------------------------------------------------------------------------------
# 3. SAFETY AUDITOR NODE
# ------------------------------------------------------------------------------
def safety_auditor_node(state: AgentState) -> dict:
    """
    SAFETY AUDITOR NODE:
    Queries ChromaDB SOPs (`query_technical_docs`), evaluates ISO-10816 vibration limits
    and thermal trip conditions against live diagnostic data.
    """
    diag = state.get("diagnostic_data", {})
    eq_id = diag.get("equipment_id", "EQUIPMENT-01")
    telemetry = diag.get("telemetry", {})
    now_iso = datetime.now(timezone.utc).isoformat()
    trace = list(state.get("execution_trace", []))

    query_str = f"{eq_id} ISO-10816 vibration limits safe operating pressure emergency shutdown SOP"
    raw_tool_args = {"query": query_str}

    # Intercept with Pydantic guardrail
    docs_result = safe_query_technical_docs(raw_tool_args)

    vib = telemetry.get("vibration_mm_s", 0.0)
    temp = telemetry.get("temperature_c", 0.0)

    # Evaluate against ISO-10816-3 standard
    # Zone A: < 1.8 (Good), Zone B: 1.8-4.5 (Acceptable), Zone C: 4.5-7.1 (Unrestricted), Zone D: > 7.1 (Danger)
    if vib > 7.1:
        iso_zone = "Zone D (Unacceptable / Danger of immediate breakdown)"
        compliance_status = "NON-COMPLIANT - MANDATORY IMMEDIATE INTERVENTION"
        recommended_action = "emergency_stop" if temp >= 100.0 else "lower_pressure"
    elif vib > 4.5:
        iso_zone = "Zone C (Restricted Long-Term Operation)"
        compliance_status = "WARNING - MITIGATION RECOMMENDED"
        recommended_action = "lower_pressure"
    else:
        iso_zone = "Zone B/A (Nominal Operation)"
        compliance_status = "COMPLIANT"
        recommended_action = "reboot"

    # Optional Gemini synthesis
    llm_thought = invoke_gemini_brief(
        prompt=f"Telemetry: {json.dumps(telemetry)}\nSOP Standards: {json.dumps(docs_result)}",
        system_instruction=(
            "You are a Safety Compliance Auditor. Compare machine telemetry against ISO-10816 safety limits. "
            "In 2 sentences, deliver your safety audit verdict and cite the exact violation threshold."
        )
    )

    thought = llm_thought or (
        f"Audited {eq_id} metrics against ISO-10816-3 standards. Vibration velocity ({vib} mm/s) falls strictly into {iso_zone}. "
        f"Safety compliance verdict: {compliance_status}. Mandating '{recommended_action}' to prevent catastrophic equipment rupture."
    )

    compliance_payload = {
        "equipment_id": eq_id,
        "standard_applied": docs_result.get("standard_reference", "ISO-10816-3"),
        "iso_zone": iso_zone,
        "compliance_status": compliance_status,
        "mandatory_action": recommended_action,
        "docs_data": docs_result
    }

    trace.append({
        "timestamp": now_iso,
        "agent_name": "SAFETY AUDITOR",
        "thought": thought,
        "action": {
            "tool": "query_technical_docs",
            "arguments": raw_tool_args,
            "guardrail_status": docs_result.get("_guardrail_status", "PASSED")
        },
        "observation": {
            "iso_zone": iso_zone,
            "compliance_status": compliance_status,
            "guideline_excerpt": docs_result.get("guideline", "")[:180] + "...",
            "vector_chunks_matched": len(docs_result.get("matched_chunks", []))
        }
    })

    return {
        "compliance_data": compliance_payload,
        "execution_trace": trace,
        "active_agent": "MITIGATION OPERATOR"
    }

# ------------------------------------------------------------------------------
# 4. MITIGATION OPERATOR NODE
# ------------------------------------------------------------------------------
def mitigation_operator_node(state: AgentState) -> dict:
    """
    MITIGATION OPERATOR NODE:
    Evaluates safety auditor recommendation and executes verified safe state transition (`execute_control_action`).
    """
    comp = state.get("compliance_data", {})
    diag = state.get("diagnostic_data", {})
    eq_id = diag.get("equipment_id", "EQUIPMENT-01")
    recommended_action = comp.get("mandatory_action", "lower_pressure")

    now_iso = datetime.now(timezone.utc).isoformat()
    trace = list(state.get("execution_trace", []))

    raw_tool_args = {
        "equipment_id": eq_id,
        "action": recommended_action
    }

    # Intercept with Pydantic guardrail
    control_result = safe_execute_control_action(raw_tool_args)

    llm_thought = invoke_gemini_brief(
        prompt=f"Recommended Action: {recommended_action}\nExecution Output: {json.dumps(control_result)}",
        system_instruction=(
            "You are a Senior Plant Mitigation Operator. Announce the execution of the deterministic control action. "
            "In 2 sentences, explain the safe physical state achieved."
        )
    )

    action_msg = control_result.get("message", "Control action dispatched.")
    thought = llm_thought or (
        f"Executing verified safe state transition on {eq_id}. Initiated command '{recommended_action}' via PLC bus. "
        f"{action_msg}"
    )

    mitigation_payload = {
        "equipment_id": eq_id,
        "action": recommended_action,
        "operational_status": control_result.get("new_state", "SAFE_MODE"),
        "control_response": control_result
    }

    trace.append({
        "timestamp": now_iso,
        "agent_name": "MITIGATION OPERATOR",
        "thought": thought,
        "action": {
            "tool": "execute_control_action",
            "arguments": raw_tool_args,
            "guardrail_status": control_result.get("_guardrail_status", "PASSED")
        },
        "observation": control_result
    })

    return {
        "mitigation_data": mitigation_payload,
        "execution_trace": trace,
        "active_agent": "LOGISTICS IMPACT"
    }

# ------------------------------------------------------------------------------
# 5. LOGISTICS IMPACT NODE
# ------------------------------------------------------------------------------
def logistics_impact_node(state: AgentState) -> dict:
    """
    LOGISTICS IMPACT NODE:
    Computes delay hours, down-time cost accrual, affected shipment coordinates,
    and formats final financial & operational synthesis.
    """
    diag = state.get("diagnostic_data", {})
    comp = state.get("compliance_data", {})
    mitig = state.get("mitigation_data", {})
    eq_id = diag.get("equipment_id", "HYD-PUMP-02")
    action_taken = mitig.get("action", "emergency_stop")
    op_status = mitig.get("operational_status", "OFFLINE")

    now_iso = datetime.now(timezone.utc).isoformat()
    trace = list(state.get("execution_trace", []))

    # Deterministic logistics model calculations
    if "TURBINE" in eq_id:
        location = "Seattle Power & Maritime Hub - Substation G"
        coordinates = [47.6062, -122.3321]
        hourly_rate = 3200.0
        delay_hours = 36.0 if op_status == "OFFLINE" else 14.0
        parts_cost = 24500.0
        affected_freight = ["Berth 4 Cold-Storage Cranes", "Regional Grid Interconnect 04-A"]
        severity = "CRITICAL"
    elif "PUMP" in eq_id or "HYD" in eq_id:
        location = "Rotterdam Bulk Logistics Terminal - Valve Bay 2"
        coordinates = [51.9244, 4.4777]
        hourly_rate = 2600.0
        delay_hours = 24.0 if op_status == "OFFLINE" else 8.0
        parts_cost = 14200.0
        affected_freight = ["Barge Feeder B-109", "Outbound Pipeline Manifold C"]
        severity = "CRITICAL" if op_status == "OFFLINE" else "HIGH"
    elif "CONVEYOR" in eq_id or "MOTOR" in eq_id:
        location = "Chicago Intermodal Distribution Facility - Line 3"
        coordinates = [41.8781, -87.6298]
        hourly_rate = 1850.0
        delay_hours = 12.0 if op_status == "OFFLINE" else 4.0
        parts_cost = 6800.0
        affected_freight = ["Freight Rail Car Line Express #88", "Sortation Loop Gamma"]
        severity = "HIGH" if op_status == "OFFLINE" else "MEDIUM"
    else:
        location = "Automated Distribution Center - Main Plant"
        coordinates = [40.7128, -74.0060]
        hourly_rate = 2100.0
        delay_hours = 16.0
        parts_cost = 9500.0
        affected_freight = ["Automated AGV Corridor 02"]
        severity = "HIGH"

    downtime_cost = round(delay_hours * hourly_rate, 2)
    total_cost_usd = round(downtime_cost + parts_cost, 2)

    llm_thought = invoke_gemini_brief(
        prompt=f"Equipment: {eq_id}\nAction: {action_taken}\nStatus: {op_status}\nDelay: {delay_hours} hrs\nCost: ${total_cost_usd}",
        system_instruction=(
            "You are a Global Logistics Operations Director. Summarize the commercial supply-chain fallout "
            "and mitigation turnaround in 2 concise sentences."
        )
    )

    thought = llm_thought or (
        f"Evaluated downstream supply chain exposure for {eq_id} at {location}. "
        f"Equipment state '{op_status}' incurs an estimated {delay_hours}h operational delay. "
        f"Total financial impact calculated at ${total_cost_usd:,.2f} ({hourly_rate}/h downtime + ${parts_cost:,.2f} rapid spare overhaul)."
    )

    logistics_payload = {
        "location": location,
        "coordinates": coordinates,
        "estimated_delay_hours": delay_hours,
        "downtime_cost_usd": downtime_cost,
        "parts_cost_usd": parts_cost,
        "cost_impact_usd": total_cost_usd,
        "affected_freight": affected_freight
    }

    final_synthesis = {
        "equipment_id": eq_id,
        "issue_identified": diag.get("diagnosed_issue", "Telemetry Anomaly"),
        "severity": severity,
        "action_taken": mitig.get("control_response", {}).get("message", f"Command '{action_taken}' applied."),
        "operational_status": op_status,
        "location": location,
        "coordinates": coordinates,
        "estimated_delay_hours": delay_hours,
        "cost_impact_usd": total_cost_usd,
        "affected_freight": affected_freight,
        "iso_compliance": comp.get("iso_zone", "ISO-10816 Zone D"),
        "synthesis_timestamp": now_iso
    }

    trace.append({
        "timestamp": now_iso,
        "agent_name": "LOGISTICS IMPACT",
        "thought": thought,
        "action": {
            "tool": "compute_logistics_impact",
            "arguments": {
                "equipment_id": eq_id,
                "delay_hours": delay_hours,
                "total_cost_usd": total_cost_usd
            },
            "guardrail_status": "PASSED: Deterministic Logistics Actuarial Calculation"
        },
        "observation": logistics_payload
    })

    return {
        "logistics_data": logistics_payload,
        "final_synthesis": final_synthesis,
        "execution_trace": trace,
        "active_agent": "FINISH"
    }

# ==============================================================================
# STATEGRAPH WORKFLOW COMPILATION
# ==============================================================================

def route_supervisor(state: AgentState) -> str:
    """Conditional router function for the supervisor node."""
    if not state.get("diagnostic_data"):
        return "diagnostic"
    if not state.get("compliance_data"):
        return "safety_auditor"
    if not state.get("mitigation_data"):
        return "mitigation_operator"
    if not state.get("logistics_data"):
        return "logistics_impact"
    return END

workflow = StateGraph(AgentState)

# Add all 5 nodes
workflow.add_node("supervisor", supervisor_node)
workflow.add_node("diagnostic", diagnostic_node)
workflow.add_node("safety_auditor", safety_auditor_node)
workflow.add_node("mitigation_operator", mitigation_operator_node)
workflow.add_node("logistics_impact", logistics_impact_node)

# Flow: START -> supervisor -> specialized node -> supervisor -> ... -> END
workflow.add_edge(START, "supervisor")

workflow.add_conditional_edges(
    "supervisor",
    route_supervisor,
    {
        "diagnostic": "diagnostic",
        "safety_auditor": "safety_auditor",
        "mitigation_operator": "mitigation_operator",
        "logistics_impact": "logistics_impact",
        END: END
    }
)

workflow.add_edge("diagnostic", "supervisor")
workflow.add_edge("safety_auditor", "supervisor")
workflow.add_edge("mitigation_operator", "supervisor")
workflow.add_edge("logistics_impact", "supervisor")

# Compile graph
app_graph = workflow.compile()

def run_multi_agent_workflow(alert_text: str) -> AgentState:
    """Invokes the compiled multi-agent LangGraph workflow."""
    initial_state: AgentState = {
        "messages": [],
        "alert_text": alert_text,
        "active_agent": "CENTRAL SUPERVISOR",
        "diagnostic_data": {},
        "compliance_data": {},
        "mitigation_data": {},
        "logistics_data": {},
        "execution_trace": [],
        "final_synthesis": {}
    }
    final_state = app_graph.invoke(initial_state)
    return final_state
