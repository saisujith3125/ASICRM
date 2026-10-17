import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch, apiUrl } from '../../api';
import { navigate } from '../../router';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import {
  FileText,
  Clock,
  CheckCircle2,
  Truck,
  Eye,
  Search,
  PackageCheck,
  Printer,
  FileDown,
  Plus
} from 'lucide-react';
import PrintablePurchaseOrder from '../documents/PrintablePurchaseOrder';
import DocumentPrintService from '../documents/DocumentPrintService';
import DocumentPdfService, { getPurchaseOrderFilename } from '../documents/DocumentPdfService';
import { TableFooter, useTablePagination } from '../common/TableWorkspace';
import { filterRecordsBySearch } from '../../utils/searchHelper';
import './purchaseOrders.css';

export default function PurchaseOrderHistory({ user, onOpenPo }) {
  const [activeTab, setActiveTab] = useState('POs'); // 'POs' or 'GRNs'
  const [orders, setOrders] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [openItemsPoId, setOpenItemsPoId] = useState(null);
  const [previewPo, setPreviewPo] = useState(null);

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

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      setLoading(true);
      try {
        const [poRes, grnRes] = await Promise.all([
          apiFetch(apiUrl('/api/purchase-orders')),
          apiFetch(apiUrl('/api/goods-receipts'))
        ]);
        const poData = poRes.ok ? await poRes.json() : { success: false, data: [] };
        const grnData = grnRes.ok ? await grnRes.json() : { success: false, data: [] };

        if (active) {
          if (poRes.ok && poData.success && Array.isArray(poData.data)) {
            setOrders(poData.data);
          }
          if (grnRes.ok && grnData.success && Array.isArray(grnData.data)) {
            setReceipts(grnData.data);
          }
        }
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadHistory();
    return () => {
      active = false;
    };
  }, []);

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Number(amt || 0));
  };

  const filteredOrders = useMemo(() => {
    return filterRecordsBySearch(orders, searchQuery, [
      (p) => p.id,
      (p) => p.poNumber,
      (p) => p.supplierSnapshot?.companyName,
      (p) => p.supplierSnapshot?.contactPerson,
      (p) => p.status,
      (p) => p.remarks,
      (p) => p.items?.map((it) => `${it.productName || ''} ${it.productCode || it.sku || ''}`)
    ]);
  }, [orders, searchQuery]);

  const filteredReceipts = useMemo(() => {
    return filterRecordsBySearch(receipts, searchQuery, [
      (g) => g.id,
      (g) => g.purchaseOrderId,
      (g) => g.poId,
      (g) => g.supplierName,
      (g) => g.supplierSnapshot?.companyName,
      (g) => g.challanNumber,
      (g) => g.invoiceNumber,
      (g) => g.receivedBy,
      (g) => g.remarks,
      (g) => g.items?.map((it) => `${it.productName || ''} ${it.productCode || it.sku || ''} ${(it.serialNumbers || []).join(' ')}`)
    ]);
  }, [receipts, searchQuery]);

  const activeList = useMemo(() => {
    return activeTab === 'POs' ? filteredOrders : filteredReceipts;
  }, [activeTab, filteredOrders, filteredReceipts]);

  const pagination = useTablePagination(activeList, {
    rowHeight: 45,
    resetDeps: [searchQuery, activeTab]
  });

  return (
    <div className="po-container purchase-order-page po-history-page">
      <div className="po-header">
        <h1 style={{ margin: 0 }}>Purchase Orders &amp; Receipts History</h1>
        <div className="po-header-actions">
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={() => navigate('/purchase-orders/receive')}
          >
            <Truck size={15} /> Receive Goods
          </button>
          <button
            type="button"
            className="crm-btn-primary"
            onClick={() => navigate('/purchase-orders/new')}
          >
            <Plus size={15} /> Create Purchase Order
          </button>
        </div>
      </div>

      <div className="po-list-card crm-table-workspace">
        {/* Toolbar */}
        <div className="po-toolbar crm-table-toolbar">
          <div className="po-tabs">
            <button
              type="button"
              className={`po-tab ${activeTab === 'POs' ? 'active' : ''}`}
              onClick={() => setActiveTab('POs')}
            >
              Purchase Orders Register ({orders.length})
            </button>
            <button
              type="button"
              className={`po-tab ${activeTab === 'GRNs' ? 'active' : ''}`}
              onClick={() => setActiveTab('GRNs')}
            >
              Goods Receipts / GRNs ({receipts.length})
            </button>
            <button
              type="button"
              className="po-tab"
              onClick={() => navigate('/purchase-orders/suppliers')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              Suppliers
            </button>
          </div>

          <div className="po-search-box crm-table-search-box" style={{ position: 'relative' }}>
            <Search size={15} className="po-search-icon crm-table-search-icon" />
            <input
              type="text"
              className="po-search-input crm-table-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'POs' ? 'Search POs...' : 'Search GRNs, PO #, or Supplier...'}
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

        <div className="po-table-viewport po-table-container crm-table-scroll-wrap">
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
              <div className="crm-spinner" />
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Loading historical data...</p>
            </div>
          ) : activeTab === 'POs' ? (
            filteredOrders.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                {searchQuery.trim() ? `No purchase orders found matching "${searchQuery.trim()}".` : 'No purchase orders recorded in history.'}
              </div>
            ) : (
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
                  {pagination.currentItems.map((po, idx) => {
                    const totalOrd = Number(po.totalOrderedQty || 0);
                    const totalRec = Number(po.totalReceivedQty || 0);
                    const pct = totalOrd > 0 ? Math.min(100, Math.round((totalRec / totalOrd) * 100)) : 0;
                    const items = Array.isArray(po.items) ? po.items : [];
                    const rowKey = po.id;
                    const isItemsOpen = openItemsPoId === rowKey;
                    const isNearBottom = idx >= pagination.currentItems.length - 3 && pagination.currentItems.length > 3;

                    return (
                      <tr key={po.id} className={`table-data-row ${isItemsOpen ? 'has-open-popover' : ''}`}>
                        <td className="cell-nowrap">
                          <button
                            type="button"
                            className="product-history-ref-btn"
                            onClick={() => (onOpenPo ? onOpenPo(po.id) : navigate(`/purchase-orders/${po.id}`))}
                            style={{ fontWeight: 700 }}
                          >
                            {po.id}
                          </button>
                        </td>
                        <td className="cell-nowrap">{formatDate(po.orderDate)}</td>
                        <td className="po-col-supplier" title={po.supplierSnapshot?.companyName || 'Supplier'}>
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
                          <span className={`po-status-badge ${String(po.status || 'draft').toLowerCase()}`}>
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
                  {activeList.length > 0 && pagination.currentItems.length < pagination.pageSize && (
                    Array.from({ length: pagination.pageSize - pagination.currentItems.length }).map((_, fIdx) => (
                      <tr key={`filler-po-${fIdx}`} className="table-data-row table-filler-row" aria-hidden="true">
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
                </tbody>
              </table>
            )
          ) : (
            filteredReceipts.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                {searchQuery.trim() ? `No goods receipts found matching "${searchQuery.trim()}".` : 'No Goods Receipts recorded yet.'}
              </div>
            ) : (
              <table className="po-table crm-master-table">
                <colgroup>
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '23%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '14%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>GRN NUMBER</th>
                    <th>RECEIPT DATE</th>
                    <th>LINKED PO</th>
                    <th>SUPPLIER</th>
                    <th style={{ textAlign: 'right' }}>RECEIVED QTY</th>
                    <th>RECEIVED BY</th>
                    <th style={{ textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {pagination.currentItems.map((grn) => (
                    <tr key={grn.id} className="table-data-row">
                      <td className="cell-nowrap">
                        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace', fontWeight: 700, color: '#059669', fontSize: '13px' }}>
                          {grn.id}
                        </span>
                      </td>
                      <td className="cell-nowrap">{formatDate(grn.receivedDate)}</td>
                      <td className="cell-nowrap">
                        <button
                          type="button"
                          className="product-history-ref-btn"
                          onClick={() => navigate(`/purchase-orders/${grn.purchaseOrderId}`)}
                        >
                          {grn.purchaseOrderId}
                        </button>
                      </td>
                      <td>
                        <a
                          href={`/purchase-orders/suppliers/${encodeURIComponent(grn.supplierId || grn.supplierName)}`}
                          className="po-supplier-link"
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                              e.preventDefault();
                              navigate(`/purchase-orders/suppliers/${encodeURIComponent(grn.supplierId || grn.supplierName)}`);
                            }
                          }}
                          style={{ fontWeight: 600, color: '#1d4ed8', textDecoration: 'none', cursor: 'pointer' }}
                          title={`View history for ${grn.supplierName || 'Supplier'}`}
                        >
                          {grn.supplierName}
                        </a>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                        +{grn.totalReceivedQty || 0}
                      </td>
                      <td>{grn.receivedBy || 'Store Officer'}</td>
                      <td className="po-col-actions" style={{ textAlign: 'right' }}>
                        <div className="po-actions" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="po-btn-icon"
                            onClick={() => navigate(`/purchase-orders/${grn.purchaseOrderId}`)}
                          >
                            <Eye size={13} /> View PO
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {activeList.length > 0 && pagination.currentItems.length < pagination.pageSize && (
                    Array.from({ length: pagination.pageSize - pagination.currentItems.length }).map((_, fIdx) => (
                      <tr key={`filler-grn-${fIdx}`} className="table-data-row table-filler-row" aria-hidden="true">
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td style={{ textAlign: 'right' }}>&nbsp;</td>
                        <td>&nbsp;</td>
                        <td style={{ textAlign: 'right' }}>&nbsp;</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )
          )}
        </div>

        {/* Footer: Standardized TableFooter */}
        {!loading && activeList.length > 0 && (
          <TableFooter
            {...pagination.footerProps}
            recordLabel={activeTab === 'POs' ? 'purchase orders' : 'goods receipts'}
            singularLabel={activeTab === 'POs' ? 'purchase order' : 'goods receipt'}
          />
        )}
      </div>

      {previewPo && (
        <div className="crm-modal-backdrop" style={{ zIndex: 99999 }}>
          <div className="crm-modal" style={{ maxWidth: '900px', width: '95%', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="crm-modal-header">
              <h3 style={{ margin: 0 }}>Document — {previewPo.id}</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={() => DocumentPrintService.printElement(`printable-po-hist-${previewPo.id}`, `PO_${previewPo.id}`)}
                >
                  <Printer size={14} /> Print
                </button>
                <button
                  type="button"
                  className="crm-btn-primary"
                  onClick={() => DocumentPdfService.generatePdf(`printable-po-hist-${previewPo.id}`, getPurchaseOrderFilename(previewPo))}
                >
                  <FileDown size={14} /> PDF
                </button>
                <button
                  type="button"
                  className="crm-modal-close"
                  onClick={() => setPreviewPo(null)}
                >
                  ×
                </button>
              </div>
            </div>
            <div className="crm-modal-body" style={{ padding: '24px', background: '#f1f5f9' }}>
              <div id={`printable-po-hist-${previewPo.id}`} style={{ background: '#fff', maxWidth: '800px', margin: '0 auto' }}>
                <PrintablePurchaseOrder purchaseOrder={previewPo} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
