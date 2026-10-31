const {
  purchaseOrders,
  goodsReceipts,
  suppliers,
  generatePurchaseOrderId,
  generateGrnId,
  persistStore
} = require('../data/crmStore');
const inventoryService = require('../services/inventoryService');
const { hasPermission } = require('../utils/accessControl');
const { filterRecordsBySearch } = require('../utils/searchHelper');
const { isCableProduct } = require('./stockController');

/**
 * Calculate totals and receipt progress for a PO
 */
function enrichPurchaseOrder(po) {
  const stockData = inventoryService.readStocks();
  const items = (Array.isArray(po.items) ? po.items : []).map((item) => {
    let hsn = (item.hsnSac || item.hsn || item.hsnCode || '').toString().trim();
    let brand = (item.brand || item.brandName || '').toString().trim();
    if (item.productId || item.productCode) {
      const prod = inventoryService.findProduct(stockData, item.productId || item.productCode);
      if (prod) {
        if (!hsn && (prod.hsnSac || prod.hsn)) {
          hsn = (prod.hsnSac || prod.hsn).toString().trim();
        }
        if (!brand && (prod.brand || prod.brandName)) {
          brand = (prod.brand || prod.brandName).toString().trim();
        }
      }
    }
    return {
      ...item,
      brand,
      brandName: brand,
      hsnSac: hsn
    };
  });

  let totalOrderedQty = 0;
  let totalReceivedQty = 0;
  let totalPendingQty = 0;
  let fullOrderedSubtotal = 0;
  let fullOrderedTax = 0;
  let fullReceivedSubtotal = 0;
  let fullReceivedTax = 0;
  let fullPendingSubtotal = 0;
  let fullPendingTax = 0;

  const enrichedItems = items.map((item) => {
    const ord = Number(item.orderedQty || 0);
    const rec = Number(item.receivedQty || 0);
    const pend = Math.max(0, ord - rec);
    const rate = Number(item.rate || 0);
    const gstRate = Number(item.gstRate || 18);

    const ordTaxable = Number((ord * rate).toFixed(2));
    const ordTax = Number(((ordTaxable * gstRate) / 100).toFixed(2));
    const recTaxable = Number((rec * rate).toFixed(2));
    const recTax = Number(((recTaxable * gstRate) / 100).toFixed(2));
    const pendTaxable = Number((pend * rate).toFixed(2));
    const pendTax = Number(((pendTaxable * gstRate) / 100).toFixed(2));

    totalOrderedQty += ord;
    totalReceivedQty += rec;
    totalPendingQty += pend;

    fullOrderedSubtotal += ordTaxable;
    fullOrderedTax += ordTax;
    fullReceivedSubtotal += recTaxable;
    fullReceivedTax += recTax;
    fullPendingSubtotal += pendTaxable;
    fullPendingTax += pendTax;

    return {
      ...item,
      orderedQty: ord,
      receivedQty: rec,
      pendingQty: pend,
      receivedTaxable: recTaxable,
      receivedTax: recTax,
      receivedLineTotal: Number((recTaxable + recTax).toFixed(2)),
      pendingTaxable: pendTaxable,
      pendingTax: pendTax,
      pendingLineTotal: Number((pendTaxable + pendTax).toFixed(2))
    };
  });

  const percentReceived = totalOrderedQty > 0 ? Math.round((totalReceivedQty / totalOrderedQty) * 100) : 0;
  const orderedGrandTotal = Math.round(fullOrderedSubtotal + fullOrderedTax);
  const receivedGrandTotal = Math.round(fullReceivedSubtotal + fullReceivedTax);
  const pendingGrandTotal = Math.round(fullPendingSubtotal + fullPendingTax);

  const finalGrandTotal = Number(po.grandTotal !== undefined ? po.grandTotal : orderedGrandTotal);
  const advanceAmount = Number(po.advanceAmount || 0);
  const payments = Array.isArray(po.payments) && po.payments.length > 0
    ? po.payments
    : (advanceAmount > 0 ? [{
        id: `PAY-ADV-${po.id || po.purchaseOrderId}`,
        date: po.orderDate || po.createdAt,
        type: 'ADVANCE',
        amount: advanceAmount,
        mode: po.advancePaymentMode || 'Bank Transfer',
        reference: po.advancePaymentRef || '',
        status: 'PAID',
        createdAt: po.createdAt || new Date().toISOString()
      }] : []);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const balanceAmount = Math.max(0, finalGrandTotal - totalPaid);
  const paymentStatus = totalPaid >= finalGrandTotal && finalGrandTotal > 0
    ? 'PAID'
    : (totalPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID');

  return {
    ...po,
    items: enrichedItems,
    totalOrderedQty,
    totalReceivedQty,
    totalPendingQty,
    percentReceived,
    receiptProgress: `${totalReceivedQty} / ${totalOrderedQty} items`,
    orderedSubtotal: Number(fullOrderedSubtotal.toFixed(2)),
    orderedTaxTotal: Number(fullOrderedTax.toFixed(2)),
    orderedGrandTotal,
    receivedSubtotal: Number(fullReceivedSubtotal.toFixed(2)),
    receivedTaxTotal: Number(fullReceivedTax.toFixed(2)),
    receivedGrandTotal,
    pendingSubtotal: Number(fullPendingSubtotal.toFixed(2)),
    pendingTaxTotal: Number(fullPendingTax.toFixed(2)),
    pendingGrandTotal,
    advanceAmount,
    payments,
    totalPaid,
    balanceAmount,
    paymentStatus
  };
}

/**
 * GET /api/purchase-orders
 * List all purchase orders with optional status filter and search query
 */
function getPurchaseOrders(req, res) {
  try {
    if (!hasPermission(req, 'Purchase Orders', 'View')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to view purchase orders.' });
    }
    const status = String(req.query.status || '').trim().toUpperCase();
    const search = String(req.query.search || '').trim().toLowerCase();

    let list = purchaseOrders.map(enrichPurchaseOrder);

    if (status && status !== 'ALL') {
      list = list.filter((po) => String(po.status || '').toUpperCase() === status);
    }

    if (search) {
      list = filterRecordsBySearch(list, search, [
        (po) => po.id,
        (po) => po.poNumber,
        (po) => po.supplierSnapshot?.companyName,
        (po) => po.supplierSnapshot?.contactPerson,
        (po) => po.remarks,
        (po) => po.status,
        (po) => po.items?.map((it) => `${it.productName || ''} ${it.productCode || it.sku || ''}`)
      ]);
    }

    // Sort newest first
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return res.status(200).json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (error) {
    console.error('Error in getPurchaseOrders:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve purchase orders.' });
  }
}

/**
 * GET /api/purchase-orders/:id
 * Retrieve PO details along with associated Goods Receipt Notes
 */
function getPurchaseOrderById(req, res) {
  try {
    if (!hasPermission(req, 'Purchase Orders', 'View')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to view purchase orders.' });
    }
    const { id } = req.params;
    const targetId = String(id || '').trim().toUpperCase();
    const po = purchaseOrders.find((p) => (p.id || '').toUpperCase() === targetId || (p.purchaseOrderId || '').toUpperCase() === targetId);
    if (!po) {
      return res.status(404).json({ success: false, message: `Purchase Order ${id} not found.` });
    }

    const enriched = enrichPurchaseOrder(po);
    const relatedGrns = goodsReceipts
      .filter((grn) => (grn.purchaseOrderId || '').toUpperCase() === po.id.toUpperCase() || (grn.poNumber || '').toUpperCase() === po.id.toUpperCase())
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return res.status(200).json({
      success: true,
      data: enriched,
      goodsReceipts: relatedGrns
    });
  } catch (error) {
    console.error('Error in getPurchaseOrderById:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve purchase order.' });
  }
}

/**
 * POST /api/purchase-orders
 * Create a new Purchase Order
 * INVARIANT: Stock is NEVER modified upon creation or sending!
 */
function createPurchaseOrder(req, res) {
  try {
    if (!hasPermission(req, 'Purchase Orders', 'Create')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to create purchase orders.' });
    }
    const {
      supplierId,
      orderDate,
      expectedDeliveryDate,
      status: requestedStatus,
      items,
      paymentTerms,
      deliveryAddress,
      termsAndConditions,
      remarks,
      subtotal,
      cgst,
      sgst,
      igst,
      roundOff,
      grandTotal
    } = req.body;

    if (!supplierId) {
      return res.status(400).json({ success: false, message: 'Supplier is required.' });
    }

    const supplier = suppliers.find((s) => s.id === supplierId);
    if (!supplier) {
      return res.status(400).json({ success: false, message: `Supplier ${supplierId} does not exist.` });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one line item is required.' });
    }

    // Read stocks to validate product master references and obtain product snapshot
    const stockData = inventoryService.readStocks();
    const validatedItems = [];
    const seenProdIds = new Set();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const prodId = item.productId || item.productCode;
      if (!prodId) {
        return res.status(400).json({ success: false, message: `Line ${i + 1}: Product is required.` });
      }

      const prod = inventoryService.findProduct(stockData, prodId);
      if (!prod) {
        return res.status(400).json({ success: false, message: `Line ${i + 1}: Product "${prodId}" not found in Product Master.` });
      }

      if (seenProdIds.has(prod.id)) {
        return res.status(400).json({
          success: false,
          message: `Duplicate product line: "${prod.name}" (${prod.code}) cannot be added more than once. Please adjust the quantity on the existing line.`
        });
      }
      seenProdIds.add(prod.id);

      const orderedQty = parseInt(item.orderedQty !== undefined ? item.orderedQty : item.quantity, 10);
      if (!Number.isInteger(orderedQty) || orderedQty <= 0) {
        return res.status(400).json({ success: false, message: `Line ${i + 1}: Quantity for "${prod.name}" must be a positive integer.` });
      }

      const rate = Number(item.rate !== undefined ? item.rate : prod.cost || 0);
      const discountPct = Number(item.discountPercent || item.discountPct || item.discount || 0);
      const rawSub = orderedQty * rate;
      const discountAmount = Number(item.discountAmount !== undefined ? item.discountAmount : ((rawSub * discountPct) / 100));
      const lineSubtotal = Number((rawSub - discountAmount).toFixed(2));
      const gstRate = Number(item.gstRate !== undefined ? item.gstRate : prod.gst || 18);
      const taxAmount = Number(((lineSubtotal * gstRate) / 100).toFixed(2));
      const lineTotal = Number((lineSubtotal + taxAmount).toFixed(2));

      validatedItems.push({
        productId: prod.id,
        productCode: prod.code,
        productName: prod.name,
        description: (item.description || prod.description || '').toString().trim(),
        category: prod.category || prod.categoryName || '',
        subcategory: prod.subcategory || prod.subcategoryName || '',
        brand: prod.brand || prod.brandName || '',
        unit: (item.unit && item.unit !== 'Piece') ? item.unit : ((prod?.unit && prod?.unit !== 'Piece') ? prod.unit : 'Nos'),
        hsnSac: (item.hsnSac || item.hsn || item.hsnCode || prod.hsnSac || prod.hsn || '').toString().trim(),
        orderedQty: orderedQty,
        receivedQty: 0,
        pendingQty: orderedQty,
        rate: rate,
        discountPercent: discountPct,
        discountAmount: discountAmount,
        taxableValue: lineSubtotal,
        gstRate: gstRate,
        tax: taxAmount,
        lineTotal: lineTotal,
        serialized: Boolean(prod.serialized),
        serialNumbers: []
      });
    }

    // Calculations
    const calcSubtotal = validatedItems.reduce((sum, it) => sum + (it.taxableValue !== undefined ? it.taxableValue : (it.orderedQty * it.rate)), 0);
    const calcTax = validatedItems.reduce((sum, it) => sum + it.tax, 0);
    const computedGrandTotal = calcSubtotal + calcTax;
    const finalRoundOff = Number((Math.round(computedGrandTotal) - computedGrandTotal).toFixed(2));
    const finalGrandTotal = Math.round(computedGrandTotal);

    // Determine Intra-State (Tamil Nadu) vs Inter-State (IGST)
    const supplierState = String(supplier.state || '').trim().toLowerCase();
    const supplierGstin = String(supplier.gstin || '').trim();
    const supplierCity = String(supplier.city || '').trim().toLowerCase();
    const tnCities = [
      'chennai', 'coimbatore', 'madurai', 'trichy', 'tiruchirappalli',
      'salem', 'tirunelveli', 'erode', 'vellore', 'thoothukudi',
      'dindigul', 'thanjavur', 'ranipet', 'sivakasi', 'karur',
      'ooty', 'hosur', 'kanchipuram'
    ];
    let isIntraState = true;
    if (supplierState) {
      isIntraState = supplierState === 'tamil nadu' || supplierState === 'tamilnadu' || supplierState === 'tn';
    } else if (supplierGstin.length >= 2 && /^\d{2}/.test(supplierGstin)) {
      isIntraState = supplierGstin.substring(0, 2) === '33';
    } else if (supplierCity) {
      if (tnCities.includes(supplierCity)) isIntraState = true;
      else {
        const otherCities = ['delhi', 'new delhi', 'mumbai', 'bengaluru', 'bangalore', 'hyderabad', 'kolkata', 'pune', 'ahmedabad', 'jaipur', 'noida', 'gurugram', 'gurgaon'];
        if (otherCities.includes(supplierCity)) isIntraState = false;
      }
    }

    const defaultCgst = isIntraState ? Number((calcTax / 2).toFixed(2)) : 0;
    const defaultSgst = isIntraState ? Number((calcTax / 2).toFixed(2)) : 0;
    const defaultIgst = isIntraState ? 0 : Number(calcTax.toFixed(2));

    const poId = generatePurchaseOrderId();
    const initialStatus = requestedStatus === 'SENT' ? 'SENT' : 'DRAFT';

    const newPO = {
      id: poId,
      purchaseOrderId: poId,
      supplierId: supplier.id,
      supplierSnapshot: {
        id: supplier.id,
        companyName: supplier.companyName,
        contactPerson: supplier.contactPerson,
        phone: supplier.phone,
        email: supplier.email,
        gstin: supplier.gstin,
        address: supplier.address,
        city: supplier.city,
        state: supplier.state,
        pincode: supplier.pincode || ''
      },
      orderDate: orderDate || new Date().toISOString().slice(0, 10),
      expectedDeliveryDate: expectedDeliveryDate || '',
      status: initialStatus,
      items: validatedItems,
      subtotal: Number(subtotal !== undefined ? subtotal : calcSubtotal.toFixed(2)),
      cgst: Number(cgst !== undefined ? cgst : defaultCgst),
      sgst: Number(sgst !== undefined ? sgst : defaultSgst),
      igst: Number(igst !== undefined ? igst : defaultIgst),
      roundOff: Number(roundOff !== undefined ? roundOff : finalRoundOff),
      grandTotal: Number(grandTotal !== undefined ? grandTotal : finalGrandTotal),
      paymentTerms: String(paymentTerms || 'Net 30 Days').trim(),
      payingBank: req.body.payingBank || (req.body.advancePaymentMode && req.body.advancePaymentMode.split('-')[0]?.trim()) || 'HDFC Bank',
      paymentMethod: req.body.paymentMethod || req.body.advancePaymentMode || 'Bank Transfer (RTGS)',
      paymentRef: req.body.paymentRef || req.body.advancePaymentRef || '',
      advanceAmount: /immediate/i.test(paymentTerms)
        ? (req.body.immediateAmount !== undefined ? Number(req.body.immediateAmount) : finalGrandTotal)
        : Number(req.body.advanceAmount || 0),
      advancePaymentMode: req.body.paymentMethod || req.body.advancePaymentMode || null,
      advancePaymentRef: req.body.paymentRef || req.body.advancePaymentRef || null,
      totalPaid: /immediate/i.test(paymentTerms)
        ? (req.body.immediateAmount !== undefined ? Math.min(finalGrandTotal, Number(req.body.immediateAmount)) : finalGrandTotal)
        : Number(req.body.advanceAmount || 0),
      balanceAmount: /immediate/i.test(paymentTerms)
        ? Math.max(0, finalGrandTotal - (req.body.immediateAmount !== undefined ? Number(req.body.immediateAmount) : finalGrandTotal))
        : Math.max(0, Number(grandTotal !== undefined ? grandTotal : finalGrandTotal) - Number(req.body.advanceAmount || 0)),
      payments: /immediate/i.test(paymentTerms) ? [{
        id: `PAY-IMM-${poId}`,
        date: orderDate || new Date().toISOString().slice(0, 10),
        type: 'IMMEDIATE',
        bankName: req.body.payingBank || 'HDFC Bank',
        amount: req.body.immediateAmount !== undefined ? Math.min(finalGrandTotal, Number(req.body.immediateAmount)) : finalGrandTotal,
        mode: req.body.paymentMethod || req.body.advancePaymentMode || 'RTGS',
        reference: req.body.paymentRef || req.body.advancePaymentRef || '',
        status: 'PAID',
        createdAt: new Date().toISOString()
      }] : (Number(req.body.advanceAmount || 0) > 0 ? [{
        id: `PAY-ADV-${poId}`,
        date: orderDate || new Date().toISOString().slice(0, 10),
        type: 'ADVANCE',
        bankName: req.body.payingBank || 'HDFC Bank',
        amount: Number(req.body.advanceAmount || 0),
        mode: req.body.advancePaymentMode || 'Bank Transfer',
        reference: req.body.advancePaymentRef || '',
        status: 'PAID',
        createdAt: new Date().toISOString()
      }] : []),
      deliveryAddress: String(deliveryAddress || 'Plot No. 10A, Perumal Kovil Street, Sivabootham, Vanagaram, Chennai - 600095').trim(),
      termsAndConditions: String(termsAndConditions || 'Standard Purchase Terms: Goods subject to inspection on receipt. Defective or damaged items will be returned at supplier cost.').trim(),
      remarks: String(remarks || '').trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user?.name || 'Admin'
    };

    // ZERO STOCK CHANGE ON PO CREATION
    purchaseOrders.push(newPO);
    persistStore();

    return res.status(201).json({
      success: true,
      message: `Purchase Order ${poId} created successfully in ${initialStatus} status.`,
      data: enrichPurchaseOrder(newPO)
    });
  } catch (error) {
    console.error('Error in createPurchaseOrder:', error);
    return res.status(500).json({ success: false, message: 'Failed to create purchase order.' });
  }
}

/**
 * PUT /api/purchase-orders/:id
 * Update an existing DRAFT Purchase Order
 * INVARIANT: Only DRAFT purchase orders can be edited. Never changes stock.
 */
function updatePurchaseOrder(req, res) {
  try {
    if (!hasPermission(req, 'Purchase Orders', 'Edit')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to edit purchase orders.' });
    }
    const { id } = req.params;
    const targetId = String(id || '').trim().toUpperCase();
    const po = purchaseOrders.find((p) => (p.id || '').toUpperCase() === targetId || (p.purchaseOrderId || '').toUpperCase() === targetId);

    if (!po) {
      return res.status(404).json({ success: false, message: `Purchase Order ${id} not found.` });
    }

    if (String(po.status || '').toUpperCase() !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: `Only DRAFT purchase orders can be edited. Current status: ${po.status}.`
      });
    }

    const {
      supplierId,
      orderDate,
      expectedDeliveryDate,
      items,
      paymentTerms,
      deliveryAddress,
      termsAndConditions,
      remarks,
      subtotal,
      cgst,
      sgst,
      igst,
      roundOff,
      grandTotal
    } = req.body;

    if (supplierId && supplierId !== po.supplierId) {
      const foundSupplier = suppliers.find((s) => s.id === supplierId);
      if (!foundSupplier) {
        return res.status(400).json({ success: false, message: `Supplier ${supplierId} does not exist.` });
      }
      po.supplierId = foundSupplier.id;
      po.supplierSnapshot = {
        id: foundSupplier.id,
        companyName: foundSupplier.companyName,
        contactPerson: foundSupplier.contactPerson,
        phone: foundSupplier.phone,
        email: foundSupplier.email,
        gstin: foundSupplier.gstin,
        address: foundSupplier.address,
        city: foundSupplier.city,
        state: foundSupplier.state,
        pincode: foundSupplier.pincode || ''
      };
    }

    if (Array.isArray(items) && items.length > 0) {
      const stockData = inventoryService.readStocks();
      const validatedItems = [];
      const seenProdIds = new Set();

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const prodId = item.productId || item.productCode;
        if (!prodId) {
          return res.status(400).json({ success: false, message: `Line ${i + 1}: Product is required.` });
        }

        const prod = inventoryService.findProduct(stockData, prodId);
        if (!prod) {
          return res.status(400).json({ success: false, message: `Line ${i + 1}: Product "${prodId}" not found in Product Master.` });
        }

        if (seenProdIds.has(prod.id)) {
          return res.status(400).json({
            success: false,
            message: `Duplicate product line: "${prod.name}" (${prod.code}) cannot be added more than once. Please adjust the quantity on the existing line.`
          });
        }
        seenProdIds.add(prod.id);

        const orderedQty = parseInt(item.orderedQty !== undefined ? item.orderedQty : item.quantity, 10);
        if (!Number.isInteger(orderedQty) || orderedQty <= 0) {
          return res.status(400).json({ success: false, message: `Line ${i + 1}: Quantity for "${prod.name}" must be a positive integer.` });
        }

        const rate = Number(item.rate !== undefined ? item.rate : prod.cost || 0);
        const discountPct = Number(item.discountPercent || item.discountPct || item.discount || 0);
        const rawSub = orderedQty * rate;
        const discountAmount = Number(item.discountAmount !== undefined ? item.discountAmount : ((rawSub * discountPct) / 100));
        const lineSubtotal = Number((rawSub - discountAmount).toFixed(2));
        const gstRate = Number(item.gstRate !== undefined ? item.gstRate : prod.gst || 18);
        const taxAmount = Number(((lineSubtotal * gstRate) / 100).toFixed(2));
        const lineTotal = Number((lineSubtotal + taxAmount).toFixed(2));

        validatedItems.push({
          productId: prod.id,
          productCode: prod.code,
          productName: prod.name,
          description: (item.description || prod.description || '').toString().trim(),
          category: prod.category || prod.categoryName || '',
          subcategory: prod.subcategory || prod.subcategoryName || '',
          brand: prod.brand || prod.brandName || '',
          unit: (item.unit && item.unit !== 'Piece') ? item.unit : ((prod?.unit && prod?.unit !== 'Piece') ? prod.unit : 'Nos'),
          hsnSac: (item.hsnSac || item.hsn || item.hsnCode || prod.hsnSac || prod.hsn || '').toString().trim(),
          orderedQty: orderedQty,
          receivedQty: 0,
          pendingQty: orderedQty,
          rate: rate,
          discountPercent: discountPct,
          discountAmount: discountAmount,
          taxableValue: lineSubtotal,
          gstRate: gstRate,
          tax: taxAmount,
          lineTotal: lineTotal,
          serialized: Boolean(prod.serialized),
          serialNumbers: []
        });
      }

      const calcSubtotal = validatedItems.reduce((sum, it) => sum + (it.taxableValue !== undefined ? it.taxableValue : (it.orderedQty * it.rate)), 0);
      const calcTax = validatedItems.reduce((sum, it) => sum + it.tax, 0);
      const computedGrandTotal = calcSubtotal + calcTax;
      const finalRoundOff = Number((Math.round(computedGrandTotal) - computedGrandTotal).toFixed(2));
      const finalGrandTotal = Math.round(computedGrandTotal);

      po.items = validatedItems;
      po.subtotal = Number(subtotal !== undefined ? subtotal : calcSubtotal.toFixed(2));
      po.cgst = Number(cgst !== undefined ? cgst : 0);
      po.sgst = Number(sgst !== undefined ? sgst : 0);
      po.igst = Number(igst !== undefined ? igst : 0);
      po.roundOff = Number(roundOff !== undefined ? roundOff : finalRoundOff);
      po.grandTotal = Number(grandTotal !== undefined ? grandTotal : finalGrandTotal);
    }

    if (orderDate) po.orderDate = orderDate;
    if (expectedDeliveryDate !== undefined) po.expectedDeliveryDate = expectedDeliveryDate;
    if (paymentTerms !== undefined) po.paymentTerms = paymentTerms;
    if (req.body.payingBank) po.payingBank = req.body.payingBank;
    if (req.body.paymentMethod) po.paymentMethod = req.body.paymentMethod;
    if (req.body.paymentRef !== undefined) po.paymentRef = req.body.paymentRef;

    const isImm = /immediate/i.test(po.paymentTerms || '');
    if (isImm || req.body.advanceAmount !== undefined || req.body.immediateAmount !== undefined) {
      if (!Array.isArray(po.payments)) po.payments = [];
      if (isImm) {
        const immAmount = Number(req.body.immediateAmount !== undefined ? req.body.immediateAmount : (req.body.advanceAmount || po.grandTotal));
        const immIdx = po.payments.findIndex((p) => p.type === 'IMMEDIATE');
        const immRecord = {
          id: immIdx >= 0 ? po.payments[immIdx].id : `PAY-IMM-${po.id || po.purchaseOrderId}`,
          date: po.orderDate || new Date().toISOString().slice(0, 10),
          type: 'IMMEDIATE',
          bankName: req.body.payingBank || po.payingBank || 'HDFC Bank',
          amount: Math.min(Number(po.grandTotal || 0), immAmount),
          mode: req.body.paymentMethod || po.paymentMethod || 'RTGS',
          reference: req.body.paymentRef || po.paymentRef || '',
          status: 'PAID',
          createdAt: immIdx >= 0 ? po.payments[immIdx].createdAt : new Date().toISOString()
        };
        if (immIdx >= 0) po.payments[immIdx] = immRecord;
        else po.payments.unshift(immRecord);
        po.advanceAmount = immRecord.amount;
        po.advancePaymentMode = immRecord.mode;
        po.advancePaymentRef = immRecord.reference;
      } else if (req.body.advanceAmount !== undefined) {
        const adv = Number(req.body.advanceAmount || 0);
        po.advanceAmount = adv;
        if (req.body.advancePaymentMode) po.advancePaymentMode = req.body.advancePaymentMode;
        if (req.body.advancePaymentRef !== undefined) po.advancePaymentRef = req.body.advancePaymentRef;

        const advIdx = po.payments.findIndex((p) => p.type === 'ADVANCE');
        if (adv > 0) {
          const advRecord = {
            id: advIdx >= 0 ? po.payments[advIdx].id : `PAY-ADV-${po.id || po.purchaseOrderId}`,
            date: po.orderDate || new Date().toISOString().slice(0, 10),
            type: 'ADVANCE',
            bankName: req.body.payingBank || po.payingBank || 'HDFC Bank',
            amount: adv,
            mode: po.advancePaymentMode || 'Bank Transfer',
            reference: po.advancePaymentRef || '',
            status: 'PAID',
            createdAt: advIdx >= 0 ? po.payments[advIdx].createdAt : new Date().toISOString()
          };
          if (advIdx >= 0) po.payments[advIdx] = advRecord;
          else po.payments.unshift(advRecord);
        } else if (advIdx >= 0) {
          po.payments.splice(advIdx, 1);
        }
      }
      po.totalPaid = po.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      po.balanceAmount = Math.max(0, Number(po.grandTotal || 0) - po.totalPaid);
      po.paymentStatus = (Number(po.grandTotal || 0) > 0 && po.totalPaid >= Number(po.grandTotal || 0)) ? 'PAID' : (po.totalPaid > 0 ? 'PARTIALLY_PAID' : 'UNPAID');
    }
    if (deliveryAddress !== undefined) po.deliveryAddress = deliveryAddress;
    if (termsAndConditions !== undefined) po.termsAndConditions = termsAndConditions;
    if (remarks !== undefined) po.remarks = remarks;
    po.updatedAt = new Date().toISOString();

    persistStore();

    return res.status(200).json({
      success: true,
      message: `Purchase Order ${po.id} updated successfully.`,
      data: enrichPurchaseOrder(po)
    });
  } catch (error) {
    console.error('Error in updatePurchaseOrder:', error);
    return res.status(500).json({ success: false, message: 'Failed to update purchase order.' });
  }
}

/**
 * PATCH /api/purchase-orders/:id/status
 * Transition PO status (e.g. DRAFT -> SENT, or CANCELLED)
 * INVARIANT: Status changes never change physical stock!
 */
function updatePurchaseOrderStatus(req, res) {
  try {
    if (!hasPermission(req, 'Purchase Orders', 'Approve') && !hasPermission(req, 'Purchase Orders', 'Edit')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to update purchase order status.' });
    }
    const { id } = req.params;
    const { status, remarks } = req.body;
    const targetId = String(id || '').trim().toUpperCase();
    const po = purchaseOrders.find((p) => (p.id || '').toUpperCase() === targetId || (p.purchaseOrderId || '').toUpperCase() === targetId);
    if (!po) {
      return res.status(404).json({ success: false, message: `Purchase Order ${id} not found.` });
    }

    const currentStatus = String(po.status || '').toUpperCase();
    const nextStatus = String(status || '').trim().toUpperCase();

    if (!['DRAFT', 'SENT', 'CANCELLED'].includes(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid direct status change to "${nextStatus}". Receipts are recorded through the Goods Receipt flow.`
      });
    }

    // Cancellation check: cannot cancel if already partially or fully received
    if (nextStatus === 'CANCELLED') {
      const hasReceipts = (po.items || []).some((it) => Number(it.receivedQty || 0) > 0);
      if (hasReceipts || currentStatus === 'PARTIALLY_RECEIVED' || currentStatus === 'RECEIVED') {
        return res.status(400).json({
          success: false,
          message: `Cannot cancel Purchase Order ${id} because goods have already been received against it.`
        });
      }
    }

    // Only allow DRAFT -> SENT or DRAFT/SENT -> CANCELLED
    if (nextStatus === 'SENT' && currentStatus !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: `Only DRAFT purchase orders can be marked as SENT. Current status: ${currentStatus}.`
      });
    }

    po.status = nextStatus;
    if (remarks !== undefined) po.remarks = remarks;
    po.updatedAt = new Date().toISOString();

    persistStore();

    return res.status(200).json({
      success: true,
      message: `Purchase Order ${id} status updated to ${nextStatus}.`,
      data: enrichPurchaseOrder(po)
    });
  } catch (error) {
    console.error('Error in updatePurchaseOrderStatus:', error);
    return res.status(500).json({ success: false, message: 'Failed to update purchase order status.' });
  }
}

/**
 * POST /api/purchase-orders/:id/receive
 * ATOMIC GOODS RECEIPT (GRN) CONFIRMATION
 * Physical stock increases ONLY here, strictly by receiveNow quantity.
 */
function receiveGoods(req, res) {
  try {
    if (!hasPermission(req, 'Purchase Orders', 'Receive Goods')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to receive goods.' });
    }
    const { id } = req.params;
    const { receivedDate, receivedBy, notes } = req.body;
    const receivedItems = Array.isArray(req.body.items) ? req.body.items : (Array.isArray(req.body.receivedItems) ? req.body.receivedItems : []);

    const targetId = String(id || '').trim().toUpperCase();
    const po = purchaseOrders.find((p) => (p.id || '').toUpperCase() === targetId || (p.purchaseOrderId || '').toUpperCase() === targetId);
    if (!po) {
      return res.status(404).json({ success: false, message: `Purchase Order ${id} not found.` });
    }

    if (po.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: `Cannot receive goods against cancelled Purchase Order ${id}.` });
    }
    if (po.status === 'RECEIVED') {
      return res.status(400).json({ success: false, message: `Purchase Order ${id} has already been fully received.` });
    }
    if (po.status === 'DRAFT') {
      return res.status(400).json({ success: false, message: `Purchase Order ${id} is still in DRAFT status. Please confirm/send it before receiving goods.` });
    }

    if (!Array.isArray(receivedItems) || receivedItems.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one line item is required for goods receipt.' });
    }

    const stockData = inventoryService.readStocks();

    // 1. Validate line items and quantities
    let totalReceiveNow = 0;
    const processedLines = [];

    for (const recItem of receivedItems) {
      const prodId = recItem.productId || recItem.productCode;
      const receiveNow = parseInt(recItem.receiveNow !== undefined ? recItem.receiveNow : recItem.receivedQty, 10);

      if (isNaN(receiveNow) || receiveNow < 0) {
        return res.status(400).json({ success: false, message: `Invalid receive quantity for product ${prodId}. Must be a non-negative integer.` });
      }

      if (receiveNow === 0) continue; // Skip zero items

      const poItem = (po.items || []).find(
        (it) => it.productId === prodId || it.productCode === prodId
      );

      if (!poItem) {
        return res.status(400).json({ success: false, message: `Product "${prodId}" does not belong to Purchase Order ${id}.` });
      }

      const pending = Math.max(0, Number(poItem.orderedQty || 0) - Number(poItem.receivedQty || 0));
      if (receiveNow > pending) {
        return res.status(400).json({
          success: false,
          message: `Cannot receive ${receiveNow} units of "${poItem.productName}". Maximum pending quantity is ${pending}.`
        });
      }

      let serials = Array.isArray(recItem.serialNumbers)
        ? recItem.serialNumbers.map((s) => String(s).trim()).filter(Boolean)
        : [];

      // Check serial count if serialized; strictly clear serials if non-serialized or cable
      const isCable = isCableProduct(
        { categoryId: poItem.categoryId, name: poItem.productName, unit: poItem.unit },
        stockData.categories,
        stockData.subcategories
      );
      const isItemSerialized = !isCable && Boolean(poItem.serialized);

      if (isItemSerialized) {
        if (serials.length !== receiveNow) {
          return res.status(400).json({
            success: false,
            message: `Product "${poItem.productName}" is serialized and requires exactly ${receiveNow} serial number(s), but received ${serials.length}.`
          });
        }
      } else {
        serials = [];
      }

      const itemRate = Number(recItem.unitRate !== undefined ? recItem.unitRate : (poItem.rate || 0));
      totalReceiveNow += receiveNow;
      processedLines.push({
        poItem,
        productId: poItem.productId,
        productCode: poItem.productCode,
        productName: poItem.productName,
        receiveNow,
        unitRate: itemRate,
        serialNumbers: serials,
        warehouseLocation: recItem.warehouseLocation || null
      });
    }

    if (totalReceiveNow === 0) {
      return res.status(400).json({ success: false, message: 'Please enter a receive quantity greater than 0 for at least one item.' });
    }

    // 2. Generate deterministic GRN ID & extract warehouse
    const grnId = generateGrnId();
    const receiptDateStr = receivedDate || new Date().toISOString().slice(0, 10);
    const receiver = String(receivedBy || req.user?.name || 'Store Officer').trim();
    const warehouseId = String(req.body.warehouseId || 'WH-001').trim();
    const warehouseName = String(req.body.warehouseName || 'Main Central Hub').trim();

    // 3. Atomically add physical stock via inventoryService
    const inventoryResult = inventoryService.addStock({
      items: processedLines.map((l) => ({
        productId: l.productId,
        productCode: l.productCode,
        productName: l.productName,
        receiveNow: l.receiveNow,
        serialNumbers: l.serialNumbers,
        unitRate: l.unitRate,
        gstRate: Number(l.poItem.gst || l.poItem.gstRate || 0),
        taxAmount: Number((l.receiveNow * l.unitRate * (Number(l.poItem.gst || l.poItem.gstRate || 0) / 100)).toFixed(2)),
        totalValue: Number((l.receiveNow * l.unitRate).toFixed(2)),
        warehouseLocation: l.warehouseLocation
      })),
      referenceType: 'GOODS_RECEIPT',
      referenceId: grnId,
      poReference: po.id,
      date: receiptDateStr,
      partyName: po.supplierSnapshot?.companyName || 'Supplier',
      supplierId: po.supplierId || po.supplierSnapshot?.id || null,
      supplierName: po.supplierSnapshot?.companyName,
      warehouseId,
      warehouseName,
      remarks: notes || `Received against ${po.id}`,
      user: req.user
    });

    if (!inventoryResult.success) {
      return res.status(400).json({ success: false, message: inventoryResult.message });
    }

    // 4. Update PO in-memory state & apply Profit Protection Rule (Highest Price Rule)
    for (const line of processedLines) {
      const item = line.poItem;
      item.receivedQty = Number(item.receivedQty || 0) + line.receiveNow;
      item.pendingQty = Math.max(0, Number(item.orderedQty || 0) - item.receivedQty);
      if (line.serialNumbers.length > 0) {
        if (!Array.isArray(item.serialNumbers)) item.serialNumbers = [];
        item.serialNumbers.push(...line.serialNumbers);
      }

      // Record this delivery batch
      if (line.warehouseLocation) {
        item.warehouseLocation = line.warehouseLocation;
      }
      if (!Array.isArray(item.receiptBatches)) item.receiptBatches = [];
      item.receiptBatches.push({
        grnId,
        date: receiptDateStr,
        quantity: line.receiveNow,
        unitRate: line.unitRate,
        totalValue: Number((line.receiveNow * line.unitRate).toFixed(2)),
        warehouseId,
        warehouseName,
        warehouseLocation: line.warehouseLocation || null
      });

      // Highest Price Rule: find maximum unit rate across all received batches
      const batchRates = item.receiptBatches.map((b) => Number(b.unitRate || 0)).filter((r) => r > 0);
      const allCandidateRates = [...batchRates, Number(line.unitRate || 0)];
      if (item.highestRate && Number(item.highestRate) > 0) allCandidateRates.push(Number(item.highestRate));
      const highestRate = allCandidateRates.length > 0 ? Math.max(...allCandidateRates) : Number(item.rate || line.unitRate || 0);

      const actualCostPaid = item.receiptBatches.reduce((sum, b) => sum + Number(b.totalValue || 0), 0);
      const totalUnits = Number(item.orderedQty || item.receivedQty || 0);
      const valuationAtHighestRate = Number((totalUnits * highestRate).toFixed(2));

      item.actualCostTotal = actualCostPaid;
      item.highestRate = highestRate;
      item.rate = highestRate; // Benchmark at highest rate
      item.valuationTotal = valuationAtHighestRate;
      item.profitProtectionBuffer = Number(Math.max(0, valuationAtHighestRate - actualCostPaid).toFixed(2));
    }

    // Recalculate PO totals including tax and grand total
    let poOrderedSubtotal = 0;
    let poOrderedTax = 0;
    let poActualCost = 0;
    po.items.forEach((it) => {
      const q = Number(it.orderedQty || 0);
      const r = Number(it.rate || 0);
      const gst = Number(it.gst || it.gstRate || 18);
      const itemTaxable = Number((q * r).toFixed(2));
      const itemTax = Number(((itemTaxable * gst) / 100).toFixed(2));
      poOrderedSubtotal += itemTaxable;
      poOrderedTax += itemTax;
      poActualCost += Number(it.actualCostTotal || 0);
    });
    po.subtotal = Number(poOrderedSubtotal.toFixed(2));
    po.actualCostTotal = Number(poActualCost.toFixed(2));
    po.profitProtectionBuffer = Number(Math.max(0, poOrderedSubtotal - poActualCost).toFixed(2));

    const isIntraState = !po.igst || (Number(po.cgst || 0) > 0);
    if (isIntraState) {
      po.cgst = Number((poOrderedTax / 2).toFixed(2));
      po.sgst = Number((poOrderedTax / 2).toFixed(2));
      po.igst = 0;
    } else {
      po.cgst = 0;
      po.sgst = 0;
      po.igst = Number(poOrderedTax.toFixed(2));
    }
    po.tax = Number(poOrderedTax.toFixed(2));
    po.grandTotal = Math.round(poOrderedSubtotal + poOrderedTax);

    // Determine updated PO status
    const allReceived = po.items.every((it) => (Number(it.orderedQty || 0) - Number(it.receivedQty || 0)) <= 0);
    po.status = allReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
    po.updatedAt = new Date().toISOString();

    const deliveryType = allReceived ? 'FULL' : 'PARTIAL';

    // 5. Record Goods Receipt Note (GRN)
    const grnRecord = {
      id: grnId,
      grnId: grnId,
      purchaseOrderId: po.id,
      poNumber: po.id,
      supplierId: po.supplierId,
      supplierName: po.supplierSnapshot?.companyName || 'Supplier',
      receivedDate: receiptDateStr,
      receivedBy: receiver,
      warehouseId,
      warehouseName,
      deliveryType: deliveryType,
      items: processedLines.map((l) => ({
        productId: l.productId,
        productCode: l.productCode,
        productName: l.productName,
        quantity: l.receiveNow,
        receiveNow: l.receiveNow,
        serialNumbers: l.serialNumbers,
        warehouseLocation: l.warehouseLocation || null
      })),
      totalReceivedQty: totalReceiveNow,
      notes: notes || '',
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
      createdBy: receiver
    };

    goodsReceipts.push(grnRecord);

    // Process optional payment on goods receipt
    const paymentNow = Number(req.body.paymentNow || 0);
    const paymentMode = String(req.body.paymentMode || 'Bank Transfer').trim();
    const paymentRef = String(req.body.paymentRef || '').trim();
    const paymentNotes = String(req.body.paymentNotes || '').trim();

    if (!Array.isArray(po.payments)) {
      po.payments = Number(po.advanceAmount || 0) > 0 ? [{
        id: `PAY-ADV-${po.id || po.purchaseOrderId}`,
        date: po.orderDate || receiptDateStr,
        type: 'ADVANCE',
        amount: Number(po.advanceAmount || 0),
        mode: po.advancePaymentMode || 'Bank Transfer',
        reference: po.advancePaymentRef || '',
        status: 'PAID',
        createdAt: po.createdAt || new Date().toISOString()
      }] : [];
    }

    if (paymentNow > 0) {
      const payRecord = {
        id: `PAY-GRN-${grnId}`,
        grnId: grnId,
        date: receiptDateStr,
        type: 'GRN_PAYMENT',
        bankName: req.body.payingBank || 'HDFC Bank',
        amount: paymentNow,
        mode: paymentMode,
        reference: paymentRef,
        notes: paymentNotes,
        status: 'PAID',
        createdAt: new Date().toISOString()
      };
      po.payments.push(payRecord);
      grnRecord.payment = payRecord;
    }

    const totalPaid = po.payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    po.totalPaid = totalPaid;
    po.balanceAmount = Math.max(0, Number(po.grandTotal || 0) - totalPaid);

    // 6. Persist CRM Store
    persistStore();

    const deliveryLabel = allReceived ? 'Full Delivery (Order Completed)' : `Partial Delivery (+${totalReceiveNow} units)`;
    return res.status(200).json({
      success: true,
      message: `Goods Receipt ${grnId} confirmed [${deliveryLabel}]. Physical stock updated (+${totalReceiveNow} units).`,
      deliveryType,
      grn: grnRecord,
      purchaseOrder: enrichPurchaseOrder(po)
    });
  } catch (error) {
    console.error('Error in receiveGoods:', error);
    return res.status(500).json({ success: false, message: 'Failed to process goods receipt.' });
  }
}

/**
 * GET /api/goods-receipts
 * List all Goods Receipt Notes
 */
function getGoodsReceipts(req, res) {
  try {
    if (!hasPermission(req, 'Purchase Orders', 'View')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to view goods receipts.' });
    }
    const poId = req.query.poId;
    let list = [...goodsReceipts];
    if (poId) {
      list = list.filter((g) => g.purchaseOrderId === poId);
    }
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return res.status(200).json({
      success: true,
      count: list.length,
      data: list
    });
  } catch (error) {
    console.error('Error in getGoodsReceipts:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve goods receipts.' });
  }
}

/**
 * GET /api/goods-receipts/:id
 */
function getGoodsReceiptById(req, res) {
  try {
    if (!hasPermission(req, 'Purchase Orders', 'View')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to view goods receipts.' });
    }
    const { id } = req.params;
    const grn = goodsReceipts.find((g) => g.id === id || g.grnId === id);
    if (!grn) {
      return res.status(404).json({ success: false, message: `Goods Receipt Note ${id} not found.` });
    }
    const po = purchaseOrders.find((p) => p.id === grn.purchaseOrderId);
    return res.status(200).json({
      success: true,
      data: grn,
      purchaseOrder: po ? enrichPurchaseOrder(po) : null
    });
  } catch (error) {
    console.error('Error in getGoodsReceiptById:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve goods receipt note.' });
  }
}

/**
 * DELETE /api/purchase-orders/:id
 * Delete a Purchase Order (only allowed if DRAFT or CANCELLED, and no receipts exist)
 */
function deletePurchaseOrder(req, res) {
  try {
    if (!hasPermission(req, 'Purchase Orders', 'Delete') && !hasPermission(req, 'Purchase Orders', 'Edit')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete purchase orders.' });
    }
    const { id } = req.params;
    const targetId = String(id || '').trim().toUpperCase();
    const index = purchaseOrders.findIndex((p) => (p.id || '').toUpperCase() === targetId || (p.purchaseOrderId || '').toUpperCase() === targetId);
    if (index === -1) {
      return res.status(404).json({ success: false, message: `Purchase Order ${id} not found.` });
    }

    const po = purchaseOrders[index];
    const hasReceipts = goodsReceipts.some((g) => (g.purchaseOrderId || '').toUpperCase() === po.id.toUpperCase() || (g.poNumber || '').toUpperCase() === po.id.toUpperCase());
    if (hasReceipts || po.status === 'PARTIALLY_RECEIVED' || po.status === 'RECEIVED') {
      return res.status(400).json({
        success: false,
        message: `Cannot delete Purchase Order ${po.id} because goods have already been received against it.`
      });
    }

    if (po.status !== 'DRAFT' && po.status !== 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: `Only DRAFT or CANCELLED purchase orders can be deleted. Current status: ${po.status}.`
      });
    }

    purchaseOrders.splice(index, 1);
    persistStore();

    return res.status(200).json({
      success: true,
      message: `Purchase Order ${po.id} deleted successfully.`
    });
  } catch (error) {
    console.error('Error in deletePurchaseOrder:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete purchase order.' });
  }
}

module.exports = {
  getPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  receiveGoods,
  getGoodsReceipts,
  getGoodsReceiptById
};
