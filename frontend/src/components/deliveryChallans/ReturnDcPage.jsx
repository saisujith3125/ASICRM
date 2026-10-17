import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, X, Eye, RotateCcw, Package, AlertCircle, ArrowRight, History, CheckCircle, Clock, FileCheck } from 'lucide-react';
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

    // Sort newest return transactions first
    return txns.sort((a, b) => new Date(b.timestamp || b.returnDate || 0) - new Date(a.timestamp || a.returnDate || 0));
  }, [processedChallans]);

  // 3. Eligible for Return (remainingReturnableQty > 0) - Ascending order (1 above 2)
  const eligibleChallans = useMemo(() => {
    return processedChallans
      .filter((c) => c.metrics.isEligibleForReturn)
      .sort((a, b) => {
        const aVal = String(a.challanId || '');
        const bVal = String(b.challanId || '');
        const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
        const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
        if (aNum && bNum && aNum !== bNum) return aNum - bNum;
        return aVal.localeCompare(bVal, undefined, { numeric: true });
      });
  }, [processedChallans]);

  // 4. Partially Returned (cumulativeReturnedQty > 0 && remainingReturnableQty > 0) - Ascending order (1 above 2)
  const partiallyReturnedChallans = useMemo(() => {
    return processedChallans
      .filter((c) => c.metrics.cumulativeReturnedQty > 0 && c.metrics.remainingReturnableQty > 0)
      .sort((a, b) => {
        const aVal = String(a.challanId || '');
        const bVal = String(b.challanId || '');
        const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
        const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
        if (aNum && bNum && aNum !== bNum) return aNum - bNum;
        return aVal.localeCompare(bVal, undefined, { numeric: true });
      });
  }, [processedChallans]);

  // 5. Fully Returned (cumulativeReturnedQty > 0 && remainingReturnableQty === 0) - Ascending order (1 above 2)
  const fullyReturnedChallans = useMemo(() => {
    return processedChallans
      .filter((c) => c.metrics.cumulativeReturnedQty > 0 && c.metrics.remainingReturnableQty === 0)
      .sort((a, b) => {
        const aVal = String(a.challanId || '');
        const bVal = String(b.challanId || '');
        const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
        const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
        if (aNum && bNum && aNum !== bNum) return aNum - bNum;
        return aVal.localeCompare(bVal, undefined, { numeric: true });
      });
  }, [processedChallans]);

  // 6. Active list based on activeTab
  const activeRawList = useMemo(() => {
    switch (activeTab) {
      case 'eligible':
        return eligibleChallans;
      case 'partial':
        return partiallyReturnedChallans;
      case 'full':
        return fullyReturnedChallans;
      case 'history':
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
    <div className="dc-page-container dc-return-page">
      {/* 1. Page Header with Title and Subtitle */}
      <div className="dc-page-header compact-header">
        <div className="dc-header-left">
          <h2 className="dc-page-title">Return DC Management</h2>
          <p className="dc-page-subtitle" style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
            Consignment return register, partial return tracking, and inventory restoration history.
          </p>
        </div>
      </div>

      {/* 2. Main Dominant Returned Challans Register Card */}
      <div className="settings-table-shell stocks-table-shell dc-return-register-card dc-master-card">
        {/* Navigation Tabs Bar */}
        <div className="dc-return-tabs-nav" style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #e2e8f0', padding: '0 16px', background: '#f8fafc', gap: '8px' }}>
          <button
            type="button"
            className={`dc-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('history');
              setSearchTerm('');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 14px',
              border: 'none',
              background: 'transparent',
              fontSize: '13px',
              fontWeight: activeTab === 'history' ? 700 : 500,
              color: activeTab === 'history' ? '#2563eb' : '#64748b',
              borderBottom: activeTab === 'history' ? '2px solid #2563eb' : '2px solid transparent',
              cursor: 'pointer'
            }}
          >
            <History size={14} />
            <span>Return History</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                background: activeTab === 'history' ? '#dbeafe' : '#e2e8f0',
                color: activeTab === 'history' ? '#1e40af' : '#475569',
                fontWeight: 600
              }}
            >
              {historyTransactions.length}
            </span>
          </button>

          <button
            type="button"
            className={`dc-tab-btn ${activeTab === 'eligible' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('eligible');
              setSearchTerm('');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 14px',
              border: 'none',
              background: 'transparent',
              fontSize: '13px',
              fontWeight: activeTab === 'eligible' ? 700 : 500,
              color: activeTab === 'eligible' ? '#2563eb' : '#64748b',
              borderBottom: activeTab === 'eligible' ? '2px solid #2563eb' : '2px solid transparent',
              cursor: 'pointer'
            }}
          >
            <Clock size={14} />
            <span>Eligible for Return</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                background: activeTab === 'eligible' ? '#dbeafe' : '#e2e8f0',
                color: activeTab === 'eligible' ? '#1e40af' : '#475569',
                fontWeight: 600
              }}
            >
              {eligibleChallans.length}
            </span>
          </button>

          <button
            type="button"
            className={`dc-tab-btn ${activeTab === 'partial' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('partial');
              setSearchTerm('');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 14px',
              border: 'none',
              background: 'transparent',
              fontSize: '13px',
              fontWeight: activeTab === 'partial' ? 700 : 500,
              color: activeTab === 'partial' ? '#2563eb' : '#64748b',
              borderBottom: activeTab === 'partial' ? '2px solid #2563eb' : '2px solid transparent',
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={14} />
            <span>Partially Returned</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                background: activeTab === 'partial' ? '#fef3c7' : '#e2e8f0',
                color: activeTab === 'partial' ? '#92400e' : '#475569',
                fontWeight: 600
              }}
            >
              {partiallyReturnedChallans.length}
            </span>
          </button>

          <button
            type="button"
            className={`dc-tab-btn ${activeTab === 'full' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('full');
              setSearchTerm('');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '12px 14px',
              border: 'none',
              background: 'transparent',
              fontSize: '13px',
              fontWeight: activeTab === 'full' ? 700 : 500,
              color: activeTab === 'full' ? '#2563eb' : '#64748b',
              borderBottom: activeTab === 'full' ? '2px solid #2563eb' : '2px solid transparent',
              cursor: 'pointer'
            }}
          >
            <CheckCircle size={14} />
            <span>Fully Returned</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                background: activeTab === 'full' ? '#fee2e2' : '#e2e8f0',
                color: activeTab === 'full' ? '#991b1b' : '#475569',
                fontWeight: 600
              }}
            >
              {fullyReturnedChallans.length}
            </span>
          </button>
        </div>

        {/* Register Toolbar: Title + Count on LEFT, Search + Initiate Return on RIGHT */}
        <div className="dc-register-toolbar">
          <div className="dc-register-toolbar-left">
            <h3 className="dc-register-title">
              {activeTab === 'history' && 'Historical Return Transactions'}
              {activeTab === 'eligible' && 'Consignments Eligible for Return'}
              {activeTab === 'partial' && 'Partially Returned Consignments'}
              {activeTab === 'full' && 'Fully Returned Challans Register'}
            </h3>
            <span className="dc-register-count-pill">
              {filteredList.length} {filteredList.length === 1 ? 'record' : 'records'}
            </span>
          </div>

          <div className="dc-register-toolbar-right">
            <div className="dc-register-search-wrapper">
              <Search size={14} className="dc-register-search-icon" />
              <input
                type="text"
                className="dc-register-search-input"
                placeholder={
                  activeTab === 'history'
                    ? 'Search Return No / DC No / Customer / Reason...'
                    : 'Search DC No / Customer / Product / SKU...'
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="dc-register-search-clear"
                  onClick={() => setSearchTerm('')}
                  title="Clear filter"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <button
              type="button"
              className="crm-btn-primary dc-btn-initiate-return"
              onClick={() => handleInitiateReturn()}
              title="Initiate Return for an Active Delivery Challan"
            >
              <Plus size={15} />
              <span>Initiate Return</span>
            </button>
          </div>
        </div>

        {/* 3. Register Tables or Empty States */}
        {activeRawList.length === 0 ? (
          <div className="dc-register-empty-state">
            <div className="dc-empty-icon-wrap">
              <RotateCcw size={32} style={{ color: '#94a3b8' }} />
            </div>
            <h4 className="dc-empty-title">
              {activeTab === 'history' && 'No return transactions recorded yet'}
              {activeTab === 'eligible' && 'No delivery challans currently eligible for return'}
              {activeTab === 'partial' && 'No partially returned challans'}
              {activeTab === 'full' && 'No fully returned challans yet'}
            </h4>
            <p className="dc-empty-text">
              {activeTab === 'history' && 'Consignments with recorded returns or equipment handbacks will appear in this historical register.'}
              {activeTab === 'eligible' && 'All dispatched and delivered consignments have been fully returned or none are active.'}
              {activeTab === 'partial' && 'Consignments where only a portion of goods were returned will be listed here.'}
              {activeTab === 'full' && 'Consignments where 100% of dispatched goods were returned will appear here.'}
            </p>
            {activeTab !== 'full' && (
              <button
                type="button"
                className="crm-btn-primary"
                onClick={() => handleInitiateReturn()}
                style={{ marginTop: '8px' }}
              >
                <Plus size={14} />
                <span>Initiate Return</span>
              </button>
            )}
          </div>
        ) : filteredList.length === 0 ? (
          <div className="dc-register-empty-state">
            <AlertCircle size={28} style={{ color: '#94a3b8', marginBottom: '8px' }} />
            <h4 className="dc-empty-title">No matching records</h4>
            <p className="dc-empty-text">
              No entries match "<strong>{searchTerm}</strong>".
            </p>
            <button
              type="button"
              className="crm-btn-secondary"
              onClick={() => setSearchTerm('')}
              style={{ marginTop: '8px' }}
            >
              Clear Filter
            </button>
          </div>
        ) : activeTab === 'history' ? (
          /* TAB 1: RETURN HISTORY (Separate Transactions) */
          <div className="crm-table-scroll-wrap stocks-table-natural-wrap dc-register-table-wrap dc-return-table-body">
            <table className="dc-table dc-return-table dc-register-table crm-master-table">
              <thead>
                <tr>
                  <th style={{ width: '13%' }}>RETURN NO</th>
                  <th style={{ width: '12%' }}>ORIGINAL DC</th>
                  <th style={{ width: '10%' }}>RETURN DATE</th>
                  <th style={{ width: '18%' }}>CUSTOMER</th>
                  <th style={{ width: '12%' }}>PURPOSE</th>
                  <th style={{ width: '14%' }}>RETURN REASON</th>
                  <th style={{ width: '7%', textAlign: 'center' }}>RETURNED</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>DOCUMENT</th>
                  <th style={{ width: '8%', textAlign: 'center' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {pagination.currentItems.map((txn, idx) => {
                  const custName = txn.customerName || 'Valued Customer';
                  const comp = txn.company && txn.company !== custName ? txn.company : '';
                  const fullCust = comp ? `${custName} (${comp})` : custName;
                  const reasonText = txn.reason || 'Equipment Return';
                  const rowKey = txn.returnId || txn.id;
                  const isReasonOpen = openReasonId === rowKey;
                  const isNearBottom = idx >= pagination.currentItems.length - 3 && pagination.currentItems.length > 3;

                  return (
                    <tr key={rowKey} className={`table-data-row ${isReasonOpen ? 'has-open-popover' : ''}`}>
                      {/* RETURN NO */}
                      <td className="cell-nowrap">
                        <span className="master-code dc-code-badge" style={{ background: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' }}>
                          {txn.returnId}
                        </span>
                      </td>

                      {/* ORIGINAL DC */}
                      <td className="cell-nowrap">
                        <span className="master-code dc-code-badge" style={{ background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }}>
                          {txn.originalChallanId}
                        </span>
                      </td>

                      {/* DATE */}
                      <td className="cell-nowrap" style={{ fontSize: '12px', color: '#475569' }}>
                        {formatDate(txn.returnDate)}
                      </td>

                      {/* CUSTOMER */}
                      <td title={fullCust}>
                        <span className="dc-text-truncate" style={{ fontWeight: 600, color: '#1e293b' }}>
                          {custName}
                          {comp && <span style={{ fontWeight: 400, color: '#64748b', marginLeft: '4px' }}>({comp})</span>}
                        </span>
                      </td>

                      {/* PURPOSE */}
                      <td>
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
                      <td className="dc-return-reason-cell">
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
                      <td style={{ textAlign: 'center' }}>
                        <strong className="dc-qty-pill already-returned" style={{ fontWeight: 700 }}>
                          {txn.returnedUnits}
                        </strong>
                      </td>

                      {/* DOCUMENT / STATUS */}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                            {txn.documentTitle}
                          </span>
                          <DCStatusBadge status={txn.status} />
                        </div>
                      </td>

                      {/* ACTIONS */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="dc-actions" style={{ justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="dc-btn-action secondary"
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
                      <td style={{ textAlign: 'center' }}>&nbsp;</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* TABS 2, 3, 4: CHALLAN SUMMARY VIEWS */
          <div className="crm-table-scroll-wrap stocks-table-natural-wrap dc-register-table-wrap dc-return-table-body">
            <table className="dc-table dc-return-table dc-register-table crm-master-table">
              <thead>
                <tr>
                  <th style={{ width: '12%' }}>DC NUMBER</th>
                  <th style={{ width: '10%' }}>DATE</th>
                  <th style={{ width: '20%' }}>CUSTOMER</th>
                  <th style={{ width: '13%' }}>PURPOSE</th>
                  <th style={{ width: '7%', textAlign: 'center' }}>SENT</th>
                  <th style={{ width: '8%', textAlign: 'center' }}>RETURNED</th>
                  <th style={{ width: '8%', textAlign: 'center' }}>REMAINING</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>STATUS</th>
                  <th style={{ width: '12%', textAlign: 'center' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {pagination.currentItems.map((dc) => {
                  const m = dc.metrics;
                  const custName = dc.customerName || dc.receiverName || 'Valued Customer';
                  const comp = dc.company && dc.company !== custName ? dc.company : '';
                  const fullCust = comp ? `${custName} (${comp})` : custName;

                  return (
                    <tr key={dc.challanId} className="table-data-row">
                      {/* DC NUMBER */}
                      <td className="cell-nowrap">
                        <span className="master-code dc-code-badge">
                          {dc.challanId}
                        </span>
                      </td>

                      {/* DATE */}
                      <td className="cell-nowrap" style={{ fontSize: '12px', color: '#475569' }}>
                        {formatDate(dc.deliveryDate)}
                      </td>

                      {/* CUSTOMER */}
                      <td title={fullCust}>
                        <span className="dc-text-truncate" style={{ fontWeight: 600, color: '#1e293b' }}>
                          {custName}
                          {comp && <span style={{ fontWeight: 400, color: '#64748b', marginLeft: '4px' }}>({comp})</span>}
                        </span>
                      </td>

                      {/* PURPOSE */}
                      <td>
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
                      <td style={{ textAlign: 'center' }}>
                        <span className="dc-qty-pill sent">{m.originalDeliveredQty}</span>
                      </td>

                      {/* RETURNED */}
                      <td style={{ textAlign: 'center' }}>
                        <strong className="dc-qty-pill already-returned" style={{ fontWeight: 700 }}>
                          {m.cumulativeReturnedQty}
                        </strong>
                      </td>

                      {/* REMAINING */}
                      <td style={{ textAlign: 'center' }}>
                        <strong className={`dc-qty-pill remaining ${m.remainingReturnableQty > 0 ? 'amber' : 'green'}`} style={{ fontWeight: 700 }}>
                          {m.remainingReturnableQty}
                        </strong>
                      </td>

                      {/* STATUS */}
                      <td style={{ textAlign: 'center' }}>
                        <DCStatusBadge status={m.statusBadge} />
                      </td>

                      {/* ACTIONS */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="dc-actions" style={{ justifyContent: 'center', gap: '6px' }}>
                          {m.isEligibleForReturn && (
                            <button
                              type="button"
                              className="dc-btn-action primary"
                              onClick={() => handleInitiateReturn(dc.challanId)}
                              title="Return Remaining Units"
                              style={{ padding: '3px 8px', fontSize: '11px' }}
                            >
                              <RotateCcw size={11} />
                              <span>Return</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="dc-btn-action secondary"
                            onClick={() => handleViewOriginalDc(dc)}
                            title="View Original Delivery Challan"
                            style={{ padding: '3px 8px', fontSize: '11px' }}
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
                      <td style={{ textAlign: 'center' }}>&nbsp;</td>
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
          className="dc-table-footer dc-return-footer"
        />
      </div>
    </div>
  );
}
