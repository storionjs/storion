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
  /** Optional storage key (default: __BROWSER_DB__) */
  storageKey?: string;
}

export interface DBConfig {
  databases?: Record<string, { tables?: Record<string, TableDef> }>;
  tables?: Record<string, TableDef>;
}

export interface TableDef {
  columns: Array<string | { name: string; type: 'int' | 'float' | 'boolean' | 'string'; references?: { table: string; column: string } }>;
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
}
