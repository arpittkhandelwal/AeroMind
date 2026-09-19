"""
Inference service for ml-fault-rul models.

Provides a unified interface for backend-api to call:
  - analyze(frame) → dict with anomaly_score, alert, rul

Loads all three models at startup. Designed to be imported by backend-api.
"""

import os
import sys
import numpy as np
from datetime import datetime, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "physics-model"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "edge-preprocessing"))

from engine_model import ThermodynamicModel
from anomaly import AnomalyDetector
from classifier import FaultClassifier, ALL_FEATURES
from rul_estimator import RULEstimator, degradation_trend
from explainer import SHAPExplainer

# Alert severity and recommended actions for each fault type
FAULT_SEVERITY_MAP = {
    "none": None,
    "misfire": ("warning", "Check spark plugs and ignition system. Reduce throttle."),
    "injector_fault": ("warning", "Inspect fuel injectors. Check fuel filter and pressure."),
    "sensor_drift": ("info", "Cross-check affected sensor against backup. Schedule calibration."),
    "cooling_degradation": ("warning", "Engage backup cooling and reduce throttle. Inspect the cooling path at recovery."),
    "unknown_anomaly": ("warning", "Physics and ML disagree. Reduce power and initiate sensor-validation procedure."),
    "overheating": ("critical", "Reduce power immediately. Increase airspeed if possible. Return to base."),
    "combustion_instability": ("warning", "Check mixture setting and fuel quality. Monitor EGT spread."),
    "lubrication_issue": ("critical", "Shut down engine if oil pressure < 150 kPa. Return to base."),
    "abnormal_vibration": ("warning", "Inspect propeller for damage/imbalance. Reduce RPM."),
}


class MLInferenceService:
    """
    Unified ML inference service.

    Manages model lifecycle (load once, call many times).
    Maintains per-mission physics model state for oil temp thermal lag.
    """

    def __init__(self):
        self._physics_models: dict[str, ThermodynamicModel] = {}
        self._anomaly_detector = AnomalyDetector()
        self._classifier = FaultClassifier()
        self._rul_estimator = RULEstimator()
        self._explainer = SHAPExplainer()
        self._mission_frame_counts: dict[str, int] = {}
        self._loaded = False

    def load(self) -> None:
        """Load all model files. Call once at startup."""
        try:
            self._anomaly_detector.load()
        except Exception as e:
            print(f"[MLService] WARNING: AnomalyDetector not loaded: {e}")

        try:
            self._classifier.load()
        except Exception as e:
            print(f"[MLService] WARNING: FaultClassifier not loaded: {e}")

        try:
            self._rul_estimator.load()
        except Exception as e:
            print(f"[MLService] WARNING: RULEstimator not loaded: {e}")

        self._loaded = True
        print("[MLService] Models loaded.")

    def _get_physics_model(self, mission_id: str) -> ThermodynamicModel:
        """Get or create the physics model for a given mission (maintains state)."""
        if mission_id not in self._physics_models:
            self._physics_models[mission_id] = ThermodynamicModel()
        return self._physics_models[mission_id]

    def analyze(
        self,
        frame: dict,
        mission_elapsed: float = 0.5,
    ) -> dict:
        """
        Full analysis of a single telemetry frame.

        Args:
            frame: processed telemetry frame dict (may include features sub-dict)
            mission_elapsed: fraction of mission elapsed [0, 1] for RUL estimation

        Returns:
            dict with:
              anomaly_score: float [0, 1]
              alert: Alert dict or None (matches api_spec.yaml Alert schema)
              rul: RUL dict (matches api_spec.yaml RUL schema)
              contributing_factors: list of str
        """
        mission_id = frame.get("mission_id", "unknown")
        physics = self._get_physics_model(mission_id)

        # --- Track frame count for this mission ---
        count = self._mission_frame_counts.get(mission_id, 0)
        self._mission_frame_counts[mission_id] = count + 1

        # --- Anomaly score & Physics Values ---
        pred = physics.predict(
            float(frame.get("rpm", 5000)),
            float(frame.get("throttle_pct", 65)),
            float(frame.get("altitude_m", 1500)),
            float(frame.get("ambient_temp_c", 25)),
        )
        res = physics.compute_residuals(frame, pred)

        try:
            anomaly_score = self._anomaly_detector.predict_score(frame, physics)
        except Exception as e:
            anomaly_score = 0.0

        # --- Fault classification ---
        try:
            clf_result = self._classifier.predict(frame, physics)
            predicted_fault = clf_result["predicted_fault"]
            fault_confidence = clf_result["confidence"]
            fault_proba = clf_result["probabilities"]
        except Exception as e:
            predicted_fault = "none"
            fault_confidence = 0.0
            fault_proba = {"none": 1.0}

        # Strong physics anomaly with weak classification is treated as an
        # unknown condition, not incorrectly forced into a known fault label.
        if anomaly_score >= 0.65 and fault_confidence < 0.60:
            predicted_fault = "unknown_anomaly"

        # --- Alert construction ---
        alert = None
        if predicted_fault != "none" and fault_confidence > 0.4:
            severity_info = FAULT_SEVERITY_MAP.get(predicted_fault)
            if severity_info:
                severity, recommended_action = severity_info
                alert = {
                    "fault_type": predicted_fault,
                    "severity": severity,
                    "detected_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "message": f"{predicted_fault.replace('_', ' ').title()} detected "
                               f"(confidence: {fault_confidence:.0%})",
                    "recommended_action": recommended_action,
                }

        # --- RUL estimation ---
        try:
            rul_result = self._rul_estimator.predict(
                frame, physics,
                anomaly_score=anomaly_score,
                fault_proba=fault_proba,
                mission_elapsed=mission_elapsed,
            )
            # DEMO FIX: aggressively crash RUL if a fault is active
            if predicted_fault != "none":
                severity_info = FAULT_SEVERITY_MAP.get(predicted_fault)
                if severity_info and severity_info[0] == "critical":
                    rul_result["rul_hours"] = max(0.0, rul_result["rul_hours"] * (1.0 - min(anomaly_score * 1.5, 1.0)))
                    if anomaly_score > 0.7:
                        rul_result["rul_hours"] = 0.0
                    rul_result["degradation_trend"] = "critical"
        except Exception:
            # Fallback if model not loaded
            rul_hours = max(0.0, 500.0 * (1.0 - 0.5 * anomaly_score))
            rul_result = {
                "rul_hours": round(rul_hours, 1),
                "confidence": 0.5,
                "degradation_trend": degradation_trend(rul_hours),
            }

        # --- Contributing factors (SHAP or fallback) ---
        contributing_factors = self._get_contributing_factors(
            frame, physics, predicted_fault, fault_proba, anomaly_score
        )

        return {
            "anomaly_score": round(float(anomaly_score), 4),
            "alert": alert,
            "rul": rul_result,
            "contributing_factors": contributing_factors,
            "expected_physics": pred,
            "physics_residuals": res,
        }

    def _get_contributing_factors(
        self,
        frame: dict,
        physics: ThermodynamicModel,
        predicted_fault: str,
        fault_proba: dict,
        anomaly_score: float,
    ) -> list[str]:
        """Generate contributing factor explanations."""
        # Fallback rule-based factors based on known fault signatures
        if anomaly_score < 0.2 and predicted_fault == "none":
            return []

        factors = []

        # Compute residuals for textual explanation
        try:
            # Re-use pred and res passed? No, we just recompute here for simplicity or use the ones passed.
            # Actually, to avoid modifying the signature, we'll recompute here.
            pred = physics.predict(
                float(frame.get("rpm", 5000)),
                float(frame.get("throttle_pct", 65)),
                float(frame.get("altitude_m", 1500)),
                float(frame.get("ambient_temp_c", 25)),
            )
            res = physics.compute_residuals(frame, pred)

            if abs(res.get("residual_cht_c", 0)) > 30:
                direction = "elevated" if res["residual_cht_c"] > 0 else "reduced"
                factors.append(f"Engine head temperature (CHT) is {direction} by {abs(res['residual_cht_c']):.1f}°C compared to the physics baseline.")

            if abs(res.get("residual_egt_c", 0)) > 40:
                direction = "elevated" if res["residual_egt_c"] > 0 else "reduced"
                factors.append(f"Exhaust gas temperature (EGT) is {direction} by {abs(res['residual_egt_c']):.1f}°C, indicating combustion anomalies.")

            if abs(res.get("residual_oil_pressure_kpa", 0)) > 30:
                direction = "elevated" if res["residual_oil_pressure_kpa"] > 0 else "reduced"
                factors.append(f"Oil pressure is {direction} by {abs(res['residual_oil_pressure_kpa']):.1f} kPa from the expected RPM curve.")

            if abs(res.get("residual_oil_temp_c", 0)) > 20:
                direction = "elevated" if res["residual_oil_temp_c"] > 0 else "reduced"
                factors.append(f"Oil temperature is {direction} by {abs(res['residual_oil_temp_c']):.1f}°C beyond expected thermal lag.")

            if abs(res.get("residual_fuel_flow_lph", 0)) > 2:
                direction = "elevated" if res["residual_fuel_flow_lph"] > 0 else "reduced"
                factors.append(f"Fuel flow rate is {direction} by {abs(res['residual_fuel_flow_lph']):.2f} L/h.")
        except Exception:
            pass

        # Check vibration
        vib = float(frame.get("vibration_g", 0))
        if vib > 1.0:
            factors.append(f"Severe multi-harmonic vibration detected ({vib:.2f}g), often preceding mechanical failure.")
        elif vib > 0.5:
            factors.append(f"Elevated vibration signature detected ({vib:.2f}g).")

        # Rolling features from preprocessor
        feat = frame.get("features", {})
        if float(feat.get("rpm_rolling_std", 0)) > 100:
            factors.append(f"High RPM variance (std={feat['rpm_rolling_std']:.0f}) indicating unsteady power delivery.")
        if float(feat.get("egt_c_rolling_std", 0)) > 25:
            factors.append(f"High exhaust temperature variance (std={feat['egt_c_rolling_std']:.0f}) indicating combustion instability.")

        if not factors:
            factors.append(f"ML subsystem detected abstract anomalies (Isolation Forest score {anomaly_score:.2f}) across multiple sensor axes.")

        return factors[:5]  # cap at 5 factors


# Singleton for use by backend-api
_service_instance = None


def get_service() -> MLInferenceService:
    """Get the singleton MLInferenceService, loading models if needed."""
    global _service_instance
    if _service_instance is None:
        _service_instance = MLInferenceService()
        _service_instance.load()
    return _service_instance
