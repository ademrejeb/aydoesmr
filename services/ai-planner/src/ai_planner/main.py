from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
import datetime

app = FastAPI(
    title="TechDebt AI Planner",
    description="AI-powered refactoring planning service",
    version="0.1.0",
)


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: str


class PlanRequest(BaseModel):
    project_id: str
    file_path: str
    language: str
    max_fixes: Optional[int] = 10
    confidence_threshold: Optional[float] = 0.7


class PlanResponse(BaseModel):
    plan_id: str
    project_id: str
    steps: list[dict]
    confidence_score: float
    created_at: str


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="healthy",
        service="techdebt-ai-planner",
        version="0.1.0",
        timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    )


@app.get("/ready")
async def ready():
    return {"status": "ready"}


@app.post("/api/v1/plan", response_model=PlanResponse)
async def create_plan(request: PlanRequest):
    return PlanResponse(
        plan_id="placeholder",
        project_id=request.project_id,
        steps=[],
        confidence_score=0.0,
        created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    )
