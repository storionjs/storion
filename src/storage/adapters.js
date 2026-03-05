/**
 * Storage adapters for localStorage, sessionStorage, and IndexedDB.
 * All adapters expose getItem(key), setItem(key, value), removeItem(key), getAllKeys().
 * Async adapters return Promises; sync adapters return values directly.
 */

const STORAGE_KEY = '__BROWSER_DB__';

function createLocalStorageAdapter(storageKey = STORAGE_KEY) {
  const key = storageKey;
  return {
    getItem() {
      try {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      } catch (e) {
        console.error('localStorage.getItem error:', e);
        return null;
      }
    },
    setItem(_, value) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value);
          return true;
        }
        return false;
      } catch (e) {
        if (e.name === 'QuotaExceededError') throw new Error('Storage quota exceeded.');
        throw e;
      }
    },
    removeItem() {
      try {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
        return true;
      } catch (e) {
        return false;
      }
    },
    getAllKeys() {
      return typeof localStorage !== 'undefined' && localStorage.getItem(key) != null ? [key] : [];
    },
    isAsync: false
  };
}

function createSessionStorageAdapter(storageKey = STORAGE_KEY) {
  const key = storageKey;
  return {
    getItem() {
      try {
        return typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null;
      } catch (e) {
        console.error('sessionStorage.getItem error:', e);
        return null;
      }
    },
    setItem(_, value) {
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(key, value);
          return true;
        }
        return false;
      } catch (e) {
        if (e.name === 'QuotaExceededError') throw new Error('Storage quota exceeded.');
        throw e;
      }
    },
    removeItem() {
      try {
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key);
        return true;
      } catch (e) {
        return false;
      }
    },
    getAllKeys() {
      return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key) != null ? [key] : [];
    },
    isAsync: false
  };
}

function createIndexedDBAdapter(storageKey = STORAGE_KEY) {
  const DB_NAME = 'BrowserDB_Meta';
  const STORE_NAME = 'meta';
  const key = storageKey;

  function openDB() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not available'));
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(STORE_NAME);
      };
    });
  }

  return {
    getItem() {
      return openDB().then((db) => {
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => {
            db.close();
            resolve(req.result ?? null);
          };
          req.onerror = () => {
            db.close();
            reject(req.error);
          };
        });
      });
    },
    setItem(_, value) {
      return openDB().then((db) => {
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(value, key);
          req.onsuccess = () => {
            db.close();
            resolve(true);
          };
          req.onerror = () => {
            db.close();
            reject(req.error);
          };
        });
      });
    },
    removeItem() {
      return openDB().then((db) => {
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.delete(key);
          req.onsuccess = () => {
            db.close();
            resolve(true);
          };
          req.onerror = () => {
            db.close();
            reject(req.error);
          };
        });
      });
    },
    getAllKeys() {
      return openDB().then((db) => {
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => {
            db.close();
            resolve(req.result != null ? [key] : []);
          };
          req.onerror = () => {
            db.close();
            reject(req.error);
          };
        });
      }).catch(() => []);
    },
    isAsync: true
  };
}

/**
 * Get storage adapter by type.
 * @param {'localStorage'|'sessionStorage'|'indexedDB'} type
 * @param {string} [storageKey] - Optional key to store data under
 * @returns {Object} Adapter with getItem, setItem, removeItem, getAllKeys, isAsync
 */
export function getStorageAdapter(type, storageKey = STORAGE_KEY) {
  switch (type) {
    case 'localStorage':
      return createLocalStorageAdapter(storageKey);
    case 'sessionStorage':
      return createSessionStorageAdapter(storageKey);
    case 'indexedDB':
      return createIndexedDBAdapter(storageKey);
    default:
      throw new Error(`Unsupported storage type: ${type}. Use localStorage, sessionStorage, or indexedDB.`);
  }
}

export { STORAGE_KEY };
