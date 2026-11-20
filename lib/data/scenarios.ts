/**
 * CoalGuard - Scenario Definitions
 * Scenario descriptions mapped strictly to physically relevant operating profiles,
 * with deterministic preset configurations and expected physical trends.
 */

import { EnvironmentProfile, ScenarioDefinition, ScenarioId } from '../types';

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'normal',
    label: 'Normal Steady-State Operation',
    detail: 'Balanced thermal equilibrium, stable motor loading, clean gas baseline.',
    profileHints: ['mine-conveyor', 'factory-chp', 'stockpile', 'transit', 'cargo-hold'],
    guided: true,
    expectedTrend: 'Stable risk <= 25 (Normal stage). Temperatures remain below 45 °C and CO below 15 ppm.',
    presetConfig: {
      load: 70,
      moisture: 35,
      compaction: 55,
      ventilation: 50,
      sensorNoise: 5,
      sensorDropout: 0,
      sprayAvailable: true,
      weather: 'cool',
    },
  },
  {
    id: 'self-heating',
    label: 'Gradual Exothermic Self-Heating',
    detail: 'Low-temperature coal oxidation with synchronous temperature and CO gas accumulation.',
    profileHints: ['mine-conveyor', 'factory-chp', 'stockpile', 'transit', 'cargo-hold'],
    guided: true,
    expectedTrend: 'Progressive thermal escalation. Over 15–30 ticks, CO climbs past 40 ppm and hotspot heats above 65 °C, escalating from Watch to Warning.',
    presetConfig: {
      load: 80,
      moisture: 25,
      compaction: 70,
      ventilation: 35,
      sensorNoise: 6,
      sensorDropout: 0,
      sprayAvailable: false,
      weather: 'hot-dry',
    },
  },
  {
    id: 'belt-friction',
    label: 'Mechanical Idler / Belt Friction',
    detail: 'Seized roller bearings and misaligned conveyor belt elevating vibration and local frictional heat.',
    profileHints: ['mine-conveyor'],
    expectedTrend: 'Rapid elevation of mechanical vibration (>1.5 g) and motor current with elevated drive head temperature, but low CO gas signature (<15 ppm).',
    presetConfig: {
      load: 85,
      moisture: 30,
      compaction: 50,
      ventilation: 50,
      sensorNoise: 6,
      sensorDropout: 0,
      sprayAvailable: false,
      weather: 'humid',
    },
  },
  {
    id: 'transfer-blockage',
    label: 'Chute Blockage & Material Stagnation',
    detail: 'Restricted coal flow causing drive motor current surge, chute packing, and heat accumulation.',
    profileHints: ['factory-chp', 'mine-conveyor'],
    expectedTrend: 'Motor current surges to near-overload (>100%), dust peaks, and packed chute heats mechanically while downstream flow starves.',
    presetConfig: {
      load: 95,
      moisture: 35,
      compaction: 75,
      ventilation: 40,
      sensorNoise: 6,
      sensorDropout: 0,
      sprayAvailable: false,
      weather: 'hot-dry',
    },
  },
  {
    id: 'hidden-hotspot',
    label: 'Wet Surface with Subsurface Heat',
    detail: 'Rain or water sprays dampening surface sensors while deep internal coal oxidation intensifies.',
    profileHints: ['stockpile', 'transit'],
    expectedTrend: 'Surface IR pyrometers read deceptively cool (24–32 °C) due to surface wetting, while internal lance probes detect core heating (>70 °C) and rising CO.',
    presetConfig: {
      load: 80,
      moisture: 65,
      compaction: 85,
      ventilation: 30,
      sensorNoise: 6,
      sensorDropout: 0,
      sprayAvailable: true,
      weather: 'rainy',
    },
  },
  {
    id: 'dust-steam',
    label: 'Dust / Steam Sensor Interference',
    detail: 'Dense airborne particulates triggering optical sensor alerts without true combustible oxidation.',
    profileHints: ['factory-chp', 'mine-conveyor', 'stockpile', 'transit'],
    expectedTrend: 'Optical dust sensors report severe surges (>120 mg/m³), but thermal sensors and CO gas remain low. Soft computing rules avoid false alarm runaway.',
    presetConfig: {
      load: 75,
      moisture: 45,
      compaction: 50,
      ventilation: 60,
      sensorNoise: 8,
      sensorDropout: 0,
      sprayAvailable: true,
      weather: 'humid',
    },
  },
  {
    id: 'hold-asphyxiation',
    label: 'Sealed Hold Deep Smolder & Oxygen Drop',
    detail: 'Oxygen starvation, rapid CO elevation, and heat entrapment in enclosed bulk cargo hold.',
    profileHints: ['cargo-hold'],
    expectedTrend: 'Confined hold smolder consumes oxygen (O2 drops below 16%), CO concentrates (>80 ppm) due to restricted ventilation, posing severe asphyxiation risk.',
    presetConfig: {
      load: 90,
      moisture: 20,
      compaction: 80,
      ventilation: 15,
      sensorNoise: 6,
      sensorDropout: 0,
      sprayAvailable: false,
      weather: 'hot-dry',
    },
  },
  {
    id: 'sensor-fault',
    label: 'Telemetry Dropout & Sensor Faults',
    detail: 'Degraded, stale, and offline nodes challenging decision confidence without assuming failure is fire.',
    profileHints: ['mine-conveyor', 'factory-chp', 'stockpile', 'transit', 'cargo-hold'],
    expectedTrend: 'Node health scores degrade and confidence drops, but FIS avoids fabricating an emergency when underlying physics is normal.',
    presetConfig: {
      load: 75,
      moisture: 35,
      compaction: 60,
      ventilation: 45,
      sensorNoise: 18,
      sensorDropout: 30,
      sprayAvailable: true,
      weather: 'cool',
    },
  },
];

export function getScenario(id: ScenarioId): ScenarioDefinition {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}

export function getScenariosForProfile(profile: EnvironmentProfile): ScenarioDefinition[] {
  return SCENARIOS.filter((s) => s.profileHints.includes(profile));
}
