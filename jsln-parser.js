import Parser from "./parser.js";
import JSDocParser from "./jsdoc-parser.js";

export const JSLN_SYMBOLS = Object.freeze({
  typedef: Symbol.for("jsln-typedef"),
  proptypes: Symbol.for("jsln-proptypes"),
});

export const typeRevivers = (() => {
    let copy = "";
    return {
      re: (copy = (value) => {
        if (value instanceof RegExp) return value;
        if (!Array.isArray(value)) {
          throw new Error(`Invalid regex value: ${JSON.stringify(value)}`);
        }
        const [pattern, flags] = value;
        return new RegExp(pattern, flags);
      }),
      RegExp: copy,
      map: (copy = (value) => {
        if (value instanceof Map) return value;
        if (!Array.isArray(value)) {
          throw new Error(`Invalid Map value: ${JSON.stringify(value)}`);
        }
        return new Map(value);
      }),
      Map: copy,
      set: (copy = (value) => {
        if (value instanceof Set) return value;
        if (!Array.isArray(value)) {
          throw new Error(`Invalid Map value: ${JSON.stringify(value)}`);
        }
        return new Set(value);
      }),
      Set: copy,
      d: (copy = (value) => {
        if (value instanceof Date) return value;
        if (!["string", "number", "bigint"].includes(typeof value)) {
          throw new Error(`Invalid date value: ${JSON.stringify(value)}`);
        } else if (typeof value === "bigint") {
          value = Number(value / 1000000n);
        } else if (
          typeof value === "string" &&
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
            value,
          )
        ) {
          throw new Error(`Invalid date value: ${JSON.stringify(value)}`);
        }
        return new Date(value);
      }),
      Date: copy,
      c8: (copy = (value) => {
        if (value instanceof Uint8ClampedArray) return value;
        if (!Array.isArray(value) && typeof value !== "bigint") {
          throw new Error(
            `Invalid Uint8ClampedArray value: ${JSON.stringify(value)}`,
          );
        } else if (typeof value === "bigint") {
          let bytes = BigInt(value);
          value = [];
          do {
            value.push(Number(bytes & 255n));
          } while ((bytes >>= 8n));
          value = value.reverse();
        }
        return new Uint8ClampedArray(value);
      }),
      Uint8ClampedArray: copy,
      u8: (copy = (value) => {
        if (value instanceof Uint8Array) return value;
        if (!Array.isArray(value) && typeof value !== "bigint") {
          throw new Error(`Invalid Uint8Array value: ${JSON.stringify(value)}`);
        } else if (typeof value === "bigint") {
          let bytes = BigInt(value);
          value = [];
          do {
            value.push(Number(bytes & 255n));
          } while ((bytes >>= 8n));
          value = value.reverse();
        }
        return new Uint8Array(value);
      }),
      Uint8Array: copy,
      u16: (copy = (value) => {
        if (value instanceof Uint16Array) return value;
        if (!Array.isArray(value)) {
          throw new Error(
            `Invalid Uint16Array value: ${JSON.stringify(value)}`,
          );
        }
        return new Uint16Array(value);
      }),
      Uint16Array: copy,
      u32: (value) => {
        if (value instanceof Uint32Array) return value;
        if (!Array.isArray(value)) {
          throw new Error(
            `Invalid Uint32Array value: ${JSON.stringify(value)}`,
          );
        }
        return new Uint32Array(value);
      },

      u64: (copy = (value) => {
        if (value instanceof BigUint64Array) return value;
        if (!Array.isArray(value)) {
          throw new Error(
            `Invalid BigUint64Array value: ${JSON.stringify(value)}`,
          );
        }
        return new BigUint64Array(value);
      }),
      BigUint64Array: copy,
      i8: (copy = (value) => {
        if (value instanceof Int8Array) return value;
        if (!Array.isArray(value)) {
          throw new Error(`Invalid Int8Array value: ${JSON.stringify(value)}`);
        }
        return new Int8Array(value);
      }),
      Int8Array: copy,
      i16: (copy = (value) => {
        if (value instanceof Int16Array) return value;
        if (!Array.isArray(value)) {
          throw new Error(`Invalid Int16Array value: ${JSON.stringify(value)}`);
        }
        return new Int16Array(value);
      }),
      Int16Array: copy,
      i32: (copy = (value) => {
        if (value instanceof Int32Array) return value;
        if (!Array.isArray(value)) {
          throw new Error(`Invalid Int32Array value: ${JSON.stringify(value)}`);
        }
        return new Int32Array(value);
      }),
      Int32Array: copy,
      i64: (copy = (value) => {
        if (value instanceof BigInt64Array) return value;
        if (!Array.isArray(value)) {
          throw new Error(
            `Invalid BigInt64Array value: ${JSON.stringify(value)}`,
          );
        }
        return new BigInt64Array(value);
      }),
      BigInt64Array:copy,
      f16: (copy = (value) => {
        if (value instanceof Float16Array) return value;
        if (!Array.isArray(value)) {
          throw new Error(
            `Invalid Float16Array value: ${JSON.stringify(value)}`,
          );
        }
        return new Float16Array(value);
      }),
      Float16Array: copy,
      f32: (copy = (value) => {
        if (value instanceof Float32Array) return value;
        if (!Array.isArray(value)) {
          throw new Error(
            `Invalid Float32Array value: ${JSON.stringify(value)}`,
          );
        }
        return new Float32Array(value);
      }),
      Float32Array:copy,
      f64: (copy = (value) => {
        if (value instanceof Float64Array) return value;
        if (!Array.isArray(value)) {
          throw new Error(
            `Invalid Float64Array value: ${JSON.stringify(value)}`,
          );
        }
        return new Float64Array(value);
      }),
      Float64Array: copy
    };
  })();

function checkType(typename, value) {
  switch (typename) {
    case "any":
    case "*":
    case "?":
      return true;
    case "array":
    case "Array":
      return Array.isArray(value);
    case "object":
    case "Object":
      return value !== undefined && !(Array.isArray(value)) && true;
    case "undefined":
      return value === undefined;
    case "null":
      return value === null;
    case "true":
      return value === true;
    case "false":
      return value === false;
    case "Infinity":
      return value === Infinity;
    case "-Infinity":
      return value === -Infinity;
    case "NaN":
      return Number.isNaN(value);
    case "string":
    case "String":
    case "boolean":
    case "Boolean":
    case "bigint":
    case "BigInt":
      return typeof value === typename.toLowerCase();
    case "number":
    case "Number":
    case "float":
      return typeof value === "number" && !Number.isNaN(value);
    case "int":
      return (
        value === Math.floor(value) &&
        !(value === Infinity || value === -Infinity || Number.isNaN(value))
      );
    case "uint":
      return (
        value === Math.abs(Math.floor(value)) &&
        !(value === Infinity || Number.isNaN(value))
      );
    default:
      if (typename.match(/^(['"])(?:\\.|(?!\1)[^\\\r\n])*\1$/)) {
        return value === typename.slice(1,-1);
      }
      else if (typename.endsWith('n') && BigInt(typename.slice(0,-1)) === BigInt(typename.slice(0,-1))) {
        return value === BigInt(typename.slice(0,-1));

      }
      else if (Number(typename) === Number(typename)) {
        return value === Number(typename);
      }
      return false;
  }
}
function typedefToClass(typedef, options = {}) {
  const { name: className, type: classType, props: typedefProps } = typedef;
  const typedefEntries = Object.entries(typedefProps);
  const internalValues = Symbol("internalValues");
  if (!className) {
    console.warn(`typedef missing name, ignoring`);
    return;
  }
  if (Array.isArray(classType)) {
    const reviver = (value) => {
      let istype = false;
      for (const type of classType) {
        if(checkType(type,value)) {
          istype = true;
          break;
        }
        else if (typeRevivers[type]) {
          try {
            value = typeRevivers[type](value);
            istype = true;
            break;
          }
          catch (e) {
            // fail silently, in case it's another type
          }
        }        
      }
      if (!istype) {
        throw new TypeError(
          `${JSON.stringify(value)} is not one of the following types ${classType.join(", ")}`,
        );
      }
      return value;
    }
    typeRevivers[className] = reviver;
    return;
  }
  else if (classType.toLowerCase() !== 'object' && !(typedefEntries.length)) {
    if (typeRevivers[classType]) {
      typeRevivers[className] = typeRevivers[classType];
    }
    else {
      console.warn(`unknown base class ${classType} in typedef ${className}, ignoring`);
    }
    return;
  }
  const clazz = {
    [className]: class {

      static [Symbol.for("jsln-typedef")] = typedef;
      constructor(initiator = {}) {
        let inConstructor = true;
        this[internalValues] = {}
        // defining properties directly in constructor, so they get picked up by Object.getOwn() 
        for (const [propName, details] of typedefEntries) {
          if (!Array.isArray(details.type)) {
                details.type = [details.type]                
          }
          if (details.defaultValue !== undefined) {
            details.defaultValue = new JSLNParser(details.defaultValue).getMember()[0];
          }
          Object.defineProperty(clazz.prototype, propName, {
            get() {
              return this[internalValues][propName] === undefined
                ? details.defaultValue
                : this[internalValues][propName];
            },
            set(value) {
              if (details.readonly && !inConstructor) {
                throw new TypeError(`'${propName}' is read-only`);
              }
              else if (details.defaultValue === value) {
                delete this[internalValues][propName];
              }
              else {
                let istype = false;
                for (const type of details.type) {
                  if(checkType(type,value)) {
                    istype = true;
                    break;
                  }
                  else if (typeRevivers[type]) {
                    try {
                      value = typeRevivers[type](value);
                      istype = true;
                      break;
                    }
                    catch (e) {
                      // fail silently, in case it's another type
                    }
                  }
                }
                if (!istype) {
                  throw new TypeError(`${className}.${propName} must be ${details.type > 1 ? 'one of '+ details.type.join(', '): 'of type ' + details.type[0]} `);
                }
                else {
                  this[internalValues][propName] = value;
                }
              }
            },
            enumerable: true,
          });
        }
        const allProps = new Set(
          Object.keys(initiator).concat(Object.keys(typedefProps)),
        );
        for (const [propName,detail] of typedefEntries) {
          if (!detail.optional && !Object.hasOwn(initiator,propName)) {
            throw new RangeError(`missing required property '${propName}' from ${className} intiator`);
          }
          else if (Object.hasOwn(initiator,propName)){
            this[propName] = initiator[propName];
            allProps.delete(propName);
          }
        }
        for (const remaining of allProps) {
          console.warn(`unxpected property '${remaining}' found in ${className} iniator`)

        }
        const proptypes = Symbol.for('jsln-proptypes');
        if (Object.hasOwn(initiator,proptypes)) {
          this[proptypes] = initiator[proptypes];
        }
        inConstructor = false;
      }
    },
  }[className];
  typeRevivers[className] = (value) => {
    if (value instanceof clazz) return value;
    if (typeof value !== "object" || value === null) {
      throw new TypeError(
        `${JSON.stringify(value)} is not of type ${className}`,
      );
    }
    const instance = new clazz(value);
    return instance;
  };
  return clazz;
} 


/**
 * Lightweight JSLN parser helpers built on top of the `Parser` primitive.
 */
export default class JSLNParser extends Parser {
  static get KEYWORDS() {
    return ["true", "false", "null", "undefined", "NaN", "Infinity"];
  }
  static registerTag(tag, handler) {
    tag = "" + tag;
    const check = tag.toLowerCase();
    if (JSLNParser.KEYWORDS.includes(tag)) {
      throw new SyntaxError(`'${tag}' is a reserved identifier`);
    } else if (!tag.match(/^[$_\p{ID_Start}][$\p{ID_Continue}]*$/u)) {
      throw new SyntaxError(`'${tag}' is not a valid identifier format`);
    }
    typeRevivers[tag] = handler;
  }
  static getTagHandler(tag) {
    return (
      typeRevivers[tag] ||
      ((value) => {
        throw new ReferenceError(`No handler registered for tag '${tag}'`);
      })
    );
  }
  strictMode = false;
  ignoreMissing = "inArray";
  ignoreUndefined = false;
  ignoreNull = false;

  constructor(input, options = {}) {
    const settings = { strictMode: false, ...Object(options) };
    super(input);
    this.strictMode = !!settings.strictMode;
  }
  /**
   * Consume and return the body of a single-line comment (up to and including newline).
   * @returns {string}
   */
  getSlineCommentBody() {
    const [found] = this.getUntilMatching("\n");
    return found + "\n";
  }
  /**
   * Consume and return the body of a multi-line comment, including the closing '* /'.
   * @param {boolean} [allowMissingEnd=false]
   * @returns {string}
   */
  getMlineCommentBody() {
    let result = "";
    let [found, stop] = this.getUntilMatching("*");
    while (this.hasRemaining()) {
      if (stop === "*") {
        if (this.readNext() === "/") {
          this.getNext();
          const comment = result + found + "*/";
          const jsdoc = JSDocParser.parse(comment);
          if (jsdoc?.typedef?.length) {
            for (const typedef of jsdoc.typedef) {
              typedefToClass(typedef);
            }
          }
          return comment;
        }
      }
      result += found + (stop || "");
      [found, stop] = this.getUntilMatching("*");
    }
    this.throw(
      `unexpected end of file, expecting '*/' to close multi-line comment`,
    );
  }
  /**
   * Consume leading whitespace and any leading comments. Returns an array of
   * comment chunks (each includes its leading marker, e.g. //... (single line)
   * or a block comment like / * ... * / ).
   * In strict mode this throws if any comment is encountered.
   * @param {boolean} [strictMode=this.strictMode]
   * @returns {string[]} consumed comment chunks
   */
  getWSorComments(strictMode = this.strictMode) {
    const out = [];
    // consume initial whitespace
    this.getWS();
    let init = this.getNextIf("/");
    if (strictMode && init) {
      this.throw(`unexpected comment in strict mode`);
    }
    while (init) {
      // assemble the two-char prefix
      const next = this.getNext();
      init += next;
      if (init === "//") {
        const body = this.getSlineCommentBody();
        out.push(init + body);
      } else if (init === "/*") {
        const body = this.getMlineCommentBody();
        out.push(init + body);
      } else {
        this.throw(`unexpected character '${init[1]}'`);
      }
      this.getWS();
      init = this.getNextIf("/");
    }
    return out;
  }

  /**
   * Read an identifier token.
   * @param {boolean} [asKeywordOrTag=false]
   * @returns {string}
   */
  getIdent(asKeywordOrTag = false) {
    let out = "";
    const first = this.getNextIf("$_\\p{ID_Start}", 1, "u");
    if (!first) return "";
    out += first;
    out += this.getWhileMatching("$\\p{ID_Continue}", "u");
    if (asKeywordOrTag) {
      // if the identifier is a tag, keep it
      if (this.readNext() === "@") {
        this.getNext();
        if (JSLNParser.KEYWORDS.includes(out)) {
          this.throw(`unexpected character '@' after keyword ${out}`);
        }
      }
      // if the identifier is not a keyword, throw an error
      else if (!JSLNParser.KEYWORDS.includes(out)) {
        this.throw(`unexpected keyword ${out}`);
      }
    }
    return out;
  }

  /**
   * Decode an escape char (the escape char itself is consumed).
   * @param {boolean} [strictMode=this.strictMode]
   * @returns {string}
   */
  getStringEscapeChar(strictMode = this.strictMode) {
    const ch = this.getNext();
    switch (ch) {
      case "0":
        return String.fromCharCode(0);
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      case "b":
        return "\b";
      case "v":
        return "\v";
      case "f":
        return "\f";
      case "x": {
        const hex = this.getNextIf("0-9a-f", 2, "i");
        if (!hex) {
          const bad = this.getNext();
          this.throw(
            `string escape sequence token '${bad}', expected one of 0-9a-f after '\\x`,
          );
        }
        return String.fromCharCode(Number("0x" + hex));
      }
      case "u": {
        const next = this.getNextIf("0-9a-f{", 1, "i");
        if (next === "{") {
          // variable length codepoint
          const code = this.getNextIf("0-9a-f", "1,6", "i");
          if (!code || this.readNext() !== "}") {
            const bad = this.getNext();
            this.throw(
              `unexpected unicode escape sequence token '${bad}', expected one of 0-9a-f within '\\u{'`,
            );
          }
          // consume closing brace
          this.getNext();
          return String.fromCodePoint(Number("0x" + code));
        }
        // fixed length \uXXXX
        const chs = this.getNextIf("0-9a-f", 3, "i");
        if (!chs) {
          const bad = this.getNext();
          this.throw(
            `unexpected unicode escape sequence token '${bad}', expected one of 0-9a-f after '\\u'`,
          );
        }
        return String.fromCharCode(Number("0x" + (next + chs)));
      }
      case "\r":
        if (this.readNext() === "\n") this.getNext();
      case "\n":
      case "\u2028":
      case "\u2029":
        if (strictMode && ["\n", "\r", "\u2028", "\u2029"].includes(ch)) {
          this.throw(
            `string escape sequence token cannot be a line terminator in strict mode`,
          );
        }
        return "";
      default:
        return ch;
    }
  }

  /**
   * Read a single- or double-quoted string.
   * @param {boolean} [strictMode=this.strictMode]
   * @returns {string}
   */
  getSinglelineString(strictMode = this.strictMode) {
    const quot = this.getNextIf(`'\"`);
    if (!quot) return "";
    let out = "";
    let rest, stop;
    while (this.hasRemaining()) {
      [rest, stop] = this.getUntilMatching(quot + "\\\\\n\\r\\u2028\\u2029");
      out += rest;
      if (["\n", "\r", "\u2028", "\u2029"].includes(stop)) {
        this.throw(`unexpected line terminator in single line string`);
      }
      if (stop === "\\") {
        out += this.getStringEscapeChar(strictMode);
      } else if (stop === quot) {
        break;
      }
    }
    if (!this.hasRemaining() && rest === "" && stop !== quot) {
      this.throw(
        `unexpected end of file, expecting ${quot === '"' ? "'\"'" : '"\'"'}`,
      );
    }
    return out;
  }

  /**
   * Consumes a multiline string bounded by backticks.
   * @returns {string} The decoded string contents.
   */
  getMultilineString() {
    const quot = this.getNextIf("`");
    if (!quot) return "";
    let out = "";
    while (this.hasRemaining()) {
      const ch = this.getNext();
      if (ch === "\\") {
        out += this.getStringEscapeChar();
        continue;
      }
      if (ch === "`") break;
      out += ch;
    }
    return out;
  }

  /**
   * Parse a string literal possibly concatenated with `+`.
   * @param {boolean} [strictMode=this.strictMode]
   * @returns {[string,string[]]}
   */
  getString(strictMode = this.strictMode) {
    let result = "";
    let inner = [];
    let found = this.getSinglelineString(strictMode);
    if (!strictMode && !found) found = this.getMultilineString();
    while (found) {
      result += found;
      inner = inner.concat(this.getWSorComments(strictMode));
      if (this.getNextIf("+")) {
        // skip any comments
        const comments = this.getWSorComments(strictMode);
        if (strictMode && comments.length) inner = inner.concat(comments);
        found = this.getSinglelineString(strictMode);
        if (!strictMode && !found) found = this.getMultilineString();
      } else {
        break;
      }
    }
    return [result, inner];
  }

  /**
   * Parse a RegExp literal like `/pattern/flags` and return [pattern, flags].
   * @returns {[string,string]}
   */
  getRegExp() {
    if (!this.getNextIf("/")) return ["", ""];
    let pattern = "";
    let inClass = false;
    while (this.hasRemaining()) {
      const ch = this.getNext();
      if (ch === "\\") {
        // escape + next
        pattern += ch + this.getNext();
        continue;
      }
      if (ch === "[") {
        inClass = true;
        pattern += ch;
        continue;
      }
      if (ch === "]") {
        inClass = false;
        pattern += ch;
        continue;
      }
      if (ch === "/" && !inClass) {
        break;
      }
      if (ch === "\n") this.throw("unexpected new line");
      pattern += ch;
    }
    const flags = this.getWhileMatching("dgimsuvy");
    return [pattern, flags];
  }

  /**
   * Consume digits potentially grouped with underscores and return cleaned digits.
   * @param {string} [digits="0-9"]
   * @param {string} [flag=""]
   * @returns {string}
   */
  getNextDigits(digits = "0-9", flag = "") {
    let result = this.getNextIf("_") || "";
    let found = this.getWhileMatching(digits, flag);
    while (found) {
      result += found;
      found = "";
      const next = this.getNextIf("_");
      if (next) {
        result += next;
        found = this.getWhileMatching(digits, flag);
      }
    }
    if (result.endsWith("_")) {
      const bad = this.getNext();
      this.throw(
        `unexpected token '${bad}' after group marker '_', expecting one of ${digits}`,
      );
    }
    return result.replaceAll("_", "");
  }

  /**
   * Parse a numeric literal. Returns Number, BigInt, Infinity, or NaN, or '' if no number.
   * @returns {number|bigint|string}
   */
  getNumber() {
    let result = "",
      sign = "",
      digits = "0-9",
      flag = "",
      next = "",
      start = this.getNextIf(".0-9IN+-");
    // if no leading digit or sign, return empty string
    if (start == "") return "";
    if (["+", "-"].includes(start)) {
      sign = start;
      start = this.getNextIf(".0-9IN");
    } else if (start === "N") {
      // is it NaN?
      result += start + this.getIdent();
      if (result !== "NaN") {
        this.throw(`unknown keyword value '${result}'`);
      }
      next = "";
    }
    if (start === "I") {
      result += start;
      // is it Infinity or -Infinity?
      result += this.getIdent();
      if (result !== "Infinity") {
        this.throw(`unknown keyword value '${result}'`);
      }
      result = sign + result;
      next = "";
    } else if (
      start === "0" &&
      ["x", "o", "b"].includes(this.readNext().toLowerCase())
    ) {
      // is it a hex, oct, or bin integer
      next = this.getNext().toLocaleLowerCase();
      switch (next) {
        case "x":
          digits = "0-9a-f";
          flag = "i";
          break;
        case "o":
          digits = "0-7";
          break;
        case "b":
          digits = "01";
          break;
      }
      result += sign + start + next;
      // ensure a leading single digit first, since getNextDigits allows leading '_' group marker
      next = this.getNextIf(digits, 1, flag);
      if (next) {
        result += next + this.getNextDigits(digits, flag);
      } else {
        next = this.getNext();
        this.throw(
          `unexpected token '${next}' after base marker '${start}', expecting one of ${digits}`,
        );
      }
      // 'n' bigint marker gets checked below
      next = this.getNextIf("n");
    } else if (start) {
      // allow leading decimal point with no leading digit, e.g. .125
      if (start !== ".") {
        // a leading decimal digit
        result += sign + start + this.getNextDigits();
        next = this.getNextIf(".neE");
      } else {
        next = start;
      }
      // float
      if (next === ".") {
        result += next;
        next = this.getNextIf(digits);
        // allow trailing decimal point with no following digits, e.g. 12.
        if (next) {
          result += next + this.getNextDigits();
        }
        next = this.getNextIf("eE");
      }
      // exponent
      if (next.toLowerCase() === "e") {
        start = next + this.getNextIf("+-");
        next = this.getNextIf(digits);
        if (next) {
          result += start + next + this.getNextDigits();
        } else {
          next = this.getNext();
          this.throw(
            `unexpected token '${next}' after exponent marker '${start}', expecting one of ${digits}`,
          );
        }
      }
      // 'n' bigint marker gets checked below
    }
    return next === "n" ? BigInt(result) : Number(result);
  }
  getObject() {
    const open = this.getNextIf("{");
    if (!open) {
      this.throw(`expected '{'`);
    }
    const result = {};
    let post = [],
      inner = [],
      pre = [];
    while (this.hasRemaining()) {
      pre = this.getWSorComments();
      if (this.readNext() === "}") {
        this.inner = inner.concat(pre);
        break;
      }
      const key = this.getKey();
      if (!key) {
        this.throw(`unexpected token '${this.getNext()}' while parsing object`);
      }
      post = this.getWSorComments();
      if (!this.getNextIf(":")) {
        this.throw(
          `unexpected token '${this.getNext()}' while parsing object, expecting ':'`,
        );
      }
      // TODO: parse comments around key for JSDoc
      const entry = this.getMember();
      if (
        !entry.hasOwnProperty(0) &&
        ![true, "inObject"].includes(this.ignoreMissing)
      ) {
        this.throw(
          `unexpected empty value found in object. Try less restrictive parsing options.`,
        );
      } else if (entry.hasOwnProperty(0)) {
        let [value, entryPre, entryPost, entryInner] = entry;
        // we're supposed to keep the value if
        if (
          (value !== undefined || // it is not undefined, or is undefined but we shouldn't ignore it
            ![true, "inObject"].includes(this.ignoreUndefined)) && // and
          (value !== null || ![true, "inObject"].includes(this.ignoreNull)) // it is not null or is null but we shouln't ignore it
        ) {
          if (this.reviver) {
            try {
              value = this.reviver(
                value,
                key,
                result,
                entryPre,
                entryPost,
                entryInner,
              );
            } catch (err) {
              this.throw(`error reviving value: ${err.message}`);
            }
          }
          if (pre.length) {
            const jsdoc = JSDocParser.parse(pre.join(""));
            let jsdocType = jsdoc?.type?.type || [];
            if (!Array.isArray(jsdocType)) {
              jsdocType = [jsdocType];
            }
            let istype = false;
            for (const type of jsdocType) {
              if (checkType(type, value)) {
                istype = true;
                break;
              } else if (typeRevivers[type]) {
                try {
                  value = typeRevivers[type](value);
                  istype = true;
                  break;
                } catch (e) {
                  // fail silently, in case it's another type
                }
              }
            }
            if (!istype && jsdocType.length) {
              this.throw(
                `value ${JSON.stringify(
                  value,
                )} does not match JSDoc type ${jsdocType.join(", ")}`,
              );
            }
            else if (istype) {
              if (!result[Symbol.for("jsln-proptypes")]) {
                result[Symbol.for("jsln-proptypes")] = {};
              }
              result[Symbol.for("jsln-proptypes")][key] = jsdoc.type;
            }
          }
          result[key] = value;
        }
        if (!this.getNextIf(",") && this.readNext() !== "}") {
          const bad = this.getNext();
          this.throw(
            `unexpected token '${bad}' while parsing object, expecting ',' or '}'`,
          );
        } else {
          inner = inner.concat(pre, post, entryPre, entryInner, entryPost);
        }
      }
    }
    if (!this.hasRemaining()) {
      this.throw(`unexpected token EOF while parsing object, expecting '}'`);
    }
    this.getNext();
    return [result,inner];
  }
  getArray() {
    const open = this.getNextIf("[");
    if (!open) {
      this.throw(`expected '['`);
    }
    const result = [];
    let pre = [],
      inner = [],
      post = [],
      index = -1;
    while (this.hasRemaining()) {
      index++;
      pre = this.getWSorComments();
      if (this.readNext() === "]") {
        inner = inner.concat(pre);
        break;
      }
      const entry = this.getMember();
      // a missing value passed back.
      if (!entry.hasOwnProperty(0)) {
        if (![true, "inArray"].includes(this.ignoreMissing)) {
          this.throw(
            `unexpected empty value found in array. Try less restrictive parsing options.`,
          );
        }
        result.length++;
        inner = inner.concat(entry[1]);
      }
      // otherwise if there's a value, add it to the result
      else {
        let [value, keyPre, keyPost, keyInner] = entry;
        if (this.reviver) {
          try {
            value = this.reviver(
              value,
              index,
              result,
              pre.concat(keyPre),
              keyPost,
              keyInner,
            );
          } catch (err) {
            this.throw(`error reviving value: ${err.message}`);
          }
        }
        // we're supposed to keep the value if
        if (
          (value !== undefined || //is not undefined or is undefined but we shouldn't ignore it
            ![true, "inArray"].includes(this.ignoreUndefined)) && // and
          (value !== null || ![true, "inArray"].includes(this.ignoreNull)) // it is not null or is null but we shouln't ignore it
        ) {
          result.push(value);
        }
      }
      if (!this.getNextIf(",") && this.readNext() !== "]") {
        const bad = this.getNext();
        this.throw(
          `unexpected token '${bad}' while parsing array, expecting ',' or ']'`,
        );
      }
    }
    if (!this.hasRemaining()) {
      this.throw(`unexpected token EOF while parsing array, expecting ']'`);
    }
    this.getNext();
    return [result, inner];
  }
  /**
   * Parse an object key: either a quoted string or an identifier.
   * @returns {string}
   */
  getKey() {
    if (['"', "'"].includes(this.readNext())) {
      return this.getSinglelineString();
    }
    const id = this.getIdent();
    if (!id) {
      const ch = this.getNext();
      this.throw(`unexpected token '${ch}' while parsing object key`);
    }
    return id;
  }

  getMember() {
    let pre = this.getWSorComments(),
      tag = this.getIdent(true),
      inner = [],
      post = [],
      result,
      type = "";
    if (JSLNParser.KEYWORDS.includes(tag)) {
      switch (tag) {
        case "undefined":
          result = undefined;
          type = "undefined";
          break;
        case "null":
          result = null;
          type = "null";
          break;
        case "true":
          result = true;
          type = "boolean";
          break;
        case "false":
          result = false;
          type = "boolean";
          break;
        case "NaN":
          result = NaN;
          type = "number";
          break;
        case "Infinity":
          result = Infinity;
          type = "number";
          break;
      }
      tag = "";
    } else {

      switch (this.readNext()) {
        case "{":
          [result, inner] = this.getObject();
          type = "object";
          break;
        case "[":
          [result, inner] = this.getArray();
          type = "array";
          break;
        case "`":
          if (this.strictMode)
            this.throw(`unexpected token '\`' in strict mode`);
        case '"':
        case "'":
          [result, inner] = this.getString();
          type = "string";
          break;
        case "\\":
          try {
            result = JSLNParser.getTagHandler("re")(this.getRegex());
            type = "regexp";
          } catch (err) {
            this.throw(`error processing Regex literal: ${err.message}`);
          }
          break;
        default: // number or missing
          result = this.getNumber();
          type = result === "" ? "missing" : typeof result;
      }
    }
    post = this.getWSorComments();
    if (type !== "missing") {
      if (tag) {
        const handler = JSLNParser.getTagHandler(tag);
        try {
          result = handler(result, null, null, pre, post, inner);
        } catch (err) {
          this.throw(`error processing tag '${tag}': ${err.message}`);
        }
      }
      const jsdoc = JSDocParser.parse(pre.concat(post).join(""));
      let jsdocType = jsdoc?.type?.type || [];
      if (!Array.isArray(jsdocType)) {
        jsdocType = [jsdocType];
      }
      let istype = false;
      for (const type of jsdocType) {
        if (checkType(type, result)) {
          istype = true;
          break;
        } else if (typeRevivers[type]) {
          try {
            result = typeRevivers[type](result);
            istype = true;
            break;
          } catch (e) {
            // fail silently, in case it's another type
          }
        }
      }
      if (!istype && jsdocType.length) {
        this.throw(
          `value ${JSON.stringify(
            result,
          )} does not match JSDoc type ${jsdocType.join(", ")}`,
        );
      } 
    } else if (tag) {
      this.throw(`unknown keyword '${tag}' while proccessing value`);
    } else if (
      Object.keys(pre).length ||
      Object.keys(post).length ||
      Object.keys(inner.length)
    ) {
      pre = pre.concat(inner, post);
      inner = [];
      post = [];
    }
    // if a type was found, return the value and the pre-comments
    if (type !== "missing") return [result, pre, post, inner];
    // fallback: no value
    return [, pre, post, inner];
  }
}
