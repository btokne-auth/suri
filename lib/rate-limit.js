// lib/rate-limit.js
//
// Build order step 5: rate limits in usage_counters.
// - 30 uploads per visitor per hour.
// - 500 model reads per day for the whole app.
// Past either: caller returns HTTP 429 with a friendly message.
// Server only (uses the admin client, bypasses RLS).

import "server-only";

import { createHash } from "node:crypto";

export const UPLOADS_PER_VISITOR_PER_HOUR = 30;
export const READS_GLOBAL_PER_DAY = 500;

// Act 2 limits
export const SESSIONS_PER_IP_PER_HOUR = 10;
export const SESSIONS_PER_IP = SESSIONS_PER_IP_PER_HOUR;
export const UPLOADS_PER_IP_PER_HOUR = 60;
export const UPLOADS_PER_IP = UPLOADS_PER_IP_PER_HOUR;
export const RETRIES_PER_SLOT_PER_HOUR = 10;
export const RETRIES_PER_SLOT = RETRIES_PER_SLOT_PER_HOUR;
export const ANSWERS_PER_VISITOR_PER_HOUR = 20;
export const ANSWERS_PER_VISITOR = ANSWERS_PER_VISITOR_PER_HOUR;

let _warnedSaltMissing = false;

export function getClientIp(req) {
  let headerVal = null;
  if (req && req.headers && typeof req.headers.get === "function") {
    headerVal = req.headers.get("x-forwarded-for") || req.headers.get("X-Forwarded-For");
  } else if (req && typeof req.headers === "object" && req.headers !== null) {
    // plain object header map (tests)
    headerVal =
      req.headers["x-forwarded-for"] ||
      req.headers["X-Forwarded-For"] ||
      req.headers["x-forwarded-for".toUpperCase()] ||
      null;
  } else if (typeof req === "string") {
    headerVal = req;
  }
  if (!headerVal || typeof headerVal !== "string") return "unknown";
  const first = headerVal.split(",")[0].trim();
  return first || "unknown";
}

export function hashIp(ip) {
  const raw = String(ip ?? "unknown");
  const salt = process.env.RATE_LIMIT_SALT || "";
  if (!salt && !_warnedSaltMissing) {
    _warnedSaltMissing = true;
    try {
      console.warn("[rate-limit] RATE_LIMIT_SALT is not set; using unsalted hash");
    } catch {}
  }
  return createHash("sha256").update(raw + salt).digest("hex");
}

export function secondsToNextHour(now = new Date()) {
  const n = now instanceof Date ? now : new Date(now);
  const next = new Date(n);
  next.setUTCMilliseconds(0);
  next.setUTCSeconds(0);
  next.setUTCMinutes(0);
  next.setUTCHours(n.getUTCHours() + 1);
  const diffMs = next.getTime() - n.getTime();
  return Math.max(1, Math.ceil(diffMs / 1000));
}

function hourSuffix(now = new Date()) {
  const d = new Date(now);
  const day = d.toISOString().slice(0, 10);
  const hour = String(d.getUTCHours()).padStart(2, "0");
  return `${day}-${hour}`;
}

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

export async function checkSessionIpLimit(admin, ip, now = new Date()) {
  const hash = hashIp(ip);
  const windowStart = hourWindowStart(now);
  const suffix = hourSuffix(now);
  const key = `session:ip:${hash}:${suffix}`;
  return checkAndIncrement(admin, key, windowStart, SESSIONS_PER_IP_PER_HOUR);
}

export async function checkUploadIpLimit(admin, ip, now = new Date()) {
  const hash = hashIp(ip);
  const windowStart = hourWindowStart(now);
  const suffix = hourSuffix(now);
  const key = `upload:ip:${hash}:${suffix}`;
  return checkAndIncrement(admin, key, windowStart, UPLOADS_PER_IP_PER_HOUR);
}

// Same IP limit reused for submissions (60/hour per IP)
export const checkSubmissionIpLimit = checkUploadIpLimit;

export async function checkRetryPerSlot(admin, submissionId, docType, now = new Date()) {
  const windowStart = hourWindowStart(now);
  const suffix = hourSuffix(now);
  const sid = String(submissionId ?? "unknown");
  const dt = String(docType ?? "unknown");
  const key = `retry:${sid}:${dt}:${suffix}`;
  return checkAndIncrement(admin, key, windowStart, RETRIES_PER_SLOT_PER_HOUR);
}

export async function checkClarifyAnswerLimit(admin, userId, now = new Date()) {
  const windowStart = hourWindowStart(now);
  const suffix = hourSuffix(now);
  const uid = String(userId ?? "unknown");
  // Keep naming close to spec: clarifyAns:user:<id>:hour is also acceptable;
  // we use clarify:ans:<id>:<hour> which still contains userId and hashed check not IP
  const key = `clarifyAns:user:${uid}:${suffix}`;
  return checkAndIncrement(admin, key, windowStart, ANSWERS_PER_VISITOR_PER_HOUR);
}

// Back-compat aliases for tests that might import these names
export const checkClarifyAnswerPerVisitorLimit = checkClarifyAnswerLimit;
