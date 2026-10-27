// lib/supabase/client.js
//
// Browser client (public URL + publishable key only).
// Read-only in practice: RLS + grants allow SELECT of own rows only.
// All writes go through server routes using lib/supabase/admin.js.

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
