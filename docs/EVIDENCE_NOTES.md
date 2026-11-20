# CoalGuard: Evidence & Data Provenance Notes

---

## 1. Overview & Provenance Taxonomy

To uphold rigorous academic integrity, CoalGuard maintains a strict separation between **simulated values**, **published laboratory data**, **official accident reports**, and **synthetic benchmark results**.

| Evidence Class | Source & Citation | Role in CoalGuard | Boundary & Academic Caveat |
|---|---|---|---|
| **Published Laboratory Data** | Guo, Wen, Liu & Jin (2019), *Data on analysis of temperature inversion during spontaneous combustion of coal*, *Data in Brief*, 25, 104304, DOI: 10.1016/j.dib.2019.104304 | Selected temperature/CO table points are displayed and replayed through the default Mamdani inference on the Evidence page. They are not used to train PSO or generate live simulation telemetry. | **Not field validation.** The plotted observations are laboratory temperature-programmed samples, without timestamps for rate-of-rise or independent labels for accuracy metrics. |
| **Published Mine-Goaf Field Record** | Guo et al. (2019), field-monitoring gas indices, Table 7, DOI: 10.1016/j.dib.2019.104304 | All 35 daily CO/CO₂, 10×Graham, and alkane-ratio observations are shown as an interactive source-trend replay. | **Not conveyor validation.** The record is from a goaf where spontaneous combustion occurred; it lacks synchronized temperature/mechanical conveyor channels and non-fire cases. |
| **Official Incident Records** | MSHA Aracoma Alma Mine #1 (2006) & Fairfax Mine (2002) Formal Investigation Reports | Grounding for the mechanical friction branch (Rule R04) and water spray suppression loss. | Forensic investigation narratives, not structured machine learning training labels. |
| **Field Data Release** | USGS Data Release: Tiptop Mine Fire (2009), DOI: 10.5066/F7PN94XJ | Catalogued as a possible future field comparison source. The measurements are not loaded into the simulator or passed through its inference engine. | Field observations from an abandoned surface mine fire, not continuous conveyor SCADA. |
| **Remote Sensing Feed** | NASA FIRMS (Fire Information for Resource Management System) MODIS/VIIRS Active Fire | Documented in Stockpile profiles as an external regional validation idea. | Satellite revisit times (12–24h) cannot monitor real-time industrial plant processes. |
| **Synthetic Simulation Data** | Deterministic local physics engine (`lib/engine/process-model.ts`) | Generates all live animated telemetry, graphs, and sensor cards. | **Synthetic simulation only.** Never describe as live field measurements. |

---

## 2. Published Coal Oxidation Observations (Guo et al. 2019)

### Citation & Licensing
- **Citation:** Guo, Jun; Wen, Hu; Liu, Yin; Jin, Yongfei (2019). *Data on analysis of temperature inversion during spontaneous combustion of coal*. **Data in Brief**, 25, 104304. DOI: 10.1016/j.dib.2019.104304.
- **DOI:** `10.1016/j.dib.2019.104304`
- **License:** Open Access / Creative Commons Attribution (CC BY 4.0).
- **Access URL:** [https://doi.org/10.1016/j.dib.2019.104304](https://doi.org/10.1016/j.dib.2019.104304)

### Data Use in CoalGuard
Selected temperature/CO values from three coal-rank curves are transcribed for display and replay on the Evidence page. The application passes only these two recorded values into its default Mamdani engine. Timestamp-derived rates, mechanical channels, dust, and sensor-health values are unavailable and are treated as unknown; the replay does not create them.

The replay demonstrates how the current rule base responds to published measurements. It is **not** a classifier validation, a field conveyor replay, PSO training, or evidence that the model correctly detected a fire. The paper also includes a field-monitoring record from a goaf where spontaneous combustion occurred; CoalGuard now displays the 35 daily derived index observations reported in Table 7. Those values are not fed into the conveyor risk engine because the source does not provide synchronized thermal/mechanical measurements or normal comparison cases needed for a fair evaluation.

Selected plotted curves include:
1. **Anthracite:** Low volatility, high ignition threshold, with steep exponential $CO$ acceleration starting above 90 °C.
2. **Long-Flame Coal:** The selected source entries include 38.12 ppm CO at 50 °C, 526 ppm at 90 °C, and 13,950 ppm at 170 °C.
3. **Lignite:** The selected source entries include 34.93 ppm CO at 40 °C and 101.2 ppm at 50 °C.

### Published Field-Case Replay (Table 7)
The Evidence page includes the source's 35 daily observations for CO/CO₂, 10× Graham value, and alkane ratio. The chart normalizes each series to its own maximum only to make line shapes comparable; selected-day cards retain the source values and show change from Day 1. This is retrospective visualization of one reported goaf record, not a calibrated alarm model or predictive test. There are no non-fire/control records, conveyor channels, or independent per-day event labels, so no accuracy, false-alarm, or detection-delay statistics are computed.

### Engineering Warning & Caveats
> **Caveat:** These selected laboratory values are not site alarm limits. CoalGuard's plotted temperatures are not a continuous time series, so no real rate-of-rise can be calculated from them. The risk scores shown in the replay are model outputs, not verified event labels.

---

## 3. Official Accident Investigation Reports

### Aracoma Alma Mine #1 Belt Fire (MSHA, 2006)
- **Source:** US Mine Safety and Health Administration (MSHA), Report of Investigation (FATAL: 2006-01 & 2006-02).
- **URL:** [https://arlweb.msha.gov/fatals/2006/aracoma/FTL06c1415total.pdf](https://arlweb.msha.gov/fatals/2006/aracoma/FTL06c1415total.pdf)
- **Relevance:** The investigation established that a misaligned conveyor belt rubbed against steel framing, generating intense frictional heat that ignited coal spillage along the belt gallery. This directly justifies CoalGuard's mechanical branch (Rule R04) where high motor current and roller vibration elevate risk before combustion gases appear.

### Fairfax Mine Slope Belt Fire (MSHA, 2002)
- **Source:** US Mine Safety and Health Administration (MSHA), Formal Report (NFTL02).
- **URL:** [https://arlweb.msha.gov/fatals/2002/fairfax/nftl02fairfax.htm](https://arlweb.msha.gov/fatals/2002/fairfax/nftl02fairfax.htm)
- **Relevance:** Pulley slippage combined with delayed water spray suppression led to rapid thermal escalation. This report is the basis for Test Case #4 (Factory CHP: Spray Suppression Loss).

---

## 4. Integrity and Representation Rules

1. **No Fake Integration:** Only datasets actually loaded and rendered in `components/evidence/EvidenceView.tsx` are claimed as integrated.
2. **No Misleading Validation:** Side-by-side display of published curves is strictly for comparative educational study; it does not constitute statistical calibration on physical plant assets.
3. **Traceability:** Every data point displayed in the user interface links back to its verified published source and DOI.
