// tests/validation.test.js
//
// Build order step 3: settings + rules.
// Node's built-in test runner only (node --test). No other test library.

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { validateExtraction } = require("../lib/validation");

function field(value, confidence = "high") {
  return { value, confidence, unreadable: false };
}

function validBirthCertificate() {
  return {
    fields: {
      full_name: field("Maria Santos Dela Cruz"),
      sex: field("Female"),
      date_of_birth: field("2015-06-15"),
      place_of_birth: field("Linawan"),
      mother_maiden_name: field("Ana Reyes"),
      father_name: field("Jose Dela Cruz"),
      registry_number: field("2020-12345"),
      date_issued: field("2020-07-01"),
    },
  };
}

function validReportCard() {
  return {
    fields: {
      full_name: field("Maria Santos Dela Cruz"),
      school_name: field("Linawan Elementary School"),
      school_year: field("2025-2026"),
      grade_level: field("Grade 7"),
      adviser_name: field("Liza Ramos"),
      general_average: { value: 89, confidence: "high", unreadable: false },
    },
  };
}

describe("validateExtraction", () => {
  it("valid 8/8 birth certificate passes", () => {
    const res = validateExtraction("birth_certificate", validBirthCertificate());
    assert.equal(res.ok, true);
    assert.equal(res.issues.length, 0);
    assert.equal(Object.keys(res.fields).length, 8);
  });

  it("Feb 30 is caught", () => {
    const input = validBirthCertificate();
    input.fields.date_of_birth = field("2021-02-30");
    const res = validateExtraction("birth_certificate", input);
    assert.equal(res.ok, false);
    assert.ok(res.issues.some((i) => i.field === "date_of_birth"));
    // Never fixed or dropped: bad value stays in fields.
    assert.equal(res.fields.date_of_birth.value, "2021-02-30");
  });

  it("a future date is caught", () => {
    const input = validBirthCertificate();
    input.fields.date_of_birth = field("2100-01-01");
    const res = validateExtraction("birth_certificate", input);
    assert.equal(res.ok, false);
    assert.ok(res.issues.some((i) => i.field === "date_of_birth"));
  });

  it("digits in a name are caught", () => {
    const input = validBirthCertificate();
    input.fields.full_name = field("Maria Santos 123");
    const res = validateExtraction("birth_certificate", input);
    assert.equal(res.ok, false);
    assert.ok(res.issues.some((i) => i.field === "full_name"));
    assert.equal(res.fields.full_name.value, "Maria Santos 123");
  });

  it("general average 150 is caught", () => {
    const input = validReportCard();
    input.fields.general_average = {
      value: 150,
      confidence: "high",
      unreadable: false,
    };
    const res = validateExtraction("report_card", input);
    assert.equal(res.ok, false);
    assert.ok(res.issues.some((i) => i.field === "general_average"));
    assert.equal(res.fields.general_average.value, 150);
  });

  it("a missing required field is caught", () => {
    const input = validBirthCertificate();
    delete input.fields.mother_maiden_name;
    const res = validateExtraction("birth_certificate", input);
    assert.equal(res.ok, false);
    assert.ok(
      res.issues.some(
        (i) => i.field === "mother_maiden_name" && i.code === "missing_required"
      )
    );
  });

  it("a wrong overall shape is caught", () => {
    const res = validateExtraction("birth_certificate", { fields: [] });
    assert.equal(res.ok, false);
    assert.ok(res.issues.some((i) => i.code === "bad_shape"));
  });
});
