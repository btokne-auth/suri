// app/api/upload/route.js
// Step 5: POST /api/upload (multipart). Checks in order, then stores,
// inserts documents row as uploaded, returns fast; reading runs in after().
// Vercel request bodies cap at ~4.5 MB, so the server rejects over that.
// Browser shrinks photos first (see test page); PDFs are not resized.
import 'server-only';
import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkUploadLimit, checkGlobalReadLimit, getClientIp, checkUploadIpLimit, checkRetryPerSlot, secondsToNextHour } from '@/lib/rate-limit';
import { runReading } from '@/lib/read-background';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { sniffFileType } = require('../../../lib/file-type.js');
const { resolveProcess, resolveDocumentType } = require('../../../lib/processes/resolve.js');
export const maxDuration = 60;
const MAX_BYTES = Math.floor(4.5 * 1024 * 1024);
const BUCKET = 'uploads';
export async function POST(request) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return NextResponse.json({ error: 'No session. Please reload.' }, { status: 401 });
  let form = null;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: 'Bad upload. Please try again.' }, { status: 400 }); }
  const submissionId = form.get('submission_id');
  const docType = form.get('doc_type');
  const file = form.get('file');
  const admin = createAdminClient();
  const { data: sub, error: se } = await admin.from('submissions').select('id,user_id,status,process_id').eq('id', typeof submissionId === 'string' ? submissionId : '').maybeSingle();
  if (se || !sub || sub.user_id !== userId) return NextResponse.json({ error: "This submission isn't yours." }, { status: 403 });
  // Step 7c Part 2: builtins + owned saved_* (wrong owner -> Unknown process).
  const bundle = await resolveProcess(admin, sub.process_id, userId);
  if (!bundle) return NextResponse.json({ error: 'Unknown process.' }, { status: 400 });
  const proc = bundle.def;
  const docs = proc.documents || [];
  if (typeof docType !== 'string' || !docs.includes(docType)) return NextResponse.json({ error: 'Unknown document type.' }, { status: 400 });
  // Upload unlock rule uses process.requirement.document.
  // A process with no requirement unlocks everything.
  const req = proc.requirement || null;
  const reqDoc = req ? req.document : null;
  const reqDef = reqDoc ? resolveDocumentType(bundle, reqDoc) : null;
  const reqLabel = reqDef ? reqDef.label : reqDoc;
  if (req && docType !== reqDoc) {
    if (sub.status === 'requirement_not_met') return NextResponse.json({ error: req.message || 'Requirement not met.' }, { status: 403 });
    // Newest requirement document wins: older uploads are "replaced" and never unlock.
    const { data: newestReq } = await admin.from('documents').select('id,status').eq('submission_id', submissionId).eq('doc_type', reqDoc).order('created_at', { ascending: false }).limit(1);
    const gate = newestReq && newestReq.length > 0 ? newestReq[0] : null;
    if (gate && (gate.status === 'needs_review' || gate.status === 'approved')) {
      // Gate passed: other slots unlock.
    } else if (gate && (gate.status === 'uploaded' || gate.status === 'reading')) {
      return NextResponse.json({ error: 'Your ' + reqLabel + ' is still being checked. Please wait a moment.' }, { status: 409 });
    } else {
      return NextResponse.json({ error: 'Upload your ' + reqLabel + ' first. Other documents unlock after it passes.' }, { status: 403 });
    }
  }
  if (!resolveDocumentType(bundle, docType)) return NextResponse.json({ error: 'Unknown document type.' }, { status: 400 });
  if (!file || typeof file.arrayBuffer !== 'function') return NextResponse.json({ error: 'No file. Please choose a photo or PDF.' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'This file is too large. Try a smaller photo.' }, { status: 413 });
  if (file.size <= 0) return NextResponse.json({ error: 'Empty file. Please try again.' }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffFileType(bytes.subarray(0, 8));
  if (!sniffed) return NextResponse.json({ error: 'Only JPG, PNG or PDF files are allowed.' }, { status: 415 });
  try {
    const ip = getClientIp(request);
    const ipLim = await checkUploadIpLimit(admin, ip);
    if (!ipLim.allowed) {
      const retry = secondsToNextHour();
      return NextResponse.json({ error: 'Too many uploads from your network. Please wait a bit and try again.' }, { status: 429, headers: { 'Retry-After': String(retry), 'Cache-Control': 'no-store' } });
    }
    const slotLim = await checkRetryPerSlot(admin, submissionId, docType);
    if (!slotLim.allowed) {
      const retry = secondsToNextHour();
      return NextResponse.json({ error: 'Too many uploads for this document. Please wait before trying again.' }, { status: 429, headers: { 'Retry-After': String(retry), 'Cache-Control': 'no-store' } });
    }
    const up = await checkUploadLimit(admin, userId);
    if (!up.allowed) {
      const retry = secondsToNextHour();
      return NextResponse.json({ error: 'Too many uploads. Please wait a bit and try again.' }, { status: 429, headers: { 'Retry-After': String(retry), 'Cache-Control': 'no-store' } });
    }
    const rd = await checkGlobalReadLimit(admin);
    if (!rd.allowed) {
      const retry = secondsToNextHour();
      return NextResponse.json({ error: 'Suri is busy right now. Please try again later.' }, { status: 429, headers: { 'Retry-After': String(retry), 'Cache-Control': 'no-store' } });
    }
  } catch { return NextResponse.json({ error: 'Busy. Please try again.' }, { status: 500 }); }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const documentId = randomUUID();
  const storagePath = userId + '/' + submissionId + '/' + documentId + '.' + sniffed.ext;
  const ue = await admin.storage.from(BUCKET).upload(storagePath, bytes, { contentType: sniffed.mime, upsert: false });
  if (ue.error) return NextResponse.json({ error: 'Could not save file. Please try again.' }, { status: 500 });
  const de = await admin.from('documents').insert({ id: documentId, submission_id: submissionId, doc_type: docType, storage_path: storagePath, sha256, file_type: sniffed.mime, file_size_bytes: file.size, status: 'uploaded' });
  if (de.error) { await admin.storage.from(BUCKET).remove([storagePath]); return NextResponse.json({ error: 'Could not save file. Please try again.' }, { status: 500 }); }
  await admin.from('work_log').insert({ submission_id: submissionId, step_type: 'upload', message: (docType + ' received').slice(0, 200) });
  const sid = submissionId, dt = docType, sp = storagePath, mm = sniffed.mime;
  after(() => runReading(sid, documentId, dt, sp, mm));
  return NextResponse.json({ document_id: documentId });
}
