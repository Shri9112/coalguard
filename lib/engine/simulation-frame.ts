/**
 * Shared deterministic frame builder used by both the live simulation and its
 * projected trace. Keeping both paths here prevents the chart from drifting
 * away from the values used by sensors and fuzzy inference.
 */

import { getSensorsForProfile } from '../data/profiles';
import { getTestCase } from '../data/test-cases';
import { getTopologyForProfile } from '../data/topologies';
import {
  InspectionUnit,
  PsoTunableParameters,
  SimulationConfig,
  TelemetryFrame,
} from '../types';
import { SIMULATION_MINUTES_PER_TICK } from './constants';
import { runMamdaniInference } from './fuzzy-system';
import { calculateProcessState } from './process-model';
import { updateInspectionUnit, updateSensors } from './sensors';
import { aggregateSensorEvidence } from './trends';

export interface GeneratedFrame {
  frame: TelemetryFrame;
  nextInspection: InspectionUnit;
}

export function generateSimulationFrame(
  tick: number,
  config: SimulationConfig,
  parameters: PsoTunableParameters,
  previousSensors?: TelemetryFrame['sensors'],
  currentInspection?: InspectionUnit,
  brokenEdges: string[] = [],
  deriveTrendFromPreviousTick = true
): GeneratedFrame {
  const testCase = getTestCase(config.testCaseId);
  const activePhase = testCase?.phases.find(
    (phase) => tick >= phase.startTick && tick <= phase.endTick
  );
  const processState = calculateProcessState(config, tick, activePhase);
  const blueprints = getSensorsForProfile(config.profile, config.submode);
  const sensors = updateSensors(blueprints, processState, config, tick, previousSensors);

  // A severed topology link makes only the sensor devices attached to that
  // link unavailable. Physical process values remain unchanged.
  if (brokenEdges.length > 0) {
    const topology = getTopologyForProfile(config.profile);
    const brokenSet = new Set(brokenEdges);
    const severedNodeIds = new Set<string>();
    for (const edge of topology.edges) {
      if (brokenSet.has(edge.id)) {
        severedNodeIds.add(edge.source);
        severedNodeIds.add(edge.target);
      }
    }

    const severedSensorIds = new Set(
      topology.nodes
        .filter((node) => node.role === 'sensor' && node.sensorIdRef && severedNodeIds.has(node.id))
        .map((node) => node.sensorIdRef as string)
    );
    for (const sensor of sensors) {
      if (severedSensorIds.has(sensor.id)) {
        sensor.status = 'offline';
        sensor.health = 0;
        sensor.displayValue = 'OFFLINE';
      }
    }
  }

  const evidence = aggregateSensorEvidence(
    sensors,
    deriveTrendFromPreviousTick ? previousSensors : undefined,
    SIMULATION_MINUTES_PER_TICK
  );
  const risk = runMamdaniInference(evidence, config, sensors, parameters);
  const nextInspection = updateInspectionUnit(
    currentInspection,
    risk.affectedZone,
    processState.hotspot,
    processState,
    config.response
  );

  return {
    frame: {
      tick,
      minutes: Math.round(tick * SIMULATION_MINUTES_PER_TICK * 10) / 10,
      profile: config.profile,
      submode: config.submode,
      ambientTemperature: processState.surfaceHeat,
      humidity: processState.humidity,
      ventilation: config.ventilation,
      load: config.load,
      coalMoisture: config.moisture,
      compaction: config.compaction,
      heatState: processState.internalHeat,
      surfaceHeat: processState.surfaceHeat,
      bulkTemperature: processState.bulkTemperature,
      frictionState: processState.vibrationLevel,
      motorCurrent: processState.motorCurrent,
      gasState: processState.gasConcentration,
      dustState: processState.airborneDust,
      airflowSpeed: processState.airflowSpeed,
      hotspotLocation: processState.hotspot,
      sensors,
      risk,
    },
    nextInspection,
  };
}

/**
 * Projects the active model forward from the current frame. Forecast points
 * are deterministic and use the same sensor, topology, and FIS pipeline as
 * actual ticks; callers should present them as projections, not observations.
 */
export function generateProjectedFrames(
  currentTick: number,
  horizon: number,
  config: SimulationConfig,
  parameters: PsoTunableParameters,
  currentFrame: TelemetryFrame,
  currentInspection: InspectionUnit,
  brokenEdges: string[] = []
): TelemetryFrame[] {
  const testCase = getTestCase(config.testCaseId);
  const remainingCaseTicks = testCase ? Math.max(0, testCase.durationTicks - currentTick) : horizon;
  const projectionLength = Math.max(0, Math.min(Math.floor(horizon), remainingCaseTicks));
  const projected: TelemetryFrame[] = [];
  let previousSensors = currentFrame.sensors;
  let inspection = currentInspection;

  for (let offset = 1; offset <= projectionLength; offset += 1) {
    const { frame, nextInspection } = generateSimulationFrame(
      currentTick + offset,
      config,
      parameters,
      previousSensors,
      inspection,
      brokenEdges
    );
    projected.push(frame);
    previousSensors = frame.sensors;
    inspection = nextInspection;
  }

  return projected;
}
