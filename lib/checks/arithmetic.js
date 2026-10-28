// lib/checks/arithmetic.js
//
// Step 7b: generic arithmetic rule (sum_equals).
// Pure, no database. Any future document type can reuse it via self_checks.
// Empty/absent slots count as 0; unreadable or missing target skips (never mismatch).
// If ALL source slots are empty/absent, the caller skips (no row).

const { normalizeAmount } = require("../validation");

function parseAmount(raw) {
  const n = normalizeAmount(raw);
  if (n === null || n === undefined) return null;
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return n;
}

// Pure: values are already-parsed numbers, target is a number.
// Returns { result: 'match' | 'mismatch', diff } or null to skip.
function compareSumEquals(values, target, tolerance) {
  if (!Array.isArray(values) || values.length === 0) return null;
  if (typeof target !== "number" || !Number.isFinite(target)) return null;
  for (const v of values) {
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
  }
  const tol = typeof tolerance === "number" && Number.isFinite(tolerance) ? Math.abs(tolerance) : 0.01;
  const sum = values.reduce((a, b) => a + b, 0);
  const diff = Math.abs(sum - target);
  if (diff <= tol + 1e-9) return { result: "match", diff };
  return { result: "mismatch", diff };
}

module.exports = { parseAmount, compareSumEquals };
