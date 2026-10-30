// lib/checks/run-checks.js
// Step 6: mismatch checks + cross-document checks + requirement check.
// Code makes every comparison, never the model.
// Pure builders below (tested); the database runner is at the end.

const { compareFilipinoNames } = require('./names');
const { compareSumEquals, parseAmount } = require('./arithmetic');
const { equalsValue, containsValue } = require('./text');
const { isNotFuture, isWithinMonths } = require('./dates');
const { getDocumentType } = require('../documents');

function isActiveForChecks(status) {
  return status === 'needs_review' || status === 'approved';
}

// Requirement check ignores case and extra spaces only (generic equals).
// A different spelling fails as a flag the reviewer can override.
// Accents are NOT folded here.
function normValue(raw) {
  return String(raw || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Pure: requirement value passes, another value fails, missing = retake.
// Never returns fail for an unreadable or missing value.
// A process with no requirement skips.
function checkRequirementCity(reqValue, processDef) {
  const req = processDef && processDef.requirement;
  if (!req) return { outcome: 'skip', message: '' };
  if (reqValue == null || String(reqValue).trim() === '') {
    const fieldWord = String(req.field || 'value').replace(/_/g, ' ').trim() || 'value';
    return { outcome: 'retake', message: "Couldn't read the " + fieldWord + ", please retake." };
  }
  const got = normValue(reqValue);
  const want = normValue(req.value);
  if (got === want) return { outcome: 'pass', message: '' };
  return { outcome: 'fail', message: req.message || 'Requirement not met.' };
}

function checkRequirement(reqValue, processDef) {
  const req = processDef && processDef.requirement;
  if (!req) return { outcome: 'skip', message: '' };
  if (reqValue == null || String(reqValue).trim() === '') {
    const fieldWord = String(req.field || 'value').replace(/_/g, ' ').trim() || 'value';
    return { outcome: 'retake', message: "Couldn't read the " + fieldWord + ', please retake.' };
  }
  if ((req.op || 'equals') === 'contains') {
    if (containsValue(reqValue, req.value)) return { outcome: 'pass', message: '' };
    return { outcome: 'fail', message: req.message || 'Requirement not met.' };
  }
  return checkRequirementCity(reqValue, processDef);
}

// Builds the reviewer/applicant row reason when the requirement fails,
// from the process settings only (never hard-coded town or doc names).
// Example: "Read OK — address city municipality is outside Linawan".
// Step 7c Part 2: optional docsMap (bundle.docs) for saved inline labels.
// Builtins call with one arg (unchanged behavior).
function buildRequirementFailReason(processDef, docsMap) {
  const req = processDef && processDef.requirement;
  if (!req) return 'Read OK.';
  let docLabel = req.document;
  if (docsMap && docsMap[req.document] && docsMap[req.document].label) {
    docLabel = docsMap[req.document].label;
  } else {
    const docDef = getDocumentType(req.document);
    docLabel = docDef ? docDef.label : req.document;
  }
  // Human word for the field: underscores become spaces, no hard-codes.
  const fieldWord = String(req.field || 'value').replace(/_/g, ' ').trim() || 'value';
  return 'Read OK — ' + fieldWord + ' is outside ' + String(req.value) + ' (' + docLabel + ').';
}

// Newest document wins: largest created_at; ties go to the later row.
// Pure: no database, tested below.
function newestByCreatedAt(docs) {
  let best = null;
  for (const d of docs || []) {
    if (!d) continue;
    if (!best) { best = d; continue; }
    const bt = best.created_at ? Date.parse(best.created_at) : NaN;
    const dt = d.created_at ? Date.parse(d.created_at) : NaN;
    if (!Number.isNaN(dt) && (Number.isNaN(bt) || dt >= bt)) best = d;
  }
  return best;
}

// Newest upload per doc_type wins ("replaced"): older uploads stay in the
// database and work log but are never compared against or counted.
// Pure: no database, tested below.
function newestPerType(docs) {
  const byType = {};
  for (const d of docs || []) {
    if (!d) continue;
    const t = d.doc_type || d.docType;
    if (!t) continue;
    const cur = byType[t];
    if (!cur || newestByCreatedAt([cur, d]) === d) byType[t] = d;
  }
  return byType;
}

// Only the newest readable requirement document decides.
// Older requirement documents stay visible but are ignored.
// Pure: fieldsByDoc maps document id -> { fieldKey: { value, unreadable } }.
function decideRequirement(newestDoc, fieldsByDoc, processDef) {
  if (!newestDoc) return { outcome: 'skip', message: '' };
  const req = processDef && processDef.requirement;
  if (!req) return { outcome: 'skip', message: '' };
  const fields = (fieldsByDoc || {})[newestDoc.id] || {};
  const entry = fields[req.field];
  const cityValue = readable(entry) ? entry.value : null;
  return checkRequirement(cityValue, processDef);
}

// Pure: exact YYYY-MM-DD match only. Missing side means skip, never mismatch.
function compareSameDate(fieldKey, a, b) {
  const label = fieldKey === 'date_of_birth' ? 'Birth date' : String(fieldKey);
  if (a == null || b == null) return null;
  if (String(a).trim() === '' || String(b).trim() === '') return null;
  if (String(a).trim() === String(b).trim()) {
    return { result: 'match', reason: label + ' matches.' };
  }
  return { result: 'mismatch', reason: label + ' is different: ' + a + ' vs ' + b + '.' };
}

function applyRule(rule, fieldKey, left, right, opts) {
  const o = opts || {};
  if (rule === 'filipino_name') return compareFilipinoNames(left, right);
  if (rule === 'same_date') return compareSameDate(fieldKey, left, right);
  if (rule === 'equals') return compareEquals(fieldKey, left, (o.value !== undefined ? o.value : right), o.message, { label: o.label });
  if (rule === 'contains') return compareContains(fieldKey, left, (o.value !== undefined ? o.value : right), o.message, { label: o.label });
  if (rule === 'not_future') return compareNotFuture(fieldKey, left, o);
  if (rule === 'within_months') return compareWithinMonths(fieldKey, left, o);
  return null;
}

// Human label for a field key: "billing_address" -> "Billing Address".
// Used when no stored label is available. Never returns the raw key.
function fieldKeyToLabel(key) {
  const s = String(key || 'value').replace(/_/g, ' ').trim() || 'value';
  return s.split(/\s+/).map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : '')).join(' ');
}

// Step 7c Part 1: literal + time rules. Pure, null = skip (never mismatch).
// MATCH wording uses the field's label, never the key. Mismatch keeps the
// office's own message. Built-in processes never use these four rules.
function compareEquals(fieldKey, value, expected, message, extra) {
  const label = (extra && extra.label) ? String(extra.label) : fieldKeyToLabel(fieldKey);
  if (value == null || expected == null) return null;
  if (String(value).trim() === '' || String(expected).trim() === '') return null;
  if (equalsValue(value, expected)) return { result: 'match', reason: label + ' is "' + String(expected) + '".' };
  return { result: 'mismatch', reason: String(message || (label + ' is different.')).slice(0, 200) };
}

function compareContains(fieldKey, value, needle, message, extra) {
  const label = (extra && extra.label) ? String(extra.label) : fieldKeyToLabel(fieldKey);
  if (value == null || needle == null) return null;
  if (String(value).trim() === '' || String(needle).trim() === '') return null;
  if (containsValue(value, needle)) return { result: 'match', reason: label + ' includes "' + String(needle) + '".' };
  return { result: 'mismatch', reason: String(message || (label + ' does not contain "' + needle + '".')).slice(0, 200) };
}

function compareNotFuture(fieldKey, value, opts) {
  const o = opts || {};
  const label = o.label ? String(o.label) : fieldKeyToLabel(fieldKey);
  if (value == null || String(value).trim() === '') return null;
  const ok = isNotFuture(String(value).trim(), o.nowMs);
  if (ok === null) return null;
  if (ok) return { result: 'match', reason: label + ' is not in the future.' };
  return { result: 'mismatch', reason: String(o.message || (label + ' is in the future.')).slice(0, 200) };
}

function compareWithinMonths(fieldKey, value, opts) {
  const o = opts || {};
  const label = o.label ? String(o.label) : fieldKeyToLabel(fieldKey);
  if (value == null || String(value).trim() === '') return null;
  const months = o.months;
  if (!Number.isInteger(months) || months < 1 || months > 24) return null;
  const ok = isWithinMonths(String(value).trim(), months, o.nowMs);
  if (ok === null) return null;
  if (ok) return { result: 'match', reason: label + ' is within the last ' + months + ' months.' };
  return { result: 'mismatch', reason: String(o.message || (label + ' is older than ' + months + ' months.')).slice(0, 200) };
}

// Step 7c Part 1: process-level draft checks (pure, no database).
// Symmetric cross-doc rules (filipino_name, same_date) emit mirror rows on
// BOTH documents; asymmetric/time/literal/profile rules emit one row.
// Every row: { document_id, compared_document_id, field_key, rule, result, reason }.
// Single-sided own-field rows use compared_document_id = own id (self-like,
// so the checklist hides "same as"); profile rows use null; cross-doc rows
// point at the other side. Unreadable/missing sides skip, never mismatch.
const SYMMETRIC_CROSS_RULES = ['filipino_name', 'same_date'];

// Label lookup for saved-process MATCH wording: the field's stored label
// wins (e.g. inline "Billing address"); otherwise Title-Case the key
// (e.g. billing_date -> "Billing Date"). Builtins have no stored labels,
// so they always fall back — builtin behavior is unchanged.
function fieldLabelFor(docsMap, docTypeId, fieldKey) {
  try {
    const def = docsMap && docsMap[docTypeId];
    const fields = def && def.fields;
    if (Array.isArray(fields)) {
      const found = fields.find((f) => f && f.key === fieldKey);
      if (found && found.label) return String(found.label);
    }
  } catch {
    // fall through to the key-based label
  }
  return fieldKeyToLabel(fieldKey);
}

function buildProcessCheckRows(args) {
  const src = args || {};
  const checks = Array.isArray(src.checks) ? src.checks : [];
  const docsById = src.docsById || {};
  const docIdByType = src.docIdByType || {};
  const docsMap = src.docs || src.docDefs || src.docsMap || null;
  const nowMs = src.nowMs;
  const rows = [];
  for (const c of checks) {
    if (!c || typeof c !== 'object') continue;
    const srcDocId = docIdByType[c.document];
    if (!srcDocId) continue;
    const srcFields = (docsById[srcDocId] && docsById[srcDocId].fields) || {};
    const leftEntry = srcFields[c.field];
    if (!readable(leftEntry)) continue;
    const ct = String(c.compare_to || '');
    const msg = typeof c.message === 'string' && c.message ? c.message : null;
    const label = fieldLabelFor(docsMap, c.document, c.field);
    if (ct === 'self' || ct === 'value') {
      if (!['equals', 'contains', 'not_future', 'within_months'].includes(c.rule)) continue;
      const res = applyRule(c.rule, c.field, leftEntry.value, null, { value: c.value, months: c.months, message: msg, nowMs, label });
      if (!res) continue;
      rows.push({ document_id: srcDocId, compared_document_id: srcDocId, field_key: c.field, rule: c.rule, result: res.result, reason: res.reason });
      continue;
    }
    if (ct === 'profile.full_name' || ct === 'profile.date_of_birth') {
      const rightValue = ct === 'profile.full_name' ? src.profileFullName : src.profileDob;
      if (rightValue == null || String(rightValue).trim() === '') continue;
      const res = applyRule(c.rule, c.field, leftEntry.value, rightValue, { value: c.value, months: c.months, message: msg, nowMs, label });
      if (!res) continue;
      const reason = res.result !== 'match' && msg ? msg : res.reason;
      rows.push({ document_id: srcDocId, compared_document_id: null, field_key: c.field, rule: c.rule, result: res.result, reason });
      continue;
    }
    const dot = ct.indexOf('.');
    if (dot < 0) continue;
    const otherType = ct.slice(0, dot);
    const otherField = ct.slice(dot + 1);
    const otherDocId = docIdByType[otherType];
    if (!otherDocId || otherDocId === srcDocId) continue;
    const otherFields = (docsById[otherDocId] && docsById[otherDocId].fields) || {};
    const rightEntry = otherFields[otherField];
    if (!readable(rightEntry)) continue;
    const res = applyRule(c.rule, c.field, leftEntry.value, rightEntry.value, { value: c.value, months: c.months, message: msg, nowMs, label });
    if (!res) continue;
    const reason = res.result !== 'match' && msg ? msg : res.reason;
    rows.push({ document_id: srcDocId, compared_document_id: otherDocId, field_key: c.field, rule: c.rule, result: res.result, reason });
    if (SYMMETRIC_CROSS_RULES.includes(c.rule)) {
      rows.push({ document_id: otherDocId, compared_document_id: srcDocId, field_key: otherField, rule: c.rule, result: res.result, reason });
    }
  }
  return rows;
}

// Step 7b: within-document sum check (self_checks).
// Empty/absent source slots count as 0. If ALL source slots are
// empty/absent, skip (return null: no row, not a mismatch).
// Any unreadable side or missing target also skips, never mismatches.
function applySelfCheck(selfCheck, myFields) {
  if (!selfCheck || selfCheck.rule !== 'sum_equals') return null;
  const sources = Array.isArray(selfCheck.fields) ? selfCheck.fields : [];
  const targetKey = selfCheck.equals;
  if (sources.length === 0 || typeof targetKey !== 'string' || !targetKey) return null;
  const targetEntry = myFields ? myFields[targetKey] : null;
  if (!readable(targetEntry)) return null;
  const target = parseAmount(targetEntry.value);
  if (target === null) return null;
  let anySourcePresent = false;
  const values = [];
  for (const k of sources) {
    const e = myFields ? myFields[k] : null;
    if (e && e.unreadable === true) return null;
    if (!e || e.value == null || (typeof e.value === 'string' && e.value.trim() === '')) {
      continue;
    }
    const n = parseAmount(e.value);
    if (n === null) return null;
    anySourcePresent = true;
    values.push(n);
  }
  if (!anySourcePresent) return null;
  for (let i = 0; i < sources.length - values.length; i++) values.push(0);
  const tol = typeof selfCheck.tolerance === 'number' ? selfCheck.tolerance : 0.01;
  const res = compareSumEquals(values, target, tol);
  if (!res) return null;
  if (res.result === 'match') return { result: 'match', reason: String(selfCheck.match_message || 'Amounts add up.') };
  return { result: 'mismatch', reason: String(selfCheck.message || "Amounts don't add up.") };
}

// Display label for "same as X": a null compared_document_id means the
// profile; otherwise look up the compared document's type label from the
// document settings (never hard-coded). typeById maps document id -> doc_type.
// Step 7c Part 2: optional docsMap (bundle.docs) for saved inline labels.
function comparedLabel(comparedDocumentId, typeById, docsMap) {
  if (!comparedDocumentId) return 'your profile';
  const t = typeById ? typeById[comparedDocumentId] : null;
  if (t && docsMap && docsMap[t] && docsMap[t].label) return docsMap[t].label;
  const def = t ? getDocumentType(t) : null;
  return def ? def.label : 'the other document';
}

function readable(entry) {
  if (!entry || entry.unreadable === true) return false;
  const v = entry.value;
  if (v == null) return false;
  if (typeof v === 'string' && v.trim() === '') return false;
  return true;
}

function buildCheckRows(args) {
  const src = args || {};
  const docType = src.docType;
  const myFields = src.myFields || {};
  // Newest upload per type wins: cross-checks never compare against
  // replaced (older same-type) uploads.
  const rawOthers = src.others || [];
  const othersByType = newestPerType(rawOthers.map((o) => (o ? { doc_type: o.docType || o.doc_type, created_at: o.created_at, ref: o } : null)).filter(Boolean));
  const others = Object.values(othersByType).map((w) => w.ref);
  // Step 7c Part 2: explicit def wins (saved inline defs); builtins fall
  // back to the registry. Behavior for builtins is unchanged.
  const def = src.docDef || getDocumentType(docType);
  if (!def) return [];
  const rows = [];
  const checks = Array.isArray(def.checks) ? def.checks : [];
  for (const c of checks) {
    const leftEntry = myFields[c.field];
    if (!readable(leftEntry)) continue;
    let rightValue = null;
    if (c.compare_to === 'profile.full_name') rightValue = src.profileFullName;
    else if (c.compare_to === 'profile.date_of_birth') rightValue = src.profileDob;
    else continue;
    if (rightValue == null || String(rightValue).trim() === '') continue;
    const res = applyRule(c.rule, c.field, leftEntry.value, rightValue);
    if (!res) continue;
    rows.push({ field_key: c.field, rule: c.rule, result: res.result, reason: res.reason, compared_document_id: null });
  }
  const cross = Array.isArray(def.cross_checks) ? def.cross_checks : [];
  for (const cc of cross) {
    const leftEntry = myFields[cc.field];
    if (!readable(leftEntry)) continue;
    const refs = Array.isArray(cc.compare_to) ? cc.compare_to : [];
    for (const ref of refs) {
      const dot = String(ref).indexOf('.');
      if (dot < 0) continue;
      const refType = String(ref).slice(0, dot);
      const refField = String(ref).slice(dot + 1);
      const other = others.find((o) => o && (o.docType === refType || o.doc_type === refType));
      const otherId = other ? (other.docId || other.document_id || null) : null;
      if (!other || !otherId) continue;
      if (otherId === src.documentId) continue;
      const rightEntry = other.fields ? other.fields[refField] : null;
      if (!readable(rightEntry)) continue;
      const res = applyRule(cc.rule, cc.field, leftEntry.value, rightEntry.value);
      if (!res) continue;
      rows.push({ field_key: cc.field, rule: cc.rule, result: res.result, reason: res.reason, compared_document_id: otherId });
    }
  }
  const selfList = Array.isArray(def.self_checks) ? def.self_checks : [];
  for (const sc of selfList) {
    const res = applySelfCheck(sc, myFields);
    if (!res) continue;
    rows.push({ field_key: sc.equals, rule: 'sum_equals', result: res.result, reason: res.reason, compared_document_id: src.documentId || null });
  }
  return rows;
}

// Runs checks + cross-checks for the NEWEST readable document per type,
// deleting and rewriting each active document's check_results. Upload order
// does not matter: a late upload refreshes the earlier ones too. Older
// uploads of the same type are "replaced": kept in the database and work
// log, but never compared against or counted.
async function runChecksForDocument(args) {
  const src = args || {};
  const admin = src.admin;
  const submissionId = src.submissionId;
  const empty = { rows: [], requirement: 'skip', counts: { match: 0, check: 0, mismatch: 0, invalid: 0 }, refreshed: 0 };
  if (!admin || !submissionId) return empty;
  const subRes = await admin.from('submissions').select('id,user_id,process_id,status').eq('id', submissionId).maybeSingle();
  const sub = subRes ? subRes.data : null;
  if (!sub) return empty;
  let profileFullName = null;
  let profileDob = null;
  const profRes = await admin.from('profiles').select('given_name,middle_name,surname,suffix,birth_date').eq('user_id', sub.user_id).maybeSingle();
  const prof = profRes ? profRes.data : null;
  if (prof) {
    const parts = [prof.given_name, prof.middle_name, prof.surname, prof.suffix].filter((v) => v != null && String(v).trim() !== '');
    if (parts.length > 0) profileFullName = parts.join(' ');
    profileDob = prof.birth_date || null;
  }
  // Only needs_review / approved are active: wrong_document / retake_needed / error are excluded
  // (requirement gate + checks never run on them; neither locks nor fails).
  const docsRes = await admin.from('documents').select('id,doc_type,created_at,status').eq('submission_id', submissionId).in('status', ['needs_review', 'approved']);
  const allDocsRaw = (docsRes && docsRes.data) || [];
  const allDocs = allDocsRaw.filter((d) => d && d.status !== 'wrong_document' && d.status !== 'retake_needed' && d.status !== 'error');
  if (allDocs.length === 0) return empty;
  const activeByType = newestPerType(allDocs);
  const activeDocs = Object.values(activeByType);
  const ids = activeDocs.map((d) => d.id);
  const fRes = await admin.from('extracted_fields').select('document_id,field_key,value_text,unreadable').in('document_id', ids);
  const byDoc = {};
  for (const r of (fRes && fRes.data) || []) {
    if (!byDoc[r.document_id]) byDoc[r.document_id] = {};
    byDoc[r.document_id][r.field_key] = { value: r.value_text, unreadable: r.unreadable === true };
  }
  const docsWithFields = activeDocs.map((d) => ({ docId: d.id, docType: d.doc_type, fields: byDoc[d.id] || {} }));
  // Step 7c Part 2: resolve the process bundle (builtins + owned saved).
  // Builtins resolve with no database; behavior below is unchanged for them.
  let bundle = null;
  try {
    const { resolveProcess } = require('../processes/resolve.js');
    bundle = await resolveProcess(admin, sub.process_id, sub.user_id);
  } catch { bundle = null; }
  if (!bundle) return empty;
  const procForChecks = bundle.def;
  const docsMap = bundle.docs || {};
  const counts = { match: 0, check: 0, mismatch: 0, invalid: 0 };
  const currentRows = [];
  // Saved process-level checks run once across all active docs (mirror rows).
  let savedRowsByDoc = {};
  if (!bundle.isBuiltin && procForChecks && Array.isArray(procForChecks.checks) && procForChecks.checks.length > 0) {
    try {
      const docIdByType = {};
      for (const t of Object.keys(activeByType)) docIdByType[t] = activeByType[t].id;
      const docsById = {};
      for (const d of activeDocs) docsById[d.id] = { fields: byDoc[d.id] || {} };
      const savedRows = buildProcessCheckRows({ checks: procForChecks.checks, docIdByType, docsById, docs: docsMap, nowMs: Date.now(), profileFullName, profileDob });
      for (const r of savedRows) {
        if (!r || !r.document_id) continue;
        if (!savedRowsByDoc[r.document_id]) savedRowsByDoc[r.document_id] = [];
        savedRowsByDoc[r.document_id].push(r);
      }
    } catch { savedRowsByDoc = {}; }
  }
  for (const d of activeDocs) {
    const docDef = docsMap[d.doc_type] || getDocumentType(d.doc_type) || null;
    const rows = buildCheckRows({ docType: d.doc_type, docDef, documentId: d.id, myFields: byDoc[d.id] || {}, profileFullName, profileDob, others: docsWithFields });
    const extra = savedRowsByDoc[d.id] || [];
    const all = rows.concat(extra);
    await admin.from('check_results').delete().eq('document_id', d.id);
    if (all.length > 0) {
      const toSave = all.map((r) => ({ document_id: d.id, compared_document_id: r.compared_document_id, field_key: r.field_key, rule: r.rule, result: r.result, reason: String(r.reason || '').slice(0, 200) }));
      await admin.from('check_results').insert(toSave);
    }
    if (d.id === src.documentId) {
      for (const r of all) currentRows.push(r);
    }
    for (const r of all) {
      if (r.result === 'match') counts.match += 1;
      else if (r.result === 'check') counts.check += 1;
      else if (r.result === 'mismatch') counts.mismatch += 1;
      else counts.invalid += 1;
    }
  }
  const activeIds = new Set(activeDocs.map((d) => d.id));
  const replacedIds = allDocs.filter((d) => !activeIds.has(d.id)).map((d) => d.id);
  if (replacedIds.length > 0) {
    await admin.from('check_results').delete().in('document_id', replacedIds);
  }
  let refreshMsg = 'checks refreshed for ' + activeDocs.length + ' document(s): ' + counts.match + ' match, ' + counts.check + ' to confirm, ' + counts.mismatch + ' mismatch';
  if (replacedIds.length > 0) refreshMsg += '; ' + replacedIds.length + ' older upload(s) ignored';
  await admin.from('work_log').insert({ submission_id: submissionId, step_type: 'check_finished', message: refreshMsg.slice(0, 200) });
  // Requirement gate: only the NEWEST readable requirement document
  // decides (by created_at). Older ones stay visible but are ignored.
  // A passing newest ID sets the submission (back) to in_progress:
  // requirement_not_met is never permanent.
  let requirement = 'skip';
  try {
    const proc = procForChecks;
    const req = proc && proc.requirement ? proc.requirement : null;
    if (proc && req) {
      const newest = activeByType[req.document] || null;
      if (!newest) {
        requirement = 'skip';
      } else {
        const verdict = decideRequirement(newest, byDoc, proc);
        requirement = verdict.outcome;
        if (verdict.outcome === 'pass') {
          if (sub.status !== 'in_progress') {
            await admin.from('submissions').update({ status: 'in_progress' }).eq('id', submissionId);
          }
          await admin.from('work_log').insert({ submission_id: submissionId, step_type: 'requirement_check', message: 'Requirement passed.' });
        } else if (verdict.outcome === 'fail') {
          if (sub.status !== 'requirement_not_met') {
            await admin.from('submissions').update({ status: 'requirement_not_met' }).eq('id', submissionId);
          }
          await admin.from('work_log').insert({ submission_id: submissionId, step_type: 'requirement_check', message: String(verdict.message).slice(0, 200) });
        } else if (verdict.outcome === 'retake') {
          const fieldWord = String(req.field || 'value').replace(/_/g, ' ').trim() || 'value';
          await admin.from('work_log').insert({ submission_id: submissionId, step_type: 'requirement_check', message: (fieldWord + ' unreadable, please retake.').slice(0, 200) });
        }
      }
    }
  } catch { requirement = 'skip'; }
  // Step 9B Act 3: background clarifications for eligible check pairs.
  // Never blocks or throws; errors are caught and logged inside the helper.
  try {
    const { generateClarificationsForSubmission } = require('../clarify-ask.js');
    await generateClarificationsForSubmission({ admin, submissionId: submissionId });
  } catch {}
  return { rows: currentRows, requirement, counts, refreshed: activeDocs.length };
}

module.exports = { buildCheckRows, buildProcessCheckRows, checkRequirement, checkRequirementCity, buildRequirementFailReason, comparedLabel, compareSameDate, compareEquals, compareContains, compareNotFuture, compareWithinMonths, newestByCreatedAt, newestPerType, decideRequirement, runChecksForDocument, isActiveForChecks };
