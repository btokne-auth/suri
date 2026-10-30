# Suri: Stack and decisions

## Stack

| Part | Choice | Why |
| --- | --- | --- |
| Type of app | Responsive web app (any phone or laptop browser); installable PWA only as the very last Could item | No app store, one codebase, one link for judges |
| App | Next.js 16 (App Router, JavaScript) on Vercel (free Hobby plan) | Familiar; free hosting |
| Bundler | **Webpack**: `next dev --webpack` and `next build --webpack` in `package.json` | Windows Application Control on the dev laptop blocks Next's native SWC binary, so Next falls back to WASM and Turbopack can't run. **Never remove `--webpack`** |
| Styling | Tailwind CSS v4 through `@tailwindcss/postcss` + `postcss.config.mjs` | Tailwind's Turbopack loader in `next.config.mjs` is unused under Webpack; PostCSS is what applies it |
| Vercel function region | Singapore (`sin1`) | Same region as the database |
| Database + file storage | Supabase, project in Singapore | Postgres + private storage + row-level security |
| Visitor sessions | Supabase anonymous sign-in (no passwords, no OTP) | Each visitor only sees their own data; enable it in Supabase Auth settings |
| Who reviews | **Demo mode:** a header switch flips the same visitor between **Applicant** and **Reviewer** view, on their own submission only | No accounts or roles; `reviewer_id` is the visitor's own `user_id`. Real offices would add reviewer accounts later |
| AI: reading + checking | **Muse Spark 1.3** (`muse-spark-1.3`) through the Meta Model API (OpenAI-compatible, base URL `https://api.meta.ai/v1`, key in `META_API_KEY`) | Image + PDF input, structured output, tool calling. Standard mode only |
| AI: cropping | SAM 3.1 through the Meta Model API | Second Meta model with a real job (Should) |
| AI: backup reader | **Muse Spark Open** (`meta-models/muse-spark-open-1026`) through Baseten (OpenAI-compatible, base URL `https://inference.baseten.co/v1`, key in `BASETEN_API_KEY`) | Backup reader and the 3-way scorecard; $100 credits granted |
| Other Meta models | Not used: Muse Wonder (preview, costs more), Muse Image, Muse Voice Transcribe, Muse Glimmer, Muse Code | Only add one if it does a real job |
| Output checking | Zod (schema library) | Rejects any model output that doesn't fit |
| Plain OCR baseline | Tesseract.js: in the eval script, and in the browser for the reviewer's "Compare with plain OCR" view | Runs in the browser, so no server time limits |
| Address | Free `*.vercel.app` URL | No custom domain |
| Email | None | Not needed |
| Code | GitHub repo, **private during the build, public at submission** (after the secret scan) | Hackathon rule: submitted repo must be public |
| Coding helper | VS Code + Cline using `muse-spark-1.3` (organizers confirmed any coding tools are allowed) | Paid by the hackathon credits |

## Reader provider

- Env `READER_PROVIDER` = `meta` (default) or `baseten`; same request code for both (OpenAI-compatible).

## Model rules

- Always `muse-spark-1.3`. **Never the `-contributor` IDs for Suri** (content is used to improve Meta's products).
- While running on the hackathon's free credits, Meta notes that content **may be used for product improvement**. So everything sent to the API, by Suri and by Cline, must be safe to share: synthetic SAMPLE documents only, never real personal data, never keys.

## Why no separate OCR server

Plain OCR on a serverless function runs out of time because the image work happens inside the function. With Suri the heavy work happens on **Meta's servers**; the function only sends the image and waits. Plus:
- Reading runs in the background (Next.js `after()`), so the upload never waits on it; `maxDuration = 60`.
- Low reasoning effort and resized images keep each call fast.
- Only revisit if single calls regularly take more than ~40 seconds.

## Credits and budget

- **$150 Meta Model API credits** (active). The Billing page's Spend Limit is a **notification, not a hard cap**: spending past the credits is charged to the card.
- Check usage on the Billing page **every night**. Stop at about **$110 used**. Keep **at least $40** untouched for Suri itself and the demo. Cline runs on Baseten Muse Spark Open (meta-models/muse-spark-open-1026) from Oct 30; Meta credits reserved for Suri, keep at least $40 at submission.
- **$100 Baseten credits granted** for the Muse Spark Open backup reader and the 3-way scorecard. Other partner credits (Modal, Fireworks) were requested but are **not guaranteed**. Never plan a step around them.
- Step 9 work happens on branch step-9 and is merged to main by pull request after testing on the Vercel preview.
- Price reference (`muse-spark-1.3`): $1.25 input / $0.15 cached input / $4.25 output per million tokens.

## Accounts

| Account | Used for | Status |
| --- | --- | --- |
| GitHub | Repo | Repo created (private) |
| Meta Model API (dev.meta.ai) | API key, credits | Credits active; API key not created yet |
| Supabase | Database + storage | New project needed (Singapore) |
| Vercel | Hosting | New project needed (region `sin1`) |
| VS Code + Cline | Coding helper | Installed; connect with the API key |

## Secrets

| Secret | Where it lives | Rule |
| --- | --- | --- |
| Meta Model API key | `.env.local` + Vercel env vars | Server only; never `NEXT_PUBLIC_` |
| Supabase secret key (SUPABASE_SECRET_KEY) | `.env.local` + Vercel env vars | Server only; bypasses row-level security |
| RATE_LIMIT_SALT | `.env.local` + Vercel Production + Preview | Server only; never `NEXT_PUBLIC_`; value never in code / logs — used to hash IPs for rate limits |
| Cron secret (CRON_SECRET) | `.env.local` + Vercel Production + Preview | Server only; never `NEXT_PUBLIC_`; Vercel sends as `Authorization: Bearer <CRON_SECRET>` for cron; crons only run on production |
| Supabase URL + publishable key (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) | `.env.local` + Vercel env vars | May use `NEXT_PUBLIC_`; designed to be public, row-level security protects the data |

- `.env*` is in `.gitignore`; `.env.local` must never appear in `git status`.
- `.env.example` lists variable **names** only, with empty values.
- Files that read server secrets start with `import 'server-only'`.
- `.clineignore` blocks `.env*` so the coding helper never reads keys.
- Never paste a key into code, comments, docs, screenshots, the video, or any AI chat.
- Before going public: scan the whole git history for secrets (for example with gitleaks).
- If a key leaks: revoke it in the provider's dashboard and make a new one right away; deleting the commit is not enough.
