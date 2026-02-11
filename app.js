// =============================
// 🔐 CONFIGURACIÓN
// =============================

const PASSWORD = "1234";

let workers = JSON.parse(localStorage.getItem("workers")) || [];
let labors = JSON.parse(localStorage.getItem("labors")) || [];
let history = JSON.parse(localStorage.getItem("history")) || [];

let editIndexProduction = null;
let lastProductionIndex = null;


// =============================
// 🔐 LOGIN
// =============================

function loginUser() {

    const passwordInput =
        document.getElementById("password").value;

    if (passwordInput === PASSWORD) {

        localStorage.setItem("sessionActive", "true");

        document.getElementById("login").classList.add("hidden");
        document.getElementById("app").classList.remove("hidden");

        loadWorkers();
        loadLabors();
        renderHistory();

    } else {
        alert("Contraseña incorrecta");
    }
}

function logout() {

    localStorage.removeItem("sessionActive");
    location.reload();
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

    if (!name || !rut) {
        alert("Debe ingresar nombre y RUT.");
        return;
    }

    // 🔎 VALIDAR RUT DUPLICADO
    const exists = workers.some(
        worker => worker.rut === rut
    );

    if (exists) {
        alert("Este trabajador ya está registrado.");
        return;
    }

    // ✅ GUARDAR
    workers.push({ name, rut, address });

    localStorage.setItem(
        "workers",
        JSON.stringify(workers)
    );

    alert("Trabajador registrado correctamente.");

    loadWorkers();

    // Limpiar campos
    document.getElementById("workerName").value = "";
    document.getElementById("workerRut").value = "";
    document.getElementById("workerAddress").value = "";
}


function loadWorkers() {

    const select =
        document.getElementById("workerSelect");

    if (!select) return;

    select.innerHTML = "";

    workers.forEach((worker, index) => {

        const option =
            document.createElement("option");

        option.value = index;
        option.textContent = worker.name;

        select.appendChild(option);
    });
    renderWorkersTable();
}


// =============================
// 🛠️ LABORES
// =============================

function loadLabors() {

    const select =
        document.getElementById("laborSelect");

    if (!select) return;

    select.innerHTML = "";

    labors.forEach(labor => {

        const option =
            document.createElement("option");

        option.value = labor;
        option.textContent = labor;

        select.appendChild(option);
    });
}


// =============================
// 🧾 REGISTRAR PRODUCCIÓN
// =============================

function registerWork() {

    const worker =
        workers[
            document.getElementById("workerSelect").value
        ];

    const date =
        document.getElementById("workDate").value;

    const labor =
        document.getElementById("laborSelect").value;

    const quantity =
        Number(document.getElementById("quantity").value);

    const unitValue =
        Number(
            document.getElementById("unitValue").value
            .replace(/\$/g, "")
            .replace(/\./g, "")
        );

    const observation =
        document.getElementById("observation").value;

    if (!worker || !date || quantity <= 0) {
        alert("Datos incompletos.");
        return;
    }

    const total = quantity * unitValue;

    const record = {
        name: worker.name,
        rut: worker.rut,
        date,
        labor,
        quantity,
        unitValue,
        total,
        observation
    };

    // MODO EDICIÓN
    if (editIndexProduction !== null) {

        history[editIndexProduction] = record;
        editIndexProduction = null;

    } else {

        history.push(record);
        lastProductionIndex = history.length - 1;
    }

    localStorage.setItem(
        "history",
        JSON.stringify(history)
    );

    renderHistory();
}


// =============================
// 📜 HISTORIAL
// =============================

function renderHistory() {

    const container =
        document.getElementById("history");

    if (!container) return;

    let html = `
    <table>
        <tr>
            <th>Fecha</th>
            <th>Trabajador</th>
            <th>Labor</th>
            <th>Cantidad</th>
            <th>Total</th>
        </tr>
    `;

    history.forEach((r, i) => {

        html += `
        <tr>
            <td>${r.date}</td>
            <td>${r.name}</td>
            <td>${r.labor}</td>
            <td>${r.quantity}</td>
            <td>$${r.total}</td>
        </tr>
        `;
    });

    html += "</table>";

    container.innerHTML = html;
}
// =============================
// 📊 RESUMEN MENSUAL
// =============================

function generateMonthlySummary() {

    const worker =
        workers[
            document.getElementById("workerMonthly").value
        ];

    const month =
        document.getElementById("monthMonthly").value;

    if (!worker || !month) {
        alert("Seleccione trabajador y mes.");
        return;
    }

    // =============================
    // 🔎 FILTRAR REGISTROS
    // =============================

    const records = history.filter(item =>
        item.rut === worker.rut &&
        item.date.startsWith(month)
    );

    if (records.length === 0) {
        document.getElementById("monthlyResult")
            .innerHTML = "<p>No hay registros.</p>";
        return;
    }

    // =============================
    // 📆 DÍAS TRABAJADOS
    // =============================

    const uniqueDays = new Set(
        records.map(r => r.date)
    );

    const daysWorked = uniqueDays.size;


    // =============================
    // 📊 CANTIDAD POR LABOR
    // =============================

    const laborSummary = {};

    records.forEach(r => {

        if (!laborSummary[r.labor]) {
            laborSummary[r.labor] = 0;
        }

        laborSummary[r.labor] += r.quantity;
    });


    // =============================
    // 📊 TOTAL LABORES (SUMA)
    // =============================

    const totalLabors = records.reduce(
        (sum, r) => sum + r.quantity,
        0
    );


    // =============================
    // 💰 TOTAL DINERO
    // =============================

    const totalAmount = records.reduce(
        (sum, item) => sum + item.total,
        0
    );


    // =============================
    // 📋 TABLA DETALLE
    // =============================

    let html = `
        <table>
            <tr>
                <th>Fecha</th>
                <th>Labor</th>
                <th>Cantidad</th>
                <th>Valor</th>
                <th>Total</th>
            </tr>
    `;

    records.forEach(r => {

        html += `
            <tr>
                <td>${r.date}</td>
                <td>${r.labor}</td>
                <td>${r.quantity}</td>
                <td>$${r.unitValue}</td>
                <td><strong>$${r.total}</strong></td>
            </tr>
        `;
    });

    html += `</table>`;


    // =============================
    // 📊 RESUMEN FINAL ABAJO
    // =============================

    html += `<br><h3>Resumen de Producción</h3>`;

    Object.keys(laborSummary).forEach(labor => {

        html += `
            <p>
            Total ${labor}: 
            <strong>${laborSummary[labor]}</strong>
            </p>
        `;
    });

    html += `

    <br>

    <p><strong>Total Labores:</strong> ${totalLabors}</p>

    <p><strong>Días Trabajados:</strong> ${daysWorked}</p>

    <p><strong>Total Mes:</strong> $${totalAmount
        .toLocaleString("es-CL")}</p>
    `;


    // =============================
    // 🖥️ MOSTRAR
    // =============================

    document.getElementById("monthlyResult")
        .innerHTML = html;
}
// =============================
// 📊 RESUMEN MENSUAL GENERAL
// =============================

function generateMonthlyGeneral() {

    const month =
        document.getElementById("monthGeneral").value;

    if (!month) {
        alert("Seleccione un mes.");
        return;
    }

    // Filtrar registros del mes
    const records = history.filter(item =>
        item.date.startsWith(month)
    );

    if (records.length === 0) {
        document.getElementById("monthlyGeneralResult")
            .innerHTML = "<p>No hay registros.</p>";
        return;
    }

    // Agrupar por trabajador
    const summary = {};

    records.forEach(r => {

        if (!summary[r.rut]) {
            summary[r.rut] = {
                name: r.name,
                total: 0
            };
        }

        summary[r.rut].total += r.total;
    });

    // Crear tabla
    let html = `
        <table>
            <tr>
                <th>Trabajador</th>
                <th>RUT</th>
                <th>Total Mes</th>
            </tr>
    `;

    let totalGeneral = 0;

    Object.keys(summary).forEach(rut => {

        html += `
            <tr>
                <td>${summary[rut].name}</td>
                <td>${rut}</td>
                <td><strong>$${summary[rut].total}</strong></td>
            </tr>
        `;

        totalGeneral += summary[rut].total;
    });

    html += `
        </table>
        <h3>Total General Mes: $${totalGeneral}</h3>
    `;

    document.getElementById("monthlyGeneralResult")
        .innerHTML = html;
}
// =============================
// 📊 RESUMEN SEMANAL
// =============================

function generateWeeklySummary() {

    const worker =
        workers[
            document.getElementById("workerWeekly").value
        ];

    const weekValue =
        document.getElementById("weekSelected").value;

    if (!worker || !weekValue) {
        alert("Seleccione trabajador y semana.");
        return;
    }

    const [year, week] =
        weekValue.split("-W");

    const records = history.filter(item => {

        if (item.rut !== worker.rut)
            return false;

        const date = new Date(item.date);

        const itemYear =
            date.getFullYear();

        const itemWeek =
            getWeekNumber(date);

        return itemYear == year &&
               itemWeek == week;
    });

    if (records.length === 0) {
        alert("No hay registros esa semana.");
        return;
    }

    // Total dinero
    const totalAmount =
        records.reduce(
            (sum, r) => sum + r.total,
            0
        );

    // Días trabajados
    const uniqueDays = new Set(
        records.map(r => r.date)
    );

    const daysWorked =
        uniqueDays.size;

    // Tabla
    let html = `
        <table>
            <tr>
                <th>Fecha</th>
                <th>Labor</th>
                <th>Cantidad</th>
                <th>Total</th>
            </tr>
    `;

    records.forEach(r => {

        html += `
            <tr>
                <td>${r.date}</td>
                <td>${r.labor}</td>
                <td>${r.quantity}</td>
                <td>$${r.total}</td>
            </tr>
        `;
    });

    html += `
        </table>

        <p><strong>Días trabajados:</strong> ${daysWorked}</p>

        <h3>Total Semana: $${totalAmount}</h3>
    `;

    document.getElementById("weeklyResult")
        .innerHTML = html;
}
function getWeekNumber(date) {

    const firstDayOfYear =
        new Date(date.getFullYear(), 0, 1);

    const pastDaysOfYear =
        (date - firstDayOfYear) / 86400000;

    return Math.ceil(
        (pastDaysOfYear +
        firstDayOfYear.getDay() + 1) / 7
    );
}
// =============================
// 📄 LIQUIDACIÓN PDF
// =============================

function generateLiquidation() {

    const worker =
        workers[
            document.getElementById("workerLiquidation").value
        ];

    const month =
        document.getElementById("monthLiquidation").value;

    if (!worker || !month) {
        alert("Seleccione trabajador y mes.");
        return;
    }

    const records = history.filter(item =>
        item.rut === worker.rut &&
        item.date.startsWith(month)
    );

    const totalAmount = records.reduce(
        (sum, item) => sum + item.total,
        0
    );

    createPDF(worker, month, records, totalAmount);
}
function createPDF(worker, month, records, totalAmount) {

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("LIQUIDACIÓN DE SUELDO", 20, 20);

    doc.setFontSize(12);
    doc.text(`Trabajador: ${worker.name}`, 20, 40);
    doc.text(`RUT: ${worker.rut}`, 20, 50);
    doc.text(`Mes: ${month}`, 20, 60);

    let y = 80;

    records.forEach(r => {

        doc.text(
            `${r.date} - ${r.labor} - $${r.total}`,
            20,
            y
        );

        y += 10;
    });

    doc.text(
        `Total a pagar: $${totalAmount}`,
        20,
        y + 10
    );

    doc.save(
        `Liquidacion_${worker.name}_${month}.pdf`
    );
}
// =============================
// 📄 CONTRATO PDF
// =============================

function generateContract() {

    const worker =
        workers[
            document.getElementById("workerContract").value
        ];

    if (!worker) {
        alert("Seleccione trabajador.");
        return;
    }

    const faena =
        document.getElementById("faena").value;

    const cargo =
        document.getElementById("cargo").value;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const text = `
CONTRATO DE TRABAJO

Trabajador: ${worker.name}
RUT: ${worker.rut}

Faena: ${faena}
Cargo: ${cargo}

Se firma el presente contrato laboral
según normativa vigente en Chile.
`;

    const lines =
        doc.splitTextToSize(text, 170);

    doc.text(lines, 20, 30);

    doc.save(
        `Contrato_${worker.name}.pdf`
    );
}
// =============================
// 💾 RESPALDO AUTOMÁTICO
// =============================

function autoBackup() {

    const data = {
        workers,
        labors,
        history
    };

    const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        { type: "application/json" }
    );

    const link =
        document.createElement("a");

    link.href =
        URL.createObjectURL(blob);

    link.download =
        "respaldo_automatico.json";

    link.click();
}
function exportData() {

    const data = {
        workers,
        labors,
        history
    };

    const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        { type: "application/json" }
    );

    const link =
        document.createElement("a");

    link.href =
        URL.createObjectURL(blob);

    link.download =
        "respaldo_manual.json";

    link.click();
}
function importData(event) {

    const file =
        event.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(e) {

        const data =
            JSON.parse(e.target.result);

        workers = data.workers || [];
        labors = data.labors || [];
        history = data.history || [];

        localStorage.setItem(
            "workers",
            JSON.stringify(workers)
        );

        localStorage.setItem(
            "labors",
            JSON.stringify(labors)
        );

        localStorage.setItem(
            "history",
            JSON.stringify(history)
        );

        alert("Respaldo importado.");
        location.reload();
    };

    reader.readAsText(file);
}
// =============================
// ✏️ EDITAR REGISTRO
// =============================

function editRecord(index) {

    const record = history[index];

    editIndexProduction = index;

    document.getElementById("workerSelect").value =
        workers.findIndex(
            w => w.rut === record.rut
        );

    document.getElementById("workDate").value =
        record.date;

    document.getElementById("quantity").value =
        record.quantity;

    document.getElementById("unitValue").value =
        "$" + record.unitValue
        .toLocaleString("es-CL");

    document.getElementById("observation").value =
        record.observation;

    document.getElementById("laborSelect").value =
        record.labor;

    showView("viewProduction");
}
function editLastProduction() {

    if (history.length === 0) {
        alert("No hay registros.");
        return;
    }

    const index = history.length - 1;

    const record = history[index];

    editIndexProduction = index;

    document.getElementById("workerSelect").value =
        workers.findIndex(
            w => w.rut === record.rut
        );

    document.getElementById("workDate").value =
        record.date;

    document.getElementById("quantity").value =
        record.quantity;

    document.getElementById("unitValue").value =
        "$" + record.unitValue
        .toLocaleString("es-CL");

    document.getElementById("observation").value =
        record.observation;

    document.getElementById("laborSelect").value =
        record.labor;

    showView("viewProduction");
}
function deleteLastProduction() {

    if (history.length === 0) {
        alert("No hay registros.");
        return;
    }

    const index = history.length - 1;
    const record = history[index];

    const message = `
¿Eliminar último registro?

Trabajador: ${record.name}
Fecha: ${record.date}
Labor: ${record.labor}
Cantidad: ${record.quantity}
Total: $${record.total}
`;

    if (!confirm(message)) return;

    history.splice(index, 1);

    localStorage.setItem(
        "history",
        JSON.stringify(history)
    );

    renderHistory();
}
// =============================
// 🧭 NAVEGACIÓN VISTAS
// =============================

function showView(viewId) {

    const views =
        document.querySelectorAll(".view");

    views.forEach(v =>
        v.classList.add("hidden")
    );

    document
        .getElementById(viewId)
        .classList.remove("hidden");

    // 🔄 Recargar datos antes de mostrar tabla
    if (viewId === "viewWorkersDB") {

        workers =
            JSON.parse(localStorage.getItem("workers")) || [];

        renderWorkersTable();
    }
}

// =============================
// 💰 FORMATO PESOS
// =============================

function formatCurrency(input) {

    let value = input.value
        .replace(/\D/g, "");

    if (value === "") {
        input.value = "";
        return;
    }

    value = Number(value)
        .toLocaleString("es-CL");

    input.value = "$" + value;
}
// =============================
// 🪪 FORMATO RUT
// =============================

function formatRutInput(input) {

    let value = input.value
        .replace(/\./g, "")
        .replace(/-/g, "")
        .toUpperCase();

    if (value.length === 0) {
        input.value = "";
        return;
    }

    let body = value.slice(0, -1);
    let dv = value.slice(-1);

    body = body.replace(
        /\B(?=(\d{3})+(?!\d))/g,
        "."
    );

    input.value = body + "-" + dv;
}
// =============================
// 📋 TABLA TRABAJADORES
// =============================

function renderWorkersTable() {

    const container =
        document.getElementById("workersTable");

    if (!container) return;

    if (workers.length === 0) {
        container.innerHTML =
            "<p>No hay trabajadores registrados.</p>";
        return;
    }

    let html = `
        <table>
            <tr>
                <th>Nombre</th>
                <th>RUT</th>
                <th>Dirección</th>
            </tr>
    `;

    workers.forEach(worker => {

        html += `
            <tr>
                <td>${worker.name}</td>
                <td>${worker.rut}</td>
                <td>${worker.address || "-"}</td>
            </tr>
        `;
    });

    html += "</table>";

    container.innerHTML = html;
}
// =============================
// 🔐 SESIÓN AL RECARGAR
// =============================

window.onload = function () {

    const session =
        localStorage.getItem("sessionActive");

    if (session === "true") {

        document
            .getElementById("login")
            .classList.add("hidden");

        document
            .getElementById("app")
            .classList.remove("hidden");

        loadWorkers();
        loadLabors();
        renderHistory();
    }
};
