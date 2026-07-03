// =============================
// PORTABLE STORAGE UTILITIES
// =============================

const PORTABLE_CLIENT_WORKERS_FILE = "client/workers.json";
const PORTABLE_CLIENT_HISTORY_FILE = "client/history.json";

/**
 * Check if portable storage (Electron preload) is available
 */
function hasPortableStorage() {
  return Boolean(
    window.portableStorage &&
      typeof window.portableStorage.writeJson === "function" &&
      typeof window.portableStorage.readJson === "function" &&
      typeof window.portableStorage.fileExists === "function",
  );
}

/**
 * Safely write JSON data to portable storage
 * Falls back gracefully if portable storage unavailable
 */
async function writePortableJsonSafe(relativePath, data) {
  if (!hasPortableStorage()) return;

  try {
    await window.portableStorage.writeJson(relativePath, data);
  } catch (error) {
    console.warn("No se pudo escribir almacenamiento portable:", relativePath, error);
  }
}

/**
 * Safely read JSON data from portable storage
 * Returns null if file not found or parse error
 */
async function readPortableJsonSafe(relativePath) {
  if (!hasPortableStorage()) return null;

  try {
    const data = await window.portableStorage.readJson(relativePath);

    if (data === null || data === undefined) {
      return null;
    }

    if (typeof data === "string") {
      const normalized = data.trim();
      if (normalized.length < 2) {
        return null;
      }

      try {
        return JSON.parse(normalized);
      } catch {
        return null;
      }
    }

    return data;
  } catch (error) {
    console.warn("No se pudo leer almacenamiento portable:", relativePath, error);
    return null;
  }
}

/**
 * Check if file exists in portable storage
 */
async function fileExistsPortableSafe(relativePath) {
  if (!hasPortableStorage()) return false;

  try {
    return await window.portableStorage.fileExists(relativePath);
  } catch (error) {
    console.warn("No se pudo validar existencia en portable:", relativePath, error);
    return false;
  }
}

/**
 * Persist workers array to localStorage
 * Called by both manual saves and auto-sync
 */
function persistWorkersDualWrite() {
  localStorage.setItem("workers", JSON.stringify(workers));
}

/**
 * Persist history array to localStorage
 * Called by both manual saves and auto-sync
 */
function persistHistoryDualWrite() {
  localStorage.setItem("history", JSON.stringify(history));
}

/**
 * Hydrate workers and history from portable storage on app start
 * Allows recovery of data saved in previous sessions
 */
async function hydrateWorkersHistoryFromPortableStorage() {
  const hasWorkersPortable = await fileExistsPortableSafe(
    PORTABLE_CLIENT_WORKERS_FILE,
  );
  if (hasWorkersPortable) {
    const portableWorkers = await readPortableJsonSafe(
      PORTABLE_CLIENT_WORKERS_FILE,
    );

    if (Array.isArray(portableWorkers)) {
      workers = portableWorkers.map((worker) => ({
        ...worker,
        pending: false,
      }));
      persistWorkersDualWrite();
    }
  }

  const hasHistoryPortable = await fileExistsPortableSafe(
    PORTABLE_CLIENT_HISTORY_FILE,
  );
  if (hasHistoryPortable) {
    const portableHistory = await readPortableJsonSafe(
      PORTABLE_CLIENT_HISTORY_FILE,
    );

    if (Array.isArray(portableHistory)) {
      history = portableHistory;
      persistHistoryDualWrite();
    }
  }
}

/**
 * Patch localStorage.setItem to automatically sync to portable storage
 * This ensures dual-write: localStorage AND portable storage
 */
const __originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function patchedSetItem(key, value) {
  __originalSetItem(key, value);

  if (key === "workers") {
    try {
      const parsed = JSON.parse(value || "[]");
      void writePortableJsonSafe(PORTABLE_CLIENT_WORKERS_FILE, parsed);
    } catch (error) {
      console.warn("No se pudo serializar workers para portable:", error);
    }
  }

  if (key === "history") {
    try {
      const parsed = JSON.parse(value || "[]");
      void writePortableJsonSafe(PORTABLE_CLIENT_HISTORY_FILE, parsed);
    } catch (error) {
      console.warn("No se pudo serializar history para portable:", error);
    }
  }
};

// Expose all functions globally
window.hasPortableStorage = hasPortableStorage;
window.writePortableJsonSafe = writePortableJsonSafe;
window.readPortableJsonSafe = readPortableJsonSafe;
window.fileExistsPortableSafe = fileExistsPortableSafe;
window.persistWorkersDualWrite = persistWorkersDualWrite;
window.persistHistoryDualWrite = persistHistoryDualWrite;
window.hydrateWorkersHistoryFromPortableStorage = hydrateWorkersHistoryFromPortableStorage;
