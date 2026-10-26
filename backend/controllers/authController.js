const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SMS_PROVIDER_ENABLED, sendSmsOtp } = require('../utils/smsProvider');

const ACCESS_FILE = path.join(__dirname, '..', 'data', 'access-control.json');

// In-memory OTP, Cooldown and Rate-Limit Store
const otpStore = new Map();
const cooldownStore = new Map();
const rateLimitStore = new Map();
const recentOtpStore = new Map(); // mobile -> recently issued OTPs (prevents immediate/recent reuse)

// Configuration Constants
const OTP_EXPIRY_MS = Number(process.env.OTP_EXPIRY_MS) || 10 * 60 * 1000; // 10 minutes
const OTP_LENGTH = 4; // Keep the existing 4-digit login UI unchanged
const MAX_VERIFY_ATTEMPTS = 3; // Maximum failed verification attempts
const RESEND_COOLDOWN_MS = Number.isFinite(Number(process.env.RESEND_COOLDOWN_MS)) ? Number(process.env.RESEND_COOLDOWN_MS) : 90 * 1000; // 1 minute 30 seconds
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const MAX_REQUESTS_PER_WINDOW = Number.isFinite(Number(process.env.MAX_REQUESTS_PER_WINDOW)) ? Number(process.env.MAX_REQUESTS_PER_WINDOW) : 5; // Max 5 requests per 15 minutes
const RECENT_OTP_HISTORY_SIZE = 100; // Avoid reissuing a recently used/generated OTP for the same mobile

// Development-only shared OTP. It is used only when Pay4SMS delivery is disabled.
// Once SMS_PROVIDER_ENABLED=true, every OTP request uses a fresh random OTP,
// even when NODE_ENV=development, so the real SMS login path behaves like production.
const DEV_SHARED_OTP = String(process.env.DEV_SHARED_OTP || '1234');

// Default checking account: Super Admin (SA-001 / OTP 1234)
const DEFAULT_CHECK_MOBILE = '9999999990';
const DEFAULT_CHECK_OTP = '1234';
const DEFAULT_SUPER_ADMIN_USER = {
  id: 'USR-001',
  name: 'Super Admin',
  employeeId: 'SA-001',
  email: 'superadmin@asicrm.local',
  mobile: '9999999990',
  role: 'SUPER_ADMIN',
  status: 'Active'
};

function isDefaultCheckAccount(mobile, user) {
  // When SMS provider is active, all users (including Super Admin) must receive real SMS OTP
  if (SMS_PROVIDER_ENABLED) return false;
  // Offline fallback only when SMS provider is disabled
  return mobile === DEFAULT_CHECK_MOBILE;
}

function readAccessData() {
  try {
    return JSON.parse(fs.readFileSync(ACCESS_FILE, 'utf8'));
  } catch {
    return { users: [], roles: [], permissions: {} };
  }
}

function findUserByMobile(mobile) {
  const data = readAccessData();
  let user = (data.users || []).find((item) => String(item.mobile || '') === mobile);
  if (!user && mobile === DEFAULT_CHECK_MOBILE) {
    user = DEFAULT_SUPER_ADMIN_USER;
  }
  return { data, user };
}

function roleDetails(data, roleKey) {
  const normalizedKey = String(roleKey || '').trim().toUpperCase();
  const role = (data.roles || []).find((item) => String(item.key || '').trim().toUpperCase() === normalizedKey) || {};
  return {
    permissions: data.permissions?.[normalizedKey] || {}
  };
}

function publicUser(data, user) {
  const safe = { ...user };
  delete safe.devOtp;
  return { ...safe, ...roleDetails(data, user.role) };
}

function rememberRecentOtp(mobile, otp) {
  const history = recentOtpStore.get(mobile) || [];
  const nextHistory = [String(otp), ...history.filter((item) => item !== String(otp))].slice(0, RECENT_OTP_HISTORY_SIZE);
  recentOtpStore.set(mobile, nextHistory);
}

function getRecentOtps(mobile) {
  return recentOtpStore.get(mobile) || [];
}

function generateOtp(mobile) {
  const { user } = findUserByMobile(mobile);
  // Always return the default check OTP for designated check accounts
  if (isDefaultCheckAccount(mobile, user)) {
    return DEFAULT_CHECK_OTP;
  }

  // Keep the shared OTP only for local development when real SMS delivery is disabled.
  if (!SMS_PROVIDER_ENABLED && process.env.NODE_ENV !== 'production') {
    return DEV_SHARED_OTP;
  }

  // Real OTP mode: cryptographically random and never equal to a recently issued OTP
  // for the same mobile number.
  const recent = new Set(getRecentOtps(mobile));
  let otp;
  do {
    otp = String(crypto.randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH));
  } while (recent.has(otp));

  return otp;
}

/**
 * Clean up expired OTP and rate limit entries
 */
function cleanupExpired() {
  const now = Date.now();
  for (const [mobile, record] of otpStore.entries()) {
    if (now > record.expiresAt) {
      otpStore.delete(mobile);
    }
  }
  for (const [mobile, history] of rateLimitStore.entries()) {
    const valid = history.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (valid.length === 0) rateLimitStore.delete(mobile);
    else rateLimitStore.set(mobile, valid);
  }
  for (const [mobile, lastSent] of cooldownStore.entries()) {
    if (now - lastSent > RESEND_COOLDOWN_MS) {
      cooldownStore.delete(mobile);
    }
  }
}

/**
 * POST /api/auth/send-otp
 */
const sendOtp = async (req, res) => {
  cleanupExpired();
  try {
    const mobile = String(req.body?.mobile || '').replace(/\D/g, '').slice(-10);
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number.' });
    }

    const { user } = findUserByMobile(mobile);
    if (!user || user.status !== 'Active') {
      return res.status(403).json({ success: false, message: 'No active ASICRM user is registered for this mobile number.' });
    }

    // Offline fallback account: ONLY active when SMS_PROVIDER_ENABLED is false
    if (isDefaultCheckAccount(mobile, user)) {
      otpStore.set(mobile, {
        otp: DEFAULT_CHECK_OTP,
        userId: user.id,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        attempts: 0
      });
      cooldownStore.delete(mobile);
      rateLimitStore.delete(mobile);
      const resPayload = {
        success: true,
        message: 'OTP sent successfully.',
        resendCooldownSeconds: 0
      };
      if (process.env.NODE_ENV !== 'production' && !SMS_PROVIDER_ENABLED) {
        resPayload.devOtp = DEFAULT_CHECK_OTP;
      }
      return res.json(resPayload);
    }

    const now = Date.now();

    // 1. Check Resend Cooldown
    const lastSentAt = cooldownStore.get(mobile);
    if (lastSentAt && now - lastSentAt < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (now - lastSentAt)) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitSec} second${waitSec === 1 ? '' : 's'} before requesting another OTP.`,
        retryAfterSeconds: waitSec
      });
    }

    // 2. Check Window Rate Limit
    const history = (rateLimitStore.get(mobile) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (history.length >= MAX_REQUESTS_PER_WINDOW) {
      return res.status(429).json({
        success: false,
        message: 'Too many OTP requests. Please wait a few minutes before trying again.'
      });
    }
    history.push(now);
    rateLimitStore.set(mobile, history);
    cooldownStore.set(mobile, now);

    // 3. Generate the OTP.
    // Real Pay4SMS mode always uses a fresh random OTP, including development mode.
    // Shared 1234 is retained only when SMS delivery is disabled for local testing.
    const otp = generateOtp(mobile);

    otpStore.set(mobile, {
      otp,
      userId: user.id,
      createdAt: now,
      expiresAt: now + OTP_EXPIRY_MS,
      attempts: 0
    });

    try {
      await sendSmsOtp(mobile, otp);
      rememberRecentOtp(mobile, otp);
    } catch (smsError) {
      // Do not leave a usable OTP behind when delivery fails.
      otpStore.delete(mobile);
      cooldownStore.delete(mobile);
      console.error('SMS delivery failed:', smsError.message || smsError);
      return res.status(502).json({
        success: false,
        message: 'Unable to send OTP right now. Please try again.'
      });
    }

    const responsePayload = {
      success: true,
      message: 'OTP sent successfully.',
      resendCooldownSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000)
    };

    // In development-log mode, expose the shared OTP to make local testing easy.
    // Once Pay4SMS is enabled, the OTP must be obtained from the SMS instead.
    if (process.env.NODE_ENV !== 'production' && !SMS_PROVIDER_ENABLED) {
      responsePayload.devOtp = DEV_SHARED_OTP;
    }

    return res.json(responsePayload);
  } catch (error) {
    console.error('Error sending OTP:', error.message || error);
    return res.status(500).json({ success: false, message: 'Server error occurred while sending OTP.' });
  }
};

/**
 * POST /api/auth/verify-otp
 */
const verifyOtp = (req, res) => {
  cleanupExpired();
  try {
    const mobile = String(req.body?.mobile || '').replace(/\D/g, '').slice(-10);
    const otp = String(req.body?.otp || '').trim();
    if (!/^\d{10}$/.test(mobile) || !/^\d{4}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'Mobile number and 4-digit OTP are required.' });
    }

    // Default checking account: Super Admin with OTP 1234 always verifies directly
    const found = findUserByMobile(mobile);
    if (isDefaultCheckAccount(mobile, found.user) && otp === DEFAULT_CHECK_OTP) {
      otpStore.delete(mobile);
      if (found.user && found.user.status === 'Active') {
        return res.json({
          success: true,
          message: 'Login successful.',
          mobile,
          user: publicUser(found.data, found.user)
        });
      }
    }

    const record = otpStore.get(mobile);
    if (!record || Date.now() > record.expiresAt) {
      otpStore.delete(mobile);
      return res.status(400).json({ success: false, message: 'OTP has expired or was not requested. Please request a new OTP.' });
    }

    // Track verification attempts
    record.attempts = (record.attempts || 0) + 1;

    if (record.otp !== otp) {
      if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
        otpStore.delete(mobile);
        return res.status(429).json({
          success: false,
          message: 'Too many failed attempts. This OTP has been invalidated. Please request a new OTP.'
        });
      }
      const remaining = MAX_VERIFY_ATTEMPTS - record.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
      });
    }

    // Successful Verification -> Invalidate single-use OTP immediately
    otpStore.delete(mobile);

    const { data, user } = findUserByMobile(mobile);
    if (!user || user.status !== 'Active') {
      return res.status(403).json({ success: false, message: 'User account is inactive or unavailable.' });
    }

    return res.json({
      success: true,
      message: 'Login successful.',
      mobile,
      user: publicUser(data, user)
    });
  } catch (error) {
    console.error('Error during verification:', error.message || error);
    return res.status(500).json({ success: false, message: 'Server error during verification.' });
  }
};

module.exports = { sendOtp, verifyOtp };

