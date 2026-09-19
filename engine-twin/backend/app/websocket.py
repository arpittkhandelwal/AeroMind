"""
websocket.py
============
Manages the set of connected WebSocket clients and broadcasts messages to all.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Thread-safe registry of active WebSocket connections."""

    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._connections.add(ws)
        logger.info("WS client connected. Total: %d", len(self._connections))

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(ws)
        logger.info("WS client disconnected. Total: %d", len(self._connections))

    async def broadcast(self, data: Any) -> None:
        """Broadcast JSON-serialisable data to all connected clients."""
        import json

        message = json.dumps(data, default=str)
        dead: list[WebSocket] = []

        async with self._lock:
            clients = list(self._connections)

        for ws in clients:
            try:
                await ws.send_text(message)
            except Exception:  # noqa: BLE001
                dead.append(ws)

        for ws in dead:
            await self.disconnect(ws)


# Module-level singleton used by mqtt_listener and the WS route
manager = ConnectionManager()
