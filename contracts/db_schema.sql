CREATE TABLE IF NOT EXISTS missions (
    mission_id      TEXT PRIMARY KEY,
    profile         TEXT NOT NULL CHECK (profile IN ('high_altitude','endurance','hot_weather','rapid_throttle','nominal')),
    started_at      TEXT NOT NULL,
    ended_at        TEXT,
    duration_min    REAL
);
CREATE TABLE IF NOT EXISTS telemetry_frames (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id TEXT NOT NULL REFERENCES missions(mission_id),
    timestamp TEXT NOT NULL, rpm REAL, cht_c REAL, egt_c REAL,
    oil_pressure_kpa REAL, oil_temp_c REAL, fuel_flow_lph REAL,
    vibration_g REAL, battery_voltage_v REAL, alternator_current_a REAL,
    injection_timing_deg REAL, altitude_m REAL, ambient_temp_c REAL,
    throttle_pct REAL, fault_label TEXT
);
CREATE INDEX IF NOT EXISTS idx_frames_mission_time ON telemetry_frames(mission_id, timestamp);
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id TEXT NOT NULL REFERENCES missions(mission_id),
    fault_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
    detected_at TEXT NOT NULL, message TEXT, recommended_action TEXT
);
CREATE TABLE IF NOT EXISTS rul_estimates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id TEXT NOT NULL REFERENCES missions(mission_id),
    timestamp TEXT NOT NULL, rul_hours REAL, confidence REAL,
    degradation_trend TEXT CHECK (degradation_trend IN ('stable','degrading','critical')),
    contributing_factors TEXT
);
CREATE TABLE IF NOT EXISTS override_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id TEXT NOT NULL REFERENCES missions(mission_id),
    timestamp TEXT NOT NULL,
    action TEXT NOT NULL,
    value REAL,
    operator_id TEXT NOT NULL DEFAULT 'operator'
);
