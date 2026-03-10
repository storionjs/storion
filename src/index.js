/**
 * storion – Framework-agnostic client-side database.
 * Use with React, Vue, Angular, or vanilla JS.
 */

import { createDatabase, loadConfigFromUrl, loadConfigFromFile } from './Database.js';
import { getStorageAdapter } from './storage/adapters.js';
import { executeQuery, validateQuery, QUERY_OPERATORS } from './queryEngine.js';
import { parseConfig, normalizeColumn, getColumnNames, getColumnType, coerceValue } from './schema.js';
import { createChangeListener } from './changeListener.js';

export {
  createDatabase,
  loadConfigFromUrl,
  loadConfigFromFile,
  getStorageAdapter,
  executeQuery,
  validateQuery,
  QUERY_OPERATORS,
  parseConfig,
  normalizeColumn,
  getColumnNames,
  getColumnType,
  coerceValue,
  createChangeListener
};
