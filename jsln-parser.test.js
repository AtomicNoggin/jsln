import test from 'node:test';
import assert from 'node:assert/strict';
import JSLNParser from './jsln-parser.js';

test('JSLNParser.getWSorComments captures single-line and multi-line comments', () => {
  const p = new JSLNParser('//hello\n/*block*/');
  const comments = p.getWSorComments();
  assert.equal(Array.isArray(comments), true);
  assert.equal(comments[0].startsWith('//hello'), true);
  assert.equal(comments[1].startsWith('/*block*/'), true);
});

test('JSLNParser.getIdent reads identifier tokens', () => {
  const p = new JSLNParser('fooBar123');
  assert.equal(p.getIdent(), 'fooBar123');
});

test('JSLNParser.getStringEscapeChar handles simple escapes and hex', () => {
  const p1 = new JSLNParser('nrest');
  assert.equal(p1.getStringEscapeChar(), '\n');
  const p2 = new JSLNParser('x41rest');
  assert.equal(p2.getStringEscapeChar(), 'A');
});
test ('JSLNParser.getStringEscapeChar handles 4-digit unicode escapes', () => {
  const p = new JSLNParser('u0041rest');
  assert.equal(p.getStringEscapeChar(), 'A');
});
test ('JSLNParser.getStringEscapeChar handles 1 to 6 digit unicode escapes', () => {
  assert.equal(new JSLNParser('u{9}').getStringEscapeChar(), '\t');
  assert.equal(new JSLNParser('u{41}').getStringEscapeChar(), 'A');
  assert.equal(new JSLNParser('u{041}').getStringEscapeChar(), 'A');
  assert.equal(new JSLNParser('u{0041}').getStringEscapeChar(), 'A');
  assert.equal(new JSLNParser('u{00041}').getStringEscapeChar(), 'A');
  assert.equal(new JSLNParser('u{000041}').getStringEscapeChar(), 'A');
});

test('JSLNParser.getSinglelineString parses quoted strings and escape sequences', () => {
  const p = new JSLNParser("'a\\n'X");
  assert.equal(p.getSinglelineString(), 'a\n');
});
test('JSLNParser.getSinglelineString allows escaped line terminators', () => {
  const p = new JSLNParser("'a\\\nb'X");
  assert.equal(p.getSinglelineString(), 'ab');
});

test('JSLNParser.getMultilineString parses backtick strings', () => {
  const p = new JSLNParser('`hello\nworld`rest');
  assert.equal(p.getMultilineString(), 'hello\nworld');
});

test('JSLNParser.getString concatenates adjacent string literals', () => {
  const p = new JSLNParser("'a' + /*comment*/ 'b'");
  const [combined] = p.getString();
  assert.equal(combined, 'ab');
});

test('JSLNParser.getRegExp parses a regex literal and flags', () => {
  const p = new JSLNParser('/abc/gi');
  const [pattern, flags] = p.getRegExp();
  assert.equal(pattern, 'abc');
  assert.equal(flags, 'gi');
});

test('JSLNParser.getNextDigits strips underscore group markers', () => {
  const p = new JSLNParser('_12_345x');
  assert.equal(p.getNextDigits(), '12345');
  // remaining should start with 'x'
  assert.equal(p.readNext(), 'x');
});

test('JSLNParser.getNumber parses decimal integers', () => {
  assert.equal(new JSLNParser('123').getNumber(), 123);
  assert.equal(new JSLNParser('-456').getNumber(), -456);
  assert.equal(new JSLNParser('+456').getNumber(), 456);
});
test('JSLNParser.getNumber allows leading zeros with or without grouping', () => {
  assert.equal(new JSLNParser('000_123').getNumber(), 123);
  assert.equal(new JSLNParser('000123').getNumber(), 123);
});

test('JSLNParser.getNumber parses floating point values', () => {
  assert.equal(new JSLNParser('12.125').getNumber(), 12.125);
  assert.equal(new JSLNParser('.125').getNumber(), 0.125);
  assert.equal(new JSLNParser('12.').getNumber(), 12);
});
test('JSLNParser.getNumber parses scientific notation', () => {
  assert.equal(new JSLNParser('1e3').getNumber(), 1000);
  assert.equal(new JSLNParser('1.2e+3').getNumber(), 1200);
  assert.equal(new JSLNParser('1.2e-3').getNumber(), 0.0012);
  assert.equal(new JSLNParser('-1.2e3').getNumber(), -1200);
});
test('JSLNParser.getNumber parses hex, octal, and binary', () => {
  assert.equal(new JSLNParser('0x10').getNumber(), 16);
  assert.equal(new JSLNParser('0X10').getNumber(), 16);
  assert.equal(new JSLNParser('0xff').getNumber(), 255);
  assert.equal(new JSLNParser('0XFF').getNumber(), 255);
  assert.equal(new JSLNParser('0o10').getNumber(), 8);
  assert.equal(new JSLNParser('0O10').getNumber(), 8);
  assert.equal(new JSLNParser('0b10').getNumber(), 2);
  assert.equal(new JSLNParser('0B10').getNumber(), 2);
});
test('JSLNParser.getNumber parses BigInt values', () => {
  assert.equal(new JSLNParser('123n').getNumber(), 123n);
  assert.equal(new JSLNParser('0x10n').getNumber(), 16n);
  assert.equal(new JSLNParser('0o10n').getNumber(), 8n);
  assert.equal(new JSLNParser('0b10n').getNumber(), 2n);
});
test('JSLNParser.getNumber parses Infinity and NaN', () => {
  assert.equal(new JSLNParser('Infinity').getNumber(), Infinity);
  assert.equal(new JSLNParser('-Infinity').getNumber(), -Infinity);
  assert.ok(Number.isNaN(new JSLNParser('NaN').getNumber()));
});

test('JSLNParser.getKey accepts quoted and identifier keys', () => {
  assert.equal(new JSLNParser("'k' ").getKey(), 'k');
  assert.equal(new JSLNParser('key ').getKey(), 'key');
});

test('JSLNParser.getArray parses values, nested arrays, and missing entries', () => {
  const p = new JSLNParser('[1, [true, null], , "text"]');
  const [result, inner] = p.getArray();

  assert.deepEqual(result, [1, [true, null], , "text"]);
  assert.deepEqual(inner, []);
  assert.equal(p.hasRemaining(), false);
});

test('JSLNParser.getObject parses identifier and quoted keys with nested values', () => {
  const p = new JSLNParser('{name: "Ada", details: {active: true}}');
  const [result, inner] = p.getObject();

  assert.deepEqual(result, {
    name: "Ada",
    details: { active: true },
  });
  assert.deepEqual(inner, []);
  assert.equal(p.hasRemaining(), false);
});

test('JSLNParser applies JSDoc @type tags above object members', () => {
  const [result] = new JSLNParser(`{
    /** @type {string} */
    name: "Ada",
    /** @type {number|undefined} */
    score: 42
  }`).getMember();

  assert.equal(result.name, "Ada");
  assert.equal(result.score, 42);
  assert.deepEqual(result[Symbol.for("jsln-proptypes")], {
    name: { type: "string", readonly: false },
    score: { type: ["number", "undefined"], readonly: false },
  });
});

test('JSLNParser rejects an object member that conflicts with its preceding JSDoc @type tag', () => {
  assert.throws(
    () => new JSLNParser(`{
      /** @type {number} */
      name: "Ada"
    }`).getMember(),
    /does not match JSDoc type number/,
  );
});

test('JSLNParser applies member @type tags derived from embedded @typedef declarations', () => {
  const [result] = new JSLNParser(`/**
  * @typedef {Object} EmbeddedUser
  * @prop {string} name
  */
  {
    /** @type {EmbeddedUser} */
    user: { name: "Ada" }
  }`).getMember();

  assert.equal(result.user.name, "Ada");
  assert.deepEqual(result.user.constructor[Symbol.for("jsln-typedef")], {
    name: "EmbeddedUser",
    type: "Object",
    description: "",
    props: {
      name: {
        name: "name",
        type: ["string"],
        optional: false,
        defaultValue: undefined,
        description: "",
      },
    },
  });
  assert.deepEqual(result[Symbol.for("jsln-proptypes")].user, {
    type: "EmbeddedUser",
    readonly: false,
  });
});

test('JSLNParser applies aggregate and alias @typedef types to members', () => {
  const [result] = new JSLNParser(`/**
  * @typedef {string|number} AggregateValue
  * @typedef {AggregateValue} AggregateAlias
  */
  {
    /** @type {AggregateValue} */
    direct: 42,
    /** @type {AggregateAlias} */
    alias: "Ada"
  }`).getMember();

  assert.equal(result.direct, 42);
  assert.equal(result.alias, "Ada");
  assert.deepEqual(result[Symbol.for("jsln-proptypes")], {
    direct: { type: "AggregateValue", readonly: false },
    alias: { type: "AggregateAlias", readonly: false },
  });
});

test('JSLNParser registers custom tag handlers', () => {
  JSLNParser.registerTag('double', (value) => value * 2);
  assert.equal(JSLNParser.getTagHandler('double')(21), 42);
});

test('JSLNParser built-in tag handlers convert regex dates and typed arrays', () => {
  const regex = JSLNParser.getTagHandler('re')(['a\\w+','gi']);
  assert.equal(regex instanceof RegExp, true);
  assert.equal(regex.source, 'a\\w+');
  assert.equal(regex.flags, 'gi');

  const zeroDate = JSLNParser.getTagHandler('d')(0n);
  assert.equal(zeroDate instanceof Date, true);
  assert.equal(zeroDate.getTime(), 0);

  const date = JSLNParser.getTagHandler('d')('2024-06-01T12:34:56.789Z');
  assert.equal(date instanceof Date, true);
  assert.equal(date.toISOString(), '2024-06-01T12:34:56.789Z');

  const uint8 = JSLNParser.getTagHandler('u8')([1, 2, 3]);
  assert.equal(uint8 instanceof Uint8Array, true);
  assert.deepEqual(Array.from(uint8), [1, 2, 3]);

  const uint16 = JSLNParser.getTagHandler('u16')([1, 2, 3]);
  assert.equal(uint16 instanceof Uint16Array, true);
  assert.deepEqual(Array.from(uint16), [1, 2, 3]);

  assert.throws(() => JSLNParser.getTagHandler('d')(null), /Invalid date value/);
  assert.throws(() => JSLNParser.getTagHandler('u8')('nope'), /Invalid Uint8Array value/);
});
