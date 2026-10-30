// tests/decide-usability.test.js
// Step 9A: pure decision rules for quality -> retake and wrong-document check.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { isWrongDocument, isRetakeNeeded, retakeReason, wrongDocumentReason, decideUsability } = require("../lib/decide-usability");

function defWithRequired(n) {
  const fields = [];
  for (let i = 0; i < n; i++) fields.push({ key: "f" + i, type: "text", required: true, maxLength: 20 });
  return { id: "valid_id", label: "Valid ID", fields };
}
function fieldsAllReadable(n) {
  const out = {};
  for (let i = 0; i < n; i++) out["f" + i] = { value: "ok", confidence: "high", unreadable: false };
  return out;
}
function fieldsUnreadable(count, total) {
  const out = {};
  for (let i = 0; i < total; i++) {
    if (i < count) out["f" + i] = { value: null, confidence: "low", unreadable: true };
    else out["f" + i] = { value: "ok", confidence: "high", unreadable: false };
  }
  return out;
}

describe("isRetakeNeeded", () => {
  it("usable=false triggers retake even if fields readable", () => {
    const def = defWithRequired(4);
    const fields = fieldsAllReadable(4);
    assert.equal(isRetakeNeeded({ def, fields, quality: { usable: false, problems: ["blurry"] } }), true);
  });
  it("half required unreadable triggers retake (4 required, 2 bad)", () => {
    const def = defWithRequired(4);
    const fields = fieldsUnreadable(2, 4);
    assert.equal(isRetakeNeeded({ def, fields, quality: { usable: true, problems: [] } }), true);
  });
  it("less than half unreadable does NOT trigger retake (8 required, 3 bad, half=4)", () => {
    const def = defWithRequired(8);
    const fields = fieldsUnreadable(3, 8);
    assert.equal(isRetakeNeeded({ def, fields, quality: { usable: true, problems: [] } }), false);
  });
  it("exactly half triggers retake (8 required, 4 bad)", () => {
    const def = defWithRequired(8);
    const fields = fieldsUnreadable(4, 8);
    assert.equal(isRetakeNeeded({ def, fields, quality: { usable: true, problems: [] } }), true);
  });
  it("all required unreadable is retake (old allBad subsumed)", () => {
    const def = defWithRequired(3);
    const fields = fieldsUnreadable(3, 3);
    assert.equal(isRetakeNeeded({ def, fields, quality: { usable: true, problems: [] } }), true);
describe("isWrongDocument", () => {
  it("matches_expected true -> not wrong", () => {
    assert.equal(isWrongDocument({ expectedDocTypeId: "birth_certificate", documentMatch: { matches_expected: true, looks_like: "report_card" }, allowedIds: ["birth_certificate", "report_card"] }), false);
  });
  it("matches_expected false + different known id -> wrong", () => {
    assert.equal(isWrongDocument({ expectedDocTypeId: "birth_certificate", documentMatch: { matches_expected: false, looks_like: "report_card" }, allowedIds: ["birth_certificate", "valid_id", "report_card"] }), true);
  });
  it("looks_like other -> never wrong (falls to retake)", () => {
    assert.equal(isWrongDocument({ expectedDocTypeId: "birth_certificate", documentMatch: { matches_expected: false, looks_like: "other" }, allowedIds: ["birth_certificate", "report_card"] }), false);
  });
  it("looks_like same as expected -> not wrong", () => {
    assert.equal(isWrongDocument({ expectedDocTypeId: "valid_id", documentMatch: { matches_expected: false, looks_like: "valid_id" }, allowedIds: ["valid_id", "birth_certificate"] }), false);
  });
  it("looks_like unknown id -> not wrong (strict)", () => {
    assert.equal(isWrongDocument({ expectedDocTypeId: "valid_id", documentMatch: { matches_expected: false, looks_like: "unknown_doc" }, allowedIds: ["valid_id", "birth_certificate"] }), false);
  });
  it("missing documentMatch -> not wrong", () => {
    assert.equal(isWrongDocument({ expectedDocTypeId: "valid_id", documentMatch: null, allowedIds: ["valid_id"] }), false);
  });
});

  });
  it("empty required does NOT retake on unreadable alone", () => {
    const def = { id: "x", label: "X", fields: [{ key: "f0", type: "text", required: false }] };
describe("decideUsability", () => {
  it("wrong_document takes precedence over retake", () => {
    const def = defWithRequired(2);
    const fields = fieldsUnreadable(2, 2);
    const res = decideUsability({
      def, bundle: null, expectedDocTypeId: "birth_certificate", fields,
      quality: { usable: false, problems: ["blurry"] },
      documentMatch: { matches_expected: false, looks_like: "report_card" },
      allowedIds: ["birth_certificate", "report_card", "valid_id"],
    });
    assert.equal(res.status, "wrong_document");
  });
  it("retake when usable false", () => {
    const def = defWithRequired(4);
    const fields = fieldsAllReadable(4);
    const res = decideUsability({
      def, expectedDocTypeId: "valid_id", fields,
      quality: { usable: false, problems: ["dark"] },
      documentMatch: { matches_expected: true, looks_like: "valid_id" },
      allowedIds: ["valid_id", "birth_certificate"],
    });
    assert.equal(res.status, "retake_needed");
  });
  it("needs_review when clean", () => {
    const def = defWithRequired(4);
    const fields = fieldsAllReadable(4);
    const res = decideUsability({
      def, expectedDocTypeId: "valid_id", fields,
      quality: { usable: true, problems: [] },
      documentMatch: { matches_expected: true, looks_like: "valid_id" },
      allowedIds: ["valid_id"],
    });
    assert.equal(res.status, "needs_review");
  });
  it("uses bundle.docs labels for reason", () => {
    const def = { id: "birth_certificate", label: "Birth certificate", fields: [{ key: "f0", type: "text", required: true }] };
    const bundle = { docs: { birth_certificate: { id: "birth_certificate", label: "Birth certificate" }, report_card: { id: "report_card", label: "Report card" } } };
    const res = decideUsability({
      def, bundle, expectedDocTypeId: "birth_certificate",
      fields: { f0: { value: "ok", confidence: "high", unreadable: false } },
      quality: { usable: true, problems: [] },
      documentMatch: { matches_expected: false, looks_like: "report_card" },
      allowedIds: ["birth_certificate", "report_card"],
    });
    assert.match(res.reason, /report card/i);
  });
});
describe("wrongDocumentReason", () => {
  it("formats lowercased labels", () => {
    const r = wrongDocumentReason({ expectedLabel: "Birth certificate", looksLikeLabel: "Report card" });
    assert.equal(r, "This looks like a report card, not a birth certificate.");
  });
});
describe("retakeReason", () => {
  it("priority blurry over dark", () => {
    assert.equal(retakeReason({ usable: false, problems: ["dark", "blurry"] }), "The photo is too blurry. Please retake it in better light.");
  });
  it("maps each problem", () => {
    assert.equal(retakeReason({ usable: false, problems: ["dark"] }), "The photo is too dark. Please retake it in better light.");
    assert.equal(retakeReason({ usable: false, problems: ["glare"] }), "There is glare on the photo. Please retake it without flash.");
    assert.equal(retakeReason({ usable: false, problems: ["cut_off"] }), "The document is cut off. Please retake it to show the full page.");
    assert.equal(retakeReason({ usable: false, problems: ["angle"] }), "The photo is taken at an angle. Please retake it straight on.");
  });
  it("no problems -> generic", () => {
    assert.equal(retakeReason({ usable: true, problems: [] }), "We couldn't read most fields. Please retake the photo in better light.");
  });
});

    const fields = { f0: { value: null, confidence: "low", unreadable: true } };
    assert.equal(isRetakeNeeded({ def, fields, quality: { usable: true, problems: [] } }), false);
  });
});
