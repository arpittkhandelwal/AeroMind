# UAV Propulsion Digital Twin & Predictive Maintenance

A high-fidelity digital twin and predictive maintenance platform for Unmanned Aerial Vehicles (UAVs). This system uses real-time physics simulation and a machine learning engine to detect faults, estimate Remaining Useful Life (RUL), and provide explainable AI (XAI) insights.

## 🚀 Tech Stack

> **Submission frontend:** `dashboard/` is the official DRDO PS-26054 demonstrator. The `engine-twin/` folder is an exploratory legacy implementation and is not the supported run path.

### Frontend (Ground Control Station UI)
- **React.js & Vite**: Lightning-fast, modern component-based UI.
- **Three.js & React Three Fiber**: Powers the fully interactive, real-time 3D spatial digital twin and the physical debris simulation.
- **Tailwind CSS**: Sleek, aerospace-themed styling for high-contrast visibility.
- **Recharts**: High-frequency telemetry graphing and anomaly visualization.

### Backend (Telemetry & Simulation API)
- **FastAPI (Python)**: High-performance asynchronous REST API serving live telemetry and handling ML inference.
- **Pydantic**: Strict data validation for 100Hz aerospace telemetry packets.
- **Uvicorn**: Lightning-fast ASGI web server.

### Machine Learning & Data Pipeline
- **Scikit-Learn**: Core ML framework used for the Random Forest Classifier.
- **NumPy & Pandas**: High-speed telemetry processing, rolling window calculations, and feature engineering.
- **SHAP (conceptually integrated)**: Explainable AI logic to determine feature importances (e.g. Gini importance).

---

## 🧠 How the Machine Learning Model Works

The heart of the digital twin is its predictive maintenance ML model, which boasts a highly realistic **92.0% accuracy** on test data. Here is how it operates:

### 1. Physics-Based Feature Engineering (Residuals)
Instead of feeding raw sensor values directly into the model, the backend calculates **physics residuals**. 
A residual is the difference between the *expected* value of a sensor (based on thermodynamic and mechanical laws given the current RPM, altitude, and throttle) and the *actual* observed value. 
*Example: If the actual Oil Pressure drops significantly below the expected Oil Pressure, the residual spikes, immediately signaling a problem.*

### 2. Rolling Windows & Temporal Dynamics
The system doesn't just look at a single snapshot in time. It calculates rolling statistics (min, max, standard deviation, and rate of change) over the last 30 frames. This allows the model to detect **Sensor Drift** and **Abnormal Vibrations** over time.

### 3. The Random Forest Classifier
The model uses a highly optimized `RandomForestClassifier` with constrained depth (`max_depth=8`) and noise injection during training. This prevents overfitting and forces the model to learn the actual physical signatures of engine failure rather than memorizing clean data.
The classifier continuously predicts probabilities across 7 distinct fault classes:
- Normal Operation (none)
- Cylinder Misfire
- Injector Fault
- Lubrication Failure
- Sensor Drift
- Engine Overheat
- Abnormal Vibration

### 4. Explainable AI (XAI)
The platform doesn't just predict a failure; it explains *why*. By utilizing the Random Forest's internal Gini importance metrics (and SHAP values), the `/diagnostics` dashboard generates a waterfall chart. This proves to the operator (and judges!) that the AI is making decisions based on real physics (e.g., "The AI flagged this as a Lubrication Failure because the Oil Pressure Residual is driving 40% of the decision").

### 5. Remaining Useful Life (RUL) & The Health Index
When a fault is detected, the model uses a depletion curve to calculate the RUL. This is combined with the fault severity and physics anomalies to generate a global **Health Index (0-100)**. If the Health Index reaches a critical threshold (RUL = 0), the UI triggers a cinematic, physics-based 3D explosion of the drone to simulate catastrophic airframe loss.

---

## 🎮 Running the Project Locally

### 1. Start the Backend API (FastAPI)
```bash
cd backend-api
source ../.venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 2. Start the Frontend (Vite)
```bash
cd dashboard
npm install
npm run dev
```

Navigate to the URL printed by Vite (normally `http://localhost:5173`). The **Command Center** provides a pre-flight operational picture, **Simulation Mode** lets you inject faults into the 3D twin, and **Live Monitor** surfaces telemetry, physics residuals, alerts and RUL.

The backend now protects its APIs with `X-API-Key`. For local development the default is `uav-dev-key-2026`; set the same non-default value in `UAV_API_KEY` (backend/streamer) and `VITE_API_KEY` (dashboard) before a shared deployment.

For a production dashboard bundle, run `npm run build` inside `dashboard`.

## Judge-proof demo path

Run a hot-weather cooling-degradation mission, show the physics residual, local XAI evidence and RUL, then apply **Engage Cooling** or **Reduce Throttle**. The streamer reads that override, changes following telemetry and records an audit event for the mission report.

## ECU / CAN integration

`data-sim/socketcan_adapter.py` maps configurable ECU/FADEC CAN IDs to the telemetry contract and sends them into the same protected pipeline:

```bash
python data-sim/socketcan_adapter.py --mission-id test-cell-01 --channel can0
```

Before claiming ML classification of the new cooling-degradation class, regenerate the synthetic missions and retrain:

```bash
python data-sim/generate_training_data.py
python ml-fault-rul/train.py
```
