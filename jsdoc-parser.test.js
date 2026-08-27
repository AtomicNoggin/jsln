import test from "node:test";
import assert from "node:assert/strict";
import JSDocParser, { parseJSDoc, stringifyJSDoc } from "./jsdoc-parser.js";

test("parseJSDoc reads descriptions and @type", () => {
  const result = parseJSDoc(`/**
   * A user identifier.
   * @type {string}
   */`);

  assert.equal(result.description, "A user identifier.");
  assert.deepEqual(result.type, { type: "string", readonly: false });
  assert.equal(Object.hasOwn(result, "typedef"), false);
  assert.equal(Object.hasOwn(result, "readonly"), false);
});

test("parseJSDoc splits pipe-delimited @type and @prop types", () => {
  const result = parseJSDoc(`/**
   * @type {string|number|null}
   * @prop {string | number} value A union value.
   * @prop next?: boolean | null - Another union value.
   */`);

  assert.deepEqual(result.type, { type: ["string", "number", "null"], readonly: false });
  assert.deepEqual(result.props, [
    {
      name: "value",
      type: ["string", "number"],
      optional: false,
      defaultValue: undefined,
      description: "A union value.",
    },
    {
      name: "next",
      type: ["boolean", "null"],
      optional: true,
      defaultValue: undefined,
      description: "Another union value.",
    },
  ]);
});

test("parseJSDoc preserves quoted type members and prop defaults", () => {
  const result = parseJSDoc(`/**
   * @type {'ready'|'not|ready'}
   * @prop {'on'|'off'} [mode='on'] A mode.
   */`);

  assert.deepEqual(result.type, { type: ["'ready'", "'not|ready'"], readonly: false });
  assert.deepEqual(result.props, [
    {
      name: "mode",
      type: ["'on'", "'off'"],
      optional: true,
      defaultValue: "'on'",
      description: "A mode.",
    },
  ]);
  assert.match(JSDocParser.stringify(result), /@prop \{'on'\|'off'\} \[mode='on'\]/);
});

test("parseJSDoc preserves double quotes in types and prop defaults", () => {
  const result = parseJSDoc(`/**
   * @type {"ready"|"not|ready"}
   * @prop {"on"|"off"} [mode="on"] A mode.
   */`);

  assert.deepEqual(result.type, { type: ['"ready"', '"not|ready"'], readonly: false });
  assert.deepEqual(result.props, [
    {
      name: "mode",
      type: ['"on"', '"off"'],
      optional: true,
      defaultValue: '"on"',
      description: "A mode.",
    },
  ]);
  assert.match(JSDocParser.stringify(result), /@prop \{"on"\|"off"\} \[mode="on"\]/);
});

test("parseJSDoc reads @typedef and @prop declarations", () => {
  const result = JSDocParser.parse(`/**
   * A user record.
   * @typedef {Object} User
   * @prop {string} id The user identifier.
   * @prop {number} [age=0] The user's age.
   */`);

  assert.deepEqual(result.typedef, [{
    name: "User",
    type: "Object",
    description: "A user record.",
    props: {
      id: {
        name: "id",
        type: "string",
        optional: false,
        defaultValue: undefined,
        description: "The user identifier.",
      },
      age: {
        name: "age",
        type: "number",
        optional: true,
        defaultValue: "0",
        description: "The user's age.",
      },
    },
  }]);
  assert.equal(Object.hasOwn(result, "props"), false);
  assert.equal(result.description, "");
});

test("parseJSDoc reads Closure and TypeScript @prop syntax", () => {
  const result = parseJSDoc(`/**
   * @prop {string} name A required Closure-style property.
   * @prop {number=} count An optional Closure-style property.
   * @prop enabled: boolean - A required TypeScript-style property.
   * @prop label?: string - An optional TypeScript-style property.
   */`);

  assert.deepEqual(result.props, [
    {
      name: "name",
      type: "string",
      optional: false,
      defaultValue: undefined,
      description: "A required Closure-style property.",
    },
    {
      name: "count",
      type: "number",
      optional: true,
      defaultValue: undefined,
      description: "An optional Closure-style property.",
    },
    {
      name: "enabled",
      type: "boolean",
      optional: false,
      defaultValue: undefined,
      description: "A required TypeScript-style property.",
    },
    {
      name: "label",
      type: "string",
      optional: true,
      defaultValue: undefined,
      description: "An optional TypeScript-style property.",
    },
  ]);
});

test("parseJSDoc reads TypeScript properties embedded in @typedef", () => {
  const result = parseJSDoc(`/**
   * @typedef {{name: string; active?: boolean}} User
   */`);

  assert.deepEqual(result.typedef, [{
    name: "User",
    type: "object",
    description: "",
    props: {
      name: {
        name: "name",
        type: "string",
        optional: false,
        defaultValue: undefined,
        description: "",
      },
      active: {
        name: "active",
        type: "boolean",
        optional: true,
        defaultValue: undefined,
        description: "",
      },
    },
  }]);
  assert.equal(Object.hasOwn(result, "props"), false);
});

test("parseJSDoc reads @readonly and preserves unknown tags", () => {
  const result = parseJSDoc(`@readonly
@returns {boolean} whether it is enabled`);

  assert.equal(result.readonly, true);
  assert.deepEqual(result.unkown.returns, ["{boolean} whether it is enabled"]);
});

test("parseJSDoc associates same-line @readonly with @type and @prop", () => {
  const result = parseJSDoc(`/**
   * @readonly @type {string|number}
   * @readonly @prop {boolean} enabled Whether the value is enabled.
   */`);

  assert.equal(Object.hasOwn(result, "readonly"), false);
  assert.deepEqual(result.type, { type: ["string", "number"], readonly: true });
  assert.deepEqual(result.props, [{
    name: "enabled",
    type: "boolean",
    optional: false,
    defaultValue: undefined,
    description: "Whether the value is enabled.",
    readonly: true,
  }]);
  assert.equal(
    JSDocParser.stringify(result),
    `/**
  * @readonly @type {string|number}
  * @readonly @prop {boolean} enabled Whether the value is enabled.
  */`,
  );
});

test("parseJSDoc associates directly preceding @readonly with @type and @prop", () => {
  const result = parseJSDoc(`/**
   * @readonly
   * @type {string|number}
   * @readonly
   * @prop {boolean} enabled Whether the value is enabled.
   */`);

  assert.equal(Object.hasOwn(result, "readonly"), false);
  assert.deepEqual(result.type, { type: ["string", "number"], readonly: true });
  assert.deepEqual(result.props, [
    {
      name: "enabled",
      type: "boolean",
      optional: false,
      defaultValue: undefined,
      description: "Whether the value is enabled.",
      readonly: true,
    },
  ]);
});

test("parseJSDoc accepts raw lines and rejects non-string input", () => {
  assert.deepEqual(parseJSDoc("@type {number}").type, { type: "number", readonly: false });
  assert.throws(() => parseJSDoc(null), TypeError);
});

test("parseJSDoc supports multiple typedefs with separately associated props", () => {
  const result = parseJSDoc(`/**
   * @typedef {Object} User
   * @prop {string} name
   *
   * @typedef {Object} Account
   * @prop {number} balance
   * @prop {boolean} active
   */`);

  assert.equal(result.typedef.length, 2);
  assert.deepEqual(Object.keys(result.typedef[0].props), ["name"]);
  assert.deepEqual(Object.keys(result.typedef[1].props), ["balance", "active"]);
  assert.equal(Object.hasOwn(result, "props"), false);
});

test("parseJSDoc returns null when no JSDoc data is present", () => {
  assert.equal(parseJSDoc(""), null);
  assert.equal(parseJSDoc("/** */"), null);
  assert.equal(parseJSDoc("   \n  \t"), null);
  assert.equal(parseJSDoc("This is only descriptive text."), null);
});

test("JSDocParser.stringify converts parsed results to a JSDoc comment", () => {
  const result = parseJSDoc(`/**
   * A user record.
   * @typedef {Object} User
   * @prop {string} id The user identifier.
   * @prop {number} [age=0] The user's age.
   * @readonly
   * @returns {boolean} whether it is enabled
   */`);
  const expected = `/**
  * A user record.
  * @typedef {Object} User
  * @prop {string} id The user identifier.
  * @prop {number} [age=0] The user's age.
  * @readonly
  * @returns {boolean} whether it is enabled
  */`;

  assert.equal(JSDocParser.stringify(result), expected);
  assert.equal(stringifyJSDoc(result), expected);
  assert.deepEqual(parseJSDoc(expected), result);
});

test("JSDocParser.stringify uses inline TypeScript typedef syntax without defaults", () => {
  const result = parseJSDoc(`/**
   * A user record.
   * @typedef {{name: string; readonly active?: boolean}} User
   */`);
  const expected = `/**
  * A user record.
  * @typedef {{name: string; readonly active?: boolean}} User
  */`;

  assert.equal(JSDocParser.stringify(result), expected);
  assert.deepEqual(parseJSDoc(expected), result);
});

test("JSDocParser.stringify keeps descriptions when stringifying multiple typedefs in the same comment", () => {
  const result = parseJSDoc(`/**
   * A user record.
   * @typedef {Object} User
   * @prop {string} name
   * An account record.
   * @typedef {Object} Account
   * @prop {number} balance
   */`);
  const expected = `/**
  * A user record.
  * @typedef {Object} User
  * @prop {string} name
  *
  * An account record.
  * @typedef {Object} Account
  * @prop {number} balance
  */`;

  assert.equal(result.typedef[0].description, "A user record.");
  assert.equal(result.typedef[1].description, "An account record.");
  assert.equal(JSDocParser.stringify(result), expected);
});

test("JSDocParser.stringify indents the entire comment", () => {
  const result = parseJSDoc(`@typedef {Object} User
@prop {string} name`);
  const expected = "    /**\n      * @typedef {Object} User\n      * @prop {string} name\n      */";

  assert.equal(JSDocParser.stringify(result, 4), expected);
  assert.equal(new JSDocParser().stringify(result, 4), expected);
  assert.equal(JSDocParser.stringify(result, 1.5), " /**\n   * @typedef {Object} User\n   * @prop {string} name\n   */");
  assert.equal(JSDocParser.stringify(result, 0), "/**\n * @typedef {Object} User\n * @prop {string} name\n */");
  assert.equal(JSDocParser.stringify(result, -1), "/**\n * @typedef {Object} User\n * @prop {string} name\n */");
});

test("JSDocParser.stringify type-only comments on one line", () => {
  const result = parseJSDoc("@readonly @type {string|number}");

  assert.equal(JSDocParser.stringify(result), "/** @readonly @type {string|number} */");
  assert.equal(JSDocParser.stringify(result, 2), "  /** @readonly @type {string|number} */");
});

test("JSDocParser.stringify handles empty results and validates input", () => {
  assert.equal(JSDocParser.stringify({}), "");
  assert.throws(() => JSDocParser.stringify(null), TypeError);
});
