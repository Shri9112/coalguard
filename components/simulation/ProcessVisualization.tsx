'use client';

import React, { useState } from 'react';
import { Camera, Flame, Layers, Radio, Wind, X } from 'lucide-react';
import { EnvironmentProfile, InspectionUnit, SensorNode, TelemetryFrame, TransitSubmode } from '../../lib/types';
import { sound } from '../../lib/utils/sound';
import RoverHud from './RoverHud';
import styles from './SimulationWorkspace.module.css';

interface ProcessVisualizationProps {
  telemetry: TelemetryFrame;
  profile: EnvironmentProfile;
  submode: TransitSubmode;
  inspection: InspectionUnit;
}

export type SchematicViewMode = 'schematic' | 'thermal' | 'gas-plume';

export default function ProcessVisualization({
  telemetry,
  profile,
  submode,
  inspection,
}: ProcessVisualizationProps) {
  const [viewMode, setViewMode] = useState<SchematicViewMode>('schematic');
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null);
  const [manualRoverHud, setManualRoverHud] = useState<boolean | null>(null);

  // Derived state: open automatically if inspecting, unless user manually toggled
  const isInspecting = inspection.status === 'en-route' || inspection.status === 'on-site';
  const showRoverHud = manualRoverHud !== null ? manualRoverHud : isInspecting;

  const { hotspotLocation } = telemetry;
  const selectedSensor = telemetry.sensors.find((s) => s.id === selectedSensorId);

  // Hotspot heat gradient color
  const hotspotOpacity = Math.min(0.88, Math.max(0.18, hotspotLocation.intensity / 100));
  const hotspotFill =
    hotspotLocation.intensity > 70
      ? 'rgba(239, 68, 68, 0.85)'
      : hotspotLocation.intensity > 40
      ? 'rgba(245, 158, 11, 0.75)'
      : 'rgba(56, 189, 248, 0.55)';

  // Calculate distance from sensor to hotspot
  const getDistanceToHotspot = (sensor: SensorNode) => {
    const dx = sensor.x - hotspotLocation.x;
    const dy = sensor.y - hotspotLocation.y;
    return Math.round(Math.sqrt(dx * dx + dy * dy));
  };

  return (
    <div className={styles.visContainer}>
      {/* Header with Multi-Layer View Mode Switcher */}
      <div className={styles.visHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={styles.visTitle}>Industrial Schematic · Physical Process State</span>
          <span className={styles.visBadge}>
            Hotspot: {hotspotLocation.zone} (Intensity: {Math.round(hotspotLocation.intensity)}%)
          </span>
        </div>

        <div className={styles.visHeaderActions}>
          <div className={styles.visModeGroup}>
            <button
              type="button"
              className={`${styles.modeBtn} ${viewMode === 'schematic' ? styles.modeBtnActive : ''}`}
              onClick={() => {
                sound.playClick();
                setViewMode('schematic');
              }}
              title="Standard architectural line schematic"
            >
              <Layers size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Schematic
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${viewMode === 'thermal' ? styles.modeBtnActive : ''}`}
              onClick={() => {
                sound.playClick();
                setViewMode('thermal');
              }}
              title="FLIR / Ironbow false-color thermal infrared radiation view"
            >
              <Flame size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Thermal IR
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${viewMode === 'gas-plume' ? styles.modeBtnActive : ''}`}
              onClick={() => {
                sound.playClick();
                setViewMode('gas-plume');
              }}
              title="Carbon monoxide dispersion aerodynamic plume"
            >
              <Wind size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Gas Plume
            </button>
          </div>

          {/* Rover Camera Feed Toggle Button */}
          <button
            type="button"
            className={`${styles.modeBtn} ${showRoverHud ? styles.modeBtnActive : ''}`}
            style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px 10px',
            }}
            onClick={() => {
              sound.playClick();
              setManualRoverHud(!showRoverHud);
            }}
            title="Toggle Mobile Thermal Survey Rover Camera Viewport"
          >
            <Camera size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Rover Feed
          </button>
        </div>
      </div>

      {/* Sensor Inspector Popover / Drawer */}
      {selectedSensor && (
        <div className={styles.sensorInspectorDrawer}>
          <div className={styles.sensorInspectorHeader}>
            <span className={styles.sensorInspectorTitle}>
              <Radio size={14} /> Virtual Sensor Inspector: {selectedSensor.name} ({selectedSensor.id})
            </span>
            <button
              type="button"
              className={styles.sensorCloseBtn}
              onClick={() => setSelectedSensorId(null)}
              title="Close Inspector"
            >
              <X size={14} />
            </button>
          </div>

          <div className={styles.sensorInspectorGrid}>
            <div className={styles.inspectorStat}>
              <span className={styles.inspectorStatLabel}>Zone & Coordinates</span>
              <span className={styles.inspectorStatVal}>
                {selectedSensor.zone} ({selectedSensor.x.toFixed(0)}, {selectedSensor.y.toFixed(0)})
              </span>
            </div>
            <div className={styles.inspectorStat}>
              <span className={styles.inspectorStatLabel}>Measured Telemetry</span>
              <span className={styles.inspectorStatVal} style={{ color: '#38bdf8' }}>
                {selectedSensor.displayValue}
              </span>
            </div>
            <div className={styles.inspectorStat}>
              <span className={styles.inspectorStatLabel}>Modeled Physics Truth</span>
              <span className={styles.inspectorStatVal} style={{ color: '#cbd5e1' }}>
                {selectedSensor.rawPhysicsValue.toFixed(selectedSensor.type === 'vibration' ? 2 : 1)} {selectedSensor.unit}
              </span>
            </div>
            <div className={styles.inspectorStat}>
              <span className={styles.inspectorStatLabel}>Health & Status</span>
              <span className={styles.inspectorStatVal} style={{ color: selectedSensor.health > 70 ? '#34d399' : '#f59e0b' }}>
                {selectedSensor.health}% ({selectedSensor.status.toUpperCase()})
              </span>
            </div>
            <div className={styles.inspectorStat}>
              <span className={styles.inspectorStatLabel}>Hotspot Distance</span>
              <span className={styles.inspectorStatVal}>
                {getDistanceToHotspot(selectedSensor)} units ({selectedSensor.trend.toUpperCase()})
              </span>
            </div>
            <div className={styles.inspectorStat}>
              <span className={styles.inspectorStatLabel}>Rate of Change</span>
              <span className={styles.inspectorStatVal}>
                {selectedSensor.rateOfChange >= 0 ? '+' : ''}{selectedSensor.rateOfChange.toFixed(2)}/min
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main SVG Schematic Canvas */}
      <svg
        viewBox="0 0 1000 450"
        className={styles.visSvg}
        aria-label="Process schematic"
      >
        <defs>
          {/* Radial hotspot heat diffusion gradient */}
          <radialGradient id="hotspotGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={hotspotFill} stopOpacity={hotspotOpacity} />
            <stop offset="45%" stopColor={hotspotFill} stopOpacity={hotspotOpacity * 0.45} />
            <stop offset="100%" stopColor={hotspotFill} stopOpacity="0" />
          </radialGradient>

          {/* FLIR Ironbow False-Color Thermal Gradient */}
          <radialGradient id="flirThermalGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="25%" stopColor="#facc15" stopOpacity="0.85" />
            <stop offset="55%" stopColor="#ef4444" stopOpacity="0.65" />
            <stop offset="80%" stopColor="#7c3aed" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>

          {/* Gas Dispersion Plume Gradient */}
          <radialGradient id="gasPlumeGradient" cx="20%" cy="50%" r="80%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.75" />
            <stop offset="50%" stopColor="#818cf8" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>

          {/* Industrial Blueprint Grid pattern */}
          <pattern id="industrialGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#16253b" strokeWidth="0.8" />
          </pattern>

          {/* Coal texture gradient */}
          <linearGradient id="coalGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          {/* Water Spray Cone Gradient */}
          <linearGradient id="sprayMistGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Background Grid */}
        <rect x="0" y="0" width="1000" height="450" fill="#081324" />
        <rect x="0" y="0" width="1000" height="450" fill="url(#industrialGrid)" />

        {/* 1. MINE CONVEYOR SCHEMATIC */}
        {profile === 'mine-conveyor' && (
          <g id="mine-conveyor-schematic">
            {/* Gallery Tunnel Outline */}
            <path d="M 50 120 L 950 120 L 950 360 L 50 360 Z" fill="#0b172a" stroke="#1e3a5f" strokeWidth="2" />
            {/* Ventilation Duct Top */}
            <rect x="70" y="130" width="860" height="20" rx="4" fill="#132742" stroke="#2a4d7d" strokeWidth="1" />
            <text x="90" y="144" fill="#64748b" fontSize="11" fontFamily="var(--font-mono)">
              VENTILATION GALLERY AIRFLOW ({(telemetry.airflowSpeed ?? 1.8).toFixed(1)} m/s) →
            </text>

            {/* Infeed Chute */}
            <polygon points="90,160 190,160 170,240 110,240" fill="#1b2f4a" stroke="#38bdf8" strokeWidth="1.5" />
            <text x="140" y="195" fill="#94a3b8" fontSize="11" textAnchor="middle">Infeed Chute</text>

            {/* Animated Conveyor Belt Path */}
            <rect x="150" y="240" width="700" height="12" rx="4" fill="#334155" />
            <line x1="150" y1="246" x2="850" y2="246" stroke="#38bdf8" strokeWidth="2" className={styles.beltMoving} />
            <rect x="150" y="295" width="700" height="8" rx="3" fill="#1e293b" />

            {/* Coal Bed on Belt */}
            <path d="M 170 240 Q 500 225 830 240 Z" fill="url(#coalGradient)" stroke="#475569" strokeWidth="1" />

            {/* Idler Rollers along belt */}
            {[230, 310, 390, 470, 550, 630, 710, 790].map((rx, idx) => (
              <g key={idx}>
                <circle cx={rx} cy="256" r="10" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
                <circle cx={rx} cy="256" r="3" fill="#94a3b8" />
              </g>
            ))}

            {/* Drive Station Pulley */}
            <circle cx="850" cy="270" r="34" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <circle cx="850" cy="270" r="12" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
            <text x="850" y="325" fill="#94a3b8" fontSize="11" textAnchor="middle">Drive Head Pulley</text>

            {/* Discharge Chute */}
            <polygon points="840,290 920,290 890,350 850,350" fill="#1b2f4a" stroke="#38bdf8" strokeWidth="1.5" />
            <text x="880" y="325" fill="#64748b" fontSize="10">Discharge</text>

            {/* Water Spray Deluge Mist Overlay */}
            <g transform="translate(450, 155)" className={styles.sprayAnim}>
              <polygon points="0,0 -40,85 40,85" fill="url(#sprayMistGrad)" />
              <circle cx="0" cy="0" r="4" fill="#38bdf8" />
            </g>
          </g>
        )}

        {/* 2. FACTORY CHP SCHEMATIC */}
        {profile === 'factory-chp' && (
          <g id="factory-chp-schematic">
            {/* Processing Tower Structure */}
            <rect x="80" y="80" width="840" height="320" rx="8" fill="#0c192d" stroke="#1d3860" strokeWidth="2" />

            {/* Crusher Feed Hopper */}
            <polygon points="100,100 260,100 220,180 140,180" fill="#1a2d48" stroke="#60a5fa" strokeWidth="1.5" />
            <text x="180" y="145" fill="#94a3b8" fontSize="11" textAnchor="middle">Crusher Feed Hopper</text>

            {/* Vibratory Crusher Deck */}
            <rect x="130" y="185" width="120" height="30" fill="#243b5e" stroke="#94a3b8" strokeWidth="1.5" />
            <text x="190" y="205" fill="#cbd5e1" fontSize="10" textAnchor="middle">Crusher Mill</text>

            {/* Transfer Chute Enclosed Hood */}
            <path d="M 230 215 L 520 250 L 510 320 L 220 285 Z" fill="#1e3453" stroke="#60a5fa" strokeWidth="1.8" />
            <text x="370" y="280" fill="#93c5fd" fontSize="12" fontWeight="600" textAnchor="middle">Enclosed Transfer Chute Hood</text>

            {/* Water Spray Nozzles & Active Deluge Mist */}
            <g transform="translate(320, 225)">
              <circle cx="0" cy="0" r="4" fill="#38bdf8" />
              <path d="M -15 15 L 0 0 L 15 15" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2,2" />
              <polygon points="0,0 -35,65 35,65" fill="url(#sprayMistGrad)" className={styles.sprayAnim} />
              <text x="0" y="-8" fill="#38bdf8" fontSize="10" textAnchor="middle">Spray Header</text>
            </g>

            {/* Boiler Bunker Bin */}
            <polygon points="680,180 900,180 860,340 720,340" fill="#162740" stroke="#3b82f6" strokeWidth="2" />
            <path d="M 720 300 Q 790 270 860 300 L 860 340 L 720 340 Z" fill="url(#coalGradient)" />
            <text x="790" y="235" fill="#93c5fd" fontSize="12" fontWeight="600" textAnchor="middle">Boiler Bunker Infeed</text>
          </g>
        )}

        {/* 3. STOCKPILE YARD SCHEMATIC */}
        {profile === 'stockpile' && (
          <g id="stockpile-schematic">
            {/* Ground line */}
            <line x1="60" y1="360" x2="940" y2="360" stroke="#334155" strokeWidth="3" />

            {/* Coal Stockpile Mound A */}
            <path d="M 80 360 Q 240 180 400 360 Z" fill="url(#coalGradient)" stroke="#34d399" strokeWidth="2" />
            <text x="240" y="320" fill="#94a3b8" fontSize="12" textAnchor="middle">Stockpile Flank A</text>

            {/* Coal Stockpile Mound B (Primary monitored core) */}
            <path d="M 380 360 Q 620 140 860 360 Z" fill="url(#coalGradient)" stroke="#34d399" strokeWidth="2.5" />
            <text x="620" y="290" fill="#6ee7b7" fontSize="14" fontWeight="600" textAnchor="middle">Stockpile Core B (Deep Probes)</text>

            {/* Multi-depth Probes into Mound B */}
            <line x1="560" y1="180" x2="560" y2="340" stroke="#10b981" strokeWidth="2" strokeDasharray="4,3" />
            <circle cx="560" cy="240" r="4" fill="#34d399" />
            <circle cx="560" cy="300" r="4" fill="#34d399" />
            <line x1="660" y1="210" x2="660" y2="340" stroke="#10b981" strokeWidth="2" strokeDasharray="4,3" />
            <circle cx="660" cy="260" r="4" fill="#34d399" />
            <circle cx="660" cy="320" r="4" fill="#34d399" />

            {/* Environmental Weather Mast */}
            <rect x="880" y="160" width="8" height="200" fill="#334155" />
            <circle cx="884" cy="155" r="10" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
            <text x="884" y="135" fill="#38bdf8" fontSize="10" textAnchor="middle">Weather Stn</text>
          </g>
        )}

        {/* 4. ROAD / RAIL TRANSIT SCHEMATIC */}
        {profile === 'transit' && (
          <g id="transit-schematic">
            {submode === 'rail-wagon' ? (
              // RAIL WAGON SCHEMATIC
              <g id="rail-wagon-view">
                <line x1="50" y1="360" x2="950" y2="360" stroke="#475569" strokeWidth="4" />
                {[70, 110, 150, 190, 230, 270, 310, 350, 390, 430, 470, 510, 550, 590, 630, 670, 710, 750, 790, 830, 870, 910].map((tx, idx) => (
                  <line key={idx} x1={tx} y1="352" x2={tx} y2="368" stroke="#64748b" strokeWidth="3" />
                ))}

                {/* Hopper Wagon 1 */}
                <polygon points="120,200 440,200 410,310 150,310" fill="#18273d" stroke="#f59e0b" strokeWidth="2" />
                <path d="M 140 200 Q 280 180 420 200 Z" fill="url(#coalGradient)" />
                <text x="280" y="240" fill="#cbd5e1" fontSize="12" fontWeight="600" textAnchor="middle">Hopper Car #1</text>
                <circle cx="170" cy="335" r="16" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" />
                <circle cx="210" cy="335" r="16" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" />
                <circle cx="350" cy="335" r="16" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" />
                <circle cx="390" cy="335" r="16" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" />

                {/* Hopper Wagon 2 (Focus Car) */}
                <polygon points="480,200 800,200 770,310 510,310" fill="#1c2f4a" stroke="#f59e0b" strokeWidth="2.5" />
                <path d="M 500 200 Q 640 170 780 200 Z" fill="url(#coalGradient)" stroke="#fbbf24" strokeWidth="1" />
                <text x="640" y="240" fill="#fbbf24" fontSize="13" fontWeight="700" textAnchor="middle">Hopper Car #2 (Monitored Center)</text>
                <circle cx="530" cy="335" r="16" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" />
                <circle cx="570" cy="335" r="16" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" />
                <circle cx="710" cy="335" r="16" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" />
                <circle cx="750" cy="335" r="16" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" />

                <rect x="440" y="260" width="40" height="8" fill="#475569" />
              </g>
            ) : (
              // ROAD TIPPER TRUCK SCHEMATIC
              <g id="road-truck-view">
                <line x1="50" y1="360" x2="950" y2="360" stroke="#334155" strokeWidth="4" />
                <path d="M 140 330 L 140 220 L 220 220 L 250 260 L 250 330 Z" fill="#1b2a40" stroke="#f59e0b" strokeWidth="2" />
                <rect x="180" y="230" width="55" height="30" rx="3" fill="#38bdf8" fillOpacity="0.4" stroke="#38bdf8" strokeWidth="1" />
                <text x="185" y="300" fill="#94a3b8" fontSize="11">Cab #4</text>

                <rect x="270" y="190" width="560" height="120" rx="6" fill="#142338" stroke="#f59e0b" strokeWidth="2.5" />
                <path d="M 285 210 Q 550 170 815 210 L 815 300 L 285 300 Z" fill="url(#coalGradient)" stroke="#fbbf24" strokeWidth="1" />
                <path d="M 270 190 Q 550 160 830 190" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="6,4" />
                <text x="550" y="250" fill="#fde68a" fontSize="14" fontWeight="600" textAnchor="middle">Tipper Coal Bed Midsection (Tarped)</text>

                {[190, 360, 420, 680, 740, 800].map((wx, idx) => (
                  <g key={idx}>
                    <circle cx={wx} cy="340" r="22" fill="#090d16" stroke="#64748b" strokeWidth="3" />
                    <circle cx={wx} cy="340" r="8" fill="#334155" />
                  </g>
                ))}
              </g>
            )}
          </g>
        )}

        {/* 5. SHIP CARGO HOLD SCHEMATIC */}
        {profile === 'cargo-hold' && (
          <g id="cargo-hold-schematic">
            <path d="M 100 100 L 900 100 L 840 380 L 160 380 Z" fill="#0e1a2d" stroke="#a855f7" strokeWidth="2.5" />
            <line x1="40" y1="180" x2="960" y2="180" stroke="#38bdf8" strokeWidth="1" strokeDasharray="8,6" />
            <text x="60" y="172" fill="#38bdf8" fontSize="10">SEA LEVEL WATERLINE</text>

            <rect x="250" y="90" width="500" height="20" fill="#24344d" stroke="#c084fc" strokeWidth="1.5" />
            <text x="500" y="104" fill="#e9d5ff" fontSize="11" textAnchor="middle">Sealed Hatch Coaming (Airtight)</text>

            <path d="M 180 160 Q 500 135 820 160 L 800 360 L 200 360 Z" fill="url(#coalGradient)" stroke="#9333ea" strokeWidth="1.5" />
            <text x="500" y="220" fill="#d8b4fe" fontSize="15" fontWeight="700" textAnchor="middle">Bulk Cargo Hold #2 Stowage</text>

            <rect x="260" y="340" width="480" height="30" fill="#0b1322" stroke="#6b21a8" strokeWidth="1.5" />
            <text x="500" y="360" fill="#a855f7" fontSize="11" textAnchor="middle">Lower Bilge Well Boundary</text>

            <line x1="360" y1="110" x2="360" y2="330" stroke="#a855f7" strokeWidth="2" strokeDasharray="5,4" />
            <line x1="640" y1="110" x2="640" y2="330" stroke="#a855f7" strokeWidth="2" strokeDasharray="5,4" />
          </g>
        )}

        {/* LAYER OVERLAY: THERMAL IR (FLIR Ironbow Mode) */}
        {viewMode === 'thermal' && (
          <g id="thermal-ir-overlay" opacity="0.85">
            <circle
              cx={(hotspotLocation.x / 100) * 1000}
              cy={(hotspotLocation.y / 100) * 450}
              r={hotspotLocation.radius * 6.5}
              fill="url(#flirThermalGradient)"
            />
          </g>
        )}

        {/* LAYER OVERLAY: GAS DISPERSION PLUME */}
        {viewMode === 'gas-plume' && (
          <g id="gas-plume-overlay" opacity="0.75" className={styles.smokeAnim}>
            <ellipse
              cx={(hotspotLocation.x / 100) * 1000 + 40}
              cy={(hotspotLocation.y / 100) * 450 - 20}
              rx={hotspotLocation.radius * 6.0}
              ry={hotspotLocation.radius * 3.5}
              fill="url(#gasPlumeGradient)"
            />
          </g>
        )}

        {/* STANDARD HOTSPOT DIFFUSION OVERLAY */}
        {viewMode === 'schematic' && hotspotLocation.intensity > 15 && (
          <g id="hotspot-overlay">
            <circle
              cx={(hotspotLocation.x / 100) * 1000}
              cy={(hotspotLocation.y / 100) * 450}
              r={hotspotLocation.radius * 4.5}
              fill="url(#hotspotGlow)"
            />
            <circle
              cx={(hotspotLocation.x / 100) * 1000}
              cy={(hotspotLocation.y / 100) * 450}
              r="6"
              fill="#ef4444"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            {/* Rising smoke wisps if elevated heat */}
            {hotspotLocation.intensity > 35 && (
              <g className={styles.smokeAnim} transform={`translate(${(hotspotLocation.x / 100) * 1000}, ${(hotspotLocation.y / 100) * 450 - 15})`}>
                <circle cx="0" cy="0" r="8" fill="rgba(245, 158, 11, 0.45)" />
                <circle cx="10" cy="-12" r="12" fill="rgba(239, 68, 68, 0.35)" />
                <circle cx="-8" cy="-24" r="14" fill="rgba(148, 163, 184, 0.25)" />
              </g>
            )}
          </g>
        )}

        {/* INTERACTIVE SENSOR NODES OVERLAY */}
        {telemetry.sensors.map((sensor) => {
          const sx = (sensor.x / 100) * 1000;
          const sy = (sensor.y / 100) * 450;
          const isOffline = sensor.status === 'offline';
          const isDegraded = sensor.status === 'degraded';
          const isStale = sensor.status === 'stale';
          const isSelected = sensor.id === selectedSensorId;

          const strokeColor = isSelected
            ? '#38bdf8'
            : isOffline
            ? '#ef4444'
            : isDegraded
            ? '#f59e0b'
            : isStale
            ? '#94a3b8'
            : '#22d3ee';

          return (
            <g
              key={sensor.id}
              transform={`translate(${sx}, ${sy})`}
              className={styles.sensorNode}
              onClick={() => {
                sound.playClick();
                setSelectedSensorId(sensor.id === selectedSensorId ? null : sensor.id);
              }}
            >
              {/* Highlight selection ring if selected */}
              {isSelected && (
                <circle cx="0" cy="0" r="20" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3,3" />
              )}

              {/* Node background pin */}
              <circle cx="0" cy="0" r="14" fill="#071120" stroke={strokeColor} strokeWidth={isSelected ? 3 : 2} />
              {/* Inner core */}
              <circle
                cx="0"
                cy="0"
                r="4"
                fill={isOffline ? '#ef4444' : isDegraded ? '#f59e0b' : '#22d3ee'}
              />
              {/* Sensor label pill */}
              <rect x="18" y="-12" width="75" height="24" rx="4" fill="#091424" stroke={isSelected ? '#38bdf8' : '#1f3454'} strokeWidth="1" />
              <text x="24" y="4" fill="#f1f5f9" fontSize="10" fontFamily="var(--font-mono)" fontWeight="600">
                {sensor.displayValue}
              </text>
            </g>
          );
        })}

        {/* MOBILE INSPECTION ROVER UNIT & TRAJECTORY LINE */}
        {inspection && (
          <g id="mobile-inspection-unit">
            {/* Target trajectory dotted line if en route */}
            {inspection.status === 'en-route' && (
              <line
                x1={(inspection.x / 100) * 1000}
                y1={(inspection.y / 100) * 450}
                x2={(hotspotLocation.x / 100) * 1000}
                y2={(hotspotLocation.y / 100) * 450}
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeDasharray="4,4"
              />
            )}

            <g
              transform={`translate(${(inspection.x / 100) * 1000}, ${(inspection.y / 100) * 450})`}
              className={styles.roverNode}
            >
              {/* Target reticle crosshair */}
              <g className={styles.reticlePulse}>
                <circle cx="0" cy="0" r="22" fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2,2" />
                <line x1="-26" y1="0" x2="-18" y2="0" stroke="#38bdf8" strokeWidth="1.5" />
                <line x1="18" y1="0" x2="26" y2="0" stroke="#38bdf8" strokeWidth="1.5" />
                <line x1="0" y1="-26" x2="0" y2="-18" stroke="#38bdf8" strokeWidth="1.5" />
                <line x1="0" y1="18" x2="0" y2="26" stroke="#38bdf8" strokeWidth="1.5" />
              </g>

              {/* Rover Chassis */}
              <rect x="-16" y="-12" width="32" height="24" rx="4" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
              {/* Wheels */}
              <rect x="-18" y="-14" width="8" height="6" rx="2" fill="#0284c7" />
              <rect x="10" y="-14" width="8" height="6" rx="2" fill="#0284c7" />
              <rect x="-18" y="8" width="8" height="6" rx="2" fill="#0284c7" />
              <rect x="10" y="8" width="8" height="6" rx="2" fill="#0284c7" />
              {/* IR Sensor Mast */}
              <circle cx="0" cy="-2" r="5" fill="#f43f5e" />
              {/* Status callout */}
              <rect x="22" y="-18" width="135" height="34" rx="4" fill="#091424" stroke="#0284c7" strokeWidth="1" />
              <text x="28" y="-5" fill="#38bdf8" fontSize="10" fontWeight="700">
                {inspection.label}
              </text>
              <text x="28" y="10" fill="#94a3b8" fontSize="9">
                {inspection.status.toUpperCase()} ({inspection.readingDisplay})
              </text>
            </g>
          </g>
        )}
      </svg>

      {/* Mobile Thermal Survey Rover HUD (PiP) */}
      {showRoverHud && (
        <RoverHud inspection={inspection} onClose={() => setManualRoverHud(false)} />
      )}
    </div>
  );
}
