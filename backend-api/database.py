"""
SQLite database initialization and access for the UAV Digital Twin backend.

Schema: contracts/db_schema.sql
  - missions
  - telemetry_frames
  - alerts
  - rul_estimates

Assumptions:
  - SQLite file lives at backend-api/digital_twin.db
  - DB is initialized on first startup via init_db()
  - All queries use parameterized placeholders (SQL injection safe)
"""

import os
import sqlite3
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "digital_twin.db")
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "..", "contracts", "db_schema.sql")


def get_connection() -> sqlite3.Connection:
    """Open a new SQLite connection with row_factory for dict-like access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")  # concurrent read performance
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def db_conn():
    """Context manager for auto-commit/rollback transactions."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    """Initialize the database schema from contracts/db_schema.sql."""
    with open(SCHEMA_PATH) as f:
        schema_sql = f.read()

    with db_conn() as conn:
        conn.executescript(schema_sql)

    print(f"[DB] Initialized database at {DB_PATH}")


# ---------------------------------------------------------------------------
# Mission CRUD
# ---------------------------------------------------------------------------

def upsert_mission(mission_id: str, profile: str, started_at: str) -> None:
    with db_conn() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO missions (mission_id, profile, started_at) VALUES (?, ?, ?)",
            (mission_id, profile, started_at),
        )


def end_mission(mission_id: str, ended_at: str, duration_min: float) -> None:
    with db_conn() as conn:
        conn.execute(
            "UPDATE missions SET ended_at=?, duration_min=? WHERE mission_id=?",
            (ended_at, duration_min, mission_id),
        )


def list_missions() -> list[dict]:
    with db_conn() as conn:
        rows = conn.execute(
            "SELECT mission_id, profile, started_at, ended_at, duration_min FROM missions ORDER BY started_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def get_mission(mission_id: str) -> dict | None:
    with db_conn() as conn:
        row = conn.execute(
            "SELECT * FROM missions WHERE mission_id=?", (mission_id,)
        ).fetchone()
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# Telemetry frame CRUD
# ---------------------------------------------------------------------------

def insert_frame(mission_id: str, frame: dict) -> None:
    with db_conn() as conn:
        conn.execute(
            """INSERT INTO telemetry_frames
               (mission_id, timestamp, rpm, cht_c, egt_c, oil_pressure_kpa,
                oil_temp_c, fuel_flow_lph, vibration_g, battery_voltage_v,
                alternator_current_a, injection_timing_deg, altitude_m,
                ambient_temp_c, throttle_pct, fault_label)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                mission_id,
                frame.get("timestamp"),
                frame.get("rpm"),
                frame.get("cht_c"),
                frame.get("egt_c"),
                frame.get("oil_pressure_kpa"),
                frame.get("oil_temp_c"),
                frame.get("fuel_flow_lph"),
                frame.get("vibration_g"),
                frame.get("battery_voltage_v"),
                frame.get("alternator_current_a"),
                frame.get("injection_timing_deg"),
                frame.get("altitude_m"),
                frame.get("ambient_temp_c"),
                frame.get("throttle_pct"),
                frame.get("fault_label"),
            ),
        )


def get_latest_frame(mission_id: str) -> dict | None:
    with db_conn() as conn:
        row = conn.execute(
            """SELECT * FROM telemetry_frames
               WHERE mission_id=?
               ORDER BY timestamp DESC LIMIT 1""",
            (mission_id,),
        ).fetchone()
    return dict(row) if row else None


def get_mission_frames(mission_id: str) -> list[dict]:
    with db_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM telemetry_frames WHERE mission_id=? ORDER BY timestamp",
            (mission_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def count_frames(mission_id: str) -> int:
    with db_conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) as n FROM telemetry_frames WHERE mission_id=?", (mission_id,)
        ).fetchone()
    return row["n"] if row else 0


# ---------------------------------------------------------------------------
# Alert CRUD
# ---------------------------------------------------------------------------

def insert_alert(mission_id: str, alert: dict) -> None:
    with db_conn() as conn:
        conn.execute(
            """INSERT INTO alerts (mission_id, fault_type, severity, detected_at, message, recommended_action)
               VALUES (?,?,?,?,?,?)""",
            (
                mission_id,
                alert["fault_type"],
                alert["severity"],
                alert["detected_at"],
                alert.get("message", ""),
                alert.get("recommended_action", ""),
            ),
        )


def get_alerts(mission_id: str) -> list[dict]:
    with db_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM alerts WHERE mission_id=? ORDER BY detected_at DESC",
            (mission_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def insert_override_event(mission_id: str, timestamp: str, action: str, value: float, operator_id: str = "operator") -> None:
    with db_conn() as conn:
        conn.execute("INSERT INTO override_events (mission_id, timestamp, action, value, operator_id) VALUES (?,?,?,?,?)", (mission_id, timestamp, action, value, operator_id))


def get_override_events(mission_id: str) -> list[dict]:
    with db_conn() as conn:
        rows = conn.execute("SELECT timestamp, action, value, operator_id FROM override_events WHERE mission_id=? ORDER BY timestamp", (mission_id,)).fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# RUL estimate CRUD
# ---------------------------------------------------------------------------

def insert_rul(mission_id: str, timestamp: str, rul: dict, contributing_factors: list) -> None:
    import json
    with db_conn() as conn:
        conn.execute(
            """INSERT INTO rul_estimates
               (mission_id, timestamp, rul_hours, confidence, degradation_trend, contributing_factors)
               VALUES (?,?,?,?,?,?)""",
            (
                mission_id,
                timestamp,
                rul.get("rul_hours"),
                rul.get("confidence"),
                rul.get("degradation_trend"),
                json.dumps(contributing_factors),
            ),
        )


def get_latest_rul(mission_id: str) -> dict | None:
    import json
    with db_conn() as conn:
        row = conn.execute(
            """SELECT * FROM rul_estimates WHERE mission_id=?
               ORDER BY timestamp DESC LIMIT 1""",
            (mission_id,),
        ).fetchone()
    if not row:
        return None
    result = dict(row)
    try:
        result["contributing_factors"] = json.loads(result.get("contributing_factors") or "[]")
    except Exception:
        result["contributing_factors"] = []
    return result


def get_rul_history(mission_id: str, limit: int = 50) -> list[dict]:
    with db_conn() as conn:
        rows = conn.execute(
            """SELECT * FROM rul_estimates WHERE mission_id=?
               ORDER BY timestamp DESC LIMIT ?""",
            (mission_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Timeline CRUD
# ---------------------------------------------------------------------------

def get_mission_timeline(mission_id: str) -> list[dict]:
    """
    Returns a chronologically sorted list of events for the mission.
    Includes:
      - Mission start
      - Alerts
    """
    events = []
    
    with db_conn() as conn:
        # 1. Mission start
        mission = conn.execute("SELECT * FROM missions WHERE mission_id=?", (mission_id,)).fetchone()
        if mission:
            events.append({
                "type": "mission_started",
                "timestamp": mission["started_at"],
                "message": f"Mission Started ({mission['profile']})",
                "severity": "info"
            })
            
        # 2. Alerts
        alerts = conn.execute("SELECT * FROM alerts WHERE mission_id=? ORDER BY detected_at", (mission_id,)).fetchall()
        for alert in alerts:
            events.append({
                "type": "alert",
                "timestamp": alert["detected_at"],
                "message": alert["message"],
                "fault_type": alert["fault_type"],
                "severity": alert["severity"]
            })
            
    # Sort events chronologically
    events.sort(key=lambda x: x["timestamp"])
    return events
