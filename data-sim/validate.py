"""
Validates generated telemetry frames against contracts/telemetry_schema.json.
Run from data-sim/ directory.

Usage:
  python validate.py                   # validates all samples/
  python validate.py samples/foo.json  # validates one file
"""

import json
import os
import sys

try:
    import jsonschema
except ImportError:
    print("jsonschema not installed. Run: pip install jsonschema", file=sys.stderr)
    sys.exit(1)

SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "..", "contracts", "telemetry_schema.json")


def load_schema():
    with open(SCHEMA_PATH) as f:
        return json.load(f)


def validate_frame(frame: dict, schema: dict, idx: int = 0) -> list[str]:
    """Return list of validation errors for a single frame."""
    errors = []
    try:
        jsonschema.validate(instance=frame, schema=schema)
    except jsonschema.ValidationError as e:
        errors.append(f"Frame {idx}: {e.message}")
    return errors


def validate_file(filepath: str, schema: dict) -> tuple[int, int, list[str]]:
    """Validate all frames in a mission JSON file. Returns (total, invalid, errors)."""
    with open(filepath) as f:
        data = json.load(f)

    frames = data.get("frames", [data])  # handle both wrapped and bare frame lists
    all_errors = []
    for i, frame in enumerate(frames):
        all_errors.extend(validate_frame(frame, schema, i))

    return len(frames), len(all_errors), all_errors


def main():
    schema = load_schema()

    # Determine files to validate
    if len(sys.argv) > 1:
        files = sys.argv[1:]
    else:
        samples_dir = os.path.join(os.path.dirname(__file__), "samples")
        if not os.path.isdir(samples_dir):
            print("No samples/ directory found. Run batch_export.py first.", file=sys.stderr)
            sys.exit(1)
        files = [
            os.path.join(samples_dir, f)
            for f in sorted(os.listdir(samples_dir))
            if f.endswith(".json")
        ]

    if not files:
        print("No JSON files found to validate.")
        sys.exit(0)

    total_frames = 0
    total_errors = 0

    for filepath in files:
        try:
            n, errs, error_list = validate_file(filepath, schema)
            total_frames += n
            total_errors += errs
            status = "✓ OK" if errs == 0 else f"✗ {errs} errors"
            print(f"  {os.path.basename(filepath)}: {n} frames — {status}")
            for e in error_list[:5]:  # cap output to first 5 errors per file
                print(f"    → {e}")
        except Exception as e:
            print(f"  FAILED to process {filepath}: {e}", file=sys.stderr)
            total_errors += 1

    print(f"\nTotal: {total_frames} frames validated, {total_errors} errors.")
    sys.exit(0 if total_errors == 0 else 1)


if __name__ == "__main__":
    main()
