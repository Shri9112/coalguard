/**
 * CoalGuard - Backend API Route: SCADA & Telemetry Topology Validator
 * POST /api/topology/validate
 *
 * Evaluates directed telemetry/command paths and fieldbus continuity in a
 * virtual academic SCADA design. This is not a functional-safety assessment.
 */

import { NextResponse } from 'next/server';
import { getTopologyForProfile, PROFILE_TOPOLOGIES } from '../../../../lib/data/topologies';
import { validateTopology } from '../../../../lib/engine/topology-validator';
import { EnvironmentProfile, TopologyGraph } from '../../../../lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let graph: TopologyGraph;

    if (body.nodes && body.edges) {
      graph = {
        id: body.id || 'custom-topology',
        name: body.name || 'Custom SCADA Topology',
        profile: (body.profile as EnvironmentProfile) || 'mine-conveyor',
        nodes: body.nodes,
        edges: body.edges,
      };
    } else if (body.profile && PROFILE_TOPOLOGIES[body.profile as EnvironmentProfile]) {
      graph = getTopologyForProfile(body.profile as EnvironmentProfile);
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Please provide either a valid { profile } or { nodes, edges } graph payload.',
        },
        { status: 400 }
      );
    }

    const validation = validateTopology(graph);

    return NextResponse.json({
      success: true,
      profile: graph.profile,
      graphId: graph.id,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      validation,
      academicNotice:
        'Directed connectivity check on a virtual deterministic model only. This does not assess SIL or functional safety.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to validate topology graph';
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 400 }
    );
  }
}
