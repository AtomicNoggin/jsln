import test from 'node:test';
import assert from 'node:assert/strict';

import Parser from './parser.js';

test('Parser.hasRemaining returns true if there is remaining text, false otherwise', () => {
  const parser = new Parser('abc');
  assert.equal(parser.hasRemaining(), true);
  parser.getNext(3);
  assert.equal(parser.hasRemaining(), false);
});

test('Parser.appendText adds text to the end of the remaining text', () => {
    const parser = new Parser('abc');
    assert.equal(parser.appendText('def'), 'abcdef');
    assert.equal(parser.appendText(), 'abcdef');
});

test('Parser.readNext peeks without consuming text', () => {
  const parser = new Parser('abc\nXY');
  assert.equal(parser.readNext(2), 'ab');
  assert.equal(parser.readNext(10), 'abc\nXY');
  assert.deepEqual(parser.lastPosition(), [1, 0]);
});
test('Parser.readNext reads a single character if amount not provided', () => {
  const parser = new Parser('abc');
  assert.equal(parser.readNext(), 'a');
});

test('Parser.getNext consumes text and tracks position across lines', () => {
  const parser = new Parser('12\n34');

  assert.equal(parser.getNext(2), '12');
  assert.deepEqual(parser.lastPosition(), [1, 2]);
  assert.equal(parser.getNext(3), '\n34');
  assert.deepEqual(parser.lastPosition(), [2, 2]);
});
test('Parser.getNext consumes a single character if amount not provided', () => {
  const parser = new Parser('abc');
  assert.equal(parser.getNext(), 'a');
  assert.deepEqual(parser.lastPosition(), [1, 1]);
});
test('Parser.getNextIf consumes the expected text and return empty strings on no match', () => {
  const numeric = new Parser('ab12');
  assert.equal(numeric.getNextIf('a-z', 2), 'ab');
  assert.equal(numeric.getNextIf('a-z', 2), '');
});
test('Parser.getNextIf consumes a single character if amount not provided', () => {
  const parser = new Parser('abc');
  assert.equal(parser.getNextIf('a-z'), 'a');
});
test('Parser.getNextIf accepts flags when provided', () => {
  const parser = new Parser('ABC');
  assert.equal(parser.getNextIf('a-z', 1, 'i'), 'A');
});
test('Parser.getWS consumes the expected whitespace and return empty strings on no match', () => {
  const whitespace = new Parser('  \n\tabc');
  assert.equal(whitespace.getWS(), '  \n\t');
  assert.equal(whitespace.getWS(), '');
});
test('Parser.getWhileMatching consumes the expected text and return empty strings on no match', () => {
  const letters = new Parser('aabb1234');
  assert.equal(letters.getWhileMatching('a-z'), 'aabb');
  assert.equal(letters.getWhileMatching('a-z'), '');
});
test('Parser.getWhileMatching accepts flags when provided', () => {
  const parser = new Parser('ABC','i');
  assert.equal(parser.getWhileMatching('a-z', 'i'), 'ABC');
});

test('Parser.getUntilMatching  consumes the expected text and retrurns both unmatching text and first match', () => {
  const parser = new Parser('ab\ncdefg');
  assert.deepEqual(parser.getUntilMatching('d'), ['ab\nc', 'd']);
});
test('Parser.getUntilMatching  consumes the expected text and retrurns initial empty string if no non-matching characters are found', () => {
  const parser = new Parser('abcdefg');
  assert.deepEqual(parser.getUntilMatching('a-z'), ['', 'a']);
});
test('Parser.getUntilMatching  consumes the expected text and returns initial empty string if no non-matching characters are found', () => {
  const parser = new Parser('abcdefg');
  assert.deepEqual(parser.getUntilMatching('a-z'), ['', 'a']);
});
test('Parser.getUntilMatching  consumes the expected text and returns secondary empty string if no matching characters are found', () => {
  const parser = new Parser('abcdefg');
  assert.deepEqual(parser.getUntilMatching('0-9'), ['abcdefg', '']);
});

test('Parser.throw throws an error with the provided message and current line and col', () => {
  const parser = new Parser('ab\ncd');
  parser.getNext(5);
  assert.throws(() => parser.throw('bad'), /bad \(at line 2, col 2\)/);
});
