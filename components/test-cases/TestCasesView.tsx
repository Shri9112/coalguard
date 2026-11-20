'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { evaluateTestCase, TEST_CASES } from '../../lib/data/test-cases';
import { runComparativeEvaluation } from '../../lib/engine/evaluation';
import { useSimulation } from '../../lib/state/SimulationContext';
import { TestCaseDefinition, TestCaseId } from '../../lib/types';
import styles from './TestCases.module.css';

export default function TestCasesView() {
  const { snapshot, startTestCase, runPso, resetPsoToDefault } = useSimulation();
  const [expandedCaseId, setExpandedCaseId] = useState<TestCaseId | null>(null);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);

  // Re-run comparative evaluations using current PSO parameters
  const comparativeMetrics = useMemo(() => {
    return runComparativeEvaluation(snapshot.psoResult.optimizedParameters);
  }, [snapshot.psoResult]);

  const handleExportCsv = () => {
    const headers = [
      'Model',
      'False Alarm Rate (%)',
      'Detection Delay (ticks)',
      'Lead Time (ticks)',
      'Precision (%)',
      'Recall (%)',
      'F1 Score (%)',
      'F1 Under Sensor Stress (% of baseline)',
    ];
    const rows = comparativeMetrics.map((m) => [
      `"${m.model}"`,
      m.falseAlarmRate,
      m.detectionDelay === null ? 'N/A' : m.detectionDelay,
      m.leadTime === null ? 'N/A' : m.leadTime,
      m.precision,
      m.recall,
      m.f1,
      m.robustness === null ? 'N/A' : m.robustness,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `coalguard-comparative-benchmark-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const data = {
      benchmarkRunDate: new Date().toISOString(),
      disclaimer: 'Synthetic educational scenario evaluation. Not field validation.',
      psoOptimizedParameters: snapshot.psoResult.optimizedParameters,
      comparativeMetrics,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `coalguard-comparative-benchmark-${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const pso = snapshot.psoResult;

  const handleToggleExpand = (id: TestCaseId) => {
    setExpandedCaseId((prev) => (prev === id ? null : id));
  };

  const handleRunCase = (e: React.MouseEvent, tc: TestCaseDefinition) => {
    e.stopPropagation();
    startTestCase(tc.id);
    setExpandedCaseId(tc.id);
  };

  const handleExecutePso = () => {
    setIsCalibrating(true);
    setTimeout(() => {
      runPso(24, 40, 42);
      setIsCalibrating(false);
    }, 150);
  };

  // PSO Convergence Graph SVG Path
  const psoTrace = pso.convergenceTrace ?? [];
  const svgWidth = 500;
  const svgHeight = 120;
  const maxIter = Math.max(1, psoTrace[psoTrace.length - 1]?.iteration ?? 40);
  const maxCost = Math.max(10, psoTrace[0]?.bestCost ?? 100);

  const getPsoX = (iter: number) => 30 + (iter / maxIter) * (svgWidth - 60);
  const getPsoY = (cost: number) => svgHeight - 20 - (cost / maxCost) * (svgHeight - 40);

  const psoPath = psoTrace.length > 0
    ? psoTrace.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getPsoX(p.iteration)} ${getPsoY(p.bestCost)}`).join(' ')
    : '';

  return (
    <div className={styles.testCasesWorkspace}>
      {/* 1. TEST CASE LAB HEADER */}
      <section className={styles.sectionHeader}>
        <h2 className={styles.title}>Test Cases</h2>
        <p className={styles.sub}>
          Choose a case to run its scenario, review the sensor changes, and see whether its expected behavior occurred.
        </p>
      </section>

      {/* 2. EXPANDABLE TEST CASE ROWS */}
      <section className={styles.casesTable}>
        {TEST_CASES.map((tc, idx) => {
          const isExpanded = expandedCaseId === tc.id;
          const isActiveInSim = snapshot.config.testCaseId === tc.id;

          // If this case is currently running or just finished in simulation, evaluate live history
          const evaluation = isActiveInSim
            ? evaluateTestCase(tc, snapshot.history)
            : evaluateTestCase(tc, []);
          const caseStatus = isActiveInSim ? snapshot.caseRun?.status : undefined;

          const statusClass =
            caseStatus === 'running'
              ? styles.statusRunning
              : caseStatus === 'paused'
              ? styles.statusPaused
              : evaluation.status === 'pass'
              ? styles.statusPass
              : evaluation.status === 'needs-review'
              ? styles.statusReview
              : styles.statusNotRun;

          return (
            <div key={tc.id} className={styles.caseRow}>
              {/* Row Header */}
              <div
                className={styles.caseRowHeader}
                onClick={() => handleToggleExpand(tc.id)}
              >
                <div className={styles.caseLeft}>
                  <div className={styles.caseNumber}>{String(idx + 1).padStart(2, '0')}</div>
                  <div className={styles.caseMeta}>
                    <div className={styles.caseTitle}>{tc.label}</div>
                    <div className={styles.caseObjective}>{tc.objective}</div>
                  </div>
                </div>

                <div className={styles.caseRight}>
                  <span className={styles.focusBadge}>{tc.focus.toUpperCase()}</span>
                  <span className={`${styles.statusPill} ${statusClass}`}>
                    {caseStatus === 'running'
                      ? `RUNNING · ${snapshot.tick}/${tc.durationTicks}`
                      : caseStatus === 'paused'
                      ? 'PAUSED'
                      : evaluation.status.replace('-', ' ')}
                  </span>
                  <button
                    type="button"
                    className={styles.runBtn}
                    onClick={(e) => handleRunCase(e, tc)}
                  >
                    <Play size={13} /> Run Case
                  </button>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {/* In-Place Expanded Panel */}
              {isExpanded && (
                <div className={styles.caseExpanded}>
                  <div className={styles.expandedGrid}>
                    {/* Left: Preset Parameters & Multi-Phase Timeline */}
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 700, marginBottom: 8 }}>
                        Multi-Phase Test Timeline & Modifiers
                      </div>
                      <div className={styles.phaseList}>
                        {tc.phases.map((ph) => (
                          <div key={ph.id} className={styles.phaseItem}>
                            <div>
                              <strong>{ph.label}</strong> (Ticks {ph.startTick}–{ph.endTick})
                              <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{ph.detail}</div>
                            </div>
                            <span className="code-badge">
                              {Object.entries(ph.modifiers)
                                .map(([k, v]) => `${k}:${v}`)
                                .join(' ') || 'Baseline'}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: 14 }}>
                        <strong style={{ fontSize: '0.84rem' }}>Fixed Configuration Preset:</strong>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 6 }}>
                          <span className="code-badge">Weather: {tc.weather}</span>
                          <span className="code-badge">Load: {tc.config.load}%</span>
                          <span className="code-badge">Moisture: {tc.config.moisture}%</span>
                          <span className="code-badge">Compaction: {tc.config.compaction}%</span>
                          <span className="code-badge">Ventilation: {tc.config.ventilation}%</span>
                          <span className="code-badge">Noise: {tc.config.sensorNoise}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Explicit Acceptance Checks & Evaluation */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>
                          Programmatic Acceptance Assertions
                        </span>
                        <span className="code-badge">
                          Score: {evaluation.score}% ({evaluation.checks.filter((c) => c.passed).length}/{evaluation.checks.length} Passed)
                        </span>
                      </div>

                      <div className={styles.checksList}>
                        {evaluation.checks.map((chk) => (
                          <div key={chk.id} className={styles.checkItem}>
                            {chk.passed ? (
                              <CheckCircle2 size={16} className={styles.checkPassed} />
                            ) : (
                              <AlertCircle size={16} className={styles.checkFailed} />
                            )}
                            <div style={{ flex: 1 }}>
                              <strong>{chk.description}</strong>
                              <div style={{ fontSize: '0.76rem', color: '#cbd5e1', marginTop: 2 }}>
                                {chk.message}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Observations */}
                      <div style={{ marginTop: 12, background: 'var(--bg-card)', padding: 12, borderRadius: 6 }}>
                        <strong style={{ fontSize: '0.8rem', color: '#22d3ee' }}>Run Observations:</strong>
                        <ul style={{ paddingLeft: 18, marginTop: 4, fontSize: '0.78rem', color: '#94a3b8' }}>
                          {evaluation.observations.map((obs, oIdx) => (
                            <li key={oIdx}>{obs}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* 3. FAIR MODEL COMPARISON BENCHMARK TABLE */}
      <section className={styles.benchmarksCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              Compare the decision methods
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Metrics are calculated against synthetic labels across nine repeatable scenario traces.
            </p>
            <p style={{ fontSize: '0.78rem', color: '#8192aa', marginTop: 5 }}>
              Stress comparison replays those traces with 25% sensor noise and 15% dropout. It is not field validation.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="code-badge">Synthetic Scenario Evaluation</span>
            <button
              onClick={handleExportCsv}
              className="btn btn-secondary"
              style={{ fontSize: '0.74rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
              title="Download comparative metrics table as CSV"
            >
              <Download size={13} />
              Export CSV
            </button>
            <button
              onClick={handleExportJson}
              className="btn btn-secondary"
              style={{ fontSize: '0.74rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
              title="Download complete benchmark results as JSON"
            >
              <Download size={13} />
              Export JSON
            </button>
          </div>
        </div>

        <table className={styles.benchTable}>
          <thead>
            <tr>
              <th>Decision Engine Model</th>
              <th>False Alarm Rate (FPR)</th>
              <th>Detection Delay</th>
              <th>Lead Time</th>
              <th>Precision</th>
              <th>Recall</th>
              <th>F1 Score</th>
              <th>F1 Under Sensor Stress</th>
            </tr>
          </thead>
          <tbody>
            {comparativeMetrics.map((row) => (
              <tr key={row.model}>
                <td>
                  <strong>{row.model}</strong>
                </td>
                <td style={{ color: row.falseAlarmRate > 15 ? '#f87171' : '#34d399', fontWeight: 600 }}>
                  {row.falseAlarmRate}%
                </td>
                <td>{row.detectionDelay === null ? 'N/A' : `${row.detectionDelay} ticks`}</td>
                <td>{row.leadTime === null ? 'N/A' : `${row.leadTime} ticks`}</td>
                <td>{row.precision}%</td>
                <td>{row.recall}%</td>
                <td>
                  <strong style={{ color: '#22d3ee', fontSize: '0.92rem' }}>{row.f1}%</strong>
                </td>
                <td>{row.robustness === null ? 'N/A' : `${row.robustness}% of baseline F1`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 4. REAL PARTICLE SWARM OPTIMIZATION (PSO) WORKBENCH */}
      <section className={styles.psoCard}>
        <div className={styles.psoTop}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={18} color="#22d3ee" />
              Tune the model with PSO
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Offline calibration tunes membership breakpoints and rule weights to minimize false alarms on dust/steam interference.
            </p>
          </div>

          <div className={styles.psoControls}>
            <button
              type="button"
              className={styles.runBtn}
              onClick={handleExecutePso}
              disabled={isCalibrating}
            >
              <Sparkles size={14} />
              {isCalibrating ? 'Swarm Calibrating...' : 'Calibrate Swarm (Seed: 42)'}
            </button>

            <button
              type="button"
              className={styles.runBtn}
              style={{ background: '#334155' }}
              onClick={resetPsoToDefault}
            >
              <RotateCcw size={14} /> Reset Defaults
            </button>
          </div>
        </div>

        <div className={styles.psoGrid}>
          {/* Convergence Trace Graph */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 6 }}>
              <span>Convergence Trace: Objective Loss J(θ)</span>
              <span>
                Final Best Cost: <strong style={{ color: '#34d399' }}>{pso.bestCost}</strong>
              </span>
            </div>

            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className={styles.psoTraceSvg}>
              {/* Gridlines */}
              <line x1="30" y1={svgHeight - 20} x2={svgWidth - 30} y2={svgHeight - 20} stroke="#263d63" />
              <line x1="30" y1="20" x2="30" y2={svgHeight - 20} stroke="#263d63" />

              {/* Convergence Line */}
              {psoPath && <path d={psoPath} fill="none" stroke="#22d3ee" strokeWidth="2.5" />}

              {/* Marker on end point */}
              {psoTrace.length > 0 && (
                <circle
                  cx={getPsoX(psoTrace[psoTrace.length - 1].iteration)}
                  cy={getPsoY(pso.bestCost)}
                  r="4"
                  fill="#10b981"
                />
              )}
            </svg>

            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: 4 }}>
              Optimization ran {pso.particles} particles across {pso.iterations} iterations. Inertia w: 0.85 → 0.40, c1: 1.6, c2: 1.9.
            </div>
          </div>

          {/* Parameter Tuning Shift Table */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 6 }}>
              Parameter Shifts (Heuristic Baseline → Swarm Tuned)
            </div>
            <table className={styles.paramChangesTable}>
              <thead>
                <tr>
                  <th>Parameter Name</th>
                  <th>Before</th>
                  <th>Optimized</th>
                  <th>Shift</th>
                </tr>
              </thead>
              <tbody>
                {pso.parameterChanges.slice(0, 6).map((param) => (
                  <tr key={param.name}>
                    <td>
                      <span className="code-badge">{param.name}</span>
                    </td>
                    <td>{param.before}</td>
                    <td>
                      <strong style={{ color: '#22d3ee' }}>{param.after}</strong>
                    </td>
                    <td style={{ color: param.changePercent > 0 ? '#34d399' : '#fbbf24' }}>
                      {param.changePercent > 0 ? `+${param.changePercent}%` : `${param.changePercent}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
