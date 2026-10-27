// lib/supabase/server.js
//
// Server client (runs in Server Components / Routes / Server Actions).
// Uses the public URL + publishable key only -- never the secret key.
// Session comes from cookies; RLS still limits reads to own rows.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component (read-only cookies).
            // proxy.js refreshes the session instead.
          }
        },
      },
    }
  );
}
