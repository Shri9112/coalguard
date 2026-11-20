/**
 * CoalGuard - Sensor Network Simulation
 * Deterministic spatial reading synthesis, sensor noise, drift,
 * dropout, staleness, and mobile thermal inspection rover.
 *
 * Delegates profile-specific sensor derivation to dedicated domain models.
 */

import {
  InspectionUnit,
  ProcessState,
  SensorBlueprint,
  SensorNode,
  SimulationConfig,
} from '../types';
import { getDomainModel } from './domain-models';
import { calculateLocalStateAt } from './process-model';

export {
  calculateSensorHealth,
  determineSensorStatus,
  formatSensorValue,
  mulberry32,
  SENSOR_UNITS,
} from './sensor-utils';

/**
 * Generate full sensor readings from spatial process state and fault injection,
 * delegating domain-specific derivations to the active domain model.
 */
export function updateSensors(
  blueprints: SensorBlueprint[],
  processState: ProcessState,
  config: SimulationConfig,
  tick: number,
  previousSensors?: SensorNode[]
): SensorNode[] {
  const model = getDomainModel(config.profile);
  return model.deriveSensors(blueprints, processState, config, tick, previousSensors);
}

/**
 * Mobile inspection unit simulation.
 * Moves toward the active hazard zone and samples modeled temperature/gas at its current coordinates.
 */
export function updateInspectionUnit(
  previousUnit: InspectionUnit | undefined,
  targetZone: string,
  targetCoords: { x: number; y: number },
  processState: ProcessState,
  action: string
): InspectionUnit {
  const current = previousUnit ?? {
    id: 'rover-alpha',
    label: 'Thermal Survey Rover',
    status: 'docked',
    x: 10,
    y: 85,
    targetZone,
    progress: 0,
    localTemperature: processState.surfaceHeat,
    readingDisplay: `${processState.surfaceHeat.toFixed(1)} °C`,
    findings: 'Docked at maintenance bay. Standing by.',
  };

  if (action === 'inspect') {
    const dx = targetCoords.x - current.x;
    const dy = targetCoords.y - current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 4) {
      const step = 6.0;
      const nx = current.x + (dx / dist) * step;
      const ny = current.y + (dy / dist) * step;
      const progress = Math.min(95, Math.round(current.progress + 15));

      const sampled = calculateLocalStateAt(nx, ny, processState);
      return {
        ...current,
        status: 'en-route',
        x: nx,
        y: ny,
        targetZone,
        progress,
        localTemperature: sampled.temperature,
        readingDisplay: `${sampled.temperature.toFixed(1)} °C`,
        findings: `En route to ${targetZone}. Current localized survey: ${sampled.temperature.toFixed(1)} °C.`,
      };
    } else {
      const sampled = calculateLocalStateAt(targetCoords.x, targetCoords.y, processState);
      const isHot = sampled.temperature > 55;
      return {
        ...current,
        status: 'on-site',
        x: targetCoords.x,
        y: targetCoords.y,
        targetZone,
        progress: 100,
        localTemperature: sampled.temperature,
        readingDisplay: `${sampled.temperature.toFixed(1)} °C (On-Site IR)`,
        findings: isHot
          ? `On-site survey confirmed elevated thermal signature (${sampled.temperature.toFixed(1)} °C) at ${targetZone}.`
          : `On-site survey shows stable local reading (${sampled.temperature.toFixed(1)} °C). No surface flame detected.`,
      };
    }
  }

  // Not inspecting -> stay docked or return
  if (current.status !== 'docked') {
    return {
      ...current,
      status: 'docked',
      x: 10,
      y: 85,
      progress: 0,
      localTemperature: processState.surfaceHeat,
      readingDisplay: `${processState.surfaceHeat.toFixed(1)} °C (Docked)`,
      findings: 'Docked at maintenance bay. Ready for deployment.',
    };
  }

  return current;
}
