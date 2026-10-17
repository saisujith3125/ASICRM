import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch, apiUrl } from '../../api';
import { hasPermission } from '../../utils/permissions';
import { navigate } from '../../router';
import { formatDate, formatDateTime, formatTime } from '../../utils/dateUtils';
import NewStockMovementModal from './NewStockMovementModal';
import StockMovementDetailModal from './StockMovementDetailModal';
import StockMovementHistoryModal from './StockMovementHistoryModal';
import StockMovementPage from './StockMovementPage';
import ProductHistoryView, { getProductStockStatus } from './ProductHistoryView';
import { TableFooter, useTablePagination } from '../common/TableWorkspace';
import { filterRecordsBySearch } from '../../utils/searchHelper';

const BRANCHES = [
  { id: 'overview', label: 'Overview', singular: 'Overview', icon: '⌂', description: 'View inventory health, value, and quick stock insights.' },
  { id: 'categories', label: 'Categories', singular: 'Category', icon: '▦', description: 'Define broad product groups.' },
  { id: 'subcategories', label: 'Subcategories', singular: 'Subcategory', icon: '↳', description: 'Organize products within a category.' },
  { id: 'brands', label: 'Brands', singular: 'Brand', icon: '◇', description: 'Maintain manufacturers and brands.' },
  { id: 'products', label: 'Products', singular: 'Product', icon: '□', description: 'Manage catalogue, stock and pricing.' },
  { id: 'movements', label: 'Stock Movement', singular: 'Stock Movement', icon: '⇅', description: 'Audit physical stock transactions and balance ledger.' },
  { id: 'price-history', label: 'Price History', singular: 'Price History', icon: '📈', description: 'Audit historical procurement rates, Goods Receipts, and purchase orders.' }
];

const EMPTY_DATA = { categories: [], subcategories: [], brands: [], products: [] };
const emptyForm = {
  name: '', description: '', categoryId: '', code: '', subcategoryId: '', brandId: '',
  unit: 'Nos', size: '', cost: '', dealerPercentage: '', dealerPrice: '', mrpPercentage: '', mrp: '', stock: '', alertQuantity: '', gst: '',
  hsnSac: '', productDetails: '', productLink: '', serialized: true
};

function headers(user) {
  return {
    'Content-Type': 'application/json',
    'x-user-id': user?.id || '',
  };
}

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const isTestRecord = (record) => {
  const name = String(record?.name || '').trim();
  const description = String(record?.description || '').trim();
  const code = String(record?.code || record?.id || '').trim();
  return (
    /^test\b/i.test(name) ||
    /^test\b/i.test(description) ||
    /^(cat|cat2|subcat|brand)\s+\d{8,}$/i.test(name) ||
    /^brand\s+\d{8,}$/i.test(code)
  );
};
const SearchIcon = () => <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="m16 16 5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
const EyeIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const PencilIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);
const Trash2Icon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" x2="10" y1="11" y2="17" />
    <line x1="14" x2="14" y1="11" y2="17" />
  </svg>
);
const PlusIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);
const ExternalLinkIcon = ({ size = 11, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);
const MovementIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);
const PriceHistoryIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline points="16 7 22 7 22 13" />
  </svg>
);

export default function StockPage({ user, branch: activeBranch, setBranch: setActiveBranch, onCreateProduct, onOpenProductInfo, activeProductId }) {
  const [localBranch, setLocalBranch] = useState('overview');
  const branch = BRANCHES.some((item) => item.id === activeBranch) ? activeBranch : localBranch;
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [productStockFilter, setProductStockFilter] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('filter') === 'low' || window.history.state?.lowStockOnly || window.history.state?.stockFilter === 'low') {
        return 'low';
      }
      if (params.get('filter') === 'healthy' || window.history.state?.stockFilter === 'healthy') {
        return 'healthy';
      }
    }
    return 'all';
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [detailItem, setDetailItem] = useState(null);

  // Stock movement modal states
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementInitialProduct, setMovementInitialProduct] = useState('');
  const [movementInitialType, setMovementInitialType] = useState('STOCK IN');
  const [selectedMovementForDetail, setSelectedMovementForDetail] = useState(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyModalProductId, setHistoryModalProductId] = useState('');

  const canView = hasPermission(user, 'Stocks', 'View');
  const canCreate = hasPermission(user, 'Stocks', 'Create');
  const canEdit = hasPermission(user, 'Stocks', 'Edit');
  const canDelete = hasPermission(user, 'Stocks', 'Delete');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(apiUrl('/api/stocks'), { headers: headers(user) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Unable to load stocks.');
      setData(json.data || EMPTY_DATA);
    } catch (e) {
      setError(e.message || 'Unable to load stocks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.id, user?.role]);

  useEffect(() => {
    if (branch === 'products' && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const state = window.history.state;
      if (params.get('filter') === 'low' || state?.lowStockOnly || state?.stockFilter === 'low') {
        setProductStockFilter('low');
      } else if (params.get('filter') === 'healthy' || state?.stockFilter === 'healthy') {
        setProductStockFilter('healthy');
      }
    }
  }, [branch]);

  const visibleData = useMemo(() => {
    const categories = (data.categories || []).filter((item) => !isTestRecord(item));
    const categoryIds = new Set(categories.map((item) => item.id));
    const subcategories = (data.subcategories || []).filter(
      (item) => !isTestRecord(item) && categoryIds.has(item.categoryId)
    );
    const subcategoryIds = new Set(subcategories.map((item) => item.id));
    const brands = (data.brands || []).filter((item) => !isTestRecord(item));
    const brandIds = new Set(brands.map((item) => item.id));
    const products = (data.products || []).filter(
      (item) =>
        !isTestRecord(item) &&
        categoryIds.has(item.categoryId) &&
        (!item.subcategoryId || subcategoryIds.has(item.subcategoryId)) &&
        (!item.brandId || brandIds.has(item.brandId))
    );
    return { categories, subcategories, brands, products };
  }, [data]);

  const stats = useMemo(() => {
    const products = visibleData.products;
    const low = products.filter((p) => p.lowStock);
    return {
      categories: visibleData.categories.length,
      subcategories: visibleData.subcategories.length,
      brands: visibleData.brands.length,
      products: products.length,
      units: products.reduce((sum, p) => sum + Number(p.stock || 0), 0),
      stockValue: products.reduce((sum, p) => sum + Number(p.stockValue || 0), 0),
      lowStock: low.length,
      healthy: products.filter((p) => !p.lowStock).length,
      lowStockProducts: low
    };
  }, [visibleData]);

  const branchMeta = BRANCHES.find((x) => x.id === branch) || BRANCHES[0];

  const filteredRows = useMemo(() => {
    let base = branch === 'overview' ? [] : (visibleData[branch] || []);
    if (branch === 'products' && productStockFilter === 'low') {
      base = base.filter((row) => row.lowStock);
    } else if (branch === 'products' && productStockFilter === 'healthy') {
      base = base.filter((row) => !row.lowStock);
    }

    if (branch === 'products') {
      return filterRecordsBySearch(base, query, [
        (p) => p.code,
        (p) => p.id,
        (p) => p.name,
        (p) => p.sku,
        (p) => p.model,
        (p) => p.categoryName,
        (p) => p.subcategoryName,
        (p) => p.brandName,
        (p) => p.unit,
        (p) => p.description,
        (p) => p.hsnSac,
        (p) => p.hsn,
        (p) => p.productDetails,
        (p) => p.serialNumbers?.join(' ')
      ]);
    } else if (branch === 'brands') {
      return filterRecordsBySearch(base, query, [
        (b) => b.code,
        (b) => b.id,
        (b) => b.name,
        (b) => b.description
      ]);
    } else if (branch === 'categories') {
      return filterRecordsBySearch(base, query, [
        (c) => c.code,
        (c) => c.id,
        (c) => c.name,
        (c) => c.description
      ]);
    } else if (branch === 'subcategories') {
      return filterRecordsBySearch(base, query, [
        (s) => s.code,
        (s) => s.id,
        (s) => s.name,
        (s) => s.categoryName,
        (s) => s.description
      ]);
    }
    return base;
  }, [branch, query, visibleData, productStockFilter]);

  const pagination = useTablePagination(filteredRows, {
    rowHeight: 44,
    resetDeps: [branch, query, productStockFilter]
  });

  const go = (nextBranch, options = {}) => {
    if (!BRANCHES.some((item) => item.id === nextBranch)) return;
    (setActiveBranch || setLocalBranch)(nextBranch, options);
    setQuery('');
    setProductStockFilter(options.stockFilter || (options.lowStockOnly ? 'low' : 'all'));
    setSelectedBrand(null);
    setDetailItem(null);
  };

  const openCreate = () => {
    if (branch === 'products' && onCreateProduct) {
      onCreateProduct();
      return;
    }
    setForm({ ...emptyForm });
    setModal({ mode: 'create' });
  };

  const openEdit = (row, targetBranch = null) => {
    const type = targetBranch || (branch === 'overview' ? 'products' : branch);
    if (type === 'products') {
      navigate(`/stocks/products/${encodeURIComponent(row.id)}/edit`);
      return;
    }
    const cost = Number(row.cost || 0);
    const dealer = Number(row.dealerPrice || 0);
    const mrp = Number(row.mrp || 0);
    const derivedDealerPct = cost > 0 ? (((dealer - cost) / cost) * 100).toFixed(2) : '';
    const derivedMrpPct = cost > 0 ? (((mrp - cost) / cost) * 100).toFixed(2) : '';
    setForm({
      ...emptyForm,
      ...row,
      serialized: row.serialized !== undefined ? Boolean(row.serialized) : true,
      dealerPercentage: row.dealerPercentage ?? derivedDealerPct,
      mrpPercentage: row.mrpPercentage ?? derivedMrpPct
    });
    setModal({ mode: 'edit', id: row.id, branch: type });
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const effectiveBranch = modal?.branch || (branch === 'overview' ? 'products' : branch);
    try {
      let payload;
      if (effectiveBranch === 'categories' || effectiveBranch === 'brands') {
        payload = { name: form.name.trim(), description: form.description.trim() };
      } else if (effectiveBranch === 'subcategories') {
        payload = { name: form.name.trim(), categoryId: form.categoryId, description: form.description.trim() };
      } else {
        payload = {
          code: form.code.trim(), name: form.name.trim(), description: form.description.trim(),
          hsnSac: form.hsnSac.trim(), productDetails: form.productDetails.trim(), productLink: form.productLink.trim(),
          categoryId: form.categoryId, subcategoryId: form.subcategoryId || null, brandId: form.brandId || null,
          unit: (form.unit && form.unit.trim() !== 'Piece') ? form.unit.trim() : 'Nos', size: form.size.trim(), cost: Number(form.cost),
          dealerPercentage: Number(form.dealerPercentage || 0), mrpPercentage: Number(form.mrpPercentage || 0),
          dealerPrice: Number(form.dealerPrice), mrp: Number(form.mrp),
          stock: Number(form.stock || 0), alertQuantity: Number(form.alertQuantity || 0), gst: Number(form.gst || 0),
          serialized: Boolean(form.serialized !== false)
        };
      }

      const path = apiUrl(`/api/stocks/${effectiveBranch}${modal.mode === 'edit' ? `/${modal.id}` : ''}`);
      const res = await apiFetch(path, {
        method: modal.mode === 'edit' ? 'PUT' : 'POST',
        headers: headers(user),
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Unable to save stock record.');
      setData(json.data || EMPTY_DATA);
      setModal(null);
      setForm({ ...emptyForm });
    } catch (e) {
      setError(e.message || 'Unable to save stock record.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row, targetBranch = null) => {
    const type = targetBranch || (branch === 'overview' ? 'products' : branch);
    if (!window.confirm(`Delete ${row.name}?`)) return;
    setError('');
    try {
      const res = await apiFetch(apiUrl(`/api/stocks/${type}/${row.id}`), { method: 'DELETE', headers: headers(user) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Unable to delete record.');
      setData(json.data || EMPTY_DATA);
    } catch (e) {
      setError(e.message || 'Unable to delete record.');
    }
  };

  if (loading) return <div className="crm-loading-full"><div className="crm-spinner" /><p>Loading stocks...</p></div>;
  if (!canView) return <div className="settings-access-denied"><h2>Stocks Restricted</h2><p>Your role does not have access to the stock master.</p></div>;
  if (selectedProduct) {
    return (
      <div className="stocks-page">
        <ProductInfoPage product={selectedProduct} onBack={() => setSelectedProduct(null)} />
      </div>
    );
  }

  return (
    <div className="stocks-page">
      {error && <div className="crm-alert-box error"><span>{error}</span><button type="button" onClick={() => setError('')} className="close-toast-btn">✕</button></div>}

      {branch === 'overview' ? (
        <StocksOverview
          summary={data.summary || stats}
          products={visibleData.products}
          recentInventoryProducts={data.recentInventoryProducts}
          categories={visibleData.categories}
          brands={visibleData.brands}
          recentMovements={data.recentMovements || []}
          lowStockProducts={data.lowStockProducts || stats.lowStockProducts || []}
          onNavigate={go}
          onRefresh={load}
          onOpenMovementModal={(prodId = '', type = 'STOCK IN') => {
            setMovementInitialProduct(prodId);
            setMovementInitialType(type);
            setMovementModalOpen(true);
          }}
          onOpenMovementDetail={(mov) => setSelectedMovementForDetail(mov)}
          onOpenHistoryModal={(prodId = '') => {
            setHistoryModalProductId(prodId);
            setHistoryModalOpen(true);
          }}
          canView={canView}
          canCreate={canCreate}
          canEdit={canEdit}
          canDelete={canDelete}
          onOpenProductInfo={(p) => (onOpenProductInfo ? onOpenProductInfo(p) : setSelectedProduct(p))}
          onEditProduct={(p) => openEdit(p, 'products')}
          onDeleteProduct={(p) => remove(p, 'products')}
        />
      ) : branch === 'movements' ? (
        <StockMovementPage
          user={user}
          productId={activeProductId}
          onBack={() => go('overview')}
          onNavigateOverview={() => go('overview')}
          products={visibleData.products}
          onRefreshData={load}
          onOpenProductHistory={(prodId, movId) => {
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('asicrm_product_return', '/stocks/movements');
            }
            if (onOpenProductInfo) {
              onOpenProductInfo({ id: prodId, initialMovementId: movId });
            } else {
              navigate(`/stocks/products/${encodeURIComponent(prodId)}?movement=${encodeURIComponent(movId || '')}`);
            }
          }}
        />
      ) : branch === 'price-history' ? (
        <ProductPriceHistoryPage
          productId={activeProductId}
          user={user}
          onBack={() => go('overview')}
        />
      ) : (
      <section className="stocks-content-card stocks-master-page">
        <div className="stocks-content-header">
          <div className="stocks-branch-heading">
            <h2>{branchMeta.label}</h2>
            <p>{branchMeta.description}</p>
          </div>
          <div className="stocks-toolbar">
            <label className="stocks-search-wrap">
              <SearchIcon />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${branchMeta.label.toLowerCase()}...`}
                aria-label={`Search ${branchMeta.label.toLowerCase()}`}
                type="text"
                autoComplete="off"
              />
              {query && <button type="button" className="stocks-search-clear" onClick={() => setQuery('')} aria-label="Clear search" title="Clear search">×</button>}
            </label>
            <button type="button" className="stocks-refresh-btn" onClick={load} disabled={loading} aria-label={`Refresh ${branchMeta.label.toLowerCase()}`}>Refresh</button>
            {canCreate && <button type="button" className="crm-btn-primary" onClick={openCreate}>+ Add {branchMeta.singular}</button>}
          </div>
        </div>

        {branch === 'products' && (
          <div className="product-analysis-strip" aria-label="Product stock metrics">
            <button
              type="button"
              className={`stock-inline-metric-button ${productStockFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => {
                setProductStockFilter('all');
                (setActiveBranch || setLocalBranch)('products', { stockFilter: 'all' });
              }}
              aria-pressed={productStockFilter === 'all'}
            >
              <span>Inventory value</span><strong>{money(stats.stockValue)}</strong><small>All products</small>
            </button>
            <button
              type="button"
              className={`stock-inline-metric-button ${productStockFilter === 'healthy' ? 'is-active' : ''}`}
              onClick={() => {
                setProductStockFilter('healthy');
                (setActiveBranch || setLocalBranch)('products', { stockFilter: 'healthy' });
              }}
              aria-pressed={productStockFilter === 'healthy'}
            >
              <span>Healthy lines</span><strong>{stats.healthy}</strong><small>Healthy stock</small>
            </button>
            <button
              type="button"
              className={`stock-inline-metric-button ${productStockFilter === 'low' ? 'is-active' : ''}`}
              onClick={() => {
                setProductStockFilter('low');
                (setActiveBranch || setLocalBranch)('products', { lowStockOnly: true, stockFilter: 'low' });
              }}
              aria-pressed={productStockFilter === 'low'}
            >
              <span>Low stock</span><strong>{stats.lowStock}</strong><small>Needs attention</small>
            </button>
          </div>
        )}

        {branch === 'products' && productStockFilter !== 'all' && (
          <div className="active-filter-bar">
            <span>{productStockFilter === 'low' ? 'Showing low-stock products only' : 'Showing healthy products only'}</span>
            <button
              type="button"
              onClick={() => {
                setProductStockFilter('all');
                (setActiveBranch || setLocalBranch)('products', { stockFilter: 'all' });
              }}
            >
              Clear filter
            </button>
          </div>
        )}

        <div className="settings-table-shell stocks-table-shell crm-table-workspace">
          <div className="crm-table-scroll-wrap stocks-table-natural-wrap crm-table-viewport">
            <table className={`crm-data-table settings-table ${branch}-settings-table crm-master-table`}>
              {branch === 'brands' && (
                <colgroup>
                  <col className="col-stock-index" style={{ width: '5%' }} />
                  <col className="col-stock-code" style={{ width: '12%' }} />
                  <col className="col-stock-brand" style={{ width: '25%' }} />
                  <col className="col-stock-products" style={{ width: '12%' }} />
                  <col className="col-stock-description" style={{ width: '36%' }} />
                  <col className="col-stock-actions" style={{ width: '10%' }} />
                </colgroup>
              )}
              {branch === 'categories' && (
                <colgroup>
                  <col className="col-stock-index" style={{ width: '5%' }} />
                  <col className="col-stock-code" style={{ width: '14%' }} />
                  <col className="col-stock-category" style={{ width: '40%' }} />
                  <col className="col-stock-subcategories" style={{ width: '16%' }} />
                  <col className="col-stock-products" style={{ width: '15%' }} />
                  <col className="col-stock-actions" style={{ width: '10%' }} />
                </colgroup>
              )}
              {branch === 'subcategories' && (
                <colgroup>
                  <col className="col-stock-index" style={{ width: '5%' }} />
                  <col className="col-stock-code" style={{ width: '14%' }} />
                  <col className="col-stock-subcategory" style={{ width: '30%' }} />
                  <col className="col-stock-parent-cat" style={{ width: '26%' }} />
                  <col className="col-stock-products" style={{ width: '15%' }} />
                  <col className="col-stock-actions" style={{ width: '10%' }} />
                </colgroup>
              )}
              {branch === 'products' && (
                <colgroup>
                  <col className="col-stock-index" style={{ width: '4%' }} />
                  <col className="col-stock-product" style={{ width: '27%' }} />
                  <col className="col-stock-category" style={{ width: '13%' }} />
                  <col className="col-stock-subcategory" style={{ width: '12%' }} />
                  <col className="col-stock-brand" style={{ width: '12%' }} />
                  <col className="col-stock-stock" style={{ width: '10%' }} />
                  <col className="col-stock-mrp" style={{ width: '9%' }} />
                  <col className="col-stock-actions" style={{ width: '13%' }} />
                </colgroup>
              )}
            <thead>
              {branch === 'categories' && (
                <tr>
                  <th className="col-priority-low" style={{ textAlign: 'center' }}>#</th>
                  <th className="col-priority-high">CODE</th>
                  <th className="col-priority-high">CATEGORY</th>
                  <th className="col-priority-med" style={{ textAlign: 'center' }}>SUBCATEGORIES</th>
                  <th className="col-priority-med" style={{ textAlign: 'center' }}>PRODUCTS</th>
                  <th className="actions-col col-priority-high" style={{ textAlign: 'center' }}>ACTIONS</th>
                </tr>
              )}
              {branch === 'subcategories' && (
                <tr>
                  <th className="col-priority-low" style={{ textAlign: 'center' }}>#</th>
                  <th className="col-priority-high">CODE</th>
                  <th className="col-priority-high">SUBCATEGORY</th>
                  <th className="col-priority-med">CATEGORY</th>
                  <th className="col-priority-med" style={{ textAlign: 'center' }}>PRODUCTS</th>
                  <th className="actions-col col-priority-high" style={{ textAlign: 'center' }}>ACTIONS</th>
                </tr>
              )}
              {branch === 'brands' && (
                <tr>
                  <th className="col-priority-low" style={{ textAlign: 'center' }}>#</th>
                  <th className="col-priority-high">CODE</th>
                  <th className="col-priority-high">BRAND</th>
                  <th className="col-priority-med" style={{ textAlign: 'center' }}>PRODUCTS</th>
                  <th className="col-priority-low">DESCRIPTION</th>
                  <th className="actions-col col-priority-high" style={{ textAlign: 'center' }}>ACTIONS</th>
                </tr>
              )}
              {branch === 'products' && (
                <tr>
                  <th className="col-priority-low" style={{ textAlign: 'center' }}>#</th>
                  <th className="col-priority-high">PRODUCT</th>
                  <th className="col-priority-med">CATEGORY</th>
                  <th className="col-priority-low">SUBCATEGORY</th>
                  <th className="col-priority-med">BRAND</th>
                  <th className="col-priority-high" style={{ textAlign: 'center' }}>STOCK</th>
                  <th className="col-priority-med" style={{ textAlign: 'right' }}>MRP</th>
                  <th className="actions-col col-priority-high" style={{ textAlign: 'center' }}>ACTIONS</th>
                </tr>
              )}
            </thead>
            <tbody>
              {pagination.currentItems.map((row, index) => {
                const rowNumber = (pagination.currentPage - 1) * pagination.pageSize + index + 1;
                const subCount = branch === 'categories' ? visibleData.subcategories.filter((x) => x.categoryId === row.id).length : 0;
                const productCount = branch === 'categories' ? visibleData.products.filter((x) => x.categoryId === row.id).length : branch === 'subcategories' ? visibleData.products.filter((x) => x.subcategoryId === row.id).length : branch === 'brands' ? visibleData.products.filter((x) => x.brandId === row.id).length : 0;
                return <tr key={row.id}>
                  <td className="col-priority-low" data-label="#">
                    <div className="stock-table-cell-content text-center">{rowNumber}</div>
                  </td>
                  {branch !== 'products' && (
                    <td className="col-priority-high" data-label="Code">
                      <div className="stock-table-cell-content text-nowrap">
                        <span className="master-code">{row.code || row.id}</span>
                      </div>
                    </td>
                  )}
                  {branch === 'categories' && <>
                    <td className="col-priority-high cell-wrap" data-label="Category">
                      <div className="stock-table-cell-content">
                        <strong className="stock-cell-title" title={row.name}>{row.name}</strong>
                        <StockDescriptionCell item={row} type="Category" onOpenDetail={setDetailItem} />
                      </div>
                    </td>
                    <td className="col-priority-med" data-label="Subcategories">
                      <div className="stock-table-cell-content text-center">
                        <button type="button" className="count-link" onClick={() => go('subcategories')}>{subCount}</button>
                      </div>
                    </td>
                    <td className="col-priority-med" data-label="Products">
                      <div className="stock-table-cell-content text-center">
                        <button type="button" className="count-link" onClick={() => go('products')}>{productCount}</button>
                      </div>
                    </td>
                  </>}
                  {branch === 'subcategories' && <>
                    <td className="col-priority-high cell-wrap" data-label="Subcategory">
                      <div className="stock-table-cell-content">
                        <strong className="stock-cell-title" title={row.name}>{row.name}</strong>
                        <StockDescriptionCell item={row} type="Subcategory" onOpenDetail={setDetailItem} />
                      </div>
                    </td>
                    <td className="col-priority-med" data-label="Category">
                      <div className="stock-table-cell-content text-truncate" title={row.categoryName}>{row.categoryName}</div>
                    </td>
                    <td className="col-priority-med" data-label="Products">
                      <div className="stock-table-cell-content text-center">
                        <button type="button" className="count-link" onClick={() => go('products')}>{productCount}</button>
                      </div>
                    </td>
                  </>}
                  {branch === 'brands' && <>
                    <td className="col-priority-high cell-wrap" data-label="Brand">
                      <div className="stock-table-cell-content">
                        <button type="button" className="table-link-button text-truncate" onClick={() => setSelectedBrand(row)} title={row.name}>
                          <strong>{row.name}</strong>
                        </button>
                      </div>
                    </td>
                    <td className="col-priority-med" data-label="Products">
                      <div className="stock-table-cell-content text-center">
                        <button type="button" className="count-link" onClick={() => go('products')}>{productCount}</button>
                      </div>
                    </td>
                    <td className="col-priority-low cell-wrap brand-desc-cell" data-label="Description">
                      <div className="stock-table-cell-content brand-desc-cell-content">
                        <StockDescriptionCell item={row} type="Brand" onOpenDetail={setDetailItem} standalone={true} />
                      </div>
                    </td>
                  </>}
                  {branch === 'products' && <>
                    <td className="col-priority-high cell-wrap" data-label="Product">
                      <div className="stock-table-cell-content">
                        <button
                          type="button"
                          className="table-link-button product-table-link text-truncate"
                          onClick={() => {
                            if (typeof window !== 'undefined') sessionStorage.setItem('asicrm_product_return', '/stocks/products');
                            if (onOpenProductInfo) onOpenProductInfo(row);
                            else setSelectedProduct(row);
                          }}
                          title={row.name}
                        >
                          <strong>{row.name}</strong>
                        </button>
                        <small className="table-secondary-text text-truncate">{row.code}</small>
                      </div>
                    </td>
                    <td className="col-priority-med" data-label="Category">
                      <div className="stock-table-cell-content text-truncate" title={row.categoryName}>{row.categoryName}</div>
                    </td>
                    <td className="col-priority-low" data-label="Subcategory">
                      <div className="stock-table-cell-content text-truncate" title={row.subcategoryName || '—'}>{row.subcategoryName || '—'}</div>
                    </td>
                    <td className="col-priority-med" data-label="Brand">
                      <div className="stock-table-cell-content text-truncate" title={row.brandName}>{row.brandName}</div>
                    </td>
                    <td className="col-priority-high" data-label="Stock">
                      <div className="stock-table-cell-content text-center">
                        <span className={`status-badge ${row.lowStock ? 'badge-amber' : 'badge-green'}`}>{row.stock} {row.unit && row.unit !== 'Piece' ? row.unit : 'Nos'}{row.lowStock ? ' · Low' : ''}</span>
                      </div>
                    </td>
                    <td className="col-priority-med" data-label="MRP">
                      <div className="stock-table-cell-content text-right text-nowrap">
                        <strong>{money(row.mrp)}</strong>
                      </div>
                    </td>
                  </>}
                  <td className="actions-col col-priority-high" data-label="Actions">
                    <div className="stock-table-cell-content text-center">
                      <div className="settings-row-actions">
                        {branch === 'products' && (
                          <>
                            <button
                              type="button"
                              className="settings-row-action settings-row-icon"
                              onClick={() => {
                                if (typeof window !== 'undefined') sessionStorage.setItem('asicrm_product_return', '/stocks/products');
                                if (onOpenProductInfo) onOpenProductInfo(row);
                                else setSelectedProduct(row);
                              }}
                              aria-label={`View information for ${row.name}`}
                              title="Product Information"
                            >
                              <EyeIcon size={14} />
                            </button>
                            <button
                              type="button"
                              className="settings-row-action settings-row-icon"
                              onClick={() => {
                                navigate(`/stocks/products/${encodeURIComponent(row.id)}/movements`);
                              }}
                              aria-label={`View stock movement ledger for ${row.name}`}
                              title="Stock Movement Ledger"
                            >
                              <MovementIcon size={14} />
                            </button>
                            <button
                              type="button"
                              className="settings-row-action settings-row-icon"
                              onClick={() => {
                                navigate(`/stocks/products/${encodeURIComponent(row.id)}/price-history`);
                              }}
                              aria-label={`View price history for ${row.name}`}
                              title="Price History"
                            >
                              <PriceHistoryIcon size={14} />
                            </button>
                          </>
                        )}
                        {branch === 'brands' && (
                          <button type="button" className="settings-row-action settings-row-icon" onClick={() => setSelectedBrand(row)} aria-label={`View ${row.name}`} title="View Brand">
                            <EyeIcon size={14} />
                          </button>
                        )}
                        {canEdit && (
                          <button type="button" className="settings-row-action settings-row-icon" onClick={() => openEdit(row)} aria-label={`Edit ${row.name || ''}`} title={`Edit ${branchMeta.singular}`}>
                            <PencilIcon size={14} />
                          </button>
                        )}
                        {canDelete && (
                          <button type="button" className="settings-row-action danger settings-row-icon" onClick={() => remove(row)} aria-label={`Delete ${row.name || ''}`} title={`Delete ${branchMeta.singular}`}>
                            <Trash2Icon size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>;
              })}
              {filteredRows.length > 0 && pagination.currentItems.length < pagination.pageSize && (
                Array.from({ length: pagination.pageSize - pagination.currentItems.length }).map((_, fIdx) => (
                  <tr key={`filler-${branch}-${fIdx}`} className="table-data-row table-filler-row" aria-hidden="true">
                    <td className="col-priority-low text-center">&nbsp;</td>
                    {branch === 'products' ? (
                      <>
                        <td className="col-priority-high">&nbsp;</td>
                        <td className="col-priority-med">&nbsp;</td>
                        <td className="col-priority-low">&nbsp;</td>
                        <td className="col-priority-med">&nbsp;</td>
                        <td className="col-priority-high text-center">&nbsp;</td>
                        <td className="col-priority-med text-right">&nbsp;</td>
                        <td className="actions-col col-priority-high text-center">&nbsp;</td>
                      </>
                    ) : branch === 'brands' ? (
                      <>
                        <td className="col-priority-high text-nowrap">&nbsp;</td>
                        <td className="col-priority-high">&nbsp;</td>
                        <td className="col-priority-med text-center">&nbsp;</td>
                        <td className="col-priority-low">&nbsp;</td>
                        <td className="actions-col col-priority-high text-center">&nbsp;</td>
                      </>
                    ) : branch === 'subcategories' ? (
                      <>
                        <td className="col-priority-high text-nowrap">&nbsp;</td>
                        <td className="col-priority-high">&nbsp;</td>
                        <td className="col-priority-med">&nbsp;</td>
                        <td className="col-priority-med text-center">&nbsp;</td>
                        <td className="actions-col col-priority-high text-center">&nbsp;</td>
                      </>
                    ) : (
                      <>
                        <td className="col-priority-high text-nowrap">&nbsp;</td>
                        <td className="col-priority-high">&nbsp;</td>
                        <td className="col-priority-med text-center">&nbsp;</td>
                        <td className="col-priority-med text-center">&nbsp;</td>
                        <td className="actions-col col-priority-high text-center">&nbsp;</td>
                      </>
                    )}
                  </tr>
                ))
              )}
              {!filteredRows.length && (
                <tr>
                  <td colSpan={branch === 'products' ? 8 : 6}>
                    <div className="table-empty-state">
                      <p>{productStockFilter === 'low' ? (query.trim() ? `No low-stock products found matching "${query.trim()}".` : 'No low-stock products found.') : query.trim() ? `No ${branchMeta.label.toLowerCase()} found matching "${query.trim()}".` : `No ${branchMeta.label.toLowerCase()} found.`}</p>
                      {canCreate && !query.trim() && productStockFilter === 'all' && <button className="crm-btn-primary compact" type="button" onClick={openCreate}>+ Add {branchMeta.singular}</button>}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          <TableFooter
            {...pagination.footerProps}
            recordLabel={branchMeta.label.toLowerCase()}
            singularLabel={branchMeta.singular.toLowerCase()}
          />
        </div>
      </section>
      )}
      {selectedBrand && <BrandDetails brand={selectedBrand} data={data} onClose={() => setSelectedBrand(null)} onProducts={() => { setSelectedBrand(null); go('products'); }} />}
      {detailItem && <StockItemDetailModal detail={detailItem} onClose={() => setDetailItem(null)} />}
      {modal && <StockModal branch={modal.branch || branch} mode={modal.mode} form={form} setForm={setForm} onClose={() => !saving && setModal(null)} onSave={save} saving={saving} data={data} />}

      {/* Stock Movement Modals */}
      <NewStockMovementModal
        isOpen={movementModalOpen}
        onClose={() => setMovementModalOpen(false)}
        onSuccess={() => {
          setMovementModalOpen(false);
          load();
        }}
        products={visibleData.products}
        initialProductId={movementInitialProduct}
        initialType={movementInitialType}
        user={user}
      />

      <StockMovementDetailModal
        isOpen={Boolean(selectedMovementForDetail)}
        movement={selectedMovementForDetail}
        onClose={() => setSelectedMovementForDetail(null)}
      />

      <StockMovementHistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        user={user}
        initialProductId={historyModalProductId}
      />
    </div>
  );
}

function StocksOverview({
  summary = {},
  products = [],
  recentInventoryProducts = [],
  categories = [],
  brands = [],
  recentMovements = [],
  lowStockProducts = [],
  onNavigate,
  onRefresh,
  onOpenMovementModal,
  onOpenMovementDetail,
  onOpenHistoryModal,
  canView = true,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  onOpenProductInfo,
  onEditProduct,
  onDeleteProduct
}) {
  // Determine ONLY the 3 most recently updated products dynamically
  const latest3Products = useMemo(() => {
    let list = [];
    if (Array.isArray(recentInventoryProducts) && recentInventoryProducts.length > 0) {
      list = recentInventoryProducts;
    } else if (Array.isArray(summary.recentInventoryProducts) && summary.recentInventoryProducts.length > 0) {
      list = summary.recentInventoryProducts;
    } else {
      list = [...(products || [])].map((p) => {
        let latestTime = 0;
        if (p.lastMovementAt) latestTime = Math.max(latestTime, new Date(p.lastMovementAt).getTime() || 0);
        if (p.updatedAt) latestTime = Math.max(latestTime, new Date(p.updatedAt).getTime() || 0);
        if (Array.isArray(p.history) && p.history.length > 0) {
          for (const h of p.history) {
            if (h.date) latestTime = Math.max(latestTime, new Date(h.date).getTime() || 0);
          }
        }
        if (p.createdAt) latestTime = Math.max(latestTime, new Date(p.createdAt).getTime() || 0);
        return { ...p, _latestTime: latestTime };
      }).sort((a, b) => b._latestTime - a._latestTime);
    }
    return list.slice(0, 3);
  }, [recentInventoryProducts, summary.recentInventoryProducts, products]);

  return (
    <div className="stocks-overview-screen">
      {/* 1. Page Header */}
      <div className="stocks-overview-header">
        <div className="stocks-header-title-group">
          <h1 className="stocks-main-heading">Stocks</h1>
          <p className="stocks-sub-heading">Manage inventory, stock availability and stock movement.</p>
        </div>
        <div className="stocks-header-actions">
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={onRefresh}
            title="Refresh stock ledger and balances"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}>
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            Refresh
          </button>
          {canCreate && (
            <button
              type="button"
              className="crm-btn-primary"
              onClick={() => onOpenMovementModal('', 'STOCK IN')}
              title="Record a stock movement transaction"
            >
              <PlusIcon size={14} />
              <span style={{ marginLeft: '4px' }}>New Stock Entry</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Dashboard Summary Area */}
      {/* 2. Top Dashboard Summary Area - Exactly 6 KPI Cards in 3x2 Grid */}
      <section className="stocks-summary-row stocks-overview-summary" aria-label="Inventory Summary KPIs">
        {/* Card 1: TOTAL PRODUCTS */}
        <div className="stocks-kpi-card" onClick={() => onNavigate && onNavigate('products')} style={{ cursor: 'pointer' }} title="View all Products">
          <small>TOTAL PRODUCTS</small>
          <strong>{summary.totalProducts ?? products.length}</strong>
        </div>

        {/* Card 2: TOTAL STOCK */}
        <div className="stocks-kpi-card">
          <small>TOTAL STOCK</small>
          <strong>{summary.totalStock ?? 0}</strong>
        </div>

        {/* Card 3: AVAILABLE STOCK */}
        <div className="stocks-kpi-card">
          <small>AVAILABLE STOCK</small>
          <strong style={{ color: '#16a34a' }}>{summary.availableStock ?? 0}</strong>
        </div>

        {/* Card 4: STOCK MOVEMENT (Replaces Reserved Stock) */}
        <div
          className="stocks-kpi-card stock-movement-kpi-card"
          onClick={() => {
            if (onNavigate) onNavigate('movements');
            navigate('/stocks/movements');
          }}
          style={{ cursor: 'pointer' }}
          title="View Stock Movement Ledger"
        >
          <small>STOCK MOVEMENT</small>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <strong>{summary.totalMovements ?? (Array.isArray(recentMovements) ? recentMovements.length : 0)}</strong>
            <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500 }}>Transactions</span>
          </div>
          <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 600, marginTop: '2px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            View Stock Movement →
          </span>
        </div>

        {/* Card 5: LOW STOCK */}
        <div className="stocks-kpi-card" onClick={() => onNavigate && onNavigate('products', { stockFilter: 'low', lowStockOnly: true })} style={{ cursor: 'pointer' }} title="Filter Low Stock Products">
          <small>LOW STOCK</small>
          <strong style={{ color: (summary.lowStockCount ?? summary.lowStock ?? 0) > 0 ? '#dc2626' : '#16a34a' }}>
            {summary.lowStockCount ?? summary.lowStock ?? 0}
          </strong>
        </div>

        {/* Card 6: INVENTORY VALUE */}
        <div className="stocks-kpi-card">
          <small>INVENTORY VALUE</small>
          <strong style={{ color: '#0f766e' }}>{money(summary.inventoryValue ?? 0)}</strong>
        </div>
      </section>

      {/* 3. Current Inventory Snapshot (Show ONLY 3 Products) */}
      <section className="stocks-inventory-workspace" aria-label="Current Inventory Snapshot">
        <div
          className="inventory-workspace-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 20px',
            borderBottom: '1px solid #edf2f7',
            background: '#ffffff',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div className="stocks-panel-heading">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2
                className="workspace-section-title"
                style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#0f172a',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase'
                }}
              >
                CURRENT INVENTORY
              </h2>
              <span
                className="status-badge badge-blue"
                style={{ fontSize: '11px', padding: '2px 8px', fontWeight: 600, borderRadius: '4px' }}
              >
                Latest 3 Updated Products
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', display: 'block' }}>
              Authoritative balances derived strictly from stock movement transactions
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="crm-btn-secondary compact"
              onClick={() => {
                if (onNavigate) onNavigate('products');
                navigate('/stocks/products');
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '12.5px' }}
            >
              View All Products →
            </button>
          </div>
        </div>

        <div className="settings-table-shell stocks-table-shell crm-table-workspace" style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
          <div className="crm-table-scroll-wrap stocks-table-natural-wrap crm-table-viewport">
            <table className="crm-data-table settings-table inventory-table crm-master-table" style={{ width: '100%', minWidth: '880px', tableLayout: 'fixed' }}>
              <colgroup>
                <col className="col-inv-product" style={{ width: '28%' }} />
                <col className="col-inv-unit" style={{ width: '8%' }} />
                <col className="col-inv-recently-added" style={{ width: '13%' }} />
                <col className="col-inv-total-stock" style={{ width: '11%' }} />
                <col className="col-inv-available" style={{ width: '10%' }} />
                <col className="col-inv-min-stock" style={{ width: '10%' }} />
                <col className="col-inv-status" style={{ width: '10%' }} />
                <col className="col-inv-actions" style={{ width: '10%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="col-priority-high" style={{ minWidth: '190px' }}>PRODUCT</th>
                  <th className="col-priority-med" style={{ width: '75px' }}>UNIT</th>
                  <th className="col-priority-high text-center" style={{ width: '125px' }}>RECENTLY ADDED</th>
                  <th className="col-priority-high text-right" style={{ width: '95px' }}>TOTAL STOCK</th>
                  <th className="col-priority-high text-right" style={{ width: '95px' }}>AVAILABLE</th>
                  <th className="col-priority-med text-right" style={{ width: '85px' }}>MIN STOCK</th>
                  <th className="col-priority-high text-center" style={{ width: '105px' }}>STATUS</th>
                  <th className="actions-col col-priority-high text-center" style={{ width: '95px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {latest3Products.map((p) => {
                  const total = Number(p.totalStock ?? p.stock ?? 0);
                  const reserved = Number(p.reservedStock ?? 0);
                  const available = Number(p.availableStock ?? Math.max(0, total - reserved));
                  const minStock = Number(p.minimumStock ?? p.alertQuantity ?? 0);
                  const status = p.status || getProductStockStatus(available, minStock);
                  const statusClass = status === 'IN STOCK' ? 'badge-green' : (status === 'LOW STOCK' ? 'badge-amber' : 'badge-rose');

                  return (
                    <tr key={p.id}>
                      <td className="col-priority-high cell-wrap" data-label="PRODUCT">
                        <div className="stock-table-cell-content">
                          <button
                            type="button"
                            className="table-link-button product-table-link text-truncate"
                            onClick={() => {
                              navigate(`/stocks/products/${encodeURIComponent(p.id)}/edit`);
                            }}
                            title={p.name}
                            style={{ fontWeight: 600, color: '#1e293b', textAlign: 'left', display: 'block' }}
                          >
                            <strong>{p.name}</strong>
                          </button>
                          <small className="table-secondary-text text-truncate" style={{ color: '#64748b' }}>
                            {[p.brandName, p.categoryName].filter(Boolean).join(' · ')}
                          </small>
                        </div>
                      </td>
                      <td className="col-priority-med" data-label="UNIT">
                        <div className="stock-table-cell-content">{p.unit && p.unit !== 'Piece' ? p.unit : 'Nos'}</div>
                      </td>
                      <td className="col-priority-high text-center" data-label="RECENTLY ADDED">
                        <div className="stock-table-cell-content text-center">
                          {(() => {
                            const added = Number(
                              p.recentlyAddedQty !== undefined
                                ? p.recentlyAddedQty
                                : (p.recentlyAdded !== undefined
                                    ? p.recentlyAdded
                                    : (Array.isArray(p.history) && p.history.find(h => Number(h.quantity) > 0)
                                        ? Number(p.history.find(h => Number(h.quantity) > 0).quantity)
                                        : 0))
                            );
                            return (
                              <span
                                className={`status-badge ${added > 0 ? 'badge-green' : 'badge-slate'}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: '11.5px',
                                  padding: '2px 8px',
                                  borderRadius: '12px'
                                }}
                                title={`${added} ${p.unit && p.unit !== 'Piece' ? p.unit : 'Nos'}(s) recently added in transaction`}
                              >
                                {added > 0 ? `+${added}` : '0'}
                              </span>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="col-priority-high text-right" data-label="TOTAL STOCK">
                        <div className="stock-table-cell-content text-right">
                          <strong style={{ fontSize: '13px' }}>{total}</strong>
                        </div>
                      </td>
                      <td className="col-priority-high text-right" data-label="AVAILABLE">
                        <div className="stock-table-cell-content text-right">
                          <span style={{ fontWeight: 600, color: available > 0 ? '#16a34a' : '#dc2626' }}>{available}</span>
                        </div>
                      </td>
                      <td className="col-priority-med text-right" data-label="MIN STOCK">
                        <div className="stock-table-cell-content text-right">{minStock}</div>
                      </td>
                      <td className="col-priority-high text-center" data-label="STATUS">
                        <div className="stock-table-cell-content text-center">
                          <span className={`status-badge ${statusClass}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
                            {status}
                          </span>
                        </div>
                      </td>
                      <td className="actions-col col-priority-high" data-label="ACTIONS">
                        <div className="stock-table-cell-content text-center">
                          <div className="settings-row-actions" style={{ justifyContent: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              className="settings-row-action settings-row-icon"
                              onClick={() => {
                                navigate(`/stocks/products/${encodeURIComponent(p.id)}/edit`);
                              }}
                              title="Edit Product"
                              aria-label={`Edit ${p.name}`}
                            >
                              <EyeIcon size={14} />
                            </button>
                            {canEdit && (
                              <button
                                type="button"
                                className="settings-row-action settings-row-icon"
                                onClick={() => onEditProduct(p)}
                                title="Edit Product"
                                aria-label={`Edit ${p.name}`}
                              >
                                <PencilIcon size={14} />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                className="settings-row-action danger settings-row-icon"
                                onClick={() => onDeleteProduct(p)}
                                title="Delete Product"
                                aria-label={`Delete ${p.name}`}
                              >
                                <Trash2Icon size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {latest3Products.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="table-empty-state" style={{ padding: '28px', textAlign: 'center' }}>
                        <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#334155' }}>No products available</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="stocks-table-footer crm-table-footer">
            <span className="stocks-record-count">
              Showing {latest3Products.length} {latest3Products.length === 1 ? 'product' : 'products'}
            </span>
          </div>
        </div>
      </section>

      {/* 4. Low Stock Alerts (Full Width) */}
      <section className="stocks-low-stock-workspace" aria-label="Low Stock Alerts" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #edf2f7', background: '#ffffff', flexWrap: 'wrap', gap: '8px' }}>
          <div className="stocks-panel-heading">
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              LOW STOCK ALERTS
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Products at or below configured alert threshold requiring replenishment</span>
          </div>
          <span className="status-badge badge-amber" style={{ fontSize: '11px', padding: '3px 10px', fontWeight: 700 }}>
            {lowStockProducts.length} Product{lowStockProducts.length === 1 ? '' : 's'} at Alert Level
          </span>
        </div>

        {lowStockProducts.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: '#059669', background: '#f8fafc' }}>
            <div style={{ fontSize: '24px', marginBottom: '6px' }}>✓</div>
            <strong style={{ display: 'block', fontSize: '13px' }}>All inventory levels are healthy.</strong>
            <small style={{ color: '#64748b' }}>No products are currently at or below minimum stock threshold.</small>
          </div>
        ) : (
          <div className="crm-table-scroll-wrap crm-table-viewport" style={{ width: '100%', overflowX: 'auto' }}>
            <table className="crm-data-table settings-table inventory-table low-stock-full-table crm-master-table" style={{ width: '100%', minWidth: '760px', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
              <colgroup>
                <col className="col-low-product" style={{ width: '40%' }} />
                <col className="col-low-available" style={{ width: '15%' }} />
                <col className="col-low-min-stock" style={{ width: '15%' }} />
                <col className="col-low-status" style={{ width: '15%' }} />
                <col className="col-low-actions" style={{ width: '15%' }} />
              </colgroup>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: '#475569' }}>PRODUCT</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px', width: '120px', fontSize: '11px', fontWeight: 700, color: '#475569' }}>AVAILABLE</th>
                  <th style={{ textAlign: 'right', padding: '12px 14px', width: '120px', fontSize: '11px', fontWeight: 700, color: '#475569' }}>MIN STOCK</th>
                  <th style={{ textAlign: 'center', padding: '12px 14px', width: '130px', fontSize: '11px', fontWeight: 700, color: '#475569' }}>STATUS</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px', width: '160px', fontSize: '11px', fontWeight: 700, color: '#475569' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.map((p) => {
                  const avail = Number(p.availableStock ?? p.stock ?? 0);
                  const min = Number(p.minimumStock ?? p.alertQuantity ?? 0);
                  const status = p.status || getProductStockStatus(avail, min);
                  const statusClass = status === 'IN STOCK' ? 'badge-green' : (status === 'LOW STOCK' ? 'badge-amber' : 'badge-rose');

                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <button
                          type="button"
                          className="table-link-button product-table-link text-truncate"
                          onClick={() => {
                            navigate(`/stocks/products/${encodeURIComponent(p.id)}/edit`);
                          }}
                          style={{ fontWeight: 600, color: '#0f172a', textAlign: 'left', display: 'block', fontSize: '13px' }}
                          title={p.name}
                        >
                          {p.name}
                        </button>
                        <small style={{ color: '#64748b', fontSize: '11px' }}>
                          {[p.brandName, p.categoryName].filter(Boolean).join(' · ')}
                        </small>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: '13px' }}>
                        <strong style={{ color: avail <= 0 ? '#dc2626' : '#d97706' }}>{avail}</strong>
                        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '4px' }}>{p.unit && p.unit !== 'Piece' ? p.unit : 'Nos'}</span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontSize: '13px', color: '#475569' }}>
                        {min}
                        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '4px' }}>{p.unit && p.unit !== 'Piece' ? p.unit : 'Nos'}</span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span className={`status-badge ${statusClass}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
                          {status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="crm-btn-secondary compact"
                            onClick={() => {
                              navigate(`/stocks/products/${encodeURIComponent(p.id)}/edit`);
                            }}
                            style={{ fontSize: '11.5px', padding: '3px 8px' }}
                          >
                            View
                          </button>
                          {canCreate && (
                            <button
                              type="button"
                              className="crm-btn-primary compact"
                              onClick={() => onOpenMovementModal(p.id, 'STOCK IN')}
                              style={{ fontSize: '11.5px', padding: '3px 8px' }}
                            >
                              + Add Stock
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {lowStockProducts.length > 0 && (
          <div className="stocks-table-footer crm-table-footer">
            <span className="stocks-record-count">
              Showing {lowStockProducts.length} {lowStockProducts.length === 1 ? 'low-stock product' : 'low-stock products'}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}


export function ProductInfoPage(props) {
  return <ProductHistoryView {...props} />;
}

function StockDescriptionCell({ item, type, onOpenDetail, standalone = false }) {
  const desc = (item?.description || '').trim();
  if (!desc) {
    return (
      <div className={`stock-cell-desc-wrap ${standalone ? 'is-standalone' : ''}`}>
        {standalone ? (
          <span className="brand-empty-dash" style={{ color: '#64748b', fontSize: '13px' }}>—</span>
        ) : (
          <small className="table-secondary-text muted">No description</small>
        )}
      </div>
    );
  }
  if (standalone) {
    const isVeryLong = desc.length > 180;
    return (
      <div className={`stock-cell-desc-wrap is-standalone ${isVeryLong ? 'is-long' : ''}`}>
        <span className="brand-description-text" title={desc}>
          {isVeryLong ? desc.slice(0, 160) + '…' : desc}
        </span>
        {isVeryLong && onOpenDetail && (
          <button
            type="button"
            className="stock-cell-detail-link"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail({ type, item });
            }}
            title="View complete description"
            aria-label={`View complete description for ${item.name}`}
          >
            View details
          </button>
        )}
      </div>
    );
  }
  const isLong = desc.length > 45;
  if (!isLong) {
    return (
      <div className="stock-cell-desc-wrap">
        <small className="table-secondary-text text-truncate" title={desc}>{desc}</small>
      </div>
    );
  }
  const preview = desc.slice(0, 38) + '…';
  return (
    <div className="stock-cell-desc-wrap is-long">
      <small className="table-secondary-text description-preview text-truncate" title={desc}>{preview}</small>
      <button
        type="button"
        className="stock-cell-detail-link"
        onClick={(e) => {
          e.stopPropagation();
          onOpenDetail({ type, item });
        }}
        title="View complete description"
        aria-label={`View complete description for ${item.name}`}
      >
        View details
      </button>
    </div>
  );
}

function StockItemDetailModal({ detail, onClose }) {
  if (!detail || !detail.item) return null;
  const { type, item } = detail;
  return (
    <div className="crm-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="crm-modal-card stock-item-detail-modal-card" role="dialog" aria-modal="true">
        <div className="crm-modal-header">
          <div>
            <span className="panel-kicker">{type.toUpperCase()} DETAILS</span>
            <h3>{item.name}</h3>
            {item.categoryName && <p>{item.categoryName}</p>}
          </div>
          <button className="crm-modal-close" type="button" onClick={onClose} aria-label="Close modal">×</button>
        </div>
        <div className="stock-item-detail-modal-body">
          <div className="stock-detail-field-group">
            <span className="detail-label">Name</span>
            <strong className="stock-detail-name-val">{item.name}</strong>
          </div>
          {item.code && (
            <div className="stock-detail-field-group">
              <span className="detail-label">Code</span>
              <div><span className="master-code">{item.code}</span></div>
            </div>
          )}
          {item.categoryName && (
            <div className="stock-detail-field-group">
              <span className="detail-label">Category</span>
              <span className="stock-detail-cat-val">{item.categoryName}</span>
            </div>
          )}
          <div className="stock-detail-field-group full-width">
            <span className="detail-label">Description</span>
            <div className="stock-detail-full-description">
              {item.description || 'No description provided.'}
            </div>
          </div>
        </div>
        <div className="crm-modal-footer">
          <button type="button" className="crm-btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function BrandDetails({ brand, data, onClose, onProducts }) {
  const products = data.products.filter((p) => p.brandId === brand.id);
  const categories = [...new Map(products.map((p) => [p.categoryId, p.categoryName])).entries()].filter(([id]) => id).map(([, name]) => name);
  const subcategories = [...new Set(products.map((p) => p.subcategoryName).filter((name) => name && name !== '—'))];
  return <div className="crm-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className="crm-modal-card brand-details-card-v2" role="dialog" aria-modal="true">
      <div className="crm-modal-header"><div><span className="panel-kicker">BRAND PROFILE</span><h3>{brand.name}</h3><p>{brand.description || 'Manufacturer / product brand'}</p></div><button className="crm-modal-close" type="button" onClick={onClose}>×</button></div>
      <div className="brand-profile-summary"><div><span>Products</span><strong>{products.length}</strong></div><div><span>Categories</span><strong>{categories.length}</strong></div><div><span>Subcategories</span><strong>{subcategories.length}</strong></div><div><span>Brand Code</span><strong>{brand.id}</strong></div></div>
      <div className="brand-detail-grid"><div><span className="detail-label">Categories</span><div className="tag-wrap">{categories.length ? categories.map((x) => <span className="master-tag" key={x}>{x}</span>) : <small>None yet</small>}</div></div><div><span className="detail-label">Subcategories</span><div className="tag-wrap">{subcategories.length ? subcategories.map((x) => <span className="master-tag muted" key={x}>{x}</span>) : <small>None yet</small>}</div></div></div>
      <div className="brand-products-list"><div className="analysis-section-title"><span>PRODUCTS</span></div>{products.length ? products.slice(0, 8).map((p) => <div key={p.id} className="brand-product-row"><span><strong>{p.name}</strong><small>{p.code} · {p.categoryName}{p.subcategoryName !== '—' ? ` · ${p.subcategoryName}` : ''}</small></span><span>{money(p.mrp)}</span></div>) : <div className="overview-empty"><strong>No products assigned</strong><small>Create a product and select this brand.</small></div>}</div>
      <div className="stock-analysis-footer"><button type="button" className="crm-btn-secondary" onClick={onClose}>Close</button><button type="button" className="crm-btn-primary" onClick={onProducts}>View Products →</button></div>
    </div>
  </div>;
}

function StockModal({ branch, mode, form, setForm, onClose, onSave, saving, data }) {
  const meta = BRANCHES.find((x) => x.id === branch);
  const update = (key, value) => setForm((x) => ({ ...x, [key]: value }));
  const visibleCategories = useMemo(() => (data.categories || []).filter((item) => !isTestRecord(item)), [data.categories]);
  const visibleBrands = useMemo(() => (data.brands || []).filter((brand) => !isTestRecord(brand)), [data.brands]);
  const subcategories = data.subcategories.filter((x) => !isTestRecord(x) && (!form.categoryId || x.categoryId === form.categoryId) && data.categories.some((c) => c.id === x.categoryId && !isTestRecord(c)));
  const cost = Number(form.cost || 0);
  const dealerPercentage = Number(form.dealerPercentage || 0);
  const mrpPercentage = Number(form.mrpPercentage || 0);
  const calculatedDealerPrice = cost > 0 ? Number((cost * (1 + dealerPercentage / 100)).toFixed(2)) : 0;
  const calculatedMrp = cost > 0 ? Number((cost * (1 + mrpPercentage / 100)).toFixed(2)) : 0;
  const gst = Number(form.gst || 0);
  const [codeError, setCodeError] = useState('');

  useEffect(() => {
    if (branch !== 'products' || mode === 'edit') return;
    let active = true;
    const fetchCode = async () => {
      try {
        const res = await apiFetch(apiUrl('/api/stocks/products/next-code'), { headers: { 'x-user-id': 'USR-001' } });
        const json = await res.json();
        if (json.success && json.nextCode && active) {
          setForm((prev) => (prev.code ? prev : { ...prev, code: json.nextCode }));
        }
      } catch (e) {}
    };
    fetchCode();
    return () => { active = false; };
  }, [branch, mode, setForm]);

  const handleCodeChange = (val) => {
    const clean = String(val || '').toUpperCase().trimStart();
    update('code', clean);
    if (!clean.trim()) {
      setCodeError('');
      return;
    }
    const cleanTrimmed = clean.trim();
    const cleanCompact = cleanTrimmed.replace(/[^A-Z0-9]/g, '');
    const isDup = (data.products || []).some((p) => {
      if (mode === 'edit' && String(p.id).toLowerCase() === String(form.id).toLowerCase()) return false;
      const pNorm = String(p.code || '').trim().toUpperCase();
      const pCompact = pNorm.replace(/[^A-Z0-9]/g, '');
      return pNorm === cleanTrimmed || (cleanCompact && pCompact === cleanCompact);
    });
    if (isDup) {
      setCodeError(`Product code ${cleanTrimmed} is already in use.`);
    } else {
      setCodeError('');
    }
  };

  useEffect(() => {
    if (branch !== 'products') return;
    setForm((current) => ({
      ...current,
      dealerPrice: current.dealerPercentage !== '' && cost > 0 ? String(calculatedDealerPrice) : current.dealerPrice,
      mrp: current.mrpPercentage !== '' && cost > 0 ? String(calculatedMrp) : current.mrp,
    }));
  }, [branch, cost, dealerPercentage, mrpPercentage, calculatedDealerPrice, calculatedMrp, setForm]);
  return <div className="crm-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className="crm-modal-card settings-modal-card stock-modal-card-v3" role="dialog" aria-modal="true">
      <div className="crm-modal-header"><div><h3>{mode === 'edit' ? `Edit ${meta.singular}` : `Add ${meta.singular}`}</h3><p>{meta.description}</p></div><button className="crm-modal-close" type="button" onClick={onClose}>×</button></div>
      <form onSubmit={(e) => {
        if (codeError) {
          e.preventDefault();
          return;
        }
        onSave(e);
      }} className="settings-modal-form stock-form-v3">
        {(branch === 'categories' || branch === 'brands') && <><div className="stock-form-section"><div className="stock-form-section-title">BASIC INFORMATION</div></div><Field label={meta.singular + ' Name'} value={form.name} onChange={(v) => update('name', v)} required /><Field label="Description" value={form.description} onChange={(v) => update('description', v)} /></>}
        {branch === 'subcategories' && <><div className="stock-form-section"><div className="stock-form-section-title">SUBCATEGORY SETUP</div></div><Select label="Category" value={form.categoryId} onChange={(v) => update('categoryId', v)} options={visibleCategories} placeholder="Select category" required /><Field label="Subcategory Name" value={form.name} onChange={(v) => update('name', v)} required /><Field label="Description" value={form.description} onChange={(v) => update('description', v)} /></>}
        {branch === 'products' && <>
          <div className="stock-form-section"><div className="stock-form-section-title">1. BASIC INFORMATION</div></div>
          <div className="form-grid-2">
            <Field
              label="Product Code"
              value={form.code}
              onChange={handleCodeChange}
              required
              disabled={mode === 'edit'}
              error={codeError}
              helper={mode === 'edit' ? "Permanent product identifier (immutable)" : (codeError ? undefined : "Unique product identifier (e.g. ASI-01)")}
            />
            <Field label="Product Name" value={form.name} onChange={(v) => update('name', v)} required disabled={mode === 'edit'} />
          </div>
          <div className="form-grid-2">
            <Field label="HSN / SAC Code" value={form.hsnSac} onChange={(v) => update('hsnSac', v.replace(/[^A-Za-z0-9]/g, '').slice(0, 8))} required maxLength={8} helper="Maximum 8 characters" disabled={mode === 'edit'} />
            <Field label="Product Description" value={form.description} onChange={(v) => update('description', v)} disabled={mode === 'edit'} />
          </div>
          <div className="stock-form-section"><div className="stock-form-section-title">2. CLASSIFICATION</div></div>
          <div className="form-grid-2">
            <Select label="Category" value={form.categoryId} onChange={(v) => { update('categoryId', v); update('subcategoryId', ''); }} options={visibleCategories} placeholder="Select category" required disabled={mode === 'edit'} />
            <Select label="Subcategory" value={form.subcategoryId} onChange={(v) => update('subcategoryId', v)} options={subcategories} placeholder="Select subcategory" required disabled={mode === 'edit'} />
          </div>
          <div className="form-grid-2">
            <Select label="Brand" value={form.brandId} onChange={(v) => update('brandId', v)} options={visibleBrands} placeholder="No brand / select brand" disabled={mode === 'edit'} />
            <Select label="Product Unit" value={['Nos', 'Box', 'Set', 'Meter', 'Roll'].includes(form.unit) ? form.unit : 'Nos'} onChange={(v) => update('unit', v)} options={[{ id: 'Nos', name: 'Nos' }, { id: 'Box', name: 'Box' }, { id: 'Set', name: 'Set' }, { id: 'Meter', name: 'Meter' }, { id: 'Roll', name: 'Roll' }]} required disabled={mode === 'edit'} />
          </div>
          <div className="stock-form-section"><div className="stock-form-section-title">3. PRICING</div></div><div className="form-grid-2"><Field label="Purchase Cost" type="number" min="0" value={form.cost} onChange={(v) => update('cost', v)} required /><Field label="Dealer Markup %" type="number" min="0" max="1000" value={form.dealerPercentage} onChange={(v) => update('dealerPercentage', v)} required helper="Price calculated from cost" /></div><div className="form-grid-2"><Field label="Dealer Price" type="number" min="0" value={form.dealerPrice} onChange={(v) => update('dealerPrice', v)} required helper="Calculated or manual" /><Field label="MRP Markup %" type="number" min="0" max="1000" value={form.mrpPercentage} onChange={(v) => update('mrpPercentage', v)} required helper="Price calculated from cost" /></div><div className="form-grid-2"><Field label="MRP" type="number" min="0" value={form.mrp} onChange={(v) => update('mrp', v)} required helper="Calculated or manual" /><Field label="GST %" type="number" min="0" max="100" value={form.gst} onChange={(v) => update('gst', v)} helper="Base GST rate" /></div><div className="form-grid-2 tax-preview-grid"><Field label="IGST %" value={gst} onChange={() => {}} disabled helper="Inter-state" /><Field label="CGST %" value={(gst / 2).toFixed(2)} onChange={() => {}} disabled helper="Intra-state" /><Field label="SGST %" value={(gst / 2).toFixed(2)} onChange={() => {}} disabled helper="Intra-state" /><div /></div>
          <div style={{ margin: '8px 0 12px 0' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--text-color, #1e293b)' }}>
              <input
                type="checkbox"
                checked={Boolean(form.isIGSTApplicable)}
                onChange={(e) => update('isIGSTApplicable', e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563eb' }}
              />
              IGST Applicable (Inter-state transactions)
            </label>
          </div>
          <div className="stock-form-section"><div className="stock-form-section-title">4. STOCK CONTROL</div></div>
          <div className="form-grid-2">
            <Field
              label={mode === 'edit' ? "Current On-Hand Stock (Units)" : "Opening Stock (Units)"}
              type="number"
              min="0"
              value={form.stock}
              onChange={(v) => update('stock', v)}
              helper={mode === 'edit' ? "Current physical stock. Manual edits will record an audit adjustment movement." : "Initial inventory count added to stock upon product creation."}
              disabled={false}
            />
            <Field
              label="Alert / Minimum Stock Quantity"
              type="number"
              min="0"
              value={form.alertQuantity}
              onChange={(v) => update('alertQuantity', v)}
              helper="Triggers Low Stock warning when available stock falls to or below this level."
              disabled={false}
            />
          </div>
          <div style={{ margin: '8px 0 16px 0', opacity: mode === 'edit' ? 0.75 : 1 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: mode === 'edit' ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600, color: 'var(--text-color, #1e293b)' }}>
              <input
                type="checkbox"
                checked={form.serialized !== false}
                onChange={(e) => !mode === 'edit' && update('serialized', e.target.checked)}
                disabled={mode === 'edit'}
                style={{ width: '16px', height: '16px', cursor: mode === 'edit' ? 'not-allowed' : 'pointer', accentColor: '#2563eb' }}
              />
              Serialized Inventory Tracking (Requires unique serial numbers per unit)
            </label>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', marginLeft: '24px' }}>
              {form.serialized !== false
                ? 'Individual units are tracked by serial number for goods receipt, DC dispatch, and returns.'
                : 'Standard quantity-based inventory. No serial numbers will be required or recorded.'}
            </div>
          </div>
          <div className="stock-form-section"><div className="stock-form-section-title">5. QUOTATION INFORMATION</div></div><Field label="Product Details for Quotation" value={form.productDetails} onChange={(v) => update('productDetails', v)} disabled={mode === 'edit'} /><Field label="Product Link" value={form.productLink} onChange={(v) => update('productLink', v)} disabled={mode === 'edit'} />
        </>}
        <div className="settings-modal-actions"><button type="button" className="crm-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="crm-btn-primary" disabled={saving || Boolean(codeError)}>{saving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : `Create ${meta.singular}`}</button></div>
      </form>
    </div>
  </div>;
}

function Field({ label, value, onChange, required = false, type = 'text', min, max, maxLength, disabled = false, helper = '', error = '' }) {
  return (
    <div className="form-field-group">
      <label className="field-label">{label}{required && <span className="req-star"> *</span>}</label>
      <input
        className="crm-text-input"
        type={type}
        min={min}
        max={max}
        maxLength={maxLength}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        style={{
          ...(error ? { borderColor: '#ef4444' } : {}),
          ...(disabled ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' } : {})
        }}
      />
      {error ? (
        <small className="field-error" style={{ color: '#ef4444', fontWeight: 600, display: 'block', marginTop: '4px' }}>
          {error}
        </small>
      ) : (
        helper && <small className="field-helper">{helper}</small>
      )}
    </div>
  );
}
function Select({ label, value, onChange, options, placeholder, required = false, disabled = false }) {
  return (
    <div className="form-field-group">
      <label className="field-label">{label}{required && <span className="req-star"> *</span>}</label>
      <select
        className="crm-select-input"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        style={disabled ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' } : undefined}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option value={o.id} key={o.id}>{o.name}</option>)}
      </select>
    </div>
  );
}
function Info({ label, value }) { return <div className="analysis-info-item"><span>{label}</span><strong title={value || ''}>{value || '—'}</strong></div>; }
function Metric({ label, value, emphasis = false }) { return <div className={`analysis-metric ${emphasis ? 'emphasis' : ''}`}><span>{label}</span><strong>{value}</strong></div>; }

export { default as ProductPriceHistoryPage } from './ProductPriceHistoryPage';
export { default as ProductHistoryView, getProductStockStatus } from './ProductHistoryView';