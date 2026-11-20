/**
 * CoalGuard - Comprehensive Unit & Regression Test Suite
 * Validates Mamdani fuzzification, inference, centroid defuzzification,
 * PSO calibration determinism, sensor fault modeling, test-case assertions,
 * causal responsiveness of all 11 controls, domain model divergence,
 * noise/dropout independence from physics, and causal impact explanations.
 */

import {
  runComparativeEvaluation,
} from '../lib/engine/evaluation';
import {
  DEFAULT_PSO_PARAMETERS,
  leftShoulder,
  rightShoulder,
  runMamdaniInference,
  trapezoid,
  triangle,
} from '../lib/engine/fuzzy-system';
import { calculateProcessState } from '../lib/engine/process-model';
import { generateProjectedFrames, generateSimulationFrame } from '../lib/engine/simulation-frame';
import { executePsoCalibration } from '../lib/engine/pso';
import { calculateSensorHealth, updateSensors } from '../lib/engine/sensors';
import { getDomainModel } from '../lib/engine/domain-models';
import { evaluateTestCase, TEST_CASES } from '../lib/data/test-cases';
import { getSensorsForProfile } from '../lib/data/profiles';
import { getTopologyForProfile } from '../lib/data/topologies';
import { validateTopology } from '../lib/engine/topology-validator';
import { runAllPublishedCurveReplays } from '../lib/engine/published-replay';
import { FIELD_GOAF_GAS_INDICES } from '../lib/data/field-goaf-case';
import { buildFieldGoafReplay } from '../lib/engine/field-goaf-replay';
import {
  buildFieldBenchmark,
  FIELD_EPISODES,
  FIELD_INFERENCE_AVAILABILITY,
  FIELD_PSO_CALIBRATION,
} from '../lib/engine/field-episode-replay';
import { EnvironmentProfile, SimulationConfig, TelemetryFrame, TopologyGraph } from '../lib/types';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    process.exitCode = 1;
  }
}

console.log('\n========================================');
console.log('CoalGuard Soft Computing Test Suite');
console.log('========================================\n');

// 1. FUZZY MEMBERSHIP FUNCTIONS
console.log('[1/9] Testing Fuzzy Membership Functions...');
assert(triangle(20, 10, 20, 30) === 1.0, 'Triangle peak is 1.0');
assert(triangle(5, 10, 20, 30) === 0.0, 'Triangle left out-of-bounds is 0.0');
assert(triangle(35, 10, 20, 30) === 0.0, 'Triangle right out-of-bounds is 0.0');
assert(Math.abs(triangle(15, 10, 20, 30) - 0.5) < 0.001, 'Triangle slope at midpoint is 0.5');

assert(trapezoid(20, 10, 20, 30, 40) === 1.0, 'Trapezoid plateau left edge is 1.0');
assert(trapezoid(25, 10, 20, 30, 40) === 1.0, 'Trapezoid plateau middle is 1.0');
assert(trapezoid(30, 10, 20, 30, 40) === 1.0, 'Trapezoid plateau right edge is 1.0');
assert(trapezoid(5, 10, 20, 30, 40) === 0.0, 'Trapezoid out-of-bounds left is 0.0');

assert(leftShoulder(10, 15, 30) === 1.0, 'Left shoulder below minimum is 1.0');
assert(leftShoulder(35, 15, 30) === 0.0, 'Left shoulder above maximum is 0.0');
assert(rightShoulder(50, 40, 60) === 0.5, 'Right shoulder midpoint is 0.5');

// 2. MAMDANI INFERENCE & DEFUZZIFICATION
console.log('\n[2/9] Testing Mamdani Inference & Centroid Defuzzification...');
const dummyConfig: SimulationConfig = {
  profile: 'mine-conveyor',
  submode: 'none',
  scenario: 'self-heating',
  weather: 'hot-dry',
  mode: 'guided',
  speed: 1,
  load: 75,
  moisture: 30,
  compaction: 70,
  ventilation: 30,
  sensorNoise: 5,
  sensorDropout: 0,
  sprayAvailable: true,
  response: 'monitor',
  responseSince: 0,
};

// Test baseline normal evidence
const normalEvidence = {
  peakTemperature: 24.0,
  averageTemperature: 23.5,
  temperatureRateOfRise: 0.05,
  peakCo: 3.0,
  averageCo: 2.5,
  coRateOfRise: 0.01,
  peakVibration: 0.25,
  averageMotorCurrent: 60.0,
  peakDust: 15.0,
  overallSensorHealth: 98,
  offlineSensorCount: 0,
  staleSensorCount: 0,
  healthySensorCount: 8,
  crossSensorAgreement: 0.95,
  gasTemperatureCorrelation: 0.9,
};

const normalAssessment = runMamdaniInference(normalEvidence, { ...dummyConfig, scenario: 'normal' }, []);
assert(normalAssessment.riskScore <= 25, 'Normal evidence produces risk <= 25', `Got ${normalAssessment.riskScore}`);
assert(normalAssessment.stage === 'Normal', 'Normal evidence produces Normal stage');
assert(normalAssessment.defuzzificationTrace.centroidDenominator > 0, 'Defuzzification denominator is positive');
const cooledActionAssessment = runMamdaniInference(
  normalEvidence,
  { ...dummyConfig, scenario: 'normal', response: 'cool' },
  []
);
assert(cooledActionAssessment.riskScore === normalAssessment.riskScore,
  'Operator response does not directly discount risk for unchanged sensor evidence');

// Test critical runaway evidence
const criticalEvidence = {
  peakTemperature: 82.0,
  averageTemperature: 74.0,
  temperatureRateOfRise: 4.2,
  peakCo: 85.0,
  averageCo: 65.0,
  coRateOfRise: 4.8,
  peakVibration: 0.4,
  averageMotorCurrent: 80.0,
  peakDust: 45.0,
  overallSensorHealth: 95,
  offlineSensorCount: 0,
  staleSensorCount: 0,
  healthySensorCount: 8,
  crossSensorAgreement: 0.9,
  gasTemperatureCorrelation: 0.95,
};

const criticalAssessment = runMamdaniInference(criticalEvidence, dummyConfig, []);
assert(criticalAssessment.riskScore >= 76, 'Critical evidence produces risk >= 76', `Got ${criticalAssessment.riskScore}`);
assert(criticalAssessment.stage === 'Critical', 'Critical evidence produces Critical stage');
assert(criticalAssessment.activeRules.some((r) => r.code === 'R01'), 'Rule R01 fired during critical runaway');

const sustainedWarningEvidence = {
  ...criticalEvidence,
  peakTemperature: 70.0,
  averageTemperature: 66.0,
  temperatureRateOfRise: 0,
  peakCo: 28.0,
  averageCo: 26.0,
  coRateOfRise: 0,
};
const sustainedWarningAssessment = runMamdaniInference(sustainedWarningEvidence, dummyConfig, []);
assert(sustainedWarningAssessment.stage === 'Warning',
  'Sustained high temperature and elevated CO stay at Warning when the rise slows',
  `Got ${sustainedWarningAssessment.stage} (${sustainedWarningAssessment.riskScore})`);
assert(sustainedWarningAssessment.activeRules.some((rule) => rule.code === 'R09'),
  'Persistent thermal/gas evidence activates R09 without a rising trend');

const highTemperatureLowGasEvidence = {
  ...sustainedWarningEvidence,
  peakTemperature: 65,
  averageTemperature: 63,
  peakCo: 15,
  averageCo: 13,
};
const highTemperatureLowGasAssessment = runMamdaniInference(highTemperatureLowGasEvidence, dummyConfig, []);
assert(highTemperatureLowGasAssessment.stage === 'Normal',
  'High temperature without elevated gas does not trigger the sustained-heating rule',
  `Got ${highTemperatureLowGasAssessment.stage} (${highTemperatureLowGasAssessment.riskScore})`);

const sustainedCriticalEvidence = {
  ...criticalEvidence,
  temperatureRateOfRise: 0,
  coRateOfRise: 0,
};
const sustainedCriticalAssessment = runMamdaniInference(sustainedCriticalEvidence, dummyConfig, []);
assert(sustainedCriticalAssessment.stage === 'Critical',
  'Sustained severe temperature and CO stay Critical when the rise slows',
  `Got ${sustainedCriticalAssessment.stage} (${sustainedCriticalAssessment.riskScore})`);
assert(sustainedCriticalAssessment.activeRules.some((rule) => rule.code === 'R10'),
  'Persistent severe thermal/gas evidence activates R10 without a rising trend');

// Test mechanical evidence isolation
const mechanicalEvidence = {
  peakTemperature: 55.0,
  averageTemperature: 38.0,
  temperatureRateOfRise: 1.1,
  peakCo: 4.0,
  averageCo: 3.0,
  coRateOfRise: 0.02,
  peakVibration: 3.2,
  averageMotorCurrent: 98.0,
  peakDust: 25.0,
  overallSensorHealth: 92,
  offlineSensorCount: 0,
  staleSensorCount: 0,
  healthySensorCount: 8,
  crossSensorAgreement: 0.78,
  gasTemperatureCorrelation: 0.2,
};

const mechAssessment = runMamdaniInference(mechanicalEvidence, { ...dummyConfig, scenario: 'belt-friction' }, []);
assert(mechAssessment.probableCause.toLowerCase().includes('mechanical') || mechAssessment.probableCause.toLowerCase().includes('friction'),
  'Mechanical signal isolates mechanical friction cause');

// 3. PARTICLE SWARM OPTIMIZATION (PSO)
console.log('\n[3/9] Testing Particle Swarm Optimization...');
const pso1 = executePsoCalibration(12, 15, 42);
const pso2 = executePsoCalibration(12, 15, 42);

assert(pso1.status === 'calibrated', 'PSO completes with calibrated status');
assert(pso1.bestCost === pso2.bestCost, 'PSO is 100% deterministic with identical seed', `${pso1.bestCost} vs ${pso2.bestCost}`);
assert(pso1.optimizedParameters.tempHighA === pso2.optimizedParameters.tempHighA, 'Parameters match identically across seeded runs');
assert(pso1.convergenceTrace.length > 0, 'Convergence trace has iterations');
assert(pso1.bestCost <= pso1.convergenceTrace[0].bestCost, 'Final cost <= Initial cost (monotonic improvement or equality)');

const prePso = runMamdaniInference(normalEvidence, dummyConfig, [], DEFAULT_PSO_PARAMETERS);
const postPso = runMamdaniInference(normalEvidence, dummyConfig, [], pso1.optimizedParameters);
assert(prePso.riskScore >= 0 && typeof postPso.riskScore === 'number', 'Inference runs successfully with PSO-calibrated parameters');

// 4. SENSOR FAULTS & RELIABILITY
console.log('\n[4/9] Testing Sensor Faults & Health Models...');
const onlineHealth = calculateSensorHealth('online', 5);
const degradedHealth = calculateSensorHealth('degraded', 30);
const staleHealth = calculateSensorHealth('stale', 0);
const offlineHealth = calculateSensorHealth('offline', 0);

assert(onlineHealth >= 90, 'Online sensor health is >= 90%');
assert(degradedHealth < onlineHealth, 'Degraded health < Online health');
assert(staleHealth < degradedHealth, 'Stale health < Degraded health');
assert(offlineHealth === 0, 'Offline sensor health is exactly 0%');

const testBlueprints = [
  { id: 't1', name: 'Temp 1', type: 'temperature' as const, zone: 'Zone A', x: 20, y: 30 },
  { id: 'co1', name: 'CO 1', type: 'co' as const, zone: 'Zone A', x: 25, y: 35 },
];
const state = calculateProcessState(dummyConfig, 10);
const sensorsNormal = updateSensors(testBlueprints, state, dummyConfig, 10);
assert(sensorsNormal.every((s) => s.status === 'online'), 'Default settings produce online sensors');

const sensorsFaulty = updateSensors(testBlueprints, state, { ...dummyConfig, scenario: 'sensor-fault' }, 10);
assert(sensorsFaulty.length === testBlueprints.length, 'Sensor count preserved during fault injection');

// 5. TEST CASE EVALUATION & MODEL COMPARISON
console.log('\n[5/9] Testing Test Case Evaluation & Baseline Comparisons...');
assert(TEST_CASES.length >= 10, 'At least 10 deterministic test cases defined', `Count: ${TEST_CASES.length}`);

const tc0 = TEST_CASES[0];
const dummyFrame: TelemetryFrame = {
  tick: 40,
  minutes: 60,
  profile: tc0.profile,
  submode: 'none',
  ambientTemperature: 50,
  humidity: 40,
  ventilation: 30,
  load: 75,
  coalMoisture: 30,
  compaction: 70,
  heatState: 40,
  surfaceHeat: 50,
  motorCurrent: 68,
  frictionState: 0.3,
  gasState: 35,
  dustState: 25,
  hotspotLocation: { x: 50, y: 50, zone: 'Transfer Point', intensity: 60, radius: 20 },
  sensors: [
    {
      id: 't1',
      name: 'Temp Infeed',
      type: 'temperature',
      zone: 'Zone A',
      x: 20,
      y: 30,
      unit: '°C',
      status: 'online',
      health: 95,
      value: 62.5,
      displayValue: '62.5 °C',
      rawPhysicsValue: 62.0,
      trend: 'rising',
      rateOfChange: 1.5,
      lastSeenTick: 40,
    },
    {
      id: 'co1',
      name: 'CO Infeed',
      type: 'co',
      zone: 'Zone A',
      x: 25,
      y: 35,
      unit: 'ppm',
      status: 'online',
      health: 95,
      value: 38.0,
      displayValue: '38.0 ppm',
      rawPhysicsValue: 37.5,
      trend: 'rising',
      rateOfChange: 1.8,
      lastSeenTick: 40,
    },
  ],
  risk: normalAssessment,
};

const framesList: TelemetryFrame[] = Array.from({ length: 10 }, (_, i) => ({
  ...dummyFrame,
  tick: i * 4,
  sensors: dummyFrame.sensors.map((s) => ({
    ...s,
    value: s.type === 'temperature' ? 24 + i * 4 : 4 + i * 3.5,
  })),
}));

const evalResult = evaluateTestCase(tc0, framesList);
assert(evalResult.checks.length > 0, 'Test case checks are evaluated');
assert(evalResult.status === 'pass' || evalResult.status === 'needs-review', 'Test case status is pass or needs-review');

// Comparative Evaluation
const compResults = runComparativeEvaluation(pso1.optimizedParameters);
assert(compResults.length === 3, 'Three models compared: Threshold, Basic Mamdani, PSO-tuned Mamdani');
assert(compResults[0].shortLabel === 'Threshold', 'First model is Threshold baseline');
assert(compResults[1].shortLabel === 'Basic Mamdani', 'Second model is Basic Mamdani');
assert(compResults[2].shortLabel === 'PSO-tuned FIS', 'Third model is PSO-tuned Mamdani');
assert(compResults[2].falseAlarmRate <= compResults[0].falseAlarmRate,
  'PSO-tuned FIS has lower or equal false alarm rate than fixed threshold');

// 6. CONTROLS RESPONSIVENESS, DOMAIN DIVERGENCE & EXPLANATIONS
console.log('\n[6/9] Testing Controls Responsiveness, Domain Divergence & Causal Explanations...');

// Control 1: Coal Load -> Motor Current & Dust
const lowLoadState = calculateProcessState({ ...dummyConfig, load: 20 }, 10);
const highLoadState = calculateProcessState({ ...dummyConfig, load: 95 }, 10);
assert(highLoadState.motorCurrent > lowLoadState.motorCurrent, 'Load control visibly affects motor current',
  `${highLoadState.motorCurrent.toFixed(1)}% vs ${lowLoadState.motorCurrent.toFixed(1)}%`);
assert(highLoadState.airborneDust > lowLoadState.airborneDust, 'Load control visibly affects airborne dust emission');

// Live trace uses the same forward model as the simulation, so slider changes
// should alter the projected process and risk signals before playback begins.
const projectionConfig = {
  ...dummyConfig,
  scenario: 'self-heating' as const,
  weather: 'hot-dry' as const,
  load: 90,
  moisture: 10,
  compaction: 95,
  ventilation: 10,
  sprayAvailable: false,
};
const projectionInitial = generateSimulationFrame(0, projectionConfig, DEFAULT_PSO_PARAMETERS);
const projection = generateProjectedFrames(
  0,
  24,
  projectionConfig,
  DEFAULT_PSO_PARAMETERS,
  projectionInitial.frame,
  projectionInitial.nextInspection
);
const repeatedProjection = generateProjectedFrames(
  0,
  24,
  projectionConfig,
  DEFAULT_PSO_PARAMETERS,
  projectionInitial.frame,
  projectionInitial.nextInspection
);
assert(projection.length === 24, 'Projection provides a visible forward horizon before playback');
assert(
  JSON.stringify(projection.map((frame) => [frame.risk.riskScore, frame.bulkTemperature, frame.gasState])) ===
    JSON.stringify(repeatedProjection.map((frame) => [frame.risk.riskScore, frame.bulkTemperature, frame.gasState])),
  'Projected trace is deterministic for unchanged settings'
);
const lowLoadProjectionConfig = { ...projectionConfig, load: 20 };
const lowLoadInitial = generateSimulationFrame(0, lowLoadProjectionConfig, DEFAULT_PSO_PARAMETERS);
const lowLoadProjection = generateProjectedFrames(
  0,
  24,
  lowLoadProjectionConfig,
  DEFAULT_PSO_PARAMETERS,
  lowLoadInitial.frame,
  lowLoadInitial.nextInspection
);
assert(projection[projection.length - 1].motorCurrent > lowLoadProjection[lowLoadProjection.length - 1].motorCurrent,
  'Projected motor-current trace responds to coal-load adjustment');
const lowCompactionProjectionConfig = { ...projectionConfig, compaction: 10 };
const lowCompactionInitial = generateSimulationFrame(0, lowCompactionProjectionConfig, DEFAULT_PSO_PARAMETERS);
const lowCompactionProjection = generateProjectedFrames(
  0,
  24,
  lowCompactionProjectionConfig,
  DEFAULT_PSO_PARAMETERS,
  lowCompactionInitial.frame,
  lowCompactionInitial.nextInspection
);
assert(projection[projection.length - 1].heatState > lowCompactionProjection[lowCompactionProjection.length - 1].heatState,
  'Projected internal-heat trace responds to compaction / heat-retention settings');
assert(projection[0].load === projectionConfig.load && projection[0].compaction === projectionConfig.compaction,
  'Telemetry frames expose the active control values used by the model');

// Control 2: Ventilation -> Airflow Speed & Gas Dispersion
const lowVentState = calculateProcessState({ ...dummyConfig, ventilation: 10 }, 20);
const highVentState = calculateProcessState({ ...dummyConfig, ventilation: 90 }, 20);
assert(highVentState.airflowSpeed > lowVentState.airflowSpeed, 'Ventilation control visibly increases airflow speed',
  `${highVentState.airflowSpeed.toFixed(1)} vs ${lowVentState.airflowSpeed.toFixed(1)} m/s`);
assert(highVentState.gasConcentration < lowVentState.gasConcentration, 'Ventilation control increases CO dispersion (lowers ppm)');

// Control 3: Compaction -> Thermal Retention
const lowCompState = calculateProcessState({ ...dummyConfig, compaction: 15 }, 25);
const highCompState = calculateProcessState({ ...dummyConfig, compaction: 95 }, 25);
assert(highCompState.internalHeat > lowCompState.internalHeat, 'Compaction control increases internal core heat accumulation');

// Control 4: Weather -> Ambient Temp & Humidity
const hotDryState = calculateProcessState({ ...dummyConfig, weather: 'hot-dry' }, 5);
const coolState = calculateProcessState({ ...dummyConfig, weather: 'cool' }, 5);
assert(hotDryState.bulkTemperature - coolState.bulkTemperature >= 15, 'Weather condition alters thermal baseline significantly');

// Control 5: Water Spray -> Dust Suppression & Cooling
const sprayOffState = calculateProcessState({ ...dummyConfig, sprayAvailable: false }, 20);
const sprayOnState = calculateProcessState({ ...dummyConfig, sprayAvailable: true }, 20);
assert(sprayOnState.airborneDust < sprayOffState.airborneDust, 'Water spray actively suppresses airborne dust');
assert(sprayOnState.internalHeat <= sprayOffState.internalHeat, 'Water spray provides active cooling mitigation');

// Control 6: Operator Emergency Stop -> Motor Current & Friction Drop
const runState = calculateProcessState({ ...dummyConfig, response: 'monitor', responseSince: 0 }, 30);
const stopState = calculateProcessState({ ...dummyConfig, response: 'stop', responseSince: 10 }, 30);
assert(stopState.motorCurrent < runState.motorCurrent * 0.6, 'Emergency stop cuts motor current to idle');
assert(stopState.vibrationLevel < runState.vibrationLevel, 'Emergency stop eliminates operating vibration');

// Control 7 & 8: Sensor Noise and Dropout DO NOT alter physical state!
const basePhysics = calculateProcessState(dummyConfig, 15);
const noisyPhysics = calculateProcessState({ ...dummyConfig, sensorNoise: 40 }, 15);
const dropoutPhysics = calculateProcessState({ ...dummyConfig, sensorDropout: 45 }, 15);
assert(basePhysics.internalHeat === noisyPhysics.internalHeat, 'Sensor noise does NOT alter underlying physical internalHeat');
assert(basePhysics.surfaceHeat === noisyPhysics.surfaceHeat, 'Sensor noise does NOT alter underlying physical surfaceHeat');
assert(basePhysics.internalHeat === dropoutPhysics.internalHeat, 'Sensor dropout does NOT alter underlying physical internalHeat');
assert(basePhysics.gasConcentration === dropoutPhysics.gasConcentration, 'Sensor dropout does NOT alter underlying physical gasConcentration');

// Check that noise & dropout DO affect sensor readings and health
const bps = getSensorsForProfile('mine-conveyor', 'none');
const quietSensors = updateSensors(bps, basePhysics, { ...dummyConfig, sensorNoise: 0, sensorDropout: 0 }, 15);
const noisySensors = updateSensors(bps, basePhysics, { ...dummyConfig, sensorNoise: 35, sensorDropout: 0 }, 15);
const droppedSensors = updateSensors(bps, basePhysics, { ...dummyConfig, sensorNoise: 0, sensorDropout: 50 }, 15);

assert(quietSensors.every((s) => s.status === 'online'), 'Zero noise & zero dropout maintain 100% online sensor statuses');
assert(noisySensors.some((s) => s.health < 80), 'High noise visibly degrades sensor health scores');
assert(droppedSensors.some((s) => s.status === 'stale' || s.status === 'offline'), 'High dropout triggers stale or offline sensor states');

// Control 9: Transit Truck vs Rail Wagon Physical Divergence
const truckConfig: SimulationConfig = {
  ...dummyConfig,
  profile: 'transit',
  submode: 'truck',
};
const railConfig: SimulationConfig = {
  ...dummyConfig,
  profile: 'transit',
  submode: 'rail-wagon',
};
const truckState = calculateProcessState(truckConfig, 25);
const railState = calculateProcessState(railConfig, 25);

assert(railState.airflowSpeed > truckState.airflowSpeed * 2.0,
  'Transit submodes diverge: Rail wagon experiences high slipstream airflow',
  `${railState.airflowSpeed.toFixed(1)} m/s vs ${truckState.airflowSpeed.toFixed(1)} m/s`);
assert(truckState.vibrationLevel > railState.vibrationLevel,
  'Transit submodes diverge: Road truck exhibits higher suspension bump vibration',
  `${truckState.vibrationLevel.toFixed(2)} g vs ${railState.vibrationLevel.toFixed(2)} g`);
assert(truckState.gasConcentration > railState.gasConcentration,
  'Transit submodes diverge: Tarp-covered truck traps CO gas more than open rail hopper');

// Domain Check: Wet Stockpile (surface cools while internal core remains hot)
const wetStockpileConfig: SimulationConfig = {
  ...dummyConfig,
  profile: 'stockpile',
  scenario: 'hidden-hotspot',
  weather: 'rainy',
  moisture: 75,
  compaction: 85,
};
const wetStockpileState = calculateProcessState(wetStockpileConfig, 30);
assert(wetStockpileState.surfaceHeat < 32, 'Wet stockpile surface is cooled by rain', `${wetStockpileState.surfaceHeat.toFixed(1)} °C`);
assert(wetStockpileState.bulkTemperature > 48, 'Wet stockpile internal core remains hot despite surface cooling', `${wetStockpileState.bulkTemperature.toFixed(1)} °C`);

const stockpileBps = getSensorsForProfile('stockpile', 'none');
const stockpileSensors = updateSensors(stockpileBps, wetStockpileState, wetStockpileConfig, 30);
const coreProbe = stockpileSensors.find((s) => s.id.includes('probe') || s.name.toLowerCase().includes('core'));
const surfaceIR = stockpileSensors.find((s) => s.id.includes('surface') || s.type === 'thermal');
if (coreProbe && surfaceIR) {
  assert(coreProbe.value > surfaceIR.value + 15,
    'Stockpile deep probe detects hidden subsurface heat while surface thermal sensor reads cool',
    `Core: ${coreProbe.value.toFixed(1)} °C vs Surface: ${surfaceIR.value.toFixed(1)} °C`);
}

// Causal Impact Explanation Checks
const conveyorModel = getDomainModel('mine-conveyor');
const explVent = conveyorModel.explainImpact(
  dummyConfig,
  { ...dummyConfig, ventilation: 80 },
  lowVentState,
  highVentState
);
assert(explVent.toLowerCase().includes('ventilation') && explVent.toLowerCase().includes('airflow'),
  'Causal explainer generates accurate explanation for ventilation changes');

const explLoad = conveyorModel.explainImpact(
  dummyConfig,
  { ...dummyConfig, load: 95 },
  lowLoadState,
  highLoadState
);
assert(explLoad.toLowerCase().includes('load') && explLoad.toLowerCase().includes('current'),
  'Causal explainer generates accurate explanation for coal load changes');

// 7. SCADA TOPOLOGY & TELEMETRY INTERLOCK VALIDATION
console.log('\n[7/9] Testing SCADA Topology & Telemetry Interlock Validation...');
const profilesToTest: EnvironmentProfile[] = [
  'mine-conveyor',
  'factory-chp',
  'stockpile',
  'transit',
  'cargo-hold',
];

for (const prof of profilesToTest) {
  const topo = getTopologyForProfile(prof);
  assert(topo.nodes.length >= 6, `Topology ${prof} has at least 6 industrial nodes`);
  assert(topo.edges.length >= 5, `Topology ${prof} has at least 5 fieldbus edges`);
  const initialValidation = validateTopology(topo);
  assert(initialValidation.valid, `Intact topology ${prof} passes all directed connectivity checks`);
  assert(initialValidation.score === 100, `Intact topology ${prof} achieves 100% connectivity score`);
}

// Test edge break (fault simulation)
const conveyorTopo = getTopologyForProfile('mine-conveyor');
const severedTopo: TopologyGraph = {
  ...conveyorTopo,
  edges: conveyorTopo.edges.map((e) =>
    e.id === 'e-temp-plc' ? { ...e, status: 'broken' } : e
  ),
};
const severedValidation = validateTopology(severedTopo);
assert(!severedValidation.valid, 'Severed sensor cable fails topology connectivity checks');
assert(severedValidation.isolatedNodes.includes('node-temp-infeed'),
  'Infeed pyrometer correctly identified as isolated upon cable break');
assert(severedValidation.score < 100, 'Connectivity score drops when a fieldbus cable is severed');

// Test actuator break
const brokenActuatorTopo: TopologyGraph = {
  ...conveyorTopo,
  edges: conveyorTopo.edges.map((e) =>
    e.id === 'e-fuzzy-deluge' ? { ...e, status: 'broken' } : e
  ),
};
const actuatorValidation = validateTopology(brokenActuatorTopo);
assert(!actuatorValidation.valid, 'Severed deluge actuator cable fails interlock verification');
assert(actuatorValidation.unreachableActuators.includes('node-act-deluge'),
  'Deluge valve correctly identified as unreachable actuator');

const reversedSensorTopo: TopologyGraph = {
  ...conveyorTopo,
  edges: conveyorTopo.edges.map((edge) =>
    edge.id === 'e-temp-plc'
      ? { ...edge, source: edge.target, target: edge.source }
      : edge
  ),
};
const reversedSensorValidation = validateTopology(reversedSensorTopo);
assert(!reversedSensorValidation.valid && reversedSensorValidation.isolatedNodes.includes('node-temp-infeed'),
  'A reversed sensor link is not mistaken for a forward telemetry path');

// 8. PUBLISHED LAB DATA REPLAY (NO FIELD-ACCURACY CLAIMS)
console.log('\n[8/9] Testing Published Laboratory Data Replay...');
const publishedReplays = runAllPublishedCurveReplays();
assert(publishedReplays.length === 3, 'Three cited published coal-rank curves are replayable');
assert(publishedReplays.every((replay) => replay.validationLabelsAvailable === false),
  'Published laboratory rows are not mislabeled as fire/non-fire ground truth');
assert(publishedReplays.every((replay) => replay.timeSeriesAvailable === false),
  'Temperature-programmed samples are not misrepresented as timestamped time series');

for (const replay of publishedReplays) {
  assert(replay.observations.length === replay.curve.points.length,
    `${replay.curve.label}: every source observation reaches the inference engine`);
  assert(replay.observations.every((observation) =>
    Number.isFinite(observation.risk.riskScore) && observation.risk.riskScore >= 0 && observation.risk.riskScore <= 100
  ), `${replay.curve.label}: every Mamdani output is finite and in range`);
  assert(replay.observations.every((observation) =>
    observation.risk.fuzzyInputs.find((input) => input.id === 'temperature')?.status !== 'unavailable' &&
    observation.risk.fuzzyInputs.find((input) => input.id === 'co')?.status !== 'unavailable'
  ), `${replay.curve.label}: measured temperature and CO remain available to the model`);
  assert(replay.observations.every((observation) =>
    observation.risk.fuzzyInputs.find((input) => input.id === 'trend')?.status === 'unavailable' &&
    observation.risk.fuzzyInputs.find((input) => input.id === 'mechanical')?.status === 'unavailable' &&
    observation.risk.fuzzyInputs.find((input) => input.id === 'dust')?.status === 'unavailable' &&
    observation.risk.fuzzyInputs.find((input) => input.id === 'reliability')?.status === 'unavailable'
  ), `${replay.curve.label}: absent channels are explicitly treated as unavailable`);
  assert(replay.observations.every((observation) =>
    !observation.risk.activeRules.some((rule) => ['R01', 'R02', 'R04', 'R05', 'R06', 'R07'].includes(rule.code))
  ), `${replay.curve.label}: trend, mechanical, dust, hidden-hotspot and health rules do not fire without their inputs`);
  const riskScores = replay.observations.map((observation) => observation.risk.riskScore);
  assert(riskScores.every((score, index) => index === 0 || score >= riskScores[index - 1]),
    `${replay.curve.label}: risk output does not fall as both published temperature and CO rise`,
    riskScores.join(' → '));
  assert(riskScores[riskScores.length - 1] > riskScores[0],
    `${replay.curve.label}: Mamdani output responds to the rising published measurements`,
    `${riskScores[0]} → ${riskScores[riskScores.length - 1]}`);
  console.log(`  Evidence replay: ${replay.curve.label} Mamdani score ${riskScores[0]} → ${riskScores[riskScores.length - 1]} (not an accuracy metric)`);
}

// 9. PUBLISHED FIELD CASE DATA INTEGRITY AND EXPLORATORY REPLAY
console.log('\n[9/9] Testing Published Mine-Goaf Field Case Replay...');
const fieldReplayStart = buildFieldGoafReplay(1);
const fieldReplayPeak = buildFieldGoafReplay(13);
const fieldReplayLast = buildFieldGoafReplay(35);
assert(FIELD_GOAF_GAS_INDICES.length === 35,
  'Published field case contains all 35 daily gas-index observations');
assert(FIELD_GOAF_GAS_INDICES.every((row, index) => row.day === index + 1),
  'Published field observations preserve consecutive day order');
assert(fieldReplayStart.observations[12].coToCo2 === 0.056 &&
  fieldReplayStart.observations[12].grahamTimesTen === 1.738,
  'Known Day 13 source maxima are transcribed and retained');
assert(fieldReplayStart.observations[25].alkaneRatio === 1.422,
  'Known Day 26 alkane-ratio maximum is transcribed and retained');
assert(fieldReplayStart.modelScoreAvailable === false,
  'Field record is not assigned a conveyor-model score without required channels');
assert(fieldReplayStart.selectedObservation.day === 1 &&
  fieldReplayPeak.selectedObservation.day === 13 &&
  fieldReplayLast.selectedObservation.day === 35,
  'Day selection returns the corresponding source observation');
assert(fieldReplayLast.observations.every((row) =>
  Object.values(row.normalized).every((value) => Number.isFinite(value) && value >= 0 && value <= 100)
), 'Comparison normalization is finite and bounded from 0 to 100');
assert(fieldReplayLast.observations[0].changeFromFirstPercent.grahamTimesTen === 0,
  'Relative change uses Day 1 as a transparent baseline');
assert(buildFieldGoafReplay(Number.NaN).selectedObservation.day === 1,
  'Invalid day selection safely falls back to the first field observation');

// 10. PUBLISHED MULTI-EPISODE FIELD REPLAY (HELD OUT FROM PSO TUNING)
console.log('\n[10/10] Testing Published Mine Field Episode Replay...');
const coalFieldBenchmark = buildFieldBenchmark();
const fireMetrics = coalFieldBenchmark.metrics[0];
const psoFieldMetrics = coalFieldBenchmark.metrics[1];
const coReferenceMetrics = coalFieldBenchmark.metrics[2];
assert(FIELD_EPISODES.length === 18, 'Field workbook provides all 18 monitoring episodes');
assert(FIELD_EPISODES.reduce((sum, episode) => sum + episode.samples.length, 0) === 3240,
  'All 3,240 four-hourly field readings are loaded');
assert(FIELD_EPISODES.filter((episode) => episode.outcome === 'fire').length === 3 &&
  FIELD_EPISODES.filter((episode) => episode.outcome === 'event-free').length === 15,
  'Independent episode labels include 3 confirmed fires and 15 event-free periods');
assert(FIELD_EPISODES.every((episode) => episode.samples.length === 180 && episode.samples.every((sample) =>
  Number.isFinite(sample.temperatureC) && Number.isFinite(sample.coPpm) && Number.isFinite(sample.co2Percent) &&
  Number.isFinite(sample.o2Percent) && Number.isFinite(sample.n2Percent) && Number.isFinite(sample.methanePercent)
)), 'Every supported measurement is finite; confounded H₂/C₂H₄ channels are excluded');
assert(FIELD_INFERENCE_AVAILABILITY.temperature && FIELD_INFERENCE_AVAILABILITY.temperatureTrend && FIELD_INFERENCE_AVAILABILITY.co &&
  !FIELD_INFERENCE_AVAILABILITY.hiddenHotspotContext &&
  !FIELD_INFERENCE_AVAILABILITY.vibration && !FIELD_INFERENCE_AVAILABILITY.current && !FIELD_INFERENCE_AVAILABILITY.dust &&
  !FIELD_INFERENCE_AVAILABILITY.sensorHealth && !FIELD_INFERENCE_AVAILABILITY.crossSensorAgreement,
  'Only measured temperature, derived temperature trend, and measured CO are available to the field FIS');
assert(FIELD_PSO_CALIBRATION.seed === 42 && FIELD_PSO_CALIBRATION.particles === 20 && FIELD_PSO_CALIBRATION.iterations === 30,
  'Field PSO evaluation uses the application’s deterministic synthetic-data calibration, not field-fitted parameters');
assert(coalFieldBenchmark.episodes.every((episode) => episode.points.every((point) =>
  Number.isFinite(point.basic.riskScore) && point.basic.riskScore >= 0 && point.basic.riskScore <= 100 &&
  Number.isFinite(point.pso.riskScore) && point.pso.riskScore >= 0 && point.pso.riskScore <= 100
)), 'Basic and PSO Mamdani scores remain finite and within 0–100 for every field reading');
assert(coalFieldBenchmark.episodes.every((episode) => episode.points.every((point) =>
  !point.basic.activeRules.some((rule) => ['R04', 'R05', 'R06', 'R07'].includes(rule.code)) &&
  !point.pso.activeRules.some((rule) => ['R04', 'R05', 'R06', 'R07'].includes(rule.code))
)), 'Mechanical, dust, hidden-hotspot and sensor-health rules stay quiet without source channels');
assert(fireMetrics.truePositives === 3 && fireMetrics.falseNegatives === 0 && fireMetrics.falsePositives === 0 &&
  fireMetrics.earlyWarnings === 3 && fireMetrics.medianLeadHours === 100,
  'Basic Mamdani: 3/3 early fire alerts, 0/15 event-free alarms, median lead 100 h under the fixed policy');
assert(psoFieldMetrics.truePositives === 3 && psoFieldMetrics.falseNegatives === 0 && psoFieldMetrics.falsePositives === 0 &&
  psoFieldMetrics.earlyWarnings === 3 && psoFieldMetrics.medianLeadHours === 108,
  'PSO-tuned Mamdani: 3/3 early fire alerts, 0/15 event-free alarms, median lead 108 h under the same policy');
assert(coReferenceMetrics.truePositives === 3 && coReferenceMetrics.falseNegatives === 0 && coReferenceMetrics.falsePositives === 0 &&
  coReferenceMetrics.earlyWarnings === 3 && coReferenceMetrics.medianLeadHours === 232,
  'Published 11.14 ppm CO comparator replays with 3/3 early alerts and 0/15 event-free alarms');
assert(coalFieldBenchmark.episodes.filter((episode) => episode.episode.outcome === 'fire').every((episode) =>
  episode.evaluation.basicEarlyWarning && episode.evaluation.psoEarlyWarning && episode.evaluation.coBaselineEarlyWarning
), 'Each confirmed-fire episode alarm is evaluated against its independent confirmation time');
assert(coalFieldBenchmark.episodes.filter((episode) => episode.episode.outcome === 'event-free').every((episode) =>
  episode.evaluation.basicAlarmAt === null && episode.evaluation.psoAlarmAt === null && episode.evaluation.coBaselineAlarmAt === null
), 'No persistent alarm is counted in any of the 15 event-free episodes');

console.log('\n========================================');
console.log(`Results: ${passedTests}/${totalTests} tests passed.`);
console.log('========================================\n');

if (passedTests === totalTests) {
  console.log('All tests passed successfully!\n');
} else {
  process.exit(1);
}
