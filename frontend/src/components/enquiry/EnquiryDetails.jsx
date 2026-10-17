import React, { useState, useEffect } from 'react';
import { apiFetch, apiUrl } from '../../api';
import { hasPermission } from '../../utils/permissions';
import { formatDate } from '../../utils/dateUtils';

export default function EnquiryDetails({
  user,
  enquiryId,
  navigationContext,
  onProceedToFollowUp,
  onBackToList,
  onBackToPreviousStep,
  onNavigateCustomer
}) {
  const [enquiry, setEnquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const canEdit = hasPermission(user, 'Enquiries', 'Edit');
  const canFollowUp = hasPermission(user, 'Enquiries', 'Follow Up');

  // Form Fields
  const [description, setDescription] = useState('');
  const [productsInterested, setProductsInterested] = useState('');
  const [expectedBudget, setExpectedBudget] = useState('');

  const fetchEnquiry = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(apiUrl(`/api/enquiries/${enquiryId}`), {
        headers: {
          'x-user-id': user?.id || '',
              }
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        const item = data.data;
        setEnquiry(item);
        setDescription(item.description || '');
        setProductsInterested(item.productsInterested || '');
        setExpectedBudget(item.expectedBudget || '');
      } else {
        setError(data.message || 'Failed to load enquiry details.');
      }
    } catch (err) {
      console.error('Error fetching enquiry details:', err);
      setError('Unable to load enquiry details from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (enquiryId) {
      fetchEnquiry();
    }
  }, [enquiryId, user?.id]);

  const handleSave = async (proceedNext = true) => {
    if (!canEdit) {
      if (proceedNext && canFollowUp) {
        onProceedToFollowUp(enquiryId);
        return;
      }
      setError('You do not have permission to edit enquiries.');
      return;
    }

    if (!description.trim()) {
      setError('Please enter the enquiry description before proceeding.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await apiFetch(apiUrl(`/api/enquiries/${enquiryId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
              },
        body: JSON.stringify({
          description: description.trim(),
          productsInterested: productsInterested.trim(),
          expectedBudget: expectedBudget.trim()
        })
      });

      const data = await res.json();

      if (res.ok && data.success && data.data) {
        setEnquiry(data.data);
        if (proceedNext) {
          onProceedToFollowUp(enquiryId);
        } else {
          setSuccessMsg('Enquiry details saved successfully.');
        }
      } else {
        setError(data.message || 'Failed to update enquiry details.');
      }
    } catch (err) {
      console.error('Update enquiry details error:', err);
      setError('Server communication error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="crm-loading-full">
        <div className="crm-spinner" />
        <p>Loading enquiry details for {enquiryId}...</p>
      </div>
    );
  }

  if (!enquiry) {
    return (
      <div className="crm-alert-box error">
        <span>Enquiry not found.</span>
        <button onClick={onBackToList} className="crm-btn-secondary">Back to Enquiries</button>
      </div>
    );
  }

  return (
    <div className="crm-details-page-container">
      <div className="crm-card-box">
        <div className="card-header-block">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div className="badge-step-tag">STEP 2 OF 4</div>
                <span className="meta-enquiry-id" style={{ fontSize: '13px', fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '4px' }}>
                  {enquiry.enquiryId}
                </span>
                <span className={`status-badge ${enquiry.status === 'CLOSED' ? 'badge-green' : enquiry.status === 'NOT_RESPONDING' ? 'badge-orange' : 'badge-blue'}`}>
                  {enquiry.status.replace('_', ' ')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 className="card-header-title" style={{ margin: 0 }}>Enquiry Description & Requirements</h3>
                  <p className="card-header-desc" style={{ marginTop: '4px', marginBottom: 0 }}>
                    Record exactly what the customer needs.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onBackToPreviousStep ? onBackToPreviousStep(enquiry) : onBackToList()}
                  className="crm-btn-secondary compact"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '5px 12px', height: '30px', fontWeight: 500 }}
                  title="Return to previous enquiry creation step"
                >
                  ← Back to Previous Step
                </button>
              </div>
            </div>

            {error && (
              <div className="crm-alert-box error" style={{ margin: '16px 24px 0' }}>
                <span>{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="crm-alert-box success" style={{ margin: '16px 24px 0' }}>
                <span>{successMsg}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSave(canFollowUp);
              }}
              className="crm-interactive-form"
            >
              <div className="saved-enquiry-summary" aria-label="Saved enquiry classification">
                <div><span>Source</span><strong>{enquiry.source}</strong></div>
                <div><span>Type</span><strong>{enquiry.type}</strong></div>
                <div><span>Priority</span><strong>{enquiry.priority}</strong></div>
                <div><span>Assigned To</span><strong>{enquiry.assignedTo}</strong></div>
                <div className="saved-summary-wide"><span>Initial Date</span><strong>{formatDate(enquiry.initialEnquiryDate || enquiry.createdAt)}</strong></div>
              </div>
              {/* Main Description Textarea */}
              <div className="form-field-group full-width">
                <label className="field-label prominent">
                  Enquiry Description <span className="req-star">* (Required)</span>
                </label>
                <textarea
                  className="crm-textarea-input large"
                  rows={5}
                  placeholder="Describe the customer's question, requirement, problem, product interest, expected outcome, or requested information."
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (error) setError('');
                  }}
                  disabled={!canEdit}
                  required
                />
                <div className="textarea-help-row">
                  <span className="help-text">Record full customer requirement specifications and scope.</span>
                  <span className="char-count">{description.length} characters</span>
                </div>
              </div>

              {/* Product and Budget Requirements Grid */}
              <div className="form-grid-2" style={{ marginTop: '16px' }}>
                <div className="form-field-group">
                  <label className="field-label">Products / Services Interested In</label>
                  <input
                    type="text"
                    className="crm-text-input"
                    placeholder="e.g. ASICRM Enterprise Suite, Multi-agent Add-on"
                    value={productsInterested}
                    onChange={(e) => setProductsInterested(e.target.value)}
                    disabled={!canEdit}
                  />
                </div>

                <div className="form-field-group">
                  <label className="field-label">Expected Budget / Estimated Deal Size</label>
                  <input
                    type="text"
                    className="crm-text-input"
                    placeholder="e.g. ₹75,000 / year or ₹1.5 Lakhs"
                    value={expectedBudget}
                    onChange={(e) => setExpectedBudget(e.target.value)}
                    disabled={!canEdit}
                  />
                </div>

              </div>

              {/* PRIMARY ACTION CTA */}
              <div className="form-actions-footer with-split" style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={onBackToList}
                  className="crm-btn-secondary"
                  disabled={saving}
                >
                  {navigationContext?.from === 'customer-profile'
                    ? (navigationContext.returnLabel || '← Back to Customer Profile')
                    : '← Enquiries List'}
                </button>

                <div className="right-action-buttons">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleSave(false)}
                      className="crm-btn-secondary"
                      disabled={saving}
                    >
                      Save Draft
                    </button>
                  )}

                  {canEdit ? (
                    <button
                      type="submit"
                      className="crm-btn-primary large-action"
                      disabled={saving || !description.trim()}
                    >
                      {saving ? (
                        <span>Saving...</span>
                      ) : canFollowUp ? (
                        <span>Save &amp; Continue to Follow Up →</span>
                      ) : (
                        <span>Save Changes</span>
                      )}
                    </button>
                  ) : canFollowUp ? (
                    <button
                      type="button"
                      onClick={() => onProceedToFollowUp(enquiryId)}
                      className="crm-btn-primary large-action"
                    >
                      Proceed to Follow Up →
                    </button>
                  ) : null}
                </div>
              </div>
            </form>
          </div>
    </div>
  );
}