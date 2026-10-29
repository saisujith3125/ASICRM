import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, Building2, Check, Loader2 } from 'lucide-react';
import { apiFetch, apiUrl } from '../../api';

/**
 * SupplierModal
 *
 * Enterprise modal to create a new supplier record on the fly
 * and automatically select it for the active Purchase Order.
 */
export default function SupplierModal({
  isOpen,
  onClose,
  onSupplierCreated,
  existingSuppliers = [],
  initialCompanyName = ''
}) {
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCompanyName(initialCompanyName || '');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setGstin('');
      setAddress('');
      setCity('');
      setPincode('');
      setErrorMsg('');
      setSubmitting(false);
    }
  }, [isOpen, initialCompanyName]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedName = companyName.trim();
    const trimmedContact = contactPerson.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    const cleanGstin = gstin.trim().toUpperCase();

    // 1. Validation
    if (!trimmedName) {
      setErrorMsg('Company Name is required.');
      return;
    }
    if (!trimmedContact) {
      setErrorMsg('Contact Person is required.');
      return;
    }
    if (!trimmedPhone) {
      setErrorMsg('Phone Number is required.');
      return;
    }
    const phoneDigits = trimmedPhone.replace(/[^0-9]/g, '');
    if (phoneDigits.length !== 10) {
      setErrorMsg('Phone Number must be exactly 10 digits.');
      return;
    }
    if (!trimmedEmail) {
      setErrorMsg('Email address is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (cleanGstin && cleanGstin.length !== 15) {
      setErrorMsg('GSTIN must be 15 characters long if provided.');
      return;
    }

    // 2. Duplicate Check against existingSuppliers
    const norm = trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const dup = existingSuppliers.find((s) => {
      const sNorm = String(s.companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const sGstin = String(s.gstin || '').trim().toUpperCase();
      if (sNorm === norm) return true;
      if (cleanGstin && sGstin && cleanGstin === sGstin) return true;
      return false;
    });

    if (dup) {
      setErrorMsg(`Supplier already exists: "${dup.companyName}" (ID: ${dup.id || dup.supplierId}). Please select the existing supplier instead of creating a duplicate.`);
      return;
    }

    // 3. API Submission
    setSubmitting(true);
    try {
      const res = await apiFetch(apiUrl('/api/suppliers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: trimmedName,
          contactPerson: trimmedContact,
          phone: trimmedPhone,
          email: trimmedEmail,
          gstin: cleanGstin,
          address: address.trim(),
          city: city.trim(),
          pincode: pincode.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.data) {
        onSupplierCreated(data.data);
        onClose();
      } else {
        setErrorMsg(data.message || 'Failed to create supplier.');
      }
    } catch (err) {
      console.error('Error creating supplier:', err);
      setErrorMsg(err.message || 'Network error connecting to server.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="crm-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(3px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div
        className="crm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-supplier-title"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '580px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            backgroundColor: '#ffffff'
          }}
        >
          <div>
            <h2
              id="modal-supplier-title"
              style={{
                margin: '0 0 4px 0',
                fontSize: '18px',
                fontWeight: 700,
                color: '#0f172a',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Building2 size={20} className="text-blue-600" style={{ color: '#2563eb' }} />
              Add New Supplier
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Create a supplier record and use it for this Purchase Order
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '-2px'
            }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {errorMsg && (
              <div
                className="crm-alert crm-alert-danger"
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  color: '#b91c1c',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Section Header */}
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                color: '#475569',
                textTransform: 'uppercase',
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '6px'
              }}
            >
              Supplier Information
            </div>

            {/* Company Name */}
            <div className="po-form-group">
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                Company Name *
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. CP Plus Global Security Solutions"
                required
                autoFocus
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '8px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#0f172a',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Contact Person & Phone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="po-form-group">
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                  Contact Person *
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="e.g. Kavita Iyer"
                  required
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#0f172a',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div className="po-form-group">
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10 digit mobile number"
                  maxLength={10}
                  required
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#0f172a',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Email & GSTIN */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="po-form-group">
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. procurement@cpplusworld.com"
                  required
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#0f172a',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div className="po-form-group">
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                  GSTIN
                </label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="e.g. 07AAACC5678B1Z2"
                  maxLength={15}
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#0f172a',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Address (First) */}
            <div className="po-form-group">
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Plot No. 12, Industrial Estate, Guindy"
                style={{
                  width: '100%',
                  height: '38px',
                  padding: '8px 12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#0f172a',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* City (Next) & Pincode (Next) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="po-form-group">
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Chennai"
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#0f172a',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div className="po-form-group">
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px', display: 'block' }}>
                  Pincode
                </label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="e.g. 600032"
                  maxLength={6}
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '8px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#0f172a',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}
          >
            <button
              type="button"
              className="crm-btn-secondary"
              onClick={onClose}
              disabled={submitting}
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="crm-btn-primary"
              disabled={submitting}
              style={{
                padding: '8px 20px',
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Create &amp; Select
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
