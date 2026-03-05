# Database configuration format

You can create a database and its tables from a **config object** when calling `createDatabase()`, or load that config from a URL or file.

## Option 1: Config object in code

```js
import { createDatabase } from 'storion';

const config = {
  tables: {
    users: {
      columns: [
        { name: 'id', type: 'int' },
        { name: 'email', type: 'string' },
        { name: 'name', type: 'string' },
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

## Option 2: Multiple databases in one config

```json
{
  "databases": {
    "app1": {
      "tables": {
        "users": {
          "columns": [
            { "name": "id", "type": "int" },
            { "name": "email", "type": "string" }
          ]
        }
      }
    },
    "app2": {
      "tables": {
        "items": {
          "columns": [
            { "name": "id", "type": "int" },
            { "name": "label", "type": "string" }
          ]
        }
      }
    }
  }
}
```

When you call `createDatabase({ name: 'app1', storage: 'localStorage', config })`, only the `app1` database and its tables are created in that instance.

## Option 3: Load config from URL

In the browser you can fetch a JSON config from your server or public folder:

```js
import { createDatabase, loadConfigFromUrl } from 'storion';

const config = await loadConfigFromUrl('/config/db.json');
const db = await createDatabase({
  name: 'myapp',
  storage: 'localStorage',
  config
});
```

## Option 4: Load config from a File (e.g. file input)

```js
import { createDatabase, loadConfigFromFile } from 'storion';

// In your HTML: <input type="file" id="configFile" accept=".json" />
document.getElementById('configFile').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const config = await loadConfigFromFile(file);
  const db = await createDatabase({
    name: 'imported',
    storage: 'localStorage',
    config
  });
});
```

## Column types

- `int` – integer
- `float` – number
- `boolean` – true/false
- `string` – text

## Optional: foreign key

Use `references` to point a column to another table’s column:

```json
{ "name": "user_id", "type": "int", "references": { "table": "users", "column": "id" } }
```

If you omit `id` in the columns list, an `id` (type `int`) column is added automatically as the primary key.
