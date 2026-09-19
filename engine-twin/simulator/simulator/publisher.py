"""
publisher.py
============
MQTT publish loop — reads the engine model, applies fault injection,
and publishes JSON telemetry to `engine/telemetry` every ~interval seconds.
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

from simulator.engine_model import EngineModel
from simulator.fault_injection import get_fault_delta
from simulator.mission_profiles import profile_generator

logger = logging.getLogger(__name__)

TELEMETRY_TOPIC = os.getenv("MQTT_TOPIC_TELEMETRY", "engine/telemetry")


class Publisher:
    def __init__(
        self,
        mqtt_host: str = "localhost",
        mqtt_port: int = 1883,
        fault_scenario: str = "normal",
        interval: float = 1.0,
        mission_profile: str = "standard_isa",
    ) -> None:
        self._host = mqtt_host
        self._port = mqtt_port
        self._fault = fault_scenario
        self._interval = interval
        self._model = EngineModel()
        self._mission_gen = profile_generator(mission_profile)

        self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="dt-simulator")
        self._client.on_connect = self._on_connect
        self._client.on_disconnect = self._on_disconnect

    # ------------------------------------------------------------------
    def run(self) -> None:
        logger.info("Connecting to MQTT broker %s:%d …", self._host, self._port)
        self._client.connect(self._host, self._port, keepalive=60)
        self._client.loop_start()

        # Give broker a moment
        time.sleep(2)

        logger.info("Publish loop started (topic=%s)", TELEMETRY_TOPIC)
        while True:
            t0 = time.monotonic()

            # 1. Advance mission profile
            altitude, ambient_temp = next(self._mission_gen)
            self._model.set_mission_conditions(altitude, ambient_temp)

            # 2. Tick the healthy model
            state = self._model.tick()

            # 3. Apply fault perturbation
            delta, label = get_fault_delta(self._fault)
            if delta:
                self._model.apply_perturbation(delta)
            self._model.set_fault_label(label)

            # Re-read state after perturbation
            state = self._model.tick()

            # 4. Build payload
            payload = {
                "timestamp":    datetime.now(timezone.utc).isoformat(),
                "rpm":          round(state.rpm, 1),
                "egt":          round(state.egt, 1),
                "cht":          round(state.cht, 1),
                "oil_pressure": round(state.oil_pressure, 3),
                "oil_temp":     round(state.oil_temp, 1),
                "fuel_flow":    round(state.fuel_flow, 2),
                "vibration":    round(state.vibration, 4),
                "altitude":     round(state.altitude, 1),
                "ambient_temp": round(state.ambient_temp, 1),
                "fault_label":  state.fault_label,
            }

            self._client.publish(TELEMETRY_TOPIC, json.dumps(payload), qos=0)
            logger.debug("Published: %s", payload)

            # Sleep for the remainder of the interval
            elapsed = time.monotonic() - t0
            time.sleep(max(0, self._interval - elapsed))

    # ------------------------------------------------------------------
    def _on_connect(self, client, userdata, flags, reason_code, properties):
        if reason_code == 0:
            logger.info("MQTT connected")
        else:
            logger.error("MQTT connect failed: %s", reason_code)

    def _on_disconnect(self, client, userdata, flags, reason_code, properties):
        logger.warning("MQTT disconnected (rc=%s)", reason_code)
