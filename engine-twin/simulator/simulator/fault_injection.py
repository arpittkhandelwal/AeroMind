"""
fault_injection.py
==================
One function per fault type.  Each function returns a *delta dict* — additive
perturbations on top of the current healthy engine state — that
:meth:`EngineModel.apply_perturbation` will apply.

Fault classes (6)
-----------------
1. misfire              — misfiring cylinder
2. injector             — stuck/clogged fuel injector
3. lubrication          — oil system degradation
4. sensor_drift         — sensor bias / calibration drift
5. combustion           — combustion instability / lean blow-out
6. overheating          — coolant or oil overheating event

TODO (ML team): calibrate the magnitude of these perturbations against
real engine test-cell data or published FADEC fault signatures so the
classifier has realistic training targets.
"""

from __future__ import annotations

import numpy as np

_rng = np.random.default_rng()


# ---------------------------------------------------------------------------
# Individual fault injectors
# ---------------------------------------------------------------------------


def misfire(severity: float = 1.0) -> dict:
    """
    Misfiring cylinder: RPM drops, EGT spikes (unburnt charge in exhaust),
    vibration increases.

    severity: 0.0 (incipient) → 1.0 (severe)
    TODO: add cyclic RPM fluctuation pattern.
    """
    return {
        "rpm":       -150.0 * severity + _rng.normal(0, 10),
        "egt":       +80.0  * severity + _rng.normal(0, 5),
        "vibration": +0.25  * severity + _rng.normal(0, 0.02),
        "fuel_flow": +1.5   * severity,   # unburnt fuel
    }


def injector(severity: float = 1.0) -> dict:
    """
    Stuck/clogged injector: fuel flow drops, EGT rises (lean cylinder),
    RPM slightly reduced.

    TODO: model per-cylinder EGT spread.
    """
    return {
        "fuel_flow":    -3.0  * severity + _rng.normal(0, 0.2),
        "egt":          +60.0 * severity + _rng.normal(0, 5),
        "rpm":          -80.0 * severity,
    }


def lubrication(severity: float = 1.0) -> dict:
    """
    Oil system fault: oil pressure drops, oil temperature rises,
    CHT increases due to reduced heat transfer.

    TODO: model oil pressure as function of oil viscosity & bearing clearance.
    """
    return {
        "oil_pressure": -1.8  * severity + _rng.normal(0, 0.05),
        "oil_temp":     +25.0 * severity + _rng.normal(0, 1),
        "cht":          +20.0 * severity + _rng.normal(0, 2),
    }


def sensor_drift(severity: float = 1.0) -> dict:
    """
    Sensor calibration drift — adds a persistent bias rather than noise.
    Affects EGT (thermocouple cold-junction drift) and oil pressure (transducer offset).

    TODO: model as a slowly ramping bias with random walk.
    """
    return {
        "egt":          +30.0 * severity,   # thermocouple offset
        "oil_pressure": -0.3  * severity,   # transducer bias
    }


def combustion_instability(severity: float = 1.0) -> dict:
    """
    Lean blow-out / combustion instability: high EGT variance, reduced power,
    increased vibration.

    TODO: add cyclic variation (COV of IMEP model).
    """
    return {
        "egt":       +50.0  * severity + _rng.normal(0, 15),  # high variance
        "rpm":       -120.0 * severity + _rng.normal(0, 30),
        "vibration": +0.18  * severity + _rng.normal(0, 0.03),
    }


def overheating(severity: float = 1.0) -> dict:
    """
    Cooling system failure / sustained high-power: CHT and oil temp rise rapidly.

    TODO: implement thermal model with time constant.
    """
    return {
        "cht":       +60.0 * severity + _rng.normal(0, 3),
        "oil_temp":  +35.0 * severity + _rng.normal(0, 2),
        "egt":       +40.0 * severity,
    }


# ---------------------------------------------------------------------------
# Dispatch table — used by publisher.py
# ---------------------------------------------------------------------------

FAULT_MAP: dict[str, callable] = {
    "misfire":       misfire,
    "injector":      injector,
    "lubrication":   lubrication,
    "sensor_drift":  sensor_drift,
    "combustion":    combustion_instability,
    "overheating":   overheating,
}


def get_fault_delta(scenario: str, severity: float = 1.0) -> tuple[dict, str | None]:
    """
    Return (delta_dict, fault_label).
    Returns ({}, None) for scenario == 'normal'.
    """
    if scenario == "normal":
        return {}, None
    fn = FAULT_MAP.get(scenario)
    if fn is None:
        raise ValueError(f"Unknown fault scenario '{scenario}'. Valid: {list(FAULT_MAP)}")
    return fn(severity), scenario
