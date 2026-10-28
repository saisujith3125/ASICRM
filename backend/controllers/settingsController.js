const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { hasPermission, getCurrentUser } = require('../utils/accessControl');
const { normalizeWarehouseLayout, createDefaultLayout } = require('../utils/warehouseLayoutHelper');
const { sequenceService } = require('../services/sequenceService');
const { dateSettingsService } = require('../services/dateSettingsService');
const { sendSmsOtp } = require('../utils/smsProvider');

const DATA_FILE = path.join(__dirname, '..', 'data', 'access-control.json');
const PROTECTED_ROLE = 'SUPER_ADMIN';

// High-Security In-Memory OTP Store & Verified Backup Session Registry
const databaseOtpStore = new Map(); // key: "BACKUP:<userId>" or "CLEAR:<userId>" -> { otp, mobile, createdAt, expiresAt }
const verifiedBackupSessions = new Map(); // key: "<userId>" -> { backupId, timestamp, expiresAt }

function getSuperAdminMobile(req) {
  const user = getCurrentUser(req);
  let mobile = String(user.mobile || '').replace(/\D/g, '').slice(-10);
  if (!mobile || mobile.length !== 10) {
    const data = readData();
    const u = (data.users || []).find((item) => item.id === user.id);
    if (u && u.mobile) mobile = String(u.mobile).replace(/\D/g, '').slice(-10);
  }
  return { user, mobile: /^\d{10}$/.test(mobile) ? mobile : null };
}

const defaultCompanySettings = {
  companyName: 'Active System Integration',
  siteShortName: 'ASI',
  legalName: 'Active System Integration',
  iso: 'ISO 9001:2015 Certified',
  address: 'Plot No. 10A, Perumal Kovil Street, Sivabootham, Vanagaram, Chennai - 600095',
  street: 'Plot No. 10A, Perumal Kovil Street',
  street2: 'Sivabootham, Vanagaram',
  city: 'Chennai',
  state: 'Tamil Nadu',
  country: 'India',
  zipCode: '600095',
  phone: '09994126666',
  mobile: '9894326666,9150026666,9171126666',
  email: 'admin@asi.ind.in',
  website: 'https://asiind.com/',
  gstin: '33AZPPS7068A1Z4',
  gstRegistrationType: 'Registered',
  financialYearRef: 'ASI/26-27',
  theme: 'Green',
  defaultLanguage: 'English(US)',
  defaultCurrency: 'Rs',
  termsAndConditions: 'Request Payment by Demand Draft / AC Payee Only If any clarification in the above details please inform within seven days. We declare that this invoice shows the actual price of the goods described and all the particulars mentioned are true and correct.',
  quotationTerms: 'Note : Prices quoted are valid for 7 days.',
  logoUrl: null,
  masterLogoSize: 180,
  quotationLogoSize: 152,
  dcLogoSize: 116,
  logoSize: 180,
  signatureUrl: null,
  sealUrl: null,
  bankName: 'HDFC BANK',
  accountName: 'ACTIVE SYSTEM INTEGRATION',
  accountNumber: '50200028741215',
  ifscCode: 'HDFC0000024',
  branch: 'ANNA NAGAR, CHENNAI',
  proformaNote: 'Kindly verify item model/specifications before release of PO/payment.',
  paymentTerms: '100% ADVANCE PAYMENT',
  deliveryTerms: 'EX-STOCK / 1-2 WEEKS',
  validityTerms: '15 DAYS FROM INVOICE DATE',
  locations: [
    { id: 'LOC-001', code: 'CHN-HO', name: 'Chennai Head Office', address: 'Plot No. 10A, Perumal Kovil Street, Sivabootham, Vanagaram', city: 'Chennai', state: 'Tamil Nadu', pincode: '600095', isPrimary: true, status: 'Active' },
    { id: 'LOC-002', code: 'CBE-BR', name: 'Coimbatore Branch Office', address: '142, Cross Cut Road, Gandhipuram', city: 'Coimbatore', state: 'Tamil Nadu', pincode: '641012', isPrimary: false, status: 'Active' },
    { id: 'LOC-003', code: 'BLR-HUB', name: 'Bengaluru Tech Hub', address: '88, 5th Main, 4th Block, Rajajinagar', city: 'Bengaluru', state: 'Karnataka', pincode: '560010', isPrimary: false, status: 'Active' }
  ],
  branches: [
    { id: 'BR-001', code: 'CHN-01', name: 'Chennai Central', locationId: 'LOC-001', manager: 'Super Admin', phone: '09994126666', email: 'chennai@asi.ind.in', status: 'Active' },
    { id: 'BR-002', code: 'CBE-01', name: 'Coimbatore South', locationId: 'LOC-002', manager: 'Rajesh Kumar', phone: '9876543211', email: 'cbe@asi.ind.in', status: 'Active' },
    { id: 'BR-003', code: 'BLR-01', name: 'Bengaluru West', locationId: 'LOC-003', manager: 'Sarah Jenkins', phone: '9700112234', email: 'bangalore@asi.ind.in', status: 'Active' }
  ],
  warehouses: [
    { id: 'WH-001', code: 'WH-CHN-01', name: 'Main Central Hub', location: 'Vanagaram, Chennai', capacity: '10,000 sq ft', manager: 'Vijay', isDefault: true, status: 'Active' },
    { id: 'WH-002', code: 'WH-CHN-02', name: 'North Chennai Transit Godown', location: 'Ambattur Industrial Estate', capacity: '5,000 sq ft', manager: 'Gokul', isDefault: false, status: 'Active' },
    { id: 'WH-003', code: 'WH-CBE-01', name: 'Coimbatore Logistics Depot', location: 'Peelamedu, Coimbatore', capacity: '4,500 sq ft', manager: 'Rajesh Kumar', isDefault: false, status: 'Active' }
  ],
  invoiceSetup: {
    prefix: 'ASI/INV/',
    suffix: '/26-27',
    startingNumber: 1001,
    nextNumber: 1042,
    paddingDigits: 4,
    headerTitle: 'TAX INVOICE',
    showLogo: true,
    showSeal: true,
    showSignature: true,
    showBankDetails: true,
    showQrCode: true,
    defaultNotes: 'Request Payment by Demand Draft / AC Payee Only. If any clarification in the above details please inform within seven days.',
    defaultTerms: '1. Payment due within agreed credit terms from invoice date.\n2. Interest @ 18% p.a. will be charged on overdue payments.\n3. Goods once sold will not be accepted back without prior RMA approval.\n4. All disputes are subject to Chennai jurisdiction only.'
  },
  quotationSetup: {
    prefix: 'ASI/QTN/',
    suffix: '/26-27',
    startingNumber: 101,
    nextNumber: 135,
    paddingDigits: 3,
    validityDays: 7,
    headerTitle: 'QUOTATION',
    showLogo: true,
    showSeal: true,
    showSignature: true,
    showBankDetails: true,
    logoSize: 170,
    defaultNotes: 'Note: Prices quoted are valid for 7 days. Taxes extra as applicable.',
    defaultTerms: '1. Prices are valid for 7 days from quote date.\n2. Delivery: Ex-stock / 1-2 weeks upon receipt of confirmed purchase order.\n3. Payment: 100% advance or as agreed in commercial proposal.\n4. Warranty: Standard manufacturer warranty applies.'
  },
  dcSetup: {
    prefix: 'ASI/DC/',
    suffix: '/26-27',
    startingNumber: 1,
    nextNumber: 29,
    paddingDigits: 3,
    headerTitle: 'DELIVERY CHALLAN',
    showLogo: true,
    logoSize: 116,
    showSeal: true,
    showSignature: true,
    defaultNotes: 'Goods dispatched for delivery / installation. Received the above goods in good order and condition.',
    returnableTerms: 'Returnable DC must be returned within 15 days of dispatch in undamaged original condition.'
  },
  pdfSettings: {
    pageSize: 'A4',
    orientation: 'Portrait',
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 10,
    marginRight: 10,
    primaryColor: '#2563eb',
    fontFamily: 'Inter, system-ui, sans-serif',
    showPageNumbers: true,
    printDraftWatermark: false
  },
  emailSetup: {
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    encryption: 'TLS',
    senderName: 'Active System Integration',
    senderEmail: 'admin@asi.ind.in',
    replyToEmail: 'support@asi.ind.in',
    authRequired: true,
    username: 'admin@asi.ind.in',
    status: 'Configured'
  },
  smsSetup: {
    provider: 'Fast2SMS',
    senderId: 'ASICRM',
    apiKey: '••••••••••••••••',
    dltEntityId: '11015248900000',
    status: 'Active',
    enableOrderAlerts: true,
    enableDispatchAlerts: true
  },
  paymentMethods: [
    { id: 'PM-001', code: 'BANK', name: 'Bank Transfer (NEFT / RTGS / IMPS)', type: 'Bank', isDefault: true, status: 'Active', details: 'INDUSIND BANK / HDFC BANK - A/C 50200028741215 - IFSC HDFC0000024' },
    { id: 'PM-002', code: 'CHEQUE', name: 'Cheque / Demand Draft', type: 'Offline', isDefault: false, status: 'Active', details: 'Payable at Chennai in favor of ACTIVE SYSTEM INTEGRATION' },
    { id: 'PM-003', code: 'UPI', name: 'UPI / QR Code', type: 'Digital', isDefault: false, status: 'Active', details: 'asi@hdfcbank' },
    { id: 'PM-004', code: 'CASH', name: 'Cash', type: 'Cash', isDefault: false, status: 'Active', details: 'Direct cash receipt on counter' },
    { id: 'PM-005', code: 'CARD', name: 'Credit / Debit Card (POS)', type: 'POS', isDefault: false, status: 'Active', details: 'Merchant POS Terminal' }
  ],
  currency: {
    baseCurrency: 'INR',
    symbol: '₹',
    code: 'INR',
    name: 'Indian Rupee (INR)',
    decimalPlaces: 2,
    format: 'en-IN'
  },
  taxSetup: {
    gstin: '33AZPPS7068A1Z4',
    stateCode: '33',
    stateName: 'Tamil Nadu',
    defaultGstRate: 18,
    rates: [0, 5, 12, 18, 28],
    enableCompositeScheme: false,
    enableRcm: true,
    ewayBillThreshold: 50000
  },
  discountSetup: {
    maxDiscountPercent: 25,
    approvalRequiredAbove: 15,
    allowLineItemDiscount: true,
    allowGlobalDiscount: true,
    defaultDiscountType: 'Percentage'
  },
  defaultProductUnit: 'Nos',
  productUnits: [
    { id: 'Nos', name: 'Nos', isDefault: true, status: 'Active' },
    { id: 'Box', name: 'Box', isDefault: false, status: 'Active' },
    { id: 'Set', name: 'Set', isDefault: false, status: 'Active' },
    { id: 'Meter', name: 'Meter', isDefault: false, status: 'Active' },
    { id: 'Roll', name: 'Roll', isDefault: false, status: 'Active' }
  ]
};

const defaultData = { users: [], roles: [], permissions: {}, companySettings: defaultCompanySettings };

const PERMISSION_CATALOG = {
  Enquiries: ['View', 'Create', 'Edit', 'Follow Up', 'Close'],
  Customers: ['View', 'Create', 'Edit', 'Delete', 'View History', 'Manage Branches'],
  Quotations: ['View', 'Create', 'Edit', 'Download', 'Approve', 'Reject', 'Convert to Order'],
  'Orders & Deals': ['View', 'Create', 'Edit', 'Delete', 'Close'],
  'Delivery Challans': ['View', 'Create', 'Edit', 'Dispatch', 'Deliver', 'Return', 'Delete'],
  'Purchase Orders': ['View', 'Create', 'Edit', 'Receive Goods', 'Download', 'Approve', 'Delete'],
  Stocks: ['View', 'Create', 'Edit', 'Delete'],
  'User Administration': ['View Users', 'Create Users', 'Edit Users', 'Disable Users', 'Manage Roles', 'Manage Permissions']
};

function ensureData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
  }
}

function mergeCompanySettings(parsed = {}) {
  const source = parsed && typeof parsed === 'object' ? parsed : {};
  return {
    ...defaultCompanySettings,
    ...source,
    locations: Array.isArray(source.locations) && source.locations.length > 0 ? source.locations : defaultCompanySettings.locations,
    branches: Array.isArray(source.branches) && source.branches.length > 0 ? source.branches : defaultCompanySettings.branches,
    warehouses: (Array.isArray(source.warehouses) && source.warehouses.length > 0 ? source.warehouses : defaultCompanySettings.warehouses).map(normalizeWarehouseLayout),
    productUnits: Array.isArray(source.productUnits) && source.productUnits.length > 0 ? source.productUnits : defaultCompanySettings.productUnits,
    defaultProductUnit: source.defaultProductUnit || 'Nos',
    invoiceSetup: { ...defaultCompanySettings.invoiceSetup, ...(source.invoiceSetup || {}) },
    quotationSetup: { ...defaultCompanySettings.quotationSetup, ...(source.quotationSetup || {}) },
    dcSetup: { ...defaultCompanySettings.dcSetup, ...(source.dcSetup || {}) },
    pdfSettings: { ...defaultCompanySettings.pdfSettings, ...(source.pdfSettings || {}) },
    emailSetup: { ...defaultCompanySettings.emailSetup, ...(source.emailSetup || {}) },
    smsSetup: { ...defaultCompanySettings.smsSetup, ...(source.smsSetup || {}) },
    paymentMethods: Array.isArray(source.paymentMethods) && source.paymentMethods.length > 0 ? source.paymentMethods : defaultCompanySettings.paymentMethods,
    currency: { ...defaultCompanySettings.currency, ...(source.currency || {}) },
    taxSetup: { ...defaultCompanySettings.taxSetup, ...(source.taxSetup || {}) },
    discountSetup: { ...defaultCompanySettings.discountSetup, ...(source.discountSetup || {}) }
  };
}

function readData() {
  ensureData();
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      roles: Array.isArray(parsed.roles)
        ? parsed.roles.map((role) => {
            const { scope, limits, ...cleanRole } = role || {};
            return cleanRole;
          })
        : [],
      permissions: parsed.permissions && typeof parsed.permissions === 'object' ? parsed.permissions : {},
      companySettings: mergeCompanySettings(parsed.companySettings)
    };
  } catch (err) {
    console.error('Failed to read access-control.json:', err);
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      if (raw.trim().length > 0) {
        console.error('Preserving existing DATA_FILE despite parse error');
      }
    } catch {}
    return {
      users: [],
      roles: [],
      permissions: {},
      companySettings: defaultCompanySettings
    };
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  try {
    const { syncSettingsToMongo } = require('../services/mongoSyncService');
    syncSettingsToMongo(data.companySettings);
  } catch (err) {
    // Non-blocking fallback
  }
}

function roleKeyOf(role) {
  return String(role?.key || '').trim().toUpperCase();
}

function roleByKey(data, key) {
  const normalized = String(key || '').trim().toUpperCase();
  return data.roles.find((role) => roleKeyOf(role) === normalized);
}

function sanitizeUser(user) {
  const { devOtp, ...safe } = user;
  return safe;
}

function normalizeRoleItem(role, index) {
  return {
    id: role.id || `ROLE-${String(index + 1).padStart(3, '0')}`,
    key: roleKeyOf(role.name ? { key: role.key || role.name } : role),
    name: String(role.name || role.key || ''),
    description: String(role.description || '')
  };
}

function uniqueId(prefix, items, field) {
  let counter = items.length + 1;
  let id = `${prefix}-${String(counter).padStart(3, '0')}`;
  while (items.some((item) => item[field] === id)) {
    counter += 1;
    id = `${prefix}-${String(counter).padStart(3, '0')}`;
  }
  return id;
}

function isSuperAdmin(req) {
  return getCurrentUser(req)?.role === PROTECTED_ROLE;
}

function settingsAccess(req) {
  if (isSuperAdmin(req)) return true;
  return hasPermission(req, 'User Administration', 'View Users')
    || hasPermission(req, 'User Administration', 'Create Users')
    || hasPermission(req, 'User Administration', 'Edit Users')
    || hasPermission(req, 'User Administration', 'Manage Roles')
    || hasPermission(req, 'User Administration', 'Manage Permissions');
}

function requireSettingsAccess(req, res) {
  if (settingsAccess(req)) return true;
  res.status(403).json({ success: false, message: 'You do not have permission to access system settings.' });
  return false;
}

function requireSettingsPermission(req, res, action) {
  if (isSuperAdmin(req) || hasPermission(req, 'User Administration', action)) return true;
  res.status(403).json({ success: false, message: `You do not have permission to ${action.replace(' Users', ' users').replace('Manage ', 'manage ')}.` });
  return false;
}

function getSettings(req, res) {
  if (!requireSettingsAccess(req, res)) return;

  const data = readData();
  const safeRoles = data.roles.map(normalizeRoleItem);
  safeRoles.forEach((role) => {
    if (!data.permissions[role.key]) data.permissions[role.key] = {};
  });
  writeData(data);

  return res.json({
    success: true,
    data: {
      users: data.users.map(sanitizeUser),
      roles: safeRoles,
      permissions: data.permissions,
      permissionCatalog: PERMISSION_CATALOG,
      companySettings: {
        ...(data.companySettings || defaultCompanySettings),
        dateFormatSettings: dateSettingsService.getSummary()
      }
    }
  });
}

function createUser(req, res) {
  if (!requireSettingsPermission(req, res, 'Create Users')) return;

  const body = req.body || {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const mobile = String(body.mobile || '').replace(/\D/g, '').slice(-10);
  const employeeId = String(body.employeeId || '').trim();
  const role = String(body.role || '').trim().toUpperCase();
  const status = body.status === 'Inactive' ? 'Inactive' : 'Active';

  if (!name || !email) return res.status(400).json({ success: false, message: 'Name and email are required.' });
  if (!/^\d{10}$/.test(mobile)) return res.status(400).json({ success: false, message: 'A unique 10-digit mobile number is required.' });
  if (!role) return res.status(400).json({ success: false, message: 'A role is required.' });

  const data = readData();
  if (!roleByKey(data, role)) return res.status(400).json({ success: false, message: 'Selected role does not exist.' });

  if (role === PROTECTED_ROLE && !isSuperAdmin(req)) {
    return res.status(403).json({ success: false, message: 'Only Super Admin can create a Super Admin.' });
  }
  if (data.users.some((item) => String(item.email).toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ success: false, message: 'A user with this email already exists.' });
  }
  if (data.users.some((item) => String(item.mobile || '') === mobile)) {
    return res.status(409).json({ success: false, message: 'This mobile number is already assigned to another user.' });
  }
  if (employeeId && data.users.some((item) => String(item.employeeId || '').toLowerCase() === employeeId.toLowerCase())) {
    return res.status(409).json({ success: false, message: 'This employee ID is already assigned.' });
  }

  const item = {
    id: uniqueId('USR', data.users, 'id'),
    name,
    employeeId,
    email,
    mobile,
    role,
    status
  };

  data.users.push(item);
  writeData(data);
  return res.status(201).json({ success: true, data: sanitizeUser(item) });
}

function updateUser(req, res) {
  if (!requireSettingsPermission(req, res, 'Edit Users')) return;

  const userId = String(req.params.userId || '');
  const data = readData();
  const index = data.users.findIndex((user) => user.id === userId);
  if (index < 0) return res.status(404).json({ success: false, message: 'User not found.' });

  const existing = data.users[index];
  const body = req.body || {};
  const nextRole = String(body.role || existing.role).trim().toUpperCase();
  const nextStatus = body.status === 'Inactive' ? 'Inactive' : 'Active';
  const mobile = String(body.mobile ?? existing.mobile ?? '').replace(/\D/g, '').slice(-10);

  if (!roleByKey(data, nextRole)) return res.status(400).json({ success: false, message: 'Selected role does not exist.' });
  if (!/^\d{10}$/.test(mobile)) return res.status(400).json({ success: false, message: 'A unique 10-digit mobile number is required.' });

  const existingRole = roleKeyOf({ key: existing.role });
  const currentId = String(req.headers['x-user-id'] || '');
  if (existingRole === PROTECTED_ROLE && !isSuperAdmin(req)) {
    return res.status(403).json({ success: false, message: 'Only Super Admin can edit the Super Admin account.' });
  }
  if (nextRole === PROTECTED_ROLE && !isSuperAdmin(req)) {
    return res.status(403).json({ success: false, message: 'Only Super Admin can assign the Super Admin role.' });
  }

  // Safety rule: At least one active Super Admin must always exist in the organization
  if (existingRole === PROTECTED_ROLE && existing.status === 'Active') {
    if (nextRole !== PROTECTED_ROLE || nextStatus !== 'Active') {
      const otherActiveSuperAdmins = data.users.filter((item) =>
        item.id !== userId &&
        roleKeyOf({ key: item.role }) === PROTECTED_ROLE &&
        item.status === 'Active'
      );
      if (otherActiveSuperAdmins.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot demote or deactivate the only active Super Admin. Please promote another user to Super Admin first, or use Transfer Super Admin.'
        });
      }
    }
  }

  if (data.users.some((item) => item.id !== userId && String(item.mobile || '') === mobile)) {
    return res.status(409).json({ success: false, message: 'This mobile number is already assigned to another user.' });
  }

  const nextEmail = String(body.email ?? existing.email).trim();
  if (!nextEmail) return res.status(400).json({ success: false, message: 'Email is required.' });
  if (data.users.some((item) => item.id !== userId && String(item.email).toLowerCase() === nextEmail.toLowerCase())) {
    return res.status(409).json({ success: false, message: 'This email is already assigned to another user.' });
  }
  const nextEmployeeId = String(body.employeeId ?? existing.employeeId ?? '').trim();
  if (nextEmployeeId && data.users.some((item) => item.id !== userId && String(item.employeeId || '').toLowerCase() === nextEmployeeId.toLowerCase())) {
    return res.status(409).json({ success: false, message: 'This employee ID is already assigned.' });
  }

  const next = {
    ...existing,
    name: String(body.name ?? existing.name).trim(),
    employeeId: nextEmployeeId,
    email: nextEmail,
    mobile,
    role: nextRole,
    status: nextStatus
  };

  data.users[index] = next;
  writeData(data);
  return res.json({ success: true, data: sanitizeUser(next) });
}

function transferSuperAdmin(req, res) {
  if (!isSuperAdmin(req)) {
    return res.status(403).json({ success: false, message: 'Only an active Super Admin can transfer Super Admin privileges.' });
  }

  const currentUserId = String(req.headers['x-user-id'] || '').trim();
  const body = req.body || {};
  const targetUserId = String(body.targetUserId || '').trim();
  const selfAction = String(body.selfAction || 'demote_admin').toLowerCase(); // 'demote_admin' | 'demote_employee' | 'deactivate' | 'leave'

  if (!targetUserId) {
    return res.status(400).json({ success: false, message: 'Please select a member to transfer Super Admin privileges to.' });
  }
  if (targetUserId === currentUserId) {
    return res.status(400).json({ success: false, message: 'You are already a Super Admin. Select another member to transfer privileges to.' });
  }

  const data = readData();
  const targetIndex = data.users.findIndex((u) => u.id === targetUserId);
  if (targetIndex < 0) {
    return res.status(404).json({ success: false, message: 'Selected target user was not found.' });
  }

  const targetUser = data.users[targetIndex];
  if (targetUser.status !== 'Active') {
    return res.status(400).json({ success: false, message: 'Selected user is inactive. Only active members can receive Super Admin privileges.' });
  }

  const currentIndex = data.users.findIndex((u) => u.id === currentUserId);
  if (currentIndex < 0) {
    return res.status(404).json({ success: false, message: 'Current user not found.' });
  }

  // 1. Promote target user to Super Admin
  targetUser.role = PROTECTED_ROLE;
  targetUser.status = 'Active';
  data.users[targetIndex] = targetUser;

  // 2. Perform selfAction on caller
  let currentUser = data.users[currentIndex];
  let selfMessage = '';

  if (selfAction === 'demote_employee') {
    currentUser.role = 'EMPLOYEE';
    selfMessage = 'You have stepped down to Employee.';
  } else if (selfAction === 'deactivate') {
    currentUser.status = 'Inactive';
    selfMessage = 'Your account has been deactivated.';
  } else if (selfAction === 'leave') {
    data.users.splice(currentIndex, 1);
    currentUser = null;
    selfMessage = 'You have left the organization.';
  } else {
    // Default: demote_admin
    currentUser.role = 'ADMIN';
    selfMessage = 'You have stepped down to Admin.';
  }

  if (currentUser && selfAction !== 'leave') {
    data.users[currentIndex] = currentUser;
  }

  writeData(data);

  return res.json({
    success: true,
    message: `Super Admin privileges successfully transferred to ${targetUser.name}. ${selfMessage}`,
    data: {
      transferredTo: sanitizeUser(targetUser),
      self: currentUser ? sanitizeUser(currentUser) : null,
      selfAction
    }
  });
}

function deleteUser(req, res) {
  if (!isSuperAdmin(req) && !hasPermission(req, 'User Administration', 'Edit Users')) {
    return res.status(403).json({ success: false, message: 'You do not have permission to delete users.' });
  }

  const userId = String(req.params.userId || '').trim();
  const currentUserId = String(req.headers['x-user-id'] || '').trim();
  const data = readData();
  const index = data.users.findIndex((u) => u.id === userId);
  if (index < 0) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  const target = data.users[index];
  const targetRole = roleKeyOf({ key: target.role });

  // If deleting an active Super Admin, verify at least one other active Super Admin remains
  if (targetRole === PROTECTED_ROLE && target.status === 'Active') {
    const otherActiveSuperAdmins = data.users.filter((u) =>
      u.id !== userId &&
      roleKeyOf({ key: u.role }) === PROTECTED_ROLE &&
      u.status === 'Active'
    );
    if (otherActiveSuperAdmins.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the only active Super Admin. Please promote or transfer Super Admin to another member first.'
      });
    }
  }

  const deletedName = target.name;
  data.users.splice(index, 1);
  writeData(data);

  return res.json({
    success: true,
    message: `User ${deletedName} deleted successfully.`,
    selfDeleted: userId === currentUserId
  });
}

function createRole(req, res) {
  if (!requireSettingsPermission(req, res, 'Manage Roles')) return;

  const body = req.body || {};
  const cleanName = String(body.name || '').trim();
  const description = String(body.description || '').trim();
  if (!cleanName) return res.status(400).json({ success: false, message: 'Role name is required.' });

  const key = cleanName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!key || key === PROTECTED_ROLE) return res.status(400).json({ success: false, message: 'That role name is reserved.' });

  const data = readData();
  if (data.roles.some((role) => roleKeyOf(role) === key)) return res.status(409).json({ success: false, message: 'That role already exists.' });

  const item = { id: uniqueId('ROLE', data.roles, 'id'), key, name: cleanName, description };
  data.roles.push(item);
  data.permissions[key] = {};
  writeData(data);

  return res.status(201).json({ success: true, data: normalizeRoleItem(item, data.roles.length - 1) });
}

function updateRole(req, res) {
  if (!requireSettingsPermission(req, res, 'Manage Roles')) return;

  const roleKey = String(req.params.roleKey || '').trim().toUpperCase();
  const data = readData();
  const index = data.roles.findIndex((role) => roleKeyOf(role) === roleKey);
  if (index < 0) return res.status(404).json({ success: false, message: 'Role not found.' });
  if (roleKey === PROTECTED_ROLE) return res.status(403).json({ success: false, message: 'Super Admin role is protected.' });

  const existing = normalizeRoleItem(data.roles[index], index);
  const body = req.body || {};
  const name = String(body.name ?? existing.name).trim();
  if (!name) return res.status(400).json({ success: false, message: 'Role name is required.' });

  data.roles[index] = { ...data.roles[index], key: existing.key, name, description: String(body.description ?? existing.description).trim() };
  data.permissions[existing.key] = data.permissions[existing.key] || {};
  writeData(data);
  return res.json({ success: true, data: normalizeRoleItem(data.roles[index], index) });
}

function deleteRole(req, res) {
  if (!requireSettingsPermission(req, res, 'Manage Roles')) return;

  const roleKey = String(req.params.roleKey || '').trim().toUpperCase();
  if (!roleKey) return res.status(400).json({ success: false, message: 'Role key is required.' });
  if (roleKey === PROTECTED_ROLE) {
    return res.status(403).json({ success: false, message: 'Super Admin role is protected and cannot be deleted.' });
  }

  const data = readData();
  const index = data.roles.findIndex((role) => roleKeyOf(role) === roleKey);
  if (index < 0) return res.status(404).json({ success: false, message: 'Role not found.' });

  const assignedUsers = data.users.filter((item) => roleKeyOf({ key: item.role }) === roleKey);
  if (assignedUsers.length > 0) {
    return res.status(409).json({
      success: false,
      message: `Cannot delete this role while ${assignedUsers.length} user${assignedUsers.length === 1 ? '' : 's'} are assigned to it. Reassign those users first.`
    });
  }

  const [removed] = data.roles.splice(index, 1);
  delete data.permissions[roleKey];
  writeData(data);

  return res.json({ success: true, data: normalizeRoleItem(removed, index) });
}

function updatePermissions(req, res) {
  if (!requireSettingsPermission(req, res, 'Manage Permissions')) return;

  const roleKey = String(req.params.roleKey || '').trim().toUpperCase();
  if (roleKey === PROTECTED_ROLE) return res.status(403).json({ success: false, message: 'Super Admin permissions are protected.' });

  const data = readData();
  if (!roleByKey(data, roleKey)) return res.status(404).json({ success: false, message: 'Role not found.' });

  const incoming = req.body?.permissions;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return res.status(400).json({ success: false, message: 'A valid permission object is required.' });
  }

  const cleaned = {};
  for (const [moduleName, allowedActions] of Object.entries(incoming)) {
    if (!Object.prototype.hasOwnProperty.call(PERMISSION_CATALOG, moduleName)) continue;
    if (!Array.isArray(allowedActions)) continue;
    const allowedSet = new Set(PERMISSION_CATALOG[moduleName]);
    cleaned[moduleName] = Array.from(new Set(allowedActions.filter((action) => allowedSet.has(action))));
  }
  for (const moduleName of Object.keys(PERMISSION_CATALOG)) {
    if (!cleaned[moduleName]) cleaned[moduleName] = [];
  }

  data.permissions[roleKey] = cleaned;
  writeData(data);
  return res.json({ success: true, data: { permissions: cleaned } });
}

function resolveUser(req, res) {
  // Resolve the already-authenticated user from the server-side identity
  // header. Do not accept a mobile number from the client to select another user.
  const currentUserId = String(req.headers['x-user-id'] || '').trim();
  if (!currentUserId) {
    return res.status(401).json({ success: false, message: 'Authentication is required.' });
  }

  const data = readData();
  const found = data.users.find((item) => item.id === currentUserId && item.status === 'Active');
  if (!found) return res.status(401).json({ success: false, message: 'Authenticated user is inactive or unavailable.' });

  const roleKey = roleKeyOf({ key: found.role });

  return res.json({
    success: true,
    data: {
      ...sanitizeUser(found),
      role: roleKey,
      permissions: data.permissions[roleKey] || {},
    }
  });
}

function getCompanySettings(req, res) {
  const currentUserId = String(req.headers['x-user-id'] || '').trim();
  if (!currentUserId) {
    return res.status(401).json({ success: false, message: 'Authentication is required.' });
  }

  const data = readData();
  const companySettings = {
    ...(data.companySettings || defaultCompanySettings),
    dateFormatSettings: dateSettingsService.getSummary()
  };
  return res.json({
    success: true,
    data: companySettings
  });
}

function updateCompanySettings(req, res) {
  if (!requireSettingsAccess(req, res)) return;

  const body = req.body || {};
  const data = readData();

  const current = data.companySettings || defaultCompanySettings;
  const next = { ...current };

  if (typeof body.companyName === 'string') next.companyName = body.companyName.trim();
  if (typeof body.name === 'string') next.companyName = body.name.trim();
  if (typeof body.siteShortName === 'string') next.siteShortName = body.siteShortName.trim();
  if (typeof body.legalName === 'string') next.legalName = body.legalName.trim();
  if (typeof body.iso === 'string') next.iso = body.iso.trim();
  if (typeof body.address === 'string') next.address = body.address.trim();
  if (typeof body.street === 'string') next.street = body.street.trim();
  if (typeof body.street2 === 'string') next.street2 = body.street2.trim();
  if (typeof body.city === 'string') next.city = body.city.trim();
  if (typeof body.state === 'string') next.state = body.state.trim();
  if (typeof body.country === 'string') next.country = body.country.trim();
  if (typeof body.zipCode === 'string') next.zipCode = body.zipCode.trim();
  if (typeof body.pincode === 'string') next.zipCode = body.pincode.trim();
  if (typeof body.phone === 'string') next.phone = body.phone.trim();
  if (typeof body.mobile === 'string') next.mobile = body.mobile.trim();
  if (typeof body.email === 'string') next.email = body.email.trim();
  if (typeof body.website === 'string') next.website = body.website.trim();
  if (typeof body.gstin === 'string') next.gstin = body.gstin.trim();
  if (typeof body.gstRegistrationType === 'string') next.gstRegistrationType = body.gstRegistrationType.trim();
  if (typeof body.financialYearRef === 'string') next.financialYearRef = body.financialYearRef.trim();
  if (typeof body.theme === 'string') next.theme = body.theme.trim();
  if (typeof body.defaultLanguage === 'string') next.defaultLanguage = body.defaultLanguage.trim();
  if (typeof body.defaultCurrency === 'string') next.defaultCurrency = body.defaultCurrency.trim();
  if (typeof body.termsAndConditions === 'string') next.termsAndConditions = body.termsAndConditions.trim();
  if (typeof body.quotationTerms === 'string') next.quotationTerms = body.quotationTerms.trim();

  // Bank details
  if (typeof body.bankName === 'string') next.bankName = body.bankName.trim();
  if (typeof body.accountName === 'string') next.accountName = body.accountName.trim();
  if (typeof body.accountNumber === 'string') next.accountNumber = body.accountNumber.trim();
  if (typeof body.ifscCode === 'string') next.ifscCode = body.ifscCode.trim().toUpperCase();
  if (typeof body.branch === 'string') next.branch = body.branch.trim();

  // Proforma settings & notes
  if (typeof body.proformaNote === 'string') next.proformaNote = body.proformaNote.trim();
  if (typeof body.paymentTerms === 'string') next.paymentTerms = body.paymentTerms.trim();
  if (typeof body.deliveryTerms === 'string') next.deliveryTerms = body.deliveryTerms.trim();
  if (typeof body.validityTerms === 'string') next.validityTerms = body.validityTerms.trim();

  // Structured sections
  if (Array.isArray(body.locations)) next.locations = body.locations;
  if (Array.isArray(body.branches)) next.branches = body.branches;
  if (Array.isArray(body.warehouses)) next.warehouses = body.warehouses.map(normalizeWarehouseLayout);
  if (body.invoiceSetup && typeof body.invoiceSetup === 'object') next.invoiceSetup = { ...next.invoiceSetup, ...body.invoiceSetup };
  if (body.quotationSetup && typeof body.quotationSetup === 'object') next.quotationSetup = { ...next.quotationSetup, ...body.quotationSetup };
  if (body.dcSetup && typeof body.dcSetup === 'object') next.dcSetup = { ...next.dcSetup, ...body.dcSetup };
  if (body.pdfSettings && typeof body.pdfSettings === 'object') next.pdfSettings = { ...next.pdfSettings, ...body.pdfSettings };
  if (body.emailSetup && typeof body.emailSetup === 'object') next.emailSetup = { ...next.emailSetup, ...body.emailSetup };
  if (body.smsSetup && typeof body.smsSetup === 'object') next.smsSetup = { ...next.smsSetup, ...body.smsSetup };
  if (Array.isArray(body.paymentMethods)) next.paymentMethods = body.paymentMethods;
  if (body.currency && typeof body.currency === 'object') next.currency = { ...next.currency, ...body.currency };
  if (body.taxSetup && typeof body.taxSetup === 'object') next.taxSetup = { ...next.taxSetup, ...body.taxSetup };
  if (body.discountSetup && typeof body.discountSetup === 'object') next.discountSetup = { ...next.discountSetup, ...body.discountSetup };

  // Explicit Logo Sizing (Master, Quotation, DC)
  if (body.masterLogoSize !== undefined) next.masterLogoSize = Math.max(50, Math.min(400, Number(body.masterLogoSize) || 180));
  if (body.logoSize !== undefined) next.logoSize = Math.max(50, Math.min(400, Number(body.logoSize) || 180));
  if (body.quotationLogoSize !== undefined) next.quotationLogoSize = Math.max(50, Math.min(400, Number(body.quotationLogoSize) || 152));
  if (body.dcLogoSize !== undefined) next.dcLogoSize = Math.max(40, Math.min(300, Number(body.dcLogoSize) || 116));

  // Image validation helper
  const validateImageField = (val, label) => {
    if (val === null || val === '') return { valid: true, value: null };
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.startsWith('data:image/')) {
        const match = trimmed.match(/^data:(image\/(png|jpeg|jpg|webp|svg\+xml));base64,/);
        if (!match) {
          return { valid: false, message: `Invalid ${label} format. Supported formats: PNG, JPG, WEBP, SVG.` };
        }
        if (trimmed.length > 7 * 1024 * 1024) {
          return { valid: false, message: `${label} file size exceeds the 5MB limit.` };
        }
        return { valid: true, value: trimmed };
      } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
        return { valid: true, value: trimmed };
      } else {
        return { valid: false, message: `Invalid ${label} URL or image data.` };
      }
    }
    return { valid: true, value: undefined };
  };

  // Validate logoUrl
  if (body.logoUrl !== undefined) {
    const resLogo = validateImageField(body.logoUrl, 'Logo');
    if (!resLogo.valid) {
      return res.status(400).json({ success: false, message: resLogo.message });
    }
    if (resLogo.value !== undefined) {
      next.logoUrl = resLogo.value;
    }
  }

  // Validate signatureUrl
  if (body.signatureUrl !== undefined) {
    const resSig = validateImageField(body.signatureUrl, 'Authorized Signatory image');
    if (!resSig.valid) {
      return res.status(400).json({ success: false, message: resSig.message });
    }
    if (resSig.value !== undefined) {
      next.signatureUrl = resSig.value;
    }
  }

  // Validate sealUrl
  if (body.sealUrl !== undefined) {
    const resSeal = validateImageField(body.sealUrl, 'Official Seal image');
    if (!resSeal.valid) {
      return res.status(400).json({ success: false, message: resSeal.message });
    }
    if (resSeal.value !== undefined) {
      next.sealUrl = resSeal.value;
    }
  }

  // Synchronize document setup with central sequence engine
  if (body.invoiceSetup && next.invoiceSetup) {
    try {
      sequenceService.updateModuleRule('invoices', {
        prefix: next.invoiceSetup.prefix,
        suffix: next.invoiceSetup.suffix,
        paddingDigits: next.invoiceSetup.paddingDigits,
        nextNumber: next.invoiceSetup.nextNumber
      });
    } catch (_) {}
  }
  if (body.dcSetup && next.dcSetup) {
    try {
      sequenceService.updateModuleRule('deliveryChallans', {
        prefix: next.dcSetup.prefix,
        suffix: next.dcSetup.suffix,
        paddingDigits: next.dcSetup.paddingDigits,
        nextNumber: next.dcSetup.nextNumber
      });
    } catch (_) {}
  }
  if (body.quotationSetup && next.quotationSetup) {
    try {
      sequenceService.updateModuleRule('quotations', {
        prefix: next.quotationSetup.prefix,
        suffix: next.quotationSetup.suffix,
        paddingDigits: next.quotationSetup.paddingDigits,
        nextNumber: next.quotationSetup.nextNumber
      });
    } catch (_) {}
  }

  data.companySettings = next;
  writeData(data);

  return res.json({
    success: true,
    message: 'Company settings updated successfully.',
    data: next
  });
}

function updateSectionSettings(req, res) {
  if (!requireSettingsAccess(req, res)) return;

  const sectionKey = String(req.params.sectionKey || '').trim();
  if (!sectionKey) return res.status(400).json({ success: false, message: 'Section key is required.' });

  const data = readData();
  const current = data.companySettings || defaultCompanySettings;
  const next = { ...current };

  const validSections = [
    'companyProfile', 'locations', 'branches', 'warehouses',
    'invoiceSetup', 'quotationSetup', 'dcSetup', 'pdfSettings',
    'emailSetup', 'smsSetup', 'paymentMethods', 'currency',
    'taxSetup', 'discountSetup', 'branding'
  ];

  if (!validSections.includes(sectionKey)) {
    return res.status(400).json({ success: false, message: `Unknown settings section: ${sectionKey}` });
  }

  const body = req.body || {};

  if (sectionKey === 'companyProfile') {
    if (typeof body.companyName === 'string') next.companyName = body.companyName.trim();
    if (typeof body.name === 'string') next.companyName = body.name.trim();
    if (typeof body.siteShortName === 'string') next.siteShortName = body.siteShortName.trim();
    if (typeof body.legalName === 'string') next.legalName = body.legalName.trim();
    if (typeof body.iso === 'string') next.iso = body.iso.trim();
    if (typeof body.address === 'string') next.address = body.address.trim();
    if (typeof body.street === 'string') next.street = body.street.trim();
    if (typeof body.street2 === 'string') next.street2 = body.street2.trim();
    if (typeof body.city === 'string') next.city = body.city.trim();
    if (typeof body.state === 'string') next.state = body.state.trim();
    if (typeof body.country === 'string') next.country = body.country.trim();
    if (typeof body.zipCode === 'string') next.zipCode = body.zipCode.trim();
    if (typeof body.phone === 'string') next.phone = body.phone.trim();
    if (typeof body.mobile === 'string') next.mobile = body.mobile.trim();
    if (typeof body.email === 'string') next.email = body.email.trim();
    if (typeof body.website === 'string') next.website = body.website.trim();
    if (typeof body.gstin === 'string') next.gstin = body.gstin.trim();
    if (typeof body.gstRegistrationType === 'string') next.gstRegistrationType = body.gstRegistrationType.trim();
    if (typeof body.financialYearRef === 'string') next.financialYearRef = body.financialYearRef.trim();
    if (typeof body.theme === 'string') next.theme = body.theme.trim();
    if (typeof body.defaultLanguage === 'string') next.defaultLanguage = body.defaultLanguage.trim();
    if (typeof body.defaultCurrency === 'string') next.defaultCurrency = body.defaultCurrency.trim();
    if (typeof body.termsAndConditions === 'string') next.termsAndConditions = body.termsAndConditions.trim();
    if (typeof body.quotationTerms === 'string') next.quotationTerms = body.quotationTerms.trim();
    if (typeof body.bankName === 'string') next.bankName = body.bankName.trim();
  } else if (sectionKey === 'branding') {
    if (body.logoUrl !== undefined) next.logoUrl = body.logoUrl;
    if (body.signatureUrl !== undefined) next.signatureUrl = body.signatureUrl;
    if (body.sealUrl !== undefined) next.sealUrl = body.sealUrl;
  } else if (Array.isArray(body)) {
    next[sectionKey] = sectionKey === 'warehouses' ? body.map(normalizeWarehouseLayout) : body;
  } else if (typeof body === 'object') {
    next[sectionKey] = { ...(next[sectionKey] || {}), ...body };
  }

  // Synchronize document setup with central sequence engine
  if (body.invoiceSetup && next.invoiceSetup) {
    try {
      sequenceService.updateModuleRule('invoices', {
        prefix: next.invoiceSetup.prefix,
        suffix: next.invoiceSetup.suffix,
        paddingDigits: next.invoiceSetup.paddingDigits,
        nextNumber: next.invoiceSetup.nextNumber
      });
    } catch (_) {}
  }
  if (body.dcSetup && next.dcSetup) {
    try {
      sequenceService.updateModuleRule('deliveryChallans', {
        prefix: next.dcSetup.prefix,
        suffix: next.dcSetup.suffix,
        paddingDigits: next.dcSetup.paddingDigits,
        nextNumber: next.dcSetup.nextNumber
      });
    } catch (_) {}
  }
  if (body.quotationSetup && next.quotationSetup) {
    try {
      sequenceService.updateModuleRule('quotations', {
        prefix: next.quotationSetup.prefix,
        suffix: next.quotationSetup.suffix,
        paddingDigits: next.quotationSetup.paddingDigits,
        nextNumber: next.quotationSetup.nextNumber
      });
    } catch (_) {}
  }

  data.companySettings = next;
  writeData(data);

  return res.json({
    success: true,
    message: `${sectionKey} settings updated successfully.`,
    data: sectionKey === 'companyProfile' ? next : next[sectionKey]
  });
}

function getActiveEmployees(req, res) {
  try {
    const data = readData();
    const activeUsers = (data.users || [])
      .filter((u) => u.status !== 'Inactive')
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        mobile: u.mobile,
        role: u.role,
        employeeId: u.employeeId
      }));
    return res.json({ success: true, data: activeUsers });
  } catch (err) {
    console.error('Error in getActiveEmployees:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch active employees.' });
  }
}

const backupService = require('../services/backupService');

function getDatabaseStatsEndpoint(req, res) {
  try {
    if (!requireSettingsAccess(req, res)) return;
    const stats = backupService.getDatabaseStats();
    const backups = backupService.listBackups();
    return res.json({
      success: true,
      data: {
        stats,
        latestBackup: backups[0] || null,
        totalBackupsCount: backups.length
      }
    });
  } catch (err) {
    console.error('Error fetching database stats:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch database stats.' });
  }
}

function getMongoStatusEndpoint(req, res) {
  try {
    const mongoose = require('mongoose');
    const isConnected = mongoose.connection.readyState === 1;
    const uriConfigured = Boolean(process.env.MONGODB_URI);

    return res.json({
      success: true,
      data: {
        isConnected,
        readyState: mongoose.connection.readyState,
        host: isConnected ? mongoose.connection.host : null,
        database: isConnected ? mongoose.connection.name : 'asicrm',
        uriConfigured,
        storageMode: isConnected ? 'HYBRID_MONGO_SYNC' : 'RESILIENT_LOCAL_JSON',
        notice: isConnected
          ? 'MongoDB Atlas is actively connected and syncing.'
          : 'Operating in resilient local JSON storage mode. MongoDB Atlas is currently offline or blocking connections (check Network Access IP whitelist in MongoDB Atlas).'
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to get MongoDB status.' });
  }
}

async function triggerMongoSyncEndpoint(req, res) {
  try {
    if (!requireSettingsAccess(req, res)) return;
    const mongoose = require('mongoose');
    const connectDB = require('../config/db');

    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Could not connect to MongoDB Atlas. Please ensure 0.0.0.0/0 (or your server IP) is added to MongoDB Atlas Network Access whitelist.'
      });
    }

    const { syncStoreToMongo, syncStockToMongo, syncSettingsToMongo } = require('../services/mongoSyncService');
    const crmStore = require('../data/crmStore');
    const stocksPath = path.join(__dirname, '..', 'data', 'stocks-data.json');
    const accessPath = path.join(__dirname, '..', 'data', 'access-control.json');

    await syncStoreToMongo(crmStore);
    if (fs.existsSync(stocksPath)) {
      const stocksData = JSON.parse(fs.readFileSync(stocksPath, 'utf8'));
      await syncStockToMongo(stocksData.products, stocksData.inventoryTransactions);
    }
    if (fs.existsSync(accessPath)) {
      const accessData = JSON.parse(fs.readFileSync(accessPath, 'utf8'));
      await syncSettingsToMongo(accessData.companySettings);
    }

    return res.json({
      success: true,
      message: 'All records (Customers, Quotations, Invoices, Stocks) successfully synchronized to MongoDB Atlas!'
    });
  } catch (err) {
    console.error('Error triggering MongoDB sync:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to sync to MongoDB Atlas.' });
  }
}

function getBackupsListEndpoint(req, res) {
  try {
    if (!requireSettingsAccess(req, res)) return;
    const backups = backupService.listBackups();
    return res.json({ success: true, data: backups });
  } catch (err) {
    console.error('Error listing backups:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to list backups.' });
  }
}

function getBackupDetailsEndpoint(req, res) {
  try {
    if (!requireSettingsAccess(req, res)) return;
    const { id } = req.params;
    const backup = backupService.getBackupById(id);
    if (!backup) {
      return res.status(404).json({ success: false, message: `Backup snapshot ${id} not found.` });
    }

    if (req.query.download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="${id}.json"`);
      res.setHeader('Content-Type', 'application/json');
      return res.send(JSON.stringify(backup, null, 2));
    }

    return res.json({ success: true, data: backup });
  } catch (err) {
    console.error('Error getting backup details:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to retrieve backup details.' });
  }
}

async function sendDatabaseBackupOtpEndpoint(req, res) {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Only Super Administrators can authorize system backups.' });
    }
    const { user, mobile } = getSuperAdminMobile(req);
    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Super Admin does not have a valid 10-digit mobile number registered.' });
    }

    const otp = String(crypto.randomInt(1000, 10000));
    databaseOtpStore.set(`BACKUP:${user.id}`, {
      otp,
      mobile,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    try {
      await sendSmsOtp(mobile, otp);
    } catch (smsErr) {
      console.error('[SMS ERROR] Failed to send backup authorization OTP:', smsErr);
      return res.status(500).json({ success: false, message: 'Failed to deliver SMS OTP: ' + (smsErr.message || 'SMS provider error') });
    }

    const maskedMobile = `+91 ${mobile.slice(0, 2)}******${mobile.slice(-2)}`;
    return res.json({
      success: true,
      message: `Backup authorization OTP sent to registered mobile ${maskedMobile}.`,
      maskedMobile
    });
  } catch (err) {
    console.error('Error sending backup OTP:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to dispatch backup OTP.' });
  }
}

function createBackupEndpoint(req, res) {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Only Super Administrators can create database backups.' });
    }
    const user = getCurrentUser(req);
    const { title, note, otp } = req.body || {};

    const otpKey = `BACKUP:${user.id}`;
    const record = databaseOtpStore.get(otpKey);
    if (!record || Date.now() > record.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Backup authorization OTP has expired or was not requested. Please request an OTP first.'
      });
    }
    if (String(record.otp).trim() !== String(otp || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP code. Please enter the correct 4-digit verification code.'
      });
    }

    // OTP verified: consume it
    databaseOtpStore.delete(otpKey);

    const backup = backupService.createBackup({ title, type: 'MANUAL_BACKUP', user, note });

    // UNLOCK PREREQUISITE: Record verified backup session for clearance (valid for 15 minutes)
    const unlockDurationMs = 15 * 60 * 1000;
    const unlockExpiresAt = Date.now() + unlockDurationMs;
    verifiedBackupSessions.set(user.id, {
      backupId: backup.id,
      timestamp: Date.now(),
      expiresAt: unlockExpiresAt
    });

    return res.json({
      success: true,
      message: `System backup "${backup.title}" created successfully. Database clearance unlocked for 15 minutes.`,
      data: backup,
      isClearUnlocked: true,
      unlockExpiresAt,
      remainingSeconds: Math.floor(unlockDurationMs / 1000)
    });
  } catch (err) {
    console.error('Error creating backup:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to create backup.' });
  }
}

async function sendDatabaseClearOtpEndpoint(req, res) {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Only Super Administrators can authorize database clearance.' });
    }
    const { user, mobile } = getSuperAdminMobile(req);
    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Super Admin does not have a valid 10-digit mobile number registered.' });
    }

    // MANDATORY PREREQUISITE: A verified backup must exist and not be expired
    const verified = verifiedBackupSessions.get(user.id);
    if (!verified || Date.now() > verified.expiresAt) {
      return res.status(403).json({
        success: false,
        message: 'Database clearance is locked. An OTP-verified system backup must be completed before database clearance can be authorized.'
      });
    }

    const otp = String(crypto.randomInt(1000, 10000));
    databaseOtpStore.set(`CLEAR:${user.id}`, {
      otp,
      mobile,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    try {
      await sendSmsOtp(mobile, otp);
    } catch (smsErr) {
      console.error('[SMS ERROR] Failed to send database deletion OTP:', smsErr);
      return res.status(500).json({ success: false, message: 'Failed to deliver deletion authorization SMS OTP: ' + (smsErr.message || 'SMS provider error') });
    }

    const maskedMobile = `+91 ${mobile.slice(0, 2)}******${mobile.slice(-2)}`;
    return res.json({
      success: true,
      message: `Deletion authorization OTP sent to registered mobile ${maskedMobile}.`,
      maskedMobile
    });
  } catch (err) {
    console.error('Error sending clear OTP:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to dispatch deletion OTP.' });
  }
}

function clearDatabaseEndpoint(req, res) {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Only Super Administrators can clear the database.' });
    }
    const user = getCurrentUser(req);

    // MANDATORY PREREQUISITE: Must have a recent verified backup
    const verified = verifiedBackupSessions.get(user.id);
    if (!verified || Date.now() > verified.expiresAt) {
      return res.status(403).json({
        success: false,
        message: 'Database clearance is locked. You must perform an OTP-verified system backup before clearing the database.'
      });
    }

    const { options, otp } = req.body || {};
    const otpKey = `CLEAR:${user.id}`;
    const record = databaseOtpStore.get(otpKey);
    if (!record || Date.now() > record.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'Deletion authorization OTP has expired or was not requested. Please request an authorization OTP first.'
      });
    }
    if (String(record.otp).trim() !== String(otp || '').trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid deletion authorization OTP code. Database clearance aborted.'
      });
    }

    // Consume OTP
    databaseOtpStore.delete(otpKey);
    // RELOCK: Invalidate verified session so [Clear & Delete Database] re-locks immediately
    verifiedBackupSessions.delete(user.id);

    const result = backupService.clearActiveDatabase({ user, options });
    return res.json({
      success: true,
      message: result.message,
      data: {
        autoBackup: result.autoBackup,
        clearedStats: result.clearedStats
      },
      isClearUnlocked: false
    });
  } catch (err) {
    console.error('Error clearing database:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to clear database.' });
  }
}

function getDatabaseClearStatusEndpoint(req, res) {
  try {
    if (!isSuperAdmin(req)) {
      return res.json({ success: true, isClearUnlocked: false, remainingSeconds: 0 });
    }
    const user = getCurrentUser(req);
    const verified = verifiedBackupSessions.get(user.id);
    const isUnlocked = Boolean(verified && Date.now() < verified.expiresAt);
    const remainingSeconds = isUnlocked ? Math.max(0, Math.floor((verified.expiresAt - Date.now()) / 1000)) : 0;
    return res.json({
      success: true,
      isClearUnlocked: isUnlocked,
      remainingSeconds
    });
  } catch (err) {
    return res.json({ success: true, isClearUnlocked: false, remainingSeconds: 0 });
  }
}

function restoreBackupEndpoint(req, res) {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Only Super Administrators can restore the database.' });
    }
    const user = getCurrentUser(req);
    const { id } = req.params;
    const result = backupService.restoreBackup(id, { user });
    return res.json({
      success: true,
      message: result.message,
      data: {
        restoredBackup: result.restoredBackup,
        safetyBackup: result.safetyBackup
      }
    });
  } catch (err) {
    console.error('Error restoring backup:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to restore database.' });
  }
}

function deleteBackupEndpoint(req, res) {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Only Super Administrators can delete backups.' });
    }
    const { id } = req.params;
    const result = backupService.deleteBackup(id);
    return res.json(result);
  } catch (err) {
    console.error('Error deleting backup:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to delete backup.' });
  }
}

function importBackupEndpoint(req, res) {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Only Super Administrators can import backups.' });
    }
    const user = getCurrentUser(req);
    const backup = backupService.importBackup(req.body, { user });
    return res.json({
      success: true,
      message: `Backup "${backup.title}" imported successfully. You can now inspect or restore it.`,
      data: backup
    });
  } catch (err) {
    console.error('Error importing backup:', err);
    return res.status(400).json({ success: false, message: err.message || 'Failed to import backup file.' });
  }
}

function getSequencesEndpoint(req, res) {
  try {
    if (!requireSettingsAccess(req, res)) return;
    const summary = sequenceService.getSummary();
    return res.json({ success: true, data: summary });
  } catch (err) {
    console.error('Error fetching sequences:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch serial numbers.' });
  }
}

function updateSequenceEndpoint(req, res) {
  try {
    if (!requireSettingsPermission(req, res, 'Manage Roles') && !isSuperAdmin(req)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to configure serial numbers.' });
    }
    const { moduleKey } = req.params;
    const result = sequenceService.updateModuleRule(moduleKey, req.body);

    // Sync updated sequence format back to companySettings in access-control.json
    try {
      const data = readData();
      if (data && data.companySettings) {
        if (moduleKey === 'invoices' && data.companySettings.invoiceSetup) {
          data.companySettings.invoiceSetup.prefix = result.rule.prefix;
          data.companySettings.invoiceSetup.suffix = result.rule.suffix;
          data.companySettings.invoiceSetup.paddingDigits = result.rule.paddingDigits;
          data.companySettings.invoiceSetup.nextNumber = result.rule.nextNumber;
          writeData(data);
        } else if (moduleKey === 'deliveryChallans' && data.companySettings.dcSetup) {
          data.companySettings.dcSetup.prefix = result.rule.prefix;
          data.companySettings.dcSetup.suffix = result.rule.suffix;
          data.companySettings.dcSetup.paddingDigits = result.rule.paddingDigits;
          data.companySettings.dcSetup.nextNumber = result.rule.nextNumber;
          writeData(data);
        } else if (moduleKey === 'quotations' && data.companySettings.quotationSetup) {
          data.companySettings.quotationSetup.prefix = result.rule.prefix;
          data.companySettings.quotationSetup.suffix = result.rule.suffix;
          data.companySettings.quotationSetup.paddingDigits = result.rule.paddingDigits;
          data.companySettings.quotationSetup.nextNumber = result.rule.nextNumber;
          writeData(data);
        }
      }
    } catch (_) {}

    return res.json({
      success: true,
      message: `Serial number format for ${result.rule.name} updated successfully.`,
      data: result
    });
  } catch (err) {
    console.error('Error updating sequence:', err);
    return res.status(400).json({ success: false, message: err.message || 'Failed to update sequence.' });
  }
}

function rolloverSequencesEndpoint(req, res) {
  try {
    if (!isSuperAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Only Super Administrators can execute year rollovers.' });
    }
    const { targetYear } = req.body || {};
    const result = sequenceService.executeManualRollOver(targetYear);
    return res.json({
      success: true,
      message: `Calendar year rollover to ${result.newYear} completed and historical data archived in database.`,
      data: result
    });
  } catch (err) {
    console.error('Error rolling over sequences:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to execute year rollover.' });
  }
}

function getDateFormatEndpoint(req, res) {
  try {
    const currentUserId = String(req.headers['x-user-id'] || '').trim();
    if (!currentUserId && !settingsAccess(req)) {
      return res.status(401).json({ success: false, message: 'Authentication is required.' });
    }
    const summary = dateSettingsService.getSummary();
    return res.json({ success: true, data: summary });
  } catch (err) {
    console.error('Error fetching date format settings:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to fetch date format settings.' });
  }
}

function updateDateFormatEndpoint(req, res) {
  try {
    if (!requireSettingsAccess(req, res)) return;
    const currentUser = getCurrentUser(req);
    const summary = dateSettingsService.updateSettings(req.body, currentUser);

    try {
      const data = readData();
      if (data && data.companySettings) {
        data.companySettings.dateFormatSettings = summary;
        writeData(data);
      }
    } catch (_) {}

    return res.json({
      success: true,
      message: 'Date format settings saved and propagated across ASICRM successfully.',
      data: summary
    });
  } catch (err) {
    console.error('Error updating date format settings:', err);
    return res.status(400).json({ success: false, message: err.message || 'Failed to update date format settings.' });
  }
}

function resetDateFormatEndpoint(req, res) {
  try {
    if (!requireSettingsAccess(req, res)) return;
    const currentUser = getCurrentUser(req);
    const summary = dateSettingsService.resetToDefaults(currentUser);

    try {
      const data = readData();
      if (data && data.companySettings) {
        data.companySettings.dateFormatSettings = summary;
        writeData(data);
      }
    } catch (_) {}

    return res.json({
      success: true,
      message: 'Date format configuration restored to official ASI CRM defaults.',
      data: summary
    });
  } catch (err) {
    console.error('Error resetting date format settings:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to reset date format settings.' });
  }
}

module.exports = {
  getSettings,
  getActiveEmployees,
  createUser,
  updateUser,
  transferSuperAdmin,
  deleteUser,
  createRole,
  updateRole,
  deleteRole,
  updatePermissions,
  resolveUser,
  getCompanySettings,
  updateCompanySettings,
  updateSectionSettings,
  getDatabaseStatsEndpoint,
  getBackupsListEndpoint,
  getBackupDetailsEndpoint,
  sendDatabaseBackupOtpEndpoint,
  sendDatabaseClearOtpEndpoint,
  getDatabaseClearStatusEndpoint,
  createBackupEndpoint,
  clearDatabaseEndpoint,
  restoreBackupEndpoint,
  deleteBackupEndpoint,
  importBackupEndpoint,
  getSequencesEndpoint,
  updateSequenceEndpoint,
  rolloverSequencesEndpoint,
  getDateFormatEndpoint,
  updateDateFormatEndpoint,
  resetDateFormatEndpoint,
  getMongoStatusEndpoint,
  triggerMongoSyncEndpoint
};
