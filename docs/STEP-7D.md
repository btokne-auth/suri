# Step 7d — setup honesty (approved plan with corrections)

## Problem
- check if my papers are complete -> invented Submitted Papers 0 checks
- Valid ID only. At least 18 -> dropped age rule 0 checks
- Violates promise never guess when unsure ask
## Goal (only this)
- Draft gets two new optional fields leniently: not_checked (0..5 each trimmed/empty dropped/cut 160 first5) and needs_more_info (>200 cut <10 or missing -> DEFAULT). Neither ever fails.
- Server rule in ONE place honestyCheck(draft) from lib/processes/draft-schema.js: 0 checks AND not_checked empty -> top-level needs_more_info (model q if valid else DEFAULT). No checklist. If checks exist ignore needs_more_info.
- /setup: needs_more_info top-level shows question no checklist no Confirm. not_checked non-empty shows box above Confirm: "Suri can't check these yet. A person will need to:" + list. Plain only.
- Saving keeps not_checked inside definition jsonb no migration. Missing/malformed -> [] never null.
- Checklist+reviewer shows not_checked under "Check by hand" (2 files).
- Tests for rule including invented doc case. Run node --test.

## Corrections applied
1. Honesty rule in ONE place: honestyCheck(draft) from lib/processes/draft-schema.js, both draft and confirm import — no duplication.
2. Lenient: not_checked trimmed/empty dropped/cut160/first5, needs_more_info >200 cut/<10 or missing -> DEFAULT. Neither causes validateDraft fail.
3. needs_more_info only top-level {needs_more_info, attempts}. If draft has checks ignore inside. No j.draft.needs_more_info fallback.
4. validateSavedDefinition missing/malformed not_checked -> [] never null.
5. Extra test: invented doc +0 checks +empty not_checked -> needs_more_info.


## Storage — no migration
- supabase/migrations/0004_saved_processes.sql creates saved_processes with definition jsonb NOT NULL.
- Current definition: {id,label,documents:[ids],docDefs,checks,requirement,needs_profile}.
- Adding not_checked string[] inside jsonb needs no ALTER/RLS/GRANT. validateSavedDefinition sanitizes on read.
- Verdict: no migration.

## File inventory
- lib/processes/draft-schema.js, lib/processes/describe.js, lib/processes/resolve.js, app/api/setup/draft/route.js, app/api/setup/confirm/route.js, app/setup/client.js, app/api/submissions/[id]/route.js, app/set/[submissionId]/client.js, tests files.


## Changes per file
### 1 lib/processes/draft-schema.js
- Add DEFAULT_NEEDS_MORE_INFO, LIMITS.NOT_CHECKED_MAX=5 etc.
- Add sanitizeNotChecked(v) and sanitizeNeedsMoreInfo(v) helpers.
- Lenient schemas via z.preprocess(v=>sanitize(...), inner optional) so never fail.
- Extend draftSchema strict with not_checked and needs_more_info optional.
- Add honestyCheck(draft) single source, export it.

### 2 app/api/setup/draft/route.js
- Import honestyCheck.
- Extend SYSTEM_PROMPT with not_checked and needs_more_info instructions + allowed keys.
- After validate+compat, call honestyCheck; if truthy return {needs_more_info, attempts} top-level no draft.

### 3 lib/processes/resolve.js
- Sanitize not_checked leniently (trim/empty/cut/first5) never null. Missing -> [].
- Build draft for validation with sanitized not_checked. Return includes not_checked.

### 4 app/api/setup/confirm/route.js
- Import honestyCheck. After shaped+compat, if honestyCheck(draft) return 400 with needs_more_info (defensive). Store not_checked sanitized in definition.

### 5 lib/processes/describe.js
- Passthrough not_checked/needs_more_info in returned view.

### 6 app/setup/client.js
- State needsMoreInfo. build() checks j.needs_more_info top-level first, sets draft null, no fallback to j.draft.needs_more_info.
- Render needsMoreInfo box when present, no checklist/Confirm. When draft and not_checked non-empty show box above Confirm.

### 7 app/api/submissions/[id]/route.js
- Expose not_checked in process payload.

### 8 app/set/[submissionId]/client.js
- Render Check by hand section below rows if notChecked.length>0, plain styling, visible applicant+reviewer (one file). Exactly 2 files for point6.

### 9 tests/setup-honesty.test.js (new)
- Cases: sanitize trims/drops/cuts/first5, validateDraft with 6 items->5 ok, 200char->160 ok, empty dropped, needs_more_info 300->200 ok, hi->DEFAULT, honesty 0+empty->needs_more_info, 0+non-empty->null, checks present->null even if needs_more_info, invented doc 0+empty->needs_more_info, age18 0+non-empty->allowed, validateSavedDefinition missing/malformed->[].

Verification: node --test tests/*.test.js, npm run build --webpack, manual draft posts, git diff/status. No commit.


