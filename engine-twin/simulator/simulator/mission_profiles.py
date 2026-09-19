"""
mission_profiles.py
===================
Defines altitude / temperature profiles that the simulator steps through to
mimic real MALE UAV mission phases (take-off, climb, cruise, descent, landing)
under different theatre conditions.

Pre-defined profiles
--------------------
  standard_isa   — sea level to 3 000 m, ISA standard atmosphere
  ladakh         — high-altitude airfield (3 300 m AMSL), extreme diurnal range
  haa            — High Altitude Attack profile: 5 000 m cruise

TODO (team): add wind / turbulence effects on CHT / EGT via ram-air model.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterator


@dataclass
class PhasePoint:
    altitude: float      # metres MSL
    ambient_temp: float  # °C
    duration_s: float    # seconds to spend in this phase


# ---------------------------------------------------------------------------
# Mission profile definitions
# Each profile is a list of PhasePoints that the generator cycles through.
# ---------------------------------------------------------------------------

PROFILES: dict[str, list[PhasePoint]] = {
    "standard_isa": [
        PhasePoint(altitude=0,     ambient_temp=15.0,  duration_s=60),   # ground idle
        PhasePoint(altitude=500,   ambient_temp=11.7,  duration_s=120),  # take-off / climb
        PhasePoint(altitude=1500,  ambient_temp=6.8,   duration_s=300),  # climb
        PhasePoint(altitude=3000,  ambient_temp=-4.5,  duration_s=600),  # cruise
        PhasePoint(altitude=1500,  ambient_temp=6.8,   duration_s=180),  # descent
        PhasePoint(altitude=0,     ambient_temp=15.0,  duration_s=60),   # landing
    ],
    "ladakh": [
        # Leh airport ~3 300 m AMSL; summer morning temp ~5 °C, afternoon ~25 °C
        PhasePoint(altitude=3300,  ambient_temp=5.0,   duration_s=120),  # pre-dawn start
        PhasePoint(altitude=4500,  ambient_temp=-2.0,  duration_s=300),  # climb
        PhasePoint(altitude=5500,  ambient_temp=-8.0,  duration_s=900),  # high cruise
        PhasePoint(altitude=4500,  ambient_temp=-2.0,  duration_s=300),  # descent
        PhasePoint(altitude=3300,  ambient_temp=22.0,  duration_s=120),  # afternoon landing
    ],
    "haa": [
        # High-Altitude Attack: rapid climb to 5 000 m, sustained loiter
        PhasePoint(altitude=0,     ambient_temp=30.0,  duration_s=60),
        PhasePoint(altitude=2000,  ambient_temp=17.0,  duration_s=180),
        PhasePoint(altitude=5000,  ambient_temp=-5.0,  duration_s=1800),  # loiter
        PhasePoint(altitude=2000,  ambient_temp=17.0,  duration_s=120),
        PhasePoint(altitude=0,     ambient_temp=30.0,  duration_s=60),
    ],
}


def isa_temperature(altitude_m: float) -> float:
    """
    Standard ISA temperature lapse: -6.5 °C per 1 000 m up to 11 km.
    TODO: extend to stratosphere.
    """
    return 15.0 - 0.0065 * altitude_m


def profile_generator(name: str = "standard_isa") -> Iterator[tuple[float, float]]:
    """
    Yields (altitude_m, ambient_temp_c) every second, cycling through phases.

    Usage::
        gen = profile_generator("ladakh")
        alt, temp = next(gen)
    """
    phases = PROFILES.get(name, PROFILES["standard_isa"])
    while True:
        for phase in phases:
            for _ in range(int(phase.duration_s)):
                yield phase.altitude, phase.ambient_temp
