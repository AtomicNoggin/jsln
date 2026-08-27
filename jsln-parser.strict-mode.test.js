import test from 'node:test';
import assert from 'node:assert/strict';

import JSLNParser from './jsln-parser.js';

test('JSLNParser strict mode rejects comments', () => {
  const p = new JSLNParser('/*comment*/');
  assert.throws(() => p.getWSorComments(true), /unexpected comment/);
});

test('JSLNParser strict mode rejects backtick (multiline) strings when parsing a member', () => {
  const p = new JSLNParser('`abc`');
  p.strictMode = true;
  assert.throws(() => p.getMember(), /unexpected token '\`' in strict mode/);
});
test('JSLNParser strict mode disallows escaped line terminators', () => {
  const p = new JSLNParser("'a\\\nb'");
  p.strictMode = true;
  assert.throws(() => p.getString(true));
});

test('JSLNParser strict mode disallows comments between concatenated strings', () => {
  const p = new JSLNParser("'a'/*c*/+'b'");
  p.strictMode = true;
  assert.throws(() => p.getString(true));
});
