import React, { useState, useRef, useEffect, useMemo } from 'react';

/**
 * Normalizes any items input (array of objects, array of strings, or comma-separated string)
 * into a uniform structure: [{ qty, name, sku, serialNumbers }]
 */
export function normalizeTableItems(items) {
  if (!items) return [];

  if (Array.isArray(items)) {
    return items.flatMap((it) => {
      if (!it) return [];

      // If it's already an object
      if (typeof it === 'object') {
        const qty = Number(it.quantity || it.qty || it.orderedQty || it.deliveredQty || 1);
        const rawName = String(it.productName || it.name || it.item || it.title || 'Product').trim();
        const brand = String(it.brandName || it.brand || '').trim();
        const isInstallation = Boolean(
          it.isInstallationCharge ||
          rawName.toLowerCase().includes('installation testing & commissioning')
        );
        const displayName = brand && !isInstallation && !new RegExp(`[\\-\\–\\—]\\s*${brand.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*$`, 'i').test(rawName)
          ? `${rawName} - ${brand}`
          : rawName;

        return [{
          qty,
          name: displayName,
          sku: it.productCode || it.sku || it.code || '',
          serialNumbers: Array.isArray(it.serialNumbers) ? it.serialNumbers : []
        }];
      }

      // If it's a string
      if (typeof it === 'string') {
        const parts = it.split(',');
        return parts.map((s) => {
          const match = s.trim().match(/^(\d+(?:\.\d+)?)\s*[xX*×]\s*(.+)$/);
          if (match) {
            return { qty: Number(match[1]), name: match[2].trim() };
          }
          return { qty: 1, name: s.trim() };
        }).filter((x) => Boolean(x.name));
      }

      return [{ qty: 1, name: String(it) }];
    });
  }

  if (typeof items === 'string') {
    return items.split(',').map((s) => {
      const match = s.trim().match(/^(\d+(?:\.\d+)?)\s*[xX*×]\s*(.+)$/);
      if (match) {
        return { qty: Number(match[1]), name: match[2].trim() };
      }
      return { qty: 1, name: s.trim() };
    }).filter((x) => Boolean(x.name));
  }

  return [{ qty: 1, name: String(items) }];
}

/**
 * Standard Table Items Popover Component
 * Matching Quotations Items Popover reference design:
 * - Compact pill trigger: [ N Items ▾ ]
 * - Sleek floating card with Header [ N ITEMS ] [ × ]
 * - Structured items list with [ Qty × ] in bold primary color
 */
export default function TableItemsPopover({
  items = [],
  singularLabel = 'Item',
  pluralLabel = 'Items',
  isNearBottom = false,
  className = '',
  emptyPlaceholder = '—',
  onItemClick
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const parsedItems = useMemo(() => normalizeTableItems(items), [items]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (parsedItems.length === 0) {
    return <span style={{ color: '#94a3b8', fontSize: '12px' }}>{emptyPlaceholder}</span>;
  }

  const count = parsedItems.length;
  const label = `${count} ${count === 1 ? singularLabel : pluralLabel}`;
  const headerLabel = `${count} ${count === 1 ? singularLabel.toUpperCase() : pluralLabel.toUpperCase()}`;

  return (
    <div ref={containerRef} className={`quotation-items-wrapper ${className}`}>
      <button
        type="button"
        className={`quotation-items-trigger ${isOpen ? 'active' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }
        }}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title={`Click to view ${label.toLowerCase()}`}
      >
        <span>{label}</span>
        <span className="quotation-items-arrow" aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
      </button>

      {isOpen && (
        <div
          className={`quotation-items-popover ${isNearBottom ? 'placement-top' : ''}`}
          role="dialog"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="quotation-items-popover-header">
            <span>{headerLabel}</span>
            <button
              type="button"
              className="quotation-items-popover-close"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              aria-label="Close items list"
              title="Close"
            >
              ×
            </button>
          </div>
          <ul className="quotation-items-popover-list">
            {parsedItems.map((it, idx) => (
              <li
                key={idx}
                className="quotation-items-popover-item"
                onClick={() => onItemClick && onItemClick(it, idx)}
                style={onItemClick ? { cursor: 'pointer' } : undefined}
              >
                <span className="popover-item-qty">{it.qty} ×</span>{' '}
                <span className="popover-item-name">
                  {it.name}
                  {it.sku && !it.name.includes(it.sku) && (
                    <span style={{ display: 'block', fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>
                      SKU: {it.sku}
                    </span>
                  )}
                  {Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0 && (
                    <span style={{ display: 'block', fontSize: '10px', color: '#0284c7', marginTop: '1px' }}>
                      S/N: {it.serialNumbers.join(', ')}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
