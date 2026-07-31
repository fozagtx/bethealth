import { useMemo, useState } from 'react';
import type { MetricKey } from '@/types';
import type { HealthState } from './useHealthState';
import { METRICS, getBand } from '@/lib/scoring';
import { formatDateShort } from '@/lib/dates';

interface Props {
  state: HealthState;
}

const BAND_DOT = { optimal: '#0D9488', borderline: '#D97706', high: '#DC2626' } as const;
const BAND_LABEL = { optimal: 'In range', borderline: 'Borderline', high: 'High risk' } as const;

function ScoreTimeline({ points }: { points: { date: string; score: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 200;
  const PAD = { l: 34, r: 18, t: 14, b: 26 };

  const coords = points.map((p, i) => ({
    x: points.length === 1 ? W / 2 : PAD.l + (i * (W - PAD.l - PAD.r)) / (points.length - 1),
    y: PAD.t + (1 - p.score / 100) * (H - PAD.t - PAD.b),
    ...p,
  }));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Health score over time">
        {[0, 50, 100].map((v) => {
          const y = PAD.t + (1 - v / 100) * (H - PAD.t - PAD.b);
          return (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="#EDECE8" strokeWidth="1" />
              <text x={PAD.l - 8} y={y + 3.5} textAnchor="end" fontSize="10" fill="#9B9B9B">
                {v}
              </text>
            </g>
          );
        })}
        {coords.length > 1 && (
          <polyline
            points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
            fill="none"
            stroke="#0D9488"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}
        {coords.map((c, i) => (
          <circle
            key={c.date + i}
            cx={c.x}
            cy={c.y}
            r={hover === i ? 6 : 4}
            fill="#0D9488"
            stroke="#FFFFFF"
            strokeWidth="2"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        {coords.length > 0 && (
          <text
            x={coords[coords.length - 1].x}
            y={coords[coords.length - 1].y - 10}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="#1A1A1A"
          >
            {coords[coords.length - 1].score}
          </text>
        )}
        {coords.length > 0 && (
          <>
            <text x={coords[0].x} y={H - 8} textAnchor="start" fontSize="10" fill="#9B9B9B">
              {formatDateShort(coords[0].date)}
            </text>
            {coords.length > 1 && (
              <text x={coords[coords.length - 1].x} y={H - 8} textAnchor="end" fontSize="10" fill="#9B9B9B">
                {formatDateShort(coords[coords.length - 1].date)}
              </text>
            )}
          </>
        )}
      </svg>
      {hover !== null && (
        <div
          className="absolute bg-ink text-white text-xs rounded-lg px-2.5 py-1.5 pointer-events-none -translate-x-1/2"
          style={{ left: `${(coords[hover].x / W) * 100}%`, top: `${(coords[hover].y / H) * 100 - 16}%` }}
        >
          {formatDateShort(coords[hover].date)} · {coords[hover].score}
        </div>
      )}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const W = 140;
  const H = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => ({
    x: values.length === 1 ? W / 2 : 4 + (i * (W - 8)) / (values.length - 1),
    y: 4 + (1 - (v - min) / span) * (H - 8),
  }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-9">
      {pts.length > 1 && (
        <polyline
          points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#0D9488"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="3.5" fill="#0D9488" />
    </svg>
  );
}

export default function ProgressView({ state }: Props) {
  const { scores, reports, plans, gamification } = state;

  const chronological = useMemo(() => [...scores].sort((a, b) => a.date.localeCompare(b.date)), [scores]);

  const metricSeries = useMemo(() => {
    const byDate = [...reports].sort((a, b) => a.date.localeCompare(b.date));
    const series: { key: MetricKey; label: string; unit: string; values: number[] }[] = [];
    for (const def of METRICS) {
      const values = byDate
        .map((r) => r.metrics.find((m) => m.key === def.key)?.value)
        .filter((v): v is number => v !== undefined);
      if (values.length > 0) series.push({ key: def.key, label: def.label, unit: def.unit, values });
    }
    return series;
  }, [reports]);

  const taskHistory = useMemo(
    () =>
      [...plans]
        .filter((p) => p.totalCount > 0)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 14),
    [plans]
  );

  if (scores.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-heading font-semibold">Progress</h2>
        <div className="card text-center py-12">
          <p className="text-ink-muted">Progress appears after your first report. Add one to start the timeline.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-heading font-semibold">Progress</h2>

      <div className="card">
        <h3 className="text-lg font-heading font-semibold mb-4">Health score over time</h3>
        <ScoreTimeline points={chronological.map((s) => ({ date: s.date, score: s.overall }))} />
        {chronological.length === 1 && (
          <p className="text-xs text-ink-faint mt-2">One report so far. The trend starts with your next re-test.</p>
        )}
      </div>

      <div className="card">
        <h3 className="text-lg font-heading font-semibold mb-4">Metric trends</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metricSeries.map((s) => {
            const latest = s.values[s.values.length - 1];
            const band = getBand(s.key, latest);
            return (
              <div key={s.key} className="border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{s.label}</p>
                  <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <span className="w-2 h-2 rounded-full" style={{ background: BAND_DOT[band] }} />
                    {BAND_LABEL[band]}
                  </span>
                </div>
                <Sparkline values={s.values} />
                <p className="text-sm mt-1">
                  <span className="font-semibold tabular-nums">{latest}</span>{' '}
                  <span className="text-ink-faint">{s.unit}</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-heading font-semibold mb-4">Task history</h3>
          {taskHistory.length === 0 ? (
            <p className="text-ink-muted text-sm">No task days yet. Complete tasks in your plan to build history.</p>
          ) : (
            <ul className="space-y-2.5">
              {taskHistory.map((p) => (
                <li key={p.date} className="flex items-center gap-3 text-sm">
                  <span className="w-16 text-ink-muted shrink-0">{formatDateShort(p.date)}</span>
                  <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden border border-border">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{ width: `${(p.tasks.filter((t) => t.completed).length / p.totalCount) * 100}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-ink-muted w-10 text-right">
                    {p.tasks.filter((t) => t.completed).length}/{p.totalCount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-heading font-semibold mb-4">Badges</h3>
          <ul className="space-y-3">
            {(gamification?.badges ?? []).map((b) => (
              <li
                key={b.id}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                  b.earnedAt ? 'border-accent bg-accent-light/40' : 'border-border opacity-60'
                }`}
              >
                <span className="text-2xl">{b.icon}</span>
                <div className="flex-1">
                  <p className="font-medium text-sm">{b.label}</p>
                  <p className="text-xs text-ink-muted">{b.description}</p>
                </div>
                <span className="text-xs text-ink-faint whitespace-nowrap">
                  {b.earnedAt ? formatDateShort(b.earnedAt.slice(0, 10)) : 'Not yet'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
