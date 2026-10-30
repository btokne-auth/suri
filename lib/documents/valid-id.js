// lib/documents/valid-id.js
//
// Build order step 3: settings + rules.
// Document type settings as data only. No logic, no comparison, no validation here.
// Step 6 will use `checks` and `cross_checks`. This file only defines them.
//
// Note: `address_city_municipality` is a flat key for `address.city_municipality`
// so we stay inside the 6 allowed field types (name, date, choice, text, number, code).
// The process file maps this key to the requirement rule.

module.exports = {
  id: "valid_id",
  label: "Valid ID (voter's ID style)",
  fields: [
    { key: "full_name", type: "name", required: true, maxLength: 100, clarify: true },
    { key: "date_of_birth", type: "date", required: true },
    { key: "sex", type: "choice", required: true, values: ["Male", "Female"] },
    { key: "address_line", type: "text", required: true, maxLength: 120 },
    {
      key: "address_city_municipality",
      type: "text",
      required: true,
      maxLength: 80,
    },
    { key: "address_province", type: "text", required: true, maxLength: 80 },
    {
      key: "id_number",
      type: "code",
      required: true,
      maxLength: 30,
      pattern: "^[A-Za-z0-9-]+$",
    },
    { key: "date_issued", type: "date", required: true },
  ],
  // Definitions only. The comparison logic is step 6, not this step.
  checks: [
    { field: "full_name", compare_to: "profile.full_name", rule: "filipino_name" },
    { field: "date_of_birth", compare_to: "profile.date_of_birth", rule: "same_date" },
  ],
  cross_checks: [
    {
      field: "full_name",
      compare_to: ["birth_certificate.full_name", "report_card.full_name"],
      rule: "filipino_name",
    },
    {
      field: "date_of_birth",
      compare_to: ["birth_certificate.date_of_birth"],
      rule: "same_date",
    },
  ],
};
