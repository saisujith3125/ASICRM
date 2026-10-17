import React from 'react';
import { Package, Check, AlertCircle } from 'lucide-react';

export default function ReturnItemsTable({ itemsState = [], onQtyChange, onToggleSerial }) {
  if (!itemsState || itemsState.length === 0) {
    return (
      <div className="dc-return-items-empty">
        <Package size={24} style={{ color: '#94a3b8', marginBottom: '4px' }} />
        <p>No consignment items found for this delivery challan.</p>
      </div>
    );
  }

  return (
    <div className="dc-return-items-table-wrapper">
      <table className="dc-table dc-return-items-table">
        <thead>
          <tr>
            <th style={{ width: '45%' }}>PRODUCT / PARTICULARS</th>
            <th style={{ width: '12%', textAlign: 'center' }}>SENT</th>
            <th style={{ width: '14%', textAlign: 'center' }}>ALREADY RETURNED</th>
            <th style={{ width: '13%', textAlign: 'center' }}>REMAINING</th>
            <th style={{ width: '16%', textAlign: 'center' }}>RETURN NOW</th>
          </tr>
        </thead>
        <tbody>
          {itemsState.map((it, idx) => {
            const hasSerials = Array.isArray(it.eligibleSerials) && it.eligibleSerials.length > 0;
            const serialMismatch = hasSerials && it.returnNowQty > 0 && it.selectedSerials.length !== it.returnNowQty;

            return (
              <tr key={it.productId || it.productCode || idx} className="dc-return-item-row">
                {/* 1. PRODUCT DETAILS & SERIALS */}
                <td>
                  <div className="dc-item-name-wrap">
                    <strong className="dc-item-product-name">{it.productName}</strong>
                    {it.productCode && (
                      <span className="dc-item-sku-badge">SKU: {it.productCode}</span>
                    )}
                  </div>
                  {it.productDetails && (
                    <div className="dc-item-details-sub">{it.productDetails}</div>
                  )}

                  {/* Serial Number Selector Chips if serialized */}
                  {hasSerials ? (
                    <div className="dc-item-serials-container">
                      <div className="dc-serials-header-row">
                        <span className="dc-serials-title">
                          Select Serials to Return:
                        </span>
                        <span className={`dc-serials-counter ${serialMismatch ? 'error' : 'ok'}`}>
                          {it.selectedSerials.length} of {it.returnNowQty} selected
                        </span>
                      </div>

                      <div className="dc-serials-grid">
                        {it.eligibleSerials.map((sn) => {
                          const isSelected = it.selectedSerials.includes(sn);
                          return (
                            <button
                              key={sn}
                              type="button"
                              className={`dc-serial-select-chip ${isSelected ? 'selected' : ''}`}
                              onClick={() => onToggleSerial(idx, sn)}
                              title={isSelected ? `Click to deselect ${sn}` : `Click to select ${sn}`}
                            >
                              <span className="dc-serial-check-icon">
                                {isSelected ? <Check size={11} strokeWidth={3} /> : null}
                              </span>
                              <span className="dc-serial-text">{sn}</span>
                            </button>
                          );
                        })}
                      </div>

                      {serialMismatch && (
                        <div className="dc-serials-warning">
                          <AlertCircle size={12} />
                          <span>
                            {it.selectedSerials.length < it.returnNowQty
                              ? `Please select ${it.returnNowQty - it.selectedSerials.length} more serial number(s).`
                              : `Please deselect ${it.selectedSerials.length - it.returnNowQty} serial number(s).`}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                      <span style={{ padding: '1px 6px', background: '#f8fafc', borderRadius: '3px', border: '1px solid #e2e8f0', fontWeight: 500 }}>
                        Non-serialized (Quantity return)
                      </span>
                    </div>
                  )}
                </td>

                {/* 2. SENT QUANTITY */}
                <td style={{ textAlign: 'center' }}>
                  <span className="dc-qty-pill sent">{it.sentQty}</span>
                </td>

                {/* 3. ALREADY RETURNED */}
                <td style={{ textAlign: 'center' }}>
                  <span className="dc-qty-pill already-returned">{it.alreadyReturnedQty}</span>
                </td>

                {/* 4. REMAINING */}
                <td style={{ textAlign: 'center' }}>
                  <span className={`dc-qty-pill remaining ${it.remainingQty > 0 ? 'amber' : 'green'}`}>
                    {it.remainingQty}
                  </span>
                </td>

                {/* 5. RETURN NOW INPUT */}
                <td style={{ textAlign: 'center' }}>
                  <div className="dc-return-now-input-group">
                    <input
                      type="number"
                      min="0"
                      max={it.remainingQty}
                      className={`dc-return-now-field ${it.returnNowQty > 0 ? 'active' : ''}`}
                      value={it.returnNowQty}
                      onChange={(e) => onQtyChange(idx, e.target.value)}
                      disabled={it.remainingQty <= 0}
                    />
                    <span className="dc-return-unit-label">Units</span>
                  </div>
                  {it.remainingQty <= 0 && (
                    <div className="dc-fully-returned-note">All returned</div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
