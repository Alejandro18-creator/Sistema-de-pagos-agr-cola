function createStorageService({ app, fs, path }) {
  function getDataRoot() {
    const appPath = app.getAppPath();

    // In packaged mode, appPath can point inside app.asar.
    if (appPath.includes("app.asar")) {
      return path.join(path.dirname(process.execPath), "data");
    }

    return path.join(appPath, "data");
  }

  function ensureBaseDirectories() {
    const dataRoot = getDataRoot();
    const subdirs = ["", "client", "backups", "exports"];

    subdirs.forEach((subdir) => {
      const target = subdir ? path.join(dataRoot, subdir) : dataRoot;
      if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
      }
    });
  }

  function resolvePortablePath(relativePath) {
    if (typeof relativePath !== "string" || relativePath.trim() === "") {
      throw new Error("relativePath es obligatorio");
    }

    const normalized = path.normalize(relativePath).replace(/^[\\/]+/, "");

    if (path.isAbsolute(normalized)) {
      throw new Error("No se permiten rutas absolutas");
    }

    const parts = normalized.split(path.sep);
    if (parts.includes("..")) {
      throw new Error("No se permite path traversal");
    }

    const dataRoot = path.resolve(getDataRoot());
    const fullPath = path.resolve(path.join(dataRoot, normalized));

    if (!fullPath.startsWith(dataRoot)) {
      throw new Error("Ruta fuera de data/");
    }

    return fullPath;
  }

  async function readJson(relativePath) {
    const fullPath = resolvePortablePath(relativePath);

    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const raw = await fs.promises.readFile(fullPath, "utf8");
    const normalized = String(raw || "").trim();

    if (normalized.length < 2) {
      return null;
    }

    try {
      return JSON.parse(normalized);
    } catch (error) {
      console.warn("JSON portable inválido, se usa fallback local:", fullPath, error.message);
      return null;
    }
  }

  async function writeJson(relativePath, data) {
    const fullPath = resolvePortablePath(relativePath);

    if (!fullPath.toLowerCase().endsWith(".json")) {
      throw new Error("Solo se permite escritura en archivos .json");
    }

    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    const payload = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(fullPath, payload, "utf8");

    return { ok: true, path: fullPath };
  }

  async function fileExists(relativePath) {
    const fullPath = resolvePortablePath(relativePath);
    return fs.existsSync(fullPath);
  }

  return {
    ensureBaseDirectories,
    readJson,
    writeJson,
    fileExists,
    getDataRoot,
  };
}

module.exports = {
  createStorageService,
};
