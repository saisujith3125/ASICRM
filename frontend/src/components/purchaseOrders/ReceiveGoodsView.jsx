import React, { useState, useEffect, useMemo, useRef } from 'react';
import { apiFetch, apiUrl } from '../../api';
import { navigate } from '../../router';
import {
  ArrowLeft,
  Truck,
  CheckCircle2,
  AlertCircle,
  Package,
  Calendar,
  User,
  FileText,
  Barcode
} from 'lucide-react';
import SearchablePurchaseOrderSelect from '../common/SearchablePurchaseOrderSelect';
import SerialNumberModal from '../common/SerialNumberModal';
import './purchaseOrders.css';

export default function ReceiveGoodsView({ user, preselectedPoId, onBack, onComplete }) {
  const [allPos, setAllPos] = useState([]);
  const [selectedPoId, setSelectedPoId] = useState(preselectedPoId || '');
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successResult, setSuccessResult] = useState(null);

  // Sync preselectedPoId when passed or updated from routing
  useEffect(() => {
    if (preselectedPoId && preselectedPoId !== selectedPoId) {
      setSelectedPoId(preselectedPoId);
    }
  }, [preselectedPoId]);

  // Ensure active PO is in allPos so SearchablePurchaseOrderSelect shows its title
  useEffect(() => {
    if (po && !allPos.some((p) => p.id === po.id)) {
      setAllPos((prev) => [po, ...prev]);
    }
  }, [po]);

  // Form State
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receivedBy, setReceivedBy] = useState(() => user?.name || 'Store Officer');
  const [notes, setNotes] = useState('');

  // Per-item receive state: { [productId]: { receiveNow: number, serialNumbers: string[] } }
  const [receiveInputs, setReceiveInputs] = useState({});

  // Serial number modal state
  const [activeSerialItem, setActiveSerialItem] = useState(null);
  const activeTriggerRef = useRef(null);
  const poInputRef = useRef(null);

  // Fetch pending POs list
  useEffect(() => {
    let active = true;
    const loadPos = async () => {
      try {
        const res = await apiFetch(apiUrl('/api/purchase-orders'));
        const data = await res.json();
        if (active && res.ok && data.success && Array.isArray(data.data)) {
          // Filter to POs that can receive goods (status SENT or PARTIALLY_RECEIVED with pending items)
          const eligible = data.data.filter(
            (p) =>
              (p.status === 'SENT' || p.status === 'PARTIALLY_RECEIVED') &&
              Number(p.totalPendingQty || 0) > 0
          );
          setAllPos(eligible);

          if (!selectedPoId && eligible.length > 0) {
            setSelectedPoId(eligible[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load POs for receipt:', err);
      }
    };

    loadPos();
    return () => {
      active = false;
    };
  }, []);

  // Fetch selected PO detail
  useEffect(() => {
    if (!selectedPoId) {
      setPo(null);
      return;
    }

    let active = true;
    const fetchPo = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const res = await apiFetch(apiUrl(`/api/purchase-orders/${selectedPoId}`));
        const data = await res.json();
        if (active) {
          if (res.ok && data.success && data.data) {
            const fetchedPo = data.data;
            setPo(fetchedPo);

            // Initialize receive inputs
            // If the PO is already PARTIALLY_RECEIVED, default receiveNow to 0 so the user can enter
            // the exact partial batch received without unintentionally completing the rest of the order.
            // If the PO is SENT, default receiveNow to remaining pending quantity.
            const isAlreadyPartial = fetchedPo.status === 'PARTIALLY_RECEIVED';
            const initInputs = {};
            (fetchedPo.items || []).forEach((it) => {
              const pending = Math.max(0, Number(it.orderedQty || 0) - Number(it.receivedQty || 0));
              initInputs[it.productId || it.productCode] = {
                receiveNow: isAlreadyPartial ? 0 : pending,
                unitRate: Number(it.rate || it.cost || 0),
                serialNumbers: []
              };
            });
            setReceiveInputs(initInputs);
          } else {
            setErrorMsg(data.message || 'Failed to fetch Purchase Order details.');
          }
        }
      } catch (err) {
        console.error('Error fetching PO:', err);
        if (active) setErrorMsg('Failed to connect to server.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchPo();
    return () => {
      active = false;
    };
  }, [selectedPoId]);

  const handleReceiveNowChange = (prodId, val, maxPending) => {
    const num = Math.max(0, Math.min(parseInt(val, 10) || 0, maxPending));
    setReceiveInputs((prev) => ({
      ...prev,
      [prodId]: {
        ...(prev[prodId] || {}),
        receiveNow: num
      }
    }));
  };

  const totalInwardNow = useMemo(() => {
    return Object.values(receiveInputs).reduce((s, i) => s + (Number(i.receiveNow) || 0), 0);
  }, [receiveInputs]);

  const totalPendingUnits = useMemo(() => {
    if (!po?.items) return 0;
    return po.items.reduce((s, it) => s + Math.max(0, Number(it.orderedQty || 0) - Number(it.receivedQty || 0)), 0);
  }, [po]);

  const isFullDelivery = totalInwardNow > 0 && totalInwardNow === totalPendingUnits && (po?.items || []).every((it) => {
    const pId = it.productId || it.productCode;
    const pending = Math.max(0, Number(it.orderedQty || 0) - Number(it.receivedQty || 0));
    return Number(receiveInputs[pId]?.receiveNow || 0) === pending;
  });

  const isPartialDelivery = totalInwardNow > 0 && !isFullDelivery;

  const handleFillAllPending = () => {
    if (!po?.items) return;
    const nextInputs = { ...receiveInputs };
    po.items.forEach((it) => {
      const pId = it.productId || it.productCode;
      const pending = Math.max(0, Number(it.orderedQty || 0) - Number(it.receivedQty || 0));
      nextInputs[pId] = {
        ...(nextInputs[pId] || {}),
        receiveNow: pending
      };
    });
    setReceiveInputs(nextInputs);
  };

  const handleResetToZero = () => {
    if (!po?.items) return;
    const nextInputs = { ...receiveInputs };
    po.items.forEach((it) => {
      const pId = it.productId || it.productCode;
      nextInputs[pId] = {
        ...(nextInputs[pId] || {}),
        receiveNow: 0,
        serialNumbers: []
      };
    });
    setReceiveInputs(nextInputs);
  };

  const handleRateChange = (prodId, val) => {
    const rate = Math.max(0, parseFloat(val) || 0);
    setReceiveInputs((prev) => ({
      ...prev,
      [prodId]: {
        ...(prev[prodId] || {}),
        unitRate: rate
      }
    }));
  };

  const openSerialModal = (item, e) => {
    if (e && e.currentTarget) {
      activeTriggerRef.current = e.currentTarget;
    }
    setActiveSerialItem(item);
  };

  const handleSaveSerials = (serials) => {
    if (!activeSerialItem) return;
    const prodId = activeSerialItem.productId || activeSerialItem.productCode;

    setReceiveInputs((prev) => ({
      ...prev,
      [prodId]: {
        ...(prev[prodId] || {}),
        serialNumbers: serials
      }
    }));
    setActiveSerialItem(null);
  };

  const handleSubmitReceipt = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!po) {
      setErrorMsg('No Purchase Order selected.');
      return;
    }

    const itemsToReceive = [];
    for (const it of po.items || []) {
      const prodId = it.productId || it.productCode;
      const input = receiveInputs[prodId] || { receiveNow: 0, serialNumbers: [] };
      const receiveNow = Number(input.receiveNow || 0);

      if (receiveNow > 0) {
        // Serial verification
        if (it.serialized) {
          const serials = input.serialNumbers || [];
          if (serials.length !== receiveNow) {
            setErrorMsg(
              `Product "${it.productName}" is serialized. You must enter exactly ${receiveNow} serial number(s) (currently entered: ${serials.length}).`
            );
            return;
          }

          // Check duplicate serials in input
          const seen = new Set();
          for (const s of serials) {
            if (seen.has(s.toLowerCase())) {
              setErrorMsg(`Duplicate serial number "${s}" entered for product "${it.productName}".`);
              return;
            }
            seen.add(s.toLowerCase());
          }
        }

        itemsToReceive.push({
          productId: it.productId,
          productCode: it.productCode,
          receiveNow,
          unitRate: Number(input.unitRate || 0),
          serialNumbers: input.serialNumbers || []
        });
      }
    }

    if (itemsToReceive.length === 0) {
      setErrorMsg('Please enter a receive quantity greater than 0 for at least one product.');
      return;
    }

    setSubmitting(true);
    try {
      if (po.status === 'DRAFT') {
        await apiFetch(apiUrl(`/api/purchase-orders/${po.id}/status`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'SENT' })
        });
      }

      const res = await apiFetch(apiUrl(`/api/purchase-orders/${po.id}/receive`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || 'USR-001'
        },
        body: JSON.stringify({
          receivedDate,
          receivedBy,
          notes,
          items: itemsToReceive
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const receivedBatchTotal = itemsToReceive.reduce((s, i) => s + i.receiveNow, 0);
        setSuccessResult({
          grnId: data.grn?.id || data.grnId,
          totalQty: receivedBatchTotal,
          poId: po.id,
          deliveryType: data.deliveryType || (isFullDelivery ? 'FULL' : 'PARTIAL'),
          remainingUnits: Math.max(0, totalPendingUnits - receivedBatchTotal)
        });
      } else {
        setErrorMsg(data.message || 'Failed to confirm goods receipt.');
      }
    } catch (err) {
      console.error('Error submitting goods receipt:', err);
      setErrorMsg(err.message || 'Network error communicating with server.');
    } finally {
      setSubmitting(false);
    }
  };

  if (successResult) {
    const isSuccessPartial = successResult.deliveryType === 'PARTIAL';
    return (
      <div className="po-container">
        <div className="po-editor-card" style={{ maxWidth: '640px', margin: '48px auto', textAlign: 'center', padding: '40px 32px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: isSuccessPartial ? '#fef3c7' : '#ecfdf5',
              color: isSuccessPartial ? '#b45309' : '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}
          >
            <CheckCircle2 size={36} />
          </div>
          <div style={{ marginBottom: '10px' }}>
            {isSuccessPartial ? (
              <span style={{ fontSize: '12px', fontWeight: 800, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '4px 12px', borderRadius: '12px', textTransform: 'uppercase' }}>
                ⚡ Partial Delivery Recorded
              </span>
            ) : (
              <span style={{ fontSize: '12px', fontWeight: 800, background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '4px 12px', borderRadius: '12px', textTransform: 'uppercase' }}>
                ✓ Full Delivery Completed
              </span>
            )}
          </div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', color: '#0f172a' }}>
            {isSuccessPartial ? 'Partial Goods Receipt Confirmed!' : 'All Goods Received & PO Completed!'}
          </h2>
          <p style={{ color: '#475569', fontSize: '14px', margin: '0 0 20px 0' }}>
            Successfully generated <strong>{successResult.grnId}</strong> and credited{' '}
            <strong>+{successResult.totalQty} units</strong> directly to physical inventory.
            {isSuccessPartial && (
              <span style={{ display: 'block', marginTop: '8px', color: '#b45309', fontWeight: 600 }}>
                {successResult.remainingUnits} unit(s) remain open on PO {successResult.poId} (Status: PARTIALLY RECEIVED).
              </span>
            )}
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button
              type="button"
              className="crm-btn-secondary"
              onClick={() => navigate('/stocks')}
            >
              <Package size={16} /> View Stocks &amp; Inventory
            </button>
            <button
              type="button"
              className="crm-btn-primary"
              onClick={() => navigate(`/purchase-orders/${successResult.poId}`)}
            >
              View Purchase Order
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="po-container purchase-order-page">
      {/* Header */}
      <div className="po-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            className="crm-btn-secondary"
            style={{ padding: '6px 12px' }}
            onClick={() => (onBack ? onBack() : navigate('/purchase-orders'))}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <h1 style={{ margin: 0 }}>Receive Goods (GRN)</h1>
        </div>
      </div>

      {errorMsg && (
        <div className="crm-alert crm-alert-danger" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* PO Selector if not preselected or allow switching */}
      <div className="po-editor-card">
        <div className="po-section-title">
          <Truck size={18} /> 1. Select Purchase Order to Receive
        </div>

        <div className="po-form-grid-receive-row">
          <div className="po-form-group">
            <label>Purchase Order *</label>
            <SearchablePurchaseOrderSelect
              ref={poInputRef}
              autoFocus={true}
              purchaseOrders={allPos}
              selectedPoId={selectedPoId}
              onSelectPo={(poId) => setSelectedPoId(poId)}
              disabled={submitting}
              placeholder="Search purchase order, supplier, product, or PO number..."
            />
            {po && (
              <div className="po-selected-supplier-card" style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13.5px' }}>
                    {po.id} — {po.supplierSnapshot?.companyName || 'Supplier'}
                  </span>
                  <span
                    className={`spos-card-badge ${
                      po.status === 'PARTIALLY_RECEIVED' ? 'partially_received' : (po.status === 'DRAFT' ? 'draft' : 'sent')
                    }`}
                  >
                    {po.status === 'PARTIALLY_RECEIVED' ? 'Partially Received' : (po.status === 'DRAFT' ? 'Draft' : 'Sent')}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '14px',
                    fontSize: '12px',
                    color: '#475569',
                    marginTop: '6px'
                  }}
                >
                  {po.supplierSnapshot?.contactPerson && (
                    <span>Attn: {po.supplierSnapshot.contactPerson}</span>
                  )}
                  {po.supplierSnapshot?.phone && (
                    <span>Ph: {po.supplierSnapshot.phone}</span>
                  )}
                  {po.supplierSnapshot?.gstin && (
                    <span>GSTIN: {po.supplierSnapshot.gstin}</span>
                  )}
                  {po.supplierSnapshot?.address && (
                    <span>Address: {po.supplierSnapshot.address}</span>
                  )}
                  {po.supplierSnapshot?.city && (
                    <span>City: {po.supplierSnapshot.city}</span>
                  )}
                  {po.supplierSnapshot?.pincode && (
                    <span>PIN: {po.supplierSnapshot.pincode}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="po-form-group">
            <label>Receipt Date *</label>
            <input
              type="date"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
              required
            />
          </div>

          <div className="po-form-group">
            <label>Received By *</label>
            <input
              type="text"
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              placeholder="Store officer name"
              required
            />
          </div>
        </div>
      </div>

      {/* PO Summary & Items */}
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
          Loading PO line items...
        </div>
      ) : po ? (
        <form onSubmit={handleSubmitReceipt}>
          <div className="po-editor-card">
            <div className="po-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Package size={18} /> 2. Verify Quantities, Inward Rates &amp; Serial Numbers
              </div>
              <div style={{ fontSize: '11.5px', color: '#16a34a', fontWeight: 600, background: '#f0fdf4', padding: '3px 10px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                🛡️ Highest Value Rule Active: Margins protected against inflation
              </div>
            </div>

            {/* Delivery Mode & Quick Fill Controls */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              margin: '12px 0 16px 0',
              padding: '12px 16px',
              background: isFullDelivery ? '#f0fdf4' : isPartialDelivery ? '#fffbeb' : '#f8fafc',
              border: `1px solid ${isFullDelivery ? '#86efac' : isPartialDelivery ? '#fde68a' : '#e2e8f0'}`,
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Inward Delivery Mode:
                </span>
                {isFullDelivery ? (
                  <span style={{ fontSize: '12.5px', fontWeight: 800, background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '4px 12px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    ✓ FULL DELIVERY ({totalInwardNow} / {totalPendingUnits} Units) — PO will be Completed
                  </span>
                ) : isPartialDelivery ? (
                  <span style={{ fontSize: '12.5px', fontWeight: 800, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '4px 12px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    ⚡ PARTIAL DELIVERY ({totalInwardNow} / {totalPendingUnits} Units) — {totalPendingUnits - totalInwardNow} Units Remaining Open
                  </span>
                ) : (
                  <span style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                    No quantities entered yet. Enter received units below or use quick actions →
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleFillAllPending}
                  disabled={submitting}
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: '1px solid #86efac',
                    background: '#dcfce7',
                    color: '#15803d',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Receive all remaining pending quantities (Full Delivery)"
                >
                  ✓ Fill All Pending (Full)
                </button>
                <button
                  type="button"
                  onClick={handleResetToZero}
                  disabled={submitting}
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Clear all inputs to 0 to enter only the partial items delivered"
                >
                  ⚡ Clear All to 0 (Partial)
                </button>
              </div>
            </div>

            <div className="po-grid-table-wrap">
              <table className="po-table po-receive-table">
                <colgroup>
                  <col style={{ width: '4%' }} />
                  <col style={{ width: '25%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '15%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="po-receive-col-idx">#</th>
                    <th className="po-receive-col-product">PRODUCT / SPECIFICATION</th>
                    <th className="po-receive-col-ordered">ORDERED</th>
                    <th className="po-receive-col-received">RECEIVED</th>
                    <th className="po-receive-col-remaining">REMAINING</th>
                    <th className="po-receive-col-receivenow">RECEIVE NOW *</th>
                    <th style={{ textAlign: 'right' }}>RATE (₹) *</th>
                    <th style={{ textAlign: 'right' }}>BATCH TOTAL</th>
                    <th className="po-receive-col-serials">SERIAL NUMBERS</th>
                  </tr>
                </thead>
                <tbody>
                  {(po.items || []).map((it, idx) => {
                    const prodId = it.productId || it.productCode;
                    const ord = Number(it.orderedQty || 0);
                    const rec = Number(it.receivedQty || 0);
                    const pending = Math.max(0, ord - rec);
                    const input = receiveInputs[prodId] || { receiveNow: 0, unitRate: 0, serialNumbers: [] };
                    const isFullyReceived = pending === 0;

                    const isCable = it.categoryId === 'CAT-000004' || /cable/i.test(it.productName || '') || (String(it.unit || '').trim() === 'Meter' && /wire|cable/i.test(it.productName || ''));
                    const isItemSerialized = !isCable && Boolean(it.serialized);

                    const enteredCount = input.serialNumbers?.length || 0;
                    const reqCount = input.receiveNow;
                    const isComplete = enteredCount === reqCount && reqCount > 0;
                    const isPlural = reqCount !== 1;
                    const btnLabel =
                      reqCount <= 0
                        ? 'No items to receive'
                        : isComplete
                        ? `${reqCount} Serial${isPlural ? 's' : ''} (${enteredCount})`
                        : `Enter ${reqCount} Serial${isPlural ? 's' : ''} (${enteredCount})`;

                    return (
                      <tr
                        key={prodId || idx}
                        style={{ background: isFullyReceived ? '#f8fafc' : '#ffffff' }}
                      >
                        <td className="po-receive-col-idx" style={{ fontWeight: 600, color: '#64748b' }}>
                          {idx + 1}
                        </td>
                        <td className="po-receive-col-product">
                          <div
                            style={{
                              fontWeight: 600,
                              color: '#0f172a',
                              whiteSpace: 'normal',
                              wordBreak: 'break-word'
                            }}
                          >
                            {it.productName}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            SKU: <span style={{ fontFamily: 'monospace' }}>{it.productCode}</span>
                            {isCable ? ' · Cable (Non-serialized)' : (isItemSerialized ? ' · Serialized Hardware' : '')}
                          </div>
                        </td>
                        <td className="po-receive-col-ordered" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {ord}
                        </td>
                        <td
                          className="po-receive-col-received"
                          style={{ fontWeight: 600, color: rec > 0 ? '#16a34a' : '#64748b', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {rec}
                        </td>
                        <td
                          className="po-receive-col-remaining"
                          style={{ fontWeight: 700, color: pending > 0 ? '#d97706' : '#16a34a', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {pending}
                        </td>
                        <td className="po-receive-col-receivenow">
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                            <input
                              type="number"
                              min="0"
                              max={pending}
                              value={input.receiveNow}
                              onChange={(e) => handleReceiveNowChange(prodId, e.target.value, pending)}
                              disabled={isFullyReceived || submitting}
                              className="po-table-input"
                              style={{
                                width: '100%',
                                maxWidth: '80px',
                                textAlign: 'center',
                                fontWeight: 700,
                                borderColor: input.receiveNow > 0 ? (input.receiveNow === pending ? '#16a34a' : '#d97706') : '#cbd5e1'
                              }}
                            />
                            {input.receiveNow > 0 && (
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: input.receiveNow === pending ? '#15803d' : '#b45309',
                                background: input.receiveNow === pending ? '#dcfce7' : '#fef3c7',
                                padding: '1px 5px',
                                borderRadius: '3px',
                                whiteSpace: 'nowrap'
                              }}>
                                {input.receiveNow === pending ? '✓ Full' : '⚡ Partial'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={input.unitRate !== undefined ? input.unitRate : ''}
                            onChange={(e) => handleRateChange(prodId, e.target.value)}
                            disabled={isFullyReceived || submitting}
                            className="po-table-input"
                            placeholder="Rate ₹"
                            style={{
                              width: '100%',
                              maxWidth: '96px',
                              textAlign: 'right',
                              fontWeight: 600,
                              borderColor: input.unitRate > 0 ? '#16a34a' : '#cbd5e1'
                            }}
                          />
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                          ₹ {((Number(input.receiveNow) || 0) * (Number(input.unitRate) || 0)).toFixed(2)}
                        </td>
                        <td className="po-receive-col-serials">
                          {isItemSerialized ? (
                            <div>
                              <button
                                type="button"
                                className={`po-serial-btn ${isComplete ? 'is-complete' : ''}`}
                                onClick={(e) => openSerialModal(it, e)}
                                disabled={input.receiveNow <= 0 || submitting}
                                title={
                                  reqCount > 0
                                    ? `Manage serial numbers for ${it.productName}`
                                    : 'Enter receive quantity first'
                                }
                              >
                                {isComplete ? <CheckCircle2 size={14} /> : <Barcode size={14} />}
                                <span>{btnLabel}</span>
                              </button>
                            </div>
                          ) : (
                            <span
                              style={{
                                fontSize: '12px',
                                color: '#64748b',
                                fontWeight: 500
                              }}
                            >
                              Standard (Non-serialized)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Profit Protection & Inward Summary */}
            <div style={{
              marginTop: '16px',
              padding: '14px 18px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Inward Units Now</span>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#2563eb' }}>
                    {Object.values(receiveInputs).reduce((s, i) => s + (Number(i.receiveNow) || 0), 0)} Units
                  </div>
                </div>
                <div style={{ width: '1px', height: '28px', background: '#cbd5e1' }} />
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Current Batch Total</span>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                    ₹ {Object.values(receiveInputs).reduce((s, i) => s + ((Number(i.receiveNow) || 0) * (Number(i.unitRate) || 0)), 0).toFixed(2)}
                  </div>
                </div>
                <div style={{ width: '1px', height: '28px', background: '#cbd5e1' }} />
                <div>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Delivery Status</span>
                  <div style={{ marginTop: '2px' }}>
                    {(() => {
                      const totalInward = Object.values(receiveInputs).reduce((s, i) => s + (Number(i.receiveNow) || 0), 0);
                      const totalPending = (po.items || []).reduce((s, it) => s + Math.max(0, Number(it.orderedQty || 0) - Number(it.receivedQty || 0)), 0);
                      if (totalInward <= 0) return <span style={{ fontSize: '13px', color: '#94a3b8' }}>—</span>;
                      if (totalInward >= totalPending) {
                        return (
                          <span style={{ fontSize: '11.5px', fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            ✓ Full Delivery (Complete)
                          </span>
                        );
                      }
                      return (
                        <span style={{ fontSize: '11.5px', fontWeight: 700, background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          ⚡ Partial Delivery ({totalPending - totalInward} units remaining)
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px 12px', borderRadius: '6px', maxWidth: '580px', lineHeight: 1.4 }}>
                🛡️ <strong>Profit Protection Rule:</strong> If rates increase across delivery batches (e.g. 6 @ ₹400 and 2 @ ₹500), valuation of all units benchmarks at the <strong>highest received unit rate (₹500/unit)</strong> to protect against selling margin loss.
              </div>
            </div>

            <div style={{ marginTop: '20px' }} className="po-form-group">
              <label>Delivery Remarks / Inward Inspection Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Received in good condition, carton seals intact."
              />
            </div>

            <div className="po-form-actions">
              <button
                type="button"
                className="crm-btn-secondary"
                onClick={() => (onBack ? onBack() : navigate('/purchase-orders'))}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="crm-btn-primary"
                disabled={submitting}
                style={{
                  background: isPartialDelivery ? '#d97706' : '#16a34a',
                  borderColor: isPartialDelivery ? '#b45309' : '#15803d'
                }}
              >
                <CheckCircle2 size={16} />
                {submitting
                  ? 'Updating Inventory...'
                  : isFullDelivery
                  ? `✓ Confirm Full Receipt (+${totalInwardNow} Units) & Complete PO`
                  : isPartialDelivery
                  ? `⚡ Confirm Partial Receipt (+${totalInwardNow} Units) & Keep PO Open`
                  : 'Confirm Receipt & Update Physical Stock'}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {/* Rebuilt Serial Number Entry Modal */}
      <SerialNumberModal
        isOpen={!!activeSerialItem}
        onClose={() => setActiveSerialItem(null)}
        onSave={handleSaveSerials}
        product={activeSerialItem}
        requiredCount={
          activeSerialItem
            ? Number(
                receiveInputs[
                  activeSerialItem.productId || activeSerialItem.productCode
                ]?.receiveNow || 0
              )
            : 0
        }
        initialSerials={
          activeSerialItem
            ? receiveInputs[
                activeSerialItem.productId || activeSerialItem.productCode
              ]?.serialNumbers || []
            : []
        }
        triggerRef={activeTriggerRef}
      />
    </div>
  );
}
