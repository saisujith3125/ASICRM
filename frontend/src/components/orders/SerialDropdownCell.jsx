import React, { useState, useRef, useEffect } from 'react';
import { Barcode, RefreshCw, Trash2, Plus, Check, AlertTriangle } from 'lucide-react';
import './SerialDropdownCell.css';

/**
 * SerialDropdownCell: Replaces cramped text input with a dedicated
 * interactive pill trigger and floating popover card styled after
 * the Quotation Items dropdown.
 */
function isCableItem(item) {
  if (!item) return false;
  const name = String(item.name || item.productName || item.productDetails || item.description || '').toLowerCase();
  const code = String(item.code || item.sku || item.productCode || '').toLowerCase();
  const cat = String(item.category || item.categoryName || item.categoryId || '').toLowerCase();
  const subcat = String(item.subcategory || item.subcategoryName || item.subcategoryId || '').toLowerCase();
  if (cat === 'cat-000004' || cat.includes('cable')) return true;
  if (subcat.includes('cable')) return true;
  if (name.includes('cable') || name.includes('cat 6') || name.includes('cat6') || name.includes('patch cord') || name.includes('fiber cable')) return true;
  if (code === 'asi-18' || code === 'prod-000041' || code.includes('cable')) return true;
  const unit = String(item.unit || '').toLowerCase();
  if ((unit === 'meter' || unit === 'roll') && (name.includes('wire') || name.includes('cable'))) return true;
  return false;
}

export default function SerialDropdownCell({
  row,
  rowIndex,
  isOpen,
  onToggle,
  onClose,
  onUpdateSerials,
  onOpenModal,
  onAutoFetch,
  disabled = false,
  isNearBottom = false
}) {
  const [quickInput, setQuickInput] = useState('');
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const isCable = isCableItem(row);
  const isEmptyRow = !row?.productId && !row?.productName && (!row?.serialNumbers || row?.serialNumbers.length === 0);

  const handleRemove = (sIdx) => {
    const raw = Array.isArray(row?.serialNumbers) ? row.serialNumbers : [];
    const current = raw.map((s) => String(s).trim()).filter(Boolean);
    const updated = current.filter((_, i) => i !== sIdx);
    onUpdateSerials?.(updated);
  };

  const handleAddQuick = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const val = quickInput.trim();
    if (!val) return;
    const raw = Array.isArray(row?.serialNumbers) ? row.serialNumbers : [];
    const current = raw.map((s) => String(s).trim()).filter(Boolean);
    if (current.includes(val)) {
      setQuickInput('');
      return;
    }
    const updated = [...current, val];
    onUpdateSerials?.(updated);
    setQuickInput('');
  };

  if (isEmptyRow || isCable) {
    return (
      <div
        style={{
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontSize: '12px'
        }}
        title={isCable ? 'Cables do not track serial numbers' : 'No product selected'}
      >
        —
      </div>
    );
  }

  const qty = Math.max(1, Number(row?.quantity || 1));
  const rawSerials = Array.isArray(row?.serialNumbers) ? row.serialNumbers : [];
  const serials = rawSerials.map((s) => String(s).trim()).filter(Boolean);
  const serialCount = serials.length;
  const isSerialized = Boolean(row?.isSerialized || serialCount > 0);
  const isComplete = isSerialized && serialCount >= qty;
  const isMismatch = isSerialized && serialCount > 0 && serialCount < qty;

  // Determine trigger label and class
  let statusClass = 'status-empty';
  let triggerIcon = null;
  let triggerText = '';

  if (!isSerialized) {
    triggerText = 'Standard Item';
  } else if (isComplete) {
    statusClass = 'status-complete';
    triggerIcon = <Check size={12} strokeWidth={2.5} style={{ marginRight: '4px' }} />;
    triggerText = `${serialCount} ${serialCount === 1 ? 'Serial' : 'Serials'}`;
  } else if (isMismatch) {
    statusClass = 'status-mismatch';
    triggerIcon = <AlertTriangle size={12} strokeWidth={2.5} style={{ marginRight: '4px' }} />;
    triggerText = `${serialCount} / ${qty} Serials`;
  } else {
    // isZero
    statusClass = 'status-empty';
    triggerText = `0 / ${qty} Serials`;
  }

  return (
    <div className="serial-dropdown-wrapper" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`serial-dropdown-trigger ${isOpen ? 'active' : ''} ${statusClass}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle?.();
        }}
        disabled={disabled}
        aria-expanded={isOpen}
        title={isSerialized ? `Serial Numbers: ${serials.join(', ') || 'None assigned'}` : 'Item is not tracked by serial number'}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {triggerIcon}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{triggerText}</span>
        </span>
        <span className="serial-dropdown-arrow" aria-hidden="true">
          {isOpen ? '▴' : '▾'}
        </span>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className={`serial-dropdown-popover ${isNearBottom ? 'placement-top' : ''}`}
          role="dialog"
          aria-label="Serial Numbers"
          onClick={(e) => e.stopPropagation()}
        >
          {/* HEADER */}
          <div className="serial-dropdown-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>
                {serialCount} SERIAL {serialCount === 1 ? 'NUMBER' : 'NUMBERS'}
              </span>
              {isSerialized && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: isComplete ? '#ecfdf5' : '#fffbeb',
                    color: isComplete ? '#059669' : '#d97706',
                    textTransform: 'none'
                  }}
                >
                  {isComplete ? 'Complete' : `${serialCount}/${qty}`}
                </span>
              )}
            </div>
            <button
              type="button"
              className="serial-dropdown-close"
              onClick={(e) => {
                e.stopPropagation();
                onClose?.();
              }}
              title="Close"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* SERIAL NUMBERS LIST */}
          {serialCount > 0 ? (
            <ul className="serial-dropdown-list">
              {serials.map((sn, sIdx) => (
                <li key={sIdx} className="serial-dropdown-item">
                  <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden' }}>
                    <span className="serial-item-idx">#{sIdx + 1}</span>
                    <span className="serial-item-code" title={sn}>{sn}</span>
                  </div>
                  <button
                    type="button"
                    className="serial-item-del"
                    onClick={() => handleRemove(sIdx)}
                    title="Remove this serial number"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ padding: '10px 0', fontSize: '11.5px', color: '#64748b', textAlign: 'center', fontStyle: 'italic' }}>
              {isSerialized ? 'No serial numbers assigned yet.' : 'Item is currently set as non-serialized.'}
            </div>
          )}

          {/* QUICK SCAN / ADD INPUT */}
          <form onSubmit={handleAddQuick} className="serial-quick-add">
            <input
              type="text"
              className="serial-quick-input"
              placeholder="Scan / type serial..."
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddQuick();
                }
              }}
            />
            <button
              type="button"
              className="serial-quick-add-btn"
              onClick={handleAddQuick}
              disabled={!quickInput.trim()}
              title="Add Serial Number"
            >
              <Plus size={12} strokeWidth={3} style={{ marginRight: '2px', verticalAlign: 'middle' }} /> Add
            </button>
          </form>

          {/* FOOTER ACTIONS */}
          <div className="serial-dropdown-actions">
            <div style={{ display: 'flex', gap: '5px' }}>
              {onAutoFetch && (
                <button
                  type="button"
                  className="serial-action-btn primary"
                  onClick={() => onAutoFetch?.()}
                  title="Auto-fetch available serial numbers from stock"
                >
                  <RefreshCw size={11} /> Auto-fetch
                </button>
              )}
              {onOpenModal && (
                <button
                  type="button"
                  className="serial-action-btn"
                  onClick={() => {
                    onClose?.();
                    onOpenModal?.();
                  }}
                  title="Open full Serial Number Modal (Barcode Scanner / Bulk Input)"
                >
                  <Barcode size={12} /> Modal
                </button>
              )}
            </div>

            {serialCount > 0 && (
              <button
                type="button"
                className="serial-action-btn danger"
                onClick={() => onUpdateSerials?.([])}
                title="Clear all serial numbers for this row"
              >
                <Trash2 size={11} /> Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
