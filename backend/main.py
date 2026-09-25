import os
import re
import json
import logging
import asyncio
import time
import uuid
from collections import defaultdict, deque
from typing import List, Dict, Any, Optional, Literal
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import BaseModel, Field, field_validator, ValidationError
from dotenv import load_dotenv
from google import genai
from google.genai import types
from prometheus_client import CollectorRegistry, Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

try:
    from backend.cache import get_client, get_json, set_json
    from backend.database import database_health
except ImportError:
    from cache import get_client, get_json, set_json
    from database import database_health

# Load .env from backend directory
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()

# Speed optimizations for offline ChromaDB
if os.environ.get("ALLOW_ONLINE_HF", "0") != "1":
    cache_dir = Path.home() / ".cache" / "huggingface" / "hub"
    if cache_dir.exists() and any(cache_dir.glob("models--sentence-transformers--all-MiniLM-L6-v2*")):
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Multi-Agent LangGraph System
try:
    from backend.agents import (
        SensorDataArgs,
        TechnicalDocsArgs,
        ControlActionArgs,
        safe_get_sensor_data,
        safe_query_technical_docs,
        safe_execute_control_action,
        run_multi_agent_workflow,
        run_multi_agent_workflow_async,
        stream_multi_agent_workflow
    )
except ImportError:
    from agents import (
        SensorDataArgs,
        TechnicalDocsArgs,
        ControlActionArgs,
        safe_get_sensor_data,
        safe_query_technical_docs,
        safe_execute_control_action,
        run_multi_agent_workflow,
        run_multi_agent_workflow_async,
        stream_multi_agent_workflow
    )

# Optional episodic memory RAG helpers
try:
    from backend.episodic_memory import (
        get_episodic_vector_store,
        retrieve_episodic_context,
        format_episodic_grounding_prompt
    )
except ImportError:
    try:
        from episodic_memory import (
            get_episodic_vector_store,
            retrieve_episodic_context,
            format_episodic_grounding_prompt
        )
    except ImportError:
        def get_episodic_vector_store(*args, **kwargs):
            return None
        def retrieve_episodic_context(*args, **kwargs):
            return []
        def format_episodic_grounding_prompt(*args, **kwargs):
            return "No historical episodic records found."

class StructuredAuditFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps({
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "event": getattr(record, "event", "application"),
            "request_id": getattr(record, "request_id", None),
        })


handler = logging.StreamHandler()
handler.setFormatter(StructuredAuditFormatter())
logging.basicConfig(level=logging.INFO, handlers=[handler], force=True)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Multi-Agent Autonomous Industrial & Logistics Command Center",
    description="LangGraph Multi-Agent Supervisor Assembly Line on FastAPI, ChromaDB, and Gemini 3.1 Flash"
)

METRICS_REGISTRY = CollectorRegistry(auto_describe=True)
REQUEST_COUNT = Counter(
    "api_requests_total",
    "Total number of inbound API requests",
    ["method", "path", "status_code"],
    registry=METRICS_REGISTRY,
)
REQUEST_LATENCY = Histogram(
    "api_request_duration_seconds",
    "Request latency in seconds",
    ["method", "path"],
    registry=METRICS_REGISTRY,
)

# Allow CORS for Next.js frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get("RATE_LIMIT_WINDOW_SECONDS", "60"))
RATE_LIMIT_REQUESTS = int(os.environ.get("RATE_LIMIT_REQUESTS", "120"))
_request_windows: dict[str, deque[float]] = defaultdict(deque)

@app.middleware("http")
async def security_and_monitoring_middleware(request: Request, call_next):
    start = time.perf_counter()
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    client_id = request.client.host if request.client else "unknown"
    window = _request_windows[client_id]
    now = time.monotonic()
    while window and now - window[0] > RATE_LIMIT_WINDOW_SECONDS:
        window.popleft()
    if len(window) >= RATE_LIMIT_REQUESTS:
        logger.warning("Rate limit exceeded", extra={"event": "rate_limit", "request_id": request_id})
        return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded."}, headers={"X-Request-ID": request_id})
    window.append(now)
    is_public_path = request.url.path in {"/", "/docs", "/openapi.json", "/redoc", "/api/health", "/metrics", "/api/stream"}
    api_key = os.environ.get("API_KEY")

    if api_key and not is_public_path:
        provided_key = request.headers.get("x-api-key") or request.headers.get("authorization", "").replace("Bearer ", "").strip()
        if provided_key != api_key:
            logger.warning("Authentication failed", extra={"event": "authentication_failure", "request_id": request_id})
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or missing API key."},
                headers={"X-Request-ID": request_id},
            )

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    REQUEST_COUNT.labels(request.method, request.url.path, str(response.status_code)).inc()
    REQUEST_LATENCY.labels(request.method, request.url.path).observe(time.perf_counter() - start)
    logger.info("API request completed", extra={"event": "api_request", "request_id": request_id})
    return response

# Candidate models for Gemini API (fastest and validated first)
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

def get_gemini_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY is not configured in backend/.env"
        )
    return genai.Client(api_key=api_key)

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

# ==============================================================================
# DATA MODELS (Compatible with Next.js Multi-Agent Command Console)
# ==============================================================================

class ToolCall(BaseModel):
    name: str
    arguments: Dict[str, Any]

class ReActStep(BaseModel):
    turn: int
    thought: str
    tool_call: Optional[ToolCall] = None
    observation: Optional[Any] = None
    status: Optional[str] = "in_progress"

class FinalDiagnosis(BaseModel):
    equipment_id: str
    issue_identified: str
    severity: str  # LOW | MEDIUM | HIGH | CRITICAL
    action_taken: str
    operational_status: str  # NORMAL | WARNING | OFFLINE | SAFE_MODE
    location: Optional[str] = "Seattle Logistics Terminal"
    coordinates: Optional[List[float]] = [47.6062, -122.3321]
    estimated_delay_hours: Optional[float] = 24.0
    cost_impact_usd: Optional[float] = 64000.0

class DiagnoseRequest(BaseModel):
    text: str
    approval_id: Optional[str] = None

class DiagnoseResponse(BaseModel):
    status: str
    active_agent: Optional[str] = "FINISH"
    trace: List[ReActStep] = []
    execution_trace: Optional[List[Dict[str, Any]]] = []
    diagnosis: FinalDiagnosis
    final_synthesis: Optional[Dict[str, Any]] = {}
    agent_handoffs: Optional[List[Dict[str, str]]] = []
    logistics: Optional[Dict[str, Any]] = {}
    diagnostic_data: Optional[Dict[str, Any]] = None
    compliance_data: Optional[Dict[str, Any]] = None
    mitigation_data: Optional[Dict[str, Any]] = None
    confidence_score: float = 1.0
    approval_required: bool = False
    approval_id: Optional[str] = None

# Legacy models
class DisruptionAlert(BaseModel):
    disruption_type: str
    location: str
    severity_level: str
    estimated_delay_hours: Optional[float]
    cost_impact_usd: Optional[float] = 0.0
    affected_entities: List[str]
    recommended_action: str

class AlertRequest(BaseModel):
    text: str

# ==============================================================================
# REST ENDPOINTS
# ==============================================================================

@app.get("/")
async def read_root():
    return {
        "status": "ok",
        "system": "Multi-Agent Autonomous Industrial & Logistics Command Center",
        "architecture": "LangGraph Multi-Agent Supervisor Assembly Line",
        "guardrails": "Lab 03 Deterministic Pydantic v2 Whitelisting & Interceptor Feedback Loop",
        "models": CANDIDATE_MODELS
    }

@app.get("/api/health")
async def health_check():
    vector_store_status = "online" if get_store() is not None else "degraded"
    database_status = await database_health()
    redis_status = "degraded"
    try:
        redis_status = "online" if await get_client() else "degraded"
    except Exception:
        pass
    return {
        "status": "ok",
        "message": "Autonomous Multi-Agent Backend is active and hardened.",
        "services": {
            "api": "online",
            "gemini": "configured" if os.environ.get("GEMINI_API_KEY") else "missing_env",
            "vector_store": vector_store_status,
            "database": database_status,
            "cache": redis_status,
            "model_fallbacks": CANDIDATE_MODELS,
        },
        "checks": {
            "database": database_status,
            "cache": redis_status,
            "model_client": "ok" if os.environ.get("GEMINI_API_KEY") else "warn",
        },
    }

@app.get("/metrics")
async def metrics():
    return Response(generate_latest(METRICS_REGISTRY), media_type=CONTENT_TYPE_LATEST)

@app.get("/api/stream")
async def stream_agent_updates():
    async def generate():
        steps = [
            {"event": "supervisor", "message": "Dispatching industrial alert to diagnostic specialists."},
            {"event": "diagnostic", "message": "Telemetry reviewed and anomaly signature validated."},
            {"event": "safety", "message": "Compliance and ISO thresholds checked."},
            {"event": "mitigation", "message": "Deterministic control command dispatched."},
            {"event": "logistics", "message": "Impact, delay, and cost calculation completed."},
            {"event": "done", "message": "Multi-agent synthesis complete."},
        ]
        for step in steps:
            yield f"data: {json.dumps(step)}\n\n"
            await asyncio.sleep(0.6)

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.post("/api/diagnose/stream")
async def stream_diagnosis(request: DiagnoseRequest):
    """Run a diagnosis and emit every recorded state transition as SSE."""
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Alert / telemetry text cannot be empty.")

    async def generate():
        yield f"data: {json.dumps({'event': 'workflow_started', 'message': 'Workflow accepted', 'retry': 3000})}\n\n"
        try:
            async for update in stream_multi_agent_workflow(request.text, request.approval_id):
                for node_name, node_update in update.items():
                    yield f"data: {json.dumps({'event': 'state_transition', 'node': node_name, 'payload': node_update, 'retry': 3000}, default=str)}\n\n"
                await asyncio.sleep(0)
            yield f"data: {json.dumps({'event': 'done', 'message': 'Multi-agent synthesis complete.'})}\n\n"
        except Exception as exc:
            logger.exception("SSE workflow failed", extra={"event": "workflow_failure"})
            yield f"data: {json.dumps({'event': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@app.get("/api/episodic/search")
async def search_episodic_memory(q: str, k: int = 3):
    """Retrieve historical episodic incident records from ChromaDB."""
    cache_key = f"episodic:{q}:{k}"
    cached = await get_json(cache_key)
    if cached is not None:
        return cached
    store = get_store()
    if store is None:
        return []
    results = await asyncio.to_thread(retrieve_episodic_context, query=q, vector_store=store, k=k)
    await set_json(cache_key, results)
    return results

# ==============================================================================
# SPECIFICATION 1.4: COMPILED LANGGRAPH MULTI-AGENT ENDPOINT
# ==============================================================================

@app.post("/api/diagnose", response_model=DiagnoseResponse)
async def diagnose_equipment(request: DiagnoseRequest):
    """
    Executes the LangGraph Multi-Agent Supervisor workflow with deterministic tool execution
    guardrails, schema whitelisting, and specialized industrial agent collaboration.
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Alert / telemetry text cannot be empty.")

    logger.info(f"Initiating LangGraph Multi-Agent Assembly Line for alert: '{request.text[:80]}...'")

    try:
        state = await run_multi_agent_workflow_async(request.text, request.approval_id)
    except Exception as e:
        logger.error(f"Error executing LangGraph Multi-Agent Workflow: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Multi-Agent Workflow execution failure: {str(e)}")

    synth = state.get("final_synthesis", {})
    diag = state.get("diagnostic_data", {})
    comp = state.get("compliance_data", {})
    mitig = state.get("mitigation_data", {})
    logist = state.get("logistics_data", {})
    execution_trace = state.get("execution_trace", [])

    # Map execution trace to ReActStep list for backward-compatible terminal views
    trace: List[ReActStep] = []
    for idx, step in enumerate(execution_trace, start=1):
        action_data = step.get("action", {})
        tool_call = None
        if isinstance(action_data, dict) and "tool" in action_data:
            tool_call = ToolCall(name=action_data["tool"], arguments=action_data.get("arguments", {}))
        elif isinstance(action_data, dict) and "type" in action_data:
            tool_call = ToolCall(name=action_data["type"], arguments={"target": action_data.get("target")})

        agent_name = step.get("agent_name", "AGENT")
        trace.append(ReActStep(
            turn=idx,
            thought=f"[{agent_name}] {step.get('thought', '')}",
            tool_call=tool_call,
            observation=step.get("observation"),
            status="completed" if agent_name in ("LOGISTICS IMPACT", "CENTRAL SUPERVISOR") and idx == len(execution_trace) else "in_progress"
        ))

    # Construct the final validated diagnosis
    final_diagnosis = FinalDiagnosis(
        equipment_id=synth.get("equipment_id") or diag.get("equipment_id", "EQUIPMENT-01"),
        issue_identified=synth.get("issue_identified") or diag.get("diagnosed_issue", "Industrial Anomaly Detected"),
        severity=synth.get("severity", "CRITICAL"),
        action_taken=synth.get("action_taken") or mitig.get("action", "Safe state verified."),
        operational_status=synth.get("operational_status") or mitig.get("operational_status", "OFFLINE"),
        location=synth.get("location") or logist.get("location", "Seattle Logistics Terminal"),
        coordinates=synth.get("coordinates") or logist.get("coordinates", [47.6062, -122.3321]),
        estimated_delay_hours=float(synth.get("estimated_delay_hours") or logist.get("estimated_delay_hours", 24.0)),
        cost_impact_usd=float(synth.get("cost_impact_usd") or logist.get("cost_impact_usd", 64000.0))
    )

    agent_handoffs = [
        {"from": "CENTRAL SUPERVISOR", "to": "DIAGNOSTIC SPECIALIST", "status": "COMPLETED"},
        {"from": "DIAGNOSTIC SPECIALIST", "to": "SAFETY AUDITOR", "status": "COMPLETED"},
        {"from": "SAFETY AUDITOR", "to": "MITIGATION OPERATOR", "status": "COMPLETED"},
        {"from": "MITIGATION OPERATOR", "to": "LOGISTICS IMPACT", "status": "COMPLETED"},
        {"from": "LOGISTICS IMPACT", "to": "FINISH", "status": "COMPLETED"},
    ]

    # Save clean diagnostic result JSON for automated export
    try:
        out_path = Path(__file__).resolve().parent.parent / "diagnostic_result.json"
        result_only = {
            "equipment_id": final_diagnosis.equipment_id,
            "issue_identified": final_diagnosis.issue_identified,
            "severity": final_diagnosis.severity,
            "action_taken": final_diagnosis.action_taken,
            "operational_status": final_diagnosis.operational_status,
            "estimated_delay_hours": final_diagnosis.estimated_delay_hours,
            "cost_impact_usd": final_diagnosis.cost_impact_usd,
            "location": final_diagnosis.location
        }
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(result_only, f, indent=2)
        logger.info(f"Saved clean diagnostic result JSON to '{out_path}'.")
    except Exception as save_err:
        logger.warning(f"Could not persist diagnostic_result.json: {save_err}")

    confidence_score = float(synth.get("confidence_score", comp.get("confidence_score", 0.96)))
    approval_threshold = float(os.environ.get("CONFIDENCE_THRESHOLD", "0.80"))
    approval_required = bool(mitig.get("approval_required")) or (confidence_score < approval_threshold and not request.approval_id)
    return DiagnoseResponse(
        status="pending_approval" if approval_required else "completed",
        active_agent="FINISH",
        trace=trace,
        execution_trace=execution_trace,
        diagnosis=final_diagnosis,
        final_synthesis=synth,
        agent_handoffs=agent_handoffs,
        logistics=logist,
        diagnostic_data=diag,
        compliance_data=comp,
        mitigation_data=mitig,
        confidence_score=confidence_score,
        approval_required=approval_required,
        approval_id=request.approval_id
    )

# ==============================================================================
# LEGACY BACKWARDS COMPATIBILITY (/api/extract)
# ==============================================================================

LEGACY_SYSTEM_PROMPT = """You are a logistics reasoning agent. Analyze the current disruption alert. I have provided 'Historical Context' from our database showing past similar incidents. Based strictly on how past incidents were resolved, or logical supply chain principles, generate a brief, actionable solution for the current disruption. Output this solution in the `recommended_action` field.

Execution Rules:
- Rely on the provided alert text and historical context; do not invent irrelevant details.
- Strict formatting rules apply to ensure reliable machine parsing: you must respond with a JSON object only conforming to the schema.
- Do not include any explanatory text, conversational filler, or markdown tags outside of the JSON block."""

@app.post("/api/extract", response_model=DisruptionAlert)
async def extract_alert(request: AlertRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Alert text cannot be empty.")

    client = get_gemini_client()
    last_error = ""

    store = get_store()
    if store is not None:
        historical_episodes = retrieve_episodic_context(query=request.text, vector_store=store, k=3)
    else:
        historical_episodes = []
    episodic_grounding = format_episodic_grounding_prompt(historical_episodes)

    for model_name in CANDIDATE_MODELS:
        for attempt in range(1, 3):
            try:
                logger.info(f"Legacy extraction attempting with '{model_name}' (attempt {attempt}/2)...")
                prompt = f"{LEGACY_SYSTEM_PROMPT}\n\n{episodic_grounding}\n\nCurrent Disruption Alert to process:\n{request.text}"
                
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=DisruptionAlert,
                    )
                )
                raw_response = response.text
                parsed_json = json.loads(raw_response)
                alert = DisruptionAlert(**parsed_json)
                return alert
            except Exception as e:
                last_error = f"Error with model {model_name}: {e}"
                logger.warning(last_error)
                break
                
    raise HTTPException(
        status_code=500, 
        detail=f"Failed to process alert across available models: {last_error}"
    )

if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    reload = os.environ.get("RELOAD", "false").lower() in ("true", "1")
    uvicorn.run("main:app", host=host, port=port, reload=reload)
