const { analyzeBody } = require('../src/lib/body');
const { findHeader, pairHeaders } = require('../src/lib/headers');
const { computeShape } = require('../src/lib/shape');
const { buildTable, findTables } = require('../src/lib/tables');

describe('pairHeaders / findHeader', () => {
  it('keeps order, case and duplicates', () => {
    const pairs = pairHeaders(['Host', 'a', 'X-Dup', '1', 'x-dup', '2']);

    expect(pairs).toEqual([
      ['Host', 'a'],
      ['X-Dup', '1'],
      ['x-dup', '2'],
    ]);
  });

  it('finds headers case-insensitively and returns undefined when absent', () => {
    const pairs = [['Content-Type', 'text/plain']];

    expect(findHeader(pairs, 'content-type')).toBe('text/plain');
    expect(findHeader(pairs, 'x-missing')).toBeUndefined();
  });
});

describe('analyzeBody', () => {
  it('reports an empty body', () => {
    expect(analyzeBody(Buffer.alloc(0), null)).toMatchObject({ encoding: 'empty', size: 0 });
  });

  it('treats invalid UTF-8 and NUL-containing bodies as binary (base64)', () => {
    const invalid = analyzeBody(Buffer.from([0xff, 0xfe, 0x01]), null);
    const withNul = analyzeBody(Buffer.from('a\u0000b'), 'text/plain');

    expect(invalid).toMatchObject({ encoding: 'base64', base64: '//4B', isJson: false });
    expect(withNul.encoding).toBe('base64');
  });

  it('detects JSON by content type or by shape, regardless of header', () => {
    const typed = analyzeBody(Buffer.from('{"a":1}'), 'application/json');
    const untyped = analyzeBody(Buffer.from('[1,2]'), 'text/plain');

    expect(typed).toMatchObject({ isJson: true, value: { a: 1 } });
    expect(untyped).toMatchObject({ isJson: true, value: [1, 2] });
  });

  it('keeps malformed JSON and plain text as text', () => {
    expect(analyzeBody(Buffer.from('{"a":'), 'application/json')).toMatchObject({
      encoding: 'utf8',
      isJson: false,
      text: '{"a":',
    });
    expect(analyzeBody(Buffer.from('a=1&b=2'), 'application/x-www-form-urlencoded').isJson).toBe(
      false,
    );
  });
});

describe('computeShape', () => {
  it('is independent of key order and sensitive to the key set', () => {
    expect(computeShape({ a: 1, b: 2 }).hash).toBe(computeShape({ b: 0, a: 9 }).hash);
    expect(computeShape({ a: 1 }).hash).not.toBe(computeShape({ a: 1, b: 2 }).hash);
  });

  it('keeps the original key order and ignores non-objects and empty objects', () => {
    expect(computeShape({ z: 1, a: 2 }).keys).toEqual(['z', 'a']);
    expect(computeShape([{ a: 1 }])).toBeNull();
    expect(computeShape({})).toBeNull();
    expect(computeShape(null)).toBeNull();
    expect(computeShape('text')).toBeNull();
  });
});

describe('findTables', () => {
  it('finds arrays of objects nested under keys, flattening nested objects', () => {
    const tables = findTables({
      data: { users: [{ id: 1, name: 'a', address: { city: 'X' } }, { id: 2, name: 'b' }] },
      tags: ['a', 'b'],
    });

    expect(tables).toHaveLength(1);
    expect(tables[0]).toMatchObject({
      path: '$.data.users',
      totalRows: 2,
      columns: ['id', 'name', 'address.city'],
      rows: [
        [1, 'a', 'X'],
        [2, 'b', null],
      ],
    });
  });

  it('finds a root-level array of objects', () => {
    const tables = findTables([{ a: 1 }, { a: 2 }]);

    expect(tables).toHaveLength(1);
    expect(tables[0].path).toBe('$');
  });

  it('ignores single-element arrays, arrays of primitives and mixed arrays', () => {
    expect(findTables({ one: [{ a: 1 }], nums: [1, 2], mixed: [{ a: 1 }, 5] })).toEqual([]);
  });

  it('uses bracket notation for keys that are not identifiers', () => {
    const [table] = findTables({ 'weird key': [{ a: 1 }, { a: 2 }] });

    expect(table.path).toBe('$["weird key"]');
  });

  it('stringifies arrays inside rows instead of producing nested tables', () => {
    const tables = findTables({
      orders: [
        { id: 1, items: [{ s: 1 }, { s: 2 }] },
        { id: 2, items: [] },
      ],
    });

    expect(tables).toHaveLength(1);
    expect(tables[0].rows).toEqual([
      [1, '[{"s":1},{"s":2}]'],
      [2, '[]'],
    ]);
  });

  it('caps the number of rows returned but reports the total', () => {
    const rows = Array.from({ length: 1500 }, (_, i) => ({ i }));

    const [table] = findTables(rows);

    expect(table.rows).toHaveLength(1000);
    expect(table.totalRows).toBe(1500);
  });

  it('returns nothing for scalars and null', () => {
    expect(findTables(null)).toEqual([]);
    expect(findTables(42)).toEqual([]);
    expect(findTables('text')).toEqual([]);
  });
});

describe('buildTable', () => {
  it('orders columns by the preferred top-level key order', () => {
    const table = buildTable([{ b: 1, a: { z: 1, y: 2 } }], { keyOrder: ['a', 'b'] });

    expect(table.columns).toEqual(['a.z', 'a.y', 'b']);
  });

  it('caps columns and flags truncation', () => {
    const wide = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`k${i}`, i]));

    const table = buildTable([wide]);

    expect(table.columns).toHaveLength(50);
    expect(table.columnsTruncated).toBe(true);
    expect(table.rows[0]).toHaveLength(50);
  });

  it('turns objects nested deeper than three levels into JSON strings', () => {
    const table = buildTable([{ a: { b: { c: { d: { e: 1 } } } } }]);

    expect(table.columns).toEqual(['a.b.c.d']);
    expect(table.rows[0][0]).toBe('{"e":1}');
  });
});
