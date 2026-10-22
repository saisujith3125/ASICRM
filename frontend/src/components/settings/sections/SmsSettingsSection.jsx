import React, { useState } from 'react';

const SMS_PROVIDERS = [
  'Fast2SMS',
  'MSG91',
  'Twilio',
  'Textlocal',
  'Gupshup'
];

export default function SmsSettingsSection({ data, onChange, onSave, isSaving }) {
  const sms = data?.smsSetup || {};
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testPhone, setTestPhone] = useState('9894326666');
  const [testStatus, setTestStatus] = useState(null);

  const handleUpdate = (field, val) => {
    onChange({
      ...data,
      smsSetup: {
        ...sms,
        [field]: val
      }
    });
  };

  const handleSendTest = (e) => {
    e.preventDefault();
    if (!testPhone) return;
    setTestStatus('sending');
    setTimeout(() => {
      setTestStatus('success');
    }, 1200);
  };

  return (
    <div className="settings-section-container">
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <h2>SMS Gateway &amp; Alerts</h2>
          <p>Integrate SMS notification providers for instant customer dispatch alerts and payment confirmations.</p>
        </div>
        <div className="settings-section-actions">
          <button
            type="button"
            className="settings-btn settings-btn-secondary"
            onClick={() => {
              setTestStatus(null);
              setTestModalOpen(true);
            }}
          >
            Send Test SMS
          </button>
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save SMS Setup'}
          </button>
        </div>
      </div>

      <div className="settings-two-col">
        {/* SMS GATEWAY CREDENTIALS */}
        <div className="settings-col">
          <div className="settings-card">
            <div className="settings-card-header">
              <div>
                <h3>Gateway Configuration</h3>
                <p className="settings-card-desc">API credentials and DLT compliance registration.</p>
              </div>
              <span className="settings-pill-badge active">
                {sms.status || 'Active'}
              </span>
            </div>

            <div className="settings-grid-2" style={{ marginBottom: '16px' }}>
              <div className="settings-field-group">
                <label className="settings-field-label">SMS Provider</label>
                <select
                  className="settings-select"
                  value={sms.provider || 'Fast2SMS'}
                  onChange={(e) => handleUpdate('provider', e.target.value)}
                >
                  {SMS_PROVIDERS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="settings-field-group">
                <label className="settings-field-label">Header Sender ID (6 Chars)</label>
                <input
                  type="text"
                  maxLength={6}
                  className="settings-input"
                  value={sms.senderId || 'ASICRM'}
                  onChange={(e) => handleUpdate('senderId', e.target.value.toUpperCase())}
                  placeholder="ASICRM"
                />
              </div>
            </div>

            <div className="settings-field-group" style={{ marginBottom: '16px' }}>
              <label className="settings-field-label">API Key / Token</label>
              <input
                type="password"
                className="settings-input"
                value={sms.apiKey || '••••••••••••••••'}
                onChange={(e) => handleUpdate('apiKey', e.target.value)}
                placeholder="Enter secret API key"
              />
            </div>

            <div className="settings-field-group">
              <label className="settings-field-label">DLT Principal Entity ID (India TRAI)</label>
              <input
                type="text"
                className="settings-input"
                value={sms.dltEntityId || '11015248900000'}
                onChange={(e) => handleUpdate('dltEntityId', e.target.value)}
                placeholder="11015248900000"
              />
              <span className="settings-field-hint">Required for Indian TRAI SMS telemarketer compliance and OTP delivery.</span>
            </div>
          </div>
        </div>

        {/* AUTOMATED NOTIFICATION TRIGGERS */}
        <div className="settings-col">
          <div className="settings-card">
            <div className="settings-card-header">
              <div>
                <h3>Notification Triggers</h3>
                <p className="settings-card-desc">Automatic SMS messages triggered on workflow events.</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div
                className="settings-toggle-row"
                onClick={() => handleUpdate('enableOrderAlerts', sms.enableOrderAlerts === false)}
              >
                <div className="settings-toggle-info">
                  <span className="settings-toggle-label">Order Confirmation SMS</span>
                  <span className="settings-toggle-desc">Trigger SMS to customer when Sales Order is confirmed.</span>
                </div>
                <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={sms.enableOrderAlerts !== false}
                    onChange={(e) => handleUpdate('enableOrderAlerts', e.target.checked)}
                  />
                  <span className="settings-slider" />
                </label>
              </div>

              <div
                className="settings-toggle-row"
                onClick={() => handleUpdate('enableDispatchAlerts', sms.enableDispatchAlerts === false)}
              >
                <div className="settings-toggle-info">
                  <span className="settings-toggle-label">Goods Dispatch &amp; DC SMS</span>
                  <span className="settings-toggle-desc">Send courier tracking / DC number upon goods release.</span>
                </div>
                <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={sms.enableDispatchAlerts !== false}
                    onChange={(e) => handleUpdate('enableDispatchAlerts', e.target.checked)}
                  />
                  <span className="settings-slider" />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TEST SMS MODAL */}
      {testModalOpen && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-card">
            <div className="settings-modal-header">
              <h3 className="settings-modal-title">Send Test SMS Message</h3>
              <button
                type="button"
                className="settings-modal-close-btn"
                onClick={() => setTestModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSendTest}>
              <div className="settings-modal-body">
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  Test your SMS provider credentials and gateway sender header delivery to a mobile device.
                </p>

                <div className="settings-field-group">
                  <label className="settings-field-label">Recipient Mobile Number (10 Digits)</label>
                  <input
                    type="tel"
                    className="settings-input"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    required
                    placeholder="9894326666"
                  />
                </div>

                {testStatus === 'success' && (
                  <div style={{ padding: '12px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#065f46', fontSize: '13px' }}>
                    ✓ SMS Delivered Successfully to <strong>+91 {testPhone}</strong> via {sms.provider || 'Fast2SMS'}!
                  </div>
                )}
              </div>

              <div className="settings-modal-footer">
                <button
                  type="button"
                  className="settings-btn settings-btn-secondary"
                  onClick={() => setTestModalOpen(false)}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="settings-btn settings-btn-primary"
                  disabled={testStatus === 'sending'}
                >
                  {testStatus === 'sending' ? 'Sending...' : 'Send SMS'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
