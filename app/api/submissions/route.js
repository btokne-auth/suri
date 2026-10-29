// app/api/submissions/route.js
//
// Build order step 5: POST /api/submissions.
// Step 7: process-agnostic via lib/processes registry.
// Creates or returns the visitor's submission for a process_id.
// Server only: getClaims() + admin write.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { resolveProcess } = require("../../../lib/processes/resolve.js");

export async function POST(request) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) {
    return NextResponse.json({ error: "No session. Please reload." }, { status: 401 });
  }

  let body = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const processId = body?.process_id;
  if (typeof processId !== "string" || !processId) {
    return NextResponse.json({ error: "Unknown process." }, { status: 400 });
  }

  const admin = createAdminClient();
  // Step 7c Part 2: builtins + owned saved_* (wrong owner -> Unknown process).
  const bundle = await resolveProcess(admin, processId, userId);
  if (!bundle) {
    return NextResponse.json({ error: "Unknown process." }, { status: 400 });
  }
  const { data: existing, error: selError } = await admin
    .from("submissions")
    .select("id")
    .eq("user_id", userId)
    .eq("process_id", processId)
    .maybeSingle();
  if (selError) {
    return NextResponse.json({ error: "Could not load submission. Please try again." }, { status: 500 });
  }
  if (existing?.id) {
    return NextResponse.json({ submission_id: existing.id });
  }

  const { data: inserted, error: insError } = await admin
    .from("submissions")
    .insert({ user_id: userId, process_id: processId })
    .select("id")
    .single();
  if (insError) {
    // Race: another request created it first (UNIQUE user_id+process_id).
    const { data: retry } = await admin
      .from("submissions")
      .select("id")
      .eq("user_id", userId)
      .eq("process_id", processId)
      .maybeSingle();
    if (retry?.id) {
      return NextResponse.json({ submission_id: retry.id });
    }
    return NextResponse.json({ error: "Could not create submission. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ submission_id: inserted.id });
}
