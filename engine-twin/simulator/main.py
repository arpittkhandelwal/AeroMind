"""Simulator entry point."""
import os
import time
import logging

from simulator.publisher import Publisher

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [SIM] %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


def main() -> None:
    fault_scenario = os.getenv("SIM_FAULT_SCENARIO", "normal")
    interval = float(os.getenv("SIM_PUBLISH_INTERVAL", "1.0"))
    mqtt_host = os.getenv("MQTT_HOST", "localhost")
    mqtt_port = int(os.getenv("MQTT_PORT", "1883"))

    logger.info("Starting simulator | fault=%s interval=%.1fs", fault_scenario, interval)

    pub = Publisher(
        mqtt_host=mqtt_host,
        mqtt_port=mqtt_port,
        fault_scenario=fault_scenario,
        interval=interval,
    )

    # Retry loop so the container survives broker restarts
    while True:
        try:
            pub.run()
        except Exception as exc:  # noqa: BLE001
            logger.error("Publisher crashed: %s — retrying in 5 s", exc)
            time.sleep(5)


if __name__ == "__main__":
    main()
