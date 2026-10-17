import React, { useState, useRef, useEffect, useMemo, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Check, Package } from 'lucide-react';
import './searchableProductSelect.css';

/**
 * SearchableProductSelect
 *
 * Direct type-to-search, keyboard-accessible, keyword-friendly product/item selector.
 * The visible field itself is an interactive text input that immediately allows typing
 * without requiring an extra click into a nested search bar.
 *
 * @param {Array} items - List of products/items
 * @param {string} selectedId - ID/code of currently selected item
 * @param {function} onChange - Callback when an item is selected: (id, item) => void
 * @param {string} placeholder - Default placeholder (e.g. "Select Product" or "[ Select Item ▼ ]")
 * @param {string} searchPlaceholder - Input placeholder when typing/searching
 * @param {Array} disabledIds - IDs of items that cannot be selected (e.g. already added)
 * @param {boolean} disabled - Whether the selector trigger is disabled
 * @param {string} className - Additional CSS class
 * @param {string} ariaLabel - ARIA label for trigger
 */
export default function SearchableProductSelect({
  items: rawItems = [],
  products = null,
  selectedId: rawSelectedId = '',
  value = '',
  selectedName = '',
  onChange,
  placeholder = '[ Select Item ▼ ]',
  searchPlaceholder = 'Type to search products...',
  disabledIds = [],
  disabled = false,
  className = '',
  ariaLabel = 'Select Product',
  formatLabel = null,
  loading = false,
  onAddProduct = null,
  onDuplicateAttempt = null
}) {
  const items = useMemo(() => ((Array.isArray(products) && products.length > 0) ? products : (Array.isArray(rawItems) ? rawItems : [])), [products, rawItems]);
  const selectedId = rawSelectedId || value || '';
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [displayValue, setDisplayValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listboxRef = useRef(null);
  const dropdownRef = useRef(null);
  const listboxId = useId();

  // Position calculation for portal dropdown to prevent any overflow clipping
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0, showAbove: false });

  const updateDropdownPosition = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dropdownHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const showAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    setDropdownPos({
      top: showAbove ? rect.top - 4 : rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 420),
      showAbove
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();

    const handleScrollOrResize = () => {
      updateDropdownPosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  // Find currently selected item
  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return (
      items.find(
        (i) =>
          i.id === selectedId ||
          i.productId === selectedId ||
          i.code === selectedId ||
          i.productCode === selectedId
      ) || null
    );
  }, [items, selectedId]);

  // Format label for display: "[CODE] Product Name" or "Product Name" or custom formatLabel
  const formatItemLabel = (item) => {
    if (!item) {
      if (selectedName) return selectedName;
      return '';
    }
    if (typeof formatLabel === 'function') return formatLabel(item);
    const code = item.code || item.productCode || item.sku || '';
    const name = item.name || item.productName || '';
    if (code && name) return `[${code}] ${name}`;
    return name || code || '';
  };

  // Sync displayValue when selectedItem or selectedName changes and not actively editing
  useEffect(() => {
    if (!isEditing) {
      if (selectedItem) {
        setDisplayValue(formatItemLabel(selectedItem));
      } else if (selectedName) {
        setDisplayValue(selectedName);
      } else if (!selectedId) {
        setDisplayValue('');
      }
    }
  }, [selectedItem, selectedName, selectedId, isEditing]);

  // Keyword search algorithm matching:
  // - Name / productName
  // - Code / SKU / productCode
  // - Category / categoryName / productType
  // - Subcategory / subcategoryName
  // - Brand / brandName
  // - Description / productDetails
  // - HSN / SAC
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;

    const tokens = q.split(/\s+/).filter(Boolean);

    return items.filter((item) => {
      const name = String(item.name || item.productName || '');
      const code = String(item.code || item.productCode || item.sku || '');
      const category = String(item.categoryName || item.category || item.productType || '');
      const subcategory = String(item.subcategoryName || item.subcategory || '');
      const brand = String(item.brandName || item.brand || '');
      const desc = String(item.description || item.productDetails || '');
      const hsn = String(item.hsnSac || '');

      const searchCorpus = `${name} ${code} ${category} ${subcategory} ${brand} ${desc} ${hsn}`.toLowerCase();
      return tokens.every((token) => searchCorpus.includes(token));
    });
  }, [items, searchQuery]);

  // Reset highlighted index when filter results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredItems]);

  // Handle click outside to close dropdown and restore formatted display
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      const inTrigger = containerRef.current && containerRef.current.contains(e.target);
      const inDropdown = dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!inTrigger && !inDropdown) {
        setIsOpen(false);
        setIsEditing(false);
        setSearchQuery('');
        setDisplayValue(formatItemLabel(selectedItem));
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isOpen, selectedItem]);

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
        setDisplayValue(formatItemLabel(selectedItem));
      }
    };
    window.addEventListener('crm-autocomplete-opened', handleOtherOpened);
    return () => window.removeEventListener('crm-autocomplete-opened', handleOtherOpened);
  }, [listboxId, isOpen, selectedItem]);

  // Focus and select input text for quick replacement
  const handleInputFocus = () => {
    if (disabled) return;
    setIsEditing(true);
    setIsOpen(true);
    setSearchQuery('');
    window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: listboxId } }));
    // Select all text so typing immediately replaces it
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

  // Toggle chevron click: deterministic Open <-> Close
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
      setDisplayValue(formatItemLabel(selectedItem));
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

  // Clear button click
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

  const checkItemDisabled = (item) => {
    if (!item || !Array.isArray(disabledIds) || disabledIds.length === 0) return false;
    return (
      (item.id && disabledIds.includes(item.id)) ||
      (item.productId && disabledIds.includes(item.productId)) ||
      (item.code && disabledIds.includes(item.code)) ||
      (item.productCode && disabledIds.includes(item.productCode))
    );
  };

  // Handle item selection
  const handleSelect = (item) => {
    const isItemDisabled = checkItemDisabled(item);
    if (isItemDisabled) {
      if (typeof onDuplicateAttempt === 'function') {
        onDuplicateAttempt(item);
      }
      return;
    }

    const itemId = item.id || item.productId || item.code || '';
    if (onChange) {
      onChange(itemId, item);
    }
    setDisplayValue(formatItemLabel(item));
    setSearchQuery('');
    setIsEditing(false);
    setIsOpen(false);
  };

  // Keyboard navigation
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
        if (filteredItems.length === 0) return;
        setHighlightedIndex((prev) => (prev + 1) % filteredItems.length);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (filteredItems.length === 0) return;
        setHighlightedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (filteredItems.length > 0 && filteredItems[highlightedIndex]) {
          handleSelect(filteredItems[highlightedIndex]);
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        setIsOpen(false);
        setIsEditing(false);
        setSearchQuery('');
        setDisplayValue(formatItemLabel(selectedItem));
        break;
      }
      case 'Tab': {
        // Close dropdown and let tab move focus naturally to the next field in the row
        setIsOpen(false);
        setIsEditing(false);
        setSearchQuery('');
        setDisplayValue(formatItemLabel(selectedItem));
        break;
      }
      default:
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`crm-searchable-product-select-wrap ${className} ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}
      onKeyDown={handleKeyDown}
    >
      {/* Direct Type-to-Search Input Container */}
      <div className="sps-input-trigger-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="sps-direct-input"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onClick={handleInputFocus}
          placeholder={isEditing ? searchPlaceholder : placeholder}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-activedescendant={
            isOpen && filteredItems.length > 0 ? `${listboxId}-opt-${highlightedIndex}` : undefined
          }
        />

        {/* Right actions: Clear button and Chevron toggle button */}
        <div className="sps-input-actions">
          {displayValue && !disabled && (
            <button
              type="button"
              className="sps-action-btn sps-clear-btn"
              onClick={handleClear}
              title="Clear selection"
              tabIndex={-1}
            >
              <X size={12} />
            </button>
          )}
          <button
            type="button"
            className={`sps-action-btn sps-chevron-btn ${isOpen ? 'is-open' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={handleToggle}
            disabled={disabled}
            title={isOpen ? 'Close menu' : 'Open menu'}
            tabIndex={-1}
          >
            <ChevronDown size={14} className={`sps-chevron ${isOpen ? 'rotate' : ''}`} />
          </button>
        </div>
      </div>

      {/* Popover Dropdown Panel (Portal-rendered into document.body to prevent table overflow clipping) */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="sps-dropdown-panel sps-portal-panel"
          role="dialog"
          aria-modal="false"
          style={{
            position: 'fixed',
            top: `${dropdownPos.top}px`,
            left: `${Math.max(10, Math.min(dropdownPos.left, (typeof window !== 'undefined' ? window.innerWidth : 1200) - Math.min(dropdownPos.width || 420, 580) - 16))}px`,
            width: `${Math.min(dropdownPos.width || 420, 580)}px`,
            transform: dropdownPos.showAbove ? 'translateY(-100%)' : 'none',
            zIndex: 99999
          }}
          onMouseDown={(e) => {
            // Prevent input blur when clicking inside the dropdown or scrollbar
            e.preventDefault();
          }}
        >
          <ul
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            className="sps-options-list"
            aria-label="Product options"
          >
            {filteredItems.length === 0 ? (
              <li className="sps-empty-item" role="status">
                {loading ? (
                  <>
                    <span className="crm-loading-spinner inline-spinner" style={{ width: 14, height: 14 }} />
                    <span>Loading products from Product Master...</span>
                  </>
                ) : items.length === 0 ? (
                  <>
                    <Package size={16} className="sps-empty-icon" />
                    <span>No products available in Product Master</span>
                  </>
                ) : searchQuery.trim() ? (
                  <>
                    <Package size={16} className="sps-empty-icon" />
                    <span>No products found matching &ldquo;{searchQuery.trim()}&rdquo;</span>
                  </>
                ) : (
                  <>
                    <Package size={16} className="sps-empty-icon" />
                    <span>No products available in Product Master</span>
                  </>
                )}
              </li>
            ) : (
              filteredItems.map((item, idx) => {
                const itemId = item.id || item.productId || item.code;
                const isSelected =
                  itemId === selectedId ||
                  (item.code && item.code === selectedId) ||
                  (item.productCode && item.productCode === selectedId);
                const isItemDisabled = checkItemDisabled(item);
                const isHighlighted = idx === highlightedIndex;

                const itemName = item.name || item.productName || 'Unnamed Product';
                const itemCode = item.code || item.productCode || item.sku || '';
                const category = item.categoryName || item.category || item.productType || '';
                const stockQty = Number(item.stock !== undefined ? item.stock : (item.availableQty !== undefined ? item.availableQty : 0));
                const price = Number(item.dealerPrice || item.price || item.unitPrice || 0);

                return (
                  <li
                    key={itemId || idx}
                    id={`${listboxId}-opt-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={isItemDisabled}
                    data-index={idx}
                    className={`sps-option-item ${isHighlighted ? 'is-highlighted' : ''} ${
                      isSelected ? 'is-selected' : ''
                    } ${isItemDisabled ? 'is-disabled' : ''}`}
                    onClick={() => {
                      if (isItemDisabled) {
                        if (typeof onDuplicateAttempt === 'function') {
                          onDuplicateAttempt(item);
                        }
                      } else {
                        handleSelect(item);
                      }
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                  >
                    <div className="sps-option-main">
                      <div className="sps-option-title-row">
                        <span className="sps-option-name" title={itemName}>
                          {itemCode && <strong className="sps-code-prefix">[{itemCode}]</strong>} {itemName}
                        </span>
                        {isSelected && <Check size={14} className="sps-selected-check" />}
                        {isItemDisabled && !isSelected && (
                          <span className="sps-already-added-tag" title="This product is already added.">Already added</span>
                        )}
                      </div>

                      <div className="sps-option-meta-row">
                        <span className="sps-option-meta-text">
                          {category ? `${category} ` : ''}
                          {item.brandName ? `• ${item.brandName}` : ''}
                        </span>
                        <div className="sps-option-badges">
                          <span
                            className={`sps-stock-badge ${
                              stockQty > 0 ? 'in-stock' : 'no-stock'
                            }`}
                          >
                            {stockQty > 0 ? `${stockQty} in stock` : 'Out of stock'}
                          </span>
                          {price > 0 && (
                            <span className="sps-price-tag">
                              ₹{price.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
          {onAddProduct && (
            <div
              className="sps-dropdown-footer"
              style={{
                padding: '7px 12px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>Product not found?</span>
              <button
                type="button"
                className="sps-add-product-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsOpen(false);
                  setIsEditing(false);
                  onAddProduct();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: '#2563eb',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                + Add Product
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
