// app/api/submissions/[id]/route.js
// Step 6: GET set view data (owner only).
// Returns submission + per-type latest document + checks + work log.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const linawan = require('../../../../lib/processes/linawan-scholarship-intake.js');
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
  const proc = sub.process_id === linawan.id ? linawan : null;
  if (!proc) return NextResponse.json({ error: 'Unknown process.' }, { status: 400 });
  const { data: docs } = await admin.from('documents').select('id,doc_type,status,created_at').eq('submission_id', sid).order('created_at', { ascending: false });
  const list = docs || [];
  // Newest upload per type wins ("replaced"): older uploads stay in the
  // database and work log but never appear in the checklist or unlock
  // other slots. The list is already newest-first, so first row wins.
  const byType = {};
  for (const d of list) {
    if (!byType[d.doc_type]) byType[d.doc_type] = d;
  }
  const activeIds = new Set(Object.values(byType).map((d) => d.id));
  const docIds = Array.from(activeIds);
  let checks = [];
  if (docIds.length > 0) {
    const { data: cr } = await admin.from('check_results').select('document_id,compared_document_id,field_key,rule,result,reason').in('document_id', docIds);
    checks = cr || [];
  }
  const { data: logs } = await admin.from('work_log').select('step_type,message,created_at').eq('submission_id', sid).order('created_at', { ascending: true }).limit(100);
  const rows = [];
  const gateDoc = byType['valid_id'] || null;
  const gateOk = gateDoc && (gateDoc.status === 'needs_review' || gateDoc.status === 'approved') && sub.status !== 'requirement_not_met';
  for (const t of proc.documents) {
    const def = getDocumentType(t);
    const d = byType[t] || null;
    const locked = t !== 'valid_id' && !gateOk;
    let action = 'upload';
    let reason = locked ? (sub.status === 'requirement_not_met' ? proc.requirement.message : 'Upload your valid ID first.') : 'Not uploaded yet.';
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
        reason = 'Photo unreadable, please retake.';
      } else if (d.status === 'error') {
        action = 'retake';
        reason = "Couldn't read this photo. Please try again.";
      } else if (hasMismatch) {
        action = 'mismatch';
        reason = (mine.find((c) => c.result === 'mismatch') || {}).reason || 'Does not match.';
      } else if (hasCheck) {
        action = 'please confirm';
        reason = (mine.find((c) => c.result === 'check') || {}).reason || 'Please confirm.';
      } else if (hasInvalid) {
        action = 'retake';
        reason = 'Could not compare, please retake.';
      } else {
        action = 'ready';
        reason = d.status === 'approved' ? 'Approved by reviewer.' : 'Looks ready. A person still decides.';
      }
    }
    rows.push({ doc_type: t, label: def ? def.label : t, locked, status, action, reason, document_id: d ? d.id : null });
  }
  return NextResponse.json({ submission: sub, process: { id: proc.id, label: proc.label, requirement_message: proc.requirement.message }, rows, checks, work_log: logs || [] });
}
