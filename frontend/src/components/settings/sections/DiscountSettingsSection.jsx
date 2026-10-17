import React from 'react';

export default function DiscountSettingsSection({ data, onChange, onSave, isSaving }) {
  const disc = data?.discountSetup || {
    maxDiscountPercent: 25,
    approvalRequiredAbove: 15,
    allowLineItemDiscount: true,
    allowGlobalDiscount: true,
    defaultDiscountType: 'Percentage'
  };

  const handleUpdate = (field, val) => {
    onChange({
      ...data,
      discountSetup: {
        ...disc,
        [field]: val
      }
    });
  };

  return (
    <div className="settings-section-container">
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <h2>Discount Policies &amp; Thresholds</h2>
          <p>Control sales margin protection, maximum allowable discount caps, and managerial approval workflows.</p>
        </div>
        <div className="settings-section-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Discount Rules'}
          </button>
        </div>
      </div>

      <div className="settings-two-col">
        <div className="settings-col">
          <div className="settings-card">
            <div className="settings-card-header">
              <div>
                <h3>Margin Guard &amp; Discount Limits</h3>
                <p className="settings-card-desc">Prevent unauthorized under-pricing on commercial quotations.</p>
              </div>
            </div>

            <div className="settings-grid-2" style={{ marginBottom: '16px' }}>
              <div className="settings-field-group">
                <label className="settings-field-label">Maximum Allowed Discount (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="settings-input"
                  value={disc.maxDiscountPercent || 25}
                  onChange={(e) => handleUpdate('maxDiscountPercent', parseInt(e.target.value, 10) || 0)}
                />
                <span className="settings-field-hint">Hard ceiling. Sales reps cannot exceed this percentage.</span>
              </div>
              <div className="settings-field-group">
                <label className="settings-field-label">Manager Approval Required Above (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="settings-input"
                  value={disc.approvalRequiredAbove || 15}
                  onChange={(e) => handleUpdate('approvalRequiredAbove', parseInt(e.target.value, 10) || 0)}
                />
                <span className="settings-field-hint">Triggers quotation approval queue before dispatch.</span>
              </div>
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">Default Discount Calculation</label>
              <select
                className="settings-select"
                value={disc.defaultDiscountType || 'Percentage'}
                onChange={(e) => handleUpdate('defaultDiscountType', e.target.value)}
              >
                <option value="Percentage">Percentage (%)</option>
                <option value="Fixed">Fixed Currency Amount (₹)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="settings-col">
          <div className="settings-card">
            <div className="settings-card-header">
              <div>
                <h3>Discount Applicability Scope</h3>
                <p className="settings-card-desc">Where discounts can be entered across line items and totals.</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                className="settings-toggle-row"
                onClick={() => handleUpdate('allowLineItemDiscount', disc.allowLineItemDiscount === false)}
              >
                <div className="settings-toggle-info">
                  <span className="settings-toggle-label">Line-Item Specific Discount</span>
                  <span className="settings-toggle-desc">Allow individual discount percentage column on line item tables.</span>
                </div>
                <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={disc.allowLineItemDiscount !== false}
                    onChange={(e) => handleUpdate('allowLineItemDiscount', e.target.checked)}
                  />
                  <span className="settings-slider" />
                </label>
              </div>

              <div
                className="settings-toggle-row"
                onClick={() => handleUpdate('allowGlobalDiscount', disc.allowGlobalDiscount === false)}
              >
                <div className="settings-toggle-info">
                  <span className="settings-toggle-label">Global Order-Level Discount</span>
                  <span className="settings-toggle-desc">Allow applying a single overall discount to subtotal before tax.</span>
                </div>
                <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={disc.allowGlobalDiscount !== false}
                    onChange={(e) => handleUpdate('allowGlobalDiscount', e.target.checked)}
                  />
                  <span className="settings-slider" />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
