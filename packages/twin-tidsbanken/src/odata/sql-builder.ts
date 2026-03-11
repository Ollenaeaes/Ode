import type { FilterExpression, ODataQuery, SqlResult } from './types.js';

const DEFAULT_PAGE_SIZE = 100;

/**
 * Convert a parsed OData query into parameterized SQL clauses.
 * NEVER concatenates filter values into SQL strings.
 */
export function buildSql(odata: ODataQuery, tableName: string): SqlResult {
  const params: unknown[] = [];

  // SELECT
  const select = odata.$select && odata.$select.length > 0
    ? odata.$select.join(', ')
    : '*';

  // WHERE
  let where = '';
  if (odata.$filter) {
    const { sql, values } = buildWhere(odata.$filter);
    where = sql;
    params.push(...values);
  }

  // ORDER BY
  let orderBy = '';
  if (odata.$orderby && odata.$orderby.length > 0) {
    orderBy = odata.$orderby
      .map((o) => `${sanitizeIdentifier(o.field)} ${o.direction.toUpperCase()}`)
      .join(', ');
  }

  // LIMIT + OFFSET
  const limit = odata.$top ?? DEFAULT_PAGE_SIZE;
  const offset = odata.$skip ?? 0;

  return { where, params, orderBy, select, limit, offset };
}

function buildWhere(filter: FilterExpression): { sql: string; values: unknown[] } {
  switch (filter.type) {
    case 'comparison': {
      const field = sanitizeIdentifier(filter.field);
      const op = sqlOperator(filter.operator);
      if (filter.value === null) {
        if (filter.operator === 'eq') {
          return { sql: `${field} IS NULL`, values: [] };
        }
        return { sql: `${field} IS NOT NULL`, values: [] };
      }
      return { sql: `${field} ${op} ?`, values: [filter.value] };
    }

    case 'logical': {
      const left = buildWhere(filter.left);
      const right = buildWhere(filter.right);
      const op = filter.operator.toUpperCase();
      return {
        sql: `(${left.sql} ${op} ${right.sql})`,
        values: [...left.values, ...right.values],
      };
    }

    case 'not': {
      const inner = buildWhere(filter.expression);
      return { sql: `NOT (${inner.sql})`, values: inner.values };
    }

    case 'function': {
      const field = sanitizeIdentifier(filter.field);
      switch (filter.name) {
        case 'startswith':
          return { sql: `${field} LIKE ? || '%'`, values: [filter.value] };
        case 'endswith':
          return { sql: `${field} LIKE '%' || ?`, values: [filter.value] };
        case 'substringof':
          return { sql: `${field} LIKE '%' || ? || '%'`, values: [filter.value] };
      }
    }
  }
}

function sqlOperator(op: string): string {
  const map: Record<string, string> = {
    eq: '=',
    ne: '!=',
    gt: '>',
    ge: '>=',
    lt: '<',
    le: '<=',
  };
  return map[op] || '=';
}

/**
 * Sanitize an identifier to prevent SQL injection through field names.
 * Only allows alphanumeric, underscore, and dot characters.
 */
function sanitizeIdentifier(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return name;
}

/**
 * Execute an OData query against a SQLite database.
 */
export function executeODataQuery(
  db: import('better-sqlite3').Database,
  tableName: string,
  odata: ODataQuery,
  baseUrl: string,
): { value: Record<string, unknown>[]; '@odata.nextLink'?: string } {
  const sql = buildSql(odata, tableName);

  let query = `SELECT ${sql.select} FROM ${sanitizeIdentifier(tableName)}`;
  if (sql.where) {
    query += ` WHERE ${sql.where}`;
  }
  if (sql.orderBy) {
    query += ` ORDER BY ${sql.orderBy}`;
  }
  // Fetch one extra row to know if there's a next page
  query += ` LIMIT ? OFFSET ?`;
  const allParams = [...sql.params, sql.limit + 1, sql.offset];

  const rows = db.prepare(query).all(...allParams) as Record<string, unknown>[];

  const hasMore = rows.length > sql.limit;
  const value = hasMore ? rows.slice(0, sql.limit) : rows;

  const result: { value: Record<string, unknown>[]; '@odata.nextLink'?: string } = { value };

  if (hasMore) {
    const nextSkip = sql.offset + sql.limit;
    const nextUrl = new URL(baseUrl);
    nextUrl.searchParams.set('$skip', String(nextSkip));
    if (odata.$top) nextUrl.searchParams.set('$top', String(odata.$top));
    if (odata.$select) nextUrl.searchParams.set('$select', odata.$select.join(','));
    if (odata.$orderby) {
      nextUrl.searchParams.set('$orderby',
        odata.$orderby.map((o) => `${o.field} ${o.direction}`).join(','));
    }
    result['@odata.nextLink'] = nextUrl.toString();
  }

  return result;
}
