import React, { useState, useMemo } from 'react';
import { filterRecordsBySearch } from '../../../utils/searchHelper';

const emptyLocation = {
  name: '',
  code: '',
  address: '',
  city: 'Chennai',
  state: 'Tamil Nadu',
  pincode: '600095',
  isPrimary: false,
  status: 'Active'
};

export default function LocationsSection({ data, onChange, onSave, isSaving }) {
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | null
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(emptyLocation);

  const locations = Array.isArray(data?.locations) ? data.locations : [];

  const filtered = useMemo(() => {
    return filterRecordsBySearch(locations, search, [
      (l) => l.name,
      (l) => l.code,
      (l) => l.city,
      (l) => l.state,
      (l) => l.pincode,
      (l) => l.address,
      (l) => l.status
    ]);
  }, [locations, search]);

  const handleOpenCreate = () => {
    const nextNum = locations.length + 1;
    const defaultCode = `LOC-${String(nextNum).padStart(3, '0')}`;
    setDraft({ ...emptyLocation, code: defaultCode });
    setSelectedId(null);
    setModalMode('create');
  };

  const handleOpenEdit = (loc) => {
    setDraft({ ...loc });
    setSelectedId(loc.id);
    setModalMode('edit');
  };

  const handleSaveModal = (e) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.code.trim()) return;

    let updatedList;
    if (modalMode === 'create') {
      const newId = `LOC-${Date.now().toString().slice(-4)}`;
      const newLoc = { ...draft, id: newId };
      if (newLoc.isPrimary) {
        updatedList = locations.map((l) => ({ ...l, isPrimary: false }));
        updatedList.push(newLoc);
      } else {
        updatedList = [...locations, newLoc];
      }
    } else {
      updatedList = locations.map((l) => {
        if (l.id === selectedId) {
          return { ...draft, id: selectedId };
        }
        if (draft.isPrimary) {
          return { ...l, isPrimary: false };
        }
        return l;
      });
    }

    onChange({ ...data, locations: updatedList });
    setModalMode(null);
  };

  const handleDelete = (id) => {
    const loc = locations.find((l) => l.id === id);
    if (loc?.isPrimary) {
      alert('Cannot delete the primary location. Set another location as primary first.');
      return;
    }
    if (window.confirm('Are you sure you want to remove this location?')) {
      const updatedList = locations.filter((l) => l.id !== id);
      onChange({ ...data, locations: updatedList });
    }
  };

  const handleToggleStatus = (id) => {
    const updatedList = locations.map((l) => {
      if (l.id === id) {
        return { ...l, status: l.status === 'Active' ? 'Inactive' : 'Active' };
      }
      return l;
    });
    onChange({ ...data, locations: updatedList });
  };

  return (
    <div className="settings-section-container">
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <h2>Locations &amp; Operating Addresses</h2>
          <p>Register legal offices, operational regional sites, and physical shipping hubs.</p>
        </div>
        <div className="settings-section-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={handleOpenCreate}
          >
            + Add Location
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
              placeholder="Search by name, city, state, or PIN..."
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
            Showing <strong>{filtered.length}</strong> of {locations.length} locations
          </span>
        </div>

        <div className="settings-table-scroll">
          <table className="settings-table">
            <colgroup>
              <col style={{ width: '9%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '13%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Code</th>
                <th>Location Name</th>
                <th>City &amp; State</th>
                <th>Postal Address</th>
                <th style={{ textAlign: 'center' }}>Primary</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                    {search.trim() ? `No locations found matching "${search.trim()}".` : 'No locations found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((loc) => (
                  <tr key={loc.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                        {loc.code}
                      </span>
                    </td>
                    <td>
                      <strong>{loc.name}</strong>
                    </td>
                    <td>{loc.city}, {loc.state} ({loc.pincode})</td>
                    <td style={{ color: '#475569', fontSize: '12.5px', lineHeight: 1.4 }}>{loc.address}</td>
                    <td style={{ textAlign: 'center' }}>
                      {loc.isPrimary ? (
                        <span className="settings-pill-badge primary">Primary</span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(loc.id)}
                        className={`settings-pill-badge ${loc.status === 'Active' ? 'active' : 'inactive'}`}
                        style={{ border: 'none', cursor: 'pointer' }}
                        title="Click to toggle status"
                      >
                        {loc.status}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="settings-table-actions-group">
                        <button
                          type="button"
                          className="settings-btn settings-btn-secondary"
                          onClick={() => handleOpenEdit(loc)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="settings-btn settings-btn-outline-danger"
                          onClick={() => handleDelete(loc.id)}
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
                {modalMode === 'create' ? 'Add New Location' : 'Edit Operating Location'}
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
                      Location Code <span className="settings-required">*</span>
                    </label>
                    <input
                      type="text"
                      className="settings-input"
                      value={draft.code}
                      onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                      required
                      placeholder="CHN-HO"
                    />
                  </div>
                  <div className="settings-field-group">
                    <label className="settings-field-label">
                      Location Name <span className="settings-required">*</span>
                    </label>
                    <input
                      type="text"
                      className="settings-input"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      required
                      placeholder="Chennai Head Office"
                    />
                  </div>
                </div>

                <div className="settings-field-group">
                  <label className="settings-field-label">
                    Full Postal Address <span className="settings-required">*</span>
                  </label>
                  <textarea
                    className="settings-textarea"
                    rows={2}
                    value={draft.address}
                    onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                    required
                    placeholder="Plot No. 10A, Perumal Kovil Street, Vanagaram"
                  />
                </div>

                <div className="settings-grid-3">
                  <div className="settings-field-group">
                    <label className="settings-field-label">City</label>
                    <input
                      type="text"
                      className="settings-input"
                      value={draft.city}
                      onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                      required
                    />
                  </div>
                  <div className="settings-field-group">
                    <label className="settings-field-label">State</label>
                    <input
                      type="text"
                      className="settings-input"
                      value={draft.state}
                      onChange={(e) => setDraft({ ...draft, state: e.target.value })}
                      required
                    />
                  </div>
                  <div className="settings-field-group">
                    <label className="settings-field-label">Postal / ZIP Code</label>
                    <input
                      type="text"
                      className="settings-input"
                      value={draft.pincode}
                      onChange={(e) => setDraft({ ...draft, pincode: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="settings-toggle-row" onClick={() => setDraft({ ...draft, isPrimary: !draft.isPrimary })}>
                  <div className="settings-toggle-info">
                    <span className="settings-toggle-label">Primary Enterprise HQ</span>
                    <span className="settings-toggle-desc">Mark this location as default headquarters for company header rendering.</span>
                  </div>
                  <label className="settings-switch" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={draft.isPrimary}
                      onChange={(e) => setDraft({ ...draft, isPrimary: e.target.checked })}
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
                  Save Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
