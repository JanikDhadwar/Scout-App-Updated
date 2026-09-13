// IndexedDB keeps reports/photos across page reloads without localStorage's
// small synchronous quota. A successful write means the transaction committed.
export function createOfflineStore(name = 'scout-device-v1', factory = globalThis.indexedDB) {
  let opening;
  function open() {
    if (!factory) return Promise.reject(new Error('Device storage is unavailable. Enable browser storage before scouting offline.'));
    if (!opening) opening = new Promise((resolve, reject) => {
      const request = factory.open(name, 1);
      request.onupgradeneeded = () => {
        for (const store of ['cache', 'queue', 'drafts', 'meta', 'receipts']) request.result.createObjectStore(store, { keyPath: 'key' });
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); opening = null; };
        resolve(request.result);
      };
      request.onerror = () => { opening = null; reject(request.error); };
      request.onblocked = () => reject(new Error('Close other Scout tabs to update device storage.'));
    });
    return opening;
  }
  async function transaction(stores, mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let result;
      tx.oncomplete = () => resolve(result?.result);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('Device storage could not save this report. Free some space and try again.'));
      try { result = action(tx); } catch (error) { tx.abort(); reject(error); }
    });
  }
  return {
    get: (store, key) => transaction([store], 'readonly', tx => tx.objectStore(store).get(key)),
    all: store => transaction([store], 'readonly', tx => tx.objectStore(store).getAll()),
    put: (store, value) => transaction([store], 'readwrite', tx => tx.objectStore(store).put(value)),
    remove: (store, key) => transaction([store], 'readwrite', tx => tx.objectStore(store).delete(key)),
    enqueue: (entry, draftKey) => transaction(['queue', 'drafts'], 'readwrite', tx => {
      tx.objectStore('queue').put(entry);
      if (draftKey) tx.objectStore('drafts').delete(draftKey);
    }),
    acknowledge: entry => transaction(['queue', 'receipts'], 'readwrite', tx => {
      tx.objectStore('receipts').put({ ...entry, error: null, uploadedAt: new Date().toISOString() });
      tx.objectStore('queue').delete(entry.key);
    }),
  };
}
