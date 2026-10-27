// app/api/documents/[id]/image/route.js
// Step 5: GET signed URL (~5 min), owner only.
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
export async function GET(request, ctx) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return NextResponse.json({ error: 'No session. Please reload.' }, { status: 401 });
  const params = await ctx.params;
  const docId = params?.id;
  if (typeof docId !== 'string' || !docId) return NextResponse.json({ error: 'Bad id.' }, { status: 400 });
  const admin = createAdminClient();
  const { data: doc, error: de } = await admin.from('documents').select('id,storage_path,submission_id').eq('id', docId).maybeSingle();
  if (de || !doc) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: sub, error: se } = await admin.from('submissions').select('user_id').eq('id', doc.submission_id).maybeSingle();
  if (se || !sub || sub.user_id !== userId) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: signed, error: sErr } = await admin.storage.from('uploads').createSignedUrl(doc.storage_path, 300);
  if (sErr || !signed?.signedUrl) return NextResponse.json({ error: 'Could not load image. Please try again.' }, { status: 500 });
  return NextResponse.json({ url: signed.signedUrl });
}
