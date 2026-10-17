import React, { useState, useRef, useEffect, useMemo, useId } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';
import './searchableProductSelect.css';

/**
 * SearchableReferenceSelect
 *
 * Direct type-to-search combobox for upstream references (Quotation, Order, DC, Customer PO, Dispatch).
 * - Input is directly editable (can type custom text or search existing records).
 * - Dropdown shows matching records with title/ID, customer/party name, and authoritative source date.
 * - Empty state shows recent available records without error messages.
 * - Selecting an option populates reference and emits authoritative source date.
 */
export default function SearchableReferenceSelect({
  value = '',
  onChange,
  onSelect,
  records = [],
  getRecordId = (r) => r.id || r.code || '',
  getRecordTitle = (r) => r.title || r.name || '',
  getRecordSubtitle = (r) => r.subtitle || r.customer || '',
  getRecordDate = (r) => r.date || '',
  placeholder = 'Type to search or enter ref...',
  disabled = false,
  className = '',
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listboxRef = useRef(null);
  const listboxId = useId();

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Ensure only one dropdown open at a time
  useEffect(() => {
    const handleOtherOpened = (e) => {
      if (e.detail?.id !== listboxId && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('crm-autocomplete-opened', handleOtherOpened);
    return () => window.removeEventListener('crm-autocomplete-opened', handleOtherOpened);
  }, [listboxId, isOpen]);

  // Filter records
  const filteredRecords = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) {
      // Empty query: show recent records (up to 40)
      return records.slice(0, 40);
    }
    const tokens = q.split(/\s+/).filter(Boolean);
    return records.filter((r) => {
      const id = String(getRecordId(r) || '');
      const title = String(getRecordTitle(r) || '');
      const sub = String(getRecordSubtitle(r) || '');
      const d = String(getRecordDate(r) || '');
      const corpus = `${id} ${title} ${sub} ${d}`.toLowerCase();
      return tokens.every((tok) => corpus.includes(tok));
    }).slice(0, 30);
  }, [records, searchQuery, getRecordId, getRecordTitle, getRecordSubtitle, getRecordDate]);

  // Reset highlight on query change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredRecords]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listboxRef.current) return;
    const el = listboxRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [highlightedIndex, isOpen]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    onChange && onChange(val);
    setSearchQuery(val);
    if (!isOpen) {
      setIsOpen(true);
      window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: listboxId } }));
    }

    if (val && val.trim()) {
      const v = val.trim().toLowerCase();
      const match = records.find((r) => {
        const id = String(getRecordId(r) || '').toLowerCase();
        const title = String(getRecordTitle(r) || '').toLowerCase();
        return id === v || title === v;
      });
      if (match) {
        onSelect && onSelect(match);
      }
    } else {
      onSelect && onSelect(null);
    }
  };

  const handleInputFocus = () => {
    if (disabled) return;
    setSearchQuery('');
    setIsOpen(true);
    window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: listboxId } }));
    setTimeout(() => {
      inputRef.current?.select();
    }, 10);
  };

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (isOpen) {
      setIsOpen(false);
      setSearchQuery('');
    } else {
      setSearchQuery('');
      setIsOpen(true);
      window.dispatchEvent(new CustomEvent('crm-autocomplete-opened', { detail: { id: listboxId } }));
      inputRef.current?.focus();
      setTimeout(() => {
        inputRef.current?.select();
      }, 10);
    }
  };

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    onChange && onChange('');
    onSelect && onSelect(null);
    setSearchQuery('');
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleSelect = (record) => {
    const title = getRecordTitle(record) || getRecordId(record) || '';
    onChange && onChange(title);
    onSelect && onSelect(record);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredRecords.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % filteredRecords.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredRecords.length > 0) {
        setHighlightedIndex((prev) => (prev - 1 + filteredRecords.length) % filteredRecords.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredRecords[highlightedIndex]) {
        handleSelect(filteredRecords[highlightedIndex]);
      }
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`crm-searchable-ref-select-wrap ${className} ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}
      style={{ position: 'relative', width: '100%', ...style }}
      onKeyDown={handleKeyDown}
    >
      <div className="sref-input-trigger-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="sref-direct-input"
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
        />

        <div className="sref-input-actions">
          {value && !disabled && (
            <button
              type="button"
              className="sref-action-btn sref-clear-btn"
              onClick={handleClear}
              title="Clear"
              tabIndex={-1}
            >
              <X size={12} />
            </button>
          )}
          <button
            type="button"
            className={`sref-action-btn sref-chevron-btn ${isOpen ? 'is-open' : ''}`}
            onClick={handleToggle}
            disabled={disabled}
            title={isOpen ? 'Close' : 'Open'}
            tabIndex={-1}
          >
            <ChevronDown size={14} className={`sref-chevron ${isOpen ? 'rotate' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="sref-dropdown-panel" role="dialog" onMouseDown={(e) => e.preventDefault()}>
          <ul ref={listboxRef} id={listboxId} role="listbox" className="sref-options-list">
            {filteredRecords.length === 0 ? (
              <li className="sref-empty-item" role="status">
                No matching records
              </li>
            ) : (
              filteredRecords.map((rec, idx) => {
                const title = getRecordTitle(rec) || getRecordId(rec);
                const sub = getRecordSubtitle(rec);
                const d = getRecordDate(rec);
                const isSelected = Boolean(value && title && String(value).toLowerCase() === String(title).toLowerCase());
                const isHighlighted = idx === highlightedIndex;

                return (
                  <li
                    key={getRecordId(rec) || idx}
                    data-index={idx}
                    role="option"
                    aria-selected={isSelected}
                    className={`sref-option-item ${isHighlighted ? 'is-highlighted' : ''} ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleSelect(rec)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                  >
                    <div className="sref-option-main">
                      <div className="sref-option-title-row">
                        <strong className="sref-pill">{title}</strong>
                        {d && <span className="sref-date-badge">{d}</span>}
                        {isSelected && <Check size={13} className="sref-check" />}
                      </div>
                      {sub && <div className="sref-subtitle">{sub}</div>}
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
