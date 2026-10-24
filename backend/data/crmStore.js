// ASICRM data store.  The original application used process memory only, which
// meant every server restart erased customer and enquiry work.  Keep the seeded
// records as the first-run defaults and persist subsequent changes locally.
const fs = require('fs');
const path = require('path');
const { normalizeCustomer } = require('../utils/crmHelpers');
const { sequenceService } = require('../services/sequenceService');
const DATA_FILE = process.env.CRM_DATA_FILE || path.join(__dirname, 'crm-data.json');

let nextEnquirySeq = 1;
let nextOrderSeq = 1;
let nextLeadSeq = 1;
let nextQuotationSeq = 1;
let nextChallanSeq = 1;
let nextReturnSeq = 1;
let nextInvoiceSeq = 1;
let nextProformaSeq = 1;
let nextCustSeq = 1;
let nextBranchSeq = 1;
let nextPurchaseOrderSeq = 1;
let nextGrnSeq = 1;
let nextSupplierSeq = 1;

// Persisted Delivery Challans
let deliveryChallans = [];

// Persisted Invoices
let invoices = [];

// Persisted Proforma Invoices
let proformas = [];

// Persisted Purchase Orders
let purchaseOrders = [];

// Persisted Goods Receipts (GRN)
let goodsReceipts = [];

// Pre-seeded Suppliers
let suppliers = [
  {
    id: 'SUP-001',
    companyName: 'Dahua Technology India Pvt Ltd',
    contactPerson: 'Sanjay Verma',
    phone: '9840123456',
    email: 'sales.india@dahuasecurity.com',
    gstin: '27AAACD1234F1Z5',
    address: 'Unit 402, Trade Center, BKC',
    city: 'Mumbai',
    state: 'Maharashtra',
    notes: 'Authorized Dahua National Distributor',
    createdAt: new Date('2026-05-01T10:00:00Z').toISOString()
  },
  {
    id: 'SUP-002',
    companyName: 'CP Plus Global Security Solutions',
    contactPerson: 'Kavita Iyer',
    phone: '9884112233',
    email: 'procurement@cpplusworld.com',
    gstin: '07AAACC5678B1Z2',
    address: 'Plot No. 12, Okhla Industrial Area Phase III',
    city: 'New Delhi',
    state: 'Delhi',
    notes: 'Direct Manufacturer Supply',
    createdAt: new Date('2026-05-01T10:00:00Z').toISOString()
  },
  {
    id: 'SUP-003',
    companyName: 'Hikvision India Pvt Ltd',
    contactPerson: 'Rajesh Nair',
    phone: '9740556677',
    email: 'orders@hikvisionindia.com',
    gstin: '29AAACH9012D1Z8',
    address: 'Tech Park, Whitefield',
    city: 'Bengaluru',
    state: 'Karnataka',
    notes: 'Enterprise Surveillance Division',
    createdAt: new Date('2026-05-01T10:00:00Z').toISOString()
  },
  {
    id: 'SUP-004',
    companyName: 'TP-Link India Pvt Ltd',
    contactPerson: 'Amitabh Sen',
    phone: '9820334455',
    email: 'distribution@tp-link.in',
    gstin: '27AAACT3456E1Z9',
    address: 'Andheri East Logistics Hub',
    city: 'Mumbai',
    state: 'Maharashtra',
    notes: 'Networking & PoE Hardware',
    createdAt: new Date('2026-05-01T10:00:00Z').toISOString()
  },
  {
    id: 'SUP-005',
    companyName: 'Western Digital India Pvt Ltd',
    contactPerson: 'Vikram Joshi',
    phone: '9900887766',
    email: 'india.sales@westerndigital.com',
    gstin: '29AAACW7890K1Z4',
    address: 'Electronic City Phase 1',
    city: 'Bengaluru',
    state: 'Karnataka',
    notes: 'Purple Surveillance Storage Direct',
    createdAt: new Date('2026-05-01T10:00:00Z').toISOString()
  }
];

// Pre-seeded Customers
let customers = [
  {
    id: 'CUST-001',
    name: 'Aarav Sharma',
    mobile: '9876543210',
    email: 'aarav.sharma@sharmaenterprises.in',
    company: 'Sharma Enterprises',
    city: 'Mumbai, Maharashtra',
    createdAt: new Date('2026-05-10T10:00:00Z').toISOString()
  },
  {
    id: 'CUST-002',
    name: 'Priya Patel',
    mobile: '9823456789',
    email: 'priya.patel@techcorp.in',
    company: 'TechCorp Solutions',
    city: 'Ahmedabad, Gujarat',
    createdAt: new Date('2026-05-12T11:30:00Z').toISOString()
  },
  {
    id: 'CUST-003',
    name: 'Rohan Mehta',
    mobile: '9811223344',
    email: 'rohan@mehtalogistics.com',
    company: 'Mehta Logistics',
    city: 'New Delhi, Delhi',
    createdAt: new Date('2026-05-14T09:15:00Z').toISOString()
  },
  {
    id: 'CUST-004',
    name: 'Sneha Reddy',
    mobile: '9700112233',
    email: 'sneha.reddy@apexcloud.io',
    company: 'Apex Cloud Services',
    city: 'Bengaluru, Karnataka',
    createdAt: new Date('2026-05-15T14:45:00Z').toISOString()
  },
  {
    id: 'CUST-005',
    name: 'Vikram Malhotra',
    mobile: '9655443322',
    email: 'vikram@malhotratextiles.com',
    company: 'Malhotra Textiles',
    city: 'Surat, Gujarat',
    createdAt: new Date('2026-05-16T16:20:00Z').toISOString()
  }
];

// Pre-seeded Orders
let orders = [
  {
    orderId: 'ORD-000451',
    enquiryId: 'ENQ-000103',
    customerId: 'CUST-004',
    customerName: 'Sneha Reddy',
    company: 'Apex Cloud Services',
    amount: 145000,
    items: ['ASICRM Enterprise Plan (Annual)', 'Custom Data Connector Pack'],
    status: 'COMPLETED',
    createdAt: new Date('2026-05-18T16:00:00Z').toISOString(),
    remarks: 'Closed via service enquiry resolution.'
  }
];

// Existing leads are kept as first-class records so enquiries can safely link to them.
let leads = [
  {
    leadId: 'LEAD-000782',
    enquiryId: 'ENQ-000103',
    customerId: 'CUST-004',
    customerName: 'Sneha Reddy',
    title: 'ASICRM Enterprise Plan',
    status: 'QUALIFIED',
    createdAt: new Date('2026-05-18T15:30:00Z').toISOString(),
    updatedAt: new Date('2026-05-18T15:30:00Z').toISOString()
  }
];


// Persisted quotation records created after lead confirmation.
let quotations = [];

// Pre-seeded Enquiries
let enquiries = [
  {
    enquiryId: 'ENQ-000101',
    customerId: 'CUST-002',
    customerName: 'Priya Patel',
    customerCompany: 'TechCorp Solutions',
    customerMobile: '9823456789',
    customerEmail: 'priya.patel@techcorp.in',
    source: 'Website',
    type: 'Product Enquiry',
    priority: 'High',
    assignedTo: 'John Doe',
    status: 'IN_PROGRESS',
    currentStage: 'Demo Scheduled',
    lastAction: 'Scheduled product walkthrough',
    nextAction: 'Follow up after live demonstration',
    nextFollowUpDate: '2026-05-28',
    description: 'Customer requested a live walkthrough of the automated lead management and CRM analytics suite.',
    productsInterested: 'ASICRM Growth Plan, Multi-channel OTP suite',
    expectedBudget: '₹75,000 / year',
    attachments: [],
    createdAt: new Date('2026-05-18T09:30:00Z').toISOString(),
    updatedAt: new Date('2026-05-20T11:00:00Z').toISOString(),
    followUps: [
      {
        id: 'FU-101-1',
        contactType: 'Phone Call',
        contactDate: '2026-05-19T10:30:00Z',
        employee: 'John Doe',
        notes: 'Called customer to understand system scale requirements (25 agent licenses).',
        outcome: 'Customer agreed to schedule interactive demo.',
        nextAction: 'Send demo calendar invitation',
        nextFollowUpDate: '2026-05-22',
        createdAt: new Date('2026-05-19T10:35:00Z').toISOString()
      },
      {
        id: 'FU-101-2',
        contactType: 'Email',
        contactDate: '2026-05-20T11:00:00Z',
        employee: 'John Doe',
        notes: 'Sent product deck and invitation for video demo on 28th May.',
        outcome: 'Invitation accepted by customer.',
        nextAction: 'Follow up after live demonstration',
        nextFollowUpDate: '2026-05-28',
        createdAt: new Date('2026-05-20T11:05:00Z').toISOString()
      }
    ]
  },
  {
    enquiryId: 'ENQ-000102',
    customerId: 'CUST-003',
    customerName: 'Rohan Mehta',
    customerCompany: 'Mehta Logistics',
    customerMobile: '9811223344',
    customerEmail: 'rohan@mehtalogistics.com',
    source: 'Phone Call',
    type: 'Pricing Enquiry',
    priority: 'Medium',
    assignedTo: 'Sarah Jenkins',
    status: 'NOT_RESPONDING',
    notRespondingReason: 'Phone Not Answered',
    notRespondingRemarks: 'Tried calling twice at 11 AM and 4 PM; calls went unanswered.',
    lastAttemptDate: '2026-05-21',
    lastAction: 'Attempted phone follow up',
    nextAction: 'Re-attempt phone contact',
    nextFollowUpDate: '2026-05-26',
    description: 'Enquired regarding enterprise volume discounts and logistics API integration costs.',
    productsInterested: 'Logistics CRM add-on, Custom Webhook stream',
    expectedBudget: '₹50,000',
    attachments: [],
    createdAt: new Date('2026-05-17T14:00:00Z').toISOString(),
    updatedAt: new Date('2026-05-21T16:30:00Z').toISOString(),
    followUps: [
      {
        id: 'FU-102-1',
        contactType: 'Phone Call',
        contactDate: '2026-05-18T15:00:00Z',
        employee: 'Sarah Jenkins',
        notes: 'Shared initial pricing sheet over email and called to discuss discount tiers.',
        outcome: 'Customer asked to follow up next day afternoon.',
        nextAction: 'Call customer for decision',
        nextFollowUpDate: '2026-05-19',
        createdAt: new Date('2026-05-18T15:05:00Z').toISOString()
      },
      {
        id: 'FU-102-2',
        contactType: 'Phone Call',
        contactDate: '2026-05-21T16:30:00Z',
        employee: 'Sarah Jenkins',
        notes: 'Attempted follow-up call twice.',
        outcome: 'Phone not answered.',
        nextAction: 'Re-attempt phone contact later',
        nextFollowUpDate: '2026-05-26',
        createdAt: new Date('2026-05-21T16:35:00Z').toISOString()
      }
    ]
  },
  {
    enquiryId: 'ENQ-000103',
    customerId: 'CUST-004',
    customerName: 'Sneha Reddy',
    customerCompany: 'Apex Cloud Services',
    customerMobile: '9700112233',
    customerEmail: 'sneha.reddy@apexcloud.io',
    source: 'Email',
    type: 'Service Enquiry',
    priority: 'Urgent',
    assignedTo: 'John Doe',
    status: 'CLOSED',
    closureType: 'CASE_CLOSED',
    description: 'Requested fast onboarding for cloud service CRM workflow and multi-tier access control.',
    productsInterested: 'ASICRM Enterprise Plan (Annual)',
    expectedBudget: '₹1,50,000',
    solutionProvided: 'Provided technical architecture consultation, delivered end-to-end sandbox demo, finalized terms with 10% annual bundle discount, and completed commercial agreement.',
    remarks: 'Customer completed payment and onboarding is scheduled.',
    relatedOrderId: 'ORD-000451',
    relatedLeadId: 'LEAD-000782',
    solvedAt: new Date('2026-05-18T16:00:00Z').toISOString(),
    solvedBy: 'John Doe',
    createdAt: new Date('2026-05-15T14:45:00Z').toISOString(),
    updatedAt: new Date('2026-05-18T16:00:00Z').toISOString(),
    followUps: [
      {
        id: 'FU-103-1',
        contactType: 'Meeting',
        contactDate: '2026-05-16T11:00:00Z',
        employee: 'John Doe',
        notes: 'Conducted video meeting with CTO and Operations team.',
        outcome: 'Requirements mapped; quotation requested.',
        nextAction: 'Send formal commercial proposal',
        nextFollowUpDate: '2026-05-17',
        createdAt: new Date('2026-05-16T11:45:00Z').toISOString()
      },
      {
        id: 'FU-103-2',
        contactType: 'Phone Call',
        contactDate: '2026-05-18T15:30:00Z',
        employee: 'John Doe',
        notes: 'Final contract negotiation call.',
        outcome: 'Proposal accepted; order generated.',
        nextAction: 'Quotation/order processing',
        nextFollowUpDate: '',
        createdAt: new Date('2026-05-18T15:40:00Z').toISOString()
      }
    ]
  }
];

const sequenceAfter = (items, field, prefix, fallback) => {
  const highest = items.reduce((max, item) => {
    const match = String(item[field] || '').match(new RegExp(`^${prefix}-(\\d+)$`));
    return match ? Math.max(max, Number(match[1])) : max;
  }, fallback - 1);
  return highest + 1;
};

const loadPersistedStore = () => {
  if (!fs.existsSync(DATA_FILE)) return;
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (Array.isArray(saved.customers)) customers = saved.customers;
    if (Array.isArray(saved.enquiries)) {
      const seen = new Set();
      enquiries = [];
      saved.enquiries.forEach((item) => {
        if (item && item.enquiryId && !seen.has(item.enquiryId)) {
          seen.add(item.enquiryId);
          if (item.quotationId) {
            item.status = 'QUOTATION_ISSUED';
            item.workflowStage = 'QUOTATION_ISSUED';
            item.currentStage = 'Quotation Issued';
          }
          enquiries.push(item);
        }
      });
    }
    if (Array.isArray(saved.orders)) orders = saved.orders;
    if (Array.isArray(saved.leads)) leads = saved.leads;
    if (Array.isArray(saved.quotations)) {
      quotations = saved.quotations;
      quotations.forEach((quote) => {
        if (quote) {
          if (!quote.status || quote.status === 'READY_FOR_QUOTATION' || quote.status === 'ISSUED' || quote.status === 'AWAITING_CUSTOMER') {
            quote.status = 'PENDING';
          }
          if (quote.enquiryId) {
            const enq = enquiries.find((e) => e.enquiryId === quote.enquiryId);
            if (enq && !enq.quotationId) {
              enq.quotationId = quote.quotationId;
              enq.status = 'QUOTATION_ISSUED';
              enq.workflowStage = 'QUOTATION_ISSUED';
              enq.currentStage = 'Quotation Issued';
            }
          }
        }
      });
    }
    if (Array.isArray(saved.deliveryChallans)) deliveryChallans = saved.deliveryChallans;
    if (Array.isArray(saved.invoices)) invoices = saved.invoices;

    // Bi-directional link synchronization between Delivery Challans and Invoices
    invoices.forEach((inv) => {
      if (inv && inv.challanId) {
        const dc = deliveryChallans.find((d) => d && d.challanId === inv.challanId);
        if (dc && !dc.invoiceId) {
          dc.invoiceId = inv.invoiceId;
        }
      }
    });
    deliveryChallans.forEach((dc) => {
      if (dc && dc.invoiceId) {
        const inv = invoices.find((i) => i && i.invoiceId === dc.invoiceId);
        if (inv && !inv.challanId) {
          inv.challanId = dc.challanId;
        }
      }
    });
    if (Array.isArray(saved.proformas)) proformas = saved.proformas;
    if (Array.isArray(saved.suppliers) && saved.suppliers.length > 0) suppliers = saved.suppliers;
    if (Array.isArray(saved.purchaseOrders)) purchaseOrders = saved.purchaseOrders;
    if (Array.isArray(saved.goodsReceipts)) goodsReceipts = saved.goodsReceipts;

    // Permanently enforce cable rule: cables must NEVER have serial numbers in any document
    const isCableRecord = (item) => {
      if (!item) return false;
      const name = String(item.name || item.productName || item.description || '').toLowerCase();
      const code = String(item.code || item.sku || item.productCode || '').toLowerCase();
      const cat = String(item.category || item.categoryName || item.categoryId || '').toLowerCase();
      if (cat === 'cat-000004' || cat === 'cat-004' || cat.includes('cable')) return true;
      if (name.includes('cable') || name.includes('cat 6') || name.includes('cat6') || name.includes('patch cord') || name.includes('fiber cable')) return true;
      if (code === 'asi-18' || code === 'prod-000041' || code === 'prd-041' || code.includes('cable')) return true;
      const unit = String(item.unit || '').toLowerCase();
      if ((unit === 'meter' || unit === 'roll') && (name.includes('wire') || name.includes('cable'))) return true;
      return false;
    };

    [deliveryChallans, invoices, proformas, orders, quotations].forEach((list) => {
      if (Array.isArray(list)) {
        list.forEach((doc) => {
          const items = doc?.items || doc?.lineItems;
          if (Array.isArray(items)) {
            items.forEach((it) => {
              if (isCableRecord(it)) {
                it.serialNumbers = [];
                it.isSerialized = false;
                it.serialized = false;
              }
            });
          }
        });
      }
    });
      const derivedLeads = [];
      const seenLeadIds = new Set();
      enquiries.forEach((enquiry) => {
        const leadId = String(enquiry.relatedLeadId || '').trim();
        if (!leadId || seenLeadIds.has(leadId)) return;
        seenLeadIds.add(leadId);
        derivedLeads.push({
          leadId,
          enquiryId: enquiry.enquiryId,
          customerId: enquiry.customerId,
          customerName: enquiry.customerName,
          title: enquiry.productsInterested || enquiry.type || 'Qualified Lead',
          status: 'QUALIFIED',
          createdAt: enquiry.createdAt || new Date().toISOString(),
          updatedAt: enquiry.updatedAt || new Date().toISOString()
        });
      });
      leads = [...leads, ...derivedLeads.filter((lead) => !leads.some((item) => item.leadId === lead.leadId))];
    nextCustSeq = sequenceAfter(customers, 'id', 'CUST', nextCustSeq);
    nextEnquirySeq = sequenceAfter(enquiries, 'enquiryId', 'ENQ', nextEnquirySeq);
    nextOrderSeq = sequenceAfter(orders, 'orderId', 'ORD', nextOrderSeq);
    nextLeadSeq = sequenceAfter(leads, 'leadId', 'LEAD', nextLeadSeq);
    nextQuotationSeq = sequenceAfter(quotations, 'quotationId', 'QT', nextQuotationSeq);
    nextChallanSeq = sequenceAfter(deliveryChallans, 'challanId', 'DC', nextChallanSeq);
    nextInvoiceSeq = sequenceAfter(invoices, 'invoiceId', 'INV', nextInvoiceSeq);
    nextProformaSeq = sequenceAfter(proformas, 'proformaId', 'PI', nextProformaSeq);
    nextPurchaseOrderSeq = sequenceAfter(purchaseOrders, 'id', 'PO', nextPurchaseOrderSeq);
    nextGrnSeq = sequenceAfter(goodsReceipts, 'id', 'GRN', nextGrnSeq);
    nextSupplierSeq = sequenceAfter(suppliers, 'id', 'SUP', nextSupplierSeq);
    const branchIds = customers.flatMap((customer) => (customer.branches || []).map((branch) => branch.branchId));
    nextBranchSeq = sequenceAfter(branchIds.map((id) => ({ id })), 'id', 'BR', nextBranchSeq);

    // Natural ascending sequence sort (1 above 2)
    sortAllCollectionsAscending();
  } catch (error) {
    console.error('Could not read CRM data file; using the seeded records.', error.message);
  }
};

const sortStoreListAscending = (arr, idProp) => {
  if (!Array.isArray(arr)) return arr;
  return arr.sort((a, b) => {
    const aVal = String(a[idProp] || a.id || '');
    const bVal = String(b[idProp] || b.id || '');
    const aNum = Number(aVal.match(/(\d+)$/)?.[1] || 0);
    const bNum = Number(bVal.match(/(\d+)$/)?.[1] || 0);
    if (aNum && bNum && aNum !== bNum) return aNum - bNum;
    return aVal.localeCompare(bVal, undefined, { numeric: true });
  });
};

const sortAllCollectionsAscending = () => {
  if (Array.isArray(deliveryChallans)) sortStoreListAscending(deliveryChallans, 'challanId');
  if (Array.isArray(orders)) sortStoreListAscending(orders, 'orderId');
  if (Array.isArray(invoices)) sortStoreListAscending(invoices, 'invoiceId');
  if (Array.isArray(proformas)) sortStoreListAscending(proformas, 'proformaId');
  if (Array.isArray(quotations)) sortStoreListAscending(quotations, 'quotationId');
  if (Array.isArray(enquiries)) sortStoreListAscending(enquiries, 'enquiryId');
  if (Array.isArray(customers)) sortStoreListAscending(customers, 'id');
};

const persistStore = () => {
  const seen = new Set();
  const dedupedEnquiries = [];
  enquiries.forEach((item) => {
    if (item && item.enquiryId && !seen.has(item.enquiryId)) {
      seen.add(item.enquiryId);
      dedupedEnquiries.push(item);
    }
  });
  enquiries = dedupedEnquiries;

  // Enforce natural ascending sequence sort before writing (1 above 2)
  sortAllCollectionsAscending();

  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ customers, enquiries, orders, leads, quotations, deliveryChallans, invoices, proformas, suppliers, purchaseOrders, goodsReceipts }, null, 2),
    'utf8'
  );

  try {
    const { syncStoreToMongo } = require('../services/mongoSyncService');
    syncStoreToMongo({ customers, enquiries, orders, leads, quotations, deliveryChallans, invoices, proformas, suppliers, purchaseOrders, goodsReceipts });
  } catch (err) {
    // Non-blocking fallback
  }
};

loadPersistedStore();

// Normalize legacy terminal records into the final enquiry status model.
// Final enquiry status model: successful completion is CLOSED + CASE_CLOSED;
// force-close is CLOSED + FORCE_CLOSED. Legacy records are normalized below.
let statusModelUpdated = false;
enquiries = enquiries.map((enquiry) => {
  const next = { ...enquiry };
  if (next.status === 'CASE_SOLVED') {
    next.status = 'CLOSED';
    next.closureType = 'CASE_CLOSED';
    next.currentStage = 'Case Closed';
    if (!next.closedAt) next.closedAt = next.solvedAt || next.updatedAt || new Date().toISOString();
    if (!next.closedBy) next.closedBy = next.solvedBy || next.assignedTo || 'System';
    statusModelUpdated = true;
  } else if (next.status === 'CLOSED' && !next.closureType) {
    next.closureType = next.outcome === 'FORCE_CLOSED' ? 'FORCE_CLOSED' : 'CASE_CLOSED';
    next.currentStage = next.closureType === 'FORCE_CLOSED' ? 'Closed' : 'Case Closed';
    statusModelUpdated = true;
  } else if ((next.outcome === 'LEAD_CONFIRMATION' || next.workflowStage === 'READY_FOR_QUOTATION') && next.status !== 'CLOSED' && !next.quotationId) {
    if (next.status !== 'READY_FOR_QUOTATION') {
      next.status = 'READY_FOR_QUOTATION';
      next.workflowStage = 'READY_FOR_QUOTATION';
      statusModelUpdated = true;
    }
  }
  return next;
});
if (statusModelUpdated) persistStore();

let customerShapeUpdated = false;
customers = customers.map((customer) => {
  const normalized = normalizeCustomer(customer, generateBranchId);
  if (
    customer.contactPerson !== normalized.contactPerson ||
    !Array.isArray(customer.branches)
  ) {
    customerShapeUpdated = true;
  }
  return normalized;
});
if (customerShapeUpdated) persistStore();

// Deterministic migration to repair duplicate quotation IDs and ensure 100% uniqueness
let quotationMigrationUpdated = false;
const registeredQuoteIds = new Set();
// Sort by createdAt ascending so earlier quotations preserve their sequences
quotations.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

quotations.forEach((quote) => {
  if (!quote.quotationId || registeredQuoteIds.has(quote.quotationId)) {
    const allKnown = new Set([
      ...registeredQuoteIds,
      ...quotations.map((q) => q.quotationId).filter(Boolean)
    ]);
    let candidateSeq = 1;
    let candidateId = `QTN/${String(candidateSeq).padStart(3, '0')}/${new Date().getFullYear()}`;
    while (allKnown.has(candidateId)) {
      candidateSeq++;
      candidateId = `QTN/${String(candidateSeq).padStart(3, '0')}/${new Date().getFullYear()}`;
    }
    const oldId = quote.quotationId;
    quote.quotationId = candidateId;
    registeredQuoteIds.add(candidateId);
    quotationMigrationUpdated = true;

    // Update matching enquiry if linked
    if (quote.enquiryId) {
      const enq = enquiries.find((e) => e.enquiryId === quote.enquiryId);
      if (enq && enq.quotationId === oldId) {
        enq.quotationId = candidateId;
      }
    }
    // Update matching orders/invoices/dcs if any
    orders.forEach((o) => {
      if (o.quotationId === oldId) o.quotationId = candidateId;
    });
    invoices.forEach((i) => {
      if (i.quotationId === oldId) i.quotationId = candidateId;
    });
    deliveryChallans.forEach((d) => {
      if (d.quotationId === oldId) d.quotationId = candidateId;
    });
  } else {
    registeredQuoteIds.add(quote.quotationId);
  }
});

// Remove deprecated pendingQuotationId from all enquiries so fake duplicate numbers are never shown
enquiries.forEach((enquiry) => {
  if (enquiry.pendingQuotationId) {
    delete enquiry.pendingQuotationId;
    quotationMigrationUpdated = true;
  }
});

// Resync nextQuotationSeq to be strictly greater than any existing quotation ID
let maxQuoteNum = 0;
quotations.forEach((q) => {
  const m = String(q.quotationId || '').match(/^QT-(\d+)$/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n > maxQuoteNum) maxQuoteNum = n;
  }
});
enquiries.forEach((e) => {
  const m = String(e.quotationId || '').match(/^QT-(\d+)$/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n > maxQuoteNum) maxQuoteNum = n;
  }
});
nextQuotationSeq = Math.max(nextQuotationSeq, maxQuoteNum + 1);

if (quotationMigrationUpdated) {
  persistStore();
}

// Helper ID generators connected to Central Sequence Engine
const generateEnquiryId = () => {
  try {
    const id = sequenceService.getNextId('enquiries');
    persistStore();
    return id;
  } catch {
    const id = `ENQ/${String(nextEnquirySeq).padStart(3, '0')}/${new Date().getFullYear()}`;
    nextEnquirySeq += 1;
    return id;
  }
};

const generateOrderId = () => {
  const id = `ORD-${String(nextOrderSeq).padStart(3, '0')}/${new Date().getFullYear()}`;
  nextOrderSeq += 1;
  return id;
};

const generateQuotationId = () => {
  try {
    const id = sequenceService.getNextId('quotations');
    persistStore();
    return id;
  } catch {
    const id = `QTN/${String(nextQuotationSeq).padStart(3, '0')}/${new Date().getFullYear()}`;
    nextQuotationSeq += 1;
    return id;
  }
};

const peekQuotationId = () => {
  try {
    return sequenceService.peekNextId('quotations');
  } catch {
    return `QTN/${String(nextQuotationSeq).padStart(3, '0')}/${new Date().getFullYear()}`;
  }
};

const generateLeadId = () => {
  const id = `LEAD-${String(nextLeadSeq).padStart(3, '0')}`;
  nextLeadSeq += 1;
  return id;
};

const generateCustomerId = () => {
  try {
    const id = sequenceService.getNextId('customers');
    persistStore();
    return id;
  } catch {
    const id = `CUST-${String(nextCustSeq).padStart(3, '0')}`;
    nextCustSeq += 1;
    return id;
  }
};

const generateChallanId = () => {
  try {
    const id = sequenceService.getNextId('deliveryChallans');
    persistStore();
    return id;
  } catch {
    const id = `DC/${String(nextChallanSeq).padStart(3, '0')}/${new Date().getFullYear()}`;
    nextChallanSeq += 1;
    return id;
  }
};

const generateReturnId = () => {
  const allReturnIds = new Set();
  deliveryChallans.forEach((dc) => {
    if (dc.returnId) allReturnIds.add(dc.returnId);
    if (dc.lastReturnId) allReturnIds.add(dc.lastReturnId);
    (dc.returnedHistory || []).forEach((rh) => {
      if (rh.returnId) allReturnIds.add(rh.returnId);
      if (rh.id) allReturnIds.add(rh.id);
    });
  });
  let candidate = `RET-${String(nextReturnSeq).padStart(3, '0')}`;
  while (allReturnIds.has(candidate)) {
    nextReturnSeq += 1;
    candidate = `RET-${String(nextReturnSeq).padStart(3, '0')}`;
  }
  const assignedId = candidate;
  nextReturnSeq += 1;
  return assignedId;
};

const generateInvoiceId = () => {
  try {
    const id = sequenceService.getNextId('invoices');
    persistStore();
    return id;
  } catch {
    const id = `INV/${String(nextInvoiceSeq).padStart(3, '0')}/${new Date().getFullYear()}`;
    nextInvoiceSeq += 1;
    return id;
  }
};

const generateProformaId = () => {
  const existingIds = new Set(proformas.map((p) => p.proformaId || p.id).filter(Boolean));
  let candidate = `PI/${String(nextProformaSeq).padStart(3, '0')}/${new Date().getFullYear()}`;
  while (existingIds.has(candidate)) {
    nextProformaSeq += 1;
    candidate = `PI/${String(nextProformaSeq).padStart(3, '0')}/${new Date().getFullYear()}`;
  }
  const assignedId = candidate;
  nextProformaSeq += 1;
  return assignedId;
};

function generateBranchId() {
  const id = `BR-${String(nextBranchSeq).padStart(3, '0')}`;
  nextBranchSeq += 1;
  return id;
}

const generatePurchaseOrderId = () => {
  try {
    const id = sequenceService.getNextId('purchaseOrders');
    persistStore();
    return id;
  } catch {
    const id = `PO/${String(nextPurchaseOrderSeq).padStart(3, '0')}/${new Date().getFullYear()}`;
    nextPurchaseOrderSeq += 1;
    return id;
  }
};

const generateGrnId = () => {
  const existingIds = new Set(goodsReceipts.map((grn) => grn.id || grn.grnId).filter(Boolean));
  let candidate = `GRN-${String(nextGrnSeq).padStart(3, '0')}`;
  while (existingIds.has(candidate)) {
    nextGrnSeq += 1;
    candidate = `GRN-${String(nextGrnSeq).padStart(3, '0')}`;
  }
  const assignedId = candidate;
  nextGrnSeq += 1;
  return assignedId;
};

const generateSupplierId = () => {
  const existingIds = new Set(suppliers.map((s) => s.id || s.supplierId).filter(Boolean));
  let candidate = `SUP-${String(nextSupplierSeq).padStart(3, '0')}`;
  while (existingIds.has(candidate)) {
    nextSupplierSeq += 1;
    candidate = `SUP-${String(nextSupplierSeq).padStart(3, '0')}`;
  }
  const assignedId = candidate;
  nextSupplierSeq += 1;
  return assignedId;
};

const removeCustomerById = (customerId) => {
  const index = customers.findIndex((customer) => customer.id === customerId);
  if (index >= 0) {
    customers.splice(index, 1);
    persistStore();
    return true;
  }
  return false;
};

module.exports = {
  customers,
  enquiries,
  orders,
  leads,
  quotations,
  deliveryChallans,
  invoices,
  proformas,
  suppliers,
  purchaseOrders,
  goodsReceipts,
  generateEnquiryId,
  generateOrderId,
  generateLeadId,
  generateQuotationId,
  peekQuotationId,
  generateCustomerId,
  generateChallanId,
  generateReturnId,
  generateInvoiceId,
  generateProformaId,
  generateBranchId,
  generatePurchaseOrderId,
  generateGrnId,
  generateSupplierId,
  removeCustomerById,
  persistStore
};

