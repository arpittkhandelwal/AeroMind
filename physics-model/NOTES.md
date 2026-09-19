# Thermodynamic Physics Model — Implementation Notes

## Architecture Overview
The Digital Twin core runs a parallel physics-informed expected-value model alongside the ML anomaly detector. For every telemetry frame arriving from the engine, this model calculates what the sensor readings *should* be for a perfectly healthy engine under those exact operating conditions (RPM, throttle, altitude, ambient temperature).

The difference between the actual sensor reading and this physics prediction is the **residual**. These residuals are what feed into the ML Isolation Forest for robust anomaly detection.

## Physical Assumptions & Equations

### 1. International Standard Atmosphere (ISA) Density Correction
Engine performance (cooling efficiency, volumetric efficiency) heavily depends on air density.
```python
rho_ratio = math.exp(-altitude_m / 8500.0)
```
*Justification*: A standard first-order barometric approximation where density drops exponentially, halving at roughly 8500m.

### 2. Cylinder Head Temperature (CHT)
CHT is modeled as a base performance map lookup (derived from RPM and Throttle load), modified by altitude and ambient temperature.
```python
altitude_correction = 1.0 + 0.25 * (1.0 - rho_ratio)
ambient_offset = max(0.0, (ambient_temp_c - 25.0) * 0.4)
cht_c = cht_base * altitude_correction + ambient_offset
```
*Justification*: As altitude increases, air density decreases, reducing mass airflow across the cooling fins. This results in worse cooling efficiency (thus the `altitude_correction` multiplier).

### 3. Exhaust Gas Temperature (EGT)
EGT is modeled as CHT plus a delta heavily dependent on throttle position (mixture richness).
*Justification*: EGT responds almost instantaneously to combustion mixture changes, peaking near stoichiometric ratio and dropping when overly rich (high throttle) or lean.

### 4. Oil Temperature (Thermal Lag)
Unlike CHT and EGT which respond quickly, oil temperature acts as a large thermal mass. It is modeled as a first-order lag integrator.
```python
cht_influence = cht_c * 0.6 + ambient_temp_c * 0.4
self._oil_temp_c += (cht_influence - self._oil_temp_c) / thermal_tau
```
*Justification*: Oil temperature tracks CHT but takes minutes to reach equilibrium. `thermal_tau` represents this inertia.

### 5. Oil Pressure
Oil pressure is primarily driven by the mechanical oil pump (proportional to RPM), but suffers a viscosity penalty as oil heats up.
```python
viscosity_penalty = max(0.0, (oil_temp_c - 80.0) * 0.6)
oil_pressure_kpa = oil_pressure_base - viscosity_penalty
```
*Justification*: Multi-grade aviation oils thin out at high temperatures, causing a measurable drop in gallery pressure even at constant RPM.

### 6. Fuel Flow
Fuel flow is derived from a base map (RPM × Throttle) but penalized at altitude.
```python
fuel_flow_lph = fuel_flow_base * (0.85 + 0.15 * rho_ratio)
```
*Justification*: Standard normally-aspirated or lightly-turbocharged MALE UAV engines experience slightly reduced volumetric efficiency at high density altitudes.
