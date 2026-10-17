import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch, apiUrl } from '../../api';
import { navigate } from '../../router';
import { formatDate } from '../../utils/dateUtils';
import {
  Truck,
  Plus,
  Search,
  FileText
} from 'lucide-react';
import { TableFooter, useTablePagination } from '../common/TableWorkspace';
import { filterRecordsBySearch } from '../../utils/searchHelper';
import PrintablePurchaseOrder from '../documents/PrintablePurchaseOrder';
import DocumentPreviewModal from '../documents/DocumentPreviewModal';
import './purchaseOrders.css';

export default function SentItemsToSupplierView({ user, onOpenPo, onOpenReceive }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTabFilter, setActiveTabFilter] = useState('DISPATCHED'); // 'DISPATCHED' | 'DRAFT'
  const [selectedPoItems, setSelectedPoItems] = useState(null);
  const [previewPo, setPreviewPo] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const fetchOrders = async () => {
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
      console.error('Error fetching POs:', err);
      setError('Unable to communicate with the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleOpenPdf = async (po) => {
    try {
      const res = await apiFetch(apiUrl(`/api/purchase-orders/${po.id}`));
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setPreviewPo(data.data);
      } else {
        setPreviewPo(po);
      }
    } catch {
      setPreviewPo(po);
    }
  };

  const handleConvertToSent = async (po) => {
    const poLabel = po.poNumber || po.id;
    if (!window.confirm(`Are you sure you want to convert Draft PO "${poLabel}" to Sent?\n\nThis will mark the purchase order as dispatched to supplier.`)) {
      return;
    }
    setActionLoading(po.id);
    try {
      const res = await apiFetch(apiUrl(`/api/purchase-orders/${po.id}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SENT' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: 'success', message: `PO "${poLabel}" converted to Sent successfully.` });
        await fetchOrders();
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback({ type: 'error', message: data.message || 'Failed to convert purchase order.' });
      }
    } catch (err) {
      console.error('Error converting draft PO:', err);
      setFeedback({ type: 'error', message: 'Network error while converting purchase order.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditDraft = (po) => {
    navigate(`/purchase-orders/${po.id}/edit`);
  };

  const handleDeleteDraft = async (po) => {
    const poLabel = po.poNumber || po.id;
    if (!window.confirm(`Are you sure you want to delete Draft Purchase Order "${poLabel}"?\n\nThis action cannot be undone.`)) {
      return;
    }
    setActionLoading(po.id);
    try {
      const res = await apiFetch(apiUrl(`/api/purchase-orders/${po.id}`), {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({ type: 'success', message: `Draft PO "${poLabel}" deleted successfully.` });
        await fetchOrders();
        setTimeout(() => setFeedback(null), 4000);
      } else {
        setFeedback({ type: 'error', message: data.message || 'Failed to delete draft purchase order.' });
      }
    } catch (err) {
      console.error('Error deleting draft PO:', err);
      setFeedback({ type: 'error', message: 'Network error while deleting draft purchase order.' });
    } finally {
      setActionLoading(null);
    }
  };

  // Partitioned PO sets
  const dispatchedOrders = useMemo(() => {
    return orders.filter((po) => {
      const st = String(po.status || '').toUpperCase();
      return st === 'SENT' || st === 'PARTIALLY_RECEIVED';
    });
  }, [orders]);

  const draftOrders = useMemo(() => {
    return orders.filter((po) => {
      const st = String(po.status || '').toUpperCase();
      return st === 'DRAFT';
    });
  }, [orders]);

  // Compute metrics
  const metrics = useMemo(() => {
    let totalSentQty = 0;
    const uniqueSuppliers = new Set();

    dispatchedOrders.forEach((po) => {
      const ord = Number(po.totalOrderedQty || (po.items || []).reduce((s, x) => s + Number(x.orderedQty || 0), 0));
      totalSentQty += ord;
      const sName = po.supplierSnapshot?.companyName || po.supplier?.companyName;
      if (sName) {
        uniqueSuppliers.add(sName);
      }
    });

    return {
      totalSentOrders: dispatchedOrders.length,
      totalDraftOrders: draftOrders.length,
      totalSentQty,
      supplierCount: uniqueSuppliers.size
    };
  }, [dispatchedOrders, draftOrders]);

  // Active dataset based on reactive filter tab
  const activeDataset = activeTabFilter === 'DRAFT' ? draftOrders : dispatchedOrders;

  // Filtered orders with search query
  const filteredOrders = useMemo(() => {
    return filterRecordsBySearch(activeDataset, searchQuery, [
      (po) => po.id,
      (po) => po.poNumber,
      (po) => po.supplierSnapshot?.companyName,
      (po) => po.supplierSnapshot?.contactPerson,
      (po) => po.supplierSnapshot?.phone,
      (po) => po.remarks,
      (po) => po.items?.map((it) => `${it.productName || ''} ${it.productCode || ''} ${it.hsnSac || ''}`)
    ]);
  }, [activeDataset, searchQuery]);

  const pagination = useTablePagination(filteredOrders, {
    rowHeight: 44,
    resetDeps: [searchQuery, activeTabFilter]
  });

  return (
    <div className="po-container purchase-order-page po-sent-items-page crm-enquiry-page-container">
      {/* 1. Page Header */}
      <div className="page-header-row po-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Sent Orders to Supplier</h1>
        <div className="po-header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={() => (onOpenReceive ? onOpenReceive() : navigate('/purchase-orders/receive'))}
          >
            <Truck size={14} /> Receive Goods
          </button>
          <button
            type="button"
            className="crm-btn-primary"
            onClick={() => navigate('/purchase-orders/new')}
          >
            <Plus size={14} /> Create PO
          </button>
        </div>
      </div>

      {/* 2. Compact Reactive Status Strip */}
      <div className="enquiry-status-strip po-status-strip" role="group" aria-label="Purchase orders status summary">
        <button
          type="button"
          className={`enquiry-status-item ${activeTabFilter === 'DISPATCHED' ? 'active' : ''}`}
          onClick={() => setActiveTabFilter('DISPATCHED')}
          title="Filter table to All Dispatched Orders"
        >
          <span>All Dispatched Orders</span>
          <strong>{metrics.totalSentOrders}</strong>
        </button>

        <button
          type="button"
          className={`enquiry-status-item ${activeTabFilter === 'DRAFT' ? 'active draft-active' : ''}`}
          onClick={() => setActiveTabFilter('DRAFT')}
          title="Filter table to Draft Orders"
        >
          <span>Draft Orders</span>
          <strong style={activeTabFilter === 'DRAFT' ? {} : { color: '#d97706' }}>{metrics.totalDraftOrders}</strong>
        </button>

        <button
          type="button"
          className="enquiry-status-item"
          onClick={() => setActiveTabFilter('DISPATCHED')}
          title="Dispatched Units Volume (Click to view sent orders)"
        >
          <span>Total Units Sent</span>
          <strong style={{ color: '#2563eb' }}>{metrics.totalSentQty}</strong>
        </button>

        <button
          type="button"
          className="enquiry-status-item"
          onClick={() => navigate('/purchase-orders/suppliers')}
          title="Click to view Suppliers / Vendors Register"
        >
          <span>Suppliers / Vendors</span>
          <strong style={{ color: '#0f172a' }}>{metrics.supplierCount}</strong>
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`crm-alert-box ${feedback.type}`}
          style={{
            marginBottom: '8px',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            color: feedback.type === 'success' ? '#166534' : '#991b1b'
          }}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Search and Filters Bar */}
      <div className="table-controls-card">
        <div className="search-form-wrap">
          <div className="search-input-box">
            <Search size={16} color="#64748b" />
            <input
              type="text"
              placeholder={activeTabFilter === 'DRAFT' ? "Search Draft POs by number, supplier, or product..." : "Search dispatched orders by PO number, supplier, or product..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input-field"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="button"
            className="search-submit-btn"
            onClick={() => {}}
          >
            Search
          </button>
        </div>
      </div>

      {error && orders.length === 0 && (
        <div className="crm-alert-box error" style={{ marginBottom: '8px' }}>
          <span>{error}</span>
          <button type="button" onClick={fetchOrders} className="crm-btn-secondary compact" style={{ marginLeft: '12px' }}>Retry</button>
        </div>
      )}

      {/* 4. Master Table Workspace Card */}
      <div className="po-list-card settings-table-shell stocks-table-shell crm-table-workspace po-master-card enquiry-master-card">
        <div className="po-table-viewport crm-table-scroll-wrap stocks-table-natural-wrap crm-table-viewport">
          <table className="po-table crm-master-table crm-data-table settings-table enquiry-settings-table po-register-table">
            <colgroup>
              <col style={{ width: '4.5%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '19.5%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="col-index-header" style={{ textAlign: 'center' }}>#</th>
                <th>PO NUMBER</th>
                <th>ORDER DATE</th>
                <th>SUPPLIER / VENDOR</th>
                <th>{activeTabFilter === 'DRAFT' ? 'DRAFT ORDER ITEMS' : 'ITEMS SENT TO SUPPLIER'}</th>
                <th style={{ textAlign: 'center' }}>STATUS</th>
                <th className="actions-col" style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="empty-row">
                  <td colSpan="7">
                    <div className="table-loading-state" style={{ padding: '36px', textAlign: 'center' }}>
                      <div className="crm-spinner" />
                      <p style={{ marginTop: '8px', color: '#64748b', fontSize: '13px' }}>Loading purchase orders...</p>
                    </div>
                  </td>
                </tr>
              ) : pagination.currentRecords.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan="7">
                    <div className="table-empty-state" style={{ padding: '36px', textAlign: 'center' }}>
                      <p style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: '0 0 6px 0' }}>
                        {searchQuery
                          ? `No orders found matching "${searchQuery}".`
                          : activeTabFilter === 'DRAFT'
                            ? 'No draft purchase orders found.'
                            : 'No sent purchase orders found.'}
                      </p>
                      <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                        {searchQuery
                          ? 'Try clearing the search query or changing tabs.'
                          : activeTabFilter === 'DRAFT'
                            ? 'Orders saved as draft before dispatch will appear here.'
                            : 'All dispatched orders will appear here for inbound tracking.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pagination.currentRecords.map((po, index) => {
                  const rowNumber = (pagination.currentPage - 1) * pagination.pageSize + index + 1;
                  const isDraft = String(po.status || '').toUpperCase() === 'DRAFT';
                  const items = Array.isArray(po.items) ? po.items : [];
                  const firstItem = items[0] || {};
                  const firstItemLabel = firstItem.productName || firstItem.productCode || firstItem.description || 'Item';

                  return (
                    <tr key={po.id} className="table-data-row">
                      <td className="col-index-cell" style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                        {rowNumber}
                      </td>
                      <td>
                        <a
                          href={`/purchase-orders/${po.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            if (onOpenPo) onOpenPo(po.id);
                            else navigate(`/purchase-orders/${po.id}`);
                          }}
                          className="enquiry-id-link"
                          title={`View ${po.poNumber || po.id}`}
                        >
                          <span className="master-code enquiry-code-badge">{po.poNumber || po.id}</span>
                        </a>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '13px', color: '#334155' }}>
                        <div style={{ fontWeight: 500, lineHeight: 1.2 }}>{formatDate(po.orderDate)}</div>
                        {po.expectedDeliveryDate && (
                          <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '1px' }}>
                            Exp: {formatDate(po.expectedDeliveryDate)}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '13px' }} title={po.supplierSnapshot?.companyName || 'Supplier'}>
                            {po.supplierSnapshot?.companyName || 'Supplier'}
                          </div>
                          {po.supplierSnapshot?.phone && (
                            <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              Ph: {po.supplierSnapshot.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="po-items-cell">
                        {items.length === 0 ? (
                          <span style={{ color: '#94a3b8' }}>No items</span>
                        ) : items.length === 1 ? (
                          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            <span style={{ fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={firstItemLabel}>
                              {firstItemLabel}
                            </span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                            <span style={{ fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1, minWidth: 0 }} title={firstItemLabel}>
                              {firstItemLabel}
                            </span>
                            <button
                              type="button"
                              className="po-items-trigger"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPoItems(po);
                              }}
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 600,
                                color: '#2563eb',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                borderRadius: '10px',
                                padding: '1px 6px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                              title="Click to view all items in this order"
                            >
                              +{items.length - 1} more ▾
                            </button>
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', padding: '0 6px' }}>
                        {isDraft ? (
                          <span
                            className="status-badge"
                            style={{
                              fontSize: '10.5px',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              display: 'inline-block',
                              background: '#fffbeb',
                              color: '#b45309',
                              border: '1px solid #fde68a'
                            }}
                          >
                            DRAFT
                          </span>
                        ) : (
                          <span
                            className="status-badge"
                            style={{
                              fontSize: '10.5px',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              display: 'inline-block',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe'
                            }}
                          >
                            SENT TO VENDOR
                          </span>
                        )}
                      </td>
                      <td className="actions-col" style={{ textAlign: 'right', paddingLeft: '4px', paddingRight: '12px' }}>
                        {isDraft ? (
                          <div className="settings-row-actions" style={{ justifyContent: 'flex-end', gap: '5px' }}>
                            <button
                              type="button"
                              className="settings-row-action enquiry-action-btn"
                              style={{
                                background: '#16a34a',
                                color: '#ffffff',
                                borderColor: '#15803d',
                                fontWeight: 600,
                                padding: '0 8px',
                                height: '24px',
                                fontSize: '11px',
                                whiteSpace: 'nowrap'
                              }}
                              disabled={actionLoading === po.id}
                              onClick={() => handleConvertToSent(po)}
                              title="Convert Draft to Sent (Dispatched to Supplier)"
                            >
                              {actionLoading === po.id ? 'Sending...' : 'Convert to Sent'}
                            </button>
                            <button
                              type="button"
                              className="settings-row-action enquiry-action-btn"
                              onClick={() => handleEditDraft(po)}
                              title="Edit Draft Purchase Order"
                              style={{ height: '24px', padding: '0 8px', fontSize: '11px', fontWeight: 500 }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="settings-row-action enquiry-action-btn"
                              disabled={actionLoading === po.id}
                              onClick={() => handleDeleteDraft(po)}
                              title="Delete Draft Purchase Order"
                              style={{
                                height: '24px',
                                padding: '0 8px',
                                fontSize: '11px',
                                fontWeight: 500,
                                color: '#dc2626',
                                borderColor: '#fca5a5',
                                background: '#fef2f2'
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <div className="settings-row-actions" style={{ justifyContent: 'flex-end', gap: '5px' }}>
                            <button
                              type="button"
                              className="settings-row-action enquiry-action-btn"
                              style={{ background: '#2563eb', color: '#ffffff', borderColor: '#1d4ed8', fontWeight: 600, padding: '0 7px', height: '24px' }}
                              onClick={() => (onOpenReceive ? onOpenReceive(po.id) : navigate(`/purchase-orders/${po.id}/receive`))}
                              title="Receive Goods"
                            >
                              Receive
                            </button>
                            <button
                              type="button"
                              className="settings-row-action enquiry-action-btn"
                              onClick={() => handleOpenPdf(po)}
                              title="View Vendor Purchase Order PDF (No Prices)"
                              style={{ height: '24px', display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '0 7px', fontWeight: 500 }}
                            >
                              <FileText size={11} /> PDF
                            </button>
                            <button
                              type="button"
                              className="settings-row-action enquiry-action-btn"
                              onClick={() => (onOpenPo ? onOpenPo(po.id) : navigate(`/purchase-orders/${po.id}`))}
                              title="View PO Details"
                              style={{ height: '24px', padding: '0 7px' }}
                            >
                              View
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
              {!loading && pagination.currentRecords.length > 0 && pagination.currentRecords.length < pagination.pageSize && (
                Array.from({ length: pagination.pageSize - pagination.currentRecords.length }).map((_, fIdx) => (
                  <tr key={`filler-${fIdx}`} className="table-data-row table-filler-row" aria-hidden="true">
                    <td className="col-index-cell">&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td className="actions-col">&nbsp;</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TableFooter
          showingStart={pagination.showingStart}
          showingEnd={pagination.showingEnd}
          total={pagination.totalRecords}
          recordLabel={activeTabFilter === 'DRAFT' ? 'draft orders' : 'sent orders'}
          singularLabel={activeTabFilter === 'DRAFT' ? 'draft order' : 'sent order'}
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={pagination.goToPage}
        />
      </div>

      {/* 5. Item Breakdown Modal */}
      {selectedPoItems && (
        <div
          className="crm-modal-backdrop"
          role="presentation"
          onClick={() => setSelectedPoItems(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            className="crm-modal-card"
            style={{
              maxWidth: '620px',
              width: '90%',
              background: '#ffffff',
              borderRadius: '8px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                  Items in PO: {selectedPoItems.poNumber || selectedPoItems.id}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Supplier: <strong>{selectedPoItems.supplierSnapshot?.companyName || 'Supplier'}</strong> | Date: {formatDate(selectedPoItems.orderDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPoItems(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '16px 18px', maxHeight: '55vh', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left', color: '#475569', fontSize: '11.5px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '8px 10px' }}>Product</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>HSN/SAC</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Unit</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedPoItems.items || []).map((it, idx) => {
                    const ord = Number(it.orderedQty || 0);
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px' }}>
                          <strong style={{ color: '#0f172a' }}>{it.productName || it.productCode}</strong>
                          {it.productCode && <div style={{ fontSize: '11px', color: '#64748b' }}>{it.productCode}</div>}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center', fontFamily: 'monospace' }}>{it.hsnSac || '—'}</td>
                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 600 }}>{it.unit || 'Nos'}</td>
                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700, color: '#1e293b' }}>{ord}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px', background: '#f8fafc' }}>
              <button
                type="button"
                className="crm-btn-secondary"
                onClick={() => setSelectedPoItems(null)}
                style={{ fontSize: '12px', padding: '5px 12px' }}
              >
                Close
              </button>
              {String(selectedPoItems.status || '').toUpperCase() !== 'DRAFT' && (
                <button
                  type="button"
                  className="crm-btn-primary"
                  onClick={() => {
                    const id = selectedPoItems.id;
                    setSelectedPoItems(null);
                    if (onOpenReceive) onOpenReceive(id);
                    else navigate(`/purchase-orders/${id}/receive`);
                  }}
                  style={{ fontSize: '12px', padding: '5px 12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Truck size={13} /> Receive Goods
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. Vendor PO PDF Preview Modal (Prices Hidden) */}
      {previewPo && (
        <DocumentPreviewModal
          title="Purchase Order (Vendor Copy)"
          docId={previewPo.poNumber || previewPo.id}
          docType="po"
          status={previewPo.status}
          filename={`PurchaseOrder_Vendor_${previewPo.poNumber || previewPo.id}.pdf`}
          data={previewPo}
          onClose={() => setPreviewPo(null)}
        >
          <PrintablePurchaseOrder purchaseOrder={previewPo} hidePrices={true} />
        </DocumentPreviewModal>
      )}
    </div>
  );
}
