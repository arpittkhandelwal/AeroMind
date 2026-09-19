# System Architecture — UAV Digital Twin

## Overview

The Digital Twin is designed as a federated edge-to-cloud architecture, specifically tailored for the DRDO Problem Statement 26054 (AI-enabled Digital Twin for MALE UAVs). It simulates real-time engine telemetry, performs edge preprocessing, and runs cloud-level ML inferences to predict Remaining Useful Life (RUL) and isolate faults before they manifest catastrophically.

## Architecture Diagram

```mermaid
graph TD
    subgraph Edge Layer [UAV Edge (Simulated)]
        A[Physics/Telemetry Generator] -->|Raw 10Hz Data| B(Edge Preprocessor)
        B -->|Z-Score Filter & Rolling Stats| C[Edge Transmitter]
    end

    subgraph Ground Control Station [Backend API]
        C -->|REST / POST (1Hz)| D[Ingestion Pipeline]
        D --> E{Thermodynamic Physics Model}
        E -->|Compute Residuals| F[ML Inference Pipeline]
        D -->|Raw Storage| DB[(Time-Series SQLite)]
        
        subgraph ML Pipeline [ML Subsystem]
            F1(Anomaly Detector: Isolation Forest)
            F2(Fault Classifier: Random Forest)
            F3(RUL Estimator: Gradient Boosting)
            F --> F1
            F --> F2
            F --> F3
        end
        
        F1 --> G[Health Index Calculator]
        F2 --> G
        F3 --> G
    end

    subgraph Command Center UI [React Dashboard]
        G -->|SSE / Polling| H[Live Mission View]
        F3 -->|SHAP Explainability| I[RUL Insight Panel]
        DB -->|Historical Replay| J[Post-Mission Analysis]
    end
```

## Component Breakdown

### 1. Data Generator (`data-sim/`)
Generates highly realistic synthetic telemetry based on known aero-piston physical constraints (e.g., CHT thermal lag, altitude density penalties). Simulates 5 distinct mission profiles and 7 unique fault conditions. Faults are mathematically modeled as progressive degradations rather than binary switches.

### 2. Edge Preprocessor (`edge-preprocessing/`)
Simulates the compute-constrained environment of the UAV flight controller. Applies rolling window statistics (e.g., `rpm_rolling_std` to detect combustion instability) and drops anomalous 3-sigma spikes to save transmission bandwidth.

### 3. Physics Model (`physics-model/`)
A stateless thermodynamic model that calculates the *expected* state of a perfectly healthy engine for any given (RPM, Throttle, Altitude, Ambient Temp). 

### 4. ML Subsystem (`ml-fault-rul/`)
- **Anomaly Detection**: An `IsolationForest` trained exclusively on clean data. It detects arbitrary anomalies without needing explicit fault labels.
- **Fault Classification**: A `RandomForestClassifier` that identifies the specific failure mode (e.g., 'Lubrication Issue') based on the physical residuals.
- **RUL Estimator**: A `GradientBoostingRegressor` that estimates the remaining time before engine failure, using the accumulated damage model.
- **Explainability**: Outputs human-readable prose explaining *why* the AI made its decision (e.g., "Engine head temperature is elevated by 47°C compared to physics baseline").

### 5. Backend API (`backend-api/`)
A high-performance `FastAPI` server that acts as the Ground Control Station (GCS) receiver. It orchestrates the ingestion pipeline, runs the ML models in memory, calculates the real-time Health Index (0-100), and persists data to SQLite.

### 6. Command Center UI (`dashboard/`)
A React-based situational awareness dashboard. Designed with a military/aerospace aesthetic, featuring 3D visualizations, live TTF (Time To Failure) countdowns, and full post-mission replay capabilities.
