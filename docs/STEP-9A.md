# Suri Step 9A — Photo quality (retake) + Wrong-document check (Act A)

Saved: Oct 30, 2026 (Manila). Day 4, step 9. Frozen plan for Act A.

## Goal
Before any checks run, Suri decides whether upload is usable in same single call.
- Retake: blurry/dark/glare/cut_off/angle or most required fields unreadable → status retake_needed, action retake.
- Wrong document: clearly different doc than slot expects → status wrong_document, action wrong document. Requirement + checks NOT run.
- Same single call, code decides, no free text from model shown.
- Must work for builtins AND saved processes.
- Work log entries, reviewer can override.
- Samples: blur.png for retake; report card PNG in birth_certificate slot for wrong doc.
- Eval: retake = asked for retake, keep denominator (change #3).
- Tests for decision rules.

## Approved changes vs draft
1. Migration = 0005_quality_wrongdoc.sql adds wrong_document status + looks_like text + quality_problems text[] (only validated enums stored), service_role grant like 0004. User runs SQL.
2. Wrong doc ONLY when matches_expected=false AND looks_like is different KNOWN id. other never wrong → falls to retake rule.
3. Eval keeps denominator; report correct / asked for retake / wrong value + errors.
4. Two Acts: A = plan + migration + validation + decide-usability + reader + read-background. B = routes/UI/review/run-checks/eval/docs.
5. Banner Day 4 Oct 30 step 9.

## 1. Schema change (single call)
Current: { document_type, fields }
New:
```json
{
  "document_type": "<expectedId> | other | unreadable",
  "quality": { "usable": boolean, "problems": ["blurry","dark","glare","cut_off","angle"] },
  "document_match": { "matches_expected": boolean, "looks_like": "<enum + other>" },
  "fields": { ... }
}
```
- quality.problems unique max5 default [].
- looks_like enum = known ids for process + other. Prompt interpolates live list.
- Prompt: usable=false when quality issue makes >=half required unreadable; problems lists enums; matches_expected false when clearly different doc; looks_like closest from [allowed+other].
- Strict Zod validation; bad shape → issues; missing blocks default usable:true / null (backward compat).
- Only validated enums stored.

## 2. Code-decides rules (lib/decide-usability.js)
Order: wrong_document first, then retake, then normal.

Wrong document:
- true only if matches_expected===false && looks_like !== 'other' && looks_like !== expected && known.has(looks_like)
- reason: "This looks like a <LooksLabel>, not a <ExpectedLabel>."

Retake:
- true if quality.usable===false OR unreadableRequired >= ceil(required/2)
- reason via priority blurry>dark>glare>cut_off>angle else "We couldn't read most fields. Please retake the photo in better light."
- retake never sets requirement_not_met.

Otherwise needs_review → checks.

Requirement gate already excludes non needs_review/approved; new statuses stay excluded.

## 3. Files to change
- lib/reader.js: buildUserPrompt(docType, allowedIds) adds blocks; readDocumentBytesWithDef forwards allowedIds.
- lib/validation.js: QUALITY_PROBLEMS, qualitySchema, buildDocumentMatchSchema, extend validateExtraction* to return quality/documentMatch.
- NEW lib/decide-usability.js: pure isWrongDocument, isRetakeNeeded, retakeReason, wrongDocumentReason, decideUsability.
- lib/read-background.js: after validation call decideUsability; branch to wrong_document / retake_needed / needs_review + columns.
- lib/documents/index.js: allDocumentIds helper.
- supabase/migrations/0005_quality_wrongdoc.sql: CHECK + columns + grants.
- Tests: decide-usability.test.js + validation.test.js extension.
- Act B: reading-timeout, routes, UI, review, run-checks, eval, docs.

## 4. Build order Act A
1. This file.
2. Migration 0005.
3. validation + decide-usability + tests.
4. reader + read-background.
5. node --test + npm run build.

## 5. Build order Act B
Routes/UI/review/run-checks/eval/docs + live verify.

## 6. Invariants
Single call, strict enums, no free text, saved processes via bundle.docs keys, work log, reviewer override, keep --webpack, never log doc text.
