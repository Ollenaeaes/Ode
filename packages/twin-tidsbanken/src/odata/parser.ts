import type { ODataQuery, FilterExpression, OrderByClause } from './types.js';

const DEFAULT_PAGE_SIZE = 100;

/**
 * Parse OData v3 query string parameters into a structured query object.
 */
export function parseODataQuery(query: Record<string, string | undefined>): ODataQuery {
  const result: ODataQuery = {};

  if (query.$select) {
    result.$select = query.$select.split(',').map((s) => s.trim());
  }

  if (query.$filter) {
    result.$filter = parseFilter(query.$filter);
  }

  if (query.$orderby) {
    result.$orderby = parseOrderBy(query.$orderby);
  }

  if (query.$expand) {
    result.$expand = query.$expand.split(',').map((s) => s.trim());
  }

  if (query.$skip) {
    const skip = parseInt(query.$skip, 10);
    if (!isNaN(skip) && skip >= 0) result.$skip = skip;
  }

  if (query.$top) {
    const top = parseInt(query.$top, 10);
    if (!isNaN(top) && top > 0) result.$top = top;
  } else {
    result.$top = DEFAULT_PAGE_SIZE;
  }

  return result;
}

function parseOrderBy(input: string): OrderByClause[] {
  return input.split(',').map((part) => {
    const tokens = part.trim().split(/\s+/);
    return {
      field: tokens[0],
      direction: (tokens[1]?.toLowerCase() === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc',
    };
  });
}

/**
 * Recursive descent parser for OData $filter expressions.
 * Handles: comparisons, and/or, not, string functions, datetime literals.
 */
function parseFilter(input: string): FilterExpression {
  const tokens = tokenize(input);
  let pos = 0;

  function peek(): string | undefined {
    return tokens[pos];
  }

  function consume(): string {
    return tokens[pos++];
  }

  function expect(value: string): void {
    const got = consume();
    if (got !== value) {
      throw new Error(`Expected '${value}' but got '${got}'`);
    }
  }

  function parseOr(): FilterExpression {
    let left = parseAnd();
    while (peek()?.toLowerCase() === 'or') {
      consume();
      const right = parseAnd();
      left = { type: 'logical', operator: 'or', left, right };
    }
    return left;
  }

  function parseAnd(): FilterExpression {
    let left = parseUnary();
    while (peek()?.toLowerCase() === 'and') {
      consume();
      const right = parseUnary();
      left = { type: 'logical', operator: 'and', left, right };
    }
    return left;
  }

  function parseUnary(): FilterExpression {
    if (peek()?.toLowerCase() === 'not') {
      consume();
      const expression = parsePrimary();
      return { type: 'not', expression };
    }
    return parsePrimary();
  }

  function parsePrimary(): FilterExpression {
    const token = peek();

    if (!token) {
      throw new Error('Unexpected end of filter expression');
    }

    // Grouped expression
    if (token === '(') {
      consume();
      const expr = parseOr();
      expect(')');
      return expr;
    }

    // String functions: startswith, endswith, substringof
    const lower = token.toLowerCase();
    if (lower === 'startswith' || lower === 'endswith' || lower === 'substringof') {
      return parseFunction();
    }

    // Comparison: field op value
    return parseComparison();
  }

  function parseFunction(): FilterExpression {
    const name = consume().toLowerCase() as 'startswith' | 'endswith' | 'substringof';
    expect('(');

    if (name === 'substringof') {
      // substringof('value', field)
      const value = parseStringValue(consume());
      expect(',');
      const field = consume();
      expect(')');
      // OData: substringof('value', field) eq true — consume optional eq true
      if (peek()?.toLowerCase() === 'eq') {
        consume();
        consume(); // 'true'
      }
      return { type: 'function', name, field, value };
    }

    // startswith(field, 'value') / endswith(field, 'value')
    const field = consume();
    expect(',');
    const value = parseStringValue(consume());
    expect(')');
    // Consume optional eq true
    if (peek()?.toLowerCase() === 'eq') {
      consume();
      consume(); // 'true'
    }
    return { type: 'function', name, field, value };
  }

  function parseComparison(): FilterExpression {
    const field = consume();
    const operator = consume().toLowerCase() as 'eq' | 'ne' | 'gt' | 'ge' | 'lt' | 'le';
    const rawValue = consume();
    const value = parseValue(rawValue);
    return { type: 'comparison', field, operator, value };
  }

  function parseStringValue(raw: string): string {
    if (raw.startsWith("'") && raw.endsWith("'")) {
      return raw.slice(1, -1).replace(/''/g, "'");
    }
    return raw;
  }

  function parseValue(raw: string): string | number | boolean | null {
    if (raw === 'null') return null;
    if (raw === 'true') return true;
    if (raw === 'false') return false;

    // datetime literal: datetime'2025-12-01T00:00:00'
    if (raw.toLowerCase().startsWith("datetime'") && raw.endsWith("'")) {
      return raw.slice(9, -1); // Extract ISO date string
    }

    // String literal
    if (raw.startsWith("'") && raw.endsWith("'")) {
      return raw.slice(1, -1).replace(/''/g, "'");
    }

    // Number
    const num = Number(raw);
    if (!isNaN(num)) return num;

    return raw;
  }

  const result = parseOr();

  if (pos < tokens.length) {
    throw new Error(`Unexpected token: ${tokens[pos]}`);
  }

  return result;
}

/**
 * Tokenize an OData filter string. Handles quoted strings, parentheses,
 * commas, and datetime literals.
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < input.length) {
    // Skip whitespace
    if (input[i] === ' ' || input[i] === '\t') {
      i++;
      continue;
    }

    // Parentheses and commas
    if (input[i] === '(' || input[i] === ')' || input[i] === ',') {
      tokens.push(input[i]);
      i++;
      continue;
    }

    // datetime literal: datetime'...'
    if (input.substring(i, i + 9).toLowerCase() === "datetime'") {
      const end = input.indexOf("'", i + 9);
      if (end === -1) throw new Error('Unterminated datetime literal');
      tokens.push(input.substring(i, end + 1));
      i = end + 1;
      continue;
    }

    // Quoted string
    if (input[i] === "'") {
      let j = i + 1;
      while (j < input.length) {
        if (input[j] === "'") {
          // Check for escaped quote ''
          if (j + 1 < input.length && input[j + 1] === "'") {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      tokens.push(input.substring(i, j + 1));
      i = j + 1;
      continue;
    }

    // Word / number / identifier
    let j = i;
    while (j < input.length && input[j] !== ' ' && input[j] !== '\t' &&
           input[j] !== '(' && input[j] !== ')' && input[j] !== ',') {
      j++;
    }
    if (j > i) {
      tokens.push(input.substring(i, j));
      i = j;
    } else {
      i++;
    }
  }

  return tokens;
}
