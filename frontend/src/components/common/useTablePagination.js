import { useState, useEffect, useMemo, useCallback } from 'react';

/**
 * Calculates dynamic visible row capacity based on current viewport height and layout overhead.
 * Adapts across 1080p, 1440p, laptops (768p/900p) without hard-coded numbers.
 *
 * @param {Object} [options={}]
 * @param {number} [options.rowHeight=43] - Estimated height per standard table row (~42-44px)
 * @returns {number} Clamped practical page capacity (e.g. 11-28 rows)
 */
export function calculateDynamicPageSize(options = {}) {
  if (typeof window === 'undefined') return 14;

  const rowHeight = options.rowHeight || 45;

  // 1. Direct measurement if scroll container exists AND is already constrained by the viewport
  const scrollWrap = document.querySelector(
    '.crm-table-scroll-wrap, .crm-table-viewport, .stocks-table-natural-wrap, .po-table-viewport'
  );
  if (scrollWrap && scrollWrap.clientHeight > 150 && scrollWrap.clientHeight < window.innerHeight - 100) {
    const thead = scrollWrap.querySelector('thead');
    const theadH = thead ? thead.clientHeight : 38;
    // Safety buffer (8px) ensures the last row never touches or submerges under the pinned footer
    const available = scrollWrap.clientHeight - theadH - 8;
    if (available > 100) {
      const rows = Math.floor(available / rowHeight);
      return Math.max(8, Math.min(15, rows));
    }
  }

  let top = 0;

  // 2. Measure the actual card/table shell element from the viewport top
  const tableEl = document.querySelector(
    '.customer-master-card, .enquiry-master-card, .settings-table-shell, .stocks-table-shell, .crm-table-workspace, .crm-table-viewport, .dc-table'
  );

  if (tableEl && typeof tableEl.getBoundingClientRect === 'function') {
    const rect = tableEl.getBoundingClientRect();
    if (rect.top > 0 && rect.top < window.innerHeight * 0.7) {
      top = rect.top;
    }
  }

  // 3. If top couldn't be determined from DOM, calculate from standard layout elements
  if (!top) {
    const topBar = document.querySelector('.top-navbar, .crm-top-bar, .app-header, .crm-sidebar-brand');
    const pageHeader = document.querySelector('.page-header-row, .page-header, .customer-page-header');
    const summary = document.querySelector('.summary-filter-grid, .operational-summary-bar, .metric-summary-bar, .stocks-overview-summary, .enquiry-status-strip, .po-metrics-grid, .product-analysis-strip, .kpi-cards-grid');

    const topBarHeight = topBar ? topBar.getBoundingClientRect().height : 50;
    const pageHeaderHeight = pageHeader ? pageHeader.getBoundingClientRect().height : 32;
    const summaryHeight = summary ? summary.getBoundingClientRect().height : 0;

    let toolbarHeight = 0;
    const toolbars = document.querySelectorAll('.crm-table-toolbar, .table-filter-bar, .filter-toolbar, .customer-toolbar-card, .table-controls-card, .stocks-content-header, .orders-tab-nav-bar, .proforma-status-filter-pills');
    toolbars.forEach((tb) => {
      toolbarHeight += tb.getBoundingClientRect().height;
    });
    if (toolbarHeight === 0) toolbarHeight = 48;

    top = topBarHeight + pageHeaderHeight + summaryHeight + toolbarHeight + 24;
  }

  // Fallback sanity clamp for top
  if (!top || top < 60) top = 185;

  // Overhead inside the table card:
  // - Toolbar inside card: ~48-52px (if present inside tableEl)
  // - Filter pills (like in proformas tab): ~38-44px (if present inside tableEl or its parent workspace)
  // - Table Header <thead>: ~38px
  // - Table Footer/Pagination: ~40px
  // - Card border / page padding buffer + safety margin: ~24px
  const internalToolbar = tableEl ? tableEl.querySelector('.crm-table-toolbar, .po-toolbar, .table-filter-bar') : null;
  const internalToolbarH = internalToolbar ? internalToolbar.getBoundingClientRect().height : 0;
  const parentCard = tableEl ? tableEl.closest('.orders-master-page, .crm-table-workspace, .stocks-master-page') : null;
  const filterPills = (tableEl && tableEl.querySelector('.proforma-status-filter-pills, .proforma-status-filter-bar')) ||
                      (parentCard && parentCard.querySelector('.proforma-status-filter-pills, .proforma-status-filter-bar'));
  const filterPillsH = filterPills ? filterPills.getBoundingClientRect().height : 0;
  const internalOverhead = 104 + internalToolbarH + filterPillsH;

  // Available vertical space for tbody rows
  const availableBodyHeight = window.innerHeight - top - internalOverhead;

  // Calculate row capacity strictly fitting available space without vertical scroll
  const exactRows = availableBodyHeight / rowHeight;
  const rows = Math.floor(exactRows);

  // Strict comfortable clamping: minimum 8 rows (laptop 768p), maximum 15 rows (desktop 1080p).
  // Prevents squashed/submerged text and distributes records naturally to subsequent pages.
  return Math.max(8, Math.min(15, rows));
}

export const DEFAULT_PAGE_SIZE = 16;

/**
 * Enterprise responsive table pagination hook.
 * Separates concerns:
 * - Width: 100% width via TableWorkspace
 * - Height: Content-driven natural height, no artificial empty tbody or fake rows
 * - Pagination: Dynamic visible row capacity adapting to viewport without fixed row rules
 *
 * @param {Array} items - The filtered, searched and sorted dataset to paginate
 * @param {Object} [options={}]
 * @param {number|'auto'} [options.pageSize] - Optional explicit page size; defaults to dynamic viewport capacity
 * @param {number} [options.rowHeight=43] - Row height for dynamic calculation
 * @param {Array} [options.resetDeps=[]] - Dependencies that should reset to page 1 (search, filter states)
 * @returns {Object}
 */
export function useTablePagination(items = [], options = {}) {
  const explicitPageSize = typeof options.pageSize === 'number' && options.pageSize > 0
    ? options.pageSize
    : null;

  const rowHeight = options.rowHeight || 43;

  const getCapacity = useCallback(() => {
    return explicitPageSize || calculateDynamicPageSize({ rowHeight });
  }, [explicitPageSize, rowHeight]);

  const [pageSize, setPageSize] = useState(getCapacity);

  useEffect(() => {
    if (explicitPageSize) {
      setPageSize(explicitPageSize);
      return;
    }

    let timeoutId = null;
    const handleResize = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        const nextCapacity = calculateDynamicPageSize({ rowHeight });
        setPageSize((prev) => (prev !== nextCapacity ? nextCapacity : prev));
      }, 100);
    };

    window.addEventListener('resize', handleResize);

    let ro = null;
    const target = document.querySelector('.crm-table-scroll-wrap, .crm-table-viewport, .crm-table-workspace, .stocks-table-natural-wrap');
    if (typeof ResizeObserver !== 'undefined' && target) {
      ro = new ResizeObserver(() => {
        handleResize();
      });
      ro.observe(target);
    }

    // Run re-measure shortly after initial mount to capture exact DOM layout
    const initialTimer = setTimeout(() => {
      const nextCapacity = calculateDynamicPageSize({ rowHeight });
      setPageSize((prev) => (prev !== nextCapacity ? nextCapacity : prev));
    }, 60);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (ro) ro.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
      clearTimeout(initialTimer);
    };
  }, [explicitPageSize, rowHeight]);

  // Re-measure when records load or update to adjust to exact rendered DOM layout
  useEffect(() => {
    if (!explicitPageSize) {
      const nextCapacity = calculateDynamicPageSize({ rowHeight });
      setPageSize((prev) => (prev !== nextCapacity ? nextCapacity : prev));
    }
  }, [items.length, explicitPageSize, rowHeight]);

  const [currentPage, setCurrentPage] = useState(1);
  const resetDeps = options.resetDeps || [];

  // Reset to page 1 whenever any filter or search dependency changes
  useEffect(() => {
    setCurrentPage(1);
  }, resetDeps); // eslint-disable-line react-hooks/exhaustive-deps

  const totalRecords = Array.isArray(items) ? items.length : 0;
  const effectivePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(totalRecords / effectivePageSize));

  // Recalculate and clamp page if records are deleted or page size changes and total pages shrink
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * effectivePageSize;
  const endIndex = Math.min(startIndex + effectivePageSize, totalRecords);

  const currentRecords = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return items.slice(startIndex, endIndex);
  }, [items, startIndex, endIndex]);

  const showingStart = totalRecords === 0 ? 0 : startIndex + 1;
  const showingEnd = endIndex;

  return {
    currentPage,
    setCurrentPage,
    pageSize: effectivePageSize,
    totalRecords,
    totalPages,
    currentRecords,
    currentItems: currentRecords,
    pageRecords: currentRecords,
    showingStart,
    showingEnd,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    goToNextPage: () => setCurrentPage((p) => Math.min(p + 1, totalPages)),
    goToPrevPage: () => setCurrentPage((p) => Math.max(p - 1, 1)),
    goToPage: (p) => setCurrentPage(Math.max(1, Math.min(p, totalPages))),
    footerProps: {
      currentPage,
      totalPages,
      total: totalRecords,
      showingStart,
      showingEnd,
      onPageChange: (p) => setCurrentPage(p)
    }
  };
}

export default useTablePagination;
