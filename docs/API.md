# API reference

## createDatabase(options)

Create or connect to a database. Returns a **Database** instance.

- **options.name** (string) – Database name.
- **options.storage** (`'localStorage' | 'sessionStorage' | 'indexedDB'`) – Storage backend.
- **options.config** (object, optional) – Config object to create tables from. See [CONFIG_FORMAT.md](./CONFIG_FORMAT.md).
- **options.storageKey** (string, optional) – Key used in storage (default: `__BROWSER_DB__`).

```js
const db = await createDatabase({
  name: 'myapp',
  storage: 'localStorage',
  config: { tables: { users: { columns: [{ name: 'id', type: 'int' }, { name: 'email', type: 'string' }] } } }
});
```

---

## loadConfigFromUrl(url)

Load a config object from a URL (e.g. `/config/db.json`). Returns a **Promise&lt;object&gt;**.

```js
const config = await loadConfigFromUrl('/config/db.json');
const db = await createDatabase({ name: 'myapp', storage: 'localStorage', config });
```

---

## loadConfigFromFile(file)

Load a config object from a **File** (e.g. from `<input type="file">`). Returns a **Promise&lt;object&gt;**.

```js
const config = await loadConfigFromFile(fileInput.files[0]);
const db = await createDatabase({ name: 'imported', storage: 'localStorage', config });
```

---

## Database instance

### db.name

Read-only. The database name.

### db.createTable(tableName, columns)

Create a table. **columns** is an array of `string` (column name, type `string`) or `{ name, type }` with `type` in `'int' | 'float' | 'boolean' | 'string' | 'json'`. An `id` column (type `int`) is added if missing.

```js
await db.createTable('users', [
  { name: 'id', type: 'int' },
  { name: 'email', type: 'string' },
  { name: 'active', type: 'boolean' }
]);
```

### db.listTables()

Returns **Promise&lt;string[]&gt;** – table names.

### db.getTable(tableName)

Returns **Promise&lt;{ columns, rows }&gt;** – table structure and all rows.

### db.insert(tableName, row)

Insert a row. `id` is auto-generated if omitted. Returns **Promise&lt;object&gt;** – the inserted row.

```js
const row = await db.insert('users', { email: 'a@b.com', active: true });
```

### db.fetch(tableName, options?)

Fetch rows with optional **options**: `filter` (object), `sortBy` (string), `sortOrder` (`'asc' | 'desc'`), `limit` (number). Returns **Promise&lt;object[]&gt;** – rows.

```js
const rows = await db.fetch('users', { filter: { active: true }, sortBy: 'email', limit: 10 });
```

### db.query(tableName, query)

Run a JSON query (where, orderBy, limit, offset). Returns **Promise&lt;{ rows, totalCount }&gt;**. See [QUERY_LANGUAGE.md](./QUERY_LANGUAGE.md).

```js
const { rows, totalCount } = await db.query('users', {
  where: { field: 'status', op: 'eq', value: 'active' },
  orderBy: [{ field: 'name', direction: 'asc' }],
  limit: 20,
  offset: 0
});
```

### db.update(tableName, id, newData)

Update a row by `id`. Returns **Promise&lt;object&gt;** – updated row.

```js
await db.update('users', 1, { email: 'new@b.com' });
```

### db.delete(tableName, id)

Delete a row by `id`. Returns **Promise&lt;boolean&gt;** – success.

### db.deleteTable(tableName)

Delete a table. Fails if another table has a foreign key to it.

### db.exportConfig()

Export the current database (and its tables/rows) as a config-like object. Returns **Promise&lt;object&gt;**.

---

## Query engine (standalone)

You can use the query engine on raw arrays of rows (e.g. from another source):

- **executeQuery(rows, columns, query)** – returns `{ rows, totalCount }`.
- **validateQuery(query, columns)** – returns `{ valid: boolean, error?: string }`.
- **QUERY_OPERATORS** – array of allowed operator names.

---

## Schema helpers

- **parseConfig(config, dbName?)** – parse a config object into internal `{ databases }` shape.
- **normalizeColumn(col)** – normalize a column def to `{ name, type }`.
- **getColumnNames(columns)** – array of column names.
- **getColumnType(columns, colName)** – type string for a column.
- **coerceValue(value, type)** – coerce a value to the given type.

---

## getStorageAdapter(type, storageKey?)

Returns the low-level adapter for `'localStorage' | 'sessionStorage' | 'indexedDB'`. Used internally; you typically use **createDatabase** only.
