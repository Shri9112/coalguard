/**
 * CoalGuard - Authoritative Evidence & Data Provenance Catalog
 * Traceable academic datasets, published laboratory oxidation curves,
 * official mining investigation reports, and remote sensing specifications.
 */

export type EvidenceKind =
  | 'published-lab-reference'
  | 'field-data'
  | 'incident-record'
  | 'remote-sensing';

export interface EvidencePoint {
  temperatureC: number;
  coPpm: number;
}

export interface PublishedCoalCurve {
  id: string;
  label: string;
  coalRank: string;
  method: string;
  points: EvidencePoint[];
  sourceLabel: string;
  sourceUrl: string;
  doi: string;
  license: string;
  caveat: string;
}

export interface EvidenceRecord {
  id: string;
  title: string;
  kind: EvidenceKind;
  environment: string;
  sourceLabel: string;
  sourceUrl: string;
  doi?: string;
  signal: string;
  useInCoalGuard: string;
  status: 'official' | 'open-data' | 'reported';
  limitations: string;
}

/**
 * Selected values transcribed from published laboratory coal-oxidation tables
 * by Guo et al. (2019), Data in Brief. The values are shown and replayed
 * through the default Mamdani engine on the Evidence page; they do not feed the
 * live physical simulation and are not used to calibrate PSO or thresholds.
 * Laboratory heating is not a field conveyor or stockpile alarm dataset.
 */
export const PUBLISHED_COAL_CURVES: PublishedCoalCurve[] = [
  {
    id: 'anthracite',
    label: 'Anthracite Laboratory Oxidation Curve',
    coalRank: 'Anthracite (Low Volatility)',
    method: 'Temperature-programmed heating; continuous gas chromatography sampling',
    points: [
      { temperatureC: 30, coPpm: 6.64 },
      { temperatureC: 50, coPpm: 8.89 },
      { temperatureC: 70, coPpm: 50.8 },
      { temperatureC: 90, coPpm: 159.9 },
      { temperatureC: 110, coPpm: 310.0 },
      { temperatureC: 130, coPpm: 628.1 },
      { temperatureC: 150, coPpm: 1783.0 },
      { temperatureC: 170, coPpm: 3732.0 },
    ],
    sourceLabel: 'Guo et al. (2019), Data in Brief',
    sourceUrl: 'https://doi.org/10.1016/j.dib.2019.104304',
    doi: '10.1016/j.dib.2019.104304',
    license: 'Open Access / CC BY 4.0',
    caveat: 'Laboratory reference curve. Anthracite has high ignition temperature but exhibits steep CO acceleration above 90 °C.',
  },
  {
    id: 'long-flame',
    label: 'Long-Flame Bituminous Coal Curve',
    coalRank: 'Long-Flame Sub-Bituminous / Bituminous',
    method: 'Temperature-programmed heating; continuous gas chromatography sampling',
    points: [
      { temperatureC: 30, coPpm: 6.5 },
      { temperatureC: 50, coPpm: 38.12 },
      { temperatureC: 70, coPpm: 156.2 },
      { temperatureC: 90, coPpm: 526.0 },
      { temperatureC: 110, coPpm: 1174.0 },
      { temperatureC: 130, coPpm: 2106.0 },
      { temperatureC: 150, coPpm: 9226.0 },
      { temperatureC: 170, coPpm: 13950.0 },
    ],
    sourceLabel: 'Guo et al. (2019), Data in Brief',
    sourceUrl: 'https://doi.org/10.1016/j.dib.2019.104304',
    doi: '10.1016/j.dib.2019.104304',
    license: 'Open Access / CC BY 4.0',
    caveat: 'The selected source values show CO increasing with programmed sample temperature. They are replayed for illustration, not used to set site thresholds.',
  },
  {
    id: 'lignite',
    label: 'Lignite Early Self-Heating Curve',
    coalRank: 'Lignite (High Moisture / Reactive)',
    method: 'Early-stage low temperature programmed heating',
    points: [
      { temperatureC: 30, coPpm: 14.83 },
      { temperatureC: 40, coPpm: 34.93 },
      { temperatureC: 50, coPpm: 101.2 },
      { temperatureC: 60, coPpm: 257.1 },
      { temperatureC: 70, coPpm: 454.4 },
    ],
    sourceLabel: 'Guo et al. (2019), Data in Brief',
    sourceUrl: 'https://doi.org/10.1016/j.dib.2019.104304',
    doi: '10.1016/j.dib.2019.104304',
    license: 'Open Access / CC BY 4.0',
    caveat: 'The selected source values show an early CO increase during programmed heating. This laboratory curve does not establish a field alarm threshold.',
  },
];

/**
 * Historical accident investigations and field data catalog.
 */
export const EVIDENCE_CATALOG: EvidenceRecord[] = [
  {
    id: 'guo-2019',
    title: 'Coal Self-Heating Gas Evolution and Shaanxi Goaf Oxidation Tables',
    kind: 'published-lab-reference',
    environment: 'Underground coal goaf & laboratory reactor',
    sourceLabel: 'Guo et al. (2019), Data in Brief',
    sourceUrl: 'https://doi.org/10.1016/j.dib.2019.104304',
    doi: '10.1016/j.dib.2019.104304',
    signal: 'Temperature, CO, CO₂, O₂, and C₂H₄ gas acceleration',
    useInCoalGuard: 'Selected laboratory temperature/CO points are replayed through the default Mamdani engine. The 35-day goaf gas-index record is shown as a separate field-case trend; it is not scored by the conveyor FIS, used for PSO calibration, or fed into live simulation.',
    status: 'open-data',
    limitations: 'The laboratory curves are not conveyor telemetry. The field goaf record has derived daily gas indices but no synchronized conveyor temperature/mechanical channels or non-fire comparison cases; it cannot support model accuracy metrics.',
  },
  {
    id: 'cinar-2026-field-episodes',
    title: 'Anonymized underground mine fire and event-free monitoring episodes',
    kind: 'field-data',
    environment: 'Underground goaf, return airway, and sealed-area monitoring',
    sourceLabel: 'Cinar (2026), Sustainability · Zenodo supplementary workbook',
    sourceUrl: 'https://doi.org/10.5281/zenodo.22686082',
    doi: '10.3390/su18189473',
    signal: '3,240 four-hourly readings from 18 episodes: temperature, CO, CO₂, O₂, N₂, and CH₄; 3 confirmed fires and 15 event-free periods',
    useInCoalGuard: 'All 18 episodes are replayed through the basic and PSO-tuned Mamdani engine using only measured temperature, derived temperature trend, and measured CO. A fixed CO threshold is included as a reference comparator.',
    status: 'open-data',
    limitations: 'Underground spontaneous-combustion records, not conveyor telemetry. Only three fire episodes; mechanical, dust, sensor-health, and spatial channels are absent. H₂ and C₂H₄ are excluded because their missingness is outcome-confounded. This exploratory replay is not broad field validation.',
  },
  {
    id: 'msha-aracoma-2006',
    title: 'Aracoma Alma Mine #1 Belt Fire Investigation Report',
    kind: 'incident-record',
    environment: 'Underground conveyor belt drive and roller structure',
    sourceLabel: 'US Mine Safety and Health Administration (MSHA)',
    sourceUrl: 'https://arlweb.msha.gov/fatals/2006/aracoma/FTL06c1415total.pdf',
    signal: 'Belt misalignment, idler bearing friction, and combustible spillage accumulation',
    useInCoalGuard: 'Justification for the mechanical-fault rule branch (R04) and belt speed/friction modeling.',
    status: 'official',
    limitations: 'Post-incident forensic report; continuous sensor telemetry was not fully archived.',
  },
  {
    id: 'msha-fairfax-2002',
    title: 'Fairfax Mine Underground Conveyor Fire Formal Report',
    kind: 'incident-record',
    environment: 'Slope conveyor belt system and transfer point',
    sourceLabel: 'US Mine Safety and Health Administration (MSHA)',
    sourceUrl: 'https://arlweb.msha.gov/fatals/2002/fairfax/nftl02fairfax.htm',
    signal: 'Belt slippage on drive pulley, delayed sensor warning, and water spray failure',
    useInCoalGuard: 'Informs Factory/Conveyor cooling failure test case and sensor health degradation logic.',
    status: 'official',
    limitations: 'Qualitative operational log rather than a structured machine learning dataset.',
  },
  {
    id: 'usgs-tiptop-2009',
    title: 'Tiptop Abandoned Coal Mine Fire Ground Temperature and Gas Flux Dataset',
    kind: 'field-data',
    environment: 'Kentucky surface fissure and subsurface coal seam fire',
    sourceLabel: 'US Geological Survey (USGS) Data Release',
    sourceUrl: 'https://www.usgs.gov/data/site-identification-location-temperature-and-co2-flux-diffuse-emission-measurement-tiptop-coal',
    doi: '10.5066/F7PN94XJ',
    signal: 'Surface infrared temperatures, CO₂/CO diffuse emissions, and borehole depths',
    useInCoalGuard: 'Catalogued as a possible future field comparison source; it is not loaded into CoalGuard or used to validate its predictions.',
    status: 'open-data',
    limitations: 'Wildfire/seam fire environment differing from industrial bulk handling conveyors.',
  },
  {
    id: 'nasa-firms',
    title: 'NASA FIRMS Satellite Thermal Anomaly & Active Fire Data (MODIS/VIIRS)',
    kind: 'remote-sensing',
    environment: 'Open-cast surface mines and regional bulk stockpiles',
    sourceLabel: 'NASA Earthdata / FIRMS',
    sourceUrl: 'https://firms.modaps.eosdis.nasa.gov/',
    signal: '375m/1km brightness temperature, fire radiative power (FRP), and confidence flags',
    useInCoalGuard: 'Documented as future macro-scale context layer for large open stockpile yards.',
    status: 'official',
    limitations: 'Satellite pass intervals (12-24h) and cloud obscuration prevent real-time conveyor monitoring.',
  },
];
