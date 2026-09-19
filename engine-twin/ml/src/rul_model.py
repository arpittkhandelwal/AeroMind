"""
rul_model.py
============
Remaining Useful Life (RUL) regression using a GRU network.

Input:  sliding window of W timesteps × F features
Output: scalar RUL in hours

TODO (ML1/ML2):
  - Generate degradation trajectories by running the simulator with gradually
    increasing fault severity from 0 → 1 over simulated engine hours.
  - Train on (window, rul) pairs extracted from these trajectories.
  - Export to ONNX with `torch.onnx.export` for faster CPU inference.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

MODEL_PATH = Path(os.getenv("MODEL_DIR", "/app/models")) / "rul_gru.pt"

WINDOW_SIZE = 30    # seconds / samples
FEATURE_COLS = [
    "rpm", "egt", "cht", "oil_pressure",
    "oil_temp", "fuel_flow", "vibration",
]
N_FEATURES = len(FEATURE_COLS)


class RULModel:
    """GRU-based RUL regressor. Falls back to a heuristic stub before training."""

    def __init__(self) -> None:
        self._model = None
        self._window: list[list[float]] = []

    # ------------------------------------------------------------------

    def load(self) -> bool:
        import torch

        if MODEL_PATH.exists():
            self._model = torch.load(MODEL_PATH, map_location="cpu")
            self._model.eval()
            logger.info("RUL model loaded from %s", MODEL_PATH)
            return True
        logger.warning("No RUL model at %s — returning heuristic stub", MODEL_PATH)
        return False

    def save(self) -> None:
        import torch

        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        torch.save(self._model, MODEL_PATH)

    # ------------------------------------------------------------------

    def update(self, sample: dict) -> None:
        """Push a new sample into the sliding window."""
        row = [sample.get(c, 0.0) for c in FEATURE_COLS]
        self._window.append(row)
        if len(self._window) > WINDOW_SIZE:
            self._window.pop(0)

    def predict(self) -> Optional[float]:
        """
        Return RUL estimate in hours, or None if window is not full yet.

        TODO: replace heuristic with GRU inference.
        """
        if len(self._window) < WINDOW_SIZE:
            return None

        if self._model is None:
            # Heuristic stub: high vibration → low RUL
            mean_vib = float(np.mean([r[6] for r in self._window]))
            rul = max(0.0, 500.0 - mean_vib * 1000)
            return round(rul, 1)

        import torch

        x = torch.tensor([self._window], dtype=torch.float32)   # (1, W, F)
        with torch.no_grad():
            rul = self._model(x).item()
        return round(float(rul), 1)


# ---------------------------------------------------------------------------
# GRU model definition (used during training)
# ---------------------------------------------------------------------------


def build_gru_model(hidden_size: int = 64, num_layers: int = 2) -> "torch.nn.Module":
    """
    Construct the GRU regression network.

    TODO: tune hidden_size, num_layers, dropout after baseline experiments.
    """
    import torch
    import torch.nn as nn

    class GRURegressor(nn.Module):
        def __init__(self):
            super().__init__()
            self.gru = nn.GRU(
                input_size=N_FEATURES,
                hidden_size=hidden_size,
                num_layers=num_layers,
                batch_first=True,
                dropout=0.2,
            )
            self.fc = nn.Linear(hidden_size, 1)

        def forward(self, x):
            _, h = self.gru(x)
            return self.fc(h[-1]).squeeze(-1)

    return GRURegressor()


# ---------------------------------------------------------------------------
# Training stub
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    """
    TODO (ML1):
      1. Export degradation telemetry from TimescaleDB to CSV.
      2. Build (window, rul) dataset.
      3. Train with MSE loss, Adam optimiser, learning-rate scheduler.
      4. Save with RULModel().save().

    Usage::
        docker compose run --rm ml python -m src.rul_model
    """
    import torch
    import torch.nn as nn
    from torch.utils.data import TensorDataset, DataLoader
    import pandas as pd

    DATA_PATH = Path("/app/data/degradation_telemetry.csv")
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"{DATA_PATH} not found")

    df = pd.read_csv(DATA_PATH)
    # TODO: build windows from df
    print("Training stub — implement window builder and training loop.")
