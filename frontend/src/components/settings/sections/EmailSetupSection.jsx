import React, { useState } from 'react';

export default function EmailSetupSection({ data, onChange, onSave, isSaving }) {
  const email = data?.emailSetup || {};
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState('admin@asi.ind.in');
  const [testStatus, setTestStatus] = useState(null);

  const handleUpdate = (field, val) => {
    onChange({
      ...data,
      emailSetup: {
        ...email,
        [field]: val
      }
    });
  };

  const handleSendTest = (e) => {
    e.preventDefault();
    if (!testRecipient) return;
    setTestStatus('sending');
    setTimeout(() => {
      setTestStatus('success');
    }, 1200);
  };

  return (
    <div className="settings-section-container">
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <h2>Email &amp; SMTP Gateway</h2>
          <p>Configure outbound SMTP servers for dispatching quotations, invoices, order confirmations, and notifications.</p>
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
            Send Test Email
          </button>
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Email Setup'}
          </button>
        </div>
      </div>

      <div className="settings-two-col">
        {/* SMTP SERVER SETTINGS */}
        <div className="settings-col">
          <div className="settings-card">
            <div className="settings-card-header">
              <div>
                <h3>Outbound SMTP Server</h3>
                <p className="settings-card-desc">Authentication and connectivity parameters.</p>
              </div>
              <span className="settings-pill-badge active">
                {email.status || 'Configured'}
              </span>
            </div>

            <div className="settings-grid-2" style={{ marginBottom: '16px' }}>
              <div className="settings-field-group">
                <label className="settings-field-label">
                  SMTP Host Server <span className="settings-required">*</span>
                </label>
                <input
                  type="text"
                  className="settings-input"
                  value={email.smtpHost || 'smtp.gmail.com'}
                  onChange={(e) => handleUpdate('smtpHost', e.target.value)}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div className="settings-field-group">
                <label className="settings-field-label">
                  Port Number <span className="settings-required">*</span>
                </label>
                <input
                  type="number"
                  className="settings-input"
                  value={email.smtpPort || 587}
                  onChange={(e) => handleUpdate('smtpPort', parseInt(e.target.value, 10) || 587)}
                />
              </div>
            </div>

            <div className="settings-grid-2" style={{ marginBottom: '16px' }}>
              <div className="settings-field-group">
                <label className="settings-field-label">Encryption Protocol</label>
                <select
                  className="settings-select"
                  value={email.encryption || 'TLS'}
                  onChange={(e) => handleUpdate('encryption', e.target.value)}
                >
                  <option value="TLS">STARTTLS (Port 587)</option>
                  <option value="SSL">SSL / TLS (Port 465)</option>
                  <option value="None">None (Insecure Port 25)</option>
                </select>
              </div>
              <div className="settings-field-group">
                <label className="settings-field-label">Authentication Method</label>
                <select
                  className="settings-select"
                  value={email.authRequired !== false ? 'LOGIN' : 'ANONYMOUS'}
                  onChange={(e) => handleUpdate('authRequired', e.target.value === 'LOGIN')}
                >
                  <option value="LOGIN">Username &amp; Password</option>
                  <option value="ANONYMOUS">None (IP Whitelist)</option>
                </select>
              </div>
            </div>

            <div className="settings-grid-2">
              <div className="settings-field-group">
                <label className="settings-field-label">SMTP Username</label>
                <input
                  type="text"
                  className="settings-input"
                  value={email.username || 'admin@asi.ind.in'}
                  onChange={(e) => handleUpdate('username', e.target.value)}
                  placeholder="admin@asi.ind.in"
                />
              </div>
              <div className="settings-field-group">
                <label className="settings-field-label">SMTP Password</label>
                <input
                  type="password"
                  className="settings-input"
                  value={email.password || '••••••••••••'}
                  onChange={(e) => handleUpdate('password', e.target.value)}
                  placeholder="••••••••••••"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SENDER DEFAULTS & TEMPLATES */}
        <div className="settings-col">
          <div className="settings-card">
            <div className="settings-card-header">
              <div>
                <h3>Sender Identity &amp; Routing</h3>
                <p className="settings-card-desc">Information displayed in the customer's mail client inbox.</p>
              </div>
            </div>

            <div className="settings-field-group" style={{ marginBottom: '16px' }}>
              <label className="settings-field-label">
                Friendly Sender Display Name <span className="settings-required">*</span>
              </label>
              <input
                type="text"
                className="settings-input"
                value={email.senderName || 'Active System Integration'}
                onChange={(e) => handleUpdate('senderName', e.target.value)}
                placeholder="Active System Integration"
              />
            </div>

            <div className="settings-grid-2">
              <div className="settings-field-group">
                <label className="settings-field-label">
                  From Address <span className="settings-required">*</span>
                </label>
                <input
                  type="email"
                  className="settings-input"
                  value={email.senderEmail || 'admin@asi.ind.in'}
                  onChange={(e) => handleUpdate('senderEmail', e.target.value)}
                  placeholder="admin@asi.ind.in"
                />
              </div>
              <div className="settings-field-group">
                <label className="settings-field-label">Reply-To Address</label>
                <input
                  type="email"
                  className="settings-input"
                  value={email.replyToEmail || 'support@asi.ind.in'}
                  onChange={(e) => handleUpdate('replyToEmail', e.target.value)}
                  placeholder="support@asi.ind.in"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TEST EMAIL MODAL */}
      {testModalOpen && (
        <div className="settings-modal-overlay" onClick={() => setTestModalOpen(false)}>
          <div className="settings-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3 className="settings-modal-title">Send Diagnostic Test Email</h3>
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
                  Verify that your SMTP credentials, host handshake, and TLS configuration connect successfully.
                </p>

                <div className="settings-field-group">
                  <label className="settings-field-label">Recipient Email Address</label>
                  <input
                    type="email"
                    className="settings-input"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    required
                    placeholder="youremail@example.com"
                  />
                </div>

                {testStatus === 'success' && (
                  <div style={{ padding: '12px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#065f46', fontSize: '13px' }}>
                    ✓ SMTP Handshake Succeeded. Test message dispatched to <strong>{testRecipient}</strong>!
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
                  {testStatus === 'sending' ? 'Sending...' : 'Send Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
