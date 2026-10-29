const ENQUIRY_TYPES = [
  'Product Enquiry',
  'Service Enquiry',
  'Pricing Enquiry',
  'Support Enquiry',
  'General Enquiry',
  'Site Visit Enquiry',
  'AMC — Annual Maintenance Contract',
  'Other'
];

const TERMINAL_STATUSES = ['CLOSED', 'CANCELLED'];

const FORCE_CLOSE_REASONS = [
  'No Response',
  'Customer Declined',
  'Duplicate Enquiry',
  'Invalid Enquiry',
  'Other'
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isTerminalStatus = (status) => TERMINAL_STATUSES.includes(status);

const shouldShowAssignedEmployee = (enquiryType) => {
  const t = String(enquiryType || '').trim().toLowerCase();
  return !(t.startsWith('product') || t.startsWith('pricing') || t.startsWith('general'));
};

const digitsOnly = (value) => String(value || '').replace(/\D/g, '');

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const contactPersonOf = (record) => {
  if (!record) return '';
  return String(record.contactPerson || record.company || '').trim();
};

const normalizeBranches = (branches, generateBranchId) => {
  if (!Array.isArray(branches)) return [];
  return branches
    .filter((branch) => branch && (branch.branchName || branch.contactPerson || branch.phone || branch.email || branch.address || branch.branchAddress))
    .map((branch) => ({
      branchId: branch.branchId || (generateBranchId ? generateBranchId() : `BR-${Date.now()}`),
      branchName: String(branch.branchName || '').trim(),
      address: String(branch.address || branch.branchAddress || '').trim(),
      contactPerson: String(branch.contactPerson || '').trim(),
      phone: String(branch.phone || '').trim(),
      email: String(branch.email || '').trim()
    }));
};

const normalizeCustomer = (customer, generateBranchId) => {
  if (!customer) return customer;
  const contactPerson = contactPersonOf(customer);
  return {
    ...customer,
    contactPerson: customer.contactPerson || contactPerson || customer.name,
    company: customer.company || contactPerson || customer.name,
    shippingAddress: customer.shippingAddress || customer.address || '',
    gstin: customer.gstin || '',
    pincode: customer.pincode || '',
    branches: normalizeBranches(customer.branches, generateBranchId)
  };
};

const validateNewCustomer = (payload) => {
  const customerTypeRaw = String(payload.customerType || '').trim();
  const validTypes = ['Individual', 'Business', 'Corporate', 'Dealer'];
  const customerType = validTypes.includes(customerTypeRaw) ? customerTypeRaw : 'Individual';
  const isIndividual = customerType === 'Individual';
  const isBusinessOrCorporate = customerType === 'Business' || customerType === 'Corporate';

  const name = String(payload.name || payload.customerName || payload.company || '').trim();
  const mobile = digitsOnly(payload.mobile || payload.mobileNumber).slice(-10);
  const email = String(payload.email || '').trim();
  const contactPerson = String(payload.contactPerson || '').trim();
  const company = String(payload.company || payload.companyName || (!isIndividual ? name : '')).trim();

  if (!name && !company) {
    return { error: isIndividual ? 'Customer name is required.' : 'Company name is required.' };
  }
  if (!mobile) {
    return { error: 'Mobile number is required.' };
  }
  if (!/^\d{10}$/.test(mobile)) {
    return { error: 'Please enter a valid 10-digit mobile number.' };
  }
  if (!email) {
    return { error: 'Email address is required.' };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { error: 'Please enter a valid email address.' };
  }

  return {
    value: {
      name: isIndividual ? name : (company || name),
      mobile,
      email,
      contactPerson: contactPerson || name,
      company: isIndividual ? '' : (company || name),
      customerType,
      address: String(payload.address || payload.billingAddress || '').trim(),
      shippingAddress: String(payload.shippingAddress || payload.deliveryAddress || payload.address || payload.billingAddress || '').trim(),
      city: String(payload.city || '').trim(),
      state: String(payload.state || '').trim(),
      pincode: String(payload.pincode || payload.zipCode || '').trim(),
      gstin: isBusinessOrCorporate ? String(payload.gstin || payload.gstinUin || payload.gstNumber || '').trim().toUpperCase() : '',
      notes: String(payload.notes || '').trim(),
      branches: payload.branches
    }
  };
};

module.exports = {
  ENQUIRY_TYPES,
  TERMINAL_STATUSES,
  FORCE_CLOSE_REASONS,
  EMAIL_REGEX,
  isTerminalStatus,
  shouldShowAssignedEmployee,
  digitsOnly,
  normalizeEmail,
  contactPersonOf,
  normalizeBranches,
  normalizeCustomer,
  validateNewCustomer
};
