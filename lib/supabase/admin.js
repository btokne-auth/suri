// lib/supabase/admin.js
//
// Service-role client for server-side writes ONLY.
// Bypasses RLS, so every caller must FIRST:
//   1. verify the user with getClaims(),
//   2. check in code the submission/document belongs to that user,
//   3. run the step-3 Zod validation.
// Never import this file from browser code.

import "server-only";

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
