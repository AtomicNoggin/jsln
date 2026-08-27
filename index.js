import JSLNParser from "./jsln-parser.js";
import JSLNStringifier from "./jsln-stringifier.js";

export default class JSLN {
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
}
