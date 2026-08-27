# JSLN

JSLN (JavaScript Literal Notation pronounced JOS-LIN, or Joseline) is a JavaScript-literal data format parsed by this package's `JSLNParser`. It supports JSON-like objects and arrays, JavaScript primitives and numeric literals, comments, quoted and multiline strings, typed `@` values, and JSDoc type metadata.

```js
import JSLN from "jsln";

const value = JSLN.parse(`{
  name: 'Ada',
  active: true,
  scores: [10, , 30],
}`);

JSLN.stringify(value);
// {name:'Ada',active:true,scores:[10,,30]}
```

## API

### `JSLN.parse(input, options)`

Parses one complete JSLN member and returns its value. Trailing input throws a `SyntaxError`.

`options.strictMode` defaults to `false`. In strict mode, comments, backtick strings, and escaped line terminators in strings are rejected.

### `JSLN.stringify(value, replacer, options)`

Returns a JSLN string. `replacer(key, value)` can transform values before serialization.

| Option | Default | Description |
| --- | --- | --- |
| `spaces` | `0` | Indentation width. |
| `defaultQuote` | `'` | Quote used for strings: `'` or `"`. |
| `regexpFormat` | `"literal"` | Use `"literal"` for `/pattern/flags` or `"tag"` for `re@['pattern','flags']`. |
| `ignoreUndefined` | `false` | Omit undefined object values. |
| `ignoreNull` | `false` | Omit null object values. |
| `failOnUnknown` | `true` | Throw for objects that are not supported built-ins, plain objects, arrays, or typedef-tagged objects. |

## Values

### Objects and Arrays

Objects use identifier, single-quoted, or double-quoted keys. Arrays may contain missing entries.

```js
{
  unquotedKey: 'value',
  'quoted key': [1, , 3],
  nested: { enabled: true },
}
```

### Primitives

```js
null
undefined
true
false
NaN
Infinity
-Infinity
'text'
"text"
123
-4.5
.125
1.2e3
0xff
0o10
0b10
123n
/a\\w+/gi
```

Numbers support decimal, hexadecimal (`0x`), octal (`0o`), and binary (`0b`) notation. Numeric separators (`_`) are accepted between digits. Add `n` to produce a `BigInt`.

Regular expressions use JavaScript literal syntax: `/pattern/flags`. Supported flags are `d`, `g`, `i`, `m`, `s`, `u`, `v`, and `y`.

Single- and double-quoted strings support JavaScript-style escapes, including `\n`, `\t`, `\xNN`, `\uNNNN`, and `\u{N...}`. Adjacent strings can be joined with `+`:

```js
'first ' + "second"
```

In non-strict mode, backticks create multiline strings:

```js
`first line
second line`
```

### Comments

Non-strict parsing accepts JavaScript single-line and block comments wherever whitespace is accepted.

```js
{
  // explanatory note
  name: 'Ada',
  /* another note */
  active: true,
}
```

## Tagged Values

A tag has the form `tag@value`. The parser includes the following built-in tags:

| Tag | Value form | Result |
| --- | --- | --- |
| `re` | `[pattern, flags]` | `RegExp` |
| `d` | ISO date-time string, `number` (representing epoch milliseconds) or `Bigint` (representing epoch nanoseconds) | `Date` |
| `map` | Array of `[key, value]` entries | `Map` |
| `set` | Array of values | `Set` |
| `c8` | Array or `BigInt` | `Uint8ClampedArray` |
| `u8` | Array or `BigInt` | `Uint8Array` |
| `u16`, `u32`, `u64` | Array | Unsigned typed array |
| `i8`, `i16`, `i32`, `i64` | Array | Signed typed array |
| `f16`, `f32`, `f64` | Array | Floating-point typed array |

```js
{
  pattern: re@['a\\w+', 'gi'],
  created: d@'2024-06-01T12:34:56.789Z',
  tags: set@['jsln', 'data'],
  bytes: u8@[1, 2, 3],
}
```

Custom tags can be registered with `JSLNParser.registerTag(name, handler)`. A tag name must be a valid JavaScript identifier and cannot be a reserved literal keyword.

## JSDoc Types and Typedefs

A JSDoc `@type` comment immediately above an object member validates that value and records its type metadata. The parser accepts single types and pipe-delimited unions.

`@type` accepts the following values. Combine alternatives with `|`, such as `{string|number}`.

| Type value | Matches |
| --- | --- |
| `any`, `*`, `?` | Any value. |
| `array`, `Array` | Any array. |
| `object`, `Object` | Any value except `undefined` and arrays. |
| `undefined`, `null` | The corresponding primitive value. |
| `boolean`, `Boolean` | Any boolean. |
| `string`, `String` | Any string. |
| `number`, `Number`, `float` | Any number except `NaN`. |
| `bigint`, `BigInt` | Any `BigInt`. |
| `int` | A finite integer. |
| `uint` | A finite, non-negative integer. |
| `true`, `false`, `Infinity`, `-Infinity`, `NaN` | The corresponding exact value. |
| Numeric literal, such as `42` or `-1.5` | That exact number. |
| BigInt literal, such as `42n` | That exact `BigInt`. |
| Quoted literal, such as `'ready'` or `"off"` | That exact string. |
| Registered tag or typedef name | A value accepted or revived by that tag's handler. |

```js
{
  /** @type {string} */
  name: 'Ada',
  /** @type {number|undefined} */
  score: 42,
}
```

An embedded `@typedef` registers a type reviver. A following member annotated with that type is validated and converted to an instance of the generated class.

```js
/**
 * @typedef {Object} User
 * @prop {string} name
 */
{
  /** @type {User} */
  user: { name: 'Ada' },
}
```

Typedefs can also describe unions and aliases:

```js
/**
 * @typedef {string|number} Identifier
 * @typedef {Identifier} AccountId
 */
{
  /** @type {AccountId} */
  id: 42,
}
```

When serializing typedef-tagged instances, JSLN hoists their typedef declarations into a top-level JSDoc block and emits property `@type` comments where `jsln-proptypes` metadata is present.

## Parser Classes

The lower-level modules remain available for incremental parsing and custom tag handling:

```js
import JSLNParser, { JSLN_SYMBOLS, typeRevivers } from "./jsln-parser.js";
import JSLNStringifier from "./jsln-stringifier.js";

const parser = new JSLNParser("{answer:42}");
const [value] = parser.getMember();
```

Run the test suite with:

```sh
npm test
```
