#!/usr/bin/env python3
"""
generate_training_data.py — Bulk training dataset generator for ml-fault-rul.

Generates 200+ labeled mission JSON files across:
  - 5 mission profiles
  - 8 fault conditions (7 fault types + clean)
  - 5 seeds per combination

Total: 5 × 8 × 5 = 200 missions

Fault ramp:
  - Training missions: 120s ramp (realistic gradual onset for RUL learning)
  - Demo missions (seed=99): 30s ramp (clear fault signature for live demo)

Usage:
  python generate_training_data.py
  python generate_training_data.py --outdir samples --seeds 42 43 44 45 46
  python generate_training_data.py --demo-only  # generate only 8 demo missions
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))
from profiles import PROFILES
from faults import FAULT_TYPES
from generator import make_generator


TRAINING_SEEDS = [42, 43, 44, 45, 46]
DEMO_SEED = 99
DEMO_FAULT_START = 0.3   # fault starts at 30% for demo (earlier + more visible)
DEMO_RAMP_FRAMES = 30    # fast ramp for demo clarity
TRAIN_FAULT_START = 0.4  # realistic 40% for training
TRAIN_RAMP_FRAMES = 120  # slow ramp for RUL signal richness


def export_mission(profile_name, fault_type, outdir, seed,
                   fault_start_frac=TRAIN_FAULT_START,
                   ramp_frames=TRAIN_RAMP_FRAMES,
                   verbose=True):
    fault_suffix = f"_{fault_type}" if fault_type else "_clean"
    mission_id = f"{profile_name}{fault_suffix}_seed{seed}"

    # Skip if already exists
    filepath = os.path.join(outdir, f"{mission_id}.json")
    if os.path.exists(filepath):
        if verbose:
            print(f"  SKIP (exists): {mission_id}")
        return filepath

    gen = make_generator(
        profile_name=profile_name,
        fault_type=fault_type,
        fault_start_frac=fault_start_frac,
        fault_ramp_frames=ramp_frames,
        mission_id=mission_id,
        seed=seed,
    )

    frames = list(gen.stream())

    payload = {
        "mission_id": mission_id,
        "profile": profile_name,
        "fault_type": fault_type,
        "seed": seed,
        "started_at": frames[0]["timestamp"] if frames else None,
        "ended_at": frames[-1]["timestamp"] if frames else None,
        "frame_count": len(frames),
        "frames": frames,
    }

    os.makedirs(outdir, exist_ok=True)
    with open(filepath, "w") as f:
        json.dump(payload, f, separators=(",", ":"))  # compact for disk efficiency

    if verbose:
        fault_str = fault_type or "none"
        print(f"  {mission_id}: {len(frames)} frames [profile={profile_name}, fault={fault_str}, seed={seed}]")

    return filepath


def main():
    parser = argparse.ArgumentParser(description="Bulk training data generator")
    parser.add_argument("--outdir", default=os.path.join(os.path.dirname(__file__), "samples"))
    parser.add_argument("--seeds", nargs="+", type=int, default=TRAINING_SEEDS)
    parser.add_argument("--demo-only", action="store_true",
                        help="Only generate demo missions (seed=99, short ramp)")
    parser.add_argument("--skip-existing", action="store_true", default=True)
    args = parser.parse_args()

    os.makedirs(args.outdir, exist_ok=True)
    total = 0
    errors = 0

    all_faults = [None] + FAULT_TYPES  # None = clean mission

    if not args.demo_only:
        # ── Training missions ──────────────────────────────────────────────
        print(f"\n[1/2] Generating TRAINING missions ({len(PROFILES)} profiles × "
              f"{len(all_faults)} conditions × {len(args.seeds)} seeds)...")

        for profile_name in PROFILES:
            for fault_type in all_faults:
                for seed in args.seeds:
                    try:
                        export_mission(
                            profile_name=profile_name,
                            fault_type=fault_type,
                            outdir=args.outdir,
                            seed=seed,
                            fault_start_frac=TRAIN_FAULT_START,
                            ramp_frames=TRAIN_RAMP_FRAMES,
                        )
                        total += 1
                    except Exception as e:
                        print(f"  ERROR: {profile_name}/{fault_type}/seed{seed}: {e}")
                        errors += 1

    # ── Demo missions (seed=99, short ramp, clear fault) ──────────────────
    print(f"\n[2/2] Generating DEMO missions (seed={DEMO_SEED}, fast ramp)...")
    demo_combos = [
        ("nominal", None),
        ("nominal", "overheating"),
        ("hot_weather", "overheating"),
        ("rapid_throttle", "combustion_instability"),
        ("high_altitude", "lubrication_issue"),
        ("endurance", "sensor_drift"),
        ("hot_weather", "misfire"),
        ("rapid_throttle", "abnormal_vibration"),
    ]
    for profile_name, fault_type in demo_combos:
        try:
            export_mission(
                profile_name=profile_name,
                fault_type=fault_type,
                outdir=args.outdir,
                seed=DEMO_SEED,
                fault_start_frac=DEMO_FAULT_START,
                ramp_frames=DEMO_RAMP_FRAMES,
            )
            total += 1
        except Exception as e:
            print(f"  ERROR demo {profile_name}/{fault_type}: {e}")
            errors += 1

    total_files = len([f for f in os.listdir(args.outdir) if f.endswith(".json")])
    print(f"\n✓ Done. Generated/verified {total} missions this run. "
          f"Total in {args.outdir}: {total_files}. Errors: {errors}.")
    if errors:
        print("  ⚠ Some missions failed — check above for details.")


if __name__ == "__main__":
    main()
