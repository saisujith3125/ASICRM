import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Database,
  RefreshCw,
  RotateCcw,
  Trash2,
  Download,
  Upload,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  FileJson,
  Layers,
  ArrowRight,
  User,
  Calendar,
  X,
  Search,
  Check,
  HardDrive,
  Users,
  FileSpreadsheet,
  Package,
  ShoppingCart,
  Truck,
  Receipt,
  Building2,
  HelpCircle,
  Archive,
  Cloud,
  CloudOff
} from 'lucide-react';
import { apiFetch, apiUrl, safeJson } from '../../../api';

function authHeaders(user) {
  return {
    'Content-Type': 'application/json',
    'x-user-id': user?.id || ''
  };
}

export default function DatabaseBackupSection({ user, showToast }) {
  const [stats, setStats] = useState(null);
  const [backups, setBackups] = useState([]);
  const [latestBackup, setLatestBackup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mongoStatus, setMongoStatus] = useState(null);
  const [isSyncingMongo, setIsSyncingMongo] = useState(false);
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Action states
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Clear Database Modal state
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearConfirmationText, setClearConfirmationText] = useState('');
  const [clearOptions, setClearOptions] = useState({
    clearCustomers: true,
    clearEnquiries: true,
    clearLeads: true,
    clearQuotations: true,
    clearOrders: true,
    clearChallans: true,
    clearInvoices: true,
    clearProformas: true,
    clearPurchaseOrders: true,
    clearGoodsReceipts: true,
    resetStock: true,
    clearSuppliers: false,
    clearProducts: false
  });

  // Restore Modal state
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [selectedBackupToRestore, setSelectedBackupToRestore] = useState(null);

  // Inspect Modal state
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [inspectingBackup, setInspectingBackup] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectTab, setInspectTab] = useState('summary');

  // Manual Backup Modal state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualNote, setManualNote] = useState('');

  // Delete Backup Modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState(null);

  // Hidden File input for Import
  const fileInputRef = useRef(null);

  const fetchDatabaseStatsAndBackups = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [statsRes, backupsRes, mongoRes] = await Promise.all([
        apiFetch(apiUrl('/api/settings/database/stats'), { headers: authHeaders(user) }).catch(() => null),
        apiFetch(apiUrl('/api/settings/database/backups'), { headers: authHeaders(user) }).catch(() => null),
        apiFetch(apiUrl('/api/settings/database/mongo-status'), { headers: authHeaders(user) }).catch(() => null)
      ]);

      if (statsRes && statsRes.ok) {
        const statsData = await safeJson(statsRes);
        if (statsData.success && statsData.data) {
          setStats(statsData.data.stats || null);
          setLatestBackup(statsData.data.latestBackup || null);
        }
      }

      if (backupsRes && backupsRes.ok) {
        const bkpData = await safeJson(backupsRes);
        if (bkpData.success && Array.isArray(bkpData.data)) {
          setBackups(bkpData.data);
          if (!latestBackup && bkpData.data[0]) {
            setLatestBackup(bkpData.data[0]);
          }
        }
      }

      if (mongoRes && mongoRes.ok) {
        const mongoJson = await safeJson(mongoRes);
        if (mongoJson.success && mongoJson.data) {
          setMongoStatus(mongoJson.data);
        }
      }
    } catch (err) {
      console.error('Error fetching database stats/backups:', err);
      if (showToast) showToast('Failed to load database backup records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDatabaseStatsAndBackups();
  }, []);

  // Filtered backups list
  const filteredBackups = useMemo(() => {
    return backups.filter((b) => {
      const matchesFilter = filterType === 'ALL' || b.type === filterType;
      if (!matchesFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (b.title && b.title.toLowerCase().includes(q)) ||
        (b.id && b.id.toLowerCase().includes(q)) ||
        (b.createdBy && b.createdBy.toLowerCase().includes(q)) ||
        (b.note && b.note.toLowerCase().includes(q))
      );
    });
  }, [backups, filterType, searchQuery]);

  // Counts by category
  const backupCounts = useMemo(() => {
    return {
      all: backups.length,
      autoClear: backups.filter((b) => b.type === 'AUTO_CLEAR_BACKUP').length,
      manual: backups.filter((b) => b.type === 'MANUAL_BACKUP').length,
      preRestore: backups.filter((b) => b.type === 'PRE_RESTORE_BACKUP').length,
      imported: backups.filter((b) => b.type === 'IMPORTED_BACKUP').length
    };
  }, [backups]);

  // Handler: Create Quick / Manual Backup
  const handleCreateManualBackup = async (customTitle = '', customNote = '') => {
    setIsBackingUp(true);
    try {
      const title = customTitle.trim() || `Manual System Backup - ${new Date().toLocaleDateString('en-GB')}`;
      const res = await apiFetch(apiUrl('/api/settings/database/backup'), {
        method: 'POST',
        headers: authHeaders(user),
        body: JSON.stringify({ title, note: customNote.trim() })
      });
      const data = await safeJson(res);
      if (res.ok && data.success) {
        if (showToast) showToast(data.message || 'System backup created successfully.');
        setIsManualModalOpen(false);
        setManualTitle('');
        setManualNote('');
        await fetchDatabaseStatsAndBackups(true);
      } else {
        alert(data.message || 'Failed to create backup.');
      }
    } catch (err) {
      console.error('Error creating backup:', err);
      alert(err.message || 'Error occurred while creating backup.');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Handler: Sync to MongoDB Atlas
  const handleSyncToMongo = async () => {
    setIsSyncingMongo(true);
    try {
      const res = await apiFetch(apiUrl('/api/settings/database/sync-mongo'), {
        method: 'POST',
        headers: authHeaders(user)
      });
      const data = await safeJson(res);
      if (res.ok && data.success) {
        if (showToast) showToast('✓ ' + data.message);
        await fetchDatabaseStatsAndBackups(true);
      } else {
        alert(data.message || 'Failed to sync to MongoDB Atlas. Ensure 0.0.0.0/0 is added in Atlas Network Access whitelist.');
      }
    } catch (err) {
      alert('Error connecting to sync service: ' + err.message);
    } finally {
      setIsSyncingMongo(false);
    }
  };

  // Handler: Clear Database
  const handleExecuteClearDatabase = async () => {
    if (clearConfirmationText.trim().toUpperCase() !== 'CLEAR') {
      alert('Please type "CLEAR" into the confirmation field to proceed.');
      return;
    }

    setIsClearing(true);
    try {
      const res = await apiFetch(apiUrl('/api/settings/database/clear'), {
        method: 'POST',
        headers: authHeaders(user),
        body: JSON.stringify({ options: clearOptions })
      });
      const data = await safeJson(res);
      if (res.ok && data.success) {
        if (showToast) showToast(data.message || 'Database cleared. Auto-backup snapshot archived safely.');
        setIsClearModalOpen(false);
        setClearConfirmationText('');
        await fetchDatabaseStatsAndBackups(true);
      } else {
        alert(data.message || 'Failed to clear database.');
      }
    } catch (err) {
      console.error('Error clearing database:', err);
      alert(err.message || 'Failed to clear database.');
    } finally {
      setIsClearing(false);
    }
  };

  // Handler: Restore Backup
  const handleExecuteRestoreBackup = async () => {
    if (!selectedBackupToRestore) return;
    setIsRestoring(true);
    try {
      const res = await apiFetch(apiUrl(`/api/settings/database/restore/${encodeURIComponent(selectedBackupToRestore.id)}`), {
        method: 'POST',
        headers: authHeaders(user),
        body: JSON.stringify({})
      });
      const data = await safeJson(res);
      if (res.ok && data.success) {
        if (showToast) showToast(data.message || 'Database restored successfully.');
        setIsRestoreModalOpen(false);
        setSelectedBackupToRestore(null);
        await fetchDatabaseStatsAndBackups(true);
      } else {
        alert(data.message || 'Failed to restore database from backup.');
      }
    } catch (err) {
      console.error('Error restoring backup:', err);
      alert(err.message || 'Failed to restore database from backup.');
    } finally {
      setIsRestoring(false);
    }
  };

  // Handler: Inspect Backup
  const handleOpenInspectModal = async (backupSummary) => {
    setInspectingBackup(backupSummary);
    setInspectTab('summary');
    setIsInspectModalOpen(true);
    setInspectLoading(true);

    try {
      const res = await apiFetch(apiUrl(`/api/settings/database/backups/${encodeURIComponent(backupSummary.id)}`), {
        headers: authHeaders(user)
      });
      const data = await safeJson(res);
      if (res.ok && data.success && data.data) {
        setInspectingBackup(data.data);
      }
    } catch (err) {
      console.error('Error fetching full backup details:', err);
    } finally {
      setInspectLoading(false);
    }
  };

  // Handler: Delete Backup
  const handleExecuteDeleteBackup = async () => {
    if (!backupToDelete) return;
    try {
      const res = await apiFetch(apiUrl(`/api/settings/database/backups/${encodeURIComponent(backupToDelete.id)}`), {
        method: 'DELETE',
        headers: authHeaders(user)
      });
      const data = await safeJson(res);
      if (res.ok && data.success) {
        if (showToast) showToast(data.message || 'Backup deleted.');
        setIsDeleteModalOpen(false);
        setBackupToDelete(null);
        await fetchDatabaseStatsAndBackups(true);
      } else {
        alert(data.message || 'Failed to delete backup.');
      }
    } catch (err) {
      console.error('Error deleting backup:', err);
      alert(err.message || 'Failed to delete backup.');
    }
  };

  // Handler: Download Backup JSON
  const handleDownloadBackup = (backupId) => {
    window.open(apiUrl(`/api/settings/database/backups/${encodeURIComponent(backupId)}?download=true`), '_blank');
  };

  // Handler: File Import
  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = evt.target?.result;
        const parsed = JSON.parse(content);
        const res = await apiFetch(apiUrl('/api/settings/database/import'), {
          method: 'POST',
          headers: authHeaders(user),
          body: JSON.stringify(parsed)
        });
        const data = await safeJson(res);
        if (res.ok && data.success) {
          if (showToast) showToast(data.message || 'Backup file imported successfully.');
          await fetchDatabaseStatsAndBackups(true);
        } else {
          alert(data.message || 'Failed to import backup.');
        }
      } catch (err) {
        console.error('Import error:', err);
        alert('Invalid JSON file format. Please upload a valid ASICRM backup JSON file.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const formatDateTime = (isoStr) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="database-backup-section-wrapper" style={{ padding: '0 4px', maxWidth: '1280px' }}>
      {/* SECTION TITLE & DESCRIPTION */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={22} style={{ color: '#0284c7' }} />
          <span>Clear & Restore Database</span>
        </h2>
        <p style={{ margin: 0, fontSize: '13.5px', color: '#64748b', lineHeight: 1.5 }}>
          Manage your enterprise data lifecycle. Clear operational records with automatic pre-deletion safety snapshots, or restore from archived backup vaults at any time.
        </p>
      </div>

      {/* WHATSAPP-STYLE HERO BACKUP & DATABASE STATUS CARD */}
      <div
        className="settings-card"
        style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #f8fafc 60%, #f0f9ff 100%)',
          border: '1px solid #bbf7d0',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 4px 16px rgba(16, 185, 129, 0.08)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          {/* Left: Cloud & WhatsApp Backup Summary */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', minWidth: '280px', flex: '1 1 450px' }}>
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '14px',
                background: '#10b981',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 14px rgba(16, 185, 129, 0.3)',
                flexShrink: 0
              }}
            >
              <HardDrive size={28} strokeWidth={2.2} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 700, color: '#0f172a' }}>
                  CRM Database & Cloud Vault
                </h3>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '20px',
                    background: '#dcfce7',
                    color: '#15803d',
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }}></span>
                  Operational
                </span>
              </div>

              <div style={{ fontSize: '13px', color: '#475569', marginBottom: '10px' }}>
                {latestBackup ? (
                  <span>
                    <strong>Last Backup:</strong> {formatDateTime(latestBackup.createdAt)} ({latestBackup.sizeFormatted || '134 KB'}) •{' '}
                    <span style={{ color: '#059669', fontWeight: 600 }}>{latestBackup.title}</span>
                  </span>
                ) : (
                  <span style={{ color: '#d97706' }}>No backup created yet. It is recommended to capture a baseline snapshot.</span>
                )}
              </div>

              {/* Active Database Summary Counts Pill Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>Active Database:</span>
                <span style={{ padding: '3px 8px', background: '#e0f2fe', color: '#0369a1', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                  {stats?.totalRecords || 0} Total Records
                </span>
                <span style={{ padding: '3px 8px', background: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '11.5px', fontWeight: 500 }}>
                  👥 {stats?.customers || 0} Customers
                </span>
                <span style={{ padding: '3px 8px', background: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '11.5px', fontWeight: 500 }}>
                  📋 {stats?.quotations || 0} Quotations
                </span>
                <span style={{ padding: '3px 8px', background: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '11.5px', fontWeight: 500 }}>
                  📦 {stats?.orders || 0} Orders
                </span>
                <span style={{ padding: '3px 8px', background: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '11.5px', fontWeight: 500 }}>
                  🏷️ {stats?.products || 0} Products
                </span>
              </div>
            </div>
          </div>

          {/* Right: Primary Action Buttons (WhatsApp / Cloud Backup Style) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* 🟢 Back Up Now Button */}
            <button
              type="button"
              className="settings-btn"
              style={{
                background: '#10b981',
                color: '#ffffff',
                borderColor: '#059669',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                fontSize: '13.5px',
                fontWeight: 600,
                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
                cursor: 'pointer'
              }}
              onClick={() => {
                setManualTitle(`Manual System Backup - ${new Date().toLocaleDateString('en-GB')}`);
                setManualNote('');
                setIsManualModalOpen(true);
              }}
              disabled={isBackingUp || loading}
            >
              <Download size={16} />
              <span>{isBackingUp ? 'Backing Up...' : 'Back Up Now'}</span>
            </button>

            {/* 🔴 Clear & Delete Database Button */}
            <button
              type="button"
              className="settings-btn"
              style={{
                background: '#fee2e2',
                color: '#dc2626',
                borderColor: '#fca5a5',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 16px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              onClick={() => {
                setClearConfirmationText('');
                setIsClearModalOpen(true);
              }}
              disabled={isClearing || loading}
              title="Wipe operational CRM data. An automatic backup is always saved first."
            >
              <Trash2 size={16} />
              <span>Clear & Delete Database</span>
            </button>

            {/* 📥 Import Backup File Button */}
            <button
              type="button"
              className="settings-btn settings-btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 14px',
                fontSize: '13px',
                fontWeight: 600
              }}
              onClick={() => fileInputRef.current?.click()}
              title="Import previously saved backup JSON file"
            >
              <Upload size={15} />
              <span>Import JSON</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileImport}
              accept=".json,application/json"
              style={{ display: 'none' }}
            />

            {/* 🔄 Refresh Button */}
            <button
              type="button"
              className="settings-btn settings-btn-secondary"
              style={{ padding: '9px 12px' }}
              onClick={() => fetchDatabaseStatsAndBackups(true)}
              disabled={refreshing}
              title="Refresh database records and backups"
            >
              <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* MONGODB ATLAS CLOUD SYNCHRONIZATION STATUS CARD */}
      <div
        className="settings-card"
        style={{
          background: mongoStatus?.isConnected ? '#f0fdf4' : '#fffbeb',
          border: mongoStatus?.isConnected ? '1px solid #bbf7d0' : '1px solid #fde68a',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', maxWidth: '780px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: mongoStatus?.isConnected ? '#16a34a' : '#d97706',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {mongoStatus?.isConnected ? <Cloud size={22} /> : <CloudOff size={22} />}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a' }}>
                MongoDB Atlas Cloud Database (Cluster0 / asicrm)
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: mongoStatus?.isConnected ? '#dcfce7' : '#fef3c7',
                  color: mongoStatus?.isConnected ? '#15803d' : '#b45309',
                  fontSize: '11px',
                  fontWeight: 700
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: mongoStatus?.isConnected ? '#16a34a' : '#f59e0b'
                  }}
                />
                {mongoStatus?.isConnected ? 'Cloud Connected & In Sync' : 'Local Storage Mode (Cloud IP Blocked)'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.45 }}>
              {mongoStatus?.isConnected
                ? 'All CRM records are actively synchronized to MongoDB Atlas Cloud.'
                : 'Your CRM is safely operating in resilient local storage mode on the server. If MongoDB Atlas does not reflect new records (e.g. CUST-002), add 0.0.0.0/0 to MongoDB Atlas Network Access whitelist, then click Sync.'}
            </p>
          </div>
        </div>

        <div>
          <button
            type="button"
            className="settings-btn"
            style={{
              background: '#0284c7',
              color: '#ffffff',
              borderColor: '#0369a1',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            onClick={handleSyncToMongo}
            disabled={isSyncingMongo}
          >
            <RefreshCw size={14} className={isSyncingMongo ? 'spin' : ''} />
            <span>{isSyncingMongo ? 'Syncing to Cloud...' : 'Sync to MongoDB Atlas'}</span>
          </button>
        </div>
      </div>

      {/* BACKUP & RESTORE VAULT (THE HISTORY & RESTORE LIST) */}
      <div className="settings-card" style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px' }}>
        {/* Vault Header Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '18px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Archive size={18} style={{ color: '#6366f1' }} />
              <span>Backup Vault & Restore History</span>
              <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: '#f1f5f9', color: '#475569' }}>
                {backups.length} Snapshots
              </span>
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Every deleted or manual snapshot is safely archived here. Click <strong>Restore</strong> to revert the active database to any snapshot.
            </p>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search backups by title, ID..."
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                fontSize: '13px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              border: 'none',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              background: filterType === 'ALL' ? '#0f172a' : '#f1f5f9',
              color: filterType === 'ALL' ? '#ffffff' : '#475569'
            }}
          >
            All Snapshots ({backupCounts.all})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('AUTO_CLEAR_BACKUP')}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              border: 'none',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              background: filterType === 'AUTO_CLEAR_BACKUP' ? '#d97706' : '#fef3c7',
              color: filterType === 'AUTO_CLEAR_BACKUP' ? '#ffffff' : '#b45309'
            }}
          >
            Auto-Clear Backups ({backupCounts.autoClear})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('MANUAL_BACKUP')}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              border: 'none',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              background: filterType === 'MANUAL_BACKUP' ? '#059669' : '#d1fae5',
              color: filterType === 'MANUAL_BACKUP' ? '#ffffff' : '#065f46'
            }}
          >
            Manual Backups ({backupCounts.manual})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('PRE_RESTORE_BACKUP')}
            style={{
              padding: '5px 12px',
              borderRadius: '20px',
              border: 'none',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              background: filterType === 'PRE_RESTORE_BACKUP' ? '#7c3aed' : '#ede9fe',
              color: filterType === 'PRE_RESTORE_BACKUP' ? '#ffffff' : '#5b21b6'
            }}
          >
            Pre-Restore Snapshots ({backupCounts.preRestore})
          </button>
        </div>

        {/* Backups List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
            <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px', color: '#0284c7' }} />
            <p style={{ margin: 0, fontSize: '14px' }}>Loading backup vault...</p>
          </div>
        ) : filteredBackups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
            <Database size={36} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
            <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#334155' }}>No backup snapshots found</h4>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b' }}>
              {searchQuery ? 'No backups match your search filter.' : 'Create a manual backup or wipe the database to generate an automatic snapshot.'}
            </p>
            <button
              type="button"
              className="settings-btn settings-btn-primary"
              onClick={() => handleCreateManualBackup()}
              disabled={isBackingUp}
            >
              <Download size={15} style={{ marginRight: '6px' }} />
              Create First Backup Now
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredBackups.map((bkp) => {
              const isAutoClear = bkp.type === 'AUTO_CLEAR_BACKUP';
              const isPreRestore = bkp.type === 'PRE_RESTORE_BACKUP';
              const isImported = bkp.type === 'IMPORTED_BACKUP';

              return (
                <div
                  key={bkp.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px',
                    padding: '16px 18px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    background: isAutoClear ? '#fffbeb' : '#ffffff',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                  }}
                >
                  {/* Left: Info */}
                  <div style={{ minWidth: '280px', flex: '1 1 400px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      {/* Type Badge */}
                      {isAutoClear && (
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                          AUTO-CLEAR SNAPSHOT
                        </span>
                      )}
                      {isPreRestore && (
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe' }}>
                          PRE-RESTORE SNAPSHOT
                        </span>
                      )}
                      {isImported && (
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>
                          IMPORTED FILE
                        </span>
                      )}
                      {!isAutoClear && !isPreRestore && !isImported && (
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
                          MANUAL BACKUP
                        </span>
                      )}

                      <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                        {bkp.title}
                      </h4>
                      <code style={{ fontSize: '11.5px', color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                        {bkp.id}
                      </code>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12.5px', color: '#64748b', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={13} style={{ color: '#94a3b8' }} />
                        {formatDateTime(bkp.createdAt)}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={13} style={{ color: '#94a3b8' }} />
                        {bkp.createdBy || 'Super Admin'}
                      </span>
                      <span>
                        <strong>Size:</strong> {bkp.sizeFormatted || '134 KB'}
                      </span>
                    </div>

                    {/* Counts Pills */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 6px', background: '#e2e8f0', borderRadius: '4px', color: '#334155' }}>
                        {bkp.stats?.totalRecords || 0} Total Records
                      </span>
                      {Number(bkp.stats?.customers) > 0 && (
                        <span style={{ fontSize: '11px', padding: '2px 6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', color: '#475569' }}>
                          👥 {bkp.stats.customers} Customers
                        </span>
                      )}
                      {Number(bkp.stats?.quotations) > 0 && (
                        <span style={{ fontSize: '11px', padding: '2px 6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', color: '#475569' }}>
                          📋 {bkp.stats.quotations} Quotes
                        </span>
                      )}
                      {Number(bkp.stats?.orders) > 0 && (
                        <span style={{ fontSize: '11px', padding: '2px 6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', color: '#475569' }}>
                          📦 {bkp.stats.orders} Orders
                        </span>
                      )}
                      {Number(bkp.stats?.products) > 0 && (
                        <span style={{ fontSize: '11px', padding: '2px 6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', color: '#475569' }}>
                          🏷️ {bkp.stats.products} Products
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {/* 🔄 Restore Button */}
                    <button
                      type="button"
                      className="settings-btn"
                      style={{
                        background: '#10b981',
                        color: '#ffffff',
                        borderColor: '#059669',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '7px 14px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        setSelectedBackupToRestore(bkp);
                        setIsRestoreModalOpen(true);
                      }}
                      title="Restore entire database from this snapshot"
                    >
                      <RotateCcw size={14} />
                      <span>Restore</span>
                    </button>

                    {/* 👁️ Inspect Button */}
                    <button
                      type="button"
                      className="settings-btn settings-btn-secondary"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '7px 12px',
                        fontSize: '12.5px'
                      }}
                      onClick={() => handleOpenInspectModal(bkp)}
                      title="Inspect records inside this snapshot"
                    >
                      <Eye size={14} />
                      <span>Inspect</span>
                    </button>

                    {/* ⬇️ Download JSON */}
                    <button
                      type="button"
                      className="settings-btn settings-btn-secondary"
                      style={{ padding: '7px 10px' }}
                      onClick={() => handleDownloadBackup(bkp.id)}
                      title="Download backup JSON file to your computer"
                    >
                      <Download size={14} />
                    </button>

                    {/* 🗑️ Delete Button */}
                    <button
                      type="button"
                      className="settings-btn settings-btn-secondary"
                      style={{ padding: '7px 10px', color: '#ef4444', borderColor: '#fca5a5' }}
                      onClick={() => {
                        setBackupToDelete(bkp);
                        setIsDeleteModalOpen(true);
                      }}
                      title="Delete this snapshot permanently from vault"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================
          MODAL 1: CLEAR & DELETE ACTIVE DATABASE
          ======================================================== */}
      {isClearModalOpen && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-card" style={{ maxWidth: '600px' }}>
            <div className="settings-modal-header" style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="settings-modal-title" style={{ color: '#991b1b', margin: 0 }}>
                    Clear & Delete Active Database
                  </h3>
                  <span style={{ fontSize: '12px', color: '#b91c1c' }}>Automated safety backup enabled</span>
                </div>
              </div>
              <button type="button" className="settings-modal-close" onClick={() => setIsClearModalOpen(false)}>
                &times;
              </button>
            </div>

            <div className="settings-modal-body" style={{ padding: '20px' }}>
              {/* WhatsApp-Style Safety Guarantee Callout */}
              <div style={{ padding: '12px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#065f46', fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
                  <ShieldAlert size={16} />
                  <span>Automatic Safety Snapshot Guarantee:</span>
                </div>
                Before clearing any active records, ASICRM will automatically create a complete timestamped backup snapshot in your Backup Vault. You will be able to restore this data at any time.
              </div>

              <p style={{ margin: '0 0 12px 0', fontSize: '13.5px', color: '#334155', fontWeight: 600 }}>
                Select what to clear from the active database:
              </p>

              {/* Checkboxes Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', marginBottom: '20px', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1e293b', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={clearOptions.clearCustomers}
                    onChange={(e) => setClearOptions({ ...clearOptions, clearCustomers: e.target.checked })}
                  />
                  <span>Customers & Contacts ({stats?.customers || 0})</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1e293b', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={clearOptions.clearQuotations}
                    onChange={(e) => setClearOptions({ ...clearOptions, clearQuotations: e.target.checked })}
                  />
                  <span>Quotations & Proposals ({stats?.quotations || 0})</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1e293b', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={clearOptions.clearOrders}
                    onChange={(e) => setClearOptions({ ...clearOptions, clearOrders: e.target.checked })}
                  />
                  <span>Sales Orders ({stats?.orders || 0})</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1e293b', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={clearOptions.clearInvoices}
                    onChange={(e) => setClearOptions({ ...clearOptions, clearInvoices: e.target.checked })}
                  />
                  <span>Invoices & Proformas ({Number(stats?.invoices || 0) + Number(stats?.proformas || 0)})</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1e293b', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={clearOptions.clearChallans}
                    onChange={(e) => setClearOptions({ ...clearOptions, clearChallans: e.target.checked })}
                  />
                  <span>Delivery Challans ({stats?.deliveryChallans || 0})</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1e293b', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={clearOptions.clearEnquiries}
                    onChange={(e) => setClearOptions({ ...clearOptions, clearEnquiries: e.target.checked, clearLeads: e.target.checked })}
                  />
                  <span>Enquiries & Leads ({Number(stats?.enquiries || 0) + Number(stats?.leads || 0)})</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1e293b', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={clearOptions.clearPurchaseOrders}
                    onChange={(e) => setClearOptions({ ...clearOptions, clearPurchaseOrders: e.target.checked, clearGoodsReceipts: e.target.checked })}
                  />
                  <span>Purchase Orders & GRN ({Number(stats?.purchaseOrders || 0) + Number(stats?.goodsReceipts || 0)})</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1e293b', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={clearOptions.resetStock}
                    onChange={(e) => setClearOptions({ ...clearOptions, resetStock: e.target.checked })}
                  />
                  <span>Reset Inventory Quantities to 0</span>
                </label>
              </div>

              {/* Safety Typing Challenge */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  To confirm, type <strong style={{ color: '#dc2626' }}>CLEAR</strong> below:
                </label>
                <input
                  type="text"
                  value={clearConfirmationText}
                  onChange={(e) => setClearConfirmationText(e.target.value)}
                  placeholder="Type CLEAR"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '2px solid #cbd5e1',
                    fontSize: '14px',
                    fontWeight: 700,
                    letterSpacing: '0.05em'
                  }}
                />
              </div>
            </div>

            <div className="settings-modal-footer" style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="settings-btn settings-btn-secondary" onClick={() => setIsClearModalOpen(false)} disabled={isClearing}>
                Cancel
              </button>
              <button
                type="button"
                className="settings-btn"
                style={{
                  background: clearConfirmationText.trim().toUpperCase() === 'CLEAR' ? '#dc2626' : '#fca5a5',
                  color: '#ffffff',
                  borderColor: clearConfirmationText.trim().toUpperCase() === 'CLEAR' ? '#b91c1c' : '#fca5a5',
                  cursor: clearConfirmationText.trim().toUpperCase() === 'CLEAR' ? 'pointer' : 'not-allowed'
                }}
                onClick={handleExecuteClearDatabase}
                disabled={clearConfirmationText.trim().toUpperCase() !== 'CLEAR' || isClearing}
              >
                {isClearing ? 'Clearing & Archiving...' : 'Clear Database & Create Backup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: RESTORE DATABASE SNAPSHOT
          ======================================================== */}
      {isRestoreModalOpen && selectedBackupToRestore && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-card" style={{ maxWidth: '520px' }}>
            <div className="settings-modal-header" style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3 className="settings-modal-title" style={{ color: '#15803d', margin: 0 }}>
                    Restore Database from Snapshot
                  </h3>
                  <span style={{ fontSize: '12px', color: '#166534' }}>{selectedBackupToRestore.id}</span>
                </div>
              </div>
              <button type="button" className="settings-modal-close" onClick={() => setIsRestoreModalOpen(false)}>
                &times;
              </button>
            </div>

            <div className="settings-modal-body" style={{ padding: '20px' }}>
              <div style={{ padding: '12px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', color: '#1e40af', fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
                <strong>Automated Pre-Restore Safety Snapshot:</strong> Before replacing active records, ASICRM will automatically create a backup of your current database state.
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', marginBottom: '6px' }}>
                  Snapshot Details:
                </div>
                <div style={{ fontSize: '13px', color: '#334155', marginBottom: '4px' }}>
                  <strong>Title:</strong> {selectedBackupToRestore.title}
                </div>
                <div style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '10px' }}>
                  <strong>Created:</strong> {formatDateTime(selectedBackupToRestore.createdAt)} • {selectedBackupToRestore.sizeFormatted || '134 KB'}
                </div>

                <div style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Records being restored:
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ padding: '2px 6px', background: '#e2e8f0', borderRadius: '4px', fontSize: '11.5px', color: '#1e293b', fontWeight: 600 }}>
                    {selectedBackupToRestore.stats?.totalRecords || 0} Total Records
                  </span>
                  <span style={{ padding: '2px 6px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11.5px', color: '#334155' }}>
                    👥 {selectedBackupToRestore.stats?.customers || 0} Customers
                  </span>
                  <span style={{ padding: '2px 6px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11.5px', color: '#334155' }}>
                    📋 {selectedBackupToRestore.stats?.quotations || 0} Quotes
                  </span>
                  <span style={{ padding: '2px 6px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11.5px', color: '#334155' }}>
                    📦 {selectedBackupToRestore.stats?.orders || 0} Orders
                  </span>
                  <span style={{ padding: '2px 6px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '11.5px', color: '#334155' }}>
                    🏷️ {selectedBackupToRestore.stats?.products || 0} Products
                  </span>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                Are you sure you want to restore the CRM database to this snapshot?
              </p>
            </div>

            <div className="settings-modal-footer" style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="settings-btn settings-btn-secondary" onClick={() => setIsRestoreModalOpen(false)} disabled={isRestoring}>
                Cancel
              </button>
              <button
                type="button"
                className="settings-btn"
                style={{ background: '#10b981', color: '#ffffff', borderColor: '#059669', cursor: 'pointer' }}
                onClick={handleExecuteRestoreBackup}
                disabled={isRestoring}
              >
                {isRestoring ? 'Restoring Database...' : 'Confirm & Restore Database'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: INSPECT BACKUP SNAPSHOT RECORDS
          ======================================================== */}
      {isInspectModalOpen && inspectingBackup && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-card" style={{ maxWidth: '850px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="settings-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#ede9fe', color: '#6d28d9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Eye size={18} />
                </div>
                <div>
                  <h3 className="settings-modal-title" style={{ margin: 0 }}>
                    Inspect Backup: {inspectingBackup.title}
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    ID: {inspectingBackup.id} • {formatDateTime(inspectingBackup.createdAt)} • {inspectingBackup.sizeFormatted || '134 KB'}
                  </span>
                </div>
              </div>
              <button type="button" className="settings-modal-close" onClick={() => setIsInspectModalOpen(false)}>
                &times;
              </button>
            </div>

            {/* Inspect Navigation Tabs */}
            <div style={{ display: 'flex', gap: '4px', padding: '8px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setInspectTab('summary')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: inspectTab === 'summary' ? '#ffffff' : 'transparent',
                  color: inspectTab === 'summary' ? '#0284c7' : '#64748b',
                  boxShadow: inspectTab === 'summary' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setInspectTab('customers')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: inspectTab === 'customers' ? '#ffffff' : 'transparent',
                  color: inspectTab === 'customers' ? '#0284c7' : '#64748b',
                  boxShadow: inspectTab === 'customers' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                Customers ({inspectingBackup.stats?.customers || inspectingBackup.data?.customers?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setInspectTab('quotations')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: inspectTab === 'quotations' ? '#ffffff' : 'transparent',
                  color: inspectTab === 'quotations' ? '#0284c7' : '#64748b',
                  boxShadow: inspectTab === 'quotations' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                Quotations ({inspectingBackup.stats?.quotations || inspectingBackup.data?.quotations?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setInspectTab('orders')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: inspectTab === 'orders' ? '#ffffff' : 'transparent',
                  color: inspectTab === 'orders' ? '#0284c7' : '#64748b',
                  boxShadow: inspectTab === 'orders' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                Orders & Invoices ({Number(inspectingBackup.stats?.orders || inspectingBackup.data?.orders?.length || 0) + Number(inspectingBackup.stats?.invoices || inspectingBackup.data?.invoices?.length || 0)})
              </button>
              <button
                type="button"
                onClick={() => setInspectTab('products')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: inspectTab === 'products' ? '#ffffff' : 'transparent',
                  color: inspectTab === 'products' ? '#0284c7' : '#64748b',
                  boxShadow: inspectTab === 'products' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                Products ({inspectingBackup.stats?.products || inspectingBackup.data?.products?.length || 0})
              </button>
            </div>

            {/* Inspect Body Content */}
            <div className="settings-modal-body" style={{ padding: '20px', overflowY: 'auto', flex: '1 1 auto' }}>
              {inspectLoading ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px', color: '#0284c7' }} />
                  <p>Loading full snapshot data...</p>
                </div>
              ) : inspectTab === 'summary' ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '18px' }}>
                    <div style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>BACKUP ID</span>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{inspectingBackup.id}</div>
                    </div>
                    <div style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>TYPE</span>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{inspectingBackup.type}</div>
                    </div>
                    <div style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>CREATED BY</span>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{inspectingBackup.createdBy || 'Super Admin'}</div>
                    </div>
                    <div style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>TOTAL RECORDS</span>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#059669', marginTop: '2px' }}>{inspectingBackup.stats?.totalRecords || 0} Items</div>
                    </div>
                  </div>

                  <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#334155' }}>Collections Breakdown:</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                    <div style={{ padding: '8px 12px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}>
                      👥 Customers: <strong>{inspectingBackup.stats?.customers || inspectingBackup.data?.customers?.length || 0}</strong>
                    </div>
                    <div style={{ padding: '8px 12px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}>
                      📋 Quotations: <strong>{inspectingBackup.stats?.quotations || inspectingBackup.data?.quotations?.length || 0}</strong>
                    </div>
                    <div style={{ padding: '8px 12px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}>
                      📦 Orders: <strong>{inspectingBackup.stats?.orders || inspectingBackup.data?.orders?.length || 0}</strong>
                    </div>
                    <div style={{ padding: '8px 12px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}>
                      🏷️ Products: <strong>{inspectingBackup.stats?.products || inspectingBackup.data?.products?.length || 0}</strong>
                    </div>
                    <div style={{ padding: '8px 12px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}>
                      🧾 Invoices: <strong>{inspectingBackup.stats?.invoices || inspectingBackup.data?.invoices?.length || 0}</strong>
                    </div>
                    <div style={{ padding: '8px 12px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}>
                      🚚 Challans: <strong>{inspectingBackup.stats?.deliveryChallans || inspectingBackup.data?.deliveryChallans?.length || 0}</strong>
                    </div>
                    <div style={{ padding: '8px 12px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}>
                      💬 Enquiries: <strong>{inspectingBackup.stats?.enquiries || inspectingBackup.data?.enquiries?.length || 0}</strong>
                    </div>
                    <div style={{ padding: '8px 12px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px' }}>
                      🏢 Suppliers: <strong>{inspectingBackup.stats?.suppliers || inspectingBackup.data?.suppliers?.length || 0}</strong>
                    </div>
                  </div>
                </div>
              ) : inspectTab === 'customers' ? (
                <div>
                  {(!inspectingBackup.data?.customers || inspectingBackup.data.customers.length === 0) ? (
                    <p style={{ color: '#64748b', fontSize: '13px' }}>No customer records inside this backup.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                            <th style={{ padding: '8px' }}>Customer ID</th>
                            <th style={{ padding: '8px' }}>Name / Company</th>
                            <th style={{ padding: '8px' }}>Mobile</th>
                            <th style={{ padding: '8px' }}>Email</th>
                            <th style={{ padding: '8px' }}>City</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inspectingBackup.data.customers.map((c, i) => (
                            <tr key={c.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px', fontWeight: 600 }}>{c.id}</td>
                              <td style={{ padding: '8px' }}>{c.name} {c.company ? `(${c.company})` : ''}</td>
                              <td style={{ padding: '8px' }}>{c.mobile || '—'}</td>
                              <td style={{ padding: '8px' }}>{c.email || '—'}</td>
                              <td style={{ padding: '8px' }}>{c.city || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : inspectTab === 'quotations' ? (
                <div>
                  {(!inspectingBackup.data?.quotations || inspectingBackup.data.quotations.length === 0) ? (
                    <p style={{ color: '#64748b', fontSize: '13px' }}>No quotation records inside this backup.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                            <th style={{ padding: '8px' }}>Quote ID</th>
                            <th style={{ padding: '8px' }}>Customer</th>
                            <th style={{ padding: '8px' }}>Items</th>
                            <th style={{ padding: '8px' }}>Amount (₹)</th>
                            <th style={{ padding: '8px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inspectingBackup.data.quotations.map((q, i) => (
                            <tr key={q.quotationId || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px', fontWeight: 600 }}>{q.quotationId}</td>
                              <td style={{ padding: '8px' }}>{q.customerName || q.customerCompany || 'Customer'}</td>
                              <td style={{ padding: '8px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {q.item || (Array.isArray(q.items) ? q.items.map(it => it.productName || it.name).join(', ') : '—')}
                              </td>
                              <td style={{ padding: '8px', fontWeight: 600 }}>₹{Number(q.grandTotal || q.amount || 0).toLocaleString('en-IN')}</td>
                              <td style={{ padding: '8px' }}>
                                <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#f1f5f9', fontSize: '11px', fontWeight: 600 }}>
                                  {q.status || 'PENDING'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : inspectTab === 'orders' ? (
                <div>
                  {(!inspectingBackup.data?.orders || inspectingBackup.data.orders.length === 0) ? (
                    <p style={{ color: '#64748b', fontSize: '13px' }}>No orders found inside this backup.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                            <th style={{ padding: '8px' }}>Order ID</th>
                            <th style={{ padding: '8px' }}>Customer</th>
                            <th style={{ padding: '8px' }}>Amount (₹)</th>
                            <th style={{ padding: '8px' }}>Status</th>
                            <th style={{ padding: '8px' }}>Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inspectingBackup.data.orders.map((ord, i) => (
                            <tr key={ord.orderId || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px', fontWeight: 600 }}>{ord.orderId}</td>
                              <td style={{ padding: '8px' }}>{ord.customerName}</td>
                              <td style={{ padding: '8px', fontWeight: 600 }}>₹{Number(ord.amount || ord.grandTotal || 0).toLocaleString('en-IN')}</td>
                              <td style={{ padding: '8px' }}>{ord.status}</td>
                              <td style={{ padding: '8px' }}>{formatDateTime(ord.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {(!inspectingBackup.data?.products || inspectingBackup.data.products.length === 0) ? (
                    <p style={{ color: '#64748b', fontSize: '13px' }}>No products found inside this backup.</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                            <th style={{ padding: '8px' }}>Product Code</th>
                            <th style={{ padding: '8px' }}>Product Name</th>
                            <th style={{ padding: '8px' }}>Category</th>
                            <th style={{ padding: '8px' }}>Stock</th>
                            <th style={{ padding: '8px' }}>Price (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inspectingBackup.data.products.map((p, i) => (
                            <tr key={p.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px', fontWeight: 600 }}>{p.code}</td>
                              <td style={{ padding: '8px' }}>{p.name}</td>
                              <td style={{ padding: '8px' }}>{p.categoryName || 'General'}</td>
                              <td style={{ padding: '8px', fontWeight: 600 }}>{p.availableStock !== undefined ? p.availableStock : (p.stock || 0)}</td>
                              <td style={{ padding: '8px' }}>₹{Number(p.mrp || p.dealerPrice || p.price || 0).toLocaleString('en-IN')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="settings-modal-footer" style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="settings-btn settings-btn-secondary"
                onClick={() => handleDownloadBackup(inspectingBackup.id)}
              >
                <Download size={14} style={{ marginRight: '6px' }} />
                Download JSON
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="settings-btn settings-btn-secondary" onClick={() => setIsInspectModalOpen(false)}>
                  Close
                </button>
                <button
                  type="button"
                  className="settings-btn"
                  style={{ background: '#10b981', color: '#ffffff', borderColor: '#059669', cursor: 'pointer' }}
                  onClick={() => {
                    setIsInspectModalOpen(false);
                    setSelectedBackupToRestore(inspectingBackup);
                    setIsRestoreModalOpen(true);
                  }}
                >
                  <RotateCcw size={14} style={{ marginRight: '6px' }} />
                  Restore This Snapshot
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 4: MANUAL BACKUP TITLE PROMPT
          ======================================================== */}
      {isManualModalOpen && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-card" style={{ maxWidth: '480px' }}>
            <div className="settings-modal-header">
              <h3 className="settings-modal-title">Create Manual System Backup</h3>
              <button type="button" className="settings-modal-close" onClick={() => setIsManualModalOpen(false)}>
                &times;
              </button>
            </div>
            <div className="settings-modal-body" style={{ padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Backup Title / Label:
                </label>
                <input
                  type="text"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="e.g. End of Month Full Backup"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13.5px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Optional Note / Description:
                </label>
                <textarea
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  placeholder="e.g. Before financial audit / end of quarter snapshot"
                  rows={3}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'vertical' }}
                />
              </div>
            </div>
            <div className="settings-modal-footer" style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="settings-btn settings-btn-secondary" onClick={() => setIsManualModalOpen(false)} disabled={isBackingUp}>
                Cancel
              </button>
              <button
                type="button"
                className="settings-btn settings-btn-primary"
                onClick={() => handleCreateManualBackup(manualTitle, manualNote)}
                disabled={isBackingUp}
              >
                {isBackingUp ? 'Creating Backup...' : 'Save Backup Snapshot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 5: DELETE BACKUP CONFIRMATION
          ======================================================== */}
      {isDeleteModalOpen && backupToDelete && (
        <div className="settings-modal-overlay">
          <div className="settings-modal-card" style={{ maxWidth: '440px' }}>
            <div className="settings-modal-header">
              <h3 className="settings-modal-title" style={{ color: '#dc2626' }}>Delete Backup Snapshot</h3>
              <button type="button" className="settings-modal-close" onClick={() => setIsDeleteModalOpen(false)}>
                &times;
              </button>
            </div>
            <div className="settings-modal-body" style={{ padding: '20px' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#1e293b' }}>
                Are you sure you want to permanently delete backup snapshot <strong>{backupToDelete.title}</strong> (<code>{backupToDelete.id}</code>)?
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                This file will be permanently removed from disk. This action cannot be undone.
              </p>
            </div>
            <div className="settings-modal-footer" style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="settings-btn settings-btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="settings-btn"
                style={{ background: '#dc2626', color: '#ffffff', borderColor: '#b91c1c', cursor: 'pointer' }}
                onClick={handleExecuteDeleteBackup}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
