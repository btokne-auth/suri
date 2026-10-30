// tests/csp.test.js — Step 9C Act 1 security headers
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildCsp, getSecurityHeaders, getSupabaseOrigin } = require('../lib/csp');

describe('lib/csp buildCsp', () => {
  const supabaseOrigin = 'https://xyzexample.supabase.co';
  const csp = buildCsp(supabaseOrigin);

  it('has no bare unsafe-eval but has wasm-unsafe-eval', () => {
    assert.ok(csp.includes("'wasm-unsafe-eval'"), 'CSP must contain wasm-unsafe-eval');
    const withoutWasm = csp.replace(/'wasm-unsafe-eval'/g, '');
    assert.equal(withoutWasm.includes('unsafe-eval'), false, 'CSP must not contain bare unsafe-eval');
  });

  it('has worker-src self blob:', () => {
    assert.ok(csp.includes("worker-src 'self' blob:"), 'CSP must contain worker-src self blob:');
  });

  it('has unsafe-inline', () => {
    assert.ok(csp.includes('unsafe-inline'), 'CSP must contain unsafe-inline');
  });

  it('contains frame-ancestors none', () => {
    assert.ok(csp.includes('frame-ancestors'), 'missing frame-ancestors');
    assert.ok(csp.includes("frame-ancestors 'none'"), 'frame-ancestors should be none');
  });

  it('img-src contains data: and blob:', () => {
    const directives = csp.split(';').map(function (s) { return s.trim(); });
    const img = directives.find(function (d) { return d.startsWith('img-src'); });
    assert.ok(img, 'img-src directive missing');
    assert.ok(img.includes('data:'), 'img-src must contain data:');
    assert.ok(img.includes('blob:'), 'img-src must contain blob:');
  });

  it('includes supabase origin and wildcard', () => {
    assert.ok(csp.includes(supabaseOrigin), 'CSP should include provided supabase origin');
    assert.ok(csp.includes('https://*.supabase.co'), 'CSP should include wildcard');
    const dirs = csp.split(';').map(function (s) { return s.trim(); });
    const connect = dirs.find(function (d) { return d.startsWith('connect-src'); });
    assert.ok(connect && connect.includes(supabaseOrigin), 'connect-src should contain origin');
    assert.ok(connect && connect.includes('https://*.supabase.co'), 'connect-src wildcard');
    const img = dirs.find(function (d) { return d.startsWith('img-src'); });
    assert.ok(img && img.includes(supabaseOrigin), 'img-src should contain origin');
  });

  it('contains other required directives', () => {
    assert.ok(csp.includes("default-src 'self'"));
    assert.ok(csp.includes("object-src 'none'"));
    assert.ok(csp.includes("base-uri 'self'"));
    assert.ok(csp.includes("form-action 'self'"));
    assert.ok(csp.includes('upgrade-insecure-requests'));
    assert.ok(csp.includes("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com"));
    assert.ok(csp.includes("font-src 'self' https://fonts.gstatic.com data:"));
    assert.ok(csp.includes("media-src 'self' blob:"));
    assert.ok(csp.includes("worker-src 'self' blob:"));
    assert.ok(csp.includes("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'"));
  });

  it('getSupabaseOrigin reads env correctly', () => {
    const prev = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://myproj.supabase.co/rest/v1';
    const origin = getSupabaseOrigin();
    assert.equal(origin, 'https://myproj.supabase.co');
    if (prev === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prev;
  });
});

describe('security headers prod-only', () => {
  it('CSP only in production', () => {
    const prod = getSecurityHeaders({ isProduction: true, supabaseOrigin: 'https://xyz.supabase.co' });
    const dev = getSecurityHeaders({ isProduction: false, supabaseOrigin: 'https://xyz.supabase.co' });
    const prodCsp = prod.find(function (h) { return h.key === 'Content-Security-Policy'; });
    const devCsp = dev.find(function (h) { return h.key === 'Content-Security-Policy'; });
    assert.ok(prodCsp, 'production headers should include CSP');
    assert.equal(devCsp, undefined, 'development headers should not include CSP');
    assert.ok(prodCsp.value.includes("frame-ancestors 'none'"));
    assert.ok(prodCsp.value.includes("'wasm-unsafe-eval'"));
    assert.equal(prodCsp.value.replace(/'wasm-unsafe-eval'/g, '').includes('unsafe-eval'), false);
    assert.ok(prodCsp.value.includes('unsafe-inline'));
  });

  it('always has other headers including camera self and COOP', () => {
    for (const isProd of [true, false]) {
      const headers = getSecurityHeaders({ isProduction: isProd, supabaseOrigin: '' });
      const map = {};
      headers.forEach(function (h) { map[h.key] = h.value; });
      assert.equal(map['X-Content-Type-Options'], 'nosniff');
      assert.equal(map['Referrer-Policy'], 'strict-origin-when-cross-origin');
      assert.equal(map['X-Frame-Options'], 'DENY');
      assert.equal(map['Permissions-Policy'], 'camera=(self)');
      assert.ok(map['Permissions-Policy'].includes('camera=(self)'));
      assert.equal(map['Cross-Origin-Opener-Policy'], 'same-origin');
    }
  });

  it('next.config.mjs guards allowedDevOrigins dev-only and CSP prod-only via buildCsp', () => {
    const cfgPath = path.join(__dirname, '..', 'next.config.mjs');
    const text = fs.readFileSync(cfgPath, 'utf8');
    assert.ok(text.includes('buildCsp'), 'next.config should use buildCsp helper');
    assert.ok(text.includes('production'), 'should check NODE_ENV for production CSP');
    assert.ok(text.includes('development'), 'should guard allowedDevOrigins to development');
    const hasSpreadGuard = text.includes('...(') && text.includes('allowedDevOrigins');
    assert.ok(hasSpreadGuard, 'allowedDevOrigins should be conditional spread');
    const textWithoutWasm = text.replace(/'wasm-unsafe-eval'/g, '');
    assert.equal(textWithoutWasm.includes('unsafe-eval'), false, 'next.config must not contain bare unsafe-eval');
    assert.ok(text.includes('X-Content-Type-Options'), 'should set nosniff');
    assert.ok(text.includes('Referrer-Policy'), 'should set Referrer-Policy');
    assert.ok(text.includes('X-Frame-Options'), 'should set X-Frame-Options');
    assert.ok(text.includes('Permissions-Policy'), 'should set Permissions-Policy');
    assert.ok(text.includes('Cross-Origin-Opener-Policy'), 'should set COOP');
  });

  it('dev routes deleted', () => {
    const apiTestSeed = path.join(__dirname, '..', 'app', 'api', 'test-seed');
    const testIsolation = path.join(__dirname, '..', 'app', 'test-isolation');
    const testUpload = path.join(__dirname, '..', 'app', 'test-upload');
    assert.equal(fs.existsSync(apiTestSeed), false, 'app/api/test-seed should be deleted');
    assert.equal(fs.existsSync(testIsolation), false, 'app/test-isolation should be deleted');
    assert.equal(fs.existsSync(testUpload), false, 'app/test-upload should be deleted');
  });
});
