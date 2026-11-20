/**
 * CoalGuard - Trends and Sensor Evidence Aggregator
 * Extracts rate-of-rise, rolling trends, and health-weighted sensor evidence.
 */

import { SensorNode, SensorType } from '../types';
import { SIMULATION_MINUTES_PER_TICK } from './constants';

export interface AggregatedEvidence {
  peakTemperature: number;
  averageTemperature: number;
  temperatureRateOfRise: number; // °C per minute
  peakCo: number;
  averageCo: number;
  coRateOfRise: number; // ppm per minute
  peakVibration: number;
  averageMotorCurrent: number;
  peakDust: number;
  overallSensorHealth: number; // 0 to 100%
  offlineSensorCount: number;
  staleSensorCount: number;
  healthySensorCount: number;
  crossSensorAgreement: number; // 0 to 1
  gasTemperatureCorrelation: number; // 0 to 1
}

/**
 * Aggregates live sensor readings into health-weighted evidence metrics.
 * Drops offline sensors from crisp calculations and penalizes degraded sensors.
 */
export function aggregateSensorEvidence(
  sensors: SensorNode[],
  previousSensors?: SensorNode[],
  elapsedMinutes = SIMULATION_MINUTES_PER_TICK
): AggregatedEvidence {
  const getHealthySensors = (type: SensorType) =>
    sensors.filter((s) => s.type === type && s.status !== 'offline');

  const weightedAverage = (list: SensorNode[]) => {
    if (list.length === 0) return 0;
    const totalHealth = list.reduce((sum, s) => sum + s.health, 0);
    if (totalHealth === 0) return list.reduce((sum, s) => sum + s.value, 0) / list.length;
    return list.reduce((sum, s) => sum + s.value * (s.health / 100), 0) / (totalHealth / 100);
  };

  const tempSensors = getHealthySensors('temperature');
  const thermalSensors = getHealthySensors('thermal');
  const allThermal = [...tempSensors, ...thermalSensors];
  const coSensors = getHealthySensors('co');
  const vibSensors = getHealthySensors('vibration');
  const curSensors = getHealthySensors('current');
  const dustSensors = getHealthySensors('dust');

  const avgTemp = weightedAverage(allThermal);
  const peakTemp = allThermal.length > 0 ? Math.max(...allThermal.map((s) => s.value)) : 0;

  const avgCo = weightedAverage(coSensors);
  const peakCo = coSensors.length > 0 ? Math.max(...coSensors.map((s) => s.value)) : 0;

  const peakVib = vibSensors.length > 0 ? Math.max(...vibSensors.map((s) => s.value)) : 0;
  const avgCurrent = weightedAverage(curSensors);
  const peakDust = dustSensors.length > 0 ? Math.max(...dustSensors.map((s) => s.value)) : 0;

  // Rate of rise calculations using previous frame
  let tempRateOfRise = 0;
  let coRateOfRise = 0;

  if (previousSensors && previousSensors.length > 0) {
    const prevThermal = previousSensors.filter(
      (s) => (s.type === 'temperature' || s.type === 'thermal') && s.status !== 'offline'
    );
    const prevCo = previousSensors.filter((s) => s.type === 'co' && s.status !== 'offline');

    if (prevThermal.length > 0 && allThermal.length > 0) {
      const prevAvg = weightedAverage(prevThermal);
      tempRateOfRise = (avgTemp - prevAvg) / Math.max(elapsedMinutes, 0.001);
    }

    if (prevCo.length > 0 && coSensors.length > 0) {
      const prevCoAvg = weightedAverage(prevCo);
      coRateOfRise = (avgCo - prevCoAvg) / Math.max(elapsedMinutes, 0.001);
    }
  }

  // Health statistics
  const totalSensors = sensors.length;
  const offlineCount = sensors.filter((s) => s.status === 'offline').length;
  const staleCount = sensors.filter((s) => s.status === 'stale').length;
  const healthyCount = sensors.filter((s) => s.status === 'online').length;
  const overallHealth =
    totalSensors > 0
      ? Math.round(sensors.reduce((sum, s) => sum + s.health, 0) / totalSensors)
      : 0;

  // Cross-sensor agreement: higher when healthy sensors in the cluster show low variance relative to their mean
  let crossSensorAgreement = tempSensors.length === 0 ? 0 : tempSensors.length === 1 ? 0.75 : 1.0;
  if (tempSensors.length > 1) {
    const mean = tempSensors.reduce((sum, s) => sum + s.value, 0) / tempSensors.length;
    const variance =
      tempSensors.reduce((sum, s) => sum + Math.pow(s.value - mean, 2), 0) / tempSensors.length;
    const stdDev = Math.sqrt(variance);
    // Moderate stdDev is normal for spatial gradients; extreme variance or offline drops agreement
    crossSensorAgreement = Math.max(0.2, Math.min(1.0, 1.0 - (stdDev / 35.0) - (offlineCount * 0.15)));
  }

  // Gas-temperature correlation: whether elevated temperature is accompanied by elevated CO
  // True oxidation exhibits both; pure friction or solar heating has high temp without CO
  const tempElevated = Math.max(0, (avgTemp - 35) / 50);
  const coElevated = Math.max(0, (avgCo - 8) / 40);
  const gasTemperatureCorrelation = Math.max(0.1, 1.0 - Math.abs(tempElevated - coElevated));

  return {
    peakTemperature: peakTemp,
    averageTemperature: avgTemp,
    temperatureRateOfRise: tempRateOfRise,
    peakCo,
    averageCo: avgCo,
    coRateOfRise,
    peakVibration: peakVib,
    averageMotorCurrent: avgCurrent,
    peakDust,
    overallSensorHealth: overallHealth,
    offlineSensorCount: offlineCount,
    staleSensorCount: staleCount,
    healthySensorCount: healthyCount,
    crossSensorAgreement,
    gasTemperatureCorrelation,
  };
}
