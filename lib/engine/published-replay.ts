/**
 * Applies CoalGuard's default Mamdani engine to the temperature and CO values
 * transcribed from the cited published laboratory tables. The source rows do
 * not provide timestamps or the other CoalGuard channels, so those inputs are
 * explicitly unavailable and their rules are suppressed.
 */

import { PUBLISHED_COAL_CURVES, PublishedCoalCurve } from '../data/evidence';
import { RiskAssessment, SimulationConfig } from '../types';
import {
  DEFAULT_PSO_PARAMETERS,
  InferenceAvailability,
  runMamdaniInference,
} from './fuzzy-system';
import { AggregatedEvidence } from './trends';

export const PUBLISHED_REPLAY_AVAILABILITY: InferenceAvailability = {
  temperature: true,
  temperatureTrend: false,
  co: true,
  coTrend: false,
  // The published rows do not distinguish paired surface and core probes.
  hiddenHotspotContext: false,
  vibration: false,
  current: false,
  dust: false,
  sensorHealth: false,
  crossSensorAgreement: false,
};

const REPLAY_CONFIG: SimulationConfig = {
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

export interface PublishedReplayObservation {
  index: number;
  temperatureC: number;
  coPpm: number;
  risk: RiskAssessment;
}

export interface PublishedCurveReplay {
  curve: PublishedCoalCurve;
  observations: PublishedReplayObservation[];
  availableChannelCount: number;
  totalChannelCount: number;
  validationLabelsAvailable: false;
  timeSeriesAvailable: false;
}

function toPartialEvidence(temperatureC: number, coPpm: number): AggregatedEvidence {
  return {
    peakTemperature: temperatureC,
    averageTemperature: temperatureC,
    temperatureRateOfRise: 0,
    peakCo: coPpm,
    averageCo: coPpm,
    coRateOfRise: 0,
    peakVibration: 0,
    averageMotorCurrent: 0,
    peakDust: 0,
    // Hardware health, spatial agreement and timing are not in the source
    // table. Availability metadata prevents these neutral placeholders from
    // being used as measured low values or positive evidence.
    overallSensorHealth: 100,
    offlineSensorCount: 0,
    staleSensorCount: 0,
    healthySensorCount: 0,
    crossSensorAgreement: 0.7,
    gasTemperatureCorrelation: 0.7,
  };
}

export function runPublishedCurveReplay(curve: PublishedCoalCurve): PublishedCurveReplay {
  const observations = curve.points.map((point, index) => ({
    index,
    temperatureC: point.temperatureC,
    coPpm: point.coPpm,
    risk: runMamdaniInference(
      toPartialEvidence(point.temperatureC, point.coPpm),
      REPLAY_CONFIG,
      [],
      DEFAULT_PSO_PARAMETERS,
      PUBLISHED_REPLAY_AVAILABILITY
    ),
  }));

  return {
    curve,
    observations,
    availableChannelCount: 2,
    totalChannelCount: 8,
    validationLabelsAvailable: false,
    timeSeriesAvailable: false,
  };
}

export function runAllPublishedCurveReplays(): PublishedCurveReplay[] {
  return PUBLISHED_COAL_CURVES.map(runPublishedCurveReplay);
}
