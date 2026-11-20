/**
 * Published daily gas-index observations from the mine-goaf field table in
 * Guo et al. (2019), Table 7. These are field measurements from one goaf
 * where spontaneous combustion occurred, not conveyor sensor telemetry.
 */

export interface GoafGasIndexObservation {
  day: number;
  coToCo2: number;
  grahamTimesTen: number;
  alkaneRatio: number;
}

export const FIELD_GOAF_CASE = {
  id: 'guo-2019-goaf',
  title: 'Mine-goaf gas-index field record',
  sourceLabel: 'Guo et al. (2019), Table 7',
  sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6698773/',
  doi: '10.1016/j.dib.2019.104304',
  environment: 'Underground mine goaf',
  observationCount: 35,
  context:
    'The paper identifies this monitoring record as coming from a coal-seam goaf where spontaneous combustion occurred.',
  limitation:
    'This table contains derived gas indices by day, but no synchronized temperature, conveyor mechanics, sensor-health data, or non-fire comparison record. CoalGuard therefore displays the measured trends without inventing a conveyor risk score or claiming field accuracy.',
} as const;

/** Selected values transcribed from the source paper's Table 7. */
export const FIELD_GOAF_GAS_INDICES: GoafGasIndexObservation[] = [
  { day: 1, coToCo2: 0.014, grahamTimesTen: 0.467, alkaneRatio: 0.375 },
  { day: 2, coToCo2: 0.015, grahamTimesTen: 0.519, alkaneRatio: 0.415 },
  { day: 3, coToCo2: 0.024, grahamTimesTen: 0.573, alkaneRatio: 0.572 },
  { day: 4, coToCo2: 0.012, grahamTimesTen: 0.521, alkaneRatio: 0.466 },
  { day: 5, coToCo2: 0.016, grahamTimesTen: 0.574, alkaneRatio: 0.634 },
  { day: 6, coToCo2: 0.019, grahamTimesTen: 0.709, alkaneRatio: 0.738 },
  { day: 7, coToCo2: 0.023, grahamTimesTen: 0.939, alkaneRatio: 0.827 },
  { day: 8, coToCo2: 0.020, grahamTimesTen: 0.929, alkaneRatio: 0.814 },
  { day: 9, coToCo2: 0.035, grahamTimesTen: 1.225, alkaneRatio: 0.927 },
  { day: 10, coToCo2: 0.041, grahamTimesTen: 1.389, alkaneRatio: 0.944 },
  { day: 11, coToCo2: 0.053, grahamTimesTen: 1.562, alkaneRatio: 1.265 },
  { day: 12, coToCo2: 0.054, grahamTimesTen: 1.734, alkaneRatio: 1.213 },
  { day: 13, coToCo2: 0.056, grahamTimesTen: 1.738, alkaneRatio: 1.238 },
  { day: 14, coToCo2: 0.042, grahamTimesTen: 1.497, alkaneRatio: 0.854 },
  { day: 15, coToCo2: 0.041, grahamTimesTen: 1.348, alkaneRatio: 0.958 },
  { day: 16, coToCo2: 0.051, grahamTimesTen: 1.636, alkaneRatio: 0.994 },
  { day: 17, coToCo2: 0.039, grahamTimesTen: 1.137, alkaneRatio: 0.958 },
  { day: 18, coToCo2: 0.039, grahamTimesTen: 1.330, alkaneRatio: 1.011 },
  { day: 19, coToCo2: 0.040, grahamTimesTen: 1.216, alkaneRatio: 0.863 },
  { day: 20, coToCo2: 0.042, grahamTimesTen: 1.168, alkaneRatio: 1.173 },
  { day: 21, coToCo2: 0.036, grahamTimesTen: 1.200, alkaneRatio: 0.895 },
  { day: 22, coToCo2: 0.045, grahamTimesTen: 1.394, alkaneRatio: 1.177 },
  { day: 23, coToCo2: 0.048, grahamTimesTen: 1.318, alkaneRatio: 1.115 },
  { day: 24, coToCo2: 0.053, grahamTimesTen: 1.485, alkaneRatio: 1.085 },
  { day: 25, coToCo2: 0.048, grahamTimesTen: 1.507, alkaneRatio: 1.177 },
  { day: 26, coToCo2: 0.051, grahamTimesTen: 1.611, alkaneRatio: 1.422 },
  { day: 27, coToCo2: 0.042, grahamTimesTen: 1.425, alkaneRatio: 1.256 },
  { day: 28, coToCo2: 0.033, grahamTimesTen: 1.153, alkaneRatio: 1.103 },
  { day: 29, coToCo2: 0.034, grahamTimesTen: 1.265, alkaneRatio: 0.972 },
  { day: 30, coToCo2: 0.043, grahamTimesTen: 1.363, alkaneRatio: 1.094 },
  { day: 31, coToCo2: 0.044, grahamTimesTen: 1.399, alkaneRatio: 0.949 },
  { day: 32, coToCo2: 0.047, grahamTimesTen: 1.338, alkaneRatio: 1.307 },
  { day: 33, coToCo2: 0.032, grahamTimesTen: 1.063, alkaneRatio: 0.694 },
  { day: 34, coToCo2: 0.043, grahamTimesTen: 1.201, alkaneRatio: 0.896 },
  { day: 35, coToCo2: 0.026, grahamTimesTen: 1.183, alkaneRatio: 0.706 },
];
