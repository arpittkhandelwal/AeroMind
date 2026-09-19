"""
anomaly_detection.py
=====================
Wrapper around an Isolation Forest (quick to train, no labels needed).
At inference time, returns an anomaly score in [0, 1] — higher = more anomalous.

Swap the backend for an LSTM Autoencoder once training data is available
(see the TODO section below).

TODO (ML1): Train on ~24 h of healthy simulator data.
TODO (ML1): Export trained model to ONNX via skl2onnx for faster inference.
"""

from __future__ import annotations

import logging
import os
import pickle
from pathlib import Path
from typing import Optional

import numpy as np
from sklearn.ensemble import IsolationForest

logger = logging.getLogger(__name__)

MODEL_PATH = Path(os.getenv("MODEL_DIR", "/app/models")) / "anomaly_if.pkl"

FEATURE_COLS = [
    "rpm", "egt", "cht", "oil_pressure",
    "oil_temp", "fuel_flow", "vibration",
]


class AnomalyDetector:
    """Thin wrapper around IsolationForest."""

    def __init__(self, contamination: float = 0.05) -> None:
        self._model: Optional[IsolationForest] = None
        self._contamination = contamination

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def load(self) -> bool:
        """Load a pre-trained model from disk. Returns True on success."""
        if MODEL_PATH.exists():
            with MODEL_PATH.open("rb") as f:
                self._model = pickle.load(f)
            logger.info("Anomaly model loaded from %s", MODEL_PATH)
            return True
        logger.warning("No anomaly model found at %s — using untrained stub", MODEL_PATH)
        return False

    def save(self) -> None:
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        with MODEL_PATH.open("wb") as f:
            pickle.dump(self._model, f)
        logger.info("Anomaly model saved to %s", MODEL_PATH)

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def score(self, sample: dict) -> float:
        """
        Return anomaly score in [0, 1].
        If no model is loaded, returns a placeholder score of 0.0.
        """
        if self._model is None:
            return 0.0   # TODO: remove once model is trained

        x = np.array([[sample.get(c, 0.0) for c in FEATURE_COLS]])
        # IsolationForest: score_samples returns negative values (lower = more anomalous)
        raw = self._model.score_samples(x)[0]
        # Map to [0, 1] — empirical scaling, tune after training
        score = float(np.clip(1.0 - (raw + 0.5), 0.0, 1.0))
        return score


# ---------------------------------------------------------------------------
# Training stub — run offline
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    """
    Offline training entry point.

    TODO (ML1):
      1. Load healthy telemetry CSV exported from TimescaleDB.
      2. Scale features (StandardScaler / RobustScaler).
      3. Fit IsolationForest.
      4. Evaluate on a validation set with known faults.
      5. Save with AnomalyDetector().save().

    Usage::
        docker compose run --rm ml python -m src.anomaly_detection
    """
    import pandas as pd

    DATA_PATH = Path("/app/data/healthy_telemetry.csv")
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Training data not found: {DATA_PATH}")

    df = pd.read_csv(DATA_PATH)
    X = df[FEATURE_COLS].values

    detector = AnomalyDetector(contamination=0.05)
    detector._model = IsolationForest(n_estimators=200, contamination=0.05, random_state=42)
    detector._model.fit(X)
    detector.save()
    print("Anomaly model trained and saved.")
