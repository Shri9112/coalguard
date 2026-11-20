/**
 * CoalGuard - Profile Definitions
 * Five operating profiles with profile-specific sensor coordinates,
 * zones, parameters, and Road/Rail transit submodes.
 */

import { EnvironmentProfile, ProfileDefinition, SensorBlueprint } from '../types';

export const PROFILES: ProfileDefinition[] = [
  {
    id: 'mine-conveyor',
    label: 'Mine Conveyor System',
    shortLabel: 'Mine Conveyor',
    description: 'Underground coal haulage belt, high-speed idler rollers, and transfer discharge.',
    facilityTitle: 'Underground Main Haulage Conveyor #3',
    facilitySubtitle: 'Continuous belt transport · Frictional idler heating · Ventilation gallery',
    accent: '#22d3ee', // Cyan
    zones: ['Infeed Loading Chute', 'Idler Roller Gallery Bay 1-2', 'Drive Head Station', 'Transfer Discharge Chute'],
    sensorTypes: ['temperature', 'co', 'vibration', 'current', 'dust', 'thermal'],
    sensorCount: 8,
    scenarios: ['normal', 'self-heating', 'belt-friction', 'transfer-blockage', 'dust-steam', 'sensor-fault'],
    defaultConfig: {
      load: 75,
      moisture: 35,
      compaction: 65,
      ventilation: 50,
      sensorNoise: 6,
      sensorDropout: 0,
      sprayAvailable: true,
    },
  },
  {
    id: 'factory-chp',
    label: 'Factory CHP Transfer Point',
    shortLabel: 'Factory CHP',
    description: 'Crusher feed deck, enclosed transfer chute hoods, dust scrubbers, and boiler bunker.',
    facilityTitle: 'Thermal Power CHP Coal Processing Tower',
    facilitySubtitle: 'High-throughput transfer drop · Wet spray nozzles · Bunker accumulation',
    accent: '#60a5fa', // Blue
    zones: ['Crusher Feed Hopper', 'Transfer Chute Hood', 'Vibratory Screen Deck', 'Bunker Storage Infeed'],
    sensorTypes: ['temperature', 'co', 'dust', 'vibration', 'current', 'thermal'],
    sensorCount: 8,
    scenarios: ['normal', 'self-heating', 'transfer-blockage', 'dust-steam', 'sensor-fault'],
    defaultConfig: {
      load: 85,
      moisture: 42,
      compaction: 70,
      ventilation: 35,
      sensorNoise: 8,
      sensorDropout: 0,
      sprayAvailable: true,
    },
  },
  {
    id: 'stockpile',
    label: 'Bulk Coal Stockpile Yard',
    shortLabel: 'Stockpile Yard',
    description: 'Open-air tiered coal stockpiles, multi-depth thermal probes, and drone survey corridors.',
    facilityTitle: 'Strategic Coal Reserve Stockpile Yard',
    facilitySubtitle: 'Compacted coal layers · Subsurface oxidation · Environmental rain & wind',
    accent: '#34d399', // Emerald
    zones: ['Stockpile Flank A', 'Stockpile Core B', 'Internal Multi-Depth Corridor', 'Survey Rover Path'],
    sensorTypes: ['temperature', 'co', 'humidity', 'wind', 'thermal'],
    sensorCount: 8,
    scenarios: ['normal', 'self-heating', 'hidden-hotspot', 'dust-steam', 'sensor-fault'],
    defaultConfig: {
      load: 90,
      moisture: 25,
      compaction: 85,
      ventilation: 20,
      sensorNoise: 7,
      sensorDropout: 0,
      sprayAvailable: false,
    },
  },
  {
    id: 'transit',
    label: 'Road / Rail Transit Logistics',
    shortLabel: 'Road & Rail Transit',
    description: 'En-route bulk coal transit featuring selectable Truck Tipper and Rail Wagon Hopper modes.',
    facilityTitle: 'Intermodal Coal Transit Logistics Corridor',
    facilitySubtitle: 'Transit dwell time · Aerodynamic airflow · Sidewall & core telemetry',
    accent: '#f59e0b', // Amber
    hasSubmodes: true,
    supportedSubmodes: ['truck', 'rail-wagon'],
    defaultSubmode: 'truck',
    zones: ['Loading Terminal Bay', 'Forward Cargo Section', 'Mid-Section Deep Well', 'Aft Cargo Section'],
    sensorTypes: ['temperature', 'co', 'vibration', 'wind', 'thermal'],
    sensorCount: 8,
    scenarios: ['normal', 'self-heating', 'hidden-hotspot', 'dust-steam', 'sensor-fault'],
    defaultConfig: {
      load: 85,
      moisture: 30,
      compaction: 78,
      ventilation: 60,
      sensorNoise: 8,
      sensorDropout: 0,
      sprayAvailable: false,
    },
  },
  {
    id: 'cargo-hold',
    label: 'Bulk Carrier Ship Cargo Hold',
    shortLabel: 'Ship Cargo Hold',
    description: 'Sealed oceanic bulk cargo holds with restricted access, deep thermal probes, and gas sampling.',
    facilityTitle: 'Panamax Bulk Carrier Cargo Hold #2',
    facilitySubtitle: 'Enclosed voyage transit · Low ventilation · Gas asphyxiation & deep smolder',
    accent: '#a855f7', // Purple
    zones: ['Upper Hatch Coaming', 'Hold Mid-Deck Level', 'Lower Bilge Boundary', 'Ventilation Exhaust Shaft'],
    sensorTypes: ['temperature', 'co', 'o2', 'humidity', 'thermal', 'methane'],
    sensorCount: 8,
    scenarios: ['normal', 'self-heating', 'hold-asphyxiation', 'sensor-fault'],
    defaultConfig: {
      load: 95,
      moisture: 22,
      compaction: 90,
      ventilation: 10,
      sensorNoise: 6,
      sensorDropout: 0,
      sprayAvailable: false,
    },
  },
];

/**
 * Sensor layout blueprints per profile and transit submode.
 * Coordinates (x, y) are mapped to 0-100 schematic space for visual diagram rendering.
 */
export const PROFILE_SENSORS: Record<string, SensorBlueprint[]> = {
  'mine-conveyor': [
    { id: 'mc-t01', name: 'T-01 Infeed Chute', type: 'temperature', zone: 'Infeed Loading Chute', x: 14, y: 46 },
    { id: 'mc-co02', name: 'CO-02 Gallery Infeed', type: 'co', zone: 'Infeed Loading Chute', x: 22, y: 30 },
    { id: 'mc-t03', name: 'T-03 Roller Idler 1', type: 'temperature', zone: 'Idler Roller Gallery Bay 1-2', x: 38, y: 58 },
    { id: 'mc-v04', name: 'V-04 Idler Bearing Vib', type: 'vibration', zone: 'Idler Roller Gallery Bay 1-2', x: 44, y: 68 },
    { id: 'mc-co05', name: 'CO-05 Central Belt Mid', type: 'co', zone: 'Idler Roller Gallery Bay 1-2', x: 52, y: 32 },
    { id: 'mc-t06', name: 'T-06 Drive Pulley Head', type: 'temperature', zone: 'Drive Head Station', x: 70, y: 48 },
    { id: 'mc-a07', name: 'A-07 Drive Motor Current', type: 'current', zone: 'Drive Head Station', x: 76, y: 72 },
    { id: 'mc-d08', name: 'D-08 Discharge Hood Dust', type: 'dust', zone: 'Transfer Discharge Chute', x: 88, y: 40 },
  ],
  'factory-chp': [
    { id: 'chp-t01', name: 'T-11 Crusher Feed Deck', type: 'temperature', zone: 'Crusher Feed Hopper', x: 12, y: 42 },
    { id: 'chp-co02', name: 'CO-12 Crusher Discharge', type: 'co', zone: 'Crusher Feed Hopper', x: 20, y: 26 },
    { id: 'chp-t03', name: 'T-13 Transfer Hood Top', type: 'temperature', zone: 'Transfer Chute Hood', x: 42, y: 34 },
    { id: 'chp-d04', name: 'D-14 Chute Dust Monitor', type: 'dust', zone: 'Transfer Chute Hood', x: 48, y: 70 },
    { id: 'chp-v05', name: 'V-15 Screen Vibrator G', type: 'vibration', zone: 'Vibratory Screen Deck', x: 62, y: 64 },
    { id: 'chp-a06', name: 'A-16 Feeder Drive Current', type: 'current', zone: 'Vibratory Screen Deck', x: 68, y: 28 },
    { id: 'chp-t07', name: 'T-17 Bunker Infeed Probe', type: 'temperature', zone: 'Bunker Storage Infeed', x: 84, y: 46 },
    { id: 'chp-co08', name: 'CO-18 Bunker Vent Gas', type: 'co', zone: 'Bunker Storage Infeed', x: 88, y: 74 },
  ],
  stockpile: [
    { id: 'sp-t01', name: 'T-21 Flank A Shallow Probe', type: 'temperature', zone: 'Stockpile Flank A', x: 20, y: 44 },
    { id: 'sp-co02', name: 'CO-22 Flank A Gas Sniffer', type: 'co', zone: 'Stockpile Flank A', x: 28, y: 68 },
    { id: 'sp-t03', name: 'T-23 Core B Deep Probe 1', type: 'temperature', zone: 'Stockpile Core B', x: 48, y: 52 },
    { id: 'sp-t04', name: 'T-24 Core B Deep Probe 2', type: 'temperature', zone: 'Stockpile Core B', x: 56, y: 38 },
    { id: 'sp-co05', name: 'CO-25 Pile Apex Vent', type: 'co', zone: 'Stockpile Core B', x: 62, y: 24 },
    { id: 'sp-rh06', name: 'RH-26 Ambient Weather Stn', type: 'humidity', zone: 'Internal Multi-Depth Corridor', x: 78, y: 28 },
    { id: 'sp-w07', name: 'W-27 Anemometer Wind', type: 'wind', zone: 'Internal Multi-Depth Corridor', x: 84, y: 65 },
    { id: 'sp-ir08', name: 'IR-28 Thermal Survey Mast', type: 'thermal', zone: 'Survey Rover Path', x: 74, y: 48 },
  ],
  'transit-truck': [
    { id: 'trk-t01', name: 'T-31 Forward Tarp Probe', type: 'temperature', zone: 'Forward Cargo Section', x: 24, y: 38 },
    { id: 'trk-co02', name: 'CO-32 Forward Bulk Gas', type: 'co', zone: 'Forward Cargo Section', x: 30, y: 65 },
    { id: 'trk-t03', name: 'T-33 Bed Center Subsurface', type: 'temperature', zone: 'Mid-Section Deep Well', x: 50, y: 46 },
    { id: 'trk-co04', name: 'CO-34 Tipper Vent Tube', type: 'co', zone: 'Mid-Section Deep Well', x: 54, y: 28 },
    { id: 'trk-v05', name: 'V-35 Chassis Road Vibration', type: 'vibration', zone: 'Mid-Section Deep Well', x: 52, y: 78 },
    { id: 'trk-t06', name: 'T-36 Tailgate Bed Probe', type: 'temperature', zone: 'Aft Cargo Section', x: 74, y: 42 },
    { id: 'trk-w07', name: 'W-37 Airflow Speedometer', type: 'wind', zone: 'Aft Cargo Section', x: 82, y: 26 },
    { id: 'trk-ir08', name: 'IR-38 Weighbridge IR Cam', type: 'thermal', zone: 'Loading Terminal Bay', x: 12, y: 72 },
  ],
  'transit-rail-wagon': [
    { id: 'rw-t01', name: 'T-41 Hopper 1 Bulk Core', type: 'temperature', zone: 'Forward Cargo Section', x: 18, y: 42 },
    { id: 'rw-co02', name: 'CO-42 Hopper 1 Hatch Gas', type: 'co', zone: 'Forward Cargo Section', x: 25, y: 28 },
    { id: 'rw-t03', name: 'T-43 Hopper 2 Well Center', type: 'temperature', zone: 'Mid-Section Deep Well', x: 46, y: 48 },
    { id: 'rw-t04', name: 'T-44 Hopper 2 Sidewall RTD', type: 'temperature', zone: 'Mid-Section Deep Well', x: 52, y: 68 },
    { id: 'rw-co05', name: 'CO-45 Hopper 2 Gas Sensor', type: 'co', zone: 'Mid-Section Deep Well', x: 58, y: 30 },
    { id: 'rw-v06', name: 'V-46 Bogie Rail Dynamics', type: 'vibration', zone: 'Mid-Section Deep Well', x: 48, y: 82 },
    { id: 'rw-t07', name: 'T-47 Hopper 3 Aft Probe', type: 'temperature', zone: 'Aft Cargo Section', x: 78, y: 45 },
    { id: 'rw-w08', name: 'W-48 Train Slipstream Air', type: 'wind', zone: 'Aft Cargo Section', x: 86, y: 28 },
  ],
  'cargo-hold': [
    { id: 'hld-t01', name: 'T-51 Hatch Coaming Temp', type: 'temperature', zone: 'Upper Hatch Coaming', x: 22, y: 26 },
    { id: 'hld-co02', name: 'CO-52 Hatch Trunk Exhaust', type: 'co', zone: 'Upper Hatch Coaming', x: 30, y: 24 },
    { id: 'hld-t03', name: 'T-53 Mid-Cargo Depth A', type: 'temperature', zone: 'Hold Mid-Deck Level', x: 42, y: 50 },
    { id: 'hld-t04', name: 'T-54 Mid-Cargo Depth B', type: 'temperature', zone: 'Hold Mid-Deck Level', x: 58, y: 52 },
    { id: 'hld-o05', name: 'O2-55 Oxygen Depletion Sensor', type: 'o2', zone: 'Hold Mid-Deck Level', x: 50, y: 35 },
    { id: 'hld-t06', name: 'T-56 Deep Bilge Bottom Probe', type: 'temperature', zone: 'Lower Bilge Boundary', x: 48, y: 78 },
    { id: 'hld-co07', name: 'CO-57 Bilge Well Gas Port', type: 'co', zone: 'Lower Bilge Boundary', x: 56, y: 82 },
    { id: 'hld-m08', name: 'CH4-58 Methane Trace Sensor', type: 'methane', zone: 'Ventilation Exhaust Shaft', x: 80, y: 30 },
  ],
};

export function getProfile(id: EnvironmentProfile): ProfileDefinition {
  return PROFILES.find((p) => p.id === id) ?? PROFILES[0];
}

export function getSensorsForProfile(
  profile: EnvironmentProfile,
  submode: string = 'none'
): SensorBlueprint[] {
  if (profile === 'transit') {
    if (submode === 'rail-wagon') return PROFILE_SENSORS['transit-rail-wagon'];
    return PROFILE_SENSORS['transit-truck'];
  }
  return PROFILE_SENSORS[profile] ?? PROFILE_SENSORS['mine-conveyor'];
}
