/**
 * CoalGuard - Industrial SCADA & Telemetry Topology Validator
 * Evaluates directed telemetry and command-path connectivity.
 * Deterministic graph traversal with zero external dependencies.
 */

import {
  TopologyEdge,
  TopologyGraph,
  TopologyNode,
  TopologyValidationCheck,
  TopologyValidationResult,
} from '../types';

/**
 * Perform breadth-first search from startNodeId through active (unbroken) edges.
 */
function getReachableNodes(
  startNodeId: string,
  nodes: TopologyNode[],
  edges: TopologyEdge[]
): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [startNodeId];
  visited.add(startNodeId);

  // The stored edge direction represents sensor-to-controller telemetry and
  // controller-to-actuator commands. Do not infer reverse reachability.
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    adj.set(n.id, []);
  }

  for (const e of edges) {
    if (e.status !== 'broken') {
      adj.get(e.source)?.push(e.target);
    }
  }

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const neighbors = adj.get(curr) ?? [];
    for (const nxt of neighbors) {
      if (!visited.has(nxt)) {
        visited.add(nxt);
        queue.push(nxt);
      }
    }
  }

  return visited;
}

/**
 * Checks connection paths in an educational SCADA/telemetry topology.
 */
export function validateTopology(graph: TopologyGraph): TopologyValidationResult {
  const checks: TopologyValidationCheck[] = [];
  const sensors = graph.nodes.filter((n) => n.role === 'sensor');
  const controllers = graph.nodes.filter((n) => n.role === 'controller');
  const actuators = graph.nodes.filter((n) => n.role === 'actuator');
  const gateways = graph.nodes.filter((n) => n.role === 'gateway');
  const clouds = graph.nodes.filter((n) => n.role === 'cloud');

  const isolatedNodes: string[] = [];
  const unreachableActuators: string[] = [];

  // Check 1: All Sensors connect to at least one Controller
  let sensorsConnected = 0;
  for (const sensor of sensors) {
    const reachable = getReachableNodes(sensor.id, graph.nodes, graph.edges);
    const hasController = controllers.some((c) => reachable.has(c.id));
    if (hasController) {
      sensorsConnected++;
    } else {
      isolatedNodes.push(sensor.id);
    }
  }

  const allSensorsConnected = sensors.length > 0 && sensorsConnected === sensors.length;
  checks.push({
    id: 'sensor-acquisition-integrity',
    name: 'Sensor Acquisition Bus',
    passed: allSensorsConnected,
    detail: allSensorsConnected
      ? `All ${sensors.length} field telemetry sensors reach an active controller.`
      : `${sensors.length - sensorsConnected} of ${sensors.length} sensors have no forward path to a controller.`,
  });

  // Check 2: At least one controller has a forward command path to each actuator.
  let actuatorsReachable = 0;
  for (const act of actuators) {
    const hasController = controllers.some((controller) =>
      getReachableNodes(controller.id, graph.nodes, graph.edges).has(act.id)
    );
    if (hasController) {
      actuatorsReachable++;
    } else {
      unreachableActuators.push(act.id);
    }
  }

  const allActuatorsReachable = actuators.length > 0 && actuatorsReachable === actuators.length;
  checks.push({
    id: 'actuator-interlock-integrity',
    name: 'Controller-to-Actuator Path',
    passed: allActuatorsReachable,
    detail: allActuatorsReachable
      ? `All ${actuators.length} modeled actuators have a forward command path from a controller.`
      : `${actuators.length - actuatorsReachable} actuators have no forward command path from a controller.`,
  });

  // Check 3: Gateway & Remote SCADA / Cloud Telemetry
  let cloudConnected = false;
  if (clouds.length > 0 && gateways.length > 0) {
    cloudConnected = controllers.some((controller) => {
      const reachable = getReachableNodes(controller.id, graph.nodes, graph.edges);
      return gateways.some((gateway) => reachable.has(gateway.id)) && clouds.some((cloud) => reachable.has(cloud.id));
    });
  } else {
    cloudConnected = true; // Not required if topology doesn't model cloud
  }

  checks.push({
    id: 'telemetry-uplink',
    name: 'Remote SCADA & Telemetry Uplink',
    passed: cloudConnected,
    detail: cloudConnected
      ? 'A controller has a forward path through a gateway to a modeled remote endpoint.'
      : 'No forward controller-to-gateway-to-remote-endpoint path is available.',
  });

  // Check 4: Fieldbus Physical Cable Status
  const brokenEdges = graph.edges.filter((e) => e.status === 'broken');
  const noSeveredCables = brokenEdges.length === 0;
  checks.push({
    id: 'cable-physical-continuity',
    name: 'Physical Cable Continuity',
    passed: noSeveredCables,
    detail: noSeveredCables
      ? `All ${graph.edges.length} physical fieldbus cables are intact.`
      : `${brokenEdges.length} cable(s) severed (${brokenEdges.map((e) => e.label || e.id).join(', ')}).`,
  });

  // A simple graph-connectivity score for this educational visualization.
  let score = 100;
  if (!allSensorsConnected) {
    score -= 35 * ((sensors.length - sensorsConnected) / Math.max(1, sensors.length));
  }
  if (!allActuatorsReachable) {
    score -= 40 * ((actuators.length - actuatorsReachable) / Math.max(1, actuators.length));
  }
  if (!cloudConnected) {
    score -= 15;
  }
  if (brokenEdges.length > 0) {
    score -= Math.min(10, brokenEdges.length * 5);
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  const valid = allSensorsConnected && allActuatorsReachable && score >= 70;

  let summary = 'All modeled telemetry and command paths are connected';
  if (score < 50) {
    summary = 'Major connection paths are unavailable';
  } else if (!valid) {
    summary = 'Some telemetry or command paths need review';
  } else if (score < 90) {
    summary = 'Connected with minor telemetry impairment';
  }

  return {
    valid,
    score,
    summary,
    checks,
    isolatedNodes,
    unreachableActuators,
  };
}
