import React, { useState, useEffect } from 'react';
import { apiFetch, apiUrl } from '../../api';

export default function StockMovementEditModal({
  isOpen,
  movement,
  onClose,
  onSuccess,
  user
}) {
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && movement) {
      setQuantity(String(Math.abs(movement.quantity ?? movement.rawQuantity ?? 0)));
      setReference(movement.reference && movement.reference !== '—' ? movement.reference : '');
      setReason('');
      setNotes(movement.notes || movement.remarks || '');
      setError('');
    }
  }, [isOpen, movement]);

  if (!isOpen || !movement) return null;

  const prodName = movement.productName || 'Product';
  const sku = movement.sku || movement.productCode || '—';
  const unit = (movement.unit && movement.unit !== 'Piece') ? movement.unit : 'Nos';
  const type = movement.type || 'STOCK IN';
  const origQty = Math.abs(movement.quantity ?? movement.rawQuantity ?? 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setError('Please enter a valid positive quantity.');
      return;
    }
    if (!reason.trim()) {
      setError('Correction reason is mandatory for audit trail compliance.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const url = apiUrl(`/api/stocks/movements/${encodeURIComponent(movement.movementId || movement.id)}`);
      const res = await apiFetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || 'USR-001',
          'x-user-name': user?.name || 'Admin'
        },
        body: JSON.stringify({
          quantity: numQty,
          reference: reference.trim() || undefined,
          reason: reason.trim(),
          notes: notes.trim() || undefined
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to apply movement correction.');
      }

      if (onSuccess) onSuccess(json);
      onClose();
    } catch (err) {
      console.error('Error correcting movement:', err);
      setError(err.message || 'Failed to apply correction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="crm-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        className="crm-modal-content"
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8fafc'
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
              Controlled Movement Correction
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
              ID: {movement.movementId || movement.id} • {type}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              color: '#94a3b8',
              cursor: 'pointer',
              lineHeight: 1
            }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Audit Compliance Notice */}
        <div
          style={{
            padding: '10px 20px',
            backgroundColor: '#eff6ff',
            borderBottom: '1px solid #bfdbfe',
            fontSize: '11.5px',
            color: '#1e40af',
            lineHeight: 1.4
          }}
        >
          <strong>Audit-Safe Correction:</strong> The original movement will be preserved in the audit log. A compensating reversal transaction and a corrected entry will be recorded, recalculating inventory balances.
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '16px 20px' }}>
          {error && (
            <div
              style={{
                marginBottom: '14px',
                padding: '9px 12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                color: '#dc2626',
                fontSize: '12px'
              }}
            >
              {error}
            </div>
          )}

          {/* Product & Current Info Box */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '14px',
              fontSize: '12px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: '#64748b' }}>Product:</span>
              <strong style={{ color: '#0f172a' }}>{prodName} ({sku})</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: '#64748b' }}>Movement Type:</span>
              <span style={{ fontWeight: 600, color: '#334155' }}>{type}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Recorded Quantity:</span>
              <strong>{origQty} {unit}</strong>
            </div>
          </div>

          {/* New Quantity */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Corrected Quantity ({unit}) <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="number"
              step="any"
              min="0.01"
              required
              className="crm-text-input"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={`Enter corrected quantity in ${unit}`}
              style={{ width: '100%', height: '36px', fontSize: '13px' }}
            />
          </div>

          {/* Reference */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Reference / Document No.
            </label>
            <input
              type="text"
              className="crm-text-input"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. CORR-INV-001, PO-1029"
              style={{ width: '100%', height: '36px', fontSize: '13px' }}
            />
          </div>

          {/* Reason for Correction (Mandatory) */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Reason for Correction <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              required
              className="crm-text-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Inward count mismatch, data entry correction"
              style={{ width: '100%', height: '36px', fontSize: '13px' }}
            />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Additional Audit Notes
            </label>
            <textarea
              className="crm-text-input"
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional remarks regarding this correction"
              style={{ width: '100%', fontSize: '12px', padding: '8px 10px' }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="crm-btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="crm-btn-primary"
              disabled={submitting}
              style={{ fontWeight: 600 }}
            >
              {submitting ? 'Applying Correction...' : 'Confirm Correction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
