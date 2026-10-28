// tests/receipt-check.test.js
//
// Step 7b: receipt self-checks (pure, no database, no API cost).
// Node's built-in test runner only (node --test). No other test library.

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { validateExtraction, normalizeAmount } = require("../lib/validation");
const { buildCheckRows } = require("../lib/checks/run-checks");
const { compareSumEquals, parseAmount } = require("../lib/checks/arithmetic");
const { getProcess, listProcesses } = require("../lib/processes/index");
const { getDocumentType } = require("../lib/documents/index");

function field(value, confidence = "high") {
  return { value, confidence, unreadable: false };
}

function goodReceiptFields() {
  return {
    store_name: field("Tindahan ni Aling Nena"),
    receipt_number: field("OR-2026-001827"),
    receipt_date: field("2026-10-12"),
    item_1_amount: field(75),
    item_2_amount: field(62.5),
    item_3_amount: field(50),
    subtotal_amount: field(187.5),
    vat_amount: field(22.5),
    total_amount: field(210),
  };
}

describe("peso normalization", () => {
  it("strips peso sign, commas and spaces", () => {
    assert.equal(normalizeAmount("₱1,210.00"), 1210);
    assert.equal(normalizeAmount("PHP 210.00"), 210);
    assert.equal(normalizeAmount("php1,000"), 1000);
    assert.equal(normalizeAmount("  187.50  "), 187.5);
  });

  it("keeps plain numbers", () => {
    assert.equal(normalizeAmount(210), 210);
    assert.equal(normalizeAmount("210"), 210);
    assert.equal(normalizeAmount("0"), 0);
  });

  it("rejects garbage", () => {
    assert.equal(normalizeAmount("abc"), null);
    assert.equal(normalizeAmount(""), null);
    assert.equal(normalizeAmount(null), null);
    assert.equal(normalizeAmount("12.5.3"), null);
  });

  it("accepts peso strings on number fields", () => {
    const input = { fields: goodReceiptFields() };
    input.fields.total_amount = field("₱210.00");
    input.fields.subtotal_amount = field("PHP 187.50");
    const res = validateExtraction("official_receipt", input);
    assert.equal(res.ok, true);
    assert.equal(res.issues.length, 0);
  });

  it("parse helper accepts peso strings", () => {
    assert.equal(parseAmount("₱1,210.00"), 1210);
    assert.equal(parseAmount("210"), 210);
    assert.equal(parseAmount("nope"), null);
  });
});

describe("receipt validation", () => {
  it("good receipt passes", () => {
    const res = validateExtraction("official_receipt", { fields: goodReceiptFields() });
    assert.equal(res.ok, true);
    assert.equal(res.issues.length, 0);
  });

  it("missing required total is caught", () => {
    const input = { fields: goodReceiptFields() };
    delete input.fields.total_amount;
    const res = validateExtraction("official_receipt", input);
    assert.equal(res.ok, false);
    assert.ok(res.issues.some((i) => i.field === "total_amount"));
  });

  it("future receipt date is caught", () => {
    const input = { fields: goodReceiptFields() };
    input.fields.receipt_date = field("2999-01-01");
    const res = validateExtraction("official_receipt", input);
    assert.equal(res.ok, false);
    assert.ok(res.issues.some((i) => i.field === "receipt_date"));
  });

  it("unreal receipt date is caught", () => {
    const input = { fields: goodReceiptFields() };
    input.fields.receipt_date = field("2026-02-30");
    const res = validateExtraction("official_receipt", input);
    assert.equal(res.ok, false);
    assert.ok(res.issues.some((i) => i.field === "receipt_date"));
  });

  it("registered in settings", () => {
    assert.ok(getDocumentType("official_receipt"));
    const proc = getProcess("receipt_check");
    assert.ok(proc);
    assert.deepStrictEqual(proc.documents, ["official_receipt"]);
    assert.equal(proc.needs_profile, false);
    const listed = listProcesses().find((p) => p.id === "receipt_check");
    assert.ok(listed);
    assert.equal(listed.needs_profile, false);
  });
});

describe("sum_equals arithmetic", () => {
  it("exact sum matches", () => {
    const r = compareSumEquals([75, 62.5, 50], 187.5, 0.01);
    assert.equal(r.result, "match");
  });

  it("wrong total mismatches", () => {
    const r = compareSumEquals([75, 62.5, 50], 220, 0.01);
    assert.equal(r.result, "mismatch");
  });
});

describe("receipt self-check rows", () => {
  it("good receipt: both sums match", () => {
    const rows = buildCheckRows({
      docType: "official_receipt",
      documentId: "rc-1",
      myFields: goodReceiptFields(),
      profileFullName: null,
      profileDob: null,
      others: [],
    });
    assert.equal(rows.length, 2);
    assert.ok(rows.every((r) => r.result === "match"));
    assert.ok(rows.every((r) => r.rule === "sum_equals"));
    const subRow = rows.find((r) => r.field_key === "subtotal_amount");
    const totRow = rows.find((r) => r.field_key === "total_amount");
    assert.equal(subRow.reason, "Items add up to the subtotal.");
    assert.equal(totRow.reason, "Subtotal plus VAT equals the total.");
  });

  it("bad total mismatches with message", () => {
    const f = goodReceiptFields();
    f.total_amount = field(220);
    const rows = buildCheckRows({
      docType: "official_receipt",
      documentId: "rc-1",
      myFields: f,
      profileFullName: null,
      profileDob: null,
      others: [],
    });
    assert.equal(rows.length, 2);
    const tot = rows.find((r) => r.field_key === "total_amount");
    assert.equal(tot.result, "mismatch");
    assert.equal(tot.reason, "Subtotal plus VAT doesn't match the total.");
  });

  it("wrong items mismatches with message", () => {
    const f = goodReceiptFields();
    f.item_3_amount = field(60);
    const rows = buildCheckRows({
      docType: "official_receipt",
      documentId: "rc-1",
      myFields: f,
      profileFullName: null,
      profileDob: null,
      others: [],
    });
    const sub = rows.find((r) => r.field_key === "subtotal_amount");
    assert.equal(sub.result, "mismatch");
    assert.equal(sub.reason, "Item amounts don't add up to the subtotal.");
  });

  it("empty slot counts as 0", () => {
    const f = goodReceiptFields();
    delete f.item_3_amount;
    f.item_1_amount = field(125);
    f.item_2_amount = field(62.5);
    const rows = buildCheckRows({
      docType: "official_receipt",
      documentId: "rc-1",
      myFields: f,
      profileFullName: null,
      profileDob: null,
      others: [],
    });
    const sub = rows.find((r) => r.field_key === "subtotal_amount");
    assert.ok(sub);
    assert.equal(sub.result, "match");
  });

  it("all items empty: skipped, not mismatch", () => {
    const f = goodReceiptFields();
    delete f.item_1_amount;
    delete f.item_2_amount;
    delete f.item_3_amount;
    const rows = buildCheckRows({
      docType: "official_receipt",
      documentId: "rc-1",
      myFields: f,
      profileFullName: null,
      profileDob: null,
      others: [],
    });
    assert.ok(!rows.some((r) => r.field_key === "subtotal_amount"));
    const tot = rows.find((r) => r.field_key === "total_amount");
    assert.ok(tot);
    assert.equal(tot.result, "match");
  });

  it("unreadable item skips, never mismatch", () => {
    const f = goodReceiptFields();
    f.item_1_amount = { value: null, confidence: "low", unreadable: true };
    const rows = buildCheckRows({
      docType: "official_receipt",
      documentId: "rc-1",
      myFields: f,
      profileFullName: null,
      profileDob: null,
      others: [],
    });
    assert.ok(!rows.some((r) => r.field_key === "subtotal_amount"));
  });
});

