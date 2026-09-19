"""
telemetry.py — REST routes for telemetry history and mission replay.
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Query, HTTPException

from app import db
from app.models import TelemetryRecord

router = APIRouter()


@router.get("/latest", response_model=TelemetryRecord | None)
async def get_latest_telemetry():
    """Return the most recent telemetry row from TimescaleDB."""
    row = await db.fetch_latest_telemetry()
    if row is None:
        raise HTTPException(status_code=404, detail="No telemetry recorded yet")
    return row


@router.get("/history", response_model=list[TelemetryRecord])
async def get_telemetry_history(
    from_ts: Optional[str] = Query(
        default=None,
        alias="from",
        description="ISO8601 start timestamp (defaults to 1 hour ago)",
    ),
    to_ts: Optional[str] = Query(
        default=None,
        alias="to",
        description="ISO8601 end timestamp (defaults to now)",
    ),
):
    """
    Return telemetry rows in [from, to].
    Used by the Mission Replay module.
    """
    now = datetime.now(timezone.utc)
    start = from_ts or (now - timedelta(hours=1)).isoformat()
    end = to_ts or now.isoformat()

    rows = await db.fetch_telemetry_range(start, end)
    return rows
