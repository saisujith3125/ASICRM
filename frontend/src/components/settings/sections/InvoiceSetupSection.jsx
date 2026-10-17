import React from 'react';

export default function InvoiceSetupSection({ data, onChange, onSave, isSaving }) {
  const inv = data?.invoiceSetup || {};

  const handleUpdate = (field, val) => {
    onChange({
      ...data,
      invoiceSetup: {
        ...inv,
        [field]: val
      }
    });
  };

  const padNum = String(inv.nextNumber || 1001).padStart(inv.paddingDigits || 4, '0');
  const previewDocNo = `${inv.prefix || 'INV/'}${padNum}${inv.suffix || '/26-27'}`;

  return (
    <div className="settings-section-container">
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <h2>Sales Invoice Setup</h2>
          <p>Configure automatic invoice numbering sequence, layout visibility toggles, and standard legal declarations.</p>
        </div>
        <div className="settings-section-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Invoice Setup'}
          </button>
        </div>
      </div>

      {/* NUMBERING SEQUENCE */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div>
            <h3>Numbering Series &amp; Sequence</h3>
            <p className="settings-card-desc">Format of generated Tax Invoices throughout the fiscal year.</p>
          </div>
          <div style={{ padding: '6px 12px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
            <span style={{ fontSize: '12px', color: '#1d4ed8' }}>
              Next Generated: <strong style={{ fontFamily: 'monospace' }}>{previewDocNo}</strong>
            </span>
          </div>
        </div>

        <div className="settings-grid-4">
          <div className="settings-field-group">
            <label className="settings-field-label">Prefix</label>
            <input
              type="text"
              className="settings-input"
              value={inv.prefix || 'INV/'}
              onChange={(e) => handleUpdate('prefix', e.target.value)}
              placeholder="INV/"
            />
          </div>
          <div className="settings-field-group">
            <label className="settings-field-label">Suffix / Financial Year</label>
            <input
              type="text"
              className="settings-input"
              value={inv.suffix || '/26-27'}
              onChange={(e) => handleUpdate('suffix', e.target.value)}
              placeholder="/26-27"
            />
          </div>
          <div className="settings-field-group">
            <label className="settings-field-label">Next Sequence Number</label>
            <input
              type="number"
              className="settings-input"
              value={inv.nextNumber || 1042}
              onChange={(e) => handleUpdate('nextNumber', parseInt(e.target.value, 10) || 1)}
            />
          </div>
          <div className="settings-field-group">
            <label className="settings-field-label">Digit Zero Padding</label>
            <select
              className="settings-select"
              value={inv.paddingDigits || 4}
              onChange={(e) => handleUpdate('paddingDigits', parseInt(e.target.value, 10))}
            >
              <option value={3}>3 digits (001)</option>
              <option value={4}>4 digits (0001)</option>
              <option value={5}>5 digits (00001)</option>
            </select>
          </div>
        </div>
      </div>

      {/* DOCUMENT APPEARANCE & COMPONENT TOGGLES */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div>
            <h3>Document Elements &amp; Appearance</h3>
            <p className="settings-card-desc">Select which corporate brand assets appear on printable PDF invoices.</p>
          </div>
        </div>

        <div className="settings-grid-2">
          <div
            className="settings-toggle-row"
            onClick={() => handleUpdate('showLogo', inv.showLogo === false)}
          >
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">Show Enterprise Master Logo</span>
              <span className="settings-toggle-desc">Render company logo in the top document header.</span>
            </div>
            <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={inv.showLogo !== false}
                onChange={(e) => handleUpdate('showLogo', e.target.checked)}
              />
              <span className="settings-slider" />
            </label>
          </div>

          <div
            className="settings-toggle-row"
            onClick={() => handleUpdate('showSeal', inv.showSeal === false)}
          >
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">Affix Official Seal / Stamp</span>
              <span className="settings-toggle-desc">Emboss corporate seal over the authorized signature area.</span>
            </div>
            <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={inv.showSeal !== false}
                onChange={(e) => handleUpdate('showSeal', e.target.checked)}
              />
              <span className="settings-slider" />
            </label>
          </div>

          <div
            className="settings-toggle-row"
            onClick={() => handleUpdate('showSignature', inv.showSignature === false)}
          >
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">Authorized Signature Line</span>
              <span className="settings-toggle-desc">Include digital signature block in the footer.</span>
            </div>
            <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={inv.showSignature !== false}
                onChange={(e) => handleUpdate('showSignature', e.target.checked)}
              />
              <span className="settings-slider" />
            </label>
          </div>

          <div
            className="settings-toggle-row"
            onClick={() => handleUpdate('showBankDetails', inv.showBankDetails === false)}
          >
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">Bank &amp; Remittance Box</span>
              <span className="settings-toggle-desc">Display verified bank account number, IFSC code, and branch.</span>
            </div>
            <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={inv.showBankDetails !== false}
                onChange={(e) => handleUpdate('showBankDetails', e.target.checked)}
              />
              <span className="settings-slider" />
            </label>
          </div>
        </div>
      </div>

      {/* HEADER TITLE & DEFAULT NOTES */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div>
            <h3>Headers &amp; Standard Declarations</h3>
            <p className="settings-card-desc">Default title and legal notices printed on the bottom of all sales invoices.</p>
          </div>
        </div>

        <div className="settings-field-group" style={{ marginBottom: '16px' }}>
          <label className="settings-field-label">Document Main Header Title</label>
          <input
            type="text"
            className="settings-input"
            value={inv.headerTitle || 'TAX INVOICE'}
            onChange={(e) => handleUpdate('headerTitle', e.target.value)}
            placeholder="TAX INVOICE"
          />
        </div>

        <div className="settings-field-group" style={{ marginBottom: '16px' }}>
          <label className="settings-field-label">Default Invoice Note / Remarks</label>
          <textarea
            className="settings-textarea"
            rows={2}
            value={inv.defaultNotes || ''}
            onChange={(e) => handleUpdate('defaultNotes', e.target.value)}
            placeholder="Request Payment by Demand Draft / AC Payee Only..."
          />
        </div>

        <div className="settings-field-group">
          <label className="settings-field-label">Standard Terms &amp; Conditions</label>
          <textarea
            className="settings-textarea"
            rows={4}
            value={inv.defaultTerms || ''}
            onChange={(e) => handleUpdate('defaultTerms', e.target.value)}
            placeholder="1. Payment due within agreed terms..."
          />
        </div>
      </div>
    </div>
  );
}
