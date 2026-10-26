const assert = require('assert');
const http = require('http');

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
  console.log('--- Testing Super Admin (9994126686) Real SMS OTP Flow ---');

  process.env.NODE_ENV = 'production';
  process.env.RESEND_COOLDOWN_MS = '0';
  process.env.MAX_REQUESTS_PER_WINDOW = '50';
  process.env.SMS_PROVIDER_ENABLED = 'true';
  process.env.PAY4SMS_TOKEN = 'REAL_TEST_TOKEN';
  process.env.PAY4SMS_CREDIT = '2';
  process.env.PAY4SMS_SENDER = 'ASISYS';
  process.env.PAY4SMS_TEMPLATE_ID = '1707178360741677122';
  process.env.SMS_MESSAGE_TEMPLATE = 'Dear User, your login OTP for Active System Integration is ${otp}. This OTP is valid for 10 minutes. Please do not share this OTP with anyone. https://asiind.com';

  let dispatchedSms = [];
  const originalGet = http.get;
  http.get = (url, options, callback) => {
    if (typeof options === 'function') callback = options;
    const parsed = new URL(url);
    dispatchedSms.push({
      number: parsed.searchParams.get('number'),
      message: parsed.searchParams.get('message'),
      sender: parsed.searchParams.get('sender')
    });
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

  // Test 1: Send OTP to Super Admin 9994126686
  const sendRes = await invoke(auth.sendOtp, { mobile: '9994126686' });
  assert.strictEqual(sendRes.status, 200);
  assert.strictEqual(sendRes.payload.success, true);
  assert.strictEqual(sendRes.payload.devOtp, undefined, 'devOtp must NEVER be returned to user');
  assert(
    !String(sendRes.payload.message).includes('1234') && !String(sendRes.payload.message).includes('Default'),
    'Message must not contain Default or 1234'
  );
  assert.strictEqual(sendRes.payload.message, 'OTP sent successfully.');

  // Verify Pay4SMS was actually called for 9994126686
  assert.strictEqual(dispatchedSms.length, 1);
  assert.strictEqual(dispatchedSms[0].number, '9994126686');
  assert.strictEqual(dispatchedSms[0].sender, 'ASISYS');

  const match = dispatchedSms[0].message.match(/\b\d{4}\b/);
  assert(match, 'SMS text must contain 4-digit OTP');
  const realOtp = match[0];
  console.log(`✓ Real SMS dispatched to 9994126686 with OTP: ${realOtp}`);

  // Test 2: Verify with wrong OTP '1234' -> MUST FAIL
  const failVerify = await invoke(auth.verifyOtp, { mobile: '9994126686', otp: '1234' });
  if (realOtp !== '1234') {
    assert.strictEqual(failVerify.status, 400, 'Hardcoded 1234 must fail when real OTP is generated');
    console.log('✓ Hardcoded 1234 was rejected as expected');
  }

  // Test 3: Verify with actual real OTP -> MUST SUCCEED
  const successVerify = await invoke(auth.verifyOtp, { mobile: '9994126686', otp: realOtp });
  assert.strictEqual(successVerify.status, 200);
  assert.strictEqual(successVerify.payload.success, true);
  assert.strictEqual(successVerify.payload.user.role, 'SUPER_ADMIN');
  assert.strictEqual(successVerify.payload.user.mobile, '9994126686');
  console.log(`✓ Successful login for Super Admin: ${successVerify.payload.user.name} (${successVerify.payload.user.role})`);

  // Test 4: Check another Super Admin (9344158558 - John Doe)
  const sendRes2 = await invoke(auth.sendOtp, { mobile: '9344158558' });
  assert.strictEqual(sendRes2.status, 200);
  assert.strictEqual(dispatchedSms.length, 2);
  assert.strictEqual(dispatchedSms[1].number, '9344158558');
  const match2 = dispatchedSms[1].message.match(/\b\d{4}\b/);
  const realOtp2 = match2[0];
  console.log(`✓ Real SMS dispatched to second Super Admin 9344158558 with OTP: ${realOtp2}`);

  const verify2 = await invoke(auth.verifyOtp, { mobile: '9344158558', otp: realOtp2 });
  assert.strictEqual(verify2.status, 200);
  assert.strictEqual(verify2.payload.user.name, 'John Doe');
  console.log(`✓ Successful login for second Super Admin: ${verify2.payload.user.name}`);

  http.get = originalGet;
  console.log('\nALL SUPER ADMIN REAL SMS TESTS PASSED 100%!');
})();
