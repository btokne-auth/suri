// lib/documents/index.js
//
// Build order step 3: settings + rules.
// Tiny registry so validation can look up settings by id without new code per type.

const birthCertificate = require("./birth-certificate");
const validId = require("./valid-id");
const reportCard = require("./report-card");

const DOCUMENT_TYPES = {
  [birthCertificate.id]: birthCertificate,
  [validId.id]: validId,
  [reportCard.id]: reportCard,
};

function getDocumentType(id) {
  return DOCUMENT_TYPES[id] || null;
}

module.exports = { DOCUMENT_TYPES, getDocumentType };
