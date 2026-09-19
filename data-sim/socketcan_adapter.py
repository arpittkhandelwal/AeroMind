"""SocketCAN-to-digital-twin adapter for ECU/FADEC telemetry."""
import argparse
import os
from datetime import datetime, timezone

try:
    import can
except ImportError:
    can = None

# Aircraft-specific CAN IDs and scaling are isolated here for calibration.
CAN_MAP = {
    0x500: (("rpm", 0, 2, 1.0), ("throttle_pct", 2, 1, 0.5)),
    0x501: (("cht_c", 0, 2, 0.1), ("egt_c", 2, 2, 0.1)),
    0x502: (("oil_pressure_kpa", 0, 2, 0.1), ("oil_temp_c", 2, 2, 0.1)),
    0x503: (("fuel_flow_lph", 0, 2, 0.01), ("vibration_g", 2, 2, 0.001)),
    0x504: (("battery_voltage_v", 0, 2, 0.01), ("alternator_current_a", 2, 2, 0.1), ("injection_timing_deg", 4, 2, 0.1)),
}


def decode_message(message, frame: dict) -> dict:
    """Update a partial contract frame from a CAN message."""
    for name, offset, width, scale in CAN_MAP.get(message.arbitration_id, ()):
        raw = int.from_bytes(message.data[offset:offset + width], "little")
        frame[name] = round(raw * scale, 4)
    return frame


def stream_can(mission_id: str, channel: str = "can0"):
    if can is None:
        raise RuntimeError("Install python-can to use SocketCAN ingestion.")
    import requests
    bus = can.interface.Bus(channel=channel, interface="socketcan")
    frame = {"mission_id": mission_id, "altitude_m": 0.0, "ambient_temp_c": 25.0}
    required = ("rpm", "cht_c", "egt_c", "oil_pressure_kpa", "oil_temp_c", "fuel_flow_lph", "vibration_g", "battery_voltage_v", "injection_timing_deg", "throttle_pct")
    for message in bus:
        decode_message(message, frame)
        if all(key in frame for key in required):
            frame["timestamp"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            requests.post(os.environ.get("UAV_INGEST_URL", "http://127.0.0.1:8000/telemetry/ingest"), json=frame, headers={"X-API-Key": os.environ.get("UAV_API_KEY", "uav-dev-key-2026")}, timeout=1.0)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Read ECU/FADEC telemetry from SocketCAN")
    parser.add_argument("--mission-id", required=True)
    parser.add_argument("--channel", default="can0")
    args = parser.parse_args()
    stream_can(args.mission_id, args.channel)
