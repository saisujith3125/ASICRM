import React, { useState, useEffect, useMemo } from 'react';
import { apiFetch, apiUrl } from '../../api';
import { hasPermission } from '../../utils/permissions';
import AddCustomerModal from './AddCustomerModal';
import { useTablePagination, TableFooter } from '../common/TableWorkspace';
import { filterRecordsBySearch } from '../../utils/searchHelper';

const CUSTOMER_SEARCH_EXTRACTORS = [
  (c) => c.id,
  (c) => c.name,
  (c) => c.company,
  (c) => c.contactPerson,
  (c) => c.mobile,
  (c) => c.phone,
  (c) => c.email,
  (c) => c.city,
  (c) => c.state,
  (c) => c.address,
  (c) => c.branch,
  (c) => c.gstin
];

export default function CustomerList({ user, onSelectCustomer, onCreateEnquiryForCustomer }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    mobile: '',
    email: '',
    contactPerson: '',
    company: '',
    customerType: 'Individual',
    address: '',
    city: '',
    state: ''
  });
  const [editErrors, setEditErrors] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  const canCreate = hasPermission(user, 'Customers', 'Create');
  const canEdit = hasPermission(user, 'Customers', 'Edit');
  const canDelete = hasPermission(user, 'Customers', 'Delete');

  const fetchCustomers = async (searchTerm = search) => {
    setLoading(true);
    try {
      const query = typeof searchTerm === 'string' ? searchTerm.trim() : search.trim();
      const url = query ? apiUrl(`/api/customers?search=${encodeURIComponent(query)}`) : apiUrl('/api/customers');
      const res = await apiFetch(url, { headers: { 'x-user-id': user?.id || '' } });
      const data = await res.json();
      if (res.ok && data.success) {
        const raw = data.data || [];
        const ordered = [...raw].sort((a, b) => {
          const na = Number(String(a.id || '').match(/(\d+)$/)?.[1] || 0);
          const nb = Number(String(b.id || '').match(/(\d+)$/)?.[1] || 0);
          return na - nb;
        });
        setCustomers(ordered);
        setError('');
      } else {
        setError((prev) => (customers.length === 0 ? (data.message || 'Failed to load customers.') : ''));
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError((prev) => (customers.length === 0 ? 'Unable to load customer directory.' : ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();

    const handleGlobalCreated = () => {
      fetchCustomers();
    };

    window.addEventListener('crm-customer-created', handleGlobalCreated);
    return () => {
      window.removeEventListener('crm-customer-created', handleGlobalCreated);
    };
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCustomers(search);
  };

  const handleClearSearch = () => {
    setSearch('');
    fetchCustomers('');
  };

  // Live client-side filtering while typing
  const filteredCustomers = useMemo(() => {
    return filterRecordsBySearch(customers, search, CUSTOMER_SEARCH_EXTRACTORS);
  }, [customers, search]);

  // Customer records pagination with dynamic row capacity
  const {
    currentPage,
    totalPages,
    pageSize,
    currentRecords: currentCustomers,
    showingStart,
    showingEnd,
    totalRecords,
    goToPage
  } = useTablePagination(filteredCustomers, {
    rowHeight: 45,
    resetDeps: [search]
  });

  // Edit Customer handlers
  const openEditModal = (c) => {
    setEditingCustomer(c);
    const isInd = (c.customerType || '').toLowerCase() === 'individual';
    setEditForm({
      name: isInd ? (c.name || '') : (c.contactPerson || c.name || ''),
      company: c.company || (!isInd ? (c.name || '') : ''),
      contactPerson: c.contactPerson || (!isInd ? (c.name || '') : ''),
      mobile: c.mobile || '',
      email: c.email || '',
      customerType: c.customerType || 'Individual',
      gstin: c.gstin || '',
      address: c.address || '',
      city: c.city || '',
      state: c.state || ''
    });
    setEditErrors({});
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    const errs = {};
    const isInd = editForm.customerType === 'Individual';
    if (isInd) {
      if (!editForm.name.trim()) errs.name = 'Customer name is required.';
    } else {
      if (!editForm.company.trim()) errs.company = 'Company / Enterprise name is required.';
      if (!editForm.name.trim() && !editForm.contactPerson.trim()) errs.name = 'Customer name (contact person) is required.';
    }
    const rawMobile = editForm.mobile.replace(/\D/g, '');
    if (!rawMobile || rawMobile.length !== 10) errs.mobile = 'Please enter a valid 10-digit mobile number.';
    if (!editForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }

    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }

    setSavingEdit(true);
    setEditErrors({});

    const effCompany = isInd ? '' : editForm.company.trim();
    const effContact = isInd ? editForm.name.trim() : (editForm.name.trim() || editForm.contactPerson.trim());
    // For business, dealer, corporate: take company name as primary customer name on Customer Page!
    const effPrimaryName = isInd ? editForm.name.trim() : (editForm.company.trim() || editForm.name.trim());

    try {
      const res = await apiFetch(apiUrl(`/api/customers/${editingCustomer.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || ''
        },
        body: JSON.stringify({
          name: effPrimaryName,
          mobile: rawMobile.slice(-10),
          email: editForm.email.trim(),
          contactPerson: effContact,
          company: effCompany,
          customerType: editForm.customerType,
          gstin: (editForm.customerType === 'Business' || editForm.customerType === 'Corporate') ? (editForm.gstin || '').trim().toUpperCase() : '',
          address: editForm.address.trim(),
          city: editForm.city.trim(),
          state: editForm.state.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setCustomers((prev) =>
          prev.map((item) => (item.id === editingCustomer.id ? { ...item, ...data.data } : item))
        );
        setEditingCustomer(null);
        setSuccessToast(`Customer "${editForm.name}" updated successfully.`);
        setTimeout(() => setSuccessToast(''), 3000);
      } else {
        setEditErrors({ general: data.message || 'Failed to update customer.' });
      }
    } catch (err) {
      console.error('Error updating customer:', err);
      setEditErrors({ general: 'Network error updating customer.' });
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete Customer handler
  const handleDeleteCustomer = (c) => {
    if (!window.confirm(`Are you sure you want to delete customer "${c.name}"?`)) return;
    setCustomers((prev) => prev.filter((item) => item.id !== c.id));
    setSuccessToast(`Customer "${c.name}" removed.`);
    setTimeout(() => setSuccessToast(''), 3000);
  };

  return (
    <div className="crm-customer-page-container">
      {/* 1. Compact Page Title */}
      <div className="page-header-row customer-page-header">
        <h1 className="page-title">Customer</h1>
      </div>

      {/* 2. Search + Action Area */}
      <div className="customer-toolbar-card">
        <form onSubmit={handleSearchSubmit} className="customer-search-form">
          <div className="customer-search-input-wrap">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search customers by name, company, phone, email, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="customer-search-input-field"
              aria-label="Search customers"
            />
            {search && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={handleClearSearch}
                title="Clear search"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <button type="submit" className="search-submit-btn">Search</button>
        </form>

        {canCreate && (
          <button
            type="button"
            className="crm-btn-primary add-customer-btn"
            onClick={() => setIsAddModalOpen(true)}
          >
            + Add New Customer
          </button>
        )}
      </div>

      {successToast && (
        <div className="toast-notification-banner success" style={{ marginBottom: '12px' }}>
          <span>✓</span>
          <span>{successToast}</span>
        </div>
      )}

      {error && customers.length === 0 && (
        <div className="crm-alert-box error" style={{ marginBottom: '12px' }}>
          <span>{error}</span>
          <button type="button" onClick={() => fetchCustomers()} className="crm-btn-secondary compact" style={{ marginLeft: '12px' }}>Retry</button>
          <button type="button" onClick={() => setError('')} className="close-toast-btn">✕</button>
        </div>
      )}

      {/* 3. Customer Table Workspace Card */}
      <div className="settings-table-shell stocks-table-shell customer-master-card" style={{ height: '100%' }}>
        <div className="crm-table-scroll-wrap stocks-table-natural-wrap">
          <table className="settings-table customer-directory-table">
            <colgroup>
              <col style={{ width: '10%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '23%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '7%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="col-priority-high">CUSTOMER ID</th>
                <th className="col-priority-high">CUSTOMER</th>
                <th className="col-priority-med">MOBILE</th>
                <th className="col-priority-low">EMAIL</th>
                <th className="col-priority-low" style={{ textAlign: 'center' }}>ENQUIRIES</th>
                <th className="col-priority-low" style={{ textAlign: 'center' }}>ACTIVE</th>
                <th className="actions-col col-priority-high" style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className="empty-row">
                  <td colSpan="7">
                    <div className="table-loading-state">
                      <div className="crm-spinner" />
                      <p>Loading customers...</p>
                    </div>
                  </td>
                </tr>
              ) : currentCustomers.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan="7">
                    <div className="table-empty-state">
                      <p>{search ? 'No customers match your search.' : 'No customers found.'}</p>
                      {search ? (
                        <button
                          className="crm-btn-secondary compact"
                          type="button"
                          onClick={handleClearSearch}
                          style={{ marginTop: '8px' }}
                        >
                          Clear Search
                        </button>
                      ) : canCreate && (
                        <button
                          className="crm-btn-primary compact"
                          type="button"
                          onClick={() => setIsAddModalOpen(true)}
                        >
                          + Add New Customer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                currentCustomers.map((c) => (
                  <tr key={c.id} className="table-data-row">
                    <td data-label="CUSTOMER ID" className="col-priority-high">
                      <span className="customer-id-pill master-code">{c.id}</span>
                    </td>
                    <td data-label="CUSTOMER" className="col-priority-high cell-wrap">
                      {(() => {
                        const isIndividual = (c.customerType || '').toLowerCase() === 'individual';
                        // For Business, Corporate, or Dealer: the Customer column takes the Company Name as Customer Name!
                        const customerDisplayName = (!isIndividual && c.company) ? c.company : (c.name || c.company || '—');
                        const contactName = (!isIndividual && (c.contactPerson || (c.name && c.name !== customerDisplayName)))
                          ? (c.contactPerson || (c.name !== customerDisplayName ? c.name : ''))
                          : null;

                        return (
                          <div>
                            <a
                              href={`/customers/${encodeURIComponent(c.id)}`}
                              onClick={(e) => {
                                if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                                  e.preventDefault();
                                  onSelectCustomer(c.id);
                                }
                              }}
                              className="customer-table-link customer-table-name"
                              title={customerDisplayName}
                              style={{ textDecoration: 'none', fontWeight: 600, color: '#0f172a' }}
                            >
                              {customerDisplayName}
                            </a>
                            {contactName && (
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span style={{ fontSize: '10px' }}>👤</span>
                                <span>{contactName}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td data-label="MOBILE" className="col-priority-med cell-nowrap">
                      +91 {c.mobile}
                    </td>
                    <td data-label="EMAIL" className="customer-email-cell col-priority-low cell-wrap" title={c.email || ''}>
                      {c.email || '—'}
                    </td>
                    <td data-label="ENQUIRIES" className="col-priority-low" style={{ textAlign: 'center' }}>
                      <span className="count-badge">{c.totalEnquiries || 0}</span>
                    </td>
                    <td data-label="ACTIVE" className="col-priority-low" style={{ textAlign: 'center' }}>
                      <span className={`count-badge ${c.activeEnquiries > 0 ? 'active-count' : ''}`}>
                        {c.activeEnquiries || 0}
                      </span>
                    </td>
                    <td data-label="ACTIONS" className="actions-col col-priority-high" style={{ textAlign: 'right' }}>
                      <div className="settings-row-actions" style={{ justifyContent: 'flex-end' }}>
                        {canEdit && (
                          <button
                            type="button"
                            className="settings-row-action customer-action-btn"
                            onClick={() => openEditModal(c)}
                            aria-label={`Edit ${c.name}`}
                            title="Edit Customer"
                          >
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="settings-row-action danger customer-action-btn"
                            onClick={() => handleDeleteCustomer(c)}
                            aria-label={`Delete ${c.name}`}
                            title="Delete Customer"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {!loading && currentCustomers.length > 0 && currentCustomers.length < pageSize && (
                Array.from({ length: pageSize - currentCustomers.length }).map((_, fIdx) => (
                  <tr key={`filler-${fIdx}`} className="table-data-row table-filler-row" aria-hidden="true">
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

        {/* 4. Enterprise Table Footer */}
        <TableFooter
          showingStart={showingStart}
          showingEnd={showingEnd}
          total={totalRecords}
          recordLabel="customers"
          singularLabel="customer"
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
        />
      </div>

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <AddCustomerModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onCustomerCreated={(newCust) => {
            setIsAddModalOpen(false);
            setSuccessToast(`Customer "${newCust.name}" created successfully.`);
            setTimeout(() => setSuccessToast(''), 3000);
            fetchCustomers();
          }}
          onSelectExistingCustomer={(existingCust) => {
            setIsAddModalOpen(false);
            setSuccessToast(`Existing customer "${existingCust.name}" found.`);
            setTimeout(() => setSuccessToast(''), 3000);
            setSearch(existingCust.name);
            fetchCustomers(existingCust.name);
          }}
          existingCustomers={customers}
        />
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="crm-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !savingEdit && setEditingCustomer(null)}>
          <div className="crm-modal-card" role="dialog" aria-modal="true" style={{ maxWidth: '520px', width: '100%' }}>
            <div className="crm-modal-header">
              <div>
                <span className="panel-kicker">EDIT CUSTOMER</span>
                <h3>{editingCustomer.id} · {editingCustomer.name}</h3>
              </div>
              <button
                type="button"
                className="crm-modal-close"
                onClick={() => !savingEdit && setEditingCustomer(null)}
                disabled={savingEdit}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ padding: '18px 22px' }}>
              {editErrors.general && (
                <div className="crm-alert-box error" style={{ marginBottom: '14px' }}>
                  <span>{editErrors.general}</span>
                </div>
              )}

              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="field-group">
                  <label className="field-label">Customer Type</label>
                  <select
                    value={editForm.customerType}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      const isAllowed = nextType === 'Business' || nextType === 'Corporate';
                      setEditForm((f) => ({
                        ...f,
                        customerType: nextType,
                        gstin: isAllowed ? f.gstin : ''
                      }));
                    }}
                    className="crm-select-input"
                  >
                    <option value="Individual">Individual</option>
                    <option value="Business">Business</option>
                    <option value="Dealer">Dealer</option>
                    <option value="Corporate">Corporate</option>
                  </select>
                </div>

                {editForm.customerType === 'Individual' ? (
                  <div className="field-group">
                    <label className="field-label">Customer Name <span className="req-star">*</span></label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className="crm-text-input"
                      placeholder="e.g. Rajesh Kumar"
                      required
                    />
                    {editErrors.name && <span className="field-error-text" style={{ color: '#dc2626', fontSize: '11px' }}>{editErrors.name}</span>}
                  </div>
                ) : (
                  <div className="field-group">
                    <label className="field-label">Company / Enterprise Name <span className="req-star">*</span></label>
                    <input
                      type="text"
                      value={editForm.company}
                      onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))}
                      className="crm-text-input"
                      placeholder="e.g. Tata Motors Ltd, ABC Tech"
                      required
                    />
                    {editErrors.company && <span className="field-error-text" style={{ color: '#dc2626', fontSize: '11px' }}>{editErrors.company}</span>}
                  </div>
                )}
              </div>

              {editForm.customerType !== 'Individual' && (
                <div className="field-group" style={{ marginBottom: '12px' }}>
                  <label className="field-label">Customer Name (Contact Person) <span className="req-star">*</span></label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value, contactPerson: e.target.value }))}
                    className="crm-text-input"
                    placeholder="e.g. Rajesh Kumar"
                    required
                  />
                  {editErrors.name && <span className="field-error-text" style={{ color: '#dc2626', fontSize: '11px' }}>{editErrors.name}</span>}
                </div>
              )}

              <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div className="field-group">
                  <label className="field-label">Mobile Number <span className="req-star">*</span></label>
                  <input
                    type="tel"
                    value={editForm.mobile}
                    onChange={(e) => setEditForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                    className="crm-text-input"
                    placeholder="10 digits"
                    required
                  />
                  {editErrors.mobile && <span className="field-error-text" style={{ color: '#dc2626', fontSize: '11px' }}>{editErrors.mobile}</span>}
                </div>

                <div className="field-group">
                  <label className="field-label">Email Address <span className="req-star">*</span></label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    className="crm-text-input"
                    required
                  />
                  {editErrors.email && <span className="field-error-text" style={{ color: '#dc2626', fontSize: '11px' }}>{editErrors.email}</span>}
                </div>
              </div>

              <div className="field-group" style={{ marginBottom: '12px' }}>
                <label className="field-label">City</label>
                <input
                  type="text"
                  value={editForm.city}
                  onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                  className="crm-text-input"
                />
              </div>

              {(editForm.customerType === 'Business' || editForm.customerType === 'Corporate') && (
                <div className="field-group" style={{ marginBottom: '12px' }}>
                  <label className="field-label">GSTIN / UIN</label>
                  <input
                    type="text"
                    value={editForm.gstin || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                    className="crm-text-input"
                    placeholder="e.g. 33AAAAA0000A1Z5"
                    maxLength={15}
                    style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
                  />
                </div>
              )}

              <div className="field-group" style={{ marginBottom: '18px' }}>
                <label className="field-label">Address</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                  className="crm-text-input"
                  placeholder="Street, locality, pin..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={() => setEditingCustomer(null)}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="crm-btn-primary"
                  disabled={savingEdit}
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

