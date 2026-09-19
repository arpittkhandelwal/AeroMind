"""
Rolling smoother that attenuates noise while preserving real transients.

Strategy:
  1. Exponential Moving Average (EMA) for fast, low-lag smoothing
  2. Transient detection: if |x_t - x_{t-1}| > k * rolling_std, treat as real event
     and reduce smoothing weight so the transient passes through.

Numeric fields smoothed: rpm, cht_c, egt_c, oil_pressure_kpa, oil_temp_c,
                          fuel_flow_lph, vibration_g, battery_voltage_v,
                          alternator_current_a, injection_timing_deg

Fields NOT smoothed (pass through as-is):
  timestamp, mission_id, altitude_m, ambient_temp_c, throttle_pct,
  fault_label (label preservation is critical for supervised learning)
"""

from collections import deque
from typing import Optional

# Fields to smooth and their per-field alpha (EMA decay factor).
# Slower signals get higher alpha (more smoothing), faster signals lower alpha.
# alpha=1.0 means no smoothing (pass-through).
SMOOTH_CONFIG = {
    "rpm":                  {"alpha": 0.15, "transient_k": 3.0},
    "cht_c":                {"alpha": 0.08, "transient_k": 4.0},   # slow thermal
    "egt_c":                {"alpha": 0.10, "transient_k": 3.5},
    "oil_pressure_kpa":     {"alpha": 0.12, "transient_k": 4.0},
    "oil_temp_c":           {"alpha": 0.06, "transient_k": 5.0},   # very slow
    "fuel_flow_lph":        {"alpha": 0.15, "transient_k": 3.0},
    "vibration_g":          {"alpha": 0.20, "transient_k": 2.5},   # fast signal
    "battery_voltage_v":    {"alpha": 0.20, "transient_k": 4.0},
    "alternator_current_a": {"alpha": 0.18, "transient_k": 3.5},
    "injection_timing_deg": {"alpha": 0.15, "transient_k": 3.0},
}

PASS_THROUGH_FIELDS = {
    "timestamp", "mission_id", "altitude_m", "ambient_temp_c",
    "throttle_pct", "fault_label",
}


class RollingFilter:
    """
    Maintains EMA state and rolling std buffer per smoothed field.

    Args:
        std_window: window size for computing rolling std (for transient detection)
    """

    def __init__(self, std_window: int = 20):
        self._ema: dict[str, Optional[float]] = {k: None for k in SMOOTH_CONFIG}
        self._history: dict[str, deque] = {
            k: deque(maxlen=std_window) for k in SMOOTH_CONFIG
        }
        self._std_window = std_window

    def filter_frame(self, frame: dict) -> dict:
        """
        Apply smoothing to a single frame. Returns a new dict with smoothed values.
        Pass-through fields are copied unchanged.
        """
        result = {}

        # Copy pass-through fields
        for f in PASS_THROUGH_FIELDS:
            if f in frame:
                result[f] = frame[f]

        # Also pass through any unknown fields
        for k, v in frame.items():
            if k not in SMOOTH_CONFIG and k not in result:
                result[k] = v

        # Smooth each configured field
        for field, cfg in SMOOTH_CONFIG.items():
            if field not in frame:
                continue

            raw = float(frame[field])
            alpha = cfg["alpha"]
            k_thresh = cfg["transient_k"]
            history = self._history[field]

            # Compute rolling std from recent history
            if len(history) >= 3:
                import statistics
                rolling_std = statistics.stdev(history)
            else:
                rolling_std = float("inf")   # no threshold until we have history

            # Transient detection: if jump > k * rolling_std → pass through
            if self._ema[field] is None:
                smoothed = raw
            else:
                delta = abs(raw - self._ema[field])
                if rolling_std > 0 and delta > k_thresh * rolling_std:
                    # Real transient — use lower smoothing to let it through
                    effective_alpha = min(0.8, alpha * 4)
                else:
                    effective_alpha = alpha
                smoothed = effective_alpha * raw + (1 - effective_alpha) * self._ema[field]

            self._ema[field] = smoothed
            history.append(raw)   # track raw for std computation
            result[field] = round(smoothed, 4)

        return result

    def reset(self) -> None:
        for k in SMOOTH_CONFIG:
            self._ema[k] = None
            self._history[k].clear()
