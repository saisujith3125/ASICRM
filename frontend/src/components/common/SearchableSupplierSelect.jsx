import React, { useState, useRef, useEffect, useMemo, useId, forwardRef } from 'react';
import { Search, X, Check, Building2 } from 'lucide-react';
import './searchableSupplierSelect.css';

/**
 * SearchableSupplierSelect
 *
 * Clean, single-input searchable combobox for suppliers / vendors.
 * - Single visible input with one border and NO dropdown arrow.
 * - Direct type-to-search with live filtering across company name, contact, phone, email, GSTIN, city.
 * - Auto-focus capable (cursor ready for immediate typing on page open).
 * - Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape, Tab).
 * - Clear (×) button on selection.
 */
const SearchableSupplierSelect = forwardRef(function SearchableSupplierSelect(
  {
    suppliers = [],
    selectedSupplierId = '',
    onSelectSupplier,
    placeholder = 'Search supplier by company, contact, phone, GSTIN...',
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
  const listboxId = `sss-listbox-${instanceId}`;

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

  // Find currently selected supplier
  const selectedSupplier = useMemo(() => {
    if (!selectedSupplierId) return null;
    return (
      suppliers.find(
        (s) => s.id === selectedSupplierId || s.supplierId === selectedSupplierId
      ) || null
    );
  }, [suppliers, selectedSupplierId]);

  // Sync display value when selected supplier changes
  useEffect(() => {
    if (!isEditing) {
      setDisplayValue(selectedSupplier ? selectedSupplier.companyName : '');
    }
  }, [selectedSupplier, isEditing]);

  // Filter suppliers by query across all fields
  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) => {
      const company = String(s.companyName || '').toLowerCase();
      const contact = String(s.contactPerson || '').toLowerCase();
      const phone = String(s.phone || '').toLowerCase();
      const email = String(s.email || '').toLowerCase();
      const gstin = String(s.gstin || '').toLowerCase();
      const city = String(s.city || '').toLowerCase();
      const address = String(s.address || '').toLowerCase();

      return (
        company.includes(q) ||
        contact.includes(q) ||
        phone.includes(q) ||
        email.includes(q) ||
        gstin.includes(q) ||
        city.includes(q) ||
        address.includes(q)
      );
    });
  }, [suppliers, searchQuery]);

  // Reset highlight on search change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  // Global coordination so only one dropdown is open at a time
  useEffect(() => {
    const handleCloseAll = (e) => {
      if (e.detail?.id !== instanceId) {
        setIsOpen(false);
        setIsEditing(false);
        setSearchQuery('');
        setDisplayValue(selectedSupplier ? selectedSupplier.companyName : '');
      }
    };
    window.addEventListener('close-all-dropdowns', handleCloseAll);
    return () => window.removeEventListener('close-all-dropdowns', handleCloseAll);
  }, [instanceId, selectedSupplier]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsEditing(false);
        setSearchQuery('');
        setDisplayValue(selectedSupplier ? selectedSupplier.companyName : '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedSupplier]);

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
    setDisplayValue(selectedSupplier ? selectedSupplier.companyName : '');
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

  const handleSelect = (supplier) => {
    onSelectSupplier(supplier.id, supplier);
    setDisplayValue(supplier.companyName);
    setIsEditing(false);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onSelectSupplier('', null);
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
      } else {
        setHighlightedIndex((prev) =>
          prev < filteredSuppliers.length - 1 ? prev + 1 : 0
        );
        scrollHighlightedIntoView(
          highlightedIndex < filteredSuppliers.length - 1 ? highlightedIndex + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        openDropdown();
      } else {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredSuppliers.length - 1
        );
        scrollHighlightedIntoView(
          highlightedIndex > 0 ? highlightedIndex - 1 : filteredSuppliers.length - 1
        );
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && filteredSuppliers[highlightedIndex]) {
        handleSelect(filteredSuppliers[highlightedIndex]);
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
    const items = listboxRef.current.querySelectorAll('.sss-result-card');
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  };

  return (
    <div
      className={`searchable-supplier-select-wrap ${className}`}
      ref={containerRef}
    >
      <div
        className={`sss-input-box ${isOpen ? 'is-open' : ''} ${
          disabled ? 'disabled' : ''
        }`}
        onClick={() => {
          if (!disabled) {
            internalInputRef.current?.focus();
            if (!isOpen && (searchQuery || !selectedSupplier)) {
              openDropdown();
            }
          }
        }}
      >
        <Search size={16} className="sss-search-icon" />
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
          className="sss-input"
        />

        <div className="sss-actions">
          {(selectedSupplier || searchQuery) && !disabled && (
            <button
              type="button"
              className="sss-clear-btn"
              onClick={handleClear}
              title="Clear selection"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Relative Popover Dropdown */}
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="sss-popover"
        >
          <div className="sss-popover-header">
            <span>
              {filteredSuppliers.length} supplier
              {filteredSuppliers.length === 1 ? '' : 's'} available
            </span>
          </div>

          <div className="sss-listbox" ref={listboxRef}>
            {filteredSuppliers.length === 0 ? (
              <div className="sss-empty-state">
                <div>No suppliers found matching "{searchQuery}"</div>
              </div>
            ) : (
              filteredSuppliers.map((s, idx) => {
                const isSelected =
                  s.id === selectedSupplierId || s.supplierId === selectedSupplierId;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={s.id || idx}
                    role="option"
                    aria-selected={isSelected}
                    className={`sss-result-card ${
                      isSelected ? 'selected' : ''
                    } ${isHighlighted ? 'highlighted' : ''}`}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(s);
                    }}
                  >
                    <div className="sss-card-top">
                      <span className="sss-card-company">{s.companyName}</span>
                      {isSelected && (
                        <span className="sss-card-badge">Selected</span>
                      )}
                    </div>

                    <div className="sss-card-meta">
                      {s.contactPerson && (
                        <span>Attn: {s.contactPerson}</span>
                      )}
                      {s.phone && <span>Ph: {s.phone}</span>}
                      {s.gstin && <span>GSTIN: {s.gstin}</span>}
                      {s.city && <span>City: {s.city}</span>}
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

export default SearchableSupplierSelect;
