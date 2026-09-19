"""
RUL (Remaining Useful Life) estimator using degradation-aware regression.

Design:
  - Uses Gradient Boosted Regressor on a feature set that includes:
    * Current anomaly score (normalized Isolation Forest score)
    * Physics residuals (deviation from expected)
    * Rolling statistical features (trend + volatility)
    * Fault probability (from classifier)
    * Mission elapsed fraction (how far into mission we are)

  - Ground truth RUL is synthetically derived from the training data:
    * For clean missions: RUL = max_rul = 500h (fresh engine)
    * For fault missions: RUL decreases as fault severity increases
      RUL = max_rul × (1 - cumulative_degradation_score)

  - Degradation trend label (stable/degrading/critical) is determined by:
    * stable:   RUL > 80h
    * degrading: 20h < RUL ≤ 80h
    * critical:  RUL ≤ 20h

Note: max_rul_h = 500 is a representative TBO (Time Between Overhaul) for
MALE UAV piston engines. Not sourced from a specific DRDO spec.
"""

import os
import sys
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "physics-model"))
from engine_model import ThermodynamicModel

try:
    from sklearn.ensemble import GradientBoostingRegressor
    from sklearn.preprocessing import StandardScaler
    import joblib
    SKLEARN_OK = True
except ImportError:
    SKLEARN_OK = False

MAX_RUL_HOURS = 500.0   # Full TBO for a healthy engine

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "rul_model.joblib")
SCALER_PATH = os.path.join(os.path.dirname(__file__), "models", "rul_scaler.joblib")


def compute_synthetic_rul(
    frame_idx: int,
    total_frames: int,
    fault_label: str,
    anomaly_score: float,
) -> float:
    """
    Generate a synthetic RUL ground truth label for training.

    For fault-free frames: RUL is near MAX_RUL_HOURS with slight degradation over time.
    For fault frames: RUL decreases proportional to anomaly_score and elapsed fraction.

    This is a training label engineering heuristic — real RUL would come from
    physical degradation models or fleet data.
    """
    mission_elapsed = frame_idx / max(total_frames, 1)

    if fault_label is None or fault_label == "none":
        # Nominal wear: lose ~5% TBO per mission
        rul = MAX_RUL_HOURS * (1.0 - 0.05 * mission_elapsed)
    else:
        # Fault: RUL degrades faster based on anomaly_score
        base_degradation = 0.05 * mission_elapsed   # nominal wear
        fault_degradation = 0.6 * anomaly_score * mission_elapsed
        rul = MAX_RUL_HOURS * (1.0 - base_degradation - fault_degradation)

    return float(max(0.0, rul))


def degradation_trend(rul_hours: float) -> str:
    """Map RUL hours to a trend label."""
    if rul_hours > 80.0:
        return "stable"
    elif rul_hours > 20.0:
        return "degrading"
    else:
        return "critical"


def _frame_to_rul_vector(
    frame: dict,
    residuals: dict,
    anomaly_score: float,
    fault_proba: dict,
    mission_elapsed: float,
) -> list:
    """Build feature vector for RUL regression."""
    raw = [
        float(frame.get("rpm", 5000)),
        float(frame.get("cht_c", 200)),
        float(frame.get("egt_c", 320)),
        float(frame.get("oil_pressure_kpa", 300)),
        float(frame.get("oil_temp_c", 80)),
        float(frame.get("fuel_flow_lph", 10)),
        float(frame.get("vibration_g", 0.1)),
        float(frame.get("throttle_pct", 65)),
        float(frame.get("altitude_m", 1500)),
        float(frame.get("ambient_temp_c", 25)),
    ]
    residual_vec = [
        float(residuals.get("residual_cht_c", 0.0)),
        float(residuals.get("residual_egt_c", 0.0)),
        float(residuals.get("residual_oil_pressure_kpa", 0.0)),
        float(residuals.get("residual_oil_temp_c", 0.0)),
        float(residuals.get("residual_fuel_flow_lph", 0.0)),
    ]
    feat = frame.get("features", {})
    rolling_vec = [
        float(feat.get("cht_c_rolling_std", 0.0)),
        float(feat.get("egt_c_rolling_std", 0.0)),
        float(feat.get("rpm_rolling_std", 0.0)),
        float(feat.get("vibration_g_rolling_std", 0.0)),
        float(feat.get("cht_c_rolling_roc", 0.0)),
        float(feat.get("egt_c_rolling_roc", 0.0)),
    ]
    proba_vec = [
        anomaly_score,
        mission_elapsed,
        float(fault_proba.get("overheating", 0.0)),
        float(fault_proba.get("lubrication_issue", 0.0)),
        float(fault_proba.get("misfire", 0.0)),
        float(fault_proba.get("none", 1.0)),
    ]
    return raw + residual_vec + rolling_vec + proba_vec


class RULEstimator:
    """
    Gradient Boosted RUL regressor.

    Predicts remaining useful life in hours given the full feature set.
    """

    def __init__(self, n_estimators: int = 200, max_depth: int = 5):
        self._n_estimators = n_estimators
        self._max_depth = max_depth
        self._model = None
        self._scaler = None

    def fit(
        self,
        frames: list[dict],
        rul_labels: list[float],
        physics_model: ThermodynamicModel,
        anomaly_scores: list[float] = None,
        fault_probas: list[dict] = None,
        mission_elapsed_list: list[float] = None,
    ) -> None:
        """
        Train the RUL estimator.

        Args:
            frames: telemetry frames (with optional features sub-dict)
            rul_labels: ground truth RUL in hours, one per frame
            physics_model: for computing residuals
            anomaly_scores: pre-computed anomaly scores (or None → zeros)
            fault_probas: pre-computed fault probability dicts (or None → empty)
            mission_elapsed_list: fraction of mission elapsed (or None → zeros)
        """
        if not SKLEARN_OK:
            raise ImportError("scikit-learn required")

        n = len(frames)
        anomaly_scores = anomaly_scores or [0.0] * n
        fault_probas = fault_probas or [{}] * n
        mission_elapsed_list = mission_elapsed_list or [0.0] * n

        X_list = []
        for i, frame in enumerate(frames):
            res = physics_model.compute_residuals(
                frame,
                physics_model.predict(
                    float(frame.get("rpm", 5000)),
                    float(frame.get("throttle_pct", 65)),
                    float(frame.get("altitude_m", 1500)),
                    float(frame.get("ambient_temp_c", 25)),
                )
            )
            vec = _frame_to_rul_vector(
                frame, res, anomaly_scores[i], fault_probas[i], mission_elapsed_list[i]
            )
            X_list.append(vec)

        X = np.array(X_list, dtype=np.float32)
        y = np.array(rul_labels, dtype=np.float32)

        self._scaler = StandardScaler()
        X_scaled = self._scaler.fit_transform(X)

        self._model = GradientBoostingRegressor(
            n_estimators=self._n_estimators,
            max_depth=self._max_depth,
            learning_rate=0.05,
            subsample=0.8,
            random_state=42,
        )
        self._model.fit(X_scaled, y)

        # Training evaluation
        y_pred = self._model.predict(X_scaled)
        mae = float(np.mean(np.abs(y - y_pred)))
        print(f"[RULEstimator] Trained on {n} frames. Training MAE: {mae:.2f}h")

    def predict(
        self,
        frame: dict,
        physics_model: ThermodynamicModel,
        anomaly_score: float = 0.0,
        fault_proba: dict = None,
        mission_elapsed: float = 0.5,
    ) -> dict:
        """
        Predict RUL for a single frame.

        Returns:
            dict with rul_hours (float), confidence (float), degradation_trend (str)
        """
        if self._model is None:
            raise RuntimeError("Model not trained. Call fit() first.")

        res = physics_model.compute_residuals(
            frame,
            physics_model.predict(
                float(frame.get("rpm", 5000)),
                float(frame.get("throttle_pct", 65)),
                float(frame.get("altitude_m", 1500)),
                float(frame.get("ambient_temp_c", 25)),
            )
        )
        vec = _frame_to_rul_vector(frame, res, anomaly_score, fault_proba or {}, mission_elapsed)
        X = np.array([vec], dtype=np.float32)
        X_scaled = self._scaler.transform(X)

        rul_pred = float(self._model.predict(X_scaled)[0])
        rul_pred = max(0.0, min(MAX_RUL_HOURS, rul_pred))

        # Confidence: inversely proportional to prediction variance proxy (anomaly score)
        # Higher anomaly score = less certain
        confidence = float(max(0.3, 1.0 - 0.5 * anomaly_score))
        confidence = round(confidence, 3)

        return {
            "rul_hours": round(rul_pred, 1),
            "confidence": confidence,
            "degradation_trend": degradation_trend(rul_pred),
        }

    def save(self) -> None:
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        joblib.dump(self._model, MODEL_PATH)
        joblib.dump(self._scaler, SCALER_PATH)
        print(f"[RULEstimator] Saved to {MODEL_PATH}")

    def load(self) -> None:
        self._model = joblib.load(MODEL_PATH)
        self._scaler = joblib.load(SCALER_PATH)
        print(f"[RULEstimator] Loaded from {MODEL_PATH}")
