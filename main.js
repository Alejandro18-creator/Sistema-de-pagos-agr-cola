const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { createStorageService } = require("./electron/services/storageService");

const storageService = createStorageService({ app, fs, path });

function registerStorageIpcHandlers() {
  ipcMain.handle("storage:read", async (_event, relativePath) => {
    return storageService.readJson(relativePath);
  });

  ipcMain.handle("storage:write", async (_event, payload) => {
    const relativePath = payload?.relativePath;
    const data = payload?.data;
    return storageService.writeJson(relativePath, data);
  });

  ipcMain.handle("storage:exists", async (_event, relativePath) => {
    return storageService.fileExists(relativePath);
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  win.loadFile("index.html");

  win.on("blur", () => {
    console.log("VENTANA PERDIÓ FOCO");
  });

  win.on("focus", () => {
    console.log("VENTANA RECUPERÓ FOCO");
  });

  // 🔹 Limpiar caché solo cuando se necesite depurar cambios forzados
  if (process.env.CLEAR_CACHE_ON_START === "1") {
    win.webContents.session.clearCache();
  }

  // // 🔹 Mostrar y enfocar la ventana cuando esté lista para evitar problemas de foco
  // win.once("ready-to-show", () => {
  //   win.show();
  //   win.focus();
  // });

  // IPC para exportar contrato a PDF y abrirlo
  ipcMain.handle("export-contract-pdf", async (event, options) => {
    // options: { selector, fileName }
    try {
      // Ejecuta JS en la ventana para obtener el área del contrato
      const html = await win.webContents.executeJavaScript(`
        (function() {
          const el = document.querySelector('${options.selector}');
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          window.scrollTo(0, rect.top);
          return el.outerHTML;
        })();
      `);
      if (!html)
        throw new Error("No se encontró el contrato en la vista actual");

      // Crea una ventana oculta para renderizar solo el contrato
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: { offscreen: true },
      });
      await printWin.loadURL(
        "data:text/html;charset=utf-8," +
          encodeURIComponent(`
        <html><head><link rel="stylesheet" href="styles.css"></head><body>${html}</body></html>
      `),
      );

      // Espera a que cargue
      await new Promise((res) => setTimeout(res, 500));

      const pdfBuffer = await printWin.webContents.printToPDF({
        printBackground: true,
        pageSize: "A4",
        landscape: false,
      });
      printWin.close();

      // Guarda el PDF en la carpeta del usuario
      const userDir = app.getPath("documents");
      const filePath = path.join(userDir, options.fileName || "contrato.pdf");
      fs.writeFileSync(filePath, pdfBuffer);

      // Abre el PDF
      await shell.openPath(filePath);
      return { success: true, filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

app.whenReady().then(() => {
  storageService.ensureBaseDirectories();
  registerStorageIpcHandlers();

  // Agregar encabezados para cross-origin isolation
  const { session } = require("electron");
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Cross-Origin-Opener-Policy": ["same-origin"],
        "Cross-Origin-Embedder-Policy": ["require-corp"],
      },
    });
  });
  createWindow();
});
