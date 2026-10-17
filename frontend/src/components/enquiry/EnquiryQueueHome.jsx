import React, { useEffect, useState } from 'react';
import { apiFetch, apiUrl } from '../../api';
import { hasPermission } from '../../utils/permissions';

export default function EnquiryQueueHome({ user, onPrepareQuotation, onBack, onNavigateCustomer }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadQueue = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch(
        apiUrl('/api/enquiries?status=READY_FOR_QUOTATION&sort=priority'),
        {
          headers: {
            'x-user-id': user?.id || '',
                  }
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to load the quotation queue.');
      }
      setQueue(data.data || []);
    } catch (err) {
      console.error('Quotation queue load error:', err);
      setError(err.message || 'Unable to load the quotation queue.');
      setQueue([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [user?.id, user?.role]);

  const canPrepareQuotation = hasPermission(user, 'Quotations', 'Create');

  return (
    <div className="crm-enquiry-page-container quotation-queue-home">
      <div className="page-header-row">
        <div>
          <span className="page-kicker">ENQUIRY QUEUE</span>
          <h1 className="page-title">Ready for Quotation</h1>
          <p className="page-subtitle">
            Confirmed enquiries waiting for commercial quotation. Open the existing enquiry and continue the same workflow — do not create a duplicate enquiry.
          </p>
        </div>
        {onBack && (
          <button type="button" className="crm-btn-secondary" onClick={onBack}>
            Back to Enquiries
          </button>
        )}
      </div>

      <div className="queue-summary-strip">
        <div>
          <span className="kpi-label">Waiting for quotation</span>
          <strong className="queue-summary-value">{queue.length}</strong>
        </div>
        <div className="queue-summary-copy">
          {queue.length === 0
            ? 'There are no confirmed enquiries waiting for a quotation right now.'
            : 'These enquiries have completed the employee follow-up stage and are ready for commercial action.'}
        </div>
        <button type="button" className="crm-btn-secondary compact" onClick={loadQueue} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="crm-alert-box error"><span>{error}</span></div>}

      <section className="crm-card-box">
        <div className="card-header-block compact-card-header">
          <div>
            <h2 className="card-header-title">Quotation Work Queue</h2>
            <p className="card-header-desc">
              Select an enquiry to review the customer's requirement and prepare the quotation linked to that enquiry.
            </p>
          </div>
        </div>

        <div className="crm-table-container crm-data-table-wrap">
          {loading ? (
            <div className="table-loading-state">
              <div className="crm-spinner" />
              <p>Loading quotation queue…</p>
            </div>
          ) : (
            <div className="crm-table-scroll-wrap">
              <table className="crm-data-table">
              <thead>
                <tr>
                  <th className="col-priority-high">Enquiry</th>
                  <th className="col-priority-high">Customer</th>
                  <th className="col-priority-med">Requirement</th>
                  <th className="col-priority-med">Priority</th>
                  <th className="col-priority-low">Assigned To</th>
                  <th className="actions-col col-priority-high">Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.length === 0 ? (
                  <tr className="empty-row">
                    <td colSpan="6">
                      <div className="table-empty-state">
                        <div className="empty-state-icon">
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                            <path d="M6 3h12v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
                            <path d="M8 8h8M8 12h5" />
                            <path d="m15 17 2 2 4-4" />
                          </svg>
                        </div>
                        <h3>Queue is clear</h3>
                        <p>Confirmed enquiries will appear here automatically after their requirement is marked as confirmed.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  queue.map((enquiry) => (
                      <tr key={enquiry.enquiryId}>
                        <td data-label="Enquiry" className="col-priority-high">
                          <button type="button" className="enquiry-id-link" onClick={() => canPrepareQuotation && onPrepareQuotation(enquiry.enquiryId)}>
                            {enquiry.enquiryId}
                          </button>
                        </td>
                        <td data-label="Customer" className="col-priority-high cell-wrap">
                          {enquiry.customerId ? (
                            <a
                              href={`/customers/${encodeURIComponent(enquiry.customerId)}`}
                              className="customer-name-link"
                              onClick={(e) => {
                                if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                                  e.preventDefault();
                                  onNavigateCustomer?.(enquiry.customerId);
                                }
                              }}
                            >
                              {enquiry.customerName || enquiry.customerId}
                            </a>
                          ) : (
                            enquiry.customerName || '—'
                          )}
                        </td>
                        <td data-label="Requirement" className="col-priority-med cell-wrap">{enquiry.description || enquiry.productsInterested || 'Confirmed requirement'}</td>
                        <td data-label="Priority" className="col-priority-med">
                          <span className={`priority-badge p-${(enquiry.priority || 'Medium').toLowerCase()}`}>
                            {enquiry.priority || 'Medium'}
                          </span>
                        </td>
                        <td data-label="Assigned To" className="col-priority-low">{enquiry.assignedTo || 'Unassigned'}</td>
                        <td data-label="Action" className="actions-col col-priority-high">
                          {canPrepareQuotation ? (
                            <button
                              type="button"
                              className="tbl-icon-btn quotation-convert-btn"
                              onClick={() => onPrepareQuotation(enquiry.enquiryId)}
                              title="Prepare Quotation"
                              aria-label={`Prepare Quotation for ${enquiry.enquiryId}`}
                            >
                              <span aria-hidden="true">✎</span>
                            </button>
                          ) : (
                            <span className="status-badge badge-purple">View only</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          {!loading && (
            <div className="crm-table-footer-bar">
              <span>Showing {queue.length} {queue.length === 1 ? 'enquiry in queue' : 'enquiries in queue'}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
