"""
mqtt_listener.py
================
Background MQTT subscriber that:
  1. Reads `engine/telemetry` → writes to TimescaleDB → broadcasts via WebSocket
  2. Reads `engine/alerts`    → writes to TimescaleDB → broadcasts via WebSocket

Run as a FastAPI background task from main.py lifespan.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone

import paho.mqtt.client as mqtt

from app import db
from app.websocket import manager

logger = logging.getLogger(__name__)

MQTT_HOST = os.getenv("MQTT_HOST", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
TOPIC_TELEMETRY = os.getenv("MQTT_TOPIC_TELEMETRY", "engine/telemetry")
TOPIC_ALERTS = os.getenv("MQTT_TOPIC_ALERTS", "engine/alerts")

_loop: asyncio.AbstractEventLoop | None = None


def _on_connect(client, userdata, flags, reason_code, properties):
    logger.info("MQTT listener connected (rc=%s)", reason_code)
    client.subscribe(TOPIC_TELEMETRY)
    client.subscribe(TOPIC_ALERTS)


def _on_message(client, userdata, msg: mqtt.MQTTMessage):
    """Called from the paho network thread — schedule coroutine on the main loop."""
    try:
        payload = json.loads(msg.payload.decode())
    except json.JSONDecodeError:
        logger.warning("Bad JSON on %s", msg.topic)
        return

    if _loop is None:
        return

    if msg.topic == TOPIC_TELEMETRY:
        asyncio.run_coroutine_threadsafe(_handle_telemetry(payload), _loop)
    elif msg.topic == TOPIC_ALERTS:
        asyncio.run_coroutine_threadsafe(_handle_alert(payload), _loop)


async def _handle_telemetry(payload: dict) -> None:
    # Normalise timestamp
    payload.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
    try:
        ts = datetime.fromisoformat(payload["timestamp"])
        payload["timestamp"] = ts
        await db.insert_telemetry(payload)
    except Exception as exc:  # noqa: BLE001
        logger.error("DB insert_telemetry failed: %s", exc)

    await manager.broadcast({"type": "telemetry", "data": payload})


async def _handle_alert(payload: dict) -> None:
    payload.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
    try:
        ts = datetime.fromisoformat(payload["timestamp"])
        payload["timestamp"] = ts
        await db.insert_alert(payload)
    except Exception as exc:  # noqa: BLE001
        logger.error("DB insert_alert failed: %s", exc)

    await manager.broadcast({"type": "alert", "data": payload})


def start_listener(loop: asyncio.AbstractEventLoop) -> mqtt.Client:
    """
    Initialise and start the paho MQTT client on a background thread.
    Call from the FastAPI lifespan after the DB pool is ready.
    """
    global _loop
    _loop = loop

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="dt-backend-listener")
    client.on_connect = _on_connect
    client.on_message = _on_message

    client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
    client.loop_start()
    logger.info("MQTT listener started → %s:%d", MQTT_HOST, MQTT_PORT)
    return client
