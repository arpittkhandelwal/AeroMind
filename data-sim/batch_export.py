"""
Batch JSON export for generating labeled sample missions.
Writes one JSON file per mission to the specified output directory.

Usage:
  python batch_export.py --outdir samples/
  python batch_export.py --outdir samples/ --profiles all --faults all
  python batch_export.py --outdir samples/ --profile nominal --fault overheating
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone

from profiles import PROFILES
from faults import FAULT_TYPES
from generator import make_generator


def export_mission(
    profile_name: str,
    fault_type=None,
    outdir: str = "samples",
    seed: int = 42,
    verbose: bool = True,
) -> str:
    """
    Generate a full mission and write it to a JSON file.

    Returns:
        Path to the written file.
    """
    # Deterministic mission IDs for reproducibility
    fault_suffix = f"_{fault_type}" if fault_type else "_clean"
    mission_id = f"{profile_name}{fault_suffix}_seed{seed}"

    gen = make_generator(
        profile_name=profile_name,
        fault_type=fault_type,
        fault_start_frac=0.4,   # fault starts at 40% through mission
        fault_ramp_frames=90,   # 90 second ramp
        mission_id=mission_id,
        seed=seed,
    )

    frames = list(gen.stream())

    os.makedirs(outdir, exist_ok=True)
    filename = f"{mission_id}.json"
    filepath = os.path.join(outdir, filename)

    payload = {
        "mission_id": mission_id,
        "profile": profile_name,
        "fault_type": fault_type,
        "started_at": frames[0]["timestamp"] if frames else None,
        "ended_at": frames[-1]["timestamp"] if frames else None,
        "frame_count": len(frames),
        "frames": frames,
    }

    with open(filepath, "w") as f:
        json.dump(payload, f, indent=2)

    if verbose:
        fault_str = fault_type or "none"
        print(f"  Exported {len(frames)} frames → {filepath}  [profile={profile_name}, fault={fault_str}]")

    return filepath


def main():
    parser = argparse.ArgumentParser(description="Batch telemetry export")
    parser.add_argument("--outdir", default="samples")
    parser.add_argument("--profile", default="all",
                        help="Profile name or 'all'")
    parser.add_argument("--fault", default=None,
                        help="Fault type, 'all', or omit for clean missions")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    profiles_to_run = list(PROFILES.keys()) if args.profile == "all" else [args.profile]
    faults_to_run: list = [None]
    if args.fault == "all":
        faults_to_run = [None] + FAULT_TYPES
    elif args.fault:
        faults_to_run = [args.fault]

    print(f"Exporting {len(profiles_to_run) * len(faults_to_run)} missions to {args.outdir}/")

    for profile_name in profiles_to_run:
        for fault_type in faults_to_run:
            try:
                export_mission(
                    profile_name=profile_name,
                    fault_type=fault_type,
                    outdir=args.outdir,
                    seed=args.seed,
                )
            except Exception as e:
                print(f"  ERROR: {profile_name}/{fault_type}: {e}", file=sys.stderr)

    print("Done.")


if __name__ == "__main__":
    main()
