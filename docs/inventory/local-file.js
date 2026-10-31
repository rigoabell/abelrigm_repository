// The last dropped inventory file lives in this browser. A refresh reads it
// back without a token or a network call. One record, so a new drop replaces
// the previous file.

const DB_NAME = "inventory.desk";
const STORE = "files";
const KEY = "current";

export function fileFromInventoryRecord(record) {
  if (!record || !record.blob) return null;
  const name = record.name || "inventory.csv";
  return {
    file: new File([record.blob], name, {
      type: record.type || "text/csv",
      lastModified: Number(record.lastModified) || Date.parse(record.savedAt) || Date.now(),
    }),
    savedAt: record.savedAt || "",
    epoch: record.epoch ? String(record.epoch) : "",
  };
}

export async function saveLocalInventory(file, epoch) {
  const db = await openDb();
  try {
    await runTransaction(db, "readwrite", (store) => {
      store.put(
        {
          name: file.name || "inventory.csv",
          type: file.type || "text/csv",
          lastModified: file.lastModified || Date.now(),
          bytes: file.size,
          savedAt: new Date().toISOString(),
          epoch: String(epoch || ""),
          blob: file,
        },
        KEY
      );
    });
  } finally {
    db.close();
  }
}

export async function loadLocalInventory() {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  try {
    const record = await runTransaction(db, "readonly", (store) => store.get(KEY));
    return fileFromInventoryRecord(record);
  } finally {
    db.close();
  }
}

function openDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("This browser cannot keep a file for the next refresh."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("This browser could not open its saved inventory."));
  });
}

function runTransaction(db, mode, work) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = work(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request ? request.result : undefined);
    tx.onerror = () => reject(tx.error || new Error("This browser could not keep that file."));
    tx.onabort = () => reject(tx.error || new Error("This browser could not keep that file."));
  });
}
