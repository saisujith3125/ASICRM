import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch, apiUrl } from '../../api';
import { formatDate } from '../../utils/dateUtils';

const NEXT_ACTIONS = [
  { id: 'NO_RESPONSE', label: 'No Response', help: 'Customer is unavailable or not responding.', tone: 'orange' },
  { id: 'IN_DISCUSSION', label: 'In Discussion', help: 'Customer is responding. Continue the enquiry.', tone: 'green' },
  { id: 'LEAD_CONFIRMATION', label: 'Lead Confirmed', help: 'Requirement confirmed. Move directly to quotation.', tone: 'blue' },
  { id: 'FORCE_CLOSED', label: 'Force Closed', help: 'End this enquiry permanently.', tone: 'slate' }
];

const FORCE_CLOSE_REASONS = ['No Response', 'Customer Declined', 'Duplicate Enquiry', 'Invalid Enquiry', 'Other'];
const CONTACT_TYPES = ['Phone Call', 'Message', 'Email', 'Meeting'];
const DEFAULT_EMPLOYEES = ['John Doe', 'Rajesh Kumar', 'Sarah Jenkins', 'Sneha Rao'];
const today = () => new Date().toISOString().slice(0, 10);

export default function FollowUpView({ enquiryId, onNavigateToQuotation, onNavigateToClosed, onBackToDetails, onBackToList, onNavigateCustomer }) {
  const [enquiry, setEnquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [contactType, setContactType] = useState('Phone Call');
  const [contactDate, setContactDate] = useState(today());
  const [employee, setEmployee] = useState('John Doe');
  const [employeesList, setEmployeesList] = useState([]);

  useEffect(() => {
    let active = true;
    const fetchEmployees = async () => {
      try {
        const res = await apiFetch(apiUrl('/api/settings/employees'));
        const json = await res.json();
        if (active && json.success && Array.isArray(json.data) && json.data.length > 0) {
          const names = json.data.map((u) => u.name).filter(Boolean);
          if (names.length > 0) {
            setEmployeesList(names);
          }
        }
      } catch (e) {
        console.warn('Failed to load active employees in FollowUpView:', e);
      }
    };
    fetchEmployees();
    window.addEventListener('crm-user-updated', fetchEmployees);
    return () => {
      active = false;
      window.removeEventListener('crm-user-updated', fetchEmployees);
    };
  }, []);

  const availableEmployees = useMemo(() => {
    if (employeesList.length > 0) return employeesList;
    return DEFAULT_EMPLOYEES;
  }, [employeesList]);
  const [nextAction, setNextAction] = useState('');
  const [noResponseNotes, setNoResponseNotes] = useState('');
  const [noResponseDate, setNoResponseDate] = useState('');
  const [savingNoResponse, setSavingNoResponse] = useState(false);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [discussionNotes, setDiscussionNotes] = useState('');
  const [discussionNextAction, setDiscussionNextAction] = useState('');
  const [discussionNextDate, setDiscussionNextDate] = useState('');
  const [savingDiscussion, setSavingDiscussion] = useState(false);
  const [closureReason, setClosureReason] = useState('No Response');
  const [closureNotes, setClosureNotes] = useState('');
  const [savingClosure, setSavingClosure] = useState(false);
  const [changingAction, setChangingAction] = useState(false);

  const clearErrors = () => {
    setFieldErrors({});
    setServerError('');
  };

  const showToast = (message) => {
    setSuccessToast(message);
    window.setTimeout(() => setSuccessToast((current) => current === message ? '' : current), 3000);
  };

  const fetchEnquiry = async () => {
    setLoading(true);
    setServerError('');
    try {
      const response = await apiFetch(apiUrl(`/api/enquiries/${enquiryId}`));
      const data = await response.json();
      if (!response.ok || !data.success || !data.data) {
        setServerError(data.message || 'Failed to load enquiry.');
        return;
      }
      const record = data.data;
      setEnquiry(record);
      setEmployee(record.assignedTo || 'John Doe');
      if (record.outcome === 'LEAD_CONFIRMATION') setNextAction('LEAD_CONFIRMATION');
      else if (record.outcome === 'IN_DISCUSSION') setNextAction('IN_DISCUSSION');
      else if (record.outcome === 'NO_RESPONSE') setNextAction('NO_RESPONSE');
      else if (record.outcome === 'FORCE_CLOSED') setNextAction('FORCE_CLOSED');
    } catch (error) {
      console.error('Fetch enquiry error:', error);
      setServerError('Unable to connect to the backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (enquiryId) fetchEnquiry();
  }, [enquiryId]);

  const isTerminal = Boolean(enquiry && ['CLOSED', 'CANCELLED'].includes(enquiry.status));
  const followUpsList = useMemo(() => [...(enquiry?.followUps || [])].reverse(), [enquiry]);
  const selectedAction = NEXT_ACTIONS.find((item) => item.id === nextAction);

  const updateOutcome = async (workflowOutcome, extra = {}) => {
    try {
      const response = await apiFetch(apiUrl(`/api/enquiries/${enquiryId}/status`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowOutcome,
          status: workflowOutcome === 'NO_RESPONSE'
            ? 'NOT_RESPONDING'
            : workflowOutcome === 'IN_DISCUSSION'
              ? 'IN_PROGRESS'
              : workflowOutcome === 'LEAD_CONFIRMATION'
                ? 'READY_FOR_QUOTATION'
                : workflowOutcome === 'FORCE_CLOSED'
                  ? 'CLOSED'
                  : undefined,
          closedBy: employee || enquiry?.assignedTo || 'John Doe',
          ...extra
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.data) {
        setServerError(data.message || 'Failed to update enquiry.');
        return null;
      }
      setEnquiry(data.data);
      return data.data;
    } catch (error) {
      console.error('Outcome update error:', error);
      setServerError('Network error while updating the enquiry.');
      return null;
    }
  };

  const handleNextActionChange = async (event) => {
    const value = event.target.value;
    if (!value || isTerminal) return;
    clearErrors();
    setChangingAction(true);
    setNextAction(value);
    setDiscussionOpen(false);

    try {
      if (value === 'NO_RESPONSE') {
        const updated = await updateOutcome('NO_RESPONSE', {
          reason: 'No Response',
          remarks: 'Marked as No Response'
        });
        if (updated) {
          showToast('Enquiry marked as Not Responding.');
        }
      } else if (value === 'IN_DISCUSSION') {
        const updated = await updateOutcome('IN_DISCUSSION', {
          currentStage: 'In Discussion',
          nextAction: 'Continue follow-up'
        });
        if (updated) {
          showToast('Enquiry updated to In Discussion.');
        }
      } else if (value === 'LEAD_CONFIRMATION') {
        const updated = await updateOutcome('LEAD_CONFIRMATION', {
          remarks: 'Customer confirmed the requirement.'
        });
        if (updated) {
          showToast('Lead confirmed. The enquiry is now in the quotation queue.');
        }
      } else if (value === 'FORCE_CLOSED') {
        setClosureReason('No Response');
      }
    } finally {
      setChangingAction(false);
    }
  };

  const handleNoResponse = async () => {
    if (!noResponseNotes.trim()) {
      setFieldErrors({ noResponseNotes: 'Notes are required for a no-response attempt.' });
      return;
    }
    setSavingNoResponse(true);
    clearErrors();
    try {
      const updated = await updateOutcome('NO_RESPONSE', {
        reason: 'No Response',
        remarks: noResponseNotes.trim(),
        lastAttemptDate: today(),
        nextFollowUpDate: noResponseDate || ''
      });
      if (updated) showToast(noResponseDate ? 'No response saved. Re-attempt is scheduled.' : 'No response saved.');
    } finally {
      setSavingNoResponse(false);
    }
  };

  const handleSaveDiscussion = async () => {
    const errors = {};
    if (!discussionNotes.trim()) errors.discussionNotes = 'Discussion notes are required.';
    if (!discussionNextAction.trim()) errors.discussionNextAction = 'Next action is required.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setSavingDiscussion(true);
    clearErrors();
    try {
      const response = await apiFetch(apiUrl(`/api/enquiries/${enquiryId}/follow-ups`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactType,
          contactDate,
          employee,
          notes: discussionNotes.trim(),
          outcome: 'In Discussion',
          nextAction: discussionNextAction.trim(),
          nextFollowUpDate: discussionNextDate,
          workflowOutcome: 'IN_DISCUSSION'
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.data) {
        setServerError(data.message || 'Failed to save follow-up.');
        return;
      }
      setEnquiry(data.data);
      setDiscussionOpen(false);
      setDiscussionNotes('');
      setDiscussionNextAction('');
      showToast('Follow-up saved. The enquiry remains in discussion.');
    } catch (error) {
      console.error('Save discussion error:', error);
      setServerError('Network error while saving the follow-up.');
    } finally {
      setSavingDiscussion(false);
    }
  };

  const handleForceClose = async () => {
    if (!closureReason) {
      setFieldErrors({ closureReason: 'Closure reason is required.' });
      return;
    }
    setSavingClosure(true);
    clearErrors();
    try {
      const updated = await updateOutcome('FORCE_CLOSED', {
        closureReason,
        closureNotes: closureNotes.trim()
      });
      if (updated) {
        showToast('Enquiry closed permanently.');
        window.setTimeout(() => onNavigateToClosed?.(enquiryId), 250);
      }
    } finally {
      setSavingClosure(false);
    }
  };

  if (loading) return <div className="crm-loading-full"><div className="crm-spinner" /><p>Loading follow-up workspace...</p></div>;
  if (!enquiry) return <div className="crm-alert-box error"><span>{serverError || 'Enquiry not found.'}</span><button onClick={onBackToList} className="crm-btn-secondary">Back to Enquiries</button></div>;

  const statusClass = enquiry.status === 'NOT_RESPONDING'
    ? 'badge-orange'
    : ['CLOSED'].includes(enquiry.status)
      ? 'badge-green'
      : 'badge-blue';

  return (
    <div className="crm-followup-page-container">
      {successToast && <div className="toast-notification-banner success"><span>✓</span><span>{successToast}</span></div>}
      {serverError && <div className="crm-alert-box error"><span>{serverError}</span><button type="button" onClick={() => setServerError('')} className="close-toast-btn">✕</button></div>}

      <div className="followup-workflow-layout">
        <main className="followup-main-col">
          {!isTerminal && (
            <div className="crm-card-box compact-followup-card" id="followup-form">
              <div className="card-header-block compact-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div className="badge-step-tag" style={{ margin: 0 }}>STEP 3 OF 4</div>
                  <span className="meta-enquiry-id" style={{ fontWeight: 700, fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', color: '#0f172a' }}>{enquiry.enquiryId}</span>
                  <span className={`status-badge ${statusClass}`} style={{ fontSize: '11px', padding: '2px 8px' }}>{String(enquiry.status || '').replaceAll('_', ' ')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h2 className="card-header-title" style={{ margin: 0 }}>Log Follow-Up</h2>
                    <p className="card-header-desc" style={{ marginTop: '4px', marginBottom: 0 }}>Record the latest communication and choose what happens next.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onBackToDetails ? onBackToDetails() : onBackToList()}
                    className="crm-btn-secondary compact"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '5px 12px', height: '30px', fontWeight: 500 }}
                  >
                    ← Back to Previous Step
                  </button>
                </div>
              </div>

              <div className="crm-interactive-form">
                <div className="form-grid-3">
                  <SelectField label="Contact Type" value={contactType} onChange={setContactType} options={CONTACT_TYPES} required />
                  <TextField label="Interaction Date" type="date" value={contactDate} onChange={setContactDate} required />
                  <SelectField label="Representative" value={employee} onChange={setEmployee} options={availableEmployees} required />
                </div>

                <section className="next-action-inline-workflow final-next-action-workflow" aria-label="Next action">
                  <div className="next-action-inline-header">
                    <span className="next-action-badge">NEXT ACTION</span>
                    <h3>What happens next?</h3>
                    <p>Select one option. The required action appears directly below it.</p>
                  </div>

                  <div className="next-action-selector-field">
                    <label className="field-label" htmlFor="next-action-select">Next Action <span className="req-star">*</span></label>
                    <select
                      id="next-action-select"
                      className="crm-select-input next-action-native-select"
                      value={nextAction}
                      onChange={handleNextActionChange}
                      disabled={changingAction}
                    >
                      <option value="">Select next action</option>
                      {NEXT_ACTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                  </div>

                  {selectedAction && nextAction !== 'LEAD_CONFIRMATION' && (
                    <div className={`next-action-selected-summary tone-${selectedAction.tone}`}>
                      <span className="next-action-selected-icon">{selectedAction.id === 'NO_RESPONSE' ? '!' : selectedAction.id === 'IN_DISCUSSION' ? '✓' : '×'}</span>
                      <div><strong>{selectedAction.label}</strong><span>{selectedAction.help}</span></div>
                    </div>
                  )}

                  {nextAction === 'NO_RESPONSE' && (
                    <div className="progressive-panel warning-panel">
                      <div className="progressive-panel-header"><span className="panel-kicker">NO RESPONSE</span><h3>Record the failed contact</h3><p>Add a short note so the next employee knows what happened.</p></div>
                      <TextAreaField label="Discussion / Follow-Up Notes" value={noResponseNotes} onChange={setNoResponseNotes} placeholder="Example: Called twice; customer did not answer." required error={fieldErrors.noResponseNotes} rows={3} />
                      <div className="form-grid-2 compact-progressive-grid">
                        <TextField label="Next Follow-Up Date" type="date" value={noResponseDate} onChange={setNoResponseDate} />
                        <div className="progressive-side-note"><span>Next step</span><strong>{noResponseDate ? 'Re-attempt contact' : 'Re-attempt or close later'}</strong></div>
                      </div>
                      <div className="progressive-actions"><button type="button" className="crm-btn-primary compact" onClick={handleNoResponse} disabled={savingNoResponse}>{savingNoResponse ? 'Saving...' : 'Save No Response'}</button></div>
                    </div>
                  )}

                  {nextAction === 'IN_DISCUSSION' && !discussionOpen && (
                    <div className="progressive-panel success-panel">
                      <div className="progressive-panel-header"><span className="panel-kicker">IN DISCUSSION</span><h3>Continue the conversation</h3><p>Open the interaction log only when you are ready to record the next discussion.</p></div>
                      <div className="progressive-actions"><button type="button" className="crm-btn-success compact" onClick={() => { clearErrors(); setDiscussionOpen(true); }}>Log Follow-Up</button></div>
                    </div>
                  )}

                  {nextAction === 'IN_DISCUSSION' && discussionOpen && (
                    <div className="progressive-panel discussion-log-panel">
                      <div className="progressive-panel-header"><span className="panel-kicker">IN DISCUSSION</span><h3>Log Follow-Up Interaction</h3><p>Capture what was discussed and define the next follow-up.</p></div>
                      <div className="form-grid-2"><SelectField label="Contact Type" value={contactType} onChange={setContactType} options={CONTACT_TYPES} required /><TextField label="Interaction Date" type="date" value={contactDate} onChange={setContactDate} required /></div>
                      <div className="form-grid-2"><SelectField label="Representative" value={employee} onChange={setEmployee} options={availableEmployees} required /><TextField label="Next Follow-Up Date" type="date" value={discussionNextDate} onChange={setDiscussionNextDate} /></div>
                      <TextAreaField label="Discussion Notes" value={discussionNotes} onChange={setDiscussionNotes} placeholder="What did the customer say, what was discussed, and what was agreed?" required error={fieldErrors.discussionNotes} rows={4} />
                      <TextField label="Next Action" value={discussionNextAction} onChange={setDiscussionNextAction} required error={fieldErrors.discussionNextAction} placeholder="e.g. Send quotation and call customer" />
                      <div className="progressive-actions"><button type="button" className="crm-btn-secondary compact" onClick={() => setDiscussionOpen(false)} disabled={savingDiscussion}>Back</button><button type="button" className="crm-btn-primary compact" onClick={handleSaveDiscussion} disabled={savingDiscussion}>{savingDiscussion ? 'Saving...' : 'Save Follow-Up'}</button></div>
                    </div>
                  )}

                  {nextAction === 'LEAD_CONFIRMATION' && (
                    <div className="progressive-panel lead-confirmed-panel">
                      <div className="progressive-panel-header"><span className="panel-kicker">LEAD CONFIRMED</span><h3>Requirement confirmed</h3><p>The requirement is confirmed. The enquiry is now in the quotation queue for a user with quotation permissions.</p></div>
                      <div className="lead-confirmed-next-box"><span className="confirmed-check">✓</span><div><strong>Waiting for Quotation</strong><span>The enquiry remains linked to this customer while commercial details are prepared.</span></div></div>
                      <div className="progressive-actions" style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" className="crm-btn-secondary compact" onClick={onBackToList}>Back to Enquiries</button>
                        {onNavigateToQuotation && (
                          <button
                            type="button"
                            className="crm-btn-primary compact"
                            onClick={() => onNavigateToQuotation(enquiry.enquiryId)}
                          >
                            Prepare Quotation →
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {nextAction === 'FORCE_CLOSED' && (
                    <div className="progressive-panel danger-panel">
                      <div className="progressive-panel-header"><span className="panel-kicker">FORCE CLOSE</span><h3>Close this enquiry permanently</h3><p>A future request from this customer must be created as a new enquiry.</p></div>
                      <SelectField label="Closure Reason" value={closureReason} onChange={setClosureReason} options={FORCE_CLOSE_REASONS} required error={fieldErrors.closureReason} />
                      <TextAreaField label="Closure Notes" value={closureNotes} onChange={setClosureNotes} placeholder="Optional final notes..." rows={3} />
                      <div className="progressive-actions"><button type="button" className="crm-btn-warning compact" disabled={savingClosure} onClick={handleForceClose}>{savingClosure ? 'Closing...' : 'Force Close Enquiry'}</button></div>
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {followUpsList.length > 0 && (
            <div className="crm-card-box interaction-history-compact">
              <div className="card-header-block compact-card-header"><h3 className="card-header-title">Recent Interaction History</h3><p className="card-header-desc">Previous communications for this enquiry.</p></div>
              <div className="followup-timeline compact-timeline">
                {followUpsList.slice(0, 8).map((item) => (
                  <div className="timeline-card" key={item.id}>
                    <div className="timeline-card-header"><div className="timeline-type-row"><span className="contact-type-pill">{item.contactType}</span><span className="contact-date-text">{formatDate(item.contactDate)}</span></div><span className="timeline-employee-text">{item.employee}</span></div>
                    <p>{item.notes}</p>
                    {item.nextAction && <div className="timeline-next-action"><span>Next</span><strong>{item.nextAction}</strong></div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        <aside className="followup-side-col">
          <div className="customer-context-card sticky-context-card polished-customer-summary">
            <div className="customer-summary-card-topline"><div className="customer-context-header"><span className="customer-summary-kicker">CUSTOMER PROFILE</span></div><span className="customer-summary-record-chip">Record</span></div>
            <div className="customer-summary-profile">
              <div className="customer-summary-avatar">{(enquiry.customerName || 'C').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</div>
              <div className="customer-summary-identity-copy">
                {enquiry.customerId ? (
                  <a
                    href={`/customers/${encodeURIComponent(enquiry.customerId)}`}
                    onClick={(e) => {
                      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                        e.preventDefault();
                        onNavigateCustomer?.(enquiry.customerId, {
                          from: 'enquiry',
                          returnTo: `/enquiries/${encodeURIComponent(enquiry.enquiryId)}/followup`,
                          returnLabel: 'Back to Enquiry',
                          enquiryId: enquiry.enquiryId,
                          initialTab: 'enquiries'
                        });
                      }
                    }}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <strong>{enquiry.customerName || 'Customer'}</strong>
                  </a>
                ) : (
                  <strong>{enquiry.customerName || 'Customer'}</strong>
                )}
                <span>{enquiry.customerCompany || 'Individual customer'}</span>
                <span className="customer-summary-id">{enquiry.customerId || 'Not assigned'}</span>
              </div>
            </div>
            <div className="customer-summary-divider" />
            <div className="customer-summary-details">
              <SummaryRow icon="☎" label="Phone" value={enquiry.customerMobile ? `+91 ${enquiry.customerMobile}` : 'Not available'} />
              <SummaryRow icon="@" label="Email" value={enquiry.customerEmail || 'Not available'} />
              <SummaryRow icon="↗" label="Assigned To" value={enquiry.assignedTo || 'Unassigned'} />
              <SummaryRow icon="#" label="Customer ID" value={enquiry.customerId || '—'} badge />
            </div>
            <div className="customer-summary-divider" />
            <a
              href={enquiry.customerId ? `/customers/${encodeURIComponent(enquiry.customerId)}` : '/customers'}
              onClick={(e) => {
                if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
                  e.preventDefault();
                  onNavigateCustomer?.(enquiry.customerId, {
                    from: 'enquiry',
                    returnTo: `/enquiries/${encodeURIComponent(enquiry.enquiryId)}/followup`,
                    returnLabel: 'Back to Enquiry',
                    enquiryId: enquiry.enquiryId,
                    initialTab: 'enquiries'
                  });
                }
              }}
              className="view-customer-history-btn"
              style={{ textDecoration: 'none' }}
            >
              <span className="view-history-label">View Customer History</span>
              <span className="view-history-arrow">→</span>
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SummaryRow({ icon, label, value, badge = false }) {
  return <div className="customer-summary-detail-row"><span className="customer-summary-detail-icon">{icon}</span><div><span>{label}</span>{badge ? <strong className="customer-id-inline-badge">{value}</strong> : <strong>{value}</strong>}</div></div>;
}

function TextField({ label, value, onChange, type = 'text', required = false, error, placeholder }) {
  return <div className="form-field-group"><label className="field-label" htmlFor={label}>{label} {required && <span className="req-star">*</span>}</label><input id={label} type={type} className={`crm-text-input ${error ? 'has-error' : ''}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} /></div>;
}

function SelectField({ label, value, onChange, options, required = false, error }) {
  return <div className="form-field-group"><label className="field-label" htmlFor={label}>{label} {required && <span className="req-star">*</span>}</label><select id={label} className={`crm-select-input ${error ? 'has-error' : ''}`} value={value} onChange={(e) => onChange(e.target.value)} required={required}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>{error && <span className="inline-field-error">{error}</span>}</div>;
}

function TextAreaField({ label, value, onChange, placeholder, required = false, error, rows = 3 }) {
  return <div className="form-field-group full-width progressive-field"><label className="field-label" htmlFor={label}>{label} {required && <span className="req-star">*</span>}</label><textarea id={label} className={`crm-textarea-input ${error ? 'has-error' : ''}`} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} />{error && <span className="inline-field-error">{error}</span>}</div>;
}