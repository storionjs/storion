/**
 * Type declarations for storion.
 * Database instance methods are async and return Promises.
 */

export type StorageType = 'localStorage' | 'sessionStorage' | 'indexedDB';

export interface CreateDatabaseOptions {
  name: string;
  storage: StorageType;
  /** Optional config object to create DB and tables from */
  config?: DBConfig;
  /** Optional storage key (default: __LS_DB__) */
  storageKey?: string;
}

export interface DBConfig {
  databases?: Record<string, { tables?: Record<string, TableDef> }>;
  tables?: Record<string, TableDef>;
}

export interface TableDef {
  columns: Array<string | { name: string; type: 'int' | 'float' | 'boolean' | 'string' | 'json'; references?: { table: string; column: string } }>;
}

export interface QueryWhere {
  field?: string;
  op?: string;
  value?: unknown;
  and?: QueryWhere[];
  or?: QueryWhere[];
}

export interface Query {
  where?: QueryWhere | null;
  orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  limit?: number;
  offset?: number;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  totalCount: number;
}

export interface FetchOptions {
  filter?: Record<string, unknown>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

/** Change event emitted after insert, update, delete, createTable, or deleteTable. */
export interface StorionChangeEvent {
  type: 'insert' | 'update' | 'delete' | 'tableCreated' | 'tableDeleted';
  dbName: string;
  tableName: string;
  row?: Record<string, unknown>;
  rowId?: number | string;
  previousRow?: Record<string, unknown>;
}

/** Generic transport interface for receiving change events from another context. */
export interface ChangeTransport {
  /**
   * Register a message handler. The handler will be called with messages that
   * should represent StorionChangeEvent-like objects. Returns an optional
   * function that can be called to unsubscribe.
   */
  onMessage(handler: (message: unknown) => void): (() => void) | void;
}

/** Optional broadcaster for cross-context sync (e.g. extension ↔ webapp). */
export interface ChangeBroadcaster {
  broadcastChange(event: StorionChangeEvent): void | Promise<void>;
}

export function createDatabase(options: CreateDatabaseOptions): Promise<Database>;

export function loadConfigFromUrl(url: string): Promise<DBConfig>;

export function loadConfigFromFile(file: File): Promise<DBConfig>;

export function getStorageAdapter(type: StorageType, storageKey?: string): StorageAdapter;

export function executeQuery(rows: object[], columns: unknown[], query: Query | null): QueryResult;

export function validateQuery(query: Query | null, columns: unknown[]): { valid: boolean; error?: string };

export const QUERY_OPERATORS: string[];

export function parseConfig(config: DBConfig, dbName?: string): { databases: Record<string, unknown> };

export function normalizeColumn(col: string | { name: string; type?: string }): { name: string; type: string } | null;

export function getColumnNames(columns: unknown[]): string[];

export function getColumnType(columns: unknown[], colName: string): string;

export function coerceValue(value: unknown, type: string): unknown;

export interface StorageAdapter {
  getItem(): string | null | Promise<string | null>;
  setItem(key: null, value: string): void | boolean | Promise<void | boolean>;
  removeItem(): void | boolean | Promise<void | boolean>;
  getAllKeys(): string[] | Promise<string[]>;
  isAsync?: boolean;
}

export interface Database {
  readonly name: string;
  createTable(tableName: string, columns: Array<string | { name: string; type: string }>): Promise<boolean>;
  listTables(): Promise<string[]>;
  getTable(tableName: string): Promise<{ columns: unknown[]; rows: Record<string, unknown>[] }>;
  insert(tableName: string, row: Record<string, unknown>): Promise<Record<string, unknown>>;
  fetch(tableName: string, options?: FetchOptions): Promise<Record<string, unknown>[]>;
  query(tableName: string, query: Query): Promise<QueryResult>;
  update(tableName: string, id: number | string, newData: Record<string, unknown>): Promise<Record<string, unknown>>;
  delete(tableName: string, id: number | string): Promise<boolean>;
  deleteTable(tableName: string): Promise<boolean>;
  exportConfig(): Promise<DBConfig>;
  /** Subscribe to all changes in this database. Returns unsubscribe function. */
  subscribe(callback: (event: StorionChangeEvent) => void): () => void;
  /** Subscribe to changes for one table. Returns unsubscribe function. */
  subscribe(tableName: string, callback: (event: StorionChangeEvent) => void): () => void;
  /** Subscribe to changes for one row. Returns unsubscribe function. */
  subscribe(tableName: string, rowId: number | string, callback: (event: StorionChangeEvent) => void): () => void;
  /** Remove subscription by id (prefer using the function returned from subscribe). */
  unsubscribe(id: number): void;
  /** Set optional broadcaster for cross-context sync (Phase 2). */
  setChangeBroadcaster(broadcaster: ChangeBroadcaster | null): void;
}

/**
 * Create a listener for change events coming from another context (e.g. from
 * a Chrome extension or another window) via a user-provided transport.
 * Returns a function to unsubscribe.
 */
export function createChangeListener(
  transport: ChangeTransport,
  onChange: (event: StorionChangeEvent) => void
): () => void;
