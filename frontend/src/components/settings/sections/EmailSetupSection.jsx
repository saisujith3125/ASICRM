import React, { useState } from 'react';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  ExternalLink,
  Check
} from 'lucide-react';
import { apiFetch, apiUrl } from '../../../api';

function authHeaders() {
  let activeId = 'USR-001';
  try {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('asicrm_user') : null;
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.id) activeId = parsed.id;
    }
  } catch {}
  return {
    'Content-Type': 'application/json',
    'x-user-id': activeId
  };
}

export default function EmailSetupSection({ data, onChange, onSave, isSaving }) {
  const email = data?.emailSetup || {};

  // Testing & Handshake states
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState(email.senderEmail || 'admin@asi.ind.in');
  const [testStatus, setTestStatus] = useState('idle'); // 'idle' | 'sending' | 'success' | 'error'
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState('');

  // Real-time direct handshake verification
  const [isVerifyingHandshake, setIsVerifyingHandshake] = useState(false);
  const [handshakeFeedback, setHandshakeFeedback] = useState(null);

  // Password visibility & editing
  const [showPassword, setShowPassword] = useState(false);

  const handleUpdate = (field, val) => {
    onChange({
      ...data,
      emailSetup: {
        ...email,
        [field]: val
      }
    });
  };

  // 1. Direct SMTP Handshake Verification
  const handleVerifyHandshake = async () => {
    setIsVerifyingHandshake(true);
    setHandshakeFeedback(null);
    try {
      const res = await apiFetch(apiUrl('/api/settings/email/verify-connection'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ settings: email })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setHandshakeFeedback({
          success: true,
          message: json.message || `Connected to ${email.smtpHost}:${email.smtpPort} successfully!`
        });
      } else {
        setHandshakeFeedback({
          success: false,
          message: json?.message || 'SMTP handshake failed. Please check host, port, and credentials.'
        });
      }
    } catch (err) {
      setHandshakeFeedback({
        success: false,
        message: err.message || 'Network error verifying SMTP connection.'
      });
    } finally {
      setIsVerifyingHandshake(false);
    }
  };

  // 2. Real-Time Test Email Dispatch
  const handleSendTest = async (e) => {
    e.preventDefault();
    const targetEmail = String(testRecipient || '').trim();
    if (!targetEmail) return;

    setTestStatus('sending');
    setTestResult(null);
    setTestError('');

    try {
      const res = await apiFetch(apiUrl('/api/settings/email/send-test'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          recipient: targetEmail,
          settings: email
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setTestStatus('success');
        setTestResult(json);
      } else {
        setTestStatus('error');
        setTestError(json?.message || 'Failed to dispatch real-time test email.');
      }
    } catch (err) {
      setTestStatus('error');
      setTestError(err.message || 'Network error communicating with email server.');
    }
  };

  const isConfigured = Boolean(email.smtpHost && email.username);

  return (
    <div className="settings-section-container">
      {/* SECTION HEADER */}
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2>Email &amp; SMTP Gateway</h2>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 600,
                background: isConfigured ? '#ecfdf5' : '#fffbeb',
                color: isConfigured ? '#047857' : '#b45309',
                border: isConfigured ? '1px solid #a7f3d0' : '1px solid #fde68a'
              }}
            >
              <Zap size={12} />
              Real-Time Outbound
            </span>
          </div>
          <p>Configure outbound SMTP servers for real-time dispatch of OTPs, quotations, invoices, order confirmations, and customer alerts.</p>
        </div>

        <div className="settings-section-actions">
          <button
            type="button"
            className="settings-btn settings-btn-secondary"
            onClick={handleVerifyHandshake}
            disabled={isVerifyingHandshake}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={isVerifyingHandshake ? 'animate-spin' : ''} />
            {isVerifyingHandshake ? 'Testing Handshake...' : 'Test Connection'}
          </button>
          <button
            type="button"
            className="settings-btn settings-btn-secondary"
            onClick={() => {
              setTestStatus('idle');
              setTestResult(null);
              setTestError('');
              setTestRecipient(email.senderEmail || 'admin@asi.ind.in');
              setTestModalOpen(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Send size={14} />
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

      {/* HANDSHAKE TOAST FEEDBACK */}
      {handshakeFeedback && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: handshakeFeedback.success ? '#ecfdf5' : '#fef2f2',
            border: handshakeFeedback.success ? '1px solid #a7f3d0' : '1px solid #fecaca',
            color: handshakeFeedback.success ? '#065f46' : '#991b1b',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          {handshakeFeedback.success ? (
            <CheckCircle2 size={18} style={{ color: '#059669', flexShrink: 0, marginTop: '1px' }} />
          ) : (
            <AlertTriangle size={18} style={{ color: '#dc2626', flexShrink: 0, marginTop: '1px' }} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>
              {handshakeFeedback.success ? 'SMTP Handshake Successful' : 'SMTP Handshake Warning'}
            </div>
            <div style={{ marginTop: '2px', lineHeight: '1.4' }}>{handshakeFeedback.message}</div>
          </div>
          <button
            type="button"
            onClick={() => setHandshakeFeedback(null)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              padding: '0 4px',
              fontSize: '16px'
            }}
          >
            ✕
          </button>
        </div>
      )}

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
                  value={email.smtpHost || ''}
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
                  <option value="TLS">STARTTLS (Port 587 - Recommended)</option>
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
                  <option value="LOGIN">Username &amp; Password / App Password</option>
                  <option value="ANONYMOUS">None (IP Whitelist / Localhost)</option>
                </select>
              </div>
            </div>

            <div className="settings-grid-2" style={{ marginBottom: '12px' }}>
              <div className="settings-field-group">
                <label className="settings-field-label">SMTP Username</label>
                <input
                  type="text"
                  className="settings-input"
                  value={email.username || ''}
                  onChange={(e) => handleUpdate('username', e.target.value)}
                  placeholder="admin@asi.ind.in or you@gmail.com"
                />
              </div>
              <div className="settings-field-group">
                <label className="settings-field-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>SMTP Password / App Password</span>
                  {email.hasPassword && (
                    <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <ShieldCheck size={12} /> Saved in Vault
                    </span>
                  )}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="settings-input"
                    value={email.password || ''}
                    onChange={(e) => handleUpdate('password', e.target.value)}
                    placeholder={email.hasPassword ? '•••••••••••• (Leave unchanged to keep)' : 'Enter SMTP or App Password'}
                    style={{ paddingRight: '36px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#64748b',
                      padding: '4px'
                    }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>

            {/* GMAIL HELPER CALLOUT */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
                color: '#475569',
                lineHeight: '1.5'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#1e293b', marginBottom: '2px' }}>
                <Lock size={13} style={{ color: '#0284c7' }} />
                Gmail / Google Workspace Notice:
              </div>
              Google requires a <strong>16-character Google App Password</strong> instead of your regular password. Go to your Google Account &rarr; Security &rarr; 2-Step Verification &rarr; <em>App passwords</em> to generate one.
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
                value={email.senderName || ''}
                onChange={(e) => handleUpdate('senderName', e.target.value)}
                placeholder="Active System Integration"
              />
            </div>

            <div className="settings-grid-2" style={{ marginBottom: '16px' }}>
              <div className="settings-field-group">
                <label className="settings-field-label">
                  From Address <span className="settings-required">*</span>
                </label>
                <input
                  type="email"
                  className="settings-input"
                  value={email.senderEmail || ''}
                  onChange={(e) => handleUpdate('senderEmail', e.target.value)}
                  placeholder="admin@asi.ind.in"
                />
              </div>
              <div className="settings-field-group">
                <label className="settings-field-label">Reply-To Address</label>
                <input
                  type="email"
                  className="settings-input"
                  value={email.replyToEmail || ''}
                  onChange={(e) => handleUpdate('replyToEmail', e.target.value)}
                  placeholder="support@asi.ind.in"
                />
              </div>
            </div>

            <div
              style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '12px',
                color: '#0369a1',
                lineHeight: '1.5'
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={14} /> Real-Time Real-World Dispatch:
              </div>
              When configured, the CRM dispatches official quotation PDFs, proforma invoices, sales receipts, and authorization OTPs directly from this sender address.
            </div>
          </div>
        </div>
      </div>

      {/* TEST EMAIL MODAL */}
      {testModalOpen && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-card" style={{ maxWidth: '520px' }}>
            <div className="settings-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={18} style={{ color: '#0284c7' }} />
                <h3 className="settings-modal-title">Send Real-Time Diagnostic Email</h3>
              </div>
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
                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0', lineHeight: '1.5' }}>
                  Transmit a real outbound message through your SMTP server to verify that credentials, TLS handshake, and delivery to inboxes work in real time.
                </p>

                <div className="settings-field-group" style={{ marginBottom: '16px' }}>
                  <label className="settings-field-label">
                    Recipient Inbox Address <span className="settings-required">*</span>
                  </label>
                  <input
                    type="email"
                    className="settings-input"
                    value={testRecipient}
                    onChange={(e) => setTestRecipient(e.target.value)}
                    required
                    placeholder="youremail@example.com"
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                    <span>Quick presets:</span>
                    <button
                      type="button"
                      onClick={() => setTestRecipient(email.senderEmail || 'admin@asi.ind.in')}
                      style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                    >
                      Sender ({email.senderEmail || 'admin@asi.ind.in'})
                    </button>
                  </div>
                </div>

                {/* SENDING SPINNER */}
                {testStatus === 'sending' && (
                  <div
                    style={{
                      padding: '16px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      fontSize: '13px',
                      color: '#334155'
                    }}
                  >
                    <RefreshCw size={20} className="animate-spin" style={{ color: '#0284c7' }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>Connecting to Outbound SMTP Server...</div>
                      <div style={{ color: '#64748b', fontSize: '12px' }}>
                        Establishing TLS handshake with {email.smtpHost || 'smtp.gmail.com'}:{email.smtpPort || 587}...
                      </div>
                    </div>
                  </div>
                )}

                {/* SUCCESS REAL-TIME BANNER */}
                {testStatus === 'success' && testResult && (
                  <div
                    style={{
                      padding: '16px',
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      borderRadius: '8px',
                      color: '#065f46',
                      fontSize: '13px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', marginBottom: '8px' }}>
                      <CheckCircle2 size={18} style={{ color: '#059669' }} />
                      Real-Time Email Dispatched Successfully!
                    </div>
                    <div style={{ marginBottom: '12px', color: '#047857', lineHeight: '1.5' }}>
                      A verification email with a real-time OTP code was delivered to <strong>{testResult.recipient}</strong>.
                    </div>

                    {testResult.otp && (
                      <div
                        style={{
                          background: '#ffffff',
                          border: '2px dashed #059669',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          textAlign: 'center',
                          margin: '10px 0'
                        }}
                      >
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#64748b' }}>
                          Diagnostic Verification Code
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '6px', color: '#065f46', fontFamily: 'monospace', marginTop: '2px' }}>
                          {testResult.otp}
                        </div>
                      </div>
                    )}

                    <div style={{ fontSize: '11px', color: '#047857', fontFamily: 'monospace', marginTop: '8px' }}>
                      Message ID: {testResult.messageId || 'Delivered'}
                    </div>
                  </div>
                )}

                {/* ERROR BANNER */}
                {testStatus === 'error' && (
                  <div
                    style={{
                      padding: '16px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      color: '#991b1b',
                      fontSize: '13px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '6px' }}>
                      <AlertTriangle size={18} style={{ color: '#dc2626' }} />
                      Email Dispatch Failed
                    </div>
                    <div style={{ lineHeight: '1.5', marginBottom: '8px' }}>
                      {testError}
                    </div>
                    {testError.includes('App Password') && (
                      <div style={{ background: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #fee2e2', fontSize: '12px', color: '#7f1d1d' }}>
                        <strong>Quick Fix:</strong> Gmail accounts require an App Password:
                        <ol style={{ margin: '6px 0 0 16px', padding: 0 }}>
                          <li>Go to Google Account &rarr; Security.</li>
                          <li>Turn on 2-Step Verification.</li>
                          <li>Click "App passwords" and create one for "Mail".</li>
                          <li>Paste the 16 characters into the SMTP Password field.</li>
                        </ol>
                      </div>
                    )}
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
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Send size={14} />
                  {testStatus === 'sending' ? 'Sending Real-Time...' : 'Send Test Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
