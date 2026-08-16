/** BetaHealth — useHealthState */
import { useCallback, useEffect, useState } from 'react';
import type { Report, HealthScore, DailyPlan, MetricValue } from '@/types';
import {
  getReports,
  saveReport,
  deleteReport as dbDeleteReport,
  getScores,
  setScores,
  getPlans,
  setPlans,
  savePlan,
  getNotes,
  saveNotes as dbSaveNotes,
  saveHeight,
  saveWeight,
  getHeight,
  getWeight,
} from '@/lib/db';
import { computeHealthScore } from '@/lib/scoring';
import { generateDailyPlan } from '@/lib/plan';
import { syncGamification, loadGamification, type GamificationState } from '@/lib/gamification';
import { todayISO } from '@/lib/dates';

export interface HealthState {
  loading: boolean;
  reports: Report[];
  scores: HealthScore[];
  plans: DailyPlan[];
  todayPlan: DailyPlan | null;
  latestScore: HealthScore | null;
  previousScore: HealthScore | null;
  gamification: GamificationState | null;
  notes: string;
  height?: number;
  weight?: number;
}

export interface HealthActions {
  addReport: (date: string, metrics: MetricValue[], height?: number, weight?: number) => Promise<void>;
  toggleTask: (taskId: string) => Promise<void>;
  deleteReport: (reportId: string) => Promise<void>;
  saveNotes: (text: string) => Promise<void>;
  refresh: () => Promise<void>;
}

function sortedByDateDesc(scores: HealthScore[]): HealthScore[] {
  return [...scores].sort((a, b) => b.date.localeCompare(a.date));
}

function outOfRangeKeys(score: HealthScore | null) {
  return score ? score.metrics.filter((m) => m.band !== 'optimal').map((m) => m.key) : [];
}

/**
 * Rebuilds today's plan from the latest score, preserving completion state of
 * tasks that survive the rebuild (task IDs are stable per date + library slot).
 */
async function rebuildTodayPlan(scores: HealthScore[]): Promise<void> {
  const today = todayISO();
  const plans = await getPlans();
  const existing = plans.find((p) => p.date === today);
  const keys = outOfRangeKeys(sortedByDateDesc(scores)[0] ?? null);

  const others = plans.filter((p) => p.date !== today);
  if (keys.length === 0) {
    // Nothing out of range (or no reports): today has no generated plan.
    // Keep the day only if the user already completed something on it.
    if (existing && existing.tasks.some((t) => t.completed)) {
      const kept = existing.tasks.filter((t) => t.completed);
      await setPlans([...others, { ...existing, tasks: kept, completedCount: kept.length, totalCount: kept.length }]);
    } else {
      await setPlans(others);
    }
    return;
  }

  const fresh = generateDailyPlan(keys, today);
  const tasks = fresh.tasks.map((t) => ({
    ...t,
    completed: existing?.tasks.find((old) => old.id === t.id)?.completed ?? false,
  }));
  const completedCount = tasks.filter((t) => t.completed).length;
  await setPlans([...others, { ...fresh, tasks, completedCount, totalCount: tasks.length }]);
}

export function useHealthState(): [HealthState, HealthActions] {
  const [state, setState] = useState<HealthState>({
    loading: true,
    reports: [],
    scores: [],
    plans: [],
    todayPlan: null,
    latestScore: null,
    previousScore: null,
    gamification: null,
    notes: '',
  });

  const refresh = useCallback(async () => {
    const today = todayISO();
    const [reports, scores, notes, height, weight] = await Promise.all([
      getReports(),
      getScores(),
      getNotes(),
      getHeight(),
      getWeight(),
    ]);

    // Ensure today's plan exists when there is something to work on
    let plans = await getPlans();
    const latest = sortedByDateDesc(scores)[0] ?? null;
    if (!plans.some((p) => p.date === today) && outOfRangeKeys(latest).length > 0) {
      await savePlan(generateDailyPlan(outOfRangeKeys(latest), today));
      plans = await getPlans();
    }

    const gamification = await loadGamification();
    const sorted = sortedByDateDesc(scores);
    setState({
      loading: false,
      reports: [...reports].sort((a, b) => b.date.localeCompare(a.date)),
      scores,
      plans,
      todayPlan: plans.find((p) => p.date === today) ?? null,
      latestScore: sorted[0] ?? null,
      previousScore: sorted[1] ?? null,
      gamification,
      notes,
      height,
      weight,
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addReport = useCallback(
    async (date: string, metrics: MetricValue[], height?: number, weight?: number) => {
      if (height) await saveHeight(height);
      if (weight) await saveWeight(weight);

      const report: Report = {
        id: crypto.randomUUID(),
        date,
        metrics,
        createdAt: new Date().toISOString(),
      };
      await saveReport(report);

      // Scores are always re-derived from confirmed report data
      const reports = await getReports();
      const scores = reports.map((r) => computeHealthScore(r.metrics, r.date));
      await setScores(scores);

      await rebuildTodayPlan(scores);
      await syncGamification();
      await refresh();
    },
    [refresh]
  );

  const toggleTask = useCallback(
    async (taskId: string) => {
      const today = todayISO();
      const plans = await getPlans();
      const plan = plans.find((p) => p.date === today);
      if (!plan) return;
      const tasks = plan.tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t));
      const completedCount = tasks.filter((t) => t.completed).length;
      await savePlan({ ...plan, tasks, completedCount });
      await syncGamification();
      await refresh();
    },
    [refresh]
  );

  const deleteReport = useCallback(
    async (reportId: string) => {
      await dbDeleteReport(reportId);
      const reports = await getReports();
      const scores = reports.map((r) => computeHealthScore(r.metrics, r.date));
      await setScores(scores);
      await rebuildTodayPlan(scores);
      await syncGamification();
      await refresh();
    },
    [refresh]
  );

  const saveNotes = useCallback(async (text: string) => {
    await dbSaveNotes(text);
    setState((s) => ({ ...s, notes: text }));
  }, []);

  return [state, { addReport, toggleTask, deleteReport, saveNotes, refresh }];
}
