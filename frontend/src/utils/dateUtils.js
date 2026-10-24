/**
 * Centralized Date & Time Utilities for ASI CRM
 * Provides resilient, localized date and time formatting across all frontend modules.
 * Configured dynamically via Master Settings > Date Format Setup.
 * Official Defaults:
 *   - Proposals: YYYY/MM/DD (e.g. 2026/10/24)
 *   - Tax Invoices & Challans: DD/MM/YYYY (e.g. 24/10/2026)
 */

export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const MONTH_NAMES_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DATE_SETTINGS_STORAGE_KEY = 'asicrm_date_settings';
let cachedDateSettings = null;

export function getCachedDateSettings() {
  if (cachedDateSettings) return cachedDateSettings;
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(DATE_SETTINGS_STORAGE_KEY);
      if (raw) {
        cachedDateSettings = JSON.parse(raw);
        return cachedDateSettings;
      }
      const companyRaw = localStorage.getItem('asicrm_company_settings');
      if (companyRaw) {
        const parsed = JSON.parse(companyRaw);
        if (parsed.dateFormatSettings) {
          cachedDateSettings = parsed.dateFormatSettings;
          return cachedDateSettings;
        }
      }
    }
  } catch (_) {}
  return null;
}

export function setCachedDateSettings(settings) {
  if (!settings) return;
  cachedDateSettings = settings;
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DATE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }
  } catch (_) {}
}

if (typeof window !== 'undefined') {
  window.addEventListener('crm-date-settings-updated', (e) => {
    if (e.detail) {
      setCachedDateSettings(e.detail);
    }
  });
}

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

export function formatCustomDate(dateVal, formatPattern = 'YYYY/MM/DD', customSeparator = null, fallback = '—') {
  if (!dateVal || dateVal === '—' || dateVal === '-') return fallback;
  const parts = parseDateComponents(dateVal);
  if (!parts) return String(dateVal || fallback);

  const yyyy = String(parts.year);
  const yy = yyyy.slice(-2);
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  const mIndex = parseInt(parts.month, 10) - 1;
  const mmm = MONTH_NAMES_SHORT[mIndex] || mm;

  let sep = customSeparator;
  if (!sep) {
    if (formatPattern.includes('/')) sep = '/';
    else if (formatPattern.includes('-')) sep = '-';
    else if (formatPattern.includes('.')) sep = '.';
    else sep = '/';
  }

  const norm = (formatPattern || 'YYYY/MM/DD').toUpperCase();
  if (norm.startsWith('YYYY') && norm.endsWith('DD') && norm.includes('MM')) {
    return `${yyyy}${sep}${mm}${sep}${dd}`;
  }
  if (norm.startsWith('DD') && norm.endsWith('YYYY') && norm.includes('MMM')) {
    return `${dd}-${mmm}-${yyyy}`;
  }
  if (norm.startsWith('DD') && norm.endsWith('YYYY')) {
    return `${dd}${sep}${mm}${sep}${yyyy}`;
  }
  if (norm.startsWith('MM') && norm.endsWith('YYYY')) {
    return `${mm}${sep}${dd}${sep}${yyyy}`;
  }
  if (norm.startsWith('DD') && norm.endsWith('YY')) {
    return `${dd}${sep}${mm}${sep}${yy}`;
  }
  return `${yyyy}${sep}${mm}${sep}${dd}`;
}

export function formatDocumentDate(dateVal, moduleKey = 'general', fallback = '—') {
  if (!dateVal || dateVal === '—' || dateVal === '-') return fallback;
  const settings = getCachedDateSettings();
  const mod = settings?.modules?.[moduleKey];

  if (mod?.format) {
    return formatCustomDate(dateVal, mod.format, mod.separator, fallback);
  }

  // Built-in official defaults
  if (moduleKey === 'quotations') {
    return formatCustomDate(dateVal, 'YYYY/MM/DD', '/', fallback);
  }
  return formatCustomDate(dateVal, 'DD/MM/YYYY', '/', fallback);
}

/**
 * Customer Proposal Date Format (Defaults to YYYY/MM/DD matching official ASI reference: 2026/10/24)
 */
export function formatProposalDate(dateVal, fallback = '') {
  return formatDocumentDate(dateVal, 'quotations', fallback);
}

/**
 * Standard Tax/Commercial Document Date Format (Defaults to DD/MM/YYYY matching official ASI reference: 24/10/2026)
 */
export function formatDocDate(dateVal, fallback = '') {
  return formatDocumentDate(dateVal, 'invoices', fallback);
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
