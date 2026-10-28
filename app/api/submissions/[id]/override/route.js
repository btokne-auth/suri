// app/api/submissions/[id]/override/route.js
// Step 7: reviewer requirement override (demo mode, same visitor only).
// POST { note } only when status is requirement_not_met.
// A flag, a person decides: sets status back to in_progress and logs the note.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { getProcess } = require('../../../../../lib/processes/index.js');
const { isOwnedBy } = require('../../../../../lib/review-auth.js');
export async function POST(request, ctx) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return NextResponse.json({ error: 'No session.' }, { status: 401 });
  const params = await ctx.params;
  const sid = params?.id;
  if (typeof sid !== 'string' || !sid) return NextResponse.json({ error: 'Bad id.' }, { status: 400 });
  let body = null;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Bad request.' }, { status: 400 }); }
  const note = typeof body?.note === 'string' ? body.note.trim() : '';
  if (note.length < 3) return NextResponse.json({ error: 'Add a short note for the override.' }, { status: 400 });
  if (note.length > 200) return NextResponse.json({ error: 'Keep the note under 200 characters.' }, { status: 400 });
  const admin = createAdminClient();
  const { data: sub } = await admin.from('submissions').select('id,user_id,process_id,status').eq('id', sid).maybeSingle();
  if (!isOwnedBy(sub, userId)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (sub.status !== 'requirement_not_met') return NextResponse.json({ error: 'Nothing to override.' }, { status: 400 });
  const proc = getProcess(sub.process_id);
  if (!proc) return NextResponse.json({ error: 'Unknown process.' }, { status: 400 });
  await admin.from('submissions').update({ status: 'in_progress' }).eq('id', sid);
  await admin.from('work_log').insert({ submission_id: sid, step_type: 'requirement_override', message: note.slice(0, 200) });
  try {
    const reqDoc = proc.requirement ? proc.requirement.document : null;
    if (reqDoc) {
      const { data: newest } = await admin.from('documents').select('id').eq('submission_id', sid).eq('doc_type', reqDoc).order('created_at', { ascending: false }).limit(1);
      const target = newest && newest.length > 0 ? newest[0] : null;
      if (target) {
        await admin.from('review_actions').insert({ document_id: target.id, reviewer_id: userId, action: 'approve', field_key: null, old_value: null, new_value: note.slice(0, 200) });
      }
    }
  } catch { /* work log already records the override */ }
  return NextResponse.json({ ok: true, status: 'in_progress' });
}
