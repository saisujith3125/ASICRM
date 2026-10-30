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

  const receiveTabs = [
    { key: 'ALL', label: 'All Deliveries', count: challans.length },
    { key: 'PENDING', label: 'Pending Receipt', count: challans.filter((c) => c.status !== 'DELIVERED' && c.status !== 'RETURNED').length },
    { key: 'DELIVERED', label: 'Acknowledged', count: challans.filter((c) => c.status === 'DELIVERED').length }
  ];

  return (
    <div className="crm-customer-page-container dc-page-container dc-receive-page">
      {/* 1. Page Header matching Customer Directory */}
      <div className="page-header-row customer-page-header">
        <h1 className="page-title">DC Receive &amp; Acknowledgment</h1>
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
          <div className="customer-search-input-wrap" style={{ maxWidth: '320px', minWidth: '220px', flex: '0 1 320px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search DC No / Customer / Destination..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="customer-search-input-field"
              aria-label="Search deliveries"
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
            {receiveTabs.map((t) => (
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
        </div>
      </div>

      {/* 3. Main Master Table Card matching Customer Directory Ledger */}
      <div className="settings-table-shell stocks-table-shell customer-master-card" style={{ height: '100%' }}>
        <div className="crm-table-scroll-wrap stocks-table-natural-wrap dc-receive-table-body">
          <table className="settings-table customer-directory-table dc-table dc-receive-table">
            <colgroup>
              <col style={{ width: '15%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '23%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="col-priority-high">DC NUMBER</th>
                <th className="col-priority-med">DC DATE</th>
                <th className="col-priority-high">CUSTOMER / CONSIGNEE</th>
                <th className="col-priority-low">DESTINATION</th>
                <th className="col-priority-low">RECEIVER CONTACT</th>
                <th className="col-priority-high" style={{ textAlign: 'center' }}>STATUS</th>
                <th className="actions-col col-priority-high" style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {pagination.currentItems.length === 0 ? (
                <DCEmptyState message={search.trim() ? `No delivery challans found matching "${search.trim()}".` : "No delivery challans available for receipt processing."} colSpan={7} />
              ) : (
                pagination.currentItems.map((dc, idx) => {
                  const destination = (dc.deliveryAddress || dc.customerAddress || dc.shippingAddress || dc.destination || '').trim();
                  const isPopoverOpen = activeReceiverPopoverId === dc.challanId;
                  const isNearBottom = idx >= filteredReceiveList.length - 2 && filteredReceiveList.length > 3;
                  const hasReceiver = Boolean(dc.receiverName && dc.receiverName.trim());
                  const phone = dc.receiverContact || dc.contactNumber || '';

                  return (
                    <tr key={dc.challanId} className={`table-data-row ${isPopoverOpen ? 'has-popover-open' : ''}`}>
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
                      <td data-label="DC DATE" className="cell-nowrap" style={{ fontSize: '13px', color: '#475569' }}>
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
                      <td data-label="DESTINATION" className="cell-truncate" title={destination || 'No address specified'}>
                        <span style={{ fontSize: '12.5px', color: destination ? '#334155' : '#94a3b8' }}>
                          {destination || '—'}
                        </span>
                      </td>
                      <td data-label="RECEIVER CONTACT">
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
                      <td data-label="STATUS" style={{ textAlign: 'center' }}>
                        <DCStatusBadge status={dc.status || 'DISPATCHED'} />
                      </td>
                      <td data-label="ACTIONS" className="actions-col" style={{ textAlign: 'right' }}>
                        <div className="settings-row-actions" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                          {dc.status !== 'DELIVERED' && dc.status !== 'RETURNED' && (
                            <button
                              type="button"
                              className="settings-row-action primary customer-action-btn dc-action-btn-primary"
                              onClick={() => openReceiveModal(dc)}
                              title="Record Receipt & Customer Signature"
                            >
                              <Check size={12} strokeWidth={2.5} />
                              <span>Acknowledge</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="settings-row-action customer-action-btn dc-action-btn-secondary"
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
                })
              )}
              {filteredReceiveList.length > 0 && pagination.currentItems.length < pagination.pageSize && (
                Array.from({ length: pagination.pageSize - pagination.currentItems.length }).map((_, fIdx) => (
                  <tr key={`filler-${fIdx}`} className="table-data-row table-filler-row" aria-hidden="true">
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
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
                    placeholder="e.g. Received intact by security gate with stamp."
                  />
                </div>
              </div>
              <div className="crm-modal-footer">
                <button type="button" className="crm-btn-secondary" onClick={() => setReceivingDc(null)}>
                  Cancel
                </button>
                <button type="submit" className="crm-btn-primary" disabled={saving}>
                  {saving ? 'Confirming...' : 'Confirm Delivery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
