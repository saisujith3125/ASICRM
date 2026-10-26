import React, { useState, useMemo } from 'react';
import { filterRecordsBySearch } from '../../../utils/searchHelper';

const emptyBranch = {
  name: '',
  code: '',
  locationId: '',
  manager: '',
  phone: '',
  email: '',
  status: 'Active'
};

export default function BranchesSection({ data, onChange, onSave, isSaving }) {
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(emptyBranch);

  const branches = Array.isArray(data?.branches) ? data.branches : [];
  const locations = Array.isArray(data?.locations) ? data.locations : [];

  const locationMap = useMemo(() => {
    return Object.fromEntries(locations.map((l) => [l.id, l.name]));
  }, [locations]);

  const filtered = useMemo(() => {
    return filterRecordsBySearch(branches, search, [
      (b) => b.name,
      (b) => b.code,
      (b) => b.manager,
      (b) => b.phone,
      (b) => b.email,
      (b) => b.status,
      (b) => locationMap[b.locationId]
    ]);
  }, [branches, search, locationMap]);

  const handleOpenCreate = () => {
    const nextNum = branches.length + 1;
    const defaultCode = `BR-${String(nextNum).padStart(3, '0')}`;
    setDraft({ ...emptyBranch, code: defaultCode, locationId: locations[0]?.id || '' });
    setSelectedId(null);
    setModalMode('create');
  };

  const handleOpenEdit = (branch) => {
    setDraft({ ...branch });
    setSelectedId(branch.id);
    setModalMode('edit');
  };

  const handleSaveModal = (e) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.code.trim()) return;

    let updatedList;
    if (modalMode === 'create') {
      const newId = `BR-${Date.now().toString().slice(-4)}`;
      updatedList = [...branches, { ...draft, id: newId }];
    } else {
      updatedList = branches.map((b) => (b.id === selectedId ? { ...draft, id: selectedId } : b));
    }

    onChange({ ...data, branches: updatedList });
    setModalMode(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to remove this branch?')) {
      const updatedList = branches.filter((b) => b.id !== id);
      onChange({ ...data, branches: updatedList });
    }
  };

  const handleToggleStatus = (id) => {
    const updatedList = branches.map((b) => {
      if (b.id === id) {
        return { ...b, status: b.status === 'Active' ? 'Inactive' : 'Active' };
      }
      return b;
    });
    onChange({ ...data, branches: updatedList });
  };

  return (
    <div className="settings-section-container">
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <h2>Branches &amp; Commercial Centers</h2>
          <p>Organize sales divisions, regional customer service offices, and branch contact managers.</p>
        </div>
        <div className="settings-section-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={handleOpenCreate}
          >
            + Add Branch
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
              placeholder="Search branches by code, name, manager, phone..."
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
            Showing <strong>{filtered.length}</strong> of {branches.length} branches
          </span>
        </div>

        <div className="settings-table-scroll">
          <table className="settings-table" style={{ minWidth: '920px' }}>
            <colgroup>
              <col style={{ width: '9%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '19%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '13%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Code</th>
                <th>Branch Name</th>
                <th>Linked Location</th>
                <th>Manager</th>
                <th>Direct Contact</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                    {search.trim() ? `No branches found matching "${search.trim()}".` : 'No branches found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                        {b.code}
                      </span>
                    </td>
                    <td>
                      <strong>{b.name}</strong>
                    </td>
                    <td>{locationMap[b.locationId] || 'Unassigned'}</td>
                    <td>{b.manager || '—'}</td>
                    <td>
                      <div style={{ fontSize: '12.5px', lineHeight: 1.35 }}>
                        <div>{b.phone || '—'}</div>
                        <div style={{ color: '#64748b', fontSize: '11.5px' }}>{b.email || ''}</div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(b.id)}
                        className={`settings-pill-badge ${b.status === 'Active' ? 'active' : 'inactive'}`}
                        style={{ border: 'none', cursor: 'pointer' }}
                        title="Click to toggle status"
                      >
                        {b.status}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="settings-table-actions-group">
                        <button
                          type="button"
                          className="settings-btn settings-btn-secondary"
                          onClick={() => handleOpenEdit(b)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="settings-btn settings-btn-outline-danger"
                          onClick={() => handleDelete(b.id)}
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
          <div className="settings-modal-card">
            <div className="settings-modal-header">
              <h3 className="settings-modal-title">
                {modalMode === 'create' ? 'Add New Commercial Branch' : 'Edit Branch Center'}
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
                    <label className="settings-field-label">
                      Branch Code <span className="settings-required">*</span>
                    </label>
                    <input
                      type="text"
                      className="settings-input"
                      value={draft.code}
                      onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                      required
                      placeholder="CHN-01"
                    />
                  </div>
                  <div className="settings-field-group">
                    <label className="settings-field-label">
                      Branch Name <span className="settings-required">*</span>
                    </label>
                    <input
                      type="text"
                      className="settings-input"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      required
                      placeholder="Chennai Central"
                    />
                  </div>
                </div>

                <div className="settings-field-group">
                  <label className="settings-field-label">Linked Operating Location</label>
                  <select
                    className="settings-select"
                    value={draft.locationId}
                    onChange={(e) => setDraft({ ...draft, locationId: e.target.value })}
                  >
                    <option value="">-- Select Location --</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} ({loc.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="settings-grid-3">
                  <div className="settings-field-group">
                    <label className="settings-field-label">Manager Name</label>
                    <input
                      type="text"
                      className="settings-input"
                      value={draft.manager}
                      onChange={(e) => setDraft({ ...draft, manager: e.target.value })}
                      placeholder="Rajesh Kumar"
                    />
                  </div>
                  <div className="settings-field-group">
                    <label className="settings-field-label">Phone Number</label>
                    <input
                      type="text"
                      className="settings-input"
                      value={draft.phone}
                      onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                      placeholder="9876543211"
                    />
                  </div>
                  <div className="settings-field-group">
                    <label className="settings-field-label">Contact Email</label>
                    <input
                      type="email"
                      className="settings-input"
                      value={draft.email}
                      onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                      placeholder="branch@asi.ind.in"
                    />
                  </div>
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
                  Save Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
