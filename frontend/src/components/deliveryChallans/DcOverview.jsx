import React, { useState } from 'react';
import { Plus, ClipboardList, Truck, PackageCheck, RotateCcw, Eye, ArrowRight } from 'lucide-react';
import { navigate } from '../../router';
import { DCStatusBadge, DCEmptyState } from './dcPrimitives';
import { useTablePagination, TableFooter } from '../common/TableWorkspace';
import { formatDate } from '../../utils/dateUtils';

export default function DcOverview({ challans = [], onNavigateSubView, onOpenDoc }) {
  const totalCount = challans.length;
  const dispatchedCount = challans.filter((c) => c.status === 'DISPATCHED').length;
  const deliveredCount = challans.filter((c) => c.status === 'DELIVERED').length;
  const returnedCount = challans.filter((c) => c.status === 'RETURNED').length;
  const inTransitCount = challans.filter((c) => c.status === 'IN_TRANSIT' || c.status === 'DISPATCHED').length;

  // Ascending sequence sort: DC-000001, DC-000002... (1 above 2)
  const sortedChallans = React.useMemo(() => {
    return [...challans].sort((a, b) => {
      const aVal = String(a.challanId || '');
      const bVal = String(b.challanId || '');
      const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
      const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
      if (aNum && bNum && aNum !== bNum) return aNum - bNum;
      return aVal.localeCompare(bVal, undefined, { numeric: true });
    });
  }, [challans]);

  const {
    currentPage,
    totalPages,
    pageSize,
    currentRecords,
    showingStart,
    showingEnd,
    totalRecords,
    goToPage
  } = useTablePagination(sortedChallans, {
    rowHeight: 45
  });

  const goToNav = (sub) => {
    if (onNavigateSubView) {
      onNavigateSubView(sub);
    } else {
      navigate(sub === 'overview' ? '/delivery-challans' : `/delivery-challans/${sub}`);
    }
  };

  return (
    <div className="delivery-challans-overview-page dc-page-container dc-overview-page">
      {/* 1. Header Row */}
      <div className="overview-header-row dc-page-header compact-header">
        <div>
          <h2 className="dc-page-title">Delivery Challans Overview</h2>
        </div>
        <div className="dc-header-actions">
          <button
            type="button"
            className="crm-btn-primary compact"
            onClick={() => goToNav('new')}
            title="Create New Delivery Challan"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>New DC</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Cards Row (Functional navigation) */}
      <div className="overview-kpi-row dc-overview-kpi-grid">
        <div className="dc-overview-kpi-card" onClick={() => goToNav('history')} title="View All Delivery Challans">
          <div className="dc-overview-kpi-icon blue">
            <ClipboardList size={18} />
          </div>
          <div className="dc-overview-kpi-content">
            <span className="dc-overview-kpi-lbl">Total Challans</span>
            <span className="dc-overview-kpi-val">{totalCount}</span>
          </div>
        </div>

        <div className="dc-overview-kpi-card" onClick={() => goToNav('dispatch')} title="View Dispatches in Transit">
          <div className="dc-overview-kpi-icon amber">
            <Truck size={18} />
          </div>
          <div className="dc-overview-kpi-content">
            <span className="dc-overview-kpi-lbl">In Transit / Dispatched</span>
            <span className="dc-overview-kpi-val">{inTransitCount}</span>
          </div>
        </div>

        <div className="dc-overview-kpi-card" onClick={() => goToNav('receive')} title="View Delivered & Received Consignments">
          <div className="dc-overview-kpi-icon emerald">
            <PackageCheck size={18} />
          </div>
          <div className="dc-overview-kpi-content">
            <span className="dc-overview-kpi-lbl">Delivered &amp; Received</span>
            <span className="dc-overview-kpi-val">{deliveredCount}</span>
          </div>
        </div>

        <div className="dc-overview-kpi-card" onClick={() => goToNav('return')} title="View Returned Delivery Challans">
          <div className="dc-overview-kpi-icon rose">
            <RotateCcw size={18} />
          </div>
          <div className="dc-overview-kpi-content">
            <span className="dc-overview-kpi-lbl">Returned DCs</span>
            <span className="dc-overview-kpi-val">{returnedCount}</span>
          </div>
        </div>
      </div>

      {/* 3. Recent Delivery Challans Table Card (Enterprise Full-height workspace) */}
      <div className="settings-table-shell stocks-table-shell dc-overview-table-card dc-master-card">
        <div className="recent-table-header dc-recent-header">
          <div className="dc-recent-title-group">
            <h3 className="dc-recent-title">Recent Delivery Challans</h3>
            <span className="dc-recent-counter">
              Showing {showingStart}-{showingEnd} of {totalRecords} {totalRecords === 1 ? 'challan' : 'challans'}
            </span>
          </div>
          <button
            type="button"
            className="dc-view-all-history-btn crm-btn-secondary compact"
            onClick={() => goToNav('history')}
            title="View full delivery challans history"
          >
            <span>View All History</span>
            <ArrowRight size={14} className="dc-view-all-icon" />
          </button>
        </div>

        <div className="crm-table-scroll-wrap stocks-table-natural-wrap dc-overview-table-body">
          <table className="crm-master-table crm-data-table settings-table dc-table dc-overview-table dc-register-table">
            <colgroup>
              <col style={{ width: '15%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="dc-col-number">DC NUMBER</th>
                <th className="dc-col-date">DATE</th>
                <th className="dc-col-customer">CUSTOMER / CONSIGNEE</th>
                <th className="dc-col-order">LINKED ORDER</th>
                <th className="dc-col-items" style={{ textAlign: 'center' }}>ITEMS</th>
                <th className="dc-col-transit">TRANSIT MODE</th>
                <th className="dc-col-status" style={{ textAlign: 'center' }}>STATUS</th>
                <th className="dc-col-actions" style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {challans.length === 0 ? (
                <DCEmptyState
                  message="No Delivery Challans created yet."
                  colSpan={8}
                  action={
                    <button
                      type="button"
                      className="crm-btn-primary compact"
                      onClick={() => goToNav('new')}
                    >
                      + Create First Delivery Challan
                    </button>
                  }
                />
              ) : (
                currentRecords.map((dc) => (
                  <tr key={dc.challanId} className="table-data-row">
                    <td className="dc-col-number" style={{ whiteSpace: 'nowrap' }}>
                      <span className="master-code dc-code-badge">
                        {dc.challanId}
                      </span>
                    </td>
                    <td className="dc-col-date" style={{ whiteSpace: 'nowrap' }}>
                      {formatDate(dc.deliveryDate || dc.createdAt)}
                    </td>
                    <td className="dc-col-customer">
                      <div className="dc-cell-truncate" title={dc.customerName}>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{dc.customerName}</span>
                      </div>
                    </td>
                    <td className="dc-col-order" style={{ whiteSpace: 'nowrap' }}>
                      {dc.orderId ? (
                        <span className="order-id-badge">{dc.orderId}</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '11.5px' }}>Direct Delivery</span>
                      )}
                    </td>
                    <td className="dc-col-items" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span className="dc-items-count-badge">
                        {Array.isArray(dc.items) ? dc.items.reduce((sum, i) => sum + Number(i.quantity || 1), 0) : 1} units
                      </span>
                    </td>
                    <td className="dc-col-transit">
                      <div className="dc-cell-truncate" title={dc.transitMode || 'Road Express'}>
                        <span style={{ fontSize: '12px', color: '#475569' }}>
                          {dc.transitMode || 'Road Express'}
                        </span>
                      </div>
                    </td>
                    <td className="dc-col-status" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <DCStatusBadge status={dc.status} />
                    </td>
                    <td className="dc-col-actions" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div className="dc-actions">
                        <button
                          type="button"
                          className="dc-btn-action secondary"
                          onClick={() => onOpenDoc && onOpenDoc(dc)}
                          title="View printable Delivery Challan"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {challans.length > 0 && currentRecords.length < pageSize && (
                Array.from({ length: pageSize - currentRecords.length }).map((_, fIdx) => (
                  <tr key={`filler-${fIdx}`} className="table-filler-row" aria-hidden="true">
                    <td className="dc-col-number">&nbsp;</td>
                    <td className="dc-col-date">&nbsp;</td>
                    <td className="dc-col-customer">&nbsp;</td>
                    <td className="dc-col-order">&nbsp;</td>
                    <td className="dc-col-items" style={{ textAlign: 'center' }}>&nbsp;</td>
                    <td className="dc-col-transit">&nbsp;</td>
                    <td className="dc-col-status" style={{ textAlign: 'center' }}>&nbsp;</td>
                    <td className="dc-col-actions" style={{ textAlign: 'right' }}>&nbsp;</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Enterprise Table Footer */}
        <TableFooter
          showingStart={showingStart}
          showingEnd={showingEnd}
          total={totalRecords}
          recordLabel="delivery challans"
          singularLabel="delivery challan"
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          className="dc-overview-footer"
        />
      </div>
    </div>
  );
}
