"""
Engine performance maps for the thermodynamic twin model.

Implements 2D/3D lookup tables (numpy interpolation) for:
  - CHT base vs (RPM, throttle_pct)
  - EGT offset vs throttle_pct
  - Oil pressure vs RPM
  - Fuel flow efficiency vs (RPM, altitude_m)

These maps are calibrated to match the data-sim generator's physics so that
the anomaly detector has a meaningful residual signal when faults occur.

Assumptions:
  - Engine: 4-cylinder horizontally opposed piston, ~100 hp, constant-speed prop
  - Maps are sparse (9×9 grid) and interpolated with numpy for speed
  - Altitude correction uses ISA standard atmosphere density ratio
"""

import numpy as np

# -------------------------------------------------------------------------
# Base grid axes
# -------------------------------------------------------------------------
RPM_AXIS = np.array([2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000], dtype=float)
THROTTLE_AXIS = np.array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], dtype=float)
ALT_AXIS = np.array([0, 500, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 7000], dtype=float)


# -------------------------------------------------------------------------
# CHT base map: CHT_base[rpm_idx, thr_idx] = °C
# Physical rationale: CHT rises with both RPM (friction, combustion rate)
# and throttle (MAP → richer mixture → more heat).
# -------------------------------------------------------------------------
def _build_cht_map() -> np.ndarray:
    rpm_norm = RPM_AXIS / 7000.0
    thr_norm = THROTTLE_AXIS / 100.0
    R, T = np.meshgrid(rpm_norm, thr_norm, indexing="ij")
    # Base model: 100 + 180*rpm^1.3 + 40*thr + interaction term
    cht = 100.0 + 180.0 * R**1.3 + 40.0 * T + 20.0 * R * T
    return cht  # shape (11, 10)


CHT_MAP = _build_cht_map()   # (rpm, throttle) → CHT base °C


def _build_egt_delta_map() -> np.ndarray:
    """EGT = CHT + delta; delta depends on throttle (peak mixture EGT)."""
    thr_norm = THROTTLE_AXIS / 100.0
    # Peak EGT above CHT: 60°C at idle, 130°C at WOT (rich mixture peak)
    delta = 60.0 + 80.0 * thr_norm
    return delta  # shape (10,)


EGT_DELTA_MAP = _build_egt_delta_map()


def _build_oil_pressure_map() -> np.ndarray:
    """Oil pressure kPa vs RPM. Classic engine oil pump characteristic."""
    rpm_norm = RPM_AXIS / 7000.0
    # 150 kPa at idle, rises to 420 kPa, slightly nonlinear
    pressure = 150.0 + 280.0 * rpm_norm + 40.0 * rpm_norm**2
    # Cap at redline
    return np.clip(pressure, 100.0, 480.0)


OIL_PRESSURE_MAP = _build_oil_pressure_map()  # shape (11,)


def _build_fuel_flow_map() -> np.ndarray:
    """Fuel flow L/h vs (RPM, throttle), at sea level."""
    rpm_norm = RPM_AXIS / 7000.0
    thr_norm = THROTTLE_AXIS / 100.0
    R, T = np.meshgrid(rpm_norm, thr_norm, indexing="ij")
    # Physical: power = RPM × MAP → fuel proportional, with efficiency peak
    fuel = 2.0 + 23.0 * R * T * (0.9 + 0.1 * (1 - (R - 0.7)**2))
    return np.maximum(fuel, 0.5)


FUEL_FLOW_MAP = _build_fuel_flow_map()  # shape (11, 10)


# -------------------------------------------------------------------------
# Altitude density correction
# -------------------------------------------------------------------------
def density_ratio(altitude_m: float) -> float:
    """ISA standard atmosphere density ratio ρ/ρ₀ using scale height ~8500m."""
    return float(np.exp(-altitude_m / 8500.0))


# -------------------------------------------------------------------------
# Interpolation helpers
# -------------------------------------------------------------------------

def _interp_2d(map2d: np.ndarray, x_val: float, x_axis: np.ndarray,
               y_val: float, y_axis: np.ndarray) -> float:
    """Bilinear interpolation on a 2D map, with clamping at bounds."""
    x_val = float(np.clip(x_val, x_axis[0], x_axis[-1]))
    y_val = float(np.clip(y_val, y_axis[0], y_axis[-1]))
    xi = np.searchsorted(x_axis, x_val, side="right") - 1
    yi = np.searchsorted(y_axis, y_val, side="right") - 1
    xi = int(np.clip(xi, 0, len(x_axis) - 2))
    yi = int(np.clip(yi, 0, len(y_axis) - 2))

    x0, x1 = x_axis[xi], x_axis[xi + 1]
    y0, y1 = y_axis[yi], y_axis[yi + 1]
    tx = (x_val - x0) / (x1 - x0)
    ty = (y_val - y0) / (y1 - y0)

    v00 = map2d[xi, yi]
    v10 = map2d[xi + 1, yi]
    v01 = map2d[xi, yi + 1]
    v11 = map2d[xi + 1, yi + 1]

    return float((1 - tx) * (1 - ty) * v00 + tx * (1 - ty) * v10 +
                 (1 - tx) * ty * v01 + tx * ty * v11)


def _interp_1d(arr: np.ndarray, x_val: float, x_axis: np.ndarray) -> float:
    """Linear interpolation on a 1D array."""
    x_val = float(np.clip(x_val, x_axis[0], x_axis[-1]))
    return float(np.interp(x_val, x_axis, arr))


# -------------------------------------------------------------------------
# Public query functions
# -------------------------------------------------------------------------

def lookup_cht_base(rpm: float, throttle_pct: float) -> float:
    return _interp_2d(CHT_MAP, rpm, RPM_AXIS, throttle_pct, THROTTLE_AXIS)


def lookup_egt_delta(throttle_pct: float) -> float:
    return _interp_1d(EGT_DELTA_MAP, throttle_pct, THROTTLE_AXIS)


def lookup_oil_pressure_base(rpm: float) -> float:
    return _interp_1d(OIL_PRESSURE_MAP, rpm, RPM_AXIS)


def lookup_fuel_flow_base(rpm: float, throttle_pct: float) -> float:
    return _interp_2d(FUEL_FLOW_MAP, rpm, RPM_AXIS, throttle_pct, THROTTLE_AXIS)
