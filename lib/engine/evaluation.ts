/**
 * CoalGuard - Fair Model Comparison & Synthetic Evaluation Suite
 * Evaluates Fixed-Threshold, Basic Mamdani, and PSO-Tuned Mamdani models
 * on identical scenario traces against explicit synthetic ground-truth labels.
 */

import {
  EnvironmentProfile,
  PsoTunableParameters,
  RiskAssessment,
  RuleTone,
  ScenarioId,
  SensorNode,
  SimulationConfig,
  TransitSubmode,
  VerificationMetrics,
  WeatherCondition,
} from '../types';
import {
  evaluateBasicMamdani,
  evaluateFixedThresholdBaseline,
  evaluatePsoTunedMamdani,
} from './baselines';
import { DEFAULT_PSO_PARAMETERS } from './fuzzy-system';
import { calculateProcessState } from './process-model';
import { updateSensors } from './sensors';
import { AggregatedEvidence, aggregateSensorEvidence } from './trends';

export interface EvaluationTraceFrame {
  tick: number;
  trueHazard: boolean; // Ground-truth label for this tick
  hazardType: 'none' | 'oxidation' | 'friction' | 'blockage' | 'interference';
  evidence: AggregatedEvidence;
  config: SimulationConfig;
  sensors: SensorNode[];
  risk?: RiskAssessment;
}

/**
 * Generates deterministic scenario traces for evaluation.
 */
export function generateScenarioTrace(
  profile: EnvironmentProfile,
  submode: TransitSubmode,
  scenario: ScenarioId,
  weather: WeatherCondition,
  ticks = 40,
  noise = 6,
  dropout = 0
): EvaluationTraceFrame[] {
  const config: SimulationConfig = {
    profile,
    submode,
    scenario,
    weather,
    mode: 'guided',
    speed: 1,
    load: 80,
    moisture: weather === 'rainy' ? 75 : 30,
    compaction: 70,
    ventilation: 40,
    sensorNoise: noise,
    sensorDropout: dropout,
    sprayAvailable: true,
    response: 'monitor',
    responseSince: 0,
  };

  // Blueprint sensors for trace generation
  const blueprints = [
    { id: 's1', name: 'Temp Infeed', type: 'temperature' as const, zone: 'Zone A', x: 25, y: 35 },
    { id: 's2', name: 'Temp Core', type: 'temperature' as const, zone: 'Zone B', x: 50, y: 50 },
    { id: 's3', name: 'CO Core', type: 'co' as const, zone: 'Zone B', x: 52, y: 48 },
    { id: 's4', name: 'Vibration Drive', type: 'vibration' as const, zone: 'Zone C', x: 75, y: 65 },
    { id: 's5', name: 'Current Motor', type: 'current' as const, zone: 'Zone C', x: 78, y: 62 },
    { id: 's6', name: 'Dust Monitor', type: 'dust' as const, zone: 'Zone B', x: 48, y: 55 },
  ];

  const frames: EvaluationTraceFrame[] = [];
  let prevSensors: SensorNode[] | undefined = undefined;

  for (let t = 0; t <= ticks; t++) {
    const processState = calculateProcessState(config, t);
    const sensors = updateSensors(blueprints, processState, config, t, prevSensors);
    const evidence = aggregateSensorEvidence(sensors, prevSensors);
    const risk = evaluateBasicMamdani(evidence, config, sensors);

    // Explicit synthetic ground-truth labelling:
    // A hazardous state occurs when true underlying oxidation or friction enters escalation phase (tick >= 14)
    let trueHazard = false;
    let hazardType: EvaluationTraceFrame['hazardType'] = 'none';

    if (scenario === 'self-heating' || scenario === 'hidden-hotspot' || scenario === 'hold-asphyxiation') {
      hazardType = 'oxidation';
      trueHazard = t >= 14;
    } else if (scenario === 'belt-friction') {
      hazardType = 'friction';
      trueHazard = t >= 12;
    } else if (scenario === 'transfer-blockage') {
      hazardType = 'blockage';
      trueHazard = t >= 13;
    } else if (scenario === 'dust-steam') {
      hazardType = 'interference';
      trueHazard = false; // Dust interference is NEVER a true fire hazard!
    } else if (scenario === 'normal') {
      hazardType = 'none';
      trueHazard = false;
    }

    frames.push({
      tick: t,
      trueHazard,
      hazardType,
      evidence,
      config,
      sensors,
      risk: {
        riskScore: risk.riskScore,
        stage: risk.stage,
        alertMessage: '',
        explanation: '',
        confidence: risk.confidence,
        probableCause: '',
        affectedZone: '',
        recommendedAction: 'monitor',
        actionReason: '',
        fuzzyInputs: [],
        ruleDetails: [],
        activeRules: [],
        defuzzificationTrace: {
          domain: [],
          aggregatedSet: [],
          centroidNumerator: 0,
          centroidDenominator: 0,
          crispCentroid: 0,
          ruleContributions: [],
        },
        confidenceFactors: [],
        contributions: [],
      },
    });

    prevSensors = sensors;
  }

  return frames;
}

export interface ModelEvaluationRun {
  metrics: VerificationMetrics;
  confusionMatrix: { tp: number; fp: number; tn: number; fn: number };
}

/**
 * Evaluates a model on an array of scenario traces and derives all metrics mathematically.
 */
export function evaluateModelOnTraces(
  modelName: 'threshold' | 'basic-mamdani' | 'pso-mamdani',
  traces: EvaluationTraceFrame[][],
  calibratedParams?: PsoTunableParameters
): ModelEvaluationRun {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  const detectionDelays: number[] = [];
  const leadTimes: number[] = [];

  traces.forEach((trace) => {
    let onsetTick = -1;
    let criticalTick = -1;
    let firstAlertTick = -1;

    trace.forEach((frame) => {
      if (frame.trueHazard && onsetTick === -1) {
        onsetTick = frame.tick;
      }
      if (frame.trueHazard && frame.evidence.peakTemperature > 70 && criticalTick === -1) {
        criticalTick = frame.tick;
      }

      // Evaluate model decision
      let isAlert = false;
      if (modelName === 'threshold') {
        const res = evaluateFixedThresholdBaseline(frame.evidence);
        isAlert = res.isAlert;
      } else if (modelName === 'basic-mamdani') {
        const res = evaluateBasicMamdani(frame.evidence, frame.config, frame.sensors);
        isAlert = res.isAlert;
      } else {
        const res = evaluatePsoTunedMamdani(
          frame.evidence,
          frame.config,
          frame.sensors,
          calibratedParams ?? DEFAULT_PSO_PARAMETERS
        );
        isAlert = res.isAlert;
      }

      if (isAlert && firstAlertTick === -1) {
        firstAlertTick = frame.tick;
      }

      // Confusion matrix accumulation
      if (frame.trueHazard && isAlert) {
        tp++;
      } else if (!frame.trueHazard && isAlert) {
        fp++;
      } else if (!frame.trueHazard && !isAlert) {
        tn++;
      } else if (frame.trueHazard && !isAlert) {
        fn++;
      }
    });

    // Compute detection delay (ticks from onset to first alert)
    if (onsetTick !== -1 && firstAlertTick !== -1 && firstAlertTick >= onsetTick) {
      detectionDelays.push(firstAlertTick - onsetTick);
    } else if (onsetTick !== -1 && firstAlertTick === -1) {
      // Missed alert completely -> penalty of full remaining duration
      detectionDelays.push(20);
    }

    // Lead time before critical threshold
    if (firstAlertTick !== -1 && criticalTick !== -1 && criticalTick > firstAlertTick) {
      leadTimes.push(criticalTick - firstAlertTick);
    }
  });

  const totalSamples = tp + fp + tn + fn;
  const precision = tp + fp > 0 ? (tp / (tp + fp)) * 100 : 0;
  const recall = tp + fn > 0 ? (tp / (tp + fn)) * 100 : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const falseAlarmRate = fp + tn > 0 ? (fp / (fp + tn)) * 100 : 0;

  const meanDetectionDelay =
    detectionDelays.length > 0
      ? detectionDelays.reduce((a, b) => a + b, 0) / detectionDelays.length
      : null;

  const meanLeadTime =
    leadTimes.length > 0 ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : null;

  let modelLabel = 'Fixed threshold baseline';
  let shortLabel = 'Threshold';
  let tone: RuleTone = 'amber';

  if (modelName === 'basic-mamdani') {
    modelLabel = 'Basic Mamdani Fuzzy Logic';
    shortLabel = 'Basic Mamdani';
    tone = 'cyan';
  } else if (modelName === 'pso-mamdani') {
    modelLabel = 'PSO-tuned Mamdani Fuzzy Logic';
    shortLabel = 'PSO-tuned FIS';
    tone = 'green';
  }

  return {
    metrics: {
      model: modelLabel,
      shortLabel,
      sampleCount: totalSamples,
      truePositives: tp,
      falsePositives: fp,
      trueNegatives: tn,
      falseNegatives: fn,
      precision: Math.round(precision * 10) / 10,
      recall: Math.round(recall * 10) / 10,
      f1: Math.round(f1 * 10) / 10,
      falseAlarmRate: Math.round(falseAlarmRate * 10) / 10,
      detectionDelay: meanDetectionDelay === null ? null : Math.round(meanDetectionDelay * 10) / 10,
      leadTime: meanLeadTime === null ? null : Math.round(meanLeadTime * 10) / 10,
      robustness: null,
      tone,
    },
    confusionMatrix: { tp, fp, tn, fn },
  };
}

/**
 * Runs the complete model comparison suite over a standard multi-scenario benchmark battery.
 */
export function runComparativeEvaluation(
  calibratedParams?: PsoTunableParameters
): VerificationMetrics[] {
  // The same authored scenario set is replayed under clean and stressed telemetry.
  const benchmarkCases: [EnvironmentProfile, TransitSubmode, ScenarioId, WeatherCondition, number][] = [
    ['mine-conveyor', 'none', 'self-heating', 'hot-dry', 35],
    ['mine-conveyor', 'none', 'belt-friction', 'cool', 35],
    ['mine-conveyor', 'none', 'dust-steam', 'rainy', 30],
    ['factory-chp', 'none', 'transfer-blockage', 'hot-dry', 35],
    ['factory-chp', 'none', 'dust-steam', 'humid', 30],
    ['stockpile', 'none', 'hidden-hotspot', 'rainy', 35],
    ['stockpile', 'none', 'normal', 'cool', 25],
    ['transit', 'truck', 'self-heating', 'hot-dry', 35],
    ['cargo-hold', 'none', 'hold-asphyxiation', 'humid', 35],
  ];
  const buildTraces = (noise: number, dropout: number) =>
    benchmarkCases.map(([profile, submode, scenario, weather, ticks]) =>
      generateScenarioTrace(profile, submode, scenario, weather, ticks, noise, dropout)
    );

  const baselineTraces = buildTraces(6, 0);
  const stressTraces = buildTraces(25, 15);
  const models: ('threshold' | 'basic-mamdani' | 'pso-mamdani')[] = [
    'threshold',
    'basic-mamdani',
    'pso-mamdani',
  ];

  return models.map((model) => {
    const baseline = evaluateModelOnTraces(model, baselineTraces, calibratedParams).metrics;
    const stress = evaluateModelOnTraces(model, stressTraces, calibratedParams).metrics;
    const robustness = baseline.f1 > 0
      ? Math.round((stress.f1 / baseline.f1) * 1000) / 10
      : null;
    return { ...baseline, robustness };
  });
}
