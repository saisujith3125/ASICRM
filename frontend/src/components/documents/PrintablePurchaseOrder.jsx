import React, { useMemo, useState } from 'react';
import {
  useCompanyConfig,
  getMergedCompanySettings,
  AsiLogo,
  AsiOfficialSeal,
  ASI_WATERMARK_LOGO,
  DEFAULT_ASI_LOGO
} from './companyConfig';
import {
  formatPlainNumber,
  formatDocDate,
  amountInWords,
  normalizePartyLines
} from './documentFormatters';
import './documentStyles.css';

/**
 * Creates the Canonical Purchase Order View Model from raw PO data, company settings,
 * and desired fulfillment scope ('ALL' | 'RECEIVED_ONLY' | 'PENDING_ONLY').
 * Single source of truth across Browser Preview, Browser Print, and Downloaded PDF.
 */
export function normalizePurchaseOrderDocument(poData = {}, customSettings = {}, fulfillmentMode = 'ALL') {
  const comp = getMergedCompanySettings(customSettings || poData.companyDetails || {});

  // Clean company phone: canonical phone format
  let cleanPhone = (comp.phone || '09994126666').toString().trim();
  if (cleanPhone.includes('/') || cleanPhone.includes(',')) {
    cleanPhone = cleanPhone.split(/[/,]/)[0].trim();
  }

  const poNumber = (
    poData.id ||
    poData.purchaseOrderId ||
    poData.poNumber ||
    'PO-PENDING'
  ).toString().trim();

  const poDate = formatDocDate(poData.orderDate || poData.createdAt || new Date(), 'purchaseOrders');
  const deliveryDue = poData.expectedDeliveryDate
    ? formatDocDate(poData.expectedDeliveryDate, 'purchaseOrders')
    : (poData.deliveryDue ? formatDocDate(poData.deliveryDue, 'purchaseOrders') : '—');

  const paymentTerms = (poData.paymentTerms || 'Net 30 Days').toString().trim();

  // Normalize Supplier details
  const rawSup = poData.supplierSnapshot || poData.supplier || {};
  const rawSupplierName = (rawSup.companyName || rawSup.name || poData.supplierName || 'Vendor / Supplier').toString().trim();
  const rawSupplierContact = (rawSup.contactPerson || rawSup.attn || poData.supplierContact || '').toString().trim();
  const supplierParty = normalizePartyLines(rawSupplierName, rawSupplierContact);
  const supplierName = supplierParty.primaryLine;
  const supplierContact = supplierParty.secondaryLine || '';
  const supplierAddress = (rawSup.address || '').toString().trim();
  const supplierCity = (rawSup.city || '').toString().trim();
  const supplierState = (rawSup.state || '').toString().trim();
  const supplierPincode = (rawSup.pincode || '').toString().trim();
  const supplierPhone = (rawSup.phone || rawSup.mobile || '').toString().trim();
  const supplierEmail = (rawSup.email || '').toString().trim();
  const supplierGstin = (rawSup.gstin || '').toString().trim();

  // Normalize Shipping / Delivery details
  const deliveryAddress = (
    poData.deliveryAddress ||
    comp.address ||
    'Plot No. 10A, Perumal Kovil Street, Sivabootham, Vanagaram, Chennai - 600095'
  ).toString().trim();

  // Canonical product master HSN map fallback for known catalog products
  const productCodeHsnMap = {
    'CAM-IPC-001': '85258090',
    'CAM-IPC-002': '85258090',
    'NVR-008-001': '85219090',
    'NET-SW-001': '85176290',
    'HDD-1TB-001': '84717020'
  };

  // Normalize Items with 3-Way Inward & Financial Calculations
  const rawItems = Array.isArray(poData.items) ? poData.items : [];
  let totalOrdQty = 0;
  let totalRecQty = 0;
  let totalPendQty = 0;

  let ordTaxableTotal = 0;
  let ordTaxTotal = 0;
  let recTaxableTotal = 0;
  let recTaxTotal = 0;
  let pendTaxableTotal = 0;
  let pendTaxTotal = 0;

  const normalizedItems = rawItems.map((it, idx) => {
    const ordered = Number(it.orderedQty || it.quantity || it.qty || 0);
    const recd = Number(it.receivedQty || 0);
    const pend = Math.max(0, ordered - recd);
    const rate = Number(it.rate || it.unitPrice || 0);
    const gstRate = Number(it.gstRate || it.gst || it.taxRate || 18);
    const discountPct = Number(it.discountPercent || it.discountPct || it.discount || 0);

    // Full Ordered Line calculations
    const ordRaw = rate * ordered;
    const ordDisc = Number(it.discountAmount !== undefined ? it.discountAmount : (ordRaw * discountPct) / 100);
    const ordTaxable = Math.max(0, ordRaw - ordDisc);
    const ordTax = (ordTaxable * gstRate) / 100;
    const ordLineTotal = ordTaxable + ordTax;

    // Received Line calculations (Inward Fulfilled)
    const recRaw = rate * recd;
    const recDisc = (recRaw * discountPct) / 100;
    const recTaxable = Math.max(0, recRaw - recDisc);
    const recTax = (recTaxable * gstRate) / 100;
    const recLineTotal = recTaxable + recTax;

    // Pending Line calculations (Outstanding Balance)
    const pendRaw = rate * pend;
    const pendDisc = (pendRaw * discountPct) / 100;
    const pendTaxable = Math.max(0, pendRaw - pendDisc);
    const pendTax = (pendTaxable * gstRate) / 100;
    const pendLineTotal = pendTaxable + pendTax;

    totalOrdQty += ordered;
    totalRecQty += recd;
    totalPendQty += pend;

    ordTaxableTotal += ordTaxable;
    ordTaxTotal += ordTax;
    recTaxableTotal += recTaxable;
    recTaxTotal += recTax;
    pendTaxableTotal += pendTaxable;
    pendTaxTotal += pendTax;

    const pCode = (it.productCode || it.sku || it.code || '').toString().trim();
    let hsn = (it.hsnSac || it.hsn || it.hsnCode || '').toString().trim();
    if (!hsn || hsn === '-' || hsn === '—') {
      if (pCode && productCodeHsnMap[pCode]) {
        hsn = productCodeHsnMap[pCode];
      }
    }
    if (!hsn) hsn = '—';

    return {
      sl: idx + 1,
      productId: it.productId || it.id,
      productName: (it.productName || it.name || it.item || 'Item').toString().trim(),
      productCode: pCode,
      description: (it.description || '').toString().trim(),
      hsnSac: hsn,
      unit: ((it.unit && it.unit !== 'Piece') ? it.unit : 'Nos').toString().trim(),
      rate,
      gstRate,
      discountPercent: discountPct,
      orderedQty: ordered,
      orderedTaxable,
      orderedTax,
      orderedLineTotal,
      receivedQty: recd,
      receivedTaxable: recTaxable,
      receivedTax: recTax,
      receivedLineTotal: recLineTotal,
      pendingQty: pend,
      pendingTaxable: pendTaxable,
      pendingTax: pendTax,
      pendingLineTotal: pendLineTotal,
      serialized: Boolean(it.serialized || it.isSerialized),
      serialNumbers: Array.isArray(it.serialNumbers) ? it.serialNumbers : []
    };
  });

  // Calculate 3 financial summaries
  const ordGross = ordTaxableTotal + ordTaxTotal;
  const ordGrand = Math.round(ordGross);
  const ordRoundOff = Number((ordGrand - ordGross).toFixed(2));

  const recGross = recTaxableTotal + recTaxTotal;
  const recGrand = Math.round(recGross);
  const recRoundOff = Number((recGrand - recGross).toFixed(2));

  const pendGross = pendTaxableTotal + pendTaxTotal;
  const pendGrand = Math.round(pendGross);
  const pendRoundOff = Number((pendGrand - pendGross).toFixed(2));

  // Determine active view items and totals based on fulfillmentMode
  let activeItems = [];
  let activeSubtotal = 0;
  let activeTaxTotal = 0;
  let activeGrandTotal = 0;
  let activeRoundOff = 0;
  let activeQty = 0;

  if (fulfillmentMode === 'RECEIVED_ONLY') {
    activeItems = normalizedItems
      .filter((it) => it.receivedQty > 0)
      .map((it, idx) => ({
        ...it,
        sl: idx + 1,
        qty: it.receivedQty,
        taxableValue: it.receivedTaxable,
        tax: it.receivedTax,
        lineTotal: it.receivedLineTotal
      }));
    activeSubtotal = Number(recTaxableTotal.toFixed(2));
    activeTaxTotal = Number(recTaxTotal.toFixed(2));
    activeGrandTotal = recGrand;
    activeRoundOff = recRoundOff;
    activeQty = totalRecQty;
  } else if (fulfillmentMode === 'PENDING_ONLY') {
    activeItems = normalizedItems
      .filter((it) => it.pendingQty > 0)
      .map((it, idx) => ({
        ...it,
        sl: idx + 1,
        qty: it.pendingQty,
        taxableValue: it.pendingTaxable,
        tax: it.pendingTax,
        lineTotal: it.pendingLineTotal
      }));
    activeSubtotal = Number(pendTaxableTotal.toFixed(2));
    activeTaxTotal = Number(pendTaxTotal.toFixed(2));
    activeGrandTotal = pendGrand;
    activeRoundOff = pendRoundOff;
    activeQty = totalPendQty;
  } else {
    // 'ALL'
    activeItems = normalizedItems.map((it) => ({
      ...it,
      qty: it.orderedQty,
      taxableValue: it.orderedTaxable,
      tax: it.orderedTax,
      lineTotal: it.orderedLineTotal
    }));
    activeSubtotal = Number(ordTaxableTotal.toFixed(2));
    activeTaxTotal = Number(ordTaxTotal.toFixed(2));
    activeGrandTotal = ordGrand;
    activeRoundOff = ordRoundOff;
    activeQty = totalOrdQty;
  }

  // Calculate GST components (Intra-state CGST+SGST vs Inter-state IGST)
  const isIntraState = supplierState ? (
    supplierState.toLowerCase().includes('tamil') || supplierState.toLowerCase().includes('tn')
  ) : (
    supplierGstin.startsWith('33') || true
  );

  const activeCgst = isIntraState ? Number((activeTaxTotal / 2).toFixed(2)) : 0;
  const activeSgst = isIntraState ? Number((activeTaxTotal / 2).toFixed(2)) : 0;
  const activeIgst = isIntraState ? 0 : Number(activeTaxTotal.toFixed(2));

  return {
    fulfillmentMode,
    hasReceivedData: totalRecQty > 0,
    hasPendingData: totalPendQty > 0,
    isPartiallyReceived: totalRecQty > 0 && totalPendQty > 0,
    isFullyReceived: totalOrdQty > 0 && totalRecQty >= totalOrdQty,
    totalOrderedQty: totalOrdQty,
    totalReceivedQty: totalRecQty,
    totalPendingQty: totalPendQty,
    company: {
      name: comp.name || comp.companyName || 'Active System Integration',
      logoUrl: comp.logoUrl || DEFAULT_ASI_LOGO,
      watermarkLogoUrl: comp.watermarkLogoUrl || ASI_WATERMARK_LOGO || comp.logoUrl || DEFAULT_ASI_LOGO,
      address: comp.address || 'Plot No. 10A, Perumal Kovil Street, Sivabootham, Vanagaram, Chennai - 600095',
      phone: cleanPhone,
      phoneList: comp.mobileList || [cleanPhone],
      email: comp.email || 'admin@asi.ind.in',
      website: comp.website || 'https://asiind.com/',
      gstin: comp.gstin || '33AZPPS7068A1Z4',
      iso: comp.iso || 'ISO 9001:2015 Certified'
    },
    poNumber,
    poDate,
    deliveryDue,
    paymentTerms,
    status: (poData.status || '').toString().trim().toUpperCase(),
    supplier: {
      name: supplierName,
      contactPerson: supplierContact,
      address: supplierAddress,
      city: supplierCity,
      state: supplierState,
      pincode: supplierPincode,
      phone: supplierPhone,
      email: supplierEmail,
      gstin: supplierGstin
    },
    shipping: {
      companyName: comp.name || 'Active System Integration',
      address: deliveryAddress,
      contact: 'Purchase & Logistics Dept',
      phone: cleanPhone,
      gstin: comp.gstin || '33AZPPS7068A1Z4'
    },
    items: activeItems,
    allItems: normalizedItems,
    financials: {
      totalQty: activeQty,
      totalOrderedQty: totalOrdQty,
      totalReceivedQty: totalRecQty,
      totalPendingQty: totalPendQty,
      subtotal: activeSubtotal,
      cgst: activeCgst,
      sgst: activeSgst,
      igst: activeIgst,
      taxTotal: activeTaxTotal,
      roundOff: activeRoundOff,
      grandTotal: activeGrandTotal,
      amountWords: amountInWords(activeGrandTotal)
    },
    fullOrderFinancials: {
      totalQty: totalOrdQty,
      subtotal: Number(ordTaxableTotal.toFixed(2)),
      taxTotal: Number(ordTaxTotal.toFixed(2)),
      grandTotal: ordGrand,
      amountWords: amountInWords(ordGrand)
    },
    receivedFinancials: {
      totalQty: totalRecQty,
      subtotal: Number(recTaxableTotal.toFixed(2)),
      taxTotal: Number(recTaxTotal.toFixed(2)),
      grandTotal: recGrand,
      amountWords: amountInWords(recGrand)
    },
    pendingFinancials: {
      totalQty: totalPendQty,
      subtotal: Number(pendTaxableTotal.toFixed(2)),
      taxTotal: Number(pendTaxTotal.toFixed(2)),
      grandTotal: pendGrand,
      amountWords: amountInWords(pendGrand)
    },
    terms: {
      paymentTerms,
      deliveryDue,
      deliveryAddress,
      termsAndConditions: (poData.termsAndConditions || '').toString().trim(),
      remarks: (poData.remarks || '').toString().trim()
    },
    createdBy: (poData.createdBy || 'Admin').toString().trim()
  };
}

/**
 * Centered Background Watermark Logo
 */
function PurchaseOrderWatermark({ comp }) {
  const [imgFailed, setImgFailed] = useState(false);
  const watermarkUrl = comp?.watermarkLogoUrl || ASI_WATERMARK_LOGO || comp?.logoUrl || DEFAULT_ASI_LOGO;

  return (
    <div className="doc-inv-watermark-overlay doc-po-watermark-overlay" aria-hidden="true">
      {watermarkUrl && !imgFailed ? (
        <img
          src={watermarkUrl}
          alt=""
          className="doc-inv-watermark-img"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <AsiLogo width={440} height={380} className="doc-inv-watermark-svg" />
      )}
    </div>
  );
}

/**
 * 1. Top Document Title
 */
function PurchaseOrderTitle({ hidePrices = false, fulfillmentMode = 'ALL' }) {
  if (fulfillmentMode === 'RECEIVED_ONLY') {
    return (
      <div className="doc-po-top-title" style={{ color: '#065f46' }}>
        GOODS RECEIPT NOTE (GRN) — INWARD FULFILLMENT
      </div>
    );
  }
  if (fulfillmentMode === 'PENDING_ONLY') {
    return (
      <div className="doc-po-top-title" style={{ color: '#92400e' }}>
        PURCHASE ORDER — PENDING DELIVERY STATEMENT
      </div>
    );
  }
  return (
    <div className="doc-po-top-title">
      {hidePrices ? 'PURCHASE ORDER (VENDOR COPY)' : 'PURCHASE ORDER'}
    </div>
  );
}

/**
 * 2. Top Header Box: Company Info | PO Metadata Table
 */
function PurchaseOrderHeaderBox({ company, doc, fulfillmentMode = 'ALL' }) {
  const [imgFailed, setImgFailed] = useState(false);
  const logoUrl = company?.logoUrl || DEFAULT_ASI_LOGO;
  const logoDim = 106;

  return (
    <div className="doc-inv-header-box doc-po-header-box">
      {/* Left Company Pane matching Sales Invoice */}
      <div className="doc-inv-company-pane">
        <div
          className="doc-inv-logo-wrap"
          style={{
            flex: `0 0 ${logoDim}px`,
            width: `${logoDim}px`,
            minWidth: `${logoDim}px`,
            alignSelf: 'flex-start',
            marginTop: '1px'
          }}
        >
          {logoUrl && !imgFailed ? (
            <img
              src={logoUrl}
              alt={company?.name || 'Active System Integration'}
              className="doc-inv-logo-img"
              style={{
                width: `${logoDim}px`,
                height: `${logoDim}px`,
                maxWidth: `${logoDim}px`,
                maxHeight: `${logoDim}px`,
                objectFit: 'contain',
                display: 'block'
              }}
              onError={() => setImgFailed(true)}
            />
          ) : (
            <AsiLogo width={logoDim} height={logoDim} />
          )}
        </div>
        <div className="doc-inv-company-details">
          <div className="doc-inv-company-name">{company?.name || 'Active System Integration'}</div>
          <div className="doc-inv-company-address">
            <div>Plot No. 10A, Perumal Kovil Street,</div>
            <div>Sivabootham, Vanagaram,</div>
            <div className="doc-inv-city-pin">Chennai - 600095</div>
          </div>
          <div className="doc-inv-company-phones">
            Phone: {company?.phone || '9171126666'}
          </div>
          <div className="doc-inv-company-gstin">
            <strong>GSTIN: {company?.gstin || '33AZPPS7068A1Z4'}</strong>
          </div>
          <div className="doc-inv-company-website">
            Website: {company?.website || 'https://asiind.com/'}
          </div>
        </div>
      </div>

      {/* Right PO Metadata Pane */}
      <div className="doc-inv-meta-pane doc-po-meta-pane" style={{ position: 'relative' }}>
        {fulfillmentMode === 'RECEIVED_ONLY' ? (
          <div
            style={{
              position: 'absolute',
              top: '6px',
              right: '8px',
              border: '2px solid #16a34a',
              color: '#16a34a',
              background: '#f0fdf4',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 800,
              fontSize: '11px',
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}
          >
            ✓ GOODS RECEIVED ({doc.totalReceivedQty} Units)
          </div>
        ) : fulfillmentMode === 'PENDING_ONLY' ? (
          <div
            style={{
              position: 'absolute',
              top: '6px',
              right: '8px',
              border: '2px solid #d97706',
              color: '#b45309',
              background: '#fffbeb',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 800,
              fontSize: '11px',
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}
          >
            ⚡ PENDING ({doc.totalPendingQty} Units)
          </div>
        ) : doc.status === 'RECEIVED' ? (
          <div
            style={{
              position: 'absolute',
              top: '6px',
              right: '8px',
              border: '2px solid #16a34a',
              color: '#16a34a',
              background: '#f0fdf4',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 800,
              fontSize: '11px',
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}
          >
            ✓ RECEIVED
          </div>
        ) : doc.status === 'PARTIALLY_RECEIVED' ? (
          <div
            style={{
              position: 'absolute',
              top: '6px',
              right: '8px',
              border: '2px solid #d97706',
              color: '#b45309',
              background: '#fffbeb',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 800,
              fontSize: '11px',
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}
          >
            ⚡ PARTIAL ({doc.totalReceivedQty}/{doc.totalOrderedQty} Recd)
          </div>
        ) : null}

        <table className="doc-po-meta-table">
          <tbody>
            <tr>
              <td className="doc-po-meta-label">PO No. :</td>
              <td className="doc-po-meta-val bold">{doc.poNumber}</td>
            </tr>
            <tr>
              <td className="doc-po-meta-label">PO Date :</td>
              <td className="doc-po-meta-val">{doc.poDate}</td>
            </tr>
            <tr>
              <td className="doc-po-meta-label">Delivery Due :</td>
              <td className="doc-po-meta-val">{doc.deliveryDue}</td>
            </tr>
            <tr>
              <td className="doc-po-meta-label">Payment Terms :</td>
              <td className="doc-po-meta-val">{doc.paymentTerms}</td>
            </tr>
            <tr>
              <td className="doc-po-meta-label">Scope / Status :</td>
              <td className="doc-po-meta-val bold">
                {fulfillmentMode === 'RECEIVED_ONLY' ? (
                  <span style={{ color: '#16a34a', fontWeight: 800 }}>✓ Inward Received ({doc.totalReceivedQty} Units)</span>
                ) : fulfillmentMode === 'PENDING_ONLY' ? (
                  <span style={{ color: '#d97706', fontWeight: 800 }}>⚡ Outstanding Balance ({doc.totalPendingQty} Units)</span>
                ) : doc.status === 'RECEIVED' ? (
                  <span style={{ color: '#16a34a', fontWeight: 800 }}>✓ RECEIVED (FULL DELIVERY)</span>
                ) : doc.status === 'PARTIALLY_RECEIVED' ? (
                  <span style={{ color: '#d97706', fontWeight: 800 }}>⚡ PARTIAL ({doc.totalReceivedQty}/{doc.totalOrderedQty} Recd)</span>
                ) : (
                  doc.status || 'SENT'
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Helper to wrap address strings into clean multi-line address blocks.
 */
export function formatAddressLines(addr) {
  if (!addr) return [];
  if (Array.isArray(addr)) return addr.filter(Boolean);
  const str = String(addr).trim();
  if (!str) return [];
  if (str.includes('\n')) {
    return str.split('\n').map(l => l.trim()).filter(Boolean);
  }

  const lower = str.toLowerCase();
  if (lower.includes('perumal kovil') && (lower.includes('vanagaram') || lower.includes('sivabootham'))) {
    return [
      'Plot No. 10A, Perumal Kovil Street,',
      'Sivabootham, Vanagaram,',
      'Chennai - 600095'
    ];
  }

  const parts = str.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length >= 4) {
    return [
      parts.slice(0, 2).join(', ') + ',',
      parts.slice(2, parts.length - 1).join(', ') + ',',
      parts[parts.length - 1]
    ];
  } else if (parts.length === 3) {
    return [parts[0] + ',', parts[1] + ',', parts[2]];
  } else if (parts.length === 2) {
    return [parts[0] + ',', parts[1]];
  }
  return [str];
}

/**
 * 3. Vendor / Supplier (50%) & Shipping / Delivery (50%) Box
 */
function VendorShippingSection({ supplier, shipping }) {
  const supplierCityState = [
    supplier.city,
    supplier.state,
    supplier.pincode
  ].filter(Boolean).join(' - ');

  const shippingAddressLines = formatAddressLines(shipping.address);

  return (
    <div className="doc-po-parties-box">
      {/* Left: Vendor / Supplier */}
      <div className="doc-po-party-pane border-right">
        <div className="doc-po-party-label">VENDOR / SUPPLIER :</div>
        <div className="doc-po-party-name">{supplier.name}</div>
        {supplier.contactPerson && (
          <div className="doc-po-party-line">
            Contact: {supplier.contactPerson}
          </div>
        )}
        {supplier.address && (
          <div className="doc-po-party-line">{supplier.address}</div>
        )}
        {supplierCityState && (
          <div className="doc-po-party-line">{supplierCityState}</div>
        )}
        {supplier.phone && (
          <div className="doc-po-party-line">
            Phone: {supplier.phone}
          </div>
        )}
        {supplier.email && (
          <div className="doc-po-party-line">
            Email: {supplier.email}
          </div>
        )}
        <div className="doc-po-party-gstin">
          GSTIN: <strong>{supplier.gstin || 'UNREGISTERED'}</strong>
        </div>
      </div>

      {/* Right: Shipping & Delivery */}
      <div className="doc-po-party-pane">
        <div className="doc-po-party-label">SHIPPING &amp; DELIVERY ADDRESS :</div>
        <div className="doc-po-party-name">{shipping.companyName}</div>
        {shippingAddressLines.map((line, idx) => (
          <div key={idx} className="doc-po-party-line">{line}</div>
        ))}
        <div className="doc-po-party-line">
          Contact: {shipping.contact || 'Purchase & Logistics Dept'}
        </div>
        <div className="doc-po-party-line">
          Phone: {shipping.phone || '09994126666'}
        </div>
        <div className="doc-po-party-gstin">
          GSTIN: <strong>{shipping.gstin || '33AZPPS7068A1Z4'}</strong>
        </div>
      </div>
    </div>
  );
}

/**
 * Estimates item row height for Purchase Order
 */
export function estimatePoItemHeight(item) {
  let height = 34;
  const name = (item.productName || '').toString();
  if (name.length > 40) {
    height += Math.floor(name.length / 40) * 16;
  }
  if (item.productCode) {
    height += 16;
  }
  const desc = (item.description || '').toString();
  if (desc) {
    height += Math.max(16, Math.ceil(desc.length / 45) * 15);
  }
  if (item.serialized && Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0) {
    const sStr = item.serialNumbers.join(', ');
    height += Math.max(16, Math.ceil(sStr.length / 40) * 15);
  }
  return Math.max(34, height);
}

/**
 * Estimates Purchase Order bottom section height (Financial totals + Words + Terms + Signatures)
 */
export function estimatePoBottomHeight(doc, hidePrices = false, fulfillmentMode = 'ALL') {
  if (hidePrices) {
    let h = 80 + 105;
    if (doc?.terms?.termsAndConditions || doc?.terms?.remarks) {
      h += 30;
    }
    return h;
  }
  let h = 100 + 36 + 80 + 105;
  if (fulfillmentMode === 'ALL' && doc?.hasReceivedData) {
    h += 36; // 2 reconciliation rows
  }
  if (doc?.terms?.termsAndConditions || doc?.terms?.remarks) {
    h += 30;
  }
  return h;
}

/**
 * Paginates Purchase Order items across pages
 */
export function paginatePurchaseOrder(doc, hidePrices = false, fulfillmentMode = 'ALL') {
  const items = Array.isArray(doc?.items) && doc.items.length > 0 ? doc.items : [];
  const bottomHeight = estimatePoBottomHeight(doc || {}, hidePrices, fulfillmentMode);

  const A4_USABLE_PAGE_HEIGHT_PX = 955;
  const PO_PAGE_1_HEADER_HEIGHT_PX = 290;
  const PO_CONTINUATION_HEADER_HEIGHT_PX = 24;
  const PO_TABLE_HEADER_HEIGHT_PX = 32;
  const PO_FOOTER_HEIGHT_PX = 32;

  let totalItemsHeight = 0;
  const itemHeights = items.map(it => {
    const h = estimatePoItemHeight(it);
    totalItemsHeight += h;
    return h;
  });

  const page1ItemsSpaceWithBottom = A4_USABLE_PAGE_HEIGHT_PX - (PO_PAGE_1_HEADER_HEIGHT_PX + PO_TABLE_HEADER_HEIGHT_PX + bottomHeight + PO_FOOTER_HEIGHT_PX);

  if (totalItemsHeight <= page1ItemsSpaceWithBottom) {
    return [{
      pageNumber: 1,
      items,
      startIndex: 0,
      isPage1: true,
      showTotals: true,
      showBottomSection: true
    }];
  }

  // Multi-page Purchase Order
  const pages = [];
  let currentItems = [];
  let currentStartIndex = 0;
  let currentHeightUsed = 0;

  const getAvailableHeight = (isPage1, willIncludeBottom) => {
    const topHeight = isPage1 ? PO_PAGE_1_HEADER_HEIGHT_PX : PO_CONTINUATION_HEADER_HEIGHT_PX;
    const requiredBottom = willIncludeBottom ? bottomHeight : 0;
    return A4_USABLE_PAGE_HEIGHT_PX - (topHeight + PO_TABLE_HEADER_HEIGHT_PX + requiredBottom + PO_FOOTER_HEIGHT_PX);
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemH = itemHeights[i];
    const isPage1 = pages.length === 0;

    let remainingHeight = 0;
    for (let j = i; j < items.length; j++) {
      remainingHeight += itemHeights[j];
    }

    const availableWithBottom = getAvailableHeight(isPage1, true);
    if (currentHeightUsed + remainingHeight <= availableWithBottom) {
      for (let j = i; j < items.length; j++) {
        currentItems.push(items[j]);
      }
      pages.push({
        pageNumber: pages.length + 1,
        items: currentItems,
        startIndex: currentStartIndex,
        isPage1: pages.length === 0,
        showTotals: true,
        showBottomSection: true
      });
      return pages;
    }

    const availableWithoutBottom = getAvailableHeight(isPage1, false);
    if (currentItems.length > 0 && currentHeightUsed + itemH > availableWithoutBottom) {
      pages.push({
        pageNumber: pages.length + 1,
        items: currentItems,
        startIndex: currentStartIndex,
        isPage1: pages.length === 0,
        showTotals: false,
        showBottomSection: false
      });
      currentItems = [item];
      currentStartIndex = i;
      currentHeightUsed = itemH;
    } else {
      currentItems.push(item);
      currentHeightUsed += itemH;
    }
  }

  if (currentItems.length > 0) {
    pages.push({
      pageNumber: pages.length + 1,
      items: currentItems,
      startIndex: currentStartIndex,
      isPage1: pages.length === 0,
      showTotals: true,
      showBottomSection: true
    });
  }

  if (pages.length > 1 && pages[pages.length - 1].items.length === 0) {
    const prevPage = pages[pages.length - 2];
    if (prevPage.items.length > 1) {
      const movedItem = prevPage.items.pop();
      pages[pages.length - 1].items.unshift(movedItem);
      pages[pages.length - 1].startIndex = prevPage.startIndex + prevPage.items.length;
    }
  }

  return pages;
}

/**
 * 4. Purchase Order Items Table with Integrated Financial Summary
 * Supports:
 * - 'RECEIVED_ONLY': Inward received goods with strictly received totals
 * - 'PENDING_ONLY': Outstanding pending deliveries with strictly pending totals
 * - 'ALL': Full PO with 3-way breakdown (Ordered, Received, Pending, Unit Rate, Order Total)
 */
function PurchaseOrderItemsTable({
  items,
  financials,
  showTotals = true,
  hidePrices = false,
  fulfillmentMode = 'ALL',
  doc = {}
}) {
  const { subtotal, cgst, sgst, igst, taxTotal, grandTotal } = financials;

  // Vendor Copy (Quantity only, no pricing)
  if (hidePrices) {
    const hasReceivedData = items.some((it) => Number(it.receivedQty || 0) > 0);
    return (
      <div className="doc-po-table-wrapper">
        <table className="doc-po-table">
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: hasReceivedData ? '45%' : '57%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: hasReceivedData ? '10%' : '18%' }} />
            {hasReceivedData && <col style={{ width: '10%' }} />}
            {hasReceivedData && <col style={{ width: '10%' }} />}
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>#</th>
              <th style={{ textAlign: 'left', paddingLeft: '8px' }}>ITEM DESCRIPTION &amp; SPECIFICATIONS</th>
              <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>HSN/SAC</th>
              <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>UNIT</th>
              <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>ORDERED</th>
              {hasReceivedData && <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>RECEIVED</th>}
              {hasReceivedData && <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>PENDING</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.sl}>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{it.sl}</td>
                <td style={{ textAlign: 'left' }}>
                  <div className="doc-po-item-name">{it.productName}</div>
                  {it.productCode && (
                    <div className="doc-po-item-code">
                      Code: {it.productCode} {it.serialized ? '· Serialized Item' : ''}
                    </div>
                  )}
                  {it.description && (
                    <div className="doc-po-item-desc">{it.description}</div>
                  )}
                  {it.serialized && Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0 && (
                    <div className="doc-po-item-serials">
                      <strong>Serials:</strong> {it.serialNumbers.join(', ')}
                    </div>
                  )}
                </td>
                <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{it.hsnSac}</td>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{it.unit || 'Nos'}</td>
                <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '13px' }}>{it.orderedQty}</td>
                {hasReceivedData && (
                  <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '13px', color: (it.receivedQty || 0) > 0 ? '#16a34a' : '#64748b' }}>
                    {it.receivedQty || 0}
                  </td>
                )}
                {hasReceivedData && (
                  <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '13px', color: (it.pendingQty || 0) > 0 ? '#d97706' : '#16a34a' }}>
                    {it.pendingQty !== undefined ? it.pendingQty : Math.max(0, it.orderedQty - (it.receivedQty || 0))}
                  </td>
                )}
              </tr>
            ))}

            {showTotals && (
              <tr className="doc-po-total-row">
                <td colSpan="4" className="doc-po-total-label" style={{ textAlign: 'right', paddingRight: '16px' }}>
                  TOTAL QUANTITIES :
                </td>
                <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                  {financials.totalOrderedQty} Ord
                </td>
                {hasReceivedData && (
                  <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '13px', color: '#16a34a' }}>
                    {financials.totalReceivedQty || 0} Recd
                  </td>
                )}
                {hasReceivedData && (
                  <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '13px', color: '#d97706' }}>
                    {financials.totalPendingQty || 0} Pend
                  </td>
                )}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // MODE 1: RECEIVED_ONLY (Goods Receipt Note — Strictly received goods)
  if (fulfillmentMode === 'RECEIVED_ONLY') {
    return (
      <div className="doc-po-table-wrapper">
        <table className="doc-po-table">
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: '40%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '13%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>#</th>
              <th style={{ textAlign: 'left', paddingLeft: '8px' }}>RECEIVED ITEM &amp; SPECIFICATIONS</th>
              <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>HSN/SAC</th>
              <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>RECD QTY</th>
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                RATE
                <div style={{ fontSize: '7.5pt', fontWeight: 'normal', color: '#64748b', textTransform: 'none' }}>
                  (per unit)
                </div>
              </th>
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>TAX</th>
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>RECD AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontStyle: 'italic' }}>
                  No goods have been received against this Purchase Order yet. Inward received quantity is 0.
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.sl}>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{it.sl}</td>
                  <td style={{ textAlign: 'left' }}>
                    <div className="doc-po-item-name">{it.productName}</div>
                    {it.productCode && (
                      <div className="doc-po-item-code">
                        Code: {it.productCode} {it.serialized ? '· Serialized Item' : ''}
                      </div>
                    )}
                    {it.description && (
                      <div className="doc-po-item-desc">{it.description}</div>
                    )}
                    {it.serialized && it.serialNumbers && it.serialNumbers.length > 0 && (
                      <div className="doc-po-item-serials" style={{ color: '#047857', background: '#ecfdf5', padding: '2px 6px', borderRadius: '4px', marginTop: '3px' }}>
                        <strong>Received Serials ({it.serialNumbers.length}):</strong> {it.serialNumbers.join(', ')}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{it.hsnSac}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '13px', color: '#16a34a' }}>
                    {it.receivedQty} {it.unit || 'Nos'}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    ₹ {formatPlainNumber(it.rate)}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    <div style={{ whiteSpace: 'nowrap', fontWeight: 600, color: '#0f172a' }}>
                      ₹ {formatPlainNumber(it.receivedTax)}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', marginTop: '1px' }}>
                      (GST {it.gstRate}%)
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, whiteSpace: 'nowrap', color: '#065f46' }}>
                    ₹ {formatPlainNumber(it.receivedLineTotal)}
                  </td>
                </tr>
              ))
            )}

            {/* Subtotal & Summary Rows */}
            {showTotals && items.length > 0 && (
              <>
                <tr className="doc-po-summary-row">
                  <td colSpan="5" className="doc-po-summary-label">SUBTOTAL (TAXABLE RECEIVED GOODS) :</td>
                  <td colSpan="2" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    ₹ {formatPlainNumber(subtotal)}
                  </td>
                </tr>

                {cgst > 0 && sgst > 0 ? (
                  <>
                    <tr className="doc-po-summary-row">
                      <td colSpan="5" className="doc-po-summary-label">CENTRAL TAX (CGST) :</td>
                      <td colSpan="2" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        ₹ {formatPlainNumber(cgst)}
                      </td>
                    </tr>
                    <tr className="doc-po-summary-row">
                      <td colSpan="5" className="doc-po-summary-label">STATE TAX (SGST) :</td>
                      <td colSpan="2" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        ₹ {formatPlainNumber(sgst)}
                      </td>
                    </tr>
                  </>
                ) : igst > 0 ? (
                  <tr className="doc-po-summary-row">
                    <td colSpan="5" className="doc-po-summary-label">INTEGRATED TAX (IGST) :</td>
                    <td colSpan="2" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      ₹ {formatPlainNumber(igst)}
                    </td>
                  </tr>
                ) : taxTotal > 0 ? (
                  <tr className="doc-po-summary-row">
                    <td colSpan="5" className="doc-po-summary-label">TAX AMOUNT (GST ON RECEIVED GOODS) :</td>
                    <td colSpan="2" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      ₹ {formatPlainNumber(taxTotal)}
                    </td>
                  </tr>
                ) : null}

                <tr className="doc-po-total-row" style={{ background: '#ecfdf5' }}>
                  <td colSpan="3" className="doc-po-total-label" style={{ color: '#065f46' }}>
                    TOTAL GOODS RECEIVED VALUE (INWARD FULFILLED)
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: '#16a34a' }}>
                    {financials.totalReceivedQty}
                  </td>
                  <td colSpan="1"></td>
                  <td colSpan="2" className="doc-po-total-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', color: '#065f46' }}>
                    ₹ {formatPlainNumber(grandTotal)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // MODE 2: PENDING_ONLY (Pending Delivery Statement)
  if (fulfillmentMode === 'PENDING_ONLY') {
    return (
      <div className="doc-po-table-wrapper">
        <table className="doc-po-table">
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: '40%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '13%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>#</th>
              <th style={{ textAlign: 'left', paddingLeft: '8px' }}>PENDING ITEM &amp; SPECIFICATIONS</th>
              <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>HSN/SAC</th>
              <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>PENDING QTY</th>
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                RATE
                <div style={{ fontSize: '7.5pt', fontWeight: 'normal', color: '#64748b', textTransform: 'none' }}>
                  (per unit)
                </div>
              </th>
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>TAX</th>
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>PENDING AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#16a34a', fontWeight: 600 }}>
                  ✓ All items have been 100% received! Outstanding pending quantity is 0.
                </td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.sl}>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{it.sl}</td>
                  <td style={{ textAlign: 'left' }}>
                    <div className="doc-po-item-name">{it.productName}</div>
                    {it.productCode && (
                      <div className="doc-po-item-code">
                        Code: {it.productCode} {it.serialized ? '· Serialized Item' : ''}
                      </div>
                    )}
                    {it.description && (
                      <div className="doc-po-item-desc">{it.description}</div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{it.hsnSac}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '13px', color: '#d97706' }}>
                    {it.pendingQty} {it.unit || 'Nos'}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    ₹ {formatPlainNumber(it.rate)}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    <div style={{ whiteSpace: 'nowrap', fontWeight: 600, color: '#0f172a' }}>
                      ₹ {formatPlainNumber(it.pendingTax)}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', marginTop: '1px' }}>
                      (GST {it.gstRate}%)
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, whiteSpace: 'nowrap', color: '#b45309' }}>
                    ₹ {formatPlainNumber(it.pendingLineTotal)}
                  </td>
                </tr>
              ))
            )}

            {showTotals && items.length > 0 && (
              <>
                <tr className="doc-po-summary-row">
                  <td colSpan="5" className="doc-po-summary-label">SUBTOTAL (PENDING TAXABLE) :</td>
                  <td colSpan="2" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    ₹ {formatPlainNumber(subtotal)}
                  </td>
                </tr>

                {cgst > 0 && sgst > 0 ? (
                  <>
                    <tr className="doc-po-summary-row">
                      <td colSpan="5" className="doc-po-summary-label">CENTRAL TAX (CGST) :</td>
                      <td colSpan="2" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        ₹ {formatPlainNumber(cgst)}
                      </td>
                    </tr>
                    <tr className="doc-po-summary-row">
                      <td colSpan="5" className="doc-po-summary-label">STATE TAX (SGST) :</td>
                      <td colSpan="2" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        ₹ {formatPlainNumber(sgst)}
                      </td>
                    </tr>
                  </>
                ) : igst > 0 ? (
                  <tr className="doc-po-summary-row">
                    <td colSpan="5" className="doc-po-summary-label">INTEGRATED TAX (IGST) :</td>
                    <td colSpan="2" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      ₹ {formatPlainNumber(igst)}
                    </td>
                  </tr>
                ) : taxTotal > 0 ? (
                  <tr className="doc-po-summary-row">
                    <td colSpan="5" className="doc-po-summary-label">TAX AMOUNT (GST ON PENDING ITEMS) :</td>
                    <td colSpan="2" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      ₹ {formatPlainNumber(taxTotal)}
                    </td>
                  </tr>
                ) : null}

                <tr className="doc-po-total-row" style={{ background: '#fffbeb' }}>
                  <td colSpan="3" className="doc-po-total-label" style={{ color: '#b45309' }}>
                    TOTAL OUTSTANDING COMMITMENT (PENDING DELIVERY)
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: '#d97706' }}>
                    {financials.totalPendingQty}
                  </td>
                  <td colSpan="1"></td>
                  <td colSpan="2" className="doc-po-total-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', color: '#b45309' }}>
                    ₹ {formatPlainNumber(grandTotal)}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // MODE 3: ALL (Full Order Commitment with 3-Way Fulfillment Audit)
  const hasReceipts = doc?.hasReceivedData;

  if (hasReceipts) {
    return (
      <div className="doc-po-table-wrapper">
        <table className="doc-po-table">
          <colgroup>
            <col style={{ width: '4%' }} />
            <col style={{ width: '32%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '6%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>#</th>
              <th style={{ textAlign: 'left', paddingLeft: '8px' }}>ITEM DESCRIPTION &amp; SPECIFICATIONS</th>
              <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>HSN/SAC</th>
              <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>ORD</th>
              <th style={{ textAlign: 'center', whiteSpace: 'nowrap', color: '#16a34a' }}>RECD</th>
              <th style={{ textAlign: 'center', whiteSpace: 'nowrap', color: '#d97706' }}>PEND</th>
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>RATE</th>
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>TAX</th>
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>ORDER TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.sl}>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{it.sl}</td>
                <td style={{ textAlign: 'left' }}>
                  <div className="doc-po-item-name">{it.productName}</div>
                  {it.productCode && (
                    <div className="doc-po-item-code">
                      Code: {it.productCode} {it.serialized ? '· Serialized Item' : ''}
                    </div>
                  )}
                  {it.description && (
                    <div className="doc-po-item-desc">{it.description}</div>
                  )}
                  {it.serialized && it.serialNumbers && it.serialNumbers.length > 0 && (
                    <div className="doc-po-item-serials">
                      <strong>Serials ({it.serialNumbers.length}):</strong> {it.serialNumbers.join(', ')}
                    </div>
                  )}
                </td>
                <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{it.hsnSac}</td>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>{it.orderedQty}</td>
                <td style={{ textAlign: 'center', fontWeight: 700, color: it.receivedQty > 0 ? '#16a34a' : '#94a3b8' }}>
                  {it.receivedQty || 0}
                </td>
                <td style={{ textAlign: 'center', fontWeight: 700, color: it.pendingQty > 0 ? '#d97706' : '#16a34a' }}>
                  {it.pendingQty}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  ₹ {formatPlainNumber(it.rate)}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  <div style={{ whiteSpace: 'nowrap', fontWeight: 600, color: '#0f172a' }}>
                    ₹ {formatPlainNumber(it.orderedTax)}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    (GST {it.gstRate}%)
                  </div>
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  ₹ {formatPlainNumber(it.orderedLineTotal)}
                </td>
              </tr>
            ))}

            {showTotals && (
              <>
                <tr className="doc-po-summary-row">
                  <td colSpan="6" className="doc-po-summary-label">SUBTOTAL (ORDERED TAXABLE) :</td>
                  <td colSpan="3" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    ₹ {formatPlainNumber(subtotal)}
                  </td>
                </tr>

                {cgst > 0 && sgst > 0 ? (
                  <>
                    <tr className="doc-po-summary-row">
                      <td colSpan="6" className="doc-po-summary-label">CENTRAL TAX (CGST) :</td>
                      <td colSpan="3" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        ₹ {formatPlainNumber(cgst)}
                      </td>
                    </tr>
                    <tr className="doc-po-summary-row">
                      <td colSpan="6" className="doc-po-summary-label">STATE TAX (SGST) :</td>
                      <td colSpan="3" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        ₹ {formatPlainNumber(sgst)}
                      </td>
                    </tr>
                  </>
                ) : igst > 0 ? (
                  <tr className="doc-po-summary-row">
                    <td colSpan="6" className="doc-po-summary-label">INTEGRATED TAX (IGST) :</td>
                    <td colSpan="3" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      ₹ {formatPlainNumber(igst)}
                    </td>
                  </tr>
                ) : taxTotal > 0 ? (
                  <tr className="doc-po-summary-row">
                    <td colSpan="6" className="doc-po-summary-label">TAX AMOUNT (GST) :</td>
                    <td colSpan="3" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      ₹ {formatPlainNumber(taxTotal)}
                    </td>
                  </tr>
                ) : null}

                <tr className="doc-po-total-row">
                  <td colSpan="3" className="doc-po-total-label">TOTAL PURCHASE ORDER COMMITMENT</td>
                  <td style={{ textAlign: 'center', fontWeight: 800 }}>{financials.totalOrderedQty}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: '#16a34a' }}>{financials.totalReceivedQty}</td>
                  <td style={{ textAlign: 'center', fontWeight: 800, color: '#d97706' }}>{financials.totalPendingQty}</td>
                  <td colSpan="1"></td>
                  <td colSpan="2" className="doc-po-total-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    ₹ {formatPlainNumber(grandTotal)}
                  </td>
                </tr>

                {/* 3-Way Reconciliation Audit Rows */}
                <tr className="doc-po-reconciliation-row recd">
                  <td colSpan="6" style={{ textAlign: 'right', fontWeight: 800 }}>
                    ✓ TOTAL GOODS RECEIVED TO DATE (INWARD FULFILLED) :
                  </td>
                  <td colSpan="3" style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, whiteSpace: 'nowrap' }}>
                    ₹ {formatPlainNumber(doc.receivedFinancials.grandTotal)} ({doc.totalReceivedQty} Units)
                  </td>
                </tr>

                {doc.totalPendingQty > 0 && (
                  <tr className="doc-po-reconciliation-row pend">
                    <td colSpan="6" style={{ textAlign: 'right', fontWeight: 800 }}>
                      ⚡ REMAINING PENDING DELIVERY (OUTSTANDING BALANCE) :
                    </td>
                    <td colSpan="3" style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, whiteSpace: 'nowrap' }}>
                      ₹ {formatPlainNumber(doc.pendingFinancials.grandTotal)} ({doc.totalPendingQty} Units)
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // Standard PO (No receipts recorded yet, initial fresh PO)
  return (
    <div className="doc-po-table-wrapper">
      <table className="doc-po-table">
        <colgroup>
          <col style={{ width: '5%' }} />
          <col style={{ width: '40%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '13%' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>#</th>
            <th style={{ textAlign: 'left', paddingLeft: '8px' }}>ITEM DESCRIPTION &amp; SPECIFICATIONS</th>
            <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>HSN/SAC</th>
            <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>QTY</th>
            <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              RATE
              <div style={{ fontSize: '7.5pt', fontWeight: 'normal', color: '#64748b', textTransform: 'none' }}>
                (per product)
              </div>
            </th>
            <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>TAX</th>
            <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.sl}>
              <td style={{ textAlign: 'center', fontWeight: 600 }}>{it.sl}</td>
              <td style={{ textAlign: 'left' }}>
                <div className="doc-po-item-name">{it.productName}</div>
                {it.productCode && (
                  <div className="doc-po-item-code">
                    Code: {it.productCode} {it.serialized ? '· Serialized Item' : ''}
                  </div>
                )}
                {it.description && (
                  <div className="doc-po-item-desc">{it.description}</div>
                )}
                {it.serialized && it.serialNumbers && it.serialNumbers.length > 0 && (
                  <div className="doc-po-item-serials">
                    <strong>Serials:</strong> {it.serialNumbers.join(', ')}
                  </div>
                )}
              </td>
              <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{it.hsnSac}</td>
              <td style={{ textAlign: 'center', fontWeight: 700 }}>
                <div>{it.orderedQty}</div>
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                ₹ {formatPlainNumber(it.rate)}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                <div style={{ whiteSpace: 'nowrap', fontWeight: 600, color: '#0f172a' }}>
                  ₹ {formatPlainNumber(it.orderedTax)}
                </div>
                <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', marginTop: '1px' }}>
                  (GST {it.gstRate}%)
                </div>
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, whiteSpace: 'nowrap' }}>
                ₹ {formatPlainNumber(it.orderedLineTotal)}
              </td>
            </tr>
          ))}

          {showTotals && (
            <>
              <tr className="doc-po-summary-row">
                <td colSpan="5" className="doc-po-summary-label">SUBTOTAL (TAXABLE) :</td>
                <td colSpan="2" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  ₹ {formatPlainNumber(subtotal)}
                </td>
              </tr>

              {cgst > 0 && sgst > 0 ? (
                <>
                  <tr className="doc-po-summary-row">
                    <td colSpan="5" className="doc-po-summary-label">CENTRAL TAX (CGST) :</td>
                    <td colSpan="2" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      ₹ {formatPlainNumber(cgst)}
                    </td>
                  </tr>
                  <tr className="doc-po-summary-row">
                    <td colSpan="5" className="doc-po-summary-label">STATE TAX (SGST) :</td>
                    <td colSpan="2" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      ₹ {formatPlainNumber(sgst)}
                    </td>
                  </tr>
                </>
              ) : igst > 0 ? (
                <tr className="doc-po-summary-row">
                  <td colSpan="5" className="doc-po-summary-label">INTEGRATED TAX (IGST) :</td>
                  <td colSpan="2" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    ₹ {formatPlainNumber(igst)}
                  </td>
                </tr>
              ) : taxTotal > 0 ? (
                <tr className="doc-po-summary-row">
                  <td colSpan="5" className="doc-po-summary-label">TAX AMOUNT (GST) :</td>
                  <td colSpan="2" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    ₹ {formatPlainNumber(taxTotal)}
                  </td>
                </tr>
              ) : null}

              <tr className="doc-po-total-row">
                <td colSpan="3" className="doc-po-total-label">TOTAL PURCHASE ORDER</td>
                <td style={{ textAlign: 'center', fontWeight: 800 }}>{financials.totalOrderedQty}</td>
                <td colSpan="1"></td>
                <td colSpan="2" className="doc-po-total-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  ₹ {formatPlainNumber(grandTotal)}
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 5. Amount in Words Box
 */
function PurchaseOrderAmountInWords({ words, fulfillmentMode = 'ALL' }) {
  const label = fulfillmentMode === 'RECEIVED_ONLY'
    ? 'Received Amount in Words :'
    : fulfillmentMode === 'PENDING_ONLY'
      ? 'Pending Balance in Words :'
      : 'Amount in Words :';

  return (
    <div className="doc-po-words-box">
      <div className="doc-po-words-title">{label}</div>
      <div className="doc-po-words-text">( {words} )</div>
    </div>
  );
}

/**
 * 6. Payment & Delivery Terms / Notes Box
 */
function PurchaseOrderTermsBox({ terms }) {
  const hasNotes = Boolean(terms.termsAndConditions || terms.remarks);

  return (
    <div className="doc-po-terms-box">
      <div className="doc-po-terms-title">PAYMENT &amp; DELIVERY TERMS / NOTES :</div>
      <div className="doc-po-terms-grid">
        <div className="doc-po-term-item">
          <strong>Payment Terms:</strong> {terms.paymentTerms || 'Net 30 Days'}
        </div>
        <div className="doc-po-term-item">
          <strong>Delivery Due:</strong> {terms.deliveryDue}
        </div>
        <div className="doc-po-term-item">
          <strong>Delivery Location:</strong> {terms.deliveryAddress}
        </div>
      </div>
      {hasNotes && (
        <div className="doc-po-terms-notes">
          {terms.termsAndConditions && (
            <div><strong>Terms:</strong> {terms.termsAndConditions}</div>
          )}
          {terms.remarks && (
            <div><strong>Remarks:</strong> {terms.remarks}</div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 7. Authorization / Signatures Box
 */
function PurchaseOrderSignatures({ company, fulfillmentMode = 'ALL' }) {
  const isGrn = fulfillmentMode === 'RECEIVED_ONLY';

  return (
    <div className="doc-po-signatures-box">
      {/* Left: Supplier / Goods Inward Signatory */}
      <div className="doc-po-sig-pane border-right">
        <div className="doc-po-sig-title">
          {isGrn ? 'Store In-Charge / Received By :' : 'For Supplier / Vendor :'}
        </div>
        <div className="doc-po-sig-center">
          {/* Space for Vendor Seal / Signature */}
        </div>
        <div>
          <div className="doc-po-sig-line" />
          <div className="doc-po-sig-label">
            {isGrn ? 'Goods Verified & Inward Receiver' : 'Authorized Signatory'}
          </div>
        </div>
      </div>

      {/* Right: Active System Integration Signatory & Seal */}
      <div className="doc-po-sig-pane">
        <div className="doc-po-sig-title" style={{ textAlign: 'right' }}>
          For {company.name} :
        </div>
        <div className="doc-po-sig-center">
          <AsiOfficialSeal width={74} height={74} className="asi-official-seal-svg" />
        </div>
        <div>
          <div className="doc-po-sig-line" />
          <div className="doc-po-sig-label">Authorized Signatory</div>
        </div>
      </div>
    </div>
  );
}

/**
 * 8. Unified Computer Generated Notice & Page Number Footer
 */
function PurchaseOrderFooter({ pageNumber = 1, totalPages = 1, fulfillmentMode = 'ALL' }) {
  const notice = fulfillmentMode === 'RECEIVED_ONLY'
    ? 'This is a Computer Generated Goods Receipt Note (GRN)'
    : fulfillmentMode === 'PENDING_ONLY'
      ? 'This is a Computer Generated Pending Delivery Statement'
      : 'This is a Computer Generated Purchase Order';

  return (
    <div className="doc-po-computer-notice doc-unified-footer-bar">
      <span className="doc-footer-spacer" />
      <span className="doc-footer-center-text">{notice}</span>
      <span className="doc-footer-page-num">
        {totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : 'Page 1'}
      </span>
    </div>
  );
}

/**
 * Canonical PrintablePurchaseOrder Component
 */
export default function PrintablePurchaseOrder({
  purchaseOrder,
  hidePrices = false,
  defaultFulfillmentMode = 'ALL'
}) {
  const companyConfig = useCompanyConfig();

  // Active fulfillment scope state: 'ALL' | 'RECEIVED_ONLY' | 'PENDING_ONLY'
  const [fulfillmentMode, setFulfillmentMode] = useState(
    purchaseOrder?.fulfillmentMode || defaultFulfillmentMode || 'ALL'
  );

  const isHidePrices = hidePrices || Boolean(purchaseOrder?.hidePrices);

  const doc = useMemo(() => {
    return normalizePurchaseOrderDocument(purchaseOrder, companyConfig, fulfillmentMode);
  }, [purchaseOrder, companyConfig, fulfillmentMode]);

  const pages = useMemo(() => {
    return paginatePurchaseOrder(doc, isHidePrices, fulfillmentMode);
  }, [doc, isHidePrices, fulfillmentMode]);

  if (!purchaseOrder) {
    return <div className="doc-loading">No Purchase Order data provided.</div>;
  }

  const totalPages = pages.length;

  return (
    <div>
      {/* Interactive Fulfillment Scope Selector Bar (Viewer only, hidden during print/pdf) */}
      {doc.hasReceivedData && !isHidePrices && (
        <div className="doc-po-fulfillment-tabs" data-html2canvas-ignore="true">
          <div className="doc-po-tabs-header">
            <span className="doc-po-tabs-title">Fulfillment Print &amp; View Scope:</span>
            <span className="doc-po-tabs-subtitle">
              {doc.isPartiallyReceived
                ? `⚡ Partial delivery detected (${doc.totalReceivedQty}/${doc.totalOrderedQty} units received). Choose document to view & print:`
                : `✓ Full order delivery fulfilled (${doc.totalReceivedQty} units received).`}
            </span>
          </div>
          <div className="doc-po-tabs-buttons">
            <button
              type="button"
              className={`doc-po-scope-tab ${fulfillmentMode === 'ALL' ? 'active' : ''}`}
              onClick={() => setFulfillmentMode('ALL')}
              title="View & Print Full Purchase Order Commitment"
            >
              <span className="scope-icon">📋</span>
              <span className="scope-name">Full Order Commitment</span>
              <span className="scope-tag">
                {doc.totalOrderedQty} Units · ₹{formatPlainNumber(doc.fullOrderFinancials.grandTotal)}
              </span>
            </button>

            <button
              type="button"
              className={`doc-po-scope-tab ${fulfillmentMode === 'RECEIVED_ONLY' ? 'active green' : ''}`}
              onClick={() => setFulfillmentMode('RECEIVED_ONLY')}
              title="View & Print Goods Receipt Note (GRN) with only received products and values"
            >
              <span className="scope-icon">📦</span>
              <span className="scope-name">Received Goods Only (GRN)</span>
              <span className="scope-tag green">
                ✓ {doc.totalReceivedQty} Units · ₹{formatPlainNumber(doc.receivedFinancials.grandTotal)}
              </span>
            </button>

            {doc.totalPendingQty > 0 && (
              <button
                type="button"
                className={`doc-po-scope-tab ${fulfillmentMode === 'PENDING_ONLY' ? 'active amber' : ''}`}
                onClick={() => setFulfillmentMode('PENDING_ONLY')}
                title="View & Print Pending Delivery Statement with outstanding items and balance"
              >
                <span className="scope-icon">⏳</span>
                <span className="scope-name">Pending Delivery Balance</span>
                <span className="scope-tag amber">
                  ⚡ {doc.totalPendingQty} Units · ₹{formatPlainNumber(doc.pendingFinancials.grandTotal)}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Canonical Printable Document */}
      <div className="doc-sheet-root doc-paged-root doc-po-root" id={`printable-po-content-${doc.poNumber}`}>
        {pages.map((page) => (
          <React.Fragment key={page.pageNumber}>
            {page.pageNumber > 1 && (
              <div className="doc-viewer-page-gap" aria-hidden="true">
                <div className="doc-viewer-gap-line" />
                <span className="doc-viewer-gap-badge">PAGE {page.pageNumber} OF {totalPages}</span>
                <div className="doc-viewer-gap-line" />
              </div>
            )}

            <div
              className={`doc-paged-page ${page.pageNumber < totalPages ? 'doc-page-break' : ''}`}
              data-page-num={page.pageNumber}
            >
              <PurchaseOrderWatermark comp={doc.company} />

              <div className="doc-paged-page-body">
                {page.isPage1 ? (
                  <>
                    <PurchaseOrderTitle
                      hidePrices={isHidePrices}
                      fulfillmentMode={fulfillmentMode}
                    />
                    <PurchaseOrderHeaderBox
                      company={doc.company}
                      doc={doc}
                      fulfillmentMode={fulfillmentMode}
                    />
                    <VendorShippingSection
                      supplier={doc.supplier}
                      shipping={doc.shipping}
                    />
                  </>
                ) : null}

                <PurchaseOrderItemsTable
                  items={page.items}
                  financials={doc.financials}
                  showTotals={page.showTotals}
                  hidePrices={isHidePrices}
                  fulfillmentMode={fulfillmentMode}
                  doc={doc}
                />

                {page.showBottomSection && (
                  <>
                    {!isHidePrices && (
                      <PurchaseOrderAmountInWords
                        words={doc.financials.amountWords}
                        fulfillmentMode={fulfillmentMode}
                      />
                    )}
                    <PurchaseOrderTermsBox terms={doc.terms} />
                    <PurchaseOrderSignatures
                      company={doc.company}
                      fulfillmentMode={fulfillmentMode}
                    />
                  </>
                )}
              </div>

              <PurchaseOrderFooter
                pageNumber={page.pageNumber}
                totalPages={totalPages}
                fulfillmentMode={fulfillmentMode}
              />
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
