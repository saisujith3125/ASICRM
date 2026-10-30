import React, { useState } from 'react';
import { Plus, ClipboardList, Truck, PackageCheck, RotateCcw, Eye, ArrowRight, User } from 'lucide-react';
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
    <div className="delivery-challans-module-wrapper dc-page-container dc-overview-page">
      {/* 1. Header Row matching Customer Directory */}
      <div className="page-header-row customer-page-header">
        <h1 className="page-title">Delivery Challans Overview</h1>
        <div className="dc-header-actions">
          <button
            type="button"
            className="crm-btn-primary compact add-customer-btn"
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

      {/* 3. Recent Delivery Challans Table Card matching Customer Directory */}
      <div className="settings-table-shell stocks-table-shell customer-master-card dc-overview-table-card" style={{ height: '100%' }}>
        <div className="recent-table-header dc-recent-header">
          <div className="dc-recent-title-group">
            <h3 className="dc-recent-title">Recent Delivery Challans</h3>
          </div>
          <button
            type="button"
            className="dc-view-all-history-btn"
            onClick={() => goToNav('history')}
            title="View full delivery challans history"
          >
            <span>View All History</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="crm-table-scroll-wrap stocks-table-natural-wrap dc-overview-table-body">
          <table className="settings-table customer-directory-table dc-table dc-overview-table">
            <colgroup>
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '23%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="col-priority-high">DC NUMBER</th>
                <th className="col-priority-med">DATE</th>
                <th className="col-priority-high">CUSTOMER / CONSIGNEE</th>
                <th className="col-priority-low">LINKED ORDER</th>
                <th className="col-priority-med" style={{ textAlign: 'center' }}>ITEMS</th>
                <th className="col-priority-low">TRANSIT MODE</th>
                <th className="col-priority-high" style={{ textAlign: 'center' }}>STATUS</th>
                <th className="actions-col col-priority-high" style={{ textAlign: 'right' }}>ACTIONS</th>
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
                    <td data-label="DATE" className="cell-nowrap" style={{ fontSize: '13px', color: '#475569' }}>
                      {formatDate(dc.deliveryDate || dc.createdAt)}
                    </td>
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
                    <td data-label="LINKED ORDER" className="cell-nowrap">
                      {dc.orderId ? (
                        <span className="order-id-badge">{dc.orderId}</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>Direct Delivery</span>
                      )}
                    </td>
                    <td data-label="ITEMS" style={{ textAlign: 'center' }}>
                      <span className="count-badge active-count">
                        {Array.isArray(dc.items) ? dc.items.reduce((sum, i) => sum + Number(i.quantity || 1), 0) : 1}
                      </span>
                    </td>
                    <td data-label="TRANSIT MODE" className="cell-nowrap">
                      <span style={{ fontSize: '13px', color: '#334155', fontWeight: 500 }}>
                        {dc.transitMode || 'Road Express'}
                      </span>
                    </td>
                    <td data-label="STATUS" style={{ textAlign: 'center' }}>
                      <DCStatusBadge status={dc.status} />
                    </td>
                    <td data-label="ACTIONS" className="actions-col" style={{ textAlign: 'right' }}>
                      <div className="settings-row-actions" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          type="button"
                          className="settings-row-action customer-action-btn dc-action-btn-secondary"
                          onClick={() => onOpenDoc && onOpenDoc(dc)}
                          title="View Delivery Challan"
                        >
                          <Eye size={12} />
                          <span>View</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {challans.length > 0 && currentRecords.length < pageSize && (
                Array.from({ length: pageSize - currentRecords.length }).map((_, fIdx) => (
                  <tr key={`filler-${fIdx}`} className="table-data-row table-filler-row" aria-hidden="true">
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

        {/* 4. Enterprise Table Footer */}
        <TableFooter
          showingStart={showingStart}
          showingEnd={showingEnd}
          total={totalRecords}
          recordLabel="delivery challans"
          singularLabel="delivery challan"
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          className="customer-directory-footer dc-overview-footer"
        />
      </div>
    </div>
  );
}
