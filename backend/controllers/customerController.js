const {
  customers,
  enquiries,
  orders,
  quotations,
  deliveryChallans,
  invoices,
  generateCustomerId,
  generateBranchId,
  persistStore
} = require('../data/crmStore');
const {
  digitsOnly,
  normalizeEmail,
  contactPersonOf,
  normalizeBranches,
  normalizeCustomer,
  validateNewCustomer,
  EMAIL_REGEX
} = require('../utils/crmHelpers');
const { filterRecordsBySearch } = require('../utils/searchHelper');

const normalizeCustomerName = (val) => String(val || '').trim().replace(/\s+/g, ' ').toLowerCase();

const findDuplicateCustomers = ({ name, mobile, email, excludeId }) => {
  const cleanMobile = digitsOnly(mobile).slice(-10);
  const cleanEmail = normalizeEmail(email);
  const cleanName = normalizeCustomerName(name);

  return customers.filter((customer) => {
    if (excludeId && customer.id === excludeId) return false;
    const sameMobile = Boolean(cleanMobile && customer.mobile === cleanMobile);
    const sameEmail = Boolean(cleanEmail && normalizeEmail(customer.email) === cleanEmail);
    const custName = normalizeCustomerName(customer.name);
    const sameName = Boolean(cleanName && custName === cleanName);
    return sameMobile || sameEmail || sameName;
  });
};

const insertCustomer = (payload, { allowDuplicate = false } = {}) => {
  const validated = validateNewCustomer(payload);
  if (validated.error) {
    return { ok: false, status: 400, body: { success: false, message: validated.error } };
  }

  const duplicates = findDuplicateCustomers(validated.value);
  if (duplicates.length > 0 && !allowDuplicate) {
    return {
      ok: false,
      status: 409,
      body: {
        success: false,
        duplicate: true,
        message: 'Customer already exists. Please select the existing customer.',
        data: duplicates[0],
        customer: duplicates[0],
        matches: duplicates
      }
    };
  }

  const now = new Date().toISOString();
  const newCustomer = normalizeCustomer({
    id: generateCustomerId(),
    name: validated.value.name,
    mobile: validated.value.mobile,
    email: validated.value.email,
    contactPerson: validated.value.contactPerson,
    company: validated.value.company || validated.value.contactPerson || validated.value.name,
    customerType: validated.value.customerType,
    address: validated.value.address,
    shippingAddress: validated.value.shippingAddress || validated.value.address,
    city: validated.value.city,
    state: validated.value.state,
    pincode: validated.value.pincode,
    gstin: validated.value.gstin,
    notes: validated.value.notes,
    branches: normalizeBranches(validated.value.branches, generateBranchId),
    requirements: [],
    status: 'Active',
    createdAt: now,
    updatedAt: now
  }, generateBranchId);

  customers.unshift(newCustomer);
  persistStore();

  return {
    ok: true,
    status: 201,
    customer: newCustomer,
    body: {
      success: true,
      message: 'Customer created successfully.',
      data: newCustomer,
      customer: newCustomer
    }
  };
};

const { hasPermission, requirePermission } = require('../utils/accessControl');

const normalizeRequirementItem = (item) => {
  if (!item) return null;
  const text = String(item.text || item.requirement || '').trim();
  if (!text) return null;
  return {
    id: String(item.id || `REQ-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    text,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString()
  };
};

const customerRequirements = (customer) =>
  Array.isArray(customer?.requirements)
    ? customer.requirements.map(normalizeRequirementItem).filter(Boolean)
    : [];


function safeCustomerEnquiries(items, req) {
  if (hasPermission(req, 'Quotations', 'View')) return items;
  return items.map((item) => {
    const safe = { ...item };
    delete safe.quotationAmount;
    delete safe.quotationItem;
    delete safe.quotationRemarks;
    if (safe.quotation) {
      safe.quotation = {
        quotationId: safe.quotation.quotationId,
        status: safe.quotation.status,
        validUntil: safe.quotation.validUntil
      };
    }
    return safe;
  });
}

const matchCustomerToDocument = (customer, doc) => {
  if (!customer || !doc) return false;
  if (doc.customerId && customer.id && String(doc.customerId).trim() === String(customer.id).trim()) {
    return true;
  }
  const custName = String(customer.name || '').trim().toLowerCase();
  const docName = String(doc.customerName || doc.name || '').trim().toLowerCase();
  if (custName && docName) {
    if (docName === custName || docName.startsWith(custName) || custName.startsWith(docName)) {
      return true;
    }
  }
  const custCompany = String(customer.company || '').trim().toLowerCase();
  const docCompany = String(doc.company || doc.customerCompany || '').trim().toLowerCase();
  if (custCompany && docCompany) {
    if (docCompany === custCompany || docCompany.startsWith(custCompany) || custCompany.startsWith(docCompany)) {
      return true;
    }
  }
  return false;
};

const decorateCustomer = (customer) => {
  const customerEnquiries = enquiries.filter((enquiry) => enquiry.customerId === customer.id);
  const customerOrders = orders.filter((order) => order.customerId === customer.id);
  const customerQuotations = (quotations || []).filter((q) => matchCustomerToDocument(customer, q));
  const customerDeliveryChallans = (deliveryChallans || []).filter((d) => matchCustomerToDocument(customer, d));
  const customerInvoices = (invoices || []).filter((i) => matchCustomerToDocument(customer, i));

  const customerUnbilledChallans = customerDeliveryChallans.filter(
    (d) => d.deliveryPurpose !== 'RETURNABLE' &&
           !d.isReturnableDC &&
           !d.invoiceId &&
           !customerInvoices.some((i) => i.challanId === d.challanId)
  );

  const activeEnquiriesCount = customerEnquiries.filter(
    (enquiry) => !['CANCELLED', 'CLOSED'].includes(enquiry.status)
  ).length;
  const normalized = normalizeCustomer(customer, generateBranchId);

  return {
    ...normalized,
    contactPerson: contactPersonOf(normalized),
    totalEnquiries: customerEnquiries.length,
    activeEnquiries: activeEnquiriesCount,
    totalOrders: customerOrders.length,
    totalQuotations: customerQuotations.length,
    acceptedQuotations: customerQuotations.filter((q) => ['ACCEPTED', 'CUSTOMER_ACCEPTED', 'CONVERTED'].includes(q.status)).length,
    totalDeliveryChallans: customerDeliveryChallans.length,
    deliveredChallans: customerDeliveryChallans.filter((d) => ['DELIVERED', 'DISPATCHED'].includes(d.status)).length,
    unbilledDeliveryChallans: customerUnbilledChallans.length,
    totalInvoices: customerInvoices.length,
    confirmedInvoices: customerInvoices.filter((i) => ['CONFIRMED', 'PAID', 'ISSUED'].includes(i.status)).length,
    branchCount: (normalized.branches || []).length,
    requirements: customerRequirements(normalized)
  };
};

const getCustomers = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Customers', 'View')) return;
    const { search } = req.query;
    let list = customers.map(decorateCustomer);
    list.sort((a, b) => {
      const aNum = Number(String(a.id || '').match(/(\d+)$/)?.[1] || 0);
      const bNum = Number(String(b.id || '').match(/(\d+)$/)?.[1] || 0);
      return aNum - bNum;
    });

    if (search && search.trim()) {
      list = filterRecordsBySearch(list, search, [
        (c) => c.id,
        (c) => c.name,
        (c) => c.company,
        (c) => c.contactPerson,
        (c) => c.mobile,
        (c) => c.phone,
        (c) => c.email,
        (c) => c.city,
        (c) => c.state,
        (c) => c.address,
        (c) => c.branch,
        (c) => c.gstin
      ]);
    }

    return res.status(200).json({
      success: true,
      data: list,
      customers: list
    });
  } catch (error) {
    console.error('Error in getCustomers:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch customers.'
    });
  }
};

const getCustomerById = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Customers', 'View')) return;
    const { id } = req.params;
    const customer = customers.find((item) => item.id === id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found.'
      });
    }

    const customerEnquiries = safeCustomerEnquiries(enquiries.filter((enquiry) => enquiry.customerId === id), req);
    const customerOrders = orders.filter((order) => order.customerId === id);
    const customerQuotations = (quotations || []).filter((q) => matchCustomerToDocument(customer, q));
    const customerInvoices = (invoices || []).filter((i) => matchCustomerToDocument(customer, i));
    const customerDeliveryChallans = (deliveryChallans || []).filter((d) => matchCustomerToDocument(customer, d)).map((dc) => {
      const matchingInv = customerInvoices.find((i) => (i.challanId && i.challanId === dc.challanId) || (dc.invoiceId && i.invoiceId === dc.invoiceId));
      const invoiceId = dc.invoiceId || matchingInv?.invoiceId || null;
      return {
        ...dc,
        invoiceId,
        isInvoiced: Boolean(invoiceId),
        invoiceStatus: invoiceId ? 'INVOICED' : 'UNBILLED'
      };
    });

    const decorated = {
      ...decorateCustomer(customer),
      enquiries: customerEnquiries,
      orders: customerOrders,
      quotations: customerQuotations,
      deliveryChallans: customerDeliveryChallans,
      invoices: customerInvoices
    };

    return res.status(200).json({
      success: true,
      data: decorated,
      customer: decorated
    });
  } catch (error) {
    console.error('Error in getCustomerById:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch customer details.'
    });
  }
};

const createCustomer = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Customers', 'Create')) return;
    const result = insertCustomer(req.body, { allowDuplicate: Boolean(req.body.allowDuplicate) });
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Error in createCustomer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create customer.'
    });
  }
};


const addCustomerRequirement = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Customers', 'Edit')) return;
    const customer = customers.find((item) => item.id === req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const text = String(req.body?.text || req.body?.requirement || '').trim();
    if (!text) return res.status(400).json({ success: false, message: 'Requirement text is required.' });
    if (text.length > 1000) return res.status(400).json({ success: false, message: 'Requirement must be 1000 characters or less.' });

    const current = customerRequirements(customer);
    const now = new Date().toISOString();
    const item = {
      id: `REQ-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      createdAt: now,
      updatedAt: now
    };
    customer.requirements = [...current, item];
    customer.updatedAt = now;
    persistStore();

    return res.status(201).json({
      success: true,
      message: 'Requirement added successfully.',
      data: decorateCustomer(customer),
      requirement: item
    });
  } catch (error) {
    console.error('Error in addCustomerRequirement:', error);
    return res.status(500).json({ success: false, message: 'Failed to add customer requirement.' });
  }
};

const updateCustomerRequirement = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Customers', 'Edit')) return;
    const customer = customers.find((item) => item.id === req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const text = String(req.body?.text || req.body?.requirement || '').trim();
    if (!text) return res.status(400).json({ success: false, message: 'Requirement text is required.' });
    if (text.length > 1000) return res.status(400).json({ success: false, message: 'Requirement must be 1000 characters or less.' });

    const current = customerRequirements(customer);
    const index = current.findIndex((item) => item.id === req.params.requirementId);
    if (index < 0) return res.status(404).json({ success: false, message: 'Requirement not found.' });

    const updated = {
      ...current[index],
      text,
      updatedAt: new Date().toISOString()
    };
    current[index] = updated;
    customer.requirements = current;
    customer.updatedAt = updated.updatedAt;
    persistStore();

    return res.json({
      success: true,
      message: 'Requirement updated successfully.',
      data: decorateCustomer(customer),
      requirement: updated
    });
  } catch (error) {
    console.error('Error in updateCustomerRequirement:', error);
    return res.status(500).json({ success: false, message: 'Failed to update customer requirement.' });
  }
};

const deleteCustomerRequirement = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Customers', 'Edit')) return;
    const customer = customers.find((item) => item.id === req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const current = customerRequirements(customer);
    const exists = current.some((item) => item.id === req.params.requirementId);
    if (!exists) return res.status(404).json({ success: false, message: 'Requirement not found.' });

    customer.requirements = current.filter((item) => item.id !== req.params.requirementId);
    customer.updatedAt = new Date().toISOString();
    persistStore();

    return res.json({
      success: true,
      message: 'Requirement deleted successfully.',
      data: decorateCustomer(customer)
    });
  } catch (error) {
    console.error('Error in deleteCustomerRequirement:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete customer requirement.' });
  }
};

const updateCustomerBranches = (req, res) => {
  try {
    if (!hasPermission(req, 'Customers', 'Manage Branches') && !hasPermission(req, 'Customers', 'Edit')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to manage customer branches.' });
    }
    const customer = customers.find((item) => item.id === req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    if (!Array.isArray(req.body.branches)) {
      return res.status(400).json({ success: false, message: 'Branches must be an array.' });
    }
    customer.branches = normalizeBranches(req.body.branches, generateBranchId);
    customer.updatedAt = new Date().toISOString();
    persistStore();
    return res.json({ success: true, message: 'Customer branches updated successfully.', data: decorateCustomer(customer) });
  } catch (error) {
    console.error('Error in updateCustomerBranches:', error);
    return res.status(500).json({ success: false, message: 'Failed to update customer branches.' });
  }
};

const addCustomerBranch = (req, res) => {
  try {
    if (!hasPermission(req, 'Customers', 'Manage Branches') && !hasPermission(req, 'Customers', 'Edit')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to manage customer branches.' });
    }
    const customer = customers.find((item) => item.id === req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const branchName = String(req.body?.branchName || '').trim();
    const contactPerson = String(req.body?.contactPerson || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const email = String(req.body?.email || '').trim();
    const address = String(req.body?.address || req.body?.branchAddress || '').trim();

    if (!branchName) {
      return res.status(400).json({ success: false, message: 'Branch Name is required.' });
    }
    if (!contactPerson) {
      return res.status(400).json({ success: false, message: 'Contact Person is required.' });
    }
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }
    const cleanPhone = digitsOnly(phone);
    if (cleanPhone.length < 10) {
      return res.status(400).json({ success: false, message: 'Please enter a valid phone number (at least 10 digits).' });
    }
    if (email && !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    const current = Array.isArray(customer.branches) ? customer.branches : [];
    const newBranch = {
      branchId: generateBranchId(),
      branchName,
      address,
      contactPerson,
      phone: cleanPhone.length === 10 ? cleanPhone : phone,
      email,
      createdAt: new Date().toISOString()
    };

    customer.branches = [...current, newBranch];
    customer.updatedAt = new Date().toISOString();
    persistStore();

    return res.status(201).json({
      success: true,
      message: 'Branch added successfully.',
      data: decorateCustomer(customer),
      branch: newBranch
    });
  } catch (error) {
    console.error('Error in addCustomerBranch:', error);
    return res.status(500).json({ success: false, message: 'Failed to add customer branch.' });
  }
};

const updateCustomerBranch = (req, res) => {
  try {
    if (!hasPermission(req, 'Customers', 'Manage Branches') && !hasPermission(req, 'Customers', 'Edit')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to manage customer branches.' });
    }
    const customer = customers.find((item) => item.id === req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const { branchId } = req.params;
    const current = Array.isArray(customer.branches) ? customer.branches : [];
    const index = current.findIndex((b) => b.branchId === branchId);
    if (index < 0) {
      return res.status(404).json({ success: false, message: 'Branch not found.' });
    }

    const branchName = String(req.body?.branchName || '').trim();
    const contactPerson = String(req.body?.contactPerson || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const email = String(req.body?.email || '').trim();
    const address = String(req.body?.address || req.body?.branchAddress || '').trim();

    if (!branchName) {
      return res.status(400).json({ success: false, message: 'Branch Name is required.' });
    }
    if (!contactPerson) {
      return res.status(400).json({ success: false, message: 'Contact Person is required.' });
    }
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }
    const cleanPhone = digitsOnly(phone);
    if (cleanPhone.length < 10) {
      return res.status(400).json({ success: false, message: 'Please enter a valid phone number (at least 10 digits).' });
    }
    if (email && !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    const updatedBranch = {
      ...current[index],
      branchName,
      address,
      contactPerson,
      phone: cleanPhone.length === 10 ? cleanPhone : phone,
      email,
      updatedAt: new Date().toISOString()
    };

    current[index] = updatedBranch;
    customer.branches = current;
    customer.updatedAt = new Date().toISOString();
    persistStore();

    return res.json({
      success: true,
      message: 'Branch updated successfully.',
      data: decorateCustomer(customer),
      branch: updatedBranch
    });
  } catch (error) {
    console.error('Error in updateCustomerBranch:', error);
    return res.status(500).json({ success: false, message: 'Failed to update customer branch.' });
  }
};

const deleteCustomerBranch = (req, res) => {
  try {
    if (!hasPermission(req, 'Customers', 'Manage Branches') && !hasPermission(req, 'Customers', 'Edit')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to manage customer branches.' });
    }
    const customer = customers.find((item) => item.id === req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const { branchId } = req.params;
    const current = Array.isArray(customer.branches) ? customer.branches : [];
    const exists = current.some((b) => b.branchId === branchId);
    if (!exists) {
      return res.status(404).json({ success: false, message: 'Branch not found.' });
    }

    customer.branches = current.filter((b) => b.branchId !== branchId);
    customer.updatedAt = new Date().toISOString();
    persistStore();

    return res.json({
      success: true,
      message: 'Branch deleted successfully.',
      data: decorateCustomer(customer)
    });
  } catch (error) {
    console.error('Error in deleteCustomerBranch:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete customer branch.' });
  }
};

const updateCustomer = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Customers', 'Edit')) return;
    const customer = customers.find((item) => item.id === req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    const validated = validateNewCustomer({ ...customer, ...req.body });
    if (validated.error) return res.status(400).json({ success: false, message: validated.error });
    const duplicates = findDuplicateCustomers({ ...validated.value, excludeId: customer.id });
    if (duplicates.length && !req.body.allowDuplicate) {
      return res.status(409).json({
        success: false,
        duplicate: true,
        message: 'Customer already exists. Please select the existing customer.',
        data: duplicates[0],
        customer: duplicates[0],
        matches: duplicates
      });
    }
    Object.assign(customer, normalizeCustomer({
      ...customer,
      ...validated.value,
      company: validated.value.company || customer.company || validated.value.contactPerson || '',
      gstin: validated.value.gstin || customer.gstin || '',
      pincode: validated.value.pincode || customer.pincode || '',
      shippingAddress: validated.value.shippingAddress || customer.shippingAddress || validated.value.address || '',
      branches: normalizeBranches(validated.value.branches, generateBranchId),
      updatedAt: new Date().toISOString()
    }, generateBranchId));
    persistStore();
    return res.json({ success: true, message: 'Customer updated successfully.', data: decorateCustomer(customer) });
  } catch (error) {
    console.error('Error in updateCustomer:', error);
    return res.status(500).json({ success: false, message: 'Failed to update customer.' });
  }
};

const getCustomerQuotations = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Customers', 'View')) return;
    const { id } = req.params;
    const customer = customers.find((item) => item.id === id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    const list = (quotations || []).filter((q) => matchCustomerToDocument(customer, q));
    return res.json({ success: true, data: list, quotations: list });
  } catch (err) {
    console.error('Error in getCustomerQuotations:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch customer quotations.' });
  }
};

const getCustomerDeliveryChallans = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Customers', 'View')) return;
    const { id } = req.params;
    const customer = customers.find((item) => item.id === id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    const list = (deliveryChallans || []).filter((d) => matchCustomerToDocument(customer, d));
    return res.json({ success: true, data: list, deliveryChallans: list });
  } catch (err) {
    console.error('Error in getCustomerDeliveryChallans:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch customer delivery challans.' });
  }
};

const getCustomerInvoices = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Customers', 'View')) return;
    const { id } = req.params;
    const customer = customers.find((item) => item.id === id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    const list = (invoices || []).filter((i) => matchCustomerToDocument(customer, i));
    return res.json({ success: true, data: list, invoices: list });
  } catch (err) {
    console.error('Error in getCustomerInvoices:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch customer invoices.' });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    if (!requirePermission(req, res, 'Customers', 'Delete')) return;
    const { id } = req.params;
    const cleanId = String(id || '').trim();
    const index = customers.findIndex((item) => String(item.id || '').trim().toUpperCase() === cleanId.toUpperCase());
    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: `Customer ${cleanId} not found.`
      });
    }

    const customer = customers[index];

    // Check for linked commercial transactions
    const hasEnquiries = (enquiries || []).some((e) => e.customerId === customer.id || e.customerId === customer.name);
    const hasOrders = (orders || []).some((o) => o.customerId === customer.id || o.customerId === customer.name);
    const hasQuotations = (quotations || []).some((q) => matchCustomerToDocument(customer, q));
    const hasChallans = (deliveryChallans || []).some((d) => matchCustomerToDocument(customer, d));
    const hasInvoices = (invoices || []).some((i) => matchCustomerToDocument(customer, i));

    const isLinked = hasEnquiries || hasOrders || hasQuotations || hasChallans || hasInvoices;
    const force = req.query.force === 'true' || req.body?.force === true;

    if (isLinked && !force) {
      return res.status(200).json({
        success: false,
        hasLinkedRecords: true,
        message: `Cannot delete customer "${customer.company || customer.name}" because they have existing linked commercial transactions (Enquiries, Quotations, Orders, or Invoices).`
      });
    }

    const deletedName = customer.company || customer.name || customer.id;
    customers.splice(index, 1);
    persistStore();

    try {
      const { Customer } = require('../models');
      const { deleteFromMongo } = require('../services/mongoSyncService');
      if (Customer && deleteFromMongo) {
        await deleteFromMongo(Customer, 'id', customer.id);
      }
    } catch (mErr) {
      // Non-blocking fallback
    }

    return res.status(200).json({
      success: true,
      message: `Customer "${deletedName}" deleted successfully.`
    });
  } catch (error) {
    console.error('Error in deleteCustomer:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete customer.'
    });
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  getCustomerQuotations,
  getCustomerDeliveryChallans,
  getCustomerInvoices,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  updateCustomerBranches,
  addCustomerBranch,
  updateCustomerBranch,
  deleteCustomerBranch,
  addCustomerRequirement,
  updateCustomerRequirement,
  deleteCustomerRequirement,
  insertCustomer,
  findDuplicateCustomers
};
