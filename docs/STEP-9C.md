# Suri Step 9C — Security Pass Plan (Act 1 + Act 2)

> Branch: `step-9-security` · Approved plan. Full audit for REQUIREMENTS.md
> Security pass (Day 7). Two small Act tasks, each < ~100k context.

**5 baked-in decisions:**

1. Anonymous sign-in IP limit server-side: `POST /api/session` signs in via server,
   so Supabase sees Vercel egress IP. Dashboard raised to 300/hour; we add our
   own per-real-IP limit (hashed x-forwarded-for, 10/hour, 429).
2. CSP only in production: Content-Security-Policy emitted only when
   NODE_ENV === "production". Other headers apply everywhere.
3. No unsafe-eval yet: when Compare with plain OCR (Tesseract) ships, add only
   wasm-unsafe-eval + what Tesseract needs.
4. Rate limits: uploads 60/hr per IP, retries 10/hr per slot,
   answers 20/hr per visitor. Also apply IP limit to POST /api/submissions.
   IPs hashed with RATE_LIMIT_SALT (add to .env.example as empty value).
5. Delete dev routes: app/api/test-seed, app/test-isolation, app/test-upload.

## 1. Audit — what was read

docs/SUMMARY.md, docs/REQUIREMENTS.md Security, next.config.mjs, proxy.js,
lib/rate-limit.js, app/api/upload/route.js, app/api/setup/draft/route.js,
app/api/clarifications/[id]/route.js, full app/api/ list, test-seed,
read-background.js, clarify-ask.js, reader.js, decide-usability.js,
validation.js, checks/run-checks.js, supabase/migrations/*.sql,
app/layout.js, globals.css, DESIGN.md, package.json.

## 2. Findings (file, risk, fix)

### F1 — next.config.mjs — No security headers

- File: only allowedDevOrigins, cacheComponents.
- Risk: No CSP, frame-ancestors, Referrer-Policy, X-Content-Type-Options,
  Permissions-Policy. Iframe hijack, MIME sniff.
- Fix Act1: add headers(). CSP prod-only: default-src self;
  script-src self unsafe-inline (no unsafe-eval); style-src self
  unsafe-inline https://fonts.googleapis.com; font-src self
  https://fonts.gstatic.com data:; connect-src self <supabaseOrigin>
  https://*.supabase.co; img-src self data: blob: <supabaseOrigin>
  https://*.supabase.co; media-src self blob:; object-src none;
  base-uri self; form-action self; frame-ancestors none;
  upgrade-insecure-requests. Always: X-Content-Type-Options nosniff,
  Referrer-Policy strict-origin-when-cross-origin, X-Frame-Options DENY,
  Permissions-Policy camera=(self) etc, Cross-Origin-Opener same-origin.

Breakage: script-src needs unsafe-inline for Next hydration; img-src needs
data:/blob: for previews + signed URLs; connect-src needs supabase;
style-src needs unsafe-inline; frame-ancestors none blocks embeds intentionally.

### F2 — allowedDevOrigins unconditional (next.config.mjs:9)

- Risk: Leaks LAN IP to public repo.
- Fix Act1: only in dev: ...(NODE_ENV==="development"?{allowedDevOrigins:["192.168.1.6"]}:{} )

### F3 — lib/rate-limit.js — Missing per-IP / per-slot / answer limits

- Today only upload per visitor 10/hr + global reads 200/day via increment_usage.
- Risk: N anon users = N*10/hr bypass; slot spam; answer spam.
- Fix Act2 reuse increment_usage, no new tables: hashIp = sha256(ip + RATE_LIMIT_SALT)
  slice 0,16; getClientIp = x-forwarded-for first hop. Helpers:
  checkSessionIpLimit session:ip:<hash>:hour 10/hr (POST /api/session);
  checkUploadIpLimit upload:ip:<hash>:hour 60/hr;
  checkRetryPerSlot retry:<submissionId>:<docType>:hour 10/hr;
  checkClarifyAnswerLimit clarifyAns:user:<userId>:hour 20/hr.
  Also apply IP limit to POST /api/submissions. 429 + Retry-After + no-store.

### F4 — Anonymous sign-in abuse (app/api/session/route.js)

- Risk: Server sign-in groups by Vercel IP, Supabase per-IP useless.
- Fix: Dashboard 300/hr safety net; app 10/hr per real IP (hashed x-forwarded-for) on POST /api/session. No captcha for demo.

### F5 — Dev-only routes

- Inventory: app/api/test-seed, app/test-isolation, app/test-upload (404 in prod).
- Fix Act1: git rm -r all three. History/migrations stay as proof.

### F6 — Error messages leaking internals

- Files: test-seed leaked profError.message; clarify-ask wrote e.message into
  work_log visible via GET /api/submissions/[id].
- Fix Act1: delete test-seed; in clarify-ask.js replace every String(e.message) work_log
  with fixed friendly string e.g. "Could not generate clarifications. A person will decide."

### F7 — SHA-256 per file — done

- app/api/upload:72-77 + column documents.sha256 text in 0001. Verify 64-hex.

### F8 — Private storage, RLS, secrets — good

- authenticated SELECT-only, anon nothing, usage_counters no grant,
  storage.objects no policies (private, signed URLs), admin.js has server-only,
  .gitignore covers .env*.

### F9 — Other abuses noted

- Large JSON bodies mitigated by Vercel 4.5MB + limits. Submission churn fixed
  by IP limit on /api/submissions. SameSite cookie acceptable.

## 3. Act tasks

### Act 1 — Headers + allowedDevOrigins + error cleanup + deletions + CSP test

Goal: Close F1,F2,F5,F6, verify F7.

In scope:
- next.config.mjs: headers() CSP prod-only via helper lib/csp.js buildCsp(origin)
  for testability; always-on other headers; guard allowedDevOrigins dev-only.
- .env.example: append RATE_LIMIT_SALT= (empty).
- lib/clarify-ask.js: replace String(e.message) work_log with friendly fixed string.
- Deletions: git rm -r app/api/test-seed app/test-isolation app/test-upload.
- Tests: tests/csp.test.js asserts frame-ancestors none, camera self, data/blob in
  img-src, supabase origin, no unsafe-eval, unsafe-inline present, prod-only.

Done when: curl -I dev=no CSP but other headers; prod has full CSP; Vercel preview
same; images/upload work; dev routes absent; work_log no raw errors.

### Act 2 — Rate limits (session, upload, submissions, answers)

Goal: Close F3+F4 with agreed limits, hashed IPs.

In scope:
- lib/rate-limit.js: getClientIp, hashIp, secondsToNextHour, constants
  SESSIONS_PER_IP=10, UPLOADS_PER_IP=60, RETRIES_PER_SLOT=10, ANSWERS_PER_VISITOR=20
  + 4 check* functions via checkAndIncrement, salt = RATE_LIMIT_SALT.
- app/api/session POST: before signInAnonymously check 10/hr -> 429.
- app/api/upload POST: after visitor/global checks add IP 60/hr + slot 10/hr before upload.
- app/api/submissions POST: add IP 60/hr before DB.
- app/api/clarifications/[id] PATCH: after validateAnswer add 20/hr visitor -> 429.
- Tests: rate-limit mocks at limit+1, clarification 429 case, Retry-After header.

Done when: 11th session same IP 429, 61st upload IP 429, 11th slot 429, 21st answer 429;
normal flows work; usage_counters keys hashed; eval unchanged; lint/build/360+1280 pass.

## 4. Manual checks (you do yourself)

- Supabase Auth Rate Limits anon 300/hr; Security Advisor 0 errors (storage no-RLS expected);
  Storage uploads Public Off; documents sha256 64-hex; Vercel env RATE_LIMIT_SALT set;
  npm audit no high, lint 0, build --webpack pass; git log author check; gitleaks no values;
  curl -I headers prod vs dev; hammer 429 with Retry-After; 360px + 1280px OK.

## 5. After both Acts

Tick REQUIREMENTS Security items, SCHEDULE Where we are now + Daily log
("CSP prod-only no unsafe-eval" + "limits 10/60/10/20 via SALT hash anon 300/hr deleted dev routes"),
keep --webpack, re-run eval.

*End — hand to Cline for Act 1.*