# Query language

The package uses a **JSON query object** to filter and sort table data. Use it with `db.query(tableName, query)`.

## Query structure

```json
{
  "where": { ... },
  "orderBy": [ ... ],
  "limit": 1000,
  "offset": 0
}
```

| Key       | Type   | Description |
|-----------|--------|-------------|
| `where`   | object | Optional. Filter conditions. Omit or `null` = no filter. |
| `orderBy` | array  | Optional. Sort by one or more columns. |
| `limit`   | number | Optional. Max rows (non-negative integer). |
| `offset`  | number | Optional. Skip N rows (non-negative integer). |

## Where clause

`where` can be:

1. **A single condition** – `{ "field": "columnName", "op": "eq", "value": 42 }`
2. **Logic node** – `{ "and": [ ... ] }` or `{ "or": [ ... ] }` (arrays of conditions or nested logic).

### Operators

| Operator       | Description                    | `value` required |
|----------------|--------------------------------|-------------------|
| `eq`           | Equals                         | Yes (except null) |
| `ne`           | Not equals                     | Yes               |
| `gt`           | Greater than                   | Yes               |
| `gte`          | Greater than or equal          | Yes               |
| `lt`           | Less than                      | Yes               |
| `lte`          | Less than or equal             | Yes               |
| `contains`     | String contains (case-insensitive) | Yes           |
| `startsWith`   | String starts with (case-insensitive) | Yes        |
| `endsWith`     | String ends with (case-insensitive)   | Yes        |
| `in`           | Value in list                  | Yes (array)       |
| `notIn`        | Value not in list              | Yes (array)       |
| `isNull`       | Value is null/undefined        | No                |
| `isNotNull`    | Value is not null/undefined    | No                |

String comparisons are **case-insensitive**. Column types (`int`, `float`, `boolean`, `string`, `json`) are used for type-aware comparison. For `json` columns, comparisons use the JSON string representation (e.g. `JSON.stringify`), so equality and string operators work on the serialized form of the value.

## OrderBy

Array of `{ "field": "columnName", "direction": "asc" | "desc" }`. Multiple columns supported; earlier entries have higher priority.

## Example with db.query()

```js
const { rows, totalCount } = await db.query('users', {
  where: {
    and: [
      { field: 'status', op: 'eq', value: 'active' },
      { field: 'name', op: 'contains', value: 'smith' }
    ]
  },
  orderBy: [
    { field: 'created_at', direction: 'desc' },
    { field: 'id', direction: 'asc' }
  ],
  limit: 20,
  offset: 0
});
```

Returns `{ rows: [...], totalCount: number }`.
