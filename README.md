# BetaHealth

People come home with lab reports, glance at them once, and throw them away. The data never becomes action, and by the next appointment nobody remembers what changed. BetaHealth turns a discarded report into a score, a plan, and a progress log you bring back to your doctor.

**Live demo:** https://bethealth.vercel.app
**Sample report to try:** https://bethealth.vercel.app/sample-report.pdf (synthetic, generated for demos)

Not medical advice. BetaHealth prepares you for your doctor, it never replaces your doctor.

## How it works

1. Drop in a lab report (PDF or photo)
2. Gemma 4 extracts the values; you confirm every number in an editable table before anything is saved
3. Get a Health Score computed from clinical reference ranges (AHA, ADA, NCEP, WHO), with a per-metric breakdown
4. Get a daily plan: tasks and foods, each tied to a specific out-of-range metric with its reason shown
5. Check off tasks, keep the streak, earn points and badges
6. Re-test, add the new report, watch the score move
7. Export a one-page doctor summary: metric trends, score history, tasks completed, notes

## Where Gemma 4 sits

Gemma 4 (`gemma-4-31b-it`, Google AI Studio API) does exactly one job: reading the uploaded report with its vision capability and returning structured values. Everything else is deterministic code.

- The report file goes to a stateless endpoint (`src/pages/api/extract.ts`), is forwarded to Gemma, and is never stored or logged
- Gemma does not support constrained JSON output, so the endpoint enforces the shape by prompt and, when Gemma answers PDFs in prose, runs a second Gemma pass that converts its own notes into the required JSON
- Responses are filtered to 16 known metric keys, so names, patient IDs, and other identity data can never come back. The prompt also forbids extracting them
- The Health Score is never LLM-generated. Scoring bands and weights live in one policy file, `src/lib/scoring.ts`
- Extraction failures show their specific reason and fall back to manual entry, which uses the same confirm table

## Privacy

- Local-first: all health data lives in IndexedDB on the device. No accounts, no tracking
- Only the tracked lab values and the report date come back from extraction
- Users can redact names and IDs before uploading; extraction only needs the numbers
- Streaks and points are always recomputed from saved history, so they cannot drift or be gamed

## Stack

Astro 5 + React islands + Tailwind, IndexedDB (`idb`), Gemma 4 via the Google AI Studio API, deployed on Vercel.

## Run locally

```bash
npm install
echo "GEMINI_API_KEY=your_google_ai_studio_key" > .env
npm run dev
```

The app runs fully without the key; extraction reports itself unconfigured and manual entry takes over.

## License

Apache 2.0. See [LICENSE](LICENSE).
