import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch, apiUrl } from '../../api';
import { navigate } from '../../router';
import { formatDate } from '../../utils/dateUtils';
import {
  FileText,
  Clock,
  CheckCircle2,
  Truck,
  Eye,
  Search,
  PackageCheck,
  Printer,
  ArrowLeft,
  Plus,
  Building2,
  Phone,
  Mail,
  MapPin,
  Receipt,
  AlertCircle
} from 'lucide-react';
import PrintablePurchaseOrder from '../documents/PrintablePurchaseOrder';
import DocumentPreviewModal from '../documents/DocumentPreviewModal';
import DocumentPrintService from '../documents/DocumentPrintService';
import DocumentPdfService, { getPurchaseOrderFilename } from '../documents/DocumentPdfService';
import { TableFooter, useTablePagination } from '../common/TableWorkspace';
import { filterRecordsBySearch } from '../../utils/searchHelper';
import './purchaseOrders.css';

export default function SupplierDetail({
  user,
  supplierId,
  navigationContext,
  onBack,
  onOpenPo,
  onOpenGrn
}) {
  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState(() => navigationContext?.initialTab || 'allDocuments');

  // Search & filter states
  const [docSearch, setDocSearch] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('ALL'); // ALL, PO, GRN
  const [docSort, setDocSort] = useState('NEWEST');

  const [poSearch, setPoSearch] = useState('');
  const [poStatusFilter, setPoStatusFilter] = useState('ALL');
  const [poSort, setPoSort] = useState('NEWEST');
  const [openItemsPoId, setOpenItemsPoId] = useState(null);

  const [grnSearch, setGrnSearch] = useState('');
  const [grnSort, setGrnSort] = useState('NEWEST');

  // Preview / Print modal state
  const [previewPo, setPreviewPo] = useState(null);

  useEffect(() => {
    setOpenItemsPoId(null);
  }, [poSearch, activeSection]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.po-items-cell')) {
        setOpenItemsPoId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpenItemsPoId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const fetchSupplierDetails = async () => {
    if (!supplierId) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(apiUrl(`/api/suppliers/${encodeURIComponent(supplierId)}`), {
        headers: { 'x-user-id': user?.id || '' }
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setSupplier(data.data);
      } else {
        setError(data.message || `Failed to load details for supplier ${supplierId}.`);
      }
    } catch (err) {
      console.error('Failed to load supplier details:', err);
      setError('Unable to communicate with the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupplierDetails();
  }, [supplierId]);

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Number(amt || 0));
  };

  const purchaseOrdersList = useMemo(() => {
    return Array.isArray(supplier?.purchaseOrders) ? supplier.purchaseOrders : [];
  }, [supplier?.purchaseOrders]);

  const goodsReceiptsList = useMemo(() => {
    return Array.isArray(supplier?.goodsReceipts) ? supplier.goodsReceipts : [];
  }, [supplier?.goodsReceipts]);

  const metrics = useMemo(() => {
    if (supplier?.metrics) return supplier.metrics;
    const pos = purchaseOrdersList;
    const grns = goodsReceiptsList;
    let totalVal = 0;
    let sent = 0;
    let rec = 0;
    let partial = 0;
    for (const p of pos) {
      if (p.status !== 'CANCELLED') totalVal += Number(p.grandTotal || p.totalAmount || 0);
      if (p.status === 'SENT') sent++;
      else if (p.status === 'RECEIVED') rec++;
      else if (p.status === 'PARTIALLY_RECEIVED') partial++;
    }
    return {
      totalOrders: pos.length,
      allDocuments: pos.length + grns.length,
      sentOrders: sent,
      receivedOrders: rec,
      partiallyReceivedOrders: partial,
      pendingDeliveries: sent + partial,
      totalGrns: grns.length,
      totalProcurementValue: totalVal
    };
  }, [supplier?.metrics, purchaseOrdersList, goodsReceiptsList]);

  // Unified Chronological Documents List (Sent POs + Received GRNs)
  const unifiedDocumentsList = useMemo(() => {
    const list = [];

    // Add Purchase Orders (Sent)
    purchaseOrdersList.forEach((po) => {
      const items = Array.isArray(po.items) ? po.items : [];
      const primaryItem = items[0]?.productName || items[0]?.name || items[0]?.productCode || 'Item';
      const summaryText = items.length > 1 ? `${primaryItem} (+${items.length - 1} more)` : primaryItem;
      list.push({
        id: po.id,
        rawId: po.id,
        flow: 'SENT',
        flowLabel: 'SENT (PO)',
        docType: 'PURCHASE_ORDER',
        docNumber: po.id,
        date: po.orderDate || po.createdAt,
        reference: '—',
        summary: summaryText,
        itemCount: items.length,
        totalOrderedQty: po.totalOrderedQty || 0,
        totalReceivedQty: po.totalReceivedQty || 0,
        totalValue: Number(po.grandTotal || po.totalAmount || 0),
        status: po.status || 'DRAFT',
        raw: po
      });
    });

    // Add Goods Receipts (Received)
    goodsReceiptsList.forEach((grn) => {
      const items = Array.isArray(grn.items) ? grn.items : [];
      const primaryItem = items[0]?.productName || items[0]?.name || items[0]?.productCode || 'Received Items';
      const summaryText = items.length > 1 ? `${primaryItem} (+${items.length - 1} more)` : primaryItem;
      const totalUnits = items.reduce((s, it) => s + (Number(it.quantity || it.receiveNow || 0)), 0);
      list.push({
        id: grn.id,
        rawId: grn.id,
        flow: 'RECEIVED',
        flowLabel: 'RECEIVED (GRN)',
        docType: 'GOODS_RECEIPT',
        docNumber: grn.id,
        date: grn.receivedDate || grn.createdAt,
        reference: grn.purchaseOrderId || grn.poNumber || '—',
        challanNumber: grn.challanNumber || '',
        invoiceNumber: grn.invoiceNumber || '',
        summary: summaryText,
        itemCount: items.length,
        receivedUnits: totalUnits,
        totalValue: 0,
        status: 'RECEIVED',
        raw: grn
      });
    });

    return list;
  }, [purchaseOrdersList, goodsReceiptsList]);

  // Filtered Unified Documents
  const filteredUnifiedDocs = useMemo(() => {
    let list = unifiedDocumentsList;

    if (docTypeFilter !== 'ALL') {
      list = list.filter((d) => d.flow === docTypeFilter);
    }

    if (docSearch.trim()) {
      list = filterRecordsBySearch(list, docSearch, [
        (d) => d.docNumber,
        (d) => d.reference,
        (d) => d.summary,
        (d) => d.challanNumber,
        (d) => d.invoiceNumber,
        (d) => d.status
      ]);
    }

    return list.sort((a, b) => {
      const timeA = new Date(a.date || 0).getTime();
      const timeB = new Date(b.date || 0).getTime();
      if (docSort === 'OLDEST') return timeA - timeB;
      if (docSort === 'HIGHEST_VALUE') return (b.totalValue || 0) - (a.totalValue || 0);
      return timeB - timeA;
    });
  }, [unifiedDocumentsList, docTypeFilter, docSearch, docSort]);

  // Filtered Purchase Orders
  const filteredPurchaseOrders = useMemo(() => {
    let list = purchaseOrdersList;

    if (poStatusFilter !== 'ALL') {
      list = list.filter((p) => String(p.status || '').toUpperCase() === poStatusFilter);
    }

    if (poSearch.trim()) {
      list = filterRecordsBySearch(list, poSearch, [
        (p) => p.id,
        (p) => p.remarks,
        (p) => p.status,
        (p) => p.items?.map((it) => `${it.productName || ''} ${it.productCode || it.sku || ''}`)
      ]);
    }

    return list.sort((a, b) => {
      const timeA = new Date(a.orderDate || a.createdAt || 0).getTime();
      const timeB = new Date(b.orderDate || b.createdAt || 0).getTime();
      if (poSort === 'OLDEST') return timeA - timeB;
      if (poSort === 'HIGHEST_AMOUNT') {
        return Number(b.grandTotal || b.totalAmount || 0) - Number(a.grandTotal || a.totalAmount || 0);
      }
      return timeB - timeA;
    });
  }, [purchaseOrdersList, poStatusFilter, poSearch, poSort]);

  // Filtered Goods Receipts
  const filteredGoodsReceipts = useMemo(() => {
    let list = goodsReceiptsList;

    if (grnSearch.trim()) {
      list = filterRecordsBySearch(list, grnSearch, [
        (g) => g.id,
        (g) => g.purchaseOrderId,
        (g) => g.poNumber,
        (g) => g.challanNumber,
        (g) => g.invoiceNumber,
        (g) => g.receivedBy,
        (g) => g.remarks,
        (g) => g.items?.map((it) => `${it.productName || ''} ${it.productCode || it.sku || ''}`)
      ]);
    }

    return list.sort((a, b) => {
      const timeA = new Date(a.receivedDate || a.createdAt || 0).getTime();
      const timeB = new Date(b.receivedDate || b.createdAt || 0).getTime();
      if (grnSort === 'OLDEST') return timeA - timeB;
      return timeB - timeA;
    });
  }, [goodsReceiptsList, grnSearch, grnSort]);

  // Table paginations
  const docPagination = useTablePagination(filteredUnifiedDocs, {
    explicitPageSize: 10,
    resetDeps: [docSearch, docTypeFilter, docSort]
  });

  const poPagination = useTablePagination(filteredPurchaseOrders, {
    explicitPageSize: 10,
    resetDeps: [poSearch, poStatusFilter, poSort]
  });

  const grnPagination = useTablePagination(filteredGoodsReceipts, {
    explicitPageSize: 10,
    resetDeps: [grnSearch, grnSort]
  });

  const tabs = [
    { key: 'allDocuments', label: 'All Documents', count: unifiedDocumentsList.length },
    { key: 'purchaseOrders', label: 'Sent (Purchase Orders)', count: purchaseOrdersList.length },
    { key: 'goodsReceipts', label: 'Received (Goods Receipts)', count: goodsReceiptsList.length },
    { key: 'profile', label: 'Supplier Profile', count: null }
  ];

  if (loading) {
    return (
      <div className="crm-loading-full" style={{ padding: '60px', textAlign: 'center' }}>
        <div className="crm-spinner" />
        <p style={{ marginTop: '12px', color: '#64748b' }}>Loading supplier history...</p>
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="po-container purchase-order-page" style={{ padding: '24px' }}>
        <div className="crm-alert-box error" style={{ padding: '16px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
          <span>{error || 'Supplier not found.'}</span>
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={() => onBack ? onBack() : navigate('/purchase-orders/history')}
            style={{ marginLeft: '12px' }}
          >
            ← Back to PO History
          </button>
        </div>
      </div>
    );
  }

  const supplierInitials = (supplier.companyName || 'SU')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <div className="crm-customer-detail-page customer-detail-modern supplier-detail-page">
      {/* Top Navigation Bar */}
      <div className="detail-top-nav-bar customer-detail-nav-compact">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onBack ? onBack() : navigate('/purchase-orders/history')}
            className="crm-back-btn"
          >
            ← Back to Purchase Orders
          </button>
          <button
            type="button"
            onClick={() => navigate('/purchase-orders/suppliers')}
            className="crm-back-btn"
            style={{ color: '#2563eb' }}
          >
            View All Suppliers
          </button>
        </div>

        <button
          type="button"
          className="crm-btn-primary"
          onClick={() => navigate(`/purchase-orders/new?supplierId=${encodeURIComponent(supplier.id)}`)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={15} /> Create Purchase Order
        </button>
      </div>

      {/* Supplier Profile Hero Card */}
      <section className="customer-hero-profile-card customer-hero-compact supplier-hero-card">
        <div className="profile-avatar-large" aria-hidden="true" style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', color: '#0284c7', borderColor: '#7dd3fc' }}>
          {supplierInitials}
        </div>

        <div className="profile-hero-info">
          <span className="customer-profile-kicker" style={{ color: '#0284c7', letterSpacing: '0.05em' }}>
            SUPPLIER PROFILE
          </span>
          <div className="hero-name-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="profile-customer-name" style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>
              {supplier.companyName}
            </h1>
            <span className="customer-id-pill" style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}>
              {supplier.id || supplier.supplierId}
            </span>
          </div>

          <p className="profile-company-title" style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
            {supplier.contactPerson ? `Contact: ${supplier.contactPerson}` : 'Authorized Supplier Account'}
            {supplier.city ? ` · ${supplier.city}${supplier.state ? `, ${supplier.state}` : ''}` : ''}
          </p>

          <div className="profile-contact-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
            {supplier.phone && (
              <span className="contact-chip">
                <Phone size={12} style={{ marginRight: '5px', color: '#64748b' }} /> +91 {supplier.phone}
              </span>
            )}
            {supplier.email && (
              <span className="contact-chip">
                <Mail size={12} style={{ marginRight: '5px', color: '#64748b' }} /> {supplier.email}
              </span>
            )}
            {supplier.gstin && (
              <span className="contact-chip" style={{ fontWeight: 700, color: '#1e293b' }}>
                <Receipt size={12} style={{ marginRight: '5px', color: '#2563eb' }} /> GSTIN: {supplier.gstin}
              </span>
            )}
            {supplier.city && (
              <span className="contact-chip">
                <MapPin size={12} style={{ marginRight: '5px', color: '#64748b' }} /> {supplier.city}
              </span>
            )}
          </div>
        </div>

        {/* Top-Right KPI Stats Summary */}
        <div className="profile-stats-summary customer-profile-hero-stats" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div
            className="stat-pill-block"
            onClick={() => setActiveSection('purchaseOrders')}
            style={{ cursor: 'pointer' }}
            title="View purchase orders sent to supplier"
          >
            <span className="num">{metrics.totalOrders}</span>
            <span className="lbl">Total POs</span>
          </div>
          <div
            className="stat-pill-block"
            onClick={() => setActiveSection('allDocuments')}
            style={{ cursor: 'pointer' }}
            title="View all supplier transactions"
          >
            <span className="num">{metrics.allDocuments}</span>
            <span className="lbl">All Documents</span>
          </div>
          <div
            className="stat-pill-block"
            onClick={() => setActiveSection('purchaseOrders')}
            style={{ cursor: 'pointer' }}
            title="View sent purchase orders"
          >
            <span className="num" style={{ color: '#2563eb' }}>{metrics.sentOrders}</span>
            <span className="lbl">Sent (POs)</span>
          </div>
          <div
            className="stat-pill-block"
            onClick={() => setActiveSection('goodsReceipts')}
            style={{ cursor: 'pointer' }}
            title="View goods receipts received"
          >
            <span className="num" style={{ color: '#16a34a' }}>{metrics.totalGrns}</span>
            <span className="lbl">Received (GRNs)</span>
          </div>
          <div
            className="stat-pill-block"
            onClick={() => setActiveSection('purchaseOrders')}
            style={{ cursor: 'pointer' }}
            title="Orders awaiting delivery"
          >
            <span className="num" style={{ color: metrics.pendingDeliveries > 0 ? '#f59e0b' : '#64748b' }}>
              {metrics.pendingDeliveries}
            </span>
            <span className="lbl">Pending</span>
          </div>
          <div
            className="stat-pill-block stat-pill-highlight"
            style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}
            title="Total Procurement Spend"
          >
            <span className="num" style={{ fontSize: '15px', color: '#0f172a' }}>
              {formatCurrency(metrics.totalProcurementValue)}
            </span>
            <span className="lbl">Total Value</span>
          </div>
        </div>
      </section>

      {/* Main Workspace Card */}
      <section className="customer-detail-workspace">
        {/* Navigation Tabs Bar */}
        <nav className="customer-detail-tabs-bar" role="tablist" aria-label="Supplier profile sections">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeSection === tab.key}
              className={`customer-detail-tab-btn ${activeSection === tab.key ? 'active' : ''}`}
              onClick={() => setActiveSection(tab.key)}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className="tab-count-badge">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Tab Panels */}
        <div className="customer-detail-tab-content">
        {/* PANEL 1: ALL DOCUMENTS (Combined Chronological Sent & Received) */}
        {activeSection === 'allDocuments' && (
          <section className="customer-detail-panel" role="tabpanel" aria-label="All Supplier Documents">
            <div className="customer-detail-panel-header">
              <div>
                <h2>Supplier Documents Register</h2>
                <p>Complete chronological register of all sent purchase orders and inward goods receipts.</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div className="crm-table-search-box" style={{ position: 'relative', minWidth: '240px' }}>
                  <Search size={14} className="crm-table-search-icon" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    className="crm-table-search-input"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="Search documents, items, ref..."
                    style={{ paddingLeft: '32px', height: '34px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  {docSearch && (
                    <button
                      type="button"
                      onClick={() => setDocSearch('')}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <label className="customer-filter-control" style={{ display: 'flex', flexDirection: 'column', gap: '2px', margin: 0 }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Flow Type</span>
                  <select
                    value={docTypeFilter}
                    onChange={(e) => setDocTypeFilter(e.target.value)}
                    style={{ height: '34px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12.5px', background: '#ffffff', color: '#1e293b' }}
                  >
                    <option value="ALL">All Documents ({unifiedDocumentsList.length})</option>
                    <option value="SENT">Sent POs ({purchaseOrdersList.length})</option>
                    <option value="RECEIVED">Received GRNs ({goodsReceiptsList.length})</option>
                  </select>
                </label>

                <label className="customer-filter-control" style={{ display: 'flex', flexDirection: 'column', gap: '2px', margin: 0 }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Sort By</span>
                  <select
                    value={docSort}
                    onChange={(e) => setDocSort(e.target.value)}
                    style={{ height: '34px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12.5px', background: '#ffffff', color: '#1e293b' }}
                  >
                    <option value="NEWEST">Newest First</option>
                    <option value="OLDEST">Oldest First</option>
                    <option value="HIGHEST_VALUE">Highest Value</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="crm-table-scroll-wrap">
              {filteredUnifiedDocs.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                  <FileText size={32} style={{ color: '#cbd5e1', marginBottom: '8px' }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>No documents found matching the filter criteria.</p>
                </div>
              ) : (
                <table className="supplier-history-table">
                  <colgroup>
                    <col style={{ width: '4%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '23%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '16%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center' }}>#</th>
                      <th>FLOW / TYPE</th>
                      <th>DOCUMENT #</th>
                      <th>DATE</th>
                      <th>REFERENCE</th>
                      <th>SUMMARY / ITEMS</th>
                      <th style={{ textAlign: 'right' }}>VALUE / QTY</th>
                      <th style={{ textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docPagination.currentItems.map((doc, idx) => {
                      const rowIndex = (docPagination.currentPage - 1) * docPagination.pageSize + idx + 1;
                      const isSent = doc.flow === 'SENT';
                      return (
                        <tr key={`${doc.flow}-${doc.id}`}>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>
                            {rowIndex}
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                background: isSent ? '#eff6ff' : '#f0fdf4',
                                color: isSent ? '#1d4ed8' : '#15803d',
                                border: `1px solid ${isSent ? '#bfdbfe' : '#bbf7d0'}`
                              }}
                            >
                              {isSent ? '↑ SENT (PO)' : '↓ RECEIVED (GRN)'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="product-history-ref-btn"
                              onClick={() => {
                                if (isSent) {
                                  if (onOpenPo) onOpenPo(doc.id);
                                  else navigate(`/purchase-orders/${doc.id}`);
                                } else {
                                  if (onOpenGrn) onOpenGrn(doc.id);
                                  else navigate(`/purchase-orders/${doc.reference}/receive?grn=${doc.id}`);
                                }
                              }}
                              style={{ fontWeight: 700, color: isSent ? '#2563eb' : '#059669', cursor: 'pointer' }}
                            >
                              {doc.docNumber}
                            </button>
                          </td>
                          <td className="cell-nowrap">{formatDate(doc.date)}</td>
                          <td>
                            {doc.reference !== '—' ? (
                              <button
                                type="button"
                                className="product-history-ref-btn"
                                onClick={() => {
                                  if (onOpenPo) onOpenPo(doc.reference);
                                  else navigate(`/purchase-orders/${doc.reference}`);
                                }}
                                style={{ fontSize: '12px', cursor: 'pointer' }}
                              >
                                {doc.reference}
                              </button>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>
                          <td title={doc.summary}>
                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{doc.summary}</div>
                            {isSent ? (
                              <small style={{ color: '#64748b' }}>
                                Progress: {doc.totalReceivedQty} / {doc.totalOrderedQty} items received
                              </small>
                            ) : (
                              <small style={{ color: '#64748b' }}>
                                {doc.challanNumber ? `Challan: ${doc.challanNumber}` : ''}
                                {doc.invoiceNumber ? ` · Inv: ${doc.invoiceNumber}` : ''}
                              </small>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {isSent ? (
                              formatCurrency(doc.totalValue)
                            ) : (
                              <span style={{ color: '#15803d' }}>{doc.receivedUnits} units received</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="table-action-btns">
                              <button
                                type="button"
                                className="table-action-btn"
                                onClick={() => {
                                  if (isSent) {
                                    if (onOpenPo) onOpenPo(doc.id);
                                    else navigate(`/purchase-orders/${doc.id}`);
                                  } else {
                                    if (onOpenGrn) onOpenGrn(doc.id);
                                    else navigate(`/purchase-orders/${doc.reference}/receive?grn=${doc.id}`);
                                  }
                                }}
                                title="View document details"
                              >
                                <Eye size={12} /> View
                              </button>
                              {isSent && (
                                <button
                                  type="button"
                                  className="table-action-btn"
                                  onClick={() => setPreviewPo(doc.raw)}
                                  title="Print Purchase Order"
                                >
                                  <Printer size={12} /> Print
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {filteredUnifiedDocs.length > 0 && (
              <TableFooter
                {...docPagination.footerProps}
                recordLabel="documents"
                singularLabel="document"
              />
            )}
          </section>
        )}

        {/* PANEL 2: SENT (Purchase Orders Register for this supplier) */}
        {activeSection === 'purchaseOrders' && (
          <section className="customer-detail-panel" role="tabpanel" aria-label="Sent Purchase Orders">
            <div className="customer-detail-panel-header">
              <div>
                <h2>Sent Purchase Orders</h2>
                <p>All purchase orders dispatched to this supplier and current inward receipt progress.</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div className="crm-table-search-box" style={{ position: 'relative', minWidth: '220px' }}>
                  <Search size={14} className="crm-table-search-icon" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    className="crm-table-search-input"
                    value={poSearch}
                    onChange={(e) => setPoSearch(e.target.value)}
                    placeholder="Search POs..."
                    style={{ paddingLeft: '32px', height: '34px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  {poSearch && (
                    <button
                      type="button"
                      onClick={() => setPoSearch('')}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <label className="customer-filter-control" style={{ display: 'flex', flexDirection: 'column', gap: '2px', margin: 0 }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Status</span>
                  <select
                    value={poStatusFilter}
                    onChange={(e) => setPoStatusFilter(e.target.value)}
                    style={{ height: '34px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12.5px', background: '#ffffff', color: '#1e293b' }}
                  >
                    <option value="ALL">All Statuses ({purchaseOrdersList.length})</option>
                    <option value="SENT">Sent ({purchaseOrdersList.filter(p => p.status === 'SENT').length})</option>
                    <option value="PARTIALLY_RECEIVED">Partially Received</option>
                    <option value="RECEIVED">Received</option>
                    <option value="DRAFT">Draft</option>
                  </select>
                </label>

                <label className="customer-filter-control" style={{ display: 'flex', flexDirection: 'column', gap: '2px', margin: 0 }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Sort By</span>
                  <select
                    value={poSort}
                    onChange={(e) => setPoSort(e.target.value)}
                    style={{ height: '34px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12.5px', background: '#ffffff', color: '#1e293b' }}
                  >
                    <option value="NEWEST">Newest First</option>
                    <option value="OLDEST">Oldest First</option>
                    <option value="HIGHEST_AMOUNT">Highest Amount</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="crm-table-scroll-wrap">
              {filteredPurchaseOrders.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                  <FileText size={32} style={{ color: '#cbd5e1', marginBottom: '8px' }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>No purchase orders recorded for this supplier.</p>
                </div>
              ) : (
                <table className="supplier-history-table">
                  <colgroup>
                    <col style={{ width: '4%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '21%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '14%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center' }}>#</th>
                      <th>PO NUMBER</th>
                      <th>ORDER DATE</th>
                      <th style={{ textAlign: 'center' }}>ITEMS</th>
                      <th style={{ textAlign: 'right' }}>TOTAL AMOUNT</th>
                      <th>RECEIPT PROGRESS</th>
                      <th style={{ textAlign: 'center' }}>STATUS</th>
                      <th style={{ textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poPagination.currentItems.map((po, idx) => {
                      const rowIndex = (poPagination.currentPage - 1) * poPagination.pageSize + idx + 1;
                      const totalOrd = Number(po.totalOrderedQty || 0);
                      const totalRec = Number(po.totalReceivedQty || 0);
                      const pct = totalOrd > 0 ? Math.min(100, Math.round((totalRec / totalOrd) * 100)) : 0;
                      const items = Array.isArray(po.items) ? po.items : [];
                      const isItemsOpen = openItemsPoId === po.id;
                      const isNearBottom = idx >= poPagination.currentItems.length - 3 && poPagination.currentItems.length > 3;

                      return (
                        <tr key={po.id} className={isItemsOpen ? 'has-open-popover' : ''}>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>
                            {rowIndex}
                          </td>
                          <td className="cell-nowrap">
                            <button
                              type="button"
                              className="product-history-ref-btn"
                              onClick={() => onOpenPo ? onOpenPo(po.id) : navigate(`/purchase-orders/${po.id}`)}
                              style={{ fontWeight: 700, color: '#2563eb', cursor: 'pointer' }}
                            >
                              {po.id}
                            </button>
                          </td>
                          <td className="cell-nowrap">{formatDate(po.orderDate)}</td>
                          <td style={{ textAlign: 'center' }} className="po-items-cell">
                            {items.length === 0 ? (
                              <span style={{ color: '#94a3b8' }}>0</span>
                            ) : (
                              <div className="quotation-items-wrapper po-items-wrapper">
                                <button
                                  type="button"
                                  className={`quotation-items-trigger ${isItemsOpen ? 'active' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenItemsPoId(isItemsOpen ? null : po.id);
                                  }}
                                  aria-expanded={isItemsOpen}
                                  title="Click to view purchase order items"
                                >
                                  <span>{items.length} {items.length === 1 ? 'Item' : 'Items'}</span>
                                  <span className="quotation-items-arrow" aria-hidden="true">{isItemsOpen ? '▴' : '▾'}</span>
                                </button>

                                {isItemsOpen && (
                                  <div
                                    className={`quotation-items-popover po-items-popover ${isNearBottom ? 'placement-top' : ''}`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="quotation-items-popover-header">
                                      <span>{items.length} {items.length === 1 ? 'Item' : 'Items'}</span>
                                      <button
                                        type="button"
                                        className="quotation-items-popover-close"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setOpenItemsPoId(null);
                                        }}
                                      >
                                        ×
                                      </button>
                                    </div>
                                    <ul className="quotation-items-popover-list">
                                      {items.map((it, pIdx) => {
                                        const rawName = String(it.productName || it.name || it.item || 'Item').trim();
                                        const brand = String(it.brandName || it.brand || '').trim();
                                        const displayName = brand && !new RegExp(`[\\-\\–\\—]\\s*${brand.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*$`, 'i').test(rawName)
                                          ? `${rawName} - ${brand}`
                                          : rawName;
                                        return (
                                          <li key={pIdx} className="quotation-items-popover-item">
                                            <span className="popover-item-qty">{it.orderedQty || it.quantity || 1} ×</span>{' '}
                                            <span className="popover-item-name">{displayName}</span>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {formatCurrency(po.grandTotal || po.totalAmount)}
                          </td>
                          <td>
                            <div className="po-table-progress-wrap">
                              <div className="po-table-progress-bar-bg">
                                <div
                                  className="po-table-progress-bar-fill"
                                  style={{
                                    width: `${pct}%`,
                                    background: pct >= 100 ? '#10b981' : pct > 0 ? '#2563eb' : '#cbd5e1'
                                  }}
                                />
                              </div>
                              <span className="po-table-progress-subtext">
                                {totalRec} / {totalOrd} received ({pct}%)
                              </span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`po-status-badge ${String(po.status || 'draft').toLowerCase()}`}>
                              {po.status || 'DRAFT'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="table-action-btns">
                              <button
                                type="button"
                                className="table-action-btn"
                                onClick={() => onOpenPo ? onOpenPo(po.id) : navigate(`/purchase-orders/${po.id}`)}
                                title="View Purchase Order Details"
                              >
                                <Eye size={12} /> View
                              </button>
                              <button
                                type="button"
                                className="table-action-btn"
                                onClick={() => setPreviewPo(po)}
                                title="Print Purchase Order"
                              >
                                <Printer size={12} /> Print
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {filteredPurchaseOrders.length > 0 && (
              <TableFooter
                {...poPagination.footerProps}
                recordLabel="purchase orders"
                singularLabel="purchase order"
              />
            )}
          </section>
        )}

        {/* PANEL 3: RECEIVED (Goods Receipts / GRNs for this supplier) */}
        {activeSection === 'goodsReceipts' && (
          <section className="customer-detail-panel" role="tabpanel" aria-label="Received Goods Receipts">
            <div className="customer-detail-panel-header">
              <div>
                <h2>Received Goods Receipts (GRNs)</h2>
                <p>Inward delivery receipts recorded against orders from this supplier.</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div className="crm-table-search-box" style={{ position: 'relative', minWidth: '220px' }}>
                  <Search size={14} className="crm-table-search-icon" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    className="crm-table-search-input"
                    value={grnSearch}
                    onChange={(e) => setGrnSearch(e.target.value)}
                    placeholder="Search GRNs, Challan, Invoice..."
                    style={{ paddingLeft: '32px', height: '34px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                  {grnSearch && (
                    <button
                      type="button"
                      onClick={() => setGrnSearch('')}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <label className="customer-filter-control" style={{ display: 'flex', flexDirection: 'column', gap: '2px', margin: 0 }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Sort By</span>
                  <select
                    value={grnSort}
                    onChange={(e) => setGrnSort(e.target.value)}
                    style={{ height: '34px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '12.5px', background: '#ffffff', color: '#1e293b' }}
                  >
                    <option value="NEWEST">Newest First</option>
                    <option value="OLDEST">Oldest First</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="crm-table-scroll-wrap">
              {filteredGoodsReceipts.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                  <Truck size={32} style={{ color: '#cbd5e1', marginBottom: '8px' }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>No goods receipt notes recorded for this supplier.</p>
                </div>
              ) : (
                <table className="supplier-history-table">
                  <colgroup>
                    <col style={{ width: '4%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '14%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center' }}>#</th>
                      <th>GRN NUMBER</th>
                      <th>RECEIPT DATE</th>
                      <th>PO REFERENCE</th>
                      <th>CHALLAN #</th>
                      <th>INVOICE #</th>
                      <th>ITEMS RECEIVED</th>
                      <th>RECEIVED BY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grnPagination.currentItems.map((grn, idx) => {
                      const rowIndex = (grnPagination.currentPage - 1) * grnPagination.pageSize + idx + 1;
                      const items = Array.isArray(grn.items) ? grn.items : [];
                      const totalQty = items.reduce((s, it) => s + (Number(it.quantity || it.receiveNow || 0)), 0);
                      const poRef = grn.purchaseOrderId || grn.poNumber;

                      return (
                        <tr key={grn.id}>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>
                            {rowIndex}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="product-history-ref-btn"
                              onClick={() => {
                                if (onOpenGrn) onOpenGrn(grn.id);
                                else if (poRef) navigate(`/purchase-orders/${poRef}/receive?grn=${grn.id}`);
                              }}
                              style={{ fontWeight: 700, color: '#059669', cursor: 'pointer' }}
                            >
                              {grn.id}
                            </button>
                          </td>
                          <td className="cell-nowrap">{formatDate(grn.receivedDate)}</td>
                          <td>
                            {poRef ? (
                              <button
                                type="button"
                                className="product-history-ref-btn"
                                onClick={() => onOpenPo ? onOpenPo(poRef) : navigate(`/purchase-orders/${poRef}`)}
                                style={{ fontWeight: 600, cursor: 'pointer' }}
                              >
                                {poRef}
                              </button>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>
                          <td>{grn.challanNumber || <span style={{ color: '#94a3b8' }}>—</span>}</td>
                          <td>{grn.invoiceNumber || <span style={{ color: '#94a3b8' }}>—</span>}</td>
                          <td>
                            <span style={{ fontWeight: 700, color: '#16a34a' }}>
                              {totalQty} {totalQty === 1 ? 'unit' : 'units'}
                            </span>
                            <small style={{ display: 'block', color: '#64748b' }}>
                              {items.map((i) => i.productName || i.name).filter(Boolean).slice(0, 2).join(', ')}
                              {items.length > 2 ? ` (+${items.length - 2} more)` : ''}
                            </small>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: '#334155' }}>{grn.receivedBy || 'Store Officer'}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {filteredGoodsReceipts.length > 0 && (
              <TableFooter
                {...grnPagination.footerProps}
                recordLabel="goods receipts"
                singularLabel="goods receipt"
              />
            )}
          </section>
        )}

        {/* PANEL 4: SUPPLIER PROFILE & MASTER INFO */}
        {activeSection === 'profile' && (
          <section className="customer-detail-panel" role="tabpanel" aria-label="Supplier Master Profile">
            <div style={{ padding: '24px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '17px', fontWeight: 750, color: '#0f172a' }}>
                Supplier Contact &amp; Master Information
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Company Details</span>
                  <p style={{ margin: '8px 0 4px', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{supplier.companyName}</p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>Supplier Code: <strong>{supplier.id || supplier.supplierId}</strong></p>
                  {supplier.gstin && (
                    <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#1e293b' }}>
                      GSTIN: <strong style={{ color: '#2563eb' }}>{supplier.gstin}</strong>
                    </p>
                  )}
                </div>

                <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Primary Contact</span>
                  <p style={{ margin: '8px 0 4px', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{supplier.contactPerson || '—'}</p>
                  {supplier.phone && <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>Phone: <strong>+91 {supplier.phone}</strong></p>}
                  {supplier.email && <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#475569' }}>Email: <strong>{supplier.email}</strong></p>}
                </div>

                <div style={{ padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Address &amp; Location</span>
                  <p style={{ margin: '8px 0 4px', fontSize: '14px', color: '#1e293b', fontWeight: 600 }}>
                    {supplier.address || 'Address not recorded'}
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                    {[supplier.city, supplier.state, supplier.pincode].filter(Boolean).join(', ') || '—'}
                  </p>
                </div>
              </div>

              {supplier.notes && (
                <div style={{ marginTop: '16px', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#ffffff' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>Procurement Notes</span>
                  <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                    {supplier.notes}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </section>

      {/* Printable Purchase Order Modal for Print / PDF */}
      {previewPo && (
        <DocumentPreviewModal
          title={`Purchase Order — ${previewPo.id}`}
          documentNumber={previewPo.id}
          onClose={() => setPreviewPo(null)}
          onPrint={() => DocumentPrintService.printElement('print-mount-point')}
          onDownloadPdf={() => DocumentPdfService.downloadPurchaseOrder(previewPo.id, getPurchaseOrderFilename(previewPo))}
        >
          <PrintablePurchaseOrder po={previewPo} />
        </DocumentPreviewModal>
      )}
    </div>
  );
}
