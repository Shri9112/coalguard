# CoalGuard: Classroom & Presentation Demo Sequence

This script provides a step-by-step presentation flow for course project evaluations. Each demonstration produces **100% deterministic, repeatable results**.

---

## Pre-Demo Preparation (30 seconds)

1. Launch CoalGuard:
   ```bash
   npm run dev -- --port 3002
   ```
2. Open [http://localhost:3002](http://localhost:3002) in fullscreen.
3. Verify the header shows `Paused: Normal (8/100)`.

---

## Demo 1: Mine Conveyor Runaway Self-Heating (Thermal & Gas Agreement)

**Objective:** Show that true coal oxidation produces simultaneous temperature rise, gas evolution, and high rate-of-rise.

1. Navigate to **Simulation** (`/simulation`).
2. Select **Mine Conveyor System**.
3. Select Scenario: **Gradual Exothermic Self-Heating**.
4. Set Weather to **Hot & Dry**.
5. Set Compaction to **85%**, Ventilation to **20%**.
6. Click **Run Simulation**.
7. **Observe:**
   - Over ticks 1 to 25, the glowing hotspot halo expands at *Transfer Point Chute*.
   - Peak temperature rises from 25 °C toward 78 °C.
   - CO rises synchronously from 3 ppm to > 50 ppm.
   - The Trajectory Chart climbs through Watch (blue) into Warning (amber) and Critical (red).
8. Click **Explain Risk** (`/explain-risk`):
   - Show Rule **R01 (Multi-indicator runaway self-heating)** firing with strength $\alpha \approx 0.82$.
   - Show the Centroid defuzzification $z^* \ge 78$.
   - Show Recommended Action: `STOP` (Emergency isolation).

---

## Demo 2: Conveyor Idler Roller Friction (Mechanical Fault Isolation)

**Objective:** Prove that multi-sensor reasoning separates equipment friction from coal self-heating.

1. In **Simulation** (`/simulation`), select **Mine Conveyor**.
2. Select Scenario: **Mechanical Idler / Belt Friction**.
3. Set Weather to **Cool (18 °C)**.
4. Click **Run Simulation**.
5. **Observe:**
   - Bearing vibration surges from 0.25 g to > 3.0 g.
   - Motor current surges to > 95% full load.
   - **Crucial Soft Computing point:** CO gas remains flat (< 10 ppm) because coal is not burning yet.
6. Click **Explain Risk** (`/explain-risk`):
   - Show Rule **R04 (Mechanical friction branch)** fired actively.
   - Show Probable Cause: `Mechanical friction & drive overheating`.
   - Show Recommended Action: `INSPECT` (Dispatch rover to roller gallery bay, not water deluge).

---

## Demo 3: Stockpile Hidden Hotspot (Precipitation Surface Masking)

**Objective:** Demonstrate that surface cooling does not mean the fire hazard is cleared.

1. In **Simulation**, select **Bulk Coal Stockpile Yard**.
2. Select Scenario: **Wet Surface with Subsurface Heat**.
3. Set Weather to **Rainy / Wet (24 °C)**.
4. Set Moisture to **88%**, Compaction to **90%**.
5. Click **Run Simulation**.
6. **Observe:**
   - Surface temperature stays deceptively cool (~28 °C – 32 °C) due to simulated rain.
   - Deep internal probes $T_{23}$ and $T_{24}$ climb to > 65 °C.
   - Apex gas sniffer detects escalating CO (> 35 ppm).
7. In **Explain Risk**:
   - Highlight Rule **R06 (Hidden hotspot under wet surface)** active with $\alpha > 0.40$.
   - The system issues a Warning despite the exterior feeling cool to surface sensors.

---

## Demo 4: Particulate Interference (False-Alarm Challenge)

**Objective:** Demonstrate how Mamdani logic and PSO tuning prevent costly false alarms.

1. Select **Factory CHP Transfer Point**.
2. Select Scenario: **Dust / Steam Sensor Interference**.
3. Weather: **Humid** or **Windy**.
4. Click **Run Simulation**.
5. **Observe:**
   - Dust spikes to > 120 mg/m³.
   - However, CO remains at normal baseline (< 6 ppm) and temperature rate-of-rise is near zero.
6. In **Explain Risk**:
   - Rule **R05 (Interference check)** fires.
   - Confidence drops to ~65%, but the risk score remains safely in Watch/Normal (< 35/100).
   - Point out: Traditional threshold systems would have tripped a false fire alarm!

---

## Demo 5: Road vs. Rail Transit Submodes

**Objective:** Demonstrate vehicle-specific aerodynamics and logistics constraints.

1. Select **Road / Rail Transit Logistics**.
2. Click **Road Tipper Truck**:
   - Note the tipper truck bed schematic with tarp cover.
   - Run simulation: observe heat trapped under tarp during highway dwell time.
3. Click **Unit Train Rail Wagon**:
   - Note the hopper car cross-section and slipstream airflow.
   - Observe how high train airflow accelerates coal surface heat transfer while ventilating gases.

---

## Demo 6: Ship Bulk Cargo Hold (Airtight Oxygen Depletion)

**Objective:** Demonstrate deep cargo hold smolder with oxygen drop.

1. Select **Bulk Carrier Ship Cargo Hold**.
2. Select Scenario: **Sealed Hold Deep Smolder & Oxygen Drop**.
3. Set Ventilation to **5%** (Airtight Oceanic Voyage).
4. Run simulation:
   - Observe oxygen sensor ($O_2$) dropping from 20.9% down toward 14.5%.
   - CO escalates steeply inside the enclosed hold volume.
   - Risk score hits Critical; system recommends hold nitrogen inerting.

---

## Demo 7: Particle Swarm Optimization (PSO) Calibration

**Objective:** Prove that PSO calibration is real, deterministic, and improves performance.

1. Navigate to **Test Cases** (`/test-cases`).
2. Scroll to the **PSO Calibration Workbench**.
3. Point out the initial heuristic parameters (`tempHighA = 48.0`, `coHighA = 18.0`).
4. Click **Calibrate Swarm (Seed: 42)**.
5. **Observe:**
   - Swarm runs 24 particles across 40 iterations.
   - Convergence graph traces loss falling from ~$J = 145$ to $J = 24.3$.
   - Parameter shifts table highlights tuned thresholds.
   - The benchmark table immediately updates, showing the PSO-tuned model achieving higher F1 score and lower false alarm rate!
