# Storion

**Framework-agnostic client-side database for the browser.** Use it with React, Vue, Angular, Svelte, or vanilla JS. Create databases, tables, save and fetch records, and run JSON queries on **localStorage**, **sessionStorage**, or **IndexedDB**.

[![npm](https://img.shields.io/npm/v/@storion/storion.svg)](https://www.npmjs.com/package/@storion/storion)
[![GitHub](https://img.shields.io/badge/GitHub-storionjs%2Fstorion-blue?logo=github)](https://github.com/storionjs/storion)
[![Documentation](https://storionjs.github.io/storion-docs/)](https://storionjs.github.io/storion-docs/)

---

## Table of contents

- [Features](#features)
- [Install](#install)
- [Quick start](#quick-start)
- [Common examples](#common-examples)
- [Documentation](#documentation)
- [Database from config](#database-from-config)
- [Query language](#query-language)
- [Subscribing to changes](#subscribing-to-changes)
- [Cross-context sync (e.g. extensions)](#cross-context-sync-eg-extensions)
- [Storage backends](#storage-backends)
- [Usage with React / Vue / Angular](#usage-with-react--vue--angular)
- [API reference](#api-reference)
- [Links](#links)

---

## Features

| Feature | Description |
|--------|-------------|
| **Framework-agnostic** | Works with any frontend; no framework-specific code. |
| **Multiple stores** | Use `localStorage`, `sessionStorage`, or `indexedDB`. |
| **Tables & schema** | Define tables with columns (int, float, boolean, string, json) and optional foreign keys. |
| **CRUD** | Insert, fetch, update, and delete records with a simple API. |
| **Query engine** | Run JSON queries: `where`, `orderBy`, `limit`, `offset`. |
| **Config from file/URL** | Create a database from a config object or load config from a URL or file. |
| **Change subscription** | Subscribe to table or row changes so components stay in sync without polling. |
| **Cross-context** | Optional broadcaster + listener for extensions, background scripts, or multiple tabs. |

---

## Install

```bash
npm install @storion/storion
```

- **npm:** [https://www.npmjs.com/package/@storion/storion](https://www.npmjs.com/package/@storion/storion)
- **Source & issues:** [https://github.com/storionjs/storion](https://github.com/storionjs/storion)

---

## Quick start

```js
import { createDatabase } from '@storion/storion';

// Create a database (localStorage, sessionStorage, or indexedDB)
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

---

## Common examples

### Example: simple todo list (localStorage)

```js
import { createDatabase } from '@storion/storion';

const db = await createDatabase({
  name: 'todo-app',
  storage: 'localStorage'
});

await db.createTable('todos', [
  { name: 'id', type: 'int' },
  { name: 'title', type: 'string' },
  { name: 'done', type: 'boolean' }
]);

// Add a todo
await db.insert('todos', { title: 'Ship Storion docs', done: false });

// Get all open todos
const openTodos = await db.fetch('todos', {
  filter: { done: false },
  sortBy: 'id'
});
```

### Example: admin-style querying

```js
// Fetch the 20 latest active users whose name contains "smith"
const { rows, totalCount } = await db.query('users', {
  where: {
    and: [
      { field: 'active', op: 'eq', value: true },
      { field: 'name', op: 'contains', value: 'smith' }
    ]
  },
  orderBy: [{ field: 'created_at', direction: 'desc' }],
  limit: 20,
  offset: 0
});
```

---

## Documentation

**Documentation:** https://storionjs.github.io/storion-docs/

| Document | Description |
|----------|-------------|
| [**API reference**](docs/API.md) | Full API for `createDatabase`, `Database` methods, and helpers. |
| [**Config format**](docs/CONFIG_FORMAT.md) | How to define tables and databases in a config object or JSON file. |
| [**Query language**](docs/QUERY_LANGUAGE.md) | `where`, `orderBy`, operators, and examples. |

---

## Database from config

You can create a database and its tables from a **config object** (e.g. from a JSON file).

### Config in code

```js
import { createDatabase } from '@storion/storion';

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

See [Config format](docs/CONFIG_FORMAT.md) for the full schema and options.

---

## Query language

Use `db.query(tableName, query)` with a JSON query object:

| Key | Description |
|-----|-------------|
| **where** | Filter: `{ field, op, value }` or `{ and: [...] }` / `{ or: [...] }`. |
| **orderBy** | Sort: `[{ field, direction: 'asc' \| 'desc' }]`. |
| **limit** / **offset** | Pagination. |

**Operators:** `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `contains`, `startsWith`, `endsWith`, `in`, `notIn`, `isNull`, `isNotNull`.

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

Full reference: [Query language](docs/QUERY_LANGUAGE.md).

---

## Subscribing to changes

When multiple components share the same `Database` instance, they can subscribe to change events so that when one component inserts, updates, or deletes data, the others receive an event and can refresh—without polling.

```js
const db = await createDatabase({ name: 'myapp', storage: 'localStorage' });

// Subscribe to all changes in a table
const unsubscribe = db.subscribe('todos', (event) => {
  console.log(event.type, event.row); // 'insert' | 'update' | 'delete' | 'tableCreated' | 'tableDeleted'
  // Refresh your UI or state here
});

// Subscribe to all tables:  db.subscribe((event) => { ... })
// Subscribe to one row:     db.subscribe('todos', 1, (event) => { ... })

// When done:
unsubscribe();
```

See [API — db.subscribe](docs/API.md) for details.

---

## Cross-context sync (e.g. extensions)

Use Storion in one context (e.g. Chrome extension or background script) and stream change events to another (e.g. web app UI) with a broadcaster + listener.

```js
import { createDatabase, createChangeListener } from '@storion/storion';

// 1) Producer (e.g. extension popup/background)
const db = await createDatabase({ name: 'myapp', storage: 'localStorage' });

db.setChangeBroadcaster({
  async broadcastChange(event) {
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs?.[0];
        if (tab?.id) chrome.tabs.sendMessage(tab.id, { action: 'storionChangeEvent', event });
      });
    } else {
      window.postMessage({ source: 'storion-change', payload: event }, '*');
    }
  }
});

// 2) Consumer (e.g. web app or another tab)
const transport = {
  onMessage(handler) {
    const listener = (ev) => {
      if (ev.data?.source !== 'storion-change') return;
      handler(ev.data.payload);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }
};

const stop = createChangeListener(transport, (event) => {
  console.log('Cross-context change:', event.type, event.tableName, event.row);
});
// Later: stop();
```

---

## Storion Studio (Chrome extension)

**Storion Studio** is a Chrome extension that turns your browser's `localStorage` into a structured database with a visual UI—think of it as an admin console for Storion. It uses the same data layout as the `@storion/storion` npm package, so you can manage data in the extension while your web app uses the library.

- **GitHub (extension):** `https://github.com/storionjs/storion-studio`
- **Docs page:** `https://storionjs.github.io/storion-docs/storion-studio.html`

### What you can do with Studio

- Create, delete, and organize multiple databases.
- Create tables with custom columns and manage schema visually.
- Insert, read, update, and delete rows in a table grid.
- Use a Query panel that speaks the same JSON query language as `db.query()`.
- Export/import databases as JSON.
- Optionally stream change events to a page that uses Storion (via `postMessage`, Chrome messaging, or other transports).

### Using Studio with your app

Because both Studio and the library share the same storage layout (by default under the `__LS_DB__` key in `localStorage`):

- You can prototype or inspect data in Storion Studio.
- Then point your app at the same database with:

```js
import { createDatabase } from '@storion/storion';

const db = await createDatabase({
  name: 'myapp',
  storage: 'localStorage'
});
```

If you want live updates from Studio into your app, wire up `setChangeBroadcaster` in the context where Studio is making changes and `createChangeListener` in your app, as shown in the [Cross-context sync](#cross-context-sync-eg-extensions) section.

See [API — createChangeListener](docs/API.md) and [API — setChangeBroadcaster](docs/API.md) for details.

---

## Storage backends

| Backend | Description |
|---------|-------------|
| **localStorage** | Persists across sessions; same origin; ~5MB typical. |
| **sessionStorage** | Cleared when the tab/window closes; same origin. |
| **indexedDB** | Async; larger quota; good for bigger datasets. |

All data for a given storage key is stored in one place (default key: `__LS_DB__`). Multiple logical databases (different `name`s) can coexist under the same key.

---

## Usage with React / Vue / Angular

Use the same API in any framework. Share one `Database` instance (e.g. via context, service, or singleton) so `db.subscribe()` keeps all components in sync.

**Example with React:**

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

No framework-specific bindings—call the async API and set state as needed.

---

## API reference

| Method / API | Description |
|--------------|-------------|
| `createDatabase(options)` | Create or connect to a DB (name, storage, optional config). |
| `loadConfigFromUrl(url)` | Fetch config JSON from a URL. |
| `loadConfigFromFile(file)` | Read config from a `File` (e.g. file input). |
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
| `db.setChangeBroadcaster(broadcaster)` | Optional: broadcast changes to another context. |
| `createChangeListener(transport, onChange)` | Listen for change events from another context via a custom transport. |

Full details: [API reference](docs/API.md).

---

## Links

| Resource | URL |
|----------|-----|
| **GitHub** | [https://github.com/storionjs/storion](https://github.com/storionjs/storion) |
| **npm** | [https://www.npmjs.com/package/@storion/storion](https://www.npmjs.com/package/@storion/storion) |
| **Issues** | [https://github.com/storionjs/storion/issues](https://github.com/storionjs/storion/issues) |
| **License** | MIT |
