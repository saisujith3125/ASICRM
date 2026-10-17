import React from 'react';

export default function QuotationSetupSection({ data, onChange, onSave, isSaving }) {
  const qtn = data?.quotationSetup || {};

  const handleUpdate = (field, val) => {
    onChange({
      ...data,
      quotationSetup: {
        ...qtn,
        [field]: val
      }
    });
  };

  const padNum = String(qtn.nextNumber || 101).padStart(qtn.paddingDigits || 3, '0');
  const previewDocNo = `${qtn.prefix || 'QTN/'}${padNum}${qtn.suffix || '/26-27'}`;

  return (
    <div className="settings-section-container">
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <h2>Quotation Setup</h2>
          <p>Configure commercial quote numbering series, default validity duration, and standard commercial proposal conditions.</p>
        </div>
        <div className="settings-section-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Quotation Setup'}
          </button>
        </div>
      </div>

      {/* NUMBERING SEQUENCE */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div>
            <h3>Numbering Series &amp; Sequence</h3>
            <p className="settings-card-desc">Format of generated commercial quotations.</p>
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
              value={qtn.prefix || 'QTN/'}
              onChange={(e) => handleUpdate('prefix', e.target.value)}
              placeholder="QTN/"
            />
          </div>
          <div className="settings-field-group">
            <label className="settings-field-label">Suffix / Financial Year</label>
            <input
              type="text"
              className="settings-input"
              value={qtn.suffix || '/26-27'}
              onChange={(e) => handleUpdate('suffix', e.target.value)}
              placeholder="/26-27"
            />
          </div>
          <div className="settings-field-group">
            <label className="settings-field-label">Next Sequence Number</label>
            <input
              type="number"
              className="settings-input"
              value={qtn.nextNumber || 135}
              onChange={(e) => handleUpdate('nextNumber', parseInt(e.target.value, 10) || 1)}
            />
          </div>
          <div className="settings-field-group">
            <label className="settings-field-label">Standard Validity (Days)</label>
            <input
              type="number"
              className="settings-input"
              value={qtn.validityDays || 7}
              onChange={(e) => handleUpdate('validityDays', parseInt(e.target.value, 10) || 7)}
            />
          </div>
        </div>
      </div>

      {/* DOCUMENT APPEARANCE & COMPONENT TOGGLES */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div>
            <h3>Document Elements &amp; Appearance</h3>
            <p className="settings-card-desc">Control visual branding blocks displayed on quotation proposals.</p>
          </div>
        </div>

        <div className="settings-grid-2">
          <div
            className="settings-toggle-row"
            onClick={() => handleUpdate('showLogo', qtn.showLogo === false)}
          >
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">Show Enterprise Master Logo</span>
              <span className="settings-toggle-desc">Render company logo in top header.</span>
            </div>
            <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={qtn.showLogo !== false}
                onChange={(e) => handleUpdate('showLogo', e.target.checked)}
              />
              <span className="settings-slider" />
            </label>
          </div>

          {/* Quotation Logo Size Control [-] [px] [+] [Restore Default] [Inherit Master] */}
          <div className="settings-toggle-row" style={{ cursor: 'default', flexWrap: 'wrap', gap: '8px' }}>
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">Quotation PDF Logo Size</span>
              <span className="settings-toggle-desc">Decrease or increase logo size specifically for Quotation proposals.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="settings-btn settings-btn-secondary"
                style={{ padding: '3px 10px', fontSize: '15px', fontWeight: 'bold' }}
                onClick={() => {
                  const current = Number(qtn.logoSize || data?.quotationLogoSize || 170);
                  const next = Math.max(70, current - 5);
                  handleUpdate('logoSize', next);
                  if (data && onChange) {
                    onChange({
                      ...data,
                      quotationLogoSize: next,
                      quotationSetup: { ...qtn, logoSize: next }
                    });
                  }
                }}
                title="Decrease quotation logo size (-5px)"
              >
                -
              </button>
              <span style={{ fontWeight: 700, fontSize: '13px', minWidth: '58px', textAlign: 'center', color: '#0f172a' }}>
                {(qtn.logoSize || data?.quotationLogoSize || 170)} px
              </span>
              <button
                type="button"
                className="settings-btn settings-btn-secondary"
                style={{ padding: '3px 10px', fontSize: '15px', fontWeight: 'bold' }}
                onClick={() => {
                  const current = Number(qtn.logoSize || data?.quotationLogoSize || 170);
                  const next = Math.min(350, current + 5);
                  handleUpdate('logoSize', next);
                  if (data && onChange) {
                    onChange({
                      ...data,
                      quotationLogoSize: next,
                      quotationSetup: { ...qtn, logoSize: next }
                    });
                  }
                }}
                title="Increase quotation logo size (+5px)"
              >
                +
              </button>
              <button
                type="button"
                className="settings-btn settings-btn-secondary"
                style={{ padding: '3px 8px', fontSize: '11px' }}
                onClick={() => {
                  const defaultSize = 170;
                  handleUpdate('logoSize', defaultSize);
                  if (data && onChange) {
                    onChange({
                      ...data,
                      quotationLogoSize: defaultSize,
                      quotationSetup: { ...qtn, logoSize: defaultSize }
                    });
                  }
                }}
                title="Restore reference quotation size (170px)"
              >
                Restore Default (170px)
              </button>
              <button
                type="button"
                className="settings-btn settings-btn-secondary"
                style={{ padding: '3px 8px', fontSize: '11px' }}
                onClick={() => {
                  const masterSize = Number(data?.masterLogoSize || data?.logoSize || 180);
                  handleUpdate('logoSize', masterSize);
                  if (data && onChange) {
                    onChange({
                      ...data,
                      quotationLogoSize: masterSize,
                      quotationSetup: { ...qtn, logoSize: masterSize }
                    });
                  }
                }}
                title="Reset to global master logo size"
              >
                Inherit Master
              </button>
            </div>
          </div>

          <div
            className="settings-toggle-row"
            onClick={() => handleUpdate('showSeal', qtn.showSeal === false)}
          >
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">Affix Corporate Seal / Stamp</span>
              <span className="settings-toggle-desc">Stamp quotation summary block.</span>
            </div>
            <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={qtn.showSeal !== false}
                onChange={(e) => handleUpdate('showSeal', e.target.checked)}
              />
              <span className="settings-slider" />
            </label>
          </div>

          <div
            className="settings-toggle-row"
            onClick={() => handleUpdate('showSignature', qtn.showSignature === false)}
          >
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">Authorized Signature Line</span>
              <span className="settings-toggle-desc">Include digital authorized signature.</span>
            </div>
            <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={qtn.showSignature !== false}
                onChange={(e) => handleUpdate('showSignature', e.target.checked)}
              />
              <span className="settings-slider" />
            </label>
          </div>

          <div
            className="settings-toggle-row"
            onClick={() => handleUpdate('showBankDetails', qtn.showBankDetails === false)}
          >
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">Bank &amp; Advance Remittance Box</span>
              <span className="settings-toggle-desc">Display advance payment bank routing details.</span>
            </div>
            <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={qtn.showBankDetails !== false}
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
            <h3>Header &amp; Commercial Terms</h3>
            <p className="settings-card-desc">Default notes and terms inserted when creating new quotations.</p>
          </div>
        </div>

        <div className="settings-field-group" style={{ marginBottom: '16px' }}>
          <label className="settings-field-label">Header Title</label>
          <input
            type="text"
            className="settings-input"
            value={qtn.headerTitle || 'QUOTATION'}
            onChange={(e) => handleUpdate('headerTitle', e.target.value)}
            placeholder="QUOTATION"
          />
        </div>

        <div className="settings-field-group" style={{ marginBottom: '16px' }}>
          <label className="settings-field-label">Default Quotation Note</label>
          <textarea
            className="settings-textarea"
            rows={2}
            value={qtn.defaultNotes || ''}
            onChange={(e) => handleUpdate('defaultNotes', e.target.value)}
            placeholder="Note: Prices quoted are valid for 7 days. Taxes extra as applicable."
          />
        </div>

        <div className="settings-field-group">
          <label className="settings-field-label">Standard Commercial Terms &amp; Conditions</label>
          <textarea
            className="settings-textarea"
            rows={4}
            value={qtn.defaultTerms || ''}
            onChange={(e) => handleUpdate('defaultTerms', e.target.value)}
            placeholder="1. Prices valid for 7 days..."
          />
        </div>
      </div>
    </div>
  );
}
