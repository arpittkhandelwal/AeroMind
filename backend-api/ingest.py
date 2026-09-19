"""
Telemetry ingestion pipeline for the backend API.

Receives a raw telemetry frame from /telemetry/ingest, runs:
  1. Edge preprocessing (dropout + filter + feature extraction)
  2. Physics model expected value prediction
  3. ML inference (anomaly, fault, RUL)
  4. Health index computation
  5. DB persistence (frame, alert if any, RUL estimate)

Returns the full analysis result for the latest telemetry response.
"""

import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "edge-preprocessing"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ml-fault-rul"))

from preprocessor import Preprocessor
from serve import get_service
from health_index import compute_health_index
import database as db

# Per-mission preprocessors (maintain rolling state)
_preprocessors: dict[str, Preprocessor] = {}
# Per-mission frame counter (for mission_elapsed estimate)
_frame_counts: dict[str, int] = {}

# Profile-specific frame counts for accurate mission_elapsed calculation.
# Based on duration_min × frame_hz from profiles.py.
# Assumption: 1 Hz for all profiles except rapid_throttle (2 Hz).
PROFILE_TOTAL_FRAMES = {
    "nominal":       3600,    # 60 min × 1 Hz
    "high_altitude": 5400,    # 90 min × 1 Hz
    "endurance":     10800,   # 180 min × 1 Hz
    "hot_weather":   3600,    # 60 min × 1 Hz
    "rapid_throttle": 5400,   # 45 min × 2 Hz
}
DEFAULT_TOTAL_FRAMES = 3600


def get_preprocessor(mission_id: str) -> Preprocessor:
    if mission_id not in _preprocessors:
        _preprocessors[mission_id] = Preprocessor(expected_hz=1.0)
    return _preprocessors[mission_id]


def ingest_frame(raw_frame: dict) -> dict:
    """
    Full ingestion pipeline for one telemetry frame.

    Returns:
        dict with keys: frame, health_index, active_alerts, rul, contributing_factors
    """
    mission_id = raw_frame.get("mission_id", "unknown")

    # --- Ensure mission record exists ---
    existing = db.get_mission(mission_id)
    if not existing:
        # Auto-create mission record on first frame
        profile = _infer_profile(raw_frame)
        db.upsert_mission(mission_id, profile, raw_frame.get("timestamp", ""))
    else:
        profile = existing["profile"] if isinstance(existing, dict) else "nominal"

    # --- Track frame count and compute accurate mission_elapsed ---
    count = _frame_counts.get(mission_id, 0)
    _frame_counts[mission_id] = count + 1
    total_frames = PROFILE_TOTAL_FRAMES.get(profile, DEFAULT_TOTAL_FRAMES)
    mission_elapsed = min(1.0, count / total_frames)

    # --- Edge preprocessing ---
    pp = get_preprocessor(mission_id)
    processed = pp.process(raw_frame)

    # --- Persist raw frame ---
    db.insert_frame(mission_id, raw_frame)

    # --- ML inference ---
    ml_service = get_service()
    analysis = ml_service.analyze(processed, mission_elapsed=mission_elapsed)

    # --- Health index ---
    active_severity = None
    active_alerts = []
    alert = analysis.get("alert")
    if alert:
        active_severity = alert["severity"]
        active_alerts.append(alert)
        # Persist alert
        db.insert_alert(mission_id, alert)

    rul_data = analysis.get("rul", {})
    hi = compute_health_index(
        anomaly_score=analysis.get("anomaly_score", 0.0),
        active_severity=active_severity,
        rul_hours=rul_data.get("rul_hours", 500.0),
        degradation_trend=rul_data.get("degradation_trend", "stable"),
        mission_elapsed=mission_elapsed,
    )

    # --- Persist RUL estimate ---
    ts = raw_frame.get("timestamp", datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
    db.insert_rul(
        mission_id=mission_id,
        timestamp=ts,
        rul=rul_data,
        contributing_factors=analysis.get("contributing_factors", []),
    )

    return {
        "frame": processed,
        "health_index": hi,
        "active_alerts": active_alerts,
        "rul": rul_data,
        "contributing_factors": analysis.get("contributing_factors", []),
        "expected_physics": analysis.get("expected_physics", {}),
        "physics_residuals": analysis.get("physics_residuals", {}),
    }


def _infer_profile(frame: dict) -> str:
    """Infer mission profile from telemetry characteristics. Defaults to 'nominal'."""
    alt = float(frame.get("altitude_m", 1500))
    temp = float(frame.get("ambient_temp_c", 25))
    rpm = float(frame.get("rpm", 5000))
    throttle = float(frame.get("throttle_pct", 65))
    if alt > 4000:
        return "high_altitude"
    elif temp > 40:
        return "hot_weather"
    elif throttle < 55 and rpm < 4500:
        return "endurance"
    elif throttle > 85 or rpm > 6200:
        return "rapid_throttle"
    else:
        return "nominal"
