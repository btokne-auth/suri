// lib/normalize-amount.js
// Browser-safe peso normalization for number fields.
// Extracted from lib/validation.js so both app validation and
// browser-side plain-OCR scoring can share the same logic.
// Strips "₱", "PHP"/"php", commas and spaces so "₱1,210.00" -> 1210.
// Returns a finite number, or null when the value has no parseable number.
// Never throws. The original string is still kept in `fields`.

function normalizeAmount(raw) {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (s === "") return null;
  s = s.replace(/₱/g, "");
  s = s.replace(/PHP/gi, "");
  s = s.replace(/,/g, "");
  s = s.replace(/\s+/g, "");
  if (s === "" || s === "-" || s === "." || s === "-.") return null;
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

module.exports = { normalizeAmount };
