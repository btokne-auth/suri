// tests/validation-quality.test.js
// Step 9A: validation of quality + document_match blocks
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { validateExtraction, validateExtractionWithDef } = require("../lib/validation");

function baseFields() {
  return {
    full_name: { value: "Maria Santos", confidence: "high", unreadable: false },
    sex: { value: "Female", confidence: "high", unreadable: false },
    date_of_birth: { value: "2015-06-15", confidence: "high", unreadable: false },
    place_of_birth: { value: "Linawan", confidence: "high", unreadable: false },
    mother_maiden_name: { value: "Ana Reyes", confidence: "high", unreadable: false },
    father_name: { value: "Jose Cruz", confidence: "high", unreadable: false },
    registry_number: { value: "2020-12345", confidence: "high", unreadable: false },
    date_issued: { value: "2020-07-01", confidence: "high", unreadable: false },
  };
}

describe("validateExtraction quality", () => {
  it("valid quality passes", () => {
    const out = { fields: baseFields(), quality: { usable: false, problems: ["blurry", "dark"] }, document_match: { matches_expected: true, looks_like: "birth_certificate" } };
    const res = validateExtraction("birth_certificate", out, { allowedDocIds: ["birth_certificate", "valid_id"] });
    assert.equal(res.ok, true);
    assert.deepEqual(res.quality, { usable: false, problems: ["blurry", "dark"] });
    assert.deepEqual(res.documentMatch, { matches_expected: true, looks_like: "birth_certificate" });
  });
  it("missing blocks defaults to usable true", () => {
    const out = { fields: baseFields() };
    const res = validateExtraction("birth_certificate", out);
    assert.equal(res.ok, true);
    assert.deepEqual(res.quality, { usable: true, problems: [] });
    assert.equal(res.documentMatch, null);
  });
  it("bad quality shape is rejected but fields still returned", () => {
    const out = { fields: baseFields(), quality: { usable: "yes", problems: ["blurry"] } };
    const res = validateExtraction("birth_certificate", out);
    assert.equal(res.ok, false);
    assert.ok(res.issues.some((i) => i.field === "quality" && i.code === "bad_quality"));
  });
  it("invalid problem enum is rejected", () => {
    const out = { fields: baseFields(), quality: { usable: false, problems: ["foggy"] } };
    const res = validateExtraction("birth_certificate", out);
    assert.equal(res.ok, false);
    assert.ok(res.issues.some((i) => i.code === "bad_quality"));
  });
  it("duplicate problems rejected", () => {
    const out = { fields: baseFields(), quality: { usable: false, problems: ["blurry", "blurry"] } };
    const res = validateExtraction("birth_certificate", out);
    assert.equal(res.ok, false);
  });
  it("looks_like other is allowed", () => {
    const out = { fields: baseFields(), document_match: { matches_expected: false, looks_like: "other" } };
    const res = validateExtraction("birth_certificate", out, { allowedDocIds: ["birth_certificate", "valid_id"] });
    assert.equal(res.ok, true);
    assert.equal(res.documentMatch.looks_like, "other");
  });
  it("looks_like unknown id is rejected (strict)", () => {
    const out = { fields: baseFields(), document_match: { matches_expected: false, looks_like: "unknown_doc" } };
    const res = validateExtraction("birth_certificate", out, { allowedDocIds: ["birth_certificate", "valid_id"] });
    assert.equal(res.ok, false);
    assert.ok(res.issues.some((i) => i.code === "bad_document_match"));
  });
  it("saved doc id allowed when in allowedDocIds", () => {
    const out = { fields: baseFields(), document_match: { matches_expected: false, looks_like: "proof_of_billing" } };
    const res = validateExtraction("birth_certificate", out, { allowedDocIds: ["birth_certificate", "proof_of_billing"] });
    assert.equal(res.ok, true);
  });
  it("validateExtractionWithDef respects allowedDocIds and dateFloor", () => {
    const def = { id: "custom_doc", label: "Custom", fields: [{ key: "f0", type: "text", required: true, maxLength: 20 }] };
    const out = { fields: { f0: { value: "ok", confidence: "high", unreadable: false } }, quality: { usable: true, problems: [] }, document_match: { matches_expected: true, looks_like: "custom_doc" } };
    const res = validateExtractionWithDef(def, out, { allowedDocIds: ["custom_doc"], dateFloor: null });
    assert.equal(res.ok, true);
  });
});
