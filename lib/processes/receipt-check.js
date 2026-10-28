// lib/processes/receipt-check.js
//
// Step 7b: receipt process settings as data only. No logic here.
// No profile comparison, no requirement rule. All slots unlock.

module.exports = {
  id: "receipt_check",
  label: "Official receipt check (sample store)",
  documents: ["official_receipt"],
  needs_profile: false,
};
