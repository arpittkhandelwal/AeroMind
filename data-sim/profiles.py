"""
Mission profile configurations for synthetic telemetry generation.
Each profile defines the operating envelope: RPM range, throttle, altitude,
ambient temperature, and duration. These drive the physics simulation in generator.py.

Assumption: MALE UAV uses a ~100 hp displacement engine with typical cruise at
4500-5500 RPM. Max RPM is 7000. Max fuel flow 25 L/h at full throttle.
"""

from dataclasses import dataclass, field
from typing import Tuple

@dataclass
class MissionProfile:
    name: str
    rpm_base: float          # cruise RPM
    rpm_range: Tuple[float, float]  # (min, max) over mission
    throttle_base: float     # cruise throttle %
    throttle_range: Tuple[float, float]
    altitude_base: float     # cruise altitude m
    altitude_range: Tuple[float, float]
    ambient_temp_c: float    # ISA deviation; base ambient at ground
    duration_min: float      # mission duration in minutes
    frame_hz: float          # telemetry frame rate (Hz)
    noise_scale: float       # gaussian noise amplitude multiplier


PROFILES: dict[str, MissionProfile] = {
    "nominal": MissionProfile(
        name="nominal",
        rpm_base=5000.0,
        rpm_range=(4500.0, 5500.0),
        throttle_base=65.0,
        throttle_range=(55.0, 80.0),
        altitude_base=1500.0,
        altitude_range=(1200.0, 1800.0),
        ambient_temp_c=25.0,
        duration_min=60.0,
        frame_hz=1.0,
        noise_scale=1.0,
    ),
    "high_altitude": MissionProfile(
        name="high_altitude",
        rpm_base=5800.0,
        rpm_range=(5200.0, 6200.0),
        throttle_base=80.0,
        throttle_range=(70.0, 90.0),
        altitude_base=5000.0,
        altitude_range=(4500.0, 6000.0),
        ambient_temp_c=5.0,   # colder at altitude
        duration_min=90.0,
        frame_hz=1.0,
        noise_scale=1.2,
    ),
    "endurance": MissionProfile(
        name="endurance",
        rpm_base=4200.0,
        rpm_range=(3800.0, 4600.0),
        throttle_base=50.0,
        throttle_range=(40.0, 60.0),
        altitude_base=2000.0,
        altitude_range=(1800.0, 2200.0),
        ambient_temp_c=20.0,
        duration_min=180.0,   # long-duration endurance
        frame_hz=1.0,
        noise_scale=0.8,
    ),
    "hot_weather": MissionProfile(
        name="hot_weather",
        rpm_base=5200.0,
        rpm_range=(4800.0, 5600.0),
        throttle_base=70.0,
        throttle_range=(60.0, 85.0),
        altitude_base=500.0,
        altitude_range=(300.0, 800.0),
        ambient_temp_c=45.0,   # hot ground environment
        duration_min=60.0,
        frame_hz=1.0,
        noise_scale=1.1,
    ),
    "rapid_throttle": MissionProfile(
        name="rapid_throttle",
        rpm_base=5500.0,
        rpm_range=(3000.0, 6800.0),   # wide swings
        throttle_base=60.0,
        throttle_range=(20.0, 95.0),  # aggressive changes
        altitude_base=1000.0,
        altitude_range=(800.0, 1200.0),
        ambient_temp_c=30.0,
        duration_min=45.0,
        frame_hz=2.0,   # higher cadence for fast dynamics
        noise_scale=1.5,
    ),
}
