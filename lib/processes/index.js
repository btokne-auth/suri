// lib/processes/index.js
//
// Step 7: process registry (data only, no logic, no secrets).
// Lets /start list ALL processes and lets server code look up
// any process by id without hard-coding Linawan.

const linawan = require("./linawan-scholarship-intake");

const PROCESSES = {
  [linawan.id]: linawan,
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
  }));
}

module.exports = { PROCESSES, getProcess, listProcesses };
