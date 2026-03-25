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

async function loadWorkersFromCloud() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient.from("workers").select("*");
  console.log("DATA:", data);

  if (error) {
    console.error("Error cargando trabajadores:", error.message);
    return;
  }

  workers = data || [];

  localStorage.setItem("workers", JSON.stringify(workers));

  loadWorkers();
  renderWorkersTable();

  console.log("Trabajadores cargados desde Supabase");
}

async function loadHistoryFromCloud() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient
    .from("history")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    console.error("Error cargando producción:", error.message);
    return;
  }

  history = data || [];

  localStorage.setItem("history", JSON.stringify(history));

  renderHistory();

  console.log("Producción cargada desde Supabase");
}

async function pruneHistoryOrphaned() {
  const workerRuts = new Set((workers || []).map((w) => w.rut));

  if (workerRuts.size === 0) {
    return;
  }

  const orphaned = (history || []).filter((r) => !workerRuts.has(r.rut));

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

  history = history.filter((r) => workerRuts.has(r.rut));
  localStorage.setItem("history", JSON.stringify(history));
  renderHistory();
}

async function syncPendingLocalDataBeforeCloudDownload() {
  if (!supabaseClient) {
    return { ok: true, failedHistory: 0, failedWorkers: 0 };
  }

  const [
    { data: cloudWorkers, error: workersReadError },
    { data: cloudHistory, error: historyReadError },
  ] = await Promise.all([
    supabaseClient.from("workers").select("rut"),
    supabaseClient.from("history").select("id"),
  ]);

  if (workersReadError || historyReadError) {
    console.error(
      "Error leyendo datos de Supabase antes de sincronizar:",
      workersReadError?.message || historyReadError?.message,
    );
    return {
      ok: false,
      failedHistory: 0,
      failedWorkers: 0,
      reason: "read-error",
    };
  }

  const cloudWorkerRuts = new Set(
    (cloudWorkers || []).map((w) => getRutKey(w.rut)).filter(Boolean),
  );

  const cloudHistoryIds = new Set(
    (cloudHistory || []).map((r) => String(r.id)).filter(Boolean),
  );

  const pendingWorkers = [];
  const localPendingRuts = new Set();

  (workers || []).forEach((worker) => {
    const rutKey = getRutKey(worker.rut);
    if (
      !rutKey ||
      cloudWorkerRuts.has(rutKey) ||
      localPendingRuts.has(rutKey)
    ) {
      return;
    }
    localPendingRuts.add(rutKey);
    pendingWorkers.push(worker);
  });

  const pendingHistoryIndexes = [];
  (history || []).forEach((record, index) => {
    const localId = record?.id;
    const idKey =
      localId === undefined || localId === null ? "" : String(localId);
    if (!idKey || !cloudHistoryIds.has(idKey)) {
      pendingHistoryIndexes.push(index);
    }
  });

  let failedWorkers = 0;
  for (const worker of pendingWorkers) {
    const payload = { ...worker };
    delete payload.id;

    const { data, error } = await supabaseClient
      .from("workers")
      .insert([payload])
      .select("id")
      .single();

    if (error) {
      failedWorkers++;
      console.error(
        "Error sincronizando trabajador pendiente:",
        worker?.rut,
        error.message,
      );
      continue;
    }

    if (data?.id !== undefined) {
      worker.id = data.id;
    }
  }

  let failedHistory = 0;
  for (const index of pendingHistoryIndexes) {
    const localRecord = history[index];
    const payload = { ...localRecord };
    delete payload.id;

    const { data, error } = await supabaseClient
      .from("history")
      .insert([payload])
      .select("id")
      .single();

    if (error) {
      failedHistory++;
      console.error(
        "Error sincronizando producción pendiente:",
        localRecord,
        error.message,
      );
      continue;
    }

    if (data?.id !== undefined) {
      history[index] = { ...localRecord, id: data.id };
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

function formatMoney(value) {
  if (!value) return "$0";

  return (
    "$" +
    Number(value).toLocaleString("es-CL", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}
function formatCLPCurrency(value) {
  if (!value) return "";

  const numericValue = Number(
    value.replace(/\$/g, "").replace(/\./g, "").replace(/,/g, ""),
  );

  if (isNaN(numericValue)) return value;

  return "$" + numericValue.toLocaleString("es-CL");
}

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

    await initSystem();
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
  const syncIndicator = document.getElementById("syncIndicator");
  if (navigator.onLine && supabaseClient) {
    if (syncIndicator) syncIndicator.style.display = "flex";
    try {
      const pendingSyncResult = await syncPendingLocalDataBeforeCloudDownload();
      const totalFailedSync =
        (pendingSyncResult.failedWorkers || 0) +
        (pendingSyncResult.failedHistory || 0);

      if (pendingSyncResult.ok) {
        // Solo si TODO se sincronizó bien, descargar de la nube
        await loadWorkersFromCloud();
        await loadHistoryFromCloud();
        await pruneHistoryOrphaned();
      } else {
        // Si hubo cualquier error, NO descargar de la nube para no perder datos locales
        alert(
          "⚠️ No se pudieron sincronizar todos los datos con la nube.\n\nTus datos locales se mantendrán intactos para evitar pérdida de información.\n\nPor favor, revisa la conexión o los datos y vuelve a intentarlo.",
        );
      }
    } finally {
      if (syncIndicator) syncIndicator.style.display = "none";
    }
  }

  loadLabors();
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

  localStorage.setItem("workers", JSON.stringify(workers));

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

function loadWorkerToEdit() {
  const index = document.getElementById("workerEditSelect").value;

  if (index === "") return;

  const worker = workers[index];
  const editSearch = document.getElementById("searchWorkerEdit");
  if (editSearch) editSearch.value = worker.name || "";

  // 🧠 ACTIVAR MODO EDICIÓN
  editIndexWorker = index;

  document.getElementById("workerName").value = worker.name || "";

  document.getElementById("workerRut").value = worker.rut || "";

  document.getElementById("workerAddress").value = worker.address || "";

  document.getElementById("workerAFP").value = worker.afp || "";

  document.getElementById("workerHealth").value = worker.health || "";

  document.getElementById("workerPosition").value = worker.position || "";

  document.getElementById("workerNationality").value = worker.nationality || "";
  document.getElementById("workerBirthDate").value = worker.birthDate || "";
  document.getElementById("workerMaritalStatus").value =
    worker.maritalStatus || "";
  document.getElementById("workerAccount").value = worker.account_number || "";
}

function clearWorkerForm() {
  editIndexWorker = null;
  document.getElementById("workerEditSelect").value = "";
  const editSearch = document.getElementById("searchWorkerEdit");
  const editList = document.getElementById("workerEditList");
  if (editSearch) editSearch.value = "";
  if (editList) {
    editList.style.display = "none";
    editList.innerHTML = "";
  }
  document.getElementById("workerName").value = "";
  document.getElementById("workerRut").value = "";
  document.getElementById("workerBirthDate").value = "";
  document.getElementById("workerMaritalStatus").value = "";
  document.getElementById("workerAddress").value = "";
  document.getElementById("workerAFP").value = "";
  document.getElementById("workerHealth").value = "";
  document.getElementById("workerPosition").value = "";
  document.getElementById("workerNationality").value = "";
  document.getElementById("workerAccount").value = "";
}

function clearWorkerInputs() {
  document.getElementById("workerName").value = "";
  document.getElementById("workerRut").value = "";
  document.getElementById("workerBirthDate").value = "";
  document.getElementById("workerMaritalStatus").value = "";
  document.getElementById("workerAddress").value = "";
}

function formatBirthDate(input) {
  let value = input.value.replace(/\D/g, "").slice(0, 8);
  if (value.length >= 5) {
    value = value.replace(/(\d{2})(\d{2})(\d{0,4})/, "$1/$2/$3");
  } else if (value.length >= 3) {
    value = value.replace(/(\d{2})(\d{0,2})/, "$1/$2");
  }
  input.value = value;
}

// =============================
// 📋 SELECTS
// =============================

function loadWorkers() {
  const ids = [
    "workerSelect",
    "workerLiquidation",
    "workerMonthly",
    "workerWeekly",
    "workerContract",
    "workerFiniquito",
    "workerEditSelect",
  ];

  const liquidationSearch = document.getElementById("searchWorkerLiquidation");
  if (liquidationSearch) {
    liquidationSearch.value = "";
  }

  const liquidationList = document.getElementById("workerLiquidationList");
  if (liquidationList) {
    liquidationList.innerHTML = "";
    liquidationList.style.display = "none";
  }

  const workerEditSearch = document.getElementById("searchWorkerEdit");
  if (workerEditSearch) {
    workerEditSearch.value = "";
  }

  const workerEditList = document.getElementById("workerEditList");
  if (workerEditList) {
    workerEditList.innerHTML = "";
    workerEditList.style.display = "none";
  }

  const workerContractSearch = document.getElementById("searchWorkerContract");
  if (workerContractSearch) {
    workerContractSearch.value = "";
  }

  const workerContractList = document.getElementById("workerContractList");
  if (workerContractList) {
    workerContractList.innerHTML = "";
    workerContractList.style.display = "none";
  }

  const workerMonthlySearch = document.getElementById("searchWorkerMonthly");
  if (workerMonthlySearch) {
    workerMonthlySearch.value = "";
  }

  const workerMonthlyList = document.getElementById("workerMonthlyList");
  if (workerMonthlyList) {
    workerMonthlyList.innerHTML = "";
    workerMonthlyList.style.display = "none";
  }

  const workerFiniquitoSearch = document.getElementById(
    "searchWorkerFiniquito",
  );
  if (workerFiniquitoSearch) {
    workerFiniquitoSearch.value = "";
  }

  const workerFiniquitoList = document.getElementById("workerFiniquitoList");
  if (workerFiniquitoList) {
    workerFiniquitoList.innerHTML = "";
    workerFiniquitoList.style.display = "none";
  }

  const workerProductionSearch = document.getElementById(
    "searchWorkerProduction",
  );
  if (workerProductionSearch) {
    workerProductionSearch.value = "";
  }

  const workerProductionList = document.getElementById("workerProductionList");
  if (workerProductionList) {
    workerProductionList.innerHTML = "";
    workerProductionList.style.display = "none";
  }

  const workerWeeklySearch = document.getElementById("searchWorkerWeekly");
  if (workerWeeklySearch) {
    workerWeeklySearch.value = "";
  }

  const workerWeeklyList = document.getElementById("workerWeeklyList");
  if (workerWeeklyList) {
    workerWeeklyList.innerHTML = "";
    workerWeeklyList.style.display = "none";
  }

  ids.forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;

    select.innerHTML = "<option value=''>-- Seleccionar trabajador --</option>";

    workers.forEach((w, i) => {
      if (w.active === false) return;
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = w.name;

      select.appendChild(opt);
    });
  });
}

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

  const filtered = workers.filter((w) => {
    if (w.active === false) return false;
    const name = (w.name || "").toLowerCase();
    const cleanRut = (w.rut || "")
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
    div.innerHTML = `<strong>${worker.name}</strong><br><small style='color:#666;'>${worker.rut}</small>`;
    div.onclick = () => {
      const workerKey =
        getRutKey(worker.rut) || "name:" + getWorkerNameKey(worker.name);
      hiddenInput.value = workerKey;
      searchInput.value = worker.name + " (" + worker.rut + ")";
      list.style.display = "none";
      list.innerHTML = "";
    };
    list.appendChild(div);
  });

  list.style.display = "block";
}

function clearWorkerPagosSearch() {
  const searchInput = document.getElementById("searchWorkerPagos");
  const list = document.getElementById("workerPagosList");
  const hiddenInput = document.getElementById("filterPaymentsWorker");

  if (searchInput) searchInput.value = "";
  if (hiddenInput) hiddenInput.value = "";
  if (list) {
    list.style.display = "none";
    list.innerHTML = "";
  }
}

// =============================
// 📋 TABLA TRABAJADORES
// =============================

function filterWorkersDB() {
  renderWorkersTable();
}

function clearWorkerDBSearch() {
  const input = document.getElementById("searchWorkerDB");
  if (input) input.value = "";
  renderWorkersTable();
}

function renderWorkersTable() {
  const c = document.getElementById("workersTable");
  if (!c) return;

  if (workers.length === 0) {
    c.innerHTML = "<p>No hay trabajadores.</p>";
    return;
  }

  const searchRaw = (document.getElementById("searchWorkerDB")?.value || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .trim();

  const filtered = searchRaw
    ? workers.filter((w) => {
        const name = (w.name || "").toLowerCase();
        const rut = (w.rut || "")
          .toLowerCase()
          .replace(/\./g, "")
          .replace(/-/g, "");
        return name.includes(searchRaw) || rut.includes(searchRaw);
      })
    : workers;

  if (filtered.length === 0) {
    c.innerHTML = "<p>No se encontraron trabajadores.</p>";
    return;
  }

  let html = "<div class='table-container'><table>";
  html +=
    "<tr><th>Nombre</th><th>RUT</th><th>Dirección</th><th>Foto Carnet</th><th>Carpeta</th></tr>";

  filtered.forEach((w) => {
    html += "<tr>";

    html +=
      "<td>" +
      w.name +
      (w.active === false
        ? " <span style='color:#e74c3c; font-size:11px;'>(Inactivo)</span>"
        : "") +
      "</td>";
    html += "<td>" + w.rut + "</td>";
    html += "<td>" + (w.address || "-") + "</td>";

    html += "<td>";
    if (w.id_card_photo) {
      html +=
        "<img src='" +
        w.id_card_photo +
        "' style='width:60px; height:40px; object-fit:cover; border-radius:6px;'>";
    } else {
      html += "—";
    }
    html += "</td>";

    // 📁 BOTÓN CARPETA
    html += "<td>";
    html += "<button onclick=\"openWorkerFolder('" + w.rut + "')\">📁</button>";
    html += "</td>";

    html += "</tr>";
  });

  html += "</table></div>";

  c.innerHTML = html;
}

// =============================
// 🛠️ LABORES
// =============================

function loadLabors() {
  const select = document.getElementById("laborSelect");

  if (!select) return;

  select.innerHTML = "<option value=''>-- Seleccionar labor --</option>";

  labors.forEach((l) => {
    const opt = document.createElement("option");
    opt.value = l;
    opt.textContent = l;

    select.appendChild(opt);
  });
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

function normalizeLaborText(value) {
  return (value || "").trim().replace(/\s+/g, " ");
}

function getWorkerNameKey(value) {
  return (value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getRutKey(value) {
  return (value || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .replace(/\s/g, "")
    .trim();
}

function getLaborKey(value) {
  return normalizeLaborText(value).toLowerCase();
}

function normalizeFundoText(value) {
  const normalized = (value || "").trim().replace(/\s+/g, " ");
  return normalized.replace(/^fundo\s*/i, "").trim();
}

function getFundoKey(value) {
  return normalizeFundoText(value).toLowerCase();
}

function getFundoDisplay(value, fallback = "-") {
  const normalized = normalizeFundoText(value);
  if (!normalized) return fallback;
  return "Fundo " + normalized.toUpperCase();
}

function normalizeFundoForSave(value) {
  const normalized = normalizeFundoText(value);
  if (!normalized) return "";
  return "Fundo " + normalized.toUpperCase();
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

function getCanonicalLaborName(value) {
  const normalized = normalizeLaborText(value);
  if (!normalized) return "";

  const key = getLaborKey(normalized);
  const existing = labors.find((l) => getLaborKey(l) === key);
  return existing || normalized;
}

// =============================
// 🧾 PRODUCCIÓN
// =============================

function showProductionConfirmModal(
  { workerName, date, labor, quantity, total },
  onConfirm,
) {
  const existing = document.getElementById("productionConfirmModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "productionConfirmModal";
  modal.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;";

  modal.innerHTML = `
    <div style="background:white;padding:30px;border-radius:12px;max-width:420px;width:90%;box-shadow:0 4px 24px rgba(0,0,0,0.25);">
      <h3 style="margin:0 0 16px 0;font-size:16px;">Confirme registro de producción</h3>
      <p style="margin:6px 0;"><strong>Trabajador:</strong> ${workerName}</p>
      <p style="margin:6px 0;"><strong>Fecha:</strong> ${date}</p>
      <p style="margin:6px 0;"><strong>Labor:</strong> ${labor}</p>
      <p style="margin:6px 0;"><strong>Cantidad:</strong> ${quantity}</p>
      <p style="margin:6px 0;"><strong>Total:</strong> $${total.toLocaleString("es-CL")}</p>
      <div style="display:flex;gap:12px;margin-top:24px;justify-content:flex-end;">
        <button id="prodCancelBtn" style="padding:10px 20px;border-radius:8px;border:1px solid #ccc;background:#f5f5f5;color:#222;cursor:pointer;font-size:14px;">Cancelar</button>
        <button id="prodConfirmBtn" style="padding:10px 20px;border-radius:8px;border:none;background:#2d7a4f;color:white;cursor:pointer;font-size:14px;">Registrar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("prodConfirmBtn").onclick = async () => {
    modal.remove();
    await onConfirm();
  };

  document.getElementById("prodCancelBtn").onclick = () => {
    modal.remove();
  };
}

function registerWork() {
  const worker = workers[document.getElementById("workerSelect").value];

  const date = document.getElementById("workDate").value;

  let labor = normalizeLaborText(document.getElementById("laborSelect").value);

  const newLabor = normalizeLaborText(
    document.getElementById("newLabor").value,
  );
  const fundo = normalizeFundoForSave(
    document.getElementById("fundoProduction").value,
  );

  const quantity = Number(document.getElementById("quantity").value);

  const unitValue = Number(
    document
      .getElementById("unitValue")
      .value.replace(/\$/g, "")
      .replace(/\./g, ""),
  );

  if (newLabor) {
    labor = getCanonicalLaborName(newLabor);

    if (!labors.some((l) => getLaborKey(l) === getLaborKey(newLabor))) {
      labors.push(labor);
      localStorage.setItem("labors", JSON.stringify(labors));
      loadLabors();
    }
  } else {
    labor = getCanonicalLaborName(labor);
  }

  if (!worker || !date || !labor || quantity <= 0) {
    alert("Datos incompletos.");
    return;
  }

  // Validar si ya existe producción para el mismo trabajador (RUT) y día
  const existeMismoDia = history.some(
    (r) => r.rut === worker.rut && r.date === date,
  );
  if (existeMismoDia && editProductionIndex === null) {
    const continuar = confirm(
      "Ya existe un registro de producción para este trabajador en este día.\n¿Deseas agregar igualmente este nuevo registro?\n(Si no, presiona Cancelar para deshacer la información)",
    );
    if (!continuar) return;
  }

  const total = quantity * unitValue;

  showProductionConfirmModal(
    { workerName: worker.name, date, labor, quantity, total },
    async () => {
      const newRecord = {
        id: crypto.randomUUID(),
        name: worker.name,
        rut: worker.rut,
        date,
        labor,
        quantity,
        total,
        fundo: fundo || "",
        mandante_paid: false,
      };

      if (editProductionIndex !== null) {
        history[editProductionIndex] = newRecord;
        editProductionIndex = null;
        document.querySelector(
          "#viewProduction button[onclick='registerWork()']",
        ).textContent = "Registrar";
      } else {
        history.push(newRecord);
      }

      const cloudSave = await saveProductionToCloud({
        name: worker.name,
        rut: worker.rut,
        date,
        labor,
        quantity,
        total,
        fundo: fundo || "",
        mandante_paid: false,
      });

      if (cloudSave?.ok) {
        alert("✅ Guardado en Supabase OK");
      } else {
        alert(
          "⚠️ No se guardó en nube. Revise conexión/permisos y sincronice luego.",
        );
      }

      localStorage.setItem("history", JSON.stringify(history));

      renderHistory();
      // ===== LIMPIAR CAMPOS =====

      document.getElementById("workDate").value = "";
      document.getElementById("quantity").value = "";
    },
  );
}

// =============================
// 📜 HISTORIAL
// =============================

function renderHistory() {
  const c = document.getElementById("history");
  if (!c) return;

  if (history.length === 0) {
    c.innerHTML = "<p>No hay registros.</p>";
    return;
  }

  let html = "<div class='table-container'><table>";
  html +=
    "<tr><th>Fecha</th><th>Trabajador</th><th>Labor</th><th>Cantidad</th><th>Total</th></tr>";

  history.forEach((r) => {
    html += "<tr>";
    html += "<td>" + r.date + "</td>";
    html += "<td>" + r.name + "</td>";
    html += "<td>" + r.labor + "</td>";
    html += "<td>" + r.quantity + "</td>";
    html += "<td>$" + Number(r.total).toLocaleString("es-CL") + "</td>";
    html += "</tr>";
  });

  html += "</table></div>";

  c.innerHTML = html;
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
    html +=
      "<div onclick='selectWorkerWeekly(" +
      originalIndex +
      ', "' +
      worker.name.replace(/"/g, "&quot;") +
      "\")' style='padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;' onmouseover='this.style.background=\"#f0f0f0\"' onmouseout='this.style.background=\"white\"'>";
    html += "<strong>" + worker.name + "</strong><br>";
    html += "<small style='color: #666;'>" + worker.rut + "</small>";
    html += "</div>";
  });

  resultsList.innerHTML = html;
  resultsList.style.display = "block";
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

    div.onclick = () => {
      document.getElementById("searchWorkerProduction").value = w.name;
      document.getElementById("workerSelect").value = workers.indexOf(w);
      list.style.display = "none";
    };

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

function filterWorkersEdit() {
  const searchInput = document.getElementById("searchWorkerEdit");
  const list = document.getElementById("workerEditList");
  const hiddenSelect = document.getElementById("workerEditSelect");

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

    div.onclick = () => {
      const index = workers.indexOf(worker);
      hiddenSelect.value = index;
      searchInput.value = worker.name || "";
      list.style.display = "none";
      list.innerHTML = "";
      loadWorkerToEdit();
    };

    list.appendChild(div);
  });

  list.style.display = "block";
}

function clearWorkerEditSearch() {
  const searchInput = document.getElementById("searchWorkerEdit");
  const list = document.getElementById("workerEditList");
  const hiddenSelect = document.getElementById("workerEditSelect");

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

    div.onclick = () => {
      const index = workers.indexOf(worker);
      hiddenSelect.value = index;
      searchInput.value = worker.name || "";
      list.style.display = "none";
      list.innerHTML = "";
    };

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

    div.onclick = () => {
      const index = workers.indexOf(worker);
      hiddenSelect.value = index;
      searchInput.value = worker.name || "";
      list.style.display = "none";
      list.innerHTML = "";
    };

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

    div.onclick = () => {
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
    };

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

    div.onclick = () => {
      const index = workers.indexOf(w);
      hiddenSelect.value = index;
      document.getElementById("searchWorkerLiquidation").value = w.name;
      list.style.display = "none";
      list.innerHTML = "";
    };

    list.appendChild(div);
  });

  list.style.display = "block";
}

document.addEventListener("click", (event) => {
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

  const records = history.filter(
    (r) => r.rut === worker.rut && r.date.startsWith(month),
  );

  records.sort((a, b) => new Date(a.date) - new Date(b.date));
  const uniqueDates = [...new Set(records.map((r) => r.date))];
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

  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const blob = await createPdfBlobFromElement(exportRoot, { scale });

  document.body.removeChild(exportRoot);

  return blob;
}

async function createPdfBlobFromElement(element, { scale = 2 } = {}) {
  const { jsPDF } = window.jspdf;

  const canvas = await html2canvas(element, {
    scale,
    backgroundColor: "#ffffff",
  });

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
        margin: 0;
        font-size: 15px !important;
        line-height: 1.3 !important;
      }
      #contractPrint {
  font-family: "Times New Roman", serif;
  font-size: 15px;
  line-height: 1.35;
  color: #000;
}

#contractPrint p,
#contractPrint .clausula {
  margin: 4px 0;
  text-align: justify;
}

#contractPrint h1,
#contractPrint h2 {
  text-align: center;
  margin: 10px 0 6px 0;
  font-weight: bold;
}

#contractPrint .clausula {
  text-indent: 20px;
}
      #contractPrint h2.titulo-contrato {
        font-size: 16px !important;
        margin: 0 0 4px 0 !important;
        text-align: center;
      }
      #contractPrint h3 {
        font-size: 13px !important;
        margin: 2px 0 !important;
      }
      #contractPrint br {
        display: none !important;
      }
      .signatures {
        margin-top: 60px !important;
      }
      .line {
        width: 200px !important;
      }
      .sign-name,
      .sign-role,
      .sign-rut {
        width: 200px !important;
        font-size: 13px !important;
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

  // 🔹 COMPLETAR NOMBRE Y RUT
  document.getElementById("c_name").textContent = worker.name;
  document.getElementById("c_rut").textContent = worker.rut;
  document.getElementById("c_faena").textContent =
    document.getElementById("faena").value;
  document.getElementById("c_workerSign").textContent = worker.name;

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

  return history
    .filter(
      (r) =>
        r.rut === worker.rut &&
        r.paid === true &&
        DateHelper.isBetween(r.date, inicio, fin),
    )
    .reduce((sum, r) => sum + Number(r.total), 0);
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
  const workerIndex = document.getElementById("workerFiniquito").value;

  if (workerIndex === "") {
    alert("Seleccione un trabajador.");
    return;
  }

  const worker = workers[workerIndex];
  const endDate = (document.getElementById("f_endDate")?.value || "").trim();

  syncFiniquitoEndDate(endDate);

  const inicio = (
    document.getElementById("f_startDate")?.textContent || ""
  ).trim();
  const fin = (document.getElementById("f_endDate")?.value || "").trim();
  const sueldoMinimo = Number(localStorage.getItem("minimumWage") || 0);
  const totalCalculado = calcularTotalPagadoFiniquito(worker, inicio, fin);
  const totalPagado =
    sueldoMinimo > 0 ? Math.min(totalCalculado, sueldoMinimo) : totalCalculado;

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

  const records = history.filter(
    (r) => r.rut === worker.rut && r.date.startsWith(month),
  );

  const container = document.getElementById("monthlyResult");

  if (records.length === 0) {
    container.innerHTML = "<p>No hay producción ese mes.</p>";
    return;
  }

  // ===== CALCULAR DÍAS TRABAJADOS =====
  const uniqueDates = [...new Set(records.map((r) => r.date))];
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

  const records = history.filter((r) => r.date.startsWith(month));

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
    summary[r.rut].dates.add(r.date);
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

window.onload = async function () {
  if (localStorage.getItem("sessionActive") === "true") {
    document.getElementById("login").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");

    await initSystem();
  }
};

function focusFirstFieldInView(viewId) {
  requestAnimationFrame(() => {
    setTimeout(() => {
      const view = document.getElementById(viewId);
      if (!view) return;

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

      target.focus();
      if (typeof target.select === "function") {
        target.select();
      }
    }, 0);
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
    if (input) {
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
  localStorage.setItem("workers", JSON.stringify(workers));

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
  initSystem();
  console.log(
    "Sincronización automática con la nube ejecutada (evento online).",
  );
});

window.addEventListener("DOMContentLoaded", () => {
  initSystem();
  console.log("Sincronización automática con la nube ejecutada al iniciar.");
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

  const records = history.filter((r) => r.date.startsWith(month));

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
    "<button type='button' onclick='changeMonthMandante(-1)' style='border: none; background: none; cursor: pointer; font-size: 20px; padding: 5px 10px; color: #333;'>◀</button>";
  html +=
    "<span style='font-weight: bold; text-transform: capitalize;'>" +
    monthNames[monthNum] +
    " de " +
    year +
    "</span>";
  html +=
    "<button type='button' onclick='changeMonthMandante(1)' style='border: none; background: none; cursor: pointer; font-size: 20px; padding: 5px 10px; color: #333;'>▶</button>";
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
      "<div onclick='toggleDayMandante(\"" +
      dateStr +
      "\")' style='text-align:center; padding:8px; border-radius:50%; background:" +
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
    "<button type='button' onclick='clearSelectedDaysMandante()' style='border: none; background: none; color: #1a73e8; cursor: pointer; font-weight: 500;'>Borrar</button>";
  html +=
    "<button type='button' onclick='todayDateMandante()' style='border: none; background: none; color: #1a73e8; cursor: pointer; font-weight: 500;'>Hoy</button>";
  html += "</div>";

  html += "</div>";

  document.getElementById("calendarMandante").innerHTML = html;
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

function showCalendar(year = null, month = null) {
  const workerIndex = document.getElementById("workerWeekly").value;

  if (!workerIndex) {
    document.getElementById("calendarContainer").innerHTML = "";
    return;
  }

  // Si no se pasa año/mes, usar la fecha actual guardada
  if (year === null || month === null) {
    year = currentCalendarDate.getFullYear();
    month = currentCalendarDate.getMonth();
  } else {
    currentCalendarDate = new Date(year, month);
  }

  const monthNum = month;

  // Generar todos los días del mes
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

  // Header con navegación
  html +=
    "<div style='display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;'>";
  html +=
    "<button type='button' onclick='changeMonth(-1)' style='border: none; background: none; cursor: pointer; font-size: 20px; padding: 5px 10px; color: #333;'>◀</button>";
  html +=
    "<span style='font-weight: bold; text-transform: capitalize;'>" +
    monthNames[monthNum] +
    " de " +
    year +
    "</span>";
  html +=
    "<button type='button' onclick='changeMonth(1)' style='border: none; background: none; cursor: pointer; font-size: 20px; padding: 5px 10px; color: #333;'>▶</button>";
  html += "</div>";

  // Calendario
  html +=
    "<div style='display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;'>";

  // Encabezados de días
  dayNames.forEach((day) => {
    html +=
      "<div style='text-align: center; font-weight: bold; padding: 8px; font-size: 12px; color: #666;'>" +
      day +
      "</div>";
  });

  // Espacios vacíos antes del primer día
  for (let i = 0; i < firstDay; i++) {
    html += "<div style='padding: 8px;'></div>";
  }

  // Días del mes
  for (let day = 1; day <= daysInMonth; day++) {
    const monthStr = String(monthNum + 1).padStart(2, "0");
    const dateStr = year + "-" + monthStr + "-" + String(day).padStart(2, "0");
    const isSelected = selectedDays.has(dateStr);
    // 🔹 Detectar si ese día ya fue pagado
    const isPaid = history.some(
      (r) =>
        r.rut === workers[document.getElementById("workerWeekly").value]?.rut &&
        r.date === dateStr &&
        r.paid === true,
    );
    let bgColor = "transparent";
    let textColor = "#000";
    let fontWeight = "normal";
    let cursorStyle = "pointer";
    let clickAction = 'toggleDay("' + dateStr + '")';

    if (isPaid) {
      bgColor = "#d5f5e3"; // verde claro
      textColor = "#1e8449";
      fontWeight = "bold";
      cursorStyle = "not-allowed";
      clickAction = ""; // no permite clic
    } else if (isSelected) {
      bgColor = "#1a73e8";
      textColor = "white";
      fontWeight = "bold";
    }

    html +=
      "<div " +
      (clickAction ? "onclick='" + clickAction + "'" : "") +
      " style='text-align:center; padding:8px; border-radius:50%; background:" +
      bgColor +
      "; color:" +
      textColor +
      "; font-weight:" +
      fontWeight +
      "; cursor:" +
      cursorStyle +
      "; transition:all 0.2s;'>";

    html += isPaid ? "✔" : day;
    html += "</div>";
  }

  html += "</div>";

  // Botones inferiores
  html +=
    "<div style='display: flex; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;'>";
  if (pendingCalendarMode) {
    html +=
      "<button type='button' onclick='exitPendingCalendar()' style='border: none; background: none; color: #1a73e8; cursor: pointer; font-weight: 600;'>Volver</button>";
  } else {
    html +=
      "<button type='button' onclick='clearSelectedDays()' style='border: none; background: none; color: #1a73e8; cursor: pointer; font-weight: 500;'>Borrar</button>";
  }
  html +=
    "<button type='button' onclick='todayDate()' style='border: none; background: none; color: #1a73e8; cursor: pointer; font-weight: 500;'>Hoy</button>";
  html += "</div>";

  html += "</div>";

  document.getElementById("calendarContainer").innerHTML = html;
}

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

// 📊 RESUMEN SEMANAL - GENERAR CON DÍAS SELECCIONADOS
// =============================
function generateWeeklySummary() {
  const workerIndex = document.getElementById("workerWeekly").value;

  if (workerIndex === "") {
    alert("Seleccione un trabajador.");
    return;
  }

  const worker = workers[workerIndex];
  const account = worker.account_number || "-";

  // Obtener días seleccionados del Set
  let selectedDates = Array.from(selectedDays);
  selectedDates.sort();

  // Si no hay selección manual, cargar automáticamente los días pagados
  // del mes actual para este trabajador
  if (selectedDates.length === 0) {
    const year = currentCalendarDate.getFullYear();
    const monthStr = String(currentCalendarDate.getMonth() + 1).padStart(
      2,
      "0",
    );
    const prefix = year + "-" + monthStr + "-";
    const paidDates = [
      ...new Set(
        history
          .filter(
            (r) =>
              r.rut === worker.rut &&
              r.date.startsWith(prefix) &&
              r.paid === true,
          )
          .map((r) => r.date),
      ),
    ].sort();

    if (paidDates.length === 0) {
      alert(
        "No hay días pagados este mes. Seleccione los días en el calendario.",
      );
      return;
    }
    selectedDates = paidDates;
  }

  const startDateParts = (selectedDates[0] || "").split("-");
  const endDateParts = (selectedDates[selectedDates.length - 1] || "").split(
    "-",
  );
  const startDate = startDateParts.length === 3 ? startDateParts[2] : "-";
  const endDate = endDateParts.length === 3 ? endDateParts[2] : "-";

  // Filtrar registros solo de los días seleccionados
  const records = history.filter((r) => {
    return r.rut === worker.rut && selectedDates.includes(r.date);
  });

  if (records.length === 0) {
    alert("No hay registros en los días seleccionados.");
    return;
  }

  // Ocultar el calendario
  document.getElementById("calendarContainer").innerHTML = "";

  // ===== CALCULAR DÍAS TRABAJADOS =====
  const uniqueDates = [...new Set(records.map((r) => r.date))];
  const daysWorked = uniqueDates.length;

  // ===== CALCULAR TOTAL =====

  const resumen = {};

  records.forEach((r) => {
    const fundoKey = getFundoKey(r.fundo) || "sin-fundo";
    const key = fundoKey + "|" + getLaborKey(r.labor);

    if (!resumen[key]) {
      resumen[key] = {
        fundo: getFundoDisplay(r.fundo, "Sin fundo"),
        labor: r.labor,
        cantidad: 0,
        total: 0,
      };
    }

    resumen[key].cantidad += r.quantity;
    resumen[key].total += r.total;
  });

  let total = 0;
  let html = "<h3>Detalle de Días Seleccionados</h3>";

  html +=
    "<p><strong>Periodo pagado:</strong> " +
    startDate +
    " → " +
    endDate +
    "</p>";
  html += "<p><strong>Trabajador:</strong> " + worker.name + "</p>";
  html += "<p><strong>RUT:</strong> " + worker.rut + "</p>";
  html += "<p><strong>Número de Cuenta:</strong> " + account + "</p>";
  html += "<hr>";

  html +=
    "<button type='button' onclick='showCalendar()' style='margin-bottom: 15px; background: #3498db;'>📅 Modificar días seleccionados</button>";

  html += "<table>";
  html +=
    "<tr><th>Fecha</th><th>Fundo</th><th>Labor</th><th>Cantidad</th><th>Total</th><th>Acciones</th></tr>";

  records.forEach((r) => {
    total += r.total;

    const index = history.findIndex(
      (h) =>
        h.rut === r.rut &&
        h.date === r.date &&
        h.labor === r.labor &&
        h.quantity === r.quantity &&
        h.total === r.total &&
        (h.fundo || "") === (r.fundo || ""),
    );

    html += "<tr class='weeklyRow'>";
    html += "<td>" + r.date + "</td>";
    html += "<td>" + (r.fundo || "-") + "</td>";
    html += "<td>" + r.labor + "</td>";
    html += "<td>" + r.quantity + "</td>";
    html += "<td>$" + Number(r.total).toLocaleString("es-CL") + "</td>";
    html +=
      "<td><button style='background:#c0392b' onclick='deleteFromWeeklySummary(" +
      index +
      ")'>🗑️</button></td>";
    html += "</tr>";
  });

  html += "</table>";

  /*html += "<h3>Resumen para Mandante</h3>";*/

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
  let totalMandante = 0;

  Object.values(resumen).forEach((r) => {
    totalMandante += r.total;
  });

  html +=
    "<h2 style='margin-top:15px'>TOTAL PAGADO: $" +
    totalMandante.toLocaleString("es-CL") +
    "</h2>";

  html += "<p><strong>Días trabajados:</strong> " + daysWorked + "</p>";
  html +=
    "<h2 id='weeklyTotal'>Total: $" + total.toLocaleString("es-CL") + "</h2>";
  html += `
  <div class="action-right">
    <button type="button" class="btn-pay" onclick="payWeekly()">
      💰 Pagar
    </button>
  </div>
`;

  document.getElementById("weeklyResult").innerHTML = html;
}

async function payWeekly() {
  const workerIndex = document.getElementById("workerWeekly").value;

  if (workerIndex === "") {
    alert("No hay trabajador seleccionado.");
    return;
  }

  const worker = workers[workerIndex];

  const selectedDates = Array.from(selectedDays);

  if (selectedDates.length === 0) {
    alert("No hay días seleccionados.");
    return;
  }

  // Filtrar registros a pagar (excluir ya pagados para evitar doble pago)
  const recordsToPay = history.filter(
    (r) =>
      r.rut === worker.rut && selectedDates.includes(r.date) && r.paid !== true,
  );

  if (recordsToPay.length === 0) {
    alert("No hay registros para pagar.");
    return;
  }

  // 🔹 Calcular total UNA SOLA VEZ
  let totalToPay = 0;
  recordsToPay.forEach((r) => (totalToPay += r.total));

  const confirmPayment = confirm(
    "Se pagarán " +
      recordsToPay.length +
      " registros.\nTotal: $" +
      totalToPay.toLocaleString("es-CL") +
      "\n\n¿Confirmar pago?",
  );

  if (!confirmPayment) return;

  // Marcar como pagado en memoria
  recordsToPay.forEach((r) => {
    r.paid = true;
  });

  // 🔹 Actualizar en Supabase
  let paidUpdateErrors = 0;
  for (const record of recordsToPay) {
    if (record.id) {
      const { error } = await supabaseClient
        .from("history")
        .update({ paid: true })
        .eq("id", record.id);

      if (error) {
        paidUpdateErrors += 1;
        console.error("Error marcando pago en Supabase:", error.message);
      }
    }
  }
  // 🔹 GUARDAR REGISTRO EN TABLA payments

  const paymentRecord = {
    rut: worker.rut,
    name: worker.name,
    total_paid: totalToPay,
    payment_date: new Date().toISOString().split("T")[0],
    dates_paid: selectedDates,
  };

  const { error: paymentError } = await supabaseClient
    .from("payments")
    .insert([paymentRecord]);

  if (paymentError) {
    console.error("Error guardando pago:", paymentError);
  }

  localStorage.setItem("history", JSON.stringify(history));

  if (!paymentError && paidUpdateErrors === 0) {
    alert("✅ Guardado en Supabase OK (pago semanal).");
  } else {
    alert(
      "⚠️ No se guardó completo en nube el pago semanal. Revise conexión/permisos.",
    );
  }

  // 🔹 GENERAR PDF DETALLADO
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const today = new Date().toLocaleDateString("es-CL");

  doc.setFontSize(16);
  doc.text("COMPROBANTE DE PAGO SEMANAL", 20, 20);

  doc.setFontSize(12);
  doc.text("Trabajador: " + worker.name, 20, 35);
  doc.text("RUT: " + worker.rut, 20, 43);
  doc.text("Fecha de pago: " + today, 20, 51);

  doc.text("Detalle:", 20, 65);

  let y = 75;

  recordsToPay.forEach((r) => {
    const line =
      r.date +
      " | " +
      (r.fundo || "-") +
      " | " +
      r.labor +
      " | " +
      r.quantity +
      " | $" +
      Number(r.total).toLocaleString("es-CL");

    doc.text(line, 20, y);
    y += 8;

    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });

  y += 10;

  doc.setFontSize(14);
  doc.text("TOTAL PAGADO: $" + totalToPay.toLocaleString("es-CL"), 20, y);

  doc.save("Comprobante_Pago_" + worker.rut + ".pdf");

  // 🔹 GENERAR EXCEL
  const workbook = XLSX.utils.book_new();

  const todayExcel = new Date().toLocaleDateString("es-CL");

  // Construir datos
  let excelData = [];

  // Encabezado empresa
  excelData.push(["COMPROBANTE DE PAGO SEMANAL"]);
  excelData.push([]);
  excelData.push(["Trabajador:", worker.name]);
  excelData.push(["RUT:", worker.rut]);
  excelData.push(["Fecha de pago:", todayExcel]);
  excelData.push([]);

  // Encabezado tabla
  excelData.push(["Fecha", "Fundo", "Labor", "Cantidad", "Total"]);

  // Filas detalle
  recordsToPay.forEach((r) => {
    excelData.push([r.date, r.fundo || "-", r.labor, r.quantity, r.total]);
  });

  // Línea total
  excelData.push([]);
  excelData.push(["TOTAL PAGADO", "", "", "", totalToPay]);

  // Crear hoja
  const worksheet = XLSX.utils.aoa_to_sheet(excelData);

  // Agregar hoja al libro
  XLSX.utils.book_append_sheet(workbook, worksheet, "Pago Semanal");

  // Descargar archivo
  XLSX.writeFile(workbook, "Pago_Semanal_" + worker.rut + ".xlsx");

  // Limpiar selección
  selectedDays.clear();
  document.getElementById("weeklyResult").innerHTML = "";
}

// =============================
// ✏️ EDITAR ÚLTIMA PRODUCCIÓN
// =============================

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
    html +=
      "<td>" +
      "<button onclick='editProductionByIndex(" +
      index +
      ")'>✏️</button> " +
      '<button style="background:#c0392b" onclick=\'deleteProductionByIndex(' +
      index +
      ")'>🗑️</button>" +
      "</td>";
    html += "</tr>";
  });

  html += "</table>";

  container.innerHTML = html;
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

  document.querySelector(
    "#viewProduction button[onclick='registerWork()']",
  ).textContent = "Actualizar";

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
async function deleteFromWeeklySummary(index) {
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

  // Regenerar el resumen
  generateWeeklySummary();
}
// =============================
// RECALCULAR TOTAL SEMANAL
// =============================

function updateWeeklyTotal() {
  const checkboxes = document.querySelectorAll(
    "#weeklyResult input[type='checkbox']",
  );

  let total = 0;
  let paidDates = new Set();

  checkboxes.forEach((cb) => {
    if (cb.checked) {
      total += Number(cb.dataset.total);

      const row = cb.closest("tr");
      const date = row.children[1].textContent;

      paidDates.add(date);
    }
  });

  document.getElementById("weeklyTotal").textContent =
    "Total Semana: $" + total.toLocaleString("es-CL");

  document.getElementById("paidDays").textContent = paidDates.size;
}

function printWeeklySummary() {
  const container = document.getElementById("weeklyResult");

  if (!container) return;

  const rows = container.querySelectorAll("table tr");

  rows.forEach((row, index) => {
    if (index === 0) return; // encabezado

    const checkbox = row.querySelector("input[type='checkbox']");

    if (checkbox && !checkbox.checked) {
      row.style.display = "none";
    }
  });

  window.print();

  // restaurar vista después de imprimir
  rows.forEach((row) => {
    row.style.display = "";
  });
}
// =============================
// MARCAR / DESMARCAR TODA LA SEMANA
// =============================

async function markAllWeeklyPaid(state) {
  const checkboxes = document.querySelectorAll(
    "#weeklyResult input[type='checkbox']",
  );

  let failedUpdates = 0;

  for (const cb of checkboxes) {
    cb.checked = state;

    const id = cb.dataset.id;

    const { error } = await supabaseClient
      .from("history")
      .update({ paid: state })
      .eq("id", id);

    if (error) {
      failedUpdates += 1;
      console.error(
        "Error actualizando pago masivo en Supabase:",
        error.message,
      );
    }
  }

  updateWeeklyTotal();

  if (failedUpdates === 0) {
    alert("✅ Guardado en Supabase OK");
  } else {
    alert(
      "⚠️ No se guardó en nube parte del cambio masivo. Revise conexión/permisos.",
    );
  }
}

function generatePagosResumen() {
  const selectedWorkerKey =
    document.getElementById("filterPagosWorker")?.value ||
    document.getElementById("filterPaymentsWorker")?.value ||
    document.getElementById("workerResumenSelect")?.value ||
    "";

  const selectedWorker = workers.find((w) => {
    const workerKey = getRutKey(w.rut) || "name:" + getWorkerNameKey(w.name);
    return workerKey === selectedWorkerKey;
  });
  const selectedWorkerNameKey = selectedWorker
    ? getWorkerNameKey(selectedWorker.name)
    : "";

  if (history.length === 0) {
    alert("No hay registros.");
    return;
  }

  // ===== FASE 1: PRE-ESCANEO de TODO el historial =====
  // Se construyen los mapas de alias ANTES de agrupar, para que el orden
  // de los registros no afecte el resultado. "refugio" y "REFUGIO" quedan
  // con la misma clave canónica sin importar cuál llegue primero.
  const canonicalByRut = {};
  const canonicalByName = {};

  history.forEach((r) => {
    const rutKey = getRutKey(r.rut);
    const nameKey = getWorkerNameKey(r.name);

    const existing =
      (rutKey && canonicalByRut[rutKey]) ||
      (nameKey && canonicalByName[nameKey]);

    const canonical =
      existing || (rutKey ? "rut:" + rutKey : "name:" + nameKey);

    if (rutKey) canonicalByRut[rutKey] = canonical;
    if (nameKey) canonicalByName[nameKey] = canonical;
  });

  // ===== FASE 2: AGRUPACIÓN =====
  const resumenTrabajador = {};
  const resumenFundo = {};

  history
    .filter((r) => {
      if (!selectedWorkerKey) return true;

      const rutKey = getRutKey(r.rut);
      const nameKey = getWorkerNameKey(r.name);
      const recordWorkerKey =
        (rutKey && canonicalByRut[rutKey]) ||
        (nameKey && canonicalByName[nameKey]) ||
        "";

      if (recordWorkerKey === selectedWorkerKey) return true;

      // Fallback por nombre normalizado (cubre variantes de capitalización)
      if (
        selectedWorkerNameKey &&
        getWorkerNameKey(r.name) === selectedWorkerNameKey
      ) {
        return true;
      }

      return false;
    })
    .forEach((r) => {
      const totalValue = Number.isFinite(Number(r.total)) ? Number(r.total) : 0;
      const pagado = Boolean(r.paid);
      const fundoKey = getFundoKey(r.fundo) || "sin-fundo";
      const fundoLabel = getFundoDisplay(r.fundo, "Sin fundo");
      const rutKey = getRutKey(r.rut);
      const nameKey = getWorkerNameKey(r.name);

      const workerKey =
        (rutKey && canonicalByRut[rutKey]) ||
        (nameKey && canonicalByName[nameKey]) ||
        (rutKey ? "rut:" + rutKey : "name:" + nameKey);

      // ===== POR TRABAJADOR =====
      if (!resumenTrabajador[workerKey]) {
        resumenTrabajador[workerKey] = {
          key: workerKey,
          rut: r.rut,
          name: r.name,
          trabajado: 0,
          pagado: 0,
          pendiente: 0,
          diasPendientes: new Set(),
          laboresPendientes: {},
        };
      }

      if (!resumenTrabajador[workerKey].rut && r.rut) {
        resumenTrabajador[workerKey].rut = r.rut;
      }

      if (!resumenTrabajador[workerKey].name && r.name) {
        resumenTrabajador[workerKey].name = r.name;
      }

      resumenTrabajador[workerKey].trabajado += totalValue;

      if (pagado) {
        resumenTrabajador[workerKey].pagado += totalValue;
      } else {
        resumenTrabajador[workerKey].pendiente += totalValue;
        resumenTrabajador[workerKey].diasPendientes.add(r.date);

        if (!resumenTrabajador[workerKey].laboresPendientes[r.labor]) {
          resumenTrabajador[workerKey].laboresPendientes[r.labor] = 0;
        }
        resumenTrabajador[workerKey].laboresPendientes[r.labor] += totalValue;
      }

      // ===== POR FUNDO =====
      if (!resumenFundo[fundoKey]) {
        resumenFundo[fundoKey] = {
          label: fundoLabel,
          trabajado: 0,
          pagado: 0,
          pendiente: 0,
        };
      }

      resumenFundo[fundoKey].trabajado += totalValue;

      if (pagado) {
        resumenFundo[fundoKey].pagado += totalValue;
      } else {
        resumenFundo[fundoKey].pendiente += totalValue;
      }
    });

  let html = "<h3>Por Trabajador</h3>";

  html += "<table>";
  html += "<tr>";

  html += "<th>";
  html += "<select id='workerResumenSelect' onchange='generatePagosResumen()'>";
  html += "<option value=''>-- Todos --</option>";

  const seenWorkers = new Set();
  workers.forEach((w) => {
    const workerKey = getRutKey(w.rut) || "name:" + getWorkerNameKey(w.name);
    if (!workerKey || seenWorkers.has(workerKey)) {
      return;
    }

    seenWorkers.add(workerKey);

    const isSelected = workerKey === selectedWorkerKey ? " selected" : "";

    html +=
      "<option value='" +
      workerKey +
      "'" +
      isSelected +
      ">" +
      w.name +
      "</option>";
  });

  html += "</select>";
  html += "</th>";

  html += "<th>Total</th>";
  html += "<th>Pagado</th>";
  html += "<th>Pendiente</th>";
  html += "<th>Días Pendientes</th>";
  html += "<th>Labor Pendiente</th>";

  html += "</tr>";

  Object.values(resumenTrabajador).forEach((w) => {
    let laboresTexto = "";

    Object.entries(w.laboresPendientes).forEach(([labor, total]) => {
      laboresTexto += labor + " ($" + total.toLocaleString("es-CL") + ")<br>";
    });

    html += "<tr>";
    html += "<td>" + w.name + "</td>";
    html += "<td>$" + w.trabajado.toLocaleString("es-CL") + "</td>";
    html +=
      "<td style='color:green'>$" + w.pagado.toLocaleString("es-CL") + "</td>";
    html +=
      "<td style='color:red'>$" + w.pendiente.toLocaleString("es-CL") + "</td>";
    if (w.diasPendientes.size > 0) {
      const pendingDatesJson = JSON.stringify(Array.from(w.diasPendientes));
      html +=
        "<td>" +
        "<button type='button' onclick='showPendingDaysCalendar(\"" +
        w.rut +
        '", ' +
        pendingDatesJson +
        ")' style='background: none; border: none; color: #1a73e8; cursor: pointer; font-weight: 600; text-decoration: underline;'>" +
        w.diasPendientes.size +
        "</button>" +
        "</td>";
    } else {
      html += "<td>0</td>";
    }
    html += "<td>" + (laboresTexto || "-") + "</td>";
    html += "</tr>";
  });

  html += "</table>";

  html += "<h3 style='margin-top:30px;'>Por Fundo</h3>";
  html +=
    "<table><tr><th>Fundo</th><th>Total</th><th>Pagado</th><th>Pendiente</th></tr>";

  Object.values(resumenFundo).forEach((data) => {
    html += "<tr>";
    html += "<td>" + data.label + "</td>";
    html += "<td>$" + data.trabajado.toLocaleString("es-CL") + "</td>";
    html +=
      "<td style='color:green'>$" +
      data.pagado.toLocaleString("es-CL") +
      "</td>";
    html +=
      "<td style='color:red'>$" +
      data.pendiente.toLocaleString("es-CL") +
      "</td>";
    html += "</tr>";
  });

  html += "</table>";

  document.getElementById("pagosResult").innerHTML = html;
}

function exitWeeklyToPagos() {
  pendingCalendarMode = false;
  selectedDays.clear();
  const calendar = document.getElementById("calendarContainer");
  const weeklyResult = document.getElementById("weeklyResult");
  if (calendar) calendar.innerHTML = "";
  if (weeklyResult) weeklyResult.innerHTML = "";

  const workerWeekly = document.getElementById("workerWeekly");
  const searchWeekly = document.getElementById("searchWorkerWeekly");
  const listWeekly = document.getElementById("workerWeeklyList");
  if (workerWeekly) workerWeekly.value = "";
  if (searchWeekly) searchWeekly.value = "";
  if (listWeekly) {
    listWeekly.style.display = "none";
    listWeekly.innerHTML = "";
  }

  showView("viewPagos");
}

function clearWeeklySearch() {
  const searchInput = document.getElementById("searchWorkerWeekly");
  const resultsList = document.getElementById("workerWeeklyList");
  const hiddenSelect = document.getElementById("workerWeekly");
  const calendar = document.getElementById("calendarContainer");
  const weeklyResult = document.getElementById("weeklyResult");

  if (searchInput) searchInput.value = "";
  if (hiddenSelect) hiddenSelect.value = "";
  if (resultsList) {
    resultsList.style.display = "none";
    resultsList.innerHTML = "";
  }
  if (calendar) calendar.innerHTML = "";
  if (weeklyResult) weeklyResult.innerHTML = "";
  selectedDays.clear();
}

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
// =============================
// 📂 HISTORIAL DE PAGOS
// =============================

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
    html +=
      "<button onclick=\"deleteWorkerDocument('" +
      rut +
      "','" +
      file.name +
      "')\">🗑</button>";
    html += "</li>";
  });

  html += "</ul>";

  container.innerHTML = html;
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
