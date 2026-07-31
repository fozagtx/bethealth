import { openDB, type IDBPDatabase } from 'idb';
import type { UserState, Report, HealthScore, DailyPlan, Streak, Points, Badge, WeeklyChallenge } from '@/types';

const DB_NAME = 'betahealth';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('state')) {
          db.createObjectStore('state', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

async function getItem<T>(key: string): Promise<T | null> {
  const db = await getDB();
  const result = await db.get('state', key);
  return result?.value ?? null;
}

async function setItem<T>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put('state', { key, value });
}

// Reports
export async function getReports(): Promise<Report[]> {
  return (await getItem<Report[]>('reports')) ?? [];
}

export async function saveReport(report: Report): Promise<void> {
  const reports = await getReports();
  reports.push(report);
  await setItem('reports', reports);
}

export async function deleteReport(id: string): Promise<void> {
  const reports = (await getReports()).filter((r) => r.id !== id);
  await setItem('reports', reports);
}

// Scores
export async function getScores(): Promise<HealthScore[]> {
  return (await getItem<HealthScore[]>('scores')) ?? [];
}

export async function saveScore(score: HealthScore): Promise<void> {
  const scores = await getScores();
  scores.push(score);
  await setItem('scores', scores);
}

/** Replace all scores, used when scores are re-derived from reports. */
export async function setScores(scores: HealthScore[]): Promise<void> {
  await setItem('scores', scores);
}

// Plans
export async function getPlans(): Promise<DailyPlan[]> {
  return (await getItem<DailyPlan[]>('plans')) ?? [];
}

export async function savePlan(plan: DailyPlan): Promise<void> {
  const plans = await getPlans();
  const idx = plans.findIndex((p) => p.date === plan.date);
  if (idx >= 0) plans[idx] = plan;
  else plans.push(plan);
  await setItem('plans', plans);
}

/** Replace all plans, used when a report change invalidates today's plan. */
export async function setPlans(plans: DailyPlan[]): Promise<void> {
  await setItem('plans', plans);
}

// Streak
export async function getStreak(): Promise<Streak> {
  return (await getItem<Streak>('streak')) ?? { currentStreak: 0, longestStreak: 0, lastCompletedDate: null };
}

export async function saveStreak(streak: Streak): Promise<void> {
  await setItem('streak', streak);
}

// Points
export async function getPoints(): Promise<Points> {
  return (await getItem<Points>('points')) ?? { total: 0, weeklyTotal: 0, weekStart: new Date().toISOString().split('T')[0] };
}

export async function savePoints(points: Points): Promise<void> {
  await setItem('points', points);
}

// Badges
export async function getBadges(): Promise<Badge[]> {
  return (await getItem<Badge[]>('badges')) ?? [];
}

export async function saveBadges(badges: Badge[]): Promise<void> {
  await setItem('badges', badges);
}

// Challenges
export async function getChallenges(): Promise<WeeklyChallenge[]> {
  return (await getItem<WeeklyChallenge[]>('challenges')) ?? [];
}

export async function saveChallenges(challenges: WeeklyChallenge[]): Promise<void> {
  await setItem('challenges', challenges);
}

// User profile
export async function getHeight(): Promise<number | undefined> {
  return await getItem<number>('height') ?? undefined;
}

export async function saveHeight(h: number): Promise<void> {
  await setItem('height', h);
}

export async function getWeight(): Promise<number | undefined> {
  return await getItem<number>('weight') ?? undefined;
}

export async function saveWeight(w: number): Promise<void> {
  await setItem('weight', w);
}

// Doctor summary notes
export async function getNotes(): Promise<string> {
  return (await getItem<string>('notes')) ?? '';
}

export async function saveNotes(notes: string): Promise<void> {
  await setItem('notes', notes);
}

// Full state export (for doctor summary)
export async function getFullState(): Promise<UserState> {
  return {
    reports: await getReports(),
    scores: await getScores(),
    plans: await getPlans(),
    streak: await getStreak(),
    points: await getPoints(),
    badges: await getBadges(),
    challenges: await getChallenges(),
    height: await getHeight(),
    weight: await getWeight(),
  };
}
