interface Props {
  score: number;
  deltaMessage: string;
  metricCount: number;
  totalMetrics: number;
}

const R = 64;
const CIRC = 2 * Math.PI * R;

export default function ScoreRing({ score, deltaMessage, metricCount, totalMetrics }: Props) {
  const filled = CIRC * (score / 100);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-44 h-44">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90">
          <circle cx="80" cy="80" r={R} fill="none" stroke="#EDECE8" strokeWidth="10" />
          <circle
            cx="80"
            cy="80"
            r={R}
            fill="none"
            stroke="#0D9488"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${CIRC - filled}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="big-number leading-none">{score}</span>
          <span className="text-xs text-ink-faint mt-1">of 100</span>
        </div>
      </div>
      <p className="text-sm font-medium text-ink">{deltaMessage}</p>
      <p className="text-xs text-ink-faint">Based on {metricCount} of {totalMetrics} metrics</p>
    </div>
  );
}
