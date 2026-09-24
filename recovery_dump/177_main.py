class FinalDiagnosis(BaseModel):
    equipment_id: str
    issue_identified: str
    severity: str  # LOW | MEDIUM | HIGH | CRITICAL
    action_taken: str
    operational_status: str  # NORMAL | WARNING | OFFLINE | SAFE_MODE
    location: Optional[str] = "Seattle Port Logistics Facility"
    coordinates: Optional[List[float]] = [47.6062, -122.3321]
    estimated_delay_hours: Optional[float] = 24.0
    cost_impact_usd: Optional[float] = 64000.0

class DiagnoseRequest(BaseModel):
    text: str

class DiagnoseResponse(BaseModel):
    status: str
    active_agent: Optional[str] = "FINISH"
    execution_trace: List[Dict[str, Any]] = []
    trace: List[ReActStep] = []
    diagnosis: FinalDiagnosis
    final_synthesis: Dict[str, Any] = {}
    agent_handoffs: List[Dict[str, str]] = []
    logistics: Dict[str, Any] = {}
    diagnostic_data: Optional[Dict[str, Any]] = None
    compliance_data: Optional[Dict[str, Any]] = None
    mitigation_data: Optional[Dict[str, Any]] = None