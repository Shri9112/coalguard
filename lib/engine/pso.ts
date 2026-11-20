/**
 * CoalGuard - Genuine Particle Swarm Optimization (PSO)
 * Offline calibration of fuzzy membership breakpoints and rule weights
 * using a documented objective function on synthetic training scenarios.
 */

import {
  PsoCalibrationResult,
  PsoConvergencePoint,
  PsoTunableParameters,
  SensorNode,
  SimulationConfig,
} from '../types';
import { DEFAULT_PSO_PARAMETERS, runMamdaniInference } from './fuzzy-system';
import { mulberry32 } from './sensors';
import { AggregatedEvidence } from './trends';

export interface TrainingSample {
  id: string;
  label: string;
  evidence: AggregatedEvidence;
  config: Partial<SimulationConfig>;
  targetRisk: number; // Ground-truth target risk score
  isInterferenceChallenge?: boolean;
}

/**
 * Deterministic labelled synthetic training set for PSO calibration.
 * Covers normal baseline, early self-heating, runaway oxidation,
 * mechanical friction, and false-alarm dust/steam interference.
 */
export const PSO_TRAINING_SET: TrainingSample[] = [
  // 1. Stable baseline
  {
    id: 'train-normal-1',
    label: 'Mine conveyor stable equilibrium',
    evidence: {
      peakTemperature: 25.5,
      averageTemperature: 24.2,
      temperatureRateOfRise: 0.05,
      peakCo: 3.2,
      averageCo: 2.8,
      coRateOfRise: 0.02,
      peakVibration: 0.28,
      averageMotorCurrent: 62.0,
      peakDust: 18.0,
      overallSensorHealth: 98,
      offlineSensorCount: 0,
      staleSensorCount: 0,
      healthySensorCount: 8,
      crossSensorAgreement: 0.95,
      gasTemperatureCorrelation: 0.9,
    },
    config: { profile: 'mine-conveyor', scenario: 'normal', weather: 'cool', sensorNoise: 5, sensorDropout: 0 },
    targetRisk: 8,
  },
  // 2. Early self-heating onset
  {
    id: 'train-onset-1',
    label: 'Stockpile early self-heating',
    evidence: {
      peakTemperature: 46.0,
      averageTemperature: 41.5,
      temperatureRateOfRise: 1.45,
      peakCo: 22.0,
      averageCo: 16.5,
      coRateOfRise: 1.1,
      peakVibration: 0.32,
      averageMotorCurrent: 55.0,
      peakDust: 24.0,
      overallSensorHealth: 94,
      offlineSensorCount: 0,
      staleSensorCount: 0,
      healthySensorCount: 7,
      crossSensorAgreement: 0.88,
      gasTemperatureCorrelation: 0.85,
    },
    config: { profile: 'stockpile', scenario: 'self-heating', weather: 'hot-dry', sensorNoise: 6, sensorDropout: 0 },
    targetRisk: 48,
  },
  // 3. Escalated severe runaway self-heating
  {
    id: 'train-critical-1',
    label: 'Conveyor transfer runaway fire hazard',
    evidence: {
      peakTemperature: 78.5,
      averageTemperature: 69.0,
      temperatureRateOfRise: 3.8,
      peakCo: 68.0,
      averageCo: 52.0,
      coRateOfRise: 4.2,
      peakVibration: 0.45,
      averageMotorCurrent: 78.0,
      peakDust: 42.0,
      overallSensorHealth: 92,
      offlineSensorCount: 0,
      staleSensorCount: 0,
      healthySensorCount: 8,
      crossSensorAgreement: 0.86,
      gasTemperatureCorrelation: 0.92,
    },
    config: { profile: 'mine-conveyor', scenario: 'self-heating', weather: 'hot-dry', sensorNoise: 8, sensorDropout: 0 },
    targetRisk: 88,
  },
  // 4. Mechanical friction without oxidation
  {
    id: 'train-mechanical-1',
    label: 'Conveyor roller seized bearing friction',
    evidence: {
      peakTemperature: 58.0,
      averageTemperature: 42.0,
      temperatureRateOfRise: 1.2,
      peakCo: 5.5,
      averageCo: 4.0,
      coRateOfRise: 0.1,
      peakVibration: 2.85,
      averageMotorCurrent: 98.0,
      peakDust: 28.0,
      overallSensorHealth: 90,
      offlineSensorCount: 0,
      staleSensorCount: 0,
      healthySensorCount: 8,
      crossSensorAgreement: 0.75,
      gasTemperatureCorrelation: 0.25,
    },
    config: { profile: 'mine-conveyor', scenario: 'belt-friction', weather: 'cool', sensorNoise: 7, sensorDropout: 0 },
    targetRisk: 52,
  },
  // 5. Dust / steam false-alarm interference challenge
  {
    id: 'train-interference-1',
    label: 'CHP Transfer chute dust suppression surge',
    evidence: {
      peakTemperature: 32.0,
      averageTemperature: 28.0,
      temperatureRateOfRise: 0.15,
      peakCo: 6.0,
      averageCo: 4.5,
      coRateOfRise: 0.05,
      peakVibration: 0.35,
      averageMotorCurrent: 64.0,
      peakDust: 125.0,
      overallSensorHealth: 88,
      offlineSensorCount: 0,
      staleSensorCount: 0,
      healthySensorCount: 9,
      crossSensorAgreement: 0.65,
      gasTemperatureCorrelation: 0.2,
    },
    config: { profile: 'factory-chp', scenario: 'dust-steam', weather: 'rainy', sensorNoise: 12, sensorDropout: 0 },
    targetRisk: 22,
    isInterferenceChallenge: true,
  },
  // 6. Hold smoldering deep heating
  {
    id: 'train-cargo-hold-1',
    label: 'Ship hold deep cargo smolder',
    evidence: {
      peakTemperature: 64.0,
      averageTemperature: 54.0,
      temperatureRateOfRise: 2.4,
      peakCo: 82.0,
      averageCo: 65.0,
      coRateOfRise: 3.1,
      peakVibration: 0.18,
      averageMotorCurrent: 25.0,
      peakDust: 15.0,
      overallSensorHealth: 90,
      offlineSensorCount: 0,
      staleSensorCount: 0,
      healthySensorCount: 8,
      crossSensorAgreement: 0.82,
      gasTemperatureCorrelation: 0.95,
    },
    config: { profile: 'cargo-hold', scenario: 'hold-asphyxiation', weather: 'humid', sensorNoise: 6, sensorDropout: 0 },
    targetRisk: 82,
  },
];

interface ParameterBounds {
  min: number;
  max: number;
}

const BOUNDS: Record<keyof PsoTunableParameters, ParameterBounds> = {
  tempHighA: { min: 42.0, max: 56.0 },
  tempHighB: { min: 62.0, max: 78.0 },
  trendHighA: { min: 0.9, max: 1.8 },
  trendHighB: { min: 2.8, max: 4.5 },
  coHighA: { min: 14.0, max: 24.0 },
  coHighB: { min: 38.0, max: 62.0 },
  mechHighA: { min: 0.9, max: 1.8 },
  mechHighB: { min: 2.5, max: 4.2 },
  ruleWeightThermal: { min: 0.85, max: 1.15 },
  ruleWeightMechanical: { min: 0.80, max: 1.10 },
  ruleWeightInterference: { min: 0.75, max: 1.25 },
};

const PARAM_KEYS = Object.keys(BOUNDS) as (keyof PsoTunableParameters)[];

/**
 * Objective function J(theta):
 * Evaluates Mean Squared Error on labelled scenario targets + heavy penalty for false alarms on interference cases.
 */
export function evaluateObjective(params: PsoTunableParameters): number {
  let totalError = 0;
  const dummySensors: SensorNode[] = [];

  for (const sample of PSO_TRAINING_SET) {
    const assessment = runMamdaniInference(
      sample.evidence,
      sample.config as SimulationConfig,
      dummySensors,
      params
    );
    const predictedRisk = assessment.riskScore;
    const diff = predictedRisk - sample.targetRisk;
    let sampleCost = diff * diff;

    // Heavy penalty if interference triggers a false warning (risk >= 40)
    if (sample.isInterferenceChallenge && predictedRisk >= 40) {
      sampleCost += Math.pow(predictedRisk - 35, 2) * 4.5;
    }

    totalError += sampleCost;
  }

  // Regularization penalty if breakpoints overlap or invert
  if (params.tempHighA >= params.tempHighB - 5) totalError += 2000;
  if (params.trendHighA >= params.trendHighB - 0.5) totalError += 2000;
  if (params.coHighA >= params.coHighB - 5) totalError += 2000;
  if (params.mechHighA >= params.mechHighB - 0.5) totalError += 2000;

  return totalError / PSO_TRAINING_SET.length;
}

/**
 * Run Particle Swarm Optimization calibration.
 * Deterministic with given seed.
 */
export function executePsoCalibration(
  swarmSize = 24,
  maxIterations = 45,
  seed = 42
): PsoCalibrationResult {
  const prng = mulberry32(seed);

  // Initialize particles
  const numDimensions = PARAM_KEYS.length;
  const positions: number[][] = [];
  const velocities: number[][] = [];
  const pBestPositions: number[][] = [];
  const pBestCosts: number[] = [];

  let gBestPosition: number[] = [];
  let gBestCost = Number.POSITIVE_INFINITY;

  // Convert PsoTunableParameters to array and vice versa
  const toParams = (vec: number[]): PsoTunableParameters => {
    return {
      tempHighA: vec[0],
      tempHighB: vec[1],
      trendHighA: vec[2],
      trendHighB: vec[3],
      coHighA: vec[4],
      coHighB: vec[5],
      mechHighA: vec[6],
      mechHighB: vec[7],
      ruleWeightThermal: vec[8],
      ruleWeightMechanical: vec[9],
      ruleWeightInterference: vec[10],
    };
  };

  const toVec = (p: PsoTunableParameters): number[] => {
    return PARAM_KEYS.map((k) => p[k]);
  };

  // Seed particle 0 with DEFAULT_PSO_PARAMETERS
  positions.push(toVec(DEFAULT_PSO_PARAMETERS));
  velocities.push(new Array(numDimensions).fill(0));

  for (let i = 1; i < swarmSize; i++) {
    const pos = PARAM_KEYS.map((key) => {
      const b = BOUNDS[key];
      return b.min + prng() * (b.max - b.min);
    });
    const vel = PARAM_KEYS.map((key) => {
      const b = BOUNDS[key];
      const range = b.max - b.min;
      return (prng() - 0.5) * range * 0.15;
    });
    positions.push(pos);
    velocities.push(vel);
  }

  // Evaluate initial fitness
  for (let i = 0; i < swarmSize; i++) {
    const cost = evaluateObjective(toParams(positions[i]));
    pBestPositions.push([...positions[i]]);
    pBestCosts.push(cost);

    if (cost < gBestCost) {
      gBestCost = cost;
      gBestPosition = [...positions[i]];
    }
  }

  const convergenceTrace: PsoConvergencePoint[] = [];
  convergenceTrace.push({
    iteration: 0,
    bestCost: Math.round(gBestCost * 10) / 10,
    averageCost: Math.round((pBestCosts.reduce((a, b) => a + b, 0) / swarmSize) * 10) / 10,
  });

  // Hyperparameters
  const wStart = 0.85;
  const wEnd = 0.40;
  const c1 = 1.6; // Cognitive acceleration
  const c2 = 1.9; // Social acceleration

  // Swarm iterations
  for (let iter = 1; iter <= maxIterations; iter++) {
    // Linear inertia decay
    const w = wStart - ((wStart - wEnd) * iter) / maxIterations;
    let iterationCostSum = 0;

    for (let i = 0; i < swarmSize; i++) {
      for (let d = 0; d < numDimensions; d++) {
        const r1 = prng();
        const r2 = prng();
        const cognitive = c1 * r1 * (pBestPositions[i][d] - positions[i][d]);
        const social = c2 * r2 * (gBestPosition[d] - positions[i][d]);

        velocities[i][d] = w * velocities[i][d] + cognitive + social;

        // Velocity clamping
        const key = PARAM_KEYS[d];
        const range = BOUNDS[key].max - BOUNDS[key].min;
        const vMax = range * 0.25;
        velocities[i][d] = Math.max(-vMax, Math.min(vMax, velocities[i][d]));

        // Position update and clamping
        positions[i][d] += velocities[i][d];
        positions[i][d] = Math.max(BOUNDS[key].min, Math.min(BOUNDS[key].max, positions[i][d]));
      }

      // Evaluate new position
      const cost = evaluateObjective(toParams(positions[i]));
      iterationCostSum += cost;

      if (cost < pBestCosts[i]) {
        pBestCosts[i] = cost;
        pBestPositions[i] = [...positions[i]];

        if (cost < gBestCost) {
          gBestCost = cost;
          gBestPosition = [...positions[i]];
        }
      }
    }

    if (iter % 3 === 0 || iter === maxIterations) {
      convergenceTrace.push({
        iteration: iter,
        bestCost: Math.round(gBestCost * 10) / 10,
        averageCost: Math.round((iterationCostSum / swarmSize) * 10) / 10,
      });
    }
  }

  const optimized = toParams(gBestPosition);
  const parameterChanges = PARAM_KEYS.map((k) => {
    const before = DEFAULT_PSO_PARAMETERS[k];
    const after = Math.round(optimized[k] * 100) / 100;
    const changePercent = Math.round(((after - before) / before) * 1000) / 10;
    return {
      name: k,
      before,
      after,
      changePercent,
    };
  });

  return {
    status: 'calibrated',
    particles: swarmSize,
    iterations: maxIterations,
    bestCost: Math.round(gBestCost * 100) / 100,
    convergenceTrace,
    initialParameters: DEFAULT_PSO_PARAMETERS,
    optimizedParameters: optimized,
    parameterChanges,
    objectiveDescription:
      'Mean Squared Error minimization against labelled synthetic ground-truth with quadratic penalty on dust/steam false alarms and parameter boundary constraints.',
    timestamp: new Date().toISOString(),
    seed,
  };
}
