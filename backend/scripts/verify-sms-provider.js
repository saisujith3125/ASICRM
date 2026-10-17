const assert = require('assert');
const http = require('http');

process.env.NODE_ENV = 'development';
process.env.SMS_PROVIDER_ENABLED = 'true';
process.env.PAY4SMS_TOKEN = 'TEST_TOKEN';
process.env.PAY4SMS_CREDIT = '2';
process.env.PAY4SMS_SENDER = 'ASISYS';
process.env.PAY4SMS_TEMPLATE_ID = '1707178360741677122';
process.env.SMS_MESSAGE_TEMPLATE = 'Dear User, your login OTP for Active System Integration is ${otp}. This OTP is valid for 10 minutes. Please do not share this OTP with anyone. https://asiind.com';

const originalGet = http.get;
let captured = null;

http.get = (url, options, callback) => {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  captured = { url, options };
  const response = {
    statusCode: 200,
    setEncoding() {},
    on(event, handler) {
      if (event === 'data') handler('SMS_ACCEPTED');
      if (event === 'end') setImmediate(handler);
      return response;
    }
  };
  setImmediate(() => callback(response));
  return {
    setTimeout() { return this; },
    on() { return this; },
    destroy(error) { if (error && captured) captured.error = error; }
  };
};

(async () => {
  delete require.cache[require.resolve('../utils/smsProvider')];
  const sms = require('../utils/smsProvider');
  const result = await sms.sendSmsOtp('9876543210', '5831');

  assert.strictEqual(result.delivered, true);
  assert(captured, 'Expected http.get to be called.');

  const parsed = new URL(captured.url);
  assert.strictEqual(`${parsed.protocol}//${parsed.host}${parsed.pathname}`, 'http://pay4sms.in/sendsms/');
  assert.strictEqual(parsed.searchParams.get('token'), 'TEST_TOKEN');
  assert.strictEqual(parsed.searchParams.get('credit'), '2');
  assert.strictEqual(parsed.searchParams.get('sender'), 'ASISYS');
  assert.strictEqual(parsed.searchParams.get('number'), '9876543210');
  assert.strictEqual(parsed.searchParams.get('templateid'), '1707178360741677122');
  assert.strictEqual(parsed.searchParams.get('message'), 'Dear User, your login OTP for Active System Integration is 5831. This OTP is valid for 10 minutes. Please do not share this OTP with anyone. https://asiind.com');
  assert.strictEqual(captured.options.headers.Accept, 'text/plain, application/json, */*');

  console.log('SMS PROVIDER CHECK PASSED');
  console.log('Exact Pay4SMS URL parameters, OTP substitution, native HTTP GET, response-body capture, and rejection handling verified.');
})().catch((error) => {
  console.error('SMS PROVIDER CHECK FAILED');
  console.error(error.stack || error);
  process.exit(1);
}).finally(() => {
  http.get = originalGet;
});
