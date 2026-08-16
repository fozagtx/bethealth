/** BetaHealth — PlanView */
import type { Task } from '@/types';
import type { HealthState, HealthActions } from './useHealthState';
import { getTaskReason } from '@/lib/plan';
import { CHALLENGE_TARGET_TASKS } from '@/lib/gamification';

interface Props {
  state: HealthState;
  actions: HealthActions;
  onAddReport: () => void;
}

const TYPE_LABEL = { activity: 'Activity', diet: 'Food', habit: 'Habit' } as const;
const TYPE_ORDER: Task['type'][] = ['activity', 'diet', 'habit'];

export default function PlanView({ state, actions, onAddReport }: Props) {
  const { todayPlan, reports, gamification } = state;
  const latestReport = reports[0] ?? null;

  if (!latestReport) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-heading font-semibold">Today's plan</h2>
        <div className="card text-center py-12">
          <p className="text-ink-muted mb-4">Your plan is built from your lab results. Add a report to get one.</p>
          <button onClick={onAddReport} className="btn-primary">
            Add report
          </button>
        </div>
      </div>
    );
  }

  const tasks = todayPlan?.tasks ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-heading font-semibold">Today's plan</h2>
        {todayPlan && todayPlan.tasks.length > 0 && (
          <span className="text-sm text-ink-muted">
            {todayPlan.tasks.filter((t) => t.completed).length} of {todayPlan.tasks.length} done
          </span>
        )}
      </div>

      {gamification?.challenge && (
        <div className="card border-l-4 border-l-accent">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-heading font-semibold">{gamification.challenge.title}</p>
              <p className="text-sm text-ink-muted mt-0.5">{gamification.challenge.description}</p>
            </div>
            <p className="text-lg font-heading font-bold whitespace-nowrap">
              {Math.min(gamification.challengeProgress, CHALLENGE_TARGET_TASKS)} / {CHALLENGE_TARGET_TASKS}
              {gamification.challenge.completed && <span className="text-accent ml-2">✓</span>}
            </p>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="card text-center py-12">
          <p className="font-medium mb-1">All your tracked metrics are in range.</p>
          <p className="text-ink-muted text-sm">
            No corrective tasks today. Re-test on your usual schedule and add the new report to keep the trend honest.
          </p>
        </div>
      ) : (
        TYPE_ORDER.map((type) => {
          const group = tasks.filter((t) => t.type === type);
          if (group.length === 0) return null;
          return (
            <div key={type} className="card">
              <h3 className="text-sm font-medium text-ink-muted uppercase tracking-wide mb-4">{TYPE_LABEL[type]}</h3>
              <ul className="space-y-4">
                {group.map((t) => (
                  <li key={t.id} className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={t.completed}
                      onChange={() => actions.toggleTask(t.id)}
                      className="w-4 h-4 mt-1 accent-[#0D9488] cursor-pointer"
                      id={t.id}
                    />
                    <label htmlFor={t.id} className="cursor-pointer flex-1">
                      <span className={`font-medium ${t.completed ? 'line-through text-ink-faint' : ''}`}>
                        {t.title}
                      </span>
                      <p className="text-sm text-ink-muted mt-0.5">{t.description}</p>
                      <p className="text-xs text-accent-dark mt-1">
                        {getTaskReason(t, latestReport.metrics)}
                      </p>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}
