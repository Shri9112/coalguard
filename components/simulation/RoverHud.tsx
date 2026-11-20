'use client';

import React, { useState } from 'react';
import { Camera, ChevronDown, ChevronUp, Crosshair, Navigation, Radio, X } from 'lucide-react';
import { InspectionUnit } from '../../lib/types';
import styles from './RoverHud.module.css';

interface RoverHudProps {
  inspection: InspectionUnit;
  onClose?: () => void;
}

export default function RoverHud({ inspection, onClose }: RoverHudProps) {
  const [minimized, setMinimized] = useState(false);

  const isEnRoute = inspection.status === 'en-route';
  const isOnSite = inspection.status === 'on-site';
  const statusColor = isOnSite ? '#ef4444' : isEnRoute ? '#38bdf8' : '#94a3b8';

  return (
    <div className={`${styles.roverHudContainer} ${minimized ? styles.roverHudContainerMinimized : ''}`}>
      {/* Header */}
      <div className={styles.roverHudHeader}>
        <div className={styles.roverHudHeaderLeft}>
          <span className={styles.liveIndicator} />
          <Camera size={13} />
          <span>ROVER IR CAM · {inspection.label}</span>
        </div>

        <div className={styles.roverHudControls}>
          <button
            type="button"
            className={styles.hudIconBtn}
            onClick={() => setMinimized(!minimized)}
            title={minimized ? 'Expand HUD' : 'Minimize HUD'}
          >
            {minimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {onClose && (
            <button
              type="button"
              className={styles.hudIconBtn}
              onClick={onClose}
              title="Close HUD"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {!minimized && (
        <>
          {/* Simulated Thermal IR Camera Viewport */}
          <div className={styles.roverViewport}>
            <div className={styles.thermalGridLines} />

            {/* Targeting Reticle */}
            <div className={styles.reticleGroup}>
              <div className={styles.reticleRing}>
                <Crosshair size={26} color="#38bdf8" />
              </div>
            </div>

            {/* Live Spot Temperature Readout */}
            <div className={styles.spotTempOverlay}>
              SPOT IR: <strong>{inspection.readingDisplay}</strong>
            </div>

            {/* Target & Coordinates */}
            <div className={styles.coordinatesOverlay}>
              POS: ({inspection.x.toFixed(0)}, {inspection.y.toFixed(0)}) · TGT: {inspection.targetZone}
            </div>
          </div>

          {/* Telemetry Body */}
          <div className={styles.roverHudBody}>
            <div className={styles.roverStatusRow}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Navigation size={12} color={statusColor} />
                Status: <strong style={{ color: statusColor }}>{inspection.status.toUpperCase()}</strong>
              </span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {inspection.progress}% Progress
              </span>
            </div>

            {/* Progress Bar */}
            <div className={styles.roverProgressTrack}>
              <div className={styles.roverProgressFill} style={{ width: `${inspection.progress}%` }} />
            </div>

            {/* Findings Text */}
            <div className={styles.roverFindingsText}>
              <Radio size={11} style={{ verticalAlign: 'middle', marginRight: 4, color: '#38bdf8' }} />
              {inspection.findings}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
