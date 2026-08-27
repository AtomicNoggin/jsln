const TAG_PATTERN = /^@([A-Za-z][\w-]*)(?:\s+|$)(.*)$/;
const TYPE_PATTERN = /^\{([^}]*)\}\s*(.*)$/;

function cleanComment(input) {
  if (typeof input !== "string") {
    throw new TypeError("JSDoc comment must be a string");
  }

  let text = input.trim();
  if (text.startsWith("/**") && text.endsWith("*/")) {
    text = text.slice(3, -2);
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\* ?/, "").trimEnd())
    .join("\n")
    .trim();
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
        text: text.slice(index + 1).trim(),
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
      const member = type.slice(start, index).trim();
      if (member) types.push(member);
      start = index + 1;
    }
  }
  const member = type.slice(start).trim();
  if (member) types.push(member);
  return types.length > 1 ? types : types[0] ?? "";
}

function readTypeScriptProperties(type) {
  if (!type?.startsWith("{") || !type.endsWith("}")) return [];
  return type
    .slice(1, -1)
    .split(/[;,]/)
    .map((property) => property.trim())
    .filter(Boolean)
    .map((property) => readProperty(property));
}

function addProperty(property, result) {
  if (result.typedef.length) {
    result.typedef.at(-1).props[property.name] = property;
  } else {
    result.props.push(property);
  }
}

function markLastPropertyReadonly(result) {
  const properties = result.typedef.length
    ? result.typedef.at(-1).props
    : result.props;
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
      defaultValue: undefined,
      description: descriptionSeparator[2]?.trim() ?? "",
      ...(typescript[1] ? { readonly: true } : {}),
    };
  }

  const match = text.match(/^(\[[^\]]+\]|[^\s=]+)(?:\s*=\s*(.*?))?(?:\s+([\s\S]*))?$/);
  if (!match) {
    return { name: text, type, optional: closureOptional, defaultValue: undefined, description: "" };
  }

  const name = match[1];
  const optional = name.startsWith("[") && name.endsWith("]");
  const unwrappedName = optional ? name.slice(1, -1) : name;
  const [propertyName, bracketDefault] = optional
    ? unwrappedName.split(/=(.*)/s)
    : [unwrappedName, undefined];
  return {
    name: propertyName,
    type,
    optional: optional || closureOptional,
    defaultValue: bracketDefault ?? match[2],
    description: match[3]?.trim() ?? "",
  };
}

function parseTag(name, value, result) {
  switch (name) {
    case "type": {
      const parsed = readTypeAndText(value);
      result.type = {
        type: normalizeType(parsed.type ?? parsed.text),
        readonly: result.type?.readonly ?? false,
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
        props: {},
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

export function parseJSDoc(input) {
  const comment = cleanComment(input);
  if (!comment) return null;
  const lines = comment.split("\n");
  const result = {
    description: "",
    type: null,
    typedef: [],
    props: [],
    readonly: false,
    unkown: {},
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
  if (!result.type && !result.typedef.length && !result.props.length &&
      !result.readonly && !Object.keys(result.unkown).length) {
    return null;
  }
  if (!result.type) delete result.type;
  if (!result.typedef.length) delete result.typedef;
  if (!result.props.length) delete result.props;
  if (!result.readonly) delete result.readonly;
  return result;
}

export default class JSDocParser {
  static parse(input) {
    return parseJSDoc(input);
  }

  static stringify(result, indent = 0) {
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new TypeError("JSDoc result must be an object");
    }
    indent = Number(indent);
    indent = Number.isFinite(indent) ? Math.max(0, Math.floor(indent)) : 0;

    const onlyType = result.type &&
      !result.description &&
      !(result.typedef ?? []).length &&
      !(result.props ?? []).length &&
      !result.readonly &&
      !Object.keys(result.unkown ?? {}).length;
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
      const inlineTypeScript = typedef.type === "object" && associatedProps.length > 0 && associatedProps.every((property) => property.defaultValue === undefined);
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
          const propName = property.optional ? `[${property.name}${property.defaultValue !== undefined ? `=${property.defaultValue}` : ""}]` : property.name;
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
      const name = property.optional ? `[${property.name}${property.defaultValue !== undefined ? `=${property.defaultValue}` : ""}]` : property.name;
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
    const hasContentText = lines.some((line) => line && !line.startsWith("@")) ||
      result.description ||
      (result.props ?? []).length ||
      (result.typedef ?? []).some((typedef) => typedef.description);
    const linePadding = indent > 0
      ? indent + 2
      : (hasContentText ? 2 : 1);
    const openingPadding = " ".repeat(indent);
    const starPrefix = " ".repeat(linePadding) + "*";
    return `${openingPadding}/**\n${lines.map((line) => line ? `${starPrefix} ${line}` : starPrefix).join("\n")}\n${starPrefix}/`;
  }

  parse(input) {
    return parseJSDoc(input);
  }

  stringify(result, indent = 0) {
    return JSDocParser.stringify(result, indent);
  }
}

export const stringifyJSDoc = JSDocParser.stringify;
