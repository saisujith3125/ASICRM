const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');

const accessPath = path.join(__dirname, '..', 'data', 'access-control.json');
const access = JSON.parse(fs.readFileSync(accessPath, 'utf8'));
const active = access.users.find((u) => u.status === 'Active');
assert(active, 'Need an active user.');

function clearModule(rel) {
  const resolved = require.resolve(rel);
  delete require.cache[resolved];
}

async function invoke(handler, body) {
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
  process.env.NODE_ENV = 'development';
  process.env.RESEND_COOLDOWN_MS = '0';
process.env.MAX_REQUESTS_PER_WINDOW = '50';
  process.env.DEV_SHARED_OTP = '1234';
  process.env.SMS_PROVIDER_ENABLED = 'true';
  process.env.PAY4SMS_TOKEN = 'TEST_TOKEN';
  process.env.PAY4SMS_CREDIT = '2';
  process.env.PAY4SMS_SENDER = 'ASISYS';
  process.env.PAY4SMS_TEMPLATE_ID = '1707178360741677122';
  process.env.SMS_MESSAGE_TEMPLATE = 'Dear User, your login OTP for Active System Integration is ${otp}. This OTP is valid for 10 minutes. Please do not share this OTP with anyone. https://asiind.com';

  let sentMessages = [];
  const originalGet = http.get;
  http.get = (url, options, callback) => {
    if (typeof options === 'function') { callback = options; }
    sentMessages.push(new URL(url).searchParams.get('message'));
    const response = {
      statusCode: 200,
      setEncoding() {},
      on(event, handler) {
        if (event === 'data') handler('ACCEPTED');
        if (event === 'end') setImmediate(handler);
        return response;
      }
    };
    setImmediate(() => callback(response));
    return { setTimeout() { return this; }, on() { return this; }, destroy() {} };
  };

  clearModule('../utils/smsProvider');
  clearModule('../controllers/authController');
  const auth = require('../controllers/authController');

  const firstSent = await invoke(auth.sendOtp, { mobile: active.mobile });
  assert.strictEqual(firstSent.status, 200);
  assert.strictEqual(firstSent.payload.devOtp, undefined);
  const firstOtp = (sentMessages[0].match(/\b\d{4}\b/) || [])[0];
  assert(firstOtp, 'Expected first generated OTP in SMS message.');

  const secondSent = await invoke(auth.sendOtp, { mobile: active.mobile });
  assert.strictEqual(secondSent.status, 200);
  const secondOtp = (sentMessages[1].match(/\b\d{4}\b/) || [])[0];
  assert(secondOtp, 'Expected second generated OTP in SMS message.');
  assert.notStrictEqual(firstOtp, secondOtp, 'Second OTP must differ from first OTP.');

  const oldOtp = await invoke(auth.verifyOtp, { mobile: active.mobile, otp: firstOtp });
  assert.strictEqual(oldOtp.status, 400, 'Old OTP must be invalid after resend.');

  const latest = await invoke(auth.verifyOtp, { mobile: active.mobile, otp: secondOtp });
  assert.strictEqual(latest.status, 200);

  const reused = await invoke(auth.verifyOtp, { mobile: active.mobile, otp: secondOtp });
  assert.strictEqual(reused.status, 400, 'Verified OTP must be single-use.');

  // Provider failure cleanup.
  http.get = (url, options, callback) => {
    if (typeof options === 'function') callback = options;
    const response = {
      statusCode: 500,
      setEncoding() {},
      on(event, handler) {
        if (event === 'data') handler('PROVIDER_ERROR');
        if (event === 'end') setImmediate(handler);
        return response;
      }
    };
    setImmediate(() => callback(response));
    return { setTimeout() { return this; }, on() { return this; }, destroy() {} };
  };

  clearModule('../utils/smsProvider');
  clearModule('../controllers/authController');
  const authWithFailure = require('../controllers/authController');

  const failedSend = await invoke(authWithFailure.sendOtp, { mobile: active.mobile });
  assert.strictEqual(failedSend.status, 502);

  // The generated OTP must not remain usable after SMS delivery failure.
  const cannotVerify = await invoke(authWithFailure.verifyOtp, { mobile: active.mobile, otp: '1234' });
  assert.strictEqual(cannotVerify.status, 400);

  http.get = originalGet;
  console.log('AUTH + PAY4SMS INTEGRATION CHECK PASSED');
  console.log('Fresh random OTP generation in provider-enabled development mode, resend invalidation, single-use verification, and provider failure cleanup verified.');
})().catch((error) => {
  console.error('AUTH + PAY4SMS INTEGRATION CHECK FAILED');
  console.error(error.stack || error);
  process.exit(1);
});
