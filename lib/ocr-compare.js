// lib/ocr-compare.js
// Browser-safe shared plain-OCR scoring. Used by both scripts/eval.mjs (Node)
// and the reviewer UI (browser). No Node builtins, browser-safe only.
// Imports only browser-safe helpers: normalizeAmount, normText, baseNormalize.

const { normalizeAmount } = require("./normalize-amount.js");
const { normText } = require("./checks/text.js");
const { baseNormalize } = require("./checks/names.js");

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_SHORT = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function dateCandidates(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || "").trim());
  if (!m) return [String(ymd || "")];
  const y = m[1];
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const monthName = MONTH_NAMES[mo - 1] || "";
  const monthShort = MONTH_SHORT[mo - 1] || "";
  const dd = String(d);
  const mm = String(mo);
  const dd2 = String(d).padStart(2, "0");
  const mm2 = String(mo).padStart(2, "0");
  return [
    `${y}-${mm2}-${dd2}`,
    `${y}/${mm2}/${dd2}`,
    `${dd2}/${mm2}/${y}`,
    `${mm2}/${dd2}/${y}`,
    `${dd} ${monthName} ${y}`,
    `${dd2} ${monthName} ${y}`,
    `${monthName} ${dd} ${y}`,
    `${monthName} ${dd2} ${y}`,
    `${dd} ${monthShort} ${y}`,
    `${monthShort} ${dd} ${y}`,
    `${dd}-${monthName}-${y}`,
    `${y} ${monthName} ${dd}`,
  ];
}

function expandShortNames(normed) {
  return String(normed || "")
    .replace(/\bma\b/g, "maria")
    .replace(/\bsto\b/g, "santo")
    .replace(/\bsta\b/g, "santa");
}

// ocrFoundInText supports both calling conventions:
// - object form: ocrFoundInText({ fieldDef, ocrText, expected })  (spec)
// - positional: ocrFoundInText(fieldDef, ocrText, expected)      (legacy eval)
function ocrFoundInText(a, b, c) {
  let fieldDef;
  let ocrText;
  let expected;
  if (a && typeof a === "object" && ("fieldDef" in a || "ocrText" in a || "expected" in a)) {
    fieldDef = a.fieldDef;
    ocrText = a.ocrText;
    expected = a.expected;
  } else {
    fieldDef = a;
    ocrText = b;
    expected = c;
  }
  try {
    const type = fieldDef ? fieldDef.type : null;
    const hay = String(ocrText || "");
    if (!hay.trim()) return false;
    if (type === "name") {
      const hayN = baseNormalize(hay);
      const expN = baseNormalize(String(expected));
      if (!expN) return false;
      if (hayN.indexOf(expN) >= 0) return true;
      return expandShortNames(hayN).indexOf(expandShortNames(expN)) >= 0;
    }
    if (type === "number") {
      const bv = typeof expected === "number" ? expected : normalizeAmount(expected);
      if (bv === null || bv === undefined) return false;
      const tokens = hay.match(/-?\d[\d,]*(\.\d+)?/g) || [];
      for (const t of tokens) {
        const n = normalizeAmount(t);
        if (n !== null && Math.abs(n - bv) <= 0.01 + 1e-9) return true;
      }
      return false;
    }
    if (type === "date") {
      const hayN = normText(hay);
      for (const cand of dateCandidates(expected)) {
        const n = normText(cand);
        if (n && hayN.indexOf(n) >= 0) return true;
      }
      return false;
    }
    if (type === "choice") {
      const hayN = normText(hay);
      const expN = normText(String(expected));
      if (!expN) return false;
      try {
        return new RegExp(`\\b${escapeRegExp(expN)}\\b`).test(hayN);
      } catch {
        return hayN.indexOf(expN) >= 0;
      }
    }
    if (type === "code") {
      const hayN = normText(hay);
      const expN = normText(String(expected));
      if (!expN) return false;
      if (hayN.indexOf(expN) >= 0) return true;
      const flat = (s) => String(s).replace(/[\s\-_]/g, "");
      return flat(hayN).indexOf(flat(expN)) >= 0;
    }
    const hayN = normText(hay);
    const expN = normText(String(expected));
    if (!expN) return false;
    return hayN.indexOf(expN) >= 0;
  } catch {
    return false;
  }
}

// Alias for backwards compat with eval's positional calls
function ocrFieldCorrect(fieldDef, ocrText, expected) {
  return ocrFoundInText({ fieldDef, ocrText, expected });
}

module.exports = {
  escapeRegExp,
  expandShortNames,
  dateCandidates,
  ocrFoundInText,
  ocrFieldCorrect,
};
