import React, { useState, useMemo, useEffect } from 'react';
import { PackageCheck, Check, Eye, RotateCcw, X, ChevronDown, Phone, User } from 'lucide-react';
import { apiFetch, apiUrl } from '../../api';
import { DCStatusBadge, DCEmptyState } from './dcPrimitives';
import { TableFooter, useTablePagination } from '../common/TableWorkspace';
import { filterRecordsBySearch } from '../../utils/searchHelper';
import { formatDate } from '../../utils/dateUtils';

function authHeaders(user) {
  return {
    'Content-Type': 'application/json',
    'x-user-id': user?.id || ''
  };
}

export default function DcReceivePage({ challans = [], user, onRefresh, onOpenDoc }) {
  const [receivingDc, setReceivingDc] = useState(null);
  const [receiverName, setReceiverName] = useState('');
  const [receiveDate, setReceiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receiveRemarks, setReceiveRemarks] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeReceiverPopoverId, setActiveReceiverPopoverId] = useState(null);

  const filteredReceiveList = useMemo(() => {
    let list = [...challans];
    if (statusFilter === 'PENDING') {
      list = list.filter((c) => c.status !== 'DELIVERED' && c.status !== 'RETURNED');
    } else if (statusFilter === 'DELIVERED') {
      list = list.filter((c) => c.status === 'DELIVERED');
    }
    const result = filterRecordsBySearch(list, search, [
      (dc) => dc.challanId,
      (dc) => dc.orderId,
      (dc) => dc.customerName,
      (dc) => dc.customerCompany,
      (dc) => dc.company,
      (dc) => dc.deliveryAddress,
      (dc) => dc.customerAddress,
      (dc) => dc.shippingAddress,
      (dc) => dc.destination,
      (dc) => dc.receiverName,
      (dc) => dc.receiverContact,
      (dc) => dc.contactNumber,
      (dc) => dc.contactPerson,
      (dc) => dc.phone,
      (dc) => dc.mobile,
      (dc) => dc.status,
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
  }, [challans, search, statusFilter]);

  const pagination = useTablePagination(filteredReceiveList, {
    rowHeight: 45,
    resetDeps: [search, statusFilter]
  });

  const openReceiveModal = (dc) => {
    setReceivingDc(dc);
    setReceiverName(dc.receiverName || dc.customerName || '');
    setReceiveDate(new Date().toISOString().slice(0, 10));
    setReceiveRemarks(dc.remarks || 'Consignment received in intact condition.');
    setError('');
    setSuccess('');
  };

  const handleSaveReceipt = async (e) => {
    e.preventDefault();
    if (!receivingDc) return;
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch(apiUrl(`/api/orders/delivery-challans/${receivingDc.challanId}/status`), {
        method: 'PATCH',
        headers: authHeaders(user),
        body: JSON.stringify({
          status: 'DELIVERED',
          receiverName,
          deliveryDate: receiveDate,
          remarks: receiveRemarks
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to acknowledge receipt.');
      }
      setSuccess(`Delivery Challan ${receivingDc.challanId} marked as DELIVERED & ACKNOWLEDGED.`);
      setReceivingDc(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message || 'Error recording receipt.');
    } finally {
      setSaving(false);
    }
  };

  // Dismiss receiver popover on outside click or Escape key
  useEffect(() => {
    if (!activeReceiverPopoverId) return;

    const handleClickOutside = (e) => {
      if (!e.target.closest('.dc-receiver-cell-wrapper')) {
        setActiveReceiverPopoverId(null);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveReceiverPopoverId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeReceiverPopoverId]);

  return (
    <div className="dc-page-container dc-receive-page">
      {/* 1. Page Header */}
      <div className="dc-page-header compact-header">
        <div className="dc-header-left">
          <h2 className="dc-page-title">DC Receive &amp; Acknowledgment</h2>
        </div>
      </div>

      {error && <div className="crm-alert-box error" style={{ marginBottom: '8px', padding: '6px 12px' }}><span>{error}</span></div>}
      {success && <div className="crm-alert-box success" style={{ marginBottom: '8px', padding: '6px 12px' }}><span>{success}</span></div>}

      {/* 2. Filter & Search Toolbar (Single horizontal row on desktop) */}
      <div className="dc-table-toolbar">
        <div className="dc-status-tabs">
          {['ALL', 'PENDING', 'DELIVERED'].map((st) => (
            <button
              key={st}
              type="button"
              className={`dc-tab-pill ${statusFilter === st ? 'active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'ALL' ? 'All Deliveries' : st === 'PENDING' ? 'Pending Receipt' : 'Acknowledged'}
              <span className="dc-tab-count">
                {st === 'ALL'
                  ? challans.length
                  : st === 'PENDING'
                  ? challans.filter((c) => c.status !== 'DELIVERED' && c.status !== 'RETURNED').length
                  : challans.filter((c) => c.status === 'DELIVERED').length}
              </span>
            </button>
          ))}
        </div>

        <div className="dc-search-box-wrap">
          <input
            type="text"
            className="crm-form-input search-input-field"
            placeholder="Search DC No / Customer / Destination..."
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
      <div className="settings-table-shell stocks-table-shell dc-table-card dc-receive-table-card dc-master-card">
        <div className="crm-table-scroll-wrap stocks-table-natural-wrap dc-table-scroll-body dc-receive-table-body">
          <table className="crm-master-table crm-data-table settings-table dc-table dc-receive-table dc-register-table">
            <colgroup>
              <col className="col-dc-no" style={{ width: '15%' }} />
              <col className="col-dc-date" style={{ width: '10%' }} />
              <col className="col-customer" style={{ width: '23%' }} />
              <col className="col-destination" style={{ width: '20%' }} />
              <col className="col-receiver" style={{ width: '12%' }} />
              <col className="col-status" style={{ width: '12%' }} />
              <col className="col-actions" style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="col-dc-no">DC NUMBER</th>
                <th className="col-dc-date">DC DATE</th>
                <th className="col-customer">CUSTOMER / CONSIGNEE</th>
                <th className="col-destination">DESTINATION</th>
                <th className="col-receiver">RECEIVER CONTACT</th>
                <th className="col-status" style={{ textAlign: 'center' }}>STATUS</th>
                <th className="col-actions" style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {pagination.currentItems.length === 0 ? (
                <DCEmptyState message={search.trim() ? `No delivery challans found matching "${search.trim()}".` : "No delivery challans available for receipt processing."} colSpan={7} />
              ) : (
                <>
                  {pagination.currentItems.map((dc, idx) => {
                  const destination = (dc.deliveryAddress || dc.customerAddress || dc.shippingAddress || dc.destination || '').trim();
                  const isPopoverOpen = activeReceiverPopoverId === dc.challanId;
                  const isNearBottom = idx >= filteredReceiveList.length - 2 && filteredReceiveList.length > 3;
                  const hasReceiver = Boolean(dc.receiverName && dc.receiverName.trim());
                  const phone = dc.receiverContact || dc.contactNumber || '';

                  return (
                    <tr key={dc.challanId} className={`table-data-row ${isPopoverOpen ? 'has-popover-open' : ''}`}>
                      <td className="cell-nowrap col-dc-no">
                        <span className="master-code dc-code-badge">
                          {dc.challanId}
                        </span>
                      </td>
                      <td className="cell-nowrap col-dc-date">
                        {formatDate(dc.deliveryDate || dc.createdAt)}
                      </td>
                      <td className="col-customer">
                        <div className="dc-cell-truncate" title={dc.customerName}>
                          <strong style={{ fontWeight: 600, color: '#1e293b' }}>{dc.customerName}</strong>
                        </div>
                      </td>
                      <td className="col-destination">
                        <div className="dc-cell-truncate" title={destination || 'No address specified'}>
                          <span style={{ fontSize: '12.5px', color: destination ? '#334155' : '#94a3b8' }}>
                            {destination || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="col-receiver">
                        {hasReceiver ? (
                          <div className="dc-receiver-cell-wrapper">
                            <button
                              type="button"
                              className={`dc-receiver-compact-pill ${isPopoverOpen ? 'is-open' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveReceiverPopoverId((prev) => (prev === dc.challanId ? null : dc.challanId));
                              }}
                              aria-expanded={isPopoverOpen}
                              aria-haspopup="dialog"
                              title="Click to view full receiver contact details"
                            >
                              <span className="dc-receiver-pill-name">{dc.receiverName}</span>
                              <ChevronDown size={11} className="dc-receiver-pill-arrow" />
                            </button>

                            {isPopoverOpen && (
                              <div
                                className={`dc-receiver-popover ${isNearBottom ? 'popover-up' : ''}`}
                                onClick={(e) => e.stopPropagation()}
                                role="dialog"
                                aria-label="Receiver Contact Details"
                              >
                                <div className="dc-receiver-popover-header">
                                  <span className="dc-popover-title-text">Receiver Contact</span>
                                  <button
                                    type="button"
                                    className="dc-popover-close-btn"
                                    onClick={() => setActiveReceiverPopoverId(null)}
                                    aria-label="Close"
                                  >
                                    <X size={11} />
                                  </button>
                                </div>
                                <div className="dc-popover-content">
                                  <div className="dc-popover-field">
                                    <span className="dc-popover-field-label">Name / Person</span>
                                    <span className="dc-popover-field-value highlight">{dc.receiverName}</span>
                                  </div>
                                  {phone && (
                                    <div className="dc-popover-field">
                                      <span className="dc-popover-field-label">Contact / Phone</span>
                                      <span className="dc-popover-field-value">{phone}</span>
                                    </div>
                                  )}
                                  {dc.contactPerson && dc.contactPerson !== dc.receiverName && (
                                    <div className="dc-popover-field">
                                      <span className="dc-popover-field-label">Contact Person</span>
                                      <span className="dc-popover-field-value">{dc.contactPerson}</span>
                                    </div>
                                  )}
                                  {dc.customerName && (
                                    <div className="dc-popover-field">
                                      <span className="dc-popover-field-label">Customer / Consignee</span>
                                      <span className="dc-popover-field-value">{dc.customerName}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="dc-cell-dash">—</span>
                        )}
                      </td>
                      <td className="col-status">
                        <DCStatusBadge status={dc.status || 'DISPATCHED'} />
                      </td>
                      <td className="col-actions">
                        <div className="dc-actions dc-receive-actions">
                          {dc.status !== 'DELIVERED' && (
                            <button
                              type="button"
                              className="dc-btn-action primary"
                              onClick={() => openReceiveModal(dc)}
                              title="Record Receipt &amp; Customer Signature"
                            >
                              <Check size={12} strokeWidth={2.5} />
                              <span>Acknowledge</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="dc-btn-action secondary"
                            onClick={() => onOpenDoc && onOpenDoc(dc)}
                            title="View printable Delivery Challan"
                          >
                            <Eye size={12} />
                            <span>View</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </>
            )}
            {filteredReceiveList.length > 0 && pagination.currentItems.length < pagination.pageSize && (
              Array.from({ length: pagination.pageSize - pagination.currentItems.length }).map((_, fIdx) => (
                <tr key={`filler-${fIdx}`} className="table-filler-row" aria-hidden="true">
                  <td className="col-dc-no">&nbsp;</td>
                  <td className="col-dc-date">&nbsp;</td>
                  <td className="col-customer">&nbsp;</td>
                  <td className="col-destination">&nbsp;</td>
                  <td className="col-receiver">&nbsp;</td>
                  <td className="col-status" style={{ textAlign: 'center' }}>&nbsp;</td>
                  <td className="col-actions" style={{ textAlign: 'right' }}>&nbsp;</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <TableFooter
        {...pagination.footerProps}
        recordLabel="deliveries"
        singularLabel="delivery"
        className="dc-table-footer dc-receive-footer"
      />
    </div>

      {/* Acknowledge Modal */}
      {receivingDc && (
        <div className="crm-modal-backdrop" onClick={() => setReceivingDc(null)}>
          <div className="crm-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="crm-modal-header">
              <h3>Confirm Delivery Acknowledgment - {receivingDc.challanId}</h3>
              <button type="button" className="crm-modal-close" onClick={() => setReceivingDc(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveReceipt}>
              <div className="crm-modal-body">
                <div className="crm-form-group">
                  <label className="crm-form-label">Receiver / Signatory Name *</label>
                  <input
                    type="text"
                    className="crm-form-input"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder="Full name of person who received consignment"
                    required
                  />
                </div>

                <div className="crm-form-group" style={{ marginTop: '12px' }}>
                  <label className="crm-form-label">Actual Receipt Date *</label>
                  <input
                    type="date"
                    className="crm-form-input"
                    value={receiveDate}
                    onChange={(e) => setReceiveDate(e.target.value)}
                    required
                  />
                </div>

                <div className="crm-form-group" style={{ marginTop: '12px' }}>
                  <label className="crm-form-label">Handover Confirmation Notes</label>
                  <textarea
                    className="crm-form-textarea"
                    rows={2}
                    value={receiveRemarks}
                    onChange={(e) => setReceiveRemarks(e.target.value)}
                    placeholder="Goods inspected and received in working condition."
                  />
                </div>
              </div>
              <div className="crm-modal-footer">
                <button type="button" className="crm-btn-secondary" onClick={() => setReceivingDc(null)}>
                  Cancel
                </button>
                <button type="submit" className="crm-btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : '✓ Confirm & Mark Delivered'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
