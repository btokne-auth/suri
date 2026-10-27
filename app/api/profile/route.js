// app/api/profile/route.js
//
// Build order step 5: POST /api/profile.
// Saves the visitor's profile, validated with Zod (reuses step-3 name/date rules).
// Server only: getClaims() + ownership (user_id) + admin write.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { validateProfile } = require("../../../lib/profile.js");

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
    return NextResponse.json({ error: "Bad profile data." }, { status: 400 });
  }

  const checked = validateProfile(body || {});
  if (!checked.ok) {
    return NextResponse.json({ error: checked.issues[0]?.message || "Bad profile data.", issues: checked.issues }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: upsertError } = await admin.from("profiles").upsert(
    {
      user_id: userId,
      given_name: checked.profile.given_name,
      middle_name: checked.profile.middle_name,
      surname: checked.profile.surname,
      suffix: checked.profile.suffix,
      birth_date: checked.profile.birth_date,
      city_municipality: checked.profile.city_municipality,
    },
    { onConflict: "user_id" }
  );
  if (upsertError) {
    return NextResponse.json({ error: "Could not save profile. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
