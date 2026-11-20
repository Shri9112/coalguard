'use client';

import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import {
  buildFieldBenchmark,
  FIELD_EPISODES,
} from '../../lib/engine/field-episode-replay';
import type { FieldEpisodeResult } from '../../lib/engine/field-episode-replay';
import styles from './FieldEpisodeReplay.module.css';

const CHART_WIDTH = 840;
const PLOT_LEFT = 66;
const PLOT_RIGHT = 820;

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function riskTone(stage: string): string {
  switch (stage) {
    case 'Critical': return styles.critical;
    case 'Warning': return styles.warning;
    case 'Watch': return styles.watch;
    default: return styles.normal;
  }
}

function FieldCharts({ result, selectedIndex }: { result: FieldEpisodeResult; selectedIndex: number }) {
  const points = result.points;
  const x = (index: number) => PLOT_LEFT + (index / Math.max(1, points.length - 1)) * (PLOT_RIGHT - PLOT_LEFT);
  const yRisk = (value: number) => 112 - (Math.max(0, Math.min(100, value)) / 100) * 90;
  const yTemp = (value: number) => 82 - (Math.max(20, Math.min(180, value)) - 20) / 160 * 64;
  const yCo = (value: number) => 82 - (Math.log10(Math.max(1, value)) / Math.log10(1200)) * 64;
  const pathFor = (valueAt: (index: number) => number, y: (value: number) => number) =>
    points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(valueAt(index))}`).join(' ');
  const selectedX = x(selectedIndex);
  const dates = [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <div className={styles.chartStack}>
      <div className={styles.chartBlock}>
        <div className={styles.chartTitleRow}><strong>CoalGuard risk score</strong><span>0–100 · 24 h alarm persistence</span></div>
        <svg viewBox={`0 0 ${CHART_WIDTH} 132`} className={styles.chart} role="img" aria-label="Basic Mamdani and PSO-tuned risk scores over the selected field episode">
          <rect x={PLOT_LEFT} y={yRisk(26)} width={PLOT_RIGHT - PLOT_LEFT} height={112 - yRisk(26)} className={styles.riskNormalBand} />
          <rect x={PLOT_LEFT} y={yRisk(51)} width={PLOT_RIGHT - PLOT_LEFT} height={yRisk(26) - yRisk(51)} className={styles.riskWatchBand} />
          <rect x={PLOT_LEFT} y={yRisk(76)} width={PLOT_RIGHT - PLOT_LEFT} height={yRisk(51) - yRisk(76)} className={styles.riskWarningBand} />
          <rect x={PLOT_LEFT} y={22} width={PLOT_RIGHT - PLOT_LEFT} height={yRisk(76) - 22} className={styles.riskCriticalBand} />
          {[26, 51, 76].map((threshold) => (
            <g key={threshold}>
              <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={yRisk(threshold)} y2={yRisk(threshold)} className={styles.thresholdLine} />
              <text x="56" y={yRisk(threshold) + 4} textAnchor="end" className={styles.axisText}>{threshold}</text>
            </g>
          ))}
          <path d={pathFor((index) => points[index].basic.riskScore, yRisk)} className={styles.basicRiskLine} />
          <path d={pathFor((index) => points[index].pso.riskScore, yRisk)} className={styles.psoRiskLine} />
          <line x1={selectedX} x2={selectedX} y1="20" y2="112" className={styles.selectedLine} />
          <circle cx={selectedX} cy={yRisk(points[selectedIndex].basic.riskScore)} r="4.5" className={styles.basicPoint} />
          <circle cx={selectedX} cy={yRisk(points[selectedIndex].pso.riskScore)} r="4.5" className={styles.psoPoint} />
          <text x="12" y="33" className={styles.axisText}>100</text>
          <text x="12" y="116" className={styles.axisText}>0</text>
          {dates.map((index) => (
            <text key={index} x={x(index)} y="128" textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'} className={styles.axisText}>
              {points[index].sample.timestamp.slice(5, 10)}
            </text>
          ))}
        </svg>
        <div className={styles.legend}>
          <span><i className={styles.basicKey} /> Basic Mamdani</span>
          <span><i className={styles.psoKey} /> PSO-tuned Mamdani</span>
          <span className={styles.thresholdLegend}>Watch 26 · Warning 51 · Critical 76</span>
        </div>
      </div>

      <div className={styles.chartBlock}>
        <div className={styles.chartTitleRow}><strong>Measured coal temperature</strong><span>°C · fixed 20–180 scale</span></div>
        <svg viewBox={`0 0 ${CHART_WIDTH} 96`} className={styles.smallChart} role="img" aria-label="Measured temperature over the selected field episode">
          {[20, 100, 180].map((value) => (
            <g key={value}>
              <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={yTemp(value)} y2={yTemp(value)} className={styles.gridLine} />
              <text x="56" y={yTemp(value) + 4} textAnchor="end" className={styles.axisText}>{value}</text>
            </g>
          ))}
          <path d={pathFor((index) => points[index].sample.temperatureC, yTemp)} className={styles.temperatureLine} />
          <line x1={selectedX} x2={selectedX} y1="16" y2="84" className={styles.selectedLine} />
          <circle cx={selectedX} cy={yTemp(points[selectedIndex].sample.temperatureC)} r="4" className={styles.temperaturePoint} />
        </svg>
      </div>

      <div className={styles.chartBlock}>
        <div className={styles.chartTitleRow}><strong>Measured carbon monoxide</strong><span>ppm · logarithmic scale</span></div>
        <svg viewBox={`0 0 ${CHART_WIDTH} 96`} className={styles.smallChart} role="img" aria-label="Measured carbon monoxide over the selected field episode on a logarithmic scale">
          {[1, 10, 100, 1000].map((value) => (
            <g key={value}>
              <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={yCo(value)} y2={yCo(value)} className={styles.gridLine} />
              <text x="56" y={yCo(value) + 4} textAnchor="end" className={styles.axisText}>{value}</text>
            </g>
          ))}
          <path d={pathFor((index) => points[index].sample.coPpm, yCo)} className={styles.coLine} />
          <line x1={selectedX} x2={selectedX} y1="16" y2="84" className={styles.selectedLine} />
          <circle cx={selectedX} cy={yCo(points[selectedIndex].sample.coPpm)} r="4" className={styles.coPoint} />
        </svg>
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: FieldEpisodeResult }) {
  const metrics = [
    { label: 'Basic Mamdani', alarm: result.evaluation.basicAlarmAt, early: result.evaluation.basicEarlyWarning, risk: result.evaluation.maximumBasicRisk },
    { label: 'PSO-tuned Mamdani', alarm: result.evaluation.psoAlarmAt, early: result.evaluation.psoEarlyWarning, risk: result.evaluation.maximumPsoRisk },
    { label: 'Published CO baseline', alarm: result.evaluation.coBaselineAlarmAt, early: result.evaluation.coBaselineEarlyWarning, risk: null },
  ];
  return (
    <div className={styles.caseResults}>
      {metrics.map((metric) => (
        <div className={styles.caseResult} key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.alarm ? metric.early ? 'Early warning' : 'After confirmation' : 'No persistent alarm'}</strong>
          <small>{metric.risk === null ? `11.14 ppm threshold${metric.alarm ? ` · ${metric.alarm}` : ''}` : `Peak risk ${metric.risk}/100${metric.alarm ? ` · ${metric.alarm}` : ''}`}</small>
        </div>
      ))}
    </div>
  );
}

export default function FieldEpisodeReplay() {
  const benchmark = useMemo(() => buildFieldBenchmark(), []);
  const firstFireId = FIELD_EPISODES.find((episode) => episode.outcome === 'fire')?.id ?? FIELD_EPISODES[0].id;
  const [selectedId, setSelectedId] = useState(firstFireId);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const result = benchmark.episodes.find((entry) => entry.episode.id === selectedId) ?? benchmark.episodes[0];
  const safeIndex = Math.max(0, Math.min(result.points.length - 1, selectedIndex));
  const selected = result.points[safeIndex];

  const selectEpisode = (id: string) => {
    setSelectedId(id);
    setSelectedIndex(0);
  };

  return (
    <section className={styles.fieldEvidenceCard} aria-labelledby="field-episode-title">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>PUBLISHED MINE FIELD DATA · 18 EPISODES · 3,240 READINGS</span>
          <h3 id="field-episode-title">CoalGuard field episode replay</h3>
          <p>
            Time-aligned underground mine readings replayed through the current Mamdani engine and its existing PSO calibration.
          </p>
        </div>
        <div className={styles.sourceLinks}>
          <a href={benchmark.source.articleUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Study</a>
          <a href={benchmark.source.dataRecordUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Dataset</a>
        </div>
      </div>

      <div className={styles.datasetStats}>
        <span><strong>3</strong> confirmed fire episodes</span>
        <span><strong>15</strong> event-free episodes</span>
        <span><strong>4 h</strong> source sampling</span>
        <span><strong>3 / 8</strong> fuzzy signal groups available</span>
      </div>

      <div className={styles.metricsHeader}>
        <div>
          <h4>Held-out field replay summary</h4>
          <p>Same 24-hour persistence rule and existing risk boundary for both fuzzy models. No field data was used to tune PSO.</p>
        </div>
        <span className={styles.policyBadge}>Watch if risk ≥ {benchmark.policy.riskThreshold} · persist {benchmark.policy.persistenceHours} h</span>
      </div>
      <div className={styles.metricGrid}>
        {benchmark.metrics.map((metric) => (
          <article className={styles.metricCard} key={metric.method}>
            <strong>{metric.method}</strong>
            <div className={styles.metricValues}>
              <span><b>{metric.truePositives}/{metric.fireEpisodes}</b><small>fire episodes alerted</small></span>
              <span><b>{metric.falsePositives}/{metric.eventFreeEpisodes}</b><small>event-free alarms</small></span>
              <span><b>{metric.medianLeadHours === null ? '—' : `${Math.round(metric.medianLeadHours)} h`}</b><small>median early-warning lead</small></span>
            </div>
            <small className={styles.metricFootnote}>
              Recall {percent(metric.recall)} · false-alarm rate {percent(metric.falseAlarmRate)} · F1 {percent(metric.f1)}
            </small>
          </article>
        ))}
      </div>

      <div className={styles.calibrationNote}>
        PSO settings: {benchmark.psoCalibration.particles} particles · {benchmark.psoCalibration.iterations} iterations · seed {benchmark.psoCalibration.seed}. It was calibrated only on CoalGuard&apos;s labelled synthetic scenarios (cost {benchmark.psoCalibration.bestCost}); these field episodes were not used for tuning.
      </div>

      <div className={styles.caseToolbar}>
        <label htmlFor="field-episode-select">Choose a published episode</label>
        <select id="field-episode-select" value={selectedId} onChange={(event) => selectEpisode(event.target.value)}>
          {FIELD_EPISODES.map((episode) => (
            <option key={episode.id} value={episode.id}>
              {episode.site} · {episode.locationType.replace('_', ' ')} · {episode.outcome === 'fire' ? 'Confirmed fire' : 'Event-free'}
            </option>
          ))}
        </select>
        <span className={`${styles.outcomeBadge} ${result.episode.outcome === 'fire' ? styles.fireBadge : styles.clearBadge}`}>
          {result.episode.outcome === 'fire' ? 'Confirmed fire' : 'Event-free'}
        </span>
        <span className={styles.caseSite}>{result.episode.site} · {result.episode.locationType.replace('_', ' ')} · {result.episode.coalRank}</span>
      </div>

      <div className={styles.readingStrip}>
        <div><span>Selected time</span><strong>{selected.sample.timestamp}</strong></div>
        <div><span>Temperature</span><strong>{selected.sample.temperatureC.toFixed(1)} °C</strong></div>
        <div><span>Carbon monoxide</span><strong>{selected.sample.coPpm.toFixed(1)} ppm</strong></div>
        <div><span>Temperature trend</span><strong>{selected.temperatureRateCPerMinute >= 0 ? '+' : ''}{selected.temperatureRateCPerMinute.toFixed(3)} °C/min</strong></div>
        <div><span>Basic Mamdani</span><strong className={riskTone(selected.basic.stage)}>{selected.basic.riskScore}/100 · {selected.basic.stage}</strong></div>
        <div><span>PSO-tuned</span><strong className={riskTone(selected.pso.stage)}>{selected.pso.riskScore}/100 · {selected.pso.stage}</strong></div>
        <div><span>Evidence confidence</span><strong>{selected.pso.confidence}% · limited inputs</strong></div>
      </div>

      <FieldCharts result={result} selectedIndex={safeIndex} />

      <div className={styles.sampleControl}>
        <label htmlFor="field-sample-range">Move through the 30-day record</label>
        <input
          id="field-sample-range"
          type="range"
          min={0}
          max={result.points.length - 1}
          value={safeIndex}
          onChange={(event) => setSelectedIndex(Number(event.target.value))}
          aria-valuetext={`${selected.sample.timestamp}; temperature ${selected.sample.temperatureC.toFixed(1)} degrees Celsius; carbon monoxide ${selected.sample.coPpm.toFixed(1)} parts per million`}
        />
        <div className={styles.rangeLabels}><span>{result.points[0].sample.timestamp}</span><span>Reading {safeIndex + 1} / {result.points.length}</span><span>{result.points[result.points.length - 1].sample.timestamp}</span></div>
      </div>

      <ResultCard result={result} />

      <div className={styles.ruleTrace}>
        <div>
          <h4>Why the model gave this result</h4>
          <p>{selected.pso.explanation}</p>
          <p className={styles.ruleHint}>
            {selected.pso.activeRules.length
              ? `PSO-tuned rules active: ${selected.pso.activeRules.map((rule) => `${rule.code} (${rule.firingStrength.toFixed(2)})`).join(', ')}`
              : 'No PSO-tuned fire-risk rule is active at this reading.'}
          </p>
        </div>
        {result.episode.confirmationAt && (
          <div className={styles.confirmationNote}>
            <strong>Independent confirmation</strong>
            <span>{result.episode.confirmationAt} · {result.episode.confirmationBasis}</span>
          </div>
        )}
      </div>

      <div className={styles.boundaryNote}>
        <strong>Read this as an external field replay, not conveyor validation.</strong>
        <span>
          These records come from underground goaf, return-airway and sealed-area monitoring, not conveyor belts. The current fuzzy engine receives measured temperature, a derived temperature rate, and measured CO; vibration, motor current, dust, sensor health and spatial agreement remain unavailable. H₂ and C₂H₄ are excluded because their missingness is tied to fire outcome in the source workbook. The 100% observed scores use only 3 fire and 15 event-free episodes, so they do not establish performance across mines or transport systems.
        </span>
      </div>
    </section>
  );
}
