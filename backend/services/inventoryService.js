const fs = require('fs');
const path = require('path');

const STOCKS_FILE = path.join(__dirname, '..', 'data', 'stocks-data.json');

/**
 * Safely read stock data from stocks-data.json
 */
function readStocks() {
  try {
    if (!fs.existsSync(STOCKS_FILE)) {
      return { categories: [], subcategories: [], brands: [], products: [], inventoryTransactions: [] };
    }
    const raw = JSON.parse(fs.readFileSync(STOCKS_FILE, 'utf8'));
    if (!Array.isArray(raw.products)) raw.products = [];
    if (!Array.isArray(raw.inventoryTransactions)) raw.inventoryTransactions = [];
    return raw;
  } catch (error) {
    console.error('Error reading stocks-data.json:', error);
    return { categories: [], subcategories: [], brands: [], products: [], inventoryTransactions: [] };
  }
}

/**
 * Safely write stock data to stocks-data.json
 */
function writeStocks(data) {
  try {
    fs.writeFileSync(STOCKS_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing stocks-data.json:', error);
    throw new Error('Failed to persist inventory data to disk.');
  }
}

/**
 * Find a product by its ID or product code
 */
function findProduct(stockData, identifier) {
  if (!identifier) return null;
  const idStr = String(identifier).trim();
  return (stockData.products || []).find((p) => p.id === idStr || p.code === idStr);
}

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

/**
 * Check if a deterministic transaction already exists (idempotency guard)
 */
function hasTransaction(stockData, txnId) {
  return (stockData.inventoryTransactions || []).some((t) => t.id === txnId);
}

/**
 * Validate serial numbers for INWARD receipt (GRN / Return DC)
 * - Exact count match with receiveQty
 * - No duplicates in the input list
 * - No serial number already present in active inventory
 */
function validateSerialNumbersForInward(product, serialNumbers, receiveQty) {
  if (!Array.isArray(serialNumbers) || serialNumbers.length === 0) {
    return { valid: false, error: `Serial numbers are required for serialized product "${product.name}".` };
  }

  const cleanSerials = serialNumbers.map((s) => String(s || '').trim()).filter(Boolean);

  if (cleanSerials.length !== receiveQty) {
    return {
      valid: false,
      error: `Product "${product.name}" requires exactly ${receiveQty} serial number(s), but ${cleanSerials.length} provided.`
    };
  }

  // Check for internal duplicates
  const seen = new Set();
  for (const sn of cleanSerials) {
    const snLower = sn.toLowerCase();
    if (seen.has(snLower)) {
      return {
        valid: false,
        error: `Duplicate serial number "${sn}" entered in receipt for product "${product.name}".`
      };
    }
    seen.add(snLower);
  }

  // Check against existing active inventory serial numbers
  const existingSerials = new Set((product.serialNumbers || []).map((s) => String(s).trim().toLowerCase()));
  for (const sn of cleanSerials) {
    if (existingSerials.has(sn.toLowerCase())) {
      return {
        valid: false,
        error: `Serial number "${sn}" already exists in inventory for product "${product.name}".`
      };
    }
  }

  return { valid: true, cleanSerials };
}

/**
 * Validate availability for OUTWARD movement (sales invoice / delivery challan)
 * - Checks stock quantity availability
 * - If product is serialized: enforces exact serial selection from active stock
 * - If product is non-serialized: clears/disallows serials
 */
function validateAvailableStock(items, stockData) {
  if (!Array.isArray(items) || items.length === 0) {
    return { valid: false, error: 'No items provided for stock deduction.' };
  }

  const aggregated = new Map();
  const selectedSerialsPerProduct = new Map();

  for (const item of items) {
    const qty = Number(item.quantity !== undefined ? item.quantity : item.orderedQty || 0);
    if (!Number.isInteger(qty) || qty <= 0) {
      return { valid: false, error: `Invalid quantity for ${item.productName || item.productCode || 'item'}. Quantity must be a positive integer.` };
    }

    const prod = findProduct(stockData, item.productId || item.productCode);
    if (!prod) {
      return { valid: false, error: `Product "${item.productName || item.productCode || item.productId}" not found in inventory.` };
    }

    const isSerialized = !isCableProduct(prod, stockData.categories, stockData.subcategories) && Boolean(prod.serialized);

    if (isSerialized) {
      const serials = Array.isArray(item.serialNumbers)
        ? item.serialNumbers.map((s) => String(s || '').trim()).filter(Boolean)
        : [];

      if (serials.length !== qty) {
        return {
          valid: false,
          error: `Product "${prod.name}" is serialized and requires exactly ${qty} serial number(s), but ${serials.length} provided.`
        };
      }

      // Check duplicates within item
      const seen = new Set();
      const existingSerials = new Set((prod.serialNumbers || []).map((s) => String(s).trim().toLowerCase()));

      for (const sn of serials) {
        const snLower = sn.toLowerCase();
        if (seen.has(snLower)) {
          return {
            valid: false,
            error: `Duplicate serial number "${sn}" selected for product "${prod.name}".`
          };
        }
        seen.add(snLower);

        if (!existingSerials.has(snLower)) {
          return {
            valid: false,
            error: `Serial number "${sn}" is not present in active stock for product "${prod.name}".`
          };
        }
      }

      // Check cross-line duplicates for the same product
      const productSelected = selectedSerialsPerProduct.get(prod.id) || new Set();
      for (const sn of serials) {
        const snLower = sn.toLowerCase();
        if (productSelected.has(snLower)) {
          return {
            valid: false,
            error: `Serial number "${sn}" allocated multiple times across lines for product "${prod.name}".`
          };
        }
        productSelected.add(snLower);
      }
      selectedSerialsPerProduct.set(prod.id, productSelected);
      item.serialNumbers = serials;
    } else {
      // Non-serialized: no serial numbers tracked
      item.serialNumbers = [];
    }

    const current = aggregated.get(prod.id) || { product: prod, quantity: 0 };
    current.quantity += qty;
    aggregated.set(prod.id, current);
  }

  // Pre-validate that all requested products have sufficient available physical stock
  for (const [, req] of aggregated.entries()) {
    const available = Number(req.product.stock || 0);
    if (req.quantity > available) {
      return {
        valid: false,
        error: `Insufficient stock for ${req.product.name}. Available: ${available}, required: ${req.quantity}.`
      };
    }
  }

  return { valid: true, aggregated };
}

/**
 * ADD STOCK (Inward Movement: Goods Receipt / GRN, Return DC)
 * Atomic, idempotent, persists to stocks-data.json
 */
function addStock({
  items,
  referenceType, // 'GOODS_RECEIPT' | 'RETURN_DC'
  referenceId,   // e.g. 'GRN-00001', 'DC-00041'
  poReference,   // e.g. 'PO-00001'
  date,
  partyName,
  supplierId,
  supplierName,
  customerId,
  customerName,
  remarks,
  user
}) {
  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, message: 'No items to receive into stock.' };
  }
  if (!referenceType || !referenceId) {
    return { success: false, message: 'referenceType and referenceId are required for inventory tracking.' };
  }

  const stockData = readStocks();
  const plannedMutations = [];

  // 1. Pre-validation Phase: Validate all items before mutating any state
  for (const item of items) {
    const qty = Number(item.receiveNow !== undefined ? item.receiveNow : item.quantity);
    if (!Number.isInteger(qty) || qty < 0) {
      return { success: false, message: `Invalid receive quantity for ${item.productName || item.productCode || 'item'}.` };
    }
    if (qty === 0) continue; // Skip zero-quantity items

    const prod = findProduct(stockData, item.productId || item.productCode);
    if (!prod) {
      return { success: false, message: `Product "${item.productName || item.productCode || item.productId}" not found in Product Master.` };
    }

    const isCable = isCableProduct(prod, stockData.categories, stockData.subcategories);
    if (isCable) {
      prod.serialized = false;
      prod.serialNumbers = [];
    }
    const isSerialized = !isCable && Boolean(prod.serialized);
    let cleanSerials = [];

    if (isSerialized) {
      const serialValidation = validateSerialNumbersForInward(prod, item.serialNumbers, qty);
      if (!serialValidation.valid) {
        return { success: false, message: serialValidation.error };
      }
      cleanSerials = serialValidation.cleanSerials;
    } else {
      cleanSerials = [];
    }

    const deterministicTxnId = `TXN-${referenceType}-${referenceId}-${prod.code || prod.id}`;
    if (hasTransaction(stockData, deterministicTxnId)) {
      // Already recorded this transaction line -> skip to ensure idempotency
      continue;
    }

    const unitRate = item.unitRate !== undefined ? Number(item.unitRate) : (item.rate !== undefined ? Number(item.rate) : Number(prod.cost || 0));
    const gstRate = item.gstRate !== undefined ? Number(item.gstRate) : (item.gst !== undefined ? Number(item.gst) : Number(prod.gst || 0));
    const taxAmount = item.taxAmount !== undefined ? Number(item.taxAmount) : (item.tax !== undefined ? Number(item.tax) : Number((qty * unitRate * (gstRate / 100)).toFixed(2)));
    const totalValue = item.totalValue !== undefined ? Number(item.totalValue) : Number((qty * unitRate).toFixed(2));

    plannedMutations.push({
      product: prod,
      quantity: qty,
      serialNumbers: cleanSerials,
      txnId: deterministicTxnId,
      unitRate,
      gstRate,
      taxAmount,
      totalValue
    });
  }

  if (plannedMutations.length === 0) {
    return { success: true, message: 'No new stock movements needed (already applied or zero quantities).', mutationsCount: 0 };
  }

  // 2. Mutation Phase: Atomic in-memory application
  const txnDate = date || new Date().toISOString();
  const party = partyName || supplierName || 'Supplier';
  const recordedTransactions = [];

  for (const mutation of plannedMutations) {
    const { product, quantity, serialNumbers, txnId, unitRate, gstRate, taxAmount, totalValue } = mutation;
    const stockBefore = Number(product.stock || 0);
    product.stock = stockBefore + quantity;

    if (serialNumbers.length > 0) {
      if (!Array.isArray(product.serialNumbers)) product.serialNumbers = [];
      product.serialNumbers.push(...serialNumbers);

      // FEFO (First Expired, First Out) Metadata Stamping
      if (!product.serialMetadata || typeof product.serialMetadata !== 'object') {
        product.serialMetadata = {};
      }
      const shelfLife = Number(product.shelfLifeMonths || 24);
      const inDate = new Date(txnDate);
      const validInDate = isNaN(inDate.getTime()) ? new Date() : inDate;
      const expDate = new Date(validInDate);
      expDate.setMonth(expDate.getMonth() + shelfLife);
      const expDateStr = expDate.toISOString().split('T')[0];

      serialNumbers.forEach((sn) => {
        product.serialMetadata[sn] = {
          inwardDate: validInDate.toISOString().split('T')[0],
          expiryDate: expDateStr,
          shelfLifeMonths: shelfLife,
          grnReference: referenceId,
          poReference: poReference || null,
          supplierName: party,
          inwardCost: unitRate || Number(product.cost || 0),
          status: 'IN_STOCK'
        };
      });
    }

    // Profit Protection Rule: If goods are received at a higher rate, update product cost to the highest received rate
    // to protect profit margins and prevent selling at a loss
    if (referenceType === 'GOODS_RECEIPT' && unitRate > 0) {
      const currentCost = Number(product.cost || 0);
      product.highestInwardRate = Math.max(Number(product.highestInwardRate || 0), currentCost, unitRate);
      if (unitRate > currentCost) {
        product.previousCost = currentCost;
        product.cost = unitRate;
        if (product.dealerPercentage) {
          product.dealerPrice = Number((product.cost * (1 + Number(product.dealerPercentage) / 100)).toFixed(2));
        }
        if (product.mrpPercentage) {
          product.mrp = Number((product.cost * (1 + Number(product.mrpPercentage) / 100)).toFixed(2));
        }
        product.costUpdatedReason = `Cost updated to ₹${unitRate} on Goods Receipt ${referenceId} (Profit Protection Rule)`;
      }
    }

    const eventName = referenceType === 'RETURN_DC' ? 'Return DC' : 'Goods Receipt';
    const txnRecord = {
      id: txnId,
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      event: eventName,
      reference: referenceId,
      referenceType: referenceType,
      referenceId: referenceId,
      poReference: poReference || null,
      quantity: quantity,
      stockAfter: product.stock,
      balanceAfter: product.stock,
      currentStock: product.stock,
      unitRate: unitRate,
      gstRate: gstRate,
      taxAmount: taxAmount,
      totalValue: totalValue,
      date: txnDate,
      partyName: party,
      supplierId: supplierId || null,
      supplierName: referenceType === 'RETURN_DC' ? null : (supplierName || party),
      customerId: customerId || null,
      customerName: referenceType === 'RETURN_DC' ? (partyName || 'Customer') : null,
      serialNumbers: serialNumbers,
      notes: remarks || '',
      remarks: remarks || `${eventName} for ${party} under reference ${referenceId}${poReference ? ` (PO: ${poReference})` : ''}`,
      createdAt: new Date().toISOString(),
      createdBy: user?.name || 'System'
    };

    stockData.inventoryTransactions.push(txnRecord);
    recordedTransactions.push(txnRecord);
  }

  // 3. Persistence Phase: Atomic write to disk
  writeStocks(stockData);

  return {
    success: true,
    message: `Successfully received ${plannedMutations.reduce((sum, m) => sum + m.quantity, 0)} units into stock.`,
    transactions: recordedTransactions
  };
}

/**
 * DEDUCT STOCK (Outward Movement: Sales Invoice, Delivery Challan)
 * Atomic, idempotent, persists to stocks-data.json
 */
function deductStock({
  items,
  referenceType, // 'SALES_INVOICE' | 'DELIVERY_CHALLAN'
  referenceId,   // e.g. 'INV-00021', 'DC-00041'
  date,
  partyName,
  customerId,
  customerName,
  supplierId,
  supplierName,
  remarks,
  user
}) {
  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, message: 'No items to deduct from stock.' };
  }
  if (!referenceType || !referenceId) {
    return { success: false, message: 'referenceType and referenceId are required for inventory tracking.' };
  }

  const stockData = readStocks();

  // Check idempotency: if any transaction for this reference already exists, don't duplicate
  const existingForRef = (stockData.inventoryTransactions || []).filter(
    (t) => t.referenceType === referenceType && t.referenceId === referenceId
  );
  if (existingForRef.length > 0) {
    return { success: true, alreadyDeducted: true, message: 'Stock already deducted for this reference.' };
  }

  // 1. Pre-validation Phase: Ensure all products have sufficient stock
  const validation = validateAvailableStock(items, stockData);
  if (!validation.valid) {
    return { success: false, message: validation.error };
  }

  // 2. Mutation Phase: Atomic in-memory deduction
  const txnDate = date || new Date().toISOString();
  const party = partyName || customerName || 'Customer';
  const recordedTransactions = [];

  for (const item of items) {
    const qty = Number(item.quantity !== undefined ? item.quantity : item.orderedQty || 0);
    if (qty <= 0) continue;

    const prod = findProduct(stockData, item.productId || item.productCode);
    const isSerialized = Boolean(prod.serialized);
    const stockBefore = Number(prod.stock || 0);
    prod.stock = Math.max(0, stockBefore - qty);

    let serials = [];
    if (isSerialized) {
      serials = Array.isArray(item.serialNumbers) ? item.serialNumbers.map((s) => String(s).trim()) : [];
      if (serials.length > 0 && Array.isArray(prod.serialNumbers)) {
        const serialsToRemove = new Set(serials.map((s) => s.toLowerCase()));
        prod.serialNumbers = prod.serialNumbers.filter((s) => !serialsToRemove.has(String(s).trim().toLowerCase()));

        if (!prod.serialMetadata || typeof prod.serialMetadata !== 'object') {
          prod.serialMetadata = {};
        }
        serials.forEach((sn) => {
          const prev = prod.serialMetadata[sn] || {};
          prod.serialMetadata[sn] = {
            ...prev,
            outwardDate: txnDate,
            dcReference: referenceType === 'DELIVERY_CHALLAN' || referenceType === 'DC' ? referenceId : (prev.dcReference || null),
            invoiceReference: referenceType === 'INVOICE' || referenceType === 'SALES_INVOICE' ? referenceId : (prev.invoiceReference || null),
            customerName: party,
            customerId: customerId || null,
            sellingRate: unitRate,
            status: referenceType === 'INVOICE' || referenceType === 'SALES_INVOICE' ? 'BILLED' : 'DISPATCHED_DC'
          };
        });
      }
    } else {
      prod.serialNumbers = [];
      serials = [];
    }

    const eventName = referenceType === 'DELIVERY_CHALLAN' ? 'Delivery Challan' : 'Sales Invoice';
    const unitRate = item.unitRate !== undefined ? Number(item.unitRate) : (item.rate !== undefined ? Number(item.rate) : (item.price !== undefined ? Number(item.price) : Number(prod.dealerPrice || prod.cost || 0)));
    const gstRate = item.gstRate !== undefined ? Number(item.gstRate) : (item.gst !== undefined ? Number(item.gst) : Number(prod.gst || 0));
    const taxAmount = item.taxAmount !== undefined ? Number(item.taxAmount) : (item.tax !== undefined ? Number(item.tax) : Number((qty * unitRate * (gstRate / 100)).toFixed(2)));
    const totalValue = item.totalValue !== undefined ? Number(item.totalValue) : Number((qty * unitRate).toFixed(2));

    const txnRecord = {
      id: `TXN-${referenceType}-${referenceId}-${prod.code || prod.id}`,
      productId: prod.id,
      productCode: prod.code,
      productName: prod.name,
      event: eventName,
      reference: referenceId,
      referenceType: referenceType,
      referenceId: referenceId,
      quantity: -qty,
      stockAfter: prod.stock,
      balanceAfter: prod.stock,
      currentStock: prod.stock,
      unitRate: unitRate,
      gstRate: gstRate,
      taxAmount: taxAmount,
      totalValue: totalValue,
      date: txnDate,
      partyName: party,
      customerId: customerId || null,
      customerName: customerName || party,
      supplierId: null,
      supplierName: null,
      serialNumbers: serials,
      notes: remarks || '',
      remarks: remarks || `Dispatched to ${party} via ${eventName} (${referenceId})`,
      createdAt: new Date().toISOString(),
      createdBy: user?.name || 'System'
    };

    stockData.inventoryTransactions.push(txnRecord);
    recordedTransactions.push(txnRecord);
  }

  // 3. Persistence Phase
  writeStocks(stockData);

  return {
    success: true,
    message: `Successfully deducted ${items.reduce((s, i) => s + Number(i.quantity || 0), 0)} units from stock.`,
    transactions: recordedTransactions
  };
}

/**
 * Get the current stock balance of a product
 */
function getProductBalance(productIdOrCode) {
  const stockData = readStocks();
  const prod = findProduct(stockData, productIdOrCode);
  if (!prod) return null;
  return {
    id: prod.id,
    code: prod.code,
    name: prod.name,
    serialized: Boolean(prod.serialized),
    stock: Number(prod.stock || 0),
    serialNumbers: prod.serialized ? (prod.serialNumbers || []) : []
  };
}

module.exports = {
  readStocks,
  writeStocks,
  findProduct,
  hasTransaction,
  validateSerialNumbersForInward,
  validateAvailableStock,
  addStock,
  deductStock,
  getProductBalance
};
