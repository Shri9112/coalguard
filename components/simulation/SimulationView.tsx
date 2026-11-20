'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  FileText,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Sliders,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { PROFILES } from '../../lib/data/profiles';
import { getScenario, getScenariosForProfile } from '../../lib/data/scenarios';
import { useSimulation } from '../../lib/state/SimulationContext';
import {
  ResponseAction,
  ScenarioId,
  SimulationConfig,
  TelemetryFrame,
  WeatherCondition,
} from '../../lib/types';
import { sound } from '../../lib/utils/sound';
import LabReportModal from './LabReportModal';
import ProcessVisualization from './ProcessVisualization';
import styles from './SimulationWorkspace.module.css';

const CHART_SIGNALS = [
  { key: 'risk', label: 'Risk', range: '0–100', unit: '/100', color: '#22d3ee', max: 100, value: (frame: TelemetryFrame) => frame.risk.riskScore },
  { key: 'temperature', label: 'Temperature', range: '0–120 °C', unit: '°C', color: '#f59e0b', max: 120, value: (frame: TelemetryFrame) => Math.max(frame.surfaceHeat, frame.bulkTemperature ?? 0, ...frame.sensors.filter((sensor) => sensor.type === 'temperature').map((sensor) => sensor.value)) },
  { key: 'co', label: 'CO', range: '0–150 ppm', unit: 'ppm', color: '#c084fc', max: 150, value: (frame: TelemetryFrame) => Math.max(frame.gasState, ...frame.sensors.filter((sensor) => sensor.type === 'co').map((sensor) => sensor.value)) },
  { key: 'coreHeat', label: 'Core heat', range: '0–100', unit: '/100', color: '#fb7185', max: 100, value: (frame: TelemetryFrame) => frame.heatState },
  { key: 'current', label: 'Motor current', range: '0–120%', unit: '%', color: '#10b981', max: 120, value: (frame: TelemetryFrame) => frame.motorCurrent },
  { key: 'vibration', label: 'Vibration', range: '0–10 g', unit: 'g', color: '#84cc16', max: 10, value: (frame: TelemetryFrame) => Math.max(frame.frictionState, ...frame.sensors.filter((sensor) => sensor.type === 'vibration').map((sensor) => sensor.value)) },
  { key: 'airflow', label: 'Airflow', range: '0–10 m/s', unit: 'm/s', color: '#38bdf8', max: 10, value: (frame: TelemetryFrame) => frame.airflowSpeed ?? 1.5 },
  { key: 'dust', label: 'Dust', range: '0–200 mg/m³', unit: 'mg/m³', color: '#e879f9', max: 200, value: (frame: TelemetryFrame) => Math.max(frame.dustState, ...frame.sensors.filter((sensor) => sensor.type === 'dust').map((sensor) => sensor.value)) },
  { key: 'moisture', label: 'Coal moisture', range: '0–100%', unit: '%', color: '#60a5fa', max: 100, value: (frame: TelemetryFrame) => frame.coalMoisture },
  { key: 'compaction', label: 'Compaction', range: '0–100%', unit: '%', color: '#f97316', max: 100, value: (frame: TelemetryFrame) => frame.compaction },
  { key: 'load', label: 'Coal load', range: '0–100%', unit: '%', color: '#a3e635', max: 100, value: (frame: TelemetryFrame) => frame.load },
  { key: 'confidence', label: 'Confidence', range: '0–100%', unit: '%', color: '#f472b6', max: 100, value: (frame: TelemetryFrame) => frame.risk.confidence },
] as const;

type ChartSignalKey = (typeof CHART_SIGNALS)[number]['key'];
type ComparisonSignalKey = Exclude<ChartSignalKey, 'risk'>;

const WEATHER_OPTIONS: { id: WeatherCondition; label: string }[] = [
  { id: 'hot-dry', label: 'Hot & Dry (39 °C)' },
  { id: 'humid', label: 'Humid (32 °C, 78% RH)' },
  { id: 'rainy', label: 'Rainy / Wet (24 °C)' },
  { id: 'cool', label: 'Cool (18 °C)' },
  { id: 'windy', label: 'Windy (Airflow 1.5x)' },
];

const PROFILE_CHART_SIGNAL: Record<string, ComparisonSignalKey> = {
  'mine-conveyor': 'temperature',
  'factory-chp': 'current',
  stockpile: 'coreHeat',
  transit: 'vibration',
  'cargo-hold': 'co',
};

const SCENARIO_CHART_SIGNAL: Partial<Record<ScenarioId, ComparisonSignalKey>> = {
  normal: 'temperature',
  'self-heating': 'temperature',
  'belt-friction': 'vibration',
  'transfer-blockage': 'current',
  'dust-steam': 'dust',
  'sensor-fault': 'confidence',
  'hidden-hotspot': 'coreHeat',
  'hold-asphyxiation': 'co',
};

export default function SimulationView() {
  const {
    snapshot,
    start,
    pause,
    reset,
    step,
    setSpeed,
    setProfile,
    setTransitSubmode,
    setScenario,
    setWeather,
    updateParameter,
    triggerResponseAction,
    restoreScenarioPreset,
  } = useSimulation();

  const {
    config,
    running,
    telemetry,
    history,
    projection,
    events,
    inspection,
    lastImpactSummary,
    isCustomized,
  } = snapshot;

  const scenarios = getScenariosForProfile(config.profile);
  const currentScenarioDef = getScenario(config.scenario);

  const [comparisonSignal, setComparisonSignal] = useState<ComparisonSignalKey>('temperature');

  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => sound.isMuted());

  const parameterSignal: Partial<Record<keyof SimulationConfig, ComparisonSignalKey>> = {
    load: 'current',
    moisture: 'temperature',
    compaction: 'coreHeat',
    ventilation: 'airflow',
    sensorNoise: 'confidence',
    sensorDropout: 'confidence',
    sprayAvailable: 'temperature',
  };
  const updateAndFocusSignal = <K extends keyof SimulationConfig>(key: K, value: SimulationConfig[K]) => {
    updateParameter(key, value);
    const nextSignal = parameterSignal[key];
    if (nextSignal) setComparisonSignal(nextSignal);
  };

  // Trajectory Chart Dimensions & Scaling
  const chartWidth = 700;
  const chartHeight = 160;

  const actualStartTick = history[0]?.tick ?? telemetry.tick;
  const chartEndTick = Math.max(telemetry.tick + 1, projection[projection.length - 1]?.tick ?? telemetry.tick);
  const getX = (frameTick: number) =>
    40 + ((frameTick - actualStartTick) / Math.max(1, chartEndTick - actualStartTick)) * (chartWidth - 80);
  const getY = (value: number, max: number) =>
    chartHeight - 20 - (Math.min(max, Math.max(0, value)) / max) * (chartHeight - 40);
  const actualFrames = history;
  const projectedFrames = useMemo(() => [telemetry, ...projection], [telemetry, projection]);
  const riskSignal = CHART_SIGNALS[0];
  const selectedSignal = CHART_SIGNALS.find((signal) => signal.key === comparisonSignal)!;

  // Interactive trajectory scrubber and tooltip inspection
  const [hoveredTick, setHoveredTick] = useState<number | null>(null);

  const allChartFrames = useMemo(() => {
    const map = new Map<number, TelemetryFrame>();
    actualFrames.forEach((f) => map.set(f.tick, f));
    projectedFrames.forEach((f) => map.set(f.tick, f));
    return map;
  }, [actualFrames, projectedFrames]);

  const hoveredFrame = hoveredTick !== null ? allChartFrames.get(hoveredTick) : null;
  const isHoveredProjected = hoveredFrame ? hoveredFrame.tick > telemetry.tick : false;

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const mouseX = ((e.clientX - rect.left) / rect.width) * chartWidth;
    if (mouseX < 30 || mouseX > chartWidth - 30) {
      setHoveredTick(null);
      return;
    }
    const ratio = Math.max(0, Math.min(1, (mouseX - 40) / (chartWidth - 80)));
    const tickVal = Math.round(actualStartTick + ratio * (chartEndTick - actualStartTick));
    if (allChartFrames.has(tickVal)) {
      setHoveredTick(tickVal);
    } else {
      let closestTick = actualStartTick;
      let minDiff = Infinity;
      allChartFrames.forEach((_, t) => {
        const diff = Math.abs(t - tickVal);
        if (diff < minDiff) {
          minDiff = diff;
          closestTick = t;
        }
      });
      setHoveredTick(closestTick);
    }
  };

  const handleSvgMouseLeave = () => {
    setHoveredTick(null);
  };

  // Monotone Cubic Spline (Fritsch-Carlson) for smooth, accurate trajectory curves without overshoots
  const buildSmoothPath = (frames: TelemetryFrame[], signal: (typeof CHART_SIGNALS)[number]) => {
    if (frames.length === 0) return '';
    const pts = frames.map((frame) => ({
      x: getX(frame.tick),
      y: getY(signal.value(frame), signal.max),
    }));
    if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    if (pts.length === 2) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;

    const n = pts.length;
    const dx: number[] = [];
    const dy: number[] = [];
    const m: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const segDx = pts[i + 1].x - pts[i].x;
      const segDy = pts[i + 1].y - pts[i].y;
      dx.push(segDx);
      dy.push(segDy);
      m.push(segDx !== 0 ? segDy / segDx : 0);
    }

    const d: number[] = new Array(n).fill(0);
    d[0] = m[0];
    d[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (m[i - 1] * m[i] <= 0) {
        d[i] = 0;
      } else {
        d[i] = (2 * m[i - 1] * m[i]) / (m[i - 1] + m[i]);
      }
    }

    let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const segDx = dx[i];
      const cp1x = p0.x + segDx / 3;
      const cp1y = p0.y + (d[i] * segDx) / 3;
      const cp2x = p1.x - segDx / 3;
      const cp2y = p1.y - (d[i + 1] * segDx) / 3;
      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    return path;
  };

  const buildSmoothAreaPath = (frames: TelemetryFrame[], signal: (typeof CHART_SIGNALS)[number]) => {
    if (frames.length < 2) return '';
    const basePath = buildSmoothPath(frames, signal);
    const startX = getX(frames[0].tick);
    const endX = getX(frames[frames.length - 1].tick);
    const bottomY = chartHeight - 20;
    return `${basePath} L ${endX.toFixed(1)} ${bottomY} L ${startX.toFixed(1)} ${bottomY} Z`;
  };

  // Peak sensor readings
  const peakTemp = Math.max(
    ...telemetry.sensors.filter((s) => s.type === 'temperature').map((s) => s.value),
    telemetry.surfaceHeat
  );
  const peakCo = Math.max(
    ...telemetry.sensors.filter((s) => s.type === 'co').map((s) => s.value),
    telemetry.gasState
  );
  const motorCurrent = telemetry.sensors.find((s) => s.type === 'current')?.displayValue ?? `${telemetry.motorCurrent.toFixed(0)}%`;

  return (
    <div className={styles.simulationWorkspace}>
      {/* Top Controls: Profile Selection, Transit Submode & Scenarios */}
      <section className={styles.topControlBar}>
        <div className={styles.profileSelectorRow}>
          <span className={styles.controlLabel}>Environment Context:</span>
          {PROFILES.map((p) => {
            const isActive = config.profile === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className={`${styles.profileBtn} ${isActive ? styles.profileBtnActive : ''}`}
                onClick={() => {
                  setProfile(p.id);
                  setComparisonSignal(PROFILE_CHART_SIGNAL[p.id] ?? 'temperature');
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 99,
                    background: p.accent,
                  }}
                />
                {p.shortLabel}
              </button>
            );
          })}
        </div>

        {/* Road/Rail Transit Submode Toggle */}
        {config.profile === 'transit' && (
          <div className={styles.submodeRow}>
            <span style={{ fontWeight: 600, color: '#f59e0b' }}>Transit Vehicle Submode:</span>
            <button
              type="button"
              className={`${styles.submodeBtn} ${config.submode === 'truck' ? styles.submodeBtnActive : ''}`}
              onClick={() => {
                setTransitSubmode('truck');
                setComparisonSignal('vibration');
              }}
            >
              Road Tipper Truck (Tarp Cover · Trapped Gas · Road Bumps)
            </button>
            <button
              type="button"
              className={`${styles.submodeBtn} ${config.submode === 'rail-wagon' ? styles.submodeBtnActive : ''}`}
              onClick={() => {
                setTransitSubmode('rail-wagon');
                setComparisonSignal('airflow');
              }}
            >
              Unit Train Rail Wagon (Open Hopper · Slipstream Airflow · Bogie Roll)
            </button>
          </div>
        )}

        {/* Scenario, Weather & Playback Row */}
        <div className={styles.secondaryControlRow}>
          <div className={styles.selectGroup}>
            <span className={styles.controlLabel}>Scenario:</span>
            <select
              className={styles.dropdown}
              value={config.scenario}
              onChange={(e) => {
                const scenario = e.target.value as ScenarioId;
                setScenario(scenario);
                setComparisonSignal(SCENARIO_CHART_SIGNAL[scenario] ?? 'temperature');
              }}
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>

            <span className={styles.controlLabel} style={{ marginLeft: 12 }}>
              Weather:
            </span>
            <select
              className={styles.dropdown}
              value={config.weather}
              onChange={(e) => {
                const weather = e.target.value as WeatherCondition;
                setWeather(weather);
                setComparisonSignal(weather === 'windy' ? 'airflow' : 'temperature');
              }}
            >
              {WEATHER_OPTIONS.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </div>

          {/* Simulation Playback Actions */}
          <div className={styles.playbackCluster}>
            {running ? (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.pauseBtn}`}
                onClick={() => {
                  sound.playClick();
                  pause();
                }}
              >
                <Pause size={15} /> Pause
              </button>
            ) : (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.playBtn}`}
                onClick={() => {
                  sound.playClick();
                  start();
                }}
              >
                <Play size={15} /> Run Simulation
              </button>
            )}

            <button
              type="button"
              className={`${styles.actionBtn} ${styles.stepBtn}`}
              onClick={() => {
                sound.playClick();
                step();
              }}
              disabled={running}
            >
              <SkipForward size={14} /> Step Tick
            </button>

            <button
              type="button"
              className={`${styles.actionBtn} ${styles.resetBtn}`}
              onClick={() => {
                sound.playClick();
                reset();
              }}
            >
              <RotateCcw size={14} /> Reset
            </button>

            <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: 6 }}>Speed:</span>
            <select
              className={styles.dropdown}
              value={config.speed}
              onChange={(e) => {
                sound.playClick();
                setSpeed(Number(e.target.value));
              }}
            >
              <option value={1}>1.0x (Realtime)</option>
              <option value={2}>2.0x (Fast)</option>
              <option value={4}>4.0x (Turbo)</option>
            </select>

            {/* Synthesized Audio Mute Toggle */}
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.stepBtn}`}
              onClick={() => {
                const nextMuted = sound.toggleMute();
                setIsMuted(nextMuted);
                if (!nextMuted) sound.playClick();
              }}
              title={isMuted ? 'Unmute synthesized industrial sound' : 'Mute sound'}
              style={{ padding: '7px 10px', marginLeft: 6 }}
            >
              {isMuted ? <VolumeX size={14} color="#94a3b8" /> : <Volume2 size={14} color="#38bdf8" />}
            </button>

            {/* Academic Lab Report Export Button */}
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.stepBtn}`}
              onClick={() => {
                sound.playClick();
                setShowReportModal(true);
              }}
              title="Generate and export reproducible academic coursework report"
              style={{ borderColor: 'rgba(56, 189, 248, 0.4)', background: 'rgba(8, 47, 73, 0.35)' }}
            >
              <FileText size={14} color="#38bdf8" /> Lab Report
            </button>
          </div>
        </div>

        {/* Expected Trend Line from Scenario Benchmark */}
        {currentScenarioDef.expectedTrend && (
          <div className={styles.scenarioTrendBanner}>
            <strong>Expected Scenario Trend:</strong> {currentScenarioDef.expectedTrend}
          </div>
        )}
      </section>

      {/* Causal Feedback Callout: Process Impact Summary */}
      <section className={styles.impactCard}>
        <div className={styles.impactHeader}>
          <div className={styles.impactTitleGroup}>
            <Activity size={16} />
            <span>Process State & Evidence Impact</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isCustomized ? (
              <span className={styles.customizedBadge}>
                Customized Parameters
                <button
                  type="button"
                  className={styles.restoreBtn}
                  onClick={restoreScenarioPreset}
                  title="Reset parameters to the benchmark scenario preset"
                >
                  Restore Preset
                </button>
              </span>
            ) : (
              <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={13} /> Scenario Benchmark Preset Active
              </span>
            )}
          </div>
        </div>

        <p className={styles.impactText}>{lastImpactSummary}</p>

        {/* Live Physical Signals Bar */}
        <div className={styles.impactSignalsRow}>
          <span className={styles.impactSignalBadge}>
            Core/Bulk: <strong>{(telemetry.bulkTemperature ?? telemetry.surfaceHeat).toFixed(1)} °C</strong>
          </span>
          <span className={styles.impactSignalBadge}>
            Surface: <strong>{telemetry.surfaceHeat.toFixed(1)} °C</strong>
          </span>
          <span className={styles.impactSignalBadge}>
            CO Gas: <strong>{telemetry.gasState.toFixed(1)} ppm</strong>
          </span>
          <span className={styles.impactSignalBadge}>
            Vibration: <strong>{telemetry.frictionState.toFixed(2)} g</strong>
          </span>
          <span className={styles.impactSignalBadge}>
            Airflow: <strong>{(telemetry.airflowSpeed ?? 1.5).toFixed(1)} m/s</strong>
          </span>
          <span className={styles.impactSignalBadge}>
            Motor Current: <strong>{motorCurrent}</strong>
          </span>
          <span className={styles.impactSignalBadge}>
            Dust: <strong>{telemetry.dustState.toFixed(0)} mg/m³</strong>
          </span>
        </div>
      </section>

      {/* Main Process Schematic Canvas */}
      <ProcessVisualization
        telemetry={telemetry}
        profile={config.profile}
        submode={config.submode}
        inspection={inspection}
      />

      {/* Middle Grid: Advanced Parameters & Real-Time Trajectory */}
      <section className={styles.mainGrid}>
        {/* Left Column: Physics Controls & Operator Actions */}
        <div className={styles.paramsPanel}>
          <div className={styles.panelHead}>
            <Sliders size={16} />
            <span>Process & Telemetry Controls</span>
          </div>

          <div className={styles.paramRow}>
            <div className={styles.paramLabelRow}>
              <span>Coal Load Level</span>
              <span className="code-badge">{config.load}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.load}
              className={styles.slider}
              onChange={(e) => updateAndFocusSignal('load', Number(e.target.value))}
            />
          </div>

          <div className={styles.paramRow}>
            <div className={styles.paramLabelRow}>
              <span>Compaction / Heat Retention</span>
              <span className="code-badge">{config.compaction}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={config.compaction}
              className={styles.slider}
              onChange={(e) => updateAndFocusSignal('compaction', Number(e.target.value))}
            />
          </div>

          <div className={styles.paramRow}>
            <div className={styles.paramLabelRow}>
              <span>Ventilation / Airflow</span>
              <span className="code-badge">{config.ventilation}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={config.ventilation}
              className={styles.slider}
              onChange={(e) => updateAndFocusSignal('ventilation', Number(e.target.value))}
            />
          </div>

          <div className={styles.paramRow}>
            <div className={styles.paramLabelRow}>
              <span>Moisture Content</span>
              <span className="code-badge">{config.moisture}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="95"
              value={config.moisture}
              className={styles.slider}
              onChange={(e) => updateAndFocusSignal('moisture', Number(e.target.value))}
            />
          </div>

          <div className={styles.paramRow}>
            <div className={styles.paramLabelRow}>
              <span>Sensor Noise Floor</span>
              <span className="code-badge">{config.sensorNoise}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="45"
              value={config.sensorNoise}
              className={styles.slider}
              onChange={(e) => updateAndFocusSignal('sensorNoise', Number(e.target.value))}
            />
          </div>

          <div className={styles.paramRow}>
            <div className={styles.paramLabelRow}>
              <span>Sensor Dropout / Failure</span>
              <span className="code-badge">{config.sensorDropout}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              value={config.sensorDropout}
              className={styles.slider}
              onChange={(e) => updateAndFocusSignal('sensorDropout', Number(e.target.value))}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ fontSize: '0.84rem', color: '#cbd5e1' }}>Water Spray Suppression System</span>
            <button
              type="button"
              className={styles.actionBtn}
              style={{
                background: config.sprayAvailable ? '#0284c7' : '#1e293b',
                color: config.sprayAvailable ? '#fff' : '#64748b',
                fontSize: '0.78rem',
              }}
              onClick={() => updateAndFocusSignal('sprayAvailable', !config.sprayAvailable)}
            >
              {config.sprayAvailable ? 'System Active' : 'Offline'}
            </button>
          </div>

          {/* Response Actions */}
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
            <div className={styles.panelHead} style={{ border: 'none', padding: '0 0 10px 0' }}>
              <ShieldCheck size={16} />
              <span>Simulated Operator Response</span>
            </div>
            <div className={styles.responseRow}>
              {(['monitor', 'inspect', 'cool', 'stop'] as ResponseAction[]).map((act) => {
                const isActive = config.response === act;
                return (
                  <button
                    key={act}
                    type="button"
                    className={`${styles.responseBtn} ${isActive ? styles.responseBtnActive : ''}`}
                    onClick={() => {
                      if (act === 'stop') {
                        sound.playEmergencyStop();
                      } else {
                        sound.playClick();
                      }
                      triggerResponseAction(act);
                    }}
                  >
                    {act.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Live Trajectory Graph, Key Telemetry & Event Timeline */}
        <div className={styles.analyticsPanel}>
          <div className={styles.summaryCardsRow}>
            <div className={styles.miniCard}>
              <span className={styles.miniCardLabel}>Peak Temperature</span>
              <span className={styles.miniCardValue}>
                {peakTemp.toFixed(1)} °C
              </span>
            </div>

            <div className={styles.miniCard}>
              <span className={styles.miniCardLabel}>CO Oxidation Gas</span>
              <span className={styles.miniCardValue}>
                {peakCo.toFixed(1)} ppm
              </span>
            </div>

            <div className={styles.miniCard}>
              <span className={styles.miniCardLabel}>Decision Confidence</span>
              <span className={styles.miniCardValue}>{telemetry.risk.confidence}%</span>
            </div>
          </div>

          {/* Risk and selected process-signal trajectory */}
          <div className={styles.chartCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span className={styles.visTitle}>Telemetry & Risk Trajectory</span>

              <div className={styles.signalToggleRow}>
                <label htmlFor="simulation-chart-signal">Compare with</label>
                <select
                  id="simulation-chart-signal"
                  className={styles.dropdown}
                  value={comparisonSignal}
                  onChange={(event) => setComparisonSignal(event.target.value as ComparisonSignalKey)}
                >
                  {CHART_SIGNALS.filter((signal) => signal.key !== 'risk').map((signal) => (
                    <option key={signal.key} value={signal.key}>
                      {signal.label} ({signal.range})
                    </option>
                  ))}
                </select>
              </div>

              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Stage: <strong style={{ color: '#22d3ee' }}>{telemetry.risk.stage}</strong> ({telemetry.risk.riskScore}/100)
              </span>
            </div>

              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className={styles.chartSvg}
                onMouseMove={handleSvgMouseMove}
                onMouseLeave={handleSvgMouseLeave}
                style={{ cursor: 'crosshair' }}
              >
                {/* Gradients for smooth telemetry area fills */}
                <defs>
                  <linearGradient id="riskAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.22" />
                    <stop offset="70%" stopColor="#22d3ee" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="projRiskAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.10" />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Risk bands are a visual reference for risk-score values only. */}
                {/* Severity background bands */}
                <rect x="40" y={getY(100, 100)} width="620" height={getY(76, 100) - getY(100, 100)} fill="rgba(239, 68, 68, 0.12)" />
                <rect x="40" y={getY(75, 100)} width="620" height={getY(51, 100) - getY(75, 100)} fill="rgba(245, 158, 11, 0.10)" />
                <rect x="40" y={getY(50, 100)} width="620" height={getY(26, 100) - getY(50, 100)} fill="rgba(56, 189, 248, 0.08)" />
                <rect x="40" y={getY(25, 100)} width="620" height={getY(0, 100) - getY(25, 100)} fill="rgba(16, 185, 129, 0.06)" />

                {/* Band Threshold Lines */}
                <line x1="40" y1={getY(76, 100)} x2="660" y2={getY(76, 100)} stroke="rgba(239, 68, 68, 0.4)" strokeDasharray="3,3" />
                <text x="665" y={getY(76, 100) + 4} fill="#ef4444" fontSize="10">76 (Crit)</text>

                <line x1="40" y1={getY(51, 100)} x2="660" y2={getY(51, 100)} stroke="rgba(245, 158, 11, 0.35)" strokeDasharray="3,3" />
                <text x="665" y={getY(51, 100) + 4} fill="#f59e0b" fontSize="10">51 (Warn)</text>

                <line x1="40" y1={getY(26, 100)} x2="660" y2={getY(26, 100)} stroke="rgba(56, 189, 248, 0.3)" strokeDasharray="3,3" />
                <text x="665" y={getY(26, 100) + 4} fill="#38bdf8" fontSize="10">26 (Watch)</text>

                {/* Soft area under recorded history risk curve */}
                {actualFrames.length > 1 && (
                  <path
                    d={buildSmoothAreaPath(actualFrames, riskSignal)}
                    fill="url(#riskAreaGrad)"
                  />
                )}

                {/* Soft area under projected risk curve */}
                {projectedFrames.length > 1 && (
                  <path
                    d={buildSmoothAreaPath(projectedFrames, riskSignal)}
                    fill="url(#projRiskAreaGrad)"
                  />
                )}

                {/* Solid = recorded simulation; dashed = recalculated projection. */}
                {[riskSignal, selectedSignal].map((signal) => (
                  <g key={signal.key}>
                    <path
                      d={buildSmoothPath(actualFrames, signal)}
                      fill="none"
                      stroke={signal.color}
                      strokeWidth={signal.key === 'risk' ? 2.8 : 2.2}
                      opacity="0.88"
                    />
                    {projectedFrames.length > 1 && (
                      <path
                        d={buildSmoothPath(projectedFrames, signal)}
                        fill="none"
                        stroke={signal.color}
                        strokeWidth={signal.key === 'risk' ? 2.6 : 2.0}
                        strokeDasharray="6,4"
                        opacity="0.96"
                      />
                    )}
                  </g>
                ))}

                <line
                  x1={getX(telemetry.tick)}
                  y1="14"
                  x2={getX(telemetry.tick)}
                  y2={chartHeight - 20}
                  stroke="rgba(226,232,240,0.55)"
                  strokeDasharray="2,3"
                />
                <text x={Math.min(getX(telemetry.tick) + 5, 625)} y="13" fill="#e2e8f0" fontSize="9">NOW</text>

                {/* Live marker on current point with subtle halo */}
                <circle
                  cx={getX(telemetry.tick)}
                  cy={getY(telemetry.risk.riskScore, riskSignal.max)}
                  r="7.5"
                  fill="none"
                  stroke={riskSignal.color}
                  strokeWidth="1.5"
                  opacity="0.4"
                />
                <circle
                  cx={getX(telemetry.tick)}
                  cy={getY(telemetry.risk.riskScore, riskSignal.max)}
                  r="4.5"
                  fill={riskSignal.color}
                  stroke="#0f172a"
                  strokeWidth="2"
                />
                <circle
                  cx={getX(telemetry.tick)}
                  cy={getY(selectedSignal.value(telemetry), selectedSignal.max)}
                  r="3.5"
                  fill={selectedSignal.color}
                  stroke="#0f172a"
                  strokeWidth="1.5"
                />

                {/* Interactive Hover Inspection Scrubber & HUD */}
                {hoveredFrame && (
                  <g>
                    {/* Vertical Scrubber Line */}
                    <line
                      x1={getX(hoveredFrame.tick)}
                      y1="14"
                      x2={getX(hoveredFrame.tick)}
                      y2={chartHeight - 20}
                      stroke={isHoveredProjected ? '#f59e0b' : '#38bdf8'}
                      strokeWidth="1.5"
                      strokeDasharray="2,2"
                      opacity="0.9"
                    />
                    {/* Snap Dots */}
                    <circle
                      cx={getX(hoveredFrame.tick)}
                      cy={getY(hoveredFrame.risk.riskScore, riskSignal.max)}
                      r="5"
                      fill="#22d3ee"
                      stroke="#0f172a"
                      strokeWidth="2"
                    />
                    <circle
                      cx={getX(hoveredFrame.tick)}
                      cy={getY(selectedSignal.value(hoveredFrame), selectedSignal.max)}
                      r="4"
                      fill={selectedSignal.color}
                      stroke="#0f172a"
                      strokeWidth="1.5"
                    />
                    {/* Floating Inspection Tooltip */}
                    <g transform={`translate(${Math.min(Math.max(getX(hoveredFrame.tick) - 75, 45), chartWidth - 195)}, 16)`}>
                      <rect
                        width="150"
                        height="46"
                        rx="6"
                        fill="#090d16"
                        stroke={isHoveredProjected ? 'rgba(245, 158, 11, 0.7)' : 'rgba(56, 189, 248, 0.7)'}
                        strokeWidth="1"
                        opacity="0.95"
                      />
                      <text x="8" y="14" fill="#94a3b8" fontSize="9.5" fontWeight="600">
                        Tick {hoveredFrame.tick} ({hoveredFrame.minutes}m) · {isHoveredProjected ? 'Projection' : 'Recorded'}
                      </text>
                      <text x="8" y="27" fill="#22d3ee" fontSize="10.5" fontWeight="700">
                        Risk: {hoveredFrame.risk.riskScore}/100 [{hoveredFrame.risk.stage}]
                      </text>
                      <text x="8" y="39" fill={selectedSignal.color} fontSize="9.5" fontWeight="500">
                        {selectedSignal.label}: {selectedSignal.value(hoveredFrame).toFixed(1)} {selectedSignal.unit}
                      </text>
                    </g>
                  </g>
                )}
              </svg>
              <div className={styles.chartFootnote}>
                <span className={styles.chartReadouts}>
                  Current values: <strong style={{ color: riskSignal.color }}>Risk</strong> {telemetry.risk.riskScore}/100
                  {' · '}
                  <strong style={{ color: selectedSignal.color }}>{selectedSignal.label}</strong>{' '}
                  {selectedSignal.value(telemetry).toFixed(1)} {selectedSignal.unit}
                </span>
                <span>Solid: recorded simulation</span>
                <span>Dashed: projection under current settings · {projection.length} future ticks</span>
                <span>Changing a control selects its related signal automatically. Risk bands apply only to risk; selected scale: {selectedSignal.range}.</span>
              </div>
          </div>

          {/* Event Timeline */}
          <div className={styles.timelineCard}>
            <span className={styles.visTitle}>Live Simulation Event Timeline</span>
            <div className={styles.timelineList}>
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className={`${styles.timelineItem} ${evt.tone === 'warning'
                      ? styles.timelineToneWarning
                      : evt.tone === 'watch'
                        ? styles.timelineToneWatch
                        : evt.tone === 'response'
                          ? styles.timelineToneResponse
                          : ''
                    }`}
                >
                  <span className={styles.timelineTime}>[{evt.timeString}]</span>
                  <div>
                    <strong>{evt.title}</strong>
                    <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{evt.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Academic Lab Report Export Dialog */}
      {showReportModal && (
        <LabReportModal
          snapshot={snapshot}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
}
