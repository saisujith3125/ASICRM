import React from 'react';
import './tableWorkspace.css';

/**
 * ASICRM Enterprise Table Workspace Architecture
 *
 * Structure:
 * <TableWorkspace>
 *   <TableToolbar ... />   (optional, or page-level)
 *   <TableViewport maxHeight="...">
 *     <table className="crm-master-table">
 *       ...
 *     </table>
 *   </TableViewport>
 *   <TableFooter count={...} total={...} ... />
 * </TableWorkspace>
 */

export function TableWorkspace({ children, className = '', style = {}, id }) {
  return (
    <div className={`crm-table-workspace ${className}`.trim()} style={style} id={id}>
      {children}
    </div>
  );
}

export function TableToolbar({
  children,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  onClearSearch,
  leftControls,
  rightControls,
  className = '',
  style = {}
}) {
  return (
    <div className={`crm-table-toolbar ${className}`.trim()} style={style}>
      <div className="crm-table-toolbar-left">
        {leftControls}
        {children}
      </div>

      <div className="crm-table-toolbar-right">
        {onSearchChange !== undefined && (
          <div className="crm-table-search-box">
            <svg
              className="crm-table-search-icon"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="crm-table-search-input"
              placeholder={searchPlaceholder || 'Search records...'}
              value={searchValue || ''}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchValue && (
              <button
                type="button"
                className="crm-table-search-clear"
                onClick={onClearSearch || (() => onSearchChange(''))}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        )}
        {rightControls}
      </div>
    </div>
  );
}

export function TableViewport({
  children,
  className = '',
  style = {},
  maxHeight,
  minHeight
}) {
  const customStyle = { ...style };
  if (maxHeight !== undefined) customStyle.maxHeight = maxHeight;
  if (minHeight !== undefined) customStyle.minHeight = minHeight;

  return (
    <div className={`crm-table-viewport ${className}`.trim()} style={customStyle}>
      {children}
    </div>
  );
}

export function TablePlaceholderRows() {
  return null;
}

export function TableFooter({
  count = 0,
  total = 0,
  showingStart,
  showingEnd,
  recordLabel = 'records',
  singularLabel,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  children,
  className = '',
  style = {}
}) {
  const effectiveTotal = total !== undefined ? total : count;
  const displayLabel = effectiveTotal === 1 ? (singularLabel || recordLabel.replace(/s$/, '')) : recordLabel;

  // Build page numbers window (e.g. 1 2 3 4 5 ... 10)
  const getPageNumbers = () => {
    if (!totalPages || totalPages <= 1) return [];
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={`crm-table-footer ${className}`.trim()} style={style}>
      <div className="crm-table-footer-info">
        {effectiveTotal > 0 && showingStart !== undefined && showingEnd !== undefined ? (
          <span>
            Showing <strong>{showingStart}–{showingEnd}</strong> of <strong>{effectiveTotal}</strong> {displayLabel}
          </span>
        ) : effectiveTotal !== undefined && effectiveTotal !== count ? (
          <span>
            Showing <strong>{count}</strong> of <strong>{effectiveTotal}</strong> {displayLabel}
          </span>
        ) : (
          <span>
            Showing all <strong>{count || effectiveTotal}</strong> {displayLabel}
          </span>
        )}
      </div>

      <div className="crm-table-footer-controls">
        {children}
        {totalPages > 1 && onPageChange && (
          <div className="crm-table-pagination" role="navigation" aria-label="Table pagination">
            <button
              type="button"
              className="crm-pagination-btn"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              aria-label="Previous page"
            >
              Previous
            </button>

            {pageNumbers.map((page, idx) => (
              page === '...' ? (
                <span key={`ellipsis-${idx}`} className="crm-pagination-ellipsis" aria-hidden="true">
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  type="button"
                  className={`crm-pagination-btn ${page === currentPage ? 'active' : ''}`}
                  onClick={() => onPageChange(page)}
                  aria-label={`Page ${page}`}
                  aria-current={page === currentPage ? 'page' : undefined}
                >
                  {page}
                </button>
              )
            ))}

            <button
              type="button"
              className="crm-pagination-btn"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function TableEmptyState({
  title = 'No records found',
  description = 'Try adjusting your search query or filters.',
  actionLabel,
  onAction,
  icon,
  colSpan = 8
}) {
  return (
    <tr className="crm-table-empty-row">
      <td colSpan={colSpan}>
        <div className="crm-table-empty-container">
          <div className="crm-table-empty-icon">
            {icon || (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            )}
          </div>
          <h3 className="crm-table-empty-title">{title}</h3>
          {description && <p className="crm-table-empty-desc">{description}</p>}
          {actionLabel && onAction && (
            <button type="button" className="crm-btn-primary compact" onClick={onAction}>
              {actionLabel}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function TableLoadingState({ message = 'Loading records...', colSpan = 8 }) {
  return (
    <tr className="crm-table-loading-row">
      <td colSpan={colSpan}>
        <div className="crm-table-loading-container">
          <div className="crm-spinner" />
          <p>{message}</p>
        </div>
      </td>
    </tr>
  );
}

export { useTablePagination, DEFAULT_PAGE_SIZE } from './useTablePagination';

export default TableWorkspace;
