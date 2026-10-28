// lib/checks/run-checks.js
// Step 6: mismatch checks + cross-document checks + requirement check.
// Code makes every comparison, never the model.
// Pure builders below (tested); the database runner is at the end.

const { compareFilipinoNames } = require('./names');
const { getDocumentType } = require('../documents');

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

// Builds the reviewer/applicant row reason when the requirement fails,
// from the process settings only (never hard-coded town or doc names).
// Example: "Read OK — address city municipality is outside Linawan".
function buildRequirementFailReason(processDef) {
  const req = processDef && processDef.requirement;
  if (!req) return 'Read OK.';
  const docDef = getDocumentType(req.document);
  const docLabel = docDef ? docDef.label : req.document;
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
  return checkRequirementCity(cityValue, processDef);
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

function applyRule(rule, fieldKey, left, right) {
  if (rule === 'filipino_name') return compareFilipinoNames(left, right);
  if (rule === 'same_date') return compareSameDate(fieldKey, left, right);
  return null;
}

// Display label for "same as X": a null compared_document_id means the
// profile; otherwise look up the compared document's type label from the
// document settings (never hard-coded). typeById maps document id -> doc_type.
function comparedLabel(comparedDocumentId, typeById) {
  if (!comparedDocumentId) return 'your profile';
  const t = typeById ? typeById[comparedDocumentId] : null;
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
  const def = getDocumentType(docType);
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
  const docsRes = await admin.from('documents').select('id,doc_type,created_at').eq('submission_id', submissionId).in('status', ['needs_review', 'approved']);
  const allDocs = (docsRes && docsRes.data) || [];
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
  const counts = { match: 0, check: 0, mismatch: 0, invalid: 0 };
  const currentRows = [];
  for (const d of activeDocs) {
    const rows = buildCheckRows({ docType: d.doc_type, documentId: d.id, myFields: byDoc[d.id] || {}, profileFullName, profileDob, others: docsWithFields });
    await admin.from('check_results').delete().eq('document_id', d.id);
    if (rows.length > 0) {
      const toSave = rows.map((r) => ({ document_id: d.id, compared_document_id: r.compared_document_id, field_key: r.field_key, rule: r.rule, result: r.result, reason: String(r.reason || '').slice(0, 200) }));
      await admin.from('check_results').insert(toSave);
    }
    if (d.id === src.documentId) {
      for (const r of rows) currentRows.push(r);
    }
    for (const r of rows) {
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
    const { getProcess } = require('../processes/index.js');
    const proc = getProcess(sub.process_id);
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
  return { rows: currentRows, requirement, counts, refreshed: activeDocs.length };
}

module.exports = { buildCheckRows, checkRequirementCity, buildRequirementFailReason, comparedLabel, compareSameDate, newestByCreatedAt, newestPerType, decideRequirement, runChecksForDocument };
