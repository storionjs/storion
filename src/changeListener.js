/**
 * Helper to listen for Storion change events coming from another context.
 * The transport is user-provided and must expose an onMessage(handler) method
 * that registers a callback and returns an unsubscribe function.
 *
 * Example transport shape (conceptual):
 * {
 *   onMessage(handler) {
 *     // call handler(message) whenever a message arrives
 *     // return an unsubscribe function
 *   }
 * }
 *
 * Messages passed to the handler are expected to already be decoded
 * StorionChangeEvent-like objects.
 */
export function createChangeListener(transport, onChange) {
  if (!transport || typeof transport.onMessage !== 'function') {
    throw new Error('createChangeListener requires a transport with onMessage(callback)');
  }
  if (typeof onChange !== 'function') {
    throw new Error('createChangeListener requires an onChange callback');
  }

  const allowedTypes = new Set([
    'insert',
    'update',
    'delete',
    'tableCreated',
    'tableDeleted'
  ]);

  function isValidChangeEvent(event) {
    if (!event || typeof event !== 'object') return false;
    const { type, dbName, tableName } = event;
    if (!allowedTypes.has(type)) return false;
    if (typeof dbName !== 'string' || !dbName) return false;
    if (typeof tableName !== 'string' || !tableName) return false;
    return true;
  }

  const handler = (message) => {
    const event = message;
    if (!isValidChangeEvent(event)) {
      // Silently ignore non-Storion messages so the same transport can be shared.
      return;
    }
    try {
      // Shallow clone to avoid accidental external mutation of internal state.
      const cloned = {
        type: event.type,
        dbName: event.dbName,
        tableName: event.tableName
      };
      if (event.row != null) cloned.row = event.row;
      if (event.rowId != null) cloned.rowId = event.rowId;
      if (event.previousRow != null) cloned.previousRow = event.previousRow;
      onChange(cloned);
    } catch (err) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[Storion] createChangeListener onChange error:', err);
      }
    }
  };

  const unsubscribe = transport.onMessage(handler);
  if (typeof unsubscribe === 'function') {
    return unsubscribe;
  }
  // Fallback: allow transports that do not return an unsubscribe function.
  return () => {};
}

