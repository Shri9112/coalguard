import { WeatherCondition } from '../types';

export const SIMULATION_MINUTES_PER_TICK = 1.5;

export interface WeatherModifiers {
  ambientTemp: number; // °C
  humidity: number; // %
  airflow: number; // relative factor 0.5 to 2.0
  dustMultiplier: number;
  steamPropensity: number;
  heatRetention: number;
  convectiveCoolingRate: number;
}

export const WEATHER_PROFILES: Record<WeatherCondition, WeatherModifiers> = {
  'hot-dry': {
    ambientTemp: 39,
    humidity: 22,
    airflow: 0.85,
    dustMultiplier: 1.35,
    steamPropensity: 0.05,
    heatRetention: 1.25,
    convectiveCoolingRate: 0.75,
  },
  humid: {
    ambientTemp: 32,
    humidity: 78,
    airflow: 0.90,
    dustMultiplier: 0.80,
    steamPropensity: 0.35,
    heatRetention: 1.05,
    convectiveCoolingRate: 0.82,
  },
  rainy: {
    ambientTemp: 24,
    humidity: 92,
    airflow: 0.75,
    dustMultiplier: 0.45,
    steamPropensity: 0.90,
    heatRetention: 0.70,
    convectiveCoolingRate: 1.35,
  },
  cool: {
    ambientTemp: 18,
    humidity: 45,
    airflow: 1.15,
    dustMultiplier: 0.70,
    steamPropensity: 0.05,
    heatRetention: 0.65,
    convectiveCoolingRate: 1.45,
  },
  windy: {
    ambientTemp: 28,
    humidity: 38,
    airflow: 1.55,
    dustMultiplier: 1.45,
    steamPropensity: 0.10,
    heatRetention: 0.85,
    convectiveCoolingRate: 1.25,
  },
};
