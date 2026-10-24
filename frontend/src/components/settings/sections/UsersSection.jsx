import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Crown,
  ArrowRightLeft,
  Trash2,
  UserCheck,
  Users,
  AlertTriangle,
  CheckCircle2,
  X,
  Search,
  LogOut,
  UserX,
  HelpCircle
} from 'lucide-react';
import { filterRecordsBySearch } from '../../../utils/searchHelper';

const emptyUser = { name: '', employeeId: '', email: '', mobile: '', role: '', status: 'Active' };

export default function UsersSection({
  users = [],
  roles = [],
  currentUser,
  onSaveUser,
  onDeleteUser,
  onTransferSuperAdmin,
  showToast,
  isSaving,
  error
}) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | null
  const [draft, setDraft] = useState(emptyUser);
  const [modalError, setModalError] = useState('');

  // Special WhatsApp-style action modals
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferSelfAction, setTransferSelfAction] = useState('demote_admin'); // 'demote_admin' | 'demote_employee' | 'deactivate' | 'leave'
  const [transferError, setTransferError] = useState('');

  const [promoteConfirmUser, setPromoteConfirmUser] = useState(null);
  const [dismissConfirmUser, setDismissConfirmUser] = useState(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);

  const isSuperAdmin = String(currentUser?.role || '').toUpperCase() === 'SUPER_ADMIN';

  // Count active Super Admins
  const activeSuperAdmins = useMemo(() => {
    return users.filter(
      (u) => String(u.role || '').toUpperCase() === 'SUPER_ADMIN' && u.status === 'Active'
    );
  }, [users]);

  // Role options available in modals
  const roleOptions = useMemo(() => {
    return isSuperAdmin ? roles : roles.filter((r) => r.key !== 'SUPER_ADMIN');
  }, [roles, isSuperAdmin]);

  const roleNameMap = useMemo(() => {
    return Object.fromEntries(roles.map((r) => [r.key, r.name]));
  }, [roles]);

  // Candidates for Super Admin transfer (active users who are NOT the current user)
  const transferCandidates = useMemo(() => {
    return users.filter(
      (u) => u.id !== currentUser?.id && u.status === 'Active'
    );
  }, [users, currentUser]);

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

  // Quick Promote to Super Admin handler
  const handleExecuteQuickPromote = async () => {
    if (!promoteConfirmUser) return;
    try {
      await onSaveUser({ ...promoteConfirmUser, role: 'SUPER_ADMIN' }, true);
      setPromoteConfirmUser(null);
      if (showToast) showToast(`${promoteConfirmUser.name} is now a Super Admin.`);
    } catch (err) {
      if (showToast) showToast(err.message || 'Failed to promote user to Super Admin.', 'error');
      else alert(err.message || 'Failed to promote user to Super Admin.');
    }
  };

  // Quick Dismiss as Super Admin handler
  const handleExecuteQuickDismiss = async (newRole = 'ADMIN') => {
    if (!dismissConfirmUser) return;
    try {
      await onSaveUser({ ...dismissConfirmUser, role: newRole }, true);
      setDismissConfirmUser(null);
      if (showToast) showToast(`${dismissConfirmUser.name} is now an ${newRole === 'ADMIN' ? 'Admin' : 'Employee'}.`);
    } catch (err) {
      if (showToast) showToast(err.message || 'Failed to dismiss Super Admin.', 'error');
      else alert(err.message || 'Failed to dismiss Super Admin.');
    }
  };

  // Transfer Super Admin handler
  const handleExecuteTransfer = async () => {
    if (!transferTargetId) {
      setTransferError('Please select a team member to transfer Super Admin privileges to.');
      return;
    }
    setTransferError('');
    try {
      if (onTransferSuperAdmin) {
        await onTransferSuperAdmin(transferTargetId, transferSelfAction);
        setTransferModalOpen(false);
      }
    } catch (err) {
      setTransferError(err.message || 'Failed to transfer Super Admin privileges.');
    }
  };

  // Delete User handler
  const handleExecuteDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    try {
      if (onDeleteUser) {
        await onDeleteUser(deleteConfirmUser.id);
        setDeleteConfirmUser(null);
      }
    } catch (err) {
      if (showToast) showToast(err.message || 'Failed to delete user.', 'error');
      else alert(err.message || 'Failed to delete user.');
    }
  };

  return (
    <div className="settings-section-container">
      {/* SECTION HEADER */}
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '2px' }}>
            <h2 style={{ margin: 0 }}>Users &amp; Personnel Accounts</h2>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  padding: '3px 9px',
                  background: '#fefce8',
                  border: '1px solid #fef08a',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '11.5px',
                  color: '#854d0e',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Crown size={12} style={{ color: '#eab308' }} />
                <span>{activeSuperAdmins.length} Active Super Admin{activeSuperAdmins.length === 1 ? '' : 's'}</span>
              </span>
              <span
                style={{
                  padding: '3px 9px',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  fontWeight: 500,
                  fontSize: '11.5px',
                  color: '#475569'
                }}
              >
                👥 {users.length} Total Members
              </span>
            </div>
          </div>
          <p>Create user logins, assign employee identification numbers, and delegate operational access roles.</p>
        </div>
        <div className="settings-section-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {isSuperAdmin && (
            <button
              type="button"
              className="settings-btn settings-btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: '#0284c7',
                color: '#0369a1',
                fontWeight: 600
              }}
              onClick={() => {
                setTransferTargetId(transferCandidates[0]?.id || '');
                setTransferSelfAction('demote_admin');
                setTransferError('');
                setTransferModalOpen(true);
              }}
              title="Transfer Super Admin privileges to another member"
            >
              <ArrowRightLeft size={15} />
              <span>Transfer Super Admin</span>
            </button>
          )}

          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={handleOpenCreate}
          >
            + Add New User
          </button>
        </div>
      </div>

      {/* USERS TABLE WRAPPER */}
      <div className="settings-table-wrapper">
        <div className="settings-table-toolbar">
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="settings-table-search" style={{ position: 'relative' }}>
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8'
                }}
              />
              <input
                type="text"
                placeholder="Search by name, email, employee ID, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '32px', paddingRight: search ? '28px' : undefined }}
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
              <col style={{ width: '27%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '18%' }} />
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
                  const isUserSuperAdmin = String(u.role || '').toUpperCase() === 'SUPER_ADMIN';
                  const isSelf = u.id === currentUser?.id;

                  return (
                    <tr key={u.id}>
                      {/* USER DETAILS */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              minWidth: '34px',
                              borderRadius: '50%',
                              background: isUserSuperAdmin ? '#fef3c7' : '#f1f5f9',
                              color: isUserSuperAdmin ? '#b45309' : '#475569',
                              border: isUserSuperAdmin ? '1px solid #fde047' : '1px solid #e2e8f0',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 700,
                              fontSize: '12px',
                              position: 'relative'
                            }}
                          >
                            {u.name.slice(0, 2).toUpperCase()}
                            {isUserSuperAdmin && (
                              <Crown
                                size={11}
                                style={{
                                  position: 'absolute',
                                  top: '-5px',
                                  right: '-4px',
                                  color: '#eab308',
                                  fill: '#fde047'
                                }}
                              />
                            )}
                          </div>
                          <div style={{ minWidth: 0, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <strong
                                style={{
                                  display: 'block',
                                  textOverflow: 'ellipsis',
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                  color: '#0f172a'
                                }}
                              >
                                {u.name}
                              </strong>
                              {isSelf && (
                                <span
                                  style={{
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    background: '#e0f2fe',
                                    color: '#0369a1',
                                    borderRadius: '10px'
                                  }}
                                  title="This is your active account"
                                >
                                  You
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* EMPLOYEE ID */}
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                          {u.employeeId || '—'}
                        </span>
                      </td>

                      {/* ASSIGNED ROLE */}
                      <td>
                        {isUserSuperAdmin ? (
                          <span
                            className="settings-pill-badge"
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Crown size={12} style={{ color: '#eab308' }} />
                            <span>SUPER ADMIN</span>
                          </span>
                        ) : (
                          <span className="settings-pill-badge">
                            {roleLabel}
                          </span>
                        )}
                      </td>

                      {/* MOBILE */}
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                          +91 {u.mobile}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`settings-pill-badge ${u.status === 'Active' ? 'active' : 'inactive'}`}>
                          {u.status}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td style={{ textAlign: 'right' }}>
                        <div className="settings-table-actions-group" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                          {/* ✏️ Edit Button */}
                          <button
                            type="button"
                            className="settings-btn settings-btn-secondary"
                            onClick={() => handleOpenEdit(u)}
                            style={{ padding: '6px 10px', fontSize: '12px' }}
                          >
                            Edit
                          </button>

                          {/* 👑 Super Admin Quick Management (WhatsApp-Style) */}
                          {isSuperAdmin && (
                            <>
                              {!isUserSuperAdmin && u.status === 'Active' && (
                                <button
                                  type="button"
                                  className="settings-btn settings-btn-secondary"
                                  style={{
                                    padding: '6px 9px',
                                    fontSize: '11.5px',
                                    color: '#059669',
                                    borderColor: '#a7f3d0',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                  onClick={() => setPromoteConfirmUser(u)}
                                  title="Promote this member to Super Admin"
                                >
                                  <Crown size={12} style={{ color: '#10b981' }} />
                                  <span>Make Admin</span>
                                </button>
                              )}

                              {isUserSuperAdmin && !isSelf && activeSuperAdmins.length > 1 && (
                                <button
                                  type="button"
                                  className="settings-btn settings-btn-secondary"
                                  style={{
                                    padding: '6px 9px',
                                    fontSize: '11.5px',
                                    color: '#b45309',
                                    borderColor: '#fde047'
                                  }}
                                  onClick={() => setDismissConfirmUser(u)}
                                  title="Dismiss this member from Super Admin role"
                                >
                                  Dismiss
                                </button>
                              )}

                              {/* 🗑️ Delete User Button */}
                              {!(isUserSuperAdmin && activeSuperAdmins.length <= 1) && (
                                <button
                                  type="button"
                                  className="settings-btn settings-btn-secondary"
                                  style={{
                                    padding: '6px 8px',
                                    color: '#ef4444',
                                    borderColor: '#fca5a5'
                                  }}
                                  onClick={() => setDeleteConfirmUser(u)}
                                  title={isSelf ? 'Leave organization (delete account)' : 'Remove user from organization'}
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </>
                          )}
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

      {/* ========================================================
          MODAL 1: CREATE / EDIT USER MODAL
          ======================================================== */}
      {modalMode && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-card" style={{ maxWidth: '540px' }}>
            <div className="settings-modal-header">
              <h3 className="settings-modal-title">
                {modalMode === 'edit' ? `Edit User: ${draft.name}` : 'Create New Personnel Account'}
              </h3>
              <button
                type="button"
                className="settings-modal-close"
                onClick={() => setModalMode(null)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="settings-modal-body">
                {modalError && (
                  <div
                    style={{
                      padding: '10px 14px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      color: '#b91c1c',
                      fontSize: '13px',
                      marginBottom: '16px'
                    }}
                  >
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
                    placeholder="e.g. Ramesh Kumar"
                  />
                </div>

                <div className="settings-grid-2">
                  <div className="settings-field-group">
                    <label className="settings-field-label">Employee ID</label>
                    <input
                      type="text"
                      className="settings-input"
                      value={draft.employeeId}
                      onChange={(e) => setDraft({ ...draft, employeeId: e.target.value })}
                      placeholder="EMP-001"
                    />
                  </div>
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
                      placeholder="user@asicrm.local"
                    />
                  </div>
                </div>

                <div className="settings-grid-2">
                  <div className="settings-field-group">
                    <label className="settings-field-label">
                      Mobile Number <span className="settings-required">*</span>
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
                        <option key={r.key} value={r.key}>
                          {r.key === 'SUPER_ADMIN' ? '👑 Super Admin' : r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {draft.role === 'SUPER_ADMIN' && (
                  <div
                    style={{
                      padding: '8px 12px',
                      background: '#fefce8',
                      border: '1px solid #fef08a',
                      borderRadius: '6px',
                      color: '#854d0e',
                      fontSize: '12px',
                      marginBottom: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Crown size={14} style={{ color: '#eab308' }} />
                    <span>
                      <strong>Super Admin:</strong> Full unrestricted access to all company data, databases, and user administration.
                    </span>
                  </div>
                )}

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

      {/* ========================================================
          MODAL 2: WHATSAPP-STYLE TRANSFER SUPER ADMIN & STEP DOWN
          ======================================================== */}
      {transferModalOpen && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-card" style={{ maxWidth: '520px' }}>
            <div className="settings-modal-header" style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowRightLeft size={18} />
                </div>
                <div>
                  <h3 className="settings-modal-title" style={{ color: '#15803d', margin: 0 }}>
                    Transfer Super Admin &amp; Step Down
                  </h3>
                  <span style={{ fontSize: '12px', color: '#166534' }}>
                    Delegate primary ownership to another active team member
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="settings-modal-close"
                onClick={() => setTransferModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <div className="settings-modal-body" style={{ padding: '20px' }}>
              {transferError && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    color: '#b91c1c',
                    fontSize: '13px',
                    marginBottom: '16px'
                  }}
                >
                  {transferError}
                </div>
              )}

              <p style={{ margin: '0 0 16px 0', fontSize: '13.5px', color: '#475569', lineHeight: 1.5 }}>
                Assign another active team member as the new Super Admin. Once transferred, you can step down to another role or leave the organization safely.
              </p>

              {/* SELECT TARGET MEMBER */}
              <div className="settings-field-group" style={{ marginBottom: '18px' }}>
                <label className="settings-field-label">
                  Select Member to Promote as Super Admin <span className="settings-required">*</span>
                </label>
                {transferCandidates.length === 0 ? (
                  <div style={{ padding: '10px', background: '#f8fafc', borderRadius: '6px', color: '#64748b', fontSize: '13px' }}>
                    No other active members available. Please create or invite a team member first.
                  </div>
                ) : (
                  <select
                    className="settings-select"
                    value={transferTargetId}
                    onChange={(e) => setTransferTargetId(e.target.value)}
                    style={{ fontSize: '13.5px', fontWeight: 600 }}
                  >
                    {transferCandidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({roleNameMap[c.role] || c.role}) • {c.email}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* WHAT TO DO WITH YOUR ACCOUNT */}
              <div className="settings-field-group">
                <label className="settings-field-label" style={{ marginBottom: '8px' }}>
                  What would you like to do with your account after transfer?
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: transferSelfAction === 'demote_admin' ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                      background: transferSelfAction === 'demote_admin' ? '#f0fdf4' : '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="radio"
                      name="selfAction"
                      value="demote_admin"
                      checked={transferSelfAction === 'demote_admin'}
                      onChange={() => setTransferSelfAction('demote_admin')}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>
                        👑 Step down to Admin (Recommended)
                      </strong>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        Remain active in ASICRM with full operational Admin management privileges.
                      </span>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: transferSelfAction === 'demote_employee' ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                      background: transferSelfAction === 'demote_employee' ? '#f0fdf4' : '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="radio"
                      name="selfAction"
                      value="demote_employee"
                      checked={transferSelfAction === 'demote_employee'}
                      onChange={() => setTransferSelfAction('demote_employee')}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>
                        👤 Step down to Employee
                      </strong>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        Remain active in ASICRM with everyday sales &amp; operational permissions.
                      </span>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: transferSelfAction === 'leave' ? '1.5px solid #ef4444' : '1px solid #e2e8f0',
                      background: transferSelfAction === 'leave' ? '#fef2f2' : '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="radio"
                      name="selfAction"
                      value="leave"
                      checked={transferSelfAction === 'leave'}
                      onChange={() => setTransferSelfAction('leave')}
                      style={{ marginTop: '2px' }}
                    />
                    <div>
                      <strong style={{ fontSize: '13px', color: '#dc2626', display: 'block' }}>
                        🚪 Leave Organization (Delete Account / Log Out)
                      </strong>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        Relinquish all privileges and leave the CRM group completely.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="settings-modal-footer" style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="settings-btn settings-btn-secondary"
                onClick={() => setTransferModalOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="settings-btn"
                style={{
                  background: '#10b981',
                  color: '#ffffff',
                  borderColor: '#059669',
                  cursor: transferCandidates.length === 0 ? 'not-allowed' : 'pointer'
                }}
                onClick={handleExecuteTransfer}
                disabled={transferCandidates.length === 0 || isSaving}
              >
                {isSaving ? 'Transferring...' : 'Confirm Transfer & Step Down'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: QUICK PROMOTE CONFIRMATION
          ======================================================== */}
      {promoteConfirmUser && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-card" style={{ maxWidth: '460px' }}>
            <div className="settings-modal-header" style={{ background: '#fefce8', borderBottom: '1px solid #fef08a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#fef08a', color: '#a16207', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Crown size={18} />
                </div>
                <h3 className="settings-modal-title" style={{ margin: 0, color: '#854d0e' }}>
                  Promote to Super Admin
                </h3>
              </div>
              <button type="button" className="settings-modal-close" onClick={() => setPromoteConfirmUser(null)}>
                &times;
              </button>
            </div>
            <div className="settings-modal-body" style={{ padding: '20px' }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '13.5px', color: '#1e293b' }}>
                Are you sure you want to promote <strong>{promoteConfirmUser.name}</strong> to <strong>Super Admin</strong>?
              </p>
              <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12.5px', color: '#475569' }}>
                Multiple Super Admins can co-exist with full access to manage all CRM modules, system settings, and personnel.
              </div>
            </div>
            <div className="settings-modal-footer" style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="settings-btn settings-btn-secondary" onClick={() => setPromoteConfirmUser(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="settings-btn"
                style={{ background: '#10b981', color: '#ffffff', borderColor: '#059669' }}
                onClick={handleExecuteQuickPromote}
              >
                Promote to Super Admin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 4: QUICK DISMISS CONFIRMATION
          ======================================================== */}
      {dismissConfirmUser && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-card" style={{ maxWidth: '460px' }}>
            <div className="settings-modal-header" style={{ background: '#fffbeb', borderBottom: '1px solid #fef3c7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserX size={18} />
                </div>
                <h3 className="settings-modal-title" style={{ margin: 0, color: '#92400e' }}>
                  Dismiss as Super Admin
                </h3>
              </div>
              <button type="button" className="settings-modal-close" onClick={() => setDismissConfirmUser(null)}>
                &times;
              </button>
            </div>
            <div className="settings-modal-body" style={{ padding: '20px' }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '13.5px', color: '#1e293b' }}>
                Demote <strong>{dismissConfirmUser.name}</strong> from Super Admin to regular Admin?
              </p>
              <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12.5px', color: '#475569' }}>
                Their role will be changed to <strong>Admin</strong>. They will retain standard administrative CRM permissions but lose Super Admin rights.
              </div>
            </div>
            <div className="settings-modal-footer" style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="settings-btn settings-btn-secondary" onClick={() => setDismissConfirmUser(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="settings-btn"
                style={{ background: '#d97706', color: '#ffffff', borderColor: '#b45309' }}
                onClick={() => handleExecuteQuickDismiss('ADMIN')}
              >
                Dismiss to Admin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 5: DELETE USER CONFIRMATION
          ======================================================== */}
      {deleteConfirmUser && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-card" style={{ maxWidth: '460px' }}>
            <div className="settings-modal-header" style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={18} />
                </div>
                <h3 className="settings-modal-title" style={{ margin: 0, color: '#991b1b' }}>
                  {deleteConfirmUser.id === currentUser?.id ? 'Leave Organization' : 'Remove User Account'}
                </h3>
              </div>
              <button type="button" className="settings-modal-close" onClick={() => setDeleteConfirmUser(null)}>
                &times;
              </button>
            </div>
            <div className="settings-modal-body" style={{ padding: '20px' }}>
              <p style={{ margin: '0 0 12px 0', fontSize: '13.5px', color: '#1e293b' }}>
                {deleteConfirmUser.id === currentUser?.id ? (
                  <>Are you sure you want to leave the organization and delete your account (<strong>{deleteConfirmUser.name}</strong>)?</>
                ) : (
                  <>Are you sure you want to permanently remove <strong>{deleteConfirmUser.name}</strong> ({deleteConfirmUser.email})?</>
                )}
              </p>
              <div style={{ padding: '10px 12px', background: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca', fontSize: '12.5px', color: '#991b1b' }}>
                This user account will be permanently removed from the system.
              </div>
            </div>
            <div className="settings-modal-footer" style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="settings-btn settings-btn-secondary" onClick={() => setDeleteConfirmUser(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="settings-btn"
                style={{ background: '#dc2626', color: '#ffffff', borderColor: '#b91c1c' }}
                onClick={handleExecuteDeleteUser}
              >
                {deleteConfirmUser.id === currentUser?.id ? 'Confirm & Leave' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
