import React, { useMemo, useState } from 'react';
import {
  COMPANY_CONFIG,
  getMergedCompanySettings,
  AsiLogo,
  AsiOfficialSeal,
  useCompanyConfig,
  DEFAULT_ASI_LOGO,
  ASI_WATERMARK_LOGO
} from './companyConfig';
import {
  formatPlainNumber,
  formatDocDate,
  amountInWords,
  normalizePartyLines,
  formatPartyAddressLines
} from './documentFormatters';
import './documentStyles.css';

/**
 * Creates the Canonical Invoice View Model from raw invoice data and company settings.
 * Single source of truth across Browser Preview, Browser Print, and Downloaded PDF.
 */
export function normalizeInvoiceDocument(invoiceData = {}, customSettings = {}) {
  const comp = getMergedCompanySettings(customSettings || invoiceData.companyDetails || {});

  // Canonical phone rule: Single phone number only (9171126666)
  let cleanPhone = (comp.phone || '9171126666').toString();
  if (cleanPhone.includes('/') || cleanPhone.includes(',') || cleanPhone.includes('09994126666')) {
    cleanPhone = '9171126666';
  } else {
    cleanPhone = cleanPhone.trim();
  }
  comp.phone = cleanPhone;

  const invoiceNumber = (
    invoiceData.invoiceNumber ||
    invoiceData.invoiceId ||
    invoiceData.invoiceNo ||
    'INV-PENDING'
  ).trim();

  const invoiceDate = formatDocDate(invoiceData.invoiceDate || invoiceData.createdAt);

  // Customer PO Reference (CRITICAL: Must be genuine Customer PO, never internal invoice/order ID)
  let customerPoNumber = (invoiceData.customerPoNumber || invoiceData.poNumber || '').trim();
  if (
    !customerPoNumber ||
    customerPoNumber === invoiceNumber ||
    customerPoNumber === invoiceData.invoiceId ||
    customerPoNumber === invoiceData.orderId ||
    customerPoNumber === invoiceData.salesOrderId ||
    String(customerPoNumber).startsWith('INV-') ||
    String(customerPoNumber).startsWith('ORD-')
  ) {
    customerPoNumber = null;
  }
  const customerPoDate = customerPoNumber
    ? formatDocDate(invoiceData.customerPoDate || invoiceData.poDate || null)
    : null;

  // DC Reference
  const dcNumber = (invoiceData.dcNumber || invoiceData.challanId || '').trim() || null;
  const dcDate = dcNumber
    ? formatDocDate(invoiceData.dcDate || invoiceData.challanDate || invoiceData.deliveryDate || null)
    : null;

  // Quotation Reference
  const quotationNumber = (
    invoiceData.quotationNumber ||
    invoiceData.quotationId ||
    invoiceData.quoteNumber ||
    ''
  ).trim() || null;
  const quotationDate = quotationNumber
    ? formatDocDate(invoiceData.quotationDate || null)
    : null;

  // Sales Order Reference (Conditional: genuine sales order reference, never internal invoice id)
  let salesOrderNumber = (
    invoiceData.salesOrderNo ||
    invoiceData.salesOrderId ||
    invoiceData.orderId ||
    ''
  ).trim();
  if (
    !salesOrderNumber ||
    salesOrderNumber === invoiceNumber ||
    salesOrderNumber === invoiceData.invoiceId ||
    String(salesOrderNumber).startsWith('INV-')
  ) {
    salesOrderNumber = null;
  }
  const salesOrderDate = salesOrderNumber
    ? formatDocDate(invoiceData.salesOrderDate || invoiceData.orderDate || null)
    : null;

  // Dispatch details
  const cleanDispatch = (val) => {
    if (!val) return null;
    const str = String(val).trim();
    if (!str || str === '-' || str === '—' || ['NA', 'N/A', 'NONE', 'NULL'].includes(str.toUpperCase())) return null;
    const parts = str.split(/\s*-\s*/);
    if (parts.length === 2 && parts[0].trim().toLowerCase() === parts[1].trim().toLowerCase()) {
      return parts[0].trim();
    }
    return str;
  };

  const dispatchThrough = cleanDispatch(invoiceData.dispatchThrough || invoiceData.transitMode);
  const dispatchDate = dispatchThrough
    ? formatDocDate(invoiceData.dispatchDate || invoiceData.challanDate || null)
    : null;

  // Customer / Consignee / Billing Snapshot
  // Robust Customer & Company Name Resolution: Never show internal Order ID or Invoice ID or PO as customer name.
  let rawCustomerName = (
    invoiceData.consigneeName ||
    invoiceData.customerName ||
    invoiceData.company ||
    'Customer Account'
  ).trim();

  if (
    rawCustomerName.startsWith('ORD-') ||
    rawCustomerName.startsWith('INV-') ||
    rawCustomerName.startsWith('PO-') ||
    rawCustomerName === invoiceData.poNumber
  ) {
    rawCustomerName = (invoiceData.company || invoiceData.customerName || 'Customer Account').trim();
  }

  let rawCompany = (invoiceData.company || '').trim();
  if (
    rawCompany.startsWith('ORD-') ||
    rawCompany.startsWith('INV-') ||
    rawCompany.startsWith('PO-') ||
    rawCompany === invoiceData.poNumber
  ) {
    rawCompany = '';
  }

  const customerName = rawCustomerName;
  const companyName = (rawCompany && rawCompany !== rawCustomerName)
    ? rawCompany
    : (invoiceData.customerName && invoiceData.customerName !== rawCustomerName ? invoiceData.customerName.trim() : '');

  const billingAddress = (
    invoiceData.consigneeAddress ||
    invoiceData.billingAddress ||
    invoiceData.customerAddress ||
    ''
  ).trim();

  // Avoid injecting Chennai/600095 for non-TN customers
  const billingCity = (invoiceData.consigneeCity || invoiceData.billingCity || invoiceData.city || '').trim();
  const billingPincode = (invoiceData.consigneePincode || invoiceData.billingPincode || invoiceData.pincode || '').trim();
  const billingGstin = (
    invoiceData.consigneeGstin ||
    invoiceData.billingGstin ||
    invoiceData.customerGstin ||
    invoiceData.gstin ||
    ''
  ).trim();

  // State deduction rule: State MUST be visible. If empty, derive from GSTIN state code or keywords or TN fallback.
  let billingState = (
    invoiceData.consigneeState ||
    invoiceData.billingState ||
    invoiceData.customerState ||
    invoiceData.state ||
    ''
  ).trim();

  if (!billingState && billingGstin && billingGstin.length >= 2) {
    const code = billingGstin.slice(0, 2);
    if (code === '33') billingState = 'Tamil Nadu';
    else if (code === '27') billingState = 'Maharashtra';
    else if (code === '29') billingState = 'Karnataka';
    else if (code === '32') billingState = 'Kerala';
    else if (code === '37') billingState = 'Andhra Pradesh';
    else if (code === '36') billingState = 'Telangana';
    else if (code === '07') billingState = 'Delhi';
    else if (code === '24') billingState = 'Gujarat';
    else if (code === '08') billingState = 'Rajasthan';
    else if (code === '09') billingState = 'Uttar Pradesh';
    else if (code === '19') billingState = 'West Bengal';
  }
  if (!billingState) {
    const billLower = (billingAddress + ' ' + billingCity).toLowerCase();
    if (billLower.includes('delhi')) billingState = 'Delhi';
    else if (billLower.includes('mumbai') || billLower.includes('pune') || billLower.includes('maharashtra')) billingState = 'Maharashtra';
    else if (billLower.includes('bangalore') || billLower.includes('bengaluru') || billLower.includes('karnataka')) billingState = 'Karnataka';
    else if (billLower.includes('hyderabad') || billLower.includes('telangana')) billingState = 'Telangana';
    else billingState = 'Tamil Nadu';
  }

  const billingParty = normalizePartyLines(customerName, companyName);
  const billingSnapshot = {
    name: billingParty.primaryLine,
    company: billingParty.secondaryLine || null,
    address: billingAddress,
    city: billingCity,
    state: billingState,
    pincode: billingPincode,
    gstin: billingGstin,
    phone: invoiceData.customerPhone || '',
    email: invoiceData.customerEmail || ''
  };

  // Shipping Snapshot (independently uses saved shipping snapshot)
  let rawShippingName = (invoiceData.shippingName || invoiceData.receiverName || customerName).trim();
  if (
    rawShippingName.startsWith('ORD-') ||
    rawShippingName.startsWith('INV-') ||
    rawShippingName.startsWith('PO-')
  ) {
    rawShippingName = customerName;
  }

  const shippingAddress = (invoiceData.shippingAddress || invoiceData.deliveryAddress || billingAddress).trim();
  const shippingCity = (invoiceData.shippingCity || billingCity).trim();
  const shippingPincode = (invoiceData.shippingPincode || billingPincode).trim();
  const shippingGstin = (invoiceData.shippingGstin || billingGstin).trim();

  let shippingState = (
    invoiceData.shippingState ||
    invoiceData.deliveryState ||
    invoiceData.receiverState ||
    billingState
  ).trim();
  if (!shippingState) shippingState = billingState;

  const shippingParty = normalizePartyLines(rawShippingName, companyName);
  const shippingSnapshot = {
    name: shippingParty.primaryLine,
    company: shippingParty.secondaryLine || null,
    address: shippingAddress,
    city: shippingCity,
    state: shippingState,
    pincode: shippingPincode,
    gstin: shippingGstin,
    phone: invoiceData.customerPhone || '',
    email: invoiceData.customerEmail || ''
  };

  const customerSnapshot = {
    ...billingSnapshot,
    phone: invoiceData.customerPhone || '',
    email: invoiceData.customerEmail || ''
  };

  // Items normalization with historical transaction rate preservation
  const rawItems = Array.isArray(invoiceData.items) ? invoiceData.items : [];
  const showDiscount = invoiceData.showDiscount !== undefined
    ? Boolean(invoiceData.showDiscount)
    : Boolean(
        Number(invoiceData.totalDiscount || invoiceData.discount || 0) > 0 ||
        rawItems.some((it) => Number(it.discount || it.discountPct || 0) > 0)
      );

  const items = rawItems.map((item, idx) => {
    const qty = Number(item.quantity !== undefined ? item.quantity : (item.deliveryQty || 1));
    const unit = (item.unit && item.unit !== 'Piece') ? item.unit : 'Nos';
    const rate = Number(item.unitPrice !== undefined ? item.unitPrice : (item.price || item.rate || 0));
    const gstPct = Number(item.gst !== undefined ? item.gst : 18);
    const discountPct = Math.max(0, Math.min(100, Number(item.discount !== undefined ? item.discount : (item.discountPct || 0))));
    const rawSubtotal = Math.round(qty * rate * 100) / 100;
    const discountAmount = showDiscount ? Math.round(rawSubtotal * (discountPct / 100) * 100) / 100 : 0;
    const taxableValue = Number(
      item.taxableSubtotal !== undefined && item.taxableSubtotal !== null
        ? item.taxableSubtotal
        : (item.taxableValue !== undefined
            ? item.taxableValue
            : (item.lineSubtotal !== undefined && item.lineSubtotal !== null
                ? item.lineSubtotal
                : Math.round((rawSubtotal - discountAmount) * 100) / 100))
    );
    const lineTax = Number(item.lineTax !== undefined ? item.lineTax : Math.round((taxableValue * gstPct) / 100 * 100) / 100);
    const lineTotal = Number(item.lineTotal !== undefined ? item.lineTotal : Math.round((taxableValue + lineTax) * 100) / 100);
    const serials = Array.isArray(item.serialNumbers) ? item.serialNumbers.filter(Boolean) : [];

    let hsn = (item.hsnSac || item.hsnCode || item.hsn || '').toString().trim();
    if (!hsn && (item.productCode || item.sku)) {
      const codeHsnMap = {
        'CAM-IPC-001': '85258090',
        'CAM-IPC-002': '85258090',
        'NVR-008-001': '85219090',
        'NET-SW-001': '85176290',
        'HDD-1TB-001': '84717020'
      };
      const pCode = item.productCode || item.sku;
      if (codeHsnMap[pCode]) {
        hsn = codeHsnMap[pCode];
      }
    }
    if (!hsn) {
      hsn = '85258090';
    }

    return {
      sl: idx + 1,
      name: item.productName || item.name || 'Product / Service Item',
      sku: item.productCode || item.sku || item.model || '',
      description: item.productDetails || item.description || '',
      hsnSac: hsn,
      quantity: qty,
      unit: unit,
      rate: rate,
      discountPct,
      discountAmount,
      taxableValue: taxableValue,
      gstPct: gstPct,
      tax: lineTax,
      amount: taxableValue,
      serialNumbers: serials,
      isSerialized: Boolean(item.serialized || serials.length > 0)
    };
  });

  const totalQty = items.reduce((sum, it) => sum + it.quantity, 0);

  // Authoritative Financial Calculations: Line items are the single source of truth
  const grossSubtotal = items.length > 0
    ? Math.round(items.reduce((sum, it) => sum + (it.quantity * it.rate), 0) * 100) / 100
    : Number(invoiceData.grossSubtotal || invoiceData.subtotal || 0);

  const calculatedTaxTotal = items.length > 0
    ? Math.round(items.reduce((sum, it) => sum + it.tax, 0) * 100) / 100
    : Number(invoiceData.gstTotal || invoiceData.taxTotal || 0);

  const calculatedDiscount = Math.round(items.reduce((sum, it) => sum + (it.discountAmount || 0), 0) * 100) / 100;

  const discount = showDiscount
    ? (invoiceData.totalDiscount !== undefined
        ? Number(invoiceData.totalDiscount)
        : (invoiceData.discount !== undefined ? Number(invoiceData.discount) : calculatedDiscount))
    : 0;

  const taxableSubtotal = showDiscount
    ? (invoiceData.taxableSubtotal !== undefined
        ? Number(invoiceData.taxableSubtotal)
        : Math.round((grossSubtotal - discount) * 100) / 100)
    : grossSubtotal;

  const subtotal = taxableSubtotal;
  const taxableValue = subtotal;
  const taxTotal = calculatedTaxTotal;
  const roundOff = invoiceData.roundOff !== undefined ? Number(invoiceData.roundOff) : 0;
  const grandTotal = invoiceData.grandTotal !== undefined && Number(invoiceData.grandTotal) > 0
    ? Number(invoiceData.grandTotal)
    : Math.round((taxableSubtotal + taxTotal + roundOff) * 100) / 100;

  // Inter-State vs Intra-State determination
  // Company state is Tamil Nadu (State Code: 33).
  // Seller and Buyer in Tamil Nadu -> Intra-state (CGST + SGST).
  // Buyer outside Tamil Nadu -> Inter-state (IGST).
  const billStateLower = String(billingState || '').toLowerCase();
  const billAddrLower = String(billingAddress || '').toLowerCase();
  const shipAddrLower = String(shippingAddress || '').toLowerCase();
  const gstinStr = String(billingGstin || shippingGstin || invoiceData.customerGstin || invoiceData.gstin || '').trim().toUpperCase();

  // Known Tamil Nadu cities, districts and keywords
  const tnKeywords = [
    'tamil nadu', 'tamilnadu', 'tamil-nadu', 'tn',
    'chennai', 'coimbatore', 'madurai', 'trichy', 'tiruchirappalli',
    'salem', 'tirunelveli', 'tiruppur', 'vellore', 'erode', 'thanjavur',
    'dindigul', 'ranipet', 'kanchipuram', 'karur', 'namakkal', 'hosur',
    'vanagaram', 'ambattur', 'guindy', 'tambaram', 'avadi'
  ];

  const hasTnKeyword = tnKeywords.some(kw => 
    billStateLower.includes(kw) || billAddrLower.includes(kw) || shipAddrLower.includes(kw)
  );

  // Tamil Nadu PIN codes start with 600xxx to 643xxx
  const pinMatch = (billingPincode || billingAddress || '').match(/\b(6[0-4][0-9]{4})\b/);
  const isTnPincode = Boolean(pinMatch);

  const isCustTn = gstinStr.startsWith('33') || hasTnKeyword || isTnPincode;

  // Check explicit outside state indicators
  const outsideStateCodes = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','34','35','36','37','38'];
  const hasOutsideGstin = gstinStr.length >= 2 && outsideStateCodes.includes(gstinStr.slice(0, 2)) && gstinStr.slice(0, 2) !== '33';
  
  const outsideKeywords = ['maharashtra', 'karnataka', 'delhi', 'kerala', 'andhra', 'telangana', 'gujarat', 'rajasthan', 'uttar pradesh', 'bengaluru', 'bangalore', 'mumbai', 'pune', 'hyderabad'];
  const hasOutsideKeyword = outsideKeywords.some(kw => billStateLower.includes(kw) || billAddrLower.includes(kw));

  let isInterState = false;
  if (invoiceData.taxType === 'IGST' || invoiceData.isInterState === true) {
    isInterState = true;
  } else if (invoiceData.taxType === 'CGST_SGST' || invoiceData.taxType === 'INTRA_STATE' || invoiceData.isInterState === false) {
    isInterState = false;
  } else if (hasOutsideGstin || hasOutsideKeyword) {
    isInterState = true;
  } else if (isCustTn) {
    isInterState = false;
  } else {
    // Default to Intra-State (Tamil Nadu) as seller is Active System Integration in Chennai, TN
    isInterState = false;
  }

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isInterState) {
    igst = taxTotal;
  } else {
    cgst = Math.round((taxTotal / 2) * 100) / 100;
    sgst = Math.round((taxTotal - cgst) * 100) / 100;
  }

  // Tax Summary grouped by HSN/SAC
  const taxSummaryMap = {};
  items.forEach((it) => {
    const key = it.hsnSac || '995461';
    if (!taxSummaryMap[key]) {
      taxSummaryMap[key] = {
        hsnSac: key,
        taxableValue: 0,
        rate: it.gstPct,
        centralRate: (it.gstPct / 2).toFixed(2),
        centralAmount: 0,
        stateRate: (it.gstPct / 2).toFixed(2),
        stateAmount: 0,
        integratedRate: it.gstPct.toFixed(2),
        integratedAmount: 0,
        totalTax: 0
      };
    }
    taxSummaryMap[key].taxableValue = Math.round((taxSummaryMap[key].taxableValue + it.taxableValue) * 100) / 100;
    taxSummaryMap[key].totalTax = Math.round((taxSummaryMap[key].totalTax + it.tax) * 100) / 100;

    if (isInterState) {
      taxSummaryMap[key].integratedAmount = Math.round((taxSummaryMap[key].integratedAmount + it.tax) * 100) / 100;
    } else {
      const half = Math.round((it.tax / 2) * 100) / 100;
      taxSummaryMap[key].centralAmount = Math.round((taxSummaryMap[key].centralAmount + half) * 100) / 100;
      taxSummaryMap[key].stateAmount = Math.round((taxSummaryMap[key].stateAmount + (it.tax - half)) * 100) / 100;
    }
  });

  const taxSummary = Object.values(taxSummaryMap);

  // Metadata Table Rows: Formal 5-row specification
  // 1. INVOICE NO (always present)
  // 2. DC NO (only if genuine data exists)
  // 3. Q.NO (only if genuine data exists)
  // 4. CUSTOMER PO NO (only if genuine data exists)
  // 5. DISPATCH THROUGH (only if genuine data exists)
  const metadataRows = [
    {
      key: 'INVOICE NO.',
      val: invoiceNumber,
      date: invoiceDate,
      dateVal: invoiceDate,
      dateLabel: 'DATE',
      always: true
    },
    dcNumber && {
      key: 'DC NO.',
      val: dcNumber,
      date: dcDate || '',
      dateVal: dcDate || '',
      dateLabel: dcDate ? 'DATE' : ''
    },
    quotationNumber && {
      key: 'Q.NO.',
      val: quotationNumber,
      date: quotationDate || '',
      dateVal: quotationDate || '',
      dateLabel: quotationDate ? 'DATE' : ''
    },
    customerPoNumber && {
      key: 'CUSTOMER PO NO.',
      val: customerPoNumber,
      date: customerPoDate || '',
      dateVal: customerPoDate || '',
      dateLabel: customerPoDate ? 'DATE' : ''
    },
    salesOrderNumber && {
      key: 'SO',
      val: salesOrderNumber,
      date: salesOrderDate || '',
      dateVal: salesOrderDate || '',
      dateLabel: salesOrderDate ? 'DATE' : ''
    },
    dispatchThrough && {
      key: 'DISPATCH THROUGH',
      val: dispatchThrough,
      date: dispatchDate || '',
      dateVal: dispatchDate || '',
      dateLabel: dispatchDate ? 'DATE' : ''
    }
  ].filter(Boolean);

  const bankDetails = invoiceData.bankDetails || comp.bankDetails;
  const invoiceNote = invoiceData.remarks || comp.invoiceNote;
  const seal = comp.sealUrl || null;
  const signature = comp.signatureUrl || null;

  return {
    invoiceNumber,
    invoiceDate,
    dcNumber,
    dcDate,
    quotationNumber,
    quotationDate,
    customerPoNumber,
    customerPoDate,
    dispatchThrough,
    dispatchDate,
    customerSnapshot,
    billingSnapshot,
    shippingSnapshot,
    items,
    showDiscount,
    totalQty,
    grossSubtotal,
    subtotal,
    taxableSubtotal,
    discount,
    taxableValue,
    cgst,
    sgst,
    igst,
    taxTotal,
    roundOff,
    grandTotal,
    amountInWords: amountInWords(grandTotal),
    taxAmountInWords: amountInWords(taxTotal, 'INR'),
    bankDetails,
    invoiceNote,
    seal,
    signature,
    comp,
    isInterState,
    taxSummary,
    metadataRows,
    paymentTerms: invoiceData.paymentTerms || null,
    dueDate: invoiceData.dueDate ? formatDocDate(invoiceData.dueDate) : null,

    // Backward-compatibility aliases
    invoiceId: invoiceNumber,
    consignee: billingSnapshot,
    shipping: shippingSnapshot,
    amountWords: amountInWords(grandTotal),
    taxWords: amountInWords(taxTotal, 'INR')
  };
}

export const createInvoiceViewModel = normalizeInvoiceDocument;

/**
 * Background Watermark Logo (strictly for Invoice alone)
 * Accurately implements company logo watermark matching the physical printed invoice copy.
 */
function InvoiceWatermark({ comp }) {
  const [imgFailed, setImgFailed] = useState(false);
  const watermarkUrl = comp?.watermarkLogoUrl || ASI_WATERMARK_LOGO || comp?.logoUrl || DEFAULT_ASI_LOGO;

  return (
    <div className="doc-inv-watermark-overlay">
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
 * 1. Company Information Block (Top Left)
 * Strict 3-line address format with 'Chennai - 600095' on its own line.
 * Strictly one official phone, no multiple phones, no ISO in header.
 */
function CompanyBlock({ comp }) {
  const [imgFailed, setImgFailed] = useState(false);
  const logoUrl = comp.logoUrl || DEFAULT_ASI_LOGO;
  const logoDim = 110;

  const cleanStreet = (comp.street || 'Plot No. 10A, Perumal Kovil Street').replace(/,\s*$/, '').trim();
  const cleanStreet2 = (comp.street2 || 'Sivabootham, Vanagaram').replace(/,\s*Tamil\s*Nadu\s*,?\s*$/i, '').replace(/,\s*$/, '').trim();
  const cityPin = comp.city ? `${comp.city} - ${comp.pincode || comp.zipCode || '600095'}` : 'Chennai - 600095';

  let cleanPhone = (comp.phone || '9171126666').toString();
  if (cleanPhone.includes('/') || cleanPhone.includes(',') || cleanPhone.includes('09994126666')) {
    cleanPhone = '9171126666';
  } else {
    cleanPhone = cleanPhone.trim();
  }
  const cleanGstin = comp.gstin || '33AZPPS7068A1Z4';

  return (
    <div className="doc-inv-company-pane dc-company-pane">
      <div
        className="doc-inv-logo-wrap dc-doc-logo-wrap"
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
            alt={comp.name || 'Active System Integration'}
            className="doc-inv-logo-img dc-doc-company-logo"
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
      <div className="dc-doc-company-details doc-inv-company-details">
        <div className="dc-doc-company-name doc-inv-company-name">{comp.name || 'Active System Integration'}</div>
        <div className="dc-company-address doc-inv-company-address">
          <div className="dc-address-line">{cleanStreet}</div>
          <div className="dc-address-line">{cleanStreet2}</div>
          <div className="dc-city-pin">{cityPin}</div>
        </div>
        <div className="dc-company-phone">Phone: {cleanPhone}</div>
        <div className="dc-company-gstin">GSTIN : {cleanGstin}</div>
      </div>
    </div>
  );
}

/**
 * 2. Document Reference / Metadata Table (Top Right)
 * Balanced 2-column grid:
 * Column 1: Reference (Invoice No. / SO / Dispatch Through) absorbs remaining width and wraps long text
 * Column 2: Date has guaranteed fixed width so date is never clipped or submerged
 */
function InvoiceMetadataTable({ rows }) {
  return (
    <div className="doc-inv-meta-pane">
      <table className="doc-inv-meta-table">
        <colgroup>
          <col className="doc-meta-col-info" style={{ width: '60%' }} />
          <col className="doc-meta-col-date" style={{ width: '40%' }} />
        </colgroup>
        <tbody>
          {rows.map((row, idx) => {
            if (row.isFullSpan) {
              return (
                <tr key={idx}>
                  <td colSpan="2" className="doc-inv-meta-cell-full">
                    <span className="doc-inv-meta-key">{row.key}: </span>
                    <span className="doc-inv-meta-val bold">{row.val}</span>
                  </td>
                </tr>
              );
            }
            return (
              <tr key={idx}>
                <td className="doc-inv-meta-cell-info">
                  <span className="doc-inv-meta-key">{row.key}: </span>
                  <span className="doc-inv-meta-val bold">{row.val}</span>
                </td>
                <td className="doc-inv-meta-cell-date">
                  {(row.dateVal || row.date) ? (
                    <div className="doc-inv-meta-date-wrap">
                      <span className="doc-inv-meta-date-label">{(row.dateLabel || 'DATE')}: </span>
                      <span className="doc-inv-meta-date-val">{row.dateVal || row.date}</span>
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 3. Consignee (Bill To) & Shipping Address (Ship To) Box
 * 50% / 50% equal width, equal top alignment, State always visible.
 */
function BillingShippingSection({ consignee, shipping }) {
  const cLines = consignee.addressLines && consignee.addressLines.length > 0
    ? consignee.addressLines
    : formatPartyAddressLines(consignee);
  const sLines = shipping.addressLines && shipping.addressLines.length > 0
    ? shipping.addressLines
    : formatPartyAddressLines(shipping);

  return (
    <div className="doc-inv-parties-box">
      <div className="doc-inv-party-pane doc-inv-party-billing border-right">
        <div className="doc-inv-party-label">Consignee (Bill To) :</div>
        <div className="doc-inv-party-name">{consignee.name}</div>
        {consignee.company && consignee.company !== consignee.name && (
          <div className="doc-inv-party-line font-semibold doc-party-company">{consignee.company}</div>
        )}
        {cLines.map((line, idx) => {
          const isVanagaramLine = line.toLowerCase().includes('vanagaram');
          return (
            <div
              key={idx}
              className={`doc-inv-party-line ${isVanagaramLine ? 'doc-party-nowrap-line' : ''}`}
              style={isVanagaramLine ? { whiteSpace: 'nowrap' } : undefined}
            >
              {line}
            </div>
          );
        })}
        {consignee.phone && (
          <div className="doc-inv-party-line">Phone : {consignee.phone}</div>
        )}
        <div className="doc-inv-party-gstin">
          GSTIN/UIN : <strong>{consignee.gstin || 'UNREGISTERED'}</strong>
        </div>
      </div>

      <div className="doc-inv-party-pane doc-inv-party-shipping">
        <div className="doc-inv-party-label">Shipping Address (Ship To) :</div>
        <div className="doc-inv-party-name">{shipping.name}</div>
        {shipping.company && shipping.company !== shipping.name && (
          <div className="doc-inv-party-line font-semibold doc-party-company">{shipping.company}</div>
        )}
        {sLines.map((line, idx) => {
          const isVanagaramLine = line.toLowerCase().includes('vanagaram');
          return (
            <div
              key={idx}
              className={`doc-inv-party-line ${isVanagaramLine ? 'doc-party-nowrap-line' : ''}`}
              style={isVanagaramLine ? { whiteSpace: 'nowrap' } : undefined}
            >
              {line}
            </div>
          );
        })}
        {shipping.phone && (
          <div className="doc-inv-party-line">Phone : {shipping.phone}</div>
        )}
        <div className="doc-inv-party-gstin">
          GSTIN/UIN : <strong>{shipping.gstin || 'UNREGISTERED'}</strong>
        </div>
      </div>
    </div>
  );
}

/**
 * 4. Main Line Items Table (100% Usable Width, Fixed Geometry)
 * Totals strictly: NET AMOUNT, TAX AMOUNT, TOTAL INVOICE.
 */
function InvoiceItemsTable({
  items,
  totalQty,
  showDiscount = false,
  grossSubtotal,
  taxableSubtotal,
  subtotal,
  discount,
  taxTotal,
  roundOff,
  grandTotal,
  showTotals = true
}) {
  return (
    <div className="doc-inv-table-wrapper">
      <table className="doc-inv-table">
        <colgroup>
          <col style={{ width: showDiscount ? '6.5%' : '7.5%' }} />
          <col style={{ width: showDiscount ? '30%' : '36%' }} />
          <col style={{ width: showDiscount ? '10%' : '11.5%' }} />
          <col style={{ width: showDiscount ? '7%' : '7.5%' }} />
          <col style={{ width: showDiscount ? '11%' : '12%' }} />
          {showDiscount && <col style={{ width: '11%' }} />}
          <col style={{ width: showDiscount ? '11%' : '12.5%' }} />
          <col style={{ width: showDiscount ? '13.5%' : '13%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className="doc-th-sl" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>SL.No</th>
            <th className="doc-th-desc" style={{ textAlign: 'left', paddingLeft: '8px' }}>DESCRIPTION</th>
            <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>HSN/SAC</th>
            <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>QTY</th>
            <th style={{ textAlign: 'right', whiteSpace: 'nowrap', paddingRight: '6px' }}>RATE</th>
            {showDiscount && (
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap', paddingRight: '6px' }}>DISCOUNT</th>
            )}
            <th style={{ textAlign: 'right', whiteSpace: 'nowrap', paddingRight: '6px' }}>TAX</th>
            <th style={{ textAlign: 'right', whiteSpace: 'nowrap', paddingRight: '6px' }}>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.sl}>
              <td style={{ textAlign: 'center', fontWeight: 600 }}>{it.sl}</td>
              <td style={{ textAlign: 'left' }}>
                <div className="doc-inv-item-name">{it.name}</div>
                {it.description && (
                  <div className="doc-inv-item-desc">{it.description}</div>
                )}
                {it.isSerialized && Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0 && (
                  <div
                    className="doc-inv-item-serials"
                    style={{
                      marginTop: '3px',
                      fontSize: '11.5px',
                      color: '#0f172a',
                      fontWeight: 500,
                      wordBreak: 'break-word',
                      whiteSpace: 'normal',
                      lineHeight: '1.35'
                    }}
                  >
                    {it.serialNumbers.join(', ')}
                  </div>
                )}
              </td>
              <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{it.hsnSac}</td>
              <td style={{ textAlign: 'center', fontWeight: 700 }}>{it.quantity}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatPlainNumber(it.rate)}</td>
              {showDiscount && (
                <td style={{ textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                  {(it.discountAmount > 0 || it.discountPct > 0) ? (
                    <>
                      <div>₹ {formatPlainNumber(it.discountAmount)}</div>
                      <div style={{ fontSize: '11px', color: '#475569', fontWeight: 500 }}>
                        ({it.discountPct || 0}%)
                      </div>
                    </>
                  ) : (
                    <span>—</span>
                  )}
                </td>
              )}
              <td style={{ textAlign: 'right', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                <div>{formatPlainNumber(it.tax)}</div>
                <div style={{ fontSize: '11px', color: '#475569', fontWeight: 500 }}>(GST {it.gstPct}%)</div>
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, whiteSpace: 'nowrap' }}>
                {formatPlainNumber(it.amount)}
              </td>
            </tr>
          ))}

          {/* Totals Section */}
          {showTotals && (
            <>
              {showDiscount ? (
                <>
                  <tr className="doc-inv-summary-row">
                    <td colSpan="6" className="doc-inv-summary-label">GROSS AMOUNT</td>
                    <td colSpan="2" className="doc-inv-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      ₹ {formatPlainNumber(grossSubtotal !== undefined ? grossSubtotal : subtotal)}
                    </td>
                  </tr>
                  <tr className="doc-inv-summary-row">
                    <td colSpan="6" className="doc-inv-summary-label">DISCOUNT</td>
                    <td colSpan="2" className="doc-inv-summary-val" style={{ fontFamily: 'monospace', color: '#16a34a', whiteSpace: 'nowrap' }}>
                      -₹ {formatPlainNumber(discount)}
                    </td>
                  </tr>
                  <tr className="doc-inv-summary-row">
                    <td colSpan="6" className="doc-inv-summary-label">TAXABLE AMOUNT</td>
                    <td colSpan="2" className="doc-inv-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      ₹ {formatPlainNumber(taxableSubtotal !== undefined ? taxableSubtotal : subtotal)}
                    </td>
                  </tr>
                  <tr className="doc-inv-summary-row">
                    <td colSpan="6" className="doc-inv-summary-label">TAX AMOUNT</td>
                    <td colSpan="2" className="doc-inv-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      ₹ {formatPlainNumber(taxTotal)}
                    </td>
                  </tr>
                </>
              ) : (
                <>
                  <tr className="doc-inv-summary-row">
                    <td colSpan="5" className="doc-inv-summary-label">NET AMOUNT</td>
                    <td colSpan="2" className="doc-inv-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      ₹ {formatPlainNumber(subtotal)}
                    </td>
                  </tr>
                  <tr className="doc-inv-summary-row">
                    <td colSpan="5" className="doc-inv-summary-label">TAX AMOUNT</td>
                    <td colSpan="2" className="doc-inv-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      ₹ {formatPlainNumber(taxTotal)}
                    </td>
                  </tr>
                </>
              )}

              {roundOff !== 0 && (
                <tr className="doc-inv-summary-row">
                  <td colSpan={showDiscount ? "6" : "5"} className="doc-inv-summary-label">ROUND OFF</td>
                  <td colSpan="2" className="doc-inv-summary-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    ₹ {formatPlainNumber(roundOff)}
                  </td>
                </tr>
              )}

              <tr className="doc-inv-total-row">
                <td colSpan="3" className="doc-inv-total-label">TOTAL INVOICE</td>
                <td style={{ textAlign: 'center', fontWeight: 800 }}>{totalQty}</td>
                <td colSpan={showDiscount ? "2" : "1"}></td>
                <td colSpan="2" className="doc-inv-total-val" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
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
function AmountInWords({ words }) {
  return (
    <div className="doc-inv-words-box">
      <div className="doc-inv-words-title">Amount chargeable (in words)</div>
      <div className="doc-inv-words-text">( {words} )</div>
    </div>
  );
}

/**
 * 6. Tax Summary Breakdown Table (Intra-state CGST+SGST or Inter-state IGST)
 */
function TaxSummary({ taxSummary, isInterState, subtotal, taxTotal, taxWords, cgst, sgst, igst }) {
  return (
    <div className="doc-inv-tax-box">
      <table className="doc-inv-tax-table">
        <thead>
          {isInterState ? (
            <>
              <tr>
                <th rowSpan="2" style={{ width: '18%' }}>HSN/SAC</th>
                <th rowSpan="2" style={{ width: '26%' }}>
                  TAXABLE<br />VALUE
                </th>
                <th colSpan="2" style={{ width: '34%' }}>INTEGRATED TAX</th>
                <th rowSpan="2" style={{ width: '22%' }}>TOTAL TAX</th>
              </tr>
              <tr>
                <th style={{ width: '14%' }}>RATE</th>
                <th style={{ width: '20%' }}>AMOUNT</th>
              </tr>
            </>
          ) : (
            <>
              <tr>
                <th rowSpan="2" style={{ width: '14%' }}>HSN/SAC</th>
                <th rowSpan="2" style={{ width: '18%' }}>
                  TAXABLE<br />VALUE
                </th>
                <th colSpan="2" style={{ width: '24%' }}>CENTRAL TAX</th>
                <th colSpan="2" style={{ width: '24%' }}>STATE TAX</th>
                <th rowSpan="2" style={{ width: '20%' }}>TOTAL TAX</th>
              </tr>
              <tr>
                <th style={{ width: '9%' }}>RATE</th>
                <th style={{ width: '15%' }}>AMOUNT</th>
                <th style={{ width: '9%' }}>RATE</th>
                <th style={{ width: '15%' }}>AMOUNT</th>
              </tr>
            </>
          )}
        </thead>
        <tbody>
          {taxSummary.map((row, idx) => (
            <tr key={row.hsnSac || idx}>
              <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{row.hsnSac}</td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatPlainNumber(row.taxableValue)}</td>
              {isInterState ? (
                <>
                  <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{row.integratedRate}%</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatPlainNumber(row.integratedAmount)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{formatPlainNumber(row.totalTax)}</td>
                </>
              ) : (
                <>
                  <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{row.centralRate}%</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatPlainNumber(row.centralAmount)}</td>
                  <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>{row.stateRate}%</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatPlainNumber(row.stateAmount)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{formatPlainNumber(row.totalTax)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ textAlign: 'center', fontWeight: 700 }}>Total</td>
            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{formatPlainNumber(subtotal)}</td>
            {isInterState ? (
              <>
                <td></td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{formatPlainNumber(igst || taxTotal)}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>{formatPlainNumber(taxTotal)}</td>
              </>
            ) : (
              <>
                <td></td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                  {formatPlainNumber(cgst !== undefined ? cgst : taxSummary.reduce((sum, r) => sum + r.centralAmount, 0))}
                </td>
                <td></td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                  {formatPlainNumber(sgst !== undefined ? sgst : taxSummary.reduce((sum, r) => sum + r.stateAmount, 0))}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                  {formatPlainNumber(taxTotal)}
                </td>
              </>
            )}
          </tr>
        </tfoot>
      </table>
      <div className="doc-inv-tax-words-strip">
        Tax Amount (in words): <strong>{taxWords} ({formatPlainNumber(taxTotal)})</strong>
      </div>
    </div>
  );
}

/**
 * 7. Bottom Section: Invoice Note, Bank Details & Authorized Signatory
 */
function BottomSection({ comp, bankDetails, paymentTerms, dueDate, showSignature = true }) {
  const bank = bankDetails || comp.bankDetails || {};
  const hasBranch = Boolean(bank.branch || comp.branch);
  return (
    <div className="doc-inv-bottom-box">
      <div className="doc-inv-bottom-left">
        <div className="doc-inv-bank-pane">
          <div className="doc-inv-bank-title" style={{ marginBottom: '3px' }}>Bank Details:</div>
          <div className="doc-inv-bank-inline-wrap">
            <span>Acc. Name: <strong>{bank.accountName || comp.accountName || comp.name}</strong>,</span>
            <span>Bank: <strong>{bank.bankName || comp.bankName}</strong>,</span>
            <span>Acc. Number: <strong style={{ fontFamily: 'monospace' }}>{bank.accountNumber || bank.accountNo || comp.accountNumber}</strong>,</span>
            <span>IFSC Code: <strong style={{ fontFamily: 'monospace' }}>{bank.ifscCode || bank.ifsc || comp.ifscCode}</strong>{hasBranch ? ',' : ''}</span>
            {hasBranch && (
              <span>Branch: <strong>{bank.branch || comp.branch}</strong></span>
            )}
          </div>
          {paymentTerms && (
            <div className="doc-inv-bank-terms" style={{ marginTop: '4px', fontSize: '11.5px', color: '#334155' }}>
              Payment Terms: <strong>{paymentTerms}</strong>
              {dueDate && <span> (Due: {dueDate})</span>}
            </div>
          )}
        </div>
      </div>

      <div className="doc-inv-bottom-right">
        <div className="doc-inv-for-company">For {comp.name || comp.companyName || 'Active System Integration'}</div>
        <div className="doc-inv-sig-space" style={{ minHeight: '52px' }}>
          {showSignature ? (
            comp.signatureUrl ? (
              <img src={comp.signatureUrl} alt="Authorized Signatory" className="doc-inv-sig-img" />
            ) : comp.sealUrl ? (
              <img src={comp.sealUrl} alt="Official Seal" className="doc-inv-sig-img" />
            ) : (
              <AsiOfficialSeal width={96} height={96} />
            )
          ) : null}
        </div>
        <div className="doc-inv-authorized-label">Authorized Signatory</div>
      </div>
    </div>
  );
}

/**
 * Accurate height estimator for Invoice line items
 */
export function estimateInvoiceItemHeight(it) {
  let h = 34; // base row with 1 line title
  const name = String(it.name || it.productName || '').trim();
  if (name.length > 36) {
    h += Math.max(1, Math.ceil(name.length / 36) - 1) * 14;
  }
  const desc = (it.description || it.productDetails || '').trim();
  if (desc) {
    h += Math.max(1, Math.ceil(desc.length / 45)) * 14;
  }
  if (it.isSerialized && Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0) {
    const serialStr = it.serialNumbers.join(', ');
    h += Math.max(1, Math.ceil(serialStr.length / 45)) * 14 + 6;
  }
  return h;
}

/**
 * Height estimator for invoice bottom section (Totals, Words, Tax Table, Bank Details, Signatory)
 */
export function estimateInvoiceBottomHeight(vm) {
  let h = 0;
  h += vm.showDiscount ? 135 : 90; // Totals rows
  h += 34; // Amount in Words
  const taxCount = (vm.taxSummary || []).length || 1;
  h += 30 + taxCount * 22 + 25; // Tax summary table
  if (vm.taxAmountInWords) {
    h += 22;
  }
  h += 135; // Bank Details & Signatory
  h += 40; // Margins & section gaps
  return h;
}

/**
 * Data-Driven Multi-Page Pagination for Invoice
 */
export function paginateInvoice(vm) {
  const items = vm.items || [];
  const PAGE_CAPACITY_PX = 955; // Safe A4 printable height in px
  const PAGE1_TOP_HEIGHT = 380; // Title (30) + Header box (190) + Parties (125) + thead (35)
  const CONTINUATION_TOP_HEIGHT = 45; // thead (35) + margin (10)
  const totalBottomHeight = estimateInvoiceBottomHeight(vm);

  const itemHeights = items.map(estimateInvoiceItemHeight);
  const totalItemsHeight = itemHeights.reduce((sum, h) => sum + h, 0);

  // If ALL items + bottom section fit on Page 1:
  if (PAGE1_TOP_HEIGHT + totalItemsHeight + totalBottomHeight <= PAGE_CAPACITY_PX) {
    return [{
      pageNumber: 1,
      isPage1: true,
      isLastPage: true,
      items,
      showTotals: true,
      showBottomSection: true
    }];
  }

  // Multi-page continuation
  const pages = [];
  let currentItemIdx = 0;
  let pageNum = 1;

  while (currentItemIdx < items.length) {
    const isPage1 = pageNum === 1;
    const topHeight = isPage1 ? PAGE1_TOP_HEIGHT : CONTINUATION_TOP_HEIGHT;
    const availableForItems = PAGE_CAPACITY_PX - topHeight;

    const pageItems = [];
    let currentHeight = 0;

    while (currentItemIdx < items.length) {
      const it = items[currentItemIdx];
      const h = itemHeights[currentItemIdx];

      // Check if all remaining items + bottom section fit on this page
      const remainingItems = items.slice(currentItemIdx);
      const remainingHeight = remainingItems.reduce((sum, _, idx) => sum + itemHeights[currentItemIdx + idx], 0);

      if (currentHeight + remainingHeight + totalBottomHeight <= availableForItems) {
        while (currentItemIdx < items.length) {
          pageItems.push(items[currentItemIdx]);
          currentItemIdx++;
        }
        break;
      }

      // Check if this item alone fits
      if (currentHeight + h <= availableForItems) {
        pageItems.push(it);
        currentHeight += h;
        currentItemIdx++;
      } else {
        if (pageItems.length === 0) {
          pageItems.push(it);
          currentItemIdx++;
        }
        break;
      }
    }

    const isAllConsumed = currentItemIdx >= items.length;
    const canFitBottom = isAllConsumed && (currentHeight + totalBottomHeight <= availableForItems);

    pages.push({
      pageNumber: pageNum,
      isPage1,
      isLastPage: false,
      items: pageItems,
      showTotals: canFitBottom,
      showBottomSection: canFitBottom
    });

    pageNum++;
  }

  // If the last page finished items but could NOT fit the bottom section,
  // create a final continuation page for the bottom section
  const lastPage = pages[pages.length - 1];
  if (!lastPage.showBottomSection) {
    let movedItems = [];
    if (lastPage.items.length >= 2) {
      movedItems = lastPage.items.splice(-1);
    }
    pages.push({
      pageNumber: pageNum,
      isPage1: false,
      isLastPage: true,
      items: movedItems,
      showTotals: true,
      showBottomSection: true
    });
  }

  pages[pages.length - 1].isLastPage = true;
  return pages;
}

/**
 * Main Master Printable Sales Invoice Component
 * Supports Browser Preview, Browser Print, and Download PDF (Signed & Unsigned)
 */
export default function PrintableSalesInvoice({ data, companySettings, showSignature = true }) {
  if (!data) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        <p style={{ fontSize: '16px', fontWeight: 600 }}>Invoice not found.</p>
        <p style={{ fontSize: '13px' }}>Please select a valid invoice record to preview or print.</p>
      </div>
    );
  }

  const liveConfig = useCompanyConfig();
  const effectiveSettings = companySettings || liveConfig;

  const vm = useMemo(
    () => normalizeInvoiceDocument(data, effectiveSettings),
    [data, effectiveSettings]
  );

  const pages = useMemo(() => {
    return paginateInvoice(vm);
  }, [vm]);

  const totalPages = pages.length;

  return (
    <div
      className="doc-sheet-root doc-paged-root printable-sales-invoice"
      id={`inv-sheet-${vm.invoiceNumber}`}
      data-invoice-id={vm.invoiceNumber}
    >
      {pages.map((page, pIdx) => (
        <React.Fragment key={`inv-page-${page.pageNumber}`}>
          {/* Viewer-only visual gap separator (Never printed, never downloaded into PDF) */}
          {pIdx > 0 && (
            <div className="doc-viewer-page-gap" aria-hidden="true">
              <div className="doc-viewer-gap-line" />
              <span className="doc-viewer-gap-badge">
                PAGE {page.pageNumber} OF {totalPages}
              </span>
              <div className="doc-viewer-gap-line" />
            </div>
          )}

          <div
            className={`doc-paged-page ${page.pageNumber < totalPages ? 'doc-page-break' : ''}`}
            data-page-num={page.pageNumber}
          >
            {/* Background Watermark Logo (subtle on all pages) */}
            <InvoiceWatermark comp={vm.comp} />

            <div className="doc-paged-page-body">
              {page.isPage1 ? (
                <>
                  {/* 1. Top Document Title: strictly 'INVOICE' */}
                  <h1 className="doc-inv-top-title">INVOICE</h1>

                  {/* 2. Top Header Box: Left Company Info | Right Metadata Table */}
                  <div className="doc-inv-header-box">
                    <CompanyBlock comp={vm.comp} />
                    <InvoiceMetadataTable rows={vm.metadataRows} />
                  </div>

                  {/* 3. Parties Box: Consignee (Bill To) | Shipping Address (Ship To) */}
                  <BillingShippingSection consignee={vm.billingSnapshot} shipping={vm.shippingSnapshot} />
                </>
              ) : null}

              {/* 4. Main Line Items Table (Repeats <thead> with column headers on every page!) */}
              <InvoiceItemsTable
                items={page.items}
                totalQty={vm.totalQty}
                showDiscount={vm.showDiscount}
                grossSubtotal={vm.grossSubtotal}
                taxableSubtotal={vm.taxableSubtotal}
                subtotal={vm.subtotal}
                discount={vm.discount}
                taxTotal={vm.taxTotal}
                roundOff={vm.roundOff}
                grandTotal={vm.grandTotal}
                showTotals={page.showTotals}
              />

              {/* Bottom Section (Amount in words, Tax breakdown, Bank details & Signatory) */}
              {page.showBottomSection && (
                <>
                  {/* 5. Amount Chargeable in Words */}
                  <AmountInWords words={vm.amountInWords} />

                  {/* 6. Tax Breakdown Summary Table */}
                  <TaxSummary
                    taxSummary={vm.taxSummary}
                    isInterState={vm.isInterState}
                    subtotal={vm.subtotal}
                    taxTotal={vm.taxTotal}
                    taxWords={vm.taxAmountInWords}
                    cgst={vm.cgst}
                    sgst={vm.sgst}
                    igst={vm.igst}
                  />

                  {/* 7. Bottom Section: Bank Details & Authorized Signatory */}
                  <BottomSection
                    comp={vm.comp}
                    bankDetails={vm.bankDetails}
                    paymentTerms={vm.paymentTerms}
                    dueDate={vm.dueDate}
                    showSignature={showSignature}
                  />
                </>
              )}
            </div>

            {/* 8. Unified Computer Generated Notice & Page Number Footer */}
            <div className="doc-inv-computer-notice doc-unified-footer-bar">
              <span className="doc-footer-spacer" />
              <span className="doc-footer-center-text">
                This is a Computer Generated Invoice
              </span>
              <span className="doc-footer-page-num">
                {totalPages > 1 ? `Page ${page.pageNumber} of ${totalPages}` : 'Page 1'}
              </span>
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
