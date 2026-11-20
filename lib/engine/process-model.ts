/**
 * CoalGuard - Physics-Inspired Process Model
 * Deterministic heat accumulation, gas generation, mechanical friction,
 * spatial hotspot propagation, and environmental cooling.
 *
 * Delegates profile-specific kinetics to dedicated domain process models:
 * - Mine Conveyor (roller friction, belt dynamics, gallery ventilation)
 * - Factory CHP (transfer chute blockage, motor current surges, dust)
 * - Stockpile (deep internal core probes vs surface IR wetting)
 * - Transit (truck tarp insulation vs rail slipstream airflow)
 * - Ship Cargo Hold (confined hold, O2 depletion, CO accumulation)
 */

import {
  EnvironmentProfile,
  ProcessState,
  SimulationConfig,
  TestCasePhase,
  TransitSubmode,
} from '../types';
import { getDomainModel, calculateLocalStateAtCoords } from './domain-models';

export {
  WEATHER_PROFILES,
  type WeatherModifiers,
} from './constants';

export type { ProcessState } from '../types';

export interface HotspotPreset {
  zone: string;
  x: number;
  y: number;
  radius: number;
}

/**
 * Profile-specific hotspot location assignments based on the hazard zone.
 */
export function getHotspotPreset(
  profile: EnvironmentProfile,
  submode: TransitSubmode,
  scenario: string
): HotspotPreset {
  const model = getDomainModel(profile);
  return model.getHotspotPreset(submode, scenario);
}

/**
 * Deterministic physics-inspired step update delegating to the active domain model.
 */
export function calculateProcessState(
  config: SimulationConfig,
  tick: number,
  activePhase?: TestCasePhase
): ProcessState {
  const model = getDomainModel(config.profile);
  return model.calculateState(config, tick, activePhase);
}

/**
 * Computes spatial physical value at coordinates (x, y) given hotspot diffusion.
 * Models Gaussian thermal diffusion: T(x, y) = T_ambient + Delta_T_bulk + Intensity * exp(-dist^2 / (2 * sigma^2))
 */
export function calculateLocalStateAt(
  x: number,
  y: number,
  state: ProcessState
): { temperature: number; co: number; vibration: number; dust: number } {
  return calculateLocalStateAtCoords(x, y, state);
}
