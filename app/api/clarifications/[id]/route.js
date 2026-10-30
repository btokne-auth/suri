// app/api/clarifications/[id]/route.js
// Step 9B Act 4: PATCH answer to a clarification question.
// - 401 if no session
// - 404 if not owner (don't reveal existence)
// - 409 if already answered
// - 400 if answer fails validateAnswer (friendly message)
// - Saves trimmed answer only; NEVER touches extracted_fields or check_results
// - Logs work_log clarification_answered with field label only (never answer text)
// - Returns { ok, clarification: { id, question, answer } }
import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { validateAnswer } = require('../../../../lib/clarify.js');

function fieldKeyToLabel(key) {
  const s = String(key || 'value').replace(/_/g, ' ').trim() || 'value';
  return s
    .split(/\s+/)
    .map(function (w) {
      return w ? w.charAt(0).toUpperCase() + w.slice(1) : '';
    })
    .join(' ');
}

export async function PATCH(request, ctx) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return NextResponse.json({ error: 'No session.' }, { status: 401 });
  const params = await ctx.params;
  const cid = params?.id;
  if (typeof cid !== 'string' || !cid) return NextResponse.json({ error: 'Bad id.' }, { status: 400 });
  const admin = createAdminClient();
  const { data: clar, error: ce } = await admin
    .from('clarifications')
    .select('id, submission_id, field_key, pair_key, question, answer, check_result_id, created_at')
    .eq('id', cid)
    .maybeSingle();
  if (ce || !clar) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (!clar.submission_id) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: sub, error: se } = await admin.from('submissions').select('user_id').eq('id', clar.submission_id).maybeSingle();
  if (se || !sub || sub.user_id !== userId) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (clar.answer != null) return NextResponse.json({ error: 'This question has already been answered.' }, { status: 409 });
  let body = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  const rawAnswer = body && typeof body.answer === 'string' ? body.answer : body && body.answer != null ? String(body.answer) : '';
  // Also accept plain string body? But spec says { answer: string }
  // Ensure we validate whatever was sent; if body is missing answer field, rawAnswer will be '' and validateAnswer will give friendly 400.
  const v = validateAnswer(rawAnswer);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const trimmed = v.value;
  const { error: upErr } = await admin.from('clarifications').update({ answer: trimmed }).eq('id', cid);
  if (upErr) return NextResponse.json({ error: 'Could not save answer. Please try again.' }, { status: 500 });
  // Work log: field label only, never the answer text
  try {
    const label = fieldKeyToLabel(clar.field_key);
    await admin.from('work_log').insert({
      submission_id: clar.submission_id,
      step_type: 'clarification_answered',
      message: ('Answered for ' + label).slice(0, 200),
    });
  } catch {}
  return NextResponse.json({ ok: true, clarification: { id: clar.id, question: clar.question, answer: trimmed } });
}
