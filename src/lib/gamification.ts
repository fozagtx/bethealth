import type {
  Streak,
  Points,
  Badge,
  WeeklyChallenge,
  UserState,
  MetricKey,
  HealthScore,
  DailyPlan,
} from '@/types';
import {
  saveStreak,
  savePoints,
  getBadges,
  saveBadges,
  getChallenges,
  saveChallenges,
  getPlans,
  getScores,
  getReports,
  getPoints,
  getStreak,
} from '@/lib/db';
import { getMetricDef } from '@/lib/scoring';
import { todayISO, addDays, weekStartOf } from '@/lib/dates';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Base XP awarded per completed task */
const BASE_POINTS_PER_TASK = 10;

/** Max multiplier from streak bonus (2× at 10-day streak and beyond) */
const MAX_STREAK_MULTIPLIER = 2.0;

/** Increment per streak day for the multiplier (0.1 per day) */
const STREAK_MULTIPLIER_INCREMENT = 0.1;

/** Number of relevant tasks needed to complete a weekly challenge */
export const CHALLENGE_TARGET_TASKS = 5;

/** All possible badges, earned only through real health events */
export const BADGE_DEFINITIONS: Omit<Badge, 'earnedAt'>[] = [
  {
    id: 'first_report',
    label: 'First Steps',
    description: 'Logged your first health report',
    icon: '📋',
  },
  {
    id: 'streak_7',
    label: 'Week Warrior',
    description: '7-day task completion streak',
    icon: '🔥',
  },
  {
    id: 'streak_30',
    label: 'Monthly Master',
    description: '30-day task completion streak',
    icon: '🏆',
  },
  {
    id: 'metric_recovered',
    label: 'Back in Range',
    description: 'Moved a metric from borderline/high back to optimal',
    icon: '📈',
  },
  {
    id: 'score_up_10',
    label: 'Rising Star',
    description: 'Improved overall health score by 10+ points',
    icon: '⭐',
  },
];

// ─── Streaks and Points (derived, never incremented in place) ────────────────

/**
 * Streak and points are always recomputed from the saved plan history. A day
 * counts toward the streak when at least one task was completed that day.
 * Because everything derives from the same source data, unchecking a task is
 * reflected honestly and completing the same task twice can never double-award.
 */
export function computeStreakAndPoints(plans: DailyPlan[], today: string): { streak: Streak; points: Points } {
  const activeDays = [...new Set(
    plans.filter((p) => p.tasks.some((t) => t.completed)).map((p) => p.date)
  )].sort();

  // Longest run of consecutive active days
  let longestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of activeDays) {
    run = prev !== null && addDays(prev, 1) === day ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    prev = day;
  }

  // Current streak: consecutive active days ending today, or yesterday when
  // today has no completions yet (the streak isn't broken until the day ends)
  let currentStreak = 0;
  let cursor = activeDays.includes(today) ? today : addDays(today, -1);
  while (activeDays.includes(cursor)) {
    currentStreak++;
    cursor = addDays(cursor, -1);
  }

  // Points: replay history in date order, applying the streak multiplier the
  // user had on each day (streak length including that day)
  const weekStart = weekStartOf(today);
  let total = 0;
  let weeklyTotal = 0;
  let runningStreak = 0;
  let prevDay: string | null = null;
  for (const plan of [...plans].sort((a, b) => a.date.localeCompare(b.date))) {
    const completed = plan.tasks.filter((t) => t.completed).length;
    if (completed === 0) continue;
    runningStreak = prevDay !== null && addDays(prevDay, 1) === plan.date ? runningStreak + 1 : 1;
    prevDay = plan.date;
    const dayPoints = Math.round(completed * BASE_POINTS_PER_TASK * getStreakMultiplier(runningStreak));
    total += dayPoints;
    if (plan.date >= weekStart) weeklyTotal += dayPoints;
  }

  return {
    streak: {
      currentStreak,
      longestStreak,
      lastCompletedDate: activeDays.length > 0 ? activeDays[activeDays.length - 1] : null,
    },
    points: { total, weeklyTotal, weekStart },
  };
}

/** Streak bonus: +10% per day, capped at 2× (10+ days). */
export function getStreakMultiplier(streakLength: number): number {
  const bonus = Math.min(Math.max(streakLength, 0), 10) * STREAK_MULTIPLIER_INCREMENT;
  return Math.min(1 + bonus, MAX_STREAK_MULTIPLIER);
}

// ─── Badges ──────────────────────────────────────────────────────────────────

/**
 * Checks if any metric moved from non-optimal to optimal between two scores.
 */
function hasMetricRecovered(previous: HealthScore, current: HealthScore): boolean {
  const prevMap = new Map(previous.metrics.map((m) => [m.key, m.band]));

  for (const metric of current.metrics) {
    const prevBand = prevMap.get(metric.key);
    if (prevBand && prevBand !== 'optimal' && metric.band === 'optimal') {
      return true;
    }
  }
  return false;
}

/**
 * Checks which badges the user has newly earned based on real health events.
 *
 * Badge criteria (all honest, tied to real events):
 * - first_report: Has at least 1 report
 * - streak_7 / streak_30: Longest streak ≥ 7 / 30 (a streak once achieved stays earned)
 * - metric_recovered: Any metric moved from non-optimal → optimal between last two scores
 * - score_up_10: Overall score improved by ≥ 10 points between last two scores
 *
 * @returns Array of newly earned badges (not previously in user's collection)
 */
export function checkBadges(userState: UserState): Badge[] {
  const alreadyEarned = new Set(
    userState.badges.filter((b) => b.earnedAt !== null).map((b) => b.id),
  );
  const newlyEarned: Badge[] = [];
  const now = new Date().toISOString();

  const sortedScores = [...userState.scores].sort((a, b) => b.date.localeCompare(a.date));
  const latestScore = sortedScores[0];
  const previousScore = sortedScores[1];

  for (const def of BADGE_DEFINITIONS) {
    if (alreadyEarned.has(def.id)) continue;

    let earned = false;

    switch (def.id) {
      case 'first_report':
        earned = userState.reports.length >= 1;
        break;

      case 'streak_7':
        earned = userState.streak.longestStreak >= 7;
        break;

      case 'streak_30':
        earned = userState.streak.longestStreak >= 30;
        break;

      case 'metric_recovered':
        if (latestScore && previousScore) {
          earned = hasMetricRecovered(previousScore, latestScore);
        }
        break;

      case 'score_up_10':
        if (latestScore && previousScore) {
          earned = latestScore.overall - previousScore.overall >= 10;
        }
        break;
    }

    if (earned) {
      newlyEarned.push({ ...def, earnedAt: now });
    }
  }

  return newlyEarned;
}

// ─── Weekly Challenges ───────────────────────────────────────────────────────

/** Named challenge themes per focus metric ("Sodium week" style). */
const CHALLENGE_LIBRARY: Partial<Record<MetricKey, { title: string; description: string }>> = {
  systolic_bp: { title: 'Sodium week', description: 'Keep sodium under 2,300mg and walk daily to work on your blood pressure' },
  diastolic_bp: { title: 'Sodium week', description: 'Keep sodium under 2,300mg and walk daily to work on your blood pressure' },
  fasting_glucose: { title: 'Steady sugar week', description: 'No sugary drinks and a walk after meals to work on your glucose' },
  hba1c: { title: 'Steady sugar week', description: 'No sugary drinks and a walk after meals to work on your HbA1c' },
  total_cholesterol: { title: 'Fiber week', description: 'Oats, beans, and nuts every day to work on your cholesterol' },
  ldl: { title: 'Fiber week', description: 'Oats, beans, and nuts every day to work on your LDL' },
  hdl: { title: 'Move more week', description: 'Daily activity to help raise your HDL' },
  triglycerides: { title: 'Cut sugar week', description: 'Skip sugary drinks and add fatty fish to work on your triglycerides' },
  bmi: { title: 'Portion week', description: 'Portion control at dinner and daily movement to work on your BMI' },
  resting_hr: { title: 'Calm week', description: 'Daily walks and breathing exercises to work on your resting heart rate' },
  hemoglobin: { title: 'Iron week', description: 'Leafy greens and iron-rich foods to support your hemoglobin' },
  creatinine: { title: 'Hydration week', description: 'Eight glasses of water daily to support your kidney function' },
  alt: { title: 'Liver care week', description: 'Skip processed foods to work on your liver enzymes' },
  ast: { title: 'Liver care week', description: 'Skip processed foods to work on your liver enzymes' },
  vitamin_d: { title: 'Sunlight week', description: '10 minutes of sun and vitamin D foods daily' },
  tsh: { title: 'Thyroid support week', description: 'Iodine-rich foods to support your thyroid' },
};

/**
 * Generates a weekly challenge focused on the user's worst-performing metric.
 * The challenge asks the user to complete CHALLENGE_TARGET_TASKS tasks that
 * target that metric within the current week.
 */
export function generateWeeklyChallenge(worstMetric: MetricKey): WeeklyChallenge {
  const metricDef = getMetricDef(worstMetric);
  const weekStart = weekStartOf(todayISO());
  const theme = CHALLENGE_LIBRARY[worstMetric] ?? {
    title: `${metricDef.label} week`,
    description: `Complete tasks targeting ${metricDef.label} this week`,
  };

  return {
    id: `challenge_${weekStart}`,
    title: theme.title,
    description: `${theme.description}. Complete ${CHALLENGE_TARGET_TASKS} related tasks this week.`,
    focusMetric: worstMetric,
    weekStart,
    completed: false,
  };
}

/**
 * Finds the user's worst out-of-range metric from their latest health score.
 * Returns null if no scores exist or everything is already optimal.
 */
export function getWorstMetric(scores: HealthScore[]): MetricKey | null {
  if (scores.length === 0) return null;

  const latest = [...scores].sort((a, b) => b.date.localeCompare(a.date))[0];
  const outOfRange = latest.metrics.filter((m) => m.band !== 'optimal');
  if (outOfRange.length === 0) return null;

  const worst = outOfRange.reduce((min, m) => (m.score < min.score ? m : min));
  return worst.key;
}

/**
 * Counts tasks completed within the challenge week that target the focus metric.
 */
export function countRelevantTasksCompleted(
  plans: DailyPlan[],
  focusMetric: MetricKey,
  weekStart: string,
): number {
  const weekEnd = addDays(weekStart, 6);
  let count = 0;
  for (const plan of plans) {
    if (plan.date < weekStart || plan.date > weekEnd) continue;
    for (const task of plan.tasks) {
      if (task.completed && task.metricKeys.includes(focusMetric)) {
        count++;
      }
    }
  }
  return count;
}

// ─── Message Helpers ─────────────────────────────────────────────────────────

export function getStreakMessage(currentStreak: number): string {
  if (currentStreak === 0) return 'Start your streak today!';
  if (currentStreak === 1) return "Day 1. You've begun!";
  if (currentStreak < 7) return `${currentStreak} days in a row!`;
  if (currentStreak === 7) return 'A full week! 🔥';
  if (currentStreak < 30) return `${currentStreak} days in a row! Keep going!`;
  if (currentStreak === 30) return 'A full month! 🏆';
  return `${currentStreak} days! You're unstoppable!`;
}

export function getScoreDeltaMessage(current: number, previous: number | null): string {
  if (previous === null) return 'Your first score. Keep tracking!';

  const delta = current - previous;

  if (delta > 0) return `Up ${delta} since last report`;
  if (delta < 0) return `Down ${Math.abs(delta)} since last report`;
  return 'Holding steady. Consistency counts.';
}

// ─── Sync orchestrator ───────────────────────────────────────────────────────

export interface GamificationState {
  streak: Streak;
  points: Points;
  badges: Badge[];
  challenge: WeeklyChallenge | null;
  challengeProgress: number;
}

/**
 * Recomputes streak and points from plan history, evaluates badges, and rolls
 * the weekly challenge forward. Call after any change to plans, reports, or
 * scores. Persists everything and returns the fresh state.
 */
export async function syncGamification(): Promise<GamificationState> {
  const [plans, scores, reports, storedBadges, challenges] = await Promise.all([
    getPlans(),
    getScores(),
    getReports(),
    getBadges(),
    getChallenges(),
  ]);
  const today = todayISO();

  const { streak, points } = computeStreakAndPoints(plans, today);
  await saveStreak(streak);
  await savePoints(points);

  // Badges: seed the full definition list on first run, then merge new earns
  const badges: Badge[] = BADGE_DEFINITIONS.map((def) => {
    const prior = storedBadges.find((b) => b.id === def.id);
    return prior ?? { ...def, earnedAt: null };
  });
  const newlyEarned = checkBadges({
    reports,
    scores,
    plans,
    streak,
    points,
    badges,
    challenges,
  });
  for (const earned of newlyEarned) {
    const idx = badges.findIndex((b) => b.id === earned.id);
    if (idx >= 0) badges[idx] = earned;
  }
  await saveBadges(badges);

  // Weekly challenge: reuse this week's, otherwise generate from worst metric
  const weekStart = weekStartOf(today);
  let challenge = challenges.find((c) => c.weekStart === weekStart) ?? null;
  let allChallenges = challenges;
  if (!challenge) {
    const worst = getWorstMetric(scores);
    if (worst) {
      challenge = generateWeeklyChallenge(worst);
      allChallenges = [...challenges, challenge];
    }
  }

  let challengeProgress = 0;
  if (challenge) {
    challengeProgress = countRelevantTasksCompleted(plans, challenge.focusMetric, challenge.weekStart);
    const completed = challenge.completed || challengeProgress >= CHALLENGE_TARGET_TASKS;
    if (completed !== challenge.completed) {
      challenge = { ...challenge, completed };
    }
    allChallenges = allChallenges.map((c) => (c.id === challenge!.id ? challenge! : c));
  }
  await saveChallenges(allChallenges);

  return { streak, points, badges, challenge, challengeProgress };
}

/** Read the current gamification state without recomputing (initial load). */
export async function loadGamification(): Promise<GamificationState> {
  const [streak, points, badges, challenges, plans] = await Promise.all([
    getStreak(),
    getPoints(),
    getBadges(),
    getChallenges(),
    getPlans(),
  ]);
  const weekStart = weekStartOf(todayISO());
  const challenge = challenges.find((c) => c.weekStart === weekStart) ?? null;
  const challengeProgress = challenge
    ? countRelevantTasksCompleted(plans, challenge.focusMetric, challenge.weekStart)
    : 0;
  return { streak, points, badges, challenge, challengeProgress };
}
