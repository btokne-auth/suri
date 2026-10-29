// app/api/processes/route.js
//
// Step 7c Part 2: list builtins + owned saved processes for /start.
// Anonymous visitors get builtins only (unchanged); a signed-in visitor
// also gets their own saved_* rows. No secrets, labels only.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { listProcesses } = require("../../../lib/processes/index.js");
const { listProcessesForUser } = require("../../../lib/processes/resolve.js");

export async function GET() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub || null;
    if (!userId) return NextResponse.json({ processes: listProcesses() });
    const admin = createAdminClient();
    const processes = await listProcessesForUser(admin, userId);
    return NextResponse.json({ processes });
  } catch {
    return NextResponse.json({ processes: listProcesses() });
  }
}
