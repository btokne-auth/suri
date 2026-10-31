# Suri Step 9F — Retry before retake (retry `retake_needed` once)

> **Branch:** `retry-before-retake` · **Status:** plan — approved with two corrections (Act will implement)  
> **Read before Act:** `docs/SUMMARY.md`, "Where we are now" in `docs/SCHEDULE.md`, then this file.

> **Goal (strict, nothing else):** If first `decideUsability` after upload is `retake_needed`, keep status `reading`, log one `reading_retry` ("Reading again to double-check."), read same file once more, decide again. Only if second is also `retake_needed`, persist it with second reason. If second is usable, continue normal path (`needs_review` -> `reading_finished` -> checks). Never more than one extra read. `wrong_document` and reading failures behave as today (no retry) except correction #1.

## Corrections approved

1. **If second (retry) read throws/fails, do NOT go to `error`.** Keep first attempt's `retake_needed` result — its `extracted_fields`, `looks_like`, `quality_problems`, `reason` — and log `retake_needed` as normal.

2. **Second read's `extracted_fields` must replace first read's (same upsert key) — no duplicate rows.** Uses `upsert(..., { onConflict: 'document_id,field_key' })`; second upsert overwrites first.

## 1. Current state

### 1.1 `lib/read-background.js` today
- Sets `reading`, logs `reading_started`, resolves bundle/def, downloads buf, single `readDocumentBytes*` -> `validateExtraction*` -> upsert `extracted_fields` -> `decideUsability` -> update `documents` to `next` + log (`wrong_document`/`retake_needed`/`reading_finished` + `runChecksForDocument`).
- Any throw -> `status=error`, `reading_failed`. No retry.

### 1.2 `lib/decide-usability.js`
- `wrong_document` first (strict known id, not "other"), then `retake_needed` (`usable===false` OR `unreadableRequired >= ceil(required/2)`), then `needs_review`. `retakeReason` priority blurry>dark>glare>cut_off>angle.

### 1.3 `lib/reader.js` — no temperature/sampling
- Sends only `{ model, messages }` — no `temperature`/`top_p`/`max_tokens`/`reasoning_effort`. Defaults apply. **Goal 5 answer.**

### 1.4 `lib/rate-limit.js` + `app/api/upload/route.js`
- Upload increments `reads:global:<day>` once via `checkGlobalReadLimit`; `read-background.js` never calls rate-limit. Retry adds 0 to counters by default.
- Constants: 10/h visitor, 200/day global, 60/h IP, 10/h slot, 20/h answers.

### 1.5 `app/set/[submissionId]/client.js` today
- `workLogSentence`/`logDotColor` only handle `upload`/`reading_*`/`check_finished`/`clarification_*`/`review`; else fallback.

## 2. Design

### 2.1 `lib/read-background.js` retry

Insert between first `decideUsability` and documents update:

```js
let usability = decideUsability({...});
let next = usability.status;
let checkedActive = checked;
let rowsActive = rows;

if (next === 'retake_needed') {
  await log('reading_retry', 'Reading again to double-check.'.slice(0,200));
  let out2 = null; let checked2 = null;
  try {
    out2 = bundle && useFloor ? await readDocumentBytesWithDef(def, buf, mime, allowedIds) : await readDocumentBytes(docType, buf, mime, allowedIds);
    checked2 = bundle && useFloor ? validateExtractionWithDef(def, out2, { dateFloor:'1900-01-01', allowedDocIds: allowedIds }) : validateExtraction(docType, out2, { allowedDocIds: allowedIds });
  } catch { /* correction #1: keep first retake, do not go to error */ }
  if (checked2) {
    const rows2 = []; for (const f of def.fields) { /* map checked2.fields same as first */ }
    if (rows2.length>0) await admin.from('extracted_fields').upsert(rows2, { onConflict: 'document_id,field_key' }); // correction #2
    const usability2 = decideUsability({ def, bundle, expectedDocTypeId: docType, fields: checked2.fields, quality: checked2.quality, documentMatch: checked2.documentMatch, allowedIds });
    usability = usability2; next = usability2.status; checkedActive = checked2; rowsActive = rows2;
  }
}
// existing update documents to next + log + run checks if needs_review
```

Rules: only on `retake_needed`; `wrong_document` no retry; first-throw -> error as today; second-throw -> keep first retake (correction #1); second `retake_needed` uses second reason; second `needs_review`/`wrong_document` follows normal branch; keep `reading` during retry; one extra read max.

### 2.2 Time limits — numbers

| Limit | Value | Source |
|---|---|---|
| `maxDuration` upload route | **60s** | `app/api/upload/route.js:18` |
| Stale-reading timeout | **2 min = 120000ms** | `lib/reading-timeout.js:15` |
| Avg Meta read | **5.8s** over 25 docs | `docs/SCORECARD.md` |
| Two reads total | ~12s typical, ~15-35s worst + checks | estimate |

Retry fits inside 60s (`after()` same invocation); Vercel kill -> stale fallback `error` after 2 min. No `maxDuration` bump needed.

### 2.3 Rate limits

Extra read counts toward no limit today (`read-background.js` never increments). Recommendation: **do NOT count retry** toward 200/day global or per-visitor/IP/slot — user already paid cost at upload; retry is resilience, bounded at +1/doc. No change to `lib/rate-limit.js` unless approved.

### 2.4 Client work log

Edit `workLogSentence` + `logDotColor` in `app/set/[submissionId]/client.js`; keep fallback for unknown.

| step_type | sentence | dot color |
|---|---|---|
| `reading_retry` | `Reading again to double-check · <doc>` | `var(--accent)` |
| `retake_needed` | `Asked for a clearer photo · <doc>` | `var(--mismatch)` |
| `wrong_document` | `Looks like a different document · <doc>` | `var(--mismatch)` |
| `reading_failed` | `Couldn't finish reading · <doc>` | `var(--mismatch)` |
| `requirement_check` | use `message`; passed->match else mismatch | by content |
| `requirement_override` | `A reviewer overrode the requirement` | `var(--check)` |
| `check_failed` | `A check couldn't run` | `var(--check)` |
| `clarification_failed` / `clarification_skipped_cap` | `Suri skipped a question` | `var(--text-3)` neutral |
| `review_approve`/`review_reject`/`review_correct` | `A reviewer approved/rejected/corrected · <doc>` | match/mismatch/check |
| `check_finished` etc. | keep existing | keep |
| fallback | `Suri updated your checklist.` | `var(--text-3)` |

### 2.5 Reader temperature

No field set — defaults (see 1.3).

### 2.6 Tests `tests/retry-before-retake.test.js` (mock reader)

1. retake->usable = ready path (one retry log, needs_review, second fields in DB)
2. retake->retake = retake_needed (second reason, no duplicate rows)
3. usable first = no extra read
4. wrong_document = no retry
5. retake->retry throw keeps first retake (correction #1, not error)
6. no duplicate extracted_fields rows after retry (correction #2, unique on document_id+field_key)

## 3. Files to change (small, targeted, never recreate)

- **Edit:** `lib/read-background.js` — retry branch with correction #1 + #2
- **Edit:** `app/set/[submissionId]/client.js` — sentences + dot colors per 2.4
- **No change:** `lib/decide-usability.js`, `lib/reader.js`, `lib/rate-limit.js`, `docs/DESIGN.md`, `docs/SCOPE.md`, `docs/mockups/`, `scripts/eval.mjs`, no new packages, keep `--webpack`
- **New tests only:** `tests/retry-before-retake.test.js` (6 cases)

## 4. Build order

1. This file (done)
2. `lib/read-background.js` edit
3. `app/set/[submissionId]/client.js` edit
4. `tests/retry-before-retake.test.js`
5. `node --test tests/retry-before-retake.test.js`, `npm run lint`, `npm run build --webpack`, 360px+1280px check

## 5. Invariants

- AI never approves/rejects, only reads flags; person decides. Document text is data. Schema validation before save. Upload returns fast; reading in `after()`. Results in checklist only. No new dashboard. No `.env` read, no commit by agent, keep `--webpack`.

*End plan — Act will implement after this save.*

