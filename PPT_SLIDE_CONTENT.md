# CoalGuard — 9-Slide Presentation Text

Suggested split for two presenters: **Presenter 1: Slides 1–4. Presenter 2: Slides 5–9.** Keep slide text short; use the visuals and explain the details aloud.

## Slide 1 — CoalGuard

**Explainable Coal-Fire Risk Assessment with Soft Computing**

- Course Project: Soft Computing
- Team: [Member 1] and [Member 2]
- Objective: Combine uncertain sensor evidence and explain the resulting risk assessment

**Visual:** CoalGuard dashboard screenshot or the five-profile icons.

## Slide 2 — Why Early Coal-Fire Assessment Is Difficult

- Coal may heat internally before visible flames appear
- A hotspot can be hidden below a cool stockpile surface
- Conveyor friction and self-heating create different warning patterns
- Dust, steam, airflow, and sensor faults can make readings ambiguous

**Visual:** Simple self-heating versus mechanical-friction comparison.

## Slide 3 — Five Simulated Operating Contexts

- Mine conveyor: belt, idlers, drive pulley, transfer point
- Factory CHP: crusher, transfer chute, screen, bunker
- Stockpile yard: surface and deep-core monitoring
- Road / rail transit: truck tipper and rail wagon
- Ship cargo hold: enclosed cargo and gas monitoring

**Footer:** These are simulated profiles; the field-data replay covers underground mines only.

**Visual:** Five labeled profile cards from CoalGuard.

## Slide 4 — From Conditions to an Explainable Risk Result

- Process model updates heat, gas, airflow, load, and hotspot state
- Virtual sensors produce readings with noise or availability faults
- Trend and sensor-health evidence are aggregated
- Mamdani rules produce a risk index, cause, confidence, and suggested response

**Visual:** `coalguard-processing-flow.png`.

## Slide 5 — Mamdani Fuzzy Logic

- Crisp readings become gradual membership grades: low, medium, or high
- IF–THEN rules combine temperature, trend, CO, mechanical, and reliability evidence
- Rule outputs are aggregated and defuzzified into a 0–100 risk index
- Rule firing strength is not a fire probability

**Example:** High temperature + rising trend + high CO strengthens a thermal-risk rule.

**Visual:** Four-step fuzzification → rules → aggregation → centroid diagram or Explain Risk screenshot.

## Slide 6 — PSO Calibration and Sensor Quality

- PSO searches for settings that reduce error on six labelled synthetic examples
- It tunes 11 selected membership and rule-weight parameters
- Calibration is repeatable: 20 particles, 30 iterations, seed 42
- It is an offline parameter search, not continuous learning from live sensors
- Noise and missing/stale readings reduce evidence quality

**Visual:** `pso-synthetic-targets.png`.

## Slide 7 — Repeatable Scenario Cases

- Ten deterministic cases cover five simulated contexts
- Self-heating: temperature and CO rise together
- Roller friction: vibration and current rise while CO stays low
- Wet stockpile: a cool surface can coexist with a warmer internal hotspot
- Each case has expected behavior and checks to inspect after execution

**Visual:** CoalGuard Test Cases page or a three-panel case comparison.

## Slide 8 — Published Mine-Data Replay

- 18 underground-mine episodes: 3 confirmed fires, 15 event-free
- 3,240 readings sampled every four hours
- Current fuzzy replay uses measured temperature, measured CO, and derived temperature trend
- Basic Mamdani: 3/3, 0/15, 100 h median lead
- PSO-tuned Mamdani: 3/3, 0/15, 108 h; CO comparator: 3/3, 0/15, 232 h

**Caution:** Small sample; exploratory replay, not conveyor validation. The CO comparator had the longest lead in this calculation.

**Visual:** `field-replay-comparison.png` and/or `mine-alpha-fire-signals.png`.

## Slide 9 — What the Project Demonstrates

- Explainable multisensor reasoning with visible fuzzy rules
- PSO parameter calibration and repeatable synthetic scenario evaluation
- A separate replay of published underground-mine data
- Academic decision-support prototype: no physical sensors, equipment control, or safety certification
- Next validation step: larger, site-matched data with independent event labels

**Visual:** Risk explanation screen with the prototype-boundary statement.

## Source notes for slide footers

- Project implementation and scope: CoalGuard README, Student Guide, and Replay Method documentation.
- Mine monitoring and sensor caveats: [NIOSH atmospheric monitoring](https://archive.cdc.gov/www_cdc_gov/niosh/mining/topics/atmosphericmonitoring.html).
- Incident lessons: [MSHA Fairfax report](https://arlweb.msha.gov/fatals/2002/fairfax/NFTL02fairfax.pdf) and [MSHA Aracoma report](https://arlweb.msha.gov/Fatals/2006/Aracoma/FTL06c1415.pdf).
- Field-data source: [Cinar (2026)](https://doi.org/10.3390/su18189473) and its [supplementary data record](https://doi.org/10.5281/zenodo.22686082).
