// app/api/test-seed/route.js
//
// Step 4 test helper only (local development: 404 in production).
// Creates one profile + submission row for the current anonymous visitor
// using the admin client (bypasses RLS) after verifying identity with getClaims().
// Lets two browsers each own a row so the isolation test has something to compare.
// Real profile/upload routes in steps 5-6 replace this.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) {
    return NextResponse.json({ error: "No session." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { error: profError } = await admin
    .from("profiles")
    .upsert({ user_id: userId }, { onConflict: "user_id" });
  if (profError) {
    return NextResponse.json(
      { error: "Seed failed at profiles upsert: " + profError.message },
      { status: 500 }
    );
  }

  const { data: existing } = await admin
    .from("submissions")
    .select("id")
    .eq("user_id", userId)
    .eq("process_id", "linawan_scholarship_intake")
    .limit(1);
  let submissionId = existing?.[0]?.id ?? null;
  if (!submissionId) {
    const { data: inserted, error: insError } = await admin
      .from("submissions")
      .insert({ user_id: userId, process_id: "linawan_scholarship_intake" })
      .select("id")
      .single();
    if (insError) {
      return NextResponse.json(
        { error: "Seed failed at submissions insert: " + insError.message },
        { status: 500 }
      );
    }
    submissionId = inserted.id;
  }

  return NextResponse.json({ user_id: userId, submission_id: submissionId });
}
