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
  ArrowLeft,
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
import { useTablePagination, TableFooter } from '../common/TableWorkspace';
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

export default function SerialTrackingView({ user, initialQuery = '', initialStatus = 'ALL', activeSerialId = null }) {
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

  // Enterprise Table Pagination (dynamic viewport page size + filler rows)
  const {
    currentPage,
    totalPages,
    pageSize,
    currentRecords: currentRows,
    showingStart,
    showingEnd,
    totalRecords,
    goToPage
  } = useTablePagination(serials, {
    rowHeight: 48,
    resetDeps: [statusFilter, searchQuery]
  });

  const setCurrentPage = goToPage;

  // Dedicated Full-Page Active Serial State
  const [activeSerialData, setActiveSerialData] = useState(null);
  const [activeSerialLoading, setActiveSerialLoading] = useState(false);
  const [activeSerialError, setActiveSerialError] = useState('');

  // Fetch full serial provenance when activeSerialId route is present
  useEffect(() => {
    if (!activeSerialId) {
      setActiveSerialData(null);
      setActiveSerialError('');
      return;
    }
    const fetchActive = async () => {
      setActiveSerialLoading(true);
      setActiveSerialError('');
      try {
        const res = await apiFetch(apiUrl(`/api/serials/${encodeURIComponent(activeSerialId)}`), {
          headers: authHeaders(user)
        });
        const json = await res.json();
        if (res.ok && json.success) {
          setActiveSerialData(json.data);
        } else {
          setActiveSerialError(json?.message || `Serial ${activeSerialId} details not found.`);
        }
      } catch (err) {
        setActiveSerialError(err.message || 'Error fetching serial provenance details.');
      } finally {
        setActiveSerialLoading(false);
      }
    };
    fetchActive();
  }, [activeSerialId]);

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

  // Redirect to Dedicated Full-Page Serial Provenance View
  const handleInspectSerial = (serialNumber) => {
    if (!serialNumber) return;
    navigate(`/serials/${encodeURIComponent(serialNumber)}`);
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

  // Keyboard Escape listener to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedSerial) {
        setSelectedSerial(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSerial]);

  // Quick preset button click
  const handleSampleClick = (sn) => {
    setSearchQuery(sn);
    handleInspectSerial(sn);
  };

  

  // =========================================================================
  // DEDICATED FULL-PAGE SERIAL PROVENANCE DETAIL VIEW (REDIRECT TARGET)
  // =========================================================================
  if (activeSerialId) {
    return (
      <div className="serial-tracking-container serial-detail-page-container">
        {/* Breadcrumb & Navigation Bar */}
        <div className="serial-detail-top-nav">
          <div className="serial-breadcrumb-trail">
            <span className="crumb-root" onClick={() => navigate('/serials')} title="Go back to Serials list">
              Serial Tracking
            </span>
            <span className="crumb-sep">/</span>
            <span className="crumb-active mono">{activeSerialId}</span>
          </div>

          <button
            type="button"
            className="serial-back-to-list-btn"
            onClick={() => navigate('/serials')}
            title="Return to Serial Register List"
          >
            <ArrowLeft size={16} />
            <span>Back to Serial Register</span>
          </button>
        </div>

        {activeSerialLoading ? (
          <div className="serial-page-loading-card">
            <RefreshCw size={32} className="spin" style={{ color: '#2563eb', margin: '0 auto 16px auto' }} />
            <h3>Auditing hardware serial lifecycle &amp; transactions...</h3>
            <p>Fetching complete provenance trail from Procurement, Vault, Challan, and Invoice registers.</p>
          </div>
        ) : activeSerialError ? (
          <div className="serial-page-error-card">
            <AlertTriangle size={36} style={{ color: '#dc2626', margin: '0 auto 16px auto' }} />
            <h3>Serial Audit Record Not Found</h3>
            <p>{activeSerialError}</p>
            <button
              type="button"
              className="serial-action-btn primary"
              style={{ marginTop: '20px', display: 'inline-flex' }}
              onClick={() => navigate('/serials')}
            >
              <ArrowLeft size={15} /> Back to Serial Register
            </button>
          </div>
        ) : activeSerialData ? (
          <div className="serial-detail-page-content">
            {/* 1. Hardware Unit Identity Hero Banner */}
            <div className="serial-detail-hero-banner">
              <div className="hero-identity-main">
                <div className="hero-badge-pill">
                  <Barcode size={14} />
                  <span>HARDWARE PROVENANCE AUDIT</span>
                </div>
                <div className="hero-sn-row">
                  <h1 className="hero-sn-title mono">{activeSerialData.serialNumber}</h1>
                  <button
                    type="button"
                    className="serial-hero-copy-btn"
                    onClick={(e) => handleCopy(activeSerialData.serialNumber, e)}
                    title="Copy Serial Number"
                  >
                    {copiedSn === activeSerialData.serialNumber ? (
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
                <div className="hero-product-meta">
                  <h2 className="hero-prod-name">{activeSerialData.product?.name}</h2>
                  <div className="hero-prod-tags">
                    <span className="hero-tag mono">SKU: {activeSerialData.product?.code || '—'}</span>
                    {activeSerialData.product?.hsnSac && (
                      <span className="hero-tag mono">HSN/SAC: {activeSerialData.product.hsnSac}</span>
                    )}
                    <span className="hero-tag">Serialization: Strict Unique Key</span>
                  </div>
                </div>
              </div>

              <div className="hero-identity-right">
                <span
                  className={`serial-status-badge large ${
                    activeSerialData.status === 'IN_STOCK'
                      ? 'stock'
                      : activeSerialData.status === 'DISPATCHED_UNBILLED'
                      ? 'unbilled'
                      : 'billed'
                  }`}
                >
                  <span className="status-dot" />
                  {activeSerialData.statusLabel}
                </span>

                <div className="hero-quick-actions">
                  <button
                    type="button"
                    className="serial-action-btn secondary"
                    onClick={async () => {
                      setActiveSerialLoading(true);
                      try {
                        const res = await apiFetch(apiUrl(`/api/serials/${encodeURIComponent(activeSerialId)}`), {
                          headers: authHeaders(user)
                        });
                        const json = await res.json();
                        if (res.ok && json.success) setActiveSerialData(json.data);
                      } finally {
                        setActiveSerialLoading(false);
                      }
                    }}
                    title="Refresh Serial Data"
                  >
                    <RefreshCw size={13} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Commercial & Movement Summary Grid (6-Box KPI Cards) */}
            <div className="serial-modal-metrics-card" style={{ marginBottom: '24px' }}>
              <div className="serial-metrics-card-header">
                <DollarSign size={16} />
                <span>Commercial &amp; Movement Summary</span>
              </div>
              <div className="serial-modal-metrics-grid">
                {/* 1. Inward PO & Supplier */}
                <div className="serial-modal-metric-box">
                  <div className="metric-box-label">
                    <ArrowDownRight size={13} style={{ color: '#2563eb' }} />
                    <span>Inward PO &amp; Supplier</span>
                  </div>
                  <div className="metric-box-val-main">
                    {activeSerialData.inward?.poNumber ? (
                      <span
                        className="metric-link po"
                        onClick={() => navigate('/purchase-orders/history')}
                        title="Navigate to Purchase Orders"
                      >
                        {activeSerialData.inward.poNumber}
                        <ExternalLink size={12} style={{ marginLeft: '4px' }} />
                      </span>
                    ) : (
                      <span className="text-muted">PO Not Linked</span>
                    )}
                  </div>
                  <div className="metric-box-sub">
                    {activeSerialData.inward?.supplierName || '—'}
                    {activeSerialData.inward?.receivedDate && (
                      <span className="metric-date-sub"> • {formatDate(activeSerialData.inward.receivedDate)}</span>
                    )}
                  </div>
                </div>

                {/* 2. Inward Cost */}
                <div className="serial-modal-metric-box">
                  <div className="metric-box-label">
                    <Tag size={13} style={{ color: '#16a34a' }} />
                    <span>Inward Cost</span>
                  </div>
                  <div className="metric-box-val-main cost mono">
                    {formatCurrency(activeSerialData.inward?.inwardCostPrice || activeSerialData.financials?.inwardCost || 0)}
                  </div>
                  <div className="metric-box-sub text-muted">
                    {activeSerialData.inward?.grnReference ? `GRN: ${activeSerialData.inward.grnReference}` : 'Unit Base Procurement Cost'}
                  </div>
                </div>

                {/* 3. Outward DC & Customer */}
                <div className="serial-modal-metric-box">
                  <div className="metric-box-label">
                    <Truck size={13} style={{ color: '#d97706' }} />
                    <span>Outward DC &amp; Destination</span>
                  </div>
                  <div className="metric-box-val-main">
                    {activeSerialData.outward?.dcNumber ? (
                      <span
                        className="metric-link dc"
                        onClick={() => navigate('/delivery-challans/history')}
                        title="Navigate to Delivery Challans"
                      >
                        {activeSerialData.outward.dcNumber}
                        <ExternalLink size={12} style={{ marginLeft: '4px' }} />
                      </span>
                    ) : (
                      <span className="text-muted">Awaiting Dispatch</span>
                    )}
                  </div>
                  <div className="metric-box-sub">
                    {activeSerialData.outward?.customerCompany || activeSerialData.outward?.customerName || 'In Stock'}
                    {activeSerialData.outward?.dispatchDate && (
                      <span className="metric-date-sub"> • {formatDate(activeSerialData.outward.dispatchDate)}</span>
                    )}
                  </div>
                </div>

                {/* 4. Sales Invoice */}
                <div className="serial-modal-metric-box">
                  <div className="metric-box-label">
                    <CheckCircle2 size={13} style={{ color: '#059669' }} />
                    <span>Sales Invoice</span>
                  </div>
                  <div className="metric-box-val-main">
                    {activeSerialData.outward?.invoiceNumber ? (
                      <span
                        className="metric-link invoice"
                        onClick={() => navigate('/orders/invoices')}
                        title="Navigate to Sales Invoices"
                      >
                        {activeSerialData.outward.invoiceNumber}
                        <ExternalLink size={12} style={{ marginLeft: '4px' }} />
                      </span>
                    ) : activeSerialData.outward ? (
                      <span className="serial-pending-invoice-badge">⚡ Pending Sales Invoice</span>
                    ) : (
                      <span className="text-muted">Unbilled (In Stock)</span>
                    )}
                  </div>
                  <div className="metric-box-sub text-muted">
                    {activeSerialData.outward?.isBilled ? 'Settled & Realized' : (activeSerialData.outward ? 'Goods with Customer' : 'Vault Inventory')}
                  </div>
                </div>

                {/* 5. Selling Price */}
                <div className="serial-modal-metric-box">
                  <div className="metric-box-label">
                    <DollarSign size={13} style={{ color: '#2563eb' }} />
                    <span>Selling Price</span>
                  </div>
                  <div className="metric-box-val-main sale mono">
                    {activeSerialData.outward?.sellingPrice ? formatCurrency(activeSerialData.outward.sellingPrice) : '—'}
                  </div>
                  <div className="metric-box-sub text-muted">
                    {activeSerialData.outward?.sellingPrice ? 'Agreed Billing Rate' : 'Not Yet Invoiced'}
                  </div>
                </div>

                {/* 6. Unit Gross Profit */}
                <div className="serial-modal-metric-box highlight">
                  <div className="metric-box-label">
                    <TrendingUp size={13} style={{ color: '#16a34a' }} />
                    <span>Unit Gross Profit</span>
                  </div>
                  <div
                    className={`metric-box-val-main mono ${
                      activeSerialData.financials?.unitGrossProfit > 0
                        ? 'positive'
                        : activeSerialData.financials?.unitGrossProfit < 0
                        ? 'negative'
                        : ''
                    }`}
                  >
                    {activeSerialData.financials?.unitGrossProfit !== undefined && activeSerialData.outward
                      ? formatCurrency(activeSerialData.financials.unitGrossProfit)
                      : '—'}
                  </div>
                  <div className="metric-box-sub">
                    {activeSerialData.financials?.markupPercent ? (
                      <span className="serial-markup-pill">+{activeSerialData.financials.markupPercent}% Markup</span>
                    ) : activeSerialData.outward ? (
                      <span className="text-muted">0.00% Margin</span>
                    ) : (
                      <span className="text-muted">Pending Realization</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. 4-Stage Visual Lifecycle Stepper */}
            <div className="serial-stepper-card" style={{ marginBottom: '24px' }}>
              <h4 className="serial-section-subheading">
                <Layers size={16} /> 4-Stage Lifecycle Stepper
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
                      {activeSerialData.inward?.poNumber || 'PO Recorded'}
                    </span>
                    <span className="step-date">
                      {formatDate(activeSerialData.inward?.receivedDate)}
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
                      {activeSerialData.outward ? 'Allocated & Moved' : 'Present in Stock'}
                    </span>
                  </div>
                </div>

                <div className={`serial-step-connector ${activeSerialData.outward ? 'completed' : 'pending'}`} />

                {/* Step 3: DC Dispatch */}
                <div className={`serial-step-node ${activeSerialData.outward ? 'completed' : 'pending'}`}>
                  <div className="step-icon">
                    <Truck size={16} />
                  </div>
                  <div className="step-content">
                    <span className="step-title">3. DC Dispatch</span>
                    <span className="step-desc">
                      {activeSerialData.outward ? activeSerialData.outward.dcNumber : 'Awaiting Dispatch'}
                    </span>
                    <span className="step-date">
                      {activeSerialData.outward ? formatDate(activeSerialData.outward.dispatchDate) : 'Not Yet Dispatched'}
                    </span>
                  </div>
                </div>

                <div className={`serial-step-connector ${activeSerialData.outward?.isBilled ? 'completed' : 'pending'}`} />

                {/* Step 4: Sales Invoice */}
                <div className={`serial-step-node ${activeSerialData.outward?.isBilled ? 'completed' : 'pending'}`}>
                  <div className="step-icon">
                    <CheckCircle2 size={16} />
                  </div>
                  <div className="step-content">
                    <span className="step-title">4. Invoice Settled</span>
                    <span className="step-desc">
                      {activeSerialData.outward?.invoiceNumber || (activeSerialData.outward ? 'Unbilled Under DC' : 'Unbilled')}
                    </span>
                    <span className="step-date">
                      {activeSerialData.outward?.isBilled ? 'Revenue Realized' : 'Pending Realization'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Two-Column Deep Audit Cards */}
            <div className="serial-two-col-grid" style={{ marginBottom: '24px' }}>
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
                      {activeSerialData.inward?.poNumber || 'PO Reference Not Linked'}
                      <ExternalLink size={12} style={{ marginLeft: '4px' }} />
                    </span>
                  </div>
                  <div className="audit-kv-row">
                    <span className="kv-label">Goods Receipt (GRN)</span>
                    <span className="kv-value mono">{activeSerialData.inward?.grnReference || 'Standard GRN'}</span>
                  </div>
                  <div className="audit-kv-row">
                    <span className="kv-label">Supplier Partner</span>
                    <span className="kv-value bold">{activeSerialData.inward?.supplierName || '—'}</span>
                  </div>
                  <div className="audit-kv-row">
                    <span className="kv-label">Inward Receipt Date</span>
                    <span className="kv-value">{formatDate(activeSerialData.inward?.receivedDate)}</span>
                  </div>
                  <div className="audit-kv-row">
                    <span className="kv-label">Inward Unit Cost</span>
                    <span className="kv-value cost mono">
                      {formatCurrency(activeSerialData.inward?.inwardCostPrice || activeSerialData.financials?.inwardCost || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: OUTWARD MOVEMENT & BILLING */}
              <div className="serial-audit-card outward">
                <div className="audit-card-header outward">
                  <Truck size={16} />
                  <h4>📤 Outward Movement &amp; Billing Details</h4>
                </div>
                <div className="audit-card-body">
                  <div className="audit-kv-row">
                    <span className="kv-label">Delivery Challan Ref</span>
                    {activeSerialData.outward?.dcNumber ? (
                      <span
                        className="kv-value link"
                        onClick={() => navigate('/delivery-challans/history')}
                        title="Navigate to Delivery Challans"
                      >
                        {activeSerialData.outward.dcNumber}
                        <ExternalLink size={12} style={{ marginLeft: '4px' }} />
                      </span>
                    ) : (
                      <span className="kv-value text-muted">Awaiting Dispatch</span>
                    )}
                  </div>
                  <div className="audit-kv-row">
                    <span className="kv-label">Destination Customer</span>
                    <span className="kv-value bold">
                      {activeSerialData.outward?.customerCompany || activeSerialData.outward?.customerName || 'In Stock (Warehouse)'}
                    </span>
                  </div>
                  <div className="audit-kv-row">
                    <span className="kv-label">Dispatch Date</span>
                    <span className="kv-value">
                      {formatDate(activeSerialData.outward?.dispatchDate)}
                    </span>
                  </div>
                  <div className="audit-kv-row">
                    <span className="kv-label">Sales Invoice Ref</span>
                    {activeSerialData.outward?.invoiceNumber ? (
                      <span
                        className="kv-value link"
                        onClick={() => navigate('/orders/invoices')}
                        title="Navigate to Sales Invoices"
                      >
                        {activeSerialData.outward.invoiceNumber}
                        <ExternalLink size={12} style={{ marginLeft: '4px' }} />
                      </span>
                    ) : (
                      <span className="kv-value text-muted">
                        {activeSerialData.outward ? '⚡ Pending Sales Invoice' : 'Unbilled'}
                      </span>
                    )}
                  </div>
                  <div className="audit-kv-row">
                    <span className="kv-label">Selling Unit Price</span>
                    <span className="kv-value sale mono">
                      {activeSerialData.outward?.sellingPrice
                        ? formatCurrency(activeSerialData.outward.sellingPrice)
                        : '—'}
                    </span>
                  </div>
                  <div className="audit-kv-row">
                    <span className="kv-label">Realized Unit Margin</span>
                    <span
                      className={`kv-value bold mono ${
                        activeSerialData.financials?.unitGrossProfit > 0
                          ? 'positive'
                          : activeSerialData.financials?.unitGrossProfit < 0
                          ? 'negative'
                          : ''
                      }`}
                    >
                      {activeSerialData.financials?.unitGrossProfit !== undefined && activeSerialData.outward
                        ? formatCurrency(activeSerialData.financials.unitGrossProfit)
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Document Navigation Footer */}
            <div className="serial-detail-page-footer">
              <div className="modal-footer-nav-links">
                {activeSerialData.inward?.poNumber && (
                  <button
                    type="button"
                    className="modal-footer-link-btn"
                    onClick={() => navigate('/purchase-orders/history')}
                  >
                    <ArrowDownRight size={14} /> View Purchase Order
                  </button>
                )}
                {activeSerialData.outward?.dcNumber && (
                  <button
                    type="button"
                    className="modal-footer-link-btn"
                    onClick={() => navigate('/delivery-challans/history')}
                  >
                    <Truck size={14} /> View Delivery Challan
                  </button>
                )}
                {activeSerialData.outward?.invoiceNumber && (
                  <button
                    type="button"
                    className="modal-footer-link-btn"
                    onClick={() => navigate('/orders/invoices')}
                  >
                    <CheckCircle2 size={14} /> View Sales Invoice
                  </button>
                )}
              </div>

              <button
                type="button"
                className="serial-action-btn secondary"
                onClick={() => navigate('/serials')}
              >
                <ArrowLeft size={14} /> Back to Serial Register
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

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
      <div className="settings-table-shell stocks-table-shell crm-table-workspace serial-table-card serials-master-card">
        <div className="crm-table-scroll-wrap stocks-table-natural-wrap crm-table-viewport serial-table-scroll-container">
          <table className="crm-master-table crm-data-table settings-table serial-master-table serials-register-table">
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '40%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ width: '5%', textAlign: 'center' }}>#</th>
                <th style={{ width: '25%' }}>Serial Number</th>
                <th style={{ width: '40%' }}>Product / SKU</th>
                <th style={{ width: '18%', textAlign: 'center' }}>Lifecycle Status</th>
                <th style={{ width: '12%', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="empty-row">
                  <td colSpan={5} className="serial-table-empty">
                    <RefreshCw size={24} className="spin" style={{ color: '#2563eb', margin: '0 auto 8px auto', display: 'block' }} />
                    Loading serialized hardware records...
                  </td>
                </tr>
              ) : serials.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={5} className="serial-table-empty">
                    <Barcode size={32} style={{ color: '#94a3b8', margin: '0 auto 8px auto', display: 'block' }} />
                    <strong>No serial numbers found matching your query.</strong>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                      Try adjusting your search terms or clearing status filters.
                    </p>
                  </td>
                </tr>
              ) : (
                currentRows.map((item, index) => {
                  const rowNumber = (currentPage - 1) * pageSize + index + 1;
                  const isStock = item.status === 'IN_STOCK';
                  const isUnbilled = item.status === 'DISPATCHED_UNBILLED';
                  const isBilled = item.status === 'BILLED_ACTIVE';

                  return (
                    <tr
                      key={item.serialNumber || index}
                      className="table-data-row serial-table-row"
                      onClick={() => handleInspectSerial(item.serialNumber)}
                    >
                      {/* 1. Index */}
                      <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                        {rowNumber}
                      </td>

                      {/* 2. Serial Number with reactive badge & copy */}
                      <td>
                        <div className="serial-sn-cell">
                          <button
                            type="button"
                            className="serial-sn-badge-btn mono"
                            title="Click to view complete serial lifecycle, PO, DC, Invoice & Profit details"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInspectSerial(item.serialNumber);
                            }}
                          >
                            <Barcode size={13} className="serial-sn-icon" />
                            <span>{item.serialNumber}</span>
                            <ExternalLink size={12} className="serial-sn-ext-icon" />
                          </button>
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

                      {/* 4. Lifecycle Status Badge */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`serial-status-badge ${isStock ? 'stock' : (isUnbilled ? 'unbilled' : 'billed')}`}>
                          <span className="status-dot" />
                          {item.statusLabel || item.status}
                        </span>
                      </td>

                      {/* 5. Action */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="serial-inspect-btn"
                          title="View Inward PO, Outward DC, Invoice & Profit Details"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectSerial(item.serialNumber);
                          }}
                        >
                          <Eye size={13} />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}

              {/* Table Filler Rows (fills card height so it takes the full page cleanly like Image 2) */}
              {!loading && currentRows.length > 0 && currentRows.length < pageSize && (
                Array.from({ length: pageSize - currentRows.length }).map((_, fIdx) => (
                  <tr key={`filler-${fIdx}`} className="table-data-row table-filler-row" aria-hidden="true">
                    <td style={{ textAlign: 'center' }}>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Standard ASICRM Table Workspace Footer */}
        <TableFooter
          showingStart={showingStart}
          showingEnd={showingEnd}
          total={totalRecords}
          singularLabel="serial unit"
          recordLabel="serial units"
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
        />
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

                  {/* Commercial & Movement Summary Grid (All 6 Values from Table) */}
                  <div className="serial-modal-metrics-card">
                    <div className="serial-metrics-card-header">
                      <DollarSign size={15} />
                      <span>Commercial &amp; Movement Summary</span>
                    </div>
                    <div className="serial-modal-metrics-grid">
                      {/* 1. Inward PO & Supplier */}
                      <div className="serial-modal-metric-box">
                        <div className="metric-box-label">
                          <ArrowDownRight size={13} style={{ color: '#2563eb' }} />
                          <span>Inward PO &amp; Supplier</span>
                        </div>
                        <div className="metric-box-val-main">
                          {selectedSerial.inward?.poNumber ? (
                            <span
                              className="metric-link po"
                              onClick={() => {
                                setSelectedSerial(null);
                                navigate('/purchase-orders/history');
                              }}
                              title="Navigate to Purchase Orders"
                            >
                              {selectedSerial.inward.poNumber}
                            </span>
                          ) : (
                            <span className="text-muted">PO Not Linked</span>
                          )}
                        </div>
                        <div className="metric-box-sub">
                          {selectedSerial.inward?.supplierName || '—'}
                          {selectedSerial.inward?.receivedDate && (
                            <span className="metric-date-sub"> • {formatDate(selectedSerial.inward.receivedDate)}</span>
                          )}
                        </div>
                      </div>

                      {/* 2. Inward Cost */}
                      <div className="serial-modal-metric-box">
                        <div className="metric-box-label">
                          <Tag size={13} style={{ color: '#16a34a' }} />
                          <span>Inward Cost</span>
                        </div>
                        <div className="metric-box-val-main cost mono">
                          {formatCurrency(selectedSerial.inward?.inwardCostPrice || selectedSerial.financials?.inwardCost || 0)}
                        </div>
                        <div className="metric-box-sub text-muted">
                          {selectedSerial.inward?.grnReference ? `GRN: ${selectedSerial.inward.grnReference}` : 'Unit Base Procurement Cost'}
                        </div>
                      </div>

                      {/* 3. Outward DC & Customer */}
                      <div className="serial-modal-metric-box">
                        <div className="metric-box-label">
                          <Truck size={13} style={{ color: '#d97706' }} />
                          <span>Outward DC &amp; Customer</span>
                        </div>
                        <div className="metric-box-val-main">
                          {selectedSerial.outward?.dcNumber ? (
                            <span
                              className="metric-link dc"
                              onClick={() => {
                                setSelectedSerial(null);
                                navigate('/delivery-challans/history');
                              }}
                              title="Navigate to Delivery Challans"
                            >
                              {selectedSerial.outward.dcNumber}
                            </span>
                          ) : (
                            <span style={{ color: '#059669', fontWeight: 700 }}>In Warehouse Stock</span>
                          )}
                        </div>
                        <div className="metric-box-sub">
                          {selectedSerial.outward?.customerName ? (
                            <>
                              {selectedSerial.outward.customerName}
                              {selectedSerial.outward.dispatchDate && (
                                <span className="metric-date-sub"> • {formatDate(selectedSerial.outward.dispatchDate)}</span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted">Awaiting Dispatch Allocation</span>
                          )}
                        </div>
                      </div>

                      {/* 4. Invoice Ref */}
                      <div className="serial-modal-metric-box">
                        <div className="metric-box-label">
                          <CheckCircle2 size={13} style={{ color: '#7c3aed' }} />
                          <span>Invoice Ref</span>
                        </div>
                        <div className="metric-box-val-main">
                          {selectedSerial.outward?.invoiceNumber ? (
                            <span
                              className="metric-link invoice"
                              onClick={() => {
                                setSelectedSerial(null);
                                navigate('/orders/invoices');
                              }}
                              title="Navigate to Sales Invoices"
                            >
                              {selectedSerial.outward.invoiceNumber}
                            </span>
                          ) : selectedSerial.outward ? (
                            <span className="serial-pending-invoice-badge">⚡ Pending Sales Invoice</span>
                          ) : (
                            <span className="text-muted">Unbilled (In Stock)</span>
                          )}
                        </div>
                        <div className="metric-box-sub text-muted">
                          {selectedSerial.outward?.isBilled ? 'Settled & Realized' : (selectedSerial.outward ? 'Goods with Customer' : 'Vault Inventory')}
                        </div>
                      </div>

                      {/* 5. Selling Price */}
                      <div className="serial-modal-metric-box">
                        <div className="metric-box-label">
                          <DollarSign size={13} style={{ color: '#2563eb' }} />
                          <span>Selling Price</span>
                        </div>
                        <div className="metric-box-val-main sale mono">
                          {selectedSerial.outward?.sellingPrice ? formatCurrency(selectedSerial.outward.sellingPrice) : '—'}
                        </div>
                        <div className="metric-box-sub text-muted">
                          {selectedSerial.outward?.sellingPrice ? 'Agreed Billing Rate' : 'Not Yet Invoiced'}
                        </div>
                      </div>

                      {/* 6. Unit Gross Profit */}
                      <div className="serial-modal-metric-box highlight">
                        <div className="metric-box-label">
                          <TrendingUp size={13} style={{ color: '#16a34a' }} />
                          <span>Unit Gross Profit</span>
                        </div>
                        <div
                          className={`metric-box-val-main mono ${
                            selectedSerial.financials?.unitGrossProfit > 0
                              ? 'positive'
                              : selectedSerial.financials?.unitGrossProfit < 0
                              ? 'negative'
                              : ''
                          }`}
                        >
                          {selectedSerial.financials?.unitGrossProfit !== undefined && selectedSerial.outward
                            ? formatCurrency(selectedSerial.financials.unitGrossProfit)
                            : '—'}
                        </div>
                        <div className="metric-box-sub">
                          {selectedSerial.financials?.markupPercent ? (
                            <span className="serial-markup-pill">+{selectedSerial.financials.markupPercent}% Markup</span>
                          ) : selectedSerial.outward ? (
                            <span className="text-muted">0.00% Margin</span>
                          ) : (
                            <span className="text-muted">Pending Realization</span>
                          )}
                        </div>
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
