import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch, apiUrl } from '../../api';
import { navigate } from '../../router';
import { formatDate } from '../../utils/dateUtils';
import {
  Building2,
  Search,
  Plus,
  Eye,
  Truck,
  FileText,
  CheckCircle2,
  AlertCircle,
  Receipt,
  ArrowUpRight,
  ExternalLink
} from 'lucide-react';
import { TableFooter, useTablePagination } from '../common/TableWorkspace';
import { filterRecordsBySearch } from '../../utils/searchHelper';
import './purchaseOrders.css';

export default function SuppliersRegister({ user, onSelectSupplier }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchSuppliers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(apiUrl('/api/suppliers'), {
        headers: { 'x-user-id': user?.id || '' }
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data)) {
        setSuppliers(data.data);
      } else {
        setError(data.message || 'Failed to load suppliers.');
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      setError('Unable to communicate with the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(Number(amt || 0));
  };

  const filteredSuppliers = useMemo(() => {
    return filterRecordsBySearch(suppliers, searchQuery, [
      (s) => s.id,
      (s) => s.supplierId,
      (s) => s.companyName,
      (s) => s.contactPerson,
      (s) => s.phone,
      (s) => s.email,
      (s) => s.city,
      (s) => s.state,
      (s) => s.gstin
    ]);
  }, [suppliers, searchQuery]);

  const pagination = useTablePagination(filteredSuppliers, {
    rowHeight: 44,
    resetDeps: [searchQuery]
  });

  const totals = useMemo(() => {
    let poCount = 0;
    let grnCount = 0;
    let totalSpend = 0;
    let pendingCount = 0;
    for (const s of suppliers) {
      poCount += Number(s.totalOrders || 0);
      grnCount += Number(s.totalGrns || 0);
      totalSpend += Number(s.totalProcurementValue || 0);
      pendingCount += Number(s.pendingOrders || 0);
    }
    return {
      supplierCount: suppliers.length,
      poCount,
      grnCount,
      totalSpend,
      pendingCount
    };
  }, [suppliers]);

  const handleOpenSupplier = (sup) => {
    const idToUse = sup.id || sup.supplierId || sup.companyName;
    if (onSelectSupplier) {
      onSelectSupplier(idToUse);
    } else {
      navigate(`/purchase-orders/suppliers/${encodeURIComponent(idToUse)}`);
    }
  };

  return (
    <div className="po-container purchase-order-page suppliers-register-page crm-enquiry-page-container">
      {/* 1. Page Header */}
      <div className="page-header-row po-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Suppliers</h1>
        <div className="po-header-actions" style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={() => navigate('/purchase-orders')}
          >
            ← Back to Overview
          </button>
          <button
            type="button"
            className="crm-btn-primary"
            onClick={() => navigate('/purchase-orders/new')}
          >
            <Plus size={14} /> Create PO
          </button>
        </div>
      </div>

      {/* 2. Compact Status Strip matching canonical Table Architecture */}
      <div className="enquiry-status-strip po-status-strip" role="group" aria-label="Suppliers status summary">
        <div className="enquiry-status-item active" style={{ cursor: 'default' }}>
          <span>Total Suppliers</span>
          <strong>{totals.supplierCount}</strong>
        </div>
        <div className="enquiry-status-item" style={{ cursor: 'default' }}>
          <span>Dispatched (POs)</span>
          <strong style={{ color: '#1d4ed8' }}>{totals.poCount}</strong>
        </div>
        <div className="enquiry-status-item" style={{ cursor: 'default' }}>
          <span>Received (GRNs)</span>
          <strong style={{ color: '#16a34a' }}>{totals.grnCount}</strong>
        </div>
        <div className="enquiry-status-item" style={{ cursor: 'default' }}>
          <span>Procurement Spend</span>
          <strong style={{ color: '#7c3aed' }}>{formatCurrency(totals.totalSpend)}</strong>
        </div>
      </div>

      {/* 3. Search and Filters Bar */}
      <div className="table-controls-card">
        <div className="search-form-wrap">
          <div className="search-input-box">
            <Search size={16} color="#64748b" />
            <input
              type="text"
              placeholder="Search supplier, contact, GSTIN, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input-field"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="button"
            className="search-submit-btn"
            onClick={() => {}}
          >
            Search
          </button>
        </div>
      </div>

      {/* 4. Master Table Workspace Card */}
      <div className="po-list-card settings-table-shell stocks-table-shell crm-table-workspace po-master-card enquiry-master-card">
        <div className="po-table-viewport crm-table-scroll-wrap stocks-table-natural-wrap crm-table-viewport">
          <table className="po-table crm-master-table crm-data-table settings-table enquiry-settings-table po-register-table">
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '21%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '9%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="col-index-header" style={{ textAlign: 'center' }}>#</th>
                <th>SUPPLIER</th>
                <th>GSTIN</th>
                <th>SENT (POS)</th>
                <th>RECEIVED (GRNS)</th>
                <th style={{ textAlign: 'center' }}>PENDING</th>
                <th>LAST ORDER</th>
                <th className="actions-col" style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="empty-row">
                  <td colSpan="8">
                    <div className="table-loading-state" style={{ padding: '36px', textAlign: 'center' }}>
                      <div className="crm-spinner" />
                      <p style={{ marginTop: '8px', color: '#64748b', fontSize: '13px' }}>Loading suppliers register...</p>
                    </div>
                  </td>
                </tr>
              ) : pagination.currentRecords.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan="8">
                    <div className="table-empty-state" style={{ padding: '36px', textAlign: 'center' }}>
                      <p style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: '0 0 6px 0' }}>
                        {searchQuery ? `No suppliers found matching "${searchQuery}".` : 'No suppliers found.'}
                      </p>
                      <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                        {searchQuery ? 'Try clearing the search query.' : 'Suppliers added will appear here with procurement metrics.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pagination.currentRecords.map((sup, idx) => {
                  const rowNum = (pagination.currentPage - 1) * pagination.pageSize + idx + 1;
                  const totalOrders = Number(sup.totalOrders || 0);
                  const totalGrns = Number(sup.totalGrns || 0);
                  const pending = Number(sup.pendingOrders || 0);

                  return (
                    <tr key={sup.id || sup.supplierId || idx} className="table-data-row">
                      <td className="col-index-cell" style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                        {rowNum}
                      </td>

                      <td className="po-col-supplier">
                        <div className="po-supplier-cell" style={{ display: 'flex', flexDirection: 'column', gap: '1px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="po-supplier-name po-supplier-link-btn"
                            onClick={() => handleOpenSupplier(sup)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              textAlign: 'left',
                              cursor: 'pointer',
                              fontWeight: 700,
                              color: '#1d4ed8',
                              fontSize: '13px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '100%'
                            }}
                            title={`View history for ${sup.companyName}`}
                          >
                            {sup.companyName}
                          </button>
                          {sup.contactPerson && (
                            <div className="po-supplier-attn" style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              Attn: {sup.contactPerson} {sup.city ? `· ${sup.city}` : ''}
                            </div>
                          )}
                        </div>
                      </td>

                      <td>
                        {sup.gstin ? (
                          <span
                            style={{
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
                              fontSize: '11.5px',
                              letterSpacing: '0.02em',
                              color: '#1e293b',
                              fontWeight: 600,
                              background: '#f8fafc',
                              padding: '2px 5px',
                              borderRadius: '4px',
                              border: '1px solid #e2e8f0',
                              display: 'inline-block',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {sup.gstin}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', justifyContent: 'center' }}>
                          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {totalOrders} {totalOrders === 1 ? 'Order' : 'Orders'}
                            {sup.totalProcurementValue > 0 && (
                              <span style={{ fontWeight: 500, color: '#64748b', marginLeft: '4px', fontSize: '12px' }}>
                                ({formatCurrency(sup.totalProcurementValue)})
                              </span>
                            )}
                          </div>
                          {totalOrders > 0 && (
                            <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {sup.sentOrders > 0 && <span style={{ color: '#1d4ed8', fontWeight: 600 }}>{sup.sentOrders} Sent</span>}
                              {sup.partiallyReceivedOrders > 0 && <span> · <span style={{ color: '#b45309', fontWeight: 600 }}>{sup.partiallyReceivedOrders} Partial</span></span>}
                              {sup.receivedOrders > 0 && <span> · <span style={{ color: '#15803d', fontWeight: 600 }}>{sup.receivedOrders} Recvd</span></span>}
                            </div>
                          )}
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', justifyContent: 'center' }}>
                          <div style={{ fontWeight: 700, color: totalGrns > 0 ? '#15803d' : '#94a3b8', fontSize: '13px', whiteSpace: 'nowrap' }}>
                            {totalGrns} {totalGrns === 1 ? 'Receipt' : 'Receipts'}
                          </div>
                          {sup.totalOrderedQty > 0 && (
                            <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {sup.totalReceivedQty} / {sup.totalOrderedQty} items
                            </div>
                          )}
                        </div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        {pending > 0 ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              background: '#fffbeb',
                              color: '#b45309',
                              border: '1px solid #fde68a'
                            }}
                          >
                            {pending} Pending
                          </span>
                        ) : totalOrders > 0 ? (
                          <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                            ✓ Complete
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>

                      <td className="cell-nowrap" style={{ fontSize: '13px', color: '#334155' }}>
                        {sup.lastOrderDate ? formatDate(sup.lastOrderDate) : <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>

                      <td className="actions-col" style={{ textAlign: 'right' }}>
                        <div className="settings-row-actions" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            className="settings-row-action enquiry-action-btn"
                            onClick={() => handleOpenSupplier(sup)}
                            style={{ height: '26px', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0 8px', fontWeight: 600 }}
                            title={`View history for ${sup.companyName}`}
                          >
                            <Eye size={12} /> History
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              {!loading && pagination.currentRecords.length > 0 && pagination.currentRecords.length < pagination.pageSize && (
                Array.from({ length: pagination.pageSize - pagination.currentRecords.length }).map((_, fIdx) => (
                  <tr key={`filler-${fIdx}`} className="table-data-row table-filler-row" aria-hidden="true">
                    <td className="col-index-cell">&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td className="actions-col">&nbsp;</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TableFooter
          showingStart={pagination.showingStart}
          showingEnd={pagination.showingEnd}
          total={pagination.totalRecords}
          recordLabel="suppliers"
          singularLabel="supplier"
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={pagination.goToPage}
        />
      </div>
    </div>
  );
}
