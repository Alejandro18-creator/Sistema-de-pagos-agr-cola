/* MUESTRA VALORES EN PESOS*/
function formatMoney(value) {
  if (!value) return "$0";

  return (
    "$" +
    Number(value).toLocaleString("es-CL", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}
/*LIMPIA Y FORMATEA TEXTO A PESO CHILENO*/
function formatCLPCurrency(value) {
  if (!value) return "";

  const numericValue = Number(
    value.replace(/\$/g, "").replace(/\./g, "").replace(/,/g, ""),
  );

  if (isNaN(numericValue)) return value;

  return "$" + numericValue.toLocaleString("es-CL");
}

/*// UTILIDADES NORMALIZACIÓN Y CLAVES*/
/*La funsion:eliminar espacios en blanco y convertir la cadena a minúsculas del trabajador*/
function getWorkerNameKey(
  value,
) /* value:Asegura que la cadena exista antes de realizar la operación.*/ {
  return (value || "")
    .trim() /*trim:Elimina espacios en blanco al principio y al final de la cadena.*/
    .replace(
      /\s+/g,
      " ",
    ) /*replace:Reemplaza múltiples espacios en blanco por un solo espacio.*/
    .toLowerCase() /*toLowerCase:Convierte la cadena a minúsculas.*/;
}

/*La función getRutKey toma un valor de entrada, lo convierte a minúsculas, elimina puntos, guiones y espacios, y devuelve la cadena resultante. Esto es útil para normalizar el formato del RUT chileno, facilitando su comparación y almacenamiento.*/
function getRutKey(value) {
  return (value || "")
    .toLowerCase() /*Convierte la cadena a minúsculas.*/
    .replace(/\./g, "") /*Elimina los puntos.*/
    .replace(/-/g, "") /*Elimina los guiones.*/
    .replace(/\s/g, "") /*Elimina los espacios.*/
    .trim(); /*Elimina espacios en blanco al principio y al final de la cadena.*/
}

/*La función getLaborKey toma un valor de entrada, lo normaliza utilizando la función normalizeLaborText y luego lo convierte a minúsculas. Esto es útil para estandarizar el formato de los nombres de las labores, facilitando su comparación y almacenamiento.*/
function getLaborKey(value) {
  return normalizeLaborText(
    value,
  )./*Por el nombre, probablemente limpia o normaliza el texto (por ejemplo, quitando tildes, espacios extra, caracteres especiales, etc.).*/ toLowerCase(); /*Convierte la cadena a minúsculas.*/
}
/*La función getFundoKey toma un valor de entrada, lo normaliza utilizando la función normalizeFundoText y luego lo convierte a minúsculas. Esto es útil para estandarizar el formato de los nombres de los fundos, facilitando su comparación y almacenamiento.*/
function getFundoKey(value) {
  return normalizeFundoText(
    value,
  )./*Por el nombre, probablemente limpia o normaliza el texto (por ejemplo, quitando tildes, espacios extra, caracteres especiales, etc.).*/ toLowerCase(); /*Convierte la cadena a minúsculas.*/
}
function getFundoDisplay(value, fallback = "-") {
  const normalized = normalizeFundoText(value);
  if (!normalized) return fallback;
  return "Fundo " + normalized.toUpperCase();
}

function normalizeLaborText(value) {
  return (value || "").trim().replace(/\s+/g, " ");
}
function normalizeFundoText(value) {
  const normalized = (value || "").trim().replace(/\s+/g, " ");
  return normalized.replace(/^fundo\s*/i, "").trim();
}
function normalizeFundoForSave(value) {
  const normalized = normalizeFundoText(value);
  if (!normalized) return "";
  return "Fundo " + normalized.toUpperCase();
}
function getCanonicalLaborName(value) {
  const normalized = normalizeLaborText(value);
  if (!normalized) return "";

  const key = getLaborKey(normalized);
  const existing = labors.find((l) => getLaborKey(l) === key);
  return existing || normalized;
}