/**
 * Schema helpers: normalize columns, validate config.
 */

const COLUMN_TYPES = ['int', 'float', 'boolean', 'string'];

export function normalizeColumn(col) {
  if (typeof col === 'string') {
    return { name: col, type: 'string' };
  }
  if (col && typeof col === 'object' && col.name) {
    const ref = col.references;
    const hasRef = ref && typeof ref === 'object' &&
      typeof ref.table === 'string' && ref.table.trim() !== '' &&
      typeof ref.column === 'string' && ref.column.trim() !== '';
    const out = { name: col.name, type: COLUMN_TYPES.includes(col.type) ? col.type : 'string' };
    if (hasRef) out.references = { table: ref.table.trim(), column: ref.column.trim() };
    return out;
  }
  return null;
}

export function getColumnNames(columns) {
  if (!Array.isArray(columns)) return [];
  return columns.map(c => typeof c === 'string' ? c : (c && c.name) ? c.name : null).filter(Boolean);
}

export function getColumnType(columns, colName) {
  if (!Array.isArray(columns)) return 'string';
  const col = columns.find(c => (typeof c === 'string' ? c : c && c.name) === colName);
  if (!col) return 'string';
  return typeof col === 'string' ? 'string' : (col.type || 'string');
}

export function coerceValue(value, type) {
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
      const s = String(value).toLowerCase();
      return s === 'true' || s === '1' || s === 'yes';
    case 'string':
    default:
      return String(value);
  }
}

/**
 * Parse config object into internal db structure.
 * Config format: { databases: { dbName: { tables: { tableName: { columns: [...] } } } } }
 * or { tables: { tableName: { columns: [...] } } } for a single-db config.
 * @param {Object} config
 * @param {string} [dbName] - If config has top-level tables, use this db name
 * @returns {{ databases: Object }}
 */
export function parseConfig(config, dbName = 'default') {
  if (!config || typeof config !== 'object') {
    return { databases: {} };
  }
  if (config.databases && typeof config.databases === 'object') {
    const databases = {};
    for (const [name, db] of Object.entries(config.databases)) {
      if (!db || typeof db !== 'object') continue;
      databases[name] = { tables: {} };
      const tables = db.tables || db;
      if (typeof tables === 'object' && !Array.isArray(tables)) {
        for (const [tName, tDef] of Object.entries(tables)) {
          if (!tDef || typeof tDef !== 'object') continue;
          const cols = Array.isArray(tDef.columns) ? tDef.columns : (tDef.columns && tDef.columns.split) ? [] : [];
          const normalized = cols.map(c => normalizeColumn(c)).filter(Boolean);
          const names = normalized.map(c => c.name);
          if (normalized.length > 0 && !names.includes('id')) {
            normalized.unshift({ name: 'id', type: 'int' });
          } else if (names.includes('id')) {
            const idCol = normalized.find(c => c.name === 'id');
            if (idCol) idCol.type = 'int';
          }
          databases[name].tables[tName] = { columns: normalized, rows: [] };
        }
      }
    }
    return { databases };
  }
  // Single-db: { tables: { tableName: { columns: [...] } } }
  const tables = config.tables || {};
  const databases = { [dbName]: { tables: {} } };
  for (const [tName, tDef] of Object.entries(tables)) {
    if (!tDef || typeof tDef !== 'object') continue;
    const cols = Array.isArray(tDef.columns) ? tDef.columns : [];
    const normalized = cols.map(c => normalizeColumn(c)).filter(Boolean);
    const names = normalized.map(c => c.name);
    if (normalized.length > 0 && !names.includes('id')) {
      normalized.unshift({ name: 'id', type: 'int' });
    } else if (names.includes('id')) {
      const idCol = normalized.find(c => c.name === 'id');
      if (idCol) idCol.type = 'int';
    }
    databases[dbName].tables[tName] = { columns: normalized, rows: [] };
  }
  return { databases };
}
