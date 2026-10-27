// lib/processes/linawan-scholarship-intake.js
//
// Build order step 3: settings + rules.
// Process settings as data only. No logic here.
// The requirement rule is written by the office (not decided by AI)
// and checked on the first document (step 6).

module.exports = {
  id: "linawan_scholarship_intake",
  label: "Linawan College scholarship document intake (sample)",
  documents: ["valid_id", "birth_certificate", "report_card"],
  requirement: {
    document: "valid_id",
    // Flat key for address.city_municipality (see lib/documents/valid-id.js).
    field: "address_city_municipality",
    op: "equals",
    value: "Linawan",
    message: "This program is for Linawan residents.",
  },
};
