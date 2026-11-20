import {
  FIELD_GOAF_CASE,
  FIELD_GOAF_GAS_INDICES,
  GoafGasIndexObservation,
} from '../data/field-goaf-case';

export interface NormalizedGoafObservation extends GoafGasIndexObservation {
  normalized: {
    coToCo2: number;
    grahamTimesTen: number;
    alkaneRatio: number;
  };
  changeFromFirstPercent: {
    coToCo2: number;
    grahamTimesTen: number;
    alkaneRatio: number;
  };
}

export interface FieldGoafReplay {
  source: typeof FIELD_GOAF_CASE;
  observations: NormalizedGoafObservation[];
  selectedObservation: NormalizedGoafObservation;
  seriesMaximums: {
    coToCo2: number;
    grahamTimesTen: number;
    alkaneRatio: number;
  };
  modelScoreAvailable: false;
}

function normalize(value: number, maximum: number): number {
  return maximum > 0 ? Math.max(0, Math.min(100, (value / maximum) * 100)) : 0;
}

function changeFromBaseline(value: number, baseline: number): number {
  if (baseline === 0) return value === 0 ? 0 : 100;
  return ((value - baseline) / Math.abs(baseline)) * 100;
}

export function buildFieldGoafReplay(selectedDay: number): FieldGoafReplay {
  const maximums = {
    coToCo2: Math.max(...FIELD_GOAF_GAS_INDICES.map((row) => row.coToCo2)),
    grahamTimesTen: Math.max(...FIELD_GOAF_GAS_INDICES.map((row) => row.grahamTimesTen)),
    alkaneRatio: Math.max(...FIELD_GOAF_GAS_INDICES.map((row) => row.alkaneRatio)),
  };
  const baseline = FIELD_GOAF_GAS_INDICES[0];
  const observations = FIELD_GOAF_GAS_INDICES.map((row) => ({
    ...row,
    normalized: {
      coToCo2: normalize(row.coToCo2, maximums.coToCo2),
      grahamTimesTen: normalize(row.grahamTimesTen, maximums.grahamTimesTen),
      alkaneRatio: normalize(row.alkaneRatio, maximums.alkaneRatio),
    },
    changeFromFirstPercent: {
      coToCo2: changeFromBaseline(row.coToCo2, baseline.coToCo2),
      grahamTimesTen: changeFromBaseline(row.grahamTimesTen, baseline.grahamTimesTen),
      alkaneRatio: changeFromBaseline(row.alkaneRatio, baseline.alkaneRatio),
    },
  }));
  const requestedDay = Number.isFinite(selectedDay) ? Math.floor(selectedDay) : 1;
  const safeDay = Math.max(1, Math.min(observations.length, requestedDay));

  return {
    source: FIELD_GOAF_CASE,
    observations,
    selectedObservation: observations[safeDay - 1],
    seriesMaximums: maximums,
    modelScoreAvailable: false,
  };
}
