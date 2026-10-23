const fs = require('fs');
const path = require('path');
const crmStore = require('../data/crmStore');
const { readStocks, writeStocks } = require('./inventoryService');

const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');

// Ensure backups directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function generateBackupId() {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BKP-${dateStr}-${randStr}`;
}

function getDatabaseStats() {
  const stocks = readStocks();
  const customersCount = Array.isArray(crmStore.customers) ? crmStore.customers.length : 0;
  const enquiriesCount = Array.isArray(crmStore.enquiries) ? crmStore.enquiries.length : 0;
  const leadsCount = Array.isArray(crmStore.leads) ? crmStore.leads.length : 0;
  const quotationsCount = Array.isArray(crmStore.quotations) ? crmStore.quotations.length : 0;
  const ordersCount = Array.isArray(crmStore.orders) ? crmStore.orders.length : 0;
  const challansCount = Array.isArray(crmStore.deliveryChallans) ? crmStore.deliveryChallans.length : 0;
  const invoicesCount = Array.isArray(crmStore.invoices) ? crmStore.invoices.length : 0;
  const proformasCount = Array.isArray(crmStore.proformas) ? crmStore.proformas.length : 0;
  const purchaseOrdersCount = Array.isArray(crmStore.purchaseOrders) ? crmStore.purchaseOrders.length : 0;
  const goodsReceiptsCount = Array.isArray(crmStore.goodsReceipts) ? crmStore.goodsReceipts.length : 0;
  const suppliersCount = Array.isArray(crmStore.suppliers) ? crmStore.suppliers.length : 0;
  const productsCount = Array.isArray(stocks.products) ? stocks.products.length : 0;
  const transactionsCount = Array.isArray(stocks.inventoryTransactions) ? stocks.inventoryTransactions.length : 0;

  const totalRecords =
    customersCount +
    enquiriesCount +
    leadsCount +
    quotationsCount +
    ordersCount +
    challansCount +
    invoicesCount +
    proformasCount +
    purchaseOrdersCount +
    goodsReceiptsCount +
    suppliersCount +
    productsCount +
    transactionsCount;

  return {
    customers: customersCount,
    enquiries: enquiriesCount,
    leads: leadsCount,
    quotations: quotationsCount,
    orders: ordersCount,
    deliveryChallans: challansCount,
    invoices: invoicesCount,
    proformas: proformasCount,
    purchaseOrders: purchaseOrdersCount,
    goodsReceipts: goodsReceiptsCount,
    suppliers: suppliersCount,
    products: productsCount,
    inventoryTransactions: transactionsCount,
    totalRecords
  };
}

function createBackup({ title = 'Manual Backup', type = 'MANUAL_BACKUP', user = null, note = '' } = {}) {
  const stocks = readStocks();
  const id = generateBackupId();
  const createdAt = new Date().toISOString();
  const stats = getDatabaseStats();

  const backupData = {
    customers: JSON.parse(JSON.stringify(crmStore.customers || [])),
    enquiries: JSON.parse(JSON.stringify(crmStore.enquiries || [])),
    leads: JSON.parse(JSON.stringify(crmStore.leads || [])),
    quotations: JSON.parse(JSON.stringify(crmStore.quotations || [])),
    orders: JSON.parse(JSON.stringify(crmStore.orders || [])),
    deliveryChallans: JSON.parse(JSON.stringify(crmStore.deliveryChallans || [])),
    invoices: JSON.parse(JSON.stringify(crmStore.invoices || [])),
    proformas: JSON.parse(JSON.stringify(crmStore.proformas || [])),
    purchaseOrders: JSON.parse(JSON.stringify(crmStore.purchaseOrders || [])),
    goodsReceipts: JSON.parse(JSON.stringify(crmStore.goodsReceipts || [])),
    suppliers: JSON.parse(JSON.stringify(crmStore.suppliers || [])),
    products: JSON.parse(JSON.stringify(stocks.products || [])),
    inventoryTransactions: JSON.parse(JSON.stringify(stocks.inventoryTransactions || [])),
    categories: JSON.parse(JSON.stringify(stocks.categories || [])),
    subcategories: JSON.parse(JSON.stringify(stocks.subcategories || [])),
    brands: JSON.parse(JSON.stringify(stocks.brands || []))
  };

  const backupRecord = {
    id,
    title: title || 'CRM System Backup',
    type, // 'MANUAL_BACKUP' | 'AUTO_CLEAR_BACKUP' | 'PRE_RESTORE_BACKUP' | 'IMPORTED_BACKUP'
    createdAt,
    createdBy: user?.name || 'Super Admin',
    createdById: user?.id || 'USR-001',
    userMobile: user?.mobile || '',
    note: note || '',
    stats,
    data: backupData
  };

  const filePath = path.join(BACKUP_DIR, `backup_${id}.json`);
  const jsonContent = JSON.stringify(backupRecord, null, 2);
  fs.writeFileSync(filePath, jsonContent, 'utf8');

  const fileStats = fs.statSync(filePath);
  const sizeBytes = fileStats.size;
  const sizeFormatted = formatBytes(sizeBytes);

  return {
    id,
    title: backupRecord.title,
    type,
    createdAt,
    createdBy: backupRecord.createdBy,
    createdById: backupRecord.createdById,
    userMobile: backupRecord.userMobile,
    note: backupRecord.note,
    stats,
    sizeBytes,
    sizeFormatted
  };
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];

  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('backup_') && f.endsWith('.json'));
  const backups = [];

  for (const file of files) {
    try {
      const filePath = path.join(BACKUP_DIR, file);
      const stat = fs.statSync(filePath);
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      backups.push({
        id: raw.id || file.replace(/^backup_|\.json$/g, ''),
        title: raw.title || 'CRM Backup',
        type: raw.type || 'MANUAL_BACKUP',
        createdAt: raw.createdAt || stat.birthtime.toISOString(),
        createdBy: raw.createdBy || 'Super Admin',
        userMobile: raw.userMobile || '',
        note: raw.note || '',
        stats: raw.stats || {},
        sizeBytes: stat.size,
        sizeFormatted: formatBytes(stat.size),
        hasData: Boolean(raw.data)
      });
    } catch (err) {
      console.warn(`[BACKUP] Error reading backup file ${file}:`, err.message);
    }
  }

  // Sort newest first
  backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return backups;
}

function getBackupById(backupId) {
  const filename = `backup_${backupId}.json`;
  const filePath = path.join(BACKUP_DIR, filename);

  if (!fs.existsSync(filePath)) {
    // Try without prefix if id already had filename
    const altPath = path.join(BACKUP_DIR, backupId.endsWith('.json') ? backupId : `${backupId}.json`);
    if (fs.existsSync(altPath)) {
      return JSON.parse(fs.readFileSync(altPath, 'utf8'));
    }
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function clearActiveDatabase({ user = null, options = {} } = {}) {
  // Step 1: Always capture an authoritative auto-backup before any deletion
  const autoBackup = createBackup({
    title: options.title || 'Auto-Backup Before Database Clear',
    type: 'AUTO_CLEAR_BACKUP',
    user,
    note: 'Automated full system snapshot captured immediately prior to clearing the database.'
  });

  // Step 2: Clear active CRM collections in memory and persist
  const clearCustomers = options.clearCustomers !== false;
  const clearEnquiries = options.clearEnquiries !== false;
  const clearLeads = options.clearLeads !== false;
  const clearQuotations = options.clearQuotations !== false;
  const clearOrders = options.clearOrders !== false;
  const clearChallans = options.clearChallans !== false;
  const clearInvoices = options.clearInvoices !== false;
  const clearProformas = options.clearProformas !== false;
  const clearPurchaseOrders = options.clearPurchaseOrders !== false;
  const clearGoodsReceipts = options.clearGoodsReceipts !== false;
  const clearSuppliers = Boolean(options.clearSuppliers);
  const resetStock = options.resetStock !== false;
  const clearProducts = Boolean(options.clearProducts);

  if (clearCustomers && Array.isArray(crmStore.customers)) crmStore.customers.length = 0;
  if (clearEnquiries && Array.isArray(crmStore.enquiries)) crmStore.enquiries.length = 0;
  if (clearLeads && Array.isArray(crmStore.leads)) crmStore.leads.length = 0;
  if (clearQuotations && Array.isArray(crmStore.quotations)) crmStore.quotations.length = 0;
  if (clearOrders && Array.isArray(crmStore.orders)) crmStore.orders.length = 0;
  if (clearChallans && Array.isArray(crmStore.deliveryChallans)) crmStore.deliveryChallans.length = 0;
  if (clearInvoices && Array.isArray(crmStore.invoices)) crmStore.invoices.length = 0;
  if (clearProformas && Array.isArray(crmStore.proformas)) crmStore.proformas.length = 0;
  if (clearPurchaseOrders && Array.isArray(crmStore.purchaseOrders)) crmStore.purchaseOrders.length = 0;
  if (clearGoodsReceipts && Array.isArray(crmStore.goodsReceipts)) crmStore.goodsReceipts.length = 0;
  if (clearSuppliers && Array.isArray(crmStore.suppliers)) crmStore.suppliers.length = 0;

  crmStore.persistStore();

  // Step 3: Handle inventory transactions and stock levels
  const stocks = readStocks();
  if (resetStock) {
    if (Array.isArray(stocks.inventoryTransactions)) stocks.inventoryTransactions.length = 0;
    if (Array.isArray(stocks.products)) {
      stocks.products.forEach((p) => {
        p.stock = 0;
        p.availableStock = 0;
        p.totalStock = 0;
        p.reservedStock = 0;
        p.unavailableStock = 0;
        p.serialNumbers = [];
        p.history = [];
      });
    }
  }
  if (clearProducts) {
    if (Array.isArray(stocks.products)) stocks.products.length = 0;
    if (Array.isArray(stocks.inventoryTransactions)) stocks.inventoryTransactions.length = 0;
  }
  writeStocks(stocks);

  // Step 4: MongoDB sync if connected
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const models = require('../models');
      const collectionsToWipe = [];
      if (clearCustomers && models.Customer) collectionsToWipe.push(models.Customer.deleteMany({}));
      if (clearEnquiries && models.Enquiry) collectionsToWipe.push(models.Enquiry.deleteMany({}));
      if (clearLeads && models.Lead) collectionsToWipe.push(models.Lead.deleteMany({}));
      if (clearQuotations && models.Quotation) collectionsToWipe.push(models.Quotation.deleteMany({}));
      if (clearOrders && models.Order) collectionsToWipe.push(models.Order.deleteMany({}));
      if (clearChallans && models.DeliveryChallan) collectionsToWipe.push(models.DeliveryChallan.deleteMany({}));
      if (clearInvoices && models.Invoice) collectionsToWipe.push(models.Invoice.deleteMany({}));
      if (clearProformas && models.Proforma) collectionsToWipe.push(models.Proforma.deleteMany({}));
      if (clearPurchaseOrders && models.PurchaseOrder) collectionsToWipe.push(models.PurchaseOrder.deleteMany({}));
      if (clearGoodsReceipts && models.GoodsReceipt) collectionsToWipe.push(models.GoodsReceipt.deleteMany({}));
      if (clearSuppliers && models.Supplier) collectionsToWipe.push(models.Supplier.deleteMany({}));
      if (resetStock && models.InventoryTransaction) collectionsToWipe.push(models.InventoryTransaction.deleteMany({}));

      Promise.all(collectionsToWipe).catch((err) => {
        console.warn('[BACKUP] Mongo clear warning:', err.message);
      });
    }
  } catch (mongoErr) {
    console.warn('[BACKUP] MongoDB sync notice:', mongoErr.message);
  }

  return {
    success: true,
    message: 'Active database successfully cleared. A full backup snapshot was securely archived.',
    autoBackup,
    clearedStats: autoBackup.stats
  };
}

function restoreBackup(backupId, { user = null } = {}) {
  const backup = getBackupById(backupId);
  if (!backup || !backup.data) {
    throw new Error(`Backup snapshot ${backupId} was not found or is corrupt.`);
  }

  // Step 1: Create a safety backup of the current database before overwriting
  const currentStats = getDatabaseStats();
  let safetyBackup = null;
  if (currentStats.totalRecords > 0) {
    safetyBackup = createBackup({
      title: `Safety Snapshot (Pre-Restore of ${backupId})`,
      type: 'PRE_RESTORE_BACKUP',
      user,
      note: `Auto-saved prior to restoring backup ${backupId}`
    });
  }

  // Step 2: Restore CRM collections in memory and persist
  const d = backup.data;
  if (Array.isArray(d.customers)) crmStore.customers.splice(0, crmStore.customers.length, ...d.customers);
  if (Array.isArray(d.enquiries)) crmStore.enquiries.splice(0, crmStore.enquiries.length, ...d.enquiries);
  if (Array.isArray(d.leads)) crmStore.leads.splice(0, crmStore.leads.length, ...d.leads);
  if (Array.isArray(d.quotations)) crmStore.quotations.splice(0, crmStore.quotations.length, ...d.quotations);
  if (Array.isArray(d.orders)) crmStore.orders.splice(0, crmStore.orders.length, ...d.orders);
  if (Array.isArray(d.deliveryChallans)) crmStore.deliveryChallans.splice(0, crmStore.deliveryChallans.length, ...d.deliveryChallans);
  if (Array.isArray(d.invoices)) crmStore.invoices.splice(0, crmStore.invoices.length, ...d.invoices);
  if (Array.isArray(d.proformas)) crmStore.proformas.splice(0, crmStore.proformas.length, ...d.proformas);
  if (Array.isArray(d.purchaseOrders)) crmStore.purchaseOrders.splice(0, crmStore.purchaseOrders.length, ...d.purchaseOrders);
  if (Array.isArray(d.goodsReceipts)) crmStore.goodsReceipts.splice(0, crmStore.goodsReceipts.length, ...d.goodsReceipts);
  if (Array.isArray(d.suppliers) && d.suppliers.length > 0) crmStore.suppliers.splice(0, crmStore.suppliers.length, ...d.suppliers);

  crmStore.persistStore();

  // Step 3: Restore stocks & inventory
  const stocks = readStocks();
  if (Array.isArray(d.products)) stocks.products = d.products;
  if (Array.isArray(d.inventoryTransactions)) stocks.inventoryTransactions = d.inventoryTransactions;
  if (Array.isArray(d.categories)) stocks.categories = d.categories;
  if (Array.isArray(d.subcategories)) stocks.subcategories = d.subcategories;
  if (Array.isArray(d.brands)) stocks.brands = d.brands;
  writeStocks(stocks);

  // Step 4: Sync to MongoDB if connected
  try {
    const { syncStoreToMongo, syncStockToMongo } = require('./mongoSyncService');
    syncStoreToMongo(crmStore);
    syncStockToMongo(stocks.products, stocks.inventoryTransactions);
  } catch (mongoErr) {
    console.warn('[BACKUP] Mongo restore sync notice:', mongoErr.message);
  }

  return {
    success: true,
    message: `Database successfully restored from backup ${backupId}.`,
    restoredBackup: {
      id: backup.id,
      title: backup.title,
      createdAt: backup.createdAt,
      stats: backup.stats
    },
    safetyBackup: safetyBackup ? { id: safetyBackup.id, title: safetyBackup.title } : null
  };
}

function deleteBackup(backupId) {
  const filename = `backup_${backupId}.json`;
  const filePath = path.join(BACKUP_DIR, filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return { success: true, message: `Backup ${backupId} deleted permanently.` };
  }

  const altPath = path.join(BACKUP_DIR, backupId.endsWith('.json') ? backupId : `${backupId}.json`);
  if (fs.existsSync(altPath)) {
    fs.unlinkSync(altPath);
    return { success: true, message: `Backup ${backupId} deleted permanently.` };
  }

  return { success: false, message: `Backup ${backupId} not found.` };
}

function importBackup(jsonString, { user = null } = {}) {
  let parsed;
  try {
    parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
  } catch (err) {
    throw new Error('Invalid JSON format for imported backup file.');
  }

  const data = parsed.data || parsed;
  if (!data || typeof data !== 'object') {
    throw new Error('Imported file does not contain valid CRM backup data.');
  }

  const id = generateBackupId();
  const createdAt = new Date().toISOString();

  // Compute stats of imported payload
  const stats = {
    customers: Array.isArray(data.customers) ? data.customers.length : 0,
    enquiries: Array.isArray(data.enquiries) ? data.enquiries.length : 0,
    leads: Array.isArray(data.leads) ? data.leads.length : 0,
    quotations: Array.isArray(data.quotations) ? data.quotations.length : 0,
    orders: Array.isArray(data.orders) ? data.orders.length : 0,
    deliveryChallans: Array.isArray(data.deliveryChallans) ? data.deliveryChallans.length : 0,
    invoices: Array.isArray(data.invoices) ? data.invoices.length : 0,
    proformas: Array.isArray(data.proformas) ? data.proformas.length : 0,
    purchaseOrders: Array.isArray(data.purchaseOrders) ? data.purchaseOrders.length : 0,
    goodsReceipts: Array.isArray(data.goodsReceipts) ? data.goodsReceipts.length : 0,
    suppliers: Array.isArray(data.suppliers) ? data.suppliers.length : 0,
    products: Array.isArray(data.products) ? data.products.length : 0,
    inventoryTransactions: Array.isArray(data.inventoryTransactions) ? data.inventoryTransactions.length : 0
  };
  stats.totalRecords = Object.values(stats).reduce((a, b) => a + b, 0);

  const backupRecord = {
    id,
    title: parsed.title ? `Imported: ${parsed.title}` : 'Imported CRM Backup File',
    type: 'IMPORTED_BACKUP',
    createdAt,
    createdBy: user?.name || 'Super Admin (Imported)',
    createdById: user?.id || 'USR-001',
    userMobile: user?.mobile || '',
    note: parsed.note || 'Restored from uploaded JSON backup file',
    stats,
    data: {
      customers: data.customers || [],
      enquiries: data.enquiries || [],
      leads: data.leads || [],
      quotations: data.quotations || [],
      orders: data.orders || [],
      deliveryChallans: data.deliveryChallans || [],
      invoices: data.invoices || [],
      proformas: data.proformas || [],
      purchaseOrders: data.purchaseOrders || [],
      goodsReceipts: data.goodsReceipts || [],
      suppliers: data.suppliers || [],
      products: data.products || [],
      inventoryTransactions: data.inventoryTransactions || [],
      categories: data.categories || [],
      subcategories: data.subcategories || [],
      brands: data.brands || []
    }
  };

  const filePath = path.join(BACKUP_DIR, `backup_${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(backupRecord, null, 2), 'utf8');

  const fileStats = fs.statSync(filePath);
  return {
    id,
    title: backupRecord.title,
    type: backupRecord.type,
    createdAt,
    createdBy: backupRecord.createdBy,
    stats,
    sizeBytes: fileStats.size,
    sizeFormatted: formatBytes(fileStats.size)
  };
}

module.exports = {
  getDatabaseStats,
  createBackup,
  listBackups,
  getBackupById,
  clearActiveDatabase,
  restoreBackup,
  deleteBackup,
  importBackup
};
