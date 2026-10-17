import React, { useState, useMemo } from 'react';
import { filterRecordsBySearch } from '../../../utils/searchHelper';

const emptyMethod = {
  name: '',
  code: '',
  type: 'Bank',
  details: '',
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
      (m) => m.type,
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
    setDraft({ ...m });
    setSelectedId(m.id);
    setModalMode('edit');
  };

  const handleSaveModal = (e) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.code.trim()) return;

    let updatedList;
    if (modalMode === 'create') {
      const newId = `PM-${Date.now().toString().slice(-4)}`;
      const newM = { ...draft, id: newId };
      if (newM.isDefault) {
        updatedList = methods.map((m) => ({ ...m, isDefault: false }));
        updatedList.push(newM);
      } else {
        updatedList = [...methods, newM];
      }
    } else {
      updatedList = methods.map((m) => {
        if (m.id === selectedId) {
          return { ...draft, id: selectedId };
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
          <h2>Accepted Payment Methods</h2>
          <p>Configure remittance methods, bank accounts, UPI identifiers, and default checkout channels.</p>
        </div>
        <div className="settings-section-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={handleOpenCreate}
          >
            + Add Method
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
              placeholder="Search payment methods..."
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
          <table className="settings-table">
            <colgroup>
              <col style={{ width: '9%' }} />
              <col style={{ width: '19%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '30%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '15%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Code</th>
                <th>Method Name</th>
                <th style={{ textAlign: 'center' }}>Type</th>
                <th>Remittance Account Details</th>
                <th style={{ textAlign: 'center' }}>Default</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                    {search.trim() ? `No payment methods found matching "${search.trim()}".` : 'No payment methods found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                        {m.code}
                      </span>
                    </td>
                    <td>
                      <strong>{m.name}</strong>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="settings-pill-badge primary">{m.type}</span>
                    </td>
                    <td style={{ color: '#475569', fontSize: '12.5px', lineHeight: 1.4 }}>{m.details || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {m.isDefault ? (
                        <span className="settings-pill-badge active">Default</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(m.id)}
                        className={`settings-pill-badge ${m.status === 'Active' ? 'active' : 'inactive'}`}
                        style={{ border: 'none', cursor: 'pointer' }}
                        title="Click to toggle status"
                      >
                        {m.status}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="settings-table-actions-group">
                        <button
                          type="button"
                          className="settings-btn settings-btn-secondary"
                          onClick={() => handleOpenEdit(m)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="settings-btn settings-btn-outline-danger"
                          onClick={() => handleDelete(m.id)}
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
        <div className="settings-modal-overlay" onClick={() => setModalMode(null)}>
          <div className="settings-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3 className="settings-modal-title">
                {modalMode === 'create' ? 'Add Payment Method' : 'Edit Payment Method'}
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
                    <label className="settings-field-label">Method Code</label>
                    <input
                      type="text"
                      className="settings-input"
                      value={draft.code}
                      onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                      required
                      placeholder="BANK"
                    />
                  </div>
                  <div className="settings-field-group">
                    <label className="settings-field-label">Payment Type</label>
                    <select
                      className="settings-select"
                      value={draft.type}
                      onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                    >
                      {PAYMENT_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="settings-field-group">
                  <label className="settings-field-label">Display Name</label>
                  <input
                    type="text"
                    className="settings-input"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    required
                    placeholder="Bank Transfer (NEFT / RTGS)"
                  />
                </div>

                <div className="settings-field-group">
                  <label className="settings-field-label">Account Details / Routing Info</label>
                  <textarea
                    className="settings-textarea"
                    rows={2}
                    value={draft.details}
                    onChange={(e) => setDraft({ ...draft, details: e.target.value })}
                    placeholder="Bank Name, Account No, IFSC Code, or UPI ID"
                  />
                </div>

                <div className="settings-toggle-row" onClick={() => setDraft({ ...draft, isDefault: !draft.isDefault })}>
                  <div className="settings-toggle-info">
                    <span className="settings-toggle-label">Set as Default Payment Method</span>
                    <span className="settings-toggle-desc">Automatically selected on invoices and proformas.</span>
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
