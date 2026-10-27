// lib/read-background.js
// Build order step 5: background reading worker.
// Called from POST /api/upload via after(). Server only.
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { readDocumentBytes } from '@/lib/reader';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { validateExtraction } = require('./validation.js');
const { getDocumentType } = require('./documents/index.js');
const { runChecksForDocument } = require('./checks/run-checks.js');
const BUCKET = 'uploads';
export async function runReading(submissionId, documentId, docType, storagePath, mime) {
  const admin = createAdminClient();
  const log = (t, m) => admin.from('work_log').insert({ submission_id: submissionId, step_type: t, message: m.slice(0, 200) });
  try {
    await admin.from('documents').update({ status: 'reading' }).eq('id', documentId);
    await log('reading_started', docType + ' reading started');
    const dl = await admin.storage.from(BUCKET).download(storagePath);
    if (dl.error || !dl.data) throw new Error('download failed');
    const buf = Buffer.from(await dl.data.arrayBuffer());
    let out = null;
    try {
      out = await readDocumentBytes(docType, buf, mime);
    } catch {
      throw new Error('reader failed');
    }
    const checked = validateExtraction(docType, out);
    const def = getDocumentType(docType);
    const rows = [];
    for (const f of def.fields) {
      const v = checked.fields[f.key];
      if (!v || typeof v !== 'object') continue;
      const c = v.confidence === 'high' || v.confidence === 'medium' ? v.confidence : 'low';
      rows.push({ document_id: documentId, field_key: f.key, value_text: v.value == null ? null : String(v.value), confidence: c, unreadable: v.unreadable === true, found_on_page: typeof v.found_on_page === 'string' ? v.found_on_page.slice(0, 200) : null });
    }
    if (rows.length > 0) {
      const fe = await admin.from('extracted_fields').upsert(rows, { onConflict: 'document_id,field_key' });
      if (fe.error) throw new Error('save failed');
    }
    const req = def.fields.filter((f) => f.required).map((f) => f.key);
    const allBad = req.length > 0 && req.every((k) => { const v = checked.fields[k]; return !v || v.unreadable === true || v.value == null; });
    const next = allBad ? 'retake_needed' : 'needs_review';
    await admin.from('documents').update({ status: next }).eq('id', documentId);
    await log('reading_finished', next === 'retake_needed' ? docType + ' unreadable, please retake' : docType + ' reading finished: ' + rows.length + ' fields');
    if (next === 'needs_review') {
      try {
        await runChecksForDocument({ admin, submissionId, documentId });
      } catch {
        await log('check_failed', 'Could not finish checks. A person will review.');
      }
    }
  } catch {
    await admin.from('documents').update({ status: 'error' }).eq('id', documentId);
    await admin.from('work_log').insert({ submission_id: submissionId, step_type: 'reading_failed', message: "Couldn't read this photo. Please try again." });
  }
}
