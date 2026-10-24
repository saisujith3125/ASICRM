import React, { useState, useEffect, useMemo } from 'react';
import { apiUrl, apiFetch } from '../../api';
import { navigate } from '../../router';
import { formatDate } from '../../utils/dateUtils';

function money(amount) {
  const n = Number(amount || 0);
  return '₹' + n.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2
  });
}

export default function ProductPriceHistoryPage({
  productId: initialProductId,
  initialProduct = null,
  user,
  onBack
}) {
  const queryProductId = typeof window !== 'undefined'
    ? (new URLSearchParams(window.location.search).get('productId') || new URLSearchParams(window.location.search).get('product'))
    : null;
  const effectiveProductId = initialProductId || queryProductId || null;

  const [selectedProductId, setSelectedProductId] = useState(effectiveProductId || 'ALL');
  const [productsList, setProductsList] = useState([]);
  const [product, setProduct] = useState(initialProduct);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest'
  const [expandedRefId, setExpandedRefId] = useState(null);

  // Reactive Filters (Movement / Source Type, Dates, Price Range, Search)
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [priceFilter, setPriceFilter] = useState('ALL');
  const [customMinPrice, setCustomMinPrice] = useState('');
  const [customMaxPrice, setCustomMaxPrice] = useState('');

  const isAllMode = !selectedProductId || selectedProductId === 'ALL';

  const loadData = () => {
    setLoading(true);
    setError(null);

    const isAll = !selectedProductId || selectedProductId === 'ALL';
    const url = isAll
      ? apiUrl('/api/stocks/price-history')
      : apiUrl(`/api/stocks/price-history?productId=${encodeURIComponent(selectedProductId)}`);

    apiFetch(url, {
      headers: { 'x-user-id': user?.id || 'USR-001' }
    })
      .then((res) => {
        if (!res.ok) throw new Error('Unable to load price history.');
        return res.json();
      })
      .then((json) => {
        if (json.success) {
          setHistory(Array.isArray(json.data) ? json.data : []);
          if (Array.isArray(json.products)) {
            setProductsList(json.products);
          }
          if (json.product) {
            setProduct(json.product);
          } else if (isAll) {
            setProduct(null);
          }
        } else {
          throw new Error(json.message || 'Failed to load price history.');
        }
      })
      .catch((err) => {
        console.error('Price History Fetch Error:', err);
        setError(err.message || 'Unable to load price history.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    setSelectedProductId(effectiveProductId || 'ALL');
  }, [effectiveProductId]);

  useEffect(() => {
    loadData();
  }, [selectedProductId]);

  useEffect(() => {
    if (initialProduct && (!product || product.id !== initialProduct.id)) {
      setProduct(initialProduct);
    }
  }, [initialProduct]);

  const handleSelectProduct = (newProdId) => {
    setSelectedProductId(newProdId);
    if (newProdId && newProdId !== 'ALL') {
      navigate(`/stocks/products/${encodeURIComponent(newProdId)}/price-history`);
    } else {
      navigate('/stocks/price-history');
    }
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

  // Filter raw history into procurement / purchase price records only
  const procurementRecords = useMemo(() => {
    return (history || []).filter((t) => {
      const isProcurement =
        t.event === 'Goods Receipt' ||
        t.event === 'Purchase Order' ||
        t.event === 'Product Added' ||
        t.referenceType === 'GRN' ||
        t.referenceType === 'GOODS_RECEIPT' ||
        t.referenceType === 'PO' ||
        t.referenceType === 'PROD';
      const rate = Number(t.unitRate || 0);
      return isProcurement && rate > 0;
    });
  }, [history]);

  // Apply Search, Type, and Date filters
  const filteredRecords = useMemo(() => {
    let list = [...procurementRecords];

    // 1. Movement / Source Type Filter
    if (typeFilter !== 'ALL') {
      list = list.filter((t) => {
        const evt = String(t.event || '').toLowerCase();
        const refType = String(t.referenceType || '').toUpperCase();
        const refStr = String(t.reference || t.referenceId || '').toUpperCase();

        if (typeFilter === 'GRN' || typeFilter === 'GOODS_RECEIPT') {
          return evt.includes('goods receipt') || refType === 'GRN' || refType === 'GOODS_RECEIPT' || refStr.startsWith('GRN-');
        }
        if (typeFilter === 'PO' || typeFilter === 'PURCHASE_ORDER') {
          return evt.includes('purchase order') || refType === 'PO' || refStr.startsWith('PO-') || refStr.startsWith('PO/');
        }
        if (typeFilter === 'PROD' || typeFilter === 'CATALOGUE') {
          return evt.includes('product added') || refType === 'PROD' || refType === 'PRD' || refStr.startsWith('PROD-') || refStr.startsWith('PRD-') || refStr.includes('CATALOGUE');
        }
        return true;
      });
    }

    // 2. Date Filter
    if (dateFilter !== 'ALL') {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      list = list.filter((t) => {
        const d = new Date(t.date || t.createdAt);
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

    // 3. Search Filter (Product, SKU, Reference, Supplier, User, Note, Rate)
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((t) => {
        return (
          String(t.productName || '').toLowerCase().includes(q) ||
          String(t.productCode || t.sku || '').toLowerCase().includes(q) ||
          String(t.reference || t.referenceId || '').toLowerCase().includes(q) ||
          String(t.poReference || '').toLowerCase().includes(q) ||
          String(t.supplierName || t.partyName || '').toLowerCase().includes(q) ||
          String(t.event || '').toLowerCase().includes(q) ||
          String(t.remarks || '').toLowerCase().includes(q) ||
          String(t.unitRate || '').includes(q)
        );
      });
    }

    // 4. Price Filter (matches procurement rate)
    if (priceFilter !== 'ALL') {
      list = list.filter((t) => {
        const rate = Number(t.unitRate || 0);
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

    // 5. Sort
    list.sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.date || 0) - new Date(a.date || 0);
      if (sortOrder === 'oldest') return new Date(a.date || 0) - new Date(b.date || 0);
      if (sortOrder === 'priceLowHigh') return Number(a.unitRate || 0) - Number(b.unitRate || 0);
      if (sortOrder === 'priceHighLow') return Number(b.unitRate || 0) - Number(a.unitRate || 0);
      return 0;
    });

    return list;
  }, [procurementRecords, typeFilter, dateFilter, customStart, customEnd, priceFilter, customMinPrice, customMaxPrice, search, sortOrder]);

  // Compute summary metrics (chronologically newest to oldest for latest/previous)
  const summaryMetrics = useMemo(() => {
    if (procurementRecords.length === 0) return null;

    const chronList = [...procurementRecords].sort(
      (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
    );

    const latestRate = Number(chronList[0]?.unitRate || 0);
    const previousRate = chronList.length > 1 ? Number(chronList[1]?.unitRate || 0) : null;

    let lowest = Infinity;
    let highest = -Infinity;
    let totalSpent = 0;
    procurementRecords.forEach((r) => {
      const rate = Number(r.unitRate || 0);
      const val = Number(r.totalValue || 0);
      if (rate > 0) {
        if (rate < lowest) lowest = rate;
        if (rate > highest) highest = rate;
      }
      totalSpent += val;
    });

    return {
      latestRate,
      previousRate,
      lowestRate: lowest !== Infinity ? lowest : latestRate,
      highestRate: highest !== -Infinity ? highest : latestRate,
      totalSpent
    };
  }, [procurementRecords]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (selectedProductId && selectedProductId !== 'ALL') {
      navigate(`/stocks/products/${encodeURIComponent(selectedProductId)}`);
    } else {
      navigate('/stocks/products');
    }
  };

  const toggleDropdown = (recordId) => {
    setExpandedRefId((prev) => (prev === recordId ? null : recordId));
  };

  return (
    <div className="stocks-price-history-page">
      {/* HEADER SECTION */}
      <div className="stocks-price-history-header-wrapper">
        <div className="stocks-price-history-header-top">
          <div className="stocks-nav-actions-group">
            <button
              type="button"
              className="stocks-nav-back-button"
              onClick={handleBack}
              title={isAllMode ? "Return to Products Overview" : "Return to Product Detail"}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>{isAllMode ? 'Back to Products' : 'Back to Product'}</span>
            </button>

            <div className="stocks-nav-divider" />

            <div className="stocks-nav-view-switcher">
              <button
                type="button"
                className="stocks-nav-view-tab"
                onClick={() => {
                  if (selectedProductId && selectedProductId !== 'ALL') {
                    navigate(`/stocks/products/${encodeURIComponent(selectedProductId)}/movements`);
                  } else {
                    navigate('/stocks/movements');
                  }
                }}
                title={!isAllMode ? "View stock movement ledger for this product" : "View stock movements across all products"}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
                <span>Stock Movements</span>
              </button>

              <button
                type="button"
                className="stocks-nav-view-tab active"
                title="Currently viewing Price History"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
                <span>Price History</span>
              </button>
            </div>

            {!isAllMode ? (
              <button
                type="button"
                className="stocks-nav-scope-button"
                onClick={() => handleSelectProduct('ALL')}
                title="View Price History across all stocks"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                <span>View All Stocks Price History</span>
              </button>
            ) : null}
          </div>

          <div className="header-right-actions">
            <button
              type="button"
              className="crm-btn-secondary compact price-history-refresh-btn"
              onClick={loadData}
              disabled={loading}
              title="Refresh price history data from server"
              style={{ height: '32px', fontSize: '12px' }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={loading ? 'price-spin-icon' : ''}
              >
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Product Identity Banner or All Stocks Banner */}
        {!isAllMode && product ? (
          <div className="stocks-price-history-identity-card">
            <div className="identity-title-row">
              <div className="identity-main">
                <span className="identity-sub-tag">PRODUCT PRICE HISTORY</span>
                <h1 className="identity-product-name">{product?.name || (loading ? 'Loading product...' : 'Product')}</h1>
                <div className="identity-meta-chips">
                  <span className="identity-chip sku" title="Product SKU / Code">
                    <strong>SKU:</strong> {product?.code || selectedProductId || '—'}
                  </span>
                  {product?.brandName && (
                    <span className="identity-chip" title="Brand">
                      <strong>Brand:</strong> {product.brandName}
                    </span>
                  )}
                  {product?.categoryName && (
                    <span className="identity-chip" title="Category">
                      <strong>Category:</strong> {product.categoryName}
                    </span>
                  )}
                  {product?.subcategoryName && product.subcategoryName !== '—' && (
                    <span className="identity-chip" title="Subcategory">
                      <strong>Subcategory:</strong> {product.subcategoryName}
                    </span>
                  )}
                  <span className="identity-chip" title="Unit of Measurement">
                    <strong>Unit:</strong> {(product?.unit && product.unit !== 'Piece') ? product.unit : 'Nos'}
                  </span>
                </div>
              </div>

              <div className="identity-cost-side">
                <div className="current-master-cost-pill">
                  <span className="cost-pill-label">CURRENT MASTER COST</span>
                  <span className="cost-pill-value">{money(product?.cost || 0)}</span>
                  <span className="cost-pill-hint">Catalogue Default</span>
                </div>
                <div className="current-stock-pill-simple">
                  <span>Stock: <strong>{Number(product?.stock || 0)} {(product?.unit && product.unit !== 'Piece') ? product.unit : 'Nos'}</strong></span>
                </div>
              </div>
            </div>

            <div className="immutability-notice-bar">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2">
                <circle cx="12" cy="10" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>
                <strong>Historical Price Audit Trail:</strong> Recorded procurement rates are permanent immutable snapshots captured at Goods Receipt. Changing current Product Master cost never alters previous procurement records.
              </span>
            </div>
          </div>
        ) : (
          <div className="stocks-price-history-identity-card" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', border: '1px solid #cbd5e1' }}>
            <div className="identity-title-row">
              <div className="identity-main">
                <span className="identity-sub-tag" style={{ background: '#0284c7', color: '#ffffff' }}>ENTERPRISE AUDIT</span>
                <h1 className="identity-product-name" style={{ color: '#0f172a' }}>All Stocks Price History</h1>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#475569' }}>
                  Showing historical procurement rates, Goods Receipts, and purchase orders across all catalogue products.
                </p>
                <div className="identity-meta-chips" style={{ marginTop: '8px' }}>
                  <span className="identity-chip" style={{ background: '#ffffff', borderColor: '#cbd5e1' }}>
                    <strong>Total Products:</strong> {productsList.length} items
                  </span>
                  <span className="identity-chip" style={{ background: '#ffffff', borderColor: '#cbd5e1' }}>
                    <strong>Total Historical Records:</strong> {procurementRecords.length}
                  </span>
                </div>
              </div>

              {summaryMetrics && (
                <div className="identity-cost-side">
                  <div className="current-master-cost-pill" style={{ background: '#ffffff', borderColor: '#cbd5e1' }}>
                    <span className="cost-pill-label">TOTAL VALUE RECORDED</span>
                    <span className="cost-pill-value" style={{ color: '#0284c7' }}>{money(summaryMetrics.totalSpent)}</span>
                    <span className="cost-pill-hint">Across All Purchases</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* COMPACT SUMMARY STRIP */}
      {summaryMetrics && (
        <div className="price-history-summary-strip">
          <div className="price-summary-card">
            <span className="summary-card-label">LATEST PURCHASE RATE</span>
            <span className="summary-card-value">{money(summaryMetrics.latestRate)}</span>
            <span className="summary-card-sub">Most recent procurement</span>
          </div>

          <div className="price-summary-card">
            <span className="summary-card-label">PREVIOUS PURCHASE RATE</span>
            <span className="summary-card-value">
              {summaryMetrics.previousRate !== null ? money(summaryMetrics.previousRate) : '—'}
            </span>
            <span className="summary-card-sub">Prior procurement</span>
          </div>

          <div className="price-summary-card">
            <span className="summary-card-label">LOWEST HISTORICAL RATE</span>
            <span className="summary-card-value lowest">{money(summaryMetrics.lowestRate)}</span>
            <span className="summary-card-sub">Best historical cost</span>
          </div>

          <div className="price-summary-card">
            <span className="summary-card-label">HIGHEST HISTORICAL RATE</span>
            <span className="summary-card-value highest">{money(summaryMetrics.highestRate)}</span>
            <span className="summary-card-sub">Peak historical cost</span>
          </div>
        </div>
      )}

      {/* ERROR STATE */}
      {error && (
        <div className="price-history-error-card" role="alert">
          <div className="error-icon-box">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="error-content">
            <h3>{error === 'Product not found.' ? 'Product Not Found' : 'Unable to Load Price History'}</h3>
            <p>{error}</p>
            <div className="error-actions">
              <button type="button" className="crm-btn-primary compact" onClick={loadData}>
                Retry
              </button>
              <button type="button" className="crm-btn-secondary compact" onClick={handleBack}>
                Return to Products
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOADING STATE */}
      {loading && !error && (
        <div className="price-history-loading-card">
          <div className="crm-spinner" />
          <p>Loading price history...</p>
        </div>
      )}

      {/* POPULATED / EMPTY TABLE CONTENT */}
      {!loading && !error && (
        <div className="price-history-content-container crm-table-workspace">
          {/* REACTIVE FILTER TOOLBAR (Matches Stock Movements Toolbar) */}
          <div className="price-history-table-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', padding: '10px 16px', borderBottom: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', flexWrap: 'wrap' }}>
              {/* 1. Product Selector / All Stocks */}
              <select
                value={selectedProductId || 'ALL'}
                onChange={(e) => handleSelectProduct(e.target.value)}
                className="crm-select-input"
                style={{ width: '185px', height: '32px', fontSize: '12px', fontWeight: 600, color: '#0f172a', flexShrink: 0 }}
                title="Filter by product or view all stocks"
              >
                <option value="ALL">All Products / Stocks ({productsList.length > 0 ? productsList.length : 'All'})</option>
                {productsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code || p.id})
                  </option>
                ))}
              </select>

              {/* 2. Search Input */}
              <div style={{ position: 'relative', width: '190px', flexShrink: 0 }}>
                <input
                  type="search"
                  className="crm-text-input"
                  placeholder={isAllMode ? "Search SKU, Ref, Party..." : "Search Ref, Party, Rate..."}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: '100%', height: '32px', paddingLeft: '28px', paddingRight: search ? '26px' : '8px', fontSize: '12px' }}
                />
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ position: 'absolute', left: '8px', top: '10px', pointerEvents: 'none' }}>
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

              {/* 3. Movement / Source Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="crm-select-input"
                style={{ width: '150px', height: '32px', fontSize: '12px', flexShrink: 0 }}
                title="Filter by procurement source type"
              >
                <option value="ALL">All Movement Types</option>
                <option value="GRN">Goods Receipt (GRN)</option>
                <option value="PO">Purchase Order (PO)</option>
                <option value="PROD">Catalogue / Initial</option>
              </select>

              {/* 4. Date Filter */}
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="crm-select-input"
                style={{ width: '110px', height: '32px', fontSize: '12px', flexShrink: 0 }}
                title="Filter by date range"
              >
                <option value="ALL">All Dates</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7days">Last 7 Days</option>
                <option value="last30days">Last 30 Days</option>
                <option value="thisMonth">This Month</option>
                <option value="custom">Custom Date</option>
              </select>

              {/* Custom Date Inputs */}
              {dateFilter === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <input
                    type="date"
                    className="crm-text-input"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    style={{ height: '32px', fontSize: '11px', padding: '0 6px' }}
                  />
                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>to</span>
                  <input
                    type="date"
                    className="crm-text-input"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    style={{ height: '32px', fontSize: '11px', padding: '0 6px' }}
                  />
                </div>
              )}

              {/* 5. Price Filter (Designed identical to Date filter) */}
              <select
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value)}
                className="crm-select-input"
                style={{ width: '115px', height: '32px', fontSize: '12px', flexShrink: 0 }}
                title="Filter by procurement price / rate"
              >
                <option value="ALL">All Prices</option>
                <option value="under1k">Under ₹1,000</option>
                <option value="1k-5k">₹1,000 - ₹5,000</option>
                <option value="5k-10k">₹5,000 - ₹10,000</option>
                <option value="10k-25k">₹10,000 - ₹25,000</option>
                <option value="above25k">Above ₹25,000</option>
                <option value="custom">Custom Price</option>
              </select>

              {/* Custom Price Range Inputs */}
              {priceFilter === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <input
                    type="number"
                    min="0"
                    placeholder="Min ₹"
                    className="crm-text-input"
                    value={customMinPrice}
                    onChange={(e) => setCustomMinPrice(e.target.value)}
                    style={{ width: '65px', height: '32px', fontSize: '11px', padding: '0 6px' }}
                  />
                  <span style={{ color: '#94a3b8', fontSize: '11px' }}>to</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Max ₹"
                    className="crm-text-input"
                    value={customMaxPrice}
                    onChange={(e) => setCustomMaxPrice(e.target.value)}
                    style={{ width: '65px', height: '32px', fontSize: '11px', padding: '0 6px' }}
                  />
                </div>
              )}

              {/* 6. Sort Order */}
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="crm-select-input"
                style={{ width: '135px', height: '32px', fontSize: '12px', fontWeight: 500, flexShrink: 0 }}
                title="Sort order"
              >
                <option value="newest">Sort: Newest First</option>
                <option value="oldest">Sort: Oldest First</option>
                <option value="priceLowHigh">Price: Low to High</option>
                <option value="priceHighLow">Price: High to Low</option>
              </select>

              {/* Reset Filters button */}
              {hasActiveFilters && (
                <button
                  type="button"
                  className="crm-btn-secondary compact"
                  onClick={resetFilters}
                  style={{ height: '32px', fontSize: '11.5px', color: '#dc2626', padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                  title="Reset all search, movement type, date, and price filters"
                >
                  ✕ Clear Filters
                </button>
              )}
            </div>

            {/* Live Records Count */}
            <div className="toolbar-right" style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
              <span className="records-count-badge" style={{ height: '26px', display: 'inline-flex', alignItems: 'center', fontSize: '12px', whiteSpace: 'nowrap' }}>
                Showing&nbsp;<strong>{filteredRecords.length}</strong>&nbsp;of&nbsp;<strong>{procurementRecords.length}</strong>&nbsp;records
              </span>
            </div>
          </div>

          {/* TABLE WRAPPER */}
          <div className="price-history-table-wrapper crm-table-viewport">
            {filteredRecords.length === 0 ? (
              <div className="price-history-empty-card">
                <div className="empty-icon-circle">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <h3>{hasActiveFilters ? 'No Records Match Filter Criteria' : 'No Purchase History Available'}</h3>
                <p>
                  {hasActiveFilters
                    ? 'No historical procurement records match your search or date filters. Try resetting the filters.'
                    : 'No procurement records or Goods Receipts (GRNs) have been recorded yet. When purchase orders are received, historical rates will appear here automatically.'}
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    className="crm-btn-primary compact"
                    onClick={resetFilters}
                    style={{ marginTop: '12px' }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <table className="price-history-table crm-master-table">
                <thead>
                  <tr>
                    <th style={{ width: '130px' }}>DATE</th>
                    {isAllMode && <th style={{ width: '220px' }}>PRODUCT / SKU</th>}
                    <th style={{ width: '180px' }}>SOURCE / REFERENCE</th>
                    <th>SUPPLIER / PARTY</th>
                    <th style={{ width: '130px', textAlign: 'right' }}>PURCHASE RATE</th>
                    <th style={{ width: '90px', textAlign: 'right' }}>GST %</th>
                    <th style={{ width: '140px', textAlign: 'right' }}>TOTAL VALUE</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((item, idx) => {
                    const rowKey = item.id || `ph-${idx}`;
                    const grnRef =
                      item.referenceType === 'GRN' ||
                      item.referenceType === 'GOODS_RECEIPT' ||
                      String(item.reference || '').startsWith('GRN-')
                        ? String(item.reference || item.referenceId)
                        : null;
                    const poRef =
                      item.referenceType === 'PO' || String(item.reference || '').startsWith('PO-')
                        ? String(item.reference || item.referenceId)
                        : item.poReference
                        ? String(item.poReference)
                        : null;
                    const isCatalogue = item.event === 'Product Added' || (!grnRef && !poRef);

                    // Primary non-link label for dropdown button
                    const primaryRefLabel = grnRef || poRef || (isCatalogue ? 'Catalogue Entry' : 'Initial Entry');
                    const isExpanded = expandedRefId === rowKey;

                    const supplierDisplay =
                      item.supplierName ||
                      item.partyName ||
                      (isCatalogue ? 'Initial Catalogue Entry' : 'Supplier');

                    const receivedQty = Math.abs(Number(item.quantity || item.orderedQty || 0));
                    const totalVal =
                      item.totalValue !== undefined && item.totalValue !== null
                        ? Number(item.totalValue)
                        : Number((receivedQty * Number(item.unitRate || 0)).toFixed(2));

                    const itemUnit = item.unit || product?.unit || 'Nos';

                    return (
                      <tr key={rowKey} className={isExpanded ? 'row-expanded' : ''}>
                        {/* 1. DATE */}
                        <td className="cell-date">
                          <span className="date-text">{formatDate(item.date)}</span>
                        </td>

                        {/* PRODUCT / SKU (Only in All Stocks mode) */}
                        {isAllMode && (
                          <td className="cell-product" style={{ verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <button
                                type="button"
                                onClick={() => handleSelectProduct(item.productId || item.productCode)}
                                style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontWeight: 600, color: '#0284c7', fontSize: '13px' }}
                                title="Click to view dedicated price history for this product"
                              >
                                {item.productName || item.productId}
                              </button>
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <span className="master-code" style={{ fontSize: '11px', background: '#f1f5f9', padding: '1px 5px', borderRadius: '3px' }}>
                                  {item.productCode || item.sku || '—'}
                                </span>
                                {item.brandName && (
                                  <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                                    {item.brandName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        )}

                        {/* 2. SOURCE / REFERENCE — NON-LINK DROPDOWN */}
                        <td className="cell-source-ref">
                          <div className="price-ref-dropdown-container">
                            <button
                              type="button"
                              className={`price-ref-dropdown-btn ${isExpanded ? 'active' : ''}`}
                              onClick={() => toggleDropdown(rowKey)}
                              aria-expanded={isExpanded}
                              aria-label={`Toggle reference details for ${primaryRefLabel}`}
                              title="Click to view local reference details"
                            >
                              <span className="price-ref-text">{primaryRefLabel}</span>
                              <span className="price-ref-chevron" aria-hidden="true">
                                {isExpanded ? '▲' : '▼'}
                              </span>
                            </button>

                            {/* Informational popover / expand in-place */}
                            {isExpanded && (
                              <div
                                className="price-ref-details-panel"
                                role="region"
                                aria-label="Reference Details"
                              >
                                <div className="details-panel-header">
                                  <span>Reference Details</span>
                                  <button
                                    type="button"
                                    className="details-panel-close-btn"
                                    onClick={() => toggleDropdown(rowKey)}
                                    aria-label="Close details"
                                  >
                                    ×
                                  </button>
                                </div>
                                <div className="details-panel-body">
                                  {isAllMode && (
                                    <div className="details-row">
                                      <span className="details-label">Product:</span>
                                      <span className="details-val font-semibold">{item.productName} ({item.productCode})</span>
                                    </div>
                                  )}
                                  <div className="details-row">
                                    <span className="details-label">GRN Reference:</span>
                                    <span className="details-val mono">{grnRef || '—'}</span>
                                  </div>
                                  <div className="details-row">
                                    <span className="details-label">PO Reference:</span>
                                    <span className="details-val mono">{poRef || '—'}</span>
                                  </div>
                                  <div className="details-row">
                                    <span className="details-label">Received Qty:</span>
                                    <span className="details-val">
                                      {receivedQty > 0 ? `${receivedQty} ${itemUnit !== 'Piece' ? itemUnit : 'Nos'}` : '—'}
                                    </span>
                                  </div>
                                  <div className="details-row">
                                    <span className="details-label">Receipt Date:</span>
                                    <span className="details-val">{formatDate(item.date)}</span>
                                  </div>
                                  {item.remarks && (
                                    <div className="details-row remarks-row">
                                      <span className="details-label">Notes:</span>
                                      <span className="details-val">{item.remarks}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 3. SUPPLIER / PARTY */}
                        <td className="cell-supplier">
                          <span className="supplier-text" title={supplierDisplay}>
                            {supplierDisplay}
                          </span>
                        </td>

                        {/* 4. PURCHASE RATE */}
                        <td className="cell-rate text-right">
                          <strong className="rate-text">{money(item.unitRate)}</strong>
                        </td>

                        {/* 5. GST % */}
                        <td className="cell-gst text-right">
                          <span className="gst-text">
                            {item.gstRate !== undefined && item.gstRate !== null ? `${item.gstRate}%` : '—'}
                          </span>
                        </td>

                        {/* 6. TOTAL VALUE */}
                        <td className="cell-total text-right">
                          <strong className="total-text">{money(totalVal)}</strong>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {filteredRecords.length > 0 && (
              <div className="crm-table-footer" style={{ padding: '10px 16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748b' }}>
                <span>Showing {filteredRecords.length} {filteredRecords.length === 1 ? 'price record' : 'price records'}</span>
                <span>Procurement price history audit trail</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
