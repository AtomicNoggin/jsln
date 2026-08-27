import test from "node:test";
import assert from "node:assert/strict";
import JSLNStringifier, { stringify } from "./jsln-stringifier.js";
import { JSLN_SYMBOLS } from "./jsln-parser.js";

test("JSLNStringifier.stringify serializes primitive values", () => {
  assert.equal(stringify(null), "null");
  assert.equal(stringify(undefined), "undefined");
  assert.equal(stringify(true), "true");
  assert.equal(stringify(-0), "-0");
  assert.equal(stringify(NaN), "NaN");
  assert.equal(stringify(-Infinity), "-Infinity");
  assert.equal(stringify(123n), "123n");
});

test("JSLNStringifier.stringify serializes objects and sparse arrays", () => {
  const value = { answer: 42, "not an identifier": [1, , "two"] };
  assert.equal(
    JSLNStringifier.stringify(value),
    "{answer:42,'not an identifier':[1,,'two']}",
  );
});

test("JSLNStringifier.stringify escapes strings and supports indentation", () => {
  const value = { message: "line\n'quoted'" };
  assert.equal(
    JSLNStringifier.stringify(value, { spaces: 2 }),
    "{\n  message:'line\\n\\'quoted\\''\n}",
  );
  assert.equal(
    JSLNStringifier.stringify("it's", { defaultQuote: '"' }),
    '"it\'s"',
  );
});

test("JSLNStringifier.stringify emits extended type tags", () => {
  assert.equal(JSLNStringifier.stringify(/a+/gi), "/a+/gi");
  assert.equal(
    JSLNStringifier.stringify(/a+/gi, { regexpFormat: "tag" }),
    "re@['a+','gi']",
  );
  assert.equal(JSLNStringifier.stringify(new Date(0)), "d@'1970-01-01T00:00:00.000Z'");
  assert.equal(JSLNStringifier.stringify(new Map([["a", 1]])), "map@[['a',1]]");
  assert.equal(JSLNStringifier.stringify(new Set([1, 2])), "set@[1,2]");
  assert.equal(JSLNStringifier.stringify(new Uint8Array([1, 2])), "u8@[1,2]");
});

test("JSLNStringifier.stringify emits JSDoc for typedef and property type metadata", () => {
  const typedef = {
    name: "User",
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
  };
  class User {
    static [JSLN_SYMBOLS.typedef] = typedef;

    constructor(name) {
      this.name = name;
    }
  }
  const value = { user: new User("Ada") };
  value[JSLN_SYMBOLS.proptypes] = {
    user: { type: "User", readonly: false },
  };

  assert.equal(
    stringify(value, { spaces: 2 }),
    `/**
 * @typedef {Object} User
 * @prop {string} name
 */
{
  /** @type {User} */
  user:{
    name:'Ada'
  }
}`,
  );
});

test("JSLNStringifier.stringify hoists multiple typedefs into one JSDoc comment", () => {
  const makeTypedValue = (name, property) => {
    class TypedValue {
      static [JSLN_SYMBOLS.typedef] = {
        name,
        type: "Object",
        description: "",
        props: {},
      };
    }
    return Object.assign(new TypedValue(), { [property]: name });
  };
  const value = {
    user: makeTypedValue("User", "name"),
    account: makeTypedValue("Account", "id"),
  };

  assert.equal(
    stringify(value),
    `/**
 * @typedef {Object} User
 *
 * @typedef {Object} Account
 */
{user:{name:'User'},account:{id:'Account'}}`,
  );
});

test("JSLNStringifier.stringify applies a replacer", () => {
  assert.equal(
    JSLNStringifier.stringify({ value: 2 }, (key, value) =>
      key === "value" ? value * 3 : value,
    ),
    "{value:6}",
  );
});

test("JSLNStringifier.stringify rejects unsupported and circular values", () => {
  assert.throws(() => JSLNStringifier.stringify(Symbol("value")), TypeError);
  const value = {};
  value.self = value;
  assert.throws(() => JSLNStringifier.stringify(value), /circular structure/);
  assert.throws(() => JSLNStringifier.stringify(new Date(NaN)), /invalid Date/);
});
