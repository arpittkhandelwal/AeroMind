"""
Pydantic models for the backend API.

These mirror the shapes defined in contracts/api_spec.yaml and contracts/telemetry_schema.json.
Used for request validation and response serialization.
"""

from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class FaultType(str, Enum):
    misfire = "misfire"
    injector_fault = "injector_fault"
    sensor_drift = "sensor_drift"
    overheating = "overheating"
    combustion_instability = "combustion_instability"
    lubrication_issue = "lubrication_issue"
    abnormal_vibration = "abnormal_vibration"


class FaultLabel(str, Enum):
    null = "null"
    none = "none"
    misfire = "misfire"
    injector_fault = "injector_fault"
    sensor_drift = "sensor_drift"
    overheating = "overheating"
    combustion_instability = "combustion_instability"
    lubrication_issue = "lubrication_issue"
    abnormal_vibration = "abnormal_vibration"


class Severity(str, Enum):
    info = "info"
    warning = "warning"
    critical = "critical"


class DegradationTrend(str, Enum):
    stable = "stable"
    degrading = "degrading"
    critical = "critical"


class MissionProfile(str, Enum):
    high_altitude = "high_altitude"
    endurance = "endurance"
    hot_weather = "hot_weather"
    rapid_throttle = "rapid_throttle"
    nominal = "nominal"


# ---- Telemetry Frame (matches telemetry_schema.json) ----

class TelemetryFrame(BaseModel):
    timestamp: str
    mission_id: str
    rpm: float = Field(ge=0, le=8000)
    cht_c: float
    egt_c: float
    oil_pressure_kpa: float
    oil_temp_c: float
    fuel_flow_lph: float
    vibration_g: float
    battery_voltage_v: float
    alternator_current_a: Optional[float] = None
    injection_timing_deg: float
    altitude_m: float
    ambient_temp_c: float
    throttle_pct: float = Field(ge=0, le=100)
    fault_label: Optional[str] = None

    class Config:
        use_enum_values = True


# ---- Alert (matches api_spec.yaml Alert schema) ----

class Alert(BaseModel):
    fault_type: str
    severity: str
    detected_at: str
    message: str
    recommended_action: str


# ---- RUL Response ----

class RULResponse(BaseModel):
    rul_hours: float
    confidence: float = Field(ge=0, le=1)
    degradation_trend: str
    contributing_factors: List[str] = []


# ---- Latest Telemetry Response ----

class LatestTelemetryResponse(BaseModel):
    frame: TelemetryFrame
    health_index: float = Field(ge=0, le=100)
    active_alerts: List[Alert] = []
    expected_physics: Optional[dict] = None
    physics_residuals: Optional[dict] = None
    engine_efficiency_pct: Optional[float] = None


# ---- Mission List Item ----

class MissionListItem(BaseModel):
    mission_id: str
    profile: str
    started_at: str
    duration_min: Optional[float] = None


# ---- Simulation Start Request ----

class SimulationStartRequest(BaseModel):
    profile: str = "nominal"
    fault: str = "none"
    speedup: int = 20
    mission_id: Optional[str] = None
