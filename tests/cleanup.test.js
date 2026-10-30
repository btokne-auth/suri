// tests/cleanup.test.js — Step 9D auto-delete
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isAuthorized, parseDays, getCutoffISO, cleanupSubmissions, cleanupUsers, cleanupCounters, runCleanup, MAX_BATCH } = require('../lib/cleanup');
function makeFake(opts) {
  const submissions = (opts.submissions || []).slice();
  const documents = (opts.documents || []).slice();
  const users = (opts.users || []).slice();
  const savedProcesses = (opts.savedProcesses || []).slice();
  const usageCounters = (opts.usageCounters || []).slice();
  const calls = [];
  function queryBuilder(table) {
    let isDelete = false; let filters = []; let order = null; let limitVal = null;
    const qb = {
      select() { return qb; },
      delete() { isDelete = true; return qb; },
      lt(col, val) { filters.push({ op: 'lt', col, val }); return qb; },
      gt(col, val) { filters.push({ op: 'gt', col, val }); return qb; },
      eq(col, val) { filters.push({ op: 'eq', col, val }); return qb; },
      in(col, vals) { filters.push({ op: 'in', col, vals }); return qb; },
      order(col, o) { order = { col, asc: !o || o.ascending !== false }; return qb; },
      limit(n) { limitVal = n; return qb; },
      then(resolve, reject) {
        try {
          let result;
          if (table === 'submissions') {
            if (isDelete) {
              const inF = filters.find((f) => f.op === 'in' && f.col === 'id');
              const ids = inF ? inF.vals : [];
              calls.push('submissions.delete:' + ids.join(','));
              const before = submissions.length;
              for (let i = submissions.length - 1; i >= 0; i--) if (ids.includes(submissions[i].id)) submissions.splice(i, 1);
              result = { data: null, error: null, count: before - submissions.length };
            } else {
              let rows = submissions.slice();
              for (const f of filters) {
                if (f.op === 'lt') { const c = new Date(f.val).getTime(); rows = rows.filter((r) => new Date(r[f.col]).getTime() < c); }
                else if (f.op === 'gt') { const c = new Date(f.val).getTime(); rows = rows.filter((r) => new Date(r[f.col]).getTime() > c); }
                else if (f.op === 'eq') rows = rows.filter((r) => r[f.col] === f.val);
                else if (f.op === 'in') rows = rows.filter((r) => f.vals.includes(r[f.col]));
              }
              if (order) rows.sort((a,b)=>{const av=new Date(a[order.col]).getTime();const bv=new Date(b[order.col]).getTime();return order.asc?av-bv:bv-av;});
              if (typeof limitVal==='number') rows=rows.slice(0,limitVal);
              result={data:rows,error:null};
            }
          } else if (table==='documents') {
            let rows=documents.slice();
            for(const f of filters){if(f.op==='in')rows=rows.filter(r=>f.vals.includes(r[f.col]));if(f.op==='eq')rows=rows.filter(r=>r[f.col]===f.val);}
            if(typeof limitVal==='number')rows=rows.slice(0,limitVal);
            result={data:rows,error:null};
          } else if (table==='saved_processes') {
            let rows=savedProcesses.slice();
            for(const f of filters){
              if(f.op==='eq')rows=rows.filter(r=>r[f.col]===f.val);
              if(f.op==='gt'){const c=new Date(f.val).getTime();rows=rows.filter(r=>new Date(r[f.col]).getTime()>c);}
              if(f.op==='lt'){const c=new Date(f.val).getTime();rows=rows.filter(r=>new Date(r[f.col]).getTime()<c);}
              if(f.op==='in')rows=rows.filter(r=>f.vals.includes(r[f.col]));
            }
            if(typeof limitVal==='number')rows=rows.slice(0,limitVal);
            result={data:rows,error:null};
          } else if (table==='usage_counters') {
            if(isDelete){
              const ltF=filters.find(f=>f.op==='lt'&&f.col==='window_start');
              let toDel=[];
              if(ltF){const c=new Date(ltF.val).getTime();toDel=usageCounters.filter(r=>new Date(r.window_start).getTime()<c);for(let i=usageCounters.length-1;i>=0;i--)if(new Date(usageCounters[i].window_start).getTime()<c)usageCounters.splice(i,1);}
              calls.push('counters.delete:'+toDel.length);
              result={data:null,error:null,count:toDel.length};
            } else {
              let rows=usageCounters.slice();
              for(const f of filters){if(f.op==='lt'){const c=new Date(f.val).getTime();rows=rows.filter(r=>new Date(r[f.col]).getTime()<c);}if(f.op==='eq')rows=rows.filter(r=>r[f.col]===f.val);if(f.op==='gt'){const c=new Date(f.val).getTime();rows=rows.filter(r=>new Date(r[f.col]).getTime()>c);}}
              if(typeof limitVal==='number')rows=rows.slice(0,limitVal);
              result={data:rows,error:null};
            }
          } else result={data:[],error:null};
          resolve(result);
        } catch(e){reject(e);}
      },
    }; return qb;
  }
  const admin={from(t){return queryBuilder(t);},storage:{from(){return{remove:async(p)=>{calls.push('storage.remove:'+p.join(','));return{data:{},error:null};}};}},auth:{admin:{listUsers:async({page,perPage})=>{const s=(page-1)*perPage;const sl=users.slice(s,s+perPage);return{data:{users:sl},error:null};},deleteUser:async(id)=>{calls.push('users.delete:'+id);const idx=users.findIndex(u=>u.id===id);if(idx!==-1)users.splice(idx,1);return{data:{},error:null};}}},_calls:calls,_submissions:submissions,_documents:documents,_users:users,_savedProcesses:savedProcesses,_usageCounters:usageCounters};
  return admin;
}
function daysAgo(n){return new Date(Date.now()-n*86400000).toISOString();}
describe('cleanup auth',()=>{it('401 without secret or wrong header',()=>{assert.equal(isAuthorized('', 's3cr3t'),false);assert.equal(isAuthorized(null,'s3cr3t'),false);assert.equal(isAuthorized('Bearer wrong','s3cr3t'),false);assert.equal(isAuthorized('Bearer s3cr3t','s3cr3t'),true);assert.equal(isAuthorized('Bearer s3cr3t',''),false);assert.equal(isAuthorized('Bearer s3cr3t',null),false);});});
describe('parseDays',()=>{it('dry-run honors days, non-dry always 7',()=>{assert.equal(parseDays(new URLSearchParams('days=0'),true),0);assert.equal(parseDays(new URLSearchParams('days=1'),true),1);assert.equal(parseDays(new URLSearchParams(''),true),7);assert.equal(parseDays(new URLSearchParams('days=0'),false),7);assert.equal(parseDays(new URLSearchParams('days=99'),false),7);assert.equal(parseDays(new URLSearchParams('days=365'),true),365);assert.throws(()=>parseDays(new URLSearchParams('days=366'),true));assert.throws(()=>parseDays(new URLSearchParams('days=-1'),true));assert.throws(()=>parseDays(new URLSearchParams('days=abc'),true));});});
describe('cleanupSubmissions',()=>{it('dry-run counts, live deletes storage before rows',async()=>{const cutoff=daysAgo(7);const old1={id:'sub-old-1',created_at:daysAgo(8),user_id:'u1'};const old2={id:'sub-old-2',created_at:daysAgo(9),user_id:'u2'};const recent={id:'sub-recent',created_at:daysAgo(1),user_id:'u3'};const doc1={submission_id:'sub-old-1',storage_path:'u1/sub-old-1/doc1.jpg'};const doc2={submission_id:'sub-old-2',storage_path:'u2/sub-old-2/doc2.jpg'};const docRecent={submission_id:'sub-recent',storage_path:'u3/sub-recent/doc3.jpg'};const fakeDry=makeFake({submissions:[old1,old2,recent],documents:[doc1,doc2,docRecent]});const dryRes=await cleanupSubmissions(fakeDry,cutoff,true);assert.equal(dryRes.submissionsFound,2);assert.equal(dryRes.documentsFound,2);assert.equal(dryRes.wouldDelete,2);assert.equal(dryRes.wouldRemove,2);assert.equal(dryRes.submissionsDeleted,0);assert.equal(fakeDry._calls.length,0);const fakeLive=makeFake({submissions:[old1,old2,recent],documents:[doc1,doc2,docRecent]});const liveRes=await cleanupSubmissions(fakeLive,cutoff,false);assert.equal(liveRes.submissionsFound,2);assert.equal(liveRes.documentsFound,2);assert.equal(liveRes.submissionsDeleted,2);assert.equal(liveRes.storageRemoved,2);assert.equal(fakeLive._calls[0].startsWith('storage.remove:'),true);assert.equal(fakeLive._calls[1].startsWith('submissions.delete:'),true);assert.equal(fakeLive._submissions.length,1);assert.equal(fakeLive._submissions[0].id,'sub-recent');});it('batch limit 200',()=>{assert.equal(MAX_BATCH,200);});it('only counts, no content',async()=>{const cutoff=daysAgo(7);const old={id:'s1',created_at:daysAgo(8),user_id:'u1'};const fake=makeFake({submissions:[old],documents:[{submission_id:'s1',storage_path:'u1/s1/d.jpg'}]});const res=await cleanupSubmissions(fake,cutoff,true);assert.equal(typeof res.submissionsFound,'number');assert.equal(res.wouldDelete,1);const json=JSON.stringify(res);assert.equal(json.includes('u1/s1/d.jpg'),false);});});
describe('cleanupUsers saved_process newer blocks delete',()=>{it('old user with no submissions and no recent saved_process is deleted; with recent stays',async()=>{const cutoff=daysAgo(7);const oldUserNoSp={id:'u-old-no-sp',created_at:daysAgo(10)};const oldUserWithRecentSp={id:'u-old-recent-sp',created_at:daysAgo(10)};const recentUser={id:'u-recent',created_at:daysAgo(1)};const fake=makeFake({users:[oldUserNoSp,oldUserWithRecentSp,recentUser],submissions:[],savedProcesses:[{id:'sp1',user_id:'u-old-recent-sp',created_at:daysAgo(1)},{id:'sp2',user_id:'u-old-no-sp',created_at:daysAgo(10)}]});const resDry=await cleanupUsers(fake,cutoff,true);assert.equal(resDry.usersFound,1);assert.equal(resDry.wouldDelete,1);const fakeLive=makeFake({users:[oldUserNoSp,oldUserWithRecentSp,recentUser],submissions:[],savedProcesses:[{id:'sp1',user_id:'u-old-recent-sp',created_at:daysAgo(1)},{id:'sp2',user_id:'u-old-no-sp',created_at:daysAgo(10)}]});const resLive=await cleanupUsers(fakeLive,cutoff,false);assert.equal(resLive.usersFound,1);assert.equal(resLive.usersDeleted,1);assert.equal(fakeLive._users.some(u=>u.id==='u-old-recent-sp'),true);assert.equal(fakeLive._users.some(u=>u.id==='u-old-no-sp'),false);assert.equal(fakeLive._users.some(u=>u.id==='u-recent'),true);});it('old user with submission not deleted',async()=>{const cutoff=daysAgo(7);const oldUserWithSub={id:'u-with-sub',created_at:daysAgo(10)};const fake=makeFake({users:[oldUserWithSub],submissions:[{id:'s1',created_at:daysAgo(8),user_id:'u-with-sub'}],savedProcesses:[]});const res=await cleanupUsers(fake,cutoff,false);assert.equal(res.usersFound,0);assert.equal(res.usersDeleted,0);assert.equal(fake._users.length,1);});});
describe('cleanupCounters',()=>{it('deletes only older than cutoff, dry counts',async()=>{const cutoff=daysAgo(7);const old={key:'ip:1',window_start:daysAgo(8)};const recent={key:'ip:2',window_start:daysAgo(1)};const fakeDry=makeFake({usageCounters:[old,recent]});const dry=await cleanupCounters(fakeDry,cutoff,true);assert.equal(dry.countersFound,1);assert.equal(dry.wouldDelete,1);assert.equal(dry.countersDeleted,0);assert.equal(fakeDry._usageCounters.length,2);const fakeLive=makeFake({usageCounters:[old,recent]});const live=await cleanupCounters(fakeLive,cutoff,false);assert.equal(live.countersFound,1);assert.equal(live.countersDeleted,1);assert.equal(fakeLive._usageCounters.length,1);assert.equal(fakeLive._usageCounters[0].key,'ip:2');});});
describe('runCleanup integration',()=>{it('dryRun returns combined counts, no deletes',async()=>{const cutoff=daysAgo(7);const fake=makeFake({submissions:[{id:'s-old',created_at:daysAgo(8),user_id:'u1'}],documents:[{submission_id:'s-old',storage_path:'u1/s-old/d.jpg'}],users:[{id:'u-old',created_at:daysAgo(10)}],savedProcesses:[],usageCounters:[{key:'k1',window_start:daysAgo(8)}]});const res=await runCleanup(fake,{cutoffISO:cutoff,isDry:true});assert.equal(res.submissions.wouldDelete,1);assert.equal(res.counters.wouldDelete,1);});});
describe('getCutoffISO',()=>{it('7 days ago',()=>{const iso=getCutoffISO(7);const diff=Date.now()-new Date(iso).getTime();assert.ok(Math.abs(diff-7*86400000)<1000);});});


