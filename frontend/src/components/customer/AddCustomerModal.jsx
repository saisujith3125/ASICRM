import React, { useState, useEffect } from 'react';
import { apiFetch, apiUrl } from '../../api';

export default function AddCustomerModal({
  isOpen,
  onClose,
  onCustomerCreated,
  onSelectExistingCustomer,
  existingCustomers = [],
  defaultName = ''
}) {
  // Form state
  const [name, setName] = useState(defaultName || '');
  const [company, setCompany] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [customerType, setCustomerType] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [shippingAddress, setShippingAddress] = useState('');
  const [notes, setNotes] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [duplicateCustomer, setDuplicateCustomer] = useState(null);

  const isIndividual = customerType === 'Individual';
  const isEnterprise = customerType === 'Business' || customerType === 'Dealer' || customerType === 'Corporate';
  const isTypeSelected = Boolean(customerType);

  useEffect(() => {
    if (isOpen) {
      if (defaultName) {
        setName(defaultName);
      }
    }
  }, [isOpen, defaultName]);

  const resetForm = () => {
    setName('');
    setCompany('');
    setContactPerson('');
    setMobile('');
    setEmail('');
    setCustomerType('');
    setGstin('');
    setAddress('');
    setCity('');
    setState('');
    setPincode('');
    setSameAsBilling(true);
    setShippingAddress('');
    setNotes('');
    setErrors({});
    setDuplicateCustomer(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  // Handle Mobile: Numbers only, exactly 10 digits
  const handleMobileChange = (e) => {
    const raw = e.target.value;
    const cleaned = raw.replace(/\D/g, '').slice(0, 10);
    setMobile(cleaned);
    setDuplicateCustomer(null);
    if (errors.mobile) {
      setErrors((prev) => ({ ...prev, mobile: null }));
    }
  };

  const isGstinAllowedType = (type) => {
    const t = String(type || '').trim().toLowerCase();
    return t === 'business' || t === 'corporate';
  };
  const shouldShowGstin = isGstinAllowedType(customerType);

  const handleSelectCustomerType = (nextType) => {
    setCustomerType(nextType);
    if (errors.customerType) {
      setErrors((prev) => ({ ...prev, customerType: null }));
    }
    if (!isGstinAllowedType(nextType)) {
      setGstin('');
      if (errors.gstin) {
        setErrors((prev) => ({ ...prev, gstin: null }));
      }
    }
  };

  const handleCustomerTypeChange = (e) => {
    handleSelectCustomerType(e.target.value);
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setDuplicateCustomer(null);
    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: null }));
    }
  };

  const validateForm = () => {
    const errs = {};
    if (!customerType) {
      errs.customerType = 'Please select a Customer Type first.';
      setErrors(errs);
      return false;
    }

    const cleanName = name.trim();
    const cleanCompany = company.trim();
    const cleanContact = contactPerson.trim();
    const cleanMobile = mobile.trim();
    const cleanEmail = email.trim();

    if (isIndividual) {
      if (!cleanName) {
        errs.name = 'Customer name is required.';
      }
    } else if (isEnterprise) {
      if (!cleanCompany) {
        errs.company = 'Company / Enterprise name is required.';
      }
      if (!cleanName && !cleanContact) {
        errs.name = 'Customer name (contact person) is required.';
      }
    }

    if (!cleanMobile) {
      errs.mobile = 'Mobile number is required.';
    } else if (cleanMobile.length !== 10) {
      errs.mobile = 'Please enter a valid 10-digit mobile number.';
    }

    if (!cleanEmail) {
      errs.email = 'Email address is required.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        errs.email = 'Please enter a valid email address.';
      }
    }

    if (shouldShowGstin && gstin.trim() && gstin.trim().length !== 15) {
      errs.gstin = 'GSTIN must be exactly 15 characters where provided.';
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return false;
    }

    // Client-side duplicate check if existingCustomers passed
    if (Array.isArray(existingCustomers) && existingCustomers.length > 0) {
      const normName = cleanName.replace(/\s+/g, ' ').toLowerCase();
      const normCompany = cleanCompany.replace(/\s+/g, ' ').toLowerCase();
      const normEmail = cleanEmail.toLowerCase();
      const dup = existingCustomers.find((c) => {
        const cMob = String(c.mobile || '').replace(/\D/g, '').slice(-10);
        const cMail = String(c.email || '').trim().toLowerCase();
        const cName = String(c.name || '').trim().replace(/\s+/g, ' ').toLowerCase();
        const cComp = String(c.company || '').trim().replace(/\s+/g, ' ').toLowerCase();
        return (cMob && cMob === cleanMobile) ||
          (cMail && cMail === normEmail) ||
          (isIndividual && cName && cName === normName) ||
          (isEnterprise && cComp && normCompany && cComp === normCompany);
      });
      if (dup) {
        setDuplicateCustomer(dup);
        return false;
      }
    }

    setErrors({});
    return true;
  };

  const handleSubmit = async (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    if (!validateForm()) return;

    setSubmitting(true);
    setDuplicateCustomer(null);

    const cleanName = name.trim();
    const cleanCompany = company.trim();
    const cleanContact = contactPerson.trim();
    const cleanMobile = mobile.trim();
    const cleanEmail = email.trim();

    // In ASI CRM, when a Business, Dealer, or Corporate is chosen, the Customer Page takes the Company Name as Customer Name!
    const effectivePrimaryName = isIndividual ? cleanName : cleanCompany;
    const effectiveCompany = isIndividual ? '' : cleanCompany;
    const effectiveContactPerson = isIndividual ? cleanName : (cleanContact || cleanName);
    const effectiveShipping = sameAsBilling ? address.trim() : (shippingAddress.trim() || address.trim());

    try {
      const res = await apiFetch(apiUrl('/api/customers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: effectivePrimaryName,
          company: effectiveCompany,
          contactPerson: effectiveContactPerson,
          mobile: cleanMobile,
          email: cleanEmail,
          customerType,
          address: address.trim(),
          shippingAddress: effectiveShipping,
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
          gstin: shouldShowGstin ? gstin.trim().toUpperCase() : '',
          notes: notes.trim()
        })
      });

      const data = await res.json();

      if (res.status === 409 || data.duplicate) {
        // Customer already exists
        setDuplicateCustomer(data.data || data.customer || { name, mobile, email, contactPerson, company });
      } else if (res.ok && data.success && data.data) {
        // Broadcast to all active components
        window.dispatchEvent(
          new CustomEvent('crm-customer-created', {
            detail: { customer: data.data }
          })
        );

        if (onCustomerCreated) {
          onCustomerCreated(data.data);
        }
        resetForm();
      } else {
        setErrors({ general: data.message || 'Failed to create customer.' });
      }
    } catch (err) {
      console.error('Create customer error:', err);
      setErrors({ general: 'Server connection error. Please make sure the backend is active.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUseExisting = () => {
    if (duplicateCustomer) {
      if (onSelectExistingCustomer) {
        onSelectExistingCustomer(duplicateCustomer);
      } else if (onCustomerCreated) {
        onCustomerCreated(duplicateCustomer);
      }
      resetForm();
      if (onClose) onClose();
    }
  };

  return (
    <div className="crm-modal-backdrop" onClick={handleClose}>
      <div className="crm-modal-dialog add-customer-modal-dialog" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header-row">
          <div>
            <h3 className="modal-title">Add New Customer</h3>
            <p className="modal-subtitle">Create customer profile to immediately use in ASI CRM.</p>
          </div>
          <button type="button" onClick={handleClose} className="close-modal-btn" aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* General Error Banner */}
        {errors.general && (
          <div className="crm-alert-box error" style={{ margin: '14px 24px 0' }}>
            <span>{errors.general}</span>
          </div>
        )}

        {/* Duplicate Customer Alert Banner */}
        {duplicateCustomer && (
          <div className="duplicate-customer-banner" style={{ margin: '14px 24px 0' }}>
            <div className="duplicate-header-row">
              <div className="duplicate-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2.2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="duplicate-text">
                <strong>Customer already exists</strong>
                <p>A customer with similar details was found in Customer Master.</p>
              </div>
            </div>

            <div className="duplicate-preview-card">
              <div className="dup-row">
                <span className="dup-lbl">Customer:</span>
                <strong className="dup-val">{duplicateCustomer.name}</strong>
              </div>
              {(duplicateCustomer.company || duplicateCustomer.contactPerson) && (
                <div className="dup-row">
                  <span className="dup-lbl">Company / Contact:</span>
                  <span className="dup-val">{duplicateCustomer.company || duplicateCustomer.contactPerson}</span>
                </div>
              )}
              <div className="dup-row">
                <span className="dup-lbl">Mobile:</span>
                <span className="dup-val">+91 {duplicateCustomer.mobile}</span>
              </div>
              {duplicateCustomer.email && (
                <div className="dup-row">
                  <span className="dup-lbl">Email:</span>
                  <span className="dup-val">{duplicateCustomer.email}</span>
                </div>
              )}
            </div>

            <div className="duplicate-actions-row">
              <button
                type="button"
                onClick={handleUseExisting}
                className="crm-btn-primary"
                style={{ fontSize: '13px', height: '36px', padding: '0 16px' }}
              >
                Use Existing Customer
              </button>
              <button
                type="button"
                onClick={() => setDuplicateCustomer(null)}
                className="crm-btn-secondary"
                style={{ fontSize: '13px', height: '36px', padding: '0 14px' }}
              >
                Edit Customer Details
              </button>
            </div>
          </div>
        )}

        {/* Customer Type Selection Section (Alone Active Initially) */}
        <div className="customer-type-selection-container" style={{ margin: '14px 24px 0', padding: '12px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label className="field-label prominent" style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
              CUSTOMER TYPE <span className="req-star">*</span>
            </label>
            {!customerType ? (
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#ea580c', background: '#fff7ed', border: '1px solid #fed7aa', padding: '2px 8px', borderRadius: '4px' }}>
                ⚡ Click Type to Unlock All Fields
              </span>
            ) : (
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '4px' }}>
                ✓ Selected: {customerType}
              </span>
            )}
          </div>

          <div className="customer-type-pills-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {[
              { type: 'Individual', icon: '👤', label: 'Individual', desc: 'Direct Client' },
              { type: 'Business', icon: '🏢', label: 'Business', desc: 'Commercial Entity' },
              { type: 'Dealer', icon: '🤝', label: 'Dealer', desc: 'Partner / Reseller' },
              { type: 'Corporate', icon: '🏛️', label: 'Corporate', desc: 'Enterprise Client' }
            ].map((item) => {
              const isSelected = customerType === item.type;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleSelectCustomerType(item.type)}
                  className={`customer-type-pill-btn ${isSelected ? 'is-selected' : ''}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '10px 4px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-in-out',
                    boxShadow: isSelected ? '0 2px 5px rgba(37,99,235,0.18)' : '0 1px 2px rgba(0,0,0,0.04)',
                    position: 'relative'
                  }}
                >
                  <span style={{ fontSize: '18px', marginBottom: '2px' }}>{item.icon}</span>
                  <span style={{ fontSize: '12px', fontWeight: isSelected ? 800 : 600, color: isSelected ? '#1d4ed8' : '#334155' }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: '9.5px', color: isSelected ? '#2563eb' : '#64748b', marginTop: '1px' }}>
                    {item.desc}
                  </span>
                  {isSelected && (
                    <span style={{ position: 'absolute', top: '3px', right: '5px', fontSize: '10px', color: '#2563eb', fontWeight: 800 }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
          {errors.customerType && (
            <span className="inline-field-error" style={{ display: 'block', marginTop: '6px' }}>{errors.customerType}</span>
          )}
        </div>

        {/* Informational Guidance Banner if locked */}
        {!isTypeSelected && (
          <div className="crm-alert-box info" style={{ margin: '10px 24px 0', background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '6px' }}>
            <span style={{ fontSize: '16px' }}>🔒</span>
            <span style={{ fontSize: '12px', lineHeight: 1.4 }}>
              All fields below are currently locked. <strong>Click a Customer Type above</strong> (Individual, Business, Dealer, or Corporate) to unlock and fill customer information.
            </span>
          </div>
        )}

        <div
          className={`modal-form-content ${!isTypeSelected ? 'is-blocked-form' : ''}`}
          style={!isTypeSelected ? { opacity: 0.45, pointerEvents: 'none', filter: 'grayscale(20%)', userSelect: 'none' } : {}}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
              e.preventDefault();
              e.stopPropagation();
              handleSubmit(e);
            }
          }}
        >
          {/* Section 1: Customer Information */}
          <div className="modal-section-group">
            <h4 className="modal-section-heading">CUSTOMER &amp; COMPANY INFORMATION</h4>

            {isIndividual ? (
              /* Fields for Individual Customer */
              <div className="form-grid-2">
                {/* Customer Name */}
                <div className="form-field-group">
                  <label className="field-label">
                    Customer Name <span className="req-star">*</span>
                  </label>
                  <input
                    type="text"
                    className={`crm-text-input ${errors.name ? 'has-error' : ''}`}
                    placeholder="e.g. Rajesh Kumar"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
                    }}
                    required
                    autoFocus
                  />
                  {errors.name && <span className="inline-field-error">{errors.name}</span>}
                </div>

                {/* Customer Type Indicator */}
                <div className="form-field-group">
                  <label className="field-label">Customer Type</label>
                  <input
                    type="text"
                    className="crm-text-input"
                    value="Individual (Direct Person)"
                    disabled
                    style={{ backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 600 }}
                  />
                </div>

                {/* Mobile Number with Country Code */}
                <div className="form-field-group">
                  <label className="field-label">
                    Mobile Number <span className="req-star">*</span>
                  </label>
                  <div className={`phone-input-group ${errors.mobile ? 'has-error' : ''}`} style={{ height: '42px' }}>
                    <div className="country-code-pill">
                      <span style={{ fontSize: '16px' }}>🇮🇳</span>
                      <span>+91</span>
                    </div>
                    <div className="phone-divider" style={{ height: '20px' }} />
                    <input
                      type="tel"
                      className="phone-number-input"
                      placeholder="9811223344"
                      value={mobile}
                      onChange={handleMobileChange}
                      maxLength={10}
                      required
                    />
                    <span className="digit-counter">{mobile.length}/10</span>
                  </div>
                  {errors.mobile && <span className="inline-field-error">{errors.mobile}</span>}
                </div>

                {/* Email Address */}
                <div className="form-field-group">
                  <label className="field-label">Email Address <span className="req-star">*</span></label>
                  <input
                    type="email"
                    className={`crm-text-input ${errors.email ? 'has-error' : ''}`}
                    placeholder="e.g. contact@abctech.in"
                    value={email}
                    onChange={handleEmailChange}
                    required
                  />
                  {errors.email && <span className="inline-field-error">{errors.email}</span>}
                </div>
              </div>
            ) : isEnterprise ? (
              /* Fields for Business / Dealer / Corporate Entity */
              <div className="form-grid-2">
                {/* Company / Enterprise Name */}
                <div className="form-field-group">
                  <label className="field-label">
                    Company / Enterprise Name <span className="req-star">*</span>
                  </label>
                  <input
                    type="text"
                    className={`crm-text-input ${errors.company ? 'has-error' : ''}`}
                    placeholder="e.g. Tata Motors Ltd, ABC Technologies"
                    value={company}
                    onChange={(e) => {
                      setCompany(e.target.value);
                      if (errors.company) setErrors((prev) => ({ ...prev, company: null }));
                    }}
                    required
                    autoFocus
                  />
                  {errors.company && <span className="inline-field-error">{errors.company}</span>}
                  <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                    Primary entity name shown on Customer Directory &amp; Proposals.
                  </span>
                </div>

                {/* Customer Name / Contact Person */}
                <div className="form-field-group">
                  <label className="field-label">
                    Customer Name (Contact Person) <span className="req-star">*</span>
                  </label>
                  <input
                    type="text"
                    className={`crm-text-input ${errors.name ? 'has-error' : ''}`}
                    placeholder="e.g. Rajesh Kumar"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
                    }}
                    required
                  />
                  {errors.name && <span className="inline-field-error">{errors.name}</span>}
                </div>

                {/* Mobile Number with Country Code */}
                <div className="form-field-group">
                  <label className="field-label">
                    Mobile Number <span className="req-star">*</span>
                  </label>
                  <div className={`phone-input-group ${errors.mobile ? 'has-error' : ''}`} style={{ height: '42px' }}>
                    <div className="country-code-pill">
                      <span style={{ fontSize: '16px' }}>🇮🇳</span>
                      <span>+91</span>
                    </div>
                    <div className="phone-divider" style={{ height: '20px' }} />
                    <input
                      type="tel"
                      className="phone-number-input"
                      placeholder="9811223344"
                      value={mobile}
                      onChange={handleMobileChange}
                      maxLength={10}
                      required
                    />
                    <span className="digit-counter">{mobile.length}/10</span>
                  </div>
                  {errors.mobile && <span className="inline-field-error">{errors.mobile}</span>}
                </div>

                {/* Email Address */}
                <div className="form-field-group">
                  <label className="field-label">Email Address <span className="req-star">*</span></label>
                  <input
                    type="email"
                    className={`crm-text-input ${errors.email ? 'has-error' : ''}`}
                    placeholder="e.g. contact@abctech.in"
                    value={email}
                    onChange={handleEmailChange}
                    required
                  />
                  {errors.email && <span className="inline-field-error">{errors.email}</span>}
                </div>
              </div>
            ) : (
              /* Blocked State Preview Placeholder */
              <div className="form-grid-2">
                <div className="form-field-group">
                  <label className="field-label">Customer Name</label>
                  <input type="text" className="crm-text-input" placeholder="Select Customer Type above to unlock..." disabled />
                </div>
                <div className="form-field-group">
                  <label className="field-label">Company / Enterprise</label>
                  <input type="text" className="crm-text-input" placeholder="Select Customer Type above to unlock..." disabled />
                </div>
                <div className="form-field-group">
                  <label className="field-label">Mobile Number</label>
                  <input type="text" className="crm-text-input" placeholder="Select Customer Type above to unlock..." disabled />
                </div>
                <div className="form-field-group">
                  <label className="field-label">Email Address</label>
                  <input type="text" className="crm-text-input" placeholder="Select Customer Type above to unlock..." disabled />
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Address & Tax Details */}
          <div className="modal-section-group" style={{ marginTop: '12px' }}>
            <h4 className="modal-section-heading">BILLING &amp; TAX DETAILS</h4>

            <div className="form-grid-2">
              {shouldShowGstin ? (
                <>
                  {/* GSTIN / UIN — Visible for Business & Corporate */}
                  <div className="form-field-group">
                    <label className="field-label">GSTIN / UIN</label>
                    <input
                      type="text"
                      className={`crm-text-input ${errors.gstin ? 'has-error' : ''}`}
                      placeholder="e.g. 33AAAAA0000A1Z5"
                      value={gstin}
                      onChange={(e) => {
                        setGstin(e.target.value.toUpperCase());
                        if (errors.gstin) setErrors((prev) => ({ ...prev, gstin: null }));
                      }}
                      maxLength={15}
                      style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
                    />
                    {errors.gstin && <span className="inline-field-error">{errors.gstin}</span>}
                  </div>

                  {/* Pincode */}
                  <div className="form-field-group">
                    <label className="field-label">Pincode</label>
                    <input
                      type="text"
                      className="crm-text-input"
                      placeholder="e.g. 600002"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                    />
                  </div>

                  {/* City */}
                  <div className="form-field-group">
                    <label className="field-label">City</label>
                    <input
                      type="text"
                      className="crm-text-input"
                      placeholder="e.g. Chennai"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>

                  {/* State */}
                  <div className="form-field-group">
                    <label className="field-label">State</label>
                    <input
                      type="text"
                      className="crm-text-input"
                      placeholder="e.g. Tamil Nadu"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* City */}
                  <div className="form-field-group">
                    <label className="field-label">City</label>
                    <input
                      type="text"
                      className="crm-text-input"
                      placeholder="e.g. Chennai"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>

                  {/* State */}
                  <div className="form-field-group">
                    <label className="field-label">State</label>
                    <input
                      type="text"
                      className="crm-text-input"
                      placeholder="e.g. Tamil Nadu"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                    />
                  </div>

                  {/* Pincode */}
                  <div className="form-field-group">
                    <label className="field-label">Pincode</label>
                    <input
                      type="text"
                      className="crm-text-input"
                      placeholder="e.g. 600002"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                    />
                  </div>
                </>
              )}

              {/* Billing Address */}
              <div className="form-field-group full-width">
                <label className="field-label">Billing Address</label>
                <input
                  type="text"
                  className="crm-text-input"
                  placeholder="e.g. Plot No 12, Mount Road, Industrial Estate"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              {/* Same as Billing Checkbox */}
              <div className="form-field-group full-width" style={{ marginTop: '2px', marginBottom: '4px' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={sameAsBilling}
                    onChange={(e) => setSameAsBilling(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
                  />
                  <span>Shipping Address is the same as Billing Address</span>
                </label>
              </div>

              {/* Shipping Address (if different) */}
              {!sameAsBilling && (
                <div className="form-field-group full-width">
                  <label className="field-label">Shipping / Delivery Address</label>
                  <input
                    type="text"
                    className="crm-text-input"
                    placeholder="Enter distinct delivery facility or site address..."
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                  />
                </div>
              )}

              {/* Notes */}
              <div className="form-field-group full-width">
                <label className="field-label">Notes</label>
                <textarea
                  className="crm-textarea-input"
                  rows={2}
                  placeholder="Additional notes about customer preferences or invoicing instructions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Actions Footer */}
          <div className="modal-actions-footer" style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={handleClose}
              className="crm-btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="crm-btn-primary"
              disabled={submitting || !customerType || (isIndividual ? !name.trim() : (!company.trim() || !name.trim())) || mobile.length !== 10 || !email.trim()}
            >
              {submitting ? 'Saving Customer...' : 'Save Customer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
