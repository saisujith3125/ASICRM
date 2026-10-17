import React, { useState, useEffect } from 'react';
import { apiFetch, apiUrl } from '../../api';

export default function StockMovementVoidModal({
  isOpen,
  movement,
  onClose,
  onSuccess,
  user
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError('');
    }
  }, [isOpen, movement]);

  if (!isOpen || !movement) return null;

  const prodName = movement.productName || 'Product';
  const sku = movement.sku || movement.productCode || '—';
  const unit = (movement.unit && movement.unit !== 'Piece') ? movement.unit : 'Nos';
  const type = movement.type || 'STOCK IN';
  const origQty = Math.abs(movement.quantity ?? movement.rawQuantity ?? 0);
  const signedQty = Number(movement.quantity || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A valid reason is required to void this stock movement.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const url = apiUrl(`/api/stocks/movements/${encodeURIComponent(movement.movementId || movement.id)}`);
      const res = await apiFetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || 'USR-001',
          'x-user-name': user?.name || 'Admin'
        },
        body: JSON.stringify({
          reason: reason.trim()
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to void stock movement.');
      }

      if (onSuccess) onSuccess(json);
      onClose();
    } catch (err) {
      console.error('Error voiding stock movement:', err);
      setError(err.message || 'Failed to void movement.');
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
          maxWidth: '500px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #fee2e2',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#fef2f2'
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#991b1b' }}>
              Void Stock Movement
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#b91c1c' }}>
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

        {/* Audit Safety Warning */}
        <div
          style={{
            padding: '10px 20px',
            backgroundColor: '#fffbeb',
            borderBottom: '1px solid #fef3c7',
            fontSize: '11.5px',
            color: '#92400e',
            lineHeight: 1.4
          }}
        >
          <strong>Audit Trail Protection:</strong> This transaction will <em>NOT</em> be deleted from the database. An audit-safe <code>VOID_REVERSAL</code> entry will be created, and the product stock balance will be reversed.
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

          {/* Product & Movement Info Box */}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: '#64748b' }}>Quantity to Reverse:</span>
              <strong>{signedQty > 0 ? `+${signedQty}` : signedQty} {unit}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Compensating Adjustment:</span>
              <strong style={{ color: signedQty > 0 ? '#dc2626' : '#16a34a' }}>
                {signedQty > 0 ? `-${signedQty}` : `+${Math.abs(signedQty)}`} {unit}
              </strong>
            </div>
          </div>

          {/* Reason for Void (Mandatory) */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Reason for Voiding <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              required
              rows="3"
              className="crm-text-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate entry, incorrect warehouse selection, transaction cancelled by supervisor"
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
              style={{
                backgroundColor: '#dc2626',
                borderColor: '#dc2626',
                color: '#ffffff',
                fontWeight: 600
              }}
            >
              {submitting ? 'Voiding Movement...' : 'Confirm Void & Reversal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
