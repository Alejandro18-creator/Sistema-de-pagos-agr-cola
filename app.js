// =============================
// 💾 GUARDADO DE DATOS DEBOUNCEADO
// =============================
let saveTimer;
function saveLocalDataDebounced() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem("workers", JSON.stringify(workers));
    localStorage.setItem("history", JSON.stringify(history));
    localStorage.setItem("labors", JSON.stringify(labors));
    localStorage.setItem("fundos", JSON.stringify(fundos));
    console.log("Datos guardados localmente");
  }, 500);
}
// =============================
// 🔄 DEBOUNCE PARA BUSCADORES
// =============================
let debounceTimer;
function debounceSearch(fn) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fn, 300);
}

// =============================
// 🌐 SUPABASE CONEXIÓN
// =============================

console.log("APP VERSION 2");

const SUPABASE_URL = "https://nvqdctmqyziectwswiop.supabase.co";
const SUPABASE_KEY = "sb_publishable_z5b3f-BE_D5-T_bDFvafBw_I40wDjHa";

let supabaseClient = null;

if (window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

let editProductionIndex = null;
let workers = JSON.parse(localStorage.getItem("workers")) || [];
let labors = JSON.parse(localStorage.getItem("labors")) || [];
let history = JSON.parse(localStorage.getItem("history")) || [];
let fundos = JSON.parse(localStorage.getItem("fundos")) || [];
let isGeneratingFiniquito = false;
let isSyncInProgress = false;

// =============================
// 📊 TABLA INTERNA AFP (COMISIONES)
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

// Cotización obligatoria base
const AFP_BASE = 0.1; // 10%

/*☁️ GUARDAR EN SUPABASE*/
// =============================

async function saveWorkerToCloud(worker) {
  const { error } = await supabaseClient.from("workers").insert([worker]);

  if (error) {
    if (error.message.includes("duplicate key")) {
      alert("Este RUT ya está registrado.");
      return;
    }
    console.error("Error guardando en nube:", error.message);
    alert("Error guardando trabajador.");
  } else {
    console.log("Trabajador guardado en Supabase");
  }
}

async function saveProductionToCloud(record) {
  if (!supabaseClient) {
    return { ok: false, errorMessage: "Sin conexión a Supabase" };
  }
  const { data, error } = await supabaseClient
    .from("history")
    .insert([record])
    .select()
    .single();

  if (error) {
    console.error("Error guardando producción:", error.message);
    return { ok: false, errorMessage: error.message };
  }

  console.log("Producción guardada en Supabase");

  // guardar el ID que genera Supabase
  record.id = data.id;
  return { ok: true, id: data.id };
}

async function updateProductionInCloud(recordId, record) {
  if (!supabaseClient) {
    return { ok: false, errorMessage: "Sin conexión a Supabase" };
  }

  if (!recordId) {
    return saveProductionToCloud(record);
  }

  const payload = { ...record };
  delete payload.id;

  const { data, error } = await supabaseClient
    .from("history")
    .update(payload)
    .eq("id", recordId)
    .select("id")
    .single();

  if (error) {
    console.error("Error actualizando producción:", error.message);
    return { ok: false, errorMessage: error.message };
  }

  record.id = data.id;
  return { ok: true, id: data.id };
}

async function loadWorkersFromCloud() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient.from("workers").select("*");
  console.log("DATA:", data);

  if (error) {
    console.error("Error cargando trabajadores:", error.message);
    return;
  }

  const localMap = new Map((workers || []).map((w) => [getRutKey(w.rut), w]));

  (data || []).forEach((cloudWorker) => {
    const key = getRutKey(cloudWorker.rut);
    localMap.set(key, cloudWorker);
  });

  workers = Array.from(localMap.values());

  localStorage.setItem("workers", JSON.stringify(workers));

  loadWorkers();
  renderWorkersTable();

  console.log("Trabajadores cargados desde Supabase");
}

async function loadHistoryFromCloud() {
  if (!supabaseClient) return;

  const PAGE_SIZE = 1000;
  let allData = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabaseClient
      .from("history")
      .select("*")
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("Error cargando producción:", error.message);
      return;
    }

    allData = allData.concat(data || []);

    if (!data || data.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      from += PAGE_SIZE;
    }
  }

  const seenHistoryIds = new Set();
  const businessKeyIndexMap = new Map();
  const dedupedHistory = [];
  let droppedById = 0;
  let droppedByBusinessKey = 0;

  (allData || []).forEach((record) => {
    const idKey = record?.id ? String(record.id) : "";
    const businessKey = getHistoryDedupeKey(record);

    if (idKey && seenHistoryIds.has(idKey)) {
      droppedById += 1;
      return;
    }

    if (businessKey && businessKeyIndexMap.has(businessKey)) {
      const existingIndex = businessKeyIndexMap.get(businessKey);
      const existingRecord = dedupedHistory[existingIndex] || {};
      dedupedHistory[existingIndex] = {
        ...existingRecord,
        ...record,
        paid: existingRecord.paid === true || record?.paid === true,
        mandante_paid:
          existingRecord.mandante_paid === true ||
          record?.mandante_paid === true,
      };
      droppedByBusinessKey += 1;
      return;
    }

    if (idKey) seenHistoryIds.add(idKey);
    dedupedHistory.push(record);
    if (businessKey) {
      businessKeyIndexMap.set(businessKey, dedupedHistory.length - 1);
    }
  });

  history = dedupedHistory;

  localStorage.setItem("history", JSON.stringify(history));

  renderHistory();

  console.log(
    "Producción cargada desde Supabase. Total registros:",
    history.length,
    "(crudo:",
    allData.length,
    ", duplicados por id:",
    droppedById,
    ", duplicados por clave:",
    droppedByBusinessKey,
    ")",
  );
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

  const { error } = await supabaseClient
    .from("history")
    .delete()
    .in("rut", orphanedRuts);

  if (error) {
    console.error(
      "Error eliminando historial huérfano en Supabase:",
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

function getHistoryDateKey(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const clMatch = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (clMatch) {
    return `${clMatch[3]}-${clMatch[2]}-${clMatch[1]}`;
  }

  return raw.slice(0, 10);
}

function isHistoryRecordInMonth(recordDate, month) {
  const dateKey = getHistoryDateKey(recordDate);
  return !!month && !!dateKey && dateKey.startsWith(month);
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

  if (supabaseClient) {
    if (historyIdsToDelete.length > 0) {
      const { error } = await supabaseClient
        .from("history")
        .delete()
        .in("id", historyIdsToDelete);

      if (error) {
        cloudErrors += 1;
        console.error("Error eliminando historial en Supabase:", error.message);
      }
    }

    const rutsForCloudDelete = Array.from(workerRutsToDelete).filter(Boolean);
    if (rutsForCloudDelete.length > 0) {
      const { error: historyByRutError } = await supabaseClient
        .from("history")
        .delete()
        .in("rut", rutsForCloudDelete);

      if (historyByRutError) {
        cloudErrors += 1;
        console.error(
          "Error eliminando historial por RUT en Supabase:",
          historyByRutError.message,
        );
      }

      const { error: workersError } = await supabaseClient
        .from("workers")
        .delete()
        .in("rut", rutsForCloudDelete);

      if (workersError) {
        cloudErrors += 1;
        console.error(
          "Error eliminando trabajadores en Supabase:",
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
  if (!supabaseClient) {
    console.warn("[syncPendingLocalDataBeforeCloudDownload] No supabaseClient");
    return { ok: true, failedHistory: 0, failedWorkers: 0 };
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

  let failedWorkers = 0;
  if (pendingWorkers.length > 0) {
    // Insertar en lote (batch) para optimizar
    const batchPayload = pendingWorkers.map((w) => {
      const payload = { ...w };
      delete payload.id;
      return payload;
    });
    try {
      const { data, error } = await supabaseClient
        .from("workers")
        .upsert(batchPayload, { onConflict: "rut" })
        .select("id, rut");
      if (error) {
        failedWorkers = pendingWorkers.length;
        console.error("Error batch insert workers:", error.message);
      } else {
        // Marcar como sincronizados los que se insertaron
        (data || []).forEach((inserted) => {
          const idx = pendingWorkers.findIndex(
            (w) => getRutKey(w.rut) === getRutKey(inserted.rut),
          );
          if (idx !== -1) {
            pendingWorkers[idx].id = inserted.id;
            pendingWorkers[idx].pending = false;
          }
        });
      }
    } catch (e) {
      failedWorkers = pendingWorkers.length;
      console.error("Excepción en batch insert workers:", e);
    }
  }

  let failedHistory = 0;
  if (pendingHistoryIndexes.length > 0) {
    // Insertar en lote (batch) para optimizar
    const batchPayload = pendingHistoryIndexes.map((idx) => {
      const payload = { ...history[idx] };
      delete payload.id;
      return payload;
    });
    try {
      const { data, error } = await supabaseClient
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
      console.error("Excepción en batch insert history:", e);
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
// 🔐 PASSWORD
// =============================

const LOGIN_PASSWORD = "1234";

let editIndexWorker = null;

// =============================
// 🔄 CARGAR RESPALDO SI NO HAY DATOS
// =============================
/* Bloque antigu si es que no hay internet o no se pudo conectar a Supabase, para no perder la funcionalidad básica del sistema.*/
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

            console.log("Respaldo cargado automáticamente");
        });
}*/

// =============================
// 🪪 FORMATO RUT
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
// 🔐 LOGIN
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
    }

    // Ejecutar la sincronización en segundo plano, no bloquear la UI
    setTimeout(() => {
      initSystem();
    }, 0);
  } else {
    alert("Contraseña incorrecta");
  }
  loadMinimumWage();
}

function logout() {
  localStorage.removeItem("sessionActive");
  location.reload();
}

// =============================
// 🚀 INIT
// =============================
async function initSystem() {
  if (isSyncInProgress) {
    console.log(
      "[initSystem] Sincronización ya en curso, se omite llamada duplicada.",
    );
    return;
  }

  isSyncInProgress = true;
  const syncIndicator = document.getElementById("syncIndicator");
  console.log("[initSystem] Iniciando sincronización...");

  const hideSyncIndicator = () => {
    if (!syncIndicator) return;
    syncIndicator.style.display = "none";
    syncIndicator.style.visibility = "hidden";
    syncIndicator.style.pointerEvents = "none";
  };

  if (localStorage.getItem("sessionActive") !== "true") {
    hideSyncIndicator();
    isSyncInProgress = false;
    return;
  }

  if (navigator.onLine && supabaseClient) {
    if (syncIndicator) {
      syncIndicator.style.display = "flex";
      syncIndicator.style.pointerEvents = "none";
      // Failsafe: nunca dejar bloqueada la UI por sincronización lenta
      setTimeout(hideSyncIndicator, 2500);
    }

    setTimeout(async () => {
      try {
        console.log("[initSystem] Sincronizando datos locales pendientes...");
        const pendingSyncResult =
          await syncPendingLocalDataBeforeCloudDownload();
        console.log(
          "[initSystem] Resultado sync pendientes:",
          pendingSyncResult,
        );

        if (pendingSyncResult.ok) {
          console.log("[initSystem] Descargando trabajadores de la nube...");
          await loadWorkersFromCloud();
          console.log("[initSystem] Purga puntual de datos...");
          await runOneTimeDataPurge();

          console.log(
            "[initSystem] Descargando historial de la nube (background)...",
          );
          await loadHistoryFromCloud();
          console.log("[initSystem] Sincronización completa.");
        } else {
          console.error(
            "[initSystem] Error en sincronización de pendientes:",
            pendingSyncResult,
          );
        }
      } catch (e) {
        console.error("[initSystem] Excepción:", e);
      } finally {
        hideSyncIndicator();
        isSyncInProgress = false;

        // Forzar repaint en Electron para evitar congelamiento visual
        if (window.require) {
          setTimeout(() => {
            document.body.style.transform = "scale(1)";
          }, 10);
        }

        console.log("[initSystem] Overlay de sincronización oculto.");
      }
    }, 0);
  } else {
    console.warn("[initSystem] Sin conexión o sin supabaseClient");
    hideSyncIndicator();
    isSyncInProgress = false;
  }

  loadLabors();
  loadFundos();
  renderWorkersTable();
  loadAFPOptions();
  loadPagosWorkerFilter();

  loadMinimumWage();
}

// =============================
// 👨‍🌾 TRABAJADORES
// =============================

async function addWorker() {
  console.log("editIndexWorker:", editIndexWorker);

  const name = document.getElementById("workerName").value.trim();
  const rut = document.getElementById("workerRut").value.trim();
  const account = document.getElementById("workerAccount").value;
  const birthDate = document.getElementById("workerBirthDate").value.trim();
  const maritalStatus = document
    .getElementById("workerMaritalStatus")
    .value.trim();
  const address = document.getElementById("workerAddress").value.trim();
  const afp = document.getElementById("workerAFP").value.trim();
  const health = document.getElementById("workerHealth").value.trim();
  const position = document.getElementById("workerPosition").value.trim();
  const nationality = document.getElementById("workerNationality").value.trim();
  const baseSalary = document
    .getElementById("workerBaseSalary")
    .value.replace(/\$/g, "")
    .replace(/\./g, "");

  let photoUrl = null;
  let workerCloudSaved = false;
  let workerCloudErrorMessage = "";

  if (!name || !rut) {
    alert("Falta completar campos obligatorios (Nombre y RUT).");
    return;
  }
  // 🔹 VALIDAR RUT DUPLICADO
  const rutExists = workers.some((w) => w.rut === rut);

  if (rutExists && editIndexWorker === null) {
    alert("Este RUT ya está registrado.");
    return;
  }

  // 🔹 Subir imagen si existe
  const fileInput = document.getElementById("workerIdPhoto");
  if (fileInput && fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const fileName = Date.now() + "_" + file.name;
    const filePath = rut + "/" + fileName;

    const { error: uploadError } = await supabaseClient.storage
      .from("worker-files")
      .upload(filePath, file);

    console.log("UPLOAD ERROR:", uploadError);

    if (!uploadError) {
      const publicUrlData = supabaseClient.storage
        .from("worker-files")
        .getPublicUrl(filePath);

      photoUrl = publicUrlData.data.publicUrl;
      console.log("PHOTO URL GENERADA:", photoUrl);
    } else {
      console.error("Error subiendo imagen:", uploadError);
    }
  }

  // 🔹 EDICIÓN
  if (editIndexWorker !== null) {
    workers[editIndexWorker] = {
      ...workers[editIndexWorker],
      name,
      rut,
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
    const { data, error } = await supabaseClient
      .from("workers")

      .update({
        name,
        rut,
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

    if (error) {
      workerCloudErrorMessage =
        error.message || "Error actualizando en Supabase.";
    } else {
      workerCloudSaved = true;
    }

    editIndexWorker = null;
  }

  // 🔹 NUEVO TRABAJADOR
  else {
    const newWorker = {
      name,
      rut,
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
      pending: true,
    };

    workers.push(newWorker);

    const { error } = await supabaseClient.from("workers").insert([newWorker]);

    if (error) {
      console.error("Error guardando en nube:", error.message);
      workerCloudErrorMessage = error.message || "Error guardando en Supabase.";
    } else {
      console.log("Trabajador guardado en Supabase");
      workerCloudSaved = true;
    }
  }

  saveLocalDataDebounced();

  clearWorkerForm();
  loadWorkers();
  renderWorkersTable();

  if (workerCloudSaved) {
    alert("✅ Guardado en Supabase OK");
  } else {
    alert(
      "⚠️ No se guardó en nube. Revise conexión/permisos y sincronice luego.",
    );
    if (workerCloudErrorMessage) {
      console.error("Detalle Supabase:", workerCloudErrorMessage);
    }
  }
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
// 🏦 CARGAR AFP EN SELECT
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
// 🧩 AUXILIARES
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

  // Si está vacío, ocultar lista y limpiar selección
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

  const filtered = workers.filter(
    (w) =>
      w.name.toLowerCase().includes(input) ||
      w.rut.toLowerCase().includes(input),
  );

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
      "La jornada ordinaria de trabajo será _______________________________.";
  }
}

function filterWorkersMonthly() {
  const searchInput = document.getElementById("searchWorkerMonthly");
  const list = document.getElementById("workerMonthlyList");
  const hiddenSelect = document.getElementById("workerMonthly");

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
      const index = workers.indexOf(w);
      hiddenSelect.value = index;
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

  // Limpiar días seleccionados del trabajador anterior
  selectedDays.clear();

  // Limpiar el resumen si había uno generado
  document.getElementById("weeklyResult").innerHTML = "";

  // Mostrar calendario automáticamente
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

  // ===== PRODUCCIÓN DEL MES =====

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
    generateLiquidation();
    alert("No hay producción ese mes.");
    return;
  }

  const sueldoImponible = records.reduce((sum, r) => sum + r.total, 0);

  const sueldoMinimo = Number(localStorage.getItem("minimumWage") || 0);

  let sueldoBase = 0;
  let bonoProduccion = 0;

  if (sueldoImponible <= sueldoMinimo) {
    sueldoBase = sueldoImponible;
    bonoProduccion = 0;
  } else {
    sueldoBase = sueldoMinimo;
    bonoProduccion = sueldoImponible - sueldoMinimo;
  }

  const totalHaberes = sueldoBase + bonoProduccion;
  const baseImponible = Math.min(totalHaberes, sueldoMinimo);

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

  const liquido = totalHaberes - totalDescuentos;

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
<td>Sueldo Base</td>
<td>$${sueldoBase.toLocaleString("es-CL")}</td>
</tr>

<tr>
<td>Bono Producción</td>
<td>$${bonoProduccion.toLocaleString("es-CL")}</td>
</tr>

<tr>
<th>Total Haberes</th>
<th>$${totalHaberes.toLocaleString("es-CL")}</th>
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

  // ===== SUBIR A SUPABASE =====

  const { error } = await supabaseClient.storage
    .from("worker-files")
    .upload(filePath, pdfBlob, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    console.error("Error subiendo liquidación:", error);
    alert("⚠️ No se guardó en nube la liquidación.");
  } else {
    console.log("Liquidación guardada en Supabase");
    alert("✅ Liquidación guardada en Supabase OK");
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

function printContractScreen() {
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
    alert("Seleccione un trabajador.");
    return;
  }

  const worker = workers[workerIndex];

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

  // 🔹 COMPLETAR NOMBRE Y RUT
  document.getElementById("c_name").textContent = worker.name;
  document.getElementById("c_rut").textContent = worker.rut;
  document.getElementById("c_faena").textContent =
    contractFundo || "________________________";
  document.getElementById("c_workerSign").textContent = worker.name;

  const workScheduleInput = document.getElementById("workSchedule");
  const workScheduleValue = (workScheduleInput?.value || "").trim();
  const workScheduleElement = document.getElementById("c_workSchedule");
  if (workScheduleElement && workScheduleValue) {
    const fixedPrefix = "La jornada ordinaria de trabajo será ";
    const normalized = workScheduleValue
      .toLowerCase()
      .startsWith(fixedPrefix.toLowerCase())
      ? workScheduleValue
      : fixedPrefix + workScheduleValue;
    workScheduleElement.textContent = normalized;
  }

  // 🔹 AQUÍ VA EL PASO 2 👇

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
  document.getElementById("c_health").textContent =
    worker.health || "____________";

  const salaryInput = document.getElementById("salary").value.trim();

  const formattedSalary = formatCLPCurrency(salaryInput);

  document.getElementById("c_salary").textContent =
    formattedSalary || "____________";

  document.getElementById("c_birthDate").textContent =
    worker.birthDate || "____ / ____ / ____";

  alert("Contrato completado correctamente.");

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

  const { error } = await supabaseClient.storage
    .from("worker-files")
    .upload(filePath, pdfBlob, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    console.error("Error subiendo contrato:", error);
    alert("⚠️ No se guardó en nube el contrato.");
  } else {
    console.log("Contrato guardado en Supabase");
    alert("✅ Contrato guardado en Supabase OK");
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
    sueldoMinimo > 0 ? Math.min(totalCalculado, sueldoMinimo) : totalCalculado;
  totalElement.textContent = `$ ${totalPagado.toLocaleString("es-CL")}`;
}

async function generateFiniquito() {
  if (isGeneratingFiniquito) {
    alert("Ya se está generando un finiquito. Espere un momento.");
    return;
  }

  const workerIndex = document.getElementById("workerFiniquito").value;

  if (workerIndex === "") {
    alert("Seleccione un trabajador.");
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

    const { error } = await supabaseClient.storage
      .from("worker-files")
      .upload(filePath, pdfBlob, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (error) {
      console.error("Error subiendo finiquito:", error);
      alert("⚠️ No se guardó en nube el finiquito.");
    } else {
      console.log("Finiquito guardado en Supabase");
      alert("✅ Finiquito guardado en Supabase OK");
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
  const workerIndex = document.getElementById("workerMonthly").value;

  const month = document.getElementById("monthMonthly").value;

  if (workerIndex === "" || !month) {
    alert("Seleccione trabajador y mes.");
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
// 🔐 SESIÓN
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
    }
  }
};

function focusFirstFieldInView(viewId) {
  // Asegura que el overlay de sincronización esté oculto antes de enfocar
  const syncIndicator = document.getElementById("syncIndicator");
  if (syncIndicator) syncIndicator.style.display = "none";

  requestAnimationFrame(() => {
    setTimeout(() => {
      const view = document.getElementById(viewId);
      if (!view) return;

      // Si hay overlays visibles, ocultarlos
      document
        .querySelectorAll('.hidden, [style*="display: none"]')
        .forEach((el) => {
          if (el.id === "syncIndicator") el.style.display = "none";
        });

      const selectors = [
        'input:not([type="hidden"]):not([disabled])',
        "select:not([disabled])",
        "textarea:not([disabled])",
        "button:not([disabled])",
        '[tabindex]:not([tabindex="-1"])',
      ];

      const focusableElements = Array.from(
        view.querySelectorAll(selectors.join(",")),
      ).filter((element) => {
        const style = window.getComputedStyle(element);
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          !element.closest(".hidden")
        );
      });

      const target = focusableElements[0];
      if (!target) return;

      // Forzar el foco dos veces para asegurar que el navegador lo aplique
      target.focus();
      setTimeout(() => {
        target.focus();
        if (typeof target.select === "function") {
          target.select();
        }
      }, 30);
    }, 100);
  });
}

function closeFloatingUi() {
  // Cierra listas de búsqueda flotantes que pueden quedar sobre inputs.
  document
    .querySelectorAll(".worker-search-list, .mandante-worker-list")
    .forEach((list) => {
      list.style.display = "none";
    });

  // Si un modal quedó abierto por error, lo removemos para recuperar interacción.
  const productionModal = document.getElementById("productionConfirmModal");
  if (productionModal) {
    productionModal.remove();
  }

  // Restaurar el foco al primer input visible en la vista activa
  const activeView = document.querySelector(".view:not(.hidden)");
  if (activeView) {
    const input = activeView.querySelector(
      'input:not([type="hidden"]):not([disabled])',
    );
    if (input && !document.activeElement?.matches("input, textarea, select")) {
      input.focus();
    }
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

  const clickedInsideFloatingUi = target.closest(
    ".worker-search, .mandante-search, #productionConfirmModal",
  );

  if (!clickedInsideFloatingUi) {
    closeFloatingUi();
  }
});

// =============================
// 📂 TOGGLE SUBMENU
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
// 💾 EXPORTAR RESPALDO
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
// 🗑️ ELIMINAR TRABAJADOR
// =============================

async function deleteWorker() {
  const index = document.getElementById("workerEditSelect").value;

  if (index === "") {
    alert("Seleccione un trabajador para inactivar.");
    return;
  }

  const worker = workers[index];

  if (
    !confirm(
      `¿Está seguro de inactivar a ${worker.name}? El trabajador quedará inactivo y no aparecerá en las listas.`,
    )
  )
    return;

  // 🔹 1. Marcar inactivo en Supabase
  const { error } = await supabaseClient
    .from("workers")
    .update({ active: false })
    .eq("rut", worker.rut);

  if (error) {
    console.error("Error actualizando trabajador en Supabase:", error.message);
    alert("Error al actualizar en la base de datos.");
    return;
  }

  // 🔹 2. Marcar inactivo local
  workers[index].active = false;
  saveLocalDataDebounced();

  // 🔹 3. Actualizar sistema
  loadWorkers();
  renderWorkersTable();
  clearWorkerForm();

  alert(`Trabajador ${worker.name} marcado como inactivo.`);
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
  try {
    let workerSuccess = 0;
    let workerErrors = 0;
    let historySuccess = 0;
    let historyErrors = 0;

    // ===== TRABAJADORES =====
    for (const worker of workers) {
      const { error } = await supabaseClient
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
      const { error } = await supabaseClient.from("history").insert(record);

      if (error) {
        console.error("Error subiendo producción:", error);
        historyErrors += 1;
      } else {
        historySuccess += 1;
      }
    }

    if (showAlerts) {
      if (workerErrors === 0 && historyErrors === 0) {
        alert(
          "✅ Guardado en Supabase OK. Trabajadores: " +
            workerSuccess +
            ", Producción: " +
            historySuccess,
        );
      } else {
        alert(
          "⚠️ Subida parcial a Supabase. Trabajadores OK: " +
            workerSuccess +
            ", Trabajadores con error: " +
            workerErrors +
            ", Producción OK: " +
            historySuccess +
            ", Producción con error: " +
            historyErrors,
        );
      }
    }
  } catch (err) {
    console.error(err);
    if (showAlerts) alert("Error al sincronizar.");
  }
}

// Sincronización automática robusta al detectar conexión a internet o al cargar la app
window.addEventListener("online", () => {
  if (localStorage.getItem("sessionActive") !== "true") return;
  setTimeout(() => {
    initSystem();
  }, 0);
  console.log(
    "Sincronización automática con la nube ejecutada (evento online).",
  );
});

window.addEventListener("DOMContentLoaded", () => {
  const syncIndicator = document.getElementById("syncIndicator");
  if (localStorage.getItem("sessionActive") !== "true" && syncIndicator) {
    syncIndicator.style.display = "none";
    syncIndicator.style.visibility = "hidden";
    syncIndicator.style.pointerEvents = "none";
  }
});

async function syncFromCloud() {
  if (!confirm("¿Descargar datos de la nube y reemplazar los locales?")) return;

  try {
    // ===== TRABAJADORES =====
    const { data: workersData, error: workersError } = await supabaseClient
      .from("workers")
      .select("*");

    if (workersError) {
      console.error("Error descargando trabajadores:", workersError);
    } else {
      workers = workersData || [];
      localStorage.setItem("workers", JSON.stringify(workers));
    }

    // ===== HISTORIAL =====
    const { data: historyData, error: historyError } = await supabaseClient
      .from("history")
      .select("*");

    if (historyError) {
      console.error("Error descargando producción:", historyError);
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
  csv += "SERVICIOS AGRÍCOLAS SAN GERÓNIMO SPA\n";
  csv += "RESUMEN MENSUAL GENERAL\n";
  csv += "Mes: " + month + "\n";
  csv += "Fecha de generación: " + fechaGeneracion + "\n";
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

  // Línea total general
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
// � COBROS MANDANTES - CALENDARIO
// =============================
let currentCalendarDateMandante = new Date();
let selectedDaysMandante = new Set();

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
  const dayNames = ["do", "lu", "ma", "mi", "ju", "vi", "sá"];

  let html =
    "<div style='width: 350px; border: 1px solid #ccc; border-radius: 8px; padding: 15px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);'>";

  html +=
    "<div style='display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;'>";
  html +=
    "<button type='button' class='btn-month-mandante' data-dir='-1' style='border: none; background: none; cursor: pointer; font-size: 20px; padding: 5px 10px; color: #333;'>◀</button>";
  html +=
    "<span style='font-weight: bold; text-transform: capitalize;'>" +
    monthNames[monthNum] +
    " de " +
    year +
    "</span>";
  html +=
    "<button type='button' class='btn-month-mandante' data-dir='1' style='border: none; background: none; cursor: pointer; font-size: 20px; padding: 5px 10px; color: #333;'>▶</button>";
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
    alert("No hay registros en los días seleccionados.");
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
// �📊 RESUMEN SEMANAL - MOSTRAR CALENDARIO DEL MES
// =============================
let currentCalendarDate = new Date();
let selectedDays = new Set();
let pendingCalendarMode = false;

function toggleDay(dateStr) {
  if (selectedDays.has(dateStr)) {
    selectedDays.delete(dateStr);
  } else {
    selectedDays.add(dateStr);
  }

  localStorage.setItem(
    "mandanteDays",
    JSON.stringify(Array.from(selectedDays)),
  );

  showCalendar(
    currentCalendarDate.getFullYear(),
    currentCalendarDate.getMonth(),
  );
}

function clearSelectedDays() {
  selectedDays.clear();
  showCalendar(
    currentCalendarDate.getFullYear(),
    currentCalendarDate.getMonth(),
  );
}

function todayDate() {
  currentCalendarDate = new Date();
  showCalendar();
}

function exitPendingCalendar() {
  pendingCalendarMode = false;
  selectedDays.clear();
  document.getElementById("calendarContainer").innerHTML = "";
  document.getElementById("weeklyResult").innerHTML = "";
  showView("viewPagos");
}

function showPendingDaysCalendar(rut, dates) {
  if (!Array.isArray(dates) || dates.length === 0) {
    alert("No hay días pendientes.");
    return;
  }

  const workerIndex = workers.findIndex((w) => w.rut === rut);
  if (workerIndex === -1) {
    alert("Trabajador no encontrado.");
    return;
  }

  document.getElementById("workerWeekly").value = workerIndex;
  document.getElementById("searchWorkerWeekly").value =
    workers[workerIndex].name || "";
  document.getElementById("workerWeeklyList").style.display = "none";
  document.getElementById("workerWeeklyList").innerHTML = "";

  pendingCalendarMode = true;
  selectedDays.clear();
  dates.forEach((dateStr) => {
    if (dateStr) {
      selectedDays.add(dateStr);
    }
  });

  const firstDate = dates[0];
  if (firstDate) {
    const [year, month] = firstDate.split("-").map(Number);
    if (year && month) {
      currentCalendarDate = new Date(year, month - 1, 1);
    }
  }

  showView("viewWeekly");
  document.getElementById("weeklyResult").innerHTML = "";
  showCalendar(
    currentCalendarDate.getFullYear(),
    currentCalendarDate.getMonth(),
  );
}

// Función para cambiar de mes
function changeMonth(direction) {
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  const newDate = new Date(year, month + direction);
  showCalendar(newDate.getFullYear(), newDate.getMonth());
}

// =============================
// 🔍 CARGAR REGISTROS DEL DÍA
// =============================

function loadDailyRecords() {
  const workerIndex = document.getElementById("workerSelect").value;

  const date = document.getElementById("workDate").value;

  const container = document.getElementById("dailyRecordsResult");

  if (workerIndex === "" || !date) {
    alert("Seleccione trabajador y fecha.");
    return;
  }

  const worker = workers[workerIndex];

  const records = history.filter(
    (r) => r.rut === worker.rut && r.date === date,
  );

  if (records.length === 0) {
    container.innerHTML = "<p>No hay registros ese día.</p>";
    return;
  }

  let html = "<h3>Registros del día</h3>";
  html += "<table>";
  html +=
    "<tr><th>Labor</th><th>Cantidad</th><th>Total</th><th>Acciones</th></tr>";

  records.forEach((r) => {
    const index = history.findIndex(
      (h) =>
        h.rut === r.rut &&
        h.date === r.date &&
        h.labor === r.labor &&
        h.quantity === r.quantity &&
        h.total === r.total,
    );

    html += "<tr>";
    html += "<td>" + r.labor + "</td>";
    html += "<td>" + r.quantity + "</td>";
    html += "<td>$" + Number(r.total).toLocaleString("es-CL") + "</td>";
    html += `<td>
        <button class="btn-edit-production" data-index="${index}">✏️</button>
        <button class="btn-delete-production" data-index="${index}" style="background:#c0392b">🗑️</button>
      </td>`;
    html += "</tr>";
  });

  html += "</table>";

  container.innerHTML = html;

  // Asignar eventos CSP-compliant
  container.querySelectorAll(".btn-edit-production").forEach((btn) => {
    btn.addEventListener("click", function () {
      editProductionByIndex(Number(this.getAttribute("data-index")));
    });
  });
  container.querySelectorAll(".btn-delete-production").forEach((btn) => {
    btn.addEventListener("click", function () {
      deleteProductionByIndex(Number(this.getAttribute("data-index")));
    });
  });
}
// =============================
// ✏️ EDITAR POR ÍNDICE
// =============================

function editProductionByIndex(index) {
  const record = history[index];

  editProductionIndex = index;

  document.getElementById("workerSelect").value = workers.findIndex(
    (w) => w.rut === record.rut,
  );

  document.getElementById("workDate").value = record.date;

  document.getElementById("quantity").value = record.quantity;

  document.getElementById("unitValue").value =
    "$" + (record.total / record.quantity).toLocaleString("es-CL");

  document.getElementById("laborSelect").value = record.labor;

  const regBtn = document.querySelector("#viewProduction .btn-register-work");
  if (regBtn) regBtn.textContent = "Actualizar";

  alert("Registro cargado para modificar.");
}

// =============================
// 🗑️ ELIMINAR POR ÍNDICE
// =============================

async function deleteProductionByIndex(index) {
  if (!confirm("¿Está seguro de eliminar este registro?")) return;

  const record = history[index];

  // Eliminar de Supabase si tiene id
  if (record.id) {
    const { error } = await supabaseClient
      .from("history")
      .delete()
      .eq("id", record.id);

    if (error) {
      console.error("Error eliminando en Supabase:", error.message);
      alert("Error al eliminar en la base de datos.");
      return;
    }
  }

  // Eliminar local
  history.splice(index, 1);
  localStorage.setItem("history", JSON.stringify(history));

  alert("Registro eliminado.");

  // Limpiar tabla
  document.getElementById("dailyRecordsResult").innerHTML = "";
}

// 🗑️ ELIMINAR DESDE RESUMEN SEMANAL
// =============================
async function deleteDailyRecord(id) {
  if (!confirm("¿Está seguro de eliminar este registro?")) return;

  const index = history.findIndex((r) => r.id === id);

  if (index === -1) {
    console.error("❌ No se encontró el registro con id:", id);
    return;
  }

  const record = history[index];

  if (record.id) {
    console.log("ELIMINANDO ID:", record.id);
    const { error } = await supabaseClient
      .from("history")
      .delete()
      .eq("id", record.id);
    console.log("RESPUESTA DELETE:", error);
    if (error) {
      console.error("Error eliminando en Supabase:", error.message);
      alert("Error al eliminar en la base de datos.");
      return;
    }
  }

  history.splice(index, 1);

  localStorage.setItem("history", JSON.stringify(history));
  document.getElementById("weeklyResult").innerHTML = "";
  generateWeeklySummary();

  alert("Registro eliminado.");

  if (typeof window.generatePagosResumen === "function") {
    window.generatePagosResumen();
  }
}

function openWorkerFolder(rut) {
  const worker = workers.find((w) => w.rut === rut);

  if (!worker) return;

  document.getElementById("folderWorkerName").textContent = worker.name;
  document.getElementById("folderWorkerRut").textContent = worker.rut;

  loadWorkerDocuments(rut);

  showView("viewWorkerFolder");
}
async function uploadWorkerDocument() {
  const fileInput = document.getElementById("workerFileUpload");

  if (!fileInput.files.length) {
    alert("Seleccione un archivo.");
    return;
  }

  const file = fileInput.files[0];

  const rut = document.getElementById("folderWorkerRut").textContent;

  const filePath = rut + "/" + Date.now() + "_" + file.name;

  const { error } = await supabaseClient.storage
    .from("worker-files")
    .upload(filePath, file);

  if (error) {
    console.error(error);
    alert("Error subiendo archivo.");
    return;
  }

  alert("Documento subido correctamente.");

  loadWorkerDocuments(rut);
}
async function loadWorkerDocuments(rut) {
  const { data, error } = await supabaseClient.storage
    .from("worker-files")
    .list(rut);

  const container = document.getElementById("workerDocuments");

  if (error) {
    console.error(error);
    container.innerHTML = "<p>Error cargando documentos.</p>";
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = "<p>No hay documentos aún.</p>";
    return;
  }

  const sortedFiles = [...data].sort((a, b) => {
    const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
    const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
    return dateB - dateA;
  });

  let html = "<ul>";

  sortedFiles.forEach((file) => {
    const publicUrl = supabaseClient.storage
      .from("worker-files")
      .getPublicUrl(rut + "/" + file.name).data.publicUrl;

    // Evita mostrar PDF en caché cuando se sobrescribe el mismo nombre.
    const version = encodeURIComponent(
      file.updated_at || file.created_at || Date.now(),
    );
    const freshUrl = publicUrl + "?v=" + version;

    html += "<li>";
    html += "<a href='" + freshUrl + "' target='_blank'>" + file.name + "</a> ";
    html += `<button class="btn-delete-worker-doc" data-rut="${rut}" data-filename="${file.name}">🗑</button>`;
    html += "</li>";
  });

  html += "</ul>";

  container.innerHTML = html;

  // Asignar eventos CSP-compliant
  container.querySelectorAll(".btn-delete-worker-doc").forEach((btn) => {
    btn.addEventListener("click", function () {
      deleteWorkerDocument(
        this.getAttribute("data-rut"),
        this.getAttribute("data-filename"),
      );
    });
  });
}
async function deleteWorkerDocument(rut, fileName) {
  if (!confirm("¿Eliminar este documento?")) return;

  const { error } = await supabaseClient.storage
    .from("worker-files")
    .remove([rut + "/" + fileName]);

  if (error) {
    console.error(error);
    alert("Error eliminando documento.");
    return;
  }

  alert("Documento eliminado.");

  loadWorkerDocuments(rut);
}
function saveMinimumWage() {
  const wageInput = document.getElementById("minimumWage").value;

  const wage = Number(wageInput.replace(/\$/g, "").replace(/\./g, ""));

  if (!wage || wage <= 0) {
    alert("Ingrese un sueldo válido.");
    return;
  }

  localStorage.setItem("minimumWage", wage);

  alert("Sueldo mínimo guardado correctamente.");
}
function loadMinimumWage() {
  const wage = localStorage.getItem("minimumWage");

  if (!wage) return;

  const input = document.getElementById("minimumWage");

  if (input) {
    input.value = "$" + Number(wage).toLocaleString("es-CL");
  }
}
function printMandanteCobro() {
  const container = document.getElementById("mandanteResult");

  if (!container || container.innerHTML.trim() === "") {
    alert("Primero genere el resumen.");
    return;
  }

  const printWindow = window.open("", "_blank");

  printWindow.document.write(`
    <html>
    <head>
      <title>Cobro Mandante</title>
      <link rel="stylesheet" href="styles.css">
    </head>
    <body>
      ${container.innerHTML}
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.print();
}

window.addEventListener("online", () => {
  if (localStorage.getItem("sessionActive") !== "true") return;
  if (isSyncInProgress) return;
  console.log("Internet restaurado. Sincronizando datos...");

  if (typeof syncToCloud === "function") {
    syncToCloud();
  }
});
fetch("./package.json")
  .then((r) => r.json())
  .then((pkg) => {
    const el = document.getElementById("appVersion");
    if (el) el.textContent = pkg.version;
  });
// =============================
// 📅 HELPER DE FECHAS PRO
// =============================

const DateHelper = {
  // Detecta si una fecha está en formato chileno
  isCL(fecha) {
    return /^\d{2}\/\d{2}\/\d{4}$/.test(fecha);
  },

  // Detecta formato chileno con guiones
  isCLDash(fecha) {
    return /^\d{2}-\d{2}-\d{4}$/.test(fecha);
  },

  // Detecta formato chileno con / o -
  isCLAny(fecha) {
    return this.isCL(fecha) || this.isCLDash(fecha);
  },

  // Detecta formato ISO
  isISO(fecha) {
    return /^\d{4}-\d{2}-\d{2}$/.test(fecha);
  },

  // Convierte cualquier formato a ISO (para cálculos)
  toISO(fecha) {
    if (!fecha) return "";

    if (this.isISO(fecha)) return fecha;

    if (this.isCLAny(fecha)) {
      const [d, m, y] = fecha.split(/[\/-]/);
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    console.warn("Formato de fecha no reconocido:", fecha);
    return "";
  },

  // Convierte cualquier formato a chileno (para mostrar)
  toCL(fecha) {
    if (!fecha) return "";

    if (this.isCL(fecha)) return fecha;

    if (this.isCLDash(fecha)) {
      const [d, m, y] = fecha.split("-");
      return `${d}/${m}/${y}`;
    }

    if (this.isISO(fecha)) {
      const [y, m, d] = fecha.split("-");
      return `${d}/${m}/${y}`;
    }

    console.warn("Formato de fecha no reconocido:", fecha);
    return "";
  },

  // Compara fechas sin importar formato
  isBetween(fecha, inicio, fin) {
    const f = this.toISO(fecha);
    const i = this.toISO(inicio);
    const e = this.toISO(fin);

    return f >= i && f <= e;
  },
};
function formatFechaInput(input) {
  let value = input.value.replace(/\D/g, ""); // solo números

  if (value.length > 8) value = value.slice(0, 8);

  if (value.length >= 5) {
    input.value =
      value.slice(0, 2) + "/" + value.slice(2, 4) + "/" + value.slice(4);
  } else if (value.length >= 3) {
    input.value = value.slice(0, 2) + "/" + value.slice(2);
  } else {
    input.value = value;
  }
}

// Exponer funciones globales para otros scripts
window.loadPaymentsHistory = loadPaymentsHistory;
window.clearLiquidationSearch = clearLiquidationSearch;

async function loadPaymentsHistory() {
  console.log("ENTRÓ A loadPaymentsHistory");

  const container = document.getElementById("paymentsHistoryTable");

  const { data, error } = await supabaseClient
    .from("payments")
    .select("*")
    .order("payment_date", { ascending: false });

  console.log("DATA PAYMENTS:", data);
  console.log("ERROR PAYMENTS:", error);

  if (error) {
    container.innerHTML = "<p>Error cargando pagos.</p>";
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = "<p>No hay pagos registrados.</p>";
    return;
  }

  let html = `
    <table>
      <tr>
        <th>Fecha</th>
        <th>Trabajador</th>
        <th>Total Pagado</th>
      </tr>
  `;

  data.forEach((p) => {
    html += `
      <tr>
        <td>${p.payment_date}</td>
        <td>${p.name}</td>
        <td>$${Number(p.total_paid).toLocaleString("es-CL")}</td>
      </tr>
    `;
  });

  html += "</table>";

  // 🔷 RESUMEN SUPERIOR
  const summaryContainer = document.getElementById("paymentsSummary");

  let totalGeneral = 0;
  let workersSet = new Set();

  data.forEach((p) => {
    totalGeneral += Number(p.total_paid);
    workersSet.add(p.rut);
  });

  summaryContainer.innerHTML = `
  <div>
    <strong>Total Pagado:</strong> $${totalGeneral.toLocaleString("es-CL")}
  </div>
  <div>
    <strong>Cantidad de Pagos:</strong> ${data.length}
  </div>
  <div>
    <strong>Trabajadores Pagados:</strong> ${workersSet.size}
  </div>
`;

  container.innerHTML = html;
}
window.loadPaymentsHistory = loadPaymentsHistory;
function clearLiquidationSearch() {
  const searchInput = document.getElementById("searchWorkerLiquidation");
  const resultsList = document.getElementById("workerLiquidationList");
  const hiddenSelect = document.getElementById("workerLiquidation");

  if (searchInput) searchInput.value = "";
  if (hiddenSelect) hiddenSelect.value = "";
  if (resultsList) {
    resultsList.style.display = "none";
    resultsList.innerHTML = "";
  }
}
window.clearLiquidationSearch = clearLiquidationSearch;
