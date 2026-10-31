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
const { buildPairKey } = require('../../../../lib/clarify.js');
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
  const notChecked = Array.isArray(proc.not_checked) ? proc.not_checked.slice(0, 5) : [];
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
  let clarifications = [];
  let clarificationMap = new Map();
  try {
    const { data: crs } = await admin.from('clarifications').select('id, submission_id, field_key, pair_key, question, answer, check_result_id, created_at').eq('submission_id', sid);
    clarifications = crs || [];
    for (const cl of clarifications) {
      if (cl && cl.pair_key) clarificationMap.set(cl.pair_key, cl);
    }
  } catch {}
  // Profile for reconstructing pair_key of profile comparisons (check vs profile)
  let profileFullName = null;
  let profileDob = null;
  try {
    const { data: prof } = await admin.from('profiles').select('given_name,middle_name,surname,suffix,birth_date').eq('user_id', owner.user_id).maybeSingle();
    if (prof) {
      const parts = [prof.given_name, prof.middle_name, prof.surname, prof.suffix].filter(function (v) { return v != null && String(v).trim() !== ''; });
      if (parts.length > 0) profileFullName = parts.join(' ');
      profileDob = prof.birth_date || null;
    }
  } catch {}
  if (docIds.length > 0) {
    const { data: cr } = await admin.from('check_results').select('document_id,compared_document_id,field_key,rule,result,reason').in('document_id', docIds);
    // Attach the "same as X" label from settings: null means the profile,
    // otherwise the compared document's type label (never hard-coded).
    const typeByDocId = {};
    for (const d of list) { if (d && d.id && !typeByDocId[d.id]) typeByDocId[d.id] = d.doc_type; }
    // First pass: basic checks with compared_label
    const rawChecks = cr || [];
    const { data: ef } = await admin.from('extracted_fields').select('document_id,field_key,value_text,confidence,unreadable,found_on_page').in('document_id', docIds);
    for (const f of (ef || [])) {
      if (!fieldsByDoc[f.document_id]) fieldsByDoc[f.document_id] = [];
      fieldsByDoc[f.document_id].push(f);
    }
    // Enrich checks with pair_key + clarification by recomputing with baseNormalize+sorted
    checks = rawChecks.map(function (c) {
      let pairKey = null;
      let clarification = null;
      try {
        let leftVal = null;
        let rightVal = null;
        const leftFields = fieldsByDoc[c.document_id] || [];
        const leftEntry = leftFields.find(function (ff) { return ff.field_key === c.field_key; });
        leftVal = leftEntry ? leftEntry.value_text : null;
        if (c.compared_document_id == null) {
          if (c.field_key === 'date_of_birth') rightVal = profileDob;
          else rightVal = profileFullName;
        } else {
          const rightFields = fieldsByDoc[c.compared_document_id] || [];
          const rightEntry = rightFields.find(function (ff) { return ff.field_key === c.field_key; });
          rightVal = rightEntry ? rightEntry.value_text : null;
        }
        if (leftVal != null && rightVal != null) {
          pairKey = buildPairKey(c.field_key, leftVal, rightVal);
          if (clarificationMap.has(pairKey)) clarification = clarificationMap.get(pairKey);
        } else if (leftVal == null || rightVal == null) {
          // Fallback: try match by field_key alone if only one clarification for that field exists
          // This covers cases where extracted_fields missing but we still want to surface the question
          const candidates = clarifications.filter(function (cl) { return cl.field_key === c.field_key; });
          if (candidates.length === 1) {
            clarification = candidates[0];
            pairKey = clarification.pair_key || null;
          }
        }
      } catch {}
      return Object.assign({}, c, { compared_label: comparedLabel(c.compared_document_id, typeByDocId, bundle.docs), pair_key: pairKey, clarification: clarification });
    });
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
        // Step 9B: if a clarification exists for this check pair, surface it.
        // Unanswered -> please confirm with the question; answered -> answered phrase.
        let docClarifications = [];
        try {
          const seen = new Set();
          for (const ch of mine) {
            if (ch.result !== 'check') continue;
            const cl = ch.clarification;
            if (cl && !seen.has(cl.id)) {
              docClarifications.push(cl);
              seen.add(cl.id);
            }
          }
          if (docClarifications.length === 0) {
            for (const ch of mine) {
              if (ch.result !== 'check') continue;
              const cands = clarifications.filter(function (cl) { return cl.field_key === ch.field_key; });
              for (const cand of cands) {
                if (!seen.has(cand.id)) {
                  docClarifications.push(cand);
                  seen.add(cand.id);
                }
              }
            }
          }
        } catch {}
        // stash for rows push below
        d._docClarifications = docClarifications;
        if (docClarifications.length > 0) {
          const unanswered = docClarifications.find(function (c) { return c.answer == null; });
          if (unanswered) {
            action = 'please confirm';
            reason = unanswered.question;
          } else {
            action = 'answered, a person will decide';
            reason = 'answered, a person will decide';
          }
        } else {
          action = 'please confirm';
          reason = (mine.find((c) => c.result === 'check') || {}).reason || 'Please confirm.';
        }
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
    // Collect clarifications for this doc_type for the response.
    // For hasCheck we already computed d._docClarifications; for other statuses gather similarly.
    let docClarifications = (d && d._docClarifications) ? d._docClarifications : [];
    if (!docClarifications || docClarifications.length === 0) {
      try {
        const mineAll = d ? checks.filter(function (c) { return c.document_id === d.id; }) : [];
        const seen2 = new Set();
        for (const ch of mineAll) {
          const cl = ch.clarification;
          if (cl && !seen2.has(cl.id)) {
            docClarifications.push(cl);
            seen2.add(cl.id);
          }
        }
        // Fallback to any clarification with same field_key if pair_key didn't match (e.g., profile case with missing extracted value)
        if (docClarifications.length === 0) {
          for (const ch of mineAll) {
            const cands = clarifications.filter(function (cl) { return cl.field_key === ch.field_key; });
            for (const cand of cands) {
              if (!seen2.has(cand.id)) {
                docClarifications.push(cand);
                seen2.add(cand.id);
              }
            }
          }
        }
      } catch {}
    }
    rows.push({ doc_type: t, label: def ? def.label : t, locked, status, action, reason, document_id: d ? d.id : null, clarifications: docClarifications });
  }
  return NextResponse.json({ submission: sub, process: { id: proc.id, label: proc.label, requirement_message: req ? (req.message || null) : null, requirement_document: reqDoc, override_note: overrideNote, not_checked: notChecked }, rows, checks, fields: fieldsByDoc, review_actions: reviews, work_log: workLog, clarifications });
}
