// lib/processes/resolve.js
//
// Step 7c Part 2: resolve a process id to its definition + document defs.
// Builtins come from the registries (no database). Saved processes
// (saved_ + 8 hex) come from public.saved_processes, owner-only,
// re-validated once with the draft schema. Wrong owner or bad data -> null.
// Server-only by usage: only imported from server routes / workers,
// never from browser code (no server-only import so node --test can cover it).

const { getProcess, listProcesses } = require("./index.js");
const { getDocumentType } = require("../documents/index.js");
const {
  BUILTIN_DOC_IDS,
  validateDraft,
  checkDraftCompatibility,
} = require("./draft-schema.js");

const SAVED_KEY_RE = /^saved_[0-9a-f]{8}$/;
const DEFAULT_CODE_PATTERN = "^[A-Za-z0-9-]+$";

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isSavedProcessId(id) {
  return typeof id === "string" && SAVED_KEY_RE.test(id);
}

// Stored definition shape (from confirm):
// { id, label, documents:[ids], docDefs:{ newId:{ id,label,fields } },
//   checks:[], requirement:null|{...}, needs_profile:boolean }.
function validateSavedDefinition(definition) {
  if (!isPlainObject(definition)) return null;
  const id = definition.id;
  const label = definition.label;
  const documents = definition.documents;
  const rawDocDefs = definition.docDefs || {};
  const checks = definition.checks || [];
  const requirement = definition.requirement || null;
  const rawNotChecked = definition.not_checked;
  let notChecked = [];
  if (Array.isArray(rawNotChecked)) {
    for (const v of rawNotChecked) {
      if (typeof v !== 'string') continue;
      const t = v.trim();
      if (!t) continue;
      notChecked.push(t.slice(0, 160));
      if (notChecked.length >= 5) break;
    }
  }
  if (typeof id !== "string" || !SAVED_KEY_RE.test(id)) return null;
  if (typeof label !== "string" || label.length < 5 || label.length > 80) return null;
  if (!Array.isArray(documents) || documents.length < 1 || documents.length > 4) return null;
  const seen = new Set();
  for (const d of documents) {
    if (typeof d !== "string" || !d || seen.has(d)) return null;
    seen.add(d);
  }
  if (!isPlainObject(rawDocDefs)) return null;
  if (!Array.isArray(checks) || checks.length > 20) return null;
  const docDefs = {};
  for (const docId of documents) {
    if (BUILTIN_DOC_IDS.indexOf(docId) >= 0) continue;
    const inline = rawDocDefs[docId];
    if (!isPlainObject(inline) || inline.id !== docId) return null;
    if (!Array.isArray(inline.fields)) return null;
    const fixed = inline.fields.map((f) => {
      if (!isPlainObject(f)) return f;
      if (f.type === "code" && !f.pattern) {
        const c = {};
        for (const k of Object.keys(f)) c[k] = f[k];
        c.pattern = DEFAULT_CODE_PATTERN;
        return c;
      }
      return f;
    });
    docDefs[docId] = { id: docId, label: inline.label, fields: fixed };
  }
  const draftDocs = documents.map((docId) => {
    if (BUILTIN_DOC_IDS.indexOf(docId) >= 0) return { reuse: docId };
    const inline = docDefs[docId];
    const cleanFields = (inline.fields || []).map((f) => {
      if (!isPlainObject(f)) return f;
      const c = {};
      if (f.key !== undefined) c.key = f.key;
      if (f.type !== undefined) c.type = f.type;
      if (f.label !== undefined) c.label = f.label;
      if (f.required !== undefined) c.required = f.required;
      if (f.maxLength !== undefined) c.maxLength = f.maxLength;
      if (f.values !== undefined) c.values = f.values;
      if (f.min !== undefined) c.min = f.min;
      if (f.max !== undefined) c.max = f.max;
      if (f.clarify !== undefined) c.clarify = f.clarify;
      return c;
    });
    return { id: docId, label: inline.label, fields: cleanFields };
  });
  const draft = { label, documents: draftDocs, checks, not_checked: notChecked };
  if (requirement) draft.requirement = requirement;
  const shaped = validateDraft(draft);
  if (!shaped.ok) return null;
  const lookup = (docId) => {
    if (BUILTIN_DOC_IDS.indexOf(docId) >= 0) return getDocumentType(docId);
    return docDefs[docId] || null;
  };
  const compat = checkDraftCompatibility(shaped.draft || draft, lookup);
  if (!compat.ok) return null;
  const needsProfile = checks.some((c) => String((c && c.compare_to) || "").indexOf("profile.") === 0);
  return {
    id, label,
    documents: documents.slice(),
    docDefs,
    checks: checks.slice(),
    requirement: requirement ? JSON.parse(JSON.stringify(requirement)) : null,
    needs_profile: needsProfile,
    not_checked: notChecked.slice(),
  };
}

// resolveProcess(admin, processId, userId) -> { def, docs } | null.
// Builtins need no database. Saved rows need ownership + re-validation.
async function resolveProcess(admin, processId, userId) {
  if (typeof processId !== "string" || !processId) return null;
  if (typeof userId !== "string" || !userId) return null;
  const builtin = getProcess(processId);
  if (builtin) {
    const docs = {};
    const list = Array.isArray(builtin.documents) ? builtin.documents : [];
    for (const docId of list) {
      const d = getDocumentType(docId);
      if (!d) return null;
      docs[docId] = d;
    }
    return { def: builtin, docs, isBuiltin: true };
  }
  if (!isSavedProcessId(processId)) return null;
  if (!admin || typeof admin.from !== "function") return null;
  let row = null;
  try {
    const res = await admin.from("saved_processes").select("process_key,definition,user_id").eq("process_key", processId).maybeSingle();
    row = res && res.data ? res.data : null;
  } catch { return null; }
  if (!row || row.user_id !== userId) return null;
  if (row.process_key && row.process_key !== processId) return null;
  const clean = validateSavedDefinition(row.definition);
  if (!clean || clean.id !== processId) return null;
  const docs = {};
  for (const docId of clean.documents) {
    if (BUILTIN_DOC_IDS.indexOf(docId) >= 0) {
      const b = getDocumentType(docId);
      if (!b) return null;
      docs[docId] = b;
    } else {
      const inline = clean.docDefs[docId];
      if (!inline) return null;
      docs[docId] = inline;
    }
  }
  return { def: clean, docs, isBuiltin: false };
}

// resolveDocumentType(bundle, docTypeId) -> doc def | null.
// Checks builtins first, then the bundle's inline defs.
function resolveDocumentType(bundle, docTypeId) {
  if (typeof docTypeId !== "string" || !docTypeId) return null;
  const builtin = getDocumentType(docTypeId);
  if (builtin) return builtin;
  if (bundle && bundle.docs && bundle.docs[docTypeId]) return bundle.docs[docTypeId];
  return null;
}

// listProcessesForUser(admin, userId) -> summaries for /start.
// Builtins always; owned saved rows appended (bad rows skipped).
async function listProcessesForUser(admin, userId) {
  const builtins = listProcesses();
  if (!admin || typeof admin.from !== "function") return builtins;
  if (typeof userId !== "string" || !userId) return builtins;
  let rows = [];
  try {
    const res = await admin.from("saved_processes").select("process_key,definition").eq("user_id", userId);
    rows = res && Array.isArray(res.data) ? res.data : [];
  } catch { return builtins; }
  const out = builtins.slice();
  for (const row of rows) {
    if (!row || typeof row.process_key !== "string") continue;
    if (!isSavedProcessId(row.process_key)) continue;
    const clean = validateSavedDefinition(row.definition);
    if (!clean || clean.id !== row.process_key) continue;
    out.push({
      id: clean.id,
      label: clean.label,
      documents: clean.documents.slice(),
      hasRequirement: !!clean.requirement,
      needs_profile: clean.needs_profile,
    });
  }
  return out;
}

module.exports = {
  SAVED_KEY_RE,
  DEFAULT_CODE_PATTERN,
  isSavedProcessId,
  validateSavedDefinition,
  resolveProcess,
  resolveDocumentType,
  listProcessesForUser,
};



