// app/api/setup/confirm/route.js
// Step 7c Part 2/3: POST /api/setup/confirm. Server is truth: re-validates
// the draft (Zod + compatibility), reorders so the requirement document is
// first, computes needs_profile, assigns process_key (saved_ + 8 hex),
// inserts into saved_processes. No model call, no rate limit.
import 'server-only';
import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { validateDraft, checkDraftCompatibility, honestyCheck } = require('../../../../lib/processes/draft-schema.js');
const { getDocumentType } = require('../../../../lib/documents/index.js');
const CODE_PATTERN = '^[A-Za-z0-9-]+$';
function codesOnly(issues) {
  const list = Array.isArray(issues) ? issues : [];
  return list.map((i) => (i && typeof i.code === 'string' ? i.code : 'invalid')).slice(0, 20);
}
function normAttempts(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a) => a && typeof a === 'object')
    .slice(0, 4)
    .map((a) => ({ n: typeof a.n === 'number' ? a.n : 0, result: a.result === 'ok' ? 'ok' : 'error', codes: Array.isArray(a.codes) ? a.codes.filter((c) => typeof c === 'string').slice(0, 20) : [] }));
}
export async function POST(request) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return NextResponse.json({ error: 'No session. Please reload.' }, { status: 401 });
  let body = null;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Bad request. Please try again.' }, { status: 400 }); }
  const input = body?.draft;
  if (!input || typeof input !== 'object') return NextResponse.json({ error: 'Nothing to confirm. Please build a draft first.' }, { status: 400 });
  const shaped = validateDraft(input);
  if (!shaped.ok) return NextResponse.json({ error: 'This draft needs fixes before it can be saved.', codes: codesOnly(shaped.issues) }, { status: 422 });
  const draft = shaped.draft;
  const compat = checkDraftCompatibility(draft, getDocumentType);
  if (!compat.ok) return NextResponse.json({ error: 'This draft needs fixes before it can be saved.', codes: codesOnly(compat.issues) }, { status: 422 });
  const honesty = honestyCheck(draft);
  if (honesty) return NextResponse.json({ error: honesty.needs_more_info, needs_more_info: honesty.needs_more_info }, { status: 400 });
  // Reorder so the requirement document is first (gate unlocks the rest).
  const ordered = draft.documents.slice();
  if (draft.requirement) {
    const ri = ordered.findIndex((e) => (e.reuse || e.id) === draft.requirement.document);
    if (ri > 0) { const g = ordered.splice(ri, 1)[0]; ordered.unshift(g); }
  }
  const documentIds = ordered.map((e) => e.reuse || e.id);
  const docDefs = {};
  for (const e of ordered) {
    if (e.reuse) continue;
    const fields = (e.fields || []).map((f) => {
      const c = { key: f.key, type: f.type, label: f.label, required: f.required };
      if (f.maxLength !== undefined) c.maxLength = f.maxLength;
      if (f.values !== undefined) c.values = f.values;
      if (f.min !== undefined) c.min = f.min;
      if (f.max !== undefined) c.max = f.max;
      if (f.type === 'code') c.pattern = CODE_PATTERN;
      return c;
    });
    docDefs[e.id] = { id: e.id, label: e.label, fields };
  }
  const needsProfile = (draft.checks || []).some((c) => String((c && c.compare_to) || '').indexOf('profile.') === 0);
  const notChecked = Array.isArray(draft.not_checked) ? draft.not_checked.map((s) => String(s).trim()).filter(Boolean).map((s) => s.slice(0, 160)).slice(0, 5) : [];
  const processKey = 'saved_' + randomBytes(4).toString('hex');
  const definition = { id: processKey, label: draft.label, documents: documentIds, docDefs, checks: draft.checks || [], requirement: draft.requirement || null, needs_profile: needsProfile, not_checked: notChecked };
  const admin = createAdminClient();
  const ins = await admin.from('saved_processes').insert({ user_id: userId, process_key: processKey, label: draft.label, definition, draft_attempts: normAttempts(body?.attempts) });
  if (ins.error) return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 });
  return NextResponse.json({ process_key: processKey, needs_profile: needsProfile, documents: documentIds });
}