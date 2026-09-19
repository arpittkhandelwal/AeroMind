# SIH26054 — Digital Twin for MALE UAV Aero Piston Engines

> **DRDO · Software, Robotics & Drones · SIH 2026**  
> 6-person team · 36-hour build

Real-time Digital Twin that ingests simulated engine telemetry, detects
anomalies, classifies faults, estimates Remaining Useful Life (RUL), and
displays everything on a live dashboard — with a mission-replay view.

---

## ⚡ Quick Start (clean machine)

```bash
git clone <repo-url> sih26054-digital-twin
cd sih26054-digital-twin
cp .env.example .env          # review and adjust if needed
docker compose up --build
```

| URL | Service |
|-----|---------|
| http://localhost:5173 | React Dashboard |
| http://localhost:8000/docs | Backend Swagger UI |
| http://localhost:8001/docs | ML Service Swagger UI |
| localhost:1883 | MQTT Broker |
| localhost:5432 | TimescaleDB |

> **Prerequisites**: Docker Desktop ≥ 24 and Docker Compose v2 (`docker compose`).  
> No other tooling required.

---

## 🗂 Folder Ownership

| Folder | Owner(s) | Role |
|--------|----------|------|
| `simulator/` | Sim1, Sim2 | Engine physics + fault injection |
| `backend/` | Infra | Ingestion, DB, WebSocket API |
| `infra/` | Infra | Mosquitto config, DB schema |
| `ml/` | ML1, ML2 | Anomaly detection, classifier, RUL |
| `frontend/` | Front | React dashboard |
| `docs/` | Front | Architecture + interface contracts |

**Rule**: any PR that touches a folder you don't own needs a heads-up to that
owner _before_ you open it.

---

## 🌿 Git Workflow

```bash
# Branch off main
git checkout main && git pull
git checkout -b <initials>/<short-feature>

# e.g. ak/mqtt-publisher   or   rp/rul-gru-model
```

**PR checkpoints** (merge into `main` at each):

| Hour | Checkpoint |
|------|-----------|
| 8 | All services boot, MQTT flowing, DB writes working |
| 14 | **Non-negotiable**: one fault type flows end-to-end (sim → anomaly flag → dashboard alert) |
| 20 | ML models trained on synthetic data, RUL displaying live |
| 26 | Mission replay working, UI polished |

At **hour 14** and **hour 20**, everyone pulls `main` and runs
`docker compose up --build` together — this is the integration smoke test.

> If the hour-14 checkpoint isn't passing, **cut scope rather than miss it**.
> A working single-fault demo beats a broken multi-fault one.

---

## 🔧 Changing the Fault Scenario

Edit `.env` and set `SIM_FAULT_SCENARIO` to one of:

`normal` | `misfire` | `injector` | `lubrication` | `sensor_drift` | `combustion` | `overheating`

Then restart:
```bash
docker compose restart simulator
```

---

## 🧪 Running Individual Services Locally

```bash
# Simulator (outside Docker)
cd simulator
pip install -r requirements.txt
SIM_FAULT_SCENARIO=misfire python main.py

# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# ML service
cd ml
pip install -r requirements.txt
uvicorn src.serve:app --port 8001 --reload

# Frontend
cd frontend
npm install
npm run dev
```

---

## 🏋️ Offline ML Training

```bash
# Once you have training data in ml/data/
docker compose run --rm ml python -m src.anomaly_detection
docker compose run --rm ml python -m src.fault_classifier
docker compose run --rm ml python -m src.rul_model
```

See individual files for data format requirements.

---

## 📐 Architecture

See [`docs/architecture.md`](docs/architecture.md) for the full diagram and
interface contracts.

---

## 📋 TODOs at Handoff

The scaffold ships with working plumbing and stubs everywhere ML logic is
needed.  Search `# TODO` across the repo to find every stub:

```bash
grep -rn "TODO" simulator/ backend/ ml/ frontend/
```
