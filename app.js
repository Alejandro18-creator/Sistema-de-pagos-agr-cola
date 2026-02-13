
// =============================
// 🔐 CONFIGURACIÓN
// =============================

const PASSWORD = "1234";

let workers = JSON.parse(localStorage.getItem("workers")) || [];
let labors = JSON.parse(localStorage.getItem("labors")) || [];
let history = JSON.parse(localStorage.getItem("history")) || [];

let editWorkerIndex = null;


// =============================
// 🔐 LOGIN
// =============================

function loginUser() {

    const pass =
        document.getElementById("password").value;

    if (pass === PASSWORD) {

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

function initSystem() {
    loadWorkers();
    loadLabors();
    renderHistory();
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

    if (!name || !rut) {
        alert("Debe ingresar nombre y RUT.");
        return;
    }

    if (editWorkerIndex !== null) {

        workers[editWorkerIndex] =
            { name, rut, address };

        editWorkerIndex = null;

        alert("Trabajador actualizado.");

    } else {

        const exists =
            workers.some(w => w.rut === rut);

        if (exists) {
            alert("Trabajador ya existe.");
            return;
        }

        workers.push({ name, rut, address });

        alert("Trabajador guardado.");
    }

    localStorage.setItem("workers", JSON.stringify(workers));

    clearWorkerInputs();
    loadWorkers();
    renderWorkersTable();
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

    localStorage.setItem("history", JSON.stringify(history));

    renderHistory();
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

function formatRutInput(input) {
    input.value = input.value.toUpperCase();
}

function filterWorkersWeekly() {}
function generateLiquidation() {}
function generateContract() {}


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

