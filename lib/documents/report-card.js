// lib/documents/report-card.js
//
// Build order step 3: settings + rules.
// Document type settings as data only. No logic, no comparison, no validation here.
// Step 6 will use `checks` and `cross_checks`. This file only defines them.

module.exports = {
  id: "report_card",
  label: "Report card (Form 138 style)",
  fields: [
    { key: "full_name", type: "name", required: true, maxLength: 100 },
    { key: "school_name", type: "text", required: true, maxLength: 120 },
    {
      key: "school_year",
      type: "code",
      required: true,
      maxLength: 9,
      pattern: "^\\d{4}-\\d{4}$",
    },
    {
      key: "grade_level",
      type: "choice",
      required: true,
      values: ["Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"],
    },
    { key: "adviser_name", type: "name", required: true, maxLength: 100 },
    { key: "general_average", type: "number", required: true, min: 60, max: 100 },
  ],
  // Definitions only. The comparison logic is step 6, not this step.
  checks: [
    { field: "full_name", compare_to: "profile.full_name", rule: "filipino_name" },
  ],
  cross_checks: [
    {
      field: "full_name",
      compare_to: ["birth_certificate.full_name", "valid_id.full_name"],
      rule: "filipino_name",
    },
  ],
};
