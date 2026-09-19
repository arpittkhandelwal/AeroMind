"""
FastAPI backend server for the UAV Engine Digital Twin.

Implements every endpoint from contracts/api_spec.yaml:
  POST /telemetry/ingest
  GET  /telemetry/latest
  GET  /rul/{mission_id}
  GET  /faults/{mission_id}
  GET  /missions
  GET  /missions/{mission_id}/replay

Additional endpoints:
  GET  /health  — server health check
  GET  /health_history/{mission_id} — time-series HI for sparklines
  GET  /simulation/status/{mission_id} — check if streamer is alive
  GET  /docs    — OpenAPI documentation (provided by FastAPI)

Startup:
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import os
import sys
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Request
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import asyncio
import json

# Module path setup — backend-api runs from its own directory
_ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_ROOT, "..", "edge-preprocessing"))
sys.path.insert(0, os.path.join(_ROOT, "..", "ml-fault-rul"))
sys.path.insert(0, os.path.join(_ROOT, "..", "physics-model"))

import database as db
from engine_model import ThermodynamicModel
from models import TelemetryFrame, Alert, RULResponse, LatestTelemetryResponse, MissionListItem, SimulationStartRequest
from ingest import ingest_frame
from health_index import compute_health_index


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize DB and load ML models on startup."""
    db.init_db()
    # Load ML models (lazy — will load on first ingest if not pre-loaded)
    try:
        from serve import get_service
        get_service()  # triggers model loading
    except Exception as e:
        print(f"[startup] WARNING: ML models not available yet: {e}")
    yield
    # Cleanup on shutdown (nothing needed for SQLite)


app = FastAPI(
    title="UAV Engine Digital Twin API",
    version="0.1.0",
    description=(
        "AI-enabled real-time digital twin for MALE UAV aero piston engine "
        "health monitoring, fault prediction, and RUL estimation. "
        "Implements contracts/api_spec.yaml."
    ),
    lifespan=lifespan,
)

# CORS for dashboard (React dev server on port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# API Key Authentication Middleware
# ---------------------------------------------------------------------------
# Secure telemetry architecture: all endpoints require X-API-Key header.
# Set UAV_API_KEY env var in production. Default dev key below.
# Excluded: /health, /docs, /openapi.json (public monitoring/discovery).

_API_KEY = os.environ.get("UAV_API_KEY", "uav-dev-key-2026")
_EXCLUDED_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}

@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    """Require X-API-Key header on all protected endpoints."""
    path = request.url.path
    # Allow OPTIONS (preflight) and excluded paths without auth
    if request.method == "OPTIONS" or path in _EXCLUDED_PATHS:
        return await call_next(request)
    # Allow /docs assets
    if path.startswith("/docs") or path.startswith("/redoc"):
        return await call_next(request)
    supplied_key = request.headers.get("X-API-Key") or request.query_params.get("api_key")
    if supplied_key != _API_KEY:
        return JSONResponse(
            status_code=401,
            content={"detail": "Unauthorized — provide X-API-Key header"},
        )
    return await call_next(request)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["system"])
def health_check():
    """Server liveness check."""
    return {"status": "ok", "version": "0.1.0"}


# ---------------------------------------------------------------------------
# POST /telemetry/ingest
# ---------------------------------------------------------------------------

@app.post("/telemetry/ingest", tags=["telemetry"])
def ingest(frame: TelemetryFrame):
    """
    Ingest one telemetry frame.

    Runs full pipeline: edge preprocessing → physics model → ML inference
    → health index → DB persistence.
    """
    try:
        result = ingest_frame(frame.model_dump())
        return {"status": "accepted", "health_index": result["health_index"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {e}")


# ---------------------------------------------------------------------------
# GET /telemetry/latest
# ---------------------------------------------------------------------------

@app.get("/telemetry/latest", response_model=LatestTelemetryResponse, tags=["telemetry"])
def get_latest_telemetry(mission_id: str = Query(..., description="Mission ID")):
    """
    Latest frame for a mission, for live dashboard view.
    Returns frame + health_index + active_alerts.
    """
    frame_row = db.get_latest_frame(mission_id)
    if not frame_row:
        raise HTTPException(status_code=404, detail=f"No frames found for mission {mission_id}")

    # Get latest RUL and alerts
    rul_data = db.get_latest_rul(mission_id) or {}
    alerts_rows = db.get_alerts(mission_id)

    # Get the most recent alert as active (within last 5 frames)
    active_alerts = []
    if alerts_rows:
        latest_alert = alerts_rows[0]  # already sorted DESC
        active_alerts = [{
            "fault_type": latest_alert["fault_type"],
            "severity": latest_alert["severity"],
            "detected_at": latest_alert["detected_at"],
            "message": latest_alert.get("message", ""),
            "recommended_action": latest_alert.get("recommended_action", ""),
        }]

    # Compute health index from stored data
    active_severity = active_alerts[0]["severity"] if active_alerts else None
    hi = compute_health_index(
        anomaly_score=0.1,   # approximate — full score stored per-frame in alerts table
        active_severity=active_severity,
        rul_hours=rul_data.get("rul_hours", 500.0),
        degradation_trend=rul_data.get("degradation_trend", "stable"),
    )

    # Build response frame (map DB row to schema)
    frame_dict = _db_row_to_frame(frame_row)

    # Compute expected physics and residuals dynamically
    physics = ThermodynamicModel()
    expected = physics.predict(
        float(frame_dict.get("rpm", 5000)),
        float(frame_dict.get("throttle_pct", 65)),
        float(frame_dict.get("altitude_m", 1500)),
        float(frame_dict.get("ambient_temp_c", 25)),
    )
    residuals = physics.compute_residuals(frame_dict, expected)

    efficiency = _estimate_engine_efficiency(frame_dict, residuals)
    return {
        "frame": frame_dict,
        "health_index": hi,
        "active_alerts": active_alerts,
        "expected_physics": expected,
        "physics_residuals": residuals,
        "engine_efficiency_pct": efficiency,
    }


def _estimate_engine_efficiency(frame: dict, residuals: dict) -> float:
    """Estimate efficiency where torque and fuel-energy instrumentation are unavailable."""
    throttle = max(float(frame.get("throttle_pct", 0)), 1.0)
    rpm = max(float(frame.get("rpm", 0)), 1.0)
    fuel = max(float(frame.get("fuel_flow_lph", 0)), 0.1)
    utilisation = min(1.0, (rpm / 6500.0) * (throttle / 100.0) / (fuel / 16.0))
    penalty = (abs(float(residuals.get("residual_cht_c", 0))) / 220
               + abs(float(residuals.get("residual_egt_c", 0))) / 300
               + max(0.0, float(frame.get("vibration_g", 0)) - 0.25) / 6)
    return round(max(8.0, min(42.0, 26.0 + 14.0 * utilisation - 10.0 * penalty)), 1)


# ---------------------------------------------------------------------------
# GET /rul/{mission_id}
# ---------------------------------------------------------------------------

@app.get("/rul/{mission_id}", response_model=RULResponse, tags=["rul"])
def get_rul(mission_id: str):
    """Current RUL estimate and degradation trend."""
    rul_data = db.get_latest_rul(mission_id)
    if not rul_data:
        # Return optimistic defaults if no data yet
        return {
            "rul_hours": 500.0,
            "confidence": 0.5,
            "degradation_trend": "stable",
            "contributing_factors": [],
        }

    return {
        "rul_hours": rul_data.get("rul_hours", 500.0),
        "confidence": rul_data.get("confidence", 0.5),
        "degradation_trend": rul_data.get("degradation_trend", "stable"),
        "contributing_factors": rul_data.get("contributing_factors", []),
    }


# ---------------------------------------------------------------------------
# GET /health_history/{mission_id}
# ---------------------------------------------------------------------------

@app.get("/health_history/{mission_id}", tags=["rul"])
def get_health_history(mission_id: str):
    """Returns the time-series history of Health Index and RUL for sparklines."""
    # Reconstruct history from RUL table
    rows = db.get_rul_history(mission_id)
    if not rows:
        return []
    
    # We don't store raw HI in the DB natively, we compute it on the fly.
    # To reconstruct the HI sparkline exactly, we'd need anomaly scores from alerts.
    # For performance/simplicity in this endpoint, we'll return the RUL trend which
    # the frontend can map directly to health visually.
    history = []
    for r in reversed(rows): # return chronological
        history.append({
            "timestamp": r["timestamp"],
            "rul_hours": r["rul_hours"],
            "confidence": r["confidence"]
        })
    return history


# ---------------------------------------------------------------------------
# GET /faults/{mission_id}
# ---------------------------------------------------------------------------

@app.get("/faults/{mission_id}", response_model=list[Alert], tags=["faults"])
def get_faults(mission_id: str):
    """Detected/predicted faults for a mission."""
    rows = db.get_alerts(mission_id)
    return [
        {
            "fault_type": r["fault_type"],
            "severity": r["severity"],
            "detected_at": r["detected_at"],
            "message": r.get("message", ""),
            "recommended_action": r.get("recommended_action", ""),
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# GET /missions
# ---------------------------------------------------------------------------

@app.get("/missions", response_model=list[MissionListItem], tags=["missions"])
def list_missions():
    """List all missions available for replay."""
    rows = db.list_missions()
    return [
        {
            "mission_id": r["mission_id"],
            "profile": r["profile"],
            "started_at": r["started_at"],
            "duration_min": r.get("duration_min"),
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# GET /missions/{mission_id}/replay
# ---------------------------------------------------------------------------

@app.get("/missions/{mission_id}/replay", tags=["missions"])
def get_mission_replay(mission_id: str):
    """Full time series for post-flight analysis and mission replay."""
    rows = db.get_mission_frames(mission_id)
    if not rows:
        raise HTTPException(status_code=404, detail=f"No frames for mission {mission_id}")

    return [_db_row_to_frame(r) for r in rows]


@app.get("/missions/{mission_id}/report", tags=["missions"])
def get_mission_report(mission_id: str):
    """Mission-level summary used by the operator's downloadable health report."""
    frames = db.get_mission_frames(mission_id)
    if not frames:
        raise HTTPException(status_code=404, detail=f"No frames for mission {mission_id}")
    mission = db.get_mission(mission_id) or {}
    alerts = db.get_alerts(mission_id)
    rul = db.get_latest_rul(mission_id) or {}
    rul_history = list(reversed(db.get_rul_history(mission_id, limit=300)))
    def values(key): return [float(row[key]) for row in frames if row.get(key) is not None]
    latest = _db_row_to_frame(frames[-1])
    physics = ThermodynamicModel()
    expected = physics.predict(latest["rpm"], latest["throttle_pct"], latest["altitude_m"], latest["ambient_temp_c"])
    efficiency = _estimate_engine_efficiency(latest, physics.compute_residuals(latest, expected))
    ranges = {}
    for key in ("rpm", "cht_c", "egt_c", "oil_pressure_kpa", "oil_temp_c", "fuel_flow_lph", "vibration_g"):
        series = values(key)
        if series:
            ranges[key] = {"min": round(min(series), 2), "max": round(max(series), 2), "latest": round(series[-1], 2)}
    return {
        "mission_id": mission_id, "profile": mission.get("profile", "unknown"),
        "started_at": mission.get("started_at"), "frames_recorded": len(frames),
        "health": {"rul_hours": rul.get("rul_hours"), "trend": rul.get("degradation_trend", "stable"), "efficiency_pct": efficiency},
        "sensor_ranges": ranges, "alerts": alerts, "override_events": db.get_override_events(mission_id),
        "rul_history": [{"timestamp": row["timestamp"], "rul_hours": row["rul_hours"], "confidence": row["confidence"]} for row in rul_history],
        "maintenance_recommendations": [a.get("recommended_action") for a in alerts[:3] if a.get("recommended_action")],
        "local_explanation": rul.get("contributing_factors", []),
    }


@app.get("/diagnostics/{mission_id}", tags=["ai"])
def get_diagnostics(mission_id: str):
    """Latest local XAI evidence: model factors paired with physics residuals."""
    latest = get_latest_telemetry(mission_id)
    rul = db.get_latest_rul(mission_id) or {}
    return {"mission_id": mission_id, "method": "per-frame local feature attribution with physics-residual evidence", "contributing_factors": rul.get("contributing_factors", []), "physics_residuals": latest["physics_residuals"], "expected_physics": latest["expected_physics"]}


@app.get("/telemetry/stream", tags=["telemetry"])
async def telemetry_stream(mission_id: str = Query(...)):
    """Server-Sent Events feed; emits immediately when a new frame is stored."""
    async def events():
        last_timestamp = None
        while True:
            row = db.get_latest_frame(mission_id)
            if row and row.get("timestamp") != last_timestamp:
                last_timestamp = row["timestamp"]
                payload = get_latest_telemetry(mission_id)
                yield f"event: telemetry\ndata: {json.dumps(payload)}\n\n"
            else:
                yield ": keep-alive\n\n"
            await asyncio.sleep(0.5)
    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ---------------------------------------------------------------------------
# Utility: DB row → telemetry frame dict
# ---------------------------------------------------------------------------

def _db_row_to_frame(row: dict) -> dict:
    """Convert a DB telemetry_frames row to a contract-valid frame dict."""
    return {
        "timestamp": row.get("timestamp", ""),
        "mission_id": row.get("mission_id", ""),
        "rpm": row.get("rpm", 0.0),
        "cht_c": row.get("cht_c", 0.0),
        "egt_c": row.get("egt_c", 0.0),
        "oil_pressure_kpa": row.get("oil_pressure_kpa", 0.0),
        "oil_temp_c": row.get("oil_temp_c", 0.0),
        "fuel_flow_lph": row.get("fuel_flow_lph", 0.0),
        "vibration_g": row.get("vibration_g", 0.0),
        "battery_voltage_v": row.get("battery_voltage_v", 0.0),
        "alternator_current_a": row.get("alternator_current_a"),
        "injection_timing_deg": row.get("injection_timing_deg", 0.0),
        "altitude_m": row.get("altitude_m", 0.0),
        "ambient_temp_c": row.get("ambient_temp_c", 0.0),
        "throttle_pct": row.get("throttle_pct", 0.0),
        "fault_label": row.get("fault_label"),
    }


# ---------------------------------------------------------------------------
# POST /simulation/start
# ---------------------------------------------------------------------------
import subprocess
import uuid

@app.post("/simulation/start", tags=["simulation"])
def start_simulation(req: SimulationStartRequest):
    """Start a new background data-sim process."""
    mission_id = req.mission_id or f"{req.profile}_{req.fault}_{str(uuid.uuid4())[:8]}"
    
    # Path to the data-sim streamer script
    streamer_path = os.path.join(_ROOT, "..", "data-sim", "streamer.py")
    venv_python = os.path.join(_ROOT, "..", ".venv", "bin", "python")
    
    # Construct command
    cmd = [
        venv_python, streamer_path,
        "--profile", req.profile,
        "--mission-id", mission_id,
        "--speedup", str(req.speedup),
        "--endpoint", "http://127.0.0.1:8000/telemetry/ingest",
        "--fault-start", "0.1"
    ]
    if req.fault and req.fault != "none":
        cmd.extend(["--fault", req.fault])
    
    # Run as a detached background process
    try:
        subprocess.Popen(
            cmd, 
            stdout=subprocess.DEVNULL, 
            stderr=subprocess.DEVNULL, 
            cwd=os.path.join(_ROOT, "..", "data-sim")
        )
        return {"status": "started", "mission_id": mission_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start simulation: {e}")


# ---------------------------------------------------------------------------
# POST /simulation/inject-fault
# Start a new fault mission (or inject into existing one if supported)
# ---------------------------------------------------------------------------

class InjectFaultRequest(BaseModel):
    mission_id: Optional[str] = None
    fault: str = "overheating"
    speedup: int = 60

@app.post("/simulation/inject-fault", tags=["simulation"])
def inject_fault(req: InjectFaultRequest):
    """
    Start a new simulation mission with the given fault active from the start.
    Returns the new mission_id so the frontend can switch its polling target.
    """
    fault_mission_id = f"nominal_{req.fault}_{str(uuid.uuid4())[:8]}"
    streamer_path = os.path.join(_ROOT, "..", "data-sim", "streamer.py")
    venv_python   = os.path.join(_ROOT, "..", ".venv", "bin", "python")

    cmd = [
        venv_python, streamer_path,
        "--profile",     "nominal",
        "--mission-id",  fault_mission_id,
        "--speedup",     str(req.speedup),
        "--endpoint",    "http://127.0.0.1:8000/telemetry/ingest",
        "--fault-start", "0.05",
        "--fault",       req.fault,
    ]
    try:
        subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=os.path.join(_ROOT, "..", "data-sim"),
        )
        return {
            "status":     "fault_mission_started",
            "mission_id": fault_mission_id,
            "fault":      req.fault,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start fault simulation: {e}")

# ---------------------------------------------------------------------------
# GET /simulation/status/{mission_id}
# ---------------------------------------------------------------------------

@app.get("/simulation/status/{mission_id}", tags=["simulation"])
def simulation_status(mission_id: str):
    """
    Check if a simulation is still actively running.
    Since we run detached, we check if telemetry has been received in the last 5 seconds.
    """
    frame = db.get_latest_frame(mission_id)
    if not frame:
        return {"status": "unknown"}
    
    import datetime
    try:
        # Check if the frame was received recently
        ts = datetime.datetime.fromisoformat(frame["timestamp"].replace("Z", "+00:00"))
        now = datetime.datetime.now(datetime.timezone.utc)
        if (now - ts).total_seconds() < 5.0:
            return {"status": "running"}
        else:
            return {"status": "completed_or_failed"}
    except:
        return {"status": "unknown"}


# ---------------------------------------------------------------------------
# POST /simulation/override
# Apply an emergency operator intervention — modifies a session override state
# that the streamer will check on next frame generation
# ---------------------------------------------------------------------------

# In-memory store for active overrides keyed by mission_id
_OVERRIDES: dict = {}

class OverrideRequest(BaseModel):
    mission_id: str
    action: str   # e.g. reduce_throttle, engage_cooling, throttle_burst, abort
    value: float = 0.0  # optional numeric payload


@app.post("/simulation/override", tags=["simulation"])
def apply_override(req: OverrideRequest):
    """
    Apply an emergency operator intervention to a running simulation.
    The override is stored in memory and applied to subsequent telemetry frames,
    reducing fault severity so the engine can recover.
    """
    _OVERRIDES[req.mission_id] = {
        "action": req.action,
        "value": req.value,
        "applied_at": __import__("time").time(),
    }
    db.insert_override_event(req.mission_id, __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(), req.action, req.value)
    return {
        "status": "override_applied",
        "mission_id": req.mission_id,
        "action": req.action,
        "message": f"Emergency override '{req.action}' applied. Engine recovery initiated.",
    }


@app.get("/simulation/override/{mission_id}", tags=["simulation"])
def get_override(mission_id: str):
    """Get active override for a mission (called by streamer)."""
    override = _OVERRIDES.get(mission_id)
    if not override:
        return {"action": None}
    # Expire overrides after 30 seconds
    if __import__("time").time() - override.get("applied_at", 0) > 30:
        del _OVERRIDES[mission_id]
        return {"action": None}
    return override


# ---------------------------------------------------------------------------
# POST /chat — AI Chatbot Commander (LLM-powered natural language Q&A)
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    question: str
    mission_id: str | None = None


KNOWLEDGE_BASE = {
    "health": "The Engine Health Index is a composite score from 0–100. It combines physics residuals (how far actual sensor readings deviate from the thermodynamic model) and ML fault probabilities. Below 60 is degrading, below 30 is critical.",
    "rul": "Remaining Useful Life (RUL) is predicted by a Gradient Boosting Regressor trained on 200+ synthetic missions. It estimates hours of engine life remaining before catastrophic failure. The model confidence indicates how certain the AI is.",
    "fault": "Faults are detected by a Random Forest Classifier that analyzes sensor residuals (actual minus expected from the physics model). The 7 fault types are: overheating, misfire, injector fault, sensor drift, lubrication issue, abnormal vibration, and combustion instability.",
    "cht": "Cylinder Head Temperature (CHT) should stay below 230°C at cruise. Values above 240°C indicate thermal stress. The physics model predicts expected CHT based on RPM, throttle, and altitude using ISA density corrections.",
    "egt": "Exhaust Gas Temperature (EGT) reflects combustion efficiency. High EGT with low power output indicates injector or combustion issues. Normal range: 600–780°C.",
    "oil": "Oil pressure below 150 kPa indicates lubrication failure risk. Oil temperature above 120°C degrades viscosity. Both are weighted heavily in the Health Index.",
    "override": "Emergency overrides allow the operator to intervene: Reduce Throttle cuts power by 20% to lower thermal load. Engage Backup Cooling activates secondary radiator flow. Reduce RPM drops from cruise to safe idle. These actions feed back into the physics model and can halt degradation.",
    "drdo": "This system was built for DRDO Problem Statement 26054: AI-enabled Digital Twin for MALE UAV Aero Piston Engines. MALE stands for Medium Altitude Long Endurance. The system addresses predictive maintenance, fault isolation, and RUL estimation.",
    "architecture": "The system uses a federated edge-to-cloud architecture. Edge preprocessing runs on the UAV flight controller (noise filter + rolling stats). The Ground Control Station backend runs FastAPI with a thermodynamic physics model and ML ensemble. The dashboard is a React + Three.js command center.",
}


@app.post("/chat", tags=["ai"])
def chat_commander(req: ChatRequest):
    """
    AI Chatbot Commander — answers operator questions about the engine state
    using rule-based NLP + live telemetry context.
    """
    q = req.question.lower()

    # Pull live context if mission is active
    ctx = {}
    if req.mission_id:
        latest = db.get_latest_frame(req.mission_id)
        if latest:
            ctx = {
                "health": latest.get("health_index", "N/A"),
                "cht": latest.get("cht_c", "N/A"),
                "egt": latest.get("egt_c", "N/A"),
                "oil_p": latest.get("oil_pressure_kpa", "N/A"),
                "rpm": latest.get("rpm", "N/A"),
                "fault": latest.get("fault_label", "none"),
            }
        try:
            from serve import get_service
            svc = get_service()
            rul_data = svc.predict_rul(req.mission_id, db.get_frames(req.mission_id, limit=100))
            ctx["rul"] = rul_data.get("rul_hours", "N/A")
            ctx["trend"] = rul_data.get("degradation_trend", "stable")
            ctx["factors"] = rul_data.get("contributing_factors", [])
        except:
            pass

    # Rule-based intent routing
    def live_vals():
        if not ctx:
            return ""
        parts = []
        if ctx.get("health") not in (None, "N/A"):
            parts.append(f"Health Index is {float(ctx['health']):.0f}/100")
        if ctx.get("cht") not in (None, "N/A"):
            parts.append(f"CHT is {float(ctx['cht']):.1f}°C")
        if ctx.get("egt") not in (None, "N/A"):
            parts.append(f"EGT is {float(ctx['egt']):.1f}°C")
        if ctx.get("rul") not in (None, "N/A"):
            parts.append(f"RUL is {float(ctx['rul']):.1f}h")
        if ctx.get("fault") and ctx["fault"] != "none":
            parts.append(f"active fault: {ctx['fault'].replace('_', ' ')}")
        return ". ".join(parts) + "." if parts else ""

    response = ""

    # Greeting
    if any(w in q for w in ["hello", "hi", "namaste"]):
        response = "Namaste, Commander. AI Engine Monitor online. All subsystems operational. How can I assist?"

    # Status query
    elif any(w in q for w in ["status", "how is", "condition", "state", "report"]):
        live = live_vals()
        fault = ctx.get("fault", "none")
        trend = ctx.get("trend", "stable")
        if fault and fault != "none":
            response = f"Sir, engine status is COMPROMISED. {live} Fault detected: {fault.replace('_', ' ').upper()}. Trend is {trend}. Immediate action recommended."
        elif trend == "critical":
            response = f"Sir, engine status is CRITICAL. {live} No specific fault classified yet but degradation is accelerating. Recommend reducing throttle."
        elif trend == "degrading":
            response = f"Sir, engine shows DEGRADATION. {live} Monitor closely and prepare for emergency protocols."
        else:
            response = f"Sir, engine status is NOMINAL. {live} All parameters within limits."

    # Health query
    elif any(w in q for w in ["health", "hi", "score"]):
        h = ctx.get("health", "N/A")
        kb = KNOWLEDGE_BASE["health"]
        response = f"Engine Health Index is {h}/100. {kb}"

    # RUL / remaining life query
    elif any(w in q for w in ["rul", "remaining", "life", "time", "how long", "when will"]):
        r = ctx.get("rul", "N/A")
        trend = ctx.get("trend", "stable")
        kb = KNOWLEDGE_BASE["rul"]
        response = f"Remaining Useful Life is {r} hours. Trend: {trend}. {kb}"

    # Fault query
    elif any(w in q for w in ["fault", "problem", "issue", "wrong", "failing", "fail", "error"]):
        fault = ctx.get("fault", "none")
        factors = ctx.get("factors", [])
        kb = KNOWLEDGE_BASE["fault"]
        if fault and fault != "none":
            cause = ". ".join(factors[:2]) if factors else "Physics residuals indicate sensor deviation beyond normal thresholds."
            response = f"Active fault: {fault.replace('_', ' ').upper()}. Root cause — {cause}. {kb}"
        else:
            response = f"No active fault currently classified. {kb}"

    # Temperature query
    elif any(w in q for w in ["temperature", "cht", "egt", "hot", "heat", "overheat"]):
        response = f"{KNOWLEDGE_BASE['cht']} {KNOWLEDGE_BASE['egt']} Current readings: CHT={ctx.get('cht','N/A')}°C, EGT={ctx.get('egt','N/A')}°C."

    # Oil query
    elif any(w in q for w in ["oil", "lubrication", "pressure"]):
        response = f"{KNOWLEDGE_BASE['oil']} Current oil pressure: {ctx.get('oil_p','N/A')} kPa."

    # Override / action query
    elif any(w in q for w in ["override", "action", "do", "fix", "recover", "save", "intervention"]):
        response = KNOWLEDGE_BASE["override"]

    # Architecture query
    elif any(w in q for w in ["architecture", "how does", "system", "design", "built"]):
        response = KNOWLEDGE_BASE["architecture"]

    # DRDO / project query
    elif any(w in q for w in ["drdo", "sih", "project", "problem statement"]):
        response = KNOWLEDGE_BASE["drdo"]

    # Explainability
    elif any(w in q for w in ["why", "reason", "explain", "because", "cause"]):
        factors = ctx.get("factors", [])
        if factors:
            response = "Contributing factors identified by AI: " + "; ".join(factors[:3]) + "."
        else:
            response = "Insufficient data for causal analysis. Continue monitoring. The AI will update its explainability report with each new telemetry frame."

    # Recommendation
    elif any(w in q for w in ["recommend", "suggest", "should", "next step", "what to do"]):
        trend = ctx.get("trend", "stable")
        fault = ctx.get("fault", "none")
        if fault and fault != "none":
            response = f"RECOMMENDATION: {fault.replace('_',' ').upper()} detected. (1) Apply Emergency Override → Reduce Throttle. (2) Monitor CHT and EGT for response. (3) If health drops below 20, abort mission immediately and initiate forced landing."
        elif trend == "degrading":
            response = "RECOMMENDATION: Engine is degrading. (1) Reduce throttle by 15%. (2) Check oil pressure. (3) Prepare emergency landing coordinates."
        else:
            response = "Engine is nominal. No action required. Continue mission as planned."

    else:
        response = f"Commander, I understand your query. {KNOWLEDGE_BASE['drdo']} For specific data, ask about: health, RUL, fault status, temperature, oil pressure, or recommended actions."

    return {
        "response": response,
        "context": ctx,
        "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }


# ---------------------------------------------------------------------------
# GET /missions/{mission_id}/timeline
# ---------------------------------------------------------------------------

@app.get("/missions/{mission_id}/timeline", tags=["missions"])
def get_mission_timeline(mission_id: str):
    """
    Returns a chronologically sorted list of events for the mission.
    Includes mission start and active alerts.
    """
    timeline = db.get_mission_timeline(mission_id)
    return {"events": timeline}
