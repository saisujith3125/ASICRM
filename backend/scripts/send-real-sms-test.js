require('dotenv').config();

const crypto = require('crypto');
const { sendSmsOtp } = require('../utils/smsProvider');

const mobile = String(process.argv[2] || '').replace(/\D/g, '').slice(-10);
if (!/^\d{10}$/.test(mobile)) {
  console.error('Usage: npm run test:real-sms -- 9876543210');
  process.exit(1);
}

if (String(process.env.SMS_PROVIDER_ENABLED).toLowerCase() !== 'true') {
  console.error('SMS_PROVIDER_ENABLED must be true for a real SMS test.');
  process.exit(1);
}

if (!process.env.PAY4SMS_TOKEN || process.env.PAY4SMS_TOKEN === 'PASTE_YOUR_PAY4SMS_TOKEN_HERE') {
  console.error('PAY4SMS_TOKEN is not configured with a real provider token.');
  process.exit(1);
}

const otp = String(crypto.randomInt(1000, 10000));

(async () => {
  try {
    console.log(`Sending one real OTP test SMS to +91 ${mobile}.`);
    const result = await sendSmsOtp(mobile, otp);
    console.log('REAL SMS REQUEST ACCEPTED');
    console.log(`Test OTP sent in the message: ${otp}`);
    console.log(`Provider HTTP status: ${result.statusCode}`);
    console.log(`Provider response: ${result.providerResponse || '(empty response body)'}`);
    console.log('Check the physical phone for the SMS.');
  } catch (error) {
    console.error('REAL SMS REQUEST FAILED');
    console.error(error.message || error);
    process.exitCode = 1;
  }
})();
