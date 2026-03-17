"""
Growth Engine API Server
========================
FastAPI entry point for Railway deployment.
Exposes the core agency actions over HTTP on port 8000.

Endpoints:
  GET  /health               — health check
  POST /run-audit            — run CompetitiveAuditAgent for a single business
  POST /run-lead-gen         — run full acquisition pipeline via orchestrator

All other existing Flask endpoints (Stripe webhooks, /api/leads, /api/scan, etc.)
are preserved in webhook_server.py and can be run separately on port 4242.
"""

import os
import sys
import logging
import threading
from typing import Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import uvicorn

# Load .env from project root (one level up from ai_agency/)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
# Also try loading from current dir in case of Docker COPY layout
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger("api_server")

app = FastAPI(
    title="Growth Engine API",
    description="AI agency automation backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class AuditRequest(BaseModel):
    business_name: str
    business_url: str
    niche: str = "medspa"
    location: str = "Austin TX"
    out_dir: Optional[str] = None


class LeadGenRequest(BaseModel):
    niche: str
    location: str
    num_leads: int = 10


class AuditResponse(BaseModel):
    success: bool
    business_name: str
    audit_path: Optional[str] = None
    overall_score: Optional[int] = None
    biggest_gaps: Optional[list] = None
    opportunities: Optional[list] = None
    error: Optional[str] = None


class LeadGenResponse(BaseModel):
    success: bool
    message: str
    results: Optional[list] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "growth-engine-api"}


# ---------------------------------------------------------------------------
# POST /run-audit
# ---------------------------------------------------------------------------

@app.post("/run-audit", response_model=AuditResponse)
def run_audit(req: AuditRequest):
    """
    Run CompetitiveAuditAgent for a single business and return the results.
    Blocking — waits for completion and returns the audit summary.
    """
    try:
        from competitive_audit_agent import CompetitiveAuditAgent

        out_dir = req.out_dir or f"./leads_generated/{req.business_name.lower().replace(' ', '_')}"
        agent = CompetitiveAuditAgent()

        audit_path, _json_path, audit_analysis, opportunities = agent.generate_audit(
            business_name=req.business_name,
            business_url=req.business_url,
            niche=req.niche,
            location=req.location,
            out_dir=out_dir,
        )

        return AuditResponse(
            success=True,
            business_name=req.business_name,
            audit_path=audit_path,
            overall_score=audit_analysis.get("overall_score"),
            biggest_gaps=audit_analysis.get("biggest_gaps", []),
            opportunities=opportunities or [],
        )

    except Exception as e:
        logger.exception(f"Audit failed for {req.business_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# POST /run-lead-gen
# ---------------------------------------------------------------------------

def _run_pipeline_background(niche: str, location: str, num_leads: int):
    """Background worker — runs the full acquisition pipeline."""
    try:
        from orchestrator import AgenticAIStudios
        studio = AgenticAIStudios()
        results = studio.run_acquisition_pipeline(niche, location, num_leads)
        logger.info(f"Lead-gen pipeline complete: {len(results)} leads for {niche} in {location}")
    except Exception as e:
        logger.exception(f"Lead-gen pipeline error: {e}")


@app.post("/run-lead-gen", response_model=LeadGenResponse)
def run_lead_gen(req: LeadGenRequest, background_tasks: BackgroundTasks):
    """
    Kick off the full acquisition pipeline (scout -> audit -> outreach).
    Runs in the background — returns immediately with a confirmation.
    Check Supabase agency_prospects table for results.
    """
    background_tasks.add_task(
        _run_pipeline_background, req.niche, req.location, req.num_leads
    )
    return LeadGenResponse(
        success=True,
        message=f"Lead gen pipeline started for '{req.niche}' in '{req.location}' ({req.num_leads} leads). Results will appear in Supabase.",
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    logger.info(f"Starting Growth Engine API on port {port}...")
    uvicorn.run("api_server:app", host="0.0.0.0", port=port, reload=False)
