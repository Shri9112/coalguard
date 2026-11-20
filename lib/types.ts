/**
 * CoalGuard - Core Domain Types
 * Strongly typed definitions for the explainable coal fire risk simulator.
 * Local, deterministic academic prototype.
 */

export type EnvironmentProfile =
  | 'mine-conveyor'
  | 'factory-chp'
  | 'stockpile'
  | 'transit'
  | 'cargo-hold';

export type TransitSubmode = 'truck' | 'rail-wagon' | 'none';

export type ScenarioId =
  | 'normal'
  | 'self-heating'
  | 'belt-friction'
  | 'transfer-blockage'
  | 'dust-steam'
  | 'sensor-fault'
  | 'hidden-hotspot'
  | 'hold-asphyxiation';

export type WeatherCondition = 'hot-dry' | 'humid' | 'rainy' | 'cool' | 'windy';

export type RunMode = 'guided' | 'explore';

export type ResponseAction = 'monitor' | 'inspect' | 'cool' | 'stop';

export type SensorType =
  | 'temperature'
  | 'co'
  | 'humidity'
  | 'vibration'
  | 'current'
  | 'dust'
  | 'wind'
  | 'thermal'
  | 'o2'
  | 'methane';

export type SensorStatus = 'online' | 'degraded' | 'stale' | 'offline';

export type RiskStage = 'Normal' | 'Watch' | 'Warning' | 'Critical';

export type RuleTone = 'cyan' | 'amber' | 'red' | 'green' | 'violet';

export type LinguisticLevel = 'Low' | 'Medium' | 'High' | 'VeryHigh' | 'Unknown';

export type TestCaseId =
  | 'mine-self-heating'
  | 'mine-belt-friction'
  | 'factory-blockage'
  | 'factory-cooling-loss'
  | 'stockpile-dense-dry'
  | 'stockpile-rainy-hidden'
  | 'transit-truck-hotspot'
  | 'transit-rail-ventilation'
  | 'cargo-hold-smolder'
  | 'cross-profile-fault';

export interface SensorBlueprint {
  id: string;
  name: string;
  type: SensorType;
  zone: string;
  x: number;
  y: number;
}

export interface SensorNode {
  id: string;
  name: string;
  type: SensorType;
  zone: string;
  x: number; // 0 to 100 on schematic
  y: number; // 0 to 100 on schematic
  unit: string;
  status: SensorStatus;
  health: number; // 0 to 100%
  value: number; // crisp reading
  displayValue: string;
  rawPhysicsValue: number; // underlying modeled process state at this location
  trend: 'rising' | 'stable' | 'falling';
  rateOfChange: number; // units per minute
  lastSeenTick: number;
}

export interface ProcessState {
  internalHeat: number; // core heat accumulation (0-100)
  surfaceHeat: number; // surface temperature elevation (°C)
  bulkTemperature: number; // general average temperature (°C)
  gasConcentration: number; // CO in ppm
  vibrationLevel: number; // mechanical vibration in g
  motorCurrent: number; // motor current in % of full load
  airborneDust: number; // mg/m³
  humidity: number; // % RH
  airflowSpeed: number; // m/s
  hotspot: {
    x: number;
    y: number;
    zone: string;
    intensity: number; // 0 to 100
    radius: number; // spread radius in coordinate units
  };
}

export interface ProfileDefinition {
  id: EnvironmentProfile;
  label: string;
  shortLabel: string;
  description: string;
  facilityTitle: string;
  facilitySubtitle: string;
  accent: string;
  zones: string[];
  sensorTypes: SensorType[];
  sensorCount: number;
  hasSubmodes?: boolean;
  supportedSubmodes?: TransitSubmode[];
  defaultSubmode?: TransitSubmode;
  scenarios: ScenarioId[];
  defaultConfig: Partial<SimulationConfig>;
}

export interface ScenarioPresetConfig {
  load: number;
  moisture: number;
  compaction: number;
  ventilation: number;
  sensorNoise: number;
  sensorDropout: number;
  sprayAvailable: boolean;
  weather?: WeatherCondition;
}

export interface ScenarioDefinition {
  id: ScenarioId;
  label: string;
  detail: string;
  profileHints: EnvironmentProfile[];
  guided?: boolean;
  expectedTrend?: string;
  presetConfig?: Partial<ScenarioPresetConfig>;
}

export interface SimulationConfig {
  profile: EnvironmentProfile;
  submode: TransitSubmode;
  scenario: ScenarioId;
  weather: WeatherCondition;
  mode: RunMode;
  speed: number; // 1 to 5x multiplier
  load: number; // 0 to 100%
  moisture: number; // 0 to 100%
  compaction: number; // 0 to 100%
  ventilation: number; // 0 to 100%
  sensorNoise: number; // 0 to 50%
  sensorDropout: number; // 0 to 50%
  sprayAvailable: boolean;
  response: ResponseAction;
  responseSince: number;
  testCaseId?: TestCaseId;
  testCaseStartTick?: number;
}

export interface TestCasePhase {
  id: string;
  label: string;
  detail: string;
  startTick: number;
  endTick: number;
  modifiers: {
    heat?: number;
    gas?: number;
    friction?: number;
    blockage?: number;
    dust?: number;
    retained?: number;
    ventilationShift?: number;
    sensorDropout?: number;
    moistureShift?: number;
  };
}

export interface TestCaseCheck {
  id: string;
  description: string;
  evaluate: (history: TelemetryFrame[]) => { passed: boolean; message: string };
}

export interface TestCaseDefinition {
  id: TestCaseId;
  label: string;
  shortLabel: string;
  objective: string;
  profile: EnvironmentProfile;
  submode?: TransitSubmode;
  scenario: ScenarioId;
  weather: WeatherCondition;
  config: Partial<SimulationConfig>;
  durationTicks: number;
  phases: TestCasePhase[];
  expected: string[];
  checks: TestCaseCheck[];
  focus: 'thermal' | 'mechanical' | 'context' | 'reliability';
}

export interface TestCaseCheckResult {
  id: string;
  description: string;
  passed: boolean;
  message: string;
}

export interface TestCaseEvaluation {
  status: 'not-run' | 'running' | 'pass' | 'needs-review';
  score: number; // 0 to 100%
  checks: TestCaseCheckResult[];
  observations: string[];
  durationTicks: number;
  peakRisk: number;
  peakStage: RiskStage;
}

export interface SimulationEvent {
  id: string;
  tick: number;
  timeString: string;
  tone: 'system' | 'watch' | 'warning' | 'response' | 'inspection' | 'fault';
  title: string;
  detail: string;
}

export interface MembershipPoints {
  a: number;
  b: number;
  c: number;
  d?: number; // optional 4th point for trapezoidal
}

export interface FuzzyVariableConfig {
  name: string;
  unit: string;
  low: MembershipPoints;
  medium: MembershipPoints;
  high: MembershipPoints;
  veryHigh?: MembershipPoints;
}

export interface FuzzyInputState {
  id: string;
  label: string;
  value: number;
  displayValue: string;
  memberships: {
    low: number;
    medium: number;
    high: number;
    veryHigh?: number;
  };
  dominantLevel: LinguisticLevel;
  dominantMembership: number;
  trend: 'rising' | 'stable' | 'falling';
  health: number;
  status: SensorStatus | 'derived' | 'unavailable';
  role: string;
  tone: RuleTone;
}

export interface FuzzyRuleDetail {
  code: string;
  label: string;
  formula: string;
  firingStrength: number;
  weight: number;
  antecedents: { label: string; membership: number }[];
  consequent: {
    target: 'risk' | 'cause' | 'confidence';
    level: LinguisticLevel | RiskStage;
    outputSet: MembershipPoints;
  };
  effect: string;
  tone: RuleTone;
  active: boolean;
}

export interface ConfidenceFactor {
  id: string;
  label: string;
  value: number;
  effect: 'supports' | 'reduces' | 'neutral';
  detail: string;
}

export interface DefuzzificationTrace {
  domain: number[]; // e.g. 0 to 100 with step 1
  aggregatedSet: number[]; // aggregated output membership for each point in domain
  centroidNumerator: number;
  centroidDenominator: number;
  crispCentroid: number;
  ruleContributions: { code: string; weight: number; clippedArea: number }[];
}

export interface RiskAssessment {
  riskScore: number; // 0 to 100
  stage: RiskStage;
  alertMessage: string;
  explanation: string;
  confidence: number; // 0 to 100 (Evidence Quality Indicator)
  probableCause: string;
  affectedZone: string;
  recommendedAction: ResponseAction;
  actionReason: string;
  fuzzyInputs: FuzzyInputState[];
  ruleDetails: FuzzyRuleDetail[];
  activeRules: FuzzyRuleDetail[];
  defuzzificationTrace: DefuzzificationTrace;
  confidenceFactors: ConfidenceFactor[];
  contributions: { label: string; value: number; tone: RuleTone }[];
}

export interface TelemetryFrame {
  tick: number;
  minutes: number;
  profile: EnvironmentProfile;
  submode: TransitSubmode;
  ambientTemperature: number;
  humidity: number;
  ventilation: number;
  load: number;
  coalMoisture: number;
  compaction: number;
  heatState: number;
  surfaceHeat: number;
  bulkTemperature?: number;
  frictionState: number;
  motorCurrent: number;
  gasState: number;
  dustState: number;
  airflowSpeed?: number;
  hotspotLocation: { x: number; y: number; zone: string; intensity: number; radius: number };
  sensors: SensorNode[];
  risk: RiskAssessment;
}

export interface InspectionUnit {
  id: string;
  label: string;
  status: 'docked' | 'en-route' | 'on-site' | 'returning';
  x: number;
  y: number;
  targetZone: string;
  progress: number; // 0 to 100%
  localTemperature: number;
  readingDisplay: string;
  findings: string;
}

export interface PsoTunableParameters {
  tempHighA: number; // start of High temperature membership ramp
  tempHighB: number; // full High temperature membership
  trendHighA: number; // start of High trend ramp
  trendHighB: number; // full High trend ramp
  coHighA: number; // start of High CO ramp
  coHighB: number; // full High CO ramp
  mechHighA: number; // start of High mechanical ramp
  mechHighB: number; // full High mechanical ramp
  ruleWeightThermal: number; // output weight for thermal rules
  ruleWeightMechanical: number; // output weight for mechanical rules
  ruleWeightInterference: number; // output weight for interference dampening
}

export interface PsoConvergencePoint {
  iteration: number;
  bestCost: number;
  averageCost: number;
}

export interface PsoCalibrationResult {
  status: 'uncalibrated' | 'calibrated';
  particles: number;
  iterations: number;
  bestCost: number;
  convergenceTrace: PsoConvergencePoint[];
  initialParameters: PsoTunableParameters;
  optimizedParameters: PsoTunableParameters;
  parameterChanges: { name: string; before: number; after: number; changePercent: number }[];
  objectiveDescription: string;
  timestamp: string;
  seed: number;
}

export interface VerificationMetrics {
  model: string;
  shortLabel: string;
  sampleCount: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  precision: number; // %
  recall: number; // %
  f1: number; // %
  falseAlarmRate: number; // % = FP / (FP + TN)
  detectionDelay: number | null; // mean ticks from onset to alert; null if not observed
  leadTime: number | null; // mean ticks warning before critical limit; null if not observed
  robustness: number | null; // stressed F1 as a percentage of baseline F1; null if baseline F1 is zero
  tone: RuleTone;
}

export interface SimulationSnapshot {
  config: SimulationConfig;
  running: boolean;
  tick: number;
  telemetry: TelemetryFrame;
  history: TelemetryFrame[];
  /** Deterministic, model-based trace under the current settings; not observed data. */
  projection: TelemetryFrame[];
  events: SimulationEvent[];
  inspection: InspectionUnit;
  psoResult: PsoCalibrationResult;
  caseRun?: {
    testCaseId: TestCaseId;
    status: 'ready' | 'running' | 'paused' | 'complete';
    phaseId: string;
    phaseLabel: string;
    startedAtTick: number;
    evaluation?: TestCaseEvaluation;
  };
  lastImpactSummary?: string;
  isCustomized?: boolean;
  brokenEdgeIds?: string[];
}

export type TopologyComponentRole = 'sensor' | 'controller' | 'actuator' | 'gateway' | 'cloud';

export interface TopologyNode {
  id: string;
  name: string;
  role: TopologyComponentRole;
  protocol: string;
  x: number;
  y: number;
  status: 'online' | 'fault' | 'disabled';
  detail: string;
  sensorIdRef?: string;
  actuatorActionRef?: 'cool' | 'stop';
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  protocol: string;
  status: 'active' | 'broken';
  latencyMs?: number;
}

export interface TopologyGraph {
  id: string;
  name: string;
  profile: EnvironmentProfile;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

export interface TopologyValidationCheck {
  id: string;
  name: string;
  passed: boolean;
  detail: string;
}

export interface TopologyValidationResult {
  valid: boolean;
  score: number;
  summary: string;
  checks: TopologyValidationCheck[];
  isolatedNodes: string[];
  unreachableActuators: string[];
}

export type { AggregatedEvidence } from './engine/trends';
