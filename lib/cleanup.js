// lib/cleanup.js
// Helpers for auto-delete after 7 days. Pure + fake-admin testable.
// Tables: submissions, documents, saved_processes, usage_counters, auth.users, storage bucket "uploads".
// No full document text, no real secrets here.

const BUCKET = 'uploads';
const MAX_BATCH = 200;
const STORAGE_BATCH = 100;

function getCutoffISO(days) {
  const ms = Number(days) * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - ms).toISOString();
}

function parseDays(searchParams, isDry) {
  // days override only in dry-run; otherwise always 7
  if (!isDry) return 7;
  const raw = searchParams.get('days');
  if (raw === null || raw === '') return 7;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 365) {
    const e = new Error('Invalid days');
    e.code = 'BAD_DAYS';
    throw e;
  }
  return n;
}

function isAuthorized(authHeader, secret) {
  if (!secret) return false;
  if (typeof authHeader !== 'string' || !authHeader) return false;
  return authHeader === 'Bearer ' + secret;
}

async function cleanupSubmissions(admin, cutoffISO, isDry) {
  // find submissions older than cutoff, max 200
  const q1 = admin.from('submissions').select('id').lt('created_at', cutoffISO).order('created_at', { ascending: true }).limit(MAX_BATCH);
  const { data: subs, error: e1 } = await q1;
  if (e1) throw e1;
  const ids = (subs || []).map((s) => s.id).filter(Boolean);
  if (ids.length === 0) {
    return {
      submissionsFound: 0,
      documentsFound: 0,
      storageRemoved: 0,
      storageErrors: 0,
      submissionsDeleted: 0,
      wouldDelete: 0,
      wouldRemove: 0,
    };
  }
  // find documents for those submissions
  const q2 = admin.from('documents').select('storage_path').in('submission_id', ids);
  const { data: docs, error: e2 } = await q2;
  if (e2) throw e2;
  const paths = (docs || []).map((d) => d.storage_path).filter(Boolean);

  let storageRemoved = 0;
  let storageErrors = 0;
  if (!isDry && paths.length > 0) {
    for (let i = 0; i < paths.length; i += STORAGE_BATCH) {
      const batch = paths.slice(i, i + STORAGE_BATCH);
      const { error: se } = await admin.storage.from(BUCKET).remove(batch);
      if (se) storageErrors += batch.length;
      else storageRemoved += batch.length;
    }
  }

  let submissionsDeleted = 0;
  if (!isDry) {
    const { error: de } = await admin.from('submissions').delete().in('id', ids);
    if (de) throw de;
    submissionsDeleted = ids.length;
  }

  return {
    submissionsFound: ids.length,
    documentsFound: paths.length,
    storageRemoved: isDry ? 0 : storageRemoved,
    storageErrors,
    submissionsDeleted: isDry ? 0 : submissionsDeleted,
    wouldDelete: isDry ? ids.length : 0,
    wouldRemove: isDry ? paths.length : 0,
  };
}

async function cleanupUsers(admin, cutoffISO, isDry) {
  let usersFound = 0;
  let usersDeleted = 0;
  let checked = 0;
  let page = 1;
  const perPage = 100;
  let hasMore = true;
  const cutoffMs = new Date(cutoffISO).getTime();

  while (hasMore) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    // Supabase returns { users: [...] } inside data; fake may return { users } or { data: { users } }
    let users = [];
    if (data && Array.isArray(data.users)) users = data.users;
    else if (data && Array.isArray(data)) users = data;
    else if (Array.isArray(users)) users = [];
    // Also handle direct array in data?.users fallback already

    for (const u of users) {
      checked++;
      if (!u || !u.created_at) continue;
      const createdMs = new Date(u.created_at).getTime();
      if (Number.isNaN(createdMs) || createdMs >= cutoffMs) continue;

      // no submissions left?
      const { data: subs, error: se } = await admin.from('submissions').select('id').eq('user_id', u.id).limit(1);
      if (se) throw se;
      if (subs && subs.length > 0) continue;

      // no saved_processes newer than cutoff?
      const { data: sps, error: spe } = await admin
        .from('saved_processes')
        .select('id')
        .eq('user_id', u.id)
        .gt('created_at', cutoffISO)
        .limit(1);
      if (spe) throw spe;
      if (sps && sps.length > 0) continue;

      usersFound++;
      if (!isDry) {
        const { error: de } = await admin.auth.admin.deleteUser(u.id);
        if (de) throw de;
        usersDeleted++;
      }
    }

    if (users.length < perPage) hasMore = false;
    else page++;
    if (page > 50) break; // safety
  }

  return {
    usersFound,
    usersDeleted: isDry ? 0 : usersDeleted,
    wouldDelete: isDry ? usersFound : 0,
    checked,
  };
}

async function cleanupCounters(admin, cutoffISO, isDry) {
  // count first, then delete if not dry
  const { data, error } = await admin.from('usage_counters').select('key').lt('window_start', cutoffISO);
  if (error) throw error;
  const n = (data || []).length;
  if (!isDry && n > 0) {
    const { error: de } = await admin.from('usage_counters').delete().lt('window_start', cutoffISO);
    if (de) throw de;
    return { countersFound: n, countersDeleted: n, wouldDelete: 0 };
  }
  return { countersFound: n, countersDeleted: 0, wouldDelete: isDry ? n : 0 };
}

async function runCleanup(admin, { cutoffISO, isDry }) {
  const submissions = await cleanupSubmissions(admin, cutoffISO, isDry);
  const users = await cleanupUsers(admin, cutoffISO, isDry);
  const counters = await cleanupCounters(admin, cutoffISO, isDry);
  return { submissions, users, counters };
}

module.exports = {
  BUCKET,
  MAX_BATCH,
  STORAGE_BATCH,
  getCutoffISO,
  parseDays,
  isAuthorized,
  cleanupSubmissions,
  cleanupUsers,
  cleanupCounters,
  runCleanup,
};