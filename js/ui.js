/*UI - EVENTOS GLOBALES*/

// Asignación de evento para 'Generar Liquidación'
window.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('btnGenerateLiquidation')
    ?.addEventListener('click', generateLiquidation);
});

window.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('btnSaveMinimumWage')
    ?.addEventListener('click', saveMinimumWage);
});
// Asignación de evento para 'Buscar registros del día' en Producción
window.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('btnLoadDailyRecords')
    ?.addEventListener('click', loadDailyRecords);
});
// Asignación de eventos para login y logout
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnLoginUser')?.addEventListener('click', loginUser);
  document.getElementById('btnLogout')?.addEventListener('click', logout);
});
// Asignación de eventos para Carpeta del Trabajador
window.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('btnUploadWorkerDocument')
    ?.addEventListener('click', uploadWorkerDocument);
  document
    .getElementById('btnBackToWorkersDB')
    ?.addEventListener('click', () => showView('viewWorkersDB'));
});
// Asignación de eventos para sección de respaldo
window.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('btnExportData')
    ?.addEventListener('click', exportData);
  document
    .getElementById('btnImportDataTrigger')
    ?.addEventListener('click', () => {
      document.getElementById('importFile')?.click();
    });
  document.getElementById('importFile')?.addEventListener('change', importData);
});
// Asignación de eventos para formulario de Finiquito
window.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('searchWorkerFiniquito')
    ?.addEventListener('input', () => debounceSearch(filterWorkersFiniquito));
  document
    .getElementById('btnClearWorkerFiniquitoSearch')
    ?.addEventListener('click', clearWorkerFiniquitoSearch);
  document.getElementById('f_endDate')?.addEventListener('input', (e) => {
    formatFechaInput(e.target);
    syncFiniquitoEndDate(e.target.value);
  });
  document
    .getElementById('btnPrintFiniquito')
    ?.addEventListener('click', () => window.print());
  document
    .getElementById('btnGenerateFiniquito')
    ?.addEventListener('click', generateFiniquito);
});
// Asignación de eventos para Resumen Pagado / Pendiente
window.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('filterPaymentsMonth')
    ?.addEventListener('change', loadPaymentsHistory);
  document
    .getElementById('searchWorkerPagos')
    ?.addEventListener('input', () => debounceSearch(filterWorkersPagos));
  document
    .getElementById('btnClearWorkerPagosSearch')
    ?.addEventListener('click', clearWorkerPagosSearch);
  document
    .getElementById('btnGeneratePagosResumen')
    ?.addEventListener('click', () => generatePagosResumen?.());
});
// Asignación de eventos para resumen semanal
window.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('searchWorkerWeekly')
    ?.addEventListener('input', () => debounceSearch(filterWorkersWeekly));
  document
    .getElementById('btnClearWeeklySearch')
    ?.addEventListener('click', clearWeeklySearch);
  document
    .getElementById('btnPrintWeeklySummary')
    ?.addEventListener('click', () => printWeeklySummary?.());
});
// Asignación de eventos para Cobros Mandantes
window.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('btnGenerateMandanteCobro')
    ?.addEventListener('click', generateMandanteCobro);
  document
    .getElementById('btnPrintMandanteCobro')
    ?.addEventListener('click', printMandanteCobro);
});
// Asignación de eventos para resumen mensual general
window.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('btnGenerateMonthlyGeneral')
    ?.addEventListener('click', generateMonthlyGeneral);
  document
    .getElementById('btnPrintMonthlyGeneral')
    ?.addEventListener('click', printMonthlyGeneral);
  document
    .getElementById('btnExportMonthlyGeneralExcel')
    ?.addEventListener('click', exportMonthlyGeneralExcel);
});
// Asignación de eventos para resumen mensual por trabajador
window.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('searchWorkerMonthly')
    ?.addEventListener('input', () => debounceSearch(filterWorkersMonthly));
  document
    .getElementById('btnClearWorkerMonthlySearch')
    ?.addEventListener('click', clearWorkerMonthlySearch);
  document
    .getElementById('btnGenerateMonthlySummary')
    ?.addEventListener('click', generateMonthlySummary);
});
// Asignación de eventos para formulario de contrato
window.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('searchWorkerContract')
    ?.addEventListener('input', () => debounceSearch(filterWorkersContract));
  document
    .getElementById('btnClearWorkerContractSearch')
    ?.addEventListener('click', clearWorkerContractSearch);
  document
    .getElementById('startDate')
    ?.addEventListener('input', (e) => formatBirthDate(e.target));
  document
    .getElementById('btnClearAllContract')
    ?.addEventListener('click', clearAllContract);
  document
    .getElementById('btnGenerateContract')
    ?.addEventListener('click', generateContract);
  document
    .getElementById('btnPrintContractScreen')
    ?.addEventListener('click', printContractScreen);
});
// Asignación de eventos para formulario de liquidación
window.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('searchWorkerLiquidation')
    ?.addEventListener('input', () => debounceSearch(filterWorkersLiquidation));
  document
    .getElementById('btnClearLiquidationSearch')
    ?.addEventListener('click', clearWorkerLiquidationSearch);
  document
    .getElementById('btnGenerateLiquidation')
    ?.addEventListener('click', generateLiquidation);
  document
    .getElementById('btnPrintLiquidationScreen')
    ?.addEventListener('click', printLiquidationScreen);
});
// Asignación de eventos para base de datos de trabajadores
window.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('searchWorkerDB')
    ?.addEventListener('input', () => debounceSearch(filterWorkersDB));
  document
    .getElementById('btnClearWorkerDBSearch')
    ?.addEventListener('click', clearWorkerDBSearch);

  const input = document.getElementById('searchWorkerDB');
  if (input) {
    input.addEventListener('mousedown', () => {
      if (document.activeElement !== input) {
        setTimeout(() => input.focus(), 0);
      }
    });
  }
});
// Asignación de eventos para formulario de producción
window.addEventListener('DOMContentLoaded', () => {
  const searchWorkerInput = document.getElementById('searchWorkerProduction');
  searchWorkerInput?.addEventListener('input', () => {
    debounceSearch(filterWorkersProduction);
    // Validación inmediata de trabajador inactivo
    const workerSelect = document.getElementById('workerSelect');
    const workerId = workerSelect?.value;
    if (workerId && workers && workers[workerId]) {
      const worker = workers[workerId];
      if (worker.active === false) {
        showCustomAlert('El trabajador está inactivo.');
        // Limpiar input y selección
        searchWorkerInput.value = '';
        if (workerSelect) workerSelect.value = '';
        // Devolver foco
        setTimeout(() => searchWorkerInput.focus(), 100);
      }
    }
  });
  // Validación también al seleccionar con el mouse en la lista de autocompletado
  const workerProductionList = document.getElementById('workerProductionList');
  if (workerProductionList) {
    workerProductionList.addEventListener('click', function (e) {
      // Esperar a que el input y el hidden se actualicen tras el click
      setTimeout(() => {
        const workerSelect = document.getElementById('workerSelect');
        const searchWorkerInput = document.getElementById('searchWorkerProduction');
        const workerId = workerSelect?.value;
        if (workerId && workers && workers[workerId]) {
          const worker = workers[workerId];
          if (worker.active === false) {
            showCustomAlert('El trabajador está inactivo.');
            // Limpiar input y selección
            if (searchWorkerInput) searchWorkerInput.value = '';
            if (workerSelect) workerSelect.value = '';
            // Devolver foco
            setTimeout(() => searchWorkerInput && searchWorkerInput.focus(), 100);
          }
        }
      }, 50);
    });
  }
  document
    .getElementById('btnClearWorkerProductionSearch')
    ?.addEventListener('click', clearWorkerProductionSearch);
  document
    .getElementById('unitValue')
    ?.addEventListener('input', (e) => formatCurrency(e.target));
  document
    .getElementById('btnRegisterWork')
    ?.addEventListener('click', registerWork);
});
// Asignación de eventos para navegación y menús laterales
window.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('btnViewHome')
    ?.addEventListener('click', () => showView('viewHome'));
  document
    .getElementById('btnViewWorkers')
    ?.addEventListener('click', () => showView('viewWorkers'));
  document
    .getElementById('btnViewContract')
    ?.addEventListener('click', () => showView('viewContract'));
  document
    .getElementById('btnViewWorkersDB')
    ?.addEventListener('click', () => showView('viewWorkersDB'));
  document
    .getElementById('btnViewProduction')
    ?.addEventListener('click', () => showView('viewProduction'));
  document
    .getElementById('btnToggleWeeklySubmenu')
    ?.addEventListener('click', () => toggleSubmenu('weeklySubmenu'));
  document
    .getElementById('btnViewWeekly')
    ?.addEventListener('click', () => showView('viewWeekly'));
  document
    .getElementById('btnGenerateWeeklySummary')
    ?.addEventListener('click', () => generateWeeklySummary());
  document
    .getElementById('btnViewPagos')
    ?.addEventListener('click', () => showView('viewPagos'));
  document
    .getElementById('btnViewHistory')
    ?.addEventListener('click', () => showView('viewHistory'));
  document
    .getElementById('btnViewLiquidation')
    ?.addEventListener('click', () => showView('viewLiquidation'));
  document
    .getElementById('btnToggleMonthlySubmenu')
    ?.addEventListener('click', () => toggleSubmenu('monthlySubmenu'));
  document
    .getElementById('btnViewMonthly')
    ?.addEventListener('click', () => showView('viewMonthly'));
  document
    .getElementById('btnViewMonthlyGeneral')
    ?.addEventListener('click', () => showView('viewMonthlyGeneral'));
  document
    .getElementById('btnViewCobrosMandante')
    ?.addEventListener('click', () => showView('viewCobrosMandante'));
  document
    .getElementById('btnViewHistory2')
    ?.addEventListener('click', () => showView('viewHistory'));
  document
    .getElementById('btnViewPaymentsHistory')
    ?.addEventListener('click', () => {
      showView('viewPaymentsHistory');
      loadPaymentsHistory();
    });
  document
    .getElementById('btnViewBackup')
    ?.addEventListener('click', () => showView('viewBackup'));
  document
    .getElementById('btnViewFiniquito')
    ?.addEventListener('click', () => showView('viewFiniquito'));
});
// Asignación de eventos para formulario de trabajadores
window.addEventListener('DOMContentLoaded', () => {
  // Buscador y edición
  document
    .getElementById('searchWorkerEdit')
    ?.addEventListener('input', () => debounceSearch(filterWorkersEdit));
  document
    .getElementById('btnClearWorkerEditSearch')
    ?.addEventListener('click', clearWorkerEditSearch);
  document
    .getElementById('workerEditSelect')
    ?.addEventListener('change', loadWorkerToEdit);

  // Inputs con formato
  document
    .getElementById('workerRut')
    ?.addEventListener('input', (e) => formatRutInput(e.target));
  document
    .getElementById('workerBirthDate')
    ?.addEventListener('input', (e) => formatBirthDate(e.target));
  document
    .getElementById('workerBaseSalary')
    ?.addEventListener('input', (e) => formatCurrency(e.target));

  // Acciones principales
  document.getElementById('btnAddWorker')?.addEventListener('click', addWorker);
  document
    .getElementById('btnClearWorkerForm')
    ?.addEventListener('click', clearWorkerForm);
  document
    .getElementById('btnDeleteWorker')
    ?.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const prevX = window.scrollX;
      const prevY = window.scrollY;
      await deleteWorker();
      window.scrollTo(prevX, prevY);
    });
  document
    .getElementById('btnDeactivateWorker')
    ?.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const prevX = window.scrollX;
      const prevY = window.scrollY;
      await deactivateWorker();
      window.scrollTo(prevX, prevY);
    });
});

function clearWorkerLiquidationSearch() {
  const searchInput = document.getElementById('searchWorkerLiquidation');
  const list = document.getElementById('workerLiquidationList');
  const hiddenSelect = document.getElementById('workerLiquidation');
  const liquidationPrint = document.getElementById('liquidationPrint');
  const liquidationView = document.getElementById('viewLiquidation');
  const monthInput = document.getElementById('monthLiquidation');
  const advanceInput = document.getElementById('advanceAmount');

  // Logs temporales para identificar qué contenedor queda visualmente activo.
  console.log('LIQUIDATION PRINT:', liquidationPrint);
  console.log('INNER HTML:', liquidationPrint ? liquidationPrint.innerHTML : null);
  console.log('VISIBLE:', liquidationPrint ? liquidationPrint.classList : null);
  console.log('LIQUIDATION VIEW:', liquidationView);
  console.log('VIEW CLASSLIST:', liquidationView ? liquidationView.classList : null);

  if (searchInput) searchInput.value = '';
  if (hiddenSelect) hiddenSelect.value = '';
  if (list) {
    list.style.display = 'none';
    list.innerHTML = '';
  }
  if (liquidationPrint) {
    liquidationPrint.innerHTML = '';
    liquidationPrint.classList.add('hidden');
  }
  if (liquidationView) liquidationView.classList.add('hidden');
  if (monthInput) monthInput.value = '';
  if (advanceInput) advanceInput.value = '';

  console.log('LIQUIDATION PRINT AFTER CLEAR:', liquidationPrint);
  console.log(
    'INNER HTML AFTER CLEAR:',
    liquidationPrint ? liquidationPrint.innerHTML : null
  );
  console.log(
    'VISIBLE AFTER CLEAR:',
    liquidationPrint ? liquidationPrint.classList : null
  );
  console.log('VIEW CLASSLIST AFTER CLEAR:', liquidationView ? liquidationView.classList : null);
}
