import React, { useState, useEffect } from 'react';
import { DEFAULT_ASI_LOGO } from '../../assets/asi_logo_default';
import { ASI_WATERMARK_LOGO } from '../../assets/asi_watermark_default';
export { DEFAULT_ASI_LOGO, ASI_WATERMARK_LOGO };
import { apiFetch, apiUrl } from '../../api';
import { DEFAULT_THEME, normalizeThemeId, applyThemeToDocument, THEMES } from '../../utils/theme';
export { DEFAULT_THEME, normalizeThemeId, applyThemeToDocument, THEMES };

export const COMPANY_CONFIG = {
  theme: DEFAULT_THEME,
  name: 'Active System Integration',
  siteShortName: 'ASI',
  iso: 'ISO 9001:2015 Certified',
  address: 'Plot No. 10A, Perumal Kovil Street, Sivabootham, Vanagaram, Chennai - 600095',
  street: 'Plot No. 10A, Perumal Kovil Street',
  street2: 'Sivabootham, Vanagaram',
  city: 'Chennai',
  pincode: '600095',
  state: 'Tamil Nadu',
  country: 'India',
  phone: '09994126666',
  mobile: '98943 26666',
  mobileList: ['09994126666', '98943 26666', '91500 26666', '91711 26666'],
  email: 'admin@asi.ind.in',
  website: 'https://asiind.com/',
  gstin: '33AZPPS7068A1Z4',
  logoUrl: DEFAULT_ASI_LOGO,
  watermarkLogoUrl: ASI_WATERMARK_LOGO,
  masterLogoSize: 180,
  quotationLogoSize: 152,
  dcLogoSize: 116,
  logoSize: 180,
  signatureUrl: null,
  sealUrl: null,
  bankDetails: {
    accountName: 'ACTIVE SYSTEM INTEGRATION',
    bankName: 'HDFC BANK',
    accountNo: '50200028741215',
    accountNumber: '50200028741215',
    ifsc: 'HDFC0000024',
    ifscCode: 'HDFC0000024',
    branch: 'ANNA NAGAR, CHENNAI'
  },
  proformaNote: 'Kindly verify item model/specifications before release of PO/payment.',
  paymentTerms: '100% ADVANCE PAYMENT',
  deliveryTerms: 'EX-STOCK / 1-2 WEEKS',
  validityTerms: '15 DAYS FROM INVOICE DATE',
  invoiceNote: 'Request Payment by Demand Draft / AC Payee Only If any clarification in the above details please inform within seven days. We declare that this invoice shows the actual price of the goods described and all the particulars mentioned are true and correct',
  termsAndConditions: [
    'Payment due within agreed credit terms from invoice date.',
    'Interest @ 18% p.a. will be charged on overdue payments.',
    'Goods once sold will not be accepted back without prior RMA approval.',
    'All disputes are subject to Chennai jurisdiction only.'
  ],
  defaultProductUnit: 'Nos',
  productUnits: [
    { id: 'Nos', name: 'Nos', code: 'NOS', description: 'Numbers / Units count', status: 'Active' },
    { id: 'Box', name: 'Box', code: 'BOX', description: 'Carton / Box pack', status: 'Active' },
    { id: 'Set', name: 'Set', code: 'SET', description: 'Complete set of accessories', status: 'Active' },
    { id: 'Meter', name: 'Meter', code: 'MTR', description: 'Length measurement in meters', status: 'Active' },
    { id: 'Roll', name: 'Roll', code: 'ROL', description: 'Continuous roll packaging (Cables / Wires)', status: 'Active' }
  ]
};

const STORAGE_KEY = 'asicrm_company_settings';
let cachedConfig = null;
const listeners = new Set();

function getInitialConfig() {
  if (cachedConfig) {
    applyThemeToDocument(cachedConfig.theme);
    return cachedConfig;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cachedConfig = {
        ...COMPANY_CONFIG,
        ...parsed,
        theme: parsed.theme || COMPANY_CONFIG.theme || DEFAULT_THEME,
        logoUrl: parsed.logoUrl !== undefined ? parsed.logoUrl : DEFAULT_ASI_LOGO,
        bankDetails: {
          ...COMPANY_CONFIG.bankDetails,
          ...(parsed.bankDetails || {})
        }
      };
      if (cachedConfig.mobile) {
        if (Array.isArray(cachedConfig.mobile)) {
          cachedConfig.mobileList = cachedConfig.mobile;
        } else if (typeof cachedConfig.mobile === 'string') {
          const split = cachedConfig.mobile.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
          if (split.length > 0) cachedConfig.mobileList = split;
        }
      }
      applyThemeToDocument(cachedConfig.theme);
      return cachedConfig;
    }
  } catch (_) {}
  cachedConfig = { ...COMPANY_CONFIG, theme: DEFAULT_THEME };
  applyThemeToDocument(cachedConfig.theme);
  return cachedConfig;
}

export function getCompanyConfig() {
  return getInitialConfig();
}

export function subscribeCompanyConfig(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyCompanyConfig(newConfig) {
  const normName = newConfig.companyName || newConfig.name || (cachedConfig && cachedConfig.name) || COMPANY_CONFIG.name;
  const nextTheme = newConfig.theme || (cachedConfig && cachedConfig.theme) || COMPANY_CONFIG.theme || DEFAULT_THEME;
  cachedConfig = {
    ...COMPANY_CONFIG,
    ...cachedConfig,
    ...newConfig,
    name: normName,
    companyName: normName,
    siteShortName: newConfig.siteShortName || (cachedConfig && cachedConfig.siteShortName) || COMPANY_CONFIG.siteShortName || 'ASI',
    theme: nextTheme
  };
  if (cachedConfig.mobile) {
    if (Array.isArray(cachedConfig.mobile)) {
      cachedConfig.mobileList = cachedConfig.mobile;
    } else if (typeof cachedConfig.mobile === 'string') {
      const split = cachedConfig.mobile.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
      if (split.length > 0) cachedConfig.mobileList = split;
    }
  }
  applyThemeToDocument(cachedConfig.theme);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedConfig));
  } catch (_) {}
  listeners.forEach((fn) => {
    try {
      fn(cachedConfig);
    } catch (_) {}
  });
}

// Cross-tab synchronization via storage event
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        cachedConfig = {
          ...COMPANY_CONFIG,
          ...parsed,
          theme: parsed.theme || (cachedConfig && cachedConfig.theme) || DEFAULT_THEME
        };
        applyThemeToDocument(cachedConfig.theme);
        listeners.forEach((fn) => fn(cachedConfig));
      } catch (_) {}
    }
  });

  // Apply theme immediately on startup
  try {
    const startupConfig = getInitialConfig();
    applyThemeToDocument(startupConfig.theme);
  } catch (_) {}
}

/**
 * Fetch latest company settings from the backend and update local cache
 */
export async function fetchCompanyConfig(user) {
  try {
    const res = await apiFetch(apiUrl('/api/settings/company'), {
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user?.id || ''
      }
    });
    if (res.ok) {
      const result = await res.json();
      if (result.success && result.data) {
        const d = result.data;
        const merged = {
          ...COMPANY_CONFIG,
          ...d,
          companyName: d.companyName || d.name || COMPANY_CONFIG.name,
          name: d.companyName || d.name || COMPANY_CONFIG.name,
          siteShortName: d.siteShortName || COMPANY_CONFIG.siteShortName || 'ASI',
          theme: d.theme || (cachedConfig && cachedConfig.theme) || COMPANY_CONFIG.theme || DEFAULT_THEME,
          iso: d.iso || COMPANY_CONFIG.iso,
          address: d.address || COMPANY_CONFIG.address,
          street: d.street || COMPANY_CONFIG.street,
          street2: d.street2 || COMPANY_CONFIG.street2,
          city: d.city || COMPANY_CONFIG.city,
          state: d.state !== undefined ? d.state : COMPANY_CONFIG.state,
          pincode: d.pincode || d.zipCode || COMPANY_CONFIG.pincode,
          phone: d.phone || COMPANY_CONFIG.phone,
          mobile: d.mobile !== undefined ? d.mobile : COMPANY_CONFIG.mobile,
          email: d.email || COMPANY_CONFIG.email,
          website: d.website || COMPANY_CONFIG.website,
          gstin: d.gstin || COMPANY_CONFIG.gstin,
          logoUrl: (d.logoUrl !== undefined && d.logoUrl !== null) ? d.logoUrl : DEFAULT_ASI_LOGO,
          masterLogoSize: Number(d.masterLogoSize || d.logoSize || COMPANY_CONFIG.masterLogoSize || 180),
          quotationLogoSize: Number(d.quotationLogoSize || d.quotationSetup?.logoSize || d.masterLogoSize || d.logoSize || COMPANY_CONFIG.quotationLogoSize || 235),
          dcLogoSize: Number(d.dcLogoSize || d.dcSetup?.logoSize || d.masterLogoSize || d.logoSize || COMPANY_CONFIG.dcLogoSize || 116),
          logoSize: Number(d.logoSize || d.masterLogoSize || COMPANY_CONFIG.logoSize || 180),
          signatureUrl: d.signatureUrl || d.signImage || null,
          sealUrl: d.sealUrl || null,
          proformaNote: d.proformaNote || COMPANY_CONFIG.proformaNote,
          paymentTerms: d.paymentTerms || COMPANY_CONFIG.paymentTerms,
          deliveryTerms: d.deliveryTerms || COMPANY_CONFIG.deliveryTerms,
          validityTerms: d.validityTerms || COMPANY_CONFIG.validityTerms,
          invoiceNote: d.termsAndConditions || d.invoiceNote || COMPANY_CONFIG.invoiceNote,
          termsAndConditions: d.termsAndConditions || COMPANY_CONFIG.termsAndConditions,
          quotationTerms: d.quotationTerms || COMPANY_CONFIG.quotationTerms,
          invoiceSetup: d.invoiceSetup || {},
          quotationSetup: d.quotationSetup || {},
          dcSetup: d.dcSetup || {},
          pdfSettings: d.pdfSettings || {},
          taxSetup: d.taxSetup || {},
          currency: d.currency || {},
          discountSetup: d.discountSetup || {},
          bankDetails: {
            accountName: d.accountName || d.bankAccountName || d.bankDetails?.accountName || COMPANY_CONFIG.bankDetails.accountName,
            bankName: d.bankName || d.bankDetails?.bankName || COMPANY_CONFIG.bankDetails.bankName,
            accountNo: d.accountNumber || d.bankAccountNo || d.bankDetails?.accountNo || COMPANY_CONFIG.bankDetails.accountNo,
            accountNumber: d.accountNumber || d.bankAccountNo || d.bankDetails?.accountNumber || COMPANY_CONFIG.bankDetails.accountNumber,
            ifsc: d.ifscCode || d.bankIfsc || d.bankDetails?.ifsc || COMPANY_CONFIG.bankDetails.ifsc,
            ifscCode: d.ifscCode || d.bankIfsc || d.bankDetails?.ifscCode || COMPANY_CONFIG.bankDetails.ifscCode,
            branch: d.branch || d.bankBranch || d.bankDetails?.branch || COMPANY_CONFIG.bankDetails.branch
          }
        };
        notifyCompanyConfig(merged);
        return merged;
      }
    }
  } catch (_) {}
  return getInitialConfig();
}

/**
 * React hook to reactively consume Company Config
 */
export function useCompanyConfig(user) {
  const [config, setConfig] = useState(() => getCompanyConfig());

  useEffect(() => {
    const unsub = subscribeCompanyConfig((next) => {
      setConfig(next);
    });

    let effectiveUser = user;
    if (!effectiveUser?.id && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('asicrm_user');
        if (saved) effectiveUser = JSON.parse(saved);
      } catch (_) {}
    }

    fetchCompanyConfig(effectiveUser || { id: 'USR-001' });
    return unsub;
  }, [user?.id]);

  return config;
}

/**
 * Merge dynamically loaded company settings (from API or invoice transaction)
 * with the authoritative COMPANY_CONFIG fallback defaults.
 */
export function getMergedCompanySettings(sourceSettings = {}) {
  const custom = sourceSettings || {};
  const customBank = custom.bankDetails || {};
  const currentMaster = getCompanyConfig() || COMPANY_CONFIG;
  const fallbackBank = currentMaster.bankDetails || COMPANY_CONFIG.bankDetails;

  let mobileList = currentMaster.mobileList || COMPANY_CONFIG.mobileList;
  if (custom.mobile) {
    if (Array.isArray(custom.mobile)) {
      mobileList = custom.mobile;
    } else if (typeof custom.mobile === 'string') {
      mobileList = custom.mobile.split(/[,/]/).map((s) => s.trim()).filter(Boolean);
    }
  }

  return {
    name: custom.name || custom.companyName || currentMaster.name,
    siteShortName: custom.siteShortName || currentMaster.siteShortName,
    iso: custom.iso || currentMaster.iso || COMPANY_CONFIG.iso,
    street: custom.street || currentMaster.street,
    street2: custom.street2 || currentMaster.street2,
    city: custom.city || currentMaster.city,
    state: custom.state || currentMaster.state,
    pincode: custom.pincode || custom.zipCode || currentMaster.pincode,
    country: custom.country || currentMaster.country,
    address: custom.address || currentMaster.address,
    phone: custom.phone || currentMaster.phone,
    mobile: custom.mobile || currentMaster.mobile,
    mobileList: mobileList.length > 0 ? mobileList : currentMaster.mobileList,
    email: custom.email || currentMaster.email,
    website: custom.website || currentMaster.website,
    gstin: custom.gstin || currentMaster.gstin,
    stateCode: custom.stateCode || currentMaster.stateCode,
    logoUrl: custom.logo || custom.logoUrl || currentMaster.logoUrl || DEFAULT_ASI_LOGO,
    watermarkLogoUrl: custom.watermarkLogoUrl || custom.watermarkLogo || currentMaster.watermarkLogoUrl || ASI_WATERMARK_LOGO,
    quotationLogoSize: custom.quotationLogoSize || custom.quotationSetup?.logoSize || currentMaster.quotationLogoSize || currentMaster.quotationSetup?.logoSize || COMPANY_CONFIG.quotationLogoSize || 170,
    masterLogoSize: custom.masterLogoSize || currentMaster.masterLogoSize || COMPANY_CONFIG.masterLogoSize || 180,
    dcLogoSize: custom.dcLogoSize || custom.dcSetup?.logoSize || currentMaster.dcLogoSize || currentMaster.dcSetup?.logoSize || COMPANY_CONFIG.dcLogoSize || 116,
    dcSetup: custom.dcSetup || currentMaster.dcSetup || {},
    quotationSetup: custom.quotationSetup || currentMaster.quotationSetup || {},
    logoSize: custom.logoSize || currentMaster.logoSize || COMPANY_CONFIG.logoSize || 180,
    signatureUrl: custom.signImage || custom.signatureUrl || currentMaster.signatureUrl || null,
    sealUrl: custom.sealUrl || currentMaster.sealUrl || null,
    proformaNote: custom.proformaNote || currentMaster.proformaNote || COMPANY_CONFIG.proformaNote,
    paymentTerms: custom.paymentTerms || currentMaster.paymentTerms || COMPANY_CONFIG.paymentTerms,
    deliveryTerms: custom.deliveryTerms || currentMaster.deliveryTerms || COMPANY_CONFIG.deliveryTerms,
    validityTerms: custom.validityTerms || currentMaster.validityTerms || COMPANY_CONFIG.validityTerms,
    invoiceNote: custom.invoiceNote || custom.termsAndCondition || custom.termsAndConditions || currentMaster.invoiceNote,
    termsAndConditions: custom.terms || currentMaster.termsAndConditions,
    bankDetails: {
      accountName: customBank.accountName || customBank.name || custom.accountName || fallbackBank.accountName,
      bankName: customBank.bankName || custom.bankName || fallbackBank.bankName,
      accountNo: customBank.accountNo || customBank.accountNumber || custom.accountNo || custom.accountNumber || fallbackBank.accountNo,
      accountNumber: customBank.accountNumber || customBank.accountNo || custom.accountNumber || custom.accountNo || fallbackBank.accountNumber,
      ifsc: customBank.ifsc || customBank.ifscCode || custom.ifsc || custom.ifscCode || fallbackBank.ifsc,
      ifscCode: customBank.ifscCode || customBank.ifsc || custom.ifscCode || custom.ifsc || fallbackBank.ifscCode,
      branch: customBank.branch || custom.branch || fallbackBank.branch
    }
  };
}

export const normalizeCompanyDocumentSettings = getMergedCompanySettings;

/**
 * Authentic ASI Brand Logo (Green Oval with "Asi" and "Active System Integration")
 * matching the official printed invoice sample and company settings profile.
 */
export function AsiLogo({ width = 210, height = 98, style = {}, className = '' }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'block', ...style }}
      aria-label="Active System Integration Logo"
    >
      <defs>
        <linearGradient id="asiGreenGrad" x1="15" y1="6" x2="165" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a0cb1b" />
          <stop offset="100%" stopColor="#84af12" />
        </linearGradient>
      </defs>
      {/* Stadium / Pill Capsule */}
      <rect x="15" y="6" width="150" height="58" rx="29" fill="url(#asiGreenGrad)" />

      {/* 'A' letter in white */}
      <path d="M42 47L58 17C59.2 14.8 61.5 14 64 14C66.5 14 68.8 14.8 70 17L86 47C86.8 48.5 85.5 50 83.5 50C82 50 80.8 49 80 47.5L75.5 39H52.5L48 47.5C47.2 49 46 50 44.5 50C42.5 50 41.2 48.5 42 47ZM56 32H72L64 17.5L56 32Z" fill="#ffffff" />

      {/* Swoosh crossing A */}
      <path d="M26 43.5C34 43.5 44 39.5 54 33C52 35 44 39 32 41C28 41.5 26 42.8 26 43.5Z" fill="#ffffff" />

      {/* 's' letter in white */}
      <path d="M92 41C93 44 96.5 46.5 101.5 46.5C106 46.5 109.5 44 109.5 40C109.5 36.8 107 34.8 101 33.2C93.5 31.2 89.5 28.5 89.5 22.8C89.5 17 94.5 13.5 101.5 13.5C107.5 13.5 112 16 113.2 20.8C113.5 22 112.5 22.8 111.2 22.8C110 22.8 109.2 22 108.7 20.8C107.5 18 104.8 16.8 101.5 16.8C97.5 16.8 94.2 19 94.2 22.2C94.2 24.8 96.5 26.5 102.5 28.5C110 30.8 114.5 34 114.5 40C114.5 46.2 109 50 101.5 50C94.5 50 89.8 46.2 88.8 41.2C88.5 39.8 89.8 39 91 39C91.8 39 92.5 39.8 92 41Z" fill="#ffffff" />

      {/* 'i' stem in white */}
      <rect x="122" y="23" width="9.5" height="27" rx="4.5" fill="#ffffff" />

      {/* 'i' petal / leaf dot in white */}
      <path d="M121 16.5C121 12.5 126 9.5 131 11.5C133 12.8 134 16.5 132 18.5C130 20.5 121 20 121 16.5Z" fill="#ffffff" />

      {/* Registered trademark (R) */}
      <circle cx="178" cy="11" r="5" stroke="#84af12" strokeWidth="1.2" fill="none" />
      <text x="175.8" y="13.5" fontSize="6.5" fontWeight="bold" fill="#84af12" fontFamily="Arial, sans-serif">R</text>

      {/* Active System Integration brand text underneath */}
      <text
        x="90"
        y="79"
        textAnchor="middle"
        fontSize="11.5"
        fontWeight="bold"
        fill="#6d910e"
        fontFamily="Arial, Helvetica, sans-serif"
        letterSpacing="0.02em"
      >
        Active System Integration
      </text>
    </svg>
  );
}

/**
 * Authentic Official Company Seal / Stamp
 */
export function AsiOfficialSeal({ width = 110, height = 110, className = '' }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 140 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ display: 'block', margin: '0 auto' }}
      aria-label="Authorized Official Seal"
    >
      <defs>
        <path id="sealTopArc" d="M 22 70 A 48 48 0 0 1 118 70" fill="none" />
        <path id="sealBottomArc" d="M 118 70 A 48 48 0 0 1 22 70" fill="none" />
      </defs>

      <circle cx="70" cy="70" r="62" stroke="#1d4ed8" strokeWidth="2.5" strokeDasharray="none" opacity="0.88" />
      <circle cx="70" cy="70" r="57" stroke="#2563eb" strokeWidth="1" opacity="0.65" />
      <circle cx="70" cy="70" r="40" stroke="#1d4ed8" strokeWidth="1.5" opacity="0.85" />

      <text fill="#1e40af" fontSize="9" fontWeight="800" letterSpacing="0.16em">
        <textPath href="#sealTopArc" startOffset="50%" textAnchor="middle">
          ★ ACTIVE SYSTEM ★
        </textPath>
      </text>

      <text fill="#1e40af" fontSize="8.5" fontWeight="800" letterSpacing="0.14em">
        <textPath href="#sealBottomArc" startOffset="50%" textAnchor="middle">
          INTEGRATION CHENNAI
        </textPath>
      </text>

      <g stroke="#1e3a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.92">
        <path d="M 42 66 C 52 54, 58 78, 68 62 C 74 52, 80 74, 94 58 C 98 54, 102 60, 96 68 C 88 78, 64 82, 48 76" />
        <path d="M 52 70 Q 72 82 100 66" strokeWidth="1.5" />
        <path d="M 82 54 L 88 76" strokeWidth="1.8" />
      </g>
    </svg>
  );
}

/**
 * Centralized CompanyLogo component
 */
export function CompanyLogo({
  logoUrl,
  width = 'auto',
  height = 42,
  maxWidth = 160,
  maxHeight = 46,
  className = 'doc-company-logo-img',
  alt = 'Active System Integration',
  style = {}
}) {
  const [loadFailed, setLoadFailed] = useState(false);
  const activeLogoUrl = logoUrl || getCompanyConfig()?.logoUrl || DEFAULT_ASI_LOGO;

  useEffect(() => {
    setLoadFailed(false);
  }, [activeLogoUrl]);

  if (!activeLogoUrl || (loadFailed && activeLogoUrl === DEFAULT_ASI_LOGO)) {
    return (
      <div
        className="doc-company-logo-fallback"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: typeof height === 'number' ? `${height}px` : height,
          width: typeof height === 'number' ? `${height}px` : 44,
          ...style
        }}
      >
        <img
          src={DEFAULT_ASI_LOGO}
          alt={alt}
          className={className}
          style={{ maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight, maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth, objectFit: 'contain' }}
        />
      </div>
    );
  }

  return (
    <img
      src={activeLogoUrl}
      alt={alt}
      className={className}
      onError={() => {
        setLoadFailed(true);
      }}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
        maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
        objectFit: 'contain',
        objectPosition: 'left center',
        display: 'block',
        ...style
      }}
    />
  );
}

/**
 * Shared Background Watermark Logo for all business documents (Invoice, Proforma, DC, Quotation).
 * Matches the authentic ASI watermark asset, positioned in the center of the printable page area.
 */
export function DocumentWatermark({ watermarkUrl, comp, className = 'doc-inv-watermark-overlay', style = {} }) {
  const [imgFailed, setImgFailed] = useState(false);
  const activeWmUrl = watermarkUrl || comp?.watermarkLogoUrl || ASI_WATERMARK_LOGO || comp?.logoUrl || DEFAULT_ASI_LOGO;

  return (
    <div className={className} style={style}>
      {activeWmUrl && !imgFailed ? (
        <img
          src={activeWmUrl}
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
