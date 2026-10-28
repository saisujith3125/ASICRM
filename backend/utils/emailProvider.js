/**
 * Active System Integration - Real-Time Outbound Email Engine
 * Powered by Nodemailer with SMTP Handshake Verification & Real-Time Delivery
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const ACCESS_FILE = path.join(__dirname, '..', 'data', 'access-control.json');

/**
 * Retrieve saved email setup from access-control.json
 */
function getSavedEmailSetup() {
  try {
    if (fs.existsSync(ACCESS_FILE)) {
      const data = JSON.parse(fs.readFileSync(ACCESS_FILE, 'utf8'));
      return data.companySettings?.emailSetup || {};
    }
  } catch (err) {
    console.error('[EMAIL PROVIDER] Error reading email setup:', err.message);
  }
  return {};
}

/**
 * Resolve effective SMTP configuration with hierarchy:
 * 1. Runtime overrides (e.g. from test form)
 * 2. Saved settings in access-control.json
 * 3. Environment variables (SMTP_HOST, SMTP_PORT, etc.)
 * 4. Production defaults
 */
function resolveSmtpConfig(overrides = {}) {
  const saved = getSavedEmailSetup();

  const host = String(overrides.smtpHost || saved.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(overrides.smtpPort || saved.smtpPort || process.env.SMTP_PORT || 587);
  const encryption = String(overrides.encryption || saved.encryption || (port === 465 ? 'SSL' : 'TLS')).toUpperCase();
  const authRequired = overrides.authRequired !== undefined
    ? Boolean(overrides.authRequired)
    : (saved.authRequired !== undefined ? Boolean(saved.authRequired) : true);

  const user = String(overrides.username || saved.username || process.env.SMTP_USER || '').trim();

  // Password resolution: do not overwrite real password with masked bullet placeholder
  let pass = '';
  if (overrides.password && overrides.password !== '••••••••••••' && overrides.password.trim()) {
    pass = String(overrides.password).trim();
  } else if (saved.password && saved.password !== '••••••••••••' && saved.password.trim()) {
    pass = String(saved.password).trim();
  } else if (process.env.SMTP_PASS) {
    pass = String(process.env.SMTP_PASS).trim();
  }

  const fromName = String(overrides.senderName || saved.senderName || process.env.SMTP_FROM_NAME || 'Active System Integration').trim();
  const fromEmail = String(overrides.senderEmail || saved.senderEmail || process.env.SMTP_FROM || user || 'admin@asi.ind.in').trim();
  const replyTo = String(overrides.replyToEmail || saved.replyToEmail || process.env.SMTP_REPLY_TO || fromEmail).trim();

  const secure = encryption === 'SSL' || port === 465;

  return {
    host,
    port,
    encryption,
    secure,
    authRequired,
    user,
    pass,
    fromName,
    fromEmail,
    replyTo
  };
}

/**
 * Instantiate Nodemailer transporter with connection timeouts
 */
function createTransporter(overrides = {}) {
  const config = resolveSmtpConfig(overrides);

  const transportOptions = {
    host: config.host,
    port: config.port,
    secure: config.secure,
    connectionTimeout: 15000,
    greetingTimeout: 12000,
    socketTimeout: 20000
  };

  if (config.authRequired && config.user) {
    transportOptions.auth = {
      user: config.user,
      pass: config.pass
    };
  }

  if (!config.secure) {
    transportOptions.tls = {
      rejectUnauthorized: false
    };
  }

  const transporter = nodemailer.createTransport(transportOptions);
  return { transporter, config };
}

/**
 * Format friendly diagnostic explanation for common SMTP failures
 */
function formatSmtpError(err, config) {
  const msg = String(err?.message || err || '');
  const code = String(err?.code || err?.responseCode || '');

  if (code === 'EAUTH' || /535|invalid credentials|username and password not accepted|bad credentials/i.test(msg)) {
    if (/gmail\.com/i.test(config.host)) {
      return 'Gmail Authentication Failed (535): Google requires a 16-character App Password when 2-Step Verification is active. Normal Gmail passwords are not accepted. Go to your Google Account > Security > 2-Step Verification > App passwords, create an App Password, and save it in SMTP Password.';
    }
    return `SMTP Authentication Failed: Server rejected username "${config.user}" or password. Please verify your credentials.`;
  }

  if (code === 'ETIMEDOUT' || /timed?out|ESOCKETTIMEDOUT/i.test(msg)) {
    return `Connection Timed Out: Unable to reach SMTP server ${config.host} on port ${config.port} within timeout limit. Check if your server allows outbound port ${config.port}.`;
  }

  if (code === 'ECONNREFUSED' || /connection refused/i.test(msg)) {
    return `Connection Refused: SMTP server ${config.host} actively refused connection on port ${config.port}. Verify host name and port (587 for TLS, 465 for SSL).`;
  }

  if (code === 'EENVELOPE' || /invalid recipient|recipient rejected/i.test(msg)) {
    return `Recipient Address Rejected: The recipient email address could not be delivered to by ${config.host}.`;
  }

  return `SMTP Delivery Error: ${msg || 'Unknown transport error'}`;
}

/**
 * Test SMTP connection handshake without sending an email
 */
async function verifySmtpConnection(overrides = {}) {
  const { transporter, config } = createTransporter(overrides);

  if (config.authRequired && !config.pass) {
    return {
      success: false,
      code: 'MISSING_PASSWORD',
      message: 'SMTP Password or App Password is required for authentication.'
    };
  }

  try {
    await transporter.verify();
    return {
      success: true,
      message: `SMTP handshake successful! Connected to ${config.host}:${config.port} (${config.encryption}).`,
      host: config.host,
      port: config.port,
      encryption: config.encryption,
      user: config.user,
      sender: `${config.fromName} <${config.fromEmail}>`
    };
  } catch (err) {
    console.error('[EMAIL PROVIDER] Smtp verify error:', err.message || err);
    return {
      success: false,
      code: err.code || 'VERIFY_FAILED',
      message: formatSmtpError(err, config),
      rawError: err.message
    };
  }
}

/**
 * Send a branded diagnostic test email with real-time verification code
 */
async function sendDiagnosticTestEmail({ recipient, overrides = {}, customOtp }) {
  const cleanRecipient = String(recipient || '').trim();
  if (!cleanRecipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanRecipient)) {
    return {
      success: false,
      code: 'INVALID_RECIPIENT',
      message: 'Please provide a valid recipient email address.'
    };
  }

  const { transporter, config } = createTransporter(overrides);

  if (config.authRequired && !config.pass) {
    return {
      success: false,
      code: 'MISSING_PASSWORD',
      message: 'SMTP Password or App Password is required before dispatching email.'
    };
  }

  const verificationCode = customOtp || String(Math.floor(100000 + Math.random() * 900000));
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'medium' });
  const isoTime = new Date().toISOString();

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Active System Integration - SMTP Verification</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; color: #0f172a; }
    .email-container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .email-header { background: linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%); padding: 32px 36px; text-align: center; color: #ffffff; }
    .email-header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
    .email-header p { margin: 8px 0 0 0; font-size: 13px; opacity: 0.9; }
    .email-body { padding: 36px 36px 28px 36px; }
    .status-badge { display: inline-block; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px; }
    .otp-box { background: #f8fafc; border: 2px dashed #0284c7; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1e3a8a; font-family: 'Courier New', monospace; }
    .otp-label { font-size: 12px; color: #64748b; text-transform: uppercase; margin-top: 6px; letter-spacing: 1px; }
    .meta-table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 13px; }
    .meta-table td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
    .meta-table td.label { font-weight: 600; color: #64748b; width: 35%; }
    .meta-table td.value { color: #1e293b; font-family: monospace; }
    .email-footer { background: #f8fafc; padding: 20px 36px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>ACTIVE SYSTEM INTEGRATION</h1>
      <p>Real-Time Outbound SMTP Gateway Verification</p>
    </div>
    <div class="email-body">
      <div class="status-badge">✓ Outbound Gateway Active</div>
      <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #0f172a;">Real-Time Email Handshake Confirmed</h2>
      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #475569;">
        This real-time diagnostic email confirms that your Active System Integration ERP & CRM outbound email server is successfully configured and actively dispatching emails.
      </p>

      <div class="otp-box">
        <div class="otp-code">${verificationCode}</div>
        <div class="otp-label">Diagnostic Verification Code</div>
      </div>

      <table class="meta-table">
        <tr>
          <td class="label">SMTP Server:</td>
          <td class="value">${config.host}:${config.port} (${config.encryption})</td>
        </tr>
        <tr>
          <td class="label">Sender Identity:</td>
          <td class="value">${config.fromName} &lt;${config.fromEmail}&gt;</td>
        </tr>
        <tr>
          <td class="label">Recipient:</td>
          <td class="value">${cleanRecipient}</td>
        </tr>
        <tr>
          <td class="label">Dispatched At:</td>
          <td class="value">${timestamp}</td>
        </tr>
      </table>
    </div>
    <div class="email-footer">
      This is an automated test message dispatched by Active System Integration CRM. &bull; Do not reply to this email.
    </div>
  </div>
</body>
</html>
`;

  const textBody = `ACTIVE SYSTEM INTEGRATION - REAL-TIME SMTP VERIFICATION\n\n` +
    `Your real-time email dispatch gateway is active and functioning properly.\n\n` +
    `Verification Code: ${verificationCode}\n\n` +
    `SMTP Server: ${config.host}:${config.port} (${config.encryption})\n` +
    `Sender: ${config.fromName} <${config.fromEmail}>\n` +
    `Recipient: ${cleanRecipient}\n` +
    `Dispatched At: ${timestamp}\n`;

  try {
    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: cleanRecipient,
      replyTo: config.replyTo,
      subject: `Active System Integration - SMTP Verification Code: [ ${verificationCode} ]`,
      text: textBody,
      html: htmlBody
    });

    console.log(`[EMAIL PROVIDER] Test email delivered to ${cleanRecipient}. MessageID: ${info.messageId}`);

    return {
      success: true,
      message: `Real-time test email successfully dispatched to ${cleanRecipient}!`,
      messageId: info.messageId,
      response: info.response,
      otp: verificationCode,
      timestamp: isoTime,
      recipient: cleanRecipient,
      configSummary: {
        host: config.host,
        port: config.port,
        encryption: config.encryption,
        sender: `${config.fromName} <${config.fromEmail}>`
      }
    };
  } catch (err) {
    console.error('[EMAIL PROVIDER] Test email delivery failed:', err.message || err);
    return {
      success: false,
      code: err.code || 'SEND_FAILED',
      message: formatSmtpError(err, config),
      rawError: err.message
    };
  }
}

/**
 * Dispatch an OTP authorization email (e.g. for user login or backup authorization)
 */
async function sendEmailOtp(toEmail, otp, purpose = 'Security Authorization', overrides = {}) {
  const cleanEmail = String(toEmail || '').trim();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { success: false, message: 'Invalid email address.' };
  }

  const { transporter, config } = createTransporter(overrides);

  if (config.authRequired && !config.pass) {
    return { success: false, message: 'SMTP credentials not configured.' };
  }

  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'medium' });

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Active System Integration - Authorization OTP</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; }
    .container { max-width: 540px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: #1e3a8a; padding: 24px; text-align: center; color: #ffffff; }
    .header h2 { margin: 0; font-size: 20px; font-weight: 700; }
    .content { padding: 32px 28px; text-align: center; }
    .otp { font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #0284c7; padding: 16px; background: #f0f9ff; border-radius: 8px; border: 1px dashed #38bdf8; display: inline-block; margin: 20px 0; font-family: monospace; }
    .footer { background: #f1f5f9; padding: 16px; font-size: 11px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>ACTIVE SYSTEM INTEGRATION</h2>
    </div>
    <div class="content">
      <h3 style="margin-top: 0; color: #1e293b;">${purpose}</h3>
      <p style="color: #475569; font-size: 14px; line-height: 1.5;">
        Your one-time verification code is displayed below. This code is valid for 10 minutes. Please do not share it with anyone.
      </p>
      <div class="otp">${otp}</div>
      <p style="color: #64748b; font-size: 12px;">Dispatched at: ${timestamp}</p>
    </div>
    <div class="footer">
      Active System Integration CRM &bull; Security Notification
    </div>
  </div>
</body>
</html>
`;

  try {
    const info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: cleanEmail,
      replyTo: config.replyTo,
      subject: `Active System Integration - ${purpose} Code: ${otp}`,
      text: `Your ${purpose} code is ${otp}. Valid for 10 minutes. Do not share with anyone.`,
      html: htmlBody
    });

    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    };
  } catch (err) {
    console.error('[EMAIL PROVIDER] sendEmailOtp error:', err.message || err);
    return {
      success: false,
      message: formatSmtpError(err, config)
    };
  }
}

/**
 * General purpose outbound email sender
 */
async function sendRealEmail({ to, subject, html, text, overrides = {}, replyTo, attachments }) {
  const { transporter, config } = createTransporter(overrides);

  if (config.authRequired && !config.pass) {
    return {
      success: false,
      code: 'MISSING_PASSWORD',
      message: 'SMTP credentials are not configured.'
    };
  }

  try {
    const mailOptions = {
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to,
      replyTo: replyTo || config.replyTo,
      subject,
      text,
      html
    };

    if (Array.isArray(attachments) && attachments.length > 0) {
      mailOptions.attachments = attachments;
    }

    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    console.error('[EMAIL PROVIDER] sendRealEmail error:', err.message || err);
    return {
      success: false,
      code: err.code || 'SEND_FAILED',
      message: formatSmtpError(err, config),
      rawError: err.message
    };
  }
}

/**
 * Return summary of current configuration (excluding raw password)
 */
function getEmailConfigSummary() {
  const config = resolveSmtpConfig();
  return {
    host: config.host,
    port: config.port,
    encryption: config.encryption,
    user: config.user,
    hasPassword: Boolean(config.pass),
    senderName: config.fromName,
    senderEmail: config.fromEmail,
    replyToEmail: config.replyTo,
    authRequired: config.authRequired
  };
}

module.exports = {
  resolveSmtpConfig,
  createTransporter,
  verifySmtpConnection,
  sendDiagnosticTestEmail,
  sendEmailOtp,
  sendRealEmail,
  getEmailConfigSummary,
  formatSmtpError
};
