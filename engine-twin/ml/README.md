# ML Service

FastAPI inference microservice for anomaly detection, fault classification, and RUL estimation.

## Running locally

```bash
pip install -r requirements.txt
uvicorn src.serve:app --port 8001 --reload
```

API docs: http://localhost:8001/docs

## Offline Training

```bash
# Export training data from TimescaleDB first
docker compose exec timescaledb psql -U digital_twin -d engine_db \
  -c "\COPY (SELECT * FROM telemetry) TO '/tmp/telemetry.csv' CSV HEADER"

# Then train each model
python -m src.anomaly_detection
python -m src.fault_classifier
python -m src.rul_model
```

Trained models are saved to `models/` (gitignored).

## Files

| File | Purpose |
|------|---------|
| `src/serve.py` | FastAPI + MQTT subscriber → inference → alert publisher |
| `src/anomaly_detection.py` | Isolation Forest wrapper |
| `src/fault_classifier.py` | XGBoost 7-class classifier |
| `src/rul_model.py` | GRU regression for RUL |
| `src/explainability.py` | SHAP top-K feature extractor |

**Owner**: ML1, ML2
