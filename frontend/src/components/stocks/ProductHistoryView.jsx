import React, { useEffect, useMemo, useState, useRef } from 'react';
import { apiFetch, apiUrl } from '../../api';
import { navigate } from '../../router';
import { formatDateTime } from '../../utils/dateUtils';
import { ArrowLeft, RefreshCw, FileText } from 'lucide-react';
import { filterRecordsBySearch } from '../../utils/searchHelper';
import './productHistory.css';

export function getProductStockStatus(available, minimumStock) {
  const avail = Number(available || 0);
  const min = Number(minimumStock || 0);
  if (avail <= 0) return 'OUT OF STOCK';
  if (avail <= min) return 'LOW STOCK';
  return 'IN STOCK';
}

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const EyeIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const SearchIcon = () => (
  <svg className="ph-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export default function ProductHistoryView({
  productId,
  product: initialProduct,
  initialMovementId = null,
  onBack,
  onOpenPriceHistory,
  user
}) {
  const [product, setProduct] = useState(initialProduct);
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'specs'
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [notFound, setNotFound] = useState(false);

  // Table state & modals
  const [expandedSerialsTxnIds, setExpandedSerialsTxnIds] = useState(new Set());
  const [expandedTxnIds, setExpandedTxnIds] = useState(new Set());
  const [selectedTxn, setSelectedTxn] = useState(null);

  // Reactive Filter Toolbar State
  const [searchQuery, setSearchQuery] = useState('');
  const [eventFilter, setEventFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [quantityFilter, setQuantityFilter] = useState('all');
  const [minQty, setMinQty] = useState('');
  const [maxQty, setMaxQty] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');

  const highlightedRowRef = useRef(null);

  const effId = product?.id || product?.code || productId;

  // Determine back navigation target and label
  const returnTo = typeof window !== 'undefined' ? sessionStorage.getItem('asicrm_product_return') : null;
  const backLabel = returnTo === '/stocks'
    ? 'Back to Overview'
    : returnTo === '/stocks/movements'
      ? 'Back to Stock Movement'
      : (returnTo && (returnTo.includes('quotation') || returnTo.includes('enquir')))
        ? 'Back to Quotation'
        : 'Back to Products';

  const handleBack = () => {
    const target = returnTo;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('asicrm_product_return');
      sessionStorage.removeItem('asicrm_product_from');
    }
    if (onBack) {
      onBack(target);
    } else if (target) {
      navigate(target);
    } else {
      navigate('/stocks/products');
    }
  };

  useEffect(() => {
    if (initialProduct) setProduct(initialProduct);
  }, [initialProduct]);

  const loadHistory = () => {
    if (!effId) {
      setNotFound(true);
      return;
    }
    setHistoryLoading(true);
    setNotFound(false);
    setLoadError('');

    apiFetch(apiUrl(`/api/stocks/products/${encodeURIComponent(effId)}/history`), {
      headers: { 'x-user-id': user?.id || 'USR-001' }
    })
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!res.ok) {
          throw new Error(`Server returned error ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        if (!json) return;
        if (json.success && Array.isArray(json.data)) {
          setHistory(json.data);
          if (json.product) {
            setProduct(json.product);
          }
        } else {
          setNotFound(true);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch product history:', err);
        setLoadError(err.message || 'Failed to load product history.');
      })
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    loadHistory();
  }, [effId]);

  // Scroll highlighted movement into view once loaded
  useEffect(() => {
    if (initialMovementId && history.length > 0) {
      setTimeout(() => {
        if (highlightedRowRef.current) {
          highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
  }, [initialMovementId, history]);

  // Product specs / metrics
  const totalStock = Number(product?.totalStock ?? product?.stock ?? 0);
  const reservedStock = Number(product?.reservedStock ?? 0);
  const availableStock = Number(product?.availableStock ?? Math.max(0, totalStock - reservedStock));
  const minimumStock = Number(product?.alertQuantity ?? product?.minimumStock ?? 0);
  const status = product?.status || getProductStockStatus(availableStock, minimumStock);

  const cost = Number(product?.cost || 0);
  const mrp = Number(product?.mrp || 0);
  const dealerPrice = Number(product?.dealerPrice || 0);
  const gst = Number(product?.gst || 0);
  const stockValue = Number(product?.stockValue || cost * totalStock);
  const grossProfit = mrp - cost;
  const grossMarginPct = mrp > 0 ? (grossProfit / mrp) * 100 : 0;
  const markupPct = cost > 0 ? (grossProfit / cost) * 100 : 0;

  const toggleSerials = (txnId) => {
    setExpandedSerialsTxnIds((prev) => {
      const next = new Set(prev);
      if (next.has(txnId)) next.delete(txnId);
      else next.add(txnId);
      return next;
    });
  };

  const toggleTxnId = (txnId) => {
    setExpandedTxnIds((prev) => {
      const next = new Set(prev);
      if (next.has(txnId)) next.delete(txnId);
      else next.add(txnId);
      return next;
    });
  };

  // Reactive filter calculation
  const filteredHistory = useMemo(() => {
    let list = [...(history || [])];

    // 1. Event / Type filter
    if (eventFilter !== 'all') {
      const ef = eventFilter.toLowerCase();
      list = list.filter((t) => {
        const evt = String(t.event || '').toLowerCase();
        const typ = String(t.type || '').toLowerCase();
        return evt === ef || typ === ef;
      });
    }

    // 2. Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      list = list.filter((t) => {
        const dStr = t.date || t.createdAt;
        if (!dStr) return true;
        const d = new Date(dStr);
        if (isNaN(d.getTime())) return true;

        if (dateFilter === 'today') return d >= todayStart && d <= todayEnd;
        if (dateFilter === 'yesterday') {
          const yStart = new Date(todayStart);
          yStart.setDate(yStart.getDate() - 1);
          const yEnd = new Date(todayEnd);
          yEnd.setDate(yEnd.getDate() - 1);
          return d >= yStart && d <= yEnd;
        }
        if (dateFilter === 'last7days') {
          const l7 = new Date(todayStart);
          l7.setDate(l7.getDate() - 7);
          return d >= l7 && d <= todayEnd;
        }
        if (dateFilter === 'last30days') {
          const l30 = new Date(todayStart);
          l30.setDate(l30.getDate() - 30);
          return d >= l30 && d <= todayEnd;
        }
        if (dateFilter === 'thisMonth') {
          const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          return d >= mStart && d <= mEnd;
        }
        if (dateFilter === 'prevMonth') {
          const pmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const pmEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
          return d >= pmStart && d <= pmEnd;
        }
        if (dateFilter === 'custom') {
          if (customStartDate) {
            const cs = new Date(customStartDate);
            cs.setHours(0, 0, 0, 0);
            if (d < cs) return false;
          }
          if (customEndDate) {
            const ce = new Date(customEndDate);
            ce.setHours(23, 59, 59, 999);
            if (d > ce) return false;
          }
          return true;
        }
        return true;
      });
    }

    // 3. Quantity filter
    if (quantityFilter !== 'all' || minQty !== '' || maxQty !== '') {
      list = list.filter((t) => {
        const qty = Number(t.quantity || 0);
        if (quantityFilter === 'inbound' && qty <= 0) return false;
        if (quantityFilter === 'outbound' && qty >= 0) return false;
        if (quantityFilter === 'zero' && qty !== 0) return false;

        const absQty = Math.abs(qty);
        if (minQty !== '') {
          const minVal = Number(minQty);
          if (!isNaN(minVal) && absQty < minVal) return false;
        }
        if (maxQty !== '') {
          const maxVal = Number(maxQty);
          if (!isNaN(maxVal) && absQty > maxVal) return false;
        }
        return true;
      });
    }

    // 4. Search filter
    if (searchQuery.trim()) {
      list = filterRecordsBySearch(list, searchQuery, [
        (t) => t.productName,
        (t) => t.productCode,
        (t) => t.productId,
        (t) => t.sku,
        (t) => t.event,
        (t) => t.type,
        (t) => t.reference,
        (t) => t.referenceId,
        (t) => t.poReference,
        (t) => t.partyName,
        (t) => t.supplierName,
        (t) => t.customerName,
        (t) => t.user,
        (t) => t.createdBy,
        (t) => t.remarks,
        (t) => t.notes,
        (t) => t.reason,
        (t) => (Array.isArray(t.serialNumbers) ? t.serialNumbers.join(' ') : '')
      ]);
    }

    // 5. Sorting
    list.sort((a, b) => {
      const diff = new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt);
      return sortOrder === 'newest' ? diff : -diff;
    });

    return list;
  }, [history, eventFilter, dateFilter, customStartDate, customEndDate, quantityFilter, minQty, maxQty, searchQuery, sortOrder]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    eventFilter !== 'all' ||
    dateFilter !== 'all' ||
    customStartDate ||
    customEndDate ||
    quantityFilter !== 'all' ||
    minQty !== '' ||
    maxQty !== '' ||
    sortOrder !== 'newest'
  );

  const resetFilters = () => {
    setSearchQuery('');
    setEventFilter('all');
    setDateFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setQuantityFilter('all');
    setMinQty('');
    setMaxQty('');
    setSortOrder('newest');
  };

  const statusClass = status === 'OUT OF STOCK' ? 'out-of-stock' : status === 'LOW STOCK' ? 'low-stock' : 'in-stock';

  if (!product && historyLoading) {
    return (
      <div className="product-history-view-container" style={{ padding: '24px 0' }}>
        <div style={{ marginBottom: '16px' }}>
          <button type="button" className="ph-back-btn" onClick={handleBack}>
            <ArrowLeft size={16} /> {backLabel}
          </button>
        </div>
        <div style={{ padding: '64px 20px', textAlign: 'center', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <h3 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: '18px', fontWeight: 700 }}>Loading Product History &amp; Ledger...</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>Retrieving authoritative inventory movement records.</p>
        </div>
      </div>
    );
  }

  if (notFound || (!product && !historyLoading && !effId)) {
    return (
      <div className="product-history-view-container" style={{ padding: '24px 0' }}>
        <div style={{ marginBottom: '16px' }}>
          <button type="button" className="ph-back-btn" onClick={handleBack}>
            <ArrowLeft size={16} /> {backLabel}
          </button>
        </div>
        <div style={{ padding: '64px 20px', textAlign: 'center', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '42px', marginBottom: '16px' }}>📦</div>
          <h3 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: '18px', fontWeight: 700 }}>Product Not Found</h3>
          <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '13px' }}>
            {effId ? `The requested product "${effId}" could not be found in Product Master.` : 'No product was selected.'}
          </p>
          <button type="button" className="ph-action-btn-primary" onClick={handleBack}>
            {backLabel}
          </button>
        </div>
      </div>
    );
  }

  if (loadError && !product) {
    return (
      <div className="product-history-view-container" style={{ padding: '24px 0' }}>
        <div style={{ marginBottom: '16px' }}>
          <button type="button" className="ph-back-btn" onClick={handleBack}>
            <ArrowLeft size={16} /> {backLabel}
          </button>
        </div>
        <div style={{ padding: '64px 20px', textAlign: 'center', background: '#fff', borderRadius: '10px', border: '1px solid #fee2e2', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '42px', marginBottom: '16px', color: '#ef4444' }}>⚠️</div>
          <h3 style={{ margin: '0 0 8px', color: '#991b1b', fontSize: '18px', fontWeight: 700 }}>Unable to Load Product History</h3>
          <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '13px' }}>{loadError}</p>
          <button type="button" className="ph-action-btn-primary" onClick={loadHistory}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="product-history-view-container">
      {/* =========================================================================
          PAGE HEADER (MATCHING PURCHASE ORDER DESIGN LANGUAGE)
          Left: Back Button, Eyebrow, Title + Status Badge, Subtitle
          Right: Tabs (Movement Ledger / Specs), Price History, Refresh
          ========================================================================= */}
      <div className="ph-page-header">
        <div className="ph-header-left">
          <button
            type="button"
            className="ph-back-btn"
            onClick={handleBack}
            title={backLabel}
          >
            <ArrowLeft size={16} /> {backLabel}
          </button>

          <div className="ph-header-titles">
            <div className="ph-header-eyebrow">PRODUCT HISTORY &amp; INVENTORY LEDGER</div>
            <div className="ph-header-title-row">
              <h1 className="ph-page-title">{product?.name || 'Product Details'}</h1>
              <span className={`ph-status-badge ${statusClass}`}>
                {status}
              </span>
            </div>
            <p className="ph-header-subtitle">
              {[product?.code, product?.brandName, product?.categoryName, product?.subcategoryName && product.subcategoryName !== '—' ? product.subcategoryName : null].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        <div className="ph-header-actions">
          {/* Mode Switcher Tabs */}
          <div className="ph-tabs-bar" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'history'}
              className={`ph-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              Movement Ledger ({history.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'specs'}
              className={`ph-tab-btn ${activeTab === 'specs' ? 'active' : ''}`}
              onClick={() => setActiveTab('specs')}
            >
              Specifications &amp; Pricing
            </button>
          </div>

          <button
            type="button"
            className="ph-action-btn-secondary"
            onClick={() => {
              navigate(`/stocks/products/${encodeURIComponent(product?.id || product?.code || effId)}/edit`);
            }}
            title="Edit this product"
          >
            Edit Product
          </button>

          <button
            type="button"
            className="ph-action-btn-secondary"
            onClick={() => {
              navigate(`/stocks/products/${encodeURIComponent(product?.id || product?.code || effId)}/movements`);
            }}
            title="Open dedicated Stock Movement ledger for this product"
          >
            Stock Movement
          </button>

          <button
            type="button"
            className="ph-action-btn-primary"
            onClick={() => {
              if (onOpenPriceHistory) onOpenPriceHistory(product);
              else navigate(`/stocks/products/${encodeURIComponent(product?.id || product?.code || effId)}/price-history`);
            }}
            title="Open dedicated Price History page"
          >
            Price History
          </button>

          <button
            type="button"
            className="ph-action-btn-secondary"
            onClick={loadHistory}
            disabled={historyLoading}
            title="Refresh product history ledger"
          >
            <RefreshCw size={14} className={historyLoading ? 'spin' : ''} />
            <span>{historyLoading ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          PRODUCT SUMMARY CARD (ENTERPRISE SaaS CARD MATCHING PO HEADER CARD)
          Top Row: Product Information (Name, SKU, Brand, Category, Type) | Total Value
          Bottom Grid: Unit, Current Stock, Available Stock, Minimum Stock, Status
          ========================================================================= */}
      <section className="ph-summary-card">
        <div className="ph-summary-top-row">
          <div className="ph-summary-info-block">
            <div className="ph-summary-label">PRODUCT INFORMATION</div>
            <h2 className="ph-summary-product-name">{product?.name || 'Product Details'}</h2>
            <div className="ph-summary-meta-line">
              <span><strong>SKU:</strong> {product?.code || '—'}</span>
              <span>·</span>
              <span><strong>Brand:</strong> {product?.brandName || '—'}</span>
              <span>·</span>
              <span><strong>Category:</strong> {product?.categoryName || '—'}</span>
              <span>·</span>
              <span><strong>Product Type:</strong> {product?.subcategoryName && product.subcategoryName !== '—' ? product.subcategoryName : (product?.categoryName || 'General')}</span>
            </div>
          </div>

          <div className="ph-summary-value-block">
            <div className="ph-summary-label">TOTAL VALUE</div>
            <div className="ph-summary-total-value">{money(stockValue)}</div>
            <div className="ph-summary-pill">
              <span><strong>Total Units:</strong> {totalStock} {(product?.unit && product.unit !== 'Piece') ? product.unit : 'Nos'}</span>
              <span style={{ color: '#cbd5e1' }}>|</span>
              <span style={{ color: availableStock > 0 ? '#16a34a' : '#dc2626' }}>
                <strong>Available:</strong> {availableStock} {(product?.unit && product.unit !== 'Piece') ? product.unit : 'Nos'}
              </span>
            </div>
          </div>
        </div>

        {/* 5-Column Statistics Grid */}
        <div className="ph-stats-grid">
          <div className="ph-stat-card">
            <span className="ph-stat-label">UNIT</span>
            <strong className="ph-stat-val">{(product?.unit && product.unit !== 'Piece') ? product.unit : 'Nos'}</strong>
          </div>

          <div className="ph-stat-card">
            <span className="ph-stat-label">CURRENT STOCK</span>
            <strong className="ph-stat-val">{totalStock} {(product?.unit && product.unit !== 'Piece') ? product.unit : 'Nos'}</strong>
          </div>

          <div className="ph-stat-card">
            <span className="ph-stat-label">AVAILABLE STOCK</span>
            <strong className="ph-stat-val" style={{ color: availableStock > 0 ? '#16a34a' : '#dc2626' }}>
              {availableStock} {(product?.unit && product.unit !== 'Piece') ? product.unit : 'Nos'}
            </strong>
          </div>

          <div className="ph-stat-card">
            <span className="ph-stat-label">MINIMUM STOCK</span>
            <strong className="ph-stat-val" style={{ color: '#475569' }}>
              {minimumStock} {(product?.unit && product.unit !== 'Piece') ? product.unit : 'Nos'}
            </strong>
          </div>

          <div className="ph-stat-card status-card">
            <span className="ph-stat-label">STATUS</span>
            <div>
              <span className={`ph-status-badge ${statusClass}`}>
                {status}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          TAB 1: MOVEMENT HISTORY & INVENTORY LEDGER (DEFAULT)
          ========================================================================= */}
      {activeTab === 'history' && (
        <section className="ph-section-card crm-table-workspace">
          <div className="ph-section-header">
            <div className="ph-section-title-wrap">
              <h3 className="ph-section-title">
                <FileText size={18} color="#2563eb" />
                <span>Movement History &amp; Inventory Ledger</span>
              </h3>
              <p className="ph-section-subtitle">
                Chronological audit trail of all inbound goods, outbound dispatches, returns, and adjustments.
              </p>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="ph-toolbar">
            <div className="ph-toolbar-controls">
              {/* Search */}
              <div className="ph-search-wrap">
                <SearchIcon />
                <input
                  type="text"
                  className="ph-search-input"
                  placeholder="Search ref, event, party, user, serials, remarks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                />
                {searchQuery && (
                  <button type="button" className="ph-search-clear" onClick={() => setSearchQuery('')} title="Clear search">
                    ×
                  </button>
                )}
              </div>

              {/* Movement Type Filter */}
              <select
                className="ph-select"
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                aria-label="Filter by Movement Type"
              >
                <option value="all">All Types</option>
                <option value="STOCK IN">STOCK IN</option>
                <option value="STOCK OUT">STOCK OUT</option>
                <option value="RETURN">RETURN</option>
                <option value="ADJUSTMENT">ADJUSTMENT</option>
                <option value="Goods Receipt">Goods Receipt (GRN)</option>
                <option value="Delivery Challan">Delivery Challan (DC)</option>
                <option value="Sales Invoice">Sales Invoice</option>
                <option value="Purchase Order">Purchase Order</option>
              </select>

              {/* Date Filter */}
              <select
                className="ph-select"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                aria-label="Filter by Date"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7days">Last 7 Days</option>
                <option value="last30days">Last 30 Days</option>
                <option value="thisMonth">This Month</option>
                <option value="prevMonth">Previous Month</option>
                <option value="custom">Custom Range</option>
              </select>

              {/* Custom Date Inputs */}
              {dateFilter === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="date"
                    className="ph-select"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>to</span>
                  <input
                    type="date"
                    className="ph-select"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              )}

              {/* Quantity Filter */}
              <select
                className="ph-select"
                value={quantityFilter}
                onChange={(e) => setQuantityFilter(e.target.value)}
                aria-label="Filter by Quantity"
              >
                <option value="all">All Quantities</option>
                <option value="inbound">Inbound (+)</option>
                <option value="outbound">Outbound (-)</option>
                <option value="zero">Zero Movement (0)</option>
              </select>

              {/* Min and Max Qty */}
              <div className="ph-qty-box">
                <input
                  type="number"
                  placeholder="Min"
                  className="ph-qty-input"
                  value={minQty}
                  onChange={(e) => setMinQty(e.target.value)}
                  min="0"
                />
                <span style={{ color: '#94a3b8' }}>–</span>
                <input
                  type="number"
                  placeholder="Max"
                  className="ph-qty-input"
                  value={maxQty}
                  onChange={(e) => setMaxQty(e.target.value)}
                  min="0"
                />
              </div>

              {/* Sort Order */}
              <select
                className="ph-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                aria-label="Sort Order"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  type="button"
                  className="ph-clear-btn"
                  onClick={resetFilters}
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="ph-toolbar-meta">
              <span>
                Showing <strong>{filteredHistory.length}</strong> of <strong>{history.length}</strong> transactions
                {hasActiveFilters ? ' (filtered)' : ''}
              </span>
              <span>Click any row or 👁 icon to view complete audit information</span>
            </div>
          </div>

          {/* Main 8-Column Movement History Table */}
          <div className="ph-table-container crm-table-viewport">
            {historyLoading && history.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                <div className="spinner" style={{ margin: '0 auto 12px', width: '28px', height: '28px', border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                Loading inventory ledger...
              </div>
            ) : filteredHistory.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📦</div>
                <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '15px' }}>
                  {history.length === 0 ? 'No Movement History' : 'No Transactions Found'}
                </div>
                <div style={{ fontSize: '13px', marginTop: '4px' }}>
                  {history.length === 0
                    ? 'No stock movements have been recorded for this product yet.'
                    : 'Try resetting filters to view all historical transactions.'}
                </div>
              </div>
            ) : (
              <table className="ph-table crm-master-table">
                <colgroup>
                  <col className="col-ph-date" style={{ width: '14%' }} />
                  <col className="col-ph-type" style={{ width: '10%' }} />
                  <col className="col-ph-qty" style={{ width: '10%' }} />
                  <col className="col-ph-ref" style={{ width: '13%' }} />
                  <col className="col-ph-user" style={{ width: '10%' }} />
                  <col className="col-ph-stock-before" style={{ width: '10%' }} />
                  <col className="col-ph-stock-after" style={{ width: '10%' }} />
                  <col className="col-ph-details" style={{ width: '23%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>DATE</th>
                    <th style={{ textAlign: 'center' }}>TYPE</th>
                    <th style={{ textAlign: 'right' }}>QUANTITY</th>
                    <th style={{ textAlign: 'left' }}>REFERENCE</th>
                    <th style={{ textAlign: 'left' }}>USER</th>
                    <th style={{ textAlign: 'right' }}>STOCK BEFORE</th>
                    <th style={{ textAlign: 'right' }}>STOCK AFTER</th>
                    <th style={{ textAlign: 'left' }}>DETAILS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((txn, idx) => {
                    const txnId = txn.id || txn.movementId || `txn-${idx}`;
                    const rawTxnId = txn.id || txn.movementId;
                    const isTxnIdExpanded = expandedTxnIds.has(txnId);
                    const isHighlighted = initialMovementId && (txn.id === initialMovementId || txn.movementId === initialMovementId);
                    const isSerialsExpanded = expandedSerialsTxnIds.has(txnId);
                    const serials = Array.isArray(txn.serialNumbers) ? txn.serialNumbers : [];
                    const qtyNum = Number(txn.quantity || 0);
                    const isPositive = qtyNum > 0;
                    const isNegative = qtyNum < 0;

                    let badgeClass = 'ph-status-badge in-stock';
                    const typeStr = String(txn.type || txn.event || '').toUpperCase();
                    if (typeStr.includes('IN') || typeStr.includes('RECEIPT') || typeStr.includes('ADDED')) {
                      badgeClass = 'ph-status-badge in-stock';
                    } else if (typeStr.includes('OUT') || typeStr.includes('CHALLAN') || typeStr.includes('INVOICE')) {
                      badgeClass = 'ph-status-badge'; // neutral slate
                    } else if (typeStr.includes('ADJUST')) {
                      badgeClass = 'ph-status-badge low-stock';
                    } else if (typeStr.includes('RETURN')) {
                      badgeClass = 'ph-status-badge'; // blue
                    } else if (typeStr.includes('PURCHASE')) {
                      badgeClass = 'ph-status-badge'; // purple
                    }

                    const ref = String(txn.reference || txn.referenceId || '');
                    const isDc = ref.startsWith('DC-') || txn.event === 'Delivery Challan';
                    const isInv = ref.startsWith('INV-') || txn.event === 'Sales Invoice';
                    const isGrn = ref.startsWith('GRN-') || txn.event === 'Goods Receipt';
                    const isPo = ref.startsWith('PO-') || txn.event === 'Purchase Order';

                    const sAfter = txn.stockAfter !== undefined && txn.stockAfter !== null ? Number(txn.stockAfter) : totalStock;
                    const sBefore = txn.stockBefore !== undefined && txn.stockBefore !== null ? Number(txn.stockBefore) : (sAfter - qtyNum);

                    return (
                      <tr
                        key={txnId}
                        ref={isHighlighted ? highlightedRowRef : null}
                        className={`ph-row-clickable ${isHighlighted ? 'ph-row-highlighted' : ''}`}
                        onClick={() => setSelectedTxn(txn)}
                        title="Click to view full transaction audit details"
                      >
                        {/* 1. DATE */}
                        <td>
                          <div className="ph-cell-date-main">{formatDateTime(txn.date || txn.createdAt)}</div>
                          {rawTxnId ? (
                            <div className="ph-txnid-dropdown-wrap" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="ph-txnid-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTxnId(txnId);
                                }}
                                title={isTxnIdExpanded ? "Click to collapse Transaction ID" : "Click to view full Transaction ID"}
                                aria-expanded={isTxnIdExpanded}
                              >
                                <span>Transaction ID {isTxnIdExpanded ? '▲' : '▼'}</span>
                              </button>
                              {isTxnIdExpanded && (
                                <div className="ph-txnid-expanded-value">
                                  {rawTxnId}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="ph-cell-date-id">—</div>
                          )}
                        </td>

                        {/* 2. TYPE */}
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={badgeClass}
                            style={{
                              backgroundColor: typeStr.includes('IN') || typeStr.includes('RECEIPT') ? '#ecfdf5' :
                                               typeStr.includes('PURCHASE') ? '#f5f3ff' :
                                               typeStr.includes('RETURN') ? '#eff6ff' :
                                               typeStr.includes('ADJUST') ? '#fffbeb' : '#f1f5f9',
                              color: typeStr.includes('IN') || typeStr.includes('RECEIPT') ? '#047857' :
                                     typeStr.includes('PURCHASE') ? '#7c3aed' :
                                     typeStr.includes('RETURN') ? '#2563eb' :
                                     typeStr.includes('ADJUST') ? '#b45309' : '#475569',
                              borderColor: typeStr.includes('IN') || typeStr.includes('RECEIPT') ? '#a7f3d0' :
                                           typeStr.includes('PURCHASE') ? '#ddd6fe' :
                                           typeStr.includes('RETURN') ? '#bfdbfe' :
                                           typeStr.includes('ADJUST') ? '#fde68a' : '#cbd5e1'
                            }}
                          >
                            {txn.type || txn.event || 'Transaction'}
                          </span>
                        </td>

                        {/* 3. QUANTITY */}
                        <td style={{ textAlign: 'right' }}>
                          <span className={`ph-cell-qty ${isPositive ? 'positive' : isNegative ? 'negative' : 'neutral'}`}>
                            {isPositive ? `+${qtyNum}` : isNegative ? `${qtyNum}` : '0'}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '3px' }}>
                            {(product?.unit && product.unit !== 'Piece') ? product.unit : 'Nos'}
                          </span>
                        </td>

                        {/* 4. REFERENCE */}
                        <td>
                          {isDc ? (
                            <button
                              type="button"
                              className="ph-ref-link"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate('/delivery-challans/' + ref);
                              }}
                              title={`Open Delivery Challan ${ref}`}
                            >
                              <span>{ref}</span>
                              <EyeIcon size={12} />
                            </button>
                          ) : isInv ? (
                            <button
                              type="button"
                              className="ph-ref-link"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate('/orders/invoices/' + ref);
                              }}
                              title={`Open Sales Invoice ${ref}`}
                            >
                              <span>{ref}</span>
                              <EyeIcon size={12} />
                            </button>
                          ) : isGrn ? (
                            <button
                              type="button"
                              className="ph-ref-link"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(txn.poReference ? `/purchase-orders/${txn.poReference}` : '/purchase-orders/history');
                              }}
                              title={`Open Goods Receipt ${ref}${txn.poReference ? ` (PO: ${txn.poReference})` : ''}`}
                            >
                              <span>{ref}</span>
                              <EyeIcon size={12} />
                            </button>
                          ) : isPo ? (
                            <button
                              type="button"
                              className="ph-ref-link"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/purchase-orders/${ref}`);
                              }}
                              title={`Open Purchase Order ${ref}`}
                            >
                              <span>{ref}</span>
                              <EyeIcon size={12} />
                            </button>
                          ) : (
                            <span style={{ fontFamily: 'monospace', color: '#475569', fontWeight: 600 }}>
                              {ref || '—'}
                            </span>
                          )}
                        </td>

                        {/* 5. USER */}
                        <td>
                          <span style={{ color: '#475569', fontSize: '13px' }}>
                            {txn.user || txn.createdBy || 'System'}
                          </span>
                        </td>

                        {/* 6. STOCK BEFORE */}
                        <td style={{ textAlign: 'right' }}>
                          <span style={{ color: '#64748b', fontWeight: 600, fontSize: '13px' }}>
                            {sBefore}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '3px' }}>
                            {(product?.unit && product.unit !== 'Piece') ? product.unit : 'Nos'}
                          </span>
                        </td>

                        {/* 7. STOCK AFTER */}
                        <td style={{ textAlign: 'right' }}>
                          <span style={{ color: '#94a3b8', fontSize: '11px', marginRight: '3px' }}>→</span>
                          <strong style={{ color: '#0f172a', fontWeight: 700, fontSize: '13.5px' }}>
                            {sAfter}
                          </strong>
                          <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '3px' }}>
                            {(product?.unit && product.unit !== 'Piece') ? product.unit : 'Nos'}
                          </span>
                        </td>

                        {/* 8. DETAILS */}
                        <td>
                          <div className="ph-details-wrap">
                            <div className="ph-details-text">
                              {(txn.supplierName || txn.customerName || txn.partyName) && (
                                <div className="ph-details-party">
                                  {txn.supplierName ? `Supplier: ${txn.supplierName}` : txn.customerName ? `Customer: ${txn.customerName}` : txn.partyName}
                                </div>
                              )}
                              {txn.remarks && (
                                <span className="ph-details-remarks" title={txn.remarks}>
                                  {txn.remarks}
                                </span>
                              )}
                              {serials.length > 0 && (
                                <div className="ph-serials-dropdown-wrap" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="ph-serials-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleSerials(txnId);
                                    }}
                                    title={isSerialsExpanded ? "Click to collapse serial numbers" : "Click to view serial numbers"}
                                    aria-expanded={isSerialsExpanded}
                                  >
                                    <span>{serials.length} serials {isSerialsExpanded ? '▲' : '▼'}</span>
                                  </button>
                                  {isSerialsExpanded && (
                                    <div className="ph-serials-list">
                                      {serials.map((sn, sIdx) => (
                                        <span
                                          key={sIdx}
                                          className="ph-serial-pill"
                                          title="Click to track complete serial lifecycle"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/serials?q=${encodeURIComponent(sn)}`);
                                          }}
                                          style={{ cursor: 'pointer' }}
                                        >
                                          {sn}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <button
                              type="button"
                              className="ph-audit-eye-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTxn(txn);
                              }}
                              title="View full audit information"
                              aria-label="View Audit"
                            >
                              <EyeIcon size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {filteredHistory.length > 0 && (
              <div className="crm-table-footer" style={{ padding: '10px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748b' }}>
                <span>Showing {filteredHistory.length} {filteredHistory.length === 1 ? 'transaction' : 'transactions'}</span>
                <span>Click any row for details</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* =========================================================================
          TAB 2: SPECIFICATIONS & PRICING
          ========================================================================= */}
      {activeTab === 'specs' && (
        <section className="ph-section-card">
          {/* Basic Information */}
          <div className="ph-specs-section">
            <div className="ph-specs-section-title">
              <span>Basic Information</span>
            </div>
            <div className="ph-specs-grid">
              <div className="ph-specs-item"><small>SKU / Code</small><strong style={{ fontFamily: 'monospace' }}>{product?.code || '—'}</strong></div>
              <div className="ph-specs-item"><small>Category</small><strong>{product?.categoryName || '—'}</strong></div>
              <div className="ph-specs-item"><small>Subcategory</small><strong>{product?.subcategoryName || '—'}</strong></div>
              <div className="ph-specs-item"><small>Brand</small><strong>{product?.brandName || '—'}</strong></div>
              <div className="ph-specs-item"><small>Unit</small><strong>{(product?.unit && product.unit !== 'Piece') ? product.unit : 'Nos'}</strong></div>
              <div className="ph-specs-item"><small>Unit Value / Size</small><strong>{product?.size || '—'}</strong></div>
              <div className="ph-specs-item"><small>HSN / SAC</small><strong>{product?.hsnSac || '—'}</strong></div>
              <div className="ph-specs-item"><small>Serialization</small><strong>{product?.serialized ? 'Yes (Unique Serial Numbers)' : 'No (Standard Quantity)'}</strong></div>
            </div>
            {product?.description && (
              <div style={{ marginTop: '14px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 14px', borderRadius: '6px', fontSize: '13px', color: '#334155' }}>
                <small style={{ color: '#64748b', display: 'block', marginBottom: '2px', fontWeight: 600, textTransform: 'uppercase', fontSize: '11px' }}>Description</small>
                {product.description}
              </div>
            )}
          </div>

          {/* Pricing & Margins */}
          <div className="ph-specs-section">
            <div className="ph-specs-section-title">
              <span>Pricing &amp; Profitability</span>
              <button
                type="button"
                className="crm-btn-secondary compact"
                onClick={() => {
                  if (onOpenPriceHistory) onOpenPriceHistory(product);
                  else navigate(`/stocks/products/${encodeURIComponent(product?.id || product?.code || effId)}/price-history`);
                }}
                style={{ fontSize: '12px' }}
              >
                View Historical Rates →
              </button>
            </div>
            <div className="ph-specs-grid">
              <div className="ph-specs-item">
                <small>Purchase Cost (Benchmark)</small>
                <strong style={{ fontSize: '15px' }}>{money(cost)}</strong>
                {product?.highestInwardRate && Number(product.highestInwardRate) > 0 ? (
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, display: 'block', marginTop: '2px' }} title="Highest inward rate recorded across purchase batches (Profit Protection Rule)">
                    Highest Inward: {money(product.highestInwardRate)}
                  </span>
                ) : null}
              </div>
              <div className="ph-specs-item"><small>Dealer Price</small><strong style={{ fontSize: '15px' }}>{money(dealerPrice)}</strong></div>
              <div className="ph-specs-item"><small>MRP</small><strong style={{ fontSize: '15px' }}>{money(mrp)}</strong></div>
              <div className="ph-specs-item"><small>Gross Profit</small><strong style={{ fontSize: '15px', color: '#0f766e' }}>{money(grossProfit)}</strong></div>
              <div className="ph-specs-item"><small>Gross Margin</small><strong style={{ fontSize: '15px' }}>{grossMarginPct.toFixed(1)}%</strong></div>
              <div className="ph-specs-item"><small>Markup on Cost</small><strong style={{ fontSize: '15px' }}>{markupPct.toFixed(1)}%</strong></div>
            </div>
          </div>

          {/* Tax Information */}
          <div className="ph-specs-section">
            <div className="ph-specs-section-title">
              <span>Tax Configuration</span>
            </div>
            <div className="ph-specs-grid">
              <div className="ph-specs-item"><small>Base GST</small><strong>{gst.toFixed(2)}%</strong></div>
              <div className="ph-specs-item"><small>IGST (Inter-state)</small><strong>{gst.toFixed(2)}%</strong></div>
              <div className="ph-specs-item"><small>CGST (Intra-state)</small><strong>{(gst / 2).toFixed(2)}%</strong></div>
              <div className="ph-specs-item"><small>SGST (Intra-state)</small><strong>{(gst / 2).toFixed(2)}%</strong></div>
            </div>
          </div>

          {/* Quotation Details */}
          {(product?.productDetails || product?.productLink) && (
            <div className="ph-specs-section">
              <div className="ph-specs-section-title">
                <span>Quotation Content</span>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 14px', borderRadius: '6px', fontSize: '13px' }}>
                {product?.productDetails && <div style={{ marginBottom: '8px' }}><strong>Details: </strong>{product.productDetails}</div>}
                {product?.productLink && <div><strong>Link: </strong><a href={product.productLink} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>{product.productLink}</a></div>}
              </div>
            </div>
          )}
        </section>
      )}

      {/* =========================================================================
          FULL AUDIT DETAILS DRAWER / MODAL
          ========================================================================= */}
      {selectedTxn && (
        <ProductMovementAuditModal
          txn={selectedTxn}
          product={product}
          liveStock={totalStock}
          formatDateTime={formatDateTime}
          onClose={() => setSelectedTxn(null)}
        />
      )}
    </div>
  );
}

export function ProductMovementAuditModal({ txn, product, liveStock, formatDateTime, onClose }) {
  if (!txn) return null;
  const qtyNum = Number(txn.quantity || 0);
  const isPositive = qtyNum > 0;
  const isNegative = qtyNum < 0;
  const serials = Array.isArray(txn.serialNumbers) ? txn.serialNumbers : [];

  let badgeClass = 'ph-status-badge in-stock';
  const typeStr = String(txn.type || txn.event || '').toUpperCase();
  if (typeStr.includes('IN') || typeStr.includes('RECEIPT') || typeStr.includes('ADDED')) {
    badgeClass = 'ph-status-badge in-stock';
  } else if (typeStr.includes('OUT') || typeStr.includes('CHALLAN') || typeStr.includes('INVOICE')) {
    badgeClass = 'ph-status-badge'; // neutral slate
  } else if (typeStr.includes('ADJUST')) {
    badgeClass = 'ph-status-badge low-stock';
  } else if (typeStr.includes('RETURN')) {
    badgeClass = 'ph-status-badge'; // blue
  } else if (typeStr.includes('PURCHASE')) {
    badgeClass = 'ph-status-badge'; // purple
  }

  const ref = String(txn.reference || txn.referenceId || '');
  const isDc = ref.startsWith('DC-') || txn.event === 'Delivery Challan';
  const isInv = ref.startsWith('INV-') || txn.event === 'Sales Invoice';
  const isGrn = ref.startsWith('GRN-') || txn.event === 'Goods Receipt';
  const isPo = ref.startsWith('PO-') || txn.event === 'Purchase Order';

  const rawUnit = txn.unit || product?.unit;
  const unit = (rawUnit && rawUnit !== 'Piece') ? rawUnit : 'Nos';
  const sAfter = txn.stockAfter !== undefined && txn.stockAfter !== null ? Number(txn.stockAfter) : liveStock;
  const sBefore = txn.stockBefore !== undefined && txn.stockBefore !== null ? Number(txn.stockBefore) : (sAfter - qtyNum);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="product-audit-modal-backdrop" onClick={onClose}>
      <div className="product-audit-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="product-audit-modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>Transaction Audit Details</h3>
            <span
              className={badgeClass}
              style={{
                backgroundColor: typeStr.includes('IN') || typeStr.includes('RECEIPT') ? '#ecfdf5' :
                                 typeStr.includes('PURCHASE') ? '#f5f3ff' :
                                 typeStr.includes('RETURN') ? '#eff6ff' :
                                 typeStr.includes('ADJUST') ? '#fffbeb' : '#f1f5f9',
                color: typeStr.includes('IN') || typeStr.includes('RECEIPT') ? '#047857' :
                       typeStr.includes('PURCHASE') ? '#7c3aed' :
                       typeStr.includes('RETURN') ? '#2563eb' :
                       typeStr.includes('ADJUST') ? '#b45309' : '#475569',
                borderColor: typeStr.includes('IN') || typeStr.includes('RECEIPT') ? '#a7f3d0' :
                             typeStr.includes('PURCHASE') ? '#ddd6fe' :
                             typeStr.includes('RETURN') ? '#bfdbfe' :
                             typeStr.includes('ADJUST') ? '#fde68a' : '#cbd5e1'
              }}
            >
              {txn.type || txn.event || 'Transaction'}
            </span>
          </div>
          <button type="button" className="product-audit-modal-close" onClick={onClose} aria-label="Close modal" style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}>
            ✕
          </button>
        </div>

        <div className="product-audit-modal-body" style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Complete 15-Field Audit Grid */}
          <div className="product-audit-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
            <div className="product-audit-item">
              <span className="product-audit-label" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Movement / Transaction ID</span>
              <strong style={{ fontFamily: 'monospace', fontSize: '13px', color: '#0f172a' }}>{txn.id || txn.movementId || '—'}</strong>
            </div>

            <div className="product-audit-item">
              <span className="product-audit-label" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date &amp; Time</span>
              <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>{formatDateTime(txn.date || txn.createdAt)}</span>
            </div>

            <div className="product-audit-item">
              <span className="product-audit-label" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Product</span>
              <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>{product?.name || txn.productName}</strong>
            </div>

            <div className="product-audit-item">
              <span className="product-audit-label" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>SKU</span>
              <span style={{ fontFamily: 'monospace', fontSize: '13px', color: '#0f172a' }}>{product?.code || txn.productCode || txn.sku}</span>
            </div>

            <div className="product-audit-item">
              <span className="product-audit-label" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Type</span>
              <span
                className={badgeClass}
                style={{
                  backgroundColor: typeStr.includes('IN') || typeStr.includes('RECEIPT') ? '#ecfdf5' :
                                   typeStr.includes('PURCHASE') ? '#f5f3ff' :
                                   typeStr.includes('RETURN') ? '#eff6ff' :
                                   typeStr.includes('ADJUST') ? '#fffbeb' : '#f1f5f9',
                  color: typeStr.includes('IN') || typeStr.includes('RECEIPT') ? '#047857' :
                         typeStr.includes('PURCHASE') ? '#7c3aed' :
                         typeStr.includes('RETURN') ? '#2563eb' :
                         typeStr.includes('ADJUST') ? '#b45309' : '#475569',
                  borderColor: typeStr.includes('IN') || typeStr.includes('RECEIPT') ? '#a7f3d0' :
                               typeStr.includes('PURCHASE') ? '#ddd6fe' :
                               typeStr.includes('RETURN') ? '#bfdbfe' :
                               typeStr.includes('ADJUST') ? '#fde68a' : '#cbd5e1',
                  marginTop: '2px'
                }}
              >
                {txn.type || txn.event}
              </span>
            </div>

            <div className="product-audit-item">
              <span className="product-audit-label" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Quantity</span>
              <strong style={{ fontSize: '14px', color: isPositive ? '#16a34a' : isNegative ? '#dc2626' : '#64748b' }}>
                {isPositive ? `+${qtyNum}` : isNegative ? `${qtyNum}` : '0'} {unit}
              </strong>
            </div>

            <div className="product-audit-item">
              <span className="product-audit-label" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Unit</span>
              <span style={{ fontSize: '13px', color: '#0f172a' }}>{unit}</span>
            </div>

            <div className="product-audit-item">
              <span className="product-audit-label" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Reference</span>
              <strong style={{ color: '#2563eb', fontSize: '13px', fontFamily: 'monospace' }}>{ref || '—'}</strong>
            </div>

            <div className="product-audit-item">
              <span className="product-audit-label" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Source</span>
              <span style={{ fontSize: '13px', color: '#0f172a' }}>{txn.source || (typeStr.includes('IN') ? (txn.supplierName || 'Inward / Supplier') : 'Main Warehouse')}</span>
            </div>

            <div className="product-audit-item">
              <span className="product-audit-label" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Destination</span>
              <span style={{ fontSize: '13px', color: '#0f172a' }}>{txn.destination || (typeStr.includes('OUT') ? (txn.customerName || 'Dispatch / Customer') : 'Main Warehouse')}</span>
            </div>

            <div className="product-audit-item">
              <span className="product-audit-label" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Stock Before</span>
              <strong style={{ fontSize: '13.5px', color: '#475569' }}>{sBefore} {unit}</strong>
            </div>

            <div className="product-audit-item">
              <span className="product-audit-label" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Stock After</span>
              <strong style={{ fontSize: '14px', color: '#0f172a' }}>{sAfter} {unit}</strong>
            </div>

            <div className="product-audit-item">
              <span className="product-audit-label" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>User</span>
              <span style={{ fontSize: '13px', color: '#0f172a' }}>{txn.user || txn.createdBy || 'System'}</span>
            </div>

            <div className="product-audit-item">
              <span className="product-audit-label" style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Counter-Party</span>
              <span style={{ fontSize: '13px', color: '#0f172a' }}>
                {txn.supplierName ? `Supplier: ${txn.supplierName}` : txn.customerName ? `Customer: ${txn.customerName}` : txn.partyName || '—'}
              </span>
            </div>
          </div>

          {/* Reason & Notes */}
          {(txn.reason || txn.remarks || txn.notes) && (
            <div style={{ marginTop: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
              <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                Reason / Notes
              </span>
              <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                {txn.reason || txn.remarks || txn.notes}
              </div>
            </div>
          )}

          {/* Serials */}
          {serials.length > 0 && (
            <div style={{ marginTop: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
              <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                Serialized Units ({serials.length})
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                {serials.map((sn, sIdx) => (
                  <span
                    key={sIdx}
                    title="Click to track complete serial lifecycle"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/serials?q=${encodeURIComponent(sn)}`);
                    }}
                    style={{
                      background: '#e2e8f0',
                      border: '1px solid #cbd5e1',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11.5px',
                      fontFamily: 'monospace',
                      color: '#1e293b',
                      cursor: 'pointer'
                    }}
                  >
                    {sn}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with quick links */}
        <div className="product-audit-modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#f8fafc', borderRadius: '0 0 10px 10px' }}>
          {isGrn && (
            <button
              type="button"
              className="ph-action-btn-primary"
              onClick={() => {
                onClose();
                navigate(txn.poReference ? `/purchase-orders/${txn.poReference}` : '/purchase-orders/history');
              }}
            >
              View Goods Receipt
            </button>
          )}
          {isPo && (
            <button
              type="button"
              className="ph-action-btn-primary"
              onClick={() => {
                onClose();
                navigate(`/purchase-orders/${ref}`);
              }}
            >
              View Purchase Order
            </button>
          )}
          {isDc && (
            <button
              type="button"
              className="ph-action-btn-primary"
              onClick={() => {
                onClose();
                navigate(`/delivery-challans/${ref}`);
              }}
            >
              View Delivery Challan
            </button>
          )}
          {isInv && (
            <button
              type="button"
              className="ph-action-btn-primary"
              onClick={() => {
                onClose();
                navigate(`/orders/invoices/${ref}`);
              }}
            >
              View Sales Invoice
            </button>
          )}
          <button type="button" className="ph-action-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
