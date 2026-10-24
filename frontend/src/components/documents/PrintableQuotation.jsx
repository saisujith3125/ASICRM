import React, { useMemo, useState } from 'react';
import { COMPANY_CONFIG, getMergedCompanySettings, AsiLogo, AsiOfficialSeal, useCompanyConfig, DEFAULT_ASI_LOGO, ASI_WATERMARK_LOGO } from './companyConfig';
import { formatPlainNumber, formatDocDate, formatProposalDate, amountInWords, normalizePartyLines } from './documentFormatters';
import { calculateLineItem, calculateQuotationTotals } from '../enquiry/quotationCalculator';
import './documentStyles.css';

/**
 * Centered subtle background watermark matching physical ASI sample
 */
export function AsiWatermark({ logoUrl, comp }) {
  const [wmFailed, setWmFailed] = useState(false);
  const watermarkUrl = logoUrl || comp?.watermarkLogoUrl || ASI_WATERMARK_LOGO || comp?.logoUrl || DEFAULT_ASI_LOGO;

  return (
    <div className="quotation-watermark">
      {watermarkUrl && !wmFailed ? (
        <img
          src={watermarkUrl}
          alt=""
          className="quotation-watermark-img"
          onError={() => setWmFailed(true)}
        />
      ) : (
        <AsiLogo
          width={440}
          height={380}
          className="quotation-watermark-svg"
        />
      )}
    </div>
  );
}

/**
 * Format quotation/proposal date (defaults to YYYY/MM/DD e.g. 2026/10/24 matching physical ASI reference)
 * Dynamically configurable via Master Settings > Date Format Setup
 */
export function formatQuotationDate(d) {
  if (!d || d === '—' || d === '-') return '';
  return formatProposalDate(d);
}

/**
 * Format Indian financial year tokens (April 1 to March 31)
 */
export function getIndianFinancialYearTokens(rawDate = new Date()) {
  try {
    let year = null;
    let month = null;

    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      year = rawDate.getFullYear();
      month = rawDate.getMonth() + 1;
    } else if (typeof rawDate === 'string') {
      const trimmed = rawDate.trim();
      const isoMatch = trimmed.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
      if (isoMatch) {
        year = parseInt(isoMatch[1], 10);
        month = parseInt(isoMatch[2], 10);
      } else {
        const ddmmyyyy = trimmed.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
        if (ddmmyyyy) {
          month = parseInt(ddmmyyyy[2], 10);
          year = parseInt(ddmmyyyy[3], 10);
        } else {
          const dt = new Date(trimmed);
          if (!isNaN(dt.getTime())) {
            year = dt.getFullYear();
            month = dt.getMonth() + 1;
          }
        }
      }
    }

    if (!year || !month) {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }

    const startYear = month >= 4 ? year : year - 1;
    const endYear = startYear + 1;
    const shortFY = `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
    const longFY = `${startYear}-${endYear}`;
    const midFY = `${startYear}-${String(endYear).slice(-2)}`;
    return { shortFY, longFY, midFY, startYear, endYear };
  } catch (_) {
    return { shortFY: '26-27', longFY: '2026-2027', midFY: '2026-27', startYear: 2026, endYear: 2027 };
  }
}

/**
 * Format Indian financial year code, e.g. "ASI_26_27"
 */
export function getIndianFinancialYearCode(rawDate) {
  const tokens = getIndianFinancialYearTokens(rawDate);
  const startStr = String(tokens.startYear).slice(-2);
  const endStr = String(tokens.endYear).slice(-2);
  return `ASI_${startStr}_${endStr}`;
}

/**
 * Format customer-facing proposal number: ASI/{FINANCIAL_YEAR}/QT{SEQUENCE}
 * Examples: ASI/26-27/QT0001, ASI/26-27/QT0002, ASI/26-27/QT0007
 * Preserves historical document references and database foreign keys.
 */
export function formatProposalNumber(quote = {}) {
  if (typeof quote === 'string') {
    quote = { quotationId: quote };
  }
  if (quote.proposalNumber && String(quote.proposalNumber).trim()) {
    return String(quote.proposalNumber).trim();
  }
  if (quote.proposalNo && String(quote.proposalNo).trim()) {
    return String(quote.proposalNo).trim();
  }

  const raw = String(
    quote.quotationNumber ||
    quote.quotationId ||
    quote.quoteNumber ||
    quote.id ||
    ''
  ).trim();

  if (!raw) return 'ASI/26-27/QT0001';

  // If already in ASI/xx-yy/QTxxxx format, preserve as-is
  if (/^ASI\/\d{2}-\d{2}\/QT\d+/i.test(raw)) {
    return raw;
  }

  const rawDate = quote.createdAt || quote.quotationDate || quote.date || new Date();
  const fyTokens = getIndianFinancialYearTokens(rawDate);
  const fyCode = fyTokens.shortFY;

  // Extract sequence number from internal quotationId formats:
  // e.g. "QTN/001/2026" -> 1
  // e.g. "QT-000007" -> 7
  // e.g. "QT0007" -> 7
  let seqNumber = null;
  const matchSlash = raw.match(/QTN\/0*(\d+)/i);
  if (matchSlash) {
    seqNumber = parseInt(matchSlash[1], 10);
  } else {
    const matchDash = raw.match(/QT-?0*(\d+)/i);
    if (matchDash) {
      seqNumber = parseInt(matchDash[1], 10);
    } else {
      const matchAny = raw.match(/\d+/);
      if (matchAny) {
        seqNumber = parseInt(matchAny[0], 10);
      }
    }
  }

  if (seqNumber !== null && !isNaN(seqNumber)) {
    const padded = String(seqNumber).padStart(4, '0');
    return `ASI/${fyCode}/QT${padded}`;
  }

  return raw;
}

/**
 * Resolve brand name for quotation item from brandId, productCode, or known product mapping
 */
export function resolveBrandName(it = {}, fallbackName = '') {
  if (it.brandName && String(it.brandName).trim()) {
    return String(it.brandName).trim();
  }
  if (it.brand && String(it.brand).trim()) {
    return String(it.brand).trim();
  }

  const brandIdMap = {
    'BR-000001': 'Dahua',
    'BR-000002': 'CP Plus',
    'BR-000003': 'Hikvision',
    'BR-000004': 'TP-Link',
    'BR-000005': 'Western Digital',
    'BR-000006': 'ASI-Dahua-CP Plus-TVT-Prama',
    'BR-000007': 'sensinova',
    'BR-000008': 'D-Link-CP Plus-TVT',
    'BR-000009': 'ASI'
  };
  if (it.brandId && brandIdMap[it.brandId]) {
    return brandIdMap[it.brandId];
  }

  const code = String(it.productCode || it.productId || '').trim().toUpperCase();
  if (code.startsWith('CAM-IPC-001') || code.startsWith('PWR-SMPS') || code.startsWith('RCK-WALL') || code.startsWith('CBL-HDMI')) {
    return 'Dahua';
  }
  if (code.startsWith('CAM-IPC-002')) {
    return 'CP Plus';
  }
  if (code.startsWith('NVR-008')) {
    return 'Hikvision';
  }
  if (code.startsWith('NET-SW') || code.startsWith('CAB-UTP') || code.startsWith('ACC-RJ45')) {
    return 'TP-Link';
  }
  if (code.startsWith('HDD-1TB')) {
    return 'Western Digital';
  }

  const text = `${it.productName || ''} ${fallbackName || ''} ${it.name || ''}`.trim();
  if (/^dahua\b/i.test(text) || /\bdahua\b/i.test(text)) return 'Dahua';
  if (/^cp\s*plus\b/i.test(text) || /\bcp\s*plus\b/i.test(text)) return 'CP Plus';
  if (/^hikvision\b/i.test(text) || /\bhikvision\b/i.test(text)) return 'Hikvision';
  if (/^tp[\s\-]?link\b/i.test(text) || /\btp[\s\-]?link\b/i.test(text)) return 'TP-Link';
  if (/^(?:wd|western\s*digital)\b/i.test(text) || /\b(?:western\s*digital)\b/i.test(text)) return 'Western Digital';
  if (/^d[\s\-]?link\b/i.test(text) || /\bd[\s\-]?link\b/i.test(text)) return 'D-Link';
  if (/^sony\b/i.test(text) || /\bsony\b/i.test(text)) return 'Sony';
  if (/^seagate\b/i.test(text) || /\bseagate\b/i.test(text)) return 'Seagate';
  if (/^sensinova\b/i.test(text) || /\bsensinova\b/i.test(text)) return 'sensinova';
  if (/^honeywell\b/i.test(text) || /\bhoneywell\b/i.test(text)) return 'Honeywell';
  if (/^bosch\b/i.test(text) || /\bbosch\b/i.test(text)) return 'Bosch';
  if (/^matrix\b/i.test(text) || /\bmatrix\b/i.test(text)) return 'Matrix';
  if (/^active\b/i.test(text) || /\bactive\b/i.test(text)) return 'Active';

  return '';
}

/**
 * Format product display title with brand name appended: "ProductName - BrandName"
 */
export function formatProductTitleWithBrand(name, brandName, isInstallation = false) {
  if (!name || isInstallation) return name || '';
  const cleanName = String(name).trim();
  if (!brandName || !String(brandName).trim()) return cleanName;
  const b = String(brandName).trim();

  // If already ends with "- Brand" or "– Brand" (ignoring case), do not duplicate
  const escapedBrand = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const alreadyHasBrandPattern = new RegExp(`[\\-\\–\\—]\\s*${escapedBrand}\\s*$`, 'i');
  if (alreadyHasBrandPattern.test(cleanName)) {
    return cleanName;
  }

  return `${cleanName} - ${b}`;
}

/**
 * Normalizes and creates an authoritative Quotation Document View Model.
 * Single Source of Truth for Quotation Preview, Print, and PDF.
 *
 * @param {Object} quote - Stored Quotation data snapshot
 * @param {Object} customSettings - Optional company settings override
 * @returns {Object} Normalized Quotation View Model
 */
export function normalizeQuotationDocument(quote = {}, customSettings = {}) {
  const comp = getMergedCompanySettings(customSettings || quote.companyDetails || {});

  // 1. Proposal / Quotation Reference & Date
  const quotationNumber = formatProposalNumber(quote);

  const rawDate = quote.createdAt || quote.quotationDate || quote.date || new Date();
  const quotationDate = formatQuotationDate(rawDate);
  const quotationRefCode = (
    quote.quotationRefCode ||
    quote.proposalRefCode ||
    quote.refCode ||
    getIndianFinancialYearCode(rawDate)
  ).trim();

  // 2. Customer / Company Data Resolution
  const custObj = quote.customer || {};
  const rawCompany = (quote.customerCompany || custObj.company || '').trim();
  const rawName = (quote.customerName || custObj.name || '').trim();
  const partyLines = normalizePartyLines(rawCompany || rawName, rawCompany ? rawName : '');
  let customerCompany = partyLines.primaryLine;
  let customerName = partyLines.secondaryLine || '';


  // Address parsing
  const rawAddr = (
    quote.shippingAddress ||
    custObj.shippingAddress ||
    quote.address ||
    custObj.address ||
    custObj.street ||
    ''
  ).trim();

  let customerAddressLines = [];
  if (rawAddr) {
    customerAddressLines = rawAddr
      .split(/[\r\n]+/)
      .map((s) => s.trim().replace(/,+$/, ''))
      .filter(Boolean);
  }

  let customerCity = (quote.customerCity || custObj.city || '').trim();
  let customerState = (quote.customerState || custObj.state || '').trim();
  const customerPincode = (quote.customerPincode || custObj.pincode || custObj.zipCode || '').trim();

  // Clean comma or state from city if combined, e.g. "Chennai, Tamil Nadu"
  if (customerCity.includes(',')) {
    const parts = customerCity.split(',').map((p) => p.trim());
    customerCity = parts[0] || '';
    if (!customerState && parts[1]) {
      customerState = parts[1];
    }
  }

  // 3. Subject Line (SUB : ...)
  // Per requirement: If neither subject nor requirement is given, DO NOT auto-generate "Proposal for [Product Name]"
  // and DO NOT use "Proposal for Commercial Offer". Leave it completely blank ("").
  const isPricingNote = (s) => !s || /prices\s+quoted\s+are\s+valid|taxes\s+extra/i.test(String(s));
  let candidateSubject = quote.subject;

  if (isPricingNote(candidateSubject)) {
    candidateSubject = (
      (!isPricingNote(quote.requirement) ? quote.requirement : '') ||
      quote.title ||
      quote.enquiryTitle ||
      ''
    );
  }

  let cleanSubject = '';
  if (candidateSubject && !isPricingNote(candidateSubject)) {
    let s = String(candidateSubject).trim();
    s = s.replace(/^\d+\s*[xX*]\s*/, '').trim();
    s = s.replace(/^(?:SUB\s*[:\-]\s*)+/i, '').trim();
    s = s.replace(/^(?:Note\s*[:\-]\s*)+/i, '').trim();
    if (s && !isPricingNote(s)) {
      cleanSubject = s;
    }
  }

  // 4. Line Items Mapping & Discount
  const showDiscount = quote.showDiscount !== undefined
    ? Boolean(quote.showDiscount)
    : Boolean(quote.discountTotal > 0 || (Array.isArray(quote.items) && quote.items.some((i) => Number(i.discount || i.discountPercent || 0) > 0)));
  const roundOffTotal = quote.roundOffTotal !== undefined
    ? Boolean(quote.roundOffTotal)
    : Boolean(quote.roundOff && Number(quote.roundOff) !== 0);

  const rawItems = Array.isArray(quote.items) && quote.items.length > 0
    ? quote.items
    : (Array.isArray(quote.products) && quote.products.length > 0
        ? quote.products
        : (quote.item
            ? [{ productName: quote.item, quantity: 1, unitPrice: Number(quote.amount || 0) }]
            : []));

  const items = rawItems.map((it, idx) => {
    const slNo = idx + 1;
    const rawName = (it.productName || it.name || it.item || 'Item Description').toString().trim();
    const isInstallation = Boolean(
      it.isInstallationCharge ||
      it.productId === 'SERVICE-INSTALLATION-TESTING' ||
      it.productCode === 'SRV-INST-001' ||
      rawName.toLowerCase().includes('installation testing & commissioning')
    );
    const brandName = isInstallation ? '' : resolveBrandName(it, rawName);
    const displayName = formatProductTitleWithBrand(rawName, brandName, isInstallation);
    const name = displayName;
    const description = (it.description || it.productDetails || '').toString().trim();
    let hsn = (it.hsnSac || it.hsnCode || it.hsn || '').toString().trim();
    if (!hsn && it.productCode) {
      const codeHsnMap = {
        'CAM-IPC-001': '85258090',
        'CAM-IPC-002': '85258090',
        'NVR-008-001': '85219090',
        'NET-SW-001': '85176290',
        'HDD-1TB-001': '84717020'
      };
      if (codeHsnMap[it.productCode]) {
        hsn = codeHsnMap[it.productCode];
      }
    }

    const unitPrice = Number(it.unitPrice || it.rate || it.cost || 0);
    const quantity = Number(it.quantity || it.qty || 1);
    const gstRate = Number(it.gst !== undefined ? it.gst : (it.taxRate !== undefined ? it.taxRate : 18));
    const discount = Number(it.discount !== undefined ? it.discount : (it.discountPercent || 0));

    const calculated = calculateLineItem({
      quantity,
      unitPrice,
      discount,
      gst: gstRate
    }, { showDiscount });

    // When showDiscount is true, the document displays an explicit Discount column,
    // so UnitPrice shows the base master unit price.
    // When showDiscount is false, if a line discount existed, UnitPrice shows the effective net rate.
    const displayUnitPrice = (!showDiscount && discount > 0 && quantity > 0)
      ? Number((calculated.taxableAmount / quantity).toFixed(2))
      : unitPrice;

    return {
      slNo,
      name,
      displayName,
      rawProductName: rawName,
      productName: rawName,
      brandName,
      brand: brandName,
      brandId: it.brandId || '',
      productId: it.productId,
      description,
      hsn,
      unitPrice: displayUnitPrice,
      baseUnitPrice: unitPrice,
      discount,
      discountAmount: calculated.discountAmount,
      effectiveUnitPrice: displayUnitPrice,
      quantity,
      unit: (it.unit && it.unit !== 'Piece') ? it.unit : 'Nos',
      taxableAmount: calculated.taxableAmount,
      finalLineAmount: calculated.taxableAmount,
      gstRate,
      isIGSTApplicable: Boolean(it.isIGSTApplicable),
      lineTax: calculated.lineTax,
      lineTotal: calculated.lineTotal,
      isInstallationCharge: isInstallation
    };
  });

  // 5. Canonical Totals Computation (Consuming single source of truth)
  const totals = calculateQuotationTotals(items, { showDiscount, roundOffTotal });

  const grossSubtotal = totals.subtotal > 0 ? totals.subtotal : Number(quote.subtotal || 0);
  const discountTotal = totals.discountTotal > 0 ? totals.discountTotal : Number(quote.discountTotal || 0);
  const finalSubtotal = totals.taxableTotal > 0 ? totals.taxableTotal : Number(quote.taxableTotal || (showDiscount ? (grossSubtotal - discountTotal) : grossSubtotal) || 0);
  const finalTax = totals.gstTotal > 0 ? totals.gstTotal : Number(quote.gstTotal || 0);
  const finalTotal = totals.grandTotal > 0 ? totals.grandTotal : Number(quote.grandTotal || (finalSubtotal + finalTax));

  // 6. Amount in Words (Must strictly use final customer-facing total including round-off)
  const amountWords = amountInWords(finalTotal);

  // 7. General Terms & Conditions
  const validUntilStr = quote.validUntil ? formatQuotationDate(quote.validUntil) : null;
  let rawNote = (quote.notes || quote.note || '').trim();
  // Strip any existing "Note :" or "Note:" prefix so it never produces "Note : Note:"
  rawNote = rawNote.replace(/^(?:Note\s*[:\-]\s*)+/i, '').trim();

  let note = '';
  if (rawNote) {
    note = `Note : ${rawNote}`;
  } else if (validUntilStr) {
    note = `Note : Prices quoted are valid until ${validUntilStr}.`;
  } else {
    note = 'Note : Prices quoted are valid for 7 days. Taxes extra as applicable.';
  }

  let termsList = [];
  const rawTermsStr = quote.termsAndConditions || (typeof quote.terms === 'string' ? quote.terms : '');
  if (rawTermsStr && rawTermsStr.trim()) {
    termsList = rawTermsStr
      .split(/[\r\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  } else if (Array.isArray(quote.terms) && quote.terms.length > 0) {
    termsList = quote.terms.map((t) => String(t).trim()).filter(Boolean);
  } else if (typeof quote.remarks === 'string' && quote.remarks.trim()) {
    // If user entered multi-line remarks, preserve them as terms
    termsList = quote.remarks
      .split(/[\r\n]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  if (termsList.length === 0) {
    termsList = [
      'Prices are valid for 7 days from quote date.',
      'Delivery: Ex-stock / 1-2 weeks upon receipt of confirmed purchase order.',
      'Payment: 100% advance or as agreed in commercial proposal.',
      'Warranty: Standard manufacturer warranty applies.'
    ];
  }

  // Strip any existing manual numbering (e.g. "1. ", "2) ", "3- ") so the <ol> does not duplicate numbering (e.g. "1. 1.")
  termsList = termsList
    .map((term) => term.replace(/^\s*\d+[\.\)\-:]\s*/, '').trim())
    .filter(Boolean);

  const introText = (
    quote.introText ||
    quote.introMessage ||
    quote.message ||
    'ASI thanks you for giving us the opportunity to give you our best services to satisfy your requirements. We assure you that we are ready to give our attention with our service and guidance at any moment. Looking forward for the ever lasting relationship with you.'
  ).trim();

  return {
    comp,
    quotationNumber,
    quotationDate,
    quotationRefCode,
    customerCompany,
    customerName,
    customerAddressLines,
    customerCity,
    customerState,
    customerPincode,
    cleanSubject,
    introText,
    showDiscount,
    roundOffTotal,
    items,
    grossSubtotal,
    discountTotal,
    taxableTotal: finalSubtotal,
    finalSubtotal,
    finalTax,
    finalTotal,
    // Aliases to guarantee consistency across components
    subtotal: grossSubtotal,
    gstTotal: finalTax,
    grandTotal: finalTotal,
    amountWords,
    note,
    termsList
  };
}

/**
 * Shared Top Quotation Header matching physical ASI quotation reference
 * Left: Large ASI Logo (with user-controllable size)
 * Right: Company info, address, phone/mobile/email
 */
export function QuotationHeader({ model }) {
  const [imgFailed, setImgFailed] = useState(false);
  const logoWidth = Number(model.comp?.quotationLogoSize || 152);
  // Natural aspect ratio: master logo asset is 511x507 (1:1.008). Height aligns with the first Mobile contact line (~150px)
  const logoHeight = Math.min(152, Math.round(logoWidth * (507 / 511)));
  const logoUrl = model.comp?.logoUrl;
  const hasMasterLogo = Boolean(logoUrl && !imgFailed);

  const mobiles = useMemo(() => {
    const defaultMobiles = ['98943 26666', '91500 26666', '91711 26666'];
    if (Array.isArray(model.comp?.mobileList) && model.comp.mobileList.length > 0) {
      const filtered = model.comp.mobileList.filter((m) => m && m !== model.comp.phone);
      if (filtered.length >= 3) return filtered.slice(0, 3);
      if (filtered.length > 0) return [...filtered, ...defaultMobiles.slice(filtered.length)];
    }
    return defaultMobiles;
  }, [model.comp]);

  return (
    <div className="quotation-header-layout">
      {/* LEFT SIDE: Master Company Logo (Settings-Driven with natural aspect ratio) */}
      <div
        className="quotation-header-logo"
        style={{
          flex: `0 0 ${logoWidth}px`,
          width: `${logoWidth}px`,
          maxWidth: `${logoWidth}px`,
          minHeight: `${logoHeight}px`
        }}
      >
        {hasMasterLogo ? (
          <img
            src={logoUrl}
            alt={model.comp?.name || 'Active System Integration'}
            className="quotation-header-logo-img"
            style={{
              width: 'auto',
              maxWidth: `${logoWidth}px`,
              height: 'auto',
              maxHeight: `${logoHeight}px`,
              objectFit: 'contain',
              display: 'block'
            }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <AsiLogo width={logoWidth} height={logoHeight} />
        )}
      </div>

      {/* RIGHT SIDE: Active System Integration + Address + Contacts (ISO removed per specification) */}
      <div className="quotation-header-company">
        <div className="quotation-company-name">
          <span className="asi-brand-initial">A</span>ctive <span className="asi-brand-initial">S</span>ystem <span className="asi-brand-initial">I</span>ntegration
        </div>
        <div className="quotation-company-address">
          Plot No. 10A, Perumal Kovil Street<br />
          Sivabootham, Vanagaram ,<br />
          Chennai - 600095,<br />
          Tamil Nadu - India
        </div>
        <div className="quotation-company-contacts">
          <div className="quotation-contact-row">
            <span className="quotation-contact-label">Phone</span>
            <span className="quotation-contact-sep">:</span>
            <span className="quotation-contact-val">{model.comp?.phone || '09994126666'}</span>
          </div>
          {mobiles.map((mob, idx) => (
            <div className="quotation-contact-row" key={idx}>
              <span className="quotation-contact-label">Mobile</span>
              <span className="quotation-contact-sep">:</span>
              <span className="quotation-contact-val">{mob}</span>
            </div>
          ))}
          <div className="quotation-contact-row">
            <span className="quotation-contact-label">E-Mail</span>
            <span className="quotation-contact-sep">:</span>
            <span className="quotation-contact-val">{model.comp?.email || 'admin@asi.ind.in'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * PAGE 1 — Official Reference Proposal Cover Letter
 * Exact reproduction of media_1790938684108.png
 */
export function QuotationPage1Cover({ model, totalPages = 2 }) {
  return (
    <div className="quotation-page1-content">
      {/* Top Company Header (Shared canonical source of truth) */}
      <QuotationHeader model={model} />

      {/* Proposal Reference & Date (Right aligned below header) */}
      <div className="quotation-page1-meta-row">
        <div className="quotation-header-ref-block">
          <div className="quotation-header-ref-row">
            <span className="quotation-ref-label">Proposal #</span>
            <span className="quotation-ref-sep">:</span>
            <span className="quotation-ref-val">{model.quotationNumber}</span>
          </div>
          <div className="quotation-header-ref-row">
            <span className="quotation-ref-label">Date</span>
            <span className="quotation-ref-sep">:</span>
            <span className="quotation-ref-val">{model.quotationDate}</span>
          </div>
        </div>
      </div>

      {/* Customer Address Block (Left aligned) */}
      <div className="quotation-customer-section">
        <div className="quotation-to-heading">To,</div>
        {model.customerCompany && (
          <div className="quotation-customer-company">{model.customerCompany},</div>
        )}
        {model.customerName && model.customerName !== model.customerCompany && (
          <div className="quotation-customer-name">{model.customerName},</div>
        )}
        {model.customerAddressLines && model.customerAddressLines.length > 0 ? (
          model.customerAddressLines.map((line, idx) => (
            <div key={idx} className="quotation-customer-line">{line},</div>
          ))
        ) : null}
        {(model.customerCity || model.customerPincode) && (
          <div className="quotation-customer-line">
            {[model.customerCity, model.customerPincode].filter(Boolean).join(' - ')}
          </div>
        )}
        {model.customerState && (
          <div className="quotation-customer-line">{model.customerState}.</div>
        )}
      </div>

      {/* Subject Line (Omitted if blank) */}
      {model.cleanSubject ? (
        <div className="quotation-subject-line">
          <u><strong>SUB : {model.cleanSubject}</strong></u>
        </div>
      ) : null}

      {/* Salutation & Introductory Proposal Body */}
      <div className="quotation-intro-section">
        <div className="quotation-salutation">Dear Sir,</div>
        <p className="quotation-intro-paragraph">
          {model.introText}
        </p>
      </div>

      {/* Page 1 Closing / Regards with Official Seal */}
      <div className="quotation-signoff-section">
        <div className="quotation-signoff-regards">Thanks &amp; Regards</div>
        <div className="quotation-signoff-for">
          For <strong>{model.comp.name || 'Active System Integration'}</strong>
        </div>
        <div className="quotation-sig-seal-container">
          {model.comp.signatureUrl && (
            <img
              src={model.comp.signatureUrl}
              alt="Authorized Signatory"
              className="quotation-sig-img"
            />
          )}
          <div className="quotation-seal-wrap">
            {model.comp.sealUrl ? (
              <img
                src={model.comp.sealUrl}
                alt="Official Seal"
                className="quotation-seal-img"
              />
            ) : (
              <AsiOfficialSeal width={95} height={95} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * PAGE 2 HEADER — Full Reference Header
 * As requested: Page 1 and Page 2 have the full address and contacts.
 */
export function QuotationPage2Header({ model }) {
  return (
    <div className="quotation-page2-header-wrap">
      {/* Top Company Letterhead Header with Address and Contacts */}
      <QuotationHeader model={model} />

      {/* Meta Row: Left SUB, Right Proposal # & Date */}
      <div className="quotation-page2-meta-row">
        {model.cleanSubject ? (
          <div className="quotation-page2-subject">
            <u><strong>SUB : {model.cleanSubject}</strong></u>
          </div>
        ) : <div />}
        <div className="quotation-header-ref-block">
          <div className="quotation-header-ref-row">
            <span className="quotation-ref-label">Proposal #</span>
            <span className="quotation-ref-sep">:</span>
            <span className="quotation-ref-val">{model.quotationNumber}</span>
          </div>
          <div className="quotation-header-ref-row">
            <span className="quotation-ref-label">Date</span>
            <span className="quotation-ref-sep">:</span>
            <span className="quotation-ref-val">{model.quotationDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * CONTINUATION HEADER — For Page 3, Page 4, etc.
 * As requested: Other pages should NOT have the address and contacts and other stuff.
 * Clean, compact header saving vertical space for the continuation table.
 */
export function QuotationContinuationHeader({ model, pageNumber = 3, totalPages = 3 }) {
  const [imgFailed, setImgFailed] = useState(false);
  const logoUrl = model.comp?.logoUrl;
  const hasMasterLogo = Boolean(logoUrl && !imgFailed);

  return (
    <div className="quotation-continuation-compact-wrap">
      <div className="quotation-continuation-compact-top">
        {/* Left: Compact Logo & Company Title */}
        <div className="quotation-continuation-compact-brand">
          {hasMasterLogo ? (
            <img
              src={logoUrl}
              alt=""
              className="quotation-continuation-logo-img"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <AsiLogo width={82} height={34} />
          )}
          <span className="quotation-continuation-brand-text">
            <span className="asi-brand-initial">A</span>ctive <span className="asi-brand-initial">S</span>ystem <span className="asi-brand-initial">I</span>ntegration
          </span>
        </div>

        {/* Right: Proposal #, Date & Page X of Y Indicator */}
        <div className="quotation-continuation-compact-meta">
          <div className="quotation-header-ref-no">
            Proposal # : {model.quotationNumber}
          </div>
          <div className="quotation-header-ref-date">
            {model.quotationDate}
          </div>
          <span className="quotation-continuation-page-badge">
            Page {pageNumber} of {totalPages}
          </span>
        </div>
      </div>

      {/* Continuation Subject Line */}
      {model.cleanSubject ? (
        <div className="quotation-continuation-compact-sub">
          <u><strong>SUB : {model.cleanSubject} (Contd.)</strong></u>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Height estimation helpers for natural A4 pagination (adapted for 170mm printable content width with restored typography)
 */
export function estimateItemHeight(it) {
  const title = (it.displayName || it.name || it.productName || '').trim();
  const titleLines = Math.max(1, Math.ceil(title.length / 38));
  const desc = (it.description || '').trim();
  const descLines = desc ? desc.split(/[\r\n]+/).reduce((acc, line) => acc + Math.max(1, Math.ceil(line.length / 48)), 0) : 0;
  return 20 + titleLines * 17 + descLines * 15;
}

export function estimateTermsHeight(model) {
  let h = 24; // title
  if (model.note) {
    h += Math.max(16, Math.ceil(model.note.length / 70) * 15) + 4;
  }
  const termsList = model.termsList || [];
  for (const term of termsList) {
    h += Math.max(15, Math.ceil(term.length / 70) * 15) + 4;
  }
  return h;
}

/**
 * Data-Driven Multi-Page Pagination
 * Page 1: Cover Letter
 * Page 2: Table starts (Full Header with Address)
 * Page 3+: Table continuation (Compact Header without Address)
 * Utilizes full length and width of each A4 page.
 */
export function paginateQuotation(model) {
  const items = model.items || [];
  const PAGE_CAPACITY_PX = 955; // Safe Printable A4 content height (reserving bottom footer bar)
  const PAGE2_HEADER_HEIGHT = 280; // Full header (180px) + Meta row (56px) + thead (36px) + margin
  const CONTINUATION_HEADER_HEIGHT = 95; // Compact header (50px) + thead (36px) + margin
  const TOTALS_HEIGHT = model.showDiscount ? 135 : 82; // 5 totals rows with discount, 3 rows without
  const WORDS_HEIGHT = 24; // Number in Words
  const termsHeight = estimateTermsHeight(model);
  const SIGNOFF_HEIGHT = 126; // With Regards + Seal
  const MARGINS_HEIGHT = 30; // Section gaps and margins

  const totalBottomHeight = TOTALS_HEIGHT + WORDS_HEIGHT + termsHeight + SIGNOFF_HEIGHT + MARGINS_HEIGHT;

  const itemHeights = items.map((it) => estimateItemHeight(it));
  const totalItemsHeight = itemHeights.reduce((sum, h) => sum + h, 0);

  const pages = [];

  // PAGE 1: Dedicated Cover / Proposal Letter matching physical reference
  pages.push({
    pageNumber: 1,
    isCoverPage: true,
    isFirstPage: true,
    isPage2: false,
    isLastPage: false,
    items: [],
    fillerRowsCount: 0,
    showTotals: false,
    showWords: false,
    showTerms: false,
    showSignoff: false
  });

  // If there are no items, single-page proposal letter is complete
  if (items.length === 0) {
    pages[0].isLastPage = true;
    return pages;
  }

  // PAGE 2: Base item table page
  // Check if ALL items + complete bottom section fit on Page 2:
  const availablePage2WithBottom = PAGE_CAPACITY_PX - PAGE2_HEADER_HEIGHT - totalBottomHeight;

  if (totalItemsHeight <= availablePage2WithBottom) {
    // Fits completely on Page 2 (Standard Two-Page Quotation!)
    const remainingSpace = availablePage2WithBottom - totalItemsHeight;
    const maxFillerFit = Math.max(0, Math.floor(remainingSpace / 28));
    const fillerRowsCount = Math.min(maxFillerFit, Math.max(0, 6 - items.length));

    pages.push({
      pageNumber: 2,
      isCoverPage: false,
      isFirstPage: false,
      isPage2: true,
      isLastPage: true,
      items,
      fillerRowsCount,
      showTotals: true,
      showWords: true,
      showTerms: true,
      showSignoff: true
    });
    return pages;
  }

  // Multi-page continuation for large quotations (Content-Driven: Page 2, Page 3, Page 4, Page 5, ...)
  let currentItemIdx = 0;
  let pageNum = 2;

  while (currentItemIdx < items.length) {
    const isPage2 = pageNum === 2;
    // Page 2 has full company header with address; Page 3+ has NO header (table starts right at top)
    const headerHeight = isPage2 ? PAGE2_HEADER_HEIGHT : 0;
    const pageCapacity = isPage2 ? 580 : 935;

    const pageItems = [];
    let currentHeight = 0;

    while (currentItemIdx < items.length) {
      const it = items[currentItemIdx];
      const h = itemHeights[currentItemIdx];

      // Check if ALL remaining items fit WITH the bottom section on this page
      const remainingItems = items.slice(currentItemIdx);
      const remainingHeight = remainingItems.reduce((sum, _, idx) => sum + itemHeights[currentItemIdx + idx], 0);

      if (currentHeight + remainingHeight + totalBottomHeight <= pageCapacity) {
        // All remaining items and the bottom section fit on this page!
        while (currentItemIdx < items.length) {
          pageItems.push(items[currentItemIdx]);
          currentItemIdx++;
        }
        break;
      }

      // Check if this single item fits on the current page (without bottom section)
      if (currentHeight + h <= pageCapacity) {
        pageItems.push(it);
        currentHeight += h;
        currentItemIdx++;
      } else {
        // If the page has no items yet, take at least this item to guarantee progress
        if (pageItems.length === 0) {
          pageItems.push(it);
          currentItemIdx++;
        }
        break;
      }
    }

    const isAllItemsConsumed = currentItemIdx >= items.length;
    const canFitBottomHere = isAllItemsConsumed && (currentHeight + totalBottomHeight <= pageCapacity);

    pages.push({
      pageNumber: pageNum,
      isCoverPage: false,
      isFirstPage: false,
      isPage2,
      isLastPage: false,
      items: pageItems,
      fillerRowsCount: 0,
      showTotals: canFitBottomHere,
      showWords: canFitBottomHere,
      showTerms: canFitBottomHere,
      showSignoff: canFitBottomHere
    });

    pageNum++;
  }

  // If the last page finished items but could NOT fit the bottom section, create a final continuation page for the bottom section
  const lastPage = pages[pages.length - 1];
  if (!lastPage.showSignoff) {
    let movedItems = [];
    if (lastPage.items.length >= 2) {
      movedItems = lastPage.items.splice(-1);
    }

    pages.push({
      pageNumber: pageNum,
      isCoverPage: false,
      isFirstPage: false,
      isPage2: false,
      isLastPage: true,
      items: movedItems,
      fillerRowsCount: 0,
      showTotals: true,
      showWords: true,
      showTerms: true,
      showSignoff: true
    });
  }

  pages[pages.length - 1].isLastPage = true;
  return pages;
}

/**
 * Printable Quotation Component
 * Renders authentic professional A4 document(s) matching the real-world ASI physical samples.
 */
export default function PrintableQuotation({ data, customSettings }) {
  const compConfig = useCompanyConfig();
  const effectiveSettings = customSettings || compConfig;

  const model = useMemo(() => {
    return normalizeQuotationDocument(data || {}, effectiveSettings);
  }, [data, effectiveSettings]);

  const pages = useMemo(() => {
    if (!data) return [];
    return paginateQuotation(model);
  }, [data, model]);

  const columns = useMemo(() => {
    if (model.showDiscount) {
      return [
        { key: 'slNo', label: 'SL.No', width: '6.5%', align: 'center' },
        { key: 'description', label: 'Description', width: '30%', align: 'left' },
        { key: 'hsn', label: 'HSN Code', width: '9.5%', align: 'center' },
        { key: 'unitPrice', label: 'UnitPrice', width: '12%', align: 'center' },
        { key: 'quantity', label: 'Qty', width: '7%', align: 'center' },
        { key: 'discount', label: 'Discount', width: '11%', align: 'center' },
        { key: 'tax', label: 'Tax', width: '11%', align: 'center' },
        { key: 'amount', label: 'Amount', width: '13%', align: 'center' }
      ];
    }
    return [
      { key: 'slNo', label: 'SL.No', width: '7%', align: 'center' },
      { key: 'description', label: 'Description', width: '36.5%', align: 'left' },
      { key: 'hsn', label: 'HSN Code', width: '10%', align: 'center' },
      { key: 'unitPrice', label: 'UnitPrice', width: '12%', align: 'center' },
      { key: 'quantity', label: 'Qty', width: '9%', align: 'center' },
      { key: 'tax', label: 'Tax', width: '12.5%', align: 'center' },
      { key: 'amount', label: 'Amount', width: '13%', align: 'center' }
    ];
  }, [model.showDiscount]);

  if (!data || pages.length === 0) return null;

  const totalPages = pages.length;

  return (
    <div className="doc-sheet-root doc-quotation-root">
      {pages.map((page, pIdx) => (
        <React.Fragment key={`quote-page-${page.pageNumber}`}>
          {/* Viewer-only visual gap separator (Never printed, never downloaded into PDF) */}
          {pIdx > 0 && (
            <div className="quotation-viewer-page-gap" aria-hidden="true">
              <div className="quotation-viewer-gap-line" />
              <span className="quotation-viewer-gap-badge">
                PAGE {page.pageNumber} OF {totalPages}
              </span>
              <div className="quotation-viewer-gap-line" />
            </div>
          )}

          <div
            className={`doc-quotation-page ${page.pageNumber < totalPages ? 'doc-page-break' : ''}`}
          >
            {/* Subtle Watermark on all pages */}
            <AsiWatermark logoUrl={model.comp?.watermarkLogoUrl || ASI_WATERMARK_LOGO || model.comp?.logoUrl} comp={model.comp} />

            <div className="doc-quotation-page-body">
              {/* PAGE 1: Dedicated Cover / Proposal Letter */}
              {page.isCoverPage ? (
                <QuotationPage1Cover model={model} totalPages={totalPages} />
              ) : (
                <>
                  {/* Page 2 has full header with address; Page 3 and upcoming continuation pages have NO header content or logo */}
                  {page.isPage2 && <QuotationPage2Header model={model} />}

                  {/* Quotation Table */}
                  {(page.items.length > 0 || page.showTotals) && (
                    <table className="quotation-table">
                      <thead>
                        <tr>
                          {columns.map((col) => (
                            <th
                              key={col.key}
                              className={
                                col.key === 'slNo'
                                  ? 'quotation-sl-th'
                                  : (col.key === 'hsn'
                                      ? 'quotation-hsn-th'
                                      : (col.key === 'quantity'
                                          ? 'quotation-qty-th'
                                          : ''))
                              }
                              style={{
                                width: col.width,
                                textAlign: col.align,
                                verticalAlign: 'middle',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {page.items.map((it) => (
                          <tr key={it.slNo} className="quotation-item-row">
                            <td className="quotation-sl-cell" style={{ textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              {it.slNo}
                            </td>
                            <td style={{ textAlign: 'left', verticalAlign: 'middle' }}>
                              <div className="item-name quotation-product-name">{it.displayName || it.name}</div>
                              {it.description && (
                                <div className="item-desc">
                                  {it.description}
                                </div>
                              )}
                            </td>
                            <td className="quotation-hsn-cell" style={{ textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              {it.hsn || '—'}
                            </td>
                            <td className="quotation-numeric-cell quotation-price-cell" style={{ textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              ₹ {formatPlainNumber(it.unitPrice)}
                            </td>
                            <td className="quotation-qty-cell" style={{ textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              {it.quantity}
                            </td>
                            {model.showDiscount && (
                              <td className="quotation-numeric-cell quotation-discount-cell" style={{ textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                {it.discount > 0 ? (
                                  <>
                                    <div>₹ {formatPlainNumber(it.discountAmount)}</div>
                                    <div className="discount-rate-sub">({it.discount}%)</div>
                                  </>
                                ) : (
                                  <span className="quotation-empty-cell-dash">—</span>
                                )}
                              </td>
                            )}
                            <td className="quotation-numeric-cell quotation-tax-cell" style={{ textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              <div>₹ {formatPlainNumber(it.lineTax)}</div>
                              <div className="tax-rate-sub">({it.isIGSTApplicable ? 'IGST' : 'GST'}{it.gstRate}%)</div>
                            </td>
                            <td className="quotation-numeric-cell quotation-amount-cell" style={{ textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                              ₹ {formatPlainNumber(it.taxableAmount)}
                            </td>
                          </tr>
                        ))}

                        {/* Blank Filler Rows (ensures table has 5-6 rows for small item sets) */}
                        {Array.from({ length: page.fillerRowsCount || 0 }).map((_, fIdx) => (
                          <tr key={`filler-${fIdx}`} className="quotation-filler-row">
                            <td className="quotation-sl-cell" style={{ textAlign: 'center' }}>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td className="quotation-hsn-cell" style={{ textAlign: 'center' }}>&nbsp;</td>
                            <td style={{ textAlign: 'center' }}>&nbsp;</td>
                            <td className="quotation-qty-cell" style={{ textAlign: 'center' }}>&nbsp;</td>
                            {model.showDiscount && <td style={{ textAlign: 'center' }}>&nbsp;</td>}
                            <td style={{ textAlign: 'center' }}>&nbsp;</td>
                            <td className="quotation-amount-cell" style={{ textAlign: 'center' }}>&nbsp;</td>
                          </tr>
                        ))}

                        {/* Reference-Style Totals Section */}
                        {page.showTotals && (
                          <>
                            {model.showDiscount ? (
                              <>
                                <tr className="quotation-total-ref-row">
                                  <td colSpan={columns.length - 1} className="quotation-total-ref-label-cell">
                                    GROSS AMOUNT
                                  </td>
                                  <td className="quotation-total-ref-val-cell">
                                    ₹ {formatPlainNumber(model.grossSubtotal)}
                                  </td>
                                </tr>
                                <tr className="quotation-total-ref-row">
                                  <td colSpan={columns.length - 1} className="quotation-total-ref-label-cell">
                                    DISCOUNT
                                  </td>
                                  <td className="quotation-total-ref-val-cell" style={{ color: '#16a34a' }}>
                                    -₹ {formatPlainNumber(model.discountTotal)}
                                  </td>
                                </tr>
                                <tr className="quotation-total-ref-row">
                                  <td colSpan={columns.length - 1} className="quotation-total-ref-label-cell">
                                    TAXABLE AMOUNT
                                  </td>
                                  <td className="quotation-total-ref-val-cell">
                                    ₹ {formatPlainNumber(model.taxableTotal)}
                                  </td>
                                </tr>
                                <tr className="quotation-total-ref-row">
                                  <td colSpan={columns.length - 1} className="quotation-total-ref-label-cell">
                                    TAX AMOUNT
                                  </td>
                                  <td className="quotation-total-ref-val-cell">
                                    ₹ {formatPlainNumber(model.finalTax)}
                                  </td>
                                </tr>
                                <tr className="quotation-total-ref-row quotation-grand-total-ref-row">
                                  <td colSpan={columns.length - 1} className="quotation-total-ref-label-cell quotation-grand-total-label">
                                    TOTAL AMOUNT
                                  </td>
                                  <td className="quotation-total-ref-val-cell quotation-grand-total-val">
                                    ₹ {formatPlainNumber(model.finalTotal)}
                                  </td>
                                </tr>
                              </>
                            ) : (
                              <>
                                <tr className="quotation-total-ref-row">
                                  <td colSpan={columns.length - 1} className="quotation-total-ref-label-cell">
                                    NET AMOUNT
                                  </td>
                                  <td className="quotation-total-ref-val-cell">
                                    ₹ {formatPlainNumber(model.finalSubtotal)}
                                  </td>
                                </tr>
                                <tr className="quotation-total-ref-row">
                                  <td colSpan={columns.length - 1} className="quotation-total-ref-label-cell">
                                    TAX AMOUNT
                                  </td>
                                  <td className="quotation-total-ref-val-cell">
                                    ₹ {formatPlainNumber(model.finalTax)}
                                  </td>
                                </tr>
                                <tr className="quotation-total-ref-row quotation-grand-total-ref-row">
                                  <td colSpan={columns.length - 1} className="quotation-total-ref-label-cell quotation-grand-total-label">
                                    TOTAL AMOUNT
                                  </td>
                                  <td className="quotation-total-ref-val-cell quotation-grand-total-val">
                                    ₹ {formatPlainNumber(model.finalTotal)}
                                  </td>
                                </tr>
                              </>
                            )}
                            {page.showWords && (
                              <tr className="quotation-words-ref-row">
                                <td colSpan={columns.length} className="quotation-words-table-cell">
                                  <strong>Number in Words: </strong>({model.amountWords})
                                </td>
                              </tr>
                            )}
                          </>
                        )}
                      </tbody>
                    </table>
                  )}

                  {/* General Terms & Conditions */}
                  {page.showTerms && (
                    <div className="quotation-terms-section">
                      <div className="quotation-terms-title">General Terms &amp; Conditions :</div>
                      {model.note && <div className="quotation-terms-note">{model.note}</div>}
                      <ol className="quotation-terms-list">
                        {model.termsList.map((term, tIdx) => (
                          <li key={tIdx}>{term}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* Bottom Signoff */}
                  {page.showSignoff && (
                    <div className="quotation-signoff-section">
                      <div className="quotation-signoff-regards">With Regards</div>
                      <div className="quotation-signoff-for">
                        For <strong>{model.comp.name || 'Active System Integration'}</strong>
                      </div>
                      <div className="quotation-sig-seal-container">
                        {model.comp.signatureUrl && (
                          <img
                            src={model.comp.signatureUrl}
                            alt="Authorized Signatory"
                            className="quotation-sig-img"
                          />
                        )}
                        <div className="quotation-seal-wrap">
                          {model.comp.sealUrl ? (
                            <img
                              src={model.comp.sealUrl}
                              alt="Official Seal"
                              className="quotation-seal-img"
                            />
                          ) : (
                            <AsiOfficialSeal width={95} height={95} />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Unified Computer Generated Notice & Page Number Footer */}
            <div className="doc-quotation-footer-notice doc-unified-footer-bar">
              <span className="doc-footer-spacer" />
              <span className="doc-footer-center-text">
                This is a Computer Generated Quotation
              </span>
              <span className="doc-footer-page-num">
                {totalPages > 1 ? `Page ${page.pageNumber} of ${totalPages}` : 'Page 1 of 1'}
              </span>
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
