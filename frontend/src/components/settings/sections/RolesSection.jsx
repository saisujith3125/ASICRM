import React, { useState, useMemo } from 'react';
import { filterRecordsBySearch } from '../../../utils/searchHelper';

const emptyRole = { name: '', description: '' };

export default function RolesSection({
  roles,
  users,
  currentUser,
  onSaveRole,
  onDeleteRole,
  isSaving
}) {
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | null
  const [selectedRoleKey, setSelectedRoleKey] = useState(null);
  const [draft, setDraft] = useState(emptyRole);
  const [modalError, setModalError] = useState('');

  const userCountsByRole = useMemo(() => {
    const counts = {};
    users.forEach((u) => {
      counts[u.role] = (counts[u.role] || 0) + 1;
    });
    return counts;
  }, [users]);

  const filtered = useMemo(() => {
    return filterRecordsBySearch(roles, search, [
      (r) => r.name,
      (r) => r.key,
      (r) => r.description
    ]);
  }, [roles, search]);

  const handleOpenCreate = () => {
    setDraft(emptyRole);
    setSelectedRoleKey(null);
    setModalError('');
    setModalMode('create');
  };

  const handleOpenEdit = (role) => {
    if (role.key === 'SUPER_ADMIN') return;
    setDraft({ name: role.name, description: role.description || '' });
    setSelectedRoleKey(role.key);
    setModalError('');
    setModalMode('edit');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    if (!draft.name.trim()) {
      setModalError('Role name is required.');
      return;
    }

    try {
      await onSaveRole(draft, modalMode === 'edit', selectedRoleKey);
      setModalMode(null);
    } catch (err) {
      setModalError(err.message || 'Failed to save role.');
    }
  };

  const handleDelete = async (role) => {
    if (role.key === 'SUPER_ADMIN') {
      alert('The Super Admin role is protected and cannot be deleted.');
      return;
    }
    const count = userCountsByRole[role.key] || 0;
    if (count > 0) {
      alert(`Cannot delete this role while ${count} user(s) are assigned to it. Reassign those users first.`);
      return;
    }
    if (window.confirm(`Are you sure you want to delete the "${role.name}" role?`)) {
      try {
        await onDeleteRole(role.key);
      } catch (err) {
        alert(err.message || 'Failed to delete role.');
      }
    }
  };

  return (
    <div className="settings-section-container">
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <h2>Access Roles &amp; Groups</h2>
          <p>Define operational access tiers to govern access across modules, deal pipelines, and administrative functions.</p>
        </div>
        <div className="settings-section-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={handleOpenCreate}
          >
            + Create Role
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
              placeholder="Search roles..."
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
            Showing <strong>{filtered.length}</strong> of {roles.length} roles
          </span>
        </div>

        <div className="settings-table-scroll">
          <table className="settings-table">
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '28%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Role Identifier</th>
                <th>Role Name</th>
                <th>Description</th>
                <th style={{ textAlign: 'center' }}>Users</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                    {search.trim() ? `No roles found matching "${search.trim()}".` : 'No roles found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const count = userCountsByRole[r.key] || 0;
                  const isProtected = r.key === 'SUPER_ADMIN';

                  return (
                    <tr key={r.id || r.key}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a', wordBreak: 'break-all', fontSize: '12px' }}>
                          {r.key}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong>{r.name}</strong>
                          {isProtected && (
                            <span className="settings-pill-badge primary" style={{ fontSize: '10px' }}>
                              System Protected
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ color: '#475569', fontSize: '12.5px', lineHeight: 1.4 }}>
                        {r.description || '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="settings-pill-badge active" style={{ fontSize: '11px' }}>
                          {count} User{count === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {!isProtected ? (
                          <div className="settings-table-actions-group">
                            <button
                              type="button"
                              className="settings-btn settings-btn-secondary"
                              onClick={() => handleOpenEdit(r)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="settings-btn settings-btn-outline-danger"
                              onClick={() => handleDelete(r)}
                            >
                              Delete
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11.5px', color: '#94a3b8', fontStyle: 'italic' }}>Immutable</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT ROLE MODAL */}
      {modalMode && (
        <div className="settings-modal-overlay" onClick={() => setModalMode(null)}>
          <div className="settings-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-header">
              <h3 className="settings-modal-title">
                {modalMode === 'create' ? 'Create New Access Role' : 'Edit Access Role'}
              </h3>
              <button
                type="button"
                className="settings-modal-close-btn"
                onClick={() => setModalMode(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="settings-modal-body">
                {modalError && (
                  <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '13px' }}>
                    {modalError}
                  </div>
                )}

                <div className="settings-field-group">
                  <label className="settings-field-label">
                    Role Name <span className="settings-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="settings-input"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    required
                    placeholder="e.g. Sales Executive"
                  />
                </div>

                <div className="settings-field-group">
                  <label className="settings-field-label">Role Description</label>
                  <textarea
                    className="settings-textarea"
                    rows={3}
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="Explain permissions and responsibilities assigned to this role..."
                  />
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
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}