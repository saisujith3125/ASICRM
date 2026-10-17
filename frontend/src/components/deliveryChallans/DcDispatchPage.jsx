import React, { useState, useMemo } from 'react';
import { Truck, Check, Pencil, RotateCcw, X } from 'lucide-react';
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
    <div className="dc-page-container dc-dispatch-page">
      {/* 1. Page Header */}
      <div className="dc-page-header compact-header">
        <div className="dc-header-left">
          <h2 className="dc-page-title">DC Dispatch Management</h2>
        </div>
      </div>

      {error && <div className="crm-alert-box error" style={{ marginBottom: '8px', padding: '6px 12px' }}><span>{error}</span></div>}
      {success && <div className="crm-alert-box success" style={{ marginBottom: '8px', padding: '6px 12px' }}><span>{success}</span></div>}

      {/* 2. Compact Toolbar (Title Pill + Search) */}
      <div className="dc-table-toolbar">
        <div className="dc-toolbar-title-wrap">
          <span className="dc-tab-pill active" style={{ cursor: 'default' }}>
            Active Dispatches
            <span className="dc-tab-count">
              {filteredDispatchList.length}
            </span>
          </span>
        </div>

        <div className="dc-search-box-wrap">
          <input
            type="text"
            className="crm-form-input search-input-field"
            placeholder="Search DC No / Customer / Docket..."
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
      <div className="settings-table-shell stocks-table-shell dc-dispatch-table-card dc-master-card">
        <div className="crm-table-scroll-wrap stocks-table-natural-wrap dc-dispatch-table-body">
          <table className="crm-master-table crm-data-table settings-table dc-table dc-dispatch-table dc-register-table">
            <colgroup>
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ width: '12%' }}>DC NUMBER</th>
                <th style={{ width: '10%' }}>DATE</th>
                <th style={{ width: '22%' }}>CUSTOMER / CONSIGNEE</th>
                <th style={{ width: '12%' }}>TRANSIT MODE</th>
                <th style={{ width: '16%' }}>VEHICLE / DOCKET NO</th>
                <th style={{ width: '8%', textAlign: 'center' }}>TOTAL UNITS</th>
                <th style={{ width: '10%', textAlign: 'center' }}>STATUS</th>
                <th style={{ width: '10%', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredDispatchList.length === 0 ? (
                <DCEmptyState message={search.trim() ? `No active dispatches found matching "${search.trim()}".` : "No active dispatches currently pending."} colSpan={8} />
              ) : (
                paginatedDispatchList.map((dc) => (
                  <tr key={dc.challanId} className="table-data-row">
                    <td className="cell-nowrap">
                      <span className="master-code dc-code-badge">
                        {dc.challanId}
                      </span>
                    </td>
                    <td className="cell-nowrap">{formatDate(dc.deliveryDate || dc.createdAt)}</td>
                    <td>
                      <div className="dc-cell-truncate" title={dc.customerName}>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{dc.customerName}</span>
                      </div>
                    </td>
                    <td>
                      <span className="dc-transit-tag">{dc.transitMode || 'Road Express'}</span>
                    </td>
                    <td>
                      <span className="dc-cell-truncate" title={dc.dispatchDetails || 'Pending docket allocation'}>
                        {dc.dispatchDetails || 'Pending docket allocation'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="dc-items-count-badge">
                        {Array.isArray(dc.items) ? dc.items.reduce((s, i) => s + Number(i.quantity || 1), 0) : 1}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <DCStatusBadge status={dc.status || 'DISPATCHED'} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="dc-actions">
                        <button
                          type="button"
                          className="dc-btn-action secondary"
                          onClick={() => startEdit(dc)}
                          title="Update transit &amp; vehicle details"
                        >
                          <Pencil size={12} />
                          <span>Edit Log</span>
                        </button>
                        <button
                          type="button"
                          className="dc-btn-action primary"
                          onClick={() => markDelivered(dc)}
                          title="Mark as Delivered"
                        >
                          <Check size={13} strokeWidth={2.5} />
                          <span>Deliver</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {filteredDispatchList.length > 0 && paginatedDispatchList.length < pageSize && (
                Array.from({ length: pageSize - paginatedDispatchList.length }).map((_, fIdx) => (
                  <tr key={`filler-${fIdx}`} className="table-filler-row" aria-hidden="true">
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td style={{ textAlign: 'center' }}>&nbsp;</td>
                    <td style={{ textAlign: 'center' }}>&nbsp;</td>
                    <td style={{ textAlign: 'right' }}>&nbsp;</td>
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
