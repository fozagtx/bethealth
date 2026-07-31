import { useEffect, useMemo, useRef, useState } from 'react';
import type { MetricKey, MetricValue } from '@/types';
import { METRICS, getTargetString } from '@/lib/scoring';
import { todayISO } from '@/lib/dates';

type Step = 'choose' | 'extracting' | 'confirm';

interface Props {
  initialHeight?: number;
  initialWeight?: number;
  onSave: (date: string, metrics: MetricValue[], height?: number, weight?: number) => Promise<void>;
  onClose: () => void;
}

const MAX_FILE_MB = 15;

export default function AddReport({ initialHeight, initialWeight, onSave, onClose }: Props) {
  const [step, setStep] = useState<Step>('choose');
  const [values, setValues] = useState<Partial<Record<MetricKey, string>>>({});
  const [extractedKeys, setExtractedKeys] = useState<Set<MetricKey>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [height, setHeight] = useState(initialHeight ? String(initialHeight) : '');
  const [weight, setWeight] = useState(initialWeight ? String(initialWeight) : '');
  const [bmiTouched, setBmiTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // BMI auto-computes from height and weight until the user edits it directly
  useEffect(() => {
    if (bmiTouched) return;
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (h > 0 && w > 0) {
      const bmi = w / Math.pow(h / 100, 2);
      setValues((v) => ({ ...v, bmi: bmi.toFixed(1) }));
    }
  }, [height, weight, bmiTouched]);

  const filledCount = useMemo(
    () => METRICS.filter((m) => {
      const raw = values[m.key];
      return raw !== undefined && raw !== '' && Number.isFinite(parseFloat(raw));
    }).length,
    [values]
  );

  async function handleFile(file: File) {
    setError(null);
    const okType = file.type === 'application/pdf' || file.type.startsWith('image/');
    if (!okType) {
      setError('Unsupported file type. Upload a PDF or a photo (JPG, PNG, HEIC).');
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File is larger than ${MAX_FILE_MB}MB. Try a smaller photo or a single-page PDF.`);
      return;
    }

    setStep('extracting');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/extract', { method: 'POST', body: fd });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.error) {
        setError(data?.error ?? `Extraction failed (${res.status}). Enter your values manually below.`);
        setStep('confirm');
        return;
      }

      const known = new Set(METRICS.map((m) => m.key));
      const next: Partial<Record<MetricKey, string>> = {};
      const keys = new Set<MetricKey>();
      for (const v of data.values ?? []) {
        if (known.has(v.key) && typeof v.value === 'number' && Number.isFinite(v.value)) {
          next[v.key as MetricKey] = String(v.value);
          keys.add(v.key as MetricKey);
        }
      }
      if (keys.size === 0) {
        setError('No recognizable lab values were found in this file. Enter your values manually below.');
      }
      setValues(next);
      setExtractedKeys(keys);
      if (typeof data.reportDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.reportDate)) {
        setDate(data.reportDate);
      }
      setStep('confirm');
    } catch {
      setError('Could not reach the extraction service. Enter your values manually below.');
      setStep('confirm');
    }
  }

  async function handleSave() {
    const metrics: MetricValue[] = [];
    for (const def of METRICS) {
      const raw = values[def.key];
      if (raw === undefined || raw === '') continue;
      const num = parseFloat(raw);
      if (Number.isFinite(num)) metrics.push({ key: def.key, value: num, date });
    }
    if (metrics.length === 0) return;

    setSaving(true);
    try {
      const h = parseFloat(height);
      const w = parseFloat(weight);
      await onSave(date, metrics, h > 0 ? h : undefined, w > 0 ? w : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-ink/30 flex items-start justify-center overflow-y-auto py-10 px-4">
      <div className="bg-surface-card border border-border rounded-xl shadow-card w-full max-w-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-heading font-semibold">Add report</h3>
          <button onClick={onClose} className="text-ink-muted hover:text-ink px-2 py-1" aria-label="Close">
            ✕
          </button>
        </div>

        {step === 'choose' && (
          <div className="p-6 space-y-4">
            <button
              onClick={() => fileInput.current?.click()}
              className="w-full border-2 border-dashed border-border hover:border-accent rounded-xl py-12 text-center transition-colors"
            >
              <div className="text-3xl mb-2">◫</div>
              <p className="font-medium">Upload a PDF or photo of your lab report</p>
              <p className="text-sm text-ink-muted mt-1">
                The file is sent for extraction only and never stored. Only the tracked lab values and the report date
                come back. Names and IDs are never extracted, and you can black them out before uploading.
              </p>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {error && (
              <p className="text-sm text-band-high bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</p>
            )}
            <div className="text-center">
              <button onClick={() => setStep('confirm')} className="text-accent font-medium hover:underline">
                Or enter values manually
              </button>
            </div>
          </div>
        )}

        {step === 'extracting' && (
          <div className="p-6 py-16 text-center">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="font-medium">Reading your report…</p>
            <p className="text-sm text-ink-muted mt-1">You will confirm every value before it is saved.</p>
          </div>
        )}

        {step === 'confirm' && (
          <div className="p-6 space-y-5">
            {error ? (
              <p className="text-sm text-band-high bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</p>
            ) : extractedKeys.size > 0 ? (
              <p className="text-sm text-accent-dark bg-accent-light rounded-lg px-4 py-3">
                {extractedKeys.size} value{extractedKeys.size === 1 ? '' : 's'} extracted. Check each one against your
                report before saving. Nothing is saved until you confirm.
              </p>
            ) : (
              <p className="text-sm text-ink-muted">
                Enter the values from your report. Leave anything you don't have blank.
              </p>
            )}

            <div className="flex flex-wrap gap-4">
              <label className="text-sm">
                <span className="block text-ink-muted mb-1">Report date</span>
                <input
                  type="date"
                  value={date}
                  max={todayISO()}
                  onChange={(e) => setDate(e.target.value)}
                  className="border border-border rounded-lg px-3 py-2 bg-surface-card"
                />
              </label>
              <label className="text-sm">
                <span className="block text-ink-muted mb-1">Height (cm)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="border border-border rounded-lg px-3 py-2 w-28 bg-surface-card"
                  placeholder="e.g. 172"
                />
              </label>
              <label className="text-sm">
                <span className="block text-ink-muted mb-1">Weight (kg)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="border border-border rounded-lg px-3 py-2 w-28 bg-surface-card"
                  placeholder="e.g. 70"
                />
              </label>
            </div>

            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface text-left text-ink-muted">
                    <th className="px-4 py-2.5 font-medium">Metric</th>
                    <th className="px-4 py-2.5 font-medium">Target</th>
                    <th className="px-4 py-2.5 font-medium w-36">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map((m) => (
                    <tr key={m.key} className="border-t border-border">
                      <td className="px-4 py-2">
                        <span className="font-medium">{m.label}</span>
                        <span className="text-ink-faint ml-1.5">{m.unit}</span>
                        {extractedKeys.has(m.key) && (
                          <span className="ml-2 text-xs text-accent-dark bg-accent-light rounded-full px-2 py-0.5">
                            extracted
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-ink-muted">{getTargetString(m.key)}</td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          value={values[m.key] ?? ''}
                          onChange={(e) => {
                            if (m.key === 'bmi') setBmiTouched(true);
                            setValues((v) => ({ ...v, [m.key]: e.target.value }));
                          }}
                          className="border border-border rounded-lg px-3 py-1.5 w-28 bg-surface-card"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-ink-faint">
                {filledCount} of {METRICS.length} metrics filled. Your data stays on this device.
              </p>
              <div className="flex gap-3">
                <button onClick={onClose} className="btn-secondary py-2.5 px-5">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={filledCount === 0 || saving}
                  className="btn-primary py-2.5 px-5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving…' : 'Confirm and save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
