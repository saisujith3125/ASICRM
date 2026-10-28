import React, { useEffect, useMemo, useState } from 'react';
import { Eye, FileText, Check, X, Zap, Plus, Trash2, RefreshCw, MoreHorizontal, Copy, FilePlus } from 'lucide-react';
import { apiFetch, apiUrl } from '../../api';
import { navigate } from '../../router';
import DocumentPreviewModal from '../documents/DocumentPreviewModal';
import PrintableQuotation from '../documents/PrintableQuotation';
import { getQuotationFilename } from '../documents/DocumentPdfService';
import { useTablePagination, TableFooter } from '../common/TableWorkspace';
import { filterRecordsBySearch } from '../../utils/searchHelper';
import { formatDate } from '../../utils/dateUtils';

const mapQuotationStatusLabel = (status) => {
  const s = String(status || '').toUpperCase();
  if (['AWAITING_DECISION', 'READY_FOR_QUOTATION', 'DRAFT', 'ISSUED', 'AWAITING_CUSTOMER', 'REVISION_REQUESTED', 'PENDING'].includes(s)) {
    return 'PENDING';
  }
  if (['ACCEPTED', 'CONFIRMED'].includes(s)) return 'ACCEPTED';
  if (s === 'CONVERTED') return 'CONVERTED';
  if (s === 'REJECTED') return 'REJECTED';
  return s;
};

const QUOTATION_SEARCH_EXTRACTORS = [
  (q) => q.quotationId,
  (q) => q.quotationNumber,
  (q) => q.quoteNumber,
  (q) => q.customerId,
  (q) => q.customerName,
  (q) => q.customerCompany,
  (q) => q.company,
  (q) => q.contactPerson,
  (q) => q.customerPhone,
  (q) => q.phone,
  (q) => q.mobile,
  (q) => q.customerEmail,
  (q) => q.email,
  (q) => q.city,
  (q) => q.customerCity,
  (q) => q.state,
  (q) => q.customerState,
  (q) => q.enquiryId,
  (q) => q.orderId,
  (q) => q.proformaId,
  (q) => q.source,
  (q) => q.status,
  (q) => mapQuotationStatusLabel(q.status),
  (q) => parseQuotationProducts(q)?.map((p) => `${p.productName || p.name || ''} ${p.productCode || p.code || ''} ${p.description || ''} ${p.hsnSac || p.hsn || ''}`),
  (q) => q.items?.map((it) => `${it.productName || it.name || ''} ${it.productCode || it.code || ''} ${it.sku || ''} ${it.description || ''} ${it.hsn || ''}`)
];

function authHeaders(user) {
  return {
    'Content-Type': 'application/json',
    'x-user-id': user?.id || '',
  };
}

function parseQuotationProducts(quote) {
  if (Array.isArray(quote?.items) && quote.items.length > 0) {
    return quote.items.map((it) => {
      const rawName = String(it.productName || it.name || it.item || 'Product').trim();
      const brand = String(it.brandName || it.brand || '').trim();
      const isInstallation = Boolean(
        it.isInstallationCharge ||
        rawName.toLowerCase().includes('installation testing & commissioning')
      );
      const displayName = brand && !isInstallation && !new RegExp(`[\\-\\–\\—]\\s*${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i').test(rawName)
        ? `${rawName} - ${brand}`
        : rawName;
      return {
        qty: Number(it.quantity || it.qty || 1),
        name: displayName,
      };
    });
  }

  const raw = String(quote?.item || quote?.description || '').trim();
  if (!raw || raw === '—' || raw === '-') {
    return [];
  }

  const parts = raw.split(/,\s*(?=\d+\s*[xX×]|\b[A-Za-z])/).map((s) => s.trim()).filter(Boolean);
  if (parts.length > 1) {
    return parts.map((part) => {
      const match = part.match(/^(\d+)\s*[xX×]\s*(.+)$/);
      if (match) {
        return { qty: parseInt(match[1], 10), name: match[2].trim() };
      }
      return { qty: 1, name: part };
    });
  }

  const match = raw.match(/^(\d+)\s*[xX×]\s*(.+)$/);
  if (match) {
    return [{ qty: parseInt(match[1], 10), name: match[2].trim() }];
  }

  return [{ qty: 1, name: raw }];
}

export default function QuotationsList({ user, onOpenQuotation, onNavigateCustomer }) {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [converting, setConverting] = useState(null);
  const [openItemsQuoteId, setOpenItemsQuoteId] = useState(null);
  const [openDropdownQuoteId, setOpenDropdownQuoteId] = useState(null);
  const [selectedQuoteForPdf, setSelectedQuoteForPdf] = useState(null);
  const [pdfLoadingQuoteId, setPdfLoadingQuoteId] = useState(null);

  // Global click-outside and Escape key listener for Actions dropdown
  useEffect(() => {
    if (!openDropdownQuoteId) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.quotation-actions-dropdown-container')) {
        setOpenDropdownQuoteId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpenDropdownQuoteId(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openDropdownQuoteId]);

  // Copy Quotation (Clone line items, specs, pricing & terms for another customer)
  const handleCopyQuotation = async (quote) => {
    if (!quote) return;
    setOpenDropdownQuoteId(null);
    setError('');
    try {
      let fullQuote = quote;
      if (!Array.isArray(quote.items) || quote.items.length === 0) {
        const res = await apiFetch(apiUrl(`/api/enquiries/quotation/${encodeURIComponent(quote.quotationId)}`), {
          headers: authHeaders(user)
        });
        const d = await res.json();
        if (res.ok && d.success && d.data) {
          fullQuote = { ...quote, ...d.data, items: d.data.items || quote.items };
        }
      }

      const copyPayload = {
        sourceQuotationId: fullQuote.quotationId || fullQuote.quotationNumber || fullQuote.quoteNumber || '',
        sourceCustomerName: fullQuote.customerName || fullQuote.customerCompany || '',
        items: (fullQuote.items || []).map((it) => ({
          productId: it.productId || it.id || '',
          productCode: it.productCode || it.code || '',
          productName: it.productName || it.name || it.item || '',
          brand: it.brand || it.brandName || '',
          hsnSac: it.hsnSac || it.hsnCode || it.hsn || '',
          unit: it.unit || 'Nos',
          quantity: Number(it.quantity || it.qty || 1),
          unitPrice: Number(it.unitPrice !== undefined ? it.unitPrice : (it.price !== undefined ? it.price : 0)),
          minPrice: Number(it.minPrice || 0),
          discount: Number(it.discount !== undefined ? it.discount : (it.discountPercent || 0)),
          gst: Number(it.gst !== undefined ? it.gst : (it.gstRate !== undefined ? it.gstRate : 18)),
          isIGSTApplicable: Boolean(it.isIGSTApplicable),
          description: it.description || '',
          productDetails: it.productDetails || '',
          productLink: it.productLink || '',
          isInstallationCharge: Boolean(
            it.isInstallationCharge ||
            String(it.productName || it.name || '').toLowerCase().includes('installation testing & commissioning')
          )
        })),
        includeInstallationCharges: Boolean(fullQuote.includeInstallationCharges),
        showDiscount: Boolean(fullQuote.showDiscount),
        roundOffTotal: Boolean(fullQuote.roundOffTotal),
        notes: fullQuote.notes || fullQuote.remarks || '',
        terms: fullQuote.terms || fullQuote.termsAndConditions || ''
      };

      sessionStorage.setItem('asicrm_quotation_copy_payload', JSON.stringify(copyPayload));
      navigate(`/quotations/new?copyFrom=${encodeURIComponent(copyPayload.sourceQuotationId)}`);
    } catch (err) {
      console.error('Failed to copy quotation:', err);
      setError('Unable to copy quotation: ' + (err.message || 'Unknown error'));
    }
  };

  const handleOpenQuotationPdf = async (quote) => {
    if (!quote) return;
    const isAccepted = quote.status === 'ACCEPTED' || quote.status === 'CONFIRMED';
    const isConverted = quote.status === 'CONVERTED' || Boolean(quote.orderId);
    if (!isAccepted && !isConverted) {
      setError('Official Quotation PDF is strictly available only for ACCEPTED or CONVERTED quotations.');
      return;
    }
    let fullQuote = quote;
    if (!Array.isArray(quote.items) || quote.items.length === 0 || !quote.customer) {
      setPdfLoadingQuoteId(quote.quotationId);
      try {
        const res = await apiFetch(apiUrl(`/api/enquiries/quotation/${encodeURIComponent(quote.quotationId)}`), {
          headers: authHeaders(user)
        });
        const d = await res.json();
        if (res.ok && d.success && d.data) {
          fullQuote = { ...quote, ...d.data, customer: d.customer || d.data.customer };
        }
      } catch (_) {
      } finally {
        setPdfLoadingQuoteId(null);
      }
    }

    // Validation check on items before opening PDF
    if (Array.isArray(fullQuote.items) && fullQuote.items.length > 0) {
      for (const it of fullQuote.items) {
        if (!it.quantity || Number(it.quantity) <= 0) {
          setError(`Quotation ${fullQuote.quotationId} has invalid quantity for "${it.productName || it.name}". PDF cannot be generated.`);
          return;
        }
      }
    }
    setSelectedQuoteForPdf(fullQuote);
  };

  const can = (action) => String(user?.role || '').toUpperCase() === 'SUPER_ADMIN' || Boolean(user?.permissions?.Quotations?.includes(action));
  const canConvert = can('Convert to Order') && (String(user?.role || '').toUpperCase() === 'SUPER_ADMIN' || Boolean(user?.permissions?.['Orders & Deals']?.includes('Create')));

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const quotationResponse = await apiFetch(apiUrl('/api/enquiries/quotations'), { headers: authHeaders(user) });
      const quotationData = await quotationResponse.json();

      if (!quotationResponse.ok || !quotationData.success) {
        throw new Error(quotationData.message || 'Failed to load quotations.');
      }

      setQuotations(Array.isArray(quotationData.data) ? quotationData.data : []);
    } catch (e) {
      setError(e.message || 'Unable to load quotations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.id, user?.role]);

  const filtered = useMemo(() => {
    const statusFiltered = quotations.filter((quote) => {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'AWAITING') {
        return (
          quote.status === 'READY_FOR_QUOTATION' ||
          quote.status === 'ISSUED' ||
          quote.status === 'AWAITING_CUSTOMER' ||
          quote.status === 'REVISION_REQUESTED' ||
          quote.status === 'DRAFT' ||
          quote.status === 'PENDING'
        );
      }
      if (statusFilter === 'ACCEPTED') {
        return quote.status === 'ACCEPTED' || quote.status === 'CONFIRMED';
      }
      if (statusFilter === 'CONVERTED') {
        return quote.status === 'CONVERTED' || Boolean(quote.orderId);
      }
      if (statusFilter === 'REJECTED') {
        return quote.status === 'REJECTED';
      }
      return true;
    });

    const searched = filterRecordsBySearch(statusFiltered, query, QUOTATION_SEARCH_EXTRACTORS);
    return searched.sort((a, b) => {
      const aVal = String(a.quotationId || '');
      const bVal = String(b.quotationId || '');
      const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
      const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
      if (aNum && bNum && aNum !== bNum) return aNum - bNum;
      return aVal.localeCompare(bVal, undefined, { numeric: true });
    });
  }, [quotations, query, statusFilter]);

  useEffect(() => {
    setOpenItemsQuoteId(null);
  }, [query, statusFilter]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.quotation-items-cell')) {
        setOpenItemsQuoteId(null);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpenItemsQuoteId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const {
    currentPage,
    totalPages,
    pageSize,
    currentRecords: currentQuotations,
    showingStart,
    showingEnd,
    totalRecords,
    goToPage
  } = useTablePagination(filtered, {
    rowHeight: 45,
    resetDeps: [query, statusFilter]
  });


  const deleteQuote = async (quote) => {
    if (!window.confirm(`Delete quotation ${quote.quotationId}?`)) return;
    try {
      const res = await apiFetch(apiUrl(`/api/enquiries/quotation/${quote.quotationId}`), { method: 'DELETE', headers: authHeaders(user) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to delete quotation.');
      await load();
    } catch (e) {
      setError(e.message || 'Unable to delete quotation.');
    }
  };

  const convertToOrder = async (quote) => {
    if (quote.status !== 'ACCEPTED') {
      alert(`Quotation must be ACCEPTED by customer before converting to an order. Current status: ${quote.status || 'ISSUED'}.`);
      return;
    }

    if (!window.confirm(`Convert quotation ${quote.quotationId} into an order for ${quote.customerName}? This will complete the order and close the enquiry.`)) return;
    setConverting(quote.quotationId);
    setError('');
    try {
      const res = await apiFetch(apiUrl(`/api/orders/from-quotation/${quote.quotationId}`), {
        method: 'POST',
        headers: authHeaders(user),
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to convert quotation to order.');
      await load();
    } catch (e) {
      setError(e.message || 'Unable to convert quotation to order.');
    } finally {
      setConverting(null);
    }
  };

  const updateStatus = async (quotationId, newStatus, remarks = '') => {
    try {
      const res = await apiFetch(apiUrl(`/api/enquiries/quotation/${quotationId}/status`), {
        method: 'PATCH',
        headers: authHeaders(user),
        body: JSON.stringify({ status: newStatus, remarks })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update status.');
      await load();
    } catch (e) {
      setError(e.message || 'Failed to update quotation status.');
    }
  };

  const getStatusBadge = (status, orderId) => {
    if (status === 'CONVERTED' || Boolean(orderId)) {
      return <span className="status-badge badge-green">CONVERTED</span>;
    }
    if (status === 'ACCEPTED' || status === 'CONFIRMED') {
      return <span className="status-badge badge-blue">ACCEPTED</span>;
    }
    if (status === 'REJECTED') {
      return <span className="status-badge badge-red">REJECTED</span>;
    }
    if (status === 'REVISION_REQUESTED') {
      return <span className="status-badge badge-amber">REVISION REQ</span>;
    }
    if (status === 'DRAFT') {
      return <span className="status-badge badge-amber">DRAFT</span>;
    }
    return <span className="status-badge badge-purple">PENDING</span>;
  };

  if (loading) return <div className="crm-loading-full"><div className="crm-spinner" /><p>Loading quotations...</p></div>;

  return (
    <div className="crm-quotation-page-container quotation-directory-page">
      {error && quotations.length === 0 && <div className="crm-alert-box error" style={{ marginBottom: '12px' }}><span>{error}</span><button className="crm-btn-secondary compact" onClick={load} style={{ marginLeft: '12px' }}>Retry</button></div>}

      <section className="quotation-workspace-bar" aria-label="Quotations controls">
        <div className="quotation-workspace-title">
          <h1>Quotations</h1>
          <p>Track proposals, customer decisions, and conversions.</p>
        </div>

        <div className="quotation-workspace-controls">
          <label className="quotation-search-box quotation-workspace-search">
            <svg className="quotation-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search quotations..." aria-label="Search quotations" type="text" />
            {query && <button type="button" className="quotation-search-clear clear-search-btn" onClick={() => setQuery('')} aria-label="Clear quotation search">×</button>}
          </label>

          <div className="quotation-status-filter" role="group" aria-label="Quotation status">
            {['ALL', 'AWAITING', 'ACCEPTED', 'CONVERTED', 'REJECTED'].map((st) => (
              <button
                key={st}
                type="button"
                className={`crm-btn-secondary compact ${statusFilter === st ? 'active' : ''}`}
                style={statusFilter === st ? { background: '#2563eb', color: '#fff', borderColor: '#2563eb' } : {}}
                onClick={() => setStatusFilter(st)}
              >
                {st === 'AWAITING' ? 'PENDING' : st}
              </button>
            ))}
          </div>

          <button type="button" className="crm-btn-secondary compact quotation-refresh-btn" onClick={load} disabled={loading} aria-label="Refresh quotations" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {can('Create') && (
            <button
              type="button"
              className="quotation-topbar-create-btn"
              onClick={() => navigate('/quotations/new')}
              title="Create new quotation"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Create Quotation</span>
            </button>
          )}
        </div>
      </section>

      <div className="settings-table-shell stocks-table-shell quotation-master-card">
        <div className="crm-table-scroll-wrap stocks-table-natural-wrap crm-table-viewport">
          <table className="settings-table quotation-settings-table quotation-register-table">
            <colgroup>
              <col style={{ width: '14%' }} />
              <col style={{ width: '24%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="col-priority-high">QUOTATION ID</th>
                <th className="col-priority-high">CUSTOMER</th>
                <th className="col-priority-med">ENQUIRY ID</th>
                <th className="col-priority-med" style={{ textAlign: 'center' }}>ITEMS</th>
                <th className="col-priority-high" style={{ textAlign: 'right' }}>TOTAL AMOUNT</th>
                <th className="col-priority-low" style={{ textAlign: 'center' }}>UPDATED</th>
                <th className="col-priority-high" style={{ textAlign: 'center' }}>STATUS</th>
                <th className="actions-col col-priority-high" style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {currentQuotations.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan="8">
                    <div className="table-empty-state">
                      <p>{quotations.length === 0 ? 'No quotations created yet.' : 'No quotations match your criteria.'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentQuotations.map((quote, idx) => {
                  const isConverted = quote.status === 'CONVERTED' || Boolean(quote.orderId);
                  const isAccepted = quote.status === 'ACCEPTED' || quote.status === 'CONFIRMED';
                  const rowKey = `${quote.quotationId || 'qt'}-${idx}`;
                  const isItemsOpen = openItemsQuoteId === rowKey;
                  const isDropdownOpen = openDropdownQuoteId === rowKey;
                  const parsedProducts = parseQuotationProducts(quote);
                  const isNearBottom = idx >= currentQuotations.length - 2 && currentQuotations.length > 2;

                  return (
                    <tr key={rowKey} className={`${isItemsOpen ? 'has-open-popover' : ''} ${isDropdownOpen ? 'has-open-dropdown' : ''}`}>
                      <td data-label="QUOTATION ID" className="col-priority-high cell-nowrap">
                        <button
                          type="button"
                          className="enquiry-id-link"
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                          onClick={() => onOpenQuotation(quote.enquiryId, quote.quotationId)}
                        >
                          <span className="master-code quotation-code-badge">{quote.quotationId || '—'}</span>
                        </button>
                      </td>
                      <td data-label="CUSTOMER" className="col-priority-high quotation-customer-cell">
                        <a
                          href={`/customers/${encodeURIComponent(quote.customerId)}`}
                          className="customer-table-link customer-name-link"
                          style={{ textDecoration: 'none' }}
                          title={quote.customerName || ''}
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                              e.preventDefault();
                              onNavigateCustomer?.(quote.customerId);
                            }
                          }}
                        >
                          {quote.customerName}
                        </a>
                      </td>
                      <td data-label="ENQUIRY ID" className="col-priority-med cell-nowrap">
                        {quote.enquiryId ? (
                          <a
                            href={`/enquiries/${encodeURIComponent(quote.enquiryId)}`}
                            className="enquiry-id-link"
                            onClick={(e) => {
                              if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                                e.preventDefault();
                                navigate(`/enquiries/${encodeURIComponent(quote.enquiryId)}`);
                              }
                            }}
                          >
                            {quote.enquiryId}
                          </a>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td data-label="ITEMS" className="col-priority-med quotation-items-cell" style={{ textAlign: 'center' }}>
                        {parsedProducts.length === 0 ? (
                          <span className="quotation-no-items" style={{ color: '#94a3b8' }}>—</span>
                        ) : (
                          <div className="quotation-items-wrapper">
                            <button
                              type="button"
                              className={`quotation-items-trigger ${isItemsOpen ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenItemsQuoteId(isItemsOpen ? null : rowKey);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setOpenItemsQuoteId(isItemsOpen ? null : rowKey);
                                }
                              }}
                              aria-expanded={isItemsOpen}
                              aria-haspopup="true"
                              title="Click to view quotation items"
                            >
                              <span>{parsedProducts.length} {parsedProducts.length === 1 ? 'Item' : 'Items'}</span>
                              <span className="quotation-items-arrow" aria-hidden="true">{isItemsOpen ? '▴' : '▾'}</span>
                            </button>

                            {isItemsOpen && (
                              <div
                                className={`quotation-items-popover ${isNearBottom ? 'placement-top' : ''}`}
                                role="dialog"
                                aria-label="Quotation items"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="quotation-items-popover-header">
                                  <span>{parsedProducts.length} {parsedProducts.length === 1 ? 'Item' : 'Items'}</span>
                                  <button
                                    type="button"
                                    className="quotation-items-popover-close"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenItemsQuoteId(null);
                                    }}
                                    aria-label="Close items list"
                                    title="Close"
                                  >
                                    ×
                                  </button>
                                </div>
                                <ul className="quotation-items-popover-list">
                                  {parsedProducts.map((it, pIdx) => (
                                    <li key={pIdx} className="quotation-items-popover-item">
                                      <span className="popover-item-qty">{it.qty} ×</span>{' '}
                                      <span className="popover-item-name">{it.name}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td data-label="TOTAL AMOUNT" className="col-priority-high cell-nowrap" style={{ textAlign: 'right' }}>
                        <strong>{`₹${Number(quote.grandTotal || quote.amount || 0).toLocaleString('en-IN')}`}</strong>
                      </td>
                      <td data-label="UPDATED" className="col-priority-low cell-nowrap" style={{ textAlign: 'center' }}>{formatDate(quote.updatedAt || quote.createdAt)}</td>
                      <td data-label="STATUS" className="col-priority-high cell-nowrap" style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                          {getStatusBadge(quote.status, quote.orderId)}
                          {isConverted && quote.orderId && (
                            <a
                              href={`/orders/${encodeURIComponent(quote.orderId)}`}
                              onClick={(e) => {
                                if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                                  e.preventDefault();
                                  navigate(`/orders/${encodeURIComponent(quote.orderId)}`);
                                }
                              }}
                              className="order-link-pill"
                              title={`View linked Order ${quote.orderId}`}
                            >
                              <span>→</span>
                              <span>{quote.orderId}</span>
                            </a>
                          )}
                        </div>
                      </td>
                      <td data-label="ACTIONS" className="actions-col col-priority-high" style={{ textAlign: 'right' }}>
                        <div className="quotation-row-actions settings-row-actions" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            className="tbl-action-btn edit"
                            onClick={() => onOpenQuotation(quote.enquiryId, quote.quotationId)}
                            title="View / Edit quotation details"
                          >
                            <Eye size={13} />
                            <span>View</span>
                          </button>

                          <div className="quotation-actions-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              className={`quotation-more-trigger ${isDropdownOpen ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdownQuoteId(isDropdownOpen ? null : rowKey);
                              }}
                              aria-expanded={isDropdownOpen}
                              aria-haspopup="true"
                              title="More quotation actions"
                            >
                              <MoreHorizontal size={14} />
                            </button>

                            {isDropdownOpen && (
                              <div
                                className={`quotation-actions-dropdown-menu ${isNearBottom ? 'placement-top' : ''}`}
                                role="menu"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {/* 1. View / Edit */}
                                <button
                                  type="button"
                                  className="dropdown-action-item"
                                  onClick={() => {
                                    setOpenDropdownQuoteId(null);
                                    onOpenQuotation(quote.enquiryId, quote.quotationId);
                                  }}
                                  role="menuitem"
                                >
                                  <Eye size={14} />
                                  <span>View / Edit Quotation</span>
                                </button>

                                {/* 2. Official PDF */}
                                {(isAccepted || isConverted) && (
                                  <button
                                    type="button"
                                    className="dropdown-action-item"
                                    onClick={() => {
                                      setOpenDropdownQuoteId(null);
                                      handleOpenQuotationPdf(quote);
                                    }}
                                    disabled={pdfLoadingQuoteId === quote.quotationId}
                                    role="menuitem"
                                  >
                                    <FileText size={14} />
                                    <span>{pdfLoadingQuoteId === quote.quotationId ? 'Loading PDF...' : 'Download Official PDF'}</span>
                                  </button>
                                )}

                                {/* 3. Copy Quotation (Clone) */}
                                <button
                                  type="button"
                                  className="dropdown-action-item primary-accent"
                                  onClick={() => handleCopyQuotation(quote)}
                                  role="menuitem"
                                  title="Copy products and specifications to quote for another customer"
                                >
                                  <Copy size={14} style={{ color: '#2563eb' }} />
                                  <span style={{ fontWeight: 600, color: '#1d4ed8' }}>Copy Quotation</span>
                                </button>

                                {/* 4. Accept / Reject for Awaiting quotations */}
                                {!isConverted && !isAccepted && quote.status !== 'REJECTED' && (can('Approve') || can('Reject')) && (
                                  <>
                                    <div className="dropdown-action-divider" />
                                    {can('Approve') && (
                                      <button
                                        type="button"
                                        className="dropdown-action-item success"
                                        onClick={() => {
                                          setOpenDropdownQuoteId(null);
                                          updateStatus(quote.quotationId, 'ACCEPTED');
                                        }}
                                        role="menuitem"
                                      >
                                        <Check size={14} style={{ color: '#16a34a' }} strokeWidth={2.5} />
                                        <span style={{ color: '#15803d', fontWeight: 600 }}>Mark Accepted</span>
                                      </button>
                                    )}
                                    {can('Reject') && (
                                      <button
                                        type="button"
                                        className="dropdown-action-item danger-subtle"
                                        onClick={() => {
                                          setOpenDropdownQuoteId(null);
                                          const reason = window.prompt('Reason for rejecting this quotation:');
                                          if (reason === null) return;
                                          if (!reason.trim()) {
                                            setError('A rejection reason is required.');
                                            return;
                                          }
                                          updateStatus(quote.quotationId, 'REJECTED', reason.trim());
                                        }}
                                        role="menuitem"
                                      >
                                        <X size={14} style={{ color: '#e11d48' }} strokeWidth={2.5} />
                                        <span style={{ color: '#be123c' }}>Reject Quotation</span>
                                      </button>
                                    )}
                                  </>
                                )}

                                {/* 5. Convert to Order (Only when Accepted) */}
                                {canConvert && isAccepted && !isConverted && (
                                  <>
                                    <div className="dropdown-action-divider" />
                                    <button
                                      type="button"
                                      className="dropdown-action-item primary-accent"
                                      onClick={() => {
                                        setOpenDropdownQuoteId(null);
                                        convertToOrder(quote);
                                      }}
                                      disabled={converting === quote.quotationId}
                                      role="menuitem"
                                    >
                                      <Zap size={14} style={{ color: '#2563eb' }} />
                                      <span style={{ color: '#1d4ed8', fontWeight: 600 }}>
                                        {converting === quote.quotationId ? 'Converting...' : 'Convert to Sales Order'}
                                      </span>
                                    </button>
                                  </>
                                )}

                                {/* 6. Generate Proforma Invoice */}
                                {(isAccepted || isConverted) && (
                                  <button
                                    type="button"
                                    className="dropdown-action-item"
                                    onClick={() => {
                                      setOpenDropdownQuoteId(null);
                                      navigate(`/orders/proformas/new?quotationId=${encodeURIComponent(quote.quotationId)}`);
                                    }}
                                    role="menuitem"
                                  >
                                    <FilePlus size={14} style={{ color: '#0369a1' }} />
                                    <span>Generate Proforma (PI)</span>
                                  </button>
                                )}

                                {/* 7. Delete */}
                                {can('Delete') && (
                                  <>
                                    <div className="dropdown-action-divider" />
                                    <button
                                      type="button"
                                      className="dropdown-action-item danger"
                                      onClick={() => {
                                        setOpenDropdownQuoteId(null);
                                        deleteQuote(quote);
                                      }}
                                      role="menuitem"
                                    >
                                      <Trash2 size={14} style={{ color: '#dc2626' }} />
                                      <span style={{ color: '#dc2626' }}>Delete Quotation</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              {!loading && currentQuotations.length > 0 && currentQuotations.length < pageSize && (
                Array.from({ length: pageSize - currentQuotations.length }).map((_, fIdx) => (
                  <tr key={`filler-${fIdx}`} className="table-data-row table-filler-row" aria-hidden="true">
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td style={{ textAlign: 'center' }}>&nbsp;</td>
                    <td style={{ textAlign: 'right' }}>&nbsp;</td>
                    <td style={{ textAlign: 'center' }}>&nbsp;</td>
                    <td style={{ textAlign: 'center' }}>&nbsp;</td>
                    <td className="actions-col" style={{ textAlign: 'right' }}>&nbsp;</td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>

          {/* Enterprise Table Footer */}
          <TableFooter
            showingStart={showingStart}
            showingEnd={showingEnd}
            total={totalRecords}
            recordLabel="quotations"
            singularLabel="quotation"
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
          />
        </div>

      {/* Official ASI Quotation PDF Preview & Download Modal - Only allowed for ACCEPTED or CONVERTED quotations */}
      {selectedQuoteForPdf && (selectedQuoteForPdf.status === 'ACCEPTED' || selectedQuoteForPdf.status === 'CONFIRMED' || selectedQuoteForPdf.status === 'CONVERTED' || Boolean(selectedQuoteForPdf.orderId)) && (
        <DocumentPreviewModal
          title="Official Quotation"
          docId={selectedQuoteForPdf.quotationId}
          docType="quotation"
          status={selectedQuoteForPdf.status}
          filename={getQuotationFilename(selectedQuoteForPdf)}
          onClose={() => setSelectedQuoteForPdf(null)}
        >
          <PrintableQuotation data={selectedQuoteForPdf} />
        </DocumentPreviewModal>
      )}
    </div>
  );
}