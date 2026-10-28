// tests/review-ownership.test.js
// Step 7: ownership check for reviewer routes (pure, no database, no API cost).

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isOwnedBy } = require('../lib/review-auth');

describe('reviewer ownership (isOwnedBy)', () => {
  it('null submission is not owned', () => {
    assert.equal(isOwnedBy(null, 'user-a'), false);
  });

  it('missing submission is not owned', () => {
    assert.equal(isOwnedBy(undefined, 'user-a'), false);
  });

  it('another visitor does not own the row (cross-user 404, zero writes)', () => {
    assert.equal(isOwnedBy({ id: 'sub-1', user_id: 'user-a' }, 'user-b'), false);
  });

  it('same visitor owns the row', () => {
    assert.equal(isOwnedBy({ id: 'sub-1', user_id: 'user-a' }, 'user-a'), true);
  });

  it('missing user_id fields are not owned', () => {
    assert.equal(isOwnedBy({ id: 'sub-1' }, 'user-a'), false);
    assert.equal(isOwnedBy({ id: 'sub-1', user_id: 'user-a' }, ''), false);
    assert.equal(isOwnedBy({ id: 'sub-1', user_id: 'user-a' }, null), false);
  });
});
