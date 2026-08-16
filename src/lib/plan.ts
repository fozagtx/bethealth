/** BetaHealth — plan helpers. */
import type { MetricKey, Task, DailyPlan } from '@/types';
import { getMetricDef, getTargetString } from '@/lib/scoring';

interface TaskTemplate {
  title: string;
  description: string;
  type: 'activity' | 'diet' | 'habit';
  metricKeys: MetricKey[];
}

const TASK_LIBRARY: TaskTemplate[] = [
  { title: '30-minute walk', description: 'Brisk walking helps lower LDL and improve cardiovascular health', type: 'activity', metricKeys: ['ldl', 'total_cholesterol', 'systolic_bp', 'diastolic_bp'] },
  { title: 'Oatmeal for breakfast', description: 'Soluble fiber in oats helps reduce LDL cholesterol', type: 'diet', metricKeys: ['ldl', 'total_cholesterol'] },
  { title: 'Add beans to one meal', description: 'Beans are high in fiber and help lower cholesterol', type: 'diet', metricKeys: ['ldl', 'total_cholesterol', 'fasting_glucose'] },
  { title: 'Handful of nuts', description: 'Almonds and walnuts support healthy cholesterol levels', type: 'diet', metricKeys: ['ldl', 'total_cholesterol'] },
  { title: 'Limit sodium to 2,300mg', description: 'Reducing sodium helps lower blood pressure', type: 'diet', metricKeys: ['systolic_bp', 'diastolic_bp'] },
  { title: 'Walk after meals', description: 'Post-meal walking helps regulate blood glucose', type: 'activity', metricKeys: ['fasting_glucose', 'hba1c'] },
  { title: 'Cut sugary drinks', description: 'Eliminating sugary beverages helps lower glucose and triglycerides', type: 'diet', metricKeys: ['fasting_glucose', 'hba1c', 'triglycerides'] },
  { title: '10 minutes of stretching', description: 'Gentle movement supports circulation and recovery', type: 'activity', metricKeys: ['systolic_bp', 'diastolic_bp', 'resting_hr'] },
  { title: 'Fatty fish serving', description: 'Salmon, mackerel, or sardines provide omega-3s for heart health', type: 'diet', metricKeys: ['ldl', 'triglycerides', 'total_cholesterol'] },
  { title: 'Leafy greens with dinner', description: 'Spinach, kale, and arugula support overall metabolic health', type: 'diet', metricKeys: ['fasting_glucose', 'bmi', 'hemoglobin'] },
  { title: '15 min strength training', description: 'Resistance training improves insulin sensitivity and metabolic rate', type: 'activity', metricKeys: ['fasting_glucose', 'hba1c', 'bmi'] },
  { title: 'Drink 8 glasses of water', description: 'Proper hydration supports kidney function and metabolism', type: 'habit', metricKeys: ['creatinine', 'bmi'] },
  { title: '10 minutes sunlight', description: 'Sun exposure helps boost vitamin D levels', type: 'habit', metricKeys: ['vitamin_d'] },
  { title: 'Vitamin D rich food', description: 'Egg yolks, fortified milk, and mushrooms support vitamin D', type: 'diet', metricKeys: ['vitamin_d'] },
  { title: 'Deep breathing exercise', description: '5 minutes of deep breathing helps lower resting heart rate', type: 'habit', metricKeys: ['resting_hr', 'systolic_bp', 'diastolic_bp'] },
  { title: 'Avoid processed foods', description: 'Reducing processed foods helps lower ALT and AST levels', type: 'diet', metricKeys: ['alt', 'ast'] },
  { title: 'Green tea', description: 'Green tea antioxidants support liver health', type: 'diet', metricKeys: ['alt', 'ast'] },
  { title: 'Iodine-rich food', description: 'Seaweed, dairy, and fish support thyroid function', type: 'diet', metricKeys: ['tsh'] },
  { title: 'Avoid excessive soy', description: 'Limiting raw soy can help maintain healthy TSH levels', type: 'diet', metricKeys: ['tsh'] },
  { title: 'Portion control at dinner', description: 'Smaller evening portions help manage BMI and glucose', type: 'diet', metricKeys: ['bmi', 'fasting_glucose'] },
];

export function generateDailyPlan(outOfRangeMetrics: MetricKey[], date: string): DailyPlan {
  // Deterministic: rank by how many of the user's out-of-range metrics a task
  // addresses, tie-broken by library order. Same inputs always give the same plan.
  const ranked = TASK_LIBRARY
    .map((t, libraryIndex) => ({
      t,
      libraryIndex,
      matched: t.metricKeys.filter((k) => outOfRangeMetrics.includes(k)),
    }))
    .filter((r) => r.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length || a.libraryIndex - b.libraryIndex);

  const selected = ranked.slice(0, Math.min(7, ranked.length));

  const tasks: Task[] = selected.map(({ t, libraryIndex, matched }) => ({
    id: `task-${date}-${libraryIndex}`,
    title: t.title,
    description: t.description,
    metricKeys: matched,
    type: t.type,
    completed: false,
    date,
  }));

  return {
    date,
    tasks,
    completedCount: 0,
    totalCount: tasks.length,
  };
}

export function getTaskReason(task: Task, metricValues: { key: MetricKey; value: number }[]): string {
  const reasons: string[] = [];
  for (const key of task.metricKeys) {
    const mv = metricValues.find((m) => m.key === key);
    if (mv) {
      const def = getMetricDef(key);
      const target = getTargetString(key);
      reasons.push(`Your ${def.label} is ${mv.value} ${def.unit}, target: ${target}`);
    }
  }
  return reasons.join('. ');
}
