// lib/rate-limit.js
//
// Build order step 5: rate limits in usage_counters.
// - 10 uploads per visitor per hour.
// - 200 model reads per day for the whole app.
// Past either: caller returns HTTP 429 with a friendly message.
// Server only (uses the admin client, bypasses RLS).

import "server-only";

export const UPLOADS_PER_VISITOR_PER_HOUR = 10;
export const READS_GLOBAL_PER_DAY = 200;

function hourWindowStart(now = new Date()) {
  const d = new Date(now);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

function dayWindowStart(now = new Date()) {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function hourKey(userId, now = new Date()) {
  const d = new Date(now);
  const day = d.toISOString().slice(0, 10);
  const hour = String(d.getUTCHours()).padStart(2, "0");
  return `upload:${userId}:${day}-${hour}`;
}

function dayKey(now = new Date()) {
  return `reads:global:${now.toISOString().slice(0, 10)}`;
}

// Returns { allowed, count } using the atomic Postgres function
// increment_usage (0003_rate_limit_fn.sql). One RPC = one increment.
// allowed when count <= limit (first 10 uploads pass, 11th blocked).
async function checkAndIncrement(admin, key, windowStart, limit) {
  const { data, error } = await admin.rpc("increment_usage", {
    p_key: key,
    p_window_start: windowStart,
  });
  if (error) throw error;
  const count = typeof data === "number" ? data : Number(data);
  if (!Number.isFinite(count)) throw new Error("Bad counter.");
  return { allowed: count <= limit, count };
}

export async function checkUploadLimit(admin, userId) {
  const windowStart = hourWindowStart();
  return checkAndIncrement(
    admin,
    hourKey(userId),
    windowStart,
    UPLOADS_PER_VISITOR_PER_HOUR
  );
}

export async function checkGlobalReadLimit(admin) {
  const windowStart = dayWindowStart();
  return checkAndIncrement(admin, dayKey(), windowStart, READS_GLOBAL_PER_DAY);
}
