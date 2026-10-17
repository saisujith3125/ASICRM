import React, { useMemo, useState } from 'react';
import { COMPANY_CONFIG, getMergedCompanySettings, AsiLogo, AsiOfficialSeal, useCompanyConfig, DEFAULT_ASI_LOGO, DocumentWatermark } from './companyConfig';
import { formatPlainNumber, formatDocDate, amountInWords, normalizePartyLines, formatPartyAddressLines } from './documentFormatters';
import './documentStyles.css';

/**
 * Normalizes and creates an authoritative Proforma Invoice Document View Model.
 * Single Source of Truth for Preview, Print, and PDF.
 *
 * @param {Object} proformaData - Stored Proforma data (snapshot)
 * @param {Object} customSettings - Optional company settings override
 * @returns {Object} Normalized Proforma View Model
 */
export function normalizeProformaDocument(proformaData = {}, customSettings = {}) {
  const comp = getMergedCompanySettings(customSettings || proformaData.companyDetails || {});

  const proformaId = proformaData.proformaId || proformaData.id || 'PI-PENDING';
  const revisionNumber = proformaData.revisionNumber || 1;
  const revisionId = proformaData.revisionId || `${proformaId}-R${revisionNumber}`;
  const proformaDate = formatDocDate(proformaData.proformaDate || proformaData.createdAt);
  const rawValidUntil = proformaData.validUntil || null;
  const validUntil = rawValidUntil ? formatDocDate(rawValidUntil) : null;

  // Upstream Document References (only genuine references)
  const cleanRef = (val) => {
    if (!val) return null;
    const str = String(val).trim();
    if (!str || str === '-' || str === '—' || ['NA', 'N/A', 'NONE', 'NULL', 'UNDEFINED'].includes(str.toUpperCase())) {
      return null;
    }
    return str;
  };

  let customerPoNo = cleanRef(proformaData.customerPoNumber || proformaData.poNumber);
  if (
    customerPoNo &&
    (customerPoNo === proformaId ||
     customerPoNo === proformaData.proformaId ||
     customerPoNo === proformaData.id ||
     customerPoNo === proformaData.orderId ||
     customerPoNo === proformaData.salesOrderId ||
     String(customerPoNo).toUpperCase().startsWith('INV-') ||
     String(customerPoNo).toUpperCase().startsWith('ORD-') ||
     String(customerPoNo).toUpperCase().startsWith('PI-'))
  ) {
    customerPoNo = null;
  }
  const customerPoDate = customerPoNo
    ? formatDocDate(proformaData.customerPoDate || proformaData.poDate || null)
    : null;

  const quotationNo = cleanRef(proformaData.quotationId || proformaData.quotationNumber);
  const quotationDate = quotationNo
    ? formatDocDate(proformaData.quotationDate || null)
    : null;

  const orderNo = cleanRef(proformaData.orderId || proformaData.salesOrderId);
  const orderDate = orderNo
    ? formatDocDate(proformaData.orderDate || null)
    : null;

  const dcNo = cleanRef(proformaData.dcNo || proformaData.challanId || proformaData.dcNumber || proformaData.deliveryChallanNo);
  const dcDate = dcNo
    ? formatDocDate(proformaData.challanDate || proformaData.dcDate || null)
    : null;
  const cleanDispatch = (val) => {
    const cleaned = cleanRef(val);
    if (!cleaned) return null;
    // Deduplicate patterns like "Road Express - Road Express" -> "Road Express"
    const parts = cleaned.split(/\s*-\s*/);
    if (parts.length === 2 && parts[0].trim().toLowerCase() === parts[1].trim().toLowerCase()) {
      return parts[0].trim();
    }
    return cleaned;
  };

  const dispatchThrough = cleanDispatch(proformaData.dispatchThrough);
  const dispatchDate = dispatchThrough && cleanRef(proformaData.dispatchDate)
    ? formatDocDate(proformaData.dispatchDate)
    : null;

  // Items normalization with rate and discount preservation
  const rawItems = Array.isArray(proformaData.items) ? proformaData.items : [];
  const items = rawItems.map((item, idx) => {
    const qty = Math.max(1, Number(item.quantity !== undefined ? item.quantity : 1));
    const unit = (item.unit && item.unit !== 'Piece') ? item.unit : 'Nos';
    const rate = Number(
      item.unitPrice !== undefined && item.unitPrice !== null && item.unitPrice !== ''
        ? item.unitPrice
        : (item.rate !== undefined && item.rate !== null && item.rate !== ''
            ? item.rate
            : (item.price !== undefined && item.price !== null && item.price !== '' ? item.price : 0))
    );
    const discountPct = Math.max(0, Math.min(100, Number(item.discount !== undefined ? item.discount : (item.discountPct || 0))));
    const rawSubtotal = qty * rate;
    const discountAmount = Number(
      item.discountAmount !== undefined && item.discountAmount !== null
        ? item.discountAmount
        : Math.round((rawSubtotal * (discountPct / 100)) * 100) / 100
    );
    const lineSubtotal = Number(
      item.lineSubtotal !== undefined && item.lineSubtotal !== null
        ? item.lineSubtotal
        : (item.taxableValue !== undefined
            ? item.taxableValue
            : (item.taxableSubtotal !== undefined
                ? item.taxableSubtotal
                : Math.round((rawSubtotal - discountAmount) * 100) / 100))
    );
    const gstPct = Number(item.gst !== undefined ? item.gst : (item.gstPct !== undefined ? item.gstPct : 18));
    const lineTax = Number(
      item.lineTax !== undefined && item.lineTax !== null
        ? item.lineTax
        : (item.tax !== undefined
            ? item.tax
            : Math.round(((lineSubtotal * gstPct) / 100) * 100) / 100)
    );
    const lineTotal = Number(
      item.lineTotal !== undefined && item.lineTotal !== null
        ? item.lineTotal
        : (item.amount !== undefined
            ? item.amount
            : Math.round((lineSubtotal + lineTax) * 100) / 100)
    );

    const isSerialized = Boolean(
      item.isSerialized ||
      (Array.isArray(item.serialNumbers) && item.serialNumbers.length > 0)
    );
    const serialNumbers = Array.isArray(item.serialNumbers) ? item.serialNumbers : [];

    return {
      sl: item.sl || (idx + 1),
      name: item.productName || item.name || 'Product / Service Item',
      sku: item.productCode || item.sku || '',
      description: item.productDetails || item.description || '',
      hsnSac: item.hsnSac || '85258090',
      quantity: qty,
      unit,
      rate,
      discountPct,
      discountAmount,
      taxableValue: lineSubtotal,
      taxableSubtotal: lineSubtotal,
      gstPct,
      tax: lineTax,
      amount: lineSubtotal, // In Proforma estimation table, AMOUNT = PRE-TAX base amount matching physical sample
      isSerialized,
      serialNumbers
    };
  });

  const totalQty = items.reduce((sum, it) => sum + it.quantity, 0);

  const showDiscount = proformaData.showDiscount !== undefined
    ? Boolean(proformaData.showDiscount)
    : Boolean(
        Number(proformaData.totalDiscount || proformaData.discountTotal || proformaData.discount || 0) > 0 ||
        items.some((it) => it.discountPct > 0 || it.discountAmount > 0)
      );

  const grossSubtotal = items.length > 0
    ? Math.round(items.reduce((sum, it) => sum + (it.quantity * it.rate), 0) * 100) / 100
    : Number(proformaData.grossSubtotal || proformaData.subtotal || 0);

  const calculatedTaxTotal = items.length > 0
    ? Math.round(items.reduce((sum, it) => sum + it.tax, 0) * 100) / 100
    : Number(proformaData.gstTotal || proformaData.taxTotal || 0);

  const calculatedDiscount = Math.round(items.reduce((sum, it) => sum + it.discountAmount, 0) * 100) / 100;

  const totalDiscount = showDiscount
    ? (proformaData.totalDiscount !== undefined
        ? Number(proformaData.totalDiscount)
        : (proformaData.discountTotal !== undefined
            ? Number(proformaData.discountTotal)
            : (proformaData.discount !== undefined ? Number(proformaData.discount) : calculatedDiscount)))
    : 0;

  const taxableSubtotal = showDiscount
    ? (proformaData.taxableSubtotal !== undefined
        ? Number(proformaData.taxableSubtotal)
        : Math.round((grossSubtotal - totalDiscount) * 100) / 100)
    : grossSubtotal;

  // Authoritative financial calculation pipeline: Line items are single source of truth
  const subtotal = taxableSubtotal;
  const taxTotal = calculatedTaxTotal;
  const discount = totalDiscount;

  // Inter-State vs Intra-State determination using robust GSTIN and keywords engine
  const billStateLower = String(proformaData.consigneeState || proformaData.customerState || '').toLowerCase();
  const billAddrLower = String(proformaData.consigneeAddress || proformaData.customerAddress || '').toLowerCase();
  const shipAddrLower = String(proformaData.shippingAddress || '').toLowerCase();
  const gstinStr = String(proformaData.consigneeGstin || proformaData.shippingGstin || proformaData.customerGstin || '').trim().toUpperCase();

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
  const pinMatch = (proformaData.consigneePincode || billAddrLower || '').match(/\b(6[0-4][0-9]{4})\b/);
  const isTnPincode = Boolean(pinMatch);
  const isCustTn = gstinStr.startsWith('33') || hasTnKeyword || isTnPincode;

  const outsideStateCodes = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','34','35','36','37','38'];
  const hasOutsideGstin = gstinStr.length >= 2 && outsideStateCodes.includes(gstinStr.slice(0, 2)) && gstinStr.slice(0, 2) !== '33';
  const outsideKeywords = ['maharashtra', 'karnataka', 'delhi', 'kerala', 'andhra', 'telangana', 'gujarat', 'rajasthan', 'uttar pradesh', 'bengaluru', 'bangalore', 'mumbai', 'pune', 'hyderabad'];
  const hasOutsideKeyword = outsideKeywords.some(kw => billStateLower.includes(kw) || billAddrLower.includes(kw));

  let isInterState = false;
  if (proformaData.taxType === 'IGST' || proformaData.isInterState === true || proformaData.isInterstate === true) {
    isInterState = true;
  } else if (proformaData.taxType === 'CGST_SGST' || proformaData.taxType === 'INTRA_STATE' || proformaData.isInterState === false || proformaData.isInterstate === false) {
    isInterState = false;
  } else if (isCustTn) {
    isInterState = false;
  } else if (hasOutsideGstin || hasOutsideKeyword) {
    isInterState = true;
  } else {
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

  const grossTotal = Math.round((subtotal + taxTotal) * 100) / 100;
  let roundOff = 0;
  let grandTotal = grossTotal;

  if (proformaData.roundOff !== undefined && proformaData.roundOff !== null) {
    roundOff = Number(proformaData.roundOff);
    grandTotal = proformaData.grandTotal !== undefined && Number(proformaData.grandTotal) > 0
      ? Number(proformaData.grandTotal)
      : Math.round((grossTotal + roundOff) * 100) / 100;
  } else if (proformaData.roundOffEnabled && grossTotal > 0) {
    grandTotal = Math.floor(grossTotal + 1e-9) + 1;
    roundOff = Math.round((grandTotal - grossTotal) * 100) / 100;
  } else if (proformaData.grandTotal !== undefined && Number(proformaData.grandTotal) > 0) {
    grandTotal = Number(proformaData.grandTotal);
    roundOff = Math.round((grandTotal - grossTotal) * 100) / 100;
  }

  // Tax Breakdown grouped by HSN/SAC with explicit 2-decimal rounding
  const taxSummaryMap = {};
  items.forEach((it) => {
    const key = it.hsnSac || '85258090';
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

  // Consignee (Bill To)
  const rawConsigneePrimary = (
    proformaData.consigneeName ||
    proformaData.company ||
    proformaData.customerName ||
    'Customer Account'
  ).trim();

  const rawConsigneeSecondary = (proformaData.company || '').trim();
  const consigneeParty = normalizePartyLines(rawConsigneePrimary, rawConsigneeSecondary);
  const consigneeName = consigneeParty.primaryLine;
  const consigneeCompany = consigneeParty.secondaryLine || '';
  const consigneeAddress = proformaData.consigneeAddress || proformaData.customerAddress || comp.address;
  const consigneeCity = proformaData.consigneeCity || 'Chennai';
  const consigneeState = proformaData.consigneeState || 'Tamil Nadu';
  const consigneePincode = proformaData.consigneePincode || '';
  const consigneeGstin = proformaData.consigneeGstin || '';
  const consigneeAddressLines = formatPartyAddressLines({
    address: consigneeAddress,
    city: consigneeCity,
    state: consigneeState,
    pincode: consigneePincode
  });

  // Shipping (Ship To)
  const rawShippingPrimary = (
    proformaData.shippingName ||
    proformaData.contactPerson ||
    consigneeName
  ).trim();
  const rawShippingSecondary = (proformaData.shippingCompany || consigneeCompany || '').trim();
  const shippingParty = normalizePartyLines(rawShippingPrimary, rawShippingSecondary);
  const shippingName = shippingParty.primaryLine;
  const shippingCompany = shippingParty.secondaryLine || '';
  const shippingAddress = proformaData.shippingAddress || consigneeAddress;
  const shippingCity = proformaData.shippingCity || consigneeCity;
  const shippingState = proformaData.shippingState || consigneeState;
  const shippingPincode = proformaData.shippingPincode || consigneePincode;
  const shippingGstin = proformaData.shippingGstin || consigneeGstin;
  const shippingAddressLines = formatPartyAddressLines({
    address: shippingAddress,
    city: shippingCity,
    state: shippingState,
    pincode: shippingPincode
  });

  // Metadata Table Rows strictly matching printed ASI reference:
  // PI NO, DC NO, Q.NO, PO.NO, DISPATCH THROUGH, VALID UNTIL
  const metadataRows = [
    {
      key: 'PI NO.',
      val: proformaId,
      dateLabel: 'DATE',
      dateVal: proformaDate
    },
    dcNo && {
      key: 'DC NO.',
      val: dcNo,
      dateLabel: dcDate ? 'DATE' : '',
      dateVal: dcDate || ''
    },
    quotationNo && {
      key: 'Q. NO.',
      val: quotationNo,
      dateLabel: quotationDate ? 'DATE' : '',
      dateVal: quotationDate || ''
    },
    customerPoNo && {
      key: 'PO. NO.',
      val: customerPoNo,
      dateLabel: customerPoDate ? 'DATE' : '',
      dateVal: customerPoDate || ''
    },
    orderNo && {
      key: 'ORDER NO.',
      val: orderNo,
      dateLabel: orderDate ? 'DATE' : '',
      dateVal: orderDate || ''
    },
    dispatchThrough && {
      key: 'DISPATCH THROUGH',
      val: dispatchThrough,
      dateLabel: dispatchDate ? 'DATE' : '',
      dateVal: dispatchDate || '',
      isFullSpan: !dispatchDate
    }
  ].filter(Boolean);

  const bankDetails = proformaData.bankDetails || comp.bankDetails;
  const paymentTerms = proformaData.paymentTerms || comp.paymentTerms || '100% ADVANCE PAYMENT';
  const deliveryTerms = proformaData.deliveryTerms || comp.deliveryTerms || 'EX-STOCK / 1-2 WEEKS';
  const validityNotes = proformaData.validityNotes || comp.validityTerms || '15 DAYS FROM INVOICE DATE';
  const remarks = proformaData.remarks || '';

  return {
    proformaId,
    revisionNumber,
    revisionId,
    proformaDate,
    validUntil,
    status: proformaData.status || 'DRAFT',
    comp,
    consignee: {
      name: consigneeName,
      company: consigneeCompany,
      address: consigneeAddress,
      addressLines: consigneeAddressLines,
      city: consigneeCity,
      state: consigneeState,
      pincode: consigneePincode,
      gstin: consigneeGstin
    },
    shipping: {
      name: shippingName,
      company: shippingCompany,
      address: shippingAddress,
      addressLines: shippingAddressLines,
      city: shippingCity,
      state: shippingState,
      pincode: shippingPincode,
      gstin: shippingGstin
    },
    metadataRows,
    items,
    showDiscount,
    totalQty,
    grossSubtotal,
    subtotal,
    taxableSubtotal,
    discount,
    taxTotal,
    cgst,
    sgst,
    igst,
    roundOff,
    grandTotal,
    isInterState,
    taxSummary,
    amountWords: amountInWords(grandTotal),
    taxWords: amountInWords(taxTotal),
    bankDetails,
    paymentTerms,
    deliveryTerms,
    validityNotes,
    remarks
  };
}

export function createProformaViewModel(proformaData = {}, customSettings = {}) {
  return normalizeProformaDocument(proformaData, customSettings);
}

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
            className="doc-proforma-company-logo dc-doc-company-logo"
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
          <AsiLogo width={logoDim} height={logoDim} className="doc-proforma-company-logo" />
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

function ProformaMetadataTable({ rows }) {
  return (
    <div className="doc-inv-meta-pane">
      <table className="doc-inv-meta-table">
        <colgroup>
          <col style={{ width: '27%' }} className="doc-meta-col-label" />
          <col style={{ width: '39%' }} className="doc-meta-col-val" />
          <col style={{ width: '34%' }} className="doc-meta-col-date" />
        </colgroup>
        <tbody>
          {rows.map((row, idx) => {
            if (row.isFullSpan) {
              return (
                <tr key={idx}>
                  <td colSpan="3" className="doc-inv-meta-cell-full">
                    <span className="doc-inv-meta-key">{row.key} : </span>
                    <span className="doc-inv-meta-val bold">{row.val}</span>
                  </td>
                </tr>
              );
            }
            return (
              <tr key={idx}>
                <td className="doc-inv-meta-cell-label" style={{ width: '27%', whiteSpace: 'nowrap' }}>
                  <span className="doc-inv-meta-key">{row.key}</span>
                </td>
                <td className="doc-inv-meta-cell-val" style={{ width: '39%', whiteSpace: 'nowrap', overflow: 'visible' }}>
                  <span className="doc-inv-meta-val bold" style={{ whiteSpace: 'nowrap', display: 'inline-block' }}>{row.val}</span>
                </td>
                <td className="doc-inv-meta-cell-date" style={{ width: '34%', whiteSpace: 'nowrap' }}>
                  {(row.dateVal || row.date) ? (
                    <div className="doc-inv-meta-date-wrap" style={{ whiteSpace: 'nowrap' }}>
                      <span className="doc-inv-meta-date-label">{(row.dateLabel || 'DATE')}:</span>
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
 * Parties Section: Consignee (Bill To) | Shipping Address (Ship To)
 * Strictly matching printed ASI Proforma reference
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
      <div className="doc-inv-party-pane border-right">
        <div className="doc-inv-party-label" style={{ fontWeight: 700, color: '#334155' }}>Consignee:</div>
        <div className="doc-inv-party-name">{consignee.name}</div>
        {consignee.company && consignee.company !== consignee.name && (
          <div className="doc-inv-party-line font-semibold">{consignee.company}</div>
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
        <div className="doc-inv-party-gstin">
          GSTIN/UIN : <strong>{consignee.gstin || 'UNREGISTERED'}</strong>
        </div>
      </div>

      <div className="doc-inv-party-pane">
        <div className="doc-inv-party-label" style={{ fontWeight: 700, color: '#334155' }}>Shipping Address:</div>
        <div className="doc-inv-party-name">{shipping.name}</div>
        {shipping.company && shipping.company !== shipping.name && (
          <div className="doc-inv-party-line font-semibold">{shipping.company}</div>
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
        <div className="doc-inv-party-gstin">
          GSTIN/UIN : <strong>{shipping.gstin || 'UNREGISTERED'}</strong>
        </div>
      </div>
    </div>
  );
}

/**
 * 7-Column Main Line Items Table
 * Strictly matching printed ASI Proforma Invoice reference (media_1789824802058.png):
 * Columns: SI.NO, DESCRIPTION, HSN/SAC, QTY, PRICE, TAX, AMOUNT
 */
function ProformaItemsTable({
  items,
  showDiscount = false,
  grossSubtotal,
  taxableSubtotal,
  totalQty,
  subtotal,
  discount,
  taxTotal,
  cgst,
  sgst,
  igst,
  roundOff,
  grandTotal,
  isInterState,
  showTotals = true
}) {
  return (
    <div className="doc-inv-table-wrapper proforma-items-wrapper doc-table-container">
      <table className="doc-inv-table proforma-items-table">
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
              <td className="proforma-cell-nowrap" style={{ textAlign: 'center', fontWeight: 600, color: '#0f172a' }}>{it.sl}</td>
              <td className="proforma-cell-desc" style={{ textAlign: 'left', paddingLeft: '8px' }}>
                <div className="doc-inv-item-name">{it.name}</div>
                {it.sku && <div className="doc-inv-item-sku">SKU / Model: {it.sku}</div>}
                {it.description && <div className="doc-inv-item-desc">{it.description}</div>}

                {/* Serial numbers display: solid black #0f172a, naturally wrapped */}
                {it.isSerialized && Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0 && (
                  <div className="doc-serials" style={{ marginTop: '2px' }}>
                    <div className="doc-serials-values" style={{ fontSize: '12.5px', color: '#0f172a', fontWeight: 500, wordBreak: 'break-word', whiteSpace: 'normal', fontFamily: 'monospace' }}>
                      {it.serialNumbers.join(', ')}
                    </div>
                  </div>
                )}
              </td>
              <td className="proforma-cell-nowrap" style={{ textAlign: 'center', fontFamily: 'monospace', color: '#0f172a' }}>{it.hsnSac}</td>
              <td className="proforma-cell-nowrap" style={{ textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>{it.quantity}</td>
              <td className="proforma-cell-numeric" style={{ fontFamily: 'monospace', color: '#0f172a', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {formatPlainNumber(it.rate)}
              </td>
              {showDiscount && (
                <td className="proforma-cell-numeric" style={{ fontFamily: 'monospace', color: '#0f172a', textAlign: 'right', whiteSpace: 'nowrap' }}>
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
              <td className="proforma-cell-numeric" style={{ fontFamily: 'monospace', color: '#0f172a', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <div>{formatPlainNumber(it.tax)}</div>
                {it.gstPct ? (
                  <div style={{ fontSize: '11px', color: '#475569', fontWeight: 500 }}>
                    (GST {it.gstPct}%)
                  </div>
                ) : null}
              </td>
              <td className="proforma-cell-numeric" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {formatPlainNumber(it.amount !== undefined ? it.amount : it.taxableValue)}
              </td>
            </tr>
          ))}

          {/* Subtotal / Summary Rows */}
          {showTotals && (
            <>
              {showDiscount ? (
                <>
                  <tr className="doc-inv-summary-row">
                    <td colSpan="6" className="doc-inv-summary-label proforma-cell-numeric" style={{ fontWeight: 700, paddingRight: '12px', textAlign: 'right' }}>
                      GROSS AMOUNT
                    </td>
                    <td colSpan="2" className="doc-inv-summary-val proforma-cell-numeric" style={{ fontFamily: 'monospace', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      ₹ {formatPlainNumber(grossSubtotal !== undefined ? grossSubtotal : subtotal)}
                    </td>
                  </tr>
                  <tr className="doc-inv-summary-row">
                    <td colSpan="6" className="doc-inv-summary-label proforma-cell-numeric" style={{ fontWeight: 700, paddingRight: '12px', textAlign: 'right' }}>
                      DISCOUNT
                    </td>
                    <td colSpan="2" className="doc-inv-summary-val proforma-cell-numeric" style={{ fontFamily: 'monospace', fontWeight: 700, color: '#16a34a', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      -₹ {formatPlainNumber(discount)}
                    </td>
                  </tr>
                  <tr className="doc-inv-summary-row">
                    <td colSpan="6" className="doc-inv-summary-label proforma-cell-numeric" style={{ fontWeight: 700, paddingRight: '12px', textAlign: 'right' }}>
                      TAXABLE AMOUNT
                    </td>
                    <td colSpan="2" className="doc-inv-summary-val proforma-cell-numeric" style={{ fontFamily: 'monospace', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      ₹ {formatPlainNumber(taxableSubtotal !== undefined ? taxableSubtotal : subtotal)}
                    </td>
                  </tr>
                  <tr className="doc-inv-summary-row">
                    <td colSpan="6" className="doc-inv-summary-label proforma-cell-numeric" style={{ fontWeight: 700, paddingRight: '12px', textAlign: 'right' }}>
                      TAX AMOUNT
                    </td>
                    <td colSpan="2" className="doc-inv-summary-val proforma-cell-numeric" style={{ fontFamily: 'monospace', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      ₹ {formatPlainNumber(taxTotal)}
                    </td>
                  </tr>
                </>
              ) : (
                <>
                  <tr className="doc-inv-summary-row">
                    <td colSpan="5" className="doc-inv-summary-label proforma-cell-numeric" style={{ fontWeight: 700, paddingRight: '12px', textAlign: 'right' }}>
                      NET AMOUNT
                    </td>
                    <td colSpan="2" className="doc-inv-summary-val proforma-cell-numeric" style={{ fontFamily: 'monospace', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      ₹ {formatPlainNumber(subtotal)}
                    </td>
                  </tr>
                  <tr className="doc-inv-summary-row">
                    <td colSpan="5" className="doc-inv-summary-label proforma-cell-numeric" style={{ fontWeight: 700, paddingRight: '12px', textAlign: 'right' }}>
                      TAX AMOUNT
                    </td>
                    <td colSpan="2" className="doc-inv-summary-val proforma-cell-numeric" style={{ fontFamily: 'monospace', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      ₹ {formatPlainNumber(taxTotal)}
                    </td>
                  </tr>
                </>
              )}

              {roundOff !== 0 && (
                <tr className="doc-inv-summary-row">
                  <td colSpan={showDiscount ? "6" : "5"} className="doc-inv-summary-label proforma-cell-numeric" style={{ fontWeight: 700, paddingRight: '12px', textAlign: 'right' }}>
                    ROUND OFF
                  </td>
                  <td colSpan="2" className="doc-inv-summary-val proforma-cell-numeric" style={{ fontFamily: 'monospace', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    ₹ {formatPlainNumber(roundOff)}
                  </td>
                </tr>
              )}

              <tr className="doc-inv-total-row">
                <td colSpan="3" style={{ textAlign: 'left', fontWeight: 700, color: '#0f172a', paddingLeft: '8px', fontSize: '15.5px' }}>
                  TOTAL INVOICE
                </td>
                <td className="proforma-cell-nowrap" style={{ textAlign: 'center', fontWeight: 700, color: '#0f172a', fontSize: '15.5px' }}>
                  {totalQty}
                </td>
                <td colSpan={showDiscount ? "2" : "1"}></td>
                <td colSpan="2" className="doc-inv-total-val proforma-cell-numeric" style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '15.5px', color: '#0f172a', textAlign: 'right', whiteSpace: 'nowrap' }}>
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
 * Amount Chargeable in Words
 * Strictly matching printed ASI Proforma reference
 */
function AmountInWords({ words }) {
  return (
    <div className="doc-inv-words-box">
      <div className="doc-inv-words-title" style={{ fontSize: '12.5px', color: '#475569', fontWeight: 600 }}>
        Amount chargeable (in words)
      </div>
      <div className="doc-inv-words-text" style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
        ( {words} )
      </div>
    </div>
  );
}

/**
 * Tax Breakdown Summary Table
 * Strictly matching printed ASI Proforma reference:
 * Intra-state: HSN/SAC | TAX VALUE | CENTRAL TAX (RATE/AMOUNT) | STATE TAX (RATE/AMOUNT) | TOTAL TAX
 * Inter-state: HSN/SAC | TAX VALUE | INTEGRATED TAX (RATE/AMOUNT) | TOTAL TAX
 */
function TaxSummary({ taxSummary, isInterState, subtotal, taxTotal, taxWords, cgst, sgst, igst }) {
  return (
    <div className="doc-inv-tax-box doc-table-container">
      <table className="doc-inv-tax-table">
        <thead>
          {isInterState ? (
            <>
              <tr>
                <th rowSpan="2" style={{ width: '18%' }}>HSN/SAC</th>
                <th rowSpan="2" style={{ width: '26%' }}>
                  TAXABLE VALUE
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
                  TAXABLE VALUE
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
        Tax Amount (in words): <strong>INR {taxWords} ({formatPlainNumber(taxTotal)})</strong>
      </div>
    </div>
  );
}

/**
 * Bottom Section: Terms, Bank Details, Signature Block
 */
function ProformaBottomSection({ comp, bankDetails, paymentTerms, deliveryTerms, validityNotes, remarks }) {
  const bank = bankDetails || comp.bankDetails || {};
  const accName = bank.accountName || comp.accountName || comp.name || 'ACTIVE SYSTEM INTEGRATION';
  const bankName = bank.bankName || comp.bankName || 'HDFC BANK';
  const accNo = bank.accountNumber || bank.accountNo || comp.accountNumber || '50200028741215';
  const ifsc = bank.ifscCode || bank.ifsc || comp.ifscCode || 'HDFC0000024';
  const branch = bank.branch || comp.branch || '';

  return (
    <div className="doc-inv-bottom-box">
      <div className="doc-inv-bottom-left">
        {/* Commercial Terms */}
        <div className="doc-proforma-terms" style={{ marginBottom: '4px' }}>
          {validityNotes && (
            <div className="doc-inv-term-line" style={{ fontSize: '12px', color: '#1e293b', marginBottom: '2px', lineHeight: '1.3' }}>
              <strong>Validity Terms:</strong> {validityNotes}
            </div>
          )}
          {paymentTerms && (
            <div className="doc-inv-term-line" style={{ fontSize: '12px', color: '#1e293b', marginBottom: '2px', lineHeight: '1.3' }}>
              <strong>Payment Terms:</strong> {paymentTerms}
            </div>
          )}
          {deliveryTerms && (
            <div className="doc-inv-term-line" style={{ fontSize: '12px', color: '#1e293b', marginBottom: '2px', lineHeight: '1.3' }}>
              <strong>Delivery Terms:</strong> {deliveryTerms}
            </div>
          )}
          {remarks && (
            <div className="doc-inv-term-line" style={{ fontSize: '12px', color: '#1e293b', marginBottom: '2px', lineHeight: '1.3' }}>
              <strong>Remarks:</strong> {remarks}
            </div>
          )}
        </div>

        {/* Bank Details in Single Compact Horizontal Flow */}
        <div className="doc-inv-bank-pane" style={{ marginTop: '3px' }}>
          <div className="doc-inv-bank-title" style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '2px' }}>
            Bank Details:
          </div>
          <div className="doc-inv-bank-inline-wrap" style={{ fontSize: '11.5px', color: '#334155', lineHeight: '1.35', display: 'flex', flexWrap: 'wrap', gap: '3px 6px' }}>
            <span>Acc. Name: <strong>{accName}</strong>,</span>
            <span>Bank: <strong>{bankName}</strong>,</span>
            <span>Acc. Number: <strong style={{ fontFamily: 'monospace' }}>{accNo}</strong>,</span>
            <span>IFSC Code: <strong style={{ fontFamily: 'monospace' }}>{ifsc}</strong>{branch ? ',' : ''}</span>
            {branch ? (
              <span>Branch: <strong>{branch}</strong></span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="doc-inv-bottom-right" style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', textAlign: 'center' }}>
        <div className="doc-inv-for-company" style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', alignSelf: 'flex-end', whiteSpace: 'nowrap' }}>
          For {comp.name || comp.companyName || 'Active System Integration'}
        </div>
        <div className="doc-inv-sig-space" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '52px', padding: '2px 0' }}>
          {comp.signatureUrl ? (
            <img src={comp.signatureUrl} alt="Authorized Signatory" className="doc-inv-sig-img" style={{ maxHeight: '48px', maxWidth: '110px', objectFit: 'contain' }} />
          ) : null}
          {comp.sealUrl ? (
            <img src={comp.sealUrl} alt="Official Seal" className="doc-inv-seal-img" style={{ maxHeight: '52px', maxWidth: '52px', objectFit: 'contain', marginTop: comp.signatureUrl ? '3px' : '0' }} />
          ) : !comp.signatureUrl ? (
            <AsiOfficialSeal width={70} height={70} />
          ) : null}
        </div>
        <div className="doc-inv-authorized-label" style={{ fontSize: '11.5px', fontWeight: 700, color: '#1e293b', alignSelf: 'flex-end', whiteSpace: 'nowrap' }}>
          Authorized Signatory
        </div>
      </div>
    </div>
  );
}

/**
 * Accurate height estimator for Proforma line items
 */
export function estimateProformaItemHeight(it) {
  let h = 34; // base row with 1 line title
  const name = String(it.name || it.productName || '').trim();
  if (name.length > 36) {
    h += Math.max(1, Math.ceil(name.length / 36) - 1) * 14;
  }
  const sku = (it.sku || it.productCode || '').trim();
  if (sku) {
    h += 14;
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
 * Height estimator for proforma bottom section (Totals, Words, Tax Table, Terms, Bank Details, Signatory)
 */
export function estimateProformaBottomHeight(vm) {
  let h = 0;
  h += vm.showDiscount ? 135 : 90; // Totals rows
  h += 34; // Amount in Words
  const taxCount = (vm.taxSummary || []).length || 1;
  h += 30 + taxCount * 22 + 25; // Tax summary table
  if (vm.taxWords) {
    h += 22;
  }
  h += 135; // Bank Details & Signatory
  h += 40; // Margins & section gaps
  return h;
}

/**
 * Data-Driven Multi-Page Pagination for Proforma Invoice
 */
export function paginateProforma(vm) {
  const items = vm.items || [];
  const PAGE_CAPACITY_PX = 955; // Safe A4 printable height in px
  const PAGE1_TOP_HEIGHT = 380; // Title (30) + Header box (190) + Parties (125) + thead (35)
  const CONTINUATION_TOP_HEIGHT = 45; // thead (35) + margin (10)
  const totalBottomHeight = estimateProformaBottomHeight(vm);

  const itemHeights = items.map(estimateProformaItemHeight);
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
 * Master Printable Proforma Invoice Component
 * Single Source of Truth for Browser Preview, Browser Print, and Download PDF.
 */
export default function PrintableProformaInvoice({ data, companySettings }) {
  if (!data) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        <p style={{ fontSize: '16px', fontWeight: 600 }}>Proforma Invoice not found.</p>
        <p style={{ fontSize: '13px' }}>Please select a valid proforma invoice record to preview or print.</p>
      </div>
    );
  }

  const liveConfig = useCompanyConfig();
  const effectiveSettings = companySettings || liveConfig;

  const vm = useMemo(
    () => normalizeProformaDocument(data, effectiveSettings),
    [data, effectiveSettings]
  );

  const pages = useMemo(() => {
    return paginateProforma(vm);
  }, [vm]);

  const totalPages = pages.length;

  return (
    <div
      className="doc-sheet-root doc-paged-root printable-sales-invoice printable-proforma-invoice"
      id={`pi-sheet-${vm.proformaId}`}
      data-proforma-id={vm.proformaId}
    >
      {pages.map((page, pIdx) => (
        <React.Fragment key={`pi-page-${page.pageNumber}`}>
          {/* Viewer-only visual gap separator */}
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
            <DocumentWatermark comp={vm.comp} />

            <div className="doc-paged-page-body">
              {page.isPage1 ? (
                <>
                  {/* 1. Document Title - Centered, bold, professional */}
                  <h1 className="doc-inv-top-title proforma-main-title">PROFORMA INVOICE</h1>

                  {/* 2. Top Header Box: Left Company Info | Right Metadata Table */}
                  <div className="doc-inv-header-box proforma-header-box">
                    <CompanyBlock comp={vm.comp} />
                    <ProformaMetadataTable rows={vm.metadataRows} />
                  </div>

                  {/* 3. Parties Box: Consignee (Bill To) | Shipping Address (Ship To) */}
                  <BillingShippingSection consignee={vm.consignee} shipping={vm.shipping} />
                </>
              ) : null}

              {/* 4. Main Line Items Table (Repeats <thead> with column headers on every page!) */}
              <ProformaItemsTable
                items={page.items}
                showDiscount={vm.showDiscount}
                grossSubtotal={vm.grossSubtotal}
                taxableSubtotal={vm.taxableSubtotal}
                totalQty={vm.totalQty}
                subtotal={vm.subtotal}
                discount={vm.discount}
                taxTotal={vm.taxTotal}
                cgst={vm.cgst}
                sgst={vm.sgst}
                igst={vm.igst}
                roundOff={vm.roundOff}
                grandTotal={vm.grandTotal}
                isInterState={vm.isInterState}
                showTotals={page.showTotals}
              />

              {/* Bottom Section (Amount in words, Tax breakdown, Bank details & Signatory) */}
              {page.showBottomSection && (
                <>
                  {/* 5. Amount Chargeable in Words */}
                  <AmountInWords words={vm.amountWords} />

                  {/* 6. Tax Breakdown Summary Table */}
                  <TaxSummary
                    taxSummary={vm.taxSummary}
                    isInterState={vm.isInterState}
                    subtotal={vm.subtotal}
                    taxTotal={vm.taxTotal}
                    taxWords={vm.taxWords}
                    cgst={vm.cgst}
                    sgst={vm.sgst}
                    igst={vm.igst}
                  />

                  {/* 7. Bottom Section: Commercial Terms, Bank Details & Authorized Signatory */}
                  <ProformaBottomSection
                    comp={vm.comp}
                    bankDetails={vm.bankDetails}
                    paymentTerms={vm.paymentTerms}
                    deliveryTerms={vm.deliveryTerms}
                    validityNotes={vm.validityNotes}
                    remarks={vm.remarks}
                  />
                </>
              )}
            </div>

            {/* 8. Unified Computer Generated Notice & Page Number Footer */}
            <div className="doc-inv-computer-notice doc-unified-footer-bar">
              <span className="doc-footer-spacer" />
              <span className="doc-footer-center-text">
                This is a Computer Generated Proforma Invoice
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
