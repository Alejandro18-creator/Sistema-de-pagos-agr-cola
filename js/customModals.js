// Sistema de modales personalizados para Electron (no bloqueantes)
// Reutiliza estilos visuales del proyecto

function showCustomAlert(message, options = {}) {
  return new Promise((resolve) => {
    removeExistingCustomModal();
    const modal = document.createElement("div");
    modal.className = "custom-modal-overlay";
    modal.innerHTML = `
      <div class="custom-modal-box">
        <div class="custom-modal-message">${message}</div>
        <button class="custom-modal-btn custom-modal-ok">OK</button>
      </div>
    `;
    document.body.appendChild(modal);
    const okBtn = modal.querySelector(".custom-modal-ok");
    okBtn.focus({ preventScroll: true });
    okBtn.onclick = () => {
      modal.remove();
      resolve();
    };
    modal.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === "Escape") {
        modal.remove();
        resolve();
      }
    });
  });
}

function showCustomConfirm(message, options = {}) {
  return new Promise((resolve) => {
    removeExistingCustomModal();
    const modal = document.createElement("div");
    modal.className = "custom-modal-overlay";
    modal.innerHTML = `
      <div class="custom-modal-box">
        <div class="custom-modal-message">${message}</div>
        <div class="custom-modal-actions">
          <button class="custom-modal-btn custom-modal-ok">Aceptar</button>
          <button class="custom-modal-btn custom-modal-cancel">Cancelar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const okBtn = modal.querySelector(".custom-modal-ok");
    const cancelBtn = modal.querySelector(".custom-modal-cancel");
    okBtn.focus({ preventScroll: true });
    okBtn.onclick = () => {
      modal.remove();
      resolve(true);
    };
    cancelBtn.onclick = () => {
      modal.remove();
      resolve(false);
    };
    modal.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        modal.remove();
        resolve(true);
      } else if (e.key === "Escape") {
        modal.remove();
        resolve(false);
      }
    });
  });
}

function showCustomPrompt(message, defaultValue = "", options = {}) {
  return new Promise((resolve) => {
    removeExistingCustomModal();
    const modal = document.createElement("div");
    modal.className = "custom-modal-overlay";
    modal.innerHTML = `
      <div class="custom-modal-box">
        <div class="custom-modal-message">${message}</div>
        <input class="custom-modal-input" type="text" value="${defaultValue}">
        <div class="custom-modal-actions">
          <button class="custom-modal-btn custom-modal-ok">Aceptar</button>
          <button class="custom-modal-btn custom-modal-cancel">Cancelar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const input = modal.querySelector(".custom-modal-input");
    const okBtn = modal.querySelector(".custom-modal-ok");
    const cancelBtn = modal.querySelector(".custom-modal-cancel");
    input.focus({ preventScroll: true });
    okBtn.onclick = () => {
      const value = input.value;
      modal.remove();
      resolve(value);
    };
    cancelBtn.onclick = () => {
      modal.remove();
      resolve(null);
    };
    modal.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        modal.remove();
        resolve(input.value);
      } else if (e.key === "Escape") {
        modal.remove();
        resolve(null);
      }
    });
  });
}

function removeExistingCustomModal() {
  const existing = document.querySelector(".custom-modal-overlay");
  if (existing) existing.remove();
}

// Estilos básicos para los modales personalizados
if (!document.getElementById("custom-modal-styles")) {
  const style = document.createElement("style");
  style.id = "custom-modal-styles";
  style.textContent = `
    .custom-modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.35);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .custom-modal-box {
      background: #fff;
      border-radius: 10px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.18);
      padding: 28px 24px 20px 24px;
      min-width: 320px;
      max-width: 90vw;
      font-family: inherit;
      text-align: center;
      position: relative;
    }
    .custom-modal-message {
      margin-bottom: 18px;
      font-size: 16px;
      color: #222;
    }
    .custom-modal-actions {
      display: flex;
      gap: 16px;
      justify-content: center;
      margin-top: 16px;
    }
    .custom-modal-btn {
      padding: 8px 22px;
      border-radius: 7px;
      border: none;
      background: #1a73e8;
      color: #fff;
      font-size: 15px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .custom-modal-btn.custom-modal-cancel {
      background: #e74c3c;
    }
    .custom-modal-btn:focus {
      outline: 2px solid #1a73e8;
    }
    .custom-modal-input {
      width: 90%;
      padding: 8px;
      font-size: 15px;
      border-radius: 6px;
      border: 1px solid #ccc;
      margin-bottom: 10px;
      margin-top: 2px;
    }
  `;
  document.head.appendChild(style);
}
