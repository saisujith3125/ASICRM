import React, { useEffect, useState } from 'react';
import { apiFetch, apiUrl } from '../../api';
import { formatDate } from '../../utils/dateUtils';

export default function CaseSolvedView({ user, enquiryId, onBackToList, onNavigateCustomer }) {
  const [enquiry, setEnquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch(apiUrl(`/api/enquiries/${enquiryId}`), { headers: { 'x-user-id': user?.id || '' } });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load enquiry.');
        setEnquiry(data.data);
      } catch (e) { setError(e.message || 'Unable to load closed enquiry.'); }
      finally { setLoading(false); }
    };
    if (enquiryId) load();
  }, [enquiryId, user]);

  if (loading) return <div className="crm-loading-full"><div className="crm-spinner" /><p>Loading closed enquiry...</p></div>;
  if (!enquiry) return <div className="crm-alert-box error"><span>{error || 'Enquiry not found.'}</span><button type="button" className="crm-btn-secondary" onClick={onBackToList}>Back to Enquiries</button></div>;

  const isForceClosed = enquiry.closureType === 'FORCE_CLOSED' || enquiry.outcome === 'FORCE_CLOSED';
  const title = isForceClosed ? 'Closed' : 'Case Closed';
  const description = isForceClosed
    ? 'This enquiry was closed using the Force Close action. A future requirement should be recorded as a new enquiry.'
    : 'The customer requirement was confirmed and the enquiry was successfully completed.';

  return (
    <div className="crm-details-page-container case-solved-page-wrapper">
      <div className="workflow-steps-tracker four-stage-workflow">
        <div className="step-node completed"><span className="node-num">✓</span><span className="node-label">1. Created</span></div>
        <div className="step-connector completed" />
        <div className="step-node completed"><span className="node-num">✓</span><span className="node-label">2. Details</span></div>
        <div className="step-connector completed" />
        <div className="step-node completed"><span className="node-num">✓</span><span className="node-label">3. Follow-Up &amp; Outcome</span></div>
        <div className="step-connector completed" />
        <div className="step-node completed success-node"><span className="node-num">✓</span><span className="node-label">4. {title}</span></div>
      </div>

      <div className="case-solved-success-card">
        <div className="success-card-top-row"><div className="success-icon-badge">✓</div><div className="success-text-content"><h3 className="success-title">{title}</h3><p className="success-subtitle">{description}</p></div><span className={`status-badge ${isForceClosed ? 'badge-slate' : 'badge-green'} large`}>{title.toUpperCase()}</span></div>
        <div className="case-summary-bar">
          <div className="summary-col-item"><span className="summary-item-label">Enquiry ID</span><strong className="summary-item-val enquiry-id">{enquiry.enquiryId}</strong></div>
          <div className="summary-col-item">
            <span className="summary-item-label">Customer</span>
            {enquiry.customerId ? (
              <a
                href={`/customers/${encodeURIComponent(enquiry.customerId)}`}
                className="summary-item-val customer customer-link"
                style={{ textDecoration: 'none', color: '#2563eb', fontWeight: 600 }}
                onClick={(e) => {
                  if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                    e.preventDefault();
                    onNavigateCustomer?.(enquiry.customerId, {
                      from: 'enquiry',
                      returnTo: `/enquiries/${encodeURIComponent(enquiry.enquiryId)}/solved`,
                      returnLabel: 'Back to Enquiry',
                      enquiryId: enquiry.enquiryId,
                      initialTab: 'enquiries',
                    });
                  }
                }}
              >
                {enquiry.customerName}
              </a>
            ) : (
              <strong className="summary-item-val customer">{enquiry.customerName}</strong>
            )}
            <span className="summary-subtext">{enquiry.customerCompany || 'Individual'}</span>
          </div>
          <div className="summary-col-item"><span className="summary-item-label">Closed On</span><strong className="summary-item-val date">{formatDate(enquiry.closedAt)}</strong></div>
          <div className="summary-col-item"><span className="summary-item-label">Closed By</span><strong className="summary-item-val">{enquiry.closedBy || enquiry.solvedBy || enquiry.assignedTo || 'System'}</strong></div>
        </div>
      </div>

      <div className="crm-card-box case-solved-main-card">
        <div className="case-solved-card-header"><div><span className="page-kicker">ENQUIRY COMPLETED</span><h1 className="case-solved-page-title">{title}</h1><p className="case-solved-page-subtitle">{isForceClosed ? `Reason: ${enquiry.closureReason || 'Not specified'}` : enquiry.quotationId ? `Quotation ${enquiry.quotationId} was created successfully.` : 'The enquiry was completed successfully.'}</p></div></div>

        <div className="case-solved-card-body">
          {!isForceClosed && enquiry.quotationId && <div className="quotation-summary-display"><div className="order-lead-header"><span className="field-label prominent">QUOTATION</span></div><div className="form-grid-3"><div><span className="summary-item-label">Quotation Number</span><strong className="summary-item-val enquiry-id">{enquiry.quotationId}</strong></div><div><span className="summary-item-label">Quotation Amount</span><strong className="summary-item-val">₹{Number(enquiry.quotationAmount || 0).toLocaleString('en-IN')}</strong></div><div><span className="summary-item-label">Item / Plan</span><strong className="summary-item-val">{enquiry.quotationItem || '—'}</strong></div></div><div className="quote-next-step-note">Customer acceptance can be converted to an order from the Quotations register by an Admin or Super Admin.</div></div>}

          {enquiry.relatedOrderId && <div className="order-attachment-success-card"><div><span className="summary-item-label">ORDER CREATED</span><strong className="enquiry-id-link">{enquiry.relatedOrderId}</strong></div><span className="status-badge badge-green">COMPLETED</span></div>}

          {isForceClosed && <div className="closure-display-card"><span className="summary-item-label">Closure Reason</span><strong>{enquiry.closureReason || 'Force closed'}</strong>{enquiry.closureNotes && <p>{enquiry.closureNotes}</p>}</div>}
        </div>

        <div className="case-solved-footer-row">
          <a
            href={enquiry.customerId ? `/customers/${encodeURIComponent(enquiry.customerId)}` : '/customers'}
            className="crm-btn-secondary"
            onClick={(e) => {
              if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                e.preventDefault();
                onNavigateCustomer?.(enquiry.customerId, {
                  from: 'enquiry',
                  returnTo: `/enquiries/${encodeURIComponent(enquiry.enquiryId)}/solved`,
                  returnLabel: 'Back to Enquiry',
                  enquiryId: enquiry.enquiryId,
                  initialTab: 'enquiries',
                });
              }
            }}
          >
            View Customer History
          </a>
          <button type="button" className="crm-btn-primary" onClick={onBackToList}>
            ← Enquiries List
          </button>
        </div>
      </div>
    </div>
  );
}