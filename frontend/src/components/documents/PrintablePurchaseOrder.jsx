import React, { useMemo, useState, useEffect } from 'react';
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
 * Creates the Canonical Purchase Order View Model from raw PO data and company settings.
 * Single source of truth across Browser Preview, Browser Print, and Downloaded PDF.
 */
export function normalizePurchaseOrderDocument(poData = {}, customSettings = {}) {
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

  // Normalize Items
  // Normalize Items with Discount & Tax Calculations
  const rawItems = Array.isArray(poData.items) ? poData.items : [];
  let totalQty = 0;
  let totalReceivedQty = 0;
  let totalPendingQty = 0;
  let computedSubtotal = 0;
  let computedTax = 0;
  let computedDiscount = 0;

  const items = rawItems.map((it, idx) => {
    const qty = Number(it.orderedQty || it.quantity || it.qty || 0);
    const recQty = Number(it.receivedQty || 0);
    const pendQty = Math.max(0, qty - recQty);
    const rate = Number(it.rate || it.unitPrice || 0);
    const gstRate = Number(it.gstRate || it.gst || it.taxRate || 18);
    const discountPct = Number(it.discountPercent || it.discountPct || it.discount || 0);
    const rawVal = rate * qty;
    const discountAmount = Number(it.discountAmount !== undefined ? it.discountAmount : (rawVal * discountPct) / 100);
    const taxableValue = Number(it.taxableValue !== undefined ? it.taxableValue : (rawVal - discountAmount));
    const tax = Number(it.tax !== undefined ? it.tax : (taxableValue * gstRate) / 100);
    const lineTotal = Number(it.lineTotal !== undefined ? it.lineTotal : (taxableValue + tax));

    totalQty += qty;
    totalReceivedQty += recQty;
    totalPendingQty += pendQty;
    computedSubtotal += taxableValue;
    computedTax += tax;
    computedDiscount += discountAmount;

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
      productName: (it.productName || it.name || it.item || 'Item').toString().trim(),
      productCode: pCode,
      description: (it.description || '').toString().trim(),
      hsnSac: hsn,
      orderedQty: qty,
      receivedQty: recQty,
      pendingQty: pendQty,
      unit: ((it.unit && it.unit !== 'Piece') ? it.unit : 'Nos').toString().trim(),
      rate,
      discountPercent: discountPct,
      discountAmount,
      taxableValue,
      gstRate,
      tax,
      lineTotal,
      serialized: Boolean(it.serialized || it.isSerialized),
      serialNumbers: Array.isArray(it.serialNumbers) ? it.serialNumbers : []
    };
  });

  const subtotal = Number(poData.subtotal !== undefined ? poData.subtotal : computedSubtotal.toFixed(2));
  const cgst = Number(poData.cgst || 0);
  const sgst = Number(poData.sgst || 0);
  const igst = Number(poData.igst || 0);

  let taxTotal = cgst + sgst + igst;
  if (taxTotal <= 0) {
    taxTotal = Number(poData.tax !== undefined ? poData.tax : computedTax.toFixed(2));
  }

  const grossTotal = Math.round((subtotal + taxTotal) * 100) / 100;
  let roundOff = 0;
  let grandTotal = grossTotal;

  if (poData.roundOff !== undefined && poData.roundOff !== null) {
    roundOff = Number(poData.roundOff);
    grandTotal = poData.grandTotal !== undefined && Number(poData.grandTotal) > 0
      ? Number(poData.grandTotal)
      : Math.round((grossTotal + roundOff) * 100) / 100;
  } else if (poData.grandTotal !== undefined && Number(poData.grandTotal) > 0) {
    grandTotal = Number(poData.grandTotal);
    roundOff = Math.round((grandTotal - grossTotal) * 100) / 100;
  } else {
    grandTotal = Math.round(grossTotal);
    roundOff = Number((grandTotal - grossTotal).toFixed(2));
  }

  return {
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
    items,
    totalOrderedQty: totalQty,
    totalReceivedQty: poData.totalReceivedQty !== undefined ? Number(poData.totalReceivedQty) : totalReceivedQty,
    totalPendingQty: poData.totalPendingQty !== undefined ? Number(poData.totalPendingQty) : totalPendingQty,
    advanceAmount: Number(poData.advanceAmount || 0),
    balanceAmount: Number(poData.balanceAmount || 0),
    payingBank: poData.payingBank || null,
    paymentMethod: poData.paymentMethod || null,
    paymentRef: poData.paymentRef || null,
    financials: {
      totalQty,
      totalOrderedQty: totalQty,
      totalReceivedQty: poData.totalReceivedQty !== undefined ? Number(poData.totalReceivedQty) : totalReceivedQty,
      totalPendingQty: poData.totalPendingQty !== undefined ? Number(poData.totalPendingQty) : totalPendingQty,
      subtotal,
      cgst,
      sgst,
      igst,
      taxTotal,
      roundOff,
      grandTotal,
      amountWords: amountInWords(grandTotal)
    },
    terms: {
      paymentTerms,
      payingBank: poData.payingBank || null,
      paymentMethod: poData.paymentMethod || null,
      paymentRef: poData.paymentRef || null,
      advanceAmount: Number(poData.advanceAmount || 0),
      balanceAmount: Number(poData.balanceAmount || 0),
      deliveryDue,
      deliveryAddress,
      termsAndConditions: (poData.termsAndConditions || '').toString().trim(),
      remarks: (poData.remarks || '').toString().trim()
    },
    createdBy: (poData.createdBy || 'Admin').toString().trim()
  };
}

/**
 * Centered Background Watermark Logo (strictly for Purchase Order)
 * Matches the official Sales Invoice watermark with optimal opacity for print & PDF
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
function PurchaseOrderTitle({ hidePrices = false, doc = {} }) {
  const totalOrdered = Number(doc?.totalOrderedQty || 0);
  const totalReceived = Number(doc?.totalReceivedQty || 0);
  const totalPending = Number(doc?.totalPendingQty || 0);
  const statusUpper = String(doc?.status || '').toUpperCase().trim();

  const isPartial =
    statusUpper === 'PARTIALLY_RECEIVED' ||
    statusUpper === 'PARTIAL' ||
    (totalReceived > 0 && totalPending > 0);

  const isFull =
    statusUpper === 'RECEIVED' ||
    statusUpper === 'COMPLETED' ||
    statusUpper === 'FULL' ||
    statusUpper === 'DELIVERED' ||
    (totalOrdered > 0 && totalReceived >= totalOrdered && totalPending === 0);

  let title = 'PURCHASE ORDER';
  if (hidePrices) {
    if (isPartial) {
      title = 'PURCHASE ORDER - VENDOR COPY (PARTIAL DELIVERY)';
    } else if (isFull) {
      title = 'PURCHASE ORDER - VENDOR COPY (FULL DELIVERY)';
    } else {
      title = 'PURCHASE ORDER (VENDOR COPY)';
    }
  } else {
    if (isPartial) {
      title = 'PURCHASE ORDER - PARTIAL DELIVERY';
    } else if (isFull) {
      title = 'PURCHASE ORDER - FULL DELIVERY';
    } else {
      title = 'PURCHASE ORDER';
    }
  }

  return (
    <div className="doc-po-top-title">
      {title}
    </div>
  );
}

/**
 * 2. Top Header Box: Company Info | PO Metadata Table (matching Proforma layout)
 */
function PurchaseOrderHeaderBox({ company, doc }) {
  const [imgFailed, setImgFailed] = useState(false);
  const logoUrl = company?.logoUrl || DEFAULT_ASI_LOGO;
  const logoDim = 106;

  const totalOrdered = Number(doc?.totalOrderedQty || 0);
  const totalReceived = Number(doc?.totalReceivedQty || 0);
  const totalPending = Number(doc?.totalPendingQty || 0);
  const statusUpper = String(doc?.status || '').toUpperCase().trim();

  const isPartial =
    statusUpper === 'PARTIALLY_RECEIVED' ||
    statusUpper === 'PARTIAL' ||
    (totalReceived > 0 && totalPending > 0);

  const isFull =
    statusUpper === 'RECEIVED' ||
    statusUpper === 'COMPLETED' ||
    statusUpper === 'FULL' ||
    statusUpper === 'DELIVERED' ||
    (totalOrdered > 0 && totalReceived >= totalOrdered && totalPending === 0);

  let statusLabel = 'PENDING';
  let statusColor = '#475569';
  let statusBg = '#f8fafc';
  let statusBorder = '#cbd5e1';
  let statusIcon = '';

  if (isFull) {
    statusLabel = 'RECEIVED (FULL DELIVERY)';
    statusColor = '#16a34a';
    statusBg = '#f0fdf4';
    statusBorder = '#86efac';
    statusIcon = '✓ ';
  } else if (isPartial) {
    statusLabel = totalOrdered > 0
      ? `PARTIALLY RECEIVED (${totalReceived}/${totalOrdered})`
      : 'PARTIALLY RECEIVED';
    statusColor = '#b45309';
    statusBg = '#fffbeb';
    statusBorder = '#fde68a';
    statusIcon = '⚡ ';
  } else if (statusUpper === 'ORDERED' || statusUpper === 'ISSUED' || statusUpper === 'SENT') {
    statusLabel = statusUpper;
    statusColor = '#2563eb';
    statusBg = '#eff6ff';
    statusBorder = '#bfdbfe';
  } else if (statusUpper === 'CANCELLED') {
    statusLabel = 'CANCELLED';
    statusColor = '#dc2626';
    statusBg = '#fef2f2';
    statusBorder = '#fca5a5';
    statusIcon = '✕ ';
  } else if (statusUpper) {
    statusLabel = statusUpper;
  }

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
      <div className="doc-inv-meta-pane doc-po-meta-pane">
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
              <td className="doc-po-meta-val">
                {doc.paymentTerms}
                {doc.payingBank && (
                  <span style={{ fontSize: '10.5px', color: '#15803d', fontWeight: 700, marginLeft: '6px' }}>
                    [✓ Paid via {doc.payingBank} ({doc.paymentMethod || 'Direct'})]
                  </span>
                )}
              </td>
            </tr>
            {Number(doc?.advanceAmount || 0) > 0 && (
              <tr>
                <td className="doc-po-meta-label">Advance Paid :</td>
                <td className="doc-po-meta-val bold" style={{ color: '#15803d' }}>
                  ₹{Number(doc.advanceAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {Number(doc.balanceAmount || 0) > 0 && (
                    <span style={{ fontSize: '10px', color: '#475569', fontWeight: 600, marginLeft: '6px' }}>
                      (Due: ₹{Number(doc.balanceAmount).toLocaleString('en-IN')})
                    </span>
                  )}
                </td>
              </tr>
            )}
            <tr>
              <td className="doc-po-meta-label">Received Status :</td>
              <td className="doc-po-meta-val bold">
                <span
                  style={{
                    display: 'inline-block',
                    padding: '1.5px 6px',
                    borderRadius: '3px',
                    fontSize: '11px',
                    fontWeight: 800,
                    color: statusColor,
                    background: statusBg,
                    border: `1px solid ${statusBorder}`,
                    letterSpacing: '0.3px',
                    textTransform: 'uppercase'
                  }}
                >
                  {statusIcon}{statusLabel}
                </span>
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
export function estimatePoBottomHeight(doc, hidePrices = false) {
  if (hidePrices) {
    let h = 80 + 105;
    if (doc?.terms?.termsAndConditions || doc?.terms?.remarks) {
      h += 30;
    }
    return h;
  }
  let h = 100 + 36 + 80 + 105;
  if (doc?.terms?.termsAndConditions || doc?.terms?.remarks) {
    h += 30;
  }
  return h;
}

/**
 * Paginates Purchase Order items across pages
 */
export function paginatePurchaseOrder(doc, hidePrices = false) {
  const items = Array.isArray(doc?.items) && doc.items.length > 0 ? doc.items : [];
  const bottomHeight = estimatePoBottomHeight(doc || {}, hidePrices);

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
 * 4. Purchase Order Items Table with Integrated Financial Summary (or Quantity-only for Vendor)
 */
function PurchaseOrderItemsTable({ items, financials, showTotals = true, hidePrices = false }) {
  const { totalQty, subtotal, cgst, sgst, igst, taxTotal, roundOff, grandTotal } = financials;

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
                  {it.description ? (
                    <div className="doc-po-item-desc">{it.description}</div>
                  ) : null}
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
                  {totalQty} Ord
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
                {it.description ? (
                  <div className="doc-po-item-desc">{it.description}</div>
                ) : null}
                {it.serialized && it.serialNumbers.length > 0 && (
                  <div className="doc-po-item-serials">
                    <strong>Serials:</strong> {it.serialNumbers.join(', ')}
                  </div>
                )}
              </td>
              <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{it.hsnSac}</td>
              <td style={{ textAlign: 'center', fontWeight: 700 }}>
                <div>{it.orderedQty}</div>
                {Number(it.receivedQty || 0) > 0 && (
                  <div style={{ fontSize: '9.5px', color: '#16a34a', fontWeight: 600, marginTop: '2px', whiteSpace: 'nowrap' }}>
                    {it.receivedQty} Recd
                  </div>
                )}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                ₹ {formatPlainNumber(it.rate)}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                <div style={{ whiteSpace: 'nowrap', fontWeight: 600, color: '#0f172a' }}>
                  ₹ {formatPlainNumber(it.tax)}
                </div>
                <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', marginTop: '1px' }}>
                  (GST {it.gstRate}%)
                </div>
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, whiteSpace: 'nowrap' }}>
                ₹ {formatPlainNumber(it.lineTotal)}
              </td>
            </tr>
          ))}

          {/* Subtotal & Summary Rows (Only on last page when showTotals = true) */}
          {showTotals && (
            <>
              {/* Subtotal (Taxable) Row */}
              <tr className="doc-po-summary-row">
                <td colSpan="5" className="doc-po-summary-label">SUBTOTAL (TAXABLE) :</td>
                <td colSpan="2" className="doc-po-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  ₹ {formatPlainNumber(subtotal)}
                </td>
              </tr>

              {/* Tax Breakdown Rows */}
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

              {/* Grand Total Row */}
              <tr className="doc-po-total-row">
                <td colSpan="3" className="doc-po-total-label">TOTAL PURCHASE ORDER</td>
                <td style={{ textAlign: 'center', fontWeight: 800 }}>{totalQty}</td>
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
function PurchaseOrderAmountInWords({ words }) {
  return (
    <div className="doc-po-words-box">
      <div className="doc-po-words-title">Amount in Words :</div>
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
          {Number(terms.advanceAmount || 0) > 0 && (
            <span style={{ marginLeft: '8px', color: '#15803d', fontWeight: 600 }}>
              (Advance: ₹{Number(terms.advanceAmount).toLocaleString('en-IN')} • Due: ₹{Number(terms.balanceAmount || 0).toLocaleString('en-IN')})
            </span>
          )}
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
function PurchaseOrderSignatures({ company }) {
  return (
    <div className="doc-po-signatures-box">
      {/* Left: Supplier / Vendor Signatory */}
      <div className="doc-po-sig-pane border-right">
        <div className="doc-po-sig-title">For Supplier / Vendor :</div>
        <div className="doc-po-sig-center">
          {/* Space for Vendor Seal / Signature */}
        </div>
        <div>
          <div className="doc-po-sig-line" />
          <div className="doc-po-sig-label">Authorized Signatory</div>
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
function PurchaseOrderFooter({ pageNumber = 1, totalPages = 1 }) {
  return (
    <div className="doc-po-computer-notice doc-unified-footer-bar">
      <span className="doc-footer-spacer" />
      <span className="doc-footer-center-text">
        This is a Computer Generated Purchase Order
      </span>
      <span className="doc-footer-page-num">
        {totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : 'Page 1'}
      </span>
    </div>
  );
}

/**
 * Canonical PrintablePurchaseOrder Component
 */
export default function PrintablePurchaseOrder({ purchaseOrder, po, hidePrices = false }) {
  const companyConfig = useCompanyConfig();
  const rawPo = purchaseOrder || po;

  const [isVendorCopy, setIsVendorCopy] = useState(
    Boolean(hidePrices) || Boolean(rawPo?.hidePrices) || Boolean(rawPo?.isVendorCopy)
  );

  useEffect(() => {
    setIsVendorCopy(Boolean(hidePrices) || Boolean(rawPo?.hidePrices) || Boolean(rawPo?.isVendorCopy));
  }, [hidePrices, rawPo]);

  const isHidePrices = isVendorCopy;

  const doc = useMemo(() => {
    return normalizePurchaseOrderDocument(rawPo, companyConfig);
  }, [rawPo, companyConfig]);

  const pages = useMemo(() => {
    return paginatePurchaseOrder(doc, isHidePrices);
  }, [doc, isHidePrices]);

  if (!rawPo) {
    return <div className="doc-loading">No Purchase Order data provided.</div>;
  }

  const totalPages = pages.length;

  return (
    <div className="doc-po-viewer-container">
      {/* Interactive Switcher for In-App Document Viewer (Hidden on Print & PDF) */}
      <div
        className="doc-po-mode-switcher doc-no-print"
        data-html2canvas-ignore="true"
      >
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginRight: '4px' }}>
          Document Version:
        </span>
        <button
          type="button"
          onClick={() => setIsVendorCopy(false)}
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            fontWeight: !isHidePrices ? 800 : 600,
            color: !isHidePrices ? '#1e40af' : '#64748b',
            background: !isHidePrices ? '#dbeafe' : '#f8fafc',
            border: `1px solid ${!isHidePrices ? '#93c5fd' : '#e2e8f0'}`,
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          📄 Standard PO (With Rates)
        </button>
        <button
          type="button"
          onClick={() => setIsVendorCopy(true)}
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            fontWeight: isHidePrices ? 800 : 600,
            color: isHidePrices ? '#0369a1' : '#64748b',
            background: isHidePrices ? '#e0f2fe' : '#f8fafc',
            border: `1px solid ${isHidePrices ? '#7dd3fc' : '#e2e8f0'}`,
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          🏷️ Vendor Copy (Rates Hidden)
        </button>
      </div>

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
                    <PurchaseOrderTitle hidePrices={isHidePrices} doc={doc} />
                    <PurchaseOrderHeaderBox company={doc.company} doc={doc} />
                    <VendorShippingSection supplier={doc.supplier} shipping={doc.shipping} />
                  </>
                ) : null}

                <PurchaseOrderItemsTable
                  items={page.items}
                  financials={doc.financials}
                  showTotals={page.showTotals}
                  hidePrices={isHidePrices}
                />

                {page.showBottomSection && (
                  <>
                    {!isHidePrices && <PurchaseOrderAmountInWords words={doc.financials.amountWords} />}
                    <PurchaseOrderTermsBox terms={doc.terms} />
                    <PurchaseOrderSignatures company={doc.company} />
                  </>
                )}
              </div>

              <PurchaseOrderFooter
                pageNumber={page.pageNumber}
                totalPages={totalPages}
              />
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
