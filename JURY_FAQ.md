# Jury Round: Q&A and Technical FAQ

This document is prepared for the SIH Hackathon Jury Round. Use these questions and answers to confidently explain your technical approach, data strategy, and core innovations.

---

## 📊 Data Strategy

### Q1: What dataset are you using to train the machine learning model?
**Answer:** 
Since real-world catastrophic failure data for UAV engines is highly classified and proprietary, we built a **Physics-Based Flight Dynamics Simulator** to generate synthetic but highly realistic telemetry data. Our simulator models a UAV engine's thermodynamics and mechanics at high frequency, then outputs telemetry frames at 1Hz (matching real-world sat-link constraints). We simulated 7 distinct failure modes (e.g., Cylinder Misfire, Lubrication Failure) across various flight profiles (e.g., Hot & High, Loiter, Max Climb). To ensure the ML model doesn't overfit to "perfect" math, we injected Gaussian noise into the sensor streams during training to mimic real-world sensor drift and atmospheric interference. We generated over 1.2 million frames of data for training and testing.

### Q2: Why didn't you just use a standard open-source dataset like the NASA Turbofan dataset?
**Answer:**
The NASA Turbofan (CMAPSS) dataset is excellent, but it is built for massive commercial jet engines, not the internal combustion or electric propulsion systems typically found in MALE (Medium-Altitude Long-Endurance) UAVs. We needed a dataset that specifically modeled UAV telemetry metrics like Cylinder Head Temperature (CHT), Exhaust Gas Temperature (EGT), and vibration G-forces, which are critical for our specific use case.

---

## 🧠 Machine Learning & AI

### Q3: How is your ML model detecting faults? Is it just looking at threshold limits?
**Answer:**
No, relying on static thresholds (e.g., "Alert if engine temperature > 120°C") causes too many false alarms because an engine naturally gets hot during a steep climb. 
Instead, our innovation is using **Physics Residuals**. Our backend calculates what the *expected* sensor value should be based on the current physics state (Altitude, Throttle, RPM, Ambient Temp). The ML model (a Random Forest Classifier) looks at the *residual*—the difference between the expected value and the actual value. If the actual temperature is spiking while the drone is just idling, the residual spikes, and the AI immediately flags an anomaly.

### Q4: Why did you choose a Random Forest instead of a Deep Learning model like LSTM or Neural Networks?
**Answer:**
Three reasons: **Latency, Resource Constraints, and Explainability.**
1. UAV Ground Control Stations need real-time inference. Random Forest predictions are incredibly fast (<10ms).
2. Neural networks are "black boxes." We integrated Explainable AI (XAI) using global Random Forest Gini feature importance. If our AI predicts a Lubrication Failure, the commander needs to know *why*. Our model outputs exactly which sensors (e.g., "Oil Pressure Residual") matter most for predicting that fault. You can see this live on our `/diagnostics` dashboard. (Note: True per-prediction SHAP attribution is a planned future improvement).

### Q5: How accurate is your model?
**Answer:**
After rigorous hyperparameter tuning (constraining `max_depth` to 8 to prevent overfitting) and testing against noisy data, our model achieved a **92.0% accuracy** on unseen test data, with a Macro F1-Score of 0.93. 

---

## 🌐 The Digital Twin & System Architecture

### Q6: What makes this a "Digital Twin" rather than just a dashboard?
**Answer:**
A dashboard just shows numbers; a digital twin is a living, virtual replica of the physical asset. 
Our system features a real-time, interactive 3D spatial model built with React Three Fiber. The 3D model is bi-directionally linked to the backend telemetry. For example, if the physical UAV experiences abnormal vibrations (measured by the `vibration_g` sensor), the 3D model on the screen literally shakes. Furthermore, when the AI's Remaining Useful Life (RUL) prediction reaches zero, the 3D model simulates catastrophic airframe loss by physically breaking apart into debris on the screen.

### Q7: What is your Tech Stack and is it scalable?
**Answer:**
- **Frontend:** React, Vite, TailwindCSS, and Three.js for rendering the 3D simulation at 60fps in the browser.
- **Backend:** FastAPI (Python) running asynchronously.
- **Scalability:** The backend uses stateless REST polling to serve ~1Hz telemetry (matching standard UAV datalink rates) without bogging down the server. Server-Sent Events (SSE) or WebSockets would be the next step for higher frequency data. The ML inference is highly vectorized using NumPy/Pandas, meaning a single server can monitor fleet-wide UAV operations simultaneously.

---

## 💡 Impact & SIH Relevance

### Q8: What is the real-world impact of this project for the Defense/Aerospace sector?
**Answer:**
Currently, UAV maintenance is mostly *preventative* (e.g., replacing parts every 500 hours regardless of condition) or *reactive* (fixing it after it crashes). 
Our platform introduces **Predictive Maintenance**. By providing early warnings of subsystem degradation and displaying a live "Remaining Useful Life" (RUL) countdown, military operators can abort missions *before* losing a multi-million dollar airframe, saving both taxpayer money and critical operational payloads.
