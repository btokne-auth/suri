// lib/clarify.js
// Step 9B Act 2: pure helpers for Suri asks before it flags.
// No DB, no fetch, no secrets. Only string logic + filtering.
const { baseNormalize } = require('./checks/names');
const MAX_CLARIFICATIONS = 3;
function buildPairKey(fieldKey, valueA, valueB) {
  const key = String(fieldKey || '').trim();
  const normA = baseNormalize(valueA);
  const normB = baseNormalize(valueB);
  const sorted = [normA, normB].sort();
  return key + '|' + sorted[0] + '|' + sorted[1];
}
function fieldAllowsQuestion(docDef, fieldKey) {
  if (!docDef || !Array.isArray(docDef.fields)) return false;
  if (typeof fieldKey !== 'string' || !fieldKey) return false;
  const field = docDef.fields.find(function (f) { return f && f.key === fieldKey; });
  if (!field) return false;
  if (field.type === 'name') {
    if (field.clarify === undefined) return true;
    return Boolean(field.clarify);
  }
  return Boolean(field.clarify);
}
function hasHtmlTag(s) { return /<[^>]*>/.test(s); }
function hasLink(s) { return /https?:\/\//i.test(s); }
function hasAngleBrackets(s) { return /[<>]/.test(s); }
function hasControlChars(s) { return /[\u0000-\u001F\u007F]/.test(s); }
function validateQuestion(q) {
  if (typeof q !== 'string') return { ok: false, error: 'Question must be a string.' };
  const trimmed = q.trim();
  if (trimmed.length < 1) return { ok: false, error: 'Question is empty.' };
  if (trimmed.length > 160) return { ok: false, error: 'Question is too long (max 160).' };
  if (trimmed.charAt(trimmed.length - 1) !== '?') return { ok: false, error: 'Question must end with ?.' };
  if (hasHtmlTag(trimmed)) return { ok: false, error: 'Question must not contain HTML.' };
  if (hasLink(trimmed)) return { ok: false, error: 'Question must not contain links.' };
  if (hasAngleBrackets(trimmed)) return { ok: false, error: 'Question must not contain < or >.' };
  if (hasControlChars(trimmed)) return { ok: false, error: 'Question must not contain control characters.' };
  return { ok: true, value: trimmed };
}
function templateQuestion(label, a, b) {
  const safeLabel = String(label || '').slice(0, 40).trim() || 'Name';
  const safeA = String(a == null ? '' : a).slice(0, 40);
  const safeB = String(b == null ? '' : b).slice(0, 40);
  const question = 'Is "' + safeA + '" the same person as "' + safeB + '" for ' + safeLabel + '?';
  if (question.length > 160) return question.slice(0, 159) + '?';
  return question;
}
function validateAnswer(answer) {
  if (typeof answer !== 'string') return { ok: false, error: 'Answer must be a string.' };
  const trimmed = answer.trim();
  if (trimmed.length < 1) return { ok: false, error: 'Answer is empty.' };
  if (trimmed.length > 200) return { ok: false, error: 'Answer is too long (max 200).' };
  if (hasHtmlTag(trimmed)) return { ok: false, error: 'Answer must not contain HTML.' };
  if (hasControlChars(trimmed)) return { ok: false, error: 'Answer must not contain control characters.' };
  return { ok: true, value: trimmed };
}
function extractPairValues(row) {
  if (!row || typeof row !== 'object') return ['', ''];
  if (row.value_a !== undefined || row.value_b !== undefined) {
    return [row.value_a == null ? '' : String(row.value_a), row.value_b == null ? '' : String(row.value_b)];
  }
  if (row.a !== undefined || row.b !== undefined) {
    return [row.a == null ? '' : String(row.a), row.b == null ? '' : String(row.b)];
  }
  if (row.extracted_value !== undefined || row.expected_value !== undefined) {
    return [row.extracted_value == null ? '' : String(row.extracted_value), row.expected_value == null ? '' : String(row.expected_value)];
  }
  if (row.document_value !== undefined || row.compared_value !== undefined) {
    return [row.document_value == null ? '' : String(row.document_value), row.compared_value == null ? '' : String(row.compared_value)];
  }
  return ['', ''];
}
function pickUniquePairs(rows, getDocDef, existingCount) {
  let getDef = null;
  let existing = 0;
  if (typeof getDocDef === 'function') {
    getDef = getDocDef;
    if (typeof existingCount === 'number') existing = existingCount;
  } else if (typeof getDocDef === 'number') {
    existing = getDocDef;
  } else if (getDocDef && typeof getDocDef === 'object' && !Array.isArray(getDocDef)) {
    if (typeof getDocDef.getDocDef === 'function') getDef = getDocDef.getDocDef;
    else if (typeof getDocDef.getDocDefFn === 'function') getDef = getDocDef.getDocDefFn;
    if (typeof getDocDef.existingCount === 'number') existing = getDocDef.existingCount;
    else if (typeof getDocDef.existing === 'number') existing = getDocDef.existing;
  }
  if (!Array.isArray(rows)) return [];
  if (typeof existing !== 'number' || existing < 0) existing = 0;
  const remaining = MAX_CLARIFICATIONS - existing;
  if (remaining <= 0) return [];
  const eligible = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    if (r.result !== 'check') continue;
    if (r.rule !== 'filipino_name') continue;
    if (getDef) {
      const def = getDef(r);
      let docDef = def;
      if (docDef && !Array.isArray(docDef.fields) && typeof docDef === 'object') {
        const typeKey = r.document_type || r.doc_type || r.docType || null;
        if (typeKey && docDef[typeKey] && Array.isArray(docDef[typeKey].fields)) docDef = docDef[typeKey];
      }
      if (docDef && !fieldAllowsQuestion(docDef, r.field_key)) continue;
      if (!docDef) continue;
    }
    const vals = extractPairValues(r);
    const pairKey = buildPairKey(r.field_key || '', vals[0], vals[1]);
    const withKey = Object.assign({}, r, { pair_key: pairKey, _value_a: vals[0], _value_b: vals[1] });
    eligible.push(withKey);
  }
  eligible.sort(function (a, b) {
    const aTime = a.created_at ? String(a.created_at) : '';
    const bTime = b.created_at ? String(b.created_at) : '';
    if (aTime < bTime) return -1;
    if (aTime > bTime) return 1;
    const aField = String(a.field_key || '');
    const bField = String(b.field_key || '');
    if (aField < bField) return -1;
    if (aField > bField) return 1;
    const aKey = String(a.pair_key || '');
    const bKey = String(b.pair_key || '');
    if (aKey < bKey) return -1;
    if (aKey > bKey) return 1;
    return 0;
  });
  const seen = new Map();
  for (const row of eligible) {
    const k = row.pair_key;
    if (!seen.has(k)) seen.set(k, row);
  }
  const unique = Array.from(seen.values());
  return unique.slice(0, remaining);
}
module.exports = {
  MAX_CLARIFICATIONS,
  buildPairKey,
  fieldAllowsQuestion,
  validateQuestion,
  templateQuestion,
  validateAnswer,
  pickUniquePairs,
};
