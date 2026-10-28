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
| 7b | **Receipt check process (settings only):** receipt document + process settings prove the engine is process-agnostic | Fri Oct 30 | Linawan flow still passes; receipt process lists on /start with its own unlock rule |
| 8 | **Proof:** sample documents + answer key, eval script, plain OCR vs Suri scorecard | Sat Oct 31 | A table of real accuracy numbers |
| 9 | **Should features:** photo quality / retake, wrong-document check, Suri asks before it flags, SAM 3.1 crop, where it came from, compare with plain OCR, security pass | Sun–Mon Nov 1–2 | Each tested on the live URL; eval rerun after SAM |
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

**Day 2 (Oct 28, morning), step 7: reviewer view**
- [x] Step 5 upload pipeline done (profile, submissions, upload + magic-byte checks + limits, background reading reading to needs_review on its own, owner-only image URL; phone proof passed; dev-only test page 404s in production)
- [x] $150 Meta credits active; models decided (`muse-spark-1.3` for Suri and Cline)
- [x] Organizers confirmed: any coding tools are allowed; the submitted repo must be public
- [x] VS Code + Cline installed (Cline's built-in **Meta** provider: Base URL, API key, Model ID); Meta API key created and Cline connected
- [x] Private GitHub repo created
- [x] Next.js app created and running locally with Webpack + Tailwind (PostCSS)
- [x] Added `docs/`, `.clinerules`, `.clineignore`; checked `.gitignore` covers `.env*`; added `.env.example`
- [x] First commit under your own name; connected to GitHub and pushed
- [x] Meta API key created and Cline connected
- [x] Supabase project created (Singapore, automatic RLS on, auto-expose new tables off, new publishable/secret keys)
- [x] Vercel project created (function region sin1), live at https://suri-ph.vercel.app
- [x] Step 2 "Prove the AI" done
- [x] Step 3 settings + rules done (3 doc types, process file, Zod validation, 7/7 tests pass)
- [x] Step 4 database, storage, sessions done (9 tables, SELECT-only RLS + grants, private uploads bucket 10 MB, anonymous sign-in; isolation passed locally both directions, live /api/session OK + /api/test-seed 404)
- [x] Step 5 upload pipeline done (file checks, limits, background reading, statuses); phone proof passed locally
- [x] Step 6 done (names.js, run-checks + requirement gate, /start /profile /set pages + set API; 24/24 tests green, build passes; done-when passed on localhost in private windows)
- [x] Step 7 code live (registry + /api/processes, generic gates, reviewer view + approve/reject/correct with Zod + re-run, override with note, read_ok wording; 41/41 tests green, lint 0 errors, build passes; laptop live proof: Test A 8 match + correction refused on top banner; Test B Maburol fail banner + read_ok + lock + override unlock + note logged)
- [x] Phone layout fix coded (viewport, one column below 768px with work log under documents, 16px text / 44px targets, compared-against labels from settings, reading note hides when nothing is reading; 48/48 tests, lint 0 errors, build passes)
- [x] Phone layout leftovers coded (reviewer image full-width on top under 768px via mobile-first CSS; every check renders "result — same as X" from compared_document_id in both checklist + reviewer; 50/50 tests, lint 0 errors, build passes)
- [x] Robustness + profile date fix coded: stuck "reading" over 2 min flips to "error" with "Reading took too long. Please upload again." on GET /api/submissions/[id] (no cron, re-upload works as newest wins); background read wrapped so any error sets "error"; /profile birth date is native date input with label, min 1900-01-01, max today after open, YYYY-MM-DD, same server validation, no blocking handlers; date input max-width 100% at 360px; 57/57 tests, lint 0 errors, build passes
- [ ] Next: commit + push, then live 360px phone check of the Must flow, then step 7b receipt process
- [ ] Check the Billing page usage every night

## Daily log

(One or two lines per day: what got done, what broke, what's next.)

- **Day 1 (Oct 27, ~1 AM):** Private repo created. Next.js 16.4.3 app created (JavaScript, Tailwind v4, App Router; the setup tool made the first local commit). Windows Application Control blocks Next's native SWC file, so Next falls back to WASM and Turbopack can't run: fixed with `--webpack` on `dev` and `build`. Tailwind was wired only through Turbopack, so added `@tailwindcss/postcss` + `postcss.config.mjs` and cleared `.next`; the styled starter page now shows on localhost:3000. Plan split into `docs/`. **Next:** add docs and rule files, first commit, push.
- **Day 1 (Oct 27, morning):** Morning: API key + Cline (muse-spark-1.3, auto-approve Read only). Supabase + Vercel set up, live at suri-ph.vercel.app. Step 2 passed: scripts/read-test.mjs read a synthetic SAMPLE birth certificate 8/8 fields correct, both a clean image (4.1 s, ~2.6k tokens) and a tilted, glare-y phone photo of the screen (3.8 s, ~5.4k tokens). Note: the model said 'high' confidence on every field; check calibration on harder samples in the step 8 eval.
- **Day 1 (Oct 27):** Baseten granted ($100). read-test.mjs now supports READER_PROVIDER=meta|baseten. Muse Spark Open (Baseten): clean image correct (10.2 s, ~3.6k tokens); messy phone photo 0/8, every field 'unreadable' (21.9 s, ~8.1k tokens). It saw the image (4.5k prompt tokens) but couldn't read the rotated/glare photo, and didn't invent values. Muse Spark 1.3 stays the main reader. Idea for step 9: test whether SAM 3.1 crop/straighten lets Muse Spark Open read messy photos (scorecard + open-weights prize).
- **Day 1 (Oct 27, Noon):** Step 3 done: 3 doc-type settings + Linawan process file (data only, flat address_city_municipality), Zod validation (validateExtraction returns ok/fields/issues, bad values flagged never fixed), tests 7/7 pass. **Next:** step 4 database/storage/sessions.
- **Day 1 (Oct 27, Noon part 2):** Step 4 local isolation passed (Brave/Opera/Edge): each browser sees its own row only, cross-read 0 rows both ways, browser INSERT blocked. Fix: auto-expose off left service_role with no table privileges, granted in SQL editor, saved as 0002_grant_service_role.sql. Test helpers (/api/test-seed, /test-isolation) are dev-only (404 in production). Live check passed: /api/session returns {"user_id":null}, POST /api/test-seed returns 404 Not found. Step 4 done. **Next:** step 5 upload pipeline.
- **Day 1 (Oct 27, evening part 2):** Step 6 code done locally: Filipino name rule (Ma.=Maria, Sto./Sta., Jr./Sr./II/III, dela Cruz variants), run-checks + Linawan requirement gate (unreadable=retake, never fail), /start /profile /set checklist + work log, upload unlock after valid_id passes; 24/24 tests green, build passes. Added cross-refresh so each finished read re-checks the other docs. **Next:** live proof on phone + laptop, then commit + step 7.
- **Day 2 (Oct 28, morning):** Step 6 done-when passed on localhost in private windows. Test A: valid ID + birth certificate (both SAMPLE, 2007) both 'ready', 8 match / 0 mismatch, 1 older upload ignored. Test B: other-town ID (Maburol) -> 'This program is for Linawan residents.', other slots stay locked. Test C: old 2019 birth certificate -> 'Birth date is different: 2019-03-14 vs 2007-03-14' on both rows. Note for step 7: when the requirement fails, the valid ID row still says 'ready — Looks ready'; reword to something like 'Read OK — address is outside Linawan'. Modal credits ($100) also granted, kept in reserve. **Next:** step 7 reviewer view.
- **Day 2 (Oct 28):** Phone layout fix coded (layout only, no colors): viewport in root layout; /set, /start, /profile one column below 768px, two columns at 768px+; body 16px, buttons/file inputs 44px+, no sideways scroll at 360px; check reasons say what they compared against from settings labels; reading note hides once nothing is reading. 48/48 tests green, lint 0 errors, build passes. **Next:** commit + push, then live 360px phone check.
- **Day 2 (Oct 28):** Phone layout leftovers coded: reviewer image is full-width on top under 768px (mobile-first CSS, side by side at 768px+); every check renders "result — same as X. reason" in both the applicant checklist and reviewer view, label resolved from compared_document_id via settings (null = profile), no hard-coded names, old baked-in suffixes stripped. 50/50 tests green, lint 0 errors, build passes. **Next:** commit + push, live 360px phone check.
- **Day 2 (Oct 28):** Robustness + profile date fix coded: stuck "reading" over 2 min flips to "error" with "Reading took too long. Please upload again." on checklist load (no cron, re-upload works); background read always ends in "error" on failure; /profile birth date is native date input with label, min 1900-01-01, max today, YYYY-MM-DD, same server check. 57/57 tests, lint 0 errors, build passes. **Next:** commit + push, live 360px phone check.
