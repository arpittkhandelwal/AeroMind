# Simulator

Generates synthetic engine telemetry and publishes to MQTT.

## Running locally

```bash
pip install -r requirements.txt
SIM_FAULT_SCENARIO=misfire MQTT_HOST=localhost python main.py
```

## Fault scenarios

Set `SIM_FAULT_SCENARIO` env var:
`normal` | `misfire` | `injector` | `lubrication` | `sensor_drift` | `combustion` | `overheating`

## Files

| File | Purpose |
|------|---------|
| `simulator/engine_model.py` | Steady-state sensor generation with noise |
| `simulator/fault_injection.py` | 6 fault perturbation functions |
| `simulator/mission_profiles.py` | Altitude/temperature profiles (ISA, Ladakh, HAA) |
| `simulator/publisher.py` | MQTT publish loop |

**Owner**: Sim1, Sim2
