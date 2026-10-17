import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, RotateCcw, Package, Calendar, User, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { navigate } from '../../router';
import { apiFetch, apiUrl } from '../../api';
import { DCStatusBadge } from './dcPrimitives';
import ReturnChallanSearch from './ReturnChallanSearch';
import ReturnItemsTable from './ReturnItemsTable';
import { calculateDcReturnMetrics } from './dcReturnCalculator';

function authHeaders(user) {
  return {
    'Content-Type': 'application/json',
    'x-user-id': user?.id || ''
  };
}

const RETURN_REASONS = [
  'Demo Equipment Return',
  'Customer Return / Replacement',
  'Defective / Damaged in Transit',
  'Excess / Rejected Item',
  'Temporary Custody Handback'
];

export default function NewReturnDcPage({ challans = [], user, onRefresh, initialDcId = null }) {
  const [selectedDc, setSelectedDc] = useState(null);
  const [returnItemsState, setReturnItemsState] = useState([]);
  const [returnReason, setReturnReason] = useState('Demo Equipment Return');
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [executiveEngineer, setExecutiveEngineer] = useState('');
  const [materialReturnedBy, setMaterialReturnedBy] = useState('');
  const [returnRemarks, setReturnRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSelectChallan = (dc) => {
    const m = calculateDcReturnMetrics(dc);
    if (!m.isEligibleForReturn || m.remainingReturnableQty === 0) {
      setError('Full quantity already returned.');
      return;
    }

    setSelectedDc(dc);
    setError('');
    setSuccess('');
    setExecutiveEngineer(dc.executiveEngineer || user?.name || '');
    setMaterialReturnedBy(dc.materialReturnedBy || dc.customerName || dc.receiverName || '');

    // Prepare item states
    const items = Array.isArray(dc.items) ? dc.items : [];
    const itemStates = items.map((it) => {
      const sent = Number(it.quantity || 1);
      const alreadyReturned = Number(it.returnedQty || 0);
      const remaining = Math.max(0, sent - alreadyReturned);
      const returnedSerialsSet = new Set(
        (Array.isArray(it.returnedSerials) ? it.returnedSerials : []).map((s) => String(s || '').trim().toLowerCase())
      );
      const eligibleSerials = (Array.isArray(it.serialNumbers) ? it.serialNumbers : [])
        .map((s) => String(s || '').trim())
        .filter((sn) => sn && !returnedSerialsSet.has(sn.toLowerCase()));

      return {
        productId: it.productId,
        productCode: it.productCode,
        productName: it.productName,
        productDetails: it.productDetails,
        sentQty: sent,
        alreadyReturnedQty: alreadyReturned,
        remainingQty: remaining,
        returnNowQty: remaining, // default to remaining for faster entry
        eligibleSerials,
        selectedSerials: [...eligibleSerials] // default select all unreturned serials
      };
    });

    setReturnItemsState(itemStates);
  };

  // Check URL query param ?dcId=...
  useEffect(() => {
    if (!selectedDc && Array.isArray(challans) && challans.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const targetId = initialDcId || params.get('dcId') || params.get('challanId');
      if (targetId) {
        const found = challans.find((c) => c.challanId === targetId);
        if (found) {
          handleSelectChallan(found);
        }
      }
    }
  }, [challans, initialDcId]);

  const handleClearSelectedChallan = () => {
    setSelectedDc(null);
    setReturnItemsState([]);
    setError('');
  };

  const handleItemQtyChange = (idx, val) => {
    setReturnItemsState((prev) => {
      const next = [...prev];
      const it = next[idx];
      const parsed = Math.max(0, parseInt(val, 10) || 0);
      const validQty = Math.min(parsed, it.remainingQty);

      let nextSelectedSerials = it.selectedSerials;
      if (it.eligibleSerials.length > 0) {
        // Adjust selected serials to match returnNowQty automatically
        nextSelectedSerials = it.eligibleSerials.slice(0, validQty);
      }

      next[idx] = {
        ...it,
        returnNowQty: validQty,
        selectedSerials: nextSelectedSerials
      };
      return next;
    });
  };

  const handleToggleSerial = (itemIdx, serial) => {
    setReturnItemsState((prev) => {
      const next = [...prev];
      const it = next[itemIdx];
      const isSelected = it.selectedSerials.includes(serial);
      let newSelected;
      if (isSelected) {
        newSelected = it.selectedSerials.filter((s) => s !== serial);
      } else {
        newSelected = [...it.selectedSerials, serial];
      }
      next[itemIdx] = {
        ...it,
        selectedSerials: newSelected,
        returnNowQty: newSelected.length
      };
      return next;
    });
  };

  const handleSubmitReturn = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedDc) {
      setError('Please search and select a Delivery Challan first.');
      return;
    }

    const totalReturnNow = returnItemsState.reduce((s, it) => s + Number(it.returnNowQty || 0), 0);
    if (totalReturnNow <= 0) {
      setError('Please enter at least 1 unit to return across the consignment items.');
      return;
    }

    // Validate quantities and serial counts
    for (const it of returnItemsState) {
      if (it.returnNowQty > it.remainingQty) {
        setError(`Only ${it.remainingQty} units remain available for return.`);
        return;
      }
      if (it.returnNowQty < 0) {
        setError('Return quantity cannot be negative.');
        return;
      }
      if (it.eligibleSerials.length > 0 && it.returnNowQty > 0) {
        if (it.selectedSerials.length !== it.returnNowQty) {
          setError(
            `Product "${it.productName}" is serialized and requires exactly ${it.returnNowQty} return serial number(s), but ${it.selectedSerials.length} provided.`
          );
          return;
        }

        // Duplicate serial check
        const serialSet = new Set(it.selectedSerials);
        if (serialSet.size !== it.selectedSerials.length) {
          setError(`Duplicate serial number selection detected for "${it.productName}".`);
          return;
        }
      }
    }

    if (!returnReason.trim()) {
      setError('Please select a Return Reason.');
      return;
    }

    if (!returnDate) {
      setError('Please provide a valid Return Date.');
      return;
    }

    setSaving(true);
    setError('');

    const returnedItemsPayload = returnItemsState.map((it) => ({
      productId: it.productId,
      productCode: it.productCode,
      returnNowQty: it.returnNowQty,
      returnedSerials: it.selectedSerials
    }));

    try {
      const res = await apiFetch(apiUrl(`/api/orders/delivery-challans/${selectedDc.challanId}/status`), {
        method: 'PATCH',
        headers: authHeaders(user),
        body: JSON.stringify({
          deliveryDate: returnDate,
          returnReason,
          remarks: returnRemarks.trim()
            ? `[RETURNED ${totalReturnNow} units on ${returnDate} - Reason: ${returnReason}] ${returnRemarks.trim()}`
            : `[RETURNED ${totalReturnNow} units on ${returnDate} - Reason: ${returnReason}]`,
          returnedItems: returnedItemsPayload,
          executiveEngineer,
          materialReturnedBy
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to record DC return.');
      }

      setSuccess(`Return recorded successfully! ${totalReturnNow} unit(s) restored to stock.`);
      if (onRefresh) onRefresh();

      // Navigate back to Return DC Register after a brief confirmation
      setTimeout(() => {
        navigate('/delivery-challans/return');
      }, 700);
    } catch (err) {
      setError(err.message || 'Error processing return.');
      setSaving(false);
    }
  };

  const dcMetrics = selectedDc ? calculateDcReturnMetrics(selectedDc) : null;
  const totalSent = dcMetrics ? dcMetrics.originalDeliveredQty : 0;
  const totalAlreadyReturned = dcMetrics ? dcMetrics.cumulativeReturnedQty : 0;
  const totalRemaining = dcMetrics ? dcMetrics.remainingReturnableQty : 0;
  const totalReturnNow = returnItemsState.reduce((s, it) => s + Number(it.returnNowQty || 0), 0);

  return (
    <div className="dc-page-container dc-new-return-page">
      {/* 1. Header Navigation Bar */}
      <div className="dc-page-header compact-header" style={{ marginBottom: '16px' }}>
        <div className="dc-header-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            className="dc-btn-action secondary"
            onClick={() => navigate('/delivery-challans/return')}
            title="Back to Returned Challans Register"
          >
            <ArrowLeft size={14} />
            <span>Back to Return DC</span>
          </button>
          <div>
            <h2 className="dc-page-title" style={{ margin: 0 }}>Initiate Return DC</h2>
            <p className="dc-page-subtitle" style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              Select a delivery challan, specify return quantities, and record stock handback.
            </p>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="crm-alert-box error" style={{ marginBottom: '14px' }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="crm-alert-box success" style={{ marginBottom: '14px' }}>
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* 2. Search & Selection Section */}
      {!selectedDc ? (
        <div className="dc-initiate-search-section">
          <div className="dc-search-intro-card">
            <h3 className="dc-section-title">Select Active Delivery Challan</h3>
            <p className="dc-section-subtitle">
              Type in the search box to find consignments eligible for full or partial return.
            </p>
            <ReturnChallanSearch
              challans={challans}
              onSelect={handleSelectChallan}
              autoFocus
            />
          </div>
        </div>
      ) : (
        <div className="dc-return-workflow-container">
          {/* 3. Selected Challan Summary Card */}
          <div className="dc-selected-challan-card">
            <div className="dc-selected-header">
              <div className="dc-selected-title-group">
                <span className="dc-selected-label">SELECTED DELIVERY CHALLAN</span>
                <div className="dc-selected-main-id">
                  <strong className="order-id-badge" style={{ fontSize: '14px', padding: '4px 10px' }}>
                    {selectedDc.challanId}
                  </strong>
                  {dcMetrics && (
                    <span
                      className={`dc-purpose-badge ${dcMetrics.originalPurpose === 'Returnable / Temporary' ? 'returnable' : 'normal'}`}
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: dcMetrics.originalPurpose === 'Returnable / Temporary' ? '#eff6ff' : '#f1f5f9',
                        color: dcMetrics.originalPurpose === 'Returnable / Temporary' ? '#1d4ed8' : '#475569',
                        border: `1px solid ${dcMetrics.originalPurpose === 'Returnable / Temporary' ? '#bfdbfe' : '#cbd5e1'}`
                      }}
                    >
                      {dcMetrics.originalPurpose}
                    </span>
                  )}
                  <DCStatusBadge status={dcMetrics ? dcMetrics.statusBadge : (selectedDc.status || 'DISPATCHED')} />
                </div>
              </div>
              <button
                type="button"
                className="dc-btn-action secondary"
                onClick={handleClearSelectedChallan}
                title="Select a different challan"
              >
                <RotateCcw size={12} />
                <span>Change Challan</span>
              </button>
            </div>

            <div className="dc-selected-details-grid">
              <div className="dc-selected-detail-col">
                <span className="dc-meta-label">Customer / Consignee:</span>
                <strong className="dc-meta-value customer">
                  <User size={13} style={{ display: 'inline', marginRight: '4px', color: '#64748b' }} />
                  {selectedDc.customerName || selectedDc.receiverName || 'Valued Customer'}
                </strong>
                {selectedDc.company && selectedDc.company !== selectedDc.customerName && (
                  <span className="dc-meta-sub">({selectedDc.company})</span>
                )}
              </div>

              <div className="dc-selected-detail-col">
                <span className="dc-meta-label">Dispatched Date:</span>
                <span className="dc-meta-value">
                  <Calendar size={13} style={{ display: 'inline', marginRight: '4px', color: '#64748b' }} />
                  {selectedDc.deliveryDate || '—'}
                </span>
              </div>

              <div className="dc-selected-detail-col">
                <span className="dc-meta-label">Linked Order:</span>
                <span className="dc-meta-value">
                  <FileText size={13} style={{ display: 'inline', marginRight: '4px', color: '#64748b' }} />
                  {selectedDc.orderId || 'Standalone Consignment'}
                </span>
              </div>

              <div className="dc-selected-detail-col">
                <span className="dc-meta-label">Consignment Balance:</span>
                <div className="dc-balance-summary-chips">
                  <span className="dc-balance-chip sent" title="Total Sent">
                    Sent: <strong>{totalSent}</strong>
                  </span>
                  <span className="dc-balance-chip returned" title="Already Returned">
                    Returned: <strong>{totalAlreadyReturned}</strong>
                  </span>
                  <span className="dc-balance-chip remaining" title="Remaining to Return">
                    Remaining: <strong>{totalRemaining}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Consignment Items & Return Quantities Table */}
          <div className="dc-return-items-section-card">
            <div className="dc-section-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={16} style={{ color: '#2563eb' }} />
                <h3 className="dc-section-card-title">Consignment Items &amp; Return Quantities</h3>
              </div>
              <span className="dc-section-counter">
                {returnItemsState.length} item{returnItemsState.length === 1 ? '' : 's'} in consignment
              </span>
            </div>

            <ReturnItemsTable
              itemsState={returnItemsState}
              onQtyChange={handleItemQtyChange}
              onToggleSerial={handleToggleSerial}
            />
          </div>

          {/* 5. Return Metadata & Actions Form */}
          <form onSubmit={handleSubmitReturn} className="dc-return-form-card">
            <div className="dc-return-form-grid">
              <div className="crm-form-group">
                <label className="crm-form-label">
                  Return Reason <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  className="crm-form-input"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  required
                >
                  {RETURN_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="crm-form-group">
                <label className="crm-form-label">
                  Return Date <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="date"
                  className="crm-form-input"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  required
                />
              </div>

              <div className="crm-form-group">
                <label className="crm-form-label">Material Returned By</label>
                <input
                  type="text"
                  className="crm-form-input"
                  value={materialReturnedBy}
                  onChange={(e) => setMaterialReturnedBy(e.target.value)}
                  placeholder="e.g. Customer Representative Name"
                />
              </div>

              <div className="crm-form-group">
                <label className="crm-form-label">Executive Engineer (Receiving)</label>
                <input
                  type="text"
                  className="crm-form-input"
                  value={executiveEngineer}
                  onChange={(e) => setExecutiveEngineer(e.target.value)}
                  placeholder="e.g. Engineer Name"
                />
              </div>
            </div>

            <div className="crm-form-group" style={{ marginTop: '12px' }}>
              <label className="crm-form-label">Return Notes / Custody Remarks</label>
              <textarea
                className="crm-form-textarea"
                rows={2}
                value={returnRemarks}
                onChange={(e) => setReturnRemarks(e.target.value)}
                placeholder="Specify equipment condition, verified physical seals, test remarks..."
              />
            </div>

            {/* Bottom Actions Bar */}
            <div className="dc-return-form-footer">
              <div className="dc-return-summary-total">
                <span>Total Units Returning Now:</span>
                <strong style={{ color: totalReturnNow > 0 ? '#2563eb' : '#94a3b8', fontSize: '15px' }}>
                  {totalReturnNow} {totalReturnNow === 1 ? 'unit' : 'units'}
                </strong>
                {totalRemaining > 0 && totalReturnNow < totalRemaining && (
                  <span className="dc-partial-notice">
                    ({totalRemaining - totalReturnNow} units will remain unreturned)
                  </span>
                )}
                {totalRemaining > 0 && totalReturnNow === totalRemaining && (
                  <span className="dc-full-notice">
                    (Full Return: challan status will become FULLY RETURNED)
                  </span>
                )}
              </div>

              <div className="dc-return-buttons-group">
                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={() => navigate('/delivery-challans/return')}
                  disabled={saving}
                >
                  Cancel / Back
                </button>
                <button
                  type="submit"
                  className="crm-btn-primary dc-confirm-return-btn"
                  disabled={saving || totalReturnNow <= 0}
                >
                  <Check size={14} />
                  <span>{saving ? 'Processing Return...' : 'Confirm DC Return'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
