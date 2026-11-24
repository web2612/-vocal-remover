import { FILE_TTL } from './filePolicy';
import type { ValidatedAudioFile } from './audioPipeline';

const STORE = 'files';
const KEY = 'latest';
type SavedFile = ValidatedAudioFile & { expiresAt: number };

let expiryTimer: ReturnType<typeof setTimeout> | undefined;
let pending = Promise.resolve();

function transaction<T>(update: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('vocalremover-recent-audio', 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onblocked = () => reject(new Error('Audio storage is busy.'));
    open.onsuccess = () => {
      const db = open.result;
      const operation = db.transaction(STORE, 'readwrite');
      const request = update(operation.objectStore(STORE));
      operation.oncomplete = () => { db.close(); resolve(request.result); };
      operation.onabort = () => { db.close(); reject(operation.error); };
    };
  });
}

function removeExpired() {
  return transaction(store => {
    const request = store.get(KEY) as IDBRequest<SavedFile | undefined>;
    request.onsuccess = () => {
      if (request.result && request.result.expiresAt <= Date.now()) store.delete(KEY);
    };
    return request;
  });
}

function scheduleExpiry(expiresAt: number) {
  clearTimeout(expiryTimer);
  expiryTimer = setTimeout(() => void pending.then(removeExpired).catch(() => {}), Math.max(0, expiresAt - Date.now()));
}

export function storeRecentFile(file: ValidatedAudioFile) {
  const expiresAt = Date.now() + FILE_TTL;
  pending = pending.then(async () => {
    await transaction(store => store.put({ ...file, expiresAt }, KEY));
    scheduleExpiry(expiresAt);
  }).catch(() => {});
  return pending;
}

export async function restoreRecentFile(): Promise<ValidatedAudioFile | undefined> {
  try {
    await pending;
    const entry = await removeExpired();
    if (entry && entry.expiresAt > Date.now()) {
      scheduleExpiry(entry.expiresAt);
      return entry;
    }
  } catch {
    // Selection and processing continue when browser storage is restricted.
  }
}

export function clearRecentFile() {
  clearTimeout(expiryTimer);
  pending = pending.then(async () => {
    await transaction(store => store.delete(KEY));
  }).catch(() => {});
  return pending;
}
