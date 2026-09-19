"""
Live streaming generator — yields frames at real-time cadence.
Useful for demo and backend ingestion. Can optionally push frames
to a callback or HTTP endpoint.

Usage:
  python streamer.py --profile nominal --fault overheating --endpoint http://localhost:8000/telemetry/ingest
  python streamer.py --profile rapid_throttle   # no fault, prints to stdout
"""

import argparse
import json
import os
import sys
import time
from typing import Optional

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

from generator import make_generator


def _apply_operator_override(frame: dict, override: dict | None) -> dict:
    """Apply a safety action to subsequent simulated telemetry frames."""
    if not override or not override.get("action"):
        return frame
    action = override["action"]
    if action == "reduce_throttle":
        frame["throttle_pct"] = max(35.0, float(frame["throttle_pct"]) - 20.0)
        frame["rpm"] *= 0.90
        frame["cht_c"] -= 18.0
        frame["egt_c"] -= 14.0
    elif action == "engage_cooling":
        frame["cht_c"] -= 32.0
        frame["oil_temp_c"] -= 12.0
        frame["oil_pressure_kpa"] += 10.0
    elif action == "reduce_rpm":
        frame["rpm"] *= 0.82
        frame["vibration_g"] *= 0.75
        frame["cht_c"] -= 10.0
    elif action == "abort":
        frame["throttle_pct"] = 0.0
        frame["rpm"] *= 0.35
        frame["fuel_flow_lph"] *= 0.25
    elif action == "throttle_burst":
        # Deliberate short-duration stress test: proves the twin responds to
        # an operator-driven transient rather than only scripted faults.
        frame["throttle_pct"] = 100.0
        frame["rpm"] = min(7800.0, frame["rpm"] * 1.18)
        frame["fuel_flow_lph"] *= 1.35
        frame["cht_c"] += 18.0
        frame["egt_c"] += 24.0
    frame["operator_override"] = action
    return frame


def stream_live(
    profile_name: str,
    fault_type: Optional[str] = None,
    fault_start_frac: float = 0.5,
    endpoint: Optional[str] = None,
    mission_id: Optional[str] = None,
    seed: int = 42,
    speedup: float = 1.0,
    max_frames: Optional[int] = None,
) -> None:
    """
    Stream telemetry frames in real time (or faster with speedup factor).

    Args:
        speedup: >1 means faster than real time (e.g., 10 = 10× speed)
    """
    gen = make_generator(
        profile_name=profile_name,
        fault_type=fault_type,
        fault_start_frac=fault_start_frac,
        mission_id=mission_id,
        seed=seed,
    )

    sleep_s = gen._dt / speedup
    sent = 0

    print(
        f"[streamer] Starting mission {gen.mission_id} | profile={profile_name} "
        f"| fault={fault_type or 'none'} | endpoint={endpoint or 'stdout'} "
        f"| total_frames={gen.total_frames} | speedup={speedup}x",
        file=sys.stderr,
    )

    for frame in gen.stream():
        if max_frames and sent >= max_frames:
            break

        line = json.dumps(frame)

        if endpoint:
            if not HAS_REQUESTS:
                print("[streamer] 'requests' not installed — falling back to stdout", file=sys.stderr)
                endpoint = None
            else:
                try:
                    base_url = endpoint.rsplit("/telemetry/ingest", 1)[0]
                    headers = {"X-API-Key": os.environ.get("UAV_API_KEY", "uav-dev-key-2026")}
                    override_response = requests.get(f"{base_url}/simulation/override/{gen.mission_id}", headers=headers, timeout=1.0)
                    override = override_response.json() if override_response.ok else None
                    frame = _apply_operator_override(frame, override)
                    r = requests.post(endpoint, json=frame, headers=headers, timeout=2.0)
                    if r.status_code != 200:
                        print(f"[streamer] WARN: ingest returned {r.status_code}", file=sys.stderr)
                except Exception as e:
                    print(f"[streamer] ERROR posting frame: {e}", file=sys.stderr)

        if not endpoint:
            print(line)

        sent += 1
        time.sleep(sleep_s)

    print(f"[streamer] Done. Sent {sent} frames.", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="Live telemetry streamer")
    parser.add_argument("--profile", default="nominal",
                        choices=["nominal", "high_altitude", "endurance", "hot_weather", "rapid_throttle"])
    parser.add_argument("--fault", default=None,
                        choices=[None, "misfire", "injector_fault", "sensor_drift",
                                 "overheating", "cooling_degradation", "combustion_instability",
                                 "lubrication_issue", "abnormal_vibration"])
    parser.add_argument("--fault-start", type=float, default=0.5,
                        help="Fraction into mission when fault starts (0-1)")
    parser.add_argument("--endpoint", default=None,
                        help="POST URL for /telemetry/ingest (e.g., http://localhost:8000/telemetry/ingest)")
    parser.add_argument("--mission-id", default=None)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--speedup", type=float, default=1.0,
                        help="Time speedup factor (default 1.0 = real time)")
    parser.add_argument("--max-frames", type=int, default=None)
    args = parser.parse_args()

    stream_live(
        profile_name=args.profile,
        fault_type=args.fault,
        fault_start_frac=args.fault_start,
        endpoint=args.endpoint,
        mission_id=args.mission_id,
        seed=args.seed,
        speedup=args.speedup,
        max_frames=args.max_frames,
    )


if __name__ == "__main__":
    main()
