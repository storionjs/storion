/**
 * Database class: one logical database in a given storage.
 * All methods are async when using IndexedDB; sync when using localStorage/sessionStorage.
 */

import { getStorageAdapter } from './storage/adapters.js';
import { executeQuery, validateQuery } from './queryEngine.js';
import {
  normalizeColumn,
  getColumnNames,
  getColumnType,
  coerceValue,
  parseConfig
} from './schema.js';

function referencedValueExists(db, dbName, refTable, refCol, value) {
  if (!db.databases[dbName] || !db.databases[dbName].tables[refTable]) return false;
  const rows = db.databases[dbName].tables[refTable].rows || [];
  return rows.some(r => r[refCol] != null && String(r[refCol]) === String(value));
}

/**
 * Create or connect to a database.
 * @param {Object} options
 * @param {string} options.name - Database name
 * @param {string} options.storage - 'localStorage' | 'sessionStorage' | 'indexedDB'
 * @param {Object} [options.config] - Optional config object to create DB and tables from (see docs/CONFIG_FORMAT.md)
 * @param {string} [options.storageKey] - Optional key to store data under (default: __LS_DB__)
 * @returns {Promise<Database>} Database instance
 */
export async function createDatabase(options) {
  const { name, storage, config, storageKey } = options || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Database name is required');
  }
  if (!storage || !['localStorage', 'sessionStorage', 'indexedDB'].includes(storage)) {
    throw new Error('storage must be one of: localStorage, sessionStorage, indexedDB');
  }

  const adapter = getStorageAdapter(storage, storageKey);
  const db = new Database(name, adapter);
  await db._load();
  if (!db._data.databases[db.name]) {
    db._data.databases[db.name] = { tables: {} };
    await db._save();
  }

  if (config) {
    const parsed = parseConfig(config, name);
    if (parsed.databases[name]) {
      const def = parsed.databases[name];
      for (const [tableName, tableDef] of Object.entries(def.tables || {})) {
        if (tableDef.columns && tableDef.columns.length > 0) {
          await db.createTable(tableName, tableDef.columns);
        }
      }
    } else {
      for (const [dbName, def] of Object.entries(parsed.databases)) {
        for (const [tableName, tableDef] of Object.entries(def.tables || {})) {
          if (tableDef.columns && tableDef.columns.length > 0 && dbName === name) {
            await db.createTable(tableName, tableDef.columns);
          }
        }
      }
    }
  } else {
    if (!db._data.databases[name]) {
      db._data.databases[name] = { tables: {} };
      await db._save();
    }
  }

  return db;
}

/**
 * Load config from a URL (e.g. /config/db.json). Use in browser or with fetch.
 * @param {string} url - URL to fetch JSON from
 * @returns {Promise<Object>} Config object
 */
export async function loadConfigFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load config: ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Load config from a File object (e.g. from input[type=file]). Browser only.
 * @param {File} file - File object
 * @returns {Promise<Object>} Config object
 */
export async function loadConfigFromFile(file) {
  if (!file || typeof file.text !== 'function') {
    throw new Error('loadConfigFromFile expects a File object (e.g. from input[type=file])');
  }
  const text = await file.text();
  return JSON.parse(text);
}

class Database {
  constructor(name, adapter) {
    this.name = name;
    this._adapter = adapter;
    this._isAsync = !!adapter.isAsync;
    this._data = { databases: {} };
    this._subscribers = [];
    this._nextSubId = 0;
    this._changeBroadcaster = null;
  }

  _emitChange(event) {
    if (this._subscribers.length === 0 && !this._changeBroadcaster) return;
    const payload = {
      type: event.type,
      dbName: this.name,
      tableName: event.tableName,
      ...(event.row != null && { row: event.row }),
      ...(event.rowId != null && { rowId: event.rowId }),
      ...(event.previousRow != null && { previousRow: event.previousRow })
    };
    for (const sub of this._subscribers) {
      if (sub.tableName != null && sub.tableName !== event.tableName) continue;
      if (sub.rowId != null && (event.rowId == null || String(event.rowId) !== String(sub.rowId))) continue;
      try {
        sub.callback(payload);
      } catch (err) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[Storion] subscriber callback error:', err);
        }
      }
    }
    if (this._changeBroadcaster && typeof this._changeBroadcaster.broadcastChange === 'function') {
      try {
        const result = this._changeBroadcaster.broadcastChange(payload);
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch (err) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[Storion] broadcaster error:', err);
        }
      }
    }
  }

  /**
   * Subscribe to change events. Overloads:
   * - subscribe(callback) — all changes in this database
   * - subscribe(tableName, callback) — changes for one table
   * - subscribe(tableName, rowId, callback) — changes for one row
   * @returns {function()} unsubscribe function
   */
  subscribe(tableNameOrCallback, rowIdOrCallback, maybeCallback) {
    let tableName = null;
    let rowId = null;
    let callback;
    if (typeof tableNameOrCallback === 'function') {
      callback = tableNameOrCallback;
    } else if (typeof rowIdOrCallback === 'function') {
      tableName = tableNameOrCallback;
      callback = rowIdOrCallback;
    } else {
      tableName = tableNameOrCallback;
      rowId = rowIdOrCallback;
      callback = maybeCallback;
    }
    if (typeof callback !== 'function') {
      throw new Error('subscribe requires a callback function');
    }
    const id = ++this._nextSubId;
    this._subscribers.push({ id, tableName, rowId, callback });
    return () => this.unsubscribe(id);
  }

  /**
   * Remove a subscription by id (or by the function returned from subscribe).
   * @param {number} id - subscription id returned from subscribe (or use the returned unsubscribe function)
   */
  unsubscribe(id) {
    this._subscribers = this._subscribers.filter(s => s.id !== id);
  }

  /**
   * Set an optional broadcaster for cross-context sync (e.g. Phase 2: extension ↔ webapp).
   * @param {{ broadcastChange: function(object): void|Promise }} broadcaster - object with broadcastChange(event)
   */
  setChangeBroadcaster(broadcaster) {
    this._changeBroadcaster = broadcaster || null;
  }

  async _load() {
    const raw = this._isAsync ? await this._adapter.getItem() : this._adapter.getItem();
    const data = raw ? JSON.parse(raw) : { databases: {} };
    this._data = data;
    if (!this._data.databases[this.name]) {
      this._data.databases[this.name] = { tables: {} };
    }
  }

  async _save() {
    const json = JSON.stringify(this._data);
    if (this._isAsync) {
      await this._adapter.setItem(null, json);
    } else {
      this._adapter.setItem(null, json);
    }
  }

  /**
   * Create a table.
   * @param {string} tableName
   * @param {Array<string|{name: string, type: string}>} columns - e.g. [{ name: 'id', type: 'int' }, { name: 'title', type: 'string' }]
   * @returns {Promise<boolean>}
   */
  async createTable(tableName, columns) {
    await this._load();
    const db = this._data.databases[this.name];
    if (!db) throw new Error(`Database "${this.name}" does not exist`);
    if (db.tables[tableName]) throw new Error(`Table "${tableName}" already exists`);

    if (!Array.isArray(columns) || columns.length === 0) {
      throw new Error('columns must be a non-empty array');
    }

    const normalized = columns.map(c => normalizeColumn(c)).filter(Boolean);
    const names = normalized.map(c => c.name);
    if (!names.includes('id')) {
      normalized.unshift({ name: 'id', type: 'int' });
    } else {
      const idCol = normalized.find(c => c.name === 'id');
      if (idCol) idCol.type = 'int';
    }

    db.tables[tableName] = { columns: normalized, rows: [] };
    await this._save();
    this._emitChange({ type: 'tableCreated', tableName });
    return true;
  }

  /**
   * List table names.
   * @returns {Promise<string[]>}
   */
  async listTables() {
    await this._load();
    const db = this._data.databases[this.name];
    return db ? Object.keys(db.tables || {}) : [];
  }

  /**
   * Get table structure and rows.
   * @param {string} tableName
   * @returns {Promise<{ columns: Array, rows: Array }>}
   */
  async getTable(tableName) {
    await this._load();
    const db = this._data.databases[this.name];
    if (!db || !db.tables[tableName]) {
      throw new Error(`Table "${tableName}" does not exist`);
    }
    const table = db.tables[tableName];
    const columns = (table.columns || []).map(c => normalizeColumn(c)).filter(Boolean);
    return { columns, rows: [...(table.rows || [])] };
  }

  /**
   * Insert a row. ID is auto-generated if omitted.
   * @param {string} tableName
   * @param {Object} row
   * @returns {Promise<Object>} Inserted row
   */
  async insert(tableName, row) {
    await this._load();
    const db = this._data.databases[this.name];
    if (!db || !db.tables[tableName]) throw new Error(`Table "${tableName}" does not exist`);

    const table = db.tables[tableName];
    const columnNames = getColumnNames(table.columns);
    const coerced = {};
    for (const colName of columnNames) {
      const type = getColumnType(table.columns, colName);
      if (Object.prototype.hasOwnProperty.call(row, colName)) {
        coerced[colName] = coerceValue(row[colName], type);
      }
    }
    if (coerced.id === undefined || coerced.id === null) {
      const rows = table.rows || [];
      const maxId = rows.length > 0
        ? Math.max(...rows.map(r => (r.id != null ? Number(r.id) : 0)))
        : 0;
      coerced.id = maxId + 1;
    }
    const invalidKeys = Object.keys(coerced).filter(k => !columnNames.includes(k));
    if (invalidKeys.length > 0) throw new Error(`Invalid columns: ${invalidKeys.join(', ')}`);

    const normalizedCols = (table.columns || []).map(c => normalizeColumn(c)).filter(Boolean);
    for (const col of normalizedCols) {
      if (!col.references) continue;
      const val = coerced[col.name];
      if (val === null || val === undefined) continue;
      const { table: refTable, column: refCol } = col.references;
      if (!referencedValueExists(this._data, this.name, refTable, refCol, val)) {
        throw new Error(`Foreign key violation: value ${val} not found in ${refTable}.${refCol}`);
      }
    }

    table.rows = table.rows || [];
    table.rows.push({ ...coerced });
    await this._save();
    this._emitChange({ type: 'insert', tableName, row: { ...coerced } });
    return coerced;
  }

  /**
   * Fetch rows from a table. Optional simple filter and sort.
   * @param {string} tableName
   * @param {Object} [options] - { filter: { col: value }, sortBy: string, sortOrder: 'asc'|'desc', limit: number }
   * @returns {Promise<Object[]>}
   */
  async fetch(tableName, options = {}) {
    const { columns, rows } = await this.getTable(tableName);
    let result = [...rows];
    if (options.filter && typeof options.filter === 'object') {
      result = result.filter(row =>
        Object.entries(options.filter).every(([k, v]) =>
          String(row[k] || '').toLowerCase().includes(String(v || '').toLowerCase())
        )
      );
    }
    if (options.sortBy) {
      const dir = options.sortOrder === 'desc' ? -1 : 1;
      result.sort((a, b) => {
        const aVal = a[options.sortBy] ?? '';
        const bVal = b[options.sortBy] ?? '';
        return aVal > bVal ? dir : aVal < bVal ? -dir : 0;
      });
    }
    if (options.limit != null) result = result.slice(0, options.limit);
    return result;
  }

  /**
   * Run a JSON query on a table (where, orderBy, limit, offset). Uses the built-in query engine.
   * @param {string} tableName
   * @param {Object} query - { where?, orderBy?, limit?, offset? }
   * @returns {Promise<{ rows: Object[], totalCount: number }>}
   */
  async query(tableName, query) {
    const { columns, rows } = await this.getTable(tableName);
    const validation = validateQuery(query, columns);
    if (!validation.valid) throw new Error(validation.error);
    return executeQuery(rows, columns, query);
  }

  /**
   * Update a row by id.
   * @param {string} tableName
   * @param {number|string} id
   * @param {Object} newData
   * @returns {Promise<Object>}
   */
  async update(tableName, id, newData) {
    await this._load();
    const db = this._data.databases[this.name];
    if (!db || !db.tables[tableName]) throw new Error(`Table "${tableName}" does not exist`);

    const rows = db.tables[tableName].rows || [];
    const table = db.tables[tableName];
    const idx = rows.findIndex(r => r.id == id);
    if (idx === -1) throw new Error(`Row with id ${id} not found`);
    if (newData.id != null && newData.id != id) throw new Error('Cannot change row id');

    const coerced = {};
    for (const key of Object.keys(newData)) {
      const type = getColumnType(table.columns, key);
      coerced[key] = coerceValue(newData[key], type);
    }
    const normalizedCols = (table.columns || []).map(c => normalizeColumn(c)).filter(Boolean);
    for (const col of normalizedCols) {
      if (!col.references || !Object.prototype.hasOwnProperty.call(coerced, col.name)) continue;
      const val = coerced[col.name];
      if (val === null || val === undefined) continue;
      const { table: refTable, column: refCol } = col.references;
      if (!referencedValueExists(this._data, this.name, refTable, refCol, val)) {
        throw new Error(`Foreign key violation: value ${val} not found in ${refTable}.${refCol}`);
      }
    }
    const previousRow = { ...rows[idx] };
    Object.assign(rows[idx], coerced);
    await this._save();
    this._emitChange({
      type: 'update',
      tableName,
      rowId: id,
      row: { ...rows[idx] },
      previousRow
    });
    return rows[idx];
  }

  /**
   * Delete a row by id.
   * @param {string} tableName
   * @param {number|string} id
   * @returns {Promise<boolean>}
   */
  async delete(tableName, id) {
    await this._load();
    const db = this._data.databases[this.name];
    if (!db || !db.tables[tableName]) throw new Error(`Table "${tableName}" does not exist`);

    const tables = db.tables;
    const refCol = 'id';
    for (const [otherName, otherTable] of Object.entries(tables)) {
      if (otherName === tableName) continue;
      const cols = otherTable.columns || [];
      for (const c of cols) {
        const col = typeof c === 'object' && c && c.references ? c : normalizeColumn(c);
        if (!col || !col.references || col.references.table !== tableName || col.references.column !== refCol) continue;
        const otherRows = otherTable.rows || [];
        if (otherRows.some(r => r[col.name] != null && String(r[col.name]) === String(id))) {
          throw new Error(`Cannot delete: row is referenced by ${otherName}.${col.name}`);
        }
      }
    }

    const rows = db.tables[tableName].rows || [];
    const deletedRow = rows.find(r => r.id == id);
    if (!deletedRow) throw new Error(`Row with id ${id} not found`);
    const previousRow = { ...deletedRow };
    db.tables[tableName].rows = rows.filter(r => r.id != id);
    await this._save();
    this._emitChange({ type: 'delete', tableName, rowId: id, previousRow });
    return true;
  }

  /**
   * Delete a table.
   * @param {string} tableName
   * @returns {Promise<boolean>}
   */
  async deleteTable(tableName) {
    await this._load();
    const db = this._data.databases[this.name];
    if (!db || !db.tables[tableName]) throw new Error(`Table "${tableName}" does not exist`);

    const tables = db.tables;
    for (const [otherName, otherTable] of Object.entries(tables)) {
      if (otherName === tableName) continue;
      const cols = otherTable.columns || [];
      for (const c of cols) {
        const col = typeof c === 'object' && c && c.references ? c : normalizeColumn(c);
        if (col && col.references && col.references.table === tableName) {
          throw new Error(`Cannot delete table: it is referenced by ${otherName}.${col.name}`);
        }
      }
    }
    delete db.tables[tableName];
    await this._save();
    this._emitChange({ type: 'tableDeleted', tableName });
    return true;
  }

  /**
   * Export full in-memory state (this DB only) as JSON.
   * @returns {Promise<Object>}
   */
  async exportConfig() {
    await this._load();
    const db = this._data.databases[this.name];
    return db ? { databases: { [this.name]: { tables: db.tables || {} } } } : { databases: {} };
  }
}
