"""
alerts.py — REST routes for active alerts and health index.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from app import db
from app.models import AlertRecord, HealthIndex

router = APIRouter()


@router.get("", response_model=list[AlertRecord])
async def get_alerts(limit: int = 20):
    """Return the most recent `limit` alert records."""
    rows = await db.fetch_latest_alerts(limit=limit)
    return rows


@router.get("/health-index", response_model=HealthIndex)
async def get_health_index():
    """
    Compute a simple health index from the most recent alert confidence.

    TODO (ML team): replace this heuristic with a proper degradation model
    based on the RUL estimate and anomaly score.
    """
    alerts = await db.fetch_latest_alerts(limit=5)

    if not alerts:
        score = 100.0
        status = "nominal"
    else:
        # Use the highest confidence alert in the last 5
        max_conf = max(a.get("confidence", 0.0) for a in alerts)
        score = round(max(0.0, 100.0 - max_conf * 100), 1)
        if score >= 80:
            status = "nominal"
        elif score >= 50:
            status = "degraded"
        else:
            status = "critical"

    return HealthIndex(
        score=score,
        status=status,
        updated_at=datetime.now(timezone.utc),
    )
