// tests/image-proxy.test.js — Step 9E Act 2: GET /api/documents/[id]/image-proxy
// Covers: 401 no session, 404 another visitor's document, 400 PDF, 200 image bytes with right content type
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROUTE_PATH = path.join(__dirname, '..', 'app', 'api', 'documents', '[id]', 'image-proxy', 'route.js');
const ROUTE_SRC = fs.readFileSync(ROUTE_PATH, 'utf8');

function transformRoute(src) {
  return src
    .replace(/import \{ NextResponse \} from 'next\/server';\s*\n/, 'const { NextResponse } = __mocks.nextServer;\n')
    .replace(/import \{ createClient \} from '@\/lib\/supabase\/server';\s*\n/, 'const { createClient } = __mocks.supabaseServer;\n')
    .replace(/import \{ createAdminClient \} from '@\/lib\/supabase\/admin';\s*\n/, 'const { createAdminClient } = __mocks.supabaseAdmin;\n')
    .replace(/export async function GET/, '__exports.GET = async function GET');
}
const TRANSFORMED = transformRoute(ROUTE_SRC);
function loadGetWithMocks(mocks) {
  const __mocks = mocks;
  const __exports = {};
  const fn = new Function('__mocks', '__exports', TRANSFORMED + '\nreturn __exports;');
  return fn(__mocks, __exports).GET;
}

function makeAdmin({ documents, submissions, signedUrl, signedError }) {
  const docRows = documents ? documents.map((d) => ({ ...d })) : [];
  const subRows = submissions ? submissions.map((s) => ({ ...s })) : [];
  const calls = [];
  function from(table) {
    calls.push({ table, op: 'from' });
    const ctx = { table, filters: [], selectFields: null };
    const chain = {
      select(fields) { ctx.selectFields = fields; return chain; },
      eq(col, val) { ctx.filters.push({ col, val }); return chain; },
      maybeSingle: async () => {
        if (table === 'documents') {
          const f = ctx.filters.find((ff) => ff.col === 'id');
          const row = f ? docRows.find((d) => d.id === f.val) : null;
          return { data: row ? { ...row } : null, error: null };
        }
        if (table === 'submissions') {
          const f = ctx.filters.find((ff) => ff.col === 'id');
          const row = f ? subRows.find((s) => s.id === f.val) : null;
          return { data: row ? { ...row } : null, error: null };
        }
        return { data: null, error: null };
      },
    };
    return chain;
  }
  const storage = {
    from: (bucket) => ({
      createSignedUrl: async (storagePath, expires) => {
        calls.push({ table: 'storage', bucket, storagePath, expires, op: 'createSignedUrl' });
        if (signedError) return { data: null, error: signedError };
        return { data: { signedUrl: signedUrl || 'https://example.supabase.co/storage/v1/object/sign/uploads/' + encodeURIComponent(storagePath) + '?token=abc' }, error: null };
      },
    }),
  };
  return { from, storage, _calls: calls, _docRows: docRows, _subRows: subRows };
}

function makeCtx(id) { return { params: { id } }; }
function makeCtxPromise(id) { return { params: Promise.resolve({ id }) }; }

function nextServerMock() {
  class MockResponse {
    constructor(body, init) {
      this.status = (init && init.status) || 200;
      this._body = body;
      this._headers = new Map();
      const hdrs = (init && init.headers) || {};
      for (const [k, v] of Object.entries(hdrs)) this._headers.set(k.toLowerCase(), v);
      this.headers = {
        get: (name) => this._headers.get(String(name).toLowerCase()) || null,
        has: (name) => this._headers.has(String(name).toLowerCase()),
        entries: () => this._headers.entries(),
      };
    }
    async arrayBuffer() {
      if (this._body instanceof ArrayBuffer) return this._body;
      if (Buffer.isBuffer(this._body)) return this._body.buffer.slice(this._body.byteOffset, this._body.byteOffset + this._body.byteLength);
      if (typeof this._body === 'string') return Buffer.from(this._body).buffer;
      return this._body;
    }
    async json() { return this._body; }
  }
  MockResponse.json = (body, init) => {
    const r = new MockResponse(body, init);
    r._body = body;
    return r;
  };
  return { NextResponse: MockResponse };
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
function mockFetch({ ok = true, contentType = 'image/jpeg', bodyBytes = Buffer.from([1,2,3,4]) } = {}) {
  return async (url) => ({
    ok,
    status: ok ? 200 : 500,
    headers: { get: (k) => (k.toLowerCase() === 'content-type' ? contentType : null) },
    arrayBuffer: async () => bodyBytes.buffer.slice(bodyBytes.byteOffset, bodyBytes.byteOffset + bodyBytes.byteLength),
  });
}

describe('GET /api/documents/[id]/image-proxy', () => {
  const DOC_ID = 'doc-1';
  const SUB_ID = 'sub-1';
  const OWNER = 'user-owner';
  const OTHER = 'user-other';
  const BASE_DOC_JPG = { id: DOC_ID, storage_path: 'user-owner/sub-1/doc-1.jpg', submission_id: SUB_ID, file_type: 'image/jpeg' };
  const BASE_DOC_PNG = { id: DOC_ID, storage_path: 'user-owner/sub-1/doc-1.png', submission_id: SUB_ID, file_type: 'image/png' };
  const BASE_DOC_PDF_PATH = { id: DOC_ID, storage_path: 'user-owner/sub-1/doc-1.pdf', submission_id: SUB_ID, file_type: 'application/pdf' };
  const BASE_DOC_PDF_TYPE = { id: DOC_ID, storage_path: 'user-owner/sub-1/doc-1.jpg', submission_id: SUB_ID, file_type: 'application/pdf' };
  const BASE_SUB_OWNER = { id: SUB_ID, user_id: OWNER };
  let originalFetch;
  beforeEach(() => { originalFetch = global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  it('401 when no session (no userId)', async () => {
    const admin = makeAdmin({ documents: [BASE_DOC_JPG], submissions: [BASE_SUB_OWNER] });
    global.fetch = mockFetch();
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: null }), supabaseAdmin: supabaseAdminMock(admin) };
    const GET = loadGetWithMocks(mocks);
    const res = await GET({}, makeCtx(DOC_ID));
    assert.equal(res.status, 401);
    assert.match(res._body.error, /No session/i);
  });

  it('401 when getClaims returns error', async () => {
    const admin = makeAdmin({ documents: [BASE_DOC_JPG], submissions: [BASE_SUB_OWNER] });
    global.fetch = mockFetch();
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER, error: { message: 'bad jwt' } }), supabaseAdmin: supabaseAdminMock(admin) };
    const GET = loadGetWithMocks(mocks);
    const res = await GET({}, makeCtx(DOC_ID));
    assert.equal(res.status, 401);
  });

  it('404 when document not found', async () => {
    const admin = makeAdmin({ documents: [], submissions: [BASE_SUB_OWNER] });
    global.fetch = mockFetch();
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin) };
    const GET = loadGetWithMocks(mocks);
    const res = await GET({}, makeCtx('nonexistent'));
    assert.equal(res.status, 404);
  });

  it('404 when another visitor tries to fetch (cross-owner)', async () => {
    const admin = makeAdmin({ documents: [BASE_DOC_JPG], submissions: [BASE_SUB_OWNER] });
    global.fetch = mockFetch();
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OTHER }), supabaseAdmin: supabaseAdminMock(admin) };
    const GET = loadGetWithMocks(mocks);
    const res = await GET({}, makeCtx(DOC_ID));
    assert.equal(res.status, 404);
    assert.match(res._body.error, /Not found/i);
  });

  it('400 when PDF via storage_path ends with .pdf', async () => {
    const admin = makeAdmin({ documents: [BASE_DOC_PDF_PATH], submissions: [BASE_SUB_OWNER] });
    global.fetch = mockFetch();
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin) };
    const GET = loadGetWithMocks(mocks);
    const res = await GET({}, makeCtx(DOC_ID));
    assert.equal(res.status, 400);
    assert.equal(res._body.error, "Plain OCR preview isn't available for PDFs.");
  });

  it('400 when PDF via file_type application/pdf even if path is jpg', async () => {
    const admin = makeAdmin({ documents: [BASE_DOC_PDF_TYPE], submissions: [BASE_SUB_OWNER] });
    global.fetch = mockFetch();
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin) };
    const GET = loadGetWithMocks(mocks);
    const res = await GET({}, makeCtx(DOC_ID));
    assert.equal(res.status, 400);
    assert.equal(res._body.error, "Plain OCR preview isn't available for PDFs.");
  });

  it('200 returns image bytes with correct Content-Type and Cache-Control for jpeg', async () => {
    const admin = makeAdmin({ documents: [BASE_DOC_JPG], submissions: [BASE_SUB_OWNER] });
    const bodyBytes = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
    global.fetch = mockFetch({ ok: true, contentType: 'image/jpeg', bodyBytes });
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin) };
    const GET = loadGetWithMocks(mocks);
    const res = await GET({}, makeCtx(DOC_ID));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Content-Type'), 'image/jpeg');
    assert.equal(res.headers.get('Cache-Control'), 'private, max-age=60');
    const buf = await res.arrayBuffer();
    assert.ok(buf.byteLength > 0);
  });

  it('200 returns image bytes with correct Content-Type for png inferred from path when file_type missing', async () => {
    const docNoType = { id: DOC_ID, storage_path: 'user-owner/sub-1/doc-1.png', submission_id: SUB_ID, file_type: null };
    const admin = makeAdmin({ documents: [docNoType], submissions: [BASE_SUB_OWNER] });
    const bodyBytes = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
    global.fetch = mockFetch({ ok: true, contentType: 'application/octet-stream', bodyBytes });
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin) };
    const GET = loadGetWithMocks(mocks);
    const res = await GET({}, makeCtx(DOC_ID));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Content-Type'), 'image/png');
    assert.equal(res.headers.get('Cache-Control'), 'private, max-age=60');
  });

  it('200 works with ctx.params as Promise (Next 15+)', async () => {
    const admin = makeAdmin({ documents: [BASE_DOC_PNG], submissions: [BASE_SUB_OWNER] });
    global.fetch = mockFetch({ ok: true, contentType: 'image/png', bodyBytes: Buffer.from([1,2,3]) });
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin) };
    const GET = loadGetWithMocks(mocks);
    const res = await GET({}, makeCtxPromise(DOC_ID));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Content-Type'), 'image/png');
  });

  it('400 PDF check is case-insensitive for .PDF extension', async () => {
    const docUpperPdf = { id: DOC_ID, storage_path: 'user-owner/sub-1/doc-1.PDF', submission_id: SUB_ID, file_type: 'application/pdf' };
    const admin = makeAdmin({ documents: [docUpperPdf], submissions: [BASE_SUB_OWNER] });
    global.fetch = mockFetch();
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin) };
    const GET = loadGetWithMocks(mocks);
    const res = await GET({}, makeCtx(DOC_ID));
    assert.equal(res.status, 400);
  });

  it('500 when signedUrl creation fails', async () => {
    const admin = makeAdmin({ documents: [BASE_DOC_JPG], submissions: [BASE_SUB_OWNER], signedError: { message: 'storage error' } });
    global.fetch = mockFetch();
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin) };
    const GET = loadGetWithMocks(mocks);
    const res = await GET({}, makeCtx(DOC_ID));
    assert.equal(res.status, 500);
    assert.match(res._body.error, /Could not load image/i);
  });

  it('500 when fetch fails or returns not ok', async () => {
    const admin = makeAdmin({ documents: [BASE_DOC_JPG], submissions: [BASE_SUB_OWNER] });
    global.fetch = async () => ({ ok: false, status: 500, headers: { get: () => null }, arrayBuffer: async () => Buffer.from([]).buffer });
    const mocks = { nextServer: nextServerMock(), supabaseServer: supabaseServerMock({ userId: OWNER }), supabaseAdmin: supabaseAdminMock(admin) };
    const GET = loadGetWithMocks(mocks);
    const res = await GET({}, makeCtx(DOC_ID));
    assert.equal(res.status, 500);
  });
});
