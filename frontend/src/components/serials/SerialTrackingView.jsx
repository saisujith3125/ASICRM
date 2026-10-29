import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Barcode,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  Truck,
  Package,
  DollarSign,
  TrendingUp,
  Tag,
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  Layers,
  Calendar,
  X,
  ShieldCheck,
  Info
} from 'lucide-react';
import { apiFetch, apiUrl } from '../../api';
import { navigate } from '../../router';
import './serialTracking.css';

function authHeaders(user) {
  let activeId = user?.id || '';
  if (!activeId) {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('asicrm_user') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        activeId = parsed?.id || '';
      }
    } catch {}
  }
  return {
    'Content-Type': 'application/json',
    'x-user-id': activeId || 'USR-001'
  };
}

function formatCurrency(val) {
  const num = Number(val || 0);
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function SerialTrackingView({ user, initialQuery = '', initialStatus = 'ALL' }) {
  const [serials, setSerials] = useState([]);
  const [kpis, setKpis] = useState({
    totalSerials: 0,
    inStockCount: 0,
    billedCount: 0,
    unbilledDcCount: 0,
    totalValuation: 0,
    totalBilledRevenue: 0,
    totalGrossProfit: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState(initialQuery || '');
  const [statusFilter, setStatusFilter] = useState(initialStatus || 'ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Selected Serial for Detailed Modal Inspection
  const [selectedSerial, setSelectedSerial] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  // Copy notification state
  const [copiedSn, setCopiedSn] = useState('');

  const searchInputRef = useRef(null);

  // Fetch all serial lifecycles
  const fetchSerials = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter);

      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch(apiUrl(`/api/serials${qs}`), {
        headers: authHeaders(user)
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setSerials(json.data || []);
        if (json.kpis) setKpis(json.kpis);
      } else {
        setError(json?.message || 'Failed to fetch serial tracking records.');
      }
    } catch (err) {
      setError(err.message || 'Network error fetching serial tracking data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSerials();
  }, [statusFilter]);

  // Handle Enter on search input
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setCurrentPage(1);
    fetchSerials();
  };

  // Inspect a specific serial number modal
  const handleInspectSerial = async (serialNumber) => {
    if (!serialNumber) return;
    setDetailLoading(true);
    setDetailError('');
    setSelectedSerial(null);

    try {
      const res = await apiFetch(apiUrl(`/api/serials/${encodeURIComponent(serialNumber)}`), {
        headers: authHeaders(user)
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setSelectedSerial(json.data);
      } else {
        setDetailError(json?.message || `Serial ${serialNumber} details not found.`);
      }
    } catch (err) {
      setDetailError(err.message || 'Error fetching serial provenance details.');
    } finally {
      setDetailLoading(false);
    }
  };

  // If initialQuery is provided on mount, auto-search and auto-inspect if exact match
  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      handleInspectSerial(initialQuery.trim());
    }
  }, [initialQuery]);

  // Copy to clipboard helper
  const handleCopy = (sn, e) => {
    if (e) e.stopPropagation();
    navigator.clipboard?.writeText(sn);
    setCopiedSn(sn);
    setTimeout(() => setCopiedSn(''), 2000);
  };

  // Quick preset button click
  const handleSampleClick = (sn) => {
    setSearchQuery(sn);
    handleInspectSerial(sn);
  };

  // Client-side pagination
  const paginatedSerials = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return serials.slice(startIndex, startIndex + pageSize);
  }, [serials, currentPage, pageSize]);

  const totalPages = Math.ceil(serials.length / pageSize) || 1;

  return (
    <div className="serial-tracking-container">
      {/* 1. TOP HEADER & BREADCRUMB */}
      <div className="serial-header-wrapper">
        <div className="serial-header-info">
          <div className="serial-header-badge">
            <Barcode size={16} />
            <span>Hardware Serialization &amp; Provenance Engine</span>
          </div>
          <h1 className="serial-page-title">Serial Number Lifecycle &amp; Profit Tracking</h1>
          <p className="serial-page-subtitle">
            Unit-level hardware audit: trace every unit from Inward Purchase Order &amp; Supplier Cost,
            through Warehouse Stock Vault, to Outward Delivery Challan, Sales Invoice, and exact Unit Margin.
          </p>
        </div>
        <div className="serial-header-actions">
          <button
            type="button"
            className="serial-action-btn secondary"
            onClick={fetchSerials}
            title="Refresh latest serial records"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            className="serial-action-btn primary"
            onClick={() => searchInputRef.current?.focus()}
          >
            <Barcode size={16} />
            Scan / Search Serial
          </button>
        </div>
      </div>

      {/* 2. KPI METRICS CARDS */}
      <div className="serial-kpi-grid">
        {/* KPI 1: Total Units */}
        <div className="serial-kpi-card total">
          <div className="kpi-icon-wrap total">
            <Tag size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Total Serials Tracked</span>
            <span className="kpi-value">{(kpis.totalSerials || 0).toLocaleString()}</span>
            <span className="kpi-subtext">Active Serialized Vault</span>
          </div>
        </div>

        {/* KPI 2: In Warehouse Stock */}
        <div className="serial-kpi-card stock">
          <div className="kpi-icon-wrap stock">
            <Package size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">In Warehouse Stock</span>
            <span className="kpi-value">{(kpis.inStockCount || 0).toLocaleString()}</span>
            <span className="kpi-subtext">Available for Dispatch</span>
          </div>
        </div>

        {/* KPI 3: Dispatched Unbilled DC */}
        <div className="serial-kpi-card unbilled">
          <div className="kpi-icon-wrap unbilled">
            <Truck size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Dispatched Under DC</span>
            <span className="kpi-value">{(kpis.unbilledDcCount || 0).toLocaleString()}</span>
            <span className="kpi-subtext">Pending Sales Invoice</span>
          </div>
        </div>

        {/* KPI 4: Invoiced & Billed */}
        <div className="serial-kpi-card billed">
          <div className="kpi-icon-wrap billed">
            <CheckCircle2 size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Billed &amp; Realized</span>
            <span className="kpi-value">{(kpis.billedCount || 0).toLocaleString()}</span>
            <span className="kpi-subtext">Invoice Settled</span>
          </div>
        </div>

        {/* KPI 5: Serialized Valuation */}
        <div className="serial-kpi-card valuation">
          <div className="kpi-icon-wrap valuation">
            <DollarSign size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Stock Vault Valuation</span>
            <span className="kpi-value">{formatCurrency(kpis.totalValuation)}</span>
            <span className="kpi-subtext">Inward Cost Value</span>
          </div>
        </div>
      </div>

      {/* 3. TOOLBAR & QUICK FILTER PILLS */}
      <div className="serial-toolbar-card">
        <form className="serial-search-form" onSubmit={handleSearchSubmit}>
          <div className="serial-search-input-wrap">
            <Search size={18} className="serial-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="serial-search-input"
              placeholder="Search serial number, PO #, DC #, Invoice #, Supplier, Customer, or Product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="serial-search-clear"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                  setTimeout(() => fetchSerials(), 0);
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button type="submit" className="serial-search-btn" disabled={loading}>
            <Search size={15} />
            Search
          </button>
        </form>

        {/* Status Filter Buttons */}
        <div className="serial-filters-row">
          <div className="serial-filter-tabs">
            <button
              type="button"
              className={`serial-tab-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter('ALL');
                setCurrentPage(1);
              }}
            >
              All Units ({(kpis.totalSerials || 0).toLocaleString()})
            </button>
            <button
              type="button"
              className={`serial-tab-pill stock ${statusFilter === 'IN_STOCK' ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter('IN_STOCK');
                setCurrentPage(1);
              }}
            >
              <span className="status-dot stock" /> In Warehouse ({(kpis.inStockCount || 0).toLocaleString()})
            </button>
            <button
              type="button"
              className={`serial-tab-pill unbilled ${statusFilter === 'DISPATCHED_UNBILLED' ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter('DISPATCHED_UNBILLED');
                setCurrentPage(1);
              }}
            >
              <span className="status-dot unbilled" /> Dispatched Unbilled ({(kpis.unbilledDcCount || 0).toLocaleString()})
            </button>
            <button
              type="button"
              className={`serial-tab-pill billed ${statusFilter === 'BILLED_ACTIVE' ? 'active' : ''}`}
              onClick={() => {
                setStatusFilter('BILLED_ACTIVE');
                setCurrentPage(1);
              }}
            >
              <span className="status-dot billed" /> Billed &amp; Active ({(kpis.billedCount || 0).toLocaleString()})
            </button>
          </div>

          {/* Quick Samples */}
          <div className="serial-samples-wrap">
            <span className="serial-samples-label">Quick Trace:</span>
            <button
              type="button"
              className="serial-sample-pill"
              onClick={() => handleSampleClick('CAM-IPC-001-SN-1001')}
              title="Trace Billed Camera: dahua bullet camera"
            >
              <Tag size={12} /> CAM-IPC-001-SN-1001 (Billed Sale)
            </button>
            <button
              type="button"
              className="serial-sample-pill"
              onClick={() => handleSampleClick('DH-CAM-EXP-06M')}
              title="Trace Unbilled DC: dispatched camera"
            >
              <Truck size={12} /> DH-CAM-EXP-06M (Unbilled DC)
            </button>
            <button
              type="button"
              className="serial-sample-pill"
              onClick={() => handleSampleClick('CAM-IPC-001-SN-1004')}
              title="Trace In-Stock Camera: in warehouse vault"
            >
              <Package size={12} /> CAM-IPC-001-SN-1004 (In Stock)
            </button>
          </div>
        </div>
      </div>

      {/* ERROR ALERT */}
      {error && (
        <div className="serial-alert-banner error">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" className="serial-alert-retry" onClick={fetchSerials}>
            Retry
          </button>
        </div>
      )}

      {/* 4. MASTER SERIAL DIRECTORY TABLE */}
      <div className="serial-table-card">
        <div className="serial-table-meta-bar">
          <div className="serial-table-count">
            Showing <strong>{serials.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong>{Math.min(currentPage * pageSize, serials.length)}</strong> of{' '}
            <strong>{serials.length.toLocaleString()}</strong> serial units
          </div>
          {totalPages > 1 && (
            <div className="serial-pagination-controls">
              <button
                type="button"
                className="serial-page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              >
                Previous
              </button>
              <span className="serial-page-indicator">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className="serial-page-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="serial-table-scroll-container">
          <table className="serial-master-table">
            <thead>
              <tr>
                <th style={{ width: '45px', textAlign: 'center' }}>#</th>
                <th style={{ width: '185px' }}>Serial Number</th>
                <th style={{ width: '220px' }}>Product / SKU</th>
                <th style={{ width: '150px' }}>Lifecycle Status</th>
                <th style={{ width: '200px' }}>Inward PO &amp; Supplier</th>
                <th style={{ width: '115px', textAlign: 'right' }}>Inward Cost</th>
                <th style={{ width: '200px' }}>Outward DC &amp; Customer</th>
                <th style={{ width: '140px' }}>Invoice Ref</th>
                <th style={{ width: '115px', textAlign: 'right' }}>Selling Price</th>
                <th style={{ width: '145px', textAlign: 'right' }}>Unit Gross Profit</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="serial-table-empty">
                    <RefreshCw size={24} className="spin" style={{ color: '#2563eb', margin: '0 auto 8px auto', display: 'block' }} />
                    Loading serialized hardware records...
                  </td>
                </tr>
              ) : serials.length === 0 ? (
                <tr>
                  <td colSpan={11} className="serial-table-empty">
                    <Barcode size={32} style={{ color: '#94a3b8', margin: '0 auto 8px auto', display: 'block' }} />
                    <strong>No serial numbers found matching your query.</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                      Try adjusting your search terms or clearing status filters.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedSerials.map((item, index) => {
                  const globalIdx = (currentPage - 1) * pageSize + index + 1;
                  const isStock = item.status === 'IN_STOCK';
                  const isUnbilled = item.status === 'DISPATCHED_UNBILLED';
                  const isBilled = item.status === 'BILLED_ACTIVE';
                  const hasProfit = item.financials && item.financials.unitGrossProfit > 0;

                  return (
                    <tr
                      key={item.serialNumber || index}
                      className="serial-table-row"
                      onClick={() => handleInspectSerial(item.serialNumber)}
                    >
                      {/* 1. Index */}
                      <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                        {globalIdx}
                      </td>

                      {/* 2. Serial Number with copy */}
                      <td>
                        <div className="serial-sn-cell">
                          <span className="serial-sn-badge mono" title={item.serialNumber}>
                            {item.serialNumber}
                          </span>
                          <button
                            type="button"
                            className="serial-sn-copy-btn"
                            title="Copy Serial Number"
                            onClick={(e) => handleCopy(item.serialNumber, e)}
                          >
                            {copiedSn === item.serialNumber ? (
                              <Check size={13} style={{ color: '#16a34a' }} />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* 3. Product & SKU */}
                      <td>
                        <div className="serial-product-cell">
                          <strong className="serial-product-name">{item.product?.name || 'Hardware Unit'}</strong>
                          <span className="serial-product-code mono">
                            {item.product?.code || 'SKU'}
                            {item.product?.hsnSac ? ` • HSN: ${item.product.hsnSac}` : ''}
                          </span>
                        </div>
                      </td>

                      {/* 4. Status Badge */}
                      <td>
                        <span className={`serial-status-badge ${isStock ? 'stock' : (isUnbilled ? 'unbilled' : 'billed')}`}>
                          <span className="status-dot" />
                          {item.statusLabel || item.status}
                        </span>
                      </td>

                      {/* 5. Inward PO & Supplier */}
                      <td>
                        <div className="serial-inward-cell">
                          <div className="serial-po-ref-line">
                            <span
                              className="serial-link-text po"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate('/purchase-orders/history');
                              }}
                              title="View Purchase Order History"
                            >
                              {item.inward?.poNumber || 'PO Not Stamped'}
                            </span>
                            {item.inward?.grnReference && (
                              <span className="serial-grn-tag">({item.inward.grnReference})</span>
                            )}
                          </div>
                          <span className="serial-supplier-name" title={item.inward?.supplierName}>
                            {item.inward?.supplierName || '—'}
                          </span>
                          <span className="serial-date-text">
                            Rec: {formatDate(item.inward?.receivedDate)}
                          </span>
                        </div>
                      </td>

                      {/* 6. Inward Cost */}
                      <td style={{ textAlign: 'right' }}>
                        <span className="serial-cost-val mono">
                          {formatCurrency(item.inward?.inwardCostPrice)}
                        </span>
                      </td>

                      {/* 7. Outward DC & Customer */}
                      <td>
                        {item.outward ? (
                          <div className="serial-outward-cell">
                            <span
                              className="serial-link-text dc"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate('/delivery-challans/history');
                              }}
                              title="View Delivery Challan History"
                            >
                              {item.outward.dcNumber || 'DC Linked'}
                            </span>
                            <span className="serial-customer-name" title={item.outward.customerName}>
                              {item.outward.customerName || '—'}
                            </span>
                            <span className="serial-date-text">
                              Disp: {formatDate(item.outward.dispatchDate)}
                            </span>
                          </div>
                        ) : (
                          <span className="serial-muted-dash">—</span>
                        )}
                      </td>

                      {/* 8. Invoice Ref */}
                      <td>
                        {item.outward?.invoiceNumber ? (
                          <span
                            className="serial-link-text invoice"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate('/orders/invoices');
                            }}
                            title="View Sales Invoices"
                          >
                            {item.outward.invoiceNumber}
                          </span>
                        ) : item.outward ? (
                          <span className="serial-pending-invoice-badge">
                            ⚡ Pending Inv
                          </span>
                        ) : (
                          <span className="serial-muted-dash">—</span>
                        )}
                      </td>

                      {/* 9. Selling Price */}
                      <td style={{ textAlign: 'right' }}>
                        {item.outward?.sellingPrice ? (
                          <span className="serial-sale-val mono">
                            {formatCurrency(item.outward.sellingPrice)}
                          </span>
                        ) : (
                          <span className="serial-muted-dash">—</span>
                        )}
                      </td>

                      {/* 10. Unit Gross Profit */}
                      <td style={{ textAlign: 'right' }}>
                        {item.financials?.unitGrossProfit ? (
                          <div className="serial-profit-cell">
                            <span className={`serial-profit-val mono ${hasProfit ? 'positive' : 'negative'}`}>
                              {formatCurrency(item.financials.unitGrossProfit)}
                            </span>
                            {item.financials.markupPercent > 0 && (
                              <span className="serial-markup-pill">
                                +{item.financials.markupPercent}%
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="serial-muted-dash">—</span>
                        )}
                      </td>

                      {/* 11. Actions */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="serial-inspect-btn"
                          title="View Complete Serial Provenance & Movement Audit"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectSerial(item.serialNumber);
                          }}
                        >
                          <Eye size={14} />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination */}
        {totalPages > 1 && (
          <div className="serial-table-footer-pagination">
            <span className="serial-page-indicator">
              Page {currentPage} of {totalPages} ({serials.length} total units)
            </span>
            <div className="serial-pagination-buttons">
              <button
                type="button"
                className="serial-page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
              >
                First
              </button>
              <button
                type="button"
                className="serial-page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="serial-page-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              >
                Next
              </button>
              <button
                type="button"
                className="serial-page-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. SERIAL PROVENANCE INSPECTION MODAL */}
      {(selectedSerial || detailLoading || detailError) && (
        <div className="serial-modal-overlay" onClick={() => setSelectedSerial(null)}>
          <div className="serial-modal-container" onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <div className="serial-modal-loading">
                <RefreshCw size={28} className="spin" style={{ color: '#2563eb' }} />
                <span>Auditing hardware serial lifecycle &amp; transactions...</span>
              </div>
            ) : detailError ? (
              <div className="serial-modal-error">
                <AlertTriangle size={32} style={{ color: '#dc2626', marginBottom: '12px' }} />
                <h3>Serial Audit Error</h3>
                <p>{detailError}</p>
                <button
                  type="button"
                  className="serial-action-btn secondary"
                  style={{ marginTop: '16px' }}
                  onClick={() => setSelectedSerial(null)}
                >
                  Close
                </button>
              </div>
            ) : selectedSerial ? (
              <>
                {/* Modal Header */}
                <div className="serial-modal-header">
                  <div className="serial-modal-title-wrap">
                    <div className="serial-modal-badge">
                      <Barcode size={16} />
                      <span>HARDWARE PROVENANCE AUDIT</span>
                    </div>
                    <div className="serial-modal-sn-row">
                      <h2 className="serial-modal-sn mono">{selectedSerial.serialNumber}</h2>
                      <button
                        type="button"
                        className="serial-modal-copy-btn"
                        onClick={(e) => handleCopy(selectedSerial.serialNumber, e)}
                        title="Copy Serial Number"
                      >
                        {copiedSn === selectedSerial.serialNumber ? (
                          <>
                            <Check size={14} style={{ color: '#16a34a' }} />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="serial-modal-header-right">
                    <span
                      className={`serial-status-badge large ${
                        selectedSerial.status === 'IN_STOCK'
                          ? 'stock'
                          : selectedSerial.status === 'DISPATCHED_UNBILLED'
                          ? 'unbilled'
                          : 'billed'
                      }`}
                    >
                      <span className="status-dot" />
                      {selectedSerial.statusLabel}
                    </span>
                    <button
                      type="button"
                      className="serial-modal-close-btn"
                      onClick={() => setSelectedSerial(null)}
                      title="Close Audit Modal"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Modal Body */}
                <div className="serial-modal-body">
                  {/* Product Identity Strip */}
                  <div className="serial-modal-prod-strip">
                    <div className="prod-strip-main">
                      <span className="prod-strip-label">Serialized Hardware Model</span>
                      <h3 className="prod-strip-title">{selectedSerial.product?.name}</h3>
                      <div className="prod-strip-tags">
                        <span className="prod-tag mono">SKU: {selectedSerial.product?.code}</span>
                        {selectedSerial.product?.hsnSac && (
                          <span className="prod-tag mono">HSN/SAC: {selectedSerial.product?.hsnSac}</span>
                        )}
                        <span className="prod-tag">Serialization: Strict Unique Key</span>
                      </div>
                    </div>
                  </div>

                  {/* 4-Stage Visual Lifecycle Stepper */}
                  <div className="serial-stepper-card">
                    <h4 className="serial-section-subheading">
                      <Layers size={15} /> 4-Stage Lifecycle Stepper
                    </h4>
                    <div className="serial-stepper-track">
                      {/* Step 1: PO Inward */}
                      <div className="serial-step-node completed">
                        <div className="step-icon">
                          <ArrowDownRight size={16} />
                        </div>
                        <div className="step-content">
                          <span className="step-title">1. PO Inward</span>
                          <span className="step-desc">
                            {selectedSerial.inward?.poNumber || 'PO Recorded'}
                          </span>
                          <span className="step-date">
                            {formatDate(selectedSerial.inward?.receivedDate)}
                          </span>
                        </div>
                      </div>

                      <div className="serial-step-connector completed" />

                      {/* Step 2: Warehouse Vault */}
                      <div className="serial-step-node completed">
                        <div className="step-icon">
                          <Package size={16} />
                        </div>
                        <div className="step-content">
                          <span className="step-title">2. Stock Vault</span>
                          <span className="step-desc">Active Warehouse</span>
                          <span className="step-date">
                            {selectedSerial.outward ? 'Allocated & Moved' : 'Present in Stock'}
                          </span>
                        </div>
                      </div>

                      <div className={`serial-step-connector ${selectedSerial.outward ? 'completed' : 'pending'}`} />

                      {/* Step 3: DC Dispatch */}
                      <div className={`serial-step-node ${selectedSerial.outward ? 'completed' : 'pending'}`}>
                        <div className="step-icon">
                          <Truck size={16} />
                        </div>
                        <div className="step-content">
                          <span className="step-title">3. DC Dispatch</span>
                          <span className="step-desc">
                            {selectedSerial.outward ? selectedSerial.outward.dcNumber : 'Awaiting Dispatch'}
                          </span>
                          <span className="step-date">
                            {selectedSerial.outward ? formatDate(selectedSerial.outward.dispatchDate) : 'Not Yet Dispatched'}
                          </span>
                        </div>
                      </div>

                      <div className={`serial-step-connector ${selectedSerial.outward?.isBilled ? 'completed' : 'pending'}`} />

                      {/* Step 4: Sales Invoice */}
                      <div className={`serial-step-node ${selectedSerial.outward?.isBilled ? 'completed' : 'pending'}`}>
                        <div className="step-icon">
                          <CheckCircle2 size={16} />
                        </div>
                        <div className="step-content">
                          <span className="step-title">4. Invoice Settled</span>
                          <span className="step-desc">
                            {selectedSerial.outward?.invoiceNumber || (selectedSerial.outward ? 'Unbilled Under DC' : 'Unbilled')}
                          </span>
                          <span className="step-date">
                            {selectedSerial.outward?.isBilled ? 'Revenue Realized' : 'Pending Realization'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Two-Column Deep Audit Cards */}
                  <div className="serial-two-col-grid">
                    {/* LEFT COLUMN: INWARD PROCUREMENT */}
                    <div className="serial-audit-card inward">
                      <div className="audit-card-header inward">
                        <ArrowDownRight size={16} />
                        <h4>📥 Inward Procurement Details (PO &amp; GRN)</h4>
                      </div>
                      <div className="audit-card-body">
                        <div className="audit-kv-row">
                          <span className="kv-label">Purchase Order Ref</span>
                          <span
                            className="kv-value link"
                            onClick={() => navigate('/purchase-orders/history')}
                            title="Navigate to Purchase Orders"
                          >
                            {selectedSerial.inward?.poNumber || 'PO Reference Not Linked'}
                            <ExternalLink size={12} style={{ marginLeft: '4px' }} />
                          </span>
                        </div>
                        <div className="audit-kv-row">
                          <span className="kv-label">Goods Receipt (GRN)</span>
                          <span className="kv-value mono">{selectedSerial.inward?.grnReference || 'Standard GRN'}</span>
                        </div>
                        <div className="audit-kv-row">
                          <span className="kv-label">Supplier Partner</span>
                          <span className="kv-value bold">{selectedSerial.inward?.supplierName || '—'}</span>
                        </div>
                        <div className="audit-kv-row">
                          <span className="kv-label">Inward Receipt Date</span>
                          <span className="kv-value">{formatDate(selectedSerial.inward?.receivedDate)}</span>
                        </div>
                        <div className="audit-kv-row">
                          <span className="kv-label">Inward Unit Cost</span>
                          <span className="kv-value cost mono">
                            {formatCurrency(selectedSerial.inward?.inwardCostPrice)}
                          </span>
                        </div>
                        <div className="audit-kv-row">
                          <span className="kv-label">Supplier Warranty Expiry</span>
                          <span className="kv-value">
                            <ShieldCheck size={14} style={{ color: '#16a34a', verticalAlign: 'middle', marginRight: '4px' }} />
                            {selectedSerial.inward?.supplierWarrantyExpiry || 'Standard 24 Months'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: OUTWARD DISPATCH & BILLING */}
                    <div className="serial-audit-card outward">
                      <div className="audit-card-header outward">
                        <ArrowUpRight size={16} />
                        <h4>📤 Outward Dispatch &amp; Billing (DC &amp; Invoice)</h4>
                      </div>
                      <div className="audit-card-body">
                        {selectedSerial.outward ? (
                          <>
                            <div className="audit-kv-row">
                              <span className="kv-label">Customer Client</span>
                              <span className="kv-value bold">{selectedSerial.outward.customerName}</span>
                            </div>
                            <div className="audit-kv-row">
                              <span className="kv-label">Delivery Challan Ref</span>
                              <span
                                className="kv-value link"
                                onClick={() => navigate('/delivery-challans/history')}
                                title="Navigate to Delivery Challans"
                              >
                                {selectedSerial.outward.dcNumber}
                                <ExternalLink size={12} style={{ marginLeft: '4px' }} />
                              </span>
                            </div>
                            <div className="audit-kv-row">
                              <span className="kv-label">Dispatch Date</span>
                              <span className="kv-value">{formatDate(selectedSerial.outward.dispatchDate)}</span>
                            </div>
                            <div className="audit-kv-row">
                              <span className="kv-label">Sales Invoice</span>
                              {selectedSerial.outward.invoiceNumber ? (
                                <span
                                  className="kv-value link invoice"
                                  onClick={() => navigate('/orders/invoices')}
                                  title="Navigate to Invoices"
                                >
                                  {selectedSerial.outward.invoiceNumber}
                                  <ExternalLink size={12} style={{ marginLeft: '4px' }} />
                                </span>
                              ) : (
                                <span className="serial-pending-invoice-badge">
                                  ⚡ Pending Sales Invoice
                                </span>
                              )}
                            </div>
                            <div className="audit-kv-row">
                              <span className="kv-label">Unit Selling Price</span>
                              <span className="kv-value sale mono">
                                {formatCurrency(selectedSerial.outward.sellingPrice)}
                              </span>
                            </div>
                            <div className="audit-kv-row">
                              <span className="kv-label">Billing Status</span>
                              <span className="kv-value">
                                {selectedSerial.outward.isBilled ? (
                                  <span style={{ color: '#16a34a', fontWeight: 700 }}>
                                    ✓ Billed &amp; Revenue Realized
                                  </span>
                                ) : (
                                  <span style={{ color: '#b45309', fontWeight: 700 }}>
                                    ⚡ Unbilled Goods under Challan
                                  </span>
                                )}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="audit-empty-stock-notice">
                            <Package size={36} style={{ color: '#94a3b8', margin: '0 auto 8px auto', display: 'block' }} />
                            <h5>Currently Stored in Warehouse Stock</h5>
                            <p>
                              This unit is safely logged in your active warehouse vault. It has not yet been allocated
                              to an outward Delivery Challan or billed on a Sales Invoice.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* UNIT PROFITABILITY BANNER (If dispatched/sold) */}
                  {selectedSerial.financials && selectedSerial.outward && (
                    <div className="serial-profit-summary-banner">
                      <div className="profit-banner-title">
                        <TrendingUp size={18} />
                        <span>Unit Profitability &amp; Financial Return</span>
                      </div>
                      <div className="profit-stats-grid">
                        <div className="profit-stat-item">
                          <span className="profit-stat-label">Inward Unit Cost</span>
                          <strong className="profit-stat-val cost mono">
                            {formatCurrency(selectedSerial.financials.inwardCost)}
                          </strong>
                        </div>
                        <div className="profit-stat-item">
                          <span className="profit-stat-label">Outward Selling Price</span>
                          <strong className="profit-stat-val sale mono">
                            {formatCurrency(selectedSerial.financials.sellingPrice)}
                          </strong>
                        </div>
                        <div className="profit-stat-item highlight">
                          <span className="profit-stat-label">Unit Gross Profit</span>
                          <strong
                            className={`profit-stat-val mono ${
                              selectedSerial.financials.unitGrossProfit >= 0 ? 'positive' : 'negative'
                            }`}
                          >
                            {formatCurrency(selectedSerial.financials.unitGrossProfit)}
                          </strong>
                        </div>
                        <div className="profit-stat-item">
                          <span className="profit-stat-label">Profit Margin</span>
                          <strong className="profit-stat-val">
                            {selectedSerial.financials.marginPercent}%
                          </strong>
                        </div>
                        <div className="profit-stat-item">
                          <span className="profit-stat-label">Markup</span>
                          <strong className="profit-stat-val markup">
                            +{selectedSerial.financials.markupPercent}%
                          </strong>
                        </div>
                        <div className="profit-stat-item">
                          <span className="profit-stat-label">Turnaround Time</span>
                          <strong className="profit-stat-val">
                            {selectedSerial.financials.turnaroundDays !== null
                              ? `${selectedSerial.financials.turnaroundDays} Days`
                              : 'Same Day'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STOCK MOVEMENT AUDIT TRAIL */}
                  {Array.isArray(selectedSerial.matchingTransactions) &&
                    selectedSerial.matchingTransactions.length > 0 && (
                      <div className="serial-transactions-audit-card">
                        <div className="tx-audit-header">
                          <Layers size={16} />
                          <h4>Stock Movement Audit Log for Serial: {selectedSerial.serialNumber}</h4>
                        </div>
                        <div className="tx-table-wrap">
                          <table className="tx-audit-table">
                            <thead>
                              <tr>
                                <th>Timestamp</th>
                                <th>Movement Event</th>
                                <th>Reference ID</th>
                                <th>Party / Counterparty</th>
                                <th style={{ textAlign: 'center' }}>Units</th>
                                <th style={{ textAlign: 'right' }}>Stock After</th>
                                <th>Recorded By</th>
                                <th>Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedSerial.matchingTransactions.map((tx, txIdx) => (
                                <tr key={tx.id || txIdx}>
                                  <td className="mono" style={{ fontSize: '11.5px', color: '#64748b' }}>
                                    {formatDate(tx.date)}
                                  </td>
                                  <td>
                                    <span
                                      className={`tx-type-badge ${
                                        tx.type === 'STOCK IN'
                                          ? 'in'
                                          : tx.type === 'STOCK OUT'
                                          ? 'out'
                                          : 'neutral'
                                      }`}
                                    >
                                      {tx.event || tx.type}
                                    </span>
                                  </td>
                                  <td>
                                    <strong className="mono" style={{ color: '#0f172a' }}>
                                      {tx.reference || tx.referenceId || '—'}
                                    </strong>
                                  </td>
                                  <td>{tx.partyName || tx.supplierName || tx.customerName || 'Internal Warehouse'}</td>
                                  <td style={{ textAlign: 'center', fontWeight: 700 }}>{tx.quantity || 1}</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700 }} className="mono">
                                    {tx.stockAfter !== undefined ? tx.stockAfter : tx.currentStock || '—'}
                                  </td>
                                  <td style={{ fontSize: '12px', color: '#475569' }}>{tx.createdBy || 'System'}</td>
                                  <td style={{ fontSize: '12px', color: '#64748b' }}>{tx.remarks || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="serial-modal-footer">
                  <div className="modal-footer-nav-links">
                    {selectedSerial.inward?.poNumber && (
                      <button
                        type="button"
                        className="modal-footer-link-btn"
                        onClick={() => {
                          setSelectedSerial(null);
                          navigate('/purchase-orders/history');
                        }}
                      >
                        <ArrowDownRight size={14} /> View Purchase Order
                      </button>
                    )}
                    {selectedSerial.outward?.dcNumber && (
                      <button
                        type="button"
                        className="modal-footer-link-btn"
                        onClick={() => {
                          setSelectedSerial(null);
                          navigate('/delivery-challans/history');
                        }}
                      >
                        <Truck size={14} /> View Delivery Challan
                      </button>
                    )}
                    {selectedSerial.outward?.invoiceNumber && (
                      <button
                        type="button"
                        className="modal-footer-link-btn"
                        onClick={() => {
                          setSelectedSerial(null);
                          navigate('/orders/invoices');
                        }}
                      >
                        <CheckCircle2 size={14} /> View Sales Invoice
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    className="serial-action-btn secondary"
                    onClick={() => setSelectedSerial(null)}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
