"""
Anomaly detection using physics model residuals.

Approach:
  - For each frame, compute residuals between actual sensor values and
    physics-model expected values: residual_X = actual_X - predicted_X
  - Feed residuals into an Isolation Forest (scikit-learn) trained on
    clean (healthy) mission data. The contamination parameter reflects
    the expected fraction of anomalous frames in the training data.
  - Anomaly score is normalized to [0, 1] where 1 = most anomalous.

The anomaly score is later used by the health index formula and as a
feature for the RUL regression.
"""

import os
import sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "physics-model"))

from engine_model import ThermodynamicModel

try:
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    import joblib
    SKLEARN_OK = True
except ImportError:
    SKLEARN_OK = False


RESIDUAL_FEATURES = [
    "residual_cht_c",
    "residual_egt_c",
    "residual_oil_pressure_kpa",
    "residual_oil_temp_c",
    "residual_fuel_flow_lph",
]

# Additional raw features fed to anomaly detector
RAW_FEATURES = [
    "vibration_g",
    "battery_voltage_v",
    "injection_timing_deg",
    "throttle_pct",
]

ALL_ANOMALY_FEATURES = RESIDUAL_FEATURES + RAW_FEATURES

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "anomaly_model.joblib")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "models", "anomaly_scaler.joblib")


def _compute_residuals(frame: dict, physics_model: ThermodynamicModel) -> dict:
    """Compute physics residuals for a single frame."""
    pred = physics_model.predict(
        rpm=float(frame.get("rpm", 5000)),
        throttle_pct=float(frame.get("throttle_pct", 65)),
        altitude_m=float(frame.get("altitude_m", 1500)),
        ambient_temp_c=float(frame.get("ambient_temp_c", 25)),
    )
    return physics_model.compute_residuals(frame, pred)


def _frame_to_anomaly_vector(frame: dict, residuals: dict) -> list:
    """Convert a frame + residuals to a flat feature vector."""
    vec = []
    for f in RESIDUAL_FEATURES:
        vec.append(float(residuals.get(f, 0.0)))
    for f in RAW_FEATURES:
        vec.append(float(frame.get(f, 0.0)))
    return vec


class AnomalyDetector:
    """
    Isolation Forest anomaly detector on physics residuals.

    The detector is trained on healthy mission data only (contamination=0.05
    to tolerate occasional sensor noise in training data).
    """

    def __init__(self, contamination: float = 0.05, n_estimators: int = 100):
        self._contamination = contamination
        self._n_estimators = n_estimators
        self._model = None
        self._scaler = None
        self._score_min = -1.0   # calibrated during training
        self._score_max = 0.0

    def fit(self, frames: list[dict], physics_model: ThermodynamicModel) -> None:
        """Train the anomaly detector on a list of telemetry frames."""
        if not SKLEARN_OK:
            raise ImportError("scikit-learn required for anomaly detection")

        vectors = []
        for frame in frames:
            res = _compute_residuals(frame, physics_model)
            vec = _frame_to_anomaly_vector(frame, res)
            vectors.append(vec)

        X = np.array(vectors, dtype=np.float32)

        # Standardize
        self._scaler = StandardScaler()
        X_scaled = self._scaler.fit_transform(X)

        # Train Isolation Forest
        self._model = IsolationForest(
            n_estimators=self._n_estimators,
            contamination=self._contamination,
            random_state=42,
            n_jobs=-1,
        )
        self._model.fit(X_scaled)

        # Calibrate score range from training data
        raw_scores = self._model.score_samples(X_scaled)
        self._score_min = float(raw_scores.min())
        self._score_max = float(raw_scores.max())

        print(f"[AnomalyDetector] Trained on {len(frames)} frames. "
              f"Score range: [{self._score_min:.3f}, {self._score_max:.3f}]")

    def predict_score(self, frame: dict, physics_model: ThermodynamicModel) -> float:
        """
        Return normalized anomaly score in [0, 1].
        0 = healthy, 1 = highly anomalous.
        """
        if self._model is None:
            raise RuntimeError("Model not trained. Call fit() first.")

        res = _compute_residuals(frame, physics_model)
        vec = _frame_to_anomaly_vector(frame, res)
        X = np.array([vec], dtype=np.float32)
        X_scaled = self._scaler.transform(X)
        raw_score = float(self._model.score_samples(X_scaled)[0])

        # Normalize: lower IF score = more anomalous → invert
        denom = self._score_max - self._score_min
        if denom < 1e-9:
            return 0.0
        normalized = (raw_score - self._score_min) / denom
        return float(np.clip(1.0 - normalized, 0.0, 1.0))

    def save(self, model_path: str = MODEL_PATH, scaler_path: str = SCALER_PATH) -> None:
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        joblib.dump({"model": self._model, "score_min": self._score_min, "score_max": self._score_max}, model_path)
        joblib.dump(self._scaler, scaler_path)
        print(f"[AnomalyDetector] Saved to {model_path}")

    def load(self, model_path: str = MODEL_PATH, scaler_path: str = SCALER_PATH) -> None:
        data = joblib.load(model_path)
        self._model = data["model"]
        self._score_min = data["score_min"]
        self._score_max = data["score_max"]
        self._scaler = joblib.load(scaler_path)
        print(f"[AnomalyDetector] Loaded from {model_path}")
