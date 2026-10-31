import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch, apiUrl } from '../../api';
import { navigate } from '../../router';
import {
  FileText,
  Plus,
  Trash2,
  Calendar,
  CreditCard,
  MapPin,
  Check,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import SearchableProductSelect from '../common/SearchableProductSelect';
import SearchableSupplierSelect from '../common/SearchableSupplierSelect';
import SupplierModal from '../common/SupplierModal';
import ProductCreatePage from '../stocks/ProductCreatePage';
import './purchaseOrders.css';

export default function CreatePurchaseOrder({ user, editPoId = null, onClosed, onSuccess }) {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showProductCreateModal, setShowProductCreateModal] = useState(false);
  const [modalInitialName, setModalInitialName] = useState('');
  const supplierInputRef = useRef(null);

  // PO Form State
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30 Days');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advancePaymentMode, setAdvancePaymentMode] = useState('Bank Transfer');
  const [advancePaymentRef, setAdvancePaymentRef] = useState('');
  const [availableBanks, setAvailableBanks] = useState([
    { id: 'PM-001', code: 'HDFC-01', name: 'HDFC Bank Current Account', bankName: 'HDFC Bank', type: 'Bank', details: 'A/C 50200028741215 - IFSC HDFC0000024', subMethods: 'RTGS, NEFT, IMPS, Cheque', maxLimit: 5000000 },
    { id: 'PM-002', code: 'SBI-01', name: 'State Bank of India (SBI)', bankName: 'State Bank of India (SBI)', type: 'Bank', details: 'A/C 382109485721 - IFSC SBIN0001234', subMethods: 'RTGS, NEFT, IMPS, Cheque', maxLimit: 2500000 },
    { id: 'PM-003', code: 'INDUS-01', name: 'IndusInd Bank Commercial A/C', bankName: 'IndusInd Bank', type: 'Bank', details: 'A/C 201003482910 - IFSC INDB0000542', subMethods: 'RTGS, NEFT, IMPS, Cheque', maxLimit: 2000000 },
    { id: 'PM-004', code: 'UPI-01', name: 'UPI / QR Code (HDFC)', bankName: 'HDFC Bank (UPI)', type: 'Digital', details: 'asi@hdfcbank', subMethods: 'UPI / QR Code', maxLimit: 100000 },
    { id: 'PM-005', code: 'CHEQUE-01', name: 'Cheque / Demand Draft', bankName: 'HDFC Bank', type: 'Offline', details: 'Payable at Chennai in favor of ACTIVE SYSTEM INTEGRATION', subMethods: 'Cheque, DD', maxLimit: 1000000 },
    { id: 'PM-006', code: 'CASH-01', name: 'Cash Counter Desk', bankName: 'Cash Office', type: 'Cash', details: 'Direct cash disbursement at counter', subMethods: 'Cash Voucher', maxLimit: 50000 }
  ]);
  const [selectedBankId, setSelectedBankId] = useState('PM-001');
  const [selectedPaymentRoute, setSelectedPaymentRoute] = useState('RTGS');
  const [immediateAmount, setImmediateAmount] = useState('');
  const [immediatePaymentRef, setImmediatePaymentRef] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState(
    'Plot No. 10A, Perumal Kovil Street, Sivabootham, Vanagaram, Chennai - 600095'
  );
  const [termsAndConditions, setTermsAndConditions] = useState(
    'Standard Purchase Terms: Goods subject to inspection upon receipt. Defective or non-conforming items will be rejected or returned at supplier expense.'
  );
  const [remarks, setRemarks] = useState('');

  // Items table state: initialize with one empty row
  const [items, setItems] = useState([
    {
      id: 1,
      productId: '',
      productCode: '',
      productName: '',
      description: '',
      unit: 'Nos',
      hsnSac: '',
      orderedQty: 1,
      rate: 0,
      gstRate: 18,
      tax: 0,
      lineTotal: 0,
      serialized: false
    }
  ]);

  // Load suppliers and products on mount (and existing PO if in edit mode)
  useEffect(() => {
    let active = true;
    const loadMasters = async () => {
      setLoadingData(true);
      try {
        const fetchPromises = [
          apiFetch(apiUrl('/api/suppliers')),
          apiFetch(apiUrl('/api/stocks'), { headers: { 'x-user-id': 'USR-001' } }),
          apiFetch(apiUrl('/api/settings/company'), { headers: { 'x-user-id': 'USR-001' } }).catch(() => null)
        ];

        if (editPoId) {
          fetchPromises.push(apiFetch(apiUrl(`/api/purchase-orders/${editPoId}`)));
        }

        const responses = await Promise.all(fetchPromises);
        const supRes = responses[0];
        const stockRes = responses[1];
        const settingsRes = responses[2];
        const editRes = editPoId ? responses[3] : null;

        const supData = await supRes.json();
        const stockData = await stockRes.json();
        const settingsData = settingsRes && settingsRes.ok ? await settingsRes.json().catch(() => null) : null;
        const editData = editRes ? await editRes.json() : null;

        if (active && settingsData?.success && Array.isArray(settingsData.data?.paymentMethods)) {
          const activeMethods = settingsData.data.paymentMethods.filter((m) => m.status !== 'Inactive');
          if (activeMethods.length > 0) {
            setAvailableBanks(activeMethods);
            const def = activeMethods.find((m) => m.isDefault) || activeMethods[0];
            setSelectedBankId(def.id);
            const routes = (def.subMethods || (def.type === 'Bank' ? 'RTGS, NEFT, IMPS, Cheque' : 'Direct')).split(',').map((s) => s.trim()).filter(Boolean);
            if (routes.length > 0) setSelectedPaymentRoute(routes[0]);
          }
        }

        if (active) {
          if (supRes.ok && supData.success && Array.isArray(supData.data)) {
            setSuppliers(supData.data);
            if (!editPoId && typeof window !== 'undefined' && window.location.search) {
              const sp = new URLSearchParams(window.location.search);
              const qpSupId = sp.get('supplierId');
              if (qpSupId) {
                const targetSup = supData.data.find((s) => s.id === qpSupId || s.supplierId === qpSupId || s.companyName === qpSupId);
                if (targetSup) {
                  setSelectedSupplierId(targetSup.id);
                  setSelectedSupplier(targetSup);
                }
              }
            }
          }
          if (stockRes.ok && stockData.success && Array.isArray(stockData.data?.products)) {
            setProducts(stockData.data.products);
          }
          if (editData && editData.success && editData.data) {
            const existingPo = editData.data;
            setSelectedSupplierId(existingPo.supplierId || existingPo.supplierSnapshot?.id || '');
            setSelectedSupplier(existingPo.supplierSnapshot || null);
            if (existingPo.orderDate) setOrderDate(existingPo.orderDate);
            if (existingPo.expectedDeliveryDate) setExpectedDeliveryDate(existingPo.expectedDeliveryDate);
            if (existingPo.paymentTerms) setPaymentTerms(existingPo.paymentTerms);
            if (existingPo.advanceAmount != null && existingPo.advanceAmount > 0) {
              setAdvanceAmount(String(existingPo.advanceAmount));
            }
            if (existingPo.advancePaymentMode) setAdvancePaymentMode(existingPo.advancePaymentMode);
            if (existingPo.advancePaymentRef) setAdvancePaymentRef(existingPo.advancePaymentRef);
            if (existingPo.deliveryAddress) setDeliveryAddress(existingPo.deliveryAddress);
            if (existingPo.termsAndConditions) setTermsAndConditions(existingPo.termsAndConditions);
            if (existingPo.remarks) setRemarks(existingPo.remarks);
            if (Array.isArray(existingPo.items) && existingPo.items.length > 0) {
              setItems(existingPo.items.map((it, idx) => ({
                id: idx + 1,
                productId: it.productId,
                productCode: it.productCode,
                productName: it.productName,
                description: it.description || '',
                unit: (it.unit && it.unit !== 'Piece') ? it.unit : 'Nos',
                hsnSac: it.hsnSac || '',
                orderedQty: Number(it.orderedQty || 1),
                rate: Number(it.rate || 0),
                gstRate: Number(it.gstRate || 18),
                tax: Number(it.tax || 0),
                lineTotal: Number(it.lineTotal || 0),
                serialized: Boolean(it.serialized)
              })));
            }
          }
        }
      } catch (err) {
        console.error('Failed to load supplier/product masters or edit PO:', err);
        if (active) setErrorMsg('Failed to load suppliers and products catalogue.');
      } finally {
        if (active) setLoadingData(false);
      }
    };

    loadMasters();
    return () => {
      active = false;
    };
  }, [editPoId]);

  const handleSupplierSelect = (id, supplier) => {
    setSelectedSupplierId(id);
    setSelectedSupplier(supplier);
  };

  const handleSupplierCreated = (newSupplier) => {
    setSuppliers((prev) => [newSupplier, ...prev]);
    setSelectedSupplierId(newSupplier.id);
    setSelectedSupplier(newSupplier);
  };

  // Update item field and recalculate line total
  const updateItemField = (index, field, value) => {
    setItems((prevItems) => {
      const next = [...prevItems];
      const item = { ...next[index], [field]: value };

      if (field === 'orderedQty' || field === 'rate' || field === 'gstRate' || field === 'discountPercent' || field === 'discount' || field === 'discountAmount') {
        const qty = Number(field === 'orderedQty' ? value : item.orderedQty) || 0;
        const rate = Number(field === 'rate' ? value : item.rate) || 0;
        const gstRate = Number(field === 'gstRate' ? value : item.gstRate) || 0;
        const rawSub = qty * rate;
        const discountPct = Number(field === 'discountPercent' || field === 'discount' ? value : (item.discountPercent || item.discount || 0)) || 0;
        const discountAmount = Number(field === 'discountAmount' ? value : ((rawSub * discountPct) / 100)) || 0;
        const sub = Math.max(0, rawSub - discountAmount);
        const tax = (sub * gstRate) / 100;
        item.discountPercent = discountPct;
        item.discountAmount = Number(discountAmount.toFixed(2));
        item.taxableValue = Number(sub.toFixed(2));
        item.tax = Number(tax.toFixed(2));
        item.lineTotal = Number((sub + tax).toFixed(2));
      }

      next[index] = item;
      return next;
    });
  };

  // Select product for row, and automatically append next empty row
  const handleProductSelect = (index, productId, product) => {
    if (!product) {
      setItems((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          productId: '',
          productCode: '',
          productName: '',
          description: '',
          unit: 'Nos',
          hsnSac: '',
          rate: 0,
          gstRate: 18,
          tax: 0,
          lineTotal: 0,
          serialized: false
        };
        return next;
      });
      return;
    }

    // DUPLICATE CHECK: There must be NO duplicate product line in the same PO.
    const existingIndex = items.findIndex((it, i) => i !== index && (it.productId === product.id || it.productCode === product.code));
    if (existingIndex !== -1) {
      // Find existing line, increment quantity, highlight it, and keep current row clean
      const existingItem = items[existingIndex];
      const newQty = (Number(existingItem.orderedQty) || 1) + 1;

      setItems((prevItems) => {
        const next = [...prevItems];
        const updatedItem = { ...next[existingIndex] };
        const rate = Number(updatedItem.rate || 0);
        const gstRate = Number(updatedItem.gstRate !== undefined ? updatedItem.gstRate : 18);
        const sub = newQty * rate;
        const tax = (sub * gstRate) / 100;

        updatedItem.orderedQty = newQty;
        updatedItem.tax = Number(tax.toFixed(2));
        updatedItem.lineTotal = Number((sub + tax).toFixed(2));
        updatedItem._highlight = true;
        next[existingIndex] = updatedItem;

        // Reset current row so it remains an empty input row
        next[index] = {
          ...next[index],
          productId: '',
          productCode: '',
          productName: '',
          description: '',
          unit: 'Nos',
          hsnSac: '',
          orderedQty: 1,
          rate: 0,
          gstRate: 18,
          tax: 0,
          lineTotal: 0,
          serialized: false
        };

        return next;
      });

      setInfoMsg(`"${product.name}" (${product.code}) is already in this PO. Quantity was incremented to ${newQty}.`);
      setTimeout(() => setInfoMsg(''), 4000);

      // Remove highlight after 2s
      setTimeout(() => {
        setItems((prev) => prev.map((it, i) => i === existingIndex ? { ...it, _highlight: false } : it));
      }, 2000);

      return;
    }

    setItems((prevItems) => {
      const next = [...prevItems];
      const qty = Number(next[index].orderedQty) || 1;
      const rate = Number(product.cost || product.highestPurchasePrice || product.purchasePrice || product.dealerPrice || 0);
      const gstRate = Number(product.gst !== undefined ? product.gst : 18);
      const sub = qty * rate;
      const tax = (sub * gstRate) / 100;

      next[index] = {
        ...next[index],
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        description: product.description || next[index].description || '',
        brand: product.brand || product.brandName || '',
        brandName: product.brand || product.brandName || '',
        unit: (product.unit && product.unit !== 'Piece') ? product.unit : 'Nos',
        hsnSac: product.hsnSac || product.hsn || product.hsnCode || '',
        rate: rate,
        gstRate: gstRate,
        tax: Number(tax.toFixed(2)),
        lineTotal: Number((sub + tax).toFixed(2)),
        serialized: Boolean(product.serialized || (Array.isArray(product.serialNumbers) && product.serialNumbers.length > 0))
      };

      // AUTOMATIC NEXT ROW: If this is the last row, append a new empty row!
      if (index === next.length - 1) {
        next.push({
          id: Date.now() + Math.random(),
          productId: '',
          productCode: '',
          productName: '',
          description: '',
          unit: 'Nos',
          hsnSac: '',
          orderedQty: 1,
          rate: 0,
          gstRate: 18,
          tax: 0,
          lineTotal: 0,
          serialized: false
        });
      }

      return next;
    });
  };

  const removeItem = (index) => {
    if (items.length <= 1) {
      // Keep at least one row
      setItems([
        {
          id: Date.now(),
          productId: '',
          productCode: '',
          productName: '',
          description: '',
          unit: 'Nos',
          hsnSac: '',
          orderedQty: 1,
          rate: 0,
          gstRate: 18,
          tax: 0,
          lineTotal: 0,
          serialized: false
        }
      ]);
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addManualRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        productId: '',
        productCode: '',
        productName: '',
        description: '',
        unit: 'Nos',
        hsnSac: '',
        orderedQty: 1,
        rate: 0,
        gstRate: 18,
        tax: 0,
        lineTotal: 0,
        serialized: false
      }
    ]);
  };

  // Determine Intra-State (Tamil Nadu) vs Inter-State (outside TN)
  const isIntraState = useMemo(() => {
    if (!selectedSupplier) return true;
    const state = String(selectedSupplier.state || '').trim().toLowerCase();
    if (state) {
      return state === 'tamil nadu' || state === 'tamilnadu' || state === 'tn';
    }
    const gstin = String(selectedSupplier.gstin || '').trim();
    if (gstin.length >= 2 && /^\d{2}/.test(gstin)) {
      return gstin.substring(0, 2) === '33';
    }
    const city = String(selectedSupplier.city || '').trim().toLowerCase();
    const tnCities = [
      'chennai', 'coimbatore', 'madurai', 'trichy', 'tiruchirappalli',
      'salem', 'tirunelveli', 'erode', 'vellore', 'thoothukudi',
      'dindigul', 'thanjavur', 'ranipet', 'sivakasi', 'karur',
      'ooty', 'hosur', 'kanchipuram'
    ];
    if (city && tnCities.includes(city)) return true;
    if (city) {
      const otherCities = ['delhi', 'new delhi', 'mumbai', 'bengaluru', 'bangalore', 'hyderabad', 'kolkata', 'pune', 'ahmedabad', 'jaipur', 'noida', 'gurugram', 'gurgaon'];
      if (otherCities.includes(city)) return false;
    }
    return true;
  }, [selectedSupplier]);

  // Calculations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;

    items.forEach((it) => {
      if (!it.productId) return;
      const qty = Number(it.orderedQty || 0);
      const rate = Number(it.rate || 0);
      const rawSub = qty * rate;
      const discountPct = Number(it.discountPercent || it.discountPct || it.discount || 0);
      const discountAmount = Number(it.discountAmount !== undefined ? it.discountAmount : ((rawSub * discountPct) / 100));
      const sub = Math.max(0, rawSub - discountAmount);
      const tax = (sub * Number(it.gstRate || 0)) / 100;
      subtotal += sub;
      taxTotal += tax;
    });

    const computedGrandTotal = subtotal + taxTotal;
    const finalGrandTotal = Math.round(computedGrandTotal);
    const roundOff = Number((finalGrandTotal - computedGrandTotal).toFixed(2));
    const cgst = isIntraState ? Number((taxTotal / 2).toFixed(2)) : 0;
    const sgst = isIntraState ? Number((taxTotal / 2).toFixed(2)) : 0;
    const igst = isIntraState ? 0 : Number(taxTotal.toFixed(2));

    return {
      subtotal: Number(subtotal.toFixed(2)),
      taxTotal: Number(taxTotal.toFixed(2)),
      cgst,
      sgst,
      igst,
      isIntraState,
      roundOff,
      grandTotal: finalGrandTotal
    };
  }, [items, isIntraState]);

  const currentBank = useMemo(() => {
    return availableBanks.find((b) => b.id === selectedBankId) || availableBanks[0] || null;
  }, [availableBanks, selectedBankId]);

  const currentBankRoutes = useMemo(() => {
    if (!currentBank) return ['RTGS', 'NEFT', 'IMPS'];
    const raw = currentBank.subMethods || (currentBank.type === 'Bank' ? 'RTGS, NEFT, IMPS, Cheque' : (currentBank.type === 'Digital' ? 'UPI / QR Code' : 'Voucher'));
    const parsed = raw.split(',').map((s) => s.trim()).filter(Boolean);
    return parsed.length > 0 ? parsed : ['RTGS', 'NEFT', 'IMPS'];
  }, [currentBank]);

  const handleSubmit = async (submitStatus) => {
    setErrorMsg('');

    if (!selectedSupplierId) {
      setErrorMsg('Please select a supplier for this Purchase Order.');
      return;
    }

    const validItems = items.filter((it) => it.productId && Number(it.orderedQty) > 0);
    if (validItems.length === 0) {
      setErrorMsg('Please add at least one product with a quantity greater than 0.');
      return;
    }

    const isAdvanceTerm = /advance/i.test(paymentTerms);
    const isImmediateTerm = /immediate/i.test(paymentTerms);
    const numAdvance = isAdvanceTerm ? Number(advanceAmount || 0) : 0;
    const numImmediate = isImmediateTerm ? Number(immediateAmount !== '' ? immediateAmount : calculations.grandTotal) : 0;

    if (isAdvanceTerm && numAdvance < 0) {
      setErrorMsg('Advance amount cannot be negative.');
      return;
    }
    if (isAdvanceTerm && numAdvance > calculations.grandTotal) {
      setErrorMsg(`Advance amount (₹${numAdvance.toLocaleString('en-IN')}) cannot exceed Grand Total (₹${calculations.grandTotal.toLocaleString('en-IN')}).`);
      return;
    }
    if (isImmediateTerm && numImmediate < 0) {
      setErrorMsg('Immediate payment amount cannot be negative.');
      return;
    }
    if (isImmediateTerm && numImmediate > calculations.grandTotal) {
      setErrorMsg(`Immediate payment amount (₹${numImmediate.toLocaleString('en-IN')}) cannot exceed Grand Total (₹${calculations.grandTotal.toLocaleString('en-IN')}).`);
      return;
    }

    const bankName = currentBank?.bankName || currentBank?.name || 'HDFC Bank';
    const route = selectedPaymentRoute || 'RTGS';
    const fullMethodName = `${bankName} - ${route}`;

    setSaving(true);
    try {
      const payload = {
        supplierId: selectedSupplierId,
        orderDate,
        expectedDeliveryDate,
        status: submitStatus, // 'DRAFT' or 'SENT'
        items: validItems.map((it) => ({
          productId: it.productId,
          productCode: it.productCode,
          productName: it.productName,
          description: (it.description || '').trim(),
          unit: it.unit,
          hsnSac: it.hsnSac,
          orderedQty: Number(it.orderedQty),
          rate: Number(it.rate),
          gstRate: Number(it.gstRate),
          tax: Number(it.tax),
          lineTotal: Number(it.lineTotal),
          serialized: it.serialized
        })),
        paymentTerms,
        payingBank: bankName,
        paymentMethod: fullMethodName,
        paymentRef: isImmediateTerm ? immediatePaymentRef.trim() : (isAdvanceTerm ? advancePaymentRef.trim() : null),
        immediateAmount: isImmediateTerm ? numImmediate : 0,
        advanceAmount: isImmediateTerm ? numImmediate : (isAdvanceTerm ? numAdvance : 0),
        advancePaymentMode: isImmediateTerm ? fullMethodName : (isAdvanceTerm ? `${bankName} - ${advancePaymentMode}` : null),
        advancePaymentRef: isImmediateTerm ? immediatePaymentRef.trim() : (isAdvanceTerm ? advancePaymentRef.trim() : null),
        totalPaid: isImmediateTerm ? numImmediate : (isAdvanceTerm ? numAdvance : 0),
        balanceAmount: isImmediateTerm
          ? Math.max(0, calculations.grandTotal - numImmediate)
          : (isAdvanceTerm ? Math.max(0, calculations.grandTotal - numAdvance) : calculations.grandTotal),
        deliveryAddress,
        termsAndConditions,
        remarks,
        subtotal: calculations.subtotal,
        cgst: calculations.cgst,
        sgst: calculations.sgst,
        igst: calculations.igst,
        isIntraState: calculations.isIntraState,
        roundOff: calculations.roundOff,
        grandTotal: calculations.grandTotal
      };

      const method = editPoId ? 'PUT' : 'POST';
      const endpoint = editPoId ? apiUrl(`/api/purchase-orders/${editPoId}`) : apiUrl('/api/purchase-orders');

      const res = await apiFetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || 'USR-001'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && data.success && data.data) {
        const savedId = data.data.id || editPoId;
        if (editPoId && submitStatus === 'SENT') {
          await apiFetch(apiUrl(`/api/purchase-orders/${savedId}/status`), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'SENT' })
          });
        }
        if (onSuccess) onSuccess(savedId);
        else navigate(editPoId ? `/purchase-orders/${savedId}` : `/purchase-orders/${savedId}/receive`);
      } else {
        setErrorMsg(data.message || (editPoId ? 'Failed to update Purchase Order.' : 'Failed to create Purchase Order.'));
      }
    } catch (err) {
      console.error('Error saving purchase order:', err);
      setErrorMsg(err.message || 'Network error communicating with server.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="po-container purchase-order-page">
      {/* Header */}
      <div className="po-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            className="crm-btn-secondary"
            style={{ padding: '6px 12px' }}
            onClick={() => (onClosed ? onClosed() : navigate(editPoId ? `/purchase-orders/${editPoId}` : '/purchase-orders'))}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <h1 style={{ margin: 0 }}>{editPoId ? `Edit Purchase Order (${editPoId})` : 'Create Purchase Order'}</h1>
        </div>
      </div>

      {errorMsg && (
        <div
          className="crm-alert crm-alert-danger"
          style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Supplier & Order Details Card */}
      <div className="po-editor-card">
        <div className="po-section-title">
          <FileText size={18} /> 1. Order &amp; Supplier Information
        </div>

        <div className="po-form-grid-supplier-row">
          <div className="po-form-group po-form-group-supplier">
            <div className="po-label-row">
              <label>Supplier / Vendor *</label>
              <button
                type="button"
                className="po-add-supplier-btn"
                onClick={() => {
                  setModalInitialName('');
                  setShowSupplierModal(true);
                }}
              >
                <Plus size={13} /> Add New Supplier
              </button>
            </div>
            <SearchableSupplierSelect
              ref={supplierInputRef}
              autoFocus={true}
              suppliers={suppliers}
              selectedSupplierId={selectedSupplierId}
              onSelectSupplier={handleSupplierSelect}
              placeholder="Search supplier by company, contact, phone, GSTIN..."
            />
            {selectedSupplier && (
              <div className="po-selected-supplier-card">
                <div className="po-selected-supplier-header">
                  <strong>{selectedSupplier.companyName}</strong>
                </div>
                <div className="po-selected-supplier-meta">
                  {selectedSupplier.contactPerson && <span>Attn: {selectedSupplier.contactPerson}</span>}
                  {selectedSupplier.phone && <span>Ph: {selectedSupplier.phone}</span>}
                  {selectedSupplier.email && <span>{selectedSupplier.email}</span>}
                  {selectedSupplier.gstin && <span>GSTIN: {selectedSupplier.gstin}</span>}
                  {selectedSupplier.address && <span>{selectedSupplier.address}</span>}
                  {selectedSupplier.city && <span>{selectedSupplier.city}</span>}
                  {selectedSupplier.pincode && <span>PIN: {selectedSupplier.pincode}</span>}
                </div>
              </div>
            )}
          </div>

          <div className="po-form-group">
            <label>Order Date *</label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              required
            />
          </div>

          <div className="po-form-group">
            <label>Expected Delivery Date</label>
            <input
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
            />
          </div>
        </div>

        <div className="po-form-grid-3">
          <div className="po-form-group">
            <label>Payment Terms</label>
            <select
              value={paymentTerms}
              onChange={(e) => {
                const val = e.target.value;
                setPaymentTerms(val);
                if (/immediate/i.test(val)) {
                  setImmediateAmount(calculations.grandTotal > 0 ? String(calculations.grandTotal) : '');
                } else if (/100%\s*advance/i.test(val)) {
                  setAdvanceAmount(calculations.grandTotal > 0 ? String(calculations.grandTotal) : '');
                } else if (/50%/i.test(val)) {
                  setAdvanceAmount(calculations.grandTotal > 0 ? String(Math.round(calculations.grandTotal * 0.5)) : '');
                } else if (!/advance/i.test(val)) {
                  setAdvanceAmount('');
                }
              }}
            >
              <option value="Immediate Payment">Immediate Payment</option>
              <option value="Net 15 Days">Net 15 Days</option>
              <option value="Net 30 Days">Net 30 Days</option>
              <option value="Net 45 Days">Net 45 Days</option>
              <option value="Advance 50% + Balance on Delivery">Advance 50% + Balance on Delivery</option>
              <option value="100% Advance">100% Advance</option>
              <option value="Custom Advance + Balance on Delivery">Custom Advance + Balance on Delivery</option>
            </select>
          </div>

          <div className="po-form-group" style={{ gridColumn: 'span 2' }}>
            <label>Delivery / Shipping Address</label>
            <input
              type="text"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
            />
          </div>
        </div>

        {/immediate/i.test(paymentTerms) && (
          <div
            className="po-immediate-payment-box"
            style={{
              marginTop: '14px',
              padding: '16px 18px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1.5px solid #3b82f6',
              boxShadow: '0 2px 6px rgba(59,130,246,0.06)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e3a8a' }}>
                  ⚡ Immediate Payment Settlement (Outflow Execution)
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: '#dbeafe', color: '#1d4ed8' }}>
                  Immediate Terms Active
                </span>
              </div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Paying Via: <strong style={{ color: '#0f172a' }}>{currentBank?.bankName || currentBank?.name}</strong>
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', alignItems: 'flex-start' }}>
              <div className="po-form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Paying Bank Account *</label>
                <select
                  value={selectedBankId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedBankId(nextId);
                    const b = availableBanks.find((x) => x.id === nextId);
                    const routes = (b?.subMethods || (b?.type === 'Bank' ? 'RTGS, NEFT, IMPS, Cheque' : 'Direct')).split(',').map((s) => s.trim()).filter(Boolean);
                    if (routes.length > 0) setSelectedPaymentRoute(routes[0]);
                  }}
                  style={{ fontWeight: 600, fontSize: '12.5px' }}
                >
                  {availableBanks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.accountNumber ? `(A/C: ...${b.accountNumber.slice(-4)})` : ''} {b.maxLimit ? `[Limit: ₹${Number(b.maxLimit).toLocaleString('en-IN')}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="po-form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Payment Method / Route *</label>
                <select
                  value={selectedPaymentRoute}
                  onChange={(e) => setSelectedPaymentRoute(e.target.value)}
                  style={{ fontWeight: 600, fontSize: '12.5px' }}
                >
                  {currentBankRoutes.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="po-form-group" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Payment Amount (₹) *</label>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Max: ₹{calculations.grandTotal.toLocaleString('en-IN')}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  max={calculations.grandTotal || undefined}
                  value={immediateAmount !== '' ? immediateAmount : (calculations.grandTotal > 0 ? String(calculations.grandTotal) : '')}
                  onChange={(e) => setImmediateAmount(e.target.value)}
                  placeholder={`₹${calculations.grandTotal}`}
                  style={{
                    fontWeight: 700,
                    fontSize: '13.5px',
                    fontFamily: 'monospace',
                    borderColor: (Number(immediateAmount) > calculations.grandTotal || (currentBank?.maxLimit && Number(immediateAmount || calculations.grandTotal) > currentBank.maxLimit)) ? '#ef4444' : undefined
                  }}
                />
              </div>

              <div className="po-form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Transaction / UTR Reference</label>
                <input
                  type="text"
                  value={immediatePaymentRef}
                  onChange={(e) => setImmediatePaymentRef(e.target.value)}
                  placeholder="e.g. UTR1029384756 or Cheque #501"
                />
              </div>
            </div>

            {Number(immediateAmount) > calculations.grandTotal && (
              <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '12px', fontWeight: 600 }}>
                ⚠️ Payment amount (₹{Number(immediateAmount).toLocaleString('en-IN')}) cannot exceed the PO Grand Total (₹{calculations.grandTotal.toLocaleString('en-IN')}).
              </div>
            )}

            {currentBank?.maxLimit && Number(immediateAmount || calculations.grandTotal) > currentBank.maxLimit && (
              <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '6px', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: '12px', fontWeight: 500 }}>
                ⚠️ <strong>Transaction Cap Warning:</strong> Selected channel ({currentBank.name}) has a limit of ₹{Number(currentBank.maxLimit).toLocaleString('en-IN')}. For amounts above ₹1 Lakh, please select RTGS or NEFT via corporate bank account.
              </div>
            )}

            <div style={{
              marginTop: '12px',
              padding: '10px 14px',
              borderRadius: '6px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              fontSize: '12px'
            }}>
              <div>
                <span style={{ color: '#64748b' }}>Account: </span>
                <strong style={{ color: '#0f172a' }}>{currentBank?.details || currentBank?.name}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Immediate Outflow: </span>
                  <strong style={{ color: '#16a34a', fontSize: '13px' }}>
                    ₹{(Number(immediateAmount !== '' ? immediateAmount : calculations.grandTotal) || 0).toLocaleString('en-IN')}
                  </strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Balance Remaining: </span>
                  <strong style={{ color: '#1e3a8a' }}>
                    ₹{Math.max(0, calculations.grandTotal - (Number(immediateAmount !== '' ? immediateAmount : calculations.grandTotal) || 0)).toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/advance/i.test(paymentTerms) && (
          <div
            className="po-advance-payment-box"
            style={{
              marginTop: '12px',
              padding: '16px 18px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                  💵 Advance Payment Details
                </span>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', background: '#dbeafe', color: '#1d4ed8' }}>
                  Advance Terms Active
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setAdvanceAmount(calculations.grandTotal > 0 ? String(Math.round(calculations.grandTotal * 0.25)) : '')}
                  style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  25% (₹{Math.round(calculations.grandTotal * 0.25).toLocaleString('en-IN')})
                </button>
                <button
                  type="button"
                  onClick={() => setAdvanceAmount(calculations.grandTotal > 0 ? String(Math.round(calculations.grandTotal * 0.5)) : '')}
                  style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  50% (₹{Math.round(calculations.grandTotal * 0.5).toLocaleString('en-IN')})
                </button>
                <button
                  type="button"
                  onClick={() => setAdvanceAmount(calculations.grandTotal > 0 ? String(calculations.grandTotal) : '')}
                  style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  100% (₹{calculations.grandTotal.toLocaleString('en-IN')})
                </button>
                {advanceAmount && (
                  <button
                    type="button"
                    onClick={() => setAdvanceAmount('')}
                    style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid #fca5a5', background: '#fee2e2', color: '#991b1b', cursor: 'pointer' }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', alignItems: 'flex-start' }}>
              <div className="po-form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Advance Amount to Pay (₹) *</label>
                <input
                  type="number"
                  min="0"
                  max={calculations.grandTotal || undefined}
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  placeholder="e.g. 2100 or 25000"
                  style={{ fontWeight: 700, fontSize: '13.5px', fontFamily: 'monospace' }}
                />
              </div>

              <div className="po-form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Payment Mode</label>
                <select
                  value={advancePaymentMode}
                  onChange={(e) => setAdvancePaymentMode(e.target.value)}
                >
                  <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="Pending">Payment Pending</option>
                </select>
              </div>

              <div className="po-form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Transaction / UTR Reference</label>
                <input
                  type="text"
                  value={advancePaymentRef}
                  onChange={(e) => setAdvancePaymentRef(e.target.value)}
                  placeholder="e.g. UTR123456789 or Cheque #104"
                />
              </div>

              <div style={{
                padding: '10px 14px',
                borderRadius: '6px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '4px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                  <span>PO Grand Total:</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>₹{calculations.grandTotal.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                  <span>Advance Deducted:</span>
                  <span style={{ fontWeight: 700, color: '#16a34a' }}>- ₹{(Number(advanceAmount) || 0).toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: 700, borderTop: '1px dashed #cbd5e1', paddingTop: '4px', marginTop: '2px', color: '#1e3a8a' }}>
                  <span>Balance Due on Delivery:</span>
                  <span>₹{Math.max(0, calculations.grandTotal - (Number(advanceAmount) || 0)).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Items Table Card */}
      <div className="po-editor-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div className="po-section-title" style={{ margin: 0, border: 'none' }}>
            2. Line Items
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="crm-btn-secondary"
              onClick={() => setShowProductCreateModal(true)}
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              <Plus size={14} /> Create Product
            </button>
            <button
              type="button"
              className="crm-btn-secondary"
              onClick={addManualRow}
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              <Plus size={14} /> Add Row
            </button>
          </div>
        </div>

        {infoMsg && (
          <div
            className="crm-alert crm-alert-info"
            style={{
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '13px'
            }}
          >
            <AlertCircle size={16} />
            <span>{infoMsg}</span>
          </div>
        )}

        <div className="po-grid-table-wrap">
          <table className="po-items-table">
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '28%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '4%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ textAlign: 'center' }}>#</th>
                <th style={{ textAlign: 'left' }}>PRODUCT / DESCRIPTION</th>
                <th style={{ textAlign: 'center' }}>HSN/SAC</th>
                <th style={{ textAlign: 'center' }}>UNIT</th>
                <th style={{ textAlign: 'center' }}>QTY</th>
                <th style={{ textAlign: 'right' }} title="Purchase Rate per Product / Unit (₹)">
                  RATE (₹)
                  <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 600, color: '#64748b', textTransform: 'none', letterSpacing: 'normal' }}>
                    (per product)
                  </span>
                </th>
                <th style={{ textAlign: 'center' }}>GST %</th>
                <th style={{ textAlign: 'right' }}>TAX (₹)</th>
                <th style={{ textAlign: 'right' }}>TOTAL (₹)</th>
                <th style={{ textAlign: 'center' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id || idx} className={`po-item-row ${item._highlight ? 'is-highlighted' : ''}`}>
                  <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600, fontSize: '12.5px' }}>{idx + 1}</td>
                  <td style={{ verticalAlign: 'top' }}>
                    <SearchableProductSelect
                      items={products}
                      selectedId={item.productId}
                      selectedName={item.productName}
                      onChange={(id, prod) => handleProductSelect(idx, id, prod)}
                      placeholder="Type or select product..."
                    />
                    <textarea
                      className="po-table-input po-item-desc-input"
                      rows={2}
                      value={item.description || ''}
                      onChange={(e) => updateItemField(idx, 'description', e.target.value)}
                      placeholder="Product description / specifications (optional)..."
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="po-table-input"
                      style={{ textAlign: 'center', fontFamily: 'monospace' }}
                      value={item.hsnSac || ''}
                      onChange={(e) => updateItemField(idx, 'hsnSac', e.target.value)}
                      placeholder="HSN/SAC"
                    />
                  </td>
                  <td>
                    <select
                      className="po-table-input"
                      style={{ textAlign: 'center', cursor: 'pointer' }}
                      value={['Nos', 'Box', 'Set', 'Meter', 'Roll'].includes(item.unit) ? item.unit : 'Nos'}
                      onChange={(e) => updateItemField(idx, 'unit', e.target.value)}
                    >
                      <option value="Nos">Nos</option>
                      <option value="Box">Box</option>
                      <option value="Set">Set</option>
                      <option value="Meter">Meter</option>
                      <option value="Roll">Roll</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      className="po-table-input"
                      style={{ textAlign: 'center', fontWeight: 600 }}
                      value={item.orderedQty}
                      onChange={(e) => updateItemField(idx, 'orderedQty', parseInt(e.target.value, 10) || 1)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="po-table-input"
                      style={{ textAlign: 'right', fontFamily: 'monospace' }}
                      value={item.rate || 0}
                      onChange={(e) => updateItemField(idx, 'rate', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      title="Purchase rate per product (₹)"
                    />
                  </td>
                  <td>
                    <select
                      className="po-table-input"
                      style={{ textAlign: 'center', cursor: 'pointer' }}
                      value={item.gstRate !== undefined ? item.gstRate : 18}
                      onChange={(e) => updateItemField(idx, 'gstRate', parseFloat(e.target.value) || 0)}
                    >
                      <option value={0}>0%</option>
                      <option value={5}>5%</option>
                      <option value={12}>12%</option>
                      <option value={18}>18%</option>
                      <option value={28}>28%</option>
                    </select>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '13px', color: '#475569' }}>
                    {Number(item.tax || 0).toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
                    {Number(item.lineTotal || 0).toFixed(2)}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="crm-btn-icon-danger"
                      onClick={() => removeItem(idx)}
                      title="Delete Row"
                      style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary Box */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <div style={{ width: '320px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#475569' }}>
              <span>Subtotal (Taxable):</span>
              <span style={{ fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>
                ₹{Number(calculations.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {calculations.isIntraState ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#475569' }}>
                  <span>CGST (Intra-State):</span>
                  <span style={{ fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>
                    ₹{Number(calculations.cgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#475569' }}>
                  <span>SGST (Intra-State):</span>
                  <span style={{ fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>
                    ₹{Number(calculations.sgst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: '#475569' }}>
                <span>IGST (Inter-State):</span>
                <span style={{ fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>
                  ₹{Number(calculations.igst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {calculations.roundOff !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', color: '#64748b' }}>
                <span>Round Off:</span>
                <span style={{ fontFamily: 'monospace' }}>
                  ₹{calculations.roundOff > 0 ? `+${calculations.roundOff}` : calculations.roundOff}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: '2px solid #e2e8f0', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
              <span>Grand Total:</span>
              <span style={{ color: '#0f172a', fontFamily: 'monospace' }}>
                ₹{Math.round(calculations.grandTotal || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Terms & Remarks Card */}
      <div className="po-editor-card">
        <div className="po-section-title">3. Terms, Conditions &amp; Remarks</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="po-form-group">
            <label>Terms &amp; Conditions</label>
            <textarea
              rows={3}
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
            />
          </div>
          <div className="po-form-group">
            <label>Remarks / Internal Notes</label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Internal instructions or delivery references..."
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="po-form-actions">
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={() => (onClosed ? onClosed() : navigate('/purchase-orders'))}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={() => handleSubmit('DRAFT')}
            disabled={saving}
          >
            {saving ? 'Saving...' : (editPoId ? 'Update Draft' : 'Save as Draft')}
          </button>
          <button
            type="button"
            className="crm-btn-primary"
            onClick={() => handleSubmit('SENT')}
            disabled={saving}
          >
            <Check size={16} /> {saving ? 'Submitting...' : (editPoId ? 'Update & Send PO' : 'Send Items to Supplier')}
          </button>
        </div>
      </div>

      <SupplierModal
        isOpen={showSupplierModal}
        onClose={() => {
          setShowSupplierModal(false);
          setTimeout(() => supplierInputRef.current?.focus(), 60);
        }}
        onSupplierCreated={(newSupplier) => {
          handleSupplierCreated(newSupplier);
          setShowSupplierModal(false);
          setTimeout(() => supplierInputRef.current?.focus(), 60);
        }}
        existingSuppliers={suppliers}
        initialCompanyName={modalInitialName}
      />

      {showProductCreateModal && createPortal(
        <div
          className="crm-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowProductCreateModal(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '920px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
              padding: '24px',
              position: 'relative'
            }}
          >
            <ProductCreatePage
              user={user}
              onCancel={() => setShowProductCreateModal(false)}
              onSuccess={async () => {
                setShowProductCreateModal(false);
                try {
                  const stockRes = await apiFetch(apiUrl('/api/stocks'), { headers: { 'x-user-id': user?.id || 'USR-001' } });
                  const stockData = await stockRes.json();
                  if (stockRes.ok && stockData.success && Array.isArray(stockData.data?.products)) {
                    const updatedProducts = stockData.data.products;
                    setProducts(updatedProducts);
                    const existingIds = new Set(products.map((p) => p.id));
                    const newProd = updatedProducts.find((p) => !existingIds.has(p.id)) || updatedProducts[updatedProducts.length - 1];
                    if (newProd) {
                      const emptyIdx = items.findIndex((it) => !it.productId);
                      if (emptyIdx !== -1) {
                        handleProductSelect(emptyIdx, newProd.id, newProd);
                      } else {
                        const targetIdx = items.length;
                        addManualRow();
                        setTimeout(() => {
                          handleProductSelect(targetIdx, newProd.id, newProd);
                        }, 50);
                      }
                      setInfoMsg(`Product "${newProd.name}" created and added to Purchase Order.`);
                      setTimeout(() => setInfoMsg(''), 4000);
                    }
                  }
                } catch (err) {
                  console.error('Error reloading products after creation:', err);
                }
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
