// tests/suspicious-text.test.js
// Hidden instructions to software are reported, never followed, never change fields.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readSuspicious } = require('../lib/validation');
const { wrongDocumentReason } = require('../lib/decide-usability');

describe('suspicious text flag', () => {
  it('true only for a literal true', () => {
    assert.equal(readSuspicious({ suspicious_text: true }), true);
    assert.equal(readSuspicious({ suspicious_text: 'true' }), false);
    assert.equal(readSuspicious({ suspicious_text: false }), false);
    assert.equal(readSuspicious({}), false);
    assert.equal(readSuspicious(null), false);
  });
});

describe('wrong document wording', () => {
  it('drops a trailing (sample ...) from labels', () => {
    assert.equal(
      wrongDocumentReason({ expectedLabel: 'Official receipt (sample store)', looksLikeLabel: null }),
      "This doesn't look like an official receipt. Please upload the right document."
    );
  });
});
