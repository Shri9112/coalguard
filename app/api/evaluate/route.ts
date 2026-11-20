/**
 * POST /api/evaluate
 * Validates an evidence vector and returns an explainable academic FIS result.
 * No physical plant connection is provided.
 */

import { NextResponse } from 'next/server';
import { PROFILES } from '../../../lib/data/profiles';
import { getScenariosForProfile } from '../../../lib/data/scenarios';
import { DEFAULT_PSO_PARAMETERS, runMamdaniInference } from '../../../lib/engine/fuzzy-system';
import {
  AggregatedEvidence,
  EnvironmentProfile,
  PsoTunableParameters,
  SensorNode,
  SimulationConfig,
} from '../../../lib/types';

export const dynamic = 'force-dynamic';

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function objectField(value: unknown, label: string): JsonObject {
  if (value === undefined) return {};
  if (!isObject(value)) throw new Error(`${label} must be a JSON object.`);
  return value;
}

function numberField(
  object: JsonObject,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const value = object[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${key} must be a finite number from ${minimum} to ${maximum}.`);
  }
  return value;
}

function enumField<T extends string>(
  object: JsonObject,
  key: string,
  fallback: T,
  allowed: readonly T[]
): T {
  const value = object[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${key} must be one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}

const evidenceRanges = {
  peakTemperature: [-10, 250],
  averageTemperature: [-10, 250],
  temperatureRateOfRise: [-100, 100],
  peakCo: [0, 500],
  averageCo: [0, 500],
  coRateOfRise: [-500, 500],
  peakVibration: [0, 10],
  averageMotorCurrent: [0, 150],
  peakDust: [0, 500],
  overallSensorHealth: [0, 100],
  offlineSensorCount: [0, 256],
  staleSensorCount: [0, 256],
  healthySensorCount: [0, 256],
  crossSensorAgreement: [0, 1],
  gasTemperatureCorrelation: [0, 1],
} as const satisfies Record<keyof AggregatedEvidence, readonly [number, number]>;

function resolveParameters(input: JsonObject): PsoTunableParameters {
  const parameterRanges: Record<keyof PsoTunableParameters, readonly [number, number]> = {
    tempHighA: [20, 120],
    tempHighB: [21, 150],
    trendHighA: [0, 10],
    trendHighB: [0.1, 20],
    coHighA: [0, 250],
    coHighB: [1, 500],
    mechHighA: [0, 8],
    mechHighB: [0.1, 10],
    ruleWeightThermal: [0, 1.5],
    ruleWeightMechanical: [0, 1.5],
    ruleWeightInterference: [0, 1.5],
  };
  const knownKeys = Object.keys(DEFAULT_PSO_PARAMETERS);
  const unknownKey = Object.keys(input).find((key) => !knownKeys.includes(key));
  if (unknownKey) throw new Error(`Unknown PSO parameter: ${unknownKey}.`);

  const result = { ...DEFAULT_PSO_PARAMETERS };
  for (const key of Object.keys(DEFAULT_PSO_PARAMETERS) as (keyof PsoTunableParameters)[]) {
    const [minimum, maximum] = parameterRanges[key];
    result[key] = numberField(input, key, DEFAULT_PSO_PARAMETERS[key], minimum, maximum);
  }
  if (result.tempHighA >= result.tempHighB) throw new Error('tempHighA must be lower than tempHighB.');
  if (result.trendHighA >= result.trendHighB) throw new Error('trendHighA must be lower than trendHighB.');
  if (result.coHighA >= result.coHighB) throw new Error('coHighA must be lower than coHighB.');
  if (result.mechHighA >= result.mechHighB) throw new Error('mechHighA must be lower than mechHighB.');
  return result;
}

export async function POST(request: Request) {
  const startTime = performance.now();

  try {
    const rawBody: unknown = await request.json();
    if (!isObject(rawBody)) throw new Error('Request body must be a JSON object.');

    const evidenceInput = objectField(rawBody.evidence, 'evidence');
    const configInput = objectField(rawBody.config, 'config');
    const parametersInput = objectField(rawBody.parameters, 'parameters');
    const evidenceKeys = Object.keys(evidenceRanges);
    const unknownEvidenceKey = Object.keys(evidenceInput).find((key) => !evidenceKeys.includes(key));
    if (unknownEvidenceKey) throw new Error(`Unknown evidence field: ${unknownEvidenceKey}.`);
    const profile = enumField<EnvironmentProfile>(
      configInput,
      'profile',
      'mine-conveyor',
      PROFILES.map((item) => item.id)
    );
    const scenario = enumField(
      configInput,
      'scenario',
      'normal',
      getScenariosForProfile(profile).map((item) => item.id)
    );

    const resolvedEvidence = {} as AggregatedEvidence;
    const defaultsApplied: string[] = [];
    for (const key of Object.keys(evidenceRanges) as (keyof AggregatedEvidence)[]) {
      const [minimum, maximum] = evidenceRanges[key];
      const fallback = key in normalEvidenceDefaults ? normalEvidenceDefaults[key] : undefined;
      if (evidenceInput[key] === undefined) defaultsApplied.push(key);
      if (fallback === undefined) throw new Error(`Missing default value for ${key}.`);
      resolvedEvidence[key] = numberField(evidenceInput, key, fallback, minimum, maximum);
    }
    for (const key of ['offlineSensorCount', 'staleSensorCount', 'healthySensorCount'] as const) {
      if (!Number.isInteger(resolvedEvidence[key])) throw new Error(`${key} must be a whole number.`);
    }

    const resolvedConfig: SimulationConfig = {
      profile,
      submode: enumField(configInput, 'submode', profile === 'transit' ? 'truck' : 'none', ['truck', 'rail-wagon', 'none']),
      scenario,
      weather: enumField(configInput, 'weather', 'cool', ['hot-dry', 'humid', 'rainy', 'cool', 'windy']),
      mode: enumField(configInput, 'mode', 'explore', ['guided', 'explore']),
      speed: numberField(configInput, 'speed', 1, 1, 5),
      load: numberField(configInput, 'load', 70, 0, 100),
      moisture: numberField(configInput, 'moisture', 35, 0, 100),
      compaction: numberField(configInput, 'compaction', 55, 0, 100),
      ventilation: numberField(configInput, 'ventilation', 50, 0, 100),
      sensorNoise: numberField(configInput, 'sensorNoise', 5, 0, 50),
      sensorDropout: numberField(configInput, 'sensorDropout', 0, 0, 50),
      sprayAvailable: configInput.sprayAvailable === undefined
        ? true
        : typeof configInput.sprayAvailable === 'boolean'
        ? configInput.sprayAvailable
        : (() => { throw new Error('sprayAvailable must be true or false.'); })(),
      response: enumField(configInput, 'response', 'monitor', ['monitor', 'inspect', 'cool', 'stop']),
      responseSince: numberField(configInput, 'responseSince', 0, 0, 1_000_000),
    };

    const rawSensors: unknown = rawBody.sensors ?? [];
    if (!Array.isArray(rawSensors) || rawSensors.length > 256 || rawSensors.some((sensor) => !isObject(sensor))) {
      throw new Error('sensors must be an array of at most 256 sensor objects.');
    }
    const sensors = rawSensors as SensorNode[];
    const parameters = resolveParameters(parametersInput);
    const riskAssessment = runMamdaniInference(resolvedEvidence, resolvedConfig, sensors, parameters);
    const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      executionTimeMs,
      defaultsApplied,
      result: riskAssessment,
      academicNotice:
        'Simulated academic decision-support result. No connection to physical industrial hardware.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to execute fuzzy inference assessment';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

const normalEvidenceDefaults: AggregatedEvidence = {
  peakTemperature: 24,
  averageTemperature: 23.5,
  temperatureRateOfRise: 0.05,
  peakCo: 3,
  averageCo: 2.5,
  coRateOfRise: 0.01,
  peakVibration: 0.25,
  averageMotorCurrent: 60,
  peakDust: 15,
  overallSensorHealth: 98,
  offlineSensorCount: 0,
  staleSensorCount: 0,
  healthySensorCount: 8,
  crossSensorAgreement: 0.95,
  gasTemperatureCorrelation: 0.9,
};
