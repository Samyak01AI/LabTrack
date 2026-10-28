/**
 * Tokenizer for C++ and Java source code.
 * Strips comments and whitespace, tracks 1-based line numbers,
 * normalizes identifiers and literals to structure-aware canonical symbols,
 * and preserves control-flow keywords and operators.
 */

const KEYWORDS = new Set([
  // Control flow & statements
  'if', 'else', 'while', 'for', 'do', 'switch', 'case', 'default',
  'break', 'continue', 'return', 'goto', 'try', 'catch', 'throw', 'throws', 'finally',
  // Types & declarations
  'int', 'long', 'short', 'char', 'float', 'double', 'bool', 'boolean', 'void',
  'auto', 'const', 'constexpr', 'static', 'extern', 'inline', 'virtual', 'override',
  'explicit', 'mutable', 'volatile', 'register', 'signed', 'unsigned', 'typedef', 'using',
  'sizeof', 'alignof', 'decltype', 'nullptr', 'null', 'true', 'false',
  // Object-oriented & structures
  'class', 'struct', 'union', 'enum', 'interface', 'extends', 'implements',
  'public', 'private', 'protected', 'package', 'namespace',
  'new', 'delete', 'this', 'super', 'instanceof', 'template', 'typename',
  'operator', 'friend', 'synchronized', 'final', 'abstract', 'native', 'transient',
]);

const MULTI_CHAR_OPERATORS = [
  '::', '->*', '->', '++', '--', '==', '!=', '<=', '>=', '&&', '||',
  '<<=', '>>=', '<<', '>>', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=',
  '##', '...',
];

const SINGLE_CHAR_OPERATORS = new Set([
  '+', '-', '*', '/', '%', '=', '<', '>', '!', '&', '|', '^', '~',
  '?', ':', '.', ',', ';', '(', ')', '[', ']', '{', '}',
]);

/**
 * Tokenizes C++ or Java source code into structure-aware canonical tokens.
 * @param {string} source - Source code
 * @param {string} [language='C++20'] - 'C++20' or 'Java 21'
 * @returns {Array<{ type: string, value: string, normalized: string, line: number, col: number, isBoilerplate?: boolean }>}
 */
export function tokenize(source, language = 'C++20') {
  if (typeof source !== 'string') return [];
  const tokens = [];
  const length = source.length;
  let index = 0;
  let line = 1;
  let col = 1;

  function advance(count = 1) {
    for (let i = 0; i < count; i++) {
      if (source[index + i] === '\n') {
        line++;
        col = 1;
      } else {
        col++;
      }
    }
    index += count;
  }

  while (index < length) {
    const char = source[index];

    // 1. Whitespace
    if (/\s/.test(char)) {
      advance(1);
      continue;
    }

    // 2. Comments
    if (char === '/' && source[index + 1] === '/') {
      // Single-line comment: skip until newline
      while (index < length && source[index] !== '\n') {
        advance(1);
      }
      continue;
    }

    if (char === '/' && source[index + 1] === '*') {
      // Multi-line comment: skip until */
      advance(2);
      while (index < length && !(source[index] === '*' && source[index + 1] === '/')) {
        advance(1);
      }
      if (index < length) advance(2); // Skip closing */
      continue;
    }

    // 3. Preprocessor directives (C++) or import/package statements (Java/C++)
    if (char === '#' || (source.slice(index, index + 7) === 'package' || source.slice(index, index + 6) === 'import')) {
      const isPreprocessor = char === '#';
      const tokenLine = line;
      const tokenCol = col;
      let stmt = '';

      if (isPreprocessor) {
        // Read until newline (handling backslash continuations)
        while (index < length) {
          if (source[index] === '\\' && source[index + 1] === '\n') {
            advance(2);
            continue;
          }
          if (source[index] === '\n') break;
          stmt += source[index];
          advance(1);
        }
      } else {
        // Read until ';'
        while (index < length && source[index] !== ';') {
          stmt += source[index];
          advance(1);
        }
        if (source[index] === ';') {
          stmt += ';';
          advance(1);
        }
      }

      tokens.push({
        type: 'BOILERPLATE',
        value: stmt.trim(),
        normalized: 'BP',
        line: tokenLine,
        col: tokenCol,
        isBoilerplate: true,
      });
      continue;
    }

    // 4. String Literals
    if (char === '"') {
      const tokenLine = line;
      const tokenCol = col;
      let str = '"';
      advance(1);
      let escaped = false;

      while (index < length) {
        const c = source[index];
        str += c;
        if (escaped) {
          escaped = false;
        } else if (c === '\\') {
          escaped = true;
        } else if (c === '"') {
          advance(1);
          break;
        } else if (c === '\n') {
          // Unclosed string before newline
          break;
        }
        advance(1);
      }

      tokens.push({
        type: 'LITERAL_STRING',
        value: str,
        normalized: 'S',
        line: tokenLine,
        col: tokenCol,
      });
      continue;
    }

    // 5. Character Literals
    if (char === "'") {
      const tokenLine = line;
      const tokenCol = col;
      let lit = "'";
      advance(1);
      let escaped = false;

      while (index < length) {
        const c = source[index];
        lit += c;
        if (escaped) {
          escaped = false;
        } else if (c === '\\') {
          escaped = true;
        } else if (c === "'") {
          advance(1);
          break;
        } else if (c === '\n') {
          break;
        }
        advance(1);
      }

      tokens.push({
        type: 'LITERAL_CHAR',
        value: lit,
        normalized: 'C',
        line: tokenLine,
        col: tokenCol,
      });
      continue;
    }

    // 6. Numeric Literals (Hex, Binary, Decimal, Float)
    if (/\d/.test(char) || (char === '.' && /\d/.test(source[index + 1]))) {
      const tokenLine = line;
      const tokenCol = col;
      let num = '';

      while (index < length && /[\da-zA-Z_.']/.test(source[index])) {
        num += source[index];
        advance(1);
      }

      tokens.push({
        type: 'LITERAL_NUMBER',
        value: num,
        normalized: 'N',
        line: tokenLine,
        col: tokenCol,
      });
      continue;
    }

    // 7. Identifiers or Keywords
    if (/[a-zA-Z_$]/.test(char)) {
      const tokenLine = line;
      const tokenCol = col;
      let ident = '';

      while (index < length && /[a-zA-Z0-9_$]/.test(source[index])) {
        ident += source[index];
        advance(1);
      }

      if (ident === 'true' || ident === 'false') {
        tokens.push({
          type: 'LITERAL_BOOL',
          value: ident,
          normalized: 'B',
          line: tokenLine,
          col: tokenCol,
        });
      } else if (KEYWORDS.has(ident)) {
        tokens.push({
          type: 'KEYWORD',
          value: ident,
          normalized: ident,
          line: tokenLine,
          col: tokenCol,
        });
      } else {
        tokens.push({
          type: 'IDENTIFIER',
          value: ident,
          normalized: 'V', // Normalized variable/function identifier for alpha-conversion
          line: tokenLine,
          col: tokenCol,
        });
      }
      continue;
    }

    // 8. Multi-character Operators
    let matchedOp = null;
    for (const op of MULTI_CHAR_OPERATORS) {
      if (source.slice(index, index + op.length) === op) {
        matchedOp = op;
        break;
      }
    }
    if (matchedOp) {
      tokens.push({
        type: 'OPERATOR',
        value: matchedOp,
        normalized: matchedOp,
        line,
        col,
      });
      advance(matchedOp.length);
      continue;
    }

    // 9. Single-character Operators & Delimiters
    if (SINGLE_CHAR_OPERATORS.has(char)) {
      tokens.push({
        type: 'OPERATOR',
        value: char,
        normalized: char,
        line,
        col,
      });
      advance(1);
      continue;
    }

    // Any other character
    advance(1);
  }

  return tokens;
}

