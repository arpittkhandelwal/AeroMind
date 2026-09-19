# UAV Digital Twin — Ground Control Station

A live, browser-based 3D digital twin of a MALE UAV paired with a Ground
Control Station (GCS) panel. It simulates flight telemetry against a
physics-expected baseline, flags anomalies before they reach a redline,
shows a predicted-time-to-failure countdown, and lets you inspect any
subsystem in 3D by clicking on it.

**Live demo:** deploy it yourself in under a minute — see below.

## What it does

- A 3D UAV (X-wing airframe, twin-blade pusher prop, nose sensor head,
  Indian tricolour markings) flies a slow orbit. Drag to rotate the
  camera, scroll or pinch to zoom.
- **Start mission** streams simulated telemetry for engine, fuel,
  avionics, wing and datalink subsystems, each compared against an
  expected baseline for the selected flight condition.
- **Inject fault** triggers one of nine failure modes (engine overheat,
  oil pressure loss, misfire, gimbal stall, aileron drift, datalink
  degradation, fuel pump cavitation, actuator jam, bus brownout) or a
  random unannounced one.
- The status banner escalates NOMINAL → CAUTION → WARNING → CRITICAL as
  a countdown to predicted failure runs down. A "why this alert" panel
  shows which sensors are driving the call and by how much.
- **Click any part of the airframe** to open its own telemetry and
  health readout, whether or not it's the part that's failing.
- Apply the fault's specific corrective action, or hit **Return to
  base**, to recover. Ignore it and the airframe breaks apart into
  falling debris with a full loss report.

Everything — geometry, textures, telemetry math, and the fault model —
is generated in one self-contained HTML file. There's no build step,
no backend, and no external assets beyond three.js and a Google Font,
both loaded from public CDNs.

**Honesty note for evaluators:** the physics baselines, anomaly scores,
and remaining-useful-life countdown are illustrative math tuned to
behave plausibly for a demo. They are not derived from real
piston-engine thermodynamics or a trained ML model. Present this as
the visualization / operator-interaction layer for a real predictive-
maintenance pipeline, not the pipeline itself.

## Run it locally

No install needed — just open the file:

```bash
open index.html        # macOS
# or
xdg-open index.html    # Linux
# or double-click index.html on Windows
```

Or serve it (recommended, avoids browser file:// restrictions):

```bash
npx serve .
```

## Push to GitHub

```bash
git init
git add .
git commit -m "UAV digital twin GCS"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## Deploy to Vercel

**Option A — Vercel dashboard (no CLI):**
1. Push this folder to a GitHub repo (above).
2. Go to https://vercel.com/new and import that repo.
3. Framework preset: **Other**. Build command: none. Output directory: `.`
4. Click **Deploy**. Vercel serves `index.html` at the project root.

**Option B — Vercel CLI:**
```bash
npm i -g vercel
vercel login
vercel --prod
```

No environment variables or build step are required either way.

## Project structure

```
.
├── index.html      # the entire app: markup, styles, and JS in one file
├── vercel.json     # static deployment config + basic security headers
├── package.json    # metadata only, no dependencies
└── README.md
```

## Customizing

All tunable content lives near the top of the `<script>` block in
`index.html`:
- `SENSORS` — the telemetry channels, units, and noise bands
- `CONDITIONS` — flight profiles and how they shift each baseline
- `PARTS` — the clickable subsystems and which sensors belong to each
- `FAULTS` — the injectable failure modes, their root cause, fix, and
  which sensors drive the anomaly score

The airframe geometry is built procedurally in the `buildUAV()`
function using primitive three.js geometry and canvas-drawn textures —
no external 3D model files.
