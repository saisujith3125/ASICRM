import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Package,
  Truck,
  FileText,
  Search,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
  Zap,
  Filter,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { apiFetch, apiUrl } from '../../api';
import { navigate } from '../../router';
import './finance.css';

function authHeaders(user) {
  let activeId = user?.id || '';
  if (!activeId) {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('asicrm_user') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        activeId = parsed?.id || '';
      }
    } catch {}
  }
  return {
    'Content-Type': 'application/json',
    'x-user-id': activeId || 'USR-001'
  };
}

function formatCurrency(val) {
  const num = Number(val || 0);
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function FinanceView({ user, initialSubView = 'overview' }) {
  const [activeTab, setActiveTab] = useState(initialSubView || 'overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [financialYear, setFinancialYear] = useState('ASI/26-27');
  const [quarter, setQuarter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [summaryData, setSummaryData] = useState(null);
  const [inwardData, setInwardData] = useState([]);
  const [outwardData, setOutwardData] = useState([]);

  // Serials Popover Modal for tables
  const [viewingSerialsList, setViewingSerialsList] = useState(null);

  useEffect(() => {
    if (initialSubView && initialSubView !== activeTab) {
      setActiveTab(initialSubView);
    }
  }, [initialSubView]);

  // Load Macro Summary & Register Data
  const loadFinanceData = async () => {
    setLoading(true);
    setError('');
    try {
      const queryParams = new URLSearchParams();
      if (financialYear) queryParams.set('financialYear', financialYear);
      if (quarter && quarter !== 'ALL') queryParams.set('quarter', quarter);

      const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';

      const [summaryRes, inwardRes, outwardRes] = await Promise.all([
        apiFetch(apiUrl(`/api/finance/summary${qs}`), { headers: authHeaders(user) }),
        apiFetch(apiUrl(`/api/finance/inward${qs}`), { headers: authHeaders(user) }),
        apiFetch(apiUrl(`/api/finance/outward${qs}`), { headers: authHeaders(user) })
      ]);

      const [summaryJson, inwardJson, outwardJson] = await Promise.all([
        summaryRes.json(),
        inwardRes.json(),
        outwardRes.json()
      ]);

      if (summaryJson.success) setSummaryData(summaryJson.data);
      if (inwardJson.success) setInwardData(inwardJson.data || []);
      if (outwardJson.success) setOutwardData(outwardJson.data || []);
    } catch (err) {
      console.error('Error loading finance data:', err);
      setError('Failed to load financial records. Please check server connectivity.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinanceData();
  }, [financialYear, quarter]);

  const kpis = summaryData?.kpis || {};
  const unbilledDcs = summaryData?.unbilledDcs || [];
  const timeline = summaryData?.timeline || [];

  // Filtered Inward records
  const filteredInward = useMemo(() => {
    if (!searchQuery.trim()) return inwardData;
    const q = searchQuery.toLowerCase();
    return inwardData.filter((it) => {
      return (
        it.referenceId?.toLowerCase().includes(q) ||
        it.poNumber?.toLowerCase().includes(q) ||
        it.supplierName?.toLowerCase().includes(q) ||
        it.productName?.toLowerCase().includes(q) ||
        it.productCode?.toLowerCase().includes(q) ||
        it.serialNumbers?.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [inwardData, searchQuery]);

  // Filtered Outward records
  const filteredOutward = useMemo(() => {
    if (!searchQuery.trim()) return outwardData;
    const q = searchQuery.toLowerCase();
    return outwardData.filter((it) => {
      return (
        it.referenceId?.toLowerCase().includes(q) ||
        it.dcNumber?.toLowerCase().includes(q) ||
        it.invoiceNumber?.toLowerCase().includes(q) ||
        it.customerName?.toLowerCase().includes(q) ||
        it.productName?.toLowerCase().includes(q) ||
        it.productCode?.toLowerCase().includes(q) ||
        it.serialNumbers?.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [outwardData, searchQuery]);

  return (
    <div className="finance-container">
      {/* HEADER */}
      <div className="finance-header">
        <div className="finance-header-title">
          <h1>
            <DollarSign size={24} style={{ color: '#2563eb' }} />
            Finance &amp; Cash Flow Engine
          </h1>
          <p>
            Complete financial governance: monitor customer inflows, supplier outflows, unbilled Delivery Challan exposure, and unit-level serial number profitability.
          </p>
        </div>

        <div className="finance-header-filters">
          <select
            className="finance-select-pill"
            value={financialYear}
            onChange={(e) => setFinancialYear(e.target.value)}
          >
            <option value="ASI/26-27">Financial Year: ASI/26-27 (Active)</option>
            <option value="ALL">All Financial Years</option>
          </select>

          <select
            className="finance-select-pill"
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
          >
            <option value="ALL">All Quarters</option>
            <option value="Q1">Q1 (Apr – Jun)</option>
            <option value="Q2">Q2 (Jul – Sep)</option>
            <option value="Q3">Q3 (Oct – Dec)</option>
            <option value="Q4">Q4 (Jan – Mar)</option>
          </select>

          <button
            type="button"
            className="finance-select-pill"
            onClick={loadFinanceData}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Refresh Financial Records"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="finance-nav-tabs">
        <button
          type="button"
          className={`finance-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <TrendingUp size={15} />
          Overview &amp; Cash Flow
        </button>

        <button
          type="button"
          className={`finance-tab-btn ${activeTab === 'inward' ? 'active' : ''}`}
          onClick={() => setActiveTab('inward')}
        >
          <ArrowDownRight size={15} style={{ color: '#16a34a' }} />
          Inward Register (PO / GRN)
          <span className="finance-tab-badge">{inwardData.length}</span>
        </button>

        <button
          type="button"
          className={`finance-tab-btn ${activeTab === 'outward' ? 'active' : ''}`}
          onClick={() => setActiveTab('outward')}
        >
          <ArrowUpRight size={15} style={{ color: '#2563eb' }} />
          Outward Register (DC / Invoice)
          <span className="finance-tab-badge">{outwardData.length}</span>
        </button>

        <button
          type="button"
          className={`finance-tab-btn ${activeTab === 'unbilled' ? 'active' : ''}`}
          onClick={() => setActiveTab('unbilled')}
        >
          <AlertTriangle size={15} style={{ color: '#d97706' }} />
          Unbilled DCs (Watchdog)
          {kpis.unbilledDcCount > 0 && (
            <span className="finance-tab-badge alert">{kpis.unbilledDcCount}</span>
          )}
        </button>
      </div>

      {/* TAB 1: OVERVIEW & CASH FLOW */}
      {activeTab === 'overview' && (
        <>
          {/* REVENUE LEAKAGE ALERT BANNER */}
          {kpis.unbilledDcCount > 0 && (
            <div className="finance-leak-alert">
              <div className="finance-leak-alert-text">
                <AlertTriangle size={22} style={{ color: '#d97706', flexShrink: 0 }} />
                <div>
                  <strong>Revenue Leakage Watchdog Alert:</strong>{' '}
                  {kpis.unbilledDcCount} Delivery Challan{kpis.unbilledDcCount > 1 ? 's' : ''} worth{' '}
                  <strong>{formatCurrency(kpis.unbilledDcTotalValue)}</strong> have been physically delivered to customers without an invoice!
                </div>
              </div>
              <button
                type="button"
                className="finance-btn-warning"
                onClick={() => setActiveTab('unbilled')}
              >
                Inspect Unbilled Goods &rarr;
              </button>
            </div>
          )}

          {/* TOP KPI CARDS - Compact Sleek View */}
          <div className="finance-kpi-grid">
            {/* Total Inflow Billed */}
            <div className="finance-kpi-card highlight-green" title="Total Inflow Billed">
              <div className="finance-kpi-header">
                <span>Total Billed Inflow</span>
                <ArrowDownRight size={14} style={{ color: '#10b981', flexShrink: 0 }} />
              </div>
              <div className="finance-kpi-value">{formatCurrency(kpis.totalInflowBilled)}</div>
              <div className="finance-kpi-subtext" title={`${kpis.invoicesCount || 0} Invoices generated`}>
                <span>{kpis.invoicesCount || 0} Invoices</span>
              </div>
            </div>

            {/* Cash Collected */}
            <div className="finance-kpi-card highlight-green" title="Cash Collected (Paid)">
              <div className="finance-kpi-header">
                <span>Cash Collected</span>
                <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
              </div>
              <div className="finance-kpi-value">{formatCurrency(kpis.totalCashCollected)}</div>
              <div
                className="finance-kpi-subtext"
                title={`${kpis.paidInvoicesCount || 0} settled customer invoices${Number(kpis.totalAdvanceCollected || 0) > 0 ? ` (+ ${formatCurrency(kpis.totalAdvanceCollected)} advances)` : ''}`}
              >
                <span>{kpis.paidInvoicesCount || 0} Invoices</span>
                {Number(kpis.totalAdvanceCollected || 0) > 0 && (
                  <span style={{ color: '#047857', fontWeight: 600 }}>
                    • +{formatCurrency(kpis.totalAdvanceCollected)} Adv
                  </span>
                )}
              </div>
            </div>

            {/* Accounts Receivable */}
            <div className="finance-kpi-card highlight-amber" title="Accounts Receivable">
              <div className="finance-kpi-header">
                <span>Receivables</span>
                <Clock size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
              </div>
              <div className="finance-kpi-value">{formatCurrency(kpis.totalReceivablesPending)}</div>
              <div className="finance-kpi-subtext" title={`${kpis.pendingInvoicesCount || 0} pending payment collections`}>
                <span>{kpis.pendingInvoicesCount || 0} Pending</span>
              </div>
            </div>

            {/* Total PO Outflow */}
            <div className="finance-kpi-card highlight-red" title="Committed PO Outflow">
              <div className="finance-kpi-header">
                <span>PO Outflow</span>
                <ArrowUpRight size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
              </div>
              <div className="finance-kpi-value">{formatCurrency(kpis.totalOutflowCommitted)}</div>
              <div className="finance-kpi-subtext" title={`${kpis.posCount || 0} Purchase Orders issued to suppliers`}>
                <span>
                  {kpis.posCount || 0} POs issued
                  {Number(kpis.totalPoPaidAmount || 0) > 0 && ` • ₹${Number(kpis.totalPoPaidAmount).toLocaleString('en-IN')} Paid`}
                </span>
              </div>
            </div>

            {/* Unbilled DC Exposure */}
            <div className="finance-kpi-card highlight-amber" title="Unbilled DC Exposure">
              <div className="finance-kpi-header">
                <span>Unbilled DC Exp.</span>
                <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
              </div>
              <div className="finance-kpi-value" style={{ color: '#b45309' }}>
                {formatCurrency(kpis.unbilledDcTotalValue)}
              </div>
              <div className="finance-kpi-subtext" title={`${kpis.unbilledDcCount || 0} DCs delivered waiting for invoicing`}>
                <span>{kpis.unbilledDcCount || 0} DCs unbilled</span>
              </div>
            </div>

            {/* Net Operating Cash Flow */}
            <div className="finance-kpi-card highlight-blue" title="Net Operating Cash Flow">
              <div className="finance-kpi-header">
                <span>Net Cash Flow</span>
                <TrendingUp size={14} style={{ color: '#2563eb', flexShrink: 0 }} />
              </div>
              <div className="finance-kpi-value" style={{ color: kpis.netOperatingCashFlow >= 0 ? '#15803d' : '#b91c1c' }}>
                {formatCurrency(kpis.netOperatingCashFlow)}
              </div>
              <div className="finance-kpi-subtext" title={`Gross Trading Margin: ${formatCurrency(kpis.expectedTradingMargin)}`}>
                <span>Margin: {formatCurrency(kpis.expectedTradingMargin)}</span>
              </div>
            </div>
          </div>

          {/* CHRONOLOGICAL FLOW TIMELINE FEED */}
          <div className="finance-card">
            <div className="finance-card-head">
              <div>
                <h3 className="finance-card-title">
                  <Layers size={18} style={{ color: '#2563eb' }} />
                  Master Cash Flow &amp; Transaction Feed
                </h3>
                <p className="finance-card-desc">
                  Chronological register of customer invoice inflows, supplier PO outflows, and unbilled dispatches.
                </p>
              </div>
            </div>

            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Flow Type</th>
                    <th>Reference</th>
                    <th>Party (Customer / Supplier)</th>
                    <th>Financial Description</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                        No transactions found for the selected filter period.
                      </td>
                    </tr>
                  ) : (
                    timeline.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ whiteSpace: 'nowrap' }}>{item.date ? item.date.slice(0, 10) : '-'}</td>
                        <td>
                          {item.direction === 'INFLOW' && (
                            <span className={`flow-badge inflow ${item.type === 'ADVANCE_INFLOW' ? 'advance' : ''}`}>
                              <ArrowDownRight size={12} /> {item.type === 'ADVANCE_INFLOW' ? 'Customer Advance' : 'Customer Inflow'}
                            </span>
                          )}
                          {item.direction === 'OUTFLOW' && (
                            <span className={`flow-badge outflow ${item.type === 'PO_ADVANCE_OUTFLOW' ? 'advance' : (item.type === 'PO_IMMEDIATE_OUTFLOW' ? 'immediate' : '')}`}>
                              <ArrowUpRight size={12} /> {item.docType || 'Supplier Outflow'}
                            </span>
                          )}
                          {item.direction === 'UNBILLED' && (
                            <span className="flow-badge unbilled">
                              <AlertTriangle size={12} /> Unbilled DC
                            </span>
                          )}
                        </td>
                        <td>
                          {item.type === 'ADVANCE_INFLOW' ? (
                            <button
                              type="button"
                              className="link-code-btn"
                              style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', borderRadius: '4px', padding: '1px 6px', fontWeight: 700, cursor: 'pointer', fontSize: '11px' }}
                              onClick={() => navigate('/quotations')}
                              title={`View Quotation ${item.referenceId}`}
                            >
                              {item.referenceId}
                            </button>
                          ) : (
                            <strong>{item.referenceId}</strong>
                          )}
                        </td>
                        <td>{item.partyName}</td>
                        <td style={{ color: '#64748b', fontSize: '12.5px' }}>{item.description}</td>
                        <td>
                          <span className={`settings-pill-badge ${item.status === 'PAID' ? 'active' : ''}`}>
                            {item.status}
                          </span>
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: item.direction === 'INFLOW' ? '#16a34a' : (item.direction === 'OUTFLOW' ? '#dc2626' : '#d97706')
                          }}
                        >
                          {item.direction === 'INFLOW' ? '+' : (item.direction === 'OUTFLOW' ? '-' : '⚡')} {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: INWARD REGISTER */}
      {activeTab === 'inward' && (
        <div className="finance-card">
          <div className="finance-card-head">
            <div>
              <h3 className="finance-card-title">
                <ArrowDownRight size={18} style={{ color: '#16a34a' }} />
                Inward Register (PO Goods Receipt &amp; Returns)
              </h3>
              <p className="finance-card-desc">
                Log of every item and batch received into the warehouse with unit procurement costs and serial numbers.
              </p>
            </div>

            <div className="finance-search-wrap">
              <Search size={15} className="finance-search-icon" />
              <input
                type="text"
                className="finance-search-input"
                placeholder="Search PO, GRN, supplier, product, serial..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Inward Date</th>
                  <th>Inward Type</th>
                  <th>GRN Ref</th>
                  <th>PO Number</th>
                  <th>Supplier / Source</th>
                  <th>Product Name &amp; Code</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Inward Rate</th>
                  <th style={{ textAlign: 'right' }}>GST Rate</th>
                  <th style={{ textAlign: 'right' }}>Total Inward Cost</th>
                  <th>Serial Numbers</th>
                </tr>
              </thead>
              <tbody>
                {filteredInward.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      No inward goods receipt records found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredInward.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ whiteSpace: 'nowrap' }}>{row.date}</td>
                      <td>
                        <span className="flow-badge inflow">{row.type}</span>
                      </td>
                      <td>
                        <strong>{row.referenceId}</strong>
                      </td>
                      <td>
                        <span style={{ color: '#2563eb', fontWeight: 600 }}>{row.poNumber}</span>
                      </td>
                      <td>{row.supplierName}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{row.productName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{row.productCode}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.quantity}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(row.unitRate)}</td>
                      <td style={{ textAlign: 'right' }}>{row.gstRate}%</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {formatCurrency(row.totalValue)}
                      </td>
                      <td>
                        {row.serialsCount > 0 ? (
                          <button
                            type="button"
                            className="serial-pill-btn"
                            onClick={() => setViewingSerialsList({ title: `Inward Serials (${row.referenceId})`, serials: row.serialNumbers })}
                          >
                            <Tag size={12} /> {row.serialsCount} Serials
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '11px' }}>Non-serialized</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: OUTWARD REGISTER */}
      {activeTab === 'outward' && (
        <div className="finance-card">
          <div className="finance-card-head">
            <div>
              <h3 className="finance-card-title">
                <ArrowUpRight size={18} style={{ color: '#2563eb' }} />
                Outward Register (Delivery Challans &amp; Sales Invoices)
              </h3>
              <p className="finance-card-desc">
                Log of every product dispatched to clients, linking Delivery Challans to billed Sales Invoices.
              </p>
            </div>

            <div className="finance-search-wrap">
              <Search size={15} className="finance-search-icon" />
              <input
                type="text"
                className="finance-search-input"
                placeholder="Search DC, invoice, customer, product, serial..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Dispatch Date</th>
                  <th>Outward Type</th>
                  <th>DC Number</th>
                  <th>Invoice Number</th>
                  <th>Customer Name</th>
                  <th>Product Name &amp; Code</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Selling Rate</th>
                  <th style={{ textAlign: 'right' }}>Total Dispatched Value</th>
                  <th>Billing Status</th>
                  <th>Serial Numbers</th>
                </tr>
              </thead>
              <tbody>
                {filteredOutward.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      No outward dispatch records found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredOutward.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ whiteSpace: 'nowrap' }}>{row.date}</td>
                      <td>
                        <span className="flow-badge outflow">{row.type}</span>
                      </td>
                      <td>
                        <strong>{row.dcNumber}</strong>
                      </td>
                      <td>
                        {row.isBilled ? (
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>{row.invoiceNumber}</span>
                        ) : (
                          <span style={{ color: '#d97706', fontSize: '11px', fontWeight: 600 }}>Unbilled DC</span>
                        )}
                      </td>
                      <td>{row.customerName}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{row.productName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>{row.productCode}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.quantity}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(row.unitRate)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {formatCurrency(row.totalValue)}
                      </td>
                      <td>
                        <span className={`flow-badge ${row.isBilled ? 'inflow' : 'unbilled'}`}>
                          {row.isBilled ? 'BILLED' : 'UNBILLED (DC)'}
                        </span>
                      </td>
                      <td>
                        {row.serialsCount > 0 ? (
                          <button
                            type="button"
                            className="serial-pill-btn"
                            onClick={() => setViewingSerialsList({ title: `Outward Serials (${row.referenceId})`, serials: row.serialNumbers })}
                          >
                            <Tag size={12} /> {row.serialsCount} Serials
                          </button>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '11px' }}>Non-serialized</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: UNBILLED DELIVERY CHALLANS WATCHDOG */}
      {activeTab === 'unbilled' && (
        <div className="finance-card">
          <div className="finance-card-head">
            <div>
              <h3 className="finance-card-title">
                <AlertTriangle size={18} style={{ color: '#d97706' }} />
                Unbilled Delivery Challans Watchdog
              </h3>
              <p className="finance-card-desc">
                Goods physically delivered to client premises that have not yet been invoiced. Convert them to Sales Invoices to realize your revenue.
              </p>
            </div>
          </div>

          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Challan ID</th>
                  <th>Customer Name</th>
                  <th>Delivery Date</th>
                  <th>Items Dispatched</th>
                  <th style={{ textAlign: 'right' }}>Total Unbilled Value</th>
                  <th>Transit Vehicle</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {unbilledDcs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#16a34a' }}>
                      <CheckCircle2 size={24} style={{ color: '#16a34a', margin: '0 auto 8px auto', display: 'block' }} />
                      <strong>Zero Revenue Leakage!</strong> All delivered Delivery Challans have been successfully invoiced.
                    </td>
                  </tr>
                ) : (
                  unbilledDcs.map((dc, idx) => (
                    <tr key={idx}>
                      <td>
                        <strong style={{ color: '#d97706' }}>{dc.challanId}</strong>
                      </td>
                      <td>
                        <strong>{dc.customerName}</strong>
                      </td>
                      <td>{dc.deliveryDate}</td>
                      <td>
                        <div>{dc.itemsCount} line items</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {dc.items?.slice(0, 2).map((it) => it.productName).join(', ')}
                          {dc.itemsCount > 2 ? ` (+${dc.itemsCount - 2} more)` : ''}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: '#b45309', fontSize: '14px' }}>
                        {formatCurrency(dc.totalValue)}
                      </td>
                      <td style={{ color: '#64748b', fontSize: '12px' }}>{dc.vehicleDetails || 'Standard Delivery'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="settings-btn settings-btn-primary"
                          style={{ padding: '6px 14px', fontSize: '12px' }}
                          onClick={() => navigate(`/orders/invoices?challanId=${encodeURIComponent(dc.challanId)}`)}
                        >
                          Generate Sales Invoice &rarr;
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SERIALS POPOVER MODAL */}
      {viewingSerialsList && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-card" style={{ maxWidth: '480px' }}>
            <div className="settings-modal-header">
              <h3 className="settings-modal-title">{viewingSerialsList.title}</h3>
              <button
                type="button"
                className="settings-modal-close-btn"
                onClick={() => setViewingSerialsList(null)}
              >
                ✕
              </button>
            </div>
            <div className="settings-modal-body">
              <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#64748b' }}>
                Click on any serial number to trace its complete inward cost and outward selling profit:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {viewingSerialsList.serials?.map((sn, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    className="serial-pill-btn"
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                    onClick={() => {
                      setViewingSerialsList(null);
                      navigate(`/serials?q=${encodeURIComponent(sn)}`);
                    }}
                  >
                    <Tag size={12} /> {sn}
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-modal-footer">
              <button
                type="button"
                className="settings-btn settings-btn-secondary"
                onClick={() => setViewingSerialsList(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
