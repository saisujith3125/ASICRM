import React, { useState, useRef, useEffect, useMemo, useId, forwardRef } from 'react';
import { Search, X, Truck } from 'lucide-react';
import { formatDate } from '../../utils/dateUtils';
import { filterRecordsBySearch } from '../../utils/searchHelper';
import './searchablePurchaseOrderSelect.css';

/**
 * SearchablePurchaseOrderSelect
 *
 * Clean, single-input searchable combobox for selecting a Purchase Order to receive.
 * - Single visible input with one border and NO dropdown arrow.
 * - Direct live type-to-search across PO ID, Supplier Name, Supplier Contact, Product Name, SKU.
 * - Auto-focus capable (cursor ready for immediate typing on page open).
 * - Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape, Tab).
 * - Clear (×) button on selection.
 */
const SearchablePurchaseOrderSelect = forwardRef(function SearchablePurchaseOrderSelect(
  {
    purchaseOrders = [],
    selectedPoId = '',
    onSelectPo,
    placeholder = 'Search purchase order, supplier, product, or PO number...',
    disabled = false,
    autoFocus = false,
    className = ''
  },
  forwardedRef
) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [displayValue, setDisplayValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const internalInputRef = useRef(null);
  const listboxRef = useRef(null);
  const instanceId = useId();
  const listboxId = `spos-listbox-${instanceId}`;

  // Sync ref with forwardedRef
  useEffect(() => {
    if (!forwardedRef) return;
    if (typeof forwardedRef === 'function') {
      forwardedRef(internalInputRef.current);
    } else {
      forwardedRef.current = internalInputRef.current;
    }
  }, [forwardedRef]);

  // Auto-focus on mount if requested
  useEffect(() => {
    if (autoFocus) {
      const doFocus = () => {
        if (internalInputRef.current && document.activeElement !== internalInputRef.current) {
          internalInputRef.current.focus();
        }
      };
      doFocus();
      const raf = requestAnimationFrame(doFocus);
      const timer = setTimeout(doFocus, 80);
      const timer2 = setTimeout(doFocus, 250);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
        clearTimeout(timer2);
      };
    }
  }, [autoFocus]);

  // Find currently selected PO
  const selectedPo = useMemo(() => {
    if (!selectedPoId) return null;
    return (
      purchaseOrders.find(
        (p) => p.id === selectedPoId || p.purchaseOrderId === selectedPoId
      ) || null
    );
  }, [purchaseOrders, selectedPoId]);

  // Sync display value when selected PO changes
  useEffect(() => {
    if (!isEditing) {
      if (selectedPo) {
        const supName = selectedPo.supplierSnapshot?.companyName || 'Supplier';
        setDisplayValue(`${selectedPo.id} — ${supName}`);
      } else {
        setDisplayValue('');
      }
    }
  }, [selectedPo, isEditing]);

  // Live filtering across PO fields
  const filteredPos = useMemo(() => {
    return filterRecordsBySearch(purchaseOrders, searchQuery, [
      (po) => po.id,
      (po) => po.purchaseOrderId,
      (po) => po.supplierSnapshot?.companyName,
      (po) => po.supplierSnapshot?.contactPerson,
      (po) => po.supplierSnapshot?.city,
      (po) => po.status,
      (po) => po.items?.map((it) => `${it.productName || ''} ${it.productCode || it.sku || ''}`)
    ]);
  }, [purchaseOrders, searchQuery]);

  // Reset highlight on search change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  // Close dropdown on global event
  useEffect(() => {
    const handleCloseAll = (e) => {
      if (e.detail?.id !== instanceId) {
        setIsOpen(false);
        setIsEditing(false);
        setSearchQuery('');
        if (selectedPo) {
          const supName = selectedPo.supplierSnapshot?.companyName || 'Supplier';
          setDisplayValue(`${selectedPo.id} — ${supName}`);
        } else {
          setDisplayValue('');
        }
      }
    };
    window.addEventListener('close-all-dropdowns', handleCloseAll);
    return () => window.removeEventListener('close-all-dropdowns', handleCloseAll);
  }, [instanceId, selectedPo]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsEditing(false);
        setSearchQuery('');
        if (selectedPo) {
          const supName = selectedPo.supplierSnapshot?.companyName || 'Supplier';
          setDisplayValue(`${selectedPo.id} — ${supName}`);
        } else {
          setDisplayValue('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedPo]);

  const openDropdown = () => {
    if (disabled) return;
    window.dispatchEvent(
      new CustomEvent('close-all-dropdowns', { detail: { id: instanceId } })
    );
    setIsEditing(true);
    setSearchQuery('');
    setIsOpen(true);
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setIsEditing(false);
    setSearchQuery('');
    if (selectedPo) {
      const supName = selectedPo.supplierSnapshot?.companyName || 'Supplier';
      setDisplayValue(`${selectedPo.id} — ${supName}`);
    } else {
      setDisplayValue('');
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setDisplayValue(val);
    setSearchQuery(val);
    if (!isOpen) {
      window.dispatchEvent(
        new CustomEvent('close-all-dropdowns', { detail: { id: instanceId } })
      );
      setIsOpen(true);
    }
  };

  const handleSelect = (po) => {
    if (onSelectPo) onSelectPo(po.id, po);
    const supName = po.supplierSnapshot?.companyName || 'Supplier';
    setDisplayValue(`${po.id} — ${supName}`);
    setIsEditing(false);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onSelectPo) onSelectPo('', null);
    setDisplayValue('');
    setSearchQuery('');
    setIsEditing(false);
    setIsOpen(false);
    if (internalInputRef.current) internalInputRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        openDropdown();
      } else if (filteredPos.length > 0) {
        setHighlightedIndex((prev) => {
          const next = prev < filteredPos.length - 1 ? prev + 1 : 0;
          scrollHighlightedIntoView(next);
          return next;
        });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        openDropdown();
      } else if (filteredPos.length > 0) {
        setHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : filteredPos.length - 1;
          scrollHighlightedIntoView(next);
          return next;
        });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && filteredPos[highlightedIndex]) {
        handleSelect(filteredPos[highlightedIndex]);
      } else if (!isOpen) {
        openDropdown();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeDropdown();
    } else if (e.key === 'Tab') {
      closeDropdown();
    }
  };

  const scrollHighlightedIntoView = (index) => {
    if (!listboxRef.current) return;
    const items = listboxRef.current.querySelectorAll('.spos-result-card');
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  };

  return (
    <div
      className={`searchable-po-select-wrap ${className}`}
      ref={containerRef}
    >
      <div
        className={`spos-input-box ${isOpen ? 'is-open' : ''} ${
          disabled ? 'disabled' : ''
        }`}
        onClick={() => {
          if (!disabled) {
            internalInputRef.current?.focus();
            if (!isOpen && (searchQuery || !selectedPo)) {
              openDropdown();
            }
          }
        }}
      >
        <Search size={16} className="spos-search-icon" />
        <input
          ref={internalInputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={isEditing ? searchQuery : displayValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className="spos-input"
        />

        <div className="spos-actions">
          {(selectedPo || searchQuery) && !disabled && (
            <button
              type="button"
              className="spos-clear-btn"
              onClick={handleClear}
              title="Clear selection"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Popover Dropdown Overlay */}
      {isOpen && (
        <div id={listboxId} role="listbox" className="spos-popover">
          <div className="spos-popover-header">
            <span>
              {filteredPos.length} purchase order
              {filteredPos.length === 1 ? '' : 's'} eligible for receipt
            </span>
          </div>

          <div className="spos-listbox" ref={listboxRef}>
            {filteredPos.length === 0 ? (
              <div className="spos-empty-state">
                <Truck size={24} style={{ color: '#94a3b8' }} />
                <div>{searchQuery.trim() ? `No purchase orders found matching "${searchQuery.trim()}"` : 'No purchase orders available.'}</div>
              </div>
            ) : (
              filteredPos.map((po, idx) => {
                const isSelected =
                  po.id === selectedPoId || po.purchaseOrderId === selectedPoId;
                const isHighlighted = idx === highlightedIndex;

                // Pending info calculations
                const items = Array.isArray(po.items) ? po.items : [];
                let pendingItemsCount = 0;
                let pendingUnitsTotal = 0;
                items.forEach((it) => {
                  const ord = Number(it.orderedQty || 0);
                  const rec = Number(it.receivedQty || 0);
                  const rem = Math.max(0, ord - rec);
                  if (rem > 0) {
                    pendingItemsCount += 1;
                    pendingUnitsTotal += rem;
                  }
                });

                const companyName =
                  po.supplierSnapshot?.companyName || 'Supplier';

                return (
                  <div
                    key={po.id || idx}
                    role="option"
                    aria-selected={isSelected}
                    className={`spos-result-card ${
                      isSelected ? 'selected' : ''
                    } ${isHighlighted ? 'highlighted' : ''}`}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(po);
                    }}
                  >
                    <div className="spos-card-top">
                      <span className="spos-card-poid">{po.id}</span>
                      {isSelected ? (
                        <span className="spos-card-badge selected-indicator">
                          Selected
                        </span>
                      ) : po.status === 'PARTIALLY_RECEIVED' ? (
                        <span className="spos-card-badge partially_received">
                          Partially Received
                        </span>
                      ) : (
                        <span className="spos-card-badge sent">Sent</span>
                      )}
                    </div>

                    <div
                      className="spos-card-supplier"
                      title={companyName}
                    >
                      {companyName}
                    </div>

                    <div className="spos-card-meta">
                      <span className="spos-card-pending-text">
                        {pendingItemsCount} pending item
                        {pendingItemsCount === 1 ? '' : 's'} •{' '}
                        {pendingUnitsTotal} unit
                        {pendingUnitsTotal === 1 ? '' : 's'} pending
                      </span>
                      <span className="spos-card-date">
                        Order Date: {formatDate(po.orderDate)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default SearchablePurchaseOrderSelect;
