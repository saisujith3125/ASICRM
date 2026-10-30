const {
  orders,
  quotations,
  enquiries,
  customers,
  deliveryChallans,
  invoices,
  proformas,
  generateOrderId,
  generateChallanId,
  generateReturnId,
  generateInvoiceId,
  generateProformaId,
  persistStore
} = require('../data/crmStore');
const fs = require('fs');
const path = require('path');
const ACCESS_FILE = path.join(__dirname, '..', 'data', 'access-control.json');
const { hasPermission, requirePermission, getCurrentUser } = require('../utils/accessControl');
const { filterRecordsBySearch } = require('../utils/searchHelper');


const STOCKS_FILE = path.join(__dirname, '..', 'data', 'stocks-data.json');

function readStocks() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STOCKS_FILE, 'utf8'));
    return parsed && Array.isArray(parsed.products) ? parsed : { products: [] };
  } catch {
    return { products: [] };
  }
}

function writeStocks(data) {
  fs.writeFileSync(STOCKS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function isCableProduct(product, categories = [], subcategories = []) {
  if (!product) return false;
  const catId = String(product.categoryId || product.category || '').trim().toUpperCase();
  if (catId === 'CAT-000004') return true;

  const catName = Array.isArray(categories)
    ? (categories.find((c) => String(c.id).toUpperCase() === catId)?.name || '')
    : String(product.categoryName || product.category || '');
  if (/cable/i.test(catName)) return true;

  const subId = String(product.subcategoryId || product.subcategory || '').trim().toUpperCase();
  const subName = Array.isArray(subcategories)
    ? (subcategories.find((s) => String(s.id).toUpperCase() === subId)?.name || '')
    : String(product.subcategoryName || product.subcategory || '');
  if (/cable/i.test(subName)) return true;

  const prodName = String(product.name || product.productName || product.title || product.description || '').trim();
  if (/\bcables?\b/i.test(prodName) || /cat\s*6\s*cable/i.test(prodName) || /utp\s*cable/i.test(prodName) || /patch\s*cord/i.test(prodName) || /fiber\s*cable/i.test(prodName)) {
    return true;
  }

  const code = String(product.code || product.productCode || product.sku || '').trim().toUpperCase();
  if (code === 'ASI-18' || code === 'PROD-000041' || code === 'PRD-041' || code === 'PRD-000041' || /cable/i.test(code)) {
    return true;
  }

  const unit = String(product.unit || '').trim();
  if ((unit === 'Meter' || unit === 'Roll') && /cable|wire/i.test(prodName)) {
    return true;
  }

  return false;
}

function readCompanySettingsSnapshot() {
  try {
    if (fs.existsSync(ACCESS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(ACCESS_FILE, 'utf8'));
      if (parsed && parsed.companySettings && typeof parsed.companySettings === 'object') {
        return parsed.companySettings;
      }
    }
  } catch (_) {}
  return {
    companyName: 'Active System Integration',
    address: 'Plot No. 10A, Perumal Kovil Street, Sivabootham, Vanagaram, Chennai - 600095',
    phone: '9171126666',
    email: 'admin@asi.ind.in',
    website: 'https://asiind.com/',
    gstin: '33AZPPS7068A1Z4',
    state: 'Tamil Nadu',
    logoUrl: null,
    signatureUrl: null,
    sealUrl: null,
    bankName: 'HDFC BANK',
    accountName: 'ACTIVE SYSTEM INTEGRATION',
    accountNumber: '50200028741215',
    ifscCode: 'HDFC0000024',
    branch: 'ANNA NAGAR, CHENNAI',
    proformaNote: 'Kindly verify item model/specifications before release of PO/payment.',
    paymentTerms: '100% ADVANCE PAYMENT',
    deliveryTerms: 'EX-STOCK / 1-2 WEEKS',
    validityTerms: '15 DAYS FROM INVOICE DATE'
  };
}

/**
 * Reserve/deduct the exact quantities represented by a quotation.
 * This happens only during quote -> order conversion, never when a quote is issued.
 */
function deductQuotationStock(quotation) {
  if (!Array.isArray(quotation.items) || quotation.items.length === 0) {
    return { deducted: false, reason: 'legacy quotation without stock line items' };
  }

  if (quotation.stockDeducted === true) {
    return { deducted: false, reason: 'stock already deducted' };
  }

  const data = readStocks();
  const requirements = new Map();

  for (const item of quotation.items) {
    const productId = String(item?.productId || '').trim();
    const quantity = Number(item?.quantity || 0);
    if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
      return { error: `Invalid stock line for ${item?.productName || 'product'}.` };
    }
    requirements.set(productId, (requirements.get(productId) || 0) + quantity);
  }

  for (const [productId, quantity] of requirements.entries()) {
    const product = data.products.find((p) => p.id === productId);
    if (!product) return { error: `Product ${productId} no longer exists in Stocks.` };
    const available = Number(product.stock || 0);
    if (quantity > available) {
      return {
        error: `Insufficient stock for ${product.name}. Available: ${available}, required: ${quantity}.`
      };
    }
  }

  for (const [productId, quantity] of requirements.entries()) {
    const product = data.products.find((p) => p.id === productId);
    product.stock = Number(product.stock || 0) - quantity;
  }

  writeStocks(data);
  return { deducted: true };
}

/**
 * Deduct line items from inventory stock atomically.
 * Validates availability for ALL items before deducting any (atomic rollback/fail-fast).
 * Matches product using productId as primary identity (code as secondary verification).
 * For serialized products: strictly requires and removes serial numbers from active stock.
 * For non-serialized products: clears serial numbers and tracks by quantity only.
 * Returns { deducted: true } or { error: string }.
 */
function deductItemsStock(items, stockData) {
  if (!Array.isArray(items) || items.length === 0) {
    return { deducted: false, reason: 'no items to deduct' };
  }

  const requirements = new Map();
  const selectedSerialsPerProduct = new Map();

  for (const item of items) {
    const qty = Number(item.quantity || 0);
    if (!Number.isInteger(qty) || qty <= 0) {
      return { error: `Invalid quantity for ${item.productName || 'item'}. Quantity must be a positive integer.` };
    }

    // Match exact product using productId as primary identity, productCode as secondary
    let prod = null;
    if (item.productId) {
      prod = (stockData.products || []).find((p) => p.id === item.productId);
    }
    if (!prod && item.productCode) {
      prod = (stockData.products || []).find((p) => p.code === item.productCode);
    }

    if (!prod) {
      return { error: `Product "${item.productName || item.productCode || item.productId}" not found in inventory.` };
    }

    const isSerialized = Boolean(prod.serialized);

    if (isSerialized) {
      const serials = Array.isArray(item.serialNumbers)
        ? item.serialNumbers.map((s) => String(s || '').trim()).filter(Boolean)
        : [];

      if (serials.length !== qty) {
        return {
          error: `Product "${prod.name}" is serialized and requires exactly ${qty} serial number(s), but ${serials.length} provided.`
        };
      }

      // Verify unique within item
      const seen = new Set();
      const existingSerials = new Set((prod.serialNumbers || []).map((s) => String(s).trim().toLowerCase()));

      for (const sn of serials) {
        const snLower = sn.toLowerCase();
        if (seen.has(snLower)) {
          return { error: `Duplicate serial number "${sn}" selected for product "${prod.name}".` };
        }
        seen.add(snLower);

        if (!existingSerials.has(snLower)) {
          return { error: `Serial number "${sn}" is not present in active stock for product "${prod.name}".` };
        }
      }

      // Check cross-line duplicates for the same product
      const productSelected = selectedSerialsPerProduct.get(prod.id) || new Set();
      for (const sn of serials) {
        const snLower = sn.toLowerCase();
        if (productSelected.has(snLower)) {
          return { error: `Serial number "${sn}" allocated multiple times across lines for product "${prod.name}".` };
        }
        productSelected.add(snLower);
      }
      selectedSerialsPerProduct.set(prod.id, productSelected);
      item.serialNumbers = serials;
    } else {
      item.serialNumbers = [];
    }

    const current = requirements.get(prod.id) || { product: prod, quantity: 0 };
    current.quantity += qty;
    requirements.set(prod.id, current);
  }

  // Atomic validation phase: verify all products have sufficient stock
  for (const [, req] of requirements.entries()) {
    const available = Number(req.product.stock || 0);
    if (req.quantity > available) {
      return {
        error: `Insufficient stock for ${req.product.name}. Available: ${available}, required: ${req.quantity}.`
      };
    }
  }

  // Deduction phase: update product stock values and remove serials from active stock
  for (const [, req] of requirements.entries()) {
    req.product.stock = Number(req.product.stock || 0) - req.quantity;
  }

  for (const item of items) {
    let prod = null;
    if (item.productId) prod = (stockData.products || []).find((p) => p.id === item.productId);
    if (!prod && item.productCode) prod = (stockData.products || []).find((p) => p.code === item.productCode);
    if (prod && prod.serialized && Array.isArray(prod.serialNumbers) && Array.isArray(item.serialNumbers)) {
      const serialsToRemove = new Set(item.serialNumbers.map((s) => s.toLowerCase()));
      prod.serialNumbers = prod.serialNumbers.filter((s) => !serialsToRemove.has(String(s).trim().toLowerCase()));
    } else if (prod && !prod.serialized) {
      prod.serialNumbers = [];
    }
  }

  return { deducted: true };
}

function adminUserFromRequest(req) {
  return getCurrentUser(req);
}

/**
 * GET /api/orders
 */
const getOrders = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Orders & Deals', 'View')) return;
    const { search, customerId } = req.query;
    let list = orders.map((o) => {
      if (!o.customerId && o.customerName) {
        const matched = customers.find((c) => c.name.toLowerCase() === o.customerName.toLowerCase());
        if (matched) return { ...o, customerId: matched.id };
      }
      return o;
    });

    if (customerId) {
      list = list.filter((o) => o.customerId === customerId);
    }

    if (search && search.trim()) {
      list = filterRecordsBySearch(list, search, [
        (o) => o.orderId,
        (o) => o.quotationId,
        (o) => o.enquiryId,
        (o) => o.customerId,
        (o) => o.customerName,
        (o) => o.customerCompany,
        (o) => o.company,
        (o) => o.contactPerson,
        (o) => o.phone,
        (o) => o.mobile,
        (o) => o.status,
        (o) => o.items?.map((it) => (typeof it === 'string' ? it : `${it.productName || it.name || it.title || ''} ${it.sku || ''}`))
      ]);
    }

    list.sort((a, b) => {
      const aVal = String(a.orderId || '');
      const bVal = String(b.orderId || '');
      const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
      const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
      if (aNum && bNum && aNum !== bNum) return aNum - bNum;
      return aVal.localeCompare(bVal, undefined, { numeric: true });
    });

    return res.status(200).json({
      success: true,
      data: list
    });
  } catch (error) {
    console.error('Error in getOrders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch orders.'
    });
  }
};

/**
 * GET /api/orders/:id
 */
const getOrderById = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Orders & Deals', 'View')) return;
    const { id } = req.params;
    const order = orders.find((o) => o.orderId === id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order ${id} not found.`
      });
    }

    return res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error in getOrderById:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order.'
    });
  }
};

/**
 * POST /api/orders
 */
const createOrder = (req, res) => {
  try {
    const admin = adminUserFromRequest(req);
    if (!hasPermission(req, 'Orders & Deals', 'Create')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to create orders.' });
    }

    const { customerId, customerName, company, amount, items, lineItems, enquiryId, remarks } = req.body;

    if (!customerName || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Customer name and order amount are required.'
      });
    }

    const newOrder = {
      orderId: generateOrderId(),
      enquiryId: enquiryId || '',
      customerId: customerId || '',
      customerName: customerName.trim(),
      company: company ? company.trim() : '',
      amount: Number(amount),
      items: Array.isArray(items) && items.length > 0 ? items : ['ASICRM Subscription'],
      lineItems: Array.isArray(lineItems) ? lineItems : [],
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      remarks: remarks ? remarks.trim() : '',
      createdBy: admin ? admin.name : 'System'
    };

    orders.unshift(newOrder);
    persistStore();

    return res.status(201).json({
      success: true,
      message: 'Order created successfully.',
      data: newOrder
    });
  } catch (error) {
    console.error('Error in createOrder:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create order.'
    });
  }
};

/**
 * POST /api/orders/from-quotation/:quotationId
 * Explicit commercial conversion: saved quotation -> customer order.
 */
const createOrderFromQuotation = (req, res) => {
  try {
    const admin = adminUserFromRequest(req);
    if (!hasPermission(req, 'Quotations', 'Convert to Order') || !hasPermission(req, 'Orders & Deals', 'Create')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to convert this quotation into an order.' });
    }

    const quotation = quotations.find((q) => q.quotationId === req.params.quotationId);
    if (!quotation) return res.status(404).json({ success: false, message: `Quotation ${req.params.quotationId} not found.` });
    if (quotation.orderId || quotation.status === 'CONVERTED') {
      return res.status(409).json({ success: false, message: `Quotation ${quotation.quotationId} is already converted to Order ${quotation.orderId || ''}.` });
    }

    if (quotation.status !== 'ACCEPTED') {
      return res.status(400).json({
        success: false,
        message: `Quotation ${quotation.quotationId} must be ACCEPTED by customer before converting to an order. Current status: ${quotation.status || 'ISSUED'}.`
      });
    }

    const enquiry = enquiries.find((e) => e.enquiryId === quotation.enquiryId);
    const customer = customers.find((c) => c.id === quotation.customerId);
    const now = new Date().toISOString();

    const orderItems = Array.isArray(quotation.items) && quotation.items.length > 0
      ? quotation.items.map((i) => `${i.quantity}x ${i.productName}`)
      : [quotation.item || 'Quoted Products'];

    // Converting quotation to order does NOT deduct physical stock.
    // Physical stock is deducted at the authoritative Delivery Challan dispatch / physical issue.
    const order = {
      orderId: generateOrderId(),
      enquiryId: quotation.enquiryId,
      quotationId: quotation.quotationId,
      customerId: quotation.customerId,
      customerName: quotation.customerName || enquiry?.customerName || customer?.name || '',
      company: enquiry?.customerCompany || customer?.company || '',
      amount: Number(quotation.grandTotal || quotation.amount),
      items: orderItems,
      lineItems: Array.isArray(quotation.items) && quotation.items.length > 0 ? quotation.items : [],
      advanceAmount: Number(quotation.advanceAmount || 0),
      balanceAmount: quotation.balanceAmount !== undefined ? Number(quotation.balanceAmount) : Math.max(0, Number(quotation.grandTotal || quotation.amount) - Number(quotation.advanceAmount || 0)),
      advancePayments: Array.isArray(quotation.advancePayments) ? quotation.advancePayments : [],
      advanceStatus: quotation.advanceStatus || (Number(quotation.advanceAmount || 0) > 0 ? 'PARTIAL' : 'UNPAID'),
      status: 'COMPLETED',
      stockDeducted: false,
      createdAt: now,
      remarks: String(req.body?.remarks || '').trim() || `Converted from quotation ${quotation.quotationId}.`,
      createdBy: admin ? admin.name : 'System'
    };

    orders.unshift(order);
    quotation.status = 'CONVERTED';
    quotation.orderId = order.orderId;
    quotation.stockDeducted = false;
    quotation.updatedAt = now;
    quotation.updatedBy = admin ? admin.name : 'System';

    if (enquiry) {
      enquiry.relatedOrderId = order.orderId;
      enquiry.status = 'CLOSED';
      enquiry.closureType = 'CASE_CLOSED';
      enquiry.currentStage = 'Case Closed';
      enquiry.outcome = 'LEAD_CONFIRMATION';
      enquiry.solvedAt = now;
      enquiry.solvedBy = admin ? admin.name : 'System';
      enquiry.closedAt = now;
      enquiry.closedBy = admin ? admin.name : 'System';
      enquiry.lastAction = `Order created from quotation: ${quotation.quotationId}`;
      enquiry.nextAction = 'Case closed';
      enquiry.nextFollowUpDate = '';
      enquiry.updatedAt = now;
      if (!Array.isArray(enquiry.followUps)) enquiry.followUps = [];
      enquiry.followUps.push({
        id: `FU-${enquiry.enquiryId.replace('ENQ-', '')}-${enquiry.followUps.length + 1}`,
        contactType: 'Order',
        contactDate: now,
        employee: admin ? admin.name : 'System',
        notes: `Order ${order.orderId} created from quotation ${quotation.quotationId}.`,
        outcome: 'Quotation accepted and converted to order',
        nextAction: 'Case closed',
        nextFollowUpDate: '',
        createdAt: now
      });
    }

    persistStore();
    return res.status(201).json({ success: true, message: `Order ${order.orderId} created from ${quotation.quotationId}. Enquiry case closed.`, data: order, quotation });
  } catch (error) {
    console.error('Error in createOrderFromQuotation:', error);
    return res.status(500).json({ success: false, message: 'Failed to convert quotation to order.' });
  }
};

// ==========================================
// DELIVERY CHALLAN CONTROLLER METHODS
// ==========================================

/**
 * GET /api/orders/delivery-challans
 */
const getDeliveryChallans = (req, res) => {
  try {
    if (!hasPermission(req, 'Orders & Deals', 'View') && !hasPermission(req, 'Delivery Challans', 'View')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to view delivery challans.' });
    }
    const { search, orderId, customerId } = req.query;
    let list = deliveryChallans.map((dc) => {
      const matchingInv = invoices.find((inv) =>
        (inv.challanId && inv.challanId === dc.challanId) ||
        (dc.invoiceId && inv.invoiceId === dc.invoiceId)
      );
      const invoiceId = dc.invoiceId || matchingInv?.invoiceId || null;
      const isInvoiced = Boolean(invoiceId);
      const invoiceStatus = isInvoiced ? 'INVOICED' : 'UNBILLED';

      let enriched = {
        ...dc,
        invoiceId,
        isInvoiced,
        invoiceStatus
      };
      if (!enriched.customerId && enriched.customerName) {
        const matched = customers.find((c) => c.name.toLowerCase() === enriched.customerName.toLowerCase());
        if (matched) enriched.customerId = matched.id;
      }
      return enriched;
    });

    if (orderId) {
      list = list.filter((dc) => dc.orderId === orderId);
    }
    if (customerId) {
      list = list.filter((dc) => dc.customerId === customerId);
    }
    if (req.query.unbilled === 'true' || req.query.invoiceStatus === 'UNBILLED') {
      list = list.filter((dc) =>
        dc.deliveryPurpose !== 'RETURNABLE' &&
        !dc.isReturnableDC &&
        !dc.isInvoiced
      );
    }

    if (search && search.trim()) {
      list = filterRecordsBySearch(list, search, [
        (c) => c.challanId,
        (c) => c.orderId,
        (c) => c.customerName,
        (c) => c.customerCompany,
        (c) => c.company,
        (c) => c.receiverName,
        (c) => c.contactPerson,
        (c) => c.phone,
        (c) => c.mobile,
        (c) => c.status,
        (c) => c.deliveryType,
        (c) => c.items?.map((it) => `${it.productName || it.name || ''} ${it.sku || ''} ${(it.serialNumbers || []).join(' ')}`)
      ]);
    }

    list.sort((a, b) => {
      const aVal = String(a.challanId || '');
      const bVal = String(b.challanId || '');
      const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
      const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
      if (aNum && bNum && aNum !== bNum) return aNum - bNum;
      return aVal.localeCompare(bVal, undefined, { numeric: true });
    });

    return res.status(200).json({
      success: true,
      data: list
    });
  } catch (error) {
    console.error('Error in getDeliveryChallans:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery challans.'
    });
  }
};

/**
 * GET /api/orders/delivery-challans/:id
 */
const getDeliveryChallanById = (req, res) => {
  try {
    if (!hasPermission(req, 'Orders & Deals', 'View') && !hasPermission(req, 'Delivery Challans', 'View')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to view delivery challans.' });
    }
    const { id } = req.params;
    const dc = deliveryChallans.find((item) => item.challanId === id);

    if (!dc) {
      return res.status(404).json({
        success: false,
        message: `Delivery Challan ${id} not found.`
      });
    }

    return res.status(200).json({
      success: true,
      data: dc
    });
  } catch (error) {
    console.error('Error in getDeliveryChallanById:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery challan.'
    });
  }
};

/**
 * POST /api/orders/delivery-challans
 */
const createDeliveryChallan = (req, res) => {
  try {
    const admin = adminUserFromRequest(req);
    if (!hasPermission(req, 'Orders & Deals', 'Create') && !hasPermission(req, 'Delivery Challans', 'Create')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to create delivery challans.' });
    }

    const {
      orderId,
      quotationId,
      refNo,
      referenceNo,
      customerId,
      customerName,
      company,
      deliveryDate,
      deliveryAddress,
      dispatchDetails,
      transitMode,
      vehicleDetails,
      receiverName,
      executiveEngineer,
      executiveEngineerId,
      materialReturnedBy,
      materialReturnedById,
      remarks,
      items,
      status
    } = req.body;

    const order = orderId ? orders.find((o) => o.orderId === orderId) : null;
    if (orderId && !order) {
      return res.status(404).json({ success: false, message: `Order ${orderId} not found.` });
    }

    const stockData = readStocks();
    let stockChanged = false;

    // Check all currently assigned serial numbers across existing Delivery Challans
    const alreadyAssigned = new Set();
    deliveryChallans.forEach((dc) => {
      (dc.items || []).forEach((it) => {
        (it.serialNumbers || []).forEach((sn) => {
          if (sn) alreadyAssigned.add(String(sn).trim().toUpperCase());
        });
      });
    });

    const assignedInThisDc = new Set();
    const rawItems = Array.isArray(items) && items.length > 0 ? items : (order ? order.lineItems || [] : []);

    // 1. Strict duplicate product prevention: ONE PRODUCT = ONE ACTIVE DELIVERY ITEM ROW
    const seenProductIds = new Set();
    for (const it of rawItems) {
      const pKey = it.productId || it.productCode;
      if (pKey) {
        if (seenProductIds.has(pKey)) {
          return res.status(400).json({
            success: false,
            message: `Duplicate product "${it.productName || pKey}" is not allowed. Each product can appear only once in active Delivery Items.`
          });
        }
        seenProductIds.add(pKey);
      }
    }

    // 2. Strict stock quantity validation: Delivery Qty MUST NOT exceed Current Available Quantity
    for (const item of rawItems) {
      let prod = null;
      if (item.productId) prod = stockData.products.find((p) => p.id === item.productId);
      if (!prod && item.productCode) prod = stockData.products.find((p) => p.code === item.productCode);

      if (!prod) {
        return res.status(400).json({
          success: false,
          message: `Product "${item.productName || item.productCode || item.productId}" not found in inventory.`
        });
      }

      const qty = Number(item.quantity !== undefined ? item.quantity : 1);
      const avail = Number(prod.stock !== undefined ? prod.stock : 0);

      if (qty <= 0 || isNaN(qty) || !Number.isInteger(qty)) {
        return res.status(400).json({
          success: false,
          message: `Delivery quantity must be a positive integer for "${prod.name}".`
        });
      }
      if (avail <= 0) {
        return res.status(400).json({
          success: false,
          message: `Product "${prod.name}" is OUT OF STOCK. Cannot deliver.`
        });
      }
      if (qty > avail) {
        return res.status(400).json({
          success: false,
          message: `Maximum available quantity is ${avail} for "${prod.name}".`
        });
      }
    }

    // Map items with product details and serial numbers
    const processedItems = rawItems.map((item) => {
      let prod = null;
      if (item.productId) prod = stockData.products.find((p) => p.id === item.productId);
      if (!prod && item.productCode) prod = stockData.products.find((p) => p.code === item.productCode);

      const qty = Number(item.quantity !== undefined ? item.quantity : 1);
      const isCable = isCableProduct(item, stockData.categories, stockData.subcategories) || isCableProduct(prod, stockData.categories, stockData.subcategories);
      const isSerialized = !isCable && Boolean(prod?.serialized);
      let validatedSerials = [];

      if (isSerialized) {
        const rawSerials = Array.isArray(item.serialNumbers) ? item.serialNumbers : [];
        const serials = rawSerials.map((s) => String(s || '').trim()).filter(Boolean);

        if (serials.length !== qty) {
          throw new Error(`Product "${prod.name}" is serialized and requires exactly ${qty} serial number(s), but ${serials.length} provided.`);
        }

        const activeSerials = new Set((prod.serialNumbers || []).map((s) => String(s).trim().toLowerCase()));
        const itemSeen = new Set();

        for (const s of serials) {
          const lower = s.toLowerCase();
          if (itemSeen.has(lower) || assignedInThisDc.has(lower)) {
            throw new Error(`Duplicate serial number "${s}" specified in this delivery.`);
          }
          if (!activeSerials.has(lower)) {
            throw new Error(`Serial number "${s}" is not present in active stock for product "${prod.name}".`);
          }
          itemSeen.add(lower);
          assignedInThisDc.add(lower);
          validatedSerials.push(s);
        }
      } else {
        validatedSerials = [];
      }

      return {
        productId: item.productId || prod?.id || '',
        productCode: item.productCode || prod?.code || '',
        productName: item.productName || item.name || prod?.name || 'Product',
        productDetails: item.productDetails || prod?.productDetails || prod?.description || '',
        hsnSac: item.hsnSac || prod?.hsnSac || '85258090',
        quantity: qty,
        unit: (item.unit && item.unit !== 'Piece') ? item.unit : ((prod?.unit && prod?.unit !== 'Piece') ? prod.unit : 'Nos'),
        unitPrice: Number(item.unitPrice || prod?.dealerPrice || 0),
        gst: Number(item.gst || prod?.gst || 18),
        serialized: isSerialized,
        serialNumbers: validatedSerials
      };
    });

    const customer = order?.customerId
      ? customers.find((c) => c.id === order.customerId)
      : (customerId
          ? customers.find((c) => c.id === customerId)
          : (customerName
              ? customers.find((c) => c.name.toLowerCase() === customerName.trim().toLowerCase())
              : null));
    const quotation = order?.quotationId ? quotations.find((q) => q.quotationId === order.quotationId) : null;

    const now = new Date().toISOString();
    const challanId = generateChallanId();

    const isDeliveredOnCreate = status === 'DELIVERED';
    let dcStockDeducted = false;

    // Business rule: Stock is NOT deducted on DC creation.
    // Physical stock is strictly deducted when the Delivery Challan is marked as DELIVERED in DC Dispatch via the Deliver button.
    // The only exception is if status was explicitly set to DELIVERED upon creation.
    if (isDeliveredOnCreate) {
      // Check if stock was already deducted by a prior linked invoice for this order or challan
      const isAlreadyDeducted = Boolean(
        (orderId && invoices.some((inv) => inv.orderId === orderId && inv.stockDeducted === true)) ||
        (challanId && invoices.some((inv) => inv.challanId === challanId && inv.stockDeducted === true))
      );

      if (isAlreadyDeducted) {
        dcStockDeducted = true;
      } else {
        const deductionResult = deductItemsStock(processedItems, stockData);
        if (deductionResult.error) {
          return res.status(400).json({ success: false, message: deductionResult.error });
        }
        if (deductionResult.deducted) {
          stockChanged = true;
          dcStockDeducted = true;
          if (!Array.isArray(stockData.inventoryTransactions)) stockData.inventoryTransactions = [];
          const txnDate = deliveryDate || now;
          const custLabel = (customerName || order?.customerName || customer?.name || customer?.company || '').trim();
          processedItems.forEach((it) => {
            const p = stockData.products.find((x) => x.id === it.productId || x.code === it.productCode);
            if (p) {
              const txnId = `TXN-DC-${challanId}-${p.code}-${Date.now()}`;
              stockData.inventoryTransactions.push({
                id: txnId,
                productId: p.id,
                productCode: p.code,
                productName: p.name,
                date: txnDate,
                event: 'Delivery Challan',
                reference: challanId,
                referenceType: 'DC',
                quantity: -Number(it.quantity || 1),
                stockAfter: p.stock,
                currentStock: p.stock,
                customerId: customer?.id || customerId || null,
                customerName: custLabel || 'Customer',
                partyName: custLabel || 'Customer',
                serialNumbers: Array.isArray(it.serialNumbers) ? it.serialNumbers : [],
                remarks: custLabel ? `Delivered to ${custLabel}` : 'Delivered via Delivery Challan'
              });
            }
          });
        }
      }
    } else {
      dcStockDeducted = false;
    }

    if (stockChanged) {
      writeStocks(stockData);
    }

    // Calculate delivery completion state and document title
    let requiredQty = 0;
    let previouslyDeliveredQty = 0;
    const currentDCQty = processedItems.reduce((sum, it) => sum + Number(it.quantity || 1), 0);
    let remainingAfterThisDC = 0;

    if (order) {
      // 1. Total order required quantity across line items
      requiredQty = (order.lineItems || []).reduce((sum, li) => sum + Number(li.quantity || 0), 0);

      // 2. Previously delivered quantity across all prior committed (non-draft) DCs for this order
      const priorDCs = deliveryChallans.filter(
        (d) => d.orderId === order.orderId && d.status !== 'DRAFT' && d.challanId !== challanId
      );

      previouslyDeliveredQty = priorDCs.reduce((sum, d) => {
        const dQty = (d.items || []).reduce((s, it) => s + Number(it.quantity || 0), 0);
        return sum + dQty;
      }, 0);

      // 3. remainingAfterThisDC = requiredQty - previouslyDeliveredQty - currentDCQty
      remainingAfterThisDC = Math.max(0, requiredQty - previouslyDeliveredQty - currentDCQty);

      // Per-item calculation and snapshot
      processedItems.forEach((item) => {
        const orderLine = (order.lineItems || []).find(
          (li) => (li.productId && li.productId === item.productId) || (li.productCode && li.productCode === item.productCode)
        );
        const itemReq = orderLine ? Number(orderLine.quantity || 0) : Number(item.quantity || 1);
        const itemPrev = priorDCs.reduce((sum, d) => {
          const match = (d.items || []).find(
            (it) => (it.productId && it.productId === item.productId) || (it.productCode && it.productCode === item.productCode)
          );
          return sum + (match ? Number(match.quantity || 0) : 0);
        }, 0);
        const itemCur = Number(item.quantity || 1);
        item.requiredQty = itemReq;
        item.previouslyDeliveredQty = itemPrev;
        item.currentDeliveryQty = itemCur;
        item.remainingAfterThisDC = Math.max(0, itemReq - itemPrev - itemCur);
      });
    } else {
      // Quotation or Standalone DC without linked order
      if (req.body.remainingAfterThisDC !== undefined) {
        remainingAfterThisDC = Math.max(0, Number(req.body.remainingAfterThisDC));
      } else {
        // Calculate remaining from items requiredQty vs quantity
        const itemsPending = (rawItems || []).reduce((sum, it) => {
          const req = Number(it.requiredQty || it.quantity || 1);
          const cur = Number(it.quantity || 1);
          return sum + Math.max(0, req - cur);
        }, 0);
        remainingAfterThisDC = itemsPending;
      }
      requiredQty = currentDCQty + remainingAfterThisDC;
      previouslyDeliveredQty = 0;

      // Item level snapshot
      processedItems.forEach((item, idx) => {
        const rawItem = (rawItems && rawItems[idx]) || {};
        const req = Number(rawItem.requiredQty || item.quantity || 1);
        const cur = Number(item.quantity || 1);
        item.requiredQty = req;
        item.previouslyDeliveredQty = 0;
        item.currentDeliveryQty = cur;
        item.remainingAfterThisDC = Math.max(0, req - cur);
        item.remainingQty = Math.max(0, req - cur);
        item.status = item.remainingAfterThisDC > 0 ? 'PARTIAL' : 'COMPLETE';
      });
    }

    // Dynamic document title based on purpose vs delivery status:
    // Purpose: NORMAL DELIVERY -> DELIVERY CHALLAN; RETURNABLE / TEMPORARY -> RETURNABLE DC
    // Delivery status: PARTIAL vs COMPLETE
    const deliveryPurpose = (req.body.deliveryPurpose === 'RETURNABLE' || req.body.documentType === 'RETURNABLE_DC' || req.body.isReturnableDC === true)
      ? 'RETURNABLE'
      : 'NORMAL';
    const documentType = deliveryPurpose === 'RETURNABLE' ? 'RETURNABLE_DC' : 'DELIVERY_CHALLAN';
    const documentTitle = documentType === 'RETURNABLE_DC' ? 'RETURNABLE DC' : 'DELIVERY CHALLAN';
    const deliveryStatus = (req.body.deliveryStatus === 'PARTIAL' || remainingAfterThisDC > 0) ? 'PARTIAL' : 'COMPLETE';

    const customerFullAddr = customer?.address
      ? `${customer.address}${customer.city ? ', ' + customer.city : ''}`
      : (order?.deliveryAddress || deliveryAddress || '');

    // Real customer PO reference check (omit fake PO Number reuse where poNumber === orderId or starts with ORD-)
    let resolvedPoNumber = '';
    const rawOrderPo = order ? order.poNumber : req.body.poNumber;
    if (rawOrderPo && rawOrderPo !== order?.orderId && !String(rawOrderPo).startsWith('ORD-')) {
      resolvedPoNumber = String(rawOrderPo).trim();
    }

    const newChallan = {
      challanId,
      orderId: order ? order.orderId : (orderId || ''),
      poNumber: resolvedPoNumber,
      refNo: (refNo || referenceNo || resolvedPoNumber || (order ? order.orderId : '') || orderId || '').trim(),
      enquiryId: order ? (order.enquiryId || '') : '',
      quotationId: quotationId || (order ? (order.quotationId || '') : ''),
      quotationDate: quotation?.createdAt ? quotation.createdAt.slice(0, 10) : '',
      vehicleDetails: (vehicleDetails || req.body.vehicleDetails || '').trim(),
      customerId: order ? (order.customerId || '') : (customer?.id || customerId || ''),
      customerName: (customerName || order?.customerName || customer?.name || '').trim(),
      company: (company || order?.company || customer?.company || '').trim(),
      customerAddress: customerFullAddr,
      deliveryDate: deliveryDate || new Date().toISOString().slice(0, 10),
      deliveryAddress: deliveryAddress || customerFullAddr,
      dispatchDetails: dispatchDetails ? dispatchDetails.trim() : (transitMode || 'Road Express'),
      transitMode: transitMode || dispatchDetails || 'Road Express',
      receiverName: receiverName ? receiverName.trim() : (customer?.contactPerson || customer?.name || ''),
      executiveEngineer: (executiveEngineer || req.body.executiveEngineerName || '').trim(),
      executiveEngineerId: (executiveEngineerId || '').trim(),
      materialReturnedBy: (materialReturnedBy || req.body.materialReturnedByName || '').trim(),
      materialReturnedById: (materialReturnedById || '').trim(),
      executiveName: admin ? admin.name : (order?.createdBy || 'Executive'),
      authorizedSignatory: 'Active System Integration',
      remarks: remarks ? remarks.trim() : '',
      status: status || 'DISPATCHED', // 'DRAFT' | 'DISPATCHED' | 'DELIVERED' | 'RETURNED'
      deliveryPurpose,
      deliveryStatus,
      documentType,
      documentTitle,
      isReturnableDC: documentType === 'RETURNABLE_DC',
      requiredQty,
      previouslyDeliveredQty,
      currentDeliveryQty: currentDCQty,
      remainingAfterThisDC,
      items: processedItems,
      stockDeducted: dcStockDeducted,
      returnedUnits: 0,
      remainingUnits: currentDCQty,
      returnStatus: 'NOT_RETURNED', // 'NOT_RETURNED' | 'PARTIALLY_RETURNED' | 'FULLY_RETURNED'
      returnedHistory: [],
      invoiceId: null,
      createdAt: now,
      createdBy: admin ? admin.name : 'System'
    };

    deliveryChallans.push(newChallan);
    deliveryChallans.sort((a, b) => {
      const aVal = String(a.challanId || '');
      const bVal = String(b.challanId || '');
      const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
      const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
      if (aNum && bNum && aNum !== bNum) return aNum - bNum;
      return aVal.localeCompare(bVal, undefined, { numeric: true });
    });

    // If new challan references an existing pending DC (fulfilling partial delivery)
    if (newChallan.refNo) {
      const parentDc = deliveryChallans.find((d) => d.challanId === newChallan.refNo && d.challanId !== newChallan.challanId);
      if (parentDc) {
        if (!Array.isArray(parentDc.subsequentChallanIds)) parentDc.subsequentChallanIds = [];
        if (!parentDc.subsequentChallanIds.includes(challanId)) {
          parentDc.subsequentChallanIds.push(challanId);
        }
        const parentRemaining = Number(parentDc.remainingAfterThisDC || 0);
        const itemsPendingSum = (parentDc.items || []).reduce((s, it) => s + Number(it.remainingAfterThisDC ?? it.remainingQty ?? 0), 0);
        const effectiveParentRemaining = parentRemaining > 0 ? parentRemaining : itemsPendingSum;
        const fulfilledQty = processedItems.reduce((sum, it) => sum + Number(it.quantity || 0), 0);

        if (fulfilledQty >= effectiveParentRemaining && effectiveParentRemaining > 0) {
          parentDc.remainingAfterThisDC = 0;
          parentDc.deliveryStatus = 'COMPLETE';
          if (Array.isArray(parentDc.items)) {
            parentDc.items.forEach((it) => {
              it.remainingAfterThisDC = 0;
              it.remainingQty = 0;
              it.status = 'COMPLETE';
            });
          }
        } else if (effectiveParentRemaining > 0) {
          parentDc.remainingAfterThisDC = Math.max(0, effectiveParentRemaining - fulfilledQty);
          if (Array.isArray(parentDc.items)) {
            parentDc.items.forEach((it) => {
              const matchingDelivered = processedItems.filter((pi) =>
                (pi.productId && pi.productId === it.productId) ||
                (pi.productCode && pi.productCode === it.productCode)
              ).reduce((s, pi) => s + Number(pi.quantity || 0), 0);
              const curRem = Number(it.remainingAfterThisDC ?? it.remainingQty ?? 0);
              const nextRem = Math.max(0, curRem - matchingDelivered);
              it.remainingAfterThisDC = nextRem;
              it.remainingQty = nextRem;
              it.status = nextRem === 0 ? 'COMPLETE' : 'PARTIAL';
            });
          }
          parentDc.deliveryStatus = parentDc.remainingAfterThisDC > 0 ? 'PARTIAL' : 'COMPLETE';
        }

        // The subsequent delivery challan fulfilled its dispatched shipment completely
        newChallan.remainingAfterThisDC = 0;
        newChallan.deliveryStatus = 'COMPLETE';
        if (Array.isArray(newChallan.items)) {
          newChallan.items.forEach((it) => {
            it.remainingAfterThisDC = 0;
            it.remainingQty = 0;
            it.status = 'COMPLETE';
          });
        }
      }
    }

    // Track challan on order if linked
    if (order) {
      if (!Array.isArray(order.challanIds)) order.challanIds = [];
      order.challanIds.push(challanId);
      if (dcStockDeducted && remainingAfterThisDC === 0) {
        order.stockDeducted = true;
      }
    }

    persistStore();

    return res.status(201).json({
      success: true,
      message: `Delivery Challan ${challanId} created successfully.`,
      data: newChallan
    });
  } catch (error) {
    console.error('Error in createDeliveryChallan:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create delivery challan.'
    });
  }
};

/**
 * PATCH /api/orders/delivery-challans/:id/status
 */
const updateDeliveryChallanStatus = (req, res) => {
  try {
    const admin = adminUserFromRequest(req);
    const { id } = req.params;
    const { status, remarks, receiverName, dispatchDetails, transitMode, deliveryDate, returnReason, items } = req.body;

    const canEditDc = hasPermission(req, 'Delivery Challans', 'Edit') || hasPermission(req, 'Orders & Deals', 'Edit');
    if (status === 'DISPATCHED' && !hasPermission(req, 'Delivery Challans', 'Dispatch') && !canEditDc) {
      return res.status(403).json({ success: false, message: 'You do not have permission to dispatch delivery challans.' });
    }
    if (status === 'DELIVERED' && !hasPermission(req, 'Delivery Challans', 'Deliver') && !canEditDc) {
      return res.status(403).json({ success: false, message: 'You do not have permission to mark delivery challans as delivered.' });
    }
    if (status === 'RETURNED' && !hasPermission(req, 'Delivery Challans', 'Return') && !canEditDc) {
      return res.status(403).json({ success: false, message: 'You do not have permission to return delivery challans.' });
    }

    const dc = deliveryChallans.find((d) => d.challanId === id);
    if (!dc) {
      return res.status(404).json({ success: false, message: `Delivery Challan ${id} not found.` });
    }

    // Business rule: Stock is strictly deducted when Delivery Challan status transitions to DELIVERED (e.g. clicking Deliver in DC Dispatch)
    if (status === 'DELIVERED' && !dc.stockDeducted) {
      const stockData = readStocks();

      // Check if stock was already deducted by a prior linked invoice for this order or challan
      const isAlreadyDeducted = Boolean(
        (dc.orderId && invoices.some((inv) => inv.orderId === dc.orderId && inv.stockDeducted === true)) ||
        (invoices.some((inv) => inv.challanId === dc.challanId && inv.stockDeducted === true))
      );

      if (isAlreadyDeducted) {
        dc.stockDeducted = true;
      } else {
        const deductionResult = deductItemsStock(dc.items || [], stockData);
        if (deductionResult.error) {
          return res.status(400).json({ success: false, message: deductionResult.error });
        }
        if (deductionResult.deducted) {
          if (!Array.isArray(stockData.inventoryTransactions)) stockData.inventoryTransactions = [];
          const txnDate = deliveryDate || dc.deliveryDate || new Date().toISOString();
          const custLabel = (dc.customerName || '').trim();
          (dc.items || []).forEach((it) => {
            const p = stockData.products.find((x) => x.id === it.productId || x.code === it.productCode);
            if (p) {
              const txnId = `TXN-DC-${id}-${p.code}-${Date.now()}`;
              stockData.inventoryTransactions.push({
                id: txnId,
                productId: p.id,
                productCode: p.code,
                productName: p.name,
                date: txnDate,
                event: 'Delivery Challan',
                reference: id,
                referenceType: 'DC',
                quantity: -Number(it.quantity || 1),
                stockAfter: p.stock,
                currentStock: p.stock,
                customerId: dc.customerId || null,
                customerName: custLabel || 'Customer',
                partyName: custLabel || 'Customer',
                serialNumbers: Array.isArray(it.serialNumbers) ? it.serialNumbers : [],
                remarks: custLabel ? `Delivered to ${custLabel}` : 'Delivered via Delivery Challan'
              });
            }
          });
          writeStocks(stockData);
          dc.stockDeducted = true;
          dc.deliveredAt = new Date().toISOString();
        }
      }
    }

    // If transitioning from DRAFT to committed state, finalize immutable documentType snapshot if not already set
    if (status && status !== 'DRAFT' && dc.status === 'DRAFT' && !dc.documentType) {
      const linkedOrder = dc.orderId ? orders.find((o) => o.orderId === dc.orderId) : null;
      let reqQty = 0;
      let prevDelivered = 0;
      const curQty = (dc.items || []).reduce((sum, it) => sum + Number(it.quantity || 1), 0);
      let remAfter = 0;

      if (linkedOrder) {
        reqQty = (linkedOrder.lineItems || []).reduce((sum, li) => sum + Number(li.quantity || 0), 0);
        const priorDCs = deliveryChallans.filter(
          (d) => d.orderId === linkedOrder.orderId && d.status !== 'DRAFT' && d.challanId !== id
        );
        prevDelivered = priorDCs.reduce((sum, d) => {
          return sum + (d.items || []).reduce((s, it) => s + Number(it.quantity || 0), 0);
        }, 0);
        remAfter = Math.max(0, reqQty - prevDelivered - curQty);
      } else {
        remAfter = Number(dc.remainingAfterThisDC || 0);
        reqQty = curQty + remAfter;
      }

      const delivPurpose = dc.deliveryPurpose || (dc.isReturnableDC === true ? 'RETURNABLE' : 'NORMAL');
      const docType = delivPurpose === 'RETURNABLE' ? 'RETURNABLE_DC' : 'DELIVERY_CHALLAN';
      dc.deliveryPurpose = delivPurpose;
      dc.deliveryStatus = remAfter > 0 ? 'PARTIAL' : 'COMPLETE';
      dc.documentType = docType;
      dc.documentTitle = docType === 'RETURNABLE_DC' ? 'RETURNABLE DC' : 'DELIVERY CHALLAN';
      dc.isReturnableDC = docType === 'RETURNABLE_DC';
      dc.requiredQty = reqQty;
      dc.previouslyDeliveredQty = prevDelivered;
      dc.currentDeliveryQty = curQty;
      dc.remainingAfterThisDC = remAfter;
    }

    // Handle PARTIAL or FULL RETURN
    const isReturnAction = status === 'RETURNED' || status === 'PARTIALLY RETURNED' || (req.body.returnedItems && Array.isArray(req.body.returnedItems));
    if (isReturnAction) {
      const returnedItemsPayload = req.body.returnedItems;
      const stockData = readStocks();
      if (!Array.isArray(stockData.inventoryTransactions)) stockData.inventoryTransactions = [];
      let stockChanged = false;
      const returnTxnDate = deliveryDate || new Date().toISOString();
      const custLabel = (dc.customerName || '').trim();

      if (!Array.isArray(dc.returnedHistory)) dc.returnedHistory = [];

      if (Array.isArray(returnedItemsPayload) && returnedItemsPayload.length > 0) {
        const currentTotalSent = (dc.items || []).reduce((s, it) => s + Number(it.quantity || 1), 0);
        const currentTotalReturned = (dc.items || []).reduce((s, it) => s + Number(it.returnedQty || 0), 0);
        const totalRemaining = Math.max(0, currentTotalSent - currentTotalReturned);

        if (totalRemaining <= 0 || currentTotalReturned >= currentTotalSent) {
          return res.status(400).json({
            success: false,
            message: 'Full quantity already returned.'
          });
        }

        const totalBatchRequested = returnedItemsPayload.reduce((sum, rp) => {
          return sum + Math.max(0, parseInt(rp.returnNowQty !== undefined ? rp.returnNowQty : rp.quantity, 10) || 0);
        }, 0);

        if (totalBatchRequested > totalRemaining) {
          return res.status(400).json({
            success: false,
            message: `Only ${totalRemaining} units remain available for return.`
          });
        }

        // 1. Pre-validation Phase: Validate all return items before making changes
        for (const item of (dc.items || [])) {
          const retPayload = returnedItemsPayload.find(
            (rp) => (rp.productId && rp.productId === item.productId) || (rp.productCode && rp.productCode === item.productCode)
          );
          if (!retPayload) continue;

          const returnNow = Math.max(0, parseInt(retPayload.returnNowQty !== undefined ? retPayload.returnNowQty : retPayload.quantity, 10) || 0);
          if (returnNow <= 0) continue;

          const currentSent = Number(item.quantity || 1);
          const alreadyRet = Number(item.returnedQty || 0);
          const maxEligible = Math.max(0, currentSent - alreadyRet);

          if (maxEligible <= 0 && returnNow > 0) {
            return res.status(400).json({
              success: false,
              message: 'Full quantity already returned.'
            });
          }

          if (returnNow > maxEligible) {
            return res.status(400).json({
              success: false,
              message: `Only ${maxEligible} units remain available for return.`
            });
          }

          const p = stockData.products.find((x) => x.id === item.productId || x.code === item.productCode);
          const isSerialized = p ? Boolean(p.serialized) : false;

          if (isSerialized) {
            const rawSerials = Array.isArray(retPayload.returnedSerials) ? retPayload.returnedSerials : [];
            const cleanSerials = rawSerials.map((s) => String(s || '').trim()).filter(Boolean);

            if (cleanSerials.length !== returnNow) {
              return res.status(400).json({
                success: false,
                message: `Product "${item.productName}" is serialized and requires exactly ${returnNow} return serial number(s), but ${cleanSerials.length} provided.`
              });
            }

            const dispatchedSerials = (Array.isArray(item.serialNumbers) ? item.serialNumbers : []).map((s) => String(s).trim().toLowerCase());
            const alreadyReturned = new Set((Array.isArray(item.returnedSerials) ? item.returnedSerials : []).map((s) => String(s).trim().toLowerCase()));
            const eligibleSet = new Set(dispatchedSerials.filter((s) => !alreadyReturned.has(s)));

            const seenThisBatch = new Set();
            for (const sn of cleanSerials) {
              const lower = sn.toLowerCase();
              if (seenThisBatch.has(lower)) {
                return res.status(400).json({
                  success: false,
                  message: `Duplicate serial number "${sn}" entered for return of "${item.productName}".`
                });
              }
              seenThisBatch.add(lower);

              if (!eligibleSet.has(lower)) {
                return res.status(400).json({
                  success: false,
                  message: `Serial number "${sn}" is not eligible for return on this Delivery Challan (either not originally dispatched or already returned).`
                });
              }
            }
          }
        }

        // 2. Mutation Phase: Apply return movements
        let anyReturnedNow = false;
        const txnItems = [];

        dc.items = (dc.items || []).map((item) => {
          const retPayload = returnedItemsPayload.find(
            (rp) => (rp.productId && rp.productId === item.productId) || (rp.productCode && rp.productCode === item.productCode)
          );
          if (!retPayload) return item;

          const returnNow = Math.max(0, parseInt(retPayload.returnNowQty !== undefined ? retPayload.returnNowQty : retPayload.quantity, 10) || 0);
          if (returnNow <= 0) return item;

          const currentSent = Number(item.quantity || 1);
          const alreadyRet = Number(item.returnedQty || 0);
          const maxEligible = Math.max(0, currentSent - alreadyRet);
          const actualToReturn = Math.min(returnNow, maxEligible);

          if (actualToReturn <= 0) return item;
          anyReturnedNow = true;

          const p = stockData.products.find((x) => x.id === item.productId || x.code === item.productCode);
          const isSerialized = p ? Boolean(p.serialized) : false;

          const serialsToReturn = isSerialized && Array.isArray(retPayload.returnedSerials)
            ? retPayload.returnedSerials.map((s) => String(s || '').trim()).filter(Boolean)
            : [];

          // Add to product stock and restore active serials
          if (p) {
            p.stock = Number(p.stock || 0) + actualToReturn;
            if (isSerialized) {
              if (!Array.isArray(p.serialNumbers)) p.serialNumbers = [];
              p.serialNumbers.push(...serialsToReturn);
            } else {
              p.serialNumbers = [];
            }
            stockChanged = true;

            // Generate unique idempotent return transaction
            const retTxnId = `TXN-RET-${id}-${p.code}-${Date.now()}`;
            stockData.inventoryTransactions.push({
              id: retTxnId,
              productId: p.id,
              productCode: p.code,
              productName: p.name,
              date: returnTxnDate,
              event: 'Return DC',
              reference: id,
              referenceType: 'RET',
              quantity: actualToReturn,
              stockAfter: p.stock,
              currentStock: p.stock,
              customerId: dc.customerId || null,
              customerName: custLabel || 'Customer',
              partyName: custLabel || 'Customer',
              serialNumbers: isSerialized ? serialsToReturn : [],
              remarks: `Returned from ${custLabel || 'Customer'}: ${returnReason || 'Partial Return'}`
            });
          }

          const newReturnedQty = alreadyRet + actualToReturn;
          const newRemainingQty = Math.max(0, currentSent - newReturnedQty);

          txnItems.push({
            productId: item.productId,
            productCode: item.productCode,
            productName: item.productName,
            productDetails: item.productDetails || '',
            unit: (item.unit && item.unit !== 'Piece') ? item.unit : 'Nos',
            deliveredQty: currentSent,
            quantity: actualToReturn,
            returnedQty: actualToReturn,
            remainingQty: newRemainingQty,
            serialNumbers: isSerialized ? serialsToReturn : [],
            returnedSerials: isSerialized ? serialsToReturn : []
          });

          return {
            ...item,
            returnedQty: newReturnedQty,
            remainingQty: newRemainingQty,
            returnedSerials: [
              ...(Array.isArray(item.returnedSerials) ? item.returnedSerials : []),
              ...(isSerialized ? serialsToReturn : [])
            ]
          };
        });

        // Compute total sent vs total returned across all items
        const totalSent = dc.items.reduce((s, it) => s + Number(it.quantity || 1), 0);
        const totalReturned = dc.items.reduce((s, it) => s + Number(it.returnedQty || 0), 0);

        if (totalReturned >= totalSent) {
          dc.status = 'RETURNED';
          dc.returnStatus = 'FULLY_RETURNED';
        } else if (totalReturned > 0) {
          dc.status = 'PARTIALLY RETURNED';
          dc.returnStatus = 'PARTIALLY_RETURNED';
        } else {
          dc.returnStatus = 'NOT_RETURNED';
        }

        dc.returnedUnits = totalReturned;
        dc.remainingUnits = Math.max(0, totalSent - totalReturned);

        if (anyReturnedNow) {
          const batchReturnedCount = txnItems.reduce((sum, ti) => sum + ti.quantity, 0);

          const returnSeq = (Array.isArray(dc.returnedHistory) ? dc.returnedHistory.length : 0) + 1;
          const rawChallanNo = String(dc.challanId || id).replace(/^DC-/, '');
          const returnId = `RDC-${rawChallanNo}-${String(returnSeq).padStart(3, '0')}`;
          dc.lastReturnId = returnId;
          dc.returnId = returnId;
          dc.returnDate = returnTxnDate;

          const isPartialTxn = dc.remainingUnits > 0;
          dc.returnedHistory.push({
            id: returnId,
            returnId: returnId,
            originalChallanId: dc.challanId,
            challanId: dc.challanId,
            orderId: dc.orderId,
            customerId: dc.customerId,
            customerName: dc.customerName,
            company: dc.company,
            customerAddress: dc.customerAddress,
            deliveryAddress: dc.deliveryAddress,
            gstin: dc.gstin,
            date: returnTxnDate,
            returnDate: returnTxnDate,
            deliveryDate: returnTxnDate,
            reason: returnReason || 'Demo Equipment Return',
            returnReason: returnReason || 'Demo Equipment Return',
            remarks: remarks || '',
            returnRemarks: remarks || '',
            returnedUnits: batchReturnedCount,
            cumulativeReturnedUnits: totalReturned,
            remainingUnits: dc.remainingUnits,
            totalDeliveredUnits: totalSent,
            documentType: isPartialTxn ? 'PARTIAL_RETURN_DC' : 'RETURN_DC',
            documentTitle: isPartialTxn ? 'PARTIAL RETURN DC' : 'RETURN DC',
            returnStatus: isPartialTxn ? 'PARTIALLY_RETURNED' : 'FULLY_RETURNED',
            isPartialReturn: isPartialTxn,
            isReturnDocument: true,
            deliveryPurpose: dc.deliveryPurpose,
            executiveEngineer: req.body.executiveEngineer || dc.executiveEngineer || '',
            materialReturnedBy: req.body.materialReturnedBy || dc.materialReturnedBy || '',
            returnedBy: admin ? admin.name : 'System',
            timestamp: new Date().toISOString(),
            items: txnItems
          });
        }
      } else if (status === 'RETURNED' && dc.status !== 'RETURNED') {
        // Fallback: full return of whatever items remain unreturned
        let batchTotal = 0;
        const txnItems = [];
        dc.items = (dc.items || []).map((item) => {
          const currentSent = Number(item.quantity || 1);
          const alreadyRet = Number(item.returnedQty || 0);
          const remaining = Math.max(0, currentSent - alreadyRet);

          if (remaining > 0) {
            batchTotal += remaining;
            const p = stockData.products.find((x) => x.id === item.productId || x.code === item.productCode);
            const isSerialized = p ? Boolean(p.serialized) : false;

            let serialsToReturn = [];
            if (isSerialized) {
              const dispatchedSerials = Array.isArray(item.serialNumbers) ? item.serialNumbers : [];
              const alreadyReturned = new Set((Array.isArray(item.returnedSerials) ? item.returnedSerials : []).map((s) => String(s).trim().toLowerCase()));
              serialsToReturn = dispatchedSerials.filter((s) => s && !alreadyReturned.has(String(s).trim().toLowerCase()));
            }

            if (p) {
              p.stock = Number(p.stock || 0) + remaining;
              if (isSerialized) {
                if (!Array.isArray(p.serialNumbers)) p.serialNumbers = [];
                p.serialNumbers.push(...serialsToReturn);
              } else {
                p.serialNumbers = [];
              }
              stockChanged = true;
              stockData.inventoryTransactions.push({
                id: `TXN-RET-${id}-${p.code}-${Date.now()}`,
                productId: p.id,
                productCode: p.code,
                productName: p.name,
                date: returnTxnDate,
                event: 'Return DC',
                reference: id,
                referenceType: 'RET',
                quantity: remaining,
                stockAfter: p.stock,
                serialNumbers: isSerialized ? serialsToReturn : [],
                remarks: `Full Return from ${custLabel || 'Customer'}: ${returnReason || 'Return DC'}`
              });
            }

            txnItems.push({
              productId: item.productId,
              productCode: item.productCode,
              productName: item.productName,
              productDetails: item.productDetails || '',
              unit: (item.unit && item.unit !== 'Piece') ? item.unit : 'Nos',
              deliveredQty: currentSent,
              quantity: remaining,
              returnedQty: remaining,
              remainingQty: 0,
              serialNumbers: isSerialized ? serialsToReturn : [],
              returnedSerials: isSerialized ? serialsToReturn : []
            });

            return {
              ...item,
              returnedQty: currentSent,
              remainingQty: 0,
              returnedSerials: [
                ...(Array.isArray(item.returnedSerials) ? item.returnedSerials : []),
                ...(isSerialized ? serialsToReturn : [])
              ]
            };
          }

          return item;
        });

        const totalSent = dc.items.reduce((s, it) => s + Number(it.quantity || 1), 0);
        dc.status = 'RETURNED';
        dc.returnStatus = 'FULLY_RETURNED';
        dc.returnedUnits = totalSent;
        dc.remainingUnits = 0;

        if (batchTotal > 0) {
          const returnSeq = (Array.isArray(dc.returnedHistory) ? dc.returnedHistory.length : 0) + 1;
          const rawChallanNo = String(dc.challanId || id).replace(/^DC-/, '');
          const returnId = `RDC-${rawChallanNo}-${String(returnSeq).padStart(3, '0')}`;
          dc.lastReturnId = returnId;
          dc.returnId = returnId;
          dc.returnDate = returnTxnDate;

          dc.returnedHistory.push({
            id: returnId,
            returnId: returnId,
            originalChallanId: dc.challanId,
            challanId: dc.challanId,
            orderId: dc.orderId,
            customerId: dc.customerId,
            customerName: dc.customerName,
            company: dc.company,
            customerAddress: dc.customerAddress,
            deliveryAddress: dc.deliveryAddress,
            gstin: dc.gstin,
            date: returnTxnDate,
            returnDate: returnTxnDate,
            deliveryDate: returnTxnDate,
            reason: returnReason || 'Return DC',
            returnReason: returnReason || 'Return DC',
            remarks: remarks || '',
            returnRemarks: remarks || '',
            returnedUnits: batchTotal,
            cumulativeReturnedUnits: totalSent,
            remainingUnits: 0,
            totalDeliveredUnits: totalSent,
            documentType: 'RETURN_DC',
            documentTitle: 'RETURN DC',
            returnStatus: 'FULLY_RETURNED',
            isPartialReturn: false,
            isReturnDocument: true,
            deliveryPurpose: dc.deliveryPurpose,
            executiveEngineer: req.body.executiveEngineer || dc.executiveEngineer || '',
            materialReturnedBy: req.body.materialReturnedBy || dc.materialReturnedBy || '',
            returnedBy: admin ? admin.name : 'System',
            timestamp: new Date().toISOString(),
            items: txnItems
          });
        }
      }

      if (stockChanged) {
        writeStocks(stockData);
      }
    } else if (status) {
      dc.status = status;
      if (req.body.resetReturn) {
        dc.returnStatus = 'NONE';
        dc.returnedUnits = 0;
        dc.remainingUnits = Array.isArray(dc.items) ? dc.items.reduce((s, i) => s + Number(i.quantity || 1), 0) : 0;
        dc.returnDate = null;
        dc.returnReason = null;
        dc.returnRemarks = null;
        dc.returnedHistory = [];
        if (Array.isArray(dc.items)) {
          dc.items.forEach((it) => {
            it.returnedQty = 0;
            it.remainingQty = Number(it.quantity || 1);
            it.returnedSerials = [];
          });
        }
      }
    }

    if (remarks !== undefined) {
      dc.remarks = remarks;
      if (isReturnAction) dc.returnRemarks = remarks;
    }
    if (receiverName !== undefined) dc.receiverName = receiverName;
    if (dispatchDetails !== undefined) dc.dispatchDetails = dispatchDetails;
    if (transitMode !== undefined) dc.transitMode = transitMode;
    if (deliveryDate !== undefined) {
      if (isReturnAction) {
        dc.returnDate = deliveryDate;
        if (!dc.deliveryDate) dc.deliveryDate = deliveryDate;
      } else {
        dc.deliveryDate = deliveryDate;
      }
    }
    if (returnReason !== undefined) dc.returnReason = returnReason;
    if (Array.isArray(items) && !isReturnAction) dc.items = items;
    dc.updatedAt = new Date().toISOString();
    dc.updatedBy = admin ? admin.name : 'System';
    persistStore();
    return res.status(200).json({ success: true, message: `Delivery Challan ${id} updated successfully.`, data: dc });
  } catch (error) {
    console.error('Error in updateDeliveryChallanStatus:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update delivery challan.' });
  }
};

/**
 * GET /api/orders/available-serials
 * Returns stock products with eligible serial numbers not yet assigned to any DC.
 */
const getAvailableSerialNumbers = (req, res) => {
  try {
    const stockData = readStocks();

    // Check all currently assigned serial numbers across existing Delivery Challans
    const alreadyAssigned = new Set();
    (deliveryChallans || []).forEach((dc) => {
      (dc.items || []).forEach((it) => {
        (it.serialNumbers || []).forEach((sn) => {
          if (sn) alreadyAssigned.add(String(sn).trim().toUpperCase());
        });
      });
    });

    // Build inward transaction map for historical fallback
    const serialInwardMap = {};
    (stockData.inventoryTransactions || []).forEach((t) => {
      if (
        (t.type === 'STOCK IN' || t.event === 'Goods Receipt' || t.referenceType === 'GRN' || t.referenceType === 'GOODS_RECEIPT' || t.referenceType === 'PROD') &&
        Array.isArray(t.serialNumbers)
      ) {
        t.serialNumbers.forEach((s) => {
          if (!s) return;
          const key = String(s).trim().toUpperCase();
          if (!serialInwardMap[key]) {
            serialInwardMap[key] = {
              inwardDate: t.date || t.createdAt,
              grnReference: t.reference || t.referenceId,
              poReference: t.poReference || null,
              supplierName: t.supplierName || t.partyName || ''
            };
          }
        });
      }
    });

    const now = new Date();

    const result = (stockData.products || []).map((product) => {
      const code = product.code || product.productCode || `PROD-${product.id || '0'}`;
      const isCable = isCableProduct(product, stockData.categories, stockData.subcategories);
      if (isCable) {
        return {
          productId: product.id || '',
          productCode: code,
          productName: product.name || product.title || code,
          hsnSac: product.hsn || product.hsnSac || '8471',
          serialized: false,
          stock: Number(product.stock || 0),
          totalSerials: [],
          availableSerials: [],
          serialsMetadata: {}
        };
      }

      const isCameraOrHardware = (product.categoryId && /^(cat-000001|cat-000002|cat-000003)$/i.test(product.categoryId)) ||
        /camera|nvr|dvr|switch|sensor/i.test(product.name || '');
      const isSerialized = isCameraOrHardware || product.serialized === true;
      let rawSerials = isSerialized && Array.isArray(product.serialNumbers)
        ? product.serialNumbers
            .map((s) => String(s).trim())
            .filter((s) => s && !alreadyAssigned.has(s.toUpperCase()))
        : [];

      // FEFO (First Expired, First Out) Prioritization
      const defaultShelfLife = Number(product.shelfLifeMonths || 24);
      const serialsMetadata = {};

      rawSerials.forEach((sn) => {
        const upper = sn.toUpperCase();
        const explicitMeta = (product.serialMetadata && (product.serialMetadata[sn] || product.serialMetadata[upper])) || null;
        const txnMeta = serialInwardMap[upper] || null;

        const inwardDateStr = explicitMeta?.inwardDate || txnMeta?.inwardDate || product.createdAt || '2025-01-01T00:00:00.000Z';
        const shelfLife = Number(explicitMeta?.shelfLifeMonths || product.shelfLifeMonths || defaultShelfLife);

        let expiryDateStr = explicitMeta?.expiryDate;
        if (!expiryDateStr) {
          const inD = new Date(inwardDateStr);
          const validInD = isNaN(inD.getTime()) ? new Date('2025-01-01') : inD;
          const expD = new Date(validInD);
          expD.setMonth(expD.getMonth() + shelfLife);
          expiryDateStr = expD.toISOString().split('T')[0];
        }

        const expDate = new Date(expiryDateStr);
        const diffTime = expDate.getTime() - now.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        const monthsRemaining = Math.max(0, Math.round(diffDays / 30.4375));

        serialsMetadata[sn] = {
          serialNumber: sn,
          inwardDate: inwardDateStr ? inwardDateStr.split('T')[0] : '',
          expiryDate: expiryDateStr,
          shelfLifeMonths: shelfLife,
          monthsRemaining,
          grnReference: explicitMeta?.grnReference || txnMeta?.grnReference || 'INWARD',
          supplierName: explicitMeta?.supplierName || txnMeta?.supplierName || 'Primary Supplier',
          isPriority: false
        };
      });

      // Sort serials strictly by Expiry Date ASC (Earliest Expiry first -> FEFO)
      const sortedSerials = [...rawSerials].sort((a, b) => {
        const expA = new Date(serialsMetadata[a]?.expiryDate || '2099-12-31').getTime();
        const expB = new Date(serialsMetadata[b]?.expiryDate || '2099-12-31').getTime();
        if (expA !== expB) return expA - expB;
        return a.localeCompare(b);
      });

      if (sortedSerials.length > 0 && serialsMetadata[sortedSerials[0]]) {
        serialsMetadata[sortedSerials[0]].isPriority = true;
      }

      return {
        productId: product.id || '',
        productCode: code,
        productName: product.name || product.title || code,
        hsnSac: product.hsn || product.hsnSac || '8471',
        serialized: isSerialized,
        stock: Number(product.stock || 0),
        totalSerials: sortedSerials,
        availableSerials: sortedSerials,
        serialsMetadata
      };
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error in getAvailableSerialNumbers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch available serial numbers.'
    });
  }
};

// ==========================================
// SALES INVOICE CONTROLLER METHODS
// ==========================================

/**
 * GET /api/orders/invoices
 */
const getInvoices = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Orders & Deals', 'View')) return;
    const { search, orderId, customerId, paymentStatus } = req.query;
    let list = invoices.map((inv) => {
      if (!inv.customerId && inv.customerName) {
        const matched = customers.find((c) => c.name.toLowerCase() === inv.customerName.toLowerCase());
        if (matched) return { ...inv, customerId: matched.id };
      }
      return inv;
    });

    if (orderId) {
      list = list.filter((inv) => inv.orderId === orderId);
    }
    if (customerId) {
      list = list.filter((inv) => inv.customerId === customerId);
    }
    if (paymentStatus && paymentStatus !== 'ALL') {
      list = list.filter((inv) => inv.paymentStatus === paymentStatus);
    }

    if (search && search.trim()) {
      list = filterRecordsBySearch(list, search, [
        (inv) => inv.invoiceId,
        (inv) => inv.orderId,
        (inv) => inv.challanId,
        (inv) => inv.quotationId,
        (inv) => inv.customerName,
        (inv) => inv.customerCompany,
        (inv) => inv.company,
        (inv) => inv.contactPerson,
        (inv) => inv.phone,
        (inv) => inv.mobile,
        (inv) => inv.status,
        (inv) => inv.paymentStatus,
        (inv) => inv.paymentMode,
        (inv) => inv.gstin,
        (inv) => inv.items?.map((it) => `${it.productName || it.name || ''} ${it.sku || ''}`)
      ]);
    }

    list.sort((a, b) => {
      const aVal = String(a.invoiceId || '');
      const bVal = String(b.invoiceId || '');
      const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
      const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
      if (aNum && bNum && aNum !== bNum) return aNum - bNum;
      return aVal.localeCompare(bVal, undefined, { numeric: true });
    });

    return res.status(200).json({
      success: true,
      data: list
    });
  } catch (error) {
    console.error('Error in getInvoices:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices.'
    });
  }
};

/**
 * GET /api/orders/invoices/:id
 */
const getInvoiceById = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Orders & Deals', 'View')) return;
    const { id } = req.params;
    const invoice = invoices.find((item) => item.invoiceId === id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: `Invoice ${id} not found.`
      });
    }

    return res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Error in getInvoiceById:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice.'
    });
  }
};

/**
 * POST /api/orders/invoices
 */
const createInvoice = (req, res) => {
  try {
    const admin = adminUserFromRequest(req);
    if (!hasPermission(req, 'Orders & Deals', 'Create')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to create invoices.' });
    }

    const {
      orderId,
      challanId,
      customerId,
      customerName,
      company,
      consigneeName,
      consigneeAddress,
      consigneeGstin,
      consigneeState,
      shippingAddress,
      shippingGstin,
      shippingState,
      customerPhone,
      customerEmail,
      invoiceDate,
      dueDate,
      poNumber,
      poDate,
      dispatchThrough,
      dispatchDate,
      status,
      paymentStatus,
      paymentMode,
      remarks,
      items,
      subtotal,
      gstTotal,
      discount,
      grandTotal
    } = req.body;

    const order = orderId ? orders.find((o) => o.orderId === orderId) : null;
    if (orderId && !order) {
      return res.status(404).json({ success: false, message: `Order ${orderId} not found.` });
    }

    const customer = customerId
      ? customers.find((c) => c.id === customerId)
      : (order?.customerId
          ? customers.find((c) => c.id === order.customerId)
          : (customerName
              ? customers.find((c) => c.name.toLowerCase() === customerName.trim().toLowerCase())
              : null));

    if (!order && !customer && !customerName) {
      return res.status(400).json({ success: false, message: 'Please select or provide a Customer or linked Order.' });
    }

    const dcIdList = Array.isArray(req.body.challanIds) && req.body.challanIds.length > 0
      ? req.body.challanIds
      : (challanId ? String(challanId).split(',').map((s) => s.trim()).filter(Boolean) : []);
    const matchedDcs = deliveryChallans.filter((d) => dcIdList.includes(d.challanId));
    const dc = matchedDcs[0] || (challanId ? deliveryChallans.find((d) => d.challanId === challanId) : null);
    const quotation = (order && order.quotationId) ? quotations.find((q) => q.quotationId === order.quotationId) : null;

    const stockData = readStocks();
    let stockChanged = false;

    const isDraft = status === 'DRAFT';
    let invoiceStockDeducted = false;

    // Check if stock was already deducted upstream by linked Delivery Challan
    const isAlreadyDeducted = Boolean(
      (dc && dc.stockDeducted === true) ||
      matchedDcs.some((d) => d.stockDeducted === true) ||
      (orderId && deliveryChallans.some((d) => d.orderId === orderId && d.stockDeducted === true)) ||
      (challanId && deliveryChallans.some((d) => d.challanId === challanId && d.stockDeducted === true)) ||
      dcIdList.some((cId) => deliveryChallans.some((d) => d.challanId === cId && d.stockDeducted === true))
    );

    const now = new Date().toISOString();
    const invoiceId = generateInvoiceId();

    // Source items from body, dc, or order
    const sourceItems = (Array.isArray(items) && items.length > 0)
      ? items
      : (dc && Array.isArray(dc.items) && dc.items.length > 0)
        ? dc.items
        : (order.lineItems || []);

    // Determine if discount is shown
    const isDiscountShown = req.body.showDiscount !== undefined
      ? Boolean(req.body.showDiscount)
      : (sourceItems.some((it) => Number(it.discount !== undefined ? it.discount : (it.discountPercent || 0)) > 0) || Number(discount || 0) > 0);

    const processedItems = sourceItems.map((item) => {
      let prod = null;
      if (item.productId) prod = stockData.products.find((p) => p.id === item.productId);
      if (!prod && item.productCode) prod = stockData.products.find((p) => p.code === item.productCode);

      const qty = Number(item.quantity || 1);
      const price = Number(item.unitPrice !== undefined ? item.unitPrice : (prod?.dealerPrice || 0));
      const disc = Math.max(0, Math.min(100, Number(item.discount !== undefined ? item.discount : (item.discountPercent || 0))));
      const gstPct = Number(item.gst !== undefined ? item.gst : (prod?.gst || 18));

      const lineSub = Math.round(qty * price * 100) / 100;
      const discAmt = isDiscountShown && disc > 0 ? Math.round((lineSub * (disc / 100)) * 100) / 100 : 0;
      const taxable = Math.max(0, Math.round((lineSub - discAmt) * 100) / 100);
      const lineTax = Math.round((taxable * gstPct) / 100 * 100) / 100;
      const lineTot = Math.round((taxable + lineTax) * 100) / 100;

      const isCable = isCableProduct(item, stockData.categories, stockData.subcategories) || isCableProduct(prod, stockData.categories, stockData.subcategories);
      const isItemSerialized = !isCable && Boolean(
        prod?.serialized ||
        item.isSerialized ||
        item.serialized ||
        (Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0)
      );

      return {
        productId: item.productId || prod?.id || '',
        productCode: item.productCode || prod?.code || '',
        productName: item.productName || item.name || prod?.name || 'Product',
        productDetails: item.productDetails || prod?.productDetails || prod?.description || '',
        hsnSac: item.hsnSac || prod?.hsnSac || '85258090',
        quantity: qty,
        unit: (item.unit && item.unit !== 'Piece') ? item.unit : ((prod?.unit && prod?.unit !== 'Piece') ? prod.unit : 'Nos'),
        unitPrice: price,
        discount: disc,
        discountAmount: discAmt,
        taxableAmount: taxable,
        gst: gstPct,
        lineSubtotal: lineSub,
        lineTax: lineTax,
        lineTotal: lineTot,
        isSerialized: isItemSerialized,
        serialNumbers: isCable ? [] : (Array.isArray(item.serialNumbers) ? item.serialNumbers.filter(Boolean) : [])
      };
    });

    // Strict Serial Quantity Validation (Prompt Section 8):
    // For every serialized product, serialNumbers.length MUST exactly equal quantity.
    for (const it of processedItems) {
      let prod = null;
      if (it.productId) prod = (stockData.products || []).find((p) => p.id === it.productId);
      if (!prod && it.productCode) prod = (stockData.products || []).find((p) => p.code === it.productCode);

      const isCable = isCableProduct(it, stockData.categories, stockData.subcategories) || isCableProduct(prod, stockData.categories, stockData.subcategories);
      if (isCable) {
        it.isSerialized = false;
        it.serialNumbers = [];
        continue;
      }

      const isSerialized = Boolean(
        prod?.serialized ||
        it.isSerialized ||
        it.serialized ||
        (Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0)
      );
      const qty = Number(it.quantity || 1);
      const serials = Array.isArray(it.serialNumbers)
        ? it.serialNumbers.map((s) => String(s || '').trim()).filter(Boolean)
        : [];

      if (isSerialized) {
        if (serials.length !== qty) {
          return res.status(400).json({
            success: false,
            message: `${qty} serial numbers are required for quantity ${qty} (${it.productName || prod?.name || 'item'}).`
          });
        }

        // Validate uniqueness within item
        const seen = new Set();
        for (const s of serials) {
          const sLower = s.toLowerCase();
          if (seen.has(sLower)) {
            return res.status(400).json({
              success: false,
              message: `Duplicate serial number "${s}" specified for ${it.productName || prod?.name || 'item'}.`
            });
          }
          seen.add(sLower);
        }
      } else {
        it.serialNumbers = [];
      }
    }

    // If not draft and stock not previously deducted, atomically validate and deduct stock
    if (!isDraft) {
      if (isAlreadyDeducted) {
        invoiceStockDeducted = true;
      } else {
        const deductionResult = deductItemsStock(processedItems, stockData);
        if (deductionResult.error) {
          return res.status(400).json({ success: false, message: deductionResult.error });
        }
        if (deductionResult.deducted) {
          stockChanged = true;
          invoiceStockDeducted = true;
          if (!Array.isArray(stockData.inventoryTransactions)) stockData.inventoryTransactions = [];
          const txnDate = invoiceDate || now;
          const custLabel = (order?.customerName || customer?.name || customerName || '').trim();
          processedItems.forEach((it) => {
            const p = stockData.products.find((x) => x.id === it.productId || x.code === it.productCode);
            if (p) {
              stockData.inventoryTransactions.push({
                id: `TXN-INV-${invoiceId}-${p.code}-${Date.now()}`,
                productId: p.id,
                productCode: p.code,
                productName: p.name,
                date: txnDate,
                event: 'Sales Invoice',
                reference: invoiceId,
                referenceType: 'INV',
                quantity: -Number(it.quantity || 1),
                stockAfter: p.stock,
                serialNumbers: Array.isArray(it.serialNumbers) ? it.serialNumbers : [],
                remarks: custLabel ? `Billed to ${custLabel}` : 'Issued Sales Invoice'
              });
            }
          });
        }
      }
    }

    if (stockChanged) {
      writeStocks(stockData);
    }

    let calculatedGross = 0;
    let calculatedDiscAmt = 0;
    let calculatedTaxable = 0;
    let calculatedTax = 0;
    processedItems.forEach((it) => {
      calculatedGross += it.lineSubtotal;
      calculatedDiscAmt += it.discountAmount;
      calculatedTaxable += it.taxableAmount;
      calculatedTax += it.lineTax;
    });

    const finalSubtotal = Number(calculatedGross.toFixed(2));
    const finalDiscount = Number(calculatedDiscAmt.toFixed(2));
    const finalTaxable = Number(calculatedTaxable.toFixed(2));
    const finalGst = Number(calculatedTax.toFixed(2));
    const calculatedTotal = Number((finalTaxable + finalGst).toFixed(2));

    const roundOffEnabled = req.body.roundOffEnabled !== undefined ? Boolean(req.body.roundOffEnabled) : true;
    let finalRoundOff = 0;
    let finalGrandTotal = calculatedTotal;

    if (roundOffEnabled && calculatedTotal > 0) {
      finalGrandTotal = Math.floor(calculatedTotal + 1e-9) + 1;
      finalRoundOff = Number((finalGrandTotal - calculatedTotal).toFixed(2));
    } else if (req.body.grandTotal !== undefined && Number(req.body.grandTotal) > 0) {
      finalGrandTotal = Number(req.body.grandTotal);
      finalRoundOff = Number((finalGrandTotal - calculatedTotal).toFixed(2));
    }

    const custAddress = customer?.address ? `${customer.address}${customer.city ? ', ' + customer.city : ''}` : '';

    // Sanitize Customer PO Reference: Never default to orderId or invoiceId
    let cleanPoNumber = '';
    const rawPo = poNumber || order?.poNumber;
    if (
      rawPo &&
      rawPo !== order?.orderId &&
      !String(rawPo).startsWith('ORD-') &&
      rawPo !== invoiceId &&
      !String(rawPo).startsWith('INV-')
    ) {
      cleanPoNumber = String(rawPo).trim();
    }
    const cleanPoDate = cleanPoNumber ? (poDate || (order?.createdAt ? order.createdAt.slice(0, 10) : '')) : '';

    const liveCompany = readCompanySettingsSnapshot();
    const companySnapshot = {
      name: liveCompany.companyName || 'Active System Integration',
      companyName: liveCompany.companyName || 'Active System Integration',
      address: liveCompany.address || 'Plot No. 10A, Perumal Kovil Street, Sivabootham, Vanagaram, Chennai - 600095',
      phone: liveCompany.phone || '9171126666',
      email: liveCompany.email || 'admin@asi.ind.in',
      website: liveCompany.website || 'https://asiind.com/',
      gstin: liveCompany.gstin || '33AZPPS7068A1Z4',
      state: liveCompany.state || 'Tamil Nadu',
      logoUrl: liveCompany.logoUrl !== undefined ? liveCompany.logoUrl : null,
      signatureUrl: liveCompany.signatureUrl !== undefined ? liveCompany.signatureUrl : null,
      sealUrl: liveCompany.sealUrl !== undefined ? liveCompany.sealUrl : null
    };

    const finalBankDetails = req.body.bankDetails || {
      accountName: liveCompany.accountName || 'ACTIVE SYSTEM INTEGRATION',
      bankName: liveCompany.bankName || 'HDFC BANK',
      accountNumber: liveCompany.accountNumber || '50200028741215',
      accountNo: liveCompany.accountNumber || '50200028741215',
      ifscCode: liveCompany.ifscCode || 'HDFC0000024',
      ifsc: liveCompany.ifscCode || 'HDFC0000024',
      branch: liveCompany.branch || 'ANNA NAGAR, CHENNAI'
    };

    const newInvoice = {
      invoiceId,
      orderId: order ? order.orderId : (dcIdList.length > 0 ? `ORD-${dcIdList[0].replace('DC-', '')}` : (challanId ? `ORD-${challanId.replace('DC-', '')}` : `ORD-INV-${invoiceId.replace('INV-', '')}`)),
      challanId: dcIdList.length > 0 ? dcIdList.join(', ') : (challanId || (order?.challanIds && order.challanIds[0]) || (dc?.challanId || null)),
      challanIds: dcIdList.length > 0 ? dcIdList : (challanId ? [challanId] : []),
      challanDate: dc ? (dc.deliveryDate || dc.createdAt.slice(0, 10)) : '',
      enquiryId: order?.enquiryId || '',
      quotationId: order?.quotationId || '',
      quotationDate: quotation?.createdAt ? quotation.createdAt.slice(0, 10) : '',
      poNumber: cleanPoNumber,
      poDate: cleanPoDate,
      dispatchThrough: dispatchThrough || dc?.dispatchDetails || 'Surface Courier',
      dispatchDate: dispatchDate || dc?.deliveryDate || invoiceDate || now.slice(0, 10),
      customerId: customer?.id || customerId || order?.customerId || '',
      customerName: customerName || customer?.name || order?.customerName || '',
      company: company || customer?.company || order?.company || '',
      consigneeName: consigneeName || company || customerName || customer?.company || customer?.name || '',
      consigneeAddress: consigneeAddress || custAddress || (order?.deliveryAddress || ''),
      consigneeGstin: consigneeGstin || customer?.gstin || '',
      consigneeState: consigneeState || customer?.state || (consigneeGstin?.startsWith('33') || customer?.gstin?.startsWith('33') ? 'Tamil Nadu' : (customer?.state || 'Tamil Nadu')),
      shippingAddress: shippingAddress || customer?.shippingAddress || dc?.deliveryAddress || consigneeAddress || custAddress || 'Same as Consignee Address',
      shippingGstin: shippingGstin || customer?.shippingGstin || consigneeGstin || customer?.gstin || '',
      shippingState: shippingState || customer?.shippingState || consigneeState || customer?.state || 'Tamil Nadu',
      customerPhone: customerPhone || customer?.mobile || '',
      customerEmail: customerEmail || customer?.email || '',
      invoiceDate: invoiceDate || now.slice(0, 10),
      dueDate: dueDate || '',
      showDiscount: isDiscountShown,
      roundOffEnabled,
      roundOff: finalRoundOff,
      subtotal: finalSubtotal,
      totalDiscount: finalDiscount,
      discountTotal: finalDiscount,
      discount: finalDiscount,
      taxableSubtotal: finalTaxable,
      taxableAmount: finalTaxable,
      gstTotal: finalGst,
      taxTotal: finalGst,
      calculatedTotal,
      grandTotal: finalGrandTotal,
      status: status || 'ISSUED',
      stockDeducted: invoiceStockDeducted,
      paymentStatus: paymentStatus || 'PENDING',
      paymentMode: paymentMode || 'Bank Transfer',
      remarks: remarks ? remarks.trim() : (dc ? `Billing against Delivery Challan ${dc.challanId}` : ''),
      items: processedItems,
      bankDetails: finalBankDetails,
      companyDetails: companySnapshot,
      createdAt: now,
      createdBy: admin ? admin.name : 'System'
    };

    invoices.unshift(newInvoice);

    // Track invoice on order and challan
    if (order) {
      if (!Array.isArray(order.invoiceIds)) order.invoiceIds = [];
      order.invoiceIds.push(invoiceId);
    }

    if (matchedDcs.length > 0) {
      matchedDcs.forEach((d) => {
        d.invoiceId = invoiceId;
      });
    } else if (dc) {
      dc.invoiceId = invoiceId;
    }

    persistStore();

    return res.status(201).json({
      success: true,
      message: `Invoice ${invoiceId} created successfully.`,
      data: newInvoice
    });
  } catch (error) {
    console.error('Error in createInvoice:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create invoice.'
    });
  }
};

/**
 * PATCH /api/orders/invoices/:id/payment
 */
const updateInvoicePayment = (req, res) => {
  try {
    const admin = adminUserFromRequest(req);
    if (!hasPermission(req, 'Orders & Deals', 'Edit') && !hasPermission(req, 'Orders & Deals', 'Create')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to update invoice payment status.' });
    }

    const { id } = req.params;
    const { paymentStatus, paymentMode, paymentDate, remarks } = req.body;

    const invoice = invoices.find((inv) => inv.invoiceId === id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: `Invoice ${id} not found.` });
    }

    if (paymentStatus) invoice.paymentStatus = paymentStatus;
    if (paymentMode) invoice.paymentMode = paymentMode;
    if (paymentDate) invoice.paymentDate = paymentDate;
    if (remarks) invoice.paymentRemarks = remarks;

    invoice.updatedAt = new Date().toISOString();
    invoice.updatedBy = admin ? admin.name : 'System';

    persistStore();

    return res.status(200).json({
      success: true,
      message: `Invoice ${id} payment status updated to ${invoice.paymentStatus}.`,
      data: invoice
    });
  } catch (error) {
    console.error('Error in updateInvoicePayment:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update invoice payment.'
    });
  }
};

/**
 * PATCH /api/orders/invoices/:id/status
 */
const updateInvoiceStatus = (req, res) => {
  try {
    const admin = adminUserFromRequest(req);
    if (!hasPermission(req, 'Orders & Deals', 'Edit') && !hasPermission(req, 'Orders & Deals', 'Create')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to update invoice status.' });
    }

    const { id } = req.params;
    const { status, remarks } = req.body;

    const invoice = invoices.find((inv) => inv.invoiceId === id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: `Invoice ${id} not found.` });
    }

    // Check if transitioning from DRAFT to committed/issued state
    const isBecomingCommitted = status && status !== 'DRAFT' && invoice.status === 'DRAFT' && !invoice.stockDeducted;
    if (isBecomingCommitted) {
      const linkedDc = invoice.challanId ? deliveryChallans.find((d) => d.challanId === invoice.challanId) : null;
      const isAlreadyDeducted = Boolean(linkedDc && linkedDc.stockDeducted);

      if (!isAlreadyDeducted) {
        const stockData = readStocks();
        const deductionResult = deductItemsStock(invoice.items || [], stockData);
        if (deductionResult.error) {
          return res.status(400).json({ success: false, message: deductionResult.error });
        }
        if (!Array.isArray(stockData.inventoryTransactions)) stockData.inventoryTransactions = [];
        const txnDate = invoice.invoiceDate || new Date().toISOString();
        const custLabel = (invoice.customerName || '').trim();
        (invoice.items || []).forEach((it) => {
          const p = stockData.products.find((x) => x.id === it.productId || x.code === it.productCode);
          if (p) {
            stockData.inventoryTransactions.push({
              id: `TXN-INV-${id}-${p.code}-${Date.now()}`,
              productId: p.id,
              productCode: p.code,
              productName: p.name,
              date: txnDate,
              event: 'Sales Invoice',
              reference: id,
              referenceType: 'INV',
              quantity: -Number(it.quantity || 1),
              stockAfter: p.stock,
              serialNumbers: Array.isArray(it.serialNumbers) ? it.serialNumbers : [],
              remarks: custLabel ? `Billed to ${custLabel}` : 'Issued Sales Invoice'
            });
          }
        });
        writeStocks(stockData);
      }
      invoice.stockDeducted = true;
    }

    if (status) invoice.status = status;
    if (remarks !== undefined) invoice.remarks = remarks;

    invoice.updatedAt = new Date().toISOString();
    invoice.updatedBy = admin ? admin.name : 'System';

    persistStore();

    return res.status(200).json({
      success: true,
      message: `Invoice ${id} status updated to ${invoice.status || status}.`,
      data: invoice
    });
  } catch (error) {
    console.error('Error in updateInvoiceStatus:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to update invoice status.'
    });
  }
};

// ============================================================
// PROFORMA INVOICE MODULE CONTROLLER
// ============================================================

const checkProformaExpirations = () => {
  const today = new Date().toISOString().slice(0, 10);
  let changed = false;
  proformas.forEach((p) => {
    if (p.status === 'SENT' && p.validUntil && p.validUntil < today) {
      p.status = 'EXPIRED';
      p.updatedAt = new Date().toISOString();
      changed = true;
    }
  });
  if (changed) persistStore();
};

function calculateProformaTotals(items, isInterstate = false, roundOffEnabled = true, showDiscount = true) {
  let grossSubtotal = 0;
  let totalTax = 0;
  let totalDiscount = 0;

  const processedItems = (items || []).map((item, idx) => {
    const qty = Math.max(1, Number(item.quantity || 1));
    const unitPrice = Math.max(0, Number(
      item.unitPrice !== undefined && item.unitPrice !== null && item.unitPrice !== ''
        ? item.unitPrice
        : (item.rate !== undefined && item.rate !== null && item.rate !== ''
            ? item.rate
            : (item.price !== undefined && item.price !== null && item.price !== '' ? item.price : 0))
    ));
    const itemDiscountPct = Math.max(0, Math.min(100, Number(item.discount !== undefined ? item.discount : (item.discountPercent || 0))));
    const gstPct = Number(item.gst !== undefined && item.gst !== null && item.gst !== '' ? item.gst : (item.gstPct !== undefined ? item.gstPct : 18));

    const rawSubtotal = Math.round(qty * unitPrice * 100) / 100;
    const discountAmount = showDiscount && itemDiscountPct > 0 ? Math.round((rawSubtotal * (itemDiscountPct / 100)) * 100) / 100 : 0;
    const taxableValue = Math.max(0, Math.round((rawSubtotal - discountAmount) * 100) / 100);
    const lineTax = Math.round(((taxableValue * gstPct) / 100) * 100) / 100;
    const lineTotal = Math.round((taxableValue + lineTax) * 100) / 100;

    grossSubtotal += rawSubtotal;
    totalTax += lineTax;
    totalDiscount += discountAmount;

    return {
      sl: item.sl || (idx + 1),
      productId: item.productId || '',
      productCode: item.productCode || item.sku || '',
      productName: item.productName || item.name || 'Product',
      productDetails: item.productDetails || item.description || '',
      hsnSac: item.hsnSac || item.hsn || '85258090',
      quantity: qty,
      unit: (item.unit && item.unit !== 'Piece') ? item.unit : 'Nos',
      unitPrice,
      rate: unitPrice,
      discount: itemDiscountPct,
      discountAmount,
      lineSubtotal: rawSubtotal,
      taxableValue,
      gst: gstPct,
      gstPct,
      lineTax,
      tax: lineTax,
      lineTotal,
      amount: lineTotal,
      isSerialized: Boolean(item.isSerialized || (Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0)),
      serialNumbers: Array.isArray(item.serialNumbers) ? item.serialNumbers : []
    };
  });

  grossSubtotal = Math.round(grossSubtotal * 100) / 100;
  totalTax = Math.round(totalTax * 100) / 100;
  totalDiscount = Math.round(totalDiscount * 100) / 100;
  const taxableSubtotal = Math.max(0, Math.round((grossSubtotal - totalDiscount) * 100) / 100);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isInterstate) {
    igst = totalTax;
  } else {
    cgst = Math.round((totalTax / 2) * 100) / 100;
    sgst = Math.round((totalTax - cgst) * 100) / 100;
  }

  const calculatedTotal = Math.round((taxableSubtotal + totalTax) * 100) / 100;
  let roundOff = 0;
  let grandTotal = calculatedTotal;

  // Exact Canonical Round-Off Rule:
  // When Round Off Total is enabled, always move positive calculated total to NEXT whole number:
  // Math.floor(calculatedTotal + 1e-9) + 1. roundOffAmount = grandTotal - calculatedTotal (never negative).
  if (roundOffEnabled && calculatedTotal > 0) {
    grandTotal = Math.floor(calculatedTotal + 1e-9) + 1;
    roundOff = Math.round((grandTotal - calculatedTotal) * 100) / 100;
  } else {
    grandTotal = calculatedTotal;
    roundOff = 0;
  }

  return {
    processedItems,
    subtotal: grossSubtotal,
    grossSubtotal,
    totalDiscount,
    discountTotal: totalDiscount,
    taxableSubtotal,
    taxableAmount: taxableSubtotal,
    cgst,
    sgst,
    igst,
    gstTotal: totalTax,
    taxTotal: totalTax,
    calculatedTotal,
    roundOffEnabled: Boolean(roundOffEnabled),
    roundOff,
    roundOffAmount: roundOff,
    grandTotal
  };
}

const getProformas = async (req, res) => {
  try {
    checkProformaExpirations();
    const { status, customerId, search, showAllRevisions } = req.query;

    let result = [...proformas];

    // By default group by proformaId and show latest revision
    if (showAllRevisions !== 'true') {
      const latestMap = new Map();
      result.forEach((p) => {
        const key = p.proformaId || p.id;
        const existing = latestMap.get(key);
        if (!existing || (p.revisionNumber || 1) > (existing.revisionNumber || 1)) {
          latestMap.set(key, p);
        }
      });
      result = Array.from(latestMap.values());
    }

    if (status && status !== 'ALL') {
      result = result.filter((p) => (p.status || '').toUpperCase() === status.toUpperCase());
    }

    if (customerId) {
      result = result.filter((p) => p.customerId === customerId);
    }

    if (search && search.trim()) {
      result = filterRecordsBySearch(result, search, [
        (p) => p.proformaId,
        (p) => p.quotationId,
        (p) => p.orderId,
        (p) => p.customerPoNumber,
        (p) => p.customerName,
        (p) => p.customerCompany,
        (p) => p.company,
        (p) => p.contactPerson,
        (p) => p.phone,
        (p) => p.mobile,
        (p) => p.status,
        (p) => p.items?.map((it) => `${it.productName || it.name || ''} ${it.sku || ''}`)
      ]);
    }

    result.sort((a, b) => {
      const aVal = String(a.proformaId || '');
      const bVal = String(b.proformaId || '');
      const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
      const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
      if (aNum && bNum && aNum !== bNum) return aNum - bNum;
      return aVal.localeCompare(bVal, undefined, { numeric: true });
    });

    return res.status(200).json({
      success: true,
      count: result.length,
      data: result
    });
  } catch (error) {
    console.error('Error fetching proformas:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch proforma invoices.' });
  }
};

const getProformaById = async (req, res) => {
  try {
    checkProformaExpirations();
    const { id } = req.params;

    let proforma = proformas.find((p) => p.revisionId === id || p.id === id);
    if (!proforma) {
      const matches = proformas.filter((p) => p.proformaId === id);
      if (matches.length > 0) {
        matches.sort((a, b) => (b.revisionNumber || 1) - (a.revisionNumber || 1));
        proforma = matches[0];
      }
    }

    if (!proforma) {
      return res.status(404).json({ success: false, message: `Proforma Invoice ${id} not found.` });
    }

    const allRevisions = proformas
      .filter((p) => p.proformaId === proforma.proformaId)
      .sort((a, b) => (a.revisionNumber || 1) - (b.revisionNumber || 1));

    return res.status(200).json({
      success: true,
      data: {
        ...proforma,
        revisions: allRevisions
      }
    });
  } catch (error) {
    console.error('Error fetching proforma by id:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch proforma invoice.' });
  }
};

const createProforma = async (req, res) => {
  try {
    const admin = adminUserFromRequest(req);
    const {
      customerId,
      customerName,
      company,
      contactPerson,
      customerPhone,
      customerEmail,
      consigneeName,
      consigneeAddress,
      consigneeGstin,
      consigneeState,
      shippingAddress,
      shippingGstin,
      shippingState,
      proformaDate,
      validUntil,
      quotationId,
      quotationDate,
      orderId,
      orderDate,
      customerPoNumber,
      customerPoDate,
      dcNo,
      dcDate,
      dispatchThrough,
      dispatchDate,
      paymentTerms,
      deliveryTerms,
      validityNotes,
      remarks,
      items
    } = req.body;

    if (!customerId && !customerName) {
      return res.status(400).json({ success: false, message: 'Customer is required.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one line item is required.' });
    }

    const matchedCustomer = customerId ? customers.find((c) => c.id === customerId) : null;
    const finalCustName = customerName || matchedCustomer?.name || '';
    const finalCompany = company || matchedCustomer?.company || '';
    const finalPhone = customerPhone || matchedCustomer?.mobile || '';
    const finalEmail = customerEmail || matchedCustomer?.email || '';
    const finalContact = contactPerson || matchedCustomer?.contactPerson || finalCustName;

    // Normalized delivery challan list in outer scope
    const proformaDcList = Array.isArray(req.body.dcNos)
      ? req.body.dcNos
      : (Array.isArray(req.body.challanIds)
          ? req.body.challanIds
          : (dcNo ? String(dcNo).split(',').map((s) => s.trim()).filter(Boolean) : []));

    // Validate customer compatibility for linked documents
    const targetCustId = customerId || matchedCustomer?.id;
    if (targetCustId) {
      if (quotationId) {
        const matchedQuote = quotations.find((q) => q.quotationId === quotationId || q.id === quotationId);
        if (matchedQuote && matchedQuote.customerId && matchedQuote.customerId !== targetCustId) {
          return res.status(400).json({
            success: false,
            message: `Quotation "${quotationId}" belongs to a different customer (${matchedQuote.customerName || matchedQuote.customerId}) and cannot be linked to this Proforma.`
          });
        }
      }
      if (orderId) {
        const matchedOrd = orders.find((o) => o.orderId === orderId || o.id === orderId);
        if (matchedOrd && matchedOrd.customerId && matchedOrd.customerId !== targetCustId) {
          return res.status(400).json({
            success: false,
            message: `Order "${orderId}" belongs to a different customer (${matchedOrd.customerName || matchedOrd.customerId}) and cannot be linked to this Proforma.`
          });
        }
      }
      if (proformaDcList.length > 0) {
        for (const singleDcNo of proformaDcList) {
          const matchedDc = deliveryChallans.find((d) => d.challanId === singleDcNo || d.id === singleDcNo);
          if (matchedDc && matchedDc.customerId && matchedDc.customerId !== targetCustId) {
            return res.status(400).json({
              success: false,
              message: `Delivery Challan "${singleDcNo}" belongs to a different customer (${matchedDc.customerName || matchedDc.customerId}) and cannot be linked to this Proforma.`
            });
          }
        }
      }
    }

    // Provenance tracking across upstream records (Enquiry -> Quotation -> Order -> DC)
    let linkedEnquiryId = req.body.enquiryId || null;
    let linkedQuotationNumber = quotationId || null;
    if (quotationId) {
      const matchedQuote = quotations.find((q) => q.quotationId === quotationId || q.id === quotationId);
      if (matchedQuote) {
        if (!linkedEnquiryId && matchedQuote.enquiryId) {
          linkedEnquiryId = matchedQuote.enquiryId;
        }
        if (!linkedQuotationNumber && (matchedQuote.quotationNumber || matchedQuote.quotationId)) {
          linkedQuotationNumber = matchedQuote.quotationNumber || matchedQuote.quotationId;
        }
      }
    }
    if (!linkedEnquiryId && orderId) {
      const matchedOrd = orders.find((o) => o.orderId === orderId || o.id === orderId);
      if (matchedOrd && matchedOrd.enquiryId) {
        linkedEnquiryId = matchedOrd.enquiryId;
      }
    }
    if (!linkedEnquiryId && dcNo) {
      const matchedDc = deliveryChallans.find((d) => d.challanId === dcNo || d.id === dcNo);
      if (matchedDc && matchedDc.enquiryId) {
        linkedEnquiryId = matchedDc.enquiryId;
      }
    }

    const custAddress = matchedCustomer?.address
      ? `${matchedCustomer.address}${matchedCustomer.city ? ', ' + matchedCustomer.city : ''}`
      : '';

    const finalConsigneeName = consigneeName || finalCompany || finalCustName;
    const finalConsigneeAddress = consigneeAddress || matchedCustomer?.billingAddress || custAddress || '';
    const finalConsigneeGstin = consigneeGstin || matchedCustomer?.gstin || '';
    const finalConsigneeState = consigneeState || matchedCustomer?.state || 'Tamil Nadu';

    const finalShippingAddress = shippingAddress || matchedCustomer?.shippingAddress || finalConsigneeAddress || '';
    const finalShippingGstin = shippingGstin || matchedCustomer?.shippingGstin || finalConsigneeGstin || '';
    const finalShippingState = shippingState || matchedCustomer?.shippingState || finalConsigneeState || 'Tamil Nadu';

    const isInterstate = !((finalShippingState || '').toLowerCase().includes('tamil nadu') || (finalConsigneeState || '').toLowerCase().includes('tamil nadu'));

    const stockData = readStocks();
    const preparedItems = items.map((it) => {
      let prod = null;
      if (it.productId) prod = stockData.products.find((p) => p.id === it.productId);
      if (!prod && it.productCode) prod = stockData.products.find((p) => p.code === it.productCode);

      const extractedRate = (it.unitPrice !== undefined && it.unitPrice !== null && it.unitPrice !== '')
        ? Number(it.unitPrice)
        : ((it.rate !== undefined && it.rate !== null && it.rate !== '')
            ? Number(it.rate)
            : ((it.price !== undefined && it.price !== null && it.price !== '')
                ? Number(it.price)
                : (prod?.dealerPrice !== undefined ? Number(prod.dealerPrice) : (prod?.price !== undefined ? Number(prod.price) : (prod?.mrp !== undefined ? Number(prod.mrp) : 0)))));

      const isCable = isCableProduct(it, stockData.categories, stockData.subcategories) || isCableProduct(prod, stockData.categories, stockData.subcategories);
      const isItemSerialized = !isCable && Boolean(
        it.isSerialized ||
        (Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0) ||
        (Array.isArray(prod?.serialNumbers) && prod.serialNumbers.length > 0)
      );

      const resolvedSerials = isCable
        ? []
        : (Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0
            ? it.serialNumbers
            : (Array.isArray(prod?.serialNumbers) && prod.serialNumbers.length > 0
                ? prod.serialNumbers.slice(0, Number(it.quantity || 1))
                : []));

      return {
        ...it,
        productId: it.productId || prod?.id || '',
        productCode: it.productCode || prod?.code || '',
        productName: it.productName || it.name || prod?.name || 'Product',
        productDetails: it.productDetails || prod?.productDetails || prod?.description || '',
        hsnSac: it.hsnSac || prod?.hsnSac || '85258090',
        unit: (it.unit && it.unit !== 'Piece') ? it.unit : ((prod?.unit && prod?.unit !== 'Piece') ? prod.unit : 'Nos'),
        unitPrice: extractedRate,
        rate: extractedRate,
        discount: it.discount !== undefined ? Number(it.discount) : (it.discountPercent !== undefined ? Number(it.discountPercent) : 0),
        gst: it.gst !== undefined ? Number(it.gst) : (prod?.gst || 18),
        isSerialized: isItemSerialized,
        serialNumbers: resolvedSerials
      };
    });

    const showDiscount = req.body.showDiscount !== undefined
      ? Boolean(req.body.showDiscount)
      : preparedItems.some((i) => Number(i.discount || 0) > 0);
    const roundOffEnabled = req.body.roundOffEnabled !== undefined ? Boolean(req.body.roundOffEnabled) : true;
    const {
      processedItems,
      subtotal,
      totalDiscount,
      discountTotal,
      taxableSubtotal,
      taxableAmount,
      cgst,
      sgst,
      igst,
      gstTotal,
      taxTotal,
      calculatedTotal,
      roundOff,
      roundOffAmount,
      grandTotal
    } = calculateProformaTotals(preparedItems, isInterstate, roundOffEnabled, showDiscount);

    const now = new Date();
    const nowIso = now.toISOString();
    const todayStr = nowIso.slice(0, 10);
    const defaultExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const proformaId = generateProformaId();
    const revisionNumber = 1;
    const revisionId = `${proformaId}-R1`;

    const liveCompany = readCompanySettingsSnapshot();
    const companySnapshot = {
      name: liveCompany.companyName || 'Active System Integration',
      companyName: liveCompany.companyName || 'Active System Integration',
      address: liveCompany.address || 'Plot No. 10A, Perumal Kovil Street, Sivabootham, Vanagaram, Chennai - 600095',
      phone: liveCompany.phone || '9171126666',
      email: liveCompany.email || 'admin@asi.ind.in',
      website: liveCompany.website || 'https://asiind.com/',
      gstin: liveCompany.gstin || '33AZPPS7068A1Z4',
      state: liveCompany.state || 'Tamil Nadu',
      logoUrl: liveCompany.logoUrl !== undefined ? liveCompany.logoUrl : null,
      signatureUrl: liveCompany.signatureUrl !== undefined ? liveCompany.signatureUrl : null,
      sealUrl: liveCompany.sealUrl !== undefined ? liveCompany.sealUrl : null,
      proformaNote: liveCompany.proformaNote || 'Kindly verify item model/specifications before release of PO/payment.'
    };

    const finalBankDetails = req.body.bankDetails || {
      accountName: liveCompany.accountName || 'ACTIVE SYSTEM INTEGRATION',
      bankName: liveCompany.bankName || 'HDFC BANK',
      accountNumber: liveCompany.accountNumber || '50200028741215',
      accountNo: liveCompany.accountNumber || '50200028741215',
      ifscCode: liveCompany.ifscCode || 'HDFC0000024',
      ifsc: liveCompany.ifscCode || 'HDFC0000024',
      branch: liveCompany.branch || 'ANNA NAGAR, CHENNAI'
    };

    const newProforma = {
      proformaId,
      revisionNumber,
      revisionId,
      isLatest: true,
      status: req.body.status || 'DRAFT',

      proformaDate: proformaDate || todayStr,
      validUntil: validUntil || defaultExpiry,
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: admin ? admin.name : 'System',
      updatedBy: admin ? admin.name : 'System',

      customerId: customerId || matchedCustomer?.id || '',
      customerName: finalCustName,
      company: finalCompany,
      contactPerson: finalContact,
      customerPhone: finalPhone,
      customerEmail: finalEmail,

      consigneeName: finalConsigneeName,
      consigneeAddress: finalConsigneeAddress,
      consigneeGstin: finalConsigneeGstin,
      consigneeState: finalConsigneeState,

      shippingAddress: finalShippingAddress,
      shippingGstin: finalShippingGstin,
      shippingState: finalShippingState,
      isInterstate,

      enquiryId: linkedEnquiryId,
      quotationId: quotationId || null,
      quotationNumber: linkedQuotationNumber,
      quotationDate: quotationDate || null,
      orderId: orderId || null,
      orderDate: orderDate || null,
      customerPoNumber: customerPoNumber || null,
      customerPoDate: customerPoDate || null,
      dcNo: proformaDcList.length > 0 ? proformaDcList.join(', ') : (dcNo || req.body.dcNo || null),
      deliveryChallanId: proformaDcList.length > 0 ? proformaDcList.join(', ') : (dcNo || req.body.deliveryChallanId || null),
      dcNos: proformaDcList.length > 0 ? proformaDcList : (dcNo ? [dcNo] : []),
      dcDate: dcDate || req.body.dcDate || null,
      dispatchThrough: dispatchThrough || req.body.dispatchThrough || null,
      dispatchDate: dispatchDate || req.body.dispatchDate || null,

      paymentTerms: paymentTerms || liveCompany.paymentTerms || '100% ADVANCE PAYMENT',
      deliveryTerms: deliveryTerms || liveCompany.deliveryTerms || 'EX-STOCK / 1-2 WEEKS',
      validityNotes: validityNotes || liveCompany.validityTerms || '15 DAYS FROM INVOICE DATE',
      proformaNote: req.body.proformaNote || liveCompany.proformaNote || 'Kindly verify item model/specifications before release of PO/payment.',
      remarks: remarks || '',

      showDiscount: Boolean(showDiscount),
      items: processedItems,
      subtotal,
      totalDiscount,
      discountTotal: totalDiscount,
      taxableSubtotal,
      taxableAmount: taxableSubtotal,
      cgst,
      sgst,
      igst,
      gstTotal,
      taxTotal,
      calculatedTotal,
      roundOffEnabled: Boolean(roundOffEnabled),
      roundOff,
      roundOffAmount,
      grandTotal,

      stockDeducted: false,

      companyDetails: companySnapshot,
      bankDetails: finalBankDetails
    };

    proformas.unshift(newProforma);
    persistStore();

    return res.status(201).json({
      success: true,
      message: 'Proforma Invoice created successfully.',
      data: newProforma
    });
  } catch (error) {
    console.error('Error creating proforma:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to create proforma invoice.' });
  }
};

const updateProforma = async (req, res) => {
  try {
    const admin = adminUserFromRequest(req);
    const { id } = req.params;

    const proforma = proformas.find((p) => p.revisionId === id || p.proformaId === id || p.id === id);
    if (!proforma) {
      return res.status(404).json({ success: false, message: `Proforma ${id} not found.` });
    }

    if (proforma.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: `Only DRAFT proforma invoices can be edited directly. Current status is ${proforma.status}. Please create a new revision.`
      });
    }

    const {
      customerId,
      customerName,
      company,
      contactPerson,
      customerPhone,
      customerEmail,
      consigneeName,
      consigneeAddress,
      consigneeGstin,
      consigneeState,
      shippingAddress,
      shippingGstin,
      shippingState,
      proformaDate,
      validUntil,
      quotationId,
      quotationDate,
      orderId,
      orderDate,
      customerPoNumber,
      customerPoDate,
      paymentTerms,
      deliveryTerms,
      validityNotes,
      remarks,
      items
    } = req.body;

    const targetCustId = customerId || proforma.customerId;
    if (targetCustId) {
      if (quotationId) {
        const matchedQuote = quotations.find((q) => q.quotationId === quotationId || q.id === quotationId);
        if (matchedQuote && matchedQuote.customerId && matchedQuote.customerId !== targetCustId) {
          return res.status(400).json({
            success: false,
            message: `Quotation "${quotationId}" belongs to a different customer (${matchedQuote.customerName || matchedQuote.customerId}) and cannot be linked to this Proforma.`
          });
        }
      }
      if (orderId) {
        const matchedOrd = orders.find((o) => o.orderId === orderId || o.id === orderId);
        if (matchedOrd && matchedOrd.customerId && matchedOrd.customerId !== targetCustId) {
          return res.status(400).json({
            success: false,
            message: `Order "${orderId}" belongs to a different customer (${matchedOrd.customerName || matchedOrd.customerId}) and cannot be linked to this Proforma.`
          });
        }
      }
      if (req.body.dcNo) {
        const matchedDc = deliveryChallans.find((d) => d.challanId === req.body.dcNo || d.id === req.body.dcNo);
        if (matchedDc && matchedDc.customerId && matchedDc.customerId !== targetCustId) {
          return res.status(400).json({
            success: false,
            message: `Delivery Challan "${req.body.dcNo}" belongs to a different customer (${matchedDc.customerName || matchedDc.customerId}) and cannot be linked to this Proforma.`
          });
        }
      }
    }

    if (customerId) proforma.customerId = customerId;
    if (customerName) proforma.customerName = customerName;
    if (company !== undefined) proforma.company = company;
    if (contactPerson !== undefined) proforma.contactPerson = contactPerson;
    if (customerPhone !== undefined) proforma.customerPhone = customerPhone;
    if (customerEmail !== undefined) proforma.customerEmail = customerEmail;

    if (consigneeName !== undefined) proforma.consigneeName = consigneeName;
    if (consigneeAddress !== undefined) proforma.consigneeAddress = consigneeAddress;
    if (consigneeGstin !== undefined) proforma.consigneeGstin = consigneeGstin;
    if (consigneeState !== undefined) proforma.consigneeState = consigneeState;

    if (shippingAddress !== undefined) proforma.shippingAddress = shippingAddress;
    if (shippingGstin !== undefined) proforma.shippingGstin = shippingGstin;
    if (shippingState !== undefined) proforma.shippingState = shippingState;

    if (proformaDate) proforma.proformaDate = proformaDate;
    if (validUntil) proforma.validUntil = validUntil;

    if (req.body.enquiryId !== undefined) proforma.enquiryId = req.body.enquiryId;
    if (quotationId !== undefined) {
      proforma.quotationId = quotationId;
      proforma.quotationNumber = quotationId;
      if (!proforma.enquiryId && quotationId) {
        const matchedQuote = quotations.find((q) => q.quotationId === quotationId || q.id === quotationId);
        if (matchedQuote && matchedQuote.enquiryId) proforma.enquiryId = matchedQuote.enquiryId;
      }
    }
    if (quotationDate !== undefined) proforma.quotationDate = quotationDate;
    if (orderId !== undefined) proforma.orderId = orderId;
    if (orderDate !== undefined) proforma.orderDate = orderDate;
    if (customerPoNumber !== undefined) proforma.customerPoNumber = customerPoNumber;
    if (customerPoDate !== undefined) proforma.customerPoDate = customerPoDate;
    const updatedDcList = req.body.dcNos !== undefined
      ? (Array.isArray(req.body.dcNos) ? req.body.dcNos : (req.body.dcNos ? [req.body.dcNos] : []))
      : (req.body.dcNo !== undefined ? (req.body.dcNo ? String(req.body.dcNo).split(',').map((s) => s.trim()).filter(Boolean) : []) : null);

    if (updatedDcList !== null) {
      proforma.dcNos = updatedDcList;
      proforma.dcNo = updatedDcList.length > 0 ? updatedDcList.join(', ') : null;
      proforma.deliveryChallanId = updatedDcList.length > 0 ? updatedDcList.join(', ') : null;
    } else if (req.body.deliveryChallanId !== undefined) {
      proforma.deliveryChallanId = req.body.deliveryChallanId;
    }
    if (req.body.dcDate !== undefined) proforma.dcDate = req.body.dcDate;
    if (req.body.dispatchThrough !== undefined) proforma.dispatchThrough = req.body.dispatchThrough;
    if (req.body.dispatchDate !== undefined) proforma.dispatchDate = req.body.dispatchDate;

    if (paymentTerms !== undefined) proforma.paymentTerms = paymentTerms;
    if (deliveryTerms !== undefined) proforma.deliveryTerms = deliveryTerms;
    if (validityNotes !== undefined) proforma.validityNotes = validityNotes;
    if (remarks !== undefined) proforma.remarks = remarks;

    const roundOffEnabled = req.body.roundOffEnabled !== undefined
      ? Boolean(req.body.roundOffEnabled)
      : (proforma.roundOffEnabled !== undefined ? Boolean(proforma.roundOffEnabled) : true);
    proforma.roundOffEnabled = roundOffEnabled;

    const isInterstate = !((proforma.shippingState || '').toLowerCase().includes('tamil nadu') || (proforma.consigneeState || '').toLowerCase().includes('tamil nadu'));
    proforma.isInterstate = isInterstate;

    const showDiscount = req.body.showDiscount !== undefined
      ? Boolean(req.body.showDiscount)
      : (proforma.showDiscount !== undefined ? Boolean(proforma.showDiscount) : true);
    proforma.showDiscount = showDiscount;

    if (Array.isArray(items) && items.length > 0) {
      const {
        processedItems,
        subtotal,
        totalDiscount,
        discountTotal,
        taxableSubtotal,
        taxableAmount,
        cgst,
        sgst,
        igst,
        gstTotal,
        taxTotal,
        calculatedTotal,
        roundOff,
        roundOffAmount,
        grandTotal
      } = calculateProformaTotals(items, isInterstate, roundOffEnabled, showDiscount);

      proforma.items = processedItems;
      proforma.subtotal = subtotal;
      proforma.totalDiscount = totalDiscount;
      proforma.discountTotal = totalDiscount;
      proforma.taxableSubtotal = taxableSubtotal;
      proforma.taxableAmount = taxableSubtotal;
      proforma.cgst = cgst;
      proforma.sgst = sgst;
      proforma.igst = igst;
      proforma.gstTotal = gstTotal;
      proforma.taxTotal = taxTotal;
      proforma.calculatedTotal = calculatedTotal;
      proforma.roundOff = roundOff;
      proforma.roundOffAmount = roundOffAmount;
      proforma.grandTotal = grandTotal;
    }

    proforma.updatedAt = new Date().toISOString();
    proforma.updatedBy = admin ? admin.name : 'System';

    persistStore();

    return res.status(200).json({
      success: true,
      message: `Proforma Invoice ${proforma.proformaId} updated successfully.`,
      data: proforma
    });
  } catch (error) {
    console.error('Error updating proforma:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update proforma invoice.' });
  }
};

const reviseProforma = async (req, res) => {
  try {
    const admin = adminUserFromRequest(req);
    const { id } = req.params;

    const existing = proformas.find((p) => p.revisionId === id || p.id === id) ||
      proformas.filter((p) => p.proformaId === id).sort((a, b) => (b.revisionNumber || 1) - (a.revisionNumber || 1))[0];

    if (!existing) {
      return res.status(404).json({ success: false, message: `Proforma Invoice ${id} not found.` });
    }

    if (existing.status === 'CANCELLED' || existing.status === 'CONVERTED') {
      return res.status(400).json({
        success: false,
        message: `Cannot revise a ${existing.status} proforma invoice.`
      });
    }

    const now = new Date();
    const nowIso = now.toISOString();

    existing.status = 'REVISED';
    existing.isLatest = false;
    existing.revisedAt = nowIso;
    existing.revisedBy = admin ? admin.name : 'System';

    const nextRevNum = (existing.revisionNumber || 1) + 1;
    const newRevisionId = `${existing.proformaId}-R${nextRevNum}`;

    const itemsToUse = (Array.isArray(req.body.items) && req.body.items.length > 0)
      ? req.body.items
      : existing.items;

    const isInterstate = Boolean(req.body.isInterstate !== undefined ? req.body.isInterstate : existing.isInterstate);
    const roundOffEnabled = req.body.roundOffEnabled !== undefined
      ? Boolean(req.body.roundOffEnabled)
      : (existing.roundOffEnabled !== undefined ? Boolean(existing.roundOffEnabled) : true);
    const showDiscount = req.body.showDiscount !== undefined
      ? Boolean(req.body.showDiscount)
      : Boolean(existing.showDiscount);

    const {
      processedItems,
      subtotal,
      totalDiscount,
      taxableSubtotal,
      cgst,
      sgst,
      igst,
      gstTotal,
      taxTotal,
      roundOff,
      roundOffAmount,
      grandTotal
    } = calculateProformaTotals(itemsToUse, isInterstate, roundOffEnabled, showDiscount);

    const newRevision = {
      ...existing,
      revisionNumber: nextRevNum,
      revisionId: newRevisionId,
      isLatest: true,
      status: 'DRAFT',
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: admin ? admin.name : 'System',
      updatedBy: admin ? admin.name : 'System',
      revisionReason: req.body.reason || req.body.revisionNotes || `Revision ${nextRevNum}`,
      previousRevisionId: existing.revisionId,
      parentProformaId: existing.proformaId,
      enquiryId: req.body.enquiryId || existing.enquiryId || null,
      quotationNumber: req.body.quotationId || existing.quotationNumber || existing.quotationId || null,
      deliveryChallanId: req.body.dcNo !== undefined ? req.body.dcNo : existing.deliveryChallanId,
      dcNo: req.body.dcNo !== undefined ? req.body.dcNo : existing.dcNo,
      dcNos: req.body.dcNos !== undefined ? (Array.isArray(req.body.dcNos) ? req.body.dcNos : [req.body.dcNos]) : (existing.dcNos || []),
      dcDate: req.body.dcDate !== undefined ? req.body.dcDate : existing.dcDate,
      dispatchThrough: req.body.dispatchThrough !== undefined ? req.body.dispatchThrough : existing.dispatchThrough,
      dispatchDate: req.body.dispatchDate !== undefined ? req.body.dispatchDate : existing.dispatchDate,

      items: processedItems,
      showDiscount,
      subtotal,
      totalDiscount,
      discountTotal: totalDiscount,
      taxableSubtotal,
      cgst,
      sgst,
      igst,
      gstTotal,
      taxTotal,
      roundOffEnabled: Boolean(roundOffEnabled),
      roundOff,
      roundOffAmount,
      grandTotal,
      stockDeducted: false
    };

    delete newRevision.revisedAt;
    delete newRevision.revisedBy;
    delete newRevision.convertedOrderId;
    delete newRevision.convertedInvoiceId;

    proformas.unshift(newRevision);
    persistStore();

    return res.status(201).json({
      success: true,
      message: `New revision Rev ${nextRevNum} created for Proforma ${existing.proformaId}.`,
      data: newRevision
    });
  } catch (error) {
    console.error('Error revising proforma:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to revise proforma invoice.' });
  }
};

const updateProformaStatus = async (req, res) => {
  try {
    const admin = adminUserFromRequest(req);
    const { id } = req.params;
    const { status, remarks } = req.body;

    const proforma = proformas.find((p) => p.revisionId === id || p.id === id) ||
      proformas.filter((p) => p.proformaId === id).sort((a, b) => (b.revisionNumber || 1) - (a.revisionNumber || 1))[0];

    if (!proforma) {
      return res.status(404).json({ success: false, message: `Proforma Invoice ${id} not found.` });
    }

    const current = proforma.status;
    const target = (status || '').toUpperCase();

    const allowedTransitions = {
      DRAFT: ['SENT', 'ACCEPTED', 'CANCELLED'],
      SENT: ['ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'REVISED'],
      ACCEPTED: ['CONVERTED', 'CANCELLED', 'REVISED'],
      REJECTED: ['REVISED', 'CANCELLED', 'DRAFT'],
      EXPIRED: ['REVISED', 'CANCELLED'],
      REVISED: [],
      CANCELLED: [],
      CONVERTED: []
    };

    if (current === target) {
      return res.status(200).json({ success: true, message: `Status is already ${target}.`, data: proforma });
    }

    if (allowedTransitions[current] && !allowedTransitions[current].includes(target)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${current} to ${target}.`
      });
    }

    proforma.status = target;
    proforma.updatedAt = new Date().toISOString();
    proforma.updatedBy = admin ? admin.name : 'System';
    if (remarks) proforma.statusRemarks = remarks;

    persistStore();

    return res.status(200).json({
      success: true,
      message: `Proforma Invoice ${proforma.proformaId} status updated to ${target}.`,
      data: proforma
    });
  } catch (error) {
    console.error('Error updating proforma status:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update proforma status.' });
  }
};

const convertProformaToOrder = async (req, res) => {
  try {
    const admin = adminUserFromRequest(req);
    const { id } = req.params;

    const proforma = proformas.find((p) => p.revisionId === id || p.id === id) ||
      proformas.filter((p) => p.proformaId === id).sort((a, b) => (b.revisionNumber || 1) - (a.revisionNumber || 1))[0];

    if (!proforma) {
      return res.status(404).json({ success: false, message: `Proforma Invoice ${id} not found.` });
    }

    if (proforma.convertedOrderId) {
      return res.status(400).json({
        success: false,
        message: `Proforma ${proforma.proformaId} has already been converted to Order ${proforma.convertedOrderId}.`
      });
    }

    const orderId = generateOrderId();
    const now = new Date().toISOString();

    const orderItems = Array.isArray(proforma.items) && proforma.items.length > 0
      ? proforma.items.map((i) => `${i.quantity}x ${i.productName}`)
      : ['Converted Products'];

    const newOrder = {
      orderId,
      proformaId: proforma.proformaId,
      proformaRevisionId: proforma.revisionId,
      enquiryId: proforma.enquiryId || null,
      quotationId: proforma.quotationId || null,
      customerPoNumber: proforma.customerPoNumber || null,
      customerPoDate: proforma.customerPoDate || null,
      customerId: proforma.customerId || '',
      customerName: proforma.customerName || '',
      company: proforma.company || '',
      amount: Number(proforma.grandTotal || 0),
      items: orderItems,
      lineItems: proforma.items || [],
      deliveryAddress: proforma.shippingAddress || proforma.consigneeAddress || '',
      status: 'CONFIRMED',
      stockDeducted: false,
      createdAt: now,
      remarks: `Converted from Proforma Invoice ${proforma.proformaId} (${proforma.revisionId}). ${req.body.remarks || ''}`.trim(),
      createdBy: admin ? admin.name : 'System'
    };

    orders.unshift(newOrder);

    proforma.status = 'CONVERTED';
    proforma.convertedOrderId = orderId;
    proforma.convertedOrderDate = now;
    proforma.updatedAt = now;
    proforma.updatedBy = admin ? admin.name : 'System';

    persistStore();

    return res.status(201).json({
      success: true,
      message: `Proforma ${proforma.proformaId} successfully converted to Sales Order ${orderId}.`,
      data: {
        order: newOrder,
        proforma
      }
    });
  } catch (error) {
    console.error('Error converting proforma to order:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to convert proforma to order.' });
  }
};

const convertProformaToInvoice = async (req, res) => {
  try {
    const admin = adminUserFromRequest(req);
    const { id } = req.params;

    const proforma = proformas.find((p) => p.revisionId === id || p.id === id) ||
      proformas.filter((p) => p.proformaId === id).sort((a, b) => (b.revisionNumber || 1) - (a.revisionNumber || 1))[0];

    if (!proforma) {
      return res.status(404).json({ success: false, message: `Proforma Invoice ${id} not found.` });
    }

    if (proforma.convertedInvoiceId) {
      return res.status(400).json({
        success: false,
        message: `Proforma ${proforma.proformaId} has already been converted to Invoice ${proforma.convertedInvoiceId}.`
      });
    }

    const invoiceId = generateInvoiceId();
    const now = new Date().toISOString();
    const invoiceStatus = req.body.status || 'ISSUED';
    const isDraft = invoiceStatus === 'DRAFT';

    const stockData = readStocks();
    let stockChanged = false;
    let invoiceStockDeducted = false;

    const sourceItems = proforma.items || [];
    const processedItems = sourceItems.map((item) => {
      let prod = null;
      if (item.productId) prod = stockData.products.find((p) => p.id === item.productId);
      if (!prod && item.productCode) prod = stockData.products.find((p) => p.code === item.productCode);

      const qty = Number(item.quantity || 1);
      const price = Number(item.unitPrice !== undefined ? item.unitPrice : (prod?.dealerPrice || 0));
      const gstPct = Number(item.gst !== undefined ? item.gst : (prod?.gst || 18));
      const lineSub = Math.round(qty * price * 100) / 100;
      const lineTax = Math.round((lineSub * gstPct) / 100 * 100) / 100;
      const lineTot = Math.round((lineSub + lineTax) * 100) / 100;

      return {
        productId: item.productId || prod?.id || '',
        productCode: item.productCode || prod?.code || '',
        productName: item.productName || prod?.name || 'Product',
        productDetails: item.productDetails || prod?.productDetails || prod?.description || '',
        hsnSac: item.hsnSac || prod?.hsnSac || '85258090',
        quantity: qty,
        unit: (item.unit && item.unit !== 'Piece') ? item.unit : ((prod?.unit && prod?.unit !== 'Piece') ? prod.unit : 'Nos'),
        unitPrice: price,
        gst: gstPct,
        lineSubtotal: lineSub,
        lineTax: lineTax,
        lineTotal: lineTot,
        serialNumbers: Array.isArray(item.serialNumbers) ? item.serialNumbers.filter(Boolean) : []
      };
    });

    if (!isDraft) {
      const deductionResult = deductItemsStock(processedItems, stockData);
      if (deductionResult.error) {
        return res.status(400).json({ success: false, message: deductionResult.error });
      }
      if (deductionResult.deducted) {
        stockChanged = true;
        invoiceStockDeducted = true;
        if (!Array.isArray(stockData.inventoryTransactions)) stockData.inventoryTransactions = [];
        const txnDate = now.slice(0, 10);
        const custLabel = (proforma.customerName || proforma.company || '').trim();
        processedItems.forEach((it) => {
          const p = stockData.products.find((x) => x.id === it.productId || x.code === it.productCode);
          if (p) {
            stockData.inventoryTransactions.push({
              id: `TXN-INV-${invoiceId}-${p.code}-${Date.now()}`,
              productId: p.id,
              productCode: p.code,
              productName: p.name,
              date: txnDate,
              event: 'Sales Invoice',
              reference: invoiceId,
              referenceType: 'INV',
              quantity: -Number(it.quantity || 1),
              stockAfter: p.stock,
              serialNumbers: Array.isArray(it.serialNumbers) ? it.serialNumbers : [],
              remarks: custLabel ? `Billed to ${custLabel} (via PI ${proforma.proformaId})` : 'Issued Sales Invoice'
            });
          }
        });
      }
    }

    if (stockChanged) {
      writeStocks(stockData);
    }

    let cleanPoNumber = '';
    const rawPo = proforma.customerPoNumber;
    if (rawPo && rawPo !== invoiceId && !String(rawPo).startsWith('INV-')) {
      cleanPoNumber = String(rawPo).trim();
    }
    const cleanPoDate = cleanPoNumber ? (proforma.customerPoDate || '') : '';

    const liveCompany = readCompanySettingsSnapshot();
    const companySnapshot = proforma.companyDetails || {
      name: liveCompany.companyName || 'Active System Integration',
      companyName: liveCompany.companyName || 'Active System Integration',
      address: liveCompany.address || 'Plot No. 10A, Perumal Kovil Street, Sivabootham, Vanagaram, Chennai - 600095',
      phone: liveCompany.phone || '9171126666',
      email: liveCompany.email || 'admin@asi.ind.in',
      website: liveCompany.website || 'https://asiind.com/',
      gstin: liveCompany.gstin || '33AZPPS7068A1Z4',
      state: liveCompany.state || 'Tamil Nadu',
      logoUrl: liveCompany.logoUrl !== undefined ? liveCompany.logoUrl : null,
      signatureUrl: liveCompany.signatureUrl !== undefined ? liveCompany.signatureUrl : null,
      sealUrl: liveCompany.sealUrl !== undefined ? liveCompany.sealUrl : null
    };

    const finalBankDetails = proforma.bankDetails || {
      accountName: liveCompany.accountName || 'ACTIVE SYSTEM INTEGRATION',
      bankName: liveCompany.bankName || 'HDFC BANK',
      accountNumber: liveCompany.accountNumber || '50200028741215',
      accountNo: liveCompany.accountNumber || '50200028741215',
      ifscCode: liveCompany.ifscCode || 'HDFC0000024',
      ifsc: liveCompany.ifscCode || 'HDFC0000024',
      branch: liveCompany.branch || 'ANNA NAGAR, CHENNAI'
    };

    const newInvoice = {
      invoiceId,
      proformaId: proforma.proformaId,
      proformaDate: proforma.proformaDate,
      orderId: proforma.orderId || `ORD-PI-${proforma.proformaId.replace('PI-', '')}`,
      challanId: null,
      challanDate: '',
      enquiryId: '',
      quotationId: proforma.quotationId || '',
      quotationDate: proforma.quotationDate || '',
      poNumber: cleanPoNumber,
      poDate: cleanPoDate,
      dispatchThrough: 'Surface Courier',
      dispatchDate: now.slice(0, 10),
      customerId: proforma.customerId,
      customerName: proforma.customerName,
      company: proforma.company,
      consigneeName: proforma.consigneeName,
      consigneeAddress: proforma.consigneeAddress,
      consigneeGstin: proforma.consigneeGstin,
      consigneeState: proforma.consigneeState,
      shippingAddress: proforma.shippingAddress,
      shippingGstin: proforma.shippingGstin,
      shippingState: proforma.shippingState,
      customerPhone: proforma.customerPhone,
      customerEmail: proforma.customerEmail,
      invoiceDate: now.slice(0, 10),
      dueDate: '',
      subtotal: Number(processedItems.reduce((sum, it) => sum + it.lineSubtotal, 0).toFixed(2)),
      gstTotal: Number(processedItems.reduce((sum, it) => sum + it.lineTax, 0).toFixed(2)),
      discount: Number(proforma.totalDiscount || proforma.discount || 0),
      grandTotal: Math.round(
        processedItems.reduce((sum, it) => sum + it.lineSubtotal, 0) +
        processedItems.reduce((sum, it) => sum + it.lineTax, 0) -
        Number(proforma.totalDiscount || proforma.discount || 0)
      ),
      status: invoiceStatus,
      stockDeducted: invoiceStockDeducted,
      paymentStatus: 'PENDING',
      paymentMode: 'Bank Transfer',
      remarks: `Converted from Proforma Invoice ${proforma.proformaId} (${proforma.revisionId}). ${req.body.remarks || ''}`.trim(),
      items: processedItems,
      bankDetails: finalBankDetails,
      companyDetails: companySnapshot,
      createdAt: now,
      createdBy: admin ? admin.name : 'System'
    };

    invoices.unshift(newInvoice);

    proforma.status = 'CONVERTED';
    proforma.convertedInvoiceId = invoiceId;
    proforma.convertedInvoiceDate = now;
    proforma.updatedAt = now;
    proforma.updatedBy = admin ? admin.name : 'System';

    persistStore();

    return res.status(201).json({
      success: true,
      message: `Proforma ${proforma.proformaId} successfully converted to Sales Invoice ${invoiceId}.`,
      data: {
        invoice: newInvoice,
        proforma
      }
    });
  } catch (error) {
    console.error('Error converting proforma to invoice:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to convert proforma to invoice.' });
  }
};

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  createOrderFromQuotation,
  getDeliveryChallans,
  getDeliveryChallanById,
  createDeliveryChallan,
  updateDeliveryChallanStatus,
  getAvailableSerialNumbers,
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoicePayment,
  updateInvoiceStatus,
  getProformas,
  getProformaById,
  createProforma,
  updateProforma,
  reviseProforma,
  updateProformaStatus,
  convertProformaToOrder,
  convertProformaToInvoice
};
