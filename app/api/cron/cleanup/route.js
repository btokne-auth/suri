// app/api/cron/cleanup/route.js
// Daily auto-delete: submissions >7 days, orphan anonymous users, old counters.
// Protected by CRON_SECRET (Authorization: Bearer <secret>), Vercel Cron sends it.
// Hobby: once a day. Crons only run on production; preview is tested manually.
// Storage is deleted FIRST, then rows (200 per run) to avoid orphan files.
import 'server-only';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { isAuthorized, parseDays, getCutoffISO, runCleanup } = require('@/lib/cleanup.js');

export const maxDuration = 60;

export async function GET(request) {
  const authHeader = request.headers.get('authorization') || '';
  const secret = process.env.CRON_SECRET;

  if (!secret || !isAuthorized(authHeader, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const url = new URL(request.url);
  const isDry = url.searchParams.get('dry') === '1';

  let days;
  try {
    days = parseDays(url.searchParams, isDry);
  } catch {
    return NextResponse.json({ error: 'Invalid days' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const cutoffISO = getCutoffISO(days);
  const admin = createAdminClient();
  const start = Date.now();

  try {
    const result = await runCleanup(admin, { cutoffISO, isDry });

    return NextResponse.json(
      {
        ok: true,
        dryRun: isDry,
        days,
        cutoff: cutoffISO,
        submissions: {
          found: result.submissions.submissionsFound,
          documents: result.submissions.documentsFound,
          deleted: result.submissions.submissionsDeleted,
          wouldDelete: result.submissions.wouldDelete,
          wouldRemove: result.submissions.wouldRemove,
          storageRemoved: result.submissions.storageRemoved,
          storageErrors: result.submissions.storageErrors,
        },
        users: {
          found: result.users.usersFound,
          deleted: result.users.usersDeleted,
          wouldDelete: result.users.wouldDelete,
          checked: result.users.checked,
        },
        counters: {
          found: result.counters.countersFound,
          deleted: result.counters.countersDeleted,
          wouldDelete: result.counters.wouldDelete,
        },
        durationMs: Date.now() - start,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}