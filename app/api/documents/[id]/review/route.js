// app/api/documents/[id]/review/route.js
// Step 7: reviewer actions (demo mode, same visitor, own submission only).
// POST { action: 'approve' | 'reject' | 'correct', field_key?, new_value? }
// All writes via admin client after getClaims() + ownership check.
// Corrections use the same Zod field rules; impossible values are rejected.
// After a correction, checks are re-run.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { resolveProcess, resolveDocumentType } = require('../../../../../lib/processes/resolve.js');
const { buildValueSchema, normalizeAmount } = require('../../../../../lib/validation.js');
const { runChecksForDocument } = require('../../../../../lib/checks/run-checks.js');
const { isOwnedBy } = require('../../../../../lib/review-auth.js');
export async function POST(request, ctx) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return NextResponse.json({ error: 'No session.' }, { status: 401 });
  const params = await ctx.params;
  const docId = params?.id;
  if (typeof docId !== 'string' || !docId) return NextResponse.json({ error: 'Bad id.' }, { status: 400 });
  let body = null;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }); }
  const action = body?.action;
  if (action !== 'approve' && action !== 'reject' && action !== 'correct') {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: doc } = await admin.from('documents').select('id,doc_type,submission_id,status').eq('id', docId).maybeSingle();
  if (!doc) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: sub } = await admin.from('submissions').select('id,user_id,process_id').eq('id', doc.submission_id).maybeSingle();
  if (!isOwnedBy(sub, userId)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (action === 'approve' || action === 'reject') {
    const next = action === 'approve' ? 'approved' : 'rejected';
    await admin.from('documents').update({ status: next }).eq('id', docId);
    await admin.from('review_actions').insert({ document_id: docId, reviewer_id: userId, action, field_key: null, old_value: null, new_value: null });
    await admin.from('work_log').insert({ submission_id: doc.submission_id, step_type: 'review_' + action, message: (doc.doc_type + ' ' + action + 'd by reviewer').slice(0, 200) });
    return NextResponse.json({ ok: true, status: next });
  }
  const fieldKey = body?.field_key;
  let newValue = body?.new_value;
  if (typeof fieldKey !== 'string' || !fieldKey) return NextResponse.json({ error: 'Choose a field to correct.' }, { status: 400 });
  // Step 7c Part 2: corrections validate against the resolved doc def
  // (builtins unchanged via the same bundle path).
  const bundle = await resolveProcess(admin, sub.process_id, userId);
  if (!bundle) return NextResponse.json({ error: 'Unknown process.' }, { status: 400 });
  const def = resolveDocumentType(bundle, doc.doc_type);
  const fieldDef = def && Array.isArray(def.fields) ? def.fields.find((f) => f.key === fieldKey) : null;
  if (!fieldDef) return NextResponse.json({ error: 'Unknown field.' }, { status: 400 });
  if (typeof newValue !== 'string' && typeof newValue !== 'number') {
    return NextResponse.json({ error: 'Type a new value.' }, { status: 400 });
  }
  if (typeof newValue === 'string') newValue = newValue.trim();
  if (newValue === '' || newValue == null) return NextResponse.json({ error: 'Type a new value.' }, { status: 400 });
  let toCheck = newValue;
  if (fieldDef.type === 'number') {
    if (typeof newValue === 'number') {
      if (!Number.isFinite(newValue)) return NextResponse.json({ error: fieldDef.key + ' looks wrong: expected a number.' }, { status: 400 });
      toCheck = newValue;
    } else {
      const n = normalizeAmount(String(newValue));
      if (n === null) return NextResponse.json({ error: fieldDef.key + ' looks wrong: expected a number.' }, { status: 400 });
      toCheck = n;
    }
  }
  let schema = null;
  try { schema = buildValueSchema(fieldDef); }
  catch { return NextResponse.json({ error: 'Could not check this field.' }, { status: 500 }); }
  const res = schema.safeParse(toCheck);
  if (!res.success) {
    const msg = (res.error && res.error.issues && res.error.issues[0] && res.error.issues[0].message) || (fieldKey + ' looks wrong.');
    return NextResponse.json({ error: String(msg).slice(0, 200) }, { status: 400 });
  }
  // Step 7c Part 2: new-doc date floor (1900-01-01..today) on corrections too.
  // Builtins skip the floor (unchanged behavior).
  if (fieldDef.type === 'date' && bundle && !bundle.isBuiltin && typeof toCheck === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(toCheck) && toCheck < '1900-01-01') {
      return NextResponse.json({ error: fieldKey + " looks wrong: date can't be before 1900-01-01." }, { status: 400 });
    }
  }
  const { data: oldRow } = await admin.from('extracted_fields').select('value_text').eq('document_id', docId).eq('field_key', fieldKey).maybeSingle();
  const oldValue = oldRow ? oldRow.value_text : null;
  const storeValue = String(toCheck);
  const up = await admin.from('extracted_fields').upsert({ document_id: docId, field_key: fieldKey, value_text: storeValue, confidence: 'high', unreadable: false }, { onConflict: 'document_id,field_key' });
  if (up.error) return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 });
  await admin.from('review_actions').insert({ document_id: docId, reviewer_id: userId, action: 'correct', field_key: fieldKey, old_value: oldValue, new_value: storeValue });
  await admin.from('work_log').insert({ submission_id: doc.submission_id, step_type: 'review_correct', message: (doc.doc_type + ' ' + fieldKey + ' corrected').slice(0, 200) });
  if (doc.status === 'rejected' || doc.status === 'approved' || doc.status === 'retake_needed' || doc.status === 'error') {
    await admin.from('documents').update({ status: 'needs_review' }).eq('id', docId);
  }
  try { await runChecksForDocument({ admin, submissionId: doc.submission_id, documentId: docId }); }
  catch { await admin.from('work_log').insert({ submission_id: doc.submission_id, step_type: 'check_failed', message: 'Could not finish checks. A person will review.' }); }
  return NextResponse.json({ ok: true });
}
