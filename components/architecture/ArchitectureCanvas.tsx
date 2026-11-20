/**
 * CoalGuard - Industrial SCADA & Telemetry Topology Canvas
 * Interactive node-based industrial fieldbus graph inspired by SCADA telemetry suites.
 * Supports node repositioning, line severing / fault injection, live validation, and simulation coupling.
 */

'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Layers,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  X,
  Zap,
  ZapOff,
} from 'lucide-react';
import { useSimulation } from '../../lib/state/SimulationContext';
import { getTopologyForProfile } from '../../lib/data/topologies';
import { PROFILES } from '../../lib/data/profiles';
import { validateTopology } from '../../lib/engine/topology-validator';
import {
  TopologyComponentRole,
  TopologyGraph,
  TopologyNode,
  TopologyValidationResult,
} from '../../lib/types';
import styles from './ArchitectureCanvas.module.css';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 76;

export default function ArchitectureCanvas() {
  const {
    snapshot,
    setProfile,
    brokenEdgeIds,
    toggleTopologyEdge,
    resetTopologyEdges,
  } = useSimulation();

  const activeProfile = snapshot.config.profile;

  // Selection & Inspector State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Zoom State
  const [zoom, setZoom] = useState<number>(1);

  // Dragging State for Nodes
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Custom nodes per profile (repositioned or newly added)
  const [customNodesByProfile, setCustomNodesByProfile] = useState<Record<string, TopologyNode[]>>({});

  // Add Component Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newNodeRole, setNewNodeRole] = useState<TopologyComponentRole>('sensor');
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeProtocol, setNewNodeProtocol] = useState('Modbus RS-485');
  const [newNodeDetail, setNewNodeDetail] = useState('');

  // Active base topology
  const baseTopology = useMemo(() => {
    return getTopologyForProfile(activeProfile);
  }, [activeProfile]);

  // Current nodes: customized if user dragged/added, otherwise base
  const currentNodes = useMemo(() => {
    return customNodesByProfile[activeProfile] ?? baseTopology.nodes;
  }, [customNodesByProfile, activeProfile, baseTopology.nodes]);

  // Edges with live broken statuses from SimulationContext
  const currentEdges = useMemo(() => {
    return baseTopology.edges.map((e) => ({
      ...e,
      status: (brokenEdgeIds.includes(e.id) ? 'broken' : 'active') as 'active' | 'broken',
    }));
  }, [baseTopology.edges, brokenEdgeIds]);

  const displayedGraph: TopologyGraph = useMemo(() => ({
    ...baseTopology,
    nodes: currentNodes,
    edges: currentEdges,
  }), [baseTopology, currentNodes, currentEdges]);

  // Live validation calculation
  const validation: TopologyValidationResult = useMemo(() => {
    return validateTopology(displayedGraph);
  }, [displayedGraph]);

  // Selected Node details
  const selectedNode = useMemo(() => {
    return displayedGraph.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [displayedGraph.nodes, selectedNodeId]);

  // Selected Edge details
  const selectedEdge = useMemo(() => {
    return displayedGraph.edges.find((e) => e.id === selectedEdgeId) ?? null;
  }, [displayedGraph.edges, selectedEdgeId]);

  // Telemetry reading lookup for selected sensor node
  const liveSensorReading = useMemo(() => {
    if (!selectedNode || selectedNode.role !== 'sensor' || !selectedNode.sensorIdRef) {
      return null;
    }
    const sensor = snapshot.telemetry.sensors.find((s) => s.id === selectedNode.sensorIdRef);
    return sensor ?? null;
  }, [selectedNode, snapshot.telemetry.sensors]);

  // Node Drag handlers
  const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setDraggingNodeId(nodeId);

    const node = displayedGraph.nodes.find((n) => n.id === nodeId);
    if (node) {
      dragOffsetRef.current = {
        x: (e.clientX / zoom) - node.x,
        y: (e.clientY / zoom) - node.y,
      };
    }
  };

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingNodeId) return;

    const newX = Math.round((e.clientX / zoom) - dragOffsetRef.current.x);
    const newY = Math.round((e.clientY / zoom) - dragOffsetRef.current.y);

    setCustomNodesByProfile((prev) => {
      const list = prev[activeProfile] ?? baseTopology.nodes;
      return {
        ...prev,
        [activeProfile]: list.map((n) =>
          n.id === draggingNodeId
            ? { ...n, x: Math.max(10, Math.min(800, newX)), y: Math.max(10, Math.min(520, newY)) }
            : n
        ),
      };
    });
  }, [draggingNodeId, zoom, activeProfile, baseTopology.nodes]);

  const handleCanvasMouseUp = useCallback(() => {
    setDraggingNodeId(null);
  }, []);

  // Edge click handler: toggles active / broken
  const handleEdgeClick = (edgeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedEdgeId(edgeId);
    setSelectedNodeId(null);
    toggleTopologyEdge(edgeId);
  };

  // Reset topology to factory starter
  const handleResetStarter = () => {
    resetTopologyEdges();
    setCustomNodesByProfile((prev) => {
      const copy = { ...prev };
      delete copy[activeProfile];
      return copy;
    });
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  // Add Component Form Submission
  const handleAddComponent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeName.trim()) return;

    const id = `node-${newNodeRole}-${Date.now().toString().slice(-4)}`;
    const newNode: TopologyNode = {
      id,
      name: newNodeName.trim(),
      role: newNodeRole,
      protocol: newNodeProtocol.trim() || 'Modbus',
      x: 380,
      y: 220,
      status: 'online',
      detail: newNodeDetail.trim() || 'Custom added component in SCADA bus.',
    };

    setCustomNodesByProfile((prev) => ({
      ...prev,
      [activeProfile]: [...currentNodes, newNode],
    }));

    setIsAddModalOpen(false);
    setNewNodeName('');
    setNewNodeDetail('');
    setSelectedNodeId(id);
  };

  return (
    <div className={styles.container}>
      {/* Top Header Banner */}
      <div className={styles.topBanner}>
        <div className={styles.bannerRow}>
          <div>
            <div className={styles.stepTag}>
              <span>STEP 2 OF 4: SCADA & TELEMETRY TOPOLOGY</span>
              <span className={styles.stepTagSep}>|</span>
              <span className={styles.stepTagStats}>
                {displayedGraph.nodes.length} Nodes · {displayedGraph.edges.length} Fieldbus Links
              </span>
            </div>
            <h2 className={styles.title}>Industrial SCADA & Telemetry Topology Canvas</h2>
            <p className={styles.subtitle}>
              Deterministic telemetry and command paths connect sensors, PLC & Mamdani FIS nodes, modeled actuators, and gateways.
              Click a link to simulate a cable fault.
            </p>
          </div>

          <div className={styles.actionsGroup}>
            <button
              className={styles.btnSecondary}
              onClick={() => setIsAddModalOpen(true)}
              title="Add a virtual industrial component"
            >
              <Plus size={15} />
              <span>+ Add Component</span>
            </button>

            <button
              className={styles.btnSecondary}
              onClick={handleResetStarter}
              title="Reset topology to starter preset"
            >
              <RotateCcw size={15} />
              <span>Reset Starter</span>
            </button>

            <Link href="/simulation" className={styles.btnPrimary}>
              <span>Run Simulation (Step 3)</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>

        {/* Profile Selector Tabs */}
        <div className={styles.profileTabs}>
          {PROFILES.map((p) => {
            const active = p.id === activeProfile;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setProfile(p.id);
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                }}
                className={`${styles.profileTab} ${active ? styles.profileTabActive : ''}`}
              >
                {p.shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className={styles.workspace}>
        {/* Canvas Area */}
        <div
          className={styles.canvasCard}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onClick={() => {
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
          }}
        >
          {/* Background Grid Pattern */}
          <div className={styles.canvasBackground} />

          {/* Roles Legend Overlay */}
          <div className={styles.canvasOverlayTop}>
            <span className={styles.rolesLabel}>ROLES:</span>
            <span className={styles.roleBadge}>
              <span className={`${styles.roleDot} ${styles.roleDotSensor}`} />
              <span>Sensor</span>
            </span>
            <span className={styles.roleBadge}>
              <span className={`${styles.roleDot} ${styles.roleDotController}`} />
              <span>Controller</span>
            </span>
            <span className={styles.roleBadge}>
              <span className={`${styles.roleDot} ${styles.roleDotActuator}`} />
              <span>Actuator</span>
            </span>
            <span className={styles.roleBadge}>
              <span className={`${styles.roleDot} ${styles.roleDotGateway}`} />
              <span>Gateway</span>
            </span>
            <span className={styles.roleBadge}>
              <span className={`${styles.roleDot} ${styles.roleDotCloud}`} />
              <span>Cloud</span>
            </span>
          </div>

          {/* SVG Canvas for Links & Nodes */}
          <svg
            className={styles.svgViewport}
            viewBox="0 0 960 580"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="gradSensor" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id="gradController" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#581c87" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id="gradActuator" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7c2d12" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id="gradGateway" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#064e3b" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id="gradCloud" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#334155" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
              </linearGradient>
            </defs>

            {/* 1. Render Edges */}
            {displayedGraph.edges.map((edge) => {
              const srcNode = displayedGraph.nodes.find((n) => n.id === edge.source);
              const tgtNode = displayedGraph.nodes.find((n) => n.id === edge.target);
              if (!srcNode || !tgtNode) return null;

              // Output handle on right edge of source
              const x1 = srcNode.x + NODE_WIDTH;
              const y1 = srcNode.y + NODE_HEIGHT / 2;

              // Input handle on left edge of target
              const x2 = tgtNode.x;
              const y2 = tgtNode.y + NODE_HEIGHT / 2;

              // Smooth cubic bezier
              const dx = Math.max(40, Math.abs(x2 - x1) * 0.5);
              const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

              const isBroken = edge.status === 'broken';
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              return (
                <g key={edge.id}>
                  {/* Invisible wide hit area for easy clicking */}
                  <path
                    d={pathData}
                    className={styles.edgeHitArea}
                    onClick={(e) => handleEdgeClick(edge.id, e)}
                  />

                  {/* Visible Cable Path */}
                  <path
                    id={`path-${edge.id}`}
                    d={pathData}
                    className={`${styles.edgePath} ${isBroken ? styles.edgePathBroken : ''}`}
                    onClick={(e) => handleEdgeClick(edge.id, e)}
                  />

                  {/* Flowing animated telemetry packet when active */}
                  {!isBroken && (
                    <circle r="3.5" className={styles.packetParticle}>
                      <animateMotion
                        dur="2.4s"
                        repeatCount="indefinite"
                        path={pathData}
                      />
                    </circle>
                  )}

                  {/* Edge Label Pill */}
                  <g
                    className={styles.edgeLabelGroup}
                    transform={`translate(${midX}, ${midY})`}
                    onClick={(e) => handleEdgeClick(edge.id, e)}
                  >
                    <rect
                      x="-40"
                      y="-10"
                      width="80"
                      height="20"
                      className={`${styles.edgeLabelBg} ${isBroken ? styles.edgeLabelBgBroken : ''}`}
                    />
                    <text
                      className={`${styles.edgeLabelText} ${isBroken ? styles.edgeLabelTextBroken : ''}`}
                    >
                      {isBroken ? '⚡ SEVERED' : edge.label}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* 2. Render Nodes */}
            {displayedGraph.nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              let fillGrad = 'url(#gradSensor)';
              let borderClass = styles.nodeBorderSensor;
              let roleTag = 'SENSOR';

              if (node.role === 'controller') {
                fillGrad = 'url(#gradController)';
                borderClass = styles.nodeBorderController;
                roleTag = 'CONTROLLER';
              } else if (node.role === 'actuator') {
                fillGrad = 'url(#gradActuator)';
                borderClass = styles.nodeBorderActuator;
                roleTag = 'ACTUATOR';
              } else if (node.role === 'gateway') {
                fillGrad = 'url(#gradGateway)';
                borderClass = styles.nodeBorderGateway;
                roleTag = 'GATEWAY';
              } else if (node.role === 'cloud') {
                fillGrad = 'url(#gradCloud)';
                borderClass = styles.nodeBorderCloud;
                roleTag = 'CLOUD';
              }

              // Check if any connected edge is severed
              const hasBrokenEdge = displayedGraph.edges.some(
                (e) => (e.source === node.id || e.target === node.id) && e.status === 'broken'
              );

              return (
                <g
                  key={node.id}
                  className={styles.nodeGroup}
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                >
                  {/* Card Body */}
                  <rect
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    fill={fillGrad}
                    className={`${styles.nodeCardRect} ${borderClass} ${isSelected ? styles.nodeCardRectSelected : ''}`}
                  />

                  {/* Left Connection Port */}
                  <circle
                    cx={0}
                    cy={NODE_HEIGHT / 2}
                    r={5}
                    className={`${styles.nodePort} ${styles.nodePortLeft}`}
                  />

                  {/* Right Connection Port */}
                  <circle
                    cx={NODE_WIDTH}
                    cy={NODE_HEIGHT / 2}
                    r={5}
                    className={`${styles.nodePort} ${styles.nodePortRight}`}
                  />

                  {/* Role Header Pill */}
                  <text
                    x={12}
                    y={22}
                    fill={
                      node.role === 'sensor'
                        ? '#60a5fa'
                        : node.role === 'controller'
                        ? '#c084fc'
                        : node.role === 'actuator'
                        ? '#fb923c'
                        : node.role === 'gateway'
                        ? '#34d399'
                        : '#94a3b8'
                    }
                    fontSize="10"
                    fontWeight="700"
                    letterSpacing="0.06em"
                  >
                    {roleTag}
                  </text>

                  {/* Status Indicator Dot */}
                  <circle
                    cx={NODE_WIDTH - 16}
                    cy={18}
                    r={4}
                    fill={hasBrokenEdge ? '#ef4444' : '#10b981'}
                  />

                  {/* Node Name */}
                  <text
                    x={12}
                    y={42}
                    fill="#f8fafc"
                    fontSize="13"
                    fontWeight="600"
                  >
                    {node.name.length > 20 ? `${node.name.slice(0, 18)}...` : node.name}
                  </text>

                  {/* Protocol Subtext */}
                  <text
                    x={12}
                    y={60}
                    fill="#94a3b8"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {node.protocol}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Bottom Zoom Controls Overlay */}
          <div className={styles.canvasOverlayBottom}>
            <button
              className={styles.canvasBtnTool}
              onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}
              title="Zoom In"
            >
              <Plus size={14} />
            </button>
            <button
              className={styles.canvasBtnTool}
              onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}
              title="Zoom Out"
            >
              <Minus size={14} />
            </button>
            <button
              className={styles.canvasBtnTool}
              onClick={() => setZoom(1)}
              title="Reset Zoom"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Right Side Panel: Instructions, Interlock Validation & Node Inspector */}
        <div className={styles.sidePanel}>
          {/* Instructions Card */}
          <div className={styles.panelCard}>
            <div className={styles.panelTitle}>
              <span>Graph Instructions</span>
              <Layers size={14} />
            </div>

            <ul className={styles.instructionsList}>
              <li className={styles.instructionItem}>
                <span className={styles.instructionBullet}>•</span>
                <span>
                  <strong className={styles.instructionBold}>Signal Routing:</strong> Directed links
                  show how field sensors send telemetry to PLC and Mamdani FIS controllers.
                </span>
              </li>
              <li className={styles.instructionItem}>
                <span className={styles.instructionBullet}>•</span>
                <span>
                  <strong className={styles.instructionBold}>Sever Cable:</strong> Click any
                  connection cable to simulate a physical cable cut or transceiver failure.
                </span>
              </li>
              <li className={styles.instructionItem}>
                <span className={styles.instructionBullet}>•</span>
                <span>
                  <strong className={styles.instructionBold}>Telemetry Coupling:</strong> Severing a
                  sensor cable marks that sensor as <span style={{ color: '#ef4444' }}>OFFLINE</span> in
                  the live simulation and drops FIS confidence!
                </span>
              </li>
              <li className={styles.instructionItem}>
                <span className={styles.instructionBullet}>•</span>
                <span>
                  <strong className={styles.instructionBold}>Actuator Path:</strong> The check reports
                  whether a modeled controller-to-actuator route exists. This canvas does not issue or block equipment commands.
                </span>
              </li>
            </ul>

            {/* Validation Results Box */}
            <div className={styles.validationCard}>
              <div className={styles.scoreRow}>
                <div>
                  <div className={styles.scoreLabel}>Topology Connectivity Score</div>
                  <div
                    className={`${styles.scoreNumber} ${
                      validation.score < 50
                        ? styles.scoreNumberCritical
                        : validation.score < 90
                        ? styles.scoreNumberDegraded
                        : ''
                    }`}
                  >
                    {validation.score}%
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className={styles.scoreLabel}>Connectivity Status</div>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: validation.valid ? '#10b981' : '#ef4444',
                    }}
                  >
                    {validation.valid ? 'CHECKS PASS' : 'NEEDS REVIEW'}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 8, color: '#94a3b8', fontSize: '0.72rem', lineHeight: 1.4 }}>
                Educational connectivity score only. It is not an SIL or functional-safety assessment.
              </div>

              {/* Checks Checklist */}
              <div className={styles.checksList}>
                {validation.checks.map((chk) => (
                  <div key={chk.id} className={styles.checkItem}>
                    {chk.passed ? (
                      <CheckCircle2 size={14} className={styles.checkIconPassed} />
                    ) : (
                      <AlertTriangle size={14} className={styles.checkIconFailed} />
                    )}
                    <div>
                      <div style={{ fontWeight: 600, color: chk.passed ? '#f1f5f9' : '#fca5a5' }}>
                        {chk.name}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: 1.3 }}>
                        {chk.detail}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Node / Edge Inspector Card */}
          {selectedNode ? (
            <div className={styles.inspectorCard}>
              <div className={styles.inspectorHeader}>
                <span
                  className={`${styles.inspectorRoleTag} ${
                    selectedNode.role === 'sensor'
                      ? styles.tagSensor
                      : selectedNode.role === 'controller'
                      ? styles.tagController
                      : selectedNode.role === 'actuator'
                      ? styles.tagActuator
                      : selectedNode.role === 'gateway'
                      ? styles.tagGateway
                      : styles.tagCloud
                  }`}
                >
                  {selectedNode.role}
                </span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>ID: {selectedNode.id}</span>
              </div>

              <h3 className={styles.inspectorTitle}>{selectedNode.name}</h3>
              <div className={styles.inspectorMeta}>Protocol: {selectedNode.protocol}</div>
              <p className={styles.inspectorDetail}>{selectedNode.detail}</p>

              {/* Live Telemetry Value if sensor */}
              {liveSensorReading && (
                <div className={styles.liveTelemetryBox}>
                  <div>
                    <div className={styles.liveTelemetryLabel}>Live Virtual Reading</div>
                    <div
                      className={`${styles.liveTelemetryValue} ${
                        liveSensorReading.status === 'offline' ? styles.telemetryStatusOffline : ''
                      }`}
                    >
                      {liveSensorReading.status === 'offline'
                        ? 'OFFLINE (CABLE FAULT)'
                        : `${liveSensorReading.value.toFixed(1)} ${liveSensorReading.unit}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={styles.liveTelemetryLabel}>Sensor Health</div>
                    <div
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: liveSensorReading.health > 80 ? '#10b981' : '#ef4444',
                      }}
                    >
                      {liveSensorReading.health}%
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : selectedEdge ? (
            <div className={styles.inspectorCard}>
              <div className={styles.inspectorHeader}>
                <span className={styles.inspectorRoleTag} style={{ background: '#334155', color: '#cbd5e1' }}>
                  FIELDBUS CABLE
                </span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>ID: {selectedEdge.id}</span>
              </div>
              <h3 className={styles.inspectorTitle}>{selectedEdge.label}</h3>
              <div className={styles.inspectorMeta}>
                Protocol: {selectedEdge.protocol} · Latency: {selectedEdge.latencyMs ?? 10}ms
              </div>
              <div style={{ margin: '10px 0' }}>
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: selectedEdge.status === 'broken' ? '#ef4444' : '#10b981',
                  }}
                >
                  Status: {selectedEdge.status === 'broken' ? 'SEVERED / FAULT' : 'ACTIVE & TRANSMITTING'}
                </span>
              </div>
              <button
                className={styles.btnSecondary}
                onClick={() => toggleTopologyEdge(selectedEdge.id)}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {selectedEdge.status === 'broken' ? (
                  <>
                    <Zap size={14} style={{ color: '#10b981' }} />
                    <span>Restore Cable Continuity</span>
                  </>
                ) : (
                  <>
                    <ZapOff size={14} style={{ color: '#ef4444' }} />
                    <span>Sever Cable (Inject Line Fault)</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className={styles.panelCard} style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
              Select a component node or fieldbus cable to inspect telemetry parameters and fault state.
            </div>
          )}
        </div>
      </div>

      {/* Add Component Modal */}
      {isAddModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsAddModalOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className={styles.modalTitle}>Add SCADA Component</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddComponent} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Component Role</label>
                <select
                  className={styles.formSelect}
                  value={newNodeRole}
                  onChange={(e) => setNewNodeRole(e.target.value as TopologyComponentRole)}
                >
                  <option value="sensor">Sensor (Telemetry Acquisition)</option>
                  <option value="controller">Controller (PLC / Mamdani FIS)</option>
                  <option value="actuator">Actuator (Deluge Valve / Trip Relay)</option>
                  <option value="gateway">Gateway (Modbus TCP / LoRaWAN)</option>
                  <option value="cloud">Cloud / Central HMI</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Component Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. Flank IR Sensor, Deluge Solenoid B"
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Fieldbus Protocol</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. Modbus RS-485, 4-20mA, CAN-bus"
                  value={newNodeProtocol}
                  onChange={(e) => setNewNodeProtocol(e.target.value)}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Technical Detail / Specification</label>
                <textarea
                  className={styles.formTextarea}
                  rows={3}
                  placeholder="Operational role, voltage, or measurement target..."
                  value={newNodeDetail}
                  onChange={(e) => setNewNodeDetail(e.target.value)}
                />
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary}>
                  Add to Canvas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Academic Disclaimer Footer */}
      <div className={styles.footerDisclaimer}>
        CoalGuard SCADA Topology — Educational Software Simulation. No real physical sensors, microcontrollers, or actuators are connected.
      </div>
    </div>
  );
}
