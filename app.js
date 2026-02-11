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

    const exists =
        workers.some(w => w.rut === rut);

    if (exists) {
        alert("Trabajador ya existe.");
        return;
    }

    workers.push({ name, rut, address });

    localStorage.setItem(
        "workers",
        JSON.stringify(workers)
    );

    loadWorkers();
    renderWorkersTable();

    alert("Trabajador guardado.");
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

    if (editIndexProduction !== null) {

        history[editIndexProduction] = record;
        editIndexProduction = null;

    } else {

        history.push(record);
        lastProductionIndex =
            history.length - 1;
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

    history.forEach((r) => {

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

    const records = history.filter(item =>
        item.rut === worker.rut &&
        item.date.startsWith(month)
    );

    if (records.length === 0) {
        document.getElementById("monthlyResult")
            .innerHTML = "<p>No hay registros.</p>";
        return;
    }

    const uniqueDays =
        new Set(records.map(r => r.date));

    const daysWorked =
        uniqueDays.size;

    const laborSummary = {};

    records.forEach(r => {

        if (!laborSummary[r.labor]) {
            laborSummary[r.labor] = 0;
        }

        laborSummary[r.labor] += r.quantity;
    });

    const totalLabors =
        records.reduce(
            (sum, r) => sum + r.quantity,
            0
        );

    const totalAmount =
        records.reduce(
            (sum, r) => sum + r.total,
            0
        );

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

    html += `</table><br><h3>Resumen</h3>`;

    Object.keys(laborSummary).forEach(labor => {

        html += `
        <p>Total ${labor}: <strong>${laborSummary[labor]}</strong></p>
        `;
    });

    html += `
        <p><strong>Total Labores:</strong> ${totalLabors}</p>
        <p><strong>Días Trabajados:</strong> ${daysWorked}</p>
        <p><strong>Total Mes:</strong> $${totalAmount.toLocaleString("es-CL")}</p>
    `;

    document.getElementById("monthlyResult")
        .innerHTML = html;
}


// =============================
// 🧭 NAVEGACIÓN
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
}


// =============================
// 🔐 SESIÓN
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