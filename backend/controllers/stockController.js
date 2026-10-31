const fs = require('fs');
const path = require('path');
const { hasPermission } = require('../utils/accessControl');
const { sequenceService } = require('../services/sequenceService');
const { deliveryChallans, invoices, goodsReceipts, purchaseOrders, orders, quotations } = require('../data/crmStore');
const { filterRecordsBySearch } = require('../utils/searchHelper');
const { getDefaultBoxForProduct } = require('./warehouseController');


const DATA_FILE = path.join(__dirname, '..', 'data', 'stocks-data.json');
const DEFAULTS = {
  categories: [
    { id: 'CAT-001', name: 'IP Cameras', description: 'Network surveillance cameras' },
    { id: 'CAT-002', name: 'NVR & DVR', description: 'Recording and storage systems' },
    { id: 'CAT-003', name: 'Networking', description: 'Switches, routers and network accessories' },
    { id: 'CAT-004', name: 'Cables', description: 'Copper and fiber connectivity' },
    { id: 'CAT-005', name: 'Storage', description: 'Hard drives and SSD storage' }
  ],
  subcategories: [
    { id: 'SUBCAT-001', name: 'Bullet Camera', categoryId: 'CAT-001' },
    { id: 'SUBCAT-002', name: 'Dome Camera', categoryId: 'CAT-001' },
    { id: 'SUBCAT-003', name: '8 Channel NVR', categoryId: 'CAT-002' },
    { id: 'SUBCAT-004', name: 'PoE Switch', categoryId: 'CAT-003' },
    { id: 'SUBCAT-005', name: 'Cat6 UTP Cable', categoryId: 'CAT-004' }
  ],
  brands: [
    { id: 'BR-001', name: 'Dahua', description: 'Video surveillance and security solutions' },
    { id: 'BR-002', name: 'CP Plus', description: 'Security cameras and recording solutions' },
    { id: 'BR-003', name: 'Hikvision', description: 'Video surveillance products' },
    { id: 'BR-004', name: 'TP-Link', description: 'Networking equipment' },
    { id: 'BR-005', name: 'Western Digital', description: 'Storage products' }
  ],
  products: [
    { id: 'PRD-001', code: 'CAM-IPC-001', name: 'Dahua 5MP IR Bullet Camera', description: '5MP outdoor IR bullet camera with night vision.', categoryId: 'CAT-001', subcategoryId: 'SUBCAT-001', brandId: 'BR-001', unit: 'Nos', cost: 4200, dealerPrice: 4850, mrp: 5600, stock: 42, alertQuantity: 10, gst: 18, hsnSac: '85258090', serialized: true },
    { id: 'PRD-002', code: 'CAM-IPC-002', name: 'CP Plus 2MP Dome Camera', description: '2MP indoor dome camera with 20m IR range, plastic housing, 3.6mm fixed lens.', categoryId: 'CAT-001', subcategoryId: 'SUBCAT-002', brandId: 'BR-002', unit: 'Nos', cost: 2700, dealerPrice: 3150, mrp: 3800, stock: 18, alertQuantity: 8, gst: 18, hsnSac: '85258090', serialized: true },
    { id: 'PRD-003', code: 'NVR-008-001', name: 'Hikvision 8 Channel PoE NVR', description: '8 Channel Network Video Recorder with 8-port built-in PoE switch, 4K HDMI output, H.265+ compression and dual SATA interface.', categoryId: 'CAT-002', subcategoryId: 'SUBCAT-003', brandId: 'BR-003', unit: 'Nos', cost: 7800, dealerPrice: 8600, mrp: 10200, stock: 6, alertQuantity: 5, gst: 18, hsnSac: '85219090', serialized: true },
    { id: 'PRD-004', code: 'NET-SW-001', name: 'TP-Link 8 Port PoE Switch', description: '', categoryId: 'CAT-003', subcategoryId: 'SUBCAT-004', brandId: 'BR-004', unit: 'Nos', cost: 4200, dealerPrice: 4700, mrp: 5600, stock: 4, alertQuantity: 6, gst: 18, hsnSac: '85176290', serialized: true },
    { id: 'PRD-005', code: 'HDD-1TB-001', name: 'WD Purple 1TB Surveillance HDD', description: '', categoryId: 'CAT-005', subcategoryId: null, brandId: 'BR-005', unit: 'Nos', cost: 4900, dealerPrice: 5450, mrp: 6500, stock: 11, alertQuantity: 4, gst: 18, hsnSac: '84717020', serialized: true }
  ]
};

function ensureData() {
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULTS, null, 2), 'utf8');
}

// Collect all serial numbers already dispatched and physically deducted in Delivery Challans to prevent reuse
function getDispatchedSerialsSet() {
  const dispatched = new Set();
  (deliveryChallans || []).forEach((dc) => {
    if (dc.stockDeducted === true) {
      (dc.items || []).forEach((it) => {
        (it.serialNumbers || []).forEach((sn) => {
          if (sn) dispatched.add(String(sn).trim().toUpperCase());
        });
      });
    }
  });
  return dispatched;
}

// The stock master should expose only real production master data.
// Older development builds could leave obvious test rows behind, so sanitize
// them at the persistence boundary as well as in the UI. This keeps search,
// counts, dropdowns and all subsequent reloads consistent.
function isTestStockRecord(record) {
  const name = String(record?.name || '').trim();
  const description = String(record?.description || '').trim();
  const code = String(record?.code || record?.id || '').trim();
  return (
    /^test\b/i.test(name) ||
    /^test\b/i.test(description) ||
    /^(cat|cat2|subcat|brand)\s+\d{8,}$/i.test(name) ||
    /^brand\s+\d{8,}$/i.test(code)
  );
}

// Rule: For cables, there should NOT be any serial numbers.
function isCableProduct(product, categories = [], subcategories = []) {
  if (!product) return false;
  const catId = String(product.categoryId || '').trim().toUpperCase();
  if (catId === 'CAT-000004') return true;

  const catName = Array.isArray(categories)
    ? (categories.find((c) => String(c.id).toUpperCase() === catId)?.name || '')
    : '';
  if (/cable/i.test(catName)) return true;

  const subId = String(product.subcategoryId || '').trim().toUpperCase();
  const subName = Array.isArray(subcategories)
    ? (subcategories.find((s) => String(s.id).toUpperCase() === subId)?.name || '')
    : '';
  if (/cable/i.test(subName)) return true;

  const prodName = String(product.name || '').trim();
  if (/\bcables?\b/i.test(prodName) || /cat\s*6\s*cable/i.test(prodName) || /utp\s*cable/i.test(prodName) || /patch\s*cord/i.test(prodName) || /fiber\s*cable/i.test(prodName)) {
    return true;
  }

  const unit = String(product.unit || '').trim();
  if ((unit === 'Meter' || unit === 'Roll') && /cable|wire/i.test(prodName)) {
    return true;
  }

  return false;
}

// Computer-generated serial numbers helper: find highest used sequence number
function getNextSerialNumberSequence(product, data, dispatchedSerials = null) {
  if (!product) return 1001;
  const prodCode = String(product.code || '').trim().toUpperCase();
  const prodId = String(product.id || '').trim().toUpperCase();
  const dispatched = dispatchedSerials || getDispatchedSerialsSet();

  let maxSeq = 1000;

  const checkSerial = (sn) => {
    if (!sn) return;
    const s = String(sn).trim();
    const match = s.match(/(?:SN-|SN|-)?(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq && num < 10000000) {
        maxSeq = num;
      }
    }
  };

  (product.serialNumbers || []).forEach(checkSerial);

  (data?.inventoryTransactions || []).forEach((t) => {
    if (
      (t.productId && String(t.productId).toUpperCase() === prodId) ||
      (t.productCode && String(t.productCode).toUpperCase() === prodCode)
    ) {
      (t.serialNumbers || []).forEach(checkSerial);
    }
  });

  dispatched.forEach((sn) => {
    if (sn.toUpperCase().startsWith(prodCode)) {
      checkSerial(sn);
    }
  });

  return maxSeq + 1;
}

// Generate computer-generated unique sequential serial numbers
function generateComputerSerialNumbers(product, count, data, existingBatch = []) {
  if (!product || isCableProduct(product, data?.categories, data?.subcategories)) {
    return [];
  }
  const qty = parseInt(count, 10);
  if (isNaN(qty) || qty <= 0) return [];

  const prodCode = String(product.code || 'PROD').trim().toUpperCase();
  const dispatched = getDispatchedSerialsSet();
  const existingSet = new Set((product.serialNumbers || []).map((s) => String(s).trim().toUpperCase()));
  (existingBatch || []).forEach((s) => existingSet.add(String(s).trim().toUpperCase()));

  let nextSeq = getNextSerialNumberSequence(product, data, dispatched);
  const result = [];

  while (result.length < qty) {
    const cand = `${prodCode}-SN-${nextSeq++}`;
    const candUpper = cand.toUpperCase();
    if (!existingSet.has(candUpper) && !dispatched.has(candUpper)) {
      result.push(cand);
      existingSet.add(candUpper);
    }
  }

  return result;
}

function sanitizeStockData(data) {
  const categories = (data.categories || []).filter((item) => !isTestStockRecord(item));
  const categoryIds = new Set(categories.map((item) => item.id));
  const subcategories = (data.subcategories || []).filter(
    (item) => !isTestStockRecord(item) && categoryIds.has(item.categoryId)
  );
  const subcategoryIds = new Set(subcategories.map((item) => item.id));
  const brands = (data.brands || []).filter((item) => !isTestStockRecord(item));
  const brandIds = new Set(brands.map((item) => item.id));

  const dispatchedSerials = getDispatchedSerialsSet();

  const CANONICAL_HSN_BY_CODE = {
    'CAM-IPC-001': '85258090',
    'CAM-IPC-002': '85258090',
    'NVR-008-001': '85219090',
    'NET-SW-001': '85176290',
    'HDD-1TB-001': '84717020'
  };

  const products = (data.products || [])
    .filter(
      (item) => !isTestStockRecord(item) &&
        categoryIds.has(item.categoryId) &&
        (!item.subcategoryId || subcategoryIds.has(item.subcategoryId)) &&
        (!item.brandId || brandIds.has(item.brandId))
    )
    .map((p) => {
    const isCable = isCableProduct(p, categories, subcategories);
    const resolvedHsn = String(p.hsnSac || CANONICAL_HSN_BY_CODE[p.code] || '85258090').trim();

    // Rule: For cables, there should NOT be any serial numbers!
    if (isCable) {
      return {
        ...p,
        hsnSac: resolvedHsn,
        serialized: false,
        serialNumbers: []
      };
    }

    const isSerialized = Boolean(p.serialized);
    const stock = Number(p.stock || 0);
    let serials = [];
    if (isSerialized) {
      const existing = Array.isArray(p.serialNumbers) ? p.serialNumbers.map((s) => String(s).trim()).filter(Boolean) : [];
      // Retain existing active serials that are not already dispatched
      serials = existing.filter((s) => !dispatchedSerials.has(s.toUpperCase()));
      if (serials.length > stock) {
        serials = serials.slice(0, stock);
      }
    }
    return {
      ...p,
      hsnSac: resolvedHsn,
      serialized: isSerialized,
      serialNumbers: serials
    };
  });

  // Also sanitize inventory transactions so cables never have serial numbers
  const inventoryTransactions = (Array.isArray(data.inventoryTransactions) ? data.inventoryTransactions : []).map((t) => {
    const prod = products.find((p) => p.id === t.productId || p.code === t.productCode);
    if (prod && isCableProduct(prod, categories, subcategories)) {
      return { ...t, serialNumbers: [] };
    }
    return t;
  });

  return { categories, subcategories, brands, products, inventoryTransactions };
}

function readData() {
  ensureData();
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const sanitized = sanitizeStockData(raw);
    const changed = JSON.stringify(raw) !== JSON.stringify(sanitized);
    if (changed) writeData(sanitized);
    return sanitized;
  } catch {
    const fallback = JSON.parse(JSON.stringify(DEFAULTS));
    writeData(fallback);
    return fallback;
  }
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  try {
    const { syncStockToMongo } = require('../services/mongoSyncService');
    syncStockToMongo(data.products, data.inventoryTransactions);
  } catch (err) {
    // Non-blocking fallback
  }
}
function allowed(req, res, action) {
  return requirePermission(req, res, 'Stocks', action);
}
function requirePermission(req, res, moduleName, action) {
  if (hasPermission(req, moduleName, action)) return true;
  res.status(403).json({ success: false, message: `You do not have permission to ${action.toLowerCase()} stocks.` });
  return false;
}
function nextId(prefix, items) {
  let n = items.length + 1; let id = `${prefix}-${String(n).padStart(3, '0')}`;
  while (items.some((x) => x.id === id)) { n += 1; id = `${prefix}-${String(n).padStart(3, '0')}`; }
  return id;
}

function normalizeProductCode(code) {
  return String(code || '').trim().toUpperCase();
}

function getNextProductCode(products) {
  try {
    const existingCodes = (products || []).flatMap((p) => [p.code, p.id]).filter(Boolean);
    if (typeof sequenceService.advancePastExisting === 'function') {
      sequenceService.advancePastExisting('stocks', existingCodes);
    }
    let candidate = sequenceService.peekNextId('stocks');
    let safetyCounter = 0;
    while (isDuplicateProductCode(products, candidate) && safetyCounter < 100) {
      sequenceService.getNextId('stocks');
      candidate = sequenceService.peekNextId('stocks');
      safetyCounter++;
    }
    return candidate;
  } catch {
    let maxNum = 0;
    (products || []).forEach((p) => {
      const code = String(p.code || '').trim().toUpperCase();
      const match = code.match(/^(?:ASI|PRD)-?(\d+)$/i) || code.match(/(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    const nextNum = maxNum + 1;
    return `ASI-${String(nextNum).padStart(2, '0')}`;
  }
}

function isDuplicateProductCode(products, code, excludeId = null) {
  const norm = normalizeProductCode(code);
  if (!norm) return false;
  const compact = norm.replace(/[^A-Z0-9]/g, '');
  return (products || []).some((p) => {
    if (excludeId && String(p.id).toLowerCase() === String(excludeId).toLowerCase()) return false;
    const pNorm = normalizeProductCode(p.code);
    const pCompact = pNorm.replace(/[^A-Z0-9]/g, '');
    return pNorm === norm || (compact && pCompact === compact);
  });
}

function getNextProductCodeEndpoint(req, res) {
  try {
    const data = readData();
    const nextCode = getNextProductCode(data.products || []);
    return res.status(200).json({ success: true, nextCode });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function validateProductCodeEndpoint(req, res) {
  try {
    const data = readData();
    const code = req.query.code;
    const excludeId = req.query.excludeId || null;
    if (!code || !String(code).trim()) {
      return res.status(400).json({ success: false, message: 'Product code is required for validation.' });
    }
    const norm = normalizeProductCode(code);
    const duplicate = isDuplicateProductCode(data.products || [], norm, excludeId);
    if (duplicate) {
      return res.status(200).json({
        success: true,
        available: false,
        message: `Product code ${norm} is already in use.`
      });
    }
    return res.status(200).json({
      success: true,
      available: true,
      message: `Product code ${norm} is available.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function generateSerialNumbersEndpoint(req, res) {
  try {
    const data = readData();
    const id = req.params.id || req.query.productId || req.query.code;
    const qty = parseInt(req.query.qty || req.query.quantity || '1', 10);

    const product = (data.products || []).find(
      (p) => String(p.id).toUpperCase() === String(id || '').toUpperCase() ||
             String(p.code).toUpperCase() === String(id || '').toUpperCase()
    );

    if (!product) {
      const code = String(req.query.code || 'ASI-01').trim().toUpperCase();
      const serials = generateComputerSerialNumbers({ code, serialNumbers: [] }, qty, data);
      return res.status(200).json({ success: true, serialNumbers: serials });
    }

    if (isCableProduct(product, data.categories, data.subcategories)) {
      return res.status(200).json({
        success: true,
        isCable: true,
        serialized: false,
        serialNumbers: [],
        message: 'Serial numbers are not applicable for cables.'
      });
    }

    const serials = generateComputerSerialNumbers(product, qty, data);
    return res.status(200).json({
      success: true,
      productId: product.id,
      productCode: product.code,
      serialNumbers: serials
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

function buildProductTransactions(product, data) {
  if (!product) return [];
  const prodId = String(product.id || '').trim();
  const prodCode = String(product.code || '').trim();
  const currentStock = Number(product.stock || 0);

  // 1. Gather all stored physical transactions from data.inventoryTransactions for this product
  const storedTxns = (data.inventoryTransactions || []).filter(
    (t) => (t.productId && String(t.productId).trim() === prodId) || (t.productCode && String(t.productCode).trim() === prodCode)
  );

  const historyMap = new Map();

  // Helper to add or enrich a transaction
  const addTxn = (txn) => {
    if (!txn || !txn.id) return;
    const existing = historyMap.get(txn.id);
    if (!existing) {
      historyMap.set(txn.id, { ...txn, currentStock });
    } else {
      // Merge while preserving historical rates and earliest dates
      historyMap.set(txn.id, {
        ...existing,
        ...txn,
        currentStock,
        unitRate: existing.unitRate !== undefined ? existing.unitRate : txn.unitRate,
        gstRate: existing.gstRate !== undefined ? existing.gstRate : txn.gstRate,
        totalValue: existing.totalValue !== undefined ? existing.totalValue : txn.totalValue
      });
    }
  };

  // Process stored transactions first
  storedTxns.forEach((st) => {
    let evt = st.event;
    if (!evt) {
      if (st.referenceType === 'GOODS_RECEIPT' || st.referenceType === 'GRN') evt = 'Goods Receipt';
      else if (st.referenceType === 'DELIVERY_CHALLAN' || st.referenceType === 'DC') evt = 'Delivery Challan';
      else if (st.referenceType === 'SALES_INVOICE' || st.referenceType === 'INV') evt = 'Sales Invoice';
      else if (st.referenceType === 'RETURN_DC') evt = 'Return DC';
      else if (st.referenceType === 'PROD') evt = 'Product Added';
      else evt = 'Stock Movement';
    }

    const ref = st.reference || st.referenceId || st.id;
    let unitRate = st.unitRate;
    let gstRate = st.gstRate;
    let totalValue = st.totalValue;
    let supplierName = st.supplierName;
    let customerName = st.customerName;

    // Enrich historical price from PO if GRN is missing it
    if ((evt === 'Goods Receipt' || st.referenceType === 'GOODS_RECEIPT' || st.referenceType === 'GRN') && (unitRate === undefined || unitRate === null)) {
      const poRef = st.poReference || st.purchaseOrderId;
      if (poRef && Array.isArray(purchaseOrders)) {
        const po = purchaseOrders.find((p) => p.id === poRef);
        if (po) {
          supplierName = supplierName || po.supplierName || po.supplierSnapshot?.companyName;
          const poItem = (po.items || []).find((it) => it.productId === prodId || it.productCode === prodCode);
          if (poItem) {
            unitRate = Number(poItem.rate || 0);
            gstRate = Number(poItem.gst || poItem.gstRate || 0);
            totalValue = Number((Math.abs(st.quantity || 0) * unitRate).toFixed(2));
          }
        }
      }
    }

    let canonicalId = st.id;
    if (st.reference && (evt === 'Delivery Challan' || st.referenceType === 'DC' || String(st.id || '').startsWith('TXN-DC-'))) {
      canonicalId = `TXN-DC-${st.reference}-${prodCode}`;
    } else if (st.reference && (evt === 'Goods Receipt' || st.referenceType === 'GRN' || st.referenceType === 'GOODS_RECEIPT' || String(st.id || '').startsWith('TXN-GOODS_RECEIPT-') || String(st.id || '').startsWith('TXN-GRN-'))) {
      canonicalId = `TXN-GOODS_RECEIPT-${st.reference}-${prodCode}`;
    } else if (st.reference && (evt === 'Sales Invoice' || st.referenceType === 'INV' || String(st.id || '').startsWith('TXN-INV-'))) {
      canonicalId = `TXN-INV-${st.reference}-${prodCode}`;
    }

    addTxn({
      ...st,
      id: canonicalId,
      event: evt,
      reference: ref,
      unitRate: unitRate !== undefined ? unitRate : Number(product.cost || 0),
      gstRate: gstRate !== undefined ? gstRate : Number(product.gst || 0),
      totalValue: totalValue !== undefined ? totalValue : Number((Math.abs(st.quantity || 0) * Number(product.cost || 0)).toFixed(2)),
      supplierName: supplierName || (evt === 'Goods Receipt' ? st.partyName : null),
      customerName: customerName || (evt === 'Delivery Challan' || evt === 'Sales Invoice' || evt === 'Return DC' ? st.partyName : null)
    });
  });

  // 2. Add any Goods Receipts from crmStore.goodsReceipts not yet present
  (goodsReceipts || []).forEach((grn) => {
    (grn.items || []).forEach((it) => {
      const match = (it.productId && String(it.productId).trim() === prodId) || (it.productCode && String(it.productCode).trim() === prodCode);
      if (!match) return;
      const qty = Number(it.quantity || it.receiveNow || 0);
      if (qty <= 0) return;
      const txnId = `TXN-GOODS_RECEIPT-${grn.id || grn.grnId}-${it.productCode || it.productId || prodCode}`;
      
      let poRate = Number(it.rate || it.unitRate || 0);
      let poGst = Number(it.gst || it.gstRate || 0);
      const poRef = grn.purchaseOrderId || grn.poNumber;
      let supName = grn.supplierName || grn.partyName;
      if (poRef && Array.isArray(purchaseOrders)) {
        const linkedPo = purchaseOrders.find((p) => p.id === poRef);
        if (linkedPo) {
          supName = supName || linkedPo.supplierName || linkedPo.supplierSnapshot?.companyName;
          const poItem = (linkedPo.items || []).find((pi) => pi.productId === prodId || pi.productCode === prodCode);
          if (poItem && !poRate) {
            poRate = Number(poItem.rate || 0);
            poGst = Number(poItem.gst || poItem.gstRate || 0);
          }
        }
      }
      if (!poRate) poRate = Number(product.cost || 0);
      if (!poGst) poGst = Number(product.gst || 0);

      addTxn({
        id: txnId,
        productId: prodId,
        productCode: prodCode,
        productName: product.name,
        date: grn.createdAt || grn.receivedDate || '2026-09-17T10:00:00.000Z',
        event: 'Goods Receipt',
        reference: grn.id || grn.grnId,
        referenceType: 'GRN',
        referenceId: grn.id || grn.grnId,
        poReference: poRef || null,
        quantity: qty,
        unitRate: poRate,
        gstRate: poGst,
        taxAmount: Number((qty * poRate * (poGst / 100)).toFixed(2)),
        totalValue: Number((qty * poRate).toFixed(2)),
        supplierId: grn.supplierId || null,
        supplierName: supName || 'Supplier',
        partyName: supName || 'Supplier',
        customerName: null,
        serialNumbers: Array.isArray(it.serialNumbers) ? it.serialNumbers : [],
        remarks: grn.supplierName ? `Received from ${grn.supplierName} under ${grn.id || grn.grnId}` : `Received via Goods Receipt (${grn.id || grn.grnId})`
      });
    });
  });

  // 3. Add committed Delivery Challans from crmStore.deliveryChallans
  (deliveryChallans || []).forEach((dc) => {
    if (dc.status === 'DRAFT' || !dc.stockDeducted) return;
    (dc.items || []).forEach((it) => {
      const match = (it.productId && String(it.productId).trim() === prodId) || (it.productCode && String(it.productCode).trim() === prodCode);
      if (!match) return;
      const qty = Number(it.quantity || 0);
      if (qty <= 0) return;
      const txnId = `TXN-DC-${dc.challanId}-${it.productCode || it.productId || prodCode}`;
      const unitRate = Number(it.rate || it.unitRate || product.dealerPrice || product.cost || 0);
      const gstRate = Number(it.gst || it.gstRate || product.gst || 0);

      addTxn({
        id: txnId,
        productId: prodId,
        productCode: prodCode,
        productName: product.name,
        date: dc.createdAt || dc.deliveryDate || '2026-09-15T10:30:00.000Z',
        event: 'Delivery Challan',
        reference: dc.challanId,
        referenceType: 'DC',
        referenceId: dc.challanId,
        quantity: -qty,
        unitRate: unitRate,
        gstRate: gstRate,
        taxAmount: Number((qty * unitRate * (gstRate / 100)).toFixed(2)),
        totalValue: Number((qty * unitRate).toFixed(2)),
        customerId: dc.customerId || null,
        customerName: dc.customerName || 'Customer',
        partyName: dc.customerName || 'Customer',
        serialNumbers: Array.isArray(it.serialNumbers) ? it.serialNumbers : [],
        remarks: dc.customerName ? `Dispatched to ${dc.customerName}` : 'Dispatched via Delivery Challan'
      });
    });
  });

  // 4. Add committed Sales Invoices from crmStore.invoices (avoiding double deduction if DC already deducted)
  (invoices || []).forEach((inv) => {
    if (inv.status === 'DRAFT' || !inv.stockDeducted) return;
    (inv.items || []).forEach((it) => {
      const match = (it.productId && String(it.productId).trim() === prodId) || (it.productCode && String(it.productCode).trim() === prodCode);
      if (!match) return;
      const qty = Number(it.quantity || 0);
      if (qty <= 0) return;
      const txnId = `TXN-INV-${inv.invoiceId}-${it.productCode || it.productId || prodCode}`;
      const unitRate = Number(it.rate || it.price || product.dealerPrice || product.cost || 0);
      const gstRate = Number(it.gst || it.gstRate || product.gst || 0);

      addTxn({
        id: txnId,
        productId: prodId,
        productCode: prodCode,
        productName: product.name,
        date: inv.createdAt || inv.invoiceDate || '2026-09-15T11:00:00.000Z',
        event: 'Sales Invoice',
        reference: inv.invoiceId,
        referenceType: 'INV',
        referenceId: inv.invoiceId,
        quantity: -qty,
        unitRate: unitRate,
        gstRate: gstRate,
        taxAmount: Number((qty * unitRate * (gstRate / 100)).toFixed(2)),
        totalValue: Number((qty * unitRate).toFixed(2)),
        customerId: inv.customerId || null,
        customerName: inv.customerName || 'Customer',
        partyName: inv.customerName || 'Customer',
        serialNumbers: Array.isArray(it.serialNumbers) ? it.serialNumbers : [],
        remarks: inv.customerName ? `Billed to ${inv.customerName}` : 'Issued Sales Invoice'
      });
    });
  });

  // 5. Add Purchase Order events (Procurement intent, QTY = 0, never changes physical stock!)
  (purchaseOrders || []).forEach((po) => {
    if (po.status === 'CANCELLED') return;
    (po.items || []).forEach((it) => {
      const match = (it.productId && String(it.productId).trim() === prodId) || (it.productCode && String(it.productCode).trim() === prodCode);
      if (!match) return;
      const ordQty = Number(it.orderedQty || 0);
      if (ordQty <= 0) return;
      const txnId = `TXN-PO-${po.id}-${it.productCode || it.productId || prodCode}`;
      const rate = Number(it.rate || 0);
      const gstRate = Number(it.gst || it.gstRate || product.gst || 0);
      const supplierName = po.supplierName || po.supplierSnapshot?.companyName || 'Supplier';

      addTxn({
        id: txnId,
        productId: prodId,
        productCode: prodCode,
        productName: product.name,
        date: po.orderDate || po.createdAt || '2026-09-17T10:00:00.000Z',
        event: 'Purchase Order',
        reference: po.id,
        referenceType: 'PO',
        referenceId: po.id,
        quantity: 0, // CRITICAL: PO is procurement intention, does NOT alter physical stock!
        orderedQty: ordQty,
        receivedQty: Number(it.receivedQty || 0),
        pendingQty: Math.max(0, ordQty - Number(it.receivedQty || 0)),
        status: po.status || 'SENT',
        unitRate: rate,
        gstRate: gstRate,
        taxAmount: Number(it.tax || (ordQty * rate * (gstRate / 100)).toFixed(2)),
        totalValue: Number(it.total || (ordQty * rate).toFixed(2)),
        supplierId: po.supplierId || po.supplierSnapshot?.id || null,
        supplierName: supplierName,
        partyName: supplierName,
        customerName: null,
        serialNumbers: [],
        remarks: `Ordered: ${ordQty} ${product.unit || 'units'} from ${supplierName} at ₹${rate.toLocaleString('en-IN')}/unit (Status: ${po.status || 'SENT'})`
      });
    });
  });

  // 6. Ensure initial "Product Added" event exists
  const allTxns = Array.from(historyMap.values());
  const hasProductAdded = allTxns.some((t) => t.event === 'Product Added');
  
  if (!hasProductAdded) {
    // Physical net movement only considers movements that changed physical stock (exclude POs)
    const netPhysicalMovement = allTxns
      .filter((t) => t.event !== 'Purchase Order')
      .reduce((sum, h) => sum + (Number(h.quantity) || 0), 0);
    const openingStock = Math.max(0, currentStock - netPhysicalMovement);
    const initialCost = Number(product.cost || 0);
    const initialGst = Number(product.gst || 0);
    const initialDate = product.createdAt || '2026-09-15T09:00:00.000Z';

    const initTxn = {
      id: `TXN-INIT-${prodId}`,
      productId: prodId,
      productCode: prodCode,
      productName: product.name,
      date: initialDate,
      event: 'Product Added',
      reference: prodCode,
      referenceType: 'PROD',
      referenceId: prodCode,
      quantity: openingStock,
      currentStock: currentStock,
      unitRate: initialCost,
      gstRate: initialGst,
      taxAmount: Number((openingStock * initialCost * (initialGst / 100)).toFixed(2)),
      totalValue: Number((openingStock * initialCost).toFixed(2)),
      partyName: 'Catalogue Entry',
      supplierName: null,
      customerName: null,
      serialNumbers: [],
      remarks: 'Initial catalogue stock recorded'
    };

    historyMap.set(initTxn.id, initTxn);
  }

  // Convert to array and sort chronologically (earliest to latest)
  const sorted = Array.from(historyMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));

  // Ensure currentStock on all rows is strictly live product.stock, and serialNumbers reflect serialization state
  const isSerialized = Boolean(product.serialized);
  const result = sorted.map((item) => {
    const signedQty = Number(item.quantity || 0);
    const stockAfter = item.stockAfter !== undefined && item.stockAfter !== null ? Number(item.stockAfter) : currentStock;
    const stockBefore = item.stockBefore !== undefined && item.stockBefore !== null ? Number(item.stockBefore) : (stockAfter - signedQty);
    let type = item.type;
    if (!type) {
      if (item.event === 'Product Added' || item.event === 'Stock Added' || item.event === 'Goods Receipt') type = 'STOCK IN';
      else if (item.event === 'Delivery Challan' || item.event === 'Sales Invoice') type = 'STOCK OUT';
      else if (item.event === 'Return DC') type = 'RETURN';
      else if (item.event === 'Stock Adjustment') type = 'ADJUSTMENT';
      else if (item.event === 'Purchase Order') type = 'PURCHASE ORDER';
      else type = signedQty >= 0 ? 'STOCK IN' : 'STOCK OUT';
    }
    return {
      ...item,
      type,
      stockBefore,
      stockAfter,
      currentStock: currentStock,
      serialNumbers: isSerialized ? (Array.isArray(item.serialNumbers) ? item.serialNumbers : []) : []
    };
  });

  // Persist any non-ephemeral physical transactions into data.inventoryTransactions
  if (!Array.isArray(data.inventoryTransactions)) data.inventoryTransactions = [];
  result.forEach((item) => {
    if (item.event !== 'Purchase Order') {
      const idx = data.inventoryTransactions.findIndex((t) => t.id === item.id);
      if (idx >= 0) {
        data.inventoryTransactions[idx] = { ...data.inventoryTransactions[idx], ...item };
      } else {
        data.inventoryTransactions.push(item);
      }
    }
  });

  return result;
}

function calculateReservedStockMap() {
  const reservedMap = new Map();
  // Scan confirmed orders where stock has not yet been physically deducted
  (orders || []).forEach((ord) => {
    if (
      ord.status === 'CANCELLED' ||
      ord.status === 'REJECTED' ||
      ord.status === 'COMPLETED' ||
      ord.status === 'DELIVERED' ||
      ord.status === 'CLOSED' ||
      ord.stockDeducted === true
    ) return;
    const items = Array.isArray(ord.lineItems) ? ord.lineItems : (Array.isArray(ord.items) ? ord.items : []);
    items.forEach((it) => {
      if (typeof it === 'object' && it !== null) {
        const pId = it.productId || it.productCode || it.code || it.id;
        const qty = Number(it.quantity || it.qty || 0);
        if (pId && qty > 0) {
          // Check how many units were already dispatched via DCs for this order and product
          const orderDcs = (deliveryChallans || []).filter(
            (d) => d.orderId === ord.orderId && d.status !== 'DRAFT' && d.stockDeducted === true
          );
          const alreadyDeductedQty = orderDcs.reduce((sum, d) => {
            const match = (d.items || []).find(
              (m) => (m.productId && String(m.productId).trim() === String(pId).trim()) || 
                     (m.productCode && String(m.productCode).trim() === String(pId).trim())
            );
            return sum + (match ? Number(match.quantity || 0) : 0);
          }, 0);

          const unconsumedQty = Math.max(0, qty - alreadyDeductedQty);
          if (unconsumedQty > 0) {
            const key = String(pId).trim().toLowerCase();
            reservedMap.set(key, (reservedMap.get(key) || 0) + unconsumedQty);
          }
        }
      }
    });
  });

  // Also reserve quantities currently in transit across active Dispatched DCs (before Deliver is clicked)
  (deliveryChallans || []).forEach((d) => {
    if (d.status === 'DRAFT' || d.status === 'DELIVERED' || d.status === 'CANCELLED' || d.status === 'RETURNED' || d.stockDeducted === true) return;
    (d.items || []).forEach((it) => {
      const pId = it.productId || it.productCode;
      const qty = Number(it.quantity || 0);
      if (pId && qty > 0) {
        const key = String(pId).trim().toLowerCase();
        reservedMap.set(key, (reservedMap.get(key) || 0) + qty);
      }
    });
  });

  return reservedMap;
}

function formatCanonicalMovement(t, products = []) {
  if (!t) return null;
  const qty = Number(t.quantity || 0);
  let type = t.type;
  if (!type) {
    const evt = String(t.event || '').toLowerCase();
    if (evt.includes('receipt') || evt.includes('grn') || evt.includes('initial') || evt.includes('added') || evt.includes('stock in')) {
      type = 'STOCK IN';
    } else if (evt.includes('return')) {
      type = 'RETURN';
    } else if (evt.includes('challan') || evt.includes('invoice') || evt.includes('stock out') || evt.includes('dispatch')) {
      type = 'STOCK OUT';
    } else if (evt.includes('adjust')) {
      type = 'ADJUSTMENT';
    } else if (evt.includes('transfer')) {
      type = 'TRANSFER';
    } else {
      type = qty >= 0 ? 'STOCK IN' : 'STOCK OUT';
    }
  }

  // Ensure signed quantity for display
  let signedQty = qty;
  if (type === 'STOCK OUT' && signedQty > 0) {
    signedQty = -signedQty;
  } else if ((type === 'STOCK IN' || type === 'RETURN') && signedQty < 0) {
    signedQty = Math.abs(signedQty);
  }

  const dateStr = t.date || t.createdAt || '2026-09-15T09:00:00.000Z';
  const movementId = t.movementId || t.id || `MOV-${String(Math.random()).slice(2, 8)}`;
  const prodCode = t.productCode || t.sku || '—';
  let prodName = t.productName || t.name || '';
  if (!prodName && Array.isArray(products) && products.length > 0) {
    const prod = products.find((p) => (t.productId && String(p.id) === String(t.productId)) || (t.productCode && String(p.code) === String(t.productCode)) || (t.sku && String(p.code) === String(t.sku)));
    if (prod) {
      prodName = prod.name || prod.productName || '';
    }
  }
  if (!prodName) prodName = 'Product';
  const userStr = t.user || t.createdBy || t.performedBy || 'System';

  let unitRate = t.unitRate !== undefined && t.unitRate !== null ? Number(t.unitRate) : (t.rate !== undefined && t.rate !== null ? Number(t.rate) : (t.price !== undefined && t.price !== null ? Number(t.price) : (t.purchasePrice !== undefined && t.purchasePrice !== null ? Number(t.purchasePrice) : (t.cost !== undefined && t.cost !== null ? Number(t.cost) : null))));
  if ((unitRate === null || isNaN(unitRate)) && Array.isArray(products) && products.length > 0) {
    const prod = products.find((p) => (t.productId && String(p.id) === String(t.productId)) || (t.productCode && String(p.code) === String(t.productCode)) || (t.sku && String(p.code) === String(t.sku)));
    if (prod) {
      unitRate = Number(prod.cost || prod.dealerPrice || 0);
    }
  }
  const totalValue = t.totalValue !== undefined && t.totalValue !== null ? Number(t.totalValue) : (unitRate !== null && !isNaN(unitRate) ? Number((Math.abs(qty) * unitRate).toFixed(2)) : null);

  return {
    id: movementId,
    movementId: movementId,
    date: dateStr,
    createdAt: dateStr,
    productId: t.productId,
    sku: prodCode,
    productCode: prodCode,
    productName: prodName,
    type: type,
    quantity: signedQty,
    rawQuantity: Math.abs(qty),
    unit: (t.unit && t.unit !== 'Piece') ? t.unit : 'Nos',
    reference: t.reference || t.referenceId || '—',
    referenceId: t.referenceId || t.reference || '—',
    source: t.source || (type === 'STOCK IN' ? (t.supplierName || 'Inward / Supplier') : (type === 'STOCK OUT' ? 'Main Warehouse' : '—')),
    destination: t.destination || (type === 'STOCK OUT' ? (t.customerName || 'Dispatch / Customer') : (type === 'STOCK IN' ? 'Main Warehouse' : '—')),
    reason: t.reason || t.remarks || '—',
    notes: t.notes || t.remarks || '',
    remarks: t.remarks || t.notes || '',
    user: userStr,
    createdBy: userStr,
    stockBefore: t.stockBefore !== undefined && t.stockBefore !== null ? Number(t.stockBefore) : (t.stockAfter !== undefined && t.stockAfter !== null ? Number(t.stockAfter) - signedQty : null),
    stockAfter: t.stockAfter !== undefined && t.stockAfter !== null ? Number(t.stockAfter) : (t.currentStock !== undefined && t.currentStock !== null ? Number(t.currentStock) : null),
    unitRate: unitRate !== null && !isNaN(unitRate) ? unitRate : null,
    gstRate: t.gstRate !== undefined && t.gstRate !== null ? Number(t.gstRate) : null,
    totalValue: totalValue !== null && !isNaN(totalValue) ? totalValue : null,
    serialNumbers: Array.isArray(t.serialNumbers) ? t.serialNumbers : [],
    isVoided: Boolean(t.isVoided),
    voidedAt: t.voidedAt || null,
    voidedBy: t.voidedBy || null,
    voidReason: t.voidReason || null,
    isCorrected: Boolean(t.isCorrected),
    correctedAt: t.correctedAt || null,
    correctedBy: t.correctedBy || null,
    correctionReason: t.correctionReason || null,
    correctedMovementId: t.correctedMovementId || null,
    reversalMovementId: t.reversalMovementId || null,
    warehouseId: t.warehouseId || null,
    warehouseName: t.warehouseName || null,
    floor: t.floor || null,
    rack: t.rack || null,
    shelf: t.shelf || null,
    box: t.box || null,
    binLocation: t.binLocation || null,
    locationCode: t.locationCode || null,
    sourceLocationDetails: t.sourceLocationDetails || null,
    destLocationDetails: t.destLocationDetails || null
  };
}

function enriched(data) {
  const categoryMap = Object.fromEntries(data.categories.map((x) => [x.id, x.name]));
  const subMap = Object.fromEntries(data.subcategories.map((x) => [x.id, x.name]));
  const brandMap = Object.fromEntries(data.brands.map((x) => [x.id, x.name]));
  const productCountByCategory = {};
  const productCountBySubcategory = {};
  const productCountByBrand = {};

  for (const p of data.products) {
    productCountByCategory[p.categoryId] = (productCountByCategory[p.categoryId] || 0) + 1;
    if (p.subcategoryId) productCountBySubcategory[p.subcategoryId] = (productCountBySubcategory[p.subcategoryId] || 0) + 1;
    if (p.brandId) productCountByBrand[p.brandId] = (productCountByBrand[p.brandId] || 0) + 1;
  }

  const reservedMap = calculateReservedStockMap();

  let totalStockUnits = 0;
  let totalAvailableUnits = 0;
  let totalReservedUnits = 0;
  let lowStockCount = 0;
  let inventoryValue = 0;

  const products = data.products.map((x) => {
    const totalStock = Number(x.stock || 0);
    const cost = Number(x.cost || 0);
    const mrp = Number(x.mrp || 0);
    const grossProfit = mrp - cost;
    const grossMarginPct = mrp > 0 ? (grossProfit / mrp) * 100 : 0;
    const markupPct = cost > 0 ? (grossProfit / cost) * 100 : 0;

    const reserved = reservedMap.get(String(x.id).toLowerCase()) || reservedMap.get(String(x.code).toLowerCase()) || 0;
    const availableStock = Math.max(0, totalStock - reserved);
    const unavailableStock = reserved;
    const minimumStock = Number(x.alertQuantity || 0);
    const isLowStock = availableStock <= minimumStock;
    const status = availableStock <= 0 ? 'OUT OF STOCK' : (isLowStock ? 'LOW STOCK' : 'IN STOCK');

    totalStockUnits += totalStock;
    totalAvailableUnits += availableStock;
    totalReservedUnits += reserved;
    if (isLowStock) lowStockCount += 1;
    inventoryValue += cost * totalStock;

    const pTxns = (data.inventoryTransactions || []).filter(
      (t) => (t.productId && String(t.productId) === String(x.id)) ||
             (t.productCode && String(t.productCode) === String(x.code)) ||
             (t.sku && String(t.sku) === String(x.code))
    );
    pTxns.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
    const latestAddition = pTxns.find((t) => Number(t.quantity) > 0 && !t.isVoided);
    const recentlyAddedQty = latestAddition ? Number(latestAddition.quantity) : (Number(x.stock) || 0);

    // Highest Price Rule: Calculate highest recorded inward rate across all batches
    let highestInwardRate = Number(x.highestInwardRate || 0);
    pTxns.forEach((t) => {
      const isPositive = Number(t.quantity || 0) > 0;
      const rate = Number(t.unitRate || t.rate || t.price || t.purchasePrice || 0);
      if (isPositive && !t.isVoided && rate > 0) {
        if (rate > highestInwardRate) highestInwardRate = rate;
      }
    });
    const benchmarkCost = Math.max(cost, highestInwardRate);

    return {
      ...x,
      categoryName: categoryMap[x.categoryId] || '—',
      subcategoryName: x.subcategoryId ? (subMap[x.subcategoryId] || '—') : '—',
      brandName: brandMap[x.brandId] || '—',
      isIGSTApplicable: Boolean(x.isIGSTApplicable),
      totalStock,
      availableStock,
      reservedStock: reserved,
      unavailableStock,
      minimumStock,
      status,
      stockValue: cost * totalStock,
      lowStock: isLowStock,
      grossProfit,
      grossMarginPct,
      markupPct,
      recentlyAddedQty,
      recentlyAdded: recentlyAddedQty,
      latestAddedQty: recentlyAddedQty,
      highestInwardRate: highestInwardRate > 0 ? highestInwardRate : cost,
      benchmarkCost,
      history: buildProductTransactions(x, data)
    };
  });

  // Recent Stock Movements (latest 15 movements)
  const allMovements = (data.inventoryTransactions || []).map(formatCanonicalMovement).filter(Boolean);
  allMovements.sort((a, b) => new Date(b.date) - new Date(a.date));
  const recentMovements = allMovements.slice(0, 15);

  // Compute the 3 most recently updated products dynamically
  const productsWithTimestamps = products.map((p) => {
    let latestTime = 0;
    if (p.lastMovementAt) latestTime = Math.max(latestTime, new Date(p.lastMovementAt).getTime() || 0);
    if (p.updatedAt) latestTime = Math.max(latestTime, new Date(p.updatedAt).getTime() || 0);
    if (Array.isArray(p.history) && p.history.length > 0) {
      for (const h of p.history) {
        if (h.date) latestTime = Math.max(latestTime, new Date(h.date).getTime() || 0);
      }
    }
    if (p.createdAt) latestTime = Math.max(latestTime, new Date(p.createdAt).getTime() || 0);
    return { ...p, lastUpdatedTimestamp: latestTime };
  });

  const sortedByRecentUpdate = [...productsWithTimestamps].sort((a, b) => b.lastUpdatedTimestamp - a.lastUpdatedTimestamp);
  const recentInventoryProducts = sortedByRecentUpdate.slice(0, 3);

  // Low stock products list
  const lowStockProducts = products.filter((p) => p.availableStock <= p.minimumStock);

  const summary = {
    totalProducts: products.length,
    totalStock: totalStockUnits,
    availableStock: totalAvailableUnits,
    reservedStock: totalReservedUnits,
    lowStock: lowStockCount,
    lowStockCount: lowStockCount,
    inventoryValue: inventoryValue,
    healthy: products.length - lowStockCount,
    totalMovements: allMovements.length,
    recentInventoryProducts
  };

  return {
    categories: data.categories.map((x) => ({ ...x, productCount: productCountByCategory[x.id] || 0 })),
    subcategories: data.subcategories.map((x) => ({ ...x, categoryName: categoryMap[x.categoryId] || '—', productCount: productCountBySubcategory[x.id] || 0 })),
    brands: data.brands.map((x) => ({ ...x, productCount: productCountByBrand[x.id] || 0 })),
    products,
    summary,
    kpis: summary,
    recentMovements,
    recentInventoryProducts,
    lowStockProducts
  };
}

function getStocks(req, res) {
  if (!allowed(req, res, 'View')) return;
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const data = readData();
  const enrichedData = enriched(data);
  writeData(data); // persist any transactions recorded during buildProductTransactions
  return res.json({ success: true, data: enrichedData });
}

function getProductHistory(req, res) {
  if (!allowed(req, res, 'View')) return;
  const { id } = req.params;
  const cleanId = String(id || '').trim().toLowerCase();
  const data = readData();
  const product = (data.products || []).find((p) => 
    String(p.id || '').trim().toLowerCase() === cleanId || 
    String(p.code || '').trim().toLowerCase() === cleanId
  );
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }
  const history = buildProductTransactions(product, data);
  writeData(data);
  const enrichedProduct = enriched(data).products.find((p) => p.id === product.id) || product;
  return res.json({ success: true, data: history, product: enrichedProduct });
}

function getAllPriceHistory(req, res) {
  if (!allowed(req, res, 'View')) return;
  const data = readData();
  const { productId, type, search } = req.query;
  const products = data.products || [];

  let targetProducts = products;
  if (productId && String(productId).trim().toUpperCase() !== 'ALL') {
    const cleanId = String(productId).trim().toLowerCase();
    targetProducts = products.filter(
      (p) => String(p.id || '').trim().toLowerCase() === cleanId || String(p.code || '').trim().toLowerCase() === cleanId
    );
  }

  const allProcurements = [];
  targetProducts.forEach((prod) => {
    const txns = buildProductTransactions(prod, data);
    txns.forEach((t) => {
      const isProcurement =
        t.event === 'Goods Receipt' ||
        t.event === 'Purchase Order' ||
        t.event === 'Product Added' ||
        t.referenceType === 'GRN' ||
        t.referenceType === 'GOODS_RECEIPT' ||
        t.referenceType === 'PO' ||
        t.referenceType === 'PROD';
      const rate = Number(t.unitRate || 0);
      if (isProcurement && rate > 0) {
        allProcurements.push({
          ...t,
          productId: prod.id,
          productCode: prod.code,
          productName: prod.name,
          categoryName: prod.categoryName,
          brandName: prod.brandName,
          unit: prod.unit || 'Nos'
        });
      }
    });
  });

  writeData(data);

  // Sort newest first
  allProcurements.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const enrichedProducts = (enriched(data).products || []).map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    cost: p.cost,
    stock: p.stock,
    unit: p.unit,
    brandName: p.brandName,
    categoryName: p.categoryName
  }));

  const singleProduct = targetProducts.length === 1
    ? (enrichedProducts.find((p) => p.id === targetProducts[0].id) || targetProducts[0])
    : null;

  return res.json({
    success: true,
    data: allProcurements,
    products: enrichedProducts,
    product: singleProduct,
    total: allProcurements.length
  });
}
function getAllowedProductUnits() {
  try {
    const accessControlPath = path.join(__dirname, '..', 'data', 'access-control.json');
    if (fs.existsSync(accessControlPath)) {
      const parsed = JSON.parse(fs.readFileSync(accessControlPath, 'utf8'));
      const units = parsed?.companySettings?.productUnits;
      if (Array.isArray(units) && units.length > 0) {
        return new Set(units.map(u => (typeof u === 'string' ? u : u.name || u.id)).filter(Boolean).concat(['Nos', 'Box', 'Set', 'Meter', 'Roll']));
      }
    }
  } catch (e) {
    // fallback
  }
  return new Set(['Nos', 'Box', 'Set', 'Meter', 'Roll']);
}

function createEntity(req, res, type) {
  if (!allowed(req, res, 'Create')) return;
  const data = readData(); const body = req.body || {};
  let createdRecord = null;
  if (type === 'categories' || type === 'brands') {
    const name = String(body.name || '').trim(); if (!name) return res.status(400).json({ success: false, message: 'Name is required.' });
    if (data[type].some((x) => x.name.toLowerCase() === name.toLowerCase())) return res.status(409).json({ success: false, message: 'An item with this name already exists.' });
    createdRecord = { id: nextId(type === 'categories' ? 'CAT' : 'BR', data[type]), name, description: String(body.description || '').trim() };
    data[type].push(createdRecord);
  } else if (type === 'subcategories') {
    const name = String(body.name || '').trim(); const categoryId = String(body.categoryId || '').trim();
    if (!name || !categoryId) return res.status(400).json({ success: false, message: 'Subcategory name and category are required.' });
    if (!data.categories.some((x) => x.id === categoryId)) return res.status(400).json({ success: false, message: 'Selected category does not exist.' });
    createdRecord = { id: nextId('SUBCAT', data.subcategories), name, categoryId, description: String(body.description || '').trim() };
    data.subcategories.push(createdRecord);
  } else {
    const required = ['name', 'hsnSac', 'categoryId', 'subcategoryId', 'cost', 'dealerPercentage', 'mrpPercentage', 'gst'];
    for (const key of required) if (String(body[key] ?? '').trim() === '') return res.status(400).json({ success: false, message: `${key} is required.` });
    const hsnSac = String(body.hsnSac || '').trim();
    if (!/^[A-Za-z0-9]{1,8}$/.test(hsnSac)) return res.status(400).json({ success: false, message: 'HSN / SAC Code is required and must contain only letters/numbers with a maximum of 8 characters.' });
    if (!data.categories.some((x) => x.id === body.categoryId)) return res.status(400).json({ success: false, message: 'Selected category does not exist.' });
    if (!data.subcategories.some((x) => x.id === body.subcategoryId && x.categoryId === body.categoryId)) return res.status(400).json({ success: false, message: 'Selected subcategory does not belong to the category.' });
    if (body.brandId && !data.brands.some((x) => x.id === body.brandId)) return res.status(400).json({ success: false, message: 'Selected brand does not exist.' });

    let code = normalizeProductCode(body.code);
    if (!code) {
      try {
        code = sequenceService.getNextId('stocks');
      } catch {
        code = getNextProductCode(data.products);
      }
    } else {
      if (isDuplicateProductCode(data.products, code)) {
        return res.status(409).json({ success: false, message: `Product code ${code} is already in use.` });
      }
    }

    const cost = Number(body.cost);
    const dealerPercentage = Number(body.dealerPercentage);
    const mrpPercentage = Number(body.mrpPercentage);
    const dealerPrice = Number((cost * (1 + dealerPercentage / 100)).toFixed(2));
    const mrp = Number((cost * (1 + mrpPercentage / 100)).toFixed(2));
    const gst = Number(body.gst);
    const rawUnit = String(body.unit || '').trim();
    const unit = (!rawUnit || rawUnit === 'Piece' || rawUnit === 'piece') ? 'Nos' : rawUnit;
    const allowedUnits = getAllowedProductUnits();
    if (!allowedUnits.has(unit) && (!unit || unit.length > 50)) return res.status(400).json({ success: false, message: 'Please provide a valid product unit.' });
    let openingStock = Number(body.stock || 0);
    const alertQuantity = Number(body.alertQuantity || 0);
    const createdAt = new Date().toISOString();
    const isCable = isCableProduct(
      { categoryId: body.categoryId, subcategoryId: body.subcategoryId, name: body.name, unit },
      data.categories,
      data.subcategories
    );
    const isSerialized = isCable ? false : (body.serialized !== undefined ? Boolean(body.serialized) : true);
    let initialSerials = [];
    if (isSerialized) {
      const providedSerials = Array.isArray(body.serialNumbers)
        ? body.serialNumbers.map((s) => String(s).trim()).filter(Boolean)
        : [];
      if (providedSerials.length > 0) {
        initialSerials = providedSerials;
        if (openingStock !== providedSerials.length) {
          openingStock = providedSerials.length;
        }
      } else if (openingStock > 0) {
        initialSerials = generateComputerSerialNumbers({ code, serialNumbers: [] }, openingStock, data);
      }
    }

    let whLoc = body.warehouseLocation || null;
    if (!whLoc) {
      const defBox = getDefaultBoxForProduct({ code, name: body.name, categoryId: body.categoryId });
      whLoc = {
        warehouseId: body.warehouseId || 'WH-001',
        warehouseName: body.warehouseName || 'Main Central Hub',
        floor: defBox.floorName,
        rack: defBox.rackName,
        shelf: defBox.shelfName,
        box: defBox.boxName,
        boxCode: defBox.boxCode,
        locationCode: defBox.locationCode,
        binLocation: `Main Central Hub › ${defBox.floorName} › ${defBox.rackName} › ${defBox.shelfName} › ${defBox.boxName}`
      };
    } else {
      whLoc = {
        warehouseId: whLoc.warehouseId || body.warehouseId || 'WH-001',
        warehouseName: whLoc.warehouseName || body.warehouseName || 'Main Central Hub',
        floor: whLoc.floorName || whLoc.floor || 'Floor 1 (Ground Floor)',
        rack: whLoc.rackName || whLoc.rack || 'Rack A (CCTV & Surveillance)',
        shelf: whLoc.shelfName || whLoc.shelf || 'Shelf 1 (Bottom Tier)',
        box: whLoc.boxName || whLoc.box || 'Box A1-01 (Bullet Cameras)',
        boxCode: whLoc.boxCode || 'BX-01',
        locationCode: whLoc.locationCode || `${whLoc.warehouseId || 'WH-001'}-${whLoc.boxCode || 'BX-01'}`,
        binLocation: whLoc.binLocation || `${whLoc.warehouseName || 'Main Central Hub'} › ${whLoc.floor || 'Floor 1'} › ${whLoc.rack || 'Rack A'} › ${whLoc.box || 'Box 01'}`
      };
    }

    const newProd = {
      id: nextId('PRD', data.products),
      code,
      name: String(body.name).trim(),
      description: String(body.description || '').trim(),
      hsnSac,
      productDetails: String(body.productDetails || '').trim(),
      productLink: String(body.productLink || '').trim(),
      categoryId: body.categoryId,
      subcategoryId: body.subcategoryId,
      brandId: body.brandId || null,
      unit,
      size: String(body.size || '').trim(),
      cost,
      dealerPercentage,
      dealerPrice,
      mrpPercentage,
      mrp,
      stock: openingStock,
      alertQuantity,
      gst,
      isIGSTApplicable: Boolean(body.isIGSTApplicable),
      serialized: isSerialized,
      serialNumbers: initialSerials,
      serialMetadata: {},
      warehouseLocation: whLoc,
      createdAt
    };

    if (isSerialized && initialSerials.length > 0) {
      initialSerials.forEach((sn) => {
        newProd.serialMetadata[sn] = {
          serialNumber: sn,
          productId: newProd.id,
          productCode: newProd.code,
          productName: newProd.name,
          category: body.categoryId,
          brand: body.brandId || null,
          status: 'IN_STOCK',
          inwardDate: createdAt,
          inwardCost: cost,
          warehouse: whLoc?.warehouseName || 'Main Central Hub',
          location: whLoc?.locationCode || null,
          createdAt
        };
      });
    }

    data.products.push(newProd);

    if (!Array.isArray(data.inventoryTransactions)) data.inventoryTransactions = [];
    data.inventoryTransactions.push({
      id: `TXN-INIT-${newProd.id}`,
      productId: newProd.id,
      productCode: newProd.code,
      productName: newProd.name,
      date: createdAt,
      event: 'Product Added',
      type: 'STOCK IN',
      reference: newProd.code,
      referenceType: 'PROD',
      referenceId: newProd.code,
      quantity: openingStock,
      stockBefore: 0,
      stockAfter: openingStock,
      currentStock: openingStock,
      unitRate: cost,
      gstRate: gst,
      taxAmount: Number((openingStock * cost * (gst / 100)).toFixed(2)),
      totalValue: Number((openingStock * cost).toFixed(2)),
      partyName: 'Catalogue Entry',
      serialNumbers: isSerialized ? initialSerials : [],
      warehouseId: whLoc?.warehouseId || 'WH-001',
      warehouseName: whLoc?.warehouseName || 'Main Central Hub',
      locationCode: whLoc?.locationCode || null,
      binLocation: whLoc?.binLocation || null,
      remarks: openingStock > 0 ? `Initial catalogue stock allocated to ${whLoc?.warehouseName} (${whLoc?.locationCode || 'Bin'})` : 'Initial catalogue stock recorded',
      createdAt
    });
    createdRecord = newProd;
  }
  writeData(data); return res.status(201).json({ success: true, data: enriched(data), product: createdRecord, item: createdRecord });
}
function updateEntity(req, res, type) {
  if (!allowed(req, res, 'Edit')) return;
  const data = readData(); const index = data[type].findIndex((x) => x.id === req.params.id); if (index < 0) return res.status(404).json({ success: false, message: 'Record not found.' });
  const body = req.body || {};
  if (type === 'categories' || type === 'brands') data[type][index] = { ...data[type][index], name: String(body.name || data[type][index].name).trim(), description: String((body.description ?? data[type][index].description) || '').trim() };
  else if (type === 'subcategories') { const categoryId = body.categoryId || data[type][index].categoryId; if (!data.categories.some((x) => x.id === categoryId)) return res.status(400).json({ success: false, message: 'Selected category does not exist.' }); data[type][index] = { ...data[type][index], name: String(body.name || data[type][index].name).trim(), categoryId, description: String((body.description ?? data[type][index].description) || '').trim() }; }
  else {
    const current = data[type][index];
    const categoryId = body.categoryId ?? current.categoryId;
    const subcategoryId = body.subcategoryId ?? current.subcategoryId ?? null;
    const brandId = body.brandId ?? current.brandId ?? null;

    if (!data.categories.some((x) => x.id === categoryId)) return res.status(400).json({ success: false, message: 'Selected category does not exist.' });
    if (!subcategoryId || !data.subcategories.some((x) => x.id === subcategoryId && x.categoryId === categoryId)) return res.status(400).json({ success: false, message: 'Selected subcategory does not belong to the category.' });
    if (brandId && !data.brands.some((x) => x.id === brandId)) return res.status(400).json({ success: false, message: 'Selected brand does not exist.' });

    if (body.code && normalizeProductCode(body.code) !== normalizeProductCode(current.code)) {
      return res.status(400).json({ success: false, message: 'Product code is immutable and cannot be modified.' });
    }
    const nextCode = normalizeProductCode(current.code);
    const nextName = String(body.name ?? current.name).trim();
    const hsnSac = String((body.hsnSac ?? current.hsnSac) || '').trim();
    if (!nextCode) return res.status(400).json({ success: false, message: 'Product code is required.' });
    if (!nextName) return res.status(400).json({ success: false, message: 'Product name is required.' });
    if (!/^[A-Za-z0-9]{1,8}$/.test(hsnSac)) return res.status(400).json({ success: false, message: 'HSN / SAC Code is required and must contain only letters/numbers with a maximum of 8 characters.' });

    const cost = Number(body.cost ?? current.cost);
    const dealerPercentage = Number(body.dealerPercentage ?? current.dealerPercentage ?? 0);
    const mrpPercentage = Number(body.mrpPercentage ?? current.mrpPercentage ?? 0);
    const hasDealerPercentage = Object.prototype.hasOwnProperty.call(body, 'dealerPercentage');
    const hasMrpPercentage = Object.prototype.hasOwnProperty.call(body, 'mrpPercentage');
    const dealerPrice = hasDealerPercentage ? Number((cost * (1 + dealerPercentage / 100)).toFixed(2)) : Number(body.dealerPrice ?? current.dealerPrice);
    const mrp = hasMrpPercentage ? Number((cost * (1 + mrpPercentage / 100)).toFixed(2)) : Number(body.mrp ?? current.mrp);
    const gst = Number(body.gst ?? current.gst ?? 0);
    const rawUnit = String(body.unit ?? current.unit ?? '').trim();
    const unit = (!rawUnit || rawUnit === 'Piece' || rawUnit === 'piece') ? 'Nos' : rawUnit;
    let nextStock = Number(body.stock ?? current.stock ?? 0);
    const nextAlertQuantity = Number(body.alertQuantity ?? current.alertQuantity ?? 0);
    const allowedUnits = getAllowedProductUnits();
    if (!allowedUnits.has(unit) && (!unit || unit.length > 50)) return res.status(400).json({ success: false, message: 'Please provide a valid product unit.' });
    if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(dealerPercentage) || dealerPercentage < 0 || !Number.isFinite(mrpPercentage) || mrpPercentage < dealerPercentage || !Number.isFinite(gst) || gst < 0 || gst > 100 || !Number.isInteger(nextStock) || nextStock < 0 || !Number.isInteger(nextAlertQuantity) || nextAlertQuantity < 0) return res.status(400).json({ success: false, message: 'Please provide valid pricing, GST, stock, and markup values. MRP markup must be at least Dealer markup.' });

    const isCable = isCableProduct(
      { categoryId, subcategoryId, name: nextName, unit },
      data.categories,
      data.subcategories
    );
    const isSerialized = isCable ? false : (body.serialized !== undefined ? Boolean(body.serialized) : Boolean(current.serialized));
    let updatedSerials = [];
    if (isSerialized) {
      const providedSerials = Array.isArray(body.serialNumbers)
        ? body.serialNumbers.map((s) => String(s).trim()).filter(Boolean)
        : [];
      if (providedSerials.length > 0) {
        updatedSerials = providedSerials;
        if (nextStock !== providedSerials.length) {
          nextStock = providedSerials.length;
        }
      } else if (nextStock > 0) {
        const existing = Array.isArray(current.serialNumbers) ? current.serialNumbers : [];
        if (existing.length < nextStock) {
          const needed = nextStock - existing.length;
          const additional = generateComputerSerialNumbers(current, needed, data, existing);
          updatedSerials = [...existing, ...additional];
        } else {
          updatedSerials = existing.slice(0, nextStock);
        }
      } else {
        updatedSerials = [];
      }
    } else {
      updatedSerials = [];
    }

    let nextWhLoc = body.warehouseLocation ? {
      warehouseId: body.warehouseLocation.warehouseId || current.warehouseLocation?.warehouseId || 'WH-001',
      warehouseName: body.warehouseLocation.warehouseName || current.warehouseLocation?.warehouseName || 'Main Central Hub',
      floor: body.warehouseLocation.floorName || body.warehouseLocation.floor || current.warehouseLocation?.floor || 'Floor 1 (Ground Floor)',
      rack: body.warehouseLocation.rackName || body.warehouseLocation.rack || current.warehouseLocation?.rack || 'Rack A (CCTV & Surveillance)',
      shelf: body.warehouseLocation.shelfName || body.warehouseLocation.shelf || current.warehouseLocation?.shelf || 'Shelf 1 (Bottom Tier)',
      box: body.warehouseLocation.boxName || body.warehouseLocation.box || current.warehouseLocation?.box || 'Box A1-01 (Bullet Cameras)',
      boxCode: body.warehouseLocation.boxCode || current.warehouseLocation?.boxCode || 'BX-01',
      locationCode: body.warehouseLocation.locationCode || current.warehouseLocation?.locationCode || null,
      binLocation: body.warehouseLocation.binLocation || current.warehouseLocation?.binLocation || null
    } : (current.warehouseLocation || null);

    const prevStock = Number(current.stock || 0);
    if (Number.isFinite(nextStock) && nextStock !== prevStock) {
      const delta = nextStock - prevStock;
      const now = new Date().toISOString();
      if (!Array.isArray(data.inventoryTransactions)) data.inventoryTransactions = [];
      data.inventoryTransactions.push({
        id: `TXN-ADJ-${current.id}-${Date.now()}`,
        productId: current.id,
        productCode: nextCode,
        productName: nextName,
        date: now,
        createdAt: now,
        event: 'ADJUSTMENT',
        type: 'ADJUSTMENT',
        reference: nextCode,
        referenceType: 'MANUAL_ADJUSTMENT',
        referenceId: nextCode,
        quantity: delta,
        stockBefore: prevStock,
        stockAfter: nextStock,
        currentStock: nextStock,
        unitRate: cost,
        gstRate: gst,
        taxAmount: Number((Math.abs(delta) * cost * (gst / 100)).toFixed(2)),
        totalValue: Number((Math.abs(delta) * cost).toFixed(2)),
        partyName: 'Product Master Adjustment',
        warehouseId: nextWhLoc?.warehouseId || 'WH-001',
        warehouseName: nextWhLoc?.warehouseName || 'Main Central Hub',
        locationCode: nextWhLoc?.locationCode || null,
        binLocation: nextWhLoc?.binLocation || null,
        remarks: 'Manual stock adjustment in Product Master',
        user: req.headers['x-user-name'] || req.headers['x-user-id'] || 'Admin'
      });
    }

    const meta = current.serialMetadata && typeof current.serialMetadata === 'object' ? current.serialMetadata : {};
    if (isSerialized && updatedSerials.length > 0) {
      const nowStr = new Date().toISOString();
      updatedSerials.forEach((sn) => {
        if (!meta[sn]) {
          meta[sn] = {
            serialNumber: sn,
            productId: current.id,
            productCode: nextCode,
            productName: nextName,
            category: categoryId,
            brand: brandId,
            status: 'IN_STOCK',
            inwardDate: nowStr,
            inwardCost: cost,
            warehouse: nextWhLoc?.warehouseName || 'Main Central Hub',
            location: nextWhLoc?.locationCode || null,
            createdAt: nowStr
          };
        } else if (nextWhLoc) {
          meta[sn].warehouse = nextWhLoc.warehouseName || meta[sn].warehouse;
          meta[sn].location = nextWhLoc.locationCode || meta[sn].location;
        }
      });
    }

    data[type][index] = {
      ...current,
      ...body,
      code: nextCode,
      name: nextName,
      description: String((body.description ?? current.description) || '').trim(),
      hsnSac,
      productDetails: String((body.productDetails ?? current.productDetails) || '').trim(),
      productLink: String((body.productLink ?? current.productLink) || '').trim(),
      categoryId,
      subcategoryId,
      brandId,
      unit,
      size: String(body.size ?? current.size ?? '').trim(),
      cost,
      dealerPercentage,
      dealerPrice,
      mrpPercentage,
      mrp,
      stock: nextStock,
      alertQuantity: nextAlertQuantity,
      gst,
      isIGSTApplicable: body.isIGSTApplicable !== undefined ? Boolean(body.isIGSTApplicable) : Boolean(current.isIGSTApplicable),
      serialized: isSerialized,
      serialNumbers: updatedSerials,
      serialMetadata: meta,
      warehouseLocation: nextWhLoc
    };
  }
  const updatedProd = data[type][index];
  writeData(data); return res.json({ success: true, data: enriched(data), product: updatedProd });
}
function deleteEntity(req, res, type) {
  if (!allowed(req, res, 'Delete')) return;
  const data = readData(); const id = req.params.id;
  if (type === 'categories') {
    if (data.subcategories.some((x) => x.categoryId === id) || data.products.some((x) => x.categoryId === id)) return res.status(409).json({ success: false, message: 'Cannot delete this category while it is used by subcategories or products.' });
  }
  if (type === 'brands' && data.products.some((x) => x.brandId === id)) return res.status(409).json({ success: false, message: 'Cannot delete this brand while products are using it.' });
  if (type === 'subcategories' && data.products.some((x) => x.subcategoryId === id)) return res.status(409).json({ success: false, message: 'Cannot delete this subcategory while products are using it.' });

  if (type === 'products') {
    const product = (data.products || []).find((p) => String(p.id) === String(id) || String(p.code) === String(id));
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const prodId = String(product.id || '').trim();
    const prodCode = String(product.code || '').trim();
    const stockMovements = (data.inventoryTransactions || []).map(formatCanonicalMovement).filter(Boolean);
    const hasMovements = stockMovements.some(
      (m) => (m.productId && String(m.productId).trim() === prodId) || (m.sku && String(m.sku).trim() === prodCode)
    );
    const hasStoredTxns = (data.inventoryTransactions || []).some(
      (t) => (t.productId && String(t.productId).trim() === prodId) || (t.productCode && String(t.productCode).trim() === prodCode)
    );
    const hasOrderRef = (orders || []).some((o) => {
      const items = Array.isArray(o.lineItems) ? o.lineItems : (Array.isArray(o.items) ? o.items : []);
      return items.some((it) => String(it.productId) === prodId || String(it.productCode || it.code) === prodCode);
    });

    if (hasMovements || hasStoredTxns || hasOrderRef) {
      // History-Safe Rule: Archive/Deactivate to preserve full audit trail
      product.isArchived = true;
      product.isActive = false;
      product.status = 'INACTIVE';
      product.archivedAt = new Date().toISOString();
      writeData(data);
      return res.json({
        success: true,
        action: 'archived',
        message: `Product "${product.name}" has historical transactions. It has been deactivated/archived to preserve audit history.`,
        data: enriched(data)
      });
    }

    // No history exists → safe to delete physically
    data.products = data.products.filter((p) => String(p.id) !== String(id) && String(p.code) !== String(id));
    writeData(data);
    return res.json({
      success: true,
      action: 'deleted',
      message: `Product "${product.name}" had no transaction history and was permanently deleted.`,
      data: enriched(data)
    });
  }

  const next = data[type].filter((x) => x.id !== id); if (next.length === data[type].length) return res.status(404).json({ success: false, message: 'Record not found.' });
  data[type] = next; writeData(data); return res.json({ success: true, data: enriched(data) });
}
function createStockMovement(req, res) {
  if (!allowed(req, res, 'Create')) return;
  const data = readData();
  const body = req.body || {};

  const productId = String(body.productId || '').trim();
  const product = (data.products || []).find(
    (p) => String(p.id).toLowerCase() === productId.toLowerCase() || String(p.code).toLowerCase() === productId.toLowerCase()
  );
  if (!product) {
    return res.status(404).json({ success: false, message: 'Invalid product. Product not found in Product Master.' });
  }

  const rawType = String(body.type || body.movementType || '').trim().toUpperCase();
  const typeMap = {
    'STOCK_IN': 'STOCK IN',
    'STOCK IN': 'STOCK IN',
    'STOCK_OUT': 'STOCK OUT',
    'STOCK OUT': 'STOCK OUT',
    'RETURN': 'RETURN',
    'RETURNED': 'RETURN',
    'ADJUSTMENT': 'ADJUSTMENT',
    'ADJUSTED': 'ADJUSTMENT',
    'TRANSFER': 'TRANSFER'
  };
  const type = typeMap[rawType];
  if (!type) {
    return res.status(400).json({ success: false, message: 'Invalid movement type. Supported types: STOCK IN, STOCK OUT, RETURN, ADJUSTMENT, TRANSFER.' });
  }

  const rawQty = Number(body.quantity);
  if (isNaN(rawQty) || rawQty === 0) {
    return res.status(400).json({ success: false, message: 'Quantity must be a valid non-zero number.' });
  }

  // Calculate current authoritative reserved stock and available stock
  const reservedMap = calculateReservedStockMap();
  const reserved = reservedMap.get(String(product.id).toLowerCase()) || reservedMap.get(String(product.code).toLowerCase()) || 0;
  const currentTotalStock = Number(product.stock || 0);
  const currentAvailableStock = Math.max(0, currentTotalStock - reserved);

  // Type-specific validations
  if (type === 'STOCK IN' || type === 'RETURN') {
    if (rawQty <= 0) {
      return res.status(400).json({ success: false, message: `Quantity for ${type} must be a positive number.` });
    }
  }

  if (type === 'STOCK OUT') {
    const deductQty = Math.abs(rawQty);
    if (deductQty <= 0) {
      return res.status(400).json({ success: false, message: 'Stock out quantity must be greater than zero.' });
    }
    if (deductQty > currentAvailableStock) {
      return res.status(400).json({
        success: false,
        message: `Insufficient available stock for ${product.name}. Available: ${currentAvailableStock}, requested: ${deductQty}.`
      });
    }
  }

  const reason = String(body.reason || '').trim();
  if (type === 'ADJUSTMENT' && !reason) {
    return res.status(400).json({ success: false, message: 'Reason is mandatory for stock adjustments.' });
  }

  const source = String(body.source || '').trim();
  const destination = String(body.destination || '').trim();
  if (type === 'TRANSFER') {
    if (!source || !destination) {
      return res.status(400).json({ success: false, message: 'Source and Destination locations are both required for warehouse transfer.' });
    }
    if (source.toLowerCase() === destination.toLowerCase()) {
      return res.status(400).json({ success: false, message: 'Source and Destination locations cannot be identical.' });
    }
  }

  // Idempotency / Duplicate reference check
  const reference = String(body.reference || '').trim();
  if (reference && reference !== '—') {
    if (!Array.isArray(data.inventoryTransactions)) data.inventoryTransactions = [];
    const isDuplicate = data.inventoryTransactions.some((t) => {
      const matchRef = String(t.reference || t.referenceId || '').toLowerCase() === reference.toLowerCase();
      const matchProd = (t.productId && t.productId === product.id) || (t.productCode && t.productCode === product.code);
      const matchType = (t.type === type) || (t.event === type);
      return matchRef && matchProd && matchType;
    });
    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        message: `A stock movement with reference "${reference}" has already been recorded for this product.`
      });
    }
  }

  // Calculate stock balance change
  const stockBefore = currentTotalStock;
  let stockDelta = 0;
  let signedQty = 0;

  if (type === 'STOCK IN' || type === 'RETURN') {
    stockDelta = Math.abs(rawQty);
    signedQty = stockDelta;
  } else if (type === 'STOCK OUT') {
    stockDelta = -Math.abs(rawQty);
    signedQty = -Math.abs(rawQty);
  } else if (type === 'ADJUSTMENT') {
    stockDelta = rawQty;
    signedQty = rawQty;
  } else if (type === 'TRANSFER') {
    const transferQty = Math.abs(rawQty);
    if (body.isExternalDispatch) {
      if (transferQty > currentAvailableStock) {
        return res.status(400).json({ success: false, message: `Insufficient stock for transfer. Available: ${currentAvailableStock}, requested: ${transferQty}.` });
      }
      stockDelta = -transferQty;
      signedQty = -transferQty;
    } else {
      stockDelta = 0; // Internal relocation: total physical stock stays same, logged in audit
      signedQty = transferQty;
    }
  }

  const stockAfter = Math.max(0, stockBefore + stockDelta);
  product.stock = stockAfter;

  const isCable = isCableProduct(product, data.categories, data.subcategories);
  if (isCable) {
    product.serialized = false;
    product.serialNumbers = [];
  }

  // Maintain active serial numbers for serialized products
  let txnSerials = Array.isArray(body.serialNumbers) ? body.serialNumbers.map((s) => String(s).trim()).filter(Boolean) : [];
  if (product.serialized !== false && !isCable) {
    if (!Array.isArray(product.serialNumbers)) product.serialNumbers = [];
    const dispatchedSerials = getDispatchedSerialsSet();

    if (type === 'STOCK IN' || type === 'RETURN') {
      if (txnSerials.length > 0) {
        product.serialNumbers.push(...txnSerials);
      } else {
        const needed = Math.max(0, stockAfter - product.serialNumbers.length);
        if (needed > 0) {
          const generated = generateComputerSerialNumbers(product, needed, data);
          product.serialNumbers.push(...generated);
          txnSerials = generated;
        }
      }
    } else if (type === 'STOCK OUT') {
      if (txnSerials.length > 0) {
        const outSet = new Set(txnSerials.map((s) => s.toUpperCase()));
        product.serialNumbers = product.serialNumbers.filter((s) => !outSet.has(s.toUpperCase()));
      } else {
        txnSerials = product.serialNumbers.slice(-Math.abs(stockDelta));
        product.serialNumbers = product.serialNumbers.slice(0, stockAfter);
      }
    } else if (type === 'ADJUSTMENT') {
      if (product.serialNumbers.length > stockAfter) {
        product.serialNumbers = product.serialNumbers.slice(0, stockAfter);
      } else {
        const needed = Math.max(0, stockAfter - product.serialNumbers.length);
        if (needed > 0) {
          const generated = generateComputerSerialNumbers(product, needed, data);
          product.serialNumbers.push(...generated);
        }
      }
    }
  } else {
    txnSerials = [];
    product.serialNumbers = [];
  }

  const movementId = nextId('MOV', (data.inventoryTransactions || []).map((t) => ({ id: t.movementId || t.id })));
  const now = new Date().toISOString();
  const user = req.headers['x-user-name'] || req.headers['x-user-id'] || 'Admin';

  const warehouseId = body.warehouseId || null;
  const warehouseName = body.warehouseName || null;
  const floor = body.floor || null;
  const rack = body.rack || null;
  const shelf = body.shelf || null;
  const box = body.box || null;
  const locationCode = body.locationCode || null;
  const binLocation = body.binLocation || (warehouseName && floor && rack && shelf && box ? `${warehouseName} › ${floor} › ${rack} › ${shelf} › ${box}` : null);
  const sourceLocationDetails = body.sourceLocationDetails || null;
  const destLocationDetails = body.destLocationDetails || null;

  const newTxn = {
    id: movementId,
    movementId,
    productId: product.id,
    productCode: product.code,
    sku: product.code,
    productName: product.name,
    type,
    event: type,
    quantity: signedQty,
    unit: (product.unit && product.unit !== 'Piece') ? product.unit : ((body.unit && body.unit !== 'Piece') ? body.unit : 'Nos'),
    reference: reference || movementId,
    referenceId: reference || movementId,
    referenceType: 'MANUAL_MOVEMENT',
    source: source || (type === 'STOCK IN' ? 'Inward / Supplier' : 'Main Warehouse'),
    destination: destination || (type === 'STOCK OUT' ? 'Dispatch / Customer' : 'Main Warehouse'),
    reason: reason || (type === 'STOCK IN' ? 'Stock Inward' : (type === 'STOCK OUT' ? 'Stock Outward' : 'Internal Transfer')),
    notes: String(body.notes || '').trim(),
    remarks: reason || String(body.notes || '').trim() || `${type} recorded`,
    date: now,
    createdAt: now,
    user: String(user),
    createdBy: String(user),
    stockBefore,
    stockAfter,
    currentStock: stockAfter,
    unitRate: Number(product.cost || 0),
    gstRate: Number(product.gst || 0),
    totalValue: Number((Math.abs(signedQty) * Number(product.cost || 0)).toFixed(2)),
    serialNumbers: txnSerials,
    warehouseId,
    warehouseName,
    floor,
    rack,
    shelf,
    box,
    binLocation,
    locationCode,
    sourceLocationDetails,
    destLocationDetails
  };

  if (warehouseName || binLocation) {
    product.warehouseLocation = {
      warehouseId,
      warehouseName,
      floor,
      rack,
      shelf,
      box,
      binLocation: binLocation || `${warehouseName} › ${floor} › ${rack} › ${shelf} › ${box}`,
      locationCode,
      updatedAt: now
    };
  }

  if (!Array.isArray(data.inventoryTransactions)) data.inventoryTransactions = [];
  data.inventoryTransactions.push(newTxn);

  // Re-save data atomically
  writeData(data);

  const enrichedData = enriched(data);
  const updatedProd = enrichedData.products.find((p) => p.id === product.id);

  return res.status(201).json({
    success: true,
    message: `Stock movement ${movementId} recorded successfully.`,
    movement: formatCanonicalMovement(newTxn),
    product: updatedProd,
    kpis: enrichedData.summary
  });
}

function getStockMovements(req, res) {
  if (!allowed(req, res, 'View')) return;
  const data = readData();
  const { search, type, productId } = req.query;

  let txns = (data.inventoryTransactions || []).map((t) => formatCanonicalMovement(t, data.products || [])).filter(Boolean);

  if (productId) {
    const cleanPId = String(productId).trim().toLowerCase();
    const prod = (data.products || []).find((p) => String(p.id || '').toLowerCase() === cleanPId || String(p.code || '').toLowerCase() === cleanPId);
    const targetCodes = new Set([cleanPId]);
    if (prod) {
      if (prod.id) targetCodes.add(String(prod.id).toLowerCase());
      if (prod.code) targetCodes.add(String(prod.code).toLowerCase());
    }
    txns = txns.filter(
      (t) => targetCodes.has(String(t.productId || '').toLowerCase()) ||
             targetCodes.has(String(t.productCode || '').toLowerCase()) ||
             targetCodes.has(String(t.sku || '').toLowerCase())
    );
  }

  if (type && type !== 'ALL') {
    const cleanType = String(type).toUpperCase();
    txns = txns.filter(
      (t) => t.type === cleanType || (cleanType === 'RETURN' && t.type === 'RETURNED') || (cleanType === 'ADJUSTMENT' && t.type === 'ADJUSTED')
    );
  }

  if (search && String(search).trim()) {
    txns = filterRecordsBySearch(txns, search, [
      (t) => t.productName,
      (t) => t.sku,
      (t) => t.reference,
      (t) => t.movementId,
      (t) => t.user,
      (t) => t.reason,
      (t) => t.type,
      (t) => t.source,
      (t) => t.destination
    ]);
  }

  // Sort chronologically descending (newest first)
  txns.sort((a, b) => new Date(b.date) - new Date(a.date));

  return res.json({
    success: true,
    data: txns,
    total: txns.length
  });
}

function getMovementDetail(req, res) {
  if (!allowed(req, res, 'View')) return;
  const data = readData();
  const id = String(req.params.id || '').toLowerCase();
  const txn = (data.inventoryTransactions || []).find((t) => String(t.id || t.movementId).toLowerCase() === id);
  if (!txn) {
    return res.status(404).json({ success: false, message: 'Stock movement not found.' });
  }
  return res.json({ success: true, data: formatCanonicalMovement(txn, data.products || []) });
}

function voidStockMovement(req, res) {
  if (!allowed(req, res, 'Delete')) return;
  const data = readData();
  const id = String(req.params.id || '').trim().toLowerCase();

  if (!Array.isArray(data.inventoryTransactions)) data.inventoryTransactions = [];
  const txnIndex = data.inventoryTransactions.findIndex(
    (t) => String(t.movementId || t.id).toLowerCase() === id
  );
  if (txnIndex === -1) {
    return res.status(404).json({ success: false, message: 'Stock movement not found.' });
  }

  const txn = data.inventoryTransactions[txnIndex];
  if (txn.isVoided) {
    return res.status(400).json({ success: false, message: 'This movement has already been voided.' });
  }
  if (txn.event === 'VOID_REVERSAL' || txn.event === 'CORRECTION_REVERSAL') {
    return res.status(400).json({ success: false, message: 'Reversal movements cannot be voided.' });
  }

  const product = (data.products || []).find(
    (p) => (txn.productId && String(p.id) === String(txn.productId)) ||
           (txn.productCode && String(p.code) === String(txn.productCode)) ||
           (txn.sku && String(p.code) === String(txn.sku))
  );
  if (!product) {
    return res.status(404).json({ success: false, message: 'Associated product not found in Product Master.' });
  }

  const reason = String(req.body?.reason || req.query?.reason || '').trim();
  if (!reason) {
    return res.status(400).json({ success: false, message: 'Reason for voiding movement is required for audit trail.' });
  }

  const origQty = Number(txn.quantity || 0);
  const reversalDelta = -origQty;
  const currentTotalStock = Number(product.stock || 0);
  const newStock = currentTotalStock + reversalDelta;

  if (newStock < 0) {
    return res.status(400).json({
      success: false,
      message: `Cannot void movement: reversing this transaction would cause physical stock to fall below zero (current: ${currentTotalStock}, reversal: ${reversalDelta}).`
    });
  }

  const now = new Date().toISOString();
  const user = req.headers['x-user-name'] || req.headers['x-user-id'] || 'Admin';
  const reversalMovementId = nextId('MOV', (data.inventoryTransactions || []).map((t) => ({ id: t.movementId || t.id })));

  // Mark original movement as voided
  txn.isVoided = true;
  txn.voidedAt = now;
  txn.voidedBy = String(user);
  txn.voidReason = reason;
  txn.reversalMovementId = reversalMovementId;

  // Create compensating reversal movement
  const reversalTxn = {
    id: reversalMovementId,
    movementId: reversalMovementId,
    productId: product.id,
    productCode: product.code,
    sku: product.code,
    productName: product.name,
    type: 'ADJUSTMENT',
    event: 'VOID_REVERSAL',
    quantity: reversalDelta,
    unit: (product.unit && product.unit !== 'Piece') ? product.unit : ((txn.unit && txn.unit !== 'Piece') ? txn.unit : 'Nos'),
    reference: `VOID-${txn.movementId || txn.id}`,
    referenceId: `VOID-${txn.movementId || txn.id}`,
    referenceType: 'VOID_REVERSAL',
    source: 'Audit Reversal',
    destination: 'Inventory Adjustment',
    reason: `VOID: ${reason} (Reversing ${txn.movementId || txn.id})`,
    notes: `Reversal of movement ${txn.movementId || txn.id}. Original quantity: ${origQty}, Reversal: ${reversalDelta}. Reason: ${reason}`,
    remarks: `Reversal of movement ${txn.movementId || txn.id}`,
    date: now,
    createdAt: now,
    user: String(user),
    createdBy: String(user),
    stockBefore: currentTotalStock,
    stockAfter: newStock,
    currentStock: newStock,
    unitRate: Number(product.cost || 0),
    gstRate: Number(product.gst || 0),
    totalValue: Number((Math.abs(reversalDelta) * Number(product.cost || 0)).toFixed(2)),
    serialNumbers: []
  };

  // Update physical stock
  product.stock = newStock;
  data.inventoryTransactions.push(reversalTxn);

  writeData(data);

  const enrichedData = enriched(data);
  return res.json({
    success: true,
    message: `Movement ${txn.movementId || txn.id} voided safely. Reversal entry ${reversalMovementId} recorded.`,
    data: enrichedData,
    movement: formatCanonicalMovement(txn),
    reversalMovement: formatCanonicalMovement(reversalTxn)
  });
}

function correctStockMovement(req, res) {
  if (!allowed(req, res, 'Edit')) return;
  const data = readData();
  const id = String(req.params.id || '').trim().toLowerCase();
  const body = req.body || {};

  if (!Array.isArray(data.inventoryTransactions)) data.inventoryTransactions = [];
  const txnIndex = data.inventoryTransactions.findIndex(
    (t) => String(t.movementId || t.id).toLowerCase() === id
  );
  if (txnIndex === -1) {
    return res.status(404).json({ success: false, message: 'Stock movement not found.' });
  }

  const txn = data.inventoryTransactions[txnIndex];
  if (txn.isVoided) {
    return res.status(400).json({ success: false, message: 'Cannot edit a voided movement.' });
  }
  if (txn.isCorrected) {
    return res.status(400).json({ success: false, message: 'This movement has already undergone controlled correction.' });
  }
  if (txn.event === 'VOID_REVERSAL' || txn.event === 'CORRECTION_REVERSAL') {
    return res.status(400).json({ success: false, message: 'Audit reversal entries cannot be edited directly.' });
  }

  const product = (data.products || []).find(
    (p) => (txn.productId && String(p.id) === String(txn.productId)) ||
           (txn.productCode && String(p.code) === String(txn.productCode)) ||
           (txn.sku && String(p.code) === String(txn.sku))
  );
  if (!product) {
    return res.status(404).json({ success: false, message: 'Associated product not found in Product Master.' });
  }

  const reason = String(body.reason || '').trim();
  if (!reason) {
    return res.status(400).json({ success: false, message: 'Correction reason is mandatory for audit trail compliance.' });
  }

  const newQtyRaw = Number(body.quantity !== undefined ? body.quantity : Math.abs(txn.quantity || 0));
  if (isNaN(newQtyRaw) || newQtyRaw <= 0) {
    return res.status(400).json({ success: false, message: 'New quantity must be a positive number.' });
  }

  let correctedSignedQty = newQtyRaw;
  if (txn.type === 'STOCK OUT') {
    correctedSignedQty = -Math.abs(newQtyRaw);
  } else if (txn.type === 'ADJUSTMENT' && Number(txn.quantity) < 0) {
    correctedSignedQty = -Math.abs(newQtyRaw);
  }

  const origSignedQty = Number(txn.quantity || 0);
  const currentTotalStock = Number(product.stock || 0);
  const netDelta = correctedSignedQty - origSignedQty;
  const newProductStock = currentTotalStock + netDelta;

  if (newProductStock < 0) {
    return res.status(400).json({
      success: false,
      message: `Correction cannot be applied: resulting stock would be negative (${newProductStock}).`
    });
  }

  const now = new Date().toISOString();
  const user = req.headers['x-user-name'] || req.headers['x-user-id'] || 'Admin';
  const reversalId = nextId('MOV', (data.inventoryTransactions || []).map((t) => ({ id: t.movementId || t.id })));
  const correctedId = `MOV-${String(Number(reversalId.replace('MOV-', '')) + 1).padStart(3, '0')}`;

  // 1. Mark original movement as corrected
  txn.isCorrected = true;
  txn.correctedAt = now;
  txn.correctedBy = String(user);
  txn.correctionReason = reason;
  txn.reversalMovementId = reversalId;
  txn.correctedMovementId = correctedId;

  // 2. Compensating Reversal Entry
  const reversalTxn = {
    id: reversalId,
    movementId: reversalId,
    productId: product.id,
    productCode: product.code,
    sku: product.code,
    productName: product.name,
    type: 'ADJUSTMENT',
    event: 'CORRECTION_REVERSAL',
    quantity: -origSignedQty,
    unit: (product.unit && product.unit !== 'Piece') ? product.unit : ((txn.unit && txn.unit !== 'Piece') ? txn.unit : 'Nos'),
    reference: `REV-${txn.movementId || txn.id}`,
    referenceId: `REV-${txn.movementId || txn.id}`,
    referenceType: 'CORRECTION_REVERSAL',
    source: 'Audit Reversal',
    destination: 'Correction Buffer',
    reason: `Controlled Reversal for Correction of ${txn.movementId || txn.id}: ${reason}`,
    notes: `Compensating reversal of ${txn.movementId || txn.id} before applying corrected entry ${correctedId}.`,
    remarks: `Reversal for correction of ${txn.movementId || txn.id}`,
    date: now,
    createdAt: now,
    user: String(user),
    createdBy: String(user),
    stockBefore: currentTotalStock,
    stockAfter: currentTotalStock - origSignedQty,
    currentStock: currentTotalStock - origSignedQty,
    unitRate: Number(product.cost || 0),
    gstRate: Number(product.gst || 0),
    totalValue: Number((Math.abs(origSignedQty) * Number(product.cost || 0)).toFixed(2)),
    serialNumbers: []
  };

  // 3. Corrected Entry
  const correctedTxn = {
    id: correctedId,
    movementId: correctedId,
    productId: product.id,
    productCode: product.code,
    sku: product.code,
    productName: product.name,
    type: txn.type,
    event: 'CORRECTION_ENTRY',
    quantity: correctedSignedQty,
    unit: (product.unit && product.unit !== 'Piece') ? product.unit : ((txn.unit && txn.unit !== 'Piece') ? txn.unit : 'Nos'),
    reference: body.reference || txn.reference || correctedId,
    referenceId: body.reference || txn.reference || correctedId,
    referenceType: 'CORRECTION_ENTRY',
    source: body.source || txn.source,
    destination: body.destination || txn.destination,
    reason: `CORRECTED: ${reason}`,
    notes: body.notes || txn.notes || `Corrected entry for ${txn.movementId || txn.id}. Reason: ${reason}`,
    remarks: `Corrected entry replacing ${txn.movementId || txn.id}`,
    date: now,
    createdAt: now,
    user: String(user),
    createdBy: String(user),
    stockBefore: currentTotalStock - origSignedQty,
    stockAfter: newProductStock,
    currentStock: newProductStock,
    unitRate: Number(product.cost || 0),
    gstRate: Number(product.gst || 0),
    totalValue: Number((Math.abs(correctedSignedQty) * Number(product.cost || 0)).toFixed(2)),
    serialNumbers: Array.isArray(body.serialNumbers) ? body.serialNumbers : (txn.serialNumbers || [])
  };

  product.stock = newProductStock;
  data.inventoryTransactions.push(reversalTxn);
  data.inventoryTransactions.push(correctedTxn);

  writeData(data);

  const enrichedData = enriched(data);
  return res.json({
    success: true,
    message: `Movement ${txn.movementId || txn.id} corrected. Audit entries ${reversalId} and ${correctedId} created.`,
    data: enrichedData,
    originalMovement: formatCanonicalMovement(txn),
    reversalMovement: formatCanonicalMovement(reversalTxn),
    correctedMovement: formatCanonicalMovement(correctedTxn)
  });
}

/**
 * Returns authoritative enriched products with available stock, reserved stock, and active serials.
 * Single Source of Truth for Stocks and Quotation validation.
 */
function getAuthoritativeProducts() {
  const data = readData();
  const enrichedData = enriched(data);
  return enrichedData.products || [];
}

/**
 * Get authoritative available quotation quantity for a given product ID or code.
 * Considers reserved stock from confirmed orders and active serial numbers for serialized products.
 */
function getProductAvailableStock(productIdOrCode) {
  if (!productIdOrCode) return 0;
  const products = getAuthoritativeProducts();
  const cleanId = String(productIdOrCode).trim().toLowerCase();
  const prod = products.find((p) =>
    String(p.id || '').trim().toLowerCase() === cleanId ||
    String(p.code || '').trim().toLowerCase() === cleanId
  );
  if (!prod) return 0;

  const avail = Number(prod.availableStock !== undefined ? prod.availableStock : (prod.stock || 0));
  const isSerialized = Boolean(prod.serialized);
  const activeSerialsCount = Array.isArray(prod.serialNumbers) ? prod.serialNumbers.length : 0;
  return isSerialized ? Math.max(0, Math.min(avail, activeSerialsCount)) : Math.max(0, avail);
}

module.exports = {
  getStocks,
  getProductHistory,
  getAllPriceHistory,
  createEntity,
  updateEntity,
  deleteEntity,
  buildProductTransactions,
  createStockMovement,
  getStockMovements,
  getMovementDetail,
  voidStockMovement,
  correctStockMovement,
  formatCanonicalMovement,
  getAuthoritativeProducts,
  getProductAvailableStock,
  getNextProductCodeEndpoint,
  validateProductCodeEndpoint,
  getNextProductCode,
  isDuplicateProductCode,
  normalizeProductCode,
  generateSerialNumbersEndpoint,
  isCableProduct,
  generateComputerSerialNumbers
};
