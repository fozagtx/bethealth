import type { HealthState, HealthActions } from './useHealthState';
import { computeHealthScore } from '@/lib/scoring';
import { formatDate } from '@/lib/dates';

interface Props {
  state: HealthState;
  actions: HealthActions;
  onAddReport: () => void;
}

export default function ReportsView({ state, actions, onAddReport }: Props) {
  const { reports } = state;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-semibold">Reports</h2>
        <button onClick={onAddReport} className="btn-primary py-2.5 px-5">
          Add report
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-ink-muted">No reports yet. Upload your first lab report to begin tracking.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const score = computeHealthScore(r.metrics, r.date);
            return (
              <div key={r.id} className="card flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-heading font-semibold">{formatDate(r.date)}</p>
                  <p className="text-sm text-ink-muted mt-0.5">
                    {r.metrics.length} metric{r.metrics.length === 1 ? '' : 's'} · score {score.overall}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm('Delete this report? Scores and plans will be recomputed without it.')) {
                      actions.deleteReport(r.id);
                    }
                  }}
                  className="text-sm text-ink-faint hover:text-band-high transition-colors"
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
