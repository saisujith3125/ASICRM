import React, { useEffect, useMemo, useState } from 'react';
import CustomerSelector from '../customer/CustomerSelector';
import { ENQUIRY_TYPES, emptyBranch, shouldShowAssignedEmployee } from '../../utils/crmDisplay';
import { apiFetch, apiUrl } from '../../api';

const SOURCES = ['Phone Call', 'Message', 'Email', 'Website', 'Other'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const DEFAULT_EMPLOYEES = ['John Doe', 'Rajesh Kumar', 'Sarah Jenkins', 'Sneha Rao'];

const blankBranch = () => ({ ...emptyBranch(), branchId: undefined });

export default function CreateEnquiry({
  user,
  preselectedCustomerId,
  initialDraft,
  onSaveDraft,
  onClearDraft,
  onCancel,
  onSuccess,
  onNavigateCustomer
}) {
  const [submitting, setSubmitting] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [error, setError] = useState('');

  // Dynamic employees list from master settings
  const [employeesList, setEmployeesList] = useState([]);

  // Initialize from initialDraft if available, otherwise fall back to defaults
  const [customerMode, setCustomerMode] = useState(() => initialDraft?.customerMode || 'existing');
  const [customerId, setCustomerId] = useState(() => initialDraft?.customerId || preselectedCustomerId || '');
  const [customerData, setCustomerData] = useState(() => initialDraft?.customerData || null);
  const [duplicateCustomer, setDuplicateCustomer] = useState(null);
  const [allowDuplicate, setAllowDuplicate] = useState(false);
  const [source, setSource] = useState(() => initialDraft?.source || 'Phone Call');
  const [type, setType] = useState(() => initialDraft?.type || 'Product Enquiry');
  const [priority, setPriority] = useState(() => initialDraft?.priority || 'Medium');
  const [assignedTo, setAssignedTo] = useState(() => initialDraft?.assignedTo || '');
  const [initialEnquiryDate, setInitialEnquiryDate] = useState(() => initialDraft?.initialEnquiryDate || new Date().toISOString().split('T')[0]);
  const [branches, setBranches] = useState(() => (Array.isArray(initialDraft?.branches) ? initialDraft.branches : []));
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [editingBranchIndex, setEditingBranchIndex] = useState(null);
  const [branchDraft, setBranchDraft] = useState(blankBranch());

  // Fetch active employees from Master Settings and update reactively
  useEffect(() => {
    let active = true;
    const fetchEmployees = async () => {
      try {
        const res = await apiFetch(apiUrl('/api/settings/employees'));
        const json = await res.json();
        if (active && json.success && Array.isArray(json.data) && json.data.length > 0) {
          const names = json.data.map((u) => u.name).filter(Boolean);
          if (names.length > 0) {
            setEmployeesList(names);
            setAssignedTo((prev) => {
              if (prev && names.includes(prev)) return prev;
              if (initialDraft?.assignedTo && names.includes(initialDraft.assignedTo)) return initialDraft.assignedTo;
              if (user?.name && names.includes(user.name)) return user.name;
              return names[0];
            });
          }
        }
      } catch (e) {
        console.warn('Failed to load active employees in CreateEnquiry:', e);
      }
    };

    fetchEmployees();
    window.addEventListener('crm-user-updated', fetchEmployees);
    return () => {
      active = false;
      window.removeEventListener('crm-user-updated', fetchEmployees);
    };
  }, [user, initialDraft]);

  const availableEmployees = useMemo(() => {
    if (employeesList.length > 0) return employeesList;
    return DEFAULT_EMPLOYEES;
  }, [employeesList]);

  // Auto-fetch customer profile data and branches if customerId exists but customerData is missing
  useEffect(() => {
    if (customerMode === 'existing' && customerId && (!customerData || customerData.id !== customerId)) {
      let cancelled = false;
      const fetchSelectedCustomer = async () => {
        try {
          const res = await apiFetch(apiUrl(`/api/customers/${encodeURIComponent(customerId)}`));
          const data = await res.json();
          if (!cancelled && res.ok && data.success && data.data) {
            setCustomerData(data.data);
            if (!branches || branches.length === 0) {
              setBranches(Array.isArray(data.data.branches) ? data.data.branches : []);
            }
          }
        } catch (e) {
          console.warn('Failed to fetch selected customer details:', e);
        }
      };
      fetchSelectedCustomer();
      return () => { cancelled = true; };
    }
  }, [customerId, customerMode, customerData, branches]);

  // Synchronize when preselectedCustomerId prop changes externally
  useEffect(() => {
    if (preselectedCustomerId && preselectedCustomerId !== customerId) {
      setCustomerMode('existing');
      setCustomerId(preselectedCustomerId);
    }
  }, [preselectedCustomerId, customerId]);

  const existing = customerMode === 'existing';
  const busy = submitting || savingBranch;
  const displayBranches = useMemo(() => (Array.isArray(branches) ? branches : []), [branches]);

  const clearMessages = () => {
    setError('');
    setDuplicateCustomer(null);
  };

  const chooseMode = (mode) => {
    setCustomerMode(mode);
    clearMessages();
    setAllowDuplicate(false);
    setBranches(mode === 'existing' ? [] : []);
    if (mode === 'existing') {
      setCustomerId(preselectedCustomerId || '');
    } else {
      setCustomerId('');
      setCustomerData(null);
    }
  };

  const selectCustomer = (id, customer) => {
    setCustomerId(id);
    setCustomerData(customer || null);
    setBranches(Array.isArray(customer?.branches) ? customer.branches : []);
    clearMessages();
  };

  const openAddBranch = () => {
    setEditingBranchIndex(null);
    setBranchDraft(blankBranch());
    setBranchModalOpen(true);
    clearMessages();
  };

  const openEditBranch = (index) => {
    setEditingBranchIndex(index);
    setBranchDraft({ ...blankBranch(), ...(displayBranches[index] || {}) });
    setBranchModalOpen(true);
    clearMessages();
  };

  const closeBranchModal = () => {
    if (savingBranch) return;
    setBranchModalOpen(false);
    setEditingBranchIndex(null);
    setBranchDraft(blankBranch());
  };

  const updateBranchDraft = (field, value) => {
    setBranchDraft((current) => ({ ...current, [field]: value }));
  };

  const validateBranch = () => {
    if (!String(branchDraft.branchName || '').trim()) return 'Branch name is required.';
    if (!String(branchDraft.contactPerson || '').trim()) return 'Contact person is required.';
    const phone = String(branchDraft.phone || '').replace(/\D/g, '');
    if (phone && phone.length !== 10) return 'Phone number must contain exactly 10 digits.';
    if (branchDraft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(branchDraft.email).trim())) return 'Please enter a valid branch email address.';
    return '';
  };

  const persistExistingBranches = async (nextBranches) => {
    if (!existing || !customerId) return true;
    setSavingBranch(true);
    try {
      const response = await apiFetch(apiUrl(`/api/customers/${customerId}/branches`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branches: nextBranches })
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.data) {
        setError(data.message || 'Failed to save branch changes.');
        return false;
      }
      setCustomerData(data.data);
      setBranches(Array.isArray(data.data.branches) ? data.data.branches : []);
      return true;
    } catch (requestError) {
      console.error('Branch save error:', requestError);
      setError('Unable to save branch changes right now.');
      return false;
    } finally {
      setSavingBranch(false);
    }
  };

  const saveBranch = async (event) => {
    event.preventDefault();
    const validationError = validateBranch();
    if (validationError) {
      setError(validationError);
      return;
    }
    clearMessages();
    const normalized = {
      branchId: branchDraft.branchId || undefined,
      branchName: String(branchDraft.branchName || '').trim(),
      contactPerson: String(branchDraft.contactPerson || '').trim(),
      phone: String(branchDraft.phone || '').replace(/\D/g, '').slice(0, 10),
      email: String(branchDraft.email || '').trim()
    };
    const nextBranches = [...displayBranches];
    if (editingBranchIndex === null) nextBranches.push(normalized);
    else nextBranches[editingBranchIndex] = { ...nextBranches[editingBranchIndex], ...normalized };

    const persisted = await persistExistingBranches(nextBranches);
    if (!persisted) return;
    setBranches(nextBranches);
    closeBranchModal();
  };

  const removeBranch = async (index) => {
    clearMessages();
    const nextBranches = displayBranches.filter((_, itemIndex) => itemIndex !== index);
    const persisted = await persistExistingBranches(nextBranches);
    if (persisted) setBranches(nextBranches);
  };

  const updateNewCustomer = (field, value) => {
    setCustomerData(null);
    setDuplicateCustomer(null);
    setAllowDuplicate(false);
    setError('');
    setNewCustomer((current) => ({ ...current, [field]: value }));
  };

  const [newCustomer, setNewCustomer] = useState({
    name: '',
    mobile: '',
    email: '',
    contactPerson: '',
    customerType: 'Individual',
    city: '',
    state: '',
    address: '',
    notes: ''
  });
  const [moreDetailsOpen, setMoreDetailsOpen] = useState(false);

  const validateNewCustomer = () => {
    if (!newCustomer.name.trim()) return 'Customer name is required.';
    if (!/^\d{10}$/.test(newCustomer.mobile.trim())) return 'Please enter a valid 10-digit mobile number.';
    if (!newCustomer.email.trim()) return 'Email address is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newCustomer.email.trim())) return 'Please enter a valid email address.';
    return '';
  };

  const customerPayload = () => ({
    name: newCustomer.name.trim(),
    mobile: newCustomer.mobile.trim(),
    email: newCustomer.email.trim(),
    contactPerson: newCustomer.contactPerson.trim(),
    customerType: newCustomer.customerType,
    city: newCustomer.city.trim(),
    state: newCustomer.state.trim(),
    address: newCustomer.address.trim(),
    notes: newCustomer.notes.trim(),
    branches: displayBranches,
    allowDuplicate
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    clearMessages();

    if (existing && !customerId) {
      setError('Please select an existing customer.');
      return;
    }

    if (!existing) {
      const validationError = validateNewCustomer();
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setSubmitting(true);
    try {
      const enquiryFields = {
        source,
        type,
        priority,
        assignedTo: shouldShowAssignedEmployee(type) ? (assignedTo || availableEmployees[0] || 'Unassigned') : 'Unassigned',
        initialEnquiryDate
      };
      const body = existing
        ? { customerId, ...enquiryFields }
        : { newCustomer: customerPayload(), ...enquiryFields };

      const existingId = initialDraft?.existingEnquiryId || initialDraft?.enquiryId;
      let response;
      if (existingId) {
        response = await apiFetch(apiUrl(`/api/enquiries/${encodeURIComponent(existingId)}`), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user?.id || '',
          },
          body: JSON.stringify({
            ...(existing ? { customerId } : {}),
            ...enquiryFields
          })
        });
      } else {
        response = await apiFetch(apiUrl('/api/enquiries'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user?.id || '',
          },
          body: JSON.stringify(body)
        });
      }
      const data = await response.json();

      if (response.status === 409 || data.duplicate) {
        setDuplicateCustomer(data.data || data.customer);
        setError(data.message || 'Customer may already exist.');
        return;
      }
      if (!response.ok || !data.success || !data.data) {
        setError(data.message || 'Failed to save enquiry.');
        return;
      }
      onSuccess(data.data.enquiryId || existingId);
    } catch (requestError) {
      console.error('Create enquiry error:', requestError);
      setError('Unable to reach the server. Your entered information has been preserved.');
    } finally {
      setSubmitting(false);
    }
  };

  const applyDuplicateCustomer = () => {
    if (!duplicateCustomer) return;
    setCustomerMode('existing');
    setCustomerId(duplicateCustomer.id);
    setCustomerData(duplicateCustomer);
    setBranches(Array.isArray(duplicateCustomer.branches) ? duplicateCustomer.branches : []);
    setDuplicateCustomer(null);
    setError('');
  };

  const handleViewCustomer = (targetCustomerId) => {
    const custIdToUse = targetCustomerId || customerId;
    // Snapshot current form values so they are preserved
    const currentDraft = {
      customerMode,
      customerId: custIdToUse,
      customerData,
      source,
      type,
      priority,
      assignedTo,
      initialEnquiryDate,
      branches: displayBranches,
      newCustomer
    };
    if (onSaveDraft) {
      onSaveDraft(currentDraft);
    }
    const navCtx = {
      from: 'enquiry-create',
      returnTo: '/enquiries/create',
      returnLabel: 'Back to Enquiry',
      customerId: custIdToUse
    };
    try {
      sessionStorage.setItem('asicrm_customer_profile_origin', JSON.stringify(navCtx));
    } catch {}
    if (onNavigateCustomer) {
      onNavigateCustomer(custIdToUse, navCtx);
    }
  };

  return (
    <div className="crm-form-page-container">
      <div className="crm-card-box">
        <div className="card-header-block">
          <h2 className="card-header-title">Create New Enquiry</h2>
        </div>

        {duplicateCustomer && (
          <div className="crm-alert-box info" style={{ margin: '16px 24px 0' }}>
            <span>Similar customer found: <strong>{duplicateCustomer.name}</strong> ({duplicateCustomer.mobile}).</span>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button type="button" onClick={applyDuplicateCustomer} className="crm-btn-primary compact">Use Existing Customer</button>
              <button type="button" onClick={() => { setAllowDuplicate(true); setDuplicateCustomer(null); }} className="crm-btn-secondary compact">Continue As New</button>
            </div>
          </div>
        )}

        {error && <div className="crm-alert-box error" style={{ margin: '16px 24px 0' }}><span>{error}</span></div>}

        <form onSubmit={handleSubmit} className="crm-interactive-form">
          {/* Top Desktop Row: Customer Information (Left) | Customer Branches (Right) */}
          <div className="enquiry-top-desktop-grid">
            {/* Left Box: Customer Information */}
            <div className="enquiry-card-panel customer-info-card-panel">
              <div className="panel-box-header">
                <div className="panel-header-title-wrap">
                  <h3 className="panel-main-title">1. Customer Information</h3>
                </div>
                {/* Segmented Mode Switcher: Existing Customer vs New Customer */}
                <div className="customer-mode-toggle-group">
                  <button
                    type="button"
                    className={`mode-toggle-tab ${existing ? 'active' : ''}`}
                    onClick={() => { if (!existing) chooseMode('existing'); }}
                  >
                    Existing Customer
                  </button>
                  <button
                    type="button"
                    className={`mode-toggle-tab ${!existing ? 'active' : ''}`}
                    onClick={() => { if (existing) chooseMode('new'); }}
                  >
                    New Customer
                  </button>
                </div>
              </div>

              <div className="panel-box-body">
                {existing ? (
                  <div className="existing-customer-content-wrap">
                    <CustomerSelector
                      selectedCustomerId={customerId}
                      selectedCustomerData={customerData}
                      onSelectCustomer={(id, customer) => {
                        chooseMode('existing');
                        selectCustomer(id, customer);
                      }}
                      onViewCustomer={handleViewCustomer}
                      required={existing}
                      disabled={busy}
                      allowCreate={true}
                    />
                  </div>
                ) : (
                  <div className="new-customer-content-wrap">
                    <div className="new-customer-fields-grid">
                      <div className="form-field-group">
                        <label className="field-label">
                          Customer Name <span className="req-star">*</span>
                        </label>
                        <input
                          type="text"
                          className="crm-text-input"
                          placeholder="Enter customer name"
                          value={newCustomer.name}
                          disabled={busy}
                          onChange={(e) => updateNewCustomer('name', e.target.value)}
                        />
                      </div>

                      <div className="form-field-group">
                        <label className="field-label">
                          Mobile Number <span className="req-star">*</span>
                        </label>
                        <div className="phone-input-group new-cust-phone-input">
                          <div className="country-code-pill"><span>+91</span></div>
                          <div className="phone-divider" />
                          <input
                            type="tel"
                            className="phone-number-input"
                            placeholder="10-digit number"
                            value={newCustomer.mobile}
                            maxLength={10}
                            disabled={busy}
                            onChange={(e) => updateNewCustomer('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                          />
                          <span className="digit-counter">{newCustomer.mobile.length}/10</span>
                        </div>
                      </div>

                      <div className="form-field-group">
                        <label className="field-label">
                          Email Address <span className="req-star">*</span>
                        </label>
                        <input
                          type="email"
                          className="crm-text-input"
                          placeholder="name@company.com"
                          value={newCustomer.email}
                          disabled={busy}
                          onChange={(e) => updateNewCustomer('email', e.target.value)}
                        />
                      </div>

                      <div className="form-field-group">
                        <label className="field-label">
                          Contact Person
                        </label>
                        <input
                          type="text"
                          className="crm-text-input"
                          placeholder="Contact person name"
                          value={newCustomer.contactPerson}
                          disabled={busy}
                          onChange={(e) => updateNewCustomer('contactPerson', e.target.value)}
                        />
                      </div>

                      <div className="form-field-group">
                        <label className="field-label">
                          Customer Type
                        </label>
                        <select
                          className="crm-select-input"
                          value={newCustomer.customerType}
                          disabled={busy}
                          onChange={(e) => updateNewCustomer('customerType', e.target.value)}
                        >
                          <option value="Individual">Individual</option>
                          <option value="Business">Business</option>
                          <option value="Corporate">Corporate</option>
                          <option value="Dealer">Dealer</option>
                        </select>
                      </div>

                      <div className="form-field-group">
                        <label className="field-label">City</label>
                        <input
                          type="text"
                          className="crm-text-input"
                          placeholder="City"
                          value={newCustomer.city}
                          disabled={busy}
                          onChange={(e) => updateNewCustomer('city', e.target.value)}
                        />
                      </div>

                      <div className="form-field-group full-width">
                        <label className="field-label">Address</label>
                        <input
                          type="text"
                          className="crm-text-input"
                          placeholder="Street / Building / Area"
                          value={newCustomer.address}
                          disabled={busy}
                          onChange={(e) => updateNewCustomer('address', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {duplicateCustomer && (
                <div className="duplicate-customer-banner" style={{ marginTop: 12 }}>
                  <strong>Customer may already exist.</strong>
                  <p>{duplicateCustomer.name} · +91 {duplicateCustomer.mobile} · {duplicateCustomer.email || 'No email'}</p>
                  <div className="duplicate-actions-row">
                    <button type="button" className="crm-btn-primary" onClick={applyDuplicateCustomer}>Use Existing Customer</button>
                    <button type="button" className="crm-btn-secondary" onClick={() => { setAllowDuplicate(true); setDuplicateCustomer(null); setError('Duplicate override enabled.'); }}>Continue Creating New Customer</button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Box: Customer Branches */}
            <div className="enquiry-card-panel customer-branches-card-panel">
              <div className="panel-box-header">
                <div className="panel-header-title-wrap">
                  <h3 className="panel-main-title">Customer Branches</h3>
                </div>
                <button
                  type="button"
                  className="crm-btn-secondary compact add-branch-header-btn"
                  onClick={openAddBranch}
                  disabled={busy}
                >
                  + Add Branch
                </button>
              </div>

              <div className="panel-box-body">
                <div className="branches-table-viewport">
                  {displayBranches.length === 0 ? (
                    <div className="branches-empty-state-compact">
                      <p className="branches-empty-text">No branches added yet.</p>
                      <button
                        type="button"
                        className="inline-add-branch-btn"
                        onClick={openAddBranch}
                        disabled={busy}
                      >
                        + Add your first branch
                      </button>
                    </div>
                  ) : (
                    <table className="branches-contained-table crm-master-table">
                      <colgroup>
                        <col className="col-branch-name" style={{ width: '30%' }} />
                        <col className="col-branch-contact" style={{ width: '25%' }} />
                        <col className="col-branch-mobile" style={{ width: '20%' }} />
                        <col className="col-branch-email" style={{ width: '15%' }} />
                        <col className="col-branch-action" style={{ width: '10%' }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="col-branch-name">Branch Name</th>
                          <th className="col-branch-contact">Contact Person</th>
                          <th className="col-branch-mobile">Mobile</th>
                          <th className="col-branch-email">Mail</th>
                          <th className="col-branch-action">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayBranches.map((branch, index) => (
                          <tr key={branch.branchId || `${branch.branchName}-${index}`}>
                            <td className="col-branch-name cell-wrap" title={branch.branchName}>
                              <strong>{branch.branchName || '—'}</strong>
                            </td>
                            <td className="col-branch-contact cell-wrap" title={branch.contactPerson}>
                              {branch.contactPerson || '—'}
                            </td>
                            <td className="col-branch-mobile cell-wrap" title={branch.phone}>
                              {branch.phone ? `+91 ${branch.phone}` : '—'}
                            </td>
                            <td className="col-branch-email cell-wrap" title={branch.email}>
                              {branch.email || '—'}
                            </td>
                            <td className="col-branch-action">
                              <div className="branch-row-actions-group">
                                <button
                                  type="button"
                                  className="crm-table-icon-btn edit-btn"
                                  onClick={() => openEditBranch(index)}
                                  disabled={busy}
                                  title="Edit branch"
                                  aria-label="Edit branch"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="crm-table-icon-btn remove-btn"
                                  onClick={() => removeBranch(index)}
                                  disabled={busy}
                                  title="Remove branch"
                                  aria-label="Remove branch"
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    <line x1="10" y1="11" x2="10" y2="17" />
                                    <line x1="14" y1="11" x2="14" y2="17" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {displayBranches.length > 0 && (
                    <div className="crm-table-footer" style={{ padding: '8px 14px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: '#64748b' }}>
                      <span>{displayBranches.length} {displayBranches.length === 1 ? 'branch' : 'branches'} configured</span>
                      <span>Click action buttons to edit or remove</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Enquiry Classification */}
          <div className="form-section-block enquiry-classification-section">
            <div className="section-heading-row">
              <div>
                <h3 className="section-subtitle">2. Enquiry Classification</h3>
                <p className="section-helper-text">Set the initial source, enquiry type, priority and owner.</p>
              </div>
            </div>
            <div className="enquiry-classification-grid">
              <Select label="Enquiry Source" value={source} setValue={setSource} options={SOURCES} />
              <Select label="Enquiry Type" value={type} setValue={setType} options={ENQUIRY_TYPES} />
              <Select label="Priority Level" value={priority} setValue={setPriority} options={PRIORITIES} />
              {shouldShowAssignedEmployee(type) && (
                <Select label="Assigned Employee" value={assignedTo || availableEmployees[0] || ''} setValue={setAssignedTo} options={availableEmployees} />
              )}
              <div className="form-field-group">
                <label className="field-label">Initial Enquiry Date <span className="req-star">*</span></label>
                <input type="date" className="crm-text-input" value={initialEnquiryDate} onChange={(event) => setInitialEnquiryDate(event.target.value)} required />
              </div>
            </div>
          </div>

          {/* Section 4: Remaining Enquiry Information / Actions */}
          <div className="form-actions-footer with-split">
            <button type="button" onClick={onCancel} className="crm-btn-secondary" disabled={busy}>Cancel</button>
            <button type="submit" className="crm-btn-primary large-action" disabled={busy || (existing && !customerId)}>
              {submitting ? 'Creating Enquiry...' : 'Create Enquiry →'}
            </button>
          </div>
        </form>
      </div>

      {branchModalOpen && (
        <div className="crm-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeBranchModal(); }}>
          <div className="crm-modal-card branch-modal-card" role="dialog" aria-modal="true" aria-labelledby="branch-modal-title">
            <div className="crm-modal-header">
              <div><span className="panel-kicker">BRANCH</span><h3 id="branch-modal-title">{editingBranchIndex === null ? 'Add New Branch' : 'Edit Branch'}</h3><p>Add the branch contact details, then save it into the table.</p></div>
              <button type="button" className="crm-modal-close" onClick={closeBranchModal} disabled={savingBranch}>×</button>
            </div>
            <form onSubmit={saveBranch} className="branch-modal-form">
              <div className="form-grid-2">
                <MultilineField label="Branch Name" required value={branchDraft.branchName} onChange={(value) => updateBranchDraft('branchName', value)} placeholder="e.g. Mumbai Branch" disabled={savingBranch} />
                <MultilineField label="Contact Person" required value={branchDraft.contactPerson} onChange={(value) => updateBranchDraft('contactPerson', value)} placeholder="e.g. Rajesh Kumar" disabled={savingBranch} />
                <PhoneField label="Phone Number" value={branchDraft.phone} onChange={(value) => updateBranchDraft('phone', value)} placeholder="10 digit number" disabled={savingBranch} />
                <MultilineField label="Email Address" value={branchDraft.email} onChange={(value) => updateBranchDraft('email', value)} placeholder="rajesh@example.com" disabled={savingBranch} />
              </div>
              <div className="crm-modal-actions">
                <button type="button" className="crm-btn-secondary" onClick={closeBranchModal} disabled={savingBranch}>Cancel</button>
                <button type="submit" className="crm-btn-primary" disabled={savingBranch}>{savingBranch ? 'Saving Branch...' : editingBranchIndex === null ? 'Add Branch' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {moreDetailsOpen && (
        <div className="crm-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMoreDetailsOpen(false); }}>
          <div className="crm-modal-card" style={{ maxWidth: '520px' }} role="dialog" aria-modal="true" aria-labelledby="location-details-modal-title">
            <div className="crm-modal-header">
              <div>
                <span className="panel-kicker">CUSTOMER LOCATION</span>
                <h3 id="location-details-modal-title">Additional Details</h3>
                <p>Add city, state, and address for this customer.</p>
              </div>
              <button type="button" className="crm-modal-close" onClick={() => setMoreDetailsOpen(false)} disabled={busy}>×</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div className="form-grid-2">
                <Field label="City" value={newCustomer.city} onChange={(value) => updateNewCustomer('city', value)} placeholder="e.g. Mumbai" disabled={busy} />
                <Field label="State" value={newCustomer.state} onChange={(value) => updateNewCustomer('state', value)} placeholder="e.g. Maharashtra" disabled={busy} />
                <div className="form-field-group full-width">
                  <Field label="Address" value={newCustomer.address} onChange={(value) => updateNewCustomer('address', value)} placeholder="Street / Area / Landmark" disabled={busy} />
                </div>
              </div>
              <div className="crm-modal-actions">
                <button type="button" className="crm-btn-primary" onClick={() => setMoreDetailsOpen(false)}>Done</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Select({ label, value, setValue, options }) {
  return <div className="form-field-group"><label className="field-label">{label} <span className="req-star">*</span></label><select className="crm-select-input" value={value} onChange={(event) => setValue(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>;
}

function Field({ label, value, onChange, placeholder, required = false, type = 'text', disabled = false }) {
  return <div className="form-field-group"><label className="field-label">{label}{required ? <span className="req-star"> *</span> : null}</label><input type={type} className="crm-text-input" value={value || ''} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} required={required} /></div>;
}

function MultilineField({ label, value, onChange, placeholder, required = false, disabled = false }) {
  const textareaRef = React.useRef(null);

  React.useLayoutEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      const scrollH = el.scrollHeight;
      const neededH = scrollH + 4;
      if (neededH > 76) {
        el.style.height = '76px';
        el.style.overflowY = 'auto';
      } else if (neededH > 36) {
        el.style.height = neededH + 'px';
        el.style.overflowY = 'hidden';
      } else {
        el.style.height = '36px';
        el.style.overflowY = 'hidden';
      }
    }
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = e.target.closest('form');
      if (form) {
        if (form.requestSubmit) form.requestSubmit();
        else form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }
  };

  return (
    <div className="form-field-group">
      <label className="field-label">
        {label}{required ? <span className="req-star"> *</span> : null}
      </label>
      <textarea
        ref={textareaRef}
        rows={1}
        className="crm-text-input crm-multiline-input"
        value={value || ''}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.replace(/[\r\n]+/g, ' '))}
        onKeyDown={handleKeyDown}
        required={required}
      />
    </div>
  );
}

function PhoneField({ label, value, onChange, disabled = false, required = false, placeholder = '10 digit number' }) {
  return <div className="form-field-group"><label className="field-label">{label}{required ? <span className="req-star"> *</span> : null}</label><div className="phone-input-group compact-phone-input"><div className="country-code-pill"><span>+91</span></div><div className="phone-divider" /><input type="tel" className="phone-number-input" placeholder={placeholder} value={value || ''} maxLength={10} disabled={disabled} onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 10))} required={required} /><span className="digit-counter">{String(value || '').length}/10</span></div></div>;
}

function ReadOnlyField({ label, value }) {
  return <div className="readonly-customer-field"><span>{label}</span><strong>{value || '—'}</strong></div>;
}