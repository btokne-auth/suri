// app/api/submissions/[id]/route.js
// Step 6: GET set view data (owner only).
// Step 7: registry lookup + reviewer data + fail-wording fix.
// Step 7c Part 2: resolve builtins + owned saved_* via resolveProcess.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { resolveProcess, resolveDocumentType } = require('../../../../lib/processes/resolve.js');
const { buildRequirementFailReason, comparedLabel } = require('../../../../lib/checks/run-checks.js');
const { isStaleReading, READING_TIMEOUT_MESSAGE } = require('../../../../lib/reading-timeout.js');
const { retakeReason, wrongDocumentReason } = require('../../../../lib/decide-usability.js');
const { getDocumentType } = require('../../../../lib/documents/index.js');
export async function GET(request, ctx) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return NextResponse.json({ error: 'No session.' }, { status: 401 });
  const params = await ctx.params;
  const sid = params?.id;
  if (typeof sid !== 'string' || !sid) return NextResponse.json({ error: 'Bad id.' }, { status: 400 });
  const admin = createAdminClient();
  const { data: sub } = await admin.from('submissions').select('id,process_id,status').eq('id', sid).maybeSingle();
  if (!sub) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: owner } = await admin.from('submissions').select('user_id').eq('id', sid).maybeSingle();
  if (!owner || owner.user_id !== userId) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const bundle = await resolveProcess(admin, sub.process_id, userId);
  if (!bundle) return NextResponse.json({ error: 'Unknown process.' }, { status: 400 });
  const proc = bundle.def;
  const req = proc.requirement || null;
  const reqDoc = req ? req.document : null;
  const reqDef = reqDoc ? resolveDocumentType(bundle, reqDoc) : null;
  const reqLabel = reqDef ? reqDef.label : reqDoc;
  const { data: docs } = await admin.from('documents').select('id,doc_type,status,created_at,looks_like,quality_problems').eq('submission_id', sid).order('created_at', { ascending: false });
  const list = docs || [];
  // Newest upload per type wins ("replaced"): older uploads stay in the
  // database and work log but never appear in the checklist or unlock
  // other slots. The list is already newest-first, so first row wins.
  const byType = {};
  for (const d of list) {
    if (!byType[d.doc_type]) byType[d.doc_type] = d;
  }
  // Robustness: a background read can die (API error, timeout, after()
  // never ran) and leave a row in "uploaded"/"reading" forever. If the
  // newest row for a type has been reading for more than 2 minutes,
  // flip it to "error" with a friendly message so re-upload works.
  // No cron: this runs on page load (GET /api/submissions/[id]).
  const nowMs = Date.now();
  const timedOutIds = new Set();
  for (const t of Object.keys(byType)) {
    const d = byType[t];
    if (d && isStaleReading(d.status, d.created_at, nowMs)) {
      try {
        await admin.from('documents').update({ status: 'error' }).eq('id', d.id);
      } catch { /* keep showing error even if the write fails */ }
      try {
        await admin.from('work_log').insert({ submission_id: sid, step_type: 'reading_failed', message: READING_TIMEOUT_MESSAGE.slice(0, 200) });
      } catch { /* logging must not break the checklist */ }
      d.status = 'error';
      timedOutIds.add(d.id);
    }
  }
  const activeIds = new Set(Object.values(byType).map((d) => d.id));
  const docIds = Array.from(activeIds);
  let checks = [];
  let fieldsByDoc = {};
  let reviews = [];
  if (docIds.length > 0) {
    const { data: cr } = await admin.from('check_results').select('document_id,compared_document_id,field_key,rule,result,reason').in('document_id', docIds);
    // Attach the "same as X" label from settings: null means the profile,
    // otherwise the compared document's type label (never hard-coded).
    const typeByDocId = {};
    for (const d of list) { if (d && d.id && !typeByDocId[d.id]) typeByDocId[d.id] = d.doc_type; }
    checks = (cr || []).map((c) => ({ ...c, compared_label: comparedLabel(c.compared_document_id, typeByDocId, bundle.docs) }));
    const { data: ef } = await admin.from('extracted_fields').select('document_id,field_key,value_text,confidence,unreadable,found_on_page').in('document_id', docIds);
    for (const f of (ef || [])) {
      if (!fieldsByDoc[f.document_id]) fieldsByDoc[f.document_id] = [];
      fieldsByDoc[f.document_id].push(f);
    }
    const { data: ra } = await admin.from('review_actions').select('document_id,action,field_key,old_value,new_value,created_at').in('document_id', docIds).order('created_at', { ascending: true });
    reviews = ra || [];
  }
  const { data: logs } = await admin.from('work_log').select('step_type,message,created_at').eq('submission_id', sid).order('created_at', { ascending: true }).limit(100);
  const workLog = logs || [];
  let overrideNote = null;
  for (let i = workLog.length - 1; i >= 0; i--) {
    if (workLog[i].step_type === 'requirement_override') { overrideNote = workLog[i].message; break; }
  }
  const rows = [];
  const gateDoc = reqDoc ? (byType[reqDoc] || null) : null;
  const gateOk = reqDoc ? (gateDoc && (gateDoc.status === 'needs_review' || gateDoc.status === 'approved') && sub.status !== 'requirement_not_met') : true;
  for (const t of proc.documents) {
    const def = resolveDocumentType(bundle, t);
    const d = byType[t] || null;
    let locked = reqDoc ? (t !== reqDoc && !gateOk) : false;
    // retake_needed / wrong_document / error never lock the slot (you can always re-upload)
    if (d && (d.status === 'retake_needed' || d.status === 'wrong_document' || d.status === 'error')) locked = false;
    let action = 'upload';
    let reason = locked ? (sub.status === 'requirement_not_met' ? (req.message || 'Requirement not met.') : ('Upload your ' + reqLabel + ' first.')) : 'Not uploaded yet.';
    let status = d ? d.status : 'missing';
    if (d) {
      const mine = checks.filter((c) => c.document_id === d.id);
      const hasMismatch = mine.some((c) => c.result === 'mismatch');
      const hasCheck = mine.some((c) => c.result === 'check');
      const hasInvalid = mine.some((c) => c.result === 'invalid');
      if (d.status === 'uploaded' || d.status === 'reading') {
        action = 'reading';
        reason = 'Still reading, please wait.';
      } else if (d.status === 'retake_needed') {
        action = 'retake';
        try {
          reason = retakeReason({ problems: d.quality_problems || [] });
        } catch {
          reason = "We couldn't read most fields. Please retake the photo in better light.";
        }
      } else if (d.status === 'wrong_document') {
        action = 'wrong document';
        let looksLabel = d.looks_like || 'another document';
        let expectedLabel = t;
        try {
          if (bundle && bundle.docs) {
            if (d.looks_like && bundle.docs[d.looks_like] && bundle.docs[d.looks_like].label) looksLabel = bundle.docs[d.looks_like].label;
            else if (d.looks_like) {
              const ld = getDocumentType(d.looks_like);
              if (ld && ld.label) looksLabel = ld.label;
            }
            if (bundle.docs[t] && bundle.docs[t].label) expectedLabel = bundle.docs[t].label;
            else {
              const ed = getDocumentType(t);
              if (ed && ed.label) expectedLabel = ed.label;
            }
          } else {
            if (d.looks_like) {
              const ld = getDocumentType(d.looks_like);
              if (ld && ld.label) looksLabel = ld.label;
            }
            const ed = getDocumentType(t);
            if (ed && ed.label) expectedLabel = ed.label;
          }
        } catch {}
        try {
          reason = wrongDocumentReason({ expectedLabel, looksLikeLabel: looksLabel });
        } catch {
          reason = `This looks like a ${String(looksLabel).toLowerCase()}, not a ${String(expectedLabel).toLowerCase()}.`;
        }
      } else if (d.status === 'error') {
        action = 'retake';
        // Timed-out reads (flipped above) get the friendly timeout message;
        // other errors keep the generic retake message. Both allow re-upload:
        // newest row wins, so uploading again just works.
        reason = timedOutIds.has(d.id) ? READING_TIMEOUT_MESSAGE : "Couldn't read this photo. Please try again.";
      } else if (hasMismatch) {
        action = 'mismatch';
        reason = (mine.find((c) => c.result === 'mismatch') || {}).reason || 'Does not match.';
      } else if (hasCheck) {
        action = 'please confirm';
        reason = (mine.find((c) => c.result === 'check') || {}).reason || 'Please confirm.';
      } else if (hasInvalid) {
        action = 'retake';
        reason = 'Could not compare, please retake.';
      } else if (reqDoc && t === reqDoc && sub.status === 'requirement_not_met') {
        action = 'read_ok';
        reason = buildRequirementFailReason(proc, bundle.docs);
      } else {
        action = 'ready';
        reason = d.status === 'approved' ? 'Approved by reviewer.' : 'Looks ready. A person still decides.';
      }
      if (d.status === 'rejected') {
        action = 'rejected';
        reason = 'Rejected by reviewer. See work log.';
      }
    }
    rows.push({ doc_type: t, label: def ? def.label : t, locked, status, action, reason, document_id: d ? d.id : null });
  }
  return NextResponse.json({ submission: sub, process: { id: proc.id, label: proc.label, requirement_message: req ? (req.message || null) : null, requirement_document: reqDoc, override_note: overrideNote }, rows, checks, fields: fieldsByDoc, review_actions: reviews, work_log: workLog });
}
