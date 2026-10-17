import React, { useState, useRef, useEffect, useMemo, useId } from 'react';
import { ChevronDown, X, Check, ShoppingBag, Package } from 'lucide-react';

/**
 * SearchableOrderSelect
 *
 * Direct type-to-search, keyboard-accessible, keyword-friendly linked order selector.
 * The visible field itself is an interactive text input that immediately allows typing
 * without requiring an extra click into a nested search bar.
 *
 * @param {Array} orders - List of order objects
 * @param {string} selectedOrderId - Currently selected order ID
 * @param {function} onChange - Callback when an order is selected: (orderId, orderObj) => void
 * @param {string} placeholder - Default placeholder when no order linked
 * @param {boolean} disabled - Whether disabled
 * @param {string} className - Optional className
 */
export default function SearchableOrderSelect({
  orders = [],
  selectedOrderId = '',
  onChange,
  placeholder = '-- Standalone DC (No Linked Order) --',
  disabled = false,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [displayValue, setDisplayValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listboxRef = useRef(null);
  const listboxId = useId();

  // Find currently selected order
  const selectedOrder = useMemo(() => {
    if (!selectedOrderId) return null;
    return orders.find((o) => o.orderId === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  // Format label for display
  const formatOrderLabel = (order) => {
    if (!order) return '';
    const id = order.orderId || '';
    const customer = order.customerName || '';
    if (id && customer) return `${id} — ${customer}`;
    return id || customer || '';
  };

  // Sync displayValue when selectedOrder changes and not actively editing
  useEffect(() => {
    if (!isEditing) {
      setDisplayValue(formatOrderLabel(selectedOrder));
    }
  }, [selectedOrder, isEditing]);

  // Combined options: index 0 is standalone, followed by matched orders
  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return orders;

    const tokens = q.split(/\s+/).filter(Boolean);

    return orders.filter((o) => {
      const id = String(o.orderId || '');
      const customer = String(o.customerName || '');
      const company = String(o.company || '');
      const amount = String(o.amount || '');
      const corpus = `${id} ${customer} ${company} ${amount}`.toLowerCase();

      return tokens.every((token) => corpus.includes(token));
    });
  }, [orders, searchQuery]);

  // Total selectable items: 1 (standalone) + filteredOrders
  const totalOptionsCount = filteredOrders.length + 1;

  // Reset highlight on search change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery, filteredOrders]);

  // Click outside to close dropdown and restore formatted display
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsEditing(false);
        setSearchQuery('');
        setDisplayValue(formatOrderLabel(selectedOrder));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, selectedOrder]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listboxRef.current) return;
    const highlightedEl = listboxRef.current.querySelector(
      `[data-index="${highlightedIndex}"]`
    );
    if (highlightedEl) {
      highlightedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [highlightedIndex, isOpen]);

  // Ensure only one autocomplete remains open across the entire application
  useEffect(() => {
    const handleOtherOpened = (e) => {
      if (e.detail?.id !== listboxId && isOpen) {
        setIsOpen(false);
        setIsEditing(false);
        setSearchQuery('');
        setDisplayValue(formatOrderLabel(selectedOrder));
      }
    };
    window.addEventListener('crm-autocomplete-opened', handleOtherOpened);
    return () => window.removeEventListener('crm-autocomplete-opened', handleOtherOpened);
  }, [listboxId, isOpen, selectedOrder]);

  // Focus and select input text for quick replacement
  const handleInputFocus = () => {
    if (disabled) return;
    setIsEditing(true);
    setIsOpen(true);
    setSearchQuery('');
    window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: listboxId } }));
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.select();
      }
    }, 10);
  };

  // Direct typing handler
  const handleInputChange = (e) => {
    const val = e.target.value;
    setDisplayValue(val);
    setSearchQuery(val);
    setIsEditing(true);
    if (!isOpen) {
      setIsOpen(true);
      window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: listboxId } }));
    }
  };

  // Clean authoritative toggle function: deterministic Open <-> Close
  const handleToggle = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (disabled) return;

    if (isOpen) {
      setIsOpen(false);
      setIsEditing(false);
      setSearchQuery('');
      setDisplayValue(formatOrderLabel(selectedOrder));
    } else {
      setIsOpen(true);
      setIsEditing(true);
      setSearchQuery('');
      window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: listboxId } }));
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 10);
    }
  };

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    setDisplayValue('');
    setSearchQuery('');
    setIsEditing(false);
    if (onChange) {
      onChange('', null);
    }
    inputRef.current?.focus();
    setIsOpen(true);
  };

  const handleSelectStandalone = () => {
    if (onChange) onChange('', null);
    setDisplayValue('');
    setSearchQuery('');
    setIsEditing(false);
    setIsOpen(false);
  };

  const handleSelectOrder = (order) => {
    if (onChange) onChange(order.orderId, order);
    setDisplayValue(formatOrderLabel(order));
    setSearchQuery('');
    setIsEditing(false);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
        setIsEditing(true);
        inputRef.current?.select();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        if (totalOptionsCount === 0) return;
        setHighlightedIndex((prev) => (prev + 1) % totalOptionsCount);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (totalOptionsCount === 0) return;
        setHighlightedIndex((prev) => (prev - 1 + totalOptionsCount) % totalOptionsCount);
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (highlightedIndex === 0) {
          handleSelectStandalone();
        } else {
          const orderIdx = highlightedIndex - 1;
          if (filteredOrders[orderIdx]) {
            handleSelectOrder(filteredOrders[orderIdx]);
          }
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        setIsOpen(false);
        setIsEditing(false);
        setSearchQuery('');
        setDisplayValue(formatOrderLabel(selectedOrder));
        break;
      }
      case 'Tab': {
        setIsOpen(false);
        setIsEditing(false);
        setSearchQuery('');
        setDisplayValue(formatOrderLabel(selectedOrder));
        break;
      }
      default:
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`crm-searchable-order-select-wrap ${className} ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}
      onKeyDown={handleKeyDown}
    >
      {/* Direct Type-to-Search Input Container */}
      <div className="sos-input-trigger-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="sos-direct-input"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={isEditing ? 'Type to search orders...' : placeholder}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-label="Select Model or Linked Order"
          aria-autocomplete="list"
          aria-activedescendant={
            isOpen && totalOptionsCount > 0 ? `${listboxId}-opt-${highlightedIndex}` : undefined
          }
        />

        {/* Right actions: Clear and Chevron toggle buttons */}
        <div className="sos-input-actions">
          {displayValue && !disabled && (
            <button
              type="button"
              className="sos-action-btn sos-clear-btn"
              onClick={handleClear}
              title="Clear order link"
              tabIndex={-1}
            >
              <X size={12} />
            </button>
          )}
          <button
            type="button"
            className={`sos-action-btn sos-chevron-btn ${isOpen ? 'is-open' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={handleToggle}
            disabled={disabled}
            title={isOpen ? 'Close menu' : 'Open menu'}
            tabIndex={-1}
          >
            <ChevronDown size={14} className={`sos-chevron ${isOpen ? 'rotate' : ''}`} />
          </button>
        </div>
      </div>

      {/* Popover Dropdown Panel (ONLY contains the options list - NO nested search bar!) */}
      {isOpen && (
        <div
          className="sos-dropdown-panel"
          role="dialog"
          aria-modal="false"
          onMouseDown={(e) => {
            // Prevent blur when scrolling or clicking options
            e.preventDefault();
          }}
        >
          {/* Options List */}
          <ul
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            className="sos-options-list"
            aria-label="Order options"
          >
            {/* Standalone Option (Always First) */}
            <li
              id={`${listboxId}-opt-0`}
              role="option"
              aria-selected={!selectedOrderId}
              data-index={0}
              className={`sos-option-item ${highlightedIndex === 0 ? 'is-highlighted' : ''} ${
                !selectedOrderId ? 'is-selected' : ''
              }`}
              onClick={handleSelectStandalone}
              onMouseEnter={() => setHighlightedIndex(0)}
            >
              <div className="sos-option-main">
                <div className="sos-option-title-row">
                  <div className="sos-title-left">
                    <ShoppingBag size={14} className="sos-order-icon" style={{ color: '#64748b' }} />
                    <span className="sos-standalone-text">-- Standalone DC (No Linked Order) --</span>
                  </div>
                  {!selectedOrderId && <Check size={14} className="sos-selected-check" />}
                </div>
                <div className="sos-option-meta-row">
                  <span className="sos-option-meta-text">Direct Delivery without existing Sales Order</span>
                </div>
              </div>
            </li>

            {/* Filtered Orders List */}
            {filteredOrders.length === 0 ? (
              <li className="sos-empty-item" role="status">
                <Package size={16} style={{ color: '#cbd5e1' }} />
                <span>No orders found matching &ldquo;{searchQuery || displayValue}&rdquo;</span>
              </li>
            ) : (
              filteredOrders.map((order, idx) => {
                const globalOptionIndex = idx + 1;
                const isSelected = order.orderId === selectedOrderId;
                const isHighlighted = globalOptionIndex === highlightedIndex;

                return (
                  <li
                    key={order.orderId || idx}
                    id={`${listboxId}-opt-${globalOptionIndex}`}
                    role="option"
                    aria-selected={isSelected}
                    data-index={globalOptionIndex}
                    className={`sos-option-item ${isHighlighted ? 'is-highlighted' : ''} ${
                      isSelected ? 'is-selected' : ''
                    }`}
                    onClick={() => handleSelectOrder(order)}
                    onMouseEnter={() => setHighlightedIndex(globalOptionIndex)}
                  >
                    <div className="sos-option-main">
                      <div className="sos-option-title-row">
                        <div className="sos-title-left">
                          <strong className="sos-order-pill">{order.orderId}</strong>
                          <span className="sos-order-customer" title={order.customerName}>
                            {order.customerName}
                          </span>
                        </div>
                        {isSelected && <Check size={14} className="sos-selected-check" />}
                      </div>

                      <div className="sos-option-meta-row">
                        <span className="sos-option-meta-text">
                          {order.company ? `${order.company} • ` : ''}
                          {order.deliveryAddress ? `${order.deliveryAddress.slice(0, 35)}...` : ''}
                        </span>
                        {order.amount !== undefined && (
                          <span className="sos-price-tag">
                            ₹{Number(order.amount || 0).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
