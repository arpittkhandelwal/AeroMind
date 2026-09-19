"""
confusion_matrix_analysis.py
============================
Loads the trained FaultClassifier and runs evaluation on the held-out
test set (same 80/20 split as train.py). Saves:
  - ml-fault-rul/models/confusion_matrix.json
  - ml-fault-rul/models/rul_metrics.json

Run from repo root:
  python ml-fault-rul/confusion_matrix_analysis.py

No retraining — loads saved .joblib models only.
"""
import os, sys, json, random
import numpy as np

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ROOT, "..", "physics-model"))
sys.path.insert(0, os.path.join(ROOT, "..", "edge-preprocessing"))

from engine_model import ThermodynamicModel
from preprocessor import Preprocessor
from classifier import FaultClassifier, _frame_to_clf_vector, FAULT_CLASSES
from rul_estimator import RULEstimator, compute_synthetic_rul, _frame_to_rul_vector

SAMPLES_DIR = os.path.join(ROOT, "..", "data-sim", "samples")
MODELS_DIR  = os.path.join(ROOT, "models")

def load_mission(fp):
    with open(fp) as f:
        d = json.load(f)
    return {"frames": d.get("frames", []), "fault_type": d.get("fault_type")}

def preprocess_frames(frames):
    pp = Preprocessor(expected_hz=1.0)
    return pp.process_batch(frames)

def main():
    # --------------------------------------------------------------------------
    # Reproduce the same 80/20 train/test split as train.py
    # --------------------------------------------------------------------------
    mission_files = sorted([
        os.path.join(SAMPLES_DIR, f)
        for f in os.listdir(SAMPLES_DIR) if f.endswith(".json")
    ])
    random.seed(42)
    random.shuffle(mission_files)
    split_idx   = int(len(mission_files) * 0.8)
    test_files  = mission_files[split_idx:]
    print(f"Test missions: {len(test_files)} ({len(test_files)*100//len(mission_files)}% split)")

    # --------------------------------------------------------------------------
    # Load models
    # --------------------------------------------------------------------------
    physics = ThermodynamicModel()
    clf = FaultClassifier(); clf.load()
    rul_est = RULEstimator(); rul_est.load()

    # --------------------------------------------------------------------------
    # Collect test predictions — Fault Classifier
    # --------------------------------------------------------------------------
    y_true_clf, y_pred_clf = [], []
    rul_true, rul_pred_list = [], []

    for fp in test_files:
        try:
            mission = load_mission(fp)
            raw     = mission["frames"]
            total   = len(raw)
            frames  = preprocess_frames(raw)
        except Exception as e:
            print(f"  WARN: {fp}: {e}")
            continue

        for i, frame in enumerate(frames):
            true_label = (frame.get("fault_label") or "none")
            # Fault classification
            res = physics.compute_residuals(
                frame,
                physics.predict(
                    float(frame.get("rpm", 5000)),
                    float(frame.get("throttle_pct", 65)),
                    float(frame.get("altitude_m", 1500)),
                    float(frame.get("ambient_temp_c", 25)),
                )
            )
            vec     = _frame_to_clf_vector(frame, res, add_noise=False)
            X_scaled = clf._scaler.transform([vec])
            pred_enc = clf._model.predict(X_scaled)[0]
            pred_label = clf._encoder.inverse_transform([pred_enc])[0]
            y_true_clf.append(true_label)
            y_pred_clf.append(pred_label)

            # RUL regression — build ground truth label same way as train.py
            mission_elapsed = i / max(total, 1)
            anomaly_proxy = 0.7 if true_label != "none" else 0.05
            true_rul = compute_synthetic_rul(i, total, true_label, anomaly_proxy)
            rul_vec  = _frame_to_rul_vector(frame, res, anomaly_proxy, {}, mission_elapsed)
            X_rul = rul_est._scaler.transform([rul_vec])
            pred_rul = float(rul_est._model.predict(X_rul)[0])
            rul_true.append(true_rul)
            rul_pred_list.append(pred_rul)

    y_true_clf  = np.array(y_true_clf)
    y_pred_clf  = np.array(y_pred_clf)
    rul_true    = np.array(rul_true,     dtype=np.float32)
    rul_pred_np = np.array(rul_pred_list, dtype=np.float32)

    print(f"\nTotal test frames evaluated: {len(y_true_clf)}")

    # --------------------------------------------------------------------------
    # CONFUSION MATRIX
    # --------------------------------------------------------------------------
    labels = sorted(set(y_true_clf) | set(y_pred_clf))
    label_to_idx = {l: i for i, l in enumerate(labels)}
    n = len(labels)
    cm = np.zeros((n, n), dtype=int)
    for yt, yp in zip(y_true_clf, y_pred_clf):
        cm[label_to_idx[yt]][label_to_idx[yp]] += 1

    cm_dict = {
        "labels": labels,
        "matrix": cm.tolist(),
        "note": (
            "Rows = true class, Columns = predicted class. "
            "Off-diagonal entries show misclassifications. "
            "Generated by confusion_matrix_analysis.py on the 20%% held-out test split."
        )
    }
    cm_path = os.path.join(MODELS_DIR, "confusion_matrix.json")
    with open(cm_path, "w") as f:
        json.dump(cm_dict, f, indent=2)
    print(f"\nConfusion matrix saved → {cm_path}")

    # Pretty print
    print(f"\n{'':30s}", end="")
    for l in labels:
        print(f"{l[:12]:>13}", end="")
    print()
    for i, l in enumerate(labels):
        print(f"{l:30s}", end="")
        for j in range(n):
            print(f"{cm[i,j]:>13}", end="")
        print()

    # --------------------------------------------------------------------------
    # Per-class precision / recall
    # --------------------------------------------------------------------------
    print("\n--- Misfire vs combustion_instability overlap ---")
    if "misfire" in label_to_idx and "combustion_instability" in label_to_idx:
        mi = label_to_idx["misfire"]
        ci = label_to_idx["combustion_instability"]
        ni = label_to_idx.get("none", -1)
        print(f"  Misfires predicted as combustion_instability: {cm[mi][ci]}")
        print(f"  combustion_instability predicted as misfire:  {cm[ci][mi]}")
        if ni >= 0:
            print(f"  Misfires predicted as none:                   {cm[mi][ni]}")
            print(f"  combustion_instability predicted as none:      {cm[ci][ni]}")
            total_misfire = cm[mi].sum()
            total_ci      = cm[ci].sum()
            print(f"  misfire total test frames:                    {total_misfire}")
            print(f"  combustion_instability total test frames:     {total_ci}")

    # --------------------------------------------------------------------------
    # RUL METRICS
    # --------------------------------------------------------------------------
    rul_errors = np.abs(rul_true - rul_pred_np)
    mae        = float(np.mean(rul_errors))
    rmse       = float(np.sqrt(np.mean((rul_true - rul_pred_np) ** 2)))
    within_2h  = float(np.mean(rul_errors <= 2.0) * 100)
    within_10h = float(np.mean(rul_errors <= 10.0) * 100)
    within_25h = float(np.mean(rul_errors <= 25.0) * 100)

    rul_metrics = {
        "test_frames": int(len(rul_true)),
        "mae_hours":   round(mae, 2),
        "rmse_hours":  round(rmse, 2),
        "within_2h_pct":  round(within_2h, 1),
        "within_10h_pct": round(within_10h, 1),
        "within_25h_pct": round(within_25h, 1),
        "note": (
            "Evaluated on 20%% held-out test split (same seed=42 shuffle as train.py). "
            "RUL ground truth is synthetic (compute_synthetic_rul heuristic). "
            "Real RUL ground truth would require fleet failure data."
        )
    }
    rul_path = os.path.join(MODELS_DIR, "rul_metrics.json")
    with open(rul_path, "w") as f:
        json.dump(rul_metrics, f, indent=2)

    print(f"\n--- RUL Estimator Test Metrics ---")
    print(f"  Test frames:          {len(rul_true)}")
    print(f"  MAE:                  {mae:.2f}h")
    print(f"  RMSE:                 {rmse:.2f}h")
    print(f"  Within ±2h:           {within_2h:.1f}%")
    print(f"  Within ±10h:          {within_10h:.1f}%")
    print(f"  Within ±25h:          {within_25h:.1f}%")
    print(f"\nRUL metrics saved → {rul_path}")

    print("\n✓ Analysis complete.")

if __name__ == "__main__":
    main()
