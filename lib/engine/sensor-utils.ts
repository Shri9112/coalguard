/**
 * CoalGuard - Sensor Network Utilities
 * Deterministic PRNG, engineering units, status computation, health modeling,
 * and value display formatting.
 */

import {
  SensorStatus,
  SensorType,
  SimulationConfig,
} from '../types';

/**
 * Deterministic Mulberry32 PRNG for reproducible sensor noise.
 */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SENSOR_UNITS: Record<SensorType, string> = {
  temperature: '°C',
  co: 'ppm',
  humidity: '%',
  vibration: 'g',
  current: '%',
  dust: 'mg/m³',
  wind: 'm/s',
  thermal: '°C',
  o2: '%',
  methane: '% LEL',
};

/**
 * Compute sensor status based on fault injection settings, scenario, and tick.
 */
export function determineSensorStatus(
  sensorId: string,
  sensorIndex: number,
  config: SimulationConfig,
  tick: number,
  caseDropoutModifier = 0
): SensorStatus {
  // Scenario forced faults
  if (config.scenario === 'sensor-fault') {
    const prng = mulberry32(tick * 31 + sensorIndex * 17);
    const roll = prng();
    if (roll < 0.25) return 'offline';
    if (roll < 0.55) return 'stale';
    if (roll < 0.85) return 'degraded';
    return 'online';
  }

  // Configured user dropout or case modifier
  const totalDropout = Math.min(60, config.sensorDropout + caseDropoutModifier);
  if (totalDropout > 0) {
    const prng = mulberry32(tick * 19 + sensorIndex * 23);
    const roll = prng();
    if (roll < (totalDropout / 100) * 0.45) return 'offline';
    if (roll < (totalDropout / 100) * 0.90) return 'stale';
  }

  // High noise induces degraded status
  if (config.sensorNoise >= 25) {
    const prng = mulberry32(tick * 11 + sensorIndex * 37);
    if (prng() < (config.sensorNoise / 100) * 0.7) return 'degraded';
  }

  return 'online';
}

/**
 * Compute sensor health (0 to 100%) reflecting measurement reliability.
 */
export function calculateSensorHealth(
  status: SensorStatus,
  noiseLevel: number,
  stalenessTicks = 0
): number {
  switch (status) {
    case 'offline':
      return 0;
    case 'stale':
      return Math.max(15, Math.round(45 - stalenessTicks * 2));
    case 'degraded':
      return Math.max(40, Math.round(75 - noiseLevel * 0.5));
    case 'online':
    default:
      return Math.max(70, Math.round(98 - noiseLevel * 0.35));
  }
}

/**
 * Formats sensor values for clean presentation with engineering units.
 */
export function formatSensorValue(type: SensorType, value: number, status: SensorStatus): string {
  if (status === 'offline') return 'OFFLINE';
  const unit = SENSOR_UNITS[type] ?? '';
  const digits = type === 'vibration' || type === 'wind' ? 2 : type === 'o2' || type === 'methane' ? 1 : 0;
  return `${value.toFixed(digits)} ${unit}`;
}
