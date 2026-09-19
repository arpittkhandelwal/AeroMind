#!/usr/bin/env bash
# run_demo.sh — UAV Engine Digital Twin End-to-End Demo
#
# What this does:
#   1. Generates a fresh demo mission (nominal profile + overheating fault)
#      using data-sim and saves it to data-sim/samples/
#   2. Starts the backend-api FastAPI server (port 8000)
#   3. Streams the demo mission frames to /telemetry/ingest in near-real-time
#      (with 10x speedup for demo purposes)
#   4. Starts the dashboard (Vite dev server on port 5173)
#   5. Prints URLs and waits for Ctrl+C
#
# Pipeline demonstrated:
#   data-sim → /telemetry/ingest → edge-preprocessing → physics-model
#     → ml-fault-rul → health_index → DB → dashboard
#
# Prerequisites:
#   - Python 3.11+ with .venv at project root (run: python3 -m venv .venv && .venv/bin/pip install ...)
#   - Node.js + npm (for dashboard)
#   - ML models trained (run: cd ml-fault-rul && ../.venv/bin/python train.py)
#
# Usage:
#   ./run_demo.sh                          # default: nominal + overheating
#   ./run_demo.sh --profile high_altitude --fault lubrication_issue
#   ./run_demo.sh --speedup 30            # 30x replay speed

set -euo pipefail

# ---- Parse args ----
PROFILE="nominal"
FAULT="overheating"
SPEEDUP="20"

while [[ $# -gt 0 ]]; do
  case $1 in
    --profile) PROFILE="$2"; shift 2 ;;
    --fault)   FAULT="$2";   shift 2 ;;
    --speedup) SPEEDUP="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ---- Paths ----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SCRIPT_DIR/.venv/bin/python"
DATASIM="$SCRIPT_DIR/data-sim"
BACKEND="$SCRIPT_DIR/backend-api"
DASHBOARD="$SCRIPT_DIR/dashboard"

if [[ ! -f "$VENV" ]]; then
  echo "❌ .venv not found. Run:"
  echo "   python3 -m venv .venv && .venv/bin/pip install fastapi uvicorn pydantic scikit-learn joblib shap numpy jsonschema requests"
  exit 1
fi

if [[ ! -d "$SCRIPT_DIR/ml-fault-rul/models" ]]; then
  echo "❌ ML models not trained yet. Run:"
  echo "   cd ml-fault-rul && ../.venv/bin/python train.py"
  exit 1
fi

MISSION_ID="${PROFILE}_${FAULT}_demo"

# Detect available port (8000 preferred, 8001 fallback)
API_PORT=8000
if lsof -ti:8000 > /dev/null 2>&1; then
  API_PORT=8001
  echo "  ⚠️  Port 8000 in use, using port 8001"
fi
API_URL="http://localhost:${API_PORT}"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║    UAV Engine Digital Twin — DRDO SIH 2026 Demo         ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Profile:  $PROFILE"
echo "║  Fault:    $FAULT"
echo "║  Mission:  $MISSION_ID"
echo "║  API:      $API_URL"
echo "║  Speedup:  ${SPEEDUP}x"

echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ---- Step 1: Generate demo mission ----
echo "📦 [1/4] Generating demo mission..."
cd "$DATASIM"
"$VENV" batch_export.py \
  --outdir samples \
  --profile "$PROFILE" \
  --fault "$FAULT" \
  --seed 99
echo "    ✓ Mission saved to data-sim/samples/${PROFILE}_${FAULT}_seed99.json"

# ---- Step 2: Start backend API ----
echo ""
echo "🚀 [2/4] Starting backend-api on ${API_URL} ..."
cd "$BACKEND"
"$SCRIPT_DIR/.venv/bin/uvicorn" main:app \
  --host 0.0.0.0 \
  --port "$API_PORT" \
  --reload \
  --log-level warning &
BACKEND_PID=$!

# Wait for API to come up
echo "    Waiting for API to be ready..."
for i in $(seq 1 30); do
  if curl -sf "${API_URL}/health" > /dev/null 2>&1; then
    echo "    ✓ Backend API is up (PID $BACKEND_PID)"
    break
  fi
  sleep 0.5
done

# ---- Step 3: Ingest the demo mission ----
echo ""
echo "📡 [3/4] Streaming demo mission frames to /telemetry/ingest..."
echo "    (${SPEEDUP}x speed — fault injected at 40% through mission)"

cd "$DATASIM"
# The batch export file has 'frames' wrapped — stream directly via the generator
"$VENV" streamer.py \
  --profile "$PROFILE" \
  --fault "$FAULT" \
  --fault-start 0.4 \
  --mission-id "$MISSION_ID" \
  --endpoint "${API_URL}/telemetry/ingest" \
  --speedup "$SPEEDUP" \
  --seed 99 &
STREAM_PID=$!

echo "    ✓ Streamer started (PID $STREAM_PID)"
echo "    Mission ID: $MISSION_ID"

# ---- Step 4: Load sample missions into DB for replay ----
echo ""
echo "🗄️  [3b] Loading sample missions into DB for replay..."
cd "$SCRIPT_DIR"
"$VENV" - <<'PYEOF'
import sys, os, json, glob

sys.path.insert(0, 'backend-api')
import database as db

db.init_db()

samples = sorted(glob.glob('data-sim/samples/*.json'))
print(f"  Loading {len(samples)} sample missions...")
for filepath in samples:
    try:
        with open(filepath) as f:
            data = json.load(f)
        mission_id = data['mission_id']
        profile = data.get('profile', 'nominal')
        frames = data.get('frames', [])
        if not frames:
            continue
        started_at = frames[0]['timestamp']
        ended_at = frames[-1]['timestamp']
        from datetime import datetime
        start_dt = datetime.fromisoformat(started_at.rstrip('Z'))
        end_dt = datetime.fromisoformat(ended_at.rstrip('Z'))
        duration_min = (end_dt - start_dt).total_seconds() / 60.0
        db.upsert_mission(mission_id, profile, started_at)
        db.end_mission(mission_id, ended_at, duration_min)
        for frame in frames:
            db.insert_frame(mission_id, frame)
        print(f"  ✓ {mission_id} ({len(frames)} frames)")
    except Exception as e:
        print(f"  ⚠ {filepath}: {e}")
print("  Done loading sample missions.")
PYEOF

# ---- Step 5: Start Dashboard ----
echo ""
echo "🖥️  [4/4] Starting dashboard on http://localhost:5180 ..."
cd "$DASHBOARD"
VITE_MISSION_ID="$MISSION_ID" VITE_API_URL="$API_URL" npm run dev -- --host 0.0.0.0 &
DASH_PID=$!
sleep 3

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                   🎯 Demo Running!                      ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Dashboard:  http://localhost:5180                       ║"
echo "║  API docs:   ${API_URL}/docs                  "
echo "║  API health: ${API_URL}/health                "
echo "║                                                          ║"
echo "║  Mission:    $MISSION_ID"
echo "║  Fault:      $FAULT (injected at 40% through mission)   ║"
echo "║                                                          ║"
echo "║  Watch the dashboard for:                               ║"
echo "║    • Health Index dropping as fault develops            ║"
echo "║    • Alert appearing with recommended action            ║"
echo "║    • RUL decreasing, trend → degrading/critical         ║"
echo "║    • Mission Replay tab for full time-series view       ║"
echo "║                                                          ║"
echo "║  Press Ctrl+C to stop all processes.                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Cleanup on exit
cleanup() {
  echo ""
  echo "🛑 Shutting down..."
  kill $BACKEND_PID $STREAM_PID $DASH_PID 2>/dev/null || true
  echo "✓ All processes stopped."
}
trap cleanup EXIT INT TERM

# Wait forever (until Ctrl+C)
wait $STREAM_PID 2>/dev/null || true
echo "  ℹ️  Stream completed. Dashboard remains live for replay."
wait
