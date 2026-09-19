# Live Demo Script — DRDO UAV Digital Twin
**Duration**: 5 Minutes
**Target Audience**: SIH 2026 Judges (Defence/Aerospace Engineers & AI Experts)

---

## 0:00 - 1:00 | The Introduction & Architecture
*Leave the dashboard on the **Mission Briefing / Setup** screen.*

**Speaker**: "Welcome to our Digital Twin solution for DRDO PS-26054: AI-enabled Engine Health Monitoring for MALE UAVs. A real MALE UAV engine operates in harsh conditions — high altitudes, extreme temperatures. When a piston engine fails mid-flight, the mission is lost. Our solution doesn't just detect failure; it predicts it, explains it, and gives the operator time to react."

**Action**: *Show the Architecture Diagram briefly if on slides, or just point to the UI.*
**Speaker**: "We've built a full federated edge-to-cloud system. Telemetry is pre-processed on the edge, then sent to our Ground Control API. We run a thermodynamic physics model in parallel with the telemetry. The difference between the physical expectation and the real sensor data — the 'residuals' — is fed into our ML ensemble."

---

## 1:00 - 2:30 | The Simulation (The "Killer" Demo)
**Action**: *On the Setup Screen, select:*
- **Profile**: `Hot Weather`
- **Fault**: `Engine Overheating`
- **Speed**: `120x`
- *Click **Review Mission Briefing**, then **Authorise Launch**.*

**Speaker**: "Let's run a live simulation. We're launching a Hot Weather profile at 120x speed, injecting a progressive Engine Overheating fault. Watch the telemetry."

**Action**: *Point to the right-side Prediction Panel and Health Gauge.*
**Speaker**: "Initially, the engine is healthy. But as the mission progresses, the thermal load increases. Notice the AI Pre-Fault Warning just triggered. The ML model has detected anomalous exhaust and cylinder head temperatures *before* they cross the mechanical red-line."

**Action**: *Wait for Health to drop below 30.*
**Speaker**: "The Health Index is collapsing. The RUL estimator is dropping rapidly. Notice the 'AI Explainability' panel. It's not just throwing an error code; it's telling the operator *exactly* why it's failing in plain English: 'Engine head temperature is elevated by 47°C compared to physics baseline'."

**Action**: *Wait for Engine Explosion (Countdown 3..2..1.. BLAST).*
**Speaker**: "And there is the catastrophic failure. If this were a real flight, the operator would have had roughly 45 minutes of real-world warning to abort the mission or throttle down, thanks to the AI."

---

## 2:30 - 3:30 | Post-Flight Analysis & Mission Replay
**Action**: *On the Mission Report screen, click the **Mission Replay** tab in the sidebar.*

**Speaker**: "After a mission, engineers need to investigate. This is our Mission Replay view."

**Action**: *Select the mission that just failed from the dropdown. Un-toggle everything except CHT and EGT to make the chart clean.*
**Speaker**: "We store every frame of the mission. Notice the red dashed line on the chart — that's the exact moment the AI first detected the anomaly. And if you look at the scrubber at the bottom, we've overlaid visual fault markers in red."

**Action**: *Click the red marker on the timeline scrubber.*
**Speaker**: "An engineer can click right on the fault marker to instantly snap to the exact second the anomaly occurred and review the precise sensor states that triggered the AI."

---

## 3:30 - 4:30 | The ML & Physics Depth (Anticipating Judge Questions)
**Speaker**: "A common problem with AI is black-box behavior and false positives from sensor noise. We solved this in three ways:
1. **Edge Preprocessing**: We filter noise and extract rolling standard deviations before it even hits the ML layer.
2. **Physics Baseline**: We don't just feed raw data to the ML. We feed the *residuals* — the delta between our Thermodynamic Model's ISA density-corrected predictions and reality.
3. **Explainable AI (XAI)**: We use SHAP-inspired feature attribution to map the ML decision back to the physical sensor that drove it, which you saw in the insight cards."

---

## 4:30 - 5:00 | Conclusion & Deployment Roadmap
**Speaker**: "This isn't just a dashboard; it's a complete, deployable pipeline. We have our `edge-preprocessing` module ready to be compiled to C++ for flight controllers, our APIs are fully documented in OpenAPI, and our models are trained on over 200 high-variance synthetic missions. Thank you."
