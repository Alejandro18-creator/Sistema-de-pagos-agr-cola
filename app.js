// =============================
// GUARDADO DE DATOS DEBOUNCEADO
// =============================
let saveTimer;
function saveLocalDataDebounced() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persistWorkersDualWrite();
    persistHistoryDualWrite();
    localStorage.setItem("labors", JSON.stringify(labors));
    localStorage.setItem("fundos", JSON.stringify(fundos));
    localStorage.setItem("faenas", JSON.stringify(faenas));
    console.log("Datos guardados localmente");
  }, 500);
}
// =============================
// ðŸ”„ DEBOUNCE PARA BUSCADORES
// =============================
let debounceTimer;
function debounceSearch(fn) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fn, 300);
}

// =============================
// ðŸŒ MODO LOCAL OFFLINE
// =============================

console.log("APP VERSION 2");

const STORAGE_URL = "local://offline";
const STORAGE_KEY = "local";
const USE_STORAGE = true; // Backend local integrado, sin almacenamiento local remoto

let editProductionIndex = null;
let workers = [];
let labors = [];
let history = [];
let fundos = [];
let faenas = [];

const PORTABLE_CLIENT_WORKERS_FILE = "client/workers.json";
const PORTABLE_CLIENT_HISTORY_FILE = "client/history.json";

function hasPortableStorage() {
  return Boolean(
    window.portableStorage &&
      typeof window.portableStorage.writeJson === "function" &&
      typeof window.portableStorage.readJson === "function" &&
      typeof window.portableStorage.fileExists === "function",
  );
}

async function writePortableJsonSafe(relativePath, data) {
  if (!hasPortableStorage()) return;

  try {
    await window.portableStorage.writeJson(relativePath, data);
  } catch (error) {
    console.warn("No se pudo escribir almacenamiento portable:", relativePath, error);
  }
}

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

async function fileExistsPortableSafe(relativePath) {
  if (!hasPortableStorage()) return false;

  try {
    return await window.portableStorage.fileExists(relativePath);
  } catch (error) {
    console.warn("No se pudo validar existencia en portable:", relativePath, error);
    return false;
  }
}

function persistWorkersDualWrite() {
  localStorage.setItem("workers", JSON.stringify(workers));
}

function persistHistoryDualWrite() {
  localStorage.setItem("history", JSON.stringify(history));
}

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

// Estado global del calendario semanal (requerido por production.js y app.js)
let currentCalendarDate = new Date();
let selectedDays = new Set();
let pendingCalendarMode = false;
window.selectedDays = selectedDays;

function toggleDay(dateStr) {
  if (!dateStr) return;
  if (selectedDays.has(dateStr)) {
    selectedDays.delete(dateStr);
  } else {
    selectedDays.add(dateStr);
  }

  if (typeof showCalendar === "function") {
    showCalendar(
      currentCalendarDate.getFullYear(),
      currentCalendarDate.getMonth(),
    );
  }
}

function changeMonth(direction) {
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  if (typeof showCalendar === "function") {
    showCalendar(year, month + Number(direction || 0));
  }
}

function todayDate() {
  currentCalendarDate = new Date();
  if (typeof showCalendar === "function") {
    showCalendar(
      currentCalendarDate.getFullYear(),
      currentCalendarDate.getMonth(),
    );
  }
}

function exitPendingCalendar() {
  pendingCalendarMode = false;
  const calendar = document.getElementById("calendarContainer");
  if (calendar) calendar.innerHTML = "";
}

// ⚠︝ Solo llamar explícitamente para un reset total (por ejemplo, botón de limpiar datos).
// NO llamar al inicio: borra todos los datos persistidos.
function initializeFreshLocalState() {
  const keysToClear = ["workers", "history", "labors", "fundos", "faenas", "sessionActive"];

  keysToClear.forEach((key) => localStorage.removeItem(key));

  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("offline_table:") || key.startsWith("offline_storage:")) {
      localStorage.removeItem(key);
    }
  }

  workers = [];
  labors = [];
  history = [];
  fundos = [];
  faenas = [];
  saveLocalDataDebounced();
}

// ✅ Restaura datos guardados desde localStorage al iniciar.
// No borra nada — carga lo que haya persistido en recargas/reinicios anteriores.
function initializeLocalState() {
  try {
    workers = JSON.parse(localStorage.getItem("workers") || "[]").map((worker) => ({
      ...worker,
      pending: false,
    }));
  } catch { workers = []; }
  try {
    history = JSON.parse(localStorage.getItem("history") || "[]");
  } catch { history = []; }
  try {
    labors = JSON.parse(localStorage.getItem("labors") || "[]");
  } catch { labors = []; }
  try {
    fundos = JSON.parse(localStorage.getItem("fundos") || "[]");
  } catch { fundos = []; }
  try {
    faenas = JSON.parse(localStorage.getItem("faenas") || "[]");
  } catch { faenas = []; }

  persistWorkersDualWrite();
  persistHistoryDualWrite();

  void hydrateWorkersHistoryFromPortableStorage();
}

initializeLocalState();

function loadFaenas() {
  const select = document.getElementById("faena");
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = "<option value=''>-- Seleccionar faena --</option>";

  faenas.forEach((f) => {
    const option = document.createElement("option");
    option.value = f;
    option.textContent = f;
    select.appendChild(option);
  });

  if (currentValue && faenas.includes(currentValue)) {
    select.value = currentValue;
  }
}

let isGeneratingFiniquito = false;
let isSyncInProgress = false;
let storageReachabilityCache = {
  checkedAt: 0,
  ok: true,
  errorMessage: "",
};
let cloudUnavailableNoticeShown = false;

function getReadableStorageErrorMessage(error, fallbackMessage) {
  const rawMessage =
    error?.message || error?.error_description || error?.details || "";
  const normalizedMessage = String(rawMessage).toLowerCase();

  if (!rawMessage) {
    return fallbackMessage;
  }

  if (
    normalizedMessage.includes("bucket") &&
    normalizedMessage.includes("not found")
  ) {
    return "El bucket worker-files no existe o no estÃ¡ accesible.";
  }

  if (
    normalizedMessage.includes("row-level security") ||
    normalizedMessage.includes("permission") ||
    normalizedMessage.includes("unauthorized") ||
    normalizedMessage.includes("forbidden")
  ) {
    return "El almacenamiento local rechazÃ³ la operaciÃ³n por permisos o polÃ­ticas internas.";
  }

  if (
    normalizedMessage.includes("network") ||
    normalizedMessage.includes("fetch") ||
    normalizedMessage.includes("failed to fetch")
  ) {
    return "No se pudo conectar con el almacenamiento local.";
  }

  return rawMessage;
}

function fileToDataUrl(fileBody) {
  return new Promise((resolve) => {
    if (!fileBody) {
      resolve("");
      return;
    }

    if (typeof fileBody === "string") {
      resolve(fileBody);
      return;
    }

    if (fileBody instanceof Blob) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result || "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(fileBody);
      return;
    }

    try {
      const serialized = JSON.stringify(fileBody);
      resolve(serialized);
    } catch (error) {
      resolve("");
    }
  });
}

function getOfflineFileMetadata(filePath, fileBody, contentType) {
  const normalizedContentType =
    contentType || fileBody?.type || "application/octet-stream";
  const nameFromPath = String(filePath || "").split("/").pop() || "archivo";
  const extension = nameFromPath.includes(".")
    ? nameFromPath.split(".").pop().toLowerCase()
    : "";

  let size = 0;
  if (typeof fileBody === "string") {
    size = fileBody.length;
  } else if (typeof fileBody?.size === "number") {
    size = fileBody.size;
  }

  return {
    kind: "file-metadata",
    storageMode: "metadata-only",
    filePath,
    fileName: nameFromPath,
    extension,
    contentType: normalizedContentType,
    workerRut: String(filePath || "").split("/")[0] || "",
    size,
    uploadedAt: new Date().toISOString(),
  };
}

function createOfflineStorageClient() {
  const TABLE_PREFIX = "offline_table:";
  const FILE_PREFIX = "offline_storage:";

  function readTable(tableName) {
    try {
      const raw = localStorage.getItem(TABLE_PREFIX + tableName);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("No se pudo leer la tabla local", tableName, error);
      return [];
    }
  }

  function writeTable(tableName, rows) {
    localStorage.setItem(TABLE_PREFIX + tableName, JSON.stringify(rows));
  }

  function matchFilters(row, filters) {
    return filters.every(({ column, value }) => {
      const rowValue = row?.[column];
      return rowValue === value || String(rowValue) === String(value);
    });
  }

  function applyOrder(rows, orderClauses) {
    const ordered = [...rows];
    orderClauses.forEach(({ column, ascending }) => {
      ordered.sort((a, b) => {
        const aValue = a?.[column];
        const bValue = b?.[column];
        const aNumber = Number(aValue);
        const bNumber = Number(bValue);

        if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber)) {
          return ascending ? aNumber - bNumber : bNumber - aNumber;
        }

        if (aValue === undefined || bValue === undefined) {
          return 0;
        }

        const comparison = String(aValue).localeCompare(String(bValue));
        return ascending ? comparison : -comparison;
      });
    });
    return ordered;
  }

  function createQueryBuilder(tableName) {
    const state = {
      tableName,
      filters: [],
      orderClauses: [],
      operation: null,
      payload: null,
      singleResult: false,
    };

    const builder = {
      select() {
        return builder;
      },
      insert(payload) {
        state.operation = "insert";
        state.payload = Array.isArray(payload) ? payload : [payload];
        return builder;
      },
      update(payload) {
        state.operation = "update";
        state.payload = payload;
        return builder;
      },
      delete() {
        state.operation = "delete";
        return builder;
      },
      eq(column, value) {
        state.filters.push({ column, value });
        return builder;
      },
      order(column, options) {
        state.orderClauses.push({
          column,
          ascending: options?.ascending !== false,
        });
        return builder;
      },
      single() {
        state.singleResult = true;
        return builder;
      },
      then(resolve, reject) {
        return execute().then(resolve, reject);
      },
      catch(reject) {
        return execute().catch(reject);
      },
      finally(callback) {
        return execute().finally(callback);
      },
    };

    async function execute() {
      const rows = readTable(state.tableName);
      let nextRows = [...rows];

      if (state.operation === "insert") {
        if (state.tableName === "workers") {
          const existingRutKeys = new Set(
            rows.map((row) => getRutKey(row?.rut)).filter(Boolean),
          );
          const payloadRutKeys = new Set();

          for (const row of state.payload || []) {
            const rutKey = getRutKey(row?.rut);
            if (!rutKey) continue;

            if (existingRutKeys.has(rutKey) || payloadRutKeys.has(rutKey)) {
              return {
                data: null,
                error: {
                  message:
                    'duplicate key value violates unique constraint "workers_rut_key"',
                  code: "23505",
                },
              };
            }

            payloadRutKeys.add(rutKey);
          }
        }

        const insertedRows = (state.payload || []).map((row) => ({
          ...row,
          id: row.id || `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        }));
        nextRows = [...rows, ...insertedRows];
        writeTable(state.tableName, nextRows);
        return {
          data: state.singleResult ? insertedRows[0] || null : insertedRows,
          error: null,
        };
      }

      const filtered = rows.filter((row) => matchFilters(row, state.filters));

      if (state.operation === "update") {
        const updatedRows = filtered.map((row) => ({
          ...row,
          ...state.payload,
        }));
        const updatedMap = new Map(rows.map((row) => [row.id, row]));
        filtered.forEach((row) => {
          updatedMap.set(row.id, { ...row, ...state.payload });
        });
        nextRows = Array.from(updatedMap.values());
        writeTable(state.tableName, nextRows);
        return {
          data: state.singleResult ? updatedRows[0] || null : updatedRows,
          error: null,
        };
      }

      if (state.operation === "delete") {
        nextRows = rows.filter((row) => !matchFilters(row, state.filters));
        writeTable(state.tableName, nextRows);
        return { data: [], error: null };
      }

      const selectedRows = applyOrder(filtered, state.orderClauses);
      return {
        data: state.singleResult ? selectedRows[0] || null : selectedRows,
        error: null,
      };
    }

    return builder;
  }

  return {
    from(tableName) {
      return createQueryBuilder(tableName);
    },
    storage: {
      from(bucketName) {
        return {
          async upload(filePath, fileBody, options = {}) {
            const normalizedPath = String(filePath || "");
            const normalizedContentType =
              options?.contentType || fileBody?.type || "";
            const isPdfUpload =
              normalizedContentType.toLowerCase().includes("application/pdf") ||
              normalizedPath.toLowerCase().endsWith(".pdf");

            const valueToStore = isPdfUpload
              ? JSON.stringify(
                  getOfflineFileMetadata(
                    normalizedPath,
                    fileBody,
                    normalizedContentType,
                  ),
                )
              : await fileToDataUrl(fileBody);

            localStorage.setItem(
              FILE_PREFIX + bucketName + ":" + filePath,
              valueToStore,
            );
            return { data: { path: filePath }, error: null };
          },
          getPublicUrl(filePath) {
            return {
              data: {
                publicUrl: `local://${bucketName}/${filePath}`,
              },
              error: null,
            };
          },
        };
      },
    },
  };
}

let storageClient = null;
if (window.storageApi && typeof window.storageApi.createClient === "function") {
  storageClient = window.storageApi.createClient(STORAGE_URL, STORAGE_KEY);
} else {
  window.storageApi = window.storageApi || {};
  window.storageApi.createClient = () => createOfflineStorageClient();
  storageClient = window.storageApi.createClient(STORAGE_URL, STORAGE_KEY);
}

async function ensureStorageReachable(force = false) {
  if (!force) {
    storageReachabilityCache = {
      checkedAt: Date.now(),
      ok: true,
      errorMessage: "",
    };
  }

  return {
    ok: true,
    errorMessage: "",
  };
}

async function notifyCloudUnavailableOnce(message) {
  if (cloudUnavailableNoticeShown || !message) return;
  cloudUnavailableNoticeShown = true;

  const fullMessage =
    "La app seguirÃ¡ funcionando en modo local. " + message;

  if (typeof showCustomAlert === "function") {
    await showCustomAlert(fullMessage);
    return;
  }

  alert(fullMessage);
}

function getStorageClientOrError() {
  if (!storageClient?.storage) {
    return {
      ok: false,
      errorMessage: "El almacenamiento local no estÃ¡ inicializado en la app.",
    };
  }

  return { ok: true, storage: storageClient.storage };
}

async function uploadFileToWorkerStorage(filePath, fileBody, contentType) {
  const storageState = getStorageClientOrError();
  if (!storageState.ok) {
    return { ok: false, errorMessage: storageState.errorMessage };
  }

  try {
    const { error } = await storageState.storage
      .from("worker-files")
      .upload(filePath, fileBody, {
        upsert: true,
        ...(contentType ? { contentType } : {}),
      });

    if (error) {
      return {
        ok: false,
        errorMessage: getReadableStorageErrorMessage(
          error,
          "No fue posible guardar el archivo localmente.",
        ),
        error,
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      errorMessage: getReadableStorageErrorMessage(
        error,
        "OcurriÃ³ un error inesperado al guardar el archivo localmente.",
      ),
      error,
    };
  }
}

// =============================
// ðŸ“Š TABLA INTERNA AFP (COMISIONES)
// Fuente: Superintendencia de Pensiones
// =============================

const afpRates = {
  Capital: 0.0144,
  Cuprum: 0.0144,
  Habitat: 0.0127,
  Modelo: 0.0058,
  PlanVital: 0.0116,
  Provida: 0.0145,
  Uno: 0.0046,
};

// CotizaciÃ³n obligatoria base
const AFP_BASE = 0.1; // 10%

/*â˜ï¸ GUARDAR EN almacenamiento local*/
// =============================

async function saveWorkerToCloud(worker) {
  if (!USE_STORAGE || !storageClient) {
    return { ok: false, errorMessage: "Modo local: almacenamiento deshabilitado." };
  }

  const reachability = await ensureStorageReachable();
  if (!reachability.ok) {
    return { ok: false, errorMessage: reachability.errorMessage };
  }

  const payload = {
    ...worker,
    pending: false,
  };
  const { error } = await storageClient.from("workers").insert([payload]);

  if (error) {
    if (error.message.includes("duplicate key")) {
      alert("Este RUT ya estÃ¡ registrado.");
      return { ok: false, errorMessage: error.message };
    }

    console.error("Error guardando trabajador en modo local:", error.message);
    return { ok: false, errorMessage: error.message };
  }

  console.log("Trabajador guardado localmente");
  return { ok: true, errorMessage: "" };
}

async function saveProductionToCloud(record) {
  if (!storageClient) {
    return { ok: false, errorMessage: "Sin almacenamiento local" };
  }

  const reachability = await ensureStorageReachable();
  if (!reachability.ok) {
    return { ok: false, errorMessage: reachability.errorMessage };
  }

  const { data, error } = await storageClient
    .from("history")
    .insert([record])
    .select()
    .single();

  if (error) {
    console.error("Error guardando producciÃ³n localmente:", error.message);
    return { ok: false, errorMessage: error.message };
  }

  console.log("ProducciÃ³n guardada localmente");
  return { ok: true, data, errorMessage: "" };
}

async function updateProductionInCloud(recordId, payload) {
  if (!storageClient) {
    return { ok: false, errorMessage: "Sin almacenamiento local" };
  }

  const reachability = await ensureStorageReachable();
  if (!reachability.ok) {
    return { ok: false, errorMessage: reachability.errorMessage };
  }

  const { data, error } = await storageClient
    .from("history")
    .update(payload)
    .eq("id", recordId)
    .select("id")
    .single();

  if (error) {
    console.error("Error actualizando producciÃ³n localmente:", error.message);
    return { ok: false, errorMessage: error.message };
  }

  return { ok: true, data, errorMessage: "" };
}

async function loadWorkersFromCloud() {
  if (!storageClient) return;
  const reachability = await ensureStorageReachable();
  if (!reachability.ok) return;

  const { data, error } = await storageClient.from("workers").select("*");
  if (error) {
    console.error("Error cargando trabajadores localmente:", error.message);
    return;
  }

  const localMap = new Map();
  (data || []).forEach((worker) =>
    localMap.set(worker.id, {
      ...worker,
      pending: false,
    }),
  );
  workers = Array.from(localMap.values());
  localStorage.setItem("workers", JSON.stringify(workers));
  console.log("Trabajadores cargados localmente");
}

async function loadHistoryFromCloud() {
  if (!storageClient) return;
  const reachability = await ensureStorageReachable();
  if (!reachability.ok) return;

  const { data, error } = await storageClient
    .from("history")
    .select("*")
    .order("date", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("Error cargando historial localmente:", error.message);
    return;
  }

  history = data || [];
  localStorage.setItem("history", JSON.stringify(history));
  console.log("Historial cargado localmente");
}

async function pruneHistoryOrphaned() {
  const workerRuts = new Set(
    (workers || []).map((w) => getRutKey(w.rut)).filter(Boolean),
  );

  if (workerRuts.size === 0) {
    return;
  }

  const orphaned = (history || []).filter((r) => {
    const rutKey = getRutKey(r.rut);
    return !rutKey || !workerRuts.has(rutKey);
  });

  if (orphaned.length === 0) {
    return;
  }

  const orphanedRuts = [...new Set(orphaned.map((r) => r.rut))];

  const { error } = await storageClient
    .from("history")
    .delete()
    .in("rut", orphanedRuts);

  if (error) {
    console.error(
      "Error eliminando historial huÃ©rfano en almacenamiento local:",
      error.message,
    );
  }

  history = history.filter((r) => {
    const rutKey = getRutKey(r.rut);
    return rutKey && workerRuts.has(rutKey);
  });
  localStorage.setItem("history", JSON.stringify(history));
  renderHistory();
}

function getHistoryDedupeKey(record) {
  const dateKey = getHistoryDateKey(record?.date);
  return [
    getRutKey(record?.rut),
    dateKey,
    getLaborKey(record?.labor),
    Number(record?.quantity) || 0,
    Number(record?.total) || 0,
    getFundoKey(record?.fundo),
  ].join("|");
}


function dedupeHistoryRecords(records) {
  const seen = new Set();
  const deduped = [];

  (records || []).forEach((record) => {
    const key = getHistoryDedupeKey(record);
    if (!key) {
      deduped.push(record);
      return;
    }
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    deduped.push(record);
  });

  return deduped;
}

async function purgeWorkerEverywhere({ name = "", rut = "" } = {}) {
  const nameKey = getWorkerNameKey(name);
  const rutKey = getRutKey(rut);

  if (!nameKey && !rutKey) {
    return { removedWorkers: 0, removedHistory: 0 };
  }

  const workerRutsToDelete = new Set();
  const originalWorkersCount = (workers || []).length;
  let cloudErrors = 0;
  const nextWorkers = [];

  (workers || []).forEach((w) => {
    const workerNameKey = getWorkerNameKey(w?.name);
    const workerRutKey = getRutKey(w?.rut);
    const matches =
      (nameKey && workerNameKey === nameKey) ||
      (rutKey && workerRutKey === rutKey);

    if (matches) {
      if (w?.rut) workerRutsToDelete.add(w.rut);
      return;
    }

    nextWorkers.push(w);
  });

  const historyIndexesToDelete = [];
  const historyIdsToDelete = [];

  (history || []).forEach((r, index) => {
    const recordNameKey = getWorkerNameKey(r?.name);
    const recordRutKey = getRutKey(r?.rut);

    const matchesName = nameKey && recordNameKey === nameKey;
    const matchesRut =
      (rutKey && recordRutKey === rutKey) ||
      (r?.rut && workerRutsToDelete.has(r.rut));

    if (matchesName || matchesRut) {
      historyIndexesToDelete.push(index);
      if (r?.id) historyIdsToDelete.push(r.id);
    }
  });

  if (storageClient) {
    if (historyIdsToDelete.length > 0) {
      const { error } = await storageClient
        .from("history")
        .delete()
        .in("id", historyIdsToDelete);

      if (error) {
        cloudErrors += 1;
        console.error("Error eliminando historial en almacenamiento local:", error.message);
      }
    }

    const rutsForCloudDelete = Array.from(workerRutsToDelete).filter(Boolean);
    if (rutsForCloudDelete.length > 0) {
      const { error: historyByRutError } = await storageClient
        .from("history")
        .delete()
        .in("rut", rutsForCloudDelete);

      if (historyByRutError) {
        cloudErrors += 1;
        console.error(
          "Error eliminando historial por RUT en almacenamiento local:",
          historyByRutError.message,
        );
      }

      const { error: workersError } = await storageClient
        .from("workers")
        .delete()
        .in("rut", rutsForCloudDelete);

      if (workersError) {
        cloudErrors += 1;
        console.error(
          "Error eliminando trabajadores en almacenamiento local:",
          workersError.message,
        );
      }
    }
  }

  workers = nextWorkers;

  historyIndexesToDelete
    .sort((a, b) => b - a)
    .forEach((index) => {
      history.splice(index, 1);
    });

  localStorage.setItem("workers", JSON.stringify(workers));
  localStorage.setItem("history", JSON.stringify(history));

  loadWorkers();
  renderWorkersTable();
  renderHistory();

  return {
    removedWorkers: originalWorkersCount - nextWorkers.length,
    removedHistory: historyIndexesToDelete.length,
    cloudOk: cloudErrors === 0,
  };
}

async function runOneTimeDataPurge() {
  const flag = "one_time_data_purge_v1";
  if (localStorage.getItem(flag) === "1") return;

  try {
    const result = await purgeWorkerEverywhere({ name: "keimer teran" });

    if (result?.cloudOk !== false) {
      localStorage.setItem(flag, "1");
    }
  } catch (e) {
    console.error("Error en purga de datos:", e);
  }
}

async function syncPendingLocalDataBeforeCloudDownload() {
  if (!storageClient) {
    console.warn("[syncPendingLocalDataBeforeCloudDownload] No storageClient");
    return { ok: true, failedHistory: 0, failedWorkers: 0 };
  }

  const reachability = await ensureStorageReachable();
  if (!reachability.ok) {
    console.warn(
      "[syncPendingLocalDataBeforeCloudDownload] almacenamiento local no alcanzable:",
      reachability.errorMessage,
    );
    return {
      ok: false,
      failedHistory: 0,
      failedWorkers: 0,
      errorMessage: reachability.errorMessage,
      reason: "storage_unreachable",
    };
  }

  const hasPendingWorkers = (workers || []).some(
    (worker) => worker?.pending === true,
  );

  const hasPendingHistory = (history || []).some((record) => {
    const localId = record?.id;
    return localId === undefined || localId === null || String(localId) === "";
  });

  if (!hasPendingWorkers && !hasPendingHistory) {
    console.log(
      "[syncPendingLocalDataBeforeCloudDownload] Sin pendientes locales, se omite escaneo completo de nube.",
    );
    return { ok: true, failedHistory: 0, failedWorkers: 0 };
  }

  const pendingWorkers = [];
  const localPendingRuts = new Set();

  (workers || []).forEach((worker) => {
    const rutKey = getRutKey(worker?.rut);
    if (!rutKey || localPendingRuts.has(rutKey)) {
      return;
    }

    if (worker?.pending === true) {
      localPendingRuts.add(rutKey);
      pendingWorkers.push(worker);
    }
  });

  // Diagnóstico y saneo mínimo: identificar workers pendientes inválidos
  // y eliminar SOLO esos registros corruptos del arreglo local.
  const invalidPendingWorkers = [];
  for (let i = workers.length - 1; i >= 0; i--) {
    const worker = workers[i];
    if (worker?.pending !== true) continue;

    const normalizedName = String(
      worker?.name || worker?.worker_name || worker?.workerFullName || worker?.fullName || "",
    ).trim();
    const normalizedRut = String(worker?.rut || worker?.worker_rut || "").trim();

    if (!worker?.name && normalizedName) worker.name = normalizedName;
    if (!worker?.rut && normalizedRut) worker.rut = normalizedRut;

    const name = String(worker?.name || "").trim();
    const rut = String(worker?.rut || "").trim();
    const reason = [];

    if (!name) reason.push("name vacío");
    if (!rut) reason.push("rut vacío");
    if (!worker || typeof worker !== "object") reason.push("estructura inválida");

    if (reason.length > 0) {
      invalidPendingWorkers.push({ index: i, worker, reason });
      workers.splice(i, 1);
    }
  }

  if (invalidPendingWorkers.length > 0) {
    invalidPendingWorkers.forEach(({ reason, worker }) => {
      console.error("SYNC ERROR:", "Worker pendiente inválido: " + reason.join(", "));
      console.error("FAILED WORKER:", worker);
    });
    localStorage.setItem("workers", JSON.stringify(workers));
  }

  // Recalcular pendientes después de limpiar inválidos
  pendingWorkers.length = 0;
  localPendingRuts.clear();
  (workers || []).forEach((worker) => {
    const rutKey = getRutKey(worker?.rut);
    if (!rutKey || localPendingRuts.has(rutKey)) {
      return;
    }

    if (worker?.pending === true) {
      localPendingRuts.add(rutKey);
      pendingWorkers.push(worker);
    }
  });

  // Detectar duplicados por RUT dentro de pendientes y mantener solo el primero válido.
  const duplicatePendingByRut = [];
  const seenPendingRut = new Set();
  for (let i = workers.length - 1; i >= 0; i--) {
    const worker = workers[i];
    if (worker?.pending !== true) continue;
    const rutKey = getRutKey(worker?.rut);
    if (!rutKey) continue;
    if (seenPendingRut.has(rutKey)) {
      duplicatePendingByRut.push({ index: i, worker, reason: "rut duplicado en pendientes" });
      workers.splice(i, 1);
      continue;
    }
    seenPendingRut.add(rutKey);
  }

  if (duplicatePendingByRut.length > 0) {
    duplicatePendingByRut.forEach(({ worker, reason }) => {
      console.error("SYNC ERROR:", reason);
      console.error("FAILED WORKER:", worker);
    });
    localStorage.setItem("workers", JSON.stringify(workers));

    pendingWorkers.length = 0;
    localPendingRuts.clear();
    (workers || []).forEach((worker) => {
      const rutKey = getRutKey(worker?.rut);
      if (!rutKey || localPendingRuts.has(rutKey)) return;
      if (worker?.pending === true) {
        localPendingRuts.add(rutKey);
        pendingWorkers.push(worker);
      }
    });
  }

  const pendingHistoryIndexes = [];
  (history || []).forEach((record, index) => {
    const localId = record?.id;
    const idKey =
      localId === undefined || localId === null ? "" : String(localId);
    if (!idKey) {
      pendingHistoryIndexes.push(index);
    }
  });

  console.log(
    "[syncPendingLocalDataBeforeCloudDownload] Pendientes locales -> workers:",
    pendingWorkers.length,
    "history:",
    pendingHistoryIndexes.length,
  );
  console.log("PENDING WORKERS:", pendingWorkers);

  let failedWorkers = 0;
  if (pendingWorkers.length > 0) {
    // En la arquitectura local, estos pendientes solo deben persistirse en SQLite/localStorage.
    // No deben quedar marcados como pending ni alimentar una cola cloud.
    pendingWorkers.forEach((worker) => {
      console.log("SYNC WORKER:", worker);
    });

    try {
      for (const worker of pendingWorkers) {
        try {
          const payload = {
            name: String(worker?.name || "").trim(),
            rut: String(worker?.rut || "").trim(),
            birthDate: worker?.birthDate || "",
            maritalStatus: worker?.maritalStatus || "",
            address: worker?.address || "",
            afp: worker?.afp || "",
            health: worker?.health || "",
            position: worker?.position || "",
            nationality: worker?.nationality || "",
            baseSalary: worker?.baseSalary || "",
            account_number: worker?.account_number || "",
            id_card_photo: worker?.id_card_photo || null,
            active: worker?.active !== false,
            pending: false,
          };

          if (!payload.name || !payload.rut) {
            failedWorkers += 1;
            console.error("SYNC ERROR:", "payload inválido (name/rut vacío)");
            console.error("FAILED WORKER:", worker);
            continue;
          }

          const { data: oneData, error: oneError } = await storageClient
            .from("workers")
            .insert([payload])
            .select("id, rut");

          if (oneError) {
            failedWorkers += 1;
            console.error("SYNC ERROR:", oneError);
            console.error("FAILED WORKER:", worker);
            continue;
          }

          const inserted = oneData?.[0];
          worker.id = inserted?.id || worker.id;
          worker.pending = false;
        } catch (oneEx) {
          failedWorkers += 1;
          console.error("SYNC ERROR:", oneEx);
          console.error("FAILED WORKER:", worker);
        }
      }
    } catch (e) {
      failedWorkers = pendingWorkers.length;
      console.error("SYNC ERROR:", e);
      pendingWorkers.forEach((worker) => {
        console.error("FAILED WORKER:", worker);
      });
    }
  }

  // Persistir estado limpio: nada debe quedar marcado como pending en una app local.
  workers = (workers || []).map((worker) => ({
    ...worker,
    pending: false,
  }));
  localStorage.setItem("workers", JSON.stringify(workers));

  let failedHistory = 0;
  if (pendingHistoryIndexes.length > 0) {
    // Insertar en lote (batch) para optimizar
    const batchPayload = pendingHistoryIndexes.map((idx) => {
      const payload = { ...history[idx] };
      delete payload.id;
      return payload;
    });
    try {
      const { data, error } = await storageClient
        .from("history")
        .insert(batchPayload)
        .select("id, rut, date");
      if (error) {
        failedHistory = pendingHistoryIndexes.length;
        console.error("Error batch insert history:", error.message);
      } else {
        // Marcar como sincronizados los que se insertaron
        (data || []).forEach((inserted, i) => {
          const idx = pendingHistoryIndexes[i];
          if (idx !== undefined) {
            history[idx] = { ...history[idx], id: inserted.id };
          }
        });
      }
    } catch (e) {
      failedHistory = pendingHistoryIndexes.length;
      console.error("ExcepciÃ³n en batch insert history:", e);
    }
  }

  localStorage.setItem("workers", JSON.stringify(workers));
  localStorage.setItem("history", JSON.stringify(history));

  return {
    ok: failedWorkers === 0 && failedHistory === 0,
    failedWorkers,
    failedHistory,
  };
}

// =============================
// ðŸ” PASSWORD
// =============================

const LOGIN_PASSWORD = "1234";

let editIndexWorker = null;

// =============================
// CARGAR RESPALDO SI NO HAY DATOS
// =============================
/* Bloque antigu si es que no hay internet o no se pudo conectar a almacenamiento local, para no perder la funcionalidad básica del sistema.*/
/*if (workers.length === 0) {

    fetch("data/respaldo.json")
        .then(res => res.json())
        .then(data => {

            workers = data.workers || [];
            history = data.history || [];
            labors = data.labors || [];

            localStorage.setItem(
                "workers",
                JSON.stringify(workers)
            );

            localStorage.setItem(
                "history",
                JSON.stringify(history)
            );

            localStorage.setItem(
                "labors",
                JSON.stringify(labors)
            );

            console.log("Respaldo cargado automÃ¡ticamente");
        });
}*/

// =============================
// ðŸªª FORMATO RUT
// =============================

function formatRutInput(input) {
  let value = input.value.replace(/[^0-9kK]/g, "").toUpperCase();

  if (value.length <= 1) {
    input.value = value;
    return;
  }

  let body = value.slice(0, -1);
  let dv = value.slice(-1);

  body = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  input.value = body + "-" + dv;
}

// =============================
// ðŸ” LOGIN
// =============================

async function loginUser() {
  const pass = document.getElementById("password").value;

  if (pass === LOGIN_PASSWORD) {
    localStorage.setItem("sessionActive", "true");

    document.getElementById("login").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");

    const syncIndicator = document.getElementById("syncIndicator");
    if (syncIndicator) {
      syncIndicator.style.display = "none";
      syncIndicator.style.visibility = "hidden";
      syncIndicator.style.pointerEvents = "none";
      syncIndicator.remove();
    }

    // Ejecutar la sincronizaciÃ³n en segundo plano, no bloquear la UI
    setTimeout(() => {
      initSystem();
    }, 0);
  } else {
    alert("Contraseña incorrecta");
  }
}

function logout() {
  localStorage.removeItem("sessionActive");
  location.reload();
}

// =============================
//  TRABAJADORES
// =============================

async function addWorker() {
  console.log("editIndexWorker:", editIndexWorker);

  // Leer directamente por ID real del formulario
  const workerName = (document.getElementById("workerName")?.value || "").trim();
  const workerRut = (document.getElementById("workerRut")?.value || "").trim();
  const account = document.getElementById("workerAccount")?.value || "";
  const birthDate = document.getElementById("workerBirthDate")?.value.trim() || "";
  const maritalStatus = document.getElementById("workerMaritalStatus")?.value.trim() || "";
  const address = document.getElementById("workerAddress")?.value.trim() || "";
  const afp = document.getElementById("workerAFP")?.value.trim() || "";
  const health = document.getElementById("workerHealth")?.value.trim() || "";
  const position = document.getElementById("workerPosition")?.value.trim() || "";
  const nationality = document.getElementById("workerNationality")?.value.trim() || "";
  const baseSalary = (document.getElementById("workerBaseSalary")?.value || "")
    .replace(/\$/g, "")
    .replace(/\./g, "");

  let photoUrl = null;
  console.log("NAME:", workerName);
  console.log("RUT:", workerRut);

  if (!workerName || !workerRut) {
    alert("Falta completar campos obligatorios (Nombre y RUT).");
    return;
  }
  // ðŸ”¹ VALIDAR RUT DUPLICADO (normalizado)
  const workerRutKey = getRutKey(workerRut);
  const currentEditIndex =
    editIndexWorker !== null ? Number(editIndexWorker) : -1;
  const rutIndex = workers.findIndex((w, index) => {
    if (index === currentEditIndex) return false;
    return getRutKey(w?.rut) === workerRutKey;
  });

  if (workerRutKey && rutIndex !== -1) {
    await showCustomAlert("Ya existe un trabajador registrado con ese RUT.");
    return;
  }

  // ðŸ”¹ Subir imagen si existe
  const fileInput = document.getElementById("workerIdPhoto");
  if (USE_STORAGE && fileInput && fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const fileName = Date.now() + "_" + file.name;
    const filePath = workerRut + "/" + fileName;

    const uploadResult = await uploadFileToWorkerStorage(filePath, file);

    console.log("UPLOAD ERROR:", uploadResult.error);

    if (uploadResult.ok) {
      const publicUrlData = storageClient.storage
        .from("worker-files")
        .getPublicUrl(filePath);

      photoUrl = publicUrlData.data.publicUrl;
      console.log("PHOTO URL GENERADA:", photoUrl);
    } else {
      console.error("Error subiendo imagen:", uploadResult.error);
      alert("No se pudo subir la imagen del trabajador. " + uploadResult.errorMessage);
    }
  }

  // ðŸ”¹ EDICIÃ“N
  if (editIndexWorker !== null) {
    workers[editIndexWorker] = {
      ...workers[editIndexWorker],
      name: workerName,
      rut: workerRut,
      birthDate,
      maritalStatus,
      address,
      afp,
      health,
      position,
      nationality,
      account_number: account,
      id_card_photo: photoUrl || workers[editIndexWorker].id_card_photo,
    };
    console.log("VALOR FINAL photoUrl:", photoUrl);
    if (USE_STORAGE && storageClient && workers[editIndexWorker]?.id) {
      const { data, error } = await storageClient
        .from("workers")
        .update({
          name: workerName,
          rut: workerRut,
          birthDate,
          maritalStatus,
          address,
          afp,
          health,
          position,
          nationality,
          account_number: account,
          id_card_photo: photoUrl || workers[editIndexWorker].id_card_photo,
        })
        .eq("id", workers[editIndexWorker].id);

      console.log("UPDATE RESULT:", data);
      console.log("UPDATE ERROR:", error);
    }

    editIndexWorker = null;
  }

  // ðŸ”¹ NUEVO TRABAJADOR
  else {
    const newWorker = {
      name: workerName,
      rut: workerRut,
      birthDate,
      maritalStatus,
      address,
      afp,
      health,
      position,
      nationality,
      baseSalary,
      account_number: account,
      id_card_photo: photoUrl,
    };

    workers.push(newWorker);

    if (USE_STORAGE && storageClient) {
      const cloudSaveResult = await saveWorkerToCloud(newWorker);
      if (cloudSaveResult?.ok) {
        console.log("Trabajador guardado en almacenamiento local");
      }
    }
  }

  saveLocalDataDebounced();

  clearWorkerForm();
  loadWorkers();
  renderWorkersTable();

  showCustomAlert("Trabajador guardado correctamente");
}
// =============================
// 📋 SELECTS
// =============================

function loadPagosWorkerFilter() {
  // El filtro ahora usa búsqueda dinámica, no hace falta poblar un select
}

function filterWorkersPagos() {
  const searchInput = document.getElementById("searchWorkerPagos");
  const list = document.getElementById("workerPagosList");
  const hiddenInput = document.getElementById("filterPaymentsWorker");

  if (!searchInput || !list || !hiddenInput) return;

  const search = searchInput.value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim();

  hiddenInput.value = "";
  list.innerHTML = "";

  if (search === "") {
    list.style.display = "none";
    return;
  }

  const currentValue = select.value;
  select.innerHTML = "<option value=''>-- Seleccionar fundo --</option>";

  fundos.forEach((f) => {
    const option = document.createElement("option");
    option.value = f;
    option.textContent = f;
    select.appendChild(option);
  });

  if (currentValue && fundos.includes(currentValue)) {
    select.value = currentValue;
  }
}
// =============================
// ðŸ¦ CARGAR AFP EN SELECT
// =============================

function loadAFPOptions() {
  const select = document.getElementById("workerAFP");
  if (!select) return;

  // Limpiar por seguridad
  select.innerHTML = "<option value=''>-- Seleccionar AFP --</option>";

  Object.keys(afpRates).forEach((afp) => {
    const option = document.createElement("option");
    option.value = afp;
    option.textContent = afp;
    select.appendChild(option);
  });
}

function loadMandanteFundoFilter() {
  const select = document.getElementById("mandanteFundoFilter");
  if (!select) return;

  const currentValue = select.value;
  const fundoMap = new Map();

  history.forEach((record) => {
    const fundoKey = getFundoKey(record.fundo) || "sin-fundo";
    const fundoLabel = getFundoDisplay(record.fundo, "Sin fundo");

    if (!fundoMap.has(fundoKey)) {
      fundoMap.set(fundoKey, fundoLabel);
    }
  });

  select.innerHTML = "<option value=''>-- Todos los fundos --</option>";

  Array.from(fundoMap.entries())
    .sort((a, b) => a[1].localeCompare(b[1], "es"))
    .forEach(([key, label]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = label;
      select.appendChild(option);
    });

  if (currentValue && fundoMap.has(currentValue)) {
    select.value = currentValue;
  }
}

// =============================
// ðŸ§© AUXILIARES
// =============================

function formatCurrency(input) {
  let value = input.value.replace(/\D/g, "");

  if (!value) {
    input.value = "";
    return;
  }

  input.value = "$" + Number(value).toLocaleString("es-CL");
}

function filterWorkersWeekly() {
  const searchInput = document.getElementById("searchWorkerWeekly");
  const resultsList = document.getElementById("workerWeeklyList");
  const hiddenSelect = document.getElementById("workerWeekly");

  if (!searchInput || !resultsList || !hiddenSelect) return;

  const search = searchInput.value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim();

  hiddenSelect.value = "";

  // Si estÃ¡ vacÃ­o, ocultar lista y limpiar selecciÃ³n
  if (search === "") {
    resultsList.style.display = "none";
    resultsList.innerHTML = "";
    hiddenSelect.value = "";
    document.getElementById("calendarContainer").innerHTML = "";
    document.getElementById("weeklyResult").innerHTML = "";
    return;
  }

  // Filtrar trabajadores
  const filtered = workers.filter((worker, index) => {
    const name = (worker.name || "").toLowerCase();
    const cleanRut = (worker.rut || "")
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/-/g, "");

    const matchRut = cleanRut.includes(search);
    const matchName = name.includes(search);

    return matchRut || matchName;
  });

  // Mostrar resultados
  if (filtered.length === 0) {
    resultsList.innerHTML =
      "<div style='padding: 10px; color: #999;'>No se encontraron resultados</div>";
    resultsList.style.display = "block";
    return;
  }

  let html = "";
  filtered.forEach((worker, i) => {
    const originalIndex = workers.indexOf(worker);
    html += `<div class="worker-weekly-item" data-index="${originalIndex}" data-name="${worker.name.replace(/"/g, "&quot;")}" style='padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;'>`;
    html += `<strong>${worker.name}</strong><br>`;
    html += `<small style='color: #666;'>${worker.rut}</small>`;
    html += "</div>";
  });

  resultsList.innerHTML = html;
  resultsList.style.display = "block";

  // Asignar eventos CSP-compliant
  resultsList.querySelectorAll(".worker-weekly-item").forEach((div) => {
    div.addEventListener("click", function () {
      selectWorkerWeekly(
        Number(this.getAttribute("data-index")),
        this.getAttribute("data-name"),
      );
    });
    div.addEventListener("mouseover", function () {
      this.style.background = "#f0f0f0";
    });
    div.addEventListener("mouseout", function () {
      this.style.background = "white";
    });
  });
}

function filterWorkersProduction() {
  const input = document
    .getElementById("searchWorkerProduction")
    .value.toLowerCase();

  const list = document.getElementById("workerProductionList");
  list.innerHTML = "";

  if (!input) {
    list.style.display = "none";
    return;
  }

  const filtered = workers.filter((w) => {
    if (w.active === false) return false;
    return (
      (w.name || "").toLowerCase().includes(input) ||
      (w.rut || "").toLowerCase().includes(input)
    );
  });

  filtered.forEach((w) => {
    const div = document.createElement("div");
    div.textContent = `${w.name} - ${w.rut}`;
    div.addEventListener("click", () => {
      document.getElementById("searchWorkerProduction").value = w.name;
      document.getElementById("workerSelect").value = workers.indexOf(w);
      list.style.display = "none";
    });
    list.appendChild(div);
  });

  list.style.display = "block";
}

function clearWorkerProductionSearch() {
  const searchInput = document.getElementById("searchWorkerProduction");
  const list = document.getElementById("workerProductionList");
  const hiddenSelect = document.getElementById("workerSelect");

  if (searchInput) searchInput.value = "";
  if (hiddenSelect) hiddenSelect.value = "";
  if (list) {
    list.style.display = "none";
    list.innerHTML = "";
  }
}

function filterWorkersContract() {
  const searchInput = document.getElementById("searchWorkerContract");
  const list = document.getElementById("workerContractList");
  const hiddenSelect = document.getElementById("workerContract");

  if (!searchInput || !list || !hiddenSelect) return;

  const search = searchInput.value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim();

  hiddenSelect.value = "";
  list.innerHTML = "";

  if (search === "") {
    list.style.display = "none";
    return;
  }

  const filtered = workers.filter((worker) => {
    const name = (worker.name || "").toLowerCase();
    const cleanRut = (worker.rut || "")
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/-/g, "");

    return name.includes(search) || cleanRut.includes(search);
  });

  if (filtered.length === 0) {
    list.innerHTML =
      "<div style='padding: 10px; color: #999;'>No se encontraron resultados</div>";
    list.style.display = "block";
    return;
  }

  filtered.forEach((worker) => {
    const div = document.createElement("div");
    div.innerHTML = `<strong>${worker.name || ""}</strong><br><small style='color:#666;'>${worker.rut || ""}</small>`;
    div.addEventListener("click", () => {
      const index = workers.indexOf(worker);
      hiddenSelect.value = index;
      searchInput.value = worker.name || "";
      list.style.display = "none";
      list.innerHTML = "";
    });
    list.appendChild(div);
  });

  list.style.display = "block";
}

function clearWorkerContractSearch() {
  const searchInput = document.getElementById("searchWorkerContract");
  const list = document.getElementById("workerContractList");
  const hiddenSelect = document.getElementById("workerContract");

  if (searchInput) searchInput.value = "";
  if (hiddenSelect) hiddenSelect.value = "";
  if (list) {
    list.style.display = "none";
    list.innerHTML = "";
  }

  // Limpiar solo datos del trabajador (mantener fecha/fundo/sueldo/jornada)
  document.getElementById("c_name").textContent =
    "_______________________________";
  document.getElementById("c_rut").textContent = "______________________";
  document.getElementById("c_maritalStatus").textContent =
    "______________________";
  document.getElementById("c_birthDate").textContent = "____ / ____ / ____";
  document.getElementById("c_address").textContent =
    "_________________________";
  document.getElementById("c_nationality").textContent =
    "______________________";
  document.getElementById("c_afp").textContent = "______________";
  document.getElementById("c_health").textContent = "____________";
  document.getElementById("c_workerSign").textContent = "________________";
}

function clearAllContract() {
  clearWorkerContractSearch();

  const startDate = document.getElementById("startDate");
  const faena = document.getElementById("faena");
  const fundoSelect = document.getElementById("fundoSelect");
  const newFundo = document.getElementById("newFundo");
  const workSchedule = document.getElementById("workSchedule");
  const salary = document.getElementById("salary");

  if (startDate) startDate.value = "";
  if (faena) faena.value = "";
  if (fundoSelect) fundoSelect.value = "";
  if (newFundo) newFundo.value = "";
  if (workSchedule) workSchedule.value = "";
  if (salary) salary.value = "";

  document.getElementById("c_day").textContent = "____";
  document.getElementById("c_month").textContent = "__________________";
  document.getElementById("c_year").textContent = "20____";
  document.getElementById("c_startDate").textContent = "___/___/20__";
  document.getElementById("c_faena").textContent = "________________________";
  document.getElementById("c_salary").textContent = "____________";

  const scheduleEl = document.getElementById("c_workSchedule");
  if (scheduleEl) {
    scheduleEl.textContent =
      "La jornada ordinaria de trabajo será¡ _______________________________.";
  }
}

function clearWorkerMonthlySearch() {
  const searchInput = document.getElementById("searchWorkerMonthly");
  const list = document.getElementById("workerMonthlyList");
  const hiddenSelect = document.getElementById("workerMonthly");

  if (searchInput) searchInput.value = "";
  if (hiddenSelect) hiddenSelect.value = "";
  if (list) {
    list.style.display = "none";
    list.innerHTML = "";
  }
}

function filterWorkersFiniquito() {
  const searchInput = document.getElementById("searchWorkerFiniquito");
  const list = document.getElementById("workerFiniquitoList");
  const hiddenSelect = document.getElementById("workerFiniquito");

  if (!searchInput || !list || !hiddenSelect) return;

  const search = searchInput.value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim();

  const selectedName = (searchInput.dataset.monthlySelectedName || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim();

  if (
    searchInput.dataset.monthlyWorkerLocked === "1" &&
    hiddenSelect.value !== "" &&
    search === selectedName
  ) {
    list.style.display = "none";
    list.innerHTML = "";
    return;
  }

  if (search !== selectedName) {
    delete searchInput.dataset.monthlyWorkerLocked;
  }

  hiddenSelect.value = "";
  list.innerHTML = "";

  if (search === "") {
    list.style.display = "none";
    return;
  }

  const filtered = workers.filter((worker) => {
    const name = (worker.name || "").toLowerCase();
    const cleanRut = (worker.rut || "")
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/-/g, "");

    return name.includes(search) || cleanRut.includes(search);
  });

  if (filtered.length === 0) {
    list.innerHTML =
      "<div style='padding: 10px; color: #999;'>No se encontraron resultados</div>";
    list.style.display = "block";
    return;
  }

  filtered.forEach((worker) => {
    const div = document.createElement("div");
    div.innerHTML = `<strong>${worker.name || ""}</strong><br><small style='color:#666;'>${worker.rut || ""}</small>`;
    div.addEventListener("click", () => {
      clearTimeout(debounceTimer);
      const index = workers.indexOf(worker);
      hiddenSelect.value = String(index);
      searchInput.value = worker.name || "";
      searchInput.dataset.monthlySelectedName = worker.name || "";
      searchInput.dataset.monthlyWorkerLocked = "1";
      document.getElementById("f_workerName").textContent = worker.name;
      const workerRecords = history
        .filter((r) => r.rut === worker.rut)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      if (workerRecords.length > 0) {
        const parts = workerRecords[0].date.split("-");
        const formatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
        document.getElementById("f_startDate").textContent = formatted;
      } else {
        document.getElementById("f_startDate").textContent =
          "____ / ____ / ______";
      }
      refreshFiniquitoResumen();
      list.style.display = "none";
      list.innerHTML = "";
    });
    list.appendChild(div);
  });

  list.style.display = "block";
}

function clearWorkerFiniquitoSearch() {
  const searchInput = document.getElementById("searchWorkerFiniquito");
  const list = document.getElementById("workerFiniquitoList");
  const hiddenSelect = document.getElementById("workerFiniquito");

  if (searchInput) searchInput.value = "";
  if (hiddenSelect) hiddenSelect.value = "";
  if (list) {
    list.style.display = "none";
    list.innerHTML = "";
  }
}

function filterWorkersLiquidation() {
  const input = document
    .getElementById("searchWorkerLiquidation")
    .value.toLowerCase();

  const hiddenSelect = document.getElementById("workerLiquidation");

  const list = document.getElementById("workerLiquidationList");
  list.innerHTML = "";

  if (hiddenSelect) {
    hiddenSelect.value = "";
  }

  if (!input) {
    hiddenSelect.value = "";
    list.style.display = "none";
    return;
  }

  const filtered = workers.filter(
    (w) =>
      (w.name || "").toLowerCase().includes(input) ||
      (w.rut || "").toLowerCase().includes(input),
  );

  if (filtered.length === 0) {
    list.innerHTML =
      "<div style='padding: 10px; color: #999;'>No se encontraron resultados</div>";
    list.style.display = "block";
    return;
  }

  filtered.forEach((w) => {
    const div = document.createElement("div");
    div.textContent = `${w.name} - ${w.rut}`;
    div.addEventListener("click", () => {
      clearTimeout(debounceTimer);
      console.log("LIQUIDATION WORKER CLICK:", w);
      const index = workers.indexOf(w);
      const workerLiquidation = hiddenSelect;
      if (workerLiquidation) {
        const targetValue = String(index);
        if (!workerLiquidation.querySelector(`option[value="${targetValue}"]`)) {
          const opt = document.createElement("option");
          opt.value = targetValue;
          opt.textContent = w.name || "";
          workerLiquidation.appendChild(opt);
        }
        workerLiquidation.value = targetValue;
        console.log("SETTING INPUT:", workerLiquidation);
        console.log("VALUE AFTER SET:", workerLiquidation.value);
      }
      document.getElementById("searchWorkerLiquidation").value = w.name;
      list.style.display = "none";
      list.innerHTML = "";
    });
    list.appendChild(div);
  });

  list.style.display = "block";
}
document.addEventListener(
  "mousedown",
  (event) => {
    event.stopPropagation();
  },
  true,
);

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerLiquidation");
  const list = document.getElementById("workerLiquidationList");
  const hiddenSelect = document.getElementById("workerLiquidation");

  if (!searchInput || !list || !hiddenSelect) return;

  const clickedInsideInput = searchInput.contains(event.target);
  const clickedInsideList = list.contains(event.target);

  if (clickedInsideInput || clickedInsideList) return;

  list.style.display = "none";
  list.innerHTML = "";

  if (!hiddenSelect.value) {
    searchInput.value = "";
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerWeekly");
  const list = document.getElementById("workerWeeklyList");
  const hiddenSelect = document.getElementById("workerWeekly");

  if (!searchInput || !list || !hiddenSelect) return;

  const clickedInsideInput = searchInput.contains(event.target);
  const clickedInsideList = list.contains(event.target);

  if (clickedInsideInput || clickedInsideList) return;

  list.style.display = "none";
  list.innerHTML = "";

  if (!hiddenSelect.value) {
    searchInput.value = "";
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerEdit");
  const list = document.getElementById("workerEditList");
  const hiddenSelect = document.getElementById("workerEditSelect");

  if (!searchInput || !list || !hiddenSelect) return;

  const clickedInsideInput = searchInput.contains(event.target);
  const clickedInsideList = list.contains(event.target);

  if (clickedInsideInput || clickedInsideList) return;

  list.style.display = "none";
  list.innerHTML = "";

  if (!hiddenSelect.value) {
    searchInput.value = "";
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerContract");
  const list = document.getElementById("workerContractList");
  const hiddenSelect = document.getElementById("workerContract");

  if (!searchInput || !list || !hiddenSelect) return;

  const clickedInsideInput = searchInput.contains(event.target);
  const clickedInsideList = list.contains(event.target);

  if (clickedInsideInput || clickedInsideList) return;

  list.style.display = "none";
  list.innerHTML = "";

  if (!hiddenSelect.value) {
    searchInput.value = "";
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerMonthly");
  const list = document.getElementById("workerMonthlyList");
  const hiddenSelect = document.getElementById("workerMonthly");

  if (!searchInput || !list || !hiddenSelect) return;

  const clickedInsideInput = searchInput.contains(event.target);
  const eventPath =
    typeof event.composedPath === "function" ? event.composedPath() : [];
  const clickedInsideList =
    list.contains(event.target) || eventPath.includes(list);

  if (clickedInsideInput || clickedInsideList) return;

  list.style.display = "none";
  list.innerHTML = "";

  if (!hiddenSelect.value) {
    searchInput.value = "";
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerFiniquito");
  const list = document.getElementById("workerFiniquitoList");
  const hiddenSelect = document.getElementById("workerFiniquito");

  if (!searchInput || !list || !hiddenSelect) return;

  const clickedInsideInput = searchInput.contains(event.target);
  const clickedInsideList = list.contains(event.target);

  if (clickedInsideInput || clickedInsideList) return;

  list.style.display = "none";
  list.innerHTML = "";

  if (!hiddenSelect.value) {
    searchInput.value = "";
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerPagos");
  const list = document.getElementById("workerPagosList");
  if (!searchInput || !list) return;
  if (searchInput.contains(event.target) || list.contains(event.target)) return;
  list.style.display = "none";
  list.innerHTML = "";
});

function selectWorkerWeekly(index, name) {
  document.getElementById("workerWeekly").value = index;
  document.getElementById("searchWorkerWeekly").value = name;
  document.getElementById("workerWeeklyList").style.display = "none";
  document.getElementById("workerWeeklyList").innerHTML = "";

  // Limpiar dÃ­as seleccionados del trabajador anterior
  selectedDays.clear();

  // Limpiar el resumen si habÃ­a uno generado
  document.getElementById("weeklyResult").innerHTML = "";

  // Mostrar calendario automÃ¡ticamente
  showCalendar();
}

async function generateLiquidation() {
  const workerIndex = document.getElementById("workerLiquidation").value;
  const month = document.getElementById("monthLiquidation").value;

  if (workerIndex === "" || !month) {
    await showCustomAlert("Seleccione trabajador y mes.");
    return;
  }

  const worker = workers[workerIndex];

  // ===== PRODUCCIÃ“N DEL MES =====

  const recordsRaw = history.filter(
    (r) => r.rut === worker.rut && isHistoryRecordInMonth(r.date, month),
  );

  const records = dedupeHistoryRecords(recordsRaw);

  records.sort((a, b) => new Date(a.date) - new Date(b.date));
  const uniqueDates = [
    ...new Set(records.map((r) => getHistoryDateKey(r.date))),
  ];
  const daysWorked = uniqueDates.length;

  if (records.length === 0) {
    await showCustomAlert("No hay producción ese mes.");
    return;
  }

  const produccionReal = records.reduce((sum, r) => sum + r.total, 0);

  const minimumWageInput = document.getElementById("minimumWage");
  console.log("MINIMUM WAGE INPUT:", minimumWageInput?.value);
  const sueldoMinimoInputValue = Number(
    String(minimumWageInput?.value || "")
      .replace(/\$/g, "")
      .replace(/\./g, "")
      .replace(/,/g, "."),
  );
  const sueldoMinimoMensual =
    Number.isFinite(sueldoMinimoInputValue) && sueldoMinimoInputValue > 0
      ? Math.round(sueldoMinimoInputValue)
      : Number(localStorage.getItem("minimumWage") || 0);
  const [yearPart, monthPart] = month.split("-").map(Number);
  const diasDelMes =
    Number.isFinite(yearPart) && Number.isFinite(monthPart)
      ? new Date(yearPart, monthPart, 0).getDate()
      : 30;
  console.log({
    sueldoMinimoMensual,
    diasTrabajados: daysWorked,
    diasDelMes,
  });
  const sueldoBaseProporcional =
    sueldoMinimoMensual > 0 && diasDelMes > 0
      ? Math.round((sueldoMinimoMensual / diasDelMes) * daysWorked)
      : 0;
  const sueldoBase = sueldoBaseProporcional;
  const sueldoMinimoConfigurado = sueldoMinimoMensual;
  let bonoProduccion = produccionReal;
  let totalFinal = sueldoBase + bonoProduccion;

  if (sueldoMinimoConfigurado > 0 && totalFinal > sueldoMinimoConfigurado) {
    bonoProduccion = Math.max(0, sueldoMinimoConfigurado - sueldoBase);
    totalFinal = sueldoBase + bonoProduccion;
  }

  const baseImponible = totalFinal;

  // ===== DESCUENTOS =====

  const anticipos = Number(
    document.getElementById("advanceAmount").value.replace(/\./g, "") || 0,
  );

  const afpName = worker.afp || "";
  const comisionAFP = afpRates[afpName] || 0;
  const porcentajeAFP = AFP_BASE + comisionAFP;

  const afp = Math.round(baseImponible * porcentajeAFP);
  const salud = Math.round(baseImponible * 0.07);

  const totalDescuentos = afp + salud + anticipos;

  const liquido = totalFinal - totalDescuentos;

  console.log({
    sueldoBase,
    bonoProduccion,
    sueldoMinimoConfigurado,
    sueldoBaseProporcional,
    produccionReal,
    totalFinal,
  });

  // ===== DOCUMENTO HTML =====

  const html = `
<div class="liq-doc">

<h1>LIQUIDACIÓN DE SUELDO</h1>
<h3>${month}</h3>

<p><strong>Nombre:</strong> ${worker.name}</p>
<p><strong>RUT:</strong> ${worker.rut}</p>
<p><strong>Cargo:</strong> ${worker.position || "-"}</p>
<p><strong>AFP:</strong> ${worker.afp || "-"}</p>
<p><strong>Salud:</strong> ${worker.health || "-"}</p>
<p><strong>Días trabajados:</strong> ${daysWorked}</p>

<hr>

<h3>HABERES IMPONIBLES</h3>

<table>

<tr>
<td>SUELDO BASE</td>
<td>$${sueldoBaseProporcional.toLocaleString("es-CL")}</td>
</tr>

<tr>
<td>BONO DE PRODUCCIÓN</td>
<td>$${bonoProduccion.toLocaleString("es-CL")}</td>
</tr>

<tr>
<th>Total Final a Pagar</th>
<th>$${totalFinal.toLocaleString("es-CL")}</th>
</tr>
</table>

<h3>DESCUENTOS</h3>

<table>
<tr>
<td>AFP ${(porcentajeAFP * 100).toFixed(2)}%</td>
<td>$${afp.toLocaleString("es-CL")}</td>
</tr>

<tr>
<td>Salud 7%</td>
<td>$${salud.toLocaleString("es-CL")}</td>
</tr>

<tr>
<td>Anticipos del Mes</td>
<td>${formatMoney(anticipos)}</td>
</tr>

<tr>
<th>Total Descuentos</th>
<th>$${totalDescuentos.toLocaleString("es-CL")}</th>
</tr>
</table>

<h2>LÍQUIDO A PAGAR: ${formatMoney(liquido)}</h2>

<div style="margin-top:60px;text-align:center">
  <div style="border-top:1px solid #222;width:220px;margin:0 auto 4px auto;height:0"></div>
  <span style="font-size:15px">${worker.name}</span>
</div>

</div>
`;

  const container = document.getElementById("liquidationPrint");
  container.innerHTML = html;
  container.classList.remove("hidden");

  // ===== CREAR PDF =====

  const pdfBlob = await createPdfBlobFromHtml(html, {
    extraStyles: `
      .liq-doc {
        max-width: 760px;
        margin: 0 auto;
      }
    `,
    scale: 2,
  });

  if (!pdfBlob) {
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = "liquidacion_" + month + "_" + stamp + ".pdf";
  const filePath = worker.rut + "/" + fileName;

  // ===== SUBIR A almacenamiento local =====

  const uploadResult = await uploadFileToWorkerStorage(
    filePath,
    pdfBlob,
    "application/pdf",
  );

  if (!uploadResult.ok) {
    console.error("Error subiendo liquidación:", uploadResult.error);
    await showCustomAlert(
      "⚠️ No se guardó en nube la liquidación. " + uploadResult.errorMessage,
    );
  } else {
    console.log("Liquidación guardada en almacenamiento local");
    await showCustomAlert("✅ Liquidación guardada en almacenamiento local OK");
  }
}

function getDocumentBaseStyles() {
  return `
    body {
      font-family: "Segoe UI", Tahoma, sans-serif;
      background: white;
      margin: 20px;
      color: black;
    }

    .liquidacion-doc {
      background: white;
      padding: 30px;
      margin-top: 20px;
      color: black;
      border-radius: 10px;
    }

    .liquidacion-doc h1,
    .liquidacion-doc h3 {
      text-align: center;
      margin-bottom: 10px;
    }

    .liquidacion-doc table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }

    .liquidacion-doc th,
    .liquidacion-doc td {
      border: 1px solid black;
      padding: 6px;
      text-align: center;
    }

    .liq-doc {
      background: white;
      padding: 40px;
      color: black;
      max-width: 800px;
      margin: auto;
      font-size: 11px;
    }

    .liq-doc h1,
    .liq-doc h3 {
      text-align: center;
    }

    .liq-doc table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }

    .liq-doc td,
    .liq-doc th {
      border: 1px solid black;
      padding: 6px;
    }

    #contractPrint {
      background: white;
      padding: 40px;
      margin-top: 10px;
      color: black;
      line-height: 1;
      font-family: "Times New Roman", serif;
      font-size: 16px;
    }

    #contractPrint p {
      margin: 4px 0;
      text-align: justify;
      line-height: 1.2;
    }

    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 20px;
    }

    .sign {
      width: 45%;
      text-align: center;
    }

    .line {
      border-top: 1px solid black;
      width: 250px;
      margin: 0 auto 10px;
    }

    .sign-name,
    .sign-role,
    .sign-rut {
      width: 250px;
      text-align: center;
      margin: 2px auto;
    }

    .sign-name {
      font-weight: bold;
    }

    .sign-rut {
      font-size: 12px;
    }

    @media print {
      body {
        margin: 0;
      }
    }
  `;
}

async function createPdfBlobFromHtml(
  contentHtml,
  { extraStyles = "", scale = 2 } = {},
) {
  const exportRoot = document.createElement("div");

  exportRoot.style.position = "fixed";
  exportRoot.style.left = "-99999px";
  exportRoot.style.top = "0";
  exportRoot.style.width = "794px";
  exportRoot.style.background = "#fff";
  exportRoot.style.padding = "20px";
  exportRoot.style.zIndex = "-1";

  exportRoot.innerHTML = `
    <style>${getDocumentBaseStyles()}${extraStyles}</style>
    ${contentHtml}
  `;

  document.body.appendChild(exportRoot);

  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    const blob = await createPdfBlobFromElement(exportRoot, { scale });
    return blob;
  } finally {
    if (exportRoot.parentNode) {
      exportRoot.parentNode.removeChild(exportRoot);
    }
  }
}

async function createPdfBlobFromElement(element, { scale = 2 } = {}) {
  const { jsPDF } = window.jspdf;

  const canvas = await Promise.race([
    html2canvas(element, {
      scale,
      backgroundColor: "#ffffff",
    }),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timeout al renderizar PDF")), 25000);
    }),
  ]);

  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF("p", "mm", "a4");

  const imgWidth = 210;
  const pageHeight = 297;

  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;

  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);

  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;

    pdf.addPage();

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);

    heightLeft -= pageHeight;
  }

  return pdf.output("blob");
}

function openScreenPrintWindow({ title, contentHtml, extraStyles = "" }) {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    alert(
      "No se pudo abrir la ventana de impresión. Verifique bloqueadores de ventanas emergentes.",
    );
    return;
  }

  const baseStyles = getDocumentBaseStyles();

  printWindow.document.open();
  printWindow.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>${title}</title>
        <style>${baseStyles}${extraStyles}</style>
      </head>
      <body>
        ${contentHtml}
      </body>
    </html>
  `);
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

function printLiquidationScreen() {
  const container = document.getElementById("liquidationPrint");

  if (!container || !container.innerHTML.trim()) {
    alert("Primero genere la liquidación para imprimir.");
    return;
  }

  openScreenPrintWindow({
    title: "Liquidación de Sueldo",
    contentHtml: container.outerHTML,
  });
}


function printMandanteCobro() {
  const resultContainer = document.getElementById("mandanteResult");

  if (!resultContainer || !resultContainer.innerHTML.trim()) {
    generateMandanteCobro();
  }

  const content = resultContainer?.innerHTML?.trim();

  if (!content) {
    alert("Primero genere el cobro mandante para imprimir.");
    return;
  }

  const printHtml = `
    <div style="max-width: 900px; margin: 0 auto; font-family: Arial, sans-serif;">
      ${content}
    </div>
  `;

  openScreenPrintWindow({
    title: "Cobro Mandante",
    contentHtml: printHtml,
    extraStyles: `
      @page {
        size: letter;
        margin: 1cm;
      }
      body {
        margin: 0;
        padding: 0;
        background: white;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }
      th, td {
        border: 1px solid #ddd;
        padding: 6px 8px;
        text-align: left;
      }
      th {
        background: #f5f5f5;
      }
    `,
  });
}function printContractScreen() {
  const container = document.getElementById("contractPrint");

  if (!container || !container.innerHTML.trim()) {
    alert("No hay contrato para imprimir.");
    return;
  }

  openScreenPrintWindow({
    title: "Contrato de Trabajo de Temporada",
    contentHtml: container.outerHTML,
    extraStyles: `
      @page {
        size: letter;
        margin: 1.2cm 1.5cm;
      }
      body {
        margin: 0;
        padding: 0;
      }
      #contractPrint {
        padding: 0;
        margin: 0 auto;
        max-width: 740px;
        font-family: "Times New Roman", serif;
        font-size: 15px;
        line-height: 1.35;
      }
      #contractPrint .titulo-contrato {
        text-align: center;
        font-size: 16px;
        margin: 0 0 6px 0;
        text-align: center;
      }
      #contractPrint h3 {
        font-size: 13px;
        margin: 2px 0;
        text-align: center;
      }
      #contractPrint br {
        display: none;
      }
      .signatures {
        margin-top: 60px;
      }
      .line {
        width: 200px;
        margin: 0 auto 10px;
      }
      .sign-name,
      .sign-role,
      .sign-rut {
        width: 200px;
        font-size: 13px;
      }
    `,
  });
}

async function generateContract() {
  const workerIndex = document.getElementById("workerContract").value;

  if (workerIndex === "") {
    console.warn("Seleccione un trabajador");
    return;
    return;
  }

  const worker = workers[workerIndex];
  const faenaInput = document.getElementById("faena");
  const contractFaena = (faenaInput?.value || "").trim();

  const fundoSelect = document.getElementById("fundoSelect");
  const newFundoInput = document.getElementById("newFundo");
  const selectedFundo = (fundoSelect?.value || "").trim();
  const newFundo = (newFundoInput?.value || "").trim();
  const contractFundo = newFundo || selectedFundo;

  if (
    newFundo &&
    !fundos.some((f) => f.toLowerCase() === newFundo.toLowerCase())
  ) {
    fundos.push(newFundo);
    localStorage.setItem("fundos", JSON.stringify(fundos));
    loadFundos();
    if (fundoSelect) fundoSelect.value = newFundo;
  }

  // ðŸ”¹ COMPLETAR NOMBRE Y RUT
  document.getElementById("c_name").textContent = worker.name;
  document.getElementById("c_rut").textContent = worker.rut;
  document.getElementById("c_faena").textContent =
    contractFaena || "________________________";
  document.getElementById("c_workerSign").textContent = worker.name;

  const workScheduleInput = document.getElementById("workSchedule");
  const workScheduleValue = (workScheduleInput?.value || "").trim();
  const workScheduleElement = document.getElementById("c_workSchedule");
  if (workScheduleElement && workScheduleValue) {
    const fixedPrefix = "La jornada ordinaria de trabajo será¡ ";
    const normalized = workScheduleValue
      .toLowerCase()
      .startsWith(fixedPrefix.toLowerCase())
      ? workScheduleValue
      : fixedPrefix + workScheduleValue;
    workScheduleElement.textContent = normalized;
  }

  // ðŸ”¹ AQUÍ VA EL PASO 2 ðŸ‘‡

  const startDate = document.getElementById("startDate").value.trim();

  if (!startDate) {
    alert("Ingrese la fecha del contrato.");
    return;
  }

  const [day, monthNumber, year] = startDate.split("/");

  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  const month = months[parseInt(monthNumber) - 1];

  document.getElementById("c_day").textContent = day || "__";
  document.getElementById("c_month").textContent = month || "__________";
  document.getElementById("c_year").textContent = year || "____";
  document.getElementById("c_startDate").textContent =
    startDate || "___/___/20__";
  document.getElementById("c_nationality").textContent =
    worker.nationality || "Chilena";
  document.getElementById("c_maritalStatus").textContent =
    worker.maritalStatus || "______________________";
  document.getElementById("c_address").textContent =
    worker.address || "_________________________";
  document.getElementById("c_afp").textContent = worker.afp || "______________";
  document.getElementById("c_health").textContent = worker.health || "____________";

  const salaryInput = document.getElementById("salary").value.trim();

  const formattedSalary = formatCLPCurrency(salaryInput);

  document.getElementById("c_salary").textContent =
    formattedSalary || "____________";

  document.getElementById("c_birthDate").textContent =
    worker.birthDate || "____ / ____ / ____";

  await showCustomAlert("Contrato completado correctamente.");

  const contractContainer = document.getElementById("contractPrint");
  const pdfBlob = await createPdfBlobFromHtml(contractContainer.outerHTML, {
    extraStyles: `
      #contractPrint {
        padding: 0;
        margin: 0 auto;
        max-width: 740px;
        font-family: "Times New Roman", serif;
        font-size: 15px;
        line-height: 1.35;
      }

      #contractPrint .titulo-contrato {
        text-align: center;
        font-size: 16px;
        margin: 0 0 6px 0;
        text-align: center;
      }

      #contractPrint p,
      #contractPrint .clausula {
        margin: 2px 0;
        text-align: justify;
        line-height: 1.35;
      }

      #contractPrint h3 {
        margin: 3px 0;
        font-size: 14px;
        text-align: center;
      }

      #contractPrint br {
        display: none;
      }

      #contractPrint .signatures {
        margin-top: 104px;
      }
    `,
    scale: 2,
  });

  if (!pdfBlob) {
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = "contrato_" + worker.rut + "_" + stamp + ".pdf";

  const filePath = worker.rut + "/" + fileName;

  const uploadResult = await uploadFileToWorkerStorage(
    filePath,
    pdfBlob,
    "application/pdf",
  );

  if (!uploadResult.ok) {
    console.error("Error subiendo contrato:", uploadResult.error);
    alert(
      "⚠️ No se guardó en nube el contrato. " + uploadResult.errorMessage,
    );
  } else {
    console.log("Contrato guardado en almacenamiento local");
    showCustomAlert("✅ Contrato guardado en almacenamiento local OK");
  }
}
function calcularTotalPagadoFiniquito(worker, inicio, fin) {
  if (!worker || !inicio || !fin) return 0;

  const inicioValido = DateHelper.isISO(inicio) || DateHelper.isCLAny(inicio);
  const finValido = DateHelper.isISO(fin) || DateHelper.isCLAny(fin);

  if (!inicioValido || !finValido) return 0;

  let total = 0;
  for (const record of history) {
    if (!record || record.rut !== worker.rut || record.paid !== true) continue;
    if (!DateHelper.isBetween(record.date, inicio, fin)) continue;

    const value = Number(record.total);
    if (!Number.isFinite(value)) continue;

    total += value;
  }

  return total;
}

function normalizeWorkerForDocs(worker) {
  const safe = worker && typeof worker === "object" ? worker : {};

  const safeName = String(safe.name || "")
    .trim()
    .slice(0, 120);
  const safeRut = String(safe.rut || "")
    .trim()
    .slice(0, 25);
  const safePosition = String(safe.position || "-")
    .trim()
    .slice(0, 80);

  return {
    name: safeName,
    rut: safeRut,
    position: safePosition || "-",
  };
}

function refreshFiniquitoResumen() {
  const totalElement = document.getElementById("f_totalLiquido");
  if (!totalElement) return;

  const workerIndex = document.getElementById("workerFiniquito")?.value;
  const inicio = (
    document.getElementById("f_startDate")?.textContent || ""
  ).trim();
  const fin = (document.getElementById("f_endDate")?.value || "").trim();

  const finCompleto = DateHelper.isISO(fin) || DateHelper.isCLAny(fin);

  if (
    workerIndex === "" ||
    !inicio ||
    !fin ||
    inicio.includes("_") ||
    !finCompleto
  ) {
    totalElement.textContent = "$ _______________________";
    return;
  }

  const worker = workers[workerIndex];
  const sueldoMinimo = Number(localStorage.getItem("minimumWage") || 0);
  const totalCalculado = calcularTotalPagadoFiniquito(worker, inicio, fin);
  const totalPagado =
    sueldoMinimo > 0
      ? Math.min(totalCalculado, sueldoMinimo)
      : totalCalculado;
  totalElement.textContent = `$ ${totalPagado.toLocaleString("es-CL")}`;
}

async function generateFiniquito() {
  if (isGeneratingFiniquito) {
    alert("Ya se está generando un finiquito. Espere un momento.");
    return;
  }

  const workerIndex = document.getElementById("workerFiniquito").value;

  if (workerIndex === "") {
    console.warn("Seleccione un trabajador");
    return;
    return;
  }

  const rawWorker = workers[workerIndex];
  if (!rawWorker || typeof rawWorker !== "object") {
    alert("El trabajador seleccionado no es válido. Vuelva a seleccionarlo.");
    return;
  }

  const worker = normalizeWorkerForDocs(rawWorker);
  if (!worker.name || !worker.rut) {
    alert(
      "El trabajador tiene datos incompletos (Nombre/RUT). Corrija el registro antes de generar el finiquito.",
    );
    return;
  }

  isGeneratingFiniquito = true;

  try {
    const endDate = (document.getElementById("f_endDate")?.value || "").trim();

    syncFiniquitoEndDate(endDate);

    const inicio = (
      document.getElementById("f_startDate")?.textContent || ""
    ).trim();
    const fin = (document.getElementById("f_endDate")?.value || "").trim();
    const sueldoMinimo = Number(localStorage.getItem("minimumWage") || 0);
    const totalCalculado = calcularTotalPagadoFiniquito(rawWorker, inicio, fin);
    const totalPagado =
      sueldoMinimo > 0
        ? Math.min(totalCalculado, sueldoMinimo)
        : totalCalculado;

    const today = new Date().toLocaleDateString("es-CL");

    const html = `
  <div id="finiquitoDoc">

  <h1 style="text-align:center;">FINIQUITO DE TRABAJO</h1>

  <p>En conformidad a lo dispuesto en la legislación laboral vigente, se deja constancia que:</p>

  <p><strong>Trabajador:</strong> ${worker.name}</p>
  <p><strong>RUT:</strong> ${worker.rut}</p>
  <p><strong>Cargo:</strong> ${worker.position || "-"}</p>
  <p><strong>Servicios prestados desde:</strong> ${inicio || "__________"} <strong>hasta:</strong> ${fin || "__________"}</p>
  <p><strong>Fecha de terminación:</strong> ${endDate || "__________"}</p>

  <br>

  <p>Declara haber recibido de su empleador todas las remuneraciones, pagos y beneficios que le correspondían por su trabajo realizado.</p>

  <h3 style="text-align:center; margin-top:18px;">TOTAL LÍQUIDO A PAGAR SEGÚN DETALLE LIQUIDACIÓN</h3>
  <h2 style="text-align:center;">$ ${totalPagado.toLocaleString("es-CL")}</h2>

  <br><br>

  <p>Firmado en conformidad.</p>

  <br><br>

  <p>Fecha: ${today}</p>

  <br><br><br>

  <div style="display:flex; justify-content:space-between;">

  <div style="text-align:center;">
  <div style="border-top:1px solid black; width:200px;"></div>
  <p>Firma Trabajador</p>
  <p>${worker.name}</p>
  <p>${worker.rut}</p>
  </div>

  <div style="text-align:center;">
  <div style="border-top:1px solid black; width:200px;"></div>
  <p>Firma Empleador</p>
  </div>

  </div>

  </div>
  `;

    const pdfBlob = await createPdfBlobFromHtml(html, {
      scale: 2,
    });

    if (!pdfBlob) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");

    const fileName = "finiquito_" + worker.rut + "_" + stamp + ".pdf";

    const filePath = worker.rut + "/" + fileName;

    const uploadResult = await uploadFileToWorkerStorage(
      filePath,
      pdfBlob,
      "application/pdf",
    );

    if (!uploadResult.ok) {
      console.error("Error subiendo finiquito:", uploadResult.error);
      alert(
        "⚠️ No se guardó en nube el finiquito. " + uploadResult.errorMessage,
      );
    } else {
      console.log("Finiquito guardado en almacenamiento local");
      showCustomAlert("✅ Finiquito guardado en almacenamiento local OK");
    }
  } catch (error) {
    console.error("Error generando finiquito:", error);
    alert("⚠️ Ocurrió un error al generar el finiquito. Intente nuevamente.");
  } finally {
    isGeneratingFiniquito = false;
  }
}

function syncFiniquitoEndDate(value) {
  const endDatePrint = document.getElementById("f_endDatePrint");
  if (!endDatePrint) return;

  const normalizedValue = (value || "").trim();
  endDatePrint.textContent = normalizedValue || "__________";

  // Rellenar encabezado "En San Clemente, a __ de ___ de ____"
  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const parts = normalizedValue.split("/");
  const dayEl = document.getElementById("f_headerDay");
  const monthEl = document.getElementById("f_headerMonth");
  const yearEl = document.getElementById("f_headerYear");
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    const day = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const year = parts[2];
    if (dayEl) dayEl.textContent = day || "____";
    if (monthEl)
      monthEl.textContent = months[monthIndex] || "__________________";
    if (yearEl) yearEl.textContent = year || "20____";
  } else {
    if (dayEl) dayEl.textContent = "____";
    if (monthEl) monthEl.textContent = "__________________";
    if (yearEl) yearEl.textContent = "20____";
  }

  refreshFiniquitoResumen();
}

function generateMonthlySummary() {
  const searchInput = document.getElementById("searchWorkerMonthly");
  const hiddenSelect = document.getElementById("workerMonthly");
  const workerIndex = document.getElementById("workerMonthly").value;

  const month = document.getElementById("monthMonthly").value;

  console.log("[MonthlySummary] before validation", {
    searchInputValue: (searchInput?.value || "").trim(),
    hiddenSelectValue: (hiddenSelect?.value || "").trim(),
    monthValue: (month || "").trim(),
  });

  if (workerIndex === "" || !month) {
    showCustomAlert("Seleccione trabajador y mes.");
    return;
  }

  const worker = workers[workerIndex];

  const recordsRaw = history.filter(
    (r) => r.rut === worker.rut && isHistoryRecordInMonth(r.date, month),
  );

  const records = dedupeHistoryRecords(recordsRaw);

  const container = document.getElementById("monthlyResult");

  if (records.length === 0) {
    container.innerHTML = "<p>No hay producción ese mes.</p>";
    return;
  }

  // ===== CALCULAR DÍAS TRABAJADOS =====
  const uniqueDates = [
    ...new Set(records.map((r) => getHistoryDateKey(r.date))),
  ];
  const daysWorked = uniqueDates.length;

  let total = 0;

  let html = "<h3>Detalle del Mes</h3>";
  html += "<table>";
  html +=
    "<tr><th>Fecha</th><th>Labor</th><th>Cantidad</th><th>Total</th></tr>";

  records.forEach((r) => {
    total += r.total;

    html += "<tr>";
    html += "<td>" + r.date + "</td>";
    html += "<td>" + r.labor + "</td>";
    html += "<td>" + r.quantity + "</td>";
    html += "<td>$" + Number(r.total).toLocaleString("es-CL") + "</td>";
    html += "</tr>";
  });

  html += "</table>";

  html += "<p><strong>Días trabajados:</strong> " + daysWorked + "</p>";
  html += "<h2>Total del Mes: $" + total.toLocaleString("es-CL") + "</h2>";

  container.innerHTML = html;
}

function generateMonthlyGeneral() {
  const month = document.getElementById("monthGeneral").value;

  if (!month) {
    alert("Seleccione un mes.");
    return;
  }

  const recordsRaw = history.filter((r) =>
    isHistoryRecordInMonth(r.date, month),
  );
  const records = dedupeHistoryRecords(recordsRaw);

  const container = document.getElementById("monthlyGeneralResult");

  if (records.length === 0) {
    container.innerHTML = "<p>No hay producción ese mes.</p>";
    return;
  }

  // Agrupar por RUT
  const summary = {};

  // ===== RESUMEN GENERAL POR LABOR DEL MES =====
  const laborSummary = {};

  records.forEach((r) => {
    const laborName = getCanonicalLaborName(r.labor);
    const laborKey = getLaborKey(laborName);

    if (!summary[r.rut]) {
      summary[r.rut] = {
        name: r.name,
        total: 0,
        dates: new Set(),
        labors: {},
      };
    }
    if (!laborSummary[laborKey]) {
      laborSummary[laborKey] = {
        labor: laborName,
        cantidad: 0,
        total: 0,
      };
    }
    laborSummary[laborKey].cantidad += r.quantity;
    laborSummary[laborKey].total += r.total;

    summary[r.rut].total += r.total;
    summary[r.rut].dates.add(getHistoryDateKey(r.date));
    if (!summary[r.rut].labors[laborKey]) {
      summary[r.rut].labors[laborKey] = {
        labor: laborName,
        cantidad: 0,
      };
    }
    summary[r.rut].labors[laborKey].cantidad += r.quantity;
  });

  let html = "<h3>Resumen General del Mes</h3>";

  // ===== MOSTRAR RESUMEN GENERAL POR LABOR =====
  html += "<h4>Labores realizadas en el mes</h4>";
  html += "<div class='table-container'><table>";
  html += "<tr><th>Labor</th><th>Cantidad</th><th>Total</th></tr>";

  Object.values(laborSummary).forEach((data) => {
    html += "<tr>";
    html += "<td>" + data.labor + "</td>";
    html += "<td>" + data.cantidad + "</td>";
    html += "<td>$" + data.total.toLocaleString("es-CL") + "</td>";
    html += "</tr>";
  });

  html += "</table></div>";

  html += "<table>";
  html += "<tr><th>Trabajador</th><th>Días</th><th>Total</th></tr>";

  let totalGeneral = 0;

  Object.values(summary).forEach((worker) => {
    const daysWorked = worker.dates.size;

    totalGeneral += worker.total;

    let laborDetalle = "";

    Object.values(worker.labors).forEach((laborData) => {
      laborDetalle += laborData.labor + ": " + laborData.cantidad + "<br>";
    });

    html += "<tr>";
    html +=
      "<td>" + worker.name + "<br><small>" + laborDetalle + "</small></td>";
    html += "<td>" + daysWorked + "</td>";
    html += "<td>$" + worker.total.toLocaleString("es-CL") + "</td>";
    html += "</tr>";
  });

  html += "</table>";

  html +=
    "<h2>Total General del Mes: $" +
    totalGeneral.toLocaleString("es-CL") +
    "</h2>";

  container.innerHTML = html;
}
// =============================
// ðŸ” SESIÃ“N
// =============================

function focusFirstFieldInView() {
  const activeView = document.querySelector(".view:not(.hidden)");
  if (!activeView) {
    // ...existing code...
  }

  const firstField = activeView.querySelector(
    'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])',
  );

  if (firstField && typeof firstField.focus === "function") {
    firstField.focus();
  }
}

function closeFloatingUi() {
  // Si hay un modal personalizado abierto, no robar foco ni forzar scroll.
  if (document.querySelector(".custom-modal-overlay")) {
    return;
  }

  // Cierra listas de bÃºsqueda flotantes que pueden quedar sobre inputs.
  document
    .querySelectorAll(".worker-search-list, .mandante-worker-list")
    .forEach((list) => {
      list.style.display = "none";
    });

  // Si un modal quedÃ³ abierto por error, lo removemos para recuperar interacciÃ³n.
  const productionModal = document.getElementById("productionConfirmModal");
  if (productionModal) {
    productionModal.remove();
  }
}

function showView(id) {
  closeFloatingUi();

  document.querySelectorAll(".view").forEach(function (v) {
    v.classList.add("hidden");
  });

  document.getElementById(id).classList.remove("hidden");

  if (id === "viewContract" || id === "viewWeekly") {
    loadWorkers();
  }

  if (id === "viewCobrosMandante") {
    loadMandanteFundoFilter();
    showCalendarMandante();
  }

  focusFirstFieldInView(id);
}

window.addEventListener("resize", closeFloatingUi);
window.addEventListener("focus", closeFloatingUi);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    closeFloatingUi();
  }
});

document.addEventListener("pointerdown", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  // No intervenir clicks sobre botones para no romper acciones crÃ­ticas
  // (ej: inactivar trabajador) ni provocar scroll al inicio.
  if (target.closest("button")) return;

  const clickedInsideFloatingUi = target.closest(
    ".worker-search, .mandante-search, #productionConfirmModal, .custom-modal-overlay, .custom-modal-box",
  );

  if (!clickedInsideFloatingUi) {
    closeFloatingUi();
  }
});

// =============================
// ðŸ“‚ TOGGLE SUBMENU
// =============================
function toggleSubmenu(id) {
  const submenu = document.getElementById(id);
  const currentDisplay = window.getComputedStyle(submenu).display;

  if (currentDisplay === "none") {
    submenu.style.display = "block";
  } else {
    submenu.style.display = "none";
  }
}

// =============================
// ðŸ’¾ EXPORTAR RESPALDO
// =============================
function importData(event) {
  const file = event.target.files[0];

  if (!file) {
    alert("Seleccione un archivo de respaldo.");
    return;
  }

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);

      workers = data.workers || [];
      history = data.history || [];
      labors = data.labors || [];

      localStorage.setItem("workers", JSON.stringify(workers));
      localStorage.setItem("history", JSON.stringify(history));

      localStorage.setItem("labors", JSON.stringify(labors));

      loadWorkers();
      renderWorkersTable();
      renderHistory();
      loadLabors();

      alert("Respaldo importado correctamente.");
    } catch (error) {
      alert("Error al importar el respaldo.");

      console.error(error);
    }
  };

  reader.readAsText(file);
}
// =============================
// ðŸ—‘ï¸ ELIMINAR TRABAJADOR
// =============================

async function deleteWorker() {
  const selectedIndexValue = document.getElementById("workerEditSelect").value;
  console.log("editIndexWorker:", editIndexWorker);
  console.log("workerEditSelect.value:", selectedIndexValue);

  const index =
    selectedIndexValue !== ""
      ? Number(selectedIndexValue)
      : editIndexWorker !== null
        ? Number(editIndexWorker)
        : -1;

  if (!Number.isInteger(index) || index < 0 || !workers[index]) {
    await showCustomAlert("Seleccione un trabajador para eliminar.");
    return;
  }

  if (selectedIndexValue === "") {
    document.getElementById("workerEditSelect").value = String(index);
  }

  const workerIndex = index;
  const worker = workers[workerIndex];

  const ok = await showCustomConfirm(
    `¿Está seguro de eliminar a ${worker.name}? Esta acción borrará el trabajador de forma permanente.`,
  );

  if (!ok) return;

  if (storageClient) {
    let error = null;
    if (worker?.id) {
      const result = await storageClient.from("workers").delete().eq("id", worker.id);
      error = result?.error || null;
    } else {
      const result = await storageClient.from("workers").delete().eq("rut", worker.rut);
      error = result?.error || null;
    }

    if (error) {
      console.error("Error eliminando trabajador en almacenamiento local:", error.message);
      await showCustomAlert("Error al eliminar en la base de datos local.");
      return;
    }
  }

  workers.splice(workerIndex, 1);
  saveLocalDataDebounced();

  loadWorkers();
  renderWorkersTable();
  clearWorkerForm();

  await showCustomAlert(`Trabajador ${worker.name} eliminado correctamente.`);
}

async function deactivateWorker() {
  const selectedIndexValue = document.getElementById("workerEditSelect").value;
  console.log("editIndexWorker:", editIndexWorker);
  console.log("workerEditSelect.value:", selectedIndexValue);

  const index =
    selectedIndexValue !== ""
      ? Number(selectedIndexValue)
      : editIndexWorker !== null
        ? Number(editIndexWorker)
        : -1;

  if (!Number.isInteger(index) || index < 0 || !workers[index]) {
    await showCustomAlert("Seleccione un trabajador para desactivar.");
    return;
  }

  if (selectedIndexValue === "") {
    document.getElementById("workerEditSelect").value = String(index);
  }

  const workerIndex = index;
  const worker = workers[workerIndex];

  if (worker.active === false) {
    await showCustomAlert(`Trabajador ${worker.name} ya está desactivado.`);
    return;
  }

  const ok = await showCustomConfirm(
    `¿Está seguro de desactivar a ${worker.name}? El trabajador no aparecerá en listas activas.`,
  );

  if (!ok) return;

  if (storageClient) {
    let error = null;
    if (worker?.id) {
      const result = await storageClient
        .from("workers")
        .update({ active: false })
        .eq("id", worker.id);
      error = result?.error || null;
    } else {
      const result = await storageClient
        .from("workers")
        .update({ active: false })
        .eq("rut", worker.rut);
      error = result?.error || null;
    }

    if (error) {
      console.error("Error desactivando trabajador en almacenamiento local:", error.message);
      await showCustomAlert("Error al desactivar en la base de datos local.");
      return;
    }
  }

  workers[workerIndex].active = false;
  saveLocalDataDebounced();

  loadWorkers();
  renderWorkersTable();
  clearWorkerForm();

  await showCustomAlert(`Trabajador ${worker.name} desactivado correctamente.`);
}

// =============================
// 📂 CARPETA DEL TRABAJADOR
// =============================

function openWorkerFolder(rut) {
  const worker = workers.find(w => w.rut === rut);
  
  if (!worker) {
    alert('Trabajador no encontrado.');
    return;
  }
  
  // Actualizar datos en la vista
  document.getElementById('folderWorkerName').textContent = worker.name || '-';
  document.getElementById('folderWorkerRut').textContent = worker.rut || '-';
  
  // Limpiar lista anterior
  const docContainer = document.getElementById('workerDocuments');
  if (docContainer) {
    docContainer.innerHTML = '<p>No hay documentos aún.</p>';
  }
  
  // Mostrar la vista
  showView('viewWorkerFolder');
}

async function uploadWorkerDocument() {
  const fileInput = document.getElementById('workerFileUpload');
  const rutElement = document.getElementById('folderWorkerRut');
  
  if (!fileInput || !fileInput.files.length) {
    alert('Seleccione un archivo para subir.');
    return;
  }
  
  if (!rutElement || !rutElement.textContent.trim()) {
    alert('RUT del trabajador no disponible.');
    return;
  }
  
  const file = fileInput.files[0];
  const rut = rutElement.textContent.trim();
  const fileName = Date.now() + '_' + file.name;
  const filePath = rut + '/documentos/' + fileName;
  
  try {
    const uploadResult = await uploadFileToWorkerStorage(filePath, file);
    
    if (uploadResult.ok) {
      alert('Documento cargado correctamente.');
      fileInput.value = '';
      
      // Actualizar lista de documentos
      const docContainer = document.getElementById('workerDocuments');
      if (docContainer) {
        let html = '<ul style="list-style: none; padding: 0;">';
        html += `<li style="padding: 8px; border-bottom: 1px solid #eee;">
          <strong>${file.name}</strong><br>
          <small style="color: #666;">Subido: ${new Date().toLocaleString('es-CL')}</small>
        </li>`;
        html += '</ul>';
        
        const currentContent = docContainer.innerHTML;
        if (currentContent.includes('No hay documentos')) {
          docContainer.innerHTML = html;
        } else {
          docContainer.innerHTML = html + currentContent;
        }
      }
    } else {
      alert('Error al subir el documento: ' + (uploadResult.errorMessage || 'Error desconocido'));
    }
  } catch (error) {
    console.error('Error subiendo documento:', error);
    alert('Ocurrió un error al subir el documento.');
  }
}

function exportData() {
  const data = {
    workers,
    history,
    labors,
  };

  const json = JSON.stringify(data, null, 2);

  const blob = new Blob([json], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  const fecha = new Date().toISOString().split("T")[0];

  a.download = "respaldo_sistema_" + fecha + ".json";
  a.click();

  URL.revokeObjectURL(url);
}

function printMonthlyGeneral() {
  const container = document.getElementById("monthlyGeneralResult");

  if (!container || container.innerHTML.trim() === "") {
    alert("Primero debe calcular el mes.");
    return;
  }

  window.print();
}
function exportMonthlyGeneralExcel() {
  const container = document.getElementById("monthlyGeneralResult");

  if (!container || container.innerHTML.trim() === "") {
    alert("Primero debe calcular el mes.");
    return;
  }

  const month = document.getElementById("monthGeneral").value;

  const recordsRaw = history.filter((r) =>
    isHistoryRecordInMonth(r.date, month),
  );
  const records = dedupeHistoryRecords(recordsRaw);

  // ================================
  // RESUMEN POR TIPO DE LABOR
  // ================================

  const laborSummary = {};

  records.forEach((r) => {
    const laborName = getCanonicalLaborName(r.labor);
    const laborKey = getLaborKey(laborName);

    if (!laborSummary[laborKey]) {
      laborSummary[laborKey] = {
        labor: laborName,
        cantidad: 0,
        total: 0,
      };
    }

    laborSummary[laborKey].cantidad += r.quantity;
    laborSummary[laborKey].total += r.total;
  });

  if (records.length === 0) {
    alert("No hay datos para exportar.");
    return;
  }

  // Agrupar por trabajador
  const summary = {};

  records.forEach((r) => {
    if (!summary[r.rut]) {
      summary[r.rut] = {
        name: r.name,
        total: 0,
        dates: new Set(),
      };
    }

    summary[r.rut].total += r.total;
    summary[r.rut].dates.add(r.date);
  });

  // ===== CONSTRUIR CSV PROFESIONAL =====

  let csv = "";

  const fechaGeneracion = new Date().toLocaleDateString("es-CL");
  const responsable = "Contratista"; // puedes cambiarlo luego

  // ENCABEZADO EMPRESA
  csv += "SERVICIOS AGRÃCOLAS SAN GERÃ“NIMO SPA\n";
  csv += "RESUMEN MENSUAL GENERAL\n";
  csv += "Mes: " + month + "\n";
  csv += "Fecha de generaciÃ³n: " + fechaGeneracion + "\n";
  csv += "Responsable: " + responsable + "\n\n";

  // ================================
  // TABLA RESUMEN POR TRABAJADOR
  // ================================

  csv += "=== RESUMEN POR TRABAJADOR ===\n";
  csv += "Trabajador;Dias Trabajados;Total\n";

  let totalGeneral = 0;

  Object.values(summary).forEach((worker) => {
    const daysWorked = worker.dates.size;
    totalGeneral += worker.total;

    csv += worker.name + ";" + daysWorked + ";" + worker.total + "\n";
  });

  csv += "\nTotal General del Mes;;" + totalGeneral + "\n\n";

  // ================================
  // RESUMEN POR TIPO DE LABOR
  // ================================

  csv += "=== RESUMEN POR TIPO DE LABOR ===\n";
  csv += "Labor;Cantidad Total;Total $\n";

  Object.values(laborSummary).forEach((data) => {
    csv += data.labor + ";" + data.cantidad + ";" + data.total + "\n";
  });

  // LÃ­nea total general
  csv += "\nTotal General del Mes;;" + totalGeneral + "\n";

  // Crear archivo
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "Resumen_Mensual_General.csv";
  a.click();

  URL.revokeObjectURL(url);
}

// =============================
// ï¿½ COBROS MANDANTES - CALENDARIO
// =============================
var currentCalendarDateMandante = new Date();
var selectedDaysMandante = new Set();

function showCalendarMandante(year = null, month = null) {
  if (year === null || month === null) {
    year = currentCalendarDateMandante.getFullYear();
    month = currentCalendarDateMandante.getMonth();
  } else {
    currentCalendarDateMandante = new Date(year, month);
  }

  const monthNum = month;
  const daysInMonth = new Date(year, monthNum + 1, 0).getDate();
  const firstDay = new Date(year, monthNum, 1).getDay();

  const monthNames = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const dayNames = ["do", "lu", "ma", "mi", "ju", "vi", "sÃ¡"];

  let html =
    "<div style='width: 350px; border: 1px solid #ccc; border-radius: 8px; padding: 15px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);'>";

  html +=
    "<div style='display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;'>";
  html +=
    "<button type='button' class='btn-month-mandante' data-dir='-1' style='border: none; background: none; cursor: pointer; font-size: 20px; padding: 5px 10px; color: #333;'>â—€</button>";
  html +=
    "<span style='font-weight: bold; text-transform: capitalize;'>" +
    monthNames[monthNum] +
    " de " +
    year +
    "</span>";
  html +=
    "<button type='button' class='btn-month-mandante' data-dir='1' style='border: none; background: none; cursor: pointer; font-size: 20px; padding: 5px 10px; color: #333;'>â–¶</button>";
  html += "</div>";

  html +=
    "<div style='display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;'>";

  dayNames.forEach((day) => {
    html +=
      "<div style='text-align: center; font-weight: bold; padding: 8px; font-size: 12px; color: #666;'>" +
      day +
      "</div>";
  });

  for (let i = 0; i < firstDay; i++) {
    html += "<div style='padding: 8px;'></div>";
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const monthStr = String(monthNum + 1).padStart(2, "0");
    const dateStr = year + "-" + monthStr + "-" + String(day).padStart(2, "0");
    const isSelected = selectedDaysMandante.has(dateStr);
    const hasRecords = history.some((r) => r.date === dateStr);

    let bgColor = "transparent";
    let textColor = "#000";
    let fontWeight = "normal";

    if (isSelected) {
      bgColor = "#1a73e8";
      textColor = "white";
      fontWeight = "bold";
    } else if (hasRecords) {
      bgColor = "#e8f4fd";
      textColor = "#1a73e8";
    }

    html +=
      "<div class='calendar-day-mandante' data-date='" +
      dateStr +
      "' style='text-align:center; padding:8px; border-radius:50%; background:" +
      bgColor +
      "; color:" +
      textColor +
      "; font-weight:" +
      fontWeight +
      "; cursor:pointer; transition:all 0.2s;'>";
    html += day;
    html += "</div>";
  }

  html += "</div>";

  html +=
    "<div style='display: flex; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;'>";
  html +=
    "<button type='button' class='btn-clear-mandante' style='border: none; background: none; color: #1a73e8; cursor: pointer; font-weight: 500;'>Borrar</button>";
  html +=
    "<button type='button' class='btn-today-mandante' style='border: none; background: none; color: #1a73e8; cursor: pointer; font-weight: 500;'>Hoy</button>";
  html += "</div>";

  html += "</div>";

  document.getElementById("calendarMandante").innerHTML = html;

  // Asignar eventos CSP-compliant
  document.querySelectorAll(".btn-month-mandante").forEach((btn) => {
    btn.addEventListener("click", function () {
      changeMonthMandante(Number(this.getAttribute("data-dir")));
    });
  });
  document.querySelectorAll(".calendar-day-mandante").forEach((day) => {
    day.addEventListener("click", function () {
      toggleDayMandante(this.getAttribute("data-date"));
    });
  });
  const clearBtn = document.querySelector(".btn-clear-mandante");
  if (clearBtn) clearBtn.addEventListener("click", clearSelectedDaysMandante);
  const todayBtn = document.querySelector(".btn-today-mandante");
  if (todayBtn) todayBtn.addEventListener("click", todayDateMandante);
}

function toggleDayMandante(dateStr) {
  if (selectedDaysMandante.has(dateStr)) {
    selectedDaysMandante.delete(dateStr);
  } else {
    selectedDaysMandante.add(dateStr);
  }
  showCalendarMandante(
    currentCalendarDateMandante.getFullYear(),
    currentCalendarDateMandante.getMonth(),
  );
}

function changeMonthMandante(direction) {
  const year = currentCalendarDateMandante.getFullYear();
  const month = currentCalendarDateMandante.getMonth();

  const newDate = new Date(year, month + direction);
  showCalendarMandante(newDate.getFullYear(), newDate.getMonth());
}

function clearSelectedDaysMandante() {
  selectedDaysMandante.clear();
  document.getElementById("mandanteResult").innerHTML = "";
  showCalendarMandante(
    currentCalendarDateMandante.getFullYear(),
    currentCalendarDateMandante.getMonth(),
  );
}

function todayDateMandante() {
  currentCalendarDateMandante = new Date();
  showCalendarMandante();
}

function generateMandanteCobro() {
  const resultContainer = document.getElementById("mandanteResult");
  const fundoFilter = document.getElementById("mandanteFundoFilter");
  if (resultContainer) {
    resultContainer.innerHTML = "";
  }

  const selectedDates = Array.from(selectedDaysMandante);
  selectedDates.sort();

  if (selectedDates.length === 0) {
    alert("Seleccione al menos un día del calendario.");
    return;
  }

  const selectedFundo = fundoFilter ? fundoFilter.value : "";

  const records = history.filter((r) => {
    if (!selectedDates.includes(r.date)) {
      return false;
    }

    if (!selectedFundo) {
      return true;
    }

    return (getFundoKey(r.fundo) || "sin-fundo") === selectedFundo;
  });

  if (records.length === 0) {
    if (resultContainer) {
      resultContainer.innerHTML =
        "<p style='color:#666;'>No hay registros para las fechas seleccionadas.</p>";
    }
    showCustomAlert("No hay registros en los días seleccionados.");
    return;
    return;
  }

  const resumen = {};
  records.forEach((r) => {
    const fundoKey = getFundoKey(r.fundo) || "sin-fundo";
    const key = fundoKey + "|" + getLaborKey(r.labor);
    if (!resumen[key]) {
      resumen[key] = {
        fundo: getFundoDisplay(r.fundo, "-"),
        labor: r.labor,
        cantidad: 0,
        total: 0,
      };
    }
    resumen[key].cantidad += Number(r.quantity);
    resumen[key].total += Number(r.total);
  });

  let totalGeneral = 0;
  Object.values(resumen).forEach((r) => (totalGeneral += r.total));

  let html = "<h3>Cobro Mandante</h3>";
  html +=
    "<p><strong>Período:</strong> " +
    selectedDates[0] +
    " al " +
    selectedDates[selectedDates.length - 1] +
    "</p>";
  if (selectedFundo && fundoFilter) {
    const selectedOption = fundoFilter.options[fundoFilter.selectedIndex];
    html += "<p><strong>Fundo:</strong> " + selectedOption.text + "</p>";
  }

  html += "<table>";
  html +=
    "<tr><th>Fundo</th><th>Labor</th><th>Cantidad</th><th>Total</th></tr>";
  Object.values(resumen).forEach((r) => {
    html += "<tr>";
    html += "<td>" + r.fundo + "</td>";
    html += "<td>" + r.labor + "</td>";
    html += "<td>" + r.cantidad + "</td>";
    html += "<td>$" + r.total.toLocaleString("es-CL") + "</td>";
    html += "</tr>";
  });
  html += "</table>";

  html +=
    "<h2 style='margin-top:15px'>TOTAL: $" +
    totalGeneral.toLocaleString("es-CL") +
    "</h2>";

  if (resultContainer) {
    resultContainer.innerHTML = html;
  }
}

// =============================
// ðŸªª FORMATO RUT
// =============================

function formatRutInput(input) {
  let value = input.value.replace(/[^0-9kK]/g, "").toUpperCase();

  if (value.length <= 1) {
    input.value = value;
    return;
  }

  let body = value.slice(0, -1);
  let dv = value.slice(-1);

  body = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  input.value = body + "-" + dv;
}

// =============================
// ðŸ” LOGIN
// =============================

async function loginUser() {
  const pass = document.getElementById("password").value;

  if (pass === LOGIN_PASSWORD) {
    localStorage.setItem("sessionActive", "true");

    document.getElementById("login").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");

    const syncIndicator = document.getElementById("syncIndicator");
    if (syncIndicator) {
      syncIndicator.style.display = "none";
      syncIndicator.style.visibility = "hidden";
      syncIndicator.style.pointerEvents = "none";
      syncIndicator.remove();
    }

    // Ejecutar la sincronizaciÃ³n en segundo plano, no bloquear la UI
    setTimeout(() => {
      initSystem();
    }, 0);
  } else {
    alert("Contraseña incorrecta");
  }
}

function logout() {
  localStorage.removeItem("sessionActive");
  location.reload();
}

// =============================
// TRABAJADORES
// =============================

async function addWorker() {
  console.log("editIndexWorker:", editIndexWorker);

  // Leer directamente por ID real del formulario
  const workerName = (document.getElementById("workerName")?.value || "").trim();
  const workerRut = (document.getElementById("workerRut")?.value || "").trim();
  const account = document.getElementById("workerAccount")?.value || "";
  const birthDate = document.getElementById("workerBirthDate")?.value.trim() || "";
  const maritalStatus = document.getElementById("workerMaritalStatus")?.value.trim() || "";
  const address = document.getElementById("workerAddress")?.value.trim() || "";
  const afp = document.getElementById("workerAFP")?.value.trim() || "";
  const health = document.getElementById("workerHealth")?.value.trim() || "";
  const position = document.getElementById("workerPosition")?.value.trim() || "";
  const nationality = document.getElementById("workerNationality")?.value.trim() || "";
  const baseSalary = (document.getElementById("workerBaseSalary")?.value || "")
    .replace(/\$/g, "")
    .replace(/\./g, "");

  let photoUrl = null;
  console.log("NAME:", workerName);
  console.log("RUT:", workerRut);

  if (!workerName || !workerRut) {
    alert("Falta completar campos obligatorios (Nombre y RUT).");
    return;
  }
  // ðŸ”¹ VALIDAR RUT DUPLICADO (normalizado)
  const workerRutKey = getRutKey(workerRut);
  const currentEditIndex =
    editIndexWorker !== null ? Number(editIndexWorker) : -1;
  const rutIndex = workers.findIndex((w, index) => {
    if (index === currentEditIndex) return false;
    return getRutKey(w?.rut) === workerRutKey;
  });

  if (workerRutKey && rutIndex !== -1) {
    await showCustomAlert("Ya existe un trabajador registrado con ese RUT.");
    return;
  }

  // ðŸ”¹ Subir imagen si existe
  const fileInput = document.getElementById("workerIdPhoto");
  if (USE_STORAGE && fileInput && fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const fileName = Date.now() + "_" + file.name;
    const filePath = workerRut + "/" + fileName;

    const uploadResult = await uploadFileToWorkerStorage(filePath, file);

    console.log("UPLOAD ERROR:", uploadResult.error);

    if (uploadResult.ok) {
      const publicUrlData = storageClient.storage
        .from("worker-files")
        .getPublicUrl(filePath);

      photoUrl = publicUrlData.data.publicUrl;
      console.log("PHOTO URL GENERADA:", photoUrl);
    } else {
      console.error("Error subiendo imagen:", uploadResult.error);
      alert("No se pudo subir la imagen del trabajador. " + uploadResult.errorMessage);
    }
  }

  // ðŸ”¹ EDICIÃ“N
  if (editIndexWorker !== null) {
    workers[editIndexWorker] = {
      ...workers[editIndexWorker],
      name: workerName,
      rut: workerRut,
      birthDate,
      maritalStatus,
      address,
      afp,
      health,
      position,
      nationality,
      account_number: account,
      id_card_photo: photoUrl || workers[editIndexWorker].id_card_photo,
    };
    console.log("VALOR FINAL photoUrl:", photoUrl);
    if (USE_STORAGE && storageClient && workers[editIndexWorker]?.id) {
      const { data, error } = await storageClient
        .from("workers")
        .update({
          name: workerName,
          rut: workerRut,
          birthDate,
          maritalStatus,
          address,
          afp,
          health,
          position,
          nationality,
          account_number: account,
          id_card_photo: photoUrl || workers[editIndexWorker].id_card_photo,
        })
        .eq("id", workers[editIndexWorker].id);

      console.log("UPDATE RESULT:", data);
      console.log("UPDATE ERROR:", error);
    }

    editIndexWorker = null;
  }

  // ðŸ”¹ NUEVO TRABAJADOR
  else {
    const newWorker = {
      name: workerName,
      rut: workerRut,
      birthDate,
      maritalStatus,
      address,
      afp,
      health,
      position,
      nationality,
      baseSalary,
      account_number: account,
      id_card_photo: photoUrl,
    };

    workers.push(newWorker);

    if (USE_STORAGE && storageClient) {
      const cloudSaveResult = await saveWorkerToCloud(newWorker);
      if (cloudSaveResult?.ok) {
        console.log("Trabajador guardado en almacenamiento local");
      }
    }
  }

  saveLocalDataDebounced();

  clearWorkerForm();
  loadWorkers();
  renderWorkersTable();

  showCustomAlert("Trabajador guardado correctamente");
}
// =============================
// 📋 SELECTS
// =============================

function loadPagosWorkerFilter() {
  // El filtro ahora usa búsqueda dinámica, no hace falta poblar un select
}

function filterWorkersPagos() {
  const searchInput = document.getElementById("searchWorkerPagos");
  const list = document.getElementById("workerPagosList");
  const hiddenInput = document.getElementById("filterPaymentsWorker");

  if (!searchInput || !list || !hiddenInput) return;

  const search = searchInput.value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim();

  hiddenInput.value = "";
  list.innerHTML = "";

  if (search === "") {
    list.style.display = "none";
    return;
  }

  const currentValue = select.value;
  select.innerHTML = "<option value=''>-- Seleccionar fundo --</option>";

  fundos.forEach((f) => {
    const option = document.createElement("option");
    option.value = f;
    option.textContent = f;
    select.appendChild(option);
  });

  if (currentValue && fundos.includes(currentValue)) {
    select.value = currentValue;
  }
}
// =============================
// ðŸ¦ CARGAR AFP EN SELECT
// =============================

function loadAFPOptions() {
  const select = document.getElementById("workerAFP");
  if (!select) return;

  // Limpiar por seguridad
  select.innerHTML = "<option value=''>-- Seleccionar AFP --</option>";

  Object.keys(afpRates).forEach((afp) => {
    const option = document.createElement("option");
    option.value = afp;
    option.textContent = afp;
    select.appendChild(option);
  });
}

function loadMandanteFundoFilter() {
  const select = document.getElementById("mandanteFundoFilter");
  if (!select) return;

  const currentValue = select.value;
  const fundoMap = new Map();

  history.forEach((record) => {
    const fundoKey = getFundoKey(record.fundo) || "sin-fundo";
    const fundoLabel = getFundoDisplay(record.fundo, "Sin fundo");

    if (!fundoMap.has(fundoKey)) {
      fundoMap.set(fundoKey, fundoLabel);
    }
  });

  select.innerHTML = "<option value=''>-- Todos los fundos --</option>";

  Array.from(fundoMap.entries())
    .sort((a, b) => a[1].localeCompare(b[1], "es"))
    .forEach(([key, label]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = label;
      select.appendChild(option);
    });

  if (currentValue && fundoMap.has(currentValue)) {
    select.value = currentValue;
  }
}

// =============================
// ðŸ§© AUXILIARES
// =============================

function formatCurrency(input) {
  let value = input.value.replace(/\D/g, "");

  if (!value) {
    input.value = "";
    return;
  }

  input.value = "$" + Number(value).toLocaleString("es-CL");
}

function filterWorkersWeekly() {
  const searchInput = document.getElementById("searchWorkerWeekly");
  const resultsList = document.getElementById("workerWeeklyList");
  const hiddenSelect = document.getElementById("workerWeekly");

  if (!searchInput || !resultsList || !hiddenSelect) return;

  const search = searchInput.value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim();

  hiddenSelect.value = "";

  // Si estÃ¡ vacÃ­o, ocultar lista y limpiar selecciÃ³n
  if (search === "") {
    resultsList.style.display = "none";
    resultsList.innerHTML = "";
    hiddenSelect.value = "";
    document.getElementById("calendarContainer").innerHTML = "";
    document.getElementById("weeklyResult").innerHTML = "";
    return;
  }

  // Filtrar trabajadores
  const filtered = workers.filter((worker, index) => {
    const name = (worker.name || "").toLowerCase();
    const cleanRut = (worker.rut || "")
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/-/g, "");

    const matchRut = cleanRut.includes(search);
    const matchName = name.includes(search);

    return matchRut || matchName;
  });

  // Mostrar resultados
  if (filtered.length === 0) {
    resultsList.innerHTML =
      "<div style='padding: 10px; color: #999;'>No se encontraron resultados</div>";
    resultsList.style.display = "block";
    return;
  }

  let html = "";
  filtered.forEach((worker, i) => {
    const originalIndex = workers.indexOf(worker);
    html += `<div class="worker-weekly-item" data-index="${originalIndex}" data-name="${worker.name.replace(/"/g, "&quot;")}" style='padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;'>`;
    html += `<strong>${worker.name}</strong><br>`;
    html += `<small style='color: #666;'>${worker.rut}</small>`;
    html += "</div>";
  });

  resultsList.innerHTML = html;
  resultsList.style.display = "block";

  // Asignar eventos CSP-compliant
  resultsList.querySelectorAll(".worker-weekly-item").forEach((div) => {
    div.addEventListener("click", function () {
      selectWorkerWeekly(
        Number(this.getAttribute("data-index")),
        this.getAttribute("data-name"),
      );
    });
    div.addEventListener("mouseover", function () {
      this.style.background = "#f0f0f0";
    });
    div.addEventListener("mouseout", function () {
      this.style.background = "white";
    });
  });
}

function filterWorkersProduction() {
  const input = document
    .getElementById("searchWorkerProduction")
    .value.toLowerCase();

  const list = document.getElementById("workerProductionList");
  list.innerHTML = "";

  if (!input) {
    list.style.display = "none";
    return;
  }

  const filtered = workers.filter((w) => {
    if (w.active === false) return false;
    return (
      (w.name || "").toLowerCase().includes(input) ||
      (w.rut || "").toLowerCase().includes(input)
    );
  });

  filtered.forEach((w) => {
    const div = document.createElement("div");
    div.textContent = `${w.name} - ${w.rut}`;
    div.addEventListener("click", () => {
      document.getElementById("searchWorkerProduction").value = w.name;
      document.getElementById("workerSelect").value = workers.indexOf(w);
      list.style.display = "none";
    });
    list.appendChild(div);
  });

  list.style.display = "block";
}

function clearWorkerProductionSearch() {
  const searchInput = document.getElementById("searchWorkerProduction");
  const list = document.getElementById("workerProductionList");
  const hiddenSelect = document.getElementById("workerSelect");

  if (searchInput) searchInput.value = "";
  if (hiddenSelect) hiddenSelect.value = "";
  if (list) {
    list.style.display = "none";
    list.innerHTML = "";
  }
}

function filterWorkersContract() {
  const searchInput = document.getElementById("searchWorkerContract");
  const list = document.getElementById("workerContractList");
  const hiddenSelect = document.getElementById("workerContract");

  if (!searchInput || !list || !hiddenSelect) return;

  const search = searchInput.value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim();

  const selectedName = (searchInput.dataset.monthlySelectedName || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim();

  if (
    searchInput.dataset.monthlyWorkerLocked === "1" &&
    hiddenSelect.value !== "" &&
    search === selectedName
  ) {
    list.style.display = "none";
    list.innerHTML = "";
    return;
  }

  if (search !== selectedName) {
    delete searchInput.dataset.monthlyWorkerLocked;
  }

  hiddenSelect.value = "";
  list.innerHTML = "";

  if (search === "") {
    list.style.display = "none";
    return;
  }

  const filtered = workers.filter((worker) => {
    const name = (worker.name || "").toLowerCase();
    const cleanRut = (worker.rut || "")
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/-/g, "");

    return name.includes(search) || cleanRut.includes(search);
  });

  if (filtered.length === 0) {
    list.innerHTML =
      "<div style='padding: 10px; color: #999;'>No se encontraron resultados</div>";
    list.style.display = "block";
    return;
  }

  filtered.forEach((worker) => {
    const div = document.createElement("div");
    div.innerHTML = `<strong>${worker.name || ""}</strong><br><small style='color:#666;'>${worker.rut || ""}</small>`;
    div.addEventListener("click", () => {
      const index = workers.indexOf(worker);
      hiddenSelect.value = index;
      searchInput.value = worker.name || "";
      list.style.display = "none";
      list.innerHTML = "";
    });
    list.appendChild(div);
  });

  list.style.display = "block";
}

function clearWorkerContractSearch() {
  const searchInput = document.getElementById("searchWorkerContract");
  const list = document.getElementById("workerContractList");
  const hiddenSelect = document.getElementById("workerContract");

  if (searchInput) searchInput.value = "";
  if (hiddenSelect) hiddenSelect.value = "";
  if (list) {
    list.style.display = "none";
    list.innerHTML = "";
  }

  // Limpiar solo datos del trabajador (mantener fecha/fundo/sueldo/jornada)
  document.getElementById("c_name").textContent =
    "_______________________________";
  document.getElementById("c_rut").textContent = "______________________";
  document.getElementById("c_maritalStatus").textContent =
    "______________________";
  document.getElementById("c_birthDate").textContent = "____ / ____ / ____";
  document.getElementById("c_address").textContent =
    "_________________________";
  document.getElementById("c_nationality").textContent =
    "______________________";
  document.getElementById("c_afp").textContent = "______________";
  document.getElementById("c_health").textContent = "____________";
  document.getElementById("c_workerSign").textContent = "________________";
}

function clearAllContract() {
  clearWorkerContractSearch();

  const startDate = document.getElementById("startDate");
  const fundoSelect = document.getElementById("fundoSelect");
  const newFundo = document.getElementById("newFundo");
  const workSchedule = document.getElementById("workSchedule");
  const salary = document.getElementById("salary");

  if (startDate) startDate.value = "";
  if (fundoSelect) fundoSelect.value = "";
  if (newFundo) newFundo.value = "";
  if (workSchedule) workSchedule.value = "";
  if (salary) salary.value = "";

  document.getElementById("c_day").textContent = "____";
  document.getElementById("c_month").textContent = "__________________";
  document.getElementById("c_year").textContent = "20____";
  document.getElementById("c_startDate").textContent = "___/___/20__";
  document.getElementById("c_faena").textContent = "________________________";
  document.getElementById("c_salary").textContent = "____________";

  const scheduleEl = document.getElementById("c_workSchedule");
  if (scheduleEl) {
    scheduleEl.textContent =
      "La jornada ordinaria de trabajo será¡ _______________________________.";
  }
}

function clearWorkerMonthlySearch() {
  const searchInput = document.getElementById("searchWorkerMonthly");
  const list = document.getElementById("workerMonthlyList");
  const hiddenSelect = document.getElementById("workerMonthly");

  if (searchInput) searchInput.value = "";
  if (hiddenSelect) hiddenSelect.value = "";
  if (list) {
    list.style.display = "none";
    list.innerHTML = "";
  }
}

function filterWorkersFiniquito() {
  const searchInput = document.getElementById("searchWorkerFiniquito");
  const list = document.getElementById("workerFiniquitoList");
  const hiddenSelect = document.getElementById("workerFiniquito");

  if (!searchInput || !list || !hiddenSelect) return;

  const search = searchInput.value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim();

  hiddenSelect.value = "";
  list.innerHTML = "";

  if (search === "") {
    list.style.display = "none";
    return;
  }

  const filtered = workers.filter((worker) => {
    const name = (worker.name || "").toLowerCase();
    const cleanRut = (worker.rut || "")
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/-/g, "");

    return name.includes(search) || cleanRut.includes(search);
  });

  if (filtered.length === 0) {
    list.innerHTML =
      "<div style='padding: 10px; color: #999;'>No se encontraron resultados</div>";
    list.style.display = "block";
    return;
  }

  filtered.forEach((worker) => {
    const div = document.createElement("div");
    div.innerHTML = `<strong>${worker.name || ""}</strong><br><small style='color:#666;'>${worker.rut || ""}</small>`;
    div.addEventListener("click", () => {
      clearTimeout(debounceTimer);
      const index = workers.indexOf(worker);
      hiddenSelect.value = String(index);
      searchInput.value = worker.name || "";
      searchInput.dataset.monthlySelectedName = worker.name || "";
      searchInput.dataset.monthlyWorkerLocked = "1";
      document.getElementById("f_workerName").textContent = worker.name;
      const workerRecords = history
        .filter((r) => r.rut === worker.rut)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      if (workerRecords.length > 0) {
        const parts = workerRecords[0].date.split("-");
        const formatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
        document.getElementById("f_startDate").textContent = formatted;
      } else {
        document.getElementById("f_startDate").textContent =
          "____ / ____ / ______";
      }
      refreshFiniquitoResumen();
      list.style.display = "none";
      list.innerHTML = "";
    });
    list.appendChild(div);
  });

  list.style.display = "block";
}

function clearWorkerFiniquitoSearch() {
  const searchInput = document.getElementById("searchWorkerFiniquito");
  const list = document.getElementById("workerFiniquitoList");
  const hiddenSelect = document.getElementById("workerFiniquito");

  if (searchInput) searchInput.value = "";
  if (hiddenSelect) hiddenSelect.value = "";
  if (list) {
    list.style.display = "none";
    list.innerHTML = "";
  }
}

function filterWorkersLiquidation() {
  const input = document
    .getElementById("searchWorkerLiquidation")
    .value.toLowerCase();

  const hiddenSelect = document.getElementById("workerLiquidation");

  const list = document.getElementById("workerLiquidationList");
  list.innerHTML = "";

  if (hiddenSelect) {
    hiddenSelect.value = "";
  }

  if (!input) {
    hiddenSelect.value = "";
    list.style.display = "none";
    return;
  }

  const filtered = workers.filter(
    (w) =>
      (w.name || "").toLowerCase().includes(input) ||
      (w.rut || "").toLowerCase().includes(input),
  );

  if (filtered.length === 0) {
    list.innerHTML =
      "<div style='padding: 10px; color: #999;'>No se encontraron resultados</div>";
    list.style.display = "block";
    return;
  }

  filtered.forEach((w) => {
    const div = document.createElement("div");
    div.textContent = `${w.name} - ${w.rut}`;
    div.addEventListener("click", () => {
      clearTimeout(debounceTimer);
      console.log("LIQUIDATION WORKER CLICK:", w);
      const index = workers.indexOf(w);
      const workerLiquidation = hiddenSelect;
      if (workerLiquidation) {
        const targetValue = String(index);
        if (!workerLiquidation.querySelector(`option[value="${targetValue}"]`)) {
          const opt = document.createElement("option");
          opt.value = targetValue;
          opt.textContent = w.name || "";
          workerLiquidation.appendChild(opt);
        }
        workerLiquidation.value = targetValue;
        console.log("SETTING INPUT:", workerLiquidation);
        console.log("VALUE AFTER SET:", workerLiquidation.value);
      }
      document.getElementById("searchWorkerLiquidation").value = w.name;
      list.style.display = "none";
      list.innerHTML = "";
    });
    list.appendChild(div);
  });

  list.style.display = "block";
}
document.addEventListener(
  "mousedown",
  (event) => {
    event.stopPropagation();
  },
  true,
);

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerLiquidation");
  const list = document.getElementById("workerLiquidationList");
  const hiddenSelect = document.getElementById("workerLiquidation");

  if (!searchInput || !list || !hiddenSelect) return;

  const clickedInsideInput = searchInput.contains(event.target);
  const clickedInsideList = list.contains(event.target);

  if (clickedInsideInput || clickedInsideList) return;

  list.style.display = "none";
  list.innerHTML = "";

  if (!hiddenSelect.value) {
    searchInput.value = "";
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerWeekly");
  const list = document.getElementById("workerWeeklyList");
  const hiddenSelect = document.getElementById("workerWeekly");

  if (!searchInput || !list || !hiddenSelect) return;

  const clickedInsideInput = searchInput.contains(event.target);
  const clickedInsideList = list.contains(event.target);

  if (clickedInsideInput || clickedInsideList) return;

  list.style.display = "none";
  list.innerHTML = "";

  if (!hiddenSelect.value) {
    searchInput.value = "";
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerEdit");
  const list = document.getElementById("workerEditList");
  const hiddenSelect = document.getElementById("workerEditSelect");

  if (!searchInput || !list || !hiddenSelect) return;

  const clickedInsideInput = searchInput.contains(event.target);
  const clickedInsideList = list.contains(event.target);

  if (clickedInsideInput || clickedInsideList) return;

  list.style.display = "none";
  list.innerHTML = "";

  if (!hiddenSelect.value) {
    searchInput.value = "";
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerContract");
  const list = document.getElementById("workerContractList");
  const hiddenSelect = document.getElementById("workerContract");

  if (!searchInput || !list || !hiddenSelect) return;

  const clickedInsideInput = searchInput.contains(event.target);
  const clickedInsideList = list.contains(event.target);

  if (clickedInsideInput || clickedInsideList) return;

  list.style.display = "none";
  list.innerHTML = "";

  if (!hiddenSelect.value) {
    searchInput.value = "";
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerMonthly");
  const list = document.getElementById("workerMonthlyList");
  const hiddenSelect = document.getElementById("workerMonthly");

  if (!searchInput || !list || !hiddenSelect) return;

  const clickedInsideInput = searchInput.contains(event.target);
  const eventPath =
    typeof event.composedPath === "function" ? event.composedPath() : [];
  const clickedInsideList =
    list.contains(event.target) || eventPath.includes(list);

  if (clickedInsideInput || clickedInsideList) return;

  list.style.display = "none";
  list.innerHTML = "";

  if (!hiddenSelect.value) {
    searchInput.value = "";
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerFiniquito");
  const list = document.getElementById("workerFiniquitoList");
  const hiddenSelect = document.getElementById("workerFiniquito");

  if (!searchInput || !list || !hiddenSelect) return;

  const clickedInsideInput = searchInput.contains(event.target);
  const clickedInsideList = list.contains(event.target);

  if (clickedInsideInput || clickedInsideList) return;

  list.style.display = "none";
  list.innerHTML = "";

  if (!hiddenSelect.value) {
    searchInput.value = "";
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerPagos");
  const list = document.getElementById("workerPagosList");
  if (!searchInput || !list) return;
  if (searchInput.contains(event.target) || list.contains(event.target)) return;
  list.style.display = "none";
  list.innerHTML = "";
});

function selectWorkerWeekly(index, name) {
  document.getElementById("workerWeekly").value = index;
  document.getElementById("searchWorkerWeekly").value = name;
  document.getElementById("workerWeeklyList").style.display = "none";
  document.getElementById("workerWeeklyList").innerHTML = "";

  // Limpiar dÃ­as seleccionados del trabajador anterior
  selectedDays.clear();

  // Limpiar el resumen si habÃ­a uno generado
  document.getElementById("weeklyResult").innerHTML = "";

  // Mostrar calendario automÃ¡ticamente
  showCalendar();
}

async function generateLiquidation() {
  const workerIndex = document.getElementById("workerLiquidation").value;
  const month = document.getElementById("monthLiquidation").value;

  if (workerIndex === "" || !month) {
    alert("Seleccione trabajador y mes.");
    return;
  }

  const worker = workers[workerIndex];

  // ===== PRODUCCIÃ“N DEL MES =====

  const recordsRaw = history.filter(
    (r) => r.rut === worker.rut && isHistoryRecordInMonth(r.date, month),
  );

  const records = dedupeHistoryRecords(recordsRaw);

  records.sort((a, b) => new Date(a.date) - new Date(b.date));
  const uniqueDates = [
    ...new Set(records.map((r) => getHistoryDateKey(r.date))),
  ];
  const daysWorked = uniqueDates.length;

  if (records.length === 0) {
    await showCustomAlert("No hay producción ese mes.");
    return;
  }

  const produccionReal = records.reduce((sum, r) => sum + r.total, 0);

  const minimumWageInput = document.getElementById("minimumWage");
  console.log("MINIMUM WAGE INPUT:", minimumWageInput?.value);
  const sueldoMinimoInputValue = Number(
    String(minimumWageInput?.value || "")
      .replace(/\$/g, "")
      .replace(/\./g, "")
      .replace(/,/g, "."),
  );
  const sueldoMinimoMensual =
    Number.isFinite(sueldoMinimoInputValue) && sueldoMinimoInputValue > 0
      ? Math.round(sueldoMinimoInputValue)
      : Number(localStorage.getItem("minimumWage") || 0);
  const [yearPart, monthPart] = month.split("-").map(Number);
  const diasDelMes =
    Number.isFinite(yearPart) && Number.isFinite(monthPart)
      ? new Date(yearPart, monthPart, 0).getDate()
      : 30;
  console.log({
    sueldoMinimoMensual,
    diasTrabajados: daysWorked,
    diasDelMes,
  });
  const sueldoBaseProporcional =
    sueldoMinimoMensual > 0 && diasDelMes > 0
      ? Math.round((sueldoMinimoMensual / diasDelMes) * daysWorked)
      : 0;
  const sueldoBase = sueldoBaseProporcional;
  const sueldoMinimoConfigurado = sueldoMinimoMensual;
  let bonoProduccion = produccionReal;
  let totalFinal = sueldoBase + bonoProduccion;

  if (sueldoMinimoConfigurado > 0 && totalFinal > sueldoMinimoConfigurado) {
    bonoProduccion = Math.max(0, sueldoMinimoConfigurado - sueldoBase);
    totalFinal = sueldoBase + bonoProduccion;
  }

  const baseImponible = totalFinal;

  // ===== DESCUENTOS =====

  const anticipos = Number(
    document.getElementById("advanceAmount").value.replace(/\./g, "") || 0,
  );

  const afpName = worker.afp || "";
  const comisionAFP = afpRates[afpName] || 0;
  const porcentajeAFP = AFP_BASE + comisionAFP;

  const afp = Math.round(baseImponible * porcentajeAFP);
  const salud = Math.round(baseImponible * 0.07);

  const totalDescuentos = afp + salud + anticipos;

  const liquido = totalFinal - totalDescuentos;

  console.log({
    sueldoBase,
    bonoProduccion,
    sueldoMinimoConfigurado,
    sueldoBaseProporcional,
    produccionReal,
    totalFinal,
  });

  // ===== DOCUMENTO HTML =====

  const html = `
<div class="liq-doc">

<h1>LIQUIDACIÓN DE SUELDO</h1>
<h3>${month}</h3>

<p><strong>Nombre:</strong> ${worker.name}</p>
<p><strong>RUT:</strong> ${worker.rut}</p>
<p><strong>Cargo:</strong> ${worker.position || "-"}</p>
<p><strong>AFP:</strong> ${worker.afp || "-"}</p>
<p><strong>Salud:</strong> ${worker.health || "-"}</p>
<p><strong>Días trabajados:</strong> ${daysWorked}</p>

<hr>

<h3>HABERES IMPONIBLES</h3>

<table>

<tr>
<td>SUELDO BASE</td>
<td>$${sueldoBaseProporcional.toLocaleString("es-CL")}</td>
</tr>

<tr>
<td>BONO DE PRODUCCIÓN</td>
<td>$${bonoProduccion.toLocaleString("es-CL")}</td>
</tr>

<tr>
<th>Total Final a Pagar</th>
<th>$${totalFinal.toLocaleString("es-CL")}</th>
</tr>
</table>

<h3>DESCUENTOS</h3>

<table>
<tr>
<td>AFP ${(porcentajeAFP * 100).toFixed(2)}%</td>
<td>$${afp.toLocaleString("es-CL")}</td>
</tr>

<tr>
<td>Salud 7%</td>
<td>$${salud.toLocaleString("es-CL")}</td>
</tr>

<tr>
<td>Anticipos del Mes</td>
<td>${formatMoney(anticipos)}</td>
</tr>

<tr>
<th>Total Descuentos</th>
<th>$${totalDescuentos.toLocaleString("es-CL")}</th>
</tr>
</table>

<h2>LÍQUIDO A PAGAR: ${formatMoney(liquido)}</h2>

<div style="margin-top:60px;text-align:center">
  <div style="border-top:1px solid #222;width:220px;margin:0 auto 4px auto;height:0"></div>
  <span style="font-size:15px">${worker.name}</span>
</div>

</div>
`;

  const container = document.getElementById("liquidationPrint");
  container.innerHTML = html;
  container.classList.remove("hidden");

  // ===== CREAR PDF =====

  const pdfBlob = await createPdfBlobFromHtml(html, {
    extraStyles: `
      .liq-doc {
        max-width: 760px;
        margin: 0 auto;
      }
    `,
    scale: 2,
  });

  if (!pdfBlob) {
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = "liquidacion_" + month + "_" + stamp + ".pdf";
  const filePath = worker.rut + "/" + fileName;

  // ===== SUBIR A almacenamiento local =====

  const uploadResult = await uploadFileToWorkerStorage(
    filePath,
    pdfBlob,
    "application/pdf",
  );

  if (!uploadResult.ok) {
    console.error("Error subiendo liquidación:", uploadResult.error);
    await showCustomAlert(
      "⚠️ No se guardó en nube la liquidación. " + uploadResult.errorMessage,
    );
  } else {
    console.log("Liquidación guardada en almacenamiento local");
    await showCustomAlert("✅ Liquidación guardada en almacenamiento local OK");
  }
}

function getDocumentBaseStyles() {
  return `
    body {
      font-family: "Segoe UI", Tahoma, sans-serif;
      background: white;
      margin: 20px;
      color: black;
    }

    .liquidacion-doc {
      background: white;
      padding: 30px;
      margin-top: 20px;
      color: black;
      border-radius: 10px;
    }

    .liquidacion-doc h1,
    .liquidacion-doc h3 {
      text-align: center;
      margin-bottom: 10px;
    }

    .liquidacion-doc table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }

    .liquidacion-doc th,
    .liquidacion-doc td {
      border: 1px solid black;
      padding: 6px;
      text-align: center;
    }

    .liq-doc {
      background: white;
      padding: 40px;
      color: black;
      max-width: 800px;
      margin: auto;
      font-size: 11px;
    }

    .liq-doc h1,
    .liq-doc h3 {
      text-align: center;
    }

    .liq-doc table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }

    .liq-doc td,
    .liq-doc th {
      border: 1px solid black;
      padding: 6px;
    }

    #contractPrint {
      background: white;
      padding: 40px;
      margin-top: 10px;
      color: black;
      line-height: 1;
      font-family: "Times New Roman", serif;
      font-size: 16px;
    }

    #contractPrint p {
      margin: 4px 0;
      text-align: justify;
      line-height: 1.2;
    }

    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 20px;
    }

    .sign {
      width: 45%;
      text-align: center;
    }

    .line {
      border-top: 1px solid black;
      width: 250px;
      margin: 0 auto 10px;
    }

    .sign-name,
    .sign-role,
    .sign-rut {
      width: 250px;
      text-align: center;
      margin: 2px auto;
    }

    .sign-name {
      font-weight: bold;
    }

    .sign-rut {
      font-size: 12px;
    }

    @media print {
      body {
        margin: 0;
      }
    }
  `;
}

async function createPdfBlobFromHtml(
  contentHtml,
  { extraStyles = "", scale = 2 } = {},
) {
  const exportRoot = document.createElement("div");

  exportRoot.style.position = "fixed";
  exportRoot.style.left = "-99999px";
  exportRoot.style.top = "0";
  exportRoot.style.width = "794px";
  exportRoot.style.background = "#fff";
  exportRoot.style.padding = "20px";
  exportRoot.style.zIndex = "-1";

  exportRoot.innerHTML = `
    <style>${getDocumentBaseStyles()}${extraStyles}</style>
    ${contentHtml}
  `;

  document.body.appendChild(exportRoot);

  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    const blob = await createPdfBlobFromElement(exportRoot, { scale });
    return blob;
  } finally {
    if (exportRoot.parentNode) {
      exportRoot.parentNode.removeChild(exportRoot);
    }
  }
}

async function createPdfBlobFromElement(element, { scale = 2 } = {}) {
  const { jsPDF } = window.jspdf;

  const canvas = await Promise.race([
    html2canvas(element, {
      scale,
      backgroundColor: "#ffffff",
    }),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timeout al renderizar PDF")), 25000);
    }),
  ]);

  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF("p", "mm", "a4");

  const imgWidth = 210;
  const pageHeight = 297;

  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;

  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);

  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;

    pdf.addPage();

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);

    heightLeft -= pageHeight;
  }

  return pdf.output("blob");
}

function openScreenPrintWindow({ title, contentHtml, extraStyles = "" }) {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    alert(
      "No se pudo abrir la ventana de impresión. Verifique bloqueadores de ventanas emergentes.",
    );
    return;
  }

  const baseStyles = getDocumentBaseStyles();

  printWindow.document.open();
  printWindow.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>${title}</title>
        <style>${baseStyles}${extraStyles}</style>
      </head>
      <body>
        ${contentHtml}
      </body>
    </html>
  `);
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

function printLiquidationScreen() {
  const container = document.getElementById("liquidationPrint");

  if (!container || !container.innerHTML.trim()) {
    alert("Primero genere la liquidación para imprimir.");
    return;
  }

  openScreenPrintWindow({
    title: "Liquidación de Sueldo",
    contentHtml: container.outerHTML,
  });
}


function printMandanteCobro() {
  const resultContainer = document.getElementById("mandanteResult");

  if (!resultContainer || !resultContainer.innerHTML.trim()) {
    generateMandanteCobro();
  }

  const content = resultContainer?.innerHTML?.trim();

  if (!content) {
    alert("Primero genere el cobro mandante para imprimir.");
    return;
  }

  const printHtml = `
    <div style="max-width: 900px; margin: 0 auto; font-family: Arial, sans-serif;">
      ${content}
    </div>
  `;

  openScreenPrintWindow({
    title: "Cobro Mandante",
    contentHtml: printHtml,
    extraStyles: `
      @page {
        size: letter;
        margin: 1cm;
      }
      body {
        margin: 0;
        padding: 0;
        background: white;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }
      th, td {
        border: 1px solid #ddd;
        padding: 6px 8px;
        text-align: left;
      }
      th {
        background: #f5f5f5;
      }
    `,
  });
}function printContractScreen() {
  const container = document.getElementById("contractPrint");

  if (!container || !container.innerHTML.trim()) {
    alert("No hay contrato para imprimir.");
    return;
  }

  openScreenPrintWindow({
    title: "Contrato de Trabajo de Temporada",
    contentHtml: container.outerHTML,
    extraStyles: `
      @page {
        size: letter;
        margin: 1.2cm 1.5cm;
      }
      body {
        margin: 0;
        padding: 0;
      }
      #contractPrint {
        padding: 0;
        margin: 0 auto;
        max-width: 740px;
        font-family: "Times New Roman", serif;
        font-size: 15px;
        line-height: 1.35;
      }
      #contractPrint .titulo-contrato {
        text-align: center;
        font-size: 16px;
        margin: 0 0 6px 0;
        text-align: center;
      }
      #contractPrint h3 {
        font-size: 13px;
        margin: 2px 0;
        text-align: center;
      }
      #contractPrint br {
        display: none;
      }
      .signatures {
        margin-top: 60px;
      }
      .line {
        width: 200px;
        margin: 0 auto 10px;
      }
      .sign-name,
      .sign-role,
      .sign-rut {
        width: 200px;
        font-size: 13px;
      }
    `,
  });
}

async function generateContract() {
  const workerIndex = document.getElementById("workerContract").value;

  if (workerIndex === "") {
    console.warn("Seleccione un trabajador");
    return;
    return;
  }

  const worker = workers[workerIndex];
  const faenaInput = document.getElementById("faena");
  const contractFaena = (faenaInput?.value || "").trim();

  const fundoSelect = document.getElementById("fundoSelect");
  const newFundoInput = document.getElementById("newFundo");
  const selectedFundo = (fundoSelect?.value || "").trim();
  const newFundo = (newFundoInput?.value || "").trim();
  const contractFundo = newFundo || selectedFundo;

  if (
    newFundo &&
    !fundos.some((f) => f.toLowerCase() === newFundo.toLowerCase())
  ) {
    fundos.push(newFundo);
    localStorage.setItem("fundos", JSON.stringify(fundos));
    loadFundos();
    if (fundoSelect) fundoSelect.value = newFundo;
  }

  // ðŸ”¹ COMPLETAR NOMBRE Y RUT
  document.getElementById("c_name").textContent = worker.name;
  document.getElementById("c_rut").textContent = worker.rut;
  document.getElementById("c_faena").textContent =
    contractFaena || "________________________";
  document.getElementById("c_workerSign").textContent = worker.name;

  const workScheduleInput = document.getElementById("workSchedule");
  const workScheduleValue = (workScheduleInput?.value || "").trim();
  const workScheduleElement = document.getElementById("c_workSchedule");
  if (workScheduleElement && workScheduleValue) {
    const fixedPrefix = "La jornada ordinaria de trabajo será¡ ";
    const normalized = workScheduleValue
      .toLowerCase()
      .startsWith(fixedPrefix.toLowerCase())
      ? workScheduleValue
      : fixedPrefix + workScheduleValue;
    workScheduleElement.textContent = normalized;
  }

  // ðŸ”¹ AQUÃ VA EL PASO 2 ðŸ‘‡

  const startDate = document.getElementById("startDate").value.trim();

  if (!startDate) {
    alert("Ingrese la fecha del contrato.");
    return;
  }

  const [day, monthNumber, year] = startDate.split("/");

  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  const month = months[parseInt(monthNumber) - 1];

  document.getElementById("c_day").textContent = day || "__";
  document.getElementById("c_month").textContent = month || "__________";
  document.getElementById("c_year").textContent = year || "____";
  document.getElementById("c_startDate").textContent =
    startDate || "___/___/20__";
  document.getElementById("c_nationality").textContent =
    worker.nationality || "Chilena";
  document.getElementById("c_maritalStatus").textContent =
    worker.maritalStatus || "______________________";
  document.getElementById("c_address").textContent =
    worker.address || "_________________________";
  document.getElementById("c_afp").textContent = worker.afp || "______________";
  document.getElementById("c_health").textContent = worker.health || "____________";

  const salaryInput = document.getElementById("salary").value.trim();

  const formattedSalary = formatCLPCurrency(salaryInput);

  document.getElementById("c_salary").textContent =
    formattedSalary || "____________";

  document.getElementById("c_birthDate").textContent =
    worker.birthDate || "____ / ____ / ____";

  await showCustomAlert("Contrato completado correctamente.");

  const contractContainer = document.getElementById("contractPrint");
  const pdfBlob = await createPdfBlobFromHtml(contractContainer.outerHTML, {
    extraStyles: `
      #contractPrint {
        padding: 0;
        margin: 0 auto;
        max-width: 740px;
        font-family: "Times New Roman", serif;
        font-size: 15px;
        line-height: 1.35;
      }

      #contractPrint .titulo-contrato {
        text-align: center;
        font-size: 16px;
        margin: 0 0 6px 0;
        text-align: center;
      }

      #contractPrint p,
      #contractPrint .clausula {
        margin: 2px 0;
        text-align: justify;
        line-height: 1.35;
      }

      #contractPrint h3 {
        margin: 3px 0;
        font-size: 14px;
        text-align: center;
      }

      #contractPrint br {
        display: none;
      }

      #contractPrint .signatures {
        margin-top: 104px;
      }
    `,
    scale: 2,
  });

  if (!pdfBlob) {
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = "contrato_" + worker.rut + "_" + stamp + ".pdf";

  const filePath = worker.rut + "/" + fileName;

  const uploadResult = await uploadFileToWorkerStorage(
    filePath,
    pdfBlob,
    "application/pdf",
  );

  if (!uploadResult.ok) {
    console.error("Error subiendo contrato:", uploadResult.error);
    alert(
      "⚠️ No se guardó en nube el contrato. " + uploadResult.errorMessage,
    );
  } else {
    console.log("Contrato guardado en almacenamiento local");
    showCustomAlert("✅ Contrato guardado en almacenamiento local OK");
  }
}
function calcularTotalPagadoFiniquito(worker, inicio, fin) {
  if (!worker || !inicio || !fin) return 0;

  const inicioValido = DateHelper.isISO(inicio) || DateHelper.isCLAny(inicio);
  const finValido = DateHelper.isISO(fin) || DateHelper.isCLAny(fin);

  if (!inicioValido || !finValido) return 0;

  let total = 0;
  for (const record of history) {
    if (!record || record.rut !== worker.rut || record.paid !== true) continue;
    if (!DateHelper.isBetween(record.date, inicio, fin)) continue;

    const value = Number(record.total);
    if (!Number.isFinite(value)) continue;

    total += value;
  }

  return total;
}

function normalizeWorkerForDocs(worker) {
  const safe = worker && typeof worker === "object" ? worker : {};

  const safeName = String(safe.name || "")
    .trim()
    .slice(0, 120);
  const safeRut = String(safe.rut || "")
    .trim()
    .slice(0, 25);
  const safePosition = String(safe.position || "-")
    .trim()
    .slice(0, 80);

  return {
    name: safeName,
    rut: safeRut,
    position: safePosition || "-",
  };
}

function refreshFiniquitoResumen() {
  const totalElement = document.getElementById("f_totalLiquido");
  if (!totalElement) return;

  const workerIndex = document.getElementById("workerFiniquito")?.value;
  const inicio = (
    document.getElementById("f_startDate")?.textContent || ""
  ).trim();
  const fin = (document.getElementById("f_endDate")?.value || "").trim();

  const finCompleto = DateHelper.isISO(fin) || DateHelper.isCLAny(fin);

  if (
    workerIndex === "" ||
    !inicio ||
    !fin ||
    inicio.includes("_") ||
    !finCompleto
  ) {
    totalElement.textContent = "$ _______________________";
    return;
  }

  const worker = workers[workerIndex];
  const sueldoMinimo = Number(localStorage.getItem("minimumWage") || 0);
  const totalCalculado = calcularTotalPagadoFiniquito(worker, inicio, fin);
  const totalPagado =
    sueldoMinimo > 0
      ? Math.min(totalCalculado, sueldoMinimo)
      : totalCalculado;
  totalElement.textContent = `$ ${totalPagado.toLocaleString("es-CL")}`;
}

async function generateFiniquito() {
  if (isGeneratingFiniquito) {
    alert("Ya se está generando un finiquito. Espere un momento.");
    return;
  }

  const workerIndex = document.getElementById("workerFiniquito").value;

  if (workerIndex === "") {
    console.warn("Seleccione un trabajador");
    return;
    return;
  }

  const rawWorker = workers[workerIndex];
  if (!rawWorker || typeof rawWorker !== "object") {
    alert("El trabajador seleccionado no es válido. Vuelva a seleccionarlo.");
    return;
  }

  const worker = normalizeWorkerForDocs(rawWorker);
  if (!worker.name || !worker.rut) {
    alert(
      "El trabajador tiene datos incompletos (Nombre/RUT). Corrija el registro antes de generar el finiquito.",
    );
    return;
  }

  isGeneratingFiniquito = true;

  try {
    const endDate = (document.getElementById("f_endDate")?.value || "").trim();

    syncFiniquitoEndDate(endDate);

    const inicio = (
      document.getElementById("f_startDate")?.textContent || ""
    ).trim();
    const fin = (document.getElementById("f_endDate")?.value || "").trim();
    const sueldoMinimo = Number(localStorage.getItem("minimumWage") || 0);
    const totalCalculado = calcularTotalPagadoFiniquito(rawWorker, inicio, fin);
    const totalPagado =
      sueldoMinimo > 0
        ? Math.min(totalCalculado, sueldoMinimo)
        : totalCalculado;

    const today = new Date().toLocaleDateString("es-CL");

    const html = `
  <div id="finiquitoDoc">

  <h1 style="text-align:center;">FINIQUITO DE TRABAJO</h1>

  <p>En conformidad a lo dispuesto en la legislación laboral vigente, se deja constancia que:</p>

  <p><strong>Trabajador:</strong> ${worker.name}</p>
  <p><strong>RUT:</strong> ${worker.rut}</p>
  <p><strong>Cargo:</strong> ${worker.position || "-"}</p>
  <p><strong>Servicios prestados desde:</strong> ${inicio || "__________"} <strong>hasta:</strong> ${fin || "__________"}</p>
  <p><strong>Fecha de terminación:</strong> ${endDate || "__________"}</p>

  <br>

  <p>Declara haber recibido de su empleador todas las remuneraciones, pagos y beneficios que le correspondían por su trabajo realizado.</p>

  <h3 style="text-align:center; margin-top:18px;">TOTAL LÍQUIDO A PAGAR SEGÚN DETALLE LIQUIDACIÓN</h3>
  <h2 style="text-align:center;">$ ${totalPagado.toLocaleString("es-CL")}</h2>

  <br><br>

  <p>Firmado en conformidad.</p>

  <br><br>

  <p>Fecha: ${today}</p>

  <br><br><br>

  <div style="display:flex; justify-content:space-between;">

  <div style="text-align:center;">
  <div style="border-top:1px solid black; width:200px;"></div>
  <p>Firma Trabajador</p>
  <p>${worker.name}</p>
  <p>${worker.rut}</p>
  </div>

  <div style="text-align:center;">
  <div style="border-top:1px solid black; width:200px;"></div>
  <p>Firma Empleador</p>
  </div>

  </div>

  </div>
  `;

    const pdfBlob = await createPdfBlobFromHtml(html, {
      scale: 2,
    });

    if (!pdfBlob) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");

    const fileName = "finiquito_" + worker.rut + "_" + stamp + ".pdf";

    const filePath = worker.rut + "/" + fileName;

    const uploadResult = await uploadFileToWorkerStorage(
      filePath,
      pdfBlob,
      "application/pdf",
    );

    if (!uploadResult.ok) {
      console.error("Error subiendo finiquito:", uploadResult.error);
      alert(
        "⚠️ No se guardó en nube el finiquito. " + uploadResult.errorMessage,
      );
    } else {
      console.log("Finiquito guardado en almacenamiento local");
      showCustomAlert("✅ Finiquito guardado en almacenamiento local OK");
    }
  } catch (error) {
    console.error("Error generando finiquito:", error);
    alert("⚠️ Ocurrió un error al generar el finiquito. Intente nuevamente.");
  } finally {
    isGeneratingFiniquito = false;
  }
}

function syncFiniquitoEndDate(value) {
  const endDatePrint = document.getElementById("f_endDatePrint");
  if (!endDatePrint) return;

  const normalizedValue = (value || "").trim();
  endDatePrint.textContent = normalizedValue || "__________";

  // Rellenar encabezado "En San Clemente, a __ de ___ de ____"
  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const parts = normalizedValue.split("/");
  const dayEl = document.getElementById("f_headerDay");
  const monthEl = document.getElementById("f_headerMonth");
  const yearEl = document.getElementById("f_headerYear");
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    const day = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const year = parts[2];
    if (dayEl) dayEl.textContent = day || "____";
    if (monthEl)
      monthEl.textContent = months[monthIndex] || "__________________";
    if (yearEl) yearEl.textContent = year || "20____";
  } else {
    if (dayEl) dayEl.textContent = "____";
    if (monthEl) monthEl.textContent = "__________________";
    if (yearEl) yearEl.textContent = "20____";
  }

  refreshFiniquitoResumen();
}

function generateMonthlySummary() {
  const searchInput = document.getElementById("searchWorkerMonthly");
  const hiddenSelect = document.getElementById("workerMonthly");
  const workerIndex = document.getElementById("workerMonthly").value;

  const month = document.getElementById("monthMonthly").value;

  console.log("[MonthlySummary] before validation", {
    searchInputValue: (searchInput?.value || "").trim(),
    hiddenSelectValue: (hiddenSelect?.value || "").trim(),
    monthValue: (month || "").trim(),
  });

  if (workerIndex === "" || !month) {
    showCustomAlert("Seleccione trabajador y mes.");
    return;
  }

  const worker = workers[workerIndex];

  const recordsRaw = history.filter(
    (r) => r.rut === worker.rut && isHistoryRecordInMonth(r.date, month),
  );

  const records = dedupeHistoryRecords(recordsRaw);

  const container = document.getElementById("monthlyResult");

  if (records.length === 0) {
    container.innerHTML = "<p>No hay producción ese mes.</p>";
    return;
  }

  // ===== CALCULAR DÍAS TRABAJADOS =====
  const uniqueDates = [
    ...new Set(records.map((r) => getHistoryDateKey(r.date))),
  ];
  const daysWorked = uniqueDates.length;

  let total = 0;

  let html = "<h3>Detalle del Mes</h3>";
  html += "<table>";
  html +=
    "<tr><th>Fecha</th><th>Labor</th><th>Cantidad</th><th>Total</th></tr>";

  records.forEach((r) => {
    total += r.total;

    html += "<tr>";
    html += "<td>" + r.date + "</td>";
    html += "<td>" + r.labor + "</td>";
    html += "<td>" + r.quantity + "</td>";
    html += "<td>$" + Number(r.total).toLocaleString("es-CL") + "</td>";
    html += "</tr>";
  });

  html += "</table>";

  html += "<p><strong>Días trabajados:</strong> " + daysWorked + "</p>";
  html += "<h2>Total del Mes: $" + total.toLocaleString("es-CL") + "</h2>";

  container.innerHTML = html;
}

function generateMonthlyGeneral() {
  const month = document.getElementById("monthGeneral").value;

  if (!month) {
    alert("Seleccione un mes.");
    return;
  }

  const recordsRaw = history.filter((r) =>
    isHistoryRecordInMonth(r.date, month),
  );
  const records = dedupeHistoryRecords(recordsRaw);

  const container = document.getElementById("monthlyGeneralResult");

  if (records.length === 0) {
    container.innerHTML = "<p>No hay producción ese mes.</p>";
    return;
  }

  // Agrupar por RUT
  const summary = {};

  // ===== RESUMEN GENERAL POR LABOR DEL MES =====
  const laborSummary = {};

  records.forEach((r) => {
    const laborName = getCanonicalLaborName(r.labor);
    const laborKey = getLaborKey(laborName);

    if (!summary[r.rut]) {
      summary[r.rut] = {
        name: r.name,
        total: 0,
        dates: new Set(),
        labors: {},
      };
    }
    if (!laborSummary[laborKey]) {
      laborSummary[laborKey] = {
        labor: laborName,
        cantidad: 0,
        total: 0,
      };
    }
    laborSummary[laborKey].cantidad += r.quantity;
    laborSummary[laborKey].total += r.total;

    summary[r.rut].total += r.total;
    summary[r.rut].dates.add(getHistoryDateKey(r.date));
    if (!summary[r.rut].labors[laborKey]) {
      summary[r.rut].labors[laborKey] = {
        labor: laborName,
        cantidad: 0,
      };
    }
    summary[r.rut].labors[laborKey].cantidad += r.quantity;
  });

  let html = "<h3>Resumen General del Mes</h3>";

  // ===== MOSTRAR RESUMEN GENERAL POR LABOR =====
  html += "<h4>Labores realizadas en el mes</h4>";
  html += "<div class='table-container'><table>";
  html += "<tr><th>Labor</th><th>Cantidad</th><th>Total</th></tr>";

  Object.values(laborSummary).forEach((data) => {
    html += "<tr>";
    html += "<td>" + data.labor + "</td>";
    html += "<td>" + data.cantidad + "</td>";
    html += "<td>$" + data.total.toLocaleString("es-CL") + "</td>";
    html += "</tr>";
  });

  html += "</table></div>";

  html += "<table>";
  html += "<tr><th>Trabajador</th><th>Días</th><th>Total</th></tr>";

  let totalGeneral = 0;

  Object.values(summary).forEach((worker) => {
    const daysWorked = worker.dates.size;

    totalGeneral += worker.total;

    let laborDetalle = "";

    Object.values(worker.labors).forEach((laborData) => {
      laborDetalle += laborData.labor + ": " + laborData.cantidad + "<br>";
    });

    html += "<tr>";
    html +=
      "<td>" + worker.name + "<br><small>" + laborDetalle + "</small></td>";
    html += "<td>" + daysWorked + "</td>";
    html += "<td>$" + worker.total.toLocaleString("es-CL") + "</td>";
    html += "</tr>";
  });

  html += "</table>";

  html +=
    "<h2>Total General del Mes: $" +
    totalGeneral.toLocaleString("es-CL") +
    "</h2>";

  container.innerHTML = html;
}
// =============================
// ðŸ” SESIÃ“N
// =============================

function focusFirstFieldInView() {
  const activeView = document.querySelector(".view:not(.hidden)");
  if (!activeView) {
    // ...existing code...
  }

  const firstField = activeView.querySelector(
    'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])',
  );

  if (firstField && typeof firstField.focus === "function") {
    firstField.focus();
  }
}

function closeFloatingUi() {
  // Si hay un modal personalizado abierto, no robar foco ni forzar scroll.
  if (document.querySelector(".custom-modal-overlay")) {
    return;
  }

  // Cierra listas de bÃºsqueda flotantes que pueden quedar sobre inputs.
  document
    .querySelectorAll(".worker-search-list, .mandante-worker-list")
    .forEach((list) => {
      list.style.display = "none";
    });

  // Si un modal quedÃ³ abierto por error, lo removemos para recuperar interacciÃ³n.
  const productionModal = document.getElementById("productionConfirmModal");
  if (productionModal) {
    productionModal.remove();
  }
}

function showView(id) {
  closeFloatingUi();

  document.querySelectorAll(".view").forEach(function (v) {
    v.classList.add("hidden");
  });

  document.getElementById(id).classList.remove("hidden");

  if (id === "viewContract" || id === "viewWeekly") {
    loadWorkers();
  }

  if (id === "viewCobrosMandante") {
    loadMandanteFundoFilter();
    showCalendarMandante();
  }

  focusFirstFieldInView(id);
}

window.addEventListener("resize", closeFloatingUi);
window.addEventListener("focus", closeFloatingUi);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    closeFloatingUi();
  }
});

document.addEventListener("pointerdown", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  // No intervenir clicks sobre botones para no romper acciones crÃ­ticas
  // (ej: inactivar trabajador) ni provocar scroll al inicio.
  if (target.closest("button")) return;

  const clickedInsideFloatingUi = target.closest(
    ".worker-search, .mandante-search, #productionConfirmModal, .custom-modal-overlay, .custom-modal-box",
  );

  if (!clickedInsideFloatingUi) {
    closeFloatingUi();
  }
});

// =============================
// ðŸ“‚ TOGGLE SUBMENU
// =============================
function toggleSubmenu(id) {
  const submenu = document.getElementById(id);
  const currentDisplay = window.getComputedStyle(submenu).display;

  if (currentDisplay === "none") {
    submenu.style.display = "block";
  } else {
    submenu.style.display = "none";
  }
}

// =============================
// ðŸ’¾ EXPORTAR RESPALDO
// =============================
function importData(event) {
  const file = event.target.files[0];

  if (!file) {
    alert("Seleccione un archivo de respaldo.");
    return;
  }

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);

      workers = data.workers || [];
      history = data.history || [];
      labors = data.labors || [];

      localStorage.setItem("workers", JSON.stringify(workers));
      localStorage.setItem("history", JSON.stringify(history));

      localStorage.setItem("labors", JSON.stringify(labors));

      loadWorkers();
      renderWorkersTable();
      renderHistory();
      loadLabors();

      alert("Respaldo importado correctamente.");
    } catch (error) {
      alert("Error al importar el respaldo.");

      console.error(error);
    }
  };

  reader.readAsText(file);
}
// =============================
// ðŸ—‘ï¸ ELIMINAR TRABAJADOR
// =============================

async function deleteWorker() {
  const selectedIndexValue = document.getElementById("workerEditSelect").value;
  console.log("editIndexWorker:", editIndexWorker);
  console.log("workerEditSelect.value:", selectedIndexValue);

  const index =
    selectedIndexValue !== ""
      ? Number(selectedIndexValue)
      : editIndexWorker !== null
        ? Number(editIndexWorker)
        : -1;

  if (!Number.isInteger(index) || index < 0 || !workers[index]) {
    await showCustomAlert("Seleccione un trabajador para eliminar.");
    return;
  }

  if (selectedIndexValue === "") {
    document.getElementById("workerEditSelect").value = String(index);
  }

  const workerIndex = index;
  const worker = workers[workerIndex];

  const ok = await showCustomConfirm(
    `¿Está seguro de eliminar a ${worker.name}? Esta acción borrará el trabajador de forma permanente.`,
  );

  if (!ok) return;

  if (storageClient) {
    let error = null;
    if (worker?.id) {
      const result = await storageClient.from("workers").delete().eq("id", worker.id);
      error = result?.error || null;
    } else {
      const result = await storageClient.from("workers").delete().eq("rut", worker.rut);
      error = result?.error || null;
    }

    if (error) {
      console.error("Error eliminando trabajador en almacenamiento local:", error.message);
      await showCustomAlert("Error al eliminar en la base de datos local.");
      return;
    }
  }

  workers.splice(workerIndex, 1);
  saveLocalDataDebounced();

  loadWorkers();
  renderWorkersTable();
  clearWorkerForm();

  await showCustomAlert(`Trabajador ${worker.name} eliminado correctamente.`);
}

function exportData() {
  const data = {
    workers,
    history,
    labors,
  };

  const json = JSON.stringify(data, null, 2);

  const blob = new Blob([json], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  const fecha = new Date().toISOString().split("T")[0];

  a.download = "respaldo_sistema_" + fecha + ".json";
  a.click();

  URL.revokeObjectURL(url);
}

function printMonthlyGeneral() {
  const container = document.getElementById("monthlyGeneralResult");

  if (!container || container.innerHTML.trim() === "") {
    alert("Primero debe calcular el mes.");
    return;
  }

  window.print();
}
function exportMonthlyGeneralExcel() {
  const container = document.getElementById("monthlyGeneralResult");

  if (!container || container.innerHTML.trim() === "") {
    alert("Primero debe calcular el mes.");
    return;
  }

  const month = document.getElementById("monthGeneral").value;

  const recordsRaw = history.filter((r) =>
    isHistoryRecordInMonth(r.date, month),
  );
  const records = dedupeHistoryRecords(recordsRaw);

  // ================================
  // RESUMEN POR TIPO DE LABOR
  // ================================

  const laborSummary = {};

  records.forEach((r) => {
    const laborName = getCanonicalLaborName(r.labor);
    const laborKey = getLaborKey(laborName);

    if (!laborSummary[laborKey]) {
      laborSummary[laborKey] = {
        labor: laborName,
        cantidad: 0,
        total: 0,
      };
    }

    laborSummary[laborKey].cantidad += r.quantity;
    laborSummary[laborKey].total += r.total;
  });

  if (records.length === 0) {
    alert("No hay datos para exportar.");
    return;
  }

  // Agrupar por trabajador
  const summary = {};

  records.forEach((r) => {
    if (!summary[r.rut]) {
      summary[r.rut] = {
        name: r.name,
        total: 0,
        dates: new Set(),
      };
    }

    summary[r.rut].total += r.total;
    summary[r.rut].dates.add(r.date);
  });

  // ===== CONSTRUIR CSV PROFESIONAL =====

  let csv = "";

  const fechaGeneracion = new Date().toLocaleDateString("es-CL");
  const responsable = "Contratista"; // puedes cambiarlo luego

  // ENCABEZADO EMPRESA
  csv += "SERVICIOS AGRÃCOLAS SAN GERÃ“NIMO SPA\n";
  csv += "RESUMEN MENSUAL GENERAL\n";
  csv += "Mes: " + month + "\n";
  csv += "Fecha de generaciÃ³n: " + fechaGeneracion + "\n";
  csv += "Responsable: " + responsable + "\n\n";

  // ================================
  // TABLA RESUMEN POR TRABAJADOR
  // ================================

  csv += "=== RESUMEN POR TRABAJADOR ===\n";
  csv += "Trabajador;Dias Trabajados;Total\n";

  let totalGeneral = 0;

  Object.values(summary).forEach((worker) => {
    const daysWorked = worker.dates.size;
    totalGeneral += worker.total;

    csv += worker.name + ";" + daysWorked + ";" + worker.total + "\n";
  });

  csv += "\nTotal General del Mes;;" + totalGeneral + "\n\n";

  // ================================
  // RESUMEN POR TIPO DE LABOR
  // ================================

  csv += "=== RESUMEN POR TIPO DE LABOR ===\n";
  csv += "Labor;Cantidad Total;Total $\n";

  Object.values(laborSummary).forEach((data) => {
    csv += data.labor + ";" + data.cantidad + ";" + data.total + "\n";
  });

  // LÃ­nea total general
  csv += "\nTotal General del Mes;;" + totalGeneral + "\n";

  // Crear archivo
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "Resumen_Mensual_General.csv";
  a.click();

  URL.revokeObjectURL(url);
}

// =============================
// ï¿½ COBROS MANDANTES - CALENDARIO
// =============================
var currentCalendarDateMandante = new Date();
var selectedDaysMandante = new Set();

function showCalendarMandante(year = null, month = null) {
  if (year === null || month === null) {
    year = currentCalendarDateMandante.getFullYear();
    month = currentCalendarDateMandante.getMonth();
  } else {
    currentCalendarDateMandante = new Date(year, month);
  }

  const monthNum = month;
  const daysInMonth = new Date(year, monthNum + 1, 0).getDate();
  const firstDay = new Date(year, monthNum, 1).getDay();

  const monthNames = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const dayNames = ["do", "lu", "ma", "mi", "ju", "vi", "sÃ¡"];

  let html =
    "<div style='width: 350px; border: 1px solid #ccc; border-radius: 8px; padding: 15px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);'>";

  html +=
    "<div style='display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;'>";
  html +=
    "<button type='button' class='btn-month-mandante' data-dir='-1' style='border: none; background: none; cursor: pointer; font-size: 20px; padding: 5px 10px; color: #333;'>â—€</button>";
  html +=
    "<span style='font-weight: bold; text-transform: capitalize;'>" +
    monthNames[monthNum] +
    " de " +
    year +
    "</span>";
  html +=
    "<button type='button' class='btn-month-mandante' data-dir='1' style='border: none; background: none; cursor: pointer; font-size: 20px; padding: 5px 10px; color: #333;'>â–¶</button>";
  html += "</div>";

  html +=
    "<div style='display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;'>";

  dayNames.forEach((day) => {
    html +=
      "<div style='text-align: center; font-weight: bold; padding: 8px; font-size: 12px; color: #666;'>" +
      day +
      "</div>";
  });

  for (let i = 0; i < firstDay; i++) {
    html += "<div style='padding: 8px;'></div>";
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const monthStr = String(monthNum + 1).padStart(2, "0");
    const dateStr = year + "-" + monthStr + "-" + String(day).padStart(2, "0");
    const isSelected = selectedDaysMandante.has(dateStr);
    const hasRecords = history.some((r) => r.date === dateStr);

    let bgColor = "transparent";
    let textColor = "#000";
    let fontWeight = "normal";

    if (isSelected) {
      bgColor = "#1a73e8";
      textColor = "white";
      fontWeight = "bold";
    } else if (hasRecords) {
      bgColor = "#e8f4fd";
      textColor = "#1a73e8";
    }

    html +=
      "<div class='calendar-day-mandante' data-date='" +
      dateStr +
      "' style='text-align:center; padding:8px; border-radius:50%; background:" +
      bgColor +
      "; color:" +
      textColor +
      "; font-weight:" +
      fontWeight +
      "; cursor:pointer; transition:all 0.2s;'>";
    html += day;
    html += "</div>";
  }

  html += "</div>";

  html +=
    "<div style='display: flex; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;'>";
  html +=
    "<button type='button' class='btn-clear-mandante' style='border: none; background: none; color: #1a73e8; cursor: pointer; font-weight: 500;'>Borrar</button>";
  html +=
    "<button type='button' class='btn-today-mandante' style='border: none; background: none; color: #1a73e8; cursor: pointer; font-weight: 500;'>Hoy</button>";
  html += "</div>";

  html += "</div>";

  document.getElementById("calendarMandante").innerHTML = html;

  // Asignar eventos CSP-compliant
  document.querySelectorAll(".btn-month-mandante").forEach((btn) => {
    btn.addEventListener("click", function () {
      changeMonthMandante(Number(this.getAttribute("data-dir")));
    });
  });
  document.querySelectorAll(".calendar-day-mandante").forEach((day) => {
    day.addEventListener("click", function () {
      toggleDayMandante(this.getAttribute("data-date"));
    });
  });
  const clearBtn = document.querySelector(".btn-clear-mandante");
  if (clearBtn) clearBtn.addEventListener("click", clearSelectedDaysMandante);
  const todayBtn = document.querySelector(".btn-today-mandante");
  if (todayBtn) todayBtn.addEventListener("click", todayDateMandante);
}

function toggleDayMandante(dateStr) {
  if (selectedDaysMandante.has(dateStr)) {
    selectedDaysMandante.delete(dateStr);
  } else {
    selectedDaysMandante.add(dateStr);
  }
  showCalendarMandante(
    currentCalendarDateMandante.getFullYear(),
    currentCalendarDateMandante.getMonth(),
  );
}

function changeMonthMandante(direction) {
  const year = currentCalendarDateMandante.getFullYear();
  const month = currentCalendarDateMandante.getMonth();

  const newDate = new Date(year, month + direction);
  showCalendarMandante(newDate.getFullYear(), newDate.getMonth());
}

function clearSelectedDaysMandante() {
  selectedDaysMandante.clear();
  document.getElementById("mandanteResult").innerHTML = "";
  showCalendarMandante(
    currentCalendarDateMandante.getFullYear(),
    currentCalendarDateMandante.getMonth(),
  );
}

function todayDateMandante() {
  currentCalendarDateMandante = new Date();
  showCalendarMandante();
}

function generateMandanteCobro() {
  const resultContainer = document.getElementById("mandanteResult");
  const fundoFilter = document.getElementById("mandanteFundoFilter");
  if (resultContainer) {
    resultContainer.innerHTML = "";
  }

  const selectedDates = Array.from(selectedDaysMandante);
  selectedDates.sort();

  if (selectedDates.length === 0) {
    alert("Seleccione al menos un día del calendario.");
    return;
  }

  const selectedFundo = fundoFilter ? fundoFilter.value : "";

  const records = history.filter((r) => {
    if (!selectedDates.includes(r.date)) {
      return false;
    }

    if (!selectedFundo) {
      return true;
    }

    return (getFundoKey(r.fundo) || "sin-fundo") === selectedFundo;
  });

  if (records.length === 0) {
    if (resultContainer) {
      resultContainer.innerHTML =
        "<p style='color:#666;'>No hay registros para las fechas seleccionadas.</p>";
    }
    showCustomAlert("No hay registros en los días seleccionados.");
    return;
    return;
  }

  const resumen = {};
  records.forEach((r) => {
    const fundoKey = getFundoKey(r.fundo) || "sin-fundo";
    const key = fundoKey + "|" + getLaborKey(r.labor);
    if (!resumen[key]) {
      resumen[key] = {
        fundo: getFundoDisplay(r.fundo, "-"),
        labor: r.labor,
        cantidad: 0,
        total: 0,
      };
    }
    resumen[key].cantidad += Number(r.quantity);
    resumen[key].total += Number(r.total);
  });

  let totalGeneral = 0;
  Object.values(resumen).forEach((r) => (totalGeneral += r.total));

  let html = "<h3>Cobro Mandante</h3>";
  html +=
    "<p><strong>Período:</strong> " +
    selectedDates[0] +
    " al " +
    selectedDates[selectedDates.length - 1] +
    "</p>";
  if (selectedFundo && fundoFilter) {
    const selectedOption = fundoFilter.options[fundoFilter.selectedIndex];
    html += "<p><strong>Fundo:</strong> " + selectedOption.text + "</p>";
  }

  html += "<table>";
  html +=
    "<tr><th>Fundo</th><th>Labor</th><th>Cantidad</th><th>Total</th></tr>";
  Object.values(resumen).forEach((r) => {
    html += "<tr>";
    html += "<td>" + r.fundo + "</td>";
    html += "<td>" + r.labor + "</td>";
    html += "<td>" + r.cantidad + "</td>";
    html += "<td>$" + r.total.toLocaleString("es-CL") + "</td>";
    html += "</tr>";
  });
  html += "</table>";

  html +=
    "<h2 style='margin-top:15px'>TOTAL: $" +
    totalGeneral.toLocaleString("es-CL") +
    "</h2>";

  if (resultContainer) {
    resultContainer.innerHTML = html;
  }
}

// =============================
// ðŸªª FORMATO RUT
// =============================

function formatRutInput(input) {
  let value = input.value.replace(/[^0-9kK]/g, "").toUpperCase();

  if (value.length <= 1) {
    input.value = value;
    return;
  }

  let body = value.slice(0, -1);
  let dv = value.slice(-1);

  body = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  input.value = body + "-" + dv;
}

// =============================
// ðŸ” LOGIN
// =============================

async function loginUser() {
  const pass = document.getElementById("password").value;

  if (pass === LOGIN_PASSWORD) {
    localStorage.setItem("sessionActive", "true");

    document.getElementById("login").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");

    const syncIndicator = document.getElementById("syncIndicator");
    if (syncIndicator) {
      syncIndicator.style.display = "none";
      syncIndicator.style.visibility = "hidden";
      syncIndicator.style.pointerEvents = "none";
      syncIndicator.remove();
    }

    // Ejecutar la sincronización en segundo plano, no bloquear la UI
    setTimeout(() => {
      initSystem();
    }, 0);
  } else {
    alert("Contraseña incorrecta");
  }
  
}

function logout() {
  localStorage.removeItem("sessionActive");
  location.reload();
}

// =============================
// ðŸš€ INIT
// =============================
async function initSystem() {
  if (isSyncInProgress) {
    console.log(
      "[LOCAL MODE] Inicializando sistema local: proceso ya en curso.",
    );
    return;
  }

  isSyncInProgress = true;
  const CLOUD_AUTO_FLOW_DISABLED_PHASE1 = true;
  const syncIndicator = document.getElementById("syncIndicator");
  console.log("[LOCAL MODE] Inicializando sistema local...");
  console.log("[LOCAL MODE] FASE 1.1 activa: modo local automático habilitado.");

  const hideSyncIndicator = () => {
    if (!syncIndicator) return;
    syncIndicator.style.display = "none";
    syncIndicator.style.visibility = "hidden";
    syncIndicator.style.pointerEvents = "none";
    syncIndicator.remove();
  };

  if (localStorage.getItem("sessionActive") !== "true") {
    hideSyncIndicator();
    isSyncInProgress = false;
    return;
  }

  if (navigator.onLine && storageClient) {
    if (syncIndicator) {
      syncIndicator.style.display = "flex";
      syncIndicator.style.pointerEvents = "none";
      // Failsafe: nunca dejar bloqueada la UI por carga local lenta
      setTimeout(hideSyncIndicator, 2500);
    }

    setTimeout(async () => {
      try {
        if (CLOUD_AUTO_FLOW_DISABLED_PHASE1) {
          console.log("[LOCAL MODE] Cargando datos locales (sin sync cloud automático).");
          console.log("[LOCAL MODE] workers:", workers.length);
          console.log("[LOCAL MODE] history:", history.length);
          console.log("[LOCAL MODE] labors:", labors.length);
          console.log("[LOCAL MODE] fundos:", fundos.length);
        } else {
          console.log("[LOCAL MODE] Cargando datos locales...");
          // CLOUD DISABLED - local mode migration
          // const pendingSyncResult =
          //   await syncPendingLocalDataBeforeCloudDownload();
          // console.log(
          //   "[initSystem] Resultado sync pendientes:",
          //   pendingSyncResult,
          // );

          // CLOUD DISABLED - local mode migration
          // if (pendingSyncResult.ok) {
          //   console.log("[LOCAL MODE] Cargando datos locales (workers)...");
          //   await loadWorkersFromCloud();
          //   console.log("[initSystem] Purga puntual de datos...");
          //   await runOneTimeDataPurge();

          //   console.log(
          //     "[LOCAL MODE] Cargando datos locales (history, background)...",
          //   );
          //   await loadHistoryFromCloud();
          //   console.log("[initSystem] Sincronización completa.");
          // CLOUD DISABLED - local mode migration
          // } else if (pendingSyncResult.reason === "storage_unreachable") {
          //   console.warn(
          //     "[LOCAL MODE] Se omite carga remota:",
          //     pendingSyncResult.errorMessage,
          //   );
          //   await notifyCloudUnavailableOnce(pendingSyncResult.errorMessage);
          // } else {
          //   console.error(
          //     "[LOCAL MODE] Error en carga de pendientes locales:",
          //     pendingSyncResult,
          //   );
          // }
        }
      } catch (e) {
        console.error("[initSystem] ExcepciÃ³n:", e);
      } finally {
        hideSyncIndicator();
        isSyncInProgress = false;

        // Forzar repaint en Electron para evitar congelamiento visual
        if (window.require) {
          setTimeout(() => {
            document.body.style.transform = "scale(1)";
          }, 10);
        }

        console.log("[LOCAL MODE] Datos locales listos.");
      }
    }, 0);
  } else {
    console.warn("[LOCAL MODE] Sin conexión o almacenamiento local no disponible.");
    hideSyncIndicator();
    isSyncInProgress = false;
  }

  loadLabors();
  loadFundos();
  loadFaenas();
  renderWorkersTable();
  loadAFPOptions();
  loadPagosWorkerFilter();
  console.log("[LOCAL MODE] UI base cargada y datos locales renderizados.");

}

// =============================
// ðŸ‘¨â€ðŸŒ¾ TRABAJADORES
// =============================

async function addWorker() {
  console.log("editIndexWorker:", editIndexWorker);

  // Diagnostico: verificar elemento nombre antes de leer
  const _nameEl = document.getElementById("workerName");
  console.log("INPUT NAME ELEMENT:", _nameEl);
  console.log("INPUT VALUE:", _nameEl?.value);

  // Leer directamente por ID real del formulario
  const workerName = (_nameEl?.value || "").trim();
  const workerRut = (document.getElementById("workerRut")?.value || "").trim();
  const account = document.getElementById("workerAccount")?.value || "";
  const birthDate = document.getElementById("workerBirthDate")?.value.trim() || "";
  const maritalStatus = document.getElementById("workerMaritalStatus")?.value.trim() || "";
  const address = document.getElementById("workerAddress")?.value.trim() || "";
  const afp = document.getElementById("workerAFP")?.value.trim() || "";
  const health = document.getElementById("workerHealth")?.value.trim() || "";
  const position = document.getElementById("workerPosition")?.value.trim() || "";
  const nationality = document.getElementById("workerNationality")?.value.trim() || "";
  const baseSalary = (document.getElementById("workerBaseSalary")?.value || "")
    .replace(/\$/g, "")
    .replace(/\./g, "");

  let photoUrl = null;
  console.log("NAME:", workerName);
  console.log("RUT:", workerRut);

  if (!workerName || !workerRut) {
    alert("Falta completar campos obligatorios (Nombre y RUT).");
    return;
  }
  // ðŸ”¹ VALIDAR RUT DUPLICADO (normalizado)
  const workerRutKey = getRutKey(workerRut);
  const currentEditIndex =
    editIndexWorker !== null ? Number(editIndexWorker) : -1;
  const rutIndex = workers.findIndex((w, index) => {
    if (index === currentEditIndex) return false;
    return getRutKey(w?.rut) === workerRutKey;
  });

  if (workerRutKey && rutIndex !== -1) {
    await showCustomAlert("Ya existe un trabajador registrado con ese RUT.");
    return;
  }

  // ðŸ”¹ Subir imagen si existe
  const fileInput = document.getElementById("workerIdPhoto");
  if (USE_STORAGE && fileInput && fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const fileName = Date.now() + "_" + file.name;
    const filePath = workerRut + "/" + fileName;

    const uploadResult = await uploadFileToWorkerStorage(filePath, file);

    console.log("UPLOAD ERROR:", uploadResult.error);

    if (uploadResult.ok) {
      const publicUrlData = storageClient.storage
        .from("worker-files")
        .getPublicUrl(filePath);

      photoUrl = publicUrlData.data.publicUrl;
      console.log("PHOTO URL GENERADA:", photoUrl);
    } else {
      console.error("Error subiendo imagen:", uploadResult.error);
      alert("No se pudo subir la imagen del trabajador. " + uploadResult.errorMessage);
    }
  }

  // ðŸ”¹ EDICIÃ“N
  if (editIndexWorker !== null) {
    workers[editIndexWorker] = {
      ...workers[editIndexWorker],
      name: workerName,
      rut: workerRut,
      birthDate,
      maritalStatus,
      address,
      afp,
      health,
      position,
      nationality,
      account_number: account,
      id_card_photo: photoUrl || workers[editIndexWorker].id_card_photo,
    };
    console.log("VALOR FINAL photoUrl:", photoUrl);
    if (USE_STORAGE && storageClient && workers[editIndexWorker]?.id) {
      const { data, error } = await storageClient
        .from("workers")
        .update({
          name: workerName,
          rut: workerRut,
          birthDate,
          maritalStatus,
          address,
          afp,
          health,
          position,
          nationality,
          account_number: account,
          id_card_photo: photoUrl || workers[editIndexWorker].id_card_photo,
        })
        .eq("id", workers[editIndexWorker].id);

      console.log("UPDATE RESULT:", data);
      console.log("UPDATE ERROR:", error);
    }

    editIndexWorker = null;
  }

  // ðŸ”¹ NUEVO TRABAJADOR
  else {
    const newWorker = {
      name: workerName,
      rut: workerRut,
      birthDate,
      maritalStatus,
      address,
      afp,
      health,
      position,
      nationality,
      baseSalary,
      account_number: account,
      id_card_photo: photoUrl,
    };

    workers.push(newWorker);

    if (USE_STORAGE && storageClient) {
      const cloudSaveResult = await saveWorkerToCloud(newWorker);
      if (cloudSaveResult?.ok) {
        console.log("Trabajador guardado en almacenamiento local");
      }
    }
  }

  saveLocalDataDebounced();

  clearWorkerForm();
  loadWorkers();
  renderWorkersTable();

  showCustomAlert("Trabajador guardado correctamente");
}
// =============================
// 📋 SELECTS
// =============================

function loadPagosWorkerFilter() {
  // El filtro ahora usa búsqueda dinámica, no hace falta poblar un select
}

function filterWorkersPagos() {
  const searchInput = document.getElementById("searchWorkerPagos");
  const list = document.getElementById("workerPagosList");
  const hiddenInput = document.getElementById("filterPaymentsWorker");

  if (!searchInput || !list || !hiddenInput) return;

  const search = searchInput.value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim();

  hiddenInput.value = "";
  list.innerHTML = "";

  if (search === "") {
    list.style.display = "none";
    return;
  }

  const currentValue = select.value;
  select.innerHTML = "<option value=''>-- Seleccionar fundo --</option>";

  fundos.forEach((f) => {
    const option = document.createElement("option");
    option.value = f;
    option.textContent = f;
    select.appendChild(option);
  });

  if (currentValue && fundos.includes(currentValue)) {
    select.value = currentValue;
  }
}
// =============================
// 🝦 CARGAR AFP EN SELECT
// =============================

function loadAFPOptions() {
  const select = document.getElementById("workerAFP");
  if (!select) return;

  // Limpiar por seguridad
  select.innerHTML = "<option value=''>-- Seleccionar AFP --</option>";

  Object.keys(afpRates).forEach((afp) => {
    const option = document.createElement("option");
    option.value = afp;
    option.textContent = afp;
    select.appendChild(option);
  });
}

function loadMandanteFundoFilter() {
  const select = document.getElementById("mandanteFundoFilter");
  if (!select) return;

  const currentValue = select.value;
  const fundoMap = new Map();

  history.forEach((record) => {
    const fundoKey = getFundoKey(record.fundo) || "sin-fundo";
    const fundoLabel = getFundoDisplay(record.fundo, "Sin fundo");

    if (!fundoMap.has(fundoKey)) {
      fundoMap.set(fundoKey, fundoLabel);
    }
  });

  select.innerHTML = "<option value=''>-- Todos los fundos --</option>";

  Array.from(fundoMap.entries())
    .sort((a, b) => a[1].localeCompare(b[1], "es"))
    .forEach(([key, label]) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = label;
      select.appendChild(option);
    });

  if (currentValue && fundoMap.has(currentValue)) {
    select.value = currentValue;
  }
}

// =============================
// 🛠︝ AUXILIARES
// =============================

function formatCurrency(input) {
  let value = input.value.replace(/\D/g, "");

  if (!value) {
    input.value = "";
    return;
  }

  input.value = "$" + Number(value).toLocaleString("es-CL");
}

function filterWorkersWeekly() {
  const searchInput = document.getElementById("searchWorkerWeekly");
  const resultsList = document.getElementById("workerWeeklyList");
  const hiddenSelect = document.getElementById("workerWeekly");

  if (!searchInput || !resultsList || !hiddenSelect) return;

  const search = searchInput.value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim();

  hiddenSelect.value = "";

  // Si estÃ¡ vacÃ­o, ocultar lista y limpiar selecciÃ³n
  if (search === "") {
    resultsList.style.display = "none";
    resultsList.innerHTML = "";
    hiddenSelect.value = "";
    document.getElementById("calendarContainer").innerHTML = "";
    document.getElementById("weeklyResult").innerHTML = "";
    return;
  }

  // Filtrar trabajadores
  const filtered = workers.filter((worker, index) => {
    const name = (worker.name || "").toLowerCase();
    const cleanRut = (worker.rut || "")
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/-/g, "");

    const matchRut = cleanRut.includes(search);
    const matchName = name.includes(search);

    return matchRut || matchName;
  });

  // Mostrar resultados
  if (filtered.length === 0) {
    resultsList.innerHTML =
      "<div style='padding: 10px; color: #999;'>No se encontraron resultados</div>";
    resultsList.style.display = "block";
    return;
  }

  let html = "";
  filtered.forEach((worker, i) => {
    const originalIndex = workers.indexOf(worker);
    html += `<div class="worker-weekly-item" data-index="${originalIndex}" data-name="${worker.name.replace(/"/g, "&quot;")}" style='padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;'>`;
    html += `<strong>${worker.name}</strong><br>`;
    html += `<small style='color: #666;'>${worker.rut}</small>`;
    html += "</div>";
  });

  resultsList.innerHTML = html;
  resultsList.style.display = "block";

  // Asignar eventos CSP-compliant
  resultsList.querySelectorAll(".worker-weekly-item").forEach((div) => {
    div.addEventListener("click", function () {
      selectWorkerWeekly(
        Number(this.getAttribute("data-index")),
        this.getAttribute("data-name"),
      );
    });
    div.addEventListener("mouseover", function () {
      this.style.background = "#f0f0f0";
    });
    div.addEventListener("mouseout", function () {
      this.style.background = "white";
    });
  });
}

function filterWorkersProduction() {
  const input = document
    .getElementById("searchWorkerProduction")
    .value.toLowerCase();

  const list = document.getElementById("workerProductionList");
  list.innerHTML = "";

  if (!input) {
    list.style.display = "none";
    return;
  }

  const filtered = workers.filter((w) => {
    if (w.active === false) return false;
    return (
      (w.name || "").toLowerCase().includes(input) ||
      (w.rut || "").toLowerCase().includes(input)
    );
  });

  filtered.forEach((w) => {
    const div = document.createElement("div");
    div.textContent = `${w.name} - ${w.rut}`;
    div.addEventListener("click", () => {
      document.getElementById("searchWorkerProduction").value = w.name;
      document.getElementById("workerSelect").value = workers.indexOf(w);
      list.style.display = "none";
    });
    list.appendChild(div);
  });

  list.style.display = "block";
}

function clearWorkerProductionSearch() {
  const searchInput = document.getElementById("searchWorkerProduction");
  const list = document.getElementById("workerProductionList");
  const hiddenSelect = document.getElementById("workerSelect");

  if (searchInput) searchInput.value = "";
  if (hiddenSelect) hiddenSelect.value = "";
  if (list) {
    list.style.display = "none";
    list.innerHTML = "";
  }
}

function filterWorkersContract() {
  const searchInput = document.getElementById("searchWorkerContract");
  const list = document.getElementById("workerContractList");
  const hiddenSelect = document.getElementById("workerContract");

  if (!searchInput || !list || !hiddenSelect) return;

  const search = searchInput.value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim();

  hiddenSelect.value = "";
  list.innerHTML = "";

  if (search === "") {
    list.style.display = "none";
    return;
  }

  const filtered = workers.filter((worker) => {
    const name = (worker.name || "").toLowerCase();
    const cleanRut = (worker.rut || "")
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/-/g, "");

    return name.includes(search) || cleanRut.includes(search);
  });

  if (filtered.length === 0) {
    list.innerHTML =
      "<div style='padding: 10px; color: #999;'>No se encontraron resultados</div>";
    list.style.display = "block";
    return;
  }

  filtered.forEach((worker) => {
    const div = document.createElement("div");
    div.innerHTML = `<strong>${worker.name || ""}</strong><br><small style='color:#666;'>${worker.rut || ""}</small>`;
    div.addEventListener("click", () => {
      const index = workers.indexOf(worker);
      hiddenSelect.value = index;
      searchInput.value = worker.name || "";
      list.style.display = "none";
      list.innerHTML = "";
    });
    list.appendChild(div);
  });

  list.style.display = "block";
}

function clearWorkerContractSearch() {
  const searchInput = document.getElementById("searchWorkerContract");
  const list = document.getElementById("workerContractList");
  const hiddenSelect = document.getElementById("workerContract");

  if (searchInput) searchInput.value = "";
  if (hiddenSelect) hiddenSelect.value = "";
  if (list) {
    list.style.display = "none";
    list.innerHTML = "";
  }

  // Limpiar solo datos del trabajador (mantener fecha/fundo/sueldo/jornada)
  document.getElementById("c_name").textContent =
    "_______________________________";
  document.getElementById("c_rut").textContent = "______________________";
  document.getElementById("c_maritalStatus").textContent =
    "______________________";
  document.getElementById("c_birthDate").textContent = "____ / ____ / ____";
  document.getElementById("c_address").textContent =
    "_________________________";
  document.getElementById("c_nationality").textContent =
    "______________________";
  document.getElementById("c_afp").textContent = "______________";
  document.getElementById("c_health").textContent = "____________";
  document.getElementById("c_workerSign").textContent = "________________";
}

function clearAllContract() {
  clearWorkerContractSearch();

  const startDate = document.getElementById("startDate");
  const faenaSelect = document.getElementById("faena");
  const newFaena = document.getElementById("newFaena");
  const fundoSelect = document.getElementById("fundoSelect");
  const newFundo = document.getElementById("newFundo");
  const workSchedule = document.getElementById("workSchedule");
  const salary = document.getElementById("salary");

  if (startDate) startDate.value = "";
  if (faenaSelect) faenaSelect.value = "";
  if (newFaena) newFaena.value = "";
  if (fundoSelect) fundoSelect.value = "";
  if (newFundo) newFundo.value = "";
  if (workSchedule) workSchedule.value = "";
  if (salary) salary.value = "";

  document.getElementById("c_day").textContent = "____";
  document.getElementById("c_month").textContent = "__________________";
  document.getElementById("c_year").textContent = "20____";
  document.getElementById("c_startDate").textContent = "___/___/20__";
  document.getElementById("c_faena").textContent = "________________________";
  document.getElementById("c_salary").textContent = "____________";

  const scheduleEl = document.getElementById("c_workSchedule");
  if (scheduleEl) {
    scheduleEl.textContent =
      "La jornada ordinaria de trabajo será¡ _______________________________.";
  }
}

function clearWorkerMonthlySearch() {
  const searchInput = document.getElementById("searchWorkerMonthly");
  const list = document.getElementById("workerMonthlyList");
  const hiddenSelect = document.getElementById("workerMonthly");

  if (searchInput) searchInput.value = "";
  if (hiddenSelect) hiddenSelect.value = "";
  if (list) {
    list.style.display = "none";
    list.innerHTML = "";
  }
}

function filterWorkersFiniquito() {
  const searchInput = document.getElementById("searchWorkerFiniquito");
  const list = document.getElementById("workerFiniquitoList");
  const hiddenSelect = document.getElementById("workerFiniquito");

  if (!searchInput || !list || !hiddenSelect) return;

  const search = searchInput.value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim();

  hiddenSelect.value = "";
  list.innerHTML = "";

  if (search === "") {
    list.style.display = "none";
    return;
  }

  const filtered = workers.filter((worker) => {
    const name = (worker.name || "").toLowerCase();
    const cleanRut = (worker.rut || "")
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/-/g, "");

    return name.includes(search) || cleanRut.includes(search);
  });

  if (filtered.length === 0) {
    list.innerHTML =
      "<div style='padding: 10px; color: #999;'>No se encontraron resultados</div>";
    list.style.display = "block";
    return;
  }

  filtered.forEach((worker) => {
    const div = document.createElement("div");
    div.innerHTML = `<strong>${worker.name || ""}</strong><br><small style='color:#666;'>${worker.rut || ""}</small>`;
    div.addEventListener("click", () => {
      const index = workers.indexOf(worker);
      hiddenSelect.value = index;
      searchInput.value = worker.name || "";
      document.getElementById("f_workerName").textContent = worker.name;
      const workerRecords = history
        .filter((r) => r.rut === worker.rut)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      if (workerRecords.length > 0) {
        const parts = workerRecords[0].date.split("-");
        const formatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
        document.getElementById("f_startDate").textContent = formatted;
      } else {
        document.getElementById("f_startDate").textContent =
          "____ / ____ / ______";
      }
      refreshFiniquitoResumen();
      list.style.display = "none";
      list.innerHTML = "";
    });
    list.appendChild(div);
  });

  list.style.display = "block";
}

function clearWorkerFiniquitoSearch() {
  const searchInput = document.getElementById("searchWorkerFiniquito");
  const list = document.getElementById("workerFiniquitoList");
  const hiddenSelect = document.getElementById("workerFiniquito");

  if (searchInput) searchInput.value = "";
  if (hiddenSelect) hiddenSelect.value = "";
  if (list) {
    list.style.display = "none";
    list.innerHTML = "";
  }
}

function filterWorkersLiquidation() {
  const input = document
    .getElementById("searchWorkerLiquidation")
    .value.toLowerCase();

  const hiddenSelect = document.getElementById("workerLiquidation");

  const list = document.getElementById("workerLiquidationList");
  list.innerHTML = "";

  if (hiddenSelect) {
    hiddenSelect.value = "";
  }

  if (!input) {
    hiddenSelect.value = "";
    list.style.display = "none";
    return;
  }

  const filtered = workers.filter(
    (w) =>
      (w.name || "").toLowerCase().includes(input) ||
      (w.rut || "").toLowerCase().includes(input),
  );

  if (filtered.length === 0) {
    list.innerHTML =
      "<div style='padding: 10px; color: #999;'>No se encontraron resultados</div>";
    list.style.display = "block";
    return;
  }

  filtered.forEach((w) => {
    const div = document.createElement("div");
    div.textContent = `${w.name} - ${w.rut}`;
    div.addEventListener("click", () => {
      clearTimeout(debounceTimer);
      console.log("LIQUIDATION WORKER CLICK:", w);
      const index = workers.indexOf(w);
      const workerLiquidation = hiddenSelect;
      if (workerLiquidation) {
        const targetValue = String(index);
        if (!workerLiquidation.querySelector(`option[value="${targetValue}"]`)) {
          const opt = document.createElement("option");
          opt.value = targetValue;
          opt.textContent = w.name || "";
          workerLiquidation.appendChild(opt);
        }
        workerLiquidation.value = targetValue;
        console.log("SETTING INPUT:", workerLiquidation);
        console.log("VALUE AFTER SET:", workerLiquidation.value);
      }
      document.getElementById("searchWorkerLiquidation").value = w.name;
      list.style.display = "none";
      list.innerHTML = "";
    });
    list.appendChild(div);
  });

  list.style.display = "block";
}
document.addEventListener(
  "mousedown",
  (event) => {
    event.stopPropagation();
  },
  true,
);

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerLiquidation");
  const list = document.getElementById("workerLiquidationList");
  const hiddenSelect = document.getElementById("workerLiquidation");

  if (!searchInput || !list || !hiddenSelect) return;

  const clickedInsideInput = searchInput.contains(event.target);
  const clickedInsideList = list.contains(event.target);

  if (clickedInsideInput || clickedInsideList) return;

  list.style.display = "none";
  list.innerHTML = "";

  if (!hiddenSelect.value) {
    searchInput.value = "";
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerWeekly");
  const list = document.getElementById("workerWeeklyList");
  const hiddenSelect = document.getElementById("workerWeekly");

  if (!searchInput || !list || !hiddenSelect) return;

  const clickedInsideInput = searchInput.contains(event.target);
  const clickedInsideList = list.contains(event.target);

  if (clickedInsideInput || clickedInsideList) return;

  list.style.display = "none";
  list.innerHTML = "";

  if (!hiddenSelect.value) {
    searchInput.value = "";
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerEdit");
  const list = document.getElementById("workerEditList");
  const hiddenSelect = document.getElementById("workerEditSelect");

  if (!searchInput || !list || !hiddenSelect) return;

  const clickedInsideInput = searchInput.contains(event.target);
  const clickedInsideList = list.contains(event.target);

  if (clickedInsideInput || clickedInsideList) return;

  list.style.display = "none";
  list.innerHTML = "";

  if (!hiddenSelect.value) {
    searchInput.value = "";
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerContract");
  const list = document.getElementById("workerContractList");
  const hiddenSelect = document.getElementById("workerContract");

  if (!searchInput || !list || !hiddenSelect) return;

  const clickedInsideInput = searchInput.contains(event.target);
  const clickedInsideList = list.contains(event.target);

  if (clickedInsideInput || clickedInsideList) return;

  list.style.display = "none";
  list.innerHTML = "";

  if (!hiddenSelect.value) {
    searchInput.value = "";
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerMonthly");
  const list = document.getElementById("workerMonthlyList");
  const hiddenSelect = document.getElementById("workerMonthly");

  if (!searchInput || !list || !hiddenSelect) return;

  const clickedInsideInput = searchInput.contains(event.target);
  const eventPath =
    typeof event.composedPath === "function" ? event.composedPath() : [];
  const clickedInsideList =
    list.contains(event.target) || eventPath.includes(list);

  if (clickedInsideInput || clickedInsideList) return;

  list.style.display = "none";
  list.innerHTML = "";

  if (!hiddenSelect.value) {
    searchInput.value = "";
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerFiniquito");
  const list = document.getElementById("workerFiniquitoList");
  const hiddenSelect = document.getElementById("workerFiniquito");

  if (!searchInput || !list || !hiddenSelect) return;

  const clickedInsideInput = searchInput.contains(event.target);
  const clickedInsideList = list.contains(event.target);

  if (clickedInsideInput || clickedInsideList) return;

  list.style.display = "none";
  list.innerHTML = "";

  if (!hiddenSelect.value) {
    searchInput.value = "";
  }
});

document.addEventListener("click", (event) => {
  if (event.target.closest("input, textarea, select")) return;
  const searchInput = document.getElementById("searchWorkerPagos");
  const list = document.getElementById("workerPagosList");
  if (!searchInput || !list) return;
  if (searchInput.contains(event.target) || list.contains(event.target)) return;
  list.style.display = "none";
  list.innerHTML = "";
});

function selectWorkerWeekly(index, name) {
  document.getElementById("workerWeekly").value = index;
  document.getElementById("searchWorkerWeekly").value = name;
  document.getElementById("workerWeeklyList").style.display = "none";
  document.getElementById("workerWeeklyList").innerHTML = "";

  // Limpiar dÃ­as seleccionados del trabajador anterior
  selectedDays.clear();

  // Limpiar el resumen si habÃ­a uno generado
  document.getElementById("weeklyResult").innerHTML = "";

  // Mostrar calendario automÃ¡ticamente
  showCalendar();
}

async function generateLiquidation() {
  const workerIndex = document.getElementById("workerLiquidation").value;
  const month = document.getElementById("monthLiquidation").value;

  if (workerIndex === "" || !month) {
    alert("Seleccione trabajador y mes.");
    return;
  }

  const worker = workers[workerIndex];

  // ===== PRODUCCIÃ“N DEL MES =====

  const recordsRaw = history.filter(
    (r) => r.rut === worker.rut && isHistoryRecordInMonth(r.date, month),
  );

  const records = dedupeHistoryRecords(recordsRaw);

  records.sort((a, b) => new Date(a.date) - new Date(b.date));
  const uniqueDates = [
    ...new Set(records.map((r) => getHistoryDateKey(r.date))),
  ];
  const daysWorked = uniqueDates.length;

  if (records.length === 0) {
    await showCustomAlert("No hay producción ese mes.");
    return;
  }

  const produccionReal = records.reduce((sum, r) => sum + r.total, 0);

  const minimumWageInput = document.getElementById("minimumWage");
  console.log("MINIMUM WAGE INPUT:", minimumWageInput?.value);
  const sueldoMinimoInputValue = Number(
    String(minimumWageInput?.value || "")
      .replace(/\$/g, "")
      .replace(/\./g, "")
      .replace(/,/g, "."),
  );
  const sueldoMinimoMensual =
    Number.isFinite(sueldoMinimoInputValue) && sueldoMinimoInputValue > 0
      ? Math.round(sueldoMinimoInputValue)
      : Number(localStorage.getItem("minimumWage") || 0);
  const [yearPart, monthPart] = month.split("-").map(Number);
  const diasDelMes =
    Number.isFinite(yearPart) && Number.isFinite(monthPart)
      ? new Date(yearPart, monthPart, 0).getDate()
      : 30;
  console.log({
    sueldoMinimoMensual,
    diasTrabajados: daysWorked,
    diasDelMes,
  });
  const sueldoBaseProporcional =
    sueldoMinimoMensual > 0 && diasDelMes > 0
      ? Math.round((sueldoMinimoMensual / diasDelMes) * daysWorked)
      : 0;
  const sueldoBase = sueldoBaseProporcional;
  const sueldoMinimoConfigurado = sueldoMinimoMensual;
  let bonoProduccion = produccionReal;
  let totalFinal = sueldoBase + bonoProduccion;

  if (sueldoMinimoConfigurado > 0 && totalFinal > sueldoMinimoConfigurado) {
    bonoProduccion = Math.max(0, sueldoMinimoConfigurado - sueldoBase);
    totalFinal = sueldoBase + bonoProduccion;
  }

  const baseImponible = totalFinal;

  // ===== DESCUENTOS =====

  const anticipos = Number(
    document.getElementById("advanceAmount").value.replace(/\./g, "") || 0,
  );

  const afpName = worker.afp || "";
  const comisionAFP = afpRates[afpName] || 0;
  const porcentajeAFP = AFP_BASE + comisionAFP;

  const afp = Math.round(baseImponible * porcentajeAFP);
  const salud = Math.round(baseImponible * 0.07);

  const totalDescuentos = afp + salud + anticipos;

  const liquido = totalFinal - totalDescuentos;

  console.log({
    sueldoBase,
    bonoProduccion,
    sueldoMinimoConfigurado,
    sueldoBaseProporcional,
    produccionReal,
    totalFinal,
  });

  // ===== DOCUMENTO HTML =====

  const html = `
<div class="liq-doc">

<h1>LIQUIDACIÓN DE SUELDO</h1>
<h3>${month}</h3>

<p><strong>Nombre:</strong> ${worker.name}</p>
<p><strong>RUT:</strong> ${worker.rut}</p>
<p><strong>Cargo:</strong> ${worker.position || "-"}</p>
<p><strong>AFP:</strong> ${worker.afp || "-"}</p>
<p><strong>Salud:</strong> ${worker.health || "-"}</p>
<p><strong>Días trabajados:</strong> ${daysWorked}</p>

<hr>

<h3>HABERES IMPONIBLES</h3>

<table>

<tr>
<td>SUELDO BASE</td>
<td>$${sueldoBaseProporcional.toLocaleString("es-CL")}</td>
</tr>

<tr>
<td>BONO DE PRODUCCIÓN</td>
<td>$${bonoProduccion.toLocaleString("es-CL")}</td>
</tr>

<tr>
<th>Total Final a Pagar</th>
<th>$${totalFinal.toLocaleString("es-CL")}</th>
</tr>
</table>

<h3>DESCUENTOS</h3>

<table>
<tr>
<td>AFP ${(porcentajeAFP * 100).toFixed(2)}%</td>
<td>$${afp.toLocaleString("es-CL")}</td>
</tr>

<tr>
<td>Salud 7%</td>
<td>$${salud.toLocaleString("es-CL")}</td>
</tr>

<tr>
<td>Anticipos del Mes</td>
<td>${formatMoney(anticipos)}</td>
</tr>

<tr>
<th>Total Descuentos</th>
<th>$${totalDescuentos.toLocaleString("es-CL")}</th>
</tr>
</table>

<h2>LÍQUIDO A PAGAR: ${formatMoney(liquido)}</h2>

<div style="margin-top:60px;text-align:center">
  <div style="border-top:1px solid #222;width:220px;margin:0 auto 4px auto;height:0"></div>
  <span style="font-size:15px">${worker.name}</span>
</div>

</div>
`;

  const container = document.getElementById("liquidationPrint");
  container.innerHTML = html;
  container.classList.remove("hidden");

  // ===== CREAR PDF =====

  const pdfBlob = await createPdfBlobFromHtml(html, {
    extraStyles: `
      .liq-doc {
        max-width: 760px;
        margin: 0 auto;
      }
    `,
    scale: 2,
  });

  if (!pdfBlob) {
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = "liquidacion_" + month + "_" + stamp + ".pdf";
  const filePath = worker.rut + "/" + fileName;

  // ===== SUBIR A almacenamiento local =====

  const uploadResult = await uploadFileToWorkerStorage(
    filePath,
    pdfBlob,
    "application/pdf",
  );

  if (!uploadResult.ok) {
    console.error("Error subiendo liquidación:", uploadResult.error);
    await showCustomAlert(
      "⚠️ No se guardó en nube la liquidación. " + uploadResult.errorMessage,
    );
  } else {
    console.log("Liquidación guardada en almacenamiento local");
    await showCustomAlert("✅ Liquidación guardada en almacenamiento local OK");
  }
}

function getDocumentBaseStyles() {
  return `
    body {
      font-family: "Segoe UI", Tahoma, sans-serif;
      background: white;
      margin: 20px;
      color: black;
    }

    .liquidacion-doc {
      background: white;
      padding: 30px;
      margin-top: 20px;
      color: black;
      border-radius: 10px;
    }

    .liquidacion-doc h1,
    .liquidacion-doc h3 {
      text-align: center;
      margin-bottom: 10px;
    }

    .liquidacion-doc table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }

    .liquidacion-doc th,
    .liquidacion-doc td {
      border: 1px solid black;
      padding: 6px;
      text-align: center;
    }

    .liq-doc {
      background: white;
      padding: 40px;
      color: black;
      max-width: 800px;
      margin: auto;
      font-size: 11px;
    }

    .liq-doc h1,
    .liq-doc h3 {
      text-align: center;
    }

    .liq-doc table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }

    .liq-doc td,
    .liq-doc th {
      border: 1px solid black;
      padding: 6px;
    }

    #contractPrint {
      background: white;
      padding: 40px;
      margin-top: 10px;
      color: black;
      line-height: 1;
      font-family: "Times New Roman", serif;
      font-size: 16px;
    }

    #contractPrint p {
      margin: 4px 0;
      text-align: justify;
      line-height: 1.2;
    }

    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 20px;
    }

    .sign {
      width: 45%;
      text-align: center;
    }

    .line {
      border-top: 1px solid black;
      width: 250px;
      margin: 0 auto 10px;
    }

    .sign-name,
    .sign-role,
    .sign-rut {
      width: 250px;
      text-align: center;
      margin: 2px auto;
    }

    .sign-name {
      font-weight: bold;
    }

    .sign-rut {
      font-size: 12px;
    }

    @media print {
      body {
        margin: 0;
      }
    }
  `;
}

async function createPdfBlobFromHtml(
  contentHtml,
  { extraStyles = "", scale = 2 } = {},
) {
  const exportRoot = document.createElement("div");

  exportRoot.style.position = "fixed";
  exportRoot.style.left = "-99999px";
  exportRoot.style.top = "0";
  exportRoot.style.width = "794px";
  exportRoot.style.background = "#fff";
  exportRoot.style.padding = "20px";
  exportRoot.style.zIndex = "-1";

  exportRoot.innerHTML = `
    <style>${getDocumentBaseStyles()}${extraStyles}</style>
    ${contentHtml}
  `;

  document.body.appendChild(exportRoot);

  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    const blob = await createPdfBlobFromElement(exportRoot, { scale });
    return blob;
  } finally {
    if (exportRoot.parentNode) {
      exportRoot.parentNode.removeChild(exportRoot);
    }
  }
}

async function createPdfBlobFromElement(element, { scale = 2 } = {}) {
  const { jsPDF } = window.jspdf;

  const canvas = await Promise.race([
    html2canvas(element, {
      scale,
      backgroundColor: "#ffffff",
    }),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Timeout al renderizar PDF")), 25000);
    }),
  ]);

  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF("p", "mm", "a4");

  const imgWidth = 210;
  const pageHeight = 297;

  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;

  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);

  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;

    pdf.addPage();

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);

    heightLeft -= pageHeight;
  }

  return pdf.output("blob");
}

function openScreenPrintWindow({ title, contentHtml, extraStyles = "" }) {
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    alert(
      "No se pudo abrir la ventana de impresión. Verifique bloqueadores de ventanas emergentes.",
    );
    return;
  }

  const baseStyles = getDocumentBaseStyles();

  printWindow.document.open();
  printWindow.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>${title}</title>
        <style>${baseStyles}${extraStyles}</style>
      </head>
      <body>
        ${contentHtml}
      </body>
    </html>
  `);
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

function printLiquidationScreen() {
  const container = document.getElementById("liquidationPrint");

  if (!container || !container.innerHTML.trim()) {
    alert("Primero genere la liquidación para imprimir.");
    return;
  }

  openScreenPrintWindow({
    title: "Liquidación de Sueldo",
    contentHtml: container.outerHTML,
  });
}


function printMandanteCobro() {
  const resultContainer = document.getElementById("mandanteResult");

  if (!resultContainer || !resultContainer.innerHTML.trim()) {
    generateMandanteCobro();
  }

  const content = resultContainer?.innerHTML?.trim();

  if (!content) {
    alert("Primero genere el cobro mandante para imprimir.");
    return;
  }

  const printHtml = `
    <div style="max-width: 900px; margin: 0 auto; font-family: Arial, sans-serif;">
      ${content}
    </div>
  `;

  openScreenPrintWindow({
    title: "Cobro Mandante",
    contentHtml: printHtml,
    extraStyles: `
      @page {
        size: letter;
        margin: 1cm;
      }
      body {
        margin: 0;
        padding: 0;
        background: white;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
      }
      th, td {
        border: 1px solid #ddd;
        padding: 6px 8px;
        text-align: left;
      }
      th {
        background: #f5f5f5;
      }
    `,
  });
}function printContractScreen() {
  const container = document.getElementById("contractPrint");

  if (!container || !container.innerHTML.trim()) {
    alert("No hay contrato para imprimir.");
    return;
  }

  openScreenPrintWindow({
    title: "Contrato de Trabajo de Temporada",
    contentHtml: container.outerHTML,
    extraStyles: `
      @page {
        size: letter;
        margin: 1.2cm 1.5cm;
      }
      body {
        margin: 0;
        padding: 0;
      }
      #contractPrint {
        padding: 0;
        margin: 0 auto;
        max-width: 740px;
        font-family: "Times New Roman", serif;
        font-size: 15px;
        line-height: 1.35;
      }
      #contractPrint .titulo-contrato {
        text-align: center;
        font-size: 16px;
        margin: 0 0 6px 0;
        text-align: center;
      }
      #contractPrint h3 {
        font-size: 13px;
        margin: 2px 0;
        text-align: center;
      }
      #contractPrint br {
        display: none;
      }
      .signatures {
        margin-top: 60px;
      }
      .line {
        width: 200px;
        margin: 0 auto 10px;
      }
      .sign-name,
      .sign-role,
      .sign-rut {
        width: 200px;
        font-size: 13px;
      }
    `,
  });
}

async function generateContract() {
  const workerIndex = document.getElementById("workerContract").value;

  if (workerIndex === "") {
    console.warn("Seleccione un trabajador");
    return;
    return;
  }

  const worker = workers[workerIndex];
  const faenaSelect = document.getElementById("faena");
  const newFaenaInput = document.getElementById("newFaena");
  const selectedFaena = (faenaSelect?.value || "").trim();
  const newFaena = (newFaenaInput?.value || "").trim();
  const contractFaena = newFaena || selectedFaena;

  if (
    newFaena &&
    !faenas.some((f) => f.toLowerCase() === newFaena.toLowerCase())
  ) {
    faenas.push(newFaena);
    localStorage.setItem("faenas", JSON.stringify(faenas));
    loadFaenas();
    if (faenaSelect) faenaSelect.value = newFaena;
  }

  const fundoSelect = document.getElementById("fundoSelect");
  const newFundoInput = document.getElementById("newFundo");
  const selectedFundo = (fundoSelect?.value || "").trim();
  const newFundo = (newFundoInput?.value || "").trim();
  const contractFundo = newFundo || selectedFundo;

  if (
    newFundo &&
    !fundos.some((f) => f.toLowerCase() === newFundo.toLowerCase())
  ) {
    fundos.push(newFundo);
    localStorage.setItem("fundos", JSON.stringify(fundos));
    loadFundos();
    if (fundoSelect) fundoSelect.value = newFundo;
  }

  // ðŸ”¹ COMPLETAR NOMBRE Y RUT
  document.getElementById("c_name").textContent = worker.name;
  document.getElementById("c_rut").textContent = worker.rut;
  document.getElementById("c_faena").textContent =
    contractFaena || "________________________";
  document.getElementById("c_workerSign").textContent = worker.name;

  const workScheduleInput = document.getElementById("workSchedule");
  const workScheduleValue = (workScheduleInput?.value || "").trim();
  const workScheduleElement = document.getElementById("c_workSchedule");
  if (workScheduleElement && workScheduleValue) {
    const fixedPrefix = "La jornada ordinaria de trabajo será¡ ";
    const normalized = workScheduleValue
      .toLowerCase()
      .startsWith(fixedPrefix.toLowerCase())
      ? workScheduleValue
      : fixedPrefix + workScheduleValue;
    workScheduleElement.textContent = normalized;
  }

  // ðŸ”¹ AQUÃ VA EL PASO 2 ðŸ‘‡

  const startDate = document.getElementById("startDate").value.trim();

  if (!startDate) {
    alert("Ingrese la fecha del contrato.");
    return;
  }

  const [day, monthNumber, year] = startDate.split("/");

  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  const month = months[parseInt(monthNumber) - 1];

  document.getElementById("c_day").textContent = day || "__";
  document.getElementById("c_month").textContent = month || "__________";
  document.getElementById("c_year").textContent = year || "____";
  document.getElementById("c_startDate").textContent =
    startDate || "___/___/20__";
  document.getElementById("c_nationality").textContent =
    worker.nationality || "Chilena";
  document.getElementById("c_maritalStatus").textContent =
    worker.maritalStatus || "______________________";
  document.getElementById("c_address").textContent =
    worker.address || "_________________________";
  document.getElementById("c_afp").textContent = worker.afp || "______________";
  document.getElementById("c_health").textContent = worker.health || "____________";

  const salaryInput = document.getElementById("salary").value.trim();

  const formattedSalary = formatCLPCurrency(salaryInput);

  document.getElementById("c_salary").textContent =
    formattedSalary || "____________";

  document.getElementById("c_birthDate").textContent =
    worker.birthDate || "____ / ____ / ____";

  await showCustomAlert("Contrato completado correctamente.");

  const contractContainer = document.getElementById("contractPrint");
  const pdfBlob = await createPdfBlobFromHtml(contractContainer.outerHTML, {
    extraStyles: `
      #contractPrint {
        padding: 0;
        margin: 0 auto;
        max-width: 740px;
        font-family: "Times New Roman", serif;
        font-size: 15px;
        line-height: 1.35;
      }

      #contractPrint .titulo-contrato {
        text-align: center;
        font-size: 16px;
        margin: 0 0 6px 0;
        text-align: center;
      }

      #contractPrint p,
      #contractPrint .clausula {
        margin: 2px 0;
        text-align: justify;
        line-height: 1.35;
      }

      #contractPrint h3 {
        margin: 3px 0;
        font-size: 14px;
        text-align: center;
      }

      #contractPrint br {
        display: none;
      }

      #contractPrint .signatures {
        margin-top: 104px;
      }
    `,
    scale: 2,
  });

  if (!pdfBlob) {
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = "contrato_" + worker.rut + "_" + stamp + ".pdf";

  const filePath = worker.rut + "/" + fileName;

  const uploadResult = await uploadFileToWorkerStorage(
    filePath,
    pdfBlob,
    "application/pdf",
  );

  if (!uploadResult.ok) {
    console.error("Error subiendo contrato:", uploadResult.error);
    alert(
      "⚠️ No se guardó en nube el contrato. " + uploadResult.errorMessage,
    );
  } else {
    console.log("Contrato guardado en almacenamiento local");
    showCustomAlert("✅ Contrato guardado en almacenamiento local OK");
  }
}
function calcularTotalPagadoFiniquito(worker, inicio, fin) {
  if (!worker || !inicio || !fin) return 0;

  const inicioValido = DateHelper.isISO(inicio) || DateHelper.isCLAny(inicio);
  const finValido = DateHelper.isISO(fin) || DateHelper.isCLAny(fin);

  if (!inicioValido || !finValido) return 0;

  let total = 0;
  for (const record of history) {
    if (!record || record.rut !== worker.rut || record.paid !== true) continue;
    if (!DateHelper.isBetween(record.date, inicio, fin)) continue;

    const value = Number(record.total);
    if (!Number.isFinite(value)) continue;

    total += value;
  }

  return total;
}

function normalizeWorkerForDocs(worker) {
  const safe = worker && typeof worker === "object" ? worker : {};

  const safeName = String(safe.name || "")
    .trim()
    .slice(0, 120);
  const safeRut = String(safe.rut || "")
    .trim()
    .slice(0, 25);
  const safePosition = String(safe.position || "-")
    .trim()
    .slice(0, 80);

  return {
    name: safeName,
    rut: safeRut,
    position: safePosition || "-",
  };
}

function refreshFiniquitoResumen() {
  const totalElement = document.getElementById("f_totalLiquido");
  if (!totalElement) return;

  const workerIndex = document.getElementById("workerFiniquito")?.value;
  const inicio = (
    document.getElementById("f_startDate")?.textContent || ""
  ).trim();
  const fin = (document.getElementById("f_endDate")?.value || "").trim();

  const finCompleto = DateHelper.isISO(fin) || DateHelper.isCLAny(fin);

  if (
    workerIndex === "" ||
    !inicio ||
    !fin ||
    inicio.includes("_") ||
    !finCompleto
  ) {
    totalElement.textContent = "$ _______________________";
    return;
  }

  const worker = workers[workerIndex];
  const sueldoMinimo = Number(localStorage.getItem("minimumWage") || 0);
  const totalCalculado = calcularTotalPagadoFiniquito(worker, inicio, fin);
  const totalPagado =
    sueldoMinimo > 0
      ? Math.min(totalCalculado, sueldoMinimo)
      : totalCalculado;
  totalElement.textContent = `$ ${totalPagado.toLocaleString("es-CL")}`;
}

async function generateFiniquito() {
  if (isGeneratingFiniquito) {
    alert("Ya se está generando un finiquito. Espere un momento.");
    return;
  }

  const workerIndex = document.getElementById("workerFiniquito").value;

  if (workerIndex === "") {
    console.warn("Seleccione un trabajador");
    return;
    return;
  }

  const rawWorker = workers[workerIndex];
  if (!rawWorker || typeof rawWorker !== "object") {
    alert("El trabajador seleccionado no es válido. Vuelva a seleccionarlo.");
    return;
  }

  const worker = normalizeWorkerForDocs(rawWorker);
  if (!worker.name || !worker.rut) {
    alert(
      "El trabajador tiene datos incompletos (Nombre/RUT). Corrija el registro antes de generar el finiquito.",
    );
    return;
  }

  isGeneratingFiniquito = true;

  try {
    const endDate = (document.getElementById("f_endDate")?.value || "").trim();

    syncFiniquitoEndDate(endDate);

    const inicio = (
      document.getElementById("f_startDate")?.textContent || ""
    ).trim();
    const fin = (document.getElementById("f_endDate")?.value || "").trim();
    const sueldoMinimo = Number(localStorage.getItem("minimumWage") || 0);
    const totalCalculado = calcularTotalPagadoFiniquito(rawWorker, inicio, fin);
    const totalPagado =
      sueldoMinimo > 0
        ? Math.min(totalCalculado, sueldoMinimo)
        : totalCalculado;

    const today = new Date().toLocaleDateString("es-CL");

    const html = `
  <div id="finiquitoDoc">

  <h1 style="text-align:center;">FINIQUITO DE TRABAJO</h1>

  <p>En conformidad a lo dispuesto en la legislación laboral vigente, se deja constancia que:</p>

  <p><strong>Trabajador:</strong> ${worker.name}</p>
  <p><strong>RUT:</strong> ${worker.rut}</p>
  <p><strong>Cargo:</strong> ${worker.position || "-"}</p>
  <p><strong>Servicios prestados desde:</strong> ${inicio || "__________"} <strong>hasta:</strong> ${fin || "__________"}</p>
  <p><strong>Fecha de terminación:</strong> ${endDate || "__________"}</p>

  <br>

  <p>Declara haber recibido de su empleador todas las remuneraciones, pagos y beneficios que le correspondían por su trabajo realizado.</p>

  <h3 style="text-align:center; margin-top:18px;">TOTAL LÍQUIDO A PAGAR SEGÚN DETALLE LIQUIDACIÓN</h3>
  <h2 style="text-align:center;">$ ${totalPagado.toLocaleString("es-CL")}</h2>

  <br><br>

  <p>Firmado en conformidad.</p>

  <br><br>

  <p>Fecha: ${today}</p>

  <br><br><br>

  <div style="display:flex; justify-content:space-between;">

  <div style="text-align:center;">
  <div style="border-top:1px solid black; width:200px;"></div>
  <p>Firma Trabajador</p>
  <p>${worker.name}</p>
  <p>${worker.rut}</p>
  </div>

  <div style="text-align:center;">
  <div style="border-top:1px solid black; width:200px;"></div>
  <p>Firma Empleador</p>
  </div>

  </div>

  </div>
  `;

    const pdfBlob = await createPdfBlobFromHtml(html, {
      scale: 2,
    });

    if (!pdfBlob) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");

    const fileName = "finiquito_" + worker.rut + "_" + stamp + ".pdf";

    const filePath = worker.rut + "/" + fileName;

    const uploadResult = await uploadFileToWorkerStorage(
      filePath,
      pdfBlob,
      "application/pdf",
    );

    if (!uploadResult.ok) {
      console.error("Error subiendo finiquito:", uploadResult.error);
      alert(
        "⚠️ No se guardó en nube el finiquito. " + uploadResult.errorMessage,
      );
    } else {
      console.log("Finiquito guardado en almacenamiento local");
      showCustomAlert("✅ Finiquito guardado en almacenamiento local OK");
    }
  } catch (error) {
    console.error("Error generando finiquito:", error);
    alert("⚠️ Ocurrió un error al generar el finiquito. Intente nuevamente.");
  } finally {
    isGeneratingFiniquito = false;
  }
}

function syncFiniquitoEndDate(value) {
  const endDatePrint = document.getElementById("f_endDatePrint");
  if (!endDatePrint) return;

  const normalizedValue = (value || "").trim();
  endDatePrint.textContent = normalizedValue || "__________";

  // Rellenar encabezado "En San Clemente, a __ de ___ de ____"
  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const parts = normalizedValue.split("/");
  const dayEl = document.getElementById("f_headerDay");
  const monthEl = document.getElementById("f_headerMonth");
  const yearEl = document.getElementById("f_headerYear");
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    const day = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const year = parts[2];
    if (dayEl) dayEl.textContent = day || "____";
    if (monthEl)
      monthEl.textContent = months[monthIndex] || "__________________";
    if (yearEl) yearEl.textContent = year || "20____";
  } else {
    if (dayEl) dayEl.textContent = "____";
    if (monthEl) monthEl.textContent = "__________________";
    if (yearEl) yearEl.textContent = "20____";
  }

  refreshFiniquitoResumen();
}

function generateMonthlySummary() {
  const searchInput = document.getElementById("searchWorkerMonthly");
  const hiddenSelect = document.getElementById("workerMonthly");
  const workerIndex = document.getElementById("workerMonthly").value;

  const month = document.getElementById("monthMonthly").value;

  console.log("[MonthlySummary] before validation", {
    searchInputValue: (searchInput?.value || "").trim(),
    hiddenSelectValue: (hiddenSelect?.value || "").trim(),
    monthValue: (month || "").trim(),
  });

  if (workerIndex === "" || !month) {
    showCustomAlert("Seleccione trabajador y mes.");
    return;
  }

  const worker = workers[workerIndex];

  const recordsRaw = history.filter(
    (r) => r.rut === worker.rut && isHistoryRecordInMonth(r.date, month),
  );

  const records = dedupeHistoryRecords(recordsRaw);

  const container = document.getElementById("monthlyResult");

  if (records.length === 0) {
    container.innerHTML = "<p>No hay producción ese mes.</p>";
    return;
  }

  // ===== CALCULAR DÍAS TRABAJADOS =====
  const uniqueDates = [
    ...new Set(records.map((r) => getHistoryDateKey(r.date))),
  ];
  const daysWorked = uniqueDates.length;

  let total = 0;

  let html = "<h3>Detalle del Mes</h3>";
  html += "<table>";
  html +=
    "<tr><th>Fecha</th><th>Labor</th><th>Cantidad</th><th>Total</th></tr>";

  records.forEach((r) => {
    total += r.total;

    html += "<tr>";
    html += "<td>" + r.date + "</td>";
    html += "<td>" + r.labor + "</td>";
    html += "<td>" + r.quantity + "</td>";
    html += "<td>$" + Number(r.total).toLocaleString("es-CL") + "</td>";
    html += "</tr>";
  });

  html += "</table>";

  html += "<p><strong>Días trabajados:</strong> " + daysWorked + "</p>";
  html += "<h2>Total del Mes: $" + total.toLocaleString("es-CL") + "</h2>";

  container.innerHTML = html;
}

function generateMonthlyGeneral() {
  const month = document.getElementById("monthGeneral").value;

  if (!month) {
    alert("Seleccione un mes.");
    return;
  }

  const recordsRaw = history.filter((r) =>
    isHistoryRecordInMonth(r.date, month),
  );
  const records = dedupeHistoryRecords(recordsRaw);

  const container = document.getElementById("monthlyGeneralResult");

  if (records.length === 0) {
    container.innerHTML = "<p>No hay producción ese mes.</p>";
    return;
  }

  // Agrupar por RUT
  const summary = {};

  // ===== RESUMEN GENERAL POR LABOR DEL MES =====
  const laborSummary = {};

  records.forEach((r) => {
    const laborName = getCanonicalLaborName(r.labor);
    const laborKey = getLaborKey(laborName);

    if (!summary[r.rut]) {
      summary[r.rut] = {
        name: r.name,
        total: 0,
        dates: new Set(),
        labors: {},
      };
    }
    if (!laborSummary[laborKey]) {
      laborSummary[laborKey] = {
        labor: laborName,
        cantidad: 0,
        total: 0,
      };
    }
    laborSummary[laborKey].cantidad += r.quantity;
    laborSummary[laborKey].total += r.total;

    summary[r.rut].total += r.total;
    summary[r.rut].dates.add(getHistoryDateKey(r.date));
    if (!summary[r.rut].labors[laborKey]) {
      summary[r.rut].labors[laborKey] = {
        labor: laborName,
        cantidad: 0,
      };
    }
    summary[r.rut].labors[laborKey].cantidad += r.quantity;
  });

  let html = "<h3>Resumen General del Mes</h3>";

  // ===== MOSTRAR RESUMEN GENERAL POR LABOR =====
  html += "<h4>Labores realizadas en el mes</h4>";
  html += "<div class='table-container'><table>";
  html += "<tr><th>Labor</th><th>Cantidad</th><th>Total</th></tr>";

  Object.values(laborSummary).forEach((data) => {
    html += "<tr>";
    html += "<td>" + data.labor + "</td>";
    html += "<td>" + data.cantidad + "</td>";
    html += "<td>$" + data.total.toLocaleString("es-CL") + "</td>";
    html += "</tr>";
  });

  html += "</table></div>";

  html += "<table>";
  html += "<tr><th>Trabajador</th><th>Días</th><th>Total</th></tr>";

  let totalGeneral = 0;

  Object.values(summary).forEach((worker) => {
    const daysWorked = worker.dates.size;

    totalGeneral += worker.total;

    let laborDetalle = "";

    Object.values(worker.labors).forEach((laborData) => {
      laborDetalle += laborData.labor + ": " + laborData.cantidad + "<br>";
    });

    html += "<tr>";
    html +=
      "<td>" + worker.name + "<br><small>" + laborDetalle + "</small></td>";
    html += "<td>" + daysWorked + "</td>";
    html += "<td>$" + worker.total.toLocaleString("es-CL") + "</td>";
    html += "</tr>";
  });

  html += "</table>";

  html +=
    "<h2>Total General del Mes: $" +
    totalGeneral.toLocaleString("es-CL") +
    "</h2>";

  container.innerHTML = html;
}
// =============================
// ðŸ” SESIÃ“N
// =============================

window.onload = function () {
  if (localStorage.getItem("sessionActive") === "true") {
    document.getElementById("login").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");

    setTimeout(() => {
      initSystem();
    }, 0);
  } else {
    const syncIndicator = document.getElementById("syncIndicator");
    if (syncIndicator) {
      syncIndicator.style.display = "none";
      syncIndicator.style.visibility = "hidden";
      syncIndicator.style.pointerEvents = "none";
      syncIndicator.remove();
    }
  }
};

function focusFirstFieldInView() {
  const activeView = document.querySelector(".view:not(.hidden)");
  if (!activeView) {
    // ...existing code...
  }

  const firstField = activeView.querySelector(
    'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])',
  );

  if (firstField && typeof firstField.focus === "function") {
    firstField.focus();
  }
}

function closeFloatingUi() {
  // Si hay un modal personalizado abierto, no robar foco ni forzar scroll.
  if (document.querySelector(".custom-modal-overlay")) {
    return;
  }

  // Cierra listas de bÃºsqueda flotantes que pueden quedar sobre inputs.
  document
    .querySelectorAll(".worker-search-list, .mandante-worker-list")
    .forEach((list) => {
      list.style.display = "none";
    });

  // Si un modal quedÃ³ abierto por error, lo removemos para recuperar interacciÃ³n.
  const productionModal = document.getElementById("productionConfirmModal");
  if (productionModal) {
    productionModal.remove();
  }
}

function showView(id) {
  closeFloatingUi();

  document.querySelectorAll(".view").forEach(function (v) {
    v.classList.add("hidden");
  });

  document.getElementById(id).classList.remove("hidden");

  if (id === "viewContract" || id === "viewWeekly") {
    loadWorkers();
  }

  if (id === "viewCobrosMandante") {
    loadMandanteFundoFilter();
    showCalendarMandante();
  }

  focusFirstFieldInView(id);
}

window.addEventListener("resize", closeFloatingUi);
window.addEventListener("focus", closeFloatingUi);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    closeFloatingUi();
  }
});

document.addEventListener("pointerdown", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  // No intervenir clicks sobre botones para no romper acciones crÃ­ticas
  // (ej: inactivar trabajador) ni provocar scroll al inicio.
  if (target.closest("button")) return;

  const clickedInsideFloatingUi = target.closest(
    ".worker-search, .mandante-search, #productionConfirmModal, .custom-modal-overlay, .custom-modal-box",
  );

  if (!clickedInsideFloatingUi) {
    closeFloatingUi();
  }
});

// =============================
// ðŸ“‚ TOGGLE SUBMENU
// =============================
function toggleSubmenu(id) {
  const submenu = document.getElementById(id);
  const currentDisplay = window.getComputedStyle(submenu).display;

  if (currentDisplay === "none") {
    submenu.style.display = "block";
  } else {
    submenu.style.display = "none";
  }
}

// =============================
// ðŸ’¾ EXPORTAR RESPALDO
// =============================
function importData(event) {
  const file = event.target.files[0];

  if (!file) {
    alert("Seleccione un archivo de respaldo.");
    return;
  }

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);

      workers = data.workers || [];
      history = data.history || [];
      labors = data.labors || [];

      localStorage.setItem("workers", JSON.stringify(workers));
      localStorage.setItem("history", JSON.stringify(history));

      localStorage.setItem("labors", JSON.stringify(labors));

      loadWorkers();
      renderWorkersTable();
      renderHistory();
      loadLabors();

      alert("Respaldo importado correctamente.");
    } catch (error) {
      alert("Error al importar el respaldo.");

      console.error(error);
    }
  };

  reader.readAsText(file);
}
// =============================
// ðŸ—‘ï¸ ELIMINAR TRABAJADOR
// =============================

async function deleteWorker() {
  const selectedIndexValue = document.getElementById("workerEditSelect").value;
  console.log("editIndexWorker:", editIndexWorker);
  console.log("workerEditSelect.value:", selectedIndexValue);

  const index =
    selectedIndexValue !== ""
      ? Number(selectedIndexValue)
      : editIndexWorker !== null
        ? Number(editIndexWorker)
        : -1;

  if (!Number.isInteger(index) || index < 0 || !workers[index]) {
    await showCustomAlert("Seleccione un trabajador para eliminar.");
    return;
  }

  if (selectedIndexValue === "") {
    document.getElementById("workerEditSelect").value = String(index);
  }

  const workerIndex = index;
  const worker = workers[workerIndex];

  const ok = await showCustomConfirm(
    `¿Está seguro de eliminar a ${worker.name}? Esta acción borrará el trabajador de forma permanente.`,
  );

  if (!ok) return;

  if (storageClient) {
    let error = null;
    if (worker?.id) {
      const result = await storageClient.from("workers").delete().eq("id", worker.id);
      error = result?.error || null;
    } else {
      const result = await storageClient.from("workers").delete().eq("rut", worker.rut);
      error = result?.error || null;
    }

    if (error) {
      console.error("Error eliminando trabajador en almacenamiento local:", error.message);
      await showCustomAlert("Error al eliminar en la base de datos local.");
      return;
    }
  }

  workers.splice(workerIndex, 1);
  saveLocalDataDebounced();

  loadWorkers();
  renderWorkersTable();
  clearWorkerForm();

  await showCustomAlert(`Trabajador ${worker.name} eliminado correctamente.`);
}

function exportData() {
  const data = {
    workers,
    history,
    labors,
  };

  const json = JSON.stringify(data, null, 2);

  const blob = new Blob([json], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;
  const fecha = new Date().toISOString().split("T")[0];

  a.download = "respaldo_sistema_" + fecha + ".json";
  a.click();

  URL.revokeObjectURL(url);
}

async function syncToCloud(showAlerts = false) {
  const reachability = await ensureStorageReachable();
  if (!reachability.ok) {
    if (showAlerts) alert("Error al sincronizar. " + reachability.errorMessage);
    return {
      ok: false,
      errorMessage: reachability.errorMessage,
    };
  }

  try {
    let workerSuccess = 0;
    let workerErrors = 0;
    let historySuccess = 0;
    let historyErrors = 0;

    // ===== TRABAJADORES =====
    for (const worker of workers) {
      const { error } = await storageClient
        .from("workers")
        .upsert(worker, { onConflict: "rut" });

      if (error) {
        console.error("Error subiendo trabajador:", error);
        workerErrors += 1;
      } else {
        workerSuccess += 1;
      }
    }

    // ===== HISTORIAL =====
    for (const record of history) {
      const { error } = await storageClient.from("history").insert(record);

      if (error) {
        console.error("Error subiendo producciÃ³n:", error);
        historyErrors += 1;
      } else {
        historySuccess += 1;
      }
    }

    if (showAlerts) {
      if (workerErrors === 0 && historyErrors === 0) {
        alert(
          "âœ… Guardado en almacenamiento local OK. Trabajadores: " +
            workerSuccess +
            ", ProducciÃ³n: " +
            historySuccess,
        );
      } else {
        alert(
          "âš ï¸ Subida parcial a almacenamiento local. Trabajadores OK: " +
            workerSuccess +
            ", Trabajadores con error: " +
            workerErrors +
            ", ProducciÃ³n OK: " +
            historySuccess +
            ", ProducciÃ³n con error: " +
            historyErrors,
        );
      }
    }
  } catch (err) {
    console.error(err);
    if (showAlerts) alert("Error al sincronizar.");
    return { ok: false, errorMessage: err?.message || "Error al sincronizar." };
  }

  return { ok: true };
}

// Carga local automÃ¡tica robusta al detectar conexiÃ³n a internet o al cargar la app
window.addEventListener("online", () => {
  if (localStorage.getItem("sessionActive") !== "true") return;
  setTimeout(() => {
    initSystem();
  }, 0);
  console.log(
    "[LOCAL MODE] Carga automática de datos locales ejecutada (evento online).",
  );
});

window.addEventListener("DOMContentLoaded", () => {
  const syncIndicator = document.getElementById("syncIndicator");
  if (localStorage.getItem("sessionActive") !== "true" && syncIndicator) {
    syncIndicator.style.display = "none";
    syncIndicator.style.visibility = "hidden";
    syncIndicator.style.pointerEvents = "none";
    syncIndicator.remove();
  }
});

async function syncFromCloud() {
  if (!confirm("¿Descargar datos de la nube y reemplazar los locales?")) return;

  const reachability = await ensureStorageReachable();
  if (!reachability.ok) {
    alert("Error descargando datos. " + reachability.errorMessage);
    return;
  }

  try {
    // ===== TRABAJADORES =====
    const { data: workersData, error: workersError } = await storageClient
      .from("workers")
      .select("*");

    if (workersError) {
      console.error("Error descargando trabajadores:", workersError);
    } else {
      workers = workersData || [];
      localStorage.setItem("workers", JSON.stringify(workers));
    }

    // ===== HISTORIAL =====
    const { data: historyData, error: historyError } = await storageClient
      .from("history")
      .select("*");

    if (historyError) {
      console.error("Error descargando producciÃ³n:", historyError);
    } else {
      history = historyData || [];
      localStorage.setItem("history", JSON.stringify(history));
    }

    // ===== REFRESCAR SISTEMA =====
    loadWorkers();
    renderWorkersTable();
    renderHistory();

    alert("Datos descargados correctamente desde la nube.");
  } catch (err) {
    console.error(err);
    alert("Error descargando datos.");
  }
}

function printMonthlyGeneral() {
  const container = document.getElementById("monthlyGeneralResult");

  if (!container || container.innerHTML.trim() === "") {
    alert("Primero debe calcular el mes.");
    return;
  }

  window.print();
}
function exportMonthlyGeneralExcel() {
  const container = document.getElementById("monthlyGeneralResult");

  if (!container || container.innerHTML.trim() === "") {
    alert("Primero debe calcular el mes.");
    return;
  }

  const month = document.getElementById("monthGeneral").value;

  const recordsRaw = history.filter((r) =>
    isHistoryRecordInMonth(r.date, month),
  );
  const records = dedupeHistoryRecords(recordsRaw);

  // ================================
  // RESUMEN POR TIPO DE LABOR
  // ================================

  const laborSummary = {};

  records.forEach((r) => {
    const laborName = getCanonicalLaborName(r.labor);
    const laborKey = getLaborKey(laborName);

    if (!laborSummary[laborKey]) {
      laborSummary[laborKey] = {
        labor: laborName,
        cantidad: 0,
        total: 0,
      };
    }

    laborSummary[laborKey].cantidad += r.quantity;
    laborSummary[laborKey].total += r.total;
  });

  if (records.length === 0) {
    alert("No hay datos para exportar.");
    return;
  }

  // Agrupar por trabajador
  const summary = {};

  records.forEach((r) => {
    if (!summary[r.rut]) {
      summary[r.rut] = {
        name: r.name,
        total: 0,
        dates: new Set(),
      };
    }

    summary[r.rut].total += r.total;
    summary[r.rut].dates.add(r.date);
  });

  // ===== CONSTRUIR CSV PROFESIONAL =====

  let csv = "";

  const fechaGeneracion = new Date().toLocaleDateString("es-CL");
  const responsable = "Contratista"; // puedes cambiarlo luego

  // ENCABEZADO EMPRESA
  csv += "SERVICIOS AGRÃCOLAS SAN GERÃ“NIMO SPA\n";
  csv += "RESUMEN MENSUAL GENERAL\n";
    csv += "Mes: " + month + "\n";
    csv += "Fecha de generaciÃ³n: " + fechaGeneracion + "\n";
    csv += "Responsable: " + responsable + "\n\n";
  
    // ================================
    // TABLA RESUMEN POR TRABAJADOR
    // ================================
  
    csv += "=== RESUMEN POR TRABAJADOR ===\n";
    csv += "Trabajador;Dias Trabajados;Total\n";
  
    let totalGeneral = 0;
  
    Object.values(summary).forEach((worker) => {
      const daysWorked = worker.dates.size;
      totalGeneral += worker.total;
  
      csv += worker.name + ";" + daysWorked + ";" + worker.total + "\n";
    });
  
    csv += "\nTotal General del Mes;;" + totalGeneral + "\n\n";
  
    // ================================
    // RESUMEN POR TIPO DE LABOR
    // ================================
  
    csv += "=== RESUMEN POR TIPO DE LABOR ===\n";
    csv += "Labor;Cantidad Total;Total $\n";
  
    Object.values(laborSummary).forEach((data) => {
      csv += data.labor + ";" + data.cantidad + ";" + data.total + "\n";
    });
  
    // LÃ­nea total general
    csv += "\nTotal General del Mes;;" + totalGeneral + "\n";
  
    // Crear archivo
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
  
    const a = document.createElement("a");
    a.href = url;
    a.download = "Resumen_Mensual_General.csv";
    a.click();
  
    URL.revokeObjectURL(url);
  }
  
  // =============================
  // ï¿½ COBROS MANDANTES - CALENDARIO
  // =============================
  // Se reutiliza el calendario global definido arriba.

function filterWorkersMonthly() {
  console.log("[DIAG] FILTER V4 (9787) CALLED - LAST DEFINITION");
  const searchInput = document.getElementById("searchWorkerMonthly");
  const list = document.getElementById("workerMonthlyList");
  const hiddenSelect = document.getElementById("workerMonthly");

  if (!searchInput || !list || !hiddenSelect) return;

  const search = searchInput.value
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim();

  const selectedName = (searchInput.dataset.monthlySelectedName || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim();

  if (
    searchInput.dataset.monthlyWorkerLocked === "1" &&
    hiddenSelect.value !== "" &&
    search === selectedName
  ) {
    list.style.display = "none";
    list.innerHTML = "";
    return;
  }

  if (search !== selectedName) {
    delete searchInput.dataset.monthlyWorkerLocked;
  }

  hiddenSelect.value = "";
  list.innerHTML = "";

  if (search === "") {
    list.style.display = "none";
    return;
  }

  const filtered = workers.filter((worker) => {
    const name = (worker.name || "").toLowerCase();
    const cleanRut = (worker.rut || "")
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/-/g, "");

    return name.includes(search) || cleanRut.includes(search);
  });

  if (filtered.length === 0) {
    list.innerHTML =
      "<div style='padding: 10px; color: #999;'>No se encontraron resultados</div>";
    list.style.display = "block";
    return;
  }

  filtered.forEach((worker) => {
    const div = document.createElement("div");
    div.innerHTML = `<strong>${worker.name || ""}</strong><br><small style='color:#666;'>${worker.rut || ""}</small>`;
    div.addEventListener("click", () => {
      clearTimeout(debounceTimer);
      const index = workers.indexOf(worker);
      hiddenSelect.value = String(index);
      searchInput.value = worker.name || "";
      searchInput.dataset.monthlySelectedName = worker.name || "";
      searchInput.dataset.monthlyWorkerLocked = "1";
      document.getElementById("f_workerName").textContent = worker.name;

      const workerRecords = history
        .filter((r) => r.rut === worker.rut)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      if (workerRecords.length > 0) {
        const parts = workerRecords[0].date.split("-");
        const formatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
        document.getElementById("f_startDate").textContent = formatted;
      } else {
        document.getElementById("f_startDate").textContent =
          "____ / ____ / ______";
      }

      refreshFiniquitoResumen();
      list.style.display = "none";
      list.innerHTML = "";
    });
    list.appendChild(div);
  });

  list.style.display = "block";
}

