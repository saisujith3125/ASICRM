import React, { useState, useRef } from 'react';
import { DEFAULT_ASI_LOGO, AsiOfficialSeal } from '../../documents/companyConfig';

export default function BrandingSection({
  data,
  onChange,
  onSave,
  isSaving,
  onUploadLogo,
  onResetLogo,
  onRemoveLogo,
  onUploadSign,
  onRemoveSign,
  onUploadSeal,
  onRemoveSeal
}) {
  const [checkerboard, setCheckerboard] = useState(true);
  const logoInputRef = useRef(null);
  const signInputRef = useRef(null);
  const sealInputRef = useRef(null);

  const d = data || {};
  const currentLogo = d.logoUrl || DEFAULT_ASI_LOGO;

  return (
    <div className="settings-section-container">
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <h2>Brand &amp; Visual Identity</h2>
          <p>Manage official enterprise logo, digital authorized signatures, and verified corporate seals across all generated PDFs.</p>
        </div>
        <div className="settings-section-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Branding'}
          </button>
        </div>
      </div>

      {/* MASTER LOGO CARD */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div>
            <h3>Official Master Logo</h3>
            <p className="settings-card-desc">High-resolution brand mark rendered in Sales Invoices, Proformas, Quotations, and Delivery Challans.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="settings-btn settings-btn-secondary"
              onClick={() => setCheckerboard((prev) => !prev)}
              title="Toggle transparency grid"
            >
              {checkerboard ? 'White Background' : 'Checkerboard Grid'}
            </button>
          </div>
        </div>

        <div className="branding-grid">
          <div>
            <div className={`branding-preview-box ${checkerboard ? 'checkerboard' : ''}`}>
              <img
                src={currentLogo}
                alt="Master Company Logo"
                className="branding-img-preview"
              />
            </div>
            <div className="branding-actions-row">
              <input
                type="file"
                ref={logoInputRef}
                style={{ display: 'none' }}
                accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                onChange={onUploadLogo}
              />
              <button
                type="button"
                className="settings-btn settings-btn-primary"
                onClick={() => logoInputRef.current?.click()}
              >
                Upload New Logo
              </button>
              <button
                type="button"
                className="settings-btn settings-btn-secondary"
                onClick={onResetLogo}
              >
                Reset Default ASI Logo
              </button>
              {d.logoUrl && (
                <button
                  type="button"
                  className="settings-btn settings-btn-outline-danger"
                  onClick={onRemoveLogo}
                >
                  Remove Logo
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', justifyContent: 'center' }}>
            <div className="settings-meta-bar" style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>Recommended Specifications</span>
                <span style={{ fontSize: '12px', color: '#475569' }}>• Recommended Format: <strong>SVG, High-res PNG with transparent background</strong></span>
                <span style={{ fontSize: '12px', color: '#475569' }}>• Maximum file size: <strong>5.0 MB</strong></span>
                <span style={{ fontSize: '12px', color: '#475569' }}>• Aspect Ratio: <strong>Horizontal 3:1 to 4:1 (Ideal height: 60-120px)</strong></span>
                <span style={{ fontSize: '12px', color: '#475569' }}>• Vector scaling ensures crisp rendering at 300 DPI print quality.</span>
              </div>
            </div>

            {/* Simulated PDF Header Banner */}
            <div style={{ padding: '12px 16px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Simulated PDF Header Scale</span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <img src={currentLogo} alt="Logo Scale" style={{ height: '32px', maxWidth: '110px', objectFit: 'contain' }} />
                <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569' }}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{d.companyName || 'Active System Integration'}</div>
                  <div>GSTIN: {d.gstin || '33AZPPS7068A1Z4'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MASTER LOGO SIZE CONTROL */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div>
            <h3>Master PDF Logo Size</h3>
            <p className="settings-card-desc">Global default display size for company logo across all generated PDFs. Particular modules (Quotation, Delivery Challan) can inherit this or specify their own custom size.</p>
          </div>
          <button
            type="button"
            className="settings-btn settings-btn-secondary"
            onClick={() => {
              const defaultSize = 180;
              onChange({
                ...d,
                masterLogoSize: defaultSize,
                logoSize: defaultSize
              });
            }}
            title="Restore default master logo size"
          >
            Restore Default (180px)
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', display: 'block' }}>Master Logo Width</span>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Sets standard logo scale for Sales Invoices, Proformas, and all document types.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="settings-btn settings-btn-secondary"
              style={{ width: '36px', height: '36px', padding: 0, fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => {
                const cur = Number(d.masterLogoSize || d.logoSize || 180);
                const next = Math.max(60, cur - 5);
                onChange({ ...d, masterLogoSize: next, logoSize: next });
              }}
              title="Decrease master logo size (-5px)"
            >
              -
            </button>
            <div style={{ padding: '6px 16px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 700, fontSize: '14px', minWidth: '70px', textAlign: 'center', color: '#0f172a' }}>
              {(d.masterLogoSize || d.logoSize || 180)} px
            </div>
            <button
              type="button"
              className="settings-btn settings-btn-secondary"
              style={{ width: '36px', height: '36px', padding: 0, fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => {
                const cur = Number(d.masterLogoSize || d.logoSize || 180);
                const next = Math.min(350, cur + 5);
                onChange({ ...d, masterLogoSize: next, logoSize: next });
              }}
              title="Increase master logo size (+5px)"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* SIGNATORY & OFFICIAL SEAL SIDE-BY-SIDE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* AUTHORIZED SIGNATORY */}
        <div className="settings-card" style={{ marginBottom: 0 }}>
          <div className="settings-card-header">
            <div>
              <h3>Authorized Signatory</h3>
              <p className="settings-card-desc">Digital signature image affixed in the authorized signatory box.</p>
            </div>
            <span className={`settings-pill-badge ${d.signatureUrl ? 'active' : 'inactive'}`}>
              {d.signatureUrl ? 'Configured' : 'Not Set'}
            </span>
          </div>

          <div className="branding-preview-box" style={{ minHeight: '140px' }}>
            {d.signatureUrl ? (
              <img
                src={d.signatureUrl}
                alt="Authorized Signature"
                className="branding-img-preview"
                style={{ maxHeight: '80px' }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 6px', display: 'block' }}>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                No signature image uploaded.<br />Documents will display blank signatory line.
              </div>
            )}
          </div>

          <div className="branding-actions-row">
            <input
              type="file"
              ref={signInputRef}
              style={{ display: 'none' }}
              accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
              onChange={onUploadSign}
            />
            <button
              type="button"
              className="settings-btn settings-btn-primary"
              onClick={() => signInputRef.current?.click()}
            >
              Upload Signature
            </button>
            {d.signatureUrl && (
              <button
                type="button"
                className="settings-btn settings-btn-outline-danger"
                onClick={onRemoveSign}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* OFFICIAL SEAL / STAMP */}
        <div className="settings-card" style={{ marginBottom: 0 }}>
          <div className="settings-card-header">
            <div>
              <h3>Official Seal / Stamp</h3>
              <p className="settings-card-desc">Official company stamp embossed over signatory block in documents.</p>
            </div>
            <span className={`settings-pill-badge ${d.sealUrl ? 'active' : 'primary'}`}>
              {d.sealUrl ? 'Custom Seal' : 'Standard Vector Seal'}
            </span>
          </div>

          <div className="branding-preview-box" style={{ minHeight: '140px' }}>
            {d.sealUrl ? (
              <img
                src={d.sealUrl}
                alt="Official Seal"
                className="branding-img-preview"
                style={{ maxHeight: '90px' }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <AsiOfficialSeal size={84} />
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>Default ASI Vector Stamp Active</span>
              </div>
            )}
          </div>

          <div className="branding-actions-row">
            <input
              type="file"
              ref={sealInputRef}
              style={{ display: 'none' }}
              accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
              onChange={onUploadSeal}
            />
            <button
              type="button"
              className="settings-btn settings-btn-primary"
              onClick={() => sealInputRef.current?.click()}
            >
              Upload Official Seal
            </button>
            {d.sealUrl && (
              <button
                type="button"
                className="settings-btn settings-btn-outline-danger"
                onClick={onRemoveSeal}
              >
                Reset to Default Vector Seal
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
