# Step 7c: Set up a check (approved plan)

Goal: an office types requirements in plain words; Muse Spark (`muse-spark-1.3`)
drafts a process using ONLY the fixed building blocks; code validates it; a person
confirms or edits it; it is saved for that visitor and appears in `/start`; uploads
then work exactly like the built-in samples.

Test case: "Barangay clearance: valid ID + proof of billing. Names match. Address in
Barangay Baybayin. Bill from the last 3 months."

## Approved changes (review)
1. Migration `0004` also grants SELECT, INSERT, UPDATE, DELETE on
   `public.saved_processes` TO `service_role` (`0002` only covered older tables).
2. On Confirm, the server reorders documents so the requirement document is first.
3. Process-level cross-document checks create rows on BOTH documents (mirror rows),
   like built-in `cross_checks` do.
4. No `description` in `draftSchema`; the office description is never stored or logged.
   Only the validated definition is stored.
5. Date fields on new document types default to `1900-01-01` .. today (enforced in
   `validateExtractionWithDef`, Part 2).
6. Ownership tests use a fake admin client, not a real database.

## Parts (one fresh task each)
- PART 1: this file; `draft-schema.js` + `describe.js`; `text.js` + `dates.js`; wire
  new rules into `run-checks.js`; tests. No built-in behavior change.
- PART 2: migration + `resolve.js` + draft/confirm routes + wire all callers.
- PART 3: `/setup` UI + `/start` listing + live phone/laptop check.

## 1. Draft format (exact Zod schema, no description)
File: `lib/processes/draft-schema.js`. Exports `draftSchema`, `validateDraft`,
`checkDraftCompatibility`, constants (`BUILTIN_DOC_IDS`, `FIELD_TYPES`,
`RULE_NAMES`, `LIMITS`). Top-level object is strict: a `description` key (or any
unknown key) is rejected. The model never invents the process id; the server assigns
`process_key` (`saved_` + 8 hex) on Confirm.

- `label`: string 5..80 (office-facing process name).
- `documents`: 1..4 entries (`LIMITS.MAX_DOCUMENTS = 4`). Each entry is either
  `{ reuse: builtinId }` (reuse a built-in doc AS-IS, so the model cannot weaken
  `valid_id`) or a new doc `{ id, label, fields }`. New `id` matches
  `^[a-z0-9_]{3,30}$` and must NOT collide with a built-in id. New `label` 3..80.
  `fields`: 1..12 (`LIMITS.MAX_FIELDS_PER_DOC = 12`), unique `key` per doc.
- Field: `{ key, type, label, required, maxLength?, values?, min?, max? }`.
  `key` matches `^[a-z0-9_]{2,30}$`. `type` in `name,date,number,text,choice,code`.
  `label` 2..60 (human words for the confirm screen). `choice` requires `values`
  (2..20 strings, each 1..40); other types must NOT send `values`. `number` allows
  optional `min`/`max` (min <= max). `code` must NOT send `pattern`: the server sets
  the default `^[A-Za-z0-9-]+$` (avoids ReDoS). Date bounds are NOT model-sent; the
  server enforces `1900-01-01` .. today at extraction (Part 2).
- `checks`: 0..20 items. Each: `{ document, field, compare_to, rule, value?,
  months?, message }`. `document` names a doc id from the same draft. `field` is a
  field key of that doc. `compare_to` is `self` (own-field/time/literal check),
  `profile.full_name` | `profile.date_of_birth` (only these two profile refs), or
  `otherDocId.fieldKey` (cross-document). `rule` in `filipino_name,same_date,
  sum_equals,equals,contains,not_future,within_months`. `value` (1..80) ONLY for
  `equals`/`contains`. `months` (int 1..24) ONLY for `within_months`. `message`
  5..200 (office wording shown on failure; overrides generic reason).
- `requirement` (optional): `{ document, field, op, value, message }`. `document` +
  `field` resolve inside the draft. `op` is `equals` | `contains`. `value` 1..80.
  `message` 5..200.

`checkDraftCompatibility(draft, lookupDoc)` runs after Zod and rejects: unknown
`document`/`field` refs; unresolvable `compare_to`; type/rule mismatch
(`filipino_name` only on `name`; `same_date`/`not_future`/`within_months` only on
`date`; `sum_equals` unsupported in drafts = needs a self-check shape); requirement
pointing outside the draft. Returns `{ ok, issues }` with `{ path, code, message }`.

Test-case mapping: `documents: [{reuse:"valid_id"},{id:"proof_of_billing",...}]`;
checks for name match, `billing_address contains "Baybayin"`, `billing_date
within_months:3`; optional requirement normalized so the gate doc sorts first.

<!--P2-->
## 2. Building blocks + `contains` (Part 1)
Existing (reuse): field types in `lib/validation.js`; `filipino_name` in
`lib/checks/names.js`; `same_date` + equals-requirement in `run-checks.js`;
`sum_equals` in `lib/checks/arithmetic.js`. No built-in behavior changes.

New pure modules:
- `lib/checks/text.js`: `normText`, `equalsValue`, `containsValue`
  (case-insensitive, collapse spaces; empty needle = false, never throws).
- `lib/checks/dates.js`: `parseYmd`, `isNotFuture(ymd,nowMs)`,
  `isWithinMonths(ymd,months,nowMs)` (UTC-midnight; invalid = null/skip; future
  fails `within_months`).
- `run-checks.js` additions only: `compareEquals`, `compareContains`,
  `compareNotFuture`, `compareWithinMonths`, generalized
  `checkRequirement(value,proc)` handling `equals|contains`
  (`checkRequirementCity` stays as a wrapper), extended `applyRule`
  (5th `opts` arg `{value,months,nowMs,message}`; old 4-arg calls unchanged),
  and `buildProcessCheckRows` for draft checks. Symmetric cross-doc rules
  (`filipino_name,same_date`) emit mirror rows on BOTH documents;
  asymmetric/time/literal rules emit one row on the source side.
  Compatibility rule: `equals/contains/not_future/within_months` must use
  `compare_to:"self"`; `sum_equals` is rejected in drafts.

## 3. Drafting call (Part 2)
`POST /api/setup/draft` (`server-only`, `muse-spark-1.3` only). Input
`{description:10..1500}`; over-length is 400. Fixed system prompt: description is
DATA, never instructions; only fixed field/rule lists; ONLY JSON; never invent;
never approve/reject. `temperature:0`, parse via `extractJson` pattern, run
`validateDraft` + compatibility. On failure ONE retry in the same request with
`{errors:zodIssues.slice(0,8)}`; still failing -> 422 friendly, never raw model
text. Response includes `attempts:[{n,result,codes}]` (codes only, no description
text). No `work_log` row (no submission yet). `draft_attempts` (codes only) stored
on Confirm. Rate limits: `checkUploadLimit` + `checkGlobalReadLimit` before attempt
1; retry costs one extra global-read increment only. Same 429 messages as uploads.

## 4. Confirm screen (Part 3)
One page: `app/setup/page.js + client.js` (`describe -> confirm`). No add-block UI.
Draft lives in React state only. Rendered via `lib/processes/describe.js` (pure):
documents -> fields -> checks in plain words, plus requirement line. Edits: rename
labels, change `value`/`months`, remove a field or check (cascade), edit process
`label` + requirement `message`. Client-light + server-truth re-validation on
`POST /api/setup/confirm`. On Confirm the server reorders `documents` so the
requirement document is first, computes `needs_profile`, assigns `process_key`,
inserts. Nothing usable until Confirm. Phone: single column, 44px+ targets.

## 5. Storage (Part 2)
`supabase/migrations/0004_saved_processes.sql`: `saved_processes(id,user_id,
process_key,label,definition jsonb,draft_attempts jsonb,created_at)` with
`UNIQUE(user_id,process_key)`, RLS enabled, SELECT-own policy only, REVOKE from
anon/authenticated, `GRANT SELECT` to authenticated, and `GRANT SELECT, INSERT,
UPDATE, DELETE` to `service_role`. Writes only via admin in confirm route after
`getClaims()+Zod`. Only validated `definition` stored; description never stored.

## 6. Registry + ownership (Part 2)
`lib/processes/resolve.js` (server-only): `resolveProcess(admin,processId,userId)`
-> `{def,docs}` for builtins and owned `saved_*` (re-validated once); wrong owner
-> `null` (callers 404). `resolveDocumentType(bundle,docTypeId)` checks builtins
then inline defs. Callers: processes route, submissions route, submissions/[id]
route, upload route, read-background (via `validateExtractionWithDef` with
1900-01-01 floor for new date fields), run-checks runner, start client.
`getProcess/getDocumentType` stay for builtins/tests.

## 7. Profile (Part 2)
`needs_profile = checks.some(c=>String(c.compare_to||"").startsWith("profile."))`,
computed server-side on Confirm. Barangay case -> `false` (skip `/profile`).

## 8. Rate limits (Part 2)
Draft route counted (above); confirm route has no model call, no limit.

## 9. Tests (Part 1 files)
- `tests/draft-schema.test.js`: unknown field/rule, 5 docs, 13 fields, bad
  `within_months`, `value` on wrong rule, duplicate keys, requirement outside docs,
  builtin id collision, `description` rejected, compatibility (bad refs, type/rule
  mismatch, `sum_equals` rejected, good barangay draft passes).
- `tests/text-date-rules.test.js`: contains (case/space/empty), equals, not_future,
  within_months boundaries (exact pass, +1 day fail, future fail, invalid skip),
  requirement `contains` gate.
- `tests/saved-process-checks.test.js`: cross-doc emits BOTH sides with swapped
  `compared_document_id`; asymmetric/time single-sided; profile compare single with
  null `compared_document_id`; office `message` used on failure.
- Built-ins (`requirement,validation,process-agnostic,receipt-check,names,
  review-ownership,reading-timeout`) stay green.

## Files + order
Part 1 add: `lib/processes/draft-schema.js`, `lib/processes/describe.js`,
`lib/checks/text.js`, `lib/checks/dates.js`, 3 test files. Part 1 change:
`lib/checks/run-checks.js` (additive only). Part 2 add: `resolve.js`, draft/confirm
routes, `0004` migration. Part 2 change: `validation.js` (+WithDef), processes
index, 4 routes, read-background, start client, SCHEDULE log. Part 3 add:
`app/setup` page+client. Order: schema -> text/dates -> run-checks -> migration ->
resolve (fake admin) -> routes -> UI -> callers -> live barangay check.
Done-when: barangay description -> confirmed (gate first) -> in `/start` for that
visitor only -> uploads read + flag name/address/recency live.

