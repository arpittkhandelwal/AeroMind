# System Architecture — UAV Propulsion Digital Twin
## DRDO Problem Statement 26054 | SIH 2026

---

## Real Data Flow (as actually implemented)

```
┌─────────────────────────────────────────────────────────────────┐
│  DATA SOURCE: data-sim/simulator.py                             │
│  Physics-based flight dynamics simulator                        │
│  - 4 flight profiles × 8 fault types × multi-seed              │
│  - Pre-generated JSON missions in data-sim/samples/             │
└──────────────────────────────┬──────────────────────────────────┘
                               │ data-sim/streamer.py
                               │ POST /telemetry/ingest (~1 Hz)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  EDGE PREPROCESSING: edge-preprocessing/                        │
│  backend-api/ingest.py calls Preprocessor.process_batch()       │
│  FeatureExtractor.extract() computes per frame:                 │
│    - rolling_std, rolling_roc, rolling_min, rolling_max         │
│    - for: rpm, cht_c, egt_c, oil_pressure_kpa,                  │
│            vibration_g, fuel_flow_lph (+ more)                  │
│  dropout_handler.py fills missing fields with last-known value  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  PHYSICS MODEL: physics-model/engine_model.py                   │
│  ThermodynamicModel.predict() computes EXPECTED sensor values   │
│  from current RPM, throttle, altitude, ambient temp             │
│  compute_residuals() = actual - expected → physics residuals    │
│  (residual_cht_c, residual_egt_c, residual_oil_pressure_kpa…)  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  ML INFERENCE: ml-fault-rul/serve.py → MLService                │
│                                                                  │
│  1. AnomalyDetector (IsolationForest)                           │
│     Input: 5 physics residuals                                  │
│     Output: anomaly_score ∈ [0,1]                               │
│                                                                  │
│  2. FaultClassifier (RandomForestClassifier, max_depth=8)       │
│     Input: 13 raw telemetry + 5 residuals + 24 rolling features │
│     Output: predicted_fault (str), confidence, probabilities    │
│     Training accuracy: 92.2% on 264,600 held-out frames        │
│                                                                  │
│  3. RULEstimator (GradientBoostingRegressor)                    │
│     Input: 10 raw + 5 residuals + 6 rolling + 6 context feats  │
│     Output: rul_hours, confidence, degradation_trend            │
│                                                                  │
│  Feature Importance: Random Forest Gini (global importance)     │
│  NOTE: Not per-prediction SHAP — that is a future improvement   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  HEALTH INDEX: backend-api/health_index.py                      │
│  HI = 100                                                       │
│    - 0.25 × normalize(anomaly_score) × 100                      │
│    - 0.50 × fault_severity_penalty (0/10/25/100)                │
│    - 0.15 × rul_depletion × 100                                 │
│    - 0.10 × degradation_penalty (0/15/35)                       │
│  HI ∈ [0, 100] — 100 = healthy, 0 = imminent failure           │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  PERSISTENCE: backend-api/database.py → SQLite                  │
│  Tables: missions, telemetry_frames, alerts, rul_estimates      │
│  Path: backend-api/digital_twin.db                              │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  FASTAPI REST API: backend-api/main.py (port 8000)              │
│                                                                  │
│  POST /telemetry/ingest        Ingest one frame (full pipeline) │
│  GET  /telemetry/latest        Latest frame + health index       │
│  GET  /faults/{id}             Detected faults with RUL          │
│  GET  /rul/{id}                RUL estimate + degradation trend  │
│  POST /simulation/start        Launch streamer subprocess        │
│  GET  /missions/{id}/replay    Full time series for analysis     │
│  GET  /health_history/{id}     RUL/HI sparkline history         │
│  GET  /missions/{id}/report    Mission health-report data        │
│  GET  /diagnostics/{id}        Local XAI + physics evidence      │
│  GET  /telemetry/stream        SSE live telemetry stream         │
│  POST /chat                    AI Commander chatbot              │
│                                                                  │
│  Auth: X-API-Key header (UAV_API_KEY env var, default in dev)   │
│  Excluded from auth: /health, /docs, /openapi.json              │
└──────────────────────────────┬──────────────────────────────────┘
                               │ Server-Sent Events, emitted on new frames
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND: dashboard/ (port 5173)                               │
│  React + Vite + Three.js                                         │
│                                                                  │
│  LiveMissionView — SSE /telemetry/stream + RUL updates          │
│                                                                  │
│  Pages:                                                          │
│    /               Overview — 4 live metrics + health + RUL     │
│    /live           Live Monitor — sensor table, fault alerts     │
│    /digital-twin   3D UAV (Three.js/R3F) + debris explosion      │
│    /diagnostics    Fault detection + Feature Importance          │
│    /predictions    Model metrics + per-class F1 + RUL           │
│    /simulator      Mission launcher + cinematic RUL countdown    │
│    /fleet          Fleet health grid (3 simulated UAVs)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Telemetry Delivery: Honest Description

| Layer            | Mechanism        | Rate       |
|-----------------|-----------------|-----------|
| Simulator → API | HTTP POST       | ~1 Hz     |
| API → DB        | SQLite INSERT   | ~1 Hz     |
| Frontend poll   | REST GET (~800ms)| ~1 Hz     |
| 3D render       | requestAnimationFrame | 60 fps |

**What "1Hz" means:** One telemetry frame per second is the effective update rate, matching the streamer's output. The 3D model animates at 60fps using interpolation between frames.

**Future: Server-Sent Events (SSE)** would eliminate polling and deliver frames immediately as they arrive. This requires a FastAPI `EventSourceResponse` endpoint and an `EventSource` consumer in the frontend.

---

## PS Innovation Areas vs. Implementation Status

| Innovation Area (PS 26054)      | Status | Implementation |
|---------------------------------|--------|----------------|
| Physics-based digital twin      | ✅ Real | ThermodynamicModel + 3D R3F visualization |
| Predictive fault classification | ✅ Real | RandomForest, 92.2% accuracy, 8 classes |
| RUL estimation                  | ✅ Real | GradientBoostingRegressor, regression |
| Edge AI preprocessing           | ✅ Real | FeatureExtractor wired into ingest pipeline |
| Explainable AI                  | ✅ Local evidence | Per-frame contributing factors paired with physics residuals; SHAP module available where installed |
| Real-time delivery              | ✅ SSE | `/telemetry/stream` emits on each stored telemetry frame |
| Secure telemetry                | ✅ Basic | X-API-Key validation on protected endpoints; production hardening remains a roadmap item |
| Fleet monitoring                | ✅ Basic | Fleet View page with 3 simulated UAVs |
| Rapid throttle scenarios        | ✅ Real | `rapid_throttle` profile in simulator |
