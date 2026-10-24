import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './settings.css';
import SettingsLayout from './SettingsLayout';
import CompanyProfileSection from './sections/CompanyProfileSection';
import BrandingSection from './sections/BrandingSection';
import LocationsSection from './sections/LocationsSection';
import BranchesSection from './sections/BranchesSection';
import WarehousesSection from './sections/WarehousesSection';
import InvoiceSetupSection from './sections/InvoiceSetupSection';
import QuotationSetupSection from './sections/QuotationSetupSection';
import DeliveryChallanSetupSection from './sections/DeliveryChallanSetupSection';
import PdfPrintSettingsSection from './sections/PdfPrintSettingsSection';
import EmailSetupSection from './sections/EmailSetupSection';
import SmsSettingsSection from './sections/SmsSettingsSection';
import PaymentMethodsSection from './sections/PaymentMethodsSection';
import CurrencySection from './sections/CurrencySection';
import TaxGstSection from './sections/TaxGstSection';
import DiscountSettingsSection from './sections/DiscountSettingsSection';
import UsersSection from './sections/UsersSection';
import RolesSection from './sections/RolesSection';
import PermissionsSection from './sections/PermissionsSection';
import ProductUnitsSection from './sections/ProductUnitsSection';
import DatabaseBackupSection from './sections/DatabaseBackupSection';
import SerialNumberSetupSection from './sections/SerialNumberSetupSection';
import DateFormatSetupSection from './sections/DateFormatSetupSection';

import { apiFetch, apiUrl } from '../../api';
import { DEFAULT_ASI_LOGO, notifyCompanyConfig, getCompanyConfig } from '../documents/companyConfig';

function authHeaders(user) {
  let activeId = user?.id || '';
  if (!activeId) {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('asicrm_user') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        activeId = parsed?.id || '';
      }
    } catch {}
  }
  return {
    'Content-Type': 'application/json',
    'x-user-id': activeId || 'USR-001'
  };
}

async function parseJsonSafely(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default function SettingsPage({
  user,
  initialSection = 'company-profile',
  onNavigateSection,
  onBack
}) {
  const [activeSection, setActiveSection] = useState(initialSection || 'company-profile');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [pendingNavigation, setPendingNavigation] = useState(null);

  // Settings Data States
  const [companyData, setCompanyData] = useState(() => getCompanyConfig());
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [permissionCatalog, setPermissionCatalog] = useState(null);

  // Track initial loaded data for unsaved indicator
  const [initialCompanyDataString, setInitialCompanyDataString] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    window.setTimeout(() => setToast((prev) => (prev === msg ? '' : prev)), 3500);
  };

  const handleSelectSection = (sec) => {
    setActiveSection(sec);
    if (onNavigateSection) {
      onNavigateSection(sec);
    }
  };

  const handleRequestBack = () => {
    if (hasUnsavedChanges) {
      setPendingNavigation({ type: 'back' });
    } else if (onBack) {
      onBack();
    }
  };

  const handleRequestSelectSection = (sec) => {
    if (sec === activeSection) return;
    if (hasUnsavedChanges) {
      setPendingNavigation({ type: 'section', target: sec });
    } else {
      handleSelectSection(sec);
    }
  };

  // Sync section if initialSection changes from outside route
  useEffect(() => {
    if (initialSection && initialSection !== activeSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  // Warn on browser refresh/close if unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Load complete settings from backend
  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(apiUrl('/api/settings'), {
        headers: authHeaders(user)
      });
      const json = await parseJsonSafely(res);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `Failed to load settings from server (${res.status}).`);
      }

      const d = json.data || {};
      setUsers(d.users || []);
      setRoles(d.roles || []);
      setPermissions(d.permissions || {});
      setPermissionCatalog(d.permissionCatalog || null);

      if (d.companySettings) {
        const cs = d.companySettings;
        setCompanyData(cs);
        setInitialCompanyDataString(JSON.stringify(cs));
        notifyCompanyConfig(cs);
      }
    } catch (err) {
      setError(err.message || 'Unable to connect to settings service.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Track company data modifications
  const handleCompanyDataChange = (updated) => {
    setCompanyData(updated);
    setHasUnsavedChanges(true);
  };

  // Save company settings
  const handleSaveCompanySettings = async (overrideData) => {
    setIsSaving(true);
    setError('');
    const dataToSave = (overrideData && typeof overrideData === 'object' && !overrideData.nativeEvent) ? overrideData : companyData;
    try {
      const res = await apiFetch(apiUrl('/api/settings/company'), {
        method: 'PUT',
        headers: authHeaders(user),
        body: JSON.stringify(dataToSave)
      });
      const json = await parseJsonSafely(res);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `Failed to save company settings (${res.status}).`);
      }

      const saved = json.data || dataToSave;
      setCompanyData(saved);
      setInitialCompanyDataString(JSON.stringify(saved));
      setHasUnsavedChanges(false);
      notifyCompanyConfig(saved);
      try {
        localStorage.setItem('asicrm_company_settings', JSON.stringify(saved));
      } catch (_) {}

      showToast('✓ All Changes Saved');
      return true;
    } catch (err) {
      const msg = err.message || 'Failed to save company settings.';
      setError(msg);
      showToast(`⚠ Failed to save changes: ${msg}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardAndProceed = () => {
    if (initialCompanyDataString) {
      try {
        setCompanyData(JSON.parse(initialCompanyDataString));
      } catch {}
    }
    setHasUnsavedChanges(false);
    const pending = pendingNavigation;
    setPendingNavigation(null);
    if (pending?.type === 'back' && onBack) {
      onBack();
    } else if (pending?.type === 'section' && pending.target) {
      handleSelectSection(pending.target);
    }
  };

  const handleSaveAndProceed = async () => {
    const success = await handleSaveCompanySettings();
    if (success) {
      const pending = pendingNavigation;
      setPendingNavigation(null);
      if (pending?.type === 'back' && onBack) {
        onBack();
      } else if (pending?.type === 'section' && pending.target) {
        handleSelectSection(pending.target);
      }
    }
  };

  // Image Upload Handlers
  const handleImageUpload = (file, fieldKey, label) => {
    if (!file) return;
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      alert(`Invalid ${label} format. Supported formats: PNG, JPG, WEBP, SVG.`);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert(`${label} file size exceeds 5MB limit. Please upload an image under 5MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result;
      if (base64) {
        handleCompanyDataChange({
          ...companyData,
          [fieldKey]: base64
        });
        showToast(`${label} selected. Remember to click "Save Changes".`);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadLogo = (e) => handleImageUpload(e.target.files?.[0], 'logoUrl', 'Company Logo');
  const handleResetLogo = () => {
    handleCompanyDataChange({ ...companyData, logoUrl: DEFAULT_ASI_LOGO });
    showToast('Reset to default official ASI logo.');
  };
  const handleRemoveLogo = () => {
    handleCompanyDataChange({ ...companyData, logoUrl: '' });
    showToast('Company logo removed.');
  };

  const handleUploadSign = (e) => handleImageUpload(e.target.files?.[0], 'signatureUrl', 'Authorized Signature');
  const handleRemoveSign = () => {
    handleCompanyDataChange({ ...companyData, signatureUrl: null });
    showToast('Authorized signature removed.');
  };

  const handleUploadSeal = (e) => handleImageUpload(e.target.files?.[0], 'sealUrl', 'Official Seal');
  const handleRemoveSeal = () => {
    handleCompanyDataChange({ ...companyData, sealUrl: null });
    showToast('Official seal reset to default vector stamp.');
  };

  // User Administration Handlers
  const handleSaveUser = async (draftUser, isEdit) => {
    setIsSaving(true);
    try {
      const url = isEdit ? `/api/settings/users/${draftUser.id}` : '/api/settings/users';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await apiFetch(apiUrl(url), {
        method,
        headers: authHeaders(user),
        body: JSON.stringify(draftUser)
      });
      const json = await parseJsonSafely(res);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || (res.status === 403 ? 'Permission denied: Super Admin accounts can only be edited by a Super Admin.' : `Failed to save user (${res.status}).`));
      }
      showToast(isEdit ? 'User updated successfully.' : 'User created successfully.');
      window.dispatchEvent(new CustomEvent('crm-user-updated', { detail: json?.data }));
      await loadSettings();

      // If user edited their own account
      if (draftUser.id === user?.id) {
        if (draftUser.status === 'Inactive') {
          showToast('Your account was deactivated. Logging out...');
          setTimeout(() => {
            localStorage.removeItem('asicrm_user');
            window.location.reload();
          }, 1000);
        } else if (json?.data) {
          const updatedUser = { ...user, ...json.data };
          localStorage.setItem('asicrm_user', JSON.stringify(updatedUser));
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    setIsSaving(true);
    try {
      const res = await apiFetch(apiUrl(`/api/settings/users/${userId}`), {
        method: 'DELETE',
        headers: authHeaders(user)
      });
      const json = await parseJsonSafely(res);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `Failed to delete user (${res.status}).`);
      }
      showToast(json?.message || 'User deleted successfully.');
      await loadSettings();

      if (json?.selfDeleted) {
        showToast('You have left the organization. Logging out...');
        setTimeout(() => {
          localStorage.removeItem('asicrm_user');
          window.location.reload();
        }, 1000);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTransferSuperAdmin = async (targetUserId, selfAction) => {
    setIsSaving(true);
    try {
      const res = await apiFetch(apiUrl('/api/settings/users/transfer-super-admin'), {
        method: 'POST',
        headers: authHeaders(user),
        body: JSON.stringify({ targetUserId, selfAction })
      });
      const json = await parseJsonSafely(res);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `Failed to transfer Super Admin (${res.status}).`);
      }
      showToast(json?.message || 'Super Admin privileges transferred successfully.');
      await loadSettings();

      if (selfAction === 'leave' || selfAction === 'deactivate') {
        showToast('You have stepped down and left. Logging out...');
        setTimeout(() => {
          localStorage.removeItem('asicrm_user');
          window.location.reload();
        }, 1200);
      } else if (json?.data?.self) {
        const updatedUser = { ...user, ...json.data.self };
        localStorage.setItem('asicrm_user', JSON.stringify(updatedUser));
        window.dispatchEvent(new CustomEvent('crm-user-updated', { detail: updatedUser }));
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Role Administration Handlers
  const handleSaveRole = async (draftRole, isEdit, roleKey) => {
    setIsSaving(true);
    try {
      const url = isEdit ? `/api/settings/roles/${roleKey}` : '/api/settings/roles';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await apiFetch(apiUrl(url), {
        method,
        headers: authHeaders(user),
        body: JSON.stringify(draftRole)
      });
      const json = await parseJsonSafely(res);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `Failed to save role (${res.status}).`);
      }
      showToast(isEdit ? 'Role updated successfully.' : 'Role created successfully.');
      await loadSettings();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = async (roleKey) => {
    setIsSaving(true);
    try {
      const res = await apiFetch(apiUrl(`/api/settings/roles/${roleKey}`), {
        method: 'DELETE',
        headers: authHeaders(user)
      });
      const json = await parseJsonSafely(res);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `Failed to delete role (${res.status}).`);
      }
      showToast('Role deleted successfully.');
      await loadSettings();
    } finally {
      setIsSaving(false);
    }
  };

  // Permissions Handler
  const handleSavePermissions = async (roleKey, matrix) => {
    setIsSaving(true);
    try {
      const res = await apiFetch(apiUrl(`/api/settings/permissions/${roleKey}`), {
        method: 'PUT',
        headers: authHeaders(user),
        body: JSON.stringify({ permissions: matrix })
      });
      const json = await parseJsonSafely(res);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `Failed to update permissions (${res.status}).`);
      }
      showToast(`Permissions updated for role ${roleKey}.`);
      setPermissions((prev) => ({ ...prev, [roleKey]: matrix }));
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
        <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #cbd5e1', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '12px' }} />
        <div>Loading ASI CRM System Settings...</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Active Section View Render
  const renderSectionContent = () => {
    switch (activeSection) {
      case 'company-profile':
        return (
          <CompanyProfileSection
            data={companyData}
            onChange={handleCompanyDataChange}
            onSave={handleSaveCompanySettings}
            isSaving={isSaving}
            onUploadLogo={handleUploadLogo}
            onUploadSign={handleUploadSign}
            onUploadSeal={handleUploadSeal}
          />
        );

      case 'branding':
        return (
          <BrandingSection
            data={companyData}
            onChange={handleCompanyDataChange}
            onSave={handleSaveCompanySettings}
            isSaving={isSaving}
            onUploadLogo={handleUploadLogo}
            onResetLogo={handleResetLogo}
            onRemoveLogo={handleRemoveLogo}
            onUploadSign={handleUploadSign}
            onRemoveSign={handleRemoveSign}
            onUploadSeal={handleUploadSeal}
            onRemoveSeal={handleRemoveSeal}
          />
        );

      case 'locations':
        return (
          <LocationsSection
            data={companyData}
            onChange={handleCompanyDataChange}
            onSave={handleSaveCompanySettings}
            isSaving={isSaving}
          />
        );

      case 'branches':
        return (
          <BranchesSection
            data={companyData}
            onChange={handleCompanyDataChange}
            onSave={handleSaveCompanySettings}
            isSaving={isSaving}
          />
        );

      case 'warehouses':
        return (
          <WarehousesSection
            data={companyData}
            onChange={handleCompanyDataChange}
            onSave={handleSaveCompanySettings}
            isSaving={isSaving}
          />
        );

      case 'product-units':
        return (
          <ProductUnitsSection
            data={companyData}
            onChange={handleCompanyDataChange}
            onSave={handleSaveCompanySettings}
            isSaving={isSaving}
          />
        );

      case 'serial-numbers':
        return (
          <SerialNumberSetupSection
            user={user}
            showToast={showToast}
          />
        );

      case 'date-format':
        return (
          <DateFormatSetupSection
            user={user}
            showToast={showToast}
          />
        );

      case 'invoice-setup':
        return (
          <InvoiceSetupSection
            data={companyData}
            onChange={handleCompanyDataChange}
            onSave={handleSaveCompanySettings}
            isSaving={isSaving}
          />
        );

      case 'quotation-setup':
        return (
          <QuotationSetupSection
            data={companyData}
            onChange={handleCompanyDataChange}
            onSave={handleSaveCompanySettings}
            isSaving={isSaving}
          />
        );

      case 'dc-setup':
        return (
          <DeliveryChallanSetupSection
            data={companyData}
            onChange={handleCompanyDataChange}
            onSave={handleSaveCompanySettings}
            isSaving={isSaving}
          />
        );

      case 'pdf-settings':
        return (
          <PdfPrintSettingsSection
            data={companyData}
            onChange={handleCompanyDataChange}
            onSave={handleSaveCompanySettings}
            isSaving={isSaving}
          />
        );

      case 'email-setup':
        return (
          <EmailSetupSection
            data={companyData}
            onChange={handleCompanyDataChange}
            onSave={handleSaveCompanySettings}
            isSaving={isSaving}
          />
        );

      case 'sms-settings':
        return (
          <SmsSettingsSection
            data={companyData}
            onChange={handleCompanyDataChange}
            onSave={handleSaveCompanySettings}
            isSaving={isSaving}
          />
        );

      case 'payment-methods':
        return (
          <PaymentMethodsSection
            data={companyData}
            onChange={handleCompanyDataChange}
            onSave={handleSaveCompanySettings}
            isSaving={isSaving}
          />
        );

      case 'currency':
        return (
          <CurrencySection
            data={companyData}
            onChange={handleCompanyDataChange}
            onSave={handleSaveCompanySettings}
            isSaving={isSaving}
          />
        );

      case 'tax-gst':
        return (
          <TaxGstSection
            data={companyData}
            onChange={handleCompanyDataChange}
            onSave={handleSaveCompanySettings}
            isSaving={isSaving}
          />
        );

      case 'discount-settings':
        return (
          <DiscountSettingsSection
            data={companyData}
            onChange={handleCompanyDataChange}
            onSave={handleSaveCompanySettings}
            isSaving={isSaving}
          />
        );

      case 'users':
        return (
          <UsersSection
            users={users}
            roles={roles}
            currentUser={user}
            onSaveUser={handleSaveUser}
            onDeleteUser={handleDeleteUser}
            onTransferSuperAdmin={handleTransferSuperAdmin}
            showToast={showToast}
            isSaving={isSaving}
            error={error}
          />
        );

      case 'roles':
        return (
          <RolesSection
            roles={roles}
            users={users}
            currentUser={user}
            onSaveRole={handleSaveRole}
            onDeleteRole={handleDeleteRole}
            isSaving={isSaving}
          />
        );

      case 'permissions':
        return (
          <PermissionsSection
            roles={roles}
            permissions={permissions}
            permissionCatalog={permissionCatalog}
            currentUser={user}
            onSavePermissions={handleSavePermissions}
            isSaving={isSaving}
          />
        );

      case 'database-backup':
        return (
          <DatabaseBackupSection
            user={user}
            showToast={showToast}
          />
        );

      default:
        return (
          <CompanyProfileSection
            data={companyData}
            onChange={handleCompanyDataChange}
            onSave={handleSaveCompanySettings}
            isSaving={isSaving}
            onUploadLogo={handleUploadLogo}
            onUploadSign={handleUploadSign}
            onUploadSeal={handleUploadSeal}
          />
        );
    }
  };

  return (
    <>
      <SettingsLayout
        activeSection={activeSection}
        onSelectSection={handleRequestSelectSection}
        hasUnsavedChanges={hasUnsavedChanges}
        onSaveActiveSection={
          ['users', 'roles', 'permissions', 'database-backup', 'serial-numbers', 'date-format'].includes(activeSection)
            ? null
            : handleSaveCompanySettings
        }
        isSaving={isSaving}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onBack={handleRequestBack}
      >
        {/* TOAST FEEDBACK */}
        {toast && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            background: '#0f172a',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            zIndex: 9999,
            fontSize: '13px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <span>{toast.startsWith('⚠') ? '' : '✓'}</span>
            <span>{toast.replace(/^✓\s*/, '')}</span>
          </div>
        )}

        {error && (
          <div style={{
            padding: '12px 18px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            color: '#b91c1c',
            marginBottom: '20px',
            fontSize: '13px'
          }}>
            {error}
          </div>
        )}

        {renderSectionContent()}
      </SettingsLayout>

      {/* UNSAVED CHANGES MODAL */}
      {pendingNavigation && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-card" style={{ maxWidth: '460px' }}>
            <div className="settings-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#fef3c7',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '18px'
                }}>
                  !
                </div>
                <h3 className="settings-modal-title">Unsaved Changes</h3>
              </div>
              <button
                type="button"
                className="settings-modal-close"
                onClick={() => setPendingNavigation(null)}
              >
                &times;
              </button>
            </div>
            <div className="settings-modal-body">
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#334155', lineHeight: '1.5' }}>
                You have modified settings that have not been saved yet.
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                If you leave without saving, your unsaved changes will be discarded.
              </p>
            </div>
            <div className="settings-modal-footer" style={{ justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="settings-btn settings-btn-secondary"
                onClick={() => setPendingNavigation(null)}
              >
                Stay
              </button>
              <button
                type="button"
                className="settings-btn"
                style={{ background: '#fee2e2', color: '#b91c1c', borderColor: '#fca5a5' }}
                onClick={handleDiscardAndProceed}
              >
                Discard Changes
              </button>
              <button
                type="button"
                className="settings-btn settings-btn-primary"
                onClick={handleSaveAndProceed}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}