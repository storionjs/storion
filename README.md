# storion

Framework-agnostic client-side database for the browser. Use it with **React**, **Vue**, **Angular**, or vanilla JS. No framework-specific code—just create databases, tables, save/fetch records, and run JSON queries on **localStorage**, **sessionStorage**, or **IndexedDB**.

## Features

- **Framework-agnostic** – Works with any frontend (React, Vue, Angular, Svelte, etc.)
- **Multiple stores** – Create databases in `localStorage`, `sessionStorage`, or `indexedDB`
- **Tables** – Define tables with columns (int, float, boolean, string) and optional foreign keys
- **CRUD** – Insert, fetch, update, and delete records
- **Query engine** – Run JSON queries (where, orderBy, limit, offset) directly on tables
- **Config from file** – Create a database from a config object or load config from a URL/file
- **Change subscription** – Subscribe to table or row changes so multiple components stay in sync when data is updated (no polling)
 - **Cross-context ready** – Optional broadcaster + listener helpers so an extension, background script, or another tab can stream change events to your UI

## Install

```bash
npm install @storion/storion
```

## Quick start

```js
import { createDatabase } from '@storion/storion';

// Create a database in localStorage (or sessionStorage / indexedDB)
const db = await createDatabase({
  name: 'myapp',
  storage: 'localStorage'
});

// Create a table
await db.createTable('users', [
  { name: 'id', type: 'int' },
  { name: 'email', type: 'string' },
  { name: 'name', type: 'string' },
  { name: 'active', type: 'boolean' }
]);

// Insert rows
await db.insert('users', { email: 'alice@example.com', name: 'Alice', active: true });
await db.insert('users', { email: 'bob@example.com', name: 'Bob', active: false });

// Fetch all or with options
const all = await db.fetch('users');
const active = await db.fetch('users', { filter: { active: true }, sortBy: 'name', limit: 10 });

// Run a query (where, orderBy, limit, offset)
const { rows, totalCount } = await db.query('users', {
  where: { field: 'active', op: 'eq', value: true },
  orderBy: [{ field: 'name', direction: 'asc' }],
  limit: 20,
  offset: 0
});

// Update and delete
await db.update('users', 1, { name: 'Alice Smith' });
await db.delete('users', 2);
```

## Create database from config

You can create a database and its tables from a **config object** (e.g. from a JSON file).

### Config in code

```js
const config = {
  tables: {
    users: {
      columns: [
        { name: 'id', type: 'int' },
        { name: 'email', type: 'string' },
        { name: 'active', type: 'boolean' }
      ]
    },
    posts: {
      columns: [
        { name: 'id', type: 'int' },
        { name: 'title', type: 'string' },
        { name: 'user_id', type: 'int', references: { table: 'users', column: 'id' } }
      ]
    }
  }
};

const db = await createDatabase({
  name: 'myapp',
  storage: 'localStorage',
  config
});
```

### Load config from URL

```js
import { createDatabase, loadConfigFromUrl } from '@storion/storion';

const config = await loadConfigFromUrl('/config/db.json');
const db = await createDatabase({
  name: 'myapp',
  storage: 'localStorage',
  config
});
```

### Load config from file (e.g. file input)

```js
import { createDatabase, loadConfigFromFile } from '@storion/storion';

// <input type="file" id="configFile" accept=".json" />
const file = document.getElementById('configFile').files[0];
const config = await loadConfigFromFile(file);
const db = await createDatabase({
  name: 'imported',
  storage: 'localStorage',
  config
});
```

Config format and options are described in [docs/CONFIG_FORMAT.md](docs/CONFIG_FORMAT.md).

## Query language

Use `db.query(tableName, query)` with a JSON query:

- **where** – Filter: `{ field, op, value }` or `{ and: [...] }` / `{ or: [...] }`
- **orderBy** – Sort: `[{ field, direction: 'asc' | 'desc' }]`
- **limit** / **offset** – Pagination

Operators: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `contains`, `startsWith`, `endsWith`, `in`, `notIn`, `isNull`, `isNotNull`.

Example:

```js
const { rows, totalCount } = await db.query('users', {
  where: {
    and: [
      { field: 'status', op: 'eq', value: 'active' },
      { field: 'name', op: 'contains', value: 'smith' }
    ]
  },
  orderBy: [{ field: 'created_at', direction: 'desc' }],
  limit: 10,
  offset: 0
});
```

Full reference: [docs/QUERY_LANGUAGE.md](docs/QUERY_LANGUAGE.md).

## Subscribing to changes

When multiple components share the same `Database` instance, they can subscribe to change events so that when one component inserts, updates, or deletes data, the others receive an event and can refresh or react—without polling.

```js
const db = await createDatabase({ name: 'myapp', storage: 'localStorage' });

// Subscribe to all changes in a table
const unsubscribe = db.subscribe('todos', (event) => {
  console.log(event.type, event.row); // 'insert' | 'update' | 'delete' | 'tableCreated' | 'tableDeleted'
  // Refresh your UI or state here
});

// Or subscribe to all tables: db.subscribe((event) => { ... })
// Or subscribe to one row: db.subscribe('todos', 1, (event) => { ... })

// When done: unsubscribe();
```

Every matching subscriber receives the event (multiple components can subscribe to the same table or row). If no one subscribes, the database behaves as before. Full details: [docs/API.md#dbsubscribe](docs/API.md).

## Cross-context sync (extension ↔ webapp)

Storion can also be used as the **source of truth in one context** (e.g. a Chrome extension or background script) and stream change events to another context (e.g. a webapp UI) using a broadcaster + listener pattern.

```js
import { createDatabase, createChangeListener } from '@storion/storion';

// 1) Producer side (e.g. extension popup/background)
const db = await createDatabase({ name: 'myapp', storage: 'localStorage' });

// Forward normalized StorionChangeEvent payloads to the active tab.
db.setChangeBroadcaster({
  async broadcastChange(event) {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      // Chrome extension context: send to the active tab's content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab || !tab.id) return;
        chrome.tabs.sendMessage(tab.id, { action: 'storionChangeEvent', event });
      });
    } else {
      // Fallback: same-window postMessage (e.g. two iframes or tabs using BroadcastChannel)
      window.postMessage({ source: 'storion-change', payload: event }, '*');
    }
  }
});

// 2) Consumer side (e.g. webapp page or another tab)
const transport = {
  onMessage(handler) {
    function listener(ev) {
      if (!ev.data || ev.data.source !== 'storion-change') return;
      handler(ev.data.payload);
    }
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }
};

const stop = createChangeListener(transport, (event) => {
  // React to inserts/updates/deletes coming from another context
  console.log('Cross-context change:', event.type, event.tableName, event.row);
});

// later, when you no longer need updates:
// stop();
```

The same `StorionChangeEvent` payload is delivered to **local subscribers** and to the **broadcaster**, and `createChangeListener` normalizes incoming messages on the receiving side. See [docs/API.md#createChangeListenertransport-onchange](docs/API.md) for details and Chrome-extension-specific wiring in the Storion Studio README.

## API overview

| Method | Description |
|--------|-------------|
| `createDatabase(options)` | Create or connect to a DB (name, storage, optional config). |
| `loadConfigFromUrl(url)` | Fetch config JSON from a URL. |
| `loadConfigFromFile(file)` | Read config from a File (e.g. file input). |
| `db.createTable(name, columns)` | Create a table. |
| `db.listTables()` | List table names. |
| `db.getTable(name)` | Get table structure and rows. |
| `db.insert(table, row)` | Insert a row (id auto if omitted). |
| `db.fetch(table, options?)` | Fetch rows (optional filter, sort, limit). |
| `db.query(table, query)` | Run JSON query; returns `{ rows, totalCount }`. |
| `db.update(table, id, data)` | Update a row by id. |
| `db.delete(table, id)` | Delete a row by id. |
| `db.deleteTable(name)` | Delete a table. |
| `db.exportConfig()` | Export DB as config-like object. |
| `db.subscribe(callback)` / `db.subscribe(table, callback)` / `db.subscribe(table, rowId, callback)` | Subscribe to change events; returns `unsubscribe()`. |
| `db.unsubscribe(id)` | Remove a subscription by id. |
| `db.setChangeBroadcaster(broadcaster)` | Optional: broadcast changes to another context (e.g. extension ↔ page). |
| `createChangeListener(transport, onChange)` | Listen for change events coming from another context via a custom transport. |

Full API: [docs/API.md](docs/API.md).

## Storage backends

- **localStorage** – Persists across sessions; same origin; ~5MB typical.
- **sessionStorage** – Cleared when the tab/window closes; same origin.
- **indexedDB** – Async; larger quota; good for bigger datasets.

All data for a given storage key is stored in one place (default key: `__LS_DB__`). Multiple logical databases (different `name`s) can coexist under the same key.

## Usage with React / Vue / Angular

Use the same API in any framework. Share one `Database` instance (e.g. via context, service, or singleton) so that `db.subscribe()` keeps all components in sync when data changes. Example with React:

```js
import { createDatabase } from '@storion/storion';
import { useEffect, useState } from 'react';

function UserList() {
  const [db, setDb] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    let unsubscribe;
    createDatabase({ name: 'myapp', storage: 'localStorage' }).then(async (database) => {
      setDb(database);
      const { rows } = await database.query('users', { limit: 50 });
      setUsers(rows);
      unsubscribe = database.subscribe('users', async () => {
        const { rows: next } = await database.query('users', { limit: 50 });
        setUsers(next);
      });
    });
    return () => unsubscribe?.();
  }, []);

  if (!db) return <div>Loading...</div>;
  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>{u.name}</li>
      ))}
    </ul>
  );
}
```

No framework-specific bindings—just call the async API and set state as needed.

## License

MIT
