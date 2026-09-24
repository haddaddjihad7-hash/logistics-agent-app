from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="NextSkill API")

# Add CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DiagnosticRequest(BaseModel):
    text: str

@app.get("/")
def read_root():
    return {"status": "ok", "message": "API is running"}

@app.post("/api/diagnose")
def diagnose(req: DiagnosticRequest):
    return {
        "status": "success",
        "message": f"Received telemetry: {req.text}",
    }
