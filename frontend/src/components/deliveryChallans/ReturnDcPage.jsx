import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, X, Eye, RotateCcw, Package, AlertCircle, ArrowRight, History, CheckCircle, Clock, FileCheck, User } from 'lucide-react';
import { navigate } from '../../router';
import { DCStatusBadge } from './dcPrimitives';
import { TableFooter, useTablePagination } from '../common/TableWorkspace';
import { calculateDcReturnMetrics } from './dcReturnCalculator';
import { filterRecordsBySearch } from '../../utils/searchHelper';
import { formatDate } from '../../utils/dateUtils';

export default function ReturnDcPage({ challans = [], user, onRefresh, onOpenDoc }) {
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'eligible' | 'partial' | 'full'
  const [searchTerm, setSearchTerm] = useState('');
  const [openReasonId, setOpenReasonId] = useState(null);

  useEffect(() => {
    setOpenReasonId(null);
  }, [searchTerm, activeTab]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.dc-return-reason-wrapper')) {
        setOpenReasonId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpenReasonId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 1. Process all challans with return metrics
  const processedChallans = useMemo(() => {
    return challans
      .filter((c) => c.status !== 'DRAFT')
      .map((c) => ({
        ...c,
        metrics: calculateDcReturnMetrics(c)
      }));
  }, [challans]);

  // 2. Individual Return Transactions across all challans (Return History)
  const historyTransactions = useMemo(() => {
    const txns = [];
    processedChallans.forEach((dc) => {
      const history = Array.isArray(dc.returnedHistory) ? dc.returnedHistory : [];
      if (history.length > 0) {
        history.forEach((h, idx) => {
          const retId = h.returnId || h.id || `RET-${dc.challanId}-${idx + 1}`;
          const isPartial = h.isPartialReturn !== undefined
            ? h.isPartialReturn
            : (Number(h.remainingUnits !== undefined ? h.remainingUnits : dc.metrics.remainingReturnableQty) > 0);

          txns.push({
            ...h,
            isReturnDocument: true,
            returnId: retId,
            originalChallanId: dc.challanId,
            challanId: dc.challanId,
            orderId: dc.orderId || h.orderId,
            customerName: dc.customerName || h.customerName || dc.receiverName || 'Valued Customer',
            company: dc.company || h.company,
            customerAddress: dc.customerAddress || h.customerAddress,
            deliveryAddress: dc.deliveryAddress || h.deliveryAddress,
            gstin: dc.gstin || h.gstin,
            transitMode: dc.transitMode || h.transitMode,
            returnDate: h.date || h.returnDate || dc.returnDate || dc.deliveryDate,
            reason: h.reason || h.returnReason || dc.returnReason || 'Equipment Return',
            remarks: h.remarks || h.returnRemarks || dc.returnRemarks || '',
            returnedUnits: Number(h.returnedUnits || 1),
            remainingUnits: Number(h.remainingUnits !== undefined ? h.remainingUnits : 0),
            documentType: h.documentType || (isPartial ? 'PARTIAL_RETURN_DC' : 'RETURN_DC'),
            documentTitle: h.documentTitle || (isPartial ? 'PARTIAL RETURN DC' : 'RETURN DC'),
            returnStatus: h.returnStatus || (isPartial ? 'PARTIALLY_RETURNED' : 'FULLY_RETURNED'),
            status: isPartial ? 'PARTIALLY RETURNED' : 'FULLY RETURNED',
            originalPurpose: dc.metrics.originalPurpose,
            items: Array.isArray(h.items) && h.items.length > 0 ? h.items : dc.items,
            executiveEngineer: h.executiveEngineer || dc.executiveEngineer || '',
            materialReturnedBy: h.materialReturnedBy || dc.materialReturnedBy || '',
            timestamp: h.timestamp || h.date || dc.updatedAt || dc.createdAt
          });
        });
      } else if (dc.status === 'RETURNED' || dc.status === 'PARTIALLY RETURNED' || Number(dc.returnedUnits || 0) > 0) {
        // Synthesize fallback history item for legacy records
        const isPartial = dc.metrics.returnState === 'PARTIALLY_RETURNED';
        txns.push({
          isReturnDocument: true,
          returnId: dc.returnId || dc.lastReturnId || `RET-${dc.challanId}`,
          originalChallanId: dc.challanId,
          challanId: dc.challanId,
          orderId: dc.orderId,
          customerName: dc.customerName || dc.receiverName || 'Valued Customer',
          company: dc.company,
          customerAddress: dc.customerAddress,
          deliveryAddress: dc.deliveryAddress,
          gstin: dc.gstin,
          transitMode: dc.transitMode,
          returnDate: dc.returnDate || dc.deliveryDate,
          reason: dc.returnReason || 'Equipment Return',
          remarks: dc.returnRemarks || '',
          returnedUnits: dc.metrics.cumulativeReturnedQty,
          remainingUnits: dc.metrics.remainingReturnableQty,
          documentType: isPartial ? 'PARTIAL_RETURN_DC' : 'RETURN_DC',
          documentTitle: isPartial ? 'PARTIAL RETURN DC' : 'RETURN DC',
          returnStatus: isPartial ? 'PARTIALLY_RETURNED' : 'FULLY_RETURNED',
          status: isPartial ? 'PARTIALLY RETURNED' : 'FULLY RETURNED',
          originalPurpose: dc.metrics.originalPurpose,
          items: dc.items,
          executiveEngineer: dc.executiveEngineer || '',
          materialReturnedBy: dc.materialReturnedBy || '',
          timestamp: dc.updatedAt || dc.createdAt
        });
      }
    });

    // Ascending sort by return sequence
    return txns.sort((a, b) => {
      const aVal = String(a.returnId || a.challanId || '');
      const bVal = String(b.returnId || b.challanId || '');
      const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
      const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
      if (aNum && bNum && aNum !== bNum) return aNum - bNum;
      return aVal.localeCompare(bVal, undefined, { numeric: true });
    });
  }, [processedChallans]);

  // 3. Eligible Challans: Dispatched/Delivered with remaining returnable quantity > 0
  const eligibleChallans = useMemo(() => {
    return processedChallans
      .filter((dc) => dc.metrics.isEligibleForReturn)
      .sort((a, b) => {
        const aNum = Number(String(a.challanId || '').match(/(\d+)$/)?.[1] || 0);
        const bNum = Number(String(b.challanId || '').match(/(\d+)$/)?.[1] || 0);
        if (aNum && bNum && aNum !== bNum) return aNum - bNum;
        return String(a.challanId || '').localeCompare(String(b.challanId || ''), undefined, { numeric: true });
      });
  }, [processedChallans]);

  // 4. Partially Returned Challans
  const partiallyReturnedChallans = useMemo(() => {
    return processedChallans
      .filter((dc) => dc.metrics.returnState === 'PARTIALLY_RETURNED')
      .sort((a, b) => {
        const aNum = Number(String(a.challanId || '').match(/(\d+)$/)?.[1] || 0);
        const bNum = Number(String(b.challanId || '').match(/(\d+)$/)?.[1] || 0);
        if (aNum && bNum && aNum !== bNum) return aNum - bNum;
        return String(a.challanId || '').localeCompare(String(b.challanId || ''), undefined, { numeric: true });
      });
  }, [processedChallans]);

  // 5. Fully Returned Challans
  const fullyReturnedChallans = useMemo(() => {
    return processedChallans
      .filter((dc) => dc.metrics.returnState === 'FULLY_RETURNED')
      .sort((a, b) => {
        const aNum = Number(String(a.challanId || '').match(/(\d+)$/)?.[1] || 0);
        const bNum = Number(String(b.challanId || '').match(/(\d+)$/)?.[1] || 0);
        if (aNum && bNum && aNum !== bNum) return aNum - bNum;
        return String(a.challanId || '').localeCompare(String(b.challanId || ''), undefined, { numeric: true });
      });
  }, [processedChallans]);

  // 6. Active list based on active tab
  const activeRawList = useMemo(() => {
    switch (activeTab) {
      case 'history':
        return historyTransactions;
      case 'eligible':
        return eligibleChallans;
      case 'partial':
        return partiallyReturnedChallans;
      case 'full':
        return fullyReturnedChallans;
      default:
        return historyTransactions;
    }
  }, [activeTab, historyTransactions, eligibleChallans, partiallyReturnedChallans, fullyReturnedChallans]);

  // 7. Filter active list by search term
  const filteredList = useMemo(() => {
    return filterRecordsBySearch(activeRawList, searchTerm, [
      (item) => item.returnId,
      (item) => item.challanId,
      (item) => item.originalChallanId,
      (item) => item.orderId,
      (item) => item.customerName,
      (item) => item.company,
      (item) => item.reason,
      (item) => item.returnReason,
      (item) => item.remarks,
      (item) => item.originalPurpose,
      (item) => item.transitMode,
      (item) => item.items?.map((it) => `${it.productName || ''} ${it.productCode || it.sku || ''} ${(it.serialNumbers || []).join(' ')} ${(it.returnedSerials || []).join(' ')}`)
    ]);
  }, [activeRawList, searchTerm]);

  const pagination = useTablePagination(filteredList, {
    rowHeight: 45,
    resetDeps: [searchTerm, activeTab]
  });

  const handleInitiateReturn = (dcId = null) => {
    if (dcId) {
      navigate(`/delivery-challans/return/new?dcId=${encodeURIComponent(dcId)}`);
    } else {
      navigate('/delivery-challans/return/new');
    }
  };

  const handleViewOriginalDc = (dc) => {
    if (onOpenDoc) {
      onOpenDoc({ ...dc, isReturnDocument: false });
    }
  };

  const handleViewReturnDoc = (txn) => {
    if (onOpenDoc) {
      onOpenDoc({ ...txn, isReturnDocument: true });
    }
  };

  return (
    <div className="delivery-challans-module-wrapper dc-page-container dc-return-page">
      {/* 1. Header Row matching Customer Directory */}
      <div className="page-header-row customer-page-header">
        <h1 className="page-title">Return DC Management</h1>
      </div>

      {/* 2. Customer Directory-matched Toolbar Card */}
      <div className="customer-toolbar-card dc-toolbar-card">
        <div className="dc-toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 auto', minWidth: 0, flexWrap: 'wrap' }}>
          {/* Search Box matching Customer Directory */}
          <div className="customer-search-input-wrap" style={{ maxWidth: '320px', minWidth: '200px', flex: '0 1 320px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder={
                activeTab === 'history'
                  ? 'Search Return No / DC / Customer / Reason...'
                  : 'Search DC No / Customer / Product...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="customer-search-input-field"
              aria-label="Search returns"
            />
            {searchTerm && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchTerm('')}
                title="Clear search"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Tab Buttons matching Customer Directory */}
          <div className="dc-status-tabs" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`dc-filter-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('history');
                setSearchTerm('');
              }}
            >
              <History size={13} />
              <span>Return History</span>
              <span className="filter-count">{historyTransactions.length}</span>
            </button>

            <button
              type="button"
              className={`dc-filter-btn ${activeTab === 'eligible' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('eligible');
                setSearchTerm('');
              }}
            >
              <Clock size={13} />
              <span>Eligible for Return</span>
              <span className="filter-count">{eligibleChallans.length}</span>
            </button>

            <button
              type="button"
              className={`dc-filter-btn ${activeTab === 'partial' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('partial');
                setSearchTerm('');
              }}
            >
              <RotateCcw size={13} />
              <span>Partially Returned</span>
              <span className="filter-count">{partiallyReturnedChallans.length}</span>
            </button>

            <button
              type="button"
              className={`dc-filter-btn ${activeTab === 'full' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('full');
                setSearchTerm('');
              }}
            >
              <CheckCircle size={13} />
              <span>Fully Returned</span>
              <span className="filter-count">{fullyReturnedChallans.length}</span>
            </button>
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
            className="crm-btn-primary compact add-customer-btn"
            onClick={() => handleInitiateReturn()}
            title="Initiate Return for an Active Delivery Challan"
          >
            <Plus size={14} />
            <span>Initiate Return</span>
          </button>
        </div>
      </div>

      {/* 3. Main Master Table Card matching Customer Directory Ledger */}
      <div className="settings-table-shell stocks-table-shell customer-master-card" style={{ height: '100%' }}>
        {activeRawList.length === 0 ? (
          <div className="dc-register-empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div className="dc-empty-icon-wrap" style={{ marginBottom: '12px' }}>
              <RotateCcw size={32} style={{ color: '#94a3b8' }} />
            </div>
            <h4 className="dc-empty-title" style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: '0 0 6px 0' }}>
              {activeTab === 'history' && 'No return transactions recorded yet'}
              {activeTab === 'eligible' && 'No delivery challans currently eligible for return'}
              {activeTab === 'partial' && 'No partially returned challans'}
              {activeTab === 'full' && 'No fully returned challans yet'}
            </h4>
            <p className="dc-empty-text" style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0', maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>
              {activeTab === 'history' && 'Consignments with recorded returns or equipment handbacks will appear in this historical register.'}
              {activeTab === 'eligible' && 'All dispatched and delivered consignments have been fully returned or none are active.'}
              {activeTab === 'partial' && 'Consignments where only a portion of goods were returned will be listed here.'}
              {activeTab === 'full' && 'Consignments where 100% of dispatched goods were returned will appear here.'}
            </p>
            {activeTab !== 'full' && (
              <button
                type="button"
                className="crm-btn-primary compact"
                onClick={() => handleInitiateReturn()}
              >
                <Plus size={14} />
                <span>Initiate Return</span>
              </button>
            )}
          </div>
        ) : filteredList.length === 0 ? (
          <div className="dc-register-empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <AlertCircle size={28} style={{ color: '#94a3b8', marginBottom: '8px' }} />
            <h4 className="dc-empty-title" style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: '0 0 6px 0' }}>No matching records</h4>
            <p className="dc-empty-text" style={{ fontSize: '13px', color: '#64748b', margin: '0 0 12px 0' }}>
              No entries match "<strong>{searchTerm}</strong>".
            </p>
            <button
              type="button"
              className="crm-btn-secondary compact"
              onClick={() => setSearchTerm('')}
            >
              Clear Search
            </button>
          </div>
        ) : activeTab === 'history' ? (
          /* TAB 1: RETURN HISTORY (Separate Transactions) */
          <div className="crm-table-scroll-wrap stocks-table-natural-wrap dc-return-table-body">
            <table className="settings-table customer-directory-table dc-table dc-return-table">
              <colgroup>
                <col style={{ width: '13%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '19%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '4%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="col-priority-high">RETURN NO</th>
                  <th className="col-priority-high">ORIGINAL DC</th>
                  <th className="col-priority-med">RETURN DATE</th>
                  <th className="col-priority-high">CUSTOMER / CONSIGNEE</th>
                  <th className="col-priority-low">PURPOSE</th>
                  <th className="col-priority-low">RETURN REASON</th>
                  <th className="col-priority-med" style={{ textAlign: 'center' }}>RETURNED</th>
                  <th className="col-priority-high" style={{ textAlign: 'center' }}>STATUS</th>
                  <th className="actions-col col-priority-high" style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {pagination.currentItems.map((txn, idx) => {
                  const custName = txn.customerName || 'Valued Customer';
                  const comp = txn.company && txn.company !== custName ? txn.company : '';
                  const reasonText = txn.reason || 'Equipment Return';
                  const rowKey = txn.returnId || txn.id;
                  const isReasonOpen = openReasonId === rowKey;
                  const isNearBottom = idx >= pagination.currentItems.length - 3 && pagination.currentItems.length > 3;

                  return (
                    <tr key={rowKey} className={`table-data-row ${isReasonOpen ? 'has-open-popover' : ''}`}>
                      {/* RETURN NO */}
                      <td data-label="RETURN NO" className="cell-nowrap">
                        <button
                          type="button"
                          className="customer-id-pill master-code link-code-btn"
                          onClick={() => handleViewReturnDoc(txn)}
                          title={`View Return DC ${txn.returnId}`}
                          style={{ background: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' }}
                        >
                          {txn.returnId}
                        </button>
                      </td>

                      {/* ORIGINAL DC */}
                      <td data-label="ORIGINAL DC" className="cell-nowrap">
                        <span className="customer-id-pill master-code" style={{ background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }}>
                          {txn.originalChallanId}
                        </span>
                      </td>

                      {/* RETURN DATE */}
                      <td data-label="RETURN DATE" className="cell-nowrap" style={{ fontSize: '13px', color: '#475569' }}>
                        {formatDate(txn.returnDate)}
                      </td>

                      {/* CUSTOMER */}
                      <td data-label="CUSTOMER / CONSIGNEE" className="cell-wrap">
                        <div className="customer-name-cell">
                          <span className="customer-company-title" title={comp || custName}>
                            {comp || custName}
                          </span>
                          {(comp && comp !== custName) && (
                            <div className="customer-contact-sub">
                              <User size={11} className="customer-sub-icon" />
                              <span>{custName}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* PURPOSE */}
                      <td data-label="PURPOSE">
                        <span
                          className={`dc-purpose-badge ${txn.originalPurpose === 'Returnable / Temporary' ? 'returnable' : 'normal'}`}
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: txn.originalPurpose === 'Returnable / Temporary' ? '#eff6ff' : '#f1f5f9',
                            color: txn.originalPurpose === 'Returnable / Temporary' ? '#1d4ed8' : '#475569',
                            border: `1px solid ${txn.originalPurpose === 'Returnable / Temporary' ? '#bfdbfe' : '#cbd5e1'}`
                          }}
                        >
                          {txn.originalPurpose}
                        </span>
                      </td>

                      {/* RETURN REASON DROPDOWN */}
                      <td data-label="RETURN REASON" className="dc-return-reason-cell">
                        <div className="quotation-items-wrapper dc-return-reason-wrapper">
                          <button
                            type="button"
                            className={`quotation-items-trigger dc-reason-trigger ${isReasonOpen ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenReasonId(isReasonOpen ? null : rowKey);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpenReasonId(isReasonOpen ? null : rowKey);
                              }
                            }}
                            aria-expanded={isReasonOpen}
                            aria-haspopup="true"
                            title="Click to view full return reason and remarks"
                          >
                            <span className="dc-reason-btn-text">{reasonText}</span>
                            <span className="quotation-items-arrow" aria-hidden="true">{isReasonOpen ? '▴' : '▾'}</span>
                          </button>

                          {isReasonOpen && (
                            <div
                              className={`quotation-items-popover dc-reason-popover ${isNearBottom ? 'placement-top' : ''}`}
                              role="dialog"
                              aria-label="Return reason and remarks"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="quotation-items-popover-header">
                                <span>RETURN REASON &amp; REMARKS</span>
                                <button
                                  type="button"
                                  className="quotation-items-popover-close"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenReasonId(null);
                                  }}
                                  aria-label="Close"
                                  title="Close"
                                >
                                  ×
                                </button>
                              </div>
                              <div className="dc-reason-popover-body">
                                <div className="dc-reason-popover-row">
                                  <span className="dc-reason-popover-label">Reason:</span>
                                  <span className="dc-reason-popover-value font-semibold" style={{ fontWeight: 600 }}>{reasonText}</span>
                                </div>
                                {txn.remarks && (
                                  <div className="dc-reason-popover-row">
                                    <span className="dc-reason-popover-label">Remarks:</span>
                                    <span className="dc-reason-popover-value">{txn.remarks}</span>
                                  </div>
                                )}
                                {txn.materialReturnedBy && (
                                  <div className="dc-reason-popover-row">
                                    <span className="dc-reason-popover-label">Returned By:</span>
                                    <span className="dc-reason-popover-value">{txn.materialReturnedBy}</span>
                                  </div>
                                )}
                                {Array.isArray(txn.items) && txn.items.length > 0 && (
                                  <div className="dc-reason-popover-items-section">
                                    <div className="dc-reason-popover-subhead">Items Returned:</div>
                                    <ul className="quotation-items-popover-list">
                                      {txn.items.map((it, pIdx) => (
                                        <li key={pIdx} className="quotation-items-popover-item">
                                          <span className="popover-item-qty">{it.returnedQty || it.quantity || 1} ×</span>
                                          <span className="popover-item-name">
                                            {it.productName || it.name || 'Item'}
                                            {Array.isArray(it.returnedSerials) && it.returnedSerials.length > 0 && (
                                              <span className="dc-reason-popover-serials">
                                                S/N: {it.returnedSerials.join(', ')}
                                              </span>
                                            )}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* RETURNED */}
                      <td data-label="RETURNED" style={{ textAlign: 'center' }}>
                        <span className="count-badge active-count">
                          {txn.returnedUnits}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td data-label="STATUS" style={{ textAlign: 'center' }}>
                        <DCStatusBadge status={txn.status} />
                      </td>

                      {/* ACTIONS */}
                      <td data-label="ACTIONS" className="actions-col" style={{ textAlign: 'right' }}>
                        <div className="settings-row-actions" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            className="settings-row-action customer-action-btn dc-action-btn-secondary"
                            onClick={() => handleViewReturnDoc(txn)}
                            title="View Return DC Document / PDF"
                          >
                            <Eye size={12} />
                            <span>View</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredList.length > 0 && pagination.currentItems.length < pagination.pageSize && (
                  Array.from({ length: pagination.pageSize - pagination.currentItems.length }).map((_, fIdx) => (
                    <tr key={`filler-${fIdx}`} className="table-data-row table-filler-row" aria-hidden="true">
                      <td>&nbsp;</td>
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
        ) : (
          /* TABS 2, 3, 4: CHALLAN SUMMARY VIEWS */
          <div className="crm-table-scroll-wrap stocks-table-natural-wrap dc-return-table-body">
            <table className="settings-table customer-directory-table dc-table dc-return-table">
              <colgroup>
                <col style={{ width: '13%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '21%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '9%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="col-priority-high">DC NUMBER</th>
                  <th className="col-priority-med">DATE</th>
                  <th className="col-priority-high">CUSTOMER / CONSIGNEE</th>
                  <th className="col-priority-low">PURPOSE</th>
                  <th className="col-priority-med" style={{ textAlign: 'center' }}>SENT</th>
                  <th className="col-priority-med" style={{ textAlign: 'center' }}>RETURNED</th>
                  <th className="col-priority-med" style={{ textAlign: 'center' }}>REMAINING</th>
                  <th className="col-priority-high" style={{ textAlign: 'center' }}>STATUS</th>
                  <th className="actions-col col-priority-high" style={{ textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {pagination.currentItems.map((dc) => {
                  const m = dc.metrics;
                  const custName = dc.customerName || dc.receiverName || 'Valued Customer';
                  const comp = dc.company && dc.company !== custName ? dc.company : '';

                  return (
                    <tr key={dc.challanId} className="table-data-row">
                      {/* DC NUMBER */}
                      <td data-label="DC NUMBER" className="cell-nowrap">
                        <button
                          type="button"
                          className="customer-id-pill master-code link-code-btn"
                          onClick={() => handleViewOriginalDc(dc)}
                          title={`View DC ${dc.challanId}`}
                        >
                          {dc.challanId}
                        </button>
                      </td>

                      {/* DATE */}
                      <td data-label="DATE" className="cell-nowrap" style={{ fontSize: '13px', color: '#475569' }}>
                        {formatDate(dc.deliveryDate)}
                      </td>

                      {/* CUSTOMER */}
                      <td data-label="CUSTOMER / CONSIGNEE" className="cell-wrap">
                        <div className="customer-name-cell">
                          <span className="customer-company-title" title={comp || custName}>
                            {comp || custName}
                          </span>
                          {(comp && comp !== custName) && (
                            <div className="customer-contact-sub">
                              <User size={11} className="customer-sub-icon" />
                              <span>{custName}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* PURPOSE */}
                      <td data-label="PURPOSE">
                        <span
                          className={`dc-purpose-badge ${m.originalPurpose === 'Returnable / Temporary' ? 'returnable' : 'normal'}`}
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: m.originalPurpose === 'Returnable / Temporary' ? '#eff6ff' : '#f1f5f9',
                            color: m.originalPurpose === 'Returnable / Temporary' ? '#1d4ed8' : '#475569',
                            border: `1px solid ${m.originalPurpose === 'Returnable / Temporary' ? '#bfdbfe' : '#cbd5e1'}`
                          }}
                        >
                          {m.originalPurpose}
                        </span>
                      </td>

                      {/* SENT */}
                      <td data-label="SENT" style={{ textAlign: 'center' }}>
                        <span className="count-badge">{m.originalDeliveredQty}</span>
                      </td>

                      {/* RETURNED */}
                      <td data-label="RETURNED" style={{ textAlign: 'center' }}>
                        <span className="count-badge active-count">
                          {m.cumulativeReturnedQty}
                        </span>
                      </td>

                      {/* REMAINING */}
                      <td data-label="REMAINING" style={{ textAlign: 'center' }}>
                        <span className={`count-badge ${m.remainingReturnableQty > 0 ? 'active-count' : ''}`}>
                          {m.remainingReturnableQty}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td data-label="STATUS" style={{ textAlign: 'center' }}>
                        <DCStatusBadge status={m.statusBadge} />
                      </td>

                      {/* ACTIONS */}
                      <td data-label="ACTIONS" className="actions-col" style={{ textAlign: 'right' }}>
                        <div className="settings-row-actions" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                          {m.isEligibleForReturn && (
                            <button
                              type="button"
                              className="settings-row-action customer-action-btn dc-action-btn-primary"
                              onClick={() => handleInitiateReturn(dc.challanId)}
                              title="Return Remaining Units"
                            >
                              <RotateCcw size={11} />
                              <span>Return</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="settings-row-action customer-action-btn dc-action-btn-secondary"
                            onClick={() => handleViewOriginalDc(dc)}
                            title="View Original Delivery Challan"
                          >
                            <Eye size={11} />
                            <span>View DC</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredList.length > 0 && pagination.currentItems.length < pagination.pageSize && (
                  Array.from({ length: pagination.pageSize - pagination.currentItems.length }).map((_, fIdx) => (
                    <tr key={`filler-${fIdx}`} className="table-data-row table-filler-row" aria-hidden="true">
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td style={{ textAlign: 'center' }}>&nbsp;</td>
                      <td style={{ textAlign: 'center' }}>&nbsp;</td>
                      <td style={{ textAlign: 'center' }}>&nbsp;</td>
                      <td style={{ textAlign: 'center' }}>&nbsp;</td>
                      <td style={{ textAlign: 'right' }}>&nbsp;</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <TableFooter
          {...pagination.footerProps}
          recordLabel="records"
          singularLabel="record"
          className="customer-directory-footer dc-table-footer"
        />
      </div>
    </div>
  );
}
