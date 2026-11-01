# Suri: Schedule

All times Manila. Submission deadline: **Thu Nov 5, 10:00 AM** (Wed Nov 4, 9 PM ET; US clocks left daylight time on Nov 1, so Manila is 13 hours ahead). Target: submit on Nov 4, a day early.

## Build order (do these in order)

**The rule:** don't start a step until the one before it passes its "done when" check. The riskiest part (does Muse Spark read the documents well?) comes early, so a problem shows up on Day 1, not Day 6.

**If you fall behind:** cut SAM 3.1 crop and tap-to-highlight first, then Could items, then Should items from step 9 backward. Never cut a Must. Steps 1–7 alone are a complete, submittable entry.

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
| 7c | **Set up a check:** plain words become a confirmed process | Thu–Fri Oct 29–30 | Done when: an office description (e.g. barangay clearance: valid ID + proof of billing, names match, address in Barangay Baybayin, bill within 3 months) becomes a confirmed process, and uploads are read and checked on the live URL |
| 8 | **Proof:** sample documents + answer key, eval script, plain OCR vs Suri scorecard | Sat Oct 31 | A table of real accuracy numbers |
| 9 | **Should features:** photo quality / retake, wrong-document check, Suri asks before it flags, SAM 3.1 crop, where it came from, compare with plain OCR, security pass | Sun–Mon Nov 1–2 | Each tested on the live URL; eval rerun after SAM |
| 10 | **Design + polish (see DESIGN.md):** 10a landing, 10b checklist, 10c reviewer, 10d start/profile/setup, favicon, landing hero story, /start + /setup polish. Light mode toggle and isometric hero dropped (out of scope) | Oct 31 – Nov 1 | Done Nov 1 (PRs #14–#17) |
| 10e | **Outside test + code freeze:** girlfriend tests the live site on her phone, phone run-through, fix only real bugs | Mon Nov 2 | Test notes written, bugs fixed. **Code freeze tonight** |
| 11a | **Ship prep:** README, license, secret scan, clean temp files, make the repo public, video, submission draft | Tue Nov 3 | Repo opens in a logged-out browser; video under 3:00 uploaded; draft ready |
| 11b | **Submit** | Wed Nov 4 | Submitted, with a screenshot of the confirmation |
| — | Official deadline (buffer only) | Thu Nov 5, 10 AM | |

## Event dates (Manila)

| When | What |
| --- | --- |
| Wed Oct 28, 12 AM | Meta Engineering Workshop P1 (recorded → Discord #resources) |
| Thu Oct 29, 12 AM | Meta Engineering Workshop P2 (recorded) |
| Sat Oct 31, 12 AM | Fireworks AI workshop (recorded) |
| Weekdays, 10–11 PM (11 PM–12 AM from Nov 2) | Meta office hours on Discord |
| Nov 5, 10 AM | **Submissions close** |
| Nov 5–9 | Judging. Judges may test the live site any time: keep it running, no risky changes after submitting |
| Nov 10, 1 AM | Closing ceremony, live finals |

## Where we are now

**Day 6 (Nov 1), building is done. Next: Nov 2 outside test, then code freeze.**
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
- [x] Step 7 Must flow done on the live URL, phone + laptop
- [x] Step 7b receipt check done on the live URL
- [x] Step 7c done on the live URL (barangay clearance drafted on try 1, confirmed, good bill ready, old bill flagged)
- [x] Step 8 scorecard done (25 docs: Suri Meta 166/179 92.7% 0 errors, Baseten 171/175 97.7% +1 timeout error on phone billing, plain OCR 134/179 74.9%, poison PASS both; fresh 3-file rerun + timing partial Meta 4.1s / Baseten 51.1s; docs/SCORECARD.md + docs/scorecard.csv)
- [x] Step 9 photo quality / retake and wrong-document check done (blurry ID → retake, report card in birth_certificate slot → wrong document, reviewer approve works; tested on Vercel preview, Act A + B committed on branch step-9)
- [x] Suri asks before it flags done and tested on the preview: the question names both values (e.g. Is "Ma. Theresa Santos Reyes" the same name as "Maria Theresa Santos Reyes"?), the answer is saved and survives re-uploads, there are no duplicate questions, and the reviewer sees the Q&A once under the check (branch step-9-questions)
- [x] Security pass done and tested on preview: security headers (CSP production-only, no unsafe-eval), dev origins dev-only, no internal error text in the work log, test pages removed, rate limits (session 10/h per IP, uploads 60/h per IP, 10/h per document slot, 10/h per visitor, answers 20/h per visitor, global daily cap checked last), IPs hashed with RATE_LIMIT_SALT, Supabase anonymous sign-in limit raised to 300/h
- [x] Auto-delete demo uploads and their rows after 7 days done: daily Vercel cron at 03:00 UTC, protected by CRON_SECRET, dry-run tested on the preview (would delete 25 submissions / 53 files with days=0; nothing older than 7 days yet)
- [x] Compare with plain OCR done: reviewer button runs Tesseract in the browser (self-hosted, lazy-loaded), same scoring module as the eval; also fixed a hydration mismatch on the checklist
- [x] Eval rerun done (Oct 30) fresh full 25: Meta 171/179 95.5% (8 retake, 0 wrong-doc, 0 wrong value, 5.8s avg), Baseten 173/179 96.6% (0 retake, 0 wrong-doc, 6 wrong value, 22.4s avg), OCR 135/179 75.4% 0.8s, poison PASS both; SCORECARD.md + scorecard.csv rebuilt with 3-way split and full-25 timing, previous Oct 29 kept; note: first phone billing photo was a report card and was correctly flagged as wrong document — replaced with a real photo of the bill
- [x] Step 10 design done: 10a landing, 10b checklist, 10d start/profile/setup, 10c reviewer redesign (PR #14)
- [x] Suri asks about names instead of guessing: Ma./Sto./Sta. expanded, word-by-word compare, small spelling slips forgiven, extra words → "check" (PR #14)
- [x] Visible model calls: server log prints `[suri] meta · muse-spark-1.3 · read valid_id · 3.7s · ok` (no document text); activity log shows "Meta Muse Spark 1.3 · 3.7 s" (PR #14)
- [x] False READY fixed: rows show "Checking against your other papers…" until a check_finished / check_failed entry exists (PR #15, extended in PR #17 for custom checks whose results arrive in two batches)
- [x] Landing polish (PR #16): 24-second hero story (pick, read & ask, build your own), name meaning, accuracy cards, how-it-works outline, privacy cards, Suri favicon, built-by credits, sticky sidebar
- [x] /start + /setup polish (PR #17): square markers, card spacing, description limit 1000 characters with counter, "can't check" card with a one-line reason
- [x] Custom checks allow up to 6 documents (was 4); extra documents are listed as "Not included (limit is 6 documents)" instead of dropped silently (PR #17)
- [x] Tests: 399 passed, 0 failed (`node --test "tests/**/*.test.js"`; plain `node --test` also picks up scripts/read-test.mjs, which is a manual script, not a test)
- [ ] Next: Nov 2 outside test on the live site (phone), then code freeze
- [ ] Check the Billing page usage every night

## Polish list (step 10)

Ticked = seen working on Nov 1. Unticked = not re-checked yet; look during the Nov 2 test.

- [x] Applicant / Reviewer switch shows which side is active
- [x] Field labels in plain words on the checklist and /setup
- [x] Work log labels in plain words ("Suri · Reading · Valid ID")
- [x] / shows the Suri landing page; tab title is Suri; Suri favicon
- [x] Wrong-document label shows the plain name only
- [ ] /profile shows the same error twice
- [ ] Empty birth date message says "Please enter your birth date"
- [ ] Amounts shown as ₱75.00 everywhere
- [ ] Override note box has a visible border
- [ ] "Overridden. A person decides." banner shows once
- [ ] Reviewer header doesn't repeat "answered, a person will decide"
- [ ] OCR comparison card shows plain field labels

## Known limits (for README)

- Receipt check reads up to 3 item lines
- A document stuck in "reading" is only marked as error when the checklist is opened or refreshed
- A custom check can have up to 6 documents, 12 fields per document, 20 rules and 5 "can't check" items. If more documents are described, Suri keeps 6 and lists the rest as "Not included"; review the draft before saving
- The /setup description is capped at 1000 characters (the server accepts up to 1500)
- Things a photo can't prove (records kept by another office, real signatures, original vs photocopy, judgement calls) are listed for a person, never checked
- Suri doesn't judge whether a document is genuine (see SCOPE.md)
- When Suri asks for more detail on /setup, the answer is added to the description box and the whole text is drafted again

## Plan note

- If step 8 finishes early, move the base theme (colors, Manrope font, button and input styles) up to right after step 8; logo, scan beam, hero and light toggle stay in step 10.

## Ship checklist (step 11)

**Nov 2 (test + freeze)**
- [ ] Girlfriend tests the live site on her phone (sample documents only); write down what confused her
- [ ] Phone run-through on the live URL: landing, /start, Linawan flow, receipt flow, /setup draft + save + use
- [ ] Fix only real bugs; tests still pass
- [ ] Code freeze in the evening

**Nov 3 (ship prep)**
- [ ] README: what Suri is, how it works, **where each model is used** (table), run it with your own key, sample server log lines, scorecard numbers, limitations (Known limits above + SCOPE.md), credits (ascii-reveal inspiration)
- [ ] Choose a license (MIT / Apache 2.0 / AGPL / none) and check the hackathon terms first
- [ ] Remove temp files (`_tmp_*.js`, `test-clarify-patch.js`) and anything not meant to be public
- [ ] Secret scan of the whole git history; `.env*` never committed
- [ ] Supabase Security Advisor shows no errors
- [ ] npm audit: no high
- [ ] Hide the personal GitHub profile README (make that repo private)
- [ ] Make the repo public; open it in a logged-out browser
- [ ] Record the video (under 3:00, English, real screen, app + terminal log side by side so the Meta calls show)
- [ ] Submission draft written

**Nov 4 (submit)**
- [ ] Submit; screenshot the confirmation
- [ ] After submitting: no risky changes while judging runs

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
- **Day 2 (Oct 28):** Step 7b receipt check coded: official_receipt doc (3 optional item slots, subtotal/VAT/total), receipt_check process (no profile, no requirement), peso normalization before Zod for model output + reviewer corrections, generic sum_equals rule (empty slot = 0, all-empty skips, unreadable skips), self-check display without "same as", 2 sample templates (good totals + bad total). 75/75 tests, lint 0 errors, build passes. **Next:** commit + push, live phone + laptop check of receipt on /start, then step 8.
- **Day 2 (Oct 28):** Phone layout fixed, stuck-reading timeout, profile birth date as month/day/year, step 7b receipt check live; about 2–3 days ahead of schedule.
- **Day 3 (Oct 29):** Decided to add 7c so Suri is general for any office, not only the two samples.
- **Day 3 (Oct 29):** Step 7c built in 3 parts and live (barangay clearance drafted on try 1, confirmed, good bill ready, old bill flagged). Suri now builds a check from plain words. Small fixes: draft prompt prefers reuse (valid ID → valid_id); same-document checks show "match. reason" without "same as". **Next:** step 8 scorecard.
- **Day 3 (Oct 29):** Scope frozen; visual references recorded in DESIGN.md.
- **Day 3 (Oct 29):** Step 8 full eval passed on all 25 samples (179 fields): Suri on Meta muse-spark-1.3 166/179 (92.7%), Muse Spark Open on Baseten 164/179 (91.6%), plain OCR 134/179 (74.9%), poison PASS on both; scorecard in docs/SCORECARD.md + docs/scorecard.csv. Timing not recorded (eval script logs no per-document seconds). **Next:** step 9 Should features.
- **Day 3 (Oct 29):** Step 8 zeros diagnosed text-free + fresh 3-file rerun: (1) Meta blurred ID all-unreadable 0/8 confirmed (5.1s); (2) birth-cert-2 flipped to 8/8 both (transient, Meta 3.7s / Baseten 85.9s); (3) phone billing Meta 0/4 type-other (3.5s), Baseten timeout-or-network ERROR excluded. New headline: Meta 166/179 92.7% 0 errors, Baseten 171/175 97.7% +1 error, OCR 134/179 74.9%. eval.mjs now records error outcome + per-doc seconds with --file/--fresh; SCORECARD.md + scorecard.csv rebuilt with Errors/Timing/Diagnosis sections. **Next:** step 9 Should features.
- **Day 4 (Oct 30):** Step 9 photo quality / retake + wrong-document check shipped (Act A migration 0005, validation + decide-usability + reader + read-background; Act B routes/UI/review/run-checks/eval/docs; blurry ID → retake, report card in birth_certificate slot → wrong document, reviewer approve works on preview). **Next:** eval 5-way counts + remaining Should features.
- **Day 4 (Oct 30):** built in 5 small Act tasks on branch step-9-questions (migration 0006, background question with template fallback, answer route with tests, screens); question must mention both values or the template is used.
- **Day 4 (Oct 30):** Security pass done and tested on preview: security headers (CSP production-only, no unsafe-eval), dev origins dev-only, no internal error text in the work log, test pages removed, rate limits (session 10/h per IP, uploads 60/h per IP, 10/h per document slot, 10/h per visitor, answers 20/h per visitor, global daily cap checked last), IPs hashed with RATE_LIMIT_SALT, Supabase anonymous sign-in limit raised to 300/h.
- **Day 4 (Oct 30):** Auto-delete done: daily Vercel cron at 03:00 UTC, protected by CRON_SECRET, dry-run tested on the preview (would delete 25 submissions / 53 files with days=0; nothing older than 7 days yet)
- **Day 4 (Oct 30):** Compare with plain OCR done: reviewer button runs Tesseract in the browser (self-hosted, lazy-loaded), same scoring module as the eval; also fixed a hydration mismatch on the checklist
- **Day 4 (Oct 30):** Eval rerun fresh full 25 (step 9 last item): Meta 171/179 95.5% (8 retake, 0 wrong-doc, 0 wrong value, 5.8s avg), Baseten 173/179 96.6% (0 retake, 0 wrong-doc, 6 wrong value, 22.4s avg), OCR 135/179 75.4% 0.8s, poison PASS both; SCORECARD.md + scorecard.csv rebuilt with 3-way split + full-25 timing, previous Oct 29 kept; 0 errors; note: first phone billing photo was a report card and was correctly flagged as wrong document — replaced with a real photo of the bill; next step 10 polish
- **Day 5 (Oct 31):** Step 10 design: approved the mockups (Bryl Lim-style structure + Suri scanner signature), then built 10a (fonts, tokens, landing), 10b (checklist restyle) and 10d (start/profile/setup restyle). Cline rewrote client.js from an old copy once and lost work; rebuilt it. New rule: risky logic and CSS are hand-written, Cline only makes small exact edits.
- **Day 6 (Nov 1):** 10c reviewer redesign + name check that asks + visible model calls (PR #14); false READY fix (PR #15); landing polish with the 3-scene hero (PR #16); /start + /setup polish, 6-document limit with "Not included" note, READY flash fix for custom checks (PR #17). Live test: custom barangay check drafted, saved, used; voter ID asked about "Ma.", sample electric bill passed 3 checks. 399 tests pass. **Next:** Nov 2 outside test, code freeze.
