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

function todayInManila(nowMs) {
  const n = typeof nowMs === 'number' ? new Date(nowMs) : new Date();
  const shiftedMs = n.getTime() + 8 * 60 * 60 * 1000;
  const d = new Date(shiftedMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function computeAgeYears(ymd, nowMs) {
  const birthMs = parseYmd(ymd);
  if (birthMs === null) return null;
  const birthDate = new Date(birthMs);
  const birthY = birthDate.getUTCFullYear();
  const birthM = birthDate.getUTCMonth();
  const birthD = birthDate.getUTCDate();
  const n = typeof nowMs === 'number' ? new Date(nowMs) : new Date();
  const shiftedMs = n.getTime() + 8 * 60 * 60 * 1000;
  const manila = new Date(shiftedMs);
  const todayY = manila.getUTCFullYear();
  const todayM = manila.getUTCMonth();
  const todayD = manila.getUTCDate();
  let age = todayY - birthY;
  let bMonth = birthM;
  let bDay = birthD;
  if (birthM === 1 && birthD === 29) {
    const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    if (!isLeap(todayY)) {
      bMonth = 2;
      bDay = 1;
    }
  }
  if (todayM < bMonth || (todayM === bMonth && todayD < bDay)) {
    age -= 1;
  }
  return age;
}

function compareAge(value, opts) {
  const o = opts || {};
  const label = o.label ? String(o.label) : 'Birth date';
  if (value == null || String(value).trim() === '') {
    return { result: 'check', reason: label + " can't be checked \u2014 birth date is missing or unreadable, please confirm." };
  }
  const ymd = String(value).trim();
  const birthMs = parseYmd(ymd);
  if (birthMs === null) {
    return { result: 'check', reason: label + " can't be checked \u2014 birth date is missing or unreadable, please confirm." };
  }
  const age = computeAgeYears(ymd, o.nowMs);
  if (age === null) {
    return { result: 'check', reason: label + " can't be checked \u2014 birth date is missing or unreadable, please confirm." };
  }
  if (age < 0) {
    return { result: 'check', reason: 'Birth date is in the future, please confirm.' };
  }
  const hasMin = Number.isInteger(o.min_age);
  const hasMax = Number.isInteger(o.max_age);
  let isMatch = true;
  if (hasMin && hasMax) {
    if (age < o.min_age || age > o.max_age) isMatch = false;
  } else if (hasMin) {
    if (age < o.min_age) isMatch = false;
  } else if (hasMax) {
    if (age > o.max_age) isMatch = false;
  } else {
    return { result: 'check', reason: label + " can't be checked \u2014 birth date is missing or unreadable, please confirm." };
  }
  let base = '';
  if (hasMin && hasMax) {
    if (isMatch) base = `Age is ${age} \u2014 between ${o.min_age} and ${o.max_age}.`;
    else base = `Age is ${age} \u2014 must be between ${o.min_age} and ${o.max_age}.`;
  } else if (hasMin) {
    if (isMatch) base = `Age is ${age} \u2014 at least ${o.min_age}.`;
    else base = `Age is ${age} \u2014 must be at least ${o.min_age}.`;
  } else if (hasMax) {
    if (isMatch) base = `Age is ${age} \u2014 at most ${o.max_age}.`;
    else base = `Age is ${age} \u2014 must be at most ${o.max_age}.`;
  }
  let reason = base;
  if (!isMatch && o.message) {
    const custom = String(o.message).trim().slice(0, 200);
    if (custom) reason = base + ' ' + custom;
  }
  return { result: isMatch ? 'match' : 'mismatch', reason };
}

module.exports = { parseYmd, isNotFuture, isWithinMonths, todayInManila, computeAgeYears, compareAge };
