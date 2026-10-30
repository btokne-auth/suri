// app/api/documents/[id]/image-proxy/route.js
// Step 9E Act 2: GET image bytes same-origin for browser OCR, owner only.
// Returns 400 for PDFs, 401/404 same as /image, streams bytes with Content-Type + Cache-Control private.
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
  const { data: doc, error: de } = await admin.from('documents').select('id,storage_path,submission_id,file_type').eq('id', docId).maybeSingle();
  if (de || !doc) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const { data: sub, error: se } = await admin.from('submissions').select('user_id').eq('id', doc.submission_id).maybeSingle();
  if (se || !sub || sub.user_id !== userId) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const lowerPath = String(doc.storage_path || '').toLowerCase();
  const lowerType = String(doc.file_type || '').toLowerCase();
  if (lowerPath.endsWith('.pdf') || lowerType === 'application/pdf') {
    return NextResponse.json({ error: "Plain OCR preview isn't available for PDFs." }, { status: 400 });
  }

  const { data: signed, error: sErr } = await admin.storage.from('uploads').createSignedUrl(doc.storage_path, 300);
  if (sErr || !signed?.signedUrl) return NextResponse.json({ error: 'Could not load image. Please try again.' }, { status: 500 });

  let fetched;
  try {
    fetched = await fetch(signed.signedUrl);
  } catch {
    return NextResponse.json({ error: 'Could not load image. Please try again.' }, { status: 500 });
  }
  if (!fetched.ok) return NextResponse.json({ error: 'Could not load image. Please try again.' }, { status: 500 });

  const buf = await fetched.arrayBuffer();

  let contentType = doc.file_type || fetched.headers.get('content-type') || '';
  const ctLower = String(contentType).toLowerCase();
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
  if (!allowed.includes(ctLower)) {
    if (lowerPath.endsWith('.png')) contentType = 'image/png';
    else if (lowerPath.endsWith('.webp')) contentType = 'image/webp';
    else if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) contentType = 'image/jpeg';
    else if (lowerPath.endsWith('.gif')) contentType = 'image/gif';
    else if (lowerPath.endsWith('.bmp')) contentType = 'image/bmp';
    else if (ctLower.startsWith('image/')) contentType = ctLower;
    else contentType = 'application/octet-stream';
  }

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=60',
    },
  });
}
