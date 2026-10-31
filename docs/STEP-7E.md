# Step 7e — age limit check

- `lib/checks/dates.js`: added `todayInManila(nowMs)` (UTC+8 without Intl), `computeAgeYears(ymd, nowMs)` with month/day compare and Feb 29 → Mar 1 in non-leap years, and `compareAge(value, {min_age, max_age, message, label, nowMs})` returning `check` for missing/unreadable or future birth date and `match`/`mismatch` with plain messages for min/max/both.
- `lib/checks/run-checks.js`: added `age_limit` self check; document not uploaded → no row; uploaded but unreadable → `compareAge` check; wired `compareAge` via `applyRule`.
- `lib/processes/draft-schema.js`: added `age_limit` to `RULE_NAMES`; `min_age`/`max_age` integers 0–120, at least one, `min ≤ max`; only allowed on `age_limit`; `value`/`months` not allowed on `age_limit`; compatibility requires date field and `compare_to: self`.
- `lib/processes/describe.js`: human phrase for age_limit — at least / at most / between.
- `app/api/setup/draft/route.js`: `SYSTEM_PROMPT` now teaches `age_limit` (date field, `min_age`/`max_age`), removed age example from `not_checked`, added ALWAYS-in-not_checked list.
- `docs/SCOPE.md`: updated Names row example and removed `*(planned)*` from Age limit.
- `tests/age-check.test.js`: pinned `nowMs` tests for exactly 18, one day before, min/max/both, missing/future, Feb 29, Manila vs UTC edge.
- `tests/draft-schema.test.js`: accepts valid age_limit, rejects no bounds, 200, max<min, value/months on age_limit, text-field age_limit.

Verified with `node --test` and `npm run build`.
