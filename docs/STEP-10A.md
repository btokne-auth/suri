# Step 10a — design base (branch `design-base`)

## Goal
Fonts, tokens, page title, landing `/` with hero scan animation. CSS only, prefers-reduced-motion final state. 390px no scroll.

## Inputs reviewed
- `docs/DESIGN.md` (tokens, type, motion, build order)
- `docs/mockups/landing.html` (ignore `<x-dc>`, `<helmet>`, `support.js`, `DCLogic`)
- `app/layout.js`, `app/globals.css`, `app/page.js` (starter + dark helpers)
- `lib/processes/index.js` + `linawan-scholarship-intake.js` + `receipt-check.js`
- `lib/documents/index.js`
- `app/start/page.js` + `app/start/client.js` (visitor start flow: POST /api/session → POST /api/submissions → /profile or /set)
- `docs/SCORECARD.md` (Oct 30: 95.5% / 0 wrong / phone 100% vs 26%)
- `package.json` (--webpack)

## How start works & where processes live
`/start` fetches `GET /api/processes`, splits `saved_*`, radios, Start POSTs session+submission. Built-ins listed via `lib/processes/index.js` `listProcesses()` (linawan 3 docs, receipt 1 doc). Landing now imports `listProcesses()` directly.

## Files changed / created
| File | Action | Change |
|------|--------|--------|
| `app/layout.js` | Change | Manrope 400/500/600/700 + JetBrains_Mono 400/500/600 via `next/font/google` (variable, latin, display swap); remove Geist. Metadata title `Suri`, description `Check your papers before the office does.` |
| `app/globals.css` | Change | Keep `--background/--foreground` as aliases to new tokens. Add tokens --bg #0D0E10 --surface #141518 --line #1E1F23 --line-strong #26272C --text #EDEDEF --text-2 #8B8D94 --text-3 #5C5E66 --match #7FD6A6 --check #F0C46A --mismatch #F29A9A --accent #7B8CFF. Body bg/text/font. Landing shell/sidebar/hero/stats/rows/hover/focus/press + keyframes beam/lock/on/off/val/draw/type + prefers-reduced-motion. Phone 768px/390px: top bar, hero column, stats 1-col, no scroll. Preserve old .set-page etc. |
| `app/page.js` | Recreate (only allowed) | Server component, calls `listProcesses()` directly, maps linawan/receipt to short titles/descriptions/docs; fallback label. Renders sidebar (logo S+accent bar, nav to /start + /setup only + footer line), hero (HeroScan + typed line + heading + 2 paras), stats (95.5%/0/100% vs 26%), section 01 with SET UP YOUR OWN → /setup, process rows as `<a href="/start?process=id">`, footer SAMPLE line. |
| `app/components/HeroScan.js` | Create | Server component, no use client, viewBox 0 0 360 320 width 100% max-width 360px, exact SVG text from landing.html (LINAWAN VOTER ID etc + tags NAME ▪ CONFIRM/BIRTH ✓ MATCH/CITY ✓ PASSED). |
| `app/start/client.js` | Change | Preselect ?process= if it matches loaded id (small edit only). |
| `docs/STEP-10A.md` | Create | This file. |

## Left out (no route)
Sidebar: your checks, how it works, accuracy, privacy. Hero: how it works ↗, scorecard ↗, github ↗. Only /start + /setup kept.

## Motion & phone
8s CSS loop, arrow nudge 2px, row --surface hover, focus 2px --accent, press .98. Stats stack 1-col at 390px, top bar, no overflow.

## Rules
Small edits, only page.js recreated, no logic/API/DB, no new packages, --webpack, dark only, no theme toggle, no .env read, no commit.
