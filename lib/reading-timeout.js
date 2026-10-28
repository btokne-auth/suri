// lib/reading-timeout.js
//
// Robustness fix: a document can get stuck in "reading" forever if the
// background read dies (API error, timeout, after() never ran).
// If a document has been "uploaded"/"reading" for more than 2 minutes,
// GET /api/submissions/[id] treats it as "error" with a friendly message
// and allows re-upload (newest row wins, so uploading again just works).
// No cron needed: the check runs on page load.
//
// Pure helper (no database) so it can be unit-tested with node --test.

const READING_TIMEOUT_MS = 2 * 60 * 1000;
const READING_TIMEOUT_MESSAGE = 'Reading took too long. Please upload again.';

function isStaleReading(status, created_at, nowMs) {
  if (status !== 'uploaded' && status !== 'reading') return false;
  if (!created_at) return false;
  const when = typeof nowMs === 'number' ? nowMs : Date.now();
  const t = new Date(created_at).getTime();
  if (Number.isNaN(t)) return false;
  return when - t > READING_TIMEOUT_MS;
}

module.exports = { READING_TIMEOUT_MS, READING_TIMEOUT_MESSAGE, isStaleReading };
