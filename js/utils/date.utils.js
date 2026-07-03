// =============================
// DATE UTILITIES
// =============================

/**
 * Convert any date format to YYYY-MM-DD key
 * Supports: ISO (YYYY-MM-DD), Chilean (DD/MM/YYYY), Chilean with dash (DD-MM-YYYY)
 */
function getHistoryDateKey(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  // ISO format: YYYY-MM-DD
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Chilean format: DD/MM/YYYY or DD-MM-YYYY
  const clMatch = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (clMatch) {
    return `${clMatch[3]}-${clMatch[2]}-${clMatch[1]}`;
  }

  return raw.slice(0, 10);
}

/**
 * Check if a record date falls within a given month (YYYY-MM)
 */
function isHistoryRecordInMonth(recordDate, month) {
  const dateKey = getHistoryDateKey(recordDate);
  return !!month && !!dateKey && dateKey.startsWith(month);
}

/**
 * DateHelper: Date validation and conversion utilities
 * Exposed as window.DateHelper for global access
 */
if (typeof window.DateHelper === "undefined") {
  window.DateHelper = {
    /**
     * Validate ISO format (YYYY-MM-DD)
     */
    isISO(value) {
      return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
    },

    /**
     * Validate Chilean format (DD/MM/YYYY or DD-MM-YYYY)
     */
    isCLAny(value) {
      return /^(\d{2})[/-](\d{2})[/-](\d{4})$/.test(
        String(value || "").trim(),
      );
    },

    /**
     * Check if recordDate is between inicio and fin dates (inclusive)
     * Supports any format via getHistoryDateKey conversion
     */
    isBetween(recordDate, inicio, fin) {
      const recordIso = getHistoryDateKey(recordDate);
      const inicioIso = getHistoryDateKey(inicio);
      const finIso = getHistoryDateKey(fin);

      if (!recordIso || !inicioIso || !finIso) return false;

      return recordIso >= inicioIso && recordIso <= finIso;
    },
  };
}

const DateHelper = window.DateHelper;
