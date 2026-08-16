/** BetaHealth — DoctorView */
import { useMemo, useState } from 'react';
import type { MetricKey } from '@/types';
import type { HealthState, HealthActions } from './useHealthState';
import { METRICS, getBand } from '@/lib/scoring';
import { formatDate, todayISO } from '@/lib/dates';

interface Props {
  state: HealthState;
  actions: HealthActions;
}

const BAND_LABEL = { optimal: 'In range', borderline: 'Borderline', high: 'High risk' } as const;

export default function DoctorView({ state, actions }: Props) {
  const { scores, reports, plans, gamification, notes } = state;
  const [draft, setDraft] = useState(notes);

  const chronological = useMemo(() => [...scores].sort((a, b) => a.date.localeCompare(b.date)), [scores]);

  const metricRows = useMemo(() => {
    const byDate = [...reports].sort((a, b) => a.date.localeCompare(b.date));
    const rows: {
      key: MetricKey;
      label: string;
      unit: string;
      first: { value: number; date: string };
      latest: { value: number; date: string };
    }[] = [];
    for (const def of METRICS) {
      const entries = byDate.flatMap((r) => {
        const m = r.metrics.find((x) => x.key === def.key);
        return m ? [{ value: m.value, date: r.date }] : [];
      });
      if (entries.length > 0) {
        rows.push({
          key: def.key,
          label: def.label,
          unit: def.unit,
          first: entries[0],
          latest: entries[entries.length - 1],
        });
      }
    }
    return rows;
  }, [reports]);

  const taskTotals = useMemo(() => {
    const assigned = plans.reduce((s, p) => s + p.totalCount, 0);
    const completed = plans.reduce((s, p) => s + p.tasks.filter((t) => t.completed).length, 0);
    return { assigned, completed, pct: assigned === 0 ? 0 : Math.round((completed / assigned) * 100) };
  }, [plans]);

  if (reports.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-heading font-semibold">Doctor summary</h2>
        <div className="card text-center py-12">
          <p className="text-ink-muted">
            The summary is generated from your saved reports. Add your first report to create one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <h2 className="text-2xl font-heading font-semibold">Doctor summary</h2>
        <div className="flex gap-3">
          <button onClick={() => window.print()} className="btn-secondary py-2.5 px-5" title="Choose 'Save as PDF' in the print dialog">
            Download PDF
          </button>
          <button onClick={() => window.print()} className="btn-primary py-2.5 px-5">
            Print
          </button>
        </div>
      </div>

      <div className="card print:border-0 print:shadow-none print:p-0">
        <div className="border-b border-border pb-4 mb-5">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <h3 className="text-xl font-heading font-bold">BetaHealth visit summary</h3>
            <span className="text-sm text-ink-muted">Generated {formatDate(todayISO())}</span>
          </div>
          <p className="text-xs text-ink-faint italic mt-1">
            Patient-recorded data. Not medical advice. Prepared to support, never replace, clinical judgment.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-xs text-ink-muted">Current score</p>
            <p className="text-2xl font-heading font-bold">{chronological[chronological.length - 1].overall}</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Tasks completed</p>
            <p className="text-2xl font-heading font-bold">
              {taskTotals.pct}%
              <span className="text-sm font-medium text-ink-faint"> ({taskTotals.completed}/{taskTotals.assigned})</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Current streak</p>
            <p className="text-2xl font-heading font-bold">{gamification?.streak.currentStreak ?? 0} days</p>
          </div>
          <div>
            <p className="text-xs text-ink-muted">Reports on file</p>
            <p className="text-2xl font-heading font-bold">{reports.length}</p>
          </div>
        </div>

        <h4 className="font-heading font-semibold mb-2">Score history</h4>
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="text-left text-ink-muted border-b border-border">
              <th className="py-1.5 pr-4 font-medium">Date</th>
              <th className="py-1.5 pr-4 font-medium">Score</th>
              <th className="py-1.5 font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {chronological.map((s, i) => {
              const prev = i > 0 ? chronological[i - 1].overall : null;
              const delta = prev === null ? null : s.overall - prev;
              return (
                <tr key={s.date + i} className="border-b border-border last:border-0">
                  <td className="py-1.5 pr-4">{formatDate(s.date)}</td>
                  <td className="py-1.5 pr-4 tabular-nums font-medium">{s.overall}</td>
                  <td className="py-1.5 tabular-nums text-ink-muted">
                    {delta === null ? '-' : delta > 0 ? `+${delta}` : `${delta}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h4 className="font-heading font-semibold mb-2">Metric trends</h4>
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="text-left text-ink-muted border-b border-border">
              <th className="py-1.5 pr-4 font-medium">Metric</th>
              <th className="py-1.5 pr-4 font-medium">First</th>
              <th className="py-1.5 pr-4 font-medium">Latest</th>
              <th className="py-1.5 pr-4 font-medium">Trend</th>
              <th className="py-1.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {metricRows.map((r) => {
              const band = getBand(r.key, r.latest.value);
              const diff = r.latest.value - r.first.value;
              const sameDate = r.first.date === r.latest.date;
              return (
                <tr key={r.key} className="border-b border-border last:border-0">
                  <td className="py-1.5 pr-4 font-medium">
                    {r.label} <span className="text-ink-faint font-normal">{r.unit}</span>
                  </td>
                  <td className="py-1.5 pr-4 tabular-nums">
                    {r.first.value}
                    <span className="text-ink-faint text-xs"> · {formatDate(r.first.date)}</span>
                  </td>
                  <td className="py-1.5 pr-4 tabular-nums">
                    {r.latest.value}
                    <span className="text-ink-faint text-xs"> · {formatDate(r.latest.date)}</span>
                  </td>
                  <td className="py-1.5 pr-4">{sameDate ? '-' : diff > 0 ? '↑' : diff < 0 ? '↓' : '→'}</td>
                  <td className="py-1.5">{BAND_LABEL[band]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h4 className="font-heading font-semibold mb-2">Notes for the appointment</h4>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => actions.saveNotes(draft)}
          placeholder="Symptoms, questions, medication changes…"
          rows={4}
          className="w-full border border-border rounded-lg px-4 py-3 text-sm bg-surface-card print:hidden"
        />
        <p className="text-sm whitespace-pre-wrap hidden print:block min-h-[1.5rem]">
          {draft || '-'}
        </p>

        <p className="text-xs text-ink-faint italic mt-6 pt-4 border-t border-border">
          Not medical advice. Values entered or confirmed by the patient from lab reports; score derived from standard
          clinical reference ranges (AHA, ADA, NCEP, WHO). Data stored only on the patient's device.
        </p>
      </div>
    </div>
  );
}
