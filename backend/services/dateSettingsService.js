const fs = require('fs');
const path = require('path');

const DATE_SETTINGS_FILE = path.join(__dirname, '..', 'data', 'date-settings.json');

const DEFAULT_DATE_CONFIG = {
  globalFormat: 'YYYY/MM/DD',
  globalSeparator: '/',
  timezone: 'Asia/Kolkata',
  timeFormat: '12_HOUR', // '12_HOUR' | '24_HOUR'
  modules: {
    quotations: {
      key: 'quotations',
      name: 'Quotations / Proposals',
      format: 'YYYY/MM/DD',
      separator: '/',
      description: 'Customer-facing commercial proposal document date'
    },
    invoices: {
      key: 'invoices',
      name: 'Tax Invoices',
      format: 'DD/MM/YYYY',
      separator: '/',
      description: 'Statutory GST tax invoice document date'
    },
    deliveryChallans: {
      key: 'deliveryChallans',
      name: 'Delivery Challans',
      format: 'DD/MM/YYYY',
      separator: '/',
      description: 'Dispatch and material delivery challan date'
    },
    purchaseOrders: {
      key: 'purchaseOrders',
      name: 'Purchase Orders',
      format: 'DD/MM/YYYY',
      separator: '/',
      description: 'Supplier and vendor purchase order document date'
    },
    proformaInvoices: {
      key: 'proformaInvoices',
      name: 'Proforma Invoices',
      format: 'DD/MM/YYYY',
      separator: '/',
      description: 'Proforma commercial invoice date'
    },
    general: {
      key: 'general',
      name: 'CRM Timeline & Records',
      format: 'DD/MM/YYYY',
      separator: '/',
      description: 'CRM interaction logs, activity timeline, and status updates'
    }
  },
  lastUpdated: new Date().toISOString(),
  updatedBy: 'System'
};

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const MONTH_NAMES_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

class DateSettingsService {
  constructor() {
    this.config = null;
    this.init();
  }

  init() {
    try {
      if (!fs.existsSync(DATE_SETTINGS_FILE)) {
        this.config = JSON.parse(JSON.stringify(DEFAULT_DATE_CONFIG));
        this.saveToFile();
      } else {
        const raw = fs.readFileSync(DATE_SETTINGS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        this.config = {
          ...DEFAULT_DATE_CONFIG,
          ...parsed,
          modules: {
            ...DEFAULT_DATE_CONFIG.modules,
            ...(parsed.modules || {})
          }
        };
      }
    } catch (err) {
      console.error('Failed to initialize date settings service, using defaults:', err);
      this.config = JSON.parse(JSON.stringify(DEFAULT_DATE_CONFIG));
    }
  }

  saveToFile() {
    try {
      this.config.lastUpdated = new Date().toISOString();
      fs.writeFileSync(DATE_SETTINGS_FILE, JSON.stringify(this.config, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('Error saving date settings:', err);
      return false;
    }
  }

  getSettings() {
    if (!this.config) this.init();
    return JSON.parse(JSON.stringify(this.config));
  }

  parseDateParts(d) {
    if (!d || d === '—' || d === '-') return null;
    try {
      if (typeof d === 'string') {
        const trimmed = d.trim();
        // Check for ISO YYYY-MM-DD or YYYY/MM/DD
        const isoMatch = trimmed.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
        if (isoMatch) {
          const year = parseInt(isoMatch[1], 10);
          const month = parseInt(isoMatch[2], 10);
          const day = parseInt(isoMatch[3], 10);
          return { year, month, day };
        }
        // Check for DD/MM/YYYY or DD-MM-YYYY
        const ddmmyyyy = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
        if (ddmmyyyy) {
          const day = parseInt(ddmmyyyy[1], 10);
          const month = parseInt(ddmmyyyy[2], 10);
          const year = parseInt(ddmmyyyy[3], 10);
          return { year, month, day };
        }
      }
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return null;
      return {
        year: dt.getFullYear(),
        month: dt.getMonth() + 1,
        day: dt.getDate()
      };
    } catch {
      return null;
    }
  }

  formatDate(dateVal, formatPattern = 'YYYY/MM/DD', customSeparator = null) {
    const parts = this.parseDateParts(dateVal);
    if (!parts) return '';

    const yyyy = String(parts.year);
    const yy = yyyy.slice(-2);
    const mm = String(parts.month).padStart(2, '0');
    const m = String(parts.month);
    const dd = String(parts.day).padStart(2, '0');
    const d = String(parts.day);
    const mmm = MONTH_NAMES_SHORT[parts.month - 1] || mm;
    const mmmm = MONTH_NAMES_LONG[parts.month - 1] || mm;

    let sep = customSeparator;
    if (!sep) {
      if (formatPattern.includes('/')) sep = '/';
      else if (formatPattern.includes('-')) sep = '-';
      else if (formatPattern.includes('.')) sep = '.';
      else sep = '/';
    }

    const norm = formatPattern.toUpperCase();

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
    if (norm.startsWith('YYYY') && norm.endsWith('MM')) {
      return `${yyyy}${sep}${mm}`;
    }

    // Default fallback to YYYY/MM/DD
    return `${yyyy}${sep}${mm}${sep}${dd}`;
  }

  formatModuleDate(dateVal, moduleKey = 'general') {
    const mod = this.config?.modules?.[moduleKey] || {
      format: this.config?.globalFormat || 'YYYY/MM/DD',
      separator: this.config?.globalSeparator || '/'
    };
    return this.formatDate(dateVal, mod.format, mod.separator);
  }

  updateSettings(payload, user = null) {
    if (!this.config) this.init();

    if (payload.globalFormat) {
      this.config.globalFormat = String(payload.globalFormat).trim();
    }
    if (payload.globalSeparator) {
      this.config.globalSeparator = String(payload.globalSeparator).trim();
    }
    if (payload.timezone) {
      this.config.timezone = String(payload.timezone).trim();
    }
    if (payload.timeFormat) {
      this.config.timeFormat = payload.timeFormat === '24_HOUR' ? '24_HOUR' : '12_HOUR';
    }

    if (payload.modules && typeof payload.modules === 'object') {
      for (const [key, val] of Object.entries(payload.modules)) {
        if (this.config.modules[key]) {
          this.config.modules[key] = {
            ...this.config.modules[key],
            format: val.format || this.config.modules[key].format,
            separator: val.separator || this.config.modules[key].separator
          };
        }
      }
    }

    if (user?.name || user?.username) {
      this.config.updatedBy = user.name || user.username;
    }

    this.saveToFile();
    return this.getSummary();
  }

  updateModuleFormat(moduleKey, format, separator, user = null) {
    if (!this.config) this.init();
    if (!this.config.modules[moduleKey]) {
      throw new Error(`Invalid module key: ${moduleKey}`);
    }

    this.config.modules[moduleKey].format = format;
    if (separator) {
      this.config.modules[moduleKey].separator = separator;
    }
    if (user?.name || user?.username) {
      this.config.updatedBy = user.name || user.username;
    }

    this.saveToFile();
    return this.config.modules[moduleKey];
  }

  resetToDefaults(user = null) {
    this.config = JSON.parse(JSON.stringify(DEFAULT_DATE_CONFIG));
    if (user?.name || user?.username) {
      this.config.updatedBy = user.name || user.username;
    }
    this.saveToFile();
    return this.getSummary();
  }

  getSummary() {
    if (!this.config) this.init();

    const today = new Date();
    const sampleDates = {
      today: today.toISOString().split('T')[0],
      proposalDateSample: '2026-10-24',
      invoiceDateSample: '2026-10-24',
      financialYearStart: '2026-04-01',
      financialYearEnd: '2027-03-31',
      leapYearSample: '2028-02-29'
    };

    const modulePreviews = {};
    for (const [k, mod] of Object.entries(this.config.modules)) {
      modulePreviews[k] = {
        ...mod,
        previewToday: this.formatDate(today, mod.format, mod.separator),
        previewSample: this.formatDate(sampleDates.proposalDateSample, mod.format, mod.separator)
      };
    }

    return {
      globalFormat: this.config.globalFormat,
      globalSeparator: this.config.globalSeparator,
      timezone: this.config.timezone,
      timeFormat: this.config.timeFormat,
      lastUpdated: this.config.lastUpdated,
      updatedBy: this.config.updatedBy,
      modules: modulePreviews,
      samples: {
        raw: sampleDates,
        todayFormatted: this.formatDate(today, this.config.globalFormat, this.config.globalSeparator),
        proposalFormatted: this.formatModuleDate('2026-10-24', 'quotations'),
        invoiceFormatted: this.formatModuleDate('2026-10-24', 'invoices'),
        fyFormatted: `${this.formatDate(sampleDates.financialYearStart, this.config.globalFormat, this.config.globalSeparator)} – ${this.formatDate(sampleDates.financialYearEnd, this.config.globalFormat, this.config.globalSeparator)}`,
        leapYearFormatted: this.formatDate(sampleDates.leapYearSample, this.config.globalFormat, this.config.globalSeparator)
      },
      availablePresets: [
        { id: 'YYYY/MM/DD', label: 'YYYY/MM/DD (Active Proposal Standard - e.g. 2026/10/24)', separator: '/' },
        { id: 'DD/MM/YYYY', label: 'DD/MM/YYYY (Indian Statutory Standard - e.g. 24/10/2026)', separator: '/' },
        { id: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US Corporate Standard - e.g. 10/24/2026)', separator: '/' },
        { id: 'DD-MMM-YYYY', label: 'DD-MMM-YYYY (Formal Business Standard - e.g. 24-Oct-2026)', separator: '-' },
        { id: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO 8601 Standard - e.g. 2026-10-24)', separator: '-' },
        { id: 'DD.MM.YYYY', label: 'DD.MM.YYYY (European Dot Standard - e.g. 24.10.2026)', separator: '.' }
      ]
    };
  }
}

const dateSettingsService = new DateSettingsService();

module.exports = {
  dateSettingsService,
  DateSettingsService,
  DEFAULT_DATE_CONFIG
};
