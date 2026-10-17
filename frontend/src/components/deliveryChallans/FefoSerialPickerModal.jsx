import React, { useState, useEffect, useMemo } from 'react';
import { X, Clock, AlertTriangle, CheckCircle2, Sparkles, ShieldCheck, Search, Filter } from 'lucide-react';

function formatFefoDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const clean = String(dateStr).split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d}/${m}/${y}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export default function FefoSerialPickerModal({
  isOpen,
  row,
  allPool = [],
  metaMap = {},
  onClose,
  onApply
}) {
  const [selectedSerials, setSelectedSerials] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'SELECTED' | 'RECOMMENDED'

  const dQty = Number(row?.deliveryQty || 1);

  // Initialize selected serials from row.serialNumbers
  useEffect(() => {
    if (isOpen && row) {
      const current = Array.isArray(row.serialNumbers) ? row.serialNumbers : [];
      if (current.length > 0) {
        setSelectedSerials(current);
      } else {
        // Auto-allocate top FEFO serials
        setSelectedSerials(allPool.slice(0, dQty));
      }
      setSearchQuery('');
      setFilterMode('ALL');
    }
  }, [isOpen, row, allPool, dQty]);

  // Filtered pool based on search query and filter pills
  const filteredPool = useMemo(() => {
    let list = allPool;
    if (filterMode === 'SELECTED') {
      list = list.filter((sn) => selectedSerials.includes(sn));
    } else if (filterMode === 'RECOMMENDED') {
      list = list.slice(0, dQty);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((sn) => {
        const meta = metaMap[sn] || {};
        return (
          sn.toLowerCase().includes(q) ||
          String(meta.inwardDate || '').toLowerCase().includes(q) ||
          String(meta.expiryDate || '').toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [allPool, selectedSerials, dQty, filterMode, searchQuery, metaMap]);

  if (!isOpen || !row) return null;

  const handleToggle = (sn) => {
    setSelectedSerials((prev) => {
      if (prev.includes(sn)) {
        return prev.filter((s) => s !== sn);
      }
      if (prev.length >= dQty) {
        // Replace oldest manual pick or append
        return [...prev.slice(1), sn];
      }
      return [...prev, sn];
    });
  };

  const handleSelectFefo = () => {
    setSelectedSerials(allPool.slice(0, dQty));
  };

  const handleClear = () => {
    setSelectedSerials([]);
  };

  const handleConfirm = () => {
    if (selectedSerials.length !== dQty) {
      alert(`Please select exactly ${dQty} serial number(s) to match the delivery quantity.`);
      return;
    }
    onApply(selectedSerials);
  };

  // Check if user chose newer stock while older stock is left unselected
  const unselectedOlderUnits = allPool.filter((sn) => {
    if (selectedSerials.includes(sn)) return false;
    const thisMeta = metaMap[sn];
    if (!thisMeta) return false;
    const thisExp = new Date(thisMeta.expiryDate || '2099-12-31').getTime();
    return selectedSerials.some((selSn) => {
      const selMeta = metaMap[selSn];
      if (!selMeta) return false;
      const selExp = new Date(selMeta.expiryDate || '2099-12-31').getTime();
      return selExp > thisExp;
    });
  });

  const hasDeviation = unselectedOlderUnits.length > 0;
  const isMatch = selectedSerials.length === dQty;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '1020px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
          overflow: 'hidden',
          border: '1px solid #cbd5e1'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 26px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.1)'
              }}
            >
              <Clock size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
                  FEFO Serial Allocation
                </h3>
                <span
                  style={{
                    background: '#dcfce7',
                    color: '#15803d',
                    border: '1px solid #bbf7d0',
                    borderRadius: '20px',
                    padding: '2px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase'
                  }}
                >
                  <Sparkles size={12} /> First Expired, First Out
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Product: <strong style={{ color: '#1e293b' }}>{row.productName}</strong>
                {row.productCode && <span> ({row.productCode})</span>}
                &nbsp;&bull;&nbsp;
                Delivery Qty: <strong style={{ color: '#2563eb' }}>{dQty} Nos</strong>
                &nbsp;&bull;&nbsp;
                In Stock: <strong style={{ color: '#0f172a' }}>{allPool.length} Units</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              color: '#64748b',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Protection Banner */}
        <div
          style={{
            padding: '10px 26px',
            background: '#f0fdf4',
            borderBottom: '1px solid #bbf7d0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <ShieldCheck size={18} color="#16a34a" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: '12.5px', color: '#166534', lineHeight: 1.45 }}>
            <strong>Smart Inventory Protection:</strong> Units with the earliest expiry or warranty date (e.g. 6 months left) are prioritized before newer stock (e.g. 12 months left) to prevent aging dead stock in the warehouse.
          </div>
        </div>

        {/* Deviation Warning if staff manually selected newer unit over older unit */}
        {hasDeviation && (
          <div
            style={{
              padding: '10px 26px',
              background: '#fffbeb',
              borderBottom: '1px solid #fde68a',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '12.5px', color: '#b45309', lineHeight: 1.4 }}>
              <strong>Notice:</strong> An older unit (<strong>{unselectedOlderUnits[0]}</strong> - expires sooner) is available. FEFO recommends dispatching older units first.
            </div>
          </div>
        )}

        {/* Toolbar: Search, Filters, and Auto-Allocate Action */}
        <div
          style={{
            padding: '12px 26px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          {/* Left: Search input */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search serial number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 32px',
                fontSize: '12.5px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                outline: 'none',
                background: '#f8fafc',
                color: '#0f172a'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Center: Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid',
                cursor: 'pointer',
                background: filterMode === 'ALL' ? '#0f172a' : '#f8fafc',
                color: filterMode === 'ALL' ? '#ffffff' : '#64748b',
                borderColor: filterMode === 'ALL' ? '#0f172a' : '#cbd5e1'
              }}
            >
              All ({allPool.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('SELECTED')}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid',
                cursor: 'pointer',
                background: filterMode === 'SELECTED' ? '#2563eb' : '#f8fafc',
                color: filterMode === 'SELECTED' ? '#ffffff' : '#64748b',
                borderColor: filterMode === 'SELECTED' ? '#2563eb' : '#cbd5e1'
              }}
            >
              Selected ({selectedSerials.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('RECOMMENDED')}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid',
                cursor: 'pointer',
                background: filterMode === 'RECOMMENDED' ? '#16a34a' : '#f8fafc',
                color: filterMode === 'RECOMMENDED' ? '#ffffff' : '#64748b',
                borderColor: filterMode === 'RECOMMENDED' ? '#16a34a' : '#cbd5e1'
              }}
            >
              FEFO Top {dQty}
            </button>
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleSelectFefo}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#1d4ed8',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(37, 99, 235, 0.05)',
                transition: 'all 0.15s ease'
              }}
            >
              <Sparkles size={14} /> Auto-Select FEFO (Oldest First)
            </button>
            <button
              type="button"
              onClick={handleClear}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 500,
                color: '#64748b',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Serials Table with Sticky Header */}
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '440px', padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 20,
                  background: '#f8fafc',
                  borderBottom: '2px solid #cbd5e1',
                  color: '#475569',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}
              >
                <th style={{ padding: '12px 14px', width: '54px', textAlign: 'center', background: '#f8fafc' }}>
                  Select
                </th>
                <th style={{ padding: '12px 14px', width: '60px', textAlign: 'center', background: '#f8fafc' }}>
                  Rank
                </th>
                <th style={{ padding: '12px 16px', minWidth: '220px', background: '#f8fafc' }}>
                  Serial Number
                </th>
                <th style={{ padding: '12px 16px', width: '120px', whiteSpace: 'nowrap', background: '#f8fafc' }}>
                  Inward Date
                </th>
                <th style={{ padding: '12px 16px', width: '130px', whiteSpace: 'nowrap', background: '#f8fafc' }}>
                  Expiry / Warranty
                </th>
                <th style={{ padding: '12px 16px', width: '140px', whiteSpace: 'nowrap', background: '#f8fafc' }}>
                  Shelf-Life Left
                </th>
                <th style={{ padding: '12px 16px', width: '230px', minWidth: '230px', whiteSpace: 'nowrap', background: '#f8fafc' }}>
                  FEFO Priority
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredPool.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                      No serial numbers match your filter
                    </div>
                    <div style={{ fontSize: '12px' }}>
                      Try adjusting your search query or reset the filter to &ldquo;All&rdquo;.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPool.map((sn) => {
                  const globalIdx = allPool.indexOf(sn);
                  const isChecked = selectedSerials.includes(sn);
                  const meta = metaMap[sn] || {};
                  const m = meta.monthsRemaining !== undefined ? meta.monthsRemaining : null;
                  const isTopPick = globalIdx === 0;
                  const isRecommended = globalIdx < dQty;

                  return (
                    <tr
                      key={sn}
                      onClick={() => handleToggle(sn)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        background: isChecked ? '#f0fdf4' : (globalIdx % 2 === 0 ? '#ffffff' : '#fafafa'),
                        borderLeft: isChecked ? '4px solid #16a34a' : '4px solid transparent',
                        transition: 'background 0.12s ease'
                      }}
                    >
                      {/* Checkbox */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggle(sn)}
                          style={{
                            width: '17px',
                            height: '17px',
                            cursor: 'pointer',
                            accentColor: '#16a34a'
                          }}
                        />
                      </td>

                      {/* Rank */}
                      <td style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            background: isTopPick ? '#eff6ff' : '#f1f5f9',
                            color: isTopPick ? '#2563eb' : '#64748b',
                            border: `1px solid ${isTopPick ? '#bfdbfe' : '#e2e8f0'}`
                          }}
                        >
                          #{globalIdx + 1}
                        </span>
                      </td>

                      {/* Serial Number */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                            fontSize: '12.5px',
                            fontWeight: 600,
                            color: '#0f172a',
                            background: '#f8fafc',
                            padding: '3px 8px',
                            borderRadius: '5px',
                            border: '1px solid #e2e8f0',
                            letterSpacing: '0.02em',
                            display: 'inline-block'
                          }}
                        >
                          {sn}
                        </span>
                      </td>

                      {/* Inward Date */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap', color: '#475569', fontSize: '12.5px', fontWeight: 500 }}>
                        {formatFefoDate(meta.inwardDate)}
                      </td>

                      {/* Expiry / Warranty Date */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap', color: '#1e293b', fontSize: '12.5px', fontWeight: 600 }}>
                        {formatFefoDate(meta.expiryDate)}
                      </td>

                      {/* Shelf Life Left */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {m !== null ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '3px 9px',
                              borderRadius: '20px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              background: m <= 3 ? '#fef2f2' : m <= 6 ? '#fef3c7' : '#eff6ff',
                              color: m <= 3 ? '#b91c1c' : m <= 6 ? '#b45309' : '#1d4ed8',
                              border: `1px solid ${m <= 3 ? '#fecaca' : m <= 6 ? '#fde68a' : '#bfdbfe'}`
                            }}
                          >
                            {m <= 3 ? `🚨 ${m} mos left` : m <= 6 ? `⚠️ ${m} mos left` : `✓ ${m} mos left`}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* FEFO Priority Badge */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        {isTopPick ? (
                          <span
                            style={{
                              padding: '3px 9px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              background: '#ecfdf5',
                              color: '#047857',
                              border: '1px solid #a7f3d0',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <CheckCircle2 size={13} /> ★ Priority 1 (Earliest Expiry)
                          </span>
                        ) : isChecked ? (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <CheckCircle2 size={12} /> Selected for Delivery
                          </span>
                        ) : isRecommended ? (
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              background: '#f8fafc',
                              color: '#475569',
                              border: '1px solid #cbd5e1'
                            }}
                          >
                            FEFO Recommended Pick
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '11px',
                              color: '#94a3b8',
                              fontWeight: 500,
                              padding: '2px 6px',
                              background: '#f8fafc',
                              borderRadius: '4px'
                            }}
                          >
                            Newer Stock (Reserve)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 26px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#475569' }}>
              Allocating:
            </span>
            <span
              style={{
                fontSize: '12.5px',
                fontWeight: 700,
                padding: '2px 10px',
                borderRadius: '12px',
                background: isMatch ? '#dcfce7' : '#fee2e2',
                color: isMatch ? '#15803d' : '#b91c1c',
                border: `1px solid ${isMatch ? '#bbf7d0' : '#fecaca'}`
              }}
            >
              {selectedSerials.length} of {dQty} Nos {isMatch ? '✓ Complete' : `(Need ${Math.abs(dQty - selectedSerials.length)} more)`}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#475569',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              style={{
                padding: '8px 22px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#ffffff',
                background: isMatch ? '#2563eb' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                cursor: isMatch ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: isMatch ? '0 2px 4px rgba(37, 99, 235, 0.3)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <CheckCircle2 size={16} />
              Apply Selection ({selectedSerials.length}/{dQty})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
