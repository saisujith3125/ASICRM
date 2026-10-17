const http = require('http');
const https = require('https');
const { URL } = require('url');

const getSmsProviderEnabled = () => String(process.env.SMS_PROVIDER_ENABLED || 'false').toLowerCase() === 'true';
const getPay4SmsBaseUrl = () => String(process.env.PAY4SMS_BASE_URL || 'http://pay4sms.in/sendsms/').trim();
const getPay4SmsToken = () => String(process.env.PAY4SMS_TOKEN || '').trim();
const getPay4SmsCredit = () => String(process.env.PAY4SMS_CREDIT || '2').trim();
const getPay4SmsSender = () => String(process.env.PAY4SMS_SENDER || 'ASISYS').trim();
const getPay4SmsTemplateId = () => String(process.env.PAY4SMS_TEMPLATE_ID || '1707178360741677122').trim();
const getSmsMessageTemplate = () => String(
  process.env.SMS_MESSAGE_TEMPLATE ||
    'Dear User, your login OTP for Active System Integration is ${otp}. This OTP is valid for 10 minutes. Please do not share this OTP with anyone. https://asiind.com'
).trim();

const REQUEST_TIMEOUT_MS = Number(process.env.PAY4SMS_TIMEOUT_MS) || 15000;

function isConfigured() {
  return Boolean(
    getPay4SmsToken() &&
    getPay4SmsCredit() &&
    getPay4SmsSender() &&
    getPay4SmsTemplateId() &&
    getSmsMessageTemplate()
  );
}

function getSmsConfigSummary() {
  return {
    SMS_PROVIDER_ENABLED: getSmsProviderEnabled() ? 'YES' : 'NO',
    SMS_PROVIDER_configured: isConfigured() ? 'YES' : 'NO',
    SMS_API_KEY_configured: Boolean(getPay4SmsToken()) ? 'YES' : 'NO',
    SMS_SENDER_configured: Boolean(getPay4SmsSender()) ? 'YES' : 'NO',
    SMS_SENDER: getPay4SmsSender() || 'NONE',
    NODE_ENV: process.env.NODE_ENV || 'development'
  };
}

function buildOtpMessage(otp) {
  return getSmsMessageTemplate()
    .replaceAll('${otp}', String(otp))
    .replaceAll('{{otp}}', String(otp));
}

function buildPay4SmsUrl(mobile, message) {
  const url = new URL(getPay4SmsBaseUrl());
  url.searchParams.set('token', getPay4SmsToken());
  url.searchParams.set('credit', getPay4SmsCredit());
  url.searchParams.set('sender', getPay4SmsSender());
  url.searchParams.set('message', message);
  url.searchParams.set('number', String(mobile));
  url.searchParams.set('templateid', getPay4SmsTemplateId());
  return url.toString();
}

function redactPay4SmsUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.searchParams.has('token')) url.searchParams.set('token', 'REDACTED');
    if (url.searchParams.has('message')) {
      const msg = url.searchParams.get('message');
      url.searchParams.set('message', msg.replace(/\b\d{4}\b/g, '****'));
    }
    return url.toString();
  } catch {
    return '[invalid Pay4SMS URL]';
  }
}

function providerBodyLooksLikeFailure(body) {
  const value = String(body || '').trim().toLowerCase();
  if (!value) return false;
  return /\b(error|failed|failure|invalid|insufficient|denied|reject|unauthori[sz]ed|blocked|not\s+sent|credit\s+exhausted)\b/.test(value);
}

function requestPay4Sms(rawUrl) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch (error) {
      reject(new Error(`Invalid Pay4SMS URL: ${error.message}`));
      return;
    }

    const transport = parsed.protocol === 'https:' ? https : http;
    const request = transport.get(parsed, {
      headers: {
        Accept: 'text/plain, application/json, */*'
      }
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        const statusCode = Number(response.statusCode || 0);
        console.log(`[SMS PROD] Pay4SMS HTTP ${statusCode}.`);
        console.log(`[SMS PROD] Pay4SMS response: ${String(body).slice(0, 500)}`);

        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`Pay4SMS request failed with HTTP ${statusCode}. Provider response: ${String(body).slice(0, 300)}`));
          return;
        }

        // Some SMS gateways return HTTP 200 even when the provider rejected the
        // request in the response body. Treat obvious rejection text as failure.
        if (providerBodyLooksLikeFailure(body)) {
          reject(new Error(`Pay4SMS rejected the SMS. Provider response: ${String(body).slice(0, 300)}`));
          return;
        }

        resolve({ statusCode, body: String(body).slice(0, 500) });
      });
    });

    request.setTimeout(REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error(`Pay4SMS request timed out after ${REQUEST_TIMEOUT_MS} ms.`));
    });

    request.on('error', (error) => reject(error));
  });
}

async function sendSmsOtp(mobile, otp) {
  const providerEnabled = getSmsProviderEnabled();
  if (!providerEnabled) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AUTH DEV] Generated OTP for +91 ${String(mobile).slice(0, 2)}******${String(mobile).slice(-2)} (Dev Mode: ${otp})`);
    }
    return {
      delivered: false,
      mode: 'development-log',
      provider: 'none'
    };
  }

  const token = getPay4SmsToken();
  if (!token) {
    throw new Error('Pay4SMS is enabled but PAY4SMS_TOKEN is not configured.');
  }

  if (!isConfigured()) {
    throw new Error('Pay4SMS configuration is incomplete. Check PAY4SMS token, credit, sender, template ID, and SMS message template.');
  }

  const message = buildOtpMessage(otp);
  const url = buildPay4SmsUrl(mobile, message);

  // Keep credentials and OTP private in logs.
  const maskedMobile = `${String(mobile).slice(0, 2)}******${String(mobile).slice(-2)}`;
  console.log(`[SMS PROD] Sending OTP SMS to +91 ${maskedMobile} via Pay4SMS.`);
  console.log(`[SMS PROD] Pay4SMS request: ${redactPay4SmsUrl(url)}`);

  const provider = await requestPay4Sms(url);

  return {
    delivered: true,
    mode: 'pay4sms',
    provider: 'pay4sms',
    statusCode: provider.statusCode,
    providerResponse: provider.body
  };
}

module.exports = {
  get SMS_PROVIDER_ENABLED() { return getSmsProviderEnabled(); },
  get PAY4SMS_BASE_URL() { return getPay4SmsBaseUrl(); },
  get PAY4SMS_CREDIT() { return getPay4SmsCredit(); },
  get PAY4SMS_SENDER() { return getPay4SmsSender(); },
  get PAY4SMS_TEMPLATE_ID() { return getPay4SmsTemplateId(); },
  get SMS_MESSAGE_TEMPLATE() { return getSmsMessageTemplate(); },
  isConfigured,
  getSmsConfigSummary,
  buildOtpMessage,
  buildPay4SmsUrl,
  sendSmsOtp,
  providerBodyLooksLikeFailure
};
