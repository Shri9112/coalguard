/**
 * CoalGuard - Simulation State Management
 * React Context providing deterministic simulation loop, telemetry frames,
 * Mamdani fuzzy risk assessment, PSO calibration, and test-case execution.
 */

'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { PROFILES } from '../data/profiles';
import { getScenario } from '../data/scenarios';
import { evaluateTestCase, getTestCase } from '../data/test-cases';
import { getDomainModel } from '../engine/domain-models';
import { DEFAULT_PSO_PARAMETERS } from '../engine/fuzzy-system';
import { calculateProcessState } from '../engine/process-model';
import { executePsoCalibration } from '../engine/pso';
import { generateProjectedFrames, generateSimulationFrame } from '../engine/simulation-frame';
import { SIMULATION_MINUTES_PER_TICK } from '../engine/constants';
import {
  EnvironmentProfile,
  InspectionUnit,
  PsoCalibrationResult,
  PsoTunableParameters,
  ResponseAction,
  ScenarioId,
  SimulationConfig,
  SimulationEvent,
  SimulationSnapshot,
  TelemetryFrame,
  TestCaseEvaluation,
  TestCaseId,
  TransitSubmode,
  WeatherCondition,
} from '../types';

interface SimulationContextValue {
  snapshot: SimulationSnapshot;
  // Controls
  start: () => void;
  pause: () => void;
  reset: () => void;
  step: () => void;
  setSpeed: (speed: number) => void;
  setProfile: (profile: EnvironmentProfile) => void;
  setTransitSubmode: (submode: TransitSubmode) => void;
  setScenario: (scenario: ScenarioId) => void;
  setWeather: (weather: WeatherCondition) => void;
  updateParameter: <K extends keyof SimulationConfig>(key: K, value: SimulationConfig[K]) => void;
  triggerResponseAction: (action: ResponseAction) => void;
  restoreScenarioPreset: () => void;
  // PSO Calibration
  runPso: (swarmSize?: number, maxIterations?: number, seed?: number) => void;
  resetPsoToDefault: () => void;
  // Test Case Runner
  startTestCase: (id: TestCaseId) => void;
  activeCaseEvaluation: TestCaseEvaluation | undefined;
  // SCADA Topology Integration
  brokenEdgeIds: string[];
  toggleTopologyEdge: (edgeId: string) => void;
  resetTopologyEdges: () => void;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

const DEFAULT_CONFIG: SimulationConfig = {
  profile: 'mine-conveyor',
  submode: 'none',
  scenario: 'self-heating',
  weather: 'hot-dry',
  mode: 'guided',
  speed: 1,
  load: 80,
  moisture: 25,
  compaction: 70,
  ventilation: 35,
  sensorNoise: 6,
  sensorDropout: 0,
  sprayAvailable: false,
  response: 'monitor',
  responseSince: 0,
};

const PARAMETER_LABELS: Partial<Record<keyof SimulationConfig, string>> = {
  load: 'coal load',
  moisture: 'moisture content',
  compaction: 'compaction / heat retention',
  ventilation: 'ventilation / airflow',
  sensorNoise: 'sensor noise floor',
  sensorDropout: 'sensor dropout rate',
  sprayAvailable: 'water spray availability',
};

function checkIfCustomized(currentConfig: SimulationConfig): boolean {
  const sc = getScenario(currentConfig.scenario);
  if (!sc.presetConfig) return false;
  const p = sc.presetConfig;
  if (p.load !== undefined && Math.abs(p.load - currentConfig.load) > 0.01) return true;
  if (p.moisture !== undefined && Math.abs(p.moisture - currentConfig.moisture) > 0.01) return true;
  if (p.compaction !== undefined && Math.abs(p.compaction - currentConfig.compaction) > 0.01) return true;
  if (p.ventilation !== undefined && Math.abs(p.ventilation - currentConfig.ventilation) > 0.01) return true;
  if (p.sensorNoise !== undefined && Math.abs(p.sensorNoise - currentConfig.sensorNoise) > 0.01) return true;
  if (p.sensorDropout !== undefined && Math.abs(p.sensorDropout - currentConfig.sensorDropout) > 0.01) return true;
  if (p.sprayAvailable !== undefined && p.sprayAvailable !== currentConfig.sprayAvailable) return true;
  if (p.weather !== undefined && p.weather !== currentConfig.weather) return true;
  return false;
}

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG);
  const [running, setRunning] = useState<boolean>(false);
  const [tick, setTick] = useState<number>(0);
  const [lastImpactSummary, setLastImpactSummary] = useState<string>(
    'Operating equilibrium established for Mine Conveyor. Self-heating baseline active.'
  );

  // PSO Calibration state (cached initial calibration with seed 42)
  const [psoResult, setPsoResult] = useState<PsoCalibrationResult>(() => {
    return executePsoCalibration(20, 30, 42);
  });
  const [activeParams, setActiveParams] = useState<PsoTunableParameters>(() => {
    return psoResult.optimizedParameters;
  });

  const [inspection, setInspection] = useState<InspectionUnit>(() => ({
    id: 'rover-alpha',
    label: 'Thermal Survey Rover',
    status: 'docked',
    x: 10,
    y: 85,
    targetZone: 'Maintenance Bay',
    progress: 0,
    localTemperature: 25.0,
    readingDisplay: '25.0 °C',
    findings: 'Docked at maintenance bay.',
  }));

  // Initial frame
  const [currentTelemetry, setCurrentTelemetry] = useState<TelemetryFrame>(() => {
    return generateSimulationFrame(0, DEFAULT_CONFIG, DEFAULT_PSO_PARAMETERS).frame;
  });

  const [history, setHistory] = useState<TelemetryFrame[]>([currentTelemetry]);
  const historyRef = useRef(history);
  const [events, setEvents] = useState<SimulationEvent[]>([
    {
      id: 'evt-init',
      tick: 0,
      timeString: '00:00',
      tone: 'system',
      title: 'CoalGuard Engine Initialized',
      detail: 'Local deterministic physics model and Mamdani FIS loaded.',
    },
  ]);

  // Test Case Execution State
  const [activeCaseId, setActiveCaseId] = useState<TestCaseId | undefined>(undefined);
  const [caseEvaluation, setCaseEvaluation] = useState<TestCaseEvaluation | undefined>(undefined);

  // SCADA Topology Link Control (severed / broken cable simulation)
  const [brokenEdgeIds, setBrokenEdgeIds] = useState<string[]>([]);
  const brokenEdgeIdsRef = useRef<string[]>(brokenEdgeIds);

  // Timer loop state references
  const tickRef = useRef(tick);
  const configRef = useRef(config);
  const activeParamsRef = useRef(activeParams);
  const currentTelemetryRef = useRef(currentTelemetry);
  const inspectionRef = useRef(inspection);

  useEffect(() => {
    tickRef.current = tick;
    configRef.current = config;
    activeParamsRef.current = activeParams;
    currentTelemetryRef.current = currentTelemetry;
    inspectionRef.current = inspection;
    historyRef.current = history;
    brokenEdgeIdsRef.current = brokenEdgeIds;
  }, [tick, config, activeParams, currentTelemetry, inspection, history, brokenEdgeIds]);

  const commitCurrentFrame = useCallback((frame: TelemetryFrame, nextInspection: InspectionUnit) => {
    currentTelemetryRef.current = frame;
    inspectionRef.current = nextInspection;
    setCurrentTelemetry(frame);
    setInspection(nextInspection);
    const updated = [...historyRef.current];
    if (updated.length > 0 && updated[updated.length - 1].tick === frame.tick) {
      updated[updated.length - 1] = frame;
    } else {
      updated.push(frame);
    }
    const bounded = updated.length > 80 ? updated.slice(-80) : updated;
    historyRef.current = bounded;
    setHistory(bounded);
  }, []);

  const replaceSimulationFrame = useCallback((frame: TelemetryFrame, nextInspection: InspectionUnit) => {
    tickRef.current = frame.tick;
    currentTelemetryRef.current = frame;
    inspectionRef.current = nextInspection;
    setTick(frame.tick);
    setCurrentTelemetry(frame);
    setInspection(nextInspection);
    historyRef.current = [frame];
    setHistory([frame]);
  }, []);

  /**
   * Advances simulation by one discrete tick.
   */
  const stepTick = useCallback(() => {
    const nextTick = tickRef.current + 1;
    const currentConfig = configRef.current;
    const params = activeParamsRef.current;
    const previousRiskStage = currentTelemetryRef.current.risk.stage;
    const prevSensors = currentTelemetryRef.current.sensors;
    const prevInspection = inspectionRef.current;

    const { frame: newFrame, nextInspection } = generateSimulationFrame(
      nextTick,
      currentConfig,
      params,
      prevSensors,
      prevInspection,
      brokenEdgeIdsRef.current
    );

    tickRef.current = nextTick;
    setTick(nextTick);
    commitCurrentFrame(newFrame, nextInspection);

    // Event generation on stage transitions
    if (newFrame.risk.stage !== previousRiskStage) {
      const elapsedMinutes = nextTick * SIMULATION_MINUTES_PER_TICK;
      const minutes = Math.floor(elapsedMinutes);
      const mm = String(minutes).padStart(2, '0');
      const ss = String(Math.round((elapsedMinutes - minutes) * 60)).padStart(2, '0');
      const timeStr = `${mm}:${ss}`;

      const tone =
        newFrame.risk.stage === 'Critical'
          ? 'warning'
          : newFrame.risk.stage === 'Warning'
          ? 'watch'
          : 'system';

      setEvents((prev) => [
        {
          id: `evt-${nextTick}-${Date.now()}`,
          tick: nextTick,
          timeString: timeStr,
          tone,
          title: `Risk Escalated to ${newFrame.risk.stage} (${newFrame.risk.riskScore}/100)`,
          detail: newFrame.risk.alertMessage,
        },
        ...prev.slice(0, 30),
      ]);
    }

    // Check if test case completion reached
    if (currentConfig.testCaseId) {
      const tc = getTestCase(currentConfig.testCaseId);
      if (tc && nextTick >= tc.durationTicks) {
        setRunning(false);
        const evaluation = evaluateTestCase(tc, historyRef.current);
        setCaseEvaluation(evaluation);
        setEvents((prev) => [
          {
            id: `evt-case-complete-${nextTick}-${Date.now()}`,
            tick: nextTick,
            timeString: `${Math.floor(nextTick * SIMULATION_MINUTES_PER_TICK)}:00`,
            tone: evaluation.status === 'pass' ? 'system' : 'warning',
            title: `Test Case Complete: ${evaluation.status === 'pass' ? 'Expected signals observed' : 'Review required'}`,
            detail: `${tc.shortLabel}: ${evaluation.score}% of configured checks passed. This is a simulated scenario result.`,
          },
          ...prev.slice(0, 30),
        ]);
      }
    }
  }, [commitCurrentFrame]);

  const applyLiveConfig = useCallback((nextConfig: SimulationConfig, contextNote = '') => {
    const prevConfig = configRef.current;
    const prevState = calculateProcessState(prevConfig, tickRef.current);
    const nextState = calculateProcessState(nextConfig, tickRef.current);
    const domainModel = getDomainModel(nextConfig.profile);
    const impactText = domainModel.explainImpact(prevConfig, nextConfig, prevState, nextState);

    configRef.current = nextConfig;
    const { frame, nextInspection } = generateSimulationFrame(
      tickRef.current,
      nextConfig,
      activeParamsRef.current,
      currentTelemetryRef.current.sensors,
      inspectionRef.current,
      brokenEdgeIdsRef.current,
      false
    );

    const riskSummary =
      frame.risk.stage === currentTelemetryRef.current.risk.stage
        ? `Risk stage unchanged (${frame.risk.stage}, ${frame.risk.riskScore}/100).`
        : `Risk shifted to ${frame.risk.stage} (${frame.risk.riskScore}/100).`;

    setLastImpactSummary(`${contextNote}${impactText} ${riskSummary}`);
    setConfig(nextConfig);
    commitCurrentFrame(frame, nextInspection);
  }, [commitCurrentFrame]);

  const applyManualConfig = useCallback((nextConfig: SimulationConfig, changedControl: string) => {
    const previous = configRef.current;
    const completedOrRunningCase = previous.testCaseId ? getTestCase(previous.testCaseId) : undefined;
    const customConfig: SimulationConfig = {
      ...nextConfig,
      testCaseId: undefined,
      testCaseStartTick: undefined,
    };

    if (completedOrRunningCase) {
      setActiveCaseId(undefined);
      setCaseEvaluation(undefined);
      const minutes = Math.floor(tickRef.current * SIMULATION_MINUTES_PER_TICK);
      setEvents((current) => [
        {
          id: `evt-custom-fork-${tickRef.current}-${Date.now()}`,
          tick: tickRef.current,
          timeString: `${String(minutes).padStart(2, '0')}:00`,
          tone: 'watch',
          title: 'Test case continued as custom conditions',
          detail: `${completedOrRunningCase.shortLabel} benchmark evaluation ended after the ${changedControl} adjustment. Earlier readings remain as history; the forecast now uses the edited settings.`,
        },
        ...current.slice(0, 30),
      ]);
    }

    const contextNote = completedOrRunningCase
      ? `Custom run forked from ${completedOrRunningCase.shortLabel} after changing ${changedControl}. Past readings are retained. `
      : `Custom conditions updated after changing ${changedControl}; forecast recalculated from the current tick. `;
    applyLiveConfig(customConfig, contextNote);
  }, [applyLiveConfig]);

  // Animation / Interval timer loop
  useEffect(() => {
    if (!running) return;
    const intervalMs = Math.max(100, Math.round(900 / config.speed));
    const timer = setInterval(() => {
      stepTick();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [running, config.speed, stepTick]);

  // Controls
  const start = useCallback(() => setRunning(true), []);
  const pause = useCallback(() => setRunning(false), []);

  const reset = useCallback(() => {
    const resetConfig: SimulationConfig = {
      ...configRef.current,
      testCaseId: undefined,
      testCaseStartTick: undefined,
    };
    configRef.current = resetConfig;
    setConfig(resetConfig);
    setRunning(false);
    tickRef.current = 0;
    setTick(0);
    const { frame: initialFrame, nextInspection } = generateSimulationFrame(
      0,
      resetConfig,
      activeParamsRef.current,
      undefined,
      undefined,
      brokenEdgeIdsRef.current
    );
    replaceSimulationFrame(initialFrame, nextInspection);
    setActiveCaseId(undefined);
    setCaseEvaluation(undefined);
    setLastImpactSummary('Simulation reset to initial equilibrium.');
    setEvents([
      {
        id: `evt-reset-${Date.now()}`,
        tick: 0,
        timeString: '00:00',
        tone: 'system',
        title: 'Simulation Reset',
        detail: 'State reset to initial operating equilibrium.',
      },
    ]);
  }, [replaceSimulationFrame]);

  const setSpeed = useCallback((speed: number) => {
    setConfig((prev) => ({ ...prev, speed: Math.max(1, Math.min(5, speed)) }));
  }, []);

  const setProfile = useCallback((profile: EnvironmentProfile) => {
    const def = PROFILES.find((p) => p.id === profile) ?? PROFILES[0];
    const validScenarios = def.scenarios;
    const submode = def.defaultSubmode ?? 'none';
    const scenario = validScenarios[0];
    const sc = getScenario(scenario);

    const newConfig: SimulationConfig = {
      ...DEFAULT_CONFIG,
      profile,
      submode,
      scenario,
      ...def.defaultConfig,
      ...(sc.presetConfig ?? {}),
      response: 'monitor',
      responseSince: 0,
      testCaseId: undefined,
      testCaseStartTick: undefined,
    };

    configRef.current = newConfig;
    tickRef.current = 0;
    setConfig(newConfig);
    setBrokenEdgeIds([]);
    brokenEdgeIdsRef.current = [];
    setRunning(false);
    setTick(0);
    const { frame: initialFrame, nextInspection } = generateSimulationFrame(
      0,
      newConfig,
      activeParamsRef.current,
      undefined,
      undefined,
      brokenEdgeIdsRef.current
    );
    replaceSimulationFrame(initialFrame, nextInspection);
    setActiveCaseId(undefined);
    setCaseEvaluation(undefined);
    setLastImpactSummary(`Environment switched to ${def.label}. Physical process model & sensor network initialized.`);
  }, [replaceSimulationFrame]);

  const setTransitSubmode = useCallback((submode: TransitSubmode) => {
    const next = { ...configRef.current, submode, testCaseId: undefined, testCaseStartTick: undefined };
    configRef.current = next;
    tickRef.current = 0;
    setConfig(next);
    setRunning(false);
    setTick(0);
    const { frame, nextInspection } = generateSimulationFrame(
      0,
      next,
      activeParamsRef.current,
      undefined,
      undefined,
      brokenEdgeIdsRef.current
    );
    replaceSimulationFrame(frame, nextInspection);
    setActiveCaseId(undefined);
    setCaseEvaluation(undefined);
    const isRail = submode === 'rail-wagon';
    setLastImpactSummary(
      isRail
        ? 'Transit submode: Unit Train Rail Wagon (open hopper, slipstream airflow, cyclic bogie vibration).'
        : 'Transit submode: Road Tipper Truck (tarp cover, trapped heat/gas, highway suspension bumps).'
    );
  }, [replaceSimulationFrame]);

  const setScenario = useCallback((scenario: ScenarioId) => {
    const sc = getScenario(scenario);
    const next: SimulationConfig = {
      ...configRef.current,
      scenario,
      response: 'monitor',
      responseSince: 0,
      testCaseId: undefined,
      testCaseStartTick: undefined,
      ...(sc.presetConfig ?? {}),
    };
    configRef.current = next;
    tickRef.current = 0;
    setConfig(next);
    setRunning(false);
    setTick(0);
    const { frame, nextInspection } = generateSimulationFrame(
      0,
      next,
      activeParamsRef.current,
      undefined,
      undefined,
      brokenEdgeIdsRef.current
    );
    replaceSimulationFrame(frame, nextInspection);
    setActiveCaseId(undefined);
    setCaseEvaluation(undefined);
    setLastImpactSummary(`Scenario set to '${sc.label}'. Expected trend: ${sc.expectedTrend ?? 'See trajectory.'}`);
  }, [replaceSimulationFrame]);

  const setWeather = useCallback((weather: WeatherCondition) => {
    if (weather === configRef.current.weather) return;
    applyManualConfig({ ...configRef.current, weather }, 'weather');
  }, [applyManualConfig]);

  const updateParameter = useCallback(
    <K extends keyof SimulationConfig>(key: K, value: SimulationConfig[K]) => {
      if (Object.is(configRef.current[key], value)) return;
      applyManualConfig({ ...configRef.current, [key]: value }, PARAMETER_LABELS[key] ?? String(key));
    },
    [applyManualConfig]
  );

  const restoreScenarioPreset = useCallback(() => {
    const sc = getScenario(configRef.current.scenario);
    if (!sc.presetConfig) return;
    const restored: SimulationConfig = {
      ...configRef.current,
      ...sc.presetConfig,
      testCaseId: undefined,
      testCaseStartTick: undefined,
    };
    setActiveCaseId(undefined);
    setCaseEvaluation(undefined);
    applyLiveConfig(restored);
    setLastImpactSummary(`Restored benchmark preset parameters for '${sc.label}'.`);
  }, [applyLiveConfig]);

  const triggerResponseAction = useCallback((action: ResponseAction) => {
    const updatedConfig: SimulationConfig = {
      ...configRef.current,
      response: action,
      responseSince: tickRef.current,
    };
    applyLiveConfig(updatedConfig);

    setEvents((prev) => [
      {
        id: `evt-act-${tickRef.current}-${Date.now()}`,
        tick: tickRef.current,
        timeString: `${Math.floor(tickRef.current * SIMULATION_MINUTES_PER_TICK)}:00`,
        tone: 'response',
        title: `Operator Action Triggered: ${action.toUpperCase()}`,
        detail:
          action === 'cool'
            ? 'Active deluge / water spray activated.'
            : action === 'stop'
            ? 'Conveyor / equipment emergency isolation stop ordered.'
            : action === 'inspect'
            ? 'Mobile thermal survey rover dispatched to active zone.'
            : 'Continuous sensor monitoring active.',
      },
      ...prev.slice(0, 30),
    ]);
  }, [applyLiveConfig]);

  // PSO Execution
  const runPso = useCallback((swarmSize = 24, maxIterations = 40, seed = 42) => {
    const result = executePsoCalibration(swarmSize, maxIterations, seed);
    setPsoResult(result);
    setActiveParams(result.optimizedParameters);
    activeParamsRef.current = result.optimizedParameters;
    const { frame: updatedFrame, nextInspection } = generateSimulationFrame(
      tickRef.current,
      configRef.current,
      result.optimizedParameters,
      currentTelemetryRef.current.sensors,
      inspectionRef.current,
      brokenEdgeIdsRef.current,
      false
    );
    commitCurrentFrame(updatedFrame, nextInspection);
    setLastImpactSummary('Mamdani FIS membership thresholds re-calibrated via Particle Swarm Optimization.');
  }, [commitCurrentFrame]);

  const resetPsoToDefault = useCallback(() => {
    setActiveParams(DEFAULT_PSO_PARAMETERS);
    activeParamsRef.current = DEFAULT_PSO_PARAMETERS;
    const { frame: updatedFrame, nextInspection } = generateSimulationFrame(
      tickRef.current,
      configRef.current,
      DEFAULT_PSO_PARAMETERS,
      currentTelemetryRef.current.sensors,
      inspectionRef.current,
      brokenEdgeIdsRef.current,
      false
    );
    commitCurrentFrame(updatedFrame, nextInspection);
    setLastImpactSummary('Mamdani FIS membership functions reset to textbook expert defaults.');
  }, [commitCurrentFrame]);

  // SCADA Topology Integration
  const toggleTopologyEdge = useCallback((edgeId: string) => {
    const previous = brokenEdgeIdsRef.current;
    const next = previous.includes(edgeId)
      ? previous.filter((id) => id !== edgeId)
      : [...previous, edgeId];
    brokenEdgeIdsRef.current = next;
    setBrokenEdgeIds(next);

    const { frame, nextInspection } = generateSimulationFrame(
      tickRef.current,
      configRef.current,
      activeParamsRef.current,
      currentTelemetryRef.current.sensors,
      inspectionRef.current,
      next,
      false
    );
    commitCurrentFrame(frame, nextInspection);
    setLastImpactSummary(
      next.includes(edgeId)
        ? `Fieldbus cable ${edgeId} severed. Connected sensor telemetry is now offline.`
        : `Fieldbus cable ${edgeId} restored. Sensor telemetry transmission resumed.`
    );
  }, [commitCurrentFrame]);

  const resetTopologyEdges = useCallback(() => {
    setBrokenEdgeIds([]);
    brokenEdgeIdsRef.current = [];
    const { frame: updatedFrame, nextInspection } = generateSimulationFrame(
      tickRef.current,
      configRef.current,
      activeParamsRef.current,
      currentTelemetryRef.current.sensors,
      inspectionRef.current,
      [],
      false
    );
    commitCurrentFrame(updatedFrame, nextInspection);
    setLastImpactSummary('All fieldbus telemetry and actuator cables restored to normal operation.');
  }, [commitCurrentFrame]);

  const projection = useMemo(
    () => generateProjectedFrames(
      tick,
      24,
      config,
      activeParams,
      currentTelemetry,
      inspection,
      brokenEdgeIds
    ),
    [tick, config, activeParams, currentTelemetry, inspection, brokenEdgeIds]
  );

  // Test Case Runner
  const startTestCase = useCallback((id: TestCaseId) => {
    const tc = getTestCase(id);
    if (!tc) return;

    const newConfig: SimulationConfig = {
      ...DEFAULT_CONFIG,
      profile: tc.profile,
      submode: tc.submode ?? 'none',
      scenario: tc.scenario,
      weather: tc.weather,
      ...tc.config,
      testCaseId: tc.id,
      testCaseStartTick: 0,
      response: 'monitor',
      responseSince: 0,
    };

    configRef.current = newConfig;
    tickRef.current = 0;
    brokenEdgeIdsRef.current = [];
    setBrokenEdgeIds([]);
    setConfig(newConfig);
    setActiveCaseId(id);
    setCaseEvaluation(undefined);
    setRunning(true);
    setTick(0);

    const { frame: frame0, nextInspection } = generateSimulationFrame(
      0,
      newConfig,
      activeParamsRef.current,
      undefined,
      undefined,
      brokenEdgeIdsRef.current
    );
    replaceSimulationFrame(frame0, nextInspection);
    setLastImpactSummary(`Test case loaded: ${tc.shortLabel}. Objective: ${tc.objective}`);

    setEvents((prev) => [
      {
        id: `evt-tc-${Date.now()}`,
        tick: 0,
        timeString: '00:00',
        tone: 'system',
        title: `Test Case Started: ${tc.shortLabel}`,
        detail: tc.objective,
      },
      ...prev.slice(0, 30),
    ]);
  }, [replaceSimulationFrame]);

  const snapshot: SimulationSnapshot = {
    config,
    running,
    tick,
    telemetry: currentTelemetry,
    history,
    projection,
    events,
    inspection,
    psoResult,
    lastImpactSummary,
    isCustomized: !config.testCaseId && checkIfCustomized(config),
    brokenEdgeIds,
    caseRun: activeCaseId
      ? {
          testCaseId: activeCaseId,
          status: running
            ? 'running'
            : tick < (getTestCase(activeCaseId)?.durationTicks ?? 0)
            ? 'paused'
            : 'complete',
          phaseId: 'phase-1',
          phaseLabel: 'Live Evaluation',
          startedAtTick: 0,
          evaluation: caseEvaluation,
        }
      : undefined,
  };

  return (
    <SimulationContext.Provider
      value={{
        snapshot,
        start,
        pause,
        reset,
        step: stepTick,
        setSpeed,
        setProfile,
        setTransitSubmode,
        setScenario,
        setWeather,
        updateParameter,
        triggerResponseAction,
        restoreScenarioPreset,
        runPso,
        resetPsoToDefault,
        startTestCase,
        activeCaseEvaluation: caseEvaluation,
        brokenEdgeIds,
        toggleTopologyEdge,
        resetTopologyEdges,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation(): SimulationContextValue {
  const ctx = useContext(SimulationContext);
  if (!ctx) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return ctx;
}
