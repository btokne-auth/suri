# Step 10d part 1 — restyle /start, /profile and /setup — PLAN ONLY

Branch: `design-flow` — approved with 3 corrections. Do not implement yet — stop after saving.

## Sources read
- `docs/DESIGN.md` (tokens, type, motion, build order)
- `app/globals.css` — tokens + landing + Checklist 10b (reuse look)
- `app/page.js` (landing section-head pattern), `app/set/[submissionId]/client.js` (header/tabs)
- `app/start/*`, `app/profile/*`, `app/setup/*`, `lib/processes/describe.js` (do NOT edit)

No mockup for these pages: match landing + checklist (mono labels 10–11px uppercase .12–.14em --text-2, thin dividers --line, --surface cards 12px, white primary button, tokens only, phone-first 390px).

## Applied corrections
1. Do NOT edit `lib/processes/describe.js`, no ESM shim. Keep `localView` in `app/setup/client.js`; only fix field display there. Note reuse as later 10d item.
2. Reuse existing white primary class from Checklist (e.g. `.checklist-btn-primary`) — no new hardcoded #fff class.
3. Don't repeat same words in a page's small label and its h1. Use different label or omit.

## Hard constraints (do NOT change)
- Looks and wording only. No API, logic, data flow, validation, or what buttons do.
- Don't touch `docs/DESIGN.md`, `docs/SCOPE.md`, `docs/mockups/`. No new packages. Keep `--webpack`.
- Don't read `.env` files. Don't commit. Secrets in `.env.local` + Vercel env.
- Implementation happens in one go once approved (correction #4) — no waiting between steps, but still small targeted edits.

## Goals (looks + wording only)
1. Shared header on all three pages like checklist header (Suri logo links to `/`). Shared component in `app/components/` if repeated.
2. `/start`: rows as selectable radio (whole row clickable, keyboard, visible focus), `Your checks` own section, white primary `Start →`, `Set up →` link. Keep `?process=` preselect.
3. `/profile`: styled form (mono labels, inputs on `--surface` `--line-strong`, Month/Day/Year row stays), white save, 3 fixes.
4. `/setup`: styled textarea + white `Build`, quiet mono work log, draft cards (field label + meta, never raw key), check cards, `can't check` + `needs more detail` boxes (`--check`/`--surface`), white `Confirm`. Keep `localView`; don't switch to `describe.js`.
5. Phone first 390px, no sideways scroll, respect `prefers-reduced-motion`.


## 1) Shared header

### New file: `app/components/SuriHeader.js`
- Why repeated on 3 pages — task allows small shared component.
- Reuse checklist header (`app/globals.css` Checklist / `app/set/[submissionId]/client.js`): `header.checklist-header` (`flex; space-between; padding:16px 0; border-bottom:1px solid var(--line)`) + `a.checklist-brand[href="/"]` with same SVG as landing (22×28, #8B8D94 / #EDEDEF S / #7B8CFF bar) + `span.mono` Suri. Link to `/`. No other nav. Tokens only (`--bg`/`--text`/`--line`/`--accent` focus). Focus `outline:2px solid var(--accent); offset:2px`.
- Presentational only: `export default function SuriHeader()` — no props/fetch. No theme toggle.

### `app/globals.css`
- Reuse `.checklist-header`/`.checklist-brand` directly or thin alias `.suri-header` duplicating same rules so 560px shells don't inherit 1080px max-width.
- Phone-safe 390px: `max-width:100%`, `box-sizing:border-box`, no negative margins.
- Don't duplicate label+title words (correction #3): page `h1` already says page; don't put identical `01 — start a check` above `Start a check`. Use distinct section labels or omit page-level label. Keep `01 —` / `02 —` only for sections inside page.

### Wrappers `app/start/page.js`, `app/profile/page.js`, `app/setup/page.js`
- No logic change; header lives in `client.js`.

## 2) `/start`

### `app/start/client.js` — keep logic, restyle look
Current: inline `BTN`/`CARD` (`#888` / `var(--foreground)`), `row()` -> `<label style><input type="radio"> label`, `<main className="start-page">`, inline `Your checks` div, plain `Start` + `Set up` link. Keep: `msg/busy/samples/saved/picked`, `useEffect` `POST /api/session` (best-effort) + `GET /api/processes` splitting `saved_`, `?process=` preselect + fallback, `start()` `POST /api/session` + `POST /api/submissions` -> `/profile?submission=` or `/set/:id`.

Changes:
- Shell: `<div className="checklist-page start-page">` `max-width 560-640px` `margin:0 auto` `padding:16px 20px 48px` `bg var(--bg)` `color var(--text)` (replace legacy `.start-page {system-ui}`) + `<SuriHeader />` + intro `h1 Start a check` + subtitle without duplicating label (per #3). Footnote as `.checklist-foot` mono 11px `var(--text-3)`.
- Section `01 — choose a process` (distinct from page title — e.g. `01 — available checks` if `h1` is `Start a check`): `<div className="landing-section-head"><span className="landing-section-title">01 — choose a process</span></div>` (flex + border-bottom var(--line) mono 16px var(--text-2)).
- Rows: `<label className="start-row"><input type="radio" name="process" value={p.id} checked onChange className="start-radio"><span className="start-radio-mark" aria-hidden> + <span className="start-row-main"><span className="start-row-name">{p.label}</span></span>`. Keep real input focusable (opacity 0 absolute) for Tab/Space/arrows. Card: `bg var(--surface)` when selected else transparent, `border var(--line-strong)` selected else `var(--line)`, `radius 12px`, `padding 14px 16px`, `hover rgba(255,255,255,0.02)` / `active scale .98` gated. Focus `outline 2px var(--accent)` via `:has(:focus-visible)` + `focus-within` fallback.
- `02 — your checks` when `saved.length>0`: same head pattern, `saved.map(row)` same style, keep `id="your-checks"` for anchor.
- Primary: reuse existing white primary (correction #2) `.checklist-btn-primary` — no new `#fff` class. `<button className="checklist-btn-primary" onClick={start} disabled={busy||!picked}>Start →</button>` full width on phone, centered.
- Secondary: `<a href="/setup" className="landing-section-link">Set up your own check →</a>` mono 11px .12em var(--text-2) hover var(--text).
- Status: `msg && <p className="checklist-msg">` (border var(--line-strong) bg var(--surface) 8px padding:12px). No new logic.

### `app/globals.css` — start
- Add `/* Start — Step 10d part 1 */`: override legacy `.start-page` system-ui with token version, add `.start-row`/`.start-radio`/`.start-radio-mark`/`.start-row-main`/`.start-row-name` using `var(--surface)`/`var(--line)`/`var(--line-strong)`/`var(--text)`, `radius 12px`, `max-width:100%` `overflow-wrap:break-word` for 390px, reduced-motion gate.



## 3) `/profile`

### `app/profile/client.js` — styled form + 3 fixes
Current: inline `INP`/`BTN`/`ERR` (#a00), `MONTHS`, `birthMonth/Day/Year` + `buildBirthDate()` (strip non-digits, padStart), `form` + `errs` + `msg`, prefill `supabase.from('profiles').select(...).maybeSingle()`, `save()` `POST /api/profile` mapping `issues->byField`, redirect `if(sub)->/set/:id` else `Saved. Go back...`. Month/Day/Year row stays.

Keep all handlers/logic exactly.

Styling + fixes:
- Shell: `<div className="checklist-page profile-page">` `max-width 560px` centered `padding 16px 20px 48px` `bg var(--bg)` + `<SuriHeader />` + intro `h1 Your details` + subtitle without duplicating label per #3.
- Form: `<form onSubmit={save} noValidate className="profile-form">`, each field `<label className="profile-label"><span className="mono profile-label-text">Given name</span><input className="profile-input">`. Label mono 10-11px uppercase .12-.14em var(--text-2) (reuse `.checklist-intro-label`), input/select `bg var(--surface)` `border 1px var(--line-strong)` `radius 8px` `color var(--text)` `padding 12px` `min-height 44px` `font-size 16px` `width:100% max-width:100%` focus `outline 2px var(--accent)`.
- Birth row stays `flex gap 8 wrap` -> class `.profile-birth-row`, each label `flex 1 1 110/60/80px`, select same as input.
- (b) Error once: `setErrs(byField)` + `setMsg(j.error||'Please fix...')` can duplicate. Deduplicate presentation only: per-field `errs.*` under inputs (`<span className="profile-error">` `var(--mismatch)` mono 12px `margin 4px 0 12px`) and hide global `msg` when same text already in `errs` or when `msg==='Please fix the fields below.'` and errs non-empty (render gate, not validation change).
- (c) Replace `use YYYY-MM-DD` wording: if `errs.birth_date` contains `YYYY-MM-DD`, show plain words e.g. `Enter Month, Day, and a 4-digit Year.` / `Enter your birth date using the Month, Day, and Year fields above.` Mapping in render only; keep `buildBirthDate()` logic.
- (a) No `?submission=` to return to: instead of `Saved. Go back...`, when `!sub && msg==='Saved.'` show `<p className="checklist-msg">Saved.</p><a href="/start" className="landing-section-link">Start a check →</a>` to `/start`. Keep `if(sub) window.location.href='/set/'+...` redirect.
- Primary: reuse white primary (correction #2) `<button type="submit" className="checklist-btn-primary">Save and continue</button>` `width:100%` `48px` keep submit.

### `app/globals.css` — profile
- Add `/* Profile — Step 10d part 1 */`: `.profile-page`, `.profile-label`/`.profile-label-text` (mono 10px .14em var(--text-2)), `.profile-input`, `.profile-error` (var(--mismatch)), `.profile-birth-row`. Ensure `max-width:100% overflow-wrap:break-word` for 390px. Reduced-motion gate for button active scale.


## 4) `/setup`

### `app/setup/client.js` — styled draft builder (keep `localView`, no `describe.js` edit)
Current: inline `INP`/`BTN`/`CARD` (`#888`/`var(--foreground)`), `EXAMPLE`, `docIdOf`, `builtinLabel` (valid_id/birth_certificate/report_card/official_receipt), `fieldTypeWord`, `clone`, `localView()` (docs/checks/requirement/not_checked; for reused `fields:[]`; `fieldName` fallback `key.replace('_',' ')`), `removeField/Check`, state `description/draft/needsMoreInfo/attempts/msg/busy`, `build()` `POST /api/setup/draft` (attempts/needs_more_info/draft), `confirm()` `POST /api/setup/confirm`. Correction #1: do NOT edit `lib/processes/describe.js` or add shim; only fix field display.

Keep all handlers/state/fetch logic.

Styling:
- Shell: `<div className="checklist-page setup-page">` `max-width 560-680px` centered `padding 16px 20px 48px` `bg var(--bg)` + `<SuriHeader />` + intro `h1 Set up your own check` + subtitle distinct from label per #3 (e.g. label `01 — describe your check` vs h1).
- Textarea: `<label className="profile-label"><span className="mono profile-label-text">What do you want to check?</span><textarea className="setup-textarea" placeholder={EXAMPLE} rows=4>` `bg var(--surface)` `border 1px var(--line-strong)` (focus var(--accent)) `radius 12px` `padding 12-16px` `16px/1.5` `min-height 96px` `width:100%` + hint `<span className="setup-hint mono">Example: {EXAMPLE}</span>` `var(--text-3)` 11px. Primary Build reuse white primary (correction #2): `<button className="checklist-btn-primary" onClick={build} disabled={busy}>Build my check</button>` `width:100% 44-48px`.
- Work log quiet mono: replace `CARD` box around `attempts.map` with `<div className="setup-log"><ul className="checklist-log-list">` reusing checklist log (`margin 16px 0 0; padding 0 0 0 16px; border-left 1px var(--line); gap 14px` mono 14px) + `checklist-log-row`/`dot`/`text`/`time`. Dot color by result `ready->var(--match)`, `needs_more_info->var(--check)`, else `var(--mismatch)`/`var(--text-3)`. Gate animation via existing reduced-motion block.
- `Suri needs more detail` box: `<div className="setup-needs-more">` `bg var(--surface)` `border 1px solid var(--check)` `radius 12px` `padding 14px 16px` + `span.mono setup-needs-label` 11px .12em var(--check) + `p.setup-needs-text` 14px var(--text-2) + hint var(--text-3).
- Draft cards (`draft && !needsMoreInfo`):
  - Section head distinct per #3: `<div className="landing-section-head"><span className="landing-section-title">02 — your checklist</span></div>` (not duplicating page title), draft title + `Check name` input as `.profile-input` under mono label.
  - Doc cards: `draft.documents` -> `<div className="setup-doc-card">` `bg var(--surface)` `border var(--line)` `radius 12px` `padding 16px` `margin-bottom 12px`. Reused: `builtinLabel(id)` + `span.mono setup-reused Reused as-is` var(--text-3) 11px. New: editable name input.
  - Field rows — fix display only: currently `<label>{f.key} ({type})` exposes raw `account_name`. Replace title with label + meta, never key: `<div className="setup-field-row"><span>{f.label || fallback} <span className="mono setup-field-meta">· {fieldTypeWord(f.type)} · {f.required?'required':'optional'}</span></span><input className="profile-input" value={f.label||''} onChange setFieldLabel></div>` (keep localView but don't show f.key). Fallback `String(key).replace(/_/g,' ')` capitalized if needed, prefer f.label. Remove this field as secondary ghost `border var(--line-strong)` transparent var(--text-2) mono 12px 44px.
  - Check cards: `draft.checks` -> `<div className="setup-check-card">` `bg var(--surface)` `border var(--line)` `radius 12px` `padding 14px` + small mono `Check 0{n}` + `<p className="setup-check-text">{view.checks[ci]}</p>` (view from localView), editable Value/Months as `.profile-input`, Remove secondary, `c.message` as `.checklist-foot`. Keep localView check wording (don't switch to describe.js now).
  - Requirement: same card `First gate: field on doc op value -> message` editable.
  - `Suri can't check these yet` box: `bg var(--surface)` `border 1px solid var(--check)` `radius 12px` `padding 14px` `margin-bottom 12px` title mono var(--check) 11px .12em, list mono 12px var(--text-2) max 5. Don't use hardcoded #a60.
  - Confirm: reuse white primary `<button className="checklist-btn-primary" onClick={confirm} disabled={busy}>Confirm and save</button>` (correction #2). Keep click.
  - All cards `width:100% max-width:100% overflow-wrap break-word` `gap 12px`. Footnote sample docs as `.checklist-foot`.

### `lib/processes/describe.js` — no change
## 5) Phone first + motion

- Every new container (`.start-page`, `.profile-page`, `.setup-page`, `.suri-header`, `.setup-doc-card`, `.setup-check-card`, `.profile-form`, `.setup-textarea`) `max-width:100%` `box-sizing:border-box` `overflow-wrap:break-word`. No fixed >360px widths. Birth row `flex 1 1 110/60/80px` not fixed 200px.
- 390px check: no horizontal scroll — global `html,body {max-width:100%; overflow-x:hidden}` already; new blocks add `padding 16px` at 390px via existing `@media (max-width:390px)` (extend to setup). No negative margins.
- `prefers-reduced-motion: reduce` — gate any new transitions (row hover nudge, press scale, log-in) like existing checklist: `@media (prefers-reduced-motion:reduce){ .start-row,.checklist-btn-primary,.setup-log-row--new{transition:none;animation:none;transform:none}}`.
- Contrast: mono labels never darker than `var(--text-3)` on `var(--bg)` — use `var(--text-2)` for labels, `var(--text-3)` for footnotes.

## Files to change (one-go implementation — correction #4)

1. **NEW `app/components/SuriHeader.js`** — small shared header, Suri logo -> `/` (reuses checklist header markup/tokens). Only because 3 pages repeat it.
2. **EDIT `app/globals.css`** — Add Step 10d part 1 blocks for shared header/start/profile/setup; override legacy `.start-page/.profile-page/.set-page {font-family:system-ui}` bug (currently hides correct fonts) with token version; reuse existing `.checklist-btn-primary`/`.checklist-msg`/`.checklist-foot`/`.checklist-log-list`; keep `--webpack`; keep landing + checklist 10b untouched.
3. **EDIT `app/start/client.js`** — Import `SuriHeader`, remove inline `BTN`/`CARD` hardcoded styles, restyle rows as accessible radio cards (whole-row clickable, keyboard, 2px `var(--accent)` focus), `Your checks` own `02 —` section (distinct per #3, keep `id="your-checks"`), white `Start →` via `.checklist-btn-primary`, secondary `Set up →` via `.landing-section-link`, keep `?process=` + `start()` redirect, style `msg`/footnote.
4. **EDIT `app/start/page.js`** — only if wrapper needs import; else unchanged.
5. **EDIT `app/profile/client.js`** — Import `SuriHeader`, replace inline `INP`/`BTN`/`ERR` with `.profile-input`/`.profile-label`/`.profile-error` (`var(--surface)`/`var(--line-strong)`), keep Month/Day/Year row, white save via `.checklist-btn-primary`; (a) no `?submission=` -> `Start a check →` link to `/start` not `Saved. Go back…`; (b) single error (hide duplicate global `msg`); (c) map `YYYY-MM-DD` to plain Month/Day/Year words; keep `buildBirthDate()`/`save()` logic.
6. **EDIT `app/profile/page.js`** — only if wrapper needed.
7. **EDIT `app/setup/client.js`** — Import `SuriHeader` (do NOT import `describe.js`), replace `INP`/`BTN`/`CARD` inline, style `setup-textarea` + white `Build` via `.checklist-btn-primary`, quiet mono work log reusing checklist log, `needs_more_detail` + `can't check` boxes via `var(--surface)`/`var(--check)`, draft doc cards with `LABEL · type · required` (never raw key), check cards, requirement card, white `Confirm` via `.checklist-btn-primary`, keep `build()`/`confirm()`/`removeField/Check`.
8. **EDIT `app/setup/page.js`** — only if wrapper needed.

Do NOT touch: `lib/processes/describe.js` (per #1), `docs/DESIGN.md`, `docs/SCOPE.md`, `docs/mockups/`, `.env*`, any `/api` route, validation, DB, `package.json` `--webpack`.

## Wording changes (allowed)
- `/start`: `Start` -> `Start →`, `Set up your own check` -> `Set up your own check →`.
- `/profile`: `Saved. Go back and open your checklist.` -> `Saved.` + `Start a check →` link to `/start` when no submission; `use YYYY-MM-DD` -> plain Month/Day/Year words.
- `/setup`: keep `Build my check`/`Confirm and save`; field rows `Account name · name · required` never `account_name`; `can't check`/`needs more detail` titles mono `var(--check)`.
- Never show raw field keys; never show `(form 138 style)` parentheticals.

## What stays exactly as-is
- Fetches: `POST /api/session`, `GET /api/processes`, `POST /api/submissions`, `POST /api/profile`, `POST /api/setup/draft`, `POST /api/setup/confirm` + Supabase prefill.
- Validation/schema/file checks/limits/background reading/statuses, what buttons do (`start()` -> `/profile` or `/set/:id`, `save()` -> `/set/:id`, `build()`/`confirm()` -> process creation). No new routes/DB/model/auth.

## Verify (after one-go implementation)
- `npm run dev --webpack` open `/start`, `/profile`, `/profile?submission=test`, `/setup` at 390px + 1280px: no sideways scroll, Tab/Space through start rows, focus ring visible.
- `?process=receipt_check` preselects that row.
- `/profile` empty birth date -> single plain error matching Month/Day/Year fields, not duplicate; save with no submission shows `Start a check →` link.
- `/setup` build -> mono log, draft fields `Account name · name · required` never `account_name`, warning boxes `var(--check)`/`var(--surface)`, Confirm white via `.checklist-btn-primary`.
- `npm run build --webpack` passes, no new packages, no `.env` read, `.env*` in `.gitignore`. Commit after, under user's name/email, no AI attribution.



