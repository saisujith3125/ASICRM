import React, { useEffect, useState, useMemo, useRef } from 'react';
import { ArrowLeft, Plus, Check, Trash2, Calendar, FileText, Building2, Phone, Mail, MapPin, ExternalLink, ShieldCheck, CheckCircle, Search, Printer, Zap, XCircle } from 'lucide-react';
import { apiFetch, apiUrl } from '../../api';
import { navigate } from '../../router';
import { hasPermission } from '../../utils/permissions';
import SearchableProductSelect from '../common/SearchableProductSelect';
import CustomerSelector from '../customer/CustomerSelector';
import AddCustomerModal from '../customer/AddCustomerModal';
import DocumentPreviewModal from '../documents/DocumentPreviewModal';
import PrintableQuotation from '../documents/PrintableQuotation';
import { getQuotationFilename } from '../documents/DocumentPdfService';
import { getCompanyConfig } from '../documents/companyConfig';
import { calculateLineItem, calculateQuotationTotals } from './quotationCalculator';

function authHeaders(user) {
  return {
    'Content-Type': 'application/json',
    'x-user-id': user?.id || ''
  };
}

/**
 * Authoritative available stock calculation for quotation products.
 * Available stock = current available stock (total stock minus reserved orders).
 * For serialized products = available active serial numbers.
 */
export function getProductAvailableStock(prod) {
  if (!prod) return 0;
  const masterStock = Number(
    prod.stock !== undefined
      ? prod.stock
      : (prod.totalStock !== undefined ? prod.totalStock : (prod.availableStock !== undefined ? prod.availableStock : (prod.currentStock || 0)))
  );
  const isSerialized = Boolean(prod.serialized);
  const activeSerialsCount = Array.isArray(prod.serialNumbers) ? prod.serialNumbers.length : 0;
  return isSerialized
    ? Math.max(0, Math.min(masterStock, activeSerialsCount > 0 ? activeSerialsCount : masterStock))
    : Math.max(0, masterStock);
}

/**
 * Reusable Price Validation Rule:
 * Quotation price cannot be lower than the product's configured/master price.
 * Dynamic: Always checks live Stock Master to ensure single source of truth across CRM.
 */
export function getProductConfiguredFloorPrice(item, stockProducts = []) {
  if (!item) return 0;
  const prod = Array.isArray(stockProducts) ? stockProducts.find(
    (p) => (p.id && String(p.id) === String(item.productId)) ||
           (p.productId && String(p.productId) === String(item.productId)) ||
           (p.code && String(p.code).trim().toUpperCase() === String(item.productCode || item.productId).trim().toUpperCase())
  ) : null;
  const masterDealerPrice = prod ? Number(prod.dealerPrice || prod.price || prod.unitPrice || prod.sellingPrice || 0) : 0;
  const masterCost = prod ? Number(prod.cost || 0) : 0;
  return Math.max(masterDealerPrice, masterCost, Number(item.minPrice || 0), Number(item.cost || 0));
}

export function getProductConfiguredMrp(item, stockProducts = []) {
  if (!item) return 0;
  const prod = Array.isArray(stockProducts) ? stockProducts.find(
    (p) => (p.id && String(p.id) === String(item.productId)) ||
           (p.productId && String(p.productId) === String(item.productId)) ||
           (p.code && String(p.code).trim().toUpperCase() === String(item.productCode || item.productId).trim().toUpperCase())
  ) : null;
  return prod ? Number(prod.mrp || 0) : Number(item.mrp || 0);
}

export function isPriceBelowConfigured(item, stockProducts = []) {
  if (!item || !item.productId) return false;
  const minPrice = getProductConfiguredFloorPrice(item, stockProducts);
  if (minPrice <= 0) return false;
  if (item.unitPrice === '' || item.unitPrice === undefined || item.unitPrice === null) return false;
  const enteredPrice = Number(item.unitPrice);
  if (isNaN(enteredPrice)) return false;
  return enteredPrice < minPrice;
}

/**
 * Unified Quotation Editor
 * Exactly ONE quotation creation & edit architecture across the entire CRM.
 * 
 * Supported Modes:
 * - 'direct': Direct creation from /quotations/new (Customer selector visible, enquiry optional)
 * - 'enquiry': Context creation from /enquiries/:id/quotation (Customer & Enquiry FIXED read-only)
 * - 'details': Existing quotation viewer/editor from /quotations/:id
 */
export default function QuotationEditor({
  user,
  mode: propMode,
  enquiryId: propEnquiryId,
  quotationId: propQuotationId,
  onClosed,
  onNavigateCustomer,
  onBackToFollowUp
}) {
  // Determine effective mode
  const mode = useMemo(() => {
    if (propQuotationId) return 'details';
    if (propEnquiryId) return 'enquiry';
    if (propMode) return propMode;
    return 'direct';
  }, [propMode, propEnquiryId, propQuotationId]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Primary Quotation Context
  const [quotationNumber, setQuotationNumber] = useState(propQuotationId || 'QT-......');
  const [persistedQuotationId, setPersistedQuotationId] = useState(propQuotationId || '');
  const [quotationStatus, setQuotationStatus] = useState('READY_FOR_QUOTATION');
  const [quotationDate, setQuotationDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [validUntilDate, setValidUntilDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });

  // Quotation Modifiers: Installation Charges, Discount, Round-Off & Show Stock
  const [includeInstallationCharges, setIncludeInstallationCharges] = useState(true);
  const [showDiscount, setShowDiscount] = useState(false);
  const [roundOffTotal, setRoundOffTotal] = useState(false);
  const [showStock, setShowStock] = useState(false);

  // Customer State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [customersList, setCustomersList] = useState([]);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Enquiry Context
  const [enquiry, setEnquiry] = useState(null);
  const [selectedEnquiryId, setSelectedEnquiryId] = useState(propEnquiryId || '');
  const [allEnquiries, setAllEnquiries] = useState([]);

  // Stocks / Inventory Products
  const [stockProducts, setStockProducts] = useState([]);

  // Installation Testing & Commissioning Service Constants & Row Factory
  const INSTALLATION_CHARGE_ROW_ID = 'row_installation_testing_commissioning';
  const INSTALLATION_CHARGE_NAME = 'Installation Testing & Commissioning Charges';

  const createInstallationChargeRow = (overrides = {}) => {
    const rawPrice = overrides.unitPrice !== undefined ? overrides.unitPrice : (overrides.price !== undefined ? overrides.price : 0);
    const parsedPrice = rawPrice === '' ? '' : Math.max(0, parseFloat(rawPrice) || 0);
    const numPrice = parsedPrice === '' ? 0 : parsedPrice;
    const gstRate = Math.max(0, Math.min(100, parseFloat(overrides.gst !== undefined ? overrides.gst : (overrides.gstPct || 18)) || 0));
    const calc = calculateLineItem({
      quantity: 1,
      unitPrice: numPrice,
      gst: gstRate,
      discount: 0
    }, { showDiscount });

    return {
      rowId: overrides.rowId || INSTALLATION_CHARGE_ROW_ID,
      isInstallationCharge: true,
      productId: 'SERVICE-INSTALLATION-TESTING',
      productCode: 'SRV-INST-001',
      productName: INSTALLATION_CHARGE_NAME,
      description: overrides.description !== undefined ? overrides.description : '',
      hsnSac: overrides.hsnSac || '995469',
      stock: 999999,
      availableStock: 999999,
      minPrice: 0,
      unit: 'Job',
      quantity: 1,
      unitPrice: rawPrice === '' ? '' : numPrice,
      hasInteracted: overrides.hasInteracted !== undefined ? overrides.hasInteracted : (numPrice > 0),
      discount: 0,
      discountPercent: 0,
      discountAmount: 0,
      taxableAmount: calc.taxableAmount,
      gst: gstRate,
      isIGSTApplicable: Boolean(overrides.isIGSTApplicable),
      lineSubtotal: calc.lineSubtotal,
      lineTax: calc.lineTax,
      lineTotal: calc.lineTotal,
      qtyError: '',
      hasHistoricalStockWarning: false,
      ...overrides
    };
  };

  // Row helper utilities
  const generateRowId = () => `row_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const createBlankRow = () => ({
    rowId: generateRowId(),
    productId: '',
    productCode: '',
    productName: '',
    description: '',
    hsnSac: '',
    minPrice: 0,
    stock: 0,
    availableStock: 0,
    unit: 'Nos',
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    discountPercent: 0,
    discountAmount: 0,
    taxableAmount: 0,
    gst: 18,
    isIGSTApplicable: false,
    lineSubtotal: 0,
    lineTax: 0,
    lineTotal: 0,
    qtyError: ''
  });

  const ensureTrailingBlankRow = (items, currentIncludeInstallation = includeInstallationCharges) => {
    if (!Array.isArray(items) || items.length === 0) {
      return currentIncludeInstallation ? [createBlankRow(), createInstallationChargeRow()] : [createBlankRow()];
    }
    // Filter out intermediate empty rows, keeping only items with a product or price
    const nonEmpty = items.filter(it => !it.isInstallationCharge && it.productName !== INSTALLATION_CHARGE_NAME && Boolean(it.productId || it.productName));
    const installCharge = items.find(it => it.isInstallationCharge || it.productName === INSTALLATION_CHARGE_NAME);

    const result = [...nonEmpty, createBlankRow()];
    if (installCharge) {
      result.push(installCharge);
    } else if (currentIncludeInstallation) {
      result.push(createInstallationChargeRow());
    }
    return result;
  };

  const mapToLineItems = (rawItems, opts = {}) => {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return includeInstallationCharges ? [createBlankRow(), createInstallationChargeRow()] : [createBlankRow()];
    }
    const currentShowDiscount = opts.showDiscount !== undefined ? opts.showDiscount : showDiscount;
    const currentStockList = opts.stockProducts || stockProducts;

    const hasInstallation = rawItems.some(it =>
      it.isInstallationCharge ||
      it.productId === 'SERVICE-INSTALLATION-TESTING' ||
      it.productCode === 'SRV-INST-001' ||
      String(it.productName || it.name || '').trim().toLowerCase().includes('installation testing & commissioning')
    );
    if (hasInstallation) {
      setIncludeInstallationCharges(true);
    }

    const mapped = rawItems.map((it) => {
      const isInstallation = Boolean(
        it.isInstallationCharge ||
        it.productId === 'SERVICE-INSTALLATION-TESTING' ||
        it.productCode === 'SRV-INST-001' ||
        String(it.productName || it.name || '').trim().toLowerCase().includes('installation testing & commissioning')
      );

      if (isInstallation) {
        return createInstallationChargeRow({
          rowId: it.rowId || INSTALLATION_CHARGE_ROW_ID,
          unitPrice: it.unitPrice !== undefined ? it.unitPrice : (it.price !== undefined ? it.price : 0),
          gst: it.gst !== undefined ? it.gst : 18,
          hsnSac: it.hsnSac || '995469',
          isIGSTApplicable: Boolean(it.isIGSTApplicable),
          hasInteracted: true
        });
      }

      const prod = (currentStockList || []).find(
        (p) => (p.id || p.productId) === it.productId || (p.code || p.productCode) === it.productCode || (p.code || p.productCode) === it.productId
      );

      const masterStock = prod
        ? Number(prod.stock !== undefined ? prod.stock : (prod.totalStock !== undefined ? prod.totalStock : (prod.availableStock || 0)))
        : Number(it.stock !== undefined ? it.stock : (it.availableStock || 0));

      const availStock = prod
        ? getProductAvailableStock(prod)
        : Number(it.availableStock !== undefined ? it.availableStock : masterStock);

      const qty = Number(it.quantity !== undefined ? it.quantity : 1);

      let qtyError = '';
      if (isNaN(qty) || qty <= 0) {
        qtyError = 'Quantity must be at least 1.';
      }
      const hasHistoricalStockWarning = false;

      const masterMinPrice = getProductConfiguredFloorPrice(it, currentStockList);
      const savedUnitPrice = it.unitPrice !== undefined ? it.unitPrice : (it.price !== undefined ? it.price : masterMinPrice);

      return {
        ...calculateLineItem({
          rowId: it.rowId || generateRowId(),
          productId: it.productId || '',
          productCode: it.productCode || '',
          productName: it.productName || it.name || '',
          description: String(it.description !== undefined ? it.description : (it.productDetails || '')),
          hsnSac: it.hsnSac || it.hsnCode || it.hsn || prod?.hsnSac || prod?.hsnCode || '',
          minPrice: masterMinPrice,
          stock: masterStock,
          availableStock: availStock,
          unit: (it.unit && it.unit !== 'Piece') ? it.unit : 'Nos',
          quantity: qty,
          unitPrice: savedUnitPrice,
          discount: Number(it.discount !== undefined ? it.discount : (it.discountPercent || 0)),
          discountPercent: Number(it.discount !== undefined ? it.discount : (it.discountPercent || 0)),
          gst: Number(it.gst !== undefined ? it.gst : 18),
          isIGSTApplicable: Boolean(it.isIGSTApplicable !== undefined ? it.isIGSTApplicable : prod?.isIGSTApplicable)
        }, { showDiscount: currentShowDiscount }),
        minPrice: masterMinPrice,
        unitPrice: savedUnitPrice,
        stock: masterStock,
        availableStock: availStock,
        isIGSTApplicable: Boolean(it.isIGSTApplicable !== undefined ? it.isIGSTApplicable : prod?.isIGSTApplicable),
        qtyError,
        hasHistoricalStockWarning
      };
    });
    return ensureTrailingBlankRow(mapped, hasInstallation);
  };

  // Line items state (starts with blank product row + pre-ticked Installation charge row)
  const [lineItems, setLineItems] = useState(() => [
    createBlankRow(),
    createInstallationChargeRow()
  ]);

  // Remarks / Terms
  const [remarks, setRemarks] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [headerTitle, setHeaderTitle] = useState('QUOTATION');
  const [orderId, setOrderId] = useState('');

  // Top Product Dropdown & Enquiry Modal state
  const [selectedTopProduct, setSelectedTopProduct] = useState('');
  const [isEnquiryDetailsModalOpen, setIsEnquiryDetailsModalOpen] = useState(false);

  // Mode and status flags
  const isContextMode = mode === 'enquiry' || mode === 'details';
  const isSaved = Boolean(persistedQuotationId);
  const isConverted = quotationStatus === 'CONVERTED' || Boolean(orderId);
  const isAccepted = quotationStatus === 'ACCEPTED' || quotationStatus === 'CONFIRMED';
  const [actionLoading, setActionLoading] = useState(false);

  // Permissions
  const canCreateQuotation = hasPermission(user, 'Quotations', 'Create');
  const canEditQuotation = hasPermission(user, 'Quotations', 'Edit');
  const canApproveQuotation = hasPermission(user, 'Quotations', 'Approve');
  const canRejectQuotation = hasPermission(user, 'Quotations', 'Reject');
  const canConvert = (hasPermission(user, 'Quotations', 'Convert to Order') || String(user?.role || '').toUpperCase() === 'SUPER_ADMIN') &&
                     (hasPermission(user, 'Orders & Deals', 'Create') || String(user?.role || '').toUpperCase() === 'SUPER_ADMIN');
  const canManage = isSaved ? canEditQuotation : canCreateQuotation;

  // Track double submission prevention flag
  const isSubmittingRef = useRef(false);

  // Initial Data Loading
  useEffect(() => {
    let mounted = true;

    async function initialize() {
      setLoading(true);
      setError('');

      try {
        // Parallel fetch of common reference data
        const [customersRes, stocksRes, enquiriesRes] = await Promise.all([
          apiFetch(apiUrl('/api/customers'), { headers: authHeaders(user) }).catch(() => null),
          apiFetch(apiUrl('/api/stocks'), { headers: authHeaders(user) }).catch(() => null),
          apiFetch(apiUrl('/api/enquiries'), { headers: authHeaders(user) }).catch(() => null)
        ]);

        let loadedCustomers = [];
        if (customersRes && customersRes.ok) {
          const cData = await customersRes.json();
          if (cData.success && Array.isArray(cData.data)) {
            loadedCustomers = cData.data;
            if (mounted) setCustomersList(loadedCustomers);
          }
        }

        let loadedStockProducts = [];
        if (stocksRes && stocksRes.ok) {
          const sData = await stocksRes.json();
          if (sData.success) {
            const list = Array.isArray(sData.data) ? sData.data : (sData.data?.products || []);
            loadedStockProducts = list;
            if (mounted) setStockProducts(list);
          }
        }

        let loadedEnquiries = [];
        if (enquiriesRes && enquiriesRes.ok) {
          const eData = await enquiriesRes.json();
          if (eData.success && Array.isArray(eData.data)) {
            loadedEnquiries = eData.data;
            if (mounted) setAllEnquiries(loadedEnquiries);
          }
        }

        // Fetch current Quotation Setup Master defaults from company settings for new quotations
        let masterQuotationSetup = {};
        try {
          const compRes = await apiFetch(apiUrl('/api/settings/company'), { headers: authHeaders(user) }).catch(() => null);
          if (compRes && compRes.ok) {
            const compData = await compRes.json();
            if (compData.success && compData.data?.quotationSetup) {
              masterQuotationSetup = compData.data.quotationSetup;
            }
          }
        } catch (e) {
          console.warn('Error fetching master quotation setup:', e);
        }
        if (!masterQuotationSetup.defaultTerms) {
          const cached = getCompanyConfig();
          masterQuotationSetup = cached?.quotationSetup || {};
        }

        const masterDefaultHeader = masterQuotationSetup.headerTitle || 'QUOTATION';
        const masterDefaultNote = masterQuotationSetup.defaultNotes || 'Note: Prices quoted are valid for 7 days. Taxes extra as applicable.';
        const masterDefaultTerms = masterQuotationSetup.defaultTerms || '1. Prices are valid for 7 days from quote date.\n2. Delivery: Ex-stock / 1-2 weeks upon receipt of confirmed purchase order.\n3. Payment: 100% advance or as agreed in commercial proposal.\n4. Warranty: Standard manufacturer warranty applies.';
        const masterValidityDays = Number(masterQuotationSetup.validityDays || 7);

        // Mode-specific initialization
        if (mode === 'details' && propQuotationId) {
          // Load existing quotation record
          const qRes = await apiFetch(apiUrl(`/api/enquiries/quotation/${encodeURIComponent(propQuotationId)}`), {
            headers: authHeaders(user)
          });
          const qData = await qRes.json();
          if (!qRes.ok || !qData.success || !qData.data) {
            throw new Error(qData.message || `Failed to load quotation ${propQuotationId}.`);
          }

          const quote = qData.data;
          if (mounted) {
            setPersistedQuotationId(quote.quotationId);
            setQuotationNumber(quote.quotationId);
            setQuotationStatus(quote.status || 'READY_FOR_QUOTATION');
            setQuotationDate(quote.createdAt ? quote.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
            if (quote.validUntil) setValidUntilDate(quote.validUntil.split('T')[0]);
            setRemarks(quote.remarks || quote.notes || '');
            const loadedTerms = quote.termsAndConditions !== undefined
              ? quote.termsAndConditions
              : (Array.isArray(quote.terms) ? quote.terms.join('\n') : (quote.terms || ''));
            setTermsAndConditions(loadedTerms || '');
            setHeaderTitle(quote.headerTitle || masterDefaultHeader);
            setOrderId(quote.orderId || '');
            setSelectedCustomerId(quote.customerId || '');
            setSelectedEnquiryId(quote.enquiryId || '');

            const hasDiscountInItems = Array.isArray(quote.items) && quote.items.some(i => Number(i.discount || i.discountPercent || 0) > 0);
            const effectiveShowDiscount = Boolean(quote.showDiscount || hasDiscountInItems);
            setShowDiscount(effectiveShowDiscount);

            const hasRoundOff = quote.roundOffTotal !== undefined
              ? Boolean(quote.roundOffTotal)
              : Boolean(quote.roundOff && Number(quote.roundOff) !== 0);
            setRoundOffTotal(hasRoundOff);

            // Find and set customer
            const cust = loadedCustomers.find((c) => c.id === quote.customerId) || {
              id: quote.customerId,
              name: quote.customerName || 'Customer',
              company: quote.customerCompany || '',
              mobile: quote.customerMobile || '',
              email: quote.customerEmail || ''
            };
            setSelectedCustomer(cust);

            // Populate line items with authoritative available stock
            if (Array.isArray(quote.items) && quote.items.length > 0) {
              setLineItems(mapToLineItems(quote.items, { showDiscount: effectiveShowDiscount, stockProducts: loadedStockProducts }));
            }
          }
        } else if (mode === 'enquiry' && propEnquiryId) {
          // Load enquiry context — customer is FIXED from enquiry
          const enqRes = await apiFetch(apiUrl(`/api/enquiries/${encodeURIComponent(propEnquiryId)}`), {
            headers: authHeaders(user)
          });
          const enqData = await enqRes.json();
          if (!enqRes.ok || !enqData.success || !enqData.data) {
            throw new Error(enqData.message || `Failed to load enquiry ${propEnquiryId}.`);
          }

          const enqRecord = enqData.data;
          // If this enquiry already has a quotation, redirect to view it and prevent duplicates
          if (enqRecord.quotationId) {
            navigate(`/quotations/${encodeURIComponent(enqRecord.quotationId)}`);
            return;
          }

          if (mounted) {
            setEnquiry(enqRecord);
            setSelectedEnquiryId(enqRecord.enquiryId);
            setSelectedCustomerId(enqRecord.customerId);

            // Set initial master snapshot
            setHeaderTitle(masterDefaultHeader);
            const d = new Date();
            d.setDate(d.getDate() + masterValidityDays);
            setValidUntilDate(d.toISOString().split('T')[0]);

            let initialNote = masterDefaultNote;
            let initialTerms = masterDefaultTerms;

            // Fetch sequential preview quotation ID
            const idRes = await apiFetch(apiUrl('/api/enquiries/quotations/next-id'), { headers: authHeaders(user) }).catch(() => null);
            if (idRes && idRes.ok) {
              const idData = await idRes.json();
              if (idData.success && idData.nextQuotationId) {
                setQuotationNumber(idData.nextQuotationId);
              }
            }

            // Find customer from loaded customers
            const cust = loadedCustomers.find((c) => c.id === enqRecord.customerId) || {
              id: enqRecord.customerId,
              name: enqRecord.customerName,
              company: enqRecord.customerCompany || '',
              mobile: enqRecord.customerMobile || '',
              email: enqRecord.customerEmail || ''
            };
            setSelectedCustomer(cust);

            // Pre-populate quotation line items if enquiry already has products/quotation
            if (enqRecord.quotation && Array.isArray(enqRecord.quotation.items) && enqRecord.quotation.items.length > 0) {
              setLineItems(mapToLineItems(enqRecord.quotation.items, { stockProducts: loadedStockProducts }));
              if (enqRecord.quotation.validUntil) setValidUntilDate(enqRecord.quotation.validUntil.split('T')[0]);
              if (enqRecord.quotation.remarks) initialNote = enqRecord.quotation.remarks;
              if (enqRecord.quotation.termsAndConditions || enqRecord.quotation.terms) {
                initialTerms = enqRecord.quotation.termsAndConditions || (Array.isArray(enqRecord.quotation.terms) ? enqRecord.quotation.terms.join('\n') : enqRecord.quotation.terms);
              }
            } else if (Array.isArray(enqRecord.items) && enqRecord.items.length > 0) {
              setLineItems(mapToLineItems(enqRecord.items, { stockProducts: loadedStockProducts }));
            }
            if ((enqRecord.description || enqRecord.requirement) && !enqRecord.quotation?.remarks) {
              initialNote = enqRecord.description || enqRecord.requirement || masterDefaultNote;
            }
            setRemarks(initialNote);
            setTermsAndConditions(initialTerms);
          }
        } else {
          // Direct mode: fetch preview ID and initialize snapshot from Master settings
          if (mounted) {
            setHeaderTitle(masterDefaultHeader);
            setRemarks(masterDefaultNote);
            setTermsAndConditions(masterDefaultTerms);
            const d = new Date();
            d.setDate(d.getDate() + masterValidityDays);
            setValidUntilDate(d.toISOString().split('T')[0]);
          }
          const idRes = await apiFetch(apiUrl('/api/enquiries/quotations/next-id'), { headers: authHeaders(user) }).catch(() => null);
          if (idRes && idRes.ok) {
            const idData = await idRes.json();
            if (idData.success && idData.nextQuotationId && mounted) {
              setQuotationNumber(idData.nextQuotationId);
            }
          }
        }

        // Check and restore draft state if returning from Customer Profile or page reload
        try {
          const draftKey = `asicrm_quotation_draft_${propEnquiryId || propQuotationId || 'direct'}`;
          let rawDraft = sessionStorage.getItem(draftKey);
          if (!rawDraft) {
            rawDraft = sessionStorage.getItem('asicrm_quotation_draft_latest');
          }
          let restoredItems = [];
          if (rawDraft) {
            const draft = JSON.parse(rawDraft);
            if (draft && mounted) {
              const draftShowDiscount = Boolean(draft.showDiscount);
              const draftRoundOff = Boolean(draft.roundOffTotal);
              if (draft.showDiscount !== undefined) setShowDiscount(draftShowDiscount);
              if (draft.roundOffTotal !== undefined) setRoundOffTotal(draftRoundOff);
              if (draft.showStock !== undefined) setShowStock(Boolean(draft.showStock));
              if (Array.isArray(draft.lineItems) && draft.lineItems.length > 0) {
                restoredItems = mapToLineItems(draft.lineItems, { showDiscount: draftShowDiscount, stockProducts: loadedStockProducts });
                setLineItems(restoredItems);
              }
              if (typeof draft.remarks === 'string') {
                setRemarks(draft.remarks);
              }
              if (typeof draft.termsAndConditions === 'string') {
                setTermsAndConditions(draft.termsAndConditions);
              }
              if (typeof draft.headerTitle === 'string') {
                setHeaderTitle(draft.headerTitle);
              }
              if (draft.validUntilDate) {
                setValidUntilDate(draft.validUntilDate);
              }
              if (mode === 'direct') {
                if (draft.selectedCustomerId) {
                  setSelectedCustomerId(draft.selectedCustomerId);
                  if (draft.selectedCustomer) {
                    setSelectedCustomer(draft.selectedCustomer);
                  } else {
                    const matched = loadedCustomers.find((c) => c.id === draft.selectedCustomerId);
                    if (matched) setSelectedCustomer(matched);
                  }
                }
                if (draft.selectedEnquiryId) {
                  setSelectedEnquiryId(draft.selectedEnquiryId);
                }
              }
            }
          }

          // Check if returning from Add Product to Master navigation flow
          const newlyCreatedId = sessionStorage.getItem('asicrm_newly_created_product_id');
          const rawUpdatedPayload = sessionStorage.getItem('asicrm_updated_product_payload');
          if ((newlyCreatedId || rawUpdatedPayload) && mounted) {
            sessionStorage.removeItem('asicrm_newly_created_product_id');
            sessionStorage.removeItem('asicrm_updated_product_payload');
            const targetRowId = sessionStorage.getItem('asicrm_target_row_id');
            sessionStorage.removeItem('asicrm_target_row_id');
            sessionStorage.removeItem('asicrm_product_preload');

            let newProd = null;
            try {
              if (rawUpdatedPayload) newProd = JSON.parse(rawUpdatedPayload);
            } catch (e) {}

            let currentStockList = loadedStockProducts;
            if (!newProd && newlyCreatedId) {
              newProd = (currentStockList || []).find((p) =>
                (p.id && String(p.id).toLowerCase() === String(newlyCreatedId).toLowerCase()) ||
                (p.productId && String(p.productId).toLowerCase() === String(newlyCreatedId).toLowerCase()) ||
                (p.code && String(p.code).toLowerCase() === String(newlyCreatedId).toLowerCase())
              );
            }

            if (!newProd) {
              try {
                const freshRes = await apiFetch(apiUrl('/api/stocks'), { headers: authHeaders(user) });
                if (freshRes && freshRes.ok) {
                  const fData = await freshRes.json();
                  const freshList = Array.isArray(fData.data) ? fData.data : (fData.data?.products || []);
                  currentStockList = freshList;
                  setStockProducts(freshList);
                  newProd = freshList.find((p) =>
                    (p.id && String(p.id).toLowerCase() === String(newlyCreatedId).toLowerCase()) ||
                    (p.productId && String(p.productId).toLowerCase() === String(newlyCreatedId).toLowerCase()) ||
                    (p.code && String(p.code).toLowerCase() === String(newlyCreatedId).toLowerCase())
                  );
                }
              } catch (e) {}
            }

            if (newProd) {
              // Immediately update stockProducts state with authoritative updated product
              setStockProducts((prevList) => {
                const nextList = [...prevList];
                const pId = newProd.id || newProd.productId;
                const pCode = newProd.code;
                const idx = nextList.findIndex((p) =>
                  (pId && (p.id === pId || p.productId === pId)) ||
                  (pCode && p.code && p.code.toUpperCase() === pCode.toUpperCase())
                );
                if (idx >= 0) {
                  nextList[idx] = { ...nextList[idx], ...newProd };
                } else {
                  nextList.unshift(newProd);
                }
                return nextList;
              });

              const canonicalId = newProd.id || newProd.productId || newProd.code;
              const maxStock = getProductAvailableStock(newProd);
              const defaultQty = 1;
              const masterMrp = Number(newProd.mrp || 0);
              const masterDealerPrice = Number(newProd.dealerPrice || newProd.price || newProd.unitPrice || newProd.sellingPrice || newProd.cost || 0);
              const masterPrice = masterMrp > 0 ? masterMrp : masterDealerPrice;
              const minPrice = masterDealerPrice > 0 ? masterDealerPrice : (masterMrp > 0 ? masterMrp : 0);
              const gst = Number(newProd.gstRate !== undefined ? newProd.gstRate : (newProd.gst !== undefined ? newProd.gst : 18));
              const desc = newProd.description ? String(newProd.description) : '';

              setLineItems((prev) => {
                const baseList = (prev && prev.length > 0) ? prev : (restoredItems.length > 0 ? restoredItems : [createBlankRow()]);
                const copy = [...baseList];
                let targetIndex = -1;
                if (targetRowId) {
                  targetIndex = copy.findIndex((it) => it.rowId === targetRowId);
                }
                if (targetIndex < 0) {
                  targetIndex = copy.findIndex((it) => !it.productId && !it.productName);
                }

                let updatedAny = false;
                for (let i = 0; i < copy.length; i++) {
                  if (copy[i].productId === canonicalId || (newProd.code && copy[i].productCode === newProd.code)) {
                    const rowQty = copy[i].quantity !== '' && copy[i].quantity !== undefined ? copy[i].quantity : defaultQty;
                    copy[i] = calculateLineItem({
                      ...copy[i],
                      productId: canonicalId,
                      productCode: newProd.code || copy[i].productCode || '',
                      productName: newProd.name || copy[i].productName || '',
                      description: desc || copy[i].description || '',
                      stock: maxStock,
                      availableStock: maxStock,
                      unit: (newProd.unit && newProd.unit !== 'Piece') ? newProd.unit : ((copy[i].unit && copy[i].unit !== 'Piece') ? copy[i].unit : 'Nos'),
                      quantity: rowQty,
                      unitPrice: masterPrice,
                      minPrice: minPrice,
                      mrp: masterMrp,
                      dealerPrice: masterDealerPrice,
                      cost: Number(newProd.cost || 0),
                      gst,
                      isIGSTApplicable: Boolean(newProd.isIGSTApplicable)
                    }, { showDiscount });
                    copy[i].minPrice = minPrice;
                    copy[i].mrp = masterMrp;
                    copy[i].dealerPrice = masterDealerPrice;
                    copy[i].stock = maxStock;
                    copy[i].availableStock = maxStock;
                    updatedAny = true;
                  }
                }

                if (!updatedAny) {
                  const newRow = calculateLineItem({
                    rowId: targetIndex >= 0 ? copy[targetIndex].rowId : generateRowId(),
                    productId: canonicalId,
                    productCode: newProd.code || newProd.productCode || '',
                    productName: newProd.name || newProd.productName || '',
                    description: desc,
                    stock: maxStock,
                    availableStock: maxStock,
                    unit: (newProd.unit && newProd.unit !== 'Piece') ? newProd.unit : 'Nos',
                    quantity: defaultQty,
                    unitPrice: masterPrice,
                    minPrice: minPrice,
                    mrp: masterMrp,
                    dealerPrice: masterDealerPrice,
                    cost: Number(newProd.cost || 0),
                    discount: 0,
                    gst,
                    isIGSTApplicable: Boolean(newProd.isIGSTApplicable)
                  }, { showDiscount });
                  newRow.minPrice = minPrice;
                  newRow.mrp = masterMrp;
                  newRow.dealerPrice = masterDealerPrice;
                  newRow.stock = maxStock;
                  newRow.availableStock = maxStock;

                  if (targetIndex >= 0) {
                    copy[targetIndex] = newRow;
                  } else {
                    copy.push(newRow);
                  }
                }
                return ensureTrailingBlankRow(copy);
              });
              setSuccess(`Product ${newProd.code || ''} — ${newProd.name || ''} updated and synced in quotation.`);
            }
          }
        } catch (e) {
          console.warn('Failed to restore quotation draft:', e);
        }
      } catch (err) {
        if (mounted) {
          console.error('QuotationEditor initialization error:', err);
          setError(err.message || 'Failed to initialize quotation editor.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initialize();
    return () => {
      mounted = false;
    };
  }, [mode, propEnquiryId, propQuotationId, user?.id]);

  // Customer branches and conditional branch/enquiry logic
  const customerBranches = useMemo(() => {
    return Array.isArray(selectedCustomer?.branches) ? selectedCustomer.branches : [];
  }, [selectedCustomer]);

  const hasMultipleBranches = customerBranches.length > 1;

  // Open enquiries belonging to the selected customer & selected branch
  // (If multiple branches: available ONLY after branch is selected; if 0 or 1 branch: available directly)
  const customerEnquiries = useMemo(() => {
    if (!selectedCustomerId) return [];
    if (hasMultipleBranches) {
      if (!selectedBranchId) return [];
      return allEnquiries.filter((e) => {
        if (e.customerId !== selectedCustomerId) return false;
        if (e.status === 'CLOSED' || e.status === 'CASE_CLOSED') return false;
        if (e.branchId && e.branchId !== selectedBranchId) return false;
        return true;
      });
    }
    return allEnquiries.filter((e) => {
      if (e.customerId !== selectedCustomerId) return false;
      if (e.status === 'CLOSED' || e.status === 'CASE_CLOSED') return false;
      return true;
    });
  }, [allEnquiries, selectedCustomerId, hasMultipleBranches, selectedBranchId]);

  // Handle customer selection in direct mode
  const handleSelectCustomer = (id, customer) => {
    setSelectedCustomerId(id || '');
    setSelectedCustomer(customer || null);
    const branches = Array.isArray(customer?.branches) ? customer.branches : [];
    if (branches.length === 1) {
      setSelectedBranchId(branches[0].id || branches[0]._id || branches[0].branchName || '');
    } else if (selectedBranchId && branches.some((b) => (b.id || b._id || b.branchName) === selectedBranchId)) {
      // preserve current valid branch if customer has that branch
    } else {
      setSelectedBranchId('');
    }
    setSelectedEnquiryId('');
    setError('');
  };

  // Handle new customer created via modal in direct mode
  const handleCustomerCreated = (newCust) => {
    if (newCust && newCust.id) {
      setSelectedCustomerId(newCust.id);
      setSelectedCustomer(newCust);
      const branches = Array.isArray(newCust?.branches) ? newCust.branches : [];
      if (branches.length === 1) {
        setSelectedBranchId(branches[0].id || branches[0]._id || branches[0].branchName || '');
      } else {
        setSelectedBranchId('');
      }
      setSelectedEnquiryId('');
      setCustomersList((prev) => [newCust, ...prev.filter((c) => c.id !== newCust.id)]);
      setIsCustomerModalOpen(false);
    }
  };

  const handleAddProductToMaster = (rowId = null) => {
    let targetRow = null;
    if (rowId) {
      targetRow = lineItems.find((it) => it.rowId === rowId);
    }
    // When called from the top "+ Add Product" button (rowId === null),
    // targetRow remains null so it opens a clean, fresh product form with no connection to existing table rows.

    const preload = {};
    if (targetRow) {
      // 1. If an existing product is selected in the row (e.g. Dahua 5MP IR Bullet Camera)
      const matched = targetRow.productId
        ? (stockProducts || []).find((p) =>
            p.id === targetRow.productId ||
            p.productId === targetRow.productId ||
            p.code === targetRow.productId
          )
        : null;

      if (matched) {
        preload.isExisting = true;
        if (matched.id) preload.id = matched.id;
        if (matched.code) preload.code = matched.code;
        if (matched.name) preload.name = matched.name;
        if (matched.description) preload.description = matched.description;
        if (matched.hsnSac) preload.hsnSac = matched.hsnSac;
        if (matched.categoryId) preload.categoryId = matched.categoryId;
        if (matched.subcategoryId) preload.subcategoryId = matched.subcategoryId;
        if (matched.brandId) preload.brandId = matched.brandId;
        if (matched.unit) preload.unit = matched.unit;
        if (matched.size != null && matched.size !== '') preload.size = String(matched.size);
        if (matched.cost != null) preload.cost = String(matched.cost);
        if (matched.dealerPercentage != null) preload.dealerPercentage = String(matched.dealerPercentage);
        if (matched.dealerPrice != null) preload.dealerPrice = String(matched.dealerPrice);
        if (matched.mrpPercentage != null) preload.mrpPercentage = String(matched.mrpPercentage);
        if (matched.mrp != null) preload.mrp = String(matched.mrp);
        if (matched.gst != null) preload.gst = String(matched.gst);
        if (matched.stock != null) preload.stock = String(matched.stock);
        else if (matched.currentStock != null) preload.stock = String(matched.currentStock);
        if (matched.alertQuantity != null) preload.alertQuantity = String(matched.alertQuantity);
        if (matched.serialized !== undefined) preload.serialized = Boolean(matched.serialized);
        if (matched.isIGSTApplicable !== undefined) preload.isIGSTApplicable = Boolean(matched.isIGSTApplicable);
      }

      // 2. Override with any row-level edits or custom data the user entered in the quotation
      if (targetRow.productId && !preload.id) {
        preload.id = targetRow.productId;
      }
      if (targetRow.productCode && (!matched || targetRow.productCode !== matched.code)) {
        preload.code = targetRow.productCode;
      }
      if (targetRow.productName && (!matched || targetRow.productName !== matched.name)) {
        preload.name = targetRow.productName;
      }
      if (targetRow.description) {
        preload.description = targetRow.description;
      }
      if (targetRow.hsnSac) {
        preload.hsnSac = targetRow.hsnSac;
      }
      if (targetRow.unit) {
        preload.unit = targetRow.unit;
      }
      if ((!matched || matched.cost == null || matched.cost === '') && targetRow.unitPrice) {
        preload.cost = String(targetRow.unitPrice);
      }
      if ((!matched || matched.dealerPrice == null || matched.dealerPrice === '') && targetRow.unitPrice) {
        preload.dealerPrice = String(targetRow.unitPrice);
      }
      if (targetRow.gstRate && (!matched || Number(targetRow.gstRate) !== Number(matched.gst))) {
        preload.gst = String(targetRow.gstRate);
      }
      if (targetRow.isIGSTApplicable !== undefined) {
        preload.isIGSTApplicable = Boolean(targetRow.isIGSTApplicable);
      }
    }

    // 1. Explicitly persist current quotation draft
    try {
      const draftKey = `asicrm_quotation_draft_${propEnquiryId || propQuotationId || 'direct'}`;
      const draftData = {
        mode,
        propEnquiryId: propEnquiryId || '',
        propQuotationId: propQuotationId || '',
        selectedCustomerId,
        selectedCustomer,
        selectedEnquiryId,
        lineItems,
        remarks,
        termsAndConditions,
        headerTitle,
        validUntilDate,
        quotationNumber,
        showDiscount,
        roundOffTotal,
        showStock,
        timestamp: Date.now()
      };
      sessionStorage.setItem(draftKey, JSON.stringify(draftData));
      sessionStorage.setItem('asicrm_quotation_draft_latest', JSON.stringify(draftData));

      if (Object.keys(preload).length > 0) {
        sessionStorage.setItem('asicrm_product_preload', JSON.stringify(preload));
      } else {
        sessionStorage.removeItem('asicrm_product_preload');
      }

      if (rowId || targetRow?.rowId) {
        sessionStorage.setItem('asicrm_target_row_id', rowId || targetRow.rowId);
      } else {
        sessionStorage.removeItem('asicrm_target_row_id');
      }
    } catch (e) {
      console.warn('Failed to save quotation draft before navigating to Add Product:', e);
    }

    // 2. Set origin and return URL
    const returnPath = window.location.pathname + window.location.search;
    try {
      sessionStorage.setItem('asicrm_product_return', returnPath);
      sessionStorage.setItem('asicrm_product_from', 'quotation');
    } catch (e) {}

    // 3. Navigate to Product Master Add Product page
    navigate(`/stocks/products/new?from=quotation&returnTo=${encodeURIComponent(returnPath)}`);
  };

  const handleOpenAddProductModal = (rowId = null) => {
    handleAddProductToMaster(rowId);
  };

  // View customer profile with full quotation draft state preservation
  const handleViewCustomerProfile = (overrideCustId) => {
    const custId = overrideCustId || selectedCustomerId || enquiry?.customerId || selectedCustomer?.id;
    if (!custId) {
      if (selectedEnquiryId) setIsEnquiryDetailsModalOpen(true);
      return;
    }

    // Explicitly persist quotation draft before navigating
    try {
      const draftKey = `asicrm_quotation_draft_${propEnquiryId || propQuotationId || 'direct'}`;
      const draftData = {
        mode,
        propEnquiryId: propEnquiryId || '',
        propQuotationId: propQuotationId || '',
        selectedCustomerId: custId,
        selectedCustomer,
        selectedEnquiryId,
        lineItems,
        remarks,
        termsAndConditions,
        headerTitle,
        validUntilDate,
        quotationNumber,
        showDiscount,
        roundOffTotal,
        showStock,
        timestamp: Date.now()
      };
      sessionStorage.setItem(draftKey, JSON.stringify(draftData));
    } catch (e) {
      console.warn('Failed to save quotation draft before viewing profile:', e);
    }

    const navContext = {
      from: 'quotation',
      returnTo: window.location.pathname,
      enquiryId: selectedEnquiryId,
      quotationId: propQuotationId,
      customerId: custId
    };

    if (onNavigateCustomer) {
      onNavigateCustomer(custId, navContext);
    } else {
      navigate(`/customers/${encodeURIComponent(custId)}`, { state: navContext });
    }
  };

  // Auto-sync quotation draft to sessionStorage whenever line items, remarks, terms, dates, or customer change
  useEffect(() => {
    if (loading || isConverted) return;
    const hasItems = Array.isArray(lineItems) && lineItems.some(it => it.productId || it.productName);
    const hasRemarks = Boolean(remarks && remarks.trim());
    const hasTerms = Boolean(termsAndConditions && termsAndConditions.trim());
    const hasCust = Boolean(selectedCustomerId);

    if (hasItems || hasRemarks || hasTerms || hasCust) {
      try {
        const draftKey = `asicrm_quotation_draft_${propEnquiryId || propQuotationId || 'direct'}`;
        const draftData = {
          mode,
          propEnquiryId: propEnquiryId || '',
          propQuotationId: propQuotationId || '',
          selectedCustomerId,
          selectedCustomer,
          selectedEnquiryId,
          lineItems,
          remarks,
          termsAndConditions,
          headerTitle,
          validUntilDate,
          quotationNumber,
          showDiscount,
          roundOffTotal,
          showStock,
          timestamp: Date.now()
        };
        sessionStorage.setItem(draftKey, JSON.stringify(draftData));
      } catch (e) {}
    }
  }, [lineItems, remarks, termsAndConditions, headerTitle, validUntilDate, selectedCustomerId, selectedCustomer, selectedEnquiryId, mode, propEnquiryId, propQuotationId, quotationNumber, loading, isConverted, showDiscount, roundOffTotal, showStock]);

  // Line item manipulation
  const handleProductSelect = (rowId, productId, selectedItem = null) => {
    if (!productId) {
      setLineItems((prev) => {
        const updated = prev.map((item) => {
          if (item.rowId !== rowId) return item;
          return {
            ...item,
            productId: '',
            productCode: '',
            productName: '',
            description: '',
            stock: 0,
            unit: 'Nos',
            quantity: 1,
            unitPrice: 0,
            minPrice: 0,
            gst: 18,
            discount: 0,
            discountAmount: 0,
            taxableAmount: 0,
            lineSubtotal: 0,
            lineTax: 0,
            lineTotal: 0
          };
        });
        return ensureTrailingBlankRow(updated);
      });
      return;
    }

    const isCustom = selectedItem?.isCustom || String(productId).startsWith('custom_') || String(productId).startsWith('direct_');
    const prod = isCustom
      ? selectedItem
      : stockProducts.find(
          (p) => (p.id || p.productId) === productId || (p.code || p.productCode) === productId
        );

    const resolvedItem = prod || selectedItem;
    if (!resolvedItem) return;

    const canonicalId = resolvedItem.id || resolvedItem.productId || resolvedItem.code || productId;

    // Duplicate-product prevention: reject re-adding already-added products
    const isDuplicate = lineItems.some(
      (it) => it.rowId !== rowId && (
        it.productId === canonicalId ||
        (resolvedItem.id && it.productId === resolvedItem.id) ||
        (resolvedItem.productId && it.productId === resolvedItem.productId) ||
        (resolvedItem.code && it.productCode === resolvedItem.code) ||
        (resolvedItem.productCode && it.productCode === resolvedItem.productCode)
      )
    );

    if (isDuplicate) {
      setError('Product already added to this quotation.');
      if (typeof window !== 'undefined' && window.alert) {
        try { window.alert('Product already added to this quotation.'); } catch (e) {}
      }
      return;
    }

    const maxStock = isCustom ? 0 : getProductAvailableStock(resolvedItem);
    const masterStock = isCustom ? 0 : Number(
      resolvedItem.stock !== undefined
        ? resolvedItem.stock
        : (resolvedItem.totalStock !== undefined ? resolvedItem.totalStock : maxStock)
    );
    // Directly allow entering quantity in quotation - default to 1 (not 0, not blocked by stock)
    const defaultQty = 1;
    const qtyError = '';

    setLineItems((prev) => {
      const rowIndex = prev.findIndex((item) => item.rowId === rowId);
      if (rowIndex === -1) return prev;

      const currentItem = prev[rowIndex];
      const masterMrp = Number(resolvedItem.mrp || 0);
      const masterDealerPrice = Number(resolvedItem.dealerPrice || resolvedItem.price || resolvedItem.unitPrice || resolvedItem.sellingPrice || resolvedItem.cost || 0);
      // Default price MUST be MRP if available, with Dealer Price as minimum floor
      const unitPrice = masterMrp > 0 ? masterMrp : (masterDealerPrice > 0 ? masterDealerPrice : 0);
      const minPrice = masterDealerPrice > 0 ? masterDealerPrice : (masterMrp > 0 ? masterMrp : 0);
      const gst = Number(resolvedItem.gstRate !== undefined ? resolvedItem.gstRate : (resolvedItem.gst !== undefined ? resolvedItem.gst : 18));
      const discount = Number(currentItem?.discount || 0);
      const desc = resolvedItem.description ? String(resolvedItem.description) : '';

      const updatedRow = {
        ...currentItem,
        productId: canonicalId,
        productCode: resolvedItem.code || resolvedItem.productCode || (isCustom ? 'CUSTOM' : ''),
        productName: resolvedItem.name || resolvedItem.productName || '',
        description: desc,
        stock: masterStock,
        availableStock: Number(resolvedItem.availableStock !== undefined ? resolvedItem.availableStock : masterStock),
        unit: (resolvedItem.unit && resolvedItem.unit !== 'Piece') ? resolvedItem.unit : 'Nos',
        quantity: defaultQty,
        unitPrice,
        minPrice,
        mrp: masterMrp,
        dealerPrice: masterDealerPrice,
        gst,
        isIGSTApplicable: Boolean(resolvedItem.isIGSTApplicable),
        discount,
        hsnSac: resolvedItem.hsnSac || resolvedItem.hsnCode || resolvedItem.hsn || '',
        qtyError: '',
        hasHistoricalStockWarning: false,
        isCustom: Boolean(isCustom)
      };

      const calculated = calculateLineItem(updatedRow, { showDiscount });

      const copy = [...prev];
      copy[rowIndex] = { ...calculated, isIGSTApplicable: Boolean(resolvedItem.isIGSTApplicable), stock: masterStock, availableStock: Number(resolvedItem.availableStock !== undefined ? resolvedItem.availableStock : masterStock), qtyError: '', hasHistoricalStockWarning: false };

      return ensureTrailingBlankRow(copy);
    });
    setError('');
  };

  const handleDescriptionChange = (rowId, descVal) => {
    setLineItems((prev) => {
      return prev.map((item) => {
        if (item.rowId !== rowId) return item;
        return {
          ...item,
          description: descVal
        };
      });
    });
  };

  const handleQtyChange = (rowId, qtyVal) => {
    setLineItems((prev) => {
      return prev.map((item) => {
        if (item.rowId !== rowId) return item;

        // If empty / cleared while typing
        if (qtyVal === '' || qtyVal === null || qtyVal === undefined) {
          return {
            ...item,
            quantity: '',
            qtyError: 'Please enter a valid quantity.'
          };
        }

        const parsedQty = parseInt(qtyVal, 10);
        let qtyError = '';
        if (isNaN(parsedQty) || parsedQty <= 0) {
          qtyError = 'Quantity must be at least 1.';
        }

        const calcQty = (!isNaN(parsedQty) && parsedQty > 0) ? parsedQty : 0;
        const calculated = calculateLineItem({
          ...item,
          quantity: calcQty
        }, { showDiscount });

        return {
          ...calculated,
          quantity: isNaN(parsedQty) ? '' : parsedQty,
          qtyError,
          hasHistoricalStockWarning: false
        };
      });
    });
  };

  const handlePriceChange = (rowId, priceVal) => {
    let rawValue = priceVal;
    let calcPrice = 0;
    if (priceVal !== '' && priceVal !== null && priceVal !== undefined) {
      const parsed = parseFloat(priceVal);
      if (!isNaN(parsed)) {
        calcPrice = Math.max(0, parsed);
        rawValue = priceVal;
      }
    } else {
      rawValue = '';
      calcPrice = 0;
    }

    setLineItems((prev) => {
      return prev.map((item) => {
        if (item.rowId !== rowId) return item;
        const calculated = calculateLineItem({ ...item, unitPrice: calcPrice }, { showDiscount });
        return {
          ...calculated,
          unitPrice: rawValue
        };
      });
    });
  };

  const handleDiscountChange = (rowId, discountVal) => {
    const discount = Math.max(0, Math.min(100, parseFloat(discountVal) || 0));
    setLineItems((prev) => {
      return prev.map((item) => {
        if (item.rowId !== rowId) return item;
        return calculateLineItem({ ...item, discount }, { showDiscount });
      });
    });
  };

  const handleGstChange = (rowId, gstVal) => {
    const gst = Math.max(0, Math.min(100, parseFloat(gstVal) || 0));
    setLineItems((prev) => {
      return prev.map((item) => {
        if (item.rowId !== rowId) return item;
        return calculateLineItem({ ...item, gst }, { showDiscount });
      });
    });
  };

  const handleToggleInstallationCharges = (checked) => {
    setIncludeInstallationCharges(checked);
    setLineItems((prev) => {
      if (checked) {
        const exists = prev.some((it) => it.isInstallationCharge || it.productName === INSTALLATION_CHARGE_NAME);
        if (exists) return prev;
        return [...prev, createInstallationChargeRow()];
      } else {
        const filtered = prev.filter((it) => !it.isInstallationCharge && it.productName !== INSTALLATION_CHARGE_NAME);
        return filtered.length === 0 ? [createBlankRow()] : filtered;
      }
    });
  };

  const handleToggleShowDiscount = (checked) => {
    setShowDiscount(checked);
    setLineItems((prev) => prev.map((it) => calculateLineItem(it, { showDiscount: checked })));
  };

  const handleToggleRoundOff = (checked) => {
    setRoundOffTotal(checked);
  };

  const handleToggleShowStock = (checked) => {
    setShowStock(checked);
  };

  const handleAddRow = () => {
    setLineItems((prev) => {
      const installIdx = prev.findIndex((it) => it.isInstallationCharge || it.productName === INSTALLATION_CHARGE_NAME);
      const copy = [...prev];
      if (installIdx !== -1) {
        copy.splice(installIdx, 0, createBlankRow());
        return copy;
      }
      const last = prev[prev.length - 1];
      if (last && !last.productId && !last.productName && !last.isInstallationCharge) {
        return prev;
      }
      return [...prev, createBlankRow()];
    });
  };

  const handleDeleteRow = (rowId) => {
    setLineItems((prev) => {
      const target = prev.find((item) => item.rowId === rowId);
      let currentInclude = includeInstallationCharges;
      if (target?.isInstallationCharge || target?.productName === INSTALLATION_CHARGE_NAME) {
        setIncludeInstallationCharges(false);
        currentInclude = false;
      }
      const remaining = prev.filter((item) => item.rowId !== rowId);
      return ensureTrailingBlankRow(remaining, currentInclude);
    });
  };

  // Top Product Add Handler
  const handleTopAddProduct = () => {
    if (!selectedTopProduct) return;
    const prod = stockProducts.find(
      (p) => (p.id || p.productId) === selectedTopProduct || p.productCode === selectedTopProduct
    );
    if (!prod) return;

    const canonicalId = prod.id || prod.productId || prod.code;
    const isDuplicate = lineItems.some(
      (it) => it.productId === canonicalId ||
        it.productId === prod.id ||
        it.productId === prod.productId ||
        it.productId === prod.code ||
        (it.productCode && prod.code && it.productCode === prod.code)
    );

    if (isDuplicate) {
      setError('This product is already added to the quotation.');
      return;
    }

    const maxStock = getProductAvailableStock(prod);
    const qty = 1;
    const qtyError = '';
    const masterMrp = Number(prod.mrp || 0);
    const masterDealerPrice = Number(prod.dealerPrice || prod.price || prod.unitPrice || prod.sellingPrice || prod.cost || 0);
    const price = masterMrp > 0 ? masterMrp : masterDealerPrice;
    const minPrice = masterDealerPrice > 0 ? masterDealerPrice : (masterMrp > 0 ? masterMrp : 0);
    const gst = Number(prod.gstRate !== undefined ? prod.gstRate : (prod.gst !== undefined ? prod.gst : 18));
    const desc = prod.description ? String(prod.description) : '';

    const newItem = {
      ...calculateLineItem({
        rowId: generateRowId(),
        productId: prod.id || prod.productId || prod.code,
        productCode: prod.productCode || prod.sku || '',
        productName: prod.name || prod.productName || '',
        description: desc,
        stock: maxStock,
        availableStock: maxStock,
        unit: (prod.unit && prod.unit !== 'Piece') ? prod.unit : 'Nos',
        quantity: qty,
        unitPrice: price,
        minPrice,
        mrp: masterMrp,
        dealerPrice: masterDealerPrice,
        discount: 0,
        gst,
        isIGSTApplicable: Boolean(prod.isIGSTApplicable)
      }, { showDiscount }),
      stock: maxStock,
      availableStock: maxStock,
      isIGSTApplicable: Boolean(prod.isIGSTApplicable),
      qtyError: ''
    };

    setLineItems((prev) => {
      const nonBlankItems = prev.filter((it) => it.productId || it.productName);
      return ensureTrailingBlankRow([...nonBlankItems, newItem]);
    });
    setSelectedTopProduct('');
    setError('');
  };

  // Grand totals computation using canonical engine
  const totals = useMemo(() => {
    return calculateQuotationTotals(lineItems, { showDiscount, roundOffTotal });
  }, [lineItems, showDiscount, roundOffTotal]);

  // View Model Snapshot for Official Quotation Print/PDF
  const quotationPrintData = useMemo(() => {
    return {
      quotationId: quotationNumber,
      quotationNumber: quotationNumber,
      createdAt: quotationDate,
      quotationDate: quotationDate,
      status: quotationStatus,
      validUntil: validUntilDate,
      customer: selectedCustomer,
      customerName: selectedCustomer?.name || '',
      customerCompany: selectedCustomer?.company || '',
      shippingAddress: selectedCustomer?.shippingAddress || selectedCustomer?.address || '',
      customerCity: selectedCustomer?.city || '',
      customerState: selectedCustomer?.state || '',
      customerPincode: selectedCustomer?.pincode || '',
      subject: enquiry?.requirement || enquiry?.title || (!/prices\s+quoted\s+are\s+valid|taxes\s+extra/i.test(String(remarks || '')) ? remarks : '') || (lineItems[0]?.productName ? `Proposal for ${lineItems[0].productName}` : 'Proposal for Commercial Offer'),
      showDiscount,
      roundOffTotal,
      showStock,
      items: lineItems.filter((it) => it.productId || it.productName).map((it) => ({
        productId: it.productId,
        productCode: it.productCode,
        productName: it.productName,
        hsnSac: it.hsnSac || it.hsnCode || it.hsn || '',
        description: it.description || '',
        unit: (it.unit && it.unit !== 'Piece') ? it.unit : 'Nos',
        quantity: Number(it.quantity || 1),
        unitPrice: Number(it.unitPrice || 0),
        minPrice: Number(it.minPrice || 0),
        discount: Number(it.discount || 0),
        discountAmount: Number(it.discountAmount || 0),
        taxableAmount: Number(it.taxableAmount || 0),
        gst: Number(it.gst !== undefined ? it.gst : 18),
        isIGSTApplicable: Boolean(it.isIGSTApplicable),
        lineSubtotal: Number(it.lineSubtotal || 0),
        lineTax: Number(it.lineTax || 0),
        lineTotal: Number(it.lineTotal || 0)
      })),
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxableTotal: totals.taxableTotal,
      gstTotal: totals.gstTotal,
      calculatedTotal: totals.calculatedTotal,
      roundOff: totals.roundOff,
      grandTotal: totals.grandTotal,
      remarks: remarks,
      notes: remarks,
      termsAndConditions: termsAndConditions,
      terms: termsAndConditions,
      headerTitle: headerTitle || 'QUOTATION'
    };
  }, [quotationNumber, quotationDate, quotationStatus, validUntilDate, selectedCustomer, enquiry, remarks, termsAndConditions, headerTitle, lineItems, totals, showDiscount, roundOffTotal, showStock]);

  // Back Navigation
  const handleBack = () => {
    try {
      const draftKey = `asicrm_quotation_draft_${propEnquiryId || propQuotationId || 'direct'}`;
      sessionStorage.removeItem(draftKey);
    } catch {}
    if (mode === 'enquiry' && propEnquiryId && !isSaved) {
      if (onBackToFollowUp) onBackToFollowUp();
      else navigate(`/enquiries/${encodeURIComponent(propEnquiryId)}/followup`);
    } else {
      if (onClosed) onClosed();
      else navigate('/quotations');
    }
  };

  // Accept quotation (customer approved)
  const handleAcceptQuotation = async () => {
    if (!quotationNumber || quotationNumber === 'QT-......') return;
    if (!canApproveQuotation) {
      setError('You do not have permission to accept quotations.');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      const res = await apiFetch(apiUrl(`/api/enquiries/quotation/${encodeURIComponent(quotationNumber)}/status`), {
        method: 'PATCH',
        headers: authHeaders(user),
        body: JSON.stringify({ status: 'ACCEPTED' })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to accept quotation.');
      }
      setQuotationStatus('ACCEPTED');
      setSuccess(`Quotation ${quotationNumber} accepted successfully! PDF and Order conversion are now available.`);
    } catch (err) {
      console.error('Accept quotation error:', err);
      setError(err.message || 'Failed to accept quotation.');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject quotation
  const handleRejectQuotation = async () => {
    if (!quotationNumber || quotationNumber === 'QT-......') return;
    if (!canRejectQuotation) {
      setError('You do not have permission to reject quotations.');
      return;
    }
    const reason = window.prompt(`Enter reason for rejecting quotation ${quotationNumber}:`, 'Customer declined proposal');
    if (!reason || !reason.trim()) return;

    setActionLoading(true);
    setError('');
    try {
      const res = await apiFetch(apiUrl(`/api/enquiries/quotation/${encodeURIComponent(quotationNumber)}/status`), {
        method: 'PATCH',
        headers: authHeaders(user),
        body: JSON.stringify({ status: 'REJECTED', remarks: reason.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to reject quotation.');
      }
      setQuotationStatus('REJECTED');
      setSuccess(`Quotation ${quotationNumber} has been rejected.`);
    } catch (err) {
      console.error('Reject quotation error:', err);
      setError(err.message || 'Failed to reject quotation.');
    } finally {
      setActionLoading(false);
    }
  };

  // Convert to Order
  const handleConvertToOrder = async () => {
    if (!quotationNumber || quotationNumber === 'QT-......') return;
    if (quotationStatus !== 'ACCEPTED' && quotationStatus !== 'CONFIRMED') {
      alert(`Quotation must be ACCEPTED before converting to an order. Current status: ${quotationStatus}`);
      return;
    }
    if (!window.confirm(`Convert quotation ${quotationNumber} into a Sales Order? This will reserve order stock and finalize the sale.`)) return;

    setActionLoading(true);
    setError('');
    try {
      const res = await apiFetch(apiUrl(`/api/orders/from-quotation/${encodeURIComponent(quotationNumber)}`), {
        method: 'POST',
        headers: authHeaders(user),
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to convert quotation to order.');
      }
      const createdOrder = data.data;
      const createdOrderId = createdOrder?.orderId || data.quotation?.orderId;
      setQuotationStatus('CONVERTED');
      if (createdOrderId) setOrderId(createdOrderId);
      setSuccess(`Quotation ${quotationNumber} successfully converted to Order ${createdOrderId || ''}!`);
    } catch (err) {
      console.error('Convert quotation error:', err);
      setError(err.message || 'Failed to convert quotation to order.');
    } finally {
      setActionLoading(false);
    }
  };

  // Comprehensive stock & quantity validation helper
  const validateQuotationRows = (actionDesc = 'issuing') => {
    if (!selectedCustomerId) {
      setError(`Please select a Customer / Consignee before ${actionDesc} quotation.`);
      return false;
    }

    const validProductItems = lineItems.filter((it) => it.productId && it.productName && !it.isInstallationCharge && it.productName !== INSTALLATION_CHARGE_NAME);
    if (validProductItems.length === 0) {
      setError('At least one valid product from Stocks Master is required.');
      return false;
    }

    const validItems = lineItems.filter((it) => (it.productId || it.isInstallationCharge) && it.productName);

    const seenProductKeys = new Set();
    const aggregatedQuantities = new Map();

    for (const it of validItems) {
      if (it.isInstallationCharge || it.productName === INSTALLATION_CHARGE_NAME) {
        if (it.unitPrice !== '' && it.unitPrice !== undefined && Number(it.unitPrice) < 0) {
          setError('Installation Testing & Commissioning Charges price must be greater than or equal to zero.');
          return false;
        }
        continue;
      }

      const key = String(it.productId || it.productCode).toLowerCase();
      if (seenProductKeys.has(key)) {
        setError(`Product "${it.productName}" is already added to the quotation.`);
        return false;
      }
      seenProductKeys.add(key);

      const numQty = Number(it.quantity);
      if (!it.quantity || isNaN(numQty) || numQty <= 0) {
        setError(`Please enter a valid quantity greater than zero for "${it.productName}".`);
        return false;
      }
      if (it.qtyError) {
        setError(`${it.productName}: ${it.qtyError}`);
        return false;
      }
      if (it.unitPrice === '' || it.unitPrice === undefined || it.unitPrice === null || Number(it.unitPrice) <= 0) {
        setError(`Please enter a valid quotation price greater than zero for "${it.productName}".`);
        return false;
      }
      const floorPrice = getProductConfiguredFloorPrice(it, stockProducts);
      if (floorPrice > 0 && Number(it.unitPrice) < floorPrice) {
        const fmtMin = Number(floorPrice % 1 === 0 ? floorPrice : floorPrice.toFixed(2)).toLocaleString('en-IN');
        setError(`Cannot ${actionDesc} quotation. "${it.productName}" quotation price (₹${Number(it.unitPrice).toLocaleString('en-IN')}) cannot be below dealer price of ₹${fmtMin}.`);
        return false;
      }
    }
    return true;
  };

  const hasLineItemErrors = useMemo(() => {
    const validItems = lineItems.filter((it) => it.productId && it.productName && !it.isInstallationCharge && it.productName !== INSTALLATION_CHARGE_NAME);
    if (validItems.length === 0) return true;
    for (const it of validItems) {
      const q = Number(it.quantity);
      if (!it.quantity || isNaN(q) || q <= 0 || it.qtyError) {
        return true;
      }
      const price = Number(it.unitPrice);
      if (isNaN(price) || price <= 0 || isPriceBelowConfigured(it, stockProducts)) {
        return true;
      }
    }
    return false;
  }, [lineItems, stockProducts]);

  const handleOpenPdfClick = () => {
    if (!isSaved || !quotationNumber || quotationNumber === 'QT-......') {
      setError('Please save the quotation before generating PDF.');
      return;
    }
    if (quotationStatus === 'REJECTED') {
      setError('Cannot generate PDF for a rejected quotation.');
      return;
    }
    if (!validateQuotationRows('generating PDF for')) return;
    setError('');
    setIsPdfModalOpen(true);
  };

  const handleGenerateProformaClick = () => {
    if (!isSaved || !quotationNumber || quotationNumber === 'QT-......') {
      setError('Please save the quotation before generating Proforma.');
      return;
    }
    if (quotationStatus === 'REJECTED') {
      setError('Cannot generate Proforma for a rejected quotation.');
      return;
    }
    if (!validateQuotationRows('generating Proforma from')) return;
    setError('');
    navigate(`/orders/proformas/new?quotationId=${encodeURIComponent(quotationNumber)}`);
  };

  // Save & Issue Quotation (with double submit protection)
  const handleSaveAndIssue = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');

    // Double submission prevention check
    if (isSubmittingRef.current || saving) return;

    if (!validateQuotationRows('issuing')) return;

    const validItems = lineItems.filter((it) => (it.productId || it.isInstallationCharge) && it.productName);

    if (!validUntilDate) {
      setError('Please specify a Valid Until date.');
      return;
    }

    isSubmittingRef.current = true;
    setSaving(true);

    try {
      const effectiveStatus = (isSaved && quotationStatus && quotationStatus !== 'READY_FOR_QUOTATION' && quotationStatus !== 'AWAITING_CUSTOMER')
        ? quotationStatus
        : 'PENDING';

      const payload = {
        customerId: selectedCustomerId,
        enquiryId: selectedEnquiryId || undefined,
        source: selectedEnquiryId ? 'ENQUIRY' : 'DIRECT',
        items: validItems.map((it) => ({
          productId: it.productId,
          productCode: it.productCode,
          productName: it.productName,
          description: it.description || '',
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice || 0),
          minPrice: it.minPrice || 0,
          discount: it.discount || 0,
          gst: it.gst || 18,
          isIGSTApplicable: Boolean(it.isIGSTApplicable),
          hsnSac: it.hsnSac || it.hsnCode || it.hsn || '',
          isInstallationCharge: Boolean(it.isInstallationCharge || it.productName === INSTALLATION_CHARGE_NAME)
        })),
        includeInstallationCharges,
        showDiscount,
        roundOffTotal,
        showStock,
        discountTotal: totals.discountTotal,
        taxableTotal: totals.taxableTotal,
        calculatedTotal: totals.calculatedTotal,
        roundOff: totals.roundOff,
        grandTotal: totals.grandTotal,
        validUntil: validUntilDate,
        remarks: remarks.trim(),
        additionalNotes: additionalNotes.trim(),
        termsAndConditions: (termsAndConditions || '').trim(),
        terms: (termsAndConditions || '').trim(),
        headerTitle: headerTitle || 'QUOTATION',
        status: effectiveStatus
      };

      let res;
      const effectiveQuotationId = persistedQuotationId || (mode === 'details' && propQuotationId ? propQuotationId : null);
      if (effectiveQuotationId) {
        // Update existing quotation
        res = await apiFetch(apiUrl(`/api/enquiries/quotation/${encodeURIComponent(effectiveQuotationId)}`), {
          method: 'PUT',
          headers: authHeaders(user),
          body: JSON.stringify(payload)
        });
      } else {
        // Create new quotation (Direct or Enquiry mode converge here)
        res = await apiFetch(apiUrl('/api/enquiries/quotations'), {
          method: 'POST',
          headers: authHeaders(user),
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to save quotation.');
      }

      const savedQuote = data.data;
      const savedId = savedQuote?.quotationId || quotationNumber;
      const savedStatus = (savedQuote?.status === 'AWAITING_CUSTOMER' ? 'PENDING' : savedQuote?.status) || 'PENDING';

      setPersistedQuotationId(savedId);
      setQuotationNumber(savedId);
      setQuotationStatus(savedStatus);
      if (savedQuote?.enquiryId) setSelectedEnquiryId(savedQuote.enquiryId);
      if (savedQuote?.orderId) setOrderId(savedQuote.orderId);

      setSuccess(`Quotation ${savedId} saved successfully. Status: ${savedStatus === 'PENDING' ? 'Pending' : savedStatus.replace(/_/g, ' ')}.`);
      try {
        const draftKey = `asicrm_quotation_draft_${propEnquiryId || propQuotationId || 'direct'}`;
        sessionStorage.removeItem(draftKey);
      } catch {}

      if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
        window.history.replaceState(null, '', `/quotations/${encodeURIComponent(savedId)}`);
      }
    } catch (err) {
      console.error('Save quotation error:', err);
      setError(err.message || 'Failed to save quotation.');
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="crm-panel-container" style={{ padding: '40px', textAlign: 'center' }}>
        <div className="crm-spinner" />
        <p style={{ marginTop: '12px', color: '#64748b' }}>Loading quotation workspace…</p>
      </div>
    );
  }

  const hasProducts = lineItems.some((it) => it.productId);

  return (
    <div className="quotation-workspace-page quotation-unified-editor">
      <div className="quotation-editor-card">
        {/* Header Bar */}
        <div className="quotation-header-bar">
          <div className="quotation-title-area">
            <h1 className="quotation-main-title">
              {isSaved ? `Quotation ${quotationNumber}` : 'Quotation'}
            </h1>
          </div>

          <div className="quotation-context-area">
            {selectedEnquiryId || mode === 'enquiry' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  className="status-badge badge-purple"
                  style={{ fontSize: '11px', padding: '3px 8px', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 700 }}
                >
                  ENQUIRY QUOTATION
                </span>
                {selectedEnquiryId && (
                  <button
                    type="button"
                    className="quotation-enquiry-badge-btn"
                    onClick={() => setIsEnquiryDetailsModalOpen(true)}
                    title="Click to view enquiry details"
                  >
                    <span>{selectedEnquiryId}</span>
                    <span className="enquiry-badge-info-icon">ⓘ</span>
                  </button>
                )}
                {isSaved ? (
                  <span
                    className={`status-badge ${
                      isConverted || isAccepted
                        ? 'badge-green'
                        : quotationStatus === 'REJECTED'
                        ? 'badge-red'
                        : 'badge-purple'
                    }`}
                    style={{ fontSize: '11px', padding: '3px 8px', fontWeight: 700 }}
                  >
                    {isConverted ? 'CONVERTED' : isAccepted ? 'ACCEPTED' : quotationStatus === 'REJECTED' ? 'REJECTED' : 'PENDING'}
                  </span>
                ) : (
                  <span
                    className="status-badge badge-gray"
                    style={{ fontSize: '11px', padding: '3px 8px', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 700 }}
                  >
                    NEW
                  </span>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span
                  className="status-badge badge-blue"
                  style={{ fontSize: '11px', padding: '3px 8px', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 700 }}
                >
                  DIRECT QUOTATION
                </span>
                {isSaved ? (
                  <span
                    className={`status-badge ${
                      isConverted || isAccepted
                        ? 'badge-green'
                        : quotationStatus === 'REJECTED'
                        ? 'badge-red'
                        : 'badge-purple'
                    }`}
                    style={{ fontSize: '11px', padding: '3px 8px', fontWeight: 700 }}
                  >
                    {isConverted ? 'CONVERTED' : isAccepted ? 'ACCEPTED' : quotationStatus === 'REJECTED' ? 'REJECTED' : 'PENDING'}
                  </span>
                ) : (
                  <span
                    className="status-badge badge-gray"
                    style={{ fontSize: '11px', padding: '3px 8px', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 700 }}
                  >
                    NEW
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Error and Success banners (only displayed when actual messages exist) */}
        {error && (
          <div className="crm-alert-box error" style={{ margin: '12px 20px 0', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '6px', fontSize: '13px' }}>
            {error}
          </div>
        )}
        {success && (
          <div className="crm-alert-box success" style={{ margin: '12px 20px 0', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', borderRadius: '6px', fontSize: '13px' }}>
            {success}
          </div>
        )}

        <div className="quotation-form">
          {/* Customer Row */}
          <div className="quotation-customer-row">
            {isContextMode ? (
              /* Enquiry or Details Mode: Fixed customer + Linked Enquiry on the right */
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customer:</span>
                      <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a' }}>
                        {selectedCustomer?.name || enquiry?.customerName || 'Customer'}
                        {(selectedCustomer?.company || enquiry?.customerCompany) && (
                          <span style={{ fontWeight: 400, color: '#475569', marginLeft: '4px' }}>
                            ({selectedCustomer?.company || enquiry?.customerCompany})
                          </span>
                        )}
                      </span>
                    </div>

                    {selectedEnquiryId && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderLeft: '1px solid #cbd5e1', paddingLeft: '12px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Linked Enquiry:</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb' }}>{selectedEnquiryId}</span>
                      </div>
                    )}
                  </div>

                  {(selectedCustomer?.id || enquiry?.customerId) && (
                    <button
                      type="button"
                      className="crm-btn-secondary"
                      onClick={() => handleViewCustomerProfile(selectedCustomer?.id || enquiry?.customerId)}
                      title="View customer profile"
                      style={{ height: '32px', padding: '0 10px', fontSize: '12px', fontWeight: 600, color: '#2563eb', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      <span>Profile</span>
                      <span>→</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Direct Mode: Typeahead Customer Selector + Profile Button + Conditional Controls */
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label className="quotation-field-label" style={{ margin: 0 }}>
                    Customer *
                  </label>
                  <button
                    type="button"
                    className="crm-btn-secondary compact"
                    onClick={() => setIsCustomerModalOpen(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
                  >
                    <Plus size={13} />
                    <span>Create Customer</span>
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <CustomerSelector
                      label=""
                      selectedCustomerId={selectedCustomerId}
                      selectedCustomerData={selectedCustomer}
                      onSelectCustomer={handleSelectCustomer}
                      onViewCustomer={handleViewCustomerProfile}
                      allowCreate={false}
                      required={true}
                      showSummaryTable={false}
                      hideEmptyState={true}
                      hideToast={true}
                      placeholder="Search customer name, phone, company, or city..."
                    />
                  </div>
                  {selectedCustomer && (
                    <button
                      type="button"
                      className="crm-btn-secondary quotation-profile-btn"
                      onClick={() => handleViewCustomerProfile(selectedCustomer.id)}
                      title={`View ${selectedCustomer.name} profile`}
                      style={{
                        height: '36px',
                        padding: '0 12px',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        color: '#2563eb',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        boxSizing: 'border-box'
                      }}
                    >
                      <span>Profile</span>
                      <span>→</span>
                    </button>
                  )}
                </div>

                {/* Conditional Branch and Link Enquiry controls (ONLY when applicable) */}
                {selectedCustomer && (hasMultipleBranches || customerEnquiries.length > 0) && (
                  <div className="quotation-customer-conditional-controls" style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    {hasMultipleBranches && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Branch:</span>
                        <select
                          className="quotation-control-select"
                          value={selectedBranchId}
                          onChange={(e) => {
                            setSelectedBranchId(e.target.value);
                            setSelectedEnquiryId('');
                          }}
                          style={{ height: '32px', padding: '0 8px', fontSize: '12.5px', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
                        >
                          <option value="">— Select Branch —</option>
                          {customerBranches.map((b) => (
                            <option key={b.branchId} value={b.branchId}>
                              {b.branchName || b.branchId} {b.city ? `(${b.city})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {customerEnquiries.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Link Enquiry:</span>
                        <select
                          className="quotation-control-select"
                          value={selectedEnquiryId}
                          onChange={(e) => setSelectedEnquiryId(e.target.value)}
                          style={{ height: '32px', padding: '0 8px', fontSize: '12.5px', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#0f172a' }}
                        >
                          <option value="">— None (Standalone Quotation) —</option>
                          {customerEnquiries.map((enq) => (
                            <option key={enq.enquiryId} value={enq.enquiryId}>
                              {enq.enquiryId} — {enq.productsInterested || enq.description || 'Requirement'}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Products Table Toolbar (Installation charges, Discount toggle, Round-off toggle, Show stock, Add Product to Master) */}
          <div className="quotation-table-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#1e293b', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={includeInstallationCharges}
                  onChange={(e) => handleToggleInstallationCharges(e.target.checked)}
                  disabled={isConverted || !canManage}
                  style={{ accentColor: '#2563eb', width: '15px', height: '15px', cursor: 'pointer' }}
                />
                <span>Installation Testing &amp; Commissioning Charges</span>
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={showDiscount}
                  onChange={(e) => handleToggleShowDiscount(e.target.checked)}
                  disabled={isConverted || !canManage}
                  style={{ accentColor: '#2563eb', width: '15px', height: '15px', cursor: 'pointer' }}
                />
                <span>Show Discount (%)</span>
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={roundOffTotal}
                  onChange={(e) => handleToggleRoundOff(e.target.checked)}
                  disabled={isConverted || !canManage}
                  style={{ accentColor: '#2563eb', width: '15px', height: '15px', cursor: 'pointer' }}
                />
                <span>Round Off Total</span>
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={showStock}
                  onChange={(e) => handleToggleShowStock(e.target.checked)}
                  disabled={isConverted || !canManage}
                  style={{ accentColor: '#2563eb', width: '15px', height: '15px', cursor: 'pointer' }}
                />
                <span>Show Stock</span>
              </label>
            </div>

            {!isConverted && canManage && (
              <button
                type="button"
                className="quick-add-link-btn"
                onClick={handleAddRow}
                style={{ fontSize: '12.5px', textDecoration: 'none' }}
                title="Add product row directly to this quotation"
              >
                + Add Product
              </button>
            )}
          </div>

          {/* Products Table */}
          <div className="quotation-products-section">
            <div className="quotation-items-wrap">
              <table className={`quotation-items-table ${showDiscount ? 'has-discount' : ''}`}>
                <thead>
                  <tr>
                    <th className="quotation-col-product">PRODUCT</th>
                    <th className="quotation-col-desc">DESCRIPTION</th>
                    {showStock && <th className="quotation-col-stock">STOCK</th>}
                    <th className="quotation-col-qty">QTY</th>
                    <th className="quotation-col-price">PRICE (₹)</th>
                    {showDiscount && (
                      <th className="quotation-col-discount">DISC (%)</th>
                    )}
                    <th className="quotation-col-tax">GST</th>
                    <th className="quotation-col-total">TOTAL (₹)</th>
                    {!isConverted && canManage && (
                      <th className="quotation-col-action">ACTION</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => {
                    const isInstall = Boolean(item.isInstallationCharge || item.productName === INSTALLATION_CHARGE_NAME);
                    const hasProduct = Boolean(item.productId);
                    const isLowStock = !isInstall && hasProduct && item.stock <= 0;
                    const floorPrice = !isInstall ? getProductConfiguredFloorPrice(item, stockProducts) : 0;
                    const mrpPrice = !isInstall ? getProductConfiguredMrp(item, stockProducts) : 0;
                    const hasMinPriceError = !isInstall && isPriceBelowConfigured(item, stockProducts);

                    // Compute disabledIds for this row: all other selected product IDs
                    const rowDisabledIds = lineItems
                      .filter((it) => it.rowId !== item.rowId && it.productId)
                      .map((it) => it.productId);

                    return (
                      <tr key={item.rowId} className={`quotation-item-row ${isLowStock ? 'row-low-stock' : ''} ${isInstall ? 'row-installation-charge' : ''}`}>
                        {/* Product */}
                        <td className="quotation-col-product">
                          {isInstall ? (
                            <div className="quotation-installation-service-label" style={{ display: 'flex', flexDirection: 'column', gap: '3px', padding: '4px 2px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', lineHeight: '1.3' }}>
                                Installation Testing &amp; Commissioning Charges
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '10.5px', fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '1px 6px', letterSpacing: '0.02em' }}>
                                  SERVICE / LABOUR
                                </span>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                  SAC: {item.hsnSac || '995469'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="quotation-inline-select-wrap">
                              <SearchableProductSelect
                                items={stockProducts}
                                selectedId={item.productId}
                                selectedName={item.productName}
                                onChange={(id, selectedItem) => handleProductSelect(item.rowId, id, selectedItem)}
                                onAddProduct={() => handleOpenAddProductModal(item.rowId)}
                                onDuplicateAttempt={() => {
                                  setError('Product already added to this quotation.');
                                  if (typeof window !== 'undefined' && window.alert) {
                                    try { window.alert('Product already added to this quotation.'); } catch (e) {}
                                  }
                                }}
                                placeholder="Select Product ▼"
                                searchPlaceholder="Type to search products..."
                                disabledIds={rowDisabledIds}
                                disabled={isConverted || !canManage}
                                formatLabel={(p) => p.name || p.productName || ''}
                              />
                              <div className="quotation-product-sub-text" style={{ paddingLeft: '4px', marginTop: '3px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                  {hasProduct ? `${item.productCode ? `${item.productCode} • ` : ''}${(item.unit && item.unit !== 'Piece') ? item.unit : 'Nos'}` : ''}
                                </span>
                                {canManage && !isConverted && (
                                  <button
                                    type="button"
                                    className="quick-add-link-btn quotation-row-add-product-btn"
                                    onClick={() => handleAddProductToMaster(item.rowId)}
                                    title="Open Stock Master to register a brand new product catalog entry"
                                    style={{
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      color: '#2563eb',
                                      background: '#eff6ff',
                                      border: '1px solid #bfdbfe',
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      lineHeight: '1.2'
                                    }}
                                  >
                                    + New in Stock Master
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Description */}
                        <td className="quotation-col-desc">
                          {isInstall ? (
                            <span className="quotation-empty-cell-dash">—</span>
                          ) : (
                            <textarea
                              className="quotation-desc-textarea"
                              value={item.description || ''}
                              onChange={(e) => handleDescriptionChange(item.rowId, e.target.value)}
                              placeholder={hasProduct ? "Product description (quotation-specific)..." : "—"}
                              disabled={!hasProduct || isConverted || !canManage}
                              rows={2}
                            />
                          )}
                        </td>

                        {/* Stock */}
                        {showStock && (
                          <td className="quotation-col-stock">
                            {isInstall ? (
                              <span className="quotation-empty-cell-dash">—</span>
                            ) : hasProduct ? (
                              <span
                                className={`quotation-stock-badge ${item.stock > 0 ? 'in-stock' : 'out-of-stock'}`}
                                title={
                                  item.availableStock !== undefined && item.availableStock !== item.stock
                                    ? `Master Stock: ${item.stock} (${item.availableStock} available)`
                                    : `Warehouse Stock: ${item.stock}`
                                }
                              >
                                {item.stock}
                              </span>
                            ) : (
                              <span className="quotation-empty-cell-dash">—</span>
                            )}
                          </td>
                        )}

                        {/* Qty */}
                        <td className="quotation-col-qty">
                          {isInstall ? (
                            <span className="quotation-static-qty" style={{ fontWeight: 600, color: '#334155' }}>1</span>
                          ) : !isConverted && canManage ? (
                            <div className="quotation-qty-cell-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <input
                                type="number"
                                className={`quotation-qty-input ${!hasProduct ? 'is-placeholder' : ''} ${item.qtyError ? 'input-error' : ''}`}
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleQtyChange(item.rowId, e.target.value)}
                                disabled={!hasProduct}
                                title={item.qtyError || undefined}
                                placeholder="1"
                              />
                              {hasProduct && item.qtyError && (
                                <div className="quotation-qty-error-msg">{item.qtyError}</div>
                              )}
                            </div>
                          ) : (
                            <span className="quotation-static-qty">{item.quantity}</span>
                          )}
                        </td>

                        {/* Price */}
                        <td className="quotation-col-price">
                          {isInstall ? (
                            !isConverted && canManage ? (
                              <div className="quotation-price-cell-container">
                                <div className="quotation-price-input-wrapper">
                                  <span className="quotation-currency-prefix">₹</span>
                                  <input
                                    type="number"
                                    className="quotation-price-input"
                                    min="0"
                                    step="0.01"
                                    value={item.unitPrice ?? ''}
                                    onChange={(e) => handlePriceChange(item.rowId, e.target.value)}
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="quotation-static-price">
                                ₹{Number(item.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )
                          ) : hasProduct ? (
                            !isConverted && canManage ? (
                              <div className="quotation-price-cell-container">
                                <div className="quotation-price-input-wrapper">
                                  <span className="quotation-currency-prefix">₹</span>
                                  <input
                                    type="number"
                                    className={`quotation-price-input ${hasMinPriceError ? 'input-error' : ''}`}
                                    min="0"
                                    step="0.01"
                                    value={item.unitPrice ?? ''}
                                    onChange={(e) => handlePriceChange(item.rowId, e.target.value)}
                                    placeholder="0.00"
                                    title={mrpPrice > 0 ? `MRP: ₹${mrpPrice.toLocaleString('en-IN')} | Min Dealer Price: ₹${floorPrice.toLocaleString('en-IN')}` : undefined}
                                  />
                                </div>
                                {hasProduct && (mrpPrice > 0 || floorPrice > 0) && (
                                  <div className="quotation-price-hint-text" style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap' }}>
                                    {mrpPrice > 0 ? `MRP ₹${mrpPrice.toLocaleString('en-IN')}` : ''}
                                    {mrpPrice > 0 && floorPrice > 0 ? ' • ' : ''}
                                    {floorPrice > 0 ? `Min ₹${floorPrice.toLocaleString('en-IN')}` : ''}
                                  </div>
                                )}
                                {hasMinPriceError && (
                                  <div className="quotation-min-price-warning">
                                    ⚠ Cannot be below Dealer Price ₹{Number(floorPrice % 1 === 0 ? floorPrice : floorPrice.toFixed(2)).toLocaleString('en-IN')}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="quotation-static-price">
                                ₹{Number(item.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )
                          ) : (
                            <span className="quotation-empty-cell-dash">—</span>
                          )}
                        </td>

                        {/* Discount (%) if toggled ON */}
                        {showDiscount && (
                          <td className="quotation-col-discount">
                            {isInstall ? (
                              <span className="quotation-empty-cell-dash">—</span>
                            ) : hasProduct ? (
                              !isConverted && canManage ? (
                                <div className="quotation-discount-input-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  <input
                                    type="number"
                                    className="quotation-discount-input"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    value={item.discount ?? 0}
                                    onChange={(e) => handleDiscountChange(item.rowId, e.target.value)}
                                    style={{ width: '56px', padding: '4px 6px', textAlign: 'right', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                  />
                                  <span style={{ fontSize: '12px', color: '#64748b' }}>%</span>
                                </div>
                              ) : (
                                <span>{item.discount || 0}%</span>
                              )
                            ) : (
                              <span className="quotation-empty-cell-dash">—</span>
                            )}
                          </td>
                        )}

                        {/* GST */}
                        <td className="quotation-col-tax">
                          {isInstall ? (
                            !isConverted && canManage ? (
                              <select
                                className="quotation-gst-select"
                                value={item.gst !== undefined ? item.gst : 18}
                                onChange={(e) => handleGstChange(item.rowId, e.target.value)}
                                style={{
                                  height: '32px',
                                  padding: '2px 6px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  borderRadius: '4px',
                                  border: '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  color: '#0f172a',
                                  cursor: 'pointer'
                                }}
                              >
                                <option value={18}>18%</option>
                                <option value={12}>12%</option>
                                <option value={5}>5%</option>
                                <option value={0}>0%</option>
                                <option value={28}>28%</option>
                              </select>
                            ) : (
                              <span className="quotation-gst-badge">
                                {item.isIGSTApplicable ? `IGST ${item.gst}%` : `${item.gst}%`}
                              </span>
                            )
                          ) : hasProduct ? (
                            <span className="quotation-gst-badge">
                              {item.isIGSTApplicable ? `IGST ${item.gst}%` : `${item.gst}%`}
                            </span>
                          ) : (
                            <span className="quotation-empty-cell-dash">—</span>
                          )}
                        </td>

                        {/* Total */}
                        <td className="quotation-col-total">
                          {(isInstall || hasProduct) ? (
                            <span className="quotation-line-total-value">
                              ₹{Number(item.lineTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="quotation-empty-cell-dash">—</span>
                          )}
                        </td>

                        {/* Action */}
                        {!isConverted && canManage && (
                          <td className="quotation-col-action">
                            <button
                              type="button"
                              className="quotation-delete-btn"
                              onClick={() => handleDeleteRow(item.rowId)}
                              title={isInstall ? "Remove Installation Testing & Commissioning Charges" : "Delete item"}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Add Row Button below Table */}
            {!isConverted && canManage && (
              <div className="quotation-add-row-bar">
                <button
                  type="button"
                  className="quotation-add-row-btn"
                  onClick={handleAddRow}
                >
                  <Plus size={14} />
                  <span>Add Row</span>
                </button>
              </div>
            )}
          </div>

          {/* Totals Summary Bar */}
          <div className="quotation-summary-bar quotation-totals-strip">
            <div className="quotation-summary-left" style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <div className="quotation-summary-item">
                <span>Subtotal (Gross):</span>
                <strong>₹{totals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
              {showDiscount && (
                <>
                  <div className="quotation-summary-item">
                    <span>Discount:</span>
                    <strong style={{ color: '#16a34a' }}>- ₹{totals.discountTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="quotation-summary-item">
                    <span>Taxable:</span>
                    <strong>₹{totals.taxableTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                </>
              )}
              <div className="quotation-summary-item">
                <span>GST Tax:</span>
                <strong>₹{totals.gstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
              {roundOffTotal && (
                <>
                  <div className="quotation-summary-item">
                    <span>Calculated Total:</span>
                    <strong>₹{totals.calculatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="quotation-summary-item">
                    <span>Round Off:</span>
                    <strong style={{ color: totals.roundOff >= 0 ? '#16a34a' : '#dc2626' }}>
                      {totals.roundOff >= 0 ? '+' : ''}₹{totals.roundOff.toFixed(2)}
                    </strong>
                  </div>
                </>
              )}
            </div>
            <div className="quotation-grand-total">
              <span className="quotation-grand-total-label">Grand Total:</span>
              <span className="quotation-grand-total-value">
                ₹{totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Valid Until + Remarks + Terms & Conditions */}
          <div className="quotation-terms-section-wrapper" style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="quotation-terms-grid">
              <div className="quotation-term-field">
                <label className="quotation-term-label">VALID UNTIL</label>
                <input
                  type="date"
                  className="quotation-term-input quotation-valid-until-input"
                  value={validUntilDate}
                  onChange={(e) => setValidUntilDate(e.target.value)}
                  disabled={isConverted || !canManage}
                />
              </div>
              <div className="quotation-term-field">
                <label className="quotation-term-label">QUOTATION NOTE / REMARKS</label>
                <input
                  type="text"
                  className="quotation-term-input quotation-remarks-input"
                  placeholder="e.g. Special price offer or customer reference note"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  disabled={isConverted || !canManage}
                />
              </div>
            </div>

            <div className="quotation-term-field" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="quotation-term-label">TERMS &amp; CONDITIONS (STANDARD COMMERCIAL TERMS)</label>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Customized for this quotation</span>
              </div>
              <textarea
                className="quotation-term-textarea"
                rows={4}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  lineHeight: '1.45',
                  color: '#0f172a',
                  background: '#ffffff',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
                placeholder="Enter standard commercial terms & conditions for this quotation..."
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                disabled={isConverted || !canManage}
              />
            </div>
          </div>

          {/* Post-Save Workflow Action Bar */}
          {isSaved && (
            <div
              className="quotation-workflow-action-card"
              style={{
                margin: '20px 0 16px 0',
                padding: '14px 18px',
                background: isConverted ? '#f0fdf4' : isAccepted ? '#f0fdf4' : quotationStatus === 'REJECTED' ? '#fef2f2' : '#f8fafc',
                border: `1px solid ${isConverted ? '#bbf7d0' : isAccepted ? '#bbf7d0' : quotationStatus === 'REJECTED' ? '#fecaca' : '#cbd5e1'}`,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Quotation ID:</span>
                  <strong style={{ fontSize: '15px', color: '#0f172a' }}>{quotationNumber}</strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Status:</span>
                  <span
                    className={`status-badge ${
                      isConverted || isAccepted ? 'badge-green' : quotationStatus === 'REJECTED' ? 'badge-red' : 'badge-purple'
                    }`}
                    style={{ fontSize: '11px', padding: '3px 8px', fontWeight: 700 }}
                  >
                    {isConverted ? 'CONVERTED' : isAccepted ? 'ACCEPTED' : quotationStatus === 'REJECTED' ? 'REJECTED' : 'PENDING'}
                  </span>
                </div>

                {orderId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#15803d', textTransform: 'uppercase' }}>Linked Order:</span>
                    <button
                      type="button"
                      onClick={() => navigate(`/orders/${encodeURIComponent(orderId)}`)}
                      className="quotation-order-link-btn"
                      style={{
                        background: '#dcfce7',
                        border: '1px solid #86efac',
                        color: '#166534',
                        padding: '3px 9px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="Click to view Sales Order"
                    >
                      <span>{orderId}</span>
                      <ExternalLink size={12} />
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                {/* PENDING: Customer Decision Buttons */}
                {!isAccepted && !isConverted && quotationStatus !== 'REJECTED' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Customer Decision:</span>
                    {canApproveQuotation && (
                      <button
                        type="button"
                        className="crm-btn-primary"
                        style={{
                          background: '#16a34a',
                          borderColor: '#15803d',
                          color: '#ffffff',
                          fontWeight: 600,
                          padding: '7px 16px',
                          fontSize: '13px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          borderRadius: '6px',
                          cursor: actionLoading ? 'not-allowed' : 'pointer'
                        }}
                        onClick={handleAcceptQuotation}
                        disabled={actionLoading}
                        title="Accept quotation (Customer Approved)"
                      >
                        <CheckCircle size={15} />
                        <span>✓ ACCEPT</span>
                      </button>
                    )}

                    {canRejectQuotation && (
                      <button
                        type="button"
                        className="crm-btn-secondary"
                        style={{
                          background: '#fff1f2',
                          borderColor: '#fecdd3',
                          color: '#e11d48',
                          fontWeight: 600,
                          padding: '7px 14px',
                          fontSize: '13px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          borderRadius: '6px',
                          cursor: actionLoading ? 'not-allowed' : 'pointer'
                        }}
                        onClick={handleRejectQuotation}
                        disabled={actionLoading}
                        title="Reject quotation"
                      >
                        <XCircle size={15} />
                        <span>Reject</span>
                      </button>
                    )}
                  </div>
                )}

                {/* ACCEPTED: Convert to Order Action */}
                {isAccepted && !isConverted && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {canConvert && (
                      <button
                        type="button"
                        className="crm-btn-primary"
                        style={{
                          background: '#0284c7',
                          borderColor: '#0369a1',
                          color: '#ffffff',
                          fontWeight: 600,
                          padding: '7px 16px',
                          fontSize: '13px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          borderRadius: '6px',
                          cursor: actionLoading ? 'not-allowed' : 'pointer'
                        }}
                        onClick={handleConvertToOrder}
                        disabled={actionLoading}
                        title="Convert accepted quotation into a Sales Order"
                      >
                        <Zap size={15} />
                        <span>⚡ Convert to Order</span>
                      </button>
                    )}
                  </div>
                )}

                {/* CONVERTED BADGE / CONFIRMATION */}
                {isConverted && (
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#166534', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle size={15} />
                    Quotation Converted
                  </span>
                )}

                {/* DOCUMENTS: QUOTATION PDF & PROFORMA (available whenever persisted & not rejected) */}
                {quotationStatus !== 'REJECTED' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid #cbd5e1', paddingLeft: '14px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Documents:</span>
                    <button
                      type="button"
                      className="crm-btn-secondary"
                      style={{
                        background: '#ffffff',
                        color: '#1e293b',
                        borderColor: '#cbd5e1',
                        fontWeight: 600,
                        padding: '7px 14px',
                        fontSize: '13px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderRadius: '6px',
                        cursor: hasLineItemErrors ? 'not-allowed' : 'pointer',
                        opacity: hasLineItemErrors ? 0.6 : 1
                      }}
                      onClick={handleOpenPdfClick}
                      title={hasLineItemErrors ? 'Resolve quantity or price errors before generating PDF' : 'View & Download Official Quotation PDF'}
                    >
                      <Printer size={15} />
                      <span>Quotation PDF</span>
                    </button>

                    <button
                      type="button"
                      className="crm-btn-secondary"
                      style={{
                        background: '#f0f9ff',
                        color: '#0284c7',
                        borderColor: '#bae6fd',
                        fontWeight: 600,
                        padding: '7px 14px',
                        fontSize: '13px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderRadius: '6px',
                        cursor: hasLineItemErrors ? 'not-allowed' : 'pointer',
                        opacity: hasLineItemErrors ? 0.6 : 1
                      }}
                      onClick={handleGenerateProformaClick}
                      title={hasLineItemErrors ? 'Resolve quantity or price errors before generating Proforma' : 'Generate Proforma Invoice from this Quotation'}
                    >
                      <FileText size={15} />
                      <span>Proforma</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Actions Row */}
          <div className="quotation-footer-row">
            <button
              type="button"
              className="quotation-back-btn crm-btn-secondary"
              onClick={handleBack}
              disabled={saving}
            >
              <ArrowLeft size={15} />
              <span>Back to Quotations</span>
            </button>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isSaved && quotationStatus !== 'REJECTED' && (
                <button
                  type="button"
                  className="crm-btn-secondary"
                  style={{
                    background: '#f8fafc',
                    color: '#1e293b',
                    borderColor: '#cbd5e1',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: hasLineItemErrors ? 'not-allowed' : 'pointer',
                    opacity: hasLineItemErrors ? 0.6 : 1
                  }}
                  onClick={handleOpenPdfClick}
                  title={hasLineItemErrors ? 'Resolve quantity or price errors before generating PDF' : 'View & Download Official Quotation PDF'}
                >
                  <Printer size={15} />
                  <span>Quotation PDF</span>
                </button>
              )}

              {isSaved && quotationStatus !== 'REJECTED' && (
                <button
                  type="button"
                  className="crm-btn-secondary"
                  style={{
                    background: '#f0f9ff',
                    color: '#0284c7',
                    borderColor: '#bae6fd',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: hasLineItemErrors ? 'not-allowed' : 'pointer',
                    opacity: hasLineItemErrors ? 0.6 : 1
                  }}
                  onClick={handleGenerateProformaClick}
                  title={hasLineItemErrors ? 'Resolve quantity or price errors before generating Proforma' : 'Generate Proforma Invoice from this Quotation'}
                >
                  <FileText size={15} />
                  <span>Generate Proforma</span>
                </button>
              )}

              {!isConverted && canManage && (
                <button
                  type="button"
                  className="quotation-save-btn crm-btn-primary"
                  onClick={handleSaveAndIssue}
                  disabled={saving || hasLineItemErrors}
                  style={{
                    cursor: (saving || hasLineItemErrors) ? 'not-allowed' : 'pointer',
                    opacity: hasLineItemErrors ? 0.6 : 1
                  }}
                  title={hasLineItemErrors ? 'Resolve quantity or price errors before saving' : undefined}
                >
                  <Check size={16} />
                  <span>{saving ? 'Saving...' : 'SAVE / UPDATE QUOTATION'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Customer / Enquiry Details Modal (for clicking enquiry badge or customer link) */}
      {isEnquiryDetailsModalOpen && (
        <div className="crm-modal-backdrop" onClick={() => setIsEnquiryDetailsModalOpen(false)}>
          <div className="crm-modal quotation-customer-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="crm-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  CUSTOMER / ENQUIRY DETAILS
                </span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  {selectedCustomer?.name || enquiry?.customerName || 'Customer'}
                </h3>
              </div>
              <button
                type="button"
                className="crm-modal-close-btn"
                onClick={() => setIsEnquiryDetailsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div className="crm-modal-body" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: '12px', fontSize: '13.5px' }}>
                <div style={{ color: '#64748b', fontWeight: 500 }}>Enquiry ID:</div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedEnquiryId || '—'}</div>

                <div style={{ color: '#64748b', fontWeight: 500 }}>Assigned Rep:</div>
                <div style={{ fontWeight: 600, color: '#334155' }}>{enquiry?.assignedRep || enquiry?.assignedTo || 'Unassigned'}</div>

                <div style={{ color: '#64748b', fontWeight: 500 }}>Requirement Status:</div>
                <div>
                  <span style={{ color: '#16a34a', fontWeight: 600 }}>{enquiry?.status || 'Confirmed'}</span>
                </div>

                <div style={{ color: '#64748b', fontWeight: 500, gridColumn: '1 / -1', marginTop: '6px' }}>Customer Requirement:</div>
                <div style={{ gridColumn: '1 / -1', padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', color: '#1e293b', minHeight: '48px' }}>
                  {enquiry?.description || enquiry?.requirement || enquiry?.productsInterested || 'No specific requirement text.'}
                </div>
              </div>
            </div>

            <div className="crm-modal-footer" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="crm-btn-secondary"
                onClick={() => setIsEnquiryDetailsModalOpen(false)}
                style={{ padding: '6px 20px', borderRadius: '6px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal (strictly for Direct Mode) */}
      {!isContextMode && (
        <AddCustomerModal
          isOpen={isCustomerModalOpen}
          onClose={() => setIsCustomerModalOpen(false)}
          onCustomerCreated={handleCustomerCreated}
          existingCustomers={customersList}
        />
      )}

      {/* Official ASI Quotation PDF Preview & Download Modal */}
      {isPdfModalOpen && isSaved && quotationStatus !== 'REJECTED' && (
        <DocumentPreviewModal
          title="Official Quotation"
          docId={quotationNumber}
          docType="quotation"
          status={quotationStatus}
          filename={getQuotationFilename(quotationPrintData)}
          onClose={() => setIsPdfModalOpen(false)}
        >
          <PrintableQuotation data={quotationPrintData} />
        </DocumentPreviewModal>
      )}
    </div>
  );
}
