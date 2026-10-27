// app/api/session/route.js
//
// Step 4: anonymous visitor sessions (no passwords, no OTP).
// POST ensures the visitor has an anonymous session and returns the user id.
// GET returns the current user id (verified with getClaims) or null.
// Writes to tables still happen only in later step routes via admin client.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) {
    return NextResponse.json({ user_id: null });
  }
  return NextResponse.json({ user_id: data.claims.sub });
}

export async function POST() {
  const supabase = await createClient();

  const { data: claimData } = await supabase.auth.getClaims();
  if (claimData?.claims?.sub) {
    return NextResponse.json({ user_id: claimData.claims.sub });
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
