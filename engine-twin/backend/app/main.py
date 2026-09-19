"""
main.py — FastAPI application entrypoint
=========================================
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app import db, mqtt_listener
from app.routes import alerts, telemetry
from app.websocket import manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [BACKEND] %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await db.init_pool()
    loop = asyncio.get_event_loop()
    mqtt_client = mqtt_listener.start_listener(loop)
    logger.info("Backend ready")

    yield

    # Shutdown
    mqtt_client.loop_stop()
    mqtt_client.disconnect()
    await db.close_pool()
    logger.info("Backend shut down cleanly")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Digital Twin — Backend API",
    version="0.1.0",
    description="Ingestion, storage, and real-time streaming for SIH26054.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Tighten before production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(telemetry.router, prefix="/api/telemetry", tags=["telemetry"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok", "service": "backend"}


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            # Keep the connection alive; all sends happen via broadcast()
            await ws.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(ws)
