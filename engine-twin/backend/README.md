# Backend

FastAPI ingestion service + WebSocket broadcaster.

## Running locally

```bash
pip install -r requirements.txt
# Requires running mosquitto + timescaledb (or use docker compose)
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

## Files

| File | Purpose |
|------|---------|
| `app/main.py` | FastAPI app, lifespan, CORS, WebSocket endpoint |
| `app/mqtt_listener.py` | Subscribes to MQTT, writes DB, broadcasts WS |
| `app/db.py` | asyncpg pool, insert/fetch helpers |
| `app/models.py` | Pydantic schemas |
| `app/websocket.py` | ConnectionManager for WS broadcast |
| `app/routes/telemetry.py` | GET latest / history |
| `app/routes/alerts.py` | GET alerts / health-index |

**Owner**: Infra
