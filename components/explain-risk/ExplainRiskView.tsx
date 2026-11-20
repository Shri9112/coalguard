'use client';

import React, { useState } from 'react';
import { Sliders } from 'lucide-react';
import { leftShoulder, rightShoulder, triangle } from '../../lib/engine/fuzzy-system';
import { useSimulation } from '../../lib/state/SimulationContext';
import { sound } from '../../lib/utils/sound';
import styles from './ExplainRisk.module.css';

type FuzzyVarKey = 'temp' | 'trend' | 'co' | 'vib';

interface FuzzyVarDef {
  key: FuzzyVarKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  getLiveValue: (telemetry: ReturnType<typeof useSimulation>['snapshot']['telemetry']) => number;
  calcMemberships: (x: number) => { low: number; med: number; high: number };
}

const FUZZY_VARIABLES: FuzzyVarDef[] = [
  {
    key: 'temp',
    label: 'Hotspot Temperature',
    unit: '°C',
    min: 15,
    max: 110,
    step: 0.5,
    getLiveValue: (t) => Math.max(...t.sensors.filter((s) => s.type === 'temperature').map((s) => s.value), t.surfaceHeat),
    calcMemberships: (x) => ({
      low: leftShoulder(x, 22, 45),
      med: triangle(x, 35, 55, 75),
      high: rightShoulder(x, 60, 85),
    }),
  },
  {
    key: 'trend',
    label: 'Rate of Rise (dT/dt)',
    unit: '°C/min',
    min: 0,
    max: 5.0,
    step: 0.05,
    getLiveValue: (t) => Math.max(0.01, ...t.sensors.filter((s) => s.type === 'temperature').map((s) => s.rateOfChange)),
    calcMemberships: (x) => ({
      low: leftShoulder(x, 0.2, 1.2),
      med: triangle(x, 0.8, 2.2, 3.6),
      high: rightShoulder(x, 2.5, 4.5),
    }),
  },
  {
    key: 'co',
    label: 'Carbon Monoxide Gas',
    unit: 'ppm',
    min: 0,
    max: 120,
    step: 1,
    getLiveValue: (t) => Math.max(...t.sensors.filter((s) => s.type === 'co').map((s) => s.value), t.gasState),
    calcMemberships: (x) => ({
      low: leftShoulder(x, 5, 20),
      med: triangle(x, 15, 38, 65),
      high: rightShoulder(x, 45, 90),
    }),
  },
  {
    key: 'vib',
    label: 'Mechanical Vibration',
    unit: 'g',
    min: 0.1,
    max: 5.5,
    step: 0.05,
    getLiveValue: (t) => t.frictionState,
    calcMemberships: (x) => ({
      low: leftShoulder(x, 0.3, 1.2),
      med: triangle(x, 0.9, 2.2, 3.8),
      high: rightShoulder(x, 2.6, 4.8),
    }),
  },
];

export default function ExplainRiskView() {
  const { snapshot } = useSimulation();
  const { risk } = snapshot.telemetry;
  const activeRules = risk.ruleDetails.filter((rule) => rule.active);

  const [selectedVarKey, setSelectedVarKey] = useState<FuzzyVarKey>('temp');
  const activeVar = FUZZY_VARIABLES.find((v) => v.key === selectedVarKey) ?? FUZZY_VARIABLES[0];

  const liveVal = activeVar.getLiveValue(snapshot.telemetry);
  const [scrubberVal, setScrubberVal] = useState<number>(() => Math.round(liveVal * 10) / 10);

  const memberships = activeVar.calcMemberships(scrubberVal);

  const scoreClass =
    risk.stage === 'Critical'
      ? styles.critical
      : risk.stage === 'Warning'
      ? styles.warning
      : risk.stage === 'Watch'
      ? styles.watch
      : styles.normal;

  // Defuzzification trace
  const defuzz = risk.defuzzificationTrace;
  const chartWidth = 600;
  const chartHeight = 140;
  const xDefuzz = (value: number) => 30 + (value / 100) * (chartWidth - 60);
  const yDefuzz = (membership: number) => chartHeight - 25 - membership * (chartHeight - 50);
  const curve = defuzz.domain
    .map((value, index) => `${index === 0 ? 'M' : 'L'} ${xDefuzz(value)} ${yDefuzz(defuzz.aggregatedSet[index] ?? 0)}`)
    .join(' ');
  const centroidX = xDefuzz(defuzz.crispCentroid ?? risk.riskScore);

  // SVG membership curves for the interactive playground
  const pw = 600;
  const ph = 120;
  const xPlay = (val: number) => 30 + ((val - activeVar.min) / (activeVar.max - activeVar.min)) * (pw - 60);
  const yPlay = (mu: number) => ph - 20 - mu * (ph - 35);

  const steps = 60;
  const domainPoints = Array.from({ length: steps + 1 }, (_, i) => activeVar.min + (i / steps) * (activeVar.max - activeVar.min));

  const lowCurve = domainPoints.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xPlay(v)} ${yPlay(activeVar.calcMemberships(v).low)}`).join(' ');
  const medCurve = domainPoints.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xPlay(v)} ${yPlay(activeVar.calcMemberships(v).med)}`).join(' ');
  const highCurve = domainPoints.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xPlay(v)} ${yPlay(activeVar.calcMemberships(v).high)}`).join(' ');

  const cursorX = xPlay(scrubberVal);

  return (
    <div className={styles.workspace}>
      {/* Risk Summary Header */}
      <section className={`${styles.summary} ${scoreClass}`}>
        <div className={styles.scoreBlock}>
          <span>Current risk</span>
          <strong>{risk.riskScore}<small>/100</small></strong>
          <b>{risk.stage}</b>
        </div>
        <div className={styles.summaryCopy}>
          <h2>{risk.alertMessage}</h2>
          <p>{risk.explanation}</p>
          <div className={styles.summaryFacts}>
            <div><span>Likely cause</span><strong>{risk.probableCause}</strong></div>
            <div><span>Area</span><strong>{risk.affectedZone}</strong></div>
            <div><span>Confidence</span><strong>{risk.confidence}%</strong></div>
            <div><span>Suggested response</span><strong>{risk.recommendedAction.toUpperCase()}</strong></div>
          </div>
        </div>
      </section>

      {/* Interactive Fuzzification Membership Playground */}
      <section className={styles.playgroundPanel}>
        <div className={styles.playgroundHeader}>
          <div className={styles.playgroundTitleGroup}>
            <Sliders size={17} />
            <span>Interactive Fuzzification Playground · Explore μ(x)</span>
          </div>

          {/* Variable Selection Tabs */}
          <div className={styles.variableTabs}>
            {FUZZY_VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                className={`${styles.varTab} ${selectedVarKey === v.key ? styles.varTabActive : ''}`}
                onClick={() => {
                  sound.playClick();
                  setSelectedVarKey(v.key);
                  setScrubberVal(Math.round(v.getLiveValue(snapshot.telemetry) * 10) / 10);
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrubber Controls */}
        <div className={styles.scrubberRow}>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Explore Value (x):</span>
          <input
            type="range"
            min={activeVar.min}
            max={activeVar.max}
            step={activeVar.step}
            value={scrubberVal}
            className={styles.scrubberSlider}
            onChange={(e) => setScrubberVal(Number(e.target.value))}
          />
          <span className={styles.scrubberValueBadge}>
            {scrubberVal.toFixed(1)} {activeVar.unit}
          </span>
          <button
            type="button"
            className={styles.snapBtn}
            onClick={() => {
              sound.playClick();
              setScrubberVal(Math.round(liveVal * 10) / 10);
            }}
            title="Snap scrubber to the current live simulated sensor telemetry reading"
          >
            Snap to Live ({liveVal.toFixed(1)} {activeVar.unit})
          </button>
        </div>

        {/* Live Degrees of Membership Display */}
        <div className={styles.membershipBadgeRow}>
          <span className={styles.memPill} style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.4)' }}>
            μ_Low({scrubberVal.toFixed(1)}) = <strong>{(memberships.low * 100).toFixed(0)}%</strong>
          </span>
          <span className={styles.memPill} style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)' }}>
            μ_Medium({scrubberVal.toFixed(1)}) = <strong>{(memberships.med * 100).toFixed(0)}%</strong>
          </span>
          <span className={styles.memPill} style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
            μ_High({scrubberVal.toFixed(1)}) = <strong>{(memberships.high * 100).toFixed(0)}%</strong>
          </span>
        </div>

        {/* SVG Membership Curves Plot with Dynamic Slicing Cursor */}
        <svg viewBox={`0 0 ${pw} ${ph}`} className={styles.chart} role="img" aria-label="Fuzzy membership functions">
          <line x1="30" y1={ph - 20} x2={pw - 30} y2={ph - 20} stroke="#475569" strokeWidth="1" />

          {/* Curves */}
          <path d={lowCurve} fill="none" stroke="#38bdf8" strokeWidth="2.2" />
          <path d={medCurve} fill="none" stroke="#f59e0b" strokeWidth="2.2" />
          <path d={highCurve} fill="none" stroke="#ef4444" strokeWidth="2.2" />

          {/* Vertical slicing cursor */}
          <line x1={cursorX} y1="10" x2={cursorX} y2={ph - 20} stroke="#ffffff" strokeWidth="2" strokeDasharray="3,3" />
          <circle cx={cursorX} cy={yPlay(memberships.low)} r="4" fill="#38bdf8" />
          <circle cx={cursorX} cy={yPlay(memberships.med)} r="4" fill="#f59e0b" />
          <circle cx={cursorX} cy={yPlay(memberships.high)} r="4" fill="#ef4444" />

          {/* Domain axis labels */}
          <text x="35" y={ph - 5} fill="#64748b" fontSize="10">{activeVar.min} {activeVar.unit}</text>
          <text x={pw - 35} y={ph - 5} fill="#64748b" fontSize="10" textAnchor="end">{activeVar.max} {activeVar.unit}</text>
        </svg>
      </section>

      {/* Main Grid: Sensor Inputs vs Fired Rules */}
      <section className={styles.mainGrid}>
        <div className={styles.panel}>
          <div className={styles.panelHeading}>
            <div><span className={styles.step}>01</span><h3>Sensor Signals & Degrees</h3></div>
            <span className={styles.helper}>Reading · Dominant Fuzzy Level</span>
          </div>
          <div className={styles.signalList}>
            {risk.fuzzyInputs.map((input) => {
              const membership = Math.max(0, Math.min(1, input.dominantMembership ?? 0));
              return (
                <div className={styles.signalRow} key={input.id}>
                  <div className={styles.signalTop}>
                    <div>
                      <strong>{input.label}</strong>
                      <span>{input.displayValue} · {input.health}% sensor health</span>
                    </div>
                    <b>{input.dominantLevel} · {Math.round(membership * 100)}%</b>
                  </div>
                  <div className={styles.meter} aria-label={`${Math.round(membership * 100)} percent membership`}>
                    <span style={{ width: `${Math.round(membership * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeading}>
            <div><span className={styles.step}>02</span><h3>Active Mamdani Rules</h3></div>
            <span className={styles.helper}>{activeRules.length} Firing</span>
          </div>
          {activeRules.length === 0 ? (
            <p className={styles.emptyState}>No rule crossed its activation level. The baseline is guiding this assessment.</p>
          ) : (
            <div className={styles.ruleList}>
              {activeRules.map((rule) => (
                <article className={styles.ruleCard} key={rule.code}>
                  <div className={styles.ruleTop}>
                    <strong>Rule {rule.code}: {rule.label}</strong>
                    <span>{Math.round(rule.firingStrength * 100)}% match (α)</span>
                  </div>
                  <p>{rule.formula}</p>
                  <div className={styles.ruleBottom}>
                    <span className={rule.consequent.target === 'risk' ? styles.riskTag : styles.confidenceTag}>
                      {rule.consequent.target === 'risk' ? 'Affects risk' : 'Affects confidence'}
                    </span>
                    <span>{rule.effect}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className={styles.actionNote}>
            <span>Why this response?</span>
            <p>{risk.actionReason}</p>
          </div>
        </div>
      </section>

      {/* Technical Defuzzification Mathematical Trace */}
      <details className={styles.technicalDetails} open>
        <summary>Mamdani Centroid Defuzzification Trace (Mathematical Proof)</summary>
        <div className={styles.technicalGrid}>
          <section className={styles.technicalPanel}>
            <h3>Max-Aggregation & Centroid Slicing</h3>
            <p>
              Rule consequents are clipped at height α_k = min(μ_A, μ_B) and combined via max-aggregation: μ_agg(z) = max(μ_1(z), ...). The crisp risk score is computed as the geometric center of gravity.
            </p>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className={styles.chart} role="img" aria-label="Aggregated fuzzy risk set and centroid">
              <line x1="30" y1={chartHeight - 25} x2={chartWidth - 30} y2={chartHeight - 25} />
              {[0, 25, 50, 75, 100].map((tick) => (
                <g key={tick}>
                  <line x1={xDefuzz(tick)} y1={chartHeight - 25} x2={xDefuzz(tick)} y2={chartHeight - 20} />
                  <text x={xDefuzz(tick)} y={chartHeight - 5}>{tick}</text>
                </g>
              ))}
              {curve && <path d={`${curve} L ${xDefuzz(100)} ${yDefuzz(0)} L ${xDefuzz(0)} ${yDefuzz(0)} Z`} className={styles.curveArea} />}
              {curve && <path d={curve} className={styles.curveLine} />}
              <line x1={centroidX} y1="12" x2={centroidX} y2={chartHeight - 25} className={styles.centroidLine} />
              <text x={centroidX} y="10" fill="#fb7185" fontSize="10" fontWeight="700">
                z* = {defuzz.crispCentroid.toFixed(1)}
              </text>
            </svg>
            <p className={styles.formula}>
              Centroid z* = Σ(z · μ(z)) / Σ(μ(z)) = {defuzz.centroidNumerator.toFixed(1)} / {defuzz.centroidDenominator.toFixed(1)} = {defuzz.crispCentroid.toFixed(1)}
            </p>
          </section>

          <section className={styles.technicalPanel}>
            <h3>Evidence Confidence Decomposition</h3>
            <p>Confidence reflects measurement reliability, sensor health, and agreement across independent physical indicators.</p>
            <div className={styles.confidenceList}>
              {risk.confidenceFactors.map((factor) => (
                <div key={factor.id}>
                  <span>{factor.label}</span>
                  <b>{factor.value}%</b>
                  <small>{factor.detail}</small>
                </div>
              ))}
            </div>
          </section>
        </div>
      </details>
    </div>
  );
}
