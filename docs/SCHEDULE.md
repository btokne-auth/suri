# Suri: Schedule

All times Manila. Submission deadline: **Nov 5, 10:00 AM** (Nov 4, 9 PM ET). Target: submit the evening of Nov 4.

## Build order (do these in order)

**The rule:** don't start a step until the one before it passes its "done when" check. The riskiest part (does Muse Spark read the documents well?) comes early, so a problem shows up on Day 1, not Day 6.

**If you fall behind:** cut from the bottom. Drop Could items first, then Should items from step 9 backward. Never cut a Must. Steps 1–7 alone are a complete, submittable entry.

| # | Step | Day | Done when |
| --- | --- | --- | --- |
| 1 | **Setup:** Next.js app (done), docs + rule files in the repo, `.gitignore` covers `.env*`, `.env.example`, first commit, push to GitHub, Supabase project (Singapore), Vercel deploy (`sin1`), API key, connect Cline | Tue Oct 27 | The starter page is live on the vercel.app URL, and `git status` never shows `.env.local` |
| 2 | **Prove the AI:** one small script sends one sample birth certificate to Muse Spark and gets JSON back | Tue Oct 27 | The right fields come back, and you know how long one call takes |
| 3 | **Settings + rules:** settings format, the 3 document types, validation rules (M), schema check on model output (M) | Wed Oct 28 (morning) | A bad output (wrong shape, Feb 30, digits in a name) is rejected by code |
| 4 | **Database, storage, sessions:** tables, row-level security (M), private bucket (M), anonymous sign-in | Wed Oct 28 | Two different browsers can't see each other's rows |
| 5 | **Upload pipeline:** upload with file type/size checks (M), per-visitor limit + daily cap (M), background reading, statuses | Wed–Thu Oct 28–29 | Upload from a phone → status changes from `reading` to `needs_review` on its own |
| 6 | **Profile, checks, requirement check:** profile form, Filipino name rules, mismatch checks, cross-document checks, requirement check, readiness view (set-first), work log | Thu Oct 29 | A non-Linawan ID is stopped; a mismatched birth date is flagged. **Scope freeze tonight** |
| 7 | **Reviewer view (demo mode switch):** image beside fields, flags, approve / correct / reject with validation, review log | Fri Oct 30 | The whole Must flow works on the live URL, on phone and laptop. **Milestone: submittable entry** |
| 8 | **Proof:** sample documents + answer key, eval script, plain OCR vs Suri scorecard | Sat Oct 31 | A table of real accuracy numbers |
| 9 | **Should features:** photo quality / retake, wrong-document check, Suri asks before it flags, SAM 3.1 crop, where it came from, compare with plain OCR, receipt sample, security pass | Sun–Mon Nov 1–2 | Each tested on the live URL; eval rerun after SAM |
| 10 | **Polish:** README, logo files + favicon, scan beam, isometric SVG hero, light mode toggle; Could items only if time is left | Tue Nov 3 | README done; nothing broken. **Feature freeze tonight** |
| 11 | **Ship:** record and edit the video, secret scan, make the repo public, submit | Wed Nov 4 | Submitted, with a screenshot of the confirmation |
| — | Official deadline (buffer only) | Thu Nov 5, 10 AM | |

## Event dates (Manila)

| When | What |
| --- | --- |
| Wed Oct 28, 12 AM | Meta Engineering Workshop P1 (recorded → Discord #resources) |
| Thu Oct 29, 12 AM | Meta Engineering Workshop P2 (recorded) |
| Sat Oct 31, 12 AM | Fireworks AI workshop (recorded) |
| Weekdays, 10–11 PM (11 PM–12 AM from Nov 2) | Meta office hours on Discord |
| Nov 5, 10 AM | **Submissions close** |
| Nov 5–9 | Judging (no action needed) |
| Nov 10, 1 AM | Closing ceremony, live finals |

## Where we are now

**Day 1 (Oct 27), step 1: setup**
- [x] $150 Meta credits active; models decided (`muse-spark-1.3` for Suri and Cline)
- [x] Organizers confirmed: any coding tools are allowed; the submitted repo must be public
- [x] VS Code + Cline installed (Cline's built-in **Meta** provider: Base URL, API key, Model ID); not connected yet
- [x] Private GitHub repo created
- [x] Next.js app created and running locally with Webpack + Tailwind (PostCSS)
- [ ] Add `docs/`, `.clinerules`, `.clineignore`; check `.gitignore` covers `.env*`; add `.env.example`
- [ ] First commit under your own name; connect to GitHub and push
- [ ] Create the Meta API key (dev.meta.ai → API keys) and connect Cline
- [ ] Supabase project (Singapore); Vercel project (`sin1`); first deploy
- [ ] Check the Billing page usage every night

## Daily log

(One or two lines per day: what got done, what broke, what's next.)

- **Day 1 (Oct 27, ~1 AM):** Private repo created. Next.js 16.4.3 app created (JavaScript, Tailwind v4, App Router; the setup tool made the first local commit). Windows Application Control blocks Next's native SWC file, so Next falls back to WASM and Turbopack can't run: fixed with `--webpack` on `dev` and `build`. Tailwind was wired only through Turbopack, so added `@tailwindcss/postcss` + `postcss.config.mjs` and cleared `.next`; the styled starter page now shows on localhost:3000. Plan split into `docs/`. **Next:** add docs and rule files, first commit, push.
