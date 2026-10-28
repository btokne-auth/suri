// lib/review-auth.js
//
// Step 7: ownership check helper (pure, no database, no secrets).
// Same 404 behavior in both reviewer routes: only an exact
// user_id match owns the row. Anything else is "Not found".

function isOwnedBy(sub, userId) {
  if (!sub || typeof sub !== 'object') return false;
  if (typeof userId !== 'string' || !userId) return false;
  if (typeof sub.user_id !== 'string' || !sub.user_id) return false;
  return sub.user_id === userId;
}

module.exports = { isOwnedBy };
