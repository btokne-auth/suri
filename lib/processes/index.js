// lib/processes/index.js
//
// Step 7: process registry (data only, no logic, no secrets).
// Lets /start list ALL processes and lets server code look up
// any process by id without hard-coding Linawan.

const linawan = require("./linawan-scholarship-intake");
const receiptCheck = require("./receipt-check");

const PROCESSES = {
  [linawan.id]: linawan,
  [receiptCheck.id]: receiptCheck,
};

function getProcess(id) {
  if (typeof id !== "string" || !id) return null;
  return PROCESSES[id] || null;
}

// Small public summary for /start (labels + order only).
function listProcesses() {
  return Object.values(PROCESSES).map((p) => ({
    id: p.id,
    label: p.label,
    documents: Array.isArray(p.documents) ? [...p.documents] : [],
    hasRequirement: !!(p && p.requirement),
    needs_profile: p && p.needs_profile === false ? false : true,
  }));
}

module.exports = { PROCESSES, getProcess, listProcesses };
