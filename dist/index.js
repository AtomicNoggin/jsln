// parser.js
var Parser = class {
  #remaining = "";
  #line = 1;
  #col = 0;
  #updateLineCol(found) {
    const lines = found.split("\n");
    if (lines.length > 1) {
      this.#line += lines.length - 1;
      this.#col = 0;
    }
    this.#col += lines.pop().length;
  }
  /**
   * The text to be parsed. This class only keeps track the remaining text as it parses. 
   * @param {string} text 
   */
  constructor(text) {
    this.#remaining = text;
  }
  /**
   * Check if there is any remaining text to parse
   * @returns {boolean} true if there is remaining text, false otherwise
   */
  hasRemaining() {
    return this.#remaining.length > 0;
  }
  /**
   * add more text to the end of the remaining text
   * @param {string} text the new text to add. Defaults to an empty string
   * @returns {string} the new remaining text value
   */
  appendText(text = "") {
    return this.#remaining += text;
  }
  /**
   * copy the next (amount) characters of remaining text, leaving the original string in place
   * @param {number} amount optional number of characters to read. defaults to 1
   * @returns {string} the next (amount) characters of the remaining text, or empty string if remaining text length is less than amount
   */
  readNext(amount = 1) {
    const count = Number(amount);
    if (!Number.isFinite(count) || count <= 0) return "";
    return this.#remaining.slice(0, Math.min(count, this.#remaining.length));
  }
  /**
   * remove the next (amount) characters from the remaining text and return them
   * @param {number} amount optional number of characters to remove. defaults to 1
   * @returns {string} the next (amount) characters, removed from the remaining text, or empty string if remaining text length is less than amount
   */
  getNext(amount = 1) {
    const count = Number(amount);
    if (!Number.isFinite(count) || count <= 0) return "";
    const [found, remain] = this.#remaining.match(RegExp(`^((?:.{${amount}})?)(.*)`, "s")).slice(1, 3);
    this.#updateLineCol(found);
    this.#remaining = remain;
    return found;
  }
  /**
   * remove the next (amount) characters from the remaining text only if they match the provided regular expression character class
   * @param {string} check the character class to check for, minus the wrapping square brackets ([ ])
   * @param {number | string} amount optional number of characters to remove. default is 1. Can be a string with 2 comma delimited numbers if a range is required
   * @param {string} flags optional extra regexp flags to pass in. default is none. Always uses 's'
   * @returns {string} the specified (amount) of characters that matched (check), removed from the remaining text, 
   *   or an empty string if amount greater than remaining text length or not all requested characters matched.
   */
  getNextIf(check, amount = 1, flags = "") {
    let count;
    if (amount === amount + "") {
      count = amount.split(",").map(Number);
      count.length = 2;
      if ((!count.every(Number.isFinite) || count.some((c) => c < 0)) && count[0] > count[1]) {
        return "";
      }
      count = count.join(",");
    } else {
      count = Number(amount);
      if (!Number.isFinite(count) || count <= 0) return "";
    }
    const [found, remain] = this.#remaining.match(RegExp(`^((?:[${check}]{${amount}})?)(.*)`, "s" + flags)).slice(1, 3);
    if (found) {
      this.#updateLineCol(found);
      this.#remaining = remain;
    }
    return found;
  }
  /**
   * remove and return any whitespace found at the front of the remaining text. Convienence method for `parser.getWhileMatching('\s')`
   * @returns the found whitespace, if any, removed from the front of the remaining text
   */
  getWS() {
    const [found, remain] = this.#remaining.match(/^([\s]*)(.*)/s).slice(1, 3);
    this.#updateLineCol(found);
    this.#remaining = remain;
    return found;
  }
  /**
   * remove the all characters from the remaining text that match the provided regular expression character class
   * @param {string} check the character class to check for, minus the wrapping square brackets ([ ])
   * @param {*} flags optional extra regexp flags to pass in. default is none. Always uses 's'
   * @returns the characters that matched (check), removed from the remaining text, or an empty string if no characters matched. 
   */
  getWhileMatching(check, flags = "") {
    const [found, remain] = this.#remaining.match(RegExp(`^([${check}]*)(.*)`, "s" + flags)).slice(1, 3);
    if (found) {
      this.#updateLineCol(found);
      this.#remaining = remain;
    }
    return found;
  }
  /**
   * remove the all characters from the remaining text that do NOT match the provided regular expression character class and the first character found that does.
   * @param {string} check the character class to check for, minus the wrapping square brackets ([ ])
   * @param {string} flags optional extra regexp flags to pass in. default is none. Always uses 's'
   * @returns {array} a two entry string array consisting of 
   *  1) the characters that did not match (check), or empty string none were found,  
   *  2) the first character that did match, or an empty string if the end of remaining text was reached without finding a match
   */
  getUntilMatching(check, flags = "") {
    const [found, stop, remain] = this.#remaining.match(RegExp(`^([^${check}]*)([${check}]?)(.*)`, "s" + flags)).slice(1, 4);
    if (found || stop) {
      this.#updateLineCol(found + stop);
      this.#remaining = remain;
    }
    return [found, stop];
  }
  /**
   * the amount of text parsed from the provided text, as number of new lines (\n) found and number of characters in the last line
   * @returns {array} a two entry number array consisting of the line count and col count of all characters removed from the provided text to this point.
   */
  lastPosition() {
    return [this.#line, this.#col];
  }
  /**
   * throw an error message, adding the line and col count to the end
   * @param {*} msg the error message to throw
   * @param {*} errorType optional error type. Defaults to SyntaxError
   */
  throw(msg, errorType = SyntaxError) {
    throw new errorType(`${msg} (at line ${this.#line}, col ${this.#col})`);
  }
};

// jsdoc-parser.js
var TAG_PATTERN = /^@([A-Za-z][\w-]*)(?:\s+|$)(.*)$/;
var TYPE_PATTERN = /^\{([^}]*)\}\s*(.*)$/;
function cleanComment(input) {
  if (typeof input !== "string") {
    throw new TypeError("JSDoc comment must be a string");
  }
  let text = input.trim();
  if (text.startsWith("/**") && text.endsWith("*/")) {
    text = text.slice(3, -2);
  }
  return text.split(/\r?\n/).map((line) => line.replace(/^\s*\* ?/, "").trimEnd()).join("\n").trim();
}
function readTypeAndText(value) {
  const text = value.trim();
  if (!text.startsWith("{")) return { type: null, text };
  let depth = 0;
  for (let index = 0; index < text.length; index++) {
    if (text[index] === "{") depth++;
    if (text[index] === "}") depth--;
    if (depth === 0) {
      return {
        type: text.slice(1, index).trim(),
        text: text.slice(index + 1).trim()
      };
    }
  }
  const match = text.match(TYPE_PATTERN);
  if (!match) return { type: null, text };
  return { type: match[1].trim(), text: match[2].trim() };
}
function normalizeType(type) {
  if (!type) return type;
  const types = [];
  let start = 0;
  let quote = "";
  let escaped = false;
  for (let index = 0; index < type.length; index++) {
    const character = type[index];
    if (escaped) {
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (quote) {
      if (character === quote) quote = "";
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (character === "|") {
      const member2 = type.slice(start, index).trim();
      if (member2) types.push(member2);
      start = index + 1;
    }
  }
  const member = type.slice(start).trim();
  if (member) types.push(member);
  return types.length > 1 ? types : types[0] ?? "";
}
function readTypeScriptProperties(type) {
  if (!type?.startsWith("{") || !type.endsWith("}")) return [];
  return type.slice(1, -1).split(/[;,]/).map((property) => property.trim()).filter(Boolean).map((property) => readProperty(property));
}
function addProperty(property, result) {
  if (result.typedef.length) {
    result.typedef.at(-1).props[property.name] = property;
  } else {
    result.props.push(property);
  }
}
function markLastPropertyReadonly(result) {
  const properties = result.typedef.length ? result.typedef.at(-1).props : result.props;
  const property = Object.values(properties).at(-1) ?? result.props.at(-1);
  if (property) property.readonly = true;
}
function readProperty(value) {
  let { type, text } = readTypeAndText(value);
  const closureOptional = type?.endsWith("=");
  if (closureOptional) type = type.slice(0, -1).trim();
  type = normalizeType(type);
  const typescript = text.match(/^(readonly\s+)?([^\s:?]+)(\?)?\s*:\s*([\s\S]+)$/);
  if (typescript) {
    const descriptionSeparator = typescript[4].match(/^(.*?)(?:\s+-\s+([\s\S]*))?$/);
    return {
      name: typescript[2],
      type: normalizeType(descriptionSeparator[1].trim()),
      optional: Boolean(typescript[3]),
      defaultValue: void 0,
      description: descriptionSeparator[2]?.trim() ?? "",
      ...typescript[1] ? { readonly: true } : {}
    };
  }
  const match = text.match(/^(\[[^\]]+\]|[^\s=]+)(?:\s*=\s*(.*?))?(?:\s+([\s\S]*))?$/);
  if (!match) {
    return { name: text, type, optional: closureOptional, defaultValue: void 0, description: "" };
  }
  const name = match[1];
  const optional = name.startsWith("[") && name.endsWith("]");
  const unwrappedName = optional ? name.slice(1, -1) : name;
  const [propertyName, bracketDefault] = optional ? unwrappedName.split(/=(.*)/s) : [unwrappedName, void 0];
  return {
    name: propertyName,
    type,
    optional: optional || closureOptional,
    defaultValue: bracketDefault ?? match[2],
    description: match[3]?.trim() ?? ""
  };
}
function parseTag(name, value, result) {
  switch (name) {
    case "type": {
      const parsed = readTypeAndText(value);
      result.type = {
        type: normalizeType(parsed.type ?? parsed.text),
        readonly: result.type?.readonly ?? false
      };
      break;
    }
    case "typedef": {
      const parsed = readTypeAndText(value);
      const parts = parsed.text.match(/^(\S+)(?:\s+([\s\S]*))?$/);
      const typeScriptObject = parsed.type?.startsWith("{") && parsed.type.endsWith("}");
      const typedef = {
        name: parts?.[1] ?? "",
        type: typeScriptObject ? "object" : normalizeType(parsed.type),
        description: parts?.[2]?.trim() ?? "",
        props: {}
      };
      result.typedef.push(typedef);
      if (typeScriptObject) {
        for (const property of readTypeScriptProperties(parsed.type)) {
          typedef.props[property.name] = property;
        }
      }
      break;
    }
    case "prop":
    case "property":
      addProperty(readProperty(value), result);
      break;
    case "readonly":
      {
        const inline = value.trim().match(/^@(type|prop|property)\s+([\s\S]*)$/);
        if (inline) {
          parseTag(inline[1], inline[2], result);
          if (inline[1] === "type") {
            if (result.type) result.type.readonly = true;
          } else {
            markLastPropertyReadonly(result);
          }
        } else {
          result.readonly = true;
          if (value.trim()) result.readonlyDescription = value.trim();
        }
      }
      break;
    default:
      result.unkown[name] ??= [];
      result.unkown[name].push(value.trim());
  }
}
function parseJSDoc(input) {
  const comment = cleanComment(input);
  if (!comment) return null;
  const lines = comment.split("\n");
  const result = {
    description: "",
    type: null,
    typedef: [],
    props: [],
    readonly: false,
    unkown: {}
  };
  const description = [];
  let currentTag = null;
  let pendingReadonly = false;
  for (const line of lines) {
    const tagMatch = line.trim().match(TAG_PATTERN);
    if (tagMatch) {
      if (pendingReadonly && !["type", "prop", "property"].includes(tagMatch[1])) {
        parseTag("readonly", "", result);
        pendingReadonly = false;
      }
      currentTag = { name: tagMatch[1], value: tagMatch[2] };
      if (currentTag.name === "readonly" && !currentTag.value.trim()) {
        pendingReadonly = true;
      } else if (pendingReadonly) {
        parseTag(currentTag.name, currentTag.value, result);
        if (currentTag.name === "type") {
          if (result.type) result.type.readonly = true;
        } else {
          markLastPropertyReadonly(result);
        }
        pendingReadonly = false;
      } else {
        parseTag(currentTag.name, currentTag.value, result);
        if (currentTag.name === "typedef" && description.length) {
          result.typedef.at(-1).description = description.join(" ").replace(/\s+/g, " ").trim();
          description.length = 0;
        }
      }
      continue;
    }
    if (pendingReadonly && !line.trim()) {
      parseTag("readonly", "", result);
      pendingReadonly = false;
    }
    if (currentTag && line.trim()) {
      if (["typedef", "prop", "property"].includes(currentTag.name)) {
        currentTag = null;
        description.push(line.trim());
        continue;
      }
      currentTag.value += ` ${line.trim()}`;
      const values = result.unkown[currentTag.name];
      if (values) values[values.length - 1] = currentTag.value.trim();
      continue;
    }
    if (!currentTag) description.push(line.trim());
  }
  if (pendingReadonly) parseTag("readonly", "", result);
  result.description = description.join(" ").replace(/\s+/g, " ").trim();
  if (!result.type && !result.typedef.length && !result.props.length && !result.readonly && !Object.keys(result.unkown).length) {
    return null;
  }
  if (!result.type) delete result.type;
  if (!result.typedef.length) delete result.typedef;
  if (!result.props.length) delete result.props;
  if (!result.readonly) delete result.readonly;
  return result;
}
var JSDocParser = class _JSDocParser {
  static parse(input) {
    return parseJSDoc(input);
  }
  static stringify(result, indent = 0) {
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new TypeError("JSDoc result must be an object");
    }
    indent = Number(indent);
    indent = Number.isFinite(indent) ? Math.max(0, Math.floor(indent)) : 0;
    const onlyType = result.type && !result.description && !(result.typedef ?? []).length && !(result.props ?? []).length && !result.readonly && !Object.keys(result.unkown ?? {}).length;
    if (onlyType) {
      const typeValue = Array.isArray(result.type.type) ? result.type.type.join("|") : result.type.type;
      const typeLine = `@type {${typeValue}}`;
      const readonly = result.type.readonly ? "@readonly " : "";
      return `${" ".repeat(indent)}/** ${readonly}${typeLine} */`;
    }
    const lines = [];
    if (result.description) lines.push(String(result.description));
    for (const [typedefIndex, typedef] of (result.typedef ?? []).entries()) {
      if (typedefIndex > 0) lines.push("");
      const associatedProps = Object.values(typedef.props ?? {});
      const inlineTypeScript = typedef.type === "object" && associatedProps.length > 0 && associatedProps.every((property) => property.defaultValue === void 0);
      if (typedef.description) lines.push(String(typedef.description));
      if (inlineTypeScript) {
        const properties = associatedProps.map((property) => {
          const propertyType = Array.isArray(property.type) ? property.type.join("|") : property.type;
          const modifier = property.readonly ? "readonly " : "";
          const optional = property.optional ? "?" : "";
          return `${modifier}${property.name}${optional}: ${propertyType}`;
        });
        lines.push(`@typedef {{${properties.join("; ")}}} ${typedef.name}`);
      } else {
        const type = typedef.type ? `{${typedef.type}} ` : "";
        lines.push(`@typedef ${type}${typedef.name}`);
        for (const property of associatedProps) {
          const propertyType = Array.isArray(property.type) ? property.type.join("|") : property.type;
          const propType = propertyType ? `{${propertyType}} ` : "";
          const propName = property.optional ? `[${property.name}${property.defaultValue !== void 0 ? `=${property.defaultValue}` : ""}]` : property.name;
          const propLine = `@prop ${propType}${propName}${property.description ? ` ${property.description}` : ""}`;
          lines.push(property.readonly ? `@readonly ${propLine}` : propLine);
        }
      }
    }
    if (result.type) {
      if ((result.typedef ?? []).length) lines.push("");
      const typeValue = Array.isArray(result.type.type) ? result.type.type.join("|") : result.type.type;
      const typeLine = `@type {${typeValue}}`;
      lines.push(result.type.readonly ? `@readonly ${typeLine}` : typeLine);
    }
    for (const property of result.props ?? []) {
      const propertyType = Array.isArray(property.type) ? property.type.join("|") : property.type;
      const type = propertyType ? `{${propertyType}} ` : "";
      const name = property.optional ? `[${property.name}${property.defaultValue !== void 0 ? `=${property.defaultValue}` : ""}]` : property.name;
      const propLine = `@prop ${type}${name}${property.description ? ` ${property.description}` : ""}`;
      lines.push(property.readonly ? `@readonly ${propLine}` : propLine);
    }
    if (result.readonly) {
      lines.push(`@readonly${result.readonlyDescription ? ` ${result.readonlyDescription}` : ""}`);
    }
    for (const [name, values] of Object.entries(result.unkown ?? {})) {
      for (const value of Array.isArray(values) ? values : [values]) {
        lines.push(`@${name}${value ? ` ${value}` : ""}`);
      }
    }
    if (lines.length === 0) return "";
    const hasContentText = lines.some((line) => line && !line.startsWith("@")) || result.description || (result.props ?? []).length || (result.typedef ?? []).some((typedef) => typedef.description);
    const linePadding = indent > 0 ? indent + 2 : hasContentText ? 2 : 1;
    const openingPadding = " ".repeat(indent);
    const starPrefix = " ".repeat(linePadding) + "*";
    return `${openingPadding}/**
${lines.map((line) => line ? `${starPrefix} ${line}` : starPrefix).join("\n")}
${starPrefix}/`;
  }
  parse(input) {
    return parseJSDoc(input);
  }
  stringify(result, indent = 0) {
    return _JSDocParser.stringify(result, indent);
  }
};
var stringifyJSDoc = JSDocParser.stringify;

// jsln-parser.js
var JSLN_SYMBOLS = Object.freeze({
  typedef: /* @__PURE__ */ Symbol.for("jsln-typedef"),
  proptypes: /* @__PURE__ */ Symbol.for("jsln-proptypes")
});
var typeRevivers = (() => {
  let copy = "";
  return {
    re: copy = (value) => {
      if (value instanceof RegExp) return value;
      if (!Array.isArray(value)) {
        throw new Error(`Invalid regex value: ${JSON.stringify(value)}`);
      }
      const [pattern, flags] = value;
      return new RegExp(pattern, flags);
    },
    RegExp: copy,
    map: copy = (value) => {
      if (value instanceof Map) return value;
      if (!Array.isArray(value)) {
        throw new Error(`Invalid Map value: ${JSON.stringify(value)}`);
      }
      return new Map(value);
    },
    Map: copy,
    set: copy = (value) => {
      if (value instanceof Set) return value;
      if (!Array.isArray(value)) {
        throw new Error(`Invalid Map value: ${JSON.stringify(value)}`);
      }
      return new Set(value);
    },
    Set: copy,
    d: copy = (value) => {
      if (value instanceof Date) return value;
      if (!["string", "number", "bigint"].includes(typeof value)) {
        throw new Error(`Invalid date value: ${JSON.stringify(value)}`);
      } else if (typeof value === "bigint") {
        value = Number(value / 1000000n);
      } else if (typeof value === "string" && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value
      )) {
        throw new Error(`Invalid date value: ${JSON.stringify(value)}`);
      }
      return new Date(value);
    },
    Date: copy,
    c8: copy = (value) => {
      if (value instanceof Uint8ClampedArray) return value;
      if (!Array.isArray(value) && typeof value !== "bigint") {
        throw new Error(
          `Invalid Uint8ClampedArray value: ${JSON.stringify(value)}`
        );
      } else if (typeof value === "bigint") {
        let bytes = BigInt(value);
        value = [];
        do {
          value.push(Number(bytes & 255n));
        } while (bytes >>= 8n);
        value = value.reverse();
      }
      return new Uint8ClampedArray(value);
    },
    Uint8ClampedArray: copy,
    u8: copy = (value) => {
      if (value instanceof Uint8Array) return value;
      if (!Array.isArray(value) && typeof value !== "bigint") {
        throw new Error(`Invalid Uint8Array value: ${JSON.stringify(value)}`);
      } else if (typeof value === "bigint") {
        let bytes = BigInt(value);
        value = [];
        do {
          value.push(Number(bytes & 255n));
        } while (bytes >>= 8n);
        value = value.reverse();
      }
      return new Uint8Array(value);
    },
    Uint8Array: copy,
    u16: copy = (value) => {
      if (value instanceof Uint16Array) return value;
      if (!Array.isArray(value)) {
        throw new Error(
          `Invalid Uint16Array value: ${JSON.stringify(value)}`
        );
      }
      return new Uint16Array(value);
    },
    Uint16Array: copy,
    u32: (value) => {
      if (value instanceof Uint32Array) return value;
      if (!Array.isArray(value)) {
        throw new Error(
          `Invalid Uint32Array value: ${JSON.stringify(value)}`
        );
      }
      return new Uint32Array(value);
    },
    u64: copy = (value) => {
      if (value instanceof BigUint64Array) return value;
      if (!Array.isArray(value)) {
        throw new Error(
          `Invalid BigUint64Array value: ${JSON.stringify(value)}`
        );
      }
      return new BigUint64Array(value);
    },
    BigUint64Array: copy,
    i8: copy = (value) => {
      if (value instanceof Int8Array) return value;
      if (!Array.isArray(value)) {
        throw new Error(`Invalid Int8Array value: ${JSON.stringify(value)}`);
      }
      return new Int8Array(value);
    },
    Int8Array: copy,
    i16: copy = (value) => {
      if (value instanceof Int16Array) return value;
      if (!Array.isArray(value)) {
        throw new Error(`Invalid Int16Array value: ${JSON.stringify(value)}`);
      }
      return new Int16Array(value);
    },
    Int16Array: copy,
    i32: copy = (value) => {
      if (value instanceof Int32Array) return value;
      if (!Array.isArray(value)) {
        throw new Error(`Invalid Int32Array value: ${JSON.stringify(value)}`);
      }
      return new Int32Array(value);
    },
    Int32Array: copy,
    i64: copy = (value) => {
      if (value instanceof BigInt64Array) return value;
      if (!Array.isArray(value)) {
        throw new Error(
          `Invalid BigInt64Array value: ${JSON.stringify(value)}`
        );
      }
      return new BigInt64Array(value);
    },
    BigInt64Array: copy,
    f16: copy = (value) => {
      if (value instanceof Float16Array) return value;
      if (!Array.isArray(value)) {
        throw new Error(
          `Invalid Float16Array value: ${JSON.stringify(value)}`
        );
      }
      return new Float16Array(value);
    },
    Float16Array: copy,
    f32: copy = (value) => {
      if (value instanceof Float32Array) return value;
      if (!Array.isArray(value)) {
        throw new Error(
          `Invalid Float32Array value: ${JSON.stringify(value)}`
        );
      }
      return new Float32Array(value);
    },
    Float32Array: copy,
    f64: copy = (value) => {
      if (value instanceof Float64Array) return value;
      if (!Array.isArray(value)) {
        throw new Error(
          `Invalid Float64Array value: ${JSON.stringify(value)}`
        );
      }
      return new Float64Array(value);
    },
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
      return value !== void 0 && !Array.isArray(value) && true;
    case "undefined":
      return value === void 0;
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
      return value === Math.floor(value) && !(value === Infinity || value === -Infinity || Number.isNaN(value));
    case "uint":
      return value === Math.abs(Math.floor(value)) && !(value === Infinity || Number.isNaN(value));
    default:
      if (typename.match(/^(['"])(?:\\.|(?!\1)[^\\\r\n])*\1$/)) {
        return value === typename.slice(1, -1);
      } else if (typename.endsWith("n") && BigInt(typename.slice(0, -1)) === BigInt(typename.slice(0, -1))) {
        return value === BigInt(typename.slice(0, -1));
      } else if (Number(typename) === Number(typename)) {
        return value === Number(typename);
      }
      return false;
  }
}
function typedefToClass(typedef, options = {}) {
  const { name: className, type: classType, props: typedefProps } = typedef;
  const typedefEntries = Object.entries(typedefProps);
  const internalValues = /* @__PURE__ */ Symbol("internalValues");
  if (!className) {
    console.warn(`typedef missing name, ignoring`);
    return;
  }
  if (Array.isArray(classType)) {
    const reviver = (value) => {
      let istype = false;
      for (const type of classType) {
        if (checkType(type, value)) {
          istype = true;
          break;
        } else if (typeRevivers[type]) {
          try {
            value = typeRevivers[type](value);
            istype = true;
            break;
          } catch (e) {
          }
        }
      }
      if (!istype) {
        throw new TypeError(
          `${JSON.stringify(value)} is not one of the following types ${classType.join(", ")}`
        );
      }
      return value;
    };
    typeRevivers[className] = reviver;
    return;
  } else if (classType.toLowerCase() !== "object" && !typedefEntries.length) {
    if (typeRevivers[classType]) {
      typeRevivers[className] = typeRevivers[classType];
    } else {
      console.warn(`unknown base class ${classType} in typedef ${className}, ignoring`);
    }
    return;
  }
  const clazz = {
    [className]: class {
      static [/* @__PURE__ */ Symbol.for("jsln-typedef")] = typedef;
      constructor(initiator = {}) {
        let inConstructor = true;
        this[internalValues] = {};
        for (const [propName, details] of typedefEntries) {
          if (!Array.isArray(details.type)) {
            details.type = [details.type];
          }
          if (details.defaultValue !== void 0) {
            details.defaultValue = new JSLNParser(details.defaultValue).getMember()[0];
          }
          Object.defineProperty(clazz.prototype, propName, {
            get() {
              return this[internalValues][propName] === void 0 ? details.defaultValue : this[internalValues][propName];
            },
            set(value) {
              if (details.readonly && !inConstructor) {
                throw new TypeError(`'${propName}' is read-only`);
              } else if (details.defaultValue === value) {
                delete this[internalValues][propName];
              } else {
                let istype = false;
                for (const type of details.type) {
                  if (checkType(type, value)) {
                    istype = true;
                    break;
                  } else if (typeRevivers[type]) {
                    try {
                      value = typeRevivers[type](value);
                      istype = true;
                      break;
                    } catch (e) {
                    }
                  }
                }
                if (!istype) {
                  throw new TypeError(`${className}.${propName} must be ${details.type > 1 ? "one of " + details.type.join(", ") : "of type " + details.type[0]} `);
                } else {
                  this[internalValues][propName] = value;
                }
              }
            },
            enumerable: true
          });
        }
        const allProps = new Set(
          Object.keys(initiator).concat(Object.keys(typedefProps))
        );
        for (const [propName, detail] of typedefEntries) {
          if (!detail.optional && !Object.hasOwn(initiator, propName)) {
            throw new RangeError(`missing required property '${propName}' from ${className} intiator`);
          } else if (Object.hasOwn(initiator, propName)) {
            this[propName] = initiator[propName];
            allProps.delete(propName);
          }
        }
        for (const remaining of allProps) {
          console.warn(`unxpected property '${remaining}' found in ${className} iniator`);
        }
        const proptypes = /* @__PURE__ */ Symbol.for("jsln-proptypes");
        if (Object.hasOwn(initiator, proptypes)) {
          this[proptypes] = initiator[proptypes];
        }
        inConstructor = false;
      }
    }
  }[className];
  typeRevivers[className] = (value) => {
    if (value instanceof clazz) return value;
    if (typeof value !== "object" || value === null) {
      throw new TypeError(
        `${JSON.stringify(value)} is not of type ${className}`
      );
    }
    const instance = new clazz(value);
    return instance;
  };
  return clazz;
}
var JSLNParser = class _JSLNParser extends Parser {
  static get KEYWORDS() {
    return ["true", "false", "null", "undefined", "NaN", "Infinity"];
  }
  static registerTag(tag, handler) {
    tag = "" + tag;
    const check = tag.toLowerCase();
    if (_JSLNParser.KEYWORDS.includes(tag)) {
      throw new SyntaxError(`'${tag}' is a reserved identifier`);
    } else if (!tag.match(/^[$_\p{ID_Start}][$\p{ID_Continue}]*$/u)) {
      throw new SyntaxError(`'${tag}' is not a valid identifier format`);
    }
    typeRevivers[tag] = handler;
  }
  static getTagHandler(tag) {
    return typeRevivers[tag] || ((value) => {
      throw new ReferenceError(`No handler registered for tag '${tag}'`);
    });
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
      `unexpected end of file, expecting '*/' to close multi-line comment`
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
    this.getWS();
    let init = this.getNextIf("/");
    if (strictMode && init) {
      this.throw(`unexpected comment in strict mode`);
    }
    while (init) {
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
      if (this.readNext() === "@") {
        this.getNext();
        if (_JSLNParser.KEYWORDS.includes(out)) {
          this.throw(`unexpected character '@' after keyword ${out}`);
        }
      } else if (!_JSLNParser.KEYWORDS.includes(out)) {
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
        return "	";
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
            `string escape sequence token '${bad}', expected one of 0-9a-f after '\\x`
          );
        }
        return String.fromCharCode(Number("0x" + hex));
      }
      case "u": {
        const next = this.getNextIf("0-9a-f{", 1, "i");
        if (next === "{") {
          const code = this.getNextIf("0-9a-f", "1,6", "i");
          if (!code || this.readNext() !== "}") {
            const bad = this.getNext();
            this.throw(
              `unexpected unicode escape sequence token '${bad}', expected one of 0-9a-f within '\\u{'`
            );
          }
          this.getNext();
          return String.fromCodePoint(Number("0x" + code));
        }
        const chs = this.getNextIf("0-9a-f", 3, "i");
        if (!chs) {
          const bad = this.getNext();
          this.throw(
            `unexpected unicode escape sequence token '${bad}', expected one of 0-9a-f after '\\u'`
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
            `string escape sequence token cannot be a line terminator in strict mode`
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
    const quot = this.getNextIf(`'"`);
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
        `unexpected end of file, expecting ${quot === '"' ? `'"'` : `"'"`}`
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
        `unexpected token '${bad}' after group marker '_', expecting one of ${digits}`
      );
    }
    return result.replaceAll("_", "");
  }
  /**
   * Parse a numeric literal. Returns Number, BigInt, Infinity, or NaN, or '' if no number.
   * @returns {number|bigint|string}
   */
  getNumber() {
    let result = "", sign = "", digits = "0-9", flag = "", next = "", start = this.getNextIf(".0-9IN+-");
    if (start == "") return "";
    if (["+", "-"].includes(start)) {
      sign = start;
      start = this.getNextIf(".0-9IN");
    } else if (start === "N") {
      result += start + this.getIdent();
      if (result !== "NaN") {
        this.throw(`unknown keyword value '${result}'`);
      }
      next = "";
    }
    if (start === "I") {
      result += start;
      result += this.getIdent();
      if (result !== "Infinity") {
        this.throw(`unknown keyword value '${result}'`);
      }
      result = sign + result;
      next = "";
    } else if (start === "0" && ["x", "o", "b"].includes(this.readNext().toLowerCase())) {
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
      next = this.getNextIf(digits, 1, flag);
      if (next) {
        result += next + this.getNextDigits(digits, flag);
      } else {
        next = this.getNext();
        this.throw(
          `unexpected token '${next}' after base marker '${start}', expecting one of ${digits}`
        );
      }
      next = this.getNextIf("n");
    } else if (start) {
      if (start !== ".") {
        result += sign + start + this.getNextDigits();
        next = this.getNextIf(".neE");
      } else {
        next = start;
      }
      if (next === ".") {
        result += next;
        next = this.getNextIf(digits);
        if (next) {
          result += next + this.getNextDigits();
        }
        next = this.getNextIf("eE");
      }
      if (next.toLowerCase() === "e") {
        start = next + this.getNextIf("+-");
        next = this.getNextIf(digits);
        if (next) {
          result += start + next + this.getNextDigits();
        } else {
          next = this.getNext();
          this.throw(
            `unexpected token '${next}' after exponent marker '${start}', expecting one of ${digits}`
          );
        }
      }
    }
    return next === "n" ? BigInt(result) : Number(result);
  }
  getObject() {
    const open = this.getNextIf("{");
    if (!open) {
      this.throw(`expected '{'`);
    }
    const result = {};
    let post = [], inner = [], pre = [];
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
          `unexpected token '${this.getNext()}' while parsing object, expecting ':'`
        );
      }
      const entry = this.getMember();
      if (!entry.hasOwnProperty(0) && ![true, "inObject"].includes(this.ignoreMissing)) {
        this.throw(
          `unexpected empty value found in object. Try less restrictive parsing options.`
        );
      } else if (entry.hasOwnProperty(0)) {
        let [value, entryPre, entryPost, entryInner] = entry;
        if ((value !== void 0 || // it is not undefined, or is undefined but we shouldn't ignore it
        ![true, "inObject"].includes(this.ignoreUndefined)) && // and
        (value !== null || ![true, "inObject"].includes(this.ignoreNull))) {
          if (this.reviver) {
            try {
              value = this.reviver(
                value,
                key,
                result,
                entryPre,
                entryPost,
                entryInner
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
                }
              }
            }
            if (!istype && jsdocType.length) {
              this.throw(
                `value ${JSON.stringify(
                  value
                )} does not match JSDoc type ${jsdocType.join(", ")}`
              );
            } else if (istype) {
              if (!result[/* @__PURE__ */ Symbol.for("jsln-proptypes")]) {
                result[/* @__PURE__ */ Symbol.for("jsln-proptypes")] = {};
              }
              result[/* @__PURE__ */ Symbol.for("jsln-proptypes")][key] = jsdoc.type;
            }
          }
          result[key] = value;
        }
        if (!this.getNextIf(",") && this.readNext() !== "}") {
          const bad = this.getNext();
          this.throw(
            `unexpected token '${bad}' while parsing object, expecting ',' or '}'`
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
    return [result, inner];
  }
  getArray() {
    const open = this.getNextIf("[");
    if (!open) {
      this.throw(`expected '['`);
    }
    const result = [];
    let pre = [], inner = [], post = [], index = -1;
    while (this.hasRemaining()) {
      index++;
      pre = this.getWSorComments();
      if (this.readNext() === "]") {
        inner = inner.concat(pre);
        break;
      }
      const entry = this.getMember();
      if (!entry.hasOwnProperty(0)) {
        if (![true, "inArray"].includes(this.ignoreMissing)) {
          this.throw(
            `unexpected empty value found in array. Try less restrictive parsing options.`
          );
        }
        result.length++;
        inner = inner.concat(entry[1]);
      } else {
        let [value, keyPre, keyPost, keyInner] = entry;
        if (this.reviver) {
          try {
            value = this.reviver(
              value,
              index,
              result,
              pre.concat(keyPre),
              keyPost,
              keyInner
            );
          } catch (err) {
            this.throw(`error reviving value: ${err.message}`);
          }
        }
        if ((value !== void 0 || //is not undefined or is undefined but we shouldn't ignore it
        ![true, "inArray"].includes(this.ignoreUndefined)) && // and
        (value !== null || ![true, "inArray"].includes(this.ignoreNull))) {
          result.push(value);
        }
      }
      if (!this.getNextIf(",") && this.readNext() !== "]") {
        const bad = this.getNext();
        this.throw(
          `unexpected token '${bad}' while parsing array, expecting ',' or ']'`
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
    let pre = this.getWSorComments(), tag = this.getIdent(true), inner = [], post = [], result, type = "";
    if (_JSLNParser.KEYWORDS.includes(tag)) {
      switch (tag) {
        case "undefined":
          result = void 0;
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
            result = _JSLNParser.getTagHandler("re")(this.getRegex());
            type = "regexp";
          } catch (err) {
            this.throw(`error processing Regex literal: ${err.message}`);
          }
          break;
        default:
          result = this.getNumber();
          type = result === "" ? "missing" : typeof result;
      }
    }
    post = this.getWSorComments();
    if (type !== "missing") {
      if (tag) {
        const handler = _JSLNParser.getTagHandler(tag);
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
      for (const type2 of jsdocType) {
        if (checkType(type2, result)) {
          istype = true;
          break;
        } else if (typeRevivers[type2]) {
          try {
            result = typeRevivers[type2](result);
            istype = true;
            break;
          } catch (e) {
          }
        }
      }
      if (!istype && jsdocType.length) {
        this.throw(
          `value ${JSON.stringify(
            result
          )} does not match JSDoc type ${jsdocType.join(", ")}`
        );
      }
    } else if (tag) {
      this.throw(`unknown keyword '${tag}' while proccessing value`);
    } else if (Object.keys(pre).length || Object.keys(post).length || Object.keys(inner.length)) {
      pre = pre.concat(inner, post);
      inner = [];
      post = [];
    }
    if (type !== "missing") return [result, pre, post, inner];
    return [, pre, post, inner];
  }
};

// jsln-stringifier.js
var IDENTIFIER = /^[$_\p{ID_Start}][$\p{ID_Continue}]*$/u;
var TAGS = /* @__PURE__ */ new Map([
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
  [Float64Array, "f64"]
]);
var DEFAULT_OPTIONS = {
  mode: "extended",
  spaces: 0,
  defaultQuote: "'",
  regexpFormat: "literal",
  ignoreUndefined: false,
  ignoreNull: false,
  failOnUnknown: true
};
var JSLNStringifier = class _JSLNStringifier {
  static stringify(value, replacer = null, options = {}) {
    if (typeof replacer === "object" && replacer !== null) {
      options = replacer;
      replacer = options.replacer ?? null;
    }
    return new _JSLNStringifier(options).stringify(value, replacer);
  }
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...Object(options) };
    if (!["'", '"'].includes(this.options.defaultQuote)) {
      throw new TypeError(`defaultQuote must be either ' or "`);
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
    const typedefs = /* @__PURE__ */ new Map();
    const result = this.#stringify(value, "", replacer, /* @__PURE__ */ new Set(), typedefs);
    const jsdoc = stringifyJSDoc({ typedef: [...typedefs.values()] });
    return jsdoc ? `${jsdoc}
${result}` : result;
  }
  #stringify(value, key, replacer, ancestors, typedefs) {
    if (replacer) value = replacer(key, value);
    if (value === void 0) {
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
      default:
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
        } else if (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null || value.constructor?.[JSLN_SYMBOLS.typedef]) {
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
        typedefs
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
      const jsdoc = type ? `${stringifyJSDoc({ type })}
` : "";
      entries.push(
        `${jsdoc}${IDENTIFIER.test(key) ? key : this.#quote(key)}:${literal}`
      );
    }
    return this.#collection("{", "}", entries);
  }
  #collection(open, close, entries) {
    if (entries.length === 0) return `${open}${close}`;
    if (this.indent === 0) return `${open}${entries.join(",")}${close}`;
    const padding = " ".repeat(this.indent);
    const indentEntry = (entry) => entry.split("\n").map((line) => `${padding}${line}`).join("\n");
    return `${open}
${entries.map(indentEntry).join(",\n")}
${close}`;
  }
  #quote(value) {
    const quote = this.options.defaultQuote;
    const escaped = value.replace(/[\\\n\r\t\b\f\v\0'"\u2028\u2029]/g, (character) => {
      switch (character) {
        case "\\":
          return "\\\\";
        case "\n":
          return "\\n";
        case "\r":
          return "\\r";
        case "	":
          return "\\t";
        case "\b":
          return "\\b";
        case "\f":
          return "\\f";
        case "\v":
          return "\\v";
        case "\0":
          return "\\0";
        case "\u2028":
          return "\\u2028";
        case "\u2029":
          return "\\u2029";
        default:
          return character === quote ? `\\${character}` : character;
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
};
var stringify = JSLNStringifier.stringify;

// index.js
var JSLN = class {
  static parse(input, options = {}) {
    const parser = new JSLNParser(input, options);
    const [value] = parser.getMember();
    if (parser.hasRemaining()) {
      throw new SyntaxError("unexpected trailing input");
    }
    return value;
  }
  static stringify(value, replacer = null, options = {}) {
    return JSLNStringifier.stringify(value, replacer, options);
  }
};
export {
  JSLN as default
};
