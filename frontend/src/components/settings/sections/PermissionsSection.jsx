import React, { useState, useMemo } from 'react';

const MODULES = [
  'Enquiries',
  'Customers',
  'Quotations',
  'Orders & Deals',
  'Delivery Challans',
  'Purchase Orders',
  'Stocks',
  'User Administration'
];

const MODULE_ACTIONS = {
  Enquiries: ['View', 'Create', 'Edit', 'Follow Up', 'Close'],
  Customers: ['View', 'Create', 'Edit', 'Delete', 'View History', 'Manage Branches'],
  Quotations: ['View', 'Create', 'Edit', 'Download', 'Approve', 'Convert to Order'],
  'Orders & Deals': ['View', 'Create', 'Edit', 'Delete', 'Close'],
  'Delivery Challans': ['View', 'Create', 'Edit', 'Dispatch', 'Deliver', 'Return', 'Delete'],
  'Purchase Orders': ['View', 'Create', 'Edit', 'Receive Goods', 'Download', 'Approve', 'Delete'],
  Stocks: ['View', 'Create', 'Edit', 'Delete'],
  'User Administration': ['View Users', 'Create Users', 'Edit Users', 'Disable Users', 'Manage Roles', 'Manage Permissions']
};

export default function PermissionsSection({
  roles,
  permissions,
  permissionCatalog,
  currentUser,
  onSavePermissions,
  isSaving
}) {
  const catalog = permissionCatalog || MODULE_ACTIONS;
  const nonAdminRoles = useMemo(() => {
    return roles.filter((r) => r.key !== 'SUPER_ADMIN');
  }, [roles]);

  const [activeRoleKey, setActiveRoleKey] = useState(() => {
    return nonAdminRoles[0]?.key || (roles[0]?.key !== 'SUPER_ADMIN' ? roles[0]?.key : '');
  });

  const [draftMatrix, setDraftMatrix] = useState(() => {
    return JSON.parse(JSON.stringify(permissions || {}));
  });

  const [hasChanges, setHasChanges] = useState(false);

  // Sync draft when permissions prop updates
  React.useEffect(() => {
    setDraftMatrix(JSON.parse(JSON.stringify(permissions || {})));
    setHasChanges(false);
  }, [permissions]);

  React.useEffect(() => {
    if (!activeRoleKey && nonAdminRoles[0]?.key) {
      setActiveRoleKey(nonAdminRoles[0].key);
    }
  }, [nonAdminRoles, activeRoleKey]);

  const rolePermissions = useMemo(() => {
    return draftMatrix[activeRoleKey] || {};
  }, [draftMatrix, activeRoleKey]);

  const isRoleProtected = activeRoleKey === 'SUPER_ADMIN';

  const handleToggleAction = (moduleName, action) => {
    if (isRoleProtected) return;

    const currentActions = rolePermissions[moduleName] || [];
    let nextActions;
    if (currentActions.includes(action)) {
      nextActions = currentActions.filter((a) => a !== action);
    } else {
      nextActions = [...currentActions, action];
    }

    setDraftMatrix((prev) => ({
      ...prev,
      [activeRoleKey]: {
        ...(prev[activeRoleKey] || {}),
        [moduleName]: nextActions
      }
    }));
    setHasChanges(true);
  };

  const handleToggleModuleAll = (moduleName) => {
    if (isRoleProtected) return;

    const allActions = catalog[moduleName] || [];
    const currentActions = rolePermissions[moduleName] || [];
    const isAllSelected = allActions.every((a) => currentActions.includes(a));

    const nextActions = isAllSelected ? [] : [...allActions];

    setDraftMatrix((prev) => ({
      ...prev,
      [activeRoleKey]: {
        ...(prev[activeRoleKey] || {}),
        [moduleName]: nextActions
      }
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!activeRoleKey || isRoleProtected) return;
    await onSavePermissions(activeRoleKey, draftMatrix[activeRoleKey] || {});
    setHasChanges(false);
  };

  const activeRoleObj = roles.find((r) => r.key === activeRoleKey);

  return (
    <div className="settings-section-container">
      <div className="settings-section-head">
        <div className="settings-section-title-wrap">
          <h2>Role Permissions Matrix</h2>
          <p>Grant or revoke granular module-level actions, administrative tools, and pipeline visibility per role.</p>
        </div>
        <div className="settings-section-actions">
          {hasChanges && (
            <span className="settings-status-badge unsaved">
              <span className="settings-status-dot" />
              Unsaved Matrix Edits
            </span>
          )}
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={handleSave}
            disabled={isSaving || !hasChanges || isRoleProtected}
          >
            {isSaving ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      </div>

      {/* ROLE SELECTOR TABS */}
      <div className="settings-card" style={{ padding: '14px 18px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Configuring Role:</span>
          {roles.map((r) => {
            const isProtected = r.key === 'SUPER_ADMIN';
            const isSelected = r.key === activeRoleKey;

            return (
              <button
                key={r.key}
                type="button"
                className={`settings-btn ${isSelected ? 'settings-btn-primary' : 'settings-btn-secondary'}`}
                style={{ padding: '6px 14px', fontSize: '12px' }}
                onClick={() => setActiveRoleKey(r.key)}
              >
                {r.name}
                {isProtected && ' (Protected)'}
              </button>
            );
          })}
        </div>
      </div>

      {isRoleProtected ? (
        <div className="settings-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h3 style={{ margin: '0 0 6px', color: '#0f172a' }}>Super Administrator Access</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '13px', maxWidth: '440px', marginInline: 'auto' }}>
            The Super Admin role holds unrestricted system-wide authority across all modules, accounting registries, and settings.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          {Object.entries(catalog).map(([moduleName, actions]) => {
            const currentActions = rolePermissions[moduleName] || [];
            const isAllSelected = actions.length > 0 && actions.every((a) => currentActions.includes(a));

            return (
              <div key={moduleName} className="settings-card" style={{ marginBottom: 0 }}>
                <div className="settings-card-header" style={{ marginBottom: '14px', paddingBottom: '10px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px' }}>{moduleName}</h3>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {currentActions.length} of {actions.length} allowed
                    </span>
                  </div>
                  <button
                    type="button"
                    className="settings-btn settings-btn-secondary"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => handleToggleModuleAll(moduleName)}
                  >
                    {isAllSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {actions.map((act) => {
                    const isChecked = currentActions.includes(act);
                    return (
                      <label
                        key={act}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          background: isChecked ? '#f0fdf4' : '#f8fafc',
                          border: `1px solid ${isChecked ? '#bbf7d0' : '#e2e8f0'}`,
                          cursor: 'pointer',
                          userSelect: 'none',
                          fontSize: '13px',
                          fontWeight: isChecked ? 600 : 400,
                          color: isChecked ? '#166534' : '#334155',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleAction(moduleName, act)}
                          style={{ accentColor: '#16a34a', width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <span>{act}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
