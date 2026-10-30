// tests/clarifications-route.test.js
// Step 9B Act 4: PATCH /api/clarifications/[id] — fake admin client
// Covers: 401 (no session), 404 (another visitor's clarification), 409 (already answered),
// 400 (empty answer, 201 characters, "<script>"), 200 (saves trimmed answer)
// Also asserts route never writes to extracted_fields or check_results (static + runtime)

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateAnswer } = require('../lib/clarify');

const ROUTE_PATH = path.join(__dirname, '..', 'app', 'api', 'clarifications', '[id]', 'route.js');
const ROUTE_SRC = fs.readFileSync(ROUTE_PATH, 'utf8');

function transformRoute(src) {
  return src
    .replace(/import 'server-only';\s*\n/, '')
    .replace(/import \{ NextResponse \} from 'next\/server';\s*\n/, 'const { NextResponse } = __mocks.nextServer;\n')
    .replace(/import \{ createClient \} from '@\/lib\/supabase\/server';\s*\n/, 'const { createClient } = __mocks.supabaseServer;\n')
    .replace(/import \{ createAdminClient \} from '@\/lib\/supabase\/admin';\s*\n/, 'const { createAdminClient } = __mocks.supabaseAdmin;\n')
    .replace(/import \{ createRequire \} from 'node:module';\s*\nconst require = createRequire\(import\.meta\.url\);\s*\nconst \{ validateAnswer \} = require\(.*?\);\s*\n/, 'const { validateAnswer } = __mocks.clarify;\n')
    .replace(/export async function PATCH/, '__exports.PATCH = async function PATCH');
}
const TRANSFORMED = transformRoute(ROUTE_SRC);
function loadPatchWithMocks(mocks) {
  const __mocks = mocks;
  const __exports = {};
  const fn = new Function('__mocks', '__exports', TRANSFORMED + '\nreturn __exports;');
  return fn(__mocks, __exports).PATCH;
}
// --- fake admin client ---
function makeAdmin({ clarifications, submissions }) {
  const clarRows = clarifications ? clarifications.map((c) => ({ ...c })) : [];
  const subRows = submissions ? submissions.map((s) => ({ ...s })) : [];
  const calls = [];
  const writes = [];
  const workLogs = [];
  const state = { clarifications: clarRows, submissions: subRows, workLogs, calls, writes };
  function from(table) {
    calls.push({ table, op: 'from' });
    const ctx = { table, filters: [], operation: null, payload: null, selectFields: null };
    const chain = {
      select(fields) { ctx.selectFields = fields; return chain; },
      eq(col, val) {
        ctx.filters.push({ col, val });
        if (ctx.operation === 'update') {
          return (async () => {
            writes.push({ table, op: 'update', payload: ctx.payload, filters: [...ctx.filters] });
            if (table === 'clarifications') {
              const idF = ctx.filters.find((f) => f.col === 'id');
              if (!idF) return { error: { message: 'missing id filter' } };
              const row = clarRows.find((r) => r.id === idF.val);
              if (!row) return { error: { message: 'not found' } };
              Object.assign(row, ctx.payload);
              return { error: null };
            }
            return { error: null };
          })();
        }
        return chain;
      },
      update(payload) { ctx.operation = 'update'; ctx.payload = payload; return chain; },
      insert(payload) {
        writes.push({ table, op: 'insert', payload });
        calls.push({ table, op: 'insert' });
        if (table === 'work_log') {
          const arr = Array.isArray(payload) ? payload : [payload];
          for (const r of arr) workLogs.push(r);
          return Promise.resolve({ error: null, data: null });
        }
        if (table === 'clarifications') {
          const arr = Array.isArray(payload) ? payload : [payload];
          for (const r of arr) clarRows.push(r);
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ error: null, data: null });
      },
      maybeSingle: async () => {
        if (table === 'clarifications') {
          const f = ctx.filters.find((ff) => ff.col === 'id');
          const row = f ? clarRows.find((c) => c.id === f.val) : null;
          return { data: row ? { ...row } : null, error: null };
        }
        if (table === 'submissions') {
          const f = ctx.filters.find((ff) => ff.col === 'id');
          const row = f ? subRows.find((s) => s.id === f.val) : null;
          return { data: row ? { ...row } : null, error: null };
        }
        return { data: null, error: null };
      },
      then(resolve, reject) {
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      },
    };
    return chain;
  }
  return { from, _state: state, _calls: calls, _writes: writes, _clarRows: clarRows, _subRows: subRows, _workLogs: workLogs };
}
function makeRequest(body) { return { json: async () => body }; }
function makeCtx(id) { return { params: { id } }; }
function makeCtxPromise(id) { return { params: Promise.resolve({ id }) }; }
function nextServerMock() {
  return { NextResponse: { json: (body, init) => { const status = (init && init.status) || 200; return { status, _body: body, json: async () => body, body }; } } };
}
function supabaseServerMock({ userId, error }) {
  return {
    createClient: async () => ({
      auth: {
        getClaims: async () => {
          if (error) return { data: null, error };
          if (!userId) return { data: { claims: {} }, error: null };
          return { data: { claims: { sub: userId } }, error: null };
        },
      },
    }),
  };
}
function supabaseAdminMock(admin) { return { createAdminClient: () => admin }; }
function assertNoForbiddenWrites(admin, msgPrefix) {
  const forbidden = ['extracted_fields', 'check_results'];
  for (const c of admin._calls) assert.ok(!forbidden.includes(c.table), (msgPrefix || '') + ' must not touch ' + c.table + ' (from call)');
  for (const w of admin._writes) {
    assert.ok(!forbidden.includes(w.table), (msgPrefix || '') + ' must not write to ' + w.table);
    if (w.payload && typeof w.payload === 'object') {
      for (const k of Object.keys(w.payload)) assert.ok(!forbidden.includes(k), (msgPrefix || '') + ' payload contains forbidden key ' + k);
    }
  }
}

// --- static guard ---
describe('clarifications route static guard: never writes extracted_fields or check_results', () => {
  it('file content does not reference those tables for writes', () => {
    const content = ROUTE_SRC;
    const hasExtracted = /from\s*\(\s*['"`]extracted_fields['"`]\s*\)/.test(content);
    const hasCheckResults = /from\s*\(\s*['"`]check_results['"`]\s*\)/.test(content);
    assert.equal(hasExtracted, false, 'route must not touch extracted_fields');
    assert.equal(hasCheckResults, false, 'route must not touch check_results');
  });
});

describe('PATCH /api/clarifications/[id] — fake admin client', () => {
  const CLAR_ID = 'clar-1';
  const SUB_ID = 'sub-1';
  const OWNER = 'user-owner';
  const OTHER = 'user-other';
  const BASE_CLAR = {
    id: CLAR_ID,
    submission_id: SUB_ID,
    field_key: 'full_name',
    pair_key: 'full_name|ma theresa|maria theresa',
    question: 'Is "Ma. Theresa" the same person as "Maria Theresa" for Full Name?',
    answer: null,
    check_result_id: 'cr-1',
    created_at: '2026-10-30T01:00:00Z',
  };
  const BASE_SUB_OWNER = { id: SUB_ID, user_id: OWNER };

  it('401 when no session (no userId)', async () => {
    const admin = makeAdmin({ clarifications: [BASE_CLAR], submissions: [BASE_SUB_OWNER] });
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: null }), supabaseAdmin: supabaseAdminMock(admin), clarify: { validateAnswer } };
    const PATCH = loadPatchWithMocks(mocks);
    const res = await PATCH(makeRequest({ answer: 'hello' }), makeCtx(CLAR_ID));
    assert.equal(res.status, 401);
    assert.match(res._body.error, /No session/i);
    assert.equal(admin._writes.length, 0, 'should not write on 401');
    assertNoForbiddenWrites(admin, '401');
  });

  it('401 when getClaims returns error', async () => {
    const admin = makeAdmin({ clarifications: [BASE_CLAR], submissions: [BASE_SUB_OWNER] });
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER, error: { message: 'bad jwt' } }), supabaseAdmin: supabaseAdminMock(admin), clarify: { validateAnswer } };
    const PATCH = loadPatchWithMocks(mocks);
    const res = await PATCH(makeRequest({ answer: 'hello' }), makeCtx(CLAR_ID));
    assert.equal(res.status, 401);
    assert.equal(admin._writes.length, 0);
    assertNoForbiddenWrites(admin);
  });

  it('404 when another visitor tries to answer (cross-owner)', async () => {
    const admin = makeAdmin({ clarifications: [BASE_CLAR], submissions: [BASE_SUB_OWNER] });
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OTHER }), supabaseAdmin: supabaseAdminMock(admin), clarify: { validateAnswer } };
    const PATCH = loadPatchWithMocks(mocks);
    const res = await PATCH(makeRequest({ answer: 'Yes, same person' }), makeCtx(CLAR_ID));
    assert.equal(res.status, 404);
    assert.equal(admin._writes.length, 0, 'no writes on cross-owner 404');
    assertNoForbiddenWrites(admin, '404 cross-owner');
  });

  it('404 when clarification does not exist (also same as not owner — do not reveal)', async () => {
    const admin = makeAdmin({ clarifications: [], submissions: [BASE_SUB_OWNER] });
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin), clarify: { validateAnswer } };
    const PATCH = loadPatchWithMocks(mocks);
    const res = await PATCH(makeRequest({ answer: 'hello' }), makeCtx('nonexistent-id'));
    assert.equal(res.status, 404);
    assert.equal(admin._writes.length, 0);
    assertNoForbiddenWrites(admin);
  });

  it('409 when already answered (answer != null)', async () => {
    const already = { ...BASE_CLAR, answer: 'Already answered' };
    const admin = makeAdmin({ clarifications: [already], submissions: [BASE_SUB_OWNER] });
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin), clarify: { validateAnswer } };
    const PATCH = loadPatchWithMocks(mocks);
    const res = await PATCH(makeRequest({ answer: 'new answer' }), makeCtx(CLAR_ID));
    assert.equal(res.status, 409);
    assert.match(res._body.error, /already been answered/i);
    assert.equal(admin._writes.length, 0, 'no writes on 409');
    assert.equal(admin._clarRows[0].answer, 'Already answered', 'original answer preserved');
    assertNoForbiddenWrites(admin, '409');
  });

  it('400 when answer is empty string', async () => {
    const admin = makeAdmin({ clarifications: [BASE_CLAR], submissions: [BASE_SUB_OWNER] });
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin), clarify: { validateAnswer } };
    const PATCH = loadPatchWithMocks(mocks);
    const res = await PATCH(makeRequest({ answer: '' }), makeCtx(CLAR_ID));
    assert.equal(res.status, 400);
    assert.match(res._body.error, /empty/i);
    assert.equal(admin._writes.length, 0, 'no writes on 400 empty');
    assertNoForbiddenWrites(admin);
  });

  it('400 when answer is only whitespace (empty after trim)', async () => {
    const admin = makeAdmin({ clarifications: [BASE_CLAR], submissions: [BASE_SUB_OWNER] });
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin), clarify: { validateAnswer } };
    const PATCH = loadPatchWithMocks(mocks);
    const res = await PATCH(makeRequest({ answer: '   \n\t  ' }), makeCtx(CLAR_ID));
    assert.equal(res.status, 400);
    assert.equal(admin._writes.length, 0);
    assertNoForbiddenWrites(admin);
  });

  it('400 when answer is 201 characters (too long)', async () => {
    const long201 = 'a'.repeat(201);
    const admin = makeAdmin({ clarifications: [BASE_CLAR], submissions: [BASE_SUB_OWNER] });
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin), clarify: { validateAnswer } };
    const PATCH = loadPatchWithMocks(mocks);
    const res = await PATCH(makeRequest({ answer: long201 }), makeCtx(CLAR_ID));
    assert.equal(res.status, 400);
    assert.match(res._body.error, /too long/i);
    assert.equal(admin._writes.length, 0, 'no writes on 400 too long');
    assertNoForbiddenWrites(admin);
  });

  it('400 when answer is "<script>" (HTML tag)', async () => {
    const admin = makeAdmin({ clarifications: [BASE_CLAR], submissions: [BASE_SUB_OWNER] });
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin), clarify: { validateAnswer } };
    const PATCH = loadPatchWithMocks(mocks);
    const res = await PATCH(makeRequest({ answer: '<script>alert(1)</script>' }), makeCtx(CLAR_ID));
    assert.equal(res.status, 400);
    assert.match(res._body.error, /HTML/i);
    assert.equal(admin._writes.length, 0, 'no writes on 400 script');
    assertNoForbiddenWrites(admin, '400 script');
  });

  it('400 also for "<script>" variation with brackets', async () => {
    const admin = makeAdmin({ clarifications: [BASE_CLAR], submissions: [BASE_SUB_OWNER] });
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin), clarify: { validateAnswer } };
    const PATCH = loadPatchWithMocks(mocks);
    const res = await PATCH(makeRequest({ answer: '<script>' }), makeCtx(CLAR_ID));
    assert.equal(res.status, 400);
    assertNoForbiddenWrites(admin);
  });

  it('200 saves the trimmed answer and returns it', async () => {
    const admin = makeAdmin({ clarifications: [BASE_CLAR], submissions: [BASE_SUB_OWNER] });
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin), clarify: { validateAnswer } };
    const PATCH = loadPatchWithMocks(mocks);
    const raw = '  My name is Maria  ';
    const expectedTrim = 'My name is Maria';
    const res = await PATCH(makeRequest({ answer: raw }), makeCtx(CLAR_ID));
    assert.equal(res.status, 200);
    assert.equal(res._body.ok, true);
    assert.equal(res._body.clarification.id, CLAR_ID);
    assert.equal(res._body.clarification.question, BASE_CLAR.question);
    assert.equal(res._body.clarification.answer, expectedTrim, 'response should contain trimmed answer');
    assert.equal(admin._clarRows[0].answer, expectedTrim, 'stored answer must be trimmed');
    assert.ok(admin._workLogs.length >= 1, 'work_log should be inserted on success');
    const wl = admin._workLogs[0];
    assert.equal(wl.submission_id, SUB_ID);
    assert.equal(wl.step_type, 'clarification_answered');
    assert.ok(!wl.message.includes(expectedTrim), 'work_log message must not leak answer text');
    assert.ok(wl.message.length > 0);
    assertNoForbiddenWrites(admin, '200');
    const updateWrite = admin._writes.find((w) => w.op === 'update' && w.table === 'clarifications');
    assert.ok(updateWrite, 'should have clarifications update');
    assert.deepEqual(Object.keys(updateWrite.payload), ['answer'], 'update must only write answer field');
    assert.equal(updateWrite.payload.answer, expectedTrim);
  });

  it('200 works with ctx.params as Promise (Next 15+)', async () => {
    const admin = makeAdmin({ clarifications: [BASE_CLAR], submissions: [BASE_SUB_OWNER] });
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin), clarify: { validateAnswer } };
    const PATCH = loadPatchWithMocks(mocks);
    const res = await PATCH(makeRequest({ answer: 'trim me  ' }), makeCtxPromise(CLAR_ID));
    assert.equal(res.status, 200);
    assert.equal(res._body.clarification.answer, 'trim me');
    assertNoForbiddenWrites(admin);
  });

  it('200 accepts exactly 200 characters (boundary)', async () => {
    const exactly200 = 'b'.repeat(200);
    const admin = makeAdmin({ clarifications: [BASE_CLAR], submissions: [BASE_SUB_OWNER] });
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin), clarify: { validateAnswer } };
    const PATCH = loadPatchWithMocks(mocks);
    const res = await PATCH(makeRequest({ answer: exactly200 }), makeCtx(CLAR_ID));
    assert.equal(res.status, 200);
    assert.equal(res._body.clarification.answer.length, 200);
    assertNoForbiddenWrites(admin);
  });

  it('route never writes to extracted_fields or check_results even on success (runtime)', async () => {
    const admin = makeAdmin({ clarifications: [BASE_CLAR], submissions: [BASE_SUB_OWNER] });
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin), clarify: { validateAnswer } };
    const PATCH = loadPatchWithMocks(mocks);
    const res = await PATCH(makeRequest({ answer: 'valid answer' }), makeCtx(CLAR_ID));
    assert.equal(res.status, 200);
    assertNoForbiddenWrites(admin, 'success should not write forbidden');
    const forbiddenTables = admin._calls.filter((c) => ['extracted_fields', 'check_results'].includes(c.table));
    assert.equal(forbiddenTables.length, 0, 'no from() with forbidden tables');
  });

  it('400 cases also never write to forbidden tables', async () => {
    const cases = ['', 'a'.repeat(201), '<script>'];
    for (const ans of cases) {
      const admin = makeAdmin({ clarifications: [BASE_CLAR], submissions: [BASE_SUB_OWNER] });
      const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin), clarify: { validateAnswer } };
      const PATCH = loadPatchWithMocks(mocks);
      const res = await PATCH(makeRequest({ answer: ans }), makeCtx(CLAR_ID));
      assert.equal(res.status, 400, 'ans=' + ans.slice(0, 20));
      assertNoForbiddenWrites(admin, '400 case ' + ans.slice(0, 10));
    }
  });
});

