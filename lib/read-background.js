// lib/read-background.js
// Build order step 5: background reading worker.
// Called from POST /api/upload via after(). Server only.
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { readDocumentBytes, readDocumentBytesWithDef } from '@/lib/reader';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { validateExtraction, validateExtractionWithDef } = require('./validation.js');
const { getDocumentType, allDocumentIds } = require('./documents/index.js');
const { resolveProcess, resolveDocumentType } = require('./processes/resolve.js');
const { runChecksForDocument } = require('./checks/run-checks.js');
const { decideUsability } = require('./decide-usability.js');
const BUCKET = 'uploads';
export async function runReading(submissionId, documentId, docType, storagePath, mime) {
  // Any error anywhere must leave the row as "error", never stuck in
  // "reading" forever. The outer try covers even admin setup.
  try {
    const admin = createAdminClient();
    const log = (t, m) => admin.from('work_log').insert({ submission_id: submissionId, step_type: t, message: m.slice(0, 200) });
    try {
      await admin.from('documents').update({ status: 'reading' }).eq('id', documentId);
      await log('reading_started', docType + ' reading started');
      // Step 7c Part 2: resolve the owning submission's process bundle so
      // saved inline doc defs read + validate like builtins. Builtins keep
      // the exact same prompt + validation path via bundle.docs.
      let bundle = null;
      let def = getDocumentType(docType);
      let useFloor = false;
      try {
        const { data: ownerSub } = await admin.from('submissions').select('user_id,process_id').eq('id', submissionId).maybeSingle();
        if (ownerSub && ownerSub.process_id && ownerSub.user_id) {
          bundle = await resolveProcess(admin, ownerSub.process_id, ownerSub.user_id);
        }
      } catch { bundle = null; }
      if (bundle) {
        const rd = resolveDocumentType(bundle, docType);
        if (!rd) throw new Error('unknown document type');
        def = rd;
        useFloor = !bundle.isBuiltin;
      }
      if (!def) throw new Error('unknown document type');
      const dl = await admin.storage.from(BUCKET).download(storagePath);
      if (dl.error || !dl.data) throw new Error('download failed');
      const buf = Buffer.from(await dl.data.arrayBuffer());
      const allowedIds = bundle && bundle.docs ? Object.keys(bundle.docs) : allDocumentIds();
      let out = null;
      try {
        out = bundle && useFloor
          ? await readDocumentBytesWithDef(def, buf, mime, allowedIds)
          : await readDocumentBytes(docType, buf, mime, allowedIds);
      } catch {
        throw new Error('reader failed');
      }
      const checked = bundle && useFloor
        ? validateExtractionWithDef(def, out, { dateFloor: '1900-01-01', allowedDocIds: allowedIds })
        : validateExtraction(docType, out, { allowedDocIds: allowedIds });
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
      const usability = decideUsability({
        def,
        bundle,
        expectedDocTypeId: docType,
        fields: checked.fields,
        quality: checked.quality,
        documentMatch: checked.documentMatch,
        allowedIds,
      });
      const next = usability.status;
      await admin.from('documents').update({ status: next, looks_like: usability.looks_like, quality_problems: usability.quality_problems }).eq('id', documentId);
      if (next === 'wrong_document') {
        await log('wrong_document', usability.reason.slice(0, 200));
      } else if (next === 'retake_needed') {
        await log('retake_needed', usability.reason.slice(0, 200));
      } else {
        await log('reading_finished', docType + ' reading finished: ' + rows.length + ' fields');
      }
      if (next === 'needs_review') {
        try {
          await runChecksForDocument({ admin, submissionId, documentId });
        } catch {
          await log('check_failed', 'Could not finish checks. A person will review.');
        }
      }
    } catch {
      try {
        await admin.from('documents').update({ status: 'error' }).eq('id', documentId);
      } catch { /* status update must not throw out of the worker */ }
      try {
        await admin.from('work_log').insert({ submission_id: submissionId, step_type: 'reading_failed', message: "Couldn't read this photo. Please try again." });
      } catch { /* logging must not throw out of the worker */ }
    }
  } catch {
    // Last resort: even admin setup failed. Try once more with a fresh client
    // so the row never stays in "reading" forever.
    try {
      const admin2 = createAdminClient();
      await admin2.from('documents').update({ status: 'error' }).eq('id', documentId);
      await admin2.from('work_log').insert({ submission_id: submissionId, step_type: 'reading_failed', message: "Couldn't read this photo. Please try again." });
    } catch { /* never throw out of the background worker */ }
  }
}
