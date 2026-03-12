const { app, BrowserWindow } = require("electron");

function createWindow() {

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false
  });

  win.loadFile("index.html");

  // 🔹 limpiar caché para ver cambios
  win.webContents.session.clearCache();

  // 🔹 Mostrar y enfocar la ventana cuando esté lista para evitar problemas de foco
  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });

}

app.whenReady().then(() => {
  createWindow();
});