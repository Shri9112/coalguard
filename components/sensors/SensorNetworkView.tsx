'use client';

import React from 'react';
import { Cpu, Info, ShieldAlert } from 'lucide-react';
import { useSimulation } from '../../lib/state/SimulationContext';
import ProcessVisualization from '../simulation/ProcessVisualization';
import styles from './SensorNetwork.module.css';

export default function SensorNetworkView() {
  const { snapshot, updateParameter } = useSimulation();
  const { telemetry, config, inspection } = snapshot;

  const totalSensors = telemetry.sensors.length;
  const onlineCount = telemetry.sensors.filter((s) => s.status === 'online').length;
  const degradedCount = telemetry.sensors.filter((s) => s.status === 'degraded').length;
  const staleCount = telemetry.sensors.filter((s) => s.status === 'stale').length;
  const offlineCount = telemetry.sensors.filter((s) => s.status === 'offline').length;
  const avgHealth = Math.round(
    telemetry.sensors.reduce((sum, s) => sum + s.health, 0) / totalSensors
  );

  return (
    <div className={styles.sensorNetworkWorkspace}>
      {/* Educational Telemetry vs Physical Truth Banner */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.75)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '0.82rem',
          color: '#cbd5e1',
        }}
      >
        <Info size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
        <span>
          <strong>Telemetry vs. Process Reality:</strong> Underlying physical temperature (
          <span style={{ color: '#38bdf8' }}>{telemetry.surfaceHeat.toFixed(1)} °C</span>) and gas state (
          <span style={{ color: '#c084fc' }}>{telemetry.gasState.toFixed(1)} ppm</span>) are calculated by deterministic domain models. Telemetry noise and dropouts inject realistic measurement degradation without fabricating underlying physical runaway.
        </span>
      </div>

      {/* Schematic Placement Canvas */}
      <ProcessVisualization
        telemetry={telemetry}
        profile={config.profile}
        submode={config.submode}
        inspection={inspection}
      />

      {/* Live Table & Fault Injection Grid */}
      <div className={styles.grid}>
        {/* Full Sensor Table */}
        <div className={styles.readingsCard}>
          <div className={styles.cardTitle}>
            <span>
              Virtual Sensor Array ({onlineCount} Online · {degradedCount} Degraded · {staleCount} Stale · {offlineCount} Offline)
            </span>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Network Reliability: <strong style={{ color: avgHealth > 75 ? '#34d399' : '#f59e0b' }}>{avgHealth}%</strong>
            </span>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.sensorTable}>
              <thead>
                <tr>
                  <th>Node ID & Name</th>
                  <th>Monitored Zone</th>
                  <th>Measured Telemetry</th>
                  <th>Underlying Truth</th>
                  <th>Trend</th>
                  <th>Health</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {telemetry.sensors.map((sensor) => {
                  const statusClass =
                    sensor.status === 'online'
                      ? styles.statusOnline
                      : sensor.status === 'degraded'
                      ? styles.statusDegraded
                      : sensor.status === 'stale'
                      ? styles.statusStale
                      : styles.statusOffline;

                  const healthColor =
                    sensor.health > 80 ? '#10b981' : sensor.health > 50 ? '#f59e0b' : '#ef4444';

                  const digits = sensor.type === 'vibration' || sensor.type === 'wind' ? 2 : sensor.type === 'o2' || sensor.type === 'methane' ? 1 : 0;
                  const rawTruthFormatted = `${sensor.rawPhysicsValue.toFixed(digits)} ${sensor.unit}`;

                  return (
                    <tr key={sensor.id}>
                      <td>
                        <strong>{sensor.name}</strong>
                        <div style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                          {sensor.id} · ({sensor.x.toFixed(0)}, {sensor.y.toFixed(0)})
                        </div>
                      </td>
                      <td>{sensor.zone}</td>
                      <td>
                        <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.92rem' }}>
                          {sensor.displayValue}
                        </strong>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: '#94a3b8' }}>
                          {rawTruthFormatted}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: sensor.trend === 'rising' ? '#f59e0b' : '#94a3b8', fontSize: '0.8rem' }}>
                          {sensor.trend === 'rising' ? '▲ Rising' : sensor.trend === 'falling' ? '▼ Falling' : '— Stable'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.healthBarTrack}>
                          <div
                            className={styles.healthBarFill}
                            style={{ width: `${sensor.health}%`, background: healthColor }}
                          />
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                          {sensor.health}%
                        </span>
                      </td>
                      <td>
                        <span className={`${styles.statusPill} ${statusClass}`}>
                          {sensor.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fault Injection & Network Stress Panel */}
        <div className={styles.faultPanel}>
          <div className={styles.cardTitle}>
            <Cpu size={16} />
            <span>Fault Injection Controls</span>
          </div>

          <div className={styles.faultGroup}>
            <span className={styles.faultLabel}>Sensor Dropout Probability</span>
            <p className={styles.faultDesc}>
              Simulates wireless packet loss, stale hold values, and node dropouts. Reduces evidence confidence without altering physical heat.
            </p>
            <input
              type="range"
              min="0"
              max="50"
              value={config.sensorDropout}
              onChange={(e) => updateParameter('sensorDropout', Number(e.target.value))}
            />
            <span className="code-badge">Dropout Level: {config.sensorDropout}%</span>
          </div>

          <div className={styles.faultGroup}>
            <span className={styles.faultLabel}>Measurement Gaussian Noise</span>
            <p className={styles.faultDesc}>
              Injects zero-mean measurement jitter. Degrades health scores and tests rule resilience while preserving modeled physical state.
            </p>
            <input
              type="range"
              min="0"
              max="40"
              value={config.sensorNoise}
              onChange={(e) => updateParameter('sensorNoise', Number(e.target.value))}
            />
            <span className="code-badge">Noise Floor: {config.sensorNoise}%</span>
          </div>

          <div className={styles.faultGroup} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
            <span className={styles.faultLabel}>Scenario Fault Preset</span>
            <button
              type="button"
              className={`${styles.faultToggleBtn} ${config.scenario === 'sensor-fault' ? styles.faultToggleBtnActive : ''}`}
              onClick={() =>
                updateParameter(
                  'scenario',
                  config.scenario === 'sensor-fault' ? 'normal' : 'sensor-fault'
                )
              }
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldAlert size={14} />
                <span>
                  {config.scenario === 'sensor-fault'
                    ? 'Active: Scenario Fault Injected'
                    : 'Inject Multi-Node Sensor Failure'}
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
