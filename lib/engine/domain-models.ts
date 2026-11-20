/**
 * CoalGuard - Domain Process Models
 * Lightweight, domain-specific virtual process models for:
 * 1. Mine Conveyor
 * 2. Factory CHP / Transfer Point
 * 3. Coal Stockpile Yard
 * 4. Road & Rail Transit (Truck vs Rail Wagon)
 * 5. Ship Cargo Hold
 *
 * Each model implements deterministic physical kinetics, spatial hotspot presets,
 * sensor reading derivations, and causal parameter change explanations.
 */

import {
  EnvironmentProfile,
  ProcessState,
  SensorBlueprint,
  SensorNode,
  SimulationConfig,
  TestCasePhase,
  TransitSubmode,
} from '../types';
import { SIMULATION_MINUTES_PER_TICK, WEATHER_PROFILES } from './constants';
import {
  calculateSensorHealth,
  determineSensorStatus,
  formatSensorValue,
  mulberry32,
  SENSOR_UNITS,
} from './sensor-utils';

export interface HotspotLocation {
  x: number;
  y: number;
  zone: string;
  intensity: number;
  radius: number;
}

export interface DomainProcessModel {
  readonly profile: EnvironmentProfile;
  readonly name: string;
  readonly description: string;

  getHotspotPreset(submode: TransitSubmode, scenario: string): {
    zone: string;
    x: number;
    y: number;
    radius: number;
  };

  calculateState(
    config: SimulationConfig,
    tick: number,
    activePhase?: TestCasePhase
  ): ProcessState;

  deriveSensors(
    blueprints: SensorBlueprint[],
    processState: ProcessState,
    config: SimulationConfig,
    tick: number,
    previousSensors?: SensorNode[]
  ): SensorNode[];

  explainImpact(
    prevConfig: SimulationConfig,
    nextConfig: SimulationConfig,
    prevState: ProcessState,
    nextState: ProcessState
  ): string;
}

/**
 * Common Gaussian spatial diffusion helper.
 */
export function calculateLocalStateAtCoords(
  x: number,
  y: number,
  state: ProcessState
): { temperature: number; co: number; vibration: number; dust: number } {
  const dx = x - state.hotspot.x;
  const dy = y - state.hotspot.y;
  const distSq = dx * dx + dy * dy;
  const sigma = Math.max(10, state.hotspot.radius);
  const spatialWeight = Math.exp(-distSq / (2 * sigma * sigma));

  const localTempElevation = state.hotspot.intensity * 0.55 * spatialWeight;
  const localTemperature = state.surfaceHeat + localTempElevation;

  const localCoElevation = state.gasConcentration * 0.4 * spatialWeight;
  const localCo = state.gasConcentration + localCoElevation;

  return {
    temperature: localTemperature,
    co: localCo,
    vibration: state.vibrationLevel,
    dust: state.airborneDust,
  };
}

/**
 * Standard sensor derivation helper that applies measurement noise, drift,
 * staleness, and dropout to underlying modeled physics without contaminating
 * the physical ProcessState.
 */
function deriveSensorsFromPhysics(
  blueprints: SensorBlueprint[],
  processState: ProcessState,
  config: SimulationConfig,
  tick: number,
  previousSensors?: SensorNode[],
  customReadingFn?: (bp: SensorBlueprint, local: ReturnType<typeof calculateLocalStateAtCoords>) => number
): SensorNode[] {
  const noiseScale = config.sensorNoise / 100;

  return blueprints.map((blueprint, index) => {
    const status = determineSensorStatus(blueprint.id, index, config, tick);
    const prev = previousSensors?.find((s) => s.id === blueprint.id);
    const local = calculateLocalStateAtCoords(blueprint.x, blueprint.y, processState);

    let rawValue = 0;
    if (customReadingFn) {
      rawValue = customReadingFn(blueprint, local);
    } else {
      switch (blueprint.type) {
        case 'temperature':
          rawValue = local.temperature;
          break;
        case 'thermal':
          rawValue = local.temperature + processState.hotspot.intensity * 0.2;
          break;
        case 'co':
          rawValue = local.co;
          break;
        case 'vibration':
          rawValue = local.vibration;
          break;
        case 'current':
          rawValue = processState.motorCurrent;
          break;
        case 'dust':
          rawValue = local.dust;
          break;
        case 'humidity':
          rawValue = processState.humidity;
          break;
        case 'wind':
          rawValue = processState.airflowSpeed;
          break;
        case 'o2':
          rawValue = Math.max(12.0, 20.9 - processState.gasConcentration * 0.05);
          break;
        case 'methane':
          rawValue = Math.max(0, processState.gasConcentration * 0.08 - 0.2);
          break;
      }
    }

    // Deterministic Gaussian jitter for measurement noise
    const prng = mulberry32(tick * 73 + index * 101);
    const u1 = Math.max(0.0001, prng());
    const u2 = prng();
    const normalJitter = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

    let measurementJitter = 0;
    if (blueprint.type === 'temperature' || blueprint.type === 'thermal') {
      measurementJitter = normalJitter * noiseScale * 2.5;
    } else if (blueprint.type === 'co') {
      measurementJitter = normalJitter * noiseScale * 4.0;
    } else if (blueprint.type === 'vibration') {
      measurementJitter = normalJitter * noiseScale * 0.15;
    } else if (blueprint.type === 'current') {
      measurementJitter = normalJitter * noiseScale * 3.5;
    } else if (blueprint.type === 'dust') {
      measurementJitter = normalJitter * noiseScale * 8.0;
    } else {
      measurementJitter = normalJitter * noiseScale * 1.0;
    }

    let measuredValue = rawValue + measurementJitter;

    if (status === 'offline' || status === 'stale') {
      measuredValue = prev ? prev.value : rawValue;
    }

    // Engineering boundaries
    if (blueprint.type === 'temperature' || blueprint.type === 'thermal') {
      measuredValue = Math.max(-10, Math.min(250, measuredValue));
    } else if (blueprint.type === 'co') {
      measuredValue = Math.max(0, Math.min(500, measuredValue));
    } else if (blueprint.type === 'vibration') {
      measuredValue = Math.max(0, Math.min(10, measuredValue));
    } else if (blueprint.type === 'current') {
      measuredValue = Math.max(0, Math.min(150, measuredValue));
    } else if (blueprint.type === 'dust') {
      measuredValue = Math.max(0, Math.min(500, measuredValue));
    }

    const prevValue = prev?.value ?? measuredValue;
    const rateOfChange = (measuredValue - prevValue) / SIMULATION_MINUTES_PER_TICK;
    const trendLimitPerMinute = 0.35 / SIMULATION_MINUTES_PER_TICK;
    const trend: 'rising' | 'stable' | 'falling' =
      rateOfChange > trendLimitPerMinute
        ? 'rising'
        : rateOfChange < -trendLimitPerMinute
        ? 'falling'
        : 'stable';

    const health = calculateSensorHealth(status, config.sensorNoise);

    return {
      id: blueprint.id,
      name: blueprint.name,
      type: blueprint.type,
      zone: blueprint.zone,
      x: blueprint.x,
      y: blueprint.y,
      unit: SENSOR_UNITS[blueprint.type],
      status,
      health,
      value: status === 'offline' ? (prev?.value ?? 0) : measuredValue,
      displayValue: formatSensorValue(blueprint.type, measuredValue, status),
      rawPhysicsValue: rawValue,
      trend,
      rateOfChange,
      lastSeenTick: status === 'offline' ? (prev?.lastSeenTick ?? 0) : tick,
    };
  });
}

/**
 * 1. MINE CONVEYOR DOMAIN MODEL
 * Continuous belt, idler rollers, drive pulley station, ventilation duct, suppression header.
 */
export class MineConveyorModel implements DomainProcessModel {
  readonly profile = 'mine-conveyor' as const;
  readonly name = 'Mine Conveyor Gallery';
  readonly description = 'Subsurface or overland belt conveyor with gallery airflow, idler rollers, and drive head.';

  getHotspotPreset(submode: TransitSubmode, scenario: string) {
    if (scenario === 'belt-friction') {
      return { zone: 'Drive & Roller Gallery', x: 68, y: 55, radius: 18 };
    }
    return { zone: 'Transfer Chute Point', x: 44, y: 32, radius: 22 };
  }

  calculateState(
    config: SimulationConfig,
    tick: number,
    activePhase?: TestCasePhase
  ): ProcessState {
    const weather = WEATHER_PROFILES[config.weather];
    const modifiers = activePhase?.modifiers ?? {};

    const load = Math.max(0, Math.min(100, config.load));
    const moisture = Math.max(0, Math.min(100, config.moisture + (modifiers.moistureShift ?? 0)));
    const compaction = Math.max(0, Math.min(100, config.compaction));
    const ventilation = Math.max(0, Math.min(100, config.ventilation + (modifiers.ventilationShift ?? 0)));

    const timeProgress = Math.min(1.5, Math.pow(Math.max(0, tick) / 38, 1.35));
    const responseTicks = Math.max(0, tick - config.responseSince);

    let responseCooling = 0;
    let responseLoadReduction = 0;
    if (config.response === 'cool') {
      responseCooling = Math.min(1.0, responseTicks / 10) * 18.0;
    } else if (config.response === 'stop') {
      responseCooling = Math.min(1.0, responseTicks / 8) * 22.0;
      responseLoadReduction = Math.min(1.0, responseTicks / 6) * 0.90;
    } else if (config.response === 'inspect') {
      responseCooling = 1.0;
    }

    const sprayCooling = config.sprayAvailable ? (weather.steamPropensity > 0.5 ? 9.0 : 13.0) : 0;
    const galleryAirflowCooling = (ventilation / 100) * 10.0 * weather.convectiveCoolingRate;
    const totalCooling = (responseCooling + sprayCooling + galleryAirflowCooling);

    let heatSource = 0;
    let gasSource = 0;
    let frictionSource = 0;
    let dustSource = 0;

    const effectiveLoad = load * (1 - responseLoadReduction);

    switch (config.scenario) {
      case 'belt-friction': {
        // Seized roller or belt slippage generates high friction and mechanical heat
        frictionSource = (18 + 58 * timeProgress) * (modifiers.friction ?? 1.0) * (1 - responseLoadReduction);
        heatSource = frictionSource * 0.70 * (modifiers.heat ?? 1.0);
        gasSource = (3 + 8 * timeProgress) * (modifiers.gas ?? 1.0); // low CO signature for pure friction
        dustSource = 20 + 35 * (effectiveLoad / 100);
        break;
      }
      case 'self-heating': {
        const selfHeatingRate = (9 + 38 * Math.pow(timeProgress, 1.3)) * (modifiers.heat ?? 1.0);
        const retention = (compaction / 100) * 12.0 * (modifiers.retained ?? 1.0);
        const moistureDamp = Math.max(0, (moisture - 38) * 0.14);
        heatSource = (selfHeatingRate + retention - moistureDamp) * weather.heatRetention;
        gasSource = (6 + 50 * Math.pow(timeProgress, 1.25)) * (modifiers.gas ?? 1.0);
        frictionSource = 1.5 + (effectiveLoad / 100) * 3.0;
        dustSource = 16 + 42 * (effectiveLoad / 100);
        break;
      }
      case 'dust-steam': {
        dustSource = (65 + 45 * Math.sin(tick * 0.45) * Math.sin(tick * 0.45)) * (modifiers.dust ?? 1.0);
        heatSource = 3.5 * (modifiers.heat ?? 1.0);
        gasSource = 3.0 * (modifiers.gas ?? 1.0);
        frictionSource = 2.0;
        break;
      }
      default: {
        heatSource = 2.0 + (effectiveLoad / 100) * 4.5;
        gasSource = 3.0;
        frictionSource = 1.0 + (effectiveLoad / 100) * 2.5;
        dustSource = 14 + 36 * (effectiveLoad / 100);
        break;
      }
    }

    const netHeat = Math.max(0, Math.min(100, heatSource - totalCooling * 0.38));
    const bulkElevation = Math.max(0, Math.min(80, netHeat * 0.76 + (effectiveLoad / 100) * 5.0));
    const surfaceSuppression = (config.sprayAvailable || config.weather === 'rainy') ? (moisture / 100) * 12.0 : 0;
    const surfaceElevation = Math.max(0, bulkElevation - surfaceSuppression);

    const preset = this.getHotspotPreset(config.submode, config.scenario);
    const hotspotIntensity = Math.min(100, Math.max(0, netHeat * 1.18));

    // Gallery airflow enhances CO dispersion
    const airflowMs = Math.max(0.4, Math.min(5.5, weather.airflow * 1.6 * (ventilation / 100 + 0.25)));
    const dispersion = (airflowMs / 5.5) * 0.42;
    const netCo = Math.max(2.0, Math.min(160.0, gasSource * (1.0 - dispersion) + netHeat * 0.26));

    // Mechanical vibration (g) and motor current (% of rating)
    const vibrationG = Math.max(0.12, Math.min(5.8, 0.22 + frictionSource * 0.075 + (effectiveLoad / 100) * 0.18));
    const runningMotorBaseline = 50 * (1 - responseLoadReduction);
    const motorCurrentPct = Math.max(8, Math.min(125, runningMotorBaseline + effectiveLoad * 0.34 + frictionSource * 0.58));
    const sprayDustSuppression = config.sprayAvailable ? 0.55 : 1.0;
    const airborneDustMg = Math.max(5, Math.min(220, dustSource * weather.dustMultiplier * sprayDustSuppression));

    return {
      internalHeat: netHeat,
      surfaceHeat: weather.ambientTemp + surfaceElevation,
      bulkTemperature: weather.ambientTemp + bulkElevation,
      gasConcentration: netCo,
      vibrationLevel: vibrationG,
      motorCurrent: motorCurrentPct,
      airborneDust: airborneDustMg,
      humidity: Math.max(10, Math.min(99, weather.humidity + moisture * 0.20)),
      airflowSpeed: airflowMs,
      hotspot: {
        x: preset.x,
        y: preset.y,
        zone: preset.zone,
        intensity: hotspotIntensity,
        radius: preset.radius,
      },
    };
  }

  deriveSensors(
    blueprints: SensorBlueprint[],
    processState: ProcessState,
    config: SimulationConfig,
    tick: number,
    previousSensors?: SensorNode[]
  ): SensorNode[] {
    return deriveSensorsFromPhysics(blueprints, processState, config, tick, previousSensors);
  }

  explainImpact(
    prevConfig: SimulationConfig,
    nextConfig: SimulationConfig,
    prevState: ProcessState,
    nextState: ProcessState
  ): string {
    return explainGenericImpact('Mine Conveyor', prevConfig, nextConfig, prevState, nextState);
  }
}

/**
 * 2. FACTORY CHP / TRANSFER POINT DOMAIN MODEL
 * Enclosed transfer chute hood, crusher hopper feed, boiler bunker, suppression spray.
 * Blockage affects chute heat, dust, motor current surge, and throughput.
 */
export class FactoryChpModel implements DomainProcessModel {
  readonly profile = 'factory-chp' as const;
  readonly name = 'Factory Combined Heat & Power (CHP)';
  readonly description = 'Enclosed transfer tower with crusher mill, transfer chute hood, boiler bunker infeed, and dust suppression.';

  getHotspotPreset(submode: TransitSubmode, scenario: string) {
    if (scenario === 'transfer-blockage') {
      return { zone: 'Transfer Hood & Chute', x: 48, y: 38, radius: 20 };
    }
    return { zone: 'Bunker Discharge', x: 82, y: 64, radius: 24 };
  }

  calculateState(
    config: SimulationConfig,
    tick: number,
    activePhase?: TestCasePhase
  ): ProcessState {
    const weather = WEATHER_PROFILES[config.weather];
    const modifiers = activePhase?.modifiers ?? {};

    const load = Math.max(0, Math.min(100, config.load));
    const moisture = Math.max(0, Math.min(100, config.moisture + (modifiers.moistureShift ?? 0)));
    const compaction = Math.max(0, Math.min(100, config.compaction));
    const ventilation = Math.max(0, Math.min(100, config.ventilation + (modifiers.ventilationShift ?? 0)));

    const timeProgress = Math.min(1.5, Math.pow(Math.max(0, tick) / 38, 1.35));
    const responseTicks = Math.max(0, tick - config.responseSince);

    let responseCooling = 0;
    let responseLoadReduction = 0;
    if (config.response === 'cool') {
      responseCooling = Math.min(1.0, responseTicks / 10) * 16.0;
    } else if (config.response === 'stop') {
      responseCooling = Math.min(1.0, responseTicks / 8) * 20.0;
      responseLoadReduction = Math.min(1.0, responseTicks / 5) * 0.95;
    }

    const sprayCooling = config.sprayAvailable ? (weather.steamPropensity > 0.5 ? 10.0 : 15.0) : 0;
    const hoodExhaustCooling = (ventilation / 100) * 8.0 * weather.convectiveCoolingRate;
    const totalCooling = responseCooling + sprayCooling + hoodExhaustCooling;

    let heatSource = 0;
    let gasSource = 0;
    let frictionSource = 0;
    let dustSource = 0;

    const effectiveLoad = load * (1 - responseLoadReduction);

    switch (config.scenario) {
      case 'transfer-blockage': {
        // Severe coal jamming in transfer chute: high motor current surge, chute friction, heavy dust
        const blockageLevel = (15 + 48 * timeProgress) * (modifiers.blockage ?? 1.0) * (1 - responseLoadReduction);
        frictionSource = blockageLevel * 0.92;
        heatSource = blockageLevel * 0.78 * (modifiers.heat ?? 1.0);
        dustSource = (40 + 45 * timeProgress) * (modifiers.dust ?? 1.0);
        gasSource = (4 + 12 * timeProgress) * (modifiers.gas ?? 1.0);
        break;
      }
      case 'belt-friction': {
        frictionSource = (16 + 50 * timeProgress) * (modifiers.friction ?? 1.0) * (1 - responseLoadReduction);
        heatSource = frictionSource * 0.68;
        gasSource = (3 + 9 * timeProgress);
        dustSource = 25 * (effectiveLoad / 100);
        break;
      }
      case 'self-heating': {
        // Spontaneous heating in stationary bunker coal
        const bunkerHeating = (8 + 35 * Math.pow(timeProgress, 1.3)) * (modifiers.heat ?? 1.0);
        const retention = (compaction / 100) * 15.0;
        heatSource = (bunkerHeating + retention - Math.max(0, (moisture - 40) * 0.12)) * weather.heatRetention;
        gasSource = (6 + 46 * Math.pow(timeProgress, 1.25)) * (modifiers.gas ?? 1.0);
        dustSource = 14 * (effectiveLoad / 100);
        break;
      }
      default: {
        heatSource = 2.0 + (effectiveLoad / 100) * 4.0;
        gasSource = 3.0;
        frictionSource = 1.0 + (effectiveLoad / 100) * 2.2;
        dustSource = 16 * (effectiveLoad / 100);
        break;
      }
    }

    const netHeat = Math.max(0, Math.min(100, heatSource - totalCooling * 0.36));
    const bulkElevation = Math.max(0, Math.min(85, netHeat * 0.80 + (effectiveLoad / 100) * 6.0));
    const surfaceSuppression = (config.sprayAvailable || config.weather === 'rainy') ? (moisture / 100) * 14.0 : 0;
    const surfaceElevation = Math.max(0, bulkElevation - surfaceSuppression);

    const preset = this.getHotspotPreset(config.submode, config.scenario);
    const hotspotIntensity = Math.min(100, Math.max(0, netHeat * 1.2));

    const airflowMs = Math.max(0.3, Math.min(6.0, weather.airflow * 1.5 * (ventilation / 100 + 0.2)));
    const dispersion = (airflowMs / 6.0) * 0.38;
    const netCo = Math.max(2.0, Math.min(150.0, gasSource * (1.0 - dispersion) + netHeat * 0.25));

    // Motor current surges significantly in transfer blockage; cuts off on stop
    const vibrationG = Math.max(0.14, Math.min(6.0, (0.25 + frictionSource * 0.08 + (effectiveLoad / 100) * 0.20) * (1 - responseLoadReduction * 0.75)));
    const runningMotorBaseline = 52 * (1 - responseLoadReduction);
    const motorCurrentPct = Math.max(8, Math.min(130, runningMotorBaseline + effectiveLoad * 0.35 + frictionSource * 0.72));
    const sprayDustSuppression = config.sprayAvailable ? 0.50 : 1.0;
    const airborneDustMg = Math.max(6, Math.min(250, (18 + dustSource) * weather.dustMultiplier * sprayDustSuppression));

    return {
      internalHeat: netHeat,
      surfaceHeat: weather.ambientTemp + surfaceElevation,
      bulkTemperature: weather.ambientTemp + bulkElevation,
      gasConcentration: netCo,
      vibrationLevel: vibrationG,
      motorCurrent: motorCurrentPct,
      airborneDust: airborneDustMg,
      humidity: Math.max(10, Math.min(99, weather.humidity + moisture * 0.25)),
      airflowSpeed: airflowMs,
      hotspot: {
        x: preset.x,
        y: preset.y,
        zone: preset.zone,
        intensity: hotspotIntensity,
        radius: preset.radius,
      },
    };
  }

  deriveSensors(
    blueprints: SensorBlueprint[],
    processState: ProcessState,
    config: SimulationConfig,
    tick: number,
    previousSensors?: SensorNode[]
  ): SensorNode[] {
    return deriveSensorsFromPhysics(blueprints, processState, config, tick, previousSensors);
  }

  explainImpact(
    prevConfig: SimulationConfig,
    nextConfig: SimulationConfig,
    prevState: ProcessState,
    nextState: ProcessState
  ): string {
    return explainGenericImpact('Factory CHP', prevConfig, nextConfig, prevState, nextState);
  }
}

/**
 * 3. STOCKPILE YARD DOMAIN MODEL
 * Deep internal core probes vs surface thermal infrared scanning.
 * Rain / surface moisture cools the surface, but internal core heat remains elevated.
 */
export class StockpileModel implements DomainProcessModel {
  readonly profile = 'stockpile' as const;
  readonly name = 'Open Stockpile Yard';
  readonly description = 'Outdoor bulk coal mounds with deep multi-depth probe lances, surface infrared survey, and weather exposure.';

  getHotspotPreset() {
    return { zone: 'Pile B Internal Core', x: 62, y: 48, radius: 28 };
  }

  calculateState(
    config: SimulationConfig,
    tick: number,
    activePhase?: TestCasePhase
  ): ProcessState {
    const weather = WEATHER_PROFILES[config.weather];
    const modifiers = activePhase?.modifiers ?? {};

    const load = Math.max(0, Math.min(100, config.load)); // pile volume
    const moisture = Math.max(0, Math.min(100, config.moisture + (modifiers.moistureShift ?? 0)));
    const compaction = Math.max(0, Math.min(100, config.compaction));
    const ventilation = Math.max(0, Math.min(100, config.ventilation + (modifiers.ventilationShift ?? 0)));

    const timeProgress = Math.min(1.5, Math.pow(Math.max(0, tick) / 38, 1.35));
    const responseTicks = Math.max(0, tick - config.responseSince);

    let responseCooling = 0;
    if (config.response === 'cool') {
      responseCooling = Math.min(1.0, responseTicks / 10) * 12.0; // water cannons reach surface, poor core penetration
    } else if (config.response === 'stop') {
      responseCooling = 2.0; // stopping stacking stops further heat addition
    }

    // Yard wind cooling primarily hits the surface of the pile
    const windCooling = (ventilation / 100) * 6.0 * weather.airflow;
    const totalSurfaceCooling = responseCooling + windCooling;
    void totalSurfaceCooling;

    // Oxidation kinetics inside compacted pile
    let heatSource = 0;
    let gasSource = 0;

    switch (config.scenario) {
      case 'hidden-hotspot':
      case 'self-heating': {
        // Deep self-heating accelerated by compaction and heat retention
        const baseOxidation = (12 + 42 * Math.pow(timeProgress, 1.2)) * (modifiers.heat ?? 1.0);
        const insulationRetention = (compaction / 100) * 20.0 * (modifiers.retained ?? 1.0);
        heatSource = (baseOxidation + insulationRetention) * weather.heatRetention;
        gasSource = (8 + 52 * Math.pow(timeProgress, 1.2)) * (modifiers.gas ?? 1.0);
        break;
      }
      default: {
        heatSource = 3.0 + (compaction / 100) * 6.0;
        gasSource = 3.5;
        break;
      }
    }

    // Core heat accumulates deeply because coal is an excellent thermal insulator
    const coreHeat = Math.max(0, Math.min(100, heatSource - responseCooling * 0.15));
    const coreTemperatureElevation = coreHeat * 0.85;

    // Surface heat: heavily dampened by rain, surface moisture, and convective wind
    let surfaceDamping = 0;
    if (config.weather === 'rainy') {
      surfaceDamping = 22.0 + (moisture / 100) * 12.0;
    } else if (config.sprayAvailable) {
      surfaceDamping = 16.0 + (moisture / 100) * 8.0;
    } else {
      surfaceDamping = (moisture / 100) * 10.0;
    }

    const surfaceElevation = Math.max(0, coreTemperatureElevation * 0.35 - surfaceDamping);

    const preset = this.getHotspotPreset();
    const hotspotIntensity = Math.min(100, Math.max(0, coreHeat * 1.15));

    // CO gas slowly seeps out from deep core to surface
    const airflowMs = Math.max(0.5, Math.min(9.0, weather.airflow * 2.2 * (ventilation / 100 + 0.3)));
    const windDispersion = (airflowMs / 9.0) * 0.5;
    const netCo = Math.max(2.0, Math.min(140.0, gasSource * (1.0 - windDispersion) + coreHeat * 0.22));

    // Stockpile mechanical vibration is low (yard equipment only)
    const vibrationG = Math.max(0.08, Math.min(1.2, 0.12 + (load / 100) * 0.08));
    const motorCurrentPct = Math.max(10, Math.min(85, 35 + (load / 100) * 25));
    const dustMg = Math.max(4, Math.min(180, (15 + (load / 100) * 12) * weather.dustMultiplier - (config.weather === 'rainy' ? 20 : 0)));

    return {
      internalHeat: coreHeat,
      surfaceHeat: weather.ambientTemp + surfaceElevation,
      bulkTemperature: weather.ambientTemp + coreTemperatureElevation,
      gasConcentration: netCo,
      vibrationLevel: vibrationG,
      motorCurrent: motorCurrentPct,
      airborneDust: dustMg,
      humidity: Math.max(10, Math.min(99, weather.humidity + moisture * 0.30)),
      airflowSpeed: airflowMs,
      hotspot: {
        x: preset.x,
        y: preset.y,
        zone: preset.zone,
        intensity: hotspotIntensity,
        radius: preset.radius,
      },
    };
  }

  deriveSensors(
    blueprints: SensorBlueprint[],
    processState: ProcessState,
    config: SimulationConfig,
    tick: number,
    previousSensors?: SensorNode[]
  ): SensorNode[] {
    // For stockpile: distinguish deep probe lance sensors (measure core bulk temperature)
    // from surface thermal pyrometers (measure surface temperature)
    return deriveSensorsFromPhysics(
      blueprints,
      processState,
      config,
      tick,
      previousSensors,
      (bp, local) => {
        if (bp.id.includes('probe') || bp.id.includes('internal') || bp.name.toLowerCase().includes('core') || bp.name.toLowerCase().includes('depth')) {
          // Deep lance probe measures internal core heat
          const distFromHotspot = Math.sqrt(
            Math.pow(bp.x - processState.hotspot.x, 2) + Math.pow(bp.y - processState.hotspot.y, 2)
          );
          const proximity = Math.exp(-distFromHotspot / 30);
          return processState.bulkTemperature + (processState.internalHeat * 0.35) * proximity;
        }
        if (bp.type === 'temperature' || bp.type === 'thermal') {
          return local.temperature;
        }
        if (bp.type === 'co') return local.co;
        if (bp.type === 'vibration') return local.vibration;
        if (bp.type === 'current') return processState.motorCurrent;
        if (bp.type === 'dust') return local.dust;
        if (bp.type === 'wind') return processState.airflowSpeed;
        return local.temperature;
      }
    );
  }

  explainImpact(
    prevConfig: SimulationConfig,
    nextConfig: SimulationConfig,
    prevState: ProcessState,
    nextState: ProcessState
  ): string {
    if (prevConfig.moisture !== nextConfig.moisture || prevConfig.weather !== nextConfig.weather) {
      const surfaceDelta = (nextState.surfaceHeat - prevState.surfaceHeat).toFixed(1);
      const coreDelta = (nextState.internalHeat - prevState.internalHeat).toFixed(1);
      return `Stockpile moisture/weather adjusted: surface cooled by ${Math.abs(Number(surfaceDelta))} °C (core delta ${coreDelta}), but deep internal core heat remains elevated at ${nextState.bulkTemperature.toFixed(1)} °C (hidden hotspot phenomenon).`;
    }
    return explainGenericImpact('Stockpile Yard', prevConfig, nextConfig, prevState, nextState);
  }
}

/**
 * 4. ROAD AND RAIL TRANSIT DOMAIN MODEL
 * Truck: Tipper bed, tarp cover, high road bump vibration, trapped gas/heat, low airflow.
 * Rail: Open-top hopper car, cyclic bogie vibration, high transit slipstream wind, sidewall dissipation.
 */
export class TransitModel implements DomainProcessModel {
  readonly profile = 'transit' as const;
  readonly name = 'Road & Rail Coal Transit';
  readonly description = 'Bulk coal transportation via road tipper trucks (tarped) or unit train hopper cars (slipstream airflow).';

  getHotspotPreset(submode: TransitSubmode) {
    if (submode === 'rail-wagon') {
      return { zone: 'Hopper Car 2 Center Well', x: 52, y: 45, radius: 22 };
    }
    return { zone: 'Truck Tipper Cargo Midsection', x: 50, y: 52, radius: 20 };
  }

  calculateState(
    config: SimulationConfig,
    tick: number,
    activePhase?: TestCasePhase
  ): ProcessState {
    const isRail = config.submode === 'rail-wagon';
    const weather = WEATHER_PROFILES[config.weather];
    const modifiers = activePhase?.modifiers ?? {};

    const load = Math.max(0, Math.min(100, config.load));
    const moisture = Math.max(0, Math.min(100, config.moisture + (modifiers.moistureShift ?? 0)));
    const compaction = Math.max(0, Math.min(100, config.compaction));
    const ventilation = Math.max(0, Math.min(100, config.ventilation + (modifiers.ventilationShift ?? 0)));

    const timeProgress = Math.min(1.5, Math.pow(Math.max(0, tick) / 38, 1.35));
    const responseTicks = Math.max(0, tick - config.responseSince);

    let responseCooling = 0;
    if (config.response === 'cool') {
      responseCooling = Math.min(1.0, responseTicks / 10) * 14.0;
    } else if (config.response === 'stop') {
      // Stopping transit removes slipstream airflow for rail, but removes engine vibration for truck
      responseCooling = isRail ? -2.0 : 4.0;
    }

    // DIFFERENCE 1: Airflow and Enclosure
    // Rail: Train motion creates massive aerodynamic slipstream airflow across the open hopper
    // Truck: Covered by tarp; interior airflow is very low
    let airflowMs = 0;
    let convectiveCooling = 0;
    let gasRetention = 1.0;

    if (isRail) {
      airflowMs = Math.max(1.8, Math.min(7.5, 2.5 + weather.airflow * 1.8 * (ventilation / 100 + 0.3)));
      convectiveCooling = (airflowMs / 7.5) * 14.0;
      gasRetention = 0.65; // open car disperses CO into slipstream
    } else {
      // Truck: tarp traps air and gas
      airflowMs = Math.max(0.2, Math.min(2.0, 0.4 + (ventilation / 100) * 0.8));
      convectiveCooling = (airflowMs / 2.0) * 4.0;
      gasRetention = 1.35; // tarp traps CO inside cargo bed
    }

    // Heat generation from transit dwell time and coal self-heating
    let heatSource = 0;
    let gasSource = 0;

    switch (config.scenario) {
      case 'self-heating':
      case 'hidden-hotspot': {
        const dwellHeating = (10 + 40 * Math.pow(timeProgress, 1.25)) * (modifiers.heat ?? 1.0);
        const bedCompaction = (compaction / 100) * (isRail ? 12.0 : 18.0);
        heatSource = (dwellHeating + bedCompaction) * (isRail ? 0.9 : 1.25);
        gasSource = (7 + 45 * Math.pow(timeProgress, 1.2)) * (modifiers.gas ?? 1.0);
        break;
      }
      default: {
        heatSource = 3.0 + (load / 100) * 4.0;
        gasSource = 3.5;
        break;
      }
    }

    const netHeat = Math.max(0, Math.min(100, heatSource - (convectiveCooling + responseCooling) * 0.35));
    const bulkElevation = Math.max(0, Math.min(80, netHeat * 0.78));
    const surfaceSuppression = (config.weather === 'rainy' || config.sprayAvailable) ? (moisture / 100) * 12.0 : 0;
    const surfaceElevation = Math.max(0, bulkElevation - surfaceSuppression);

    const preset = this.getHotspotPreset(config.submode);
    const hotspotIntensity = Math.min(100, Math.max(0, netHeat * 1.15));

    // CO ppm inside/above vehicle
    const netCo = Math.max(2.0, Math.min(160.0, gasSource * gasRetention + netHeat * 0.24));

    // DIFFERENCE 2: Mechanical Vibration
    // Truck: suspension bumps and highway rumble (0.6 - 1.8 g)
    // Rail: rail joint clicks and bogie roll (0.25 - 0.75 g)
    let vibrationG = 0;
    if (isRail) {
      vibrationG = Math.max(0.20, Math.min(1.5, 0.32 + (load / 100) * 0.18));
    } else {
      vibrationG = Math.max(0.40, Math.min(3.2, 0.65 + (load / 100) * 0.45));
    }

    const motorCurrentPct = isRail ? 45 + (load / 100) * 20 : 60 + (load / 100) * 30;
    const dustMg = Math.max(5, Math.min(200, (isRail ? 28 : 12) * weather.dustMultiplier * (load / 100)));

    return {
      internalHeat: netHeat,
      surfaceHeat: weather.ambientTemp + surfaceElevation,
      bulkTemperature: weather.ambientTemp + bulkElevation,
      gasConcentration: netCo,
      vibrationLevel: vibrationG,
      motorCurrent: motorCurrentPct,
      airborneDust: dustMg,
      humidity: Math.max(10, Math.min(99, weather.humidity + moisture * 0.22)),
      airflowSpeed: airflowMs,
      hotspot: {
        x: preset.x,
        y: preset.y,
        zone: preset.zone,
        intensity: hotspotIntensity,
        radius: preset.radius,
      },
    };
  }

  deriveSensors(
    blueprints: SensorBlueprint[],
    processState: ProcessState,
    config: SimulationConfig,
    tick: number,
    previousSensors?: SensorNode[]
  ): SensorNode[] {
    return deriveSensorsFromPhysics(blueprints, processState, config, tick, previousSensors);
  }

  explainImpact(
    prevConfig: SimulationConfig,
    nextConfig: SimulationConfig,
    prevState: ProcessState,
    nextState: ProcessState
  ): string {
    if (prevConfig.submode !== nextConfig.submode) {
      const isRail = nextConfig.submode === 'rail-wagon';
      return isRail
        ? `Switched to Unit Train Rail Wagon: slipstream airflow increased to ${nextState.airflowSpeed.toFixed(1)} m/s; open hopper accelerates CO dispersion; bogie vibration is cyclic.`
        : `Switched to Road Tipper Truck: tarp cover traps heat and gas (CO rose to ${nextState.gasConcentration.toFixed(1)} ppm); road vibration increased to ${nextState.vibrationLevel.toFixed(2)} g.`;
    }
    return explainGenericImpact(`Transit (${nextConfig.submode})`, prevConfig, nextConfig, prevState, nextState);
  }
}

/**
 * 5. SHIP CARGO HOLD DOMAIN MODEL
 * Enclosed airtight bulk cargo hold #2.
 * Restricted ventilation, deep bilge boundary heat, consistent gas kinetics:
 * Oxygen depletion (O2 drops as oxidation proceeds) and trapped CO/CH4 accumulation.
 */
export class CargoHoldModel implements DomainProcessModel {
  readonly profile = 'cargo-hold' as const;
  readonly name = 'Ship Bulk Cargo Hold';
  readonly description = 'Enclosed marine cargo hold with sealed hatch coamings, lower bilge boundaries, restricted ventilation, and gas accumulation.';

  getHotspotPreset() {
    return { zone: 'Hold #2 Deep Bilge Boundary', x: 50, y: 68, radius: 26 };
  }

  calculateState(
    config: SimulationConfig,
    tick: number,
    activePhase?: TestCasePhase
  ): ProcessState {
    const weather = WEATHER_PROFILES[config.weather];
    const modifiers = activePhase?.modifiers ?? {};

    const load = Math.max(0, Math.min(100, config.load));
    const moisture = Math.max(0, Math.min(100, config.moisture + (modifiers.moistureShift ?? 0)));
    const compaction = Math.max(0, Math.min(100, config.compaction));
    const ventilation = Math.max(0, Math.min(100, config.ventilation + (modifiers.ventilationShift ?? 0)));

    const timeProgress = Math.min(1.5, Math.pow(Math.max(0, tick) / 38, 1.35));
    const responseTicks = Math.max(0, tick - config.responseSince);

    let responseCooling = 0;
    if (config.response === 'cool') {
      // In cargo hold, water injection into closed hold is risky but provides localized cooling
      responseCooling = Math.min(1.0, responseTicks / 10) * 10.0;
    } else if (config.response === 'stop') {
      responseCooling = 1.0;
    }

    // In a sealed ship hold, natural ventilation is nearly zero (0.1 - 0.4 m/s)
    // Only forced mechanical hatch fans (ventilation slider) provide air exchange
    const airflowMs = Math.max(0.1, Math.min(3.2, 0.15 + (ventilation / 100) * 2.8));
    const airExchangeCooling = (ventilation / 100) * 5.0;

    // Sealed hold retains deep heat tightly
    const holdInsulationFactor = 1.45;
    let heatSource = 0;
    let gasSource = 0;

    switch (config.scenario) {
      case 'hold-asphyxiation':
      case 'self-heating': {
        const smolderRate = (12 + 45 * Math.pow(timeProgress, 1.25)) * (modifiers.heat ?? 1.0);
        const deepCompaction = (compaction / 100) * 16.0;
        heatSource = (smolderRate + deepCompaction) * holdInsulationFactor;
        // In confined hold, CO accumulates aggressively
        gasSource = (14 + 75 * Math.pow(timeProgress, 1.2)) * (modifiers.gas ?? 1.0);
        break;
      }
      default: {
        heatSource = 3.5 + (compaction / 100) * 5.0;
        gasSource = 4.0;
        break;
      }
    }

    const netHeat = Math.max(0, Math.min(100, heatSource - (airExchangeCooling + responseCooling) * 0.3));
    const bulkElevation = Math.max(0, Math.min(90, netHeat * 0.88));
    const surfaceElevation = Math.max(0, bulkElevation * 0.45);

    const preset = this.getHotspotPreset();
    const hotspotIntensity = Math.min(100, Math.max(0, netHeat * 1.25));

    // CO accumulation in enclosed hold
    // Mechanical hatch ventilation dispenses some gas, but hold remains hazardous
    const hatchDispersion = (ventilation / 100) * 0.35;
    const netCo = Math.max(3.0, Math.min(180.0, gasSource * (1.0 - hatchDispersion) + netHeat * 0.32));

    // Ship vibration from main engine propulsion
    const vibrationG = Math.max(0.10, Math.min(1.2, 0.18 + (load / 100) * 0.10));
    const motorCurrentPct = Math.max(10, Math.min(75, 40));
    const dustMg = Math.max(4, Math.min(120, 10 + (load / 100) * 8));

    return {
      internalHeat: netHeat,
      surfaceHeat: weather.ambientTemp + surfaceElevation,
      bulkTemperature: weather.ambientTemp + bulkElevation,
      gasConcentration: netCo,
      vibrationLevel: vibrationG,
      motorCurrent: motorCurrentPct,
      airborneDust: dustMg,
      humidity: Math.max(10, Math.min(99, weather.humidity + moisture * 0.25)),
      airflowSpeed: airflowMs,
      hotspot: {
        x: preset.x,
        y: preset.y,
        zone: preset.zone,
        intensity: hotspotIntensity,
        radius: preset.radius,
      },
    };
  }

  deriveSensors(
    blueprints: SensorBlueprint[],
    processState: ProcessState,
    config: SimulationConfig,
    tick: number,
    previousSensors?: SensorNode[]
  ): SensorNode[] {
    // Ship hold includes specialized O2 depletion and CH4 explosive gas sensors
    return deriveSensorsFromPhysics(
      blueprints,
      processState,
      config,
      tick,
      previousSensors,
      (bp, local) => {
        if (bp.type === 'o2') {
          // As oxidation consumes oxygen in closed hold, O2 drops from 20.9% down to 13-15%
          const o2Drop = (processState.internalHeat * 0.05) + (processState.gasConcentration * 0.04);
          return Math.max(12.5, Math.min(20.9, 20.9 - o2Drop));
        }
        if (bp.type === 'methane') {
          // Methane gas accumulation (% LEL)
          return Math.max(0, Math.min(35.0, (processState.gasConcentration * 0.12) - 0.4));
        }
        if (bp.type === 'co') return local.co;
        if (bp.type === 'temperature' || bp.type === 'thermal') return local.temperature;
        if (bp.type === 'vibration') return local.vibration;
        if (bp.type === 'current') return processState.motorCurrent;
        if (bp.type === 'dust') return local.dust;
        if (bp.type === 'wind') return processState.airflowSpeed;
        return local.temperature;
      }
    );
  }

  explainImpact(
    prevConfig: SimulationConfig,
    nextConfig: SimulationConfig,
    prevState: ProcessState,
    nextState: ProcessState
  ): string {
    if (prevConfig.ventilation !== nextConfig.ventilation) {
      const deltaVent = nextConfig.ventilation - prevConfig.ventilation;
      return deltaVent > 0
        ? `Hold mechanical blower ventilation increased: airflow rose to ${nextState.airflowSpeed.toFixed(1)} m/s; toxic CO gas purged from ${prevState.gasConcentration.toFixed(1)} to ${nextState.gasConcentration.toFixed(1)} ppm.`
        : `Hold ventilation sealed: natural air exchange dropped to ${nextState.airflowSpeed.toFixed(1)} m/s; CO gas accumulating in airtight hold (${nextState.gasConcentration.toFixed(1)} ppm).`;
    }
    return explainGenericImpact('Ship Cargo Hold', prevConfig, nextConfig, prevState, nextState);
  }
}

/**
 * Domain Model Registry
 */
const DOMAIN_MODELS: Record<EnvironmentProfile, DomainProcessModel> = {
  'mine-conveyor': new MineConveyorModel(),
  'factory-chp': new FactoryChpModel(),
  stockpile: new StockpileModel(),
  transit: new TransitModel(),
  'cargo-hold': new CargoHoldModel(),
};

export function getDomainModel(profile: EnvironmentProfile): DomainProcessModel {
  return DOMAIN_MODELS[profile] ?? DOMAIN_MODELS['mine-conveyor'];
}

/**
 * Unified causal impact explanation generator.
 * Produces honest, exact deltas of what changed physically and sensor-wise.
 */
export function explainGenericImpact(
  contextName: string,
  prevConfig: SimulationConfig,
  nextConfig: SimulationConfig,
  prevState: ProcessState,
  nextState: ProcessState
): string {
  // Check which parameter changed
  if (prevConfig.load !== nextConfig.load) {
    const curDiff = (nextState.motorCurrent - prevState.motorCurrent).toFixed(0);
    const dustDiff = (nextState.airborneDust - prevState.airborneDust).toFixed(0);
    return `${contextName} coal load adjusted (${prevConfig.load}% → ${nextConfig.load}%): motor current changed by ${curDiff}% (${nextState.motorCurrent.toFixed(0)}% load), dust emission changed by ${dustDiff} mg/m³.`;
  }

  if (prevConfig.ventilation !== nextConfig.ventilation) {
    const flowDiff = (nextState.airflowSpeed - prevState.airflowSpeed).toFixed(1);
    const coDiff = (nextState.gasConcentration - prevState.gasConcentration).toFixed(1);
    return `${contextName} ventilation adjusted (${prevConfig.ventilation}% → ${nextConfig.ventilation}%): airflow speed changed by ${flowDiff} m/s; CO gas dispersion changed CO by ${coDiff} ppm.`;
  }

  if (prevConfig.moisture !== nextConfig.moisture) {
    const surfDiff = (nextState.surfaceHeat - prevState.surfaceHeat).toFixed(1);
    return `${contextName} moisture adjusted (${prevConfig.moisture}% → ${nextConfig.moisture}%): surface temperature shifted by ${surfDiff} °C; internal heat remains at ${nextState.internalHeat.toFixed(1)}.`;
  }

  if (prevConfig.compaction !== nextConfig.compaction) {
    const heatDiff = (nextState.internalHeat - prevState.internalHeat).toFixed(1);
    return `${contextName} compaction adjusted (${prevConfig.compaction}% → ${nextConfig.compaction}%): thermal insulation and heat retention shifted core heat by ${heatDiff}.`;
  }

  if (prevConfig.weather !== nextConfig.weather) {
    return `${contextName} weather changed to ${nextConfig.weather}: ambient temperature is ${nextState.surfaceHeat.toFixed(1)} °C, humidity is ${nextState.humidity.toFixed(0)}%.`;
  }

  if (prevConfig.sensorNoise !== nextConfig.sensorNoise) {
    return `Sensor measurement noise floor adjusted (${prevConfig.sensorNoise}% → ${nextConfig.sensorNoise}%): reading jitter and dispersion increased; physical process state unchanged.`;
  }

  if (prevConfig.sensorDropout !== nextConfig.sensorDropout) {
    return `Sensor network dropout rate adjusted (${prevConfig.sensorDropout}% → ${nextConfig.sensorDropout}%): node availability and telemetry confidence reduced; physical heat unchanged.`;
  }

  if (prevConfig.sprayAvailable !== nextConfig.sprayAvailable) {
    return nextConfig.sprayAvailable
      ? `Water spray suppression activated: surface cooling initiated, dust reduced to ${nextState.airborneDust.toFixed(0)} mg/m³.`
      : `Water spray suppression deactivated: surface cooling ceased, dust rose to ${nextState.airborneDust.toFixed(0)} mg/m³.`;
  }

  if (prevConfig.response !== nextConfig.response) {
    return `Operator response set to ${nextConfig.response.toUpperCase()}: action logged in event history; process mitigation active.`;
  }

  return `${contextName} operating equilibrium recalculated.`;
}
