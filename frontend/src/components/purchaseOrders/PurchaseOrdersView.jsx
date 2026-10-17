import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch, apiUrl } from '../../api';
import { navigate } from '../../router';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Eye,
  Truck,
  Printer,
  FileDown,
  Edit,
  Send
} from 'lucide-react';
import PrintablePurchaseOrder from '../documents/PrintablePurchaseOrder';
import DocumentPreviewModal from '../documents/DocumentPreviewModal';
import DocumentPrintService from '../documents/DocumentPrintService';
import DocumentPdfService, { getPurchaseOrderFilename } from '../documents/DocumentPdfService';
import { TableFooter, useTablePagination } from '../common/TableWorkspace';
import { filterRecordsBySearch } from '../../utils/searchHelper';
import './purchaseOrders.css';

const PO_SEARCH_EXTRACTORS = [
  (po) => po.id,
  (po) => po.poNumber,
  (po) => po.supplierSnapshot?.companyName,
  (po) => po.supplierSnapshot?.contactPerson,
  (po) => po.supplierSnapshot?.email,
  (po) => po.supplierSnapshot?.phone,
  (po) => po.supplierSnapshot?.gstin,
  (po) => po.remarks,
  (po) => po.status,
  (po) => po.items?.map((it) => `${it.productName || ''} ${it.productCode || it.sku || ''} ${it.description || ''}`)
];

export default function PurchaseOrdersView({ user, onNavigateCreate, onOpenPo, onOpenReceive }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [openItemsPoId, setOpenItemsPoId] = useState(null);

  useEffect(() => {
    setOpenItemsPoId(null);
  }, [searchQuery, activeTab]);

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

  // Document preview / print / PDF modal state
  const [previewPo, setPreviewPo] = useState(null);

  const fetchPurchaseOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(apiUrl('/api/purchase-orders'));
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data)) {
        setOrders(data.data);
      } else {
        setError(data.message || 'Failed to load purchase orders.');
      }
    } catch (err) {
      console.error('Error fetching purchase orders:', err);
      setError('Unable to communicate with the server.');
    } finally {
      setLoading(false);
    }
  };

  const [actionLoadingId, setActionLoadingId] = useState(null);

  const handleSendPo = async (poId) => {
    if (!window.confirm(`Are you sure you want to mark Purchase Order ${poId} as SENT to supplier?`)) return;
    setActionLoadingId(poId);
    try {
      const res = await apiFetch(apiUrl(`/api/purchase-orders/${poId}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SENT' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchPurchaseOrders();
      } else {
        alert(data.message || 'Failed to update PO status');
      }
    } catch (err) {
      console.error('Error sending PO:', err);
      alert('Failed to communicate with server');
    } finally {
      setActionLoadingId(null);
    }
  };

  useEffect(() => {
    fetchPurchaseOrders();
  }, []);

  // Metrics computation
  const metrics = useMemo(() => {
    let total = orders.length;
    let pending = 0;
    let partiallyReceived = 0;
    let completed = 0;

    orders.forEach((po) => {
      const st = String(po.status || '').toUpperCase();
      if (st === 'SENT') pending++;
      else if (st === 'PARTIALLY_RECEIVED') partiallyReceived++;
      else if (st === 'RECEIVED') completed++;
    });

    return { total, pending, partiallyReceived, completed };
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    let list = [...orders];

    if (activeTab !== 'ALL') {
      if (activeTab === 'PENDING') {
        list = list.filter((po) => {
          const st = String(po.status || '').toUpperCase();
          return st === 'SENT' || st === 'PENDING';
        });
      } else {
        list = list.filter((po) => String(po.status || '').toUpperCase() === activeTab);
      }
    }

    return filterRecordsBySearch(list, searchQuery, PO_SEARCH_EXTRACTORS);
  }, [orders, activeTab, searchQuery]);

  const pagination = useTablePagination(filteredOrders, {
    rowHeight: 45,
    resetDeps: [searchQuery, activeTab]
  });

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Number(amt || 0));
  };

  const handlePrint = (po) => {
    DocumentPrintService.printElement(`printable-po-${po.id}`, `PurchaseOrder_${po.id}`);
  };

  const handlePdf = (po) => {
    DocumentPdfService.generatePdf(`printable-po-${po.id}`, getPurchaseOrderFilename(po));
  };

  return (
    <div className="po-container purchase-order-page po-overview-page">
      {/* Page Header: Compact Horizontal Layout */}
      <div className="po-header">
        <h1>Purchase Orders</h1>
        <div className="po-header-actions">
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={() => (onOpenReceive ? onOpenReceive() : navigate('/purchase-orders/receive'))}
          >
            <Truck size={15} /> Receive Goods
          </button>
          <button
            type="button"
            className="crm-btn-primary"
            onClick={() => (onNavigateCreate ? onNavigateCreate() : navigate('/purchase-orders/new'))}
          >
            <Plus size={15} /> Create Purchase Order
          </button>
        </div>
      </div>

      {/* Reactive Filterable KPI Cards */}
      <div className="po-metrics-grid">
        <div
          className={`po-metric-card ${activeTab === 'ALL' ? 'active' : ''}`}
          onClick={() => setActiveTab('ALL')}
          data-kpi="all"
          title="Filter: Show all purchase orders"
          role="button"
          tabIndex={0}
        >
          <div className="po-metric-icon blue">
            <FileText size={20} />
          </div>
          <div className="po-metric-info">
            <span className="po-metric-label">Total Orders</span>
            <span className="po-metric-value">{metrics.total}</span>
          </div>
        </div>

        <div
          className={`po-metric-card ${(activeTab === 'PENDING' || activeTab === 'SENT') ? 'active' : ''}`}
          onClick={() => setActiveTab('PENDING')}
          data-kpi="pending"
          title="Filter: Show orders with pending deliveries"
          role="button"
          tabIndex={0}
        >
          <div className="po-metric-icon amber">
            <Clock size={20} />
          </div>
          <div className="po-metric-info">
            <span className="po-metric-label">Pending Deliveries</span>
            <span className="po-metric-value">{metrics.pending}</span>
          </div>
        </div>

        <div
          className={`po-metric-card ${activeTab === 'PARTIALLY_RECEIVED' ? 'active' : ''}`}
          onClick={() => setActiveTab('PARTIALLY_RECEIVED')}
          data-kpi="partially_received"
          title="Filter: Show partially received orders"
          role="button"
          tabIndex={0}
        >
          <div className="po-metric-icon purple">
            <AlertCircle size={20} />
          </div>
          <div className="po-metric-info">
            <span className="po-metric-label">Partially Received</span>
            <span className="po-metric-value">{metrics.partiallyReceived}</span>
          </div>
        </div>

        <div
          className={`po-metric-card ${activeTab === 'RECEIVED' ? 'active' : ''}`}
          onClick={() => setActiveTab('RECEIVED')}
          data-kpi="received"
          title="Filter: Show fully received orders"
          role="button"
          tabIndex={0}
        >
          <div className="po-metric-icon emerald">
            <CheckCircle2 size={20} />
          </div>
          <div className="po-metric-info">
            <span className="po-metric-label">Fully Received</span>
            <span className="po-metric-value">{metrics.completed}</span>
          </div>
        </div>
      </div>

      {/* Purchase Order List Card / Section (One Coherent Section) */}
      <div className="po-list-card crm-table-workspace">
        {/* Toolbar: Status Filter Tabs & Search */}
        <div className="po-toolbar crm-table-toolbar">
          <div className="po-tabs">
            {[
              ['ALL', 'All Orders'],
              ['DRAFT', 'Draft'],
              ['SENT', 'Sent'],
              ['PENDING', 'Pending Deliveries'],
              ['PARTIALLY_RECEIVED', 'Partially Received'],
              ['RECEIVED', 'Received'],
              ['CANCELLED', 'Cancelled']
            ].map(([tabKey, tabLabel]) => (
              <button
                key={tabKey}
                type="button"
                className={`po-tab ${activeTab === tabKey ? 'active' : ''}`}
                onClick={() => setActiveTab(tabKey)}
              >
                {tabLabel}
              </button>
            ))}
          </div>

          <div className="po-search-box crm-table-search-box" style={{ position: 'relative' }}>
            <Search size={15} className="po-search-icon crm-table-search-icon" />
            <input
              type="text"
              className="po-search-input crm-table-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by PO #, supplier, or product..."
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Content-driven Table Container */}
        <div className="po-table-viewport po-table-container crm-table-scroll-wrap">
          <table className="po-table crm-master-table">
            <colgroup>
              <col style={{ width: '9%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '23%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>PO NUMBER</th>
                <th>ORDER DATE</th>
                <th>SUPPLIER</th>
                <th style={{ textAlign: 'center' }}>ITEMS</th>
                <th style={{ textAlign: 'right' }}>TOTAL AMOUNT</th>
                <th>RECEIPT PROGRESS</th>
                <th style={{ textAlign: 'center' }}>STATUS</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="empty-row">
                  <td colSpan="8">
                    <div className="po-loading-state" style={{ padding: '36px', textAlign: 'center' }}>
                      <div className="crm-spinner" />
                      <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Loading Purchase Orders...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr className="empty-row">
                  <td colSpan="8">
                    <div className="po-error-state" style={{ padding: '36px', textAlign: 'center' }}>
                      <p style={{ margin: 0, color: '#dc2626', fontSize: '13px' }}>{error}</p>
                      <button type="button" className="crm-btn-secondary" onClick={fetchPurchaseOrders} style={{ marginTop: '8px' }}>
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan="8">
                    <div className="po-empty-state" style={{ padding: '36px', textAlign: 'center' }}>
                      <p className="po-empty-title" style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: '0 0 6px 0' }}>
                        {searchQuery.trim() ? `No purchase orders found matching "${searchQuery.trim()}".` : 'No purchase orders found.'}
                      </p>
                      <p className="po-empty-desc" style={{ fontSize: '13px', color: '#64748b', margin: '0 0 14px 0' }}>
                        {searchQuery.trim() ? 'Try adjusting your search query or clear the filter.' : 'Create a purchase order to start inward procurement.'}
                      </p>
                      {!searchQuery && (
                        <button
                          type="button"
                          className="crm-btn-primary"
                          onClick={() => (onNavigateCreate ? onNavigateCreate() : navigate('/purchase-orders/new'))}
                        >
                          <Plus size={15} /> Create Purchase Order
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {pagination.currentItems.map((po, idx) => {
                  const totalOrd = Number(po.totalOrderedQty || 0);
                  const totalRec = Number(po.totalReceivedQty || 0);
                  const pct = totalOrd > 0 ? Math.min(100, Math.round((totalRec / totalOrd) * 100)) : 0;
                  const statusClass = String(po.status || 'draft').toLowerCase();
                  const hasPendingToReceive = (po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED') && (totalOrd > totalRec);
                  const items = Array.isArray(po.items) ? po.items : [];
                  const rowKey = po.id;
                  const isItemsOpen = openItemsPoId === rowKey;
                  const isNearBottom = idx >= pagination.currentItems.length - 3 && pagination.currentItems.length > 3;

                  return (
                    <tr key={po.id} className={`table-data-row ${isItemsOpen ? 'has-open-popover' : ''}`}>
                      <td className="cell-nowrap">
                        <a
                          href={`/purchase-orders/${po.id}`}
                          className="product-history-ref-btn po-number-link"
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                              e.preventDefault();
                              if (onOpenPo) onOpenPo(po.id);
                              else navigate(`/purchase-orders/${po.id}`);
                            }
                          }}
                          style={{ fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}
                        >
                          {po.id}
                        </a>
                      </td>
                      <td className="cell-nowrap">{formatDate(po.orderDate)}</td>
                      <td className="po-col-supplier" title={po.supplierSnapshot?.companyName || ''}>
                        <div className="po-supplier-cell">
                          <a
                            href={`/purchase-orders/suppliers/${encodeURIComponent(po.supplierId || po.supplierSnapshot?.id || po.supplierSnapshot?.companyName)}`}
                            className="po-supplier-name po-supplier-link"
                            onClick={(e) => {
                              if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                                e.preventDefault();
                                navigate(`/purchase-orders/suppliers/${encodeURIComponent(po.supplierId || po.supplierSnapshot?.id || po.supplierSnapshot?.companyName)}`);
                              }
                            }}
                            style={{ fontWeight: 600, color: '#1d4ed8', textDecoration: 'none', cursor: 'pointer', display: 'inline-block' }}
                            title={`View history for ${po.supplierSnapshot?.companyName || 'Supplier'}`}
                          >
                            {po.supplierSnapshot?.companyName || 'Supplier'}
                          </a>
                          {po.supplierSnapshot?.contactPerson && (
                            <div className="po-supplier-attn">
                              Attn: {po.supplierSnapshot.contactPerson}
                            </div>
                          )}
                        </div>
                      </td>
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
                                setOpenItemsPoId(isItemsOpen ? null : rowKey);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setOpenItemsPoId(isItemsOpen ? null : rowKey);
                                }
                              }}
                              aria-expanded={isItemsOpen}
                              aria-haspopup="true"
                              title="Click to view purchase order items"
                            >
                              <span>{items.length} {items.length === 1 ? 'Item' : 'Items'}</span>
                              <span className="quotation-items-arrow" aria-hidden="true">{isItemsOpen ? '▴' : '▾'}</span>
                            </button>

                            {isItemsOpen && (
                              <div
                                className={`quotation-items-popover po-items-popover ${isNearBottom ? 'placement-top' : ''}`}
                                role="dialog"
                                aria-label="Purchase order items"
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
                                    aria-label="Close"
                                    title="Close"
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
                      <td style={{ textAlign: 'right' }} className="cell-nowrap">
                        <strong>{formatCurrency(po.grandTotal)}</strong>
                      </td>
                      <td className="po-col-progress">
                        <div className="po-progress-cell">
                          <div className="po-progress-bar">
                            <div
                              className={`po-progress-fill ${pct === 100 ? 'complete' : ''}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="po-progress-text">
                            {totalRec} / {totalOrd} received ({pct}%)
                          </span>
                        </div>
                      </td>
                      <td className="po-col-status cell-nowrap" style={{ textAlign: 'center' }}>
                        <span className={`po-status-badge ${statusClass}`}>
                          {String(po.status || 'DRAFT').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="po-col-actions" style={{ textAlign: 'right' }}>
                        <div className="po-actions" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="po-btn-icon"
                            onClick={() => (onOpenPo ? onOpenPo(po.id) : navigate(`/purchase-orders/${po.id}`))}
                            title="View PO Details"
                          >
                            <Eye size={13} /> View
                          </button>
                          {po.status === 'DRAFT' && (
                            <>
                              <button
                                type="button"
                                className="po-btn-icon"
                                onClick={() => navigate(`/purchase-orders/${po.id}/edit`)}
                                title="Edit Draft Purchase Order"
                              >
                                <Edit size={13} /> Edit
                              </button>
                              <button
                                type="button"
                                className="po-btn-icon primary"
                                onClick={() => handleSendPo(po.id)}
                                disabled={actionLoadingId === po.id}
                                title="Send Purchase Order to Supplier"
                              >
                                <Send size={13} /> {actionLoadingId === po.id ? 'Sending…' : 'Send'}
                              </button>
                            </>
                          )}
                          {hasPendingToReceive && (
                            <button
                              type="button"
                              className="po-btn-icon primary"
                              onClick={() => (onOpenReceive ? onOpenReceive(po.id) : navigate(`/purchase-orders/${po.id}/receive`))}
                              title="Receive Goods"
                            >
                              <Truck size={13} /> Receive
                            </button>
                          )}
                          <button
                            type="button"
                            className="po-btn-icon"
                            onClick={() => setPreviewPo(po)}
                            title="Print / PDF Document"
                          >
                            <Printer size={13} /> Print
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!loading && !error && filteredOrders.length > 0 && pagination.currentItems.length < pagination.pageSize && (
                  Array.from({ length: pagination.pageSize - pagination.currentItems.length }).map((_, fIdx) => (
                    <tr key={`filler-${fIdx}`} className="table-data-row table-filler-row" aria-hidden="true">
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td style={{ textAlign: 'center' }}>&nbsp;</td>
                      <td style={{ textAlign: 'right' }}>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td style={{ textAlign: 'center' }}>&nbsp;</td>
                      <td style={{ textAlign: 'right' }}>&nbsp;</td>
                    </tr>
                  ))
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: Standardized TableFooter */}
      {!loading && !error && (
        <TableFooter
          {...pagination.footerProps}
          recordLabel="purchase orders"
          singularLabel="purchase order"
        />
      )}
    </div>

      {/* Document Print & PDF Preview Modal */}
      {previewPo && (
        <DocumentPreviewModal
          title="Purchase Order"
          docId={previewPo.id || previewPo.poNumber}
          docType="po"
          status={previewPo.status}
          filename={getPurchaseOrderFilename(previewPo)}
          data={previewPo}
          onClose={() => setPreviewPo(null)}
        >
          <PrintablePurchaseOrder purchaseOrder={previewPo} />
        </DocumentPreviewModal>
      )}
    </div>
  );
}
