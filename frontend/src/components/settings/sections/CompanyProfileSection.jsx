import React, { useRef } from 'react';
import { DEFAULT_ASI_LOGO } from '../../documents/companyConfig';

const GST_REG_TYPES = [
  'Registered',
  'Composition',
  'Unregistered',
  'Overseas',
  'Special Economic Zone (SEZ)'
];

const COUNTRIES = [
  'India',
  'United States',
  'United Arab Emirates',
  'Singapore',
  'United Kingdom',
  'Germany',
  'Australia'
];

const INDIAN_STATES = [
  'Tamil Nadu',
  'Karnataka',
  'Maharashtra',
  'Delhi',
  'Telangana',
  'Andhra Pradesh',
  'Kerala',
  'Gujarat',
  'Uttar Pradesh',
  'West Bengal',
  'Rajasthan',
  'Madhya Pradesh',
  'Haryana',
  'Punjab'
];

const CITIES = [
  'Chennai',
  'Coimbatore',
  'Madurai',
  'Bengaluru',
  'Hyderabad',
  'Mumbai',
  'Pune',
  'Delhi NCR',
  'Kolkata',
  'Ahmedabad'
];

const THEMES = [
  'Green',
  'ASI Blue (Default)',
  'Modern Slate',
  'Deep Navy',
  'Teal Pro'
];

const LANGUAGES = [
  'English(US)',
  'English(UK)',
  'Tamil',
  'Hindi'
];

const CURRENCIES = [
  'Rs',
  'INR (₹)',
  'USD ($)',
  'EUR (€)',
  'GBP (£)',
  'AED (د.إ)'
];

export default function CompanyProfileSection({
  data,
  onChange,
  onSave,
  isSaving,
  onUploadLogo,
  onUploadSign,
  onUploadSeal
}) {
  const logoInputRef = useRef(null);
  const footerLogoInputRef = useRef(null);
  const signInputRef = useRef(null);

  const d = data || {};

  const handleChange = (field, value) => {
    const next = { ...d, [field]: value };
    if (field === 'companyName') {
      next.name = value;
    }
    onChange(next);
  };

  return (
    <div className="settings-section-container">
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <h2>Company Setting</h2>
          <p>Configure primary enterprise details, official addresses, tax registration, and baseline document terms.</p>
        </div>
        <div className="settings-section-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="settings-card">
        {/* Two-column layout precisely matching the reference screenshot */}
        <div className="settings-two-col">
          {/* LEFT COLUMN */}
          <div className="settings-col">
            <div className="settings-field-group">
              <label className="settings-field-label">
                Name <span className="settings-required">*</span>
              </label>
              <input
                type="text"
                className="settings-input"
                value={d.companyName || d.name || ''}
                onChange={(e) => handleChange('companyName', e.target.value)}
                placeholder="Active System Integration"
              />
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">
                Site Short Name <span className="settings-required">*</span>
              </label>
              <input
                type="text"
                className="settings-input"
                value={d.siteShortName || ''}
                onChange={(e) => handleChange('siteShortName', e.target.value)}
                placeholder="ASI"
              />
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">
                ISO / Quality Certification
              </label>
              <input
                type="text"
                className="settings-input"
                value={d.iso || ''}
                onChange={(e) => handleChange('iso', e.target.value)}
                placeholder="ISO 9001:2015 Certified"
              />
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">
                GST Registration Type <span className="settings-required">*</span>
              </label>
              <select
                className="settings-select"
                value={d.gstRegistrationType || 'Registered'}
                onChange={(e) => handleChange('gstRegistrationType', e.target.value)}
              >
                {GST_REG_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">
                GSTIN
              </label>
              <input
                type="text"
                className="settings-input"
                value={d.gstin || ''}
                onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
                placeholder="33AZPPS7068A1Z4"
              />
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">
                Country <span className="settings-required">*</span>
              </label>
              <select
                className="settings-select"
                value={d.country || 'India'}
                onChange={(e) => handleChange('country', e.target.value)}
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">
                State <span className="settings-required">*</span>
              </label>
              <select
                className="settings-select"
                value={d.state || 'Tamil Nadu'}
                onChange={(e) => handleChange('state', e.target.value)}
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">
                City <span className="settings-required">*</span>
              </label>
              <select
                className="settings-select"
                value={d.city || 'Chennai'}
                onChange={(e) => handleChange('city', e.target.value)}
              >
                {CITIES.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">
                Street <span className="settings-required">*</span>
              </label>
              <input
                type="text"
                className="settings-input"
                value={d.street || 'Plot No. 10A, Perumal Kovil Street'}
                onChange={(e) => handleChange('street', e.target.value)}
                placeholder="Plot No. 10A, Perumal Kovil Street"
              />
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">
                Street2 <span className="settings-required">*</span>
              </label>
              <input
                type="text"
                className="settings-input"
                value={d.street2 || 'Sivabootham, Vanagaram'}
                onChange={(e) => handleChange('street2', e.target.value)}
                placeholder="Sivabootham, Vanagaram"
              />
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">
                Zip Code
              </label>
              <input
                type="text"
                className="settings-input"
                value={d.zipCode || '600095'}
                onChange={(e) => handleChange('zipCode', e.target.value)}
                placeholder="600095"
              />
            </div>

            {/* Logo Row */}
            <div className="settings-field-group" style={{ marginTop: '8px' }}>
              <label className="settings-field-label">Logo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="file"
                  ref={logoInputRef}
                  style={{ display: 'none' }}
                  accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                  onChange={onUploadLogo}
                />
                <button
                  type="button"
                  className="settings-btn settings-btn-secondary"
                  onClick={() => logoInputRef.current?.click()}
                >
                  Choose File
                </button>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  {d.logoUrl ? 'File loaded' : 'No file chosen'}
                </span>
              </div>
              <div style={{ marginTop: '8px', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'inline-block' }}>
                <img
                  src={d.logoUrl || DEFAULT_ASI_LOGO}
                  alt="Company Logo"
                  style={{ maxHeight: '48px', maxWidth: '140px', objectFit: 'contain' }}
                />
              </div>

              {/* Quotation Logo Size Adjustment Controls */}
              <div style={{ marginTop: '10px' }}>
                <label className="settings-field-label" style={{ fontSize: '12px', marginBottom: '4px' }}>
                  Quotation Logo Size
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="settings-btn settings-btn-secondary"
                    style={{ padding: '4px 12px', fontSize: '15px', fontWeight: 'bold' }}
                    onClick={() => {
                      const current = Number(d.quotationLogoSize || d.logoSize || 135);
                      const next = Math.max(70, current - 5);
                      onChange({ ...d, quotationLogoSize: next, logoSize: next });
                    }}
                    title="Decrease logo size"
                  >
                    -
                  </button>
                  <span style={{ fontWeight: 700, fontSize: '13px', minWidth: '60px', textAlign: 'center', color: '#0f172a' }}>
                    {(d.quotationLogoSize || d.logoSize || 135)} px
                  </span>
                  <button
                    type="button"
                    className="settings-btn settings-btn-secondary"
                    style={{ padding: '4px 12px', fontSize: '15px', fontWeight: 'bold' }}
                    onClick={() => {
                      const current = Number(d.quotationLogoSize || d.logoSize || 135);
                      const next = Math.min(240, current + 5);
                      onChange({ ...d, quotationLogoSize: next, logoSize: next });
                    }}
                    title="Increase logo size"
                  >
                    +
                  </button>
                  <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '6px' }}>
                    Adjusts logo width on quotations
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Logo Row */}
            <div className="settings-field-group" style={{ marginTop: '6px' }}>
              <label className="settings-field-label">Footer Logo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="file"
                  ref={footerLogoInputRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={onUploadLogo}
                />
                <button
                  type="button"
                  className="settings-btn settings-btn-secondary"
                  onClick={() => footerLogoInputRef.current?.click()}
                >
                  Choose File
                </button>
                <span style={{ fontSize: '12px', color: '#64748b' }}>No file chosen</span>
              </div>
            </div>

            {/* Sign Image Row */}
            <div className="settings-field-group" style={{ marginTop: '6px' }}>
              <label className="settings-field-label">Sign Image</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="file"
                  ref={signInputRef}
                  style={{ display: 'none' }}
                  accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                  onChange={onUploadSign}
                />
                <button
                  type="button"
                  className="settings-btn settings-btn-secondary"
                  onClick={() => signInputRef.current?.click()}
                >
                  Choose File
                </button>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  {d.signatureUrl || d.sealUrl ? 'File loaded' : 'No file chosen'}
                </span>
              </div>
              {(d.signatureUrl || d.sealUrl) && (
                <div style={{ marginTop: '8px', padding: '6px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'inline-block' }}>
                  <img
                    src={d.signatureUrl || d.sealUrl}
                    alt="Signature/Seal"
                    style={{ maxHeight: '42px', maxWidth: '100px', objectFit: 'contain' }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="settings-col">
            <div className="settings-field-group">
              <label className="settings-field-label">
                Finance Year Ref
              </label>
              <input
                type="text"
                className="settings-input"
                value={d.financialYearRef || 'ASI/26-27'}
                onChange={(e) => handleChange('financialYearRef', e.target.value)}
                placeholder="ASI/26-27"
              />
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">
                Theme <span className="settings-required">*</span>
              </label>
              <select
                className="settings-select"
                value={d.theme || 'Green'}
                onChange={(e) => handleChange('theme', e.target.value)}
              >
                {THEMES.map((theme) => (
                  <option key={theme} value={theme}>{theme}</option>
                ))}
              </select>
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">
                Bank Name
              </label>
              <input
                type="text"
                className="settings-input"
                value={d.bankName || 'HDFC BANK'}
                onChange={(e) => handleChange('bankName', e.target.value)}
                placeholder="HDFC BANK / INDUSIND BANK"
              />
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">
                Email <span className="settings-required">*</span>
              </label>
              <input
                type="email"
                className="settings-input"
                value={d.email || 'admin@asi.ind.in'}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="admin@asi.ind.in"
              />
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">
                Phone <span className="settings-required">*</span>
              </label>
              <input
                type="text"
                className="settings-input"
                value={d.phone || '09994126666'}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="09994126666"
              />
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">
                Mobile <span className="settings-required">*</span>
              </label>
              <input
                type="text"
                className="settings-input"
                value={d.mobile || '9894326666,9150026666,9171126666'}
                onChange={(e) => handleChange('mobile', e.target.value)}
                placeholder="9894326666,9150026666,9171126666"
              />
              <span className="settings-field-hint">Comma separated for multiple dispatch and support contact numbers.</span>
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">
                Default Language
              </label>
              <select
                className="settings-select"
                value={d.defaultLanguage || 'English(US)'}
                onChange={(e) => handleChange('defaultLanguage', e.target.value)}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">
                Default Currency
              </label>
              <select
                className="settings-select"
                value={d.defaultCurrency || 'Rs'}
                onChange={(e) => handleChange('defaultCurrency', e.target.value)}
              >
                {CURRENCIES.map((cur) => (
                  <option key={cur} value={cur}>{cur}</option>
                ))}
              </select>
            </div>

            {/* Terms & Conditions Editor */}
            <div className="settings-field-group">
              <label className="settings-field-label">
                Terms &amp; Condition
              </label>
              <textarea
                className="settings-textarea"
                rows={5}
                value={d.termsAndConditions || ''}
                onChange={(e) => handleChange('termsAndConditions', e.target.value)}
                placeholder="Request Payment by Demand Draft / AC Payee Only..."
              />
            </div>

            {/* Quotation Terms Editor */}
            <div className="settings-field-group">
              <label className="settings-field-label">
                Quotation Terms
              </label>
              <textarea
                className="settings-textarea"
                rows={4}
                value={d.quotationTerms || ''}
                onChange={(e) => handleChange('quotationTerms', e.target.value)}
                placeholder="Note : Prices quoted are valid for 7 days."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
