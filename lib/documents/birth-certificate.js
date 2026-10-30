// lib/documents/birth-certificate.js
//
// Build order step 3: settings + rules.
// Document type settings as data only. No logic, no comparison, no validation here.
// Step 6 will use `checks` and `cross_checks`. This file only defines them.

module.exports = {
  id: "birth_certificate",
  label: "Birth certificate",
  fields: [
    { key: "full_name", type: "name", required: true, maxLength: 100, clarify: true },
    { key: "sex", type: "choice", required: true, values: ["Male", "Female"] },
    { key: "date_of_birth", type: "date", required: true },
    { key: "place_of_birth", type: "text", required: true, maxLength: 120 },
    { key: "mother_maiden_name", type: "name", required: true, maxLength: 100, clarify: true },
    { key: "father_name", type: "name", required: false, maxLength: 100, clarify: true },
    {
      key: "registry_number",
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
      compare_to: ["valid_id.full_name", "report_card.full_name"],
      rule: "filipino_name",
    },
    {
      field: "date_of_birth",
      compare_to: ["valid_id.date_of_birth"],
      rule: "same_date",
    },
  ],
};
