const fs = require('fs');
const path = require('path');

const SEQUENCES_FILE = path.join(__dirname, '..', 'data', 'document-sequences.json');

const DEFAULT_CONFIG = {
  currentCalendarYear: new Date().getFullYear(),
  yearType: 'CALENDAR_YEAR', // Calendar Year (Jan 1 - Dec 31)
  modules: {
    enquiries: {
      key: 'enquiries',
      name: 'Enquiries',
      prefix: 'ENQ/',
      suffix: '/{YYYY}',
      paddingDigits: 3,
      startingNumber: 1,
      nextNumber: 1,
      resetPolicy: 'CALENDAR_YEAR',
      activeYear: new Date().getFullYear(),
      description: 'Customer sales enquiry reference code'
    },
    customers: {
      key: 'customers',
      name: 'Customers',
      prefix: 'CUST-',
      suffix: '',
      paddingDigits: 3,
      startingNumber: 1,
      nextNumber: 1,
      resetPolicy: 'CONTINUOUS',
      activeYear: null,
      description: 'Unique customer client account identification'
    },
    quotations: {
      key: 'quotations',
      name: 'Quotations',
      prefix: 'ASI/{FY}/QT',
      suffix: '',
      paddingDigits: 4,
      startingNumber: 1,
      nextNumber: 1,
      resetPolicy: 'FINANCIAL_YEAR',
      activeYear: new Date().getFullYear(),
      financialYearLabel: '2026-27',
      description: 'Commercial sales quotation and proposal document series'
    },
    purchaseOrders: {
      key: 'purchaseOrders',
      name: 'Purchase Orders',
      prefix: 'PO/',
      suffix: '/{YYYY}',
      paddingDigits: 3,
      startingNumber: 1,
      nextNumber: 1,
      resetPolicy: 'CALENDAR_YEAR',
      activeYear: new Date().getFullYear(),
      description: 'Vendor purchase order document sequence'
    },
    stocks: {
      key: 'stocks',
      name: 'Stocks / Products',
      prefix: 'ASI-',
      suffix: '',
      paddingDigits: 2,
      startingNumber: 1,
      nextNumber: 48,
      resetPolicy: 'CONTINUOUS',
      activeYear: null,
      description: 'Inventory product master catalog code'
    },
    deliveryChallans: {
      key: 'deliveryChallans',
      name: 'Delivery Challans',
      prefix: 'DC/',
      suffix: '/{YYYY}',
      paddingDigits: 3,
      startingNumber: 1,
      nextNumber: 1,
      resetPolicy: 'CALENDAR_YEAR',
      activeYear: new Date().getFullYear(),
      description: 'Goods dispatch and transport delivery challan sequence'
    },
    invoices: {
      key: 'invoices',
      name: 'Tax Invoices',
      prefix: 'INV/',
      suffix: '/{YYYY}',
      paddingDigits: 3,
      startingNumber: 1,
      nextNumber: 1,
      resetPolicy: 'CALENDAR_YEAR',
      activeYear: new Date().getFullYear(),
      description: 'Official tax invoice document sequence'
    }
  },
  yearlyArchives: []
};

/**
 * Indian Financial Year Calculation (April 1 to March 31)
 */
function getIndianFinancialYearTokens(dateOrYear = new Date()) {
  let startYear;
  if (typeof dateOrYear === 'number') {
    startYear = dateOrYear;
  } else {
    const d = new Date(dateOrYear);
    const yr = !isNaN(d.getTime()) ? d.getFullYear() : new Date().getFullYear();
    const mo = !isNaN(d.getTime()) ? d.getMonth() + 1 : new Date().getMonth() + 1;
    startYear = mo >= 4 ? yr : yr - 1;
  }
  const endYear = startYear + 1;
  const shortFY = `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`; // e.g. "26-27"
  const longFY = `${startYear}-${endYear}`; // e.g. "2026-2027"
  const midFY = `${startYear}-${String(endYear).slice(-2)}`; // e.g. "2026-27"
  return { shortFY, longFY, midFY, startYear, endYear };
}

/**
 * Format a number using the module's rule, supporting Financial Year and Calendar Year tokens.
 */
function formatSerial(rule, number, yearOrDate) {
  const activeYear = (typeof yearOrDate === 'number')
    ? yearOrDate
    : (rule.activeYear || new Date().getFullYear());
  const fyTokens = getIndianFinancialYearTokens(yearOrDate || rule.activeYear || new Date());
  const pad = Math.max(1, parseInt(rule.paddingDigits, 10) || 3);
  const formattedNumber = String(number).padStart(pad, '0');

  const replaceTokens = (str) => {
    if (!str) return '';
    return str
      .replace(/\{FY\}/g, fyTokens.shortFY)
      .replace(/\{FINANCIAL_YEAR\}/g, fyTokens.shortFY)
      .replace(/\{FY_LONG\}/g, fyTokens.longFY)
      .replace(/\{FY_LABEL\}/g, fyTokens.midFY)
      .replace(/\{YYYY\}/g, String(activeYear))
      .replace(/\{YY\}/g, String(activeYear).slice(-2));
  };

  const prefix = replaceTokens(rule.prefix || '');
  const suffix = replaceTokens(rule.suffix || '');
  return `${prefix}${formattedNumber}${suffix}`;
}

class SequenceService {
  constructor() {
    this.ensureDataFile();
  }

  ensureDataFile() {
    try {
      if (!fs.existsSync(SEQUENCES_FILE)) {
        fs.writeFileSync(SEQUENCES_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
      }
    } catch (err) {
      console.error('[SequenceService] Failed to initialize sequences file:', err);
    }
  }

  readConfig() {
    this.ensureDataFile();
    try {
      const raw = fs.readFileSync(SEQUENCES_FILE, 'utf8');
      const data = JSON.parse(raw);
      // Merge defaults if any new module was added
      return {
        ...DEFAULT_CONFIG,
        ...data,
        modules: {
          ...DEFAULT_CONFIG.modules,
          ...(data.modules || {})
        },
        yearlyArchives: Array.isArray(data.yearlyArchives) ? data.yearlyArchives : []
      };
    } catch (err) {
      console.error('[SequenceService] Error reading config, falling back to default:', err);
      return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }
  }

  writeConfig(config) {
    try {
      fs.writeFileSync(SEQUENCES_FILE, JSON.stringify(config, null, 2), 'utf8');
    } catch (err) {
      console.error('[SequenceService] Failed to write sequence config:', err);
    }
  }

  /**
   * Check if calendar or financial year has rolled over, archive completed year sequences, and reset to starting number.
   */
  checkYearRollOver(config = null) {
    const current = config || this.readConfig();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentFYTokens = getIndianFinancialYearTokens(now);
    const currentFYStart = currentFYTokens.startYear;
    let configChanged = false;

    // 1. Calendar Year Rollover
    if (current.currentCalendarYear && current.currentCalendarYear !== currentYear) {
      const previousYear = current.currentCalendarYear;
      const archivesToPush = [];

      Object.entries(current.modules).forEach(([modKey, modConfig]) => {
        if (modConfig.resetPolicy === 'CALENDAR_YEAR') {
          const totalGen = Math.max(0, modConfig.nextNumber - modConfig.startingNumber);
          const startCode = formatSerial(modConfig, modConfig.startingNumber, previousYear);
          const lastGeneratedNum = Math.max(modConfig.startingNumber, modConfig.nextNumber - 1);
          const lastCode = formatSerial(modConfig, lastGeneratedNum, previousYear);

          archivesToPush.push({
            id: `ARC-${modKey.toUpperCase()}-${previousYear}-${Date.now()}`,
            moduleKey: modKey,
            moduleName: modConfig.name,
            year: previousYear,
            range: totalGen > 0 ? `${startCode} to ${lastCode}` : 'None generated',
            totalGenerated: totalGen,
            lastNumber: lastGeneratedNum,
            lastSerial: lastCode,
            prefix: modConfig.prefix,
            suffix: modConfig.suffix,
            archivedAt: new Date().toISOString()
          });

          // Reset for new year
          modConfig.nextNumber = modConfig.startingNumber || 1;
          modConfig.activeYear = currentYear;
        }
      });

      current.yearlyArchives = [...(current.yearlyArchives || []), ...archivesToPush];
      current.currentCalendarYear = currentYear;
      configChanged = true;
    }

    // 2. Financial Year Rollover (April 1 to March 31)
    Object.entries(current.modules).forEach(([modKey, modConfig]) => {
      if (modConfig.resetPolicy === 'FINANCIAL_YEAR') {
        const activeFYStart = modConfig.activeYear || currentFYStart;
        if (activeFYStart !== currentFYStart) {
          const prevFYTokens = getIndianFinancialYearTokens(new Date(activeFYStart, 6, 1));
          const totalGen = Math.max(0, modConfig.nextNumber - modConfig.startingNumber);
          const startCode = formatSerial(modConfig, modConfig.startingNumber, activeFYStart);
          const lastGeneratedNum = Math.max(modConfig.startingNumber, modConfig.nextNumber - 1);
          const lastCode = formatSerial(modConfig, lastGeneratedNum, activeFYStart);

          current.yearlyArchives = current.yearlyArchives || [];
          current.yearlyArchives.push({
            id: `ARC-${modKey.toUpperCase()}-FY${prevFYTokens.shortFY}-${Date.now()}`,
            moduleKey: modKey,
            moduleName: modConfig.name,
            year: `FY ${prevFYTokens.midFY}`,
            range: totalGen > 0 ? `${startCode} to ${lastCode}` : 'None generated',
            totalGenerated: totalGen,
            lastNumber: lastGeneratedNum,
            lastSerial: lastCode,
            prefix: modConfig.prefix,
            suffix: modConfig.suffix,
            archivedAt: new Date().toISOString()
          });

          modConfig.nextNumber = modConfig.startingNumber || 1;
          modConfig.activeYear = currentFYStart;
          modConfig.financialYearLabel = currentFYTokens.midFY;
          configChanged = true;
        }
      }
    });

    if (configChanged) {
      this.writeConfig(current);
    }

    return current;
  }

  /**
   * Peek next ID without incrementing sequence
   */
  peekNextId(moduleKey) {
    const config = this.checkYearRollOver();
    const rule = config.modules[moduleKey];
    if (!rule) {
      throw new Error(`Unknown sequence module: ${moduleKey}`);
    }
    return formatSerial(rule, rule.nextNumber);
  }

  /**
   * Atomically get and increment the next sequential ID
   */
  getNextId(moduleKey) {
    const config = this.checkYearRollOver();
    const rule = config.modules[moduleKey];
    if (!rule) {
      throw new Error(`Unknown sequence module: ${moduleKey}`);
    }

    const assignedNumber = rule.nextNumber;
    const generatedId = formatSerial(rule, assignedNumber);

    // Increment next number
    rule.nextNumber = assignedNumber + 1;
    this.writeConfig(config);

    return generatedId;
  }

  /**
   * Ensure that the nextNumber for a module is strictly greater than any existing numeric ID in the provided list.
   * If existing IDs collide with or exceed nextNumber, automatically advance nextNumber past them.
   */
  advancePastExisting(moduleKey, existingCodes = []) {
    const config = this.checkYearRollOver();
    const rule = config.modules[moduleKey];
    if (!rule) return;

    const rawPrefix = (rule.prefix || '').replace(/[-/]/g, '').trim().toUpperCase();
    const prefixPattern = rawPrefix === 'PRD' || moduleKey === 'stocks'
      ? 'PRD|ASI'
      : (rawPrefix ? rawPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '[A-Z0-9]+');
    const regex = new RegExp(`^(?:${prefixPattern})[-_\\/]?(\\d+)$`, 'i');

    let maxNum = 0;
    (existingCodes || []).forEach((c) => {
      const codeStr = String(c || '').trim().toUpperCase();
      const match = codeStr.match(regex);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });

    if (maxNum >= rule.nextNumber) {
      rule.nextNumber = maxNum + 1;
      this.writeConfig(config);
    }
  }

  /**
   * Update configuration for a specific module
   */
  updateModuleRule(moduleKey, updates = {}) {
    const config = this.checkYearRollOver();
    const rule = config.modules[moduleKey];
    if (!rule) {
      throw new Error(`Sequence module ${moduleKey} not found.`);
    }

    if (updates.prefix !== undefined) rule.prefix = String(updates.prefix).trim();
    if (updates.suffix !== undefined) rule.suffix = String(updates.suffix).trim();
    if (updates.paddingDigits !== undefined) {
      rule.paddingDigits = Math.max(1, Math.min(10, parseInt(updates.paddingDigits, 10) || 3));
    }
    if (updates.startingNumber !== undefined) {
      rule.startingNumber = Math.max(1, parseInt(updates.startingNumber, 10) || 1);
    }
    if (updates.nextNumber !== undefined) {
      rule.nextNumber = Math.max(1, parseInt(updates.nextNumber, 10) || 1);
    }
    if (updates.resetPolicy !== undefined) {
      rule.resetPolicy = ['CONTINUOUS', 'FINANCIAL_YEAR', 'CALENDAR_YEAR'].includes(updates.resetPolicy)
        ? updates.resetPolicy
        : 'CALENDAR_YEAR';
    }
    if (updates.activeYear !== undefined && updates.activeYear !== null) {
      rule.activeYear = parseInt(updates.activeYear, 10) || rule.activeYear;
    }
    if (updates.financialYearLabel !== undefined) {
      rule.financialYearLabel = String(updates.financialYearLabel).trim();
    }

    this.writeConfig(config);
    return {
      rule,
      preview: formatSerial(rule, rule.nextNumber)
    };
  }

  /**
   * Manual rollover trigger (useful for testing or annual rollover by Super Admin)
   */
  executeManualRollOver(newYear = null) {
    const config = this.readConfig();
    const targetYear = newYear ? parseInt(newYear, 10) : config.currentCalendarYear + 1;
    const previousYear = config.currentCalendarYear;
    const archivesToPush = [];

    Object.entries(config.modules).forEach(([modKey, modConfig]) => {
      if (modConfig.resetPolicy === 'CALENDAR_YEAR') {
        const totalGen = Math.max(0, modConfig.nextNumber - modConfig.startingNumber);
        const startCode = formatSerial(modConfig, modConfig.startingNumber, previousYear);
        const lastGeneratedNum = Math.max(modConfig.startingNumber, modConfig.nextNumber - 1);
        const lastCode = formatSerial(modConfig, lastGeneratedNum, previousYear);

        archivesToPush.push({
          id: `ARC-${modKey.toUpperCase()}-${previousYear}-${Date.now()}`,
          moduleKey: modKey,
          moduleName: modConfig.name,
          year: previousYear,
          range: totalGen > 0 ? `${startCode} to ${lastCode}` : 'None generated',
          totalGenerated: totalGen,
          lastNumber: lastGeneratedNum,
          lastSerial: lastCode,
          prefix: modConfig.prefix,
          suffix: modConfig.suffix,
          archivedAt: new Date().toISOString()
        });

        // Reset to starting number (1 -> 001) for the new year
        modConfig.nextNumber = modConfig.startingNumber || 1;
        modConfig.activeYear = targetYear;
      } else if (modConfig.resetPolicy === 'FINANCIAL_YEAR') {
        const prevFYTokens = getIndianFinancialYearTokens(new Date(modConfig.activeYear || previousYear, 6, 1));
        const totalGen = Math.max(0, modConfig.nextNumber - modConfig.startingNumber);
        const startCode = formatSerial(modConfig, modConfig.startingNumber, modConfig.activeYear || previousYear);
        const lastGeneratedNum = Math.max(modConfig.startingNumber, modConfig.nextNumber - 1);
        const lastCode = formatSerial(modConfig, lastGeneratedNum, modConfig.activeYear || previousYear);

        archivesToPush.push({
          id: `ARC-${modKey.toUpperCase()}-FY${prevFYTokens.shortFY}-${Date.now()}`,
          moduleKey: modKey,
          moduleName: modConfig.name,
          year: `FY ${prevFYTokens.midFY}`,
          range: totalGen > 0 ? `${startCode} to ${lastCode}` : 'None generated',
          totalGenerated: totalGen,
          lastNumber: lastGeneratedNum,
          lastSerial: lastCode,
          prefix: modConfig.prefix,
          suffix: modConfig.suffix,
          archivedAt: new Date().toISOString()
        });

        const nextFYTokens = getIndianFinancialYearTokens(new Date(targetYear, 6, 1));
        modConfig.nextNumber = modConfig.startingNumber || 1;
        modConfig.activeYear = targetYear;
        modConfig.financialYearLabel = nextFYTokens.midFY;
      }
    });

    config.yearlyArchives = [...(config.yearlyArchives || []), ...archivesToPush];
    config.currentCalendarYear = targetYear;
    this.writeConfig(config);

    return {
      success: true,
      newYear: targetYear,
      archivedYear: previousYear,
      archivedRecords: archivesToPush.length
    };
  }

  /**
   * Get full sequence summary with live previews for UI
   */
  getSummary() {
    const config = this.checkYearRollOver();
    const now = new Date();
    const fyTokens = getIndianFinancialYearTokens(now);
    const modulesWithPreviews = {};

    Object.entries(config.modules).forEach(([key, rule]) => {
      modulesWithPreviews[key] = {
        ...rule,
        livePreview: formatSerial(rule, rule.nextNumber),
        exampleInfinite: formatSerial(rule, 1250)
      };
    });

    return {
      currentCalendarYear: config.currentCalendarYear,
      currentFinancialYear: fyTokens.midFY,
      currentFinancialYearShort: fyTokens.shortFY,
      yearType: config.yearType,
      modules: modulesWithPreviews,
      yearlyArchives: config.yearlyArchives || []
    };
  }
}

const sequenceService = new SequenceService();

module.exports = {
  sequenceService,
  formatSerial
};
