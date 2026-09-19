# Deployment Roadmap: Prototype to Production
## DRDO PS-26054: AI-enabled Digital Twin for MALE UAVs

This document maps the current SIH 2026 prototype capabilities against the requirements for real-world deployment on military UAVs.

---

## 1. Edge-Level Integration (UAV Flight Controller)

**Current State (Prototype):**
- Edge preprocessing (`edge-preprocessing/preprocessor.py`) is written in Python.
- Simulates noise filtering, Z-score outlier removal, and rolling feature extraction.
- Transmits data via HTTP REST at 1-10Hz.

**Production Target:**
- **Language Conversion**: Port the `Preprocessor` logic to C++ or Rust for execution on real RTOS (Real-Time Operating Systems) like VxWorks or embedded Linux running on the UAV's Flight Control Computer (FCC).
- **Protocol**: Replace HTTP REST with highly compressed binary protocols over UDP or lightweight MQTT-SN suitable for low-bandwidth satellite/RF datalinks.
- **Hardware Integration**: Interface directly with the CAN bus (e.g., J1939) to read raw Engine Control Unit (ECU) data.

## 2. Cloud/GCS Backend Scaling

**Current State (Prototype):**
- Python FastAPI server running locally.
- In-memory physics model instantiation.
- SQLite database for time-series persistence.

**Production Target:**
- **Time-Series DB**: Migrate from SQLite to a robust TSDB like InfluxDB or TimescaleDB to handle years of historical flight data across a massive fleet of UAVs.
- **Message Broker**: Introduce Apache Kafka or RabbitMQ to decouple ingestion from inference, allowing multiple ML workers to process telemetry streams asynchronously.
- **Containerization**: Deploy the GCS backend via Kubernetes to ensure high availability during critical operations.

## 3. Machine Learning Evolution

**Current State (Prototype):**
- Trained on 200+ *synthetic* missions.
- Models (RandomForest, GradientBoosting) are frozen post-training.
- Physics model relies on standard ISA approximations.

**Production Target:**
- **Real-World Calibration**: The synthetic data generator is a proxy. In production, the ML pipeline must be fine-tuned via Transfer Learning using real engine test-cell data and historical DRDO flight logs.
- **Federated Learning**: Implement edge-based model updating where UAVs can learn from novel anomalies in-flight and transmit tiny model weight updates back to the GCS, rather than transmitting massive raw datasets.
- **Digital Twin Fingerprinting**: Each individual physical engine is subtly different (manufacturing tolerances). The Physics Model must "learn" the specific fingerprint of its physical twin during its break-in flights to tighten the anomaly detection residuals.

## 4. Security & Authentication

**Current State (Prototype):**
- Open API endpoints.
- Unencrypted SQLite storage.

**Production Target:**
- **Zero-Trust Network**: Implement mTLS (Mutual TLS) between the UAV edge node and the GCS.
- **Data Encryption**: AES-256 encryption for all telemetry in transit and at rest.
- **Role-Based Access Control (RBAC)**: Command Center UI requires strict auth (e.g., Operator vs. Maintenance Engineer roles).

## 5. Explainability & Maintenance Integration

**Current State (Prototype):**
- Dashboard surfaces SHAP-inspired prose ("CHT is elevated by 47°C").

**Production Target:**
- **ERP Integration**: Automatically generate maintenance work orders in the military logistics system (e.g., SAP) when the RUL drops below a designated threshold or a critical fault is predicted.
- **Supply Chain**: Predict required spare parts based on the specific fault classifier output to ensure logistics readiness before the UAV even lands.
