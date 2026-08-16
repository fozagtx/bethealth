/** BetaHealth — scoring helpers (local-first). */
import type { MetricDefinition, MetricKey, Band } from '@/types';

export const METRICS: MetricDefinition[] = [
  { key: 'systolic_bp', label: 'Systolic BP', unit: 'mmHg', bands: [{ max: 120, band: 'optimal' }, { max: 139, band: 'borderline' }, { max: 300, band: 'high' }], weight: 1.2 },
  { key: 'diastolic_bp', label: 'Diastolic BP', unit: 'mmHg', bands: [{ max: 80, band: 'optimal' }, { max: 89, band: 'borderline' }, { max: 200, band: 'high' }], weight: 1.2 },
  { key: 'fasting_glucose', label: 'Fasting Glucose', unit: 'mg/dL', bands: [{ max: 99, band: 'optimal' }, { max: 125, band: 'borderline' }, { max: 500, band: 'high' }], weight: 1.1 },
  { key: 'hba1c', label: 'HbA1c', unit: '%', bands: [{ max: 5.6, band: 'optimal' }, { max: 6.4, band: 'borderline' }, { max: 20, band: 'high' }], weight: 1.1 },
  { key: 'total_cholesterol', label: 'Total Cholesterol', unit: 'mg/dL', bands: [{ max: 200, band: 'optimal' }, { max: 239, band: 'borderline' }, { max: 500, band: 'high' }], weight: 1.0 },
  { key: 'ldl', label: 'LDL', unit: 'mg/dL', bands: [{ max: 100, band: 'optimal' }, { max: 159, band: 'borderline' }, { max: 400, band: 'high' }], weight: 1.2 },
  { key: 'hdl', label: 'HDL', unit: 'mg/dL', bands: [{ max: 40, band: 'high' }, { max: 59, band: 'borderline' }, { max: 200, band: 'optimal' }], invert: true, weight: 1.0 },
  { key: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', bands: [{ max: 150, band: 'optimal' }, { max: 199, band: 'borderline' }, { max: 600, band: 'high' }], weight: 0.9 },
  { key: 'bmi', label: 'BMI', unit: 'kg/m²', bands: [{ max: 18.5, band: 'borderline' }, { max: 24.9, band: 'optimal' }, { max: 29.9, band: 'borderline' }, { max: 60, band: 'high' }], weight: 0.8 },
  { key: 'resting_hr', label: 'Resting Heart Rate', unit: 'bpm', bands: [{ max: 70, band: 'optimal' }, { max: 90, band: 'borderline' }, { max: 200, band: 'high' }], weight: 0.7 },
  { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', bands: [{ max: 12, band: 'borderline' }, { max: 17.5, band: 'optimal' }, { max: 25, band: 'high' }], weight: 0.6 },
  { key: 'creatinine', label: 'Creatinine', unit: 'mg/dL', bands: [{ max: 1.2, band: 'optimal' }, { max: 1.5, band: 'borderline' }, { max: 10, band: 'high' }], weight: 0.7 },
  { key: 'alt', label: 'ALT', unit: 'U/L', bands: [{ max: 35, band: 'optimal' }, { max: 70, band: 'borderline' }, { max: 500, band: 'high' }], weight: 0.6 },
  { key: 'ast', label: 'AST', unit: 'U/L', bands: [{ max: 35, band: 'optimal' }, { max: 70, band: 'borderline' }, { max: 500, band: 'high' }], weight: 0.6 },
  { key: 'vitamin_d', label: 'Vitamin D', unit: 'ng/mL', bands: [{ max: 20, band: 'high' }, { max: 29, band: 'borderline' }, { max: 100, band: 'optimal' }], invert: true, weight: 0.5 },
  { key: 'tsh', label: 'TSH', unit: 'mIU/L', bands: [{ max: 0.4, band: 'borderline' }, { max: 4.0, band: 'optimal' }, { max: 20, band: 'high' }], weight: 0.5 },
];

const METRIC_MAP = new Map<MetricKey, MetricDefinition>(METRICS.map((m) => [m.key, m]));

export function getMetricDef(key: MetricKey): MetricDefinition {
  const def = METRIC_MAP.get(key);
  if (!def) throw new Error(`Unknown metric: ${key}`);
  return def;
}

export function getBand(key: MetricKey, value: number): Band {
  const def = getMetricDef(key);
  for (const { max, band } of def.bands) {
    if (value <= max) return band;
  }
  return 'high';
}

export function getTargetString(key: MetricKey): string {
  const def = getMetricDef(key);
  const optimal = def.bands.find((b) => b.band === 'optimal');
  if (!optimal) return 'Normal range';
  const idx = def.bands.indexOf(optimal);
  const min = idx > 0 ? def.bands[idx - 1].max : undefined;
  if (def.invert) {
    return min ? `${min}–${optimal.max} ${def.unit}` : `> ${optimal.max} ${def.unit}`;
  }
  return min ? `${min}–${optimal.max} ${def.unit}` : `< ${optimal.max} ${def.unit}`;
}

export function scoreMetric(key: MetricKey, value: number): number {
  const def = getMetricDef(key);
  const band = getBand(key, value);
  if (band === 'optimal') {
    const optimalMax = def.bands.find((b) => b.band === 'optimal')!;
    const idx = def.bands.indexOf(optimalMax);
    const optimalMin = idx > 0 ? def.bands[idx - 1].max : 0;
    const range = optimalMax.max - optimalMin;
    if (range === 0) return 95;
    const pos = def.invert ? (value - optimalMin) / range : 1 - (value - optimalMin) / range;
    return Math.round(85 + Math.max(0, Math.min(1, pos)) * 15);
  }
  if (band === 'borderline') {
    const bl = def.bands.find((b) => b.band === 'borderline')!;
    const idx = def.bands.indexOf(bl);
    const min = idx > 0 ? def.bands[idx - 1].max : 0;
    const range = bl.max - min;
    if (range === 0) return 65;
    return Math.round(84 - ((value - min) / range) * 34);
  }
  const hi = def.bands.find((b) => b.band === 'high')!;
  const idx = def.bands.indexOf(hi);
  const min = idx > 0 ? def.bands[idx - 1].max : 0;
  const range = hi.max - min;
  if (range === 0) return 20;
  return Math.round(49 - Math.min(1, (value - min) / range) * 49);
}

import type { MetricValue, MetricScore, HealthScore } from '@/types';

export function computeHealthScore(metrics: MetricValue[], date: string): HealthScore {
  const scored: MetricScore[] = [];
  for (const mv of metrics) {
    const def = getMetricDef(mv.key);
    const score = scoreMetric(mv.key, mv.value);
    const band = getBand(mv.key, mv.value);
    scored.push({
      key: mv.key,
      label: def.label,
      value: mv.value,
      unit: def.unit,
      score,
      band,
      target: getTargetString(mv.key),
      weight: def.weight,
    });
  }
  const totalWeight = scored.reduce((sum, s) => sum + s.weight, 0);
  const overall = totalWeight === 0
    ? 0
    : Math.round(scored.reduce((sum, s) => sum + s.score * s.weight, 0) / totalWeight);
  return {
    overall,
    metrics: scored,
    metricCount: scored.length,
    totalMetrics: METRICS.length,
    date,
  };
}
