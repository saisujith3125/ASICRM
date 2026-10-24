const {
  customers,
  enquiries,
  orders,
  leads,
  quotations,
  generateEnquiryId,
  generateOrderId,
  generateLeadId,
  generateQuotationId,
  peekQuotationId,
  persistStore,
  removeCustomerById
} = require('../data/crmStore');
const { insertCustomer } = require('./customerController');
const {
  ENQUIRY_TYPES,
  FORCE_CLOSE_REASONS,
  isTerminalStatus,
  contactPersonOf,
  shouldShowAssignedEmployee
} = require('../utils/crmHelpers');
const { filterRecordsBySearch } = require('../utils/searchHelper');

const accessControlPath = require('path').join(__dirname, '..', 'data', 'access-control.json');
const stocksFilePath = require('path').join(__dirname, '..', 'data', 'stocks-data.json');
const { hasPermission, getCurrentUser, requirePermission } = require('../utils/accessControl');
const { getAuthoritativeProducts, getProductAvailableStock } = require('./stockController');
const stockService = require('../utils/stockService');
const {
  commitQuotationStock,
  revertQuotationStock,
  reconcileQuotationStock
} = stockService;

function getStockProducts() {
  try {
    return getAuthoritativeProducts();
  } catch (err) {
    console.error('Error fetching authoritative stock products:', err);
    return [];
  }
}

function getStockBrands() {
  try {
    const fs = require('fs');
    if (fs.existsSync(stocksFilePath)) {
      const data = JSON.parse(fs.readFileSync(stocksFilePath, 'utf8'));
      return data.brands || [];
    }
  } catch (err) {
    console.error('Error fetching authoritative stock brands:', err);
  }
  return [];
}

function enrichQuotationItemBrand(it, stockProducts, stockBrands) {
  const isInstallation = Boolean(
    it.isInstallationCharge ||
    it.productId === 'SERVICE-INSTALLATION-TESTING' ||
    it.productCode === 'SRV-INST-001' ||
    String(it.productName || it.name || '').trim().toLowerCase().includes('installation testing & commissioning')
  );
  if (isInstallation) {
    return {
      ...it,
      brandId: '',
      brandName: '',
      brand: '',
      hsnSac: it.hsnSac || '995469'
    };
  }

  const prod = (stockProducts || []).find((p) =>
    (it.productId && p.id === it.productId) ||
    (it.productCode && p.code === it.productCode) ||
    (it.productName && p.name === it.productName)
  );

  const brandId = it.brandId || prod?.brandId || '';
  const brandObj = (stockBrands || []).find((b) => b.id === brandId);
  let brandName = (it.brandName || it.brand || prod?.brand || prod?.brandName || brandObj?.name || '').trim();

  if (!brandName) {
    const text = String(it.productName || it.name || prod?.name || '').trim();
    if (/^dahua\b/i.test(text)) brandName = 'Dahua';
    else if (/^cp\s*plus\b/i.test(text)) brandName = 'CP Plus';
    else if (/^hikvision\b/i.test(text)) brandName = 'Hikvision';
    else if (/^tp[\s\-]?link\b/i.test(text)) brandName = 'TP-Link';
    else if (/^(?:wd|western\s*digital)\b/i.test(text)) brandName = 'Western Digital';
    else if (/^d[\s\-]?link\b/i.test(text)) brandName = 'D-Link';
    else if (/^sony\b/i.test(text)) brandName = 'Sony';
    else if (/^seagate\b/i.test(text)) brandName = 'Seagate';
    else if (/^sensinova\b/i.test(text)) brandName = 'sensinova';
    else if (/^active\b/i.test(text)) brandName = 'Active';
  }

  return {
    ...it,
    brandId: brandId || (brandObj?.id || ''),
    brandName: brandName || '',
    brand: brandName || '',
    hsnSac: it.hsnSac || prod?.hsnSac || prod?.hsnCode || '85258090'
  };
}

function readAccessControl() {
  try { return JSON.parse(require('fs').readFileSync(accessControlPath, 'utf8')); }
  catch { return { users: [], roles: [], permissions: {} }; }
}

function requestUser(req) {
  const data = readAccessControl();
  const userId = String(req.headers['x-user-id'] || '');
  const found = (data.users || []).find((item) => item.id === userId && item.status === 'Active');
  if (!found) return null;
  const role = String(found.role || '').toUpperCase();
  const roleConfig = (data.roles || []).find((item) => item.key === role) || {};
  return { ...found, role };
}


function quotationForViewer(quotation, req) {
  if (!quotation) return null;
  const user = requestUser(req);
  if (!user) return null;
  return { ...quotation };
}

function enquiryForViewer(enquiry, req) {
  if (hasPermission(req, 'Quotations', 'View')) return { ...enquiry };
  const safe = { ...enquiry };
  delete safe.quotationAmount;
  delete safe.quotationItem;
  delete safe.quotationRemarks;
  return safe;
}

/**
 * GET /api/enquiries/leads
 * Return real existing leads for resolution linking.
 */
const getLeads = (req, res) => {
  try {
    const list = leads.map((lead) => ({ ...lead }));
    return res.status(200).json({ success: true, data: list, leads: list });
  } catch (error) {
    console.error('Error in getLeads:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch existing leads.' });
  }
};

/**
 * GET /api/enquiries
 * Supports ?status=, ?priority=, ?source=, ?assignedTo=, ?search=, ?sort=
 */
const isQuotationReady = (enquiry) =>
  Boolean(
    enquiry &&
    enquiry.status !== 'CLOSED' &&
    !enquiry.closureType &&
    (enquiry.status === 'READY_FOR_QUOTATION' || enquiry.workflowStage === 'READY_FOR_QUOTATION' || enquiry.outcome === 'LEAD_CONFIRMATION') &&
    !enquiry.quotationId
  );

// Enquiries ready for quotation do not consume quotation numbers until the
// commercial quotation is actually prepared and saved.
function ensurePendingQuotationId(enquiry) {
  return enquiry?.quotationId || null;
}

const getEnquiries = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Enquiries', 'View')) return;
    const { status, priority, source, assignedTo, search, sort } = req.query;

    // Deduplicate in memory by enquiryId to guarantee one record per enquiry ID
    const uniqueMap = new Map();
    for (const e of enquiries) {
      if (e && e.enquiryId && !uniqueMap.has(e.enquiryId)) {
        uniqueMap.set(e.enquiryId, e);
      }
    }
    const uniqueEnquiries = Array.from(uniqueMap.values());
    let list = [...uniqueEnquiries];
    const viewer = requestUser(req);
    // Employees can review the full enquiry history. Assignment/scope is used
    // for operational write permissions, not for hiding historical records.

    if (status && status !== 'ALL') {
      if (status === 'READY_FOR_QUOTATION') {
        // A quotation-ready enquiry is one whose customer requirement has been
        // confirmed and for which no quotation has been created yet.
        list = list.filter(isQuotationReady);
      } else if (status === 'IN_PROGRESS') {
        list = list.filter((e) => (e.status === 'IN_PROGRESS' || e.status === 'IN_DISCUSSION') && !isQuotationReady(e));
      } else if (status === 'NOT_RESPONDING') {
        list = list.filter((e) => e.status === 'NOT_RESPONDING');
      } else if (status === 'QUOTATION_ISSUED') {
        list = list.filter((e) => e.status === 'QUOTATION_ISSUED');
      } else if (status === 'CASE_CLOSED') {
        list = list.filter((e) => e.status === 'CLOSED' && e.closureType === 'CASE_CLOSED');
      } else if (status === 'FORCE_CLOSED') {
        list = list.filter((e) => e.status === 'CLOSED' && e.closureType === 'FORCE_CLOSED');
      } else if (status === 'CLOSED') {
        list = list.filter((e) => e.status === 'CLOSED');
      } else {
        list = list.filter((e) => e.status === status);
      }
    }

    if (priority && priority !== 'ALL') {
      list = list.filter((e) => e.priority === priority);
    }

    if (source && source !== 'ALL') {
      list = list.filter((e) => e.source === source);
    }

    if (assignedTo && assignedTo !== 'ALL') {
      list = list.filter((e) => e.assignedTo === assignedTo);
    }

    if (search && search.trim()) {
      list = filterRecordsBySearch(list, search, [
        (e) => e.enquiryId,
        (e) => e.customerName,
        (e) => e.customerCompany,
        (e) => e.company,
        (e) => e.customerContactPerson,
        (e) => e.contactPerson,
        (e) => e.customerMobile,
        (e) => e.mobile,
        (e) => e.customerPhone,
        (e) => e.phone,
        (e) => e.customerEmail,
        (e) => e.email,
        (e) => e.type,
        (e) => e.subject,
        (e) => e.description,
        (e) => e.requirement,
        (e) => e.city,
        (e) => e.address,
        (e) => e.status,
        (e) => e.priority,
        (e) => e.assignedTo,
        (e) => e.rep,
        (e) => e.quotationId,
        (e) => e.items
      ]);
    }

    // Sorting
    const priorityWeight = { Urgent: 4, High: 3, Medium: 2, Low: 1 };

    if (sort === 'oldest') {
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sort === 'nextFollowUp') {
      list.sort((a, b) => {
        if (!a.nextFollowUpDate) return 1;
        if (!b.nextFollowUpDate) return -1;
        return new Date(a.nextFollowUpDate) - new Date(b.nextFollowUpDate);
      });
    } else if (sort === 'priority') {
      list.sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));
    } else {
      // Default: ascending sequence (1 above 2)
      list.sort((a, b) => {
        const aVal = String(a.enquiryId || '');
        const bVal = String(b.enquiryId || '');
        const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
        const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
        if (aNum && bNum && aNum !== bNum) return aNum - bNum;
        return aVal.localeCompare(bVal, undefined, { numeric: true });
      });
    }

    // Calculate Summary Metrics based on unique enquiries and current persisted status
    const visibleForMetrics = uniqueEnquiries;
    const metrics = {
      total: visibleForMetrics.length,
      new: visibleForMetrics.filter((e) => e.status === 'NEW').length,
      inProgress: visibleForMetrics.filter((e) => (e.status === 'IN_PROGRESS' || e.status === 'IN_DISCUSSION') && !isQuotationReady(e)).length,
      readyForQuotation: visibleForMetrics.filter(isQuotationReady).length,
      notResponding: visibleForMetrics.filter((e) => e.status === 'NOT_RESPONDING').length,
      caseClosed: visibleForMetrics.filter((e) => e.status === 'CLOSED' && e.closureType === 'CASE_CLOSED').length,
      forceClosed: visibleForMetrics.filter((e) => e.status === 'CLOSED' && e.closureType === 'FORCE_CLOSED').length,
      closed: visibleForMetrics.filter((e) => e.status === 'CLOSED').length
    };

    return res.status(200).json({
      success: true,
      data: list.map((item) => ({
        ...enquiryForViewer(item, req),
        status: isQuotationReady(item) ? 'READY_FOR_QUOTATION' : item.status,
        workflowStage: isQuotationReady(item)
          ? 'READY_FOR_QUOTATION'
          : item.workflowStage || ''
      })),
      metrics
    });
  } catch (error) {
    console.error('Error in getEnquiries:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch enquiries.'
    });
  }
};

/**
 * GET /api/enquiries/:id
 */
const getEnquiryById = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Enquiries', 'View')) return;
    const { id } = req.params;
    const enquiry = enquiries.find((e) => e.enquiryId === id);

    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: `Enquiry ${id} not found.`
      });
    }

    const customer = customers.find((c) => c.id === enquiry.customerId);
    const linkedOrder = enquiry.relatedOrderId ? orders.find((o) => o.orderId === enquiry.relatedOrderId) : null;
    const linkedLead = enquiry.relatedLeadId ? leads.find((lead) => lead.leadId === enquiry.relatedLeadId) : null;
    const quotation = enquiry.quotationId ? quotations.find((quote) => quote.quotationId === enquiry.quotationId) : null;

    return res.status(200).json({
      success: true,
      data: {
        ...enquiryForViewer(enquiry, req),
        customerDetails: customer || null,
        linkedOrder: linkedOrder || null,
        linkedLead: linkedLead || null,
        quotation: quotationForViewer(quotation, req)
      }
    });
  } catch (error) {
    console.error('Error in getEnquiryById:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch enquiry details.'
    });
  }
};

/**
 * POST /api/enquiries
 * STEP 1: CREATE ENQUIRY
 */
const createEnquiry = (req, res) => {
  if (!requirePermission(req, res, 'Enquiries', 'Create')) return;
  let createdCustomerId = null;
  try {
    const {
      customerId: existingCustomerId,
      newCustomer,
      allowDuplicate,
      source,
      type,
      priority,
      assignedTo,
      initialDate,
      initialEnquiryDate,
      initialNotes,
      quickNote,
      description
    } = req.body;

    let customerId = existingCustomerId;

    if (!customerId && newCustomer) {
      const created = insertCustomer(newCustomer, { allowDuplicate: Boolean(allowDuplicate) });
      if (!created.ok) {
        return res.status(created.status).json(created.body);
      }
      createdCustomerId = created.customer.id;
      customerId = created.customer.id;
    }

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Please select a customer.'
      });
    }

    if (!source) {
      return res.status(400).json({
        success: false,
        message: 'Please select an enquiry source.'
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Please select an enquiry type.'
      });
    }

    if (!ENQUIRY_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid enquiry type.'
      });
    }

    if (!priority) {
      return res.status(400).json({
        success: false,
        message: 'Please select a priority level.'
      });
    }

    const customer = customers.find((c) => c.id === customerId);
    if (!customer) {
      if (createdCustomerId) removeCustomerById(createdCustomerId);
      return res.status(404).json({
        success: false,
        message: 'Selected customer does not exist.'
      });
    }

    // Duplicate prevention: if an identical enquiry for this customer was created within last 3 seconds with status NEW, return it
    const recentDuplicate = enquiries.find((e) =>
      e.customerId === customer.id &&
      e.type === type &&
      e.status === 'NEW' &&
      (new Date() - new Date(e.createdAt)) < 3000
    );
    if (recentDuplicate) {
      return res.status(200).json({
        success: true,
        message: 'Enquiry already created.',
        data: recentDuplicate,
        enquiry: recentDuplicate,
        customer
      });
    }

    const now = new Date().toISOString();
    const newEnquiryId = generateEnquiryId();
    const formattedInitialDate = initialDate || initialEnquiryDate || now.split('T')[0];
    const savedQuickNote = quickNote ? quickNote.trim() : initialNotes ? initialNotes.trim() : '';
    const contactPerson = contactPersonOf(customer);

    const newEnquiry = {
      enquiryId: newEnquiryId,
      customerId: customer.id,
      customerName: customer.name,
      customerCompany: contactPerson,
      customerContactPerson: contactPerson,
      customerMobile: customer.mobile || '',
      customerEmail: customer.email || '',
      source: source || 'Phone Call',
      type,
      priority: priority || 'Medium',
      assignedTo: shouldShowAssignedEmployee(type) ? (assignedTo || 'Unassigned') : 'Unassigned',
      status: 'NEW',
      currentStage: 'Created',
      lastAction: 'Enquiry record created',
      nextAction: 'Enter enquiry details',
      nextFollowUpDate: '',
      outcome: '',
      resolution: '',
      closureReason: '',
      closedBy: '',
      closedAt: '',
      lastContactAt: now,
      quickNote: savedQuickNote,
      initialEnquiryDate: formattedInitialDate,
      description: description ? description.trim() : '',
      additionalNotes: '',
      productsInterested: '',
      expectedBudget: '',
      attachments: [],
      createdAt: initialDate ? new Date(initialDate).toISOString() : now,
      updatedAt: now,
      followUps: []
    };

    enquiries.unshift(newEnquiry);
    persistStore();

    return res.status(201).json({
      success: true,
      message: 'Enquiry created successfully.',
      data: newEnquiry,
      enquiry: newEnquiry,
      customer
    });
  } catch (error) {
    console.error('Error in createEnquiry:', error);
    if (createdCustomerId) removeCustomerById(createdCustomerId);
    return res.status(500).json({
      success: false,
      message: 'Failed to create enquiry.'
    });
  }
};

/**
 * PUT /api/enquiries/:id
 * STEP 2: ENQUIRY DETAILS UPDATE
 */
const updateEnquiryDetails = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Enquiries', 'Edit')) return;
    const { id } = req.params;
    const {
      description,
      productsInterested,
      expectedBudget,
      additionalNotes,
      attachments,
      priority,
      assignedTo,
      source,
      type
    } = req.body;

    const enquiry = enquiries.find((e) => e.enquiryId === id);
    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: `Enquiry ${id} not found.`
      });
    }

    if (description !== undefined && !description.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Enquiry description is required before proceeding.'
      });
    }

    if (type !== undefined && type && !ENQUIRY_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid enquiry type.'
      });
    }

    if (isTerminalStatus(enquiry.status)) {
      return res.status(400).json({
        success: false,
        message: 'This enquiry is closed. Create a new enquiry for the same customer if they return.'
      });
    }

    const now = new Date().toISOString();

    if (description !== undefined) enquiry.description = description.trim();
    if (productsInterested !== undefined) enquiry.productsInterested = productsInterested.trim();
    if (expectedBudget !== undefined) enquiry.expectedBudget = expectedBudget.trim();
    if (additionalNotes !== undefined) enquiry.additionalNotes = additionalNotes.trim();
    if (attachments !== undefined) enquiry.attachments = attachments;
    if (priority !== undefined) enquiry.priority = priority;
    if (assignedTo !== undefined) enquiry.assignedTo = assignedTo;
    if (source !== undefined) enquiry.source = source;
    if (type !== undefined) enquiry.type = type;

    // Transition NEW -> IN_PROGRESS once description is saved
    if (enquiry.status === 'NEW' && enquiry.description) {
      enquiry.status = 'IN_PROGRESS';
      enquiry.currentStage = 'Requirements Recorded';
      enquiry.nextAction = 'Initiate first follow up';
    }

    enquiry.updatedAt = now;
    persistStore();

    return res.status(200).json({
      success: true,
      message: 'Enquiry details saved successfully.',
      data: enquiry
    });
  } catch (error) {
    console.error('Error in updateEnquiryDetails:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update enquiry details.'
    });
  }
};

/**
 * POST /api/enquiries/:id/follow-ups
 * STEP 3: LOG FOLLOW-UP INTERACTION
 */
const addFollowUp = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Enquiries', 'Follow Up')) return;
    const { id } = req.params;
    const { contactType, contactDate, employee, notes, outcome, nextAction, nextFollowUpDate } = req.body;

    if (!contactType) {
      return res.status(400).json({
        success: false,
        message: 'Please select a contact type.'
      });
    }

    if (!notes || !notes.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Discussion notes are required.'
      });
    }

    const enquiry = enquiries.find((e) => e.enquiryId === id);
    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: `Enquiry ${id} not found.`
      });
    }

    if (isTerminalStatus(enquiry.status)) {
      return res.status(400).json({
        success: false,
        message: 'Follow-up cannot be logged on a closed enquiry. Create a new enquiry for this customer instead.'
      });
    }

    const now = new Date().toISOString();
    const followUpId = `FU-${id.replace('ENQ-', '')}-${(enquiry.followUps || []).length + 1}`;
    const workflowOutcome = req.body.workflowOutcome || '';

    const newFollowUp = {
      id: followUpId,
      contactType: contactType || 'Phone Call',
      contactDate: contactDate ? new Date(contactDate).toISOString() : now,
      employee: employee || enquiry.assignedTo || 'John Doe',
      notes: notes.trim(),
      outcome: outcome ? outcome.trim() : 'Follow-up interaction recorded',
      nextAction: nextAction ? nextAction.trim() : 'Determine next action',
      nextFollowUpDate: nextFollowUpDate || '',
      createdAt: now
    };

    if (!enquiry.followUps) {
      enquiry.followUps = [];
    }

    enquiry.followUps.push(newFollowUp);
    enquiry.lastContactAt = newFollowUp.contactDate;
    enquiry.lastAction = `${contactType}: ${notes.slice(0, 70)}${notes.length > 70 ? '...' : ''}`;
    if (nextAction) enquiry.nextAction = nextAction.trim();
    if (nextFollowUpDate) enquiry.nextFollowUpDate = nextFollowUpDate;

    const selectedOutcome = req.body.workflowOutcome || req.body.outcome || '';
    if (selectedOutcome === 'LEAD_CONFIRMATION') {
      enquiry.status = 'READY_FOR_QUOTATION';
      enquiry.workflowStage = 'READY_FOR_QUOTATION';
      enquiry.outcome = 'LEAD_CONFIRMATION';
      enquiry.currentStage = 'Lead Confirmation';
      ensurePendingQuotationId(enquiry);
    } else if (selectedOutcome === 'IN_DISCUSSION') {
      enquiry.status = 'IN_PROGRESS';
      enquiry.workflowStage = 'IN_DISCUSSION';
      enquiry.outcome = 'IN_DISCUSSION';
      enquiry.currentStage = 'In Discussion';
    } else if (selectedOutcome === 'NO_RESPONSE') {
      enquiry.status = 'NOT_RESPONDING';
      enquiry.workflowStage = 'NOT_RESPONDING';
      enquiry.outcome = 'NO_RESPONSE';
      enquiry.currentStage = 'No Response';
    } else if (enquiry.status === 'NEW') {
      enquiry.status = 'IN_PROGRESS';
      enquiry.currentStage = 'Follow Up';
    }

    enquiry.updatedAt = now;
    persistStore();

    return res.status(201).json({
      success: true,
      message: 'Follow-up saved successfully.',
      data: enquiry
    });
  } catch (error) {
    console.error('Error in addFollowUp:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save follow-up interaction.'
    });
  }
};

/**
 * PATCH /api/enquiries/:id/status
 * STEP 4: OUTCOME DECISION (NOT_RESPONDING vs IN_PROGRESS CONTINUING)
 */
const updateStatus = (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      reason,
      remarks,
      lastAttemptDate,
      nextFollowUpDate,
      currentStage,
      nextAction,
      updatedNotes,
      closureReason,
      closureNotes,
      closedBy,
      workflowOutcome
    } = req.body;

    const enquiry = enquiries.find((e) => e.enquiryId === id);
    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: `Enquiry ${id} not found.`
      });
    }

    if (isTerminalStatus(enquiry.status) && status !== enquiry.status) {
      return res.status(400).json({
        success: false,
        message: 'This enquiry is already closed. Create a new enquiry for the same customer if they return.'
      });
    }

    const now = new Date().toISOString();
    const decidedOutcome = workflowOutcome || status;

    if (status === 'CLOSED' || decidedOutcome === 'FORCE_CLOSED' || status === 'CANCELLED') {
      if (!requirePermission(req, res, 'Enquiries', 'Close')) return;
    } else {
      if (!requirePermission(req, res, 'Enquiries', 'Follow Up')) return;
    }

    if (status === 'NOT_RESPONDING' || decidedOutcome === 'NO_RESPONSE') {
      enquiry.status = 'NOT_RESPONDING';
      enquiry.outcome = 'NO_RESPONSE';
      enquiry.currentStage = 'No Response';
      enquiry.notRespondingReason = reason || 'No Response from Customer';
      enquiry.notRespondingRemarks = remarks ? remarks.trim() : '';
      enquiry.lastAttemptDate = lastAttemptDate || new Date().toISOString().split('T')[0];
      enquiry.nextFollowUpDate = nextFollowUpDate || '';
      enquiry.lastAction = `Marked Not Responding (${enquiry.notRespondingReason})`;
      enquiry.nextAction = nextFollowUpDate ? 'Re-attempt contact' : 'Re-attempt contact or force close';

      const lastFu = (enquiry.followUps || [])[enquiry.followUps.length - 1];
      if (!lastFu || lastFu.outcome !== 'No Response' || (new Date() - new Date(lastFu.createdAt)) > 5000) {
        enquiry.followUps.push({
          id: `FU-${id.replace('ENQ-', '')}-${(enquiry.followUps || []).length + 1}`,
          contactType: 'Status Update',
          contactDate: now,
          employee: enquiry.assignedTo || 'System',
          notes: `Marked as Not Responding. Reason: ${enquiry.notRespondingReason}.${remarks ? ` Remarks: ${remarks}` : ''}`,
          outcome: 'No Response',
          nextAction: enquiry.nextAction,
          nextFollowUpDate: nextFollowUpDate || '',
          createdAt: now
        });
      }
    } else if (status === 'IN_PROGRESS' || decidedOutcome === 'IN_DISCUSSION') {
      enquiry.status = 'IN_PROGRESS';
      enquiry.outcome = 'IN_DISCUSSION';
      enquiry.workflowStage = 'IN_DISCUSSION';
      enquiry.currentStage = currentStage || 'In Discussion';
      if (nextAction) enquiry.nextAction = nextAction.trim();
      if (nextFollowUpDate) enquiry.nextFollowUpDate = nextFollowUpDate;
      enquiry.lastAction = nextAction ? `In Discussion: ${nextAction}` : 'Moved to In Discussion';

      const lastFu = (enquiry.followUps || [])[enquiry.followUps.length - 1];
      if (updatedNotes || !lastFu || lastFu.outcome !== 'In Discussion' || (new Date() - new Date(lastFu.createdAt)) > 5000) {
        enquiry.followUps.push({
          id: `FU-${id.replace('ENQ-', '')}-${(enquiry.followUps || []).length + 1}`,
          contactType: 'Stage Progress',
          contactDate: now,
          employee: enquiry.assignedTo || 'System',
          notes: updatedNotes ? updatedNotes.trim() : (remarks ? remarks.trim() : 'Enquiry is actively in discussion.'),
          outcome: 'In Discussion',
          nextAction: nextAction || 'Continue follow-up',
          nextFollowUpDate: nextFollowUpDate || '',
          createdAt: now
        });
      }
    } else if (decidedOutcome === 'LEAD_CONFIRMATION' || status === 'READY_FOR_QUOTATION') {
      enquiry.status = 'READY_FOR_QUOTATION';
      enquiry.workflowStage = 'READY_FOR_QUOTATION';
      enquiry.outcome = 'LEAD_CONFIRMATION';
      enquiry.currentStage = 'Lead Confirmation';
      ensurePendingQuotationId(enquiry);
      enquiry.nextFollowUpDate = '';
      enquiry.nextAction = 'Prepare quotation';
      enquiry.lastAction = 'Lead confirmed';

      const lastFu = (enquiry.followUps || [])[enquiry.followUps.length - 1];
      if (!lastFu || lastFu.outcome !== 'Lead Confirmation' || (new Date() - new Date(lastFu.createdAt)) > 5000) {
        enquiry.followUps.push({
          id: `FU-${id.replace('ENQ-', '')}-${(enquiry.followUps || []).length + 1}`,
          contactType: 'Lead Confirmation',
          contactDate: now,
          employee: closedBy || enquiry.assignedTo || 'System',
          notes: remarks ? remarks.trim() : 'Customer confirmed the requirement.',
          outcome: 'Lead Confirmation',
          nextAction: 'Prepare quotation',
          nextFollowUpDate: '',
          createdAt: now
        });
      }
    } else if (status === 'CLOSED' || decidedOutcome === 'FORCE_CLOSED') {
      const finalReason = closureReason || reason;
      if (!finalReason || !String(finalReason).trim()) {
        return res.status(400).json({
          success: false,
          message: 'A closure reason is required.'
        });
      }
      if (FORCE_CLOSE_REASONS.indexOf(finalReason) === -1 && finalReason !== 'Force Closed — No Response') {
        return res.status(400).json({
          success: false,
          message: 'Please select a valid closure reason.'
        });
      }

      enquiry.status = 'CLOSED';
      enquiry.outcome = 'FORCE_CLOSED';
      enquiry.currentStage = 'Closed';
      enquiry.closureType = 'FORCE_CLOSED';
      enquiry.closureReason = finalReason === 'No Response' ? 'Force Closed — No Response' : finalReason;
      enquiry.closureNotes = (closureNotes || remarks || '').trim();
      enquiry.closedBy = closedBy || enquiry.assignedTo || 'System';
      enquiry.closedAt = now;
      enquiry.nextFollowUpDate = '';
      enquiry.nextAction = 'Enquiry closed';
      enquiry.lastAction = `Force closed: ${enquiry.closureReason}`;

      const lastFu = (enquiry.followUps || [])[enquiry.followUps.length - 1];
      if (!lastFu || lastFu.outcome !== enquiry.closureReason || (new Date() - new Date(lastFu.createdAt)) > 5000) {
        enquiry.followUps.push({
          id: `FU-${id.replace('ENQ-', '')}-${(enquiry.followUps || []).length + 1}`,
          contactType: 'Force Close',
          contactDate: now,
          employee: enquiry.closedBy,
          notes: enquiry.closureNotes || `Enquiry force closed. Reason: ${enquiry.closureReason}`,
          outcome: enquiry.closureReason,
          nextAction: 'None (Closed)',
          nextFollowUpDate: '',
          createdAt: now
        });
      }
    } else if (status === 'CANCELLED') {
      enquiry.status = 'CANCELLED';
      enquiry.cancelReason = reason || 'Cancelled by user';
      enquiry.nextFollowUpDate = '';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid outcome. Choose No Response, In Discussion, Lead Confirmation, or Force Close.'
      });
    }

    enquiry.updatedAt = now;
    persistStore();

    return res.status(200).json({
      success: true,
      message: status === 'CLOSED' || decidedOutcome === 'FORCE_CLOSED'
        ? 'Enquiry closed.'
        : status === 'NOT_RESPONDING' || decidedOutcome === 'NO_RESPONSE'
        ? 'Enquiry marked as Not Responding.'
        : 'Enquiry updated successfully.',
      data: enquiry
    });
  } catch (error) {
    console.error('Error in updateStatus:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update status.'
    });
  }
};

/**
 * GET /api/enquiries/quotation-queue
 * Return confirmed enquiries that are ready for a quotation but do not yet
 * have a quotation record. This is deliberately exposed through the
 * Quotations domain so the Quotations screen is the single place a quotation
 * user goes after lead confirmation.
 */
const getQuotationQueue = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Quotations', 'View')) return;
    const list = enquiries
      .filter(isQuotationReady)
      .map((enquiry) => ({
        ...enquiryForViewer(enquiry, req),
        workflowStage: 'READY_FOR_QUOTATION',
        quotationPending: true,
        quotationId: ensurePendingQuotationId(enquiry),
        amount: null,
        grandTotal: null,
        item: enquiry.productsInterested || enquiry.description || 'Confirmed requirement',
        validUntil: '',
        remarks: ''
      }))
      .sort((a, b) => {
        const priorityWeight = { Urgent: 4, High: 3, Medium: 2, Low: 1 };
        const priorityDiff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
        if (priorityDiff) return priorityDiff;
        return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      });

    return res.status(200).json({ success: true, data: list, count: list.length });
  } catch (error) {
    console.error('Error in getQuotationQueue:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch quotation queue.' });
  }
};

/**
 * GET /api/enquiries/quotations
 * Return persisted quotations with linked enquiry/customer context.
 * Employees have read access; Admin/Super Admin may additionally manage them.
 */
const getQuotations = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Quotations', 'View')) return;
    const stockProducts = getStockProducts();
    const stockBrands = getStockBrands();
    const list = quotations.map((quote) => {
      const enquiry = enquiries.find((item) => item.enquiryId === quote.enquiryId);
      const customer = customers.find((item) => item.id === quote.customerId);
      const enrichedItems = (quote.items || []).map((it) => enrichQuotationItemBrand(it, stockProducts, stockBrands));
      return {
        ...quote,
        items: enrichedItems,
        source: quote.source || (quote.enquiryId ? 'ENQUIRY' : 'DIRECT'),
        status: (quote.status === 'READY_FOR_QUOTATION' || quote.status === 'ISSUED' || quote.status === 'AWAITING_CUSTOMER' || !quote.status) ? 'PENDING' : quote.status,
        enquiryId: quote.enquiryId || null,
        customerName: quote.customerName || enquiry?.customerName || customer?.name || 'Customer',
        customerId: quote.customerId || enquiry?.customerId || customer?.id || '',
        enquiryStatus: enquiry?.status || '',
        closureType: enquiry?.closureType || '',
        orderId: quote.orderId || enquiry?.relatedOrderId || ''
      };
    });
    list.sort((a, b) => {
      const aVal = String(a.quotationId || '');
      const bVal = String(b.quotationId || '');
      const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
      const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
      if (aNum && bNum && aNum !== bNum) return aNum - bNum;
      return aVal.localeCompare(bVal, undefined, { numeric: true });
    });

    const search = req.query.search || req.query.q;
    if (search && String(search).trim()) {
      list = filterRecordsBySearch(list, search, [
        (q) => q.quotationId,
        (q) => q.quotationNumber,
        (q) => q.quoteNumber,
        (q) => q.customerId,
        (q) => q.customerName,
        (q) => q.customerCompany,
        (q) => q.company,
        (q) => q.contactPerson,
        (q) => q.customerPhone,
        (q) => q.phone,
        (q) => q.mobile,
        (q) => q.customerEmail,
        (q) => q.email,
        (q) => q.enquiryId,
        (q) => q.orderId,
        (q) => q.status,
        (q) => q.items?.map((it) => `${it.productName || it.name || ''} ${it.brandName || it.brand || ''} ${it.productCode || it.code || ''} ${it.sku || ''} ${it.description || ''}`)
      ]);
    }

    return res.status(200).json({ success: true, data: list });
  } catch (error) {
    console.error('Error in getQuotations:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch quotations.' });
  }
};

/**
 * GET /api/enquiries/quotations/next-id
 * Read-only preview of next sequential quotation number
 */
const getNextQuotationIdPreview = (req, res) => {
  try {
    return res.status(200).json({ success: true, nextQuotationId: peekQuotationId() });
  } catch (error) {
    console.error('Error in getNextQuotationIdPreview:', error);
    return res.status(500).json({ success: false, message: 'Failed to preview next quotation ID.' });
  }
};

/**
 * GET /api/enquiries/quotation/:quotationId
 * Return full details of a specific quotation
 */
const getQuotationById = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Quotations', 'View')) return;
    const { quotationId } = req.params;
    const quote = quotations.find((q) => q.quotationId === quotationId);
    if (!quote) {
      return res.status(404).json({ success: false, message: `Quotation ${quotationId} not found.` });
    }
    const enquiry = enquiries.find((item) => item.enquiryId === quote.enquiryId);
    const customer = customers.find((item) => item.id === quote.customerId);
    const stockProducts = getStockProducts();
    const stockBrands = getStockBrands();
    const enrichedItems = (quote.items || []).map((it) => enrichQuotationItemBrand(it, stockProducts, stockBrands));
    return res.status(200).json({
      success: true,
      data: {
        ...quote,
        items: enrichedItems,
        source: quote.source || (quote.enquiryId ? 'ENQUIRY' : 'DIRECT'),
        status: (quote.status === 'READY_FOR_QUOTATION' || quote.status === 'ISSUED' || quote.status === 'AWAITING_CUSTOMER' || !quote.status) ? 'PENDING' : quote.status,
        customerName: quote.customerName || enquiry?.customerName || customer?.name || 'Customer',
        customerId: quote.customerId || enquiry?.customerId || customer?.id || '',
        customerCompany: customer?.company || '',
        customerMobile: customer?.mobile || '',
        customerEmail: customer?.email || '',
        customerCity: customer?.city || '',
        enquiryStatus: enquiry?.status || '',
        orderId: quote.orderId || enquiry?.relatedOrderId || ''
      },
      customer: customer || null,
      enquiry: enquiry || null
    });
  } catch (error) {
    console.error('Error in getQuotationById:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch quotation details.' });
  }
};

/**
 * Helper to process quotation line items from payload
 */
function parseQuotationLineItems(items, amount, item, options = {}) {
  let parsedItems = [];
  let grandTotal = 0;
  let subtotal = 0;
  let discountTotal = 0;
  let taxableTotal = 0;
  let gstTotal = 0;
  let summaryText = '';
  const showDiscount = Boolean(options?.showDiscount);
  const roundOffTotal = Boolean(options?.roundOffTotal);
  const showStock = Boolean(options?.showStock);

  if (Array.isArray(items) && items.length > 0) {
    const stockProducts = getStockProducts();
    const seenProductIds = new Set();
    const aggregatedQuantities = new Map();

    for (const line of items) {
      const isInstallation = Boolean(
        line?.isInstallationCharge ||
        line?.productId === 'SERVICE-INSTALLATION-TESTING' ||
        line?.productCode === 'SRV-INST-001' ||
        String(line?.productName || '').trim().toLowerCase().includes('installation testing & commissioning')
      );

      if (isInstallation) {
        const qty = 1;
        const unitPrice = Math.max(0, Number(line.unitPrice || 0));
        const gstPct = Number(line.gst !== undefined ? line.gst : 18);
        const lineSubtotal = Math.round(qty * unitPrice * 100) / 100;
        const taxableAmount = lineSubtotal;
        const lineTax = Math.round(((taxableAmount * gstPct) / 100) * 100) / 100;
        const lineTotal = Math.round((taxableAmount + lineTax) * 100) / 100;

        subtotal += lineSubtotal;
        taxableTotal += taxableAmount;
        gstTotal += lineTax;

        parsedItems.push({
          productId: 'SERVICE-INSTALLATION-TESTING',
          productCode: 'SRV-INST-001',
          productName: 'Installation Testing & Commissioning Charges',
          description: String(line.description || '').trim(),
          hsnSac: line.hsnSac || '995469',
          brandId: '',
          categoryId: '',
          subcategoryId: null,
          unit: 'Job',
          quantity: qty,
          unitPrice,
          minPrice: 0,
          discount: 0,
          discountPercent: 0,
          discountAmount: 0,
          taxableAmount,
          gst: gstPct,
          isIGSTApplicable: Boolean(line.isIGSTApplicable),
          lineSubtotal,
          lineTax,
          lineTotal,
          isInstallationCharge: true
        });
        continue;
      }

      const productId = String(line?.productId || '').trim();
      const productCode = String(line?.productCode || '').trim();

      // Duplicate product check using canonical product key
      const canonicalKey = productId || productCode;
      if (canonicalKey) {
        const lowerKey = canonicalKey.toLowerCase();
        if (seenProductIds.has(lowerKey)) {
          return { error: 'This product is already added to the quotation.' };
        }
        seenProductIds.add(lowerKey);
      }

      const prod = stockProducts.find((p) =>
        (productId && p.id === productId) ||
        (productCode && p.code === productCode)
      );

      const itemName = String(line?.productName || prod?.name || line?.name || '').trim();
      if (!prod && !itemName) {
        return { error: `Product ${productId || productCode || ''} is missing a name.` };
      }

      const qty = Number(line.quantity || 0);
      const unitPrice = Number(line.unitPrice || 0);
      const minPrice = prod ? Number(prod.dealerPrice || prod.price || prod.unitPrice || 0) : Number(line.minPrice || 0);
      const gstPct = Number(prod?.gst !== undefined ? prod.gst : (line.gst !== undefined ? line.gst : 18));
      const discountPct = showDiscount
        ? Math.max(0, Math.min(100, Number(line.discount !== undefined ? line.discount : (line.discountPercent || 0))))
        : 0;

      const availStock = prod ? Number(prod.availableStock !== undefined ? prod.availableStock : (prod.stock || 0)) : 0;

      if (!Number.isInteger(qty) || qty <= 0) {
        return { error: `Quantity for "${itemName}" must be a positive whole number.` };
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return { error: `Selling price for "${itemName}" must be greater than or equal to zero.` };
      }
      if (minPrice > 0 && unitPrice < minPrice) {
        return { error: `Quotation price for "${itemName}" cannot be lower than the dealer price (₹${Number(minPrice).toLocaleString('en-IN')}).` };
      }

      const lineSubtotal = Math.round(qty * unitPrice * 100) / 100;
      const discountAmount = Math.round((lineSubtotal * (discountPct / 100)) * 100) / 100;
      const taxableAmount = Math.max(0, Math.round((lineSubtotal - discountAmount) * 100) / 100);
      const lineTax = Math.round(((taxableAmount * gstPct) / 100) * 100) / 100;
      const lineTotal = Math.round((taxableAmount + lineTax) * 100) / 100;

      subtotal += lineSubtotal;
      discountTotal += discountAmount;
      taxableTotal += taxableAmount;
      gstTotal += lineTax;

      // Authoritative quotation description: quotation user's description if provided, otherwise Product Master description
      const description = String(line.description !== undefined ? line.description : (prod?.description || '')).trim();

      const stockBrands = getStockBrands();
      const brandObj = stockBrands.find((b) => b.id === (prod?.brandId || line.brandId));
      const brandName = (line.brandName || line.brand || prod?.brand || prod?.brandName || brandObj?.name || '').trim();

      parsedItems.push({
        productId: prod ? prod.id : (productId || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
        productCode: prod ? prod.code : (productCode || 'CUSTOM'),
        productName: itemName,
        description,
        hsnSac: line.hsnSac || prod?.hsnSac || prod?.hsnCode || '',
        brandId: prod?.brandId || '',
        brandName: brandName || '',
        brand: brandName || '',
        categoryId: prod?.categoryId || '',
        subcategoryId: prod?.subcategoryId || null,
        unit: (line.unit && line.unit !== 'Piece') ? line.unit : ((prod?.unit && prod.unit !== 'Piece') ? prod.unit : 'Nos'),
        quantity: qty,
        unitPrice,
        minPrice,
        mrp: Number(prod?.mrp || line.mrp || unitPrice),
        dealerPrice: Number(prod?.dealerPrice || minPrice || 0),
        stock: availStock,
        availableStock: availStock,
        discount: discountPct,
        discountPercent: discountPct,
        discountAmount,
        taxableAmount,
        gst: gstPct,
        isIGSTApplicable: Boolean(line.isIGSTApplicable !== undefined ? line.isIGSTApplicable : prod?.isIGSTApplicable),
        lineSubtotal,
        lineTax,
        lineTotal
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;
    discountTotal = Math.round(discountTotal * 100) / 100;
    taxableTotal = Math.round(taxableTotal * 100) / 100;
    gstTotal = Math.round(gstTotal * 100) / 100;

    const calculatedTotal = Math.round((taxableTotal + gstTotal) * 100) / 100;
    let roundOff = 0;
    grandTotal = calculatedTotal;

    if (roundOffTotal && calculatedTotal > 0) {
      grandTotal = Math.floor(calculatedTotal + 1e-9) + 1;
      roundOff = Math.round((grandTotal - calculatedTotal) * 100) / 100;
    } else {
      grandTotal = calculatedTotal;
      roundOff = 0;
    }

    summaryText = parsedItems.map((i) => `${i.quantity}x ${i.productName}`).join(', ');
  } else {
    // Legacy/manual quotation support is preserved for existing records.
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { error: 'A valid positive quotation amount is required.' };
    }
    if (!item || !String(item).trim()) {
      return { error: 'Quoted item / plan is required.' };
    }

    grandTotal = numericAmount;
    subtotal = numericAmount;
    taxableTotal = numericAmount;
    discountTotal = 0;
    gstTotal = 0;
    summaryText = String(item).trim();
  }

  const calculatedTotal = Math.round((taxableTotal + gstTotal) * 100) / 100;
  let roundOff = 0;
  if (roundOffTotal && calculatedTotal > 0) {
    grandTotal = Math.floor(calculatedTotal + 1e-9) + 1;
    roundOff = Math.round((grandTotal - calculatedTotal) * 100) / 100;
  } else {
    grandTotal = calculatedTotal;
    roundOff = 0;
  }

  return {
    parsedItems,
    subtotal,
    discountTotal,
    taxableTotal,
    gstTotal,
    calculatedTotal,
    roundOff,
    grandTotal,
    showDiscount,
    roundOffTotal,
    showStock,
    summaryText
  };
}

/**
 * PUT /api/enquiries/:id/quotation
 * Admin/Super Admin edit an existing quotation.
 */
const updateQuotation = (req, res) => {
  try {
    const adminUser = getCurrentUser(req);
    if (!hasPermission(req, 'Quotations', 'Edit')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to edit quotations.' });
    }
    const enquiry = enquiries.find((e) => e.enquiryId === req.params.id);
    if (!enquiry) return res.status(404).json({ success: false, message: `Enquiry ${req.params.id} not found.` });
    const quotation = quotations.find((q) => q.quotationId === enquiry.quotationId);
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found for this enquiry.' });
    if (quotation.status === 'CONVERTED') return res.status(400).json({ success: false, message: 'A converted quotation cannot be edited.' });

    const { amount, item, validUntil, remarks, items, customerId, showDiscount, roundOffTotal, showStock, termsAndConditions, terms, notes, headerTitle } = req.body;
    const parsed = parseQuotationLineItems(items, amount, item, { showDiscount, roundOffTotal, showStock });
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    if (customerId) {
      const cust = customers.find((c) => c.id === customerId);
      if (cust) {
        quotation.customerId = cust.id;
        quotation.customerName = cust.name;
        enquiry.customerId = cust.id;
        enquiry.customerName = cust.name;
      }
    }

    const now = new Date().toISOString();
    quotation.amount = parsed.grandTotal;
    quotation.item = parsed.summaryText;
    quotation.items = parsed.parsedItems;
    quotation.subtotal = parsed.subtotal;
    quotation.discountTotal = parsed.discountTotal;
    quotation.taxableTotal = parsed.taxableTotal;
    quotation.gstTotal = parsed.gstTotal;
    quotation.calculatedTotal = parsed.calculatedTotal;
    quotation.roundOff = parsed.roundOff;
    quotation.grandTotal = parsed.grandTotal;
    quotation.showDiscount = parsed.showDiscount;
    quotation.roundOffTotal = parsed.roundOffTotal;
    quotation.showStock = parsed.showStock;
    quotation.validUntil = validUntil !== undefined ? validUntil : quotation.validUntil || '';
    quotation.remarks = String(remarks ?? quotation.remarks ?? '').trim();
    if (notes !== undefined) quotation.notes = String(notes).trim();
    if (termsAndConditions !== undefined) {
      quotation.termsAndConditions = String(termsAndConditions).trim();
      quotation.terms = quotation.termsAndConditions;
    } else if (terms !== undefined) {
      quotation.termsAndConditions = String(terms).trim();
      quotation.terms = String(terms).trim();
    }
    if (headerTitle !== undefined) quotation.headerTitle = String(headerTitle).trim();
    quotation.updatedAt = now;
    quotation.updatedBy = adminUser ? adminUser.name : 'System';

    enquiry.quotationAmount = quotation.grandTotal;
    enquiry.quotationItem = quotation.item;
    enquiry.quotationValidUntil = quotation.validUntil;
    enquiry.quotationRemarks = quotation.remarks;
    enquiry.lastAction = `Quotation updated: ${quotation.quotationId}`;
    enquiry.updatedAt = now;
    persistStore();

    return res.status(200).json({ success: true, message: 'Quotation updated successfully.', data: enquiry, quotation });
  } catch (error) {
    console.error('Error in updateQuotation:', error);
    return res.status(500).json({ success: false, message: 'Failed to update quotation.' });
  }
};

/**
 * DELETE /api/enquiries/:id/quotation
 * Admin/Super Admin may remove an unconverted quotation. The enquiry returns
 * to the confirmed-but-pending state so the commercial workflow is not orphaned.
 */
const deleteQuotation = (req, res) => {
  try {
    const adminUser = getCurrentUser(req);
    if (!hasPermission(req, 'Quotations', 'Delete')) return res.status(403).json({ success: false, message: 'You do not have permission to delete quotations.' });
    const index = quotations.findIndex((q) => q.quotationId === req.params.id);
    if (index < 0) return res.status(404).json({ success: false, message: `Quotation ${req.params.id} not found.` });
    const quotation = quotations[index];
    const isConverted = quotation.status === 'CONVERTED' || Boolean(quotation.orderId);

    // Restore stock if this quotation had already committed/deducted stock (and wasn't converted into order)
    if (quotation.stockDeducted === true && !isConverted) {
      revertQuotationStock(quotation, adminUser, 'Quotation Deleted');
    }

    const enquiry = enquiries.find((e) => e.enquiryId === quotation.enquiryId);
    quotations.splice(index, 1);
    if (enquiry && !isConverted) {
      enquiry.quotationId = undefined;
      delete enquiry.quotationAmount;
      delete enquiry.quotationItem;
      delete enquiry.quotationValidUntil;
      delete enquiry.quotationRemarks;
      enquiry.status = 'IN_PROGRESS';
      enquiry.closureType = undefined;
      enquiry.currentStage = 'Lead Confirmation';
      enquiry.workflowStage = 'READY_FOR_QUOTATION';
      enquiry.outcome = 'LEAD_CONFIRMATION';
      enquiry.nextAction = 'Prepare quotation';
      enquiry.lastAction = `Quotation ${quotation.quotationId} deleted by ${adminUser.name}`;
      enquiry.closedAt = undefined;
      enquiry.closedBy = undefined;
      enquiry.solvedAt = undefined;
      enquiry.solvedBy = undefined;
      enquiry.updatedAt = new Date().toISOString();
    }
    persistStore();
    return res.status(200).json({ success: true, message: 'Quotation deleted successfully.' });
  } catch (error) {
    console.error('Error in deleteQuotation:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete quotation.' });
  }
};

/**
 * POST /api/enquiries/:id/quotation
 * QUOTATION MODULE: create a commercial quotation after lead confirmation.
 * Issuing a quotation does not close the enquiry. The enquiry remains active
 * until the quotation is converted into an order or the case is otherwise closed.
 */
const createQuotation = (req, res) => {
  try {
    const adminUser = getCurrentUser(req);
    if (!hasPermission(req, 'Quotations', 'Create')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to create quotations.' });
    }

    const { amount, item, validUntil, remarks, items, status: requestedStatus, customerId, showDiscount, roundOffTotal, showStock, termsAndConditions, terms, notes, headerTitle } = req.body;
    const enquiry = enquiries.find((e) => e.enquiryId === req.params.id);

    if (!enquiry) return res.status(404).json({ success: false, message: `Enquiry ${req.params.id} not found.` });
    if (isTerminalStatus(enquiry.status)) return res.status(400).json({ success: false, message: 'This enquiry is already closed.' });
    if (enquiry.outcome !== 'LEAD_CONFIRMATION') {
      return res.status(400).json({ success: false, message: 'Lead confirmation is required before creating a quotation.' });
    }
    if (enquiry.quotationId) {
      return res.status(409).json({ success: false, message: `Quotation ${enquiry.quotationId} already exists. Use Edit instead.` });
    }

    const parsed = parseQuotationLineItems(items, amount, item, { showDiscount, roundOffTotal, showStock });
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const cust = customerId ? customers.find((c) => c.id === customerId) : null;
    const finalCustId = cust?.id || enquiry.customerId;
    const finalCustName = cust?.name || enquiry.customerName;

    if (cust) {
      enquiry.customerId = cust.id;
      enquiry.customerName = cust.name;
    }

    // Double submission protection
    const recentDuplicate = quotations.find((q) => {
      const sameEnquiry = q.enquiryId === enquiry.enquiryId;
      const isRecent = (Date.now() - new Date(q.createdAt).getTime()) < 3500;
      return sameEnquiry && isRecent;
    });
    if (recentDuplicate) {
      return res.status(200).json({
        success: true,
        message: `Quotation ${recentDuplicate.quotationId} already created.`,
        data: recentDuplicate
      });
    }

    const now = new Date().toISOString();
    const initialQuotationStatus = requestedStatus && ['READY_FOR_QUOTATION', 'DRAFT', 'ISSUED', 'AWAITING_CUSTOMER', 'AWAITING_DECISION', 'PENDING'].includes(requestedStatus)
      ? ((requestedStatus === 'READY_FOR_QUOTATION' || requestedStatus === 'AWAITING_CUSTOMER') ? 'PENDING' : requestedStatus)
      : 'PENDING';

    const generatedQuoteId = generateQuotationId();
    const quotation = {
      quotationId: generatedQuoteId,
      proposalNumber: generatedQuoteId,
      source: 'ENQUIRY',
      enquiryId: enquiry.enquiryId,
      customerId: finalCustId,
      customerName: finalCustName,
      amount: parsed.grandTotal,
      item: parsed.summaryText,
      items: parsed.parsedItems,
      subtotal: parsed.subtotal,
      discountTotal: parsed.discountTotal,
      taxableTotal: parsed.taxableTotal,
      gstTotal: parsed.gstTotal,
      calculatedTotal: parsed.calculatedTotal,
      roundOff: parsed.roundOff,
      grandTotal: parsed.grandTotal,
      showDiscount: parsed.showDiscount,
      roundOffTotal: parsed.roundOffTotal,
      showStock: parsed.showStock,
      validUntil: validUntil || '',
      remarks: remarks ? String(remarks).trim() : '',
      notes: notes !== undefined ? String(notes).trim() : (remarks ? String(remarks).trim() : ''),
      termsAndConditions: termsAndConditions !== undefined ? String(termsAndConditions).trim() : (terms !== undefined ? String(terms).trim() : ''),
      terms: termsAndConditions !== undefined ? String(termsAndConditions).trim() : (terms !== undefined ? String(terms).trim() : ''),
      headerTitle: headerTitle ? String(headerTitle).trim() : 'QUOTATION',
      status: initialQuotationStatus,
      createdBy: adminUser.name,
      createdAt: now,
      updatedAt: now
    };

    quotations.unshift(quotation);
    enquiry.quotationId = quotation.quotationId;
    delete enquiry.pendingQuotationId;
    enquiry.quotationAmount = parsed.grandTotal;
    enquiry.quotationItem = parsed.summaryText;
    enquiry.quotationValidUntil = quotation.validUntil;
    enquiry.quotationRemarks = quotation.remarks;
    enquiry.status = 'QUOTATION_ISSUED';
    enquiry.closureType = undefined;
    enquiry.currentStage = 'Quotation Issued';
    enquiry.workflowStage = 'QUOTATION_ISSUED';
    enquiry.solvedAt = undefined;
    enquiry.solvedBy = undefined;
    enquiry.closedAt = undefined;
    enquiry.closedBy = undefined;
    enquiry.nextAction = 'Awaiting customer decision';
    enquiry.nextFollowUpDate = quotation.validUntil || '';
    enquiry.lastAction = `Quotation issued: ${quotation.quotationId}`;
    enquiry.updatedAt = now;

    if (!Array.isArray(enquiry.followUps)) enquiry.followUps = [];
    enquiry.followUps.push({
      id: `FU-${enquiry.enquiryId.replace('ENQ-', '')}-${enquiry.followUps.length + 1}`,
      contactType: 'Quotation',
      contactDate: now,
      employee: quotation.createdBy,
      notes: `Quotation ${quotation.quotationId} issued for ₹${parsed.grandTotal.toLocaleString('en-IN')} — ${parsed.summaryText}.`,
      outcome: 'Quotation issued to customer',
      nextAction: 'Await customer decision',
      nextFollowUpDate: quotation.validUntil || '',
      createdAt: now
    });

    persistStore();
    return res.status(201).json({
      success: true,
      message: `Quotation ${quotation.quotationId} issued successfully. Awaiting customer decision.`,
      data: enquiry,
      quotation
    });
  } catch (error) {
    console.error('Error in createQuotation:', error);
    return res.status(500).json({ success: false, message: 'Failed to create quotation.' });
  }
};

/**
 * POST /api/enquiries/quotations
 * Dedicated quotation creation (standalone or linked to an enquiry).
 */
const createStandaloneQuotation = (req, res) => {
  try {
    const adminUser = getCurrentUser(req);
    if (!hasPermission(req, 'Quotations', 'Create')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to create quotations.' });
    }

    const {
      customerId,
      enquiryId,
      items,
      amount,
      item,
      validUntil,
      remarks,
      additionalNotes,
      status: requestedStatus,
      showDiscount,
      roundOffTotal,
      showStock,
      termsAndConditions,
      terms,
      notes,
      headerTitle
    } = req.body;

    if (!customerId || !String(customerId).trim()) {
      return res.status(400).json({ success: false, message: 'Customer is required to create a quotation.' });
    }

    const cust = customers.find((c) => c.id === String(customerId).trim());
    if (!cust) {
      return res.status(404).json({ success: false, message: `Customer ${customerId} not found in Customer Master.` });
    }

    let linkedEnquiry = null;
    if (enquiryId && String(enquiryId).trim()) {
      linkedEnquiry = enquiries.find((e) => e.enquiryId === String(enquiryId).trim());
      if (!linkedEnquiry) {
        return res.status(404).json({ success: false, message: `Enquiry ${enquiryId} not found.` });
      }
      if (linkedEnquiry.customerId && linkedEnquiry.customerId !== cust.id) {
        return res.status(400).json({
          success: false,
          message: `Enquiry ${enquiryId} belongs to a different customer (${linkedEnquiry.customerName || linkedEnquiry.customerId}).`
        });
      }
      if (isTerminalStatus(linkedEnquiry.status)) {
        return res.status(400).json({ success: false, message: `Enquiry ${enquiryId} is already closed.` });
      }
      if (linkedEnquiry.quotationId) {
        return res.status(409).json({
          success: false,
          message: `Enquiry ${enquiryId} already has quotation ${linkedEnquiry.quotationId}.`
        });
      }
    }

    const parsed = parseQuotationLineItems(items, amount, item, { showDiscount, roundOffTotal, showStock });
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    // Double submission protection: prevent creating multiple quotations if user clicks rapidly
    const recentDuplicate = quotations.find((q) => {
      const sameCustomer = q.customerId === cust.id;
      const sameEnquiry = (q.enquiryId || null) === (linkedEnquiry?.enquiryId || null);
      const isRecent = (Date.now() - new Date(q.createdAt).getTime()) < 3500;
      return sameCustomer && sameEnquiry && isRecent;
    });
    if (recentDuplicate) {
      return res.status(200).json({
        success: true,
        message: `Quotation ${recentDuplicate.quotationId} already created.`,
        data: recentDuplicate
      });
    }

    const now = new Date().toISOString();
    const quotationId = generateQuotationId();
    const isDirect = !linkedEnquiry;

    let initialQuotationStatus = 'PENDING';
    if (requestedStatus && ['READY_FOR_QUOTATION', 'ISSUED', 'DRAFT', 'AWAITING_CUSTOMER', 'AWAITING_DECISION', 'PENDING'].includes(requestedStatus)) {
      initialQuotationStatus = (requestedStatus === 'READY_FOR_QUOTATION' || requestedStatus === 'AWAITING_CUSTOMER') ? 'PENDING' : requestedStatus;
    }
    const isStockDeducted = false;
    const committedQuantities = {};

    const mergedRemarks = [remarks, additionalNotes].filter(Boolean).map((s) => String(s).trim()).join('\n\n');

    const quotation = {
      quotationId,
      proposalNumber: quotationId,
      source: isDirect ? 'DIRECT' : 'ENQUIRY',
      enquiryId: linkedEnquiry ? linkedEnquiry.enquiryId : null,
      customerId: cust.id,
      customerName: cust.name,
      customerCompany: cust.company || '',
      amount: parsed.grandTotal,
      item: parsed.summaryText,
      items: parsed.parsedItems,
      subtotal: parsed.subtotal,
      discountTotal: parsed.discountTotal,
      taxableTotal: parsed.taxableTotal,
      gstTotal: parsed.gstTotal,
      calculatedTotal: parsed.calculatedTotal,
      roundOff: parsed.roundOff,
      grandTotal: parsed.grandTotal,
      showDiscount: parsed.showDiscount,
      roundOffTotal: parsed.roundOffTotal,
      showStock: parsed.showStock,
      validUntil: validUntil || '',
      remarks: mergedRemarks,
      notes: notes !== undefined ? String(notes).trim() : (mergedRemarks || ''),
      termsAndConditions: termsAndConditions !== undefined ? String(termsAndConditions).trim() : (terms !== undefined ? String(terms).trim() : ''),
      terms: termsAndConditions !== undefined ? String(termsAndConditions).trim() : (terms !== undefined ? String(terms).trim() : ''),
      headerTitle: headerTitle ? String(headerTitle).trim() : 'QUOTATION',
      status: initialQuotationStatus,
      stockDeducted: isStockDeducted,
      stockCommittedQuantities: committedQuantities,
      createdBy: adminUser ? adminUser.name : 'System',
      createdAt: now,
      updatedAt: now
    };

    quotations.unshift(quotation);

    if (linkedEnquiry) {
      linkedEnquiry.customerId = cust.id;
      linkedEnquiry.customerName = cust.name;
      linkedEnquiry.quotationId = quotation.quotationId;
      delete linkedEnquiry.pendingQuotationId;
      linkedEnquiry.quotationAmount = parsed.grandTotal;
      linkedEnquiry.quotationItem = parsed.summaryText;
      linkedEnquiry.quotationValidUntil = quotation.validUntil;
      linkedEnquiry.quotationRemarks = quotation.remarks;
      linkedEnquiry.status = 'QUOTATION_ISSUED';
      linkedEnquiry.workflowStage = 'QUOTATION_ISSUED';
      linkedEnquiry.currentStage = 'Quotation Issued';
      linkedEnquiry.nextAction = 'Awaiting customer decision';
      linkedEnquiry.nextFollowUpDate = quotation.validUntil || '';
      linkedEnquiry.lastAction = `Quotation created: ${quotation.quotationId}`;
      linkedEnquiry.updatedAt = now;

      if (!Array.isArray(linkedEnquiry.followUps)) linkedEnquiry.followUps = [];
      linkedEnquiry.followUps.push({
        id: `FU-${linkedEnquiry.enquiryId.replace('ENQ-', '')}-${linkedEnquiry.followUps.length + 1}`,
        contactType: 'Quotation',
        contactDate: now,
        employee: quotation.createdBy,
        notes: `Quotation ${quotation.quotationId} prepared for ₹${parsed.grandTotal.toLocaleString('en-IN')} — ${parsed.summaryText}.`,
        outcome: 'Quotation prepared for customer',
        nextAction: 'Await customer decision',
        nextFollowUpDate: quotation.validUntil || '',
        createdAt: now
      });
    }

    persistStore();
    return res.status(201).json({
      success: true,
      message: `Quotation ${quotation.quotationId} created successfully.`,
      data: quotation
    });
  } catch (error) {
    console.error('Error in createStandaloneQuotation:', error);
    return res.status(500).json({ success: false, message: 'Failed to create quotation.' });
  }
};

/**
 * PUT /api/enquiries/quotation/:quotationId
 * Edit quotation directly by quotationId
 */
const updateQuotationById = (req, res) => {
  try {
    const adminUser = getCurrentUser(req);
    if (!hasPermission(req, 'Quotations', 'Edit')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to edit quotations.' });
    }
    const { quotationId } = req.params;
    const quotation = quotations.find((q) => q.quotationId === quotationId);
    if (!quotation) {
      return res.status(404).json({ success: false, message: `Quotation ${quotationId} not found.` });
    }
    if (quotation.status === 'CONVERTED') {
      return res.status(400).json({ success: false, message: 'A converted quotation cannot be edited.' });
    }

    const { amount, item, validUntil, remarks, items, customerId, status: requestedStatus, showDiscount, roundOffTotal, termsAndConditions, terms, notes, headerTitle } = req.body;
    const parsed = parseQuotationLineItems(items, amount, item, { showDiscount, roundOffTotal });
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    quotation.stockDeducted = false;
    quotation.stockCommittedQuantities = {};

    const now = new Date().toISOString();
    quotation.amount = parsed.grandTotal;
    quotation.item = parsed.summaryText;
    quotation.items = parsed.parsedItems;
    quotation.subtotal = parsed.subtotal;
    quotation.discountTotal = parsed.discountTotal;
    quotation.taxableTotal = parsed.taxableTotal;
    quotation.gstTotal = parsed.gstTotal;
    quotation.calculatedTotal = parsed.calculatedTotal;
    quotation.roundOff = parsed.roundOff;
    quotation.grandTotal = parsed.grandTotal;
    quotation.showDiscount = parsed.showDiscount;
    quotation.roundOffTotal = parsed.roundOffTotal;
    if (validUntil !== undefined) quotation.validUntil = validUntil;
    if (remarks !== undefined) quotation.remarks = String(remarks).trim();
    if (notes !== undefined) quotation.notes = String(notes).trim();
    if (termsAndConditions !== undefined) {
      quotation.termsAndConditions = String(termsAndConditions).trim();
      quotation.terms = quotation.termsAndConditions;
    } else if (terms !== undefined) {
      quotation.termsAndConditions = String(terms).trim();
      quotation.terms = String(terms).trim();
    }
    if (headerTitle !== undefined) quotation.headerTitle = String(headerTitle).trim();
    if (requestedStatus) quotation.status = requestedStatus;
    if (req.body.enquiryId && !quotation.enquiryId) {
      quotation.enquiryId = req.body.enquiryId;
    }
    quotation.source = quotation.enquiryId ? 'ENQUIRY' : (quotation.source || 'DIRECT');
    quotation.updatedAt = now;
    quotation.updatedBy = adminUser ? adminUser.name : 'System';

    const enquiry = enquiries.find((e) => e.enquiryId === quotation.enquiryId);
    if (enquiry) {
      if (customerId && quotation.customerId) {
        enquiry.customerId = quotation.customerId;
        enquiry.customerName = quotation.customerName;
      }
      enquiry.quotationAmount = quotation.grandTotal;
      enquiry.quotationItem = quotation.item;
      enquiry.quotationValidUntil = quotation.validUntil;
      enquiry.quotationRemarks = quotation.remarks;
      enquiry.lastAction = `Quotation updated: ${quotation.quotationId}`;
      enquiry.updatedAt = now;
    }

    persistStore();
    return res.status(200).json({
      success: true,
      message: 'Quotation updated successfully.',
      data: quotation
    });
  } catch (error) {
    console.error('Error in updateQuotationById:', error);
    return res.status(500).json({ success: false, message: 'Failed to update quotation.' });
  }
};

/**
 * PATCH /api/enquiries/quotation/:quotationId/status
 * Customer decision / status update: DRAFT, ISSUED, AWAITING_CUSTOMER, REVISION_REQUESTED, ACCEPTED, REJECTED
 */
const updateQuotationStatus = (req, res) => {
  try {
    const adminUser = getCurrentUser(req);
    if (!hasPermission(req, 'Quotations', 'Edit') && !hasPermission(req, 'Quotations', 'Approve')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to update quotation status.' });
    }

    const { quotationId } = req.params;
    const { status, remarks } = req.body;
    const cleanStatus = String(status || '').trim().toUpperCase();

    // Status transitions have action-specific permissions. Editing a
    // quotation must never silently grant approval or rejection rights.
    if ((cleanStatus === 'ACCEPTED' || cleanStatus === 'CONFIRMED') && !hasPermission(req, 'Quotations', 'Approve')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to accept quotations.' });
    }
    if (cleanStatus === 'REJECTED' && !hasPermission(req, 'Quotations', 'Reject')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to reject quotations.' });
    }
    if (cleanStatus === 'REVISION_REQUESTED' && !hasPermission(req, 'Quotations', 'Edit')) {
      return res.status(403).json({ success: false, message: 'You do not have permission to request quotation revisions.' });
    }

    const quotation = quotations.find((q) => q.quotationId === quotationId);
    if (!quotation) return res.status(404).json({ success: false, message: `Quotation ${quotationId} not found.` });
    if (quotation.status === 'CONVERTED') {
      return res.status(400).json({ success: false, message: 'A converted quotation status cannot be changed.' });
    }

    const validStatuses = ['READY_FOR_QUOTATION', 'DRAFT', 'ISSUED', 'PENDING', 'AWAITING_CUSTOMER', 'REVISION_REQUESTED', 'ACCEPTED', 'CONFIRMED', 'REJECTED'];
    if (!validStatuses.includes(cleanStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid quotation status.' });
    }

    const currentStatus = quotation.status || 'READY_FOR_QUOTATION';
    const transitionMap = {
      READY_FOR_QUOTATION: ['DRAFT', 'ISSUED', 'PENDING', 'AWAITING_CUSTOMER', 'ACCEPTED', 'CONFIRMED', 'REJECTED'],
      DRAFT: ['READY_FOR_QUOTATION', 'ISSUED', 'PENDING', 'AWAITING_CUSTOMER', 'ACCEPTED', 'CONFIRMED', 'REJECTED'],
      ISSUED: ['PENDING', 'AWAITING_CUSTOMER', 'REVISION_REQUESTED', 'ACCEPTED', 'CONFIRMED', 'REJECTED'],
      PENDING: ['REVISION_REQUESTED', 'ACCEPTED', 'CONFIRMED', 'REJECTED'],
      AWAITING_CUSTOMER: ['PENDING', 'REVISION_REQUESTED', 'ACCEPTED', 'CONFIRMED', 'REJECTED'],
      REVISION_REQUESTED: ['DRAFT', 'READY_FOR_QUOTATION', 'ISSUED', 'PENDING', 'AWAITING_CUSTOMER', 'ACCEPTED', 'CONFIRMED', 'REJECTED'],
      ACCEPTED: ['REJECTED', 'REVISION_REQUESTED', 'DRAFT'],
      CONFIRMED: ['REJECTED', 'REVISION_REQUESTED', 'DRAFT'],
      REJECTED: ['DRAFT', 'READY_FOR_QUOTATION', 'ISSUED', 'PENDING']
    };
    if (cleanStatus !== currentStatus && !transitionMap[currentStatus]?.includes(cleanStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid quotation transition: ${currentStatus} → ${cleanStatus}.`
      });
    }
    if (cleanStatus === 'REJECTED' && !String(remarks || '').trim()) {
      return res.status(400).json({ success: false, message: 'A rejection reason is required.' });
    }

    const isReverting = ['REJECTED', 'REVISION_REQUESTED', 'DRAFT'].includes(cleanStatus);

    // Business rule: Quotations are commercial documents and MUST NOT reduce physical stock.
    // Physical stock deduction happens strictly at Delivery Challan dispatch / physical issue.
    if (isReverting && quotation.stockDeducted === true) {
      const revertRes = stockService.revertQuotationStock(
        quotation,
        adminUser ? adminUser.name : 'System',
        `Quotation status changed to ${cleanStatus}: ${remarks || 'Reverted/Cancelled'}`
      );
      if (revertRes.success) {
        quotation.stockDeducted = false;
        quotation.stockCommittedQuantities = {};
      }
    } else {
      quotation.stockDeducted = false;
      quotation.stockCommittedQuantities = {};
    }

    const now = new Date().toISOString();
    quotation.status = cleanStatus;
    quotation.updatedAt = now;
    quotation.updatedBy = adminUser ? adminUser.name : 'System';
    if (remarks) quotation.remarks = String(remarks).trim();

    const enquiry = enquiries.find((e) => e.enquiryId === quotation.enquiryId);
    if (enquiry) {
      enquiry.lastAction = `Quotation ${quotationId} status changed to ${cleanStatus}`;
      enquiry.updatedAt = now;
      if (!Array.isArray(enquiry.followUps)) enquiry.followUps = [];
      enquiry.followUps.push({
        id: `FU-${enquiry.enquiryId.replace('ENQ-', '')}-${enquiry.followUps.length + 1}`,
        contactType: 'Quotation Status',
        contactDate: now,
        employee: quotation.updatedBy,
        notes: `Quotation ${quotationId} status updated to ${cleanStatus}.${remarks ? ` Remarks: ${remarks}` : ''}`,
        outcome: `Quotation status: ${cleanStatus}`,
        nextAction:
          cleanStatus === 'ACCEPTED'
            ? 'Convert to order'
            : cleanStatus === 'REJECTED'
              ? 'Quotation rejected'
              : cleanStatus === 'REVISION_REQUESTED'
                ? 'Revise quotation'
                : 'Await decision',
        nextFollowUpDate: '',
        createdAt: now
      });
    }

    persistStore();
    return res.status(200).json({
      success: true,
      message: `Quotation ${quotationId} status updated to ${cleanStatus}.`,
      data: quotation
    });
  } catch (error) {
    console.error('Error in updateQuotationStatus:', error);
    return res.status(500).json({ success: false, message: 'Failed to update quotation status.' });
  }
};

/**
 * POST /api/enquiries/:id/solve
 * LEGACY CASE RESOLUTION: order/lead linking path preserved for existing records.
 */
const solveEnquiry = (req, res) => {
  try {
    if (!requirePermission(req, res, 'Enquiries', 'Close')) return;
    const {
      solutionProvided,
      remarks,
      orderOption,
      orderAmount,
      orderItems,
      relatedOrderId,
      relatedLeadId,
      solvedBy
    } = req.body;

    if (!solutionProvided || !solutionProvided.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Solution details are required before closing the case.'
      });
    }

    const enquiry = enquiries.find((e) => e.enquiryId === req.params.id);
    if (!enquiry) {
      return res.status(404).json({
        success: false,
        message: `Enquiry ${req.params.id} not found.`
      });
    }

    if (isTerminalStatus(enquiry.status)) {
      return res.status(400).json({
        success: false,
        message: 'This enquiry is already closed. Create a new enquiry for the same customer if they return.'
      });
    }

    if (enquiry.outcome !== 'LEAD_CONFIRMATION') {
      return res.status(400).json({
        success: false,
        message: 'Lead confirmation is required before resolving this enquiry.'
      });
    }

    const allowedOptions = ['create_order', 'link_order', 'create_lead', 'link_lead', 'none'];
    const selectedOption = orderOption || 'none';
    if (!allowedOptions.includes(selectedOption)) {
      return res.status(400).json({
        success: false,
        message: 'Please select a valid Order/Lead resolution option.'
      });
    }

    const now = new Date().toISOString();
    let finalOrderId = null;
    let finalLeadId = null;
    let createdOrderObject = null;

    if (selectedOption === 'create_order') {
      const amount = Number(orderAmount);
      const items = Array.isArray(orderItems)
        ? orderItems.map((item) => String(item).trim()).filter(Boolean)
        : [];

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'A valid positive order amount is required.'
        });
      }
      if (items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one ordered item is required.'
        });
      }

      finalOrderId = generateOrderId();
      createdOrderObject = {
        orderId: finalOrderId,
        enquiryId: enquiry.enquiryId,
        customerId: enquiry.customerId,
        customerName: enquiry.customerName,
        company: enquiry.customerCompany || enquiry.customerContactPerson || '',
        amount,
        items,
        status: 'COMPLETED',
        createdAt: now,
        remarks: remarks ? String(remarks).trim() : 'Generated upon case resolution.'
      };
      orders.unshift(createdOrderObject);
    } else if (selectedOption === 'link_order') {
      const requestedOrderId = String(relatedOrderId || '').trim();
      if (!requestedOrderId) {
        return res.status(400).json({
          success: false,
          message: 'An existing Order ID is required.'
        });
      }
      const existingOrder = orders.find((order) => order.orderId === requestedOrderId);
      if (!existingOrder) {
        return res.status(404).json({
          success: false,
          message: `Order ${requestedOrderId} was not found.`
        });
      }
      finalOrderId = existingOrder.orderId;
    } else if (selectedOption === 'create_lead') {
      finalLeadId = generateLeadId();
      leads.unshift({
        leadId: finalLeadId,
        enquiryId: enquiry.enquiryId,
        customerId: enquiry.customerId,
        customerName: enquiry.customerName,
        title: enquiry.productsInterested || enquiry.type || 'Qualified Lead',
        status: 'QUALIFIED',
        createdAt: now,
        updatedAt: now
      });
    } else if (selectedOption === 'link_lead') {
      const requestedLeadId = String(relatedLeadId || '').trim();
      if (!requestedLeadId) {
        return res.status(400).json({ success: false, message: 'Please select an existing Lead.' });
      }
      const existingLead = leads.find((lead) => lead.leadId === requestedLeadId);
      if (!existingLead) {
        return res.status(404).json({ success: false, message: 'The selected lead no longer exists. Please select another lead.' });
      }
      finalLeadId = existingLead.leadId;
    }

    enquiry.status = 'CLOSED';
    enquiry.closureType = 'CASE_CLOSED';
    enquiry.outcome = 'LEAD_CONFIRMATION';
    enquiry.currentStage = 'Closed';
    enquiry.resolution = solutionProvided.trim();
    enquiry.solutionProvided = solutionProvided.trim();
    enquiry.remarks = remarks ? String(remarks).trim() : '';
    enquiry.closedBy = solvedBy || enquiry.assignedTo || 'John Doe';
    enquiry.closedAt = now;
    enquiry.relatedOrderId = finalOrderId;
    enquiry.relatedLeadId = finalLeadId;
    enquiry.solvedAt = now;
    enquiry.solvedBy = enquiry.closedBy;
    enquiry.lastAction = 'Case closed';
    enquiry.nextAction = 'Case closed';
    enquiry.nextFollowUpDate = '';
    enquiry.updatedAt = now;

    if (!Array.isArray(enquiry.followUps)) enquiry.followUps = [];
    enquiry.followUps.push({
      id: `FU-${req.params.id.replace('ENQ-', '')}-${enquiry.followUps.length + 1}`,
      contactType: 'Case Resolution',
      contactDate: now,
      employee: enquiry.solvedBy,
      notes: `Case Closed: ${solutionProvided.trim()}`,
      outcome: finalOrderId
        ? `Enquiry successfully closed. Linked Order: ${finalOrderId}`
        : finalLeadId
          ? `Enquiry successfully closed. Linked Lead: ${finalLeadId}`
          : 'Case resolved without order or lead',
      nextAction: 'None (Case Closed)',
      nextFollowUpDate: '',
      createdAt: now
    });

    persistStore();

    return res.status(200).json({
      success: true,
      message: 'Case closed successfully.',
      data: enquiry,
      order: createdOrderObject
    });
  } catch (error) {
    console.error('Error in solveEnquiry:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark enquiry as case closed.'
    });
  }
};

module.exports = {
  getLeads,
  getQuotations,
  getQuotationQueue,
  updateQuotation,
  deleteQuotation,
  getEnquiries,
  getEnquiryById,
  createEnquiry,
  updateEnquiryDetails,
  addFollowUp,
  updateStatus,
  solveEnquiry,
  createQuotation,
  createStandaloneQuotation,
  getNextQuotationIdPreview,
  getQuotationById,
  updateQuotationById,
  updateQuotationStatus
};
