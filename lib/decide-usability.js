// lib/decide-usability.js
// Step 9A: code decides usability before any checks.
// Pure functions, no DB, no secrets — testable with node --test.
//
// Order: wrong_document first, then retake, then normal.
// - Wrong document when matches_expected===false AND looks_like is a different KNOWN id.
// - Also wrong document when looks_like==="other" BUT the photo itself is fine
//   (quality usable, no problems listed) and most required fields are missing:
//   a clear photo of some other paper (e.g. a water bill in the receipt slot)
//   should say "this doesn't look like…", not "retake in better light".
//   A bad photo with looks_like "other" still falls through to retake.
// - Retake when quality.usable===false OR >= half required fields are unreadable/null/empty.
// - Reasons are mapped from code, never free text from model.

const { QUALITY_REASONS } = require("./validation");

const RETAKE_PRIORITY = ["blurry", "dark", "glare", "cut_off", "angle"];

function retakeReason(quality) {
  const problems = (quality && Array.isArray(quality.problems) && quality.problems) || [];
  for (const p of RETAKE_PRIORITY) {
    if (problems.includes(p) && QUALITY_REASONS[p]) return QUALITY_REASONS[p];
  }
  return "We couldn't read most fields. Please retake the photo in better light.";
}

function countUnreadableRequired(def, fields) {
  const required = (def && Array.isArray(def.fields) ? def.fields : []).filter((f) => f.required).map((f) => f.key);
  let unreadable = 0;
  for (const k of required) {
    const v = fields ? fields[k] : null;
    if (!v || v.unreadable === true || v.value == null || String(v.value).trim() === "") unreadable += 1;
  }
  return { requiredCount: required.length, unreadableCount: unreadable, half: required.length > 0 ? Math.ceil(required.length / 2) : 0 };
}

function isRetakeNeeded({ def, fields, quality }) {
  const { requiredCount, unreadableCount, half } = countUnreadableRequired(def, fields);
  if (quality && quality.usable === false) return true;
  if (requiredCount > 0 && unreadableCount >= half) return true;
  return false;
}

function isWrongDocument({ expectedDocTypeId, documentMatch, allowedIds }) {
  if (!documentMatch || typeof documentMatch.matches_expected !== "boolean") return false;
  if (documentMatch.matches_expected === true) return false;
  const looks = documentMatch.looks_like;
  if (!looks || looks === "other") return false;
  if (looks === expectedDocTypeId) return false;
  const known = new Set(Array.isArray(allowedIds) ? allowedIds : []);
  if (!known.has(looks)) return false;
  return true;
}

function withArticle(label) {
  // "Official receipt (sample store)" -> "official receipt"
  const t = String(label || "").replace(/\s*\([^)]*\)\s*$/, "").trim().toLowerCase();
  if (!t) return "the expected document";
  return (/^[aeiou]/.test(t) ? "an " : "a ") + t;
}

function wrongDocumentReason({ expectedLabel, looksLikeLabel }) {
  const exp = withArticle(expectedLabel || "");
  const got = String(looksLikeLabel || "").trim();
  // Unknown kind of paper (looks_like "other" is stored as null).
  if (!got || got.toLowerCase() === "another document" || got.toLowerCase() === "other") {
    return "This doesn't look like " + exp + ". Please upload the right document.";
  }
  return "This looks like " + withArticle(got) + ", not " + exp + ".";
}

// Clear photo, but not the expected kind of paper and not one Suri knows.
function isUnknownOtherDocument({ def, fields, quality, documentMatch }) {
  if (!documentMatch || documentMatch.matches_expected !== false) return false;
  if (documentMatch.looks_like !== "other") return false;
  if (!quality || quality.usable === false) return false;
  if (Array.isArray(quality.problems) && quality.problems.length > 0) return false;
  const { requiredCount, unreadableCount, half } = countUnreadableRequired(def, fields);
  return requiredCount > 0 && unreadableCount >= half;
}

// Main gate: returns { status, action, reason, lookedAt }
// status: "wrong_document" | "retake_needed" | "needs_review"
// action: "wrong document" | "retake" | "needs_review"
function decideUsability({ def, bundle, expectedDocTypeId, fields, quality, documentMatch, allowedIds }) {
  const ids = Array.isArray(allowedIds) ? allowedIds : bundle && bundle.docs ? Object.keys(bundle.docs) : [];
  if (isWrongDocument({ expectedDocTypeId, documentMatch, allowedIds: ids })) {
    let looksLabel = documentMatch.looks_like;
    let expectedLabel = expectedDocTypeId;
    if (bundle && bundle.docs) {
      if (bundle.docs[documentMatch.looks_like] && bundle.docs[documentMatch.looks_like].label) looksLabel = bundle.docs[documentMatch.looks_like].label;
      else {
        try {
          const { getDocumentType } = require("./documents");
          const ld = getDocumentType(documentMatch.looks_like);
          if (ld && ld.label) looksLabel = ld.label;
        } catch {}
      }
      if (bundle.docs[expectedDocTypeId] && bundle.docs[expectedDocTypeId].label) expectedLabel = bundle.docs[expectedDocTypeId].label;
      else {
        try {
          const { getDocumentType } = require("./documents");
          const ed = getDocumentType(expectedDocTypeId);
          if (ed && ed.label) expectedLabel = ed.label;
        } catch {}
      }
    }
    return {
      status: "wrong_document",
      action: "wrong document",
      reason: wrongDocumentReason({ expectedLabel, looksLikeLabel: looksLabel }),
      looks_like: documentMatch.looks_like,
      quality_problems: Array.isArray(quality && quality.problems) ? quality.problems.slice(0, 5) : [],
    };
  }
  if (isUnknownOtherDocument({ def, fields, quality, documentMatch })) {
    let expectedLabel = expectedDocTypeId;
    if (bundle && bundle.docs && bundle.docs[expectedDocTypeId] && bundle.docs[expectedDocTypeId].label) expectedLabel = bundle.docs[expectedDocTypeId].label;
    else if (def && def.label) expectedLabel = def.label;
    return {
      status: "wrong_document",
      action: "wrong document",
      reason: wrongDocumentReason({ expectedLabel, looksLikeLabel: null }),
      looks_like: null,
      quality_problems: [],
    };
  }
  if (isRetakeNeeded({ def, fields, quality })) {
    return {
      status: "retake_needed",
      action: "retake",
      reason: retakeReason(quality),
      looks_like: documentMatch && documentMatch.looks_like ? documentMatch.looks_like : null,
      quality_problems: Array.isArray(quality && quality.problems) ? quality.problems.slice(0, 5) : [],
    };
  }
  return {
    status: "needs_review",
    action: "needs_review",
    reason: "",
    looks_like: documentMatch && documentMatch.looks_like ? documentMatch.looks_like : null,
    quality_problems: Array.isArray(quality && quality.problems) ? quality.problems.slice(0, 5) : [],
  };
}

module.exports = {
  RETAKE_PRIORITY,
  retakeReason,
  countUnreadableRequired,
  isRetakeNeeded,
  isWrongDocument,
  isUnknownOtherDocument,
  wrongDocumentReason,
  decideUsability,
};
