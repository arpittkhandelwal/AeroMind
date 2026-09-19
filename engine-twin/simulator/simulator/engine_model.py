"""
engine_model.py
===============
Generates plausible steady-state + transient sensor readings for a small
aero piston engine (think Rotax 912 / Lycoming O-360 class).

All values are *representative* ranges — the team should replace the
placeholder physics with proper equations derived from engine data.

Sensor channels
---------------
  rpm           — crankshaft speed (RPM)
  egt           — exhaust gas temperature (°C)
  cht           — cylinder head temperature (°C)
  oil_pressure  — oil gallery pressure (bar)
  oil_temp      — oil sump temperature (°C)
  fuel_flow     — fuel flow rate (L/h)
  vibration     — RMS lateral vibration (g)
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

# ---------------------------------------------------------------------------
# Nominal operating envelope (healthy engine, sea-level, ISA+15 °C)
# ---------------------------------------------------------------------------
NOMINAL = {
    "rpm":          (2200.0, 2600.0),   # cruise band
    "egt":          (680.0,  780.0),    # °C
    "cht":          (150.0,  200.0),    # °C
    "oil_pressure": (3.8,    5.2),      # bar
    "oil_temp":     (80.0,   100.0),    # °C
    "fuel_flow":    (14.0,   18.0),     # L/h
    "vibration":    (0.05,   0.15),     # g RMS
}

# Noise standard-deviations (fraction of nominal mid-point)
NOISE_SIGMA = {
    "rpm":          5.0,
    "egt":          2.0,
    "cht":          1.5,
    "oil_pressure": 0.02,
    "oil_temp":     0.5,
    "fuel_flow":    0.1,
    "vibration":    0.005,
}


@dataclass
class EngineState:
    """Mutable engine operating point updated every cycle."""

    rpm:           float = 2400.0
    egt:           float = 730.0
    cht:           float = 175.0
    oil_pressure:  float = 4.5
    oil_temp:      float = 90.0
    fuel_flow:     float = 16.0
    vibration:     float = 0.10
    altitude:      float = 0.0       # metres MSL (set by mission profile)
    ambient_temp:  float = 15.0      # °C ISA
    fault_label:   Optional[str] = None

    _t: float = field(default_factory=time.monotonic, repr=False)


class EngineModel:
    """
    Produces one telemetry sample per call to :meth:`tick`.

    TODO (team): replace the Gaussian noise with proper thermodynamic
    correlations between RPM, EGT, CHT, oil temp, and fuel flow.
    """

    def __init__(self, rng_seed: Optional[int] = None) -> None:
        self._rng = np.random.default_rng(rng_seed)
        self._state = EngineState()
        self._cycle: int = 0

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def tick(self) -> EngineState:
        """Advance the simulation by one timestep and return the new state."""
        self._cycle += 1
        s = self._state

        # TODO: replace with physics-based differential equations
        s.rpm = self._noisy(s.rpm, NOMINAL["rpm"], NOISE_SIGMA["rpm"])
        s.egt = self._noisy(s.egt, NOMINAL["egt"], NOISE_SIGMA["egt"])
        s.cht = self._noisy(s.cht, NOMINAL["cht"], NOISE_SIGMA["cht"])
        s.oil_pressure = self._noisy(s.oil_pressure, NOMINAL["oil_pressure"], NOISE_SIGMA["oil_pressure"])
        s.oil_temp = self._noisy(s.oil_temp, NOMINAL["oil_temp"], NOISE_SIGMA["oil_temp"])
        s.fuel_flow = self._noisy(s.fuel_flow, NOMINAL["fuel_flow"], NOISE_SIGMA["fuel_flow"])
        s.vibration = self._noisy(s.vibration, NOMINAL["vibration"], NOISE_SIGMA["vibration"])

        return s

    def set_mission_conditions(self, altitude: float, ambient_temp: float) -> None:
        """Push ambient conditions from the mission profile."""
        self._state.altitude = altitude
        self._state.ambient_temp = ambient_temp
        # TODO: adjust nominal bands based on altitude (density altitude effect)

    def apply_perturbation(self, delta: dict) -> None:
        """
        Fault-injection hook: fault_injection.py calls this with a dict of
        additive offsets, e.g. {"egt": +80, "rpm": -150}.
        """
        s = self._state
        for key, offset in delta.items():
            if hasattr(s, key):
                setattr(s, key, getattr(s, key) + offset)

    def set_fault_label(self, label: Optional[str]) -> None:
        self._state.fault_label = label

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _noisy(self, current: float, band: tuple[float, float], sigma: float) -> float:
        """
        Drift current value toward mid-band with Gaussian noise.

        TODO: replace with proper auto-regressive model or ODE integrator.
        """
        mid = (band[0] + band[1]) / 2
        # Gentle mean-reversion so the signal doesn't random-walk off
        next_val = current + 0.05 * (mid - current) + self._rng.normal(0, sigma)
        # Soft clamp within ±20 % of nominal band width
        lo = band[0] - 0.2 * (band[1] - band[0])
        hi = band[1] + 0.2 * (band[1] - band[0])
        return float(np.clip(next_val, lo, hi))
