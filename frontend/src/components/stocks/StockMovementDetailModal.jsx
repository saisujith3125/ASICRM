import React from 'react';
import { formatDateTime } from '../../utils/dateUtils';

export default function StockMovementDetailModal({ movement, isOpen, onClose }) {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !movement) return null;

  const signedQty = Number(movement.quantity || 0);
  const isPositive = signedQty > 0;
  const isNegative = signedQty < 0;

  let badgeClass = 'badge-blue';
  if (movement.type === 'STOCK IN') badgeClass = 'badge-green';
  else if (movement.type === 'STOCK OUT') badgeClass = 'badge-rose';
  else if (movement.type === 'ADJUSTMENT') badgeClass = 'badge-amber';
  else if (movement.type === 'TRANSFER') badgeClass = 'badge-purple';
  else if (movement.type === 'RETURN') badgeClass = 'badge-blue';

  return (
    <div
      className="crm-modal-backdrop crm-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="movement-detail-title"
    >
      <div
        className="crm-modal-card stock-item-detail-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '600px', width: '94%' }}
      >
        <div className="crm-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 id="movement-detail-title" style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                Stock Movement Details
              </h3>
              <span className={`status-badge ${badgeClass}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
                {movement.type}
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
              Transaction ID: <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#1e293b' }}>{movement.movementId || movement.id}</span>
            </p>
          </div>
          <button
            type="button"
            className="crm-modal-close"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              border: 'none',
              background: '#f1f5f9',
              borderRadius: '6px',
              width: '32px',
              height: '32px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              cursor: 'pointer',
              color: '#475569'
            }}
          >
            ✕
          </button>
        </div>

        <div className="crm-modal-body" style={{ padding: '18px 20px', maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Product Header Card */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
              {movement.productName || 'Product'}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', display: 'flex', gap: '12px' }}>
              <span>SKU: <strong style={{ color: '#334155' }}>{movement.sku || movement.productCode || '—'}</strong></span>
              <span>Unit: <strong style={{ color: '#334155' }}>{(movement.unit && movement.unit !== 'Piece') ? movement.unit : 'Nos'}</strong></span>
            </div>
          </div>

          {/* Audit Metrics Strip: Stock Before -> Movement -> Stock After */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px', textAlign: 'center' }}>
            <div style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff' }}>
              <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Stock Before</span>
              <strong style={{ fontSize: '16px', color: '#0f172a', marginTop: '2px', display: 'block' }}>
                {movement.stockBefore !== null && movement.stockBefore !== undefined ? movement.stockBefore : '—'}
              </strong>
            </div>

            <div style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: isPositive ? '#f0fdf4' : (isNegative ? '#fef2f2' : '#f8fafc') }}>
              <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Quantity</span>
              <strong style={{ fontSize: '16px', color: isPositive ? '#16a34a' : (isNegative ? '#dc2626' : '#0f172a'), marginTop: '2px', display: 'block' }}>
                {isPositive ? `+${signedQty}` : `${signedQty}`} {(movement.unit && movement.unit !== 'Piece') ? movement.unit : 'Nos'}
              </strong>
            </div>

            <div style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff' }}>
              <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Stock After</span>
              <strong style={{ fontSize: '16px', color: '#0f172a', marginTop: '2px', display: 'block' }}>
                {movement.stockAfter !== null && movement.stockAfter !== undefined ? movement.stockAfter : '—'}
              </strong>
            </div>
          </div>

          {/* Financial Value Information */}
          {(movement.unitRate !== undefined && movement.unitRate !== null && Number(movement.unitRate) > 0) && (
            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                  Entered Stock Rate (Unit Cost)
                </span>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                  ₹{Number(movement.unitRate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#64748b', marginLeft: '4px' }}>
                    / {(movement.unit && movement.unit !== 'Piece') ? movement.unit : 'Nos'}
                  </span>
                </div>
              </div>

              {movement.totalValue !== undefined && movement.totalValue !== null && (
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                    Total Transaction Amount
                  </span>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
                    ₹{Number(movement.totalValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Detailed Audit Ledger Table */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '12.5px' }}>
            <div>
              <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Date &amp; Time</span>
              <div style={{ color: '#0f172a', fontWeight: 600, marginTop: '2px' }}>
                {formatDateTime(movement.date || movement.createdAt)}
              </div>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Recorded By</span>
              <div style={{ color: '#0f172a', fontWeight: 600, marginTop: '2px' }}>
                {movement.user || movement.createdBy || 'System'}
              </div>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Reference</span>
              <div style={{ color: '#0f172a', fontWeight: 600, marginTop: '2px', fontFamily: 'monospace' }}>
                {movement.reference || movement.referenceId || '—'}
              </div>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Movement Type</span>
              <div style={{ color: '#0f172a', fontWeight: 600, marginTop: '2px' }}>
                {movement.type}
              </div>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Source Location</span>
              <div style={{ color: '#0f172a', marginTop: '2px' }}>
                {movement.source || '—'}
              </div>
            </div>

            <div>
              <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Destination Location</span>
              <div style={{ color: '#0f172a', marginTop: '2px' }}>
                {movement.destination || '—'}
              </div>
            </div>
          </div>

          {/* Medical Store Style Picking Bin & Storage Location */}
          {(movement.binLocation || movement.warehouseName || movement.box) && (
            <div style={{ marginTop: '14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>🏥</span> Storage &amp; Picking Coordinate (Floor › Rack › Shelf › Box)
                </span>
                {movement.locationCode && (
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    {movement.locationCode}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#14532d' }}>
                📍 {movement.binLocation || `${movement.warehouseName || 'Warehouse'} › ${movement.floor || 'Floor'} › ${movement.rack || 'Rack'} › ${movement.shelf || 'Shelf'} › ${movement.box || 'Box'}`}
              </div>
              <div style={{ fontSize: '11px', color: '#15803d', marginTop: '3px' }}>
                Fast item retrieval: Staff can locate this stock in {movement.box || 'designated box'} on {movement.shelf || 'shelf'} of {movement.rack || 'rack'}, {movement.floor || 'floor'}.
              </div>
            </div>
          )}

          {/* Reason */}
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>
              Reason / Justification
            </span>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', fontSize: '12.5px', color: '#1e293b' }}>
              {movement.reason || movement.remarks || 'No reason specified'}
            </div>
          </div>

          {/* Notes */}
          {movement.notes && (
            <div style={{ marginTop: '12px' }}>
              <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>
                Audit Notes
              </span>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#475569', fontStyle: 'italic' }}>
                {movement.notes}
              </div>
            </div>
          )}

          {/* Serial Numbers (if serialized) */}
          {Array.isArray(movement.serialNumbers) && movement.serialNumbers.length > 0 && (
            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>
                Allocated Serial Numbers ({movement.serialNumbers.length})
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {movement.serialNumbers.map((sn, idx) => (
                  <span key={idx} style={{ fontFamily: 'monospace', fontSize: '11px', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '4px', color: '#0f172a' }}>
                    {sn}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="crm-modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={onClose}
            style={{ height: '34px', padding: '0 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
