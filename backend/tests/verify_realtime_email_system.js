/**
 * Verification Test Suite: Real-Time Outbound Email & SMTP Gateway
 * Tests Nodemailer integration, diagnostic test emails, password vaulting, and settings endpoints.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ACCESS_FILE = path.join(__dirname, '..', 'data', 'access-control.json');
const originalAccessData = fs.readFileSync(ACCESS_FILE, 'utf8');

const emailProvider = require('../utils/emailProvider');
const {
  sendTestEmailEndpoint,
  verifyEmailConnectionEndpoint,
  getCompanySettings,
  updateCompanySettings
} = require('../controllers/settingsController');

async function runTests() {
  console.log('--- Starting Real-Time Email System Test Suite ---\n');

  try {
    // TEST 1: Config resolution & defaults
    console.log('Test 1: Resolving SMTP configuration and defaults...');
    const config = emailProvider.resolveSmtpConfig();
    assert.strictEqual(config.host, 'smtp.gmail.com', 'Host should default to smtp.gmail.com or saved host');
    assert.strictEqual(config.port, 587, 'Port should be 587');
    assert.strictEqual(config.encryption, 'TLS', 'Encryption should be TLS');
    assert.strictEqual(config.authRequired, true, 'Auth should be required');
    console.log('✓ Test 1 Passed: Default SMTP config resolved correctly.\n');

    // TEST 2: Handshake verification without password returns clean diagnostic
    console.log('Test 2: Verifying missing credentials diagnostics...');
    const verifyResult = await emailProvider.verifySmtpConnection({ password: '' });
    assert.strictEqual(verifyResult.success, false, 'Verify should fail without password');
    assert.strictEqual(verifyResult.code, 'MISSING_PASSWORD', 'Code should be MISSING_PASSWORD');
    assert(verifyResult.message.includes('Password'), 'Message should indicate missing password');
    console.log('✓ Test 2 Passed: Friendly diagnostic returned for missing password.\n');

    // TEST 3: Invalid recipient validation
    console.log('Test 3: Validating recipient email address...');
    const invalidSend = await emailProvider.sendDiagnosticTestEmail({ recipient: 'not-an-email' });
    assert.strictEqual(invalidSend.success, false, 'Should fail with invalid recipient');
    assert.strictEqual(invalidSend.code, 'INVALID_RECIPIENT');
    console.log('✓ Test 3 Passed: Invalid recipient address rejected before network call.\n');

    // TEST 4: Google App Password diagnostic explanation formatting
    console.log('Test 4: Checking Gmail 535 error explanation format...');
    const formattedError = emailProvider.formatSmtpError(
      { code: 'EAUTH', message: '535-5.7.8 Username and Password not accepted' },
      { host: 'smtp.gmail.com', user: 'admin@asi.ind.in' }
    );
    assert(formattedError.includes('App Password'), 'Should mention App Password for Gmail host');
    console.log('✓ Test 4 Passed: Gmail 535 error translates to clear App Password advice.\n');

    // TEST 5: getCompanySettings masks password and sets hasPassword
    console.log('Test 5: Testing getCompanySettings password vault masking...');
    let resJsonData = null;
    const mockReq = { headers: { 'x-user-id': 'USR-001' } };
    const mockRes = {
      status(c) { this.statusCode = c; return this; },
      json(d) { resJsonData = d; return this; }
    };
    getCompanySettings(mockReq, mockRes);
    assert.strictEqual(resJsonData.success, true);
    assert.strictEqual(typeof resJsonData.data.emailSetup.hasPassword, 'boolean');
    if (resJsonData.data.emailSetup.hasPassword) {
      assert.strictEqual(resJsonData.data.emailSetup.password, '••••••••••••', 'Password should be masked');
    }
    console.log('✓ Test 5 Passed: getCompanySettings masks raw password and provides hasPassword flag.\n');

    // TEST 6: updateCompanySettings preserves password when masked value is sent
    console.log('Test 6: Ensuring bullet placeholder preserves existing vault password...');
    // Setup a temporary password in access-control.json
    const parsed = JSON.parse(fs.readFileSync(ACCESS_FILE, 'utf8'));
    if (!parsed.companySettings) parsed.companySettings = {};
    if (!parsed.companySettings.emailSetup) parsed.companySettings.emailSetup = {};
    parsed.companySettings.emailSetup.password = 'super_secret_smtp_token_123';
    fs.writeFileSync(ACCESS_FILE, JSON.stringify(parsed, null, 2), 'utf8');

    // Now call updateCompanySettings with masked password '••••••••••••'
    const updateReq = {
      headers: { 'x-user-id': 'USR-001' },
      body: {
        emailSetup: {
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          username: 'admin@asi.ind.in',
          password: '••••••••••••' // Masked value from form!
        }
      }
    };
    let updateResData = null;
    const updateRes = {
      status(c) { this.statusCode = c; return this; },
      json(d) { updateResData = d; return this; }
    };
    updateCompanySettings(updateReq, updateRes);
    assert.strictEqual(updateResData.success, true);

    // Verify raw file still has the actual secret password!
    const reloaded = JSON.parse(fs.readFileSync(ACCESS_FILE, 'utf8'));
    assert.strictEqual(
      reloaded.companySettings.emailSetup.password,
      'super_secret_smtp_token_123',
      'Password must not be overwritten by mask placeholder!'
    );
    console.log('✓ Test 6 Passed: Masked password did not erase vault password.\n');

    // TEST 7: Controller sendTestEmailEndpoint validation
    console.log('Test 7: Testing sendTestEmailEndpoint validation handling...');
    let testEmailRes = null;
    const endpointReq = {
      headers: { 'x-user-id': 'USR-001' },
      body: {
        recipient: '',
        settings: { smtpHost: 'smtp.gmail.com' }
      }
    };
    const endpointRes = {
      status(c) { this.statusCode = c; return this; },
      json(d) { testEmailRes = d; return this; }
    };
    await sendTestEmailEndpoint(endpointReq, endpointRes);
    assert.strictEqual(testEmailRes.success, false);
    console.log('✓ Test 7 Passed: sendTestEmailEndpoint validates recipient and parameters.\n');

    console.log('====================================================');
    console.log(' ALL REAL-TIME EMAIL TESTS PASSED SUCCESSFULLY! ✓');
    console.log('====================================================\n');
  } finally {
    // Restore original access control data
    fs.writeFileSync(ACCESS_FILE, originalAccessData, 'utf8');
    console.log('Cleaned up test data and restored access-control.json.');
  }
}

runTests().catch((err) => {
  fs.writeFileSync(ACCESS_FILE, originalAccessData, 'utf8');
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
