"""
Dropout handler for telemetry frames.

Detects and fills missing frames using:
  1. Forward fill (LOCF) for short gaps (≤ 3 missing frames)
  2. Linear interpolation for longer gaps (up to 30 frames)
  3. Marks filled frames with an optional _interpolated flag

A frame is considered missing/dropped if the timestamp gap exceeds
1.5× the expected inter-frame interval.

Assumption: frame Hz is inferred from the mission profile's frame_hz
field if present in the frame's metadata, or defaulted to 1.0 Hz.
"""

import copy
from datetime import datetime, timezone
from typing import Optional


def _parse_ts(ts: str) -> datetime:
    """Parse ISO 8601 timestamp string to datetime."""
    # Handle both 'Z' suffix and '+00:00'
    ts = ts.rstrip("Z")
    if "." in ts:
        return datetime.fromisoformat(ts).replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(ts + ".000000").replace(tzinfo=timezone.utc)


def _lerp(a: float, b: float, t: float) -> float:
    """Linear interpolation between a and b at fraction t."""
    return a + (b - a) * t


def _lerp_frame(frame_a: dict, frame_b: dict, t: float) -> dict:
    """Create an interpolated frame between frame_a and frame_b at fraction t."""
    numeric_fields = [
        "rpm", "cht_c", "egt_c", "oil_pressure_kpa", "oil_temp_c",
        "fuel_flow_lph", "vibration_g", "battery_voltage_v",
        "alternator_current_a", "injection_timing_deg",
        "altitude_m", "ambient_temp_c", "throttle_pct",
    ]
    result = copy.deepcopy(frame_a)
    for f in numeric_fields:
        if f in frame_a and f in frame_b:
            result[f] = round(_lerp(float(frame_a[f]), float(frame_b[f]), t), 4)
    result["_interpolated"] = True
    return result


class DropoutHandler:
    """
    Processes a sequence of telemetry frames and fills gaps.

    Usage:
        handler = DropoutHandler(expected_hz=1.0, max_interpolate_gap=30)
        filled_frames = handler.fill_gaps(frames)
    """

    def __init__(
        self,
        expected_hz: float = 1.0,
        max_interpolate_gap: int = 30,
        locf_gap: int = 3,
    ):
        self._dt_s = 1.0 / expected_hz   # expected inter-frame interval in seconds
        self._max_gap = max_interpolate_gap
        self._locf_gap = locf_gap

    def fill_gaps(self, frames: list[dict]) -> list[dict]:
        """
        Process a list of frames and return a filled list.
        Input frames must be in timestamp order.
        """
        if not frames:
            return []

        result = [frames[0]]
        last = frames[0]

        for i in range(1, len(frames)):
            curr = frames[i]
            ts_last = _parse_ts(last["timestamp"])
            ts_curr = _parse_ts(curr["timestamp"])
            gap_s = (ts_curr - ts_last).total_seconds()
            expected_gap = self._dt_s
            missing_count = max(0, round(gap_s / expected_gap) - 1)

            if missing_count == 0:
                result.append(curr)
            elif missing_count <= self._locf_gap:
                # Forward fill with last known frame
                for j in range(missing_count):
                    filled = copy.deepcopy(last)
                    filled["_interpolated"] = True
                    filled["_dropout_fill"] = "locf"
                    result.append(filled)
                result.append(curr)
            elif missing_count <= self._max_gap:
                # Linear interpolation
                for j in range(1, missing_count + 1):
                    t = j / (missing_count + 1)
                    filled = _lerp_frame(last, curr, t)
                    filled["_dropout_fill"] = "linear"
                    result.append(filled)
                result.append(curr)
            else:
                # Too large a gap — just append current, mark as gap
                curr["_gap_detected"] = True
                result.append(curr)

            last = curr

        return result
