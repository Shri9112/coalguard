# CoalGuard: Explainable Coal-Fire Risk Simulator

CoalGuard is an academic prototype and decision-support simulator for explainable coal-fire risk assessment across five bulk-handling environments. It demonstrates how multi-sensor telemetry—thermal rates-of-rise, indicator gases, mechanical vibration, motor current, and particulate interference—can be combined deterministically using **Mamdani Fuzzy Inference** with offline **Particle Swarm Optimization (PSO)** calibration.

---

## 1. Quick Start

Ensure Node.js 20+ is installed.

```bash
# Run these commands from the cloned project folder

# Install the project's dependencies
npm install

# Run the automated engine checks
npm test

# Check code style
npm run lint

# Build optimized production bundle
npm run build

# Start development server
npm run dev -- --port 3002
```

Open [http://localhost:3002](http://localhost:3002) in your browser.

---

## 2. Seven Application Routes & Backend APIs

1. **`/` — Dashboard:** Project purpose, methodology primer, 5-context scope, dynamic data counters, and live simulator status snapshot.
2. **`/architecture` — SCADA & Telemetry Topology Canvas:** Interactive node-based educational fieldbus graph (Sensors, Controllers, Actuators, Gateways, Cloud) with animated telemetry packets, cable fault injection, and a topology connectivity check. This is not a functional-safety or SIL assessment.
3. **`/simulation` — Process Simulation:** Interactive controls for 5 profiles, weather and profile-filtered scenarios, live schematic SVGs, and a risk chart paired with the selected process signal. Solid lines show recorded simulated ticks; dashed lines show a deterministic forward projection under current settings. Changing a control automatically selects its related signal so its modeled effect is visible.
4. **`/sensor-network` — Virtual Sensor Network:** Industrial topology schematic with fixed nodes and mobile thermal inspection unit, live readings table with health bars and engineering units, and fault injection workbench.
5. **`/explain-risk` — Traceable Decision Engine:** Comprehensive Mamdani inspector displaying fuzzification memberships $\mu(x)$, active/quiet IF–THEN rules with exact firing strengths $\alpha_k$, composite output fuzzy set, Centroid Defuzzification calculation $z^* = \frac{\int z \mu(z) dz}{\int \mu(z) dz}$, and evidence quality confidence factors.
6. **`/test-cases` (and `/verification`) — Test Cases:** 10 configured scenarios with expandable input panels, multi-phase timelines, acceptance checks, synthetic benchmark comparison (fixed-threshold baseline vs Basic Mamdani vs PSO-tuned Mamdani), and PSO calibration with a convergence trace.
7. **`/evidence` — Evidence & Provenance:** Includes an 18-episode published underground-mine field replay (3 confirmed fires, 15 event-free episodes, 3,240 four-hourly readings), evaluated by Basic Mamdani, the app's synthetic-data PSO calibration, and a published CO threshold. The page also includes selected laboratory temperature/CO curves, a separate 35-day mine-goaf gas-index record from Guo et al. (2019), and traceable incident/open-data references. The field replay is not conveyor validation; see `docs/REAL_DATA_REPLAY.md` for method and limits.

### Backend API Integrations (`app/api/`)
- `POST /api/evaluate`: Headless Mamdani FIS evaluation, rule activation strengths, and centroid defuzzification trace.
- `POST /api/topology/validate`: Deterministic directed-path and fieldbus continuity checks with an educational connectivity score; it does not assess SIL or functional safety.
- `GET /api/scenarios`: Profiles catalog, benchmark scenarios, and academic metadata.

---

## 3. Five Operating Profiles

| Operating Context | Schematic Features | Primary Hazards Simulated |
|---|---|---|
| **1. Mine Conveyor** | Underground gallery, idlers, belt, head drive pulley, discharge hood | Self-heating, roller bearing friction, drive motor overload |
| **2. Factory CHP** | Crusher feed hopper, vibrating deck, enclosed transfer chute hood, boiler bunker | Chute blockage, particulate interference, spray cooling failure |
| **3. Stockpile Yard** | Open-air tiered piles (Flanks A & B), deep subsurface probes, weather mast | Deep core compaction heating, rain surface chilling (hidden hotspot) |
| **4. Road / Rail Transit** | Selectable **Truck** (tarp cover, bed probes) & **Rail Wagon** (unit train hopper, slipstream airflow) | Transit dwell heating, aerodynamic oxidation feed, axle dynamics |
| **5. Ship Cargo Hold** | Bulk carrier hull, sealed hatch coaming, lower bilge boundary, gas sampling trunk | Deep cargo smolder, oxygen depletion, hazardous gas buildup |

---

## 4. Soft Computing Architecture

- **Independent Engine Layer (`lib/engine/`):**
  - `domain-models.ts`: Lightweight, domain-specific virtual process models for all 5 operating profiles. Implements distinct physical kinetics, spatial hotspot presets, and causal delta explanations.
  - `process-model.ts`: Unified interface delegating deterministic physical calculations, environmental weather modifiers, and spatial Gaussian thermal diffusion to active domain models.
  - `sensors.ts` & `sensor-utils.ts`: Virtual sensor telemetry generation, Mulberry32 PRNG measurement jitter, health scoring, fault injection (noise/dropout decoupled from underlying physical truth), and mobile rover tracking.
  - `trends.ts`: Health-weighted evidence aggregation, rate-of-rise ($dT/dt$, $dCO/dt$), and cross-sensor variance.
  - `fuzzy-system.ts`: Genuine Mamdani pipeline with triangular/trapezoidal membership functions, min-implication, max-aggregation, and discrete centroid defuzzification over $z \in [0, 100]$.
  - `pso.ts`: Offline Particle Swarm Optimizer tuning membership breakpoints and rule weights against labelled synthetic scenarios with quadratic penalties on dust/steam false alarms.
  - `baselines.ts`: Illustrative fixed-threshold academic baseline; its values are not industrial alarm limits.
  - `evaluation.ts`: Automated scenario evaluation calculating True Positives, False Positives, False Alarm Rate (FPR), Detection Delay, Precision, Recall, and F1-score from actual predictions against synthetic labels.

---

### Causal Responsiveness & Multi-Signal Trends
- **Live Process Impact Summary:** Every parameter slider immediately recomputes the process state, evaluates real before-and-after signal deltas, and presents a concise causal summary (e.g. *"Ventilation adjusted: airflow rose by +1.4 m/s; CO gas dispersion lowered CO by -9.2 ppm. Risk stage unchanged (Watch, 48/100)."*).
- **Multi-Signal Trajectory Chart:** Visualizes not only Mamdani Risk Score (0–100) but also Peak Temperature (°C), CO Gas (ppm), Mechanical Vibration (g), and Airflow Speed (m/s) with interactive series toggles and unit legends.
- **Scenario Benchmark Presets:** Each scenario initiates with domain-authentic reproducible parameters. Manual slider changes are clearly marked with a `Customized Parameters` badge and an instant `Restore Preset` button.
- **Noise / Dropout Independence:** Fault injection alters sensor health scores, reading jitter, and evidence confidence, but strictly preserves underlying modeled physical states (`rawPhysicsValue`).

---

## 5. Honest Academic Boundaries

- **Academic Decision-Support Prototype:** This software demonstrates computational Soft Computing principles. It is not certified for industrial safety, does not control real plant equipment, and does not operate physical water sprays or conveyors.
- **Simulated Sensor Readings:** Sensor data, topology, and performance metrics are generated from deterministic synthetic models. They must never be described as industrial field measurements or real-site performance.
- **Laboratory Data Usage:** Published laboratory curves (Guo et al. 2019) are included for studying oxidation kinetics and trend behavior. Laboratory reaction thresholds must never be copied directly into site alarm limits.

---

## 6. Documentation Directory

- [Student Guide (`docs/STUDENT_GUIDE.md`)](./docs/STUDENT_GUIDE.md): In-depth academic guide explaining coal oxidation chemistry, fuzzy logic theory, Mamdani pipeline mathematics, PSO objective functions, and test cases.
- [Evidence Notes (`docs/EVIDENCE_NOTES.md`)](./docs/EVIDENCE_NOTES.md): Citations, DOIs, licensing, and explicit utilization records for all published datasets.
- [Published Replay Notes (`docs/REAL_DATA_REPLAY.md`)](./docs/REAL_DATA_REPLAY.md): Field dataset, model inputs, alert policy, observed results, and limits.
- [Demonstration Sequence (`docs/DEMO_SEQUENCE.md`)](./docs/DEMO_SEQUENCE.md): Step-by-step presentation script for classroom evaluation.
- [Limitations & Roadmap (`docs/LIMITATIONS.md`)](./docs/LIMITATIONS.md): Transparent engineering constraints and future industrial deployment requirements.
- [Complete Project Information (`PROJECT_ALL_INFORMATION.md`)](./PROJECT_ALL_INFORMATION.md): Methods, data provenance, research context, observed replay results, limitations, and future directions.
- [Presentation Slide Text (`PPT_SLIDE_CONTENT.md`)](./PPT_SLIDE_CONTENT.md): Concise, source-aware content for an academic presentation.
