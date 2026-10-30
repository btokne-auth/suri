// app/api/session/route.js
//
// Step 4: anonymous visitor sessions (no passwords, no OTP).
// POST ensures the visitor has an anonymous session and returns the user id.
// GET returns the current user id (verified with getClaims) or null.
// Writes to tables still happen only in later step routes via admin client.

import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp, checkSessionIpLimit, secondsToNextHour } from "@/lib/rate-limit";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) {
    return NextResponse.json({ user_id: null });
  }
  return NextResponse.json({ user_id: data.claims.sub });
}

export async function POST(request) {
  const supabase = await createClient();

  const { data: claimData } = await supabase.auth.getClaims();
  if (claimData?.claims?.sub) {
    return NextResponse.json({ user_id: claimData.claims.sub });
  }

  // Act 2: per-IP limit 10/hour for anonymous sign-ins
  try {
    const admin = createAdminClient();
    const ip = getClientIp(request);
    const rl = await checkSessionIpLimit(admin, ip);
    if (!rl.allowed) {
      const retry = secondsToNextHour();
      return NextResponse.json(
        { error: "Too many sign-in attempts. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(retry), "Cache-Control": "no-store" } }
      );
    }
  } catch {
    // If rate-limit check fails, continue; DB errors are not leaked to client
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    return NextResponse.json(
      { error: "Could not start a session. Please try again." },
      { status: 500 }
    );
  }
  return NextResponse.json({ user_id: data.user?.id ?? null });
}
