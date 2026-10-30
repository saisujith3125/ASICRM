import React, { useState, useMemo } from 'react';
import { Plus, Eye, Printer, Search, X, RotateCcw, ChevronDown, User } from 'lucide-react';
import { navigate } from '../../router';
import { DCStatusBadge, DCEmptyState } from './dcPrimitives';
import { useTablePagination, TableFooter } from '../common/TableWorkspace';
import { filterRecordsBySearch } from '../../utils/searchHelper';
import { formatDate } from '../../utils/dateUtils';

export default function DcHistoryPage({ challans = [], orders = [], user, onOpenDoc, onRefresh }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [expandedDcIds, setExpandedDcIds] = useState(new Set());

  const toggleExpand = (challanId) => {
    setExpandedDcIds((prev) => {
      const next = new Set(prev);
      if (next.has(challanId)) next.delete(challanId);
      else next.add(challanId);
      return next;
    });
  };

  const filteredChallans = useMemo(() => {
    let list = [...challans];
    if (statusFilter !== 'ALL') {
      list = list.filter((dc) => dc.status === statusFilter);
    }
    const result = filterRecordsBySearch(list, search, [
      (dc) => dc.challanId,
      (dc) => dc.orderId,
      (dc) => dc.customerName,
      (dc) => dc.customerCompany,
      (dc) => dc.company,
      (dc) => dc.receiverName,
      (dc) => dc.contactPerson,
      (dc) => dc.phone,
      (dc) => dc.mobile,
      (dc) => dc.dispatchDetails,
      (dc) => dc.transitMode,
      (dc) => dc.vehicleNo,
      (dc) => dc.docketNo,
      (dc) => dc.status,
      (dc) => dc.items?.map((it) => `${it.productName || it.name || ''} ${it.productCode || it.sku || ''} ${(it.serialNumbers || []).join(' ')}`)
    ]);

    // Ascending sequence order: DC-000001, DC-000002... (1 above 2)
    return result.sort((a, b) => {
      const aVal = String(a.challanId || '');
      const bVal = String(b.challanId || '');
      const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
      const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
      if (aNum && bNum && aNum !== bNum) return aNum - bNum;
      return aVal.localeCompare(bVal, undefined, { numeric: true });
    });
  }, [challans, search, statusFilter]);

  const {
    currentPage,
    totalPages,
    pageSize,
    currentRecords: paginatedChallans,
    showingStart,
    showingEnd,
    totalRecords,
    goToPage
  } = useTablePagination(filteredChallans, {
    rowHeight: 45,
    resetDeps: [search, statusFilter]
  });

  const historyTabs = [
    { key: 'ALL', label: 'All Challans', count: challans.length },
    { key: 'DISPATCHED', label: 'Dispatched', count: challans.filter((c) => c.status === 'DISPATCHED').length },
    { key: 'DELIVERED', label: 'Delivered', count: challans.filter((c) => c.status === 'DELIVERED').length },
    { key: 'RETURNED', label: 'Returned', count: challans.filter((c) => c.status === 'RETURNED').length }
  ];

  return (
    <div className="crm-customer-page-container dc-page-container dc-history-page">
      {/* 1. Page Header matching Customer Directory */}
      <div className="page-header-row customer-page-header">
        <h1 className="page-title">Delivery Challan History</h1>
      </div>

      {/* 2. Customer Directory-matched Toolbar Card */}
      <div className="customer-toolbar-card dc-toolbar-card">
        <div className="dc-toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 auto', minWidth: 0 }}>
          {/* Search Box matching Customer Directory */}
          <div className="customer-search-input-wrap" style={{ maxWidth: '320px', minWidth: '220px', flex: '0 1 320px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search DC No / Customer / Order / Serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="customer-search-input-field"
              aria-label="Search challans"
            />
            {search && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearch('')}
                title="Clear search"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Tabs cleanly integrated */}
          <div className="dc-status-tabs" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {historyTabs.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`dc-filter-btn ${statusFilter === t.key ? 'active' : ''}`}
                onClick={() => setStatusFilter(t.key)}
              >
                <span>{t.label}</span>
                <span className="filter-count">{t.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Toolbar Actions */}
        <div className="dc-toolbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
          {onRefresh && (
            <button
              type="button"
              className="crm-btn-secondary compact dc-refresh-btn"
              onClick={onRefresh}
              title="Refresh list"
            >
              <RotateCcw size={13} />
              <span>Refresh</span>
            </button>
          )}
          <button
            type="button"
            className="crm-btn-primary add-customer-btn"
            onClick={() => navigate('/delivery-challans/new')}
            title="Create New Delivery Challan"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>+ New DC</span>
          </button>
        </div>
      </div>

      {/* 3. Main Master Table Card matching Customer Directory Ledger */}
      <div className="settings-table-shell stocks-table-shell customer-master-card" style={{ height: '100%' }}>
        <div className="crm-table-scroll-wrap stocks-table-natural-wrap dc-history-table-body">
          <table className="settings-table customer-directory-table dc-table dc-history-table">
            <colgroup>
              <col style={{ width: '15%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '23%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="col-priority-high">DC NUMBER</th>
                <th className="col-priority-med">DATE</th>
                <th className="col-priority-high">CUSTOMER / CONSIGNEE</th>
                <th className="col-priority-low">SALES ORDER</th>
                <th className="col-priority-med" style={{ textAlign: 'center' }}>ITEMS</th>
                <th className="col-priority-low">RECEIVER</th>
                <th className="col-priority-high" style={{ textAlign: 'center' }}>STATUS</th>
                <th className="actions-col col-priority-high" style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredChallans.length === 0 ? (
                <DCEmptyState message={search.trim() ? `No delivery challans found matching "${search.trim()}".` : "No delivery challans match your criteria."} colSpan={8} />
              ) : (
                paginatedChallans.map((dc) => {
                  const totalUnits = Array.isArray(dc.items)
                    ? dc.items.reduce((sum, it) => sum + Number(it.quantity || 1), 0)
                    : 0;
                  const isExpanded = expandedDcIds.has(dc.challanId);

                  return (
                    <React.Fragment key={dc.challanId}>
                      <tr className="table-data-row">
                        {/* DC Number */}
                        <td data-label="DC NUMBER" className="cell-nowrap">
                          {onOpenDoc ? (
                            <button
                              type="button"
                              className="customer-id-pill master-code link-code-btn"
                              onClick={() => onOpenDoc(dc)}
                              title={`View DC Document ${dc.challanId}`}
                            >
                              {dc.challanId}
                            </button>
                          ) : (
                            <span className="customer-id-pill master-code">
                              {dc.challanId}
                            </span>
                          )}
                        </td>

                        {/* Date */}
                        <td data-label="DATE" className="cell-nowrap" style={{ fontSize: '13px', color: '#475569' }}>
                          {formatDate(dc.deliveryDate || dc.createdAt)}
                        </td>

                        {/* Customer / Consignee */}
                        <td data-label="CUSTOMER / CONSIGNEE" className="cell-wrap">
                          <div className="customer-name-cell">
                            <span className="customer-company-title" title={dc.customerCompany || dc.customerName}>
                              {dc.customerCompany || dc.customerName}
                            </span>
                            {(dc.contactPerson || (dc.customerName && dc.customerName !== dc.customerCompany)) && (
                              <div className="customer-contact-sub">
                                <User size={11} className="customer-sub-icon" />
                                <span>{dc.contactPerson || (dc.customerName !== dc.customerCompany ? dc.customerName : '')}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Sales Order */}
                        <td data-label="SALES ORDER" className="cell-nowrap">
                          {dc.orderId ? (
                            <span className="order-id-badge" style={{ fontSize: '11.5px' }}>{dc.orderId}</span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>Standalone</span>
                          )}
                        </td>

                        {/* Items count button */}
                        <td data-label="ITEMS" className="cell-nowrap" style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className={`dc-compact-items-btn ${isExpanded ? 'open' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(dc.challanId);
                            }}
                            title={isExpanded ? 'Hide items' : 'View all items'}
                            aria-expanded={isExpanded}
                          >
                            <span>{totalUnits} {totalUnits === 1 ? 'Item' : 'Items'}</span>
                            <ChevronDown size={12} className={`dc-items-chevron ${isExpanded ? 'rotated' : ''}`} />
                          </button>
                        </td>

                        {/* Receiver */}
                        <td data-label="RECEIVER" className="cell-truncate" title={dc.receiverName || '—'}>
                          <span style={{ fontSize: '12.5px', color: dc.receiverName ? '#334155' : '#94a3b8' }}>
                            {dc.receiverName || '—'}
                          </span>
                        </td>

                        {/* Status */}
                        <td data-label="STATUS" style={{ textAlign: 'center' }}>
                          <DCStatusBadge status={dc.status} />
                        </td>

                        {/* Actions */}
                        <td data-label="ACTIONS" className="actions-col" style={{ textAlign: 'right' }}>
                          <div className="settings-row-actions" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              type="button"
                              className="settings-row-action customer-action-btn dc-action-btn-secondary"
                              onClick={() => onOpenDoc && onOpenDoc(dc)}
                              title="View & Print Delivery Challan"
                            >
                              <Eye size={12} />
                              <span>View</span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Inline Expanded Items Row */}
                      {isExpanded && (
                        <tr className="dc-inline-expanded-row">
                          <td colSpan={8} className="dc-inline-expanded-td">
                            <div className="dc-inline-items-panel">
                              <div className="dc-inline-items-header">
                                <span className="dc-inline-items-heading">
                                  Challan Items ({dc.items?.length || 0} Line {dc.items?.length === 1 ? 'Item' : 'Items'} • {totalUnits} Units Total)
                                </span>
                              </div>
                              <div className="dc-inline-items-list">
                                {Array.isArray(dc.items) && dc.items.length > 0 ? (
                                  dc.items.map((it, idx) => (
                                    <div key={idx} className="dc-inline-item-card">
                                      <div className="dc-inline-item-top">
                                        <div className="dc-inline-item-title">
                                          <span className="dc-inline-item-qty">{it.quantity || 1} ×</span>
                                          <span className="dc-inline-item-name">{it.productName || it.name || 'Product'}</span>
                                        </div>
                                        <div className="dc-inline-item-meta">
                                          <span className="dc-inline-item-sku">SKU: {it.productCode || it.productId || '—'}</span>
                                          {it.unit && <span className="dc-inline-item-unit">Unit: {it.unit}</span>}
                                        </div>
                                      </div>
                                      {Array.isArray(it.serialNumbers) && it.serialNumbers.length > 0 && (
                                        <div className="dc-inline-serials-container">
                                          <div className="dc-inline-serials-label">Serial Numbers:</div>
                                          <div className="dc-inline-serials-list">
                                            {it.serialNumbers.map((sn, sIdx) => (
                                              <span
                                                key={sIdx}
                                                className="dc-inline-serial-badge"
                                                title={`Click to track complete serial lifecycle: ${sn}`}
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
                                        </div>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <div className="dc-inline-item-empty">No items recorded in this challan.</div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
              {filteredChallans.length > 0 && paginatedChallans.length < pageSize && (
                Array.from({ length: pageSize - paginatedChallans.length }).map((_, fIdx) => (
                  <tr key={`filler-${fIdx}`} className="table-data-row table-filler-row" aria-hidden="true">
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td style={{ textAlign: 'center' }}>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td style={{ textAlign: 'center' }}>&nbsp;</td>
                    <td className="actions-col" style={{ textAlign: 'right' }}>&nbsp;</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TableFooter
          showingStart={showingStart}
          showingEnd={showingEnd}
          total={totalRecords}
          recordLabel="challans"
          singularLabel="challan"
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          className="dc-table-footer dc-history-footer"
        />
      </div>
    </div>
  );
}
