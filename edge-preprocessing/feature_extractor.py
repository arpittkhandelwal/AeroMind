"""
Feature extractor for edge-preprocessed telemetry frames.

Extracts rolling statistical features from a sliding window of frames:
  - Rolling standard deviation (noise / volatility indicator)
  - Rate of change (delta per second — trend indicator)
  - Rolling minimum and maximum (range indicator)

Features are computed for the key engine parameters and returned as a
flat "features" dict appended to each frame.

Output feature naming convention:
  {field}_{stat}   e.g.  rpm_rolling_std, cht_c_rolling_roc,
                          oil_pressure_kpa_rolling_min, etc.

These features are the primary input for the ML fault classifier.
"""

from collections import deque
from typing import Optional

# Fields for which features are extracted
FEATURE_FIELDS = [
    "rpm",
    "cht_c",
    "egt_c",
    "oil_pressure_kpa",
    "oil_temp_c",
    "fuel_flow_lph",
    "vibration_g",
    "battery_voltage_v",
    "alternator_current_a",
    "injection_timing_deg",
    "throttle_pct",
    "altitude_m",
]


class FeatureExtractor:
    """
    Computes rolling statistical features over a sliding window.

    Args:
        window_size: number of frames in the rolling window (default 30s at 1Hz)
        frame_dt_s: inter-frame interval in seconds (default 1.0)
    """

    def __init__(self, window_size: int = 30, frame_dt_s: float = 1.0):
        self._window = window_size
        self._dt = frame_dt_s
        self._buffers: dict[str, deque] = {
            f: deque(maxlen=window_size) for f in FEATURE_FIELDS
        }

    def extract(self, frame: dict) -> dict:
        """
        Update rolling buffers with the current frame and return the features dict.

        Returns:
            dict with rolling statistics for all feature fields
        """
        # Push current values into buffers
        for field in FEATURE_FIELDS:
            if field in frame and frame[field] is not None:
                try:
                    self._buffers[field].append(float(frame[field]))
                except (TypeError, ValueError):
                    pass

        features = {}

        for field in FEATURE_FIELDS:
            buf = list(self._buffers[field])
            n = len(buf)

            if n < 2:
                # Not enough data yet — fill with zeros
                features[f"{field}_rolling_std"] = 0.0
                features[f"{field}_rolling_roc"] = 0.0
                features[f"{field}_rolling_min"] = buf[0] if n == 1 else 0.0
                features[f"{field}_rolling_max"] = buf[0] if n == 1 else 0.0
                continue

            # Rolling std
            mean = sum(buf) / n
            variance = sum((x - mean) ** 2 for x in buf) / (n - 1)
            rolling_std = variance ** 0.5

            # Rate of change: (last - first) / (window_duration_s)
            window_duration = (n - 1) * self._dt
            rolling_roc = (buf[-1] - buf[0]) / max(window_duration, 1e-9)

            # Min / Max
            rolling_min = min(buf)
            rolling_max = max(buf)

            features[f"{field}_rolling_std"] = round(rolling_std, 6)
            features[f"{field}_rolling_roc"] = round(rolling_roc, 6)
            features[f"{field}_rolling_min"] = round(rolling_min, 4)
            features[f"{field}_rolling_max"] = round(rolling_max, 4)

        return features

    def reset(self) -> None:
        for buf in self._buffers.values():
            buf.clear()
