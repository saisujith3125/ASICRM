import React, { useState, useMemo } from 'react';
import { filterRecordsBySearch } from '../../../utils/searchHelper';

const emptyUser = { name: '', employeeId: '', email: '', mobile: '', role: '', status: 'Active' };

export default function UsersSection({
  users,
  roles,
  currentUser,
  onSaveUser,
  isSaving,
  error
}) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | null
  const [draft, setDraft] = useState(emptyUser);
  const [modalError, setModalError] = useState('');

  const isSuperAdmin = String(currentUser?.role || '').toUpperCase() === 'SUPER_ADMIN';

  const roleOptions = useMemo(() => {
    return isSuperAdmin ? roles : roles.filter((r) => r.key !== 'SUPER_ADMIN');
  }, [roles, isSuperAdmin]);

  const roleNameMap = useMemo(() => {
    return Object.fromEntries(roles.map((r) => [r.key, r.name]));
  }, [roles]);

  const filtered = useMemo(() => {
    let list = users;
    if (roleFilter !== 'ALL') {
      list = list.filter((u) => u.role === roleFilter);
    }
    return filterRecordsBySearch(list, search, [
      (u) => u.name,
      (u) => u.email,
      (u) => u.employeeId,
      (u) => u.mobile,
      (u) => u.phone,
      (u) => u.role,
      (u) => roleNameMap[u.role]
    ]);
  }, [users, search, roleFilter, roleNameMap]);

  const handleOpenCreate = () => {
    setDraft({ ...emptyUser, role: roleOptions[0]?.key || '' });
    setModalError('');
    setModalMode('create');
  };

  const handleOpenEdit = (user) => {
    setDraft({ ...user });
    setModalError('');
    setModalMode('edit');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');

    if (!draft.name.trim() || !draft.email.trim() || !/^\d{10}$/.test(draft.mobile)) {
      setModalError('Name, valid email and a unique 10-digit mobile number are required.');
      return;
    }
    if (!draft.role) {
      setModalError('Please select a valid role.');
      return;
    }

    try {
      await onSaveUser(draft, modalMode === 'edit');
      setModalMode(null);
    } catch (err) {
      setModalError(err.message || 'Failed to save user.');
    }
  };

  return (
    <div className="settings-section-container">
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <h2>Users &amp; Personnel Accounts</h2>
          <p>Create user logins, assign employee identification numbers, and delegate operational access roles.</p>
        </div>
        <div className="settings-section-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={handleOpenCreate}
          >
            + Add New User
          </button>
        </div>
      </div>

      <div className="settings-table-wrapper">
        <div className="settings-table-toolbar">
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="settings-table-search" style={{ position: 'relative' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, email, employee ID, phone..."
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
            <select
              className="settings-select"
              style={{ width: 'auto', padding: '7px 12px', fontSize: '13px' }}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="ALL">All Roles ({users.length})</option>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>{r.name}</option>
              ))}
            </select>
          </div>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            Showing <strong>{filtered.length}</strong> of {users.length} users
          </span>
        </div>

        <div className="settings-table-scroll">
          <table className="settings-table">
            <colgroup>
              <col style={{ width: '28%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>User Details</th>
                <th>Employee ID</th>
                <th>Assigned Role</th>
                <th>Mobile Number</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                    {search.trim() ? `No users found matching "${search.trim()}".` : 'No users found matching your filters.'}
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const roleLabel = roleNameMap[u.role] || u.role;
                  const isUserSuperAdmin = u.role === 'SUPER_ADMIN';

                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            minWidth: '32px',
                            borderRadius: '50%',
                            background: isUserSuperAdmin ? '#eff6ff' : '#f1f5f9',
                            color: isUserSuperAdmin ? '#2563eb' : '#475569',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 700,
                            fontSize: '12px'
                          }}>
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0, overflow: 'hidden' }}>
                            <strong style={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{u.name}</strong>
                            <div style={{ fontSize: '12px', color: '#64748b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                          {u.employeeId || '—'}
                        </span>
                      </td>
                      <td>
                        <span className={`settings-pill-badge ${isUserSuperAdmin ? 'primary' : ''}`}>
                          {roleLabel}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                          +91 {u.mobile}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`settings-pill-badge ${u.status === 'Active' ? 'active' : 'inactive'}`}>
                          {u.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="settings-table-actions-group">
                          <button
                            type="button"
                            className="settings-btn settings-btn-secondary"
                            onClick={() => handleOpenEdit(u)}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT USER MODAL */}
      {modalMode && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-card">
            <div className="settings-modal-header">
              <h3 className="settings-modal-title">
                {modalMode === 'create' ? 'Add New User Account' : 'Edit User Account'}
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
                    Full Name <span className="settings-required">*</span>
                  </label>
                  <input
                    type="text"
                    className="settings-input"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    required
                    placeholder="e.g. Rajesh Kumar"
                  />
                </div>

                <div className="settings-grid-2">
                  <div className="settings-field-group">
                    <label className="settings-field-label">
                      Email Address <span className="settings-required">*</span>
                    </label>
                    <input
                      type="email"
                      className="settings-input"
                      value={draft.email}
                      onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                      required
                      placeholder="rajesh@asicrm.local"
                    />
                  </div>
                  <div className="settings-field-group">
                    <label className="settings-field-label">Employee ID</label>
                    <input
                      type="text"
                      className="settings-input"
                      value={draft.employeeId}
                      onChange={(e) => setDraft({ ...draft, employeeId: e.target.value })}
                      placeholder="EMP-004"
                    />
                  </div>
                </div>

                <div className="settings-grid-2">
                  <div className="settings-field-group">
                    <label className="settings-field-label">
                      Mobile Number (10 Digits) <span className="settings-required">*</span>
                    </label>
                    <input
                      type="tel"
                      className="settings-input"
                      value={draft.mobile}
                      onChange={(e) => setDraft({ ...draft, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                      required
                      placeholder="9876543210"
                    />
                  </div>
                  <div className="settings-field-group">
                    <label className="settings-field-label">
                      Assigned Role <span className="settings-required">*</span>
                    </label>
                    <select
                      className="settings-select"
                      value={draft.role}
                      onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                      required
                    >
                      {roleOptions.map((r) => (
                        <option key={r.key} value={r.key}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="settings-field-group">
                  <label className="settings-field-label">Account Status</label>
                  <select
                    className="settings-select"
                    value={draft.status}
                    onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                  >
                    <option value="Active">Active (Can log in &amp; perform tasks)</option>
                    <option value="Inactive">Inactive (Suspended)</option>
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
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
