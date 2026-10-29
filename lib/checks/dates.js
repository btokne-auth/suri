// lib/checks/dates.js
//
// Step 7c Part 1: pure date rules (not_future, within_months).
// UTC-midnight compare so tests can pin "today" via nowMs.
// Invalid input returns null (= skip); extraction validation owns bad dates.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseYmd(ymd) {
  if (typeof ymd !== "string" || !DATE_RE.test(ymd)) return null;
  const y = Number(ymd.slice(0, 4));
  const mo = Number(ymd.slice(5, 7));
  const d = Number(ymd.slice(8, 10));
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const ms = Date.UTC(y, mo - 1, d);
  const dt = new Date(ms);
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return ms;
}

function todayUtcMs(nowMs) {
  const n = typeof nowMs === "number" ? new Date(nowMs) : new Date();
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
}

// null = skip (bad date), true = ok, false = in the future.
function isNotFuture(ymd, nowMs) {
  const t = parseYmd(ymd);
  if (t === null) return null;
  return t <= todayUtcMs(nowMs);
}

// True when ymd is within the last `months` calendar months including today.
// A future date is false (not within the past). Invalid input is null (skip).
function isWithinMonths(ymd, months, nowMs) {
  const t = parseYmd(ymd);
  if (t === null) return null;
  if (!Number.isInteger(months) || months < 1 || months > 24) return null;
  const today = todayUtcMs(nowMs);
  if (t > today) return false;
  const n = typeof nowMs === "number" ? new Date(nowMs) : new Date();
  let y = n.getUTCFullYear();
  let mo = n.getUTCMonth() - months;
  while (mo < 0) {
    mo += 12;
    y -= 1;
  }
  const dim = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  const cutoff = Date.UTC(y, mo, Math.min(n.getUTCDate(), dim));
  return t >= cutoff;
}

module.exports = { parseYmd, isNotFuture, isWithinMonths };
