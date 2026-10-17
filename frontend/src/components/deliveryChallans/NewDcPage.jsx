import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Trash2, ChevronDown, X, UserPlus, Search, FileText } from 'lucide-react';
import { apiFetch, apiUrl } from '../../api';
import { navigate } from '../../router';
import SearchableProductSelect from '../common/SearchableProductSelect';
import AddCustomerModal from '../customer/AddCustomerModal';
import FefoSerialPickerModal from './FefoSerialPickerModal';
import { formatDate } from '../../utils/dateUtils';
import './dcStyles.css';

function authHeaders(user) {
  return {
    'Content-Type': 'application/json',
    'x-user-id': user?.id || ''
  };
}

export default function NewDcPage({ user, orders = [], stocks = [], onCancel, onSuccess, onOpenDoc }) {
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [deliveryPurpose, setDeliveryPurpose] = useState('NORMAL');
  const [dispatchTo, setDispatchTo] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [refNo, setRefNo] = useState('');
  const [selectedPendingDcId, setSelectedPendingDcId] = useState('');
  const [refMode, setRefMode] = useState('PENDING'); // 'PENDING' | 'REF_NO'
  const [manualRefNo, setManualRefNo] = useState('');
  const [isRefNoDropdownOpen, setIsRefNoDropdownOpen] = useState(false);
  const [refNoSearchQuery, setRefNoSearchQuery] = useState('');
  const [isRefNoEditing, setIsRefNoEditing] = useState(false);
  const [highlightedRefNoIndex, setHighlightedRefNoIndex] = useState(0);
  const refNoContainerRef = useRef(null);
  const refNoInputRef = useRef(null);
  const refNoListboxRef = useRef(null);
  const manualRefInputRef = useRef(null);
  const [allDeliveryChallans, setAllDeliveryChallans] = useState([]);
  const [transitMode, setTransitMode] = useState('Road Express');
  const [vehicleDetails, setVehicleDetails] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [isReceiverOpen, setIsReceiverOpen] = useState(false);
  const receiverContainerRef = useRef(null);
  const [remarks, setRemarks] = useState('');
  const [status, setStatus] = useState('DISPATCHED');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Customer typeahead & Add Customer modal states
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomerObj, setSelectedCustomerObj] = useState(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerEditing, setIsCustomerEditing] = useState(false);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [highlightedCustomerIndex, setHighlightedCustomerIndex] = useState(0);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [initialCustomerName, setInitialCustomerName] = useState('');
  const customerContainerRef = useRef(null);
  const customerInputRef = useRef(null);
  const customerListboxRef = useRef(null);

  // Quotations state
  const [quotations, setQuotations] = useState([]);
  const [selectedQuotationId, setSelectedQuotationId] = useState('');

  // Employees state (for Executive Engineer and Material Returned By)
  const [employees, setEmployees] = useState([]);
  const [executiveEngineerId, setExecutiveEngineerId] = useState('');
  const [executiveEngineerName, setExecutiveEngineerName] = useState('');
  const [materialReturnedById, setMaterialReturnedById] = useState('');
  const [materialReturnedByName, setMaterialReturnedByName] = useState('');

  // Duplicate alert message
  const [duplicateAlert, setDuplicateAlert] = useState('');

  // Helper factory for a clean empty delivery line item row
  const createEmptyRow = (id = Date.now()) => ({
    id,
    productId: '',
    productCode: '',
    productName: '',
    productType: '',
    godown: 'Main Godown - Chennai',
    availableQty: 0,
    requiredQty: 1,
    deliveryQty: 1,
    unit: 'Piece',
    hsnSac: '85258090',
    unitPrice: 0,
    gst: 18,
    serialized: true,
    serialNumbers: [],
    qtyError: ''
  });

function isCableItem(item) {
  if (!item) return false;
  const name = String(item.name || item.productName || item.productDetails || item.description || '').toLowerCase();
  const code = String(item.code || item.sku || item.productCode || '').toLowerCase();
  const cat = String(item.category || item.categoryName || item.categoryId || item.productType || '').toLowerCase();
  const subcat = String(item.subcategory || item.subcategoryName || item.subcategoryId || '').toLowerCase();
  if (cat === 'cat-000004' || cat.includes('cable')) return true;
  if (subcat.includes('cable')) return true;
  if (name.includes('cable') || name.includes('cat 6') || name.includes('cat6') || name.includes('patch cord') || name.includes('fiber cable')) return true;
  if (code === 'asi-18' || code === 'prod-000041' || code.includes('cable')) return true;
  const unit = String(item.unit || '').toLowerCase();
  if ((unit === 'meter' || unit === 'roll') && (name.includes('wire') || name.includes('cable'))) return true;
  return false;
}

  // Aggregation helper: Combines duplicate product lines from quotation into single rows
  const aggregateQuotationItems = (quoteItems, stocksList) => {
    if (!Array.isArray(quoteItems) || quoteItems.length === 0) return [];

    const aggregatedMap = new Map();
    quoteItems.forEach((item) => {
      const key = item.productId || item.productCode || item.productName;
      if (!key) return;
      const qty = Number(item.quantity || 1);
      if (aggregatedMap.has(key)) {
        const existing = aggregatedMap.get(key);
        existing.quantity += qty;
      } else {
        aggregatedMap.set(key, { ...item, quantity: qty });
      }
    });

    const aggregatedArray = Array.from(aggregatedMap.values());

    return aggregatedArray.map((it, idx) => {
      const matchingStock = stocksList.find((s) => s.id === it.productId || s.code === it.productCode) || {};
      const avail = Number(matchingStock.stock !== undefined ? matchingStock.stock : 0);
      const qty = Number(it.quantity || 1);
      const deliveryQty = avail > 0 ? Math.min(qty, avail) : 0;
      const isCable = isCableItem(matchingStock) || isCableItem(it);
      const isSerialized = !isCable && matchingStock.serialized !== false;
      const qtyError = avail <= 0 ? 'Product is out of stock.' : '';
      const key = it.productId || matchingStock.id || it.productCode || matchingStock.code || it.productName;
      const serialList = isCable ? [] : (stockSerialsPool[key] || stockSerialsPool[matchingStock.code] || []);
      const autoSerials = isSerialized && deliveryQty > 0 ? serialList.slice(0, deliveryQty) : [];

      return {
        id: Date.now() + idx,
        productId: it.productId || matchingStock.id || '',
        productCode: it.productCode || matchingStock.code || '',
        productName: it.productName || it.name || matchingStock.name || 'Equipment',
        productType: matchingStock.categoryName || matchingStock.category || 'Finished Goods',
        godown: 'Main Godown - Chennai',
        availableQty: avail,
        requiredQty: qty,
        deliveryQty: deliveryQty,
        qtyError,
        unit: it.unit || matchingStock.unit || 'Piece',
        hsnSac: it.hsnSac || matchingStock.hsnSac || '85258090',
        unitPrice: Number(it.unitPrice || matchingStock.dealerPrice || 0),
        gst: Number(it.gst || matchingStock.gst || 18),
        serialized: isSerialized,
        serialNumbers: autoSerials
      };
    });
  };

  // Stock products state (reactive copy of stocks, refreshed dynamically)
  const [currentStocks, setCurrentStocks] = useState(stocks);
  useEffect(() => {
    if (Array.isArray(stocks) && stocks.length > 0) {
      setCurrentStocks(stocks);
    } else {
      apiFetch(apiUrl('/api/stocks'), { headers: authHeaders(user) })
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data) {
            const list = Array.isArray(json.data) ? json.data : (json.data.products || []);
            setCurrentStocks(list);
          }
        })
        .catch((err) => console.warn('Could not fetch stocks fallback in NewDcPage:', err));
    }
  }, [stocks, user]);

  // Stock serials pool & FEFO metadata pool
  const [stockSerialsPool, setStockSerialsPool] = useState({});
  const [stockSerialsMetaPool, setStockSerialsMetaPool] = useState({});
  const [serialPickerRowIdx, setSerialPickerRowIdx] = useState(null);
  const [loadingSerials, setLoadingSerials] = useState(false);

  // Line items state
  // Initial row with empty product
  const [rows, setRows] = useState([createEmptyRow(1)]);

  // Handle DC draft restoration and sync newly created or updated product from Product Master
  useEffect(() => {
    let savedDraftData = null;
    try {
      const savedDraft = sessionStorage.getItem('asicrm_dc_draft');
      if (savedDraft) {
        const d = JSON.parse(savedDraft);
        if (d && Date.now() - (d.timestamp || 0) < 3600000) {
          savedDraftData = d;
          if (d.deliveryDate) setDeliveryDate(d.deliveryDate);
          if (d.deliveryPurpose) setDeliveryPurpose(d.deliveryPurpose);
          if (d.dispatchTo) setDispatchTo(d.dispatchTo);
          if (d.selectedCustomerId) setSelectedCustomerId(d.selectedCustomerId);
          if (d.selectedCustomerObj) setSelectedCustomerObj(d.selectedCustomerObj);
          if (d.deliveryAddress) setDeliveryAddress(d.deliveryAddress);
          if (d.selectedOrderId) setSelectedOrderId(d.selectedOrderId);
          if (d.refNo) setRefNo(d.refNo);
          if (d.selectedPendingDcId) setSelectedPendingDcId(d.selectedPendingDcId);
          if (d.refMode) setRefMode(d.refMode);
          if (d.manualRefNo) setManualRefNo(d.manualRefNo);
          if (d.selectedQuotationId) setSelectedQuotationId(d.selectedQuotationId);
          if (d.transitMode) setTransitMode(d.transitMode);
          if (d.vehicleDetails) setVehicleDetails(d.vehicleDetails);
          if (d.receiverName) setReceiverName(d.receiverName);
          if (d.executiveEngineerId) setExecutiveEngineerId(d.executiveEngineerId);
          if (d.executiveEngineerName) setExecutiveEngineerName(d.executiveEngineerName);
          if (d.materialReturnedById) setMaterialReturnedById(d.materialReturnedById);
          if (d.materialReturnedByName) setMaterialReturnedByName(d.materialReturnedByName);
          if (d.remarks) setRemarks(d.remarks);
          if (d.status) setStatus(d.status);
          if (Array.isArray(d.rows) && d.rows.length > 0) {
            setRows(d.rows);
          }
        }
        sessionStorage.removeItem('asicrm_dc_draft');
      }
    } catch (e) {
      console.warn('Could not restore DC draft:', e);
    }

    const updatedPayloadStr = sessionStorage.getItem('asicrm_updated_product_payload');
    const newProdId = sessionStorage.getItem('asicrm_newly_created_product_id');
    const targetRowId = sessionStorage.getItem('asicrm_dc_target_row_id') || sessionStorage.getItem('asicrm_target_row_id');

    if (updatedPayloadStr || newProdId) {
      let newProd = null;
      try {
        if (updatedPayloadStr) newProd = JSON.parse(updatedPayloadStr);
      } catch {}

      // Re-fetch fresh stock list from server
      apiFetch(apiUrl('/api/stocks'), { headers: authHeaders(user) })
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data) {
            const freshList = Array.isArray(json.data) ? json.data : (json.data.products || []);
            setCurrentStocks(freshList);

            const canonicalId = newProd?.id || newProd?.productId || newProdId;
            const canonicalProd = (freshList || []).find((p) =>
              p.id === canonicalId ||
              p.productId === canonicalId ||
              p.code === canonicalId ||
              (newProd?.code && p.code === newProd.code)
            ) || newProd;

            if (canonicalProd) {
              const prodStock = Number(canonicalProd.stock !== undefined ? canonicalProd.stock : 0);
              const prodSerialized = canonicalProd.serialized !== false;

              setRows((prev) => {
                const baseRows = (savedDraftData?.rows && savedDraftData.rows.length > 0)
                  ? [...savedDraftData.rows]
                  : [...prev];

                let targetIdx = -1;
                if (targetRowId) {
                  targetIdx = baseRows.findIndex((r) => String(r.id) === String(targetRowId));
                }
                if (targetIdx < 0) {
                  targetIdx = baseRows.findIndex((r) => !r.productId);
                }

                let updatedAny = false;
                for (let i = 0; i < baseRows.length; i++) {
                  if (
                    baseRows[i].productId === canonicalProd.id ||
                    (canonicalProd.code && baseRows[i].productCode === canonicalProd.code)
                  ) {
                    const existingDeliveryQty = baseRows[i].deliveryQty ? Number(baseRows[i].deliveryQty) : 1;
                    const newDeliveryQty = prodStock > 0 ? Math.min(existingDeliveryQty, prodStock) : 0;
                    baseRows[i] = {
                      ...baseRows[i],
                      productId: canonicalProd.id,
                      productCode: canonicalProd.code || '',
                      productName: canonicalProd.name || '',
                      productType: canonicalProd.categoryName || canonicalProd.category || 'Finished Goods',
                      availableQty: prodStock,
                      deliveryQty: newDeliveryQty,
                      qtyError: prodStock <= 0 ? 'Product is out of stock.' : '',
                      unit: canonicalProd.unit || 'Piece',
                      hsnSac: canonicalProd.hsnSac || '85258090',
                      unitPrice: Number(canonicalProd.dealerPrice || canonicalProd.cost || 0),
                      gst: Number(canonicalProd.gst || 18),
                      serialized: prodSerialized
                    };
                    updatedAny = true;
                  }
                }

                if (!updatedAny) {
                  const newRowData = {
                    id: targetIdx >= 0 ? baseRows[targetIdx].id : Date.now(),
                    productId: canonicalProd.id,
                    productCode: canonicalProd.code || '',
                    productName: canonicalProd.name || '',
                    productType: canonicalProd.categoryName || canonicalProd.category || 'Finished Goods',
                    godown: 'Main Godown - Chennai',
                    availableQty: prodStock,
                    deliveryQty: prodStock > 0 ? 1 : 0,
                    qtyError: prodStock <= 0 ? 'Product is out of stock.' : '',
                    unit: canonicalProd.unit || 'Piece',
                    hsnSac: canonicalProd.hsnSac || '85258090',
                    unitPrice: Number(canonicalProd.dealerPrice || canonicalProd.cost || 0),
                    gst: Number(canonicalProd.gst || 18),
                    serialized: prodSerialized,
                    serialNumbers: prodSerialized && (prodStock > 0 ? 1 : 0) > 0
                      ? (stockSerialsPool[canonicalProd.id] || stockSerialsPool[canonicalProd.code] || []).slice(0, 1)
                      : []
                  };

                  if (targetIdx >= 0) {
                    baseRows[targetIdx] = newRowData;
                  } else {
                    baseRows.push(newRowData);
                  }
                }

                const hasEmpty = baseRows.some((r) => !r.productId);
                if (!hasEmpty) {
                  baseRows.push(createEmptyRow(Date.now() + 999));
                }

                return baseRows;
              });

              setSuccess(`✓ Product ${canonicalProd.code ? canonicalProd.code + ' — ' : ''}${canonicalProd.name} added and synced in delivery challan.`);
              setTimeout(() => setSuccess(''), 5000);
            }
          }
        })
        .catch((err) => console.warn('Could not sync stock on DC return:', err))
        .finally(() => {
          try {
            sessionStorage.removeItem('asicrm_newly_created_product_id');
            sessionStorage.removeItem('asicrm_updated_product_payload');
            sessionStorage.removeItem('asicrm_dc_target_row_id');
            sessionStorage.removeItem('asicrm_target_row_id');
            sessionStorage.removeItem('asicrm_product_from');
            sessionStorage.removeItem('asicrm_product_return');
          } catch {}
        });
    }
  }, [user]);


  // Fetch available serial numbers pool
  useEffect(() => {
    let active = true;
    setLoadingSerials(true);
    apiFetch(apiUrl('/api/orders/available-serials'), { headers: authHeaders(user) })
      .then((res) => res.json())
      .then((json) => {
        if (active && json.success && Array.isArray(json.data)) {
          const pool = {};
          const metaPool = {};
          json.data.forEach((item) => {
            const serials = item.availableSerials || [];
            const meta = item.serialsMetadata || {};
            if (item.productId) { pool[item.productId] = serials; metaPool[item.productId] = meta; }
            if (item.id) { pool[item.id] = serials; metaPool[item.id] = meta; }
            if (item.productCode) { pool[item.productCode] = serials; metaPool[item.productCode] = meta; }
            if (item.code) { pool[item.code] = serials; metaPool[item.code] = meta; }
            if (item.productName) { pool[item.productName] = serials; metaPool[item.productName] = meta; }
            if (item.name) { pool[item.name] = serials; metaPool[item.name] = meta; }
          });
          setStockSerialsPool(pool);
          setStockSerialsMetaPool(metaPool);

          // Auto-allocate serial numbers for any existing rows matching deliveryQty
          setRows((prev) => {
            return prev.map((r) => {
              if (!r.productId || r.serialized === false) return r;
              const dQty = Number(r.deliveryQty || 1);
              const key = r.productId || r.productCode || r.productName;
              const productSerials = pool[key] || pool[r.productCode] || [];
              if (dQty > 0 && productSerials.length > 0) {
                return {
                  ...r,
                  serialNumbers: productSerials.slice(0, dQty)
                };
              }
              return r;
            });
          });
        }
      })
      .catch((err) => console.warn('Could not fetch serials:', err))
      .finally(() => {
        if (active) setLoadingSerials(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  // Load customers, quotations and active employees for DC
  useEffect(() => {
    let active = true;

    // 1. Fetch customers
    apiFetch(apiUrl('/api/customers'), { headers: authHeaders(user) })
      .then((res) => res.json())
      .then((json) => {
        if (active && json.success && Array.isArray(json.data)) {
          setCustomers(json.data);
        }
      })
      .catch((err) => console.error('Failed to load customers for DC:', err));

    // 2. Fetch quotations
    apiFetch(apiUrl('/api/enquiries/quotations'), { headers: authHeaders(user) })
      .then((res) => res.json())
      .then((json) => {
        if (active && json.success && Array.isArray(json.data)) {
          setQuotations(json.data);
        }
      })
      .catch((err) => console.warn('Failed to load quotations for DC:', err));

    // 3. Fetch delivery challans (for pending/partial DC fulfillment)
    apiFetch(apiUrl('/api/orders/delivery-challans'), { headers: authHeaders(user) })
      .then((res) => res.json())
      .then((json) => {
        if (active && json.success && Array.isArray(json.data)) {
          setAllDeliveryChallans(json.data);
        }
      })
      .catch((err) => console.warn('Failed to load delivery challans in NewDcPage:', err));

    // 4. Fetch active employees from system settings
    apiFetch(apiUrl('/api/settings'), { headers: authHeaders(user) })
      .then((res) => res.json())
      .then((json) => {
        if (active && json.success && json.data?.users && Array.isArray(json.data.users)) {
          const activeUsers = json.data.users.filter((u) => u.status === 'Active');
          setEmployees(activeUsers);
        }
      })
      .catch((err) => {
        console.warn('Could not load employees from settings:', err);
        // Fallback default active employees if settings endpoint is restricted
        if (active) {
          setEmployees([
            { id: 'USR-003', name: 'John Doe', role: 'SUPER_ADMIN' },
            { id: 'USR-004', name: 'Rajesh Kumar', role: 'EMPLOYEE' },
            { id: 'USR-005', name: 'Sarah Jenkins', role: 'EMPLOYEE' },
            { id: 'USR-006', name: 'Gokul', role: 'EMPLOYEE' },
            { id: 'USR-007', name: 'Vijay', role: 'ADMIN' }
          ]);
        }
      });

    const handleCustomerCreatedGlobal = (e) => {
      const newCust = e.detail?.customer;
      if (newCust && newCust.id) {
        setCustomers((prev) => {
          if (prev.some((c) => c.id === newCust.id)) return prev;
          return [newCust, ...prev];
        });
      }
    };

    window.addEventListener('crm-customer-created', handleCustomerCreatedGlobal);
    return () => {
      active = false;
      window.removeEventListener('crm-customer-created', handleCustomerCreatedGlobal);
    };
  }, [user]);

  // Helper to format compact customer selection: "Customer Name — Company Name" or single name
  const formatCustomerSelection = (cust) => {
    if (!cust) return '';
    const name = String(cust.name || '').trim();
    const comp = String(cust.company || '').trim();
    if (name && comp && name.toLowerCase() !== comp.toLowerCase()) {
      return `${name} — ${comp}`;
    }
    return name || comp || '';
  };

  // Filtered customer list based on customerSearchQuery
  // Search strictly against: Customer Name, Company Name
  const filteredCustomers = useMemo(() => {
    const q = (customerSearchQuery || '').trim().toLowerCase();
    if (!q) return customers.slice(0, 50);
    const tokens = q.split(/\s+/).filter(Boolean);
    return customers.filter((c) => {
      const name = String(c.name || '').toLowerCase();
      const comp = String(c.company || '').toLowerCase();
      return tokens.every((t) => name.includes(t) || comp.includes(t));
    }).slice(0, 50);
  }, [customers, customerSearchQuery]);

  // Derive eligible quotations for selected customer (only ACCEPTED and CONVERTED)
  const customerEligibleQuotes = useMemo(() => {
    if (!selectedCustomerId && !dispatchTo) return [];
    return quotations.filter((q) => {
      const matchCust = (selectedCustomerId && q.customerId === selectedCustomerId) ||
        (dispatchTo && q.customerName && q.customerName.toLowerCase() === dispatchTo.toLowerCase()) ||
        (selectedCustomerObj?.name && q.customerName && q.customerName.toLowerCase() === selectedCustomerObj.name.toLowerCase());
      const statusUpper = String(q.status || '').toUpperCase();
      const isAcceptedOrConverted = statusUpper === 'ACCEPTED' || statusUpper === 'CONVERTED';
      return matchCust && isAcceptedOrConverted;
    });
  }, [quotations, selectedCustomerId, dispatchTo, selectedCustomerObj]);

  // Precise calculation of pending remaining balance for any DC item across partial fulfillment deliveries
  const getPendingItemBalance = useCallback((dc, it) => {
    if (!dc || !it) return 0;
    const origReq = Number(it.requiredQty || (Number(it.quantity || 0) + Number(it.remainingAfterThisDC ?? it.remainingQty ?? 0)));
    const parentDelivered = Number(it.quantity || 0);
    const origPending = Math.max(0, origReq - parentDelivered);

    const subsequentDCs = (allDeliveryChallans || []).filter(
      (other) => other.refNo === dc.challanId && other.challanId !== dc.challanId && other.status !== 'DRAFT'
    );
    const subsequentDelivered = subsequentDCs.reduce((sum, other) => {
      const match = (other.items || []).filter(
        (oi) => (oi.productId && oi.productId === it.productId) || (oi.productCode && oi.productCode === it.productCode)
      );
      return sum + match.reduce((s, m) => s + Number(m.quantity || 0), 0);
    }, 0);

    if (subsequentDCs.length > 0) {
      return Math.max(0, origPending - subsequentDelivered);
    }

    const directRem = Number(it.remainingAfterThisDC ?? it.remainingQty ?? 0);
    return directRem > 0 ? directRem : origPending;
  }, [allDeliveryChallans]);

  const getPendingDcTotalBalance = useCallback((dc) => {
    if (!dc) return 0;
    if (!Array.isArray(dc.items) || dc.items.length === 0) {
      return Number(dc.remainingAfterThisDC || 0);
    }
    return dc.items.reduce((sum, it) => sum + getPendingItemBalance(dc, it), 0);
  }, [getPendingItemBalance]);

  // Derive list of Pending / Partial Delivery Challans
  const pendingDeliveryChallans = useMemo(() => {
    return allDeliveryChallans.filter((dc) => {
      if (dc.status === 'DRAFT' || dc.documentType === 'PARTIAL_RETURN_DC') return false;

      const rawPending = Number(dc.remainingAfterThisDC || 0);
      const hasPartialItems = Array.isArray(dc.items) && dc.items.some((it) => {
        const rem = Number(it.remainingAfterThisDC ?? it.remainingQty ?? 0);
        const req = Number(it.requiredQty || 0);
        const cur = Number(it.quantity || 0);
        return rem > 0 || (req > cur && cur > 0) || it.status === 'PARTIAL';
      });

      const isMarkedPartial = dc.deliveryStatus === 'PARTIAL' || rawPending > 0 || hasPartialItems;
      if (!isMarkedPartial) return false;

      // If dc is a subsequent delivery referencing another parent DC, the root parent DC tracks remaining balance
      if (dc.refNo && allDeliveryChallans.some((other) => other.challanId === dc.refNo)) {
        return false;
      }

      return getPendingDcTotalBalance(dc) > 0;
    });
  }, [allDeliveryChallans, getPendingDcTotalBalance]);

  // Available pending DCs filtered for the currently selected customer (if customer is selected)
  const customerPendingDcs = useMemo(() => {
    if (!selectedCustomerId && !dispatchTo) return pendingDeliveryChallans;
    const normDispatch = (dispatchTo || '').toLowerCase().trim();
    return pendingDeliveryChallans.filter((dc) => {
      if (selectedCustomerId && dc.customerId === selectedCustomerId) return true;
      const dcCust = String(dc.customerName || '').toLowerCase().trim();
      const dcComp = String(dc.company || '').toLowerCase().trim();
      if (selectedCustomerObj?.name) {
        const sName = selectedCustomerObj.name.toLowerCase().trim();
        if (dcCust.includes(sName) || sName.includes(dcCust)) return true;
      }
      if (normDispatch && (dcCust.includes(normDispatch) || normDispatch.includes(dcCust) || (dcComp && normDispatch.includes(dcComp)))) {
        return true;
      }
      return false;
    });
  }, [pendingDeliveryChallans, selectedCustomerId, dispatchTo, selectedCustomerObj]);

  // Active pool of pending DCs (customer-specific if customer is selected, otherwise all)
  const activePendingDcs = useMemo(() => {
    if (selectedCustomerId || dispatchTo) {
      return customerPendingDcs;
    }
    return pendingDeliveryChallans;
  }, [selectedCustomerId, dispatchTo, customerPendingDcs, pendingDeliveryChallans]);

  // Filtered pending DCs based on refNoSearchQuery
  const filteredPendingDcs = useMemo(() => {
    const q = (refNoSearchQuery || '').trim().toLowerCase();
    if (!q) return activePendingDcs;
    let list = activePendingDcs.filter((dc) => {
      const cid = String(dc.challanId || '').toLowerCase();
      const cust = String(dc.customerName || '').toLowerCase();
      const comp = String(dc.company || '').toLowerCase();
      const qId = String(dc.quotationId || '').toLowerCase();
      const itNames = (dc.items || []).map((it) => `${it.productName || ''} ${it.productCode || ''}`).join(' ').toLowerCase();
      return cid.includes(q) || cust.includes(q) || comp.includes(q) || qId.includes(q) || itNames.includes(q);
    });
    // If no matches in customer list and user explicitly typed a search, also search all pending DCs
    if (list.length === 0 && (selectedCustomerId || dispatchTo)) {
      list = pendingDeliveryChallans.filter((dc) => {
        const cid = String(dc.challanId || '').toLowerCase();
        const cust = String(dc.customerName || '').toLowerCase();
        const comp = String(dc.company || '').toLowerCase();
        const qId = String(dc.quotationId || '').toLowerCase();
        const itNames = (dc.items || []).map((it) => `${it.productName || ''} ${it.productCode || ''}`).join(' ').toLowerCase();
        return cid.includes(q) || cust.includes(q) || comp.includes(q) || qId.includes(q) || itNames.includes(q);
      });
    }
    return list;
  }, [activePendingDcs, pendingDeliveryChallans, selectedCustomerId, dispatchTo, refNoSearchQuery]);

  // Reset highlighted Ref No index when results change
  useEffect(() => {
    setHighlightedRefNoIndex(0);
  }, [filteredPendingDcs]);

  // Handle outside click & single autocomplete open for Ref No dropdown
  useEffect(() => {
    if (!isRefNoDropdownOpen) return;

    const handleClickOutside = (e) => {
      if (refNoContainerRef.current && !refNoContainerRef.current.contains(e.target)) {
        setIsRefNoDropdownOpen(false);
        setIsRefNoEditing(false);
        setRefNoSearchQuery('');
      }
    };
    const handleOtherOpened = (e) => {
      if (e.detail?.id !== 'dc-refno-select') {
        setIsRefNoDropdownOpen(false);
        setIsRefNoEditing(false);
        setRefNoSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('crm-autocomplete-opened', handleOtherOpened);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('crm-autocomplete-opened', handleOtherOpened);
    };
  }, [isRefNoDropdownOpen]);

  // Scroll highlighted Ref No into view
  useEffect(() => {
    if (isRefNoDropdownOpen && refNoListboxRef.current) {
      const el = refNoListboxRef.current.children[highlightedRefNoIndex];
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedRefNoIndex, isRefNoDropdownOpen]);

  // Reset highlighted customer index when search results change
  useEffect(() => {
    setHighlightedCustomerIndex(0);
  }, [filteredCustomers]);

  // Handle outside click & single autocomplete open for customer dropdown
  useEffect(() => {
    if (!isCustomerDropdownOpen) return;

    const handleClickOutside = (e) => {
      if (customerContainerRef.current && !customerContainerRef.current.contains(e.target)) {
        setIsCustomerDropdownOpen(false);
        setIsCustomerEditing(false);
        setCustomerSearchQuery('');
      }
    };
    const handleOtherOpened = (e) => {
      if (e.detail?.id !== 'dc-customer-select') {
        setIsCustomerDropdownOpen(false);
        setIsCustomerEditing(false);
        setCustomerSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('crm-autocomplete-opened', handleOtherOpened);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('crm-autocomplete-opened', handleOtherOpened);
    };
  }, [isCustomerDropdownOpen]);

  // Scroll highlighted customer into view
  useEffect(() => {
    if (isCustomerDropdownOpen && customerListboxRef.current) {
      const el = customerListboxRef.current.children[highlightedCustomerIndex];
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedCustomerIndex, isCustomerDropdownOpen]);

  // Select customer helper for DC
  const handleSelectCustomer = (customer) => {
    if (!customer) return;
    setSelectedCustomerId(customer.id || '');
    setSelectedCustomerObj(customer);
    const displayStr = formatCustomerSelection(customer);
    setDispatchTo(displayStr);
    const addr = [customer.address, customer.city, customer.state].filter(Boolean).join(', ');
    if (addr) {
      setDeliveryAddress(addr);
    }
    if (customer.contactPerson || customer.name) {
      setReceiverName(customer.contactPerson || customer.name);
    }
    setIsCustomerDropdownOpen(false);
    setIsCustomerEditing(false);
    setCustomerSearchQuery('');
    setDuplicateAlert('');

    // Check for eligible customer quotations (only ACCEPTED and CONVERTED)
    const eligible = quotations.filter((q) => {
      const matchCust = q.customerId === customer.id ||
        (customer.name && q.customerName && q.customerName.toLowerCase() === customer.name.toLowerCase());
      const statusUpper = String(q.status || '').toUpperCase();
      const isAcceptedOrConverted = statusUpper === 'ACCEPTED' || statusUpper === 'CONVERTED';
      return matchCust && isAcceptedOrConverted;
    });

    if (eligible.length > 0) {
      const targetQuote = eligible[0];
      const qId = targetQuote.quotationId || targetQuote.id || '';
      setSelectedQuotationId(qId);
      const populated = aggregateQuotationItems(targetQuote.items, currentStocks);
      populated.push(createEmptyRow(Date.now() + 999));
      setRows(populated);
    } else {
      setSelectedQuotationId('');
      setRows([createEmptyRow()]);
    }
  };

  const handleClearCustomer = (e) => {
    e?.stopPropagation?.();
    setDispatchTo('');
    setSelectedCustomerId('');
    setSelectedCustomerObj(null);
    setCustomerSearchQuery('');
    setIsCustomerEditing(false);
    setSelectedQuotationId('');
    setRows([createEmptyRow()]);
    setDuplicateAlert('');
    customerInputRef.current?.focus();
  };

  // Handle explicit quotation change from dropdown
  const handleQuotationChange = (qId) => {
    setSelectedQuotationId(qId);
    setDuplicateAlert('');
    if (!qId) {
      // Manual entry mode
      setRows([createEmptyRow()]);
      return;
    }
    const quote = quotations.find((q) => (q.quotationId === qId || q.id === qId));
    if (quote && Array.isArray(quote.items) && quote.items.length > 0) {
      const populated = aggregateQuotationItems(quote.items, currentStocks);
      populated.push(createEmptyRow(Date.now() + 999));
      setRows(populated);
    } else {
      setRows([createEmptyRow()]);
    }
  };

  // Executive Engineer selection handler
  const handleExecutiveEngineerChange = (e) => {
    const empId = e.target.value;
    setExecutiveEngineerId(empId);
    const emp = employees.find((u) => u.id === empId);
    setExecutiveEngineerName(emp ? emp.name : '');
  };

  // Material Returned By selection handler
  const handleMaterialReturnedByChange = (e) => {
    const empId = e.target.value;
    setMaterialReturnedById(empId);
    const emp = employees.find((u) => u.id === empId);
    setMaterialReturnedByName(emp ? emp.name : '');
  };


  const handleCustomerCreated = (newCust) => {
    setCustomers((prev) => [newCust, ...prev.filter((c) => c.id !== newCust.id)]);
    handleSelectCustomer(newCust);
    setIsAddCustomerModalOpen(false);
    setSuccess(`✓ Customer "${newCust.name}" created and selected for DC.`);
    setTimeout(() => setSuccess(''), 4000);
  };

  const handleSelectExistingCustomer = (existingCust) => {
    handleSelectCustomer(existingCust);
    setIsAddCustomerModalOpen(false);
    setSuccess(`✓ Existing customer "${existingCust.name}" selected.`);
    setTimeout(() => setSuccess(''), 4000);
  };

  const handleCustomerKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isCustomerDropdownOpen) {
        setIsCustomerDropdownOpen(true);
        window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: 'dc-customer-select' } }));
      } else {
        setHighlightedCustomerIndex((prev) => (prev < filteredCustomers.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isCustomerDropdownOpen) {
        setIsCustomerDropdownOpen(true);
        window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: 'dc-customer-select' } }));
      } else {
        setHighlightedCustomerIndex((prev) => (prev > 0 ? prev - 1 : Math.max(0, filteredCustomers.length - 1)));
      }
    } else if (e.key === 'Enter') {
      if (isCustomerDropdownOpen && filteredCustomers.length > 0) {
        e.preventDefault();
        const target = filteredCustomers[highlightedCustomerIndex] || filteredCustomers[0];
        if (target) {
          handleSelectCustomer(target);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsCustomerDropdownOpen(false);
      setIsCustomerEditing(false);
      setCustomerSearchQuery('');
    } else if (e.key === 'Tab') {
      if (isCustomerDropdownOpen) {
        setIsCustomerDropdownOpen(false);
        setIsCustomerEditing(false);
        setCustomerSearchQuery('');
      }
    }
  };

  // Available receiver contact persons from existing orders
  const receiverSuggestions = React.useMemo(() => {
    const map = new Map();
    orders.forEach((o) => {
      if (o.customerName && typeof o.customerName === 'string') {
        const key = o.customerName.trim().toLowerCase();
        if (!map.has(key)) map.set(key, { name: o.customerName.trim(), company: o.company || '' });
      }
      if (o.contactPerson && typeof o.contactPerson === 'string') {
        const key = o.contactPerson.trim().toLowerCase();
        if (!map.has(key)) map.set(key, { name: o.contactPerson.trim(), company: o.company || '' });
      }
      if (o.receiverName && typeof o.receiverName === 'string') {
        const key = o.receiverName.trim().toLowerCase();
        if (!map.has(key)) map.set(key, { name: o.receiverName.trim(), company: o.company || '' });
      }
    });
    return Array.from(map.values());
  }, [orders]);

  // Calculate delivery completion state reactively for preview and payload
  // Purpose: NORMAL DELIVERY -> DELIVERY CHALLAN; RETURNABLE / TEMPORARY -> RETURNABLE DC
  // Delivery status: PARTIAL vs COMPLETE
  const deliveryStatusPreview = useMemo(() => {
    const validItems = rows.filter((r) => r.productId);
    const currentDCQty = validItems.reduce((sum, r) => sum + Number(r.deliveryQty || 0), 0);
    const docTitle = deliveryPurpose === 'RETURNABLE' ? 'RETURNABLE DC' : 'DELIVERY CHALLAN';

    // 1. If linked to order, calculate against order line items
    if (selectedOrderId) {
      const linkedOrder = orders.find((o) => o.orderId === selectedOrderId);
      if (linkedOrder) {
        const orderRequiredQty = (linkedOrder.lineItems || []).reduce(
          (sum, li) => sum + Number(li.quantity || 0),
          0
        );
        const remainingAfterThisDC = Math.max(0, orderRequiredQty - currentDCQty);
        const isPartial = remainingAfterThisDC > 0;
        return {
          title: docTitle,
          isPartial,
          deliveryStatus: isPartial ? 'PARTIAL' : 'COMPLETE',
          remainingAfterThisDC,
          orderRequiredQty,
          currentDCQty
        };
      }
    }

    // 2. Calculate against quotation and row-level requiredQty
    const totalRequiredQty = validItems.reduce(
      (sum, r) => sum + Number(r.requiredQty !== undefined ? r.requiredQty : r.deliveryQty || 0),
      0
    );
    const remainingAfterThisDC = Math.max(0, totalRequiredQty - currentDCQty);
    const isPartial = remainingAfterThisDC > 0 && currentDCQty > 0;

    return {
      title: docTitle,
      isPartial,
      deliveryStatus: isPartial ? 'PARTIAL' : 'COMPLETE',
      remainingAfterThisDC,
      orderRequiredQty: totalRequiredQty,
      currentDCQty
    };
  }, [deliveryPurpose, selectedOrderId, orders, rows]);

  const filteredReceivers = React.useMemo(() => {
    const q = receiverName.trim().toLowerCase();
    if (!q) return receiverSuggestions.slice(0, 8);
    return receiverSuggestions
      .filter((r) => r.name.toLowerCase().includes(q) || r.company.toLowerCase().includes(q))
      .slice(0, 8);
  }, [receiverSuggestions, receiverName]);

  // Handle outside click & single autocomplete open for receiver dropdown
  useEffect(() => {
    if (!isReceiverOpen) return;

    const handleClickOutside = (e) => {
      if (receiverContainerRef.current && !receiverContainerRef.current.contains(e.target)) {
        setIsReceiverOpen(false);
      }
    };
    const handleOtherOpened = (e) => {
      if (e.detail?.id !== 'dc-receiver-select') {
        setIsReceiverOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('crm-autocomplete-opened', handleOtherOpened);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('crm-autocomplete-opened', handleOtherOpened);
    };
  }, [isReceiverOpen]);

  // Handle reference mode change (Pending Delivery vs Ref No)
  const handleRefModeChange = (newMode) => {
    setRefMode(newMode);
    if (newMode === 'REF_NO') {
      setIsRefNoDropdownOpen(false);
      setIsRefNoEditing(false);
      setRefNoSearchQuery('');
      // If table had pending DC locked rows, reset to normal editable row
      const hadPendingRows = rows.some((r) => r.isFromPendingDc);
      if (hadPendingRows || selectedPendingDcId) {
        setSelectedPendingDcId('');
        setRows([createEmptyRow()]);
      }
      const targetVal = manualRefNo || (selectedPendingDcId ? '' : refNo);
      setRefNo(targetVal);
      setTimeout(() => {
        manualRefInputRef.current?.focus();
      }, 50);
    } else {
      // Switching to Pending Delivery
      setManualRefNo(refNo);
      setRefNo(selectedPendingDcId || '');
      setTimeout(() => {
        refNoInputRef.current?.focus();
      }, 50);
    }
  };

  // Handle Pending Delivery Challan selection from combobox
  const handleSelectPendingDc = (dc) => {
    if (!dc) return;
    setRefMode('PENDING');
    setSelectedPendingDcId(dc.challanId);
    setRefNo(dc.challanId);
    setRefNoSearchQuery('');
    setIsRefNoEditing(false);
    setIsRefNoDropdownOpen(false);
    setDuplicateAlert('');

    if (dc.orderId) setSelectedOrderId(dc.orderId);

    // Auto-populate customer
    const custText = dc.customerName || formatCustomerSelection({ name: dc.customerName, company: dc.company });
    setDispatchTo(custText);
    if (dc.customerId) {
      setSelectedCustomerId(dc.customerId);
      const found = customers.find((c) => c.id === dc.customerId);
      if (found) setSelectedCustomerObj(found);
    } else {
      const found = customers.find((c) => c.name?.toLowerCase() === dc.customerName?.toLowerCase());
      if (found) {
        setSelectedCustomerId(found.id);
        setSelectedCustomerObj(found);
      }
    }

    // Auto-populate delivery destination address
    const addr = dc.deliveryAddress || dc.customerAddress || '';
    if (addr) setDeliveryAddress(addr);

    // Auto-populate Quotation Ref
    if (dc.quotationId) {
      setSelectedQuotationId(dc.quotationId);
    }

    // Transit and dispatch details
    if (dc.transitMode) setTransitMode(dc.transitMode);
    if (dc.vehicleDetails) setVehicleDetails(dc.vehicleDetails);
    if (dc.receiverName) setReceiverName(dc.receiverName);
    if (dc.executiveEngineerId) setExecutiveEngineerId(dc.executiveEngineerId);
    if (dc.executiveEngineer) setExecutiveEngineerName(dc.executiveEngineer);
    if (dc.materialReturnedById) setMaterialReturnedById(dc.materialReturnedById);
    if (dc.materialReturnedBy) setMaterialReturnedByName(dc.materialReturnedBy);
    if (dc.deliveryPurpose) setDeliveryPurpose(dc.deliveryPurpose);

    // Populate items with pending quantities
    if (Array.isArray(dc.items) && dc.items.length > 0) {
      const populatedRows = [];
      dc.items.forEach((it, idx) => {
        const targetQty = getPendingItemBalance(dc, it);

        if (targetQty > 0) {
          const matchingStock = currentStocks.find((s) =>
            (s.id && (s.id === it.productId || s.productId === it.productId)) ||
            (s.code && s.code === it.productCode) ||
            (s.name && it.productName && s.name.toLowerCase() === it.productName.toLowerCase())
          ) || {};
          const avail = Number(matchingStock.stock !== undefined ? matchingStock.stock : 0);
          const deliveryQty = avail > 0 ? Math.min(targetQty, avail) : 0;
          const isSerialized = matchingStock.serialized !== false;
          const key = it.productId || matchingStock.id || it.productCode || matchingStock.code || it.productName;
          const serialList = stockSerialsPool[key] || stockSerialsPool[matchingStock.code] || [];
          const autoSerials = isSerialized && deliveryQty > 0 ? serialList.slice(0, deliveryQty) : [];

          populatedRows.push({
            id: Date.now() + idx,
            productId: it.productId || matchingStock.id || '',
            productCode: it.productCode || matchingStock.code || '',
            productName: it.productName || it.name || matchingStock.name || 'Equipment',
            productType: matchingStock.categoryName || matchingStock.category || it.productType || 'Finished Goods',
            godown: it.godown || 'Main Godown - Chennai',
            availableQty: avail,
            requiredQty: targetQty,
            deliveryQty: deliveryQty,
            qtyError: avail <= 0 ? 'Product is out of stock.' : (avail < targetQty ? `Only ${avail} available in stock.` : ''),
            unit: it.unit || matchingStock.unit || 'Piece',
            hsnSac: it.hsnSac || matchingStock.hsnSac || '85258090',
            unitPrice: Number(it.unitPrice || matchingStock.dealerPrice || 0),
            gst: Number(it.gst || matchingStock.gst || 18),
            serialized: isSerialized,
            serialNumbers: autoSerials,
            isFromPendingDc: true
          });
        }
      });

      if (populatedRows.length > 0) {
        setRows(populatedRows);
      } else {
        // Fallback if targetQty calculated to 0 but DC was marked pending
        const fallbackRows = dc.items.map((it, idx) => {
          const matchingStock = currentStocks.find((s) =>
            (s.id && (s.id === it.productId || s.productId === it.productId)) ||
            (s.code && s.code === it.productCode) ||
            (s.name && it.productName && s.name.toLowerCase() === it.productName.toLowerCase())
          ) || {};
          const avail = Number(matchingStock.stock !== undefined ? matchingStock.stock : 0);
          const q = Number(it.remainingAfterThisDC ?? it.remainingQty ?? it.quantity ?? 1);
          return {
            id: Date.now() + idx,
            productId: it.productId || matchingStock.id || '',
            productCode: it.productCode || matchingStock.code || '',
            productName: it.productName || it.name || matchingStock.name || 'Equipment',
            productType: matchingStock.categoryName || matchingStock.category || it.productType || 'Finished Goods',
            godown: it.godown || 'Main Godown - Chennai',
            availableQty: avail,
            requiredQty: q,
            deliveryQty: avail > 0 ? Math.min(q, avail) : 0,
            qtyError: avail <= 0 ? 'Product is out of stock.' : '',
            unit: it.unit || matchingStock.unit || 'Piece',
            hsnSac: it.hsnSac || matchingStock.hsnSac || '85258090',
            unitPrice: Number(it.unitPrice || matchingStock.dealerPrice || 0),
            gst: Number(it.gst || matchingStock.gst || 18),
            serialized: matchingStock.serialized !== false,
            serialNumbers: [],
            isFromPendingDc: true
          };
        });
        setRows(fallbackRows);
      }
    }

    setSuccess(`✓ Loaded pending delivery items from ${dc.challanId} (Ref No set to ${dc.challanId}).`);
    setTimeout(() => setSuccess(''), 4000);
  };

  // Clear Ref No
  const handleClearRefNo = (e) => {
    e?.stopPropagation?.();
    setRefNo('');
    setSelectedPendingDcId('');
    setRefNoSearchQuery('');
    setIsRefNoEditing(false);
    // If table had pending DC items, reset to a single clean empty row
    setRows((prev) => {
      const wasFromPending = prev.some((r) => r.isFromPendingDc);
      if (wasFromPending) {
        return [createEmptyRow()];
      }
      return prev;
    });
    refNoInputRef.current?.focus();
  };

  // Keyboard navigation for Ref No dropdown
  const handleRefNoKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isRefNoDropdownOpen) {
        setIsRefNoDropdownOpen(true);
        window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: 'dc-refno-select' } }));
      } else {
        setHighlightedRefNoIndex((prev) => (prev < filteredPendingDcs.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isRefNoDropdownOpen) {
        setIsRefNoDropdownOpen(true);
        window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: 'dc-refno-select' } }));
      } else {
        setHighlightedRefNoIndex((prev) => (prev > 0 ? prev - 1 : Math.max(0, filteredPendingDcs.length - 1)));
      }
    } else if (e.key === 'Enter') {
      if (isRefNoDropdownOpen && filteredPendingDcs.length > 0) {
        e.preventDefault();
        const target = filteredPendingDcs[highlightedRefNoIndex] || filteredPendingDcs[0];
        if (target) {
          handleSelectPendingDc(target);
        }
      } else {
        setIsRefNoDropdownOpen(false);
        setIsRefNoEditing(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsRefNoDropdownOpen(false);
      setIsRefNoEditing(false);
      setRefNoSearchQuery('');
    } else if (e.key === 'Tab') {
      setIsRefNoDropdownOpen(false);
      setIsRefNoEditing(false);
    }
  };

  // Handle item selection in an inline row
  const handleItemSelect = (rowIdx, prodId) => {
    if (rows[rowIdx]?.isFromPendingDc) return;
    if (!prodId) {
      setDuplicateAlert('');
      setRows((prev) => {
        const next = [...prev];
        next[rowIdx] = createEmptyRow(next[rowIdx].id || Date.now());
        // Clean up redundant trailing empty rows if more than 1 empty row at end
        while (next.length > 1 && !next[next.length - 1].productId && !next[next.length - 2].productId) {
          next.pop();
        }
        return next;
      });
      return;
    }

    // Strict duplicate check: Block if already added in any other row
    const isDuplicate = rows.some((r, idx) => idx !== rowIdx && r.productId === prodId);
    if (isDuplicate) {
      setDuplicateAlert('This product is already added.');
      return;
    }
    setDuplicateAlert('');

    const prod = currentStocks.find((p) => p.id === prodId);
    if (!prod) return;

    setRows((prev) => {
      const next = [...prev];
      const avail = Number(prod.stock !== undefined ? prod.stock : 0);
      const deliveryQty = avail > 0 ? 1 : 0;
      const isCable = isCableItem(prod);
      const isSerialized = !isCable && prod.serialized !== false;
      const qtyError = avail <= 0 ? 'Product is out of stock.' : '';

      const key = prod.id || prod.code || prod.name;
      const pool = isCable ? [] : (stockSerialsPool[key] || stockSerialsPool[prod.code] || []);
      const initialSerials = isSerialized && deliveryQty > 0
        ? pool.slice(0, deliveryQty)
        : [];

      next[rowIdx] = {
        ...next[rowIdx],
        productId: prod.id,
        productCode: prod.code || '',
        productName: prod.name || '',
        productType: prod.categoryName || prod.category || 'Finished Goods',
        godown: next[rowIdx].godown || 'Main Godown - Chennai',
        availableQty: avail,
        requiredQty: deliveryQty,
        deliveryQty: deliveryQty,
        qtyError,
        unit: (prod.unit && prod.unit !== 'Piece') ? prod.unit : 'Nos',
        hsnSac: prod.hsnSac || '85258090',
        unitPrice: Number(prod.dealerPrice || prod.cost || 0),
        gst: Number(prod.gst || 18),
        serialized: isSerialized,
        serialNumbers: initialSerials
      };

      // Ensure exactly one next empty row appears UNDER the populated row if it's the last row
      const isLast = rowIdx === next.length - 1;
      if (isLast) {
        next.push(createEmptyRow(Date.now() + Math.random()));
      } else {
        const hasEmpty = next.some((r) => !r.productId);
        if (!hasEmpty) {
          next.push(createEmptyRow(Date.now() + Math.random()));
        }
      }

      return next;
    });
  };

  // Change required quantity (e.g. customer required 4 cameras, but only 2 delivered now)
  const handleRequiredQtyChange = (rowIdx, val) => {
    // If loaded from a pending DC, quantity is strictly locked to remaining balance
    if (rows[rowIdx]?.isFromPendingDc) return;

    if (val === '' || val === null || val === undefined) {
      setRows((prev) => {
        const next = [...prev];
        next[rowIdx] = {
          ...next[rowIdx],
          requiredQty: '',
          qtyError: 'Please enter required quantity.'
        };
        return next;
      });
      return;
    }

    const parsed = Number(val);
    const parsedInt = parseInt(val, 10);
    const num = isNaN(parsedInt) ? '' : parsedInt;

    setRows((prev) => {
      const next = [...prev];
      const r = next[rowIdx];
      const avail = Number(r.availableQty || 0);

      let qtyError = '';
      if (isNaN(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
        qtyError = 'Required quantity must be a positive integer.';
      }

      // If deliveryQty exceeds new requiredQty, cap deliveryQty
      let curDeliv = Number(r.deliveryQty || 0);
      if (num && curDeliv > num) {
        curDeliv = num;
      }
      if (!qtyError && avail > 0 && curDeliv > avail) {
        qtyError = `Maximum available quantity is ${avail} for "${r.productName}".`;
      }

      const key = r.productId || r.productCode || r.productName;
      const pool = stockSerialsPool[key] || stockSerialsPool[r.productCode] || [];
      const isCable = isCableItem(r);
      let updatedSerials = [];
      if (r.serialized !== false && !isCable) {
        if (!curDeliv || curDeliv <= 0) {
          updatedSerials = [];
        } else {
          updatedSerials = pool.slice(0, curDeliv);
        }
      }

      next[rowIdx] = {
        ...r,
        serialized: !isCable && r.serialized !== false,
        requiredQty: isNaN(parsed) ? val : parsed,
        deliveryQty: curDeliv,
        qtyError,
        serialNumbers: updatedSerials
      };
      return next;
    });
  };

  // Change delivery quantity with strict bounds validation matching Quotation pattern
  const handleQtyChange = (rowIdx, val) => {
    // Check if input is empty while typing
    if (val === '' || val === null || val === undefined) {
      setRows((prev) => {
        const next = [...prev];
        const r = next[rowIdx];
        const avail = Number(r.availableQty || 0);
        const qtyError = avail <= 0 ? 'Product is out of stock.' : 'Please enter a valid quantity.';
        next[rowIdx] = {
          ...r,
          deliveryQty: '',
          qtyError,
          serialNumbers: []
        };
        return next;
      });
      return;
    }

    const parsed = Number(val);
    const parsedInt = parseInt(val, 10);
    const num = isNaN(parsedInt) ? '' : parsedInt;

    setRows((prev) => {
      const next = [...prev];
      const r = next[rowIdx];
      const avail = Number(r.availableQty || 0);
      const req = Number(r.requiredQty !== undefined && r.requiredQty !== '' ? r.requiredQty : parsed);

      let qtyError = '';
      if (avail <= 0) {
        qtyError = 'Product is out of stock.';
      } else if (isNaN(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
        qtyError = 'Delivery quantity must be a positive integer.';
      } else if (parsed > avail) {
        qtyError = `Maximum available quantity is ${avail} for "${r.productName}".`;
      } else if (req > 0 && parsed > req) {
        qtyError = `Delivery quantity cannot exceed required quantity (${req}).`;
      }

      // If user corrected quantity, clear any matching top-level error
      if (!qtyError) {
        setError((prevErr) => (prevErr && prevErr.includes(r.productName) ? '' : prevErr));
      }

      const key = r.productId || r.productCode || r.productName;
      const pool = stockSerialsPool[key] || stockSerialsPool[r.productCode] || [];
      const isCable = isCableItem(r);

      let updatedSerials = [];
      if (r.serialized !== false && !isCable) {
        if (!num || num <= 0) {
          updatedSerials = [];
        } else {
          updatedSerials = pool.slice(0, num);
        }
      }

      next[rowIdx] = {
        ...r,
        serialized: !isCable && r.serialized !== false,
        deliveryQty: isNaN(parsed) ? val : parsed,
        qtyError,
        serialNumbers: updatedSerials
      };
      return next;
    });
  };

  // Remove row
  const handleRemoveRow = (rowIdx) => {
    if (rows[rowIdx]?.isFromPendingDc) return;
    setDuplicateAlert('');
    setRows((prev) => {
      if (prev.length <= 1) {
        return [createEmptyRow()];
      }
      const next = prev.filter((_, idx) => idx !== rowIdx);
      const hasEmpty = next.some((r) => !r.productId);
      if (!hasEmpty) {
        next.push(createEmptyRow(Date.now() + Math.random()));
      }
      return next;
    });
  };

  // Add Row button control below table
  const handleAddRow = () => {
    if (selectedPendingDcId || rows.some((r) => r.isFromPendingDc)) return;
    setDuplicateAlert('');
    setRows((prev) => {
      const last = prev[prev.length - 1];
      if (last && !last.productId) {
        return prev;
      }
      return [...prev, createEmptyRow(Date.now() + Math.random())];
    });
  };

  // Auto assign serial numbers
  const handleAutoAssignRowSerials = (rowIdx) => {
    const r = rows[rowIdx];
    if (!r || !r.productId) return;

    if (r.serialized === false) {
      setError(`Notice: "${r.productName}" is non-serialized. Serial numbers are not tracked.`);
      return;
    }

    const key = r.productId || r.productCode || r.productName;
    const pool = stockSerialsPool[key] || stockSerialsPool[r.productCode] || [];
    const needed = Number(r.deliveryQty || 1);

    if (pool.length < needed) {
      setError(`${needed} serial numbers are required, but only ${pool.length} are available.`);
      return;
    }

    const assigned = pool.slice(0, needed);
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], serialNumbers: assigned };
      return next;
    });
    setError('');
  };

  // Navigate to Add/Edit Product in Product Master with full DC state preserved
  const handleAddProductToMaster = (rowId = null) => {
    let targetRow = null;
    if (rowId) {
      targetRow = rows.find((r) => r.id === rowId);
    }

    const preload = {};
    if (targetRow && targetRow.productId) {
      const matched = (currentStocks || []).find((p) =>
        p.id === targetRow.productId ||
        p.productId === targetRow.productId ||
        p.code === targetRow.productId ||
        p.code === targetRow.productCode
      );
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
    }

    // 1. Explicitly persist current delivery challan draft
    try {
      const draftData = {
        deliveryDate,
        deliveryPurpose,
        dispatchTo,
        selectedCustomerId,
        selectedCustomerObj,
        deliveryAddress,
        selectedOrderId,
        refNo,
        selectedPendingDcId,
        refMode,
        manualRefNo,
        selectedQuotationId,
        transitMode,
        vehicleDetails,
        receiverName,
        executiveEngineerId,
        executiveEngineerName,
        materialReturnedById,
        materialReturnedByName,
        remarks,
        status,
        rows,
        timestamp: Date.now()
      };
      sessionStorage.setItem('asicrm_dc_draft', JSON.stringify(draftData));

      if (Object.keys(preload).length > 0) {
        sessionStorage.setItem('asicrm_product_preload', JSON.stringify(preload));
      } else {
        sessionStorage.removeItem('asicrm_product_preload');
      }

      if (rowId || targetRow?.id) {
        sessionStorage.setItem('asicrm_dc_target_row_id', String(rowId || targetRow.id));
      } else {
        sessionStorage.removeItem('asicrm_dc_target_row_id');
      }
    } catch (e) {
      console.warn('Failed to save DC draft before navigating to Add Product:', e);
    }

    // 2. Set origin and return URL
    const returnPath = window.location.pathname + window.location.search;
    try {
      sessionStorage.setItem('asicrm_product_return', returnPath);
      sessionStorage.setItem('asicrm_product_from', 'dc');
    } catch (e) {}

    // 3. Navigate to Product Master Add Product page
    navigate(`/stocks/products/new?from=dc&returnTo=${encodeURIComponent(returnPath)}`);
  };

  // Submit delivery challan
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setDuplicateAlert('');

    if (!dispatchTo.trim()) {
      setError('Please provide a Customer / Consignee name for dispatch.');
      return;
    }

    const validItems = rows.filter((r) => r.productId);
    if (validItems.length === 0) {
      setError('Please select at least one item from inventory for delivery.');
      return;
    }

    // Verify duplicate product rows before submit
    const seen = new Set();
    for (const r of validItems) {
      if (seen.has(r.productId)) {
        setError(`This product is already added: "${r.productName}". Duplicate products are not permitted.`);
        return;
      }
      seen.add(r.productId);
    }

    // Strict validation per item: 0 < deliveryQty <= availableQty
    for (const r of validItems) {
      const dQty = Number(r.deliveryQty);
      const reqQty = Number(r.requiredQty !== undefined && r.requiredQty !== '' ? r.requiredQty : dQty);
      if (!reqQty || isNaN(reqQty) || !Number.isInteger(reqQty) || reqQty <= 0) {
        setError(`Required quantity must be a positive integer for ${r.productName || 'selected product'}.`);
        return;
      }
      if (!dQty || isNaN(dQty) || !Number.isInteger(dQty) || dQty <= 0) {
        setError(`Delivery quantity must be a positive integer for ${r.productName || 'selected product'}.`);
        return;
      }
      if (dQty > reqQty) {
        setError(`Delivery quantity (${dQty}) cannot exceed required quantity (${reqQty}) for "${r.productName}".`);
        return;
      }
      if (r.availableQty <= 0) {
        setError(`Cannot dispatch "${r.productName}". Product is currently OUT OF STOCK.`);
        return;
      }
      if (dQty > r.availableQty) {
        setError(`Maximum available quantity is ${r.availableQty} for "${r.productName}".`);
        return;
      }
      // If item is serialized, require exact active serial allocation
      if (r.serialized !== false && !isCableItem(r)) {
        const key = r.productId || r.productCode || r.productName;
        const pool = stockSerialsPool[key] || stockSerialsPool[r.productCode] || [];
        if (pool.length < dQty) {
          setError(`Delivery quantity requires ${dQty} serial numbers for "${r.productName}", but only ${pool.length} are currently available in active inventory.`);
          return;
        }
        if (!Array.isArray(r.serialNumbers) || r.serialNumbers.length !== dQty) {
          r.serialNumbers = pool.slice(0, dQty);
        }
        if (!Array.isArray(r.serialNumbers) || r.serialNumbers.length !== dQty) {
          setError(`Please allocate exactly ${dQty} serial numbers for serialized product "${r.productName}" (${r.serialNumbers?.length || 0} allocated). Click 'SN' to allocate.`);
          return;
        }
        // Disallow duplicate serial numbers
        const uniqueSerials = new Set(r.serialNumbers);
        if (uniqueSerials.size !== r.serialNumbers.length) {
          setError(`Duplicate serial numbers found for ${r.productName}. Each unit must have a unique serial.`);
          return;
        }
      }
    }

    // Live re-fetch from /api/stocks to ensure current available stock right before save
    try {
      const stockRes = await apiFetch(apiUrl('/api/stocks'), { headers: authHeaders(user) });
      const stockJson = await stockRes.json();
      const liveProducts = stockJson?.data?.products || (Array.isArray(stockJson?.data) ? stockJson.data : []);

      for (const r of validItems) {
        const liveP = liveProducts.find((p) => p.id === r.productId || p.code === r.productCode);
        const liveAvail = Number(liveP ? (liveP.stock !== undefined ? liveP.stock : 0) : r.availableQty);
        if (liveAvail <= 0) {
          setError(`Cannot dispatch "${r.productName}". Product is currently OUT OF STOCK.`);
          return;
        }
        if (Number(r.deliveryQty) > liveAvail) {
          setError(`Maximum available quantity is ${liveAvail} for "${r.productName}".`);
          return;
        }
      }
    } catch (e) {
      console.warn('Live stock verification warning:', e);
    }

    const payload = {
      deliveryDate,
      deliveryPurpose,
      deliveryStatus: deliveryStatusPreview.deliveryStatus,
      customerId: selectedCustomerId || undefined,
      customerName: dispatchTo.trim(),
      customerAddress: deliveryAddress.trim(),
      orderId: selectedOrderId || undefined,
      quotationId: selectedQuotationId || undefined,
      refNo: refNo.trim() || undefined,
      transitMode: transitMode || 'Road Express',
      vehicleDetails: vehicleDetails.trim() || undefined,
      receiverName: receiverName.trim() || undefined,
      executiveEngineer: executiveEngineerName || undefined,
      executiveEngineerId: executiveEngineerId || undefined,
      materialReturnedBy: materialReturnedByName || undefined,
      materialReturnedById: materialReturnedById || undefined,
      remarks: remarks.trim() || undefined,
      status: status || 'DISPATCHED',
      documentType: deliveryPurpose === 'RETURNABLE' ? 'RETURNABLE_DC' : 'DELIVERY_CHALLAN',
      remainingAfterThisDC: deliveryStatusPreview.remainingAfterThisDC,
      items: validItems.map((r) => {
        const dQty = Number(r.deliveryQty);
        const reqQty = Number(r.requiredQty !== undefined ? r.requiredQty : dQty);
        const remQty = Math.max(0, reqQty - dQty);
        return {
          productId: r.productId,
          productCode: r.productCode,
          productName: r.productName,
          godown: r.godown,
          requiredQty: reqQty,
          quantity: dQty,
          remainingQty: remQty,
          status: remQty > 0 ? 'PARTIAL' : 'COMPLETE',
          unit: (r.unit && r.unit !== 'Piece') ? r.unit : 'Nos',
          hsnSac: r.hsnSac || '85258090',
          unitPrice: Number(r.unitPrice || 0),
          gst: Number(r.gst || 18),
          serialized: r.serialized !== false && !isCableItem(r),
          serialNumbers: (r.serialized !== false && !isCableItem(r)) ? (r.serialNumbers || []) : []
        };
      })
    };


    setSubmitting(true);
    try {
      const res = await apiFetch(apiUrl('/api/orders/delivery-challans'), {
        method: 'POST',
        headers: authHeaders(user),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create Delivery Challan');
      }

      setSuccess(`Delivery Challan ${data.data.challanId} generated successfully!`);
      if (onSuccess) {
        setTimeout(() => {
          onSuccess(data.data);
        }, 600);
      } else {
        setTimeout(() => {
          navigate('/delivery-challans/dispatch');
        }, 800);
      }
    } catch (err) {
      setError(err.message || 'Error creating delivery challan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="delivery-challans-new-page dc-page-container new-dc-page">
      {/* Page Header (No subtitle, compact) */}
      <div className="dc-page-header compact-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 className="dc-page-title">New Delivery Challan</h2>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '4px',
              background: deliveryPurpose === 'RETURNABLE' ? '#ede9fe' : '#dcfce7',
              color: deliveryPurpose === 'RETURNABLE' ? '#5b21b6' : '#166534',
              border: `1px solid ${deliveryPurpose === 'RETURNABLE' ? '#ddd6fe' : '#bbf7d0'}`
            }}
          >
            Doc: {deliveryPurpose === 'RETURNABLE' ? 'RETURN DELIVERY' : 'DELIVERY CHALLAN'}
          </span>
        </div>
        <div className="dc-header-actions">
          <button
            type="button"
            className="crm-btn-secondary compact"
            onClick={onCancel || (() => navigate('/delivery-challans'))}
          >
            ← Back to DC Overview
          </button>
        </div>
      </div>

      {error && (
        <div className="crm-alert-box error" style={{ marginBottom: '8px', padding: '6px 12px' }}>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="crm-alert-box success" style={{ marginBottom: '8px', padding: '6px 12px' }}>
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="dc-form-card new-dc-form">
        {/* SECTION 1: DISPATCH INFORMATION (No redundant heading) */}
        <div className="dc-form-section dc-dispatch-info-section">
          <div className="dc-form-grid-dispatch-1">
            <div className="crm-form-group dc-group-date">
              <label className="crm-form-label">DC Date *</label>
              <input
                type="date"
                className="crm-form-input"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                required
              />
            </div>

            <div className="crm-form-group dc-group-dispatch-to" ref={customerContainerRef} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px', gap: '6px' }}>
                <label className="crm-form-label" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Dispatch To (Customer) *
                </label>
                <button
                  type="button"
                  className="add-new-customer-trigger-btn"
                  style={{ padding: '2px 6px', fontSize: '11px', height: '20px', borderRadius: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}
                  onClick={() => {
                    setInitialCustomerName(customerSearchQuery || dispatchTo);
                    setIsAddCustomerModalOpen(true);
                    setIsCustomerDropdownOpen(false);
                  }}
                  title="Add new customer"
                >
                  <UserPlus size={12} strokeWidth={2.5} />
                  <span>+ New</span>
                </button>
              </div>

              <div
                className={`sps-input-trigger-wrapper ${isCustomerDropdownOpen ? 'is-focused' : ''}`}
                style={{ height: '32px', minHeight: '32px', cursor: 'text' }}
                onClick={() => {
                  if (customerInputRef.current) {
                    customerInputRef.current.focus();
                    setIsCustomerDropdownOpen(true);
                    window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: 'dc-customer-select' } }));
                  }
                }}
              >
                <Search size={14} className="sps-empty-icon" style={{ marginRight: '6px', color: '#94a3b8', flexShrink: 0 }} />
                <input
                  ref={customerInputRef}
                  type="text"
                  className="sps-direct-input"
                  placeholder="Select Customer / Company"
                  value={isCustomerEditing ? customerSearchQuery : dispatchTo}
                  onFocus={() => {
                    setIsCustomerEditing(true);
                    setCustomerSearchQuery('');
                    setIsCustomerDropdownOpen(true);
                    window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: 'dc-customer-select' } }));
                  }}
                  onChange={(e) => {
                    setIsCustomerEditing(true);
                    setCustomerSearchQuery(e.target.value);
                    if (!isCustomerDropdownOpen) {
                      setIsCustomerDropdownOpen(true);
                      window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: 'dc-customer-select' } }));
                    }
                  }}
                  onKeyDown={handleCustomerKeyDown}
                  required
                  autoComplete="off"
                  spellCheck="false"
                  style={{ fontSize: '12.5px' }}
                />
                <div className="sps-input-actions">
                  {(dispatchTo || customerSearchQuery) && (
                    <button
                      type="button"
                      className="sps-clear-btn"
                      onClick={handleClearCustomer}
                      tabIndex={-1}
                      title="Clear customer"
                      aria-label="Clear customer"
                    >
                      <X size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="sps-chevron-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isCustomerDropdownOpen) {
                        setIsCustomerDropdownOpen(false);
                        setIsCustomerEditing(false);
                        setCustomerSearchQuery('');
                      } else {
                        customerInputRef.current?.focus();
                        setIsCustomerDropdownOpen(true);
                        window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: 'dc-customer-select' } }));
                      }
                    }}
                    tabIndex={-1}
                    aria-label="Toggle customer list"
                  >
                    <ChevronDown
                      size={14}
                      style={{
                        transform: isCustomerDropdownOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.15s ease'
                      }}
                    />
                  </button>
                </div>
              </div>

              {isCustomerDropdownOpen && (
                <ul className="scs-dropdown-list is-dc-customer" ref={customerListboxRef} role="listbox">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map((cust, idx) => {
                      const isHighlighted = idx === highlightedCustomerIndex;
                      const isSelected = selectedCustomerId
                        ? selectedCustomerId === cust.id
                        : (dispatchTo && (dispatchTo === formatCustomerSelection(cust) || dispatchTo === cust.name));
                      const custName = String(cust.name || '').trim();
                      const compName = String(cust.company || '').trim();
                      const hasDistinctComp = compName && compName.toLowerCase() !== custName.toLowerCase();

                      return (
                        <li
                          key={cust.id}
                          className={`scs-option-item is-dc-customer ${isHighlighted ? 'is-highlighted' : ''} ${isSelected ? 'is-selected' : ''}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectCustomer(cust);
                          }}
                          onClick={() => handleSelectCustomer(cust)}
                          onMouseEnter={() => setHighlightedCustomerIndex(idx)}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <div className="dc-cust-item-wrap">
                            <div className="dc-cust-name">{custName || compName}</div>
                            {hasDistinctComp && (
                              <div className="dc-cust-company">{compName}</div>
                            )}
                          </div>
                        </li>
                      );
                    })
                  ) : (
                    <li className="scs-no-results">
                      <div style={{ color: '#64748b', fontSize: '12.5px', padding: '12px 16px', textAlign: 'center' }}>
                        No matching customers found
                      </div>
                    </li>
                  )}
                </ul>
              )}
            </div>

            <div className="crm-form-group dc-group-quotation">
              <label className="crm-form-label">
                Quotation Ref {customerEligibleQuotes.length > 0 && <span style={{ color: '#16a34a', fontWeight: 600 }}>({customerEligibleQuotes.length} found)</span>}
              </label>
              <select
                className="crm-form-input"
                value={selectedQuotationId}
                onChange={(e) => handleQuotationChange(e.target.value)}
              >
                {customerEligibleQuotes.length > 0 ? (
                  <>
                    {customerEligibleQuotes.map((q) => {
                      const qNo = q.quotationId || q.id;
                      const rawDate = q.createdAt || q.quotationDate || q.date || '';
                      const dateVal = rawDate ? formatDate(rawDate, '') : '';
                      const label = dateVal ? `${qNo} (${dateVal})` : qNo;
                      return (
                        <option key={qNo} value={qNo}>
                          {label}
                        </option>
                      );
                    })}
                    <option value="">-- No Quotation (Manual Entry) --</option>
                  </>
                ) : (
                  <option value="">-- No Eligible Quotation --</option>
                )}
              </select>
            </div>

            <div className="crm-form-group dc-group-ref-no" ref={refNoContainerRef} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                  <label className="crm-form-label" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {refMode === 'PENDING' ? 'PENDING DC' : 'REF NO'}
                  </label>
                  {refMode === 'PENDING' && activePendingDcs.length > 0 && (
                    <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      ({activePendingDcs.length})
                    </span>
                  )}
                </div>

                {/* Dropdown with the two options: Pending Delivery or Ref No */}
                <select
                  className="dc-ref-mode-select"
                  value={refMode}
                  onChange={(e) => handleRefModeChange(e.target.value)}
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#1e293b',
                    cursor: 'pointer',
                    height: '21px',
                    lineHeight: '19px',
                    outline: 'none',
                    flexShrink: 0
                  }}
                  title="Choose between Pending Delivery fulfillment or Manual Reference Number"
                >
                  <option value="PENDING">Pending Delivery</option>
                  <option value="REF_NO">Ref No</option>
                </select>
              </div>

              {refMode === 'REF_NO' ? (
                /* Dynamic Well-Designed Text Box for Ref No */
                <div
                  className="sps-input-trigger-wrapper is-manual-ref-box"
                  style={{
                    height: '32px',
                    minHeight: '32px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)'
                  }}
                >
                  <FileText size={14} className="sps-empty-icon" style={{ marginRight: '6px', color: '#64748b', flexShrink: 0 }} />
                  <input
                    ref={manualRefInputRef}
                    type="text"
                    className="sps-direct-input dc-manual-ref-input"
                    placeholder="Enter Reference / PO Number..."
                    value={refNo}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRefNo(val);
                      setManualRefNo(val);
                    }}
                    style={{ fontSize: '12.5px', width: '100%', border: 'none', outline: 'none', background: 'transparent' }}
                  />
                  {refNo && (
                    <button
                      type="button"
                      className="sps-clear-btn"
                      onClick={() => {
                        setRefNo('');
                        setManualRefNo('');
                        manualRefInputRef.current?.focus();
                      }}
                      tabIndex={-1}
                      title="Clear reference"
                      aria-label="Clear reference"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ) : (
                /* Pending Delivery Combobox (works as it is now) */
                <>
                  <div
                    className={`sps-input-trigger-wrapper ${isRefNoDropdownOpen ? 'is-focused' : ''}`}
                    style={{ height: '32px', minHeight: '32px', cursor: 'text' }}
                    onClick={() => {
                      if (refNoInputRef.current) {
                        refNoInputRef.current.focus();
                        setIsRefNoDropdownOpen(true);
                        window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: 'dc-refno-select' } }));
                      }
                    }}
                  >
                    <FileText size={14} className="sps-empty-icon" style={{ marginRight: '6px', color: '#94a3b8', flexShrink: 0 }} />
                    <input
                      ref={refNoInputRef}
                      type="text"
                      className="sps-direct-input"
                      placeholder="Type to search or select pending DC..."
                      value={isRefNoEditing ? refNoSearchQuery : refNo}
                      onFocus={() => {
                        setIsRefNoEditing(true);
                        setRefNoSearchQuery(refNo);
                        setIsRefNoDropdownOpen(true);
                        window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: 'dc-refno-select' } }));
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        setIsRefNoEditing(true);
                        setRefNoSearchQuery(val);
                        setRefNo(val);
                        if (!isRefNoDropdownOpen) {
                          setIsRefNoDropdownOpen(true);
                          window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: 'dc-refno-select' } }));
                        }
                      }}
                      onKeyDown={handleRefNoKeyDown}
                      autoComplete="off"
                      spellCheck="false"
                      style={{ fontSize: '12.5px' }}
                    />
                    <div className="sps-input-actions">
                      {(refNo || refNoSearchQuery) && (
                        <button
                          type="button"
                          className="sps-clear-btn"
                          onClick={handleClearRefNo}
                          tabIndex={-1}
                          title="Clear reference"
                          aria-label="Clear reference"
                        >
                          <X size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="sps-chevron-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isRefNoDropdownOpen) {
                            setIsRefNoDropdownOpen(false);
                            setIsRefNoEditing(false);
                          } else {
                            refNoInputRef.current?.focus();
                            setIsRefNoDropdownOpen(true);
                            window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: 'dc-refno-select' } }));
                          }
                        }}
                        tabIndex={-1}
                        aria-label="Toggle pending DC list"
                      >
                        <ChevronDown
                          size={14}
                          style={{
                            transform: isRefNoDropdownOpen ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.15s ease'
                          }}
                        />
                      </button>
                    </div>
                  </div>

                  {isRefNoDropdownOpen && (
                    <ul className="scs-dropdown-list is-dc-refno" ref={refNoListboxRef} role="listbox">
                      {filteredPendingDcs.length > 0 ? (
                        filteredPendingDcs.map((dc, idx) => {
                          const isHighlighted = idx === highlightedRefNoIndex;
                          const isSelected = selectedPendingDcId === dc.challanId || refNo === dc.challanId;
                          const dcItems = dc.items || [];
                          const pendingQty = getPendingDcTotalBalance(dc);
                          const primaryItemName = dcItems[0]?.productName || dcItems[0]?.productCode || '';
                          const itemSummary = primaryItemName
                            ? `${pendingQty} unit${pendingQty > 1 ? 's' : ''} pending • ${primaryItemName}${dcItems.length > 1 ? ` (+${dcItems.length - 1} more)` : ''}`
                            : `${pendingQty} unit${pendingQty > 1 ? 's' : ''} pending`;

                          return (
                            <li
                              key={dc.challanId}
                              className={`scs-option-item is-dc-refno ${isHighlighted ? 'is-highlighted' : ''} ${isSelected ? 'is-selected' : ''}`}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectPendingDc(dc);
                              }}
                              onClick={() => handleSelectPendingDc(dc)}
                              onMouseEnter={() => setHighlightedRefNoIndex(idx)}
                              role="option"
                              aria-selected={isSelected}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span className="dc-refno-badge">{dc.challanId}</span>
                                  {dc.deliveryDate && (
                                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                                      {formatDate(dc.deliveryDate, '')}
                                    </span>
                                  )}
                                </div>
                                <span className="dc-refno-status-badge">
                                  PARTIAL
                                </span>
                              </div>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                                {dc.customerName || dc.company || 'Consignee'}
                              </div>
                              <div style={{ fontSize: '11px', color: '#d97706', fontWeight: 500 }}>
                                {itemSummary}
                              </div>
                            </li>
                          );
                        })
                      ) : (
                        <li className="scs-no-results">
                          <div style={{ color: '#64748b', fontSize: '12px', padding: '10px 14px', textAlign: 'center' }}>
                            {refNoSearchQuery
                              ? `No pending DCs matching "${refNoSearchQuery}".`
                              : (selectedCustomerId || dispatchTo)
                                ? `No pending DCs for ${dispatchTo || 'selected customer'}.`
                                : 'No pending / partial DCs found.'}
                          </div>
                        </li>
                      )}
                      <li
                        className="scs-footer-action-item"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleRefModeChange('REF_NO');
                        }}
                      >
                        Enter manual Reference Number instead →
                      </li>
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="dc-form-grid-dispatch-2" style={{ marginTop: '5px' }}>
            <div className="crm-form-group dc-group-purpose">
              <label className="crm-form-label">DC Purpose</label>
              <select
                className="crm-form-input"
                value={deliveryPurpose}
                onChange={(e) => setDeliveryPurpose(e.target.value)}
              >
                <option value="NORMAL">Delivery Challan</option>
                <option value="RETURNABLE">Return Delivery</option>
              </select>
            </div>

            <div className="crm-form-group dc-group-transit">
              <label className="crm-form-label">Mode of Transit</label>
              <select
                className="crm-form-input"
                value={transitMode}
                onChange={(e) => setTransitMode(e.target.value)}
              >
                <option value="Road Express">Road Express</option>
                <option value="Road Transport">Road Transport</option>
                <option value="Courier / Cargo">Courier / Cargo</option>
                <option value="Hand Delivery / Field Engineer">Hand Delivery / Field Engineer</option>
                <option value="Porter">Porter</option>
              </select>
            </div>

            <div className="crm-form-group dc-group-docket">
              <label className="crm-form-label">Vehicle / Courier Docket No</label>
              <input
                type="text"
                className="crm-form-input"
                placeholder="e.g. TN-02-AB-9876 or BLUEDART-8829"
                value={vehicleDetails}
                onChange={(e) => setVehicleDetails(e.target.value)}
              />
            </div>

            <div className="crm-form-group dc-group-receiver" ref={receiverContainerRef} style={{ position: 'relative' }}>
              <label className="crm-form-label">Receiver Name / Contact Person</label>
              <input
                type="text"
                className="crm-form-input"
                placeholder="Contact Person receiving delivery"
                value={receiverName}
                onFocus={() => {
                  setIsReceiverOpen(true);
                  window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: 'dc-receiver-select' } }));
                }}
                onChange={(e) => {
                  setReceiverName(e.target.value);
                  setIsReceiverOpen(true);
                  window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: 'dc-receiver-select' } }));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsReceiverOpen(false);
                  }
                }}
              />
              {isReceiverOpen && filteredReceivers.length > 0 && (
                <div
                  className="dc-receiver-dropdown-panel"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 3px)',
                    left: 0,
                    width: '100%',
                    minWidth: '220px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.12)',
                    zIndex: 1050,
                    maxHeight: '180px',
                    overflowY: 'auto'
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {filteredReceivers.map((rec, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '6px 10px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9',
                        fontSize: '12px',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                      className="dc-receiver-opt"
                      onClick={() => {
                        setReceiverName(rec.name);
                        setIsReceiverOpen(false);
                      }}
                    >
                      <strong style={{ color: '#0f172a' }}>{rec.name}</strong>
                      {rec.company && <span style={{ fontSize: '10.5px', color: '#64748b' }}>{rec.company}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Employee Fields: Executive Engineer & Material Returned By */}
          <div className="dc-form-grid-dispatch-employees">
            <div className="crm-form-group dc-group-executive-engineer">
              <label className="crm-form-label">Executive Engineer</label>
              <select
                className="crm-form-input"
                value={executiveEngineerId}
                onChange={handleExecutiveEngineerChange}
              >
                <option value="">-- Select Executive Engineer --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.role || 'Staff'})
                  </option>
                ))}
              </select>
            </div>

            <div className="crm-form-group dc-group-returned-by">
              <label className="crm-form-label">Material Returned By</label>
              <select
                className="crm-form-input"
                value={materialReturnedById}
                onChange={handleMaterialReturnedByChange}
              >
                <option value="">-- Select Material Returned By --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.role || 'Staff'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="dc-form-grid-destination" style={{ marginTop: '5px' }}>
            <div className="crm-form-group dc-group-destination">
              <label className="crm-form-label">Delivery Destination Address</label>
              <input
                type="text"
                className="crm-form-input"
                placeholder="Delivery destination address..."
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: DELIVERY ITEMS TABLE WORKSPACE */}
        <div className="dc-form-section delivery-line-items dc-line-items-section delivery-items-section">
          {duplicateAlert && (
            <div className="dc-duplicate-alert">
              <span>⚠️ {duplicateAlert}</span>
              <button
                type="button"
                onClick={() => setDuplicateAlert('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontSize: '16px', lineHeight: 1 }}
                title="Dismiss"
              >
                ×
              </button>
            </div>
          )}

          <div className="dc-section-header-row">
            <h3 className="dc-section-title">Delivery Items</h3>
            {!selectedPendingDcId && !rows.some((r) => r.isFromPendingDc) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="crm-btn-secondary compact dc-header-add-product-btn"
                  onClick={() => handleAddProductToMaster(null)}
                  title="Create a new product in master catalog and return to this DC"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#2563eb',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  + Add Product
                </button>
                <button
                  type="button"
                  className="crm-btn-secondary compact"
                  onClick={handleAddRow}
                >
                  + Add Row
                </button>
              </div>
            )}
          </div>

          <div className="dc-items-table-container delivery-items-table-wrapper">
            <table className="crm-data-table dc-inline-entry-table delivery-items-table">
              <thead>
                <tr>
                  <th style={{ width: '4%', minWidth: '36px', textAlign: 'center' }}>#</th>
                  <th style={{ width: '32%' }}>ITEM SELECTION</th>
                  <th style={{ width: '10%' }}>TYPE</th>
                  <th style={{ width: '11%', textAlign: 'center' }}>AVAILABLE QTY</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>REQ QTY</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>DELIVERY QTY</th>
                  <th style={{ width: '6%', textAlign: 'center' }}>UNIT</th>
                  <th style={{ width: '13%', textAlign: 'center' }}>ACTION</th>
                </tr>
              </thead>
              <tbody className="dc-line-items-body">
                {rows.map((row, globalIdx) => (
                  <tr key={row.id || globalIdx} className="dc-entry-row">
                    <td style={{ width: '4%', minWidth: '36px', textAlign: 'center', fontWeight: 600, color: '#64748b', verticalAlign: 'top', paddingTop: '10px' }}>
                      {globalIdx + 1}
                    </td>

                    {/* ITEM SELECTION (32% column) */}
                    <td className="dc-item-selection-cell" style={{ width: '32%', verticalAlign: 'top' }}>
                      <SearchableProductSelect
                        items={currentStocks}
                        selectedId={row.productId}
                        onChange={(prodId) => handleItemSelect(globalIdx, prodId)}
                        disabledIds={rows.filter((_, idx) => idx !== globalIdx).map((r) => r.productId).filter(Boolean)}
                        disabled={Boolean(row.isFromPendingDc)}
                        onDuplicateAttempt={() => setDuplicateAlert('This product is already added.')}
                        placeholder="[ Select Item ▼ ]"
                        searchPlaceholder="Search items..."
                        ariaLabel={`Select item for row ${globalIdx + 1}`}
                      />
                      {row.productCode && (
                        <div className="dc-row-code-pill" style={{ marginTop: '4px' }}>
                          Code: {row.productCode}
                        </div>
                      )}
                    </td>

                    {/* TYPE (10%) */}
                    <td style={{ width: '10%', verticalAlign: 'top', paddingTop: '8px' }}>
                      <span className="dc-cell-text" title={row.productId ? (row.productType || 'Finished Goods') : ''}>
                        {row.productId ? (row.productType || 'Finished Goods') : '—'}
                      </span>
                    </td>

                    {/* AVAILABLE QTY (11%) */}
                    <td style={{ width: '11%', textAlign: 'center', verticalAlign: 'top', paddingTop: '6px' }}>
                      <span className={`dc-avail-badge ${row.productId && row.availableQty > 0 ? 'in-stock' : 'zero'}`}>
                        {row.productId ? (row.availableQty > 0 ? row.availableQty : 'OUT OF STOCK') : '—'}
                      </span>
                    </td>

                    {/* REQ QTY (12%) */}
                    <td style={{ width: '12%', textAlign: 'center', verticalAlign: 'top', padding: '8px 6px' }}>
                      <div className="dc-qty-cell-wrapper">
                        <input
                          type="number"
                          min="1"
                          className={`crm-form-input dc-qty-input ${row.productId && (row.requiredQty === '' || Number(row.requiredQty) <= 0) ? 'input-error is-invalid' : ''} ${row.isFromPendingDc ? 'is-pending-locked' : ''}`}
                          value={row.productId ? (row.requiredQty !== undefined ? row.requiredQty : '') : ''}
                          onChange={(e) => {
                            if (row.isFromPendingDc) return;
                            handleRequiredQtyChange(globalIdx, e.target.value);
                          }}
                          disabled={!row.productId}
                          readOnly={Boolean(row.isFromPendingDc)}
                          placeholder={row.productId ? "1" : ""}
                          title={row.isFromPendingDc ? "Required quantity from pending balance (locked)" : "Enter total required quantity"}
                          style={row.isFromPendingDc ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed', fontWeight: 600 } : {}}
                        />
                        {row.isFromPendingDc && (
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                            PENDING BAL
                          </div>
                        )}
                      </div>
                    </td>

                    {/* DELIVERY QTY (12%) */}
                    <td style={{ width: '12%', textAlign: 'center', verticalAlign: 'top', padding: '8px 6px' }}>
                      <div className="dc-qty-cell-wrapper">
                        <input
                          type="number"
                          min={row.availableQty > 0 ? "1" : "0"}
                          max={row.availableQty > 0 ? (row.requiredQty ? Math.min(row.availableQty, Number(row.requiredQty)) : row.availableQty) : undefined}
                          className={`crm-form-input dc-qty-input ${row.productId && (row.availableQty === 0 || row.qtyError || Number(row.deliveryQty) > row.availableQty) ? 'input-error is-invalid' : ''}`}
                          value={row.productId ? row.deliveryQty : ''}
                          onChange={(e) => handleQtyChange(globalIdx, e.target.value)}
                          disabled={!row.productId || row.availableQty <= 0}
                          placeholder={row.productId ? (row.availableQty === 0 ? '0' : '1') : ''}
                          title={row.availableQty <= 0 ? "Product is out of stock" : (row.qtyError || undefined)}
                        />
                        {row.isFromPendingDc && row.productId && (
                          <div style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            marginTop: '2px',
                            color: Number(row.deliveryQty || 0) < Number(row.requiredQty || 0) ? '#d97706' : '#16a34a'
                          }}>
                            {Number(row.deliveryQty || 0) < Number(row.requiredQty || 0)
                              ? `${Number(row.requiredQty || 0) - Number(row.deliveryQty || 0)} Rem. Pending`
                              : 'Full Fulfillment'}
                          </div>
                        )}
                        {row.productId && row.availableQty === 0 && (
                          <div className="dc-qty-error-badge">
                            OUT OF STOCK
                          </div>
                        )}
                        {row.productId && row.availableQty > 0 && row.qtyError && (
                          <div className="dc-qty-error-msg">
                            {row.qtyError}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* UNIT (6%) */}
                    <td style={{ width: '6%', textAlign: 'center', verticalAlign: 'top', paddingTop: '8px' }}>
                      <span className="dc-unit-label">{row.productId ? ((row.unit && row.unit !== 'Piece') ? row.unit : 'Nos') : '—'}</span>
                    </td>

                    {/* ACTION (13%) */}
                    <td style={{ width: '13%', textAlign: 'center', verticalAlign: 'top', paddingTop: '4px' }}>
                      <div className="dc-row-actions">
                        {row.productId && (
                          row.serialized !== false ? (
                            (() => {
                              const key = row.productId || row.productCode || row.productName;
                              const pool = stockSerialsPool[key] || stockSerialsPool[row.productCode] || [];
                              const availableCount = pool.length;
                              const dQty = Number(row.deliveryQty || 0);
                              const currentAssigned = Array.isArray(row.serialNumbers) ? row.serialNumbers : [];
                              const assignedCount = currentAssigned.length;
                              const isShortage = dQty > availableCount;
                              const isAllocated = dQty > 0 && !isShortage;
                              const btnLabel = isShortage
                                ? (assignedCount > 0 ? `SN (${assignedCount}/${dQty})` : `SN (0/${dQty})`)
                                : (dQty > 0 ? `SN (${dQty})` : `SN (0)`);

                              // Extract shelf-life info for assigned serials
                              const metaMap = stockSerialsMetaPool[key] || stockSerialsMetaPool[row.productCode] || {};
                              const assignedMetas = currentAssigned.map((s) => metaMap[s]).filter(Boolean);
                              const minMonths = assignedMetas.length > 0 ? Math.min(...assignedMetas.map((m) => m.monthsRemaining)) : null;

                              return (
                                <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    className={`dc-sn-btn ${isAllocated ? 'is-allocated' : ''} ${isShortage ? 'is-shortage' : ''}`}
                                    onClick={() => setSerialPickerRowIdx(globalIdx)}
                                    title={
                                      isShortage
                                        ? `${dQty} serial numbers are required, but only ${availableCount} are available in active stock`
                                        : `${dQty} serial number${dQty > 1 ? 's' : ''} allocated: ${currentAssigned.join(', ')} (click to inspect/adjust FEFO allocation)`
                                    }
                                    style={
                                      isAllocated
                                        ? {
                                            background: '#2563eb',
                                            color: '#ffffff',
                                            borderColor: '#1d4ed8',
                                            fontWeight: 600,
                                            boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
                                            borderRadius: '6px',
                                            padding: '4px 10px',
                                            fontSize: '11.5px'
                                          }
                                        : isShortage
                                        ? {
                                            background: '#fff1f2',
                                            color: '#e11d48',
                                            borderColor: '#fda4af',
                                            borderRadius: '6px',
                                            padding: '4px 10px',
                                            fontSize: '11.5px'
                                          }
                                        : { borderRadius: '6px', padding: '4px 10px', fontSize: '11.5px' }
                                    }
                                  >
                                    {btnLabel}
                                  </button>
                                  {isAllocated && currentAssigned.length > 0 && (
                                    <div
                                      onClick={() => setSerialPickerRowIdx(globalIdx)}
                                      style={{
                                        cursor: 'pointer',
                                        fontSize: '10.5px',
                                        fontWeight: 700,
                                        marginTop: '4px',
                                        padding: '2px 7px',
                                        borderRadius: '12px',
                                        background: minMonths !== null && minMonths <= 6 ? '#fef3c7' : '#eff6ff',
                                        color: minMonths !== null && minMonths <= 6 ? '#b45309' : '#1d4ed8',
                                        border: `1px solid ${minMonths !== null && minMonths <= 6 ? '#fde68a' : '#bfdbfe'}`,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        whiteSpace: 'nowrap',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                        transition: 'all 0.15s ease'
                                      }}
                                      title="FEFO Prioritized: Automatically dispatches stock with earliest expiry date first. Click to inspect or reassign."
                                    >
                                      <span>⚡ FEFO:</span>
                                      <span>{minMonths !== null ? `${minMonths}m left` : 'Earliest'}</span>
                                    </div>
                                  )}
                                  {isShortage && dQty > 0 && (
                                    <div
                                      style={{
                                        color: '#e11d48',
                                        fontSize: '10.5px',
                                        fontWeight: 600,
                                        marginTop: '3px',
                                        lineHeight: 1.2,
                                        whiteSpace: 'nowrap'
                                      }}
                                    >
                                      {dQty} req / {availableCount} avail
                                    </div>
                                  )}
                                </div>
                              );
                            })()
                          ) : (
                            <span
                              style={{
                                fontSize: '11px',
                                color: '#64748b',
                                padding: '2px 8px',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '4px',
                                fontWeight: 500
                              }}
                              title="Non-serialized item (quantity tracking only)"
                            >
                              —
                            </span>
                          )
                        )}
                        <button
                          type="button"
                          className="dc-delete-row-btn"
                          onClick={() => handleRemoveRow(globalIdx)}
                          title={row.isFromPendingDc ? "Item locked from pending DC" : "Remove this item"}
                          disabled={Boolean(row.isFromPendingDc)}
                          style={row.isFromPendingDc ? { opacity: 0.3, cursor: 'not-allowed', pointerEvents: 'none' } : {}}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(() => {
            const validRows = rows.filter((r) => r.productId);
            const totalItemsCount = validRows.length;
            const totalDeliveryQty = validRows.reduce((sum, r) => sum + (Number(r.deliveryQty) || 0), 0);
            const serializedRows = validRows.filter((r) => r.serialized !== false);
            const hasSerialized = serializedRows.length > 0;
            const totalRequiredSerials = serializedRows.reduce((sum, r) => sum + (Number(r.deliveryQty) || 0), 0);
            const totalAssignedSerials = serializedRows.reduce((sum, r) => sum + (Array.isArray(r.serialNumbers) ? r.serialNumbers.length : 0), 0);
            const isAllSerialsAssigned = totalRequiredSerials > 0 && totalAssignedSerials === totalRequiredSerials;

            return (
              <div className="dc-table-footer-bar" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                  <span>{totalItemsCount} item(s) selected ({rows.length} total rows)</span>
                  <span style={{ color: '#cbd5e1' }}>•</span>
                  <span style={{ color: '#0f172a' }}>Total Delivery Qty: <strong style={{ color: '#2563eb' }}>{totalDeliveryQty}</strong> {totalDeliveryQty === 1 ? 'unit' : 'units'}</span>
                  {hasSerialized && (
                    <>
                      <span style={{ color: '#cbd5e1' }}>•</span>
                      <span style={{ color: isAllSerialsAssigned ? '#166534' : (totalAssignedSerials > 0 ? '#b45309' : '#64748b') }}>
                        Serials Allocated: {totalAssignedSerials} / {totalRequiredSerials}
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* SECTION 3: REMARKS & SAVE ACTION BAR */}
        <div className="dc-form-section dc-remarks-actions-section">
          <div className="crm-form-group">
            <input
              type="text"
              className="crm-form-input"
              placeholder="Remarks / Terms &amp; Conditions (e.g. Delivered for commercial handover)..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>

          <div className="dc-form-actions-bar">
            <button
              type="button"
              className="crm-btn-secondary compact"
              onClick={onCancel || (() => navigate('/delivery-challans'))}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="crm-btn-primary compact"
              disabled={submitting}
            >
              {submitting ? 'Creating DC...' : '✓ Save Delivery Challan'}
            </button>
          </div>
        </div>
      </form>

      {/* Add Customer Modal */}
      {isAddCustomerModalOpen && (
        <AddCustomerModal
          isOpen={isAddCustomerModalOpen}
          onClose={() => setIsAddCustomerModalOpen(false)}
          onCustomerCreated={handleCustomerCreated}
          onSelectExistingCustomer={handleSelectExistingCustomer}
          existingCustomers={customers}
          defaultName={initialCustomerName}
        />
      )}

      {/* FEFO Serial Allocation Modal */}
      {serialPickerRowIdx !== null && rows[serialPickerRowIdx] && (
        <FefoSerialPickerModal
          isOpen={true}
          row={rows[serialPickerRowIdx]}
          allPool={
            stockSerialsPool[rows[serialPickerRowIdx]?.productId] ||
            stockSerialsPool[rows[serialPickerRowIdx]?.productCode] ||
            stockSerialsPool[rows[serialPickerRowIdx]?.productName] ||
            []
          }
          metaMap={
            stockSerialsMetaPool[rows[serialPickerRowIdx]?.productId] ||
            stockSerialsMetaPool[rows[serialPickerRowIdx]?.productCode] ||
            stockSerialsMetaPool[rows[serialPickerRowIdx]?.productName] ||
            {}
          }
          onClose={() => setSerialPickerRowIdx(null)}
          onApply={(newSerials) => {
            setRows((prev) => {
              const next = [...prev];
              next[serialPickerRowIdx] = {
                ...next[serialPickerRowIdx],
                serialNumbers: newSerials
              };
              return next;
            });
            setSerialPickerRowIdx(null);
          }}
        />
      )}
    </div>
  );
}
