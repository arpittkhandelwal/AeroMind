"""
Core physics-informed synthetic telemetry generator.

Architecture:
  TelemetryGenerator takes a MissionProfile + optional FaultInjector and
  yields one EngineTelemetryFrame dict per call to next_frame().

Physics model used for nominal values:
  - ISA density correction: rho_ratio = exp(-altitude_m / 8500)
  - RPM evolves as a mean-reverting process with throttle coupling
  - CHT: base ~150°C + f(RPM^1.3) + ambient offset, cooled by air density
  - EGT: CHT + delta dependent on throttle
  - Oil pressure: 300 kPa at idle, rises with RPM, falls with oil temp
  - Oil temp: lags CHT via exponential smoothing (τ = 60 frames)
  - Fuel flow: throttle_pct/100 × RPM/max_rpm × max_fuel_flow
  - Vibration: baseline 0.05g + RPM harmonic term
  - Battery: 24V nominal with alternator coupling
  - Injection timing: 25 deg BTDC nominal ± small noise

Assumptions:
  - Engine model is a rough approximation of a 100hp opposed-4 piston engine
  - No cylinder-individual modelling — bulk averaged outputs
  - Thermal inertia modelled with first-order lag only
"""

import math
import random
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Iterator

from profiles import MissionProfile, PROFILES
from faults import FaultInjector


# ---------------------------------------------------------------------------
# Physical constants / engine constants
# ---------------------------------------------------------------------------
MAX_RPM = 7000.0
MAX_CHT_C = 260.0       # redline CHT
MAX_EGT_C = 900.0       # redline EGT
IDLE_OIL_PRESSURE = 200.0  # kPa at idle
MAX_OIL_PRESSURE = 450.0   # kPa at high RPM
MAX_FUEL_FLOW = 25.0    # L/h at WOT
BATT_NOMINAL = 24.0     # V


class TelemetryGenerator:
    """
    Generates physics-informed synthetic telemetry frames for a given profile.

    Args:
        profile: MissionProfile instance
        mission_id: unique string identifier (auto-generated if None)
        fault_injector: optional FaultInjector applied after nominal computation
        seed: RNG seed for reproducibility
        start_time: mission start datetime (defaults to UTC now)
    """

    def __init__(
        self,
        profile: MissionProfile,
        mission_id: Optional[str] = None,
        fault_injector: Optional[FaultInjector] = None,
        seed: Optional[int] = None,
        start_time: Optional[datetime] = None,
    ):
        self.profile = profile
        self.mission_id = mission_id or f"mission_{uuid.uuid4().hex[:8]}"
        self.fault_injector = fault_injector
        self._rng = random.Random(seed)
        self._frame_idx = 0
        self._start_time = start_time or datetime.now(timezone.utc)
        self._dt = 1.0 / profile.frame_hz  # seconds per frame

        # Internal state variables (thermal inertia etc.)
        self._oil_temp_c: float = profile.ambient_temp_c + 20.0   # warm start
        self._rpm: float = profile.rpm_base
        self._throttle: float = profile.throttle_base
        self._altitude: float = profile.altitude_base

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def total_frames(self) -> int:
        return int(self.profile.duration_min * 60 * self.profile.frame_hz)

    @property
    def is_done(self) -> bool:
        return self._frame_idx >= self.total_frames

    def next_frame(self) -> dict:
        """Compute and return the next telemetry frame dict."""
        self._evolve_state()
        frame = self._compute_nominal_frame()

        # Internal annotation used by fault handlers (not in schema output)
        frame["_frame_idx_internal"] = self._frame_idx

        if self.fault_injector:
            frame = self.fault_injector.apply(frame, self._frame_idx)

        # Remove internal key before returning
        frame.pop("_frame_idx_internal", None)

        # Default fault_label if not set by fault injector
        if "fault_label" not in frame:
            frame["fault_label"] = "none"

        self._frame_idx += 1
        return frame

    def stream(self) -> Iterator[dict]:
        """Yield all frames for the mission."""
        while not self.is_done:
            yield self.next_frame()

    # ------------------------------------------------------------------
    # State evolution (throttle / RPM / altitude dynamics)
    # ------------------------------------------------------------------

    def _evolve_state(self) -> None:
        """
        Evolve throttle, RPM, altitude using mean-reverting random walk.
        This creates realistic-looking time series without discontinuities.
        """
        p = self.profile
        noise = self._rng.gauss

        # Throttle: mean-reverts to base with slow drift
        dthrottle = 0.02 * (p.throttle_base - self._throttle) + noise(0, 0.5 * p.noise_scale)
        self._throttle = float(
            max(p.throttle_range[0], min(p.throttle_range[1], self._throttle + dthrottle))
        )

        # RPM: coupled to throttle with lag + noise
        rpm_target = p.rpm_range[0] + (self._throttle - p.throttle_range[0]) / max(
            p.throttle_range[1] - p.throttle_range[0], 1
        ) * (p.rpm_range[1] - p.rpm_range[0])
        drpm = 0.05 * (rpm_target - self._rpm) + noise(0, 20 * p.noise_scale)
        self._rpm = float(max(p.rpm_range[0], min(p.rpm_range[1], self._rpm + drpm)))

        # Altitude: slow sinusoidal variation
        alt_osc = math.sin(self._frame_idx * 0.005) * (p.altitude_range[1] - p.altitude_range[0]) * 0.3
        self._altitude = float(
            max(p.altitude_range[0], min(p.altitude_range[1], p.altitude_base + alt_osc + noise(0, 5)))
        )

    # ------------------------------------------------------------------
    # Nominal frame computation
    # ------------------------------------------------------------------

    def _compute_nominal_frame(self) -> dict:
        """
        Compute nominal (healthy) sensor values from current engine state.
        All physics relationships are intentionally simplified for MVP.
        """
        p = self.profile
        rpm = self._rpm
        thr = self._throttle
        alt = self._altitude
        t_amb = p.ambient_temp_c
        noise = self._rng.gauss

        # --- Density altitude factor ---
        rho_ratio = math.exp(-alt / 8500.0)   # 0→1 as alt rises

        # --- CHT ---
        # Rises with RPM^1.3 (friction + combustion), cooled by air density
        rpm_factor = (rpm / MAX_RPM) ** 1.3
        cht_nominal = 120.0 + 150.0 * rpm_factor / rho_ratio + 0.4 * t_amb
        cht_c = cht_nominal + noise(0, 2.0 * p.noise_scale)

        # --- EGT ---
        # CHT + combustion heat delta, peaks at high throttle
        egt_delta = 60.0 + 80.0 * (thr / 100.0)
        egt_c = cht_c + egt_delta + noise(0, 3.0 * p.noise_scale)

        # --- Oil temp (thermal lag) ---
        cht_influence = cht_c * 0.6 + t_amb * 0.4
        tau = 60.0  # frame-equivalent thermal time constant
        self._oil_temp_c += (cht_influence - self._oil_temp_c) / tau
        oil_temp_c = self._oil_temp_c + noise(0, 1.0)

        # --- Oil pressure ---
        # Rises linearly with RPM; drops with oil temp (viscosity) and altitude
        rpm_norm = rpm / MAX_RPM
        temp_penalty = max(0, (oil_temp_c - 80.0) * 0.5)  # drops as oil heats
        oil_pressure_kpa = (
            IDLE_OIL_PRESSURE
            + (MAX_OIL_PRESSURE - IDLE_OIL_PRESSURE) * rpm_norm
            - temp_penalty
            + noise(0, 3.0 * p.noise_scale)
        )
        oil_pressure_kpa = max(50.0, oil_pressure_kpa)

        # --- Fuel flow ---
        # throttle × RPM-based efficiency, reduced by density at altitude
        efficiency = 0.85 + 0.15 * rho_ratio
        fuel_flow_lph = (
            MAX_FUEL_FLOW * (thr / 100.0) * (rpm / MAX_RPM) / efficiency
            + noise(0, 0.2 * p.noise_scale)
        )
        fuel_flow_lph = max(0.5, fuel_flow_lph)

        # --- Vibration ---
        # Baseline + RPM harmonic (resonances at specific RPMs)
        harmonic = 0.02 * abs(math.sin(rpm * 0.002))
        vibration_g = 0.05 + 0.1 * (rpm / MAX_RPM) + harmonic + abs(noise(0, 0.01 * p.noise_scale))

        # --- Battery & alternator ---
        battery_voltage_v = BATT_NOMINAL + noise(0, 0.1)
        alternator_current_a = 10.0 + 5.0 * (thr / 100.0) + noise(0, 0.3)

        # --- Injection timing ---
        injection_timing_deg = 25.0 + noise(0, 0.5)  # 25 deg BTDC nominal

        # --- Timestamp ---
        ts = self._start_time + timedelta(seconds=self._frame_idx * self._dt)
        timestamp = ts.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

        return {
            "timestamp": timestamp,
            "mission_id": self.mission_id,
            "rpm": round(rpm, 1),
            "cht_c": round(cht_c, 2),
            "egt_c": round(egt_c, 2),
            "oil_pressure_kpa": round(oil_pressure_kpa, 2),
            "oil_temp_c": round(oil_temp_c, 2),
            "fuel_flow_lph": round(fuel_flow_lph, 3),
            "vibration_g": round(vibration_g, 4),
            "battery_voltage_v": round(battery_voltage_v, 3),
            "alternator_current_a": round(alternator_current_a, 3),
            "injection_timing_deg": round(injection_timing_deg, 2),
            "altitude_m": round(self._altitude, 1),
            "ambient_temp_c": round(t_amb + noise(0, 0.2), 2),
            "throttle_pct": round(thr, 1),
        }


# ---------------------------------------------------------------------------
# Convenience factory
# ---------------------------------------------------------------------------

def make_generator(
    profile_name: str,
    fault_type: Optional[str] = None,
    fault_start_frac: float = 0.5,
    fault_ramp_frames: int = 60,
    mission_id: Optional[str] = None,
    seed: int = 42,
) -> TelemetryGenerator:
    """
    Create a TelemetryGenerator for a named profile with optional fault injection.

    Args:
        profile_name: one of the 5 profile names
        fault_type: one of the 7 fault types or None for clean mission
        fault_start_frac: fraction into mission when fault begins (default 0.5 = halfway)
        fault_ramp_frames: frames over which fault ramps to full severity
        mission_id: optional explicit mission ID
        seed: RNG seed
    """
    profile = PROFILES[profile_name]
    total = int(profile.duration_min * 60 * profile.frame_hz)
    ramp_start = int(total * fault_start_frac)

    injector = None
    if fault_type:
        injector = FaultInjector(
            fault_type=fault_type,
            ramp_start_frame=ramp_start,
            ramp_frames=fault_ramp_frames,
            seed=seed,
        )

    return TelemetryGenerator(
        profile=profile,
        mission_id=mission_id,
        fault_injector=injector,
        seed=seed,
    )
