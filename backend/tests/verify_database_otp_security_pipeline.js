/**
 * Automated Verification Suite:
 * High-Security OTP Pipeline for Database Backup & Gated Database Clearance
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  sendDatabaseBackupOtpEndpoint,
  createBackupEndpoint,
  sendDatabaseClearOtpEndpoint,
  clearDatabaseEndpoint,
  getDatabaseClearStatusEndpoint
} = require('../controllers/settingsController');

const crmDataPath = path.join(__dirname, '..', 'data', 'crm-data.json');
const stocksDataPath = path.join(__dirname, '..', 'data', 'stocks-data.json');
const crmSnapshot = fs.readFileSync(crmDataPath, 'utf8');
const stocksSnapshot = fs.readFileSync(stocksDataPath, 'utf8');

console.log('=== STARTING DATABASE BACKUP & CLEARANCE OTP SECURITY AUDIT ===\n');

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.data = payload;
      return res;
    },
    setHeader(k, v) {
      res.headers[k] = v;
    }
  };
  return res;
}

async function runSecurityPipelineTests() {
  try {
    const superAdminReq = {
      headers: { 'x-user-id': 'USR-001' },
      body: {}
    };
    const employeeReq = {
      headers: { 'x-user-id': 'USR-004' }, // Rajesh Kumar (EMPLOYEE)
      body: {}
    };

  // -------------------------------------------------------------
  // TEST 1: Role Enforcement & Initial Locked Status
  // -------------------------------------------------------------
  console.log('[Test 1] Checking initial clear-status and access control...');
  const res1 = mockRes();
  getDatabaseClearStatusEndpoint(superAdminReq, res1);
  assert.strictEqual(res1.data.isClearUnlocked, false, 'Database clearance must initially be locked');

  // Employee cannot request backup OTP
  const resEmp = mockRes();
  await sendDatabaseBackupOtpEndpoint(employeeReq, resEmp);
  assert.strictEqual(resEmp.statusCode, 403, 'Employee must be rejected with 403 for backup OTP');
  console.log('✓ PASS: Initial clearance locked and non-super-admin blocked.\n');

  // -------------------------------------------------------------
  // TEST 2: Pre-Backup Clear Attempt must be REJECTED (Gating Rule)
  // -------------------------------------------------------------
  console.log('[Test 2] Attempting deletion before verified backup...');
  const resClearPremature = mockRes();
  await sendDatabaseClearOtpEndpoint(superAdminReq, resClearPremature);
  assert.strictEqual(resClearPremature.statusCode, 403, 'Must reject deletion OTP request before backup');
  assert(resClearPremature.data.message.includes('locked'), 'Error message must state clearance is locked');

  const resWipePremature = mockRes();
  clearDatabaseEndpoint({ ...superAdminReq, body: { options: {}, otp: '1234' } }, resWipePremature);
  assert.strictEqual(resWipePremature.statusCode, 403, 'Direct clearance API without backup must be rejected with 403');
  console.log('✓ PASS: Clearance strictly blocked prior to backup.\n');

  // -------------------------------------------------------------
  // TEST 3: Request Backup OTP & Create Verified Backup
  // -------------------------------------------------------------
  console.log('[Test 3] Requesting backup OTP and executing verified backup...');
  // Capture the OTP from console or store
  let capturedBackupOtp = null;
  const originalLog = console.log;
  console.log = (...args) => {
    const msg = args.join(' ');
    const match = msg.match(/Dev Mode: (\d{4})/);
    if (match) capturedBackupOtp = match[1];
    originalLog(...args);
  };

  const resBackupOtp = mockRes();
  await sendDatabaseBackupOtpEndpoint(superAdminReq, resBackupOtp);
  assert.strictEqual(resBackupOtp.statusCode, 200, 'Backup OTP request must succeed');
  assert(resBackupOtp.data.maskedMobile, 'Masked mobile must be returned');
  assert(capturedBackupOtp, 'Backup OTP must be generated in memory/dev-log');

  // Wrong OTP must fail
  const resWrongOtp = mockRes();
  createBackupEndpoint({ ...superAdminReq, body: { title: 'Test Backup', otp: '0000' } }, resWrongOtp);
  assert.strictEqual(resWrongOtp.statusCode, 400, 'Invalid OTP must return 400');

  // Correct OTP must succeed and unlock clearance
  const resBackupSuccess = mockRes();
  createBackupEndpoint({ ...superAdminReq, body: { title: 'Security Audit Backup', otp: capturedBackupOtp } }, resBackupSuccess);
  assert.strictEqual(resBackupSuccess.statusCode, 200, 'Valid OTP backup must succeed');
  assert.strictEqual(resBackupSuccess.data.isClearUnlocked, true, 'isClearUnlocked must be true after verified backup');
  console.log('✓ PASS: Backup successfully verified and clearance unlocked.\n');

  // -------------------------------------------------------------
  // TEST 4: Clearance Status Unlocked
  // -------------------------------------------------------------
  console.log('[Test 4] Verifying clearance unlocked state on clear-status endpoint...');
  const resStatusUnlocked = mockRes();
  getDatabaseClearStatusEndpoint(superAdminReq, resStatusUnlocked);
  assert.strictEqual(resStatusUnlocked.data.isClearUnlocked, true, 'Clear-status must report unlocked');
  assert(resStatusUnlocked.data.remainingSeconds > 0, 'Remaining seconds must be greater than 0');
  console.log(`✓ PASS: Clear status confirmed unlocked (${resStatusUnlocked.data.remainingSeconds}s remaining).\n`);

  // -------------------------------------------------------------
  // TEST 5: Request Deletion Authorization OTP
  // -------------------------------------------------------------
  console.log('[Test 5] Requesting high-security deletion authorization OTP...');
  let capturedClearOtp = null;
  console.log = (...args) => {
    const msg = args.join(' ');
    const match = msg.match(/Dev Mode: (\d{4})/);
    if (match) capturedClearOtp = match[1];
    originalLog(...args);
  };

  const resClearOtp = mockRes();
  await sendDatabaseClearOtpEndpoint(superAdminReq, resClearOtp);
  console.log = originalLog; // Restore logger

  assert.strictEqual(resClearOtp.statusCode, 200, 'Clear OTP request must succeed');
  assert(resClearOtp.data.maskedMobile, 'Masked mobile must be returned');
  assert(capturedClearOtp, 'Deletion OTP must be captured');
  
  // -------------------------------------------------------------
  // TEST 6: Wrong Deletion OTP Fails & Correct Deletion OTP Relocks
  // -------------------------------------------------------------
  console.log('[Test 6] Verifying deletion OTP validation and automatic relock...');
  // Attempt with invalid deletion code
  const resInvalidClear = mockRes();
  clearDatabaseEndpoint({ ...superAdminReq, body: { options: { clearLeads: true }, otp: '9999' } }, resInvalidClear);
  assert.strictEqual(resInvalidClear.statusCode, 400, 'Invalid clear OTP must return 400');

  // Attempt with captured valid deletion code
  const resValidClear = mockRes();
  clearDatabaseEndpoint({ ...superAdminReq, body: { options: { clearLeads: false }, otp: capturedClearOtp } }, resValidClear);
  assert.strictEqual(resValidClear.statusCode, 200, 'Valid clear OTP must succeed');
  assert.strictEqual(resValidClear.data.isClearUnlocked, false, 'isClearUnlocked must be reset to false after clearance');

  // Verify that clearance is now relocked
  const resRelocked = mockRes();
  getDatabaseClearStatusEndpoint(superAdminReq, resRelocked);
  assert.strictEqual(resRelocked.data.isClearUnlocked, false, 'Clearance must be locked again');
  console.log('✓ PASS: Deletion successfully verified and clearance re-locked.\n');

  console.log('\n=======================================================');
  console.log(' ALL DATABASE OTP SECURITY PIPELINE TESTS PASSED (100%)');
  console.log('=======================================================');
  } finally {
    fs.writeFileSync(crmDataPath, crmSnapshot, 'utf8');
    fs.writeFileSync(stocksDataPath, stocksSnapshot, 'utf8');
  }
}

runSecurityPipelineTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
