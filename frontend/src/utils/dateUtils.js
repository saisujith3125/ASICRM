/**
 * Centralized Date & Time Utilities for ASI CRM
 * Provides resilient, localized date and time formatting across all frontend modules.
 * Standard permanent format: DD/MM/YYYY (date/month/year)
 */

export function parseDateComponents(dateVal) {
  if (!dateVal || dateVal === '—' || dateVal === '-') return null;
  try {
    if (typeof dateVal === 'string') {
      const trimmed = dateVal.trim();
      // Date in ISO format: YYYY-MM-DD or YYYY/MM/DD without time
      const simpleIso = trimmed.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
      if (simpleIso && !trimmed.includes('T')) {
        return {
          day: String(simpleIso[3]).padStart(2, '0'),
          month: String(simpleIso[2]).padStart(2, '0'),
          year: simpleIso[1]
        };
      }
      // Date in DD/MM/YYYY or DD-MM-YYYY format
      const simpleDdmmyyyy = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
      if (simpleDdmmyyyy && !trimmed.includes('T')) {
        return {
          day: String(simpleDdmmyyyy[1]).padStart(2, '0'),
          month: String(simpleDdmmyyyy[2]).padStart(2, '0'),
          year: simpleDdmmyyyy[3]
        };
      }
    }
    const dt = new Date(dateVal);
    if (isNaN(dt.getTime())) return null;
    return {
      day: String(dt.getDate()).padStart(2, '0'),
      month: String(dt.getMonth() + 1).padStart(2, '0'),
      year: String(dt.getFullYear())
    };
  } catch {
    return null;
  }
}

export function formatDate(dateVal, fallback = '—') {
  if (!dateVal || dateVal === '—' || dateVal === '-') return fallback;
  const parts = parseDateComponents(dateVal);
  if (!parts) return String(dateVal || fallback);
  return `${parts.day}/${parts.month}/${parts.year}`;
}

export function formatDateTime(dateVal, fallback = '—') {
  if (!dateVal || dateVal === '—' || dateVal === '-') return fallback;
  try {
    const parts = parseDateComponents(dateVal);
    const dt = new Date(dateVal);
    const timePart = !isNaN(dt.getTime())
      ? dt.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        })
      : '';
    if (!parts) return String(dateVal || fallback);
    return timePart ? `${parts.day}/${parts.month}/${parts.year}, ${timePart}` : `${parts.day}/${parts.month}/${parts.year}`;
  } catch {
    return String(dateVal || fallback);
  }
}

export function formatTime(dateVal, fallback = '—') {
  if (!dateVal || dateVal === '—' || dateVal === '-') return fallback;
  try {
    const dt = new Date(dateVal);
    if (isNaN(dt.getTime())) return String(dateVal);
    return dt.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return String(dateVal || fallback);
  }
}

export function formatDateIso(dateVal) {
  if (!dateVal) return '';
  try {
    const dt = new Date(dateVal);
    if (isNaN(dt.getTime())) return '';
    return dt.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

export function isValidDate(dateVal) {
  if (!dateVal) return false;
  const dt = new Date(dateVal);
  return !isNaN(dt.getTime());
}
