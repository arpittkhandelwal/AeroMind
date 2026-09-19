"""
models.py
=========
Pydantic v2 models shared across the backend service.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TelemetryRecord(BaseModel):
    """One row from the `telemetry` hypertable."""

    timestamp:    datetime
    rpm:          float
    egt:          float
    cht:          float
    oil_pressure: float
    oil_temp:     float
    fuel_flow:    float
    vibration:    float
    altitude:     float
    ambient_temp: float
    fault_label:  Optional[str] = None


class AlertRecord(BaseModel):
    """One row from the `alerts` table."""

    id:                 Optional[int] = None
    timestamp:          datetime
    fault_type:         str
    confidence:         float = Field(ge=0.0, le=1.0)
    rul_hours:          Optional[float] = None
    shap_top_features:  list[str] = Field(default_factory=list)


class HealthIndex(BaseModel):
    """Derived health score 0–100 sent to the dashboard."""

    score:      float = Field(ge=0.0, le=100.0)
    status:     str              # "nominal" | "degraded" | "critical"
    updated_at: datetime
