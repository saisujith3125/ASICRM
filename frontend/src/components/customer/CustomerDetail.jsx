import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch, apiUrl } from '../../api';
import { statusBadgeClass, statusLabel } from '../../utils/crmDisplay';
import { hasPermission } from '../../utils/permissions';
import { navigate } from '../../router';
import DocumentPreviewModal from '../documents/DocumentPreviewModal';
import PrintableQuotation from '../documents/PrintableQuotation';
import PrintableDeliveryChallan from '../documents/PrintableDeliveryChallan';
import PrintableSalesInvoice from '../documents/PrintableSalesInvoice';
import { getQuotationFilename, getDcFilename, getInvoiceFilename } from '../documents/DocumentPdfService';
import { formatDate } from '../../utils/dateUtils';
import { useTablePagination, TableFooter } from '../common/TableWorkspace';



const getEnquiryTimestamp = (enquiry) => {
  const candidate = enquiry?.updatedAt || enquiry?.createdAt || enquiry?.lastContactAt || enquiry?.initialEnquiryDate;
  const timestamp = candidate ? Date.parse(candidate) : NaN;
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const getEnquiryNumber = (enquiry) => {
  const match = String(enquiry?.enquiryId || '').match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
};

function IconButton({ label, className = '', onClick, disabled = false, children }) {
  return (
    <button
      type="button"
      className={`tbl-icon-btn ${className}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

export default function CustomerDetail({
  user,
  customerId,
  navigationContext,
  onLoadToEnquiry,
  onBack,
  onBackToEnquiry,
  onBackToQuotation,
  onCreateEnquiryForCustomer: _onCreateEnquiryForCustomer,
  onSelectEnquiry
}) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState(() => navigationContext?.initialTab || 'requirements');

  const [requirementDraft, setRequirementDraft] = useState('');
  const [editingRequirementId, setEditingRequirementId] = useState(null);
  const [requirementBusy, setRequirementBusy] = useState(false);

  const [isBranchFormOpen, setIsBranchFormOpen] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState(null);
  const [branchDraft, setBranchDraft] = useState({
    branchName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: ''
  });
  const [branchFormErrors, setBranchFormErrors] = useState({});
  const [branchBusy, setBranchBusy] = useState(false);

  const [enquirySearch, setEnquirySearch] = useState('');
  const [enquirySourceFilter, setEnquirySourceFilter] = useState('ALL');
  const [enquirySort, setEnquirySort] = useState('NEWEST');

  // Unified Documents state & filters
  const [docSearch, setDocSearch] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('ALL');
  const [docSort, setDocSort] = useState('NEWEST');

  // Quotations state & filters (Only Customer Accepted)
  const [quotationSearch, setQuotationSearch] = useState('');
  const [quotationFilter, setQuotationFilter] = useState('ALL');
  const [quotationSort, setQuotationSort] = useState('NEWEST');
  const [selectedQuotationForPdf, setSelectedQuotationForPdf] = useState(null);

  // Delivery Challans state & filters
  const [dcSearch, setDcSearch] = useState('');
  const [dcFilter, setDcFilter] = useState('ALL');
  const [dcSort, setDcSort] = useState('NEWEST');
  const [selectedChallanForPdf, setSelectedChallanForPdf] = useState(null);

  // Invoices state & filters
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceFilter, setInvoiceFilter] = useState('ALL');
  const [invoiceSort, setInvoiceSort] = useState('NEWEST');
  const [selectedInvoiceForPdf, setSelectedInvoiceForPdf] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const fetchCustomerDetail = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiFetch(apiUrl(`/api/customers/${customerId}`), {
          headers: { 'x-user-id': user?.id || '' }
        });
        const data = await res.json();
        if (cancelled) return;

        if (res.ok && data.success && data.data) {
          setCustomer(data.data);
        } else {
          setError(data.message || 'Failed to load customer profile.');
        }
      } catch (err) {
        console.error('Error fetching customer profile:', err);
        if (!cancelled) setError('Unable to load customer profile from server.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (customerId) fetchCustomerDetail();
    return () => { cancelled = true; };
  }, [customerId, user?.id]);

  useEffect(() => {
    setEnquirySearch('');
    setEnquirySourceFilter('ALL');
    setEnquirySort('NEWEST');
    setDocSearch('');
    setDocTypeFilter('ALL');
    setDocSort('NEWEST');
    setQuotationSearch('');
    setQuotationFilter('ALL');
    setQuotationSort('NEWEST');
    setSelectedQuotationForPdf(null);
    setDcSearch('');
    setDcFilter('ALL');
    setDcSort('NEWEST');
    setSelectedChallanForPdf(null);
    setInvoiceSearch('');
    setInvoiceFilter('ALL');
    setInvoiceSort('NEWEST');
    setSelectedInvoiceForPdf(null);
    setEditingRequirementId(null);
    setRequirementDraft('');
    setIsBranchFormOpen(false);
    setEditingBranchId(null);
    setBranchDraft({
      branchName: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: ''
    });
    setBranchFormErrors({});
    if (navigationContext?.initialTab) {
      setActiveSection(navigationContext.initialTab);
    }
  }, [customerId, navigationContext?.initialTab]);

  const enquiriesList = Array.isArray(customer?.enquiries) ? customer.enquiries : [];
  const requirements = Array.isArray(customer?.requirements) ? customer.requirements : [];
  const branches = Array.isArray(customer?.branches) ? customer.branches : [];
  const quotationsList = Array.isArray(customer?.quotations) ? customer.quotations : [];
  // Keep strictly only customer accepted quotations (remove pending quotes)
  const acceptedQuotationsList = useMemo(() => {
    return quotationsList.filter((q) =>
      ['ACCEPTED', 'CUSTOMER_ACCEPTED', 'CONVERTED', 'CONFIRMED'].includes(String(q.status || '').toUpperCase()) ||
      Boolean(q.orderId)
    );
  }, [quotationsList]);

  const challansList = Array.isArray(customer?.deliveryChallans) ? customer.deliveryChallans : [];
  const rawInvoices = Array.isArray(customer?.invoices) ? customer.invoices : [];
  const confirmedInvoicesList = useMemo(() => {
    return rawInvoices.filter((inv) =>
      ['CONFIRMED', 'PAID', 'ISSUED'].includes(String(inv.status || '').toUpperCase())
    );
  }, [rawInvoices]);
  const invoicesList = confirmedInvoicesList;

  // Delivery Challans not yet converted to invoice (unbilled goods protection)
  const customerUnbilledChallans = useMemo(() => {
    return challansList.filter((dc) => {
      const isReturnable = dc.deliveryPurpose === 'RETURNABLE' || dc.documentType === 'RETURNABLE_DC' || dc.isReturnableDC;
      if (isReturnable) return false;
      const hasInvoice = Boolean(
        dc.invoiceId ||
        confirmedInvoicesList.some((inv) => (inv.challanId && inv.challanId === dc.challanId))
      );
      return !hasInvoice;
    });
  }, [challansList, confirmedInvoicesList]);

  // Unified all customer documents collection with generated PDFs
  const unifiedDocumentsList = useMemo(() => {
    const docs = [];

    acceptedQuotationsList.forEach((q) => {
      const items = q.items || [];
      const primaryItem = items[0]?.productName || items[0]?.name || items[0]?.productCode || 'Equipment';
      const summaryText = items.length > 1 ? `${primaryItem} (+${items.length - 1} more)` : primaryItem;
      docs.push({
        id: q.quotationId,
        docType: 'QUOTATION',
        docLabel: 'Quotation',
        docNo: q.quotationId,
        date: q.quotationDate || q.createdAt,
        reference: q.orderId ? `Order: ${q.orderId}` : (q.enquiryId ? `Enquiry: ${q.enquiryId}` : '—'),
        summary: summaryText,
        itemCount: items.length,
        totalAmount: q.finalTotal || q.grandTotal || q.totalAmount || 0,
        status: 'CUSTOMER_ACCEPTED',
        statusText: '✓ Customer Accepted',
        rawDoc: q,
        onPdfClick: () => setSelectedQuotationForPdf(q)
      });
    });

    challansList.forEach((dc) => {
      const items = dc.items || [];
      const primaryItem = items[0]?.productName || items[0]?.name || items[0]?.productCode || 'Dispatched Items';
      const summaryText = items.length > 1 ? `${primaryItem} (+${items.length - 1} more)` : primaryItem;
      const matchingInv = confirmedInvoicesList.find((i) => (i.challanId && i.challanId === dc.challanId) || (dc.invoiceId && i.invoiceId === dc.invoiceId));
      const invoiceId = dc.invoiceId || matchingInv?.invoiceId || null;
      const isReturnable = dc.deliveryPurpose === 'RETURNABLE' || dc.documentType === 'RETURNABLE_DC' || dc.isReturnableDC;
      const isUnbilled = !isReturnable && !invoiceId;

      docs.push({
        id: dc.challanId,
        docType: 'DELIVERY_CHALLAN',
        docLabel: 'Delivery Challan',
        docNo: dc.challanId,
        date: dc.deliveryDate || dc.createdAt,
        reference: invoiceId ? `Inv: ${invoiceId}` : (dc.refNo ? `Ref: ${dc.refNo}` : (dc.orderId ? `Order: ${dc.orderId}` : '—')),
        summary: summaryText,
        itemCount: items.length,
        totalAmount: null,
        status: dc.status || 'DELIVERED',
        statusText: isUnbilled ? '⚠️ Unbilled DC' : (dc.status === 'DELIVERED' ? '✓ Delivered' : (dc.status || 'Active')),
        rawDoc: dc,
        onPdfClick: () => setSelectedChallanForPdf(dc)
      });
    });

    confirmedInvoicesList.forEach((inv) => {
      const items = inv.lineItems || inv.items || [];
      const primaryItem = items[0]?.productName || items[0]?.name || items[0]?.productCode || 'Billed Equipment';
      const summaryText = items.length > 1 ? `${primaryItem} (+${items.length - 1} more)` : primaryItem;
      docs.push({
        id: inv.invoiceId,
        docType: 'INVOICE',
        docLabel: 'Sales Invoice',
        docNo: inv.invoiceId,
        date: inv.invoiceDate || inv.createdAt,
        reference: inv.orderId ? `Order: ${inv.orderId}` : (inv.quotationId ? `Quote: ${inv.quotationId}` : '—'),
        summary: summaryText,
        itemCount: items.length,
        totalAmount: inv.totalAmount || inv.grandTotal || 0,
        status: inv.status || 'CONFIRMED',
        statusText: inv.status === 'PAID' ? '✓ Paid' : '✓ Confirmed',
        rawDoc: inv,
        onPdfClick: () => setSelectedInvoiceForPdf(inv)
      });
    });

    return docs;
  }, [acceptedQuotationsList, challansList, confirmedInvoicesList]);

  const canManageRequirements = hasPermission(user, 'Customers', 'Edit');
  const canManageBranches = hasPermission(user, 'Customers', 'Edit') || hasPermission(user, 'Customers', 'Manage Branches');

  const formatCurrency = (amt) => '₹' + Number(amt || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const enquirySources = useMemo(() => {
    const values = enquiriesList
      .map((enquiry) => String(enquiry?.source || '').trim())
      .filter(Boolean);
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
  }, [enquiriesList]);

  const filteredEnquiries = useMemo(() => {
    const query = enquirySearch.trim().toLowerCase();

    const filtered = enquiriesList.filter((enquiry) => {
      const matchesSearch = !query || [
        enquiry?.enquiryId,
        enquiry?.customerName,
        enquiry?.contactPerson,
        enquiry?.phone,
        enquiry?.source,
        enquiry?.assignedTo,
        enquiry?.salesRepresentative,
        enquiry?.representative,
        enquiry?.status,
        enquiry?.priority,
        enquiry?.requirement,
        enquiry?.productRequirement
      ].some((value) => String(value ?? '').toLowerCase().includes(query));

      const matchesSource =
        enquirySourceFilter === 'ALL' ||
        String(enquiry?.source || '').trim() === enquirySourceFilter;

      return matchesSearch && matchesSource;
    });

    return filtered.sort((a, b) => {
      if (enquirySort === 'OLDEST') {
        return getEnquiryTimestamp(a) - getEnquiryTimestamp(b) || getEnquiryNumber(a) - getEnquiryNumber(b);
      }
      if (enquirySort === 'PRIORITY') {
        const rank = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
        return (rank[a?.priority] ?? 99) - (rank[b?.priority] ?? 99)
          || getEnquiryTimestamp(b) - getEnquiryTimestamp(a);
      }
      return getEnquiryTimestamp(b) - getEnquiryTimestamp(a) || getEnquiryNumber(b) - getEnquiryNumber(a);
    });
  }, [enquiriesList, enquirySearch, enquirySourceFilter, enquirySort]);

  const filteredUnifiedDocs = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    const filtered = unifiedDocumentsList.filter((doc) => {
      const matchSearch = !q || [
        doc.docNo,
        doc.docType,
        doc.docLabel,
        doc.reference,
        doc.summary,
        String(doc.totalAmount || '')
      ].some((v) => String(v || '').toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (docTypeFilter !== 'ALL' && doc.docType !== docTypeFilter) {
        return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      const timeA = Date.parse(a.date || '') || 0;
      const timeB = Date.parse(b.date || '') || 0;
      if (docSort === 'OLDEST') return timeA - timeB;
      if (docSort === 'HIGHEST_VALUE') {
        return (Number(b.totalAmount) || 0) - (Number(a.totalAmount) || 0);
      }
      return timeB - timeA;
    });
  }, [unifiedDocumentsList, docSearch, docTypeFilter, docSort]);

  // Quotations strictly customer-accepted (pending filter removed)
  const filteredQuotations = useMemo(() => {
    const q = quotationSearch.trim().toLowerCase();
    const filtered = acceptedQuotationsList.filter((item) => {
      const matchSearch = !q || [
        item.quotationId,
        item.status,
        item.subject,
        String(item.finalTotal || item.grandTotal || item.totalAmount || ''),
        ...(item.items || []).map((it) => `${it.productName || it.name || ''} ${it.productCode || it.code || ''}`)
      ].some((v) => String(v || '').toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (quotationFilter === 'CONVERTED') {
        return item.status === 'CONVERTED' || Boolean(item.orderId);
      }
      return true;
    });

    return filtered.sort((a, b) => {
      const timeA = Date.parse(a.quotationDate || a.createdAt || '') || 0;
      const timeB = Date.parse(b.quotationDate || b.createdAt || '') || 0;
      if (quotationSort === 'OLDEST') return timeA - timeB;
      if (quotationSort === 'HIGHEST_VALUE') {
        const valA = Number(a.finalTotal || a.grandTotal || a.totalAmount || 0);
        const valB = Number(b.finalTotal || b.grandTotal || b.totalAmount || 0);
        return valB - valA;
      }
      return timeB - timeA;
    });
  }, [acceptedQuotationsList, quotationSearch, quotationFilter, quotationSort]);

  const filteredChallans = useMemo(() => {
    const q = dcSearch.trim().toLowerCase();
    const filtered = challansList.filter((item) => {
      const matchSearch = !q || [
        item.challanId,
        item.status,
        item.deliveryStatus,
        item.deliveryPurpose,
        item.refNo,
        ...(item.items || []).map((it) => `${it.productName || it.name || ''} ${it.productCode || it.code || ''}`)
      ].some((v) => String(v || '').toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (dcFilter === 'DELIVERED') {
        return item.status === 'DELIVERED';
      }
      if (dcFilter === 'DISPATCHED') {
        return item.status === 'DISPATCHED';
      }
      if (dcFilter === 'PARTIAL') {
        return item.deliveryStatus === 'PARTIAL' || Number(item.remainingAfterThisDC || 0) > 0;
      }
      if (dcFilter === 'RETURNED') {
        return ['RETURNED', 'PARTIALLY RETURNED'].includes(item.status);
      }
      return true;
    });

    return filtered.sort((a, b) => {
      const timeA = Date.parse(a.deliveryDate || a.createdAt || '') || 0;
      const timeB = Date.parse(b.deliveryDate || b.createdAt || '') || 0;
      if (dcSort === 'OLDEST') return timeA - timeB;
      return timeB - timeA;
    });
  }, [challansList, dcSearch, dcFilter, dcSort]);

  const filteredInvoices = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    const filtered = invoicesList.filter((item) => {
      const matchSearch = !q || [
        item.invoiceId,
        item.orderId,
        item.status,
        String(item.totalAmount || item.grandTotal || ''),
        ...((item.lineItems || item.items) || []).map((it) => `${it.productName || it.name || ''} ${it.productCode || it.code || ''}`)
      ].some((v) => String(v || '').toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (invoiceFilter === 'CONFIRMED' || invoiceFilter === 'PAID') {
        return ['CONFIRMED', 'PAID'].includes(item.status) || item.paymentStatus === 'PAID';
      }
      if (invoiceFilter === 'PENDING' || invoiceFilter === 'ISSUED') {
        return item.status !== 'PAID' && item.status !== 'CONFIRMED' && item.paymentStatus !== 'PAID';
      }
      return true;
    });

    return filtered.sort((a, b) => {
      const timeA = Date.parse(a.invoiceDate || a.createdAt || '') || 0;
      const timeB = Date.parse(b.invoiceDate || b.createdAt || '') || 0;
      if (invoiceSort === 'OLDEST') return timeA - timeB;
      if (invoiceSort === 'HIGHEST_VALUE') {
        const valA = Number(a.totalAmount || a.grandTotal || 0);
        const valB = Number(b.totalAmount || b.grandTotal || 0);
        return valB - valA;
      }
      return timeB - timeA;
    });
  }, [invoicesList, invoiceSearch, invoiceFilter, invoiceSort]);

  const filteredCustomerUnbilledChallans = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    const filtered = customerUnbilledChallans.filter((item) => {
      const matchSearch = !q || [
        item.challanId,
        item.status,
        item.deliveryStatus,
        item.refNo,
        item.orderId,
        ...(item.items || []).map((it) => `${it.productName || it.name || ''} ${it.productCode || it.code || ''}`)
      ].some((v) => String(v || '').toLowerCase().includes(q));

      return matchSearch;
    });

    return filtered.sort((a, b) => {
      const timeA = Date.parse(a.deliveryDate || a.createdAt || '') || 0;
      const timeB = Date.parse(b.deliveryDate || b.createdAt || '') || 0;
      if (invoiceSort === 'OLDEST') return timeA - timeB;
      return timeB - timeA;
    });
  }, [customerUnbilledChallans, invoiceSearch, invoiceSort]);

  // Standard Table Pagination Logic for each panel
  const enquiryPagination = useTablePagination(filteredEnquiries, {
    explicitPageSize: 10,
    resetDeps: [enquirySearch, enquirySourceFilter, enquirySort]
  });

  const docPagination = useTablePagination(filteredUnifiedDocs, {
    explicitPageSize: 10,
    resetDeps: [docSearch, docTypeFilter, docSort]
  });

  const quotationPagination = useTablePagination(filteredQuotations, {
    explicitPageSize: 10,
    resetDeps: [quotationSearch, quotationFilter, quotationSort]
  });

  const dcPagination = useTablePagination(filteredChallans, {
    explicitPageSize: 10,
    resetDeps: [dcSearch, dcFilter, dcSort]
  });

  const invoicePagination = useTablePagination(filteredInvoices, {
    explicitPageSize: 10,
    resetDeps: [invoiceSearch, invoiceFilter, invoiceSort]
  });

  const customerUnbilledPagination = useTablePagination(filteredCustomerUnbilledChallans, {
    explicitPageSize: 10,
    resetDeps: [invoiceSearch, invoiceSort]
  });

  const visibleRequirements = requirements;
  const visibleBranches = branches;
  const visibleEnquiries = filteredEnquiries;

  const refreshFromResponse = (data) => {
    if (data?.success && data.data) {
      setCustomer(data.data);
      return true;
    }
    setError(data?.message || 'Unable to update customer requirements.');
    return false;
  };

  const resetRequirementEditor = () => {
    setRequirementDraft('');
    setEditingRequirementId(null);
  };

  const saveRequirement = async (event) => {
    event.preventDefault();
    const text = requirementDraft.trim();
    if (!text) {
      setError('Requirement cannot be empty.');
      return;
    }

    setRequirementBusy(true);
    setError('');
    try {
      const isEditing = Boolean(editingRequirementId && editingRequirementId !== 'new');
      const endpoint = isEditing
        ? `/api/customers/${customer.id}/requirements/${editingRequirementId}`
        : `/api/customers/${customer.id}/requirements`;
      const response = await apiFetch(apiUrl(endpoint), {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user?.id || '' },
        body: JSON.stringify({ text })
      });
      const data = await response.json();
      if (refreshFromResponse(data)) {
        resetRequirementEditor();
        setActiveSection('requirements');
      }
    } catch (requestError) {
      console.error('Customer requirement save error:', requestError);
      setError('Unable to save the requirement right now.');
    } finally {
      setRequirementBusy(false);
    }
  };

  const deleteRequirement = async (requirementId) => {
    if (!window.confirm('Delete this requirement?')) return;
    setRequirementBusy(true);
    setError('');
    try {
      const response = await apiFetch(apiUrl(`/api/customers/${customer.id}/requirements/${requirementId}`), {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' }
      });
      const data = await response.json();
      if (refreshFromResponse(data)) {
        resetRequirementEditor();
      }
    } catch (requestError) {
      console.error('Customer requirement delete error:', requestError);
      setError('Unable to delete the requirement right now.');
    } finally {
      setRequirementBusy(false);
    }
  };

  const resetBranchForm = () => {
    setIsBranchFormOpen(false);
    setEditingBranchId(null);
    setBranchDraft({
      branchName: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: ''
    });
    setBranchFormErrors({});
  };

  const handleOpenAddBranch = () => {
    resetBranchForm();
    setIsBranchFormOpen(true);
    setError('');
  };

  const handleOpenEditBranch = (branch) => {
    setEditingBranchId(branch.branchId || branch.id);
    setBranchDraft({
      branchName: branch.branchName || '',
      contactPerson: branch.contactPerson || '',
      phone: branch.phone || '',
      email: branch.email || '',
      address: branch.address || branch.branchAddress || ''
    });
    setBranchFormErrors({});
    setIsBranchFormOpen(true);
    setError('');
  };

  const validateBranchDraft = (draft) => {
    const errors = {};
    if (!String(draft.branchName || '').trim()) {
      errors.branchName = 'Branch Name is required.';
    }
    if (!String(draft.contactPerson || '').trim()) {
      errors.contactPerson = 'Contact Person is required.';
    }
    const rawPhone = String(draft.phone || '').trim();
    const phoneDigits = rawPhone.replace(/\D/g, '');
    if (!rawPhone) {
      errors.phone = 'Phone number is required.';
    } else if (phoneDigits.length < 10) {
      errors.phone = 'Phone number must have at least 10 digits.';
    }
    const rawEmail = String(draft.email || '').trim();
    if (rawEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(rawEmail)) {
        errors.email = 'Please enter a valid email address.';
      }
    }
    return errors;
  };

  const saveBranch = async (event) => {
    if (event?.preventDefault) event.preventDefault();
    const errors = validateBranchDraft(branchDraft);
    if (Object.keys(errors).length > 0) {
      setBranchFormErrors(errors);
      return;
    }

    setBranchBusy(true);
    setError('');
    try {
      const isEditing = Boolean(editingBranchId);
      const endpoint = isEditing
        ? `/api/customers/${customer.id}/branches/${editingBranchId}`
        : `/api/customers/${customer.id}/branches`;
      const payload = {
        branchName: branchDraft.branchName.trim(),
        contactPerson: branchDraft.contactPerson.trim(),
        phone: branchDraft.phone.trim(),
        email: branchDraft.email.trim(),
        address: branchDraft.address.trim()
      };
      const response = await apiFetch(apiUrl(endpoint), {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || ''
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (refreshFromResponse(data)) {
        resetBranchForm();
        setActiveSection('branches');
      }
    } catch (requestError) {
      console.error('Customer branch save error:', requestError);
      setError('Unable to save the branch right now.');
    } finally {
      setBranchBusy(false);
    }
  };

  const deleteBranch = async (branchId) => {
    if (!window.confirm('Delete this branch?')) return;
    setBranchBusy(true);
    setError('');
    try {
      const response = await apiFetch(apiUrl(`/api/customers/${customer.id}/branches/${branchId}`), {
        method: 'DELETE',
        headers: { 'x-user-id': user?.id || '' }
      });
      const data = await response.json();
      if (refreshFromResponse(data)) {
        if (editingBranchId === branchId) {
          resetBranchForm();
        }
      }
    } catch (requestError) {
      console.error('Customer branch delete error:', requestError);
      setError('Unable to delete the branch right now.');
    } finally {
      setBranchBusy(false);
    }
  };

  const formatPhoneDisplay = (raw) => {
    const str = String(raw || '').trim();
    const digits = str.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+91 ${digits}`;
    }
    return str;
  };

  const openEnquiry = (enquiry) => {
    if (!onSelectEnquiry) return;
    if (enquiry.status === 'CLOSED') {
      onSelectEnquiry(enquiry.enquiryId, 'solved');
      return;
    }
    if (enquiry.status === 'QUOTATION_ISSUED' && enquiry.quotationId) {
      onSelectEnquiry(enquiry.enquiryId, 'quotation');
      return;
    }
    onSelectEnquiry(enquiry.enquiryId, 'details');
  };

  if (loading) {
    return (
      <div className="crm-loading-full">
        <div className="crm-spinner" />
        <p>Loading customer profile...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="crm-alert-box error">
        <span>Customer not found.</span>
        <button onClick={onBack} className="crm-btn-secondary">Back to Customer List</button>
      </div>
    );
  }

  const tabs = [
    { key: 'requirements', label: 'Requirements', count: requirements.length },
    { key: 'branches', label: 'Branches', count: branches.length },
    { key: 'enquiries', label: 'Enquiry History', count: enquiriesList.length },
    { key: 'allDocuments', label: 'All Documents', count: unifiedDocumentsList.length },
    { key: 'quotations', label: 'Quotations', count: acceptedQuotationsList.length },
    { key: 'deliveryChallans', label: 'Delivery Challans', count: challansList.length },
    {
      key: 'invoices',
      label: customerUnbilledChallans.length > 0 ? `Invoices (${customerUnbilledChallans.length} Unbilled)` : 'Invoices',
      count: invoicesList.length
    }
  ];

  const isFromQuotation = Boolean(
    navigationContext?.from === 'quotation'
  );
  const isFromEnquiry = Boolean(
    !isFromQuotation && (
      navigationContext?.enquiryId ||
      navigationContext?.from === 'enquiry' ||
      navigationContext?.from === 'enquiry-details'
    )
  );
  const isFromEnquiryCreate = navigationContext?.from === 'enquiry-create';

  return (
    <div className="crm-customer-detail-page customer-detail-modern">
      <div className="detail-top-nav-bar customer-detail-nav-compact">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {isFromQuotation ? (
            <button
              type="button"
              onClick={() => {
                if (onBack) {
                  onBack();
                } else if (navigationContext?.returnTo) {
                  navigate(navigationContext.returnTo);
                } else if (onBackToQuotation) {
                  onBackToQuotation();
                } else if (navigationContext?.enquiryId) {
                  navigate(`/enquiries/${encodeURIComponent(navigationContext.enquiryId)}/quotation`);
                }
              }}
              className="crm-back-btn"
            >
              ← Back to Quotation
            </button>
          ) : (
            <>
              <button type="button" onClick={onBack} className="crm-back-btn">
                ← Back to Customer Directory
              </button>
              {isFromEnquiry && (
                <button
                  type="button"
                  onClick={() => {
                    if (onBackToEnquiry) {
                      onBackToEnquiry();
                    } else if (navigationContext?.returnTo) {
                      navigate(navigationContext.returnTo);
                    } else if (navigationContext?.enquiryId) {
                      navigate(`/enquiries/${encodeURIComponent(navigationContext.enquiryId)}`);
                    } else {
                      onBack();
                    }
                  }}
                  className="crm-back-btn crm-back-to-enquiry-btn"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#1d4ed8' }}
                >
                  ← Back to Enquiry
                </button>
              )}
            </>
          )}
        </div>
        {isFromEnquiryCreate && onLoadToEnquiry && (
          <button
            type="button"
            onClick={() => onLoadToEnquiry(customer)}
            className="crm-btn-primary compact customer-detail-create-btn"
            style={{ fontWeight: 600 }}
          >
            Load to Enquiry →
          </button>
        )}
      </div>

      {error && (
        <div className="crm-alert-box error customer-detail-alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss error">×</button>
        </div>
      )}

      <section className="customer-hero-profile-card customer-hero-compact">
        <div className="profile-avatar-large" aria-hidden="true">
          {(customer.name || 'CU')
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0])
            .join('')
            .toUpperCase()}
        </div>

        <div className="profile-hero-info">
          <span className="customer-profile-kicker">CUSTOMER PROFILE</span>
          <div className="hero-name-row">
            <h1 className="profile-customer-name">{customer.name}</h1>
            <span className="customer-id-pill">{customer.id}</span>
          </div>
          <p className="profile-company-title">
            {customer.company || customer.contactPerson || 'Customer account'}
            {customer.contactPerson && customer.company ? ` · Contact: ${customer.contactPerson}` : ''}
          </p>
          <div className="profile-contact-chips">
            {customer.mobile && <span className="contact-chip"><span aria-hidden="true">☎</span> +91 {customer.mobile}</span>}
            {customer.email && <span className="contact-chip"><span aria-hidden="true">✉</span> {customer.email}</span>}
            {customer.city && <span className="contact-chip"><span aria-hidden="true">⌖</span> {customer.city}</span>}
          </div>
        </div>

        <div className="profile-stats-summary customer-profile-hero-stats">
          <div
            className="stat-pill-block"
            onClick={() => setActiveSection('enquiries')}
            style={{ cursor: 'pointer' }}
            title="View customer enquiries"
          >
            <span className="num">{enquiriesList.length}</span>
            <span className="lbl">Enquiries</span>
          </div>
          <div
            className="stat-pill-block"
            onClick={() => setActiveSection('allDocuments')}
            style={{ cursor: 'pointer' }}
            title="View all customer documents"
          >
            <span className="num">{unifiedDocumentsList.length}</span>
            <span className="lbl">All Documents</span>
          </div>
          <div
            className="stat-pill-block"
            onClick={() => setActiveSection('quotations')}
            style={{ cursor: 'pointer' }}
            title="View customer accepted quotations"
          >
            <span className="num">{acceptedQuotationsList.length}</span>
            <span className="lbl">Quotations</span>
          </div>
          <div
            className="stat-pill-block"
            onClick={() => setActiveSection('deliveryChallans')}
            style={{ cursor: 'pointer' }}
            title="View customer delivery challans"
          >
            <span className="num">{challansList.length}</span>
            <span className="lbl">Delivery Challans</span>
          </div>
          <div
            className="stat-pill-block"
            onClick={() => setActiveSection('invoices')}
            style={{ cursor: 'pointer' }}
            title="View customer invoices"
          >
            <span className="num">{invoicesList.length}</span>
            <span className="lbl">Invoices</span>
          </div>
          {customerUnbilledChallans.length > 0 && (
            <div
              className="stat-pill-block"
              onClick={() => {
                setActiveSection('invoices');
                setInvoiceFilter('UNBILLED_DCS');
              }}
              style={{
                cursor: 'pointer',
                borderColor: '#fde68a',
                background: '#fffbeb'
              }}
              title="Click to view Delivery Challans not yet converted to an invoice"
            >
              <span className="num" style={{ color: '#b45309' }}>{customerUnbilledChallans.length}</span>
              <span className="lbl" style={{ color: '#92400e', fontWeight: 600 }}>⚠️ Unbilled DCs</span>
            </div>
          )}
        </div>
      </section>

      <section className="customer-detail-workspace">
        <nav className="customer-detail-tabs" role="tablist" aria-label="Customer profile sections">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeSection === tab.key}
              className={`customer-detail-tab ${activeSection === tab.key ? 'active' : ''}`}
              onClick={() => {
                setActiveSection(tab.key);
                setError('');
              }}
            >
              <span>{tab.label}</span>
              <span className="customer-detail-tab-count">{tab.count}</span>
            </button>
          ))}
        </nav>

        {activeSection === 'requirements' && (
          <section className="customer-detail-panel" role="tabpanel" aria-label="Requirements">
            <div className="customer-detail-panel-header">
              <div>
                <h2>Requirements</h2>
                <p>Manage customer requirements without leaving the profile.</p>
              </div>
              {canManageRequirements && !editingRequirementId && (
                <button
                  type="button"
                  className="crm-btn-primary compact"
                  onClick={() => {
                    setRequirementDraft('');
                    setEditingRequirementId('new');
                    setError('');
                  }}
                  disabled={requirementBusy}
                >
                  + Add Requirement
                </button>
              )}
            </div>

            {editingRequirementId === 'new' && (
              <form className="customer-requirement-editor customer-requirement-editor-compact" onSubmit={saveRequirement}>
                <div className="customer-requirement-editor-row">
                  <div className="requirement-editor-field">
                    <label className="field-label" htmlFor="customer-requirement-input">Requirement</label>
                    <input
                      id="customer-requirement-input"
                      type="text"
                      className="crm-text-input"
                      value={requirementDraft}
                      maxLength={1000}
                      onChange={(event) => setRequirementDraft(event.target.value)}
                      placeholder="Enter the customer's requirement"
                      autoFocus
                      disabled={requirementBusy}
                    />
                  </div>
                  <div className="customer-requirement-editor-actions">
                    <button type="submit" className="crm-btn-primary compact" disabled={requirementBusy}>
                      {requirementBusy ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" className="crm-btn-secondary compact" onClick={resetRequirementEditor} disabled={requirementBusy}>Cancel</button>
                  </div>
                </div>
              </form>
            )}

            <div className="settings-table-shell stocks-table-shell customer-master-card customer-compact-table-wrap">
              <div className="crm-table-scroll-wrap stocks-table-natural-wrap">
                <table className="settings-table customer-detail-table customer-requirements-table">
                <thead>
                  <tr>
                    <th className="col-priority-low" style={{ width: '50px', textAlign: 'center' }}>#</th>
                    <th className="col-priority-high" style={{ textAlign: 'left' }}>Requirement</th>
                    <th className="actions-col col-priority-high" style={{ width: '90px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.length === 0 ? (
                    <tr className="empty-row">
                      <td colSpan="3">
                        <div className="customer-detail-empty-state compact-empty">
                          <div className="customer-detail-empty-icon" aria-hidden="true">✓</div>
                          <h3>No requirements yet</h3>
                          <p>Add the customer's first requirement to keep it visible and manageable here.</p>
                          {canManageRequirements && !editingRequirementId && (
                            <button type="button" className="crm-btn-primary compact" onClick={() => setEditingRequirementId('new')}>
                              + Add Requirement
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    visibleRequirements.map((item, idx) => (
                      <tr key={item.id}>
                        <td data-label="#" className="col-priority-low">
                          {idx + 1}
                        </td>
                        <td data-label="Requirement" className="col-priority-high cell-wrap">
                          {editingRequirementId === item.id ? (
                            <form className="customer-requirement-inline-editor" onSubmit={saveRequirement}>
                              <input
                                type="text"
                                className="crm-text-input"
                                value={requirementDraft}
                                maxLength={1000}
                                onChange={(event) => setRequirementDraft(event.target.value)}
                                autoFocus
                                disabled={requirementBusy}
                              />
                              <button type="submit" className="tbl-icon-btn edit" title="Save" disabled={requirementBusy}>✓</button>
                              <button type="button" className="tbl-icon-btn" title="Cancel" onClick={resetRequirementEditor} disabled={requirementBusy}>✕</button>
                            </form>
                          ) : (
                            <p style={{ margin: 0 }}>{item.text}</p>
                          )}
                        </td>
                        <td data-label="Actions" className="actions-col col-priority-high">
                          {canManageRequirements && editingRequirementId !== item.id && (
                            <div className="action-buttons-group">
                              <IconButton
                                label="Edit requirement"
                                className="edit"
                                onClick={() => {
                                  setEditingRequirementId(item.id);
                                  setRequirementDraft(item.text);
                                  setError('');
                                }}
                                disabled={requirementBusy}
                              >
                                ✎
                              </IconButton>
                              <IconButton
                                label="Delete requirement"
                                className="danger"
                                onClick={() => deleteRequirement(item.id)}
                                disabled={requirementBusy}
                              >
                                🗑
                              </IconButton>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
              <CustomerPager
                label={`${requirements.length} ${requirements.length === 1 ? 'requirement' : 'requirements'}`}
              />
            </div>
          </section>
        )}

        {activeSection === 'branches' && (
          <section className="customer-detail-panel" role="tabpanel" aria-label="Branches">
            <div className="customer-detail-panel-header">
              <div>
                <h2>Branches</h2>
                <p>Customer branch contacts associated with this account.</p>
              </div>
              {canManageBranches && !isBranchFormOpen && (
                <button
                  type="button"
                  className="crm-btn-primary compact"
                  onClick={handleOpenAddBranch}
                  disabled={branchBusy}
                >
                  + Add Branch
                </button>
              )}
            </div>

            {isBranchFormOpen && (
              <form className="customer-branch-editor-card" onSubmit={saveBranch} noValidate>
                <div className="branch-form-header">
                  <h3 className="branch-form-title">
                    {editingBranchId ? 'Edit Branch' : 'Add New Branch'}
                  </h3>
                  <span className="branch-form-subtitle">
                    {editingBranchId ? 'Update details for this branch.' : 'Enter the contact details for this customer branch.'}
                  </span>
                </div>

                <div className="branch-form-grid">
                  <div className="form-field-group">
                    <label className="field-label" htmlFor="branch-name-input">
                      Branch Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      id="branch-name-input"
                      type="text"
                      className={`crm-text-input ${branchFormErrors.branchName ? 'input-error' : ''}`}
                      value={branchDraft.branchName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBranchDraft((prev) => ({ ...prev, branchName: val }));
                        if (branchFormErrors.branchName) setBranchFormErrors((prev) => ({ ...prev, branchName: '' }));
                      }}
                      placeholder="Enter branch name"
                      disabled={branchBusy}
                      autoFocus
                    />
                    {branchFormErrors.branchName && (
                      <span className="field-error-text" style={{ color: '#ef4444', fontSize: '11px', marginTop: '3px', display: 'block' }}>
                        {branchFormErrors.branchName}
                      </span>
                    )}
                  </div>

                  <div className="form-field-group">
                    <label className="field-label" htmlFor="branch-contact-input">
                      Contact Person <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      id="branch-contact-input"
                      type="text"
                      className={`crm-text-input ${branchFormErrors.contactPerson ? 'input-error' : ''}`}
                      value={branchDraft.contactPerson}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBranchDraft((prev) => ({ ...prev, contactPerson: val }));
                        if (branchFormErrors.contactPerson) setBranchFormErrors((prev) => ({ ...prev, contactPerson: '' }));
                      }}
                      placeholder="Enter contact person"
                      disabled={branchBusy}
                    />
                    {branchFormErrors.contactPerson && (
                      <span className="field-error-text" style={{ color: '#ef4444', fontSize: '11px', marginTop: '3px', display: 'block' }}>
                        {branchFormErrors.contactPerson}
                      </span>
                    )}
                  </div>

                  <div className="form-field-group">
                    <label className="field-label" htmlFor="branch-phone-input">
                      Phone <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      id="branch-phone-input"
                      type="tel"
                      className={`crm-text-input ${branchFormErrors.phone ? 'input-error' : ''}`}
                      value={branchDraft.phone}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBranchDraft((prev) => ({ ...prev, phone: val }));
                        if (branchFormErrors.phone) setBranchFormErrors((prev) => ({ ...prev, phone: '' }));
                      }}
                      placeholder="Enter phone number"
                      disabled={branchBusy}
                    />
                    {branchFormErrors.phone && (
                      <span className="field-error-text" style={{ color: '#ef4444', fontSize: '11px', marginTop: '3px', display: 'block' }}>
                        {branchFormErrors.phone}
                      </span>
                    )}
                  </div>

                  <div className="form-field-group">
                    <label className="field-label" htmlFor="branch-email-input">
                      Email
                    </label>
                    <input
                      id="branch-email-input"
                      type="email"
                      className={`crm-text-input ${branchFormErrors.email ? 'input-error' : ''}`}
                      value={branchDraft.email}
                      onChange={(e) => {
                        const val = e.target.value;
                        setBranchDraft((prev) => ({ ...prev, email: val }));
                        if (branchFormErrors.email) setBranchFormErrors((prev) => ({ ...prev, email: '' }));
                      }}
                      placeholder="Enter email address"
                      disabled={branchBusy}
                    />
                    {branchFormErrors.email && (
                      <span className="field-error-text" style={{ color: '#ef4444', fontSize: '11px', marginTop: '3px', display: 'block' }}>
                        {branchFormErrors.email}
                      </span>
                    )}
                  </div>

                  <div className="form-field-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="field-label" htmlFor="branch-address-input">
                      Branch Address
                    </label>
                    <input
                      id="branch-address-input"
                      type="text"
                      className="crm-text-input"
                      value={branchDraft.address}
                      onChange={(e) => setBranchDraft((prev) => ({ ...prev, address: e.target.value }))}
                      placeholder="Enter complete branch address"
                      disabled={branchBusy}
                    />
                  </div>
                </div>

                <div className="branch-form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #edf2f7' }}>
                  <button
                    type="button"
                    className="crm-btn-secondary compact"
                    onClick={resetBranchForm}
                    disabled={branchBusy}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="crm-btn-primary compact"
                    disabled={branchBusy}
                  >
                    {branchBusy ? 'Saving…' : 'Save Branch'}
                  </button>
                </div>
              </form>
            )}

            <div className="settings-table-shell stocks-table-shell customer-master-card customer-compact-table-wrap">
              <div className="crm-table-scroll-wrap stocks-table-natural-wrap">
                <table className="settings-table customer-detail-table customer-branches-table">
                <colgroup>
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '21%' }} />
                  <col style={{ width: '12%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="th-idx" style={{ width: '5%', textAlign: 'center' }}>#</th>
                    <th className="th-branch" style={{ width: '28%', textAlign: 'left' }}>BRANCH</th>
                    <th className="th-contact" style={{ width: '18%', textAlign: 'left' }}>CONTACT</th>
                    <th className="th-phone" style={{ width: '16%', textAlign: 'left' }}>PHONE</th>
                    <th className="th-email" style={{ width: '21%', textAlign: 'left' }}>EMAIL</th>
                    <th className="th-actions" style={{ width: '12%', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.length === 0 ? (
                    <tr className="empty-row">
                      <td colSpan="6">
                        <div className="customer-detail-empty-state compact-empty">
                          <div className="customer-detail-empty-icon" aria-hidden="true">🏢</div>
                          <h3>No branches recorded</h3>
                          <p>This customer does not have any branch records yet.</p>
                          {canManageBranches && !isBranchFormOpen && (
                            <button
                              type="button"
                              className="crm-btn-primary compact"
                              onClick={handleOpenAddBranch}
                              disabled={branchBusy}
                            >
                              + Add Branch
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    visibleBranches.map((branch, idx) => (
                      <tr key={branch.branchId || branch.id || `branch-${idx}`}>
                        <td data-label="#" className="td-idx">
                          {idx + 1}
                        </td>
                        <td data-label="Branch" className="td-branch cell-wrap">
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{branch.branchName || '—'}</div>
                          {(branch.address || branch.branchAddress) && (
                            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', lineHeight: 1.35 }}>
                              {branch.address || branch.branchAddress}
                            </div>
                          )}
                        </td>
                        <td data-label="Contact" className="td-contact cell-wrap">
                          <span style={{ fontWeight: 500, color: '#1e293b' }}>{branch.contactPerson || '—'}</span>
                        </td>
                        <td data-label="Phone" className="td-phone cell-nowrap">
                          {branch.phone ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#334155' }}>
                              <span aria-hidden="true" style={{ color: '#64748b', fontSize: '12px' }}>☎</span>
                              <span>{formatPhoneDisplay(branch.phone)}</span>
                            </span>
                          ) : '—'}
                        </td>
                        <td data-label="Email" className="td-email cell-truncate" title={branch.email || ''}>
                          {branch.email ? (
                            <a
                              href={`mailto:${branch.email}`}
                              style={{
                                color: '#2563eb',
                                textDecoration: 'none',
                                fontWeight: 500,
                                display: 'inline-block',
                                maxWidth: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                verticalAlign: 'middle'
                              }}
                            >
                              {branch.email}
                            </a>
                          ) : '—'}
                        </td>
                        <td data-label="Actions" className="td-actions">
                          {canManageBranches && (
                            <div className="action-buttons-group" style={{ justifyContent: 'center' }}>
                              <IconButton
                                label="Edit branch"
                                className="edit"
                                onClick={() => handleOpenEditBranch(branch)}
                                disabled={branchBusy}
                              >
                                ✎
                              </IconButton>
                              <IconButton
                                label="Delete branch"
                                className="danger"
                                onClick={() => deleteBranch(branch.branchId || branch.id)}
                                disabled={branchBusy}
                              >
                                🗑
                              </IconButton>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
              <CustomerPager label={`${branches.length} ${branches.length === 1 ? 'branch' : 'branches'}`} />
            </div>
          </section>
        )}

        {activeSection === 'enquiries' && (
          <section className="customer-detail-panel" role="tabpanel" aria-label="Enquiry History">
            <div className="customer-detail-panel-header enquiry-history-header">
              <div>
                <h2>Enquiry History</h2>
                <p>Review enquiries connected to this customer.</p>
              </div>
              {enquiriesList.length > 0 && (
                <div className="customer-enquiry-filters" role="group" aria-label="Enquiry history filters">
                  <form
                    className="customer-enquiry-search"
                    onSubmit={(event) => event.preventDefault()}
                    role="search"
                  >
                    <span className="customer-enquiry-search-icon" aria-hidden="true">⌕</span>
                    <input
                      type="search"
                      value={enquirySearch}
                      onChange={(event) => setEnquirySearch(event.target.value)}
                      placeholder="Search enquiry ID, source, representative..."
                      aria-label="Search enquiry history"
                    />
                    {enquirySearch && (
                      <button
                        type="button"
                        className="customer-enquiry-search-clear"
                        onClick={() => setEnquirySearch('')}
                        aria-label="Clear enquiry search"
                      >
                        ×
                      </button>
                    )}
                  </form>
                  <label className="customer-filter-control">
                    <span>Source</span>
                    <select value={enquirySourceFilter} onChange={(event) => setEnquirySourceFilter(event.target.value)}>
                      <option value="ALL">All Sources</option>
                      {enquirySources.map((source) => <option key={source} value={source}>{source}</option>)}
                    </select>
                  </label>
                  <label className="customer-filter-control">
                    <span>Sort by</span>
                    <select value={enquirySort} onChange={(event) => setEnquirySort(event.target.value)}>
                      <option value="NEWEST">Newest first</option>
                      <option value="OLDEST">Oldest first</option>
                      <option value="PRIORITY">Priority</option>
                    </select>
                  </label>
                </div>
              )}
            </div>

            <div className="settings-table-shell stocks-table-shell customer-master-card">
              <div className="crm-table-scroll-wrap stocks-table-natural-wrap">
                <table className="settings-table customer-detail-table customer-enquiries-table">
                  <colgroup>
                    <col style={{ width: '28%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '32%' }} />
                    <col style={{ width: '20%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="col-priority-high" style={{ width: '28%', textAlign: 'left' }}>ENQUIRY ID</th>
                      <th className="col-priority-med" style={{ width: '20%', textAlign: 'center' }}>PRIORITY</th>
                      <th className="col-priority-high" style={{ width: '32%', textAlign: 'center' }}>STATUS</th>
                      <th className="actions-col col-priority-high" style={{ width: '20%', textAlign: 'center' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEnquiries.length === 0 ? (
                      <tr className="empty-row">
                        <td colSpan="4">
                          <div className="customer-detail-empty-state compact-empty">
                            <h3>{enquiriesList.length === 0 ? 'No enquiries yet' : 'No matching enquiries'}</h3>
                            <p>{enquiriesList.length === 0 ? 'There are no enquiries connected to this customer.' : 'Try a different search, source, or sort option.'}</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      enquiryPagination.currentItems.map((enq) => (
                        <tr key={enq.enquiryId}>
                          <td data-label="Enquiry ID" className="col-priority-high">
                            <button type="button" className="enquiry-id-link" onClick={() => openEnquiry(enq)}>
                              {enq.enquiryId}
                            </button>
                          </td>
                          <td data-label="Priority" className="col-priority-med" style={{ textAlign: 'center' }}>
                            <span className={`priority-badge p-${enq.priority ? enq.priority.toLowerCase() : 'medium'}`}>
                              {enq.priority || 'Medium'}
                            </span>
                          </td>
                          <td data-label="Status" className="col-priority-high" style={{ textAlign: 'center' }}>
                            <span className={`status-badge ${statusBadgeClass(enq.status, enq.closureType)}`}>
                              {statusLabel(enq.status, enq.closureType)}
                            </span>
                          </td>
                          <td data-label="Actions" className="actions-col col-priority-high" style={{ textAlign: 'center' }}>
                            <div className="action-buttons-group" style={{ justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="tbl-icon-btn info"
                                onClick={() => openEnquiry(enq)}
                                title="View Enquiry"
                                aria-label={`View Enquiry ${enq.enquiryId}`}
                              >
                                <span aria-hidden="true">👁</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <TableFooter
                showingStart={enquiryPagination.showingStart}
                showingEnd={enquiryPagination.showingEnd}
                total={enquiryPagination.totalRecords}
                recordLabel="enquiries"
                singularLabel="enquiry"
                currentPage={enquiryPagination.currentPage}
                totalPages={enquiryPagination.totalPages}
                onPageChange={enquiryPagination.goToPage}
              />
            </div>
          </section>
        )}

        {/* ===================== ALL DOCUMENTS (UNIFIED) PANEL ===================== */}
        {activeSection === 'allDocuments' && (
          <section className="customer-detail-panel" role="tabpanel" aria-label="Customer All Documents">
            <div className="customer-detail-panel-header enquiry-history-header">
              <div>
                <h2>Customer Documents (Generated PDFs)</h2>
                <p>Unified register of customer accepted quotations, delivered delivery challans, and confirmed sales invoices with official PDF generation.</p>
              </div>
              {unifiedDocumentsList.length > 0 && (
                <div className="customer-enquiry-filters" role="group" aria-label="Document filters">
                  <form className="customer-enquiry-search" onSubmit={(e) => e.preventDefault()} role="search">
                    <span className="customer-enquiry-search-icon" aria-hidden="true">⌕</span>
                    <input
                      type="search"
                      value={docSearch}
                      onChange={(e) => setDocSearch(e.target.value)}
                      placeholder="Search document no, items, amount..."
                      aria-label="Search all customer documents"
                    />
                    {docSearch && (
                      <button
                        type="button"
                        className="customer-enquiry-search-clear"
                        onClick={() => setDocSearch('')}
                        aria-label="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </form>
                  <label className="customer-filter-control">
                    <span>Document Type</span>
                    <select value={docTypeFilter} onChange={(e) => setDocTypeFilter(e.target.value)}>
                      <option value="ALL">All Documents ({unifiedDocumentsList.length})</option>
                      <option value="QUOTATION">Quotations ({acceptedQuotationsList.length})</option>
                      <option value="DELIVERY_CHALLAN">Delivery Challans ({challansList.length})</option>
                      <option value="INVOICE">Invoices ({invoicesList.length})</option>
                    </select>
                  </label>
                  <label className="customer-filter-control">
                    <span>Sort by</span>
                    <select value={docSort} onChange={(e) => setDocSort(e.target.value)}>
                      <option value="NEWEST">Newest first</option>
                      <option value="HIGHEST_VALUE">Highest amount</option>
                      <option value="OLDEST">Oldest first</option>
                    </select>
                  </label>
                </div>
              )}
            </div>

            <div className="settings-table-shell stocks-table-shell customer-master-card">
              <div className="crm-table-scroll-wrap stocks-table-natural-wrap">
                <table className="settings-table customer-detail-table customer-all-docs-table">
                  <colgroup>
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '26%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '14%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ width: '5%', textAlign: 'center' }}>#</th>
                      <th style={{ width: '14%', textAlign: 'center' }}>DOCUMENT TYPE</th>
                      <th style={{ width: '15%', textAlign: 'left' }}>DOCUMENT NO</th>
                      <th style={{ width: '12%', textAlign: 'left' }}>DATE</th>
                      <th style={{ width: '26%', textAlign: 'left' }}>DETAILS / SUMMARY</th>
                      <th style={{ width: '14%', textAlign: 'right' }}>AMOUNT / VALUE</th>
                      <th style={{ width: '14%', textAlign: 'center' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnifiedDocs.length === 0 ? (
                      <tr className="empty-row">
                        <td colSpan="7">
                          <div className="customer-detail-empty-state compact-empty">
                            <div className="customer-detail-empty-icon" aria-hidden="true">📂</div>
                            <h3>{unifiedDocumentsList.length === 0 ? 'No documents generated yet' : 'No matching documents'}</h3>
                            <p>{unifiedDocumentsList.length === 0 ? 'No customer accepted quotations, delivery challans, or invoices found for this customer.' : 'Try adjusting the search or filter criteria.'}</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      docPagination.currentItems.map((doc, idx) => {
                        const rowIndex = (docPagination.currentPage - 1) * docPagination.pageSize + idx + 1;
                        const typeBadgeStyle = doc.docType === 'QUOTATION'
                          ? { background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe' }
                          : doc.docType === 'DELIVERY_CHALLAN'
                            ? { background: '#ccfbf1', color: '#0f766e', border: '1px solid #99f6e4' }
                            : { background: '#f3e8ff', color: '#6b21a8', border: '1px solid #e9d5ff' };

                        return (
                          <tr key={`${doc.docType}-${doc.id || idx}`}>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>
                              {rowIndex}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                className="status-badge"
                                style={{ ...typeBadgeStyle, fontWeight: 700, fontSize: '11px', padding: '3px 9px', borderRadius: '999px' }}
                              >
                                {doc.docLabel}
                              </span>
                            </td>
                            <td>
                              <div style={{ fontWeight: 700, color: '#1e40af' }}>{doc.docNo}</div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{doc.reference}</div>
                            </td>
                            <td>
                              <span style={{ fontSize: '12.5px', color: '#334155' }}>
                                {formatDate(doc.date)}
                              </span>
                            </td>
                            <td className="cell-wrap">
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{doc.summary}</div>
                              <div style={{ fontSize: '11.5px', color: '#059669', marginTop: '2px', fontWeight: 600 }}>
                                {doc.statusText}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                              {doc.totalAmount !== null ? formatCurrency(doc.totalAmount) : '—'}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="cust-tbl-btn cust-btn-pdf"
                                onClick={doc.onPdfClick}
                                title={`View ${doc.docLabel} PDF`}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                  <line x1="16" y1="13" x2="8" y2="13" />
                                  <line x1="16" y1="17" x2="8" y2="17" />
                                </svg>
                                <span>View PDF</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <TableFooter
                showingStart={docPagination.showingStart}
                showingEnd={docPagination.showingEnd}
                total={docPagination.totalRecords}
                recordLabel="documents"
                singularLabel="document"
                currentPage={docPagination.currentPage}
                totalPages={docPagination.totalPages}
                onPageChange={docPagination.goToPage}
              />
            </div>
          </section>
        )}

        {/* ===================== QUOTATIONS PANEL ===================== */}
        {activeSection === 'quotations' && (
          <section className="customer-detail-panel" role="tabpanel" aria-label="Customer Quotations">
            <div className="customer-detail-panel-header enquiry-history-header">
              <div>
                <h2>Customer Accepted Quotations</h2>
                <p>Track all accepted quotations for this customer and view generated official PDF proposals.</p>
              </div>
              {acceptedQuotationsList.length > 0 && (
                <div className="customer-enquiry-filters" role="group" aria-label="Quotation filters">
                  <form className="customer-enquiry-search" onSubmit={(e) => e.preventDefault()} role="search">
                    <span className="customer-enquiry-search-icon" aria-hidden="true">⌕</span>
                    <input
                      type="search"
                      value={quotationSearch}
                      onChange={(e) => setQuotationSearch(e.target.value)}
                      placeholder="Search quotation ID, product, amount..."
                      aria-label="Search accepted quotations"
                    />
                    {quotationSearch && (
                      <button
                        type="button"
                        className="customer-enquiry-search-clear"
                        onClick={() => setQuotationSearch('')}
                        aria-label="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </form>
                  <label className="customer-filter-control">
                    <span>Status</span>
                    <select value={quotationFilter} onChange={(e) => setQuotationFilter(e.target.value)}>
                      <option value="ALL">All Accepted ({acceptedQuotationsList.length})</option>
                      <option value="CONVERTED">Converted to Order ({acceptedQuotationsList.filter((q) => q.status === 'CONVERTED' || Boolean(q.orderId)).length})</option>
                    </select>
                  </label>
                  <label className="customer-filter-control">
                    <span>Sort by</span>
                    <select value={quotationSort} onChange={(e) => setQuotationSort(e.target.value)}>
                      <option value="NEWEST">Newest first</option>
                      <option value="HIGHEST_VALUE">Highest value</option>
                      <option value="OLDEST">Oldest first</option>
                    </select>
                  </label>
                </div>
              )}
            </div>

            <div className="settings-table-shell stocks-table-shell customer-master-card">
              <div className="crm-table-scroll-wrap stocks-table-natural-wrap">
                <table className="settings-table customer-detail-table customer-quotations-table">
                  <colgroup>
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '30%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '22%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ width: '5%', textAlign: 'center' }}>#</th>
                      <th style={{ width: '16%', textAlign: 'left' }}>QUOTATION NO</th>
                      <th style={{ width: '12%', textAlign: 'left' }}>DATE</th>
                      <th style={{ width: '30%', textAlign: 'left' }}>ITEMS SUMMARY</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>TOTAL AMOUNT</th>
                      <th style={{ width: '22%', textAlign: 'center' }}>STATUS & ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuotations.length === 0 ? (
                      <tr className="empty-row">
                        <td colSpan="6">
                          <div className="customer-detail-empty-state compact-empty">
                            <div className="customer-detail-empty-icon" aria-hidden="true">📋</div>
                            <h3>{acceptedQuotationsList.length === 0 ? 'No accepted quotations' : 'No matching quotations'}</h3>
                            <p>{acceptedQuotationsList.length === 0 ? 'No customer-accepted quotations have been recorded for this customer.' : 'Try adjusting the search criteria.'}</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      quotationPagination.currentItems.map((q, idx) => {
                        const rowIndex = (quotationPagination.currentPage - 1) * quotationPagination.pageSize + idx + 1;
                        const items = q.items || [];
                        const primaryItem = items[0]?.productName || items[0]?.name || items[0]?.productCode || 'Equipment';
                        const summaryText = items.length > 1
                          ? `${primaryItem} (+${items.length - 1} more)`
                          : primaryItem;
                        const total = q.finalTotal || q.grandTotal || q.totalAmount || 0;

                        return (
                          <tr key={q.quotationId || idx}>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>
                              {rowIndex}
                            </td>
                            <td>
                              <div style={{ fontWeight: 700, color: '#1e40af' }}>
                                {q.quotationId}
                              </div>
                              {q.orderId && (
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                  Order: {q.orderId}
                                </div>
                              )}
                            </td>
                            <td>
                              <span style={{ fontSize: '12.5px', color: '#334155' }}>
                                {formatDate(q.quotationDate || q.createdAt)}
                              </span>
                            </td>
                            <td className="cell-wrap">
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{summaryText}</div>
                              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                                {items.reduce((s, it) => s + Number(it.quantity || 1), 0)} unit(s) across {items.length} item line(s)
                              </div>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                              {formatCurrency(total)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div className="cust-status-action-row">
                                <span className="cust-status-pill pill-success" title="Accepted by customer">
                                  ✓ Accepted
                                </span>
                                <button
                                  type="button"
                                  className="cust-tbl-btn cust-btn-pdf"
                                  onClick={() => setSelectedQuotationForPdf(q)}
                                  title="View Official Quotation PDF"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                  </svg>
                                  <span>View PDF</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <TableFooter
                showingStart={quotationPagination.showingStart}
                showingEnd={quotationPagination.showingEnd}
                total={quotationPagination.totalRecords}
                recordLabel="quotations"
                singularLabel="quotation"
                currentPage={quotationPagination.currentPage}
                totalPages={quotationPagination.totalPages}
                onPageChange={quotationPagination.goToPage}
              />
            </div>
          </section>
        )}

        {/* ===================== DELIVERY CHALLANS PANEL ===================== */}
        {activeSection === 'deliveryChallans' && (
          <section className="customer-detail-panel" role="tabpanel" aria-label="Customer Delivery Challans">
            <div className="customer-detail-panel-header enquiry-history-header">
              <div>
                <h2>Customer Delivery Challans</h2>
                <p>Track dispatched and delivered shipments for this customer and view generated DC PDFs.</p>
              </div>
              {challansList.length > 0 && (
                <div className="customer-enquiry-filters" role="group" aria-label="Delivery challan filters">
                  <form className="customer-enquiry-search" onSubmit={(e) => e.preventDefault()} role="search">
                    <span className="customer-enquiry-search-icon" aria-hidden="true">⌕</span>
                    <input
                      type="search"
                      value={dcSearch}
                      onChange={(e) => setDcSearch(e.target.value)}
                      placeholder="Search challan ID, items, ref..."
                      aria-label="Search delivery challans"
                    />
                    {dcSearch && (
                      <button
                        type="button"
                        className="customer-enquiry-search-clear"
                        onClick={() => setDcSearch('')}
                        aria-label="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </form>
                  <label className="customer-filter-control">
                    <span>Status</span>
                    <select value={dcFilter} onChange={(e) => setDcFilter(e.target.value)}>
                      <option value="ALL">All Delivery Challans ({challansList.length})</option>
                      <option value="DELIVERED">Delivered Only ({challansList.filter((d) => d.status === 'DELIVERED').length})</option>
                      <option value="DISPATCHED">Dispatched ({challansList.filter((d) => d.status === 'DISPATCHED').length})</option>
                      <option value="PARTIAL">Partial Fulfillment</option>
                      <option value="RETURNED">Returned</option>
                    </select>
                  </label>
                  <label className="customer-filter-control">
                    <span>Sort by</span>
                    <select value={dcSort} onChange={(e) => setDcSort(e.target.value)}>
                      <option value="NEWEST">Newest first</option>
                      <option value="OLDEST">Oldest first</option>
                    </select>
                  </label>
                </div>
              )}
            </div>

            <div className="settings-table-shell stocks-table-shell customer-master-card">
              <div className="crm-table-scroll-wrap stocks-table-natural-wrap">
                <table className="settings-table customer-detail-table customer-challans-table">
                  <colgroup>
                    <col style={{ width: '4%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '25%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '25%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ width: '4%', textAlign: 'center' }}>#</th>
                      <th style={{ width: '14%', textAlign: 'left' }}>CHALLAN NO</th>
                      <th style={{ width: '11%', textAlign: 'left' }}>DATE</th>
                      <th style={{ width: '11%', textAlign: 'left' }}>PURPOSE</th>
                      <th style={{ width: '25%', textAlign: 'left' }}>ITEMS DELIVERED</th>
                      <th style={{ width: '10%', textAlign: 'center' }}>FULFILLMENT</th>
                      <th style={{ width: '25%', textAlign: 'center' }}>STATUS & ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredChallans.length === 0 ? (
                      <tr className="empty-row">
                        <td colSpan="7">
                          <div className="customer-detail-empty-state compact-empty">
                            <div className="customer-detail-empty-icon" aria-hidden="true">🚚</div>
                            <h3>{challansList.length === 0 ? 'No delivery challans yet' : 'No matching challans'}</h3>
                            <p>{challansList.length === 0 ? 'No delivery challans have been created for this customer yet.' : 'Try adjusting the search or filter criteria.'}</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      dcPagination.currentItems.map((dc, idx) => {
                        const rowIndex = (dcPagination.currentPage - 1) * dcPagination.pageSize + idx + 1;
                        const items = dc.items || [];
                        const primaryItem = items[0]?.productName || items[0]?.name || items[0]?.productCode || 'Equipment';
                        const summaryText = items.length > 1
                          ? `${primaryItem} (+${items.length - 1} more)`
                          : primaryItem;
                        const totalUnits = items.reduce((s, it) => s + Number(it.quantity || 1), 0);
                        const isDelivered = dc.status === 'DELIVERED';
                        const isPartial = dc.deliveryStatus === 'PARTIAL' || Number(dc.remainingAfterThisDC || 0) > 0;

                        return (
                          <tr key={dc.challanId || idx}>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>
                              {rowIndex}
                            </td>
                            <td>
                              <div style={{ fontWeight: 700, color: '#1e40af' }}>
                                {dc.challanId}
                              </div>
                              {dc.refNo && (
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                  Ref: {dc.refNo}
                                </div>
                              )}
                            </td>
                            <td>
                              <span style={{ fontSize: '12.5px', color: '#334155' }}>
                                {formatDate(dc.deliveryDate || dc.createdAt)}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '12px', fontWeight: 500, color: '#475569' }}>
                                {dc.deliveryPurpose === 'RETURNABLE' ? 'Returnable' : 'Normal Delivery'}
                              </span>
                            </td>
                            <td className="cell-wrap">
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{summaryText}</div>
                              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                                {totalUnits} unit(s) dispatched
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`status-badge ${isPartial ? 'badge-orange' : 'badge-green'}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
                                {isPartial ? 'PARTIAL' : 'COMPLETE'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div className="cust-status-action-row">
                                {(() => {
                                  const matchingInv = confirmedInvoicesList.find((i) => (i.challanId && i.challanId === dc.challanId) || (dc.invoiceId && i.invoiceId === dc.invoiceId));
                                  const invoiceId = dc.invoiceId || matchingInv?.invoiceId || null;
                                  const isReturnable = dc.deliveryPurpose === 'RETURNABLE' || dc.documentType === 'RETURNABLE_DC' || dc.isReturnableDC;
                                  const isUnbilled = !isReturnable && !invoiceId;

                                  return (
                                    <>
                                      {isUnbilled ? (
                                        <span className="cust-status-pill pill-unbilled" title="Material dispatched without sales invoice">
                                          <span className="cust-status-dot" />
                                          Unbilled
                                        </span>
                                      ) : invoiceId ? (
                                        <span className="cust-status-pill pill-success" title={`Invoiced via ${invoiceId}`}>
                                          ✓ Invoiced
                                        </span>
                                      ) : isDelivered ? (
                                        <span className="cust-status-pill pill-success" title="Delivered successfully">
                                          ✓ Delivered
                                        </span>
                                      ) : (
                                        <span className={`status-badge ${statusBadgeClass(dc.status)}`}>
                                          {dc.status || 'DISPATCHED'}
                                        </span>
                                      )}
                                      {isUnbilled && (
                                        <button
                                          type="button"
                                          className="cust-tbl-btn cust-btn-invoice"
                                          onClick={() => navigate('/orders/invoices?challanId=' + encodeURIComponent(dc.challanId))}
                                          title="Create Sales Invoice for this Delivery Challan"
                                        >
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="5" x2="12" y2="19" />
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                          </svg>
                                          <span>Invoice</span>
                                        </button>
                                      )}
                                    </>
                                  );
                                })()}
                                <button
                                  type="button"
                                  className="cust-tbl-btn cust-btn-pdf"
                                  onClick={() => setSelectedChallanForPdf(dc)}
                                  title="View Official Delivery Challan PDF"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                  </svg>
                                  <span>PDF</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <TableFooter
                showingStart={dcPagination.showingStart}
                showingEnd={dcPagination.showingEnd}
                total={dcPagination.totalRecords}
                recordLabel="delivery challans"
                singularLabel="delivery challan"
                currentPage={dcPagination.currentPage}
                totalPages={dcPagination.totalPages}
                onPageChange={dcPagination.goToPage}
              />
            </div>
          </section>
        )}

        {/* ===================== INVOICES PANEL ===================== */}
        {activeSection === 'invoices' && (
          <section className="customer-detail-panel" role="tabpanel" aria-label="Customer Invoices">
            <div className="customer-detail-panel-header enquiry-history-header">
              <div>
                <h2>Customer Invoices</h2>
                <p>Manage generated sales invoices and view official tax invoice PDFs.</p>
              </div>
              {(invoicesList.length > 0 || customerUnbilledChallans.length > 0) && (
                <div className="customer-enquiry-filters" role="group" aria-label="Invoice filters">
                  <form className="customer-enquiry-search" onSubmit={(e) => e.preventDefault()} role="search">
                    <span className="customer-enquiry-search-icon" aria-hidden="true">⌕</span>
                    <input
                      type="search"
                      value={invoiceSearch}
                      onChange={(e) => setInvoiceSearch(e.target.value)}
                      placeholder="Search invoice ID, order, amount..."
                      aria-label="Search invoices"
                    />
                    {invoiceSearch && (
                      <button
                        type="button"
                        className="customer-enquiry-search-clear"
                        onClick={() => setInvoiceSearch('')}
                        aria-label="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </form>
                  <label className="customer-filter-control">
                    <span>Status</span>
                    <select value={invoiceFilter} onChange={(e) => setInvoiceFilter(e.target.value)}>
                      <option value="UNBILLED_DCS">⚠️ Pending Invoicing DCs ({customerUnbilledChallans.length})</option>
                      <option value="PENDING">Pending Invoices ({invoicesList.filter((i) => i.status !== 'PAID' && i.status !== 'CONFIRMED' && i.paymentStatus !== 'PAID').length})</option>
                      <option value="CONFIRMED">Paid Invoices ({invoicesList.filter((i) => ['CONFIRMED', 'PAID'].includes(i.status) || i.paymentStatus === 'PAID').length})</option>
                      <option value="ALL">All Invoices ({invoicesList.length})</option>
                    </select>
                  </label>
                  <label className="customer-filter-control">
                    <span>Sort by</span>
                    <select value={invoiceSort} onChange={(e) => setInvoiceSort(e.target.value)}>
                      <option value="NEWEST">Newest first</option>
                      <option value="HIGHEST_VALUE">Highest amount</option>
                      <option value="OLDEST">Oldest first</option>
                    </select>
                  </label>
                </div>
              )}
            </div>

            {customerUnbilledChallans.length > 0 && (
              <div className="customer-unbilled-dc-alert-box" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 16px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px' }}>⚠️</span>
                  <div>
                    <strong style={{ color: '#92400e', fontSize: '13px', display: 'block' }}>
                      Revenue Protection: {customerUnbilledChallans.length} Delivery Challan(s) Not Converted to Invoice
                    </strong>
                    <span style={{ color: '#b45309', fontSize: '12px' }}>
                      Material has been dispatched to {customer?.name || 'this customer'} without generating a Sales Invoice.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="cust-tbl-btn cust-btn-invoice"
                  onClick={() => setInvoiceFilter(invoiceFilter === 'UNBILLED_DCS' ? 'ALL' : 'UNBILLED_DCS')}
                >
                  <span>{invoiceFilter === 'UNBILLED_DCS' ? 'View All Invoices' : `Review Unbilled DCs (${customerUnbilledChallans.length}) →`}</span>
                </button>
              </div>
            )}

            {invoiceFilter === 'UNBILLED_DCS' ? (
              <div className="settings-table-shell stocks-table-shell customer-master-card">
                <div className="crm-table-scroll-wrap stocks-table-natural-wrap">
                  <table className="settings-table customer-detail-table customer-unbilled-challans-table">
                    <colgroup>
                      <col style={{ width: '5%' }} />
                      <col style={{ width: '16%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '25%' }} />
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '18%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={{ width: '5%', textAlign: 'center' }}>#</th>
                        <th style={{ width: '16%', textAlign: 'left' }}>CHALLAN NO</th>
                        <th style={{ width: '13%', textAlign: 'left' }}>DISPATCH DATE</th>
                        <th style={{ width: '25%', textAlign: 'left' }}>ITEMS DISPATCHED</th>
                        <th style={{ width: '9%', textAlign: 'center' }}>UNITS</th>
                        <th style={{ width: '14%', textAlign: 'center' }}>INVOICE STATUS</th>
                        <th style={{ width: '18%', textAlign: 'center' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomerUnbilledChallans.length === 0 ? (
                        <tr className="empty-row">
                          <td colSpan="7">
                            <div className="customer-detail-empty-state compact-empty">
                              <div className="customer-detail-empty-icon" aria-hidden="true">🎉</div>
                              <h3>All Delivery Challans are Invoiced</h3>
                              <p>There are no unconverted Delivery Challans pending invoicing for this customer.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        customerUnbilledPagination.currentItems.map((dc, idx) => {
                          const rowIndex = (customerUnbilledPagination.currentPage - 1) * customerUnbilledPagination.pageSize + idx + 1;
                          const items = dc.items || [];
                          const primaryItem = items[0]?.productName || items[0]?.name || items[0]?.productCode || 'Dispatched Items';
                          const summaryText = items.length > 1 ? `${primaryItem} (+${items.length - 1} more)` : primaryItem;
                          const totalUnits = items.reduce((s, it) => s + Number(it.quantity || 1), 0);

                          return (
                            <tr key={dc.challanId || idx}>
                              <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>
                                {rowIndex}
                              </td>
                              <td>
                                <div style={{ fontWeight: 700, color: '#1e40af' }}>{dc.challanId}</div>
                                {dc.orderId && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>Order: {dc.orderId}</div>}
                              </td>
                              <td>
                                <span style={{ fontSize: '12.5px', color: '#334155' }}>
                                  {formatDate(dc.deliveryDate || dc.createdAt)}
                                </span>
                              </td>
                              <td className="cell-wrap">
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{summaryText}</div>
                                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                                  {items.length} line item(s)
                                </div>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="dc-items-count-badge" style={{ background: '#f1f5f9', color: '#334155', fontWeight: 600, padding: '2px 8px', borderRadius: '12px' }}>
                                  {totalUnits}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="cust-status-pill pill-unbilled">
                                  <span className="cust-status-dot" />
                                  Pending Invoice
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div className="cust-status-action-row">
                                  <button
                                    type="button"
                                    className="cust-tbl-btn cust-btn-invoice"
                                    onClick={() => navigate('/orders/invoices?challanId=' + encodeURIComponent(dc.challanId))}
                                    title="Create Sales Invoice for this Delivery Challan"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="12" y1="5" x2="12" y2="19" />
                                      <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                    <span>Invoice</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="cust-tbl-btn cust-btn-pdf"
                                    onClick={() => setSelectedChallanForPdf(dc)}
                                    title="View Delivery Challan PDF"
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                      <polyline points="14 2 14 8 20 8" />
                                      <line x1="16" y1="13" x2="8" y2="13" />
                                      <line x1="16" y1="17" x2="8" y2="17" />
                                    </svg>
                                    <span>PDF</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <TableFooter
                  showingStart={customerUnbilledPagination.showingStart}
                  showingEnd={customerUnbilledPagination.showingEnd}
                  total={customerUnbilledPagination.totalRecords}
                  recordLabel="unbilled delivery challans"
                  singularLabel="unbilled delivery challan"
                  currentPage={customerUnbilledPagination.currentPage}
                  totalPages={customerUnbilledPagination.totalPages}
                  onPageChange={customerUnbilledPagination.goToPage}
                />
              </div>
            ) : (
            <div className="settings-table-shell stocks-table-shell customer-master-card">
              <div className="crm-table-scroll-wrap stocks-table-natural-wrap">
                <table className="settings-table customer-detail-table customer-invoices-table">
                  <colgroup>
                    <col style={{ width: '5%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '13%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '24%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ width: '5%', textAlign: 'center' }}>#</th>
                      <th style={{ width: '16%', textAlign: 'left' }}>INVOICE NO</th>
                      <th style={{ width: '13%', textAlign: 'left' }}>DATE</th>
                      <th style={{ width: '16%', textAlign: 'left' }}>ORDER REF</th>
                      <th style={{ width: '16%', textAlign: 'right' }}>TOTAL AMOUNT</th>
                      <th style={{ width: '24%', textAlign: 'center' }}>STATUS & ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.length === 0 ? (
                      <tr className="empty-row">
                        <td colSpan="6">
                          <div className="customer-detail-empty-state compact-empty">
                            <div className="customer-detail-empty-icon" aria-hidden="true">🧾</div>
                            <h3>{invoicesList.length === 0 ? 'No invoices yet' : 'No matching invoices'}</h3>
                            <p>{invoicesList.length === 0 ? 'No invoices have been billed for this customer yet.' : 'Try adjusting the search or filter criteria.'}</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      invoicePagination.currentItems.map((inv, idx) => {
                        const rowIndex = (invoicePagination.currentPage - 1) * invoicePagination.pageSize + idx + 1;
                        const total = inv.totalAmount || inv.grandTotal || 0;
                        const isConfirmed = ['CONFIRMED', 'PAID'].includes(inv.status);

                        return (
                          <tr key={inv.invoiceId || idx}>
                            <td style={{ textAlign: 'center', fontWeight: 600, color: '#64748b' }}>
                              {rowIndex}
                            </td>
                            <td>
                              <div style={{ fontWeight: 700, color: '#1e40af' }}>
                                {inv.invoiceId}
                              </div>
                            </td>
                            <td>
                              <span style={{ fontSize: '12.5px', color: '#334155' }}>
                                {formatDate(inv.invoiceDate || inv.createdAt)}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '12px', fontWeight: 500, color: '#475569' }}>
                                {inv.orderId || inv.refNo || '—'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                              {formatCurrency(total)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div className="cust-status-action-row">
                                {isConfirmed ? (
                                  <span className="cust-status-pill pill-success" title="Invoice confirmed / paid">
                                    ✓ Confirmed
                                  </span>
                                ) : (
                                  <span className={`status-badge ${statusBadgeClass(inv.status)}`}>
                                    {inv.status || 'ISSUED'}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="cust-tbl-btn cust-btn-pdf"
                                  onClick={() => setSelectedInvoiceForPdf(inv)}
                                  title="View Official Tax Invoice PDF"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                  </svg>
                                  <span>View PDF</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <TableFooter
                showingStart={invoicePagination.showingStart}
                showingEnd={invoicePagination.showingEnd}
                total={invoicePagination.totalRecords}
                recordLabel="invoices"
                singularLabel="invoice"
                currentPage={invoicePagination.currentPage}
                totalPages={invoicePagination.totalPages}
                onPageChange={invoicePagination.goToPage}
              />
            </div>
          )}
        </section>
      )}
    </section>

      {/* Official ASI Customer Accepted Quotation PDF Preview Modal */}
      {selectedQuotationForPdf && (
        <DocumentPreviewModal
          title="Official Quotation"
          docId={selectedQuotationForPdf.quotationId}
          docType="quotation"
          status={selectedQuotationForPdf.status}
          filename={getQuotationFilename(selectedQuotationForPdf)}
          data={selectedQuotationForPdf}
          onClose={() => setSelectedQuotationForPdf(null)}
        >
          <PrintableQuotation data={selectedQuotationForPdf} />
        </DocumentPreviewModal>
      )}

      {/* Official ASI Delivered / Dispatched DC PDF Preview Modal */}
      {selectedChallanForPdf && (
        <DocumentPreviewModal
          title={selectedChallanForPdf.documentTitle || (selectedChallanForPdf.deliveryPurpose === 'RETURNABLE' ? 'RETURNABLE DC' : 'DELIVERY CHALLAN')}
          docId={selectedChallanForPdf.challanId || selectedChallanForPdf.dcNumber || 'DC'}
          docType="dc"
          status={selectedChallanForPdf.status}
          filename={getDcFilename(selectedChallanForPdf)}
          data={selectedChallanForPdf}
          onClose={() => setSelectedChallanForPdf(null)}
        >
          <PrintableDeliveryChallan data={selectedChallanForPdf} />
        </DocumentPreviewModal>
      )}

      {/* Official ASI Customer Sales Invoice PDF Preview Modal */}
      {selectedInvoiceForPdf && (
        <DocumentPreviewModal
          title="Sales Invoice"
          docId={selectedInvoiceForPdf.invoiceId}
          docType="inv"
          status={selectedInvoiceForPdf.status}
          filename={getInvoiceFilename(selectedInvoiceForPdf)}
          data={selectedInvoiceForPdf}
          onClose={() => setSelectedInvoiceForPdf(null)}
        >
          <PrintableSalesInvoice data={selectedInvoiceForPdf} />
        </DocumentPreviewModal>
      )}
    </div>
  );
}

function CustomerPager({ label }) {
  return (
    <div className="customer-pager single-page">
      <span>Showing all {label}</span>
    </div>
  );
}
