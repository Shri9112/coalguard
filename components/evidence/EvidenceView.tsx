'use client';

import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { EVIDENCE_CATALOG, PUBLISHED_COAL_CURVES } from '../../lib/data/evidence';
import { buildFieldGoafReplay } from '../../lib/engine/field-goaf-replay';
import { runPublishedCurveReplay } from '../../lib/engine/published-replay';
import FieldEpisodeReplay from './FieldEpisodeReplay';
import styles from './Evidence.module.css';

export default function EvidenceView() {
  const [selectedCurveId, setSelectedCurveId] = useState<string>('anthracite');
  const [selectedObservationIndex, setSelectedObservationIndex] = useState(0);
  const [selectedFieldDay, setSelectedFieldDay] = useState(1);

  const selectedCurve =
    PUBLISHED_COAL_CURVES.find((c) => c.id === selectedCurveId) ?? PUBLISHED_COAL_CURVES[0];
  const replay = runPublishedCurveReplay(selectedCurve);
  const selectedObservation = replay.observations[selectedObservationIndex] ?? replay.observations[0];
  const fieldReplay = buildFieldGoafReplay(selectedFieldDay);
  const fieldChartWidth = 720;
  const fieldChartHeight = 220;
  const fieldX = (day: number) =>
    42 + ((day - 1) / (fieldReplay.observations.length - 1)) * (fieldChartWidth - 76);
  const fieldY = (value: number) =>
    fieldChartHeight - 34 - (value / 100) * (fieldChartHeight - 58);
  const fieldSeries = [
    { key: 'coToCo2' as const, label: 'CO / CO₂', color: '#22d3ee' },
    { key: 'grahamTimesTen' as const, label: '10 × Graham', color: '#fbbf24' },
    { key: 'alkaneRatio' as const, label: 'Alkane ratio', color: '#c084fc' },
  ];
  const fieldDeltaLabel = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(0)}%`;

  // SVG Curve calculations
  const svgWidth = 600;
  const svgHeight = 200;
  const points = selectedCurve.points;
  const minTemp = 20;
  const maxTemp = 180;
  // Use log scale for CO ppm to keep large ranges readable
  const maxCo = Math.max(...points.map((p) => p.coPpm));

  const getCurveX = (temp: number) => 40 + ((temp - minTemp) / (maxTemp - minTemp)) * (svgWidth - 70);
  const getCurveY = (co: number) => {
    const logCo = Math.log10(Math.max(1, co));
    const maxLogCo = Math.log10(Math.max(10, maxCo));
    return svgHeight - 25 - (logCo / maxLogCo) * (svgHeight - 45);
  };

  const curvePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getCurveX(p.temperatureC)} ${getCurveY(p.coPpm)}`)
    .join(' ');
  const getRiskY = (score: number) => svgHeight - 25 - (score / 100) * (svgHeight - 45);
  const riskPath = replay.observations
    .map((observation, index) =>
      `${index === 0 ? 'M' : 'L'} ${getCurveX(observation.temperatureC)} ${getRiskY(observation.risk.riskScore)}`
    )
    .join(' ');

  const selectCurve = (curveId: string) => {
    setSelectedCurveId(curveId);
    setSelectedObservationIndex(0);
  };

  return (
    <div className={styles.evidenceWorkspace}>
      <p className={styles.provenanceNote}>
        Published studies and incident reports provide context; CoalGuard&apos;s live sensor readings are simulated.
      </p>

      <FieldEpisodeReplay />

      {/* 1. PUBLISHED COAL OXIDATION CURVES VIEWER */}
      <section className={styles.curvesCard}>
        <div className={styles.curvesHead}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
              Published Coal Oxidation Kinetics: Guo et al. (2019)
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              Temperature-programmed heating laboratory data sampled by gas chromatography.
            </p>
          </div>

          <div className={styles.curveTabs}>
            {PUBLISHED_COAL_CURVES.map((curve) => (
              <button
                key={curve.id}
                type="button"
                className={`${styles.curveTab} ${selectedCurve.id === curve.id ? styles.curveTabActive : ''}`}
                onClick={() => selectCurve(curve.id)}
              >
                {curve.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.curveContentGrid}>
          {/* Curve Visualization */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8', marginBottom: 6 }}>
              <span>Logarithmic CO Gas Evolution vs Temperature</span>
              <span>Source: {selectedCurve.sourceLabel}</span>
            </div>

            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className={styles.curveSvg}>
              {/* Axes */}
              <line x1="40" y1={svgHeight - 25} x2={svgWidth - 20} y2={svgHeight - 25} stroke="#334155" strokeWidth="1.5" />
              <line x1="40" y1="20" x2="40" y2={svgHeight - 25} stroke="#334155" strokeWidth="1.5" />
              <line x1={svgWidth - 20} y1="20" x2={svgWidth - 20} y2={svgHeight - 25} stroke="#334155" strokeWidth="1" strokeDasharray="3 4" />

              {/* Temperature axis ticks */}
              {[30, 60, 90, 120, 150, 170].map((t) => (
                <g key={t}>
                  <line x1={getCurveX(t)} y1={svgHeight - 25} x2={getCurveX(t)} y2={svgHeight - 20} stroke="#475569" />
                  <text x={getCurveX(t)} y={svgHeight - 8} fill="#64748b" fontSize="9" fontFamily="var(--font-mono)" textAnchor="middle">
                    {t}°C
                  </text>
                </g>
              ))}

              {/* Path */}
              <path d={curvePath} fill="none" stroke="#22d3ee" strokeWidth="2.5" />
              <path d={riskPath} fill="none" stroke="#fb7185" strokeWidth="2.5" strokeDasharray="6 4" />

              {/* Points */}
              {points.map((p, pIdx) => (
                <g key={pIdx}>
                  <circle cx={getCurveX(p.temperatureC)} cy={getCurveY(p.coPpm)} r="4" fill="#22d3ee" stroke="#081324" strokeWidth="1.5" />
                  <circle
                    cx={getCurveX(p.temperatureC)}
                    cy={getRiskY(replay.observations[pIdx].risk.riskScore)}
                    r={selectedObservationIndex === pIdx ? 5 : 3}
                    fill={selectedObservationIndex === pIdx ? '#fff' : '#fb7185'}
                    stroke="#881337"
                    strokeWidth="1.5"
                  />
                </g>
              ))}
              {[0, 25, 50, 75, 100].map((risk) => (
                <text key={risk} x={svgWidth - 16} y={getRiskY(risk) + 3} fill="#fda4af" fontSize="8" textAnchor="end" fontFamily="var(--font-mono)">
                  {risk}
                </text>
              ))}
            </svg>

            <div className={styles.chartLegend}>
              <span><i className={styles.coLegend} /> Published CO (log scale)</span>
              <span><i className={styles.riskLegend} /> CoalGuard Mamdani output (0–100)</span>
            </div>

            <div style={{ fontSize: '0.76rem', color: '#cbd5e1', marginTop: 8, fontStyle: 'italic' }}>
              <strong>Caution / Caveat:</strong> {selectedCurve.caveat}
            </div>
          </div>

          {/* Points Table */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 6 }}>
              Published observations and model response ({selectedCurve.coalRank})
            </div>
            <div className={styles.tableScroll}>
              <table className={styles.pointsTable}>
                <thead>
                  <tr>
                    <th>Temp (°C)</th>
                    <th>CO (ppm)</th>
                    <th>Model risk</th>
                    <th>Firing rules</th>
                  </tr>
                </thead>
                <tbody>
                  {replay.observations.map((observation, pIdx) => (
                    <tr key={pIdx} className={selectedObservationIndex === pIdx ? styles.selectedObservationRow : undefined}>
                      <td>
                        <button
                          type="button"
                          className={styles.observationSelect}
                          aria-pressed={selectedObservationIndex === pIdx}
                          onClick={() => setSelectedObservationIndex(pIdx)}
                        >
                          {observation.temperatureC} °C
                        </button>
                      </td>
                      <td>
                        <span className="code-badge">{observation.coPpm.toFixed(1)} ppm</span>
                      </td>
                      <td>
                        <span className={`${styles.riskResult} ${
                          observation.risk.stage === 'Critical' ? styles.riskCritical
                            : observation.risk.stage === 'Warning' ? styles.riskWarning
                              : observation.risk.stage === 'Watch' ? styles.riskWatch : styles.riskNormal
                        }`}>
                          {observation.risk.riskScore} · {observation.risk.stage}
                        </span>
                      </td>
                      <td className={styles.ruleCodes}>
                        {observation.risk.activeRules.length
                          ? observation.risk.activeRules.map((rule) => rule.code).join(', ')
                          : 'No rule fired'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 10 }}>
              <a
                href={selectedCurve.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.recordLink}
              >
                <ExternalLink size={13} /> Open DOI ({selectedCurve.doi})
              </a>
            </div>
          </div>
        </div>

        <div className={styles.replayPanel}>
          <div className={styles.replayHeading}>
            <div>
              <strong>Published-data replay</strong>
              <span>Observation {selectedObservation.index + 1} of {replay.observations.length}</span>
            </div>
            <span className={styles.replayOutput}>
              Model output: {selectedObservation.risk.riskScore}/100 · {selectedObservation.risk.stage}
            </span>
          </div>
          <div className={styles.replayFacts}>
            <span><b>Measured in source</b> Temperature and CO</span>
            <span><b>Not available</b> Timestamp, rate-of-rise, vibration, current, dust, sensor health</span>
            <span><b>Available model groups</b> {replay.availableChannelCount} of {replay.totalChannelCount}</span>
          </div>
          <p>{selectedObservation.risk.explanation}</p>
          <p className={styles.replayCaveat}>
            This is an illustrative response of CoalGuard&apos;s default Mamdani engine to selected published laboratory values. The paper&apos;s measurements are not conveyor field data; the source does not provide independent fire labels or timestamps for these plotted rows. Do not interpret the risk stage as a verified detection or use it to claim accuracy, false-alarm performance, or industrial thresholds.
          </p>
        </div>
      </section>

      <section className={styles.fieldReplayCard} aria-labelledby="field-goaf-title">
        <div className={styles.fieldReplayHeader}>
          <div>
            <span className={styles.fieldBadge}>PUBLISHED FIELD RECORD · 35 DAYS</span>
            <h3 id="field-goaf-title">Mine-goaf gas-index case replay</h3>
            <p>
              A published monitoring record from a goaf where spontaneous combustion occurred.
              Select a day to inspect the source values.
            </p>
          </div>
          <a
            href={fieldReplay.source.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className={styles.recordLink}
          >
            <ExternalLink size={13} /> {fieldReplay.source.sourceLabel}
          </a>
        </div>

        <div className={styles.fieldModelBoundary}>
          <strong>Model score unavailable for this record</strong>
          <span>
            These are derived gas indices, not the temperature and absolute-CO channels expected by
            the conveyor FIS. Without paired thermal/mechanical readings, it cannot fairly score
            this case; without normal comparison periods, it cannot support accuracy metrics.
          </span>
        </div>

        <div className={styles.fieldChartLegend}>
          {fieldSeries.map((series) => (
            <span key={series.key}>
              <i style={{ borderColor: series.color }} /> {series.label}
            </span>
          ))}
          <small>Each line is scaled to its own maximum in this source record (0–100).</small>
        </div>

        <svg
          viewBox={`0 0 ${fieldChartWidth} ${fieldChartHeight}`}
          className={styles.fieldChart}
          role="img"
          aria-label="Published mine-goaf gas-index trends across 35 days, normalized separately for display"
        >
          {[0, 50, 100].map((level) => (
            <g key={level}>
              <line x1="42" x2={fieldChartWidth - 24} y1={fieldY(level)} y2={fieldY(level)} className={styles.fieldGridLine} />
              <text x="32" y={fieldY(level) + 4} textAnchor="end" className={styles.fieldAxisText}>{level}</text>
            </g>
          ))}
          {[1, 12, 24, 35].map((day) => (
            <g key={day}>
              <line x1={fieldX(day)} x2={fieldX(day)} y1="18" y2={fieldChartHeight - 34} className={styles.fieldGridLine} />
              <text x={fieldX(day)} y={fieldChartHeight - 10} textAnchor="middle" className={styles.fieldAxisText}>Day {day}</text>
            </g>
          ))}
          <line
            x1={fieldX(selectedFieldDay)} x2={fieldX(selectedFieldDay)} y1="18" y2={fieldChartHeight - 34}
            className={styles.fieldSelectedLine}
          />
          {fieldSeries.map((series) => {
            const path = fieldReplay.observations.map((row, index) =>
              `${index === 0 ? 'M' : 'L'} ${fieldX(row.day)} ${fieldY(row.normalized[series.key])}`
            ).join(' ');
            const selected = fieldReplay.selectedObservation;
            return (
              <g key={series.key}>
                <path d={path} fill="none" stroke={series.color} strokeWidth="2.5" />
                <circle
                  cx={fieldX(selected.day)}
                  cy={fieldY(selected.normalized[series.key])}
                  r="4.5"
                  fill={series.color}
                  stroke="#0b1323"
                  strokeWidth="2"
                />
              </g>
            );
          })}
        </svg>

        <div className={styles.fieldDayControl}>
          <label htmlFor="goaf-day-slider">Selected observation: Day {fieldReplay.selectedObservation.day}</label>
          <input
            id="goaf-day-slider"
            type="range"
            min="1"
            max={fieldReplay.observations.length}
            value={selectedFieldDay}
            onChange={(event) => setSelectedFieldDay(Number(event.target.value))}
          />
        </div>

        <div className={styles.fieldValues}>
          <div><span>CO / CO₂</span><strong>{fieldReplay.selectedObservation.coToCo2.toFixed(3)}</strong><small>{fieldDeltaLabel(fieldReplay.selectedObservation.changeFromFirstPercent.coToCo2)} vs Day 1</small></div>
          <div><span>10 × Graham value</span><strong>{fieldReplay.selectedObservation.grahamTimesTen.toFixed(3)}</strong><small>{fieldDeltaLabel(fieldReplay.selectedObservation.changeFromFirstPercent.grahamTimesTen)} vs Day 1</small></div>
          <div><span>Alkane ratio</span><strong>{fieldReplay.selectedObservation.alkaneRatio.toFixed(3)}</strong><small>{fieldDeltaLabel(fieldReplay.selectedObservation.changeFromFirstPercent.alkaneRatio)} vs Day 1</small></div>
        </div>

        <p className={styles.fieldCaveat}>
          {fieldReplay.source.limitation} Normalization is only for comparing line shapes; it is not a fire threshold.
        </p>
      </section>

      {/* 2. OFFICIAL INCIDENT INVESTIGATIONS & REMOTE SENSING DATA */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
          Historical Mining Reports & Remote Sensing References
        </h3>
        <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
          Official investigation reports from MSHA, USGS ground emission datasets, and NASA FIRMS specifications.
        </p>
      </section>

      <section className={styles.recordsGrid}>
        {EVIDENCE_CATALOG.map((rec) => {
          const typeClass =
            rec.kind === 'published-lab-reference'
              ? styles.typeLab
              : rec.kind === 'incident-record'
              ? styles.typeOfficial
              : rec.kind === 'field-data'
              ? styles.typeField
              : styles.typeRemote;

          return (
            <div key={rec.id} className={styles.recordCard}>
              <div className={styles.recordTop}>
                <span className={`${styles.recordType} ${typeClass}`}>
                  {rec.kind.replace('-', ' ')}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Status: {rec.status}</span>
              </div>

              <h4 className={styles.recordTitle}>{rec.title}</h4>

              <div className={styles.recordRow}>
                <strong>Environment:</strong>
                <span>{rec.environment}</span>
              </div>

              <div className={styles.recordRow}>
                <strong>Signal / Focus:</strong>
                <span>{rec.signal}</span>
              </div>

              <div className={styles.recordRow}>
                <strong>Prototype Use:</strong>
                <span>{rec.useInCoalGuard}</span>
              </div>

              <div className={styles.recordRow}>
                <strong>Limitations:</strong>
                <span style={{ color: '#cbd5e1' }}>{rec.limitations}</span>
              </div>

              <a
                href={rec.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className={styles.recordLink}
              >
                <ExternalLink size={13} /> {rec.sourceLabel}
              </a>
            </div>
          );
        })}
      </section>
    </div>
  );
}
