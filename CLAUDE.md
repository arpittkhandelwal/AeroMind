# UAV Engine Digital Twin — Project Context (SIH 2026, DRDO PS 26054)

## Problem statement
"AI-Enabled Real-Time Digital Twin System for Health Monitoring, Fault Prediction and
Mission Reliability Enhancement of Aero Piston Engines used in MALE UAVs." MALE UAVs run
long-duration ISR/surveillance/defence missions. Their piston engines are currently
monitored with reactive, threshold-based systems with no RUL (remaining useful life)
estimation or mission simulation. We are building a Digital Twin: a continuously
synchronized virtual engine model driven by telemetry, physics models, and AI/ML, doing
real-time health monitoring, predictive fault detection, RUL estimation, and mission
replay, surfaced on an operator dashboard.

## MVP scope
Not the full defence-grade system (real CAN/FADEC hardware, fleet-wide federated
learning) — a software prototype demonstrating the core intelligence:
1. Physics-informed synthetic engine telemetry (stand-in for real sensors/CAN data)
2. Edge-style preprocessing of that telemetry
3. A digital twin core: physics-based model + AI/ML model running side by side
4. Fault detection + RUL estimation with SHAP explainability
5. A dashboard: live health status, alerts, RUL, mission replay

## Architecture
Physical engine + sensors -> CAN bus/SocketCAN + ECU/FADEC acquisition -> edge
preprocessing -> Digital Twin core (physics-based model + AI/ML fault & RUL engine,
parallel) -> analytics server + mission replay DB -> Dashboard/GCS HMI -> operators.

## Modules (each owns one folder)
| Folder | Module | Reads | Writes |
|---|---|---|---|
| data-sim/ | Synthetic telemetry generator | mission profile params | telemetry_schema.json frames |
| edge-preprocessing/ | Filtering + feature extraction | telemetry frames | cleaned frames, same schema + features |
| physics-model/ | Thermodynamic twin model | telemetry frames | expected nominal values per frame |
| ml-fault-rul/ | Anomaly detection, fault classification, RUL | telemetry frames | Alert + RUL objects per api_spec.yaml |
| backend-api/ | FastAPI server + DB | all of the above | implements every api_spec.yaml endpoint, owns db_schema.sql |
| dashboard/ | React frontend | api_spec.yaml endpoints | nothing shared |

## Tech stack
Python 3.11 (pandas, numpy, scikit-learn, PyTorch, SHAP), FastAPI, SQLite, React + Vite,
python-can for SocketCAN-style simulation.

## Contracts
`/contracts/telemetry_schema.json`, `/contracts/api_spec.yaml`, `/contracts/db_schema.sql`
are the fixed interfaces every module builds against. Don't change them without flagging
it — every other module depends on them staying stable.

## Working rules
1. Read this file and any relevant contracts before writing code.
2. Build against contracts, not against another module's real code — mock dependencies.
3. Stay inside your own module folder unless explicitly doing integration work.
4. Commit early and often.
