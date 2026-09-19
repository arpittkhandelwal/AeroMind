"""
db.py
=====
TimescaleDB connection pool (asyncpg) and schema helpers.

Usage::
    from app.db import get_pool, insert_telemetry, insert_alert

Call :func:`init_pool` once at startup (inside FastAPI lifespan).
"""

from __future__ import annotations

import logging
import os
from typing import Any

import asyncpg

logger = logging.getLogger(__name__)

_pool: asyncpg.Pool | None = None


def _dsn() -> str:
    return (
        f"postgresql://{os.getenv('POSTGRES_USER', 'digital_twin')}"
        f":{os.getenv('POSTGRES_PASSWORD', 'changeme_hackathon')}"
        f"@{os.getenv('TIMESCALE_HOST', 'timescaledb')}"
        f":{os.getenv('TIMESCALE_PORT', '5432')}"
        f"/{os.getenv('POSTGRES_DB', 'engine_db')}"
    )


async def init_pool() -> None:
    global _pool
    logger.info("Connecting to TimescaleDB …")
    _pool = await asyncpg.create_pool(_dsn(), min_size=2, max_size=10)
    logger.info("DB pool ready")


async def close_pool() -> None:
    if _pool:
        await _pool.close()


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool not initialised — call init_pool() first")
    return _pool


# ---------------------------------------------------------------------------
# Write helpers
# ---------------------------------------------------------------------------


async def insert_telemetry(row: dict[str, Any]) -> None:
    """Insert one telemetry record into the hypertable."""
    pool = get_pool()
    await pool.execute(
        """
        INSERT INTO telemetry
            (timestamp, rpm, egt, cht, oil_pressure, oil_temp,
             fuel_flow, vibration, altitude, ambient_temp, fault_label)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        """,
        row["timestamp"],
        row["rpm"],
        row["egt"],
        row["cht"],
        row["oil_pressure"],
        row["oil_temp"],
        row["fuel_flow"],
        row["vibration"],
        row["altitude"],
        row["ambient_temp"],
        row.get("fault_label"),
    )


async def insert_alert(row: dict[str, Any]) -> None:
    """Insert one alert record."""
    import json as _json

    pool = get_pool()
    await pool.execute(
        """
        INSERT INTO alerts (timestamp, fault_type, confidence, rul_hours, shap_top_features)
        VALUES ($1, $2, $3, $4, $5)
        """,
        row["timestamp"],
        row["fault_type"],
        row.get("confidence", 0.0),
        row.get("rul_hours"),
        _json.dumps(row.get("shap_top_features", [])),
    )


# ---------------------------------------------------------------------------
# Read helpers
# ---------------------------------------------------------------------------


async def fetch_latest_telemetry() -> dict | None:
    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM telemetry ORDER BY timestamp DESC LIMIT 1"
    )
    return dict(row) if row else None


async def fetch_telemetry_range(from_ts: str, to_ts: str) -> list[dict]:
    pool = get_pool()
    rows = await pool.fetch(
        "SELECT * FROM telemetry WHERE timestamp BETWEEN $1 AND $2 ORDER BY timestamp ASC",
        from_ts,
        to_ts,
    )
    return [dict(r) for r in rows]


async def fetch_latest_alerts(limit: int = 20) -> list[dict]:
    pool = get_pool()
    rows = await pool.fetch(
        "SELECT * FROM alerts ORDER BY timestamp DESC LIMIT $1",
        limit,
    )
    return [dict(r) for r in rows]
