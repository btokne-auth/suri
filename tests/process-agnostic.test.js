// tests/process-agnostic.test.js
// Step 7: engine reads process settings, never hard-codes Linawan.
// Pure, no database, no API cost.

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getProcess, listProcesses } = require('../lib/processes/index');
const { checkRequirementCity, buildRequirementFailReason } = require('../lib/checks/run-checks');
const { buildValueSchema } = require('../lib/validation');
const linawan = require('../lib/processes/linawan-scholarship-intake');

describe('process registry', () => {
  it('lists at least one process', () => {
    const list = listProcesses();
    assert.ok(Array.isArray(list) && list.length >= 1);
    assert.ok(list[0].id && list[0].label);
  });

  it('Linawan documents keep settings order', () => {
    const proc = getProcess('linawan_scholarship_intake');
    assert.deepStrictEqual(proc.documents, ['valid_id', 'birth_certificate', 'report_card']);
  });

  it('unknown process id returns null', () => {
    assert.equal(getProcess('nope'), null);
    assert.equal(getProcess(''), null);
  });
});

describe('process-agnostic requirement', () => {
  it('process with no requirement skips', () => {
    assert.equal(checkRequirementCity('Linawan', {}).outcome, 'skip');
    assert.equal(checkRequirementCity('Linawan', null).outcome, 'skip');
    assert.equal(checkRequirementCity('Linawan', { id: 'x', documents: [] }).outcome, 'skip');
  });

  it('fail wording is built from settings, never "Looks ready"', () => {
    const reason = buildRequirementFailReason(linawan);
    assert.match(reason, /Read OK/);
    assert.ok(reason.includes(linawan.requirement.value));
    assert.ok(!reason.includes('Looks ready'));
  });

  it('fail wording works for a made-up process (no Linawan words hard-coded)', () => {
    const fake = { id: 'fake', documents: ['report_card'], requirement: { document: 'report_card', field: 'school_name', op: 'equals', value: 'Bayan', message: 'Bayan only.' } };
    const reason = buildRequirementFailReason(fake);
    assert.ok(reason.includes('Bayan'));
    assert.ok(!reason.includes('Linawan'));
    assert.ok(!reason.includes('Looks ready'));
  });

  it('no-requirement wording is generic', () => {
    assert.equal(buildRequirementFailReason({}), 'Read OK.');
  });
});

describe('reviewer correction validation (same Zod rules)', () => {
  it('rejects average of 150', () => {
    const schema = buildValueSchema({ key: 'general_average', type: 'number', required: true, min: 60, max: 100 });
    assert.equal(schema.safeParse(150).success, false);
  });

  it('rejects a future birth date', () => {
    const schema = buildValueSchema({ key: 'date_of_birth', type: 'date', required: true });
    assert.equal(schema.safeParse('2999-01-01').success, false);
  });

  it('rejects digits in a name', () => {
    const schema = buildValueSchema({ key: 'full_name', type: 'name', required: true, maxLength: 100 });
    assert.equal(schema.safeParse('Maria 123').success, false);
  });

  it('accepts a good value', () => {
    const schema = buildValueSchema({ key: 'general_average', type: 'number', required: true, min: 60, max: 100 });
    assert.equal(schema.safeParse(89).success, true);
  });
});
