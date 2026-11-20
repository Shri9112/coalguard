/**
 * CoalGuard - Baseline Decision Engines
 * Illustrative fixed-threshold baseline and uncalibrated Mamdani FIS
 * for side-by-side academic comparison on identical inputs.
 */

import { PsoTunableParameters, RiskStage, SensorNode, SimulationConfig } from '../types';
import { DEFAULT_PSO_PARAMETERS, runMamdaniInference, stageForRiskScore } from './fuzzy-system';
import { AggregatedEvidence } from './trends';

export interface DecisionEngineResult {
  riskScore: number;
  stage: RiskStage;
  isAlert: boolean; // Stage is Warning or Critical (risk >= 51)
  confidence: number;
  model: string;
}

/**
 * Educational fixed-threshold baseline. These example cutoffs are not industrial alarm limits.
 */
export function evaluateFixedThresholdBaseline(
  evidence: AggregatedEvidence
): DecisionEngineResult {
  const tempHigh = evidence.peakTemperature >= 55.0;
  const tempCritical = evidence.peakTemperature >= 75.0;
  const coHigh = evidence.peakCo >= 25.0;
  const coCritical = evidence.peakCo >= 60.0;
  const vibHigh = evidence.peakVibration >= 2.0;
  const currentHigh = evidence.averageMotorCurrent >= 90.0;
  const dustHigh = evidence.peakDust >= 85.0;

  let score = 12; // Normal baseline

  if (tempCritical || coCritical || (tempHigh && coHigh)) {
    score = 88; // Critical
  } else if (tempHigh || coHigh || (vibHigh && currentHigh) || (dustHigh && tempHigh)) {
    score = 65; // Warning
  } else if (evidence.peakTemperature >= 42.0 || evidence.peakCo >= 14.0 || vibHigh) {
    score = 38; // Watch
  }

  const stage = stageForRiskScore(score);

  return {
    riskScore: score,
    stage,
    isAlert: score >= 51,
    confidence: evidence.overallSensorHealth >= 70 ? 80 : 50,
    model: 'Fixed threshold baseline',
  };
}

/**
 * Uncalibrated (expert heuristic) Mamdani Fuzzy System.
 */
export function evaluateBasicMamdani(
  evidence: AggregatedEvidence,
  config: SimulationConfig,
  sensors: SensorNode[]
): DecisionEngineResult {
  const assessment = runMamdaniInference(evidence, config, sensors, DEFAULT_PSO_PARAMETERS);
  return {
    riskScore: assessment.riskScore,
    stage: assessment.stage,
    isAlert: assessment.riskScore >= 51,
    confidence: assessment.confidence,
    model: 'Basic Mamdani Fuzzy Logic',
  };
}

/**
 * PSO-Tuned Mamdani Fuzzy System.
 */
export function evaluatePsoTunedMamdani(
  evidence: AggregatedEvidence,
  config: SimulationConfig,
  sensors: SensorNode[],
  calibratedParams: PsoTunableParameters
): DecisionEngineResult {
  const assessment = runMamdaniInference(evidence, config, sensors, calibratedParams);
  return {
    riskScore: assessment.riskScore,
    stage: assessment.stage,
    isAlert: assessment.riskScore >= 51,
    confidence: assessment.confidence,
    model: 'PSO-tuned Mamdani Fuzzy Logic',
  };
}
