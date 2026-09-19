"""
SHAP-based explainability for fault classification and RUL predictions.

Produces contributing_factors: a ranked list of human-readable explanations
describing which sensor/feature deviations are driving the current prediction.

Approach:
  - Uses SHAP TreeExplainer (fast for tree-based models like RF and GBT)
  - For fault classification: SHAP values for the predicted fault class
  - For RUL: SHAP values for the regression output
  - Maps SHAP feature importances to human-readable messages

Human-readable mappings are kept in a lookup table that translates
feature names to phrases like "elevated CHT residual" or "RPM instability".
"""

import sys
import os
import numpy as np

try:
    import shap
    SHAP_OK = True
except ImportError:
    SHAP_OK = False

# Human-readable descriptions for each feature
FEATURE_DESCRIPTIONS = {
    # Raw telemetry
    "cht_c": "cylinder head temperature",
    "egt_c": "exhaust gas temperature",
    "rpm": "engine RPM",
    "oil_pressure_kpa": "oil pressure",
    "oil_temp_c": "oil temperature",
    "fuel_flow_lph": "fuel flow rate",
    "vibration_g": "engine vibration",
    "battery_voltage_v": "battery voltage",
    "alternator_current_a": "alternator current",
    "injection_timing_deg": "injection timing",
    "throttle_pct": "throttle position",
    "altitude_m": "altitude",
    "ambient_temp_c": "ambient temperature",
    # Residuals
    "residual_cht_c": "CHT deviation from expected",
    "residual_egt_c": "EGT deviation from expected",
    "residual_oil_pressure_kpa": "oil pressure deviation from expected",
    "residual_oil_temp_c": "oil temp deviation from expected",
    "residual_fuel_flow_lph": "fuel flow deviation from expected",
    # Rolling features
    "cht_c_rolling_std": "CHT volatility",
    "egt_c_rolling_std": "EGT volatility",
    "rpm_rolling_std": "RPM instability",
    "vibration_g_rolling_std": "vibration variability",
    "cht_c_rolling_roc": "CHT rate of change",
    "egt_c_rolling_roc": "EGT rate of change",
    "oil_pressure_kpa_rolling_std": "oil pressure variability",
    "fuel_flow_lph_rolling_std": "fuel flow variability",
}


class SHAPExplainer:
    """
    SHAP explainer wrapper for fault classifier and RUL estimator.

    Creates one TreeExplainer per model when first explain() is called.
    """

    def __init__(self):
        self._clf_explainer = None
        self._rul_explainer = None

    def _get_clf_explainer(self, clf_model, scaler, X_background: np.ndarray):
        """Lazily create/cache the classifier SHAP explainer."""
        if self._clf_explainer is None and SHAP_OK:
            # Use tree explainer directly on the RF model
            self._clf_explainer = shap.TreeExplainer(clf_model)
        return self._clf_explainer

    def _get_rul_explainer(self, rul_model):
        """Lazily create/cache the RUL SHAP explainer."""
        if self._rul_explainer is None and SHAP_OK:
            self._rul_explainer = shap.TreeExplainer(rul_model)
        return self._rul_explainer

    def explain_fault(
        self,
        clf,          # FaultClassifier instance
        frame_vec: np.ndarray,
        predicted_class_idx: int,
        feature_names: list,
        top_k: int = 5,
    ) -> list[str]:
        """
        Get top-k contributing factors for a fault prediction.

        Returns:
            list of human-readable strings, e.g. ["elevated CHT deviation from expected (+45°C)"]
        """
        if not SHAP_OK:
            return _fallback_factors(frame_vec, feature_names, top_k)

        try:
            explainer = self._get_clf_explainer(clf._model, clf._scaler, frame_vec)
            # Compute SHAP values — shape: (n_classes, n_features) for multi-class RF
            shap_values = explainer.shap_values(frame_vec)
            # shap_values[class_idx] is the array of SHAP values for that class
            if isinstance(shap_values, list):
                sv = shap_values[predicted_class_idx][0]
            else:
                sv = shap_values[0]

            return _format_factors(sv, feature_names, frame_vec[0], top_k)
        except Exception as e:
            # Fallback to magnitude-based ranking if SHAP fails
            return _fallback_factors(frame_vec, feature_names, top_k)

    def explain_rul(
        self,
        rul_estimator,    # RULEstimator instance
        frame_vec: np.ndarray,
        feature_names: list,
        top_k: int = 5,
    ) -> list[str]:
        """
        Get top-k contributing factors for an RUL prediction.
        """
        if not SHAP_OK:
            return _fallback_factors(frame_vec, feature_names, top_k)

        try:
            explainer = self._get_rul_explainer(rul_estimator._model)
            shap_values = explainer.shap_values(frame_vec)
            if hasattr(shap_values, "__len__") and len(shap_values.shape) > 1:
                sv = shap_values[0]
            else:
                sv = shap_values[0] if len(shap_values.shape) > 0 else shap_values
            return _format_factors(sv, feature_names, frame_vec[0], top_k)
        except Exception as e:
            return _fallback_factors(frame_vec, feature_names, top_k)


def _format_factors(shap_vals, feature_names: list, raw_vals, top_k: int) -> list[str]:
    """Format SHAP values as human-readable strings."""
    abs_shap = np.abs(shap_vals)
    top_indices = np.argsort(abs_shap)[::-1][:top_k]

    factors = []
    for idx in top_indices:
        if idx >= len(feature_names):
            continue
        fname = feature_names[idx]
        description = FEATURE_DESCRIPTIONS.get(fname, fname.replace("_", " "))
        sv = float(shap_vals[idx])
        direction = "elevated" if sv > 0 else "reduced"

        # Try to include the actual value for context
        if isinstance(raw_vals, (np.ndarray, list)) and idx < len(raw_vals):
            val = float(raw_vals[idx])
            factors.append(f"{direction} {description} ({val:+.1f})")
        else:
            factors.append(f"{direction} {description}")

    return factors


def _fallback_factors(frame_vec: np.ndarray, feature_names: list, top_k: int) -> list[str]:
    """When SHAP unavailable, return top features by raw magnitude."""
    if frame_vec is None or len(frame_vec) == 0:
        return ["insufficient data for explanation"]

    vals = np.abs(frame_vec[0]) if hasattr(frame_vec, "shape") and len(frame_vec.shape) > 1 else np.abs(frame_vec)
    top_indices = np.argsort(vals)[::-1][:top_k]

    factors = []
    for idx in top_indices:
        if idx < len(feature_names):
            fname = feature_names[idx]
            description = FEATURE_DESCRIPTIONS.get(fname, fname.replace("_", " "))
            factors.append(description)

    return factors if factors else ["anomalous sensor readings detected"]
