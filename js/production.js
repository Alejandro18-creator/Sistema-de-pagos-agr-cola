function clearSelectedDays() {
  selectedDays.clear();
  showCalendar(
    currentCalendarDate.getFullYear(),
    currentCalendarDate.getMonth()
  );
}

function clearWeeklySearch() {
  const searchInput = document.getElementById('searchWorkerWeekly');
  const resultsList = document.getElementById('workerWeeklyList');
  const hiddenSelect = document.getElementById('workerWeekly');
  const calendar = document.getElementById('calendarContainer');
  const weeklyResult = document.getElementById('weeklyResult');

  if (searchInput) searchInput.value = '';
  if (hiddenSelect) hiddenSelect.value = '';
  if (resultsList) {
    resultsList.style.display = 'none';
    resultsList.innerHTML = '';
  }
  if (calendar) calendar.innerHTML = '';
  if (weeklyResult) weeklyResult.innerHTML = '';
  selectedDays.clear();
}

function setupFundoSuggestions() {
  const fundoInput = document.getElementById('fundoProduction');
  if (!fundoInput || fundoInput.dataset.suggestionsReady === 'true') return;

  const suggestionBox = document.createElement('div');
  suggestionBox.style.position = 'absolute';
  suggestionBox.style.background = 'white';
  suggestionBox.style.border = '1px solid #ccc';
  suggestionBox.style.zIndex = 10000;
  suggestionBox.style.display = 'none';
  suggestionBox.style.maxHeight = '180px';
  suggestionBox.style.overflowY = 'auto';
  suggestionBox.className = 'fundo-suggestion-box';
  fundoInput.parentNode.insertBefore(suggestionBox, fundoInput.nextSibling);

  function showSuggestions() {
    let fundos = [];
    try {
      fundos = JSON.parse(localStorage.getItem('fundosHistoricos') || '[]');
    } catch {}

    const value = fundoInput.value.trim().toLowerCase();
    const filtered = value
      ? fundos.filter((f) => f.toLowerCase().includes(value))
      : fundos;

    if (filtered.length === 0) {
      suggestionBox.style.display = 'none';
      return;
    }

    suggestionBox.innerHTML = '';
    filtered.forEach((f) => {
      const item = document.createElement('div');
      item.textContent = f;
      item.style.padding = '6px 12px';
      item.style.cursor = 'pointer';
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        fundoInput.value = f;
        suggestionBox.style.display = 'none';
        fundoInput.dispatchEvent(new Event('input'));
      });
      suggestionBox.appendChild(item);
    });

    const rect = fundoInput.getBoundingClientRect();
    suggestionBox.style.left = rect.left + window.scrollX + 'px';
    suggestionBox.style.top = rect.bottom + window.scrollY + 'px';
    suggestionBox.style.width = rect.width + 'px';
    suggestionBox.style.display = 'block';
  }

  fundoInput.addEventListener('focus', showSuggestions);
  fundoInput.addEventListener('input', showSuggestions);
  fundoInput.addEventListener('blur', () => {
    setTimeout(() => (suggestionBox.style.display = 'none'), 120);
  });
  fundoInput.dataset.suggestionsReady = 'true';
}

window.addEventListener('DOMContentLoaded', setupFundoSuggestions);
// 🗑️ ELIMINAR DESDE RESUMEN SEMANAL
// =============================
async function deleteFromWeeklySummary({
  id,
  date,
  rut,
  labor,
  quantity,
  total,
  fundo,
  historyIndex,
}) {
  const ok = await showCustomConfirm('¿Está seguro de eliminar este registro?');
  if (!ok) return;

  // Buscar el índice del registro en el array local
  let index = -1;
  const parsedIndex = Number(historyIndex);
  if (
    Number.isInteger(parsedIndex) &&
    parsedIndex >= 0 &&
    parsedIndex < history.length
  ) {
    index = parsedIndex;
  }
  if (id && id !== 'undefined' && id !== '') {
    index = history.findIndex((r) => r.id == id);
  }
  if (index === -1) {
    // Fallback: buscar por todos los datos visibles de la fila
    index = history.findIndex(
      (r) =>
        r.rut === rut &&
        r.date === date &&
        r.labor === labor &&
        Number(r.quantity) === Number(quantity) &&
        Number(r.total) === Number(total) &&
        (r.fundo || '') === (fundo || '')
    );
  }
  if (index === -1 || !history[index]) {
    alert('No se encontró el registro localmente.');
    return;
  }
  const record = history[index];

  if (record.id || (record.rut && record.date)) {
    const reachability = await ensureSupabaseReachable();
    if (!reachability.ok) {
      alert('Error al eliminar en la base de datos. ' + reachability.errorMessage);
      return;
    }
  }

  // Eliminar de Supabase si tiene id
  if (record.id) {
    const { error } = await supabaseClient
      .from('history')
      .delete()
      .eq('id', record.id);

    if (error) {
      console.error('Error eliminando en Supabase:', error.message);
      alert('Error al eliminar en la base de datos.');
      return;
    }
  } else if (record.rut && record.date) {
    // Fallback: eliminar por datos completos de la fila cuando no hay id
    let deleteQuery = supabaseClient
      .from('history')
      .delete()
      .eq('rut', record.rut)
      .eq('date', record.date)
      .eq('labor', record.labor)
      .eq('quantity', Number(record.quantity))
      .eq('total', Number(record.total));

    if (record.fundo) {
      deleteQuery = deleteQuery.eq('fundo', record.fundo);
    }

    const { error } = await deleteQuery;
    if (error) {
      console.error('Error eliminando en Supabase:', error.message);
      alert('Error al eliminar en la base de datos.');
      return;
    }
  }

  // Eliminar local
  history.splice(index, 1);
  localStorage.setItem('history', JSON.stringify(history));

  showCustomAlert('Registro eliminado.');

  setTimeout(() => {
    document.getElementById('weeklyResult').innerHTML = '';
    generateWeeklySummary();
  }, 50);
}
/* PRODUCCIÓN - REGISTRO E HISTORIAL */
async function registerWork() {
  const worker = workers[document.getElementById('workerSelect').value];
  if (!worker) {
    alert('Seleccione un trabajador válido.');
    return;
  }
  if (worker.active === false) {
    await showCustomAlert(
      'No se puede registrar producción para un trabajador inactivo.'
    );
    return;
  }

  const date = document.getElementById('workDate').value;

  let labor = normalizeLaborText(document.getElementById('laborSelect').value);

  const newLabor = normalizeLaborText(
    document.getElementById('newLabor').value
  );
  const fundoInput = document.getElementById('fundoProduction');
  const fundo = normalizeFundoForSave(fundoInput.value);

  // Guardar el fundo en la lista de fundos históricos si es nuevo
  if (fundoInput.value) {
    let fundos = [];
    try {
      fundos = JSON.parse(localStorage.getItem('fundosHistoricos') || '[]');
    } catch {}
    const normalized = fundoInput.value.trim();
    if (normalized && !fundos.includes(normalized)) {
      fundos.push(normalized);
      localStorage.setItem('fundosHistoricos', JSON.stringify(fundos));
    }
  }

  const quantity = Number(document.getElementById('quantity').value);

  const unitValue = Number(
    document
      .getElementById('unitValue')
      .value.replace(/\$/g, '')
      .replace(/\./g, '')
  );

  if (newLabor) {
    labor = getCanonicalLaborName(newLabor);

    if (!labors.some((l) => getLaborKey(l) === getLaborKey(newLabor))) {
      labors.push(labor);
      localStorage.setItem('labors', JSON.stringify(labors));
      loadLabors();
    }
  } else {
    labor = getCanonicalLaborName(labor);
  }

  if (!worker || !date || !labor || quantity <= 0) {
    alert('Datos incompletos.');
    return;
  }

  // Validar si ya existe producción para el mismo trabajador (RUT) y día
  const existeMismoDia = history.some(
    (r) => r.rut === worker.rut && r.date === date
  );
  if (existeMismoDia && editProductionIndex === null) {
    const continuar = confirm(
      'Ya existe un registro de producción para este trabajador en este día.\n¿Deseas agregar igualmente este nuevo registro?\n(Si no, presiona Cancelar para deshacer la información)'
    );
    if (!continuar) return;
  }

  const total = quantity * unitValue;

  showProductionConfirmModal(
    { workerName: worker.name, date, labor, quantity, total },
    async () => {
      const currentEditIndex = editProductionIndex;
      const previousRecord =
        currentEditIndex !== null ? history[currentEditIndex] : null;
      const newRecord = {
        name: worker.name,
        rut: worker.rut,
        date,
        labor,
        quantity,
        total,
        fundo: fundo || '',
        mandante_paid: false,
      };

      if (currentEditIndex !== null) {
        history[currentEditIndex] = {
          ...previousRecord,
          ...newRecord,
        };
        editProductionIndex = null;
        document.querySelector(
          "#viewProduction button[onclick='registerWork()']"
        ).textContent = 'Registrar';
      } else {
        history.push(newRecord);
      }

      const targetRecord =
        currentEditIndex !== null
          ? history[currentEditIndex]
          : history[history.length - 1];

      const cloudSave =
        currentEditIndex !== null
          ? await updateProductionInCloud(previousRecord?.id, targetRecord)
          : await saveProductionToCloud(targetRecord);

      if (cloudSave?.ok && cloudSave.id && targetRecord) {
        targetRecord.id = cloudSave.id;
      }

      if (cloudSave?.ok) {
        showCustomAlert('✅ Guardado en Supabase OK');
      } else {
        alert(
          '⚠️ No se guardó en nube. Revise conexión/permisos y sincronice luego.'
        );
      }

      saveLocalDataDebounced();

      // Guardar el último fundo en localStorage
      if (fundoInput.value) {
        localStorage.setItem('lastFundoProduction', fundoInput.value);
      }

      renderHistory();
      // ===== LIMPIAR CAMPOS =====

      document.getElementById('workDate').value = '';
      document.getElementById('quantity').value = '';
      // No modificar el input de fundo aquí, solo guardar el último usado
    }
  );
}
function renderHistory() {
  const c = document.getElementById('history');
  if (!c) return;

  if (history.length === 0) {
    c.innerHTML = '<p>No hay registros.</p>';
    return;
  }

  let html = "<div class='table-container'><table>";
  html +=
    '<tr><th>Fecha</th><th>Trabajador</th><th>Labor</th><th>Cantidad</th><th>Total</th></tr>';

  history.slice(0, 200).forEach((r) => {
    html += '<tr>';
    html += '<td>' + r.date + '</td>';
    html += '<td>' + r.name + '</td>';
    html += '<td>' + r.labor + '</td>';
    html += '<td>' + r.quantity + '</td>';
    html += '<td>$' + Number(r.total).toLocaleString('es-CL') + '</td>';
    html += '</tr>';
  });

  html += '</table></div>';

  c.innerHTML = html;
}
function showProductionConfirmModal(
  { workerName, date, labor, quantity, total },
  onConfirm
) {
  const existing = document.getElementById('productionConfirmModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'productionConfirmModal';
  modal.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';

  modal.innerHTML = `
    <div style="background:white;padding:30px;border-radius:12px;max-width:420px;width:90%;box-shadow:0 4px 24px rgba(0,0,0,0.25);">
      <h3 style="margin:0 0 16px 0;font-size:16px;">Confirme registro de producción</h3>
      <p style="margin:6px 0;"><strong>Trabajador:</strong> ${workerName}</p>
      <p style="margin:6px 0;"><strong>Fecha:</strong> ${date}</p>
      <p style="margin:6px 0;"><strong>Labor:</strong> ${labor}</p>
      <p style="margin:6px 0;"><strong>Cantidad:</strong> ${quantity}</p>
      <p style="margin:6px 0;"><strong>Total:</strong> $${total.toLocaleString('es-CL')}</p>
      <div style="display:flex;gap:12px;margin-top:24px;justify-content:flex-end;">
        <button id="prodCancelBtn" style="padding:10px 20px;border-radius:8px;border:1px solid #ccc;background:#f5f5f5;color:#222;cursor:pointer;font-size:14px;">Cancelar</button>
        <button id="prodConfirmBtn" style="padding:10px 20px;border-radius:8px;border:none;background:#2d7a4f;color:white;cursor:pointer;font-size:14px;">Registrar</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('prodConfirmBtn').onclick = async () => {
    modal.remove();
    await onConfirm();
  };

  document.getElementById('prodCancelBtn').onclick = () => {
    modal.remove();
  };
}
/*PRODUCCIÓN - PAGO SEMANAL*/
async function payWeekly() {
  const workerIndex = document.getElementById('workerWeekly').value;

  if (workerIndex === '') {
    alert('No hay trabajador seleccionado.');
    return;
  }

  const worker = workers[workerIndex];

  const selectedDates = Array.from(selectedDays);

  if (selectedDates.length === 0) {
    alert('No hay días seleccionados.');
    return;
  }

  // Filtrar registros a pagar (excluir ya pagados para evitar doble pago)
  const recordsToPay = history.filter(
    (r) =>
      r.rut === worker.rut && selectedDates.includes(r.date) && r.paid !== true
  );

  if (recordsToPay.length === 0) {
    alert('No hay registros para pagar.');
    return;
  }

  // 🔹 Calcular total UNA SOLA VEZ
  let totalToPay = 0;
  recordsToPay.forEach((r) => (totalToPay += r.total));

  const confirmPayment = confirm(
    'Se pagarán ' +
      recordsToPay.length +
      ' registros.\nTotal: $' +
      totalToPay.toLocaleString('es-CL') +
      '\n\n¿Confirmar pago?'
  );

  if (!confirmPayment) return;

  // Marcar como pagado en memoria
  recordsToPay.forEach((r) => {
    r.paid = true;
  });

  // 🔹 Actualizar en Supabase
  let paidUpdateErrors = 0;
  const reachability = await ensureSupabaseReachable();
  const canSyncCloud = reachability.ok;
  for (const record of recordsToPay) {
    if (record.id && canSyncCloud) {
      const { error } = await supabaseClient
        .from('history')
        .update({ paid: true })
        .eq('id', record.id);

      if (error) {
        paidUpdateErrors += 1;
        console.error('Error marcando pago en Supabase:', error.message);
      }
    }
  }
  // 🔹 GUARDAR REGISTRO EN TABLA payments

  const paymentRecord = {
    rut: worker.rut,
    name: worker.name,
    total_paid: totalToPay,
    payment_date: new Date().toISOString().split('T')[0],
    dates_paid: selectedDates,
  };

  let paymentError = null;
  if (canSyncCloud) {
    const paymentResult = await supabaseClient.from('payments').insert([paymentRecord]);
    paymentError = paymentResult.error;
  } else {
    paymentError = { message: reachability.errorMessage };
  }

  if (paymentError) {
    console.error('Error guardando pago:', paymentError);
  }

  saveLocalDataDebounced();

  if (!paymentError && paidUpdateErrors === 0) {
    showCustomAlert('✅ Guardado en Supabase OK (pago semanal).');
  } else {
    alert(
      '⚠️ No se guardó completo en nube el pago semanal. ' +
        (paymentError?.message || 'Revise conexión/permisos.')
    );
  }

  // 🔹 GENERAR PDF DETALLADO
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const today = new Date().toLocaleDateString('es-CL');

  doc.setFontSize(16);
  doc.text('COMPROBANTE DE PAGO SEMANAL', 20, 20);

  doc.setFontSize(12);
  doc.text('Trabajador: ' + worker.name, 20, 35);
  doc.text('RUT: ' + worker.rut, 20, 43);
  doc.text('Fecha de pago: ' + today, 20, 51);

  doc.text('Detalle:', 20, 65);

  let y = 75;

  recordsToPay.forEach((r) => {
    const line =
      r.date +
      ' | ' +
      (r.fundo || '-') +
      ' | ' +
      r.labor +
      ' | ' +
      r.quantity +
      ' | $' +
      Number(r.total).toLocaleString('es-CL');

    doc.text(line, 20, y);
    y += 8;

    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });

  y += 10;

  doc.setFontSize(14);
  doc.text('TOTAL PAGADO: $' + totalToPay.toLocaleString('es-CL'), 20, y);

  doc.save('Comprobante_Pago_' + worker.rut + '.pdf');

  // 🔹 GENERAR EXCEL
  const workbook = XLSX.utils.book_new();

  const todayExcel = new Date().toLocaleDateString('es-CL');

  // Construir datos
  let excelData = [];

  // Encabezado empresa
  excelData.push(['COMPROBANTE DE PAGO SEMANAL']);
  excelData.push([]);
  excelData.push(['Trabajador:', worker.name]);
  excelData.push(['RUT:', worker.rut]);
  excelData.push(['Fecha de pago:', todayExcel]);
  excelData.push([]);

  // Encabezado tabla
  excelData.push(['Fecha', 'Fundo', 'Labor', 'Cantidad', 'Total']);

  // Filas detalle
  recordsToPay.forEach((r) => {
    excelData.push([r.date, r.fundo || '-', r.labor, r.quantity, r.total]);
  });

  // Línea total
  excelData.push([]);
  excelData.push(['TOTAL PAGADO', '', '', '', totalToPay]);

  // Crear hoja
  const worksheet = XLSX.utils.aoa_to_sheet(excelData);

  // Agregar hoja al libro
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pago Semanal');

  // Descargar archivo
  XLSX.writeFile(workbook, 'Pago_Semanal_' + worker.rut + '.xlsx');

  // Limpiar selección
  selectedDays.clear();
  document.getElementById('weeklyResult').innerHTML = '';
}
function generateWeeklySummary() {
  const workerIndex = document.getElementById('workerWeekly').value;

  if (workerIndex === '') {
    console.warn('Seleccione un trabajador');
    return;
    return;
  }

  const worker = workers[workerIndex];
  const account = worker.account_number || '-';

  // Obtener días seleccionados del Set
  let selectedDates = Array.from(selectedDays);
  selectedDates.sort();

  // Si no hay selección manual, cargar automáticamente los días pagados
  // del mes actual para este trabajador
  if (selectedDates.length === 0) {
    const year = currentCalendarDate.getFullYear();
    const monthStr = String(currentCalendarDate.getMonth() + 1).padStart(
      2,
      '0'
    );
    const prefix = year + '-' + monthStr + '-';
    const paidDates = [
      ...new Set(
        history
          .filter(
            (r) =>
              r.rut === worker.rut &&
              r.date.startsWith(prefix) &&
              r.paid === true
          )
          .map((r) => r.date)
      ),
    ].sort();

    if (paidDates.length === 0) {
      alert(
        'No hay días pagados este mes. Seleccione los días en el calendario.'
      );
      return;
    }
    selectedDates = paidDates;
  }

  const startDateParts = (selectedDates[0] || '').split('-');
  const endDateParts = (selectedDates[selectedDates.length - 1] || '').split(
    '-'
  );
  const startDate = startDateParts.length === 3 ? startDateParts[2] : '-';
  const endDate = endDateParts.length === 3 ? endDateParts[2] : '-';

  // Filtrar registros solo de los días seleccionados
  const records = history.filter((r) => {
    return r.rut === worker.rut && selectedDates.includes(r.date);
  });

  if (records.length === 0) {
    showCustomAlert('No hay registros en los días seleccionados.');
    return;
    return;
  }

  // Ocultar el calendario
  document.getElementById('calendarContainer').innerHTML = '';

  // ===== CALCULAR DÍAS TRABAJADOS =====
  const uniqueDates = [...new Set(records.map((r) => r.date))];
  const daysWorked = uniqueDates.length;

  // ===== CALCULAR TOTAL =====

  const resumen = {};

  records.forEach((r) => {
    const fundoKey = getFundoKey(r.fundo) || 'sin-fundo';
    const key = fundoKey + '|' + getLaborKey(r.labor);

    if (!resumen[key]) {
      resumen[key] = {
        fundo: getFundoDisplay(r.fundo, 'Sin fundo'),
        labor: r.labor,
        cantidad: 0,
        total: 0,
      };
    }

    resumen[key].cantidad += r.quantity;
    resumen[key].total += r.total;
  });

  let total = 0;
  let html = '<h3>Detalle de Días Seleccionados</h3>';

  html +=
    '<p><strong>Periodo pagado:</strong> ' +
    startDate +
    ' → ' +
    endDate +
    '</p>';
  html += '<p><strong>Trabajador:</strong> ' + worker.name + '</p>';
  html += '<p><strong>RUT:</strong> ' + worker.rut + '</p>';
  html += '<p><strong>Número de Cuenta:</strong> ' + account + '</p>';
  html += '<hr>';

  // ===== GENERAR TABLA DE REGISTROS CON BOTÓN ELIMINAR POR FILA =====
  html += '<table>';
  html +=
    '<tr><th>Fecha</th><th>Fundo</th><th>Labor</th><th>Cantidad</th><th>Total</th><th>Acción</th></tr>';
  records.forEach((r) => {
    const historyIndex = history.indexOf(r);
    html += '<tr>';
    html += '<td>' + r.date + '</td>';
    html += '<td>' + (r.fundo || '-') + '</td>';
    html += '<td>' + (r.labor || '-') + '</td>';
    html += '<td>' + (r.quantity || '-') + '</td>';
    html += '<td>$' + Number(r.total).toLocaleString('es-CL') + '</td>';
    html += `<td><button type="button" class="btn-delete-weekly" data-id="${r.id ?? ''}" data-date="${r.date}" data-rut="${r.rut}" data-labor="${r.labor}" data-quantity="${r.quantity}" data-total="${r.total}" data-fundo="${r.fundo || ''}" data-history-index="${historyIndex}">🗑️</button></td>`;
    html += '</tr>';
    total += r.total;
  });
  html += '</table>';

  // ===== BOTÓN ELIMINAR TODOS LOS REGISTROS DEL TRABAJADOR =====
  html += `
    <div style="display:flex;justify-content:flex-end;margin-top:10px;">
      <button type="button" class="btn-delete-all-worker" style="background:#e74c3c;color:white;padding:8px 16px;border:none;border-radius:4px;cursor:pointer;">🗑️ Eliminar TODOS los registros de este trabajador</button>
    </div>
  `;

  // ===== RESUMEN PARA MANDANTE Y TOTALES =====
  html += '<table>';
  html +=
    '<tr><th>Fundo</th><th>Labor</th><th>Cantidad</th><th>Total</th></tr>';
  Object.values(resumen).forEach((r) => {
    html += '<tr>';
    html += '<td>' + r.fundo + '</td>';
    html += '<td>' + r.labor + '</td>';
    html += '<td>' + r.cantidad + '</td>';
    html += '<td>$' + r.total.toLocaleString('es-CL') + '</td>';
    html += '</tr>';
  });
  html += '</table>';
  let totalMandante = 0;
  Object.values(resumen).forEach((r) => {
    totalMandante += r.total;
  });
  html +=
    "<h2 style='margin-top:15px'>TOTAL PAGADO: $" +
    totalMandante.toLocaleString('es-CL') +
    '</h2>';
  html += '<p><strong>Días trabajados:</strong> ' + daysWorked + '</p>';
  html +=
    "<h2 id='weeklyTotal'>Total: $" + total.toLocaleString('es-CL') + '</h2>';
  html += `
    <div class="action-right">
      <button type="button" class="btn-pay">
        💰 Pagar
      </button>
    </div>
  `;

  document.getElementById('weeklyResult').innerHTML = html;

  // ===== ASIGNAR EVENTOS CSP-COMPLIANT =====
  // Botón eliminar por fila
  document.querySelectorAll('.btn-delete-weekly').forEach((btn) => {
    btn.addEventListener('click', function () {
      const id = this.getAttribute('data-id');
      const date = this.getAttribute('data-date');
      const rut = this.getAttribute('data-rut');
      const labor = this.getAttribute('data-labor');
      const quantity = this.getAttribute('data-quantity');
      const total = this.getAttribute('data-total');
      const fundo = this.getAttribute('data-fundo');
      const historyIndex = this.getAttribute('data-history-index');
      deleteFromWeeklySummary({
        id,
        date,
        rut,
        labor,
        quantity,
        total,
        fundo,
        historyIndex,
      });
    });
  });
  // Botón eliminar todos
  const btnDeleteAll = document.querySelector('.btn-delete-all-worker');
  if (btnDeleteAll) {
    btnDeleteAll.addEventListener('click', async function () {
      const workerIndex = Number(document.getElementById('workerWeekly').value);

      if (isNaN(workerIndex) || !workers[workerIndex]) {
        alert('No hay trabajador seleccionado.');
        return;
      }

      const worker = workers[workerIndex];

      let selectedDates = Array.from(window.selectedDays || []);
      const ok = await showCustomConfirm(
        '¿Seguro que deseas eliminar TODOS los registros de este trabajador? Esta acción no se puede deshacer.'
      );

      if (!ok) return;
      let deleted = 0;
      const reachability = await ensureSupabaseReachable();
      const canSyncCloud = reachability.ok;
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].rut === worker.rut) {
          if (
            canSyncCloud &&
            history[i].id &&
            typeof supabaseClient?.from === 'function'
          ) {
            try {
              await supabaseClient
                .from('history')
                .delete()
                .eq('id', history[i].id);
            } catch (e) {}
          }
          history.splice(i, 1);
          deleted++;
        }
      }
      localStorage.setItem('history', JSON.stringify(history));
      const message = canSyncCloud
        ? `Registros eliminados: ${deleted}`
        : `Registros eliminados localmente: ${deleted}. ${reachability.errorMessage}`;
      await showCustomAlert(message);

      document.getElementById('weeklyResult').innerHTML =
        '<p>No hay registros para mostrar.</p>';

      generateWeeklySummary();
    });
  }
  // Botón pagar
  const payBtn = document.querySelector('.btn-pay');
  if (payBtn) payBtn.addEventListener('click', payWeekly);
  // Botón mostrar calendario (si existe)
  const showCalBtn = document.querySelector('.btn-show-calendar');
  if (showCalBtn) showCalBtn.addEventListener('click', showCalendar);
}
function showCalendar(year = null, month = null) {
  const workerIndex = document.getElementById('workerWeekly').value;

  if (!workerIndex) {
    document.getElementById('calendarContainer').innerHTML = '';
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
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  const dayNames = ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá'];

  let html =
    "<div style='width: 350px; border: 1px solid #ccc; border-radius: 8px; padding: 15px; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);'>";

  // Header con navegación
  html +=
    "<div style='display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;'>";
  html +=
    "<button type='button' class='btn-month' data-dir='-1' style='border: none; background: none; cursor: pointer; font-size: 20px; padding: 5px 10px; color: #333;'>◀</button>";
  html +=
    "<span style='font-weight: bold; text-transform: capitalize;'>" +
    monthNames[monthNum] +
    ' de ' +
    year +
    '</span>';
  html +=
    "<button type='button' class='btn-month' data-dir='1' style='border: none; background: none; cursor: pointer; font-size: 20px; padding: 5px 10px; color: #333;'>▶</button>";
  html += '</div>';

  // Calendario
  html +=
    "<div style='display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px;'>";

  // Encabezados de días
  dayNames.forEach((day) => {
    html +=
      "<div style='text-align: center; font-weight: bold; padding: 8px; font-size: 12px; color: #666;'>" +
      day +
      '</div>';
  });

  // Espacios vacíos antes del primer día
  for (let i = 0; i < firstDay; i++) {
    html += "<div style='padding: 8px;'></div>";
  }

  // Días del mes
  for (let day = 1; day <= daysInMonth; day++) {
    const monthStr = String(monthNum + 1).padStart(2, '0');
    const dateStr = year + '-' + monthStr + '-' + String(day).padStart(2, '0');
    const isSelected = selectedDays.has(dateStr);
    // 🔹 Detectar si ese día ya fue pagado
    const isPaid = history.some(
      (r) =>
        r.rut === workers[document.getElementById('workerWeekly').value]?.rut &&
        r.date === dateStr &&
        r.paid === true
    );
    let bgColor = 'transparent';
    let textColor = '#000';
    let fontWeight = 'normal';
    let cursorStyle = 'pointer';
    let clickAction = 'toggleDay("' + dateStr + '")';

    if (isPaid) {
      bgColor = '#d5f5e3'; // verde claro
      textColor = '#1e8449';
      fontWeight = 'bold';
      cursorStyle = 'not-allowed';
      clickAction = ''; // no permite clic
    } else if (isSelected) {
      bgColor = '#1a73e8';
      textColor = 'white';
      fontWeight = 'bold';
    }

    html +=
      "<div class='calendar-day' data-date='" +
      dateStr +
      "' style='text-align:center; padding:8px; border-radius:50%; background:" +
      bgColor +
      '; color:' +
      textColor +
      '; font-weight:' +
      fontWeight +
      '; cursor:' +
      cursorStyle +
      "; transition:all 0.2s;'>";
    html += isPaid ? '✔' : day;
    html += '</div>';
  }

  html += '</div>';

  // Botones inferiores
  html +=
    "<div style='display: flex; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;'>";
  if (pendingCalendarMode) {
    html +=
      "<button type='button' class='btn-exit-pending' style='border: none; background: none; color: #1a73e8; cursor: pointer; font-weight: 600;'>Volver</button>";
  } else {
    html +=
      "<button type='button' class='btn-clear' style='border: none; background: none; color: #1a73e8; cursor: pointer; font-weight: 500;'>Borrar</button>";
  }
  html +=
    "<button type='button' class='btn-today' style='border: none; background: none; color: #1a73e8; cursor: pointer; font-weight: 500;'>Hoy</button>";
  html += '</div>';

  html += '</div>';

  document.getElementById('calendarContainer').innerHTML = html;

  // Asignar eventos CSP-compliant
  document.querySelectorAll('.btn-month').forEach((btn) => {
    btn.addEventListener('click', function () {
      changeMonth(Number(this.getAttribute('data-dir')));
    });
  });
  document.querySelectorAll('.calendar-day').forEach((day) => {
    if (day.style.cursor !== 'not-allowed') {
      day.addEventListener('click', function () {
        toggleDay(this.getAttribute('data-date'));
      });
    }
  });
  const exitBtn = document.querySelector('.btn-exit-pending');
  if (exitBtn) exitBtn.addEventListener('click', exitPendingCalendar);
  const clearBtn = document.querySelector('.btn-clear');
  if (clearBtn) clearBtn.addEventListener('click', clearSelectedDays);
  const todayBtn = document.querySelector('.btn-today');
  if (todayBtn) todayBtn.addEventListener('click', todayDate);
}
/*PRODUCCIÓN - FILTROS DE PAGOS*/
// =============================
// PRODUCCIÓN - FILTROS DE PAGOS
// =============================
function loadPagosWorkerFilter() {
  // El filtro ahora usa búsqueda dinámica, no hace falta poblar un select
}

function filterWorkersPagos() {
  const searchInput = document.getElementById('searchWorkerPagos');
  const list = document.getElementById('workerPagosList');
  const hiddenInput = document.getElementById('filterPaymentsWorker');

  if (!searchInput || !list || !hiddenInput) return;

  const search = searchInput.value
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/-/g, '')
    .trim();

  hiddenInput.value = '';
  list.innerHTML = '';

  if (search === '') {
    list.style.display = 'none';
    return;
  }

  const filtered = workers.filter((w) => {
    if (w.active === false) return false;
    const name = (w.name || '').toLowerCase();
    const cleanRut = (w.rut || '')
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/-/g, '');
    return name.includes(search) || cleanRut.includes(search);
  });

  if (filtered.length === 0) {
    list.innerHTML =
      "<div style='padding: 10px; color: #999;'>No se encontraron resultados</div>";
    list.style.display = 'block';
    return;
  }

  filtered.forEach((worker) => {
    const div = document.createElement('div');
    div.innerHTML = `<strong>${worker.name}</strong><br><small style='color:#666;'>${worker.rut}</small>`;
    div.addEventListener('click', () => {
      const workerKey =
        getRutKey(worker.rut) || 'name:' + getWorkerNameKey(worker.name);
      hiddenInput.value = workerKey;
      searchInput.value = worker.name + ' (' + worker.rut + ')';
      list.style.display = 'none';
      list.innerHTML = '';
    });
    list.appendChild(div);
  });

  list.style.display = 'block';
}

function clearWorkerPagosSearch() {
  const searchInput = document.getElementById('searchWorkerPagos');
  const list = document.getElementById('workerPagosList');
  const hiddenInput = document.getElementById('filterPaymentsWorker');

  if (searchInput) searchInput.value = '';
  if (hiddenInput) hiddenInput.value = '';
  if (list) {
    list.style.display = 'none';
    list.innerHTML = '';
  }
}
/*PRODUCCIÓN - CONFIGURACIÓN Y SELECTS*/
// =============================
// PRODUCCIÓN - CONFIGURACIÓN Y SELECTS
// =============================
function loadMandanteFundoFilter() {
  const select = document.getElementById('mandanteFundoFilter');
  if (!select) return;

  const currentValue = select.value;
  const fundoMap = new Map();

  history.forEach((record) => {
    const fundoKey = getFundoKey(record.fundo) || 'sin-fundo';
    const fundoLabel = getFundoDisplay(record.fundo, 'Sin fundo');

    if (!fundoMap.has(fundoKey)) {
      fundoMap.set(fundoKey, fundoLabel);
    }
  });

  select.innerHTML = "<option value=''>-- Todos los fundos --</option>";

  Array.from(fundoMap.entries())
    .sort((a, b) => a[1].localeCompare(b[1], 'es'))
    .forEach(([key, label]) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = label;
      select.appendChild(option);
    });

  if (currentValue && fundoMap.has(currentValue)) {
    select.value = currentValue;
  }
}
function loadLabors() {
  const select = document.getElementById('laborSelect');

  if (!select) return;

  select.innerHTML = "<option value=''>-- Seleccionar labor --</option>";

  labors.forEach((l) => {
    const opt = document.createElement('option');
    opt.value = l;
    opt.textContent = l;

    select.appendChild(opt);
  });
}

window.loadLabors = loadLabors;
function loadFundos() {
  const select = document.getElementById('fundoSelect');
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = "<option value=''>-- Seleccionar fundo --</option>";

  fundos.forEach((f) => {
    const option = document.createElement('option');
    option.value = f;
    option.textContent = f;
    select.appendChild(option);
  });

  if (currentValue && fundos.includes(currentValue)) {
    select.value = currentValue;
  }
}

window.loadFundos = loadFundos;
