// =============================
// 🌐 SUPABASE CONEXIÓN
// =============================

console.log("APP VERSION 2");

const SUPABASE_URL = "https://nvqdctmqyziectwswiop.supabase.co";
const SUPABASE_KEY = "sb_publishable_z5b3f-BE_D5-T_bDFvafBw_I40wDjHa";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,    
);

let workers = JSON.parse(localStorage.getItem("workers")) || [];
let labors = JSON.parse(localStorage.getItem("labors")) || [];
let history = JSON.parse(localStorage.getItem("history")) || [];

/*☁️ GUARDAR EN SUPABASE*/
// =============================

async function saveWorkerToCloud(worker) {

    const { error } = await supabaseClient
        .from("workers")
        .insert([worker]);

    if (error) {
        console.error(
            "Error guardando en nube:",
            error.message
        );
    } else {
        console.log(
            "Trabajador guardado en Supabase"
        );
    }
}   

async function saveProductionToCloud(record) {

    const { error } = await supabaseClient
        .from("history")
        .insert([record]);

    if (error) {
        console.error("Error guardando producción:", error.message);
    } else {
        console.log("Producción guardada en Supabase");
    }
}

async function loadWorkersFromCloud() {

    const { data, error } = await supabaseClient
        .from("workers")
        .select("*");
        console.log("DATA:", data);

    if (error) {
        console.error("Error cargando trabajadores:", error.message);
        return;
    }

    workers = data || [];

    localStorage.setItem(
        "workers",
        JSON.stringify(workers)
    );

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

    localStorage.setItem(
        "history",
        JSON.stringify(history)
    );

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

    return "$" + Number(value)
        .toLocaleString("es-CL", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
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

    let value = input.value
        .replace(/[^0-9kK]/g, "")
        .toUpperCase();

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

    const pass =
        document.getElementById("password").value;

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
}




// =============================
// 👨‍🌾 TRABAJADORES
// =============================

function addWorker() {

    const name =
        document.getElementById("workerName").value.trim();

    const rut =
        document.getElementById("workerRut").value.trim();

    const address =
        document.getElementById("workerAddress").value.trim();
                const afp =
    document.getElementById("workerAFP").value.trim();

const health =
    document.getElementById("workerHealth").value.trim();

const position =
    document.getElementById("workerPosition").value.trim();

const entryDate =
    document.getElementById("workerEntryDate").value;

    const baseSalary =
    document.getElementById("workerBaseSalary").value.trim();

    if (!name || !rut || !entryDate) {
    alert("Falta completar campos obligatorios (Nombre, RUT y Fecha de ingreso).");
    return;
}

    else {

      let exists = false;

if (editIndexWorker === null) {

    // Solo validar duplicado si es nuevo
    exists = workers.some(w => w.rut === rut);

} else {

    // Validar duplicado excluyendo el editado
    exists = workers.some((w, index) =>
        w.rut === rut &&
        index != editIndexWorker
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
        baseSalary,
        entryDate
    };

    editIndexWorker = null;

} 
else {

    // ➕ NUEVO TRABAJADOR
    workers.push({
        name,
        rut,
        address,
        afp,
        health,
        position,
        baseSalary,
        entryDate
    });

    saveWorkerToCloud({
    name,
    rut,
    address,
    afp,
    health,
    position,
    baseSalary,
    entryDate
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

    const index =
        document.getElementById("workerEditSelect").value;

    if (index === "") return;

    const worker = workers[index];

    // 🧠 ACTIVAR MODO EDICIÓN
    editIndexWorker = index;

    document.getElementById("workerName").value =
        worker.name || "";

    document.getElementById("workerRut").value =
        worker.rut || "";

    document.getElementById("workerAddress").value =
        worker.address || "";

    document.getElementById("workerAFP").value =
        worker.afp || "";

    document.getElementById("workerHealth").value =
        worker.health || "";

    document.getElementById("workerPosition").value =
        worker.position || "";

    document.getElementById("workerBaseSalary").value =
        worker.baseSalary || "";

    document.getElementById("workerEntryDate").value =
        worker.entryDate || "";
}

function clearWorkerForm() {

    document.getElementById("workerEditSelect").value = "";

    document.getElementById("workerName").value = "";
    document.getElementById("workerRut").value = "";
    document.getElementById("workerAddress").value = "";
    document.getElementById("workerAFP").value = "";
    document.getElementById("workerHealth").value = "";
    document.getElementById("workerPosition").value = "";
    document.getElementById("workerBaseSalary").value = "";
    document.getElementById("workerEntryDate").value = "";
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
        "workerEditSelect"
    ];

    ids.forEach(id => {

        const select = document.getElementById(id);
        if (!select) return;

        select.innerHTML =
            "<option value=''>-- Seleccionar trabajador --</option>";

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

    workers.forEach(w => {

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

    const select =
        document.getElementById("laborSelect");

    if (!select) return;

    select.innerHTML =
        "<option value=''>-- Seleccionar labor --</option>";

    labors.forEach(l => {

        const opt = document.createElement("option");
        opt.value = l;
        opt.textContent = l;

        select.appendChild(opt);
    });
}


// =============================
// 🧾 PRODUCCIÓN
// =============================

function registerWork() {

    const worker =
        workers[
            document.getElementById("workerSelect").value
        ];

    const date =
        document.getElementById("workDate").value;

    let labor =
        document.getElementById("laborSelect").value;

    const newLabor =
        document.getElementById("newLabor").value.trim();

    const quantity =
        Number(document.getElementById("quantity").value);

    const unitValue =
        Number(
            document.getElementById("unitValue").value
            .replace(/\$/g,"")
            .replace(/\./g,"")
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

    history.push({
        name: worker.name,
        rut: worker.rut,
        date,
        labor,
        quantity,
        total
    });

    saveProductionToCloud({
    name: worker.name,
    rut: worker.rut,
    date,
    labor,
    quantity,
    total
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
    html += "<tr><th>Fecha</th><th>Trabajador</th><th>Labor</th><th>Cantidad</th><th>Total</th></tr>";

    history.forEach(r => {

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

    input.value =
        "$" + Number(value).toLocaleString("es-CL");
}

function filterWorkersWeekly() {}

function generateLiquidation() {

    const workerIndex =
        document.getElementById("workerLiquidation").value;

    const month =
        document.getElementById("monthLiquidation").value;

    if (workerIndex === "" || !month) {
        alert("Seleccione trabajador y mes.");
        return;
    }

    const worker = workers[workerIndex];

    // ===== PRODUCCIÓN DEL MES =====

    const records = history.filter(r =>
        r.rut === worker.rut &&
        r.date.startsWith(month)
    );

   // Ordenar de más antigua a más nueva
records.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (records.length === 0) {
        alert("No hay producción ese mes.");
        return;
    }

    const sueldoImponible =
        records.reduce((sum, r) => sum + r.total, 0);

    const semanaCorrida =
    Math.round(sueldoImponible * 0.10);

        const sueldoBase =
    Number(
        (worker.baseSalary || "0")
         .replace(/\$/g, "")
         .replace(/\./g, "")
    );

        // Gratificación (25% de imponible + base)
    const gratificacion =
    Math.round(
        (sueldoBase + sueldoImponible) * 0.25);

           const totalHaberes =
    sueldoBase + sueldoImponible + semanaCorrida + gratificacion;
    
    // ===== DESCUENTOS LEGALES =====

             const anticipos =
    Number(
        document
        .getElementById("advanceAmount")
        .value
        .replace(/\./g, "")
        || 0
    );

    const afp = Math.round(totalHaberes * 0.1127);
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
                    <td>AFP 11,27%</td>
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

    const container =
        document.getElementById("liquidationPrint");

    container.innerHTML = html;
    container.classList.remove("hidden");

    document.getElementById("liquidationPrint").classList.remove("hidden");
}
function generateContract() {}

function generateMonthlySummary() {

    const workerIndex =
        document.getElementById("workerMonthly").value;

    const month =
        document.getElementById("monthMonthly").value;

    if (workerIndex === "" || !month) {
        alert("Seleccione trabajador y mes.");
        return;
    }

    const worker = workers[workerIndex];

    const records = history.filter(r =>
        r.rut === worker.rut &&
        r.date.startsWith(month)
    );

    // ===== CALCULAR DÍAS TRABAJADOS =====

const uniqueDates = [...new Set(
    records.map(r => r.date)
)];

const daysWorked = uniqueDates.length;

    const container =
        document.getElementById("monthlyResult");

    if (records.length === 0) {
        container.innerHTML =
            "<p>No hay producción ese mes.</p>";
        return;
    }

    let total = 0;
    let html = "<h3>Detalle del Mes</h3>";
    html += "<table>";
    html += "<tr><th>Fecha</th><th>Labor</th><th>Cantidad</th><th>Total</th></tr>";

    records.forEach(r => {
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

    const month =
        document.getElementById("monthGeneral").value;

    if (!month) {
        alert("Seleccione un mes.");
        return;
    }

    const records = history.filter(r =>
        r.date.startsWith(month)
    );

    const container =
        document.getElementById("monthlyGeneralResult");

    if (records.length === 0) {
        container.innerHTML =
            "<p>No hay producción ese mes.</p>";
        return;
    }

    // Agrupar por RUT
    const summary = {};

    // ===== RESUMEN GENERAL POR LABOR DEL MES =====
    const laborSummary = {};

    records.forEach(r => {

        if (!summary[r.rut]) {
            summary[r.rut] = {
            name: r.name,
            total: 0,
            dates: new Set(),
            labors: {}
          };
        }
        if (!laborSummary[r.labor]) {
    laborSummary[r.labor] = {
        cantidad: 0,
        total: 0
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

    Object.values(summary).forEach(worker => {

        const daysWorked = worker.dates.size;

        totalGeneral += worker.total;

       let laborDetalle = "";

Object.entries(worker.labors).forEach(([labor, cantidad]) => {
    laborDetalle += labor + ": " + cantidad + "<br>";
});

html += "<tr>";
html += "<td>" + worker.name + "<br><small>" + laborDetalle + "</small></td>";
html += "<td>" + daysWorked + "</td>";
html += "<td>$" + worker.total.toLocaleString("es-CL") + "</td>";
html += "</tr>";
    });

    html += "</table>";

    html += "<h2>Total General del Mes: $" +
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

    document
        .querySelectorAll(".view")
        .forEach(function(v) {
            v.classList.add("hidden");
        });

    document
        .getElementById(id)
        .classList.remove("hidden");
}
// =============================
// 💾 EXPORTAR RESPALDO
// =============================

function exportData() {

    const data = {
        workers,
        history,
        labors
    };

    const json =
        JSON.stringify(data, null, 2);

    const blob =
        new Blob([json], {
            type: "application/json"
        });

    const url =
        URL.createObjectURL(blob);

    const a =
        document.createElement("a");

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

    const records = history.filter(r =>
        r.date.startsWith(month)
    );

    if (records.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }

    // Agrupar por trabajador
    const summary = {};

    records.forEach(r => {

        if (!summary[r.rut]) {
            summary[r.rut] = {
                name: r.name,
                total: 0,
                dates: new Set()
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

Object.values(summary).forEach(worker => {

    const daysWorked = worker.dates.size;
    totalGeneral += worker.total;

    csv +=
        worker.name + ";" +
        daysWorked + ";" +
        worker.total + "\n";
});

csv += "\nTotal General del Mes;;" + totalGeneral + "\n\n";

// ================================
// RESUMEN POR TIPO DE LABOR
// ================================

csv += "=== RESUMEN POR TIPO DE LABOR ===\n";
csv += "Labor;Cantidad Total;Total $\n";

Object.entries(laborSummary).forEach(([labor, data]) => {

    csv +=
        labor + ";" +
        data.cantidad + ";" +
        data.total + "\n";
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