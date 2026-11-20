/**
 * CoalGuard - Deterministic Test Cases
 * Comprehensive test cases (at least 2 per profile across all 5 operating contexts)
 * with multi-phase timelines, explicit signal expectations, and programmable acceptance checks.
 */

import {
  SensorType,
  TelemetryFrame,
  TestCaseCheckResult,
  TestCaseDefinition,
  TestCaseEvaluation,
  TestCaseId,
  TestCasePhase,
} from '../types';
import { SIMULATION_MINUTES_PER_TICK } from '../engine/constants';

const STANDARD_FOUR_PHASES: TestCasePhase[] = [
  { id: 'baseline', label: 'Baseline', detail: 'System establishes thermal and load baseline', startTick: 0, endTick: 6, modifiers: {} },
  { id: 'onset', label: 'Signal Onset', detail: 'Initial rate-of-change divergence begins', startTick: 7, endTick: 16, modifiers: { heat: 1.15, gas: 1.12 } },
  { id: 'escalation', label: 'Escalation', detail: 'Multi-sensor agreement builds and risk rises', startTick: 17, endTick: 28, modifiers: { heat: 1.35, gas: 1.30 } },
  { id: 'decision', label: 'Operator Action Window', detail: 'Severity reaches actionable threshold', startTick: 29, endTick: 40, modifiers: { heat: 1.45, gas: 1.38 } },
];

function getSensorDelta(history: TelemetryFrame[], type: SensorType): number {
  if (history.length < 2) return 0;
  const first = history[0].sensors.find((s) => s.type === type && s.status !== 'offline')?.value ?? 0;
  const last = history[history.length - 1].sensors.find((s) => s.type === type && s.status !== 'offline')?.value ?? 0;
  return last - first;
}

export const TEST_CASES: TestCaseDefinition[] = [
  // 1. Mine Conveyor: Gradual Self-Heating
  {
    id: 'mine-self-heating',
    label: 'Mine Conveyor: Low-Temperature Self-Heating',
    shortLabel: 'Mine Self-Heating',
    objective: 'Demonstrate synchronous temperature and CO accumulation along the conveyor gallery under restricted airflow.',
    profile: 'mine-conveyor',
    scenario: 'self-heating',
    weather: 'hot-dry',
    config: {
      load: 80,
      moisture: 28,
      compaction: 75,
      ventilation: 25,
      sensorNoise: 6,
      sensorDropout: 0,
      sprayAvailable: true,
    },
    durationTicks: 40,
    phases: STANDARD_FOUR_PHASES,
    focus: 'thermal',
    expected: [
      'Temperature and CO gas escalate synchronously.',
      'Risk score transitions from Normal to Warning/Critical.',
      'Mamdani Rule R01 or R02 fires with high strength.',
    ],
    checks: [
      {
        id: 'chk-temp-rise',
        description: 'Peak temperature rises by at least 15 °C',
        evaluate: (history) => {
          const delta = getSensorDelta(history, 'temperature');
          return { passed: delta >= 15, message: `Temperature delta: +${delta.toFixed(1)} °C (required >= +15.0 °C)` };
        },
      },
      {
        id: 'chk-co-rise',
        description: 'Peak CO concentration rises by at least 18 ppm',
        evaluate: (history) => {
          const delta = getSensorDelta(history, 'co');
          return { passed: delta >= 18, message: `CO gas delta: +${delta.toFixed(1)} ppm (required >= +18.0 ppm)` };
        },
      },
      {
        id: 'chk-risk-stage',
        description: 'Final risk score reaches Warning or Critical stage (>= 51)',
        evaluate: (history) => {
          const last = history[history.length - 1];
          const score = last?.risk.riskScore ?? 0;
          return { passed: score >= 51, message: `Final risk: ${score}/100 (${last?.risk.stage})` };
        },
      },
    ],
  },

  // 2. Mine Conveyor: Belt & Roller Friction
  {
    id: 'mine-belt-friction',
    label: 'Mine Conveyor: Seized Idler Roller Friction',
    shortLabel: 'Mine Roller Friction',
    objective: 'Demonstrate mechanical fault isolation: vibration and motor current surge before CO gas appears.',
    profile: 'mine-conveyor',
    scenario: 'belt-friction',
    weather: 'cool',
    config: {
      load: 85,
      moisture: 45,
      compaction: 50,
      ventilation: 55,
      sensorNoise: 7,
      sensorDropout: 0,
      sprayAvailable: true,
    },
    durationTicks: 40,
    phases: [
      STANDARD_FOUR_PHASES[0],
      { ...STANDARD_FOUR_PHASES[1], modifiers: { friction: 1.35, heat: 1.1 } },
      { ...STANDARD_FOUR_PHASES[2], modifiers: { friction: 1.70, heat: 1.25 } },
      { ...STANDARD_FOUR_PHASES[3], modifiers: { friction: 2.10, heat: 1.35 } },
    ],
    focus: 'mechanical',
    expected: [
      'Bearing vibration and drive motor current rise sharply.',
      'CO gas remains low (< 15 ppm).',
      'Engine identifies Mechanical friction as probable cause instead of fire.',
    ],
    checks: [
      {
        id: 'chk-vib-rise',
        description: 'Vibration levels rise by at least 1.0 g',
        evaluate: (history) => {
          const delta = getSensorDelta(history, 'vibration');
          return { passed: delta >= 1.0, message: `Vibration delta: +${delta.toFixed(2)} g (required >= +1.00 g)` };
        },
      },
      {
        id: 'chk-co-low',
        description: 'CO gas stays low (< 20 ppm)',
        evaluate: (history) => {
          const lastCo = history[history.length - 1]?.sensors.find((s) => s.type === 'co')?.value ?? 0;
          return { passed: lastCo < 20, message: `Final CO: ${lastCo.toFixed(1)} ppm (< 20.0 ppm required)` };
        },
      },
      {
        id: 'chk-cause-mech',
        description: 'Probable cause points to mechanical/equipment friction',
        evaluate: (history) => {
          const cause = history[history.length - 1]?.risk.probableCause.toLowerCase() ?? '';
          const passed = cause.includes('mechanical') || cause.includes('friction');
          return { passed, message: `Diagnosed cause: "${history[history.length - 1]?.risk.probableCause}"` };
        },
      },
    ],
  },

  // 3. Factory CHP: Transfer Chute Blockage
  {
    id: 'factory-blockage',
    label: 'Factory CHP: Transfer Chute Material Blockage',
    shortLabel: 'Factory Blockage',
    objective: 'Simulate coal accumulation inside transfer drop hood, raising dust, motor current, and localized chute heat.',
    profile: 'factory-chp',
    scenario: 'transfer-blockage',
    weather: 'hot-dry',
    config: {
      load: 92,
      moisture: 35,
      compaction: 75,
      ventilation: 30,
      sensorNoise: 8,
      sensorDropout: 0,
      sprayAvailable: true,
    },
    durationTicks: 40,
    phases: [
      STANDARD_FOUR_PHASES[0],
      { ...STANDARD_FOUR_PHASES[1], modifiers: { blockage: 1.3, dust: 1.4 } },
      { ...STANDARD_FOUR_PHASES[2], modifiers: { blockage: 1.7, dust: 1.8, heat: 1.2 } },
      { ...STANDARD_FOUR_PHASES[3], modifiers: { blockage: 2.1, dust: 2.0, heat: 1.35 } },
    ],
    focus: 'mechanical',
    expected: [
      'Motor current surges above 85% full load.',
      'Chute dust and temperature increase simultaneously.',
      'Affected zone identifies Transfer Chute Hood.',
    ],
    checks: [
      {
        id: 'chk-current-surge',
        description: 'Motor current reaches >= 85% full load',
        evaluate: (history) => {
          const last = history[history.length - 1];
          const cur = last?.sensors.find((s) => s.type === 'current')?.value ?? 0;
          return { passed: cur >= 85, message: `Motor current: ${cur.toFixed(1)}% (required >= 85.0%)` };
        },
      },
      {
        id: 'chk-dust-spike',
        description: 'Particulate dust exceeds 60 mg/m³',
        evaluate: (history) => {
          const last = history[history.length - 1];
          const dust = last?.sensors.find((s) => s.type === 'dust')?.value ?? 0;
          return { passed: dust >= 60, message: `Airborne dust: ${dust.toFixed(0)} mg/m³ (required >= 60 mg/m³)` };
        },
      },
    ],
  },

  // 4. Factory CHP: Cooling Loss
  {
    id: 'factory-cooling-loss',
    label: 'Factory CHP: Water Spray Suppression Loss',
    shortLabel: 'Factory Cooling Loss',
    objective: 'Demonstrate rapid heat escalation when active spray cooling fails during continuous processing.',
    profile: 'factory-chp',
    scenario: 'self-heating',
    weather: 'humid',
    config: {
      load: 85,
      moisture: 20,
      compaction: 70,
      ventilation: 25,
      sensorNoise: 6,
      sensorDropout: 0,
      sprayAvailable: false, // OFF
    },
    durationTicks: 40,
    phases: STANDARD_FOUR_PHASES,
    focus: 'thermal',
    expected: [
      'Without spray cooling, temperature rises faster than baseline.',
      'Risk trajectory crosses into Warning band early.',
      'Engine advises active cooling or shutdown.',
    ],
    checks: [
      {
        id: 'chk-rapid-heat',
        description: 'Bulk temperature rises by at least 16 °C',
        evaluate: (history) => {
          const delta = getSensorDelta(history, 'temperature');
          return { passed: delta >= 16, message: `Temperature delta: +${delta.toFixed(1)} °C (required >= +16.0 °C)` };
        },
      },
      {
        id: 'chk-action-cool',
        description: 'Engine recommends cool or stop response action',
        evaluate: (history) => {
          const act = history[history.length - 1]?.risk.recommendedAction;
          const passed = act === 'cool' || act === 'stop';
          return { passed, message: `Recommended action: "${act}"` };
        },
      },
    ],
  },

  // 5. Stockpile: Dense Dry Core
  {
    id: 'stockpile-dense-dry',
    label: 'Stockpile: Dense Compaction Core Self-Heating',
    shortLabel: 'Stockpile Dense Core',
    objective: 'Model slow, deep subsurface heat retention inside a heavily compacted open-air coal pile.',
    profile: 'stockpile',
    scenario: 'self-heating',
    weather: 'hot-dry',
    config: {
      load: 95,
      moisture: 18,
      compaction: 92,
      ventilation: 15,
      sensorNoise: 6,
      sensorDropout: 0,
      sprayAvailable: false,
    },
    durationTicks: 45,
    phases: STANDARD_FOUR_PHASES,
    focus: 'thermal',
    expected: [
      'Deep temperature probes report progressive internal heat rise.',
      'Surface IR thermal sensor reflects delayed surface manifestation.',
      'Fuzzy engine activates deep oxidation rules.',
    ],
    checks: [
      {
        id: 'chk-deep-temp',
        description: 'Internal probe temperature exceeds 52 °C',
        evaluate: (history) => {
          const last = history[history.length - 1];
          const maxTemp = Math.max(...last.sensors.filter((s) => s.type === 'temperature').map((s) => s.value));
          return { passed: maxTemp >= 52, message: `Peak internal temperature: ${maxTemp.toFixed(1)} °C (>= 52.0 °C)` };
        },
      },
      {
        id: 'chk-co-detection',
        description: 'Pile apex gas sniffer detects CO >= 16 ppm',
        evaluate: (history) => {
          const last = history[history.length - 1];
          const co = last.sensors.find((s) => s.type === 'co')?.value ?? 0;
          return { passed: co >= 16, message: `Apex CO reading: ${co.toFixed(1)} ppm (>= 16.0 ppm)` };
        },
      },
    ],
  },

  // 6. Stockpile: Rainy Surface Hidden Hotspot
  {
    id: 'stockpile-rainy-hidden',
    label: 'Stockpile: Wet Surface Masking Deep Hotspot',
    shortLabel: 'Stockpile Hidden Hotspot',
    objective: 'Demonstrate how rainfall chills the exterior surface while internal coal oxidation continues unabated.',
    profile: 'stockpile',
    scenario: 'hidden-hotspot',
    weather: 'rainy',
    config: {
      load: 90,
      moisture: 88,
      compaction: 85,
      ventilation: 20,
      sensorNoise: 9,
      sensorDropout: 0,
      sprayAvailable: false,
    },
    durationTicks: 45,
    phases: STANDARD_FOUR_PHASES,
    focus: 'context',
    expected: [
      'Surface temperature is depressed by precipitation.',
      'Subsurface probes and CO gas remain significantly elevated.',
      'Mamdani Rule R06 fires, warning of hidden internal heat.',
    ],
    checks: [
      {
        id: 'chk-hidden-heat-rule',
        description: 'Rule R06 (Hidden hotspot under wet surface) becomes active',
        evaluate: (history) => {
          const last = history[history.length - 1];
          const r06 = last.risk.ruleDetails.find((r) => r.code === 'R06');
          return { passed: (r06?.firingStrength ?? 0) >= 0.25, message: `R06 firing strength: ${(r06?.firingStrength ?? 0).toFixed(2)}` };
        },
      },
      {
        id: 'chk-subsurface-differential',
        description: 'Internal heat remains elevated despite surface chilling',
        evaluate: (history) => {
          const last = history[history.length - 1];
          const passed = last.heatState >= 18;
          return { passed, message: `Internal heat state: ${last.heatState.toFixed(1)} (>= 18.0 required)` };
        },
      },
    ],
  },

  // 7. Transit: Truck Tipper Hotspot
  {
    id: 'transit-truck-hotspot',
    label: 'Transit Truck: Road Tipper Dwell Hotspot',
    shortLabel: 'Transit Truck Dwell',
    objective: 'Simulate high ambient heat and highway dwell time generating a hotspot in a covered tipper truck bed.',
    profile: 'transit',
    submode: 'truck',
    scenario: 'self-heating',
    weather: 'hot-dry',
    config: {
      load: 85,
      moisture: 25,
      compaction: 80,
      ventilation: 30,
      sensorNoise: 8,
      sensorDropout: 0,
      sprayAvailable: false,
    },
    durationTicks: 40,
    phases: STANDARD_FOUR_PHASES,
    focus: 'thermal',
    expected: [
      'Truck bed midpoint probe registers progressive heating.',
      'Tarp-trapped CO gas rises above normal baseline.',
      'Decision engine recommends inspection at weighbridge terminal.',
    ],
    checks: [
      {
        id: 'chk-truck-temp',
        description: 'Truck bed core temperature rises by at least 12 °C',
        evaluate: (history) => {
          const delta = getSensorDelta(history, 'temperature');
          return { passed: delta >= 12, message: `Truck temp delta: +${delta.toFixed(1)} °C (>= +12.0 °C)` };
        },
      },
    ],
  },

  // 8. Transit: Rail Wagon Aerodynamic Airflow
  {
    id: 'transit-rail-ventilation',
    label: 'Transit Rail: Hopper Car Slipstream Oxidation',
    shortLabel: 'Transit Rail Wagon',
    objective: 'Model open-top unit train hopper car airflow dynamics feeding a developing smolder during transit.',
    profile: 'transit',
    submode: 'rail-wagon',
    scenario: 'self-heating',
    weather: 'windy',
    config: {
      load: 90,
      moisture: 22,
      compaction: 75,
      ventilation: 75,
      sensorNoise: 9,
      sensorDropout: 0,
      sprayAvailable: false,
    },
    durationTicks: 40,
    phases: STANDARD_FOUR_PHASES,
    focus: 'thermal',
    expected: [
      'Transit slipstream air velocity increases airflow and cooling rate.',
      'Despite high airflow, hopper well center temperature accelerates.',
      'Sidewall RTDs report localized heat spread.',
    ],
    checks: [
      {
        id: 'chk-rail-heat',
        description: 'Hopper core temperature rises by at least 14 °C',
        evaluate: (history) => {
          const delta = getSensorDelta(history, 'temperature');
          return { passed: delta >= 14, message: `Rail hopper temp delta: +${delta.toFixed(1)} °C` };
        },
      },
    ],
  },

  // 9. Ship Cargo Hold: Sealed Hold Smolder
  {
    id: 'cargo-hold-smolder',
    label: 'Ship Cargo Hold: Deep Bilge Smolder & Gas Spike',
    shortLabel: 'Hold Deep Smolder',
    objective: 'Simulate oceanic voyage self-heating in a sealed cargo hold with severe oxygen depletion and CO buildup.',
    profile: 'cargo-hold',
    scenario: 'hold-asphyxiation',
    weather: 'humid',
    config: {
      load: 98,
      moisture: 20,
      compaction: 92,
      ventilation: 5, // Airtight
      sensorNoise: 6,
      sensorDropout: 0,
      sprayAvailable: false,
    },
    durationTicks: 45,
    phases: STANDARD_FOUR_PHASES,
    focus: 'thermal',
    expected: [
      'CO concentration escalates severely in enclosed hold volume.',
      'Oxygen levels drop as oxidation consumes hold atmosphere.',
      'Engine issues Critical Fire-Risk warning and recommends inert gas.',
    ],
    checks: [
      {
        id: 'chk-hold-co-surge',
        description: 'CO gas concentration reaches >= 45 ppm',
        evaluate: (history) => {
          const last = history[history.length - 1];
          const co = last.sensors.find((s) => s.type === 'co')?.value ?? 0;
          return { passed: co >= 45, message: `Cargo hold CO: ${co.toFixed(1)} ppm (>= 45.0 ppm required)` };
        },
      },
      {
        id: 'chk-hold-critical',
        description: 'Risk assessment reaches Critical stage',
        evaluate: (history) => {
          const last = history[history.length - 1];
          return { passed: last.risk.stage === 'Critical', message: `Stage: ${last.risk.stage} (${last.risk.riskScore}/100)` };
        },
      },
    ],
  },

  // 10. Cross-Profile: Sensor Network Telemetry Fault
  {
    id: 'cross-profile-fault',
    label: 'Cross-Profile: Telemetry Dropout & Sensor Faults',
    shortLabel: 'Sensor Network Fault',
    objective: 'Verify that intermittent dropout, stale telemetry, and offline sensors reduce confidence without falsely asserting fire.',
    profile: 'mine-conveyor',
    scenario: 'sensor-fault',
    weather: 'humid',
    config: {
      load: 75,
      moisture: 45,
      compaction: 60,
      ventilation: 50,
      sensorNoise: 28,
      sensorDropout: 35,
      sprayAvailable: true,
    },
    durationTicks: 40,
    phases: [
      STANDARD_FOUR_PHASES[0],
      { ...STANDARD_FOUR_PHASES[1], modifiers: { sensorDropout: 15 } },
      { ...STANDARD_FOUR_PHASES[2], modifiers: { sensorDropout: 30 } },
      { ...STANDARD_FOUR_PHASES[3], modifiers: { sensorDropout: 45 } },
    ],
    focus: 'reliability',
    expected: [
      'Overall sensor health falls below 75%.',
      'Multiple nodes enter stale or offline states.',
      'Decision confidence drops significantly, but risk remains evidence-grounded.',
    ],
    checks: [
      {
        id: 'chk-health-drop',
        description: 'Overall sensor health drops below 75%',
        evaluate: (history) => {
          const last = history[history.length - 1];
          const avgHealth = last.sensors.reduce((sum, s) => sum + s.health, 0) / last.sensors.length;
          return { passed: avgHealth < 75, message: `Mean sensor health: ${avgHealth.toFixed(1)}% (< 75.0% required)` };
        },
      },
      {
        id: 'chk-confidence-drop',
        description: 'Decision confidence is lowered (<= 75%)',
        evaluate: (history) => {
          const last = history[history.length - 1];
          const conf = last.risk.confidence;
          return { passed: conf <= 75, message: `Decision confidence: ${conf}% (<= 75% required)` };
        },
      },
      {
        id: 'chk-no-false-critical',
        description: 'System does NOT trigger false Critical alarm solely due to sensor faults',
        evaluate: (history) => {
          const last = history[history.length - 1];
          const passed = last.risk.stage !== 'Critical';
          return { passed, message: `Result stage: ${last.risk.stage} (Critical avoided despite missing data)` };
        },
      },
    ],
  },
];

export function getTestCase(id?: TestCaseId): TestCaseDefinition | undefined {
  return TEST_CASES.find((tc) => tc.id === id);
}

export function evaluateTestCase(
  testCase: TestCaseDefinition,
  history: TelemetryFrame[]
): TestCaseEvaluation {
  if (history.length < 5) {
    return {
      status: 'not-run',
      score: 0,
      checks: testCase.checks.map((c) => ({
        id: c.id,
        description: c.description,
        passed: false,
        message: 'Awaiting execution...',
      })),
      observations: ['Test case has not completed execution yet.'],
      durationTicks: 0,
      peakRisk: 0,
      peakStage: 'Normal',
    };
  }

  const checkResults: TestCaseCheckResult[] = testCase.checks.map((check) => {
    const res = check.evaluate(history);
    return {
      id: check.id,
      description: check.description,
      passed: res.passed,
      message: res.message,
    };
  });

  const passedCount = checkResults.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checkResults.length) * 100);
  const status = score >= 67 ? 'pass' : 'needs-review';

  const firstFrame = history[0];
  const lastFrame = history[history.length - 1];
  const peakRisk = Math.max(...history.map((h) => h.risk.riskScore));
  const peakStage = history.reduce<TelemetryFrame>((max, h) => (h.risk.riskScore > max.risk.riskScore ? h : max), history[0]).risk.stage;

  const observations = [
    `Simulation executed ${history.length - 1} ticks (${((history.length - 1) * SIMULATION_MINUTES_PER_TICK).toFixed(0)} virtual minutes).`,
    `Risk trajectory: ${firstFrame.risk.riskScore} (${firstFrame.risk.stage}) → ${lastFrame.risk.riskScore} (${lastFrame.risk.stage}) [Peak: ${peakRisk}].`,
    `Evidence quality confidence: ${firstFrame.risk.confidence}% → ${lastFrame.risk.confidence}%.`,
    `Final diagnosed cause: "${lastFrame.risk.probableCause}".`,
  ];

  return {
    status,
    score,
    checks: checkResults,
    observations,
    durationTicks: history.length,
    peakRisk,
    peakStage,
  };
}
