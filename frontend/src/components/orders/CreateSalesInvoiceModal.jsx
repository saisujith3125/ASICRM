import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch, apiUrl } from '../../api';
import CustomerSelector from '../customer/CustomerSelector';
import SearchableProductSelect from '../common/SearchableProductSelect';
import SearchableReferenceSelect from '../common/SearchableReferenceSelect';
import SerialNumberModal from '../common/SerialNumberModal';
import SerialDropdownCell from './SerialDropdownCell';
import { useCompanyConfig } from '../documents/companyConfig';
import { amountInWords } from '../documents/documentFormatters';
import { Trash2, Plus, AlertCircle, FileText, CheckCircle, Clock, Check, Barcode, CheckSquare } from 'lucide-react';

function authHeaders(user) {
  return {
    'Content-Type': 'application/json',
    'x-user-id': user?.id || ''
  };
}

export function isCableItem(item) {
  if (!item) return false;
  const name = String(item.name || item.productName || item.productDetails || item.description || '').toLowerCase();
  const code = String(item.code || item.sku || item.productCode || '').toLowerCase();
  const cat = String(item.category || item.categoryName || item.categoryId || '').toLowerCase();
  const subcat = String(item.subcategory || item.subcategoryName || item.subcategoryId || '').toLowerCase();
  if (cat === 'cat-000004' || cat.includes('cable')) return true;
  if (subcat.includes('cable')) return true;
  if (name.includes('cable') || name.includes('cat 6') || name.includes('cat6') || name.includes('patch cord') || name.includes('fiber cable')) return true;
  if (code === 'asi-18' || code === 'prod-000041' || code.includes('cable')) return true;
  const unit = String(item.unit || '').toLowerCase();
  if ((unit === 'meter' || unit === 'roll') && (name.includes('wire') || name.includes('cable'))) return true;
  return false;
}

export default function CreateSalesInvoiceModal({
  user,
  order = null, // if creating from sales order
  challan = null, // if creating from delivery challan
  onClose,
  onSuccess
}) {
  const [products, setProducts] = useState([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [stockSerialsPool, setStockSerialsPool] = useState({});
  const [activeSerialRowIdx, setActiveSerialRowIdx] = useState(null);
  const [openSerialDropdownIdx, setOpenSerialDropdownIdx] = useState(null);

  // Customer state
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    order?.customerId || challan?.customerId || ''
  );
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerName, setCustomerName] = useState(
    order?.customerName || challan?.customerName || ''
  );
  const [company, setCompany] = useState(
    order?.company || challan?.company || ''
  );
  const [contactPerson, setContactPerson] = useState('');
  const [customerPhone, setCustomerPhone] = useState(
    order?.customerPhone || challan?.customerPhone || ''
  );
  const [customerEmail, setCustomerEmail] = useState(
    order?.customerEmail || challan?.customerEmail || ''
  );

  const [consigneeName, setConsigneeName] = useState(
    customerName || company || ''
  );
  const [consigneeAddress, setConsigneeAddress] = useState(
    order?.deliveryAddress || challan?.deliveryAddress || ''
  );
  const [consigneeGstin, setConsigneeGstin] = useState('');
  const [consigneeState, setConsigneeState] = useState('Tamil Nadu');

  const [shippingAddress, setShippingAddress] = useState(
    order?.deliveryAddress || challan?.deliveryAddress || ''
  );
  const [shippingGstin, setShippingGstin] = useState('');
  const [shippingState, setShippingState] = useState('Tamil Nadu');

  // Dates & Payment details
  const today = new Date().toISOString().slice(0, 10);
  const defaultDueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState(defaultDueDate);

  const companyConfig = useCompanyConfig(user);

  const [paymentTerms, setPaymentTerms] = useState(
    order?.paymentTerms || companyConfig?.paymentTerms || 'Net 15 Days'
  );
  const [paymentStatus, setPaymentStatus] = useState('PENDING');
  const [paymentMode, setPaymentMode] = useState('Bank Transfer');

  // Upstream document references
  const [orderId, setOrderId] = useState(order?.orderId || challan?.orderId || '');
  const [orderDate, setOrderDate] = useState(
    order?.createdAt ? order.createdAt.slice(0, 10) : ''
  );
  const [challanId, setChallanId] = useState(challan?.challanId || order?.deliveryChallanId || order?.dcNo || '');
  const [selectedDcIds, setSelectedDcIds] = useState(() => (challan?.challanId ? [challan.challanId] : (order?.deliveryChallanId ? [order.deliveryChallanId] : [])));
  const [challanDate, setChallanDate] = useState(
    challan?.deliveryDate ? challan.deliveryDate.slice(0, 10) : (challan?.createdAt ? challan.createdAt.slice(0, 10) : '')
  );
  const [quotationId, setQuotationId] = useState(order?.quotationId || order?.quotationNumber || '');
  const [quotationDate, setQuotationDate] = useState(
    order?.quotationDate ? String(order.quotationDate).slice(0, 10) : ''
  );
  const [poNumber, setPoNumber] = useState(order?.poNumber || challan?.poNumber || '');
  const [poDate, setPoDate] = useState(
    order?.poDate ? String(order.poDate).slice(0, 10) : (challan?.poDate ? String(challan.poDate).slice(0, 10) : '')
  );
  const [dispatchThrough, setDispatchThrough] = useState(
    challan?.transitMode ? `${challan.transitMode}${challan.dispatchDetails ? ` - ${challan.dispatchDetails}` : ''}` : 'Surface Courier'
  );
  const [dispatchDate, setDispatchDate] = useState(
    challan?.deliveryDate ? challan.deliveryDate.slice(0, 10) : ''
  );
  const [customerSourceRef, setCustomerSourceRef] = useState(
    challan ? 'dc' : (order ? 'order' : null)
  );

  const [remarks, setRemarks] = useState(
    challan
      ? `Supply of goods against Delivery Challan ${challan.challanId}`
      : (order ? `Tax invoice against Sales Order ${order.orderId}` : 'Tax invoice for hardware supply and services')
  );

  // Discount & Round-off settings
  const [showDiscount, setShowDiscount] = useState(() => {
    const rawList = (challan && Array.isArray(challan.items) && challan.items.length > 0)
      ? challan.items
      : (order && Array.isArray(order.lineItems) && order.lineItems.length > 0)
        ? order.lineItems
        : [];
    return rawList.some((it) => Number(it.discount !== undefined ? it.discount : (it.discountPercent || 0)) > 0);
  });
  const [roundOffEnabled, setRoundOffEnabled] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');

  // Row helper utilities
  const createEmptyRow = (sl = 1) => ({
    sl,
    productId: '',
    productCode: '',
    productName: '',
    productDetails: '',
    hsnSac: '85258090',
    quantity: 1,
    unit: 'Nos',
    unitPrice: 0,
    discount: 0,
    discountAmount: 0,
    lineSubtotal: 0,
    gst: 18,
    lineTax: 0,
    lineTotal: 0,
    isSerialized: false,
    serialNumbers: []
  });

  const isRowEmpty = (row) => !row || (!row.productId && !row.productName?.trim());

  const ensureTrailingBlankRow = (itemsList) => {
    if (!Array.isArray(itemsList) || itemsList.length === 0) {
      return [createEmptyRow(1)];
    }
    const nonEmpty = itemsList.filter((it) => !isRowEmpty(it));
    const result = [...nonEmpty, createEmptyRow(nonEmpty.length + 1)];
    return result.map((it, idx) => ({ ...it, sl: idx + 1 }));
  };

  // Helper to auto-fetch or resolve serial numbers for products
  const resolveSerialsForProduct = (prod, qty = 1, currentSerials = []) => {
    // 1. Strict Cable Rule: Cables must NEVER have serial numbers under any circumstance
    if (isCableItem(prod)) {
      return { isSerialized: false, serialNumbers: [] };
    }

    const code = String(prod?.code || prod?.productCode || prod?.sku || '').trim();
    const name = String(prod?.name || prod?.productName || '').trim();
    const categoryId = String(prod?.categoryId || '').trim();

    const isHardware =
      /^(cat-000001|cat-000002|cat-000003)$/i.test(categoryId) ||
      /camera|nvr|dvr|switch|sensor|router|controller/i.test(name) ||
      /^(CAM-|NVR-|NET-|HDD-|ASI-CAM)/i.test(code);

    const isSerialized = Boolean(
      prod?.serialized === true ||
      prod?.isSerialized === true ||
      (Array.isArray(prod?.serialNumbers) && prod.serialNumbers.length > 0) ||
      (Array.isArray(currentSerials) && currentSerials.length > 0) ||
      (prod?.serialized !== false && isHardware)
    );

    if (!isSerialized) {
      return { isSerialized: false, serialNumbers: [] };
    }

    const targetQty = Math.max(1, Number(qty || 1));
    const prodId = prod?.id || prod?.productId || '';

    const poolList =
      stockSerialsPool[prodId] ||
      stockSerialsPool[code] ||
      (Array.isArray(prod?.serialNumbers) ? prod.serialNumbers : []) ||
      (Array.isArray(prod?.availableSerials) ? prod.availableSerials : []);

    let chosen = Array.isArray(currentSerials) ? [...currentSerials].filter(Boolean) : [];
    if (chosen.length > targetQty) {
      chosen = chosen.slice(0, targetQty);
    } else if (chosen.length < targetQty) {
      const existingSet = new Set(chosen.map((s) => String(s).trim().toUpperCase()));
      for (const sn of poolList) {
        if (chosen.length >= targetQty) break;
        const norm = String(sn).trim().toUpperCase();
        if (norm && !existingSet.has(norm)) {
          chosen.push(String(sn).trim());
          existingSet.add(norm);
        }
      }

      // If still fewer than targetQty, generate standard serials
      const prefix = (code || prodId || 'SN').toUpperCase().replace(/[^A-Z0-9-]/g, '') || 'SN';
      let snNum = 1001;
      while (chosen.length < targetQty) {
        const cand = `${prefix}-SN-${snNum++}`;
        if (!existingSet.has(cand.toUpperCase())) {
          chosen.push(cand);
          existingSet.add(cand.toUpperCase());
        }
      }
    }

    return { isSerialized: true, serialNumbers: chosen };
  };

  // Line items initial population
  const initialItems = useMemo(() => {
    const src = (challan && Array.isArray(challan.items) && challan.items.length > 0)
      ? challan.items
      : (order && Array.isArray(order.lineItems) && order.lineItems.length > 0)
        ? order.lineItems
        : (order && Array.isArray(order.items) && order.items.length > 0 ? order.items : null);

    if (Array.isArray(src) && src.length > 0) {
      const mapped = src.map((it, idx) => {
        const qty = Math.max(1, Number(it.quantity || (it.deliveryQty || 1)));
        const rate = Number(
          it.unitPrice !== undefined && it.unitPrice !== null && it.unitPrice !== ''
            ? it.unitPrice
            : (it.rate !== undefined && it.rate !== null && it.rate !== ''
                ? it.rate
                : (it.price !== undefined && it.price !== null && it.price !== ''
                    ? it.price
                    : (it.dealerPrice || 0)))
        );
        const disc = Number(it.discount !== undefined ? it.discount : (it.discountPercent || 0));
        const gst = Number(it.gst !== undefined ? it.gst : 18);
        const rawSub = Math.round(qty * rate * 100) / 100;
        const discAmt = showDiscount && disc > 0 ? Math.round((rawSub * (disc / 100)) * 100) / 100 : 0;
        const taxable = Math.max(0, Math.round((rawSub - discAmt) * 100) / 100);
        const lineTax = Math.round(((taxable * gst) / 100) * 100) / 100;
        const lineTot = Math.round((taxable + lineTax) * 100) / 100;
        const serialResult = resolveSerialsForProduct(it, qty, it.serialNumbers || []);
        return {
          sl: idx + 1,
          productId: it.productId || '',
          productCode: it.productCode || it.sku || '',
          productName: it.productName || it.name || '',
          productDetails: it.productDetails || it.description || '',
          hsnSac: it.hsnSac || '85258090',
          quantity: qty,
          unit: (it.unit && it.unit !== 'Piece') ? it.unit : 'Nos',
          unitPrice: rate,
          discount: disc,
          discountAmount: discAmt,
          taxableAmount: taxable,
          lineSubtotal: rawSub,
          gst,
          lineTax,
          lineTotal: lineTot,
          isSerialized: serialResult.isSerialized,
          serialNumbers: serialResult.serialNumbers
        };
      });
      return ensureTrailingBlankRow(mapped);
    }
    return [createEmptyRow(1)];
  }, [order, challan, showDiscount]);

  const [items, setItems] = useState(initialItems);

  // Authoritative date extractor
  const extractDate = (raw) => {
    if (!raw) return '';
    const s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    return '';
  };

  // State for searchable reference lists
  const [quotationsList, setQuotationsList] = useState([]);
  const [ordersList, setOrdersList] = useState([]);
  const [dcList, setDcList] = useState([]);
  const [dispatchList, setDispatchList] = useState([]);

  // Fetch available serial numbers pool
  useEffect(() => {
    let active = true;
    apiFetch(apiUrl('/api/orders/available-serials'), { headers: authHeaders(user) })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active && json && json.success && Array.isArray(json.data)) {
          setStockSerialsPool((prev) => {
            const next = { ...prev };
            json.data.forEach((item) => {
              const serials = item.availableSerials || item.totalSerials || [];
              if (item.productId) next[item.productId] = serials;
              if (item.productCode) next[item.productCode] = serials;
              if (item.id) next[item.id] = serials;
            });
            return next;
          });
        }
      })
      .catch((err) => console.warn('Could not load available serials pool:', err));
    return () => {
      active = false;
    };
  }, [user]);
 
  // Global click-outside listener to close open serial number popover
  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (!e.target.closest('.serial-dropdown-cell')) {
        setOpenSerialDropdownIdx(null);
      }
    };
    const handleGlobalKey = (e) => {
      if (e.key === 'Escape') {
        setOpenSerialDropdownIdx(null);
      }
    };
    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('keydown', handleGlobalKey);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
      document.removeEventListener('keydown', handleGlobalKey);
    };
  }, []);

  // Fetch stocks products for product dropdown from authoritative Product Master
  useEffect(() => {
    let active = true;
    setLoadingStocks(true);
    apiFetch(apiUrl('/api/stocks'), {
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user?.id || 'USR-001'
      }
    })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d && (d.success || Array.isArray(d) || Array.isArray(d.data) || Array.isArray(d.products))) {
          const list = Array.isArray(d)
            ? d
            : (Array.isArray(d.data)
                ? d.data
                : (Array.isArray(d.data?.products) ? d.data.products : (Array.isArray(d.products) ? d.products : [])));
          setProducts(list);
          setStockSerialsPool((prev) => {
            const next = { ...prev };
            list.forEach((p) => {
              const serials = Array.isArray(p.serialNumbers) ? p.serialNumbers : [];
              if (serials.length > 0) {
                if (p.id) next[p.id] = next[p.id] || serials;
                if (p.code) next[p.code] = next[p.code] || serials;
              }
            });
            return next;
          });
        }
      })
      .catch((err) => console.error('Failed to load stocks for invoice:', err))
      .finally(() => {
        if (active) setLoadingStocks(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  // When stockSerialsPool loads, ensure any serialized rows with empty serials get auto-populated
  useEffect(() => {
    if (Object.keys(stockSerialsPool).length === 0) return;
    setItems((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        if (isRowEmpty(row)) return row;
        const qty = Number(row.quantity || 1);
        const serials = Array.isArray(row.serialNumbers) ? row.serialNumbers : [];
        if (row.isSerialized && serials.length < qty) {
          const res = resolveSerialsForProduct(row, qty, serials);
          if (res.serialNumbers.length !== serials.length) {
            changed = true;
            return {
              ...row,
              isSerialized: res.isSerialized,
              serialNumbers: res.serialNumbers
            };
          }
        }
        return row;
      });
      return changed ? next : prev;
    });
  }, [stockSerialsPool]);

  // Fetch quotations, orders, and delivery challans
  useEffect(() => {
    let active = true;

    apiFetch(apiUrl('/api/enquiries/quotations'), { headers: authHeaders(user) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d) return;
        const list = Array.isArray(d.data) ? d.data : (Array.isArray(d) ? d : []);
        setQuotationsList(list);
      })
      .catch(() => {});

    apiFetch(apiUrl('/api/orders'), { headers: authHeaders(user) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d) return;
        const list = Array.isArray(d.data) ? d.data : (Array.isArray(d) ? d : []);
        setOrdersList(list);
      })
      .catch(() => {});

    apiFetch(apiUrl('/api/orders/delivery-challans'), { headers: authHeaders(user) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d) return;
        const list = Array.isArray(d.data) ? d.data : (Array.isArray(d) ? d : []);
        setDcList(list);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [user]);

  // Standard Dispatch options
  useEffect(() => {
    const dispMap = new Map();
    const standardOptions = [
      'Surface Courier',
      'Air Cargo',
      'Road Transport',
      'Dedicated Vehicle',
      'Hand Delivery',
      'Customer Pickup'
    ];
    standardOptions.forEach((opt) => {
      dispMap.set(opt.toLowerCase(), {
        text: opt,
        details: 'Standard Transit Mode',
        date: ''
      });
    });

    dcList.forEach((d) => {
      const mode = d.transitMode || d.dispatchDetails;
      if (mode && String(mode).trim()) {
        const key = String(mode).trim().toLowerCase();
        dispMap.set(key, {
          text: String(mode).trim(),
          details: d.receiverName ? `Consignee: ${d.receiverName}` : (d.challanId || 'DC Transit'),
          date: extractDate(d.deliveryDate || d.createdAt)
        });
      }
    });

    setDispatchList(Array.from(dispMap.values()));
  }, [dcList]);

  // Customer-filtered reference lists:
  // When a customer is selected, ONLY relevant records for that customer are displayed.
  // When no customer is selected (or when cancelled/cleared), all records across all customers are displayed.
  const filteredOrdersList = useMemo(() => {
    if (!selectedCustomerId && !customerName.trim()) return ordersList;
    const cId = selectedCustomerId;
    const cName = (customerName || '').toLowerCase().trim();
    const cComp = (company || '').toLowerCase().trim();

    return ordersList.filter((o) => {
      if (cId && o.customerId && o.customerId === cId) return true;
      const oCust = (o.customerName || o.company || o.customerCompany || '').toLowerCase().trim();
      if (cName && (oCust.includes(cName) || cName.includes(oCust))) return true;
      if (cComp && (oCust.includes(cComp) || cComp.includes(oCust))) return true;
      return false;
    });
  }, [ordersList, selectedCustomerId, customerName, company]);

  const filteredDcList = useMemo(() => {
    if (!selectedCustomerId && !customerName.trim()) return dcList;
    const cId = selectedCustomerId;
    const cName = (customerName || '').toLowerCase().trim();
    const cComp = (company || '').toLowerCase().trim();

    return dcList.filter((d) => {
      if (cId && d.customerId && d.customerId === cId) return true;
      const dCust = (d.customerName || d.company || d.receiverName || d.customerCompany || '').toLowerCase().trim();
      if (cName && (dCust.includes(cName) || cName.includes(dCust))) return true;
      if (cComp && (dCust.includes(cComp) || cComp.includes(dCust))) return true;
      return false;
    });
  }, [dcList, selectedCustomerId, customerName, company]);

  // Related Delivery Challans for multi-DC merge / partial shipments
  const relatedDcsList = useMemo(() => {
    if (!selectedCustomerId && !customerName.trim() && selectedDcIds.length === 0 && !orderId) {
      return [];
    }

    const cId = selectedCustomerId;
    const cName = (customerName || '').toLowerCase().trim();
    const cComp = (company || '').toLowerCase().trim();
    const ordId = orderId;

    const customerDcs = dcList.filter((d) => {
      const dId = d.challanId || d.id;
      if (selectedDcIds.includes(dId)) return true;
      if (cId && d.customerId === cId) return true;
      const dCust = (d.customerName || d.company || d.receiverName || d.customerCompany || '').toLowerCase().trim();
      if (cName && (dCust.includes(cName) || cName.includes(dCust))) return true;
      if (cComp && (dCust.includes(cComp) || cComp.includes(dCust))) return true;
      return false;
    });

    if (customerDcs.length <= 1 && selectedDcIds.length === 0) {
      return customerDcs;
    }

    return customerDcs.filter((d) => {
      const dId = d.challanId || d.id;
      if (selectedDcIds.includes(dId)) return true;

      // 1. Same Order Ref
      if (ordId && d.orderId && d.orderId === ordId) return true;

      // 2. Partial delivery relationship to any selected DC:
      for (const selId of selectedDcIds) {
        const sel = dcList.find((x) => (x.challanId || x.id) === selId);
        if (sel) {
          if (d.refNo && (d.refNo === selId || d.refNo === sel.refNo)) return true;
          if (sel.refNo && sel.refNo === dId) return true;
          if (Array.isArray(sel.subsequentChallanIds) && sel.subsequentChallanIds.includes(dId)) return true;
          if (Array.isArray(d.subsequentChallanIds) && d.subsequentChallanIds.includes(selId)) return true;
        }
      }

      // 3. Or if not invoiced yet, allow merging for this customer
      if (!d.invoiceId) return true;

      return false;
    });
  }, [dcList, selectedCustomerId, customerName, company, orderId, selectedDcIds]);

  const filteredQuotationsList = useMemo(() => {
    if (!selectedCustomerId && !customerName.trim()) return quotationsList;
    const cId = selectedCustomerId;
    const cName = (customerName || '').toLowerCase().trim();
    const cComp = (company || '').toLowerCase().trim();

    return quotationsList.filter((q) => {
      if (cId && q.customerId && q.customerId === cId) return true;
      const qCust = (q.customerName || q.customerCompany || q.company || '').toLowerCase().trim();
      if (cName && (qCust.includes(cName) || cName.includes(qCust))) return true;
      if (cComp && (qCust.includes(cComp) || cComp.includes(qCust))) return true;
      return false;
    });
  }, [quotationsList, selectedCustomerId, customerName, company]);

  // Centralized helper to clear customer fields and reset provenance
  const clearCustomerData = () => {
    setSelectedCustomerId('');
    setSelectedCustomer(null);
    setCustomerName('');
    setCompany('');
    setContactPerson('');
    setCustomerPhone('');
    setCustomerEmail('');
    setConsigneeName('');
    setConsigneeAddress('');
    setConsigneeGstin('');
    setConsigneeState('Tamil Nadu');
    setShippingAddress('');
    setShippingGstin('');
    setShippingState('Tamil Nadu');
    setCustomerSourceRef(null);
  };

  // Authoritative Customer Selection handler
  const handleSelectCustomer = (id, cust, sourceToPreserve = null, isManual = false) => {
    if (isManual) {
      setCustomerSourceRef(id || cust ? 'manual' : null);
    }

    if (id || cust) {
      // Switching to a different customer: reset dependent references and items
      if (selectedCustomerId && id && selectedCustomerId !== id) {
        setOrderId('');
        setOrderDate('');
        setChallanId('');
        setSelectedDcIds([]);
        setChallanDate('');
        setQuotationId('');
        setQuotationDate('');
        setPoNumber('');
        setPoDate('');
        setDispatchThrough('Surface Courier');
        setDispatchDate('');
        setItems([createEmptyRow(1)]);
      }

      setSelectedCustomerId(id || '');
      setSelectedCustomer(cust || null);

      // Clear incompatible upstream references if customer changed
      if (id) {
        if (sourceToPreserve !== 'quotation' && quotationId) {
          const q = quotationsList.find((item) => (item.quotationId || item.id) === quotationId);
          if (q && q.customerId && q.customerId !== id) {
            setQuotationId('');
            setQuotationDate('');
          }
        }
        if (sourceToPreserve !== 'order' && orderId) {
          const o = ordersList.find((item) => (item.orderId || item.id) === orderId);
          if (o && o.customerId && o.customerId !== id) {
            setOrderId('');
            setOrderDate('');
          }
        }
        if (sourceToPreserve !== 'dc' && challanId) {
          const d = dcList.find((item) => (item.challanId || item.id) === challanId);
          if (d && d.customerId && d.customerId !== id) {
            setChallanId('');
            setChallanDate('');
          }
        }
      }

      if (cust) {
        setCustomerName(cust.name || '');
        setCompany(cust.company || '');
        setContactPerson(cust.contactPerson || '');
        setCustomerPhone(cust.mobile || cust.phone || '');
        setCustomerEmail(cust.email || '');

        const fullAddr = [cust.address, cust.city, cust.state, cust.pincode].filter(Boolean).join(', ');
        setConsigneeName(cust.company || cust.name || '');
        setConsigneeAddress(fullAddr || cust.billingAddress || cust.address || '');
        setConsigneeGstin(cust.gstin || '');
        setConsigneeState(cust.state || 'Tamil Nadu');

        const shipAddr = cust.shippingAddress || fullAddr || cust.address || '';
        setShippingAddress(shipAddr);
        setShippingGstin(cust.shippingGstin || cust.gstin || '');
        setShippingState(cust.shippingState || cust.state || 'Tamil Nadu');
      }
    } else {
      // Customer was cleared / unselected (e.g. clicking 'x' on Customer)
      clearCustomerData();
      setOrderId('');
      setOrderDate('');
      setChallanId('');
      setSelectedDcIds([]);
      setChallanDate('');
      setQuotationId('');
      setQuotationDate('');
      setPoNumber('');
      setPoDate('');
      setDispatchThrough('Surface Courier');
      setDispatchDate('');
      setItems([createEmptyRow(1)]);
      setPaymentTerms(companyConfig?.paymentTerms || 'Net 15 Days');
      setPaymentStatus('PENDING');
      setPaymentMode('Bank Transfer');
      setRemarks('Tax invoice for hardware supply and services');
      setShowDiscount(false);
      setError('');
    }
  };

  // Centralized helper to auto-populate customer details
  const populateCustomerFromRecord = (record, idFallback = '', sourceToPreserve = null) => {
    if (!record) return;
    const custId = record.customerId || record.id || idFallback || '';
    const name = record.customerName || record.name || '';
    const comp = record.customerCompany || record.company || '';
    const contact = record.contactPerson || '';
    const phone = record.customerPhone || record.phone || record.mobile || '';
    const mail = record.customerEmail || record.email || '';
    const addr = record.billingAddress || record.customerAddress || record.address || record.deliveryAddress || '';
    const shipAddr = record.shippingAddress || record.deliveryAddress || addr || '';
    const gst = record.gstin || record.customerGstin || '';
    const st = record.state || record.customerState || 'Tamil Nadu';
    const shipSt = record.shippingState || record.state || 'Tamil Nadu';

    if (custId || name || comp) {
      if (!customerSourceRef || customerSourceRef !== 'manual') {
        setCustomerSourceRef(sourceToPreserve);
      }
      handleSelectCustomer(custId, {
        id: custId,
        name: name,
        company: comp,
        contactPerson: contact,
        mobile: phone,
        email: mail,
        address: addr,
        billingAddress: addr,
        gstin: gst,
        state: st,
        shippingAddress: shipAddr,
        shippingGstin: record.shippingGstin || gst || '',
        shippingState: shipSt
      }, sourceToPreserve, false);
    }
  };

  // Connected selection handlers with auto-date population & cross-referencing
  const handleSelectOrder = (record) => {
    if (!record) {
      setOrderId('');
      setOrderDate('');
      setItems([createEmptyRow(1)]);
      setQuotationId('');
      setQuotationDate('');
      setChallanId('');
      setChallanDate('');
      setPoNumber('');
      setPoDate('');
      setDispatchThrough('Surface Courier');
      setDispatchDate('');
      if (customerSourceRef === 'order') {
        clearCustomerData();
      }
      return;
    }
    setError('');
    const oId = record.orderId || record.id || '';
    setOrderId(oId);
    const d = extractDate(record.createdAt || record.orderDate || record.date);
    if (d) setOrderDate(d);

    // Auto-populate customer details
    populateCustomerFromRecord(record, record.customerId, 'order');

    // Auto-populate linked Quotation Ref & Date
    const qNum = record.quotationId || record.quotationNumber;
    if (qNum) {
      setQuotationId(qNum);
      const linkedQuote = quotationsList.find((q) => (q.quotationId || q.id) === qNum);
      if (linkedQuote) {
        const qd = extractDate(linkedQuote.createdAt || linkedQuote.date || linkedQuote.quotationDate);
        if (qd) setQuotationDate(qd);
      }
    } else {
      setQuotationId('');
      setQuotationDate('');
    }

    // Auto-populate Buyer PO No & Date
    const po = record.poNumber || record.customerPoNumber;
    if (po) {
      setPoNumber(po);
      const pod = extractDate(record.poDate || record.customerPoDate);
      if (pod) setPoDate(pod);
    } else {
      setPoNumber('');
      setPoDate('');
    }

    // Auto-populate linked DC No & DC Date
    const linkedDc = dcList.find((dc) =>
      (dc.orderId && dc.orderId === oId) ||
      (record.deliveryChallanId && (dc.challanId === record.deliveryChallanId || dc.id === record.deliveryChallanId)) ||
      (record.dcNo && (dc.challanId === record.dcNo || dc.id === record.dcNo))
    );
    if (linkedDc) {
      setChallanId(linkedDc.challanId || linkedDc.id || '');
      const dcd = extractDate(linkedDc.deliveryDate || linkedDc.createdAt || linkedDc.dcDate);
      if (dcd) setChallanDate(dcd);
      if (linkedDc.transitMode || linkedDc.dispatchDetails) {
        setDispatchThrough(linkedDc.transitMode || linkedDc.dispatchDetails);
        if (dcd) setDispatchDate(dcd);
      }
    } else if (record.dcNo || record.deliveryChallanId) {
      setChallanId(record.dcNo || record.deliveryChallanId);
      if (record.dcDate) setChallanDate(extractDate(record.dcDate));
    } else {
      setChallanId('');
      setChallanDate('');
    }

    // Line items: populate from order
    const itemsSource = (Array.isArray(record.lineItems) && record.lineItems.length > 0)
      ? record.lineItems
      : (Array.isArray(record.items) && record.items.length > 0 ? record.items : null);

    if (itemsSource && itemsSource.length > 0) {
      const mapped = itemsSource.map((it, idx) => {
        const qty = Math.max(1, Number(it.quantity || 1));
        const rate = Number(it.unitPrice ?? it.rate ?? it.price ?? 0);
        const disc = Number(it.discount ?? 0);
        const gst = Number(it.gst ?? 18);
        const rawSub = Math.round(qty * rate * 100) / 100;
        const discAmt = showDiscount && disc > 0 ? Math.round((rawSub * (disc / 100)) * 100) / 100 : 0;
        const taxable = Math.max(0, Math.round((rawSub - discAmt) * 100) / 100);
        const lineTax = Math.round(((taxable * gst) / 100) * 100) / 100;
        const lineTot = Math.round((taxable + lineTax) * 100) / 100;
        const serialResult = resolveSerialsForProduct(it, qty, it.serialNumbers || []);
        return {
          sl: idx + 1,
          productId: it.productId || '',
          productCode: it.productCode || it.sku || '',
          productName: it.productName || it.name || '',
          productDetails: it.productDetails || it.description || '',
          hsnSac: it.hsnSac || '85258090',
          quantity: qty,
          unit: (it.unit && it.unit !== 'Piece') ? it.unit : 'Nos',
          unitPrice: rate,
          discount: disc,
          discountAmount: discAmt,
          taxableAmount: taxable,
          lineSubtotal: rawSub,
          gst,
          lineTax,
          lineTotal: lineTot,
          isSerialized: serialResult.isSerialized,
          serialNumbers: serialResult.serialNumbers
        };
      });
      setItems(ensureTrailingBlankRow(mapped));
    }
  };

  // Multi-DC Merge Engine: Consolidates line items, serial numbers, quantities & references
  const recomputeMergedItems = (targetDcIds) => {
    setSelectedDcIds(targetDcIds);

    if (!Array.isArray(targetDcIds) || targetDcIds.length === 0) {
      setChallanId('');
      setChallanDate('');
      setItems([createEmptyRow(1)]);
      return;
    }

    const chosenDcs = targetDcIds
      .map((id) => dcList.find((d) => (d.challanId || d.id) === id))
      .filter(Boolean);

    if (chosenDcs.length === 0) return;

    // Update challanId: comma-separated list of selected DCs
    const combinedChallanId = chosenDcs.map((d) => d.challanId || d.id).join(', ');
    setChallanId(combinedChallanId);

    // Latest DC Date among selected DCs
    const latestDate = chosenDcs
      .map((d) => extractDate(d.deliveryDate || d.createdAt || d.dcDate))
      .filter(Boolean)
      .sort()
      .reverse()[0] || '';
    if (latestDate) setChallanDate(latestDate);

    // Auto-populate dispatch from latest or first DC
    const dcWithDispatch = chosenDcs.find((d) => d.transitMode || d.dispatchDetails);
    if (dcWithDispatch) {
      const mode = dcWithDispatch.transitMode
        ? `${dcWithDispatch.transitMode}${dcWithDispatch.dispatchDetails ? ` - ${dcWithDispatch.dispatchDetails}` : ''}`
        : dcWithDispatch.dispatchDetails;
      setDispatchThrough(mode);
      if (latestDate) setDispatchDate(latestDate);
    }

    // Auto-populate Order if not set and any chosen DC has it
    const dcWithOrder = chosenDcs.find((d) => d.orderId);
    if (dcWithOrder && !orderId) {
      setOrderId(dcWithOrder.orderId);
      const ord = ordersList.find((o) => (o.orderId || o.id) === dcWithOrder.orderId);
      if (ord) {
        const od = extractDate(ord.createdAt || ord.orderDate || ord.date);
        if (od) setOrderDate(od);
      }
    }

    // Auto-populate Buyer PO if not set
    const dcWithPo = chosenDcs.find((d) => d.poNumber);
    if (dcWithPo && !poNumber) {
      setPoNumber(dcWithPo.poNumber);
      if (dcWithPo.poDate) setPoDate(extractDate(dcWithPo.poDate));
    }

    // Auto-populate Quotation if not set
    const dcWithQuote = chosenDcs.find((d) => d.quotationId);
    if (dcWithQuote && !quotationId) {
      setQuotationId(dcWithQuote.quotationId);
      if (dcWithQuote.quotationDate) setQuotationDate(extractDate(dcWithQuote.quotationDate));
    }

    // Auto-populate Customer details if customer not set
    if (!selectedCustomerId && !customerName.trim() && chosenDcs[0]) {
      populateCustomerFromRecord(chosenDcs[0], chosenDcs[0].customerId, 'dc');
    }

    // Merge line items across all chosen DCs
    const mergedMap = new Map();

    chosenDcs.forEach((dc) => {
      const dcItems = Array.isArray(dc.items) ? dc.items : [];
      dcItems.forEach((it) => {
        const prodId = it.productId || '';
        const prodCode = it.productCode || it.sku || '';
        const prodName = it.productName || it.name || '';
        const rate = Number(it.unitPrice ?? it.rate ?? it.price ?? 0);
        const disc = Number(it.discount ?? 0);
        const gst = Number(it.gst ?? 18);
        const qty = Math.max(1, Number(it.quantity || it.currentDeliveryQty || 1));
        const isCable = isCableItem(it);
        const rawSerials = isCable ? [] : (Array.isArray(it.serialNumbers) ? it.serialNumbers.filter(Boolean) : []);

        const key = `${prodId || prodCode || prodName}__${rate}`;

        if (mergedMap.has(key)) {
          const existing = mergedMap.get(key);
          existing.quantity += qty;
          if (!isCable && rawSerials.length > 0) {
            const serialSet = new Set(existing.serialNumbers.map((s) => String(s).trim().toUpperCase()));
            rawSerials.forEach((sn) => {
              const norm = String(sn).trim().toUpperCase();
              if (!serialSet.has(norm)) {
                existing.serialNumbers.push(sn);
                serialSet.add(norm);
              }
            });
          }
        } else {
          mergedMap.set(key, {
            productId: prodId,
            productCode: prodCode,
            productName: prodName,
            productDetails: it.productDetails || it.description || '',
            hsnSac: it.hsnSac || '85258090',
            quantity: qty,
            unit: (it.unit && it.unit !== 'Piece') ? it.unit : 'Nos',
            unitPrice: rate,
            discount: disc,
            gst,
            isCable,
            serialNumbers: [...rawSerials]
          });
        }
      });
    });

    const mergedList = Array.from(mergedMap.values()).map((entry, idx) => {
      const rawSub = Math.round(entry.quantity * entry.unitPrice * 100) / 100;
      const discAmt = showDiscount && entry.discount > 0 ? Math.round((rawSub * (entry.discount / 100)) * 100) / 100 : 0;
      const taxable = Math.max(0, Math.round((rawSub - discAmt) * 100) / 100);
      const lineTax = Math.round(((taxable * entry.gst) / 100) * 100) / 100;
      const lineTot = Math.round((taxable + lineTax) * 100) / 100;

      const serialResult = resolveSerialsForProduct(entry, entry.quantity, entry.serialNumbers);

      return {
        sl: idx + 1,
        productId: entry.productId,
        productCode: entry.productCode,
        productName: entry.productName,
        productDetails: entry.productDetails,
        hsnSac: entry.hsnSac,
        quantity: entry.quantity,
        unit: entry.unit,
        unitPrice: entry.unitPrice,
        discount: entry.discount,
        discountAmount: discAmt,
        taxableAmount: taxable,
        lineSubtotal: rawSub,
        gst: entry.gst,
        lineTax,
        lineTotal: lineTot,
        isSerialized: serialResult.isSerialized,
        serialNumbers: serialResult.serialNumbers
      };
    });

    setItems(ensureTrailingBlankRow(mergedList));
  };

  const handleSelectDc = (record) => {
    if (!record) {
      setChallanId('');
      setChallanDate('');
      setSelectedDcIds([]);
      setDispatchThrough('Surface Courier');
      setDispatchDate('');
      setItems([createEmptyRow(1)]);
      setOrderId('');
      setOrderDate('');
      setQuotationId('');
      setQuotationDate('');
      setPoNumber('');
      setPoDate('');
      if (customerSourceRef === 'dc') {
        clearCustomerData();
      }
      return;
    }
    setError('');
    const dc = record.challanId || record.id || '';
    recomputeMergedItems([dc]);
  };

  const handleToggleDcCheckbox = (dcId) => {
    let next;
    if (selectedDcIds.includes(dcId)) {
      next = selectedDcIds.filter((id) => id !== dcId);
    } else {
      next = [...selectedDcIds, dcId];
    }
    recomputeMergedItems(next);
  };

  const handleSelectAllRelatedDcs = () => {
    const allIds = relatedDcsList.map((d) => d.challanId || d.id);
    recomputeMergedItems(allIds);
  };

  const handleResetDcSelection = () => {
    if (selectedDcIds.length > 1) {
      recomputeMergedItems([selectedDcIds[0]]);
    } else {
      recomputeMergedItems([]);
    }
  };

  const handleSelectQuotation = (record) => {
    if (!record) {
      setQuotationId('');
      setQuotationDate('');
      setItems([createEmptyRow(1)]);
      setOrderId('');
      setOrderDate('');
      setChallanId('');
      setChallanDate('');
      setPoNumber('');
      setPoDate('');
      setDispatchThrough('Surface Courier');
      setDispatchDate('');
      setPaymentTerms(companyConfig?.paymentTerms || 'Net 15 Days');
      if (customerSourceRef === 'quotation') {
        clearCustomerData();
      }
      return;
    }
    setError('');
    const qId = record.quotationId || record.id || '';
    setQuotationId(qId);
    const d = extractDate(record.createdAt || record.date || record.quotationDate);
    if (d) setQuotationDate(d);

    // Auto-populate customer details
    populateCustomerFromRecord(record, record.customerId, 'quotation');

    // Inherit commercial terms if present
    if (record.paymentTerms) setPaymentTerms(record.paymentTerms);

    // Auto-populate linked Order if one exists
    const linkedOrder = ordersList.find((o) => (o.quotationId && (o.quotationId === qId || o.quotationNumber === qId)) || (o.quotationNumber && o.quotationNumber === qId));
    if (linkedOrder) {
      setOrderId(linkedOrder.orderId || linkedOrder.id || '');
      const od = extractDate(linkedOrder.createdAt || linkedOrder.orderDate || linkedOrder.date);
      if (od) setOrderDate(od);
      if (linkedOrder.poNumber || linkedOrder.customerPoNumber) {
        setPoNumber(linkedOrder.poNumber || linkedOrder.customerPoNumber);
        const pod = extractDate(linkedOrder.poDate || linkedOrder.customerPoDate);
        if (pod) setPoDate(pod);
      }
    } else {
      setOrderId('');
      setOrderDate('');
    }

    // Auto-populate linked DC if one exists
    const linkedDc = dcList.find((dc) =>
      (dc.quotationId && dc.quotationId === qId) ||
      (linkedOrder && dc.orderId && dc.orderId === linkedOrder.orderId)
    );
    if (linkedDc) {
      setChallanId(linkedDc.challanId || linkedDc.id || '');
      const dcd = extractDate(linkedDc.deliveryDate || linkedDc.createdAt || linkedDc.dcDate);
      if (dcd) setChallanDate(dcd);
      if (linkedDc.transitMode || linkedDc.dispatchDetails) {
        setDispatchThrough(linkedDc.transitMode || linkedDc.dispatchDetails);
        if (dcd) setDispatchDate(dcd);
      }
    } else {
      setChallanId('');
      setChallanDate('');
    }

    // Inherit items from quotation
    if (Array.isArray(record.items) && record.items.length > 0) {
      const mapped = record.items.map((it, idx) => {
        const qty = Math.max(1, Number(it.quantity || 1));
        const rate = Number(it.unitPrice ?? it.rate ?? it.price ?? it.dealerPrice ?? 0);
        const disc = Math.max(0, Math.min(100, Number(it.discount !== undefined ? it.discount : (it.discountPercent || 0))));
        const gst = Number(it.gst !== undefined ? it.gst : (it.gstPercent !== undefined ? it.gstPercent : 18));
        const rawSub = Math.round(qty * rate * 100) / 100;
        const discAmt = showDiscount && disc > 0 ? Math.round((rawSub * (disc / 100)) * 100) / 100 : 0;
        const taxable = Math.max(0, Math.round((rawSub - discAmt) * 100) / 100);
        const lineTax = Math.round(((taxable * gst) / 100) * 100) / 100;
        const lineTot = Math.round((taxable + lineTax) * 100) / 100;
        const serialResult = resolveSerialsForProduct(it, qty, it.serialNumbers || []);
        return {
          sl: idx + 1,
          productId: it.productId || '',
          productCode: it.productCode || it.sku || '',
          productName: it.productName || it.name || '',
          productDetails: it.productDetails || it.description || '',
          hsnSac: it.hsnSac || '85258090',
          quantity: qty,
          unit: (it.unit && it.unit !== 'Piece') ? it.unit : 'Nos',
          unitPrice: rate,
          discount: disc,
          discountAmount: discAmt,
          taxableAmount: taxable,
          lineSubtotal: rawSub,
          gst,
          lineTax,
          lineTotal: lineTot,
          isSerialized: serialResult.isSerialized,
          serialNumbers: serialResult.serialNumbers
        };
      });
      setItems(ensureTrailingBlankRow(mapped));
    }
  };

  const handleSelectDispatch = (record) => {
    if (!record) {
      setDispatchThrough('');
      setDispatchDate('');
      return;
    }
    const disp = record.text || record.name || record.dispatchThrough || '';
    setDispatchThrough(disp);
    const d = extractDate(record.date || record.dispatchDate);
    if (d) setDispatchDate(d);
  };

  // Inter-State determination (IGST vs CGST+SGST)
  const isInterstate = useMemo(() => {
    const sState = (shippingState || consigneeState || '').toLowerCase();
    return !sState.includes('tamil nadu');
  }, [shippingState, consigneeState]);

  // Recalculate row
  const updateRowCalculations = (row, opts = {}) => {
    const isDiscShown = opts.showDiscount !== undefined ? opts.showDiscount : showDiscount;
    const qty = Math.max(1, Number(row.quantity || 1));
    const price = Math.max(0, Number(row.unitPrice || 0));
    const disc = Math.max(0, Math.min(100, Number(row.discount || 0)));
    const gst = Number(row.gst !== undefined ? row.gst : 18);

    const rawSub = Math.round(qty * price * 100) / 100;
    const discAmt = isDiscShown && disc > 0 ? Math.round((rawSub * (disc / 100)) * 100) / 100 : 0;
    const taxable = Math.max(0, Math.round((rawSub - discAmt) * 100) / 100);
    const lineTax = Math.round(((taxable * gst) / 100) * 100) / 100;
    const lineTot = Math.round((taxable + lineTax) * 100) / 100;

    return {
      ...row,
      quantity: qty,
      unitPrice: price,
      discount: disc,
      discountAmount: discAmt,
      taxableAmount: taxable,
      lineSubtotal: rawSub,
      gst,
      lineTax,
      lineTotal: lineTot
    };
  };

  const handleToggleShowDiscount = (checked) => {
    setShowDiscount(checked);
    setItems((prev) => prev.map((row) => updateRowCalculations(row, { showDiscount: checked })));
  };

  const handleProductSelect = (idx, prodId, prod) => {
    if (!prod && !prodId) return;

    const selectedId = prod?.id || prodId;
    const existingIndex = items.findIndex((it, i) => i !== idx && it.productId && it.productId === selectedId);
    if (existingIndex >= 0) {
      setDuplicateWarning(`Product "${prod?.name || prodId}" is already added. Incremented its quantity.`);
      setItems((prev) => {
        const next = [...prev];
        const currentQty = Number(next[existingIndex].quantity || 1) + 1;
        const serialInfo = resolveSerialsForProduct(next[existingIndex], currentQty, next[existingIndex].serialNumbers);
        next[existingIndex] = updateRowCalculations({
          ...next[existingIndex],
          quantity: currentQty,
          isSerialized: serialInfo.isSerialized,
          serialNumbers: serialInfo.serialNumbers
        });
        return next;
      });
      setTimeout(() => setDuplicateWarning(''), 4500);
      return;
    }

    setItems((prev) => {
      const next = [...prev];
      const targetRow = next[idx] || createEmptyRow(idx + 1);
      const qty = Math.max(1, Number(targetRow.quantity || 1));

      const price = Number(
        prod?.unitPrice !== undefined && prod?.unitPrice !== null && prod?.unitPrice !== ''
          ? prod.unitPrice
          : (prod?.dealerPrice !== undefined && prod?.dealerPrice !== null && prod?.dealerPrice !== ''
              ? prod.dealerPrice
              : (prod?.price !== undefined ? prod.price : targetRow.unitPrice || 0))
      );

      const resolvedObj = {
        ...prod,
        id: prod?.id || prodId,
        code: prod?.code || prod?.sku || targetRow.productCode || '',
        name: prod?.name || prod?.productName || targetRow.productName || '',
        categoryId: prod?.categoryId || ''
      };

      const serialInfo = resolveSerialsForProduct(resolvedObj, qty, []);

      const updated = updateRowCalculations({
        ...targetRow,
        productId: prod?.id || prodId,
        productCode: prod?.code || prod?.sku || targetRow.productCode || '',
        productName: prod?.name || prod?.productName || targetRow.productName || '',
        productDetails: prod?.description || prod?.productDetails || targetRow.productDetails || '',
        hsnSac: prod?.hsnSac || prod?.hsn || targetRow.hsnSac || '85258090',
        unit: (prod?.unit && prod.unit !== 'Piece') ? prod.unit : ((targetRow.unit && targetRow.unit !== 'Piece') ? targetRow.unit : 'Nos'),
        unitPrice: price,
        gst: Number(prod?.gstPercent !== undefined ? prod.gstPercent : (prod?.gst !== undefined ? prod.gst : 18)),
        isSerialized: serialInfo.isSerialized,
        serialNumbers: serialInfo.serialNumbers
      });

      next[idx] = updated;
      return ensureTrailingBlankRow(next);
    });
  };

  const handleRowChange = (idx, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      let target = { ...next[idx], [field]: value };
      if (field === 'quantity') {
        const newQty = Math.max(1, Number(value || 1));
        if (target.isSerialized || (Array.isArray(target.serialNumbers) && target.serialNumbers.length > 0)) {
          const serialInfo = resolveSerialsForProduct(target, newQty, target.serialNumbers);
          target.serialNumbers = serialInfo.serialNumbers;
          target.isSerialized = serialInfo.isSerialized;
        }
      }
      next[idx] = updateRowCalculations(target);
      return next;
    });
  };

  const handleSaveSerialsFromModal = (rowIdx, newSerials) => {
    if (rowIdx === null || rowIdx === undefined || !items[rowIdx]) return;
    setItems((prev) => {
      const next = [...prev];
      const target = next[rowIdx];
      const safeSerials = Array.isArray(newSerials) ? newSerials : [];
      const updated = {
        ...target,
        isSerialized: true,
        serialNumbers: safeSerials,
        quantity: Math.max(Number(target.quantity || 1), safeSerials.length)
      };
      next[rowIdx] = updateRowCalculations(updated);
      return next;
    });
    setActiveSerialRowIdx(null);
  };

  const handleDeleteRow = (idx) => {
    setItems((prev) => {
      if (prev.length <= 1) {
        return [createEmptyRow(1)];
      }
      const filtered = prev.filter((_, i) => i !== idx);
      return ensureTrailingBlankRow(filtered);
    });
  };

  const handleAddRow = () => {
    setItems((prev) => {
      const nonEmpty = prev.filter((it) => !isRowEmpty(it));
      return [...nonEmpty, createEmptyRow(nonEmpty.length + 1), createEmptyRow(nonEmpty.length + 2)];
    });
  };

  // Grand totals computation
  const {
    grossSubtotal,
    totalDiscount,
    taxableSubtotal,
    gstTotal,
    cgst,
    sgst,
    igst,
    calculatedTotal,
    roundOff,
    grandTotal
  } = useMemo(() => {
    let gross = 0;
    let discSum = 0;
    let taxable = 0;
    let totalTax = 0;

    items.forEach((it) => {
      if (isRowEmpty(it)) return;
      gross += Number(it.lineSubtotal || 0);
      discSum += showDiscount ? Number(it.discountAmount || 0) : 0;
      taxable += Number(it.taxableAmount || 0);
      totalTax += Number(it.lineTax || 0);
    });

    gross = Math.round(gross * 100) / 100;
    discSum = Math.round(discSum * 100) / 100;
    taxable = Math.round(taxable * 100) / 100;
    totalTax = Math.round(totalTax * 100) / 100;

    let cgstVal = 0;
    let sgstVal = 0;
    let igstVal = 0;

    if (isInterstate) {
      igstVal = totalTax;
    } else {
      cgstVal = Math.round((totalTax / 2) * 100) / 100;
      sgstVal = Math.round((totalTax - cgstVal) * 100) / 100;
    }

    const calcTotal = Math.round((taxable + totalTax) * 100) / 100;
    let roundOffVal = 0;
    let finalGrand = calcTotal;

    if (roundOffEnabled && calcTotal > 0) {
      finalGrand = Math.round(calcTotal);
      roundOffVal = Math.round((finalGrand - calcTotal) * 100) / 100;
    }

    return {
      grossSubtotal: gross,
      totalDiscount: discSum,
      taxableSubtotal: taxable,
      gstTotal: totalTax,
      cgst: cgstVal,
      sgst: sgstVal,
      igst: igstVal,
      calculatedTotal: calcTotal,
      roundOff: roundOffVal,
      grandTotal: finalGrand
    };
  }, [items, showDiscount, roundOffEnabled, isInterstate]);

  const handleSubmit = async (e, statusTarget = 'ISSUED') => {
    e.preventDefault();
    if (!selectedCustomerId && !customerName.trim()) {
      setError('Please select or create a Customer before issuing the invoice.');
      return;
    }

    const validItems = items.filter((it) => !isRowEmpty(it));
    if (validItems.length === 0) {
      setError('At least one valid line item is required to issue a sales invoice.');
      return;
    }

    for (const it of validItems) {
      if (isCableItem(it)) {
        it.isSerialized = false;
        it.serialNumbers = [];
        continue;
      }
      const isSerialized = Boolean(it.isSerialized || it.serialized || (Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0));
      const qty = Number(it.quantity || 1);
      const serials = (it.serialNumbers || []).filter(Boolean);
      if (isSerialized && serials.length !== qty && statusTarget === 'ISSUED') {
        setError(`${qty} serial numbers are required for quantity ${qty} on item "${it.productName || 'Item'}".`);
        return;
      }
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        orderId: orderId || undefined,
        challanId: selectedDcIds.length > 0 ? selectedDcIds.join(', ') : (challanId || null),
        challanIds: selectedDcIds.length > 0 ? selectedDcIds : (challanId ? [challanId] : []),
        challanDate: challanDate || null,
        dcNo: selectedDcIds.length > 0 ? selectedDcIds.join(', ') : (challanId || null),
        dcDate: challanDate || null,
        quotationId: quotationId || null,
        quotationDate: quotationDate || null,

        customerId: selectedCustomerId || selectedCustomer?.id || undefined,
        customerName: customerName.trim() || selectedCustomer?.name,
        company: company.trim() || selectedCustomer?.company || selectedCustomer?.name,

        consigneeName: consigneeName.trim() || customerName.trim(),
        consigneeAddress: consigneeAddress.trim(),
        consigneeGstin: consigneeGstin.trim(),
        consigneeState: consigneeState.trim(),

        shippingAddress: shippingAddress.trim() || consigneeAddress.trim(),
        shippingGstin: shippingGstin.trim() || consigneeGstin.trim(),
        shippingState: shippingState.trim() || consigneeState.trim(),

        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim(),

        invoiceDate,
        dueDate,
        status: statusTarget,
        paymentTerms,
        paymentStatus,
        paymentMode,

        poNumber: poNumber.trim() || null,
        poDate: poDate || null,
        customerPoNumber: poNumber.trim() || null,
        customerPoDate: poDate || null,

        dispatchThrough: dispatchThrough.trim() || null,
        dispatchDate: dispatchDate || null,
        remarks,

        showDiscount: Boolean(showDiscount),
        roundOffEnabled: Boolean(roundOffEnabled),
        roundOff,
        subtotal: grossSubtotal,
        totalDiscount,
        discount: totalDiscount,
        taxableSubtotal,
        gstTotal,
        grandTotal,

        items: validItems
      };

      const res = await apiFetch(apiUrl('/api/orders/invoices'), {
        method: 'POST',
        headers: authHeaders(user),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to create sales invoice.');
      }

      onSuccess && onSuccess(data.data);
      onClose();
    } catch (err) {
      console.error('Error saving sales invoice:', err);
      setError(err.message || 'Error creating sales invoice.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="crm-modal-backdrop" onClick={onClose}>
      <div
        className="crm-modal-dialog invoice-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '1080px',
          width: '95vw',
          maxHeight: 'min(92vh, 920px)',
          height: 'min(92vh, 920px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0
        }}
      >
        {/* MODAL HEADER */}
        <div
          className="crm-modal-header"
          style={{
            borderBottom: '1px solid #e2e8f0',
            padding: '16px 20px',
            flex: '0 0 auto',
            background: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 className="crm-modal-title" style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                Generate Sales Invoice (INV)
              </h2>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                Tax Invoice
              </span>
            </div>
            <p className="crm-modal-subtitle" style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              {order ? (
                <>
                  Order Ref: <strong>{order.orderId}</strong>
                  {challan && <> &bull; DC Ref: <strong>{challan.challanId}</strong></>}
                  &bull; Customer: <strong>{customerName || order.customerName}</strong>
                </>
              ) : (
                <>Issue Commercial Tax Invoice &bull; Select or Create Customer</>
              )}
            </p>
          </div>
          <button type="button" className="crm-modal-close-btn" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {/* NOTIFICATIONS */}
        {error && (
          <div className="crm-alert-box error modal-alert" style={{ margin: '12px 20px 0', flex: '0 0 auto' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {duplicateWarning && (
          <div className="crm-alert-box warning modal-alert" style={{ margin: '12px 20px 0', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', flex: '0 0 auto' }}>
            <AlertCircle size={16} />
            <span>{duplicateWarning}</span>
          </div>
        )}

        {/* MODAL BODY */}
        <div style={{ padding: '20px', flex: '1 1 auto', overflowY: 'auto', overflowX: 'hidden' }}>
          {/* SECTION 1: CUSTOMER SELECTION */}
          <div style={{ marginBottom: '18px' }}>
            <CustomerSelector
              label="CUSTOMER / COMPANY *"
              placeholder="Search customer by name, phone, company, or ID..."
              selectedCustomerId={selectedCustomerId}
              selectedCustomerData={selectedCustomer || (customerName ? { id: selectedCustomerId, name: customerName, company } : null)}
              onSelectCustomer={(id, cust) => handleSelectCustomer(id, cust, null, true)}
              showSummaryTable={false}
              allowCreate={true}
              required={true}
            />

            {/* Customer Snapshot Card */}
            {(selectedCustomer || customerName) && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '12px 14px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
                      {customerName || selectedCustomer?.name}
                    </span>
                    {company && company !== (customerName || selectedCustomer?.name) && (
                      <span style={{ color: '#64748b' }}>({company})</span>
                    )}
                    {selectedCustomerId && (
                      <span style={{ fontSize: '10.5px', padding: '2px 6px', background: '#e0f2fe', color: '#0369a1', borderRadius: '4px', fontWeight: 600 }}>
                        {selectedCustomerId}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: isInterstate ? '#b45309' : '#047857', background: isInterstate ? '#fef3c7' : '#d1fae5', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    {isInterstate ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', color: '#334155' }}>
                  <div>
                    <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Contact Person</div>
                    <div>{contactPerson || selectedCustomer?.contactPerson || '—'}</div>
                    <div style={{ color: '#64748b' }}>{customerPhone ? `+91 ${customerPhone}` : '—'}</div>
                    <div style={{ color: '#64748b' }}>{customerEmail || '—'}</div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Billing (Consignee)</div>
                    <div style={{ fontSize: '11.5px', lineHeight: '1.3' }}>{consigneeAddress || '—'}</div>
                    <div style={{ marginTop: '2px' }}>GSTIN: <strong>{consigneeGstin || 'UNREGISTERED'}</strong></div>
                    <div>State: <strong>{consigneeState}</strong></div>
                  </div>

                  <div>
                    <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Shipping Address</div>
                    <div style={{ fontSize: '11.5px', lineHeight: '1.3' }}>{shippingAddress || consigneeAddress || 'Same as billing'}</div>
                    <div style={{ marginTop: '2px' }}>State: <strong>{shippingState}</strong></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: DATES, TERMS & PROVENANCE GRID */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: '12px',
              marginBottom: '18px',
              background: '#f8fafc',
              padding: '14px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}
          >
            {/* ROW 1: INVOICE DATE, DUE DATE, PAYMENT TERMS, INITIAL PAYMENT STATUS */}
            <div>
              <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Invoice Date *</label>
              <input
                type="date"
                className="crm-form-input"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Due Date *</label>
              <input
                type="date"
                className="crm-form-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Payment Terms</label>
              <select
                className="crm-form-input"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
              >
                <option value="Immediate">Immediate / Advance</option>
                <option value="Net 15 Days">Net 15 Days</option>
                <option value="Net 30 Days">Net 30 Days</option>
                <option value="Net 45 Days">Net 45 Days</option>
                <option value="100% Advance">100% Advance</option>
              </select>
            </div>

            <div>
              <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Payment Status</label>
              <select
                className="crm-form-input"
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
              >
                <option value="PENDING">Pending (Payment Awaited)</option>
                <option value="PAID">Paid (Full Payment Received)</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
              </select>
            </div>

            {/* ROW 2: ORDER REF, DC NO, DC DATE, QUOTATION REF */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569', margin: 0 }}>Order Ref</label>
                {orderDate && (
                  <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 600 }} title="Linked Order Date">
                    {orderDate}
                  </span>
                )}
              </div>
              <SearchableReferenceSelect
                value={orderId}
                onChange={(val) => {
                  setOrderId(val);
                  if (!val) handleSelectOrder(null);
                }}
                onSelect={handleSelectOrder}
                records={filteredOrdersList}
                getRecordId={(r) => r.orderId || r.id || ''}
                getRecordTitle={(r) => r.orderId || ''}
                getRecordSubtitle={(r) => r.customerName || r.company || ''}
                getRecordDate={(r) => extractDate(r.createdAt || r.orderDate || r.date)}
                placeholder="ORD-XXXXXX"
              />
            </div>

            <div>
              <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>DC No</label>
              <SearchableReferenceSelect
                value={challanId}
                onChange={(val) => {
                  setChallanId(val);
                  if (!val) handleSelectDc(null);
                }}
                onSelect={handleSelectDc}
                records={filteredDcList}
                getRecordId={(r) => r.challanId || r.id || ''}
                getRecordTitle={(r) => r.challanId || ''}
                getRecordSubtitle={(r) => r.customerName || r.company || r.receiverName || ''}
                getRecordDate={(r) => extractDate(r.deliveryDate || r.createdAt || r.dcDate)}
                placeholder="DC-XXXXXX"
              />
            </div>

            <div>
              <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>DC Date</label>
              <input
                type="date"
                className="crm-form-input"
                value={challanDate}
                onChange={(e) => setChallanDate(e.target.value)}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569', margin: 0 }}>Quotation Ref</label>
                {quotationDate && (
                  <span style={{ fontSize: '10px', color: '#2563eb', fontWeight: 600 }} title="Linked Quotation Date">
                    {quotationDate}
                  </span>
                )}
              </div>
              <SearchableReferenceSelect
                value={quotationId}
                onChange={(val) => {
                  setQuotationId(val);
                  if (!val) handleSelectQuotation(null);
                }}
                onSelect={handleSelectQuotation}
                records={filteredQuotationsList}
                getRecordId={(r) => r.quotationId || r.id || ''}
                getRecordTitle={(r) => r.quotationId || ''}
                getRecordSubtitle={(r) => r.customerName || r.customerCompany || ''}
                getRecordDate={(r) => extractDate(r.createdAt || r.date || r.quotationDate)}
                placeholder="QT-XXXXXX"
              />
            </div>

            {/* ROW 3: BUYER PO NO, PO DATE, PAYMENT MODE, DISPATCH THROUGH */}
            <div>
              <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Buyer PO Number</label>
              <input
                type="text"
                className="crm-form-input"
                placeholder="Buyer PO number..."
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
              />
            </div>

            <div>
              <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Buyer PO Date</label>
              <input
                type="date"
                className="crm-form-input"
                value={poDate}
                onChange={(e) => setPoDate(e.target.value)}
              />
            </div>

            <div>
              <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Payment Mode</label>
              <select
                className="crm-form-input"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                <option value="Bank Transfer">NEFT / RTGS / Bank Transfer</option>
                <option value="UPI">UPI / QR Code</option>
                <option value="Cheque">Cheque</option>
                <option value="Credit / Debit Card">Credit / Debit Card</option>
                <option value="Cash">Cash</option>
              </select>
            </div>

            <div>
              <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Dispatch Through</label>
              <SearchableReferenceSelect
                value={dispatchThrough}
                onChange={(val) => {
                  setDispatchThrough(val);
                  if (!val) handleSelectDispatch(null);
                }}
                onSelect={handleSelectDispatch}
                records={dispatchList}
                getRecordId={(r) => r.text || r.id || ''}
                getRecordTitle={(r) => r.text || ''}
                getRecordSubtitle={(r) => r.details || ''}
                getRecordDate={(r) => extractDate(r.date)}
                placeholder="e.g. Surface Courier"
              />
            </div>
          </div>

          {/* SECTION 2.5: RELATED DELIVERY CHALLANS (PARTIAL / MULTI-DC MERGE) */}
          {relatedDcsList.length > 1 && (
            <div
              className="crm-related-dcs-card"
              style={{
                marginBottom: '18px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '14px 16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckSquare size={16} color="#15803d" />
                  <span style={{ fontWeight: 700, fontSize: '13px', color: '#166534' }}>
                    Merge Multiple Delivery Challans (Partial Shipments)
                  </span>
                  <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                    {selectedDcIds.length} of {relatedDcsList.length} DCs Selected
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleSelectAllRelatedDcs}
                    style={{
                      fontSize: '11.5px',
                      color: '#15803d',
                      background: '#ffffff',
                      border: '1px solid #86efac',
                      padding: '3px 10px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDcSelection}
                    style={{
                      fontSize: '11.5px',
                      color: '#64748b',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      padding: '3px 10px',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                {relatedDcsList.map((dc) => {
                  const dcId = dc.challanId || dc.id;
                  const isChecked = selectedDcIds.includes(dcId);
                  const items = Array.isArray(dc.items) ? dc.items : [];
                  const dcUnits = items.reduce((sum, it) => sum + Number(it.quantity || it.currentDeliveryQty || 1), 0);
                  const itemSummary = items.map((it) => `${it.productName || it.name || 'Item'} (${it.quantity || 1})`).join(', ');

                  return (
                    <label
                      key={dcId}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        background: isChecked ? '#ffffff' : '#f8fafc',
                        border: isChecked ? '1.5px solid #16a34a' : '1px solid #e2e8f0',
                        cursor: 'pointer',
                        boxShadow: isChecked ? '0 1px 3px rgba(22, 163, 74, 0.12)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleDcCheckbox(dcId)}
                        style={{ marginTop: '2px', accentColor: '#16a34a', width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '12.5px' }}>{dcId}</span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>{extractDate(dc.deliveryDate || dc.createdAt)}</span>
                        </div>
                        <div
                          style={{
                            color: '#334155',
                            fontSize: '11.5px',
                            marginTop: '2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          title={itemSummary}
                        >
                          {itemSummary || `${dcUnits} units`}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '10px', background: '#f1f5f9', color: '#334155', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            {dcUnits} {dcUnits === 1 ? 'Unit' : 'Units'}
                          </span>
                          {dc.refNo && (
                            <span style={{ fontSize: '10px', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                              Ref: {dc.refNo}
                            </span>
                          )}
                          {dc.orderId && (
                            <span style={{ fontSize: '10px', background: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: '4px' }}>
                              Order: {dc.orderId}
                            </span>
                          )}
                          {dc.deliveryStatus && (
                            <span
                              style={{
                                fontSize: '10px',
                                background: dc.deliveryStatus === 'PARTIAL' ? '#fff7ed' : '#f0fdf4',
                                color: dc.deliveryStatus === 'PARTIAL' ? '#c2410c' : '#15803d',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontWeight: 600
                              }}
                            >
                              {dc.deliveryStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 3: LINE ITEMS TABLE & TAX CALCULATION */}
          <div className="invoice-calc-card" style={{ marginBottom: '18px', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
              <span className="section-kicker" style={{ margin: 0, fontWeight: 700, fontSize: '12px', color: '#1e293b', letterSpacing: '0.04em' }}>
                INVOICE LINE ITEMS &amp; TAX CALCULATION
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={showDiscount}
                    onChange={(e) => handleToggleShowDiscount(e.target.checked)}
                    style={{ accentColor: '#2563eb', width: '14px', height: '14px', cursor: 'pointer' }}
                  />
                  <span>Show Discount (%)</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={roundOffEnabled}
                    onChange={(e) => setRoundOffEnabled(e.target.checked)}
                    style={{ accentColor: '#2563eb', width: '14px', height: '14px', cursor: 'pointer' }}
                  />
                  <span>Round Off Total</span>
                </label>
              </div>
            </div>

            <div className="invoice-items-table-wrap" style={{ overflow: 'visible', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ width: '38px', textAlign: 'center', padding: '9px 4px', color: '#475569', fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em' }}>#</th>
                    <th style={{ width: showDiscount ? '26%' : '29%', padding: '9px 8px', textAlign: 'left', color: '#475569', fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em' }}>PRODUCT / DESCRIPTION</th>
                    <th style={{ width: showDiscount ? '18%' : '20%', padding: '9px 6px', textAlign: 'left', color: '#475569', fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em' }}>SERIAL NO(S)</th>
                    <th style={{ width: '82px', textAlign: 'center', padding: '9px 4px', color: '#475569', fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em' }}>HSN/SAC</th>
                    <th style={{ width: '58px', textAlign: 'center', padding: '9px 4px', color: '#475569', fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em' }}>QTY</th>
                    <th style={{ width: '88px', textAlign: 'right', padding: '9px 6px', color: '#475569', fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em' }}>RATE (₹)</th>
                    {showDiscount && (
                      <th style={{ width: '64px', textAlign: 'center', padding: '9px 4px', color: '#475569', fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em' }}>DISC %</th>
                    )}
                    <th style={{ width: '68px', textAlign: 'center', padding: '9px 4px', color: '#475569', fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em' }}>GST</th>
                    <th style={{ width: '86px', textAlign: 'right', padding: '9px 6px', color: '#475569', fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em' }}>TAX (₹)</th>
                    <th style={{ width: '96px', textAlign: 'right', padding: '9px 8px', color: '#475569', fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em' }}>TOTAL (₹)</th>
                    <th style={{ width: '36px', textAlign: 'center', padding: '9px 2px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => {
                    const rowEmpty = isRowEmpty(row);
                    const qty = Number(row.quantity || 1);
                    const serialCount = Array.isArray(row.serialNumbers) ? row.serialNumbers.length : 0;
                    const isSerialComplete = row.isSerialized && serialCount === qty;
                    const isSerialMismatch = row.isSerialized && serialCount !== qty;

                    return (
                      <tr
                        key={idx}
                        className={openSerialDropdownIdx === idx ? 'has-open-popover' : ''}
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          background: rowEmpty ? '#fafafa' : '#ffffff',
                          transition: 'background 0.15s ease',
                          position: openSerialDropdownIdx === idx ? 'relative' : 'static',
                          zIndex: openSerialDropdownIdx === idx ? 99 : 1
                        }}
                      >
                        {/* SL NO */}
                        <td style={{ textAlign: 'center', color: '#64748b', fontSize: '11.5px', fontWeight: 600, padding: '8px 4px', verticalAlign: 'top', paddingTop: '14px' }}>
                          {idx + 1}
                        </td>

                        {/* PRODUCT SELECT / NAME */}
                        <td style={{ padding: '8px 6px', verticalAlign: 'top' }}>
                          <SearchableProductSelect
                            items={products}
                            products={products}
                            selectedId={row.productId}
                            value={row.productId}
                            selectedName={row.productName}
                            onChange={(prodId, prod) => handleProductSelect(idx, prodId, prod)}
                            onDirectNameChange={(name) => handleRowChange(idx, 'productName', name)}
                            placeholder="Type to search or select product..."
                            disabled={loadingStocks}
                          />
                          {!rowEmpty && (
                            <input
                              type="text"
                              style={{
                                width: '100%',
                                height: '26px',
                                marginTop: '4px',
                                fontSize: '11px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                padding: '2px 8px',
                                color: '#475569',
                                boxSizing: 'border-box',
                                background: '#f8fafc'
                              }}
                              placeholder="Product details / description (optional)"
                              value={row.productDetails || ''}
                              onChange={(e) => handleRowChange(idx, 'productDetails', e.target.value)}
                            />
                          )}
                        </td>

                        {/* SERIAL NUMBERS */}
                        <td className="serial-dropdown-cell">
                          <SerialDropdownCell
                            row={row}
                            rowIndex={idx}
                            isOpen={openSerialDropdownIdx === idx}
                            onToggle={() => setOpenSerialDropdownIdx((prev) => (prev === idx ? null : idx))}
                            onClose={() => setOpenSerialDropdownIdx(null)}
                            onUpdateSerials={(newSerials) => {
                              if (isCableItem(row)) {
                                handleRowChange(idx, 'serialNumbers', []);
                                handleRowChange(idx, 'isSerialized', false);
                                return;
                              }
                              handleRowChange(idx, 'serialNumbers', newSerials);
                              if (newSerials.length > 0 && !row.isSerialized) {
                                handleRowChange(idx, 'isSerialized', true);
                              }
                            }}
                            onOpenModal={() => {
                              if (!isCableItem(row)) {
                                setActiveSerialRowIdx(idx);
                              }
                            }}
                            onAutoFetch={() => {
                              if (isCableItem(row)) {
                                handleRowChange(idx, 'serialNumbers', []);
                                handleRowChange(idx, 'isSerialized', false);
                                return;
                              }
                              const res = resolveSerialsForProduct(row, qty, []);
                              handleRowChange(idx, 'serialNumbers', res.serialNumbers);
                              handleRowChange(idx, 'isSerialized', res.isSerialized);
                            }}
                            disabled={loadingStocks}
                            isNearBottom={idx >= items.length - 2 && items.length > 3}
                          />
                        </td>

                        {/* HSN/SAC */}
                        <td style={{ textAlign: 'center', padding: '8px 4px', verticalAlign: 'top' }}>
                          {rowEmpty ? (
                            <div style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                              —
                            </div>
                          ) : (
                            <input
                              type="text"
                              className="crm-form-input"
                              style={{
                                height: '32px',
                                width: '100%',
                                textAlign: 'center',
                                padding: '4px 2px',
                                fontSize: '11.5px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                fontFamily: 'Consolas, Monaco, monospace',
                                boxSizing: 'border-box',
                                background: '#ffffff'
                              }}
                              value={row.hsnSac || '85258090'}
                              onChange={(e) => handleRowChange(idx, 'hsnSac', e.target.value)}
                            />
                          )}
                        </td>

                        {/* QTY */}
                        <td style={{ textAlign: 'center', padding: '8px 4px', verticalAlign: 'top' }}>
                          {rowEmpty ? (
                            <div style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                              —
                            </div>
                          ) : (
                            <input
                              type="number"
                              min="1"
                              className="crm-form-input"
                              style={{
                                height: '32px',
                                width: '100%',
                                textAlign: 'center',
                                padding: '4px 2px',
                                fontSize: '12px',
                                fontWeight: 700,
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                boxSizing: 'border-box',
                                background: '#ffffff',
                                color: '#0f172a'
                              }}
                              value={row.quantity || 1}
                              onChange={(e) => handleRowChange(idx, 'quantity', e.target.value)}
                            />
                          )}
                        </td>

                        {/* RATE */}
                        <td style={{ textAlign: 'right', padding: '8px 4px', verticalAlign: 'top' }}>
                          {rowEmpty ? (
                            <div style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                              —
                            </div>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className="crm-form-input"
                              style={{
                                height: '32px',
                                width: '100%',
                                textAlign: 'right',
                                padding: '4px 6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                boxSizing: 'border-box',
                                background: '#ffffff',
                                color: '#0f172a'
                              }}
                              value={row.unitPrice ?? 0}
                              onChange={(e) => handleRowChange(idx, 'unitPrice', e.target.value)}
                            />
                          )}
                        </td>

                        {/* DISCOUNT */}
                        {showDiscount && (
                          <td style={{ textAlign: 'center', padding: '8px 4px', verticalAlign: 'top' }}>
                            {rowEmpty ? (
                              <div style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                                —
                              </div>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                className="crm-form-input"
                                style={{
                                  height: '32px',
                                  width: '100%',
                                  textAlign: 'center',
                                  padding: '4px 2px',
                                  fontSize: '11.5px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  boxSizing: 'border-box',
                                  background: '#ffffff'
                                }}
                                value={row.discount ?? 0}
                                onChange={(e) => handleRowChange(idx, 'discount', e.target.value)}
                              />
                            )}
                          </td>
                        )}

                        {/* GST */}
                        <td style={{ textAlign: 'center', padding: '8px 4px', verticalAlign: 'top' }}>
                          {rowEmpty ? (
                            <div style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                              —
                            </div>
                          ) : (
                            <select
                              className="crm-form-input"
                              style={{
                                height: '32px',
                                width: '100%',
                                textAlign: 'center',
                                padding: '4px 2px',
                                fontSize: '11.5px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                boxSizing: 'border-box',
                                cursor: 'pointer'
                              }}
                              value={row.gst ?? 18}
                              onChange={(e) => handleRowChange(idx, 'gst', e.target.value)}
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          )}
                        </td>

                        {/* TAX AMOUNT */}
                        <td style={{ textAlign: 'right', padding: '8px 6px', verticalAlign: 'top' }}>
                          <div
                            style={{
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              fontSize: '12px',
                              color: '#475569',
                              fontWeight: 500,
                              paddingRight: '2px'
                            }}
                          >
                            {rowEmpty ? '—' : `₹${(row.lineTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          </div>
                        </td>

                        {/* TOTAL */}
                        <td style={{ textAlign: 'right', padding: '8px 8px', verticalAlign: 'top' }}>
                          <div
                            style={{
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              fontSize: '12.5px',
                              color: '#0f172a',
                              fontWeight: 700,
                              paddingRight: '2px'
                            }}
                          >
                            {rowEmpty ? '—' : `₹${(row.lineTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          </div>
                        </td>

                        {/* REMOVE ACTION */}
                        <td style={{ textAlign: 'center', padding: '8px 2px', verticalAlign: 'top' }}>
                          {!rowEmpty && (
                            <div style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(idx)}
                                title="Delete Row"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  padding: '5px',
                                  borderRadius: '5px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'background 0.15s ease'
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#fee2e2')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-start' }}>
              <button
                type="button"
                className="crm-btn-secondary"
                onClick={handleAddRow}
                style={{ fontSize: '11.5px', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <Plus size={13} /> Add Line Item
              </button>
            </div>

            {/* TOTALS BREAKDOWN */}
            <div
              className="invoice-totals-breakdown"
              style={{
                marginTop: '16px',
                marginLeft: 'auto',
                maxWidth: '380px',
                padding: '12px 14px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px'
              }}
            >
              <div className="total-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px', color: '#475569' }}>
                <span>Subtotal (Gross):</span>
                <strong>₹{grossSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>

              {showDiscount && (
                <>
                  <div className="total-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px', color: '#16a34a' }}>
                    <span>Discount:</span>
                    <strong>- ₹{totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="total-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px', color: '#475569' }}>
                    <span>Taxable Subtotal:</span>
                    <strong>₹{taxableSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                </>
              )}

              {isInterstate ? (
                <div className="total-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px', color: '#475569' }}>
                  <span>IGST:</span>
                  <strong>₹{igst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
              ) : (
                <>
                  <div className="total-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px', color: '#475569' }}>
                    <span>CGST:</span>
                    <strong>₹{cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="total-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px', color: '#475569' }}>
                    <span>SGST:</span>
                    <strong>₹{sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                </>
              )}

              <div className="total-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px', color: '#475569' }}>
                <span>Total GST:</span>
                <strong>₹{gstTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>

              {roundOffEnabled && (
                <>
                  <div className="total-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px', color: '#475569' }}>
                    <span>Calculated Total:</span>
                    <strong>₹{calculatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                  <div className="total-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px', color: '#475569' }}>
                    <span>Round Off:</span>
                    <strong style={{ color: roundOff >= 0 ? '#16a34a' : '#dc2626' }}>
                      {roundOff >= 0 ? '+' : ''}₹{roundOff.toFixed(2)}
                    </strong>
                  </div>
                </>
              )}

              <div
                className="total-row grand-total-row"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: '8px',
                  marginTop: '6px',
                  borderTop: '2px solid #cbd5e1',
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#0f172a'
                }}
              >
                <span>Grand Total:</span>
                <strong style={{ color: '#2563eb' }}>
                  ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>

              <div className="words-preview-line" style={{ marginTop: '8px', fontSize: '11px', color: '#64748b', fontStyle: 'italic', textAlign: 'right' }}>
                <span>In Words:</span> <em>{amountInWords(grandTotal)}</em>
              </div>
            </div>
          </div>

          {/* SECTION 4: REMARKS */}
          <div style={{ marginBottom: '14px' }}>
            <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
              Remarks / Terms of Payment
            </label>
            <textarea
              className="crm-form-input"
              rows="2"
              placeholder="Invoice terms, payment notes, declaration..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div
          className="crm-modal-footer"
          style={{
            borderTop: '1px solid #e2e8f0',
            padding: '12px 20px',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '10px',
            flex: '0 0 auto'
          }}
        >
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={(e) => handleSubmit(e, 'DRAFT')}
            disabled={submitting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Clock size={14} /> Save as Draft
          </button>
          <button
            type="button"
            className="crm-btn-primary"
            onClick={(e) => handleSubmit(e, 'ISSUED')}
            disabled={submitting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {submitting ? 'Generating Invoice...' : '✓ Issue Sales Invoice'}
          </button>
        </div>
      </div>

      {/* SERIAL NUMBER MODAL */}
      {activeSerialRowIdx !== null && items[activeSerialRowIdx] && (
        <SerialNumberModal
          isOpen={true}
          onClose={() => setActiveSerialRowIdx(null)}
          onSave={(newSerials) => handleSaveSerialsFromModal(activeSerialRowIdx, newSerials)}
          product={items[activeSerialRowIdx]}
          requiredCount={Number(items[activeSerialRowIdx]?.quantity || 1)}
          initialSerials={items[activeSerialRowIdx]?.serialNumbers || []}
        />
      )}
    </div>
  );
}
