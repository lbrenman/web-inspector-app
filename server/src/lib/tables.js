const { isPlainObject } = require('./shape');

const MAX_ROWS = 1000;
const MAX_COLUMNS = 50;
const MAX_TABLES = 20;
const MAX_FLATTEN_DEPTH = 3;
const MAX_SEARCH_DEPTH = 6;
const MIN_TABLE_ROWS = 2;

const SAFE_KEY = /^[A-Za-z_$][\w$]*$/;

function cellValue(value) {
  return value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
}

function orderKeys(keys, preferred) {
  const present = new Set(keys);
  const first = preferred.filter((key) => present.has(key));
  const firstSet = new Set(first);
  return [...first, ...keys.filter((key) => !firstSet.has(key))];
}

/**
 * Flattens an object into a Map of dotted path -> cell value. Nested objects are flattened up to
 * MAX_FLATTEN_DEPTH levels; arrays and anything deeper become JSON strings.
 */
function flattenObject(object, keyOrder) {
  const out = new Map();

  function walk(value, prefix, depth, order) {
    const keys = order ? orderKeys(Object.keys(value), order) : Object.keys(value);
    for (const key of keys) {
      const child = value[key];
      const path = prefix ? `${prefix}.${key}` : key;
      if (isPlainObject(child) && Object.keys(child).length > 0 && depth < MAX_FLATTEN_DEPTH) {
        walk(child, path, depth + 1, null);
      } else {
        out.set(path, cellValue(child));
      }
    }
  }

  walk(object, '', 0, keyOrder);
  return out;
}

/**
 * Builds a table from an array of objects. Columns are the union of all flattened paths in
 * first-seen order (capped); missing cells are null. `keyOrder` pins the order of top-level keys.
 */
function buildTable(objects, { keyOrder } = {}) {
  const flattened = objects.map((object) => flattenObject(object, keyOrder));

  const columns = [];
  const seen = new Set();
  let columnsTruncated = false;
  for (const row of flattened) {
    for (const column of row.keys()) {
      if (seen.has(column)) continue;
      if (columns.length >= MAX_COLUMNS) {
        columnsTruncated = true;
        continue;
      }
      seen.add(column);
      columns.push(column);
    }
  }

  const rows = flattened.map((row) => columns.map((column) => (row.has(column) ? row.get(column) : null)));
  return { columns, rows, columnsTruncated };
}

function childPath(parent, key) {
  return SAFE_KEY.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}

/**
 * Finds arrays of objects inside a parsed JSON value (at the root or under object keys) and
 * returns each as a table. Arrays are not searched recursively, so rows never produce nested tables.
 */
function findTables(root) {
  const tables = [];

  function walk(value, path, depth) {
    if (tables.length >= MAX_TABLES) return;

    if (Array.isArray(value)) {
      if (value.length >= MIN_TABLE_ROWS && value.every(isPlainObject)) {
        tables.push({
          path,
          totalRows: value.length,
          ...buildTable(value.slice(0, MAX_ROWS)),
        });
      }
      return;
    }

    if (isPlainObject(value) && depth < MAX_SEARCH_DEPTH) {
      for (const [key, child] of Object.entries(value)) {
        walk(child, childPath(path, key), depth + 1);
      }
    }
  }

  walk(root, '$', 0);
  return tables;
}

module.exports = { buildTable, findTables, flattenObject };
