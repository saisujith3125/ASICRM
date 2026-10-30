import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch, apiUrl } from '../../api';
import { statusBadgeClass, statusLabel } from '../../utils/crmDisplay';
import { hasPermission } from '../../utils/permissions';
import { navigate } from '../../router';
import { useTablePagination, TableFooter } from '../common/TableWorkspace';
import { filterRecordsBySearch } from '../../utils/searchHelper';

function authHeaders(user) {
  const headers = { 'Content-Type': 'application/json' };
  if (user?.id) headers['x-user-id'] = user.id;
  if (user?.mobile) headers['x-user-mobile'] = user.mobile;
  if (user?.email) headers['x-user-email'] = user.email;
  return headers;
}

const ENQUIRY_SEARCH_EXTRACTORS = [
  (e) => e.enquiryId,
  (e) => e.customerName,
  (e) => e.customerCompany,
  (e) => e.company,
  (e) => e.customerContactPerson,
  (e) => e.contactPerson,
  (e) => e.customerMobile,
  (e) => e.mobile,
  (e) => e.customerPhone,
  (e) => e.phone,
  (e) => e.customerEmail,
  (e) => e.email,
  (e) => e.type,
  (e) => e.subject,
  (e) => e.description,
  (e) => e.requirement,
  (e) => e.city,
  (e) => e.address,
  (e) => e.location,
  (e) => e.status,
  (e) => e.priority,
  (e) => e.assignedTo,
  (e) => e.rep,
  (e) => e.quotationId,
  (e) => e.items
];

export default function EnquiryList({ user, onSelectEnquiry, onCreateEnquiry: _onCreateEnquiry, onNavigateCustomer }) {
  const [enquiries, setEnquiries] = useState([]);
  const [metrics, setMetrics] = useState({ total: 0, new: 0, inProgress: 0, readyForQuotation: 0, notResponding: 0, caseClosed: 0, forceClosed: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [error, setError] = useState('');
  const [selectedRequirementsEnquiry, setSelectedRequirementsEnquiry] = useState(null);

  const fetchEnquiries = async (overrideSearch) => {
    setLoading(true);
    setError('');
    try {
      const query = overrideSearch !== undefined ? overrideSearch.trim() : search.trim();
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (priorityFilter !== 'ALL') params.append('priority', priorityFilter);
      if (query) params.append('search', query);

      const res = await apiFetch(apiUrl(`/api/enquiries?${params.toString()}`), { headers: { 'x-user-id': user?.id || '' } });
      const data = await res.json();

      if (res.ok && data.success) {
        const raw = data.data || [];
        // Employees can see the full enquiry history. Action controls below
        // still respect assignment/role, so visibility does not grant edit rights.
        setEnquiries(raw);
        if (data.metrics) setMetrics(data.metrics);
        setError('');
      } else {
        setError((prev) => (enquiries.length === 0 ? (data.message || 'Failed to load enquiries.') : ''));
      }
    } catch (err) {
      console.error('Error fetching enquiries:', err);
      setError((prev) => (enquiries.length === 0 ? 'Unable to load enquiries. Please check backend server connection.' : ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnquiries();
  }, [statusFilter, priorityFilter, user]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchEnquiries(search);
  };

  const handleClearSearch = () => {
    setSearch('');
    fetchEnquiries('');
  };

  const isReadyForQuotation = (enquiry) => {
    if (!enquiry || enquiry.status === 'CLOSED' || enquiry.closureType) return false;
    if (enquiry.quotationId) return false;
    return enquiry.status === 'READY_FOR_QUOTATION' ||
      enquiry.workflowStage === 'READY_FOR_QUOTATION' ||
      enquiry.outcome === 'LEAD_CONFIRMATION';
  };

  const openEnquiry = (enquiry) => {
    if (enquiry.status === 'CLOSED') {
      onSelectEnquiry(enquiry.enquiryId, 'solved');
      return;
    }
    if (enquiry.status === 'QUOTATION_ISSUED' && enquiry.quotationId) {
      onSelectEnquiry(enquiry.enquiryId, 'quotation');
      return;
    }
    if (enquiry.status === 'NEW' && !enquiry.description) {
      onSelectEnquiry(enquiry.enquiryId, 'details');
      return;
    }
    onSelectEnquiry(enquiry.enquiryId, 'followup');
  };

  const canView = hasPermission(user, 'Enquiries', 'View');
  const canEdit = hasPermission(user, 'Enquiries', 'Edit');
  const canDelete = hasPermission(user, 'Enquiries', 'Delete');
  const canCreateQuotation = hasPermission(user, 'Quotations', 'Create');

  const handleDeleteEnquiry = async (enq) => {
    if (!window.confirm(`Are you sure you want to delete enquiry "${enq.enquiryId}"? This action cannot be undone.`)) return;
    try {
      const res = await apiFetch(apiUrl(`/api/enquiries/${encodeURIComponent(enq.enquiryId)}`), {
        method: 'DELETE',
        headers: authHeaders(user)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEnquiries((prev) => prev.filter((item) => item.enquiryId !== enq.enquiryId));
        setMetrics((prev) => {
          const statusKey = enq.status === 'NEW' ? 'new'
            : enq.status === 'IN_PROGRESS' ? 'inProgress'
            : enq.status === 'READY_FOR_QUOTATION' ? 'readyForQuotation'
            : enq.status === 'NOT_RESPONDING' ? 'notResponding'
            : enq.status === 'CLOSED' ? 'closed' : '';
          return {
            ...prev,
            total: Math.max(0, (prev.total || 0) - 1),
            ...(statusKey && prev[statusKey] ? { [statusKey]: Math.max(0, prev[statusKey] - 1) } : {})
          };
        });
      } else {
        alert(data.message || 'Failed to delete enquiry.');
      }
    } catch (err) {
      console.error('Error deleting enquiry:', err);
      alert('Network error while deleting enquiry.');
    }
  };

  // Live client-side filtering while typing combined with status and priority filters
  const filteredEnquiries = useMemo(() => {
    let list = enquiries;
    if (statusFilter && statusFilter !== 'ALL') {
      list = list.filter((e) => e.status === statusFilter);
    }
    if (priorityFilter && priorityFilter !== 'ALL') {
      list = list.filter((e) => e.priority === priorityFilter);
    }
    const searched = filterRecordsBySearch(list, search, ENQUIRY_SEARCH_EXTRACTORS);
    return searched.sort((a, b) => {
      const aVal = String(a.enquiryId || '');
      const bVal = String(b.enquiryId || '');
      const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
      const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
      if (aNum && bNum && aNum !== bNum) return aNum - bNum;
      return aVal.localeCompare(bVal, undefined, { numeric: true });
    });
  }, [enquiries, search, statusFilter, priorityFilter]);

  const {
    currentPage,
    totalPages,
    pageSize,
    currentRecords: currentRows,
    showingStart,
    showingEnd,
    totalRecords,
    goToPage
  } = useTablePagination(filteredEnquiries, {
    rowHeight: 45,
    resetDeps: [search, statusFilter, priorityFilter]
  });

  return (
    <div className="crm-enquiry-page-container">
      {/* Page Header */}
      <div className="page-header-row">
        <h1 className="page-title">Enquiries</h1>
      </div>

      {/* Compact operational summary. Each item is a filter, not a decorative KPI card. */}
      <div className="enquiry-status-strip" role="group" aria-label="Enquiry status summary">
        {[
          ['All', metrics.total, 'ALL'],
          ['New', metrics.new, 'NEW'],
          ['In Progress', metrics.inProgress, 'IN_PROGRESS'],
          ['Ready for Quotation', metrics.readyForQuotation || 0, 'READY_FOR_QUOTATION'],
          ['Not Responding', metrics.notResponding, 'NOT_RESPONDING'],
          ['Case Closed', metrics.caseClosed || 0, 'CASE_CLOSED']
        ].map(([label, value, filter]) => (
          <button
            type="button"
            key={label}
            className={`enquiry-status-item ${statusFilter === filter ? 'active' : ''}`}
            onClick={() => {
              setStatusFilter(filter);
            }}
          >
            <span>{label}</span>
            <strong>{value}</strong>
          </button>
        ))}
      </div>

      {/* Search and Filters Bar */}
      <div className="table-controls-card">
        <form onSubmit={handleSearchSubmit} className="search-form-wrap">
          <div className="search-input-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search Enquiry ID, Customer, Phone, Rep..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input-field"
            />
            {search && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={handleClearSearch}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <button type="submit" className="search-submit-btn">Search</button>
        </form>

        <div className="filters-row">
          <div className="filter-dropdown-group">
            <label>Status:</label>
            <select value={statusFilter} onChange={(e) => {
              setStatusFilter(e.target.value);
            }}>
              <option value="ALL">All Statuses</option>
              <option value="NEW">New</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="READY_FOR_QUOTATION">Ready for Quotation</option>
              <option value="QUOTATION_ISSUED">Quotation Issued</option>
              <option value="NOT_RESPONDING">Not Responding</option>
              <option value="CASE_CLOSED">Case Closed</option>
              <option value="FORCE_CLOSED">Force Closed</option>
            </select>
          </div>

          <div className="filter-dropdown-group">
            <label>Priority:</label>
            <select value={priorityFilter} onChange={(e) => {
              setPriorityFilter(e.target.value);
            }}>
              <option value="ALL">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

        </div>
      </div>

      {error && enquiries.length === 0 && (
        <div className="crm-alert-box error" style={{ marginBottom: '12px' }}>
          <span>{error}</span>
          <button type="button" onClick={() => fetchEnquiries()} className="crm-btn-secondary compact" style={{ marginLeft: '12px' }}>Retry</button>
        </div>
      )}

      {/* Enquiries Data Table */}
      {/* Enquiries Data Table */}
      <div className="settings-table-shell stocks-table-shell crm-table-workspace enquiry-master-card">
        <div className="crm-table-scroll-wrap stocks-table-natural-wrap crm-table-viewport">
          <table className="crm-master-table crm-data-table settings-table enquiry-settings-table enquiry-register-table">
            <colgroup>
              <col className="col-enquiry-index" style={{ width: '4%' }} />
              <col className="col-enquiry-id" style={{ width: '13%' }} />
              <col className="col-enquiry-customer" style={{ width: '31%' }} />
              <col className="col-enquiry-priority" style={{ width: '12%' }} />
              <col className="col-enquiry-status" style={{ width: '18%' }} />
              <col className="col-enquiry-actions" style={{ width: '22%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="col-priority-low col-index-header" style={{ textAlign: 'center' }}>#</th>
                <th className="col-priority-high">Enquiry ID</th>
                <th className="col-priority-high">Customer Name</th>
                <th className="col-priority-med" style={{ textAlign: 'center' }}>Priority</th>
                <th className="col-priority-high" style={{ textAlign: 'center' }}>Status</th>
                <th className="actions-col enquiry-actions-header col-priority-high" style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="empty-row">
                  <td colSpan="6">
                    <div className="table-loading-state">
                      <div className="crm-spinner" />
                      <p>Loading enquiries...</p>
                    </div>
                  </td>
                </tr>
              ) : currentRows.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan="6">
                    <div className="table-empty-state">
                      <div className="empty-state-icon">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <h3>No enquiries found</h3>
                      <p>{search ? `No enquiries match your search "${search}".` : 'Try adjusting your search criteria or select a different enquiry status.'}</p>
                      {search ? (
                        <button
                          className="crm-btn-secondary compact"
                          type="button"
                          onClick={handleClearSearch}
                          style={{ marginTop: '8px' }}
                        >
                          Clear Search
                        </button>
                      ) : String(user?.permissions?.Enquiries || []).includes('Create') ? (
                        <p className="empty-state-secondary">Use Create Enquiry when you need to register a new customer requirement.</p>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : (
                currentRows.map((enq, index) => {
                  const rowNumber = (currentPage - 1) * pageSize + index + 1;
                  return (
                    <tr key={enq.enquiryId} className="table-data-row">
                      <td className="col-priority-low col-index-cell" data-label="#" style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                        {rowNumber}
                      </td>
                      <td data-label="Enquiry ID" className="col-priority-high">
                        <button
                          type="button"
                          onClick={() => openEnquiry(enq)}
                          className="enquiry-id-link"
                          title={`View ${enq.enquiryId}`}
                        >
                          <span className="master-code enquiry-code-badge">{enq.enquiryId}</span>
                        </button>
                      </td>
                      <td data-label="Customer" className="col-priority-high cell-wrap">
                        <a
                          href={`/customers/${encodeURIComponent(enq.customerId)}`}
                          className="customer-name-link"
                          onClick={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                              e.preventDefault();
                              onNavigateCustomer && onNavigateCustomer(enq.customerId);
                            }
                          }}
                        >
                          {enq.customerName}
                        </a>
                      </td>
                      <td data-label="Priority" className="col-priority-med" style={{ textAlign: 'center' }}>
                        <span className={`priority-badge p-${enq.priority ? enq.priority.toLowerCase() : 'medium'}`}>
                          {enq.priority || 'Medium'}
                        </span>
                      </td>
                      <td data-label="Status" className="col-priority-high" style={{ textAlign: 'center' }}>
                        <span className={`status-badge ${isReadyForQuotation(enq) ? 'badge-purple' : statusBadgeClass(enq.status, enq.closureType)}`}>
                          {isReadyForQuotation(enq) ? 'Ready for Quotation' : statusLabel(enq.status, enq.closureType)}
                        </span>
                      </td>
                      <td data-label="Actions" className="actions-col enquiry-actions-cell col-priority-high" style={{ textAlign: 'right' }}>
                        <div className="settings-row-actions" style={{ justifyContent: 'flex-end' }}>
                          {isReadyForQuotation(enq) && canCreateQuotation && (
                            <button
                              type="button"
                              className="settings-row-action enquiry-action-btn"
                              style={{ background: '#f5f3ff', color: '#7c3aed', borderColor: '#ddd6fe', fontWeight: 600 }}
                              onClick={() => navigate(`/enquiries/${encodeURIComponent(enq.enquiryId)}/quotation`)}
                              title="Create Quotation from this Enquiry"
                              aria-label={`Create Quotation for ${enq.enquiryId}`}
                            >
                              Quote →
                            </button>
                          )}
                          {enq.quotationId && (
                            <button
                              type="button"
                              className="settings-row-action enquiry-action-btn"
                              style={{ background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0', fontWeight: 600 }}
                              onClick={() => navigate(`/quotations/${encodeURIComponent(enq.quotationId)}`)}
                              title={`View Quotation ${enq.quotationId}`}
                              aria-label={`View Quotation ${enq.quotationId}`}
                            >
                              Quotation
                            </button>
                          )}
                          {canView && (
                            <button
                              type="button"
                              className="settings-row-action enquiry-action-btn"
                              onClick={() => setSelectedRequirementsEnquiry(enq)}
                              title="View requirements"
                              aria-label={`View requirements for ${enq.enquiryId}`}
                            >
                              View
                            </button>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              className="settings-row-action enquiry-action-btn"
                              onClick={() => openEnquiry(enq)}
                              title="Edit enquiry"
                              aria-label={`Edit ${enq.enquiryId}`}
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              className="settings-row-action danger enquiry-action-btn"
                              onClick={() => handleDeleteEnquiry(enq)}
                              title="Delete enquiry"
                              aria-label={`Delete ${enq.enquiryId}`}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              {!loading && currentRows.length > 0 && currentRows.length < pageSize && (
                Array.from({ length: pageSize - currentRows.length }).map((_, fIdx) => (
                  <tr key={`filler-${fIdx}`} className="table-data-row table-filler-row" aria-hidden="true">
                    <td className="col-priority-low col-index-cell">&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td>&nbsp;</td>
                    <td className="actions-col enquiry-actions-cell">&nbsp;</td>
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
          recordLabel="enquiries"
          singularLabel="enquiry"
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
        />
      </div>


      {selectedRequirementsEnquiry && (
        <div className="crm-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedRequirementsEnquiry(null);
        }}>
          <section
            className="crm-modal-card enquiry-requirements-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="enquiry-requirements-title"
          >
            <div className="crm-modal-header">
              <div>
                <span className="customer-profile-kicker">ENQUIRY REQUIREMENTS</span>
                <h2 id="enquiry-requirements-title">{selectedRequirementsEnquiry.enquiryId}</h2>
                <p>{selectedRequirementsEnquiry.customerName}</p>
              </div>
              <button
                type="button"
                className="crm-modal-close-btn"
                onClick={() => setSelectedRequirementsEnquiry(null)}
                aria-label="Close additional requirements"
              >
                ×
              </button>
            </div>

            <div className="enquiry-requirements-content">
              <div className="requirement-detail-primary">
                <span className="detail-label">Requirement</span>
                <p>{selectedRequirementsEnquiry.description || 'No requirement description recorded.'}</p>
              </div>

              <div className="enquiry-requirement-grid">
                <div>
                  <span className="detail-label">Products / Services</span>
                  <p>{selectedRequirementsEnquiry.productsInterested || '—'}</p>
                </div>
                <div>
                  <span className="detail-label">Expected Budget</span>
                  <p>{selectedRequirementsEnquiry.expectedBudget || '—'}</p>
                </div>
              </div>

              <div>
                <span className="detail-label">Additional Notes</span>
                <p>{selectedRequirementsEnquiry.additionalNotes || selectedRequirementsEnquiry.quickNote || '—'}</p>
              </div>
            </div>

            <div className="crm-modal-footer">
              <button type="button" className="crm-btn-secondary" onClick={() => setSelectedRequirementsEnquiry(null)}>
                Close
              </button>
              {canEdit && (
                <button
                  type="button"
                  className="crm-btn-primary"
                  onClick={() => {
                    const target = selectedRequirementsEnquiry;
                    setSelectedRequirementsEnquiry(null);
                    openEnquiry(target);
                  }}
                >
                  Edit Enquiry
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function enquiryFormatPhone(mobile, company) {
  if (mobile && company) return `+91 ${mobile} • ${company}`;
  if (mobile) return `+91 ${mobile}`;
  if (company) return company;
  return 'Individual';
}