# BetaHealth

Built for **CS Girlies Annual Hackathon — Technology For Wellness** (Devpost). Main track: **Health**. Bonus: **Best Use of AI**.

Most people come home with lab reports, glance at them once, and file them away forever. The data never becomes action, and by the next appointment nobody remembers what changed. BetaHealth turns a discarded report into a score, a plan, and a progress log you bring back to your doctor.

AI: **Gemma 4 (`gemma-4-31b-it`) via Google AI Studio**. Extraction only; scoring and plans are deterministic code.

Posture: prepare for your doctor, never replace your doctor. A visible "not medical advice" line lives in the app shell and on the doctor summary.

## Locked decisions

| Decision | Choice |
|----------|--------|
| Report input | Upload PDF/photo, AI extracts values, user confirms every value before save (editable confirm table doubles as manual entry) |
| Data | IndexedDB in the browser, no accounts. Only the report file is sent to Google AI Studio for extraction, and is not stored |
| Gamification | All four layers: streaks + score delta, points/XP, badges, weekly challenges (shipped in that order) |
| UI | Clinical calm: warm off-white, ink text, one green/teal accent, big quiet numbers, light mode default |
| Stack | Astro + React islands + Tailwind; Gemma 4 via Google AI Studio on an Astro server endpoint for extraction only |

## Core loop

1. Drop in a report (PDF or photo)
2. Confirm the extracted numbers in an editable table
3. Get a Health Score computed from clinical reference ranges, with a per-metric breakdown showing why
4. Get a plan: daily tasks and foods, each tied to a specific out-of-range metric
5. Check off tasks, keep the streak, earn points
6. Re-test, drop in the new report, watch the score move
7. Export a one-page doctor summary: score history, metric trends, tasks completed

## Health Score (deterministic, never LLM-invented)

- ~15 metrics: systolic/diastolic BP, fasting glucose, HbA1c, total cholesterol, LDL, HDL, triglycerides, BMI (from height/weight), resting heart rate, hemoglobin, creatinine, ALT, AST, vitamin D, TSH.
- Each metric maps to 0-100 via piecewise bands (optimal / borderline / high risk) from standard clinical reference ranges (AHA blood pressure, ADA glucose/HbA1c, NCEP lipids, WHO BMI). Ranges live in code, in one `scoring.ts` policy file.
- Overall score = weighted average of metrics the user actually has. Missing metrics are excluded, never counted against them. UI states "based on 8 of 15 metrics".
- The breakdown screen shows each metric's value, band, target, and contribution. That is the "why".
- The LLM's only jobs: extract values from the uploaded report, and write plain-language explanations. It never sets the score.

## Plan engine

- Rules-based task/food library keyed to out-of-range metrics. Examples: high LDL -> oats/beans/nuts tasks and 30-minute walks; high BP -> sodium cap and walks; high glucose -> cut sugary drinks, walk after meals.
- Every task and food shows its reason: "Your LDL is 160, target under 100."
- Task-to-metric mapping is deterministic. LLM may rephrase, never invent recommendations.

## Gamification (real events only, no junk trophies)

1. **Streaks + score delta** (core): daily task streak, "up 6 since May" on the dashboard.
2. **Points/XP**: 10 points per completed task, small streak multiplier, weekly total.
3. **Badges**: tied to real health events only. First report added, 7-day streak, 30-day streak, a metric back in range, score up 10.
4. **Weekly challenges**: rotating focus generated from the user's worst metric ("Sodium week"). Ships last.

## Doctor summary

One printable page (print CSS, browser PDF): metric table with dates and trends, score history, tasks completed percentage, current streak, free-text notes for the appointment. Disclaimer line. Print and download buttons.

## Screens

1. **Landing** (marketing): light, hero-only atmosphere, plain PAS copy, How it works, FAQ, primary CTA "Get started" straight into the app (no auth). No waitlist, no fake social proof, no em dashes.
2. **App shell**: view switcher (Overview / Reports / Plan / Progress / Doctor summary), not scroll navigation. Full-height shell, main area scrolls.
3. **Add report**: upload -> extracting state -> editable confirm table -> save.
4. **Overview**: score ring with delta, metric chips with band arrows, today's tasks, streak.
5. **Plan**: full task list and foods with reasons.
6. **Progress**: score timeline, per-metric sparklines, task history, badges.
7. **Doctor summary**: preview plus print.

## Honesty rules (non-negotiable)

- No demo data anywhere. Before the first report, the dashboard is an honest empty state: "Add your first report."
- Extraction is always confirmed by the user before saving. Extraction failure shows the specific reason, never silently guesses.
- Score only ever computed from saved, user-confirmed values.
- Empty gamification is empty: no streak until day one is real.
- "Saved reports stay in your browser" stated in the UI, and it must be true (IndexedDB). The report file may be sent once to Google AI Studio for extraction and is not retained.

## Design system

- Warm off-white background, near-black ink, one green/teal accent. Amber/red reserved for metric bands only.
- Headings: Sora. Body: Plus Jakarta Sans.
- Big quiet numbers, generous spacing, real card borders, subtle hover lift. No axis-tilt chart gimmicks.
- Light mode default.

## Build order

1. Scaffold: Astro + React + Tailwind, design tokens, app shell with view switcher
2. Score engine (`scoring.ts`) + confirm table + Overview (app works fully manual before AI is wired)
3. Extraction endpoint (Gemma 4 via Google AI Studio API, `GEMINI_API_KEY` in env; server stores nothing)
4. Plan engine + tasks + streaks + points
5. Progress view + badges
6. Doctor summary export
7. Landing page
8. Weekly challenges

Secrets in env only. Scoring ranges and plan rules in code. No AI trailers in commits.
