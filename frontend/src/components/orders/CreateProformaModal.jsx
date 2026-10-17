import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch, apiUrl } from '../../api';
import CustomerSelector from '../customer/CustomerSelector';
import SearchableProductSelect from '../common/SearchableProductSelect';
import SearchableReferenceSelect from '../common/SearchableReferenceSelect';
import { useCompanyConfig } from '../documents/companyConfig';
import { Trash2, Plus, AlertCircle, FileText, CheckCircle, Clock, Check, CheckSquare } from 'lucide-react';

function authHeaders(user) {
  return {
    'Content-Type': 'application/json',
    'x-user-id': user?.id || ''
  };
}

export default function CreateProformaModal({
  proforma = null, // if editing or revising
  isRevision = false,
  upstreamQuotation = null, // if creating from quotation
  upstreamOrder = null, // if creating from sales order
  user,
  onClose,
  onSuccess
}) {
  const [products, setProducts] = useState([]);
  const [loadingStocks, setLoadingStocks] = useState(false);

  // Customer state
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    proforma?.customerId || upstreamQuotation?.customerId || upstreamOrder?.customerId || ''
  );
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerName, setCustomerName] = useState(
    proforma?.customerName || upstreamQuotation?.customerName || upstreamOrder?.customerName || ''
  );
  const [company, setCompany] = useState(
    proforma?.company || upstreamQuotation?.customerCompany || upstreamOrder?.company || ''
  );
  const [contactPerson, setContactPerson] = useState(
    proforma?.contactPerson || upstreamQuotation?.contactPerson || ''
  );
  const [customerPhone, setCustomerPhone] = useState(
    proforma?.customerPhone || upstreamQuotation?.customerPhone || ''
  );
  const [customerEmail, setCustomerEmail] = useState(
    proforma?.customerEmail || upstreamQuotation?.customerEmail || ''
  );

  const [consigneeName, setConsigneeName] = useState(
    proforma?.consigneeName || customerName || company || ''
  );
  const [consigneeAddress, setConsigneeAddress] = useState(
    proforma?.consigneeAddress || ''
  );
  const [consigneeGstin, setConsigneeGstin] = useState(
    proforma?.consigneeGstin || ''
  );
  const [consigneeState, setConsigneeState] = useState(
    proforma?.consigneeState || 'Tamil Nadu'
  );

  const [shippingAddress, setShippingAddress] = useState(
    proforma?.shippingAddress || ''
  );
  const [shippingGstin, setShippingGstin] = useState(
    proforma?.shippingGstin || ''
  );
  const [shippingState, setShippingState] = useState(
    proforma?.shippingState || 'Tamil Nadu'
  );

  // Proforma dates & terms
  const today = new Date().toISOString().slice(0, 10);
  const defaultValidUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [proformaDate, setProformaDate] = useState(
    isRevision ? today : (proforma?.proformaDate || today)
  );
  const [validUntil, setValidUntil] = useState(
    isRevision ? defaultValidUntil : (proforma?.validUntil || defaultValidUntil)
  );

  const companyConfig = useCompanyConfig(user);

  const [paymentTerms, setPaymentTerms] = useState(
    proforma?.paymentTerms || companyConfig?.paymentTerms || '100% ADVANCE PAYMENT'
  );
  const [deliveryTerms, setDeliveryTerms] = useState(
    proforma?.deliveryTerms || companyConfig?.deliveryTerms || 'EX-STOCK / 1-2 WEEKS'
  );
  const [validityNotes, setValidityNotes] = useState(
    proforma?.validityNotes || companyConfig?.validityTerms || '15 DAYS FROM INVOICE DATE'
  );
  const [remarks, setRemarks] = useState(proforma?.remarks || '');
  const [revisionReason, setRevisionReason] = useState('');

  // Discount & Round-off settings (Canonical Quotation Alignment)
  const [showDiscount, setShowDiscount] = useState(() => {
    if (proforma?.showDiscount !== undefined) return Boolean(proforma.showDiscount);
    if (upstreamQuotation?.showDiscount !== undefined) return Boolean(upstreamQuotation.showDiscount);
    const src = proforma?.items || upstreamQuotation?.items || upstreamOrder?.lineItems;
    if (Array.isArray(src)) {
      return src.some((it) => Number(it.discount !== undefined ? it.discount : (it.discountPercent || 0)) > 0);
    }
    return false;
  });

  const [roundOffEnabled, setRoundOffEnabled] = useState(
    proforma?.roundOffEnabled !== undefined
      ? Boolean(proforma.roundOffEnabled)
      : (upstreamQuotation?.roundOffTotal !== undefined
          ? Boolean(upstreamQuotation.roundOffTotal)
          : (upstreamQuotation?.roundOffEnabled !== undefined
              ? Boolean(upstreamQuotation.roundOffEnabled)
              : true))
  );

  // Upstream document references & provenance
  const [enquiryId, setEnquiryId] = useState(
    proforma?.enquiryId || upstreamQuotation?.enquiryId || upstreamOrder?.enquiryId || ''
  );
  const [quotationId, setQuotationId] = useState(
    proforma?.quotationId || upstreamQuotation?.quotationId || ''
  );
  const [quotationDate, setQuotationDate] = useState(
    proforma?.quotationDate || (upstreamQuotation?.createdAt ? upstreamQuotation.createdAt.slice(0, 10) : '')
  );
  const [orderId, setOrderId] = useState(
    proforma?.orderId || upstreamOrder?.orderId || ''
  );
  const [orderDate, setOrderDate] = useState(
    proforma?.orderDate || (upstreamOrder?.createdAt ? upstreamOrder.createdAt.slice(0, 10) : '')
  );
  const [customerPoNumber, setCustomerPoNumber] = useState(() => {
    const raw = proforma?.customerPoNumber || upstreamOrder?.poNumber || '';
    if (raw && !String(raw).startsWith('INV-') && !String(raw).startsWith('ORD-') && raw !== upstreamOrder?.orderId) {
      return String(raw).trim();
    }
    return '';
  });
  const [customerPoDate, setCustomerPoDate] = useState(
    proforma?.customerPoDate || (upstreamOrder?.poDate || '')
  );
  const [dcNo, setDcNo] = useState(proforma?.dcNo || '');
  const [selectedDcIds, setSelectedDcIds] = useState(() => (proforma?.dcNo ? String(proforma.dcNo).split(',').map((s) => s.trim()).filter(Boolean) : []));
  const [dcDate, setDcDate] = useState(proforma?.dcDate || '');
  const [dispatchThrough, setDispatchThrough] = useState(proforma?.dispatchThrough || '');
  const [dispatchDate, setDispatchDate] = useState(proforma?.dispatchDate || '');
  const [customerSourceRef, setCustomerSourceRef] = useState(
    upstreamQuotation ? 'quotation' : upstreamOrder ? 'order' : (proforma ? 'manual' : null)
  );

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
    lineTotal: 0
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

  // Line items
  const initialItems = useMemo(() => {
    const src = proforma?.items || upstreamQuotation?.items || upstreamOrder?.lineItems;
    if (Array.isArray(src) && src.length > 0) {
      const mapped = src.map((it, idx) => {
        const qty = Number(it.quantity || 1);
        const rate = Number(
          it.unitPrice !== undefined && it.unitPrice !== null && it.unitPrice !== ''
            ? it.unitPrice
            : (it.rate !== undefined && it.rate !== null && it.rate !== ''
                ? it.rate
                : (it.price !== undefined && it.price !== null && it.price !== ''
                    ? it.price
                    : (it.dealerPrice || 0)))
        );
        const disc = Number(it.discount || 0);
        const gst = Number(it.gst !== undefined ? it.gst : 18);
        const rawSub = Math.round(qty * rate * 100) / 100;
        const discAmt = showDiscount && disc > 0 ? Math.round((rawSub * (disc / 100)) * 100) / 100 : 0;
        const taxable = Math.max(0, Math.round((rawSub - discAmt) * 100) / 100);
        const lineTax = Math.round(((taxable * gst) / 100) * 100) / 100;
        const lineTot = Math.round((taxable + lineTax) * 100) / 100;
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
          lineTotal: lineTot
        };
      });
      return ensureTrailingBlankRow(mapped);
    }
    return [createEmptyRow(1)];
  }, [proforma, upstreamQuotation, upstreamOrder, showDiscount]);

  const [items, setItems] = useState(initialItems);
  const [pendingFocusIndex, setPendingFocusIndex] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [stocksError, setStocksError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');

  // Auto-focus handler for newly appended row
  useEffect(() => {
    if (pendingFocusIndex !== null) {
      const targetIdx = pendingFocusIndex;
      setPendingFocusIndex(null);
      const timer = setTimeout(() => {
        const rowEl = document.querySelector(`[data-row-idx="${targetIdx}"]`);
        if (rowEl) {
          const inputEl = rowEl.querySelector('input.sps-direct-input') || rowEl.querySelector('input.sps-trigger-input') || rowEl.querySelector('input');
          if (inputEl) {
            inputEl.focus();
            inputEl.click();
          }
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [pendingFocusIndex]);

  // Fetch stocks products for product dropdown from authoritative Product Master
  useEffect(() => {
    let active = true;
    setLoadingStocks(true);
    setStocksError('');
    apiFetch(apiUrl('/api/stocks'), {
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': user?.id || 'USR-001'
      }
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!active) return;
        if (d && (d.success || Array.isArray(d) || Array.isArray(d.data) || Array.isArray(d.products))) {
          const list = Array.isArray(d)
            ? d
            : (Array.isArray(d.data)
                ? d.data
                : (Array.isArray(d.data?.products) ? d.data.products : (Array.isArray(d.products) ? d.products : [])));
          setProducts(list);
        } else {
          setStocksError(d?.message || 'Unable to load products from Product Master.');
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error('Failed to load stock products:', err);
        setStocksError(err.message || 'Error connecting to Product Master.');
      })
      .finally(() => {
        if (active) setLoadingStocks(false);
      });
    return () => {
      active = false;
    };
  }, [user]);



  // Authoritative date extractor (never invents dates)
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
  const [customerPoList, setCustomerPoList] = useState([]);
  const [dispatchList, setDispatchList] = useState([]);

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
      .catch((err) => console.error('Failed to load quotations for proforma reference:', err));

    apiFetch(apiUrl('/api/orders'), { headers: authHeaders(user) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d) return;
        const list = Array.isArray(d.data) ? d.data : (Array.isArray(d) ? d : []);
        setOrdersList(list);
      })
      .catch((err) => console.error('Failed to load orders for proforma reference:', err));

    apiFetch(apiUrl('/api/orders/delivery-challans'), { headers: authHeaders(user) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d) return;
        const list = Array.isArray(d.data) ? d.data : (Array.isArray(d) ? d : []);
        setDcList(list);
      })
      .catch((err) => console.error('Failed to load delivery challans for proforma reference:', err));

    return () => {
      active = false;
    };
  }, [user]);

  // Derive unique Customer POs and Dispatches from orders & DCs
  // Derive unique Customer POs and Dispatches from orders & DCs
  useEffect(() => {
    const poMap = new Map();

    // From orders
    ordersList.forEach((o) => {
      const po = o.poNumber || o.customerPoNumber;
      if (po && String(po).trim()) {
        const key = String(po).trim();
        if (!poMap.has(key)) {
          poMap.set(key, {
            poNumber: key,
            date: extractDate(o.poDate || o.customerPoDate),
            customer: o.customerName || o.company || '',
            customerId: o.customerId || '',
            company: o.company || o.customerCompany || '',
            source: o.orderId || 'Order'
          });
        }
      }
    });

    // From delivery challans
    dcList.forEach((d) => {
      const po = d.poNumber;
      if (po && String(po).trim()) {
        const key = String(po).trim();
        if (!poMap.has(key)) {
          poMap.set(key, {
            poNumber: key,
            date: extractDate(d.poDate || d.deliveryDate),
            customer: d.customerName || d.company || d.receiverName || '',
            customerId: d.customerId || '',
            company: d.company || d.customerCompany || '',
            source: d.challanId || 'Delivery Challan'
          });
        }
      }
    });

    setCustomerPoList(Array.from(poMap.values()));

    // Dispatches
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
  }, [ordersList, dcList]);

  // Customer-filtered reference lists:
  // When a customer is selected, ONLY relevant records for that customer are displayed.
  // When no customer is selected (or when cancelled/cleared), all records across all customers are displayed.
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

  const filteredCustomerPoList = useMemo(() => {
    if (!selectedCustomerId && !customerName.trim()) return customerPoList;
    const cId = selectedCustomerId;
    const cName = (customerName || '').toLowerCase().trim();
    const cComp = (company || '').toLowerCase().trim();

    return customerPoList.filter((p) => {
      if (cId && p.customerId && p.customerId === cId) return true;
      const pCust = (p.customer || p.customerName || p.company || '').toLowerCase().trim();
      if (cName && (pCust.includes(cName) || cName.includes(pCust))) return true;
      if (cComp && (pCust.includes(cComp) || cComp.includes(pCust))) return true;

      const ordMatch = ordersList.find((o) => (o.poNumber || o.customerPoNumber) === p.poNumber);
      if (ordMatch) {
        if (cId && ordMatch.customerId && ordMatch.customerId === cId) return true;
        const oCust = (ordMatch.customerName || ordMatch.company || '').toLowerCase().trim();
        if (cName && (oCust.includes(cName) || cName.includes(oCust))) return true;
        if (cComp && (oCust.includes(cComp) || cComp.includes(oCust))) return true;
      }
      const dcMatch = dcList.find((d) => d.poNumber === p.poNumber);
      if (dcMatch) {
        if (cId && dcMatch.customerId && dcMatch.customerId === cId) return true;
        const dCust = (dcMatch.customerName || dcMatch.company || dcMatch.receiverName || '').toLowerCase().trim();
        if (cName && (dCust.includes(cName) || cName.includes(dCust))) return true;
        if (cComp && (dCust.includes(cComp) || cComp.includes(dCust))) return true;
      }
      return false;
    });
  }, [customerPoList, ordersList, dcList, selectedCustomerId, customerName, company]);

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
        setQuotationId('');
        setQuotationDate('');
        setOrderId('');
        setOrderDate('');
        setDcNo('');
        setSelectedDcIds([]);
        setDcDate('');
        setCustomerPoNumber('');
        setCustomerPoDate('');
        setDispatchThrough('');
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
        if (sourceToPreserve !== 'dc' && dcNo) {
          const d = dcList.find((item) => (item.challanId || item.id) === dcNo);
          if (d && d.customerId && d.customerId !== id) {
            setDcNo('');
            setDcDate('');
          }
        }
        if (sourceToPreserve !== 'po' && customerPoNumber) {
          const pMatch = customerPoList.find((p) => p.poNumber === customerPoNumber);
          if (pMatch && pMatch.customerId && pMatch.customerId !== id) {
            setCustomerPoNumber('');
            setCustomerPoDate('');
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
      setQuotationId('');
      setQuotationDate('');
      setOrderId('');
      setOrderDate('');
      setDcNo('');
      setSelectedDcIds([]);
      setDcDate('');
      setCustomerPoNumber('');
      setCustomerPoDate('');
      setDispatchThrough('');
      setDispatchDate('');
      setItems([createEmptyRow(1)]);
      setPaymentTerms(companyConfig?.paymentTerms || '100% ADVANCE PAYMENT');
      setDeliveryTerms(companyConfig?.deliveryTerms || 'EX-STOCK / 1-2 WEEKS');
      setValidityNotes(companyConfig?.validityTerms || '15 DAYS FROM INVOICE DATE');
      setRemarks('');
      setShowDiscount(false);
      setError('');
    }
  };

  // Centralized helper to auto-populate customer & shipping details from any linked record
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

  // Reactive selection handlers with auto-date population & cross-referencing
  const handleSelectQuotation = (record) => {
    if (!record) {
      setQuotationId('');
      setQuotationDate('');
      setItems([createEmptyRow(1)]);
      setOrderId('');
      setOrderDate('');
      setDcNo('');
      setDcDate('');
      setCustomerPoNumber('');
      setCustomerPoDate('');
      setDispatchThrough('');
      setDispatchDate('');
      setPaymentTerms(companyConfig?.paymentTerms || '100% ADVANCE PAYMENT');
      setDeliveryTerms(companyConfig?.deliveryTerms || 'EX-STOCK / 1-2 WEEKS');
      setValidityNotes(companyConfig?.validityTerms || '15 DAYS FROM INVOICE DATE');
      setRemarks('');
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
    if (record.enquiryId) setEnquiryId(record.enquiryId);

    // Auto-populate customer & branch details
    populateCustomerFromRecord(record, record.customerId, 'quotation');

    // Auto-populate commercial terms if present in quotation
    if (record.paymentTerms) setPaymentTerms(record.paymentTerms);
    if (record.deliveryTerms) setDeliveryTerms(record.deliveryTerms);
    if (record.validityTerms || record.validityNotes) setValidityNotes(record.validityTerms || record.validityNotes);
    if (record.remarks) setRemarks(record.remarks);

    // Inherit discount and round-off settings
    const qShowDiscount = record.showDiscount !== undefined
      ? Boolean(record.showDiscount)
      : (Array.isArray(record.items) && record.items.some((i) => Number(i.discount !== undefined ? i.discount : (i.discountPercent || 0)) > 0));
    setShowDiscount(qShowDiscount);

    if (record.roundOffTotal !== undefined) {
      setRoundOffEnabled(Boolean(record.roundOffTotal));
    } else if (record.roundOffEnabled !== undefined) {
      setRoundOffEnabled(Boolean(record.roundOffEnabled));
    }

    // Auto-populate linked Order if one exists
    const linkedOrder = ordersList.find((o) => (o.quotationId && (o.quotationId === qId || o.quotationNumber === qId)) || (o.quotationNumber && o.quotationNumber === qId));
    if (linkedOrder) {
      setOrderId(linkedOrder.orderId || linkedOrder.id || '');
      const od = extractDate(linkedOrder.createdAt || linkedOrder.orderDate || linkedOrder.date);
      if (od) setOrderDate(od);
      if (linkedOrder.poNumber || linkedOrder.customerPoNumber) {
        setCustomerPoNumber(linkedOrder.poNumber || linkedOrder.customerPoNumber);
        const pod = extractDate(linkedOrder.poDate || linkedOrder.customerPoDate);
        if (pod) setCustomerPoDate(pod);
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
      setDcNo(linkedDc.challanId || linkedDc.id || '');
      const dcd = extractDate(linkedDc.deliveryDate || linkedDc.createdAt || linkedDc.dcDate);
      if (dcd) setDcDate(dcd);
      if (linkedDc.transitMode || linkedDc.dispatchDetails) {
        setDispatchThrough(linkedDc.transitMode || linkedDc.dispatchDetails);
        if (dcd) setDispatchDate(dcd);
      }
    } else {
      setDcNo('');
      setDcDate('');
    }

    // Inherit items: preserve snapshot rates, discount %, and HSN/SAC
    if (Array.isArray(record.items) && record.items.length > 0) {
      const mapped = record.items.map((it, idx) => {
        const qty = Math.max(1, Number(it.quantity || 1));
        const rate = Number(
          it.unitPrice !== undefined && it.unitPrice !== null && it.unitPrice !== ''
            ? it.unitPrice
            : (it.rate !== undefined && it.rate !== null && it.rate !== ''
                ? it.rate
                : (it.price !== undefined && it.price !== null && it.price !== ''
                    ? it.price
                    : (it.dealerPrice || 0)))
        );
        const disc = Math.max(0, Math.min(100, Number(it.discount !== undefined ? it.discount : (it.discountPercent || 0))));
        const gst = Number(it.gst !== undefined ? it.gst : (it.gstPercent !== undefined ? it.gstPercent : 18));

        const rawSub = Math.round(qty * rate * 100) / 100;
        const discAmt = qShowDiscount && disc > 0 ? Math.round((rawSub * (disc / 100)) * 100) / 100 : 0;
        const taxable = Math.max(0, Math.round((rawSub - discAmt) * 100) / 100);
        const lineTax = Math.round(((taxable * gst) / 100) * 100) / 100;
        const lineTot = Math.round((taxable + lineTax) * 100) / 100;

        return {
          sl: idx + 1,
          productId: it.productId || '',
          productCode: it.productCode || it.sku || '',
          productName: it.productName || it.name || '',
          productDetails: it.productDetails || it.description || '',
          hsnSac: it.hsnSac || it.hsn || it.hsnCode || '85258090',
          quantity: qty,
          unit: (it.unit && it.unit !== 'Piece') ? it.unit : 'Nos',
          unitPrice: rate,
          discount: disc,
          discountAmount: discAmt,
          taxableAmount: taxable,
          lineSubtotal: rawSub,
          gst,
          lineTax,
          lineTotal: lineTot
        };
      });
      setItems(ensureTrailingBlankRow(mapped));
    }
  };

  const handleSelectOrder = (record) => {
    if (!record) {
      setOrderId('');
      setOrderDate('');
      setItems([createEmptyRow(1)]);
      setQuotationId('');
      setQuotationDate('');
      setDcNo('');
      setDcDate('');
      setCustomerPoNumber('');
      setCustomerPoDate('');
      setDispatchThrough('');
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

    if (record.enquiryId) setEnquiryId(record.enquiryId);

    // Auto-populate customer & branch details
    populateCustomerFromRecord(record, record.customerId, 'order');

    // Auto-populate linked Quotation Ref & Date
    const qNum = record.quotationId || record.quotationNumber;
    if (qNum) {
      setQuotationId(qNum);
      const linkedQuote = quotationsList.find((q) => (q.quotationId || q.id) === qNum);
      if (linkedQuote) {
        const qd = extractDate(linkedQuote.createdAt || linkedQuote.date || linkedQuote.quotationDate);
        if (qd) setQuotationDate(qd);
        if (linkedQuote.paymentTerms) setPaymentTerms(linkedQuote.paymentTerms);
        if (linkedQuote.deliveryTerms) setDeliveryTerms(linkedQuote.deliveryTerms);
        if (linkedQuote.validityTerms || linkedQuote.validityNotes) setValidityNotes(linkedQuote.validityTerms || linkedQuote.validityNotes);
        if (linkedQuote.showDiscount !== undefined) setShowDiscount(Boolean(linkedQuote.showDiscount));
      } else if (record.quotationDate) {
        setQuotationDate(extractDate(record.quotationDate));
      }
    } else {
      setQuotationId('');
      setQuotationDate('');
    }

    // Auto-populate Customer PO No & Date
    const poNum = record.poNumber || record.customerPoNumber;
    if (poNum) {
      setCustomerPoNumber(poNum);
      const pod = extractDate(record.poDate || record.customerPoDate);
      if (pod) setCustomerPoDate(pod);
    } else {
      setCustomerPoNumber('');
      setCustomerPoDate('');
    }

    // Auto-populate DC No & DC Date!
    const linkedDc = dcList.find((dc) =>
      (dc.orderId && dc.orderId === oId) ||
      (record.deliveryChallanId && (dc.challanId === record.deliveryChallanId || dc.id === record.deliveryChallanId)) ||
      (record.dcNo && (dc.challanId === record.dcNo || dc.id === record.dcNo))
    );
    if (linkedDc) {
      setDcNo(linkedDc.challanId || linkedDc.id || '');
      const dcd = extractDate(linkedDc.deliveryDate || linkedDc.createdAt || linkedDc.dcDate);
      if (dcd) setDcDate(dcd);
      if (linkedDc.transitMode || linkedDc.dispatchDetails) {
        setDispatchThrough(linkedDc.transitMode || linkedDc.dispatchDetails);
        if (dcd) setDispatchDate(dcd);
      }
    } else if (record.dcNo || record.deliveryChallanId) {
      setDcNo(record.dcNo || record.deliveryChallanId);
      if (record.dcDate) setDcDate(extractDate(record.dcDate));
    } else {
      setDcNo('');
      setDcDate('');
    }

    // Line items: populate from order lineItems or items
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
          lineTotal: lineTot
        };
      });
      setItems(ensureTrailingBlankRow(mapped));
    }
  };

  // Multi-DC Merge Engine for Proforma: Consolidates line items, quantities & references
  const recomputeMergedItems = (targetDcIds) => {
    setSelectedDcIds(targetDcIds);

    if (!Array.isArray(targetDcIds) || targetDcIds.length === 0) {
      setDcNo('');
      setDcDate('');
      setItems([createEmptyRow(1)]);
      return;
    }

    const chosenDcs = targetDcIds
      .map((id) => dcList.find((d) => (d.challanId || d.id) === id))
      .filter(Boolean);

    if (chosenDcs.length === 0) return;

    // Update dcNo: comma-separated list of selected DCs
    const combinedDcNo = chosenDcs.map((d) => d.challanId || d.id).join(', ');
    setDcNo(combinedDcNo);

    // Latest DC Date among selected DCs
    const latestDate = chosenDcs
      .map((d) => extractDate(d.deliveryDate || d.createdAt || d.dcDate))
      .filter(Boolean)
      .sort()
      .reverse()[0] || '';
    if (latestDate) setDcDate(latestDate);

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

    // Auto-populate Customer PO if not set
    const dcWithPo = chosenDcs.find((d) => d.poNumber);
    if (dcWithPo && !customerPoNumber) {
      setCustomerPoNumber(dcWithPo.poNumber);
      if (dcWithPo.poDate) setCustomerPoDate(extractDate(dcWithPo.poDate));
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

        const key = `${prodId || prodCode || prodName}__${rate}`;

        if (mergedMap.has(key)) {
          const existing = mergedMap.get(key);
          existing.quantity += qty;
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
            gst
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
        lineTotal: lineTot
      };
    });

    setItems(ensureTrailingBlankRow(mergedList));
  };

  const handleSelectDc = (record) => {
    if (!record) {
      setDcNo('');
      setDcDate('');
      setSelectedDcIds([]);
      setDispatchThrough('');
      setDispatchDate('');
      setItems([createEmptyRow(1)]);
      setOrderId('');
      setOrderDate('');
      setQuotationId('');
      setQuotationDate('');
      setCustomerPoNumber('');
      setCustomerPoDate('');
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

  const handleSelectCustomerPo = (record) => {
    if (!record) {
      setCustomerPoNumber('');
      setCustomerPoDate('');
      if (customerSourceRef === 'po') {
        clearCustomerData();
        setOrderId('');
        setOrderDate('');
        setDcNo('');
        setDcDate('');
        setQuotationId('');
        setQuotationDate('');
        setItems([createEmptyRow(1)]);
      }
      return;
    }
    setError('');
    const po = record.poNumber || record.id || '';
    setCustomerPoNumber(po);
    const d = extractDate(record.date || record.poDate || record.customerPoDate);
    if (d) setCustomerPoDate(d);

    // Look up linked Order or DC
    const linkedOrder = ordersList.find((o) => (o.poNumber || o.customerPoNumber) === po);
    if (linkedOrder) {
      setOrderId(linkedOrder.orderId || linkedOrder.id || '');
      const od = extractDate(linkedOrder.createdAt || linkedOrder.orderDate || linkedOrder.date);
      if (od) setOrderDate(od);
      if (linkedOrder.quotationId || linkedOrder.quotationNumber) {
        setQuotationId(linkedOrder.quotationId || linkedOrder.quotationNumber);
        if (linkedOrder.quotationDate) setQuotationDate(extractDate(linkedOrder.quotationDate));
      }
      const linkedDc = dcList.find((dc) => (linkedOrder.orderId && dc.orderId === linkedOrder.orderId) || dc.poNumber === po);
      if (linkedDc) {
        setDcNo(linkedDc.challanId || linkedDc.id || '');
        const dcd = extractDate(linkedDc.deliveryDate || linkedDc.createdAt || linkedDc.dcDate);
        if (dcd) setDcDate(dcd);
      }
      populateCustomerFromRecord(linkedOrder, linkedOrder.customerId, 'po');
    } else {
      const linkedDc = dcList.find((dc) => dc.poNumber === po);
      if (linkedDc) {
        setDcNo(linkedDc.challanId || linkedDc.id || '');
        const dcd = extractDate(linkedDc.deliveryDate || linkedDc.createdAt || linkedDc.dcDate);
        if (dcd) setDcDate(dcd);
        if (linkedDc.orderId) {
          setOrderId(linkedDc.orderId);
          const oMatch = ordersList.find((o) => o.orderId === linkedDc.orderId || o.id === linkedDc.orderId);
          if (oMatch) {
            const od = extractDate(oMatch.createdAt || oMatch.orderDate || oMatch.date);
            if (od) setOrderDate(od);
          }
        }
        populateCustomerFromRecord(linkedDc, linkedDc.customerId, 'po');
      }
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

  // Inter-State determination
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

    // Duplicate prevention: check if productId is already added in another row
    const selectedId = prod?.id || prodId;
    const existingIndex = items.findIndex((it, i) => i !== idx && it.productId && it.productId === selectedId);
    if (existingIndex >= 0) {
      setDuplicateWarning(`Product "${prod?.name || prodId}" is already added. Incremented its quantity.`);
      setItems((prev) => {
        const next = [...prev];
        const currentQty = (next[existingIndex].quantity || 1) + 1;
        next[existingIndex] = updateRowCalculations({
          ...next[existingIndex],
          quantity: currentQty
        });
        return next;
      });
      setTimeout(() => setDuplicateWarning(''), 4000);
      return;
    }

    setItems((prev) => {
      const next = [...prev];
      const selectedProduct = prod || products.find((p) => p.id === prodId || p.code === prodId);
      const extractedRate = selectedProduct?.dealerPrice !== undefined && selectedProduct?.dealerPrice !== null
        ? Number(selectedProduct.dealerPrice)
        : (selectedProduct?.price !== undefined && selectedProduct?.price !== null
            ? Number(selectedProduct.price)
            : (selectedProduct?.cost !== undefined && selectedProduct?.cost !== null
                ? Number(selectedProduct.cost)
                : (selectedProduct?.mrp !== undefined && selectedProduct?.mrp !== null
                    ? Number(selectedProduct.mrp)
                    : next[idx].unitPrice)));

      next[idx] = updateRowCalculations({
        ...next[idx],
        productId: selectedProduct?.id || prodId,
        productCode: selectedProduct?.code || selectedProduct?.sku || '',
        productName: selectedProduct?.name || next[idx].productName,
        productDetails: selectedProduct?.productDetails || selectedProduct?.description || next[idx].productDetails,
        hsnSac: selectedProduct?.hsnSac || next[idx].hsnSac || '85258090',
        unit: (selectedProduct?.unit && selectedProduct.unit !== 'Piece') ? selectedProduct.unit : ((next[idx].unit && next[idx].unit !== 'Piece') ? next[idx].unit : 'Nos'),
        unitPrice: extractedRate,
        gst: selectedProduct?.gst !== undefined ? Number(selectedProduct.gst) : next[idx].gst
      });

      const isLastRow = idx === prev.length - 1;
      const result = ensureTrailingBlankRow(next);
      if (isLastRow) {
        setPendingFocusIndex(result.length - 1);
      }
      return result;
    });
  };

  const handleRowChange = (idx, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      const target = { ...next[idx], [field]: value };
      next[idx] = updateRowCalculations(target);
      return next;
    });
  };

  const handleAddRow = () => {
    setItems((prev) => {
      const last = prev[prev.length - 1];
      if (isRowEmpty(last)) {
        setPendingFocusIndex(prev.length - 1);
        return prev;
      }
      const next = [...prev, createEmptyRow(prev.length + 1)];
      setPendingFocusIndex(next.length - 1);
      return next;
    });
  };

  const handleRemoveRow = (idx) => {
    setItems((prev) => {
      const filtered = prev.filter((_, i) => i !== idx);
      return ensureTrailingBlankRow(filtered);
    });
  };

  // Header Calculations
  const subtotal = useMemo(() => {
    return Math.round(items.reduce((sum, it) => sum + (it.lineSubtotal || 0), 0) * 100) / 100;
  }, [items]);

  const totalDiscount = useMemo(() => {
    return showDiscount
      ? Math.round(items.reduce((sum, it) => sum + (it.discountAmount || 0), 0) * 100) / 100
      : 0;
  }, [items, showDiscount]);

  const taxableSubtotal = useMemo(() => {
    return Math.max(0, Math.round((subtotal - totalDiscount) * 100) / 100);
  }, [subtotal, totalDiscount]);

  const gstTotal = useMemo(() => {
    return Math.round(items.reduce((sum, it) => sum + (it.lineTax || 0), 0) * 100) / 100;
  }, [items]);

  const cgst = isInterstate ? 0 : Math.round((gstTotal / 2) * 100) / 100;
  const sgst = isInterstate ? 0 : Math.round((gstTotal - cgst) * 100) / 100;
  const igst = isInterstate ? gstTotal : 0;

  const calculatedTotal = Math.round((taxableSubtotal + gstTotal) * 100) / 100;
  let roundOff = 0;
  let grandTotal = calculatedTotal;

  // Exact Canonical Round-Off Rule:
  // Math.floor(calculatedTotal + 1e-9) + 1 for positive totals when round-off enabled
  if (roundOffEnabled && calculatedTotal > 0) {
    grandTotal = Math.floor(calculatedTotal + 1e-9) + 1;
    roundOff = Math.round((grandTotal - calculatedTotal) * 100) / 100;
  } else {
    grandTotal = calculatedTotal;
    roundOff = 0;
  }

  // Submit Handler
  const handleSave = async (statusTarget = 'DRAFT') => {
    if (!selectedCustomerId && !customerName.trim()) {
      setError('Please select or create a Customer before proceeding.');
      return;
    }

    const validItems = items.filter((it) => it.productName && it.productName.trim().length > 0);

    if (validItems.length === 0) {
      setError('Please provide at least one valid line item with product name and quantity.');
      return;
    }

    if (isRevision && !revisionReason.trim()) {
      setError('Please provide a reason or summary for this revision.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        customerId: selectedCustomerId || undefined,
        customerName: customerName.trim(),
        company: company.trim(),
        contactPerson: contactPerson.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim(),

        consigneeName: consigneeName.trim() || customerName.trim(),
        consigneeAddress: consigneeAddress.trim(),
        consigneeGstin: consigneeGstin.trim(),
        consigneeState: consigneeState.trim(),

        shippingAddress: shippingAddress.trim() || consigneeAddress.trim(),
        shippingGstin: shippingGstin.trim() || consigneeGstin.trim(),
        shippingState: shippingState.trim() || consigneeState.trim(),

        proformaDate,
        validUntil,
        status: statusTarget,

        enquiryId: enquiryId || null,
        quotationId: quotationId || null,
        quotationDate: quotationDate || null,
        orderId: orderId || null,
        orderDate: orderDate || null,
        customerPoNumber: customerPoNumber || null,
        customerPoDate: customerPoDate || null,
        dcNo: selectedDcIds.length > 0 ? selectedDcIds.join(', ') : (dcNo || null),
        dcNos: selectedDcIds.length > 0 ? selectedDcIds : (dcNo ? [dcNo] : []),
        challanId: selectedDcIds.length > 0 ? selectedDcIds.join(', ') : (dcNo || null),
        challanIds: selectedDcIds.length > 0 ? selectedDcIds : (dcNo ? [dcNo] : []),
        dcDate: dcDate || null,
        dispatchThrough: dispatchThrough || null,
        dispatchDate: dispatchDate || null,

        paymentTerms,
        deliveryTerms,
        validityNotes,
        remarks,

        roundOffEnabled: Boolean(roundOffEnabled),
        roundOffAmount: roundOff,
        roundOff,
        showDiscount: Boolean(showDiscount),
        subtotal,
        totalDiscount,
        discountTotal: totalDiscount,
        taxableSubtotal,
        taxableAmount: taxableSubtotal,
        taxTotal: gstTotal,
        gstTotal,
        cgst,
        sgst,
        igst,
        calculatedTotal,
        grandTotal,

        items: validItems
      };

      let res;
      if (isRevision && proforma) {
        // Create new revision
        res = await apiFetch(apiUrl(`/api/orders/proformas/${encodeURIComponent(proforma.proformaId || proforma.id)}/revise`), {
          method: 'POST',
          headers: authHeaders(user),
          body: JSON.stringify({
            ...payload,
            reason: revisionReason.trim()
          })
        });
      } else if (proforma && proforma.status === 'DRAFT') {
        // Edit draft
        res = await apiFetch(apiUrl(`/api/orders/proformas/${encodeURIComponent(proforma.proformaId || proforma.id)}`), {
          method: 'PUT',
          headers: authHeaders(user),
          body: JSON.stringify(payload)
        });
      } else {
        // Create new
        res = await apiFetch(apiUrl('/api/orders/proformas'), {
          method: 'POST',
          headers: authHeaders(user),
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to save proforma invoice.');
      }

      onSuccess && onSuccess(data.data);
      onClose();
    } catch (err) {
      console.error('Error saving proforma invoice:', err);
      setError(err.message || 'Error saving proforma invoice.');
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
          maxWidth: '1060px',
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
            background: '#ffffff'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 className="crm-modal-title" style={{ fontSize: '18px', margin: 0, fontWeight: 700, color: '#1e293b' }}>
                {isRevision
                  ? `Revise Proforma Invoice (${proforma?.proformaId || ''})`
                  : proforma
                    ? `Edit Proforma Invoice (${proforma?.proformaId || ''})`
                    : 'Create Proforma Invoice'}
              </h2>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#4338ca', background: '#e0e7ff', padding: '2px 8px', borderRadius: '4px' }}>
                {isRevision ? `Rev ${(proforma?.revisionNumber || 1) + 1}` : `Rev ${proforma?.revisionNumber || 1}`}
              </span>
            </div>
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

          {/* SECTION 2: REVISION REASON (IF REVISING) */}
          {isRevision && (
            <div style={{ marginBottom: '18px', padding: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#1e40af', marginBottom: '4px' }}>
                Revision Reason / Change Summary *
              </label>
              <input
                type="text"
                className="crm-form-input"
                placeholder="e.g. Revised pricing as per client discussion, added extended warranty"
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                required
                style={{ width: '100%' }}
              />
            </div>
          )}

          {/* SECTION 3: DATES & REFERENCES */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '12px', marginBottom: '18px' }}>
            {/* ROW 1: PROFORMA DATE, VALID UNTIL, QUOTATION REF, ORDER REF */}
            <div>
              <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Proforma Date *</label>
              <input
                type="date"
                className="crm-form-input"
                value={proformaDate}
                onChange={(e) => setProformaDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Valid Until *</label>
              <input
                type="date"
                className="crm-form-input"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                required
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569', margin: 0 }}>Quotation Ref</label>
                {quotationDate && (
                  <span style={{ fontSize: '10px', color: '#4338ca', fontWeight: 600 }} title="Linked Quotation Date">
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

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569', margin: 0 }}>Order Ref</label>
                {orderDate && (
                  <span style={{ fontSize: '10px', color: '#4338ca', fontWeight: 600 }} title="Linked Order Date">
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

            {/* ROW 2: CUSTOMER PO NO, CUSTOMER PO DATE, DC NO, DC DATE */}
            <div>
              <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Customer PO No</label>
              <SearchableReferenceSelect
                value={customerPoNumber}
                onChange={(val) => {
                  setCustomerPoNumber(val);
                  if (!val) handleSelectCustomerPo(null);
                }}
                onSelect={handleSelectCustomerPo}
                records={filteredCustomerPoList}
                getRecordId={(r) => r.poNumber || r.id || ''}
                getRecordTitle={(r) => r.poNumber || ''}
                getRecordSubtitle={(r) => r.customer ? `${r.customer} (${r.source || 'PO'})` : (r.source || '')}
                getRecordDate={(r) => extractDate(r.date || r.poDate)}
                placeholder="PO-XXXX"
              />
            </div>

            <div>
              <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Customer PO Date</label>
              <input
                type="date"
                className="crm-form-input"
                value={customerPoDate}
                onChange={(e) => setCustomerPoDate(e.target.value)}
              />
            </div>

            <div>
              <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>DC No</label>
              <SearchableReferenceSelect
                value={dcNo}
                onChange={(val) => {
                  setDcNo(val);
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
                value={dcDate}
                onChange={(e) => setDcDate(e.target.value)}
              />
            </div>

            {/* ROW 3: DISPATCH THROUGH, DISPATCH DATE */}
            <div style={{ gridColumn: 'span 2' }}>
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
                placeholder="e.g. Surface Courier / Hand Delivery"
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Dispatch Date</label>
              <input
                type="date"
                className="crm-form-input"
                value={dispatchDate}
                onChange={(e) => setDispatchDate(e.target.value)}
              />
            </div>
          </div>

          {/* SECTION 3.5: RELATED DELIVERY CHALLANS (PARTIAL / MULTI-DC MERGE) */}
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

          {/* SECTION 4: LINE ITEMS */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Line Items</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={showDiscount}
                    onChange={(e) => handleToggleShowDiscount(e.target.checked)}
                    style={{ accentColor: '#2563eb', width: '15px', height: '15px', cursor: 'pointer' }}
                  />
                  <span>Show Discount (%)</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={roundOffEnabled}
                    onChange={(e) => setRoundOffEnabled(e.target.checked)}
                    style={{ accentColor: '#2563eb', width: '15px', height: '15px', cursor: 'pointer' }}
                  />
                  <span>Round Off Total</span>
                </label>
              </div>
            </div>

            <div className="invoice-items-table-wrap" style={{ overflow: 'visible', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#ffffff' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed', boxSizing: 'border-box' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '8px 4px', textAlign: 'center', width: '4%' }}>#</th>
                    <th style={{ padding: '8px 6px', textAlign: 'left', width: showDiscount ? '33%' : '38%' }}>Product / Description</th>
                    <th style={{ padding: '8px 4px', textAlign: 'center', width: showDiscount ? '9%' : '10%' }}>HSN/SAC</th>
                    <th style={{ padding: '8px 4px', textAlign: 'center', width: '6%' }}>Qty</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right', width: showDiscount ? '10%' : '11%' }}>Rate (₹)</th>
                    {showDiscount && (
                      <th style={{ padding: '8px 4px', textAlign: 'center', width: '6%' }}>Disc %</th>
                    )}
                    <th style={{ padding: '8px 4px', textAlign: 'center', width: '7%' }}>GST %</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right', width: showDiscount ? '9%' : '10%' }}>Tax (₹)</th>
                    <th style={{ padding: '8px 6px', textAlign: 'right', width: showDiscount ? '12%' : '14%' }}>Total (₹)</th>
                    <th style={{ padding: '8px 4px', textAlign: 'center', width: '4%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid #e2e8f0'
                      }}
                    >
                      <td style={{ padding: '6px 4px', textAlign: 'center', color: '#64748b', verticalAlign: 'top', paddingTop: '11px' }}>{idx + 1}</td>

                      {/* Product Selector / Name */}
                      <td style={{ padding: '6px', verticalAlign: 'top' }}>
                        <div data-row-idx={idx} style={{ width: '100%' }}>
                          <SearchableProductSelect
                            items={products}
                            selectedId={row.productId}
                            selectedName={row.productName}
                            onChange={(id, p) => handleProductSelect(idx, id, p)}
                            placeholder="Select Product ▼"
                            searchPlaceholder="Type to search products..."
                            loading={loadingStocks}
                          />
                          {row.productName && (
                            <input
                              type="text"
                              className="crm-form-input"
                              style={{
                                fontSize: '11px',
                                padding: '2px 6px',
                                width: '100%',
                                color: '#64748b',
                                boxSizing: 'border-box',
                                marginTop: '4px'
                              }}
                              placeholder="Optional description / details..."
                              value={row.productDetails}
                              onChange={(e) => handleRowChange(idx, 'productDetails', e.target.value)}
                            />
                          )}
                        </div>
                      </td>

                      {/* HSN/SAC */}
                      <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                        <input
                          type="text"
                          className="crm-form-input"
                          style={{ fontSize: '11px', textAlign: 'center', padding: '4px 2px', height: '30px', width: '100%', boxSizing: 'border-box', borderRadius: '4px' }}
                          value={row.hsnSac}
                          onChange={(e) => handleRowChange(idx, 'hsnSac', e.target.value)}
                        />
                      </td>

                      {/* Quantity */}
                      <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                        <input
                          type="number"
                          min="1"
                          className="crm-form-input"
                          style={{ fontSize: '12px', textAlign: 'center', fontWeight: 600, padding: '4px 2px', height: '30px', width: '100%', boxSizing: 'border-box', borderRadius: '4px' }}
                          value={row.quantity}
                          onChange={(e) => handleRowChange(idx, 'quantity', e.target.value)}
                        />
                      </td>

                      {/* Rate */}
                      <td style={{ padding: '6px 4px', textAlign: 'right', verticalAlign: 'top' }}>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="crm-form-input"
                          style={{ fontSize: '12px', textAlign: 'right', padding: '4px 4px', height: '30px', width: '100%', boxSizing: 'border-box', borderRadius: '4px' }}
                          value={row.unitPrice}
                          onChange={(e) => handleRowChange(idx, 'unitPrice', e.target.value)}
                        />
                      </td>

                      {/* Discount % if toggled ON */}
                      {showDiscount && (
                        <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            className="crm-form-input"
                            style={{ fontSize: '11px', textAlign: 'center', padding: '4px 2px', height: '30px', width: '100%', boxSizing: 'border-box', borderRadius: '4px' }}
                            value={row.discount}
                            onChange={(e) => handleRowChange(idx, 'discount', e.target.value)}
                          />
                        </td>
                      )}

                      {/* GST % */}
                      <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                        <select
                          className="crm-form-select"
                          style={{
                            fontSize: '11px',
                            textAlign: 'center',
                            padding: '4px 2px',
                            height: '30px',
                            width: '100%',
                            boxSizing: 'border-box',
                            borderRadius: '4px'
                          }}
                          value={row.gst}
                          onChange={(e) => handleRowChange(idx, 'gst', Number(e.target.value))}
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </td>

                      {/* Line Tax */}
                      <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: 'monospace', color: '#475569', fontSize: '11px', verticalAlign: 'top', height: '30px', paddingTop: '11px', boxSizing: 'border-box' }}>
                        ₹ {row.lineTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Line Total */}
                      <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 700, color: '#0f172a', fontSize: '11.5px', verticalAlign: 'top', height: '30px', paddingTop: '11px', boxSizing: 'border-box' }}>
                        ₹ {row.lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Remove Button */}
                      <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top', height: '30px', paddingTop: '9px', boxSizing: 'border-box' }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          disabled={items.length === 1 && isRowEmpty(row)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: items.length === 1 && isRowEmpty(row) ? 'not-allowed' : 'pointer',
                            color: items.length === 1 && isRowEmpty(row) ? '#cbd5e1' : '#ef4444',
                            padding: '2px'
                          }}
                          title={items.length === 1 && isRowEmpty(row) ? 'Cannot remove empty row' : 'Remove Item'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* BLANK RESERVED ROWS (MINIMUM BASELINE ROWS = 5) */}
                  {Array.from({ length: Math.max(0, 5 - items.length) }).map((_, bIdx) => {
                    const rowNum = items.length + bIdx + 1;
                    return (
                      <tr
                        key={`blank-row-${bIdx}`}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          height: '38px',
                          backgroundColor: bIdx % 2 === 1 ? '#fafbfd' : '#ffffff'
                        }}
                        aria-hidden="true"
                      >
                        <td style={{ padding: '6px 4px', textAlign: 'center', color: '#cbd5e1', fontSize: '11px', userSelect: 'none' }}>
                          {rowNum}
                        </td>
                        <td style={{ padding: '6px 6px', color: '#e2e8f0', fontSize: '11px', fontStyle: 'italic', userSelect: 'none' }}>
                          &nbsp;
                        </td>
                        <td style={{ padding: '6px 6px', textAlign: 'center', color: '#e2e8f0', userSelect: 'none' }}>—</td>
                        <td style={{ padding: '6px 4px', textAlign: 'center', color: '#e2e8f0', userSelect: 'none' }}>—</td>
                        <td style={{ padding: '6px 4px', textAlign: 'center', color: '#e2e8f0', userSelect: 'none' }}>—</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', color: '#e2e8f0', userSelect: 'none' }}>—</td>
                        {showDiscount && (
                          <td style={{ padding: '6px 4px', textAlign: 'center', color: '#e2e8f0', userSelect: 'none' }}>—</td>
                        )}
                        <td style={{ padding: '6px 4px', textAlign: 'center', color: '#e2e8f0', userSelect: 'none' }}>—</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', color: '#e2e8f0', userSelect: 'none' }}>—</td>
                        <td style={{ padding: '6px 6px', textAlign: 'right', color: '#e2e8f0', userSelect: 'none' }}>—</td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Add Row Button below Table (Quotation-Style) */}
            <div className="quotation-add-row-bar" style={{ marginTop: '8px', marginBottom: '8px' }}>
              <button
                type="button"
                className="quotation-add-row-btn"
                onClick={handleAddRow}
              >
                <Plus size={14} />
                <span>Add Row</span>
              </button>
            </div>
          </div>

          {/* SECTION 5: COMMERCIAL TERMS & TOTALS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '16px', marginBottom: '16px' }}>
            {/* Left: Terms */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Payment Terms</label>
                <input
                  type="text"
                  className="crm-form-input"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g. 100% Advance along with formal Purchase Order"
                />
              </div>

              <div>
                <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Delivery Terms</label>
                <input
                  type="text"
                  className="crm-form-input"
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                  placeholder="e.g. Immediate ex-stock or within 3-5 business days upon payment"
                />
              </div>

              <div>
                <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Validity Notes</label>
                <input
                  type="text"
                  className="crm-form-input"
                  value={validityNotes}
                  onChange={(e) => setValidityNotes(e.target.value)}
                  placeholder="e.g. Prices and taxes are preliminary and subject to standard company terms"
                />
              </div>

              <div>
                <label className="crm-form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Remarks / Additional Notes</label>
                <textarea
                  className="crm-form-textarea"
                  rows="2"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional internal or client remarks..."
                  style={{ fontSize: '12px' }}
                />
              </div>
            </div>

            {/* Right: Calculations Summary Card */}
            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px', fontSize: '12px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b', marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                Summary & Taxes
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#475569' }}>
                <span>Subtotal (Gross):</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>₹ {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              {showDiscount && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#16a34a' }}>
                    <span>Discount:</span>
                    <strong style={{ color: '#16a34a' }}>- ₹ {totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#475569' }}>
                    <span>Taxable Subtotal:</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>₹ {taxableSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </>
              )}

              {isInterstate ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#475569' }}>
                  <span>Integrated Tax (IGST):</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>₹ {igst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#475569' }}>
                    <span>Central Tax (CGST):</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>₹ {cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#475569' }}>
                    <span>State Tax (SGST):</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>₹ {sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </>
              )}

              {roundOffEnabled && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', margin: '6px 0 4px', padding: '6px 0 0', borderTop: '1px dashed #cbd5e1', color: '#475569' }}>
                    <span>Calculated Total:</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>₹ {calculatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px dashed #cbd5e1', color: '#475569' }}>
                    <span>Round Off:</span>
                    <strong style={{ color: roundOff >= 0 ? '#16a34a' : '#dc2626' }}>
                      {roundOff >= 0 ? '+' : ''}₹ {roundOff.toFixed(2)}
                    </strong>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '8px', borderTop: '2px solid #0f172a', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                <span>Grand Total:</span>
                <span>₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              <div style={{ marginTop: '12px', fontSize: '11px', color: '#0284c7', background: '#f0f9ff', padding: '6px 8px', borderRadius: '4px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Clock size={14} />
                <span>Preliminary quote &bull; Valid until {validUntil}</span>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ffffff',
            flex: '0 0 auto',
            borderBottomLeftRadius: '8px',
            borderBottomRightRadius: '8px',
            boxSizing: 'border-box'
          }}
        >
          <button
            type="button"
            className="quotation-back-btn crm-btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              className="quotation-back-btn crm-btn-secondary"
              onClick={() => handleSave('DRAFT')}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save as Draft'}
            </button>

            <button
              type="button"
              className="quotation-save-btn crm-btn-primary"
              onClick={() => handleSave('SENT')}
              disabled={submitting}
            >
              <Check size={16} />
              <span>{submitting ? 'Processing...' : isRevision ? 'Issue Revision' : 'Save & Issue (Sent)'}</span>
            </button>
          </div>
        </div>
      </div>


    </div>
  );
}
