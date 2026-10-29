import React, { useState, useMemo } from 'react';
import { Plus, Eye, Printer, Search, X, RotateCcw, ChevronDown } from 'lucide-react';
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

  return (
    <div className="dc-page-container dc-history-page">
      {/* 1. Page Header (Title + Primary Action) */}
      <div className="dc-page-header compact-header">
        <div className="dc-header-left">
          <h2 className="dc-page-title">Delivery Challan History</h2>
        </div>
        <div className="dc-header-actions">
          <button
            type="button"
            className="crm-btn-primary compact"
            onClick={() => navigate('/delivery-challans/new')}
            title="Create New Delivery Challan"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>New DC</span>
          </button>
        </div>
      </div>

      {/* 2. Filter & Search Toolbar (Single horizontal row on desktop) */}
      <div className="dc-table-toolbar">
        <div className="dc-status-tabs">
          {['ALL', 'DISPATCHED', 'DELIVERED', 'RETURNED'].map((st) => (
            <button
              key={st}
              type="button"
              className={`dc-tab-pill ${statusFilter === st ? 'active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'ALL' ? 'All Challans' : st.charAt(0) + st.slice(1).toLowerCase()}
              <span className="dc-tab-count">
                {st === 'ALL' ? challans.length : challans.filter((c) => c.status === st).length}
              </span>
            </button>
          ))}
        </div>

        <div className="dc-search-box-wrap">
          <input
            type="text"
            className="crm-form-input search-input-field"
            placeholder="Search DC No / Customer / Order / Serial..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearch('')}
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}
          {onRefresh && (
            <button
              type="button"
              className="crm-btn-secondary compact"
              onClick={onRefresh}
              title="Refresh list"
            >
              <RotateCcw size={12} />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Viewport Table Card */}
      <div className="settings-table-shell stocks-table-shell dc-table-card dc-history-table-card dc-master-card">
        <div className="crm-table-scroll-wrap stocks-table-natural-wrap dc-table-scroll-body dc-history-table-body">
          <table className="crm-master-table crm-data-table settings-table dc-table dc-history-table dc-register-table">
            <colgroup>
              <col style={{ width: '15%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>DC NUMBER</th>
                <th>DATE</th>
                <th>CUSTOMER / CONSIGNEE</th>
                <th>SALES ORDER</th>
                <th style={{ textAlign: 'center' }}>ITEMS</th>
                <th>RECEIVER</th>
                <th style={{ textAlign: 'center' }}>STATUS</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
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
                        <td className="cell-nowrap">
                          <span className="master-code dc-code-badge">
                            {dc.challanId}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="cell-nowrap">
                          {formatDate(dc.deliveryDate || dc.createdAt)}
                        </td>

                        {/* Customer / Consignee: Clean name only */}
                        <td>
                          <div className="dc-cell-truncate" title={dc.customerName}>
                            <strong style={{ fontWeight: 600, color: '#1e293b' }}>{dc.customerName}</strong>
                          </div>
                        </td>

                        {/* Sales Order */}
                        <td className="cell-nowrap">
                          {dc.orderId ? (
                            <span className="order-id-badge">{dc.orderId}</span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 500 }}>Standalone</span>
                          )}
                        </td>

                        {/* Compact Items Control */}
                        <td className="cell-nowrap">
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
                            <ChevronDown size={13} className={`dc-items-chevron ${isExpanded ? 'rotated' : ''}`} />
                          </button>
                        </td>

                        {/* Receiver */}
                        <td>
                          <span className="dc-cell-truncate" title={dc.receiverName || '—'}>
                            {dc.receiverName || '—'}
                          </span>
                        </td>

                        {/* Status */}
                        <td style={{ textAlign: 'center' }}>
                          <DCStatusBadge status={dc.status} />
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'right' }}>
                          <div className="dc-actions">
                            <button
                              type="button"
                              className="dc-btn-action secondary"
                              onClick={() => onOpenDoc && onOpenDoc(dc)}
                              title="View &amp; Print Delivery Challan"
                            >
                              <Eye size={13} />
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
                                  Challan Items ({dc.items?.length || 0} Line {dc.items?.length === 1 ? 'Item' : 'Items'} · {totalUnits} Units Total)
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
                                              <span key={sIdx} className="dc-inline-serial-badge" title={`Allocated Serial Number: ${sn}`}>
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
                  <tr key={`filler-${fIdx}`} className="table-filler-row" aria-hidden="true">
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td style={{ textAlign: 'center' }}>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td style={{ textAlign: 'center' }}>&nbsp;</td>
                    <td style={{ textAlign: 'right' }}>&nbsp;</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <TableFooter
          showingStart={showingStart}
          showingEnd={showingEnd}
          total={totalRecords}
          recordLabel="delivery challans"
          singularLabel="delivery challan"
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          className="dc-table-footer dc-history-footer"
        />
      </div>
    </div>
  );
}
