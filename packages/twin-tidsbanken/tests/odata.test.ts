import { describe, it, expect } from 'vitest';
import { parseODataQuery } from '../src/odata/parser.js';
import { buildSql } from '../src/odata/sql-builder.js';

describe('OData Parser', () => {
  describe('$select', () => {
    it('parses comma-separated fields', () => {
      const q = parseODataQuery({ $select: 'Fornavn,Etternavn,Epost' });
      expect(q.$select).toEqual(['Fornavn', 'Etternavn', 'Epost']);
    });
  });

  describe('$top and $skip', () => {
    it('parses $top', () => {
      const q = parseODataQuery({ $top: '50' });
      expect(q.$top).toBe(50);
    });

    it('parses $skip', () => {
      const q = parseODataQuery({ $skip: '10' });
      expect(q.$skip).toBe(10);
    });

    it('defaults $top to 100 when not specified', () => {
      const q = parseODataQuery({});
      expect(q.$top).toBe(100);
    });
  });

  describe('$orderby', () => {
    it('parses single field ascending', () => {
      const q = parseODataQuery({ $orderby: 'Fornavn' });
      expect(q.$orderby).toEqual([{ field: 'Fornavn', direction: 'asc' }]);
    });

    it('parses single field descending', () => {
      const q = parseODataQuery({ $orderby: 'AnsattNr desc' });
      expect(q.$orderby).toEqual([{ field: 'AnsattNr', direction: 'desc' }]);
    });

    it('parses multiple fields', () => {
      const q = parseODataQuery({ $orderby: 'Avdeling asc,AnsattNr desc' });
      expect(q.$orderby).toEqual([
        { field: 'Avdeling', direction: 'asc' },
        { field: 'AnsattNr', direction: 'desc' },
      ]);
    });
  });

  describe('$filter — comparison operators', () => {
    it('parses eq with string', () => {
      const q = parseODataQuery({ $filter: "Avdeling eq 'LED'" });
      expect(q.$filter).toEqual({
        type: 'comparison',
        field: 'Avdeling',
        operator: 'eq',
        value: 'LED',
      });
    });

    it('parses eq with number', () => {
      const q = parseODataQuery({ $filter: 'AnsattNr eq 1001' });
      expect(q.$filter).toEqual({
        type: 'comparison',
        field: 'AnsattNr',
        operator: 'eq',
        value: 1001,
      });
    });

    it('parses ne', () => {
      const q = parseODataQuery({ $filter: "Aktiv ne 0" });
      expect(q.$filter).toEqual({
        type: 'comparison',
        field: 'Aktiv',
        operator: 'ne',
        value: 0,
      });
    });

    it('parses gt, ge, lt, le', () => {
      for (const op of ['gt', 'ge', 'lt', 'le'] as const) {
        const q = parseODataQuery({ $filter: `AnsattNr ${op} 1050` });
        expect(q.$filter).toEqual({
          type: 'comparison',
          field: 'AnsattNr',
          operator: op,
          value: 1050,
        });
      }
    });

    it('parses null comparison', () => {
      const q = parseODataQuery({ $filter: 'Fraverstype eq null' });
      expect(q.$filter).toEqual({
        type: 'comparison',
        field: 'Fraverstype',
        operator: 'eq',
        value: null,
      });
    });

    it('parses boolean comparison', () => {
      const q = parseODataQuery({ $filter: 'Aktiv eq true' });
      expect(q.$filter).toEqual({
        type: 'comparison',
        field: 'Aktiv',
        operator: 'eq',
        value: true,
      });
    });

    it('parses datetime literal', () => {
      const q = parseODataQuery({ $filter: "Ansattdato gt datetime'2025-01-01T00:00:00'" });
      expect(q.$filter).toEqual({
        type: 'comparison',
        field: 'Ansattdato',
        operator: 'gt',
        value: '2025-01-01T00:00:00',
      });
    });
  });

  describe('$filter — logical operators', () => {
    it('parses and', () => {
      const q = parseODataQuery({ $filter: "Avdeling eq 'LED' and Aktiv eq 1" });
      expect(q.$filter).toEqual({
        type: 'logical',
        operator: 'and',
        left: { type: 'comparison', field: 'Avdeling', operator: 'eq', value: 'LED' },
        right: { type: 'comparison', field: 'Aktiv', operator: 'eq', value: 1 },
      });
    });

    it('parses or', () => {
      const q = parseODataQuery({ $filter: "Avdeling eq 'LED' or Avdeling eq 'ADM'" });
      expect(q.$filter).toEqual({
        type: 'logical',
        operator: 'or',
        left: { type: 'comparison', field: 'Avdeling', operator: 'eq', value: 'LED' },
        right: { type: 'comparison', field: 'Avdeling', operator: 'eq', value: 'ADM' },
      });
    });

    it('parses not', () => {
      const q = parseODataQuery({ $filter: "not Aktiv eq 0" });
      expect(q.$filter).toEqual({
        type: 'not',
        expression: { type: 'comparison', field: 'Aktiv', operator: 'eq', value: 0 },
      });
    });

    it('parses grouped expression', () => {
      const q = parseODataQuery({ $filter: "(Avdeling eq 'LED' or Avdeling eq 'ADM') and Aktiv eq 1" });
      expect(q.$filter).toEqual({
        type: 'logical',
        operator: 'and',
        left: {
          type: 'logical',
          operator: 'or',
          left: { type: 'comparison', field: 'Avdeling', operator: 'eq', value: 'LED' },
          right: { type: 'comparison', field: 'Avdeling', operator: 'eq', value: 'ADM' },
        },
        right: { type: 'comparison', field: 'Aktiv', operator: 'eq', value: 1 },
      });
    });
  });

  describe('$filter — string functions', () => {
    it('parses startswith', () => {
      const q = parseODataQuery({ $filter: "startswith(Fornavn, 'And')" });
      expect(q.$filter).toEqual({
        type: 'function',
        name: 'startswith',
        field: 'Fornavn',
        value: 'And',
      });
    });

    it('parses endswith', () => {
      const q = parseODataQuery({ $filter: "endswith(Epost, 'ode.no')" });
      expect(q.$filter).toEqual({
        type: 'function',
        name: 'endswith',
        field: 'Epost',
        value: 'ode.no',
      });
    });

    it('parses substringof', () => {
      const q = parseODataQuery({ $filter: "substringof('Hansen', Etternavn)" });
      expect(q.$filter).toEqual({
        type: 'function',
        name: 'substringof',
        field: 'Etternavn',
        value: 'Hansen',
      });
    });
  });

  describe('$expand', () => {
    it('parses expand fields', () => {
      const q = parseODataQuery({ $expand: 'Avdeling,Stemplinger' });
      expect(q.$expand).toEqual(['Avdeling', 'Stemplinger']);
    });
  });
});

describe('OData SQL Builder', () => {
  it('generates parameterized WHERE clause for eq', () => {
    const odata = parseODataQuery({ $filter: "Avdeling eq 'LED'" });
    const sql = buildSql(odata, 'ansatt');
    expect(sql.where).toBe("Avdeling = ?");
    expect(sql.params).toEqual(['LED']);
  });

  it('generates IS NULL for null comparison', () => {
    const odata = parseODataQuery({ $filter: 'Fraverstype eq null' });
    const sql = buildSql(odata, 'timelinje');
    expect(sql.where).toBe("Fraverstype IS NULL");
    expect(sql.params).toEqual([]);
  });

  it('generates AND clause', () => {
    const odata = parseODataQuery({ $filter: "Avdeling eq 'LED' and Aktiv eq 1" });
    const sql = buildSql(odata, 'ansatt');
    expect(sql.where).toBe("(Avdeling = ? AND Aktiv = ?)");
    expect(sql.params).toEqual(['LED', 1]);
  });

  it('generates LIKE for startswith', () => {
    const odata = parseODataQuery({ $filter: "startswith(Fornavn, 'And')" });
    const sql = buildSql(odata, 'ansatt');
    expect(sql.where).toBe("Fornavn LIKE ? || '%'");
    expect(sql.params).toEqual(['And']);
  });

  it('generates LIKE for endswith', () => {
    const odata = parseODataQuery({ $filter: "endswith(Epost, 'ode.no')" });
    const sql = buildSql(odata, 'ansatt');
    expect(sql.where).toBe("Epost LIKE '%' || ?");
    expect(sql.params).toEqual(['ode.no']);
  });

  it('generates LIKE for substringof', () => {
    const odata = parseODataQuery({ $filter: "substringof('Hansen', Etternavn)" });
    const sql = buildSql(odata, 'ansatt');
    expect(sql.where).toBe("Etternavn LIKE '%' || ? || '%'");
    expect(sql.params).toEqual(['Hansen']);
  });

  it('generates ORDER BY', () => {
    const odata = parseODataQuery({ $orderby: 'Fornavn asc,AnsattNr desc' });
    const sql = buildSql(odata, 'ansatt');
    expect(sql.orderBy).toBe('Fornavn ASC, AnsattNr DESC');
  });

  it('generates SELECT with specified columns', () => {
    const odata = parseODataQuery({ $select: 'AnsattNr,Fornavn' });
    const sql = buildSql(odata, 'ansatt');
    expect(sql.select).toBe('AnsattNr, Fornavn');
  });

  it('uses LIMIT and OFFSET', () => {
    const odata = parseODataQuery({ $top: '20', $skip: '40' });
    const sql = buildSql(odata, 'ansatt');
    expect(sql.limit).toBe(20);
    expect(sql.offset).toBe(40);
  });

  it('rejects invalid identifiers', () => {
    expect(() => {
      const odata = parseODataQuery({ $filter: "'; DROP TABLE--; eq 1" });
      buildSql(odata, 'ansatt');
    }).toThrow(); // Parser or SQL builder should reject SQL injection attempts
  });
});
