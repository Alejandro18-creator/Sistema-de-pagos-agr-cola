/*TRABAJADORES - FORMULARIO*/
function clearWorkerForm() /*🧠 DESACTIVAR MODO EDICIÓN*/ {
  editIndexWorker = null; // Reiniciar el índice de edición a null para indicar que no se está editando ningún trabajador.
  document.getElementById("workerEditSelect").value =
    ""; /*Restablecer el valor del select de edición a vacío.*/
  const editSearch =
    document.getElementById(
      "searchWorkerEdit",
    ); /*Obtener el elemento de búsqueda de edición por su ID.*/
  const editList =
    document.getElementById(
      "workerEditList",
    ); /*Obtener el elemento de lista de edición por su ID.*/
  if (editSearch)
    editSearch.value =
      ""; /*Restablecer el valor del campo de búsqueda de edición a vacío.*/
  if (editList) {
    /*Si el elemento de lista de edición existe, ocultarlo y vaciar su contenido.*/
    editList.style.display = "none"; /*Ocultar la lista de edición.*/
    editList.innerHTML = ""; /*Vaciar el contenido de la lista de edición.*/
  }
  document.getElementById("workerName").value =
    ""; /*Restablecer el valor del campo de nombre del trabajador a vacío.*/
  document.getElementById("workerRut").value =
    ""; /*Restablecer el valor del campo de RUT del trabajador a vacío.*/
  document.getElementById("workerBirthDate").value =
    ""; /*Restablecer el valor del campo de fecha de nacimiento del trabajador a vacío.*/
  document.getElementById("workerMaritalStatus").value =
    ""; /*Restablecer el valor del campo de estado civil del trabajador a vacío.*/
  document.getElementById("workerAddress").value =
    ""; /*Restablecer el valor del campo de dirección del trabajador a vacío.*/
  document.getElementById("workerAFP").value =
    ""; /*Restablecer el valor del campo de AFP del trabajador a vacío.*/
  document.getElementById("workerHealth").value =
    ""; /*Restablecer el valor del campo de salud del trabajador a vacío.*/
  document.getElementById("workerPosition").value =
    ""; /*Restablecer el valor del campo de posición del trabajador a vacío.*/
  document.getElementById("workerNationality").value =
    ""; /*Restablecer el valor del campo de nacionalidad del trabajador a vacío.*/
  document.getElementById("workerAccount").value =
    ""; /*Restablecer el valor del campo de cuenta del trabajador a vacío.*/
}
function clearWorkerInputs() {
  /*Limpiar solo los campos de entrada del formulario sin afectar el modo de edición o selección.*/
  document.getElementById("workerName").value =
    ""; /*Restablecer el valor del campo de nombre del trabajador a vacío.*/
  document.getElementById("workerRut").value =
    ""; /*Restablecer el valor del campo de RUT del trabajador a vacío.*/
  document.getElementById("workerBirthDate").value =
    ""; /*Restablecer el valor del campo de fecha de nacimiento del trabajador a vacío.*/
  document.getElementById("workerMaritalStatus").value =
    ""; /*Restablecer el valor del campo de estado civil del trabajador a vacío.*/
  document.getElementById("workerAddress").value =
    ""; /*Restablecer el valor del campo de dirección del trabajador a vacío.*/
  document.getElementById("workerAFP").value =
    ""; /*Restablecer el valor del campo de AFP del trabajador a vacío.*/
  document.getElementById("workerHealth").value =
    ""; /*Restablecer el valor del campo de salud del trabajador a vacío.*/
  document.getElementById("workerPosition").value =
    ""; /*Restablecer el valor del campo de posición del trabajador a vacío.*/
}
function loadWorkerToEdit() {
  const index =
    document.getElementById(
      "workerEditSelect",
    ).value; /*Obtener el valor seleccionado en el select de edición, que corresponde al índice del trabajador a editar.*/

  if (index === "")
    return; /*Si no se ha seleccionado ningún trabajador (índice vacío), salir de la función sin hacer nada.*/

  const worker =
    workers[
      index
    ]; /*Obtener el objeto del trabajador correspondiente al índice seleccionado en el array de trabajadores.*/
  const editSearch =
    document.getElementById(
      "searchWorkerEdit",
    ); /*Obtener el elemento de búsqueda de edición por su ID.*/
  if (editSearch)
    editSearch.value =
      worker.name ||
      ""; /*Establecer el valor del campo de búsqueda de edición al nombre del trabajador seleccionado, o a vacío si no tiene nombre. Esto ayuda a mostrar el nombre del trabajador en el campo de búsqueda cuando se selecciona para editar.*/

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
function formatBirthDate(input) {
  let value = input.value.replace(/\D/g, "").slice(0, 8);
  if (value.length >= 5) {
    value = value.replace(/(\d{2})(\d{2})(\d{0,4})/, "$1/$2/$3");
  } else if (value.length >= 3) {
    value = value.replace(/(\d{2})(\d{0,2})/, "$1/$2");
  }
  input.value = value;
}

/*TRABAJADORES - TABLA Y LISTADOS*/

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
function filterWorkersDB() {
  renderWorkersTable();
}
function clearWorkerDBSearch() {
  const input = document.getElementById("searchWorkerDB");
  if (input) input.value = "";
  renderWorkersTable();
}

/*TRABAJADORES - EDICIÓN Y BUSCADOR*/
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
function clearWorkerContractSearch() {
  const searchInput = document.getElementById("searchWorkerContract");
  const list = document.getElementById("workerContractList");
  const hiddenSelect = document.getElementById("workerContractSelect");

  if (searchInput) searchInput.value = "";
  if (hiddenSelect) hiddenSelect.value = "";
  if (list) {
    list.style.display = "none";
    list.innerHTML = "";
  }
}