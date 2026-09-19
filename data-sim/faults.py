"""
Fault injectors for synthetic telemetry.

Design:
- Each fault starts at ramp_start_frac (fraction into mission) and ramps to full
  severity over ramp_frames. This avoids step-change discontinuities.
- severity_factor in [0, 1] is the current ramp level; each injector multiplies its
  deltas by severity_factor.
- Faults can have stochastic components (oscillations, intermittent drops) that
  grow with severity_factor.

Assumption: one fault active at a time in simulations (composite faults not modelled
in MVP). The fault_label field carries the active fault name or None.

Fault list (7, matching telemetry_schema.json enum):
  misfire, injector_fault, sensor_drift, cooling_degradation, overheating,
  combustion_instability, lubrication_issue, abnormal_vibration
"""

import math
import random
from typing import Optional

FAULT_TYPES = [
    "misfire",
    "injector_fault",
    "sensor_drift",
    "cooling_degradation",
    "overheating",
    "combustion_instability",
    "lubrication_issue",
    "abnormal_vibration",
]


def _ramp(frame_idx: int, ramp_start: int, ramp_end: int) -> float:
    """Smooth sigmoid ramp from 0 to 1 between ramp_start and ramp_end frames."""
    if frame_idx < ramp_start:
        return 0.0
    if frame_idx >= ramp_end:
        return 1.0
    progress = (frame_idx - ramp_start) / max(ramp_end - ramp_start, 1)
    # Sigmoid for smooth onset
    x = (progress - 0.5) * 10
    return 1.0 / (1.0 + math.exp(-x))


class FaultInjector:
    """
    Wraps a fault type and tracks injection state across frames.

    Args:
        fault_type: one of FAULT_TYPES
        ramp_start_frame: absolute frame index where fault begins to develop
        ramp_frames: number of frames to ramp from 0 to full severity (default 60s)
        seed: RNG seed for reproducibility
    """

    def __init__(
        self,
        fault_type: str,
        ramp_start_frame: int,
        ramp_frames: int = 60,
        seed: Optional[int] = None,
    ):
        if fault_type not in FAULT_TYPES:
            raise ValueError(f"Unknown fault type: {fault_type}")
        self.fault_type = fault_type
        self.ramp_start = ramp_start_frame
        self.ramp_end = ramp_start_frame + ramp_frames
        self._rng = random.Random(seed)

    def severity_at(self, frame_idx: int) -> float:
        return _ramp(frame_idx, self.ramp_start, self.ramp_end)

    def is_active(self, frame_idx: int) -> bool:
        return frame_idx >= self.ramp_start

    def apply(self, frame: dict, frame_idx: int) -> dict:
        """
        Modify frame in-place and return it.
        Applies fault-specific deltas scaled by severity_factor.
        """
        sev = self.severity_at(frame_idx)
        if sev == 0.0:
            return frame

        fn = _FAULT_HANDLERS.get(self.fault_type)
        if fn:
            fn(frame, sev, self._rng)

        # Set fault_label once severity is non-trivial
        if sev > 0.05:
            frame["fault_label"] = self.fault_type

        return frame


# ---------------------------------------------------------------------------
# Individual fault handler functions
# Each receives (frame_dict, severity [0-1], rng) and modifies frame in-place
# ---------------------------------------------------------------------------

def _misfire(frame: dict, sev: float, rng: random.Random) -> None:
    """
    Misfires: intermittent RPM drops, EGT spikes (unburnt charge),
    vibration increases, battery voltage slight sag.
    At full severity: RPM drops ~12%, EGT spikes +100°C, vibration +1.5g.
    """
    # Intermittent: ~40% of frames at full severity show a spike
    prob = 0.4 * sev
    if rng.random() < prob:
        frame["rpm"] = frame["rpm"] * (1.0 - 0.12 * sev + rng.gauss(0, 0.01))
        frame["egt_c"] = frame["egt_c"] + 100 * sev + rng.gauss(0, 8)
        frame["vibration_g"] = frame["vibration_g"] + 1.5 * sev + rng.gauss(0, 0.15)
        frame["battery_voltage_v"] = frame["battery_voltage_v"] - 0.8 * sev
    # Persistent: gradual CHT delta + injection instability
    frame["cht_c"] = frame["cht_c"] + 25 * sev + rng.gauss(0, 2)
    frame["vibration_g"] = max(0, frame["vibration_g"] + 0.4 * sev)
    frame["injection_timing_deg"] = frame["injection_timing_deg"] + rng.gauss(0, 2 * sev)


def _injector_fault(frame: dict, sev: float, rng: random.Random) -> None:
    """
    Injector fault: fuel delivery reduces → lean mixture → EGT drops below nominal,
    RPM drops, fuel_flow drops dramatically. At full severity: -50% fuel flow.
    Lean mixture causes CHT to spike (overheating from lean burn) even as EGT drops.
    """
    frame["fuel_flow_lph"] = max(0.5, frame["fuel_flow_lph"] * (1.0 - 0.50 * sev))
    frame["egt_c"] = frame["egt_c"] - 60 * sev + rng.gauss(0, 4)  # lean → lower EGT
    frame["cht_c"] = frame["cht_c"] + 20 * sev + rng.gauss(0, 3)   # lean burn → hot pistons
    frame["rpm"] = frame["rpm"] * (1.0 - 0.08 * sev)
    frame["injection_timing_deg"] = frame["injection_timing_deg"] + 8 * sev + rng.gauss(0, 1)


def _sensor_drift(frame: dict, sev: float, rng: random.Random) -> None:
    """
    Sensor drift: sensors gradually diverge from true physical values.
    CHT and oil_pressure drift linearly — no real engine change, just bad readings.
    The physics residual will flag this as anomalous even though the engine is healthy.
    At full severity: CHT reads +40°C high, oil pressure reads -35 kPa low.
    """
    frame["cht_c"] = frame["cht_c"] + 40 * sev + rng.gauss(0, 0.5)
    frame["oil_pressure_kpa"] = frame["oil_pressure_kpa"] - 35 * sev + rng.gauss(0, 0.5)
    # Minor EGT drift too
    frame["egt_c"] = frame["egt_c"] + 15 * sev + rng.gauss(0, 0.3)


def _overheating(frame: dict, sev: float, rng: random.Random) -> None:
    """
    Overheating: CHT rises dramatically, EGT follows, oil thins causing pressure drop.
    At full severity: CHT +130°C, EGT +100°C, oil temp +50°C, oil pressure -40 kPa.
    This is the most visually dramatic fault — judges will see it clearly.
    """
    frame["cht_c"] = frame["cht_c"] + 130 * sev + rng.gauss(0, 4)
    frame["egt_c"] = frame["egt_c"] + 100 * sev + rng.gauss(0, 5)
    frame["oil_temp_c"] = frame["oil_temp_c"] + 50 * sev + rng.gauss(0, 3)
    frame["oil_pressure_kpa"] = frame["oil_pressure_kpa"] - 40 * sev
    frame["fuel_flow_lph"] = frame["fuel_flow_lph"] * (1.0 + 0.15 * sev)  # enrichment attempt


def _cooling_degradation(frame: dict, sev: float, rng: random.Random) -> None:
    """Reduced heat rejection that precedes a full overheat event."""
    frame["cht_c"] += 75 * sev + rng.gauss(0, 2)
    frame["egt_c"] += 28 * sev + rng.gauss(0, 3)
    frame["oil_temp_c"] += 22 * sev + rng.gauss(0, 2)
    frame["oil_pressure_kpa"] -= 16 * sev


def _combustion_instability(frame: dict, sev: float, rng: random.Random) -> None:
    """
    Combustion instability: uneven firing causes EGT/RPM oscillations.
    At full severity: ±80°C EGT swing, ±8% RPM oscillation, vibration +2g.
    Rolling std features will flag this clearly (high variance = classic signature).
    """
    idx = frame.get("_frame_idx_internal", 0)
    osc = math.sin(idx * 0.5) * sev
    fast_osc = math.sin(idx * 1.5) * sev * 0.5  # higher harmonic component
    frame["egt_c"] = frame["egt_c"] + 80 * osc + fast_osc * 30 + rng.gauss(0, 10)
    frame["rpm"] = frame["rpm"] * (1.0 + 0.08 * osc)
    frame["vibration_g"] = frame["vibration_g"] + 2.0 * sev + abs(1.0 * osc) + rng.gauss(0, 0.2)
    frame["injection_timing_deg"] = frame["injection_timing_deg"] + rng.gauss(0, 5 * sev)
    frame["cht_c"] = frame["cht_c"] + 20 * abs(osc)  # intermittent hot spots


def _lubrication_issue(frame: dict, sev: float, rng: random.Random) -> None:
    """
    Lubrication issue: oil starvation. Oil pressure collapses, friction causes heat.
    At full severity: -60% oil pressure (< 120 kPa → imminent seizure threshold),
    oil temp +45°C, vibration +0.8g from metal-on-metal friction.
    This fault is CRITICAL severity — judges should see a red alert.
    """
    frame["oil_pressure_kpa"] = frame["oil_pressure_kpa"] * (1.0 - 0.60 * sev)
    frame["oil_temp_c"] = frame["oil_temp_c"] + 45 * sev + rng.gauss(0, 3)
    frame["vibration_g"] = frame["vibration_g"] + 0.8 * sev + rng.gauss(0, 0.1)
    frame["rpm"] = frame["rpm"] * (1.0 - 0.03 * sev)  # friction drag reduces RPM


def _abnormal_vibration(frame: dict, sev: float, rng: random.Random) -> None:
    """
    Abnormal vibration: propeller imbalance or bearing wear.
    Distinctive multi-harmonic vibration signature — FFT features will show this clearly.
    At full severity: +4g vibration with harmonic content. RPM stability degrades.
    """
    idx = frame.get("_frame_idx_internal", 0)
    harmonic_1 = abs(math.sin(idx * 1.2)) * sev
    harmonic_2 = abs(math.sin(idx * 2.4)) * sev * 0.5  # second harmonic
    harmonic_3 = abs(math.sin(idx * 3.6)) * sev * 0.25  # third harmonic
    frame["vibration_g"] = (frame["vibration_g"] + 4.0 * sev
                            + 2.0 * harmonic_1 + 1.0 * harmonic_2 + 0.5 * harmonic_3
                            + rng.gauss(0, 0.2))
    frame["cht_c"] = frame["cht_c"] + 15 * sev  # friction heat
    frame["rpm"] = frame["rpm"] * (1.0 - 0.04 * sev)  # drag from imbalance
    # Injection timing affected by vibration on ECU
    frame["injection_timing_deg"] = frame["injection_timing_deg"] + rng.gauss(0, 1.5 * sev)


_FAULT_HANDLERS = {
    "misfire": _misfire,
    "injector_fault": _injector_fault,
    "sensor_drift": _sensor_drift,
    "overheating": _overheating,
    "cooling_degradation": _cooling_degradation,
    "combustion_instability": _combustion_instability,
    "lubrication_issue": _lubrication_issue,
    "abnormal_vibration": _abnormal_vibration,
}
