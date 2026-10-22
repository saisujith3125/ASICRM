const fs = require('fs');
const path = require('path');
const { hasPermission, getCurrentUser } = require('../utils/accessControl');
const { normalizeWarehouseLayout, createDefaultLayout } = require('../utils/warehouseLayoutHelper');

const DATA_FILE = path.join(__dirname, '..', 'data', 'access-control.json');
const PROTECTED_ROLE = 'SUPER_ADMIN';
const DEV_SHARED_OTP = String(process.env.DEV_SHARED_OTP || '1234');

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
    prefix: 'INV/',
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
    prefix: 'QTN/',
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
    prefix: 'DC/',
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
      companySettings: data.companySettings
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
  if (role === PROTECTED_ROLE && data.users.some((item) => roleKeyOf({ key: item.role }) === PROTECTED_ROLE)) {
    return res.status(409).json({ success: false, message: 'A Super Admin account already exists.' });
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
    status,
    devOtp: process.env.NODE_ENV !== 'production' ? DEV_SHARED_OTP : String(body.devOtp || Math.floor(1000 + Math.random() * 9000)).slice(0, 4).padStart(4, '0')
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
  if (nextRole === PROTECTED_ROLE && existingRole !== PROTECTED_ROLE && data.users.some((item) => roleKeyOf({ key: item.role }) === PROTECTED_ROLE)) {
    return res.status(409).json({ success: false, message: 'A Super Admin account already exists.' });
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
  if (process.env.NODE_ENV !== 'production') {
    next.devOtp = DEV_SHARED_OTP;
  } else if (body.devOtp && /^\d{4}$/.test(String(body.devOtp))) {
    next.devOtp = String(body.devOtp);
  }

  data.users[index] = next;
  writeData(data);
  return res.json({ success: true, data: sanitizeUser(next) });
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
  return res.json({
    success: true,
    data: data.companySettings || defaultCompanySettings
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

module.exports = {
  getSettings,
  getActiveEmployees,
  createUser,
  updateUser,
  createRole,
  updateRole,
  deleteRole,
  updatePermissions,
  resolveUser,
  getCompanySettings,
  updateCompanySettings,
  updateSectionSettings
};
