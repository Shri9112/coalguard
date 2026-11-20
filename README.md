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

## 6. Research, Evidence & Current Findings

CoalGuard separates **published measurements**, **synthetic examples**, and **simulated telemetry**. They serve different purposes and are not interchangeable:

| Evidence | How it is used | What it can show |
|---|---|---|
| Published underground-mine episode dataset | An adapted, attributed copy of the supplementary records is replayed through the existing Mamdani engine and compared with a PSO-tuned version and a published CO threshold. | How these implementations respond to this small set of historical mine episodes under CoalGuard's stated evaluation policy. |
| Published laboratory coal-oxidation measurements | Selected temperature and CO values are replayed as examples on the Evidence page. | How the rule engine responds to recorded laboratory values; not field detection accuracy. |
| Synthetic scenarios and PSO calibration examples | Deterministic scenarios exercise the five modeled profiles; six labelled synthetic examples are used by the PSO calibration. | Repeatable demonstrations and software checks; not independent industrial evidence. |
| Live simulator and virtual sensors | Values are generated by CoalGuard's deterministic process and sensor models. | Cause-and-effect behavior inside the prototype; not measurements from a real facility. |

### Published-data replay result

The replay contains **18 underground-mine episodes**: 3 independently confirmed fires and 15 event-free periods, with 3,240 readings at four-hour intervals. All three methods alerted before confirmation in 3/3 fire episodes and had persistent alarms in 0/15 event-free episodes in this replay.

| Method | Median warning lead in CoalGuard's replay |
|---|---:|
| Basic Mamdani | 100 hours |
| PSO-tuned Mamdani | 108 hours |
| Published CO threshold comparator (11.14 ppm) | 232 hours |

These are exploratory results on a small dataset, not proof of general performance. The CO-only comparator had a longer median lead in this replay. PSO changed the median lead by eight hours compared with basic Mamdani, while the episode-level alert counts stayed the same. This is useful evidence against claiming that PSO automatically improves the system: its role here is to search for better fuzzy parameters, and its benefit must be demonstrated through broader, independent evaluation.

CoalGuard's 232-hour CO result is a separate recomputation using the documented 24-hour persistence policy. The source paper reports 276 hours with its own evaluation convention, so 232 hours must not be presented as an exact reproduction of that published result. This replay only covers underground-mine spontaneous-combustion episodes; it does **not** validate conveyor, factory, stockpile, road/rail, or ship-cargo operation.

### Research sources and provenance

- **Field episode replay:** Cinar, U. (2026), *Gas Indices and Deep Learning for Early Warning of Coal Spontaneous Combustion: A False-Alarm-Controlled Evaluation with Simulation and Field Evidence*, *Sustainability*, 18(18), 9473. [Article](https://doi.org/10.3390/su18189473) · [Supplementary dataset record](https://doi.org/10.5281/zenodo.22686082). The adapted dataset copy is attributed in the application and source notes; reported license is CC BY 4.0.
- **Laboratory coal-oxidation data:** Guo et al. (2019), *Data on analysis of temperature inversion during spontaneous combustion of coal*, *Data in Brief*, 25, 104304. [Article and data](https://doi.org/10.1016/j.dib.2019.104304). These selected laboratory values are examples, not site alarm limits.
- **Incident context:** US Mine Safety and Health Administration investigation records for the [Aracoma Alma Mine belt fire](https://arlweb.msha.gov/fatals/2006/aracoma/FTL06c1415total.pdf) and [Fairfax Mine slope belt fire](https://arlweb.msha.gov/fatals/2002/fairfax/nftl02fairfax.htm) inform the illustrative mechanical-friction and suppression-loss scenarios. Incident narratives are not training datasets.

### Related work for context (not integrated into CoalGuard)

Coal-fire monitoring research also includes Mamdani fuzzy assessment, multi-point gas monitoring with sequence models, and multi-source feature fusion. These publications provide research context; their datasets and reported performance are not part of CoalGuard's replay or validation. Examples include [fuzzy logic for underground mine-fire assessment](https://pmc.ncbi.nlm.nih.gov/articles/PMC7502667/), [multi-point gas indicators with a GRU warning model](https://www.sciencedirect.com/science/article/pii/S0016236125021775), [multi-source mine-risk feature fusion](https://www.mdpi.com/2071-1050/17/5/2085), and a [BO-CNN-GRU coal self-heating study](https://www.sciencedirect.com/science/article/pii/S0957582026001527). Sensor placement and interference context is discussed in the [NIOSH atmospheric-monitoring overview](https://archive.cdc.gov/www_cdc_gov/niosh/mining/topics/atmosphericmonitoring.html).

Read [Evidence Notes](./docs/EVIDENCE_NOTES.md) for source-by-source use and caveats, and [Published Replay Notes](./docs/REAL_DATA_REPLAY.md) for dataset fields, scoring policy, calculations, and detailed results.

## 7. Limitations & Next Research Steps

Current limitations that shape how results should be interpreted:

- Only three confirmed-fire episodes are available in the published replay. Its episode counts and warning leads are too small to support reliable general performance claims.
- Field replay channels are limited to the measurements present in the source. Conveyor-specific signals such as vibration and motor current are unavailable, so the replay cannot validate those model branches.
- The live five-profile scenes, sensors, and test scenarios are deterministic educational simulations, not calibrated digital twins or site measurements. The thermal model is physics-inspired and simplified, not CFD.
- PSO is an offline, bounded parameter search using six synthetic labelled examples. It is not online self-learning; the replay did not change episode alert counts, and it did not outperform the CO comparator on median lead.
- The profiles do not have separate, sufficiently large labelled field datasets for each operating environment.

Recommended next research steps:

1. Obtain appropriately licensed, well-documented time-series from multiple mines, with independent event labels and normal periods; document missing channels and sampling before model fitting.
2. Define an episode-level evaluation protocol in advance, then use held-out sites or time periods to reduce leakage. Report uncertainty and per-episode outcomes alongside aggregate metrics.
3. Compare Mamdani, PSO-tuned Mamdani, and simple baselines under the same inputs, thresholds, persistence rules, and alarm-time definitions. Investigate why the CO threshold leads earlier on this dataset before making claims about the fuzzy model.
4. Collect domain-specific labelled evidence before evaluating the other four profiles. Test noise, drift, missing sensors, and sensor disagreement separately from physical process changes.
5. Only after data and model validation, consider expert-reviewed coal-specific calibration, hardware-in-the-loop testing, cybersecurity review, and independent functional-safety engineering. This academic project is not an operational safety controller.

For the full engineering roadmap and deployment constraints, see [Limitations & Roadmap](./docs/LIMITATIONS.md).

## 8. Documentation Directory

- [Student Guide (`docs/STUDENT_GUIDE.md`)](./docs/STUDENT_GUIDE.md): In-depth academic guide explaining coal oxidation chemistry, fuzzy logic theory, Mamdani pipeline mathematics, PSO objective functions, and test cases.
- [Evidence Notes (`docs/EVIDENCE_NOTES.md`)](./docs/EVIDENCE_NOTES.md): Citations, DOIs, licensing, and explicit utilization records for all published datasets.
- [Published Replay Notes (`docs/REAL_DATA_REPLAY.md`)](./docs/REAL_DATA_REPLAY.md): Field dataset, model inputs, alert policy, observed results, and limits.
- [Reproducible Demo Walkthrough (`docs/DEMO_SEQUENCE.md`)](./docs/DEMO_SEQUENCE.md): A short route-by-route guide to demonstrating the application and interpreting its outputs.
- [Limitations & Roadmap (`docs/LIMITATIONS.md`)](./docs/LIMITATIONS.md): Transparent engineering constraints and future industrial deployment requirements.
