import { useState } from 'react';
import type { AppView } from '@/types';
import type { HealthState, HealthActions } from './useHealthState';
import ScoreRing from './ScoreRing';
import { getScoreDeltaMessage, getStreakMessage, CHALLENGE_TARGET_TASKS } from '@/lib/gamification';
import { formatDateShort } from '@/lib/dates';

interface Props {
  state: HealthState;
  actions: HealthActions;
  onAddReport: () => void;
  onGoTo: (view: AppView) => void;
}

const BAND_LABEL = { optimal: 'In range', borderline: 'Borderline', high: 'High risk' } as const;
const BAND_CHIP = {
  optimal: 'metric-chip metric-optimal',
  borderline: 'metric-chip metric-borderline',
  high: 'metric-chip metric-high',
} as const;

export default function OverviewView({ state, actions, onAddReport, onGoTo }: Props) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const { latestScore, previousScore, todayPlan, gamification } = state;

  if (!latestScore) {
    return (
      <div className="card text-center py-16">
        <div className="text-5xl mb-4 text-accent">◉</div>
        <h2 className="text-2xl font-heading font-semibold mb-2">Add your first report</h2>
        <p className="text-ink-muted mb-6 max-w-md mx-auto">
          Upload a PDF or photo of your lab report. You confirm every extracted value before anything is saved, and
          your data never leaves this device.
        </p>
        <button onClick={onAddReport} className="btn-primary">
          Upload report
        </button>
      </div>
    );
  }

  const totalWeight = latestScore.metrics.reduce((s, m) => s + m.weight, 0);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-6">
        <div className="card md:col-span-1 flex flex-col items-center justify-center">
          <ScoreRing
            score={latestScore.overall}
            deltaMessage={getScoreDeltaMessage(latestScore.overall, previousScore?.overall ?? null)}
            metricCount={latestScore.metricCount}
            totalMetrics={latestScore.totalMetrics}
          />
          <button
            onClick={() => setShowBreakdown((s) => !s)}
            className="mt-4 text-sm text-accent font-medium hover:underline"
          >
            {showBreakdown ? 'Hide breakdown' : 'Why this score?'}
          </button>
        </div>

        <div className="md:col-span-2 grid sm:grid-cols-2 gap-6">
          <div className="card">
            <p className="text-sm text-ink-muted mb-1">Streak</p>
            <p className="big-number text-accent">{gamification?.streak.currentStreak ?? 0}</p>
            <p className="text-sm text-ink-muted mt-1">
              {getStreakMessage(gamification?.streak.currentStreak ?? 0)}
            </p>
            <p className="text-xs text-ink-faint mt-2">Longest: {gamification?.streak.longestStreak ?? 0} days</p>
          </div>
          <div className="card">
            <p className="text-sm text-ink-muted mb-1">Points</p>
            <p className="big-number">{gamification?.points.total ?? 0}</p>
            <p className="text-sm text-ink-muted mt-1">{gamification?.points.weeklyTotal ?? 0} this week</p>
            <p className="text-xs text-ink-faint mt-2">10 per task, streak bonus up to 2×</p>
          </div>
          {gamification?.challenge && (
            <div className="card sm:col-span-2">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm text-ink-muted">This week's challenge</p>
                  <p className="font-heading font-semibold">{gamification.challenge.title}</p>
                  <p className="text-sm text-ink-muted mt-0.5">{gamification.challenge.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-heading font-bold">
                    {Math.min(gamification.challengeProgress, CHALLENGE_TARGET_TASKS)}
                    <span className="text-ink-faint text-base font-medium"> / {CHALLENGE_TARGET_TASKS}</span>
                  </p>
                  <p className="text-xs text-ink-faint">
                    {gamification.challenge.completed ? 'Completed' : 'tasks done'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showBreakdown && (
        <div className="card overflow-x-auto">
          <h3 className="text-lg font-heading font-semibold mb-4">Score breakdown</h3>
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-ink-muted border-b border-border">
                <th className="py-2 pr-4 font-medium">Metric</th>
                <th className="py-2 pr-4 font-medium">Value</th>
                <th className="py-2 pr-4 font-medium">Band</th>
                <th className="py-2 pr-4 font-medium">Target</th>
                <th className="py-2 font-medium text-right">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {[...latestScore.metrics].sort((a, b) => a.score - b.score).map((m) => (
                <tr key={m.key} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-4 font-medium">{m.label}</td>
                  <td className="py-2.5 pr-4">
                    {m.value} <span className="text-ink-faint">{m.unit}</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={BAND_CHIP[m.band]}>{BAND_LABEL[m.band]}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-ink-muted">{m.target}</td>
                  <td className="py-2.5 text-right tabular-nums">
                    {((m.score * m.weight) / totalWeight).toFixed(1)}
                    <span className="text-ink-faint"> / {((100 * m.weight) / totalWeight).toFixed(1)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-ink-faint mt-3">
            Scored from clinical reference ranges (AHA, ADA, NCEP, WHO). Metrics you haven't added are excluded, never
            counted against you.
          </p>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading font-semibold">Your metrics</h3>
          <span className="text-xs text-ink-faint">{formatDateShort(latestScore.date)} report</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {latestScore.metrics.map((m) => (
            <span key={m.key} className={BAND_CHIP[m.band]}>
              {m.label}: {m.value} {m.unit}
            </span>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading font-semibold">Today's tasks</h3>
          <button onClick={() => onGoTo('plan')} className="text-sm text-accent font-medium hover:underline">
            Full plan
          </button>
        </div>
        {todayPlan && todayPlan.tasks.length > 0 ? (
          <ul className="space-y-2">
            {todayPlan.tasks.slice(0, 5).map((t) => (
              <li key={t.id}>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={t.completed}
                    onChange={() => actions.toggleTask(t.id)}
                    className="w-4 h-4 accent-[#0D9488]"
                  />
                  <span className={t.completed ? 'line-through text-ink-faint' : 'group-hover:text-accent-dark'}>
                    {t.title}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-muted text-sm">
            All your tracked metrics are in range, so no corrective tasks today. Keep doing what you're doing.
          </p>
        )}
      </div>
    </div>
  );
}
