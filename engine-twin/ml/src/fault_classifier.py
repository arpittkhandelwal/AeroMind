"""
fault_classifier.py
====================
Multi-class fault classifier: XGBoost (primary) with a Random Forest fallback.

Labels (6 + normal)
--------------------
  0  normal
  1  misfire
  2  injector
  3  lubrication
  4  sensor_drift
  5  combustion
  6  overheating

TODO (ML2): Generate labelled training set from simulator with all fault
scenarios at varied severity levels (0.3, 0.6, 1.0) and mission profiles.
TODO (ML2): Tune hyperparameters with Optuna / RandomizedSearchCV.
TODO (ML2): Export to ONNX for edge deployment.
"""

from __future__ import annotations

import logging
import os
import pickle
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

MODEL_PATH = Path(os.getenv("MODEL_DIR", "/app/models")) / "fault_classifier.pkl"

FAULT_LABELS = [
    "normal",
    "misfire",
    "injector",
    "lubrication",
    "sensor_drift",
    "combustion",
    "overheating",
]

FEATURE_COLS = [
    "rpm", "egt", "cht", "oil_pressure",
    "oil_temp", "fuel_flow", "vibration",
    "altitude", "ambient_temp",
]


class FaultClassifier:
    """Wraps XGBoost (or any sklearn-compatible estimator)."""

    def __init__(self) -> None:
        self._model = None
        self._classes = FAULT_LABELS

    # ------------------------------------------------------------------

    def load(self) -> bool:
        if MODEL_PATH.exists():
            with MODEL_PATH.open("rb") as f:
                self._model = pickle.load(f)
            logger.info("Fault classifier loaded from %s", MODEL_PATH)
            return True
        logger.warning("No fault classifier at %s — returning stub predictions", MODEL_PATH)
        return False

    def save(self) -> None:
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        with MODEL_PATH.open("wb") as f:
            pickle.dump(self._model, f)

    # ------------------------------------------------------------------

    def predict(self, sample: dict) -> tuple[str, float, dict[str, float]]:
        """
        Returns (fault_label, confidence, {label: prob}).

        If no model is loaded returns ("normal", 1.0, {}).
        """
        if self._model is None:
            # TODO: remove stub once model is trained
            return "normal", 1.0, {}

        x = np.array([[sample.get(c, 0.0) for c in FEATURE_COLS]])
        probs = self._model.predict_proba(x)[0]
        idx = int(np.argmax(probs))
        label = self._classes[idx]
        conf = float(probs[idx])
        prob_map = {self._classes[i]: float(probs[i]) for i in range(len(probs))}
        return label, conf, prob_map


# ---------------------------------------------------------------------------
# Training stub
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    """
    TODO (ML2):
      1. Load labelled CSV (columns: FEATURE_COLS + 'fault_label').
      2. Encode labels with LabelEncoder.
      3. Train XGBClassifier, evaluate with confusion matrix.
      4. Save model.

    Usage::
        docker compose run --rm ml python -m src.fault_classifier
    """
    import xgboost as xgb
    import pandas as pd
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import LabelEncoder
    from sklearn.metrics import classification_report

    DATA_PATH = Path("/app/data/labelled_telemetry.csv")
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Training data not found: {DATA_PATH}")

    df = pd.read_csv(DATA_PATH)
    le = LabelEncoder()
    y = le.fit_transform(df["fault_label"])
    X = df[FEATURE_COLS].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    clf = xgb.XGBClassifier(n_estimators=300, max_depth=6, use_label_encoder=False,
                             eval_metric="mlogloss", random_state=42)
    clf.fit(X_train, y_train)
    print(classification_report(y_test, clf.predict(X_test), target_names=le.classes_))

    fc = FaultClassifier()
    fc._model = clf
    fc._classes = list(le.classes_)
    fc.save()
    print("Fault classifier saved.")
