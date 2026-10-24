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
      prefix: 'QTN/',
      suffix: '/{YYYY}',
      paddingDigits: 3,
      startingNumber: 1,
      nextNumber: 1,
      resetPolicy: 'CALENDAR_YEAR',
      activeYear: new Date().getFullYear(),
      description: 'Commercial sales quotation document series'
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
      prefix: 'PRD-',
      suffix: '',
      paddingDigits: 3,
      startingNumber: 1,
      nextNumber: 1,
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
 * Format a number using the module's rule
 */
function formatSerial(rule, number, year) {
  const activeYear = year || rule.activeYear || new Date().getFullYear();
  const pad = Math.max(1, parseInt(rule.paddingDigits, 10) || 3);
  const formattedNumber = String(number).padStart(pad, '0');
  const suffix = (rule.suffix || '')
    .replace('{YYYY}', String(activeYear))
    .replace('{YY}', String(activeYear).slice(-2));
  return `${rule.prefix || ''}${formattedNumber}${suffix}`;
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
   * Check if calendar year has rolled over, archive completed year sequences, and reset to starting number.
   */
  checkYearRollOver(config = null) {
    const current = config || this.readConfig();
    const currentYear = new Date().getFullYear();

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
      rule.resetPolicy = updates.resetPolicy === 'CONTINUOUS' ? 'CONTINUOUS' : 'CALENDAR_YEAR';
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
