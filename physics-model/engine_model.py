"""
Thermodynamic engine model for the digital twin.

Given instantaneous operating conditions (RPM, throttle, altitude, ambient temp),
predicts the *expected nominal* sensor values that a healthy engine should produce.
The difference between predicted and actual is the residual used by ml-fault-rul
for anomaly detection.

Key outputs (matching telemetry_schema.json field names):
  cht_c, egt_c, oil_pressure_kpa, oil_temp_c, fuel_flow_lph

Oil temperature is stateful — modelled as a first-order thermal lag.
Instantiate one ThermodynamicModel per mission and call predict() per frame.

Physics approach:
  1. Look up base CHT from RPM/throttle performance map
  2. Apply altitude (density) correction: less air → worse cooling → higher CHT
  3. Add ambient temperature offset
  4. Derive EGT from CHT + throttle-dependent delta
  5. Oil pressure from RPM map, corrected for oil temperature viscosity drop
  6. Oil temperature: first-order lag tracking cht_influence
  7. Fuel flow: map lookup × density correction
"""

import math
from typing import Optional

from performance_maps import (
    density_ratio,
    lookup_cht_base,
    lookup_egt_delta,
    lookup_oil_pressure_base,
    lookup_fuel_flow_base,
)


class ThermodynamicModel:
    """
    Per-mission stateful thermodynamic model.

    Maintains an oil temperature integrator across frames.

    Args:
        oil_temp_init_c: initial oil temperature at mission start (default: ambient + 20)
        thermal_tau: thermal inertia time constant (frames). Default 60 ≈ 60s at 1Hz.
    """

    def __init__(
        self,
        oil_temp_init_c: float = 60.0,
        thermal_tau: float = 60.0,
    ):
        self._oil_temp_c = oil_temp_init_c
        self._thermal_tau = thermal_tau

    def predict(
        self,
        rpm: float,
        throttle_pct: float,
        altitude_m: float,
        ambient_temp_c: float,
    ) -> dict:
        """
        Predict expected nominal values for a single telemetry frame.

        Returns:
            dict with keys: cht_c, egt_c, oil_pressure_kpa, oil_temp_c, fuel_flow_lph
        """
        rho = density_ratio(altitude_m)

        # --- CHT ---
        # Base from map; altitude thins air so cooling decreases → CHT rises
        # Correction factor: at rho=0.5 (sea level), CHT ≈ map value.
        # At rho=0.6 (5000m), CHT increases by ~1/rho factor (simplified)
        cht_base = lookup_cht_base(rpm, throttle_pct)
        # Altitude correction: poor cooling at altitude → CHT higher
        altitude_correction = 1.0 + 0.25 * (1.0 - rho)   # up to +25% at very high alt
        # Ambient temperature adds a baseline offset (engine never cooler than ambient)
        ambient_offset = max(0.0, (ambient_temp_c - 25.0) * 0.4)
        cht_c = cht_base * altitude_correction + ambient_offset

        # --- EGT ---
        egt_delta = lookup_egt_delta(throttle_pct)
        egt_c = cht_c + egt_delta

        # --- Oil temperature (thermal lag) ---
        # Oil temperature integrates toward a weighted combination of CHT and ambient
        cht_influence = cht_c * 0.6 + ambient_temp_c * 0.4
        self._oil_temp_c += (cht_influence - self._oil_temp_c) / self._thermal_tau
        oil_temp_c = self._oil_temp_c

        # --- Oil pressure ---
        oil_pressure_base = lookup_oil_pressure_base(rpm)
        # Viscosity penalty: oil thins as temp rises above 80°C baseline
        viscosity_penalty = max(0.0, (oil_temp_c - 80.0) * 0.6)
        oil_pressure_kpa = oil_pressure_base - viscosity_penalty
        oil_pressure_kpa = max(80.0, oil_pressure_kpa)

        # --- Fuel flow ---
        # Map gives sea-level value; at altitude, slightly lower volumetric efficiency
        fuel_flow_base = lookup_fuel_flow_base(rpm, throttle_pct)
        # Denser air → better volumetric efficiency → slightly more fuel needed
        fuel_flow_lph = fuel_flow_base * (0.85 + 0.15 * rho)
        fuel_flow_lph = max(0.5, fuel_flow_lph)

        return {
            "cht_c": round(cht_c, 2),
            "egt_c": round(egt_c, 2),
            "oil_pressure_kpa": round(oil_pressure_kpa, 2),
            "oil_temp_c": round(oil_temp_c, 2),
            "fuel_flow_lph": round(fuel_flow_lph, 3),
        }

    def predict_batch(self, frames: list[dict]) -> list[dict]:
        """
        Predict expected values for a list of telemetry frames.
        Maintains state (oil temp) across frames in sequence.

        Args:
            frames: list of telemetry frame dicts (with rpm, throttle_pct, altitude_m, ambient_temp_c)

        Returns:
            list of prediction dicts, one per frame
        """
        results = []
        for frame in frames:
            pred = self.predict(
                rpm=float(frame["rpm"]),
                throttle_pct=float(frame["throttle_pct"]),
                altitude_m=float(frame["altitude_m"]),
                ambient_temp_c=float(frame["ambient_temp_c"]),
            )
            results.append(pred)
        return results

    def compute_residuals(self, frame: dict, prediction: dict) -> dict:
        """
        Compute signed residuals (actual - predicted) for each predicted field.
        Positive residual = running hotter / higher than expected.
        """
        fields = ["cht_c", "egt_c", "oil_pressure_kpa", "oil_temp_c", "fuel_flow_lph"]
        residuals = {}
        for f in fields:
            if f in frame and f in prediction:
                residuals[f"residual_{f}"] = round(float(frame[f]) - float(prediction[f]), 3)
        return residuals

    def reset(self, oil_temp_init_c: float = 60.0) -> None:
        """Reset thermal state (for a new mission)."""
        self._oil_temp_c = oil_temp_init_c


# ---------------------------------------------------------------------------
# Convenience: stateless prediction (no thermal state — useful for one-off)
# ---------------------------------------------------------------------------

def predict_nominal(
    rpm: float,
    throttle_pct: float,
    altitude_m: float,
    ambient_temp_c: float,
    oil_temp_hint_c: Optional[float] = None,
) -> dict:
    """
    Stateless one-shot prediction.
    oil_temp_hint_c seeds the thermal lag integrator if provided.
    """
    init = oil_temp_hint_c if oil_temp_hint_c is not None else ambient_temp_c + 20.0
    model = ThermodynamicModel(oil_temp_init_c=init)
    return model.predict(rpm, throttle_pct, altitude_m, ambient_temp_c)
