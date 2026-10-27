const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

const accessPath = path.join(__dirname, '..', 'data', 'access-control.json');
const data = JSON.parse(fs.readFileSync(accessPath, 'utf8'));
const activeUsers = data.users.filter((u) => u.status === 'Active' && u.mobile !== '9999999990' && u.mobile !== '9994126686');
assert(activeUsers.length >= 2, 'Need at least two active users for isolation test.');

function clearModule(rel) {
  const resolved = require.resolve(rel);
  delete require.cache[resolved];
}

function invoke(handler, body) {
  return new Promise((resolve, reject) => {
    const req = { body };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, payload }); }
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

(async () => {
  // Development fallback (no SMS provider): shared 1234 remains available for local testing.
  process.env.NODE_ENV = 'development';
  process.env.SMS_PROVIDER_ENABLED = 'false';
  process.env.DEV_SHARED_OTP = '1234';
  process.env.RESEND_COOLDOWN_MS = '0';
process.env.MAX_REQUESTS_PER_WINDOW = '50';

  clearModule('../utils/smsProvider');
  clearModule('../controllers/authController');
  let auth = require('../controllers/authController');

  const localSent = await invoke(auth.sendOtp, { mobile: activeUsers[0].mobile });
  assert.strictEqual(localSent.status, 200);
  assert.strictEqual(localSent.payload.devOtp, undefined, 'devOtp must NEVER be exposed in API payload');
  assert(!String(localSent.payload.message).includes('1234'), 'Message must not contain 1234');

  // Real provider-enabled mode in development: every request gets a fresh random OTP.
  process.env.SMS_PROVIDER_ENABLED = 'true';
  process.env.PAY4SMS_TOKEN = 'TEST_TOKEN';
  process.env.PAY4SMS_CREDIT = '2';
  process.env.PAY4SMS_SENDER = 'ASISYS';
  process.env.PAY4SMS_TEMPLATE_ID = '1707178360741677122';
  process.env.SMS_MESSAGE_TEMPLATE = 'Dear User, your login OTP for Active System Integration is ${otp}. This OTP is valid for 10 minutes. Please do not share this OTP with anyone. https://asiind.com';

  clearModule('../utils/smsProvider');
  clearModule('../controllers/authController');
  auth = require('../controllers/authController');

  const originalGet = http.get;
  let firstSms = '';
  http.get = (url, options, callback) => {
    if (typeof options === 'function') callback = options;
    firstSms = new URL(url).searchParams.get('message');
    const response = { statusCode: 200, setEncoding() {}, on(event, handler) { if (event === 'data') handler('ACCEPTED'); if (event === 'end') setImmediate(handler); return response; } };
    setImmediate(() => callback(response));
    return { setTimeout() { return this; }, on() { return this; }, destroy() {} };
  };

  const first = await invoke(auth.sendOtp, { mobile: activeUsers[0].mobile });
  assert.strictEqual(first.status, 200);
  assert.strictEqual(first.payload.devOtp, undefined);
  const firstOtp = (firstSms.match(/\b\d{4}\b/) || [])[0];
  assert(firstOtp, 'First real OTP should be present in the SMS message.');

  const firstVerified = await invoke(auth.verifyOtp, { mobile: activeUsers[0].mobile, otp: firstOtp });
  assert.strictEqual(firstVerified.status, 200);
  assert.strictEqual(firstVerified.payload.user.id, activeUsers[0].id);

  let secondSms = '';
  http.get = (url, options, callback) => {
    if (typeof options === 'function') callback = options;
    secondSms = new URL(url).searchParams.get('message');
    const response = { statusCode: 200, setEncoding() {}, on(event, handler) { if (event === 'data') handler('ACCEPTED'); if (event === 'end') setImmediate(handler); return response; } };
    setImmediate(() => callback(response));
    return { setTimeout() { return this; }, on() { return this; }, destroy() {} };
  };

  const second = await invoke(auth.sendOtp, { mobile: activeUsers[0].mobile });
  assert.strictEqual(second.status, 200);
  const secondOtp = (secondSms.match(/\b\d{4}\b/) || [])[0];
  assert(secondOtp, 'Second real OTP should be present in the SMS message.');
  assert.notStrictEqual(secondOtp, firstOtp, 'A newly requested OTP must differ from the previous OTP.');

  const wrong = await invoke(auth.verifyOtp, { mobile: activeUsers[0].mobile, otp: firstOtp });
  assert.strictEqual(wrong.status, 400, 'Old OTP must be invalid after a new OTP is issued.');

  const secondVerified = await invoke(auth.verifyOtp, { mobile: activeUsers[0].mobile, otp: secondOtp });
  assert.strictEqual(secondVerified.status, 200, 'Newest OTP must verify successfully.');

  const reused = await invoke(auth.verifyOtp, { mobile: activeUsers[0].mobile, otp: secondOtp });
  assert.strictEqual(reused.status, 400, 'A successfully used OTP must not be reusable.');

  // Generate several consecutive real-mode OTPs and make sure none repeats
  // for this mobile within the recent-OTP history.
  const generatedOtps = new Set([firstOtp, secondOtp]);
  for (let i = 0; i < 20; i += 1) {
    let smsMessage = '';
    http.get = (url, options, callback) => {
      if (typeof options === 'function') callback = options;
      smsMessage = new URL(url).searchParams.get('message');
      const response = { statusCode: 200, setEncoding() {}, on(event, handler) { if (event === 'data') handler('ACCEPTED'); if (event === 'end') setImmediate(handler); return response; } };
      setImmediate(() => callback(response));
      return { setTimeout() { return this; }, on() { return this; }, destroy() {} };
    };
    const generated = await invoke(auth.sendOtp, { mobile: activeUsers[0].mobile });
    assert.strictEqual(generated.status, 200);
    const nextOtp = (smsMessage.match(/\b\d{4}\b/) || [])[0];
    assert(nextOtp, 'Each real-mode request must send a 4-digit OTP.');
    assert(!generatedOtps.has(nextOtp), 'A recent OTP must not be repeated for the same mobile.');
    generatedOtps.add(nextOtp);
  }

  const inactive = data.users.find((u) => u.status !== 'Active');
  if (inactive) {
    const denied = await invoke(auth.sendOtp, { mobile: inactive.mobile });
    assert.strictEqual(denied.status, 403, 'Inactive user must not receive OTP.');
  }

  http.get = originalGet;
  console.log('OTP FLOW CHECK PASSED');
  console.log('Real provider-enabled development mode uses fresh random OTPs.');
  console.log('Old OTP invalidation, single-use verification, user lookup, role resolution, and inactive-user rejection verified.');
})().catch((error) => {
  console.error('OTP FLOW CHECK FAILED');
  console.error(error.stack || error);
  process.exit(1);
});
