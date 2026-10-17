export const ENQUIRY_TYPES = [
  'Product Enquiry',
  'Service Enquiry',
  'Pricing Enquiry',
  'Support Enquiry',
  'General Enquiry',
  'Site Visit Enquiry',
  'AMC — Annual Maintenance Contract',
  'Other'
];

export const shouldShowAssignedEmployee = (enquiryType) => {
  const t = String(enquiryType || '').trim().toLowerCase();
  return !(t.startsWith('product') || t.startsWith('pricing') || t.startsWith('general'));
};

export const FORCE_CLOSE_REASONS = [
  'No Response',
  'Customer Declined',
  'Duplicate Enquiry',
  'Invalid Enquiry',
  'Other'
];

export const isTerminalStatus = (status) => ['CLOSED', 'CANCELLED'].includes(status);

export const contactPersonOf = (record) => {
  if (!record) return '';
  return record.contactPerson || record.company || record.customerContactPerson || record.customerCompany || '';
};

export const statusLabel = (status, closureType) => {
  if (!status) return '—';
  if (status === 'NEW') return 'New';
  if (status === 'IN_PROGRESS') return 'In Progress';
  if (status === 'READY_FOR_QUOTATION') return 'Ready for Quotation';
  if (status === 'QUOTATION_ISSUED') return 'Quotation Issued';
  if (status === 'NOT_RESPONDING') return 'Not Responding';
  if (status === 'CASE_SOLVED' || (status === 'CLOSED' && closureType === 'CASE_CLOSED')) return 'Case Closed';
  if (status === 'CLOSED' && closureType === 'FORCE_CLOSED') return 'Force Closed';
  if (status === 'CLOSED') return 'Case Closed';
  if (status === 'FORCE_CLOSED') return 'Force Closed';
  return String(status).replaceAll('_', ' ');
};

export const statusBadgeClass = (status, closureType) => {
  if (status === 'NEW') return 'badge-purple';
  if (status === 'IN_PROGRESS') return 'badge-blue';
  if (status === 'QUOTATION_ISSUED') return 'badge-indigo';
  if (status === 'NOT_RESPONDING') return 'badge-orange';
  if (status === 'CASE_SOLVED' || (status === 'CLOSED' && closureType === 'CASE_CLOSED')) return 'badge-green';
  if (status === 'CLOSED' && closureType === 'FORCE_CLOSED') return 'badge-slate';
  if (status === 'CLOSED' || status === 'CANCELLED') return 'badge-slate';
  return 'badge-blue';
};

export const emptyBranch = () => ({
  branchName: '',
  contactPerson: '',
  phone: '',
  email: ''
});
