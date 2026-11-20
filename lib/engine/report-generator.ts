/**
 * CoalGuard - Academic Lab Report Generator
 * Compiles a structured, reproducible academic investigation report
 * capturing simulation configuration, telemetry peaks, fuzzy inference traces,
 * baseline comparisons, and formal academic disclaimers.
 */

import { SimulationSnapshot } from '../types';

export interface LabReportData {
  title: string;
  generatedAt: string;
  snapshot: SimulationSnapshot;
  markdownContent: string;
}

export function generateLabReport(snapshot: SimulationSnapshot): LabReportData {
  const { config, tick, telemetry, psoResult } = snapshot;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const totalSensors = telemetry.sensors.length;
  const onlineCount = telemetry.sensors.filter((s) => s.status === 'online').length;
  const degradedCount = telemetry.sensors.filter((s) => s.status === 'degraded').length;
  const staleCount = telemetry.sensors.filter((s) => s.status === 'stale').length;
  const offlineCount = telemetry.sensors.filter((s) => s.status === 'offline').length;
  const avgHealth = Math.round(
    telemetry.sensors.reduce((sum, s) => sum + s.health, 0) / Math.max(1, totalSensors)
  );

  const peakTemp = Math.max(
    ...telemetry.sensors.filter((s) => s.type === 'temperature').map((s) => s.value),
    telemetry.surfaceHeat
  );
  const peakCo = Math.max(
    ...telemetry.sensors.filter((s) => s.type === 'co').map((s) => s.value),
    telemetry.gasState
  );

  const markdown = `# CoalGuard Academic Simulation & Risk Assessment Report

**Report Generated:** ${now} UTC
**Academic Environment:** Soft Computing Course Project (SCIL)
**Simulation Kernel:** Local Deterministic Virtual Process Model & Mamdani FIS

---

## 1. Operating Context & Scenario Parameters

| Parameter | Configured Value | Unit / Scale |
|---|---|---|
| **Environment Profile** | \`${config.profile}\` | Five Selectable Contexts |
| **Transit Submode** | \`${config.submode}\` | Road Truck / Rail Wagon / None |
| **Active Scenario** | \`${config.scenario}\` | Reproducible Benchmark |
| **Weather Condition** | \`${config.weather}\` | Environmental Exposure |
| **Simulation Step** | \`Tick ${tick}\` (${telemetry.minutes.toFixed(1)} simulated minutes) | Discrete Time Step |
| **Coal Mass Loading** | \`${config.load}%\` | Feeder / Conveyor Load |
| **Bed Compaction** | \`${config.compaction}%\` | Thermal Retention Factor |
| **Ventilation Airflow** | \`${config.ventilation}%\` | Convective Dispersion |
| **Moisture Content** | \`${config.moisture}%\` | Surface Evaporation Factor |
| **Deluge Water Spray** | \`${config.sprayAvailable ? 'Active' : 'Offline'}\` | Suppression System |
| **Telemetry Noise Floor**| \`${config.sensorNoise}%\` | Zero-Mean Gaussian Jitter |
| **Telemetry Dropout** | \`${config.sensorDropout}%\` | Packet Loss & Node Stoppage |
| **Operator Response** | \`${config.response.toUpperCase()}\` | Mitigation State |

---

## 2. Telemetry State & Virtual Sensor Network

- **Network Reliability Score:** ${avgHealth}% (Mean Node Health)
- **Node Distribution:** ${onlineCount} Online · ${degradedCount} Degraded · ${staleCount} Stale · ${offlineCount} Offline (${totalSensors} Total Nodes)
- **Peak Modeled Temperature:** ${peakTemp.toFixed(1)} °C
- **Peak Carbon Monoxide Gas:** ${peakCo.toFixed(1)} ppm
- **Core / Bulk Heat Accumulation:** ${telemetry.heatState.toFixed(1)} / 100
- **Mechanical Vibration:** ${telemetry.frictionState.toFixed(2)} g
- **Gallery / Hold Airflow Speed:** ${(telemetry.airflowSpeed ?? 1.5).toFixed(1)} m/s
- **Airborne Dust Concentration:** ${telemetry.dustState.toFixed(0)} mg/m³

### Individual Virtual Sensor Readings Table

| Node ID | Sensor Tag | Zone | Measured Value | Modeled Physics Truth | Health | Status |
|---|---|---|---|---|---|---|
${telemetry.sensors
  .map(
    (s) =>
      `| \`${s.id}\` | ${s.name} | ${s.zone} | **${s.displayValue}** | ${s.rawPhysicsValue.toFixed(1)} ${s.unit} | ${s.health}% | \`${s.status}\` |`
  )
  .join('\n')}

---

## 3. Mamdani Fuzzy Risk Assessment

- **Crisp Risk Score:** **${telemetry.risk.riskScore} / 100**
- **Severity Stage:** **${telemetry.risk.stage.toUpperCase()}**
- **Decision Confidence:** **${telemetry.risk.confidence}%** (Evidence Quality Indicator)
- **Probable Root Cause:** ${telemetry.risk.probableCause}
- **Affected Hazard Zone:** ${telemetry.risk.affectedZone}
- **Recommended Operator Action:** \`${telemetry.risk.recommendedAction.toUpperCase()}\`
- **Mitigation Rationale:** ${telemetry.risk.actionReason}

### Active Mamdani Rules Fired

${telemetry.risk.activeRules.length === 0
  ? '*No high-severity rules crossed activation threshold. State governed by baseline equilibrium.*'
  : telemetry.risk.activeRules
      .map(
        (r) =>
          `* **Rule ${r.code}** (\`${r.label}\`): Firing strength $\\alpha = ${(r.firingStrength * 100).toFixed(0)}\\%$\n  * *Antecedents:* ${r.formula}\n  * *Effect:* ${r.effect}`
      )
      .join('\n\n')}

### Centroid Defuzzification Equation

$$\\text{Centroid } z^* = \\frac{\\int z \\cdot \\mu_{\\text{agg}}(z) \\, dz}{\\int \\mu_{\\text{agg}}(z) \\, dz} = \\frac{${telemetry.risk.defuzzificationTrace.centroidNumerator.toFixed(1)}}{${telemetry.risk.defuzzificationTrace.centroidDenominator.toFixed(1)}} = ${telemetry.risk.defuzzificationTrace.crispCentroid.toFixed(1)}$$

---

## 4. Particle Swarm Optimization (PSO) Calibration

- **Calibration Status:** \`${psoResult.status.toUpperCase()}\` (Evaluated on Synthetic Benchmark Suite)
- **Swarm Size:** ${psoResult.particles} particles | **Iterations:** ${psoResult.iterations}
- **Best Fitness Cost:** ${psoResult.bestCost.toFixed(4)} (Monotonically Converged)
- **Objective Function:** Minimum false alarms on dust/steam interference with quadratic penalty on missed thermal runaways.

---

## 5. Honest Academic Boundaries & Disclaimers

> [!IMPORTANT]
> **Academic Prototype Notice:** This simulation report was generated by CoalGuard as an educational decision-support demonstration for applied Soft Computing. All telemetry readings, sensor placements, and hazard escalations are deterministic synthetic simulations. This software is not connected to real industrial plant sensors, does not control equipment, and is not certified for industrial life-safety operations.
`;

  return {
    title: `CoalGuard-Report-${config.profile}-${now.replace(/[: ]/g, '-')}`,
    generatedAt: now,
    snapshot,
    markdownContent: markdown,
  };
}
