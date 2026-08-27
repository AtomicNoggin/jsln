import { JSLN_SYMBOLS } from "./jsln-parser.js";
import { stringifyJSDoc } from "./jsdoc-parser.js";

const IDENTIFIER = /^[$_\p{ID_Start}][$\p{ID_Continue}]*$/u;

const TAGS = new Map([
  [RegExp, "re"],
  [Date, "d"],
  [Map, "map"],
  [Set, "set"],
  [Uint8ClampedArray, "c8"],
  [Uint8Array, "u8"],
  [Uint16Array, "u16"],
  [Uint32Array, "u32"],
  [BigUint64Array, "u64"],
  [Int8Array, "i8"],
  [Int16Array, "i16"],
  [Int32Array, "i32"],
  [BigInt64Array, "i64"],
  [Float16Array, "f16"],
  [Float32Array, "f32"],
  [Float64Array, "f64"],
]);

const DEFAULT_OPTIONS = {
  mode: "extended",
  spaces: 0,
  defaultQuote: "'",
  regexpFormat: "literal",
  ignoreUndefined: false,
  ignoreNull: false,
  failOnUnknown: true,
};

export default class JSLNStringifier {
  static stringify(value, replacer = null, options = {}) {
    if (typeof replacer === "object" && replacer !== null) {
      options = replacer;
      replacer = options.replacer ?? null;
    }
    return new JSLNStringifier(options).stringify(value, replacer);
  }

  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...Object(options) };
    if (!["'", '"'].includes(this.options.defaultQuote)) {
      throw new TypeError("defaultQuote must be either ' or \"");
    }
    this.indent = Number(this.options.spaces);
    if (!Number.isInteger(this.indent) || this.indent < 0) {
      throw new TypeError("spaces must be a non-negative integer");
    }
  }

  stringify(value, replacer = null) {
    if (replacer !== null && typeof replacer !== "function") {
      throw new TypeError("replacer must be a function or null");
    }
    const typedefs = new Map();
    const result = this.#stringify(value, "", replacer, new Set(), typedefs);
    const jsdoc = stringifyJSDoc({ typedef: [...typedefs.values()] });
    return jsdoc ? `${jsdoc}\n${result}` : result;
  }

  #stringify(value, key, replacer, ancestors, typedefs) {
    if (replacer) value = replacer(key, value);

    if (value === undefined) {
      if (this.options.ignoreUndefined) return "";
      return "undefined";
    }
    if (value === null) {
      if (this.options.ignoreNull) return "";
      return "null";
    }

    switch (typeof value) {
      case "boolean":
        return String(value);
      case "number":
        if (Number.isNaN(value)) return "NaN";
        if (value === Infinity) return "Infinity";
        if (value === -Infinity) return "-Infinity";
        if (Object.is(value, -0)) return "-0";
        return String(value);
      case "bigint":
        return `${value}n`;
      case "string":
        return this.#quote(value);
      case "function":
      case "symbol":
        return this.#unknown(value);
      default: // object
        if (value instanceof RegExp && this.options.regexpFormat === "literal") {
          return value.toString();
        }
        const tag = this.#taggedValue(value);
        if (tag) {
          return `${tag[0]}@${this.#stringify(tag[1], key, replacer, ancestors, typedefs)}`;
        }
        if (ancestors.has(value)) {
          throw new TypeError("cannot stringify circular structure");
        }
        ancestors.add(value);
        let result;
        if (Array.isArray(value)) {
          result = this.#array(value, replacer, ancestors, typedefs);
        } else if (
          Object.getPrototypeOf(value) === Object.prototype ||
          Object.getPrototypeOf(value) === null ||
          value.constructor?.[JSLN_SYMBOLS.typedef]
        ) {
          result = this.#object(value, replacer, ancestors, typedefs);
        } else {
          result = this.#unknown(value);
        }
        ancestors.delete(value);
        const typedef = value.constructor?.[JSLN_SYMBOLS.typedef];
        if (typedef) typedefs.set(typedef.name, typedef);
        return result;
    }
  }

  #taggedValue(value) {
    for (const [constructor, tag] of TAGS) {
      if (!(value instanceof constructor)) continue;
      let inner = value;
      if (value instanceof RegExp) inner = [value.source, value.flags];
      else if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) throw new RangeError("cannot stringify invalid Date");
        inner = value.toISOString();
      } else if (value instanceof Map) inner = Array.from(value.entries());
      else if (value instanceof Set) inner = Array.from(value);
      else inner = Array.from(value);
      return [tag, inner];
    }
    return null;
  }

  #array(value, replacer, ancestors, typedefs) {
    const entries = [];
    for (let index = 0; index < value.length; index++) {
      if (!(index in value)) {
        entries.push("");
        continue;
      }
      const literal = this.#stringify(
        value[index],
        String(index),
        replacer,
        ancestors,
        typedefs,
      );
      entries.push(literal || "undefined");
    }
    return this.#collection("[", "]", entries);
  }

  #object(value, replacer, ancestors, typedefs) {
    const entries = [];
    const proptypes = value[JSLN_SYMBOLS.proptypes];
    for (const key of Object.keys(value)) {
      const literal = this.#stringify(value[key], key, replacer, ancestors, typedefs);
      if (!literal) continue;
      const type = proptypes?.[key];
      const jsdoc = type ? `${stringifyJSDoc({ type })}\n` : "";
      entries.push(
        `${jsdoc}${IDENTIFIER.test(key) ? key : this.#quote(key)}:${literal}`,
      );
    }
    return this.#collection("{", "}", entries);
  }

  #collection(open, close, entries) {
    if (entries.length === 0) return `${open}${close}`;
    if (this.indent === 0) return `${open}${entries.join(",")}${close}`;
    const padding = " ".repeat(this.indent);
    const indentEntry = (entry) =>
      entry
        .split("\n")
        .map((line) => `${padding}${line}`)
        .join("\n");
    return `${open}\n${entries.map(indentEntry).join(",\n")}\n${close}`;
  }

  #quote(value) {
    const quote = this.options.defaultQuote;
    const escaped = value.replace(/[\\\n\r\t\b\f\v\0'"\u2028\u2029]/g, (character) => {
      switch (character) {
        case "\\": return "\\\\";
        case "\n": return "\\n";
        case "\r": return "\\r";
        case "\t": return "\\t";
        case "\b": return "\\b";
        case "\f": return "\\f";
        case "\v": return "\\v";
        case "\0": return "\\0";
        case "\u2028": return "\\u2028";
        case "\u2029": return "\\u2029";
        default: return character === quote ? `\\${character}` : character;
      }
    });
    return `${quote}${escaped}${quote}`;
  }

  #unknown(value) {
    if (this.options.failOnUnknown) {
      throw new TypeError(`could not stringify ${Object.prototype.toString.call(value)}`);
    }
    return "undefined";
  }
}

export const stringify = JSLNStringifier.stringify;
