// tests/clarify-ask.test.js — Step 9B Act 3 mocked model call + generation
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { validateQuestion, templateQuestion, buildPairKey } = require('../lib/clarify');
const { askClarification, generateClarificationsForSubmission, CLARIFY_SYSTEM_PROMPT, CLARIFY_MODEL, CLARIFY_BASE_URL } = require('../lib/clarify-ask');

function makeMockAdmin(overrides) {
  const o = overrides || {};
  const inserts = [];
  const workLogs = [];
  const state = {
    submissions: o.submissions || [{ id: 'sub-1', user_id: 'user-1', process_id: 'linawan_scholarship_intake', status: 'in_progress' }],
    clarifications: o.clarifications || [],
    documents: o.documents || [
      { id: 'doc-1', doc_type: 'valid_id', created_at: '2026-10-30T01:00:00Z', status: 'needs_review' },
      { id: 'doc-2', doc_type: 'birth_certificate', created_at: '2026-10-30T02:00:00Z', status: 'needs_review' },
    ],
    extracted_fields: o.extracted_fields || [
      { document_id: 'doc-1', field_key: 'full_name', value_text: 'Ma. Theresa Santos Reyes', unreadable: false },
      { document_id: 'doc-2', field_key: 'full_name', value_text: 'Maria Theresa Santos Reyes', unreadable: false },
    ],
    profiles: o.profiles || [{ user_id: 'user-1', given_name: 'Maria', middle_name: 'Theresa', surname: 'Santos Reyes', suffix: null }],
    check_results: o.check_results || [
      { id: 'cr-1', document_id: 'doc-1', compared_document_id: 'doc-2', field_key: 'full_name', rule: 'filipino_name', result: 'check', reason: 'Ma. is short for Maria, please confirm.', created_at: '2026-10-30T03:00:00Z' },
    ],
  };
  const admin = {
    from: function (table) {
      let current = { table, filters: [] };
      const chain = {
        select: function (f) { current.selectFields = f; return chain; },
        eq: function (col, val) { current.filters.push({ op: 'eq', col, val }); return chain; },
        in: function (col, vals) { current.filters.push({ op: 'in', col, vals }); return chain; },
        maybeSingle: async function () {
          if (current.table === 'submissions') {
            const f = current.filters.find(ff => ff.col === 'id');
            const row = state.submissions.find(s => !f || s.id === f.val) || null;
            return { data: row, error: null };
          }
          if (current.table === 'profiles') {
            const f = current.filters.find(ff => ff.col === 'user_id');
            const row = state.profiles.find(p => !f || p.user_id === f.val) || null;
            return { data: row, error: null };
          }
          return { data: null, error: null };
        },
        insert: async function (payload) {
          const arr = Array.isArray(payload) ? payload : [payload];
          for (const row of arr) {
            if (table === 'clarifications') {
              const exists = state.clarifications.find(c => c.submission_id === row.submission_id && c.pair_key === row.pair_key);
              if (exists) return { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } };
              state.clarifications.push(row);
              inserts.push({ table, row });
            } else if (table === 'work_log') {
              workLogs.push(row);
              inserts.push({ table, row });
            } else {
              inserts.push({ table, row });
            }
          }
          return { data: null, error: null };
        },
        then: function (resolve, reject) {
          let data = [];
          if (current.table === 'clarifications') {
            const f = current.filters.find(ff => ff.col === 'submission_id');
            data = state.clarifications.filter(c => !f || c.submission_id === f.val);
          } else if (current.table === 'documents') {
            const fSub = current.filters.find(ff => ff.col === 'submission_id');
            const fStatus = current.filters.find(ff => ff.op === 'in' && ff.col === 'status');
            data = state.documents.filter(d => {
              if (fSub && d.submission_id && d.submission_id !== fSub.val) return false;
              if (fSub && !d.submission_id) { if (fSub.val !== 'sub-1') return false; }
              if (fStatus && !fStatus.vals.includes(d.status)) return false;
              return true;
            });
            if (!fStatus) {
              const fEq = current.filters.find(ff => ff.col === 'status' && ff.op === 'eq');
              if (fEq) data = data.filter(d => d.status === fEq.val);
            }
          } else if (current.table === 'extracted_fields') {
            const f = current.filters.find(ff => ff.op === 'in' && ff.col === 'document_id');
            if (f) data = state.extracted_fields.filter(r => f.vals.includes(r.document_id));
            else data = state.extracted_fields.slice();
          } else if (current.table === 'check_results') {
            const f = current.filters.find(ff => ff.op === 'in' && ff.col === 'document_id');
            if (f) data = state.check_results.filter(r => f.vals.includes(r.document_id));
            else data = state.check_results.slice();
          }
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return chain;
    },
    rpc: async function (fn, args) {
      if (fn === 'increment_usage') {
        if (o.rpcBlocked) return { data: 201, error: null };
        if (o.rpcCount != null) return { data: o.rpcCount, error: null };
        return { data: 1, error: null };
      }
      return { data: null, error: null };
    },
    _inserts: inserts,
    _workLogs: workLogs,
    _state: state,
  };
  return admin;
}

describe('askClarification with mocked model call', () => {
  let origFetch;
  let origKey;
  beforeEach(() => {
    origFetch = global.fetch;
    origKey = process.env.META_API_KEY;
    process.env.META_API_KEY = 'test-key-123';
  });
  afterEach(() => {
    global.fetch = origFetch;
    process.env.META_API_KEY = origKey;
  });

  it('sends ONLY field_label + two short values (<=40) with correct system prompt', async () => {
    let captured = null;
    global.fetch = async (url, opts) => {
      captured = { url, opts, body: JSON.parse(opts.body) };
      return {
        ok: true,
        text: async () => JSON.stringify({ choices: [{ message: { content: 'Is "Ma. Santos" the same person as "Maria Santos" for Full name?' } }] }),
      };
    };
    const q = await askClarification({ admin: null, fieldLabel: 'Full name', valueA: 'Ma. Santos', valueB: 'Maria Santos' });
    assert.equal(captured.url, CLARIFY_BASE_URL + '/chat/completions');
    assert.equal(captured.body.model, CLARIFY_MODEL);
    assert.equal(captured.body.messages[0].role, 'system');
    assert.equal(captured.body.messages[0].content, CLARIFY_SYSTEM_PROMPT);
    assert.equal(captured.body.messages[1].role, 'user');
    const userObj = JSON.parse(captured.body.messages[1].content);
    assert.equal(userObj.field_label, 'Full name');
    assert.equal(userObj.value_a, 'Ma. Santos');
    assert.equal(userObj.value_b, 'Maria Santos');
    assert.equal(Object.keys(userObj).length, 3);
    assert.ok(userObj.field_label.length <= 40);
    assert.ok(userObj.value_a.length <= 40);
    assert.ok(userObj.value_b.length <= 40);
    assert.equal(q, 'Is "Ma. Santos" the same person as "Maria Santos" for Full name?');
  });

  it('truncates values to 40 chars before sending and in template fallback', async () => {
    let captured = null;
    global.fetch = async (url, opts) => {
      captured = { url, opts, body: JSON.parse(opts.body) };
      return { ok: true, text: async () => JSON.stringify({ choices: [{ message: { content: 'Is "a" the same person as "b" for Name?' } }] }) };
    };
    const longA = 'a'.repeat(100);
    const longB = 'b'.repeat(100);
    const longLabel = 'c'.repeat(100);
    await askClarification({ admin: null, fieldLabel: longLabel, valueA: longA, valueB: longB });
    const userObj = JSON.parse(captured.body.messages[1].content);
    assert.equal(userObj.field_label.length, 40);
    assert.equal(userObj.value_a.length, 40);
    assert.equal(userObj.value_b.length, 40);
    const tpl = templateQuestion(longLabel, longA, longB);
    assert.ok(tpl.length <= 160);
    assert.equal(tpl[tpl.length - 1], '?');
  });

  it('falls back to template on fetch failure', async () => {
    global.fetch = async () => { throw new Error('network down'); };
    const q = await askClarification({ admin: null, fieldLabel: 'Full name', valueA: 'Ma. Santos', valueB: 'Maria Santos' });
    assert.equal(q, templateQuestion('Full name', 'Ma. Santos', 'Maria Santos'));
    assert.ok(validateQuestion(q).ok);
  });

  it('falls back to template on invalid model output (no ?, html, link)', async () => {
    const badOutputs = [
      'This is not a question',
      'Is this <b>bold</b>?',
      'See https://example.com?',
      'a'.repeat(161) + '?',
    ];
    for (const bad of badOutputs) {
      global.fetch = async () => ({
        ok: true,
        text: async () => JSON.stringify({ choices: [{ message: { content: bad } }] }),
      });
      const q = await askClarification({ admin: null, fieldLabel: 'Full name', valueA: 'Ma. Santos', valueB: 'Maria Santos' });
      assert.equal(q, templateQuestion('Full name', 'Ma. Santos', 'Maria Santos'));
      assert.ok(validateQuestion(q).ok);
    }
  });

  it('falls back to template when daily cap is reached', async () => {
    global.fetch = async () => { throw new Error('should not be called when cap blocked'); };
    const adminBlocked = makeMockAdmin({ rpcBlocked: true });
    const q = await askClarification({ admin: adminBlocked, fieldLabel: 'Full name', valueA: 'Ma. Santos', valueB: 'Maria Santos' });
    assert.equal(q, templateQuestion('Full name', 'Ma. Santos', 'Maria Santos'));
  });

  it('returns validated model question when valid', async () => {
    global.fetch = async () => ({
      ok: true,
      text: async () => JSON.stringify({ choices: [{ message: { content: 'Is "Ma. Santos" the same person as "Maria Santos" for Full name?' } }] }),
    });
    const admin = makeMockAdmin({});
    const q = await askClarification({ admin, fieldLabel: 'Full name', valueA: 'Ma. Santos', valueB: 'Maria Santos' });
    assert.equal(q, 'Is "Ma. Santos" the same person as "Maria Santos" for Full name?');
    assert.ok(validateQuestion(q).ok);
  });

  it('returns template when META_API_KEY is missing', async () => {
    process.env.META_API_KEY = '';
    global.fetch = async () => { throw new Error('should not call'); };
    const q = await askClarification({ admin: null, fieldLabel: 'Full name', valueA: 'Ma. Santos', valueB: 'Maria Santos' });
    assert.equal(q, templateQuestion('Full name', 'Ma. Santos', 'Maria Santos'));
  });

  it('rejects generic question without both values and uses template', async () => {
    global.fetch = async () => ({
      ok: true,
      text: async () => JSON.stringify({ choices: [{ message: { content: 'What is your full name?' } }] }),
    });
    const q = await askClarification({ admin: null, fieldLabel: 'Full Name', valueA: 'Ma. Theresa Santos Reyes', valueB: 'Maria Theresa Santos Reyes' });
    assert.equal(q, templateQuestion('Full Name', 'Ma. Theresa Santos Reyes', 'Maria Theresa Santos Reyes'));
  });

  it('accepts model question that contains both compared values', async () => {
    const good = 'Is "Ma. Theresa Santos Reyes" the same name as "Maria Theresa Santos Reyes"?';
    global.fetch = async () => ({
      ok: true,
      text: async () => JSON.stringify({ choices: [{ message: { content: good } }] }),
    });
    const q = await askClarification({ admin: null, fieldLabel: 'Full Name', valueA: 'Ma. Theresa Santos Reyes', valueB: 'Maria Theresa Santos Reyes' });
    assert.equal(q, good);
    assert.ok(validateQuestion(q).ok);
  });
});

describe('generateClarificationsForSubmission background', () => {
  let origFetch;
  let origKey;
  beforeEach(() => {
    origFetch = global.fetch;
    origKey = process.env.META_API_KEY;
    process.env.META_API_KEY = 'test-key-123';
    global.fetch = async () => ({
      ok: true,
      text: async () => JSON.stringify({ choices: [{ message: { content: 'Is "Ma. Theresa Santos Reyes" the same person as "Maria Theresa Santos Reyes" for Full name?' } }] }),
    });
  });
  afterEach(() => {
    global.fetch = origFetch;
    process.env.META_API_KEY = origKey;
  });

  it('picks eligible pairs with pickUniquePairs, cap 3, inserts clarifications', async () => {
    const admin = makeMockAdmin({});
    const res = await generateClarificationsForSubmission({ admin, submissionId: 'sub-1' });
    assert.equal(res.inserted, 1);
    assert.equal(admin._state.clarifications.length, 1);
    const c = admin._state.clarifications[0];
    assert.equal(c.submission_id, 'sub-1');
    assert.equal(c.field_key, 'full_name');
    assert.equal(c.pair_key, buildPairKey('full_name', 'Ma. Theresa Santos Reyes', 'Maria Theresa Santos Reyes'));
    assert.ok(c.question.length >= 1 && c.question.length <= 160);
    assert.equal(c.question[c.question.length - 1], '?');
    assert.equal(c.check_result_id, 'cr-1');
    assert.ok(admin._workLogs.some(w => w.step_type === 'clarification_asked' && w.message.includes('Asked to confirm')));
    const wl = admin._workLogs.find(w => w.step_type === 'clarification_asked');
    assert.ok(wl.message.includes('Full name') || wl.message.includes('full_name'));
    assert.ok(wl.message.includes(c.question));
  });

  it('skips pairs that already have a clarification', async () => {
    const existingKey = buildPairKey('full_name', 'Ma. Theresa Santos Reyes', 'Maria Theresa Santos Reyes');
    const admin = makeMockAdmin({
      clarifications: [{ submission_id: 'sub-1', pair_key: existingKey, field_key: 'full_name', question: 'Is "Ma. Theresa Santos Reyes" the same person as "Maria Theresa Santos Reyes" for Full name?', check_result_id: 'cr-1' }],
    });
    const res = await generateClarificationsForSubmission({ admin, submissionId: 'sub-1' });
    assert.equal(res.inserted, 0);
    assert.equal(admin._state.clarifications.length, 1);
  });

  it('cap 3 per submission: existingCount 3 -> 0 new, logs skipped', async () => {
    const admin = makeMockAdmin({
      clarifications: [
        { submission_id: 'sub-1', pair_key: 'full_name|a|b', field_key: 'full_name', question: 'Is "a" the same person as "b" for Full name?', check_result_id: 'cr-a' },
        { submission_id: 'sub-1', pair_key: 'full_name|c|d', field_key: 'full_name', question: 'Is "c" the same person as "d" for Full name?', check_result_id: 'cr-c' },
        { submission_id: 'sub-1', pair_key: 'full_name|e|f', field_key: 'full_name', question: 'Is "e" the same person as "f" for Full name?', check_result_id: 'cr-e' },
      ],
      documents: [{ id: 'doc-1', doc_type: 'valid_id', created_at: '2026-10-30T01:00:00Z', status: 'needs_review' }],
      check_results: [{ id: 'cr-new', document_id: 'doc-1', compared_document_id: null, field_key: 'full_name', rule: 'filipino_name', result: 'check', reason: 'Ma. is short for Maria...', created_at: '2026-10-30T04:00:00Z' }],
      extracted_fields: [{ document_id: 'doc-1', field_key: 'full_name', value_text: 'Ma. Santos', unreadable: false }],
      profiles: [{ user_id: 'user-1', given_name: 'Maria', middle_name: '', surname: 'Santos', suffix: null }],
    });
    const res = await generateClarificationsForSubmission({ admin, submissionId: 'sub-1' });
    assert.equal(res.inserted, 0);
    assert.ok(admin._workLogs.some(w => w.step_type === 'clarification_skipped_cap'));
  });

  it('cap 3: 5 unique eligible would still insert at most 3', async () => {
    const admin = makeMockAdmin({
      documents: [
        { id: 'doc-1', doc_type: 'valid_id', created_at: '2026-10-30T01:00:00Z', status: 'needs_review' },
        { id: 'doc-2', doc_type: 'birth_certificate', created_at: '2026-10-30T02:00:00Z', status: 'needs_review' },
        { id: 'doc-3', doc_type: 'report_card', created_at: '2026-10-30T03:00:00Z', status: 'needs_review' },
      ],
      extracted_fields: [
        { document_id: 'doc-1', field_key: 'full_name', value_text: 'Ma. A', unreadable: false },
        { document_id: 'doc-2', field_key: 'full_name', value_text: 'Maria A', unreadable: false },
        { document_id: 'doc-3', field_key: 'full_name', value_text: 'Ma. B', unreadable: false },
        { document_id: 'doc-1', field_key: 'mother_maiden_name', value_text: 'Ma. C', unreadable: false },
        { document_id: 'doc-2', field_key: 'mother_maiden_name', value_text: 'Maria C', unreadable: false },
        { document_id: 'doc-1', field_key: 'father_name', value_text: 'Jose D', unreadable: false },
        { document_id: 'doc-2', field_key: 'father_name', value_text: 'Jos\u00e9 D', unreadable: false },
      ],
      check_results: [
        { id: 'cr-1', document_id: 'doc-1', compared_document_id: 'doc-2', field_key: 'full_name', rule: 'filipino_name', result: 'check', reason: 'Ma. vs Maria', created_at: '2026-10-30T03:00:00Z' },
        { id: 'cr-2', document_id: 'doc-1', compared_document_id: 'doc-2', field_key: 'mother_maiden_name', rule: 'filipino_name', result: 'check', reason: 'Ma. vs Maria', created_at: '2026-10-30T03:01:00Z' },
        { id: 'cr-3', document_id: 'doc-1', compared_document_id: 'doc-3', field_key: 'full_name', rule: 'filipino_name', result: 'check', reason: 'extra words', created_at: '2026-10-30T03:02:00Z' },
        { id: 'cr-4', document_id: 'doc-2', compared_document_id: 'doc-3', field_key: 'full_name', rule: 'filipino_name', result: 'check', reason: 'suffix', created_at: '2026-10-30T03:03:00Z' },
        { id: 'cr-5', document_id: 'doc-1', compared_document_id: null, field_key: 'full_name', rule: 'filipino_name', result: 'check', reason: 'Ma. vs Maria profile', created_at: '2026-10-30T03:04:00Z' },
      ],
      profiles: [{ user_id: 'user-1', given_name: 'Maria A', middle_name: '', surname: 'Santos', suffix: null }],
    });
    admin._state.extracted_fields.push({ document_id: 'doc-2', field_key: 'full_name', value_text: 'Maria A', unreadable: false });
    const res = await generateClarificationsForSubmission({ admin, submissionId: 'sub-1' });
    assert.ok(res.inserted <= 3);
    assert.ok(res.inserted >= 1);
  });

  it('never leaves document stuck: errors are caught and logged, inserted 0', async () => {
    const admin = {
      from: () => { throw new Error('db down'); },
      rpc: async () => { throw new Error('rpc down'); },
    };
    const res = await generateClarificationsForSubmission({ admin, submissionId: 'sub-1' });
    assert.equal(res.inserted, 0);
  });

  it('uses template when model returns invalid even after cap check', async () => {
    global.fetch = async () => ({
      ok: true,
      text: async () => JSON.stringify({ choices: [{ message: { content: 'bad output without question mark' } }] }),
    });
    const admin = makeMockAdmin({});
    const res = await generateClarificationsForSubmission({ admin, submissionId: 'sub-1' });
    assert.equal(res.inserted, 1);
    const c = admin._state.clarifications[0];
    assert.equal(c.question, templateQuestion('Full Name', 'Ma. Theresa Santos Reyes', 'Maria Theresa Santos Reyes'));
  });
});
