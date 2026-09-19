"""
Training pipeline for ml-fault-rul models.

Trains three models in sequence:
  1. AnomalyDetector (Isolation Forest on physics residuals)
  2. FaultClassifier (Random Forest multi-class)
  3. RULEstimator (Gradient Boosted regression)

Data source: data-sim/samples/ (pre-generated labeled missions)

Each model is saved to ml-fault-rul/models/ as .joblib files.

Usage:
  python train.py
  python train.py --samples-dir ../data-sim/samples
  python train.py --max-missions 10   # for quick test runs
"""

import argparse
import json
import os
import sys
import random

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "physics-model"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "edge-preprocessing"))

from engine_model import ThermodynamicModel
from preprocessor import Preprocessor
from anomaly import AnomalyDetector
from classifier import FaultClassifier
from rul_estimator import RULEstimator, compute_synthetic_rul

SAMPLES_DIR = os.path.join(os.path.dirname(__file__), "..", "data-sim", "samples")


def load_mission(filepath: str, max_frames: int = None) -> dict:
    """Load a mission JSON file and return the frames list + metadata."""
    with open(filepath) as f:
        data = json.load(f)
    frames = data.get("frames", [])
    if max_frames:
        frames = frames[:max_frames]
    return {
        "mission_id": data.get("mission_id", "unknown"),
        "profile": data.get("profile", "nominal"),
        "fault_type": data.get("fault_type"),
        "frames": frames,
    }


def preprocess_mission(frames: list[dict], hz: float = 1.0) -> list[dict]:
    """Run edge preprocessing on a list of frames."""
    pp = Preprocessor(expected_hz=hz)
    return pp.process_batch(frames)


def main():
    parser = argparse.ArgumentParser(description="Train ml-fault-rul models")
    parser.add_argument("--samples-dir", default=SAMPLES_DIR)
    parser.add_argument("--max-missions", type=int, default=None,
                        help="Cap total missions loaded for faster testing")
    parser.add_argument("--anomaly-only", action="store_true")
    parser.add_argument("--skip-anomaly", action="store_true")
    args = parser.parse_args()

    samples_dir = args.samples_dir
    if not os.path.isdir(samples_dir):
        print(f"ERROR: samples directory not found: {samples_dir}")
        print("Run: cd data-sim && python batch_export.py --outdir samples")
        sys.exit(1)

    # Load all mission JSON files
    mission_files = sorted([
        os.path.join(samples_dir, f)
        for f in os.listdir(samples_dir)
        if f.endswith(".json")
    ])
    if args.max_missions:
        mission_files = mission_files[:args.max_missions]
    
    print(f"Found {len(mission_files)} mission files in {samples_dir}")

    # Split missions into Train (80%) and Test (20%)
    random.seed(42)
    random.shuffle(mission_files)
    split_idx = int(len(mission_files) * 0.8)
    train_files = mission_files[:split_idx]
    test_files = mission_files[split_idx:]
    print(f"Split: {len(train_files)} Train missions, {len(test_files)} Test missions")

    # Shared physics model (stateless for training — new instance per mission frame)
    physics_model = ThermodynamicModel()

    # -------------------------------------------------------------------------
    # 1. Load + preprocess all missions
    # -------------------------------------------------------------------------
    print("\n[1/4] Loading and preprocessing missions...")
    
    def _load_set(files):
        frames_out, fault_labels_out, rul_labels_out, elapsed_out, clean_out = [], [], [], [], []
        for filepath in files:
            try:
                mission = load_mission(filepath)
                raw_frames = mission["frames"]
                fault_type = mission["fault_type"]
                total = len(raw_frames)

                # Preprocess
                processed = preprocess_mission(raw_frames, hz=1.0)

                for i, frame in enumerate(processed):
                    fault_label = frame.get("fault_label", "none") or "none"
                    mission_elapsed = i / max(total, 1)
                    anomaly_proxy = 0.7 if fault_label != "none" and fault_label is not None else 0.05
                    rul = compute_synthetic_rul(i, total, fault_label, anomaly_proxy)

                    frames_out.append(frame)
                    fault_labels_out.append(fault_label)
                    rul_labels_out.append(rul)
                    elapsed_out.append(mission_elapsed)
                    if fault_label == "none":
                        clean_out.append(frame)
            except Exception as e:
                print(f"  WARNING: failed to load {filepath}: {e}")
        return frames_out, fault_labels_out, rul_labels_out, elapsed_out, clean_out

    print("  Loading Train set...")
    train_frames, train_faults, train_ruls, train_elapsed, train_clean = _load_set(train_files)
    print("  Loading Test set...")
    test_frames, test_faults, test_ruls, test_elapsed, test_clean = _load_set(test_files)

    print(f"  Train: {len(train_frames)} frames | Test: {len(test_frames)} frames")

    # -------------------------------------------------------------------------
    # 2. Train Anomaly Detector
    # -------------------------------------------------------------------------
    if not args.skip_anomaly:
        print("\n[2/4] Training AnomalyDetector on clean train frames...")
        anomaly_physics = ThermodynamicModel()
        detector = AnomalyDetector(contamination=0.05, n_estimators=100)
        detector.fit(train_clean, anomaly_physics)
        detector.save()
    else:
        print("\n[2/4] Skipping anomaly detector training.")

    if args.anomaly_only:
        print("Done (anomaly only mode).")
        return

    # -------------------------------------------------------------------------
    # 3. Train Fault Classifier
    # -------------------------------------------------------------------------
    print("\n[3/4] Training FaultClassifier...")
    clf_physics = ThermodynamicModel()
    classifier = FaultClassifier(n_estimators=200)
    classifier.fit(train_frames, clf_physics)
    classifier.save()

    print("\n  Evaluating FaultClassifier on Test Set...")
    import numpy as np
    from sklearn.metrics import classification_report
    from classifier import _frame_to_clf_vector
    test_X, test_y = [], []
    for f in test_frames:
        test_y.append(f.get("fault_label", "none") or "none")
        res = clf_physics.compute_residuals(f, clf_physics.predict(
            float(f.get("rpm", 5000)), float(f.get("throttle_pct", 65)),
            float(f.get("altitude_m", 1500)), float(f.get("ambient_temp_c", 25))
        ))
        test_X.append(classifier._scaler.transform([_frame_to_clf_vector(f, res, add_noise=True)])[0])
    
    test_X_np = np.array(test_X, dtype=np.float32)
    y_pred_enc = classifier._model.predict(test_X_np)
    y_pred = classifier._encoder.inverse_transform(y_pred_enc)
    report = classification_report(test_y, y_pred, output_dict=True)
    print(classification_report(test_y, y_pred))
    
    with open(os.path.join(os.path.dirname(__file__), "models", "metrics.json"), "w") as f:
        json.dump(report, f, indent=2)

    # -------------------------------------------------------------------------
    # 4. Compute anomaly scores + fault probabilities for RUL features
    #    (using trained models on training data — shortcut: sample 10k frames)
    # -------------------------------------------------------------------------
    print("\n[4/4] Training RULEstimator...")

    # Subsample for RUL feature computation (avoid re-running full dataset)
    subsample_size = min(len(train_frames), 20000)
    indices = random.sample(range(len(train_frames)), subsample_size)
    sub_frames = [train_frames[i] for i in indices]
    sub_rul_labels = [train_ruls[i] for i in indices]
    sub_elapsed = [train_elapsed[i] for i in indices]
    sub_fault_labels = [train_faults[i] for i in indices]

    # Compute anomaly scores for subsampled frames
    rul_physics = ThermodynamicModel()
    anomaly_scores_sub = []
    fault_probas_sub = []

    if not args.skip_anomaly:
        detector2 = AnomalyDetector()
        try:
            detector2.load()
            clf2 = FaultClassifier()
            clf2.load()
            for frame in sub_frames:
                try:
                    score = detector2.predict_score(frame, rul_physics)
                    fp = clf2.predict(frame, rul_physics)["probabilities"]
                except Exception:
                    score = 0.0
                    fp = {}
                anomaly_scores_sub.append(score)
                fault_probas_sub.append(fp)
        except Exception as e:
            print(f"  WARNING: Could not load models for RUL features: {e}")
            anomaly_scores_sub = [0.05 if lbl == "none" else 0.6
                                  for lbl in sub_fault_labels]
            fault_probas_sub = [{}] * len(sub_frames)
    else:
        anomaly_scores_sub = [0.05 if lbl == "none" else 0.6 for lbl in sub_fault_labels]
        fault_probas_sub = [{}] * len(sub_frames)

    # Recompute synthetic RUL using actual anomaly scores
    sub_rul_labels_updated = [
        compute_synthetic_rul(
            int(sub_elapsed[i] * 10000), 10000,
            sub_fault_labels[i], anomaly_scores_sub[i]
        )
        for i in range(len(sub_frames))
    ]

    rul_estimator = RULEstimator(n_estimators=200, max_depth=5)
    rul_estimator.fit(
        sub_frames,
        sub_rul_labels_updated,
        rul_physics,
        anomaly_scores=anomaly_scores_sub,
        fault_probas=fault_probas_sub,
        mission_elapsed_list=sub_elapsed,
    )
    rul_estimator.save()

    print("\n✓ All models trained and saved to ml-fault-rul/models/")


if __name__ == "__main__":
    main()
