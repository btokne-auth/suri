# Step 9E — Reviewer "Compare with plain OCR" (Act plan)

> **Branch:** `step-9-ocr-compare` · **Status:** approved plan, not yet built  
> **Read before each Act:** `docs/SUMMARY.md`, "Where we are now" in `docs/SCHEDULE.md`, then this file.  
> **Inputs reviewed:** `docs/SUMMARY.md`, `REQUIREMENTS.md` Should line (reviewer per-document Tesseract.js in browser; 3-way scorecard in README/video only, never dashboard), `docs/STEP-9C.md` CSP prod-only / no `unsafe-eval`, `lib/csp.js`, `scripts/eval.mjs` scoring, `app/api/documents/[id]/image/route.js`, `app/set/[submissionId]/client.js` reviewer block, `package.json`.

> **Goal:** In Reviewer view, a per-document **"Compare with plain OCR"** button. On click (not before), lazy-load Tesseract.js in browser, run on same image, show per-field `what Suri read | plain OCR found (✓/✗)` + raw OCR text in scrollable plain-text box. No model call, no server cost. Method must exactly match eval.

---

## 0. Hard rules for this step (amendments)

1. **Never commit.** Agent does not run `git commit/push`. Owner commits after each Act. No `Co-Authored-By` or AI attribution.
2. **Browser-safe shared module.** `lib/ocr-compare.js` and everything it imports must be browser-safe: no `import 'server-only'`, no `fs`/`path`/`crypto`. If `lib/validation.js` isn't browser-safe, extract helper(s) into small browser-safe file and import from both (see §1.3).
3. **Language data from pinned npm package.** English traineddata is **not** inside `tesseract.js`. Install pinned npm package (e.g. `@tesseract.js-data/eng@<pinned-version>`) and copy into `public/tesseract/lang-data/`. Record exact files, sizes, licenses (Apache 2.0) in §3 for README credits.
4. **Three fresh Acts, each reads this doc first.**
   - Act 1 = shared module + eval wired + CSP + tests
   - Act 2 = dependency move + self-hosted assets + image-proxy route
   - Act 3 = reviewer UI (lazy Tesseract, per-field ✓/✗, raw box, progress)

---

## 1. Scoring: one shared module used by BOTH eval and reviewer

Move eval's "value found in OCR text" logic verbatim into one shared pure module — `lib/ocr-compare.js` (CommonJS `module.exports` so `scripts/eval.mjs` can `require()` it and browser can import it; keep ESM alt if preferred — must stay browser-safe).

### 1.1 What moves

Source today: `scripts/eval.mjs:182-305` plus `lib/checks/names.js:baseNormalize`, `lib/checks/text.js:normText`, `lib/validation.js:normalizeAmount`.

Exports (pure, no I/O, no Node):

```js
// lib/ocr-compare.js — browser-safe, no server-only, no fs/path/crypto
function escapeRegExp(s)
function expandShortNames(normed)
function dateCandidates(ymd) -> string[] // 12 variants
function ocrFoundInText({ fieldDef, ocrText, expected }) -> boolean
// fieldDef.type in {name,date,number,text,choice,code}
```

### 1.2 Per-type rules — identical to eval today

- **name**: `baseNormalize(hay).indexOf(baseNormalize(expected))>=0` or with `expandShortNames` on both. `baseNormalize` = `stripAccents(normalizeKeepAccents())` from `lib/checks/names.js` (accents stripped, `de la`→`dela`, comma reordered). Covers `Ma.=Maria`, `Sto.=Santo`, `Sta.=Santa`, suffix, accent tolerant.
- **date**: `normText(hay).indexOf(normText(c))>=0` for each `c` in `dateCandidates(expected)`. Candidates: `yyyy-mm-dd`, `yyyy/mm/dd`, `dd/mm/yyyy`, `mm/dd/yyyy`, `d month yyyy`, `dd month yyyy`, `month d yyyy`, `month dd yyyy`, `d mon yyyy`, `mon d yyyy`, `d-month-yyyy`, `yyyy month dd` — lowercased & space-collapsed via `normText`.
- **number/amount**: `normalizeAmount` (strips `₱`/`PHP`, commas, spaces) on expected and each `/-?\\d[\\d,]*(\\.\\d+)?/g` token in hay; match if `abs(a-b)<=0.01`.
- **choice**: word-boundary `new RegExp('\\\\b'+escapeRegExp(normText(expected))+'\\\\b')` on `normText(hay)` so `Male` != `Female`; fallback plain `indexOf`.
- **code**: plain `indexOf` on `normText` plus `flat(s)=s.replace(/[\\s\\-_]/g,"")` fallback for OCR-spaced codes.
- **text**/default: `normText(hay).indexOf(normText(expected))>=0`.
- Empty hay/expected -> `false`; never throws.
## 2. Loading Tesseract: lazy, self-hosted, no CDN

Goal: zero cost on page load; CSP stays `'self'` (no CDN).

- Move `tesseract.js@7.0.0` from `devDependencies` -> `dependencies` in `package.json` + lock via `npm install`. Keep `jimp` in devDeps (eval-only).
- Do not `createWorker()` until click. Inside handler: `const { createWorker } = await import("tesseract.js")` — separate webpack chunk.
- Self-host under `/public/tesseract/` so CSP needs no CDN. Exact files determined in Act 2 by listing `node_modules/tesseract.js/dist/` + `node_modules/tesseract.js-core/`:

```
public/tesseract/worker.min.js                 ~80-120 kB
public/tesseract/tesseract.min.js              (if worker references it)
public/tesseract/tesseract-core.wasm.js        ~150-200 kB
public/tesseract/tesseract-core.wasm           ~1.0-1.5 MB
public/tesseract/lang-data/eng.traineddata.gz ~4-6 MB (or .traineddata ~10-12 MB)
total ~6-8 MB, cached by Vercel CDN
```

  Act 2 creates `scripts/copy-tesseract-assets.mjs` (or manual cp) copying 4-5 files from `node_modules/` into `public/tesseract/` so deploy is self-contained. Track in git.

- Language data: pinned npm package. English data not inside `tesseract.js`. Install pinned package e.g. `npm install @tesseract.js-data/eng@<EXACT_VERSION>` (or alternative vendor — pin and record). Copy:
  ```
  node_modules/@tesseract.js-data/eng/eng.traineddata.gz -> public/tesseract/lang-data/eng.traineddata.gz
  ```
  Act 2 records exact source, dest, name, bytes, sha256, version in §3 for README.

- Language: `eng` only. No `osd`.
- Worker options (verify against `tesseract.js@7.0.0` README at Act 3):
  ```js
  const worker = await createWorker("eng", 1, {
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/tesseract-core.wasm.js",
    langPath: "/tesseract/lang-data",
    gzip: true,
    logger: m => setProgress(`Reading with plain OCR… ${Math.round(m.progress*100)}%`)
  });
  ```
- Lifecycle: one worker per page, reused across docs; `await worker.terminate()` on unmount. While loading disable button `aria-busy="true"`.

## 3. Assets, sizes & licenses (Act 2 fills, then copy to README)

Act 2 fills after `npm install` + `ls -lh` + `Get-FileHash`/`sha256sum`:

| File in repo | Source npm package & path | Version | Size | SHA-256 (first 12) | License |
|---|---|---|---|---|---|
| `public/tesseract/worker.min.js` | `tesseract.js/dist/worker.min.js` | `7.0.0` | `__ kB` | `__` | Apache-2.0 |
| `public/tesseract/tesseract-core.wasm.js` | `tesseract.js-core/...` | `__` | `__ kB` | `__` | Apache-2.0 |
| `public/tesseract/tesseract-core.wasm` | `tesseract.js-core/...` | `__` | `__ kB` | `__` | Apache-2.0 |
| `public/tesseract/lang-data/eng.traineddata.gz` | `@tesseract.js-data/eng/eng.traineddata.gz` | `__` | `__ MB` | `__` | Apache-2.0 |

All Tesseract components + `eng` traineddata are **Apache 2.0**. Add one-line credit in `README.md` (polish Act): "Plain-OCR comparison uses Tesseract.js (Apache 2.0) with English data (`eng.traineddata.gz`) self-hosted under `/public/tesseract/` — no CDN."

No `SharedArrayBuffer`/`Cross-Origin-Isolated` needed.

---

## 4. CSP changes in `lib/csp.js`: only what's needed, still no `unsafe-eval`

Current prod CSP (30 Oct `lib/csp.js:23-36`): `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' <origin> https://*.supabase.co; img-src 'self' data: blob: <origin> https://*.supabase.co; media-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`.

Add only:

- `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'` — allows WASM compile, NOT string eval.
- `worker-src 'self' blob:` — for Tesseract blob: workers.

No change to other directives. No CDN.

Impl in `lib/csp.js:buildCsp()`:

```js
"script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
"worker-src 'self' blob:",
```

## 5. Getting image pixels: same-origin proxy (chosen)

Same-origin proxy, NOT direct signed URL.

- Today `GET /api/documents/[id]/image` returns JSON `{url:signedUrl}` (300s). Using that directly needs CORS from Supabase and leaks host; proxy is simpler.
- **Add** `GET /api/documents/[id]/image-proxy` (new file):
  1. Auth + ownership identical to existing: `createClient()` -> `auth.getClaims()` -> userId; `admin.from('documents').select('id,storage_path,submission_id').eq('id',docId).maybeSingle()`; `admin.from('submissions').select('user_id').eq('id',doc.submission_id).maybeSingle()`; 401/404 same.
  2. `admin.storage.from('uploads').createSignedUrl(doc.storage_path,300)` then `fetch(signedUrl)` server-side.
  3. Pipe `arrayBuffer` with `Content-Type` from metadata (`image/jpeg|image/png`, fallback octet-stream), `Cache-Control: private, max-age=60`.
  4. PDFs (path ends `.pdf` or mime hint) return `400 {error:"Plain OCR preview not available for PDFs."}` — Tesseract can't read PDFs; PDF-to-image out of scope.
- Client (Act 3): `const blob = await fetch('/api/documents/'+encodeURIComponent(id)+'/image-proxy').then(r=>{if(!r.ok)throw ...;return r.blob()}); const objUrl=URL.createObjectURL(blob); const {data:{text}}=await worker.recognize(objUrl); URL.revokeObjectURL(objUrl);` Same-origin so `connect-src 'self'` suffices; `img-src blob:` already allowed.
- Keep original `/image` JSON route for display.

---

## 6. UX: progress, 360px, plain-text only, clear labels

In `app/set/[submissionId]/client.js` reviewer branch (`view==='reviewer'` doc card):

- Button per doc row below Approve/Reject: **"Compare with plain OCR"** — `SMALLBTN` + `borderStyle:'dashed'`, `aria-label="Compare with plain OCR (no AI) — runs in browser"`. Only in reviewer view. Disabled `aria-busy` while loading.
- On click: `ocrState[id]={status:'loading',progress:0,ocrText:null,perField:[],error:null}`; show **"Reading with plain OCR... 0%"** then `logger: m=>setProgress(Math.round(m.progress*100))`.
- Steps: fetch `image-proxy` blob -> `worker.recognize(objUrl)` -> per-field `ocrFoundInText({fieldDef,ocrText:text,expected:f.value_text??f.value})` (fieldDef from `resolveDocumentType(doc.document_type).fields`). If Suri `unreadable:true` show `— (Suri couldn't read this field)`.
- Result block (below button, `maxWidth:'100%'`, `overflowWrap:'break-word'`, stacks on 360px):
  ```
  -- Plain OCR (no AI) vs Suri (Muse Spark) --
  [small muted: "Plain OCR runs in your browser — no server cost."]
  Per-field grid (div grid, not table):
    full_name:     "MARIA SANTOS DELA CRUZ" | Plain OCR: ✓ found
    date_of_birth: "2008-02-15"            | Plain OCR: ✗ not found
  [Copy OCR text] [Run again] [Hide]
  ┌─────────────────────────────┐
  │ scroll box max-h 180px, overflow:auto, white-space:pre-wrap, font-size 13px
  └─────────────────────────────┘
  ```
  Icons: `✓` `#0a0`, `✗` `#888`; labels `"Plain OCR (no AI)"` vs `"Suri (Muse Spark)"`; not a dashboard. Raw text as `textContent` only, never `dangerouslySetInnerHTML`.
- Phone: button full-width, result stacks, box capped; no modal.
- Worker reuse: one worker per page; `await worker.terminate()` on unmount. Friendly errors: `"Couldn't run plain OCR on this file. PDFs aren't supported."` never raw stack.

## 7. Tests

### 7.1 `tests/ocr-compare.test.js` (new)

- Helper `ocrFoundInText({fieldDef:{type:'name',key:'full_name'}, ocrText, expected})`.
- Names: `Ma.`->`Maria`, `Sto.`->`Santo`, `Sta.`->`Santa`, `Dela Cruz`==`de la Cruz`, accent-only, suffix `Jr.`.
- Dates: all 12 `dateCandidates` forms found (e.g. `2024-03-05`, `05/03/2024`, `5 March 2024`, `Mar 5 2024`, `2024/03/05`) + negative not found.
- Amounts: `normalizeAmount` with `₱`, `PHP`, commas, tokens in noisy OCR; tolerance `<=0.01`.
- Choice: word-boundary `Male` inside `Female` -> false.
- Code: flat comparison for spaced `A B-123` vs `AB123`.
- Text: empty needle/haystack -> false; case/space tolerant.
- Cross-check 2-3 real OCR snippets from `samples/` if available else synthetic noisy blocks.

### 7.2 `tests/csp.test.js` update

- Assert `buildCsp(origin)` contains `"wasm-unsafe-eval"`, `worker-src 'self' blob:`, still `frame-ancestors 'none'`, `img-src data: blob:`, `media-src 'self' blob:`, no bare `'unsafe-eval'`, prod-only, `next.config.mjs` guards `allowedDevOrigins`.

### 7.3 Manual checks

- Act 1: `node --test tests/csp.test.js tests/ocr-compare.test.js` green, `npm run lint`, `npm run build --webpack` pass, `node --env-file=.env.local scripts/eval.mjs --only=birth_certificate --fresh --file=samples/...` unchanged.
- Act 2: `curl -I` dev no CSP, prod preview `... wasm-unsafe-eval ... worker-src ...` no bare `unsafe-eval`; `ls -lh public/tesseract` recorded.
- Act 3: reviewer button -> progress -> per-field ✓/✗ matches eval; raw box scrolls/copies/re-run; PDF 400; 360px+1280px pass.

---

## 8. Files to add / change

**New:**
- `lib/normalize-amount.js` — browser-safe `normalizeAmount` (extracted from `lib/validation.js`)
- `lib/ocr-compare.js` — shared scoring, browser-safe (imports only `lib/normalize-amount.js` + `lib/checks/text.js` + `lib/checks/names.js`)
- `public/tesseract/worker.min.js`, `tesseract-core.wasm.js`, `tesseract-core.wasm`, `lang-data/eng.traineddata.gz` — from pinned npm packages, committed
- `app/api/documents/[id]/image-proxy/route.js` — same-origin proxy, owner-only, PDF 400
- `tests/ocr-compare.test.js` — scoring tests
- `docs/STEP-9E.md` — this plan (Act 1 saves it)
- optional `scripts/copy-tesseract-assets.mjs` — copy helper

**Edit:**
- `scripts/eval.mjs` — delete inline `dateCandidates`/etc, `require("../lib/ocr-compare.js")`
- `lib/validation.js` — remove inline `normalizeAmount`, `require("./normalize-amount.js")` (export unchanged)
- `lib/csp.js` — add `'wasm-unsafe-eval'` to `script-src`, add `worker-src 'self' blob:`
- `tests/csp.test.js` — assert new directives, fix bare-eval check
- `package.json` + `package-lock.json` — move `tesseract.js` devDeps->deps, add `@tesseract.js-data/eng@<pinned>`
- `app/set/[submissionId]/client.js` — `await import("tesseract.js")` on click, `ocrByDoc` state, progress `"Reading with plain OCR... 40%"`, per-field ✓/✗ grid, raw `pre-wrap` scroll box, worker lifecycle, `fetch(image-proxy)`

**No change:** `app/api/documents/[id]/image/route.js` (keep JSON), `next.config.mjs` (uses helper), `lib/checks/names.js`, `lib/checks/text.js` (consumed).

---

## 9. Build order — Acts <~100k (each in fresh task that reads this doc first)

> Every Act starts: read `docs/STEP-9E.md` + files it will touch. Keep `--webpack`. Do not commit; owner commits.

**Act 1 — Shared module + eval wired + CSP + tests (no UI, no assets):**
1. Read `docs/STEP-9E.md` §0-§1, §4, §7.
2. Create `lib/normalize-amount.js` (pure, browser-safe).
3. Edit `lib/validation.js` to import it (remove inline def, keep export).
4. Create `lib/ocr-compare.js` (pure, browser-safe, only imports `lib/normalize-amount.js` + `lib/checks/text.js` + `lib/checks/names.js`).
5. Edit `scripts/eval.mjs` to require/use it; smoke `--fresh --file=<one-manifest-entry>` numbers match.
6. Edit `lib/csp.js` + `tests/csp.test.js` (new directives, fix bare-eval check).
7. Add `tests/ocr-compare.test.js`.
8. Run `node --test tests/csp.test.js tests/ocr-compare.test.js`, `npm run lint`, `npm run build --webpack`; verify no `server-only`/`fs` warnings.
Done when: tests green, eval unchanged, build pass.

**Act 2 — Dependency move + self-hosted assets + image-proxy route:**
1. Read `docs/STEP-9E.md` §0, §2, §3, §5.
2. Edit `package.json`: move `tesseract.js` to deps, add `@tesseract.js-data/eng@<exact-pinned>` to deps; `npm install`; verify lock.
3. Inspect `node_modules/tesseract.js/dist`, `node_modules/tesseract.js-core`, `node_modules/@tesseract.js-data/eng`; copy via `scripts/copy-tesseract-assets.mjs` (or cp) into `public/tesseract/` + `public/tesseract/lang-data/`.
4. Run `ls -lh`/`wc -c`/`Get-FileHash` on each copied file; fill §3 table + licenses (Apache-2.0) for README.
5. Add `app/api/documents/[id]/image-proxy/route.js` (auth + signedUrl fetch + pipe, PDF 400).
6. Test proxy (valid doc 200, unknown 404, PDF 400) and `curl -I` CSP shows new directives.
Done when: `package.json` correct, `public/tesseract/*` committed with real sizes/licenses, proxy works.

**Act 3 — Reviewer UI:**
1. Read `docs/STEP-9E.md` §0, §1.4, §2, §5, §6.
2. Edit `app/set/[submissionId]/client.js`: nothing at top for Tesseract; inside click `await import("tesseract.js")`, singleton worker, `ocrByDoc` state, progress text, per-field grid via `ocrFoundInText`, raw `pre-wrap` scroll box (max-h 180px), copy/run-again/hide, friendly PDF error, cleanup, `fetch(image-proxy)`.
3. Labels literally `"Plain OCR (no AI)"` vs `"Suri (Muse Spark)"`; plain-text only; 360px stack.
4. Keep `--webpack`; `npm run build --webpack`, manual 360px+1280px on dev + preview; reviewer flow still works.
Done when: button only in Reviewer, runs only on click, shows progress, per-field ✓/✗ matches eval, raw box scrolls/copies, no server model call.

---

*End — stop after saving this file; owner commits.*

