import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch, apiUrl } from '../../api';
import { formatDateTime } from '../../utils/dateUtils';
import StockMovementDetailModal from './StockMovementDetailModal';

export default function StockMovementHistoryModal({ isOpen, onClose, user, initialProductId = '' }) {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [productFilter, setProductFilter] = useState(initialProductId || 'ALL');
  const [selectedMovement, setSelectedMovement] = useState(null);
  const [expandedTxnIds, setExpandedTxnIds] = useState(new Set());

  const toggleTxnId = (id) => {
    setExpandedTxnIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const fetchMovements = async () => {
    if (!isOpen) return;
    setLoading(true);
    setError('');
    try {
      let url = apiUrl('/api/stocks/movements?limit=300');
      const res = await apiFetch(url, {
        headers: { 'x-user-id': user?.id || 'USR-001' }
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to load stock movements.');
      }
      setMovements(json.data || []);
    } catch (err) {
      console.error('Error fetching stock movements:', err);
      setError(err.message || 'Unable to load stock ledger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialProductId) setProductFilter(initialProductId);
      fetchMovements();
    }
  }, [isOpen, initialProductId]);

  const uniqueProducts = useMemo(() => {
    const map = new Map();
    (movements || []).forEach((m) => {
      if (m.productId && !map.has(m.productId)) {
        map.set(m.productId, { id: m.productId, name: m.productName, sku: m.sku || m.productCode });
      }
    });
    return Array.from(map.values());
  }, [movements]);

  const filteredMovements = useMemo(() => {
    let list = [...movements];

    if (typeFilter !== 'ALL') {
      list = list.filter((m) => {
        const mType = String(m.type || '').toUpperCase();
        if (typeFilter === 'RETURN') return mType === 'RETURN' || mType === 'RETURNED';
        if (typeFilter === 'ADJUSTMENT') return mType === 'ADJUSTMENT' || mType === 'ADJUSTED';
        return mType === typeFilter;
      });
    }

    if (productFilter !== 'ALL') {
      list = list.filter((m) => String(m.productId) === String(productFilter) || String(m.sku) === String(productFilter));
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) =>
        (m.productName && m.productName.toLowerCase().includes(q)) ||
        (m.sku && m.sku.toLowerCase().includes(q)) ||
        (m.reference && m.reference.toLowerCase().includes(q)) ||
        (m.movementId && m.movementId.toLowerCase().includes(q)) ||
        (m.user && m.user.toLowerCase().includes(q)) ||
        (m.reason && m.reason.toLowerCase().includes(q)) ||
        (m.source && m.source.toLowerCase().includes(q)) ||
        (m.destination && m.destination.toLowerCase().includes(q))
      );
    }

    return list;
  }, [movements, typeFilter, productFilter, search]);

  if (!isOpen) return null;

  const getTypeBadge = (type) => {
    let badgeClass = 'badge-blue';
    if (type === 'STOCK IN') badgeClass = 'badge-green';
    else if (type === 'STOCK OUT') badgeClass = 'badge-rose';
    else if (type === 'ADJUSTMENT') badgeClass = 'badge-amber';
    else if (type === 'TRANSFER') badgeClass = 'badge-purple';
    else if (type === 'RETURN') badgeClass = 'badge-blue';
    return <span className={`status-badge ${badgeClass}`}>{type}</span>;
  };

  return (
    <>
      <div className="crm-modal-backdrop crm-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="history-modal-title">
        <div className="crm-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1080px', width: '96%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div className="crm-modal-header" style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 id="history-modal-title" style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                Stock Movement Ledger
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                Complete immutable audit history of inventory transactions and balance adjustments.
              </p>
            </div>
            <button
              type="button"
              className="crm-modal-close"
              onClick={onClose}
              aria-label="Close modal"
              style={{ border: 'none', background: 'none', fontSize: '22px', cursor: 'pointer', color: '#64748b' }}
            >
              ✕
            </button>
          </div>

          {/* Filter Toolbar */}
          <div style={{ padding: '14px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', flex: '1 1 auto' }}>
              <input
                type="search"
                placeholder="Search by product, SKU, reference, user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ height: '34px', minWidth: '240px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '12.5px', background: '#fff' }}
              />

              {/* Movement Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{ height: '34px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px', background: '#fff' }}
              >
                <option value="ALL">All Types</option>
                <option value="STOCK IN">STOCK IN</option>
                <option value="STOCK OUT">STOCK OUT</option>
                <option value="RETURN">RETURN</option>
                <option value="ADJUSTMENT">ADJUSTMENT</option>
                <option value="TRANSFER">TRANSFER</option>
              </select>

              {/* Product Filter */}
              {uniqueProducts.length > 0 && (
                <select
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  style={{ height: '34px', maxWidth: '220px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12px', background: '#fff' }}
                >
                  <option value="ALL">All Products</option>
                  {uniqueProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className="crm-btn-secondary compact"
                onClick={fetchMovements}
                disabled={loading}
                style={{ height: '34px', padding: '0 12px', fontSize: '12px' }}
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Showing <strong>{filteredMovements.length}</strong> transactions
              </span>
            </div>
          </div>

          {/* Table Container */}
          <div style={{ flex: '1 1 auto', overflowY: 'auto', overflowX: 'auto', padding: '0' }}>
            {error && (
              <div style={{ padding: '16px 24px', background: '#fef2f2', color: '#b91c1c', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <table className="crm-data-table settings-table" style={{ width: '100%', minWidth: '850px', margin: 0, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '150px' }} />
                <col />
                <col style={{ width: '110px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '100px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '80px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>DATE / TIME</th>
                  <th>PRODUCT</th>
                  <th>TYPE</th>
                  <th style={{ textAlign: 'right' }}>QUANTITY</th>
                  <th style={{ textAlign: 'right' }}>AMOUNT</th>
                  <th>REFERENCE</th>
                  <th>USER</th>
                  <th style={{ textAlign: 'right' }}>STOCK AFTER</th>
                  <th style={{ textAlign: 'center' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.length > 0 ? (
                  filteredMovements.map((m) => {
                    const signedQty = Number(m.quantity || 0);
                    const isPos = signedQty > 0;
                    const isNeg = signedQty < 0;

                    return (
                      <tr
                        key={m.id || m.movementId}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedMovement(m)}
                        title="Click to view full movement audit details"
                      >
                        <td style={{ fontSize: '11.5px', color: '#64748b' }}>
                          <div style={{ whiteSpace: 'nowrap', fontWeight: 500, color: '#1e293b' }}>{formatDateTime(m.date || m.createdAt)}</div>
                          {(m.id || m.movementId) ? (
                            <div style={{ marginTop: '3px' }} onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTxnId(m.id || m.movementId);
                                }}
                                title={expandedTxnIds.has(m.id || m.movementId) ? "Click to collapse Transaction ID" : "Click to view full Transaction ID"}
                                aria-expanded={expandedTxnIds.has(m.id || m.movementId)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '10px',
                                  fontWeight: 500,
                                  padding: '1px 5px',
                                  background: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '4px',
                                  color: '#475569',
                                  cursor: 'pointer',
                                  lineHeight: 1.3,
                                  userSelect: 'none',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <span>Transaction ID {expandedTxnIds.has(m.id || m.movementId) ? '▲' : '▼'}</span>
                              </button>
                              {expandedTxnIds.has(m.id || m.movementId) && (
                                <div
                                  style={{
                                    marginTop: '3px',
                                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                    fontSize: '10px',
                                    fontWeight: 500,
                                    color: '#1e293b',
                                    background: '#f8fafc',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    padding: '2px 5px',
                                    lineHeight: 1.3,
                                    wordBreak: 'break-all',
                                    overflowWrap: 'anywhere',
                                    whiteSpace: 'normal',
                                    maxWidth: '100%',
                                    boxSizing: 'border-box'
                                  }}
                                >
                                  {m.id || m.movementId}
                                </div>
                              )}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '12.5px' }}>
                            {m.productName}
                          </div>
                          <small style={{ color: '#64748b', fontSize: '11px', fontFamily: 'monospace' }}>
                            {m.sku || m.productCode}
                          </small>
                        </td>
                        <td>{getTypeBadge(m.type)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '12.5px', color: isPos ? '#16a34a' : (isNeg ? '#dc2626' : '#0f172a') }}>
                          {isPos ? `+${signedQty}` : `${signedQty}`} {(m.unit && m.unit !== 'Piece') ? m.unit : 'Nos'}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '12px' }}>
                          {m.unitRate !== undefined && m.unitRate !== null && Number(m.unitRate) > 0 ? (
                            <div>
                              <div style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                                ₹{Number(m.unitRate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              {m.totalValue !== undefined && m.totalValue !== null && Math.abs(signedQty) > 1 && (
                                <div style={{ fontSize: '10.5px', color: '#64748b', whiteSpace: 'nowrap', marginTop: '1px' }}>
                                  Total: ₹{Number(m.totalValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '11.5px', color: '#475569' }}>
                          {m.reference || m.referenceId || '—'}
                        </td>
                        <td style={{ fontSize: '12px', color: '#334155' }}>
                          {m.user || m.createdBy || 'System'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#0f172a', fontSize: '12.5px' }}>
                          {m.stockAfter !== null && m.stockAfter !== undefined ? m.stockAfter : '—'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="crm-btn-subtle compact"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMovement(m);
                            }}
                            style={{ fontSize: '11px', padding: '3px 8px' }}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                      {loading ? 'Loading movements...' : 'No stock movement records match the selected filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="crm-modal-footer" style={{ padding: '12px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="crm-btn-secondary"
              onClick={onClose}
              style={{ height: '36px', padding: '0 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Movement Audit Detail Modal */}
      {selectedMovement && (
        <StockMovementDetailModal
          movement={selectedMovement}
          isOpen={Boolean(selectedMovement)}
          onClose={() => setSelectedMovement(null)}
        />
      )}
    </>
  );
}
