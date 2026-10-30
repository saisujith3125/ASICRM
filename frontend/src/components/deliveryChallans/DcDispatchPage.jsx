import React, { useState, useMemo } from 'react';
import { Truck, Check, Pencil, RotateCcw, X, User } from 'lucide-react';
import { apiFetch, apiUrl } from '../../api';
import { DCStatusBadge, DCEmptyState } from './dcPrimitives';
import { useTablePagination, TableFooter } from '../common/TableWorkspace';
import { filterRecordsBySearch } from '../../utils/searchHelper';
import { formatDate } from '../../utils/dateUtils';

function authHeaders(user) {
  return {
    'Content-Type': 'application/json',
    'x-user-id': user?.id || ''
  };
}

export default function DcDispatchPage({ challans = [], user, onRefresh, onOpenDoc }) {
  const [editingDc, setEditingDc] = useState(null);
  const [transitMode, setTransitMode] = useState('');
  const [dispatchDetails, setDispatchDetails] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const dispatchList = useMemo(() => {
    return challans.filter((c) => c.status !== 'DELIVERED' && c.status !== 'RETURNED');
  }, [challans]);

  const filteredDispatchList = useMemo(() => {
    const result = filterRecordsBySearch(dispatchList, search, [
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
      (dc) => dc.items?.map((it) => `${it.productName || it.name || ''} ${it.sku || ''} ${(it.serialNumbers || []).join(' ')}`)
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
  }, [dispatchList, search]);

  const {
    currentPage,
    totalPages,
    pageSize,
    currentRecords: paginatedDispatchList,
    showingStart,
    showingEnd,
    totalRecords,
    goToPage
  } = useTablePagination(filteredDispatchList, {
    rowHeight: 45,
    resetDeps: [search]
  });

  const startEdit = (dc) => {
    setEditingDc(dc);
    setTransitMode(dc.transitMode || 'Road Express');
    setDispatchDetails(dc.dispatchDetails || '');
    setError('');
    setSuccess('');
  };

  const handleSaveDispatch = async (e) => {
    e.preventDefault();
    if (!editingDc) return;
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch(apiUrl(`/api/orders/delivery-challans/${editingDc.challanId}/status`), {
        method: 'PATCH',
        headers: authHeaders(user),
        body: JSON.stringify({
          status: 'DISPATCHED',
          transitMode,
          dispatchDetails
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update dispatch details.');
      }
      setSuccess(`Dispatch details for ${editingDc.challanId} updated.`);
      setEditingDc(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message || 'Failed to update dispatch details.');
    } finally {
      setSaving(false);
    }
  };

  const markDelivered = async (dc) => {
    if (!window.confirm(`Mark Delivery Challan ${dc.challanId} as DELIVERED?`)) return;
    try {
      const res = await apiFetch(apiUrl(`/api/orders/delivery-challans/${dc.challanId}/status`), {
        method: 'PATCH',
        headers: authHeaders(user),
        body: JSON.stringify({ status: 'DELIVERED' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(`Challan ${dc.challanId} marked as DELIVERED.`);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      setError(err.message || 'Failed to update status.');
    }
  };

  return (
    <div className="crm-customer-page-container dc-page-container dc-dispatch-page">
      {/* 1. Page Header matching Customer Directory */}
      <div className="page-header-row customer-page-header">
        <h1 className="page-title">DC Dispatch Management</h1>
      </div>

      {error && (
        <div className="crm-alert-box error" style={{ marginBottom: '8px', padding: '6px 12px' }}>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="crm-alert-box success" style={{ marginBottom: '8px', padding: '6px 12px' }}>
          <span>{success}</span>
        </div>
      )}

      {/* 2. Customer Directory-matched Toolbar Card */}
      <div className="customer-toolbar-card dc-toolbar-card">
        <div className="dc-toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 auto', minWidth: 0 }}>
          {/* Search Box matching Customer Directory */}
          <div className="customer-search-input-wrap" style={{ maxWidth: '340px', minWidth: '220px', flex: '0 1 340px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search DC No / Customer / Docket..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="customer-search-input-field"
              aria-label="Search dispatches"
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

          {/* Active Dispatches Status Badge in Toolbar */}
          <div className="dc-status-tabs" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="dc-filter-btn active" style={{ cursor: 'default' }}>
              <span>Active Dispatches</span>
              <span className="filter-count">{filteredDispatchList.length}</span>
            </span>
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
        </div>
      </div>

      {/* 3. Main Master Table Card matching Customer Directory Ledger */}
      <div className="settings-table-shell stocks-table-shell customer-master-card" style={{ height: '100%' }}>
        <div className="crm-table-scroll-wrap stocks-table-natural-wrap dc-dispatch-table-body">
          <table className="settings-table customer-directory-table dc-table dc-dispatch-table">
            <colgroup>
              <col style={{ width: '15%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '23%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="col-priority-high">DC NUMBER</th>
                <th className="col-priority-med">DATE</th>
                <th className="col-priority-high">CUSTOMER / CONSIGNEE</th>
                <th className="col-priority-low">TRANSIT MODE</th>
                <th className="col-priority-low">VEHICLE / DOCKET NO</th>
                <th className="col-priority-med" style={{ textAlign: 'center' }}>TOTAL UNITS</th>
                <th className="col-priority-high" style={{ textAlign: 'center' }}>STATUS</th>
                <th className="actions-col col-priority-high" style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredDispatchList.length === 0 ? (
                <DCEmptyState message={search.trim() ? `No active dispatches found matching "${search.trim()}".` : "No active dispatches currently pending."} colSpan={8} />
              ) : (
                paginatedDispatchList.map((dc) => (
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
                    <td data-label="TRANSIT MODE" className="cell-nowrap">
                      <span style={{ fontSize: '13px', color: '#334155', fontWeight: 500 }}>
                        {dc.transitMode || 'Road Express'}
                      </span>
                    </td>
                    <td data-label="VEHICLE / DOCKET NO" className="cell-truncate" title={dc.dispatchDetails || dc.vehicleNo || dc.docketNo || '—'}>
                      <span style={{ fontSize: '13px', color: '#475569' }}>
                        {dc.dispatchDetails || dc.vehicleNo || dc.docketNo || '—'}
                      </span>
                    </td>
                    <td data-label="TOTAL UNITS" style={{ textAlign: 'center' }}>
                      <span className="count-badge active-count">
                        {Array.isArray(dc.items) ? dc.items.reduce((s, i) => s + Number(i.quantity || 1), 0) : 1}
                      </span>
                    </td>
                    <td data-label="STATUS" style={{ textAlign: 'center' }}>
                      <DCStatusBadge status={dc.status || 'DISPATCHED'} />
                    </td>
                    <td data-label="ACTIONS" className="actions-col" style={{ textAlign: 'right' }}>
                      <div className="settings-row-actions" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          type="button"
                          className="settings-row-action customer-action-btn dc-action-btn-secondary"
                          onClick={() => startEdit(dc)}
                          title="Update transit & vehicle details"
                        >
                          <Pencil size={11} />
                          <span>Edit Log</span>
                        </button>
                        <button
                          type="button"
                          className="settings-row-action primary customer-action-btn dc-action-btn-primary"
                          onClick={() => markDelivered(dc)}
                          title="Mark as Delivered"
                        >
                          <Check size={12} strokeWidth={2.5} />
                          <span>Deliver</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {filteredDispatchList.length > 0 && paginatedDispatchList.length < pageSize && (
                Array.from({ length: pageSize - paginatedDispatchList.length }).map((_, fIdx) => (
                  <tr key={`filler-${fIdx}`} className="table-data-row table-filler-row" aria-hidden="true">
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td style={{ textAlign: 'center' }}>&nbsp;</td>
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
          recordLabel="dispatches"
          singularLabel="dispatch"
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
          className="dc-table-footer dc-dispatch-footer"
        />
      </div>

      {/* Edit Transit Modal */}
      {editingDc && (
        <div className="crm-modal-backdrop" onClick={() => setEditingDc(null)}>
          <div className="crm-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="crm-modal-header">
              <h3>Update Dispatch Details - {editingDc.challanId}</h3>
              <button type="button" className="crm-modal-close" onClick={() => setEditingDc(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveDispatch}>
              <div className="crm-modal-body">
                <div className="crm-form-group">
                  <label className="crm-form-label">Mode of Transit</label>
                  <select
                    className="crm-form-input"
                    value={transitMode}
                    onChange={(e) => setTransitMode(e.target.value)}
                  >
                    <option value="Road Express">Road Express</option>
                    <option value="Road Transport">Road Transport</option>
                    <option value="Courier / Cargo">Courier / Cargo</option>
                    <option value="Hand Delivery">Hand Delivery / Field Engineer</option>
                    <option value="Air Cargo">Air Cargo</option>
                  </select>
                </div>

                <div className="crm-form-group" style={{ marginTop: '12px' }}>
                  <label className="crm-form-label">Vehicle No / Courier Docket Details</label>
                  <input
                    type="text"
                    className="crm-form-input"
                    value={dispatchDetails}
                    onChange={(e) => setDispatchDetails(e.target.value)}
                    placeholder="e.g. TN-02-CD-5678 / BLUEDART-4402"
                    required
                  />
                </div>
              </div>
              <div className="crm-modal-footer">
                <button type="button" className="crm-btn-secondary" onClick={() => setEditingDc(null)}>
                  Cancel
                </button>
                <button type="submit" className="crm-btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Update Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
