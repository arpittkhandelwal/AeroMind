"""
Main edge preprocessing pipeline.

Combines:
  1. Dropout detection and filling (DropoutHandler)
  2. Noise filtering (RollingFilter)
  3. Feature extraction (FeatureExtractor)

Outputs telemetry frames in the same schema plus an additive "features" object.

Usage (as a module):
    from preprocessor import Preprocessor
    pp = Preprocessor()
    enriched_frame = pp.process(raw_frame)

Usage (CLI):
    python preprocessor.py --input samples/nominal_clean.json --output cleaned/nominal_clean.json
"""

import argparse
import json
import os
import sys

from dropout_handler import DropoutHandler
from filters import RollingFilter
from feature_extractor import FeatureExtractor


class Preprocessor:
    """
    Stateful edge preprocessing pipeline.

    Processes frames one at a time (online mode) or in bulk (batch mode).
    State (EMA, buffers) is maintained across frames — create one Preprocessor
    per mission for correct rolling statistics.

    Args:
        expected_hz: expected telemetry frame rate in Hz
        filter_std_window: window for transient detection in RollingFilter
        feature_window: rolling window for FeatureExtractor
    """

    def __init__(
        self,
        expected_hz: float = 1.0,
        filter_std_window: int = 20,
        feature_window: int = 30,
    ):
        self._dropout = DropoutHandler(
            expected_hz=expected_hz,
            max_interpolate_gap=30,
            locf_gap=3,
        )
        self._filter = RollingFilter(std_window=filter_std_window)
        self._extractor = FeatureExtractor(
            window_size=feature_window,
            frame_dt_s=1.0 / expected_hz,
        )
        self._last_frame = None

    def process(self, raw_frame: dict) -> dict:
        """
        Process a single raw telemetry frame.

        Note: dropout handling is best-effort in online mode — gaps are detected
        by comparing with the last seen frame. For batch mode use process_batch().

        Returns:
            enriched frame dict (same schema + "features" key)
        """
        # Dropout: fill gap between last frame and this one
        if self._last_frame is not None:
            filled = self._dropout.fill_gaps([self._last_frame, raw_frame])
            # Process any interpolated frames (skipped in online mode — just use raw)
        else:
            filled = [raw_frame]

        # Filter (noise smoothing)
        filtered = self._filter.filter_frame(raw_frame)

        # Feature extraction
        features = self._extractor.extract(filtered)

        # Combine: filtered frame + features
        result = dict(filtered)
        result["features"] = features

        self._last_frame = raw_frame
        return result

    def process_batch(self, frames: list[dict]) -> list[dict]:
        """
        Process a complete list of frames in order.

        Runs dropout filling first (global pass), then filter + features per frame.

        Returns:
            list of enriched frames
        """
        # Step 1: fill dropouts over the full sequence
        filled_frames = self._dropout.fill_gaps(frames)

        # Step 2: filter + extract features frame by frame
        result = []
        for frame in filled_frames:
            filtered = self._filter.filter_frame(frame)
            features = self._extractor.extract(filtered)
            enriched = dict(filtered)
            enriched["features"] = features
            result.append(enriched)

        return result

    def reset(self) -> None:
        """Reset all internal state (start fresh for a new mission)."""
        self._filter.reset()
        self._extractor.reset()
        self._last_frame = None


def main():
    parser = argparse.ArgumentParser(description="Edge preprocessing CLI")
    parser.add_argument("--input", required=True, help="Input mission JSON file")
    parser.add_argument("--output", required=True, help="Output enriched JSON file")
    parser.add_argument("--hz", type=float, default=1.0)
    args = parser.parse_args()

    with open(args.input) as f:
        data = json.load(f)

    frames = data.get("frames", data if isinstance(data, list) else [data])

    pp = Preprocessor(expected_hz=args.hz)
    enriched = pp.process_batch(frames)

    # Preserve mission metadata if present
    if isinstance(data, dict) and "frames" in data:
        out_data = {k: v for k, v in data.items() if k != "frames"}
        out_data["frames"] = enriched
    else:
        out_data = enriched

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    with open(args.output, "w") as f:
        json.dump(out_data, f, indent=2)

    print(f"Processed {len(enriched)} frames → {args.output}")


if __name__ == "__main__":
    main()
