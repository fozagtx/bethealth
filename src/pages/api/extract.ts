import type { APIRoute } from 'astro';
import { METRICS } from '@/lib/scoring';

export const prerender = false;

// The uploaded report is forwarded to Gemma 4 (Google AI Studio API) for
// extraction and never written to disk or logged. The user confirms every
// value client-side before saving. Gemma does not support responseSchema, so
// JSON output is enforced by prompt and parsed defensively.

const MAX_BYTES = 15 * 1024 * 1024;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Pull the first JSON object out of a model reply that may carry code fences. */
function parseModelJson(text: string): { values?: unknown; reportDate?: unknown } | null {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callGemma(apiKey: string, model: string, parts: unknown[]): Promise<Response> {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0 },
    }),
  });
}

function candidateText(body: unknown): string | null {
  const text = (body as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] })
    ?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === 'string' ? text : null;
}

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(
      { error: 'Extraction is not configured on this server (GEMINI_API_KEY is missing). Enter your values manually.' },
      503
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Invalid upload: expected a multipart form with a "file" field.' }, 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'No file received.' }, 400);
  if (file.size === 0) return json({ error: 'The uploaded file is empty.' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'File is larger than 15MB. Upload a smaller photo or PDF.' }, 413);

  const mime = file.type;
  if (mime !== 'application/pdf' && !mime.startsWith('image/')) {
    return json({ error: `Unsupported file type "${mime || 'unknown'}". Upload a PDF or a photo.` }, 415);
  }

  const data = Buffer.from(await file.arrayBuffer()).toString('base64');

  const metricList = METRICS.map((m) => `- "${m.key}": ${m.label}, value must be in ${m.unit}`).join('\n');
  const jsonShape = '{"values": [{"key": "ldl", "value": 160}], "reportDate": "2026-01-15"}';
  const prompt = [
    'This document is a medical lab report. Extract the numeric results for exactly these metrics:',
    metricList,
    '',
    'Rules:',
    '- Only include a metric if its value is clearly present in the report. Never guess or infer a value.',
    '- Convert to the unit listed above when the report uses a different one (e.g. glucose mmol/L × 18 = mg/dL, cholesterol mmol/L × 38.67 = mg/dL).',
    '- Use the exact "key" strings listed above.',
    '- If the report shows a collection or test date, include it as "reportDate" in YYYY-MM-DD format; otherwise omit that field.',
    '- If nothing matches, return an empty values array.',
    '- Privacy: never extract, repeat, or include names, patient IDs, addresses, phone numbers, or any other identity information. Only the metric values above and the report date.',
    '',
    `FORMAT: Respond with exactly one raw JSON object shaped like ${jsonShape}`,
    'Your entire response must start with "{" and end with "}". No markdown, no code fences, no plan, no explanation.',
  ].join('\n');

  const model = import.meta.env.GEMINI_MODEL ?? 'gemma-4-31b-it';

  let res: Response;
  try {
    res = await callGemma(apiKey, model, [{ inline_data: { mime_type: mime, data } }, { text: prompt }]);
  } catch {
    return json({ error: 'Could not reach the extraction service. Check your connection and try again.' }, 502);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (res.status === 400 && detail.includes('API_KEY')) {
      return json({ error: 'The extraction API key is invalid. Enter your values manually.' }, 502);
    }
    if (res.status === 429) {
      return json({ error: 'The extraction service is rate-limited right now. Wait a minute and try again.' }, 502);
    }
    return json({ error: `The extraction service returned an error (${res.status}).` }, 502);
  }

  const body = await res.json().catch(() => null);
  const text = candidateText(body);
  if (text === null) {
    const reason = (body as { candidates?: { finishReason?: string }[] })?.candidates?.[0]?.finishReason;
    return json({ error: `The extraction service returned no result${reason ? ` (${reason})` : ''}. Try a clearer photo or enter values manually.` }, 502);
  }

  let parsed = parseModelJson(text);

  // Gemma sometimes answers PDFs in prose despite the format instruction. A
  // second text-only pass converts its own notes into the required JSON shape.
  if (!parsed) {
    const repairPrompt = [
      'Below are notes from a lab-report extraction. Convert them into exactly one JSON object shaped like:',
      jsonShape,
      `Allowed keys: ${METRICS.map((m) => `"${m.key}"`).join(', ')}. Drop anything else, including all identity information.`,
      'Your entire response must start with "{" and end with "}". No markdown, no explanation.',
      '',
      'Notes:',
      text,
    ].join('\n');
    try {
      const repairRes = await callGemma(apiKey, model, [{ text: repairPrompt }]);
      if (repairRes.ok) {
        const repairText = candidateText(await repairRes.json().catch(() => null));
        if (repairText !== null) parsed = parseModelJson(repairText);
      }
    } catch {
      // fall through to the parse error below
    }
  }

  if (!parsed) {
    return json({ error: 'The extraction result could not be parsed. Try again or enter values manually.' }, 502);
  }

  const known = new Set(METRICS.map((m) => m.key));
  const values = (Array.isArray(parsed.values) ? parsed.values : [])
    .filter(
      (v): v is { key: string; value: number } =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as { key?: unknown }).key === 'string' &&
        known.has((v as { key: string }).key as (typeof METRICS)[number]['key']) &&
        typeof (v as { value?: unknown }).value === 'number' &&
        Number.isFinite((v as { value: number }).value)
    )
    .map((v) => ({ key: v.key, value: v.value }));

  const reportDate =
    typeof parsed.reportDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.reportDate)
      ? parsed.reportDate
      : undefined;

  return json({ values, reportDate });
};
