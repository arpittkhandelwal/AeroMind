-- ─── TimescaleDB initialisation ──────────────────────────────────────────────
-- Runs once when the container is first created.

-- Enable the TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ─── Telemetry hypertable ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS telemetry (
    timestamp       TIMESTAMPTZ        NOT NULL,
    rpm             DOUBLE PRECISION,
    egt             DOUBLE PRECISION,   -- Exhaust Gas Temperature (°C)
    cht             DOUBLE PRECISION,   -- Cylinder Head Temperature (°C)
    oil_pressure    DOUBLE PRECISION,   -- bar
    oil_temp        DOUBLE PRECISION,   -- °C
    fuel_flow       DOUBLE PRECISION,   -- L/h
    vibration       DOUBLE PRECISION,   -- g (acceleration)
    altitude        DOUBLE PRECISION,   -- metres MSL
    ambient_temp    DOUBLE PRECISION,   -- °C
    fault_label     TEXT                -- null = healthy
);

-- Convert to hypertable partitioned by time (1-hour chunks for hackathon)
SELECT create_hypertable('telemetry', 'timestamp', if_not_exists => TRUE);

-- Index for fast mission-replay range queries
CREATE INDEX IF NOT EXISTS idx_telemetry_time ON telemetry (timestamp DESC);

-- ─── Alerts table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
    id              SERIAL             PRIMARY KEY,
    timestamp       TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    fault_type      TEXT               NOT NULL,
    confidence      DOUBLE PRECISION,
    rul_hours       DOUBLE PRECISION,
    shap_top_features JSONB
);

CREATE INDEX IF NOT EXISTS idx_alerts_time ON alerts (timestamp DESC);
