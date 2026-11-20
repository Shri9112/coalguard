import FIELD_EPISODE_DATA from '../data/field-episodes.json';
import { PsoTunableParameters, RiskAssessment, SimulationConfig } from '../types';
import {
  DEFAULT_PSO_PARAMETERS,
  InferenceAvailability,
  runMamdaniInference,
} from './fuzzy-system';
import { executePsoCalibration } from './pso';
import { AggregatedEvidence } from './trends';

export interface FieldEpisodeSample {
  timestamp: string;
  coPpm: number;
  co2Percent: number;
  o2Percent: number;
  n2Percent: number;
  methanePercent: number;
  temperatureC: number;
}

export interface FieldEpisode {
  id: string;
  site: string;
  panelOrSeam: string;
  locationType: string;
  coalRank: string;
  startDate: string;
  endDate: string;
  outcome: 'fire' | 'event-free';
  confirmationAt: string | null;
  confirmationBasis: string | null;
  reportedMaximumTemperatureC: number;
  samples: FieldEpisodeSample[];
}

export const FIELD_EPISODE_SOURCE = FIELD_EPISODE_DATA.source;
export const FIELD_EPISODES = FIELD_EPISODE_DATA.episodes as FieldEpisode[];

export const FIELD_EVALUATION_POLICY = {
  riskThreshold: 26,
  persistenceHours: 24,
  coThresholdPpm: 11.14,
  sampleIntervalHours: FIELD_EPISODE_SOURCE.samplingHours,
  label: '24 h persistence; pre-existing CoalGuard Watch boundary (risk ≥ 26)',
} as const;

/** Same deterministic offline calibration used by the app at startup. */
export const FIELD_PSO_CALIBRATION = executePsoCalibration(20, 30, 42);

const FIELD_CONFIG: SimulationConfig = {
  profile: 'mine-conveyor',
  submode: 'none',
  scenario: 'self-heating',
  weather: 'cool',
  mode: 'explore',
  speed: 1,
  load: 50,
  moisture: 50,
  compaction: 50,
  ventilation: 50,
  sensorNoise: 0,
  sensorDropout: 0,
  sprayAvailable: true,
  response: 'monitor',
  responseSince: 0,
};

/** Only source-backed channels used by the current FIS are marked available. */
export const FIELD_INFERENCE_AVAILABILITY: InferenceAvailability = {
  temperature: true,
  temperatureTrend: true,
  co: true,
  // CO trend is calculated for display, but the current fuzzy rule base has
  // no CO-rate antecedent. It is therefore not counted as a model input.
  coTrend: false,
  // This source has one temperature channel, not paired surface/core probes.
  hiddenHotspotContext: false,
  vibration: false,
  current: false,
  dust: false,
  sensorHealth: false,
  crossSensorAgreement: false,
};

export interface FieldRiskPoint {
  sample: FieldEpisodeSample;
  temperatureRateCPerMinute: number;
  coRatePpmPerMinute: number;
  basic: FieldRiskAssessment;
  pso: FieldRiskAssessment;
}

export interface FieldRiskAssessment {
  riskScore: number;
  stage: RiskAssessment['stage'];
  confidence: number;
  explanation: string;
  activeRules: Array<{ code: string; label: string; firingStrength: number }>;
}

export interface FieldEpisodeResult {
  episode: FieldEpisode;
  points: FieldRiskPoint[];
  evaluation: {
    basicAlarmAt: string | null;
    psoAlarmAt: string | null;
    coBaselineAlarmAt: string | null;
    firstBasicWatchAt: string | null;
    maximumBasicRisk: number;
    maximumPsoRisk: number;
    maximumTemperatureC: number;
    maximumCoPpm: number;
    basicEarlyWarning: boolean;
    psoEarlyWarning: boolean;
    coBaselineEarlyWarning: boolean;
  };
}

export interface FieldMethodMetrics {
  method: 'Basic Mamdani' | 'PSO-tuned Mamdani' | 'Published CO threshold';
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  fireEpisodes: number;
  eventFreeEpisodes: number;
  detectionRate: number;
  falseAlarmRate: number;
  precision: number;
  recall: number;
  f1: number;
  earlyWarnings: number;
  lateAlerts: number;
  medianLeadHours: number | null;
}

export interface FieldBenchmark {
  episodes: FieldEpisodeResult[];
  metrics: [FieldMethodMetrics, FieldMethodMetrics, FieldMethodMetrics];
  policy: typeof FIELD_EVALUATION_POLICY;
  source: typeof FIELD_EPISODE_SOURCE;
  psoCalibration: {
    particles: number;
    iterations: number;
    seed: number;
    bestCost: number;
  };
}

function emptyEvidence(sample: FieldEpisodeSample, previous?: FieldEpisodeSample): AggregatedEvidence {
  const minutes = previous
    ? Math.max(1, (parseSourceTimestamp(sample.timestamp) - parseSourceTimestamp(previous.timestamp)) / 60_000)
    : FIELD_EVALUATION_POLICY.sampleIntervalHours * 60;
  return {
    peakTemperature: sample.temperatureC,
    averageTemperature: sample.temperatureC,
    temperatureRateOfRise: previous ? (sample.temperatureC - previous.temperatureC) / minutes : 0,
    peakCo: sample.coPpm,
    averageCo: sample.coPpm,
    coRateOfRise: previous ? (sample.coPpm - previous.coPpm) / minutes : 0,
    // These placeholders are not treated as measurements: their availability
    // flags below are false, so rules that depend on them cannot fire.
    peakVibration: 0,
    averageMotorCurrent: 0,
    peakDust: 0,
    overallSensorHealth: 0,
    offlineSensorCount: 0,
    staleSensorCount: 0,
    healthySensorCount: 0,
    crossSensorAgreement: 0,
    gasTemperatureCorrelation: 0,
  };
}

function parseSourceTimestamp(timestamp: string): number {
  // The source gives local wall-clock times without timezone metadata. Map its
  // calendar fields to a UTC number for subtraction only; do not shift the
  // displayed time or imply that the observations were recorded in UTC.
  const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return Number.NaN;
  const [, year, month, day, hour, minute, second = '0'] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
}

function toFieldRiskAssessment(risk: RiskAssessment): FieldRiskAssessment {
  return {
    riskScore: risk.riskScore,
    stage: risk.stage,
    confidence: risk.confidence,
    explanation: risk.explanation,
    activeRules: risk.activeRules.map((rule) => ({
      code: rule.code,
      label: rule.label,
      firingStrength: rule.firingStrength,
    })),
  };
}

function assessSample(
  sample: FieldEpisodeSample,
  previous: FieldEpisodeSample | undefined,
  calibratedParams: PsoTunableParameters
): FieldRiskPoint {
  const evidence = emptyEvidence(sample, previous);
  const basic = runMamdaniInference(
    evidence,
    FIELD_CONFIG,
    [],
    DEFAULT_PSO_PARAMETERS,
    FIELD_INFERENCE_AVAILABILITY
  );
  const pso = runMamdaniInference(
    evidence,
    FIELD_CONFIG,
    [],
    calibratedParams,
    FIELD_INFERENCE_AVAILABILITY
  );
  return {
    sample,
    temperatureRateCPerMinute: evidence.temperatureRateOfRise,
    coRatePpmPerMinute: evidence.coRateOfRise,
    basic: toFieldRiskAssessment(basic),
    pso: toFieldRiskAssessment(pso),
  };
}

function firstPersistentAlarmAt(
  samples: FieldRiskPoint[],
  isAboveThreshold: (sample: FieldRiskPoint) => boolean
): string | null {
  const intervals = Math.max(
    1,
    Math.round(FIELD_EVALUATION_POLICY.persistenceHours / FIELD_EVALUATION_POLICY.sampleIntervalHours)
  );
  // N samples span N-1 intervals. Require one extra sample to establish the
  // full persistence duration instead of announcing an alarm prematurely.
  const requiredSamples = intervals + 1;
  let runStart = -1;
  for (let index = 0; index < samples.length; index++) {
    if (isAboveThreshold(samples[index])) {
      if (runStart < 0) runStart = index;
      if (index - runStart + 1 >= requiredSamples) return samples[index].sample.timestamp;
    } else {
      runStart = -1;
    }
  }
  return null;
}

function scoreEpisode(episode: FieldEpisode, calibratedParams: PsoTunableParameters): FieldEpisodeResult {
  const points = episode.samples.map((sample, index) =>
    assessSample(sample, index > 0 ? episode.samples[index - 1] : undefined, calibratedParams)
  );
  const basicAlarmAt = firstPersistentAlarmAt(points, (point) => point.basic.riskScore >= FIELD_EVALUATION_POLICY.riskThreshold);
  const psoAlarmAt = firstPersistentAlarmAt(points, (point) => point.pso.riskScore >= FIELD_EVALUATION_POLICY.riskThreshold);
  const coBaselineAlarmAt = firstPersistentAlarmAt(points, (point) => point.sample.coPpm >= FIELD_EVALUATION_POLICY.coThresholdPpm);
  const confirmationTime = episode.confirmationAt ? parseSourceTimestamp(episode.confirmationAt) : null;
  const isEarly = (alarmAt: string | null) =>
    alarmAt !== null && confirmationTime !== null && parseSourceTimestamp(alarmAt) <= confirmationTime;

  return {
    episode,
    points,
    evaluation: {
      basicAlarmAt,
      psoAlarmAt,
      coBaselineAlarmAt,
      firstBasicWatchAt: points.find((point) => point.basic.riskScore >= FIELD_EVALUATION_POLICY.riskThreshold)?.sample.timestamp ?? null,
      maximumBasicRisk: Math.max(...points.map((point) => point.basic.riskScore)),
      maximumPsoRisk: Math.max(...points.map((point) => point.pso.riskScore)),
      maximumTemperatureC: Math.max(...episode.samples.map((sample) => sample.temperatureC)),
      maximumCoPpm: Math.max(...episode.samples.map((sample) => sample.coPpm)),
      basicEarlyWarning: isEarly(basicAlarmAt),
      psoEarlyWarning: isEarly(psoAlarmAt),
      coBaselineEarlyWarning: isEarly(coBaselineAlarmAt),
    },
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function summarizeMethod(
  episodes: FieldEpisodeResult[],
  method: FieldMethodMetrics['method'],
  alarmKey: 'basicAlarmAt' | 'psoAlarmAt' | 'coBaselineAlarmAt',
  earlyKey: 'basicEarlyWarning' | 'psoEarlyWarning' | 'coBaselineEarlyWarning'
): FieldMethodMetrics {
  const fires = episodes.filter((result) => result.episode.outcome === 'fire');
  const eventFree = episodes.filter((result) => result.episode.outcome === 'event-free');
  const alertedFire = fires.filter((result) => result.evaluation[alarmKey] !== null);
  const falsePositives = eventFree.filter((result) => result.evaluation[alarmKey] !== null).length;
  const earlyWarnings = fires.filter((result) => result.evaluation[earlyKey]);
  const leadHours = earlyWarnings.map((result) => {
    const alarm = result.evaluation[alarmKey];
    return alarm && result.episode.confirmationAt
      ? (parseSourceTimestamp(result.episode.confirmationAt) - parseSourceTimestamp(alarm)) / 3_600_000
      : 0;
  });
  const truePositives = alertedFire.length;
  const falseNegatives = fires.length - truePositives;
  const precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
  const recall = fires.length > 0 ? truePositives / fires.length : 0;
  const lateAlerts = fires.filter((result) => {
    const alarm = result.evaluation[alarmKey];
    return alarm && result.episode.confirmationAt && parseSourceTimestamp(alarm) > parseSourceTimestamp(result.episode.confirmationAt);
  }).length;
  return {
    method,
    truePositives,
    falsePositives,
    falseNegatives,
    fireEpisodes: fires.length,
    eventFreeEpisodes: eventFree.length,
    detectionRate: recall,
    falseAlarmRate: eventFree.length ? falsePositives / eventFree.length : 0,
    precision,
    recall,
    f1: precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0,
    earlyWarnings: earlyWarnings.length,
    lateAlerts,
    medianLeadHours: median(leadHours),
  };
}

export function buildFieldBenchmark(): FieldBenchmark {
  const episodes = FIELD_EPISODES.map((episode) => scoreEpisode(episode, FIELD_PSO_CALIBRATION.optimizedParameters));
  return {
    episodes,
    metrics: [
      summarizeMethod(episodes, 'Basic Mamdani', 'basicAlarmAt', 'basicEarlyWarning'),
      summarizeMethod(episodes, 'PSO-tuned Mamdani', 'psoAlarmAt', 'psoEarlyWarning'),
      summarizeMethod(episodes, 'Published CO threshold', 'coBaselineAlarmAt', 'coBaselineEarlyWarning'),
    ],
    policy: FIELD_EVALUATION_POLICY,
    source: FIELD_EPISODE_SOURCE,
    psoCalibration: {
      particles: FIELD_PSO_CALIBRATION.particles,
      iterations: FIELD_PSO_CALIBRATION.iterations,
      seed: FIELD_PSO_CALIBRATION.seed,
      bestCost: FIELD_PSO_CALIBRATION.bestCost,
    },
  };
}
