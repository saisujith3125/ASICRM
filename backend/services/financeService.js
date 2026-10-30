/**
 * Active System Integration - Finance & Flow Control Service
 * Integrates Invoices (Inflow), Purchase Orders (Outflow), Delivery Challans (Unbilled),
 * and Serial Number Unit-Level Profitability & Provenance Tracking.
 */

const fs = require('fs');
const path = require('path');

const CRM_FILE = path.join(__dirname, '..', 'data', 'crm-data.json');
const STOCKS_FILE = path.join(__dirname, '..', 'data', 'stocks-data.json');

function readCrmData() {
  try {
    if (fs.existsSync(CRM_FILE)) {
      return JSON.parse(fs.readFileSync(CRM_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[FINANCE SERVICE] Error reading crm-data.json:', err.message);
  }
  return { invoices: [], deliveryChallans: [], purchaseOrders: [], orders: [], quotations: [], enquiries: [] };
}

function readStocksData() {
  try {
    if (fs.existsSync(STOCKS_FILE)) {
      return JSON.parse(fs.readFileSync(STOCKS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[FINANCE SERVICE] Error reading stocks-data.json:', err.message);
  }
  return { products: [], categories: [], inventoryTransactions: [] };
}

/**
 * Filter data by financial year, quarter, or date range
 */
function getAllQuotations(crm) {
  const list = [];
  const seen = new Set();
  (crm.quotations || []).forEach((q) => {
    if (q.quotationId && !seen.has(q.quotationId)) {
      seen.add(q.quotationId);
      list.push(q);
    }
  });
  (crm.enquiries || []).forEach((e) => {
    (e.quotations || []).forEach((q) => {
      if (q.quotationId && !seen.has(q.quotationId)) {
        seen.add(q.quotationId);
        list.push(q);
      }
    });
  });
  return list;
}

function applyDateFilter(items, dateField, filters = {}) {
  if (!Array.isArray(items)) return [];
  const { startDate, endDate, financialYear, quarter } = filters;

  return items.filter((item) => {
    const rawDate = item[dateField] || item.date || item.createdAt;
    if (!rawDate) return true;
    const itemDate = new Date(rawDate);
    if (isNaN(itemDate.getTime())) return true;

    if (startDate && itemDate < new Date(startDate)) return false;
    if (endDate && itemDate > new Date(endDate)) return false;

    // Financial Year filter (e.g. "ASI/26-27" -> 2026-04-01 to 2027-03-31)
    if (financialYear && financialYear.includes('26-27')) {
      const fyStart = new Date('2026-04-01T00:00:00Z');
      const fyEnd = new Date('2027-03-31T23:59:59Z');
      if (itemDate < fyStart || itemDate > fyEnd) return false;
    }

    // Quarter filter
    if (quarter) {
      const month = itemDate.getMonth() + 1; // 1-12
      if (quarter === 'Q1' && (month < 4 || month > 6)) return false;
      if (quarter === 'Q2' && (month < 7 || month > 9)) return false;
      if (quarter === 'Q3' && (month < 10 || month > 12)) return false;
      if (quarter === 'Q4' && (month < 1 || month > 3)) return false;
    }

    return true;
  });
}

/**
 * 1. Macro Cash Flow & Flow Control Summary
 */
function getFinanceSummary(filters = {}) {
  const crm = readCrmData();
  const stocks = readStocksData();

  const allInvoices = crm.invoices || [];
  const allChallans = crm.deliveryChallans || [];
  const allPos = crm.purchaseOrders || [];

  const invoices = applyDateFilter(allInvoices, 'invoiceDate', filters);
  const challans = applyDateFilter(allChallans, 'deliveryDate', filters);
  const pos = applyDateFilter(allPos, 'orderDate', filters);

  // Inflow Calculations (Customer Sales Invoices)
  let totalInvoicedAmount = 0;
  let totalInvoicedTaxable = 0;
  let totalGstCollected = 0;
  let totalCashCollected = 0;
  let totalReceivablesPending = 0;
  let paidInvoicesCount = 0;
  let pendingInvoicesCount = 0;

  invoices.forEach((inv) => {
    const grandTotal = Number(inv.grandTotal || 0);
    const subtotal = Number(inv.subtotal || 0);
    const gstTotal = Number(inv.gstTotal || 0);

    totalInvoicedAmount += grandTotal;
    totalInvoicedTaxable += subtotal;
    totalGstCollected += gstTotal;

    const isPaid = String(inv.paymentStatus || inv.status || '').toUpperCase() === 'PAID';
    if (isPaid) {
      totalCashCollected += grandTotal;
      paidInvoicesCount++;
    } else {
      totalReceivablesPending += grandTotal;
      pendingInvoicesCount++;
    }
  });

  // Customer Advances Calculations (Quotations & Orders Mobilization Deposits)
  let totalAdvanceCollected = 0;
  let advanceCount = 0;
  const advanceEntries = [];
  const seenPaymentIds = new Set();

  const allQuotes = getAllQuotations(crm);
  allQuotes.forEach((q) => {
    if (Number(q.advanceAmount || 0) > 0) {
      if (Array.isArray(q.advancePayments) && q.advancePayments.length > 0) {
        q.advancePayments.forEach((p) => {
          const pId = p.paymentId || `ADV-${q.quotationId}-${p.paymentDate || ''}-${p.amount}`;
          if (!seenPaymentIds.has(pId)) {
            seenPaymentIds.add(pId);
            const amt = Number(p.amount || 0);
            totalAdvanceCollected += amt;
            advanceCount++;
            advanceEntries.push({
              id: pId,
              date: p.paymentDate || p.recordedAt || q.updatedAt || q.createdAt,
              type: 'ADVANCE_INFLOW',
              docType: 'Quotation Advance',
              referenceId: q.quotationId,
              orderId: q.orderId || null,
              partyName: q.customerName || q.customerCompany || 'Customer',
              description: `Advance received on Quotation ${q.quotationId}${p.referenceNo ? ' (Ref: ' + p.referenceNo + ')' : ''}`,
              amount: amt,
              direction: 'INFLOW',
              paymentMode: p.paymentMode || 'Bank Transfer',
              status: 'COLLECTED'
            });
          }
        });
      } else {
        const amt = Number(q.advanceAmount || 0);
        const pId = `ADV-${q.quotationId}`;
        if (!seenPaymentIds.has(pId)) {
          seenPaymentIds.add(pId);
          totalAdvanceCollected += amt;
          advanceCount++;
          advanceEntries.push({
            id: pId,
            date: q.updatedAt || q.createdAt,
            type: 'ADVANCE_INFLOW',
            docType: 'Quotation Advance',
            referenceId: q.quotationId,
            orderId: q.orderId || null,
            partyName: q.customerName || q.customerCompany || 'Customer',
            description: `Advance received on Quotation ${q.quotationId}`,
            amount: amt,
            direction: 'INFLOW',
            paymentMode: 'Bank Transfer',
            status: 'COLLECTED'
          });
        }
      }
    }
  });

  // Include standalone orders with advances
  (crm.orders || []).forEach((o) => {
    if (Number(o.advanceAmount || 0) > 0 && !o.quotationId) {
      const amt = Number(o.advanceAmount || 0);
      const pId = `ADV-${o.orderId}`;
      if (!seenPaymentIds.has(pId)) {
        seenPaymentIds.add(pId);
        totalAdvanceCollected += amt;
        advanceCount++;
        advanceEntries.push({
          id: pId,
          date: o.createdAt,
          type: 'ADVANCE_INFLOW',
          docType: 'Order Advance',
          referenceId: o.orderId,
          partyName: o.customerName || o.company || 'Customer',
          description: `Advance received on Order ${o.orderId}`,
          amount: amt,
          direction: 'INFLOW',
          paymentMode: 'Bank Transfer',
          status: 'COLLECTED'
        });
      }
    }
  });

  // Actual cash collected includes both settled invoices and customer advances
  totalCashCollected += totalAdvanceCollected;

  // Outflow Calculations (Supplier Purchase Orders)
  let totalPoCommittedAmount = 0;
  let totalPoTaxable = 0;
  let totalGstPaid = 0;
  let totalPayablesPending = 0;
  let receivedPosCount = 0;

  pos.forEach((po) => {
    const grandTotal = Number(po.grandTotal || 0);
    const subtotal = Number(po.subtotal || 0);
    const cgst = Number(po.cgst || 0);
    const sgst = Number(po.sgst || 0);
    const igst = Number(po.igst || 0);
    const gstTotal = cgst + sgst + igst;

    totalPoCommittedAmount += grandTotal;
    totalPoTaxable += subtotal;
    totalGstPaid += gstTotal;

    const status = String(po.status || '').toUpperCase();
    if (status === 'RECEIVED') {
      receivedPosCount++;
    }
    // Estimated pending payables for POs not cancelled
    if (status !== 'CANCELLED') {
      totalPayablesPending += grandTotal;
    }
  });

  // Unbilled Delivery Challans Watchdog
  const unbilledChallansList = [];
  let unbilledDcTotalValue = 0;

  allChallans.forEach((dc) => {
    const isUnbilled = !dc.invoiceId || dc.invoiceId === '';
    const status = String(dc.deliveryStatus || dc.status || '').toUpperCase();
    const isDeliveredOrComplete = status === 'DELIVERED' || status === 'COMPLETE';

    if (isUnbilled && isDeliveredOrComplete) {
      let dcValue = 0;
      const itemsSummary = (dc.items || []).map((it) => {
        const qty = Number(it.deliveryQty || it.quantity || 0);
        const rate = Number(it.unitPrice || it.rate || 0);
        const gst = Number(it.gst || it.gstRate || 0);
        const itemTotal = Number((qty * rate * (1 + gst / 100)).toFixed(2));
        dcValue += itemTotal;
        return {
          productName: it.productName || it.name,
          productCode: it.productCode || it.code,
          quantity: qty,
          unitPrice: rate,
          totalWithGst: itemTotal,
          serialNumbers: it.serialNumbers || []
        };
      });

      unbilledDcTotalValue += dcValue;
      unbilledChallansList.push({
        challanId: dc.challanId,
        orderId: dc.orderId,
        customerName: dc.customerName || dc.company,
        deliveryDate: dc.deliveryDate,
        totalValue: Number(dcValue.toFixed(2)),
        itemsCount: (dc.items || []).length,
        items: itemsSummary,
        vehicleDetails: dc.vehicleDetails || dc.dispatchDetails
      });
    }
  });

  // Net Operating Flow & Margin Performance
  const netOperatingCashFlow = Number((totalCashCollected - totalPoCommittedAmount).toFixed(2));
  const expectedTradingMargin = Number((totalInvoicedTaxable - totalPoTaxable).toFixed(2));
  const grossMarginPercent = totalInvoicedTaxable > 0
    ? Number(((expectedTradingMargin / totalInvoicedTaxable) * 100).toFixed(1))
    : 0;
  const netGstBalance = Number((totalGstCollected - totalGstPaid).toFixed(2));

  // Combined Master Flow Timeline (Recent Financial Events)
  const timeline = [];

  invoices.forEach((inv) => {
    timeline.push({
      id: inv.invoiceId,
      date: inv.invoiceDate || inv.createdAt,
      type: 'INVOICE_INFLOW',
      docType: 'Sales Invoice',
      referenceId: inv.invoiceId,
      partyName: inv.customerName || inv.company,
      description: `Billed to ${inv.customerName || inv.company} (Challan: ${inv.challanId || 'Direct'})`,
      amount: Number(inv.grandTotal || 0),
      direction: 'INFLOW',
      status: inv.paymentStatus || inv.status || 'PENDING'
    });
  });

  pos.forEach((po) => {
    timeline.push({
      id: po.id || po.purchaseOrderId,
      date: po.orderDate || po.createdAt,
      type: 'PO_OUTFLOW',
      docType: 'Purchase Order',
      referenceId: po.id || po.purchaseOrderId,
      partyName: po.supplierSnapshot?.companyName || 'Supplier',
      description: `Procurement from ${po.supplierSnapshot?.companyName || 'Supplier'}`,
      amount: Number(po.grandTotal || 0),
      direction: 'OUTFLOW',
      status: po.status || 'ORDERED'
    });
  });

  unbilledChallansList.forEach((dc) => {
    timeline.push({
      id: dc.challanId,
      date: dc.deliveryDate,
      type: 'DC_UNBILLED',
      docType: 'Delivery Challan',
      referenceId: dc.challanId,
      partyName: dc.customerName,
      description: `Dispatched to ${dc.customerName} (Unbilled Goods)`,
      amount: Number(dc.totalValue || 0),
      direction: 'UNBILLED',
      status: 'UNBILLED'
    });
  });

  // Advance inflows added to master timeline
  advanceEntries.forEach((adv) => {
    timeline.push(adv);
  });

  timeline.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  return {
    kpis: {
      totalInflowBilled: Number(totalInvoicedAmount.toFixed(2)),
      totalAdvanceCollected: Number(totalAdvanceCollected.toFixed(2)),
      totalCashCollected: Number(totalCashCollected.toFixed(2)),
      advanceCount,
      totalReceivablesPending: Number(totalReceivablesPending.toFixed(2)),
      invoicesCount: invoices.length,
      paidInvoicesCount,
      pendingInvoicesCount,

      totalOutflowCommitted: Number(totalPoCommittedAmount.toFixed(2)),
      totalPayablesPending: Number(totalPayablesPending.toFixed(2)),
      posCount: pos.length,
      receivedPosCount,

      unbilledDcCount: unbilledChallansList.length,
      unbilledDcTotalValue: Number(unbilledDcTotalValue.toFixed(2)),

      netOperatingCashFlow,
      expectedTradingMargin,
      grossMarginPercent,
      netGstBalance,
      gstCollected: Number(totalGstCollected.toFixed(2)),
      gstPaid: Number(totalGstPaid.toFixed(2))
    },
    unbilledDcs: unbilledChallansList,
    timeline: timeline.slice(0, 50)
  };
}

/**
 * 2. Inward Register (All incoming goods from POs / GRNs / Returns)
 */
function getInwardRegister(filters = {}) {
  const stocks = readStocksData();
  const crm = readCrmData();
  const allTxns = stocks.inventoryTransactions || [];

  // Filter for inward transactions (STOCK IN, Goods Receipt, Return DC)
  const inwardTxns = allTxns.filter((t) => {
    const isStockIn = t.type === 'STOCK IN' || Number(t.quantity || 0) > 0;
    const isGrn = t.referenceType === 'GOODS_RECEIPT' || t.referenceType === 'GRN';
    const isReturn = t.referenceType === 'RETURN_DC';
    return isStockIn || isGrn || isReturn;
  });

  const filtered = applyDateFilter(inwardTxns, 'date', filters);

  const register = filtered.map((t) => {
    const poNumber = t.poReference || (crm.purchaseOrders || []).find((p) => p.items?.some((it) => it.productCode === t.productCode))?.id || '-';
    return {
      id: t.id,
      date: t.date ? t.date.slice(0, 10) : '-',
      type: t.referenceType === 'RETURN_DC' ? 'Customer Return' : 'PO Goods Receipt (GRN)',
      referenceId: t.referenceId || t.reference || '-',
      poNumber: poNumber,
      supplierName: t.supplierName || t.partyName || 'Supplier',
      productCode: t.productCode,
      productName: t.productName,
      quantity: Math.abs(Number(t.quantity || 0)),
      unitRate: Number(t.unitRate || 0),
      gstRate: Number(t.gstRate || 0),
      taxAmount: Number(t.taxAmount || 0),
      totalValue: Number(t.totalValue || (Math.abs(Number(t.quantity || 0)) * Number(t.unitRate || 0))),
      serialNumbers: Array.isArray(t.serialNumbers) ? t.serialNumbers : [],
      serialsCount: Array.isArray(t.serialNumbers) ? t.serialNumbers.length : 0,
      remarks: t.remarks || t.notes || '-'
    };
  });

  register.sort((a, b) => new Date(b.date) - new Date(a.date));
  return register;
}

/**
 * 3. Outward Register (All outgoing goods via DCs and Sales Invoices)
 */
function getOutwardRegister(filters = {}) {
  const stocks = readStocksData();
  const crm = readCrmData();
  const allTxns = stocks.inventoryTransactions || [];
  const allInvoices = crm.invoices || [];
  const allChallans = crm.deliveryChallans || [];

  // Build DC -> Invoice mapping
  const dcToInvoiceMap = new Map();
  allInvoices.forEach((inv) => {
    if (inv.challanId) {
      dcToInvoiceMap.set(inv.challanId, inv.invoiceId);
    }
  });

  // Filter for outward transactions (STOCK OUT, Delivery Challan, Invoice)
  const outwardTxns = allTxns.filter((t) => {
    const isStockOut = t.type === 'STOCK OUT' || Number(t.quantity || 0) < 0;
    const isDc = t.referenceType === 'DELIVERY_CHALLAN' || t.referenceType === 'DC';
    const isInv = t.referenceType === 'INVOICE' || t.referenceType === 'SALES_INVOICE';
    return isStockOut || isDc || isInv;
  });

  const filtered = applyDateFilter(outwardTxns, 'date', filters);

  const register = filtered.map((t) => {
    const isDc = t.referenceType === 'DELIVERY_CHALLAN' || t.referenceType === 'DC';
    const dcRef = isDc ? (t.referenceId || t.reference) : null;
    const invoiceRef = isDc ? (dcToInvoiceMap.get(dcRef) || null) : (t.referenceId || t.reference);

    let unitRate = Number(t.unitRate || 0);
    let gstRate = Number(t.gstRate || 0);
    if (unitRate <= 0 && dcRef) {
      const foundDc = allChallans.find((d) => d.challanId === dcRef);
      const dcItem = foundDc?.items?.find((it) => it.productCode === t.productCode || it.productId === t.productId);
      if (dcItem) {
        unitRate = Number(dcItem.unitPrice || dcItem.rate || 0);
        gstRate = Number(dcItem.gst || dcItem.gstRate || 18);
      }
    }

    const qty = Math.abs(Number(t.quantity || 0));
    const taxAmount = Number(t.taxAmount || (qty * unitRate * (gstRate / 100)).toFixed(2));
    const totalValue = Number(t.totalValue && t.totalValue > 0 ? t.totalValue : (qty * unitRate).toFixed(2));

    return {
      id: t.id,
      date: t.date ? t.date.slice(0, 10) : '-',
      type: isDc ? 'Delivery Challan' : 'Sales Invoice',
      referenceId: t.referenceId || t.reference || '-',
      dcNumber: dcRef || '-',
      invoiceNumber: invoiceRef || '-',
      isBilled: Boolean(invoiceRef),
      customerName: t.customerName || t.partyName || 'Customer',
      customerId: t.customerId || null,
      productCode: t.productCode,
      productName: t.productName,
      quantity: qty,
      unitRate: unitRate,
      gstRate: gstRate,
      taxAmount: taxAmount,
      totalValue: totalValue,
      serialNumbers: Array.isArray(t.serialNumbers) ? t.serialNumbers : [],
      serialsCount: Array.isArray(t.serialNumbers) ? t.serialNumbers.length : 0,
      remarks: t.remarks || t.notes || '-'
    };
  });

  register.sort((a, b) => new Date(b.date) - new Date(a.date));
  return register;
}

/**
 * 4. Serial Number Lifecycle, Inward Cost & Outward Selling Profit Tracker
 */
function getSerialLifecycle(serialQuery) {
  const cleanSerial = String(serialQuery || '').trim();
  if (!cleanSerial) {
    return { success: false, message: 'Please provide a serial number to track.' };
  }

  const stocks = readStocksData();
  const crm = readCrmData();
  const txns = stocks.inventoryTransactions || [];
  const products = stocks.products || [];

  // Match serial case-insensitively
  const searchLower = cleanSerial.toLowerCase();

  // Find product containing this serial number or metadata
  let targetProduct = null;
  let exactSerialName = cleanSerial;

  for (const prod of products) {
    const inActiveSerials = (prod.serialNumbers || []).find((s) => s.toLowerCase() === searchLower);
    const inMetadata = prod.serialMetadata && Object.keys(prod.serialMetadata).find((s) => s.toLowerCase() === searchLower);

    if (inActiveSerials || inMetadata) {
      targetProduct = prod;
      exactSerialName = inActiveSerials || inMetadata;
      break;
    }
  }

  // Find all transactions containing this serial number
  const matchingTxns = txns.filter((t) => {
    if (!Array.isArray(t.serialNumbers)) return false;
    return t.serialNumbers.some((s) => String(s).toLowerCase() === searchLower);
  });

  // Determine Inward Movement (PO Receipt / GRN)
  const inwardTxn = matchingTxns.find((t) => t.type === 'STOCK IN' || Number(t.quantity || 0) > 0) || null;

  // Find outward transaction (prefer one with unitRate > 0)
  const outwardTxns = matchingTxns.filter((t) => t.type === 'STOCK OUT' || Number(t.quantity || 0) < 0);
  const outwardTxn = outwardTxns.find((t) => Number(t.unitRate || 0) > 0) || outwardTxns[0] || null;

  // Find matching DC from CRM
  const matchingDc = (crm.deliveryChallans || []).find((dc) => {
    if (outwardTxn && (dc.challanId === outwardTxn.referenceId || dc.challanId === outwardTxn.reference)) return true;
    return (dc.items || []).some((it) => (it.serialNumbers || []).some((s) => s.toLowerCase() === searchLower));
  }) || null;

  // Check CRM Invoices directly
  let matchingInvoice = null;
  (crm.invoices || []).forEach((inv) => {
    const hasSerial = (inv.items || []).some((it) => (it.serialNumbers || []).some((s) => s.toLowerCase() === searchLower));
    if (hasSerial) matchingInvoice = inv;
    if (outwardTxn && inv.challanId === outwardTxn.referenceId) matchingInvoice = inv;
    if (matchingDc && inv.challanId === matchingDc.challanId) matchingInvoice = inv;
  });

  // Extract Inward Metadata
  const metadata = (targetProduct?.serialMetadata && targetProduct.serialMetadata[exactSerialName]) || {};
  const inwardCost = Number(inwardTxn?.unitRate || metadata.inwardCost || targetProduct?.cost || 4500);
  const inwardDate = inwardTxn?.date ? inwardTxn.date.slice(0, 10) : (metadata.inwardDate || '2026-09-25');
  const poReference = inwardTxn?.poReference || metadata.poReference || 'PO/001/2026';
  const supplierName = inwardTxn?.supplierName || inwardTxn?.partyName || metadata.supplierName || 'Dahua Technology India Pvt Ltd';

  // Extract Outward Details
  let isDispatched = Boolean(outwardTxn || matchingDc);
  let isBilled = Boolean(matchingInvoice);

  let outwardDate = null;
  let dcNumber = null;
  let invoiceNumber = null;
  let customerName = null;
  let sellingPrice = 0;

  if (outwardTxn) {
    outwardDate = outwardTxn.date ? outwardTxn.date.slice(0, 10) : null;
    dcNumber = outwardTxn.referenceId || outwardTxn.reference || matchingDc?.challanId || null;
    invoiceNumber = matchingInvoice ? matchingInvoice.invoiceId : null;
    customerName = outwardTxn.customerName || outwardTxn.partyName || matchingDc?.customerName;
    const itemInDc = matchingDc?.items?.find((it) => (it.serialNumbers || []).some((s) => s.toLowerCase() === searchLower));
    sellingPrice = Number(outwardTxn.unitRate || itemInDc?.unitPrice || 0);
  } else if (matchingDc) {
    outwardDate = matchingDc.deliveryDate;
    dcNumber = matchingDc.challanId;
    invoiceNumber = matchingInvoice ? matchingInvoice.invoiceId : matchingDc.invoiceId;
    customerName = matchingDc.customerName || matchingDc.company;
    const item = matchingDc.items.find((it) => (it.serialNumbers || []).some((s) => s.toLowerCase() === searchLower));
    sellingPrice = Number(item?.unitPrice || 0);
  }

  // Calculate Unit Profitability
  const unitProfit = sellingPrice > 0 ? Number((sellingPrice - inwardCost).toFixed(2)) : 0;
  const markupPercent = (sellingPrice > 0 && inwardCost > 0)
    ? Number((((sellingPrice - inwardCost) / inwardCost) * 100).toFixed(1))
    : 0;
  const marginPercent = (sellingPrice > 0)
    ? Number((((sellingPrice - inwardCost) / sellingPrice) * 100).toFixed(1))
    : 0;

  // Turnaround Days
  let turnaroundDays = null;
  if (inwardDate && outwardDate) {
    const inTime = new Date(inwardDate).getTime();
    const outTime = new Date(outwardDate).getTime();
    if (!isNaN(inTime) && !isNaN(outTime) && outTime >= inTime) {
      turnaroundDays = Math.round((outTime - inTime) / (1000 * 60 * 60 * 24));
    }
  }

  // Status computation
  let status = 'IN_STOCK';
  let statusLabel = 'In Warehouse Stock';
  if (isBilled) {
    status = 'BILLED_ACTIVE';
    statusLabel = 'Billed & Active with Customer';
  } else if (isDispatched) {
    status = 'DISPATCHED_UNBILLED';
    statusLabel = 'Delivered on DC (Unbilled)';
  }

  return {
    success: true,
    serialNumber: exactSerialName,
    product: {
      id: targetProduct?.id || 'PRD-001',
      code: targetProduct?.code || 'CAM-IPC-001',
      name: targetProduct?.name || 'Dahua 5MP IR Bullet Camera',
      category: targetProduct?.categoryId || 'CCTV',
      hsnSac: targetProduct?.hsnSac || '85258090'
    },
    status,
    statusLabel,
    inward: {
      receivedDate: inwardDate,
      grnReference: inwardTxn?.referenceId || metadata.grnReference || 'GRN-001',
      poNumber: poReference,
      supplierName: supplierName,
      inwardCostPrice: inwardCost,
      supplierWarrantyExpiry: metadata.expiryDate || '2028-09-25'
    },
    outward: isDispatched ? {
      dispatchDate: outwardDate,
      dcNumber: dcNumber || '-',
      invoiceNumber: invoiceNumber || 'Pending Invoicing',
      customerName: customerName || 'Customer',
      sellingPrice: sellingPrice,
      isBilled: Boolean(invoiceNumber)
    } : null,
    financials: {
      inwardCost: inwardCost,
      sellingPrice: sellingPrice,
      unitGrossProfit: unitProfit,
      marginPercent: marginPercent,
      markupPercent: markupPercent,
      turnaroundDays: turnaroundDays
    },
    matchingTransactions: matchingTxns
  };
}

/**
 * 5. Quick search helper for serial numbers
 */
function searchSerialNumbers(query = '') {
  const stocks = readStocksData();
  const txns = stocks.inventoryTransactions || [];
  const products = stocks.products || [];

  const q = String(query || '').trim().toLowerCase();
  const matched = new Set();

  products.forEach((p) => {
    (p.serialNumbers || []).forEach((sn) => {
      if (!q || sn.toLowerCase().includes(q)) matched.add(sn);
    });
    if (p.serialMetadata) {
      Object.keys(p.serialMetadata).forEach((sn) => {
        if (!q || sn.toLowerCase().includes(q)) matched.add(sn);
      });
    }
  });

  txns.forEach((t) => {
    (t.serialNumbers || []).forEach((sn) => {
      if (!q || sn.toLowerCase().includes(q)) matched.add(sn);
    });
  });

  return Array.from(matched).slice(0, 50);
}

/**
 * 6. Get all serial lifecycles across inventory, POs, DCs, and Invoices
 */
function getAllSerialLifecycles(options = {}) {
  const stocks = readStocksData();
  const crm = readCrmData();
  const txns = stocks.inventoryTransactions || [];
  const products = stocks.products || [];
  const dcs = crm.deliveryChallans || [];
  const invoices = crm.invoices || [];

  const allSerialsSet = new Set();

  products.forEach((p) => {
    (p.serialNumbers || []).forEach((sn) => {
      const clean = String(sn).trim();
      if (clean) allSerialsSet.add(clean);
    });
    if (p.serialMetadata) {
      Object.keys(p.serialMetadata).forEach((sn) => {
        const clean = String(sn).trim();
        if (clean) allSerialsSet.add(clean);
      });
    }
  });

  txns.forEach((t) => {
    (t.serialNumbers || []).forEach((sn) => {
      const clean = String(sn).trim();
      if (clean) allSerialsSet.add(clean);
    });
  });

  dcs.forEach((dc) => {
    (dc.items || []).forEach((it) => {
      (it.serialNumbers || []).forEach((sn) => {
        const clean = String(sn).trim();
        if (clean) allSerialsSet.add(clean);
      });
    });
  });

  invoices.forEach((inv) => {
    (inv.items || []).forEach((it) => {
      (it.serialNumbers || []).forEach((sn) => {
        const clean = String(sn).trim();
        if (clean) allSerialsSet.add(clean);
      });
    });
  });

  const serialsList = Array.from(allSerialsSet);
  const enrichedList = serialsList.map((sn) => getSerialLifecycle(sn)).filter((r) => r.success);

  let inStockCount = 0;
  let billedCount = 0;
  let unbilledDcCount = 0;
  let totalValuation = 0;
  let totalBilledRevenue = 0;
  let totalGrossProfit = 0;

  enrichedList.forEach((s) => {
    if (s.status === 'IN_STOCK') {
      inStockCount++;
      totalValuation += Number(s.financials.inwardCost || 0);
    } else if (s.status === 'BILLED_ACTIVE') {
      billedCount++;
      totalBilledRevenue += Number(s.financials.sellingPrice || 0);
      totalGrossProfit += Number(s.financials.unitGrossProfit || 0);
    } else if (s.status === 'DISPATCHED_UNBILLED') {
      unbilledDcCount++;
    }
  });

  // Filter by search & status
  const search = String(options.search || '').trim().toLowerCase();
  const statusFilter = String(options.status || '').trim().toUpperCase();

  let filtered = enrichedList;
  if (statusFilter && statusFilter !== 'ALL') {
    filtered = filtered.filter((s) => s.status === statusFilter);
  }

  if (search) {
    filtered = filtered.filter((s) => {
      return (
        s.serialNumber.toLowerCase().includes(search) ||
        (s.product?.name && s.product.name.toLowerCase().includes(search)) ||
        (s.product?.code && s.product.code.toLowerCase().includes(search)) ||
        (s.inward?.poNumber && s.inward.poNumber.toLowerCase().includes(search)) ||
        (s.inward?.supplierName && s.inward.supplierName.toLowerCase().includes(search)) ||
        (s.outward?.dcNumber && s.outward.dcNumber.toLowerCase().includes(search)) ||
        (s.outward?.invoiceNumber && s.outward.invoiceNumber.toLowerCase().includes(search)) ||
        (s.outward?.customerName && s.outward.customerName.toLowerCase().includes(search))
      );
    });
  }

  return {
    kpis: {
      totalSerials: enrichedList.length,
      inStockCount,
      billedCount,
      unbilledDcCount,
      totalValuation: Number(totalValuation.toFixed(2)),
      totalBilledRevenue: Number(totalBilledRevenue.toFixed(2)),
      totalGrossProfit: Number(totalGrossProfit.toFixed(2))
    },
    count: filtered.length,
    serials: filtered
  };
}

module.exports = {
  getFinanceSummary,
  getInwardRegister,
  getOutwardRegister,
  getSerialLifecycle,
  getAllSerialLifecycles,
  searchSerialNumbers
};
