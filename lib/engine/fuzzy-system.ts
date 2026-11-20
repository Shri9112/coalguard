/**
 * CoalGuard - Genuine Mamdani Fuzzy Inference System (FIS)
 * Mathematical fuzzification, explicit rule base evaluation,
 * min implication, max aggregation, and centroid defuzzification.
 */

import {
  DefuzzificationTrace,
  EnvironmentProfile,
  FuzzyInputState,
  FuzzyRuleDetail,
  MembershipPoints,
  PsoTunableParameters,
  RiskAssessment,
  RiskStage,
  SensorNode,
  SimulationConfig,
} from '../types';
import { AggregatedEvidence } from './trends';

/**
 * Marks which signal groups are actually present in an evidence record.
 * Omitted availability means a complete simulated sensor set, preserving the
 * existing live-simulation behavior. Missing channels are unknown, never low.
 */
export interface InferenceAvailability {
  temperature: boolean;
  temperatureTrend: boolean;
  co: boolean;
  coTrend: boolean;
  hiddenHotspotContext: boolean;
  vibration: boolean;
  current: boolean;
  dust: boolean;
  sensorHealth: boolean;
  crossSensorAgreement: boolean;
}

export const COMPLETE_INFERENCE_AVAILABILITY: InferenceAvailability = {
  temperature: true,
  temperatureTrend: true,
  co: true,
  coTrend: true,
  hiddenHotspotContext: true,
  vibration: true,
  current: true,
  dust: true,
  sensorHealth: true,
  crossSensorAgreement: true,
};

/**
 * Standard triangular membership function: mu(x; a, b, c)
 */
export function triangle(x: number, a: number, b: number, c: number): number {
  if (x <= a || x >= c) return 0;
  if (x === b) return 1;
  if (x < b) return (x - a) / (b - a);
  return (c - x) / (c - b);
}

/**
 * Standard trapezoidal membership function: mu(x; a, b, c, d)
 */
export function trapezoid(x: number, a: number, b: number, c: number, d: number): number {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
}

/**
 * Left-shoulder membership function (starts at 1, ramps down to 0).
 */
export function leftShoulder(x: number, a: number, b: number): number {
  if (x <= a) return 1;
  if (x >= b) return 0;
  return (b - x) / (b - a);
}

/**
 * Right-shoulder membership function (starts at 0, ramps up to 1).
 */
export function rightShoulder(x: number, a: number, b: number): number {
  if (x <= a) return 0;
  if (x >= b) return 1;
  return (x - a) / (b - a);
}

export function evaluateMembershipPoints(x: number, p: MembershipPoints): number {
  if (p.d !== undefined) {
    return trapezoid(x, p.a, p.b, p.c, p.d);
  }
  return triangle(x, p.a, p.b, p.c);
}

/**
 * Default base tuning parameters before PSO calibration.
 */
export const DEFAULT_PSO_PARAMETERS: PsoTunableParameters = {
  tempHighA: 48.0,
  tempHighB: 72.0,
  trendHighA: 1.2,
  trendHighB: 3.8,
  coHighA: 18.0,
  coHighB: 50.0,
  mechHighA: 1.2,
  mechHighB: 3.5,
  ruleWeightThermal: 1.0,
  ruleWeightMechanical: 0.95,
  ruleWeightInterference: 0.90,
};

/**
 * Profile-aware baselines for educational operating ranges.
 */
export function getProfileBaselines(profile: EnvironmentProfile) {
  switch (profile) {
    case 'mine-conveyor':
      return { tempBase: 24, tempOffset: 0, coOffset: 0 };
    case 'factory-chp':
      return { tempBase: 28, tempOffset: 2, coOffset: 0 };
    case 'stockpile':
      return { tempBase: 32, tempOffset: 6, coOffset: -2 };
    case 'transit':
      return { tempBase: 26, tempOffset: 2, coOffset: 0 };
    case 'cargo-hold':
      return { tempBase: 25, tempOffset: -2, coOffset: 4 };
  }
}

/**
 * Output fuzzy sets on risk domain z in [0, 100].
 */
export const OUTPUT_RISK_SETS = {
  Normal: { a: 0, b: 0, c: 15, d: 30 }, // Left shoulder / trapezoid
  Watch: { a: 20, b: 38, c: 55 }, // Triangle
  Warning: { a: 45, b: 62, c: 80 }, // Triangle
  Critical: { a: 70, b: 85, c: 100, d: 100 }, // Right shoulder / trapezoid
};

export function evaluateOutputSet(z: number, set: { a: number; b: number; c: number; d?: number }): number {
  if (set.d !== undefined) {
    if (set.a === 0 && set.b === 0) {
      return leftShoulder(z, set.c, set.d);
    }
    if (set.c === 100 && set.d === 100) {
      return rightShoulder(z, set.a, set.b);
    }
    return trapezoid(z, set.a, set.b, set.c, set.d);
  }
  return triangle(z, set.a, set.b, set.c);
}

/**
 * Converts crisp risk score to educational severity band.
 */
export function stageForRiskScore(score: number): RiskStage {
  if (score >= 76) return 'Critical';
  if (score >= 51) return 'Warning';
  if (score >= 26) return 'Watch';
  return 'Normal';
}

/**
 * Complete Mamdani Inference Pipeline.
 */
export function runMamdaniInference(
  evidence: AggregatedEvidence,
  config: SimulationConfig,
  sensors: SensorNode[],
  params: PsoTunableParameters = DEFAULT_PSO_PARAMETERS,
  inputAvailability: Partial<InferenceAvailability> = {}
): RiskAssessment {
  const profileBase = getProfileBaselines(config.profile);
  const availability = { ...COMPLETE_INFERENCE_AVAILABILITY, ...inputAvailability };

  // 1. FUZZIFICATION
  // Temperature linguistic variable
  const tempVal = evidence.peakTemperature;
  const tempLow = availability.temperature
    ? leftShoulder(tempVal, 24 + profileBase.tempOffset, 42 + profileBase.tempOffset)
    : 0;
  const tempMed = availability.temperature
    ? triangle(tempVal, 34 + profileBase.tempOffset, 50 + profileBase.tempOffset, 68 + profileBase.tempOffset)
    : 0;
  const tempHigh = availability.temperature
    ? rightShoulder(tempVal, params.tempHighA + profileBase.tempOffset, params.tempHighB + profileBase.tempOffset)
    : 0;

  // Temperature Rate-of-Rise (Trend) linguistic variable
  const trendVal = Math.max(0, evidence.temperatureRateOfRise);
  const trendLow = availability.temperatureTrend ? leftShoulder(trendVal, 0.2, 0.8) : 0;
  const trendMed = availability.temperatureTrend ? triangle(trendVal, 0.5, 1.4, 2.5) : 0;
  const trendHigh = availability.temperatureTrend
    ? rightShoulder(trendVal, params.trendHighA, params.trendHighB)
    : 0;

  // Carbon Monoxide (CO ppm) linguistic variable
  const coVal = evidence.peakCo;
  const coLow = availability.co
    ? leftShoulder(coVal, 8 + profileBase.coOffset, 24 + profileBase.coOffset)
    : 0;
  const coMed = availability.co
    ? triangle(coVal, 10 + profileBase.coOffset, 22 + profileBase.coOffset, 36 + profileBase.coOffset)
    : 0;
  const coHigh = availability.co
    ? rightShoulder(coVal, params.coHighA + profileBase.coOffset, params.coHighB + profileBase.coOffset)
    : 0;
  const coElevated = availability.co
    ? rightShoulder(coVal, 16 + profileBase.coOffset, 28 + profileBase.coOffset)
    : 0;
  const coSevere = availability.co
    ? rightShoulder(coVal, Math.max(26.0, params.coHighA) + profileBase.coOffset, params.coHighB + profileBase.coOffset)
    : 0;

  // Mechanical (Vibration g & Current %)
  const vibVal = evidence.peakVibration;
  const vibHigh = availability.vibration
    ? rightShoulder(vibVal, params.mechHighA, params.mechHighB)
    : 0;
  const curVal = evidence.averageMotorCurrent;
  const curHigh = availability.current ? rightShoulder(curVal, 85, 105) : 0;
  const mechanicalHigh = Math.max(vibHigh, curHigh);
  const mechanicalLow = availability.vibration ? leftShoulder(vibVal, 0.3, 0.8) : 0;

  // Dust context
  const dustVal = evidence.peakDust;
  const dustLow = availability.dust ? leftShoulder(dustVal, 15, 35) : 0;
  const dustHigh = availability.dust ? rightShoulder(dustVal, 40, 95) : 0;

  // Reliability & Sensor Health
  const healthVal = evidence.overallSensorHealth;
  const healthGood = availability.sensorHealth ? rightShoulder(healthVal, 60, 85) : 0;
  const healthDegraded = availability.sensorHealth ? leftShoulder(healthVal, 50, 75) : 0;

  // Build inspectable fuzzy input states
  const fuzzyInputs: FuzzyInputState[] = [
    {
      id: 'temperature',
      label: 'Peak Temperature',
      value: tempVal,
      displayValue: `${tempVal.toFixed(1)} °C`,
      memberships: { low: tempLow, medium: tempMed, high: tempHigh },
      dominantLevel: tempHigh > 0.5 ? 'High' : tempMed > 0.5 ? 'Medium' : 'Low',
      dominantMembership: Math.max(tempLow, tempMed, tempHigh),
      trend: evidence.temperatureRateOfRise > 0.4 ? 'rising' : 'stable',
      health: evidence.overallSensorHealth,
      status: 'derived',
      role: 'Direct thermal evidence',
      tone: 'amber',
    },
    {
      id: 'trend',
      label: 'Rate of Rise (dT/dt)',
      value: trendVal,
      displayValue: `${trendVal.toFixed(2)} °C/min`,
      memberships: { low: trendLow, medium: trendMed, high: trendHigh },
      dominantLevel: trendHigh > 0.5 ? 'High' : trendMed > 0.5 ? 'Medium' : 'Low',
      dominantMembership: Math.max(trendLow, trendMed, trendHigh),
      trend: trendVal > 0.5 ? 'rising' : 'stable',
      health: evidence.overallSensorHealth,
      status: 'derived',
      role: 'Early thermal escalation trend',
      tone: 'amber',
    },
    {
      id: 'co',
      label: 'Peak Carbon Monoxide',
      value: coVal,
      displayValue: `${coVal.toFixed(1)} ppm`,
      memberships: { low: coLow, medium: coMed, high: coHigh },
      dominantLevel: coHigh > 0.5 ? 'High' : coMed > 0.5 ? 'Medium' : 'Low',
      dominantMembership: Math.max(coLow, coMed, coHigh),
      trend: evidence.coRateOfRise > 0.5 ? 'rising' : 'stable',
      health: evidence.overallSensorHealth,
      status: 'derived',
      role: 'Gas oxidation indicator',
      tone: 'red',
    },
    {
      id: 'mechanical',
      label: 'Vibration & Drive Current',
      value: vibVal,
      displayValue: `${vibVal.toFixed(2)} g / ${curVal.toFixed(0)}% A`,
      memberships: { low: mechanicalLow, medium: 1 - Math.max(mechanicalLow, mechanicalHigh), high: mechanicalHigh },
      dominantLevel: mechanicalHigh > 0.5 ? 'High' : 'Low',
      dominantMembership: Math.max(mechanicalLow, mechanicalHigh),
      trend: vibVal > 0.8 ? 'rising' : 'stable',
      health: evidence.overallSensorHealth,
      status: 'derived',
      role: 'Friction and equipment mechanical stress',
      tone: 'cyan',
    },
    {
      id: 'dust',
      label: 'Airborne Particulates',
      value: dustVal,
      displayValue: `${dustVal.toFixed(0)} mg/m³`,
      memberships: { low: dustLow, medium: 1 - Math.max(dustLow, dustHigh), high: dustHigh },
      dominantLevel: dustHigh > 0.5 ? 'High' : 'Low',
      dominantMembership: Math.max(dustLow, dustHigh),
      trend: dustVal > 50 ? 'rising' : 'stable',
      health: evidence.overallSensorHealth,
      status: 'derived',
      role: 'Interference / spillage context',
      tone: 'violet',
    },
    {
      id: 'reliability',
      label: 'Telemetry Health',
      value: healthVal,
      displayValue: `${healthVal}% reliable`,
      memberships: { low: healthDegraded, medium: 0.5, high: healthGood },
      dominantLevel: healthGood > 0.6 ? 'High' : 'Low',
      dominantMembership: healthGood,
      trend: 'stable',
      health: healthVal,
      status: 'derived',
      role: 'Evidence quality weighting',
      tone: 'green',
    },
  ];

  const unavailableInputIds = new Set<string>();
  if (!availability.temperature) unavailableInputIds.add('temperature');
  if (!availability.temperatureTrend) unavailableInputIds.add('trend');
  if (!availability.co) unavailableInputIds.add('co');
  if (!availability.vibration && !availability.current) unavailableInputIds.add('mechanical');
  if (!availability.dust) unavailableInputIds.add('dust');
  if (!availability.sensorHealth) unavailableInputIds.add('reliability');
  for (const input of fuzzyInputs) {
    if (!unavailableInputIds.has(input.id)) continue;
    input.status = 'unavailable';
    input.displayValue = 'Not available in this data source';
    input.dominantLevel = 'Unknown';
    input.dominantMembership = 0;
    input.memberships = { low: 0, medium: 0, high: 0 };
  }
  if (availability.co && !availability.coTrend) {
    const coInput = fuzzyInputs.find((input) => input.id === 'co');
    if (coInput) coInput.displayValue += ' · rate unavailable';
  }

  // 2. EXPLICIT IF-THEN RULE BASE EVALUATION
  // Min AND, Max OR
  const rules: FuzzyRuleDetail[] = [
    // R01: Combined thermal + trend + gas -> Critical
    {
      code: 'R01',
      label: 'Multi-indicator runaway self-heating',
      formula: 'IF Temp is HIGH AND Trend is HIGH AND CO is HIGH',
      weight: params.ruleWeightThermal,
      firingStrength: Math.min(tempHigh, trendHigh, coHigh) * params.ruleWeightThermal,
      antecedents: [
        { label: 'Temp HIGH', membership: tempHigh },
        { label: 'Trend HIGH', membership: trendHigh },
        { label: 'CO HIGH', membership: coHigh },
      ],
      consequent: {
        target: 'risk',
        level: 'Critical',
        outputSet: OUTPUT_RISK_SETS.Critical,
      },
      effect: 'Forces Critical risk stage (severe spontaneous combustion)',
      tone: 'red',
      active: false,
    },
    // R02: Elevated temp + rising trend -> Warning
    {
      code: 'R02',
      label: 'Thermal escalation onset',
      formula: 'IF Temp is HIGH AND Trend is HIGH',
      weight: params.ruleWeightThermal * 0.9,
      firingStrength: Math.min(tempHigh, trendHigh) * params.ruleWeightThermal * 0.9,
      antecedents: [
        { label: 'Temp HIGH', membership: tempHigh },
        { label: 'Trend HIGH', membership: trendHigh },
      ],
      consequent: {
        target: 'risk',
        level: 'Warning',
        outputSet: OUTPUT_RISK_SETS.Warning,
      },
      effect: 'Elevates to Warning stage based on thermal rate-of-rise',
      tone: 'amber',
      active: false,
    },
    // R03: Elevated gas with moderate temperature -> Warning (smoldering / deep heating)
    {
      code: 'R03',
      label: 'Deep oxidation gas accumulation',
      formula: 'IF CO is HIGH AND Temp is MEDIUM',
      weight: params.ruleWeightThermal * 0.85,
      firingStrength: Math.min(coHigh, tempMed) * params.ruleWeightThermal * 0.85,
      antecedents: [
        { label: 'CO HIGH', membership: coHigh },
        { label: 'Temp MEDIUM', membership: tempMed },
      ],
      consequent: {
        target: 'risk',
        level: 'Warning',
        outputSet: OUTPUT_RISK_SETS.Warning,
      },
      effect: 'Flags subsurface heating before thermal breakout occurs',
      tone: 'amber',
      active: false,
    },
    // R04: Mechanical friction / bearing overload
    {
      code: 'R04',
      label: 'Mechanical friction branch',
      formula: 'IF (Vibration is HIGH OR Current is HIGH) AND CO is LOW',
      weight: params.ruleWeightMechanical,
      firingStrength: Math.min(mechanicalHigh, coLow) * params.ruleWeightMechanical,
      antecedents: [
        { label: 'Mechanical HIGH', membership: mechanicalHigh },
        { label: 'CO LOW', membership: coLow },
      ],
      consequent: {
        target: 'risk',
        level: 'Watch',
        outputSet: OUTPUT_RISK_SETS.Watch,
      },
      effect: 'Identifies mechanical friction rather than coal oxidation',
      tone: 'cyan',
      active: false,
    },
    // R05: Dust or steam interference (false-alarm suppressor)
    {
      code: 'R05',
      label: 'Particulate / steam interference test',
      formula: 'IF Dust is HIGH AND CO is LOW AND Trend is LOW',
      weight: params.ruleWeightInterference,
      firingStrength: Math.min(dustHigh, coLow, trendLow) * params.ruleWeightInterference,
      antecedents: [
        { label: 'Dust HIGH', membership: dustHigh },
        { label: 'CO LOW', membership: coLow },
        { label: 'Trend LOW', membership: trendLow },
      ],
      consequent: {
        target: 'confidence',
        level: 'Watch',
        outputSet: OUTPUT_RISK_SETS.Watch,
      },
      effect: 'Reduces confidence and damps false alarm risk',
      tone: 'violet',
      active: false,
    },
    // R06 requires explicit paired surface/core or wet-surface context. A
    // single temperature plus gas/trend cannot establish a hidden hotspot.
    {
      code: 'R06',
      label: 'Hidden hotspot under wet surface',
      formula: 'IF (CO is HIGH OR Trend is HIGH) AND Temp is LOW (surface cooled)',
      weight: 0.95,
      firingStrength: availability.hiddenHotspotContext
        ? Math.min(Math.max(coHigh, trendHigh), tempLow) * 0.95
        : 0,
      antecedents: [
        { label: 'CO or Trend HIGH', membership: Math.max(coHigh, trendHigh) },
        { label: 'Surface Temp LOW', membership: tempLow },
      ],
      consequent: {
        target: 'risk',
        level: 'Warning',
        outputSet: OUTPUT_RISK_SETS.Warning,
      },
      effect: 'Warns that wet surface suppresses thermal signal while oxidation proceeds',
      tone: 'amber',
      active: false,
    },
    // R07: Telemetry health degradation
    {
      code: 'R07',
      label: 'Sensor network degradation warning',
      formula: 'IF Sensor Health is DEGRADED',
      weight: 0.8,
      firingStrength: healthDegraded * 0.8,
      antecedents: [{ label: 'Health DEGRADED', membership: healthDegraded }],
      consequent: {
        target: 'confidence',
        level: 'Watch',
        outputSet: OUTPUT_RISK_SETS.Watch,
      },
      effect: 'Issues explicit telemetry warning; treats missing data as uncertainty',
      tone: 'green',
      active: false,
    },
    // R08: Normal baseline stability
    {
      code: 'R08',
      label: 'Stable operating baseline equilibrium',
      formula: 'IF Temp is BASELINE AND CO is LOW AND Trend is LOW',
      weight: 1.0,
      firingStrength: Math.min(Math.max(tempLow, Math.min(tempMed, trendLow)), coLow, trendLow) * 1.0,
      antecedents: [
        { label: 'Temp BASELINE', membership: Math.max(tempLow, Math.min(tempMed, trendLow)) },
        { label: 'CO LOW', membership: coLow },
        { label: 'Trend LOW', membership: trendLow },
      ],
      consequent: {
        target: 'risk',
        level: 'Normal',
        outputSet: OUTPUT_RISK_SETS.Normal,
      },
      effect: 'Anchors risk score in the Normal band (0-25)',
      tone: 'green',
      active: false,
    },
    // R09/R10 keep risk tied to sustained absolute evidence after the
    // temperature or gas rate-of-rise naturally slows near a process plateau.
    {
      code: 'R09',
      label: 'Sustained high temperature with elevated oxidation gas',
      formula: 'IF Temp is HIGH AND CO is ELEVATED',
      weight: params.ruleWeightThermal,
      firingStrength: Math.min(tempHigh, coElevated) * params.ruleWeightThermal,
      antecedents: [
        { label: 'Temp HIGH', membership: tempHigh },
        { label: 'CO ELEVATED', membership: coElevated },
      ],
      consequent: {
        target: 'risk',
        level: 'Warning',
        outputSet: OUTPUT_RISK_SETS.Warning,
      },
      effect: 'Maintains Warning when sustained thermal and elevated gas evidence remains after the rise slows',
      tone: 'amber',
      active: false,
    },
    {
      code: 'R10',
      label: 'Sustained severe thermal and gas evidence',
      formula: 'IF Temp is HIGH AND CO is HIGH',
      weight: params.ruleWeightThermal,
      firingStrength: Math.min(tempHigh, coSevere) * params.ruleWeightThermal,
      antecedents: [
        { label: 'Temp HIGH', membership: tempHigh },
        { label: 'CO HIGH', membership: coSevere },
      ],
      consequent: {
        target: 'risk',
        level: 'Critical',
        outputSet: OUTPUT_RISK_SETS.Critical,
      },
      effect: 'Maintains Critical risk while severe thermal and oxidation-gas evidence persists',
      tone: 'red',
      active: false,
    },
  ];

  // Membership and rule firing strengths must remain within [0, 1], even if PSO
  // proposes a rule weight above one.
  rules.forEach((r) => {
    r.firingStrength = Math.max(0, Math.min(1, r.firingStrength));
    r.active = r.firingStrength >= 0.15;
  });

  // 3. RULE IMPLICATION & AGGREGATION
  // Discretize output risk domain z in [0, 100] with step delta_z = 1
  const domainSize = 101;
  const domain = Array.from({ length: domainSize }, (_, i) => i);
  const aggregatedSet = new Array(domainSize).fill(0);

  // Mamdani Min Implication: clip each rule's output fuzzy set at firingStrength
  // Fuzzy Max Aggregation: union of all clipped fuzzy sets
  rules.forEach((rule) => {
    if (rule.consequent.target === 'risk' && rule.firingStrength > 0.01) {
      for (let i = 0; i < domainSize; i++) {
        const z = domain[i];
        const rawMembership = evaluateOutputSet(z, rule.consequent.outputSet);
        const clippedMembership = Math.min(rule.firingStrength, rawMembership);
        aggregatedSet[i] = Math.max(aggregatedSet[i], clippedMembership);
      }
    }
  });

  // 4. CENTROID DEFUZZIFICATION
  // z* = sum(z * mu(z)) / sum(mu(z))
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < domainSize; i++) {
    const z = domain[i];
    const mu = aggregatedSet[i];
    numerator += z * mu;
    denominator += mu;
  }

  // If all rules quiet, default to safe baseline centroid
  const crispCentroid = denominator > 0.0001 ? numerator / denominator : 12.0;

  // Risk is computed from sensor evidence only. Cooling and stopping affect the
  // physical process model on later ticks; they do not discount this reading.
  const finalRiskScore = Math.round(Math.max(2, Math.min(99, crispCentroid)));
  const stage = stageForRiskScore(finalRiskScore);

  // 5. CONFIDENCE INDICATOR (Evidence Quality)
  // Kept separate from risk score!
  const interferenceDampening = rules.find((r) => r.code === 'R05')?.firingStrength ?? 0;
  const faultDampening = rules.find((r) => r.code === 'R07')?.firingStrength ?? 0;
  const noisePenalty = (config.sensorNoise / 100) * 18;
  const dropoutPenalty = (config.sensorDropout / 100) * 22;
  const coverageGroups = [
    availability.temperature,
    availability.temperatureTrend,
    availability.co,
    availability.coTrend,
    availability.vibration || availability.current,
    availability.dust,
    availability.sensorHealth,
    availability.crossSensorAgreement,
  ];
  const availableGroupCount = coverageGroups.filter(Boolean).length;
  const evidenceCoverage = availableGroupCount / coverageGroups.length;
  const coverageFactor = 0.4 + 0.6 * evidenceCoverage;
  const sensorHealthFactor = availability.sensorHealth ? evidence.overallSensorHealth / 100 : 0.7;
  const agreementFactor = availability.crossSensorAgreement ? evidence.crossSensorAgreement : 0.7;

  const confidenceScore = Math.round(
    Math.max(
      30,
      Math.min(
        99,
        96 * sensorHealthFactor * agreementFactor * coverageFactor -
          interferenceDampening * 18 -
          faultDampening * 15 -
          noisePenalty -
          dropoutPenalty
      )
    )
  );

  // 6. PROBABLE CAUSE DETERMINATION
  const isInterference = interferenceDampening > 0.35 && coVal < 14;
  const isMechanical = (rules.find((r) => r.code === 'R04')?.firingStrength ?? 0) > 0.45;
  const isHiddenHeat = (rules.find((r) => r.code === 'R06')?.firingStrength ?? 0) > 0.40;
  const isSensorFault = config.scenario === 'sensor-fault' || evidence.offlineSensorCount >= 2;

  let probableCause = 'Normal operating equilibrium';
  if (isSensorFault) {
    probableCause = 'Telemetry dropout / sensor disagreement';
  } else if (isInterference) {
    probableCause = 'Dust / steam sensor interference';
  } else if (isMechanical) {
    probableCause = 'Mechanical friction & drive overheating';
  } else if (isHiddenHeat) {
    probableCause = 'Subsurface self-heating under cooled exterior';
  } else if (stage === 'Critical' || stage === 'Warning') {
    probableCause = 'Exothermic coal self-heating & oxidation';
  } else if (stage === 'Watch') {
    probableCause = 'Developing thermal / airflow anomaly';
  }

  // Recommended operator response
  let recommendedAction: RiskAssessment['recommendedAction'] = 'monitor';
  let actionReason = 'Sensor evidence is stable within normal limits.';

  if (stage === 'Critical') {
    recommendedAction = 'stop';
    actionReason = 'Urgent: Strong multi-sensor evidence indicates immediate runaway hazard.';
  } else if (stage === 'Warning') {
    recommendedAction = isMechanical ? 'inspect' : 'cool';
    actionReason = isMechanical
      ? 'Elevated mechanical load and friction. Dispatch inspection to drive station.'
      : 'Active oxidation detected. Activate spray suppression and inspect area.';
  } else if (stage === 'Watch') {
    recommendedAction = 'inspect';
    actionReason = 'Emerging thermal/gas separation. Dispatch mobile inspection unit.';
  }

  // Active rules list
  const activeRulesList = rules
    .filter((r) => r.active)
    .sort((a, b) => b.firingStrength - a.firingStrength);

  // Confidence factor breakdown
  const confidenceFactors = [
    {
      id: 'sensor-health',
      label: 'Sensor Hardware Health',
      value: availability.sensorHealth ? evidence.overallSensorHealth : 0,
      effect: availability.sensorHealth
        ? evidence.overallSensorHealth >= 80 ? ('supports' as const) : ('reduces' as const)
        : ('neutral' as const),
      detail: availability.sensorHealth
        ? `${evidence.healthySensorCount} of ${sensors.length} nodes fully operational.`
        : 'Sensor-health measurements are not present in this source.',
    },
    {
      id: 'cross-sensor-agreement',
      label: 'Cross-Sensor Agreement',
      value: availability.crossSensorAgreement ? Math.round(evidence.crossSensorAgreement * 100) : 0,
      effect: availability.crossSensorAgreement
        ? evidence.crossSensorAgreement >= 0.75 ? ('supports' as const) : ('reduces' as const)
        : ('neutral' as const),
      detail: !availability.crossSensorAgreement
        ? 'Spatial agreement cannot be checked from this source.'
        : evidence.crossSensorAgreement >= 0.75
          ? 'Thermal and gas sensors show spatial consistency.'
          : 'High variance or missing cluster nodes reduce evidence confidence.',
    },
    {
      id: 'interference-risk',
      label: 'Environmental Interference',
      value: Math.round((1 - interferenceDampening) * 100),
      effect: interferenceDampening < 0.25 ? ('supports' as const) : ('reduces' as const),
      detail:
        interferenceDampening >= 0.25
          ? 'Particulate dust or steam detected without gas support; down-weighted.'
          : 'Low ambient interference detected.',
    },
    {
      id: 'telemetry-stability',
      label: 'Telemetry Noise Margin',
      value: Math.round(100 - noisePenalty * 3),
      effect: noisePenalty < 5 ? ('supports' as const) : ('reduces' as const),
      detail: `Configured noise floor is ${config.sensorNoise}%.`,
    },
    {
      id: 'input-coverage',
      label: 'Available Evidence Channels',
      value: Math.round(evidenceCoverage * 100),
      effect: evidenceCoverage >= 0.8 ? ('supports' as const) : ('reduces' as const),
      detail: `${availableGroupCount} of ${coverageGroups.length} signal groups are available; missing channels are treated as unknown.`,
    },
  ];

  // Defuzzification trace object
  const defuzzificationTrace: DefuzzificationTrace = {
    domain,
    aggregatedSet,
    centroidNumerator: Math.round(numerator * 100) / 100,
    centroidDenominator: Math.round(denominator * 100) / 100,
    crispCentroid: Math.round(crispCentroid * 10) / 10,
    ruleContributions: rules.map((r) => ({
      code: r.code,
      weight: r.weight,
      clippedArea: Math.round(r.firingStrength * 100) / 100,
    })),
  };

  const alertMessage = evidenceCoverage < 0.8
    ? `LIMITED-INPUT MODEL OUTPUT: ${stage.toUpperCase()} (${availableGroupCount}/${coverageGroups.length} signal groups)`
    : stage === 'Critical'
      ? 'CRITICAL FIRE-RISK WARNING: Multi-Sensor Oxidation Signature'
      : stage === 'Warning'
      ? 'WARNING: Operator Action Required'
      : stage === 'Watch'
      ? 'WATCH: Emerging Anomaly Under Observation'
      : 'NORMAL: Operating Within Baseline Envelope';

  const explanation =
    stage === 'Critical'
      ? availability.temperatureTrend
        ? `Simulated temperature (${tempVal.toFixed(1)} °C) and CO gas (${coVal.toFixed(1)} ppm) have escalated synchronously with high rate-of-rise (${trendVal.toFixed(2)} °C/min). Rule R01 fired at ${(rules[0].firingStrength).toFixed(2)}.`
        : `High absolute temperature (${tempVal.toFixed(1)} °C) and CO (${coVal.toFixed(1)} ppm) produced this limited-input model result. No timestamped rate-of-rise was available, so trend rules were not evaluated.`
      : stage === 'Warning'
      ? isHiddenHeat
        ? 'Rain/spray suppresses surface sensor readings while internal probe and gas concentrations remain elevated. Rule R06 fired.'
        : isMechanical
        ? 'Drive motor current and bearing vibration dominate over oxidation gases. Probable mechanical fault rather than coal fire.'
        : !availability.temperatureTrend
          ? `Available absolute temperature (${tempVal.toFixed(1)} °C) and CO (${coVal.toFixed(1)} ppm) produce a limited-input Mamdani result of ${finalRiskScore}/100. Trend rules were not evaluated.`
          : `Moderate thermal and CO elevation detected. Mamdani centroid defuzzification yields ${finalRiskScore}/100.`
      : stage === 'Watch'
      ? isInterference
        ? 'Elevated dust or steam with low CO indicates environmental interference rather than combustion. Confidence is dampened.'
        : !availability.temperatureTrend
          ? `A limited-input model result of ${finalRiskScore}/100 was produced from the available absolute readings. Timestamped trend evidence is unavailable.`
          : 'Slight thermal or gas divergence noted. Ongoing monitoring recommended.'
      : !availability.temperatureTrend
        ? 'The available absolute readings produced a low model score. A time-based trend is unavailable, so this result cannot establish that conditions are stable.'
        : 'Sensor evidence remains comfortably within the normal operating baseline.';

  const contributions = [
    { label: 'Thermal Evidence', value: Math.round(tempHigh * 35), tone: 'amber' as const },
    { label: 'Gas Evidence (CO)', value: Math.round(coHigh * 30), tone: 'red' as const },
    { label: 'Rate-of-Rise Trend', value: Math.round(trendHigh * 20), tone: 'amber' as const },
    { label: 'Mechanical Stress', value: Math.round(mechanicalHigh * 15), tone: 'cyan' as const },
  ];

  return {
    riskScore: finalRiskScore,
    stage,
    alertMessage,
    explanation,
    confidence: confidenceScore,
    probableCause,
    affectedZone: getAffectedZone(config.profile, config.scenario, finalRiskScore),
    recommendedAction,
    actionReason,
    fuzzyInputs,
    ruleDetails: rules,
    activeRules: activeRulesList,
    defuzzificationTrace,
    confidenceFactors,
    contributions,
  };
}

export function getAffectedZone(
  profile: EnvironmentProfile,
  scenario: string,
  riskScore: number
): string {
  switch (profile) {
    case 'mine-conveyor':
      if (scenario === 'belt-friction') return 'Roller Gallery Bay 3';
      return riskScore > 50 ? 'Transfer Point Chute' : 'Infeed Hopper';
    case 'factory-chp':
      if (scenario === 'transfer-blockage') return 'Transfer Chute Hood';
      return riskScore > 50 ? 'Bunker Discharge Bin' : 'Crusher Feed Deck';
    case 'stockpile':
      return riskScore > 40 ? 'Stockpile B Subsurface Core' : 'Stockpile A Flank';
    case 'transit':
      return 'Transit Bay Mid-Section';
    case 'cargo-hold':
      return 'Cargo Hold #2 Lower Bilge';
  }
}
