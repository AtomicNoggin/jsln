/**
 * Quick text parsing engine. Takes in a large text string and provides helper methods to pull text off the front, 
 * while tracking line and column count of parsed text. Intended to be internally used by other more complex parsers, so method inputs are not sanitized. 
 */
export default class Parser {
  #remaining =  "";
  #line = 1;
  #col = 0;
  #updateLineCol(found) {
    const lines = found.split('\n');
    if (lines.length > 1) {
      this.#line += lines.length-1;
      this.#col = 0;
    }
    this.#col += (lines.pop()).length;
   }
  /**
   * The text to be parsed. This class only keeps track the remaining text as it parses. 
   * @param {string} text 
   */
  constructor (text) {
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
  appendText(text='') {
    return (this.#remaining += text);
  }
  /**
   * copy the next (amount) characters of remaining text, leaving the original string in place
   * @param {number} amount optional number of characters to read. defaults to 1
   * @returns {string} the next (amount) characters of the remaining text, or empty string if remaining text length is less than amount
   */
  readNext(amount=1) {
    const count = Number(amount);
    if (!Number.isFinite(count) || count <= 0) return '';
    return this.#remaining.slice(0, Math.min(count, this.#remaining.length));
  }
  /**
   * remove the next (amount) characters from the remaining text and return them
   * @param {number} amount optional number of characters to remove. defaults to 1
   * @returns {string} the next (amount) characters, removed from the remaining text, or empty string if remaining text length is less than amount
   */
  getNext(amount=1) {
    const count = Number(amount);
    if (!Number.isFinite(count) || count <= 0) return '';
    const [found,remain] = this.#remaining.match(RegExp(`^((?:.{${amount}})?)(.*)`,'s')).slice(1, 3);
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
  getNextIf(check,amount=1,flags='') {
    let count;
    if (amount === amount+'') {
      count = amount.split(',').map(Number);
      count.length = 2;
      if ((!count.every(Number.isFinite) || count.some(c => c < 0)) && count[0] > count[1]) {
        return '';
      }
      count = count.join(',');
    }
    else {
      count = Number(amount);
      if (!Number.isFinite(count) || count <= 0) return '';
    }
    const [found,remain] = this.#remaining.match(RegExp(`^((?:[${check}]{${amount}})?)(.*)`, 's'+flags)).slice(1, 3);    
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
  getWS () {
    const [found,remain] = this.#remaining.match(/^([\s]*)(.*)/s).slice(1, 3);
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
  getWhileMatching(check,flags = '') {
    const [found,remain] = this.#remaining.match(RegExp(`^([${check}]*)(.*)`, 's'+flags)).slice(1, 3);
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
  getUntilMatching(check,flags = '') {
    const [found,stop,remain] = this.#remaining.match(RegExp(`^([^${check}]*)([${check}]?)(.*)`, 's'+flags)).slice(1, 4);
    if (found || stop) {
      this.#updateLineCol(found+stop);
      this.#remaining = remain;
    }
    return [found,stop];
  }
  /**
   * the amount of text parsed from the provided text, as number of new lines (\n) found and number of characters in the last line
   * @returns {array} a two entry number array consisting of the line count and col count of all characters removed from the provided text to this point.
   */
  lastPosition() {
    return [this.#line,this.#col];
  }
  /**
   * throw an error message, adding the line and col count to the end
   * @param {*} msg the error message to throw
   * @param {*} errorType optional error type. Defaults to SyntaxError
   */
  throw(msg,errorType=SyntaxError) {
    throw new errorType(`${msg} (at line ${this.#line}, col ${this.#col})`);
  }
}
