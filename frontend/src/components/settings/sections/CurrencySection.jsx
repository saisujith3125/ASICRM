import React from 'react';

const COMMON_CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (INR)', format: 'en-IN' },
  { code: 'USD', symbol: '$', name: 'US Dollar (USD)', format: 'en-US' },
  { code: 'EUR', symbol: '€', name: 'Euro (EUR)', format: 'de-DE' },
  { code: 'GBP', symbol: '£', name: 'British Pound (GBP)', format: 'en-GB' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham (AED)', format: 'en-AE' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar (SGD)', format: 'en-SG' }
];

export default function CurrencySection({ data, onChange, onSave, isSaving }) {
  const cur = data?.currency || {
    baseCurrency: 'INR',
    symbol: '₹',
    code: 'INR',
    name: 'Indian Rupee (INR)',
    decimalPlaces: 2,
    format: 'en-IN'
  };

  const handleUpdate = (field, val) => {
    onChange({
      ...data,
      currency: {
        ...cur,
        [field]: val
      }
    });
  };

  const handlePresetSelect = (c) => {
    onChange({
      ...data,
      currency: {
        ...cur,
        baseCurrency: c.code,
        code: c.code,
        symbol: c.symbol,
        name: c.name,
        format: c.format
      }
    });
  };

  const sampleAmount = 145920.5;
  const formattedPreview = new Intl.NumberFormat(cur.format || 'en-IN', {
    minimumFractionDigits: cur.decimalPlaces || 2,
    maximumFractionDigits: cur.decimalPlaces || 2
  }).format(sampleAmount);

  return (
    <div className="settings-section-container">
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <h2>Base Currency &amp; Formatting</h2>
          <p>Global fiscal currency applied to all customer quotations, sales invoices, deal values, and purchase orders.</p>
        </div>
        <div className="settings-section-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Currency'}
          </button>
        </div>
      </div>

      <div className="settings-two-col">
        <div className="settings-col">
          <div className="settings-card">
            <div className="settings-card-header">
              <div>
                <h3>System Base Currency</h3>
                <p className="settings-card-desc">Choose from preset commercial currencies or customize formatting.</p>
              </div>
            </div>

            <div className="settings-field-group" style={{ marginBottom: '16px' }}>
              <label className="settings-field-label">Quick Currency Presets</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                {COMMON_CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    className={`settings-btn ${cur.code === c.code ? 'settings-btn-primary' : 'settings-btn-secondary'}`}
                    onClick={() => handlePresetSelect(c)}
                  >
                    {c.symbol} {c.code}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-grid-2" style={{ marginBottom: '16px' }}>
              <div className="settings-field-group">
                <label className="settings-field-label">Currency ISO Code</label>
                <input
                  type="text"
                  className="settings-input"
                  value={cur.code || 'INR'}
                  onChange={(e) => handleUpdate('code', e.target.value.toUpperCase())}
                  placeholder="INR"
                />
              </div>
              <div className="settings-field-group">
                <label className="settings-field-label">Currency Symbol</label>
                <input
                  type="text"
                  className="settings-input"
                  value={cur.symbol || '₹'}
                  onChange={(e) => handleUpdate('symbol', e.target.value)}
                  placeholder="₹"
                />
              </div>
            </div>

            <div className="settings-grid-2">
              <div className="settings-field-group">
                <label className="settings-field-label">Decimal Precision</label>
                <select
                  className="settings-select"
                  value={cur.decimalPlaces || 2}
                  onChange={(e) => handleUpdate('decimalPlaces', parseInt(e.target.value, 10))}
                >
                  <option value={0}>0 (Whole numbers e.g. ₹ 100)</option>
                  <option value={2}>2 (Standard e.g. ₹ 100.00)</option>
                  <option value={3}>3 (Precision e.g. ₹ 100.000)</option>
                </select>
              </div>
              <div className="settings-field-group">
                <label className="settings-field-label">Locale Number System</label>
                <select
                  className="settings-select"
                  value={cur.format || 'en-IN'}
                  onChange={(e) => handleUpdate('format', e.target.value)}
                >
                  <option value="en-IN">Indian Format (Lakhs &amp; Crores e.g. 1,00,000)</option>
                  <option value="en-US">International Format (Thousands &amp; Millions e.g. 100,000)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-col">
          <div className="settings-card" style={{ padding: '28px', textAlign: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Live Currency Display Preview
            </span>
            <div style={{ margin: '20px 0', padding: '24px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                {cur.symbol} {formattedPreview}
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>
                Indian Words: One Lakh Forty-Five Thousand Nine Hundred Twenty and Fifty Paise Only
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
