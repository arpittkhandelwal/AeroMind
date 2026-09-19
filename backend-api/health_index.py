"""
Health Index formula for the UAV Engine Digital Twin.

The Health Index (HI) is a scalar value in [0, 100] representing the
overall condition of the engine at a given moment.

  HI = 100 (perfect health) → 0 (imminent failure)

Formula:
  HI = 100
     - w_anomaly  × normalize(anomaly_score) × 100
     - w_fault    × fault_severity_penalty
     - w_rul      × rul_depletion × 100
     - w_trend    × degradation_penalty

Weights (sum to 1.0):
  w_anomaly = 0.35   (physics residual — direct sensor evidence)
  w_fault   = 0.30   (detected fault severity — ML classification output)
  w_rul     = 0.20   (RUL depletion relative to TBO)
  w_trend   = 0.15   (degradation trend trajectory)

Severity penalties (w_fault component):
  none     →   0
  info     →  10
  warning  →  25
  critical →  60   ← much stronger to ensure failure is visible

Degradation trend penalties (w_trend component):
  stable    →  0
  degrading → 15
  critical  → 35

RUL depletion:
  (1 - rul_hours / max_rul_hours) ∈ [0, 1]
  max_rul_hours = 200h (practical TBO for this prototype)
  Using 200 rather than 500 gives a more dramatic and visible RUL drop
  during demo missions.

The formula is intentionally transparent and documented here so operators
can understand why the score changes.
"""

MAX_RUL_HOURS = 200.0   # practical TBO for demo visibility

W_ANOMALY = 0.25
W_FAULT   = 0.50
W_RUL     = 0.15
W_TREND   = 0.10

SEVERITY_PENALTY = {
    None:       0,
    "none":     0,
    "info":    10,
    "warning": 25,
    "critical": 100,  # Max penalty ensures massive HI drop
}

TREND_PENALTY = {
    None:        0,
    "stable":    0,
    "degrading": 15,
    "critical":  50,
}


def compute_health_index(
    anomaly_score: float,           # [0, 1]
    active_severity: str | None,    # 'info', 'warning', 'critical', or None
    rul_hours: float,               # estimated remaining useful life
    degradation_trend: str | None,  # 'stable', 'degrading', 'critical'
    mission_elapsed: float = 0.0,   # fraction of mission elapsed [0, 1]
) -> float:
    """
    Compute the Health Index (0-100).

    Args:
        anomaly_score:      normalized anomaly score from IsolationForest [0, 1]
        active_severity:    severity of the most severe active alert
        rul_hours:          RUL in hours from RUL estimator
        degradation_trend:  trend label from RUL estimator
        mission_elapsed:    fraction of mission elapsed (0=start, 1=end)

    Returns:
        Health index as float in [0.0, 100.0]
    """
    # Anomaly component: 0 when healthy, up to 35 points deducted
    anomaly_component = W_ANOMALY * float(anomaly_score) * 100

    # Fault severity component: penalty scales to 0-100 then weighted
    fault_penalty = SEVERITY_PENALTY.get(active_severity, 0)
    fault_component = W_FAULT * (fault_penalty / 100.0) * 100

    # RUL depletion component
    rul_depletion = 1.0 - max(0.0, min(rul_hours, MAX_RUL_HOURS)) / MAX_RUL_HOURS
    rul_component = W_RUL * rul_depletion * 100

    # Degradation trend component
    trend_penalty = TREND_PENALTY.get(degradation_trend, 0)
    trend_component = W_TREND * (trend_penalty / 50.0) * 100

    hi = 100.0 - anomaly_component - fault_component - rul_component - trend_component

    return round(max(0.0, min(100.0, hi)), 1)
