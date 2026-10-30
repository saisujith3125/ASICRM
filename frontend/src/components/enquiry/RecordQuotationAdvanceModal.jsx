import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, CreditCard, Check, AlertCircle, Calendar, Hash, Tag, FileText, CheckCircle2, History, ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch, apiUrl } from '../../api';

function authHeaders(user) {
  return {
    'Content-Type': 'application/json',
    'x-user-id': user?.id || ''
  };
}

export default function RecordQuotationAdvanceModal({
  isOpen,
  quotation,
  user,
  onClose,
  onSuccess
}) {
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('Bank Transfer (NEFT/RTGS)');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef(null);

  // Financial figures
  const quoteTotal = useMemo(() => {
    return Number(quotation?.grandTotal || quotation?.amount || 0);
  }, [quotation]);

  const existingAdvance = useMemo(() => {
    return Number(quotation?.advanceAmount || 0);
  }, [quotation]);

  const currentBalance = useMemo(() => {
    return Math.max(0, Math.round((quoteTotal - existingAdvance) * 100) / 100);
  }, [quoteTotal, existingAdvance]);

  const enteredAmount = parseFloat(amount) || 0;
  const balanceAfterThisPayment = Math.max(0, Math.round((currentBalance - enteredAmount) * 100) / 100);

  // Reset and focus on open
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentMode('Bank Transfer (NEFT/RTGS)');
      setReferenceNo('');
      setNotes('');
      setError('');
      setSuccessMsg('');
      setShowHistory(false);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen || !quotation) return null;

  const pastPayments = Array.isArray(quotation.advancePayments) ? quotation.advancePayments : [];

  const handleQuickPercent = (pct) => {
    setError('');
    if (pct === 100) {
      setAmount(String(currentBalance));
    } else {
      const calc = Math.round(quoteTotal * (pct / 100) * 100) / 100;
      const finalAmt = Math.min(calc, currentBalance);
      setAmount(String(finalAmt));
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSuccessMsg('');

    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      setError('Please enter a valid positive advance amount.');
      return;
    }

    if (val > currentBalance + 0.01) {
      setError(`Advance amount cannot exceed remaining balance of ₹${currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`);
      return;
    }

    if (!paymentDate) {
      setError('Please select a payment date.');
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = apiUrl(`/api/enquiries/quotation/${encodeURIComponent(quotation.quotationId)}/advance`);
      let res = await apiFetch(endpoint, {
        method: 'PATCH',
        headers: authHeaders(user),
        body: JSON.stringify({
          amount: val,
          paymentDate,
          paymentMode,
          referenceNo: referenceNo.trim(),
          notes: notes.trim()
        })
      });

      // Fallback to POST if server/proxy doesn't accept PATCH
      if (!res.ok && res.status === 404) {
        res = await apiFetch(endpoint, {
          method: 'POST',
          headers: authHeaders(user),
          body: JSON.stringify({
            amount: val,
            paymentDate,
            paymentMode,
            referenceNo: referenceNo.trim(),
            notes: notes.trim()
          })
        });
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to record advance payment.');
      }

      setSuccessMsg(`Advance payment of ₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} recorded successfully!`);
      setTimeout(() => {
        if (onSuccess) onSuccess(data.data || data);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Error saving advance:', err);
      setError(err.message || 'Unable to record advance payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="crm-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(3px)',
        zIndex: 2100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="advance-modal-title"
    >
      <div
        className="crm-modal-card"
        style={{
          width: 'min(640px, 100%)',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                border: '1px solid #a7f3d0'
              }}
            >
              <CreditCard size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3
                  id="advance-modal-title"
                  style={{
                    margin: 0,
                    fontSize: '17px',
                    fontWeight: 700,
                    color: '#0f172a'
                  }}
                >
                  Record Advance Payment
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: '#dbeafe',
                    color: '#1e40af',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    letterSpacing: '0.3px'
                  }}
                >
                  {quotation.quotationId}
                </span>
              </div>
              <p
                style={{
                  margin: '3px 0 0',
                  fontSize: '12px',
                  color: '#64748b'
                }}
              >
                {quotation.customerName || quotation.customerCompany || 'Customer'}
                {quotation.company ? ` • ${quotation.company}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="crm-modal-close"
            onClick={onClose}
            disabled={submitting}
            title="Close (Escape)"
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: submitting ? 'not-allowed' : 'pointer',
              color: '#64748b'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}
        >
          {/* Alerts */}
          {error && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#b91c1c',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '8px',
                padding: '10px 14px',
                color: '#065f46',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 3-Summary Financial Banner */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px'
            }}
          >
            {/* Total */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 14px'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Quotation Total
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
                ₹ {quoteTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Advance Received */}
            <div
              style={{
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '8px',
                padding: '12px 14px'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Advance Received
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#047857', marginTop: '4px' }}>
                ₹ {existingAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            {/* Balance Due */}
            <div
              style={{
                backgroundColor: currentBalance <= 0 ? '#f0fdf4' : '#fffbeb',
                border: `1px solid ${currentBalance <= 0 ? '#bbf7d0' : '#fde68a'}`,
                borderRadius: '8px',
                padding: '12px 14px'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 600, color: currentBalance <= 0 ? '#15803d' : '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Balance Due
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: currentBalance <= 0 ? '#15803d' : '#b45309', marginTop: '4px' }}>
                ₹ {currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {currentBalance <= 0 && (
            <div
              style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '8px',
                padding: '12px 16px',
                color: '#166534',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
              <span>This quotation has been <strong>fully paid in advance</strong> (₹{existingAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). No further advance payment is required.</span>
            </div>
          )}

          {currentBalance > 0 && (
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Advance Amount Input + Quick Chips */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <label htmlFor="advance-amount-input" style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                    Advance Amount to Record (₹) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleQuickPercent(25)}
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      title="Set 25% of Quoted Total"
                    >
                      25%
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPercent(50)}
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      title="Set 50% of Quoted Total"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPercent(100)}
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: '#ecfdf5',
                        color: '#065f46',
                        border: '1px solid #a7f3d0',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      title="Set 100% of Balance Due"
                    >
                      Full Balance
                    </button>
                  </div>
                </div>

                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#64748b'
                    }}
                  >
                    ₹
                  </span>
                  <input
                    id="advance-amount-input"
                    ref={inputRef}
                    type="number"
                    step="0.01"
                    min="1"
                    max={currentBalance}
                    className="crm-form-input"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter advance amount received"
                    disabled={submitting}
                    style={{
                      paddingLeft: '28px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#0f172a',
                      height: '38px',
                      borderRadius: '8px'
                    }}
                    required
                  />
                </div>

                {enteredAmount > 0 && (
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '11.5px',
                      color: enteredAmount > currentBalance ? '#dc2626' : '#059669',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span>
                      {enteredAmount > currentBalance ? (
                        <>⚠️ Entered amount exceeds balance by ₹{(enteredAmount - currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                      ) : (
                        <>✓ New Advance Total: ₹{(existingAdvance + enteredAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                      )}
                    </span>
                    {enteredAmount <= currentBalance && (
                      <span style={{ color: balanceAfterThisPayment === 0 ? '#059669' : '#d97706' }}>
                        Remaining Balance: ₹{balanceAfterThisPayment.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {balanceAfterThisPayment === 0 && ' (Full Advance Settled)'}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Payment Date & Mode Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label htmlFor="advance-date-input" style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Payment Date <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    id="advance-date-input"
                    type="date"
                    className="crm-form-input"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    disabled={submitting}
                    style={{ height: '38px', borderRadius: '8px', fontSize: '13px' }}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="advance-mode-select" style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Payment Mode <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select
                    id="advance-mode-select"
                    className="crm-form-input"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    disabled={submitting}
                    style={{ height: '38px', borderRadius: '8px', fontSize: '13px' }}
                    required
                  >
                    <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT/RTGS)</option>
                    <option value="IMPS">IMPS</option>
                    <option value="UPI / QR Payment">UPI / QR Payment</option>
                    <option value="Cheque / Demand Draft">Cheque / Demand Draft</option>
                    <option value="Cash">Cash</option>
                    <option value="Credit / Debit Card">Credit / Debit Card</option>
                    <option value="Net Banking">Net Banking</option>
                  </select>
                </div>
              </div>

              {/* Reference / UTR No */}
              <div>
                <label htmlFor="advance-ref-input" style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Transaction Ref / UTR / Cheque No.
                </label>
                <input
                  id="advance-ref-input"
                  type="text"
                  className="crm-form-input"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="e.g. UTR1234567890 / Cheque #54321 / UPI Ref"
                  disabled={submitting}
                  style={{ height: '38px', borderRadius: '8px', fontSize: '13px' }}
                />
              </div>

              {/* Notes / Remarks */}
              <div>
                <label htmlFor="advance-notes-input" style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Payment Remarks / Notes
                </label>
                <textarea
                  id="advance-notes-input"
                  rows="2"
                  className="crm-form-textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. 50% advance for hardware procurement received in HDFC Current A/C"
                  disabled={submitting}
                  style={{ borderRadius: '8px', fontSize: '12.5px', padding: '8px 10px' }}
                />
              </div>
            </form>
          )}

          {/* Past Payments History Accordion */}
          {pastPayments.length > 0 && (
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: '#ffffff'
              }}
            >
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: '#f8fafc',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#334155'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History size={15} style={{ color: '#059669' }} />
                  <span>Previous Advance Payments ({pastPayments.length})</span>
                </div>
                {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showHistory && (
                <div style={{ padding: '8px 14px', borderTop: '1px solid #e2e8f0' }}>
                  <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: '#64748b', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '6px 4px' }}>Date</th>
                        <th style={{ padding: '6px 4px' }}>Amount</th>
                        <th style={{ padding: '6px 4px' }}>Mode</th>
                        <th style={{ padding: '6px 4px' }}>Reference</th>
                        <th style={{ padding: '6px 4px' }}>Recorded By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pastPayments.map((p, pIdx) => (
                        <tr key={p.paymentId || pIdx} style={{ borderBottom: pIdx < pastPayments.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                          <td style={{ padding: '6px 4px', color: '#0f172a', fontWeight: 500 }}>{p.paymentDate || '—'}</td>
                          <td style={{ padding: '6px 4px', color: '#059669', fontWeight: 600 }}>
                            ₹ {Number(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '6px 4px', color: '#475569' }}>{p.paymentMode || '—'}</td>
                          <td style={{ padding: '6px 4px', color: '#475569', fontFamily: 'monospace' }}>{p.referenceNo || '—'}</td>
                          <td style={{ padding: '6px 4px', color: '#64748b' }}>{p.recordedBy || 'System'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px'
          }}
        >
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              backgroundColor: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}
          >
            {currentBalance <= 0 ? 'Close' : 'Cancel'}
          </button>

          {currentBalance > 0 && (
            <button
              type="button"
              className="crm-btn-primary"
              onClick={handleSave}
              disabled={submitting || enteredAmount <= 0 || enteredAmount > currentBalance}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                backgroundColor: (submitting || enteredAmount <= 0 || enteredAmount > currentBalance) ? '#9ca3af' : '#059669',
                color: '#ffffff',
                border: 'none',
                cursor: (submitting || enteredAmount <= 0 || enteredAmount > currentBalance) ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: (submitting || enteredAmount <= 0 || enteredAmount > currentBalance) ? 'none' : '0 1px 3px rgba(5, 150, 105, 0.4)'
              }}
            >
              <Check size={16} />
              <span>{submitting ? 'Saving Advance...' : 'Save Advance Payment'}</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
