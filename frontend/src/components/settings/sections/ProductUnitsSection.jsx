import React, { useState, useMemo } from 'react';
import { filterRecordsBySearch } from '../../../utils/searchHelper';

const emptyUnit = {
  name: '',
  code: '',
  description: '',
  status: 'Active'
};

const DEFAULT_STANDARD_UNITS = [
  { id: 'Nos', name: 'Nos', code: 'NOS', description: 'Numbers / Units count', status: 'Active' },
  { id: 'Box', name: 'Box', code: 'BOX', description: 'Carton / Box pack', status: 'Active' },
  { id: 'Set', name: 'Set', code: 'SET', description: 'Complete set of accessories', status: 'Active' },
  { id: 'Meter', name: 'Meter', code: 'MTR', description: 'Length measurement in meters', status: 'Active' },
  { id: 'Roll', name: 'Roll', code: 'ROL', description: 'Continuous roll packaging (Cables / Wires)', status: 'Active' }
];

export default function ProductUnitsSection({ data, onChange, onSave, isSaving }) {
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | null
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(emptyUnit);

  const units = useMemo(() => {
    if (Array.isArray(data?.productUnits) && data.productUnits.length > 0) {
      // Ensure 'Piece' is migrated to 'Nos' if present in legacy array
      return data.productUnits.map((u) => {
        if (u.id === 'Piece' || u.name === 'Piece') {
          return { ...u, id: 'Nos', name: 'Nos', code: u.code || 'NOS' };
        }
        return u;
      });
    }
    return DEFAULT_STANDARD_UNITS;
  }, [data?.productUnits]);

  const filtered = useMemo(() => {
    return filterRecordsBySearch(units, search, [
      (u) => u.name,
      (u) => u.code,
      (u) => u.description,
      (u) => u.status
    ]);
  }, [units, search]);

  const handleOpenCreate = () => {
    setDraft(emptyUnit);
    setSelectedId(null);
    setModalMode('create');
  };

  const handleOpenEdit = (u) => {
    setDraft({
      name: u.name || u.id,
      code: u.code || u.name?.toUpperCase() || '',
      description: u.description || '',
      status: u.status || 'Active'
    });
    setSelectedId(u.id);
    setModalMode('edit');
  };

  const handleSaveModal = (e) => {
    e.preventDefault();
    const cleanName = draft.name.trim();
    if (!cleanName) return;
    const cleanCode = (draft.code.trim() || cleanName.slice(0, 4)).toUpperCase();

    let updatedList;
    if (modalMode === 'create') {
      const newId = cleanName;
      // Prevent duplicate unit names
      if (units.some((u) => u.id.toLowerCase() === newId.toLowerCase())) {
        alert(`A unit named "${cleanName}" already exists.`);
        return;
      }
      const newUnit = {
        id: newId,
        name: cleanName,
        code: cleanCode,
        description: draft.description.trim(),
        status: draft.status || 'Active'
      };
      updatedList = [...units, newUnit];
    } else {
      updatedList = units.map((u) => {
        if (u.id === selectedId) {
          return {
            ...u,
            name: cleanName,
            code: cleanCode,
            description: draft.description.trim(),
            status: draft.status || 'Active'
          };
        }
        return u;
      });
    }

    const updatedData = {
      ...data,
      productUnits: updatedList
    };
    onChange(updatedData);
    if (onSave) onSave(updatedData);
    setModalMode(null);
  };

  const handleDelete = (id) => {
    if (units.length <= 1) {
      alert('At least one unit of measurement must be maintained in the system.');
      return;
    }
    if (window.confirm(`Are you sure you want to remove the unit "${id}"?`)) {
      const updatedList = units.filter((u) => u.id !== id);
      const updatedData = {
        ...data,
        productUnits: updatedList
      };
      onChange(updatedData);
      if (onSave) onSave(updatedData);
    }
  };

  const handleToggleStatus = (id) => {
    const updatedList = units.map((u) => {
      if (u.id === id) {
        return { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' };
      }
      return u;
    });
    const updatedData = {
      ...data,
      productUnits: updatedList
    };
    onChange(updatedData);
    if (onSave) onSave(updatedData);
  };

  return (
    <div className="settings-section-container">
      {/* SECTION HEADER - Clean standard design without removed paragraph or duplicate buttons */}
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <h2>Product Units &amp; Measurement (UOM)</h2>
        </div>
        <div className="settings-section-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={handleOpenCreate}
          >
            + Add Unit
          </button>
        </div>
      </div>

      {/* TABLE WORKSPACE */}
      <div className="settings-table-wrapper">
        <div className="settings-table-toolbar">
          <div className="settings-table-search" style={{ position: 'relative' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by unit name, code, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingRight: search ? '28px' : undefined }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                title="Clear search"
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  fontSize: '13px'
                }}
              >
                ✕
              </button>
            )}
          </div>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            Showing <strong>{filtered.length}</strong> of {units.length} units
          </span>
        </div>

        <div className="settings-table-scroll">
          <table className="settings-table" style={{ minWidth: '820px' }}>
            <colgroup>
              <col style={{ width: '6%' }} />
              <col style={{ width: '24%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '28%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ textAlign: 'center' }}>#</th>
                <th>Unit Name</th>
                <th>Code / Symbol</th>
                <th>Description</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                    {search.trim() ? `No units found matching "${search.trim()}".` : 'No measurement units found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((u, idx) => (
                  <tr key={u.id || idx}>
                    <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                      {idx + 1}
                    </td>
                    <td>
                      <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>{u.name}</strong>
                    </td>
                    <td>
                      <span style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        color: '#334155',
                        background: '#f1f5f9',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                        display: 'inline-block'
                      }}>
                        {u.code || u.name?.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ color: '#475569', fontSize: '12.5px', lineHeight: 1.4 }}>
                      {u.description || '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(u.id)}
                        className={`settings-pill-badge ${u.status === 'Active' ? 'active' : 'inactive'}`}
                        style={{ border: 'none', cursor: 'pointer' }}
                        title="Click to toggle status"
                      >
                        {u.status || 'Active'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="settings-table-actions-group">
                        <button
                          type="button"
                          className="settings-btn settings-btn-secondary"
                          onClick={() => handleOpenEdit(u)}
                          title="Edit unit"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="settings-btn settings-btn-outline-danger"
                          onClick={() => handleDelete(u.id)}
                          title="Delete unit"
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
                {modalMode === 'create' ? 'Add Product Unit' : `Edit Unit: ${draft.name}`}
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
                      Unit Name <span className="settings-required">*</span>
                    </label>
                    <input
                      type="text"
                      className="settings-input"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      placeholder="e.g. Nos, Box, Set, Meter, Roll"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="settings-field-group">
                    <label className="settings-field-label">
                      Code / Symbol <span className="settings-required">*</span>
                    </label>
                    <input
                      type="text"
                      className="settings-input"
                      value={draft.code}
                      onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. NOS, BOX, SET, MTR, ROL"
                      required
                    />
                  </div>
                </div>

                <div className="settings-field-group">
                  <label className="settings-field-label">
                    Description / Notes
                  </label>
                  <textarea
                    className="settings-textarea"
                    rows={2}
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="e.g. Numbers / piece count measurement"
                  />
                </div>

                <div className="settings-field-group">
                  <label className="settings-field-label">Status</label>
                  <select
                    className="settings-input"
                    value={draft.status}
                    onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
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
                  {modalMode === 'create' ? 'Add Unit' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
