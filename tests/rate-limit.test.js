// tests/rate-limit.test.js — Step 9C Act 2
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
process.env.RATE_LIMIT_SALT = process.env.RATE_LIMIT_SALT || 'test-salt-123';
function loadRateLimit() {
  const srcPath = path.join(__dirname, '..', 'lib', 'rate-limit.js');
  let src = fs.readFileSync(srcPath, 'utf8');
  src = src.replace(/import\s+[\"']server-only[\"'];\s*\n/, '');
  src = src.replace(/import\s+\{\s*createHash\s*\}\s+from\s+[\"']node:crypto[\"'];\s*\n/, 'const { createHash } = require("node:crypto");\n');
  // Convert exported consts to local consts + exports
  // Keep alias lines as local consts first
  src = src.replace(/export\s+const\s+UPLOADS_PER_VISITOR_PER_HOUR\s*=\s*10;/, 'const UPLOADS_PER_VISITOR_PER_HOUR = 10; module.exports.UPLOADS_PER_VISITOR_PER_HOUR = UPLOADS_PER_VISITOR_PER_HOUR;');
  src = src.replace(/export\s+const\s+READS_GLOBAL_PER_DAY\s*=\s*200;/, 'const READS_GLOBAL_PER_DAY = 200; module.exports.READS_GLOBAL_PER_DAY = READS_GLOBAL_PER_DAY;');
  src = src.replace(/export\s+const\s+SESSIONS_PER_IP_PER_HOUR\s*=\s*10;/, 'const SESSIONS_PER_IP_PER_HOUR = 10; module.exports.SESSIONS_PER_IP_PER_HOUR = SESSIONS_PER_IP_PER_HOUR;');
  src = src.replace(/export\s+const\s+SESSIONS_PER_IP\s*=\s*SESSIONS_PER_IP_PER_HOUR;/, 'const SESSIONS_PER_IP = SESSIONS_PER_IP_PER_HOUR; module.exports.SESSIONS_PER_IP = SESSIONS_PER_IP; module.exports.SESSIONS_PER_IP_PER_HOUR = SESSIONS_PER_IP_PER_HOUR;');
  src = src.replace(/export\s+const\s+UPLOADS_PER_IP_PER_HOUR\s*=\s*60;/, 'const UPLOADS_PER_IP_PER_HOUR = 60; module.exports.UPLOADS_PER_IP_PER_HOUR = UPLOADS_PER_IP_PER_HOUR;');
  src = src.replace(/export\s+const\s+UPLOADS_PER_IP\s*=\s*UPLOADS_PER_IP_PER_HOUR;/, 'const UPLOADS_PER_IP = UPLOADS_PER_IP_PER_HOUR; module.exports.UPLOADS_PER_IP = UPLOADS_PER_IP; module.exports.UPLOADS_PER_IP_PER_HOUR = UPLOADS_PER_IP_PER_HOUR;');
  src = src.replace(/export\s+const\s+RETRIES_PER_SLOT_PER_HOUR\s*=\s*10;/, 'const RETRIES_PER_SLOT_PER_HOUR = 10; module.exports.RETRIES_PER_SLOT_PER_HOUR = RETRIES_PER_SLOT_PER_HOUR;');
  src = src.replace(/export\s+const\s+RETRIES_PER_SLOT\s*=\s*RETRIES_PER_SLOT_PER_HOUR;/, 'const RETRIES_PER_SLOT = RETRIES_PER_SLOT_PER_HOUR; module.exports.RETRIES_PER_SLOT = RETRIES_PER_SLOT; module.exports.RETRIES_PER_SLOT_PER_HOUR = RETRIES_PER_SLOT_PER_HOUR;');
  src = src.replace(/export\s+const\s+ANSWERS_PER_VISITOR_PER_HOUR\s*=\s*20;/, 'const ANSWERS_PER_VISITOR_PER_HOUR = 20; module.exports.ANSWERS_PER_VISITOR_PER_HOUR = ANSWERS_PER_VISITOR_PER_HOUR;');
  src = src.replace(/export\s+const\s+ANSWERS_PER_VISITOR\s*=\s*ANSWERS_PER_VISITOR_PER_HOUR;/, 'const ANSWERS_PER_VISITOR = ANSWERS_PER_VISITOR_PER_HOUR; module.exports.ANSWERS_PER_VISITOR = ANSWERS_PER_VISITOR; module.exports.ANSWERS_PER_VISITOR_PER_HOUR = ANSWERS_PER_VISITOR_PER_HOUR;');
  // exported functions: keep as plain functions and export after
  src = src.replace(/export\s+function\s+(\w+)/g, 'function $1');
  src = src.replace(/export\s+async\s+function\s+(\w+)/g, 'async function $1');
  // handle export const alias for check functions
  src = src.replace(/export\s+const\s+checkSubmissionIpLimit\s*=\s*checkUploadIpLimit;/, 'const checkSubmissionIpLimit = checkUploadIpLimit; module.exports.checkSubmissionIpLimit = checkSubmissionIpLimit;');
  src = src.replace(/export\s+const\s+checkClarifyAnswerPerVisitorLimit\s*=\s*checkClarifyAnswerLimit;/, 'const checkClarifyAnswerPerVisitorLimit = checkClarifyAnswerLimit; module.exports.checkClarifyAnswerPerVisitorLimit = checkClarifyAnswerPerVisitorLimit;');
  // after defining functions, export them
  src += '\nmodule.exports.getClientIp = getClientIp; module.exports.hashIp = hashIp; module.exports.secondsToNextHour = secondsToNextHour; module.exports.checkUploadLimit = checkUploadLimit; module.exports.checkGlobalReadLimit = checkGlobalReadLimit; module.exports.checkSessionIpLimit = checkSessionIpLimit; module.exports.checkUploadIpLimit = checkUploadIpLimit; module.exports.checkRetryPerSlot = checkRetryPerSlot; module.exports.checkClarifyAnswerLimit = checkClarifyAnswerLimit; module.exports.UPLOADS_PER_VISITOR_PER_HOUR = UPLOADS_PER_VISITOR_PER_HOUR; module.exports.READS_GLOBAL_PER_DAY = READS_GLOBAL_PER_DAY;';
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', 'require', 'process', 'console', src);
  fn(mod, mod.exports, require, process, console);
  return mod.exports;
}
const rl = loadRateLimit();
function makeCountingAdmin() {
  const calls = [];
  const store = new Map();
  return { calls, store, rpc: async (fn, args) => { if (fn !== 'increment_usage') return { data: 1, error: null }; const key = args.p_key; calls.push({ key, windowStart: args.p_window_start, fn }); const prev = store.get(key) || 0; const next = prev + 1; store.set(key, next); return { data: next, error: null }; } };
}
function makeHeadersMock(value) { return { get: (name) => name.toLowerCase() === 'x-forwarded-for' ? value : null }; }
function makeRequestMock(xff) { return { headers: makeHeadersMock(xff) }; }
describe('lib/rate-limit helpers', () => {
  it('getClientIp first value', () => {
    assert.equal(rl.getClientIp(makeRequestMock('1.2.3.4, 5.6.7.8')), '1.2.3.4');
    assert.equal(rl.getClientIp(makeRequestMock('  9.9.9.9  , 1.1.1.1')), '9.9.9.9');
    assert.equal(rl.getClientIp(makeRequestMock('2001:db8::1')), '2001:db8::1');
  });
  it('getClientIp plain object', () => {
    assert.equal(rl.getClientIp({ headers: { 'x-forwarded-for': '8.8.8.8' } }), '8.8.8.8');
    assert.equal(rl.getClientIp({ headers: { 'X-Forwarded-For': '1.1.1.1, 2.2.2.2' } }), '1.1.1.1');
  });
  it('getClientIp unknown', () => {
    assert.equal(rl.getClientIp({ headers: makeHeadersMock(null) }), 'unknown');
    assert.equal(rl.getClientIp({ headers: makeHeadersMock('') }), 'unknown');
    assert.equal(rl.getClientIp(null), 'unknown');
  });
  it('hashIp hex and no raw', () => {
    const ip = '203.0.113.42'; const h = rl.hashIp(ip);
    assert.equal(h.length, 64); assert.ok(/^[0-9a-f]{64}$/.test(h)); assert.equal(h.includes(ip), false);
    assert.notEqual(h, rl.hashIp('203.0.113.43'));
  });
  it('hashIp warn once without salt', () => {
    const prev = process.env.RATE_LIMIT_SALT;
    process.env.RATE_LIMIT_SALT = '';
    const fresh = loadRateLimit(); let warned = false; const orig = console.warn; console.warn = () => { warned = true; };
    const h = fresh.hashIp('1.2.3.4'); assert.equal(h.length, 64); assert.equal(warned, true);
    warned = false; fresh.hashIp('1.2.3.5'); assert.equal(warned, false); console.warn = orig;
    process.env.RATE_LIMIT_SALT = 'salt-a'; const ha = loadRateLimit().hashIp('1.2.3.4');
    process.env.RATE_LIMIT_SALT = 'salt-b'; const hb = loadRateLimit().hashIp('1.2.3.4');
    assert.notEqual(ha, hb); process.env.RATE_LIMIT_SALT = prev || 'test-salt-123';
  });
  it('secondsToNextHour', () => {
    assert.equal(rl.secondsToNextHour(new Date('2025-01-01T10:15:30.000Z')), 2670);
    assert.equal(rl.secondsToNextHour(new Date('2025-01-01T10:00:00.000Z')), 3600);
    assert.equal(rl.secondsToNextHour(new Date('2025-01-01T10:59:59.000Z')), 1);
  });
  it('constants', () => {
    assert.equal(rl.SESSIONS_PER_IP, 10); assert.equal(rl.SESSIONS_PER_IP_PER_HOUR, 10);
    assert.equal(rl.UPLOADS_PER_IP, 60); assert.equal(rl.UPLOADS_PER_IP_PER_HOUR, 60);
    assert.equal(rl.RETRIES_PER_SLOT, 10); assert.equal(rl.RETRIES_PER_SLOT_PER_HOUR, 10);
    assert.equal(rl.ANSWERS_PER_VISITOR, 20); assert.equal(rl.ANSWERS_PER_VISITOR_PER_HOUR, 20);
    assert.equal(rl.UPLOADS_PER_VISITOR_PER_HOUR, 10); assert.equal(rl.READS_GLOBAL_PER_DAY, 200);
  });
  it('.env.example RATE_LIMIT_SALT', () => {
    const env = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8');
    assert.ok(env.includes('RATE_LIMIT_SALT=')); const line = env.split('\n').find(l=>l.startsWith('RATE_LIMIT_SALT')); assert.equal(line.trim(), 'RATE_LIMIT_SALT=');
  });
});
describe('limits via fake admin', () => {
  it('session 10/hour', async () => {
    const admin = makeCountingAdmin(); const ip='198.51.100.1';
    for(let i=1;i<=10;i++){ const r=await rl.checkSessionIpLimit(admin, ip); assert.equal(r.allowed,true); assert.equal(r.count,i); }
    const b=await rl.checkSessionIpLimit(admin, ip); assert.equal(b.allowed,false); assert.equal(b.count,11);
    for(const c of admin.calls){ assert.equal(c.key.includes(ip),false); assert.ok(c.key.includes('session:ip:')); const h=rl.hashIp(ip); assert.ok(c.key.includes(h)); }
  });
  it('upload 60/hour per IP', async () => {
    const admin=makeCountingAdmin(); const ip='203.0.113.10';
    for(let i=1;i<=60;i++){ const r=await rl.checkUploadIpLimit(admin, ip); assert.equal(r.allowed,true); }
    const b=await rl.checkUploadIpLimit(admin, ip); assert.equal(b.allowed,false); assert.equal(b.count,61);
    for(const c of admin.calls){ assert.equal(c.key.includes(ip),false); assert.ok(c.key.includes('upload:ip:')); }
  });
  it('submissions same IP limit 60/hour', async () => {
    const admin=makeCountingAdmin(); const ip='203.0.113.20'; const fn=rl.checkSubmissionIpLimit||rl.checkUploadIpLimit;
    for(let i=1;i<=60;i++){ const r=await fn(admin, ip); assert.equal(r.allowed,true); }
    const b=await fn(admin, ip); assert.equal(b.allowed,false); assert.equal(b.count,61);
  });
  it('slot 10/hour', async () => {
    const admin=makeCountingAdmin(); const sid='sub-abc-123'; const dt='birth_certificate';
    for(let i=1;i<=10;i++){ const r=await rl.checkRetryPerSlot(admin, sid, dt); assert.equal(r.allowed,true); assert.equal(r.count,i); }
    const b=await rl.checkRetryPerSlot(admin, sid, dt); assert.equal(b.allowed,false); assert.equal(b.count,11);
    for(const c of admin.calls){ assert.ok(c.key.includes(sid)); assert.ok(c.key.includes(dt)); assert.ok(c.key.startsWith('retry:')); }
    const admin2=makeCountingAdmin(); const other=await rl.checkRetryPerSlot(admin2, sid, 'valid_id'); assert.equal(other.allowed,true);
  });
  it('clarify 20/hour', async () => {
    const admin=makeCountingAdmin(); const uid='user-xyz-789';
    for(let i=1;i<=20;i++){ const r=await rl.checkClarifyAnswerLimit(admin, uid); assert.equal(r.allowed,true); }
    const b=await rl.checkClarifyAnswerLimit(admin, uid); assert.equal(b.allowed,false); assert.equal(b.count,21);
  });
  it('raw IPs never in keys', async () => {
    const admin=makeCountingAdmin(); const ip='10.20.30.40';
    await rl.checkSessionIpLimit(admin, ip); await rl.checkUploadIpLimit(admin, ip);
    const ipH=rl.getClientIp(makeRequestMock('10.20.30.40, 1.1.1.1')); await rl.checkSessionIpLimit(admin, ipH);
    for(const c of admin.calls){ assert.equal(c.key.includes(ip),false); }
    const h=rl.hashIp(ip); assert.ok(admin.calls.some(c=>c.key.includes(h)));
  });
  it('secondsToNextHour 1..3600', () => { for(let i=0;i<5;i++){ const s=rl.secondsToNextHour(new Date()); assert.ok(s>=1&&s<=3600); } });
});
describe('route static guards', () => {
  const routes=[ {p:'app/api/session/route.js', must:['checkSessionIpLimit','Retry-After','Cache-Control','no-store','getClientIp','secondsToNextHour']}, {p:'app/api/upload/route.js', must:['checkUploadIpLimit','checkRetryPerSlot','Retry-After','Cache-Control','no-store']}, {p:'app/api/submissions/route.js', must:['checkUploadIpLimit','Retry-After','Cache-Control','no-store']}, {p:'app/api/clarifications/[id]/route.js', must:['checkClarifyAnswerLimit','Retry-After','Cache-Control','no-store']} ];
  for(const {p,must} of routes){ it(`${p} has logic`,()=>{ const t=fs.readFileSync(path.join(__dirname,'..',p),'utf8'); for(const n of must) assert.ok(t.includes(n), `${p} missing ${n}`); assert.ok(t.includes('429')); assert.ok(/Too many/i.test(t)); }); }
  it('lib helpers present',()=>{ const t=fs.readFileSync(path.join(__dirname,'..','lib/rate-limit.js'),'utf8'); assert.ok(t.includes('function getClientIp')); assert.ok(t.includes('x-forwarded-for')); assert.ok(t.includes('function hashIp')); assert.ok(t.includes('sha256')); assert.ok(t.includes('RATE_LIMIT_SALT')); assert.ok(t.includes('function secondsToNextHour')); assert.ok(t.includes('increment_usage')); assert.ok(t.includes('hashIp(ip)')||t.includes('hashIp(')); });
  it('upload order', async () => {
    const t=fs.readFileSync(path.join(__dirname,'..','app/api/upload/route.js'),'utf8');
    const tryIdx = t.indexOf('try {');
    const a=t.indexOf('checkUploadLimit', tryIdx), b=t.indexOf('checkGlobalReadLimit', tryIdx), c=t.indexOf('checkUploadIpLimit', tryIdx), d=t.indexOf('checkRetryPerSlot', tryIdx);
    assert.ok(a>=0&&b>=0&&c>=0&&d>=0);
    assert.ok(c < d, 'IP (60/hr) before slot (10/hr)');
    assert.ok(d < a, 'slot before visitor (10/hr)');
    assert.ok(a < b, 'visitor before global daily cap');
    assert.ok(c < b && d < b, 'global must be last');
    async function checkBlockedDoesNotCallGlobal({ ipBlocked, slotBlocked }) {
      let src=fs.readFileSync(path.join(__dirname,'..','app/api/upload/route.js'),'utf8');
      src=src.replace(/import\s+['\"]server-only['\"];\s*\n/, '');
      src=src.replace(/import\s+\{\s*NextResponse\s*\}\s+from\s+['\"]next\/server['\"];\s*\n/, 'const { NextResponse } = __mocks.nextServer;\n');
      src=src.replace(/import\s+\{\s*after\s*\}\s+from\s+['\"]next\/server['\"];\s*\n/, 'const { after } = __mocks.nextServer;\n');
      src=src.replace(/import\s+\{\s*createHash,\s*randomUUID\s*\}\s+from\s+['\"]node:crypto['\"];\s*\n/, 'const { createHash, randomUUID } = __mocks.crypto;\n');
      src=src.replace(/import\s+\{\s*createClient\s*\}\s+from\s+['\"]@\/lib\/supabase\/server['\"];\s*\n/, 'const { createClient } = __mocks.supabaseServer;\n');
      src=src.replace(/import\s+\{\s*createAdminClient\s*\}\s+from\s+['\"]@\/lib\/supabase\/admin['\"];\s*\n/, 'const { createAdminClient } = __mocks.supabaseAdmin;\n');
      src=src.replace(/import\s+\{[^}]*\}\s+from\s+['\"]@\/lib\/rate-limit['\"];\s*\n/, (m)=>{ const inner=m.match(/\{([^}]*)\}/)[1]; let o=''; for(const n of inner.split(',').map(s=>s.trim()).filter(Boolean)){ const c=n.split(' as ')[0].trim(); o+=`const ${c} = __mocks.rateLimit.${c};\n`; } return o; });
      src=src.replace(/import\s+\{\s*runReading\s*\}\s+from\s+['\"]@\/lib\/read-background['\"];\s*\n/, 'const { runReading } = __mocks.readBg;\n');
      src=src.replace(/import\s+\{\s*createRequire\s*\}\s+from\s+['\"]node:module['\"];\s*\n/, '');
      src=src.replace(/const\s+require\s+=\s+createRequire\(import\.meta\.url\);\s*\n/, '');
      src=src.replace(/const\s+\{\s*sniffFileType\s*\}\s+=\s+require\(.*?;\s*\n/, 'const { sniffFileType } = __mocks.fileType;\n');
      src=src.replace(/const\s+\{\s*resolveProcess,\s*resolveDocumentType\s*\}\s+=\s+require\(.*?;\s*\n/, 'const { resolveProcess, resolveDocumentType } = __mocks.processes;\n');
      src=src.replace(/export\s+const\s+maxDuration\s*=\s*60;/, 'const maxDuration = 60;');
      src=src.replace(/export\s+async\s+function\s+POST/g, '__exports.POST = async function POST');
      const calls=[];
      const rateLimitMocks={
        getClientIp: rl.getClientIp,
        checkUploadIpLimit: async()=>{ calls.push('ip'); return ipBlocked ? { allowed:false, count:61 } : { allowed:true, count:1 }; },
        checkRetryPerSlot: async()=>{ calls.push('slot'); return slotBlocked ? { allowed:false, count:11 } : { allowed:true, count:1 }; },
        checkUploadLimit: async()=>{ calls.push('visitor'); return { allowed:true, count:1 }; },
        checkGlobalReadLimit: async()=>{ calls.push('global'); return { allowed:true, count:1 }; },
        secondsToNextHour: rl.secondsToNextHour
      };
      const fakeAdmin={
        from:(table)=>{
          const chain={
            select:()=>chain,
            eq:(col,val)=>{
              if(table==='submissions'&&col==='id') return { maybeSingle: async()=>({ data:{ id:'sub-1', user_id:'user-1', status:'draft', process_id:'proc-1' }, error:null }) };
              return chain;
            },
            order:()=>chain,
            limit: async()=>({ data:[], error:null }),
            insert: async()=>({ error:null }),
            maybeSingle: async()=>({ data:null, error:null })
          };
          return chain;
        },
        storage:{ from:()=>({ upload: async()=>({ error:null }), remove: async()=>({}) }) },
        rpc: async()=>({ data:1, error:null })
      };
      const __mocks={
        nextServer:{
          NextResponse:{ json:(body,init={})=>{ const status=init.status||200; const headers=init.headers||{}; const map=new Map(); for(const[k,v] of Object.entries(headers)){ map.set(k,String(v)); map.set(k.toLowerCase(),String(v)); } return { status,_body:body, headers:{ get:(k)=>map.get(k)??map.get(k.toLowerCase())??null } } } },
          after:(fn)=>{}
        },
        crypto:{ createHash:()=>({ update:()=>({ digest:()=>'abc' }) }), randomUUID:()=>'uuid-1' },
        supabaseServer:{ createClient: async()=>({ auth:{ getClaims: async()=>({ data:{ claims:{ sub:'user-1' }}, error:null }) } }) },
        supabaseAdmin:{ createAdminClient: ()=>fakeAdmin },
        rateLimit: rateLimitMocks,
        readBg:{ runReading: async()=>{} },
        fileType:{ sniffFileType: ()=>({ ext:'jpg', mime:'image/jpeg' }) },
        processes:{ resolveProcess: async()=>({ def:{ documents:['birth_certificate'], requirement:null } }), resolveDocumentType: ()=>({ label:'Test Doc' }) }
      };
      const __exports={};
      const fn=new Function('__mocks','__exports','rl', src+'\nreturn __exports;');
      const mod=fn(__mocks,__exports,rl);
      const mockFile={ arrayBuffer: async()=> new Uint8Array([0xFF,0xD8,0xFF,0xE0,0,0,0,0]).buffer, size:1000 };
      const mockRequest={ headers:{ get:(n)=> n.toLowerCase()==='x-forwarded-for' ? '1.2.3.4' : null }, formData: async()=>({ get:(k)=> k==='submission_id' ? 'sub-1' : k==='doc_type' ? 'birth_certificate' : k==='file' ? mockFile : null }) };
      const res=await mod.POST(mockRequest);
      assert.equal(res.status,429);
      assert.equal(calls.includes('global'), false, 'global counter must NOT be called when blocked by IP/slot');
    }
    await checkBlockedDoesNotCallGlobal({ ipBlocked:true, slotBlocked:false });
    await checkBlockedDoesNotCallGlobal({ ipBlocked:false, slotBlocked:true });
  });
});
describe('fake 429 integration session', () => {
  function nextMock(){ return { NextResponse:{ json:(body,init={})=>{ const status=init.status||200; const headers=init.headers||{}; const map=new Map(); for(const[k,v] of Object.entries(headers)){ map.set(k,String(v)); map.set(k.toLowerCase(),String(v)); } return { status,_body:body, headers:{ get:(k)=>map.get(k)??map.get(k.toLowerCase())??null } } } } }; }
  it('session 429 blocked', async () => {
    const p=path.join(__dirname,'..','app/api/session/route.js'); let src=fs.readFileSync(p,'utf8');
    src=src.replace(/import\s+[\"']server-only[\"'];\s*\n/,''); src=src.replace(/import\s+\{\s*NextResponse\s*\}\s+from\s+[\"']next\/server[\"'];\s*\n/,'const { NextResponse } = __mocks.nextServer;\n'); src=src.replace(/import\s+\{\s*createClient\s*\}\s+from\s+[\"']@\/lib\/supabase\/server[\"'];\s*\n/,'const { createClient } = __mocks.supabaseServer;\n'); src=src.replace(/import\s+\{\s*createAdminClient\s*\}\s+from\s+[\"']@\/lib\/supabase\/admin[\"'];\s*\n/,'const { createAdminClient } = __mocks.supabaseAdmin;\n'); src=src.replace(/import\s+\{[^}]*\}\s+from\s+[\"']@\/lib\/rate-limit[\"'];\s*\n/g, (m)=>{ const inner=m.match(/\{([^}]*)\}/)[1]; let o=''; for(const n of inner.split(',').map(s=>s.trim()).filter(Boolean)){ const c=n.split(' as ')[0].trim(); o+=`const ${c} = __mocks.rateLimit.${c};\n`; } return o; }); src=src.replace(/export\s+async\s+function\s+(\w+)/g,'__exports.$1 = async function $1');
    const __mocks={ nextServer:nextMock(), supabaseServer:{ createClient: async()=>({ auth:{ getClaims: async()=>({data:{claims:{}},error:null}), signInAnonymously: async()=>({data:{user:{id:'new-user'}},error:null}) } }) }, supabaseAdmin:{ createAdminClient: ()=>({ rpc: async()=>({data:11,error:null}) }) }, rateLimit:{ getClientIp: rl.getClientIp, checkSessionIpLimit: async(admin,ip)=>{ const {data}=await admin.rpc('increment_usage',{p_key:'k',p_window_start:new Date().toISOString()}); return {allowed:data<=10,count:data}; }, secondsToNextHour: rl.secondsToNextHour } };
    const __exports={}; const fn=new Function('__mocks','__exports',src+'\nreturn __exports;'); const mod=fn(__mocks,__exports); const res=await mod.POST({ headers:{ get:()=>'1.2.3.4' } });
    assert.equal(res.status,429); assert.ok(res.headers.get('Retry-After')); assert.equal(res.headers.get('Cache-Control'),'no-store'); assert.ok(/Too many/i.test(res._body.error));
  });
  it('session allowed', async () => {
    const p=path.join(__dirname,'..','app/api/session/route.js'); let src=fs.readFileSync(p,'utf8');
    src=src.replace(/import\s+[\"']server-only[\"'];\s*\n/,''); src=src.replace(/import\s+\{\s*NextResponse\s*\}\s+from\s+[\"']next\/server[\"'];\s*\n/,'const { NextResponse } = __mocks.nextServer;\n'); src=src.replace(/import\s+\{\s*createClient\s*\}\s+from\s+[\"']@\/lib\/supabase\/server[\"'];\s*\n/,'const { createClient } = __mocks.supabaseServer;\n'); src=src.replace(/import\s+\{\s*createAdminClient\s*\}\s+from\s+[\"']@\/lib\/supabase\/admin[\"'];\s*\n/,'const { createAdminClient } = __mocks.supabaseAdmin;\n'); src=src.replace(/import\s+\{[^}]*\}\s+from\s+[\"']@\/lib\/rate-limit[\"'];\s*\n/g, (m)=>{ const inner=m.match(/\{([^}]*)\}/)[1]; let o=''; for(const n of inner.split(',').map(s=>s.trim()).filter(Boolean)){ const c=n.split(' as ')[0].trim(); o+=`const ${c} = __mocks.rateLimit.${c};\n`; } return o; }); src=src.replace(/export\s+async\s+function\s+(\w+)/g,'__exports.$1 = async function $1');
    const __mocks={ nextServer:nextMock(), supabaseServer:{ createClient: async()=>({ auth:{ getClaims: async()=>({data:{claims:{}},error:null}), signInAnonymously: async()=>({data:{user:{id:'new-user'}},error:null}) } }) }, supabaseAdmin:{ createAdminClient: ()=>({ rpc: async()=>({data:5,error:null}) }) }, rateLimit:{ getClientIp: rl.getClientIp, checkSessionIpLimit: async(admin,ip)=>{ const {data}=await admin.rpc('increment_usage',{p_key:'k',p_window_start:new Date().toISOString()}); return {allowed:data<=10,count:data}; }, secondsToNextHour: rl.secondsToNextHour } };
    const __exports={}; const fn=new Function('__mocks','__exports',src+'\nreturn __exports;'); const mod=fn(__mocks,__exports); const res=await mod.POST({ headers:{ get:()=>'5.6.7.8' } });
    assert.equal(res.status,200); assert.equal(res._body.user_id,'new-user');
  });
});
describe('fake 429 clarifications', () => {
  function nextMock(){ return { NextResponse:{ json:(body,init={})=>{ const status=init.status||200; const headers=init.headers||{}; const map=new Map(); for(const[k,v] of Object.entries(headers)){ map.set(k,String(v)); map.set(k.toLowerCase(),String(v)); } return { status,_body:body, headers:{ get:(k)=>map.get(k)??map.get(k.toLowerCase())??null } } } } }; }
  it('clarify 429', async () => {
    const p=path.join(__dirname,'..','app/api/clarifications/[id]/route.js'); let src=fs.readFileSync(p,'utf8');
    src=src.replace(/import\s+[\"']server-only[\"'];\s*\n/,''); src=src.replace(/import\s+\{\s*NextResponse\s*\}\s+from\s+[\"']next\/server[\"'];\s*\n/,'const { NextResponse } = __mocks.nextServer;\n'); src=src.replace(/import\s+\{\s*createClient\s*\}\s+from\s+[\"']@\/lib\/supabase\/server[\"'];\s*\n/,'const { createClient } = __mocks.supabaseServer;\n'); src=src.replace(/import\s+\{\s*createAdminClient\s*\}\s+from\s+[\"']@\/lib\/supabase\/admin[\"'];\s*\n/,'const { createAdminClient } = __mocks.supabaseAdmin;\n'); src=src.replace(/const\s+\{\s*checkClarifyAnswerLimit,\s*secondsToNextHour\s*\}\s+=\s+await\s+import\(.*?;\s*\n/,'const { checkClarifyAnswerLimit, secondsToNextHour } = __mocks.rateLimit;\n'); src=src.replace(/import\s+\{\s*createRequire\s*\}\s+from\s+[\"']node:module[\"'];\s*\n/,''); src=src.replace(/const\s+require\s+=\s+createRequire\(import\.meta\.url\);\s*\n/,''); src=src.replace(/const\s+\{\s*validateAnswer\s*\}\s+=\s+require\(.*?;\s*\n/,'const { validateAnswer } = __mocks.clarify;\n'); src=src.replace(/export\s+async\s+function\s+PATCH/g,'__exports.PATCH = async function PATCH');
    const fakeAdmin={ from:(table)=>{ const chain={ select:()=>chain, eq:(col,val)=>{ if(table==='clarifications'&&col==='id') return { maybeSingle: async()=>({ data:{ id:'clar-1', submission_id:'sub-1', field_key:'full_name', question:'Q?', answer:null }, error:null }) }; if(table==='submissions'&&col==='id') return { maybeSingle: async()=>({ data:{ user_id:'user-1' }, error:null }) }; return chain; }, update:()=>({ eq:()=>Promise.resolve({error:null}) }), insert:()=>Promise.resolve({error:null}), maybeSingle: async()=>({data:null,error:null}) }; return chain; }, rpc: async()=>({data:21,error:null}) };
    const __mocks={ nextServer:nextMock(), supabaseServer:{ createClient: async()=>({ auth:{ getClaims: async()=>({data:{claims:{sub:'user-1'}},error:null}) } }) }, supabaseAdmin:{ createAdminClient: ()=>fakeAdmin }, rateLimit:{ checkClarifyAnswerLimit: async(admin,uid)=>{ const {data}=await admin.rpc('increment_usage',{p_key:'k',p_window_start:new Date().toISOString()}); return {allowed:data<=20,count:data}; }, secondsToNextHour: rl.secondsToNextHour }, clarify:{ validateAnswer: require('../lib/clarify').validateAnswer } };
    const __exports={}; const fn=new Function('__mocks','__exports',src+'\nreturn __exports;'); const mod=fn(__mocks,__exports); const res=await mod.PATCH({ json: async()=>({answer:'valid answer'}) }, { params:{ id:'clar-1' } });
    assert.equal(res.status,429); assert.ok(res.headers.get('Retry-After')); assert.equal(res.headers.get('Cache-Control'),'no-store');
  });
});
