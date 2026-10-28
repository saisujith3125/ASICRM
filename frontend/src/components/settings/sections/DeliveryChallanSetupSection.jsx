import React from 'react';

export default function DeliveryChallanSetupSection({ data, onChange, onSave, isSaving }) {
  const dc = data?.dcSetup || {};

  const handleUpdate = (field, val) => {
    onChange({
      ...data,
      dcSetup: {
        ...dc,
        [field]: val
      }
    });
  };

  const padNum = String(dc.nextNumber || 1).padStart(dc.paddingDigits || 3, '0');
  const previewDocNo = `${dc.prefix || 'ASI/DC/'}${padNum}${dc.suffix || '/26-27'}`;

  return (
    <div className="settings-section-container">
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <h2>Delivery Challan Setup</h2>
          <p>Configure material transfer documentation, returnable goods policies, and gate pass numbering series.</p>
        </div>
        <div className="settings-section-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save DC Setup'}
          </button>
        </div>
      </div>

      {/* NUMBERING SEQUENCE */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div>
            <h3>Numbering Series &amp; Sequence</h3>
            <p className="settings-card-desc">Format of generated delivery challans.</p>
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
              value={dc.prefix !== undefined ? dc.prefix : 'ASI/DC/'}
              onChange={(e) => handleUpdate('prefix', e.target.value)}
              placeholder="ASI/DC/"
            />
          </div>
          <div className="settings-field-group">
            <label className="settings-field-label">Suffix / Financial Year</label>
            <input
              type="text"
              className="settings-input"
              value={dc.suffix || '/26-27'}
              onChange={(e) => handleUpdate('suffix', e.target.value)}
              placeholder="/26-27"
            />
          </div>
          <div className="settings-field-group">
            <label className="settings-field-label">Next Sequence Number</label>
            <input
              type="number"
              className="settings-input"
              value={dc.nextNumber || 29}
              onChange={(e) => handleUpdate('nextNumber', parseInt(e.target.value, 10) || 1)}
            />
          </div>
          <div className="settings-field-group">
            <label className="settings-field-label">Digit Zero Padding</label>
            <select
              className="settings-select"
              value={dc.paddingDigits || 3}
              onChange={(e) => handleUpdate('paddingDigits', parseInt(e.target.value, 10))}
            >
              <option value={2}>2 digits (01)</option>
              <option value={3}>3 digits (001)</option>
              <option value={4}>4 digits (0001)</option>
            </select>
          </div>
        </div>
      </div>

      {/* DOCUMENT APPEARANCE & COMPONENT TOGGLES */}
      <div className="settings-card">
        <div className="settings-card-header">
          <div>
            <h3>Document Elements &amp; Appearance</h3>
            <p className="settings-card-desc">Control visual branding blocks displayed on delivery challan slips.</p>
          </div>
        </div>

        <div className="settings-grid-2">
          <div
            className="settings-toggle-row"
            onClick={() => handleUpdate('showLogo', dc.showLogo === false)}
          >
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">Show Enterprise Logo</span>
              <span className="settings-toggle-desc">Render logo in DC header.</span>
            </div>
            <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={dc.showLogo !== false}
                onChange={(e) => handleUpdate('showLogo', e.target.checked)}
              />
              <span className="settings-slider" />
            </label>
          </div>

          {/* Delivery Challan Logo Size Control [-] [px] [+] [Restore Default] [Inherit Master] */}
          <div className="settings-toggle-row" style={{ cursor: 'default', flexWrap: 'wrap', gap: '8px' }}>
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">DC PDF Logo Size</span>
              <span className="settings-toggle-desc">Decrease or increase logo size specifically for Delivery Challan slips.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="settings-btn settings-btn-secondary"
                style={{ padding: '3px 10px', fontSize: '15px', fontWeight: 'bold' }}
                onClick={() => {
                  const current = Number(dc.logoSize || data?.dcLogoSize || 116);
                  const next = Math.max(50, current - 5);
                  handleUpdate('logoSize', next);
                  if (data && onChange) {
                    onChange({
                      ...data,
                      dcLogoSize: next,
                      dcSetup: { ...dc, logoSize: next }
                    });
                  }
                }}
                title="Decrease DC logo size (-5px)"
              >
                -
              </button>
              <span style={{ fontWeight: 700, fontSize: '13px', minWidth: '58px', textAlign: 'center', color: '#0f172a' }}>
                {(dc.logoSize || data?.dcLogoSize || 116)} px
              </span>
              <button
                type="button"
                className="settings-btn settings-btn-secondary"
                style={{ padding: '3px 10px', fontSize: '15px', fontWeight: 'bold' }}
                onClick={() => {
                  const current = Number(dc.logoSize || data?.dcLogoSize || 116);
                  const next = Math.min(300, current + 5);
                  handleUpdate('logoSize', next);
                  if (data && onChange) {
                    onChange({
                      ...data,
                      dcLogoSize: next,
                      dcSetup: { ...dc, logoSize: next }
                    });
                  }
                }}
                title="Increase DC logo size (+5px)"
              >
                +
              </button>
              <button
                type="button"
                className="settings-btn settings-btn-secondary"
                style={{ padding: '3px 8px', fontSize: '11px' }}
                onClick={() => {
                  const defaultSize = 116;
                  handleUpdate('logoSize', defaultSize);
                  if (data && onChange) {
                    onChange({
                      ...data,
                      dcLogoSize: defaultSize,
                      dcSetup: { ...dc, logoSize: defaultSize }
                    });
                  }
                }}
                title="Restore default DC size (116px)"
              >
                Restore Default (116px)
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
                      dcLogoSize: masterSize,
                      dcSetup: { ...dc, logoSize: masterSize }
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
            onClick={() => handleUpdate('showSeal', dc.showSeal === false)}
          >
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">Affix Corporate Seal</span>
              <span className="settings-toggle-desc">Stamp dispatch acknowledgment.</span>
            </div>
            <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={dc.showSeal !== false}
                onChange={(e) => handleUpdate('showSeal', e.target.checked)}
              />
              <span className="settings-slider" />
            </label>
          </div>

          <div
            className="settings-toggle-row"
            onClick={() => handleUpdate('showSignature', dc.showSignature === false)}
          >
            <div className="settings-toggle-info">
              <span className="settings-toggle-label">Authorized Signature</span>
              <span className="settings-toggle-desc">Signatory block in footer.</span>
            </div>
            <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={dc.showSignature !== false}
                onChange={(e) => handleUpdate('showSignature', e.target.checked)}
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
            <h3>Header &amp; Acknowledgment Notices</h3>
            <p className="settings-card-desc">Standard declarations printed on gate passes and delivery challans.</p>
          </div>
        </div>

        <div className="settings-field-group" style={{ marginBottom: '16px' }}>
          <label className="settings-field-label">Header Title</label>
          <input
            type="text"
            className="settings-input"
            value={dc.headerTitle || 'DELIVERY CHALLAN'}
            onChange={(e) => handleUpdate('headerTitle', e.target.value)}
            placeholder="DELIVERY CHALLAN"
          />
        </div>

        <div className="settings-field-group" style={{ marginBottom: '16px' }}>
          <label className="settings-field-label">Default Delivery Dispatch Note</label>
          <textarea
            className="settings-textarea"
            rows={2}
            value={dc.defaultNotes || ''}
            onChange={(e) => handleUpdate('defaultNotes', e.target.value)}
            placeholder="Goods dispatched for delivery / installation. Received the above goods in good order and condition."
          />
        </div>

        <div className="settings-field-group">
          <label className="settings-field-label">Returnable Goods Policy / Terms</label>
          <textarea
            className="settings-textarea"
            rows={3}
            value={dc.returnableTerms || ''}
            onChange={(e) => handleUpdate('returnableTerms', e.target.value)}
            placeholder="Returnable DC must be returned within 15 days of dispatch in undamaged original condition."
          />
        </div>
      </div>
    </div>
  );
}
