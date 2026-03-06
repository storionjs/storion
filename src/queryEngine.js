/**
 * Query Engine - JSON query language for filtering and sorting table data.
 * Framework-agnostic; no DOM or storage dependencies.
 */

const COLUMN_TYPES = ['int', 'float', 'boolean', 'string', 'json'];

export const QUERY_OPERATORS = [
  'eq', 'ne', 'gt', 'gte', 'lt', 'lte',
  'contains', 'startsWith', 'endsWith',
  'in', 'notIn', 'isNull', 'isNotNull'
];

function getColName(col) {
  if (typeof col === 'string') return col;
  if (col && typeof col === 'object' && col.name) return col.name;
  return null;
}

function getColumnType(columns, colName) {
  if (!Array.isArray(columns)) return 'string';
  const col = columns.find(c => getColName(c) === colName);
  if (!col) return 'string';
  return typeof col === 'string' ? 'string' : (col.type || 'string');
}

function coerceValue(value, type) {
  if (value === null || value === undefined || value === '') {
    return type === 'boolean' ? false : null;
  }
  switch (type) {
    case 'int': {
      const i = parseInt(value, 10);
      return isNaN(i) ? null : i;
    }
    case 'float': {
      const f = parseFloat(value);
      return isNaN(f) ? null : f;
    }
    case 'boolean':
      if (typeof value === 'boolean') return value;
      return String(value).toLowerCase() === 'true' || String(value).toLowerCase() === '1' || String(value).toLowerCase() === 'yes';
    case 'json':
      if (typeof value === 'object') return value;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    case 'string':
    default:
      return String(value);
  }
}

function getRowValue(row, field) {
  if (!row || typeof row !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(row, field)) return null;
  return row[field];
}

export function validateQuery(query, columns) {
  if (query == null || typeof query !== 'object') {
    return { valid: true };
  }

  const colNames = Array.isArray(columns)
    ? columns.map(c => getColName(c)).filter(Boolean)
    : [];

  function checkField(field, context) {
    if (typeof field !== 'string' || !field.trim()) {
      return `Invalid or missing field in ${context}`;
    }
    if (!colNames.includes(field)) {
      return `Unknown column: ${field}`;
    }
    return null;
  }

  function validateWhere(where, depth) {
    if (where == null) return null;
    if (depth > 50) return 'Where clause too deeply nested';

    if (Array.isArray(where.and)) {
      for (const item of where.and) {
        const err = validateWhere(item, depth + 1);
        if (err) return err;
      }
      return null;
    }
    if (Array.isArray(where.or)) {
      for (const item of where.or) {
        const err = validateWhere(item, depth + 1);
        if (err) return err;
      }
      return null;
    }

    if (where.field != null) {
      const err = checkField(where.field, 'where');
      if (err) return err;
      const op = where.op;
      if (typeof op !== 'string' || !QUERY_OPERATORS.includes(op)) {
        return `Invalid operator: ${op}. Allowed: ${QUERY_OPERATORS.join(', ')}`;
      }
      if ((op === 'in' || op === 'notIn') && !Array.isArray(where.value)) {
        return `Operator "${op}" requires "value" to be an array`;
      }
      return null;
    }

    return 'Invalid where clause: expected "field"/"op"/"value" or "and"/"or"';
  }

  function validateOrderBy(orderBy) {
    if (orderBy == null) return null;
    if (!Array.isArray(orderBy)) return 'orderBy must be an array';
    for (let i = 0; i < orderBy.length; i++) {
      const item = orderBy[i];
      if (!item || typeof item !== 'object') return `orderBy[${i}] must be { field, direction }`;
      const err = checkField(item.field, `orderBy[${i}]`);
      if (err) return err;
      const dir = item.direction;
      if (dir != null && dir !== 'asc' && dir !== 'desc') {
        return `orderBy[${i}].direction must be "asc" or "desc"`;
      }
    }
    return null;
  }

  const whereErr = validateWhere(query.where, 0);
  if (whereErr) return { valid: false, error: whereErr };

  const orderErr = validateOrderBy(query.orderBy);
  if (orderErr) return { valid: false, error: orderErr };

  if (query.limit != null && (typeof query.limit !== 'number' || query.limit < 0 || !Number.isInteger(query.limit))) {
    return { valid: false, error: 'limit must be a non-negative integer' };
  }
  if (query.offset != null && (typeof query.offset !== 'number' || query.offset < 0 || !Number.isInteger(query.offset))) {
    return { valid: false, error: 'offset must be a non-negative integer' };
  }

  return { valid: true };
}

function toComparableString(value, type) {
  if (value == null) return '';
  if (type === 'json') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function evaluatePredicate(row, condition, columns) {
  const { field, op, value } = condition;
  const type = getColumnType(columns, field);
  const raw = getRowValue(row, field);
  const cell = raw === undefined || raw === null ? null : coerceValue(raw, type);

  const str = cell != null ? toComparableString(cell, type) : '';
  const strLower = str.toLowerCase();
  const valueStr = value != null && value !== undefined ? toComparableString(value, type) : '';
  const valueStrLower = valueStr.toLowerCase();

  switch (op) {
    case 'eq':
      if (cell === null) return value === null || value === undefined;
      if (type === 'string' || type === 'json') return strLower === valueStrLower;
      return cell === coerceValue(value, type);
    case 'ne':
      if (cell === null) return value !== null && value !== undefined;
      if (type === 'string' || type === 'json') return strLower !== valueStrLower;
      return cell !== coerceValue(value, type);
    case 'gt':
      if (cell == null) return false;
      return Number(cell) > Number(coerceValue(value, type));
    case 'gte':
      if (cell == null) return false;
      return Number(cell) >= Number(coerceValue(value, type));
    case 'lt':
      if (cell == null) return false;
      return Number(cell) < Number(coerceValue(value, type));
    case 'lte':
      if (cell == null) return false;
      return Number(cell) <= Number(coerceValue(value, type));
    case 'contains':
      return strLower.includes(valueStrLower);
    case 'startsWith':
      return strLower.startsWith(valueStrLower);
    case 'endsWith':
      return strLower.endsWith(valueStrLower);
    case 'in': {
      const arr = Array.isArray(value) ? value : [];
      return arr.some(v => {
        const coerced = coerceValue(v, type);
        if (type === 'string' || type === 'json') {
          const coercedStr = toComparableString(coerced, type).toLowerCase();
          return strLower === coercedStr;
        }
        return cell === coerced;
      });
    }
    case 'notIn': {
      const arr = Array.isArray(value) ? value : [];
      return !arr.some(v => {
        const coerced = coerceValue(v, type);
        if (type === 'string' || type === 'json') {
          const coercedStr = toComparableString(coerced, type).toLowerCase();
          return strLower === coercedStr;
        }
        return cell === coerced;
      });
    }
    case 'isNull':
      return cell === null || cell === undefined;
    case 'isNotNull':
      return cell !== null && cell !== undefined;
    default:
      return false;
  }
}

function evaluateWhere(row, where, columns) {
  if (where == null) return true;

  if (Array.isArray(where.and)) {
    return where.and.every(item => evaluateWhere(row, item, columns));
  }
  if (Array.isArray(where.or)) {
    return where.or.some(item => evaluateWhere(row, item, columns));
  }

  if (where.field != null && where.op != null) {
    return evaluatePredicate(row, where, columns);
  }

  return true;
}

/**
 * Execute query: filter, sort, and apply limit/offset.
 * @param {Array<Object>} rows - All row objects
 * @param {Array} columns - Table columns (string[] or { name, type }[])
 * @param {Object} query - Query object (where, orderBy, limit, offset)
 * @returns {{ rows: Array<Object>, totalCount: number }}
 */
export function executeQuery(rows, columns, query) {
  if (!Array.isArray(rows)) return { rows: [], totalCount: 0 };
  if (query == null || typeof query !== 'object') {
    return { rows: [...rows], totalCount: rows.length };
  }

  let result = rows.filter(row => evaluateWhere(row, query.where, columns));

  if (Array.isArray(query.orderBy) && query.orderBy.length > 0) {
    const colNames = Array.isArray(columns) ? columns.map(c => getColName(c)).filter(Boolean) : [];
    result = [...result];
    result.sort((a, b) => {
      for (const { field, direction } of query.orderBy) {
        const type = getColumnType(columns, field);
        const aVal = getRowValue(a, field);
        const bVal = getRowValue(b, field);
        const aCoerced = aVal == null ? null : coerceValue(aVal, type);
        const bCoerced = bVal == null ? null : coerceValue(bVal, type);

        let cmp = 0;
        if (aCoerced == null && bCoerced == null) cmp = 0;
        else if (aCoerced == null) cmp = 1;
        else if (bCoerced == null) cmp = -1;
        else if (type === 'string') {
          cmp = String(aCoerced).toLowerCase().localeCompare(String(bCoerced).toLowerCase());
        } else if (type === 'int' || type === 'float') {
          cmp = Number(aCoerced) - Number(bCoerced);
        } else if (type === 'boolean') {
          cmp = (aCoerced ? 1 : 0) - (bCoerced ? 1 : 0);
        } else {
          cmp = String(aCoerced).localeCompare(String(bCoerced));
        }
        if (cmp !== 0) return direction === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
  }

  const totalCount = result.length;
  const offset = query.offset != null && Number.isInteger(query.offset) ? query.offset : 0;
  const limit = query.limit != null && Number.isInteger(query.limit) ? query.limit : result.length;
  const pageRows = result.slice(offset, offset + limit);
  return { rows: pageRows, totalCount };
}
