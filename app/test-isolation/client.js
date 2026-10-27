// app/test-isolation/client.js
//
// Client UI for the step-4 isolation check. Rendered only by page.js,
// which 404s outside local development.

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function TestIsolationClient() {
  const [userId, setUserId] = useState(null);
  const [submissionId, setSubmissionId] = useState(null);
  const [seedError, setSeedError] = useState(null);
  const [mySubs, setMySubs] = useState(null);
  const [myProfiles, setMyProfiles] = useState(null);
  const [insertResult, setInsertResult] = useState(null);
  const [otherId, setOtherId] = useState("");
  const [otherResult, setOtherResult] = useState(null);
  const [log, setLog] = useState([]);

  function addLog(line) {
    setLog((prev) => [...prev, line]);
  }

  async function run() {
    setLog([]);
    setSeedError(null);
    setSubmissionId(null);
    const supabase = createClient();

    const sess = await fetch("/api/session", { method: "POST" }).then((r) => r.json());
    setUserId(sess.user_id ?? null);
    addLog("session user_id: " + (sess.user_id ?? "(none)"));

    const seed = await fetch("/api/test-seed", { method: "POST" }).then((r) => r.json());
    setSubmissionId(seed.submission_id ?? null);
    setSeedError(seed.error ?? null);
    addLog("seed submission_id: " + (seed.submission_id ?? JSON.stringify(seed)));

    const { data: subs, error: subsErr } = await supabase.from("submissions").select("id,process_id,status");
    setMySubs(subsErr ? { error: subsErr.message } : subs);
    addLog("browser SELECT submissions: " + (subsErr ? "ERROR " + subsErr.message : subs?.length + " row(s)"));

    const { data: profs, error: profErr } = await supabase.from("profiles").select("id,user_id");
    setMyProfiles(profErr ? { error: profErr.message } : profs);
    addLog("browser SELECT profiles: " + (profErr ? "ERROR " + profErr.message : profs?.length + " row(s)"));

    const { error: insErr } = await supabase.from("profiles").insert({ user_id: sess.user_id });
    setInsertResult(insErr ? "BLOCKED as expected: " + insErr.message : "UNEXPECTED: insert succeeded");
    addLog("browser INSERT profiles: " + (insErr ? "BLOCKED " + insErr.message : "SUCCEEDED (bad)"));
  }

  async function tryOther() {
    const supabase = createClient();
    const id = otherId.trim();
    if (!id) return;
    const { data, error } = await supabase.from("submissions").select("id").eq("id", id);
    setOtherResult(error ? "ERROR: " + error.message : data?.length === 0 ? "0 rows (correct: can't see other's row)" : JSON.stringify(data) + " (BAD: saw other's row)");
  }

  return (
    <main style={{ padding: 16, maxWidth: 560, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1>Step 4 isolation test</h1>
      <p>Open this same page in two different browsers. Each should see only its own row.</p>
      <button onClick={run} style={{ padding: "12px 20px", minHeight: 44 }}>Run test</button>
      {userId && (
        <>
          <p><b>My user_id:</b> <code>{userId}</code></p>
          <p><b>My submission_id:</b> <code>{submissionId ?? "(none — seed failed)"}</code></p>
          {seedError && (
            <p style={{ color: "#F29A9A" }}><b>Seed error:</b> <code>{seedError}</code></p>
          )}
          <p><b>My submissions (browser SELECT):</b> <code>{JSON.stringify(mySubs)}</code></p>
          <p><b>My profiles (browser SELECT):</b> <code>{JSON.stringify(myProfiles)}</code></p>
          <p><b>Browser INSERT attempt:</b> <code>{insertResult}</code></p>
          <div style={{ marginTop: 16 }}>
            <label>Paste OTHER browser&apos;s submission_id here, then check:<br />
              <input value={otherId} onChange={(e) => setOtherId(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 8 }} placeholder="other submission_id" />
            </label>
            <button onClick={tryOther} style={{ padding: "12px 20px", minHeight: 44, marginTop: 8 }}>Try to read other row</button>
            {otherResult && <p><b>Result:</b> <code>{otherResult}</code></p>}
          </div>
          <h2>Log</h2>
          <pre style={{ whiteSpace: "pre-wrap", background: "#eee", color: "#111", padding: 12 }}>{log.join("\n")}</pre>
        </>
      )}
    </main>
  );
}
