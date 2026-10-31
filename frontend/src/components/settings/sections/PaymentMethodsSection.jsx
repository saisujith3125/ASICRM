import React, { useState, useMemo } from 'react';
import { filterRecordsBySearch } from '../../../utils/searchHelper';

const emptyMethod = {
  name: '',
  code: '',
  type: 'Bank',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  branch: '',
  details: '',
  subMethods: 'RTGS, NEFT, IMPS, Cheque',
  maxLimit: '',
  isDefault: false,
  status: 'Active'
};

const PAYMENT_TYPES = ['Bank', 'Digital', 'Offline', 'Cash', 'POS'];

export default function PaymentMethodsSection({ data, onChange, onSave, isSaving }) {
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(emptyMethod);

  const methods = Array.isArray(data?.paymentMethods) ? data.paymentMethods : [];

  const filtered = useMemo(() => {
    return filterRecordsBySearch(methods, search, [
      (m) => m.name,
      (m) => m.code,
      (m) => m.bankName,
      (m) => m.type,
      (m) => m.accountNumber,
      (m) => m.ifscCode,
      (m) => m.subMethods,
      (m) => m.details,
      (m) => m.status
    ]);
  }, [methods, search]);

  const handleOpenCreate = () => {
    const nextNum = methods.length + 1;
    const defaultCode = `PM-${String(nextNum).padStart(3, '0')}`;
    setDraft({ ...emptyMethod, code: defaultCode });
    setSelectedId(null);
    setModalMode('create');
  };

  const handleOpenEdit = (m) => {
    setDraft({
      ...emptyMethod,
      ...m,
      subMethods: m.subMethods || (m.type === 'Bank' ? 'RTGS, NEFT, IMPS, Cheque' : (m.type === 'Digital' ? 'UPI / QR Code' : 'Voucher')),
      maxLimit: m.maxLimit != null ? String(m.maxLimit) : ''
    });
    setSelectedId(m.id);
    setModalMode('edit');
  };

  const handleSaveModal = (e) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.code.trim()) return;

    let computedDetails = draft.details.trim();
    if (!computedDetails) {
      if (draft.type === 'Bank' && (draft.bankName || draft.accountNumber)) {
        computedDetails = `${draft.bankName || draft.name} - A/C ${draft.accountNumber || '—'} - IFSC ${draft.ifscCode || '—'}${draft.branch ? ` (${draft.branch})` : ''}`;
      } else if (draft.type === 'Digital') {
        computedDetails = draft.details || 'UPI / QR Remittance';
      }
    }

    const payload = {
      ...draft,
      details: computedDetails,
      maxLimit: draft.maxLimit ? Number(draft.maxLimit) : null
    };

    let updatedList;
    if (modalMode === 'create') {
      const newId = `PM-${Date.now().toString().slice(-4)}`;
      const newM = { ...payload, id: newId };
      if (newM.isDefault) {
        updatedList = methods.map((m) => ({ ...m, isDefault: false }));
        updatedList.push(newM);
      } else {
        updatedList = [...methods, newM];
      }
    } else {
      updatedList = methods.map((m) => {
        if (m.id === selectedId) {
          return { ...payload, id: selectedId };
        }
        if (draft.isDefault) {
          return { ...m, isDefault: false };
        }
        return m;
      });
    }

    onChange({ ...data, paymentMethods: updatedList });
    setModalMode(null);
  };

  const handleDelete = (id) => {
    const item = methods.find((m) => m.id === id);
    if (item?.isDefault) {
      alert('Cannot delete the default payment method.');
      return;
    }
    if (window.confirm('Are you sure you want to remove this payment method?')) {
      const updatedList = methods.filter((m) => m.id !== id);
      onChange({ ...data, paymentMethods: updatedList });
    }
  };

  const handleToggleStatus = (id) => {
    const updatedList = methods.map((m) => {
      if (m.id === id) {
        return { ...m, status: m.status === 'Active' ? 'Inactive' : 'Active' };
      }
      return m;
    });
    onChange({ ...data, paymentMethods: updatedList });
  };

  return (
    <div className="settings-section-container">
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <h2>Accepted Payment Methods & Corporate Bank Accounts</h2>
          <p>Configure company bank accounts (SBI, HDFC, IndusInd), payment routes (RTGS, NEFT, IMPS, UPI), and transaction payout limits.</p>
        </div>
        <div className="settings-section-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={handleOpenCreate}
          >
            + Add Bank / Payment Method
          </button>
        </div>
      </div>

      <div className="settings-table-wrapper">
        <div className="settings-table-toolbar">
          <div className="settings-table-search" style={{ position: 'relative' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search banks, methods, account numbers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingRight: search ? '28px' : undefined }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                title="Clear search"
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '13px' }}
              >
                ✕
              </button>
            )}
          </div>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            Showing <strong>{filtered.length}</strong> of {methods.length} methods
          </span>
        </div>

        <div className="settings-table-scroll">
          <table className="settings-table" style={{ width: '100%', minWidth: '1050px' }}>
            <colgroup>
              <col style={{ width: '9%' }} />
              <col style={{ width: '21%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '6%' }} />
              <col style={{ width: '6%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap' }}>Code</th>
                <th>Bank / Method Name</th>
                <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Type</th>
                <th>Remittance & Account Details</th>
                <th>Routes / Sub-Methods</th>
                <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Limit Cap (₹)</th>
                <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Status</th>
                <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                    {search.trim() ? `No payment methods found matching "${search.trim()}".` : 'No payment methods found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {m.code}
                      </span>
                    </td>
                    <td>
                      <strong>{m.name}</strong>
                      {m.isDefault && (
                        <span className="settings-pill-badge active" style={{ marginLeft: '6px', fontSize: '10.5px' }}>Default</span>
                      )}
                      {m.bankName && m.bankName !== m.name && (
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>Bank: {m.bankName}</div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span className="settings-pill-badge primary" style={{ whiteSpace: 'nowrap' }}>{m.type}</span>
                    </td>
                    <td style={{ color: '#475569', fontSize: '12.5px', lineHeight: 1.4 }}>
                      {m.details || (m.accountNumber ? `A/C: ${m.accountNumber} | IFSC: ${m.ifscCode || '—'}` : '—')}
                    </td>
                    <td style={{ fontSize: '12px', color: '#334155' }}>
                      {m.subMethods || (m.type === 'Bank' ? 'RTGS, NEFT, IMPS' : 'Standard')}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace', fontSize: '12.5px' }}>
                      {m.maxLimit ? `₹${Number(m.maxLimit).toLocaleString('en-IN')}` : <span style={{ color: '#94a3b8' }}>No Cap</span>}
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(m.id)}
                        className={`settings-pill-badge ${m.status === 'Active' ? 'active' : 'inactive'}`}
                        style={{ border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        title="Click to toggle status"
                      >
                        {m.status}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div className="settings-table-actions-group">
                        <button
                          type="button"
                          className="settings-btn settings-btn-secondary"
                          onClick={() => handleOpenEdit(m)}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="settings-btn settings-btn-outline-danger"
                          onClick={() => handleDelete(m.id)}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {modalMode && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-card" style={{ maxWidth: '640px' }}>
            <div className="settings-modal-header">
              <h3 className="settings-modal-title">
                {modalMode === 'create' ? 'Add Bank / Payment Method' : 'Edit Bank / Payment Method'}
              </h3>
              <button
                type="button"
                className="settings-modal-close-btn"
                onClick={() => setModalMode(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveModal}>
              <div className="settings-modal-body">
                <div className="settings-grid-2">
                  <div className="settings-field-group">
                    <label className="settings-field-label">Method Code *</label>
                    <input
                      type="text"
                      className="settings-input"
                      value={draft.code}
                      onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                      required
                      placeholder="e.g. HDFC-01 or SBI-01"
                    />
                  </div>
                  <div className="settings-field-group">
                    <label className="settings-field-label">Payment Type *</label>
                    <select
                      className="settings-select"
                      value={draft.type}
                      onChange={(e) => {
                        const nextType = e.target.value;
                        setDraft({
                          ...draft,
                          type: nextType,
                          subMethods: nextType === 'Bank' ? 'RTGS, NEFT, IMPS, Cheque' : (nextType === 'Digital' ? 'UPI / QR Code' : 'Voucher'),
                          maxLimit: nextType === 'Digital' && !draft.maxLimit ? '100000' : draft.maxLimit
                        });
                      }}
                    >
                      {PAYMENT_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="settings-grid-2">
                  <div className="settings-field-group">
                    <label className="settings-field-label">Display Name *</label>
                    <input
                      type="text"
                      className="settings-input"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      required
                      placeholder="e.g. HDFC Bank Current Account"
                    />
                  </div>
                  {draft.type === 'Bank' ? (
                    <div className="settings-field-group">
                      <label className="settings-field-label">Bank Institution</label>
                      <input
                        type="text"
                        className="settings-input"
                        value={draft.bankName || ''}
                        onChange={(e) => setDraft({ ...draft, bankName: e.target.value })}
                        placeholder="e.g. HDFC Bank, SBI, IndusInd"
                      />
                    </div>
                  ) : (
                    <div className="settings-field-group">
                      <label className="settings-field-label">Per-Transaction Cap / Limit (₹)</label>
                      <input
                        type="number"
                        className="settings-input"
                        value={draft.maxLimit || ''}
                        onChange={(e) => setDraft({ ...draft, maxLimit: e.target.value })}
                        placeholder="e.g. 100000 (UPI ceiling)"
                      />
                    </div>
                  )}
                </div>

                {draft.type === 'Bank' && (
                  <>
                    <div className="settings-grid-2">
                      <div className="settings-field-group">
                        <label className="settings-field-label">Account Number</label>
                        <input
                          type="text"
                          className="settings-input"
                          value={draft.accountNumber || ''}
                          onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })}
                          placeholder="e.g. 50200028741215"
                        />
                      </div>
                      <div className="settings-field-group">
                        <label className="settings-field-label">IFSC Code</label>
                        <input
                          type="text"
                          className="settings-input"
                          value={draft.ifscCode || ''}
                          onChange={(e) => setDraft({ ...draft, ifscCode: e.target.value.toUpperCase() })}
                          placeholder="e.g. HDFC0000024"
                        />
                      </div>
                    </div>

                    <div className="settings-grid-2">
                      <div className="settings-field-group">
                        <label className="settings-field-label">Branch & City</label>
                        <input
                          type="text"
                          className="settings-input"
                          value={draft.branch || ''}
                          onChange={(e) => setDraft({ ...draft, branch: e.target.value })}
                          placeholder="e.g. Anna Nagar, Chennai"
                        />
                      </div>
                      <div className="settings-field-group">
                        <label className="settings-field-label">Max Payout Cap (₹)</label>
                        <input
                          type="number"
                          className="settings-input"
                          value={draft.maxLimit || ''}
                          onChange={(e) => setDraft({ ...draft, maxLimit: e.target.value })}
                          placeholder="e.g. 5000000 (No limit if blank)"
                        />
                      </div>
                    </div>

                    <div className="settings-field-group">
                      <label className="settings-field-label">Supported Routes / Sub-Methods</label>
                      <input
                        type="text"
                        className="settings-input"
                        value={draft.subMethods || ''}
                        onChange={(e) => setDraft({ ...draft, subMethods: e.target.value })}
                        placeholder="e.g. RTGS, NEFT, IMPS, Cheque"
                      />
                    </div>
                  </>
                )}

                <div className="settings-field-group">
                  <label className="settings-field-label">Account Details / Routing Info</label>
                  <textarea
                    className="settings-textarea"
                    rows={2}
                    value={draft.details}
                    onChange={(e) => setDraft({ ...draft, details: e.target.value })}
                    placeholder="Auto-formatted or enter custom remittance details, UPI VPA, or beneficiary notes"
                  />
                </div>

                <div className="settings-toggle-row" onClick={() => setDraft({ ...draft, isDefault: !draft.isDefault })}>
                  <div className="settings-toggle-info">
                    <span className="settings-toggle-label">Set as Default Payment Method</span>
                    <span className="settings-toggle-desc">Automatically selected on invoices and purchase orders.</span>
                  </div>
                  <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={draft.isDefault}
                      onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
                    />
                    <span className="settings-slider" />
                  </label>
                </div>
              </div>

              <div className="settings-modal-footer">
                <button
                  type="button"
                  className="settings-btn settings-btn-secondary"
                  onClick={() => setModalMode(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="settings-btn settings-btn-primary"
                >
                  Save Method
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
