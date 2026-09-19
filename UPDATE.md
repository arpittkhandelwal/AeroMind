# Project Update & Current State (SIH 2026 - DRDO PS 26054)

## Architecture Overview
Our project is an AI-enabled Digital Twin for MALE UAV Aero Piston Engines. The core data flow works as follows:
1. **Simulation (`data-sim/`)**: Generates realistic telemetry data based on 4 flight profiles and 8 fault types.
2. **Preprocessing (`edge-preprocessing/`)**: Computes rolling statistical features (e.g., standard deviation, min/max) for the ML model.
3. **Inference (`ml-fault-rul/`)**: 
   - A Random Forest classifier detects engine faults based on telemetry and physics residuals.
   - A Gradient Boosting Regressor predicts Remaining Useful Life (RUL).
4. **Backend API (`backend-api/`)**: A FastAPI server that ingests telemetry, calculates health index, stores data in SQLite, and provides REST endpoints.
5. **Frontend (`engine-twin/frontend/`)**: A React application using Vite and Three.js/R3F for a 3D digital twin visualization.

## Frontend UI Components & Pages

We have consolidated our UI under the `engine-twin/` directory. The application features a sidebar for navigation and the following pages:

### 1. Operations
*   **Overview (`/`)**: A high-level dashboard displaying live telemetry metrics, an overall health index score, and RUL.
*   **Live Monitor (`/live`)**: A detailed tabular view of incoming telemetry data (~1Hz REST polling), along with active fault alerts.
*   **Fleet View (`/fleet`)**: Orchestrates and monitors 3 simulated UAVs simultaneously, displaying their individual health indexes, connected status, and active faults.

### 2. Digital Twin
*   **Digital Twin Workstation (`/digital-twin`)**: The hero 3D interface featuring:
    *   **MALE UAV Platform View**: An interactive 3D model of the Anka-S UAV that responds to live telemetry (e.g., vibrating based on sensor data).
    *   **Engine Propulsion Twin**: A zoomed-in thermal view of the engine components.
    *   **Catastrophic Failure Simulation**: When the RUL estimate reaches 0 hours, the 3D model shatters into flying debris, accompanied by an on-screen warning: "CATASTROPHIC AIRFRAME LOSS".

### 3. Intelligence
*   **Diagnostics (`/diagnostics`)**: Displays the Random Forest Gini Feature Importance to explain *why* the AI made a specific fault prediction, addressing the "black box" problem of ML models.
*   **Predictions (`/predictions`)**: Displays model evaluation metrics, including per-class precision, recall, and Macro F1 scores, as well as the predicted RUL degradation trend.

### 4. Mission & Simulation Control
*   **Simulator (`/simulator`)**: Allows the user to launch new simulation missions, selecting specific flight profiles and injecting specific fault types for testing.

## Security & Reliability Additions
*   **API Authentication**: All telemetry endpoints are now secured via an `X-API-Key` middleware header requirement.
*   **Honest Claims**: We have scrubbed the UI and documentation to honestly represent our ~1Hz REST polling mechanism (instead of claiming 100Hz WebSockets) and our use of Gini feature importance (instead of per-prediction SHAP), ensuring a robust defense during the jury round.
