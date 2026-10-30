# Suri Step 9D — Auto-delete demo uploads after 7 days

Status: done (Oct 30)

Approved plan — one Act on branch `step-9-autodelete`.

## Goal
Delete demo uploads, their DB rows, orphaned anonymous users, and old rate-limit counters after 7 days. Show only counts, never content. Testable without waiting 7 days.

## How — Vercel Cron (Hobby)
- **File:** `vercel.json` with `regions:["sin1"]` + `crons:[{ path:"/api/cron/cleanup", schedule:"0 3 * * *" }]` = daily 03:00 UTC. Hobby allows once/day; `sin1` keeps latency low.
- **Route:** `GET /api/cron/cleanup` in `app/api/cron/cleanup/route.js` (`server-only`, `maxDuration=60`). Protected by `CRON_SECRET` env var. Vercel sends `Authorization: Bearer <CRON_SECRET>` for crons automatically when the env exists. Anything else → `401 {error:"Unauthorized"}`. No secret in client code, never `NEXT_PUBLIC_`.
- **Env:** `CRON_SECRET=` added to `.env.example` (empty value). Real value only in `.env.local` + Vercel Production + Preview. Listed in `docs/STACK.md` Secrets.
- **Note:** Vercel crons run only on **production** deployments. On preview/test we call the route manually with the secret (`curl -H "Authorization: Bearer $CRON_SECRET" https://<preview>/api/cron/cleanup?dry=1`).

## Job steps (batched, storage first)
1. **Cutoff:** `cutoff = now - days*24h`, `days=7` default. `days` query param honored **only in dry-run** (`?dry=1&days=N`). When not dry, `days` is ignored (always 7) so `?days=0` cannot wipe prod. Clamped integer 0…365; invalid → 400.
2. **Submissions + storage (max 200 per run):**
   - Find `submissions` where `created_at < cutoffISO` ordered asc limit 200.
   - For those ids, `documents.storage_path` via `in('submission_id', ids)` → `paths`. Bucket is private `uploads`, path format `userId/submissionId/documentId.ext` (from `app/api/upload/route.js`).
   - **Dry:** count only → `wouldDelete`, `wouldRemove`.
   - **Live:** `admin.storage.from('uploads').remove(paths)` in batches of 100 **first**, then `admin.from('submissions').delete().in('id', ids)`. Storage-first avoids orphan files if DB delete fails; storage errors counted but do not stop DB delete. Cascades (from `0001_*` + `0004` + `0006`):
     - `documents.submission_id ON DELETE CASCADE`
     - `extracted_fields.document_id ON DELETE CASCADE`
     - `check_results.document_id ON DELETE CASCADE` (`compared_document_id SET NULL`)
     - `work_log.submission_id ON DELETE CASCADE`
     - `clarifications.submission_id ON DELETE CASCADE` (`check_result_id SET NULL`)
     - `review_actions.document_id ON DELETE CASCADE`
3. **Anonymous users (and their profiles / saved_processes):**
   - List `auth.users` via `admin.auth.admin.listUsers` paginated 100/page.
   - Delete only if **all**: `user.created_at < cutoff` **and** `no submissions` (`select id eq user_id limit 1` empty) **and** `no saved_processes newer than cutoff` (`select id eq user_id gt created_at cutoff limit 1` empty). This respects the approved change: a visitor who drafted a saved process yesterday keeps their account even if old user row.
   - `admin.auth.admin.deleteUser(id)` cascades `profiles.user_id` and `saved_processes.user_id` (`ON DELETE CASCADE` to `auth.users`).
4. **Counters:** `usage_counters` has no FK. `select key lt window_start cutoff` → count, then `delete lt window_start` if not dry. Returned as `countersFound/Deleted`.
5. **Response:** `{ok,dryRun,days,cutoff, submissions:{found,documents,deleted,wouldDelete,wouldRemove,storageRemoved,storageErrors}, users:{found,deleted,wouldDelete,checked}, counters:{...}, durationMs}`. No document text, hashes, or paths echoed.

## Does anything NOT cascade? Orphans?
- **Cascades on submissions delete:** documents, extracted_fields, check_results, work_log, clarifications, review_actions — all cleaned.
- **Does NOT cascade:** `profiles`, `saved_processes` (FK to `auth.users`, not submissions), `auth.users` itself, `usage_counters` (no FK). Those are why steps 3 and 4 exist. After all three steps no orphans remain; `compared_document_id SET NULL` leaves no FK violation.

## Risk of deleting <7 days?
- No. `created_at < cutoff` strict `<` UTC, never `<=`. Submissions are selected by their own `created_at`, not documents’. User deletion requires `created_at < cutoff` **and** zero submissions **and** zero recent saved_processes. Counters use `window_start < cutoff`. Days override is ignored outside dry-run.

## Testing without waiting 7 days (preview)
- Dry count default: `GET /api/cron/cleanup?dry=1` → counts for 7-day cutoff.
- Dry with override: `GET /api/cron/cleanup?dry=1&days=0` → “delete everything now” count; `days=1` → “1-day cutoff”. Only works with `dry=1`.
- Real delete of fresh data: back-date a test row `update submissions set created_at=now()-'8 days' where id='…'` then live run `GET /api/cron/cleanup` (no dry) with secret; verify `submissions_..._deleted=1` and storage gone.

## Files
- **NEW** `app/api/cron/cleanup/route.js` + helper `lib/cleanup.js` (storage-first, batch 200, dry-run, 401, counts-only)
- **NEW** `vercel.json` (crons + sin1)
- **NEW** `tests/cleanup.test.js` (fake admin: 401, dry-run counts, days ignored when not dry, saved_process newer blocks delete, storage before rows)
- **EDIT** `.env.example` add `CRON_SECRET=`
- **EDIT** `docs/STACK.md` add Cron secret row, note crons prod-only

## Build order (single Act)
This Act creates all above, runs `node --test tests/*.test.js` and `npm run build`, no commit.
