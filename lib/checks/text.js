// lib/checks/text.js
//
// Step 7c Part 1: pure text rules (equals, contains). No database, no model.
// Case-insensitive, ignores extra spaces. Accents are NOT folded (same as the
// requirement check). Fail closed: empty needle never matches.

function normText(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function equalsValue(a, b) {
  return normText(a) === normText(b);
}

// Case-insensitive substring after normalization.
// Empty needle or empty haystack returns false, never throws.
function containsValue(haystack, needle) {
  const h = normText(haystack);
  const n = normText(needle);
  if (!n || !h) return false;
  return h.indexOf(n) >= 0;
}

module.exports = { normText, equalsValue, containsValue };
