/**
 * CoalGuard - Backend API Route: Scenarios & Profiles Catalog
 * GET /api/scenarios
 *
 * Provides domain profiles, benchmark test scenarios, and academic metadata.
 */

import { NextResponse } from 'next/server';
import { PROFILES } from '../../../lib/data/profiles';
import { SCENARIOS } from '../../../lib/data/scenarios';
import { TEST_CASES } from '../../../lib/data/test-cases';

export const dynamic = 'force-static';

export async function GET() {
  const profilesSummary = Object.values(PROFILES).map((p) => ({
    id: p.id,
    title: p.facilityTitle,
    label: p.shortLabel,
    subtitle: p.facilitySubtitle,
    description: p.description,
    supportedSubmodes: p.supportedSubmodes ?? [],
    allowedScenarios: p.scenarios,
  }));

  const scenariosSummary = SCENARIOS.map((s) => ({
    id: s.id,
    label: s.label,
    detail: s.detail,
    profileHints: s.profileHints,
    expectedTrend: s.expectedTrend,
    presetConfig: s.presetConfig,
  }));

  const benchmarkTestCases = TEST_CASES.map((tc) => ({
    id: tc.id,
    label: tc.label,
    shortLabel: tc.shortLabel,
    profile: tc.profile,
    objective: tc.objective,
    phasesCount: tc.phases.length,
    durationTicks: tc.durationTicks,
  }));

  return NextResponse.json({
    success: true,
    version: '2.0.0-academic',
    profiles: profilesSummary,
    scenarios: scenariosSummary,
    benchmarks: benchmarkTestCases,
    academicNotice:
      'Academic decision-support catalog. Deterministic simulations for soft computing research.',
  });
}
