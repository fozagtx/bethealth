// Metric types
export type MetricKey =
  | 'systolic_bp'
  | 'diastolic_bp'
  | 'fasting_glucose'
  | 'hba1c'
  | 'total_cholesterol'
  | 'ldl'
  | 'hdl'
  | 'triglycerides'
  | 'bmi'
  | 'resting_hr'
  | 'hemoglobin'
  | 'creatinine'
  | 'alt'
  | 'ast'
  | 'vitamin_d'
  | 'tsh';

export type Band = 'optimal' | 'borderline' | 'high';

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  unit: string;
  // Piecewise bands: [threshold, band] sorted ascending
  // For metrics where high is bad
  bands: { max: number; band: Band }[];
  // For metrics where low is bad (invert)
  invert?: boolean;
  weight: number;
}

export interface MetricValue {
  key: MetricKey;
  value: number;
  date: string; // ISO date
}

export interface MetricScore {
  key: MetricKey;
  label: string;
  value: number;
  unit: string;
  score: number; // 0-100
  band: Band;
  target: string;
  weight: number;
}

export interface Report {
  id: string;
  date: string;
  metrics: MetricValue[];
  createdAt: string;
}

export interface HealthScore {
  overall: number;
  metrics: MetricScore[];
  metricCount: number;
  totalMetrics: number;
  date: string;
}

// Plan types
export interface Task {
  id: string;
  title: string;
  description: string;
  metricKeys: MetricKey[];
  type: 'activity' | 'diet' | 'habit';
  completed: boolean;
  date: string;
}

export interface DailyPlan {
  date: string;
  tasks: Task[];
  completedCount: number;
  totalCount: number;
}

// Gamification types
export interface Streak {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
}

export interface Points {
  total: number;
  weeklyTotal: number;
  weekStart: string;
}

export interface Badge {
  id: string;
  label: string;
  description: string;
  earnedAt: string | null;
  icon: string;
}

export interface WeeklyChallenge {
  id: string;
  title: string;
  description: string;
  focusMetric: MetricKey;
  weekStart: string;
  completed: boolean;
}

// User state
export interface UserState {
  reports: Report[];
  scores: HealthScore[];
  plans: DailyPlan[];
  streak: Streak;
  points: Points;
  badges: Badge[];
  challenges: WeeklyChallenge[];
  height?: number; // cm
  weight?: number; // kg
}

// View types
export type AppView = 'overview' | 'reports' | 'plan' | 'progress' | 'doctor';
