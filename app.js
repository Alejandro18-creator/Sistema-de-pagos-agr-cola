// =============================
// 🌐 SUPABASE CONEXIÓN
// =============================

console.log("APP VERSION 2");

const SUPABASE_URL = "https://nvqdctmqyziectwswiop.supabase.co";
const SUPABASE_KEY = "sb_publishable_z5b3f-BE_D5-T_bDFvafBw_I40wDjHa";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
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
    console.error("Error guardando en nube:", error.message);
  } else {
    console.log("Trabajador guardado en Supabase");
  }
}

async function saveProductionToCloud(record) {
  const { error } = await supabaseClient.from("history").insert([record]);

  if (error) {
    console.error("Error guardando producción:", error.message);
  } else {
    console.log("Producción guardada en Supabase");
  }
}

async function loadWorkersFromCloud() {
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

function loginUser() {
  const pass = document.getElementById("password").value;

  if (pass === LOGIN_PASSWORD) {
    localStorage.setItem("sessionActive", "true");

    document.getElementById("login").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");

    initSystem();
  } else {
    alert("Contraseña incorrecta");
  }
}

function logout() {
  localStorage.removeItem("sessionActive");
  location.reload();
}

// =============================
// 🚀 INIT
// =============================
async function initSystem() {
  await loadWorkersFromCloud();
  await loadHistoryFromCloud();

  loadLabors();
  renderWorkersTable();
  loadAFPOptions();
}

// =============================
// 👨‍🌾 TRABAJADORES
// =============================

function addWorker() {
  const name = document.getElementById("workerName").value.trim();

  const rut = document.getElementById("workerRut").value.trim();

  const address = document.getElementById("workerAddress").value.trim();
  const afp = document.getElementById("workerAFP").value.trim();

  const health = document.getElementById("workerHealth").value.trim();

  const position = document.getElementById("workerPosition").value.trim();
  const nationality = document.getElementById("workerNationality").value.trim();



  if (!name || !rut) {
    alert(
      "Falta completar campos obligatorios (Nombre, RUT y Fecha de ingreso).",
    );
    return;
  } else {
    let exists = false;

    if (editIndexWorker === null) {
      // Solo validar duplicado si es nuevo
      exists = workers.some((w) => w.rut === rut);
    } else {
      // Validar duplicado excluyendo el editado
      exists = workers.some(
        (w, index) => w.rut === rut && index != editIndexWorker,
      );
    }

    if (exists) {
      alert("Trabajador ya existe.");
      return;
    }

    if (editIndexWorker !== null) {
      // ✏️ EDITAR EXISTENTE
      workers[editIndexWorker] = {
        name,
        rut,
        address,
        afp,
        health,
        position,
        nationality
      };

      editIndexWorker = null;
    } else {
      // ➕ NUEVO TRABAJADOR
      workers.push({
        name,
        rut,
        address,
        afp,
        health,
        position,
        nationality
      });

      saveWorkerToCloud({
        name,
        rut,
        address,
        afp,
        health,
        position,
        nationality
      });
    }

    alert("Trabajador guardado.");
  }

  localStorage.setItem("workers", JSON.stringify(workers));

  clearWorkerInputs();
  loadWorkers();
  renderWorkersTable();
}

function loadWorkerToEdit() {
  const index = document.getElementById("workerEditSelect").value;

  if (index === "") return;

  const worker = workers[index];

  // 🧠 ACTIVAR MODO EDICIÓN
  editIndexWorker = index;

  document.getElementById("workerName").value = worker.name || "";

  document.getElementById("workerRut").value = worker.rut || "";

  document.getElementById("workerAddress").value = worker.address || "";

  document.getElementById("workerAFP").value = worker.afp || "";

  document.getElementById("workerHealth").value = worker.health || "";

  document.getElementById("workerPosition").value = worker.position || "";

  document.getElementById("workerNationality").value = worker.nationality || "";
}

function clearWorkerForm() {
  document.getElementById("workerEditSelect").value = "";
  document.getElementById("workerName").value = "";
  document.getElementById("workerRut").value = "";
  document.getElementById("workerAddress").value = "";
  document.getElementById("workerAFP").value = "";
  document.getElementById("workerHealth").value = "";
  document.getElementById("workerPosition").value = "";
  document.getElementById("workerNationality").value = "";
}

function clearWorkerInputs() {
  document.getElementById("workerName").value = "";
  document.getElementById("workerRut").value = "";
  document.getElementById("workerAddress").value = "";
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
    "workerEditSelect",
  ];

  ids.forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;

    select.innerHTML = "<option value=''>-- Seleccionar trabajador --</option>";

    workers.forEach((w, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = w.name;

      select.appendChild(opt);
    });
  });
}

// =============================
// 📋 TABLA TRABAJADORES
// =============================

function renderWorkersTable() {
  const c = document.getElementById("workersTable");
  if (!c) return;

  if (workers.length === 0) {
    c.innerHTML = "<p>No hay trabajadores.</p>";
    return;
  }

  let html = "<div class='table-container'><table>";
  html += "<tr><th>Nombre</th><th>RUT</th><th>Dirección</th></tr>";

  workers.forEach((w) => {
    html += "<tr>";
    html += "<td>" + w.name + "</td>";
    html += "<td>" + w.rut + "</td>";
    html += "<td>" + (w.address || "-") + "</td>";
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

// =============================
// 🧾 PRODUCCIÓN
// =============================

function registerWork() {
  const worker = workers[document.getElementById("workerSelect").value];

  const date = document.getElementById("workDate").value;

  let labor = document.getElementById("laborSelect").value;

  const newLabor = document.getElementById("newLabor").value.trim();
  const fundo = document.getElementById("fundoProduction").value.trim();

  const quantity = Number(document.getElementById("quantity").value);

  const unitValue = Number(
    document
      .getElementById("unitValue")
      .value.replace(/\$/g, "")
      .replace(/\./g, ""),
  );

  if (newLabor) {
    labor = newLabor;

    if (!labors.includes(newLabor)) {
      labors.push(newLabor);
      localStorage.setItem("labors", JSON.stringify(labors));
      loadLabors();
    }
  }

  if (!worker || !date || !labor || quantity <= 0) {
    alert("Datos incompletos.");
    return;
  }

  const total = quantity * unitValue;

  const newRecord = {
    name: worker.name,
    rut: worker.rut,
    date,
    labor,
    quantity,
    total,
    fundo: fundo || "",
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

  saveProductionToCloud({
    name: worker.name,
    rut: worker.rut,
    date,
    labor,
    quantity,
    total,
    fundo: fundo || "",
  });

  localStorage.setItem("history", JSON.stringify(history));

  renderHistory();
  // ===== LIMPIAR CAMPOS =====

  document.getElementById("workDate").value = "";
  document.getElementById("quantity").value = "";
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

    if (!searchInput || !resultsList) return;

    const search = searchInput.value
        .toLowerCase()
        .replace(/\./g, "")
        .replace(/-/g, "")
        .trim();

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
        resultsList.innerHTML = "<div style='padding: 10px; color: #999;'>No se encontraron resultados</div>";
        resultsList.style.display = "block";
        return;
    }

    let html = "";
    filtered.forEach((worker, i) => {
        const originalIndex = workers.indexOf(worker);
        html += "<div onclick='selectWorkerWeekly(" + originalIndex + ", \"" + worker.name.replace(/"/g, '&quot;') + "\")' style='padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;' onmouseover='this.style.background=\"#f0f0f0\"' onmouseout='this.style.background=\"white\"'>";
        html += "<strong>" + worker.name + "</strong><br>";
        html += "<small style='color: #666;'>" + worker.rut + "</small>";
        html += "</div>";
    });

    resultsList.innerHTML = html;
    resultsList.style.display = "block";
}

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

function generateLiquidation() {
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

  // Ordenar de más antigua a más nueva
  records.sort((a, b) => new Date(a.date) - new Date(b.date));

  if (records.length === 0) {
    alert("No hay producción ese mes.");
    return;
  }

  const sueldoImponible = records.reduce((sum, r) => sum + r.total, 0);

  const semanaCorrida = Math.round(sueldoImponible * 0.1);

  const sueldoBase = Number(
    (worker.baseSalary || "0").replace(/\$/g, "").replace(/\./g, ""),
  );

  // Gratificación (25% de imponible + base)
  const gratificacion = Math.round((sueldoBase + sueldoImponible) * 0.25);

  const totalHaberes =
    sueldoBase + sueldoImponible + semanaCorrida + gratificacion;

  // ===== DESCUENTOS LEGALES =====

  const anticipos = Number(
    document.getElementById("advanceAmount").value.replace(/\./g, "") || 0,
  );

  console.log("AFP trabajador:", worker.afp);
  console.log("Tabla AFP:", afpRates);
  console.log("Comisión encontrada:", afpRates[worker.afp]);

  // =============================
  // CÁLCULO AFP REAL
  // =============================

  const afpName = worker.afp || "";

  const comisionAFP = afpRates[afpName] || 0;

  const porcentajeAFP = AFP_BASE + comisionAFP;
  console.log("Porcentaje AFP real:", porcentajeAFP);

  const afp = Math.round(totalHaberes * porcentajeAFP);

  const salud = Math.round(totalHaberes * 0.07);

  const totalDescuentos = afp + salud + anticipos;

  const liquido = totalHaberes - totalDescuentos;

  // ===== DOCUMENTO LEGAL =====

  const html = `
        <div class="liq-doc">

            <h1>LIQUIDACIÓN DE SUELDO</h1>
            <h3>${month}</h3>

            <p><strong>Nombre:</strong> ${worker.name}</p>
            <p><strong>RUT:</strong> ${worker.rut}</p>
            <p><strong>Cargo:</strong> ${worker.position || "-"}</p>
            <p><strong>AFP:</strong> ${worker.afp || "-"}</p>
            <p><strong>Salud:</strong> ${worker.health || "-"}</p>

            <hr>

            <h3>HABERES IMPONIBLES</h3>

            <table>
                
    <td>Sueldo Base</td>
    <td>$${sueldoBase.toLocaleString("es-CL")}</td>
</tr>

<tr>
    <td>Producción del Mes</td>
    <td>$${sueldoImponible.toLocaleString("es-CL")}</td>
</tr>

<tr>
    <td>Semana Corrida</td>
    <td>${formatMoney(semanaCorrida)}</td>
</tr>

    <tr>
    <td>Gratificación Legal 25%</td>
    <td>${formatMoney(gratificacion)}</td>
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

            <h2>
                LÍQUIDO A PAGAR:
               ${formatMoney(liquido)}
            </h2>

        </div>
    `;

  const container = document.getElementById("liquidationPrint");

  container.innerHTML = html;
  container.classList.remove("hidden");

  document.getElementById("liquidationPrint").classList.remove("hidden");
}
function generateContract() {

    const workerIndex = document.getElementById("workerContract").value;

    if (workerIndex === "") {
        alert("Seleccione un trabajador.");
        return;
    }

    const worker = workers[workerIndex];

    // 🔹 COMPLETAR NOMBRE Y RUT
    document.getElementById("c_name").textContent = worker.name;
    document.getElementById("c_rut").textContent = worker.rut;

    // 🔹 AQUÍ VA EL PASO 2 👇

    const startDate = document.getElementById("startDate").value;

    if (!startDate) {
        alert("Ingrese la fecha del contrato.");
        return;
    }

    const [year, monthNumber, day] = startDate.split("-");

const months = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

const month = months[parseInt(monthNumber) - 1];

    document.getElementById("c_day").textContent = day;
    document.getElementById("c_month").textContent = month;
    document.getElementById("c_year").textContent = year;
    document.getElementById("c_nationality").textContent = worker.nationality || "Chilena";

    alert("Contrato completado correctamente.");
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
    if (!summary[r.rut]) {
      summary[r.rut] = {
        name: r.name,
        total: 0,
        dates: new Set(),
        labors: {},
      };
    }
    if (!laborSummary[r.labor]) {
      laborSummary[r.labor] = {
        cantidad: 0,
        total: 0,
      };
    }
    laborSummary[r.labor].cantidad += r.quantity;
    laborSummary[r.labor].total += r.total;

    summary[r.rut].total += r.total;
    summary[r.rut].dates.add(r.date);
    if (!summary[r.rut].labors[r.labor]) {
      summary[r.rut].labors[r.labor] = 0;
    }
    summary[r.rut].labors[r.labor] += r.quantity;
  });

  let html = "<h3>Resumen General del Mes</h3>";

  // ===== MOSTRAR RESUMEN GENERAL POR LABOR =====
  html += "<h4>Labores realizadas en el mes</h4>";
  html += "<div class='table-container'><table>";
  html += "<tr><th>Labor</th><th>Cantidad</th><th>Total</th></tr>";

  Object.entries(laborSummary).forEach(([labor, data]) => {
    html += "<tr>";
    html += "<td>" + labor + "</td>";
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

    Object.entries(worker.labors).forEach(([labor, cantidad]) => {
      laborDetalle += labor + ": " + cantidad + "<br>";
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

    initSystem();
  }
};

function showView(id) {
  document.querySelectorAll(".view").forEach(function (v) {
    v.classList.add("hidden");
  });

  document.getElementById(id).classList.remove("hidden");
}

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

// =============================
// 🗑️ ELIMINAR TRABAJADOR
// =============================

async function deleteWorker() {
  const index = document.getElementById("workerEditSelect").value;

  if (index === "") {
    alert("Seleccione un trabajador para eliminar.");
    return;
  }

  const worker = workers[index];

  if (!confirm("¿Está seguro de eliminar este trabajador?")) return;

  // 🔹 1. Eliminar en Supabase
  const { error } = await supabaseClient
    .from("workers")
    .delete()
    .eq("rut", worker.rut);

  if (error) {
    console.error("Error eliminando en Supabase:", error.message);
    alert("Error al eliminar en la base de datos.");
    return;
  }

  // 🔹 2. Eliminar local
  workers.splice(index, 1);
  localStorage.setItem("workers", JSON.stringify(workers));

  // 🔹 3. Actualizar sistema
  loadWorkers();
  renderWorkersTable();
  clearWorkerForm();

  alert("Trabajador eliminado correctamente.");
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
  a.download = "respaldo_sistema.json";
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

  const records = history.filter((r) => r.date.startsWith(month));

  // ================================
  // RESUMEN POR TIPO DE LABOR
  // ================================

  const laborSummary = {};

  records.forEach((r) => {
    if (!laborSummary[r.labor]) {
      laborSummary[r.labor] = {
        cantidad: 0,
        total: 0,
      };
    }

    laborSummary[r.labor].cantidad += r.quantity;
    laborSummary[r.labor].total += r.total;
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

  Object.entries(laborSummary).forEach(([labor, data]) => {
    csv += labor + ";" + data.cantidad + ";" + data.total + "\n";
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
// 📊 RESUMEN SEMANAL - MOSTRAR CALENDARIO DEL MES
// =============================
let currentCalendarDate = new Date();
let selectedDays = new Set();

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
  
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const dayNames = ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá'];

  let html = "<div style='width: 350px; border: 1px solid #ccc; border-radius: 8px; padding: 15px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);'>";
  
  // Header con navegación
  html += "<div style='display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;'>";
  html += "<button type='button' onclick='changeMonth(-1)' style='border: none; background: none; cursor: pointer; font-size: 20px; padding: 5px 10px; color: #333;'>◀</button>";
  html += "<span style='font-weight: bold; text-transform: capitalize;'>" + monthNames[monthNum] + " de " + year + "</span>";
  html += "<button type='button' onclick='changeMonth(1)' style='border: none; background: none; cursor: pointer; font-size: 20px; padding: 5px 10px; color: #333;'>▶</button>";
  html += "</div>";
  
  // Calendario
  html += "<div style='display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;'>";
  
  // Encabezados de días
  dayNames.forEach(day => {
    html += "<div style='text-align: center; font-weight: bold; padding: 8px; font-size: 12px; color: #666;'>" + day + "</div>";
  });
  
  // Espacios vacíos antes del primer día
  for (let i = 0; i < firstDay; i++) {
    html += "<div style='padding: 8px;'></div>";
  }
  
  // Días del mes
  for (let day = 1; day <= daysInMonth; day++) {
    const monthStr = String(monthNum + 1).padStart(2, '0');
    const dateStr = year + "-" + monthStr + "-" + String(day).padStart(2, '0');
    const isSelected = selectedDays.has(dateStr);
    const bgColor = isSelected ? '#1a73e8' : 'transparent';
    const textColor = isSelected ? 'white' : '#000';
    const fontWeight = isSelected ? 'bold' : 'normal';
    
    html += "<div onclick='toggleDay(\"" + dateStr + "\")' style='text-align: center; padding: 8px; cursor: pointer; border-radius: 50%; background: " + bgColor + "; color: " + textColor + "; font-weight: " + fontWeight + "; transition: all 0.2s;' onmouseover='this.style.backgroundColor=\"" + (isSelected ? '#1557b0' : '#f0f0f0') + "\"' onmouseout='this.style.backgroundColor=\"" + bgColor + "\"'>";
    html += day;
    html += "</div>";
  }
  
  html += "</div>";
  
  // Botones inferiores
  html += "<div style='display: flex; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;'>";
  html += "<button type='button' onclick='clearSelectedDays()' style='border: none; background: none; color: #1a73e8; cursor: pointer; font-weight: 500;'>Borrar</button>";
  html += "<button type='button' onclick='todayDate()' style='border: none; background: none; color: #1a73e8; cursor: pointer; font-weight: 500;'>Hoy</button>";
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
  showCalendar(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth());
}

function clearSelectedDays() {
  selectedDays.clear();
  showCalendar(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth());
}

function todayDate() {
  currentCalendarDate = new Date();
  showCalendar();
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
  
  // Obtener días seleccionados del Set
  const selectedDates = Array.from(selectedDays);

  if (selectedDates.length === 0) {
    alert("Seleccione al menos un día del calendario.");
    return;
  }

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
  let total = 0;

  let html = "<h3>Detalle de Días Seleccionados</h3>";
  
  html += "<button type='button' onclick='showCalendar()' style='margin-bottom: 15px; background: #3498db;'>📅 Modificar días seleccionados</button>";

  html += "<table>";

  html +=
    "<tr><th>Fecha</th><th>Fundo</th><th>Labor</th><th>Cantidad</th><th>Total</th><th>Acciones</th></tr>";

  records.forEach((r) => {
    total += r.total;
    
    // Encontrar el índice real en history
    const index = history.findIndex(
      (h) =>
        h.rut === r.rut &&
        h.date === r.date &&
        h.labor === r.labor &&
        h.quantity === r.quantity &&
        h.total === r.total &&
        (h.fundo || "") === (r.fundo || "")
    );

    html += "<tr class='weeklyRow'>";

    html += "<td>" + r.date + "</td>";
    html += "<td>" + (r.fundo || "-") + "</td>";
    html += "<td>" + r.labor + "</td>";
    html += "<td>" + r.quantity + "</td>";
    html += "<td>$" + Number(r.total).toLocaleString("es-CL") + "</td>";
    html += "<td><button style='background:#c0392b' onclick='deleteFromWeeklySummary(" + index + ")'>🗑️</button></td>";

    html += "</tr>";
  });

  html += "</table>";

  html += "<p><strong>Días trabajados:</strong> " + daysWorked + "</p>";
  html +=
    "<p><strong>Días pagados:</strong> <span id='paidDays'>" +
    daysWorked +
    "</span></p>";
  html +=
    "<h2 id='weeklyTotal'>Total: $" +
    total.toLocaleString("es-CL") +
    "</h2>";

  document.getElementById("weeklyResult").innerHTML = html;
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

  for (const cb of checkboxes) {
    cb.checked = state;

    const id = cb.dataset.id;

    await supabaseClient.from("history").update({ paid: state }).eq("id", id);
  }

  updateWeeklyTotal();
}

function generatePagosResumen() {

    if (history.length === 0) {
        alert("No hay registros.");
        return;
    }

    const resumenTrabajador = {};
    const resumenFundo = {};

    history.forEach(r => {

        const total = Number(r.total);
        const pagado = r.paid === true || r.paid === 1;

        // ===== POR TRABAJADOR =====
        if (!resumenTrabajador[r.rut]) {
            resumenTrabajador[r.rut] = {
                name: r.name,
                trabajado: 0,
                pagado: 0,
                pendiente: 0
            };
        }

        resumenTrabajador[r.rut].trabajado += total;

        if (pagado) {
            resumenTrabajador[r.rut].pagado += total;
        } else {
            resumenTrabajador[r.rut].pendiente += total;
        }

        // ===== POR FUNDO =====
        const fundo = r.fundo || "Sin fundo";

        if (!resumenFundo[fundo]) {
            resumenFundo[fundo] = {
                trabajado: 0,
                pagado: 0,
                pendiente: 0
            };
        }

        resumenFundo[fundo].trabajado += total;

        if (pagado) {
            resumenFundo[fundo].pagado += total;
        } else {
            resumenFundo[fundo].pendiente += total;
        }

    });

    let html = "<h3>Por Trabajador</h3>";
    html += "<table><tr><th>Trabajador</th><th>Total</th><th>Pagado</th><th>Pendiente</th></tr>";

    Object.values(resumenTrabajador).forEach(w => {
        html += "<tr>";
        html += "<td>" + w.name + "</td>";
        html += "<td>$" + w.trabajado.toLocaleString("es-CL") + "</td>";
        html += "<td style='color:green'>$" + w.pagado.toLocaleString("es-CL") + "</td>";
        html += "<td style='color:red'>$" + w.pendiente.toLocaleString("es-CL") + "</td>";
        html += "</tr>";
    });

    html += "</table>";

    html += "<h3 style='margin-top:30px;'>Por Fundo</h3>";
    html += "<table><tr><th>Fundo</th><th>Total</th><th>Pagado</th><th>Pendiente</th></tr>";

    Object.entries(resumenFundo).forEach(([fundo, data]) => {
        html += "<tr>";
        html += "<td>" + fundo + "</td>";
        html += "<td>$" + data.trabajado.toLocaleString("es-CL") + "</td>";
        html += "<td style='color:green'>$" + data.pagado.toLocaleString("es-CL") + "</td>";
        html += "<td style='color:red'>$" + data.pendiente.toLocaleString("es-CL") + "</td>";
        html += "</tr>";
    });

    html += "</table>";

    document.getElementById("pagosResult").innerHTML = html;
}