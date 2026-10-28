// app/api/processes/route.js
//
// Step 7: public list of ALL processes for /start.
// Ids + labels only (already shown in the UI). No auth needed.
import { NextResponse } from "next/server";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { listProcesses } = require("../../../lib/processes/index.js");

export async function GET() {
  return NextResponse.json({ processes: listProcesses() });
}
