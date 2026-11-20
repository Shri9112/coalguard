# CoalGuard: Published Mine-Field Replay

## Purpose

CoalGuard now replays time-aligned measurements from an openly licensed published field dataset through the current Mamdani inference engine. The replay checks how the existing engine responds to actual mine-monitoring measurements. It is a small external evaluation, not validation of conveyor operation or proof of industrial readiness.

## Source and reuse

Cinar, U. (2026). *Gas Indices and Deep Learning for Early Warning of Coal Spontaneous Combustion: A False-Alarm-Controlled Evaluation with Simulation and Field Evidence*. **Sustainability, 18**(18), 9473. [Article DOI: 10.3390/su18189473](https://doi.org/10.3390/su18189473).

The field records are in the article's supplementary workbook hosted with the [Zenodo record](https://doi.org/10.5281/zenodo.22686082), under CC BY 4.0. CoalGuard distributes an adapted JSON copy with attribution in `lib/data/field-episodes.json`; values and independently recorded episode outcomes are preserved for the six consistently measured channels. The source workbook timestamps contain local wall-clock values without timezone metadata, so the replay does not label them UTC.

## Dataset coverage

- 18 anonymized underground-mine monitoring episodes from three mines.
- 3 independently confirmed fires and 15 event-free periods.
- 180 readings per episode, sampled every four hours; 3,240 measurements total.
- Locations include goaf, return-airway, and sealed-area monitoring.
- Consistently populated channels used here: temperature, CO, CO₂, O₂, N₂, and CH₄.
- H₂ and C₂H₄ are omitted from the replay. The paper reports that these channels were instrumented at fire locations but absent in event-free records, so their missingness itself tracks the outcome. Using them would leak the label.

This is underground mine spontaneous-combustion monitoring data. It is not conveyor, CHP, stockpile, road/rail, or ship-cargo telemetry.

## How CoalGuard scores each reading

Each four-hourly sample is sent through CoalGuard's existing `runMamdaniInference` function. The inference receives:

1. measured temperature;
2. temperature rate calculated from the previous timestamped measurement; and
3. measured absolute CO concentration.

Temperature and CO rates are calculated from adjacent samples and expressed per minute, matching the engine's existing units. The current fuzzy rule base does not use CO rate as a rule antecedent, so it is shown as context but not counted as an input group.

Vibration, motor current, dust, sensor health, and spatial agreement are marked unavailable. Rules requiring those measurements are suppressed; placeholder zeros are not treated as observed low values. The output is produced with the project's existing memberships and rules. The PSO version uses the deterministic startup calibration from the six labeled synthetic training examples (20 particles, 30 iterations, seed 42). No field episode was used to tune PSO or select the risk boundary.

## Fixed evaluation policy

- The existing CoalGuard **Watch** boundary is used: risk score ≥ 26.
- An alert must persist for 24 hours. At the source's four-hour sampling cadence, this requires seven consecutive readings spanning six four-hour intervals.
- For a confirmed-fire episode, an early warning must occur on or before the independently documented confirmation time.
- For an event-free episode, any persistent alert is counted as a false alarm.
- The external comparator is the paper-reported 11.14 ppm CO threshold, evaluated with the same 24-hour persistence policy. It is a published reference, not a CoalGuard model.
- The basic FIS, PSO-tuned FIS, and CO comparator use the same episodes and policy. No threshold or membership parameter is fitted to these field records.

## Current observed results

Results from the included workbook and the fixed policy above:

| Method | Fire episodes alerted before confirmation | Event-free episodes with alarm | Median lead before confirmation |
| --- | ---: | ---: | ---: |
| Basic Mamdani | 3/3 | 0/15 | 100 h |
| PSO-tuned Mamdani | 3/3 | 0/15 | 108 h |
| Published CO threshold, 11.14 ppm | 3/3 | 0/15 | 232 h |

The denominators matter. Three detected fires do not establish a reliable 100% detection rate, and zero alarms in fifteen event-free episodes do not establish a near-zero future false-alarm rate. These counts are exploratory observations on one small dataset. The PSO run did not change the observed detection or false-alarm counts; its median lead was eight hours earlier than the basic FIS in this replay. This is not evidence that PSO is generally superior.

The paper reports a 276-hour median lead for its CO baseline under its own protocol. CoalGuard's displayed 232-hour value is a separate recomputation using the explicit 24-hour persistence implementation documented above; it should not be presented as an exact reproduction of the paper's reported figure. Reproducing that result would require matching the authors' full alarm-time convention and evaluation code end to end.

## What this result supports

- CoalGuard's current fuzzy engine can process timestamped field temperature and CO measurements and expose which available rules activate.
- Missing sensor groups can remain explicitly unknown instead of being silently replaced by measured zeros.
- A PSO parameter set learned only from synthetic project scenarios can be replayed unchanged on separate field records.
- The application can compare its fuzzy outputs with a fixed single-sensor threshold using the same event episodes and persistence rule.

## What it does not support

- Accuracy claims for conveyor belts, factories, stockpiles, transport, or cargo holds.
- A claim that the system was field-tested at an industrial conveyor or controlled live equipment.
- Generalizable 100% detection or 0% false-alarm performance; there are only 3 fire and 15 event-free episodes.
- Claims that PSO improves overall performance; on this replay, the episode counts were unchanged.
- Universal thresholds or certified safety recommendations.

CoalGuard remains an academic decision-support prototype. Its live simulation, test cases, PSO training examples, and industrial scenes remain educational and deterministic; the field replay is a distinct evidence layer.

## Reproducible checks

`npm test` includes checks for all 18 episode labels, all 3,240 supported readings, unavailable-channel handling, suppressed rules, the fixed calibration seed, finite risk scores, alert timing against independent confirmation times, and the observed episode-level counts above.
