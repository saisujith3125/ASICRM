const { suppliers, purchaseOrders, goodsReceipts, generateSupplierId, persistStore } = require('../data/crmStore');
const { hasPermission } = require('../utils/accessControl');

function enrichPurchaseOrder(po) {
  const items = Array.isArray(po.items) ? po.items : [];
  const totalOrderedQty = items.reduce((sum, it) => sum + (Number(it.orderedQty || it.quantity || 0)), 0);
  const totalReceivedQty = items.reduce((sum, it) => sum + (Number(it.receivedQty || 0)), 0);
  const totalPendingQty = Math.max(0, totalOrderedQty - totalReceivedQty);
  const percentReceived = totalOrderedQty > 0 ? Math.min(100, Math.round((totalReceivedQty / totalOrderedQty) * 100)) : 0;
  return {
    ...po,
    totalOrderedQty,
    totalReceivedQty,
    totalPendingQty,
    percentReceived,
    receiptProgress: `${totalReceivedQty} / ${totalOrderedQty} items`
  };
}

function doesPoBelongToSupplier(po, supplier) {
  if (!po || !supplier) return false;
  if (po.supplierId && (po.supplierId === supplier.id || po.supplierId === supplier.supplierId)) return true;
  if (po.supplierSnapshot?.id && (po.supplierSnapshot.id === supplier.id || po.supplierSnapshot.id === supplier.supplierId)) return true;
  const poName = String(po.supplierSnapshot?.companyName || '').trim().toLowerCase();
  const supName = String(supplier.companyName || '').trim().toLowerCase();
  return Boolean(poName && supName && poName === supName);
}

function doesGrnBelongToSupplier(grn, supplier, supplierPoIds) {
  if (!grn || !supplier) return false;
  if (grn.supplierId && (grn.supplierId === supplier.id || grn.supplierId === supplier.supplierId)) return true;
  if (supplierPoIds && (supplierPoIds.has(grn.purchaseOrderId) || supplierPoIds.has(grn.poNumber))) return true;
  const grnName = String(grn.supplierName || grn.supplierSnapshot?.companyName || '').trim().toLowerCase();
  const supName = String(supplier.companyName || '').trim().toLowerCase();
  return Boolean(grnName && supName && grnName === supName);
}

/**
 * GET /api/suppliers
 * List all suppliers, optionally filtered by ?search=
 * Enriched with sent POs, received GRNs, and procurement metrics
 */
function getSuppliers(req, res) {
  try {
    const search = String(req.query.search || '').trim().toLowerCase();
    let result = [...suppliers];

    if (search) {
      result = result.filter((s) => {
        const name = String(s.companyName || '').toLowerCase();
        const contact = String(s.contactPerson || '').toLowerCase();
        const phone = String(s.phone || '').toLowerCase();
        const email = String(s.email || '').toLowerCase();
        const city = String(s.city || '').toLowerCase();
        const gstin = String(s.gstin || '').toLowerCase();
        return (
          name.includes(search) ||
          contact.includes(search) ||
          phone.includes(search) ||
          email.includes(search) ||
          city.includes(search) ||
          gstin.includes(search)
        );
      });
    }

    // Enrich each supplier with aggregated PO & GRN statistics
    const enriched = result.map((supplier) => {
      const supOrders = (purchaseOrders || []).filter((po) => doesPoBelongToSupplier(po, supplier)).map(enrichPurchaseOrder);
      const supPoIds = new Set(supOrders.map((p) => p.id));
      const supReceipts = (goodsReceipts || []).filter((g) => doesGrnBelongToSupplier(g, supplier, supPoIds));

      let totalValue = 0;
      let sentCount = 0;
      let receivedCount = 0;
      let partiallyReceivedCount = 0;
      let draftCount = 0;
      let totalOrderedQty = 0;
      let totalReceivedQty = 0;
      let latestDate = supplier.createdAt || null;

      for (const po of supOrders) {
        if (po.status !== 'CANCELLED') {
          totalValue += Number(po.grandTotal || po.totalAmount || 0);
        }
        if (po.status === 'SENT') sentCount++;
        else if (po.status === 'RECEIVED') receivedCount++;
        else if (po.status === 'PARTIALLY_RECEIVED') partiallyReceivedCount++;
        else if (po.status === 'DRAFT') draftCount++;

        totalOrderedQty += Number(po.totalOrderedQty || 0);
        totalReceivedQty += Number(po.totalReceivedQty || 0);

        const poDate = po.orderDate || po.createdAt;
        if (poDate && (!latestDate || new Date(poDate) > new Date(latestDate))) {
          latestDate = poDate;
        }
      }

      return {
        ...supplier,
        totalOrders: supOrders.length,
        sentOrders: sentCount,
        receivedOrders: receivedCount,
        partiallyReceivedOrders: partiallyReceivedCount,
        draftOrders: draftCount,
        pendingOrders: sentCount + partiallyReceivedCount,
        totalGrns: supReceipts.length,
        totalProcurementValue: Number(totalValue.toFixed(2)),
        totalOrderedQty,
        totalReceivedQty,
        pendingQty: Math.max(0, totalOrderedQty - totalReceivedQty),
        lastOrderDate: latestDate
      };
    });

    enriched.sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''));

    return res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched
    });
  } catch (error) {
    console.error('Error in getSuppliers:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve suppliers.' });
  }
}

/**
 * GET /api/suppliers/:id
 * Returns supplier profile with all associated Purchase Orders and Goods Receipts
 */
function getSupplierById(req, res) {
  try {
    const rawId = String(req.params.id || '').trim();
    const cleanId = decodeURIComponent(rawId);
    const lowerId = cleanId.toLowerCase();

    let supplier = suppliers.find((s) =>
      s.id === cleanId ||
      s.supplierId === cleanId ||
      String(s.companyName || '').toLowerCase() === lowerId
    );

    // If not in suppliers master, check if present in purchase orders snapshot
    if (!supplier) {
      const matchPo = (purchaseOrders || []).find((po) =>
        po.supplierId === cleanId ||
        po.supplierSnapshot?.id === cleanId ||
        String(po.supplierSnapshot?.companyName || '').toLowerCase() === lowerId
      );
      if (matchPo && matchPo.supplierSnapshot) {
        supplier = {
          id: matchPo.supplierSnapshot.id || cleanId,
          supplierId: matchPo.supplierSnapshot.id || cleanId,
          companyName: matchPo.supplierSnapshot.companyName,
          contactPerson: matchPo.supplierSnapshot.contactPerson || '',
          phone: matchPo.supplierSnapshot.phone || '',
          email: matchPo.supplierSnapshot.email || '',
          gstin: matchPo.supplierSnapshot.gstin || '',
          address: matchPo.supplierSnapshot.address || '',
          city: matchPo.supplierSnapshot.city || '',
          state: matchPo.supplierSnapshot.state || '',
          pincode: matchPo.supplierSnapshot.pincode || '',
          createdAt: matchPo.createdAt || new Date().toISOString()
        };
      }
    }

    if (!supplier) {
      return res.status(404).json({ success: false, message: `Supplier "${cleanId}" not found.` });
    }

    // Associated purchase orders
    const supOrders = (purchaseOrders || [])
      .filter((po) => doesPoBelongToSupplier(po, supplier))
      .map(enrichPurchaseOrder);

    supOrders.sort((a, b) => new Date(b.orderDate || b.createdAt || 0) - new Date(a.orderDate || a.createdAt || 0));

    const supPoIds = new Set(supOrders.map((p) => p.id));

    // Associated goods receipts
    const supReceipts = (goodsReceipts || [])
      .filter((g) => doesGrnBelongToSupplier(g, supplier, supPoIds));

    supReceipts.sort((a, b) => new Date(b.receivedDate || b.createdAt || 0) - new Date(a.receivedDate || a.createdAt || 0));

    let totalValue = 0;
    let sentCount = 0;
    let receivedCount = 0;
    let partiallyReceivedCount = 0;
    let draftCount = 0;
    let cancelledCount = 0;
    let totalOrderedQty = 0;
    let totalReceivedQty = 0;

    for (const po of supOrders) {
      if (po.status !== 'CANCELLED') {
        totalValue += Number(po.grandTotal || po.totalAmount || 0);
      }
      if (po.status === 'SENT') sentCount++;
      else if (po.status === 'RECEIVED') receivedCount++;
      else if (po.status === 'PARTIALLY_RECEIVED') partiallyReceivedCount++;
      else if (po.status === 'DRAFT') draftCount++;
      else if (po.status === 'CANCELLED') cancelledCount++;

      totalOrderedQty += Number(po.totalOrderedQty || 0);
      totalReceivedQty += Number(po.totalReceivedQty || 0);
    }

    const payload = {
      ...supplier,
      purchaseOrders: supOrders,
      goodsReceipts: supReceipts,
      metrics: {
        totalOrders: supOrders.length,
        allDocuments: supOrders.length + supReceipts.length,
        sentOrders: sentCount,
        receivedOrders: receivedCount,
        partiallyReceivedOrders: partiallyReceivedCount,
        draftOrders: draftCount,
        cancelledOrders: cancelledCount,
        pendingDeliveries: sentCount + partiallyReceivedCount,
        totalGrns: supReceipts.length,
        totalProcurementValue: Number(totalValue.toFixed(2)),
        totalOrderedQty,
        totalReceivedQty,
        pendingQty: Math.max(0, totalOrderedQty - totalReceivedQty)
      }
    };

    return res.status(200).json({ success: true, data: payload });
  } catch (error) {
    console.error('Error in getSupplierById:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve supplier.' });
  }
}

/**
 * POST /api/suppliers
 * Create a new supplier
 */
function createSupplier(req, res) {
  try {
    const { companyName, contactPerson, phone, email, gstin, address, city, state, notes, pincode, pinCode } = req.body;

    const trimmedName = String(companyName || '').trim();
    if (!trimmedName) {
      return res.status(400).json({ success: false, message: 'Supplier company name is required.' });
    }

    // Duplicate detection: check for match on normalized company name, or matching GSTIN
    const normalizedName = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanGstin = String(gstin || '').trim().toUpperCase();

    const existingExact = suppliers.find((s) => {
      const sNorm = String(s.companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const sGstin = String(s.gstin || '').trim().toUpperCase();

      if (sNorm === normalizedName) return true;
      if (cleanGstin && sGstin && cleanGstin === sGstin) return true;
      return false;
    });

    if (existingExact) {
      return res.status(409).json({
        success: false,
        message: `Supplier already exists: "${existingExact.companyName}" (${existingExact.id}).`,
        existingSupplier: existingExact,
        existingId: existingExact.id
      });
    }

    const newId = generateSupplierId();
    const newSupplier = {
      id: newId,
      supplierId: newId,
      companyName: trimmedName,
      contactPerson: String(contactPerson || '').trim(),
      phone: String(phone || '').trim(),
      email: String(email || '').trim().toLowerCase(),
      gstin: cleanGstin,
      address: String(address || '').trim(),
      city: String(city || '').trim(),
      pincode: String(pincode || pinCode || '').trim(),
      state: String(state || '').trim(),
      notes: String(notes || '').trim(),
      createdAt: new Date().toISOString()
    };

    suppliers.push(newSupplier);
    persistStore();

    return res.status(201).json({
      success: true,
      message: 'Supplier created successfully.',
      data: newSupplier
    });
  } catch (error) {
    console.error('Error in createSupplier:', error);
    return res.status(500).json({ success: false, message: 'Failed to create supplier.' });
  }
}

/**
 * PATCH /api/suppliers/:id
 */
function updateSupplier(req, res) {
  try {
    const { id } = req.params;
    const supplier = suppliers.find((s) => s.id === id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: `Supplier ${id} not found.` });
    }

    const { companyName, contactPerson, phone, email, gstin, address, city, state, notes, pincode, pinCode } = req.body;

    if (companyName !== undefined) supplier.companyName = String(companyName).trim();
    if (contactPerson !== undefined) supplier.contactPerson = String(contactPerson).trim();
    if (phone !== undefined) supplier.phone = String(phone).trim();
    if (email !== undefined) supplier.email = String(email).trim().toLowerCase();
    if (gstin !== undefined) supplier.gstin = String(gstin).trim().toUpperCase();
    if (address !== undefined) supplier.address = String(address).trim();
    if (city !== undefined) supplier.city = String(city).trim();
    if (pincode !== undefined || pinCode !== undefined) supplier.pincode = String(pincode || pinCode || '').trim();
    if (state !== undefined) supplier.state = String(state).trim();
    if (notes !== undefined) supplier.notes = String(notes).trim();

    supplier.updatedAt = new Date().toISOString();
    persistStore();

    return res.status(200).json({
      success: true,
      message: 'Supplier updated successfully.',
      data: supplier
    });
  } catch (error) {
    console.error('Error in updateSupplier:', error);
    return res.status(500).json({ success: false, message: 'Failed to update supplier.' });
  }
}

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier
};
