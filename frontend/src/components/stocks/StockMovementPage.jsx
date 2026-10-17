import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch, apiUrl } from '../../api';
import { navigate } from '../../router';
import { formatDateTime } from '../../utils/dateUtils';
import StockMovementDetailModal from './StockMovementDetailModal';
import NewStockMovementModal from './NewStockMovementModal';
import StockMovementEditModal from './StockMovementEditModal';
import StockMovementVoidModal from './StockMovementVoidModal';
import { TableFooter, useTablePagination } from '../common/TableWorkspace';
import { filterRecordsBySearch } from '../../utils/searchHelper';

const EyeIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const PencilIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

const Trash2Icon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

export default function StockMovementPage({
  user,
  productId,
  onBack,
  onNavigateOverview,
  onOpenProductHistory,
  products = [],
  onRefreshData
}) {
  const queryProductId = typeof window !== 'undefined'
    ? (new URLSearchParams(window.location.search).get('productId') || new URLSearchParams(window.location.search).get('product'))
    : null;
  const effectiveProductId = productId || queryProductId || null;

  const [productInfo, setProductInfo] = useState(() => {
    if (products && products.length > 0 && effectiveProductId) {
      return products.find(p =>
        String(p.id).toLowerCase() === String(effectiveProductId).toLowerCase() ||
        String(p.code).toLowerCase() === String(effectiveProductId).toLowerCase()
      ) || null;
    }
    return null;
  });

  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modals
  const [selectedMovement, setSelectedMovement] = useState(null);
  const [newMovementOpen, setNewMovementOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState(null);
  const [voidingMovement, setVoidingMovement] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [priceFilter, setPriceFilter] = useState('ALL');
  const [customMinPrice, setCustomMinPrice] = useState('');
  const [customMaxPrice, setCustomMaxPrice] = useState('');
  const [expandedTxnIds, setExpandedTxnIds] = useState(new Set());

  const toggleTxnId = (id) => {
    setExpandedTxnIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!effectiveProductId) {
      setProductInfo(null);
      return;
    }
    let isMounted = true;
    const fetchProduct = async () => {
      try {
        const res = await apiFetch(apiUrl(`/api/stocks/products/${encodeURIComponent(effectiveProductId)}/history`), {
          headers: { 'x-user-id': user?.id || 'USR-001' }
        });
        const json = await res.json();
        if (json.success && json.product && isMounted) {
          setProductInfo(json.product);
        }
      } catch (err) {
        console.error('Error fetching product for stock movement:', err);
      }
    };
    fetchProduct();
    return () => { isMounted = false; };
  }, [effectiveProductId, user?.id]);

  const fetchMovements = async () => {
    setLoading(true);
    setError('');
    try {
      const url = effectiveProductId
        ? apiUrl(`/api/stocks/movements?limit=500&productId=${encodeURIComponent(effectiveProductId)}`)
        : apiUrl('/api/stocks/movements?limit=500');
      const res = await apiFetch(url, {
        headers: { 'x-user-id': user?.id || 'USR-001' }
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to load stock movements.');
      }
      setMovements(json.data || []);
    } catch (err) {
      console.error('Error fetching stock movements:', err);
      setError(err.message || 'Unable to load stock movement ledger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [effectiveProductId]);

  const handleRefresh = () => {
    fetchMovements();
    if (onRefreshData) onRefreshData();
  };

  const hasActiveFilters = Boolean(
    search.trim() ||
    typeFilter !== 'ALL' ||
    dateFilter !== 'ALL' ||
    customStart ||
    customEnd ||
    priceFilter !== 'ALL' ||
    customMinPrice ||
    customMaxPrice
  );

  const resetFilters = () => {
    setSearch('');
    setTypeFilter('ALL');
    setDateFilter('ALL');
    setCustomStart('');
    setCustomEnd('');
    setPriceFilter('ALL');
    setCustomMinPrice('');
    setCustomMaxPrice('');
  };

  // Filtered movements
  const filteredMovements = useMemo(() => {
    let list = [...movements];

    // 1. Type Filter
    if (typeFilter !== 'ALL') {
      list = list.filter((m) => {
        const mType = String(m.type || '').toUpperCase();
        if (typeFilter === 'RETURN') return mType === 'RETURN' || mType === 'RETURNED';
        if (typeFilter === 'ADJUSTMENT') return mType === 'ADJUSTMENT' || mType === 'ADJUSTED';
        return mType === typeFilter;
      });
    }

    // 2. Date Filter
    if (dateFilter !== 'ALL') {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      list = list.filter((m) => {
        const d = new Date(m.date || m.createdAt);
        if (isNaN(d.getTime())) return true;

        if (dateFilter === 'today') {
          return d >= todayStart && d <= todayEnd;
        }
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
        if (dateFilter === 'custom') {
          if (customStart) {
            const cs = new Date(customStart);
            cs.setHours(0, 0, 0, 0);
            if (d < cs) return false;
          }
          if (customEnd) {
            const ce = new Date(customEnd);
            ce.setHours(23, 59, 59, 999);
            if (d > ce) return false;
          }
          return true;
        }
        return true;
      });
    }

    // 3. Price Filter (matches entry rate or transaction amount)
    if (priceFilter !== 'ALL') {
      list = list.filter((m) => {
        const rate = Number(
          m.unitRate !== undefined && m.unitRate !== null
            ? m.unitRate
            : (m.amount !== undefined && m.amount !== null
                ? m.amount
                : (m.totalValue && m.quantity ? m.totalValue / Math.abs(m.quantity) : m.totalValue || 0))
        );
        if (priceFilter === 'under1k') return rate > 0 && rate < 1000;
        if (priceFilter === '1k-5k') return rate >= 1000 && rate <= 5000;
        if (priceFilter === '5k-10k') return rate >= 5000 && rate <= 10000;
        if (priceFilter === '10k-25k') return rate >= 10000 && rate <= 25000;
        if (priceFilter === 'above25k') return rate > 25000;
        if (priceFilter === 'custom') {
          if (customMinPrice && rate < Number(customMinPrice)) return false;
          if (customMaxPrice && rate > Number(customMaxPrice)) return false;
          return true;
        }
        return true;
      });
    }

    // 4. Search Filter (Product, SKU, Movement ID, Reference, User)
    if (search.trim()) {
      list = filterRecordsBySearch(list, search, [
        (m) => m.productName,
        (m) => m.sku,
        (m) => m.productCode,
        (m) => m.movementId,
        (m) => m.id,
        (m) => m.reference,
        (m) => m.user,
        (m) => m.reason,
        (m) => m.source,
        (m) => m.destination,
        (m) => m.type
      ]);
    }

    // Sort newest first
    list.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

    return list;
  }, [movements, typeFilter, dateFilter, customStart, customEnd, priceFilter, customMinPrice, customMaxPrice, search]);

  const pagination = useTablePagination(filteredMovements, {
    resetDeps: [typeFilter, dateFilter, customStart, customEnd, priceFilter, customMinPrice, customMaxPrice, search]
  });

  const getTypeBadge = (type) => {
    let badgeClass = 'badge-blue';
    const norm = String(type || '').toUpperCase();
    if (norm === 'STOCK IN') badgeClass = 'badge-green';
    else if (norm === 'STOCK OUT') badgeClass = 'badge-rose';
    else if (norm === 'ADJUSTMENT' || norm === 'ADJUSTED') badgeClass = 'badge-amber';
    else if (norm === 'TRANSFER') badgeClass = 'badge-purple';
    else if (norm === 'RETURN' || norm === 'RETURNED') badgeClass = 'badge-blue';

    return <span className={`status-badge ${badgeClass}`}>{type}</span>;
  };

  const formatQuantity = (qty, type) => {
    const n = Number(qty || 0);
    const normType = String(type || '').toUpperCase();
    let display = n;
    let color = '#0f172a';

    if (normType === 'STOCK IN' || normType === 'RETURN' || normType === 'RETURNED') {
      display = `+${Math.abs(n)}`;
      color = '#16a34a';
    } else if (normType === 'STOCK OUT') {
      display = `-${Math.abs(n)}`;
      color = '#dc2626';
    } else if (normType === 'ADJUSTMENT' || normType === 'ADJUSTED') {
      if (n > 0) {
        display = `+${n}`;
        color = '#16a34a';
      } else if (n < 0) {
        display = `${n}`;
        color = '#dc2626';
      } else {
        display = '0';
        color = '#64748b';
      }
    } else if (normType === 'TRANSFER') {
      display = `${Math.abs(n)}`;
      color = '#7c3aed';
    }

    return <strong style={{ color, fontFamily: 'system-ui, monospace' }}>{display}</strong>;
  };

  return (
    <div className="stock-movement-page stocks-master-page">
      {/* 1. Page Header & Navigation */}
      <div className="stocks-overview-header stock-movement-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <div>
          {/* Executive Top Navigation Action Bar */}
          <div className="stocks-nav-actions-group" style={{ marginBottom: '10px' }}>
            <button
              type="button"
              className="stocks-nav-back-button"
              onClick={() => {
                if (onBack) onBack();
                else if (effectiveProductId) navigate(`/stocks/products/${encodeURIComponent(effectiveProductId)}/edit`);
                else navigate('/stocks');
              }}
              title={effectiveProductId ? "Back to Product Details" : "Back to Stocks Overview"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>{effectiveProductId ? 'Back to Product' : 'Back to Overview'}</span>
            </button>

            <div className="stocks-nav-divider" />

            <div className="stocks-nav-view-switcher">
              <button
                type="button"
                className="stocks-nav-view-tab active"
                title="Currently viewing Stock Movements ledger"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
                <span>Stock Movements</span>
              </button>

              <button
                type="button"
                className="stocks-nav-view-tab"
                onClick={() => {
                  if (effectiveProductId) navigate(`/stocks/products/${encodeURIComponent(effectiveProductId)}/price-history`);
                  else navigate('/stocks/price-history');
                }}
                title={effectiveProductId ? "View Price History for this product" : "View Price History across all stocks"}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
                <span>View Price History</span>
              </button>
            </div>

            {effectiveProductId && (
              <button
                type="button"
                className="stocks-nav-scope-button"
                onClick={() => {
                  if (onNavigateOverview) onNavigateOverview();
                  else navigate('/stocks/movements');
                }}
                title="View stock movement ledger across all products"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                <span>View All Movements</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 className="stocks-main-heading page-title" style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              {effectiveProductId ? (
                <>Stock Movement <span style={{ color: '#94a3b8', fontWeight: 400 }}>—</span> {productInfo?.name || effectiveProductId}</>
              ) : (
                'Stock Movement'
              )}
            </h1>
            {effectiveProductId && productInfo && (
              <span className={`status-badge ${Number(productInfo.stock || 0) <= Number(productInfo.alertQuantity || productInfo.minimumStock || 0) ? 'badge-amber' : 'badge-green'}`} style={{ fontSize: '11.5px', padding: '2px 8px' }}>
                Current Stock: <strong>{productInfo.stock} {(productInfo.unit && productInfo.unit !== 'Piece') ? productInfo.unit : 'Nos'}</strong>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
            <p className="stocks-sub-heading" style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              {effectiveProductId ? (
                <>Showing all stock movements for <strong>{productInfo?.name || effectiveProductId}</strong> alone.</>
              ) : (
                'Track all inventory additions, deductions, returns and adjustments.'
              )}
            </p>
            {effectiveProductId && productInfo && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: '6px' }}>
                <span className="master-code" style={{ fontSize: '11px', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                  SKU: {productInfo.code}
                </span>
                {productInfo.brandName && (
                  <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    {productInfo.brandName}
                  </span>
                )}
                {productInfo.categoryName && (
                  <span style={{ fontSize: '11px', background: '#f8fafc', color: '#475569', padding: '1px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    {productInfo.categoryName}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="stocks-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="crm-btn-secondary compact"
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh transactions ledger"
            style={{ height: '32px', fontSize: '12px' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '5px' }}>
              <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Refresh
          </button>

          <button
            type="button"
            className="crm-btn-primary compact"
            onClick={() => setNewMovementOpen(true)}
            style={{ fontWeight: 600, height: '32px', fontSize: '12px' }}
          >
            + New Stock Entry
          </button>
        </div>
      </div>

      {/* 2. Reactive Filter Toolbar */}
      <div className="stocks-filter-toolbar table-controls-card" style={{ marginBottom: '6px', padding: '6px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', overflow: 'hidden' }}>
            {/* Search */}
            <div style={{ position: 'relative', width: '280px', flexShrink: 0 }}>
              <input
                type="search"
                className="crm-text-input"
                placeholder={effectiveProductId ? "Search Movement ID, Reference, User, Reason..." : "Search Product, SKU, Movement ID, Reference, User..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', height: '30px', paddingLeft: '28px', paddingRight: search ? '26px' : '8px', fontSize: '12px' }}
              />
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ position: 'absolute', left: '8px', top: '9px', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  title="Clear search"
                  style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '12px' }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Movement Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="crm-select-input"
              style={{ width: '165px', height: '30px', fontSize: '12px', flexShrink: 0 }}
            >
              <option value="ALL">All Movement Types</option>
              <option value="STOCK IN">STOCK IN</option>
              <option value="STOCK OUT">STOCK OUT</option>
              <option value="RETURN">RETURN</option>
              <option value="ADJUSTMENT">ADJUSTMENT</option>
              <option value="TRANSFER">TRANSFER</option>
            </select>

            {/* Date Filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="crm-select-input"
              style={{ width: '125px', height: '30px', fontSize: '12px', flexShrink: 0 }}
            >
              <option value="ALL">All Dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last7days">Last 7 Days</option>
              <option value="last30days">Last 30 Days</option>
              <option value="thisMonth">This Month</option>
              <option value="custom">Custom Date</option>
            </select>

            {/* Custom Date Range Picker */}
            {dateFilter === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <input
                  type="date"
                  className="crm-text-input"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  style={{ height: '30px', fontSize: '11px', padding: '0 6px' }}
                />
                <span style={{ color: '#94a3b8', fontSize: '11px' }}>to</span>
                <input
                  type="date"
                  className="crm-text-input"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  style={{ height: '30px', fontSize: '11px', padding: '0 6px' }}
                />
              </div>
            )}

            {/* Price Filter (Designed identical to Date filter) */}
            <select
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value)}
              className="crm-select-input"
              style={{ width: '130px', height: '30px', fontSize: '12px', flexShrink: 0 }}
              title="Filter by price / rate"
            >
              <option value="ALL">All Prices</option>
              <option value="under1k">Under ₹1,000</option>
              <option value="1k-5k">₹1,000 - ₹5,000</option>
              <option value="5k-10k">₹5,000 - ₹10,000</option>
              <option value="10k-25k">₹10,000 - ₹25,000</option>
              <option value="above25k">Above ₹25,000</option>
              <option value="custom">Custom Price</option>
            </select>

            {/* Custom Price Range Picker */}
            {priceFilter === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <input
                  type="number"
                  min="0"
                  placeholder="Min ₹"
                  className="crm-text-input"
                  value={customMinPrice}
                  onChange={(e) => setCustomMinPrice(e.target.value)}
                  style={{ width: '68px', height: '30px', fontSize: '11px', padding: '0 6px' }}
                />
                <span style={{ color: '#94a3b8', fontSize: '11px' }}>to</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Max ₹"
                  className="crm-text-input"
                  value={customMaxPrice}
                  onChange={(e) => setCustomMaxPrice(e.target.value)}
                  style={{ width: '68px', height: '30px', fontSize: '11px', padding: '0 6px' }}
                />
              </div>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                className="crm-btn-secondary compact"
                onClick={resetFilters}
                style={{ height: '30px', fontSize: '11.5px', color: '#dc2626', padding: '0 8px', flexShrink: 0 }}
              >
                Clear Filters
              </button>
            )}
          </div>

          <div style={{ fontSize: '12px', color: '#64748b', flexShrink: 0, whiteSpace: 'nowrap' }}>
            Showing <strong>{filteredMovements.length}</strong> of <strong>{movements.length}</strong> transactions
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', color: '#b91c1c', marginBottom: '6px', fontSize: '12px' }}>
          {error}
        </div>
      )}

      {/* 3. Enterprise Table Shell & Natural Height Viewport */}
      <div className="stock-movement-master-card stocks-table-shell crm-table-workspace" style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden' }}>
        <div className="stock-movement-scroll-wrap crm-table-scroll-wrap stocks-table-natural-wrap crm-table-viewport" style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
          <table className="crm-data-table stock-movement-full-table crm-master-table">
            {effectiveProductId ? (
              /* Dedicated Single-Product Column Proportions (No Redundant Product Column) */
              <colgroup>
                <col className="col-mov-date" style={{ width: '12%' }} />
                <col className="col-mov-txnid" style={{ width: '13%' }} />
                <col className="col-mov-type" style={{ width: '8%' }} />
                <col className="col-mov-qty" style={{ width: '8%' }} />
                <col className="col-mov-amount" style={{ width: '10%' }} />
                <col className="col-mov-ref" style={{ width: '15%' }} />
                <col className="col-mov-user" style={{ width: '9%' }} />
                <col className="col-mov-stock-before" style={{ width: '9%' }} />
                <col className="col-mov-stock-after" style={{ width: '10%' }} />
                <col className="col-mov-actions" style={{ width: '6%' }} />
              </colgroup>
            ) : (
              /* Global Movement Ledger Column Proportions (Includes Product & SKU) */
              <colgroup>
                <col className="col-mov-date" style={{ width: '12%' }} />
                <col className="col-mov-product" style={{ width: '22%' }} />
                <col className="col-mov-type" style={{ width: '9%' }} />
                <col className="col-mov-qty" style={{ width: '8%' }} />
                <col className="col-mov-amount" style={{ width: '11%' }} />
                <col className="col-mov-ref" style={{ width: '15%' }} />
                <col className="col-mov-user" style={{ width: '8%' }} />
                <col className="col-mov-stock-after" style={{ width: '9%' }} />
                <col className="col-mov-actions" style={{ width: '6%' }} />
              </colgroup>
            )}

            <thead>
              {effectiveProductId ? (
                <tr>
                  <th style={{ textAlign: 'left', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>DATE</th>
                  <th style={{ textAlign: 'left', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>TRANSACTION ID</th>
                  <th style={{ textAlign: 'center', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>TYPE</th>
                  <th style={{ textAlign: 'right', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>QUANTITY</th>
                  <th style={{ textAlign: 'right', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>AMOUNT</th>
                  <th style={{ textAlign: 'left', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>REFERENCE</th>
                  <th style={{ textAlign: 'left', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>USER</th>
                  <th style={{ textAlign: 'right', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>STOCK BEFORE</th>
                  <th style={{ textAlign: 'right', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>STOCK AFTER</th>
                  <th style={{ textAlign: 'center', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>ACTIONS</th>
                </tr>
              ) : (
                <tr>
                  <th style={{ textAlign: 'left', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>DATE</th>
                  <th style={{ textAlign: 'left', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>PRODUCT</th>
                  <th style={{ textAlign: 'center', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>TYPE</th>
                  <th style={{ textAlign: 'right', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>QUANTITY</th>
                  <th style={{ textAlign: 'right', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>AMOUNT</th>
                  <th style={{ textAlign: 'left', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>REFERENCE</th>
                  <th style={{ textAlign: 'left', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>USER</th>
                  <th style={{ textAlign: 'right', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>STOCK AFTER</th>
                  <th style={{ textAlign: 'center', whiteSpace: 'nowrap', overflow: 'visible', textOverflow: 'clip' }}>ACTIONS</th>
                </tr>
              )}
            </thead>

            <tbody>
              {loading && movements.length === 0 ? (
                <tr>
                  <td colSpan={effectiveProductId ? 10 : 9} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                    <div className="spinner" style={{ margin: '0 auto 10px', width: '24px', height: '24px', border: '2px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    Loading stock movement ledger...
                  </td>
                </tr>
              ) : filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={effectiveProductId ? 10 : 9} style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '28px', marginBottom: '6px' }}>📦</div>
                    <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
                      {effectiveProductId ? `No Stock Movements Found for ${productInfo?.name || 'this product'}` : 'No Stock Movements Found'}
                    </div>
                    <div style={{ fontSize: '12px' }}>
                      {hasActiveFilters ? 'No transactions match your active filters. Try clearing filters.' : effectiveProductId ? 'No stock movements have been recorded yet for this product.' : 'No stock movements have been recorded yet.'}
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {pagination.currentItems.map((m, idx) => {
                    const mId = m.movementId || m.id;
                    const prodName = m.productName || 'Product';
                    const sku = m.sku || m.productCode || '';
                    const unit = (m.unit && m.unit !== 'Piece') ? m.unit : 'Nos';

                    return (
                      <tr
                        key={`${mId || 'mov'}-${idx}`}
                        style={{ cursor: 'pointer', transition: 'background-color 0.15s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        onClick={() => setSelectedMovement(m)}
                      >
                        {/* DATE */}
                        <td style={{ fontSize: '12px', color: '#475569' }}>
                          <div style={{ whiteSpace: 'nowrap', fontWeight: 500, color: '#1e293b' }}>
                            {formatDateTime(m.date || m.createdAt)}
                          </div>
                          {!effectiveProductId && mId && (
                            <div style={{ marginTop: '2px' }}>
                              <span className="master-code" style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '3px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569' }}>
                                {mId}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* SEPARATE VIEW: Dedicated TRANSACTION ID column */}
                        {effectiveProductId && (
                          <td>
                            <span className="master-code" style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600, fontSize: '11px', color: '#0f172a', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                              {mId || '—'}
                            </span>
                          </td>
                        )}

                        {/* GLOBAL VIEW: PRODUCT column */}
                        {!effectiveProductId && (
                          <td style={{ overflow: 'hidden' }}>
                            <div
                              style={{
                                fontWeight: 600,
                                color: '#2563eb',
                                fontSize: '12.5px',
                                cursor: 'pointer',
                                textDecoration: 'none',
                                wordBreak: 'break-word',
                                overflowWrap: 'anywhere'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (typeof window !== 'undefined') {
                                  sessionStorage.setItem('asicrm_product_return', '/stocks/movements');
                                }
                                if (onOpenProductHistory) {
                                  onOpenProductHistory(m.productId || m.sku || m.productCode, m.movementId || m.id);
                                } else {
                                  navigate(`/stocks/products/${encodeURIComponent(m.productId || m.sku || m.productCode)}?movement=${encodeURIComponent(m.movementId || m.id)}`);
                                }
                              }}
                              title="Click to view full Product History"
                              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                            >
                              {prodName}
                            </div>
                            {sku && <small style={{ color: '#64748b', fontSize: '11px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>SKU: {sku}</small>}
                            {m.isVoided && (
                              <span style={{ display: 'inline-block', marginTop: '2px', padding: '1px 5px', fontSize: '10px', fontWeight: 700, borderRadius: '4px', backgroundColor: '#fee2e2', color: '#991b1b' }}>
                                VOIDED
                              </span>
                            )}
                            {m.isCorrected && (
                              <span style={{ display: 'inline-block', marginTop: '2px', padding: '1px 5px', fontSize: '10px', fontWeight: 700, borderRadius: '4px', backgroundColor: '#fef3c7', color: '#92400e' }}>
                                CORRECTED
                              </span>
                            )}
                          </td>
                        )}

                        {/* TYPE */}
                        <td style={{ textAlign: 'center' }}>
                          {getTypeBadge(m.type)}
                        </td>

                        {/* QUANTITY */}
                        <td style={{ textAlign: 'right', fontSize: '12.5px' }}>
                          {formatQuantity(m.quantity, m.type)}
                          <span style={{ fontSize: '10.5px', color: '#64748b', marginLeft: '3px' }}>{unit}</span>
                        </td>

                        {/* AMOUNT (Entry Rate / Batch Value) */}
                        <td style={{ textAlign: 'right', fontSize: '12.5px' }}>
                          {m.unitRate !== undefined && m.unitRate !== null && Number(m.unitRate) > 0 ? (
                            <div>
                              <div style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                                ₹{Number(m.unitRate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              {m.totalValue !== undefined && m.totalValue !== null && Math.abs(Number(m.quantity || 1)) > 1 && (
                                <div style={{ fontSize: '10.5px', color: '#64748b', whiteSpace: 'nowrap', marginTop: '1px' }}>
                                  Total: ₹{Number(m.totalValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>

                        {/* REFERENCE & STORAGE LOCATION */}
                        <td style={{ fontSize: '12px', color: '#334155', overflow: 'hidden' }}>
                          <strong style={{ color: '#1e293b', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.reference || '—'}>
                            {m.reference || '—'}
                          </strong>
                          {m.binLocation ? (
                            <div style={{ fontSize: '10px', color: '#15803d', fontWeight: 600, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`Storage Bin: ${m.binLocation}`}>
                              📍 {m.box ? `${m.rack || 'RK'} › ${m.box}` : m.binLocation}
                            </div>
                          ) : m.reason ? (
                            <div style={{ fontSize: '10.5px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }} title={m.reason}>
                              {m.reason}
                            </div>
                          ) : null}
                        </td>

                        {/* USER */}
                        <td style={{ fontSize: '12px', color: '#475569', overflow: 'hidden' }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.user || 'System'}>
                            {m.user || 'System'}
                          </div>
                        </td>

                        {/* SEPARATE VIEW: STOCK BEFORE */}
                        {effectiveProductId && (
                          <td style={{ textAlign: 'right', fontSize: '12px', color: '#475569' }}>
                            <span style={{ fontFamily: 'system-ui, monospace' }}>
                              {m.stockBefore !== undefined && m.stockBefore !== null ? m.stockBefore : '—'}
                            </span>
                            <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '3px' }}>{unit}</span>
                          </td>
                        )}

                        {/* STOCK AFTER */}
                        <td style={{ textAlign: 'right', fontSize: '12.5px', color: '#0f172a' }}>
                          <strong style={{ fontFamily: 'system-ui, monospace' }}>
                            {m.stockAfter !== undefined && m.stockAfter !== null ? m.stockAfter : '—'}
                          </strong>
                          <span style={{ fontSize: '10.5px', color: '#64748b', marginLeft: '3px' }}>{unit}</span>
                        </td>

                        {/* ACTIONS */}
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              className="settings-row-action settings-row-icon"
                              onClick={() => setSelectedMovement(m)}
                              title="View Movement Details"
                              aria-label={`View movement details for ${m.movementId || m.id}`}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: '3px 5px',
                                borderRadius: '4px',
                                color: '#2563eb'
                              }}
                            >
                              <EyeIcon size={13} />
                            </button>
                            <button
                              type="button"
                              className="settings-row-action settings-row-icon"
                              disabled={m.isVoided || m.isCorrected || m.event === 'VOID_REVERSAL' || m.event === 'CORRECTION_REVERSAL'}
                              onClick={() => setEditingMovement(m)}
                              title={
                                m.isVoided ? 'Voided transactions cannot be edited' :
                                m.isCorrected ? 'Transaction already corrected' :
                                (m.event === 'VOID_REVERSAL' || m.event === 'CORRECTION_REVERSAL') ? 'Reversal entries cannot be edited' :
                                'Edit movement (Controlled Correction)'
                              }
                              aria-label={`Edit movement ${m.movementId || m.id}`}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: (m.isVoided || m.isCorrected || m.event === 'VOID_REVERSAL' || m.event === 'CORRECTION_REVERSAL') ? 'not-allowed' : 'pointer',
                                padding: '3px 5px',
                                borderRadius: '4px',
                                color: (m.isVoided || m.isCorrected || m.event === 'VOID_REVERSAL' || m.event === 'CORRECTION_REVERSAL') ? '#cbd5e1' : '#2563eb'
                              }}
                            >
                              <PencilIcon size={13} />
                            </button>
                            <button
                              type="button"
                              className="settings-row-action settings-row-icon"
                              disabled={m.isVoided || m.event === 'VOID_REVERSAL' || m.event === 'CORRECTION_REVERSAL'}
                              onClick={() => setVoidingMovement(m)}
                              title={
                                m.isVoided ? 'Transaction already voided' :
                                (m.event === 'VOID_REVERSAL' || m.event === 'CORRECTION_REVERSAL') ? 'Reversal entries cannot be voided' :
                                'Void movement (Audit-Safe Reversal)'
                              }
                              aria-label={`Void movement ${m.movementId || m.id}`}
                              style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: (m.isVoided || m.event === 'VOID_REVERSAL' || m.event === 'CORRECTION_REVERSAL') ? 'not-allowed' : 'pointer',
                                padding: '3px 5px',
                                borderRadius: '4px',
                                color: (m.isVoided || m.event === 'VOID_REVERSAL' || m.event === 'CORRECTION_REVERSAL') ? '#cbd5e1' : '#dc2626'
                              }}
                            >
                              <Trash2Icon size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Continuous Enterprise Filler Rows */}
                  {!loading && filteredMovements.length > 0 && pagination.currentItems.length < pagination.pageSize && (
                    Array.from({ length: pagination.pageSize - pagination.currentItems.length }).map((_, fIdx) => (
                      <tr key={`filler-${fIdx}`} className="table-data-row table-filler-row" aria-hidden="true">
                        {effectiveProductId ? (
                          <>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td style={{ textAlign: 'center' }}>&nbsp;</td>
                            <td style={{ textAlign: 'right' }}>&nbsp;</td>
                            <td style={{ textAlign: 'right' }}>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td style={{ textAlign: 'right' }}>&nbsp;</td>
                            <td style={{ textAlign: 'right' }}>&nbsp;</td>
                            <td style={{ textAlign: 'center' }}>&nbsp;</td>
                          </>
                        ) : (
                          <>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td style={{ textAlign: 'center' }}>&nbsp;</td>
                            <td style={{ textAlign: 'right' }}>&nbsp;</td>
                            <td style={{ textAlign: 'right' }}>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td>&nbsp;</td>
                            <td style={{ textAlign: 'right' }}>&nbsp;</td>
                            <td style={{ textAlign: 'center' }}>&nbsp;</td>
                          </>
                        )}
                      </tr>
                    ))
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Pinned Enterprise Table Footer */}
        <TableFooter
          showingStart={pagination.showingStart}
          showingEnd={pagination.showingEnd}
          total={filteredMovements.length}
          recordLabel="transactions"
          singularLabel="transaction"
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={pagination.goToPage}
        />
      </div>

      {/* Movement Details Modal */}
      <StockMovementDetailModal
        isOpen={Boolean(selectedMovement)}
        movement={selectedMovement}
        onClose={() => setSelectedMovement(null)}
      />

      {/* New Movement Modal */}
      <NewStockMovementModal
        isOpen={newMovementOpen}
        onClose={() => setNewMovementOpen(false)}
        onSuccess={() => {
          setNewMovementOpen(false);
          fetchMovements();
          if (onRefreshData) onRefreshData();
        }}
        products={products.length > 0 ? products : (productInfo ? [productInfo] : [])}
        initialProductId={productInfo?.id || effectiveProductId || ''}
        user={user}
      />

      {/* Controlled Correction Edit Modal */}
      <StockMovementEditModal
        isOpen={Boolean(editingMovement)}
        movement={editingMovement}
        onClose={() => setEditingMovement(null)}
        onSuccess={() => {
          setEditingMovement(null);
          fetchMovements();
          if (onRefreshData) onRefreshData();
        }}
        user={user}
      />

      {/* Audit-Safe Void / Reversal Modal */}
      <StockMovementVoidModal
        isOpen={Boolean(voidingMovement)}
        movement={voidingMovement}
        onClose={() => setVoidingMovement(null)}
        onSuccess={() => {
          setVoidingMovement(null);
          fetchMovements();
          if (onRefreshData) onRefreshData();
        }}
        user={user}
      />
    </div>
  );
}
