import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Package, FileText, ChevronRight, Lock } from 'lucide-react';
import { DCStatusBadge } from './dcPrimitives';
import { calculateDcReturnMetrics } from './dcReturnCalculator';
import { filterRecordsBySearch } from '../../utils/searchHelper';

export default function ReturnChallanSearch({ challans = [], onSelect, autoFocus = false }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute metrics for all active challans (excluding drafts)
  const candidateChallans = useMemo(() => {
    return challans
      .filter((c) => c.status !== 'DRAFT' && Array.isArray(c.items) && c.items.length > 0)
      .map((c) => ({
        ...c,
        metrics: calculateDcReturnMetrics(c)
      }));
  }, [challans]);

  // Filter candidates matching query across all fields
  const filteredCandidates = useMemo(() => {
    if (!query.trim()) {
      return candidateChallans.slice(0, 10);
    }
    return filterRecordsBySearch(candidateChallans, query, [
      (c) => c.challanId,
      (c) => c.orderId,
      (c) => c.customerName,
      (c) => c.customerCompany,
      (c) => c.company,
      (c) => c.receiverName,
      (c) => c.contactPerson,
      (c) => c.phone,
      (c) => c.mobile,
      (c) => c.deliveryDate,
      (c) => c.items?.map((it) => `${it.productName || ''} ${it.productCode || it.sku || ''} ${(it.serialNumbers || []).join(' ')}`)
    ]);
  }, [candidateChallans, query]);

  // Reset highlight index when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredCandidates]);

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
        setIsOpen(true);
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredCandidates.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredCandidates.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCandidates.length > 0 && filteredCandidates[highlightedIndex]) {
        const item = filteredCandidates[highlightedIndex];
        if (item.metrics?.isEligibleForReturn) {
          handleSelectDc(item);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const handleSelectDc = (dc) => {
    if (!dc.metrics?.isEligibleForReturn) {
      return; // Fully returned DCs are not selectable for another return
    }
    setIsOpen(false);
    setQuery('');
    if (onSelect) {
      onSelect(dc);
    }
  };

  return (
    <div className="dc-challan-search-container" ref={containerRef}>
      <div className="dc-search-input-wrapper">
        <Search className="dc-search-icon" size={18} />
        <input
          ref={inputRef}
          type="text"
          className="dc-search-input"
          placeholder="Search Delivery Challan by DC Number, Customer, Product, SKU, Serial No, or Order ID..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            className="dc-search-clear-btn"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            title="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="dc-search-dropdown-menu">
          <div className="dc-dropdown-header">
            <span>
              {query ? `Matching Challans (${filteredCandidates.length})` : `Recent Challans (${filteredCandidates.length})`}
            </span>
            <span className="dc-dropdown-tip">Use ↑ ↓ to navigate, Enter to select</span>
          </div>

          {filteredCandidates.length === 0 ? (
            <div className="dc-dropdown-empty">
              <Package size={28} style={{ color: '#94a3b8', marginBottom: '6px' }} />
              <p style={{ fontWeight: 600, color: '#334155', margin: '0 0 2px' }}>No challans found</p>
              <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                No consignment matches "{query}".
              </p>
            </div>
          ) : (
            <div className="dc-dropdown-list" role="listbox">
              {filteredCandidates.map((dc, index) => {
                const isHighlighted = index === highlightedIndex;
                const m = dc.metrics || calculateDcReturnMetrics(dc);
                const isEligible = m.isEligibleForReturn;
                const itemsCount = Array.isArray(dc.items) ? dc.items.length : 1;

                return (
                  <div
                    key={dc.challanId}
                    role="option"
                    aria-selected={isHighlighted}
                    aria-disabled={!isEligible}
                    className={`dc-search-result-item ${isHighlighted ? 'highlighted' : ''} ${!isEligible ? 'non-selectable-result' : ''}`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => {
                      if (isEligible) {
                        handleSelectDc(dc);
                      }
                    }}
                    style={{
                      cursor: isEligible ? 'pointer' : 'not-allowed',
                      opacity: isEligible ? 1 : 0.65,
                      background: !isEligible && isHighlighted ? '#f8fafc' : undefined
                    }}
                  >
                    <div className="dc-result-top-row">
                      <div className="dc-result-id-group">
                        <strong className="order-id-badge">{dc.challanId}</strong>
                        <span className="dc-result-date">{dc.deliveryDate || '—'}</span>
                        <span
                          className={`dc-purpose-badge ${m.originalPurpose === 'Returnable / Temporary' ? 'returnable' : 'normal'}`}
                          style={{
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: m.originalPurpose === 'Returnable / Temporary' ? '#eff6ff' : '#f1f5f9',
                            color: m.originalPurpose === 'Returnable / Temporary' ? '#1d4ed8' : '#475569',
                            border: `1px solid ${m.originalPurpose === 'Returnable / Temporary' ? '#bfdbfe' : '#cbd5e1'}`
                          }}
                        >
                          {m.originalPurpose}
                        </span>
                      </div>
                      <div className="dc-result-status-group">
                        <DCStatusBadge status={m.statusBadge} />
                      </div>
                    </div>

                    <div className="dc-result-middle-row">
                      <strong className="dc-result-customer-name">
                        {dc.customerName || dc.receiverName || 'Valued Customer'}
                      </strong>
                      {dc.company && dc.company !== dc.customerName && (
                        <span className="dc-result-company">({dc.company})</span>
                      )}
                    </div>

                    <div className="dc-result-bottom-row">
                      <span className="dc-result-meta-tag">
                        <Package size={12} /> {itemsCount} {itemsCount === 1 ? 'product' : 'products'} • {m.originalDeliveredQty} sent
                      </span>

                      {m.cumulativeReturnedQty > 0 && (
                        <span className="dc-result-meta-tag returned" style={{ color: '#64748b' }}>
                          {m.cumulativeReturnedQty} already returned
                        </span>
                      )}

                      <span
                        className="dc-result-meta-tag remaining"
                        style={{
                          color: m.remainingReturnableQty > 0 ? '#b45309' : '#059669',
                          fontWeight: 700
                        }}
                      >
                        {m.remainingReturnableQty} remaining to return
                      </span>

                      {dc.orderId ? (
                        <span className="dc-result-meta-tag order">
                          <FileText size={12} /> Order: {dc.orderId}
                        </span>
                      ) : (
                        <span className="dc-result-meta-tag standalone">Standalone DC</span>
                      )}

                      {isEligible ? (
                        <ChevronRight size={14} className="dc-result-arrow" />
                      ) : (
                        <span
                          className="dc-result-locked-tag"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '11px',
                            color: '#991b1b',
                            fontWeight: 600,
                            marginLeft: 'auto'
                          }}
                          title="Full quantity already returned. Cannot initiate another return."
                        >
                          <Lock size={11} /> Fully Returned
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
