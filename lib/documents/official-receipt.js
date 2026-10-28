// lib/documents/official-receipt.js
//
// Step 7b: receipt document settings as data only. No logic here.
// One row per field in extracted_fields (no lists in one column).
// Line items are fixed optional slots; empty slots count as 0 in the sum check.
// If ALL item slots are empty/absent, the items-to-subtotal check is skipped.

module.exports = {
  id: "official_receipt",
  label: "Official receipt (sample store)",
  fields: [
    { key: "store_name", type: "text", required: true, maxLength: 120 },
    {
      key: "receipt_number",
      type: "code",
      required: true,
      maxLength: 30,
      pattern: "^[A-Za-z0-9-]+$",
    },
    { key: "receipt_date", type: "date", required: true },
    { key: "item_1_amount", type: "number", required: false, min: 0, max: 1000000 },
    { key: "item_2_amount", type: "number", required: false, min: 0, max: 1000000 },
    { key: "item_3_amount", type: "number", required: false, min: 0, max: 1000000 },
    { key: "subtotal_amount", type: "number", required: true, min: 0, max: 1000000 },
    { key: "vat_amount", type: "number", required: true, min: 0, max: 1000000 },
    { key: "total_amount", type: "number", required: true, min: 0, max: 1000000 },
  ],
  checks: [],
  cross_checks: [],
  self_checks: [
    {
      rule: "sum_equals",
      fields: ["item_1_amount", "item_2_amount", "item_3_amount"],
      equals: "subtotal_amount",
      tolerance: 0.01,
      message: "Item amounts don't add up to the subtotal.",
    },
    {
      rule: "sum_equals",
      fields: ["subtotal_amount", "vat_amount"],
      equals: "total_amount",
      tolerance: 0.01,
      message: "Subtotal plus VAT doesn't match the total.",
    },
  ],
};
